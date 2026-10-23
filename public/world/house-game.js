import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { connectCoop } from "./multiplayer.js?v=4";
import { safeCameraPosition } from "./camera-occlusion.js?v=2";
import * as house from "./house-layout.js";
import {buildHouse} from "./house-scene.js";

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
let coop=null,sharedTasks=[],launchingCoop=false,coopComplete=false;
let spawnPoint={...house.SPAWN};
let tasks=[],hidden=false,taskProgress=null,guard=house.newGuard(),guardTarget={...guard},guardTime=0,safeUntil=0;
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
const arena=buildHouse(scene),blocks=arena.blocks,collectible=arena.collectibles;
const playerGroup=new THREE.Group();scene.add(playerGroup);
arena.guard.position.set(guard.x,0,guard.z);
function setStatus(s){$("loadStatus").textContent=s}
function wallet(){$("walletHud").textContent=saved.points;$("keysHud").textContent=tasks.length+" / 3"}
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
function cancelTask(){
 if(taskProgress&&isCoop)coop?.action("task_cancel");taskProgress=null;
 $("interact").style.setProperty("--charge","0%");
}
function reset(){
 px=spawnPoint.x;pz=spawnPoint.z;py=0;vy=0;grounded=true;heading=Math.PI;count=0;finished=false;joyX=joyY=0;runHeld=false;wantJump=false;
 tasks=[];hidden=false;safeUntil=performance.now()+8000;cancelTask();
 if(!isCoop){guard=house.newGuard();guardTarget={...guard};}
 playerGroup.visible=true;playerGroup.position.set(px,py,pz);playerGroup.rotation.y=heading;
 arena.updateTasks(tasks);refreshTasks();wallet();
}
function refreshTasks(){
 arena.updateTasks(tasks);
 $("quest").textContent=hidden?"HIDDEN — the chef cannot see you":tasks.length?"Exit ready! Follow its colored marker on the map":"Open any exit: find a key, fix power, or take tools";
 $("taskList").replaceChildren();
 for(const [i,t] of house.TASKS.entries()){
  const row=document.createElement("p");row.textContent=(tasks.includes(i)?"✓ ":"○ ")+t.name+" · "+t.room+" → "+house.EXITS[i].name;row.style.color=tasks.includes(i)?"#75ffcc":t.color;$("taskList").append(row);
 }
 wallet();
}
function applySharedTasks(values){
 sharedTasks=Array.isArray(values)?values.filter(i=>Number.isInteger(i)&&house.TASKS[i]):[];tasks=[...sharedTasks];
 if(taskProgress&&tasks.includes(taskProgress.index))cancelTask();refreshTasks();
}
function taskNear(){return hidden?-1:house.TASKS.findIndex((t,i)=>!tasks.includes(i)&&house.near({x:px,z:pz},t,1));}
function interact(){
 if(!started)return;
 if(hidden){if(isCoop)coop?.action("hide",undefined,false);else{hidden=false;playerGroup.visible=true;safeUntil=performance.now()+900;refreshTasks();}return;}
 const index=taskNear();
 if(index>=0){taskProgress={index,start:performance.now(),sent:false};if(isCoop)coop?.action("task_start",index);return;}
 if(house.hideAt({x:px,z:pz},.6)>=0&&grounded){
  if(isCoop)coop?.action("hide",undefined,true);else{hidden=true;playerGroup.visible=false;refreshTasks();}
 }
}
const interaction=$("interact");
interaction.onpointerdown=e=>{e.preventDefault();interaction.setPointerCapture?.(e.pointerId);interact();};
interaction.onpointerup=interaction.onpointercancel=interaction.onlostpointercapture=()=>cancelTask();
window.addEventListener("blur",()=>{cancelTask();keysDown.clear();runHeld=false;joyX=joyY=0;});
$("tasksToggle").onclick=()=>$("taskPanel").classList.toggle("hidden");
function updateInteraction(now){
 if(taskProgress){
  const t=house.TASKS[taskProgress.index];
  if(!house.near({x:px,z:pz},t)||hidden||!grounded){cancelTask();return;}
  const amount=Math.min(1,(now-taskProgress.start)/house.TASK_MS);interaction.style.setProperty("--charge",(amount*100)+"%");
  interaction.textContent=amount===1?"FINISHING…":"HOLD · "+Math.round(amount*100)+"%";
  if(amount===1&&!taskProgress.sent){
   taskProgress.sent=true;
   if(isCoop)coop?.action("task_finish",taskProgress.index);
   else{tasks.push(taskProgress.index);saved.points+=10;persist();cancelTask();refreshTasks();toast("Task complete! Exit unlocked. +10 points");}
  }else if(now-taskProgress.start>4000){cancelTask();toast("Task was interrupted. Hold again to retry.");}
 }else{
  const index=taskNear(),canHide=house.hideAt({x:px,z:pz},.6)>=0;
  interaction.disabled=!hidden&&index<0&&!canHide;
  interaction.textContent=hidden?"LEAVE HIDING":index>=0?"HOLD: "+house.TASKS[index].action:canHide?"HIDE HERE":"FIND A TASK / HIDE SPOT";
 }
}
function caught(){
 hidden=false;cancelTask();px=house.SPAWN.x;pz=house.SPAWN.z;py=0;vy=0;grounded=true;
 playerGroup.visible=true;playerGroup.position.set(px,0,pz);safeUntil=performance.now()+6000;
 refreshTasks();toast("The chef caught you! Back to the yard — tasks stay completed.");
}
async function start(){
 if(loading)return;
 $("startButton").disabled=true;
 const loaded=await loadCharacter(chosen);$("startButton").disabled=false;
 if(!loaded)return;
 reset();roundStartedAt=performance.now();started=true;$("menu").classList.add("hidden");$("endoverlay").classList.add("hidden");$("controls").classList.remove("hidden");
}
async function launchCoop(){
 if(started||launchingCoop||coopComplete)return;
 launchingCoop=true;
 const loaded=await loadCharacter(chosen);launchingCoop=false;if(coopComplete)return;
 if(!loaded){$("menu").classList.remove("hidden");return}
 reset();applySharedTasks(sharedTasks);
 roundStartedAt=performance.now();started=true;
 $("menu").classList.add("hidden");$("endoverlay").classList.add("hidden");$("controls").classList.remove("hidden");
 toast("Connected! Complete a task and escape through any open exit.");
}
function finishCoop(result={}){
 if(coopComplete)return;
 coopComplete=true;started=false;finished=true;
 $("controls").classList.add("hidden");$("endoverlay").classList.remove("hidden");
 $("endoverlay").querySelector(".endTitle").textContent="TEAM ESCAPED!";
 $("endoverlay").querySelector(".subtitle").textContent="Your squad escaped through "+(result.exit||"an open exit")+"! Co-op rewards are not enabled in this alpha.";
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
  const entry={character:chosen,map:house.MAP_ID,points:50+tasks.length*10,seconds:Math.max(1,(performance.now()-roundStartedAt)/1000),date:Date.now()};
  localStorage.setItem(key,JSON.stringify([entry,...(Array.isArray(old)?old:[])].slice(0,60)));
 }catch(e){}
 persist();wallet();$("controls").classList.add("hidden");$("endoverlay").classList.remove("hidden");$("endoverlay").querySelector(".subtitle").textContent="You escaped the Big House! +50 escape points, plus "+(tasks.length*10)+" task points.";toast("Escape complete! +50 bonus points.");
}
$("startButton").onclick=start;
$("againButton").onclick=()=>{reset();roundStartedAt=performance.now();started=true;$("endoverlay").classList.add("hidden");$("controls").classList.remove("hidden")};
$("charactersButton").onclick=()=>{location.href="./index.html?v=11#characters"};
$("menuButton").onclick=()=>{location.href="./index.html?v=12"};
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
 if(mini.classList.contains("hidden")||time<nextMapPaint)return;nextMapPaint=time+.18;
 const c=mapContext,s=180/56;c.fillStyle="#345d58";c.fillRect(0,0,180,180);
 for(const r of house.ROOMS){c.fillStyle=r.color;c.fillRect((r.x-r.w/2+28)*s,(r.z-r.d/2+28)*s,r.w*s,r.d*s);}
 c.fillStyle="#453e54";for(const b of blocks)c.fillRect((b.x-b.w/2+28)*s,(b.z-b.d/2+28)*s,b.w*s,b.d*s);
 function dot(x,z,color,r){c.fillStyle=color;c.beginPath();c.arc((x+28)*s,(z+28)*s,r,0,Math.PI*2);c.fill();}
 for(const [i,t] of house.TASKS.entries())if(!tasks.includes(i))dot(t.x,t.z,t.color,3.5);
 for(const e of house.EXITS){c.fillStyle=tasks.includes(e.task)?"#66ffd1":"#c66f80";c.fillRect((e.x+28)*s-4,(e.z+28)*s-4,8,8);}
 for(const h of house.HIDES)dot(h.x,h.z,"#a6c5ff",2);
 dot(arena.guard.position.x,arena.guard.position.z,"#ff6178",4);dot(px,pz,"#fff",4);
}
// Walls remain fully opaque. Resolve both the goal and the interpolated camera
// against padded wall bounds so orbit smoothing cannot pass through buildings.
window.addEventListener("keydown",e=>{keysDown.add(e.key.toLowerCase());if(e.code==="Space")wantJump=true;if(e.code==="KeyE"&&!e.repeat)interact()});
window.addEventListener("keyup",e=>{keysDown.delete(e.key.toLowerCase());if(e.code==="KeyE")cancelTask();});
function collision(x,z){return house.blocked(x,z,.33);}
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
  if(length>.07&&!hidden){
   const nx=px+dx*speed*delta,nz=pz+dz*speed*delta;
   if(!collision(nx,pz))px=nx;
   if(!collision(px,nz))pz=nz;
   const target=Math.atan2(dx,dz),diff=((target-heading+Math.PI*3)%(Math.PI*2))-Math.PI;
   heading+=diff*Math.min(1,delta*11);
  }
  if(wantJump&&grounded&&!hidden){vy=7.2;grounded=false}wantJump=false;
  if(!grounded){vy-=18*delta;py+=vy*delta;if(py<=0){py=0;vy=0;grounded=true}}
  playerGroup.position.set(px,py,pz);playerGroup.rotation.y=heading;
  animate(!grounded?"Jump":length<.07?"Idle":fast?"Run":"Walk");
  updateInteraction(performance.now());
  if(!isCoop){
   guardTime+=delta;
   if(guardTime>=.1){
    const hit=house.advanceGuard(guard,[{id:"solo",x:px,z:pz,hidden,safeUntil}],guardTime,performance.now());guardTime=0;guardTarget={...guard};if(hit.length)caught();
   }
  }
  const escaped=house.exitAt({x:px,z:pz},tasks);
  if(escaped>=0&&!hidden){if(isCoop)coop?.tryFinish();else complete();}
  if(isCoop)coop?.sendPose({x:px,z:pz,y:py,h:heading,anim:!grounded?"Jump":length<.07?"Idle":fast?"Run":"Walk"});
 }
 if(mixer)mixer.update(delta);
 arena.guard.position.x=THREE.MathUtils.lerp(arena.guard.position.x,guardTarget.x,Math.min(1,delta*13));
 arena.guard.position.z=THREE.MathUtils.lerp(arena.guard.position.z,guardTarget.z,Math.min(1,delta*13));arena.guard.rotation.y=guardTarget.h;
 arena.animate(time,guardTarget.mode==="chase");
 $("guardStatus").textContent=hidden?"HIDDEN · Stay quiet":guardTarget.mode==="chase"?"THE CHEF IS CHASING!":"CHEF ON PATROL · Hold RUN to outrun him";
 $("guardStatus").classList.toggle("danger",guardTarget.mode==="chase"&&!hidden);
 coop?.tick(delta);
 const lookAt=new THREE.Vector3(px,py+1.3,pz);
 const desired=new THREE.Vector3(px+Math.sin(yaw)*cameraDistance*Math.cos(tilt),py+1.3+cameraDistance*Math.sin(tilt),pz+Math.cos(yaw)*cameraDistance*Math.cos(tilt));
 const goal=safeCameraPosition(lookAt,desired,blocks);
 camera.position.lerp(new THREE.Vector3(goal.x,goal.y,goal.z),Math.min(1,delta*10));
 const safe=safeCameraPosition(lookAt,camera.position,blocks);
 camera.position.set(safe.x,safe.y,safe.z);
 camera.lookAt(lookAt);paintMinimap(time);
 collectible.forEach((k,i)=>{k.group.rotation.y+=delta;k.group.position.y=1.6+Math.sin(time*2+i*2)*.15});

 renderer.render(scene,camera);
}
window.addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
roster();wallet();$("selectedInfo").textContent="Selected hero: "+(AVATARS.find(a=>a.id===chosen)?.name||"JOBBY");
$("voiceHud").classList.toggle("hidden",!isCoop);
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
   code:roomCode,id:peerId,avatar:chosen,name:playerName,scene,getLocalPosition:()=>playerGroup.position,
   onWelcome:m=>{const self=m.players?.find(p=>p.id===m.selfId);if(self)spawnPoint={x:self.x,z:self.z};if(m.map!==house.MAP_ID){location.replace("./play.html?room="+roomCode);return;}if(m.status==="lobby")setStatus("Waiting for host to start…")},
   onStart:()=>{void launchCoop()},
   onKeys:()=>{},
   onTasks:values=>{sharedTasks=values;if(started)applySharedTasks(values);},
   onGuard:value=>{guardTarget=value;},
   onHide:m=>{if(m.id===coop?.selfId()){hidden=m.hidden;playerGroup.visible=!hidden;cancelTask();refreshTasks();}},
   onCaught:m=>{if(m.id===coop?.selfId())caught();},
   onComplete:m=>finishCoop(m),
   onError:message=>{setStatus(message);toast(message)}
  });
 }
}
window.addEventListener("pagehide",()=>coop?.close());
frame();
if(!isCoop&&new URLSearchParams(location.search).has("autostart"))start();
