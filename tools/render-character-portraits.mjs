// Small static portraits rendered from the original model geometry and colours.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SVGRenderer} from 'three/addons/renderers/SVGRenderer.js';
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {AVATARS} from '../public/world/characters.js';
class Element{
 constructor(tag){this.tag=tag;this.attrs={};this.childNodes=[];this.style={};}
 setAttribute(k,v){this.attrs[k]=v;}
 appendChild(n){this.childNodes.push(n);}
 removeChild(n){this.childNodes.splice(this.childNodes.indexOf(n),1);}
 get outerHTML(){return `<${this.tag} ${Object.entries(this.attrs).map(([k,v])=>`${k}="${v}"`).join(' ')}>${this.childNodes.map(n=>n.outerHTML).join('')}</${this.tag}>`;}
}
globalThis.document={createElementNS:(_,tag)=>new Element(tag)};
const root=new URL('../public/world/',import.meta.url),out=new URL('assets/characters/',root);
mkdirSync(out,{recursive:true});
for(const a of AVATARS){
 if(a.id==='JOBBY')continue;
 const data=readFileSync(new URL('models/'+a.id+'.glb',root));
 const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 const idle=gltf.animations.find(c=>/idle/i.test(c.name));
 if(idle){const mixer=new THREE.AnimationMixer(gltf.scene);mixer.clipAction(idle).play();mixer.update(.15);}
 gltf.scene.updateMatrixWorld(true);
 const group=new THREE.Group(),v=new THREE.Vector3();
 gltf.scene.traverse(node=>{
  if(!node.isMesh)return;
  const geometry=node.geometry.clone(),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){node.getVertexPosition(i,v);p.setXYZ(i,v.x,v.y,v.z);}
  geometry.computeVertexNormals();
  const materials=(Array.isArray(node.material)?node.material:[node.material]).map(m=>new THREE.MeshLambertMaterial({color:m.color,side:THREE.DoubleSide}));
  const mesh=new THREE.Mesh(geometry,Array.isArray(node.material)?materials:materials[0]);mesh.applyMatrix4(node.matrixWorld);group.add(mesh);
 });
 const box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3());
 group.position.sub(box.getCenter(new THREE.Vector3()));
 const scene=new THREE.Scene();scene.add(group,new THREE.AmbientLight(0xffffff,1.6));
 const light=new THREE.DirectionalLight(0xfff3e5,2.3);light.position.set(3,6,8);scene.add(light);
 const span=Math.max(size.y,size.x,1)*1.15;
 const camera=new THREE.OrthographicCamera(-span/2,span/2,span/2,-span/2,.01,100);
 camera.position.set(span*.24,span*.08,span*2);camera.lookAt(0,0,0);
 const renderer=new SVGRenderer();renderer.setSize(256,256);renderer.setPrecision(2);renderer.render(scene,camera);
 const svg=renderer.domElement.outerHTML.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');
 await sharp(Buffer.from(svg)).webp({quality:80}).toFile(fileURLToPath(new URL(a.id+'.webp',out)));
 console.log(a.id);
}
