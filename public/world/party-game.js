import {saveSelection,beginPlayerRun,recordPlayerTask,finishPlayerRun,syncProfile} from './player-profile.js?v=4';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {connectCoop} from './multiplayer.js?v=8';
import {createWallCamera} from './castle-motion.js?v=1';
import * as rules from './party-rules.js';
import * as map from './castle-layout.js';
import {buildParty} from './party-scene.js';
import {createReplay} from './party-replay.js';
const $=id=>document.getElementById(id),roomCode=new URLSearchParams(location.search).get('room')||'',isCoop=/^[A-HJ-NP-Z2-9]{6}$/.test(roomCode);
const AVATARS=[{id:'JOBBY',name:'JOBBY',cost:0},{id:'Casual_Male',name:'Explorer',cost:0},{id:'Ninja_Male',name:'Ninja',cost:0},{id:'Pug',name:'Pug',cost:0},{id:'Wizard',name:'Wizard',cost:80},{id:'Pirate_Female',name:'Pirate',cost:120}];
let saved={points:0,selected:'JOBBY',unlocked:[]};try{saved={...saved,...JSON.parse(localStorage.getItem('jobby-world-v01')||'{}')};}catch{}
if(!Array.isArray(saved.unlocked))saved.unlocked=[];
const owned=a=>!a.cost||saved.unlocked.includes(a.id);let chosen=AVATARS.find(a=>a.id===saved.selected&&owned(a))?.id||'JOBBY';
if(isCoop){const roomAvatar=sessionStorage.getItem('jobby-world-room-avatar');if(AVATARS.some(a=>a.id===roomAvatar&&owned(a)))chosen=roomAvatar;}
let coop=null,round=rules.newRound(Date.now()>>>0,performance.now(),[{id:'solo',name:'You',team:'A'}],true),started=false,finished=false,loading=false,avatar=null,mixer=null,clips={},clipName='',animations=[],serverOffset=0;
let px=-20,pz=21,py=0,vy=0,heading=Math.PI,yaw=0,tilt=.42,distance=7,joyX=0,joyY=0,runHeld=false,wantJump=false,grounded=true,lastUi=0,lastTick=0;
const heroModels=new Map();
const keys=new Set(),loader=new GLTFLoader(),scene=new THREE.Scene();scene.background=new THREE.Color('#9ebdb3');scene.fog=new THREE.Fog('#9ebdb3',85,185);
const camera=new THREE.PerspectiveCamera(63,innerWidth/innerHeight,.1,190),wallCamera=createWallCamera();
const mobile=navigator.maxTouchPoints>0||innerWidth<700,renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:'default'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.15:1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xeaf6ff,0x676a4d,2.5));const sun=new THREE.DirectionalLight(0xffe2b0,2.7);sun.position.set(-8,16,8);scene.add(sun);
const arena=buildParty(scene),playerGroup=new THREE.Group();scene.add(playerGroup);const id=()=>isCoop?coop?.selfId():'solo',now=()=>isCoop?Date.now()+serverOffset:performance.now(),self=()=>round.actors[id()];
const replay=createReplay(scene,{avatarFor:actorId=>actorId===id()?{group:playerGroup,animations}:coop?.avatarFor(actorId),guard:arena.guard,onStop:()=>{$('replayStop').classList.add('hidden');$('endoverlay').classList.remove('hidden');}});
function toast(message){$('toast').textContent=message;$('toast').style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.opacity=0,3200);}
function wallet(){$('walletHud').textContent=saved.points;}
window.addEventListener('jobby-profile-change',()=>{try{saved={...saved,...JSON.parse(localStorage.getItem('jobby-world-v01')||'{}')};wallet();}catch{}});
function roster(){
 $('avatars').replaceChildren();for(const a of AVATARS){const b=document.createElement('button');b.className='avatar'+(a.id===chosen?' selected':'');b.disabled=loading||isCoop;b.textContent=a.name+(owned(a)?'':' 🔒 '+a.cost);b.onclick=async()=>{if(!owned(a)){toast('Unlock this hero in WORLD → CHARACTERS.');return;}chosen=a.id;saved.selected=a.id;saveSelection(saved);roster();if(avatar)await loadCharacter();};$('avatars').append(b);}
 $('selectedInfo').textContent='Selected hero: '+AVATARS.find(a=>a.id===chosen).name;
}
async function loadCharacter(){
 if(loading)return false;loading=true;roster();$('barProgress').style.width='10%';$('loadStatus').textContent='Loading '+chosen+'…';
 try{
  if(!heroModels.has(chosen))heroModels.set(chosen,loader.loadAsync('./models/'+chosen+'.glb').catch(e=>{heroModels.delete(chosen);throw e;}));
  const gltf=await heroModels.get(chosen);mixer?.stopAllAction();if(avatar){playerGroup.remove(avatar);const skeletons=new Set();avatar.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});for(const skeleton of skeletons)skeleton.dispose();}avatar=cloneSkeleton(gltf.scene);animations=gltf.animations;
  const bounds=new THREE.Box3().setFromObject(avatar),size=bounds.getSize(new THREE.Vector3()),scale=1.75/Math.max(.01,size.y);avatar.scale.setScalar(scale);avatar.position.y=-bounds.min.y*scale;
  avatar.traverse(o=>{if(o.isSkinnedMesh)o.frustumCulled=false;});playerGroup.add(avatar);mixer=new THREE.AnimationMixer(avatar);clips={};for(const c of animations)clips[c.name.split('|').pop()]=mixer.clipAction(c);clipName='';
  $('barProgress').style.width='100%';$('loadStatus').textContent='READY';return true;
 }catch(e){console.error(e);$('loadStatus').textContent='Could not load this hero. Tap to retry.';$('startButton').disabled=false;$('startButton').textContent='RETRY LOADING HERO';return false;}finally{loading=false;roster();}
}
function animate(name){if(!clips[name]||name===clipName)return;clips[clipName]?.fadeOut(.16);clips[name].reset().fadeIn(.16).play();clipName=name;}
function resetPosition(){const p=self();if(p){px=p.x;pz=p.z;py=p.y||0;heading=p.h||Math.PI;vy=0;grounded=py===0;}}
async function start(){
 if(loading)return;if(!avatar&&!await loadCharacter())return;
 replay.stop();if(!isCoop){round=rules.newRound(Date.now()>>>0,performance.now()+3000,[{id:'solo',name:'You',team:'A',avatar:chosen}],true);round.guard=map.newGuard();lastTick=now();beginPlayerRun(rules.MAP_ID);}
 if(!self())return;resetPosition();finished=false;started=true;joyX=joyY=0;runHeld=false;wantJump=false;
 $('menu').classList.add('hidden');$('endoverlay').classList.add('hidden');$('controls').classList.remove('hidden');$('voiceHud').classList.toggle('hidden',!isCoop);
 if(round.finished)endRound();
}
function showNote(result){
 if(result.error||result.note)toast(result.error||result.note);
 if(result.private){$('puzzleText').textContent=result.note;$('symbolButtons').classList.add('hidden');$('puzzlePanel').classList.remove('hidden');}
 if(result.panel){$('puzzleText').textContent=result.note;$('symbolButtons').classList.remove('hidden');$('puzzlePanel').classList.remove('hidden');}
}
function action(action){
 if(!started||now()<round.started)return;
 if(isCoop)coop?.partyAction(action);else{const result=rules.applyAction(round,'solo',action,now());if(result.milestone===0)recordPlayerTask(0);showNote(result);if(result.complete)endRound();}
}
function endRound(){
 if(finished)return;finished=true;started=false;joyX=joyY=0;runHeld=false;keys.clear();
 for(const el of ['controls','potionPanel','signalPanel','puzzlePanel','taskPanel'])$(el).classList.add('hidden');$('endoverlay').classList.remove('hidden');
 const team=self()?.team,c=round.challenge,prize=c?.payouts?.find(p=>p.id===id())?.points;
 $('endTitle').textContent=round.winner?(round.winner===team?'YOUR TEAM WINS!':'TEAM '+round.winner+' WINS'):'TIME IS UP';
 if(!isCoop&&round.winner){recordPlayerTask(1);recordPlayerTask(2);finishPlayerRun();}
 $('endDetail').textContent=!isCoop?(round.winner?'Practice complete · 80 free game points.':'Practice again to try another route.'):c?.status==='paid'?(prize?'+'+prize+' points · Winning team split the entire pool.':'The winning team split the entire '+c.pot+'-point pool.'):c?.status==='refunded'?'All entry points were refunded.':'Saving the challenge result…';
 $('highlightList').replaceChildren();for(const award of round.highlights?.awards||[]){const row=document.createElement('p');row.textContent='🏅 '+award.title+' · '+award.name;$('highlightList').append(row);}
 $('watchReplay').disabled=!round.highlights?.clip?.frames?.length||!avatar;
 $('againButton').textContent=isCoop?'BACK TO PRIVATE ROOM':'PLAY AGAIN';void syncProfile();
}
function snapshot(value){
 const oldFinished=finished;round=value;serverOffset=value.serverNow-Date.now();
 if(round.finished){if(oldFinished)finished=false;endRound();}
}
$('startButton').onclick=()=>void start();$('againButton').onclick=()=>isCoop?location.href='./rooms.html?code='+roomCode:void start();
$('homeButton').onclick=()=>location.href='./index.html?v=17';$('menuButton').onclick=()=>location.href=isCoop?'./rooms.html?code='+roomCode:'./index.html?v=17';
$('interact').onclick=()=>{const current=rules.actionAt(round,id(),now());if(current)action(current);};$('passButton').onclick=()=>action({type:'pass'});
function togglePanel(id){const wasHidden=$(id).classList.contains('hidden');for(const panel of ['potionPanel','signalPanel','puzzlePanel','taskPanel'])$(panel).classList.add('hidden');if(wasHidden)$(id).classList.remove('hidden');}
$('potionsButton').onclick=()=>togglePanel('potionPanel');$('signalsButton').onclick=()=>togglePanel('signalPanel');
$('closePotions').onclick=()=>$('potionPanel').classList.add('hidden');$('closeSignals').onclick=()=>$('signalPanel').classList.add('hidden');$('closePuzzle').onclick=()=>$('puzzlePanel').classList.add('hidden');$('helpButton').onclick=()=>togglePanel('taskPanel');
const potionButtons={};for(const potion of rules.POTIONS){const b=document.createElement('button');b.onclick=()=>{action({type:'potion',potion});$('potionPanel').classList.add('hidden');};potionButtons[potion]=b;$('potionChoices').append(b);}
for(const [index,text] of [...rules.SYMBOLS,'HELP!','COME HERE','PASS TO ME'].entries()){const b=document.createElement('button');b.textContent=text;b.onclick=()=>action({type:'signal',index});$('signalChoices').append(b);}
for(const [symbol,text] of rules.SYMBOLS.entries()){const b=document.createElement('button');b.textContent=text;b.onclick=()=>action({type:'echo_symbol',symbol});$('symbolButtons').append(b);}
$('watchReplay').onclick=()=>{if(replay.start(round.highlights?.clip)){$('endoverlay').classList.add('hidden');$('replayStop').classList.remove('hidden');}else toast('Replay is unavailable for this moment.');};$('replayStop').onclick=()=>replay.stop();
// Independent captured pointers let the joystick, jump and camera work together.
let stickId=null;const stick=$('stick'),knob=$('knob');function setStick(e){const b=stick.getBoundingClientRect(),x=(e.clientX-b.left-b.width/2)/(b.width*.34),y=(e.clientY-b.top-b.height/2)/(b.height*.34),n=Math.max(1,Math.hypot(x,y));joyX=x/n;joyY=y/n;knob.style.transform='translate('+joyX*b.width*.3+'px,'+joyY*b.height*.3+'px)';}
stick.addEventListener('pointerdown',e=>{stickId=e.pointerId;stick.setPointerCapture(e.pointerId);setStick(e);});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)setStick(e);});const release=e=>{if(e.pointerId===stickId){stickId=null;joyX=joyY=0;knob.style.transform='';}};for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,release);
$('jump').addEventListener('pointerdown',()=>wantJump=true);$('run').addEventListener('pointerdown',e=>{runHeld=true;$('run').setPointerCapture(e.pointerId);});for(const type of ['pointerup','pointercancel','lostpointercapture'])$('run').addEventListener(type,()=>runHeld=false);
window.addEventListener('keydown',e=>{keys.add(e.key.toLowerCase());if(e.code==='Space'){wantJump=true;e.preventDefault();}if(e.code==='KeyE'&&!e.repeat)$('interact').click();});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();joyX=joyY=0;runHeld=false;wantJump=false;});
const touches=new Map();renderer.domElement.addEventListener('pointerdown',e=>{renderer.domElement.setPointerCapture(e.pointerId);touches.set(e.pointerId,{x:e.clientX,y:e.clientY});});renderer.domElement.addEventListener('pointermove',e=>{const old=touches.get(e.pointerId);if(!old)return;const other=[...touches.entries()].find(([key])=>key!==e.pointerId)?.[1];if(other)distance=THREE.MathUtils.clamp(distance-(Math.hypot(e.clientX-other.x,e.clientY-other.y)-Math.hypot(old.x-other.x,old.y-other.y))*.035,3.6,10);else{yaw-=(e.clientX-old.x)*.0085;tilt=THREE.MathUtils.clamp(tilt+(e.clientY-old.y)*.0045,.08,1.2);}touches.set(e.pointerId,{x:e.clientX,y:e.clientY});});for(const type of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(type,e=>touches.delete(e.pointerId));
$('cameraReset').onclick=()=>{yaw=heading-Math.PI;tilt=.42;distance=7;};$('cameraZoom').onclick=()=>distance=distance>8?4.5:distance<5?6.5:9;
function paintUi(time){
 const p=self();if(!p)return;const remaining=Math.max(0,Math.ceil((round.deadline-time)/1000)),shift=60-Math.floor(Math.max(0,time-round.started)/1000)%60;
 $('roundClock').textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');$('teamHud').textContent=(isCoop?'TEAM '+p.team:'SOLO PRACTICE');
 const crown=round.crown.owner&&round.actors[round.crown.owner],where=crown?'CROWN: '+crown.name:'CROWN AT THE CENTRAL ALTAR';$('quest').textContent=shift<=6?'⚠ GATES CHANGE IN '+shift+'s · Clear the openings':where+' · HOME '+p.team+' · SHIFT '+shift+'s';
 const kind=rules.effect(round,id(),time),carried=round.crown.owner===id()?'👑 CROWN':round.bag.owner===id()?'🎒 CURSED BAG':'HANDS FREE';$('inventory').textContent=carried+(kind==='normal'?'':' · '+kind.toUpperCase());
 const current=rules.actionAt(round,id(),time);$('interact').disabled=!current;$('interact').textContent=current?.label||'EXPLORE / FIND THE CROWN';
 $('passButton').disabled=round.crown.owner!==id()&&round.bag.owner!==id();
 for(const potion of rules.POTIONS){const amount=round.stocks[id()]?.[potion]||0;potionButtons[potion].textContent=potion.toUpperCase()+' · '+amount;potionButtons[potion].disabled=!amount||time<(round.cooldowns[id()]||0);}
 $('signalLog').textContent=round.signals.filter(s=>time-s.at<4500).slice(-3).map(s=>(round.actors[s.id]?.name||'Player')+': '+s.text).join('\n');
 $('guardStatus').textContent=round.bag.owner===id()?'CURSED BAG IS MAKING NOISE':round.guard?.mode==='chase'?'GUARDIAN IS CHASING!':'GUARDIAN ON PATROL';
}
const timer=new THREE.Clock();function frame(){
 requestAnimationFrame(frame);const dt=Math.min(timer.getDelta(),.04),time=now(),p=self();
 if(started&&p&&time>=round.started){
  const horizontal=THREE.MathUtils.clamp(joyX+(keys.has('d')?1:0)-(keys.has('a')?1:0),-1,1),forward=THREE.MathUtils.clamp(-joyY+(keys.has('w')?1:0)-(keys.has('s')?1:0),-1,1),len=Math.max(1,Math.hypot(horizontal,forward));
  const dx=(Math.cos(yaw)*horizontal-Math.sin(yaw)*forward)/len,dz=(-Math.sin(yaw)*horizontal-Math.cos(yaw)*forward)/len,run=runHeld||keys.has('shift'),speed=rules.speed(round,id(),time,run);
  if(!p.hidden){const next=rules.move(round,id(),px,pz,dx*speed*dt,dz*speed*dt,time),mx=next.x-px,mz=next.z-pz;px=next.x;pz=next.z;if(Math.hypot(mx,mz)>.001){const target=Math.atan2(mx,mz);heading+=Math.atan2(Math.sin(target-heading),Math.cos(target-heading))*(1-Math.exp(-11*dt));}}
  if(wantJump&&grounded&&!p.hidden){vy=rules.effect(round,id(),time)==='jelly'?10.5:7.2;grounded=false;}wantJump=false;
  if(!grounded){vy-=18*dt;py+=vy*dt;if(py<=0){py=0;grounded=true;vy=0;}}
  const moving=Math.hypot(dx,dz)>.07&&!p.hidden;Object.assign(p,{x:px,z:pz,y:py,h:heading,anim:!grounded?'Jump':moving?run?'Run':'Walk':'Idle'});animate(p.anim);
  if(!isCoop){
   rules.tick(round,time,round.guard);if(round.noise)round.guard.noise=round.noise;const before={x:round.guard.x,z:round.guard.z};
   const caught=map.advanceGuard(round.guard,[p],dt,time);if(rules.blocked(round,'guard',round.guard.x,round.guard.z,time,.4))Object.assign(round.guard,before);
   if(caught.includes('solo')&&rules.capture(round,'solo',time)){resetPosition();toast('CAUGHT! Your items dropped. Back to your flag.');}
   if(round.finished)endRound();
  }else coop?.sendPose({x:px,z:pz,y:py,h:heading,anim:p.anim});
 }
 if(started)$('countdown').textContent=time<round.started?String(Math.ceil((round.started-time)/1000)):'';else $('countdown').textContent='';
 if(p){playerGroup.position.set(px,py,pz);playerGroup.rotation.y=heading;playerGroup.visible=!p.hidden;const kind=rules.effect(round,id(),time),scale=kind==='mini'?.55:kind==='giant'?1.45:1,wobble=kind==='jelly'?Math.sin(time/95)*.07:0;playerGroup.scale.set(scale+wobble,scale-wobble,scale+wobble);}
 mixer?.update(dt);coop?.tick(dt);
 for(const q of Object.values(round.actors))if(q.id!==id()){const kind=rules.effect(round,q.id,time),scale=kind==='mini'?.55:kind==='giant'?1.45:1,w=kind==='jelly'?Math.sin(time/95)*.07:0;coop?.setScale(q.id,scale+w,scale-w,scale+w);}
 arena.update(round,time);if(started)void arena.stream({x:px,z:pz},performance.now());if(round.guard){arena.guard.position.set(round.guard.x,0,round.guard.z);arena.guard.rotation.y=round.guard.h||0;}arena.animate(time/1000,round.guard?.mode==='chase');
 const replayFocus=replay.update(dt),focus=replayFocus||new THREE.Vector3(px,py,pz);focus.y+=rules.effect(round,id(),time)==='mini'?.7:1.3;
 const desired={x:focus.x+Math.sin(yaw)*distance*Math.cos(tilt),y:focus.y+distance*Math.sin(tilt),z:focus.z+Math.cos(yaw)*distance*Math.cos(tilt)},safe=wallCamera(focus,desired,arena.blocks,dt);camera.position.set(safe.x,safe.y,safe.z);camera.lookAt(focus);
 if(time-lastUi>120){lastUi=time;paintUi(time);}renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
roster();wallet();if(isCoop){
 $('startButton').disabled=true;$('startButton').textContent='CONNECTING TO TEAM ROOM…';
 const session=sessionStorage.getItem('jobby-world-room-peer')||'';
 if(!session){$('loadStatus').textContent='Join this room from the multiplayer lobby.';}else coop=connectCoop({code:roomCode,id:session,avatar:chosen,name:localStorage.getItem('jobby-world-display-name')||'Player',scene,getLocalPosition:()=>playerGroup.position,
 onWelcome:m=>{if(m.map!==rules.MAP_ID){location.replace('./rooms.html?code='+roomCode);return;}if(m.party){snapshot(m.party);resetPosition();}if(m.status==='finished')void loadCharacter().then(()=>{finished=false;endRound();});},onStart:()=>void start(),onKeys:()=>{},onComplete:()=>{},onParty:snapshot,
 onPartyEvent:m=>{if(m.type==='party_note')showNote(m);if(m.type==='party_reset'&&m.id===id()){if(self())Object.assign(self(),m);resetPosition();}},onError:toast});
}
window.addEventListener('pagehide',()=>{replay.stop();coop?.close();});frame();if(!isCoop&&new URLSearchParams(location.search).has('autostart'))void start();
