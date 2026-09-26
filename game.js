import * as THREE from "three";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 25, 90);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 3, 8);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff,0x557755,1.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff,1.5);
sun.position.set(30,50,20);
sun.castShadow=true;
scene.add(sun);

const blocks = [];
const blockTypes = [
  {name:"Hierba", color:0x55a630},
  {name:"Tierra", color:0x8b5a2b},
  {name:"Piedra", color:0x777777},
  {name:"Madera", color:0x9b6b35},
  {name:"Arena", color:0xd9c27a}
];
let selected = 0;

const materials = blockTypes.map(b => new THREE.MeshLambertMaterial({color:b.color}));
const cubeGeo = new THREE.BoxGeometry(1,1,1);

function addBlock(x,y,z,type=0){
  const mesh = new THREE.Mesh(cubeGeo,materials[type]);
  mesh.position.set(x,y,z);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  mesh.userData.type=type;
  scene.add(mesh);
  blocks.push(mesh);
  return mesh;
}

function heightAt(x,z){
  return Math.max(1, Math.floor(2.5 + Math.sin(x*.32)*1.2 + Math.cos(z*.27)*1.2 + Math.sin((x+z)*.15)));
}

for(let x=-22;x<=22;x++){
  for(let z=-22;z<=22;z++){
    const h=heightAt(x,z);
    for(let y=0;y<h;y++) addBlock(x,y,z,y===h-1?0:(y<h-2?2:1));
  }
}

// árboles sencillos
function tree(x,z){
  const h=heightAt(x,z);
  for(let y=0;y<4;y++) addBlock(x,h+y,z,3);
  for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++){
    if(Math.abs(dx)+Math.abs(dz)<4) addBlock(x+dx,h+3,z+dz,0);
  }
}
for(const [x,z] of [[-8,-5],[7,-9],[12,5],[-14,9],[3,14]]) tree(x,z);

const player={pos:new THREE.Vector3(0,5,8), vel:new THREE.Vector3(), yaw:0, pitch:0, grounded:false};
const keys={};
let pointerLocked=false;

function eyePosition(){
  camera.position.copy(player.pos);
  camera.position.y += 1.65;
  camera.rotation.order="YXZ";
  camera.rotation.y=player.yaw;
  camera.rotation.x=player.pitch;
}
eyePosition();

document.getElementById("play").onclick=()=>{
  document.getElementById("menu").style.display="none";
  document.getElementById("hud").style.display="block";
  renderer.domElement.requestPointerLock?.();
};

document.addEventListener("pointerlockchange",()=>pointerLocked=document.pointerLockElement===renderer.domElement);
document.addEventListener("mousemove",e=>{
  if(!pointerLocked)return;
  player.yaw-=e.movementX*.0022;
  player.pitch-=e.movementY*.0022;
  player.pitch=Math.max(-1.5,Math.min(1.5,player.pitch));
});

addEventListener("keydown",e=>{
  keys[e.key.toLowerCase()]=true;
  if("12345".includes(e.key)){selected=Number(e.key)-1; updateHotbar();}
  if(e.code==="Space" && player.grounded) player.vel.y=8;
});
addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);

const raycaster=new THREE.Raycaster();

function blockHit(){
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  return raycaster.intersectObjects(blocks,false)[0];
}
addEventListener("mousedown",e=>{
  if(!pointerLocked)return;
  const hit=blockHit();
  if(!hit)return;
  if(e.button===0){
    const obj=hit.object;
    scene.remove(obj);
    const i=blocks.indexOf(obj);
    if(i>=0)blocks.splice(i,1);
    flash("Bloque roto");
  } else if(e.button===2){
    const p=hit.object.position.clone().add(hit.face.normal);
    const occupied=blocks.some(b=>b.position.distanceTo(p)<.1);
    if(!occupied && p.y<30){addBlock(Math.round(p.x),Math.round(p.y),Math.round(p.z),selected);flash("Bloque colocado");}
  }
});
addEventListener("contextmenu",e=>e.preventDefault());

function solidAt(x,y,z){
  return blocks.some(b=>Math.abs(b.position.x-x)<.45 && Math.abs(b.position.y-y)<.45 && Math.abs(b.position.z-z)<.45);
}
function updatePlayer(dt){
  const dir=new THREE.Vector3();
  if(keys.w||keys.arrowup)dir.z-=1;
  if(keys.s||keys.arrowdown)dir.z+=1;
  if(keys.a||keys.arrowleft)dir.x-=1;
  if(keys.d||keys.arrowright)dir.x+=1;
  if(dir.lengthSq())dir.normalize();
  const speed=7;
  const forward=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
  const move=forward.multiplyScalar(dir.z).add(right.multiplyScalar(dir.x));
  player.vel.x=move.x*speed;
  player.vel.z=move.z*speed;
  player.vel.y-=22*dt;

  const next=player.pos.clone().addScaledVector(player.vel,dt);
  // suelo aproximado
  const groundY=heightAt(Math.round(next.x),Math.round(next.z))+0.02;
  if(next.y<=groundY){
    next.y=groundY;
    player.vel.y=0;
    player.grounded=true;
  }else player.grounded=false;

  player.pos.copy(next);
  if(player.pos.y<-10){player.pos.set(0,6,8);player.vel.set(0,0,0);}
  eyePosition();
}

function updateHotbar(){
  const bar=document.getElementById("hotbar");
  bar.innerHTML=blockTypes.map((b,i)=>`<div class="slot ${i===selected?"selected":""}"><span>${i+1}</span><div class="swatch" style="background:#${b.color.toString(16).padStart(6,"0")}"></div></div>`).join("");
}
updateHotbar();

let messageTimer=0;
function flash(t){
  const el=document.getElementById("message");
  el.textContent=t;el.style.opacity=1;messageTimer=1;
}

document.querySelectorAll("#mobile-controls button").forEach(btn=>{
  const k=btn.dataset.key;
  btn.addEventListener("pointerdown",()=>keys[k]=true);
  btn.addEventListener("pointerup",()=>keys[k]=false);
  btn.addEventListener("pointerleave",()=>keys[k]=false);
});

let last=performance.now();
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min((now-last)/1000,.05); last=now;
  updatePlayer(dt);
  if(messageTimer>0){messageTimer-=dt;if(messageTimer<=0)document.getElementById("message").style.opacity=0;}
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);

addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
