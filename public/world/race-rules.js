// Shared deterministic course and movement rules. Distances in metres, time in seconds.
export const MAP_ID='jobby-race-v1';
export const ROUND_MS=180000;
export const CHECKPOINTS=[{x:0,z:5},{x:0,z:-35},{x:0,z:-76},{x:0,z:-114}];
export const STAGES=['FOAM HOP','SWAYING ISLANDS','TRAPDOOR TROUBLE','FINAL SPIN'];
export const PLATFORMS=[
 {id:'start',x:0,z:4,w:16,d:12,y:0,checkpoint:0},
 ...[-8,-17,-26].map((z,i)=>({id:'hop'+i,x:i===1?2:-2,z,w:12,d:6,y:i===1?.45:0})),
 {id:'cp1',...CHECKPOINTS[1],w:16,d:8,y:0,checkpoint:1},
 ...[-46,-56,-66].map((z,i)=>({id:'sway'+i,x:0,z,w:8,d:7,y:0,moving:true,phase:i*1.7})),
 {id:'cp2',...CHECKPOINTS[2],w:16,d:8,y:0,checkpoint:2},
 ...[-86,-95,-104].flatMap((z,row)=>[-4,0,4].map((x,lane)=>({id:'trap'+row+lane,x,z,w:3.9,d:7,y:0,trap:true,phase:row*.8+lane*1.35}))),
 {id:'cp3',...CHECKPOINTS[3],w:16,d:8,y:0,checkpoint:3},
 {id:'final',x:0,z:-124,w:14,d:8,y:0},
 {id:'finish',x:0,z:-135,w:16,d:10,y:0,finish:true}
];
export const SPINNERS=[{x:2,z:-17,r:5,speed:1.35,phase:0},{x:0,z:-124,r:6,speed:-1.65,phase:1.1}];
export const BUMPERS=[{x:0,z:-56,r:1,speed:1.7}];
export function platformAt(p,t){const phase=((t+(p.phase||0))%4.5+4.5)%4.5;return {...p,x:p.x+(p.moving?Math.sin(t*.85+p.phase)*3:0),solid:!p.trap||phase<3.15,warning:!!p.trap&&phase>=2.5&&phase<3.15};}
export function contains(p,x,z,pad=0){return Math.abs(x-p.x)<=p.w/2-pad&&Math.abs(z-p.z)<=p.d/2-pad;}
export function supportAt(x,z,t){return PLATFORMS.map(p=>platformAt(p,t)).filter(p=>p.solid&&contains(p,x,z,.1)).sort((a,b)=>b.y-a.y)[0];}
export function spawn(slot=0,cp=0){const p=CHECKPOINTS[cp]||CHECKPOINTS[0];return {x:p.x+(slot%4-1.5)*1.5,z:p.z+Math.floor(slot/4)*1.4,y:0};}
export function newRunner(slot=0,checkpoint=0){return {...spawn(slot,checkpoint),vy:0,ix:0,iz:0,grounded:true,checkpoint,falls:0,finished:false,hitUntil:0,platform:null,events:[]};}
export function impulse(p,x,z,power=7){const length=Math.hypot(x,z)||1;p.ix=x/length*power;p.iz=z/length*power;p.vy=Math.max(p.vy,4.2);p.grounded=false;}
export function respawn(p,slot=0){const falls=p.falls+1,cp=p.checkpoint;Object.assign(p,newRunner(slot,cp),{falls,hitUntil:0});p.events.push({type:'fall'});}
function hazards(p,t){
 if(t<p.hitUntil||p.y>1.1||p.y<-.5)return;
 for(const s of SPINNERS){const a=t*s.speed+s.phase,dx=p.x-s.x,dz=p.z-s.z,along=dx*Math.cos(a)+dz*Math.sin(a),across=-dx*Math.sin(a)+dz*Math.cos(a);
  if(Math.abs(along)<s.r+.25&&Math.abs(across)<.57){impulse(p,-Math.sin(a)*Math.sign(s.speed)*Math.sign(along||1),Math.cos(a)*Math.sign(s.speed)*Math.sign(along||1),8);p.hitUntil=t+1;p.events.push({type:'bonk'});return;}}
 for(const b of BUMPERS){const x=b.x+Math.sin(t*b.speed)*2.5,dx=p.x-x,dz=p.z-b.z;if(Math.hypot(dx,dz)<b.r+.35){impulse(p,dx||1,dz,9);p.hitUntil=t+1;p.events.push({type:'bonk'});return;}}
}
export function stepRunner(p,input,dt,t,slot=0){
 p.events=[];if(p.finished)return p;
 dt=Math.min(.1,Math.max(0,dt));const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
 let jump=!!input.jump;
 for(let n=0;n<steps;n++){
  const at=t-dt+(n+1)*h,oldY=p.y;
  if(p.grounded&&p.platform){const base=PLATFORMS.find(x=>x.id===p.platform);if(base?.moving)p.x+=platformAt(base,at).x-platformAt(base,at-h).x;}
  let dx=input.x||0,dz=input.z||0;const length=Math.max(1,Math.hypot(dx,dz));dx/=length;dz/=length;
  if(jump&&p.grounded){p.vy=8.8;p.grounded=false;p.platform=null;}jump=false;
  p.x+=(dx*7.6+p.ix)*h;p.z+=(dz*7.6+p.iz)*h;
  p.ix*=Math.exp(-3*h);p.iz*=Math.exp(-3*h);
  const floor=supportAt(p.x,p.z,at);
  if(p.grounded&&(!floor||Math.abs(p.y-floor.y)>.08)){p.grounded=false;p.platform=null;}
  if(!p.grounded){p.vy-=22*h;p.y+=p.vy*h;if(p.vy<=0&&floor&&oldY>=floor.y-.06&&p.y<=floor.y){p.y=floor.y;p.vy=0;p.grounded=true;p.platform=floor.id;}}
  else if(floor){p.platform=floor.id;p.y=floor.y;}
  if(p.grounded&&floor?.checkpoint===p.checkpoint+1){p.checkpoint++;p.events.push({type:'checkpoint',index:p.checkpoint});}
  if(p.grounded&&floor?.finish&&p.checkpoint===3&&p.z<-133){p.finished=true;p.events.push({type:'finish'});break;}
  hazards(p,at);
  if(p.y<-9||Math.abs(p.x)>24||p.z>20||p.z<-145){respawn(p,slot);break;}
 }
 return p;
}
export function legalPose(previous,next,now){
 if(![next.x,next.z,next.y,next.h].every(Number.isFinite))return false;
 if(Math.abs(next.x)>24||next.z>20||next.z<-145||next.y<-10||next.y>4)return false;
 const dt=Math.min(.5,Math.max(.065,(now-(previous.poseAt||now))/1000));
 return Math.hypot(next.x-previous.x,next.z-previous.z)<=18*dt+1.2&&Math.abs(next.y-previous.y)<=18*dt+1.2;
}
