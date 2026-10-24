import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import * as rules from '../public/world/party-rules.js';
import * as map from '../public/world/castle-layout.js';
import {buildParty} from '../public/world/party-scene.js';
import {createReplay} from '../public/world/party-replay.js';
import {createWallCamera} from '../public/world/castle-motion.js';
class Element{
 constructor(){this.children=[];this.style={setProperty(){}};const flags=new Set(['hidden']);this.classList={add:k=>flags.add(k),remove:k=>flags.delete(k),toggle:(k,force)=>{if(force??!flags.has(k))flags.add(k);else flags.delete(k);},contains:k=>flags.has(k)};}
 append(...n){this.children.push(...n);}prepend(n){this.children.unshift(n);}replaceChildren(...n){this.children=n;}addEventListener(){}setPointerCapture(){}querySelector(){return new Element();}click(){this.onclick?.();}
 getContext(){return {fillText(){},fillRect(){},beginPath(){},arc(){},fill(){},moveTo(){},lineTo(){},stroke(){}};}
}
test('Actual party scene, potion jump, solo crown delivery and 3D replay run with finite transforms',async t=>{
 const previous=globalThis.document,ids=new Map([...readFileSync(new URL('../public/world/party.html',import.meta.url),'utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const document={body:new Element(),activeElement:null,createElement:()=>new Element(),getElementById:id=>{assert.ok(ids.has(id),id);return ids.get(id);}};globalThis.document=document;t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
 let now=0,renders=0,starts=0,finishes=0;const tasks=[];
 class Renderer{constructor(){this.domElement=new Element();}setPixelRatio(){}setSize(){}render(scene){renders++;scene.updateMatrixWorld(true);scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}}
 class Clock{getDelta(){return .04;}}
 class Loader{async loadAsync(){const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial()));return {scene,animations:[]};}}
 const source=readFileSync(new URL('../public/world/party-game.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 const run=new Function('saveSelection','beginPlayerRun','recordPlayerTask','finishPlayerRun','syncProfile','THREE','GLTFLoader','cloneSkeleton','connectCoop','createWallCamera','rules','map','buildParty','createReplay','document','navigator','window','location','localStorage','sessionStorage','innerWidth','innerHeight','devicePixelRatio','requestAnimationFrame','performance','setTimeout','clearTimeout',source+'\nreturn {start,frame,action,read:()=>({round,started,finished,px,py,pz,playerGroup,replay}),move:p=>{px=p.x;pz=p.z;py=0;Object.assign(self(),p,{y:0});},jump:()=>wantJump=true};');
 const storage={getItem:()=>null,setItem(){}},game=run(()=>{},()=>starts++,i=>tasks.push(i),()=>finishes++,()=>{}, {...THREE,WebGLRenderer:Renderer,Clock},Loader,cloneSkeleton,()=>{throw Error('Unexpected online connection');},createWallCamera,rules,map,(scene)=>buildParty(scene,{loadAssets:false}),createReplay,document,{maxTouchPoints:1},{addEventListener(){}},{search:''},storage,storage,390,844,1,()=>0,{now:()=>now},()=>0,()=>{});
 await game.start();assert.equal(starts,1);now=3100;game.read().round.actors.solo.safeUntil=1e9;game.action({type:'potion',potion:'jelly'});game.jump();let peak=0;
 for(let i=0;i<40;i++){now+=40;game.frame();peak=Math.max(peak,game.read().py);}assert.ok(peak>2.5,'Jelly changes real jump physics');assert.equal(game.read().round.stocks.solo.jelly,0);
 game.move(rules.CROWN);game.action({type:'crown'});assert.equal(game.read().round.crown.owner,'solo');
 for(let i=0;i<12;i++){now+=250;game.move({x:-i,z:10+i});game.frame();}
 game.move(rules.BASES.A);game.action({type:'bank_crown'});assert.equal(game.read().finished,true);assert.equal(finishes,1);assert.deepEqual(tasks,[0,1,2]);assert.equal(ids.get('endoverlay').classList.contains('hidden'),false);
 ids.get('watchReplay').click();assert.equal(game.read().replay.isActive(),true);for(let i=0;i<15;i++){now+=40;game.frame();}ids.get('replayStop').click();assert.equal(game.read().replay.isActive(),false);assert.equal(finishes,1,'replay never repeats saved points');assert.ok(renders>30);
});
