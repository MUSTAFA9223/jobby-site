import test from 'node:test';
import assert from 'node:assert/strict';
import {createWallCamera,moveWithSliding} from '../public/world/castle-motion.js';
import {cameraClearance} from '../public/world/camera-occlusion.js';
import * as map from '../public/world/castle-layout.js';
import * as rules from '../public/world/castle-rules.js';

const wall={min:{x:-20,y:0,z:0},max:{x:20,y:4,z:.6}};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const desired=f=>({x:f.x,y:f.y+2.45,z:f.z+6.13});

test('Camera stays steady near the former overhead threshold at 30/60/120 fps',()=>{
 for(const fps of [30,60,120]){
  const update=createWallCamera();let previous=null;
  for(let i=0;i<fps*5;i++){
   const focus={x:0,y:1.3,z:-1.83+Math.sin(i/fps*6)*.015};
   const camera=update(focus,desired(focus),[wall],1/fps);
   assert.ok(Object.values(camera).every(Number.isFinite));
   assert.ok(dist(camera,cameraClearance(focus,camera,[wall]))<1e-8,'wall stays outside sight line');
   if(previous)assert.ok(dist(camera,previous)<.08,`camera jumped ${dist(camera,previous)} at ${fps} fps`);
   previous=camera;
  }
 }
});

test('Camera follows wall sliding without world-space lag or feedback and recovers in open space',()=>{
 const update=createWallCamera();let previous;
 for(let i=0;i<240;i++){
  const focus={x:i/60*4,y:1.3,z:-.64};
  const camera=update(focus,desired(focus),[wall],1/60);
  assert.equal(camera.x,focus.x);
  assert.ok(camera.y>focus.y+5,'tight space retains an overhead view');
  assert.ok(dist(camera,cameraClearance(focus,camera,[wall]))<1e-8);
  if(previous)assert.ok(Math.abs(camera.y-previous.y)<1e-8,'stationary clearance never oscillates');
  previous=camera;
 }
 const focus={x:0,y:1.3,z:-10};let camera;
 for(let i=0;i<180;i++)camera=update(focus,desired(focus),[wall],1/60);
 assert.ok(dist(camera,desired(focus))<.001,'returns within one millimetre of user orbit');
});

test('Approaching and leaving a wall never pops outward when the camera clears its top',()=>{
 for(const fps of [25,30,60,120]){
  const update=createWallCamera();let previous;
  for(let i=0;i<fps*10;i++){
   const t=i/fps,focus={x:0,y:1.3,z:t<5?-8+Math.min(t*2,7.36):-.64-Math.min((t-5)*2,7.36)};
   const camera=update(focus,desired(focus),[wall],1/fps);
   assert.ok(dist(camera,cameraClearance(focus,camera,[wall]))<1e-8);
   if(previous)assert.ok(dist(camera,previous)<12/fps,'continuous frame-rate-scaled transition');
   previous=camera;
  }
 }
});

test('Diagonal running contacts a wall and slides without rebound at different frame rates',()=>{
 const blocked=(x,z)=>Math.abs(x)<.63&&Math.abs(z)<10;
 for(const fps of [25,30,60,120]){
  let p={x:-2,z:-5},previousX=p.x;
  for(let i=0;i<fps;i++){
   p=moveWithSliding(p.x,p.z,4.8/fps,4.8/fps,blocked);
   assert.ok(!blocked(p.x,p.z));assert.ok(p.x>=previousX,'never rebounds');previousX=p.x;
  }
  assert.ok(Math.abs(p.x+.63)<.00001,'stable contact independent of frame size');
  assert.ok(Math.abs(p.z+.2)<1e-9,'full tangential movement');
  const held=moveWithSliding(p.x,p.z,1,0,blocked);
  assert.ok(Math.abs(held.x-p.x)<.00001,'held input into wall stays still');
 }
});

test('Thin walls, castle corners and the closed vault cannot be crossed',()=>{
 const thin=(x,z)=>Math.abs(x)<.35;
 assert.ok(moveWithSliding(-1,0,3,0,thin).x<=-.35);
 const round=rules.newRound(10,0,true),blocked=(x,z)=>rules.isBlocked(round,x,z,0);
 for(const b of map.WALLS){
  const start={x:b.x-b.w/2-.34,z:b.z};
  if(blocked(start.x,start.z))continue;
  let p=start;
  for(let i=0;i<100;i++){
   p=moveWithSliding(p.x,p.z,.12,.04,blocked);
   assert.ok(!blocked(p.x,p.z),'castle slide always leaves a valid position');
  }
 }
 const p=moveWithSliding(-13.8,16,-3,0,blocked);
 assert.ok(p.x>=-15+map.DOOR.w/2+.33,'closed door remains solid');
});
