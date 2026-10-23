import * as map from "./public/world/warehouse-layout.js";
import * as rules from "./public/world/warehouse-rules.js";
export const MAP_ID=map.MAP_ID;
export const newState=now=>rules.newRound(crypto.getRandomValues(new Uint32Array(1))[0],now);
export const view=(room,now=Date.now())=>rules.viewRound(room.warehouse,now);
export async function start(instance,room){
 delete room.awardPayload;delete room.rewarded;room.warehouse=newState(Date.now());room.roundId=crypto.randomUUID();room.participants=instance.players().map(p=>p.id);
 instance.houseGuard=map.newGuard();instance.guardAt=Date.now();
 for(const [slot,ws] of instance.sockets().entries()){
  const p=ws.deserializeAttachment();p.x=(slot%4-1.5)*1.5;p.z=18+Math.floor(slot/4)*1.5;p.y=0;p.respawnUntil=0;p.hidden=false;p.safeUntil=Date.now()+8000;p.hold=null;p.active=false;ws.serializeAttachment(p);
 }
}
export async function handle(instance,ws,p,m,room){
 const r=room.warehouse,now=Date.now();if(room.status!=="playing"||!r)return;
 const send=note=>ws.send(JSON.stringify({type:"warehouse_note",note}));
 if(m.type==="warehouse_cancel"){p.hold=null;ws.serializeAttachment(p);return;}
 if(m.type==="warehouse_hold"){
  const action=rules.availableAction(r,p,now);
  if(!action||!action.ms||p.hidden||r.jailed[p.id]||p.y>.35)return;
  p.hold={type:action.type,index:action.index,at:now,x:p.x,z:p.z};ws.serializeAttachment(p);return;
 }
 if(m.type!=="warehouse_action"&&m.type!=="finish")return;
 if(now-(p.lastAction||0)<130)return;p.lastAction=now;
 const action=m.type==="finish"?{type:"finish"}:m.action;
 if(!action||typeof action.type!=="string")return;
 const result=rules.applyAction(r,p,action,now,instance.players());
 if(action.type!=="lever")p.hold=null;
 if(result.error){send(result.error);ws.serializeAttachment(p);return;}
 if(result.hidden!==undefined){p.hidden=result.hidden;if(!p.hidden)p.safeUntil=now+900;instance.broadcast({type:"hide",id:p.id,hidden:p.hidden});}
 if(result.rescued){
  const target=instance.sockets().find(s=>s.deserializeAttachment()?.id===result.rescued);
  if(target){const a=target.deserializeAttachment();a.x=11;a.z=10;a.safeUntil=now+6000;a.respawnUntil=now+500;target.serializeAttachment(a);instance.broadcast({type:"warehouse_release",id:a.id,x:a.x,z:a.z});}
 }
 if(result.task!==undefined&&result.task!==null)p.active=true;
 ws.serializeAttachment(p);await instance.ctx.storage.put("room",room);
 if(result.note)send(result.note);
 if(result.panel)ws.send(JSON.stringify({type:"warehouse_panel",input:r.input.length}));
 instance.broadcast({type:"warehouse_state",state:view(room)});
 if(result.complete)await finish(instance,room);
}
async function finish(instance,room){
 room.status="finished";await instance.ctx.storage.put("room",room);
 const rewards={};
 const active=new Set(instance.sockets().map(s=>s.deserializeAttachment()).filter(p=>p.active).map(p=>p.id));
 const participants=room.participants.filter(id=>active.has(id)||(room.warehouse.contributions[id]||0)>0||(room.warehouse.rescues[id]||0)>0).map(id=>({id}));
 for(const p of participants)rewards[p.id]=50+(room.warehouse.contributions[p.id]||0)+(room.warehouse.rescues[p.id]||0)*5;
 room.awardPayload={round:room.roundId,map:MAP_ID,started:room.warehouse.started,players:participants.map(p=>({session:p.id,tasks:(room.warehouse.contributions[p.id]||0)/10,rescues:room.warehouse.rescues[p.id]||0}))};
 await instance.ctx.storage.put("room",room);await retryRewards(instance,room);
 instance.broadcast({type:"complete",by:null,exit:"LOADING GATE",rewards});
}
export async function tick(instance,room,now,last){
 const r=room.warehouse;if(!r||room.status!=="playing")return;
 const freed=rules.tickRound(r,now);
 for(const id of freed){const ws=instance.sockets().find(s=>s.deserializeAttachment()?.id===id);if(ws){const a=ws.deserializeAttachment();a.x=11;a.z=10;a.safeUntil=now+6000;ws.serializeAttachment(a);instance.broadcast({type:"warehouse_release",id,x:11,z:10});}}
 if(r.failed){room.status="finished";await instance.ctx.storage.put("room",room);instance.broadcast({type:"warehouse_failed"});return;}
 instance.houseGuard??=map.newGuard();
 const peers=instance.sockets(),players=peers.map(s=>s.deserializeAttachment());
 // A closing shutter waits for a player in its opening, preventing a collision trap.
 if(now-r.gateUntil<500&&players.some(p=>Math.abs(p.x-map.DOOR.x)<.65&&Math.abs(p.z-map.DOOR.z)<1.7))r.gateUntil=now+450;
 const running=players.find(p=>p.anim==="Run"&&!p.hidden&&!r.jailed[p.id]);
 if(running&&now-(instance.lastRunNoise||0)>1500){r.noise={x:running.x,z:running.z,until:now+4000};instance.lastRunNoise=now;}
 const caught=rules.stepGuard(r,instance.houseGuard,players,(now-last)/1000,now);
 for(const ws of peers){
  const p=ws.deserializeAttachment();if(!caught.includes(p.id))continue;
  const position=rules.catchPlayer(r,p,now);if(!position)continue;
  Object.assign(p,position,{y:0,hidden:false,hold:null,safeUntil:now+12000,respawnUntil:now+12000});ws.serializeAttachment(p);
  instance.broadcast({type:"warehouse_caught",id:p.id,...position});
 }
 if(freed.length||caught.length||now-(instance.warehouseSavedAt||0)>1000){
  await instance.ctx.storage.put("room",room);instance.warehouseSavedAt=now;instance.broadcast({type:"warehouse_state",state:view(room,now)});
 }
 instance.broadcast({type:"guard",guard:map.guardView(instance.houseGuard)});
}
export async function drop(instance,room,id){if(room?.warehouse){rules.dropCargo(room.warehouse,id);await instance.ctx.storage.put("room",room);}}

export async function retryRewards(instance,room){
 if(!room.awardPayload||room.rewarded||!instance.playerStore)return;
 try{const response=await instance.playerStore.fetch("https://players.internal/_room_reward",{method:"POST",body:JSON.stringify(room.awardPayload)});if(response.ok){room.rewarded=true;await instance.ctx.storage.put("room",room);}}catch{}
}
