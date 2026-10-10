import * as THREE from 'three';
import {refineTrollingRig} from './Trolling_Finish.js?v=54.3';
const V=(x,y,z)=>new THREE.Vector3(x,y,z),UP=V(0,1,0);
const H=V(1.624903,1.8089,-1.204786),L=V(3.181779,1.8206,-.490770),HUB=V(3.199887,1.8206,-.338346);
const P=V(2.865846,1.805,-.635664),M=V(2.865846,1.7816,-.635664);
const D=V(.90897,0,.41687).normalize(),AXIS=V(.41687,0,-.90897).normalize();
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
const phase=(p,a,b)=>smooth((p-a)/(b-a));
const move=(a,b,q=new THREE.Quaternion())=>new THREE.Matrix4().makeTranslation(...b.toArray()).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(...a.clone().negate().toArray()));
// Older Ulterra-style fixed hinge + power trim. References and limits are in
// Trolling_Motor_Motion_Notes.txt. This is a viewer rig, not manufacturer CAD.
export function trollingPose(p,variant='minn-kota'){
 const release=phase(p,0,.16),tip=phase(p,.16,.62),trim=phase(p,.65,1);
 const q=new THREE.Quaternion().setFromAxisAngle(AXIS,Math.PI/2*tip);
 const shaftDirection=D.clone().applyQuaternion(q);
 const pivotMap=move(M,M,q);
 const transport=new THREE.Matrix4().makeTranslation(...shaftDirection.clone().multiplyScalar(.075*release+1.04*trim).toArray()).multiply(pivotMap);
 return {q,transport,pivotMap,shaftDirection,release,tip,trim,head:L.clone().addScaledVector(D,-1.7137).applyMatrix4(transport),body:L.clone().applyMatrix4(transport)};
}
export function trollingRestNose(placement){
 const placed=new THREE.Quaternion().setFromRotationMatrix(placement),tilt=new THREE.Quaternion().setFromAxisAngle(AXIS,Math.PI/2);
 return V(1,0,0).applyQuaternion(placed.multiply(tilt).invert()).normalize();
}
export function createTrollingMotor(model,source,onChange){
 let root;model.traverse(o=>{if(source(o)==='TROLLING MOTOR | editable stowed assembly')root=o;});
 if(!root)throw Error('Missing trolling motor assembly');
 // Place the fixed mount at the port bow edge. The old mount was too far inboard
 // and the former animation compensated by inventing a sideways folding arm.
 const yaw=Math.atan2(D.z,D.x)-Math.atan2(.18,.984);
 const placement=move(M,V(3.30,1.8816,-.81),new THREE.Quaternion().setFromAxisAngle(UP,yaw));
 root.matrixAutoUpdate=false;root.matrix.copy(placement);
 const parts=[];root.traverse(o=>{o.userData.part='trolling';if(o!==root){o.updateMatrix();parts.push({o,name:source(o).split(' | ')[1],rest:o.matrix.clone()});}});
 const find=name=>parts.find(p=>p.name===name)?.o;
 const white=find('white lower cradle').material,metal=find('deployment pivot').material,black=find('black stowed composite shaft').material;
 // Correct the source model's stowed head / torpedo axes. These corrections are
 // applied once; all attached parts then share the same rigid tilt transform.
 const headRest=move(H,H,new THREE.Quaternion().setFromAxisAngle(AXIS,-Math.PI/2));
 const bodyRest=move(L,L,new THREE.Quaternion().setFromAxisAngle(UP,-Math.PI/2));
 const propRest=move(HUB,L.clone().addScaledVector(AXIS,-.19));
 for(const p of parts){if(p.name==='aft white steering head'||p.name==='steering head graphite inset')p.rest.premultiply(headRest);else if(p.name==='white lower-unit torpedo')p.rest.premultiply(bodyRest);else if(p.name.startsWith('prop'))p.rest.premultiply(propRest);}
 const rig=new THREE.Group();rig.name='Trolling motor | fixed-hinge trim details';root.add(rig);
 function mesh(name,geometry,material){const o=new THREE.Mesh(geometry,material);o.name=name;o.userData.part='trolling';o.castShadow=true;o.receiveShadow=true;rig.add(o);return o;}
 const collar=mesh('Trolling motor | trim shaft collar',new THREE.CylinderGeometry(.047,.047,.09,24),white);
 const boot=mesh('Trolling motor | collar seal',new THREE.CylinderGeometry(.025,.025,.096,24),black);
 const cable=mesh('Trolling motor | following coiled cable',new THREE.BufferGeometry(),find('hanging coiled power cable').material);
 const pivotPin=mesh('Trolling motor | fixed hinge axle',new THREE.CylinderGeometry(.023,.023,.24,20),metal);pivotPin.position.copy(M);pivotPin.quaternion.setFromUnitVectors(UP,AXIS);
 const restNose=trollingRestNose(placement),refinements=refineTrollingRig({root,parts,restNose});
 let value=0,target=0,motion=null,variant='minn-kota';
 function pose(p){
  value=p;const state=trollingPose(p,variant);
  for(const {o,name,rest,motion:partMotion} of parts){
   let transform=null;
   if(partMotion==='shaft'||name==='black stowed composite shaft'||name==='aft white steering head'||name==='steering head graphite inset'||name==='white lower-unit torpedo'||name.startsWith('prop'))transform=state.transport;
   else if(partMotion==='pivot'||name==='sculpted white folding housing')transform=state.pivotMap;
   o.matrixAutoUpdate=false;o.matrix.copy(rest);if(transform)o.matrix.premultiply(transform);o.matrixWorldNeedsUpdate=true;
  }
  // Mounting shoe, quick-release plate, cradle, hinge caps and deck lead stay put.
  find('hanging coiled power cable').visible=false;
  const sleeve=P.clone().applyMatrix4(state.pivotMap);
  for(const o of[collar,boot]){o.position.copy(sleeve);o.quaternion.setFromUnitVectors(UP,state.shaftDirection);}
  const cableSide=D.clone().negate().cross(restNose).normalize().applyQuaternion(state.q);
  const cableAft=restNose.clone().applyQuaternion(state.q);
  const start=state.head.clone().addScaledVector(cableSide,.025).addScaledVector(cableAft,-.115),finish=M.clone().add(V(-.12,-.055,.075));
  const control=start.clone().lerp(finish,.53).addScaledVector(AXIS,.09).addScaledVector(UP,-.12);
  const path=new THREE.QuadraticBezierCurve3(start,control,finish),points=[];
  for(let i=0;i<=160;i++){
   const t=i/160,point=path.getPoint(t),direction=path.getTangent(t).normalize();
   const across=AXIS.clone().cross(direction).normalize(),around=direction.clone().cross(across).normalize();
   const r=.023*Math.min(1,t*10,(1-t)*10),angle=t*Math.PI*28;
   point.addScaledVector(across,r*Math.cos(angle)).addScaledVector(around,r*Math.sin(angle));points.push(point);
  }
  const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),200,.0048,6,false);cable.geometry.dispose();cable.geometry=geometry;
  root.updateMatrixWorld(true);
  const body=refinements.getBody(),forward=body?V(0,0,1).transformDirection(body.matrixWorld):restNose.clone().applyQuaternion(state.q).transformDirection(placement);
  root.userData.deployment={progress:p,pivot:M.clone().applyMatrix4(placement).toArray(),head:state.head.clone().applyMatrix4(placement).toArray(),lower:state.body.clone().applyMatrix4(placement).toArray(),forward:forward.toArray()};
 }
 function setDeployed(deployed,now,instant=false){
  const next=deployed?1:0;if(target===next)return;target=next;if(instant){motion=null;pose(target);}else motion={from:value,start:now,duration:6800*Math.abs(target-value)};onChange?.(target,!!motion);}
 function toggle(now,instant=false){setDeployed(!target,now,instant);}
 function update(now){if(!motion)return false;const t=Math.min(1,(now-motion.start)/Math.max(1,motion.duration));pose(THREE.MathUtils.lerp(motion.from,target,t));if(t===1){motion=null;onChange?.(target,false);}return true;}
 pose(0);
 const ready=refinements.ready.then(()=>{collar.visible=false;boot.visible=false;pivotPin.visible=false;pose(value);onChange?.(target,!!motion);return true;});
 function focusBounds(){
  root.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3().setFromObject(root),pad=V(.22,.22,.22);
  // Include both resting positions, so a button-framed view
  // has room for deployment without moving the camera when the motor is tapped.
  for(const progress of [0,1]){
   const state=trollingPose(progress,variant);
   for(const point of [state.head,state.body]){
    point.applyMatrix4(root.matrixWorld);
    bounds.expandByPoint(point.clone().sub(pad));bounds.expandByPoint(point.clone().add(pad));
   }
  }
  return bounds;
 }
 function setVariant(id){variant=id;refinements.select(id);pose(value);}
 return {toggle,setDeployed,update,focusBounds,setVariant,ready,get readyState(){return refinements.readyState;},get value(){return value;},root};
}
