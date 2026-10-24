import {DurableObject} from "cloudflare:workers";

const avatars={JOBBY:0,Casual_Male:0,Ninja_Male:0,Pug:0,Wizard:80,Pirate_Female:120};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
const cleanName=value=>String(value||"").trim().replace(/[<>\x00-\x1f\x7f]/g,"").slice(0,18);
const bounded=(v,max)=>Math.max(0,Math.min(max,Math.floor(Number(v)||0)));
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,"0")).join("");}

export async function playerApi(request,env){
 const url=new URL(request.url);
 if(!env.WORLD_PLAYERS)return reply({error:"Player saves are temporarily unavailable."},503);
 if(!["GET","POST"].includes(request.method))return reply({error:"Method not allowed."},405);
 if(request.method==="POST"){
  if(request.headers.get("origin")!==url.origin)return reply({error:"Same-origin requests only."},403);
  if(!request.headers.get("content-type")?.includes("application/json"))return reply({error:"JSON required."},415);
 }
 const internal=new URL("https://players.internal"+url.pathname+url.search);
 const headers=new Headers(request.headers);
 if(url.pathname!=="/api/world/leaderboard"){
  const token=headers.get("authorization")?.replace(/^Bearer /,"");
  if(!/^[a-f0-9]{64}$/.test(token||""))return reply({error:"A valid private recovery code is required."},401);
  headers.set("x-player-key",await digest("JOBBY:PLAYER:"+token));
 }
 headers.delete("authorization");
 if(url.pathname==="/api/world/profile/link"&&request.method==="POST"){
  let body;try{body=await request.json();}catch{return reply({error:"Invalid JSON."},400);}
  if(!/^[a-zA-Z0-9_-]{12,64}$/.test(body?.session||""))return reply({error:"Invalid room session."},400);
  headers.delete("content-length");
  return env.WORLD_PLAYERS.get(env.WORLD_PLAYERS.idFromName("players-v1")).fetch(new Request(internal,{method:"POST",headers,body:JSON.stringify({session:(await digest("JOBBY-WORLD:SESSION:"+body.session)).slice(0,32)})}));
 }
 return env.WORLD_PLAYERS.get(env.WORLD_PLAYERS.idFromName("players-v1")).fetch(new Request(internal,{method:request.method,headers,body:request.method==="POST"?request.body:undefined}));
}

export class WorldPlayers extends DurableObject{
 constructor(ctx,env){
  super(ctx,env);this.sql=ctx.storage.sql;
  this.sql.exec(`CREATE TABLE IF NOT EXISTS players (key TEXT PRIMARY KEY,id TEXT UNIQUE,name TEXT,state TEXT,earned INTEGER DEFAULT 0,wins INTEGER DEFAULT 0,best REAL,created INTEGER)`);
  this.sql.exec("CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,player TEXT,created INTEGER)");
  this.sql.exec("CREATE TABLE IF NOT EXISTS coop_awards(player TEXT,round TEXT,PRIMARY KEY(player,round))");
  this.sql.exec("CREATE INDEX IF NOT EXISTS player_rank ON players(earned DESC,wins DESC,best ASC,id ASC)");
  this.sql.exec(`CREATE TABLE IF NOT EXISTS runs (player TEXT,id TEXT,map TEXT,started INTEGER,tasks TEXT DEFAULT '[]',finished INTEGER DEFAULT 0,ranked INTEGER DEFAULT 1,PRIMARY KEY(player,id))`);
  this.sql.exec("CREATE TABLE IF NOT EXISTS mode_scores(player TEXT,mode TEXT,earned INTEGER DEFAULT 0,wins INTEGER DEFAULT 0,best REAL,PRIMARY KEY(player,mode))");
  this.sql.exec("CREATE TABLE IF NOT EXISTS schema_updates(id TEXT PRIMARY KEY)");
  if(!this.sql.exec("SELECT id FROM schema_updates WHERE id='mode-scores-v1'").toArray().length)this.ctx.storage.transactionSync(()=>{
   // Recover only rounds whose mode is known. Imported balances never become ranks.
   this.sql.exec(`INSERT OR IGNORE INTO mode_scores(player,mode,earned,wins,best)
    SELECT p.key,CASE WHEN json_extract(h.value,'$.coop')=1 THEN 'team' ELSE 'solo' END,
    SUM(COALESCE(json_extract(h.value,'$.points'),0)),COUNT(*),MIN(json_extract(h.value,'$.seconds'))
    FROM players p,json_each(p.state,'$.history') h
    WHERE COALESCE(json_extract(h.value,'$.legacy'),0)=0
    GROUP BY p.key,CASE WHEN json_extract(h.value,'$.coop')=1 THEN 'team' ELSE 'solo' END`);
   this.sql.exec("INSERT INTO schema_updates(id) VALUES('mode-scores-v1')");
  });
  this.sql.exec("CREATE TABLE IF NOT EXISTS challenge_pots(id TEXT PRIMARY KEY,room TEXT,roster TEXT,fee INTEGER,status TEXT,winner TEXT,payouts TEXT,expires INTEGER)");
 }
 get(key){return this.sql.exec("SELECT * FROM players WHERE key=?",key).toArray()[0];}
 view(p){const state=JSON.parse(p.state),rankings=Object.fromEntries(this.sql.exec("SELECT mode,earned,wins,best FROM mode_scores WHERE player=?",p.key).toArray().map(s=>[s.mode,{earned:s.earned,wins:s.wins,best:s.best}]));return {id:p.id,name:p.name,state,earned:p.earned,wins:p.wins,best:p.best,rankings};}
 score(key,mode,points,wins=0,seconds=null){
  this.sql.exec(`INSERT INTO mode_scores(player,mode,earned,wins,best) VALUES(?,?,?,?,?) ON CONFLICT(player,mode) DO UPDATE SET earned=earned+excluded.earned,wins=wins+excluded.wins,best=CASE WHEN excluded.best IS NULL THEN best WHEN best IS NULL THEN excluded.best ELSE MIN(best,excluded.best) END`,key,mode,points,wins,seconds);
 }
 async challengeAlarm(){
  const next=this.sql.exec("SELECT MIN(expires) AS at FROM challenge_pots WHERE status='held'").toArray()[0]?.at;
  if(next)await this.ctx.storage.setAlarm(Math.max(Date.now()+1000,next));else await this.ctx.storage.deleteAlarm();
 }
 async alarm(){
  for(const pot of this.sql.exec("SELECT id FROM challenge_pots WHERE status='held' AND expires<=?",Date.now()).toArray())await this.settleChallenge({round:pot.id,winner:null});
  await this.challengeAlarm();
 }
 async reserveChallenge(body){
  if(!/^[a-f0-9-]{36}$/.test(body.round||'')||!Array.isArray(body.entries)||body.entries.length<2||body.entries.length>6||!['A','B'].every(team=>body.entries.filter(p=>p.team===team).length===body.entries.length/2))return reply({error:'Two equal teams of 1–3 players are required.'},400);
  const result=this.ctx.storage.transactionSync(()=>{
   const old=this.sql.exec('SELECT * FROM challenge_pots WHERE id=?',body.round).toArray()[0];
   if(old)return old.room===body.room&&old.status==='held'?reply({ok:true,pot:JSON.parse(old.roster).length*old.fee}):reply({error:'This challenge cannot be charged again.'},409);
   const entries=[],seen=new Set();
   for(const e of body.entries){
    const session=this.sql.exec('SELECT player FROM sessions WHERE id=?',e.id).toArray()[0],p=session&&this.get(session.player);
    if(!p)return reply({error:'Every player must connect their saved profile before starting.'},409);
    if(seen.has(p.key))return reply({error:'Each player must use a different saved profile.'},409);seen.add(p.key);
    if(JSON.parse(p.state).points<100)return reply({error:p.name+' needs at least 100 free game points.'},409);
    // Prevent a second room from locking the same balance while a challenge runs.
    const active=this.sql.exec("SELECT roster FROM challenge_pots WHERE status='held'").toArray();
    if(active.some(row=>JSON.parse(row.roster).some(q=>q.key===p.key)))return reply({error:p.name+' already has an active challenge.'},409);
    entries.push({id:e.id,team:e.team,key:p.key});
   }
   for(const e of entries){const p=this.get(e.key),state=JSON.parse(p.state);state.points-=100;this.sql.exec('UPDATE players SET state=? WHERE key=?',JSON.stringify(state),e.key);}
   this.sql.exec("INSERT INTO challenge_pots(id,room,roster,fee,status,payouts,expires) VALUES(?,?,?,?,?,?,?)",body.round,body.room,JSON.stringify(entries),100,'held','[]',Date.now()+10*60*1000);
   return reply({ok:true,pot:entries.length*100});
  });
  await this.challengeAlarm();return result;
 }
 async settleChallenge(body){
  const result=this.ctx.storage.transactionSync(()=>{
   const pot=this.sql.exec('SELECT * FROM challenge_pots WHERE id=?',body.round).toArray()[0];
   if(!pot)return reply({error:'Challenge entry was not reserved.'},404);
   if(pot.status!=='held')return reply({ok:true,status:pot.status,winner:pot.winner,payouts:JSON.parse(pot.payouts)});
   const entries=JSON.parse(pot.roster),winner=['A','B'].includes(body.winner)&&Date.now()<pot.expires?body.winner:null;
   const recipients=winner?entries.filter(e=>e.team===winner):entries,share=winner?entries.length*pot.fee/recipients.length:pot.fee,payouts=[];
   for(const e of recipients){
    const p=this.get(e.key),state=JSON.parse(p.state);state.points+=share;
    if(winner){
     const seconds=Math.max(1,Math.min(600,Number(body.seconds)||1));
     state.history=[{character:state.selected,map:'team-challenge-v1',coop:true,points:share,entry:pot.fee,seconds,date:Date.now()},...(state.history||[])].slice(0,60);
     this.score(p.key,'team',share,1,seconds);
     this.sql.exec('UPDATE players SET state=?,earned=earned+?,wins=wins+1 WHERE key=?',JSON.stringify(state),share,e.key);
    }else this.sql.exec('UPDATE players SET state=? WHERE key=?',JSON.stringify(state),e.key);
    payouts.push({id:e.id,points:share});
   }
   const status=winner?'paid':'refunded';this.sql.exec('UPDATE challenge_pots SET status=?,winner=?,payouts=? WHERE id=?',status,winner,JSON.stringify(payouts),pot.id);
   return reply({ok:true,status,winner,payouts});
  });
  await this.challengeAlarm();return result;
 }
 async fetch(request){
  const path=new URL(request.url).pathname,key=request.headers.get("x-player-key");
  if(path==="/api/world/leaderboard"&&request.method==="GET"){
   const mode=new URL(request.url).searchParams.get("mode");
   if(mode&&!['solo','team'].includes(mode))return reply({error:"Invalid ranking mode."},400);
   return reply({mode:mode||"all",players:mode?this.sql.exec("SELECT p.id,p.name,s.earned,s.wins,s.best FROM mode_scores s JOIN players p ON p.key=s.player WHERE s.mode=? AND s.earned>0 ORDER BY s.earned DESC,s.wins DESC,s.best ASC,p.id ASC LIMIT 50",mode).toArray():this.sql.exec("SELECT id,name,earned,wins,best FROM players WHERE earned>0 ORDER BY earned DESC,wins DESC,best ASC,id ASC LIMIT 50").toArray()});
  }
  if(path==="/_challenge_reserve"&&request.method==="POST")return this.reserveChallenge(await request.json());
  if(path==="/_challenge_settle"&&request.method==="POST")return this.settleChallenge(await request.json());
  if(path==="/_room_reward"&&request.method==="POST"){
   const body=await request.json();
   if(!["warehouse-v1","jobby-race-v1","castle-dungeon-v1"].includes(body.map)||!Array.isArray(body.players)||body.players.length>12||!/^[a-f0-9-]{36}$/.test(body.round))return reply({error:"Invalid round."},400);
   return this.ctx.storage.transactionSync(()=>{
    for(const a of body.players){
     const session=this.sql.exec("SELECT player FROM sessions WHERE id=?",a.session).toArray()[0];if(!session)continue;
     const p=this.get(session.player);if(!p)continue;
     if(this.sql.exec("SELECT round FROM coop_awards WHERE player=? AND round=?",p.key,body.round).toArray().length)continue;
     const points=50+bounded(a.tasks,3)*10+bounded(a.rescues,3)*5,state=JSON.parse(p.state),seconds=Math.max(1,body.map==="jobby-race-v1"?Number(a.seconds)||1:(Date.now()-body.started)/1000);
     state.points+=points;state.history=[{character:state.selected,map:body.map,coop:true,points,seconds,date:Date.now()},...(state.history||[])].slice(0,60);
     this.sql.exec("INSERT INTO coop_awards(player,round) VALUES(?,?)",p.key,body.round);
     this.sql.exec("UPDATE players SET state=?,earned=?,wins=?,best=? WHERE key=?",JSON.stringify(state),p.earned+points,p.wins+1,p.best===null?seconds:Math.min(p.best,seconds),p.key);
     this.score(p.key,"team",points,1,seconds);
    }
    return reply({ok:true});
   });
  }
  if(!key)return reply({error:"Unauthorized."},401);
  if(request.method==="GET"){
   const p=this.get(key);return p?reply(this.view(p)):reply({error:"Player not found. Check your recovery code."},404);
  }
  const text=await request.text();if(text.length>24000)return reply({error:"Request too large."},413);
  let data;try{data=JSON.parse(text)}catch{return reply({error:"Invalid JSON."},400);}
  if(!data||typeof data!=="object"||Array.isArray(data))return reply({error:"Invalid request."},400);
  return this.ctx.storage.transactionSync(()=>{
   let p=this.get(key);
   if(path==="/api/world/profile/create"){
    if(!p){
     const old=data.legacy||{},unlocked=Array.isArray(old.unlocked)?old.unlocked.filter(a=>Object.hasOwn(avatars,a)&&avatars[a]>0):[];
     const selected=Object.hasOwn(avatars,old.selected)&&(!avatars[old.selected]||unlocked.includes(old.selected))?old.selected:"JOBBY";
     const history=(Array.isArray(data.history)?data.history:[]).slice(0,60).filter(e=>e&&Number.isFinite(e.seconds)&&e.seconds>0).map(e=>({character:Object.hasOwn(avatars,e.character)?e.character:"JOBBY",seconds:e.seconds,points:bounded(e.points,80),date:bounded(e.date,Date.now()),legacy:true}));
     const state={points:bounded(old.points,1000000),unlocked:[...new Set(unlocked)],selected,history,legacyWins:history.length,legacyBest:history.length?Math.min(...history.map(e=>e.seconds)):null};
     this.sql.exec("INSERT INTO players(key,id,name,state,created) VALUES(?,?,?,?,?)",key,crypto.randomUUID(),cleanName(data.name)||"Player",JSON.stringify(state),Date.now());p=this.get(key);
    }
    return reply(this.view(p));
   }
   if(!p)return reply({error:"Player not found."},404);
   if(path==="/api/world/profile/link"){
    if(!/^[a-f0-9]{32}$/.test(data.session||""))return reply({error:"Invalid session."},400);
    this.sql.exec("INSERT OR REPLACE INTO sessions(id,player,created) VALUES(?,?,?)",data.session,key,Date.now());
    this.sql.exec("DELETE FROM sessions WHERE created<?",Date.now()-2*86400000);
    return reply({ok:true});
   }
   if(path!=="/api/world/profile/sync")return reply({error:"Not found."},404);
   const actions=data.actions;if(!Array.isArray(actions)||actions.length>50)return reply({error:"Invalid action batch."},400);
   const state=JSON.parse(p.state),errors=[];
   for(const a of actions){
    if(!a||typeof a!=="object")continue;
    if(a.type==="name"){const name=cleanName(a.name);if(name)p.name=name;continue;}
    if(a.type==="select"){
     if(!(Object.hasOwn(avatars,a.avatar)))continue;
     if(avatars[a.avatar]&&!state.unlocked.includes(a.avatar)){
      if(state.points<avatars[a.avatar]){errors.push("Not enough saved points to unlock this hero.");continue;}
      state.points-=avatars[a.avatar];state.unlocked.push(a.avatar);
     }
     state.selected=a.avatar;continue;
    }
    if(!/^[a-f0-9-]{36}$/.test(a.run||""))continue;
    if(a.type==="start"){
     // One active solo run per profile; repeat delivery never resets a round.
     if(!this.sql.exec("SELECT id FROM runs WHERE player=? AND id=?",key,a.run).toArray().length){
      this.sql.exec("DELETE FROM runs WHERE player=? AND finished=0",key);
      this.sql.exec("INSERT INTO runs(player,id,map,started,ranked) VALUES(?,?,?,?,?)",key,a.run,["big-house-v1","warehouse-v1","jobby-race-v1","castle-dungeon-v1"].includes(a.map)?a.map:"classic",Date.now(),Math.abs(Date.now()-Number(a.at))<15000?1:0);
     }
     continue;
    }
    const run=this.sql.exec("SELECT * FROM runs WHERE player=? AND id=?",key,a.run).toArray()[0];
    if(!run||run.finished)continue;
    const tasks=JSON.parse(run.tasks);
    if(a.type==="task"&&Number.isInteger(a.index)&&a.index>=0&&a.index<3&&!tasks.includes(a.index)){
     tasks.push(a.index);state.points+=10;p.earned+=10;this.sql.exec("UPDATE runs SET tasks=? WHERE player=? AND id=?",JSON.stringify(tasks),key,a.run);
     this.score(key,"solo",10);
    }
    if(a.type==="finish"&&tasks.length>=(run.map==="big-house-v1"?1:3)){
     // Server timestamps prevent a client from choosing a fake leaderboard time.
     const seconds=Math.max(1,(Date.now()-run.started)/1000);
     state.points+=50;p.earned+=50;p.wins++;if(run.ranked)p.best=p.best===null?seconds:Math.min(p.best,seconds);
     this.score(key,"solo",50,1,run.ranked?seconds:null);
     state.history=[{character:state.selected,map:run.map,seconds:run.ranked?seconds:null,offline:!run.ranked,points:50+tasks.length*10,date:Date.now()},...(state.history||[])].slice(0,60);
     this.sql.exec("UPDATE runs SET finished=1 WHERE player=? AND id=?",key,a.run);
    }
   }
   this.sql.exec("UPDATE players SET name=?,state=?,earned=?,wins=?,best=? WHERE key=?",p.name,JSON.stringify(state),p.earned,p.wins,p.best,key);
   // Keep a bounded replay window; old completed IDs cannot receive rewards without a new start.
   this.sql.exec("DELETE FROM runs WHERE player=? AND finished=1 AND started<?",key,Date.now()-30*86400000);
   return reply({...this.view(this.get(key)),errors});
  });
 }
}
