// Runs the real Three.js scene and solo rules with only GPU/DOM I/O replaced.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as THREE from "three";
import * as house from "../public/world/house-layout.js";
import {buildHouse} from "../public/world/house-scene.js";
import {safeCameraPosition} from "../public/world/camera-occlusion.js";

class Element{
 constructor(){this.children=[];this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){},contains:()=>true};}
 append(...nodes){this.children.push(...nodes);}prepend(node){this.children.unshift(node);}replaceChildren(...nodes){this.children=nodes;}
 addEventListener(){}setPointerCapture(){}querySelector(){return new Element();}
 getContext(){return {fillText(){},fillRect(){},clearRect(){},beginPath(){},arc(){},fill(){},moveTo(){},lineTo(){},stroke(){}};}
}
test("House scene boots and solo tasks/hiding/catches/rewards work with real geometry",async t=>{
 const previous=globalThis.document;
 const ids=new Map([...readFileSync(new URL("../public/world/house.html",import.meta.url),"utf8").matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const document={body:new Element(),createElement:()=>new Element(),getElementById:id=>{assert.ok(ids.has(id),"HTML contains "+id);return ids.get(id);}};
 globalThis.document=document;t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
 let renders=0;
 class Renderer{constructor(){this.domElement=new Element();this.shadowMap={};}setPixelRatio(){}setSize(){}render(scene){renders++;scene.updateMatrixWorld(true);scene.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));});}}
 class Loader{async loadAsync(){const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial()));return {scene,animations:[]};}}
 const source=readFileSync(new URL("../public/world/house-game.js",import.meta.url),"utf8").replace(/^import .*;\n/gm,"");
 const run=new Function("saveSelection","beginPlayerRun","recordPlayerTask","finishPlayerRun","syncProfile","THREE","GLTFLoader","connectCoop","safeCameraPosition","house","buildHouse","document","navigator","window","location","localStorage","sessionStorage","innerWidth","innerHeight","devicePixelRatio","requestAnimationFrame",source+"\nreturn {start,frame,interact,updateInteraction,caught,move:(x,z)=>{px=x;pz=z;},read:()=>({px,pz,tasks:[...tasks],hidden,started,points:saved.points})};");
 const storage={getItem:()=>null,setItem(){}},game=run(()=>{},()=>{},()=>{},()=>{},()=>{}, {...THREE,WebGLRenderer:Renderer},Loader,()=>{throw Error("solo opened room connection");},safeCameraPosition,house,buildHouse,document,{maxTouchPoints:1},{addEventListener(){}},{search:""},storage,storage,390,844,1,()=>0);
 assert.equal(renders,1);await game.start();assert.equal(game.read().started,true);
 game.move(house.TASKS[0].x,house.TASKS[0].z);game.interact();game.updateInteraction(performance.now()+house.TASK_MS+5);
 assert.deepEqual(game.read().tasks,[0]);assert.equal(game.read().points,10);
 game.move(house.HIDES[0].x,house.HIDES[0].z);game.interact();assert.equal(game.read().hidden,true);
 game.interact();assert.equal(game.read().hidden,false);game.caught();assert.equal(game.read().pz,house.SPAWN.z);assert.deepEqual(game.read().tasks,[0]);
 game.move(house.EXITS[1].x,house.EXITS[1].z);game.frame();assert.equal(game.read().started,true,"unpowered garage remains locked");
 game.move(house.EXITS[0].x,house.EXITS[0].z);game.frame();assert.equal(game.read().started,false);assert.equal(game.read().points,60);
});
