// Shared house geometry and rules for the browser and Cloudflare room server.
export const MAP_ID="big-house-v1";
export const SPAWN={x:0,z:19};
export const ROOMS=[
 {name:"LIBRARY",x:-14.5,z:-15,w:15,d:12,color:"#816e9c"},
 {name:"KITCHEN",x:0,z:-15,w:14,d:12,color:"#91bdb1"},
 {name:"DINING",x:14.5,z:-15,w:15,d:12,color:"#cf9d83"},
 {name:"BEDROOM",x:-14.5,z:-3,w:15,d:12,color:"#b1a0ca"},
 {name:"MAIN HALL",x:0,z:-3,w:14,d:12,color:"#e5ca9c"},
 {name:"LOUNGE",x:14.5,z:-3,w:15,d:12,color:"#8bada5"},
 {name:"PANTRY",x:-14.5,z:9,w:15,d:12,color:"#c6ac86"},
 {name:"LAUNDRY",x:0,z:9,w:14,d:12,color:"#92b6cd"},
 {name:"GARAGE",x:14.5,z:9,w:15,d:12,color:"#9da5b7"}
];
export const WALLS=[];
function segments(axis,fixed,min,max,doors,color){
 let cursor=min;
 for(const [center,width] of [...doors,[max+1,2]]){
  const end=Math.min(max,center-width/2);
  if(end>cursor)WALLS.push({x:axis==="x"?(cursor+end)/2:fixed,z:axis==="z"?(cursor+end)/2:fixed,w:axis==="x"?end-cursor:.5,d:axis==="z"?end-cursor:.5,h:3.4,color});
  cursor=center+width/2;
 }
}
segments("x",-21,-22,22,[[0,4]],"#edd4be");
segments("x",15,-22,22,[[0,4],[15,4]],"#edd4be");
segments("z",-22,-21,15,[[-3,4]],"#c5a4ba");
segments("z",22,-21,15,[[-3,4]],"#c5a4ba");
for(const x of [-7,7])segments("z",x,-21,15,[[-15,3.6],[-3,3.6],[9,3.6]],"#ddc5bb");
for(const z of [-9,3])segments("x",z,-22,22,[[-15,3.6],[0,3.6],[15,3.6]],"#ddc5bb");
segments("x",-27,-27,27,[[-15,4]],"#5c8b7b");
segments("x",27,-27,27,[[0,4]],"#5c8b7b");
segments("z",27,-27,27,[[10,4]],"#5c8b7b");
segments("z",-27,-27,27,[],"#5c8b7b");
export const PROPS=[
 {kind:"shelf",x:-20,z:-17,w:1,d:5,h:2.5},
 {kind:"desk",x:-12,z:-18,w:3.5,d:1.6,h:.85},
 {kind:"counter",x:-3.5,z:-18.5,w:4,d:1.5,h:1},
 {kind:"fridge",x:4.5,z:-18.5,w:1.5,d:1.5,h:2.4},
 {kind:"island",x:0,z:-13.5,w:3.2,d:1.8,h:1.35},
 {kind:"table",x:15,z:-15,w:4,d:3,h:.9},
 {kind:"bed",x:-17,z:-5,w:3,d:4,h:.65},
 {kind:"wardrobe",x:-20.4,z:.5,w:1.6,d:2.5,h:2.5},
 {kind:"table",x:0,z:-3,w:3,d:2,h:.85},
 {kind:"sofa",x:17,z:-5.8,w:4.5,d:1.8,h:1.35},
 {kind:"sofa",x:19.8,z:-1.6,w:1.7,d:3.5,h:1.35},
 {kind:"shelf",x:-20.3,z:8,w:1.3,d:5,h:2.5},
 {kind:"crate",x:-12,z:11,w:2.5,d:2.5,h:1.4},
 {kind:"washer",x:-3.7,z:11.7,w:2,d:2,h:1.3},
 {kind:"wardrobe",x:4.5,z:11.5,w:1.7,d:2.7,h:2.5},
 {kind:"car",x:15.5,z:6.5,w:3,d:4.5,h:1.8},
 {kind:"workbench",x:19.5,z:12.5,w:3,d:1.5,h:1},
 {kind:"hedge",x:-10,z:-24,w:6,d:1,h:1.6},
 {kind:"hedge",x:10,z:-24,w:6,d:1,h:1.6}
];
export const SOLIDS=[...WALLS,...PROPS];
export const TASKS=[
 {name:"BRASS KEY",action:"TAKE KEY",x:-12,z:-16.2,room:"Library",color:"#ffd369"},
 {name:"GARAGE POWER",action:"FIX POWER",x:4.8,z:6,room:"Laundry",color:"#75dbff"},
 {name:"GARDEN TOOLS",action:"TAKE TOOLS",x:-12,z:7.8,room:"Pantry",color:"#b3f294"}
];
export const EXITS=[
 {name:"FRONT DOOR",x:0,z:25,task:0,color:"#ffd369"},
 {name:"GARAGE GATE",x:25,z:10,task:1,color:"#75dbff"},
 {name:"GARDEN GATE",x:-15,z:-25,task:2,color:"#b3f294"}
];
export const HIDES=[
 {x:-18.5,z:.5,name:"Bedroom wardrobe"},
 {x:2.6,z:11.5,name:"Laundry cupboard"},
 {x:-18.3,z:8,name:"Pantry shelving"},
 {x:17,z:-3.7,name:"Behind the sofa"}
];
export const PATROL=[{x:0,z:-16},{x:15,z:-11},{x:12,z:-3},{x:9,z:9},{x:0,z:6},{x:-15,z:5},{x:-10,z:-3},{x:-15,z:-11}];
export const TASK_MS=1600;
export function blocked(x,z,radius=.36){
 if(Math.abs(x)>26.5-radius||Math.abs(z)>26.5-radius)return true;
 return SOLIDS.some(b=>Math.abs(x-b.x)<b.w/2+radius&&Math.abs(z-b.z)<b.d/2+radius);
}
export const near=(a,b,d=1.8)=>Math.hypot(a.x-b.x,a.z-b.z)<=d;
export function hideAt(p,radius=1.35){return HIDES.findIndex(h=>near(p,h,radius));}
export function exitAt(p,tasks){return EXITS.findIndex(e=>tasks.includes(e.task)&&near(p,e,1.5));}
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
 const target=candidates[0];guard.mode=target?"chase":"patrol";guard.target=target?.id||null;
 let destination=target||PATROL[guard.waypoint];
 if(!target&&near(guard,destination,.6)){guard.waypoint=(guard.waypoint+1)%PATROL.length;destination=PATROL[guard.waypoint];guard.repath=0;}
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
