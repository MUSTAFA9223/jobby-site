import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as THREE from "three";
import * as house from "../public/world/castle-layout.js";
import * as rules from "../public/world/castle-rules.js";
import {buildCastle} from "../public/world/castle-scene.js";
import {createWallCamera,moveWithSliding} from "../public/world/castle-motion.js";
class Element{
 constructor(){this.children=[];this.style={setProperty(){}};const flags=new Set(["hidden"]);this.classList={add:k=>flags.add(k),remove:k=>flags.delete(k),toggle:k=>flags.has(k)?flags.delete(k):flags.add(k),contains:k=>flags.has(k)};}
 append(...n){this.children.push(...n);}prepend(n){this.children.unshift(n);}replaceChildren(...n){this.children=n;}addEventListener(){}setPointerCapture(){}querySelector(){return new Element();}
 getContext(){return {fillText(){},fillRect(){},clearRect(){},beginPath(){},arc(){},fill(){},moveTo(){},lineTo(){},stroke(){}};}
}
test("Real castle scene and mobile game complete all puzzles, carry cargo and save 80 solo points",async t=>{
 const previous=globalThis.document,ids=new Map([...readFileSync(new URL("../public/world/castle.html",import.meta.url),"utf8").matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const document={body:new Element(),createElement:()=>new Element(),getElementById:id=>{assert.ok(ids.has(id),id);return ids.get(id);}};globalThis.document=document;t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
 let now=1000,renders=0;const tasks=[];class Renderer{constructor(){this.domElement=new Element();this.shadowMap={};}setPixelRatio(){}setSize(){}render(scene){renders++;scene.updateMatrixWorld(true);scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}}
 class Loader{async loadAsync(){const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial()));return {scene,animations:[]};}}
 const source=readFileSync(new URL("../public/world/castle-game.js",import.meta.url),"utf8").replace(/^import .*;\n/gm,"");
 const run=new Function("saveSelection","beginPlayerRun","recordPlayerTask","finishPlayerRun","syncProfile","THREE","GLTFLoader","connectCoop","createWallCamera","moveWithSliding","house","rules","buildCastle","document","navigator","window","location","localStorage","sessionStorage","innerWidth","innerHeight","devicePixelRatio","requestAnimationFrame","performance",source+"\nreturn {start,frame,interact,updateInteraction,doAction,move:(p)=>{px=p.x;pz=p.z;},read:()=>({round,tasks,points:saved.points,started,finished})};");
 const storage={getItem:()=>null,setItem(){}},game=run(()=>{},()=>{},i=>tasks.push(i),()=>{},()=>{}, {...THREE,WebGLRenderer:Renderer},Loader,()=>{throw Error("unexpected co-op")},createWallCamera,moveWithSliding,house,rules,s=>buildCastle(s,{loadAssets:false}),document,{maxTouchPoints:1},{addEventListener(){}},{search:""},storage,storage,390,844,1,()=>0,{now:()=>now});
 assert.equal(renders,1);await game.start();game.move(house.STATIONS.panel);for(const symbol of game.read().round.code)game.doAction({type:"symbol",symbol});assert.equal(game.read().points,10);
 game.move(house.STATIONS.lever);game.interact();
 function hold(point,ms){game.move(point);game.interact();now+=ms+100;game.updateInteraction(now);}
 hold(house.STATIONS.fuse,800);assert.equal(game.read().round.fuse.owner,"solo");hold(house.STATIONS.socket,1800);assert.equal(game.read().points,20);
 const r=game.read().round,crate=r.crates.find(c=>c.symbol===r.target);hold(crate,600);hold(house.STATIONS.conveyor,1800);assert.equal(game.read().points,30);
 game.move(house.EXITS[0]);game.frame();assert.equal(game.read().finished,false,"can keep exploring at an unlocked gate");game.doAction({type:"finish"});assert.equal(game.read().finished,true);assert.equal(game.read().points,80);assert.deepEqual(tasks,[0,1,2]);
});
