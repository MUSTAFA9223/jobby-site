import {cameraClearance} from "./camera-occlusion.js?v=2";

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
// Keep a focus-relative orbit and a separate obstruction lift. The lift is
// measured from the requested orbit, never from the already corrected camera.
export function createWallCamera(){
 let offset=null,lift=0,shownDistance=null;
 return (focus,desired,boxes,dt)=>{
  dt=Math.max(0,Math.min(dt,.05));
  const target={x:desired.x-focus.x,y:desired.y-focus.y,z:desired.z-focus.z};
  if(!offset)offset={...target};
  const alpha=1-Math.exp(-10*dt);
  for(const axis of ["x","y","z"])offset[axis]+=(target[axis]-offset[axis])*alpha;
  const at=value=>({x:focus.x+offset.x*(1-value),y:focus.y+offset.y*(1-value)+5.5*value,z:focus.z+offset.z*(1-value)});
  // Find the lowest clear elevation, including a small reserve for the camera
  // near plane. Unlike a fixed-distance cutoff this rises continuously along a
  // wall and remains above its top while walking away.
  const clear=value=>{const p=at(value);return distance(p,cameraClearance(focus,p,boxes,.28))<1e-7;};
  let needed=0;
  if(!clear(0)){
   needed=1;
   for(let i=1;i<=16;i++)if(clear(i/16)){
    let low=(i-1)/16,high=i/16;
    for(let j=0;j<10;j++){const mid=(low+high)/2;if(clear(mid))high=mid;else low=mid;}
    needed=high;break;
   }
  }
  lift=Math.max(needed,lift+(needed-lift)*(1-Math.exp(-4*dt)));
  // One final clip, also covering overhead scenery where no full orbit fits.
  const safe=cameraClearance(focus,at(lift),boxes),allowed=distance(focus,safe);
  if(shownDistance===null)shownDistance=allowed;
  shownDistance=Math.min(allowed,shownDistance+(allowed-shownDistance)*(1-Math.exp(-5*dt)));
  const factor=allowed>1e-9?shownDistance/allowed:0;
  return {x:focus.x+(safe.x-focus.x)*factor,y:focus.y+(safe.y-focus.y)*factor,z:focus.z+(safe.z-focus.z)*factor};
 };
}

// Small steps prevent tunnelling. Find contact instead of discarding a full
// frame's movement; the free axis keeps sliding without a frame-sized gap.
export function moveWithSliding(x,z,dx,dz,blocked){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
 const advance=(from,to,other,axis)=>{
  const hits=value=>axis==="x"?blocked(value,other):blocked(other,value);
  if(!hits(to))return to;
  if(hits(from))return from;
  let low=0,high=1;
  for(let i=0;i<14;i++){const mid=(low+high)/2;if(hits(from+(to-from)*mid))high=mid;else low=mid;}
  return from+(to-from)*low;
 };
 for(let i=0;i<steps;i++){
  x=advance(x,x+dx/steps,z,"x");
  z=advance(z,z+dz/steps,x,"z");
 }
 return {x,z};
}
