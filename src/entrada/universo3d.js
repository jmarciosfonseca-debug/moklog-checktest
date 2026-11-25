// Universo SIS⁺ em 3D (Marcio, 24/11/2026): um espaço 360° de verdade. Gira-se para qualquer lado, aproxima-se até ENTRAR no
// núcleo MOKED (veias pulsando e sinais vitais) e as ligações entre os módulos são fios de luz com pulsos correndo.
// Tudo é luz (pontos, anéis, brilho): nada de blocos. Carregado sob demanda (three só baixa ao abrir o Universo).
// iniciarUniverso3D devolve null quando o aparelho não tem WebGL: aí o Universo 2D de sempre continua valendo.
import * as THREE from "three";

export const CSS_U3D = `.u3d{position:absolute;inset:0;overflow:hidden;background:radial-gradient(120% 90% at 50% 45%,#0b0d16 0,#04050a 70%);touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;color:#eef1f6}
.u3d canvas#u3-gl{position:absolute;inset:0;width:100%;height:100%;display:block}
#u3-lbs{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.u3-lb{position:absolute;left:0;top:0;white-space:nowrap;font-weight:600;font-size:12px;color:#fff;text-shadow:0 1px 6px #000,0 0 2px #000;will-change:transform,opacity;opacity:0}
.u3-lb.p{font-weight:800;font-size:15px}.u3-lb.o{font-weight:700;font-size:13px}
.u3-lb.c{font-weight:800;font-size:20px;letter-spacing:.06em;text-align:center}.u3-lb.c small{display:block;font-weight:600;font-size:10px;letter-spacing:.3em;color:#ffb3b0}
.u3-leg{position:absolute;left:12px;top:calc(62px + env(safe-area-inset-top,0px));font-weight:600;font-size:10px;letter-spacing:.16em;color:#98a1b3;line-height:1.9;pointer-events:none;text-transform:uppercase}
.u3-leg i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px}
.u3-cnt{position:absolute;right:12px;top:calc(62px + env(safe-area-inset-top,0px));text-align:right;font-size:10px;letter-spacing:.12em;color:#98a1b3;pointer-events:none}.u3-cnt b{display:block;font-weight:800;font-size:24px;color:#fff;letter-spacing:0}
#u3-vit{position:absolute;left:50%;top:calc(150px + env(safe-area-inset-top,0px));width:max-content;max-width:92vw;transform:translateX(-50%);text-align:center;pointer-events:none;opacity:0;transition:opacity .6s}
#u3-vit.on{opacity:1}
#u3-vit b{display:block;font-weight:700;font-size:11px;letter-spacing:.3em;color:#ffb3b0}
#u3-vit canvas{position:static;display:block;margin:6px auto 0;width:220px;height:46px;cursor:default}
#u3-vit span{font-weight:600;font-size:10px;letter-spacing:.2em;color:#98a1b3}
#u3-hint{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom,0px));text-align:center;font-size:10.5px;letter-spacing:.14em;color:#98a1b3;pointer-events:none;transition:opacity .5s}
.u3-btns{position:absolute;right:12px;bottom:calc(44px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:7px}
.u3-btns button{cursor:pointer;min-width:42px;height:42px;padding:0 8px;text-align:center;border:1px solid rgba(255,255,255,.2);background:rgba(10,12,20,.6);border-radius:11px;font-weight:600;font-size:18px;color:#fff;box-shadow:none}
.u3-btns button.t{font-size:9.5px;letter-spacing:.1em}
#u3-card{position:absolute;left:12px;right:66px;bottom:calc(44px + env(safe-area-inset-bottom,0px));max-width:420px;padding:13px 15px;border:1px solid rgba(255,90,90,.5);background:rgba(8,10,18,.86);border-radius:14px;transform:translateY(20px);opacity:0;pointer-events:none;transition:.3s}
#u3-card.on{transform:none;opacity:1;pointer-events:auto}
#u3-card .k{font-weight:700;font-size:10px;letter-spacing:.2em}
#u3-card h2{font-weight:800;font-size:19px;margin:2px 0 4px;color:#fff}
#u3-card p{margin:0;font-size:13px;line-height:1.4;color:#cdd3df}
#u3-card .ch{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
#u3-card .ch button{cursor:pointer;background:transparent;font-weight:600;font-size:11.5px;padding:5px 10px;border:1px solid rgba(255,255,255,.25);border-radius:999px;color:#fff}
#u3-card .ch em{font-weight:600;font-size:9.5px;font-style:normal;letter-spacing:.16em;color:#98a1b3;width:100%}`;
const HTML_U3D = (n) => `<canvas id="u3-gl"></canvas><div id="u3-lbs"></div>
<div class="u3-leg"><div><i style="background:#9aa7c7"></i>Equipamentos</div><div><i style="background:#69c3ff"></i>Pessoas</div><div><i style="background:#ffd766"></i>Procedimentos</div><div><i style="background:#ff5a5f"></i>Entregas</div></div>
<div class="u3-cnt"><b>${n}</b>módulos<br>conectados</div>
<div id="u3-vit"><b>NÚCLEO MOKED · SINAIS VITAIS</b><canvas id="u3-ecg" width="440" height="92"></canvas><span>${n} MÓDULOS PULSANDO · SIS⁺ ATIVO</span></div>
<div id="u3-card"></div>
<div class="u3-btns"><button type="button" id="u3-zi" aria-label="Aproximar">+</button><button type="button" id="u3-zo" aria-label="Afastar">−</button><button type="button" id="u3-zn" class="t">NÚCLEO</button><button type="button" id="u3-zf" class="t">VER TUDO</button></div>
<div id="u3-hint">arraste para girar · dois dedos para aproximar · toque num módulo</div>`;

/* eslint-disable */
export function iniciarUniverso3D({ raiz, dados, win = typeof window !== "undefined" ? window : null }) {
if (!raiz || !win || !dados) return null;
// Sonda em um canvas à parte (não gasta o contexto do canvas de verdade nem suja o console onde não há WebGL).
try { var sonda = raiz.ownerDocument.createElement("canvas"), gl0 = sonda.getContext && (sonda.getContext("webgl2") || sonda.getContext("webgl")); if (!gl0 || typeof gl0.getShaderPrecisionFormat !== "function") return null; } catch (e) { return null; }
var el = raiz.ownerDocument.createElement("div"); el.className = "u3d"; el.setAttribute("data-testid", "universo-3d");
el.innerHTML = "<style>" + CSS_U3D + "</style>" + HTML_U3D(dados.MODS.length);
raiz.appendChild(el);

var MODS=dados.MODS,LIG=dados.LIG,TAU=Math.PI*2;
var COR={eq:0x9aa7c7,pe:0x69c3ff,pr:0xffd766,out:0xff5a5f,c:0xff3b40};
var NOME={eq:'EQUIPAMENTOS',pe:'PESSOAS',pr:'PROCEDIMENTOS',out:'ENTREGA',c:'NÚCLEO'};
var $=function(i){return el.querySelector('#u3-'+i)},app=el,canvas=$('gl'),renderer;
try{renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:true,powerPreference:'high-performance'})}catch(e){renderer=null}
if(!renderer||!renderer.getContext||!renderer.getContext()){el.remove();return null}
var PR=Math.min(win.devicePixelRatio||1,2);renderer.setPixelRatio(PR);renderer.setClearColor(0,0);
var scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(58,1,.01,400);
var rnd=(function(s){return function(){s=(s*16807)%2147483647;return (s-1)/2147483646}})(20261124);
function V(x,y,z){return new THREE.Vector3(x,y,z)}
/* ---------- nós ---------- */
var nodes=[],byId={};
function add(id,g,nome,desc,pos,r){var n={id:id,g:g,nome:nome,desc:desc,p:pos,r:r,rel:[]};nodes.push(n);byId[id]=n;return n}
add('moked','c','MOKED','O núcleo do SIS⁺: equipamentos, pessoas e procedimentos ligados num sistema só.',V(0,0,0),1);
var PIL=[['eq','Equipamentos',-90,.9],['pe','Pessoas',30,-.6],['pr','Procedimentos',150,-.2]];
PIL.forEach(function(p){var a=p[2]*Math.PI/180;add('P'+p[0],p[0],p[1],'Pilar do SIS⁺.',V(Math.cos(a)*5.2,p[3]-Math.sin(a)*1.6,Math.sin(a)*5.2),.5).pil=1});
['eq','pe','pr'].forEach(function(g){var c=byId['P'+g],ms=MODS.filter(function(m){return m[1]===g}),out=c.p.clone().normalize(),k=ms.length;
 var ux=V(0,1,0).cross(out).normalize(),uy=out.clone().cross(ux).normalize();
 ms.forEach(function(m,i){var t=(i+.5)/k,ph=Math.acos(1-1.25*t),th=i*2.399963,rr=2.35+((i%3)-1)*.28;
  var d=out.clone().multiplyScalar(Math.cos(ph)).add(ux.clone().multiplyScalar(Math.sin(ph)*Math.cos(th))).add(uy.clone().multiplyScalar(Math.sin(ph)*Math.sin(th)));
  add(m[0],g,m[2],m[3],c.p.clone().add(d.multiplyScalar(rr)),.2)})});
var outs=MODS.filter(function(m){return m[1]==='out'}),OP=[[40,34],[-28,-12],[205,-38],[118,-46],[168,30]];
outs.forEach(function(m,i){var a=OP[i][0]*Math.PI/180,b=OP[i][1]*Math.PI/180,R=9.6;add(m[0],'out',m[2],m[3],V(Math.cos(b)*Math.cos(a)*R,Math.sin(b)*R,Math.cos(b)*Math.sin(a)*R),.34)});
/* ---------- ligações ---------- */
var links=[];
function liga(a,b,forte){var A=byId[a],B=byId[b];if(!A||!B)return;links.push({a:A,b:B,forte:forte});A.rel.push(B);B.rel.push(A)}
PIL.forEach(function(p){liga('moked','P'+p[0],1)});
MODS.forEach(function(m){if(m[1]!=='out')liga('P'+m[1],m[0],0)});
LIG.forEach(function(l){liga(l[0],l[1],0)});
function curva(L,t,o){var a=L.a.p,b=L.b.p,mid=a.clone().add(b).multiplyScalar(.5),len=a.distanceTo(b),dir=mid.lengthSq()>.01?mid.clone().normalize():V(0,1,0);
 var c=mid.add(dir.multiplyScalar(len*.22)),u=1-t;return (o||V()).set(u*u*a.x+2*u*t*c.x+t*t*b.x,u*u*a.y+2*u*t*c.y+t*t*b.y,u*u*a.z+2*u*t*c.z+t*t*b.z)}
/* ---------- nuvem de pontos com fluxo (ligações, veias, casca, estrelas) ---------- */
var P=[],C=[],SZ=[],UU=[],FL=[],BA=[];
function pt(v,col,size,u,flow,base){P.push(v.x,v.y,v.z);var c=new THREE.Color(col);C.push(c.r,c.g,c.b);SZ.push(size);UU.push(u);FL.push(flow);BA.push(base)}
var tmp=V();
links.forEach(function(L,li){var n=Math.max(18,Math.round(L.a.p.distanceTo(L.b.p)*7)),col=L.forte?0xff4a4f:(L.a.g==='out'||L.b.g==='out'?0xff6a6f:COR[L.b.g]||0xffffff),ph=rnd();
 for(var i=0;i<=n;i++){var t=i/n;curva(L,t,tmp);pt(tmp,col,L.forte?.075:.05,t*(L.forte?2:1.3)+ph,L.forte?.42:.24+rnd()*.1,L.forte?.3:.16)}});
/* veias do núcleo: fios finos que nascem no centro e se ramificam */
function veia(p0,d0,steps,size,gen){var p=p0.clone(),d=d0.clone(),ph=rnd();
 for(var i=0;i<steps;i++){var r=p.length(),k=i/steps;
  pt(p,k<.35?0xffd9c8:(k<.7?0xff6a55:0xff2a35),size*(1-k*.55),r*2.2+ph,.5,.12);
  d.add(V(rnd()-.5,rnd()-.5,rnd()-.5).multiplyScalar(.5)).add(p.clone().normalize().multiplyScalar(.22)).normalize();
  p.add(d.clone().multiplyScalar(.024));if(p.length()>.93){p.setLength(.93);d.add(p.clone().normalize().multiplyScalar(-.9)).normalize()}
  if(gen<2&&i>8&&rnd()<.045)veia(p,d.clone().add(V(rnd()-.5,rnd()-.5,rnd()-.5)).normalize(),Math.round((steps-i)*.8),size*.8,gen+1)}}
for(var i=0;i<46;i++){var d=V(rnd()-.5,rnd()-.5,rnd()-.5).normalize();veia(d.clone().multiplyScalar(.05),d,44,.03,0)}
/* casca do núcleo e estrelas */
for(i=0;i<900;i++){var y=1-2*(i+.5)/900,rr=Math.sqrt(1-y*y),th=i*2.399963;pt(V(Math.cos(th)*rr,y,Math.sin(th)*rr),0xff3b40,.022,rnd()*6,.12+rnd()*.1,.1)}
for(i=0;i<1600;i++){var u=rnd()*2-1,a=rnd()*TAU,r=Math.sqrt(1-u*u),R=60+rnd()*120;pt(V(r*Math.cos(a)*R,u*R,r*Math.sin(a)*R),rnd()<.15?0xffb0a8:(rnd()<.3?0xa8c8ff:0xffffff),.5+rnd()*.9,rnd()*8,.03+rnd()*.05,.35)}
for(i=0;i<420;i++){pt(V((rnd()-.5)*30,(rnd()-.5)*22,(rnd()-.5)*30),0xffc0b0,.05+rnd()*.05,rnd()*8,.05+rnd()*.06,.18)}
var geo=new THREE.BufferGeometry();
geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
geo.setAttribute('size',new THREE.Float32BufferAttribute(SZ,1));geo.setAttribute('u',new THREE.Float32BufferAttribute(UU,1));
geo.setAttribute('flow',new THREE.Float32BufferAttribute(FL,1));geo.setAttribute('base',new THREE.Float32BufferAttribute(BA,1));
var uni={time:{value:0},beat:{value:0},scale:{value:600}};
var mat=new THREE.ShaderMaterial({uniforms:uni,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
 vertexShader:'attribute float size;attribute float u;attribute float flow;attribute float base;attribute vec3 color;uniform float time;uniform float beat;uniform float scale;varying vec3 vC;varying float vA;'+
  'void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float z=max(.02,-mv.z);float f=fract(u-time*flow);float p=exp(-pow((f-.5)*7.,2.));'+
  'float core=1.-smoothstep(.9,1.3,length(position));p*=1.+beat*core*1.2;gl_PointSize=min(34.,size*(1.+p*1.6)*scale/z);'+
  'vA=(base+p)*clamp(1.7-z/26.,.3,1.)*smoothstep(.02,.12,z);vC=color*(1.+p*.9);gl_Position=projectionMatrix*mv;}',
 fragmentShader:'varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);gl_FragColor=vec4(vC,a*a*vA);}'});
var cloud=new THREE.Points(geo,mat);cloud.frustumCulled=false;scene.add(cloud);
/* ---------- sprites dos nós ---------- */
function tx(fn,s){var k=document.createElement('canvas');k.width=k.height=s||128;fn(k.getContext('2d'),k.width);var t=new THREE.CanvasTexture(k);return t}
var tGlow=tx(function(x,s){var g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.22,'rgba(255,255,255,.32)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,s,s)});
var tRing=tx(function(x,s){x.fillStyle='rgba(6,8,14,.82)';x.beginPath();x.arc(s/2,s/2,s*.4,0,TAU);x.fill();x.strokeStyle='#fff';x.lineWidth=s*.045;x.stroke()},256);
var tDia=tx(function(x,s){x.translate(s/2,s/2);x.rotate(Math.PI/4);x.fillStyle='rgba(6,8,14,.82)';x.strokeStyle='#fff';x.lineWidth=s*.05;var h=s*.29;x.fillRect(-h,-h,2*h,2*h);x.strokeRect(-h,-h,2*h,2*h)},256);
function spr(t,col,sc,add){var m=new THREE.SpriteMaterial({map:t,color:col,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending});var s=new THREE.Sprite(m);s.scale.set(sc,sc,1);return s}
nodes.forEach(function(n){var col=COR[n.g];
 if(n.g==='c'){n.glow=spr(tGlow,0xff2a30,5.4,true);n.glow.material.opacity=.55;n.glow.position.copy(n.p);scene.add(n.glow);return}
 n.glow=spr(tGlow,col,n.r*5.2,true);n.glow.material.opacity=n.pil?.5:.34;n.glow.position.copy(n.p);scene.add(n.glow);
 n.ring=spr(n.g==='out'?tDia:tRing,col,n.r*2.3,false);n.ring.position.copy(n.p);n.ring.renderOrder=2;scene.add(n.ring)});
/* realce das ligações do módulo escolhido */
var hl=new THREE.Group();scene.add(hl);
function realce(n){while(hl.children.length)hl.remove(hl.children[0]);if(!n)return;links.forEach(function(L){if(L.a!==n&&L.b!==n)return;var pts=[];for(var i=0;i<=30;i++)pts.push(curva(L,i/30).clone());
 hl.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false})))})}
/* ---------- rótulos ---------- */
var lbs=$('lbs');nodes.forEach(function(n){var e=document.createElement('div');e.className='u3-lb'+(n.g==='c'?' c':n.pil?' p':n.g==='out'?' o':'');e.innerHTML=n.g==='c'?'MOKED<small>SIS⁺</small>':n.nome;lbs.appendChild(e);n.el=e});
/* ---------- câmera ---------- */
var yawT=null,pitchT=null,W=1,H=1,yaw=.5,pitch=.22,dist=19,dT=19,tgt=V(0,0,0),tT=V(0,0,0),vy=0,vp=0,sel=null,tocou=false,ocioso=0;
var DFIT=19;
function resize(){W=app.clientWidth;H=app.clientHeight;renderer.setSize(W,H,false);cam.aspect=W/H;cam.fov=W<H?62:50;cam.updateProjectionMatrix();uni.scale.value=H*PR/(2*Math.tan(cam.fov*Math.PI/360));DFIT=W<H?31:19;if(!tocou){dist=dT=DFIT}}
win.addEventListener('resize',resize);resize();
var ptr={},pin0=0,d0=0,lx=0,ly=0,lt=0,mv=0;
app.addEventListener('pointerdown',function(e){if(e.target.closest('button,#u3-card'))return;ptr[e.pointerId]={x:e.clientX,y:e.clientY};var ids=Object.keys(ptr);if(ids.length===2){var a=ptr[ids[0]],b=ptr[ids[1]];pin0=Math.hypot(a.x-b.x,a.y-b.y);d0=dT}
 lx=e.clientX;ly=e.clientY;lt=performance.now();mv=0;vy=vp=0;yawT=pitchT=null;toque();try{app.setPointerCapture(e.pointerId)}catch(_){}});
app.addEventListener('pointermove',function(e){if(!ptr[e.pointerId])return;ptr[e.pointerId]={x:e.clientX,y:e.clientY};var ids=Object.keys(ptr);
 if(ids.length>=2){var a=ptr[ids[0]],b=ptr[ids[1]];if(pin0>0)dT=clamp(d0*pin0/Math.hypot(a.x-b.x,a.y-b.y),.12,34);mv=99;lx=e.clientX;ly=e.clientY;return}
 var now=performance.now(),dx=e.clientX-lx,dy=e.clientY-ly,dt=Math.max(8,now-lt),k=.0052;mv+=Math.abs(dx)+Math.abs(dy);
 yaw-=dx*k;pitch=clamp(pitch+dy*k,-1.45,1.45);vy=.7*vy+.3*(-dx*k/dt*1000);vp=.7*vp+.3*(dy*k/dt*1000);lx=e.clientX;ly=e.clientY;lt=now});
function solta(e){if(!ptr[e.pointerId])return;delete ptr[e.pointerId];var ids=Object.keys(ptr);if(ids.length){lx=ptr[ids[0]].x;ly=ptr[ids[0]].y;pin0=0;return}
 if(mv<8){var n=acha(e.clientX,e.clientY);if(n)abrir(n);else fechar()}}
app.addEventListener('pointerup',solta);app.addEventListener('pointercancel',solta);
app.addEventListener('wheel',function(e){e.preventDefault();toque();dT=clamp(dT*Math.exp(clamp(e.deltaY,-120,120)*.0016),.12,34)},{passive:false});
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function toque(){ocioso=0;if(!tocou){tocou=true;$('hint').style.opacity=0}}
var pv=V();
function tela(n){pv.copy(n.p).project(cam);return{x:(pv.x*.5+.5)*W,y:(-pv.y*.5+.5)*H,z:pv.z}}
function acha(x,y){var best=null,bd=1e9;nodes.forEach(function(n){var s=tela(n);if(s.z>1)return;var d=Math.hypot(s.x-x,s.y-y),lim=n.g==='c'?46:30;if(d<lim&&d<bd){bd=d;best=n}});return best}
function abrir(n){toque();sel=n;tT.copy(n.p);dT=n.g==='c'?3.2:(n.pil?9:6.5);realce(n);
 // olha o módulo de fora para dentro, um pouco de lado, para o pilar não ficar atrás do nome
 if(n.g!=='c'){var dir=n.p.clone().normalize();vy=vp=0;yawT=Math.atan2(dir.x,dir.z)+.55;pitchT=clamp(Math.asin(dir.y)+.25,-1.2,1.2)}
 var h='<div class="k" style="color:#'+('000000'+COR[n.g].toString(16)).slice(-6)+'">'+NOME[n.g]+'</div><h2>'+n.nome+'</h2><p>'+n.desc+'</p>';
 var rel=n.rel.filter(function(r){return r.g!=='c'}).slice(0,8);if(rel.length){h+='<div class="ch"><em>LIGADO A</em>';rel.forEach(function(r){h+='<button data-id="'+r.id+'">'+r.nome+'</button>'});h+='</div>'}
 var c=$('card');c.innerHTML=h;c.classList.add('on');Array.prototype.forEach.call(c.querySelectorAll('button'),function(b){b.onclick=function(){abrir(byId[b.getAttribute('data-id')])}})}
function fechar(){sel=null;realce(null);$('card').classList.remove('on')}
$('zi').onclick=function(){toque();dT=clamp(dT*.62,.12,34)};$('zo').onclick=function(){toque();dT=clamp(dT/.62,.12,34)};
$('zf').onclick=function(){toque();fechar();tT.set(0,0,0);dT=DFIT};
$('zn').onclick=function(){toque();fechar();tT.set(0,0,0);dT=.35};
/* ---------- ECG ---------- */
var ecg=$('ecg').getContext('2d');
function batida(t){var f=(t%1.25)/1.25;return Math.exp(-Math.pow((f-.08)*26,2))+.7*Math.exp(-Math.pow((f-.3)*22,2))}
function onda(f){return Math.exp(-Math.pow((f-.3)*60,2))*1.0-Math.exp(-Math.pow((f-.34)*70,2))*.35+Math.exp(-Math.pow((f-.52)*16,2))*.22+Math.exp(-Math.pow((f-.14)*22,2))*.12}
function desenhaEcg(t){ecg.clearRect(0,0,440,92);ecg.lineWidth=2.4;ecg.strokeStyle='#ff5a5f';ecg.shadowColor='#ff3b40';ecg.shadowBlur=10;ecg.beginPath();for(var x=0;x<=440;x+=3){var f=((x/440)*2.4-t/1.25)%1;if(f<0)f+=1;var y=62-onda(f)*46;x?ecg.lineTo(x,y):ecg.moveTo(x,y)}ecg.stroke()}
/* ---------- laço ---------- */
var clock=new THREE.Clock(),ecgT=0;
var vivo=true,raf=0;
function frame(){if(!vivo)return;raf=win.requestAnimationFrame(frame);var dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
 ocioso+=dt;if(!Object.keys(ptr).length){yaw+=vy*dt;pitch=clamp(pitch+vp*dt,-1.45,1.45);var f=Math.exp(-dt*2.4);vy*=f;vp*=f;if(ocioso>3&&!sel)yaw+=dt*.045}
 if(yawT!==null){var dy=((yawT-yaw)%TAU+TAU*1.5)%TAU-Math.PI;yaw+=dy*(1-Math.exp(-dt*3.5));pitch+=(pitchT-pitch)*(1-Math.exp(-dt*3.5));if(Math.abs(dy)<.004)yawT=null}
 dist+=(dT-dist)*(1-Math.exp(-dt*4.5));tgt.lerp(tT,1-Math.exp(-dt*4));
 var cp=Math.cos(pitch);cam.position.set(tgt.x+Math.sin(yaw)*cp*dist,tgt.y+Math.sin(pitch)*dist,tgt.z+Math.cos(yaw)*cp*dist);cam.lookAt(tgt);
 var b=batida(t);uni.time.value=t;uni.beat.value=b;
 var core=nodes[0],dc=cam.position.length();core.glow.scale.setScalar(5.4*(1+b*.09));core.glow.material.opacity=clamp((dc-1.1)/3,0,1)*(.5+b*.25);
 $('vit').classList.toggle('on',dc<2.6);ecgT+=dt;if(dc<2.6&&ecgT>.033){ecgT=0;desenhaEcg(t)}
 renderer.render(scene,cam);
 for(var i=0;i<nodes.length;i++){var n=nodes[i],s=tela(n),d=cam.position.distanceTo(n.p),e=n.el,vis=s.z<1&&s.x>-80&&s.x<W+80&&s.y>-40&&s.y<H+40;
  var show=n.g==='c'?(d>3.4?1:0):(n.pil||n.g==='out'?clamp(1.6-d/30,.35,1):(sel&&(n===sel||sel.rel.indexOf(n)>=0)?1:clamp((11-d)/4,0,1)));
  if(n.ring){var pu=n===sel?1+.12*Math.sin(t*5):1;n.ring.scale.setScalar(n.r*2.3*pu);var nf=clamp((d-.8)/1.6,0,1);n.ring.material.opacity=nf;n.glow.material.opacity=(n.pil?.5:.34)*nf}
  if(!vis||show<=.02){if(e._o!==0){e.style.opacity=0;e._o=0}continue}
  var off=n.g==='c'?0:(n.r*uni.scale.value/PR/Math.max(.2,d))*1.25+6;
  e.style.opacity=show.toFixed(2);e._o=show;e.style.transform='translate3d('+s.x.toFixed(1)+'px,'+(s.y+off).toFixed(1)+'px,0) translate(-50%,'+(n.g==='c'?'-50%':'0')+')'}}
frame();
return {
 nos:nodes.length,
 abrir:function(id){if(byId[id])abrir(byId[id])},
 ver:function(y,p,d){tocou=true;yawT=null;yaw=y;pitch=p;dist=dT=d},
 pausar:function(){vivo=false;win.cancelAnimationFrame(raf)},
 retomar:function(){if(vivo)return;vivo=true;clock.getDelta();resize();frame()},
 parar:function(){vivo=false;win.cancelAnimationFrame(raf);win.removeEventListener('resize',resize);try{geo.dispose();mat.dispose();renderer.dispose();if(renderer.forceContextLoss)renderer.forceContextLoss()}catch(e){/* já liberado */}el.remove()}
};
}
