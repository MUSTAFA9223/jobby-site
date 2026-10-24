import {saveSelection,beginPlayerRun,recordPlayerTask,finishPlayerRun,syncProfile} from "./player-profile.js?v=2";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { connectCoop } from "./multiplayer.js?v=7";
import * as rules from "./race-rules.js";
import {buildRace} from "./race-scene.js";
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
const persist=()=>{try{saveSelection(saved)}catch(e){}};
window.addEventListener("jobby-profile-change",()=>{try{saved={...saved,...JSON.parse(localStorage.getItem("jobby-world-v01")||"{}")};wallet()}catch{}});
const available = item => !item.cost || (Array.isArray(saved.unlocked)&&saved.unlocked.includes(item.id));
let chosen=AVATARS.find(a=>a.id===saved.selected&&available(a))?.id||"JOBBY",started=false,finished=false,loading=false;
let yaw=0,tilt=.5,cameraDistance=8.5,dragPointer=null,stickPointer=null,joyX=0,joyY=0,wantJump=false,heading=Math.PI;
let runner=rules.newRunner(),coop=null,race=null,serverOffset=0,roundStartedAt=0,slot=0,lastPush=-9,lastPoseTime=0,launching=false,loadedHero=false;
let px=runner.x,pz=runner.z,py=0;
let soloRunBegan=false,lastBonk=-5;
let avatar=null,mixer=null,clips={},currentClip="",currentRequested="";
const keysDown=new Set(),loader=new GLTFLoader();
const scene=new THREE.Scene();scene.background=new THREE.Color('#9ac8f4');scene.fog=new THREE.Fog('#9ac8f4',70,175);
const camera=new THREE.PerspectiveCamera(63,innerWidth/innerHeight,.1,220);
const lowPowerMobile=navigator.maxTouchPoints>0||Math.min(innerWidth,innerHeight)<700;
const renderer=new THREE.WebGLRenderer({antialias:!lowPowerMobile,powerPreference:'default'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,lowPowerMobile?1.15:1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x7983b2,2.5));const sunlight=new THREE.DirectionalLight(0xfff5de,2.6);sunlight.position.set(-12,40,15);scene.add(sunlight);
const arena=buildRace(scene),playerGroup=new THREE.Group();scene.add(playerGroup);
function setStatus(s){$('loadStatus').textContent=s;}
function wallet(){$('walletHud').textContent=saved.points;}
function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2300);}
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

const elapsed=()=>Math.max(0,((isCoop?Date.now()+serverOffset:performance.now())-roundStartedAt)/1000);
function position(){px=runner.x;pz=runner.z;py=runner.y;playerGroup.position.set(px,py,pz);playerGroup.rotation.y=heading;}
function standings(){
 const entries=race?.entries||[];const ordered=[...entries].sort((a,b)=>(a.rank||99)-(b.rank||99)||b.checkpoint-a.checkpoint||a.z-b.z);
 $('raceList').replaceChildren();for(const [i,p] of ordered.entries()){const row=document.createElement('p');row.textContent=(race?.challenge?'TEAM '+race.challenge.teams[p.id]+' · ':'')+(p.rank?'#'+p.rank:'•')+' '+p.name+' · '+(p.finishAt?((p.finishAt-race.started)/1000).toFixed(1)+'s':p.checkpoint+'/3 CP');if(p.id===coop?.selfId())row.className='me';$('raceList').append(row);}
 if(race?.challenge){const c=race.challenge;const progress=t=>entries.filter(p=>c.teams[p.id]===t&&p.finishAt).length+'/'+entries.filter(p=>c.teams[p.id]===t).length;$('rankHud').textContent='A '+progress('A')+' · B '+progress('B');return;}
 const me=ordered.findIndex(p=>p.id===coop?.selfId());$('rankHud').textContent=isCoop?(me+1)+' / '+entries.length:'PRACTICE';
}
function applyRace(value){race=value;serverOffset=value.serverNow-Date.now();roundStartedAt=value.started;standings();
 if(value.challenge){const own=value.entries.find(p=>p.id===coop?.selfId());if(own?.finishAt||value.status==='finished')showChallengeResult();return;}
 const own=value.entries.find(p=>p.id===coop?.selfId());
 if(own?.finishAt){if(!finished)showResult(own.rank,(own.finishAt-value.started)/1000,80);void syncProfile();}
 if(value.status==='finished'&&!finished)showResult(0,elapsed(),0);
}
async function start(){if(loading||launching)return;launching=true;$('startButton').disabled=true;
 if(!loadedHero)loadedHero=await loadCharacter(chosen);launching=false;$('startButton').disabled=false;if(!loadedHero)return;
 finished=false;started=true;runner=rules.newRunner(slot);heading=Math.PI;lastPush=-9;joyX=joyY=0;
 if(isCoop){const own=race?.entries.find(p=>p.id===coop?.selfId());if(own){slot=own.slot;runner=rules.newRunner(slot,own.checkpoint);Object.assign(runner,{x:own.x,y:own.y,z:own.z,falls:own.falls});}if(own?.finishAt){if(race?.challenge)showChallengeResult();else showResult(own.rank,(own.finishAt-race.started)/1000,80);return;}}
 else{roundStartedAt=performance.now()+3000;soloRunBegan=false;}
 position();$('menu').classList.add('hidden');$('endoverlay').classList.add('hidden');$('controls').classList.remove('hidden');$('resultsToggle').classList.toggle('hidden',!isCoop);
}
function showChallengeResult(){
 const c=race?.challenge;if(!c)return;
 finished=true;started=false;runner.finished=true;joyX=joyY=0;
 $('controls').classList.add('hidden');$('endoverlay').classList.remove('hidden');
 const ownTeam=c.teams[coop?.selfId()],prize=c.payouts?.find(p=>p.id===coop?.selfId())?.points||0;
 $('endTitle').textContent=c.status==='paid'?(c.winner===ownTeam?'YOUR TEAM WINS!':'TEAM '+c.winner+' WINS'):c.status==='refunded'?'ENTRY POINTS REFUNDED':c.status==='settling'?'SAVING TEAM RESULT…':'WAITING FOR YOUR TEAM';
 $('endDetail').textContent=c.status==='paid'?(prize?'+'+prize+' points · The entire pool was split equally between the winning team.':'Your '+c.fee+'-point entry went to the winning team.'):c.status==='refunded'?'No team completed the challenge. Your '+c.fee+' entry points were returned.':'The first team with every player across the finish wins. Pool: '+c.pot+' points.';
 $('againButton').textContent='BACK TO PRIVATE ROOM';$('againButton').onclick=()=>location.href='./rooms.html?code='+roomCode;
 void syncProfile();
}
function showResult(rank,seconds,points){if(finished)return;finished=true;started=false;runner.finished=true;joyX=joyY=0;$('controls').classList.add('hidden');$('endoverlay').classList.remove('hidden');
 $('endTitle').textContent=rank?'FINISH #'+rank:points?'COURSE COMPLETE!':'ROUND OVER';
 $('endDetail').textContent=points?seconds.toFixed(1)+' seconds · '+runner.falls+' falls · +'+points+' points'+(isCoop?' · Saving your result…':' · Practice finish saved'):'Time is up. Your checkpoints helped you get closer — try another round!';
 if(isCoop){void syncProfile();$('againButton').textContent='BACK TO ROOM';$('againButton').onclick=()=>location.href='./rooms.html?code='+roomCode;}
}
function push(){if(!started||elapsed()<=0||elapsed()-lastPush<2.2)return;lastPush=elapsed();
 if(isCoop){coop?.action('race_push');toast('PUSH!');}else toast('PUSH! · Invite friends to bump other racers');
 playerGroup.rotation.z=.16;setTimeout(()=>playerGroup.rotation.z=0,150);
}
$('startButton').onclick=()=>void start();$('againButton').onclick=()=>void start();
$('menuButton').onclick=()=>location.href=isCoop?'./rooms.html?code='+roomCode:'./index.html?v=14';
$('charactersButton').onclick=()=>location.href='./index.html?v=14#characters';
$('push').onclick=push;$('respawn').onclick=()=>{if(!started)return;if(isCoop)coop?.action('race_fall');else{rules.respawn(runner,slot);position();toast('Back to your checkpoint');}};
$('resultsToggle').onclick=()=>$('racePanel').classList.toggle('hidden');
window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keysDown.add(e.key.toLowerCase());if(e.code==='Space')wantJump=true;if(e.code==='KeyE'&&!e.repeat)push();});
window.addEventListener('keyup',e=>keysDown.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keysDown.clear();joyX=joyY=0;wantJump=false;});
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
$("cameraReset").onclick=()=>{yaw=0;tilt=.4;cameraDistance=6.8;toast("Camera reset behind your hero")};
$("cameraZoom").onclick=()=>{cameraDistance=cameraDistance>7.5?4.4:cameraDistance<5.1?6.5:9.4;toast("Camera distance: "+cameraDistance.toFixed(1))};

const timer=new THREE.Clock();
function frame(){requestAnimationFrame(frame);const dt=Math.min(timer.getDelta(),.05),now=isCoop?Date.now()+serverOffset:performance.now(),t=elapsed();
 arena.update(t);
 const countdown=Math.ceil((roundStartedAt-now)/1000);
 $('countdown').textContent=started&&countdown>0?String(countdown):started&&t<.65?'GO!':'';
 if(started&&countdown<=0){
  if(!isCoop&&!soloRunBegan){soloRunBegan=true;beginPlayerRun(rules.MAP_ID);}
  const horizontal=Math.max(-1,Math.min(1,joyX+(keysDown.has('d')||keysDown.has('arrowright')?1:0)-(keysDown.has('a')||keysDown.has('arrowleft')?1:0)));
  const forward=Math.max(-1,Math.min(1,-joyY+(keysDown.has('w')||keysDown.has('arrowup')?1:0)-(keysDown.has('s')||keysDown.has('arrowdown')?1:0)));
  const x=Math.cos(yaw)*horizontal-Math.sin(yaw)*forward,z=-Math.sin(yaw)*horizontal-Math.cos(yaw)*forward;
  rules.stepRunner(runner,{x,z,jump:wantJump},dt,t,slot);wantJump=false;
  if(Math.hypot(x,z)>.1){const target=Math.atan2(x,z);heading+=Math.atan2(Math.sin(target-heading),Math.cos(target-heading))*Math.min(1,dt*12);}
  for(const e of runner.events){
   if(e.type==='fall'){if(isCoop)coop?.action('race_fall');toast('Whoops! Back to checkpoint '+runner.checkpoint);}
   if(e.type==='bonk'){lastBonk=t;toast('BONK!');}
   if(e.type==='checkpoint'){toast('CHECKPOINT '+e.index+'!');if(!isCoop){saved.points+=10;recordPlayerTask(e.index-1);wallet();}}
   if(e.type==='finish'&&!isCoop){saved.points+=50;finishPlayerRun();wallet();showResult(0,t,80);}
  }
  position();playerGroup.rotation.z=t-lastBonk<.7?Math.sin((t-lastBonk)*24)*.45:0;animate(!runner.grounded?'Jump':Math.hypot(x,z)>.1?'Run':'Idle');
 }
 if(isCoop&&(started||finished)&&performance.now()-lastPoseTime>110){lastPoseTime=performance.now();coop?.sendPose({x:runner.x,y:runner.y,z:runner.z,h:heading,anim:!runner.grounded?'Jump':currentClip||'Idle'});}
 if(started){const cp=runner.checkpoint;$('checkpointHud').textContent=cp+' / 3';$('stageName').textContent=rules.STAGES[cp];$('progressFill').style.width=Math.min(100,Math.max(0,(5-runner.z)/140*100))+'%';
 $('push').disabled=t-lastPush<2.2;$('push').textContent=t-lastPush<2.2?Math.ceil(2.2-t+lastPush):'✋';
 const remaining=Math.max(0,Math.ceil(180-t));$('clockHud').textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
 if(!isCoop&&remaining===0)showResult(0,t,0);
 }
 mixer?.update(dt);coop?.tick(dt);
 const focus=new THREE.Vector3(px,Math.max(-1,py)+1.1,pz),desired=new THREE.Vector3(px+Math.sin(yaw)*cameraDistance*Math.cos(tilt),focus.y+cameraDistance*Math.sin(tilt),pz+Math.cos(yaw)*cameraDistance*Math.cos(tilt));
 camera.position.lerp(desired,Math.min(1,dt*10));camera.lookAt(focus);renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
if(isCoop){const a=sessionStorage.getItem('jobby-world-room-avatar');if(AVATARS.some(x=>x.id===a))chosen=a;}
roster();wallet();$('selectedInfo').textContent='Selected hero: '+(AVATARS.find(a=>a.id===chosen)?.name||'JOBBY');$('voiceHud').classList.toggle('hidden',!isCoop);
if(isCoop){
 $('startButton').disabled=true;$('startButton').textContent='CONNECTING TO RACE…';
 const id=sessionStorage.getItem('jobby-world-room-peer')||'';
 if(!/^[a-zA-Z0-9_-]{12,64}$/.test(id)){$('loadStatus').textContent='Return to the lobby to join this race.';$('startButton').textContent='BACK TO ROOM';$('startButton').disabled=false;$('startButton').onclick=()=>location.href='./rooms.html?code='+roomCode;}
 else coop=connectCoop({code:roomCode,id,avatar:chosen,name:localStorage.getItem('jobby-world-display-name')||'Player',scene,getLocalPosition:()=>playerGroup.position,
 onWelcome:m=>{if(m.map!==rules.MAP_ID){location.replace('./rooms.html?code='+roomCode);return;}if(m.race)applyRace(m.race);if(m.status==='lobby')setStatus('Waiting for the host in the lobby…');},
 onStart:()=>{if(!started&&!finished)void start();},onKeys:()=>{},onComplete:()=>{},
 onRace:applyRace,
 onRaceEvent:m=>{
  if(m.type==='race_reset'&&m.id===coop?.selfId()){Object.assign(runner,rules.newRunner(slot,m.checkpoint),{x:m.x,y:m.y,z:m.z,falls:m.falls});position();}
  if(m.type==='race_shove'&&m.id===coop?.selfId()&&started){rules.impulse(runner,m.x,m.z,7);toast('You got pushed!');}
  if(m.type==='race_checkpoint'&&m.id===coop?.selfId())toast('CHECKPOINT '+m.index+' VERIFIED');
  if(m.type==='race_finish'&&m.id===coop?.selfId()){if(race?.challenge)toast('FINISHED! Waiting for your team…');else showResult(m.rank,m.seconds,m.points);}
 },onError:message=>{setStatus(message);toast(message);}});
}
window.addEventListener('pagehide',()=>coop?.close());frame();
if(!isCoop&&new URLSearchParams(location.search).has('autostart'))void start();
