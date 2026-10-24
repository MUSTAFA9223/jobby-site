import * as rules from './public/world/race-rules.js';
export const MAP_ID=rules.MAP_ID;
export function newState(){return {round:null,started:0,deadline:0,entries:{}};}
export function view(room,now=Date.now()){const r=room.race;return {round:r.round,started:r.started,deadline:r.deadline,serverNow:now,status:room.status,challenge:room.challenge?{fee:room.challenge.fee,teams:room.challenge.teams,ready:room.challenge.ready,status:room.challenge.status,winner:room.challenge.winner,payouts:room.challenge.payouts,pot:room.challenge.pot,round:room.challenge.round}:null,entries:Object.values(r.entries).map(p=>({id:p.id,name:p.name,checkpoint:p.checkpoint,falls:p.falls,finishAt:p.finishAt||0,rank:p.rank||0,slot:p.slot,x:p.x,y:p.y,z:p.z,h:p.h||0}))};}
export function join(room,info){
 let p=room.race.entries[info.id];
 if(!p){const slot=Object.keys(room.race.entries).length%12;p={...rules.spawn(slot),id:info.id,name:info.name,slot,checkpoint:0,falls:0,poseAt:Date.now(),safeUntil:Date.now()+1500};room.race.entries[info.id]=p;}
 p.name=info.name;Object.assign(info,{x:p.x,y:p.y,z:p.z,h:p.h||0});return p;
}
export async function start(instance,room){
 room.race=newState();room.race.round=crypto.randomUUID();room.race.started=Date.now()+6000;room.race.deadline=room.race.started+rules.ROUND_MS;
 for(const ws of instance.sockets()){const a=ws.deserializeAttachment();join(room,a);ws.serializeAttachment(a);}
}
function correct(ws,p){ws.send(JSON.stringify({type:'race_reset',id:p.id,x:p.x,y:p.y,z:p.z,checkpoint:p.checkpoint,falls:p.falls}));}
export async function retryRewards(instance,room){
 if(!instance.playerStore||room.challenge)return;
 for(const p of Object.values(room.race.entries)){
  if(!p.finishAt||p.rewarded)continue;
  try{const res=await instance.playerStore.fetch('https://players.internal/_room_reward',{method:'POST',body:JSON.stringify({map:MAP_ID,round:room.race.round,started:room.race.started,players:[{session:p.id,tasks:3,rescues:0,seconds:(p.finishAt-room.race.started)/1000}]})});if(res.ok)p.rewarded=true;}catch{}
 }
 await instance.ctx.storage.put('room',room);
}
export async function handle(instance,ws,a,m,room){
 const now=Date.now(),r=room.race,p=join(room,a);
 if(room.status!=='playing'){if(m.type==='pose')correct(ws,p);return;}
 if(now>r.deadline){room.status='finished';await retryRewards(instance,room);instance.broadcast({type:'race_state',state:view(room)});return;}
 if(now<r.started){if(m.type==='pose')correct(ws,p);return;}
 let changed=false;
 if(m.type==='race_fall'&&!p.finishAt&&now-(p.resetAt||0)>650){
  Object.assign(p,rules.spawn(p.slot,p.checkpoint),{falls:p.falls+1,poseAt:now,resetAt:now,safeUntil:now+1500});changed=true;correct(ws,p);
 }else if(m.type==='race_push'&&!p.finishAt&&now-(p.pushAt||0)>2200){
  p.pushAt=now;changed=true;let target=null;
  for(const q of Object.values(r.entries)){if(q.id===p.id||q.finishAt||now<(q.safeUntil||0)||Math.abs(q.y-p.y)>1.5||now-q.poseAt>1500)continue;
   const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz),front=(dx*Math.sin(p.h||0)+dz*Math.cos(p.h||0))/(d||1);
   if(d<2.15&&front>-.15&&(!target||d<target.d))target={q,d};}
  if(target){const q=target.q;instance.broadcast({type:'race_shove',id:q.id,by:p.id,x:q.x-p.x||.1,z:q.z-p.z});}
 }else if(m.type==='pose'){
  if(now-(a.last||0)<65)return;a.last=now;
  if(p.finishAt)return;
  if(!rules.legalPose(p,m,now)){correct(ws,p);return;}
  Object.assign(p,{x:m.x,y:m.y,z:m.z,h:m.h,poseAt:now});changed=true;
  const floor=rules.supportAt(p.x,p.z,(now-r.started)/1000);
  if(floor&&Math.abs(p.y-floor.y)<.18){
   if(floor.checkpoint===p.checkpoint+1){p.checkpoint++;instance.broadcast({type:'race_checkpoint',id:p.id,index:p.checkpoint});}
   if(floor.finish&&p.checkpoint===3&&p.z<-133){p.finishAt=now;p.rank=Object.values(r.entries).filter(q=>q.finishAt).length;instance.broadcast({type:'race_finish',id:p.id,rank:p.rank,seconds:(now-r.started)/1000,points:room.challenge?0:80});await retryRewards(instance,room);}
  }
  instance.broadcast({type:'pose',id:a.id,x:p.x,z:p.z,y:p.y,h:p.h,anim:['Idle','Walk','Run','Jump'].includes(m.anim)?m.anim:'Idle'},ws);
 }
 Object.assign(a,{x:p.x,y:p.y,z:p.z,h:p.h||0});ws.serializeAttachment(a);
 if(changed){await instance.ctx.storage.put('room',room);if(p.finishAt||now-(instance.raceSentAt||0)>650){instance.raceSentAt=now;instance.broadcast({type:'race_state',state:view(room)});}}
 const playing=Object.values(r.entries).filter(q=>room.challenge||instance.players().some(a=>a.id===q.id));
 if(playing.length&&playing.every(q=>q.finishAt)){room.status='finished';await retryRewards(instance,room);instance.broadcast({type:'race_state',state:view(room)});}
}
