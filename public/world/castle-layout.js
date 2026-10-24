// One ground-floor layout shared by the client, navigation and Cloudflare.
export const MAP_ID="castle-dungeon-v1",ROUND_MS=8*60*1000,TASK_MS=1800;
export const SPAWN={x:0,z:20},JAIL={x:18,z:12},RELEASE={x:15,z:13};
export const ROOMS=[
 {name:"CASTLE COURTYARD",x:0,z:17.5,w:52,d:18,color:"#59716b"},
 {name:"SUN VAULT",x:-19,z:16,w:8,d:8,color:"#8c7860"},
 {name:"THE LABYRINTH",x:-16,z:-10.5,w:18,d:27,color:"#7c715f"},
 {name:"RUNE HALL",x:0,z:-8,w:9,d:32,color:"#857962"},
 {name:"ROYAL ARCHIVE",x:16,z:-16,w:20,d:18,color:"#70657e"},
 {name:"SEAL CHAMBER",x:16,z:2,w:20,d:11,color:"#6a7d80"}
];
export const WALLS=[];
const wall=(x,z,w,d,kind="dungeon",h=2.8)=>WALLS.push({x,z,w,d,h,kind,color:kind==="castle"?"#c3b28c":"#9c8b70"});
// A real, open east gateway. Opaque architecture never vanishes for the camera.
wall(0,-26.8,54,.6,"castle",3.6);wall(0,26.8,54,.6,"castle",3.6);
wall(-26.8,0,.6,54,"castle",3.6);wall(26.8,-4.9,.6,43.8,"castle",3.6);wall(26.8,24.5,.6,4.6,"castle",3.6);
for(const [a,b] of [[-26,-21],[-15,-3],[3,15],[21,26]])wall((a+b)/2,8,b-a,.65,"castle",3.2);
for(const [a,b] of [[-25,-19],[-13,-1],[5,8]])wall(5,(a+b)/2,.6,b-a);
for(const x of [-18,0,18])for(const side of [-1,1])wall(x+side*2.2,8,1.6,.8,"dungeon",4.1);
for(const z of [-16,2])for(const side of [-1,1])wall(5,z+side*2.2,.8,1.6,"dungeon",3.6);
wall(16,-7,21,.6); // Archive opens to the seal chamber at its western end.
// A rectangular vault with one portcullis, plus an emergency release inside.
wall(-23,16,.55,8);wall(-19,12,8.55,.55);wall(-19,20,8.55,.55);
wall(-15,13.25,.55,2.5);wall(-15,18.75,.55,2.5);
export const DOOR={x:-15,z:16,w:.5,d:3,h:2.7};
// A deterministic perfect maze, with two entrances and a reachable rune tablet.
export const MAZE={cols:4,rows:6,cell:4.5,x:-25,z:-24};
const cells=Array.from({length:24},()=>({east:false,south:false})),seen=new Set([23]),stack=[23];let seed=711;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
while(stack.length){
 const i=stack.at(-1),x=i%4,z=Math.floor(i/4),options=[];
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,j=nz*4+nx;if(nx>=0&&nx<4&&nz>=0&&nz<6&&!seen.has(j))options.push([j,dx,dz]);}
 if(!options.length){stack.pop();continue;}
 const [j,dx,dz]=options[Math.floor(random()*options.length)];if(dx===1)cells[i].east=true;if(dx===-1)cells[j].east=true;if(dz===1)cells[i].south=true;if(dz===-1)cells[j].south=true;seen.add(j);stack.push(j);
}
for(let z=0;z<6;z++)for(let x=0;x<4;x++){
 const c=cells[z*4+x],cx=MAZE.x+(x+.5)*4.5,cz=MAZE.z+(z+.5)*4.5;
 if(z===0)wall(cx,MAZE.z,4.5,.45);
 if(x===0)wall(MAZE.x,cz,.45,4.5);
 if(!c.east&&!(x===3&&z===5))wall(cx+2.25,cz,.45,4.5);
 if(!c.south&&!(z===5&&x===3))wall(cx,cz+2.25,4.5,.45);
}
export const PROPS=[
 {kind:"barrel",asset:"Barrel",x:-24,z:24,w:1.2,d:1.2,h:1.4},
 {kind:"crate",asset:"Chest",x:-21,z:24,w:1.9,d:1.1,h:1},
 {kind:"table",asset:"Table_Big",x:20,z:-21,w:3,d:1.8,h:1.1},
 {kind:"chair",asset:"Chair",x:20,z:-18.9,w:1,d:1,h:1.2},
 {kind:"shelf",asset:"Crate",x:24,z:-15,w:1.1,d:6,h:2.2},
 {kind:"barrel",asset:"Barrel2",x:23,z:-2,w:1.2,d:1.2,h:1.5},
 {kind:"table",asset:"Table_Big",x:23,z:3,w:2,d:2,h:1},
 {kind:"column",asset:"Column",x:-3,z:-22,w:.8,d:.8,h:3},
 {kind:"column",asset:"Column2",x:3,z:-22,w:.8,d:.8,h:3}
];
export const SOLIDS=[...WALLS,...PROPS];
export const STATIONS={clue:{x:-22.75,z:-21.75,name:"RUNE TABLET"},panel:{x:0,z:-20,name:"RUNE LOCK"},lever:{x:-13,z:16,name:"VAULT LEVER"},fuse:{x:-19,z:16,name:"SUN CRYSTAL"},socket:{x:0,z:-11,name:"CRYSTAL PEDESTAL"},conveyor:{x:17,z:3,name:"SEAL ALTAR"},jail:JAIL};
export const CRATE_SPAWNS=[{x:10,z:-20},{x:16,z:-12},{x:11,z:-3}];
export const TASKS=[{...STATIONS.panel,name:"SOLVE THE RUNES",short:"RUNES",room:"Labyrinth → Rune Hall",color:"#ffdb85"},{...STATIONS.socket,name:"RESTORE THE SUN CRYSTAL",short:"CRYSTAL",room:"Sun Vault → Rune Hall",color:"#6de9f0"},{...STATIONS.conveyor,name:"RETURN THE ROYAL SEAL",short:"SEAL",room:"Royal Archive → Seal Chamber",color:"#c6a5ff"}];
export const EXITS=[{name:"EAST CASTLE GATE",x:25,z:20,task:2,color:"#8cffe2"}];
export const HIDES=[{x:-24,z:21.8,name:"Behind courtyard barrels"},{x:23,z:-11,name:"Archive alcove"},{x:22,z:0,name:"Behind the altar"},{x:-10,z:5,name:"Labyrinth entrance"}];
export const PATROL=[{x:0,z:12},{x:18,z:14},{x:18,z:5},{x:8,z:0},{x:0,z:-3},{x:0,z:-17},{x:0,z:4},{x:-18,z:9}];
export function blocked(x,z,radius=.36){
 if(Math.abs(x)>26.5-radius||Math.abs(z)>26.5-radius)return true;
 return SOLIDS.some(b=>Math.abs(x-b.x)<b.w/2+radius&&Math.abs(z-b.z)<b.d/2+radius);
}
export const near=(a,b,d=1.8)=>Math.hypot(a.x-b.x,a.z-b.z)<=d;
export function hideAt(p,radius=1.35){return HIDES.findIndex(h=>near(p,h,radius));}
export function exitAt(p,tasks){return tasks.length===3?EXITS.findIndex(e=>near(p,e,1.5)):-1;}
export function visible(a,b){const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)*4);for(let i=1;i<n;i++)if(blocked(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n,.08))return false;return true;}
// Half-metre cells retain clearance around the narrower, model-sized maze walls.
const nodes=new Map();for(let x=-52;x<=52;x++)for(let z=-52;z<=52;z++)if(!blocked(x/2,z/2,.45))nodes.set(x+","+z,{x:x/2,z:z/2});
function nearest(p){let best=null,d=Infinity;for(const n of nodes.values()){const q=(n.x-p.x)**2+(n.z-p.z)**2;if(q<d){best=n;d=q;}}return best;}
export function route(from,to){
 const start=nearest(from),end=nearest(to);if(!start||!end)return [];const key=p=>Math.round(p.x*2)+","+Math.round(p.z*2),queue=[start],visited=new Set([key(start)]),parents=new Map();
 for(let i=0;i<queue.length;i++){const p=queue[i],k=key(p);if(k===key(end)){const path=[end];let prev=parents.get(k);while(prev){path.push(prev);prev=parents.get(key(prev));}path.reverse();if(near(from,start,.04))path.shift();if(!blocked(to.x,to.z,.45)&&visible(end,to))path.push({...to});return path;}
  for(const [dx,dz] of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){const n=nodes.get(Math.round((p.x+dx)*2)+","+Math.round((p.z+dz)*2));if(!n||visited.has(key(n)))continue;visited.add(key(n));parents.set(key(n),p);queue.push(n);}}
 return [];
}
export function newGuard(){return {x:18,z:5,h:0,mode:"patrol",target:null,waypoint:0,path:[],repath:0};}
export function advanceGuard(g,players,dt,now){
 const candidates=players.filter(p=>!p.hidden&&now>(p.safeUntil||0)&&near(g,p,g.target===p.id?12:8)&&visible(g,p));candidates.sort((a,b)=>Math.hypot(a.x-g.x,a.z-g.z)-Math.hypot(b.x-g.x,b.z-g.z));
 const target=candidates[0];g.mode=target?"chase":g.noise&&now<g.noise.until?"investigate":"patrol";g.target=target?.id||null;let destination=target||(g.mode==="investigate"?g.noise:PATROL[g.waypoint]);
 if(g.mode==="patrol"&&near(g,destination,.6)){g.waypoint=(g.waypoint+1)%PATROL.length;destination=PATROL[g.waypoint];g.repath=0;}
 if(now>=g.repath||!g.path.length){g.path=route(g,destination);g.repath=now+700;}
 let distance=Math.min(.25,Math.max(0,dt))*(target?5.1:2.5);while(distance>0&&g.path.length){const p=g.path[0],dx=p.x-g.x,dz=p.z-g.z,len=Math.hypot(dx,dz);if(len<.01){g.path.shift();continue;}const step=Math.min(distance,len),x=g.x+dx/len*step,z=g.z+dz/len*step;if(blocked(x,z,.4)){g.path=[];break;}g.x=x;g.z=z;g.h=Math.atan2(dx,dz);distance-=step;if(step===len)g.path.shift();}
 return players.filter(p=>!p.hidden&&now>(p.safeUntil||0)&&near(g,p,.85)&&visible(g,p)).map(p=>p.id);
}
export function guardView(g){return {x:g.x,z:g.z,h:g.h,mode:g.mode,target:g.target};}
