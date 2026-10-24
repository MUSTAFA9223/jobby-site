import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import * as map from "./castle-layout.js";

// One cached download per model, one instanced draw per source mesh. Architecture
// stays opaque; camera collision uses the very same bounds as movement.
export function buildCastle(scene,{loadAssets=true,onProgress=()=>{},assetLoader=null}={}){
 const unit=new THREE.BoxGeometry(1,1,1),materials=new Map(),blocks=[],propsMeshes=[],collectibles=[],jobs=new Map(),loader=assetLoader||new GLTFLoader();
 const mat=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.88}));return materials.get(color);};
 function box(x,y,z,w,h,d,color,parent=scene){const o=new THREE.Mesh(unit,mat(color));o.position.set(x,y,z);o.scale.set(w,h,d);o.receiveShadow=true;o.castShadow=true;parent.add(o);return o;}
 function collider(b){blocks.push({...b,box:new THREE.Box3(new THREE.Vector3(b.x-b.w/2,-.1,b.z-b.d/2),new THREE.Vector3(b.x+b.w/2,b.h,b.z+b.d/2))});}
 function request(pack,id,p,old=[]){const key=pack+"/"+id;if(!jobs.has(key))jobs.set(key,[]);jobs.get(key).push({p,old});}
 function sign(text,x,y,z,color="#ffdf99",width=3.3){
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=96;const c=canvas.getContext("2d");c.fillStyle="#1d2334";c.fillRect(0,0,512,96);c.fillStyle=color;c.font="900 32px system-ui";c.textAlign="center";c.fillText(text,256,60,490);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:true}));sprite.position.set(x,y,z);sprite.scale.set(width,width*96/512,1);scene.add(sprite);return sprite;
 }
 const floor=box(0,-.24,0,55,.35,55,"#788b6d");floor.castShadow=false;
 // Flat walkable tile surfaces at y=0. Their native quarter-unit thickness sits below the player.
 for(let x=-24;x<=24;x+=4)for(let z=-24;z<=4;z+=4)request("dungeon","floor-modular",{x,z,y:-.2,w:4,h:.2,d:4});
 for(let x=-24;x<=24;x+=4)for(let z=10;z<=26;z+=4)request("castle","ground",{x,z,y:.002,w:4,h:.01,d:4});
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
 const gold=mat("#ffdb85"),cyan=mat("#6de9f0"),purple=mat("#c6a5ff");
 for(const [key,p] of Object.entries(map.STATIONS)){
  if(key==="jail"||key==="fuse")continue;
  box(p.x,.4,p.z,.65,.8,.65,"#686d76");sign(p.name,p.x,2.25,p.z,key==="socket"?"#6de9f0":"#ffdf99");
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
 const exit=map.EXITS[0],exitGlow=new THREE.Mesh(new THREE.PlaneGeometry(4,3),new THREE.MeshBasicMaterial({color:"#ff8c9c",transparent:true,opacity:.32,side:THREE.DoubleSide}));exitGlow.rotation.y=Math.PI/2;exitGlow.position.set(exit.x,1.5,exit.z);scene.add(exitGlow);sign("EAST GATE · LOCKED",exit.x,3.4,exit.z);
 for(const h of map.HIDES){const ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.06,5,20),mat("#a3c7ff"));ring.rotation.x=Math.PI/2;ring.position.set(h.x,.05,h.z);scene.add(ring);sign("HIDE",h.x,1.4,h.z,"#a3c7ff",1.5);}
 sign("RESCUE · 12s",map.JAIL.x,2.6,map.JAIL.z,"#ffa7ba");
 // A non-combat guardian with armour, visor and cape. No old chef character.
 const guard=new THREE.Group();scene.add(guard);
 box(0,1.1,0,.75,.9,.5,"#5d7181",guard);box(0,1.92,0,.72,.65,.62,"#a8b4bd",guard);box(0,1.98,.324,.51,.1,.025,"#172433",guard);box(0,1.12,-.32,.82,1.2,.08,"#685088",guard);
 const arms=[-.51,.51].map(x=>box(x,1.05,0,.23,.8,.28,"#8298a5",guard));for(const x of [-.22,.22])box(x,.3,0,.28,.6,.36,"#3d4f5d",guard);
 const alert=new THREE.Mesh(new THREE.TorusGeometry(.65,.045,6,24),gold);alert.rotation.x=Math.PI/2;alert.position.y=.08;guard.add(alert);
 const metrics={requested:jobs.size+1,loaded:0,failed:[],instances:0};
 async function instantiate(pack,id,placements,parent=scene){
  const gltf=await loader.loadAsync("./models/"+pack+"/"+id+".glb");gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const originals=[];gltf.scene.traverse(n=>{if(n.isMesh)originals.push(n);});
  for(const source of originals){
   const material=(Array.isArray(source.material)?source.material:[source.material]).map(m=>{const c=m.clone();c.transparent=false;c.opacity=1;c.depthWrite=true;return c;});
   const mesh=new THREE.InstancedMesh(source.geometry,Array.isArray(source.material)?material:material[0],placements.length);
   placements.forEach(({p},i)=>{
    const turn=p.turn||0,swap=Math.abs(Math.sin(turn))>.5,sx=(swap?p.d:p.w)/Math.max(.001,size.x),sy=(p.h||size.y)/Math.max(.001,size.y),sz=(swap?p.w:p.d)/Math.max(.001,size.z);
    const normalize=new THREE.Matrix4().makeScale(sx,sy,sz).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
    const world=new THREE.Matrix4().makeTranslation(p.x,p.y||0,p.z).multiply(new THREE.Matrix4().makeRotationY(turn)).multiply(normalize).multiply(source.matrixWorld);
    mesh.setMatrixAt(i,world);
   });mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.castShadow=pack==="castle";parent.add(mesh);metrics.instances+=placements.length;
  }
  for(const {old} of placements)for(const o of old)o.visible=false;metrics.loaded++;onProgress(metrics);return gltf;
 }
 const ready=loadAssets?Promise.allSettled([...jobs].map(async([key,placements])=>{try{await instantiate(...key.split("/"),placements);}catch(e){metrics.failed.push(key);onProgress(metrics);console.warn("Environment asset unavailable",key,e);}}).concat((async()=>{try{await instantiate("castle","gate",[{p:{x:0,z:0,w:map.DOOR.w,h:2.7,d:map.DOOR.d},old:[gateFallback]}],shutter);}catch{metrics.failed.push("castle/gate");}})())).then(()=>{onProgress(metrics);return metrics;}):Promise.resolve(metrics);
 return {blocks,propsMeshes,collectibles,guard,carried,shutter,ready,metrics,
  updateTasks(tasks){installedCrystal.visible=tasks.includes(1);exitGlow.material.color.set(tasks.includes(2)?"#79ffcb":"#ff8c9c");},
  updateRound(r,now,id,p){
   this.updateTasks(r.tasks);const open=now<r.gateUntil;shutter.position.y=open?3.2:0;shutterBlock.box.min.y=open?3.2:0;shutterBlock.box.max.y=open?5.9:2.7;
   crystal.visible=!r.fuse.owner&&!r.fuse.installed;crystal.position.set(map.STATIONS.fuse.x,1.2,map.STATIONS.fuse.z);
   r.crates.forEach((c,i)=>{seals[i].visible=!c.owner&&!r.tasks.includes(2);seals[i].position.set(c.x,.95,c.z);seals[i].material=mat(colors[c.symbol]);sealSigns[i].visible=seals[i].visible;sealSigns[i].position.set(c.x,1.7,c.z);if(sealSigns[i].userData.symbol!==c.symbol){setSign(sealSigns[i],symbolNames[c.symbol]+" SEAL");sealSigns[i].userData.symbol=c.symbol;}});
   carried.visible=!!p&&(r.fuse.owner===id||r.crates.some(c=>c.owner===id));if(p)carried.position.set(p.x,1.3,p.z+.6);
  },
  animate(time,chasing){guard.position.y=Math.abs(Math.sin(time*(chasing?12:6)))*.06;arms.forEach((o,i)=>o.rotation.x=Math.sin(time*(chasing?12:6)+i*Math.PI)*.4);alert.material=mat(chasing?"#ff7585":"#ffdb85");crystal.rotation.y=time;installedCrystal.rotation.y=time;}
 };
}
