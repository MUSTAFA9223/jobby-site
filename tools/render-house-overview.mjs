// Deterministic SVG overview of the real house meshes; no GPU or browser needed.
import * as THREE from "three";
import {SVGRenderer} from "three/addons/renderers/SVGRenderer.js";
import {writeFileSync} from "node:fs";
import {buildHouse} from "../public/world/house-scene.js";
import {ROOMS,EXITS} from "../public/world/house-layout.js";
class Node{
 constructor(tag){this.tag=tag;this.attrs={};this.childNodes=[];this.style={};}
 setAttribute(k,v){this.attrs[k]=v;}appendChild(node){this.childNodes.push(node);}removeChild(node){this.childNodes.splice(this.childNodes.indexOf(node),1);}
 getContext(){return {fillText(){}};}
 get outerHTML(){const attrs=Object.entries(this.attrs).map(([k,v])=>`${k}="${String(v).replaceAll('"',"&quot;")}"`).join(" ");return `<${this.tag} ${attrs}>${this.childNodes.map(n=>n.outerHTML).join("")}</${this.tag}>`;}
}
globalThis.document={createElement:tag=>new Node(tag),createElementNS:(ns,tag)=>new Node(tag)};
const scene=new THREE.Scene();scene.background=new THREE.Color("#18283d");const arena=buildHouse(scene);arena.guard.position.set(0,0,-16);
scene.add(new THREE.AmbientLight(0xffffff,.55));const light=new THREE.DirectionalLight(0xffffff,.6);light.position.set(-20,60,30);scene.add(light);
scene.traverse(node=>{if(!node.isMesh)return;if(node.position.y<-.1)node.renderOrder=-3;else if(node.position.y<0)node.renderOrder=-2;else if(node.position.y<.1)node.renderOrder=-1;if(node.geometry.type==="BoxGeometry"&&(node.scale.x>4||node.scale.z>4))node.geometry=new THREE.BoxGeometry(1,1,1,Math.ceil(node.scale.x/1.5),1,Math.ceil(node.scale.z/1.5));if(node.material.map){node.visible=false;return;}const old=node.material;node.material=new THREE.MeshLambertMaterial({color:old.color,opacity:old.opacity,transparent:old.transparent,side:old.side});});
const camera=new THREE.OrthographicCamera(-42,42,34.44,-34.44,.1,250);camera.position.set(45,80,65);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
const renderer=new SVGRenderer();renderer.setSize(1000,820);renderer.setPrecision(2);renderer.render(scene,camera);
const labels=[...ROOMS.map(r=>({name:r.name,x:r.x,z:r.z+3.5})),...EXITS];
let svg=renderer.domElement.outerHTML.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" style="background:#18283d" ');
const text=labels.map(r=>{const p=new THREE.Vector3(r.x,.12,r.z).project(camera);return `<text x="${(p.x*500).toFixed(1)}" y="${(-p.y*410).toFixed(1)}" fill="#fff6df" font-family="sans-serif" font-size="10" font-weight="700" text-anchor="middle" stroke="#26354a" stroke-width=".7" paint-order="stroke">${r.name}</text>`;}).join("");
svg=svg.replace('</svg>',text+'</svg>');writeFileSync(new URL("../.build/house-overview.svg",import.meta.url),svg);console.log("House mesh overview:",Buffer.byteLength(svg),"bytes");
