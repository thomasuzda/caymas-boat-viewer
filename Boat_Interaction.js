// Pure interaction rules, shared by the viewer and its gesture/framing checks.
export class TapIntent {
  constructor(){this.pointers=new Map();this.blocked=false;}
  down(e,part){
    if(this.pointers.size===0)this.blocked=false;
    if(this.pointers.size>0||e.isPrimary===false)this.blocked=true;
    this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,time:e.timeStamp,part,
      threshold:e.pointerType==='mouse'?5:10,moved:false,eligible:e.button===0});
  }
  move(e){
    const p=this.pointers.get(e.pointerId);
    if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>p.threshold)p.moved=true;
  }
  up(e,part){
    this.move(e);
    const p=this.pointers.get(e.pointerId);
    const valid=p&&!this.blocked&&!p.moved&&p.eligible&&this.pointers.size===1&&
      e.timeStamp-p.time<550&&p.part&&p.part===part;
    this.pointers.delete(e.pointerId);
    if(!this.pointers.size)this.blocked=false;
    return valid?p.part:null;
  }
  cancel(id){this.blocked=true;this.pointers.delete(id);}
  block(){this.blocked=true;}
  reset(){this.pointers.clear();this.blocked=false;}
  get active(){return this.pointers.size>0;}
}

// Exact perspective fit of every bounding-box corner, including its depth.
export function fitDistance(corners,center,right,up,direction,verticalFov,aspect,padding=1.12){
  const tanY=Math.tan(verticalFov/2),tanX=tanY*Math.max(.01,aspect);
  let distance=.1;
  for(const corner of corners){
    const x=corner[0]-center[0],y=corner[1]-center[1],z=corner[2]-center[2];
    const depth=x*direction[0]+y*direction[1]+z*direction[2];
    distance=Math.max(distance,depth+padding*Math.abs(x*right[0]+y*right[1]+z*right[2])/tanX,
      depth+padding*Math.abs(x*up[0]+y*up[1]+z*up[2])/tanY,depth+.1);
  }
  return distance;
}
