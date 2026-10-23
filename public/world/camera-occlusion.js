// Camera collision uses expanded world wall boxes; walls never fade.
export function cameraClearance(from,to,boxes,padding=.18){
  let nearest=1;
  for(const item of boxes){
    const box=item.box||item;let enter=0,exit=1;
    for(const axis of ["x","y","z"]){
      const delta=to[axis]-from[axis],min=box.min[axis]-padding,max=box.max[axis]+padding;
      if(Math.abs(delta)<1e-9){if(from[axis]<min||from[axis]>max){enter=2;break;}continue;}
      let a=(min-from[axis])/delta,b=(max-from[axis])/delta;if(a>b)[a,b]=[b,a];
      enter=Math.max(enter,a);exit=Math.min(exit,b);if(enter>exit)break;
    }
    if(enter<=exit&&enter<=1&&exit>=0)nearest=Math.min(nearest,Math.max(0,enter));
  }
  const distance=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
  const factor=nearest<1?Math.max(0,nearest-.08/Math.max(.001,distance)):1;
  return {x:from.x+(to.x-from.x)*factor,y:from.y+(to.y-from.y)*factor,z:from.z+(to.z-from.z)*factor};
}
export function safeCameraPosition(focus,desired,boxes){
  const safe=cameraClearance(focus,desired,boxes);
  if(Math.hypot(safe.x-focus.x,safe.y-focus.y,safe.z-focus.z)>=1.7)return safe;
  // In tight corners, a clear overhead view preserves the entire hero without hiding walls.
  return cameraClearance(focus,{x:focus.x,y:focus.y+5.5,z:focus.z+.001},boxes);
}
