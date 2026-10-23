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
 const internal=new URL("https://players.internal"+url.pathname);
 const headers=new Headers(request.headers);
 if(url.pathname!=="/api/world/leaderboard"){
  const token=headers.get("authorization")?.replace(/^Bearer /,"");
  if(!/^[a-f0-9]{64}$/.test(token||""))return reply({error:"A valid private recovery code is required."},401);
  headers.set("x-player-key",await digest("JOBBY:PLAYER:"+token));
 }
 headers.delete("authorization");
 return env.WORLD_PLAYERS.get(env.WORLD_PLAYERS.idFromName("players-v1")).fetch(new Request(internal,{method:request.method,headers,body:request.method==="POST"?request.body:undefined}));
}

export class WorldPlayers extends DurableObject{
 constructor(ctx,env){
  super(ctx,env);this.sql=ctx.storage.sql;
  this.sql.exec(`CREATE TABLE IF NOT EXISTS players (key TEXT PRIMARY KEY,id TEXT UNIQUE,name TEXT,state TEXT,earned INTEGER DEFAULT 0,wins INTEGER DEFAULT 0,best REAL,created INTEGER)`);
  this.sql.exec("CREATE INDEX IF NOT EXISTS player_rank ON players(earned DESC,wins DESC,best ASC,id ASC)");
  this.sql.exec(`CREATE TABLE IF NOT EXISTS runs (player TEXT,id TEXT,map TEXT,started INTEGER,tasks TEXT DEFAULT '[]',finished INTEGER DEFAULT 0,ranked INTEGER DEFAULT 1,PRIMARY KEY(player,id))`);
 }
 get(key){return this.sql.exec("SELECT * FROM players WHERE key=?",key).toArray()[0];}
 view(p){const state=JSON.parse(p.state);return {id:p.id,name:p.name,state,earned:p.earned,wins:p.wins,best:p.best};}
 async fetch(request){
  const path=new URL(request.url).pathname,key=request.headers.get("x-player-key");
  if(path==="/api/world/leaderboard"&&request.method==="GET")return reply({players:this.sql.exec("SELECT id,name,earned,wins,best FROM players WHERE earned>0 ORDER BY earned DESC,wins DESC,best ASC,id ASC LIMIT 50").toArray()});
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
      this.sql.exec("INSERT INTO runs(player,id,map,started,ranked) VALUES(?,?,?,?,?)",key,a.run,a.map==="big-house-v1"?a.map:"classic",Date.now(),Math.abs(Date.now()-Number(a.at))<15000?1:0);
     }
     continue;
    }
    const run=this.sql.exec("SELECT * FROM runs WHERE player=? AND id=?",key,a.run).toArray()[0];
    if(!run||run.finished)continue;
    const tasks=JSON.parse(run.tasks);
    if(a.type==="task"&&Number.isInteger(a.index)&&a.index>=0&&a.index<3&&!tasks.includes(a.index)){
     tasks.push(a.index);state.points+=10;p.earned+=10;this.sql.exec("UPDATE runs SET tasks=? WHERE player=? AND id=?",JSON.stringify(tasks),key,a.run);
    }
    if(a.type==="finish"&&tasks.length>=(run.map==="classic"?3:1)){
     // Server timestamps prevent a client from choosing a fake leaderboard time.
     const seconds=Math.max(1,(Date.now()-run.started)/1000);
     state.points+=50;p.earned+=50;p.wins++;if(run.ranked)p.best=p.best===null?seconds:Math.min(p.best,seconds);
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
