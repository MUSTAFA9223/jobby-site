import test from "node:test";
import assert from "node:assert/strict";
import {VoiceFramer,VOICE_SAMPLES,clientFrame,relayFrame,readFrame} from "../public/world/voice-protocol.js";
import {segmentHitsBox,wallHidesAvatar} from "../public/world/camera-occlusion.js";

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
test("Walls covering feet/head/side fade even when the center sight line is clear",()=>{
 const player={x:0,y:0,z:0},camera={x:0,y:2,z:7};
 const footWall=box(-1,0,1,1,.5,1.1);
 assert.equal(segmentHitsBox(camera,{x:0,y:1.3,z:0},footWall,0),false,"old middle-only test misses this obstacle");
 assert.equal(wallHidesAvatar(camera,player,footWall),true);
 assert.equal(wallHidesAvatar(camera,player,box(.5,.3,.5,.7,2,.7)),true,"partial silhouette obstruction");
 assert.equal(wallHidesAvatar(camera,player,box(-1,1.7,1,1,2.1,1.1)),true,"head obstruction");
 assert.equal(wallHidesAvatar(camera,player,box(-1,0,-4,1,4,-3)),false,"wall behind player stays opaque");
 assert.equal(wallHidesAvatar(camera,player,box(-1,0,8,1,4,9)),false,"wall beyond camera stays opaque");
 assert.equal(wallHidesAvatar(camera,player,box(-.2,0,6.8,.2,4,7.2)),true,"camera inside or touching wall");
 for(const [x,z] of [[7,0],[-7,0],[0,-7],[5,5]]){
  assert.equal(wallHidesAvatar({x,y:2,z},player,box(x*.45-.3,0,z*.45-.3,x*.45+.3,3,z*.45+.3)),true,"camera orbit stays protected");
 }
});
