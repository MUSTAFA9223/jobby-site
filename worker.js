import * as castle from "./castle-room.js";
import * as race from "./race-room.js";
import * as warehouse from "./warehouse-room.js";
import {playerApi} from "./player-store.js";
export {WorldPlayers} from "./player-store.js";
import { DurableObject } from "cloudflare:workers";
import { relayFrame } from "./public/world/voice-protocol.js";
import * as house from "./public/world/house-layout.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
const AVATARS = new Set(["JOBBY","Casual_Male","Ninja_Male","Pug","Wizard","Pirate_Female"]);
const KEYS = [[-20,-16],[19,14],[12,-20]];
const MAX_PLAYERS = 12;
const TTL = 24*60*60*1000;
// Public IDs are derived from private browser secrets. Never broadcast the secret itself.
async function publicPlayerId(secret){
  if(typeof secret!=="string" || !/^[a-zA-Z0-9_-]{12,64}$/.test(secret))return null;
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("JOBBY-WORLD:SESSION:"+secret));
  return [...new Uint8Array(digest).slice(0,16)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
const json = (data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}
});
function roomCode(){
  const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>ALPHABET[b%ALPHABET.length]).join("");
}
function roomStub(env,code){
  return env.WORLD_ROOM.get(env.WORLD_ROOM.idFromName("JOBBY-WORLD:"+code));
}

export default {
  async fetch(request,env){
    const url=new URL(request.url),path=url.pathname;
    // Keep 3D assets and the WebSocket API on the same public domain.
    if(path==="/world/models/JOBBY.glb"){
      if(request.method!=="GET" && request.method!=="HEAD")return json({error:"Method not allowed."},405);
      const response=await fetch("https://raw.githubusercontent.com/MUSTAFA9223/JOBBY-3D-Viewer/main/models/JOBBY.glb",{
        cf:{cacheEverything:true,cacheTtl:86400}
      });
      if(!response.ok)return new Response("JOBBY model unavailable.",{status:502});
      return new Response(request.method==="HEAD"?null:response.body,{
        status:200,
        headers:{"content-type":"model/gltf-binary","cache-control":"public, max-age=3600",
        "x-content-type-options":"nosniff"}
      });
    }
    if(path==="/api/world/leaderboard"||path.startsWith("/api/world/profile"))return playerApi(request,env);
    if(path==="/api/world/health")return json({ok:!!env.WORLD_ROOM,service:"JOBBY WORLD Co-op",version:"0.16",playerSaves:!!env.WORLD_PLAYERS,map:house.MAP_ID,voice:"room-audio",warehouse:warehouse.MAP_ID,race:race.MAP_ID,castle:castle.MAP_ID},env.WORLD_ROOM?200:503);
    if(!path.startsWith("/api/world/"))return env.ASSETS.fetch(request);
    if(!env.WORLD_ROOM)return json({error:"Room service is not configured."},503);
    if(request.method==="POST" && path==="/api/world/rooms"){
      if(request.headers.get("origin")!==url.origin)return json({error:"Same-origin requests only."},403);
      if(!(request.headers.get("content-type")||"").includes("application/json"))return json({error:"JSON required."},415);
      let data;try{data=await request.json()}catch{return json({error:"Invalid JSON."},400)}
      const ownerId=await publicPlayerId(data?.token);
      if(!ownerId)return json({error:"Invalid session."},400);
      for(let attempt=0;attempt<5;attempt++){
        const code=roomCode(),stub=roomStub(env,code);
        const response=await stub.fetch("https://room.internal/_create",{method:"POST",body:JSON.stringify({code,ownerId,map:[house.MAP_ID,warehouse.MAP_ID,race.MAP_ID,castle.MAP_ID].includes(data.map)?data.map:"classic"})});
        if(response.status===201)return json({code,maxPlayers:MAX_PLAYERS},201);
      }
      return json({error:"Could not create a unique room. Retry."},503);
    }
    const match=path.match(/^\/api\/world\/rooms\/([A-Z0-9]{6})(?:\/(socket))?$/);
    if(!match || !ROOM_PATTERN.test(match[1]))return json({error:"Room not found."},404);
    const code=match[1],stub=roomStub(env,code);
    if(request.method==="GET" && match[2]==="socket"){
      if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return json({error:"WebSocket upgrade required."},426);
      const origin=request.headers.get("origin");
      if(origin && origin!==url.origin)return json({error:"Origin not allowed."},403);
      const internal=new URL("https://room.internal/_socket");
      for(const key of ["token","name","avatar"])internal.searchParams.set(key,url.searchParams.get(key)||"");
      return stub.fetch(new Request(internal,{headers:request.headers}));
    }
    if(request.method==="GET" && !match[2])return stub.fetch("https://room.internal/_status");
    return json({error:"Method not allowed."},405);
  }
};

export class WorldRoom extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);
    this.playerStore=env.WORLD_PLAYERS?.get(env.WORLD_PLAYERS.idFromName("players-v1"));
  }
  sockets(){
    return this.ctx.getWebSockets().filter(ws=>ws.readyState===1);
  }
  players(){
    return this.sockets().map(ws=>{
      const a=ws.deserializeAttachment()||{};
      return {id:a.id,name:a.name,avatar:a.avatar,x:a.x??0,z:a.z??18,y:a.y??0,h:a.h??0,anim:a.anim||"Idle",voice:a.voice===true,muted:a.muted!==false,hidden:a.hidden===true};
    });
  }
  broadcast(message,exclude=null){
    const data=JSON.stringify(message);
    for(const ws of this.sockets())if(ws!==exclude){try{ws.send(data)}catch{}}
  }
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==="/_create" && request.method==="POST"){
      let data;try{data=await request.json()}catch{return json({error:"Invalid body."},400)}
      const existing=await this.ctx.storage.get("room");
      if(existing && Date.now()-existing.createdAt<TTL)return json({error:"Code collision."},409);
      const room={code:data.code,hostId:data.ownerId,createdAt:Date.now(),status:"lobby",keys:[],...(data.map===house.MAP_ID?{map:house.MAP_ID,tasks:[]}:data.map===warehouse.MAP_ID?{map:warehouse.MAP_ID,warehouse:warehouse.newState(Date.now())}:data.map===race.MAP_ID?{map:race.MAP_ID,race:race.newState()}:data.map===castle.MAP_ID?{map:castle.MAP_ID,castle:castle.newState(Date.now())}: {})};
      await this.ctx.storage.put("room",room);
      return json({ok:true},201);
    }
    const room=await this.ctx.storage.get("room");
    if(!room || Date.now()-room.createdAt>TTL)return json({error:"Room expired or not found."},404);
    if(room.map===castle.MAP_ID&&room.status==="finished")await castle.retryRewards(this,room);
    if(room.map===warehouse.MAP_ID&&room.status==="finished")await warehouse.retryRewards(this,room);
    if(room.map===race.MAP_ID){if(room.status==="playing"&&Date.now()>room.race.deadline)room.status="finished";if(room.status==="finished")await race.retryRewards(this,room);}
    if(url.pathname==="/_status")return json({code:room.code,status:room.status,players:this.players(),maxPlayers:MAX_PLAYERS,map:room.map||"classic"});
    if(url.pathname!=="/_socket")return json({error:"Not found."},404);
    if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return json({error:"Upgrade required."},426);
    const id=await publicPlayerId(url.searchParams.get("token"));
    const name=(url.searchParams.get("name")||"Player").trim().slice(0,18).replace(/[<>\x00-\x1f]/g,"")||"Player";
    const avatar=url.searchParams.get("avatar")||"JOBBY";
    if(!id || !AVATARS.has(avatar))return json({error:"Invalid player."},400);
    const current=this.sockets();
    // Reconnecting in the same tab supersedes the old socket.
    const replacing=current.find(ws=>ws.deserializeAttachment()?.id===id);
    if(!replacing && current.length>=MAX_PLAYERS)return json({error:"Room is full (12 players)."},409);
    if(replacing)try{replacing.close(4001,"Reconnected from another tab")}catch{}
    const pair=new WebSocketPair(),[client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const slot=Math.max(0,current.length%MAX_PLAYERS);
    const info={id,name,avatar,x:(slot%4-1.5)*1.5,z:18+Math.floor(slot/4)*1.5,y:0,h:0,anim:"Idle",last:0,hidden:false,safeUntil:Date.now()+8000,voice:false,muted:true,expiresAt:room.createdAt+TTL};
    if(room.map===race.MAP_ID){race.join(room,info);await this.ctx.storage.put("room",room);}
    server.serializeAttachment(info);
    if(!this.sockets().some(ws=>ws!==server && ws.deserializeAttachment()?.id===room.hostId)){
      room.hostId=id;await this.ctx.storage.put("room",room);
    }
    server.send(JSON.stringify({type:"welcome",code:room.code,selfId:id,hostId:room.hostId,status:room.status,keys:room.keys,players:this.players(),maxPlayers:MAX_PLAYERS,map:room.map||"classic",tasks:room.tasks||[],guard:house.guardView(this.houseGuard||house.newGuard()),...(room.map===warehouse.MAP_ID?{warehouse:warehouse.view(room)}:room.map===race.MAP_ID?{race:race.view(room)}:room.map===castle.MAP_ID?{castle:castle.view(room)}:{})}));
    this.broadcast({type:"roster",hostId:room.hostId,players:this.players()});
    return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(ws,message){
    const a=ws.deserializeAttachment();if(!a||ws.readyState!==1)return;
    if(message instanceof ArrayBuffer){
      if(!a.voice||a.muted||Date.now()>(a.expiresAt||0))return;
      const data=relayFrame(message,a.id);if(!data)return;
      const now=Date.now();
      if(!a.audioWindow||now-a.audioWindow>=1000){a.audioWindow=now;a.audioCount=0;}
      if((a.audioCount||0)>=18)return;
      a.audioCount=(a.audioCount||0)+1;ws.serializeAttachment(a);
      // Relay only within this room and only to people who explicitly joined voice.
      // Sender identity comes from the authenticated socket, never the audio payload.
      for(const target of this.sockets()){
        if(target===ws||!target.deserializeAttachment()?.voice||(target.bufferedAmount||0)>65536)continue;
        try{target.send(data)}catch{}
      }
      return;
    }
    if(typeof message!=="string" || message.length>600)return;
    let m;try{m=JSON.parse(message)}catch{return}
    if(!m || typeof m!=="object")return;
    if(m.type==="voice"){
      if(typeof m.joined!=="boolean"||typeof m.muted!=="boolean"||Date.now()>(a.expiresAt||0))return;
      a.voice=m.joined;a.muted=!m.joined||m.muted;ws.serializeAttachment(a);
      this.broadcast({type:"voice_state",id:a.id,joined:a.voice,muted:a.muted});return;
    }
    const raceRoom=await this.ctx.storage.get("room");
    if(raceRoom?.map===race.MAP_ID&&m.type!=="start"){
      // External profile reward calls yield the input gate. Serialize race updates
      // so another racer's pose cannot overwrite an in-flight finish or rank.
      this.raceQueue=(this.raceQueue||Promise.resolve()).catch(()=>{}).then(async()=>{
        const fresh=await this.ctx.storage.get("room"),current=ws.deserializeAttachment();
        if(fresh&&current&&ws.readyState===1)await race.handle(this,ws,current,m,fresh);
      });await this.raceQueue;return;
    }
    if(raceRoom?.map===castle.MAP_ID){
      this.castleQueue=(this.castleQueue||Promise.resolve()).catch(()=>{}).then(()=>castle.message(this,ws,m));
      await this.castleQueue;return;
    }
    if(m.type==="pose"){
      const nums=[m.x,m.z,m.y,m.h];
      if(nums.some(n=>typeof n!=="number"||!Number.isFinite(n)))return;
      const now=Date.now();
      if(now-a.last<65)return;
      a.last=now;
      if(!a.hidden&&now>=(a.respawnUntil||0)){a.x=Math.max(-26.2,Math.min(26.2,m.x));a.z=Math.max(-26.2,Math.min(26.2,m.z));}
      a.y=Math.max(0,Math.min(3,m.y));a.h=m.h%(Math.PI*2);
      if(a.hold&&(a.y>.35||Math.hypot(a.x-a.hold.x,a.z-a.hold.z)>.6))a.hold=null;
      if(Math.hypot(a.x,a.z-19)>4)a.active=true;
      a.anim=["Idle","Walk","Run","Jump"].includes(m.anim)?m.anim:"Idle";
      ws.serializeAttachment(a);
      this.broadcast({type:"pose",id:a.id,x:a.x,z:a.z,y:a.y,h:a.h,anim:a.anim,hidden:a.hidden===true},ws);
      await this.tickHouse();return;
    }
    const room=await this.ctx.storage.get("room");
    if(!room)return;
    if(m.type==="start" && room.hostId===a.id && room.status!=="playing"){
      if(this.sockets().length<2){ws.send(JSON.stringify({type:"error",message:"At least 2 players are required."}));return}
      room.status="playing";room.keys=[];if(room.map===race.MAP_ID)await race.start(this,room);if(room.map===warehouse.MAP_ID)await warehouse.start(this,room);if(room.map===castle.MAP_ID)await castle.start(this,room);if(room.map===house.MAP_ID){room.tasks=[];this.houseGuard=house.newGuard();this.guardAt=Date.now();for(const peer of this.sockets()){const p=peer.deserializeAttachment();p.hidden=false;p.safeUntil=Date.now()+8000;peer.serializeAttachment(p);}}await this.ctx.storage.put("room",room);
      this.broadcast({type:"start",keys:[],tasks:[],...(room.map===warehouse.MAP_ID?{warehouse:warehouse.view(room)}:room.map===race.MAP_ID?{race:race.view(room)}:room.map===castle.MAP_ID?{castle:castle.view(room)}:{})});
      return;
    }
    if(room.map===castle.MAP_ID){await castle.handle(this,ws,a,m,room);return;}
    if(room.map===warehouse.MAP_ID){await warehouse.handle(this,ws,a,m,room);return;}
    if(room.map===house.MAP_ID&&room.status==="playing"){
      if(m.type==="hide"){
        if(typeof m.hidden!=="boolean"||m.hidden===!!a.hidden)return;
        if(m.hidden&&(house.hideAt(a)<0||a.y>.2))return;
        a.hidden=m.hidden;a.taskIndex=null;a.taskStarted=0;
        if(!a.hidden)a.safeUntil=Date.now()+900;
        ws.serializeAttachment(a);this.broadcast({type:"hide",id:a.id,hidden:a.hidden});return;
      }
      if(m.type==="task_cancel"){a.taskIndex=null;a.taskStarted=0;ws.serializeAttachment(a);return;}
      if(m.type==="task_start"||m.type==="task_finish"){
        const index=m.index,task=house.TASKS[index];
        if(!Number.isInteger(index)||!task||a.hidden||a.y>.3||!house.near(a,task)||room.tasks.includes(index))return;
        if(m.type==="task_start"){a.taskIndex=index;a.taskStarted=Date.now();ws.serializeAttachment(a);return;}
        if(a.taskIndex!==index||Date.now()-a.taskStarted<house.TASK_MS-100)return;
        room.tasks.push(index);a.taskIndex=null;a.taskStarted=0;ws.serializeAttachment(a);await this.ctx.storage.put("room",room);
        this.broadcast({type:"house_tasks",tasks:room.tasks,by:a.id});return;
      }
      if(m.type==="finish"){
        const exit=house.exitAt(a,room.tasks);if(exit<0||a.hidden)return;
        room.status="finished";await this.ctx.storage.put("room",room);this.broadcast({type:"complete",by:a.id,exit:house.EXITS[exit].name});return;
      }
      return;
    }
    if(m.type==="key" && room.status==="playing"){
      const index=Number(m.index);
      if(!Number.isInteger(index)||index<0||index>=KEYS.length||room.keys.includes(index))return;
      const [x,z]=KEYS[index];
      if(Math.hypot(a.x-x,a.z-z)>1.8)return;
      room.keys.push(index);await this.ctx.storage.put("room",room);
      this.broadcast({type:"key",index,by:a.id,keys:room.keys});
      if(room.keys.length===3)this.broadcast({type:"gate_open"});
      return;
    }
    if(m.type==="finish" && room.status==="playing" && room.keys.length===3){
      if(Math.hypot(a.x,a.z+26.9)>4.2)return;
      room.status="finished";await this.ctx.storage.put("room",room);
      this.broadcast({type:"complete",by:a.id});
    }
  }
  async tickHouse(){
    const now=Date.now();if(now-(this.guardAt||0)<125)return;
    const last=this.guardAt||now;this.guardAt=now;
    const room=await this.ctx.storage.get("room");if(room?.map===castle.MAP_ID){await castle.tick(this,room,now,last);return;}if(room?.map===warehouse.MAP_ID){await warehouse.tick(this,room,now,last);return;}if(room?.map!==house.MAP_ID||room.status!=="playing")return;
    this.houseGuard??=house.newGuard();
    const peers=this.sockets(),players=peers.map(ws=>ws.deserializeAttachment());
    const caught=house.advanceGuard(this.houseGuard,players,(now-last)/1000,now);
    for(const peer of peers){
      const p=peer.deserializeAttachment();if(!caught.includes(p.id))continue;
      p.x=house.SPAWN.x;p.z=house.SPAWN.z;p.y=0;p.hidden=false;p.taskIndex=null;p.taskStarted=0;p.safeUntil=now+6000;p.respawnUntil=now+500;
      peer.serializeAttachment(p);this.broadcast({type:"caught",id:p.id,x:p.x,z:p.z});
    }
    this.broadcast({type:"guard",guard:house.guardView(this.houseGuard)});
  }
  async drop(ws){
    const a=ws.deserializeAttachment();
    const room=await this.ctx.storage.get("room");if(!room)return;
    if(a?.id&&!this.players().some(p=>p.id===a.id)){await warehouse.drop(this,room,a.id);await castle.drop(this,room,a.id);}
    const rest=this.players();
    if(a?.id===room.hostId && !rest.some(p=>p.id===room.hostId)){room.hostId=rest[0]?.id||"";await this.ctx.storage.put("room",room)}
    this.broadcast({type:"roster",hostId:room.hostId,players:rest});
  }
  async webSocketClose(ws){await this.drop(ws)}
  async webSocketError(ws){try{ws.close(1011,"Connection error")}catch{}await this.drop(ws)}
}
