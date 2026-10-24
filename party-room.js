import * as rules from './public/world/party-rules.js';
import * as map from './public/world/castle-layout.js';
export const MAP_ID=rules.MAP_ID;
export const newState=now=>rules.newRound(crypto.getRandomValues(new Uint32Array(1))[0],now,[]);
export function view(room,now=Date.now()){const c=room.challenge;return {...rules.publicView(room.party,now),challenge:c?{fee:c.fee,status:c.status,winner:c.winner,payouts:c.payouts,pot:c.pot,round:c.round}:null};}
export function join(room,info){
 const p=rules.join(room.party,{...info,team:room.challenge?.teams[info.id]||'A'},Object.keys(room.party.actors).length);
 Object.assign(info,{x:p.x,y:p.y,z:p.z,h:p.h,hidden:p.hidden});return p;
}
export async function start(instance,room){
 const entries=instance.players().map(p=>({...p,team:room.challenge.teams[p.id]}));
 room.party=rules.newRound(crypto.getRandomValues(new Uint32Array(1))[0],Date.now()+5000,entries);
 room.party.guard=map.newGuard();room.party.guardAt=Date.now();
 for(const ws of instance.sockets()){const a=ws.deserializeAttachment();join(room,a);ws.serializeAttachment(a);}
}
function correct(ws,p){ws.send(JSON.stringify({type:'party_reset',id:p.id,x:p.x,y:p.y,z:p.z,h:p.h,hidden:p.hidden}));}
export async function handle(instance,ws,a,m,room){
 const r=room.party,now=Date.now(),p=join(room,a);
 if(room.status!=='playing'||r.finished){if(m.type==='pose')correct(ws,p);return;}
 if(now<r.started){if(m.type==='pose')correct(ws,p);return;}
 let changed=false;
 if(m.type==='party_action'){
  if(now-(p.actionAt||0)<160)return;p.actionAt=now;
  if(!m.action||typeof m.action.type!=='string')return;
  const result=rules.applyAction(r,a.id,m.action,now);
  ws.send(JSON.stringify({type:'party_note',...result}));changed=true;
 }else if(m.type==='pose'){
  if([m.x,m.y,m.z,m.h].some(n=>typeof n!=='number'||!Number.isFinite(n))||now-(p.poseAt||0)<65)return;
  const elapsed=Math.min(.7,Math.max(.065,(now-p.poseAt)/1000)),dx=m.x-p.x,dz=m.z-p.z,max=rules.speed(r,a.id,now,m.anim==='Run')*elapsed+.2;
  const resolved=rules.move(r,a.id,p.x,p.z,dx,dz,now);
  if(!p.hidden&&Math.hypot(dx,dz)<=max&&Math.hypot(resolved.x-m.x,resolved.z-m.z)<.025&&!rules.blocked(r,a.id,m.x,m.z,now)){
   r.stats[a.id].distance+=Math.hypot(dx,dz);if((p.y||0)<.15&&m.y>.25)r.stats[a.id].jumps++;
   Object.assign(p,{x:m.x,z:m.z,y:Math.max(0,Math.min(4,m.y)),h:m.h%(Math.PI*2),anim:['Idle','Walk','Run','Jump'].includes(m.anim)?m.anim:'Idle'});
  }else if(!p.hidden)correct(ws,p);
  p.poseAt=now;changed=true;
  instance.broadcast({type:'pose',id:p.id,x:p.x,y:p.y,z:p.z,h:p.h,anim:p.anim,hidden:p.hidden},ws);
 }
 const dt=Math.min(.2,Math.max(0,(now-(r.guardAt||now))/1000));r.guardAt=now;r.guard||=map.newGuard();
 rules.tick(r,now,r.guard);
 if(r.noise)r.guard.noise=r.noise;
 const eligible=Object.values(r.actors).filter(p=>instance.players().some(a=>a.id===p.id)&&!p.hidden);
 let captured=false;const oldGuard={x:r.guard.x,z:r.guard.z};const caught=map.advanceGuard(r.guard,eligible,dt,now);if(rules.blocked(r,"guard",r.guard.x,r.guard.z,now,.4)){Object.assign(r.guard,oldGuard);caught.length=0;}
 for(const id of caught)if(rules.capture(r,id,now)){
  captured=true;const target=instance.sockets().find(s=>s.deserializeAttachment()?.id===id);if(target)correct(target,r.actors[id]);
 }
 if(r.finished)room.status='finished';
 Object.assign(a,{x:p.x,y:p.y,z:p.z,h:p.h,hidden:p.hidden});ws.serializeAttachment(a);
 if(changed||now-(instance.partySavedAt||0)>700){await instance.ctx.storage.put('room',room);instance.partySavedAt=now;}
 if(m.type==='party_action'||captured||r.finished||now-(instance.partyPublishedAt||0)>250){instance.partyPublishedAt=now;instance.broadcast({type:'party_state',state:view(room,now)});}
}

export function deadline(room,now){rules.tick(room.party,now,room.party.guard);if(room.party.finished)room.status="finished";}

export function disconnect(room,id){if(room.party?.actors[id]){rules.dropCargo(room.party,id);room.party.actors[id].connected=false;}}
