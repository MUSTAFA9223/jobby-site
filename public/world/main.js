import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { connectCoop } from "./multiplayer.js";

// JOBBY WORLD v0.1. Game source in the JOBBY website repo;
// original user-owned glTF archive remains in JOBBY-3D-Viewer.
const $ = id => document.getElementById(id);
const roomCode=new URLSearchParams(location.search).get("room")||"";
const isCoop=/^[A-HJ-NP-Z2-9]{6}$/.test(roomCode);
const AVATARS = [
  {id:"JOBBY",name:"JOBBY 3D",icon:"✨",cost:0},
  {id:"Casual_Male",name:"Explorer",icon:"🧑",cost:0},
  {id:"Ninja_Male",name:"Ninja",icon:"🥷",cost:0},
  {id:"Pug",name:"Pug",icon:"🐶",cost:0},
  {id:"Wizard",name:"Wizard",icon:"🧙",cost:80},
  {id:"Pirate_Female",name:"Pirate",icon:"🏴‍☠️",cost:120}
];
const MODEL_BASE="./models/";
const JOBBY_MODEL="./models/JOBBY.glb";
const MODEL_SIZES={JOBBY:1941348,Casual_Male:1238384,Ninja_Male:1058660,Pug:1045324,Wizard:1260568,Pirate_Female:1413296};
let saved={points:0,unlocked:[],best:0,selected:"JOBBY"};
try {saved={...saved,...JSON.parse(localStorage.getItem("jobby-world-v01")||"{}")}}catch(e){}
const persist=()=>{try{localStorage.setItem("jobby-world-v01",JSON.stringify(saved))}catch(e){}};
const available = item => !item.cost || (Array.isArray(saved.unlocked)&&saved.unlocked.includes(item.id));
let chosen=AVATARS.find(a=>a.id===saved.selected&&available(a))?.id||"JOBBY", started=false, finished=false, count=0, loading=false, runHeld=false, wantJump=false, roundStartedAt=0;
let px=0,pz=9,py=0,vy=0,grounded=true,heading=Math.PI;
let yaw=0,tilt=.38,cameraDistance=7,dragPointer=null,lastDragX=0,lastDragY=0;
let stickPointer=null,joyX=0,joyY=0;
let coop=null,sharedKeys=[],launchingCoop=false,coopComplete=false;
if(isCoop){const a=sessionStorage.getItem("jobby-world-room-avatar");if(AVATARS.some(x=>x.id===a))chosen=a;}
let avatar=null,mixer=null,clips={},currentClip="",currentRequested="";
// JOBBY is again a playable prototype avatar, as requested by the owner.
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
const floor=new THREE.Mesh(new THREE.PlaneGeometry(56,56),material("#66559c"));
floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(56,28,0xa38ee8,0x7c65b6);grid.position.y=.012;scene.add(grid);
const blocks=[];
function block(x,z,w,d,h,color,solid=true){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x,h/2,z);
 m.castShadow=true;m.receiveShadow=true;scene.add(m);
 if(solid)blocks.push({x,z,w,d,h,mesh:m,box:new THREE.Box3(new THREE.Vector3(x-w/2-.12,-.1,z-d/2-.12),new THREE.Vector3(x+w/2+.12,h+.12,z+d/2+.12))});return m;
}
// Alpha 0.3: expanded grounds with a usable open-roof house.
// Perimeter leaves a gap at the far north EXIT gate.
block(-27.5,0,1,55,3.4,"#514079");block(27.5,0,1,55,3.4,"#514079");
block(0,27.5,55,1,3.4,"#514079");
block(-15.5,-27.5,24,1,3.4,"#514079");block(15.5,-27.5,24,1,3.4,"#514079");
const houseFloor=new THREE.Mesh(new THREE.BoxGeometry(13.3,.08,11.3),material("#b09bce"));
houseFloor.position.set(-16,.02,-13);houseFloor.receiveShadow=true;scene.add(houseFloor);
// House back, sides, and front with a central entrance (x=-18 to -14).
block(-16,-19,14,.65,3.4,"#bf7f89");block(-23,-13,.65,12,3.4,"#b17d9a");block(-9,-13,.65,12,3.4,"#b17d9a");
block(-20.5,-7,5,.65,3.4,"#d7a2a9");block(-11.5,-7,5,.65,3.4,"#d7a2a9");
// Dividing partition with an internal doorway; one key is at the back.
block(-20.75,-13,4.5,.55,2.6,"#876eaf");block(-11.25,-13,4.5,.55,2.6,"#876eaf");
block(-20,-9.5,2.3,1.2,.8,"#665389");block(-11.6,-15.6,2.3,1.4,.9,"#806199");
// Translucent roof is only a visual guide, so it cannot block the player.
const houseRoof=new THREE.Mesh(new THREE.BoxGeometry(14.6,.15,12.6),
 new THREE.MeshBasicMaterial({color:"#f2a4bd",transparent:true,opacity:.10,depthWrite:false,side:THREE.DoubleSide}));
houseRoof.position.set(-16,3.65,-13);scene.add(houseRoof);
const pathMat=material("#8271b5");
for(const [x,z,w,d] of [[0,16,4,18],[0,-3,4,15],[2,-19,5,11],[-8,8,14,3],[12,8,18,3]]){
 const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),pathMat);p.rotation.x=-Math.PI/2;p.position.set(x,.03,z);p.receiveShadow=true;scene.add(p);
}
[
 [-2,-1,5,1.3],[6,1,1.2,7],[-11,8,3,1.5],
 [14,-9,4.5,1.4],[8,-15,1.4,5],[-3,12,1.3,3],
 [21,-2,1.5,5],[15,17,3,1.3]
].forEach(([x,z,w,d])=>block(x,z,w,d,2.4,"#594783"));
const leafMat=new THREE.MeshLambertMaterial({color:"#57caa8"});
for(const [x,z] of [[-22,18],[-15,21],[22,18],[22,-18],[4,23],[-4,23]]){
 block(x,z,.48,.48,1.25,"#705074");
 const crown=new THREE.Mesh(new THREE.ConeGeometry(1.45,3,6),leafMat);
 crown.position.set(x,2.55,z);scene.add(crown);
}
const portalMaterial=new THREE.MeshStandardMaterial({color:0xff759e,emissive:0xff557e,emissiveIntensity:1.2,transparent:true,opacity:.8,side:THREE.DoubleSide});
const portal=new THREE.Mesh(new THREE.PlaneGeometry(5.1,3.1),portalMaterial);portal.position.set(0,1.7,-26.9);scene.add(portal);
block(-3.1,-26.9,.35,.8,3.5,"#bba7ff",false);block(3.1,-26.9,.35,.8,3.5,"#bba7ff",false);
const labelCanvas=document.createElement("canvas");labelCanvas.width=256;labelCanvas.height=80;
const labelContext=labelCanvas.getContext("2d");labelContext.fillStyle="#fff";labelContext.font="bold 51px sans-serif";labelContext.textAlign="center";labelContext.fillText("EXIT",128,57);
const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(labelCanvas)}));label.scale.set(3.4,1,1);label.position.set(0,4,-26.9);scene.add(label);
const playerGroup=new THREE.Group();scene.add(playerGroup);
const gemMat=new THREE.MeshStandardMaterial({color:"#ffe080",emissive:"#ffb940",emissiveIntensity:.45,metalness:.4});
const collectible=[[-20,-16],[19,14],[12,-20]].map(([x,z])=>{
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
  const price=document.createElement("span");price.className="price";price.textContent=available(a)?"FREE / OWNED":a.cost+" 🪙";
  b.append(logo,title,price);
  b.onclick=async()=>{
   if(!available(a)){
    if(saved.points<a.cost){toast("You need "+(a.cost-saved.points)+" more points");return}
    saved.points-=a.cost;saved.unlocked.push(a.id);persist();wallet();
   }
   chosen=a.id;saved.selected=chosen;persist();roster();$("selectedInfo").textContent="Selected hero: "+a.name;
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
 setStatus("Loading "+modelName+" only ("+(modelSize/1048576).toFixed(1)+" MB)…");
 try{
  // Individual self-contained GLB: no 21MB ZIP, no missing external glTF files.
  const gltf=await loader.loadAsync(id==="JOBBY"?JOBBY_MODEL:MODEL_BASE+encodeURIComponent(id)+".glb",event=>{
   if(id!==currentRequested)return;
   if(event.lengthComputable&&event.total>0){
    const ratio=Math.max(0,Math.min(1,event.loaded/event.total));
    $("barProgress").style.width=Math.round(7+ratio*78)+"%";
    setStatus("Loading "+modelName+": "+Math.round(ratio*100)+"%");
   }else if(event.loaded){
    const ratio=Math.min(.92,event.loaded/modelSize);
    $("barProgress").style.width=Math.round(7+ratio*78)+"%";
    setStatus("Loading "+modelName+": "+(event.loaded/1048576).toFixed(1)+" MB");
   }
  });
  if(id!==currentRequested)return false;
  $("barProgress").style.width="92%";
  setStatus("Preparing character and animations…");
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
  for(const clip of gltf.animations)clips[clip.name.split("|").pop()]=mixer.clipAction(clip);
  currentClip="";animate("Idle");
  loading=false;$("barProgress").style.width="100%";
  setStatus("Ready ✓ — "+modelName);
  return true;
 }catch(e){
  console.error("Character load failed:",id,e);
  loading=false;$("barProgress").style.width="0%";
  setStatus("Could not load "+modelName+". Check your connection and tap START to retry.");
  toast("Could not load character. Please try again.");return false;
 }
}
function animate(name){
 if(!mixer||!clips[name]||currentClip===name)return;
 const prev=clips[currentClip],next=clips[name];
 if(prev)prev.fadeOut(.16);
 next.reset().fadeIn(.16).play();currentClip=name;
}
function reset(){
 px=0;pz=18;py=0;vy=0;grounded=true;heading=Math.PI;count=0;finished=false;joyX=joyY=0;runHeld=false;wantJump=false;
 playerGroup.position.set(px,py,pz);playerGroup.rotation.y=heading;
 collectible.forEach(k=>{k.taken=false;k.group.visible=true});
 portalMaterial.color.set("#ff759e");portalMaterial.emissive.set("#ff557e");
 $("quest").innerHTML="Find <strong>3 keys</strong> to open the exit gate";wallet();
}
async function start(){
 if(loading)return;
 $("startButton").disabled=true;
 const loaded=await loadCharacter(chosen);$("startButton").disabled=false;
 if(!loaded)return;
 reset();roundStartedAt=performance.now();started=true;$("menu").classList.add("hidden");$("endoverlay").classList.add("hidden");$("controls").classList.remove("hidden");
}
function applySharedKeys(keys){
 sharedKeys=Array.isArray(keys)?keys.filter(i=>Number.isInteger(i)&&i>=0&&i<3):[];
 count=sharedKeys.length;
 collectible.forEach((k,index)=>{k.taken=sharedKeys.includes(index);k.group.visible=!k.taken});
 if(count===3){
  $("quest").innerHTML="<strong>GATE UNLOCKED</strong> — Escape together!";
  portalMaterial.color.set("#68ffd0");portalMaterial.emissive.set("#25d3ad");
 }else{
  $("quest").innerHTML="Team keys: <strong>"+count+" / 3</strong> — Explore together";
  portalMaterial.color.set("#ff759e");portalMaterial.emissive.set("#ff557e");
 }
 wallet();
}
async function launchCoop(){
 if(started||launchingCoop||coopComplete)return;
 launchingCoop=true;
 const loaded=await loadCharacter(chosen);launchingCoop=false;
 if(!loaded){$("menu").classList.remove("hidden");return}
 reset();applySharedKeys(sharedKeys);
 roundStartedAt=performance.now();started=true;
 $("menu").classList.add("hidden");$("endoverlay").classList.add("hidden");$("controls").classList.remove("hidden");
 toast("Connected! Collect 3 keys with your team.");
}
function finishCoop(){
 if(coopComplete)return;
 coopComplete=true;started=false;finished=true;
 $("controls").classList.add("hidden");$("endoverlay").classList.remove("hidden");
 $("endoverlay").querySelector(".endTitle").textContent="TEAM ESCAPED!";
 $("endoverlay").querySelector(".subtitle").textContent="Your squad collected all 3 keys and escaped. Co-op rewards are not enabled in this alpha.";
 $("againButton").textContent="BACK TO ROOM";
 $("againButton").onclick=()=>{location.href="./rooms.html?code="+roomCode};
 $("charactersButton").textContent="RETURN TO WORLD";
 toast("Co-op escape complete!");
}
function complete(){
 finished=true;started=false;saved.points+=50;saved.best=Math.max(saved.best,saved.points);
 try{
  const key="jobby-world-scores-v01";
  const old=JSON.parse(localStorage.getItem(key)||"[]");
  const entry={character:chosen,points:80,seconds:Math.max(1,(performance.now()-roundStartedAt)/1000),date:Date.now()};
  localStorage.setItem(key,JSON.stringify([entry,...(Array.isArray(old)?old:[])].slice(0,60)));
 }catch(e){}
 persist();wallet();$("controls").classList.add("hidden");$("endoverlay").classList.remove("hidden");toast("Escape complete! +50 bonus points (80 total this round).");
}
$("startButton").onclick=start;
$("againButton").onclick=()=>{reset();roundStartedAt=performance.now();started=true;$("endoverlay").classList.add("hidden");$("controls").classList.remove("hidden")};
$("charactersButton").onclick=()=>{location.href="./index.html?v=9#characters"};
$("menuButton").onclick=()=>{location.href="./index.html?v=9"};
const stick=$("stick"),knob=$("knob");
function onStick(e){
 const rect=stick.getBoundingClientRect();
 let x=(e.clientX-rect.left-rect.width/2)/(rect.width*.34);
 let y=(e.clientY-rect.top-rect.height/2)/(rect.height*.34);
 const length=Math.max(1,Math.hypot(x,y));joyX=x/length;joyY=y/length;
 const knobRadius=Math.max(32,stick.clientWidth/2-31);knob.style.transform="translate("+(joyX*knobRadius)+"px,"+(joyY*knobRadius)+"px)";
}
stick.addEventListener("pointerdown",e=>{stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);onStick(e)});
stick.addEventListener("pointermove",e=>{if(e.pointerId===stickPointer)onStick(e)});
function releaseStick(e){if(e.pointerId!==stickPointer)return;stickPointer=null;joyX=joyY=0;knob.style.transform=""}
stick.addEventListener("pointerup",releaseStick);stick.addEventListener("pointercancel",releaseStick);
$("run").addEventListener("pointerdown",e=>{runHeld=true;e.currentTarget.setPointerCapture(e.pointerId)});
$("run").addEventListener("pointerup",()=>runHeld=false);$("run").addEventListener("pointercancel",()=>runHeld=false);
$("jump").addEventListener("pointerdown",()=>wantJump=true);
// Full 360-degree camera rotation with pointer capture and two-finger pinch zoom.
const cameraTouches=new Map();
renderer.domElement.addEventListener("pointerdown",e=>{
 if(!started)return;
 renderer.domElement.setPointerCapture?.(e.pointerId);
 cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
 dragPointer=e.pointerId;
});
renderer.domElement.addEventListener("pointermove",e=>{
 const previous=cameraTouches.get(e.pointerId);
 if(!started||!previous)return;
 const dx=e.clientX-previous.x,dy=e.clientY-previous.y;
 if(cameraTouches.size===2){
  const p=[...cameraTouches.entries()].find(([id])=>id!==e.pointerId)?.[1];
  if(p){
   const prior=Math.hypot(previous.x-p.x,previous.y-p.y);
   const current=Math.hypot(e.clientX-p.x,e.clientY-p.y);
   cameraDistance=THREE.MathUtils.clamp(cameraDistance-(current-prior)*.035,3.6,10);
  }
 }else{
  yaw-=dx*.0085;
  tilt=THREE.MathUtils.clamp(tilt+dy*.0045,.08,1.16);
 }
 cameraTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
});
function endCameraTouch(e){cameraTouches.delete(e.pointerId);if(e.pointerId===dragPointer)dragPointer=null}
renderer.domElement.addEventListener("pointerup",endCameraTouch);
renderer.domElement.addEventListener("pointercancel",endCameraTouch);
renderer.domElement.addEventListener("lostpointercapture",endCameraTouch);
renderer.domElement.addEventListener("wheel",e=>{
 cameraDistance=THREE.MathUtils.clamp(cameraDistance+Math.sign(e.deltaY)*.65,3.6,10);e.preventDefault()
},{passive:false});
$("cameraReset").onclick=()=>{yaw=heading-Math.PI;tilt=.4;cameraDistance=6.8;toast("Camera reset behind your hero")};
$("cameraZoom").onclick=()=>{cameraDistance=cameraDistance>7.5?4.4:cameraDistance<5.1?6.5:9.4;toast("Camera distance: "+cameraDistance.toFixed(1))};
$("mapToggle").onclick=()=>{$("miniMap").classList.toggle("hidden")};
const mini=$("miniMap"),mapContext=mini.getContext("2d");
let nextMapPaint=0;
function paintMinimap(time){
 if(mini.classList.contains("hidden")||time<nextMapPaint)return;
 nextMapPaint=time+.18;
 const c=mapContext,s=180/56;
 c.clearRect(0,0,180,180);c.fillStyle="#171c3e";c.fillRect(0,0,180,180);
 c.fillStyle="#ae8b9e";c.fillRect(5*s,9*s,14*s,12*s);
 c.fillStyle="#594783";
 for(const b of blocks)c.fillRect((b.x-b.w/2+28)*s,(b.z-b.d/2+28)*s,b.w*s,b.d*s);
 c.fillStyle="#ffe080";
 for(const k of collectible){if(!k.taken){c.beginPath();c.arc((k.x+28)*s,(k.z+28)*s,4,0,Math.PI*2);c.fill()}}
 c.fillStyle="#63ffcc";c.fillRect(28*s-7,1,14,5);
 c.fillStyle="#ffffff";c.beginPath();c.arc((px+28)*s,(pz+28)*s,5,0,Math.PI*2);c.fill();
 c.strokeStyle="#ffffff";c.lineWidth=2;c.beginPath();
 c.moveTo((px+28)*s,(pz+28)*s);
 c.lineTo((px+28)*s+Math.sin(heading)*12,(pz+28)*s+Math.cos(heading)*12);c.stroke();
}
// Alpha 0.7: When a solid obstacle crosses the line of sight,
// fade it instead of swinging the camera in front of the player.
// This keeps the entire avatar visible close to house and maze walls.
const fadedWalls=new Set();
function clearFadedWalls(){
  for(const mesh of fadedWalls){
    mesh.material.transparent=false;
    mesh.material.opacity=1;
    mesh.material.depthWrite=true;
  }
  fadedWalls.clear();
}
function safeCamera(origin,target){
  const segment=target.clone().sub(origin);
  const distance=segment.length();
  if(distance<.001)return target.clone();
  const ray=new THREE.Ray(origin,segment.multiplyScalar(1/distance));
  for(const b of blocks){
    const hit=ray.intersectBox(b.box,new THREE.Vector3());
    if(!hit || hit.distanceTo(origin)>distance)continue;
    b.mesh.material.transparent=true;
    b.mesh.material.opacity=.12;
    b.mesh.material.depthWrite=false;
    fadedWalls.add(b.mesh);
  }
  return target.clone();
}
window.addEventListener("keydown",e=>{keysDown.add(e.key.toLowerCase());if(e.code==="Space")wantJump=true});
window.addEventListener("keyup",e=>keysDown.delete(e.key.toLowerCase()));
function collision(x,z){
 const radius=.33;if(Math.abs(x)>26.5-radius||Math.abs(z)>26.5-radius)return true;
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
  for(const [index,k] of collectible.entries()){
   if(!k.taken&&Math.hypot(px-k.x,pz-k.z)<1.1){
    if(isCoop){coop?.sendKey(index)}
    else{
     k.taken=true;k.group.visible=false;count++;saved.points+=10;persist();wallet();
     toast("Key collected! +10 points");
     if(count===3){$("quest").innerHTML="<strong>GATE UNLOCKED</strong> — Reach the exit!";portalMaterial.color.set("#68ffd0");portalMaterial.emissive.set("#25d3ad")}
    }
   }
  }
  if(count===3&&pz < -24.8&&Math.abs(px)<3.1){
   if(isCoop)coop?.tryFinish();else complete();
  }
  if(isCoop)coop?.sendPose({x:px,z:pz,y:py,h:heading,anim:!grounded?"Jump":length<.07?"Idle":fast?"Run":"Walk"});
 }
 if(mixer)mixer.update(delta);
 coop?.tick(delta);
 const lookAt=new THREE.Vector3(px,py+1.3,pz);
 const desired=new THREE.Vector3(px+Math.sin(yaw)*cameraDistance*Math.cos(tilt),py+1.3+cameraDistance*Math.sin(tilt),pz+Math.cos(yaw)*cameraDistance*Math.cos(tilt));
 clearFadedWalls();
 const safeTarget=safeCamera(lookAt,desired);
 camera.position.lerp(safeTarget,Math.min(1,delta*10));
 camera.position.copy(safeCamera(lookAt,camera.position));
 camera.lookAt(lookAt);paintMinimap(time);
 collectible.forEach((k,i)=>{k.group.rotation.y+=delta;k.group.position.y=1.6+Math.sin(time*2+i*2)*.15});
 portalMaterial.emissiveIntensity=1.2+Math.sin(time*2)*.25;
 renderer.render(scene,camera);
}
window.addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
roster();wallet();$("selectedInfo").textContent="Selected hero: "+(AVATARS.find(a=>a.id===chosen)?.name||"JOBBY");
if(isCoop){
 $("startButton").disabled=true;
 $("startButton").textContent="CONNECTING TO CO-OP ROOM…";
 $("menu").querySelector(".subtitle").textContent="Joining private team room "+roomCode+"…";
 $("menuButton").onclick=()=>{location.href="./rooms.html?code="+roomCode};
 const peerId=sessionStorage.getItem("jobby-world-room-peer")||"";
 if(!/^[a-zA-Z0-9_-]{12,64}$/.test(peerId)){
  $("menu").querySelector(".subtitle").textContent="Your room session expired. Return to the room lobby.";
  $("startButton").textContent="BACK TO ROOM";$("startButton").disabled=false;
  $("startButton").onclick=()=>{location.href="./rooms.html?code="+roomCode};
 }else{
  const playerName=localStorage.getItem("jobby-world-display-name")||"Player";
  coop=connectCoop({
   code:roomCode,id:peerId,avatar:chosen,name:playerName,scene,
   onWelcome:m=>{if(m.status==="lobby")setStatus("Waiting for host to start…")},
   onStart:()=>{void launchCoop()},
   onKeys:keys=>{sharedKeys=keys;if(started)applySharedKeys(keys)},
   onComplete:()=>finishCoop(),
   onError:message=>{setStatus(message);toast(message)}
  });
 }
}
frame();
if(!isCoop&&new URLSearchParams(location.search).has("autostart"))start();
