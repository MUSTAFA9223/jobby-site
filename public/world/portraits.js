import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// One small renderer generates real still portraits from the same playable GLB files.
// No emoji-only substitutes or large ZIP pack are needed.
export async function generatePortraits(avatars, modelUrl, onPortrait){
 if(typeof WebGLRenderingContext==="undefined")return;
 let renderer;
 try{
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,powerPreference:"low-power",preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);renderer.setSize(160,160,false);
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
 }catch(err){console.warn("Portrait rendering unavailable",err);return}
 const stage=new THREE.Scene();
 stage.add(new THREE.HemisphereLight(0xffffff,0x8b79cc,3.1));
 const light=new THREE.DirectionalLight(0xffffff,2.8);light.position.set(-2,5,5);stage.add(light);
 const camera=new THREE.PerspectiveCamera(34,1,.1,100);
 camera.position.set(2.5,2.35,5.25);camera.lookAt(0,1.15,0);
 const loader=new GLTFLoader();
 try{
  for(const avatar of avatars){
   let model;
   try{
    const gltf=await loader.loadAsync(modelUrl(avatar.id));
    model=gltf.scene;
    const bounds=new THREE.Box3().setFromObject(model);
    if(bounds.isEmpty())continue;
    const size=bounds.getSize(new THREE.Vector3());
    const center=bounds.getCenter(new THREE.Vector3());
    const factor=2.2/Math.max(size.y,.1);
    model.scale.setScalar(factor);
    model.position.set(-center.x*factor,-bounds.min.y*factor,-center.z*factor);
    model.rotation.y=.12;
    stage.add(model);
    const idle=gltf.animations.find(clip=>clip.name.split("|").pop().trim().toLowerCase()==="idle");
    if(idle){const mixer=new THREE.AnimationMixer(model);mixer.clipAction(idle).play();mixer.update(.1)}
    renderer.render(stage,camera);
    const photo=renderer.domElement.toDataURL("image/webp",.84);
    if(photo&&photo.length>100)onPortrait(avatar.id,photo);
   }catch(err){
    console.warn("Portrait not available for",avatar.id,err);
   }finally{
    if(model){
     stage.remove(model);
     model.traverse(n=>{
      if(n.isMesh){
       n.geometry?.dispose();
       const mats=Array.isArray(n.material)?n.material:[n.material];
       for(const m of mats){if(m){m.map?.dispose();m.normalMap?.dispose();m.dispose()}}
      }
     });
    }
   }
   await new Promise(resolve=>setTimeout(resolve,65));
  }
 }finally{renderer.dispose();renderer.forceContextLoss?.()}
}
