// CPU previews from the actual shipped GLBs. Texture palette is baked to vertex
// colours for SVGRenderer; these are asset/level illustrations, not gameplay captures.
import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {SVGRenderer} from "three/addons/renderers/SVGRenderer.js";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import sharp from "sharp";
import {fileURLToPath} from "node:url";
import {buildCastle} from "../public/world/castle-scene.js";
const root=new URL("../public/world/",import.meta.url);
class Node{
 constructor(tag){this.tag=tag;this.attrs={};this.childNodes=[];this.style={};}
 setAttribute(k,v){this.attrs[k]=v;}appendChild(node){this.childNodes.push(node);}removeChild(node){this.childNodes.splice(this.childNodes.indexOf(node),1);}
 getContext(){return {fillText(){},fillRect(){},clearRect(){}};}
 get outerHTML(){return `<${this.tag} ${Object.entries(this.attrs).map(([k,v])=>`${k}="${String(v).replaceAll('"',"&quot;")}"`).join(" ")}>${this.childNodes.map(n=>n.outerHTML).join("")}</${this.tag}>`;}
}
globalThis.document={createElement:tag=>new Node(tag),createElementNS:(ns,tag)=>new Node(tag)};
const cache=new Map();
async function load(url){
 if(cache.has(url))return cache.get(url);
 const pending=(async()=>{
  const file=new URL(url,root),data=readFileSync(file),json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12))),bin=data.subarray(28+data.readUInt32LE(12));
  const loader=new GLTFLoader();loader.register(()=>({name:"cpu-texture",async loadTexture(i){
   const info=json.textures[i],image=json.images[info.source];let png;
   if(image.uri)png=image.uri.startsWith("data:")?Buffer.from(image.uri.split(",")[1],"base64"):readFileSync(new URL(image.uri,file));
   else{const view=json.bufferViews[image.bufferView];png=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);}
   const raw=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true}),tex=new THREE.DataTexture(raw.data,raw.info.width,raw.info.height);tex.userData.raw=raw;tex.colorSpace=THREE.SRGBColorSpace;return tex;
  }}));
  return loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),"");
 })();cache.set(url,pending);return pending;
}
function prepareMesh(n){
 let geometry=n.geometry.clone();const old=Array.isArray(n.material)?n.material:[n.material],uv=geometry.attributes.uv;
 const next=old.map(m=>new THREE.MeshLambertMaterial({color:m.color||0xffffff,side:THREE.DoubleSide,transparent:false}));
 if(uv&&old.length===1&&old[0].map?.userData.raw){
  const {data,info}=old[0].map.userData.raw,colors=new Float32Array(geometry.attributes.position.count*3),c=new THREE.Color();
  for(let i=0;i<uv.count;i++){const x=Math.max(0,Math.min(info.width-1,Math.floor(uv.getX(i)*info.width))),y=Math.max(0,Math.min(info.height-1,Math.floor(uv.getY(i)*info.height))),p=(y*info.width+x)*4;c.setRGB(data[p]/255,data[p+1]/255,data[p+2]/255,THREE.SRGBColorSpace);c.toArray(colors,i*3);}
  geometry.setAttribute("color",new THREE.BufferAttribute(colors,3));next[0].vertexColors=true;
 }
 const mesh=new THREE.Mesh(geometry,Array.isArray(n.material)?next:next[0]);return mesh;
}
function geometryScene(source){const group=new THREE.Group();source.updateMatrixWorld(true);source.traverse(n=>{if(n.isMesh&&n.visible){const mesh=prepareMesh(n);mesh.applyMatrix4(n.matrixWorld);group.add(mesh);}});return group;}
function sceneWithLight(){const scene=new THREE.Scene();scene.background=new THREE.Color("#202d43");scene.add(new THREE.AmbientLight(0xffffff,.65));const light=new THREE.DirectionalLight(0xfff4df,1.3);light.position.set(-15,40,25);scene.add(light);return scene;}
async function raster(scene,camera,w,h,path){const r=new SVGRenderer();r.setSize(w,h);r.setPrecision(2);r.render(scene,camera);let svg=r.domElement.outerHTML.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');svg=svg.replace(/(<svg[^>]*>)/,`$1<rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" fill="#202d43"/>`);await sharp(Buffer.from(svg)).webp({quality:84}).toFile(fileURLToPath(path));}
for(const pack of ["castle","dungeon"]){
 const dir=new URL("models/"+pack+"/previews/",root);mkdirSync(dir,{recursive:true});const manifest=JSON.parse(readFileSync(new URL("models/"+pack+"/manifest.json",root)));
 for(const model of manifest.models){const g=await load("./models/"+pack+"/"+model.file),scene=sceneWithLight(),object=geometryScene(g.scene),box=new THREE.Box3().setFromObject(object),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());object.position.sub(center);scene.add(object);const span=Math.max(.1,size.x,size.y,size.z),camera=new THREE.OrthographicCamera(-span*.88,span*.88,span*.72,-span*.72,.01,span*20);camera.position.set(span*2,span*1.4,span*2.5);camera.lookAt(0,0,0);await raster(scene,camera,300,245,new URL(model.id+".webp",dir));}
 console.log(pack+": rendered "+manifest.models.length+" actual-model previews");
}
const scene=sceneWithLight(),level=new THREE.Scene(),arena=buildCastle(level,{assetLoader:{loadAsync:load}});await arena.ready;arena.guard.position.set(18,0,5);
level.updateMatrixWorld(true);
level.traverse(n=>{if(!n.isMesh||!n.visible||n.parent?.visible===false)return;
 if(n.isInstancedMesh){const matrix=new THREE.Matrix4();for(let i=0;i<n.count;i++){n.getMatrixAt(i,matrix);const mesh=prepareMesh(n);mesh.applyMatrix4(n.matrixWorld.clone().multiply(matrix));if(new THREE.Box3().setFromObject(mesh).max.y<.1)mesh.renderOrder=n===level.children[0]?-10:-3;scene.add(mesh);}}
 else {const mesh=prepareMesh(n);mesh.applyMatrix4(n.matrixWorld);if(new THREE.Box3().setFromObject(mesh).max.y<.1)mesh.renderOrder=n===level.children[0]?-10:-3;scene.add(mesh);}
});
const camera=new THREE.OrthographicCamera(-43,43,34,-34,.1,300);camera.position.set(47,75,65);camera.lookAt(0,0,0);
await raster(scene,camera,1200,950,new URL("assets/castle-overview.webp",root));
console.log("Actual castle geometry overview rendered.");
