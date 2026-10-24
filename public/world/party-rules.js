import * as map from './castle-layout.js';
import {moveWithSliding} from './castle-motion.js';
export const MAP_ID='crown-heist-v1',ROUND_MS=4*60*1000;
export const BASES={A:{x:-20,z:23},B:{x:20,z:23}},CROWN={x:0,z:-12},BAG={x:-5,z:18},TREASURE={x:23,z:23};
export const TABLET={x:-22.75,z:-21.75},LOCK={x:0,z:-20};
export const POTIONS=['mini','giant','jelly'],SYMBOLS=['SUN ☀','MOON ☾','STAR ★','CROWN ♛'];
export const REFILLS=[{x:-12,z:19,potion:'mini'},{x:11,z:19,potion:'giant'},{x:2,z:13,potion:'jelly'}];
export const GATES=[{x:-18,z:8,w:2.8,d:.38,h:3.3},{x:18,z:8,w:2.8,d:.38,h:3.3},{x:5,z:-16,w:.38,d:3,h:3.3},{x:5,z:2,w:.38,d:3,h:3.3}];
export const TUNNEL={x:-10,z:16,w:4,d:.65,h:1.2},CRATE={x:10,z:15,w:1.7,d:1.7,h:1.7};
const near=(a,b,d=1.9)=>Math.hypot(a.x-b.x,a.z-b.z)<=d;
const hit=(x,z,b,r)=>Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r;
export function spawn(team,slot=0){return {x:BASES[team].x+(slot%3-1)*1.1,z:21,y:0,h:Math.PI,safeUntil:0};}
export function newRound(seed,now,entries=[],solo=false){
 let v=seed>>>0;const random=()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296;};
 const sequence=[0,1,2,3];for(let i=3;i>0;i--){const j=Math.floor(random()*(i+1));[sequence[i],sequence[j]]=[sequence[j],sequence[i]];}
 const r={seed,solo,started:now,deadline:now+ROUND_MS,finished:false,winner:null,actors:{},effects:{},stocks:{},cooldowns:{},refilled:{},stats:{},teams:{},crown:{...CROWN,owner:null},bag:{...BAG,owner:null,delivered:false},crate:{...CRATE,pushed:false},echo:{sequence:sequence.slice(0,3),reader:null,input:{A:[],B:[]},solved:{},boostUntil:{}},held:[],phase:0,signals:[],tracks:{},guardTrack:[],moment:null,highlights:null,lastSample:0};
 entries.forEach((e,i)=>join(r,e,i));return r;
}
export function join(r,e,slot=0){
 if(r.actors[e.id]){r.actors[e.id].name=e.name||r.actors[e.id].name;r.actors[e.id].connected=true;return r.actors[e.id];}
 const team=e.team||'A';r.teams[e.id]=team;r.stocks[e.id]={mini:1,giant:1,jelly:1};r.stats[e.id]={passes:0,deliveries:0,echoes:0,catches:0,potions:0,jumps:0,distance:0};
 return r.actors[e.id]={id:e.id,name:e.name||'Player',avatar:e.avatar||'JOBBY',team,...spawn(team,slot),safeUntil:r.started+6000,hidden:false,connected:true,poseAt:r.started};
}
export function effect(r,id,now){return r.effects[id]?.until>now?r.effects[id].type:'normal';}
export function radius(r,id,now){return effect(r,id,now)==='mini'?.18:effect(r,id,now)==='giant'?.49:.33;}
export function speed(r,id,now,run=false){
 if(r.crown.owner===id)return 3.1;
 if(r.bag.owner===id)return run?4.6:3.4;
 const kind=effect(r,id,now);return kind==='giant'?(run?4.4:3.4):kind==='mini'?(run?6.8:4.8):run?6.4:4.2;
}
export function gateOpen(r,index,now){
 if(r.echo.boostUntil.A>now||r.echo.boostUntil.B>now)return true;
 const phase=Math.max(0,Math.floor((now-r.started)/60000));
 return (index%2)===(phase%2)||r.held.includes(index);
}
export function blocked(r,id,x,z,now,bodyRadius=radius(r,id,now)){
 if(map.blocked(x,z,bodyRadius))return true;
 if(GATES.some((b,i)=>!gateOpen(r,i,now)&&hit(x,z,b,bodyRadius)))return true;
 if(hit(x,z,r.crate,bodyRadius))return true;
 // Only a small body fits the central half-metre tunnel; everyone can walk round it.
 if(effect(r,id,now)!=='mini'&&hit(x,z,TUNNEL,bodyRadius))return true;
 return [{x:TUNNEL.x-1.14,z:TUNNEL.z,w:1.72,d:TUNNEL.d},{x:TUNNEL.x+1.14,z:TUNNEL.z,w:1.72,d:TUNNEL.d}].some(b=>hit(x,z,b,bodyRadius));
}
export function move(r,id,x,z,dx,dz,now){return moveWithSliding(x,z,dx,dz,(a,b)=>blocked(r,id,a,b,now));}
export function publicView(r,now){
 return {seed:r.seed,solo:r.solo,started:r.started,deadline:r.deadline,serverNow:now,finished:r.finished,winner:r.winner,actors:Object.fromEntries(Object.entries(r.actors).map(([id,p])=>[id,{id:p.id,name:p.name,avatar:p.avatar,team:p.team,x:p.x,y:p.y,z:p.z,h:p.h,hidden:p.hidden,safeUntil:p.safeUntil,connected:p.connected}])),effects:r.effects,stocks:r.stocks,cooldowns:r.cooldowns,teams:r.teams,crown:r.crown,bag:r.bag,crate:r.crate,held:r.held,phase:r.phase,signals:r.signals,echo:{reader:r.echo.reader,input:r.echo.input,solved:r.echo.solved,boostUntil:r.echo.boostUntil},highlights:r.highlights,guard:r.guard?map.guardView(r.guard):null};
}
export function dropCargo(r,id){
 const p=r.actors[id];for(const item of [r.crown,r.bag])if(item.owner===id){item.owner=null;item.x=p.x;item.z=p.z;}
}
export function capture(r,id,now){
 const p=r.actors[id];if(!p||p.hidden||now<p.safeUntil||r.finished)return false;
 dropCargo(r,id);r.stats[id].catches++;r.moment={id,title:'WILDEST GETAWAY',frames:[...(r.tracks[id]||[])],guardFrames:[...r.guardTrack]};
 Object.assign(p,spawn(p.team),{safeUntil:now+6500,poseAt:now});return true;
}
export function actionAt(r,id,now){
 const p=r.actors[id];if(!p||r.finished)return null;
 if(p.hidden)return {type:'unhide',label:'LEAVE HIDING'};
 if(r.crown.owner===id&&near(p,BASES[p.team],2.3))return {type:'bank_crown',label:'DELIVER CROWN · WIN'};
 if(!r.crown.owner&&near(p,r.crown))return {type:'crown',label:'TAKE THE CROWN'};
 if(r.bag.owner===id&&near(p,TREASURE,2.3))return {type:'bank_bag',label:'BANK CURSED TREASURE'};
 if(!r.bag.delivered&&!r.bag.owner&&r.crown.owner!==id&&near(p,r.bag))return {type:'bag',label:'TAKE CURSED BAG'};
 if(near(p,TABLET))return {type:'read_echo',label:'READ PRIVATE ECHO RUNES'};
 if(near(p,LOCK)&&!r.echo.solved[p.team])return {type:'echo_panel',label:'OPEN ECHO LOCK'};
 if(!r.crate.pushed&&near(p,r.crate,2.5))return {type:'push',label:effect(r,id,now)==='giant'?'PUSH HEAVY CRATE':'GIANT POTION NEEDED'};
 const refill=REFILLS.find(b=>near(p,b)&&now>(r.refilled[id+':'+b.potion]||0));if(refill)return {type:'refill',potion:refill.potion,label:'REFILL '+refill.potion.toUpperCase()};
 if(r.bag.owner!==id&&r.crown.owner!==id&&map.hideAt(p)>=0)return {type:'hide',label:'HIDE FROM GUARDIAN'};
 if(r.crown.owner===id||r.bag.owner===id)return {type:'drop',label:'PUT CARRIED ITEM DOWN'};
 return null;
}
export function applyAction(r,id,a,now){
 const p=r.actors[id];if(!p||r.finished||now>=r.deadline)return {error:'The round is over.'};
 if(a.type==='signal'){
  const labels=['SUN ☀','MOON ☾','STAR ★','CROWN ♛','HELP!','COME HERE','PASS TO ME'];
  if(!Number.isInteger(a.index)||!labels[a.index]||now-(p.lastSignal||0)<650)return {error:'Wait a moment before another signal.'};
  p.lastSignal=now;r.signals.push({id,text:labels[a.index],at:now});r.signals=r.signals.slice(-8);return {note:labels[a.index]};
 }
 if(a.type==='potion'){
  if(!POTIONS.includes(a.potion)||!r.stocks[id][a.potion]||now<(r.cooldowns[id]||0)||p.hidden||p.y>.1)return {error:'No potion ready. Refill at a marked bottle station.'};
  const old=r.effects[id];r.effects[id]={type:a.potion,until:now+12000};
  if(blocked(r,id,p.x,p.z,now)){r.effects[id]=old||null;return {error:'Move away from walls before changing size.'};}
  r.stocks[id][a.potion]--;r.cooldowns[id]=now+2000;r.stats[id].potions++;return {note:a.potion.toUpperCase()+' · 12 seconds'};
 }
 if(a.type==='pass'){
  const item=r.crown.owner===id?r.crown:r.bag.owner===id?r.bag:null;
  const others=Object.values(r.actors).filter(q=>q.id!==id&&q.connected!==false&&q.team===p.team&&!q.hidden&&r.crown.owner!==q.id&&r.bag.owner!==q.id&&near(p,q,2.7)).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
  if(!item||!others.length)return {error:'Stand near a teammate with empty hands.'};
  item.owner=others[0].id;r.stats[id].passes++;return {note:'Passed to '+others[0].name};
 }
 if(a.type==='echo_symbol'){
  if(!near(p,LOCK)||p.hidden||r.echo.solved[p.team]||!Number.isInteger(a.symbol)||a.symbol<0||a.symbol>3)return {error:'Stand beside the echo lock.'};
  if(!r.echo.reader||(!r.solo&&r.echo.reader===id))return {error:'A different player must read the tablet and guide you. Use voice or rune signals.'};
  const input=r.echo.input[p.team];input.push(a.symbol);
  if(input.at(-1)!==r.echo.sequence[input.length-1]){r.echo.input[p.team]=[];return {note:'Wrong rune! Try the sequence again.'};}
  if(input.length===3){r.echo.solved[p.team]=true;r.echo.boostUntil[p.team]=now+20000;r.stats[id].echoes++;if(r.stats[r.echo.reader])r.stats[r.echo.reader].echoes++;return {note:'ECHO SOLVED · All gates open for 20 seconds!'};}
  return {note:'Rune '+input.length+' / 3'};
 }
 const available=actionAt(r,id,now);if(!available||available.type!==a.type||p.y>.35)return {error:'Move closer to this objective.'};
 if(a.type==='crown'){if(r.bag.owner===id)return {error:'Pass or drop the bag first.'};r.crown.owner=id;return {note:'CROWN TAKEN · Return to TEAM '+p.team+' home flag!',milestone:0};}
 if(a.type==='bank_crown'){r.finished=true;r.winner=p.team;finishHighlights(r,id);return {note:'TEAM '+p.team+' WINS!',complete:true};}
 if(a.type==='bag'){r.bag.owner=id;return {note:'CURSED BAG · Noise attracts the guardian. Pass it to a teammate!'};}
 if(a.type==='bank_bag'){r.bag.owner=null;r.bag.delivered=true;r.stats[id].deliveries++;r.echo.boostUntil[p.team]=now+15000;for(const q of Object.values(r.actors))if(q.team===p.team)q.safeUntil=now+15000;return {note:'TREASURE BANKED · Your team has 15 seconds of guardian protection!'};}
 if(a.type==='drop'){dropCargo(r,id);return {note:'Item placed on the ground.'};}
 if(a.type==='read_echo'){r.echo.reader=id;return {private:true,code:[...r.echo.sequence],note:'PRIVATE RUNES: '+r.echo.sequence.map(i=>SYMBOLS[i]).join(' → ')+' · Tell a teammate at the echo lock.'};}
 if(a.type==='echo_panel')return {panel:true,note:'Ask the tablet reader for the three runes. Voice or signal buttons both work.'};
 if(a.type==='push'){
  if(effect(r,id,now)!=='giant')return {error:'Drink GIANT to move this crate.'};
  if(Object.values(r.actors).some(q=>q.id!==id&&near(q,{x:15,z:15},1.5)))return {error:'Ask your teammate to move away from the crate landing.'};
  r.crate.x=15;r.crate.pushed=true;r.echo.boostUntil[p.team]=now+10000;r.stocks[id].jelly++;return {note:'CRATE MOVED · Shortcut gates open and one Jelly potion earned!'};
 }
 if(a.type==='refill'){r.stocks[id][available.potion]=Math.min(2,r.stocks[id][available.potion]+1);r.refilled[id+':'+available.potion]=now+30000;return {note:available.potion.toUpperCase()+' potion refilled.'};}
 if(a.type==='hide'||a.type==='unhide'){p.hidden=a.type==='hide';if(!p.hidden)p.safeUntil=now+1000;return {note:p.hidden?'HIDDEN':'Back in the game'};}
 return {};
}
export function tick(r,now,guard=null){
 if(r.finished)return;
 r.phase=Math.floor(Math.max(0,now-r.started)/60000);
 r.held=GATES.map((b,i)=>Object.values(r.actors).some(p=>p.connected!==false&&hit(p.x,p.z,b,radius(r,p.id,now)+.2))?i:-1).filter(i=>i>=0);
 for(const p of Object.values(r.actors)){
  const e=r.effects[p.id];if(e&&e.until<=now){
   if(e.type==='mini'&&blocked(r,p.id,p.x,p.z,now,.33))e.until=now+500;else r.effects[p.id]=null;
  }
 }
 if(r.bag.owner&&r.actors[r.bag.owner]){const p=r.actors[r.bag.owner];r.noise={x:p.x,z:p.z,until:now+1500};}
 else r.noise=null;
 if(now-r.lastSample>=250){
  r.lastSample=now;
  for(const p of Object.values(r.actors)){const frames=r.tracks[p.id]||=[];frames.push({x:p.x,y:p.y||0,z:p.z,h:p.h||0,at:now,kind:effect(r,p.id,now)});if(frames.length>48)frames.shift();}
  if(guard){r.guardTrack.push({x:guard.x,y:0,z:guard.z,h:guard.h||0,at:now});if(r.guardTrack.length>48)r.guardTrack.shift();}
 }
 r.signals=r.signals.filter(s=>now-s.at<4500);
 if(now>=r.deadline){r.finished=true;finishHighlights(r,null);}
}
export function finishHighlights(r,finisher){
 if(r.highlights)return r.highlights;
 const players=Object.values(r.actors),rank=(score)=>[...players].sort((a,b)=>score(r.stats[b.id])-score(r.stats[a.id]))[0];
 const topTeam=rank(s=>s.passes+s.echoes+s.deliveries*2),topWild=rank(s=>s.catches*2+s.jumps+s.potions),teammate=topTeam&&(r.stats[topTeam.id].passes+r.stats[topTeam.id].echoes+r.stats[topTeam.id].deliveries)>0?topTeam:null,wild=topWild&&(r.stats[topWild.id].catches+r.stats[topWild.id].jumps+r.stats[topWild.id].potions)>0?topWild:null,hero=players.find(p=>p.id===finisher);
 const awards=[hero&&{title:'CROWN COURIER',id:hero.id,name:hero.name},teammate&&{title:'BEST TEAMMATE',id:teammate.id,name:teammate.name},wild&&{title:'WILDEST ADVENTURER',id:wild.id,name:wild.name}].filter(Boolean);
 const moment=r.moment?.frames.length>1?r.moment:{id:finisher||wild?.id||players[0]?.id,title:hero?'THE WINNING DELIVERY':'LAST GETAWAY',frames:r.tracks[finisher||wild?.id||players[0]?.id]||[],guardFrames:r.guardTrack};
 return r.highlights={awards,clip:moment};
}
