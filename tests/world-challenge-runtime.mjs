import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {OWNER_CLAIM_HASH} from '../owner-setup.js';
const fixtureCode='runtime-fixture-owner-code',fixtureHash=createHash('sha256').update('JOBBY:OWNER-CLAIM:'+fixtureCode).digest('hex');
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:readFileSync(process.argv[2],'utf8').replace(OWNER_CLAIM_HASH,fixtureHash),compatibilityDate:'2026-10-01',durableObjects:{WORLD_ROOM:{className:'WorldRoom',useSQLite:true},WORLD_PLAYERS:{className:'WorldPlayers',useSQLite:true}}}));
const base='https://challenge.test',clients=[],pause=ms=>new Promise(r=>setTimeout(r,ms));let result=0;
async function wait(fn){for(let i=0;i<200;i++){if(fn())return;await pause(25);}throw Error('Challenge message timed out');}
const latest=(c,type)=>c.messages.filter(m=>m.type===type).at(-1),send=(c,m)=>c.ws.send(JSON.stringify(m));
async function api(path,token,body){const response=await mf.dispatchFetch(base+'/api/world/'+path,{method:body===undefined?'GET':'POST',headers:{origin:base,'content-type':'application/json',authorization:'Bearer '+token},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.ok(response.ok,path+' '+response.status);return response.json();}
try{
 const sessions=Array.from({length:5},(_,i)=>'challenge-test-session-secret-'+i),tokens=Array.from({length:4},()=>randomBytes(32).toString('hex'));
 for(let i=0;i<4;i++){await api('profile/create',tokens[i],{name:'Player '+i,legacy:{points:300}});await api('profile/link',tokens[i],{session:sessions[i]});}
 const forbidden=await mf.dispatchFetch(base+'/api/world/rooms',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({token:sessions[1],mode:'challenge',fee:50})});assert.equal(forbidden.status,403,'guest cannot create a challenge');
 await api('profile/owner-claim',tokens[0],{code:fixtureCode});
 const {code}=await api('rooms',null,{token:sessions[0],mode:'challenge',fee:50});
 async function connect(i){const response=await mf.dispatchFetch(base+`/api/world/rooms/${code}/socket?token=${sessions[i]}&name=Player${i}&avatar=JOBBY`,{headers:{upgrade:'websocket',origin:base}});assert.equal(response.status,101);const c={ws:response.webSocket,messages:[]};c.ws.accept();c.ws.addEventListener('message',e=>{if(typeof e.data==='string')c.messages.push(JSON.parse(e.data));});await wait(()=>latest(c,'welcome'));return c;}
 for(let i=0;i<4;i++)clients.push(await connect(i));
 let state=await api('rooms/'+code);assert.equal(state.maxPlayers,6);assert.deepEqual(Object.values(state.challenge.teams).sort(),['A','A','B','B']);
 send(clients[0],{type:'start'});await wait(()=>latest(clients[0],'error'));assert.equal((await api('profile',tokens[0])).state.points,300,'not-ready start never charges');
 send(clients[1],{type:'challenge_entry',fee:1000});await pause(80);assert.equal((await api('rooms/'+code)).challenge.fee,50,'guest cannot change entry');
 const oldTerms=(await api('rooms/'+code)).challenge;
 for(const c of clients)send(c,{type:'challenge_ready',ready:true,fee:oldTerms.fee,revision:oldTerms.revision});await wait(()=>latest(clients[0],'challenge_state')?.challenge.ready[latest(clients[3],'welcome').selfId]);
 send(clients[0],{type:'challenge_entry',fee:150});await wait(()=>latest(clients[0],'challenge_state')?.challenge.fee===150);assert.deepEqual(latest(clients[0],'challenge_state').challenge.ready,{},'new entry resets every approval');
 send(clients[1],{type:'challenge_ready',ready:true,fee:oldTerms.fee,revision:oldTerms.revision});await pause(80);assert.equal((await api('rooms/'+code)).challenge.ready[latest(clients[1],'welcome').selfId],undefined,'stale approval cannot authorize a different entry');
 const terms=(await api('rooms/'+code)).challenge;for(const c of clients)send(c,{type:'challenge_ready',ready:true,fee:terms.fee,revision:terms.revision});await wait(()=>Object.values(latest(clients[0],'challenge_state').challenge.ready).filter(Boolean).length===4);
 send(clients[1],{type:'start'});await pause(80);assert.equal((await api('rooms/'+code)).status,'lobby','only host starts');
 send(clients[0],{type:'start'});send(clients[0],{type:'start'});await wait(()=>clients.every(c=>latest(c,'start')?.race));
 const initial=latest(clients[0],'start').race;assert.equal(initial.challenge.pot,600);assert.equal(initial.challenge.status,'playing');
 for(let i=0;i<4;i++)assert.equal((await api('profile',tokens[i])).state.points,150,'each entry charged once');
 const late=await mf.dispatchFetch(base+`/api/world/rooms/${code}/socket?token=${sessions[4]}&avatar=JOBBY`,{headers:{upgrade:'websocket',origin:base}});assert.equal(late.status,409,'roster locks at start');
 const aid=latest(clients[0],'welcome').selfId,bid=latest(clients[2],'welcome').selfId;assert.equal(initial.challenge.teams[aid],'A');assert.equal(initial.challenge.teams[bid],'A');
 for(const c of clients){const p=initial.entries.find(p=>p.id===latest(c,'welcome').selfId);Object.assign(c,{x:p.x,z:p.z});}
 send(clients[0],{type:'pose',x:0,z:-134,y:0,h:0});await wait(()=>latest(clients[0],'race_reset'));assert.equal(latest(clients[0],'race_reset').checkpoint,0);
 await pause(Math.max(0,initial.started-Date.now()+100));
 async function advance(target,active){
  for(let step=0;step<250&&active.some(c=>c.z>target);step++){
   await pause(105);for(const c of active){c.x+=Math.max(-.6,Math.min(.6,-c.x));c.z=Math.max(target,c.z-.7);send(c,{type:'pose',x:c.x,z:c.z,y:0,h:Math.PI,anim:'Run'});}
  }await pause(150);
 }
 for(const target of [-35,-76,-114])await advance(target,[clients[0],clients[2]]);
 await advance(-134,[clients[0]]);await wait(()=>latest(clients[0],'race_finish'));assert.equal((await api('rooms/'+code)).status,'playing','one teammate finishing cannot win the team challenge');assert.equal((await api('profile',tokens[0])).state.points,150,'individual finish earns no normal 80-point race reward');
 clients[2].ws.close(1000,'Reconnect');await pause(120);clients[2]=await connect(2);const own=latest(clients[2],'welcome').race.entries.find(p=>p.id===bid);assert.equal(own.checkpoint,3);Object.assign(clients[2],{x:own.x,z:own.z});
 await advance(-134,[clients[2]]);await wait(()=>latest(clients[0],'challenge_state')?.challenge.status==='paid');
 const final=latest(clients[0],'challenge_state').challenge;assert.equal(final.winner,'A');assert.equal(final.payouts.length,2);assert.ok(final.payouts.every(p=>p.points===300));
 for(let i=0;i<4;i++)assert.equal((await api('profile',tokens[i])).state.points,i%2===0?450:150);
 send(clients[0],{type:'pose',x:0,z:-134,y:0,h:0});await pause(150);assert.equal((await api('profile',tokens[0])).state.points,450,'finish replay cannot pay twice');
 assert.equal((await api('leaderboard?mode=solo')).players.length,0,'team prize never enters solo ranks');assert.equal((await api('leaderboard?mode=team')).players.length,2);
 send(clients[0],{type:'start'});await wait(()=>latest(clients[0],'challenge_state').challenge.status==='lobby');assert.ok(Object.values(latest(clients[0],'challenge_state').challenge.ready).every(v=>!v),'rematch requires fresh consent');assert.equal((await api('profile',tokens[0])).state.points,450);
 console.log('PASS: real 2v2 private sockets, ready consent, owner-only creation and host validation, custom 150-point entries after owner-only changes and fresh consent, locked teams, checkpoint anti-teleport, team completion, reconnect, equal entire-pool payout once, split rankings and fresh rematch consent.');
}catch(e){console.error(e);console.error(clients.map(c=>({error:latest(c,'error'),challenge:latest(c,'challenge_state'),state:latest(c,'race_state')?.state})));result=1;}finally{for(const c of clients)c.ws.close(1000,'Test complete');await Promise.race([mf.dispose(),pause(1000)]);}process.exit(result);
