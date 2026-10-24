import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import * as map from "./castle-layout.js";

// One cached download per model, one instanced draw per source mesh. Architecture
// stays opaque; camera collision uses the very same bounds as movement.
export function buildCastle(scene,{loadAssets=true,loadAll=false,onProgress=()=>{},assetLoader=null,party=false}={}){
 const assetCache=new Map(),loadedKeys=new Set();let sharedCastleTexture=null;
 const unit=new THREE.BoxGeometry(1,1,1),materials=new Map(),blocks=[],propsMeshes=[],collectibles=[],jobs=new Map(),loader=assetLoader||new GLTFLoader();
 const mat=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.88}));return materials.get(color);};
 function box(x,y,z,w,h,d,color,parent=scene){const o=new THREE.Mesh(unit,mat(color));o.position.set(x,y,z);o.scale.set(w,h,d);o.receiveShadow=true;o.castShadow=true;parent.add(o);return o;}
 function collider(b){blocks.push({...b,box:new THREE.Box3(new THREE.Vector3(b.x-b.w/2,(b.y||0)-.1,b.z-b.d/2),new THREE.Vector3(b.x+b.w/2,(b.y||0)+b.h,b.z+b.d/2))});}
 function request(pack,id,p,old=[]){const key=pack+"/"+id;if(!jobs.has(key))jobs.set(key,[]);jobs.get(key).push({p,old});}
 function sign(text,x,y,z,color="#ffdf99",width=3.3){
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=96;const c=canvas.getContext("2d");c.fillStyle="#1d2334";c.fillRect(0,0,512,96);c.fillStyle=color;c.font="900 32px system-ui";c.textAlign="center";c.fillText(text,256,60,490);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:true}));sprite.position.set(x,y,z);sprite.scale.set(width,width*96/512,1);scene.add(sprite);return sprite;
 }
 const floor=box(0,-.24,0,105,.35,105,"#788b6d");floor.castShadow=false;
 // Flat walkable tile surfaces at y=0. Their native quarter-unit thickness sits below the player.
 for(let x=-24;x<=24;x+=4)for(let z=-24;z<=4;z+=4)request("dungeon","floor-modular",{x,z,y:-.2,w:4,h:.2,d:4});
 for(let x=-48;x<=48;x+=8)for(let z=-48;z<=48;z+=8)if(Math.abs(x)>28||Math.abs(z)>28)request("castle","ground",{x,z,y:-.025,w:8,h:.01,d:8,lazy:true});
 for(let x=-24;x<=24;x+=4)for(let z=10;z<=26;z+=4)request("castle","ground",{x,z,y:.002,w:4,h:.01,d:4});
 // A visible stream and an actual three-piece bridge lead to the east grounds.
 const water=box(35.8,-.015,20,6.4,.025,16,"#397fa0");water.castShadow=false;water.renderOrder=-1;
 // Garden beds and plazas give the estate a continuous plan around the castle.
 for(const r of map.ESTATE_REGIONS){const bed=box(r.x,-.014,r.z,r.w,.018,r.d,r.color);bed.castShadow=false;bed.renderOrder=-2;}
 // Keep both grassy banks visible; water is above its lowered bed.
 water.position.y=.008;
 const road=(x,z,w,d)=>{const o=box(x,.015,z,w,.02,d,"#b5aa8e");o.castShadow=false;o.renderOrder=-1;};
 road(0,-34,98,4);road(-31,0,4,68);road(30,0,4,68);road(8,34,80,4);
 for(const z of [-16,2,21])road(-37,z,12,3);
 for(const x of [-22,-11,0,11,22,33,44])road(x,-39,2.6,7);
 for(const x of [-22,-2,18])road(x,38,3,6);
 road(28.5,20,5,3);road(46,20,10,3);

 for(const b of map.WATER)collider(b);
 // A low estate boundary makes the expanded map edge visible.
 for(const z of [-52,52])box(0,.5,z,104,1,.3,"#536f60");for(const x of [-52,52])box(x,.5,0,.3,1,104,"#536f60");

 for(const wall of map.WALLS){
  collider(wall);const alongX=wall.w>=wall.d,length=alongX?wall.w:wall.d,count=Math.ceil(length/3),step=length/count;
  for(let i=0;i<count;i++){
   const p={x:wall.x+(alongX?(i+.5)*step-length/2:0),z:wall.z+(alongX?0:(i+.5)*step-length/2),y:0,w:alongX?step:wall.w,h:wall.h,d:alongX?wall.d:step,turn:alongX?0:Math.PI/2};
   const fallback=box(p.x,p.h/2,p.z,p.w,p.h,p.d,wall.color);
   request(wall.kind==="castle"?"castle":"dungeon",wall.kind==="castle"?"wall":"wall-modular",p,[fallback]);
  }
 }
 const ids={Barrel:"barrel",Barrel2:"barrel2",Chest:"chest",Table_Big:"table-big",Chair:"chair",Crate:"crate",Column:"column",Column2:"column2"};
 for(const p of map.PROPS){collider(p);const old=box(p.x,p.h/2,p.z,p.w,p.h,p.d,"#997d5a");propsMeshes.push({prop:p,objects:[old]});request("dungeon",ids[p.asset],{...p,y:0},[old]);}
 // Towers sit outside the playable perimeter. Door arches frame openings, never fill them.
 for(const x of [-28,28])for(const z of [-28,28]){
  request("castle","tower-square-base",{x,z,w:3.5,h:4,d:3.5});
  request("castle","tower-square-top",{x,z,y:4,w:3.5,h:2.3,d:3.5});
 }
 for(const x of [-18,0,18])request("dungeon","arch",{x,z:8,w:6,h:4.1,d:.8});
 for(const z of [-16,2])request("dungeon","arch",{x:5,z,w:.65,h:3.6,d:6,turn:Math.PI/2});
 request("castle","flag",{x:0,z:8,y:4.2,w:.8,h:1.5,d:.8});
 const coreKeys=new Set(jobs.keys());coreKeys.add("castle/gate");
 for(const p of map.ENVIRONMENT_SOLIDS)collider(p);
 for(const p of map.ENVIRONMENT_PLACEMENTS){
  // Collision-matched silhouettes remain until the nearby original GLB loads.
  const old=p.solid&&p.y<.4?[box(p.x,p.y+p.h/2,p.z,p.w,p.h,p.d,p.pack==="castle"?"#ac9c75":"#77747b")]:[];
  request(p.pack,p.id,{...p,lazy:true},old);
 }
 for(const r of map.ESTATE_REGIONS)sign(r.name,r.entry.x,2.8,r.entry.z,"#c4e5d5",4.5);
 const gold=mat("#ffdb85"),cyan=mat("#6de9f0"),purple=mat("#c6a5ff");
 for(const [key,p] of Object.entries(map.STATIONS)){
  if(key==="jail"||key==="fuse")continue;
  box(p.x,.4,p.z,.65,.8,.65,"#686d76");sign(party?({clue:"ECHO TABLET",panel:"ECHO LOCK",socket:"CROWN ALTAR"}[key]||p.name):p.name,p.x,2.25,p.z,key==="socket"?"#6de9f0":"#ffdf99");
 }
 // Decorative station pedestals have no separate obstacle: their interaction area is walkable.
 const tablet=new THREE.Mesh(new THREE.BoxGeometry(.7,1,.16),gold);tablet.position.set(map.STATIONS.clue.x,1.2,map.STATIONS.clue.z);tablet.rotation.x=-.2;scene.add(tablet);
 const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.42),cyan);scene.add(crystal);
 const installedCrystal=crystal.clone();installedCrystal.visible=false;installedCrystal.position.set(map.STATIONS.socket.x,1.2,map.STATIONS.socket.z);scene.add(installedCrystal);
 const seals=[0,1,2].map(()=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.18,8),gold);o.rotation.x=Math.PI/2;scene.add(o);return o;});
 const sealSigns=seals.map(()=>sign("",0,1.65,0));
 const symbolNames=["SUN","MOON","STAR","CROWN"],colors=["#ffdb85","#8de4ff","#d4a6ff","#ffb49a"];
 function setSign(sprite,text){const canvas=sprite.material.map.image,c=canvas.getContext("2d");c.fillStyle="#1d2334";c.fillRect(0,0,512,96);c.fillStyle="#fff1c6";c.font="900 34px system-ui";c.textAlign="center";c.fillText(text,256,60,490);sprite.material.map.needsUpdate=true;}
 const carried=new THREE.Mesh(new THREE.OctahedronGeometry(.3),cyan);carried.visible=false;scene.add(carried);
 const shutter=new THREE.Group();scene.add(shutter);shutter.position.set(map.DOOR.x,0,map.DOOR.z);
 const gateFallback=box(0,1.35,0,map.DOOR.w,2.7,map.DOOR.d,"#584c47",shutter);
 const shutterBlock={...map.DOOR,box:new THREE.Box3(new THREE.Vector3(map.DOOR.x-map.DOOR.w/2,0,map.DOOR.z-map.DOOR.d/2),new THREE.Vector3(map.DOOR.x+map.DOOR.w/2,2.7,map.DOOR.z+map.DOOR.d/2))};blocks.push(shutterBlock);
 const exit=map.EXITS[0],exitGlow=new THREE.Mesh(new THREE.PlaneGeometry(4,3),new THREE.MeshBasicMaterial({color:"#ff8c9c",transparent:true,opacity:.32,side:THREE.DoubleSide}));exitGlow.rotation.y=Math.PI/2;exitGlow.position.set(exit.x,1.5,exit.z);scene.add(exitGlow);const exitSign=sign("EAST GATE · LOCKED",exit.x,3.4,exit.z);
 for(const h of map.HIDES){const ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.06,5,20),mat("#a3c7ff"));ring.rotation.x=Math.PI/2;ring.position.set(h.x,.05,h.z);scene.add(ring);sign("HIDE",h.x,1.4,h.z,"#a3c7ff",1.5);}
 sign("RESCUE · 12s",map.JAIL.x,2.6,map.JAIL.z,"#ffa7ba");
 // A non-combat guardian with armour, visor and cape. No old chef character.
 const guard=new THREE.Group();scene.add(guard);
 box(0,1.1,0,.75,.9,.5,"#5d7181",guard);box(0,1.92,0,.72,.65,.62,"#a8b4bd",guard);box(0,1.98,.324,.51,.1,.025,"#172433",guard);box(0,1.12,-.32,.82,1.2,.08,"#685088",guard);
 const arms=[-.51,.51].map(x=>box(x,1.05,0,.23,.8,.28,"#8298a5",guard));for(const x of [-.22,.22])box(x,.3,0,.28,.6,.36,"#3d4f5d",guard);
 const alert=new THREE.Mesh(new THREE.TorusGeometry(.65,.045,6,24),gold);alert.rotation.x=Math.PI/2;alert.position.y=.08;guard.add(alert);
 if(party){tablet.visible=false;crystal.visible=false;installedCrystal.visible=false;carried.visible=false;for(const o of [...seals,...sealSigns])o.visible=false;shutter.position.y=3.2;shutterBlock.box.min.y=3.2;shutterBlock.box.max.y=5.9;exitGlow.visible=false;exitSign.visible=false;}
 const metrics={requested:jobs.size,loaded:0,coreRequested:coreKeys.size,coreLoaded:0,failed:[],instances:0,keys:[]};
 async function instantiate(pack,id,placements,parent=scene){
  const key=pack+"/"+id;
  if(!assetCache.has(key))assetCache.set(key,loader.loadAsync("./models/"+key+".glb").then(gltf=>{
   if(pack==="castle")gltf.scene.traverse(n=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material])if(m.map){sharedCastleTexture??=m.map;m.map=sharedCastleTexture;}});
   return gltf;
  }));
  const gltf=await assetCache.get(key);gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const originals=[];gltf.scene.traverse(n=>{if(n.isMesh)originals.push(n);});
  for(const source of originals){
   const material=(Array.isArray(source.material)?source.material:[source.material]).map(m=>{const c=m.clone();c.transparent=false;c.opacity=1;c.depthWrite=true;if(pack==="castle"&&id==="ground"){c.map=null;c.color.set("#688971");}return c;});
   const mesh=new THREE.InstancedMesh(source.geometry,Array.isArray(source.material)?material:material[0],placements.length);mesh.userData.asset=key;
   placements.forEach(({p},i)=>{
    const turn=p.turn||0,swap=Math.abs(Math.sin(turn))>.5,sx=p.scale||(swap?p.d:p.w)/Math.max(.001,size.x),sy=p.scale||(p.h||size.y)/Math.max(.001,size.y),sz=p.scale||(swap?p.w:p.d)/Math.max(.001,size.z);
    const normalize=new THREE.Matrix4().makeScale(sx,sy,sz).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
    const world=new THREE.Matrix4().makeTranslation(p.x,p.y||0,p.z).multiply(new THREE.Matrix4().makeRotationY(turn)).multiply(normalize).multiply(source.matrixWorld);
    mesh.setMatrixAt(i,world);
   });if(id.startsWith("bridge-"))mesh.renderOrder=1;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.castShadow=pack==="castle";parent.add(mesh);metrics.instances+=placements.length;
  }
  for(const {old} of placements)for(const o of old)o.visible=false;loadedKeys.add(key);metrics.loaded=loadedKeys.size;metrics.coreLoaded=[...loadedKeys].filter(k=>coreKeys.has(k)).length;metrics.keys=[...loadedKeys];onProgress(metrics);return gltf;
 }
 const pending=new Map(),queue=[];let activeLoads=0;
 function pump(){
  while(activeLoads<4&&queue.length){const {key,resolve}=queue.shift();activeLoads++;
   (async()=>{try{await instantiate(...key.split("/"),jobs.get(key));}catch(e){metrics.failed.push(key);console.warn("Environment asset unavailable",key,e);onProgress(metrics);}finally{activeLoads--;resolve(metrics);pump();}})();
  }
 }
 function loadKey(key){
  if(!loadAssets)return Promise.resolve(metrics);
  if(!pending.has(key)){let resolve;const promise=new Promise(done=>resolve=done);pending.set(key,promise);queue.push({key,resolve});pump();}
  return pending.get(key);
 }
 async function loadKeys(keys){await Promise.all(keys.map(loadKey));return metrics;}
 const dynamicGate=loadAssets?instantiate("castle","gate",[{p:{x:0,z:0,w:map.DOOR.w,h:2.7,d:map.DOOR.d},old:[gateFallback]}],shutter).catch(()=>{if(!metrics.failed.includes("castle/gate"))metrics.failed.push("castle/gate");}):Promise.resolve();
 const ready=Promise.all([loadKeys(loadAll?[...jobs.keys()]:[...coreKeys]),dynamicGate]).then(()=>metrics);
 let nextStreamAt=0;
 function stream(position,now=Date.now()){
  if(!loadAssets||now<nextStreamAt)return Promise.resolve(metrics);nextStreamAt=now+800;
  return loadKeys([...jobs].filter(([key,placements])=>!pending.has(key)&&placements.some(({p})=>Math.hypot(p.x-position.x,p.z-position.z)<29)).map(([key])=>key));
 }

 return {blocks,propsMeshes,collectibles,guard,carried,shutter,ready,metrics,stream,loadAll:()=>loadKeys([...jobs.keys()]),
  updateTasks(tasks){installedCrystal.visible=tasks.includes(1);const open=tasks.includes(2);exitGlow.material.color.set(open?"#79ffcb":"#ff8c9c");if(exitSign.userData.open!==open){exitSign.userData.open=open;setSign(exitSign,open?"TAP ESCAPE · OR KEEP EXPLORING":"EAST GATE · LOCKED");}},
  updateRound(r,now,id,p){
   this.updateTasks(r.tasks);const open=now<r.gateUntil;shutter.position.y=open?3.2:0;shutterBlock.box.min.y=open?3.2:0;shutterBlock.box.max.y=open?5.9:2.7;
   crystal.visible=!r.fuse.owner&&!r.fuse.installed;crystal.position.set(map.STATIONS.fuse.x,1.2,map.STATIONS.fuse.z);
   r.crates.forEach((c,i)=>{seals[i].visible=!c.owner&&!r.tasks.includes(2);seals[i].position.set(c.x,.95,c.z);seals[i].material=mat(colors[c.symbol]);sealSigns[i].visible=seals[i].visible;sealSigns[i].position.set(c.x,1.7,c.z);if(sealSigns[i].userData.symbol!==c.symbol){setSign(sealSigns[i],symbolNames[c.symbol]+" SEAL");sealSigns[i].userData.symbol=c.symbol;}});
   carried.visible=!!p&&(r.fuse.owner===id||r.crates.some(c=>c.owner===id));if(p)carried.position.set(p.x,1.3,p.z+.6);
  },
  animate(time,chasing){guard.position.y=Math.abs(Math.sin(time*(chasing?12:6)))*.06;arms.forEach((o,i)=>o.rotation.x=Math.sin(time*(chasing?12:6)+i*Math.PI)*.4);alert.material=mat(chasing?"#ff7585":"#ffdb85");crystal.rotation.y=time;installedCrystal.rotation.y=time;}
 };
}
