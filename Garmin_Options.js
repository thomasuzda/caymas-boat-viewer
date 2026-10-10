import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export const GARMIN_CHOICES=[
 {id:'723',asset:'723',width:.192,label:'Garmin GPSMAP 723xsv',size:'7-inch touchscreen',source:'https://www.garmin.com/en-US/p/697228/'},
 {id:'943',asset:'943',width:.233,label:'Garmin GPSMAP 943xsv',size:'9-inch touchscreen',source:'https://www.garmin.com/en-US/p/799080/'},
 {id:'echomap',asset:'echomap',width:.264,label:'Garmin ECHOMAP UHD2 93sv',size:'9-inch screen · physical keys',source:'https://www.garmin.com/en-US/p/796274/'},
 {id:'ultra102',asset:'ultra102',width:.295,label:'Garmin ECHOMAP Ultra 2 102sv',size:'10-inch screen · key assist',source:'https://www8.garmin.com/manuals/webhelp/GUID-9A17B80C-F7A5-4535-8E7D-E8F0ECD1DCD4/EN-US/GUID-57D72BB6-E045-412B-A489-3EB816944DCD.html'},
 {id:'standard',asset:'1243',width:.3083,label:'Garmin GPSMAP 1243xsv',size:'12-inch touchscreen',source:'https://www.garmin.com/en-US/p/799024/'},
 {id:'ultra122',asset:'ultra122',width:.341,label:'Garmin ECHOMAP Ultra 2 122sv',size:'12-inch screen · key assist',source:'https://www8.garmin.com/manuals/webhelp/GUID-9A17B80C-F7A5-4535-8E7D-E8F0ECD1DCD4/EN-US/GUID-57D72BB6-E045-412B-A489-3EB816944DCD.html'},
 {id:'1643',asset:'1643',width:.384,label:'Garmin GPSMAP 1643xsv',size:'16-inch touchscreen',source:'https://www.garmin.com/en-US/p/1240432/'},
 {id:'8616',asset:'8616',width:.385,label:'Garmin GPSMAP 8616xsv',size:'16-inch touchscreen',source:'https://www.garmin.com/en-US/p/799241/'}
];
// Cache complete, installed pairs. A selection changes visibility atomically:
// the previous Garmin remains installed if a required asset cannot load.
export function createGarminOptions({root,source,anisotropy=8,onChange=()=>{},mounts=null,scale=1.10,maxWidth=.3083,initial='standard'}){
 const originals=[...root.children],layouts=mounts?[...mounts]:[];root.updateWorldMatrix(true,true);
 if(!mounts)root.traverse(o=>{
  if(!o.isMesh||!source(o).includes('chart and sonar LCD'))return;
  const p=o.geometry.attributes.position,uv=o.geometry.attributes.uv,corners=[];
  for(const [u,v] of [[0,0],[1,0],[0,1]]){
   let best=0,distance=Infinity;for(let i=0;i<p.count;i++){const d=(uv.getX(i)-u)**2+(uv.getY(i)-v)**2;if(d<distance){distance=d;best=i;}}
   corners.push(new THREE.Vector3().fromBufferAttribute(p,best).applyMatrix4(o.matrixWorld));
  }
  const right=corners[1].clone().sub(corners[0]).normalize(),up=corners[0].clone().sub(corners[2]).normalize(),normal=new THREE.Vector3().crossVectors(right,up).normalize();
  const center=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
  // Match the current console installation while keeping all variant proportions uniform.
  const matrix=new THREE.Matrix4().makeBasis(right,up,normal).setPosition(center.clone().addScaledVector(up,-.011*1.10).addScaledVector(normal,-.0225*1.10));
  matrix.premultiply(root.matrixWorld.clone().invert());
  layouts.push({matrix,side:source(o).includes('starboard')?'starboard':'port'});
 });
 if(!layouts.length)throw new Error('Missing Garmin display mounting positions.');
 const loader=new GLTFLoader(),textures=new THREE.TextureLoader(),pairs=new Map();let active=null,ready=false;
 const fits=id=>GARMIN_CHOICES.some(c=>c.id===id&&c.width<=maxWidth+.00001);
 const controller={fits,get readyState(){return ready;},get selected(){return active;},get installedCount(){return active?layouts.length:0;},select(id){
  if(!ready||!pairs.has(id)||!fits(id))return false;
  for(const [key,pair] of pairs)pair.visible=key===id;
  active=id;root.userData.garminModel=id;onChange(id);return true;
 }};
 controller.ready=Promise.all(GARMIN_CHOICES.map(async choice=>{
  const [g,sonar]=await Promise.all([loader.loadAsync(`Garmin_Refinement/Garmin_${choice.asset}.glb?v=55`),textures.loadAsync(`Garmin_Refinement/${choice.asset}_Sonar.png?v=55`)]);
  sonar.colorSpace=THREE.SRGBColorSpace;sonar.flipY=false;sonar.anisotropy=anisotropy;
  const pair=new THREE.Group();pair.name=`GARMIN installed pair | ${choice.id}`;pair.visible=false;pair.userData.model=choice.id;
  for(const layout of layouts){
   const mount=new THREE.Group();mount.name=`GARMIN installation | ${layout.side} | ${choice.id}`;mount.matrix.copy(layout.matrix);mount.matrixAutoUpdate=false;
   const device=g.scene.clone(true);device.scale.setScalar(scale);
   device.traverse(o=>{
    o.userData.part='garmin';o.userData.garminModel=choice.id;o.userData.displaySide=layout.side;
    if(!o.isMesh)return;
    o.material=o.material.clone();o.castShadow=true;o.receiveShadow=true;const m=o.material;
    if(m.name.startsWith('V47 Garmin LCD')){
     if(layout.side==='starboard'){m.map=sonar;m.emissiveMap=sonar;}
     for(const tx of [m.map,m.emissiveMap])if(tx)tx.anisotropy=anisotropy;
     m.color.set('#000000');m.emissive.set('#ffffff');m.emissiveIntensity=1;m.toneMapped=false;m.roughness=.42;m.envMapIntensity=.025;o.castShadow=false;o.receiveShadow=false;
    }else if(m.name.includes('clear cover lens')){
     Object.assign(m,{transmission:0,metalness:0,opacity:.035,transparent:true,depthWrite:false,ior:1.5,thickness:.0008,roughness:.065,clearcoat:.1,clearcoatRoughness:.04,envMapIntensity:.22});o.castShadow=false;o.receiveShadow=false;
    }else if(m.name.includes('black optical bezel')){m.metalness=0;m.roughness=.18;m.envMapIntensity=.48;}
    else if(m.name.includes('satin molded polymer')){m.metalness=0;m.roughness=.33;m.envMapIntensity=.35;}
    m.needsUpdate=true;
   });
   mount.add(device);
   // The existing molded console wall is continuous behind each display.
   // Leave it exposed around smaller bezels so no separate panel edge or seam appears.
   pair.add(mount);
  }
  root.add(pair);pairs.set(choice.id,pair);
 })).then(()=>{
  originals.forEach(o=>{o.visible=false;});ready=true;
  const requested=new URLSearchParams(location.search).get('garmin');controller.select(fits(requested)?requested:initial);
  return controller;
 });
 return controller;
}
