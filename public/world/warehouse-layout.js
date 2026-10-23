// Warehouse geometry is shared by the renderer, solo rules and Cloudflare.
import {WALLS as HOUSE_WALLS} from "./house-layout.js";
export const MAP_ID="warehouse-v1",ROUND_MS=6*60*1000,TASK_MS=1800;
export const SPAWN={x:0,z:19},JAIL={x:14,z:10};
export const ROOMS=[
 {name:"FUSE STORE",x:-14.5,z:-15,w:15,d:12,color:"#657d8c"},
 {name:"POWER ROOM",x:0,z:-15,w:14,d:12,color:"#4c777b"},
 {name:"DISPATCH OFFICE",x:14.5,z:-15,w:15,d:12,color:"#967857"},
 {name:"STORAGE A",x:-14.5,z:-3,w:15,d:12,color:"#716487"},
 {name:"SORTING HALL",x:0,z:-3,w:14,d:12,color:"#898576"},
 {name:"STORAGE B",x:14.5,z:-3,w:15,d:12,color:"#637f8b"},
 {name:"SECURE STORE",x:-14.5,z:9,w:15,d:12,color:"#93724f"},
 {name:"CONVEYOR",x:0,z:9,w:14,d:12,color:"#4d7771"},
 {name:"LOADING DOCK",x:14.5,z:9,w:15,d:12,color:"#708297"}
];
export const WALLS=HOUSE_WALLS.map(w=>({...w,color:Math.abs(w.x)>26||Math.abs(w.z)>26?"#405369":"#8297a6"}));
// Secure cage has one opening; its timed shutter is a separate dynamic obstacle.
WALLS.push({x:-17,z:9,w:.35,d:6,h:2.6,color:"#526b7d"},{x:-14,z:6,w:6.35,d:.35,h:2.6,color:"#526b7d"},{x:-14,z:12,w:6.35,d:.35,h:2.6,color:"#526b7d"},{x:-11,z:6.8,w:.35,d:1.6,h:2.6,color:"#526b7d"},{x:-11,z:11.2,w:.35,d:1.6,h:2.6,color:"#526b7d"});
export const DOOR={x:-11,z:9,w:.35,d:2.8,h:2.6};
export const PROPS=[
 {kind:"shelf",x:-20,z:-16,w:1.4,d:6,h:2.4},
 {kind:"crate",x:-14,z:-18,w:4,d:2,h:1.3},
 {kind:"fridge",x:4.7,z:-18,w:1.7,d:2,h:2.4},
 {kind:"desk",x:18,z:-18,w:4,d:1.6,h:.85},
 {kind:"shelf",x:-20,z:-3,w:1.4,d:6,h:2.4},
 {kind:"crate",x:-15,z:-5.7,w:4,d:1.8,h:1.4},
 {kind:"counter",asset:"conveyor-long-stripe.glb",x:0,z:-6.5,w:4,d:1.5,h:1.2},
 {kind:"shelf",x:20,z:-3,w:1.4,d:6,h:2.4},
 {kind:"crate",x:16,z:-6,w:3,d:1.8,h:1.5},
 {kind:"counter",asset:"conveyor-long-stripe.glb",x:0,z:11.7,w:4,d:1.6,h:1.2},
 {kind:"washer",asset:"machine.glb",x:3.5,z:12,w:2,d:2,h:1.4},
 {kind:"workbench",x:20,z:12,w:3,d:1.5,h:1},
 {kind:"crate",x:19,z:6,w:3,d:2,h:1.8}
];
export const SOLIDS=[...WALLS,...PROPS];
export const STATIONS={clue:{x:15,z:-16,name:"DISPATCH BOARD"},panel:{x:0,z:-16,name:"SYMBOL PANEL"},lever:{x:-9,z:9,name:"SHUTTER LEVER"},fuse:{x:-14,z:9,name:"SPARE FUSE"},socket:{x:-3,z:-16,name:"FUSE SOCKET"},conveyor:{x:0,z:9,name:"CONVEYOR"},jail:JAIL};
export const TASKS=[{...STATIONS.panel,name:"UNLOCK POWER",short:"PANEL",room:"Power room",color:"#ffd369"},{...STATIONS.socket,name:"INSTALL FUSE",short:"FUSE",room:"Secure store → Power room",color:"#75dbff"},{...STATIONS.conveyor,name:"DISPATCH CRATE",short:"CARGO",room:"Storage → Conveyor",color:"#b3f294"}];
export const EXITS=[{name:"LOADING GATE",x:25,z:10,task:2,color:"#6dffd0"}];
export const HIDES=[{x:-18,z:-16,name:"Fuse shelving"},{x:-18,z:-3,name:"Storage A rack"},{x:18,z:-3,name:"Storage B rack"},{x:3.5,z:9.6,name:"Behind the machine"}];
export const PATROL=[{x:0,z:-13},{x:15,z:-11},{x:12,z:-3},{x:10,z:9},{x:0,z:6},{x:-9,z:4},{x:-12,z:-3},{x:-15,z:-11}];
export function blocked(x,z,radius=.36){
 if(Math.abs(x)>26.5-radius||Math.abs(z)>26.5-radius)return true;
 return SOLIDS.some(b=>Math.abs(x-b.x)<b.w/2+radius&&Math.abs(z-b.z)<b.d/2+radius);
}
export const near=(a,b,d=1.8)=>Math.hypot(a.x-b.x,a.z-b.z)<=d;
export function hideAt(p,radius=1.35){return HIDES.findIndex(h=>near(p,h,radius));}
export function exitAt(p,tasks){return tasks.length===3?EXITS.findIndex(e=>near(p,e,1.5)):-1;}
export function visible(a,b){
 const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)*3);
 for(let i=1;i<n;i++)if(blocked(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n,.08))return false;
 return true;
}
// One cached 1 m navigation grid. Search only when a guard waypoint changes.
const nodes=new Map();
for(let x=-26;x<=26;x++)for(let z=-26;z<=26;z++)if(!blocked(x,z,.48))nodes.set(x+","+z,{x,z});
function nearest(p){
 let best=null,d=Infinity;
 for(const node of nodes.values()){const n=(node.x-p.x)**2+(node.z-p.z)**2;if(n<d){d=n;best=node;}}
 return best;
}
export function route(from,to){
 const start=nearest(from),end=nearest(to);if(!start||!end)return [];
 const key=p=>p.x+","+p.z,queue=[start],seen=new Set([key(start)]),parents=new Map();
 for(let i=0;i<queue.length;i++){
  const p=queue[i],k=key(p);
  if(k===key(end)){
   const path=[end];let previous=parents.get(k);
   while(previous){path.push(previous);previous=parents.get(key(previous));}
   path.reverse();if(near(from,start,.04))path.shift();
   if(!blocked(to.x,to.z,.48)&&visible(end,to))path.push({x:to.x,z:to.z});
   return path;
  }
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const next=nodes.get((p.x+dx)+","+(p.z+dz));if(!next||seen.has(key(next)))continue;
   seen.add(key(next));parents.set(key(next),p);queue.push(next);
  }
 }
 return [];
}
export function newGuard(){return {x:0,z:-16,h:0,mode:"patrol",target:null,waypoint:0,path:[],repath:0};}
export function advanceGuard(guard,players,dt,now){
 const candidates=players.filter(p=>!p.hidden&&now>(p.safeUntil||0)&&near(guard,p,guard.target===p.id?13:9)&&visible(guard,p));
 candidates.sort((a,b)=>Math.hypot(a.x-guard.x,a.z-guard.z)-Math.hypot(b.x-guard.x,b.z-guard.z));
 const target=candidates[0];guard.mode=target?"chase":guard.noise&&now<guard.noise.until?"investigate":"patrol";guard.target=target?.id||null;
 let destination=target||(guard.mode==="investigate"?guard.noise:PATROL[guard.waypoint]);
 if(guard.mode==="patrol"&&near(guard,destination,.6)){guard.waypoint=(guard.waypoint+1)%PATROL.length;destination=PATROL[guard.waypoint];guard.repath=0;}
 if(now>=guard.repath||!guard.path.length){guard.path=route(guard,destination);guard.repath=now+600;}
 let distance=Math.min(.25,Math.max(0,dt))*(target?5.2:2.6);
 while(distance>0&&guard.path.length){
  const goal=guard.path[0],dx=goal.x-guard.x,dz=goal.z-guard.z,length=Math.hypot(dx,dz);
  if(length<.01){guard.path.shift();continue;}
  const step=Math.min(distance,length),x=guard.x+dx/length*step,z=guard.z+dz/length*step;
  if(blocked(x,z,.4)){guard.path=[];break;}
  guard.x=x;guard.z=z;guard.h=Math.atan2(dx,dz);distance-=step;if(step===length)guard.path.shift();
 }
 return players.filter(p=>!p.hidden&&now>(p.safeUntil||0)&&near(guard,p,.85)&&visible(guard,p)).map(p=>p.id);
}
export function guardView(g){return {x:g.x,z:g.z,h:g.h,mode:g.mode,target:g.target};}
