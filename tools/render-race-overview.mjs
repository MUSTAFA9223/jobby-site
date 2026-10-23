// CPU rendering of the actual course meshes, for the guide and menu artwork.
import * as THREE from 'three';
import {SVGRenderer} from 'three/addons/renderers/SVGRenderer.js';
import {writeFileSync} from 'node:fs';
import {buildRace} from '../public/world/race-scene.js';
class Node{constructor(tag){this.tag=tag;this.attrs={};this.childNodes=[];this.style={};}setAttribute(k,v){this.attrs[k]=v;}appendChild(n){this.childNodes.push(n);}removeChild(n){this.childNodes.splice(this.childNodes.indexOf(n),1);}get outerHTML(){return `<${this.tag} ${Object.entries(this.attrs).map(([k,v])=>`${k}="${v}"`).join(' ')}>${this.childNodes.map(n=>n.outerHTML).join('')}</${this.tag}>`;}}
globalThis.document={createElementNS:(ns,tag)=>new Node(tag)};
const scene=new THREE.Scene();const arena=buildRace(scene);arena.update(.4);
scene.add(new THREE.AmbientLight(0xffffff,.55));const light=new THREE.DirectionalLight(0xffffff,.55);light.position.set(-30,80,25);scene.add(light);
scene.traverse(n=>{if(n.isMesh)n.material=new THREE.MeshLambertMaterial({color:n.material.color});});
const camera=new THREE.OrthographicCamera(-91,91,54.6,-54.6,.1,400);camera.position.set(105,125,40);camera.lookAt(0,-1,-64);camera.updateMatrixWorld(true);
const renderer=new SVGRenderer();renderer.setSize(1200,720);renderer.setPrecision(2);renderer.render(scene,camera);
let svg=renderer.domElement.outerHTML.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');
svg=svg.replace(/(<svg[^>]*>)/,'$1<rect x="-600" y="-360" width="1200" height="720" fill="#9ac8f4"/>');
const labels=[['START',-8,8],['FOAM HOP',10,-17],['SWAYING ISLANDS',10,-56],['TRAPDOOR TROUBLE',10,-95],['FINISH',0,-140]];
const text=labels.map(([label,x,z])=>{const p=new THREE.Vector3(x,2,z).project(camera);return `<text x="${p.x*600}" y="${-p.y*360}" font-family="sans-serif" font-size="12" font-weight="900" fill="#26325b" text-anchor="middle" stroke="#d7ecff" stroke-width="3" paint-order="stroke">${label}</text>`;}).join('');
svg=svg.replace('</svg>',text+'</svg>');writeFileSync(new URL('../.build/race-overview.svg',import.meta.url),svg);
