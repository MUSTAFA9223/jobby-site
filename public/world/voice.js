import {VOICE_RATE,clientFrame,readFrame} from "./voice-protocol.js";

export function createRoomVoice({mount,send,sendAudio}){
  let selfId="",players=[],connected=false,joining=false,joined=false,muted=false,silent=false;
  let context=null,stream=null,capture=null,source=null,output=null,sequence=0,generation=0,closed=false;
  let pushMode=false,talkHeld=false,remoteUntil=0,expanded=false,noticeTimer=null;
  const queues=new Map(),playing=new Set();
  const panel=document.createElement("section");panel.className="room-voice";panel.setAttribute("aria-label","Room voice chat");
  const controls=document.createElement("div");controls.className="voice-buttons";
  const mic=document.createElement("button"),speaker=document.createElement("button"),leave=document.createElement("button"),mode=document.createElement("button"),talk=document.createElement("button"),more=document.createElement("button");
  const options=document.createElement("div");options.className="voice-options";options.hidden=true;
  for(const button of [mic,speaker,more,talk]){button.type="button";controls.append(button);}
  for(const button of [mode,leave]){button.type="button";options.append(button);}
  const svg=path=>'<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+path+'</svg>';
  const micShape='<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M9 22h6"/>';
  const soundShape='<path d="m11 5-6 4H2v6h3l6 4z"/>';
  const slash='<path d="m3 3 18 18"/>';
  const label=(button,value)=>{button.setAttribute("aria-label",value);button.title=value;};
  mic.className="voice-icon voice-mic";speaker.className="voice-icon voice-speaker";more.className="voice-icon voice-more";talk.className="voice-icon voice-talk";
  more.innerHTML=svg('<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>');
  label(more,"Voice options");more.setAttribute("aria-expanded","false");more.setAttribute("aria-haspopup","true");
  leave.textContent="LEAVE VOICE";
  const status=document.createElement("p");status.className="voice-status";status.setAttribute("role","status");
  panel.append(controls,options,status);mount.append(panel);
  function paint(note){
    const count=players.filter(p=>p.voice&&p.id!==selfId).length+(joined?1:0);
    mic.disabled=!connected||joining;label(mic,joining?"Connecting to voice":!joined?"Join voice":muted?"Unmute microphone":"Mute microphone");
    mic.innerHTML=svg(micShape+(joined&&muted?slash:""));mic.dataset.state=joining?"joining":!joined?"off":muted?"muted":"on";
    mic.setAttribute("aria-pressed",String(joined&&!muted));
    speaker.disabled=!joined;label(speaker,!joined?"Join voice to enable room sound":silent?"Turn room sound on":"Turn room sound off");
    speaker.innerHTML=svg(soundShape+(silent?slash:'<path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>'));speaker.dataset.state=joined&&!silent?"on":"off";speaker.setAttribute("aria-pressed",String(joined&&!silent));
    more.hidden=!joined;if(!joined)expanded=false;options.hidden=!expanded;more.setAttribute("aria-expanded",String(expanded));
    mode.textContent=pushMode?"MODE: HOLD TO TALK":"MODE: OPEN MIC";
    talk.hidden=!joined||!pushMode;talk.disabled=muted;label(talk,talkHeld?"Talking — release to mute":"Hold to talk");talk.innerHTML=svg(micShape+'<path d="M3 3v2M21 3v2"/>');talk.setAttribute("aria-pressed",String(talkHeld));
    status.textContent=note||(!connected?"Voice reconnects when the room connects.":!joined?`${count} in voice · Tap the microphone to enable your microphone.`:`${count} in voice · ${muted?"Your mic is muted.":pushMode?"Hold the talk button to speak.":"Echo guard active. Use HOLD TO TALK near other phones."}`);
    if(note&&!closed){panel.classList.add("has-notice");clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>panel.classList.remove("has-notice"),5500);}
  }
  const transmitting=()=>joined&&!muted&&(!pushMode||talkHeld);
  function announce(){send({type:"voice",joined,muted:!transmitting()});}
  function updateMic(){stream?.getAudioTracks().forEach(track=>track.enabled=transmitting());if(output)output.gain.value=silent||(pushMode&&talkHeld)?0:.85;announce();paint();}
  function stop(note){
    generation++;joining=false;joined=false;muted=false;talkHeld=false;remoteUntil=0;
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
      const obtained=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false,channelCount:1},video:false});
      if(attempt!==generation||closed){obtained.getTracks().forEach(t=>t.stop());return;}
      stream=obtained;
      await current.audioWorklet.addModule(new URL("./voice-capture.js?v=2",import.meta.url));
      if(attempt!==generation||closed)return;
      output=current.createGain();output.gain.value=silent?0:1;output.connect(current.destination);
      source=current.createMediaStreamSource(stream);
      capture=new AudioWorkletNode(current,"jobby-voice-capture",{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
      capture.port.onmessage=event=>{
        if(!transmitting()||!connected||!(event.data instanceof ArrayBuffer))return;
        // Native AEC is not enough for every speakerphone. Do not send room
        // playback straight back while it is audible (plus a short acoustic tail).
        if(!pushMode&&!silent&&current.currentTime<remoteUntil)return;
        sendAudio(clientFrame(new Int16Array(event.data),sequence++));
      };
      // The processor outputs silence: your own microphone is never monitored.
      source.connect(capture);capture.connect(current.destination);
      joined=true;joining=false;muted=false;
      for(const track of stream.getAudioTracks())track.onended=()=>{if(joined)stop("Microphone stopped. Tap the microphone to reconnect.");};
      updateMic();
    }catch(error){
      if(attempt!==generation||closed)return;
      const message=error.name==="NotAllowedError"?"Microphone access was denied. Allow it in browser site settings, then tap the microphone.":error.name==="NotFoundError"?"No microphone was found.":"Could not start voice. Open this page in Chrome or Safari and try again.";
      stop(message);
    }
  }
  mic.onclick=()=>{
    if(!joined){void join();return;}
    muted=!muted;talkHeld=false;updateMic();
    if(context?.state==="suspended")void context.resume().catch(()=>{});
  };
  speaker.onclick=()=>{if(context&&context.state!=="running"){void context.resume().then(()=>paint()).catch(()=>paint("Audio is paused. Tap SOUND ON to resume."));return;}silent=!silent;updateMic();};
  more.onclick=()=>{expanded=!expanded;paint();};
  mode.onclick=()=>{pushMode=!pushMode;talkHeld=false;expanded=false;updateMic();};
  const outside=event=>{if(expanded&&!panel.contains(event.target)){expanded=false;paint();}};
  const escape=event=>{if(event.key==="Escape"){expanded=false;paint();releaseTalk();}};
  window.addEventListener("pointerdown",outside);window.addEventListener("keydown",escape);
  const releaseTalk=()=>{if(talkHeld){talkHeld=false;updateMic();}};
  talk.onpointerdown=event=>{if(!joined||muted||!pushMode)return;event.preventDefault();talk.setPointerCapture?.(event.pointerId);talkHeld=true;updateMic();};
  talk.onpointerup=talk.onpointercancel=talk.onlostpointercapture=releaseTalk;
  window.addEventListener("blur",releaseTalk);
  leave.onclick=()=>stop("You left voice. Tap the microphone to reconnect.");
  function audio(buffer){
    if(!joined||!context||!output||context.state!=="running"||(pushMode&&talkHeld))return;
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
    if(!silent)remoteUntil=Math.max(remoteUntil,next+bufferNode.duration+.18);
    queues.set(frame.id,{next:next+bufferNode.duration,sequence:frame.sequence});
  }
  const unload=()=>stop();window.addEventListener("pagehide",unload);
  paint();
  return {
    roster(list,id){players=list||[];if(id)selfId=id;connected=true;for(const key of queues.keys())if(!players.some(p=>p.id===key&&p.voice))queues.delete(key);paint();},
    state(message){players=players.map(p=>p.id===message.id?{...p,voice:message.joined===true,muted:message.muted===true}:p);paint();},
    audio,
    disconnected(){connected=false;stop("Room disconnected. Rejoin voice after reconnecting.");},
    close(){closed=true;connected=false;stop();clearTimeout(noticeTimer);window.removeEventListener("pagehide",unload);window.removeEventListener("blur",releaseTalk);window.removeEventListener("pointerdown",outside);window.removeEventListener("keydown",escape);panel.remove();}
  };
}
