import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {enhanceEngineFinish} from './Engine_Finish.js?v=68';

export const ENGINE_CHOICES=[
 {id:'mfs25',label:'Tohatsu MFS25D',size:'25 hp · three cylinder'},
 {id:'mfs60',label:'Tohatsu MFS60A',size:'60 hp · three cylinder'},
 {id:'mfs115',label:'Tohatsu MFS115A',size:'115 hp · inline four'},
 {id:'mfs140',label:'Tohatsu MFS140A',size:'140 hp · inline four'},
 {id:'bft150',label:'Tohatsu BFT150D',size:'150 hp · inline four'},
 {id:'bft200',label:'Tohatsu BFT200A',size:'200 hp · V6'},
 {id:'bft225',label:'Tohatsu BFT225A',size:'225 hp · V6'},
 {id:'bft250',label:'Tohatsu BFT250A',size:'250 hp · V6'}
].map(c=>({...c,thumb:`Motor_Refinement/Thumbnail_${c.id}.png?v=56`}));
export function engineChoicesForBoat(choice){return ENGINE_CHOICES.filter(c=>{const hp=Number(c.id.replace(/\D/g,''));return choice.hp!==0&&hp>=(choice.minHp??115)&&hp<=(choice.hp??250);});}
export const TROLLING_CHOICES=[
 {id:'minn-kota',label:'Minn Kota Riptide Ulterra',size:'Saltwater · auto deploy'},
 {id:'garmin-force',label:'Garmin Force Kraken',size:'Saltwater · pivot mount'},
 {id:'minn-kota-terrova',label:'Minn Kota Riptide Terrova QUEST',size:'Saltwater · lift assist'},
 {id:'rhodan-hd',label:'Rhodan HD GPS Anchor+',size:'Saltwater · white'},
 {id:'power-pole-move',label:'Power-Pole MOVE PV',size:'Saltwater · titanium shaft'},
 {id:'lowrance-ghost',label:'Lowrance Ghost',size:'Freshwater · scissor mount'}
].map(c=>({...c,thumb:`Trolling_Refinement/Thumbnail_${c.id}.png?v=54.3`}));

// Independent reference-guided meshes. Keep the approved original visible if loading fails.
export function createEngineOptions({root,onChange=()=>{},placements=null,allowed=ENGINE_CHOICES.map(c=>c.id),initial='bft250',tiller=false}){
 const original=[...root.children],variants=new Map(),loader=new GLTFLoader();let ready=false,selected=initial;
 const controller={get readyState(){return ready;},get selected(){return selected;},select(id){
  if(!ready||!variants.has(id)||!allowed.includes(id))return false;
  for(const [key,variant] of variants)variant.visible=key===id;
  selected=id;root.userData.engineModel=id;root.updateWorldMatrix(true,true);onChange(id);return true;
 }};
 controller.ready=Promise.all(ENGINE_CHOICES.filter(c=>allowed.includes(c.id)).map(async c=>{
  const g=await loader.loadAsync(`Motor_Refinement/Tohatsu_${c.id}.glb?v=69`),mount=new THREE.Group();
  root.updateWorldMatrix(true,false);let sceneRoot=root;while(sceneRoot.parent&&!sceneRoot.parent.isScene)sceneRoot=sceneRoot.parent;
  mount.matrix.copy(root.matrixWorld).invert().multiply(sceneRoot.matrixWorld);mount.matrixAutoUpdate=false;mount.name=`Installed Tohatsu | ${c.id}`;mount.visible=false;
  g.scene.traverse(o=>{
   const index=g.parser.associations.get(o)?.nodes;if(index!==undefined)o.userData.sourceName=g.parser.json.nodes[index].name;
   o.userData.part='engine';o.userData.engineModel=c.id;if(!o.isMesh)return;
   if((o.userData.sourceName||o.name).includes('Tiller'))o.visible=tiller;
   o.castShadow=true;o.receiveShadow=true;
   for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(m.name.startsWith('V49 | Tohatsu')){m.color.set('#202337');m.metalness=.06;m.roughness=.235;m.clearcoat=1;m.clearcoatRoughness=.16;m.envMapIntensity=.8;}
    else if(/painted aluminum propeller/i.test(m.name)){m.metalness=.25;m.roughness=.30;m.envMapIntensity=.6;}
    else if(/stainless|propeller|chrome/i.test(m.name)){m.metalness=1;m.roughness=.22;m.envMapIntensity=.6;}
    else if(/rubber|gasket|recess/i.test(m.name)){m.metalness=0;m.roughness=.78;}
   }
  });
  enhanceEngineFinish(g.scene,{horsepower:Number(c.id.replace(/\D/g,'')),compact:c.id!=='bft250'});
  if(placements){
   mount.matrix.identity();
   for(const position of placements){const installation=new THREE.Group();installation.position.copy(position).sub(new THREE.Vector3(-3.8989,1.32,0));installation.add(g.scene.clone(true));mount.add(installation);}
  }else mount.add(g.scene);
  root.add(mount);variants.set(c.id,mount);
 })).then(()=>{original.forEach(o=>o.visible=false);ready=true;controller.select(initial);return controller;});
 return controller;
}

export function createTrollingOptions({rig,onChange=()=>{}}){
 let selected='minn-kota';
 const controller={get readyState(){return rig.readyState;},get selected(){return selected;},select(id){
  if(!rig.readyState)return false;
  if(!TROLLING_CHOICES.some(c=>c.id===id))return false;
  rig.setVariant(id);selected=id;onChange(id);return true;
 }};
 controller.ready=rig.ready.then(()=>{controller.select(selected);return controller;});return controller;
}
