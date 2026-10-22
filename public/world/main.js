import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// JOBBY WORLD v0.1. Game source in the JOBBY website repo;
// original user-owned glTF archive remains in JOBBY-3D-Viewer.
const $ = id => document.getElementById(id);
const AVATARS = [
  {id:"Casual_Male",name:"Explorer",icon:"🧑",cost:0},
  {id:"Ninja_Male",name:"Ninja",icon:"🥷",cost:0},
  {id:"Pug",name:"Pug",icon:"🐶",cost:0},
  {id:"Wizard",name:"Wizard",icon:"🧙",cost:80},
  {id:"Pirate_Female",name:"Pirate",icon:"🏴‍☠️",cost:120}
];
const MODEL_BASE="./models/";
const MODEL_SIZES={Casual_Male:1238384,Ninja_Male:1058660,Pug:1045324,Wizard:1260568,Pirate_Female:1413296};
let saved={points:0,unlocked:[],best:0};
try {saved={...saved,...JSON.parse(localStorage.getItem("jobby-world-v01")||"{}")}}catch(e){}
const persist=()=>{try{localStorage.setItem("jobby-world-v01",JSON.stringify(saved))}catch(e){}};
const available = item => !item.cost || saved.unlocked.includes(item.id);
let chosen=AVATARS[0].id, started=false, finished=false, count=0, loading=false, runHeld=false, wantJump=false;
let px=0,pz=9,py=0,vy=0,grounded=true,heading=Math.PI;
let yaw=0,tilt=.43,dragPointer=null,lastDragX=0,lastDragY=0;
let stickPointer=null,joyX=0,joyY=0;
let avatar=null,mixer=null,clips={},currentClip="",currentRequested="";
const keysDown=new Set(),loader=new GLTFLoader();
const scene=new THREE.Scene();scene.background=new THREE.Color("#161a38");scene.fog=new THREE.FogExp2("#161a38",.017);
const camera=new THREE.PerspectiveCamera(63,innerWidth/innerHeight,.1,120);
const lowPowerMobile=(navigator.maxTouchPoints>0 || Math.min(innerWidth,innerHeight)<700);
const renderer=new THREE.WebGLRenderer({antialias:!lowPowerMobile,powerPreference:"default"});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,lowPowerMobile?1.15:1.5));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.25;document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xc4d6ff,0x443472,2.5));
const sunlight=new THREE.DirectionalLight(0xffe0b7,3.2);sunlight.position.set(-6,13,-8);
sunlight.castShadow=true;sunlight.shadow.mapSize.set(lowPowerMobile?512:1024,lowPowerMobile?512:1024);
sunlight.shadow.camera.left=-25;sunlight.shadow.camera.right=25;sunlight.shadow.camera.top=25;sunlight.shadow.camera.bottom=-25;sunlight.shadow.normalBias=.05;scene.add(sunlight);
const material=c=>new THREE.MeshStandardMaterial({color:c,roughness:.85});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(36,36),material("#66559c"));
floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(36,18,0xa38ee8,0x7c65b6);grid.position.y=.012;scene.add(grid);
const blocks=[];
function block(x,z,w,d,h,color,solid=true){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x,h/2,z);
 m.castShadow=true;m.receiveShadow=true;scene.add(m);
 if(solid)blocks.push({x,z,w,d});return m;
}
block(-17.5,0,1,35,3.5,"#514079");block(17.5,0,1,35,3.5,"#514079");
block(0,17.5,35,1,3.5,"#514079");
block(-10.25,-17.5,14.5,1,3.5,"#514079");block(10.25,-17.5,14.5,1,3.5,"#514079");
[
 [-5,-4,5,1.6], [5,2,1.6,7],[-10,5,3.2,1.5],
 [9,-8,3.7,1.7],[-1,11,1.5,3],[0,-11,4.5,1.4],
 [-11,-11,1.5,2],[10,11,1.8,3]
].forEach(a=>block(a[0],a[1],a[2],a[3],2.7,"#594783"));
const portalMaterial=new THREE.MeshStandardMaterial({color:0xff759e,emissive:0xff557e,emissiveIntensity:1.2,transparent:true,opacity:.8,side:THREE.DoubleSide});
const portal=new THREE.Mesh(new THREE.PlaneGeometry(5.1,3.1),portalMaterial);portal.position.set(0,1.7,-16.9);scene.add(portal);
block(-2.8,-16.9,.35,.8,3.5,"#bba7ff",false);block(2.8,-16.9,.35,.8,3.5,"#bba7ff",false);
const labelCanvas=document.createElement("canvas");labelCanvas.width=256;labelCanvas.height=80;
const labelContext=labelCanvas.getContext("2d");labelContext.fillStyle="#fff";labelContext.font="bold 51px sans-serif";labelContext.textAlign="center";labelContext.fillText("EXIT",128,57);
const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(labelCanvas)}));label.scale.set(3.4,1,1);label.position.set(0,4,-16.9);scene.add(label);
const playerGroup=new THREE.Group();scene.add(playerGroup);
const gemMat=new THREE.MeshStandardMaterial({color:"#ffe080",emissive:"#ffb940",emissiveIntensity:.45,metalness:.4});
const collectible=[[-12,-9],[12,8],[-12,12]].map(([x,z])=>{
 const group=new THREE.Group();
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.32,.09,8,18),gemMat);ring.position.y=.1;group.add(ring);
 const stick=new THREE.Mesh(new THREE.BoxGeometry(.13,.62,.13),gemMat);stick.position.y=-.26;group.add(stick);
 const tooth=new THREE.Mesh(new THREE.BoxGeometry(.32,.12,.12),gemMat);tooth.position.set(.1,-.48,0);group.add(tooth);
 group.position.set(x,1.6,z);scene.add(group);return {x,z,group,taken:false};
});
function setStatus(s){$("loadStatus").textContent=s}
function wallet(){$("walletHud").textContent=saved.points;$("keysHud").textContent=count+" / 3"}
function toast(s){const t=$("toast");t.textContent=s;t.style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.opacity=0,2500)}
function roster(){
 $("avatars").replaceChildren();
 for(const a of AVATARS){
  const b=document.createElement("button");
  b.className="avatar"+(chosen===a.id?" selected":"")+(available(a)?"":" locked");b.type="button";
  const title=document.createElement("small");title.textContent=a.name;
  const logo=document.createElement("span");logo.className="head";logo.textContent=available(a)?a.icon:"🔒";
  const price=document.createElement("span");price.className="price";price.textContent=available(a)?"متاح":a.cost+" 🪙";
  b.append(logo,title,price);
  b.onclick=async()=>{
   if(!available(a)){
    if(saved.points<a.cost){toast("تحتاج "+(a.cost-saved.points)+" نقطة إضافية");return}
    saved.points-=a.cost;saved.unlocked.push(a.id);persist();wallet();
   }
   chosen=a.id;roster();$("selectedInfo").textContent="الشخصية المختارة: "+a.name;
   if(started)await loadCharacter(chosen);
  };
  $("avatars").append(b);
 }
}
async function loadCharacter(id){
 loading=true;currentRequested=id;
 const modelSize=MODEL_SIZES[id]||1200000;
 const modelName=AVATARS.find(a=>a.id===id)?.name||id;
 $("barProgress").style.width="5%";
 setStatus("جار تحميل "+modelName+" فقط ("+(modelSize/1048576).toFixed(1)+" MB)…");
 try{
  // Individual self-contained GLB: no 21MB ZIP, no missing external glTF files.
  const gltf=await loader.loadAsync(MODEL_BASE+encodeURIComponent(id)+".glb",event=>{
   if(id!==currentRequested)return;
   if(event.lengthComputable&&event.total>0){
    const ratio=Math.max(0,Math.min(1,event.loaded/event.total));
    $("barProgress").style.width=Math.round(7+ratio*78)+"%";
    setStatus("تحميل "+modelName+": "+Math.round(ratio*100)+"%");
   }else if(event.loaded){
    const ratio=Math.min(.92,event.loaded/modelSize);
    $("barProgress").style.width=Math.round(7+ratio*78)+"%";
    setStatus("تحميل "+modelName+": "+(event.loaded/1048576).toFixed(1)+" MB");
   }
  });
  if(id!==currentRequested)return false;
  $("barProgress").style.width="92%";
  setStatus("تحضير الشخصية والحركات…");
  if(avatar){
   playerGroup.remove(avatar);
   avatar.traverse(node=>{
    if(node.isMesh){
     node.geometry?.dispose();
     const mats=Array.isArray(node.material)?node.material:[node.material];
     for(const mat of mats){
      if(!mat)continue;
      mat.map?.dispose();mat.normalMap?.dispose();mat.dispose();
     }
    }
   });
  }
  if(mixer)mixer.stopAllAction();
  avatar=gltf.scene;
  avatar.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=false;if(n.isSkinnedMesh)n.frustumCulled=false}});
  const bbox=new THREE.Box3().setFromObject(avatar);
  const size=bbox.getSize(new THREE.Vector3());
  const scale=1.75/Math.max(.01,size.y);
  avatar.scale.setScalar(scale);avatar.position.y=-bbox.min.y*scale;
  playerGroup.add(avatar);
  mixer=new THREE.AnimationMixer(avatar);clips={};
  for(const clip of gltf.animations)clips[clip.name]=mixer.clipAction(clip);
  currentClip="";animate("Idle");
  loading=false;$("barProgress").style.width="100%";
  setStatus("جاهزة ✓ — "+modelName);
  return true;
 }catch(e){
  console.error("Character load failed:",id,e);
  loading=false;$("barProgress").style.width="0%";
  setStatus("تعذر تحميل "+modelName+" — تحقق من الإنترنت واضغط ابدأ للمحاولة مجددًا");
  toast("تعذر تحميل الشخصية. جرّب مرة أخرى");return false;
 }
}
function animate(name){
 if(!mixer||!clips[name]||currentClip===name)return;
 const prev=clips[currentClip],next=clips[name];
 if(prev)prev.fadeOut(.16);
 next.reset().fadeIn(.16).play();currentClip=name;
}
function reset(){
 px=0;pz=9;py=0;vy=0;grounded=true;heading=Math.PI;count=0;finished=false;joyX=joyY=0;
 playerGroup.position.set(px,py,pz);playerGroup.rotation.y=heading;
 collectible.forEach(k=>{k.taken=false;k.group.visible=true});
 portalMaterial.color.set("#ff759e");portalMaterial.emissive.set("#ff557e");
 $("quest").innerHTML="ابحث عن <strong>3 مفاتيح</strong> وافتح باب الخروج";wallet();
}
async function start(){
 if(loading)return;
 $("startButton").disabled=true;
 const loaded=await loadCharacter(chosen);$("startButton").disabled=false;
 if(!loaded)return;
 reset();started=true;$("menu").classList.add("hidden");$("endoverlay").classList.add("hidden");$("controls").classList.remove("hidden");
}
function complete(){
 finished=true;started=false;saved.points+=50;saved.best=Math.max(saved.best,saved.points);
 persist();wallet();$("controls").classList.add("hidden");$("endoverlay").classList.remove("hidden");toast("فزت بـ 50 نقطة!");
}
$("startButton").onclick=start;
$("againButton").onclick=()=>{reset();started=true;$("endoverlay").classList.add("hidden");$("controls").classList.remove("hidden")};
$("charactersButton").onclick=()=>{started=false;$("endoverlay").classList.add("hidden");$("controls").classList.add("hidden");$("menu").classList.remove("hidden");roster()};
$("menuButton").onclick=()=>{started=false;$("menu").classList.remove("hidden");$("controls").classList.add("hidden");roster()};
const stick=$("stick"),knob=$("knob");
function onStick(e){
 const rect=stick.getBoundingClientRect();
 let x=(e.clientX-rect.left-rect.width/2)/(rect.width*.34);
 let y=(e.clientY-rect.top-rect.height/2)/(rect.height*.34);
 const length=Math.max(1,Math.hypot(x,y));joyX=x/length;joyY=y/length;
 knob.style.transform="translate("+(joyX*32)+"px,"+(joyY*32)+"px)";
}
stick.addEventListener("pointerdown",e=>{stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);onStick(e)});
stick.addEventListener("pointermove",e=>{if(e.pointerId===stickPointer)onStick(e)});
function releaseStick(e){if(e.pointerId!==stickPointer)return;stickPointer=null;joyX=joyY=0;knob.style.transform=""}
stick.addEventListener("pointerup",releaseStick);stick.addEventListener("pointercancel",releaseStick);
$("run").addEventListener("pointerdown",e=>{runHeld=true;e.currentTarget.setPointerCapture(e.pointerId)});
$("run").addEventListener("pointerup",()=>runHeld=false);$("run").addEventListener("pointercancel",()=>runHeld=false);
$("jump").addEventListener("pointerdown",()=>wantJump=true);
renderer.domElement.addEventListener("pointerdown",e=>{dragPointer=e.pointerId;lastDragX=e.clientX;lastDragY=e.clientY});
renderer.domElement.addEventListener("pointermove",e=>{
 if(e.pointerId!==dragPointer||!started)return;
 yaw-= (e.clientX-lastDragX)*.006;
 tilt=THREE.MathUtils.clamp(tilt+(e.clientY-lastDragY)*.003,.17,.95);
 lastDragX=e.clientX;lastDragY=e.clientY;
});
window.addEventListener("pointerup",e=>{if(e.pointerId===dragPointer)dragPointer=null});
window.addEventListener("keydown",e=>{keysDown.add(e.key.toLowerCase());if(e.code==="Space")wantJump=true});
window.addEventListener("keyup",e=>keysDown.delete(e.key.toLowerCase()));
function collision(x,z){
 const radius=.33;if(Math.abs(x)>16.5-radius||Math.abs(z)>16.5-radius)return true;
 return blocks.some(b=>Math.abs(x-b.x)<b.w/2+radius&&Math.abs(z-b.z)<b.d/2+radius);
}
const timer=new THREE.Clock();
function frame(){
 requestAnimationFrame(frame);const delta=Math.min(timer.getDelta(),.04),time=timer.elapsedTime;
 if(started){
  const horizontal=THREE.MathUtils.clamp(joyX+(keysDown.has("d")?1:0)-(keysDown.has("a")?1:0),-1,1);
  const forward=THREE.MathUtils.clamp(-joyY+(keysDown.has("w")?1:0)-(keysDown.has("s")?1:0),-1,1);
  let dx=Math.cos(yaw)*horizontal-Math.sin(yaw)*forward;
  let dz=-Math.sin(yaw)*horizontal-Math.cos(yaw)*forward;
  const length=Math.hypot(dx,dz);
  if(length>1){dx/=length;dz/=length}
  const fast=runHeld||keysDown.has("shift"),speed=fast?6.8:4.1;
  if(length>.07){
   const nx=px+dx*speed*delta,nz=pz+dz*speed*delta;
   if(!collision(nx,pz))px=nx;
   if(!collision(px,nz))pz=nz;
   const target=Math.atan2(dx,dz),diff=((target-heading+Math.PI*3)%(Math.PI*2))-Math.PI;
   heading+=diff*Math.min(1,delta*11);
  }
  if(wantJump&&grounded){vy=7.2;grounded=false}wantJump=false;
  if(!grounded){vy-=18*delta;py+=vy*delta;if(py<=0){py=0;vy=0;grounded=true}}
  playerGroup.position.set(px,py,pz);playerGroup.rotation.y=heading;
  animate(!grounded?"Jump":length<.07?"Idle":fast?"Run":"Walk");
  for(const k of collectible){
   if(!k.taken&&Math.hypot(px-k.x,pz-k.z)<1.1){
    k.taken=true;k.group.visible=false;count++;saved.points+=10;persist();wallet();
    toast("مفتاح جديد! +10 نقاط");
    if(count===3){$("quest").innerHTML="<strong>البوابة مفتوحة</strong> — اذهب للخروج";portalMaterial.color.set("#68ffd0");portalMaterial.emissive.set("#25d3ad")}
   }
  }
  if(count===3&&pz < -14.8&&Math.abs(px)<3.2)complete();
 }
 if(mixer)mixer.update(delta);
 const lookAt=new THREE.Vector3(px,py+1.3,pz);
 const desired=new THREE.Vector3(px+Math.sin(yaw)*7*Math.cos(tilt),py+1.3+7*Math.sin(tilt),pz+Math.cos(yaw)*7*Math.cos(tilt));
 camera.position.lerp(desired,Math.min(1,delta*7));camera.lookAt(lookAt);
 collectible.forEach((k,i)=>{k.group.rotation.y+=delta;k.group.position.y=1.6+Math.sin(time*2+i*2)*.15});
 portalMaterial.emissiveIntensity=1.2+Math.sin(time*2)*.25;
 renderer.render(scene,camera);
}
window.addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
roster();wallet();$("selectedInfo").textContent="الشخصية المختارة: Explorer";frame();
