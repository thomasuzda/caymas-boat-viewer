import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createGarminOptions} from './Garmin_Options.js?v=55.1';
import {createEngineOptions,createTrollingOptions,engineChoicesForBoat} from './Motor_Options.js?v=56.1';
import {createTrollingMotor} from './Boat_Trolling_Motor.js?v=54.3';

export const BOAT_CHOICES=[
 {id:'caymas',label:'Caymas 26 HB',description:'26 ft · center console · original boat',source:'https://caymasboats.com/26-hb/'},
 {id:'small-cc',label:'Key West 189 FS',description:'19 ft · open center console',hp:150,engine:'mfs115',garmin:'943',trolling:'garmin-force'},
 {id:'bass',label:'Ranger Z520R',description:'21 ft · bass boat · low casting decks',hp:250,engine:'bft250',garmin:'ultra102',trolling:'lowrance-ghost'},
 {id:'flats',label:'Hewes Redfisher 18',description:'19 ft · flats boat · poling platform',hp:150,engine:'mfs115',garmin:'standard',trolling:'rhodan-hd'},
 {id:'offshore',label:'Sea Hunt Ultra 305SE',description:'30 ft · offshore center console · twin outboards',hp:250,minHp:200,engineCount:2,engine:'bft250',garmin:'1643',trolling:'garmin-force'},
 {id:'yacht',label:'Princess F45',description:'45 ft · flybridge yacht · enclosed inboard engines',hp:0,garmin:'8616'},
 {id:'skiff',label:'Carolina Skiff 19 LS',description:'19 ft · utility skiff · canvas T-top',hp:115,minHp:60,engine:'mfs115',garmin:'standard',trolling:'garmin-force'},
 {id:'pontoon',label:'Sun Tracker Bass Buggy 18 DLX',description:'20 ft · fishing pontoon · two tubes',hp:75,minHp:25,engine:'mfs60',garmin:'943',trolling:'lowrance-ghost'},
 {id:'tritoon',label:'Bennington 22SX SPS',description:'22 ft · tritoon · three tubes',hp:150,minHp:60,engine:'mfs140',garmin:'943',trolling:'garmin-force'},
 {id:'dual-console',label:'Grady-White Freedom 235',description:'24 ft · dual console · walk-through windshield',hp:250,minHp:150,engine:'bft250',garmin:'standard',trolling:'garmin-force'},
 {id:'pilothouse',label:'Parker 2520 XLD Sport Cabin',description:'25 ft · pilothouse · twin outboards',hp:250,minHp:150,engineCount:2,engine:'bft200',garmin:'standard',trolling:'garmin-force'},
 {id:'power-cat',label:'World Cat 265CC-X',description:'26 ft · power catamaran · twin outboards',hp:200,minHp:150,engineCount:2,engine:'bft200',garmin:'1643',trolling:'garmin-force'},
 {id:'jon',label:'Tracker Grizzly 1648 Utility',description:'16 ft · camouflaged aluminum jon boat · tiller',hp:40,minHp:25,engine:'mfs25',garmin:'723',trolling:'lowrance-ghost',tiller:true}
];

// Layout studies are separate native models. No hull is stretched from the Caymas.
// Equipment is installed at boat-specific anchors and settings stay with each boat.
export async function createFleetBoat({choice,trollingTemplate,source,anisotropy,onEquipment,onTrolling}){
 const [g,specs]=await Promise.all([new GLTFLoader().loadAsync(`Boat_Fleet/Boat_${choice.id}.glb?v=59.1`),fetch('Boat_Fleet/Boat_Layout_Specifications.json?v=59.1').then(r=>{if(!r.ok)throw Error('Boat layout unavailable');return r.json();})]);
 const spec=specs.find(s=>s.id===choice.id);if(!spec)throw Error('Missing boat layout');
 const root=g.scene,current={},session={root,current,choice,spec,powerPoles:null};
 root.traverse(o=>{
  const index=g.parser.associations.get(o)?.nodes;
  if(index!==undefined)o.userData.sourceName=g.parser.json.nodes[index].name;
  if(!o.isMesh)return;
  const materials=Array.isArray(o.material)?o.material:[o.material];
  o.castShadow=o.receiveShadow=materials.every(m=>!m.transmission);
  for(const m of materials){
   if(m.name.includes('mirror polished marine stainless')){m.envMapIntensity=.38;m.metalness=1;m.roughness=.17;m.anisotropy=0;}
   if(m.name.startsWith('V23')&&m.name.includes('stainless'))m.envMapIntensity=.62;
   if(m.name.startsWith('V23')||m.name.startsWith('V58')||m.name.startsWith('V59'))for(const texture of [m.normalMap,m.roughnessMap])if(texture){texture.anisotropy=anisotropy;texture.needsUpdate=true;}
   if(m.name.startsWith('Fleet | clear windshield')){m.color.set('#ffffff');m.roughness=0;m.envMapIntensity=.30;m.ior=1.52;m.thickness=.006;m.side=THREE.FrontSide;}
  }
 });
 session.layout=choice.id==='tritoon'?'tritoon':choice.id==='pontoon'?'pontoon':'hull';session.setLayout=layout=>layout===session.layout;
 current.garmin=new THREE.Group();current.garmin.name='Garmin | boat-specific helm';root.add(current.garmin);
 const mounts=[];
 for(let i=0;i<spec.displays;i++){
  const center=new THREE.Vector3(...spec.helm);center.z+=spec.displays===2?(i===0?-.216:.216):0;
  const pitch=spec.helmPitch||0;
  const matrix=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,1),new THREE.Vector3(Math.sin(pitch),Math.cos(pitch),0),new THREE.Vector3(-Math.cos(pitch),Math.sin(pitch),0)).setPosition(center);
  mounts.push({matrix,side:i===1?'starboard':'port'});
 }
 session.garminOptions=createGarminOptions({root:current.garmin,source,mounts,scale:1,maxWidth:spec.maxDisplay,initial:choice.garmin,anisotropy,onChange:id=>onEquipment(session,'garmin',id)});
 if(choice.hp){
  current.engine=new THREE.Group();current.engine.name='Tohatsu | boat transom';root.add(current.engine);
  const positions=spec.engineMounts?spec.engineMounts.map(p=>new THREE.Vector3(...p)):choice.engineCount===2?[new THREE.Vector3(-spec.L/2,spec.gun-.04,-.68),new THREE.Vector3(-spec.L/2,spec.gun-.04,.68)]:[new THREE.Vector3(-spec.L/2,spec.engineHeight??spec.gun-.025,0)];
  const allowed=engineChoicesForBoat(choice).map(c=>c.id);
  session.engineOptions=createEngineOptions({root:current.engine,placements:positions,allowed,initial:choice.engine,tiller:!!choice.tiller,onChange:id=>onEquipment(session,'engine',id)});
  const adapter=new THREE.Group();adapter.name='Trolling | boat-specific bow mount';root.add(adapter);adapter.add(trollingTemplate.clone(true));
  session.trollingMotor=createTrollingMotor(adapter,source,(target,moving)=>onTrolling(session,target,moving));current.trolling=session.trollingMotor.root;
  const scale=spec.trollingScale??(choice.id==='offshore'?1.05:choice.id==='bass'?.70:.74);
  adapter.scale.setScalar(scale);
  const target=spec.trollingAnchor?new THREE.Vector3(...spec.trollingAnchor):new THREE.Vector3(spec.L*.395,spec.gun+.055,-spec.B*.23);
  adapter.position.copy(target).sub(new THREE.Vector3(3.30,1.8816,-.81).multiplyScalar(scale));
  session.trollingOptions=createTrollingOptions({rig:session.trollingMotor,onChange:id=>onEquipment(session,'trolling',id)});
 }else{
  // The yacht's enclosed inboards stay enclosed. Focus the engine button on the
  // actual pod drives, rather than installing an outboard on an inboard yacht.
  current.engine=new THREE.Group();current.engine.name='Yacht | twin inboard pod drives';root.add(current.engine);
  const pods=[];root.traverse(o=>{if(/Fleet \| (inboard pod|pod gearcase|pod propeller)/.test(source(o)))pods.push(o);});
  root.updateMatrixWorld(true);for(const pod of pods){current.engine.attach(pod);pod.userData.part='engine';}
 }
 session.ready=Promise.all([session.garminOptions.ready,session.engineOptions?.ready,session.trollingOptions?.ready]).then(()=>{session.trollingOptions?.select(choice.trolling);return session;});
 await session.ready;return session;
}
