// Slab test over the finite camera-to-avatar segment, including camera-inside-wall.
export function segmentHitsBox(from,to,box,padding=.25){
  let enter=0,exit=1;
  for(const axis of ["x","y","z"]){
    const delta=to[axis]-from[axis],min=box.min[axis]-padding,max=box.max[axis]+padding;
    if(Math.abs(delta)<1e-9){if(from[axis]<min||from[axis]>max)return false;continue;}
    let a=(min-from[axis])/delta,b=(max-from[axis])/delta;
    if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);exit=Math.min(exit,b);if(enter>exit)return false;
  }
  return true;
}
export function wallHidesAvatar(camera,player,box){
  const dx=camera.x-player.x,dz=camera.z-player.z,length=Math.hypot(dx,dz)||1;
  const rightX=dz/length*.65,rightZ=-dx/length*.65;
  // Cover the silhouette, not just the single center ray used by Alpha 0.8.
  for(const height of [.12,.95,1.9])for(const side of [-1,0,1]){
    const point={x:player.x+rightX*side,y:player.y+height,z:player.z+rightZ*side};
    if(segmentHitsBox(camera,point,box))return true;
  }
  return false;
}
