import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {clone as cloneSkeleton} from "three/addons/utils/SkeletonUtils.js";
import {createAssetCache} from "./avatar-cache.js";
import {createRoomVoice} from "./voice.js?v=3";

const ICON={JOBBY:"JOBBY",Casual_Male:"Explorer",Ninja_Male:"Ninja",Pug:"Pug",Wizard:"Wizard",Pirate_Female:"Pirate"};
const JOBBY_MODEL="./models/JOBBY.glb";
const loader=new GLTFLoader();

function nameSprite(name){
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=64;
  const c=canvas.getContext("2d");c.fillStyle="#151a36ee";c.beginPath();c.roundRect(2,5,252,50,16);c.fill();
  c.font="bold 23px system-ui";c.fillStyle="#a9ffe7";c.textAlign="center";c.fillText(name.slice(0,17),128,39,230);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const mat=new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true});
  const sprite=new THREE.Sprite(mat);sprite.position.y=2.25;sprite.scale.set(2.35,.59,1);return sprite;
}
const urlOf=avatar=>avatar==="JOBBY"?JOBBY_MODEL:"./models/"+encodeURIComponent(avatar)+".glb";
function dispose(root){
  root.traverse(obj=>{if(!obj.isMesh)return;obj.geometry?.dispose();for(const m of Array.isArray(obj.material)?obj.material:[obj.material]){if(!m)continue;m.map?.dispose();m.dispose()}});
}
export function connectCoop({code,id,avatar,name,scene,getLocalPosition,onWelcome,onStart,onKeys,onComplete,onError,onTasks=()=>{},onGuard=()=>{},onCaught=()=>{},onHide=()=>{},onWarehouse=()=>{},onWarehouseNote=()=>{},onWarehousePanel=()=>{},onWarehouseCaught=()=>{},onWarehouseRelease=()=>{},onWarehouseFailed=()=>{},onRace=()=>{},onRaceEvent=()=>{},onCastle=()=>{},onCastleNote=()=>{},onCastlePanel=()=>{},onCastleCaught=()=>{},onCastleRelease=()=>{},onCastleFailed=()=>{},onParty=()=>{},onPartyEvent=()=>{}}){
  const remotes=new Map();
  const models=createAssetCache(url=>loader.loadAsync(url),gltf=>dispose(gltf.scene));
  let publicId=null;
  let ws=null,lastPose=0,closed=false,lastKey=new Map(),lastFinish=0,attempts=0;
  const voice=createRoomVoice({mount:document.getElementById("voiceHud"),
    send:m=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(m));},
    sendAudio:data=>{if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<16384)ws.send(data);}
  });
  function removeRemote(id){
    const r=remotes.get(id);if(!r)return;
    remotes.delete(id);scene.remove(r.group);
    if(r.mixer)r.mixer.stopAllAction();
    if(r.model){const skeletons=new Set();r.model.traverse(node=>{if(node.isSkinnedMesh)skeletons.add(node.skeleton)});for(const skeleton of skeletons)skeleton.dispose();}
    r.label.material.map.dispose();r.label.material.dispose();
    r.fallback.geometry.dispose();r.fallback.material.dispose();
  }
  function addRemote(p){
    const group=new THREE.Group();scene.add(group);
    group.position.set(p.x??0,p.y??0,p.z??18);group.rotation.y=p.h||0;
    const fallback=new THREE.Mesh(new THREE.CapsuleGeometry(.35,.8,5,8),new THREE.MeshStandardMaterial({color:0x71e8d2}));
    fallback.position.y=.95;group.add(fallback);
    const label=nameSprite(p.name||"Player");group.add(label);
    const r={id:p.id,avatar:p.avatar,group,label,fallback,model:null,mixer:null,clips:{},clip:"",x:p.x??0,z:p.z??18,y:p.y??0,h:p.h||0,anim:p.anim||"Idle",animationTime:0};
    remotes.set(p.id,r);
    const modelId=p.avatar;
    models.get(urlOf(modelId)).then(gltf=>{
      if(closed||remotes.get(p.id)!==r)return
      const model=cloneSkeleton(gltf.scene),bounds=new THREE.Box3().setFromObject(model);
      const size=bounds.getSize(new THREE.Vector3()),scale=1.75/Math.max(.01,size.y);
      model.scale.setScalar(scale);model.position.y=-bounds.min.y*scale;
      model.traverse(node=>{if(node.isMesh){node.castShadow=false;if(node.isSkinnedMesh)node.frustumCulled=false}});
      group.add(model);r.model=model;fallback.visible=false;
      if(gltf.animations.length){
        r.mixer=new THREE.AnimationMixer(model);
        for(const clip of gltf.animations)r.clips[clip.name.split("|").pop()]=r.mixer.clipAction(clip);
        selectAnimation(r,r.anim);
      }
    }).catch(err=>console.warn("Remote avatar unavailable",ICON[modelId],err));
  }
  function selectAnimation(r,name){
    const key=r.clips[name]?name:"Idle";
    if(!r.clips[key]||r.clip===key)return;
    r.clips[r.clip]?.fadeOut(.15);r.clips[key].reset().fadeIn(.15).play();r.clip=key;
  }
  function syncRoster(players){
    const other=(players||[]).filter(p=>p.id!==publicId);
    const ids=new Set(other.map(p=>p.id));
    for(const otherId of [...remotes.keys()])if(!ids.has(otherId))removeRemote(otherId);
    for(const p of other){
      if(remotes.has(p.id)&&remotes.get(p.id).avatar!==p.avatar)removeRemote(p.id);
      if(!remotes.has(p.id))addRemote(p);
      const r=remotes.get(p.id);
      Object.assign(r,{x:p.x??r.x,z:p.z??r.z,y:p.y??r.y,h:p.h??r.h,anim:p.anim||r.anim});r.group.visible=!p.hidden;
    }
  }
  function open(){
    if(closed)return;
    const q=new URLSearchParams({token:id,avatar,name});
    const proto=location.protocol==="https:"?"wss:":"ws:";
    ws=new WebSocket(proto+"//"+location.host+"/api/world/rooms/"+code+"/socket?"+q);
    ws.binaryType="arraybuffer";
    ws.onopen=()=>{attempts=0};
    ws.onmessage=event=>{
      if(event.data instanceof ArrayBuffer){voice.audio(event.data);return;}
      let m;try{m=JSON.parse(event.data)}catch{return}
      if(m.type==="welcome"){
        publicId=m.selfId;
        voice.roster(m.players,publicId);
        syncRoster(m.players||[]);onKeys(m.keys||[]);onTasks(m.tasks||[]);if(m.guard)onGuard(m.guard);
        if(m.party)onParty(m.party);if(m.castle)onCastle(m.castle);if(m.warehouse)onWarehouse(m.warehouse);if(m.race)onRace(m.race);
        onWelcome(m);
        if(m.status==="playing")onStart();
        if(m.status==="finished")onComplete(m);
      }else if(m.type==="roster"){syncRoster(m.players||[]);voice.roster(m.players,publicId);}
      else if(m.type==="voice_state"){voice.state(m);}
      else if(m.type==="party_state")onParty(m.state);
      else if(m.type.startsWith("party_"))onPartyEvent(m);
      else if(m.type==="race_state")onRace(m.state);
      else if(m.type.startsWith("race_"))onRaceEvent(m);
      else if(m.type==="castle_state")onCastle(m.state);
      else if(m.type==="castle_note")onCastleNote(m.note);
      else if(m.type==="castle_panel")onCastlePanel(m);
      else if(m.type==="castle_failed")onCastleFailed();
      else if(m.type==="castle_caught"||m.type==="castle_release"){const r=remotes.get(m.id);if(r){r.x=m.x;r.z=m.z;r.y=0;r.group.position.set(m.x,0,m.z);r.group.visible=true;}if(m.type==="castle_caught")onCastleCaught(m);else onCastleRelease(m);}
      else if(m.type==="warehouse_state")onWarehouse(m.state);
      else if(m.type==="warehouse_note")onWarehouseNote(m.note);
      else if(m.type==="warehouse_panel")onWarehousePanel(m);
      else if(m.type==="warehouse_failed")onWarehouseFailed();
      else if(m.type==="warehouse_caught"||m.type==="warehouse_release"){const r=remotes.get(m.id);if(r){r.x=m.x;r.z=m.z;r.y=0;r.group.position.set(m.x,0,m.z);r.group.visible=true;}if(m.type==="warehouse_caught")onWarehouseCaught(m);else onWarehouseRelease(m);}
      else if(m.type==="guard")onGuard(m.guard);
      else if(m.type==="house_tasks")onTasks(m.tasks||[]);
      else if(m.type==="hide"){const r=remotes.get(m.id);if(r)r.group.visible=!m.hidden;onHide(m);}
      else if(m.type==="caught"){const r=remotes.get(m.id);if(r){r.x=m.x;r.z=m.z;r.y=0;r.group.position.set(m.x,0,m.z);r.group.visible=true;}onCaught(m);}
      else if(m.type==="pose"){
        const r=remotes.get(m.id);if(r)Object.assign(r,{x:m.x,z:m.z,y:m.y,h:m.h,anim:m.anim});if(r)r.group.visible=!m.hidden;
      }else if(m.type==="start"){onKeys([]);onTasks([]);if(m.party)onParty(m.party);if(m.castle)onCastle(m.castle);if(m.warehouse)onWarehouse(m.warehouse);if(m.race)onRace(m.race);onStart()}
      else if(m.type==="key"){onKeys(m.keys||[])}
      else if(m.type==="gate_open"){onKeys([0,1,2])}
      else if(m.type==="complete")onComplete(m)
      else if(m.type==="error")onError(m.message||"Room error");
    };
    ws.onerror=()=>onError("Connection issue. Check your internet.");
    ws.onclose=e=>{
      voice.disconnected();
      if(closed)return;
      if(e.code===4001){onError("Another tab connected with this player session.");return}
      if(attempts++<4){onError("Reconnecting to room…");setTimeout(open,Math.min(5000,500*Math.pow(2,attempts)))}
      else onError("Room disconnected. Return to the lobby and rejoin.");
    };
  }
  open();
  return {
    sendPose(p){
      if(ws?.readyState!==WebSocket.OPEN||performance.now()-lastPose<105)return;
      lastPose=performance.now();
      ws.send(JSON.stringify({type:"pose",x:p.x,z:p.z,y:p.y,h:p.h,anim:p.anim}));
    },
    partyAction(action){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:"party_action",action}));},
    avatarFor(id){const r=remotes.get(id);return r?{group:r.group,animations:Object.values(r.clips).map(a=>a.getClip())}:null;},
    setScale(id,x,y,z){remotes.get(id)?.group.scale.set(x,y,z);},
    castleAction(action){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:"castle_action",action}));},
    warehouseAction(action){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:"warehouse_action",action}));},
    action(type,index,hidden){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type,index,hidden}));},
    selfId(){return publicId;},
    sendKey(index){
      if(ws?.readyState!==WebSocket.OPEN||Date.now()-(lastKey.get(index)||0)<500)return;
      lastKey.set(index,Date.now());ws.send(JSON.stringify({type:"key",index}));
    },
    tryFinish(){
      if(ws?.readyState!==WebSocket.OPEN||Date.now()-lastFinish<700)return;
      lastFinish=Date.now();ws.send(JSON.stringify({type:"finish"}));
    },
    tick(dt){
      for(const r of remotes.values()){
        const alpha=Math.min(1,Math.max(0,dt*13));
        r.group.position.lerp(new THREE.Vector3(r.x,r.y,r.z),alpha);
        const offset=Math.atan2(Math.sin(r.h-r.group.rotation.y),Math.cos(r.h-r.group.rotation.y));
        r.group.rotation.y+=offset*alpha;
        r.animationTime+=dt;
        const local=getLocalPosition?.();
        const interval=local&&r.group.position.distanceToSquared(local)>900?.1:.05;
        if(r.animationTime>=interval){selectAnimation(r,r.anim);r.mixer?.update(r.animationTime);r.animationTime=0;}
      }
    },
    close(){closed=true;voice.close();ws?.close();for(const key of [...remotes.keys()])removeRemote(key);models.close()}
  };
}
