import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {MAP_ID,spawn} from '../public/world/race-rules.js';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:process.argv[2],compatibilityDate:'2026-10-01',durableObjects:{WORLD_ROOM:{className:'WorldRoom',useSQLite:true},WORLD_PLAYERS:{className:'WorldPlayers',useSQLite:true}}}));
const base='https://jobby.test',clients=[],pause=ms=>new Promise(r=>setTimeout(r,ms));let result=0;
async function wait(fn){for(let i=0;i<200;i++){if(fn())return;await pause(25);}throw Error('Race message timed out');}
const latest=(c,type)=>c.messages.filter(m=>m.type===type).at(-1),send=(c,m)=>c.ws.send(JSON.stringify(m));
async function api(path,token,body){const response=await mf.dispatchFetch(base+'/api/world/'+path,{method:body===undefined?'GET':'POST',headers:{origin:base,'content-type':'application/json',authorization:'Bearer '+token},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.ok(response.ok,path+' '+response.status);return response.json();}
try{
 const secrets=Array.from({length:12},(_,i)=>'race-runtime-private-session-'+i),tokens=Array.from({length:2},()=>randomBytes(32).toString('hex'));
 for(let i=0;i<2;i++){await api('profile/create',tokens[i],{name:'Race tester '+i});await api('profile/link',tokens[i],{session:secrets[i]});}
 const {code}=await api('rooms',null,{token:secrets[0],map:MAP_ID});
 async function connect(i){const response=await mf.dispatchFetch(base+`/api/world/rooms/${code}/socket?token=${secrets[i]}&name=Racer${i}&avatar=JOBBY`,{headers:{upgrade:'websocket',origin:base}});assert.equal(response.status,101);const c={ws:response.webSocket,messages:[],...spawn(i)};c.ws.accept();c.ws.addEventListener('message',e=>{if(typeof e.data==='string')c.messages.push(JSON.parse(e.data));});await wait(()=>latest(c,'welcome'));return c;}
 for(let i=0;i<12;i++)clients.push(await connect(i));
 send(clients[1],{type:'start'});await pause(80);assert.equal((await api('rooms/'+code)).status,'lobby');
 send(clients[0],{type:'start'});await wait(()=>clients.every(c=>latest(c,'start')?.race));
 const initial=latest(clients[0],'start').race;assert.equal(initial.entries.length,12);
 for(const c of clients){const p=initial.entries.find(p=>p.id===latest(c,'welcome').selfId);Object.assign(c,{x:p.x,z:p.z});}
 const p0=initial.entries.find(p=>p.id===latest(clients[0],'welcome').selfId),nearest=initial.entries.filter(p=>p.id!==p0.id).sort((a,b)=>Math.hypot(a.x-p0.x,a.z-p0.z)-Math.hypot(b.x-p0.x,b.z-p0.z))[0];
 send(clients[0],{type:'pose',x:0,z:-135,y:0,h:0});await wait(()=>latest(clients[0],'race_reset'));assert.equal(latest(clients[0],'race_reset').checkpoint,0,'countdown locks movement');
 await pause(Math.max(0,initial.started-Date.now()+80));
 for(let i=0;i<12;i++)send(clients[i],{type:'pose',x:clients[i].x,z:clients[i].z,y:0,h:i===0?Math.atan2(nearest.x-p0.x,nearest.z-p0.z):Math.PI,anim:'Idle'});await pause(100);
 send(clients[0],{type:'race_push'});await wait(()=>latest(clients[1],'race_shove'));assert.equal(latest(clients[1],'race_shove').id,nearest.id);
 const pushes=clients[1].messages.filter(m=>m.type==='race_shove').length;send(clients[0],{type:'race_push'});await pause(80);assert.equal(clients[1].messages.filter(m=>m.type==='race_shove').length,pushes,'push cooldown enforced');
 send(clients[0],{type:'pose',x:0,z:-135,y:0,h:0});await pause(100);assert.equal(latest(clients[0],'race_finish'),undefined,'teleport finish cannot win');
 async function advance(target,active=clients){
  for(let step=0;step<250&&active.some(c=>c.z>target);step++){
   await pause(105);
   for(const c of active){c.x+=Math.max(-.6,Math.min(.6,-c.x));c.z=Math.max(target,c.z-.7);send(c,{type:'pose',x:c.x,z:c.z,y:0,h:Math.PI,anim:'Run'});}
  }
  await pause(150);
 }
 await advance(-35);assert.ok(clients.every(c=>c.messages.some(m=>m.type==='race_checkpoint'&&m.index===1)));
 // Force a fall and reconnect while preserving this racer's server checkpoint.
 send(clients[0],{type:'race_fall'});await wait(()=>latest(clients[0],'race_reset')?.checkpoint===1);const reset=latest(clients[0],'race_reset');assert.equal(reset.falls,1);
 clients[0].ws.close(1000,'Reconnect');await pause(100);clients[0]=await connect(0);const own=latest(clients[0],'welcome').race.entries.find(p=>p.id===latest(clients[0],'welcome').selfId);assert.equal(own.checkpoint,1);assert.equal(own.falls,1);Object.assign(clients[0],{x:own.x,z:own.z});
 await advance(-76);await advance(-114);
 assert.ok(clients[0].messages.some(m=>m.type==='race_checkpoint'&&m.index===3));
 await advance(-134,[clients[0]]);await wait(()=>latest(clients[0],'race_finish'));assert.equal(latest(clients[0],'race_finish').rank,1);assert.equal((await api('rooms/'+code)).status,'playing','one finish leaves other racers in play');
 await wait(()=>latest(clients[0],'race_state')?.state.entries.some(p=>p.rank===1));
 let profile=await api('profile',tokens[0]);assert.equal(profile.state.points,80);assert.equal(profile.wins,1);assert.equal(profile.state.history[0].map,MAP_ID);
 await advance(-134,clients.slice(1));await wait(()=>latest(clients[1],'race_state')?.state.status==='finished');
 const ranks=latest(clients[1],'race_state').state.entries.map(p=>p.rank);assert.equal(new Set(ranks).size,12);assert.ok(ranks.every(n=>n>=1&&n<=12));
 profile=await api('profile',tokens[1]);assert.equal(profile.state.points,80);assert.equal(profile.wins,1);
 send(clients[0],{type:'pose',x:0,z:-134,y:0,h:0});await pause(120);assert.equal((await api('profile',tokens[0])).state.points,80,'replay cannot duplicate rewards');
 const leader=await api('leaderboard');assert.equal(leader.players.length,2,'only linked players appear');
 const hostId=latest(clients[0],'welcome').hostId,host=clients.find(c=>latest(c,'welcome').selfId===hostId);send(host,{type:'start'});await wait(()=>latest(clients[1],'start').race.round!==initial.round);assert.ok(latest(clients[1],'start').race.entries.every(p=>p.checkpoint===0&&!p.finishAt),'host can restart a clean race');
 console.log('PASS: twelve real race sockets, countdown, bounded movement, nearby push/cooldown, checkpoints, fall/reconnect persistence, individual ranks, continued race after first finish, saved points once and same-room restart.');
}catch(error){console.error(error);console.error(clients.map(c=>({pose:c.z,self:latest(c,'welcome')?.selfId,reset:latest(c,'race_reset'),finish:latest(c,'race_finish'),state:latest(c,'race_state')?.state.entries.map(p=>[p.name,p.checkpoint,p.rank,p.z])})));result=1;}finally{for(const c of clients)c.ws.close(1000,'Complete');await Promise.race([mf.dispose(),pause(1000)]);}process.exit(result);
