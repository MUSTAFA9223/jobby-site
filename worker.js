import { DurableObject } from "cloudflare:workers";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
const AVATARS = new Set(["JOBBY","Casual_Male","Ninja_Male","Pug","Wizard","Pirate_Female"]);
const KEYS = [[-20,-16],[19,14],[12,-20]];
const MAX_PLAYERS = 6;
const TTL = 24*60*60*1000;
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
    if(path==="/api/world/health")return json({ok:!!env.WORLD_ROOM,service:"JOBBY WORLD Co-op",version:"0.8"},env.WORLD_ROOM?200:503);
    if(!path.startsWith("/api/world/"))return env.ASSETS.fetch(request);
    if(!env.WORLD_ROOM)return json({error:"Room service is not configured."},503);
    if(request.method==="POST" && path==="/api/world/rooms"){
      if(request.headers.get("origin")!==url.origin)return json({error:"Same-origin requests only."},403);
      if(!(request.headers.get("content-type")||"").includes("application/json"))return json({error:"JSON required."},415);
      let data;try{data=await request.json()}catch{return json({error:"Invalid JSON."},400)}
      const ownerId=String(data?.id||"");
      if(!/^[a-zA-Z0-9_-]{12,64}$/.test(ownerId))return json({error:"Invalid session."},400);
      for(let attempt=0;attempt<5;attempt++){
        const code=roomCode(),stub=roomStub(env,code);
        const response=await stub.fetch("https://room.internal/_create",{method:"POST",body:JSON.stringify({code,ownerId})});
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
      for(const key of ["id","name","avatar"])internal.searchParams.set(key,url.searchParams.get(key)||"");
      return stub.fetch(new Request(internal,{headers:request.headers}));
    }
    if(request.method==="GET" && !match[2])return stub.fetch("https://room.internal/_status");
    return json({error:"Method not allowed."},405);
  }
};

export class WorldRoom extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);
  }
  sockets(){
    return this.ctx.getWebSockets().filter(ws=>ws.readyState===1);
  }
  players(){
    return this.sockets().map(ws=>{
      const a=ws.deserializeAttachment()||{};
      return {id:a.id,name:a.name,avatar:a.avatar,x:a.x??0,z:a.z??18,y:a.y??0,h:a.h??0,anim:a.anim||"Idle"};
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
      const room={code:data.code,hostId:data.ownerId,createdAt:Date.now(),status:"lobby",keys:[]};
      await this.ctx.storage.put("room",room);
      return json({ok:true},201);
    }
    const room=await this.ctx.storage.get("room");
    if(!room || Date.now()-room.createdAt>TTL)return json({error:"Room expired or not found."},404);
    if(url.pathname==="/_status")return json({code:room.code,status:room.status,players:this.players(),maxPlayers:MAX_PLAYERS});
    if(url.pathname!=="/_socket")return json({error:"Not found."},404);
    if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return json({error:"Upgrade required."},426);
    const id=url.searchParams.get("id")||"";
    const name=(url.searchParams.get("name")||"Player").trim().slice(0,18).replace(/[<>\x00-\x1f]/g,"")||"Player";
    const avatar=url.searchParams.get("avatar")||"JOBBY";
    if(!/^[a-zA-Z0-9_-]{12,64}$/.test(id) || !AVATARS.has(avatar))return json({error:"Invalid player."},400);
    const current=this.sockets();
    // Reconnecting in the same tab supersedes the old socket.
    const replacing=current.find(ws=>ws.deserializeAttachment()?.id===id);
    if(!replacing && current.length>=MAX_PLAYERS)return json({error:"Room is full (6 players)."},409);
    if(replacing)try{replacing.close(4001,"Reconnected from another tab")}catch{}
    const pair=new WebSocketPair(),[client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const slot=Math.max(0,current.length%6);
    const info={id,name,avatar,x:(slot%3-1)*1.5,z:18+Math.floor(slot/3)*1.5,y:0,h:0,anim:"Idle",last:0};
    server.serializeAttachment(info);
    if(!this.sockets().some(ws=>ws!==server && ws.deserializeAttachment()?.id===room.hostId)){
      room.hostId=id;await this.ctx.storage.put("room",room);
    }
    server.send(JSON.stringify({type:"welcome",code:room.code,selfId:id,hostId:room.hostId,status:room.status,keys:room.keys,players:this.players(),maxPlayers:MAX_PLAYERS}));
    this.broadcast({type:"roster",hostId:room.hostId,players:this.players()});
    return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(ws,message){
    if(typeof message!=="string" || message.length>600)return;
    const a=ws.deserializeAttachment();if(!a)return;
    let m;try{m=JSON.parse(message)}catch{return}
    if(!m || typeof m!=="object")return;
    if(m.type==="pose"){
      const nums=[m.x,m.z,m.y,m.h];
      if(nums.some(n=>typeof n!=="number"||!Number.isFinite(n)))return;
      const now=Date.now();
      if(now-a.last<65)return;
      a.last=now;
      a.x=Math.max(-26.2,Math.min(26.2,m.x));a.z=Math.max(-26.2,Math.min(26.2,m.z));
      a.y=Math.max(0,Math.min(3,m.y));a.h=m.h%(Math.PI*2);
      a.anim=["Idle","Walk","Run","Jump"].includes(m.anim)?m.anim:"Idle";
      ws.serializeAttachment(a);
      this.broadcast({type:"pose",id:a.id,x:a.x,z:a.z,y:a.y,h:a.h,anim:a.anim},ws);
      return;
    }
    const room=await this.ctx.storage.get("room");
    if(!room)return;
    if(m.type==="start" && room.hostId===a.id && room.status!=="playing"){
      if(this.sockets().length<2){ws.send(JSON.stringify({type:"error",message:"At least 2 players are required."}));return}
      room.status="playing";room.keys=[];await this.ctx.storage.put("room",room);
      this.broadcast({type:"start",keys:[]});
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
  async drop(ws){
    const a=ws.deserializeAttachment();
    const room=await this.ctx.storage.get("room");if(!room)return;
    const rest=this.players();
    if(a?.id===room.hostId && !rest.some(p=>p.id===room.hostId)){room.hostId=rest[0]?.id||"";await this.ctx.storage.put("room",room)}
    this.broadcast({type:"roster",hostId:room.hostId,players:rest});
  }
  async webSocketClose(ws){await this.drop(ws)}
  async webSocketError(ws){try{ws.close(1011,"Connection error")}catch{}await this.drop(ws)}
}
