const $=id=>document.getElementById(id);
const re=/^[A-HJ-NP-Z2-9]{6}$/;
const KEY="jobby-world-room-peer";
let id=sessionStorage.getItem(KEY);
if(!id){id=crypto.randomUUID();sessionStorage.setItem(KEY,id)}
let code="",ws=null,host="",state="lobby",roster=[];
let selected="JOBBY";
try{selected=JSON.parse(localStorage.getItem("jobby-world-v01")||"{}").selected||"JOBBY"}catch{}
const progress=(()=>{try{return JSON.parse(localStorage.getItem("jobby-world-v01")||"{}")}catch{return {}}})();
for(const option of $("avatar").options){
 const costs={Wizard:80,Pirate_Female:120};
 const price=costs[option.value]||0;
 option.disabled=!!price && !(Array.isArray(progress.unlocked)&&progress.unlocked.includes(option.value));
 if(option.disabled)option.textContent+=" (LOCKED)";
}
$("avatar").value=Array.from($("avatar").options).some(o=>o.value===selected&&!o.disabled)?selected:"JOBBY";
$("name").value=localStorage.getItem("jobby-world-display-name")||"Player";
const invite=()=>location.origin+"/world/rooms.html?code="+code;
const showStatus=(s,err=false)=>{$("setupStatus").classList.remove("hidden");$("setupStatus").textContent=s;$("setupStatus").style.color=err?"#ffaaa9":"#bdebdc"};
const status=s=>{$("lobbyStatus").textContent=s};
const emoji=id=>({JOBBY:"✨",Casual_Male:"🧑",Ninja_Male:"🥷",Pug:"🐶",Wizard:"🧙",Pirate_Female:"🏴‍☠️"})[id]||"🧑";
function render(){
  $("count").textContent=roster.length+" / 6";
  $("people").replaceChildren();
  for(const p of roster){
    const box=document.createElement("div");box.className="person";
    const face=document.createElement("span");face.className="face";face.textContent=emoji(p.avatar);
    const who=document.createElement("div");who.className="who";
    const label=document.createElement("b");label.textContent=p.name+(p.id===id?" (You)":"");
    const sub=document.createElement("small");sub.textContent=p.id===host?"HOST · "+p.avatar:p.avatar;
    who.append(label,sub);box.append(face,who);$("people").append(box);
  }
  const iamHost=id===host,waiting=state==="lobby";
  $("start").classList.toggle("hidden",!waiting);
  $("start").disabled=!iamHost||roster.length<2||ws?.readyState!==WebSocket.OPEN;
  $("start").textContent=iamHost?(roster.length<2?"WAITING FOR FRIENDS…":"▶ START CO-OP ESCAPE"):"WAITING FOR HOST…";
  if(waiting)status(roster.length<2?"Share the room code. Waiting for another player…":(iamHost?"Your squad is ready. Start when everyone is here.":"Waiting for the host to start the match."));
}
function beginGame(){
  if(!code)return;
  location.href="./play.html?room="+encodeURIComponent(code)+"&v=10";
}
function connect(){
  if(ws){ws.onclose=null;ws.close()}
  $("setup").classList.add("hidden");$("lobby").classList.remove("hidden");
  $("code").textContent=code;status("Connecting to "+code+"…");
  const params=new URLSearchParams({id,name:$("name").value.trim().slice(0,18)||"Player",avatar:$("avatar").value});
  localStorage.setItem("jobby-world-display-name",$("name").value.trim().slice(0,18)||"Player");
  sessionStorage.setItem("jobby-world-room-avatar",$("avatar").value);
  const protocol=location.protocol==="https:"?"wss:":"ws:";
  ws=new WebSocket(protocol+"//"+location.host+"/api/world/rooms/"+code+"/socket?"+params);
  ws.onmessage=ev=>{
    let m;try{m=JSON.parse(ev.data)}catch{return}
    if(m.type==="welcome"){
      host=m.hostId;state=m.status;roster=m.players||[];render();
      if(state==="playing")beginGame();
      if(state==="finished")status("Match finished. Create a new room for another escape.");
    }
    if(m.type==="roster"){host=m.hostId;roster=m.players||[];render()}
    if(m.type==="start")beginGame();
    if(m.type==="error")status(m.message||"Room error.");
    if(m.type==="complete"){state="finished";status("Your squad escaped!")}
  };
  ws.onopen=()=>status("Connected to private room "+code+".");
  ws.onerror=()=>status("Connection failed. The multiplayer service may not be deployed yet.");
  ws.onclose=()=>{status("Disconnected. Return and rejoin with the same room code.");$("start").disabled=true};
}
async function create(){
  $("create").disabled=true;showStatus("Creating your private room…");
  try{
    const res=await fetch("/api/world/rooms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id})});
    const data=await res.json();if(!res.ok)throw Error(data.error||"Could not create room.");
    code=data.code;history.replaceState(null,"","./rooms.html?code="+code);connect();
  }catch(e){showStatus(e.message||"Could not create room.",true)}
  finally{$("create").disabled=false}
}
async function join(){
  code=$("roomInput").value.toUpperCase().replace(/\s/g,"");
  if(!re.test(code)){showStatus("Enter a valid 6-character room code.",true);return}
  $("join").disabled=true;showStatus("Finding room…");
  try{
    const res=await fetch("/api/world/rooms/"+code);
    const data=await res.json();if(!res.ok)throw Error(data.error||"Room not found.");
    if((data.players||[]).length>=6)throw Error("This room is full.");
    history.replaceState(null,"","./rooms.html?code="+code);connect();
  }catch(e){showStatus(e.message||"Could not join room.",true)}
  finally{$("join").disabled=false}
}
async function copy(value){
  try{await navigator.clipboard.writeText(value);status("Copied! Share it with your friends.")}
  catch{status("Copy manually: "+value)}
}
$("create").onclick=create;$("join").onclick=join;
$("roomInput").addEventListener("keydown",e=>{if(e.key==="Enter")join()});
$("copyCode").onclick=()=>copy(code);$("copyInvite").onclick=()=>copy(invite());
$("start").onclick=()=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:"start"}))};
$("leave").onclick=()=>{ws?.close();location.href="./index.html?v=9"};
const incoming=new URLSearchParams(location.search).get("code")?.toUpperCase()||"";
if(re.test(incoming)){$("roomInput").value=incoming;showStatus("Invite code detected. Tap JOIN ROOM to connect.")}
