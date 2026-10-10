import * as THREE from 'three';
import {DecalGeometry} from 'three/addons/geometries/DecalGeometry.js';
// Graphics reconstructed from approved BFT250 rounded-cowling photo 02.
// Thin satin graphics conform to the cover rather than floating raised lettering.
function graphic(kind,horsepower=250){
 const c=document.createElement('canvas');c.width=kind==='brand'?1600:1024;c.height=kind==='brand'?420:768;
 const ctx=c.getContext('2d');ctx.fillStyle='#e6e9e7';
 if(kind==='brand'){
  ctx.save();ctx.translate(178,210);ctx.scale(158,179);ctx.strokeStyle='#e6e9e7';ctx.lineWidth=.085;
  ctx.beginPath();ctx.ellipse(0,0,.83,.94,0,0,Math.PI*2);ctx.stroke();
  // The open central notch and tapered wings distinguish the Tohatsu crest.
  ctx.beginPath();ctx.moveTo(-1,-.48);ctx.lineTo(-.19,-.48);ctx.lineTo(0,-.03);ctx.lineTo(.19,-.48);ctx.lineTo(1,-.48);ctx.lineTo(.78,.05);ctx.lineTo(.20,.05);ctx.lineTo(0,.92);ctx.lineTo(-.18,.05);ctx.lineTo(-.78,.05);ctx.closePath();ctx.fill();ctx.restore();
  ctx.save();ctx.font='700 350px "Arial Narrow", Arial, sans-serif';ctx.textBaseline='alphabetic';
  const width=ctx.measureText('TOHATSU').width;ctx.translate(374,337);ctx.scale(1196/width,1);ctx.fillText('TOHATSU',0,0);ctx.restore();
 }else if(kind==='technology'){
  ctx.strokeStyle='#d0d4d6';ctx.lineWidth=8;ctx.strokeRect(90,70,844,628);ctx.textAlign='center';ctx.fillStyle='#d0d4d6';ctx.font='700 176px Arial';ctx.fillText('Simpliq',512,325);ctx.font='100px Arial';ctx.fillText('TECHNOLOGY',512,505);
 }else if(horsepower!==250){
  ctx.fillStyle='#cbd0d5';ctx.font='900 670px "Arial Narrow", Arial, sans-serif';ctx.textBaseline='middle';
  const value=String(horsepower),width=ctx.measureText(value).width;ctx.translate(35,405);ctx.scale(950/width,1);ctx.fillText(value,0,0);
 }else{
  // Heavy, tightly spaced numerals match the rounded-cowling reference;
  // outlines keep the shape identical on every device.
  ctx.fillStyle='#cbd0d5';ctx.translate(27,37);ctx.scale(3.10,4.28);
  const numerals=["M 6 43 C 6 13 20 2 48 2 C 78 2 91 19 91 44 C 91 68 80 85 58 111 L 40 133 L 91 133 L 91 159 L 5 159 L 5 137 L 42 91 C 57 72 65 59 65 44 C 65 32 61 26 49 26 C 36 26 33 34 33 47 L 6 47 Z", "M 11 3 L 90 3 L 90 29 L 37 29 L 34 62 C 40 58 47 56 55 56 C 81 56 95 73 95 106 C 95 145 78 162 48 162 C 17 162 3 145 3 118 L 30 118 C 31 132 36 139 47 139 C 61 139 67 129 67 109 C 67 87 62 79 49 79 C 40 79 35 83 31 89 L 7 86 Z", "M 49 1 C 85 1 97 25 97 81 C 97 138 84 162 49 162 C 14 162 1 138 1 81 C 1 25 14 1 49 1 Z M 49 27 C 34 27 29 39 29 81 C 29 123 34 136 49 136 C 64 136 69 123 69 81 C 69 39 64 27 49 27 Z"];
  for(let i=0;i<numerals.length;i++){ctx.save();ctx.translate(i*101,0);ctx.fill(new Path2D(numerals[i]),'evenodd');ctx.restore();}
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;t.needsUpdate=true;return t;
}
function microfinish(kind){
 const n=256,data=new Uint8Array(n*n*4);let seed=733;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  seed=(1664525*seed+1013904223)>>>0;const v=(seed&255);
  const q=kind==='rubber'?170+v*.24:kind==='metal'?170+Math.sin(y*1.7)*15+v*.13:206+v*.11;
  data.set([q,q,q,255],4*(y*n+x));
 }
 const t=new THREE.DataTexture(data,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,5);t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
}
export function enhanceEngineFinish(model,{horsepower=250,compact=false}={}){
 if(model.userData.engineFinishVersion===68)return;
 const source=o=>o.userData.sourceName||o.name,paintGrain=microfinish('paint'),rubberGrain=microfinish('rubber'),steelGrain=microfinish('metal');
 const paint=new THREE.MeshPhysicalMaterial({name:'Tohatsu | glossy near-black factory clearcoat',color:'#090e16',metalness:.04,roughness:.145,clearcoat:1,clearcoatRoughness:.085,roughnessMap:paintGrain,envMapIntensity:.95});
 const rubber=new THREE.MeshPhysicalMaterial({name:'BFT250 | molded rubber',color:'#101516',metalness:0,roughness:.79,bumpMap:rubberGrain,bumpScale:.00015,roughnessMap:rubberGrain});
 const steel=new THREE.MeshPhysicalMaterial({name:'Tohatsu | polished stainless',color:'#cbd2d6',metalness:1,roughness:.14,roughnessMap:steelGrain,anisotropy:0,envMapIntensity:.9});
 let cowling;const old=[];
 model.traverse(o=>{
  if(!o.isMesh)return;const name=source(o);if(!name.startsWith('Tohatsu |'))return;
  if(/sculpted black cowling|reference sculpted cowling/.test(name))cowling=o;
  if(compact&&/molded side shoulder crease|upper cap panel join|polished painted intake lip/.test(name)){old.push(o);return;}
  if(/aft 250 badge|aft name|side emblem|side TOHATSU|side wing emblem|side printed brand|aft printed horsepower/.test(name)){old.push(o);return;}
  if(/sculpted black cowling|reference sculpted cowling|sculpted spray plate|tapered swept skeg|trim cylinder|formed compact exhaust housing|compact hydrodynamic gearcase|formed four-cylinder exhaust housing|formed V6 lower cover pan|continuous cast gearcase neck|lower cowling pan|tapered exhaust leg|hydrodynamic gearcase|spray plate|spray rail|swept skeg|painted intake lip|forward inlet rib/.test(name))o.material=paint;
  else if(/rubber|gasket|steering hose|cowling latch/.test(name))o.material=rubber;
  else if(/cupped stainless propeller|polished propeller exhaust barrel|trim piston|bracket stainless/.test(name))o.material=steel;
 });
 for(const o of old){o.visible=false;o.userData.supersededGraphic=true;}
 if(!cowling)return;
 model.updateMatrixWorld(true);const parent=cowling.parent,parentInverse=parent.matrixWorld.clone().invert();
 const brand=graphic('brand'),hp=graphic('250',horsepower);
 function decal(name,texture,position,orientation,size){
  const geo=new DecalGeometry(cowling,new THREE.Vector3(...position),new THREE.Euler(...orientation),new THREE.Vector3(...size));geo.applyMatrix4(parentInverse);
  const material=new THREE.MeshPhysicalMaterial({name:'BFT250 | satin silver printed graphic',map:texture,color:'#ffffff',metalness:.10,roughness:.43,clearcoat:.25,clearcoatRoughness:.22,transparent:true,alphaTest:.05,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4});
  const mesh=new THREE.Mesh(geo,material);mesh.name=name;mesh.userData.sourceName=name;mesh.userData.part='engine';mesh.renderOrder=3;parent.add(mesh);return mesh;
 }
 if(compact){
  const b=new THREE.Box3().setFromObject(cowling),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());
  const y=b.min.y+s.y*.53,w=s.x*.72,h=s.y*.14;
  decal('Tohatsu | side factory graphics port',brand,[c.x,y,b.min.z],[0,Math.PI,0],[w,h,s.z*.45]);
  decal('Tohatsu | side factory graphics starboard',brand,[c.x,y,b.max.z],[0,0,0],[w,h,s.z*.45]);
  if(horsepower<=140){
   decal('Tohatsu | aft factory '+horsepower,hp,[b.min.x,b.min.y+s.y*.73,c.z],[0,-Math.PI/2,0],[s.z*.32,s.y*.14,s.x*.35]);
   decal('Tohatsu | Simpliq factory marking',graphic('technology'),[b.min.x,b.min.y+s.y*.59,c.z],[0,-Math.PI/2,0],[s.z*.26,s.y*.12,s.x*.35]);
  }else{
   decal('Tohatsu | aft factory name',brand,[b.min.x,b.min.y+s.y*.76,c.z],[0,-Math.PI/2,0],[s.z*.48,s.y*.056,s.x*.35]);
   decal('Tohatsu | aft factory '+horsepower,hp,[b.min.x,b.min.y+s.y*.60,c.z],[0,-Math.PI/2,0],[s.z*.50,s.y*.19,s.x*.35]);
  }
 }else{
 decal('Tohatsu | side factory graphics port',brand,[-4.40,1.495,-.30],[0,Math.PI,0],[.585,.158,.19]);
 decal('Tohatsu | side factory graphics starboard',brand,[-4.40,1.495,.30],[0,0,0],[.585,.158,.19]);
 decal('Tohatsu | aft factory name',brand,[-4.815,1.635,0],[0,-Math.PI/2,0],[.285,.067,.19]);
 decal('Tohatsu | aft factory '+horsepower,hp,[-4.815,1.490,0],[0,-Math.PI/2,0],[.290,.173,.23]);
 }
 model.userData.engineFinishVersion=68;model.updateMatrixWorld(true);
}
