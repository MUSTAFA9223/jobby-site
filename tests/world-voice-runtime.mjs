// Integration smoke test against Cloudflare's actual workerd runtime (synthetic audio).
import assert from "node:assert/strict";
import {Miniflare,convertV4MiniflareOptions} from "miniflare";
import * as house from "../public/world/house-layout.js";
import {clientFrame,readFrame,VOICE_SAMPLES} from "../public/world/voice-protocol.js";
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:process.argv[2]||".build/world/worker.js",compatibilityDate:"2026-10-01",durableObjects:{WORLD_ROOM:{className:"WorldRoom",useSQLite:true}}}));
const base="https://jobby.test",clients=[],pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(fn){for(let i=0;i<120;i++){if(fn())return;await pause(25);}throw Error("WebSocket message timed out");}
const send=(client,data)=>client.ws.send(typeof data==="object"&&!(data instanceof ArrayBuffer)?JSON.stringify(data):data);
const audio=client=>client.messages.filter(m=>m instanceof ArrayBuffer);
let result=0;
try{
 const health=await(await mf.dispatchFetch(base+"/api/world/health")).json();assert.equal(health.version,"0.12");
 const response=await mf.dispatchFetch(base+"/api/world/rooms",{method:"POST",headers:{origin:base,"content-type":"application/json"},body:JSON.stringify({token:"voice-runtime-player-0-secret",map:house.MAP_ID})});
 assert.equal(response.status,201);const {code}=await response.json();
 for(let i=0;i<12;i++){
  const response=await mf.dispatchFetch(`${base}/api/world/rooms/${code}/socket?token=voice-runtime-player-${i}-secret&avatar=JOBBY`,{headers:{upgrade:"websocket",origin:base}});
  assert.equal(response.status,101);const c={ws:response.webSocket,messages:[]};c.ws.accept();c.ws.addEventListener("message",e=>c.messages.push(typeof e.data==="string"?JSON.parse(e.data):e.data));clients.push(c);
  await wait(()=>c.messages.some(m=>m.type==="welcome"));
 }
 const full=await mf.dispatchFetch(`${base}/api/world/rooms/${code}/socket?token=thirteenth-player-private-token&avatar=JOBBY`,{headers:{upgrade:"websocket",origin:base}});
 assert.equal(full.status,409,"the thirteenth connection is refused");
 assert.equal(clients[11].messages.find(m=>m.type==="welcome").maxPlayers,12);
 const frame=clientFrame(new Int16Array(VOICE_SAMPLES).fill(4096),7);
 send(clients[0],frame);await pause(100);assert.equal(audio(clients[1]).length,0);
 for(const c of clients)send(c,{type:"voice",joined:true,muted:false});
 await wait(()=>clients.every(c=>c.messages.filter(m=>m.type==="voice_state").length===12));
 send(clients[0],frame);await wait(()=>clients.slice(1).every(c=>audio(c).length===1));
 const id=clients[0].messages.find(m=>m.type==="welcome").selfId;
 for(const c of clients.slice(1)){const packet=readFrame(audio(c)[0]);assert.equal(packet.id,id);assert.equal(packet.samples[0],.125);}
 assert.equal(audio(clients[0]).length,0,"no feedback to sender");
 send(clients[0],{type:"voice",joined:true,muted:true});await wait(()=>clients[1].messages.some(m=>m.type==="voice_state"&&m.id===id&&m.muted));
 send(clients[0],frame);await pause(100);assert.equal(audio(clients[1]).length,1,"server enforces mute");
 send(clients[0],{type:"start"});await wait(()=>clients.every(c=>c.messages.some(m=>m.type==="start")));
 send(clients[0],{type:"pose",x:2,z:18,y:0,h:0,anim:"Walk"});await wait(()=>clients[1].messages.some(m=>m.type==="pose"&&m.x===2));
 await pause(150);send(clients[0],{type:"pose",x:2,z:18,y:0,h:0,anim:"Walk"});await wait(()=>clients.every(c=>c.messages.some(m=>m.type==="guard")));
 for(const [index,task] of house.TASKS.entries()){
  await pause(100);send(clients[0],{type:"pose",x:task.x,z:task.z,y:0,h:0,anim:"Idle"});
  send(clients[0],{type:"task_start",index});await pause(house.TASK_MS+80);send(clients[0],{type:"task_finish",index});
  await wait(()=>clients.every(c=>c.messages.some(m=>m.type==="house_tasks"&&m.tasks.includes(index))));
 }
 send(clients[0],{type:"pose",x:house.EXITS[0].x,z:house.EXITS[0].z,y:0,h:0,anim:"Idle"});send(clients[0],{type:"finish"});
 await wait(()=>clients.every(c=>c.messages.some(m=>m.type==="complete"&&m.exit===house.EXITS[0].name)));
 console.log("PASS: workerd, twelve real WebSockets, opt-in audio relay, authenticated sender, exact received PCM, no self echo, server-side mute and gameplay messages coexist; shared house guard, three held tasks and squad escape passed.");
}catch(error){console.error(error);result=1;}
finally{for(const c of clients)c.ws.close(1000,"Test complete");await Promise.race([mf.dispose(),pause(1000)]);}
process.exit(result);
