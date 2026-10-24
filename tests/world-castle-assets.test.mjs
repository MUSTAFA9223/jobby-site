import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {buildCastle} from "../public/world/castle-scene.js";
import * as map from "../public/world/castle-layout.js";
const root=new URL("../public/world/",import.meta.url);
const manifests=["castle","dungeon"].map(pack=>({...JSON.parse(readFileSync(new URL("models/"+pack+"/manifest.json",root))),pack}));
test("Both complete CC0 packs contain 124 valid finite models and intact original downloads",()=>{
 for(const pack of manifests){
  assert.equal(pack.models.length,pack.pack==="castle"?76:48);assert.equal(new Set(pack.models.map(m=>m.id)).size,pack.models.length);
  for(const m of pack.models){const file=new URL("models/"+pack.pack+"/"+m.file,root),data=readFileSync(file);assert.equal(data.readUInt32LE(0),0x46546c67);assert.equal(data.readUInt32LE(4),2);assert.equal(data.length,data.readUInt32LE(8));const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());assert.ok(json.meshes.length);for(const a of json.accessors){for(const value of [...(a.min||[]),...(a.max||[])])assert.ok(Number.isFinite(value));}for(const image of json.images||[])if(image.uri&&!image.uri.startsWith("data:"))assert.ok(existsSync(new URL(image.uri,file)),image.uri);}
  const source=readFileSync(new URL("models/"+pack.pack+"/SOURCE.txt",root),"utf8"),archive=readFileSync(new URL("packs/"+(pack.pack==="castle"?"kenney_castle-kit.zip":"quaternius_modular-dungeons.zip"),root));assert.ok(source.includes(createHash("sha256").update(archive).digest("hex")));assert.match(readFileSync(new URL("models/"+pack.pack+"/LICENSE.txt",root),"utf8"),/CC0|Creative Commons Zero/i);
 }
});
test("Castle instancing loads real pack geometry, replaces every wall and keeps opaque architecture with finite transforms",async t=>{
 const original=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};t.after(()=>{if(original===undefined)delete globalThis.document;else globalThis.document=original;});
 const loader=new GLTFLoader();loader.register(()=>({name:"test-no-gpu-texture",loadTexture:()=>Promise.resolve(new THREE.Texture())}));
 const loaded=[];
 const assetLoader={async loadAsync(url){const data=readFileSync(new URL(url,root));loaded.push(url);return loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),"");}};
 const scene=new THREE.Scene(),arena=buildCastle(scene,{assetLoader}),metrics=await arena.ready;
 assert.deepEqual(metrics.failed,[]);assert.equal(metrics.loaded,metrics.requested);assert.equal(new Set(loaded).size,loaded.length,"download each model only once");assert.ok(loaded.some(s=>s.includes("castle/wall")));assert.ok(loaded.some(s=>s.includes("dungeon/wall-modular")));assert.ok(metrics.instances>250);
 scene.updateMatrixWorld(true);let instances=0,visibleFallbackWalls=0;
 scene.traverse(n=>{if(n.isInstancedMesh){instances++;const matrix=new THREE.Matrix4();for(let i=0;i<n.count;i++){n.getMatrixAt(i,matrix);assert.ok(matrix.elements.every(Number.isFinite));}for(const m of Array.isArray(n.material)?n.material:[n.material]){assert.equal(m.transparent,false);assert.equal(m.opacity,1);}}else if(n.isMesh&&n.visible&&n.geometry.type==="BoxGeometry"&&n.position.y>1.3&&n.parent===scene)visibleFallbackWalls++;});
 assert.ok(instances<85,"bounded model draw count for mobile");assert.equal(visibleFallbackWalls,0,"all wall models loaded");assert.equal(arena.blocks.length,map.SOLIDS.length+1);
 const r={tasks:[],gateUntil:0,fuse:{owner:null,installed:false},crates:map.CRATE_SPAWNS.map(p=>({...p,owner:null,symbol:0}))};arena.updateRound(r,1000,"solo",map.SPAWN);assert.equal(arena.shutter.position.y,0);r.gateUntil=5000;arena.updateRound(r,2000,"solo",map.SPAWN);assert.equal(arena.shutter.position.y,3.2);assert.ok(arena.blocks.at(-1).box.min.y>2);
});
