import {createGarminOptions,GARMIN_CHOICES} from './Garmin_Options.js?v=55.1';
import {createFleetBoat,BOAT_CHOICES} from './Boat_Fleet.js?v=70';
import {enhanceConsoleFinish} from './Console_Finish.js?v=51';
import {enhanceEngineFinish} from './Engine_Finish.js?v=80';
import {createTrollingMotor} from './Boat_Trolling_Motor.js?v=54.3';
import {createPowerPoles} from './Boat_Power_Poles.js?v=25';
import {createEngineOptions,createTrollingOptions,ENGINE_CHOICES,TROLLING_CHOICES,engineChoicesForBoat} from './Motor_Options.js?v=80';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TapIntent,fitDistance} from './Boat_Interaction.js?v=20';
const $=s=>document.querySelector(s),host=$('#viewport'),scene=new THREE.Scene();scene.background=new THREE.Color('#e5edef');
const mobileRendering=matchMedia('(pointer:coarse)').matches||/iPhone|iPad|iPod/.test(navigator.userAgent)||new URLSearchParams(location.search).get('performance')==='mobile';
const pixelRatioLimit=mobileRendering?1.75:2;
let phonePixelRatio=pixelRatioLimit,lastPhoneMotion=0;
host.dataset.renderProfile=mobileRendering?'mobile':'desktop';
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,pixelRatioLimit));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;host.appendChild(renderer.domElement);
// Reuse the shadow map while orbiting; refresh it when a Power-Pole moves.
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
// A darker studio with broad softboxes preserves highlight contrast on polished metal.
const studio=new THREE.Scene();studio.background=new THREE.Color('#5a6067');
const room=new THREE.Mesh(new THREE.BoxGeometry(30,24,30),new THREE.MeshBasicMaterial({color:0x70767c,side:THREE.BackSide}));studio.add(room);
for(const [pos,size,power] of [[[4,9,-3],[1,8],1.8],[[-12,2,1],[3,13],3.0],[[11,3,2],[4,10],2.0],[[0,5,11],[3,14],3.2]]){
 const panel=new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({color:new THREE.Color(power,power,power),side:THREE.DoubleSide}));panel.position.set(...pos);panel.lookAt(0,0,0);studio.add(panel);
}
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(studio,.02).texture;pmrem.dispose();studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});scene.add(new THREE.HemisphereLight(0xffffff,0x929393,.9));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(2,8,5);scene.add(light);
light.castShadow=true;light.shadow.mapSize.set(mobileRendering?1024:2048,mobileRendering?1024:2048);Object.assign(light.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:22});light.shadow.bias=-.00005;light.shadow.normalBias=.002;light.shadow.radius=2;
const camera=new THREE.PerspectiveCamera(38,1,.01,500);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.09;controls.rotateSpeed=.72;controls.zoomSpeed=.72;
controls.enablePan=false;controls.minDistance=.45;controls.maxDistance=250;
controls.minPolarAngle=.08;controls.maxPolarAngle=Math.PI*.84;
controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
controls.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;
const canvas=renderer.domElement;
canvas.tabIndex=0;canvas.setAttribute('aria-label','3D boat. Drag to rotate. Pinch or scroll to zoom. Click an engine, trolling motor, or Garmin display to choose an option. Click a rear Power-Pole to lower or raise it. Press F to fit the boat. Press T to deploy or stow the trolling motor. Press P or S to toggle the port or starboard Power-Pole.');
const choices={engine:ENGINE_CHOICES,garmin:GARMIN_CHOICES,trolling:TROLLING_CHOICES};
let powerPoles,trollingMotor,garminOptions,engineOptions,trollingOptions;
let model,selected=null,boatBounds,boatFitPoints,view={kind:'boat'},transition=null,dirty=true,lastFrame=0;
const current={},tap=new TapIntent(),ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
const state={engine:'bft250',garmin:'standard',trolling:'minn-kota'};
const fleet=new Map();let activeBoat=BOAT_CHOICES[0],trollingTemplate;
let focusOrbit=false,orbitReturn=null,orbitPress=null;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const source=o=>o.userData.sourceName||o.name;
const announce=text=>{$('#status').textContent=text;};
const direction=()=>camera.position.clone().sub(controls.target).normalize();
function cornersOf(b){const points=[];for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])points.push([x,y,z]);return points;}
function fittedDistance(bounds,center,dir){
  const right=new THREE.Vector3().crossVectors(camera.up,dir).normalize();
  const up=new THREE.Vector3().crossVectors(dir,right).normalize();
  return fitDistance(bounds===boatBounds?boatFitPoints:cornersOf(bounds),center.toArray(),right.toArray(),up.toArray(),dir.toArray(),THREE.MathUtils.degToRad(camera.fov),camera.aspect,1.14);
}
function activeBounds(){return view.kind==='boat'?boatBounds:view.kind==='part'?view.bounds:null;}
function fitCurrent(immediate=false){
  const bounds=activeBounds();if(!bounds||transition)return;
  const center=bounds.getCenter(new THREE.Vector3()),dir=direction();
  const need=fittedDistance(bounds,center,dir),distance=camera.position.distanceTo(controls.target);
  // Zoom out promptly to keep the edges visible; ease inward when the view has more room.
  const next=immediate||distance<need?need:THREE.MathUtils.lerp(distance,need,.14);
  if(Math.abs(next-distance)>.0005||controls.target.distanceToSquared(center)>.00001){
    controls.target.copy(center);camera.position.copy(center).addScaledVector(dir,next);camera.lookAt(center);dirty=true;
  }
}
function stopMotion(){
  transition=null;orbitReturn=null;
  host.dataset.cameraMotion='still';
  // Clear residual orbit inertia before a deliberate view change.
  const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;
}
function moveTo(target,position,animate=true){
  stopMotion();
  if(!animate||reducedMotion.matches){controls.target.copy(target);camera.position.copy(position);controls.update();dirty=true;return;}
  transition={start:performance.now(),from:camera.position.clone(),to:position,fromTarget:controls.target.clone(),target};host.dataset.cameraMotion='panning';dirty=true;
}
function freeView(){view={kind:'free'};transition=null;$('#whole').setAttribute('aria-pressed','false');}
function beginBoatOrbit(){
  if(!model||!focusOrbit)return;
  focusOrbit=false;transition=null;view={kind:'free'};
  orbitReturn={start:performance.now(),fromTarget:controls.target.clone(),fromDistance:camera.position.distanceTo(controls.target)};
  for(const id of ['engine','garmin','trolling'])$('#'+id).setAttribute('aria-pressed','false');
  $('#whole').setAttribute('aria-pressed','true');
}
function fitBoat(animate=true,sideShot=false){
  if(!model)return;focusOrbit=false;closeOptions(false);for(const id of ['engine','garmin','trolling'])$('#'+id).setAttribute('aria-pressed','false');view={kind:'boat'};$('#whole').setAttribute('aria-pressed','true');
  const center=boatBounds.getCenter(new THREE.Vector3());
  const dir=(sideShot?new THREE.Vector3(.80,.60,1.35):(camera.aspect<.82?new THREE.Vector3(1,1.4,.05):new THREE.Vector3(1,.72,1.1))).normalize();
  moveTo(center,center.clone().addScaledVector(dir,fittedDistance(boatBounds,center,dir)),animate);
  announce(sideShot?'Whole boat fitted in an elevated bow-quarter view.':'Whole boat fitted to your screen.');
}
function lookCloser(){
  if(!selected)return;
  const b=new THREE.Box3().setFromObject(current[selected]);
  if(selected==='garmin')b.expandByScalar(.055);
  const center=b.getCenter(new THREE.Vector3());
  const dir=(selected==='engine'?new THREE.Vector3(-1,.40,1):new THREE.Vector3(-1,.44,0)).normalize();
  view={kind:'part',bounds:b};$('#whole').setAttribute('aria-pressed','false');
  moveTo(center,center.clone().addScaledVector(dir,fittedDistance(b,center,dir)));
}
// Optional review links open a surface detail without selecting a product or opening its menu.
function showSurfaceDetail(name){
  if(name==='factory-color'){
    const center=boatBounds.getCenter(new THREE.Vector3()),dir=new THREE.Vector3(1,.35,1.1).normalize();
    focusOrbit=false;view={kind:'boat'};moveTo(center,center.clone().addScaledVector(dir,fittedDistance(boatBounds,center,dir)),false);announce('Caymas Sky Blue hull with a Pure White bottom.');return;
  }
  const presets={
    'console-glass':{pattern:/^(Windshield \| |Console \| compass|Console F \| brow|Console \| brow)/,direction:[-1,.10,1.15],margin:.08},
    'roof':{pattern:/^T-top \| (molded hardtop|molded perimeter drip bead|finished recessed ceiling|fine roof liner join)/,direction:[1,.85,1.1],margin:.05},
    'ceiling':{pattern:/^T-top \| (finished recessed ceiling|underside electronics box|electronics pod|down light|speaker|spreader)/,direction:[-1,-.38,.65],margin:.05},
    'windshield-air':{pattern:/^Windshield \| (upper airflow opening|airflow surround)/,direction:[-1,-.14,.08],margin:.075},
    'cleats':{pattern:/^CLEAT \| refined pull-up 2$/,direction:[-.65,.85,1.2],margin:.07},
    'compass':{pattern:/^(Console \| compass|Console F \| brow|Console \| brow)/,direction:[-1,.50,.2],margin:.045},
    'engine':{pattern:/^TOHATSU 250 \| move/,direction:[-1,.30,1],margin:.14},
    'rod-holders':{pattern:/^ROD HOLDER \| console [123]$/,direction:[.4,.5,1],margin:.20},
    'gunwale':{pattern:/^ROD HOLDER \| gunwale [12]$/,direction:[-.7,1.1,1],margin:.16},
    'seat-rack':{pattern:/^ROD HOLDER \| seat back /,direction:[-1,.65,1],margin:.18},
    't-top':{pattern:/^ROD HOLDER \| T-top /,direction:[-1,.85,1],margin:.14},
    'trolling-motor':{pattern:/^TROLLING MOTOR \| /,direction:[1,.58,-1.3],margin:.48},
    'power-poles':{pattern:/^POWER-POLE \| /,direction:[-1,.38,1],margin:1.15},
    'helm':{pattern:/^(GARMIN \| flush|STEERING \| editable|THROTTLE \| editable|CUPHOLDERS \| raised|SWITCH BANK \| angled|ENGINE GAUGE \| flush|HELM ACCESSORIES \| reference)/,direction:[-1,.50,0],margin:.065},
    'displays':{pattern:/^(GARMIN \| flush|ENGINE GAUGE \| flush)/,direction:[-1,.44,0],margin:.05},
    'helm-controls':{pattern:/^(STEERING \| editable|HELM ACCESSORIES \| reference|ENGINE GAUGE \| flush)/,direction:[-1,.70,-.18],margin:.045}
  };
  const preset=presets[name];if(!preset)return;
  const bounds=new THREE.Box3();model.traverse(o=>{if(preset.pattern.test(source(o)))bounds.union(visibleBounds(o));});
  if(bounds.isEmpty())return;
  if(name==='windshield-air'){bounds.expandByPoint(new THREE.Vector3(.30,2.891,-.34));bounds.expandByPoint(new THREE.Vector3(.30,3.006,.34));}
  if(name==='trolling-motor'){bounds.expandByPoint(new THREE.Vector3(3.60,3.55,-1.20));bounds.expandByPoint(new THREE.Vector3(3.0,.12,-1.20));}
  bounds.expandByScalar(preset.margin);
  const center=bounds.getCenter(new THREE.Vector3()),dir=new THREE.Vector3(...preset.direction).normalize();
  focusOrbit=true;view={kind:'part',bounds};$('#whole').setAttribute('aria-pressed','false');
  moveTo(center,center.clone().addScaledVector(dir,fittedDistance(bounds,center,dir)),false);announce('Detail view. Use Fit boat to see the whole boat.');
}
let previousWidth=0,previousHeight=0;
function resize(){
  const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
  if(w===previousWidth&&h===previousHeight)return;
  const oldAspect=camera.aspect;
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobileRendering?phonePixelRatio:w<600?1.5:2));renderer.setSize(w,h,false);
  camera.aspect=w/h;camera.updateProjectionMatrix();
  if(model){
    // Preserve manual close-ups, adapting their scale when a tray or window changes size.
    if(view.kind==='free'&&previousWidth&&previousHeight){
      const ratio=Math.min(1,oldAspect)/Math.min(1,camera.aspect);
      const dir=direction(),distance=camera.position.distanceTo(controls.target);
      camera.position.copy(controls.target).addScaledVector(dir,distance*ratio);
    }else{
      if(transition){const b=activeBounds();if(b){const dir=transition.to.clone().sub(transition.target).normalize();transition.to.copy(transition.target).addScaledVector(dir,fittedDistance(b,transition.target,dir));}}
      else fitCurrent(true);
    }
  }
  previousWidth=w;previousHeight=h;dirty=true;
}
new ResizeObserver(resize).observe(host);window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);resize();
function updateOptionArrows(){
  const list=$('#cards'),max=Math.max(0,list.scrollWidth-list.clientWidth);
  $('#options-left').disabled=list.scrollLeft<=2;
  $('#options-right').disabled=list.scrollLeft>=max-2;
}
function scrollOptions(direction){
  const list=$('#cards'),card=list.firstElementChild;if(!card||!['engine','garmin','trolling'].includes(selected))return;
  const step=card.getBoundingClientRect().width+(parseFloat(getComputedStyle(list).columnGap)||10);
  list.scrollTo({left:THREE.MathUtils.clamp(list.scrollLeft+direction*step,0,list.scrollWidth-list.clientWidth),behavior:reducedMotion.matches?'instant':'smooth'});
}
$('#options-left').onclick=()=>scrollOptions(-1);$('#options-right').onclick=()=>scrollOptions(1);
$('#cards').addEventListener('scroll',updateOptionArrows,{passive:true});new ResizeObserver(updateOptionArrows).observe($('#cards'));
function renderCards(){
  const list=$('#cards');list.replaceChildren();
  const arrows=['engine','garmin','trolling'].includes(selected)&&(selected!=='engine'||activeBoat.hp!==0),equipment=selected==='garmin'?'Garmin':selected==='engine'?'engine':'trolling motor';
  $('#option-picker').dataset.arrows=String(arrows);
  $('#options-left').hidden=$('#options-right').hidden=!arrows;
  $('#options-left').setAttribute('aria-label',`Scroll ${equipment} options left`);$('#options-right').setAttribute('aria-label',`Scroll ${equipment} options right`);
  $('#options-left').title=`Previous ${equipment} options`;$('#options-right').title=`Next ${equipment} options`;
  const available=selected==='engine'?engineChoicesForBoat(activeBoat).sort((a,b)=>Number(b.id.replace(/\D/g,''))-Number(a.id.replace(/\D/g,''))):selected==='garmin'?[...choices[selected]].reverse().filter(item=>garminOptions?.fits(item.id)):choices[selected];
  if(!available.length){const message=document.createElement('p');message.className='empty-options';message.textContent='Twin inboard pod drives. The engines are enclosed inside the yacht; this first yacht layout has a fixed propulsion setup.';list.appendChild(message);}
  for(const item of available){
    const ready=selected==='garmin'?garminOptions?.readyState:selected==='engine'?engineOptions?.readyState:trollingOptions?.readyState;
    const thumb=selected==='garmin'?`Garmin_Refinement/Thumbnail_${item.asset}.png?v=55`:item.thumb;
    const fits=selected!=='garmin'||garminOptions?.fits(item.id);
    const button=document.createElement('button');button.className='card';button.dataset.model=item.id;button.setAttribute('aria-pressed',String(state[selected]===item.id));button.disabled=!ready||!fits;
    const verb=selected==='garmin'?'Installed':'Selected';
    button.innerHTML=`<div class="product-photo"><img src="${thumb}" alt="" draggable="false"></div><div><strong>${item.label}</strong><small>${item.size}</small><small class="chip">${!fits?'Too large for this helm':state[selected]===item.id?'✓ '+verb:'Choose option'}</small></div>`;
    if(!fits)button.title='Choose the offshore boat or yacht for larger dual displays.';
    button.onclick=()=>{
      const priorPosition=camera.position.clone(),priorTarget=controls.target.clone();stopMotion();view={kind:'free'};
      const controller=selected==='garmin'?garminOptions:selected==='engine'?engineOptions:trollingOptions;
      if(!controller?.select(item.id)){announce('Options are still loading.');return;}
      if(selected==='engine'){engineRunning=true;spinEnginePropeller();}
      camera.position.copy(priorPosition);controls.target.copy(priorTarget);controls.update();
      for(const card of list.children){const active=card.dataset.model===item.id;card.setAttribute('aria-pressed',String(active));if(!card.disabled)card.querySelector('.chip').textContent=active?'✓ '+verb:'Choose option';}
      const result=selected==='garmin'?item.label+` installed on ${garminOptions.installedCount===2?'both displays':'the helm'}.`:item.label+(selected==='engine'&&activeBoat.engineCount===2?' selected for both outboards.':' selected.');
      $('#choice-note').textContent=result;announce(result);
    };
    list.appendChild(button);
  }
  list.scrollLeft=0;
  requestAnimationFrame(()=>{list.scrollLeft=0;updateOptionArrows();});
}
let propellerMotion=null,engineRunning=false;
function stopEnginePropeller(){
 engineRunning=false;
 if(propellerMotion)for(const item of propellerMotion.items)item.group.quaternion.copy(item.rest);
 propellerMotion=null;host.dataset.enginePropeller='stopped';renderer.shadowMap.needsUpdate=true;dirty=true;
}
function spinEnginePropeller(){
 if(reducedMotion.matches||!current.engine)return;
 if(propellerMotion)for(const item of propellerMotion.items)item.group.quaternion.copy(item.rest);
 const parents=new Map();
 current.engine.traverse(o=>{
  if(!o.isMesh||!/propeller blade/i.test(source(o)))return;
  for(let ancestor=o;ancestor;ancestor=ancestor.parent)if(!ancestor.visible)return;
  const parent=o.parent;if(!parents.has(parent))parents.set(parent,[]);parents.get(parent).push(o);
 });
 const items=[];
 for(const [parent,blades] of parents){
  let group=parent.name==='Propeller | click motion'?parent:parent.userData.propellerSpinGroup;
  if(!group){
   const barrel=parent.children.find(o=>o.isMesh&&/propeller exhaust barrel/i.test(source(o)));
   if(!barrel)continue;
   parent.updateWorldMatrix(true,true);
   const center=new THREE.Box3().setFromObject(barrel).getCenter(new THREE.Vector3());
   group=new THREE.Group();group.name='Propeller | click motion';group.position.copy(parent.worldToLocal(center));parent.add(group);group.updateWorldMatrix(true,false);
   for(const blade of blades){blade.castShadow=false;group.attach(blade);}
   parent.userData.propellerSpinGroup=group;
  }
  if(items.some(item=>item.group===group))continue;
  items.push({group,rest:group.quaternion.clone()});
 }
 // Subsequent clicks find the blade group itself as their parent.
 for(const [parent] of parents)if(parent.name==='Propeller | click motion'&&!items.some(item=>item.group===parent))items.push({group:parent,rest:parent.quaternion.clone()});
 if(items.length){propellerMotion={items,start:performance.now()};host.dataset.enginePropeller='spinning';dirty=true;}
}
function openPart(part,fromButton=false){
  if(!model)return;
  if(part==='trolling'&&!trollingMotor)return;
  if(part==='engine'){engineRunning=true;spinEnginePropeller();}else stopEnginePropeller();
  if(part==='trolling'&&!fromButton&&selected==='trolling'&&!$('#tray').hidden){toggleTrollingMotor(true);return;}
  if(part.startsWith('pole-')){togglePole(part.slice(5));return;}
  const priorPosition=camera.position.clone(),priorTarget=controls.target.clone();transition=null;view={kind:'free'};
  selected=part;renderCards();$('#title').textContent=part==='engine'?(activeBoat.hp===0?'Yacht propulsion':'Engine options'):part==='trolling'?'Trolling motor options':'Garmin options';
  $('#tray .note').textContent=part==='engine'?(activeBoat.hp===0?'Enclosed twin inboard propulsion':activeBoat.engineCount===2?'Switch both covered Tohatsu outboards':activeBoat.tiller?'Covered Tohatsu with tiller steering':'Switch the covered Tohatsu outboard'):part==='trolling'?'Switch the bow trolling motor':garminOptions?.installedCount===1?'Switch the helm display':'Switch both console displays';
  $('#choice-note').textContent=part==='garmin'?(garminOptions?.readyState?'Choose a Garmin. Larger screens need a larger helm.':'Loading Garmin display options…'):part==='engine'?(activeBoat.hp===0?'Click Look closer to view the pod drives.':'Choose a covered Tohatsu horsepower option.'):'Choose a motor. Click the motor again to lower or raise it.';
  for(const id of ['engine','garmin','trolling'])$('#'+id).setAttribute('aria-pressed',String(part===id));
  $('#closer').setAttribute('aria-label',part==='engine'?'Zoom to engine':part==='trolling'?'Zoom to trolling motor':'Zoom to Garmin');
  $('#tray').hidden=false;resize();
  camera.position.copy(priorPosition);controls.target.copy(priorTarget);controls.update();
  announce($('#title').textContent+'. Your current view is preserved.');dirty=true;
}
function focusPart(part){
  if(!model)return;
  if(['engine','garmin','trolling'].includes(part))openPart(part,true);else closeOptions(false);
  if(part==='trolling'){
    if(!trollingMotor)return;
    trollingMotor.setDeployed(true,performance.now(),reducedMotion.matches);
    updateBoatBounds();renderer.shadowMap.needsUpdate=true;dirty=true;
  }
  const bounds=new THREE.Box3();model.updateMatrixWorld(true);
  model.traverseVisible(o=>{if(o.isMesh&&o.userData.part===part)bounds.union(visibleBounds(o));});
  if(part==='trolling')bounds.union(trollingMotor.focusBounds());
  if(bounds.isEmpty())return;
  bounds.expandByScalar(part==='garmin'?.055:part==='engine'?.10:.16);
  const center=bounds.getCenter(new THREE.Vector3());
  const dir=new THREE.Vector3(...({engine:[-1,.26,1],garmin:[-1,.44,0],trolling:[1,.70,-1.3]}[part])).normalize();
  // Keep the chosen close-up until a deliberate orbit gesture, then ease back
  // to a boat-centered pivot so the bow cannot disappear behind the engine.
  focusOrbit=true;view={kind:'free'};
  for(const id of ['engine','garmin','trolling','whole'])$('#'+id).setAttribute('aria-pressed',String(id===part));
  moveTo(center,center.clone().addScaledVector(dir,fittedDistance(bounds,center,dir)));
  announce((part==='trolling'?'Trolling motor':part==='garmin'?'Garmin':'Engine')+' view. Drag to orbit freely.');
}
function closeOptions(returnFocus=true){
  const was=selected;stopEnginePropeller();selected=null;$('#tray').hidden=true;
  for(const id of ['engine','garmin','trolling'])$('#'+id).setAttribute('aria-pressed','false');
  if(model)resize();if(returnFocus&&was){$('#'+was).focus({preventScroll:true});announce('Options closed.');}dirty=true;
}
function zoom(factor){
  if(!model)return;stopMotion();freeView();const dir=direction();
  const d=THREE.MathUtils.clamp(camera.position.distanceTo(controls.target)*factor,controls.minDistance,controls.maxDistance);
  camera.position.copy(controls.target).addScaledVector(dir,d);controls.update();dirty=true;
}
function visibleBounds(root){
  const bounds=new THREE.Box3();root.updateWorldMatrix(true,true);
  root.traverseVisible(o=>{if(o.isMesh&&o.geometry.attributes.position){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
  return bounds;
}
function updateBoatBounds(){
  model.updateMatrixWorld(true);boatBounds=new THREE.Box3();boatFitPoints=[];const point=new THREE.Vector3();
  model.traverseVisible(o=>{if(o.isMesh&&o.geometry.attributes.position){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();for(const corner of cornersOf(o.geometry.boundingBox)){point.fromArray(corner).applyMatrix4(o.matrixWorld);boatBounds.expandByPoint(point);boatFitPoints.push(point.toArray());}}});
}
function toggleTrollingMotor(keepOptions=false){
  if(!trollingMotor)return;
  const priorPosition=camera.position.clone(),priorTarget=controls.target.clone();
  transition=null;view={kind:'free'};if(!keepOptions)closeOptions(false);stopMotion();
  camera.position.copy(priorPosition);controls.target.copy(priorTarget);controls.update();
  trollingMotor.toggle(performance.now(),reducedMotion.matches);
  updateBoatBounds();renderer.shadowMap.needsUpdate=true;dirty=true;
}
function togglePole(side){
  if(!powerPoles)return;closeOptions(false);stopMotion();
  // Retain manual close-ups; full-boat framing expands smoothly with the anchors.
  powerPoles.toggle(side,performance.now(),reducedMotion.matches);
  updateBoatBounds();renderer.shadowMap.needsUpdate=true;dirty=true;
}
function pick(e){
  if(!model)return null;
  const r=canvas.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return null;
  pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
  const first=ray.intersectObject(model,true).find(h=>{const materials=Array.isArray(h.object.material)?h.object.material:[h.object.material];if(materials.every(m=>m?.transmission>.7))return false;for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});
  return first?.object.userData.part||null;
}
// A tap must begin AND end on the same visible part. Any drag, cancel, long hold,
// second finger or zoom invalidates the entire gesture, even if it returns to its start.
canvas.addEventListener('pointerdown',e=>{
  transition=null;orbitPress={x:e.clientX,y:e.clientY};tap.down(e,pick(e));canvas.style.cursor='grabbing';
  if(tap.pointers.size>1)freeView();
},true);
canvas.addEventListener('pointermove',e=>{tap.move(e);if(orbitPress&&tap.pointers.size===1&&Math.hypot(e.clientX-orbitPress.x,e.clientY-orbitPress.y)>8)beginBoatOrbit();},true);
canvas.addEventListener('pointerup',e=>{
  orbitPress=null;const part=tap.up(e,pick(e));canvas.style.cursor='grab';
  if(part)openPart(part);
},true);
canvas.addEventListener('pointercancel',e=>{orbitPress=null;tap.cancel(e.pointerId);canvas.style.cursor='grab';},true);
canvas.addEventListener('lostpointercapture',e=>{if(tap.pointers.has(e.pointerId))tap.cancel(e.pointerId);},true);
canvas.addEventListener('wheel',()=>{tap.block();freeView();},{capture:true,passive:true});
window.addEventListener('blur',()=>{tap.reset();canvas.style.cursor='grab';});
controls.addEventListener('start',()=>{transition=null;});controls.addEventListener('change',()=>{dirty=true;});
$('#engine').onclick=()=>focusPart('engine');$('#garmin').onclick=()=>focusPart('garmin');$('#trolling').onclick=()=>focusPart('trolling');$('#whole').onclick=()=>fitBoat(true,true);$('#close').onclick=()=>closeOptions();$('#closer').onclick=lookCloser;
$('#zoom-in').onclick=()=>zoom(.8);$('#zoom-out').onclick=()=>zoom(1.25);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&selected){closeOptions();e.preventDefault();}});
canvas.addEventListener('keydown',e=>{
  if(e.key.toLowerCase()==='t'){if(e.repeat)return;toggleTrollingMotor();e.preventDefault();}
  else if(e.key.toLowerCase()==='p'||e.key.toLowerCase()==='s'){if(e.repeat)return;togglePole(e.key.toLowerCase()==='p'?'port':'starboard');e.preventDefault();}
  else if(e.key.toLowerCase()==='f'){fitBoat(true,true);e.preventDefault();}
  else if(e.key==='+'||e.key==='='){zoom(.8);e.preventDefault();}
  else if(e.key==='-'){zoom(1.25);e.preventDefault();}
  else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    stopMotion();beginBoatOrbit();const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(e.key==='ArrowLeft')spherical.theta-=.12;if(e.key==='ArrowRight')spherical.theta+=.12;
    if(e.key==='ArrowUp')spherical.phi-=.12;if(e.key==='ArrowDown')spherical.phi+=.12;
    spherical.phi=THREE.MathUtils.clamp(spherical.phi,controls.minPolarAngle,controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();dirty=true;e.preventDefault();
  }
});
new GLTFLoader().load('Caymas_26HB_Tohatsu_Garmin.glb?v=64',g=>{
  model=g.scene;model.traverse(o=>{
    const index=g.parser.associations.get(o)?.nodes;if(index!==undefined)o.userData.sourceName=g.parser.json.nodes[index].name;
    if(/^Stern \| (port compartment|starboard livewell) blue basin$/.test(source(o)))o.visible=false;
    if(o.isMesh){
      const materials=Array.isArray(o.material)?o.material:[o.material];
      o.castShadow=materials.every(m=>!m.transparent);o.receiveShadow=true;
      for(const m of materials){
        if(m.name.includes('mirror polished marine stainless')){m.envMapIntensity=.38;m.metalness=1;m.roughness=.17;m.anisotropy=0;}
        if(m.name.startsWith('V23')&&(m.name.includes('stainless')))m.envMapIntensity=.62;
        if(m.name.startsWith('V23'))for(const texture of [m.normalMap,m.roughnessMap])if(texture){texture.anisotropy=Math.min(mobileRendering?4:16,renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;}
        // Backlit LCD artwork keeps its contrast when the viewing angle changes.
        if(m.name.startsWith('V22 LCD')){
          m.toneMapped=false;m.envMapIntensity=.06;
          for(const texture of [m.map,m.emissiveMap])if(texture){texture.anisotropy=Math.min(mobileRendering?4:16,renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;}
        }
      }
    }
  });
  enhanceEngineFinish(model);enhanceConsoleFinish(model);scene.add(model);model.updateMatrixWorld(true);
  for(const [part,pattern] of [['engine',/^TOHATSU 250 \| move/],['garmin',/^GARMIN \| flush/]]){
    model.traverse(o=>{if(pattern.test(source(o)))current[part]=o;});
    if(!current[part])throw new Error('Missing '+part+' assembly');current[part].traverse(o=>{o.userData.part=part;});
  }
  garminOptions=createGarminOptions({root:current.garmin,source,anisotropy:Math.min(mobileRendering?4:16,renderer.capabilities.getMaxAnisotropy()),onChange:id=>{if(model!==g.scene)return;state.garmin=id;host.dataset.garmin=id;host.dataset.garminDisplayCount='2';renderer.shadowMap.needsUpdate=true;dirty=true;}});
  garminOptions.ready.then(()=>{if(selected==='garmin'){renderCards();$('#choice-note').textContent='Choose a Garmin to switch both displays.';}updateBoatBounds();dirty=true;}).catch(error=>{host.dataset.garminError='true';console.error('Garmin display options could not load.',error);if(selected==='garmin')$('#choice-note').textContent='The display options could not load. Refresh to try again.';});
  engineOptions=createEngineOptions({root:current.engine,allowed:engineChoicesForBoat(BOAT_CHOICES[0]).map(c=>c.id),onChange:id=>{if(model!==g.scene)return;state.engine=id;host.dataset.engine=id;renderer.shadowMap.needsUpdate=true;dirty=true;}});
  engineOptions.ready.then(()=>{const previewEngine=new URLSearchParams(location.search).get('review-engine');if(['mfs25','mfs60','mfs115','mfs140','bft150','bft200','bft225','bft250'].includes(previewEngine)){engineOptions.select(previewEngine);openPart('engine',true);}if(selected==='engine'){engineRunning=true;spinEnginePropeller();renderCards();$('#choice-note').textContent='Choose a covered Tohatsu horsepower option.';}updateBoatBounds();dirty=true;}).catch(error=>{console.error('Tohatsu options could not load.',error);host.dataset.engineError='true';if(selected==='engine')$('#choice-note').textContent='The engine options could not load. Refresh to try again.';});
  host.dataset.engine='bft250';
  powerPoles=createPowerPoles(model,source,(side,target,moving)=>{
    const label=side==='port'?'Port':'Starboard';
    announce(`${label} Power-Pole ${moving?(target?'lowering':'raising'):(target?'down':'up')}. Click it again to ${target?'raise':'lower'} it.`);
    host.dataset[side+'Pole']=moving?(target?'lowering':'raising'):(target?'down':'up');
  });
  model.traverse(o=>{if(source(o)==='TROLLING MOTOR | editable stowed assembly')trollingTemplate=o.clone(true);});
  trollingMotor=createTrollingMotor(model,source,(target,moving)=>{
    if(model!==g.scene)return;
    host.dataset.trollingMotor=moving?(target?'deploying':'stowing'):(target?'deployed':'stowed');
    if(trollingMotor?.root.userData.deployment?.forward)host.dataset.trollingForward=trollingMotor.root.userData.deployment.forward.map(v=>v.toFixed(6)).join(',');
    announce(`Trolling motor ${host.dataset.trollingMotor}.`);if(selected==='trolling')$('#choice-note').textContent=`Motor ${host.dataset.trollingMotor}. Click it again to ${target?'raise':'lower'} it.`;
  });
  current.trolling=trollingMotor.root;
  trollingOptions=createTrollingOptions({rig:trollingMotor,onChange:id=>{if(model!==g.scene)return;state.trolling=id;host.dataset.trolling=id;renderer.shadowMap.needsUpdate=true;dirty=true;}});
  trollingOptions.ready.then(()=>{if(selected==='trolling'){renderCards();$('#choice-note').textContent='Choose a trolling motor. Click the motor again to lower it.';}host.dataset.trollingReady='true';updateBoatBounds();dirty=true;}).catch(error=>{console.error('Trolling motor options could not load.',error);host.dataset.trollingError='true';if(selected==='trolling')$('#choice-note').textContent='Motor options could not load. Refresh to try again.';});
  host.dataset.trolling='minn-kota';
  host.dataset.trollingMotor='stowed';
  host.dataset.portPole='up';host.dataset.starboardPole='up';
  host.dataset.boat='caymas';host.dataset.engineCount='1';
  const caymas={root:model,current:{...current},choice:activeBoat,garminOptions,engineOptions,trollingOptions,trollingMotor,powerPoles};
  caymas.ready=Promise.all([garminOptions.ready,engineOptions.ready,trollingOptions.ready]);fleet.set('caymas',caymas);
  // Boat browsing remains available even if an optional equipment asset fails.
  $('#boat-select').disabled=false;
  const requested=new URLSearchParams(location.search).get('boat');
  if(requested&&requested!=='caymas'&&BOAT_CHOICES.some(c=>c.id===requested))switchBoat(requested);
  caymas.ready.catch(()=>{announce('Some equipment could not load. You can still choose another boat.');});
  updateBoatBounds();
  $('#loading').hidden=true;
  for(const button of document.querySelectorAll('.tools button,.zoom-tools button'))button.disabled=false;
  renderer.shadowMap.needsUpdate=true;fitBoat(false);const detail=new URLSearchParams(location.search).get('detail');showSurfaceDetail(detail);dirty=true;
},undefined,()=>{$('#loading .spinner').hidden=true;$('#loading-text').textContent='The boat could not load. Refresh to try again.';announce('Boat could not load.');});
function fleetEquipment(session,part,id){
 if(model!==session.root)return;state[part]=id;host.dataset[part]=id;
 if(part==='garmin')host.dataset.garminDisplayCount=String(session.garminOptions.installedCount);
 renderer.shadowMap.needsUpdate=true;dirty=true;
}
function fleetTrolling(session,target,moving){
 if(model!==session.root)return;host.dataset.trollingMotor=moving?(target?'deploying':'stowing'):(target?'deployed':'stowed');
 const forward=session.trollingMotor?.root.userData.deployment?.forward;if(forward)host.dataset.trollingForward=forward.map(v=>v.toFixed(6)).join(',');
 announce(`Trolling motor ${host.dataset.trollingMotor}.`);
 if(selected==='trolling')$('#choice-note').textContent=`Motor ${host.dataset.trollingMotor}. Click it again to ${target?'raise':'lower'} it.`;
}
let boatRequest=0;
const boatLoads=new Map();
let phoneLoadQueue=Promise.resolve();
function releaseUnusedPhoneBoats(){
 if(!mobileRendering)return;
 const removed=[];
 for(const [id,session] of fleet)if(id!=='caymas'&&session.root!==model){scene.remove(session.root);fleet.delete(id);removed.push(session.root);}
 if(!removed.length)return;
 // Preserve resources shared with the active boat or original trolling template.
 const retained=new Set();
 function resources(root,visit){root?.traverse(o=>{if(o.geometry)visit(o.geometry);for(const material of (Array.isArray(o.material)?o.material:o.material?[o.material]:[])){visit(material);for(const value of Object.values(material))if(value?.isTexture)visit(value);}});}
 for(const session of fleet.values())resources(session.root,r=>retained.add(r));
 resources(trollingTemplate,r=>retained.add(r));
 const disposed=new Set();for(const root of removed)resources(root,r=>{if(!retained.has(r)&&!disposed.has(r)){r.dispose();disposed.add(r);}});
 renderer.renderLists.dispose();host.dataset.cachedBoats=String(fleet.size);
}

async function switchBoat(id){
 const choice=BOAT_CHOICES.find(c=>c.id===id);if(!choice)return;
 const request=++boatRequest;
 if(id===activeBoat.id){$('#loading').hidden=true;return;}
 $('#boat-select').disabled=false;$('#loading').hidden=false;$('#loading-text').textContent='Loading '+choice.label+'…';
 try{
  let session=fleet.get(id);
  if(!session){
   if(!boatLoads.has(id)){
    const load=()=>createFleetBoat({choice,trollingTemplate,source,anisotropy:Math.min(mobileRendering?4:16,renderer.capabilities.getMaxAnisotropy()),onEquipment:fleetEquipment,onTrolling:fleetTrolling});
    // One phone load at a time, with the most recent queued request taking priority.
    const task=mobileRendering?phoneLoadQueue.then(()=>$('#boat-select').value===id?load():null):load();
    if(mobileRendering)phoneLoadQueue=task.catch(()=>{});
    boatLoads.set(id,task.then(loaded=>{if(!loaded)return null;fleet.set(id,loaded);scene.add(loaded.root);loaded.root.visible=false;return loaded;}).finally(()=>boatLoads.delete(id)));
   }
   session=await boatLoads.get(id);
  }
  if(request!==boatRequest||!session){releaseUnusedPhoneBoats();return;}
  await session.ready;if(request!==boatRequest)return;closeOptions(false);stopMotion();model.visible=false;model=session.root;model.visible=true;activeBoat=choice;
  Object.assign(current,session.current);for(const part of ['engine','garmin','trolling'])if(!session.current[part])delete current[part];
  ({garminOptions,engineOptions,trollingOptions,trollingMotor,powerPoles}=session);
  state.engine=engineOptions?.selected||'inboard';state.garmin=garminOptions.selected;state.trolling=trollingOptions?.selected||'none';
  Object.assign(host.dataset,{boat:id,engine:state.engine,engineCount:String(activeBoat.hp===0?0:activeBoat.engineCount||1),garmin:state.garmin,garminDisplayCount:String(garminOptions.installedCount),trolling:state.trolling,trollingReady:String(!!trollingOptions?.readyState),trollingMotor:trollingMotor?(trollingMotor.value>.99?'deployed':'stowed'):'none',portPole:powerPoles?'up':'none',starboardPole:powerPoles?'up':'none',structure:['pontoon','tritoon'].includes(id)?session.layout:'hull'});
  $('#layout-control').hidden=true;$('#boat-structure').value=session.layout||'pontoon';
  $('#trolling').disabled=!trollingMotor;$('#boat-select').value=id;$('#boat-summary').textContent=choice.description;$('.boat-name').textContent=choice.label+(id==='caymas'?' concept':'');
  for(const pole of powerPoles?.poles||[])host.dataset[pole.side+'Pole']=pole.motion?(pole.target?'lowering':'raising'):(pole.value>.99?'down':'up');
  const shadowExtent=id==='yacht'?12:id==='offshore'?8:6;
  Object.assign(light.shadow.camera,{left:-shadowExtent,right:shadowExtent,top:shadowExtent,bottom:-shadowExtent,far:40});light.shadow.camera.updateProjectionMatrix();
  releaseUnusedPhoneBoats();updateBoatBounds();fitBoat();renderer.shadowMap.needsUpdate=true;dirty=true;announce(choice.label+' selected. '+choice.description);
 }catch(error){if(request!==boatRequest)return;console.error('Boat selection failed',error);$('#boat-select').value=activeBoat.id;announce('That boat could not load. Your current boat is still available.');}
 finally{if(request===boatRequest){$('#boat-select').disabled=false;$('#loading').hidden=true;}}
}
$('#boat-select').onchange=e=>switchBoat(e.target.value);
$('#boat-structure').onchange=e=>{const session=fleet.get(activeBoat.id);if(!session?.setLayout?.(e.target.value))return;host.dataset.structure=session.layout;updateBoatBounds();renderer.shadowMap.needsUpdate=true;dirty=true;announce(session.layout==='tritoon'?'Three-tube tritoon selected.':'Two-tube pontoon selected.');};
let lastMobileTick=-Infinity,lastMotionRefresh=-Infinity,wasEquipmentMoving=false;
renderer.setAnimationLoop(now=>{
  // Avoid redundant 120 Hz frames and pause GPU work in background tabs.
  if(document.hidden)return;
  if(mobileRendering&&now-lastMobileTick<1000/60-1)return;
  lastMobileTick=now;
  const dt=Math.min(.05,(now-lastFrame)/1000||1/60);lastFrame=now;
  if(transition){
    const t=Math.min(1,(now-transition.start)/850),s=t*t*(3-2*t);
    camera.position.lerpVectors(transition.from,transition.to,s);controls.target.lerpVectors(transition.fromTarget,transition.target,s);dirty=true;
    if(t===1){transition=null;host.dataset.cameraMotion='still';}
  }
  if(orbitReturn){
    const t=reducedMotion.matches?1:Math.min(1,(now-orbitReturn.start)/650),ease=t*t*(3-2*t);
    const center=boatBounds.getCenter(new THREE.Vector3()),dir=direction();
    const distance=THREE.MathUtils.lerp(orbitReturn.fromDistance,fittedDistance(boatBounds,center,dir),ease);
    controls.target.lerpVectors(orbitReturn.fromTarget,center,ease);
    camera.position.copy(controls.target).addScaledVector(dir,distance);dirty=true;
    if(t===1){orbitReturn=null;view={kind:'boat'};}
  }
  if(propellerMotion&&engineRunning&&!reducedMotion.matches){
    propellerMotion.angle=((propellerMotion.angle||0)+dt*Math.PI*5)%(Math.PI*2);
    const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),propellerMotion.angle);
    for(const item of propellerMotion.items)item.group.quaternion.copy(rotation).multiply(item.rest);
    dirty=true;
  }else if(propellerMotion)stopEnginePropeller();
  const polesMoved=powerPoles?.update(now),trollingMoved=trollingMotor?.update(now);
  const equipmentMoving=!!(polesMoved||trollingMoved);
  if(equipmentMoving||wasEquipmentMoving){
    // Bounds and shadow passes traverse the whole boat; refresh at 5 Hz on phones,
    // then immediately at the final pose. Equipment geometry still animates each frame.
    if(!mobileRendering||!equipmentMoving||now-lastMotionRefresh>=200){updateBoatBounds();renderer.shadowMap.needsUpdate=true;lastMotionRefresh=now;}
    dirty=true;
  }
  wasEquipmentMoving=equipmentMoving;
  const moved=controls.update(dt);
  if(mobileRendering){
    if(moved||transition||orbitReturn||equipmentMoving||tap.pointers.size)lastPhoneMotion=now;
    const ratio=Math.min(devicePixelRatio,now-lastPhoneMotion<300?1.25:pixelRatioLimit);
    if(ratio!==phonePixelRatio){phonePixelRatio=ratio;renderer.setPixelRatio(ratio);dirty=true;host.dataset.imageQuality=ratio>1.25?'sharp':'moving';}
  }
  if(model&&!transition&&(moved||dirty))fitCurrent();
  if(dirty||moved){renderer.render(scene,camera);dirty=false;}
});
