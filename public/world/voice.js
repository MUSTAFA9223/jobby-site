import {VOICE_RATE,clientFrame,readFrame} from "./voice-protocol.js";

export function createRoomVoice({mount,send,sendAudio}){
  let selfId="",players=[],connected=false,joining=false,joined=false,muted=false,silent=false;
  let context=null,stream=null,capture=null,source=null,output=null,sequence=0,generation=0,closed=false;
  const queues=new Map(),playing=new Set();
  const panel=document.createElement("section");panel.className="room-voice";panel.setAttribute("aria-label","Room voice chat");
  const controls=document.createElement("div");controls.className="voice-buttons";
  const mic=document.createElement("button"),speaker=document.createElement("button"),leave=document.createElement("button");
  for(const button of [mic,speaker,leave]){button.type="button";controls.append(button);}
  mic.textContent="🎙 JOIN VOICE";speaker.textContent="🔊 SOUND ON";leave.textContent="LEAVE VOICE";
  const status=document.createElement("p");status.className="voice-status";status.setAttribute("role","status");
  panel.append(controls,status);mount.append(panel);
  function paint(note){
    const count=players.filter(p=>p.voice&&p.id!==selfId).length+(joined?1:0);
    mic.disabled=!connected||joining;mic.textContent=joining?"CONNECTING…":!joined?"🎙 JOIN VOICE":muted?"🔇 UNMUTE MIC":"🎙 MUTE MIC";
    mic.setAttribute("aria-pressed",String(joined&&!muted));
    speaker.hidden=leave.hidden=!joined;speaker.textContent=silent?"🔇 SOUND OFF":"🔊 SOUND ON";
    status.textContent=note||(!connected?"Voice reconnects when the room connects.":!joined?`${count} in voice · Tap JOIN VOICE to enable your microphone.`:`${count} in voice · ${muted?"Your mic is muted.":"Your mic is on."}`);
  }
  function announce(){send({type:"voice",joined,muted:joined&&muted});}
  function stop(note){
    generation++;joining=false;joined=false;muted=false;
    if(capture){capture.port.onmessage=null;capture.disconnect();capture=null;}
    source?.disconnect();source=null;
    stream?.getTracks().forEach(track=>track.stop());stream=null;
    for(const node of playing){try{node.stop()}catch{}}playing.clear();queues.clear();
    const old=context;context=null;output=null;if(old)void old.close().catch(()=>{});
    announce();paint(note);
  }
  async function join(){
    if(!connected||joining||closed)return;
    const AudioClass=window.AudioContext||window.webkitAudioContext;
    if(!isSecureContext||!navigator.mediaDevices?.getUserMedia||!AudioClass){paint("Voice needs HTTPS and a browser with microphone support. Open in Chrome or Safari.");return;}
    joining=true;const attempt=++generation;paint();
    try{
      context=new AudioClass({latencyHint:"interactive"});const current=context;
      await current.resume();
      if(attempt!==generation||closed)return;
      if(!current.audioWorklet)throw Error("unsupported");
      const obtained=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});
      if(attempt!==generation||closed){obtained.getTracks().forEach(t=>t.stop());return;}
      stream=obtained;
      await current.audioWorklet.addModule(new URL("./voice-capture.js",import.meta.url));
      if(attempt!==generation||closed)return;
      output=current.createGain();output.gain.value=silent?0:1;output.connect(current.destination);
      source=current.createMediaStreamSource(stream);
      capture=new AudioWorkletNode(current,"jobby-voice-capture",{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
      capture.port.onmessage=event=>{if(joined&&!muted&&connected&&event.data instanceof ArrayBuffer)sendAudio(clientFrame(new Int16Array(event.data),sequence++));};
      // The processor outputs silence: your own microphone is never monitored.
      source.connect(capture);capture.connect(current.destination);
      joined=true;joining=false;muted=false;
      for(const track of stream.getAudioTracks())track.onended=()=>{if(joined)stop("Microphone stopped. Tap JOIN VOICE to reconnect.");};
      announce();paint();
    }catch(error){
      if(attempt!==generation||closed)return;
      const message=error.name==="NotAllowedError"?"Microphone access was denied. Allow it in browser site settings, then tap JOIN VOICE.":error.name==="NotFoundError"?"No microphone was found.":"Could not start voice. Open this page in Chrome or Safari and try again.";
      stop(message);
    }
  }
  mic.onclick=()=>{
    if(!joined){void join();return;}
    muted=!muted;stream?.getAudioTracks().forEach(track=>track.enabled=!muted);announce();paint();
    if(context?.state==="suspended")void context.resume().catch(()=>{});
  };
  speaker.onclick=()=>{if(context&&context.state!=="running"){void context.resume().then(()=>paint()).catch(()=>paint("Audio is paused. Tap SOUND ON to resume."));return;}silent=!silent;if(output)output.gain.value=silent?0:1;paint();};
  leave.onclick=()=>stop("You left voice. Tap JOIN VOICE to reconnect.");
  function audio(buffer){
    if(!joined||!context||!output||context.state!=="running")return;
    const frame=readFrame(buffer);if(!frame||frame.id===selfId||!players.some(p=>p.id===frame.id&&p.voice&&!p.muted))return;
    const old=queues.get(frame.id);
    // Reject duplicate/out-of-order packets, including sequence wraparound.
    if(old){const diff=(frame.sequence-old.sequence+65536)%65536;if(diff===0||diff>32768)return;}
    const now=context.currentTime;
    let next=old?.next||now+.06;
    if(next>now+.32)return;
    if(next<now)next=now+.06;
    const bufferNode=context.createBuffer(1,frame.samples.length,VOICE_RATE);bufferNode.copyToChannel(frame.samples,0);
    const node=context.createBufferSource();node.buffer=bufferNode;node.connect(output);playing.add(node);
    node.onended=()=>{playing.delete(node);node.disconnect();};node.start(next);
    queues.set(frame.id,{next:next+bufferNode.duration,sequence:frame.sequence});
  }
  const unload=()=>stop();window.addEventListener("pagehide",unload);
  paint();
  return {
    roster(list,id){players=list||[];if(id)selfId=id;connected=true;for(const key of queues.keys())if(!players.some(p=>p.id===key&&p.voice))queues.delete(key);paint();},
    state(message){players=players.map(p=>p.id===message.id?{...p,voice:message.joined===true,muted:message.muted===true}:p);paint();},
    audio,
    disconnected(){connected=false;stop("Room disconnected. Rejoin voice after reconnecting.");},
    close(){closed=true;connected=false;stop();window.removeEventListener("pagehide",unload);panel.remove();}
  };
}
