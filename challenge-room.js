import * as race from './race-room.js';
export const ENTRY=100,MAX_PLAYERS=6;
export const validEntry=fee=>Number.isSafeInteger(fee)&&fee>=1&&fee<=1000000;
export async function isOwner(instance,id){if(!instance.playerStore)return false;const response=await instance.playerStore.fetch("https://players.internal/_challenge_owner",{method:"POST",body:JSON.stringify({session:id})});return response.ok&&(await response.json()).owner===true;}
export function newState(fee=ENTRY,creatorId=""){return {fee,creatorId,revision:crypto.randomUUID(),teams:{},ready:{},round:null,status:'lobby',winner:null,payouts:[],pot:0};}
export function view(room){const c=room.challenge;return c?{fee:c.fee,creatorId:c.creatorId,revision:c.revision,teams:c.teams,ready:c.ready,status:c.status,winner:c.winner,payouts:c.payouts,pot:c.pot,round:c.round}:null;}
export function assign(room,id,players){
 const c=room.challenge;c.revision||=crypto.randomUUID();if(c.teams[id])return;
 const count=t=>players.filter(p=>p.id!==id&&c.teams[p.id]===t).length;
 c.teams[id]=count('A')<=count('B')?'A':'B';c.ready[id]=false;
}
function broadcast(instance,room){instance.broadcast({type:'challenge_state',challenge:view(room)});}
export async function update(instance,room){
 const c=room.challenge;if(!c?.round||['lobby','paid','refunded'].includes(c.status))return;
 const entries=c.entries||[];
 // The frozen roster includes disconnected racers: disconnecting cannot shrink
 // a team's finish requirement. The same session can rejoin at its checkpoint.
 if(c.status==='playing'){
  for(const team of ['A','B']){
   const members=entries.filter(p=>p.team===team);
   if(members.length&&members.every(p=>room.race.entries[p.id]?.finishAt)){c.winner=team;c.status='settling';break;}
  }
  if(Date.now()>room.race.deadline){c.status='settling';room.status='finished';}
 }
 if(c.status==='starting'&&Date.now()>(c.startAttempt||0)+20000){c.status='settling';room.status='finished';}
 if(c.status!=='settling')return;
 room.status='finished';
 // Persist the decision before crossing the player-store boundary. A retry can
 // only deliver this same decision and can never debit or pay a round twice.
 await instance.ctx.storage.put('room',room);
 try{
  const res=await instance.playerStore.fetch('https://players.internal/_challenge_settle',{method:'POST',body:JSON.stringify({round:c.round,winner:c.winner,seconds:(Date.now()-room.race.started)/1000})});
  if(!res.ok&&res.status!==404)throw Error('Settlement unavailable');
  const data=res.status===404?{status:'refunded',winner:null,payouts:[]}:await res.json();c.status=data.status;c.winner=data.winner;c.payouts=data.payouts;
  await instance.ctx.storage.put('room',room);await instance.ctx.storage.deleteAlarm();
  broadcast(instance,room);instance.broadcast({type:'race_state',state:{...race.view(room),challenge:view(room)}});
 }catch{await instance.ctx.storage.setAlarm(Date.now()+10000);}
}
export async function message(instance,ws,m){
 const room=await instance.ctx.storage.get('room'),a=ws.deserializeAttachment();if(!room?.challenge||!a)return;
 const c=room.challenge,fail=message=>ws.send(JSON.stringify({type:'error',message}));
 if(m.type==='challenge_entry'){
  if(room.status!=='lobby'||c.status!=='lobby')return;
  if(a.id!==room.hostId||!await isOwner(instance,a.id)){fail('Only the game owner can set challenge entry points.');return;}
  if(!validEntry(m.fee)){fail('Enter a whole number from 1 to 1,000,000 points.');return;}
  if(m.fee!==c.fee){c.fee=m.fee;c.revision=crypto.randomUUID();c.ready={};}
  await instance.ctx.storage.put('room',room);broadcast(instance,room);return;
 }
 if(m.type==='challenge_team'||m.type==='challenge_ready'){
  if(room.status!=='lobby'||c.status!=='lobby')return;
  if(m.type==='challenge_team'){
   if(!['A','B'].includes(m.team))return;
   if(instance.players().filter(p=>p.id!==a.id&&c.teams[p.id]===m.team).length>=3){fail('A team can have at most three players.');return;}
   c.teams[a.id]=m.team;c.ready[a.id]=false;
  }else if(typeof m.ready==='boolean'){if(m.ready&&(m.fee!==c.fee||m.revision!==c.revision)){fail('Entry points changed. Review the current amount and confirm again.');return;}c.ready[a.id]=m.ready;}
  await instance.ctx.storage.put('room',room);broadcast(instance,room);return;
 }
 if(m.type==='start'){
  if(a.id!==room.hostId||!await isOwner(instance,a.id)){fail('Only the game owner can start a challenge.');return;}
  if(room.status==='playing'||['starting','settling'].includes(c.status))return;
  if(['paid','refunded'].includes(c.status)){
   room.challenge=newState(c.fee,c.creatorId);room.race=race.newState();room.status='lobby';for(const p of instance.players())assign(room,p.id,instance.players());
   await instance.ctx.storage.put('room',room);broadcast(instance,room);fail('New round ready. Choose teams and confirm entry again.');return;
  }
  const players=instance.players(),counts=['A','B'].map(t=>players.filter(p=>c.teams[p.id]===t).length);
  if(!counts[0]||counts[0]!==counts[1]||players.length>MAX_PLAYERS){fail('Choose two equal teams: 1v1, 2v2 or 3v3.');return;}
  if(players.some(p=>!c.ready[p.id])){fail('Every player must confirm the '+c.fee+'-point entry.');return;}
  if(!instance.playerStore){fail('Player saves are unavailable. No points were charged.');return;}
  c.round=crypto.randomUUID();c.entries=players.map(p=>({id:p.id,team:c.teams[p.id]}));c.status='starting';c.startAttempt=Date.now();
  await instance.ctx.storage.put('room',room);await instance.ctx.storage.setAlarm(Date.now()+21000);
  try{
   const response=await instance.playerStore.fetch('https://players.internal/_challenge_reserve',{method:'POST',body:JSON.stringify({round:c.round,room:room.code,fee:c.fee,entries:c.entries})});
   const data=await response.json();
   if(!response.ok){c.status='lobby';c.round=null;await instance.ctx.storage.put('room',room);await instance.ctx.storage.deleteAlarm();fail(data.error||'Could not reserve entry points.');return;}
   c.pot=data.pot;
   if(!c.entries.every(p=>instance.players().some(a=>a.id===p.id))){c.status='settling';await update(instance,room);fail('A player left before the start. All entry points were refunded.');return;}
   await race.start(instance,room);room.status='playing';c.status='playing';
   await instance.ctx.storage.put('room',room);await instance.ctx.storage.setAlarm(room.race.deadline+100);
   instance.broadcast({type:'start',keys:[],tasks:[],race:{...race.view(room),challenge:view(room)}});
  }catch{c.status='settling';await update(instance,room);fail('The challenge could not start. Entry points will be refunded automatically.');}
  return;
 }
 await race.handle(instance,ws,a,m,room);await update(instance,room);
}
export async function drop(instance,room,id){
 if(room.challenge?.status==='lobby'){room.challenge.ready[id]=false;await instance.ctx.storage.put('room',room);broadcast(instance,room);}
}
