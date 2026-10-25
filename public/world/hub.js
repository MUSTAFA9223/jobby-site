import {AVATARS,canUseAvatar} from "./characters.js?v=1";
import {saveSelection,playerInfo,renamePlayer,newPlayer,restorePlayer,switchPlayer,recoveryCode,leaderboard,syncProfile,claimOwner} from "./player-profile.js?v=4";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

const $=id=>document.getElementById(id);
const JOBBY_MODEL="./models/JOBBY.glb";

const urlOf=a=>a.id==="JOBBY"?JOBBY_MODEL:"./models/"+encodeURIComponent(a.id)+".glb";
const STORAGE="jobby-world-v01",HISTORY="jobby-world-scores-v01";
const fallback={points:0,unlocked:[],best:0,selected:"JOBBY"};
let state={...fallback};
try{state={...fallback,...JSON.parse(localStorage.getItem(STORAGE)||"{}")}}catch(e){}
if(!Array.isArray(state.unlocked))state.unlocked=[];
const owned=a=>canUseAvatar(a,state);
if(!AVATARS.some(a=>a.id===state.selected&&owned(a)))state.selected="JOBBY";
try{if(!localStorage.getItem("jobby-world-alpha06-default")){if(state.selected==="Casual_Male")state.selected="JOBBY";localStorage.setItem(STORAGE,JSON.stringify(state));localStorage.setItem("jobby-world-alpha06-default","1")}}catch(e){}
const save=()=>{try{saveSelection(state)}catch(e){}};
const money=n=>new Intl.NumberFormat("en-US").format(n);
const latestScores=()=>{try{const values=JSON.parse(localStorage.getItem(HISTORY)||"[]");return Array.isArray(values)?values:[]}catch(e){return []}};
let activeView="home",currentModel=null,viewer=null,orbit=null,scene=null,camera=null,mixer=null,animationFrame=0,oldTime=0,previewRequest=0,rotTimer=null;
let portraitsBusy=false;
function syncState(){try{state={...fallback,...JSON.parse(localStorage.getItem(STORAGE)||"{}")}}catch(e){}if(!Array.isArray(state.unlocked))state.unlocked=[];if(!AVATARS.some(a=>a.id===state.selected&&owned(a)))state.selected="JOBBY"}
function updateStats(){
 syncState();
 $("wallet").textContent=money(state.points);
 $("myPoints").textContent=money(state.points);
 $("myOwned").textContent=AVATARS.filter(owned).length+" / "+AVATARS.length;
 $("charCounter").textContent=AVATARS.length+" CHARACTERS";
 const wins=playerInfo().profile?playerInfo().profile.wins+(state.legacyWins||0):latestScores().length;
 $("myWins").textContent=wins;
 $("leaderWins").textContent=playerInfo().profile?.rankings?.[rankingMode]?.wins||0;
 const modeBest=playerInfo().profile?.rankings?.[rankingMode]?.best;
 $("leaderBest").textContent=modeBest?Math.round(modeBest)+"s":"—";
 $("leaderPoints").textContent=money(playerInfo().profile?.rankings?.[rankingMode]?.earned||0);
}
function showView(id){
 activeView=id;
 for(const name of ["home","characters","leaderboard"])$(name).classList.toggle("hidden",name!==id);
 for(const b of document.querySelectorAll("[data-view]"))b.classList.toggle("active",b.dataset.view===id);
 updateStats();
 if(id==="characters"){renderCards();void generatePortraits()}
 if(id==="leaderboard")renderScores();
 window.scrollTo({top:0,behavior:"instant"});
}
let scoresRequest=0,rankingMode="solo";
for(const [id,mode] of [["soloRanks","solo"],["teamRanks","team"]])$(id).onclick=()=>{
 rankingMode=mode;
 for(const [button,value] of [["soloRanks","solo"],["teamRanks","team"]]){$(button).classList.toggle("active",value===mode);$(button).setAttribute("aria-pressed",String(value===mode));}
 updateStats();void renderScores();
};
async function renderScores(){
 const request=++scoresRequest,root=$("scoreboard");root.textContent="Loading player rankings…";
 try{
  const scores=await leaderboard(rankingMode);if(request!==scoresRequest)return;root.replaceChildren();
  if(!scores.length){root.classList.add("empty");root.textContent="No results in this mode yet. Complete a round to join this ranking.";return;}
  root.classList.remove("empty");
  for(const [i,entry] of scores.entries()){
   const item=document.createElement("div");item.className="score";
   const rank=document.createElement("span");rank.className="rank";rank.textContent=["🥇","🥈","🥉"][i]||"#"+(i+1);
   const who=document.createElement("div");who.className="who";
   const name=document.createElement("b");name.textContent=entry.name+(entry.id===playerInfo().profile?.id?" · You":"");
   const details=document.createElement("small");details.textContent=entry.wins+" wins · Best "+(entry.best?Math.round(entry.best)+"s":"—")+" · #"+entry.id.slice(0,6);
   const points=document.createElement("span");points.className="pts";points.textContent=money(entry.earned)+" pts";
   who.append(name,details);item.append(rank,who,points);root.append(item);
  }
 }catch{if(request!==scoresRequest)return;root.classList.add("empty");root.textContent="Could not load online rankings. Your personal points and results are kept. Reconnect and tap Rankings to retry.";}
}
function playerStatus(){
 const info=playerInfo();
 $("ownerSetup").classList.toggle("hidden",!!info.profile?.ownerConfigured&&!info.profile?.owner);
 $("ownerClaimFields").classList.toggle("hidden",!!info.profile?.owner);
 $("ownerState").textContent=info.profile?.owner?"OWNER ACCESS ENABLED · Only this saved player can create challenges.":"Enter your private one-time setup code to enable the game owner's controls on this player.";
 $("playerLabel").textContent=info.name;$("saveStatus").textContent=info.status;
 updateStats();if(activeView==="characters")renderCards();
}
function closePlayer(){ $("playerModal").classList.add("hidden");$("ownRecovery").textContent="";$("ownRecovery").classList.add("hidden");$("recoveryInput").value="";$("ownerCode").value="";$("managePlayer").focus(); }
$("managePlayer").onclick=()=>{
 const info=playerInfo();$("playerName").value=info.name;$("playerMessage").textContent="";
 const select=$("savedPlayers");select.replaceChildren();
 for(const slot of info.slots){const option=document.createElement("option");option.value=slot.id;option.textContent=slot.name+(slot.active?" (current)":"");option.selected=slot.active;select.append(option);}
 $("playerModal").classList.remove("hidden");$("playerName").focus();
};
$("claimOwner").onclick=e=>playerAction(e.currentTarget,async()=>{
 try{await claimOwner($("ownerCode").value);$("playerMessage").textContent="Owner controls enabled.";}finally{$("ownerCode").value="";}
});
$("closePlayer").onclick=closePlayer;
$("playerModal").addEventListener("click",e=>{if(e.target.id==="playerModal")closePlayer();});
async function playerAction(button,action){
 button.disabled=true;$("playerMessage").textContent="Saving…";
 try{await action();const info=playerInfo();$("playerMessage").textContent=info.error||"Player saved online.";playerStatus();}
 catch(e){$("playerMessage").textContent=e.message;}finally{button.disabled=false;}
}
$("savePlayerName").onclick=e=>playerAction(e.currentTarget,()=>{if(!$("playerName").value.trim())throw Error("Enter a player name.");return renamePlayer($("playerName").value);});
$("createPlayer").onclick=e=>playerAction(e.currentTarget,()=>newPlayer($("playerName").value));
$("restorePlayer").onclick=e=>playerAction(e.currentTarget,()=>restorePlayer($("recoveryInput").value));
$("switchPlayer").onclick=e=>playerAction(e.currentTarget,()=>switchPlayer($("savedPlayers").value));
$("showRecovery").onclick=()=>{$("ownRecovery").textContent=recoveryCode();$("ownRecovery").classList.toggle("hidden");};
window.addEventListener("jobby-profile-change",playerStatus);
const placeholder=(label)=>"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="260" viewBox="0 0 256 260"><rect width="256" height="260" rx="25" fill="#33345d"/><circle cx="128" cy="103" r="43" fill="#8278b7"/><path d="M53 218 Q52 142 128 144 Q204 142 203 218" fill="#8278b7"/><text x="128" y="245" fill="#d1c8fa" font-family="sans-serif" font-size="15" text-anchor="middle">'+label+'</text></svg>');
const portraitKey=id=>"jobby-portrait-v06-"+id;
function cachedPortrait(a){
 try{return localStorage.getItem(portraitKey(a.id))||null}catch(e){return null}
}
function renderCards(){
 const root=$("characterGrid");root.replaceChildren();
 for(const a of AVATARS){
  const item=document.createElement("button");item.type="button";item.className="avatarCard"+(state.selected===a.id?" selected":"");item.dataset.id=a.id;
  const img=document.createElement("img");img.className="portrait";img.alt="Portrait of "+a.name;
  img.loading="lazy";img.decoding="async";img.src=a.portrait||cachedPortrait(a)||placeholder(a.name);
  img.addEventListener("error",()=>{img.src=placeholder(a.name)},{once:true});
  const name=document.createElement("span");name.className="name";name.textContent=a.name;
  const meta=document.createElement("span");meta.className="meta";meta.textContent=a.id==="JOBBY"?"✓ FREE · 3D prototype":owned(a)?"✓ AVAILABLE":a.locked?"🔒 LOCKED · PREVIEW ONLY":"🪙 "+money(a.cost)+" points";
  item.append(img,name,meta);
  if(!owned(a)){const lock=document.createElement("span");lock.className="lock";lock.textContent="🔒";item.append(lock)}
  if(state.selected===a.id){const chosen=document.createElement("span");chosen.className="isSelected";chosen.textContent="SELECTED";item.append(chosen)}
  item.onclick=()=>openPreview(a);root.append(item);
 }
}
async function generatePortraits(){
 if(portraitsBusy||AVATARS.every(a=>a.portrait))return;
 portraitsBusy=true;
 // Generate real, still photographs from the 3D assets only in the gallery.
 // All previews are cached to prevent repeating the full 3D downloads on later visits.
 let renderer;
 try{
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true,powerPreference:"low-power"});
  renderer.setPixelRatio(1);renderer.setSize(256,256);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const loader=new GLTFLoader();
  for(const a of AVATARS){
   if(activeView!=="characters")break;
   if(a.portrait||cachedPortrait(a))continue;
   $("thumbNote").textContent="Creating portrait for "+a.name+" from its 3D model… (first visit only)";
   try{
    const gltf=await loader.loadAsync(urlOf(a));
    const rendered=makeScene(gltf.scene,36);
    const m=rendered.scene;
    renderer.render(m,rendered.camera);
    const png=renderer.domElement.toDataURL("image/webp",.76);
    try{localStorage.setItem(portraitKey(a.id),png)}catch(e){}
    const img=document.querySelector('.avatarCard[data-id="'+a.id+'"] .portrait');
    if(img)img.src=png;
    // The cloned preview is not needed after creating a static image.
    disposeModel(gltf.scene);
   }catch(e){console.warn("Portrait not available:",a.id,e)}
  }
  $("thumbNote").textContent="CHARACTER GALLERY: Tap a card to view and rotate its 3D model.";
 }catch(e){console.warn("No portrait renderer",e);$("thumbNote").textContent="Your device may not support portrait rendering. Tap a card to view the 3D model."}
 finally{renderer?.dispose();portraitsBusy=false}
}
function makeScene(model,fov=36){
 const s=new THREE.Scene();s.background=null;
 const b=new THREE.Box3().setFromObject(model);
 const center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3());
 // Re-center the standing model; use actual bounds instead of guessed character height.
 model.position.sub(center);model.updateMatrixWorld(true);
 s.add(model);
 s.add(new THREE.HemisphereLight(0xffffff,0x8191b4,2.5));
 const light=new THREE.DirectionalLight(0xffffff,2.8);light.position.set(3,5,8);s.add(light);
 const fill=new THREE.DirectionalLight(0xe0ccff,1.4);fill.position.set(-5,3,-3);s.add(fill);
 const c=new THREE.PerspectiveCamera(fov,1,.04,100);
 const radius=Math.max(size.x,size.y,size.z,1);
 const dist=radius/(2*Math.tan((fov*Math.PI/180)/2))*1.38;
 c.position.set(dist*.12,Math.max(.1,dist*.09),dist);c.lookAt(0,0,0);
 return{scene:s,camera:c,dist};
}
function disposeModel(model){
 model.traverse(o=>{if(o.isMesh){o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m)continue;m.map?.dispose();m.dispose()}}});
}
function closePreview(){
 ++previewRequest;
 $("previewModal").classList.add("hidden");
 cancelAnimationFrame(animationFrame);animationFrame=0;
 if(orbit){orbit.dispose();orbit=null}
 if(currentModel){disposeModel(currentModel);currentModel=null}
 if(viewer){viewer.dispose();viewer.forceContextLoss();viewer.domElement.remove();viewer=null}
 if(scene){scene.clear();scene=null}mixer=null;camera=null;
}
async function openPreview(a){
 closePreview();
 const req=++previewRequest;
 $("previewModal").classList.remove("hidden");
 $("previewName").textContent=a.name;
 $("previewStage").replaceChildren();
 const spinner=document.createElement("span");spinner.id="previewLoading";spinner.className="soft";spinner.textContent="Loading 3D model ("+(a.size/1048576).toFixed(1)+" MB)…";$("previewStage").append(spinner);
 $("previewText").textContent=a.locked?"This character is locked. Preview only · Drag to rotate":"Drag to rotate · Pinch to zoom";
 const action=$("previewAction");
 function actionLabel(){
  action.disabled=false;
  if(a.locked){action.textContent="🔒 LOCKED · PREVIEW ONLY";action.disabled=true}
  else if(owned(a)){action.textContent=state.selected===a.id?"✓ SELECTED HERO":"SELECT THIS HERO"}
  else if(state.points<a.cost){action.textContent="🔒 Need "+money(a.cost-state.points)+" more points";action.disabled=true}
  else action.textContent="🔓 Unlock for "+money(a.cost)+" points";
 }
 actionLabel();
 action.onclick=()=>{
  if(a.locked)return;
  if(!owned(a)){if(state.points<a.cost)return;state.points-=a.cost;state.unlocked.push(a.id)}
  state.selected=a.id;save();updateStats();renderCards();closePreview();
 };
 try{
  const gltf=await new GLTFLoader().loadAsync(urlOf(a));
  if(req!==previewRequest){disposeModel(gltf.scene);return}
  const built=makeScene(gltf.scene,36);scene=built.scene;camera=built.camera;currentModel=gltf.scene;
  const container=$("previewStage");
  viewer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"default"});
  viewer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  viewer.setSize(container.clientWidth,container.clientHeight);
  viewer.outputColorSpace=THREE.SRGBColorSpace;
  container.replaceChildren(viewer.domElement);
  camera.aspect=container.clientWidth/Math.max(1,container.clientHeight);camera.updateProjectionMatrix();
  orbit=new OrbitControls(camera,viewer.domElement);orbit.enablePan=false;orbit.enableDamping=true;
  orbit.minDistance=built.dist*.55;orbit.maxDistance=built.dist*2.4;
  if(gltf.animations?.length){
   const clip=gltf.animations.find(c=>/idle/i.test(c.name));
   if(clip){mixer=new THREE.AnimationMixer(currentModel);mixer.clipAction(clip).play()}
  }
  oldTime=performance.now();
  const frame=t=>{
   if(req!==previewRequest||!viewer)return;
   const dt=Math.min((t-oldTime)/1000,.06);oldTime=t;
   mixer?.update(dt);orbit?.update();viewer.render(scene,camera);
   animationFrame=requestAnimationFrame(frame);
  };
  animationFrame=requestAnimationFrame(frame);
 }catch(e){
  if(req!==previewRequest)return;
  console.warn("3D preview unavailable",e);
  if(currentModel){disposeModel(currentModel);currentModel=null}
  viewer?.dispose();viewer=null;scene=null;camera=null;mixer=null;
  const image=document.createElement("img");image.src=a.portrait;image.alt=a.name;
  $("previewStage").replaceChildren(image);
  $("previewText").textContent="Static preview · 3D could not start on this device. "+(a.locked?"This character remains locked.":"You can still select this hero.");
 }
}
function play(){
 syncState();
 if(!AVATARS.some(a=>a.id===state.selected&&owned(a)))state.selected="JOBBY";
 save();
 location.href="./castle.html?autostart=1&v=16";
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$("playNow").onclick=play;$("soloMode").onclick=play;$("playSelected").onclick=play;
$("exploreChars").onclick=()=>showView("characters");
$("partyMode").onclick=()=>{location.href="./party.html?autostart=1"};
$("multiMode").onclick=()=>{location.href="./rooms.html?map=castle-dungeon-v1"};
$("closePreview").onclick=closePreview;
$("previewModal").addEventListener("click",e=>{if(e.target.id==="previewModal")closePreview()});
window.addEventListener("keydown",e=>{if(e.key==="Escape"){closePreview();if(!$("playerModal").classList.contains("hidden"))closePlayer()}});
window.addEventListener("pageshow",()=>{updateStats();if(activeView==="leaderboard")renderScores()});
updateStats();
playerStatus();
showView(location.hash==="#leaderboard"?"leaderboard":location.hash==="#characters"?"characters":"home");

if(location.hash==="#owner")$("managePlayer").click();
