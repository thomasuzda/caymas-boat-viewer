import * as THREE from 'three';
// Optical settings for the finite glass shells exported from Blender.
export function enhanceConsoleFinish(model){
 const source=o=>o.userData.sourceName||o.name;
 const n=256,data=new Uint8Array(n*n*4);let seed=4319;
 for(let i=0;i<data.length;i+=4){seed=(1664525*seed+1013904223)>>>0;const v=118+(seed&31);data.set([v,v,v,255],i);}
 const grain=new THREE.DataTexture(data,n,n);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(14,14);grain.generateMipmaps=true;grain.minFilter=THREE.LinearMipmapLinearFilter;grain.magFilter=THREE.LinearFilter;grain.needsUpdate=true;
 model.traverse(o=>{
  if(!o.isMesh)return;const name=source(o);
  const materials=Array.isArray(o.material)?o.material:[o.material];
  for(const m of materials){
   if(m.name==='V43 | lightly tinted laminated console glass'){
    Object.assign(m,{transmission:1,opacity:1,transparent:false,metalness:0,roughness:0,roughnessMap:null,normalMap:null,bumpMap:null,ior:1.52,thickness:.006,attenuationDistance:3,envMapIntensity:.35,side:THREE.FrontSide});
    m.color.set('#ffffff');m.attenuationColor.set('#d9eee4');o.castShadow=false;o.receiveShadow=false;
   }else if(m.name==='V43 | clear acrylic compass lens'){
    Object.assign(m,{transmission:.96,opacity:1,transparent:false,metalness:0,roughness:.035,ior:1.49,thickness:.0012,attenuationDistance:1.5,envMapIntensity:.75});
    m.color.set('#ffffff');m.attenuationColor.set('#ffffff');o.castShadow=false;
   }else if(m.name.startsWith('V45 |')){
    if(/powder coat|molded charcoal ceiling|machined satin stainless/.test(m.name)){
     if(!o.geometry.attributes.uv){const p=o.geometry.attributes.position,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i);uv[i*2+1]=p.getZ(i);}o.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));}
     m.bumpMap=grain;m.bumpScale=m.name.includes('stainless')?.000008:.000025;
    }
    if(m.name.includes('cast stainless')){m.metalness=1;m.roughness=.18;m.envMapIntensity=.65;}
    if(m.name.includes('machined satin stainless')){m.metalness=1;m.roughness=.29;m.envMapIntensity=.60;}
    if(m.name.includes('powder coat')){m.metalness=.14;m.roughness=.34;m.envMapIntensity=.38;}
    if(m.name.includes('molded charcoal ceiling')){m.metalness=0;m.roughness=.34;m.envMapIntensity=.45;}
    if(m.name.includes('clear anchor lens')){m.transmission=.65;m.thickness=.002;m.ior=1.49;o.castShadow=false;}
   }else if(m.name==='V43 | charcoal EVA brow pad'){
    if(!o.geometry.attributes.uv){const p=o.geometry.attributes.position,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i);uv[i*2+1]=p.getZ(i);}o.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));}
    m.bumpMap=grain;m.bumpScale=.00008;m.envMapIntensity=.18;m.roughness=.82;
   }
   if(m.name.startsWith('V43 |')||m.name.startsWith('V45 |'))m.needsUpdate=true;
  }
 });
}
