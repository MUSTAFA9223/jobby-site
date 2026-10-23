import * as THREE from "three";
import {ROOMS,WALLS,PROPS,TASKS,EXITS,HIDES} from "./house-layout.js";

export function buildHouse(scene){
 const mats=new Map(),unit=new THREE.BoxGeometry(1,1,1),blocks=[];
 const mat=color=>{if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.82}));return mats.get(color);};
 function box(x,y,z,w,h,d,color,shadow=true){const m=new THREE.Mesh(unit,mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=shadow;m.receiveShadow=true;scene.add(m);return m;}
 function solid(b){blocks.push({...b,box:new THREE.Box3(new THREE.Vector3(b.x-b.w/2,-.1,b.z-b.d/2),new THREE.Vector3(b.x+b.w/2,b.h,b.z+b.d/2))});}
 function disk(x,z,r,color,y=.06){const m=new THREE.Mesh(new THREE.CircleGeometry(r,32),mat(color));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);scene.add(m);return m;}
 function text(value,x,z,color="#fff",size=3,y=.08){
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
  const c=canvas.getContext("2d");c.fillStyle=color;c.font="900 46px system-ui";c.textAlign="center";c.fillText(value,256,84,490);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(size,size/4),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));
  mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);scene.add(mesh);return mesh;
 }
 box(0,-.14,0,56,.25,56,"#4c8179",false);
 // Warm floor colors and a clear open ceiling keep mobile camera views readable.
 for(const room of ROOMS){
  box(room.x,-.015,room.z,room.w,.13,room.d,room.color,false);
  for(let z=room.z-room.d/2+1;z<room.z+room.d/2;z+=1.5)box(room.x,.054,z,room.w,.012,.035,"#ffffff",false);
  text(room.name,room.x,room.z+3.7,"#ffffff",5.3);
 }
 box(0,.015,20,4,.1,12,"#d4c4a6",false);
 box(24.3,.015,10,4,.1,4,"#b4b8c0",false);
 box(-15,.015,-24,4,.1,5,"#b7c99b",false);
 for(const wall of WALLS){
  box(wall.x,wall.h/2,wall.z,wall.w,wall.h,wall.d,wall.color);
  box(wall.x,wall.h,wall.z,wall.w+.04,.12,wall.d+.04,"#fff1df",false);solid(wall);
 }
 for(const p of PROPS){
  solid(p);const {x,z,w,d,h,kind}=p;
  if(kind==="table"||kind==="desk"||kind==="workbench"){
   box(x,h,z,w,.18,d,"#855b4d");
   for(const a of [-1,1])for(const b of [-1,1])box(x+a*(w/2-.2),h/2,z+b*(d/2-.2),.18,h,.18,"#544454");
   if(kind==="desk")box(x,.99,z,1.2,.12,.7,"#eacb77");
   if(kind==="table"){box(x,h+.18,z,.9,.25,.8,"#deb47c");for(const a of [-1,1])box(x+a*.8,h+.13,z,.45,.07,.45,"#fff2d1");}
  }else if(kind==="sofa"){
   box(x,.43,z,w,.72,d,"#565e91");box(x,.95,z-d*.3,w,.7,d*.3,"#7478ab");
   for(const a of [-1,1])box(x+a*(w/2-.2),.72,z,.4,.7,d,"#7478ab");
  }else if(kind==="bed"){
   box(x,.25,z,w,.5,d,"#775968");box(x,.63,z,w,.35,d,"#f4dfc2");box(x,.86,z+.6,w+.05,.12,d*.62,"#8276b2");box(x,.9,z-d*.3,w*.76,.2,.7,"#fff0da");
  }else if(kind==="shelf"){
   box(x,.12,z,w,.24,d,"#80564c");box(x,h/2,z+d/2-.12,w,h,.2,"#80564c");
   for(let y=.65;y<h;y+=.65){box(x,y,z,w,.12,d,"#ad8363");for(let a=-1;a<=1;a++)box(x,y+.22,z+a*d*.27,w*.6,.38,.35,["#deb376","#779b94","#b9808b"][a+1]);}
  }else if(kind==="wardrobe"){
   box(x,h/2,z,w,h,d,"#886579");box(x+w/2+.015,1.2,z,.06,h*.9,d*.94,"#ac8ba5");
   for(const a of [-1,1])box(x+w/2+.06,1.2,z+a*.2,.08,.22,.07,"#ffe39d");
  }else if(kind==="washer"){
   box(x,h/2,z,w,h,d,"#d2e6e4");const m=new THREE.Mesh(new THREE.TorusGeometry(.47,.12,8,24),mat("#566e82"));m.position.set(x,h*.5,z-d/2-.02);scene.add(m);
  }else if(kind==="fridge"){
   box(x,h/2,z,w,h,d,"#d2e6e4");box(x,1.3,z-d/2-.04,w*.9,.05,.08,"#78968d");box(x+.45,.75,z-d/2-.1,.1,.6,.1,"#566e82");
  }else if(kind==="car"){
   box(x,.65,z,w*.9,.9,d,"#d78c77");box(x,1.35,z-.25,w*.78,.8,d*.5,"#526d84");
   for(const a of [-1,1])for(const b of [-1,1]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,.3,12),mat("#344052"));wheel.rotation.z=Math.PI/2;wheel.position.set(x+a*w*.47,.43,z+b*d*.32);scene.add(wheel);}
  }else{
   const color=kind==="hedge"?"#467767":kind==="crate"?"#a87d52":"#638f88";
   box(x,h/2,z,w,h,d,color);if(kind==="counter"||kind==="island")box(x,h,z,w+.12,.16,d+.12,"#e5dac1");
   if(kind==="crate"){box(x,h/2,z-d/2-.02,w,.13,.06,"#d4aa75");box(x,h/2,z-d/2-.05,.13,h,.07,"#d4aa75");}
  }
 }
 // Simple garden beds, stepping stones and trees without extra asset downloads.
 for(const x of [-24,24])for(const z of [-24,22]){
  box(x,.6,z,.4,1.2,.4,"#8a6658");
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.2,0),mat("#73a885"));crown.position.set(x,2,z);scene.add(crown);
 }
 const collectibles=TASKS.map((task,index)=>{
  const group=new THREE.Group(),m=new THREE.Mesh(new THREE.OctahedronGeometry(.35),mat(task.color));group.add(m);group.position.set(task.x,1.1,task.z);scene.add(group);
  disk(task.x,task.z,.8,task.color);text(["KEY","POWER","TOOLS"][index],task.x,task.z+.9,task.color,2);
  return {x:task.x,z:task.z,group,taken:false};
 });
 const exits=EXITS.map(exit=>{
  const material=new THREE.MeshStandardMaterial({color:"#c56f80",emissive:"#8b2f46",emissiveIntensity:.3,transparent:true,opacity:.64,side:THREE.DoubleSide});
  const gate=new THREE.Mesh(new THREE.PlaneGeometry(3.6,2.8),material);gate.position.set(exit.x,1.45,exit.z);if(exit.task===1)gate.rotation.y=Math.PI/2;scene.add(gate);
  disk(exit.x,exit.z,1.45,exit.color);text(exit.name,exit.x,exit.z-1.8,exit.color,4);
  return {gate,material};
 });
 for(const h of HIDES){disk(h.x,h.z,.65,"#748fbd");text("HIDE",h.x,h.z+.75,"#d7e7ff",1.6);}
 const guard=new THREE.Group();
 function part(geometry,color,x,y,z){const m=new THREE.Mesh(geometry,mat(color));m.position.set(x,y,z);m.castShadow=true;guard.add(m);return m;}
 part(new THREE.CapsuleGeometry(.42,.7,4,8),"#b95960",0,1.05,0);
 part(new THREE.SphereGeometry(.36,12,8),"#f0c29d",0,1.9,0);
 part(new THREE.CylinderGeometry(.44,.4,.3,12),"#fff3dc",0,2.27,0);
 for(const x of [-.24,0,.24])part(new THREE.SphereGeometry(.26,8,6),"#fff3dc",x,2.5,0);
 for(const x of [-.2,.2]){part(new THREE.BoxGeometry(.25,.55,.28),"#394459",x,.28,0);part(new THREE.SphereGeometry(.055,8,6),"#302d42",x*.6,1.95,.33);}
 const arms=[-.55,.55].map(x=>part(new THREE.CapsuleGeometry(.12,.5,3,6),"#f0c29d",x,1.2,0));
 const alert=part(new THREE.TorusGeometry(.65,.045,6,24),"#ffd369",0,.08,0);alert.rotation.x=Math.PI/2;
 scene.add(guard);
 return {blocks,collectibles,guard,
  updateTasks(tasks){for(const [i,c] of collectibles.entries()){c.taken=tasks.includes(i);c.group.visible=!c.taken;}for(const [i,e] of exits.entries()){const open=tasks.includes(EXITS[i].task);e.material.color.set(open?"#6fffc9":"#c56f80");e.material.emissive.set(open?"#33ad8c":"#8b2f46");e.material.opacity=open?.2:.64;}},
  animate(time,chasing){guard.position.y=Math.abs(Math.sin(time*(chasing?12:6)))*.07;for(const [i,arm] of arms.entries())arm.rotation.x=Math.sin(time*(chasing?12:6)+i*Math.PI)*.45;alert.material.color.set(chasing?"#ff7585":"#ffd369");},
 };
}
