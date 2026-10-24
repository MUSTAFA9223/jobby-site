import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
export function createReplay(scene,{avatarFor,guard,onStop=()=>{}}){
 let active=null;
 function stop(){if(!active)return;const a=active;active=null;scene.remove(a.ghost);if(a.guardGhost)scene.remove(a.guardGhost);if(a.original)a.original.visible=a.visible;if(guard)guard.visible=a.guardVisible;a.mixer?.stopAllAction();const skeletons=new Set();a.ghost.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});for(const skeleton of skeletons)skeleton.dispose();onStop();}
 function start(clip){
  stop();if(!clip?.frames||clip.frames.length<2)return false;
  const source=avatarFor(clip.id);if(!source?.group)return false;
  const ghost=cloneSkeleton(source.group);ghost.visible=true;scene.add(ghost);
  const mixer=new THREE.AnimationMixer(ghost),walk=source.animations?.find(c=>/Walk|Run/.test(c.name));if(walk)mixer.clipAction(walk).play();
  const guardGhost=guard?.clone(true);if(guardGhost){guardGhost.visible=true;scene.add(guardGhost);}
  active={clip,ghost,guardGhost,mixer,original:source.group,visible:source.group.visible,guardVisible:guard?.visible,time:0,start:clip.frames[0].at,duration:(clip.frames.at(-1).at-clip.frames[0].at)/1000};source.group.visible=false;if(guard)guard.visible=false;return true;
 }
 function sample(frames,at,target){
  if(!frames?.length)return;let i=0;while(i<frames.length-2&&frames[i+1].at<at)i++;const a=frames[i],b=frames[Math.min(i+1,frames.length-1)],t=Math.max(0,Math.min(1,(at-a.at)/Math.max(1,b.at-a.at)));
  target.position.set(a.x+(b.x-a.x)*t,(a.y||0)+((b.y||0)-(a.y||0))*t,a.z+(b.z-a.z)*t);target.rotation.y=(a.h||0)+Math.atan2(Math.sin((b.h||0)-(a.h||0)),Math.cos((b.h||0)-(a.h||0)))*t;
  const scale=a.kind==='mini'?.55:a.kind==='giant'?1.45:1;const wobble=a.kind==='jelly'?Math.sin(at/95)*.07:0;target.scale.set(scale+wobble,scale-wobble,scale+wobble);
 }
 function update(dt){if(!active)return null;const a=active;if(a.original)a.original.visible=false;if(guard)guard.visible=false;a.time+=dt;const at=a.start+a.time*1000;sample(a.clip.frames,at,a.ghost);if(a.guardGhost)sample(a.clip.guardFrames,at,a.guardGhost);a.mixer.update(dt);const focus=a.ghost.position.clone();if(a.time>a.duration+1)stop();return focus;}
 return {start,stop,update,isActive:()=>!!active};
}
