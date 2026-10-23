import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";

const code=readFileSync(new URL("../worker.js",import.meta.url),"utf8")
 .replace(/^import \{ DurableObject \} from "cloudflare:workers";/m,"")
 .replace(/^export default/m,"const api =")
 .replace(/^export class WorldRoom/m,"class WorldRoom");
class MockResponse {
 constructor(body,options={}){this.body=body;this.status=options.status||200;this.webSocket=options.webSocket}
 async json(){return JSON.parse(this.body)}
}
const socketPairs=[];
class Socket {
 constructor(){this.readyState=1;this.messages=[];this.attachment=null}
 send(message){this.messages.push(JSON.parse(message))}
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
const compile=new Function("DurableObject","Response","WebSocketPair","crypto","TextEncoder","structuredClone","URL",code+"\nreturn {WorldRoom,publicPlayerId};");
const {WorldRoom,publicPlayerId}=compile(Base,MockResponse,WebSocketPairMock,webcrypto,TextEncoder,structuredClone,URL);
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
const hostSecret="host-session-random-secret-12345";
const guestSecret="guest-session-random-secret-1234";

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
