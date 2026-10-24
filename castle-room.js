import * as map from "./public/world/castle-layout.js";
import * as rules from "./public/world/castle-rules.js";
export const MAP_ID=map.MAP_ID;
export const newState=now=>rules.newRound(crypto.getRandomValues(new Uint32Array(1))[0],now);
export const view=(room,now=Date.now())=>rules.viewRound(room.castle,now);
// Serialize all gameplay inputs in a room, including movement while a profile
// reward request is in flight. Voice remains on the separate low-latency relay.
export async function message(instance,ws,m){
 const room=await instance.ctx.storage.get("room"),p=ws.deserializeAttachment();
 if(!room||!p||ws.readyState!==1)return;
 if(m.type==="start"){
  if(room.hostId!==p.id||room.status==="playing")return;
  if(instance.sockets().length<2){ws.send(JSON.stringify({type:"error",message:"At least 2 players are required."}));return;}
  room.status="playing";room.keys=[];await start(instance,room);await instance.ctx.storage.put("room",room);
  instance.broadcast({type:"start",keys:[],tasks:[],castle:view(room)});return;
 }
 if(m.type==="pose"){
  if([m.x,m.z,m.y,m.h].some(n=>typeof n!=="number"||!Number.isFinite(n)))return;
  const now=Date.now();if(now-p.last<65)return;p.last=now;
  if(room.status==="playing"&&!p.hidden&&now>=(p.respawnUntil||0)&&!rules.isBlocked(room.castle,m.x,m.z,now,.3)){p.x=m.x;p.z=m.z;}
  p.y=Math.max(0,Math.min(3,m.y));p.h=m.h%(Math.PI*2);
  if(p.hold&&(p.y>.35||Math.hypot(p.x-p.hold.x,p.z-p.hold.z)>.6))p.hold=null;
  if(Math.hypot(p.x-map.SPAWN.x,p.z-map.SPAWN.z)>4)p.active=true;
  p.anim=["Idle","Walk","Run","Jump"].includes(m.anim)?m.anim:"Idle";ws.serializeAttachment(p);
  instance.broadcast({type:"pose",id:p.id,x:p.x,z:p.z,y:p.y,h:p.h,anim:p.anim,hidden:p.hidden===true},ws);
  await instance.tickHouse();return;
 }
 await handle(instance,ws,p,m,room);
}
export async function start(instance,room){
 delete room.awardPayload;delete room.rewarded;room.castle=newState(Date.now());room.roundId=crypto.randomUUID();room.participants=instance.players().map(p=>p.id);
 instance.houseGuard=map.newGuard();instance.guardAt=Date.now();
 for(const [slot,ws] of instance.sockets().entries()){
  const p=ws.deserializeAttachment();p.x=(slot%4-1.5)*1.5;p.z=18+Math.floor(slot/4)*1.5;p.y=0;p.respawnUntil=0;p.hidden=false;p.safeUntil=Date.now()+8000;p.hold=null;p.active=false;ws.serializeAttachment(p);
 }
}
export async function handle(instance,ws,p,m,room){
 const r=room.castle,now=Date.now();if(room.status!=="playing"||!r)return;
 const send=note=>ws.send(JSON.stringify({type:"castle_note",note}));
 if(m.type==="castle_cancel"){p.hold=null;ws.serializeAttachment(p);return;}
 if(m.type==="castle_hold"){
  const action=rules.availableAction(r,p,now);
  if(!action||!action.ms||p.hidden||r.jailed[p.id]||p.y>.35)return;
  p.hold={type:action.type,index:action.index,at:now,x:p.x,z:p.z};ws.serializeAttachment(p);return;
 }
 if(m.type!=="castle_action"&&m.type!=="finish")return;
 if(now-(p.lastAction||0)<130)return;p.lastAction=now;
 const action=m.type==="finish"?{type:"finish"}:m.action;
 if(!action||typeof action.type!=="string")return;
 const result=rules.applyAction(r,p,action,now,instance.players());
 if(action.type!=="lever")p.hold=null;
 if(result.error){send(result.error);ws.serializeAttachment(p);return;}
 if(result.hidden!==undefined){p.hidden=result.hidden;if(!p.hidden)p.safeUntil=now+900;instance.broadcast({type:"hide",id:p.id,hidden:p.hidden});}
 if(result.rescued){
  const target=instance.sockets().find(s=>s.deserializeAttachment()?.id===result.rescued);
  if(target){const a=target.deserializeAttachment();a.x=map.RELEASE.x;a.z=map.RELEASE.z;a.safeUntil=now+6000;a.respawnUntil=now+500;target.serializeAttachment(a);instance.broadcast({type:"castle_release",id:a.id,x:a.x,z:a.z});}
 }
 if(result.task!==undefined&&result.task!==null)p.active=true;
 ws.serializeAttachment(p);await instance.ctx.storage.put("room",room);
 if(result.note)send(result.note);
 if(result.panel)ws.send(JSON.stringify({type:"castle_panel",input:r.input.length}));
 instance.broadcast({type:"castle_state",state:view(room)});
 if(result.complete)await finish(instance,room);
}
async function finish(instance,room){
 room.status="finished";await instance.ctx.storage.put("room",room);
 const rewards={};
 const active=new Set(instance.sockets().map(s=>s.deserializeAttachment()).filter(p=>p.active).map(p=>p.id));
 const participants=room.participants.filter(id=>active.has(id)||(room.castle.contributions[id]||0)>0||(room.castle.rescues[id]||0)>0).map(id=>({id}));
 for(const p of participants)rewards[p.id]=50+(room.castle.contributions[p.id]||0)+(room.castle.rescues[p.id]||0)*5;
 room.awardPayload={round:room.roundId,map:MAP_ID,started:room.castle.started,players:participants.map(p=>({session:p.id,tasks:(room.castle.contributions[p.id]||0)/10,rescues:room.castle.rescues[p.id]||0}))};
 await instance.ctx.storage.put("room",room);await retryRewards(instance,room);
 instance.broadcast({type:"complete",by:null,exit:"EAST CASTLE GATE",rewards});
}
export async function tick(instance,room,now,last){
 const r=room.castle;if(!r||room.status!=="playing")return;
 const freed=rules.tickRound(r,now);
 for(const id of freed){const ws=instance.sockets().find(s=>s.deserializeAttachment()?.id===id);if(ws){const a=ws.deserializeAttachment();a.x=map.RELEASE.x;a.z=map.RELEASE.z;a.safeUntil=now+6000;ws.serializeAttachment(a);instance.broadcast({type:"castle_release",id,x:map.RELEASE.x,z:map.RELEASE.z});}}
 if(r.failed){room.status="finished";await instance.ctx.storage.put("room",room);instance.broadcast({type:"castle_failed"});return;}
 instance.houseGuard??=map.newGuard();
 const peers=instance.sockets(),players=peers.map(s=>s.deserializeAttachment());
 // A closing shutter waits for a player in its opening, preventing a collision trap.
 if(now-r.gateUntil<500&&players.some(p=>Math.abs(p.x-map.DOOR.x)<.65&&Math.abs(p.z-map.DOOR.z)<1.9))r.gateUntil=now+450;
 const running=players.find(p=>p.anim==="Run"&&!p.hidden&&!r.jailed[p.id]);
 if(running&&now-(instance.lastRunNoise||0)>1500){r.noise={x:running.x,z:running.z,until:now+4000};instance.lastRunNoise=now;}
 const caught=rules.stepGuard(r,instance.houseGuard,players,(now-last)/1000,now);
 for(const ws of peers){
  const p=ws.deserializeAttachment();if(!caught.includes(p.id))continue;
  const position=rules.catchPlayer(r,p,now);if(!position)continue;
  Object.assign(p,position,{y:0,hidden:false,hold:null,safeUntil:now+12000,respawnUntil:now+12000});ws.serializeAttachment(p);
  instance.broadcast({type:"castle_caught",id:p.id,...position});
 }
 if(freed.length||caught.length||now-(instance.castleSavedAt||0)>1000){
  await instance.ctx.storage.put("room",room);instance.castleSavedAt=now;instance.broadcast({type:"castle_state",state:view(room,now)});
 }
 instance.broadcast({type:"guard",guard:map.guardView(instance.houseGuard)});
}
export async function drop(instance,room,id){if(room?.castle){rules.dropCargo(room.castle,id);await instance.ctx.storage.put("room",room);}}

export async function retryRewards(instance,room){
 if(!room.awardPayload||room.rewarded||!instance.playerStore)return;
 try{const response=await instance.playerStore.fetch("https://players.internal/_room_reward",{method:"POST",body:JSON.stringify(room.awardPayload)});if(response.ok){room.rewarded=true;await instance.ctx.storage.put("room",room);}}catch{}
}
