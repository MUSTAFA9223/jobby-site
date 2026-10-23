import * as THREE from 'three';
import {PLATFORMS,SPINNERS,BUMPERS,platformAt,CHECKPOINTS} from './race-rules.js';
const PALETTE=[0x7961ee,0x4edbb8,0xffbf55,0xfa79a0];
export function buildRace(scene){
 const geometry=new THREE.BoxGeometry(1,1,1),materials=new Map();
 function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.67}));return materials.get(color);}
 function box(x,y,z,w,h,d,color,group=scene){const mesh=new THREE.Mesh(geometry,material(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);return mesh;}
 const platforms=PLATFORMS.map((p,i)=>{const stage=p.z>-39?0:p.z>-80?1:p.z>-118?2:3;const group=new THREE.Group();scene.add(group);
  const slab=box(0,-.5,0,p.w,.9,p.d,p.checkpoint!==undefined?0x92fae1:p.finish?0xffdf6d:PALETTE[stage],group);
  box(0,-.95,0,p.w*.93,.14,p.d*.93,0x433875,group);
  if(p.checkpoint!==undefined){for(const side of [-1,1]){box(side*(p.w/2-.6),1.15,0,.16,2.3,.16,0xeffffc,group);box(side*(p.w/2-.6)+.6,2,0,1.1,.6,.12,0x42b797,group);}}
  if(p.trap){box(0,.015,0,.08,.025,p.d-.5,0x514067,group);}
  return {p,group,slab};});
 const spinners=SPINNERS.map(s=>{const group=new THREE.Group();group.position.set(s.x,.65,s.z);scene.add(group);box(0,0,0,s.r*2,.38,.5,0xff658d,group);box(0,-.2,0,.7,1.3,.7,0x433875,group);return {s,group};});
 const bumpers=BUMPERS.map(b=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(b.r,b.r,1.3,16),material(0xffd86f));mesh.position.set(b.x,.65,b.z);scene.add(mesh);return {b,mesh};});
 // The finish arch, start stripes and suspended arena are all code-native geometry.
 for(const z of [7,-136]){for(let i=0;i<16;i++)box(i-7.5,.025,z,1,.035,.7,i%2?0x342d59:0xffffff);}
 box(-7,2.4,-137,.45,4.8,.5,0xffd86f);box(7,2.4,-137,.45,4.8,.5,0xffd86f);box(0,4.7,-137,14.5,.6,.5,0xffd86f);
 const clouds=new THREE.Group();scene.add(clouds);
 for(let i=0;i<24;i++)box(Math.sin(i*7.1)*30,-8-(i%3)*2,10-i*7,5+i%4,1.5,4,0xd5e7ff,clouds);
 return {update(t){for(const {p,group,slab} of platforms){const q=platformAt(p,t);group.position.set(q.x,q.y+(q.solid?0:-1.5),q.z);group.visible=q.solid||q.trap;slab.material=material(!q.solid?0x745c83:q.warning?0xff646f:p.trap?0xffbe65:p.checkpoint!==undefined?0x92fae1:p.finish?0xffdf6d:PALETTE[p.z>-39?0:p.z>-80?1:p.z>-118?2:3]);}
  for(const {s,group} of spinners)group.rotation.y=-(t*s.speed+s.phase);
  for(const {b,mesh} of bumpers)mesh.position.x=b.x+Math.sin(t*b.speed)*2.5;
 },platforms,spinners,checkpoints:CHECKPOINTS};
}
