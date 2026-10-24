import * as THREE from 'three';
import {buildCastle} from './castle-scene.js?v=2';
import * as rules from './party-rules.js';
export function buildParty(scene,options={}){
 const castle=buildCastle(scene,{...options,party:true}),unit=new THREE.BoxGeometry(1,1,1),materials=new Map();
 const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.65}));return materials.get(color);};
 const box=(x,y,z,w,h,d,color,parent=scene)=>{const o=new THREE.Mesh(unit,material(color));o.position.set(x,y,z);o.scale.set(w,h,d);parent.add(o);return o;};
 function sign(text,x,y,z,color='#fff1bf'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#161c2c';c.fillRect(0,0,512,96);c.fillStyle=color;c.font='900 27px system-ui';c.textAlign='center';c.fillText(text,256,59,500);
  const o=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas)}));o.position.set(x,y,z);o.scale.set(4,.75,1);scene.add(o);return o;
 }
 function bound(b){const item={...b,box:new THREE.Box3(new THREE.Vector3(b.x-b.w/2,b.y||0,b.z-b.d/2),new THREE.Vector3(b.x+b.w/2,(b.y||0)+b.h,b.z+b.d/2))};castle.blocks.push(item);return item;}
 const gates=rules.GATES.map((b,i)=>{
  const mesh=box(b.x,b.h/2,b.z,b.w,b.h,b.d,i<2?'#c695f7':'#74ddd8'),collision=bound(b);
  sign('SHIFT GATE',b.x,b.h+.6,b.z);return {b,mesh,collision};
 });
 const t=rules.TUNNEL;
 for(const side of [-1,1]){const b={x:t.x+side*1.14,z:t.z,w:1.72,d:t.d,h:1.2};box(b.x,.6,b.z,b.w,b.h,b.d,'#ac9d87');bound(b);}
 box(t.x,1,t.z,4,.4,t.d,'#ac9d87');bound({...t,y:.8,h:.4});sign('MINI ONLY · SHORTCUT',t.x,2,t.z,'#8de7ff');
 const crate=box(rules.CRATE.x,.85,rules.CRATE.z,1.7,1.7,1.7,'#ad7b49'),crateBound=bound(rules.CRATE);sign('GIANT · PUSH CRATE',10,2.8,15,'#ffce85');
 for(const [team,p] of Object.entries(rules.BASES)){
  const color=team==='A'?'#5cf0c0':'#ff9b91';const ring=new THREE.Mesh(new THREE.TorusGeometry(2.1,.09,6,32),material(color));ring.rotation.x=Math.PI/2;ring.position.set(p.x,.07,p.z);scene.add(ring);box(p.x,1.5,p.z+.8,.08,3,.08,'#e2d8bd');box(p.x+.5,2.6,p.z+.8,1,.6,.08,color);sign('TEAM '+team+' · HOME',p.x,3.5,p.z,color);
 }
 const crown=new THREE.Group(),gold=material('#ffd25f');crown.add(new THREE.Mesh(new THREE.TorusGeometry(.4,.09,6,12),gold));crown.children[0].rotation.x=Math.PI/2;
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5,o=new THREE.Mesh(new THREE.ConeGeometry(.105,.45,5),gold);o.position.set(Math.sin(a)*.36,.15,Math.cos(a)*.36);crown.add(o);}scene.add(crown);sign('CROWN ALTAR',rules.CROWN.x,2.6,rules.CROWN.z,'#ffe79b');
 const bag=new THREE.Group();const sack=new THREE.Mesh(new THREE.SphereGeometry(.43,10,8),material('#8b598e'));sack.scale.set(.9,1.2,.8);bag.add(sack);const tie=new THREE.Mesh(new THREE.TorusGeometry(.15,.045,5,12),gold);tie.rotation.x=Math.PI/2;tie.position.y=.4;bag.add(tie);scene.add(bag);
 const noiseRing=new THREE.Mesh(new THREE.TorusGeometry(.7,.045,5,28),material('#f6a2ea'));noiseRing.rotation.x=Math.PI/2;scene.add(noiseRing);sign('CURSED TREASURE → BANK',rules.BAG.x,2.6,rules.BAG.z,'#f3c5ff');
 sign('TREASURE BANK · SAFE PASS',rules.TREASURE.x,2.7,rules.TREASURE.z,'#b8ffde');
 for(const p of rules.REFILLS){const color={mini:'#6ddaff',giant:'#ffc379',jelly:'#c097ff'}[p.potion];const bottle=new THREE.Group();box(0,.65,0,.12,.3,.12,'#dbd9ce',bottle);const liquid=new THREE.Mesh(new THREE.SphereGeometry(.3,10,8),material(color));liquid.position.y=.3;bottle.add(liquid);bottle.position.set(p.x,.2,p.z);scene.add(bottle);sign(p.potion.toUpperCase()+' REFILL',p.x,1.8,p.z,color);}
 function update(r,now){
  for(const {b,mesh,collision} of gates){const i=gates.findIndex(g=>g.mesh===mesh),open=rules.gateOpen(r,i,now),lift=open?3.6:0;mesh.position.y=b.h/2+lift;collision.box.min.y=lift;collision.box.max.y=b.h+lift;}
  crate.position.x=r.crate.x;crateBound.box.min.x=r.crate.x-r.crate.w/2;crateBound.box.max.x=r.crate.x+r.crate.w/2;
  const position=(item,o,height)=>{const owner=item.owner&&r.actors[item.owner];o.position.set(owner?owner.x:item.x,height+(owner?.y||0),owner?owner.z+.55:item.z);return owner;};
  position(r.crown,crown,1.5);crown.rotation.y=now/900;
  const carrier=position(r.bag,bag,carrierHeight(r.bag.owner,r,now));bag.visible=!r.bag.delivered;bag.rotation.z=Math.sin(now/130)*.12;
  noiseRing.visible=!!carrier&&!r.finished;noiseRing.position.set(bag.position.x,.08,bag.position.z);noiseRing.scale.setScalar(1+(now%1000)/600);
 }
 function carrierHeight(id,r,now){return id?rules.effect(r,id,now)==='mini'?.6:1.1:.55;}
 return {...castle,update};
}
