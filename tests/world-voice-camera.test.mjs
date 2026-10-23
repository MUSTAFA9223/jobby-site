import test from "node:test";
import assert from "node:assert/strict";
import {VoiceFramer,VOICE_SAMPLES,clientFrame,relayFrame,readFrame} from "../public/world/voice-protocol.js";
import {cameraClearance,safeCameraPosition} from "../public/world/camera-occlusion.js";

test("Microphone frame sizes, sample timing and PCM survive native audio sample rates",()=>{
 for(const rate of [16000,44100,48000,96000]){
  const encoder=new VoiceFramer(rate),input=new Float32Array(Math.round(rate*.8)).fill(.25),frames=[];
  for(let offset=0;offset<input.length;offset+=128)frames.push(...encoder.push(input.subarray(offset,offset+128)));
  assert.equal(frames.length,10,`${rate} Hz produces ten 80 ms frames without drift`);
  assert.ok(frames.every(frame=>frame.length===VOICE_SAMPLES&&frame.every(value=>Math.abs(value-8192)<=1)));
  const packet=readFrame(relayFrame(clientFrame(frames[0],65535),"a1".repeat(16)));
  assert.equal(packet.sequence,65535);assert.equal(packet.id,"a1".repeat(16));
  assert.ok(packet.samples.every(value=>Math.abs(value-.25)<.0001));
 }
});

test("Voice protocol clips invalid microphone samples and rejects malformed packets",()=>{
 const encoder=new VoiceFramer(16000),values=new Float32Array(VOICE_SAMPLES).fill(Infinity);
 values[0]=2;values[1]=-2;values[2]=NaN;
 const frame=encoder.push(values)[0];assert.equal(frame[0],32767);assert.equal(frame[1],-32768);assert.equal(frame[2],0);
 assert.equal(readFrame(new ArrayBuffer(2)),null);assert.equal(relayFrame(clientFrame(frame,0),"fake-sender"),null);
 assert.equal(readFrame(new Uint8Array(19+VOICE_SAMPLES*2).buffer),null);
});

const box=(x1,y1,z1,x2,y2,z2)=>({min:{x:x1,y:y1,z:z1},max:{x:x2,y:y2,z:z2}});
test("Camera stays clear of walls at every orbit angle without changing wall opacity",()=>{
 const focus={x:0,y:1.3,z:0};
 for(const [x,z] of [[7,0],[-7,0],[0,7],[0,-7],[5,5]]){
  const wall=box(x*.5-.4,0,z*.5-.4,x*.5+.4,5,z*.5+.4);
  const desired={x,y:3,z},safe=cameraClearance(focus,desired,[wall]);
  assert.ok(Math.hypot(safe.x,safe.z)<Math.hypot(x,z)*.5);
  assert.deepEqual(cameraClearance(focus,safe,[wall]),safe,"smoothing cannot cross a wall");
 }
 const clear={x:0,y:3,z:7};assert.deepEqual(safeCameraPosition(focus,clear,[]),clear);
 const near=box(-2,0,.4,2,5,.6);
 const overhead=safeCameraPosition(focus,clear,[{box:near}]);
 assert.ok(overhead.y>6);assert.ok(overhead.z<.01,"tight corner switches overhead");
 const inside=cameraClearance(focus,{x:0,y:2,z:3},[box(-2,0,2,2,5,4)]);
 assert.ok(inside.z<1.82,"camera goal inside a wall is clipped before its surface");
 assert.deepEqual(cameraClearance(focus,clear,[box(4,0,0,6,5,8)]),clear,"parallel wall away from camera does not block");
});
