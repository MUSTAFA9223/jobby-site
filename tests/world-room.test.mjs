import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import * as house from "../public/world/house-layout.js";
import {clientFrame,relayFrame,readFrame,VOICE_SAMPLES} from "../public/world/voice-protocol.js";

const code=readFileSync(new URL("../worker.js",import.meta.url),"utf8")
 .replace(/^import \{playerApi\}.*\n/m, "").replace(/^export \{WorldPlayers\}.*\n/m, "").replace(/^import \{ DurableObject \} from "cloudflare:workers";/m,"")
 .replace(/^import \{ relayFrame \} from .*;$/m,"")
 .replace(/^import \* as house from .*;$/m,"")
 .replace(/^export default/m,"const api =")
 .replace(/^export class WorldRoom/m,"class WorldRoom");
class MockResponse {
 constructor(body,options={}){this.body=body;this.status=options.status||200;this.webSocket=options.webSocket}
 async json(){return JSON.parse(this.body)}
}
const socketPairs=[];
class Socket {
 constructor(){this.readyState=1;this.messages=[];this.attachment=null}
 send(message){this.messages.push(typeof message==="string"?JSON.parse(message):message.slice(0))}
 close(){this.readyState=3}
 deserializeAttachment(){return this.attachment}
 serializeAttachment(obj){this.attachment=structuredClone(obj)}
}
class WebSocketPairMock {
 constructor(){this[0]=new Socket();this[1]=new Socket();socketPairs.push(this)}
}
class Base {
 constructor(ctx){this.ctx=ctx}
}
const compile=new Function("DurableObject","Response","WebSocketPair","crypto","TextEncoder","structuredClone","URL","relayFrame","house",code+"\nreturn {WorldRoom,publicPlayerId};");
const {WorldRoom,publicPlayerId}=compile(Base,MockResponse,WebSocketPairMock,webcrypto,TextEncoder,structuredClone,URL,relayFrame,house);
const storage=new Map(),sockets=[];
const ctx={
 storage:{get:async key=>storage.get(key),put:async(key,value)=>storage.set(key,structuredClone(value))},
 getWebSockets:()=>sockets,
 acceptWebSocket:ws=>sockets.push(ws)
};
const r=new WorldRoom(ctx,{});
const req=(path,method="GET",body=null,upgrade=false)=>({
 url:"https://room.internal"+path,
 method,
 headers:{get:key=>key.toLowerCase()==="upgrade"&&upgrade?"websocket":null},
 json:async()=>JSON.parse(body||"null")
});

test("Room voice requires opt-in, enforces mute, isolates rooms and authenticates sender",async()=>{
 const makeRoom=async()=>{
  const data=new Map(),peers=[];
  const room=new WorldRoom({storage:{get:async k=>data.get(k),put:async(k,v)=>data.set(k,structuredClone(v))},getWebSockets:()=>peers,acceptWebSocket:ws=>peers.push(ws)},{});
  await room.fetch(req("/_create","POST",JSON.stringify({code:"DEF234",ownerId:await publicPlayerId(hostSecret)})));
  for(const token of [hostSecret,guestSecret,"third-player-random-secret-1234"])await room.fetch(req("/_socket?token="+token+"&avatar=JOBBY","GET",null,true));
  return {room,peers,data};
 };
 const {room,peers,data}=await makeRoom(),other=await makeRoom();
 const [host,guest,bystander]=peers;
 const frame=clientFrame(new Int16Array(VOICE_SAMPLES).fill(500),42);
 const audioCount=ws=>ws.messages.filter(m=>m instanceof ArrayBuffer).length;
 await room.webSocketMessage(host,frame);assert.equal(audioCount(guest),0,"mic off by default");
 const voice=(ws,joined,muted)=>room.webSocketMessage(ws,JSON.stringify({type:"voice",joined,muted,id:"spoofed"}));
 await voice(host,true,false);await voice(guest,true,true);
 await room.webSocketMessage(host,frame);
 assert.equal(audioCount(host),0,"no self echo");assert.equal(audioCount(guest),1,"muted receiver can still hear");
 assert.equal(audioCount(bystander),0,"nonparticipants do not receive audio");
 assert.equal(audioCount(other.peers[1]),0,"audio never crosses room instances");
 const received=readFrame(guest.messages.find(m=>m instanceof ArrayBuffer));
 assert.equal(received.id,await publicPlayerId(hostSecret));assert.equal(received.sequence,42);
 assert.ok(guest.messages.some(m=>m.type==="voice_state"&&m.id===received.id),"identity derived from socket");
 await voice(host,true,true);await room.webSocketMessage(host,frame);assert.equal(audioCount(guest),1,"muted sender cannot transmit");
 await voice(host,true,false);await voice(guest,false,false);await room.webSocketMessage(host,frame);assert.equal(audioCount(guest),1,"leaving stops receipt");
 await voice(guest,true,false);
 for(const value of [new ArrayBuffer(40000),new ArrayBuffer(12),new Uint8Array(frame.byteLength).buffer])await room.webSocketMessage(host,value);
 assert.equal(audioCount(guest),1,"oversized, truncated and unknown protocol frames rejected");
 let info=host.deserializeAttachment();info.audioWindow=Date.now();info.audioCount=18;host.serializeAttachment(info);
 await room.webSocketMessage(host,frame);assert.equal(audioCount(guest),1,"audio flood is bounded");
 info=host.deserializeAttachment();info.audioWindow=0;info.expiresAt=Date.now()-1;host.serializeAttachment(info);
 await room.webSocketMessage(host,frame);assert.equal(audioCount(guest),1,"expired room cannot relay audio");
 assert.deepEqual(Object.keys(await data.get("room")).sort(),["code","createdAt","hostId","keys","status"],"audio is not stored in room storage");
});
const hostSecret="host-session-random-secret-12345";
const guestSecret="guest-session-random-secret-1234";

test("House rooms enforce task distance/hold/cancel, independent exits, shared hiding and chef catches",async()=>{
 for(const index of [0,1,2]){
  const data=new Map(),peers=[];
  const room=new WorldRoom({storage:{get:async k=>data.get(k),put:async(k,v)=>data.set(k,structuredClone(v))},getWebSockets:()=>peers,acceptWebSocket:ws=>peers.push(ws)},{});
  await room.fetch(req("/_create","POST",JSON.stringify({code:"GHJ234",ownerId:await publicPlayerId(hostSecret),map:house.MAP_ID})));
  for(const token of [hostSecret,guestSecret])await room.fetch(req("/_socket?token="+token,"GET",null,true));
  const [host,guest]=peers,send=(socket,m)=>room.webSocketMessage(socket,JSON.stringify(m));
  const place=(socket,p)=>socket.serializeAttachment({...socket.deserializeAttachment(),...p});
  assert.equal(host.messages.find(m=>m.type==="welcome").map,house.MAP_ID);
  await send(host,{type:"start"});
  await send(host,{type:"task_start",index});await send(host,{type:"task_finish",index});
  assert.deepEqual(data.get("room").tasks,[],"remote task claims are rejected");
  place(host,house.TASKS[index]);await send(host,{type:"task_start",index});await send(host,{type:"task_finish",index});
  assert.deepEqual(data.get("room").tasks,[],"instant completion is rejected");
  await send(host,{type:"task_cancel"});await send(host,{type:"task_finish",index});assert.deepEqual(data.get("room").tasks,[]);
  await send(host,{type:"task_start",index});place(host,{taskStarted:Date.now()-house.TASK_MS});
  await send(host,{type:"task_finish",index});assert.deepEqual(data.get("room").tasks,[index]);
  assert.ok(guest.messages.some(m=>m.type==="house_tasks"&&m.tasks.includes(index)));
  place(guest,house.HIDES[0]);await send(guest,{type:"hide",hidden:true});assert.equal(guest.deserializeAttachment().hidden,true);
  assert.ok(host.messages.some(m=>m.type==="hide"&&m.hidden));
  await send(guest,{type:"pose",x:0,z:18,y:0,h:0});assert.equal(guest.deserializeAttachment().x,house.HIDES[0].x,"hidden players stay put");
  await send(guest,{type:"hide",hidden:false});
  place(guest,{x:0,z:-15,safeUntil:0,last:0});room.houseGuard=house.newGuard();room.houseGuard.z=-15.5;room.guardAt=Date.now()-200;
  await send(guest,{type:"pose",x:0,z:-15,y:0,h:0});
  assert.ok(guest.messages.some(m=>m.type==="caught"));assert.equal(guest.deserializeAttachment().z,house.SPAWN.z);
  assert.deepEqual(data.get("room").tasks,[index],"catch preserves team progress");
  place(host,house.EXITS[(index+1)%3]);await send(host,{type:"finish"});assert.equal(data.get("room").status,"playing","wrong exit stays locked");
  place(host,house.EXITS[index]);await send(host,{type:"finish"});assert.equal(data.get("room").status,"finished");
  assert.ok(guest.messages.some(m=>m.type==="complete"&&m.exit===house.EXITS[index].name));
 }
});

test("Private co-op room lifecycle and identity security",async()=>{
 let response=await r.fetch(req("/_status"));
 assert.equal(response.status,404);
 const hostPublic=await publicPlayerId(hostSecret),guestPublic=await publicPlayerId(guestSecret);
 assert.notEqual(hostPublic,guestPublic);
 response=await r.fetch(req("/_create","POST",JSON.stringify({code:"ABC234",ownerId:hostPublic})));
 assert.equal(response.status,201);
 response=await r.fetch(req("/_create","POST",JSON.stringify({code:"ABC234",ownerId:guestPublic})));
 assert.equal(response.status,409);

 response=await r.fetch(req("/_socket?token="+hostSecret+"&avatar=JOBBY","GET",null,true));
 assert.equal(response.status,101);
 const host=sockets[0];
 assert.equal(host.deserializeAttachment().id,hostPublic);
 response=await r.fetch(req("/_socket?token="+guestSecret+"&avatar=Ninja_Male","GET",null,true));
 assert.equal(response.status,101);
 const guest=sockets[1];
 assert.equal(guest.deserializeAttachment().id,guestPublic);
 await r.webSocketMessage(guest,JSON.stringify({type:"start"}));
 assert.equal((await ctx.storage.get("room")).status,"lobby","guest cannot start");

 // A visible public player ID is not the original secret.
 response=await r.fetch(req("/_socket?token="+hostPublic+"&avatar=JOBBY","GET",null,true));
 assert.equal(response.status,101);
 assert.equal(host.readyState,1);
 assert.notEqual(sockets[2].deserializeAttachment().id,hostPublic);
 response=await r.fetch(req("/_socket?token="+hostSecret+"&avatar=JOBBY","GET",null,true));
 assert.equal(response.status,101);
 assert.equal(host.readyState,3,"the rightful owner can reconnect");
 const reconnectedHost=sockets[3];
 await r.webSocketMessage(reconnectedHost,JSON.stringify({type:"start"}));
 assert.equal((await ctx.storage.get("room")).status,"playing");

 for(const [index,position] of [[-20,-16],[19,14],[12,-20]].entries()){
   const a=reconnectedHost.deserializeAttachment();
   a.x=position[0];a.z=position[1];reconnectedHost.serializeAttachment(a);
   await r.webSocketMessage(reconnectedHost,JSON.stringify({type:"key",index}));
 }
 assert.equal((await ctx.storage.get("room")).keys.length,3);
 await r.webSocketMessage(reconnectedHost,JSON.stringify({type:"key",index:0}));
 assert.equal((await ctx.storage.get("room")).keys.length,3,"duplicate key ignored");
 const a=reconnectedHost.deserializeAttachment();a.x=0;a.z=-26.5;reconnectedHost.serializeAttachment(a);
 await r.webSocketMessage(reconnectedHost,JSON.stringify({type:"finish"}));
 assert.equal((await ctx.storage.get("room")).status,"finished");
 assert.ok(guest.messages.some(item=>item.type==="complete"),"the entire squad receives completion");
});
