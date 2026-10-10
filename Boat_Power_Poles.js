import * as THREE from 'three';

// Viewer rig for the existing concept meshes, in the GLB's local X/Y plane.
// The second channel follows the top knuckle; its concept geometry is not
// a dimensioned manufacturer linkage or a seabed-contact simulation.
const A=new THREE.Vector3(-4.275,.980,0),B=new THREE.Vector3(-4.390,2.277,0);
const A2=new THREE.Vector3(-4.200,1.022,0),B2=new THREE.Vector3(-4.317,2.205,0);
const base=new THREE.Vector3(-4.185,.993,0),head=new THREE.Vector3(-4.228,1.365,0),rod=new THREE.Vector3(-4.267,1.682,0);
const Z=new THREE.Vector3(0,0,1),Y=new THREE.Vector3(0,1,0);
function at(p,z){return new THREE.Vector3(p.x,p.y,z);}
function segmentMap(a,b,c,d){
 const from=b.clone().sub(a),to=d.clone().sub(c);
 const q0=new THREE.Quaternion().setFromUnitVectors(Y,from.clone().normalize());
 const q1=new THREE.Quaternion().setFromUnitVectors(Y,to.clone().normalize());
 return new THREE.Matrix4().compose(c,q1,new THREE.Vector3(1,to.length()/from.length(),1))
  .multiply(new THREE.Matrix4().compose(a,q0,new THREE.Vector3(1,1,1)).invert());
}
export function createPowerPoles(model,source,onChange){
 const poles=[];
 for(const side of ['port','starboard']){
  let root;model.traverse(o=>{if(source(o)===`POWER-POLE | ${side} editable assembly`)root=o;});
  if(!root)throw Error(`Missing ${side} Power-Pole`);
  const z=side==='port'?-1.025:1.025,parts=[];
  root.traverse(o=>{o.userData.part=`pole-${side}`;if(o===root)return;o.updateMatrix();parts.push({o,name:source(o).split(' | ')[1],rest:o.matrix.clone()});});
  poles.push({side,root,z,parts,value:0,target:0,motion:null});
 }
 function pose(p,value){
  p.value=value;const a=at(A,p.z),b=at(B,p.z),a2=at(A2,p.z),b2=at(B2,p.z);
  const q=new THREE.Quaternion().setFromAxisAngle(Z,2.5*value);
  const turn=new THREE.Matrix4().makeTranslation(...a.toArray()).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(...a.clone().negate().toArray()));
  const nextB=b.clone().applyMatrix4(turn),delta=nextB.clone().sub(b);
  const follow=new THREE.Matrix4().makeTranslation(...delta.toArray());
  const second=segmentMap(a2,b2,a2,b2.clone().add(delta));
  const nextRod=at(rod,p.z).applyMatrix4(turn),fixed=at(base,p.z);
  const nextHead=fixed.clone().add(nextRod.clone().sub(fixed).normalize().multiplyScalar(base.distanceTo(head)));
  const cylinder=segmentMap(fixed,at(head,p.z),fixed,nextHead);
  const piston=segmentMap(at(head,p.z),at(rod,p.z),nextHead,nextRod);
  for(const {o,name,rest} of p.parts){
   let transform=null;
   if(name.startsWith('perforated arm 0')||name==='arm channel spine'||name.startsWith('Blade marking'))transform=turn;
   else if(name.startsWith('perforated arm 1')||name==='arm channel spine.001')transform=second;
   else if(name==='upper joint knuckle'||name==='nested composite spike'||name==='tapered spike tip'||/bronze pivot bush\.00[23]$/.test(name)||/stainless joint cap\.00[4-7]$/.test(name))transform=follow;
   else if(name==='hydraulic cylinder')transform=cylinder;
   else if(name==='polished hydraulic rod')transform=piston;
   o.matrixAutoUpdate=false;o.matrix.copy(rest);if(value>0&&transform)o.matrix.premultiply(transform);o.matrixWorldNeedsUpdate=true;
  }
  p.root.updateMatrixWorld(true);
 }
 function toggle(side,now,instant=false){
  const p=poles.find(x=>x.side===side);if(!p)return;
  p.target=1-p.target;
  if(instant){p.motion=null;pose(p,p.target);}
  else p.motion={from:p.value,start:now,duration:1500*Math.abs(p.target-p.value)};
  onChange?.(p.side,p.target,!!p.motion);
 }
 function update(now){let changed=false;for(const p of poles){if(!p.motion)continue;const t=Math.min(1,(now-p.motion.start)/Math.max(1,p.motion.duration));const smooth=t*t*(3-2*t);pose(p,p.motion.from+(p.target-p.motion.from)*smooth);changed=true;if(t===1){p.motion=null;onChange?.(p.side,p.target,false);}}return changed;}
 return {toggle,update,poles};
}
