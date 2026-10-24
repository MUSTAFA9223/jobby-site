import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {OWNER_CLAIM_HASH} from '../owner-setup.js';
import * as rules from '../public/world/party-rules.js';
const fixtureCode='party-runtime-owner-fixture',fixtureHash=createHash('sha256').update('JOBBY:OWNER-CLAIM:'+fixtureCode).digest('hex');
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:readFileSync(process.argv[2],'utf8').replace(OWNER_CLAIM_HASH,fixtureHash),compatibilityDate:'2026-10-01',durableObjects:{WORLD_ROOM:{className:'WorldRoom',useSQLite:true},WORLD_PLAYERS:{className:'WorldPlayers',useSQLite:true}}}));
const base='https://party.test',clients=[],pause=ms=>new Promise(r=>setTimeout(r,ms));let result=0;
const latest=(c,type)=>c.messages.filter(m=>m.type===type).at(-1),send=(c,m)=>c.ws.send(JSON.stringify(m));
async function wait(fn){for(let i=0;i<240;i++){if(fn())return;await pause(25);}throw Error('Crown room message timed out');}
async function api(path,token,body){const response=await mf.dispatchFetch(base+'/api/world/'+path,{method:body===undefined?'GET':'POST',headers:{origin:base,'content-type':'application/json',authorization:'Bearer '+token},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.ok(response.ok,path+' '+response.status);return response.json();}
try{
 const sessions=Array.from({length:4},(_,i)=>'crown-party-runtime-secret-'+i),tokens=Array.from({length:4},()=>randomBytes(32).toString('hex'));
 for(let i=0;i<4;i++){await api('profile/create',tokens[i],{name:'Crown player '+i,legacy:{points:300}});await api('profile/link',tokens[i],{session:sessions[i]});}
 await api('profile/owner-claim',tokens[0],{code:fixtureCode});const {code}=await api('rooms',null,{token:sessions[0],mode:'challenge',game:'crown',fee:70});
 async function connect(i){const response=await mf.dispatchFetch(base+`/api/world/rooms/${code}/socket?token=${sessions[i]}&avatar=JOBBY&name=Racer${i}`,{headers:{upgrade:'websocket',origin:base}});assert.equal(response.status,101);const c={ws:response.webSocket,messages:[]};c.ws.accept();c.ws.addEventListener('message',e=>{if(typeof e.data!=='string')return;const m=JSON.parse(e.data);c.messages.push(m);if(m.type==='welcome'){c.id=m.selfId;c.pos={...m.party.actors[c.id]};}if(m.type==='party_state'&&m.state.actors[c.id]&&!c.walking)c.pos={...m.state.actors[c.id]};if(m.type==='party_reset'&&m.id===c.id)c.pos={...c.pos,...m};});await wait(()=>latest(c,'welcome'));return c;}
 for(let i=0;i<4;i++)clients.push(await connect(i));assert.equal(latest(clients[0],'welcome').map,rules.MAP_ID);assert.ok(!('sequence' in latest(clients[1],'welcome').party.echo),'private rune code never enters the shared welcome');
 const terms=(await api('rooms/'+code)).challenge;for(const c of clients)send(c,{type:'challenge_ready',ready:true,fee:terms.fee,revision:terms.revision});await wait(()=>Object.values(latest(clients[0],'challenge_state')?.challenge.ready||{}).filter(Boolean).length===4);send(clients[0],{type:'start'});await wait(()=>clients.every(c=>latest(c,'start')?.party));
 const first=latest(clients[0],'start').party;assert.equal(first.challenge.pot,280);assert.equal(first.challenge.fee,70);for(let i=0;i<4;i++)assert.equal((await api('profile',tokens[i])).state.points,230);
 await pause(Math.max(0,first.started-Date.now()+100));
 send(clients[1],{type:'party_action',action:{type:'potion',potion:'jelly'}});await wait(()=>latest(clients[1],'party_note')?.note?.includes('JELLY'));send(clients[3],{type:'party_action',action:{type:'signal',index:4}});await wait(()=>latest(clients[0],'party_state')?.state.signals.some(s=>s.id===clients[3].id));
 const bad=clients[1].messages.length;send(clients[1],{type:'pose',x:0,z:-12,y:0,h:0,anim:'Run'});await wait(()=>clients[1].messages.slice(bad).some(m=>m.type==='party_reset'));assert.equal(latest(clients[1],'party_reset').z,21,'teleport pickup is corrected');
 async function walk(c,points,step=.63){
  c.walking=true;
  for(const target of points){let n=0;while(Math.hypot(c.pos.x-target.x,c.pos.z-target.z)>.08){if(n++>500)throw Error('Walk stalled '+c.id+' to '+JSON.stringify(target)+' from '+JSON.stringify(c.pos));await pause(110);const dx=target.x-c.pos.x,dz=target.z-c.pos.z,len=Math.hypot(dx,dz),d=Math.min(step,len);const next={x:c.pos.x+dx/len*d,z:c.pos.z+dz/len*d,y:0,h:Math.atan2(dx,dz)};send(c,{type:'pose',...next,anim:'Run'});Object.assign(c.pos,next);}await pause(120);}
  c.walking=false;
 }
 async function act(c,action){await pause(180);const count=c.messages.filter(m=>m.type==='party_note').length;send(c,{type:'party_action',action});await wait(()=>c.messages.filter(m=>m.type==='party_note').length>count);assert.ok(!latest(c,'party_note').error,latest(c,'party_note').error);await pause(120);}
 const carrier=clients[0],helper=clients[2];
 await Promise.all([walk(carrier,[{x:0,z:21},{x:0,z:4},rules.CROWN]),(async()=>{await walk(helper,[{x:-5,z:21},rules.BAG]);await act(helper,{type:'bag'});await wait(()=>latest(helper,'party_state')?.state.bag.owner===helper.id);await walk(helper,[{x:23,z:21},rules.TREASURE],.43);})()]);
 await act(carrier,{type:'crown'});await wait(()=>latest(carrier,'party_state')?.state.crown.owner===carrier.id);await act(helper,{type:'bank_bag'});await wait(()=>latest(helper,'party_state')?.state.bag.delivered);
 clients[2].ws.close(1000,'Reconnect test');await pause(120);clients[2]=await connect(2);assert.equal(latest(clients[2],'welcome').party.actors[clients[2].id].team,'A');assert.equal((await api('profile',tokens[2])).state.points,230,'reconnect cannot pay early');
 await walk(carrier,[{x:0,z:21},rules.BASES.A],.29);await act(carrier,{type:'bank_crown'});await wait(()=>latest(carrier,'challenge_state')?.challenge.status==='paid');
 const end=latest(carrier,'party_state').state;assert.equal(end.winner,'A');assert.equal(end.challenge.pot,280);assert.ok(end.highlights.clip.frames.length>1);assert.ok(end.highlights.awards.some(a=>a.title==='BEST TEAMMATE'&&a.id===clients[2].id));
 for(let i=0;i<4;i++)assert.equal((await api('profile',tokens[i])).state.points,i%2===0?370:230);
 send(carrier,{type:'party_action',action:{type:'bank_crown'}});await pause(200);assert.equal((await api('profile',tokens[0])).state.points,370,'replayed finish cannot repeat the pool payout');assert.equal((await api('leaderboard?mode=solo')).players.length,0);assert.equal((await api('leaderboard?mode=team')).players.length,2);
 console.log('PASS: real 2v2 crown room, owner entry, private clues, Jelly activation, signals, teleport rejection, physical crown route, cursed bag delivery and protection, reconnect, complete pool settlement once, earned highlights and separate rankings.');
}catch(e){console.error(e);console.error(clients.map(c=>({id:c.id,pos:c.pos,note:latest(c,'party_note'),reset:latest(c,'party_reset'),state:latest(c,'party_state')?.state.challenge})));result=1;}finally{for(const c of clients)c.ws.close(1000,'Test complete');await Promise.race([mf.dispose(),pause(1000)]);}process.exit(result);
