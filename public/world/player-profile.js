// A private recovery code owns a player save. Names are public labels, never passwords.
const ACTIVE="jobby-player-active-v1",SLOTS="jobby-player-slots-v1",PREFIX="jobby-player-save-v1:",STATE="jobby-world-v01",HISTORY="jobby-world-scores-v01";
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const newToken=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,"0")).join("");
let token=read(ACTIVE,null),run=null,busy=null,lastError="",status="Connecting to your player save…";
if(!token){
 token=newToken();write(ACTIVE,token);
 const legacy=read(STATE,{points:0,unlocked:[],selected:"JOBBY"}),history=read(HISTORY,[]);
 write("jobby-world-before-profiles-v1",{state:legacy,history});
 write(PREFIX+token,{name:localStorage.getItem("jobby-world-display-name")||"Player "+token.slice(0,4).toUpperCase(),legacy,history,actions:[],created:false});
}
const current=()=>read(PREFIX+token,{actions:[],created:true});
function notice(){window.dispatchEvent(new Event("jobby-profile-change"));}
function remember(p){const slots=read(SLOTS,[]).filter(s=>s.token!==token);slots.push({token,name:p.name,id:p.id});write(SLOTS,slots);}
function apply(p){
 const cache=current();cache.profile=p;cache.name=p.name;write(PREFIX+token,cache);remember(p);
 // Wait until all queued operations are acknowledged before replacing optimistic UI values.
 if(!cache.actions.length){write(STATE,p.state);write(HISTORY,p.state.history||[]);}
 localStorage.setItem("jobby-world-display-name",p.name);notice();
}
async function api(path,body,secret=token){
 const res=await fetch("/api/world/"+path,{method:body===undefined?"GET":"POST",headers:{authorization:"Bearer "+secret,...(body===undefined?{}:{"content-type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body),keepalive:true}),signal:AbortSignal.timeout(10000)});
 const data=await res.json();if(!res.ok)throw Error(data.error||"Player save unavailable.");return data;
}
async function flushInner(){
 try{
  lastError="";
  let cache=current();
  if(!cache.created){
   const p=await api("profile/create",{name:cache.name,legacy:cache.legacy,history:cache.history});
   cache=current();cache.created=true;delete cache.legacy;delete cache.history;write(PREFIX+token,cache);apply(p);
  }
  let changed=false;
  while((cache=current()).actions.length){
   const actions=cache.actions.slice(0,50),p=await api("profile/sync",{actions});
   const ids=new Set(actions.map(a=>a.id));cache=current();cache.actions=cache.actions.filter(a=>!ids.has(a.id));write(PREFIX+token,cache);apply(p);changed=true;
   if(p.errors?.length)lastError=p.errors.join(" ");
  }
  if(!changed)apply(await api("profile"));
  status=lastError||"Saved online · "+current().name;
 }catch(error){status="Offline · changes kept on this device; reconnect to sync";lastError=error.message;}
 notice();
}
export function syncProfile(){
 if(busy)return busy;
 const work=()=>flushInner();
 busy=(navigator.locks?navigator.locks.request("jobby-player-sync",work):work()).finally(()=>{busy=null;});return busy;
}
function enqueue(action){const cache=current();cache.actions.push({id:crypto.randomUUID(),...action});write(PREFIX+token,cache);status="Saving player progress…";notice();void syncProfile();}
export function saveSelection(state){
 const cache=current(),last=[...cache.actions].reverse().find(a=>a.type==="select")?.avatar||cache.profile?.state.selected;
 write(STATE,state);if(last!==state.selected)enqueue({type:"select",avatar:state.selected});
}
export function beginPlayerRun(map){run=crypto.randomUUID();enqueue({type:"start",run,map,at:Date.now()});}
export function recordPlayerTask(index){if(run)enqueue({type:"task",run,index});}
export function finishPlayerRun(){if(run){enqueue({type:"finish",run});run=null;}}
export function playerInfo(){const c=current();return {name:c.name,profile:c.profile,status,error:lastError,pending:c.actions.length,slots:read(SLOTS,[]).map(s=>({id:s.id,name:s.name,active:s.token===token}))};}
export function renamePlayer(name){enqueue({type:"name",name});return syncProfile();}
export async function restorePlayer(code){
 const secret=code.trim().toLowerCase().replace(/[\s-]/g,"");
 if(!/^[a-f0-9]{64}$/.test(secret))throw Error("Enter the full 64-character recovery code.");
 await syncProfile();if(current().actions.length)throw Error("Reconnect to save your current progress before switching players.");
 const p=await api("profile",undefined,secret);token=secret;write(ACTIVE,token);
 if(!localStorage.getItem(PREFIX+token))write(PREFIX+token,{name:p.name,actions:[],created:true});
 apply(p);location.reload();
}
export async function newPlayer(name){
 if(!name.trim())throw Error("Enter a player name first.");
 await syncProfile();if(current().actions.length)throw Error("Reconnect to save your current progress before switching players.");
 token=newToken();write(ACTIVE,token);write(PREFIX+token,{name:name.trim(),legacy:{points:0,unlocked:[],selected:"JOBBY"},history:[],actions:[],created:false});
 write(STATE,{points:0,unlocked:[],selected:"JOBBY"});write(HISTORY,[]);await syncProfile();location.reload();
}
export async function switchPlayer(id){const slot=read(SLOTS,[]).find(s=>s.id===id);if(slot)await restorePlayer(slot.token);}
export async function linkRoomSession(session){await syncProfile();if(!current().created||current().actions.length)throw Error("Reconnect to save your player before joining a room.");return api("profile/link",{session});}
export async function claimOwner(code){await syncProfile();const profile=await api("profile/owner-claim",{code:code.trim()});apply(profile);return profile;}
export function recoveryCode(){return token;}
export async function leaderboard(mode="solo"){const res=await fetch("/api/world/leaderboard?mode="+encodeURIComponent(mode),{cache:"no-store"});if(!res.ok)throw Error("Rankings are temporarily unavailable.");return (await res.json()).players;}
window.addEventListener("online",()=>void syncProfile());
window.addEventListener("pageshow",()=>void syncProfile());
window.addEventListener("storage",event=>{if(event.key===ACTIVE){location.reload();return;}if(event.key===STATE)notice();});
setInterval(()=>void syncProfile(),30000);
void syncProfile();
