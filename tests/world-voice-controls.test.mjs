import test from "node:test";
import assert from "node:assert/strict";
import {createRoomVoice} from "../public/world/voice.js";
import {clientFrame,relayFrame,VOICE_SAMPLES} from "../public/world/voice-protocol.js";

test("Voice controls are opt-in, mute capture, play received PCM and release the mic",async t=>{
 const names=["window","document","navigator","isSecureContext","AudioWorkletNode"],before=new Map(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 t.after(()=>{for(const key of names){const descriptor=before.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 class Element{
  constructor(){this.children=[];this.hidden=false;}
  append(...items){this.children.push(...items);}setAttribute(){}remove(){}
 }
 const contexts=[],captures=[],tracks=[],sent=[],packets=[];let micRequests=0,denied=false,pending=null;
 class AudioContext{
  constructor(){this.state="suspended";this.currentTime=1;this.played=[];this.audioWorklet={addModule:async()=>{}};contexts.push(this);}
  async resume(){this.state="running";}async close(){this.state="closed";}
  createGain(){return {gain:{value:1},connect(){}};}
  createMediaStreamSource(){return {connect(){},disconnect(){}};}
  createBuffer(channels,length,rate){return {duration:length/rate,copyToChannel(data){this.samples=data.slice();}};}
  createBufferSource(){const self=this;return {connect(){},disconnect(){},start(time){self.played.push({time,buffer:this.buffer});},stop(){}};}
 }
 const media={getUserMedia:async constraints=>{
  micRequests++;assert.equal(constraints.video,false);
  if(denied){const error=Error("Denied");error.name="NotAllowedError";throw error;}
  if(pending)await pending.promise;
  const track={enabled:true,stopped:false,stop(){this.stopped=true;}};tracks.push(track);
  return {getTracks:()=>[track],getAudioTracks:()=>[track]};
 }};
 const env={window:{AudioContext,addEventListener(){},removeEventListener(){}},document:{createElement:()=>new Element()},navigator:{mediaDevices:media},isSecureContext:true,AudioWorkletNode:class{constructor(){this.port={onmessage:null};captures.push(this);}connect(){}disconnect(){}}};
 for(const [key,value] of Object.entries(env))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 const mount=new Element(),voice=createRoomVoice({mount,send:m=>sent.push(m),sendAudio:data=>packets.push(data)});
 const controls=mount.children[0].children[0].children,[mic,speaker,leave]=controls;
 const self="11".repeat(16),peer="22".repeat(16),roster=[{id:self,voice:false},{id:peer,voice:true,muted:false}];
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 assert.equal(micRequests,0,"loading the page must not request microphone permission");
 voice.roster(roster,self);mic.onclick();await settle();
 assert.equal(micRequests,1);assert.equal(tracks[0].enabled,true);assert.ok(sent.some(m=>m.joined===true&&!m.muted));
 captures[0].port.onmessage({data:new Int16Array(VOICE_SAMPLES).fill(3000).buffer});assert.equal(packets.length,1);
 mic.onclick();assert.equal(tracks[0].enabled,false);captures[0].port.onmessage({data:new Int16Array(VOICE_SAMPLES).buffer});assert.equal(packets.length,1,"muting also blocks outgoing audio messages");
 mic.onclick();assert.equal(tracks[0].enabled,true);
 voice.audio(relayFrame(clientFrame(new Int16Array(VOICE_SAMPLES).fill(8192),9),peer));
 assert.equal(contexts[0].played.length,1);assert.ok(Math.abs(contexts[0].played[0].buffer.samples[0]-.25)<.0001,"received PCM reaches the audio output");
 voice.audio(relayFrame(clientFrame(new Int16Array(VOICE_SAMPLES),9),peer));assert.equal(contexts[0].played.length,1,"duplicate audio is dropped");
 voice.state({id:peer,joined:false,muted:true});voice.audio(relayFrame(clientFrame(new Int16Array(VOICE_SAMPLES),10),peer));assert.equal(contexts[0].played.length,1,"audio from a player who left voice is discarded");
 speaker.onclick();assert.match(speaker.textContent,/OFF/);
 leave.onclick();assert.equal(tracks[0].stopped,true);assert.equal(contexts[0].state,"closed");assert.equal(captures[0].port.onmessage,null);
 denied=true;mic.onclick();await settle();assert.match(mount.children[0].children[1].textContent,/denied/);assert.equal(contexts[1].state,"closed");
 denied=false;pending={};pending.promise=new Promise(resolve=>pending.resolve=resolve);
 mic.onclick();await settle();voice.disconnected();pending.resolve();await settle();
 assert.equal(tracks.at(-1).stopped,true,"late permission approval after disconnection never leaves the microphone running");
 voice.close();
});
