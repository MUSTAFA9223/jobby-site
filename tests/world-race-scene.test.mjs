import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import * as rules from '../public/world/race-rules.js';
import {buildRace} from '../public/world/race-scene.js';
class Element{constructor(){this.children=[];this.style={setProperty(){}};const flags=new Set(['hidden']);this.classList={add:k=>flags.add(k),remove:k=>flags.delete(k),toggle:(k,force)=>{if(force??!flags.has(k))flags.add(k);else flags.delete(k);},contains:k=>flags.has(k)};}append(...n){this.children.push(...n);}prepend(n){this.children.unshift(n);}replaceChildren(...n){this.children=n;}addEventListener(){}setPointerCapture(){}querySelector(){return new Element();}}
test('Real race game starts after countdown, jumps the whole course, renders models and saves 80 points once',async t=>{
 const previous=globalThis.document,ids=new Map([...readFileSync(new URL('../public/world/race.html',import.meta.url),'utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const document={body:new Element(),createElement:()=>new Element(),getElementById:id=>{assert.ok(ids.has(id),id);return ids.get(id);}};globalThis.document=document;t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
 let now=0,renders=0,starts=0,finishes=0;const tasks=[];
 class Renderer{constructor(){this.domElement=new Element();}setPixelRatio(){}setSize(){}render(scene){renders++;if(renders%120===0){scene.updateMatrixWorld(true);scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}}}
 class Clock{elapsedTime=0;getDelta(){this.elapsedTime+=1/120;return 1/120;}}
 class Loader{async loadAsync(){const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial()));return {scene,animations:[]};}}
 const source=readFileSync(new URL('../public/world/race-game.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 const run=new Function('saveSelection','beginPlayerRun','recordPlayerTask','finishPlayerRun','syncProfile','THREE','GLTFLoader','connectCoop','safeCameraPosition','rules','buildRace','document','navigator','window','location','localStorage','sessionStorage','innerWidth','innerHeight','devicePixelRatio','requestAnimationFrame','performance','setTimeout','clearTimeout',source+'\nreturn {start,frame,read:()=>({runner,started,finished,points:saved.points}),drive:(x,jump)=>{joyX=x;joyY=-1;wantJump=jump;}};');
 const storage={getItem:()=>null,setItem(){}},game=run(()=>{},()=>starts++,i=>tasks.push(i),()=>finishes++,()=>{}, {...THREE,WebGLRenderer:Renderer,Clock},Loader,()=>{throw Error('Unexpected co-op');},()=>{},rules,buildRace,document,{maxTouchPoints:1},{addEventListener(){}},{search:''},storage,storage,390,844,1,()=>0,{now:()=>now},()=>0,()=>{});
 await game.start();assert.equal(starts,0,'profile run begins after countdown');
 for(let i=0;i<120*70&&!game.read().finished;i++){
  now+=1000/120;const p=game.read().runner,t=Math.max(0,(now-3000)/1000),next=rules.PLATFORMS.filter(q=>q.z<p.z+.5).sort((a,b)=>b.z-a.z)[0];let target=next?rules.platformAt(next,t+.5):{x:0};
  if(next?.trap){const row=rules.PLATFORMS.filter(q=>q.trap&&q.z===next.z).map(q=>rules.platformAt(q,t+.55));target=row.filter(q=>q.solid&&!q.warning).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0]||row[0];}
  const ahead=rules.supportAt(p.x,p.z-1.1,t+.15);game.drive(Math.max(-1,Math.min(1,(target.x-p.x)*.9)),p.grounded&&(!ahead||ahead.y>p.y+.1||rules.SPINNERS.some(s=>Math.hypot(p.x-s.x,p.z-s.z)<6)||Math.abs(p.z+56)<2));game.frame();
 }
 assert.equal(game.read().finished,true);assert.equal(game.read().points,80);assert.equal(starts,1);assert.equal(finishes,1);assert.deepEqual(tasks,[0,1,2]);assert.ok(renders>1000);assert.equal(ids.get('endoverlay').classList.contains('hidden'),false);
 game.frame();assert.equal(finishes,1,'finishing does not replay rewards');
});
