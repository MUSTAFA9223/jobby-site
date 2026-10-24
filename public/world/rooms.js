import {renamePlayer,linkRoomSession,syncProfile,playerInfo} from "./player-profile.js?v=4";
import {createRoomVoice} from "./voice.js?v=3";
const $=id=>document.getElementById(id);
const re=/^[A-HJ-NP-Z2-9]{6}$/;
const KEY="jobby-world-room-peer";
let id=sessionStorage.getItem(KEY);
if(!id){id=crypto.randomUUID();sessionStorage.setItem(KEY,id)}
let code="",ws=null,host="",publicId="",state="lobby",roster=[],maxPlayers=12;
let roomMap="classic",challenge=null;
$("roomType").value=new URLSearchParams(location.search).get("mode")==="challenge"?"challenge":"coop";
function roomType(){
 const active=$("roomType").value==="challenge",owner=playerInfo().profile?.owner===true;
 $("challengeRules").classList.toggle("hidden",!active);$("mapChoice").classList.toggle("hidden",active);$("mapLabel").classList.toggle("hidden",active);
 $("challengeAmountSetup").classList.toggle("hidden",!active||!owner);$("ownerNotice").classList.toggle("hidden",!active||owner);$("create").classList.toggle("hidden",active&&!owner);
}
window.addEventListener("jobby-profile-change",()=>{roomType();if(code)render();});
$("roomType").onchange=roomType;roomType();
$("mapChoice").value=["castle-dungeon-v1","jobby-race-v1","warehouse-v1","big-house-v1","classic"].includes(new URLSearchParams(location.search).get("map"))?new URLSearchParams(location.search).get("map"):"castle-dungeon-v1";
let selected="JOBBY";
const voice=createRoomVoice({mount:$("lobbyVoice"),
 send:m=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(m));},
 sendAudio:data=>{if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<16384)ws.send(data);}
});
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
  $("count").textContent=roster.length+" / "+maxPlayers;
  $("people").replaceChildren();
  for(const p of roster){
    const box=document.createElement("div");box.className="person";
    const face=document.createElement("span");face.className="face";face.textContent=emoji(p.avatar);
    const who=document.createElement("div");who.className="who";
    const label=document.createElement("b");label.textContent=p.name+(p.id===publicId?" (You)":"");
    const sub=document.createElement("small");sub.textContent=(p.id===host?"HOST · ":"")+(challenge?("TEAM "+(challenge.teams[p.id]||"—")+(challenge.ready[p.id]?" · READY":" · NOT READY")):p.avatar)+(p.voice?(p.muted?" · MIC MUTED":" · IN VOICE"):"");
    who.append(label,sub);box.append(face,who);$("people").append(box);
  }
  const iamHost=publicId===host,waiting=state==="lobby"||(state==="finished"&&["warehouse-v1","jobby-race-v1","castle-dungeon-v1"].includes(roomMap));
  $("start").classList.toggle("hidden",!waiting);
  $("start").disabled=!iamHost||roster.length<2||ws?.readyState!==WebSocket.OPEN;
  $("start").textContent=iamHost?(roster.length<2?"WAITING FOR FRIENDS…":(roomMap==="jobby-race-v1"?"▶ START RACE":"▶ START CO-OP ESCAPE")):"WAITING FOR HOST…";
  if(waiting)status(roster.length<2?"Share the room code. Waiting for another player…":(iamHost?"Your squad is ready. Start when everyone is here.":"Waiting for the host to start the match."));
  $("challengeLobby").classList.toggle("hidden",!challenge);$("coopNote").classList.toggle("hidden",!!challenge);
  if(challenge){
   const a=roster.filter(p=>challenge.teams[p.id]==="A").length,b=roster.filter(p=>challenge.teams[p.id]==="B").length,ready=roster.filter(p=>challenge.ready[p.id]).length;
   const open=challenge.status==="lobby";
   $("challengeSummary").textContent="TEAM A "+a+" vs TEAM B "+b+" · "+ready+"/"+roster.length+" READY · POOL "+(challenge.pot||roster.length*challenge.fee)+" POINTS";
   for(const [id,team] of [["teamA","A"],["teamB","B"]]){$(id).disabled=!open;$(id).setAttribute("aria-pressed",String(challenge.teams[publicId]===team));}
   const owner=iamHost&&playerInfo().profile?.owner===true;
   $("ownerEntryControl").classList.toggle("hidden",!owner||!open);
   if(document.activeElement!==$("lobbyEntry"))$("lobbyEntry").value=challenge.fee;
   $("challengeSummary").textContent+=" · ENTRY "+challenge.fee+" EACH";
   $("confirmEntry").disabled=!open;$("confirmEntry").textContent=challenge.ready[publicId]?"READY ✓ · TAP TO CANCEL":"READY · CONFIRM "+challenge.fee+" POINTS";
   $("start").disabled=!owner||ws?.readyState!==WebSocket.OPEN||(open&&(!a||a!==b||ready!==roster.length));
   $("start").textContent=!iamHost?"WAITING FOR HOST…":open?"START TEAM CHALLENGE":"PREPARE NEXT CHALLENGE";
   if(open)status(a!==b||!a?"Choose two equal teams, then every player confirms entry.":ready!==roster.length?"Waiting for every player to confirm "+challenge.fee+" points.":"Both teams are ready. The host can start.");
   else if(["paid","refunded"].includes(challenge.status))status(challenge.status==="paid"?"TEAM "+challenge.winner+" WON · "+(challenge.payouts[0]?.points||0)+" POINTS PER WINNER":"NO WINNER · ALL ENTRY POINTS REFUNDED");
  }
}
function beginGame(){
  if(!code)return;
  voice.close();location.href=(roomMap==="castle-dungeon-v1"?"./castle.html?room=":roomMap==="jobby-race-v1"?"./race.html?room=":roomMap==="warehouse-v1"?"./warehouse.html?room=":roomMap==="big-house-v1"?"./house.html?room=":"./play.html?room=")+encodeURIComponent(code)+"&v=16";
}
async function connect(){
  try{await linkRoomSession(id);}catch(e){showStatus(e.message,true);return;}
  if(ws){ws.onclose=null;ws.close()}
  $("setup").classList.add("hidden");$("lobby").classList.remove("hidden");
  $("code").textContent=code;status("Connecting to "+code+"…");
  const params=new URLSearchParams({token:id,name:$("name").value.trim().slice(0,18)||"Player",avatar:$("avatar").value});
  localStorage.setItem("jobby-world-display-name",$("name").value.trim().slice(0,18)||"Player");
  void renamePlayer($("name").value.trim().slice(0,18)||"Player");
  sessionStorage.setItem("jobby-world-room-avatar",$("avatar").value);
  const protocol=location.protocol==="https:"?"wss:":"ws:";
  ws=new WebSocket(protocol+"//"+location.host+"/api/world/rooms/"+code+"/socket?"+params);
  ws.binaryType="arraybuffer";
  ws.onmessage=ev=>{
    if(ev.data instanceof ArrayBuffer){voice.audio(ev.data);return;}
    let m;try{m=JSON.parse(ev.data)}catch{return}
    if(m.type==="welcome"){
      challenge=m.challenge||null;roomMap=m.map||"classic";$("lobbyStatus").dataset.map=roomMap;maxPlayers=m.maxPlayers||12;publicId=m.selfId;host=m.hostId;state=m.status;roster=m.players||[];voice.roster(roster,publicId);render();
      if(state==="playing")beginGame();
      if(state==="finished"&&!challenge)status("Round finished. The host can start another round.");
    }
    if(m.type==="challenge_state"){challenge=m.challenge;state=["paid","refunded"].includes(challenge.status)?"finished":challenge.status==="lobby"?"lobby":state;render();void syncProfile();}
    if(m.type==="roster"){if(m.challenge)challenge=m.challenge;host=m.hostId;roster=m.players||[];voice.roster(roster,publicId);render()}
    if(m.type==="voice_state"){voice.state(m);roster=roster.map(p=>p.id===m.id?{...p,voice:m.joined,muted:m.muted}:p);render();}
    if(m.type==="start")beginGame();
    if(m.type==="error")status(m.message||"Room error.");
    if(m.type==="complete"){state="finished";status("Your squad escaped!")}
  };
  ws.onopen=()=>status("Connected to private room "+code+".");
  ws.onerror=()=>status("Connection failed. The multiplayer service may not be deployed yet.");
  ws.onclose=()=>{voice.disconnected();status("Disconnected. Return and rejoin with the same room code.");$("start").disabled=true};
}
async function create(){
  $("create").disabled=true;showStatus("Creating your private room…");
  try{
    await linkRoomSession(id);
    const res=await fetch("/api/world/rooms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:id,map:$("mapChoice").value,mode:$("roomType").value,fee:Number($("entryAmount").value)})});
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
    if((data.players||[]).length>=(data.maxPlayers||12))throw Error("This room is full.");
    history.replaceState(null,"","./rooms.html?code="+code);connect();
  }catch(e){showStatus(e.message||"Could not join room.",true)}
  finally{$("join").disabled=false}
}
async function copy(value){
  try{await navigator.clipboard.writeText(value);status("Copied! Share it with your friends.")}
  catch{status("Copy manually: "+value)}
}
$("saveEntry").onclick=()=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:"challenge_entry",fee:Number($("lobbyEntry").value)}));};
$("teamA").onclick=()=>ws?.readyState===WebSocket.OPEN&&ws.send(JSON.stringify({type:"challenge_team",team:"A"}));
$("teamB").onclick=()=>ws?.readyState===WebSocket.OPEN&&ws.send(JSON.stringify({type:"challenge_team",team:"B"}));
$("confirmEntry").onclick=async()=>{
 if(ws?.readyState!==WebSocket.OPEN||!challenge)return;
 $("confirmEntry").disabled=true;let errorMessage="";
 try{await syncProfile();if(!challenge.ready[publicId]&&(playerInfo().profile?.state?.points||0)<challenge.fee){errorMessage="You need "+challenge.fee+" free game points. Play solo or co-op to earn more.";return;}ws.send(JSON.stringify({type:"challenge_ready",ready:!challenge.ready[publicId],fee:challenge.fee,revision:challenge.revision}));}
 finally{render();if(errorMessage)status(errorMessage);}
};
$("create").onclick=create;$("join").onclick=join;
$("roomInput").addEventListener("keydown",e=>{if(e.key==="Enter")join()});
$("copyCode").onclick=()=>copy(code);$("copyInvite").onclick=()=>copy(invite());
$("start").onclick=()=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:"start"}))};
$("leave").onclick=()=>{voice.close();ws?.close();location.href="./index.html?v=14"};
const incoming=new URLSearchParams(location.search).get("code")?.toUpperCase()||"";
if(re.test(incoming)){$("roomInput").value=incoming;showStatus("Invite code detected. Tap JOIN ROOM to connect.")}
