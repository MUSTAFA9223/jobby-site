import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AVATARS,canUseAvatar} from '../public/world/characters.js';
const root=new URL('../public/world/',import.meta.url);

test('All 47 arrivals stay locked even with a forged ownership list and a full wallet',()=>{
 assert.equal(AVATARS.length,53);
 assert.equal(new Set(AVATARS.map(a=>a.id)).size,53);
 const arrivals=AVATARS.filter(a=>a.locked);
 assert.equal(arrivals.length,47);
 const forged={points:1000000,unlocked:AVATARS.map(a=>a.id)};
 for(const avatar of arrivals){
  assert.equal(canUseAvatar(avatar,forged),false,avatar.id);
  assert.equal(avatar.cost,null,'No unrequested price is assigned');
 }
 assert.deepEqual(AVATARS.filter(a=>canUseAvatar(a)).map(a=>a.id),['JOBBY','Casual_Male','Ninja_Male','Pug']);
 for(const [id,cost] of [['Wizard',80],['Pirate_Female',120]]){
  const hero=AVATARS.find(a=>a.id===id);
  assert.equal(hero.cost,cost);assert.equal(canUseAvatar(hero),false);
  assert.equal(canUseAvatar(hero,{unlocked:[id]}),true);
 }
});

test('All original 52 models load with 881 animations, rigs and materials; gallery uses small local portraits',async()=>{
 let animations=0,portraitBytes=0;
 for(const a of AVATARS){
  assert.ok(statSync(new URL(a.portrait,root)).size>0,a.id+' portrait');
  if(a.id==='JOBBY')continue; // JOBBY retains the existing Worker model route.
  const data=readFileSync(new URL('models/'+a.id+'.glb',root));
  assert.equal(data.length,a.size,a.id+' recorded size');
  assert.equal(data.readUInt32LE(8),data.length,a.id+' GLB length');
  const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  assert.ok(gltf.animations.length>=14,a.id+' animations');animations+=gltf.animations.length;
  let skinned=0;gltf.scene.traverse(node=>{if(node.isSkinnedMesh){skinned++;assert.ok(node.skeleton.bones.length);assert.ok(node.material);}});
  assert.ok(skinned>0,a.id+' rig');
  portraitBytes+=statSync(new URL(a.portrait,root)).size;
 }
 assert.equal(animations,881);
 assert.ok(portraitBytes<300000,'Entire collection portraits stay below 300 KB');
});
