import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {buildHouse} from "./house-scene.js";
import * as map from "./warehouse-layout.js";

export function buildWarehouse(scene,{loadAssets=true,batch=true}={}){
 const arena=buildHouse(scene,map),loader=new GLTFLoader(),cache=new Map();
 if(batch){
  const excluded=new Set(arena.propsMeshes.filter(v=>v.prop.asset).flatMap(v=>v.objects)),groups=new Map();
  for(const node of [...scene.children])if(node.isMesh&&node.geometry.type==="BoxGeometry"&&!node.material.transparent&&!node.material.map&&!excluded.has(node)){
   const key=node.geometry.uuid+":"+node.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(node);
  }
  for(const nodes of groups.values())if(nodes.length>2){const mesh=new THREE.InstancedMesh(nodes[0].geometry,nodes[0].material,nodes.length);nodes.forEach((n,i)=>{n.updateMatrix();mesh.setMatrixAt(i,n.matrix);scene.remove(n);});mesh.receiveShadow=true;mesh.castShadow=true;scene.add(mesh);}
 }
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:.8});
 const shutter=new THREE.Mesh(new THREE.BoxGeometry(map.DOOR.w,2.6,map.DOOR.d),material("#e8ad4d"));shutter.position.set(map.DOOR.x,1.3,map.DOOR.z);scene.add(shutter);
 const shutterBlock={...map.DOOR,box:new THREE.Box3(new THREE.Vector3(map.DOOR.x-map.DOOR.w/2,0,map.DOOR.z-map.DOOR.d/2),new THREE.Vector3(map.DOOR.x+map.DOOR.w/2,2.6,map.DOOR.z+map.DOOR.d/2))};arena.blocks.push(shutterBlock);
 const crates=[0,1,2].map(()=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.9,.9,.9),material("#d8ad6c"));scene.add(m);return m;});
 const fuse=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.65,10),material("#76e5ff"));scene.add(fuse);
 const carried=new THREE.Mesh(new THREE.BoxGeometry(.65,.65,.65),material("#ffd369"));carried.visible=false;scene.add(carried);
 const labelTextures=[];
 function label(text,x,y,z,color="#f9e9b9"){
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=96;const c=canvas.getContext("2d");c.fillStyle="#142234";c.fillRect(0,0,512,96);c.fillStyle=color;c.font="900 34px system-ui";c.textAlign="center";c.fillText(text,256,60,490);
  const tex=new THREE.CanvasTexture(canvas);labelTextures.push(tex);const m=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:true}));m.position.set(x,y,z);m.scale.set(3,.56,1);scene.add(m);return m;
 }
 const signs=[];
 for(const [key,p] of Object.entries(map.STATIONS))if(!["fuse","jail"].includes(key))signs.push(label(p.name,p.x,2.8,p.z));
 signs.push(label("RESCUE BAY · 12s",map.JAIL.x,2.8,map.JAIL.z,"#ffb3bd"));
 const crateLabels=crates.map(()=>label("",0,1.3,0));
 const symbolNames=["▲ TRIANGLE","● CIRCLE","■ SQUARE","★ STAR"],colors=["#ffbd77","#89ddff","#baf394","#d1afff"];
 function setLabel(sprite,text){const canvas=sprite.material.map.image,c=canvas.getContext("2d");c.clearRect(0,0,512,96);c.fillStyle="#142234";c.fillRect(0,0,512,96);c.fillStyle="#fff2d6";c.font="900 34px system-ui";c.textAlign="center";c.fillText(text,256,60,490);sprite.material.map.needsUpdate=true;}
 function asset(pack,name,x,z,w,h,d,old=[]){
  if(!loadAssets)return;
  const url="./models/warehouse/"+pack+"/"+name;
  if(!cache.has(url))cache.set(url,loader.loadAsync(url));
  cache.get(url).then(gltf=>{
   const model=gltf.scene.clone(true),b=new THREE.Box3().setFromObject(model),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());
   const scale=Math.min(w/Math.max(.01,size.x),h/Math.max(.01,size.y),d/Math.max(.01,size.z));
   model.scale.setScalar(scale);model.position.set(x-center.x*scale,-b.min.y*scale,z-center.z*scale);model.traverse(n=>{if(n.isMesh){n.castShadow=false;n.receiveShadow=true;}});scene.add(model);for(const node of old)node.visible=false;
  }).catch(()=>{/* Procedural collision-matched placeholders remain playable offline. */});
 }
 for(const item of arena.propsMeshes)if(item.prop.asset){const p=item.prop;asset("factory",p.asset,p.x,p.z,p.w,p.h,p.d,item.objects);}
 if(loadAssets)loader.loadAsync("./models/warehouse/factory/box-small.glb").then(gltf=>{
  for(const crate of crates){const model=gltf.scene.clone(true),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=.88/Math.max(size.x,size.y,size.z);model.scale.setScalar(scale);model.position.set(-center.x*scale,-center.y*scale,-center.z*scale);crate.geometry=new THREE.BufferGeometry();crate.add(model);}
 }).catch(()=>{});
 asset("factory","lever-single.glb",-9,9,.8,1.2,.8);
 asset("factory","hopper-square.glb",4.7,-18,1.5,2,1.8);
 for(const x of [-7,7])for(const z of [-9,3])asset("building","column.glb",x,z,.52,3.4,.52);
 asset("building","wall-doorway-wide-square.glb",0,15,4,3.4,.5);
 return {...arena,shutter,carried,
  updateRound(r,now,id,p){
   arena.updateTasks(r.tasks);shutter.position.y=now<r.gateUntil?4.2:1.3;shutterBlock.box.min.y=shutter.position.y-1.3;shutterBlock.box.max.y=shutter.position.y+1.3;
   for(const [i,c] of r.crates.entries()){
    const m=crates[i],s=crateLabels[i];m.visible=!c.owner&&!r.tasks.includes(2);s.visible=m.visible;m.position.set(c.x,.5,c.z);m.material.color.set(colors[c.symbol]);s.position.set(c.x,1.45,c.z);
    if(s.userData.symbol!==c.symbol){setLabel(s,symbolNames[c.symbol]);s.userData.symbol=c.symbol;}
   }
   fuse.visible=!r.fuse.owner&&!r.fuse.installed;fuse.position.set(map.STATIONS.fuse.x,1,map.STATIONS.fuse.z);
   const carrying=r.fuse.owner===id||r.crates.some(c=>c.owner===id);carried.visible=carrying&&!!p;if(p)carried.position.set(p.x,1.2,p.z+.7);
  }
 };
}
