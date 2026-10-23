import test from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../public/world/race-rules.js';
import * as THREE from 'three';
import {buildRace} from '../public/world/race-scene.js';
test('Course is completable through real jumping, moving support, traps and sweepers',()=>{
 const p=r.newRunner();p.x=0;const checkpoints=[];let t=0;
 for(let n=0;n<120*180&&!p.finished;n++){
  t+=1/120;const next=r.PLATFORMS.filter(q=>q.z<p.z+.5).sort((a,b)=>b.z-a.z)[0];let target=next?r.platformAt(next,t+.5):{x:0};
  if(next?.trap){const row=r.PLATFORMS.filter(q=>q.trap&&q.z===next.z).map(q=>r.platformAt(q,t+.55));target=row.filter(q=>q.solid&&!q.warning).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0]||row[0];}
  const ahead=r.supportAt(p.x,p.z-1.1,t+.15),sweep=r.SPINNERS.some(s=>Math.hypot(p.x-s.x,p.z-s.z)<6);
  r.stepRunner(p,{x:Math.max(-1,Math.min(1,(target.x-p.x)*.9)),z:-1,jump:p.grounded&&(!ahead||ahead.y>p.y+.1||sweep||Math.abs(p.z+56)<2)},1/120,t);
  for(const e of p.events)if(e.type==='checkpoint')checkpoints.push(e.index);
 }
 assert.equal(p.finished,true);assert.deepEqual(checkpoints,[1,2,3]);assert.ok(t<180);assert.ok(p.z<-133);
});
test('Falls preserve checkpoints; moving floors carry racers; trapdoors really remove support',()=>{
 for(let slot=0;slot<12;slot++)assert.ok(r.supportAt(r.spawn(slot).x,r.spawn(slot).z,0));
 const p=r.newRunner(5,2);p.y=-9.1;p.grounded=false;r.stepRunner(p,{x:0,z:0},1/60,1,5);assert.equal(p.checkpoint,2);assert.equal(p.falls,1);assert.equal(p.z,r.spawn(5,2).z);
 const moving=r.PLATFORMS.find(q=>q.moving),start=r.platformAt(moving,0),rider={...r.newRunner(),x:start.x,z:start.z,platform:moving.id};r.stepRunner(rider,{x:0,z:0},.1,.1);assert.ok(Math.abs(rider.x-r.platformAt(moving,.1).x)<.001);
 const trap=r.PLATFORMS.find(q=>q.trap&&q.phase===0);assert.ok(r.platformAt(trap,2.8).warning);assert.equal(r.platformAt(trap,3.4).solid,false);
 const victim={...r.newRunner(),x:trap.x,z:trap.z};r.stepRunner(victim,{x:0,z:0},.1,3.5);assert.equal(victim.grounded,false);assert.ok(victim.y<0);
 const pushed=r.newRunner();r.impulse(pushed,1,0);r.stepRunner(pushed,{x:0,z:0},.1,1);assert.ok(pushed.x>r.spawn().x+.4);assert.ok(pushed.y>0);
 assert.equal(r.legalPose({...r.spawn(),poseAt:1000},{x:0,z:-135,y:0,h:0},1100),false);
});
test('Course geometry matches shared collision surfaces at every phase with bounded draw count',()=>{
 const scene=new THREE.Scene(),arena=buildRace(scene);let meshes=0;scene.traverse(o=>{if(o.isMesh)meshes++;});assert.ok(meshes<180);
 for(const t of [0,1,2.8,3.4,7,16]){arena.update(t);scene.updateMatrixWorld(true);for(const {p,group} of arena.platforms){const q=r.platformAt(p,t);assert.equal(group.position.x,q.x);assert.equal(group.position.z,q.z);assert.equal(group.position.y,q.y+(q.solid?0:-1.5));}scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}
});
