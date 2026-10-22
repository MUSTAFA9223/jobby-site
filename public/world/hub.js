import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

const $=id=>document.getElementById(id);
const PACK="https://raw.githubusercontent.com/MUSTAFA9223/JOBBY-3D-Viewer/main/models/JOBBY.glb";
const AVATARS=[
 {id:"JOBBY",name:"JOBBY",cost:0,url:PACK,size:1941348},
 {id:"Casual_Male",name:"Explorer",cost:0,size:1238384},
 {id:"Ninja_Male",name:"Ninja",cost:0,size:1058660},
 {id:"Pug",name:"Pug",cost:60,size:1045324},
 {id:"Wizard",name:"Wizard",cost:80,size:1260568},
 {id:"Pirate_Female",name:"Pirate",cost:120,size:1413296}
];
const urlOf=a=>a.url||"./models/"+encodeURIComponent(a.id)+".glb";
const STORAGE="jobby-world-v01",HISTORY="jobby-world-scores-v01";
const fallback={points:0,unlocked:[],best:0,selected:"JOBBY"};
let state={...fallback};
try{state={...fallback,...JSON.parse(localStorage.getItem(STORAGE)||"{}")}}catch(e){}
if(!Array.isArray(state.unlocked))state.unlocked=[];
const owned=a=>a.cost===0||state.unlocked.includes(a.id);
if(!AVATARS.some(a=>a.id===state.selected&&owned(a)))state.selected="JOBBY";
const save=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(state))}catch(e){}};
const money=n=>new Intl.NumberFormat("ar").format(n);
const latestScores=()=>{try{const values=JSON.parse(localStorage.getItem(HISTORY)||"[]");return Array.isArray(values)?values:[]}catch(e){return []}};
let activeView="home",currentModel=null,viewer=null,orbit=null,scene=null,camera=null,mixer=null,animationFrame=0,oldTime=0,previewRequest=0,rotTimer=null;
let portraitsBusy=false;
function syncState(){try{state={...fallback,...JSON.parse(localStorage.getItem(STORAGE)||"{}")}}catch(e){}if(!Array.isArray(state.unlocked))state.unlocked=[];if(!AVATARS.some(a=>a.id===state.selected&&owned(a)))state.selected="JOBBY"}
function updateStats(){
 syncState();
 $("wallet").textContent=money(state.points);
 $("myPoints").textContent=money(state.points);
 $("myOwned").textContent=AVATARS.filter(owned).length+" / "+AVATARS.length;
 $("myWins").textContent=latestScores().length;
 $("leaderWins").textContent=latestScores().length;
 const best=latestScores().sort((a,b)=>Number(a.seconds)-Number(b.seconds))[0];
 $("leaderBest").textContent=best?Math.round(best.seconds)+"ث":"—";
 $("leaderPoints").textContent=money(state.points);
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
function renderScores(){
 const root=$("scoreboard");root.replaceChildren();
 const scores=latestScores().sort((a,b)=>Number(a.seconds)-Number(b.seconds)).slice(0,20);
 if(!scores.length){const p=document.createElement("div");p.className="empty";p.textContent="لا توجد جولات مسجلة بعد. العب مرحلة الهروب الأولى، ثم ستظهر نتيجتك هنا.";root.append(p);return}
 for(const [i,entry] of scores.entries()){
  const item=document.createElement("div");item.className="score";
  const rank=document.createElement("span");rank.className="rank";rank.textContent=i===0?"🥇":i===1?"🥈":i===2?"🥉":"#"+(i+1);
  const who=document.createElement("div");who.className="who";
  const name=document.createElement("b");name.textContent="أنت · "+(entry.character||"JOBBY");
  const date=document.createElement("small");date.textContent=new Date(Number(entry.date)||Date.now()).toLocaleDateString("ar")+" · "+Math.round(Number(entry.seconds)||0)+" ثانية";
  const points=document.createElement("span");points.className="pts";points.textContent="+"+money(Number(entry.points)||50);
  who.append(name,date);item.append(rank,who,points);root.append(item);
 }
}
const placeholder=(label)=>"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="260" viewBox="0 0 256 260"><rect width="256" height="260" rx="25" fill="#33345d"/><circle cx="128" cy="103" r="43" fill="#8278b7"/><path d="M53 218 Q52 142 128 144 Q204 142 203 218" fill="#8278b7"/><text x="128" y="245" fill="#d1c8fa" font-family="sans-serif" font-size="15" text-anchor="middle">'+label+'</text></svg>');
const portraitKey=id=>"jobby-portrait-v04-"+id;
function cachedPortrait(a){
 try{return localStorage.getItem(portraitKey(a.id))||null}catch(e){return null}
}
function renderCards(){
 const root=$("characterGrid");root.replaceChildren();
 for(const a of AVATARS){
  const item=document.createElement("button");item.type="button";item.className="avatarCard"+(state.selected===a.id?" selected":"");item.dataset.id=a.id;
  const img=document.createElement("img");img.className="portrait";img.alt="صورة "+a.name;
  img.src=cachedPortrait(a)||(a.id==="JOBBY"?"/jobby-character-facing-copy.webp":placeholder(a.name));
  img.addEventListener("error",()=>{img.src=placeholder(a.name)},{once:true});
  const name=document.createElement("span");name.className="name";name.textContent=a.name;
  const meta=document.createElement("span");meta.className="meta";meta.textContent=owned(a)?"✓ متاحة":"🪙 "+money(a.cost)+" نقطة";
  item.append(img,name,meta);
  if(!owned(a)){const lock=document.createElement("span");lock.className="lock";lock.textContent="🔒";item.append(lock)}
  if(state.selected===a.id){const chosen=document.createElement("span");chosen.className="isSelected";chosen.textContent="المختارة";item.append(chosen)}
  item.onclick=()=>openPreview(a);root.append(item);
 }
}
async function generatePortraits(){
 if(portraitsBusy)return;
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
   if(cachedPortrait(a))continue;
   $("thumbNote").textContent="إعداد صورة "+a.name+" من المجسم الأصلي… (أول زيارة فقط)";
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
  $("thumbNote").textContent="معرض الشخصيات: اضغط أي بطاقة لمشاهدة المجسم الأصلي 3D وتدويره.";
 }catch(e){console.warn("No portrait renderer",e);$("thumbNote").textContent="قد لا يدعم هذا الهاتف إنشاء صور الشخصيات؛ يمكن معاينتها 3D عند الضغط على البطاقة."}
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
 const req=++previewRequest;
 $("previewModal").classList.remove("hidden");
 $("previewName").textContent=a.name;
 $("previewStage").replaceChildren();
 const spinner=document.createElement("span");spinner.id="previewLoading";spinner.className="soft";spinner.textContent="تحميل النموذج 3D ("+(a.size/1048576).toFixed(1)+" MB)…";$("previewStage").append(spinner);
 $("previewText").textContent="اسحب الشخصية لتدويرها · يمكن تغيير زاوية الرؤية";
 const action=$("previewAction");
 function actionLabel(){
  action.disabled=false;
  if(owned(a)){action.textContent=state.selected===a.id?"✓ الشخصية المختارة":"اختيار هذه الشخصية"}
  else if(state.points<a.cost){action.textContent="🔒 تحتاج "+money(a.cost-state.points)+" نقطة إضافية";action.disabled=true}
  else action.textContent="🔓 فتح الشخصية بـ "+money(a.cost)+" نقطة";
 }
 actionLabel();
 action.onclick=()=>{
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
 }catch(e){console.error(e);$("previewStage").textContent="تعذر فتح النموذج. قد يكون الإنترنت ضعيفًا أو النموذج غير متاح."}
}
function play(){
 syncState();
 if(!AVATARS.some(a=>a.id===state.selected&&owned(a)))state.selected="JOBBY";
 save();
 location.href="./play.html?autostart=1&v=6";
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$("playNow").onclick=play;$("soloMode").onclick=play;$("playSelected").onclick=play;
$("exploreChars").onclick=()=>showView("characters");
$("multiMode").onclick=()=>{alert("اللعب الجماعي ليس متاحًا في النسخة الحالية. سنفعله بعد تجهيز الخادم والغرف الخاصة.")};
$("closePreview").onclick=closePreview;
$("previewModal").addEventListener("click",e=>{if(e.target.id==="previewModal")closePreview()});
window.addEventListener("keydown",e=>{if(e.key==="Escape")closePreview()});
window.addEventListener("pageshow",()=>{updateStats();if(activeView==="leaderboard")renderScores()});
updateStats();
showView(location.hash==="#characters"?"characters":"home");
