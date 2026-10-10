import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const V=(x,y,z)=>new THREE.Vector3(x,y,z),UP=V(0,1,0),D=V(.90897,0,.41687).normalize(),AXIS=V(.41687,0,-.90897).normalize();
const L=V(3.181779,1.8206,-.490770),M=V(2.865846,1.7816,-.635664);
const H=L.clone().addScaledVector(D,-1.7137);
const MODELS=[['minn-kota',.280],['garmin-force',.260],['minn-kota-terrova',.286],['rhodan-hd',.300],['power-pole-move',.265],['lowrance-ghost',.265]];

// The same editable Blender components are used in the viewer. Positive local Z
// is the drive's nose; the propeller is on negative Z, behind it.
export function refineTrollingRig({root,parts,restNose}){
 const families=new Map(),bodies=new Map(),loader=new GLTFLoader(),original=[...parts];
 const shaftUp=D.clone().negate(),across=shaftUp.clone().cross(restNose).normalize();
 const movingBasis=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,shaftUp,restNose));
 const mountBasis=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(AXIS,UP,D));
 let selected='minn-kota',ready=false;
 function select(id){
  selected=id;
  for(const [key,family] of families)family.visible=ready&&key===id;
  if(ready)for(const {o} of original)o.visible=false;
  root.updateMatrixWorld(true);
 }
 const controller={select,get readyState(){return ready;},getBody(){return bodies.get(selected);}};
 controller.ready=Promise.all(MODELS.map(async([id,length])=>{
  const g=await loader.loadAsync(new URL(`./Trolling_Refinement/Trolling_${id}.glb?v=54.3`,import.meta.url).href);
  const family=new THREE.Group();family.name='Trolling fitted variant | '+id;family.visible=false;root.add(family);
  g.scene.traverse(o=>{
   const index=g.parser.associations.get(o)?.nodes;if(index!==undefined)o.userData.sourceName=g.parser.json.nodes[index].name;
   o.userData.part='trolling';o.userData.trollingModel=id;
   if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;
   for(const m of Array.isArray(o.material)?o.material:[o.material]){
    m.envMapIntensity=/stainless|titanium/.test(m.name)?.62:.65;
    if(/powder-coated/.test(m.name)){m.clearcoat=.45;m.clearcoatRoughness=.20;}
   }
  });
  const components=[];g.scene.traverse(o=>{if(o.userData.trollingComponent)components.push(o);});
  for(const o of components){
   const kind=o.userData.trollingComponent;family.add(o);
   o.position.copy(kind==='head'?H:kind==='body'||kind==='shaft'?L:M);
   o.quaternion.copy(kind==='head'||kind==='body'||kind==='shaft'?movingBasis:mountBasis);
   if(kind==='head')o.position.addScaledVector(restNose,-length*.09);
   if(kind==='arm')o.position.addScaledVector(UP,.009);
   o.updateMatrix();
   parts.push({o,name:'reference '+kind,rest:o.matrix.clone(),motion:['head','body','shaft'].includes(kind)?'shaft':kind==='arm'?'pivot':null});
   if(kind==='body')bodies.set(id,o);
  }
  if(components.length!==5)throw Error('Missing trolling motor components: '+id);
  families.set(id,family);
 })).then(()=>{ready=true;select(selected);return controller;});
 return controller;
}
