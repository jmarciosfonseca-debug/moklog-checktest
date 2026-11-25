// Universo SIS⁺ em 3D (Marcio, 24/11/2026): um espaço 360° de verdade. Gira-se para qualquer lado, aproxima-se até ENTRAR no
// núcleo MOKED (veias pulsando e sinais vitais) e as ligações entre os módulos são fios de luz com pulsos correndo.
// Tudo é luz (pontos, anéis, brilho): nada de blocos. Carregado sob demanda (three só baixa ao abrir o Universo).
// iniciarUniverso3D devolve null quando o aparelho não tem WebGL: aí o Universo 2D de sempre continua valendo.
import * as THREE from "three";

export const CSS_U3D = `.u3d{position:absolute;inset:0;overflow:hidden;background:radial-gradient(120% 90% at 50% 45%,#0b0d16 0,#04050a 70%);touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;color:#eef1f6}
.u3d canvas#u3-gl{position:absolute;inset:0;width:100%;height:100%;display:block}
#u3-lbs{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.u3-lb{position:absolute;left:0;top:0;white-space:nowrap;font-weight:600;font-size:12px;color:#fff;text-shadow:0 1px 6px #000,0 0 2px #000;will-change:transform,opacity;opacity:0}
.u3-lb.p{font-weight:800;font-size:15px}.u3-lb.m{font-weight:700;font-size:10.5px}.u3-lb.a{font-weight:800;font-size:17px;text-align:center}.u3-lb.a em,.u3-lb.m em{font-style:normal;color:#ff5a5f}.u3-lb.a small{display:block;font-weight:600;font-size:9.5px;letter-spacing:.14em;color:#c3cad8;text-transform:uppercase}.u3-lb.o{font-weight:700;font-size:13px}
.u3-lb.c{font-weight:800;font-size:20px;letter-spacing:.06em;text-align:center}.u3-lb.c small{display:block;font-weight:600;font-size:10px;letter-spacing:.3em;color:#ffb3b0}
.u3-leg{position:absolute;left:12px;top:calc(62px + env(safe-area-inset-top,0px));font-weight:600;font-size:10px;letter-spacing:.16em;color:#98a1b3;line-height:1.9;pointer-events:none;text-transform:uppercase}
.u3-leg i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px}
.u3-cnt{position:absolute;right:12px;top:calc(62px + env(safe-area-inset-top,0px));text-align:right;font-size:10px;letter-spacing:.12em;color:#98a1b3;pointer-events:none}.u3-cnt b{display:block;font-weight:800;font-size:24px;color:#fff;letter-spacing:0}
#u3-vit{position:absolute;left:50%;top:calc(172px + env(safe-area-inset-top,0px));width:max-content;max-width:92vw;transform:translateX(-50%);text-align:center;pointer-events:none;opacity:0;transition:opacity .6s}
#u3-vit.on{opacity:1}
#u3-vit b{display:block;font-weight:700;font-size:11px;letter-spacing:.3em;color:#ffb3b0}
#u3-vit canvas{position:static;display:block;margin:6px auto 0;width:220px;height:46px;cursor:default}
#u3-vit span{font-weight:600;font-size:10px;letter-spacing:.2em;color:#98a1b3}
#u3-onde{position:absolute;left:12px;right:12px;top:calc(146px + env(safe-area-inset-top,0px));font-weight:700;font-size:10.5px;letter-spacing:.2em;color:#ffb3b0;pointer-events:none;text-transform:uppercase}
#u3-warp{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 46%,rgba(255,235,230,.95) 0,rgba(255,70,70,.55) 30%,rgba(4,5,10,0) 72%)}
#u3-warp.on{animation:u3warp .9s ease-out}
@keyframes u3warp{0%{opacity:0;transform:scale(.3)}22%{opacity:1}100%{opacity:0;transform:scale(2.6)}}
#u3-card .ir{display:inline-block;margin-top:10px;cursor:pointer;border:0;background:linear-gradient(180deg,#d63224,#a0201a);color:#fff;font-weight:700;font-size:12px;letter-spacing:.14em;padding:10px 14px;border-radius:9px;text-transform:uppercase}
.u3-pv{position:relative;height:92px;margin:8px 0 9px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.015));overflow:hidden;animation:u3pvIn .5s ease both}
@keyframes u3pvIn{from{opacity:0;transform:translateY(6px)}}
.u3-pv>s{position:absolute;right:7px;bottom:4px;font-size:8px;letter-spacing:.14em;color:rgba(255,255,255,.34);text-decoration:none;text-transform:uppercase}
.u3-pv .ros{display:flex;gap:9px;align-items:center;justify-content:center;height:100%}
.u3-pv .ros i{width:38px;height:38px;border-radius:50%;border:1px solid rgba(105,195,255,.7);background:radial-gradient(circle at 50% 36%,rgba(255,255,255,.85) 0 21%,transparent 23%),radial-gradient(ellipse at 50% 100%,rgba(255,255,255,.7) 0 42%,transparent 44%),rgba(105,195,255,.14);opacity:.18;animation:u3ros 3.2s ease-in-out infinite}
@keyframes u3ros{0%,100%{opacity:.18;transform:scale(.92)}18%,34%{opacity:1;transform:scale(1.06)}}
.u3-pv .lis{position:absolute;left:12px;right:12px;top:0;animation:u3lis 9s linear infinite}
.u3-pv .lis div{height:23px;line-height:23px;font-size:11.5px;color:#e6eaf2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:1px dashed rgba(255,255,255,.1)}
.u3-pv .lis div::before{content:"▸";color:#ffd766;margin-right:7px}
@keyframes u3lis{from{transform:translateY(8px)}to{transform:translateY(-50%)}}
.u3-pv .das{display:flex;align-items:center;gap:14px;height:100%;padding:0 14px}
.u3-pv .das svg{width:64px;height:64px;flex:none}
.u3-pv .das circle.f{stroke-dasharray:176;stroke-dashoffset:176;animation:u3anel 2.6s ease-out infinite alternate}
@keyframes u3anel{to{stroke-dashoffset:var(--o,24)}}
.u3-pv .das b{position:absolute;left:14px;width:64px;text-align:center;font-weight:800;font-size:17px;color:#fff}
.u3-pv .bar{flex:1;display:flex;align-items:flex-end;gap:5px;height:58px}
.u3-pv .bar i{flex:1;border-radius:3px 3px 0 0;background:linear-gradient(180deg,#ff6a6f,rgba(255,90,95,.25));transform-origin:bottom;animation:u3bar 2.4s ease-in-out infinite alternate}
@keyframes u3bar{from{transform:scaleY(.35)}to{transform:scaleY(1)}}
.u3-pv .doc{display:flex;justify-content:center;gap:12px;height:100%;align-items:center}
.u3-pv .doc u{display:block;width:56px;height:74px;border-radius:4px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.07);padding:7px 6px;text-decoration:none;animation:u3doc 4s ease-in-out infinite}
.u3-pv .doc u:nth-child(2){animation-delay:-1.3s}.u3-pv .doc u:nth-child(3){animation-delay:-2.6s}
.u3-pv .doc i{display:block;height:3px;margin-bottom:5px;border-radius:2px;background:rgba(255,255,255,.55)}
.u3-pv .doc i:first-child{background:#ff5a5f;width:60%}.u3-pv .doc i:nth-child(3){width:75%}.u3-pv .doc i:last-child{height:20px;background:linear-gradient(90deg,rgba(255,90,95,.6) 30%,rgba(255,255,255,.2) 30% 55%,rgba(105,195,255,.5) 55%)}
@keyframes u3doc{0%,100%{transform:translateY(4px) rotate(-3deg);opacity:.55}50%{transform:translateY(-3px) rotate(2deg);opacity:1}}
.u3-pv .cam{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;height:100%;padding:8px}
.u3-pv .cam i{position:relative;border:1px solid rgba(154,167,199,.5);border-radius:4px;background:linear-gradient(160deg,rgba(154,167,199,.2),rgba(10,14,22,.3));overflow:hidden}
.u3-pv .cam i::before{content:"";position:absolute;left:0;right:0;height:2px;background:rgba(255,255,255,.55);animation:u3scan 2.6s linear infinite}
.u3-pv .cam i::after{content:"";position:absolute;left:5px;top:5px;width:5px;height:5px;border-radius:50%;background:#ff3b40;animation:u3rec 1.1s steps(1) infinite}
.u3-pv .cam i:nth-child(2)::before{animation-delay:-.9s}.u3-pv .cam i:nth-child(3)::before{animation-delay:-1.7s}.u3-pv .cam i:nth-child(4)::before{animation-delay:-.4s}
@keyframes u3scan{from{top:0}to{top:100%}}@keyframes u3rec{50%{opacity:0}}
.u3-pv .map{position:absolute;inset:0;background:linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px) 0 0/100% 18px,linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px) 0 0/22px 100%}
.u3-pv .map svg{position:absolute;inset:0;width:100%;height:100%}
.u3-pv .map path{fill:none;stroke:#ffd766;stroke-width:1.6;stroke-dasharray:6 5;animation:u3traco 3s linear infinite}
@keyframes u3traco{to{stroke-dashoffset:-44}}
.u3-pv .map circle{fill:#ff5a5f;animation:u3rec 1.6s ease-in-out infinite}
.u3-pv .sta{display:flex;flex-wrap:wrap;gap:6px;align-content:center;justify-content:center;height:100%;padding:0 10px}
.u3-pv .sta span{font-size:10.5px;color:#e6eaf2;border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:4px 9px 4px 7px;white-space:nowrap}
.u3-pv .sta span::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;background:#5fd08f;animation:u3rec 2.2s ease-in-out infinite}
.u3-pv .sta span:nth-child(3n)::before{background:#ffd766;animation-delay:-.7s}.u3-pv .sta span:nth-child(5n)::before{background:#ff5a5f;animation-delay:-1.3s}
@media (prefers-reduced-motion:reduce){.u3-pv *{animation-duration:8s}}
#u3-itens,#u3-ini{display:none}
.u3d.cli #u3-itens{display:flex;gap:7px;position:absolute;left:0;right:0;top:calc(10px + env(safe-area-inset-top,0px));padding:0 12px 6px;overflow-x:auto;scrollbar-width:none}
.u3d.cli #u3-itens button{flex:none;cursor:pointer;font-weight:600;font-size:11.5px;color:#fff;background:rgba(10,12,20,.6);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:7px 11px;white-space:nowrap}
.u3d.cli #u3-itens button i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px}
.u3d.cli #u3-itens button.on{border-color:#ff5a5f;background:rgba(160,30,24,.5)}
.u3d.cli #u3-ini{display:block;position:absolute;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom,0px));cursor:pointer;font-weight:700;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#fff;background:rgba(10,12,20,.72);border:1px solid rgba(255,90,95,.6);border-radius:999px;padding:11px 20px;box-shadow:0 0 16px rgba(255,59,64,.25)}
.u3d.cli .u3-leg,.u3d.cli .u3-cnt,.u3d.cli #u3-hint{display:none}
.u3d.cli #u3-onde{top:calc(54px + env(safe-area-inset-top,0px))}
.u3d.cli #u3-card,.u3d.cli .u3-btns{bottom:calc(64px + env(safe-area-inset-bottom,0px))}
#u3-card .ln{font-size:12.5px;line-height:1.35;color:#dfe4ee;padding:4px 0;border-top:1px dashed rgba(255,255,255,.1)}
#u3-card .ac{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
#u3-card .ac button{cursor:pointer;border:1px solid rgba(255,255,255,.3);background:transparent;color:#fff;font-weight:700;font-size:11.5px;letter-spacing:.1em;padding:9px 12px;border-radius:9px;text-transform:uppercase}
#u3-card .ac button.pri{border:0;background:linear-gradient(180deg,#d63224,#a0201a)}
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
<div class="u3-leg" id="u3-leg"><div><i style="background:#9aa7c7"></i>Equipamentos</div><div><i style="background:#69c3ff"></i>Pessoas</div><div><i style="background:#ffd766"></i>Procedimentos</div><div><i style="background:#ff5a5f"></i>Entregas</div></div>
<div class="u3-cnt" id="u3-cnt"></div>
<div id="u3-onde"></div><div id="u3-warp"></div>
<div id="u3-vit"><b>NÚCLEO MOKED · SINAIS VITAIS</b><canvas id="u3-ecg" width="440" height="92"></canvas><span>CONTINUE APROXIMANDO PARA ENTRAR NAS ÁREAS</span></div>
<div id="u3-itens"></div><div id="u3-card"></div><button type="button" id="u3-ini">⌂ Início</button>
<div class="u3-btns"><button type="button" id="u3-zi" aria-label="Aproximar">+</button><button type="button" id="u3-zo" aria-label="Afastar">−</button><button type="button" id="u3-zn" class="t">NÚCLEO</button><button type="button" id="u3-zf" class="t">VER TUDO</button></div>
<div id="u3-hint">arraste para girar · dois dedos para aproximar · toque num módulo</div>`;

/* eslint-disable */
// 25/11/2026 (Marcio): cada módulo mostra uma "lembrança" do que ele é: um slide pequeno, translúcido e animado.
// São ILUSTRAÇÕES (a abertura aparece antes do login): nada de rosto, nome ou número real de projeto.
var L=function(){return ['lis',[].slice.call(arguments)]},S=function(){return ['sta',[].slice.call(arguments)]};
export var PREVIAS_U3D={
 grav:['das',72,'dias'],body:['cam'],peri:['map'],acc:S('Portaria','Catracas','Cancela','Credenciais','Chaves'),ilum:S('Quadrante A','Quadrante B','Docas','Pátio','Gerador'),
 equip:S('Rádios','Bodycams','Lanternas','Detectores','Veículos'),cco:['cam'],rondav:['cam'],
 equipe:['ros'],mapaeq:['ros'],mapadia:['ros'],fv:['das',88,'%'],camp:L('Campanha do mês','Reconhecimento da equipe','Ações de engajamento'),lider:['das',94,'%'],
 tsem:['das',92,'%'],rondad:L('Ronda 06:00 · portaria','Ronda 10:00 · perímetro','Ronda 14:00 · docas','Ronda 18:00 · pátio'),audit:L('Postos e efetivo','Apresentação e uniforme','Procedimentos em uso','Equipamentos do posto'),
 pops:L('POP · Controle de acesso de veículos','POP · Abertura e fechamento de docas','POP · Ronda perimetral','MNP · Manual de normas e procedimentos','POP · Atendimento a ocorrências'),
 risco:['doc'],diag:['doc'],ocorr:L('Acesso indevido · registrado','Veículo sem cadastro · tratado','Alarme perimetral · verificado'),sinis:L('Acionamento de ambulância','Colisão no pátio','Registro e comunicação'),
 entorno:['map'],follow:L('Câmera sem imagem · aguardando manutenção','Cerca do setor B · proposta enviada','Iluminação da doca · concluído'),
 avisos:L('Follow-ups vencidos','Teste semanal pendente','Mapa do dia não enviado'),nota:['das',87,''],cliente:['das',90,'%'],pdf:['doc'],v360:['doc'],
 Peq:['cam'],Ppe:['ros'],Ppr:L('Teste Semanal','Ronda Diária','POPs e MNP','Análise de Risco','Follow-ups')
};
export function previaU3D(id){var p=PREVIAS_U3D[id];if(!p)return '';var t=p[0],h='';
 if(t==='ros'){for(var i=0;i<6;i++)h+='<i style="animation-delay:'+(i*.5)+'s"></i>';h='<div class="ros">'+h+'</div>'}
 else if(t==='lis'){var it=p[1].concat(p[1]);h='<div class="lis">'+it.map(function(x){return '<div>'+x+'</div>'}).join('')+'</div>'}
 else if(t==='das'){var v=p[1],o=Math.round(176*(1-Math.min(100,v)/100));h='<div class="das"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="5"/><circle class="f" cx="32" cy="32" r="28" fill="none" stroke="#ff5a5f" stroke-width="5" stroke-linecap="round" transform="rotate(-90 32 32)" style="--o:'+o+'"/></svg><b>'+v+(p[2]==='%'?'%':'')+'</b><div class="bar">'+[.5,.8,.6,1,.7,.9].map(function(k,j){return '<i style="height:'+Math.round(k*100)+'%;animation-delay:-'+(j*.4)+'s"></i>'}).join('')+'</div></div>'}
 else if(t==='doc'){h='<div class="doc">'+[0,1,2].map(function(){return '<u><i></i><i></i><i></i><i></i><i></i></u>'}).join('')+'</div>'}
 else if(t==='cam'){h='<div class="cam"><i></i><i></i><i></i><i></i></div>'}
 else if(t==='map'){h='<div class="map"><svg viewBox="0 0 300 92" preserveAspectRatio="none"><path d="M20 70 L70 22 L150 30 L230 16 L280 60 L190 78 L90 80 Z"/><circle cx="70" cy="22" r="4"/><circle cx="230" cy="16" r="4" style="animation-delay:-.5s"/><circle cx="190" cy="78" r="4" style="animation-delay:-1s"/></svg></div>'}
 else if(t==='sta'){h='<div class="sta">'+p[1].map(function(x){return '<span>'+x+'</span>'}).join('')+'</div>'}
 return '<div class="u3-pv" data-pv="'+t+'">'+h+'<s>ilustração</s></div>'}
// 25/11/2026 (Marcio): o núcleo não é vazio e o zoom é infinito. Aproximar do núcleo MOKED leva às ÁREAS (MokLog, MokPat…);
// aproximar de uma área leva ao SIS dela (pilares e módulos), cujo núcleo leva às áreas de novo. Afastar além do limite sobe um nível.
export const AREAS_U3D = [["moklog","Log","Condomínios logísticos",1],["mokpat","Pat","Patrimonial",1],["mokvip","Vip","Executivos e eventos",0],["mokres","Res","Residencial",0],["mokimp","Imp","Implantação",1],["moktec","Tec","Tecnologia",0]];
// Modo cliente (25/11/2026): dados.cliente = { nome, itens:[{ id, g, nome, linhas:[texto], acoes:[{ id, rotulo, principal }] }] } monta um único
// mundo com o que o cliente tem disponível; aoAcao(itemId, acaoId) executa (abrir PDF, ir para a tela) e aoInicio() volta para a área dele.
export function iniciarUniverso3D({ raiz, dados, aoAcao, aoInicio, win = typeof window !== "undefined" ? window : null }) {
if (!raiz || !win || !dados) return null;
// Sonda em um canvas à parte (não gasta o contexto do canvas de verdade nem suja o console onde não há WebGL).
try { var sonda = raiz.ownerDocument.createElement("canvas"), gl0 = sonda.getContext && (sonda.getContext("webgl2") || sonda.getContext("webgl")); if (!gl0 || typeof gl0.getShaderPrecisionFormat !== "function") return null; } catch (e) { return null; }
var el = raiz.ownerDocument.createElement("div"); el.className = "u3d"; el.setAttribute("data-testid", "universo-3d");
el.innerHTML = "<style>" + CSS_U3D + "</style>" + HTML_U3D(dados.MODS.length);
raiz.appendChild(el);
var CLI=dados.cliente||null;if(CLI)el.classList.add('cli');
function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return '&#'+c.charCodeAt(0)+';'})}
var MODS=dados.MODS,LIG=dados.LIG,AREAS=dados.AREAS||AREAS_U3D,TAU=Math.PI*2,MAXD=34;
var COR={eq:0x9aa7c7,pe:0x69c3ff,pr:0xffd766,out:0xff5a5f,c:0xff3b40,ar:0xff5a5f,mini:0xffc9c2,eu:0xffffff,topo:0xff3b40};
var NOME={eq:'EQUIPAMENTOS',pe:'PESSOAS',pr:'PROCEDIMENTOS',out:'ENTREGA',c:'NÚCLEO',ar:'ÁREA MOKED',eu:'VOCÊ',topo:'MOKED'};
var $=function(i){return el.querySelector('#u3-'+i)},app=el,canvas=$('gl'),renderer;
try{renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:true,powerPreference:'high-performance'})}catch(e){renderer=null}
if(!renderer||!renderer.getContext||!renderer.getContext()){el.remove();return null}
var PR=Math.min(win.devicePixelRatio||1,2);renderer.setPixelRatio(PR);renderer.setClearColor(0,0);
var scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(58,1,.01,400);
function V(x,y,z){return new THREE.Vector3(x,y,z)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function semente(s){return function(){s=(s*16807)%2147483647;return (s-1)/2147483646}}
/* ---------- material e texturas (compartilhados entre os mundos) ---------- */
var uni={time:{value:0},beat:{value:0},scale:{value:600}};
var mat=new THREE.ShaderMaterial({uniforms:uni,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
 vertexShader:'attribute float size;attribute float u;attribute float flow;attribute float base;attribute vec3 color;uniform float time;uniform float beat;uniform float scale;varying vec3 vC;varying float vA;'+
  'void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float z=max(.02,-mv.z);float f=fract(u-time*flow);float p=exp(-pow((f-.5)*7.,2.));'+
  'float core=1.-smoothstep(.9,1.3,length(position));p*=1.+beat*core*1.2;gl_PointSize=min(34.,size*(1.+p*1.6)*scale/z);'+
  'vA=(base+p)*clamp(1.7-z/26.,.3,1.)*smoothstep(.02,.12,z);vC=color*(1.+p*.9);gl_Position=projectionMatrix*mv;}',
 fragmentShader:'varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);gl_FragColor=vec4(vC,a*a*vA);}'});
function nuvem(){var P=[],C=[],SZ=[],UU=[],FL=[],BA=[],c=new THREE.Color();
 return {pt:function(v,col,size,u,flow,base){P.push(v.x,v.y,v.z);c.set(col);C.push(c.r,c.g,c.b);SZ.push(size);UU.push(u);FL.push(flow);BA.push(base)},
  fechar:function(){var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
   g.setAttribute('size',new THREE.Float32BufferAttribute(SZ,1));g.setAttribute('u',new THREE.Float32BufferAttribute(UU,1));g.setAttribute('flow',new THREE.Float32BufferAttribute(FL,1));g.setAttribute('base',new THREE.Float32BufferAttribute(BA,1));
   var o=new THREE.Points(g,mat);o.frustumCulled=false;return o}}}
function tx(fn,s){var k=raiz.ownerDocument.createElement('canvas');k.width=k.height=s||128;fn(k.getContext('2d'),k.width);return new THREE.CanvasTexture(k)}
var tGlow=tx(function(x,s){var g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.22,'rgba(255,255,255,.32)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,s,s)});
var tRing=tx(function(x,s){x.fillStyle='rgba(6,8,14,.82)';x.beginPath();x.arc(s/2,s/2,s*.4,0,TAU);x.fill();x.strokeStyle='#fff';x.lineWidth=s*.045;x.stroke()},256);
var tDia=tx(function(x,s){x.translate(s/2,s/2);x.rotate(Math.PI/4);x.fillStyle='rgba(6,8,14,.82)';x.strokeStyle='#fff';x.lineWidth=s*.05;var h=s*.29;x.fillRect(-h,-h,2*h,2*h);x.strokeRect(-h,-h,2*h,2*h)},256);
// Quem está acessando faz parte do universo: um ponto com a foto (translúcida) ou as iniciais, ligado ao MOKED e ao projeto.
var cvEu=raiz.ownerDocument.createElement('canvas');cvEu.width=cvEu.height=256;var tEu=new THREE.CanvasTexture(cvEu);
function pintaEu(img,nome){var x=cvEu.getContext('2d'),s=256;x.clearRect(0,0,s,s);x.save();x.beginPath();x.arc(s/2,s/2,s*.44,0,TAU);x.closePath();x.fillStyle='rgba(10,14,24,.9)';x.fill();x.clip();
 if(img){var k=Math.max(s/img.width,s/img.height),w=img.width*k,h=img.height*k;x.drawImage(img,(s-w)/2,(s-h)/2,w,h)}
 else{x.fillStyle='#fff';x.font='800 96px system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';var ini=String(nome||'?').trim().split(/\s+/).map(function(p){return p[0]}).slice(0,2).join('').toUpperCase();x.fillText(ini||'?',s/2,s/2+6)}
 x.restore();x.strokeStyle='#fff';x.lineWidth=8;x.beginPath();x.arc(s/2,s/2,s*.44,0,TAU);x.stroke();tEu.needsUpdate=true}
function fotoEu(url,nome){if(!url){pintaEu(null,nome);return}var im=new win.Image();im.onload=function(){pintaEu(im,nome)};im.onerror=function(){pintaEu(null,nome)};im.src=url}
function spr(t,col,sc,add){var m=new THREE.SpriteMaterial({map:t,color:col,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending});var s=new THREE.Sprite(m);s.scale.set(sc,sc,1);return s}
/* estrelas e poeira: ficam em todos os níveis */
(function(){var n=nuvem(),r=semente(7),i;for(i=0;i<1600;i++){var u=r()*2-1,a=r()*TAU,q=Math.sqrt(1-u*u),R=60+r()*120;n.pt(V(q*Math.cos(a)*R,u*R,q*Math.sin(a)*R),r()<.15?0xffb0a8:(r()<.3?0xa8c8ff:0xffffff),.5+r()*.9,r()*8,.03+r()*.05,.35)}
 for(i=0;i<420;i++)n.pt(V((r()-.5)*30,(r()-.5)*22,(r()-.5)*30),0xffc0b0,.05+r()*.05,r()*8,.05+r()*.06,.18);scene.add(n.fechar())})();
/* ---------- construção de um mundo ---------- */
var lbs=$('lbs'),hl=new THREE.Group();scene.add(hl);
function curva(L,t,o){var a=L.a.p,b=L.b.p,mid=a.clone().add(b).multiplyScalar(.5),len=a.distanceTo(b),dir=mid.lengthSq()>.01?mid.clone().normalize():V(0,1,0);
 var c=mid.add(dir.multiplyScalar(len*.22)),u=1-t;return (o||V()).set(u*u*a.x+2*u*t*c.x+t*t*b.x,u*u*a.y+2*u*t*c.y+t*t*b.y,u*u*a.z+2*u*t*c.z+t*t*b.z)}
function nucleo(n,rnd,esc){ // veias que nascem no centro e se ramificam + casca
 function veia(p0,d0,steps,size,gen){var p=p0.clone(),d=d0.clone(),ph=rnd();
  for(var i=0;i<steps;i++){var k=i/steps;n.pt(p.clone().multiplyScalar(esc),k<.35?0xffd9c8:(k<.7?0xff6a55:0xff2a35),size*esc*(1-k*.55),p.length()*2.2+ph,.5,.12);
   d.add(V(rnd()-.5,rnd()-.5,rnd()-.5).multiplyScalar(.5)).add(p.clone().normalize().multiplyScalar(.22)).normalize();
   p.add(d.clone().multiplyScalar(.024));if(p.length()>.93){p.setLength(.93);d.add(p.clone().normalize().multiplyScalar(-.9)).normalize()}
   if(gen<2&&i>8&&rnd()<.045)veia(p,d.clone().add(V(rnd()-.5,rnd()-.5,rnd()-.5)).normalize(),Math.round((steps-i)*.8),size*.8,gen+1)}}
 for(var i=0;i<46;i++){var d=V(rnd()-.5,rnd()-.5,rnd()-.5).normalize();veia(d.clone().multiplyScalar(.05),d,44,.03,0)}
 for(i=0;i<900;i++){var y=1-2*(i+.5)/900,rr=Math.sqrt(1-y*y),th=i*2.399963;n.pt(V(Math.cos(th)*rr,y,Math.sin(th)*rr).multiplyScalar(esc),0xff3b40,.022*esc,rnd()*6,.12+rnd()*.1,.1)}}
function construir(tipo,area){
 var M={tipo:tipo,area:area||null,nodes:[],byId:{},links:[],grupo:new THREE.Group()},rnd=semente(20261124+(area?area[0].length*131:0)+(tipo==='areas'?977:0)),n=nuvem(),tmp=V();
 function add(id,g,nome,desc,pos,r){var o={id:id,g:g,nome:nome,desc:desc,p:pos,r:r,rel:[]};M.nodes.push(o);M.byId[id]=o;return o}
 function liga(a,b,forte){var A=M.byId[a],B=M.byId[b];if(!A||!B)return;M.links.push({a:A,b:B,forte:forte});A.rel.push(B);B.rel.push(A)}
 if(tipo==='sis'){
  var cheio=!area||area[0]==='moklog';M.cheio=cheio;
  add('moked','c','MOKED','O núcleo do SIS⁺. Aproxime para entrar: dentro dele estão as áreas da Moked.',V(0,0,0),1);
  var PIL=[['eq','Equipamentos',-90,.9],['pe','Pessoas',30,-.6],['pr','Procedimentos',150,-.2]];
  PIL.forEach(function(p){var a=p[2]*Math.PI/180;add('P'+p[0],p[0],p[1],'Pilar do SIS⁺.',V(Math.cos(a)*5.2,p[3]-Math.sin(a)*1.6,Math.sin(a)*5.2),.5).pil=1;liga('moked','P'+p[0],1)});
  if(cheio){
   ['eq','pe','pr'].forEach(function(g){var c=M.byId['P'+g],ms=MODS.filter(function(m){return m[1]===g}),out=c.p.clone().normalize(),k=ms.length,ux=V(0,1,0).cross(out).normalize(),uy=out.clone().cross(ux).normalize();
    ms.forEach(function(m,i){var t=(i+.5)/k,ph=Math.acos(1-1.25*t),th=i*2.399963,rr=2.35+((i%3)-1)*.28;
     var d=out.clone().multiplyScalar(Math.cos(ph)).add(ux.clone().multiplyScalar(Math.sin(ph)*Math.cos(th))).add(uy.clone().multiplyScalar(Math.sin(ph)*Math.sin(th)));
     add(m[0],g,m[2],m[3],c.p.clone().add(d.multiplyScalar(rr)),.2);liga('P'+g,m[0],0)})});
   var OP=[[40,34],[-28,-12],[205,-38],[118,-46],[168,30]];
   MODS.filter(function(m){return m[1]==='out'}).forEach(function(m,i){var o=OP[i%OP.length],a=o[0]*Math.PI/180,b=o[1]*Math.PI/180,R=9.6;add(m[0],'out',m[2],m[3],V(Math.cos(b)*Math.cos(a)*R,Math.sin(b)*R,Math.cos(b)*Math.sin(a)*R),.34)});
   LIG.forEach(function(l){liga(l[0],l[1],0)})}
  nucleo(n,rnd,1);
  // as áreas, pequenas, já aparecem dentro do núcleo
  AREAS.forEach(function(a,i){var y=1-2*(i+.5)/AREAS.length,q=Math.sqrt(1-y*y),th=i*2.399963,o=add('m_'+a[0],'mini','Mok <em>'+a[1]+'</em>','',V(Math.cos(th)*q*.52,y*.52,Math.sin(th)*q*.52),.05);o.mini=1})
 }else if(tipo==='cli'){
  add('moked','c',CLI.nome,'',V(0,0,0),1);
  CLI.itens.forEach(function(it,i){var k=CLI.itens.length,y=k>1?1-2*(i+.5)/k:0,q=Math.sqrt(1-y*y),th=i*2.399963+.4,o=add(it.id,it.g||'out',it.nome,'',V(Math.cos(th)*q*5.4,y*3.6,Math.sin(th)*q*5.4),.42);o.item=it;liga('moked',it.id,1)});
  CLI.itens.forEach(function(it,i){if(CLI.itens.length>2)liga(it.id,CLI.itens[(i+1)%CLI.itens.length].id,0)});
  // o cliente (ou consultor) e a MOKED fazem parte do mesmo universo, ligados ao projeto
  var topo=add('topo','topo','MOKED','',V(-1.5,6.4,-7.5),.9);topo.item={id:'topo',nome:'MOKED · '+(CLI.divisao||'MokLog'),linhas:['Você está em: Moked › '+(CLI.divisao||'MokLog')+' › '+CLI.nome,'O projeto faz parte do SIS⁺ da Moked: equipamentos, pessoas e procedimentos ligados.'],acoes:[]};
  var eu=add('eu','eu',(CLI.eu&&CLI.eu.nome)||'Você','',V(4.6,3.1,4.2),.62);eu.item={id:'eu',nome:(CLI.eu&&CLI.eu.nome)||'Você',linhas:['É você neste universo, ligado à Moked e ao projeto.','A foto fica guardada só neste aparelho.'],acoes:[{id:'foto',rotulo:'Escolher foto',principal:true},{id:'sem-foto',rotulo:'Remover foto'}]};
  liga('topo','moked',1);liga('eu','moked',1);liga('eu','topo',0);fotoEu(CLI.eu&&CLI.eu.foto,eu.nome);
  nucleo(n,rnd,1)
 }else{
  add('moked','c','MOKED','O centro das áreas. Afaste para voltar ao universo do SIS⁺.',V(0,0,0),.6);
  AREAS.forEach(function(a,i){var y=1-2*(i+.5)/AREAS.length,q=Math.sqrt(1-y*y),th=i*2.399963+.6,o=add(a[0],'ar','Mok'+a[1],a[2],V(Math.cos(th)*q*5.6,y*4.4,Math.sin(th)*q*5.6),.5);o.area=a;o.ativo=!!a[3];liga('moked',a[0],1)});
  AREAS.forEach(function(a,i){liga(a[0],AREAS[(i+1)%AREAS.length][0],0)});
  nucleo(n,rnd,.6)}
 M.links.forEach(function(L){var k=Math.max(18,Math.round(L.a.p.distanceTo(L.b.p)*7)),col=L.forte?0xff4a4f:(L.a.g==='out'||L.b.g==='out'||L.b.g==='ar'?0xff6a6f:COR[L.b.g]||0xffffff),ph=rnd();
  for(var i=0;i<=k;i++){var t=i/k;curva(L,t,tmp);n.pt(tmp,col,L.forte?.075:.05,t*(L.forte?2:1.3)+ph,L.forte?.42:.24+rnd()*.1,L.forte?.3:.16)}});
 M.grupo.add(n.fechar());
 M.nodes.forEach(function(o){var col=o.g==='ar'&&!o.ativo?0x8b94a8:COR[o.g];
  if(o.g==='c'){o.glow=spr(tGlow,0xff2a30,5.4*o.r,true);o.glow.material.opacity=.55;o.glow.position.copy(o.p);M.grupo.add(o.glow)}
  else{o.glow=spr(tGlow,col,o.r*5.2,true);o.base=o.pil||o.g==='ar'||o.g==='topo'?.5:.34;o.glow.material.opacity=o.base;o.glow.position.copy(o.p);M.grupo.add(o.glow);
   if(!o.mini){o.ring=spr(o.g==='eu'?tEu:(o.g==='out'?tDia:tRing),col,o.r*2.3,false);o.ring.position.copy(o.p);o.ring.renderOrder=2;M.grupo.add(o.ring)}}
  var e=raiz.ownerDocument.createElement('div');e.className='u3-lb'+(o.g==='c'?' c':o.pil?' p':o.g==='out'?' o':o.mini?' m':(o.g==='ar'||o.g==='eu'||o.g==='topo')?' a':'');
  e.innerHTML=tipo==='cli'?(o.g==='c'?esc(o.nome)+'<small>SEU PROJETO</small>':o.g==='topo'?'MOKED<small>'+esc(CLI.divisao||'MokLog')+'</small>':o.g==='eu'?esc(o.nome)+'<small>VOCÊ</small>':esc(o.nome)):o.g==='c'?'MOKED<small>'+(tipo==='sis'?'SIS⁺':'ÁREAS')+'</small>':o.g==='ar'?'Mok <em>'+o.area[1]+'</em><small>'+o.desc+(o.ativo?'':' · em breve')+'</small>':o.nome;lbs.appendChild(e);o.el=e});
 scene.add(M.grupo);return M}
function desfazer(M){if(!M)return;scene.remove(M.grupo);M.grupo.traverse(function(o){if(o.isPoints)o.geometry.dispose();else if(o.isSprite)o.material.dispose()});M.nodes.forEach(function(o){if(o.el)o.el.remove()})}
/* ---------- estado ---------- */
var mundo=null,nivel=0,trava=0,yawT=null,pitchT=null,W=1,H=1,yaw=.5,pitch=.22,dist=19,dT=19,tgt=V(0,0,0),tT=V(0,0,0),vy=0,vp=0,sel=null,tocou=false,ocioso=0,DFIT=19;
function realce(n){while(hl.children.length){var c=hl.children[0];hl.remove(c);c.geometry.dispose();c.material.dispose()}if(!n)return;mundo.links.forEach(function(L){if(L.a!==n&&L.b!==n)return;var pts=[];for(var i=0;i<=30;i++)pts.push(curva(L,i/30).clone());
 hl.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false})))})}
function painel(){if(mundo.tipo==='cli'){$('onde').textContent='Moked › '+(CLI.divisao||'MokLog')+' › '+CLI.nome;return}var s=mundo.tipo==='sis';$('leg').style.display=s?'':'none';
 $('cnt').innerHTML=s?(mundo.cheio?'<b>'+MODS.length+'</b>módulos<br>conectados':'<b>3</b>pilares<br>módulos em construção'):'<b>'+AREAS.length+'</b>áreas<br>Moked';
 $('onde').textContent=s?(mundo.area?'Moked › Áreas › Mok'+mundo.area[1]+' · SIS⁺':'Moked · SIS⁺'):'Moked › Áreas';
 $('hint').textContent=s?'aproxime do núcleo para entrar nas áreas · afaste para sair':'aproxime de uma área para entrar · afaste para sair'}
// modo: 'entra' chega de longe e mergulha; 'sai' reaparece perto do ponto de onde saiu e recua
function trocar(tipo,area,modo,perto){fechar();desfazer(mundo);mundo=construir(tipo,area);trava=.9;yawT=pitchT=null;vy=vp=0;
 var w=$('warp');w.classList.remove('on');void w.offsetWidth;w.classList.add('on');
 var alvo=tipo==='sis'?DFIT:DFIT*.6;
 if(modo==='entra'){tgt.set(0,0,0);tT.set(0,0,0);dist=alvo*2.1;dT=alvo}
 else{var p=perto&&mundo.byId[perto]?mundo.byId[perto].p:V(0,0,0);tgt.copy(p);tT.set(0,0,0);dist=.7;dT=alvo}
 painel()}
function entrarAreas(){nivel++;trocar('areas',null,'entra')}
function entrarSis(a){nivel++;trocar('sis',a,'entra')}
function subir(){nivel--;if(mundo.tipo==='sis')trocar('areas',null,'sai',mundo.area?mundo.area[0]:'moked');else trocar('sis',null,'sai','moked')}
function zoom(f){toque();if(trava>0)return;if(!CLI&&f>1&&dT>=MAXD-.01&&dist>MAXD-3){subir();return}dT=clamp(dT*f,.12,MAXD)}
function resize(){W=app.clientWidth||1;H=app.clientHeight||1;renderer.setSize(W,H,false);cam.aspect=W/H;cam.fov=W<H?62:50;cam.updateProjectionMatrix();uni.scale.value=H*PR/(2*Math.tan(cam.fov*Math.PI/360));DFIT=W<H?31:19;if(!tocou){dist=dT=DFIT}}
win.addEventListener('resize',resize);resize();
mundo=construir(CLI?'cli':'sis',null);painel();
// chegada do cliente: nasce junto ao MOKED e é levado até o projeto dele
if(CLI){var tp=mundo.byId.topo;tgt.copy(tp.p);tT.copy(tp.p);dist=2.2;dT=4.5;tocou=true;yaw=.2;pitch=.3;win.setTimeout(function(){if(vivo&&!sel){tT.set(0,0,0);dT=DFIT*.6}},1500)}
if(CLI){var faixa=$('itens');CLI.itens.forEach(function(it){var b=raiz.ownerDocument.createElement('button');b.type='button';b.setAttribute('data-item',it.id);var d=raiz.ownerDocument.createElement('i');d.style.background='#'+('000000'+(COR[it.g]||COR.out).toString(16)).slice(-6);b.appendChild(d);b.appendChild(raiz.ownerDocument.createTextNode(it.nome));b.onclick=function(){abrir(mundo.byId[it.id])};faixa.appendChild(b)});
 $('ini').onclick=function(){if(aoInicio)aoInicio()}}
var ptr={},pin0=0,d0=0,lx=0,ly=0,lt=0,mv=0,pinF=1;
app.addEventListener('pointerdown',function(e){if(e.target.closest('button,#u3-card'))return;ptr[e.pointerId]={x:e.clientX,y:e.clientY};var ids=Object.keys(ptr);if(ids.length===2){var a=ptr[ids[0]],b=ptr[ids[1]];pin0=Math.hypot(a.x-b.x,a.y-b.y);d0=dT;pinF=1}
 lx=e.clientX;ly=e.clientY;lt=win.performance.now();mv=0;vy=vp=0;yawT=pitchT=null;toque();try{app.setPointerCapture(e.pointerId)}catch(_){}});
app.addEventListener('pointermove',function(e){if(!ptr[e.pointerId])return;ptr[e.pointerId]={x:e.clientX,y:e.clientY};var ids=Object.keys(ptr);
 if(ids.length>=2){var a=ptr[ids[0]],b=ptr[ids[1]];if(pin0>0&&trava<=0){var f=pin0/Math.hypot(a.x-b.x,a.y-b.y);if(!CLI&&f>pinF*1.25&&dT>=MAXD-.01&&dist>MAXD-3){pin0=0;subir()}else{dT=clamp(d0*f,.12,MAXD);if(dT<MAXD-.01)pinF=f}}mv=99;lx=e.clientX;ly=e.clientY;return}
 var now=win.performance.now(),dx=e.clientX-lx,dy=e.clientY-ly,dt=Math.max(8,now-lt),k=.0052;mv+=Math.abs(dx)+Math.abs(dy);
 yaw-=dx*k;pitch=clamp(pitch+dy*k,-1.45,1.45);vy=.7*vy+.3*(-dx*k/dt*1000);vp=.7*vp+.3*(dy*k/dt*1000);lx=e.clientX;ly=e.clientY;lt=now});
function solta(e){if(!ptr[e.pointerId])return;delete ptr[e.pointerId];var ids=Object.keys(ptr);if(ids.length){lx=ptr[ids[0]].x;ly=ptr[ids[0]].y;pin0=0;return}
 if(mv<8){var n=acha(e.clientX,e.clientY);if(n)abrir(n);else fechar()}}
app.addEventListener('pointerup',solta);app.addEventListener('pointercancel',solta);
app.addEventListener('wheel',function(e){e.preventDefault();zoom(Math.exp(clamp(e.deltaY,-120,120)*.0016))},{passive:false});
function toque(){ocioso=0;if(!tocou){tocou=true}}
var pv=V();
function tela(n){pv.copy(n.p).project(cam);return{x:(pv.x*.5+.5)*W,y:(-pv.y*.5+.5)*H,z:pv.z}}
function acha(x,y){var best=null,bd=1e9;mundo.nodes.forEach(function(n){if(n.mini)return;var s=tela(n);if(s.z>1)return;var d=Math.hypot(s.x-x,s.y-y),lim=n.g==='c'||n.g==='ar'?46:30;if(d<lim&&d<bd){bd=d;best=n}});return best}
function abrirItem(n){var c=$('card'),D=raiz.ownerDocument,it=n.item;c.textContent='';
 function no(tag,cls,txt){var e=D.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;c.appendChild(e);return e}
 var k=no('div','k',NOME[n.g]||'');k.style.color='#'+('000000'+(COR[n.g]||COR.out).toString(16)).slice(-6);no('h2','',it.nome);
 (it.linhas||[]).forEach(function(l){no('div','ln',l)});
 if((it.acoes||[]).length){var ac=no('div','ac');it.acoes.forEach(function(a){var b=D.createElement('button');b.type='button';b.textContent=a.rotulo;if(a.principal)b.className='pri';b.setAttribute('data-acao',a.id);b.onclick=function(){if(aoAcao)aoAcao(it.id,a.id)};ac.appendChild(b)})}
 c.classList.add('on');Array.prototype.forEach.call(el.querySelectorAll('#u3-itens button'),function(b){b.classList.toggle('on',b.getAttribute('data-item')===it.id)})}
function abrir(n){toque();sel=n;tT.copy(n.p);dT=n.g==='c'?3.2:(n.pil||n.g==='ar'?8:6.5);realce(n);
 // olha o módulo de fora para dentro, um pouco de lado, para o pilar não ficar atrás do nome
 if(n.g!=='c'){var dir=n.p.clone().normalize();vy=vp=0;yawT=Math.atan2(dir.x,dir.z)+.55;pitchT=clamp(Math.asin(dir.y)+.25,-1.2,1.2)}
 if(n.item){abrirItem(n);return}
 if(CLI){fechar();return}
 var h='<div class="k" style="color:#'+('000000'+COR[n.g].toString(16)).slice(-6)+'">'+NOME[n.g]+'</div><h2>'+n.nome+'</h2>'+previaU3D(n.id)+'<p>'+n.desc+(n.g==='ar'&&!n.ativo?' Em breve no app.':'')+'</p>';
 if(n.g==='ar')h+='<button class="ir" data-ir="sis">Entrar em '+n.nome+' ›</button>';
 else if(n.g==='c')h+='<button class="ir" data-ir="'+(mundo.tipo==='sis'?'areas':'sobe')+'">'+(mundo.tipo==='sis'?'Entrar no núcleo ›':'Voltar ao SIS⁺ ›')+'</button>';
 else{var rel=n.rel.filter(function(r){return r.g!=='c'}).slice(0,8);if(rel.length){h+='<div class="ch"><em>LIGADO A</em>';rel.forEach(function(r){h+='<button data-id="'+r.id+'">'+r.nome+'</button>'});h+='</div>'}}
 var c=$('card');c.innerHTML=h;c.classList.add('on');
 Array.prototype.forEach.call(c.querySelectorAll('button'),function(b){b.onclick=function(){var ir=b.getAttribute('data-ir');if(ir==='sis')entrarSis(n.area);else if(ir==='areas')entrarAreas();else if(ir==='sobe')subir();else abrir(mundo.byId[b.getAttribute('data-id')])}})}
function fechar(){sel=null;realce(null);$('card').classList.remove('on');if(CLI)Array.prototype.forEach.call(el.querySelectorAll('#u3-itens button'),function(b){b.classList.remove('on')})}
$('zi').onclick=function(){zoom(.62)};$('zo').onclick=function(){zoom(1/.62)};
$('zf').onclick=function(){toque();fechar();tT.set(0,0,0);dT=mundo.tipo==='sis'?DFIT:DFIT*.6};
$('zn').onclick=function(){toque();fechar();tT.set(0,0,0);dT=mundo.tipo==='sis'?.3:(CLI?2.6:DFIT)};
/* ---------- ECG ---------- */
var ecg=$('ecg').getContext('2d');
function batida(t){var f=(t%1.25)/1.25;return Math.exp(-Math.pow((f-.08)*26,2))+.7*Math.exp(-Math.pow((f-.3)*22,2))}
function onda(f){return Math.exp(-Math.pow((f-.3)*60,2))*1.0-Math.exp(-Math.pow((f-.34)*70,2))*.35+Math.exp(-Math.pow((f-.52)*16,2))*.22+Math.exp(-Math.pow((f-.14)*22,2))*.12}
function desenhaEcg(t){ecg.clearRect(0,0,440,92);ecg.lineWidth=2.4;ecg.strokeStyle='#ff5a5f';ecg.shadowColor='#ff3b40';ecg.shadowBlur=10;ecg.beginPath();for(var x=0;x<=440;x+=3){var f=((x/440)*2.4-t/1.25)%1;if(f<0)f+=1;var y=62-onda(f)*46;x?ecg.lineTo(x,y):ecg.moveTo(x,y)}ecg.stroke()}
/* ---------- laço ---------- */
var clock=new THREE.Clock(),ecgT=0,vivo=true,raf=0;
function frame(){if(!vivo)return;raf=win.requestAnimationFrame(frame);var dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
 ocioso+=dt;trava=Math.max(0,trava-dt);if(!Object.keys(ptr).length){yaw+=vy*dt;pitch=clamp(pitch+vp*dt,-1.45,1.45);var f=Math.exp(-dt*2.4);vy*=f;vp*=f;if(ocioso>3&&!sel)yaw+=dt*.045}
 if(yawT!==null){var dy=((yawT-yaw)%TAU+TAU*1.5)%TAU-Math.PI;yaw+=dy*(1-Math.exp(-dt*3.5));pitch+=(pitchT-pitch)*(1-Math.exp(-dt*3.5));if(Math.abs(dy)<.004)yawT=null}
 dist+=(dT-dist)*(1-Math.exp(-dt*(trava>0?2.2:4.5)));tgt.lerp(tT,1-Math.exp(-dt*4));
 // zoom infinito: chegar bem perto do núcleo (SIS) ou de uma área (Áreas) atravessa para o próximo nível
 if(trava<=0){if(mundo.tipo==='sis'&&dist<.42&&tgt.length()<.5){entrarAreas()}else if(mundo.tipo==='areas'&&sel&&sel.g==='ar'&&dist<.75&&tgt.distanceTo(sel.p)<.5){entrarSis(sel.area)}}
 var cp=Math.cos(pitch);cam.position.set(tgt.x+Math.sin(yaw)*cp*dist,tgt.y+Math.sin(pitch)*dist,tgt.z+Math.cos(yaw)*cp*dist);cam.lookAt(tgt);
 var b=batida(t);uni.time.value=t;uni.beat.value=b;
 var core=mundo.nodes[0],dc=cam.position.length();core.glow.scale.setScalar(5.4*core.r*(1+b*.09));core.glow.material.opacity=clamp((dc-1.1*core.r)/3,0,1)*(.5+b*.25);
 var perto=mundo.tipo==='sis'&&dc<2.6;$('vit').classList.toggle('on',perto);ecgT+=dt;if(perto&&ecgT>.033){ecgT=0;desenhaEcg(t)}
 renderer.render(scene,cam);
 for(var i=0;i<mundo.nodes.length;i++){var n=mundo.nodes[i],s=tela(n),d=cam.position.distanceTo(n.p),e=n.el,vis=s.z<1&&s.x>-80&&s.x<W+80&&s.y>-40&&s.y<H+40;
  var show=n.g==='c'?(d>3.4*n.r?1:0):n.mini?clamp((4.2-dc)/1.4,0,1):(n.pil||n.g==='out'||n.g==='ar'||n.g==='eu'||n.g==='topo'||n.item?clamp(1.6-d/30,.35,1):(sel&&(n===sel||sel.rel.indexOf(n)>=0)?1:clamp((11-d)/4,0,1)));
  if(n.mini){n.glow.material.opacity=.75*clamp((4.6-dc)/1.6,0,1)*(.7+.3*b)}
  else if(n.ring){var pu=n===sel?1+.12*Math.sin(t*5):1;n.ring.scale.setScalar(n.r*2.3*pu);var nf=clamp((d-.8)/1.6,0,1);n.ring.material.opacity=n.g==='eu'?nf*.72:nf;n.glow.material.opacity=n.base*nf}
  if(!vis||show<=.02){if(e._o!==0){e.style.opacity=0;e._o=0}continue}
  var off=n.g==='c'?0:(n.r*uni.scale.value/PR/Math.max(.2,d))*1.25+6;
  e.style.opacity=show.toFixed(2);e._o=show;e.style.transform='translate3d('+s.x.toFixed(1)+'px,'+(s.y+off).toFixed(1)+'px,0) translate(-50%,'+(n.g==='c'?'-50%':'0')+')'}}
frame();
return {
 nos:function(){return mundo.nodes.length},
 foto:function(url){if(CLI&&mundo.byId.eu)fotoEu(url,mundo.byId.eu.nome)},
 onde:function(){return {tipo:mundo.tipo,area:mundo.area?mundo.area[0]:null,nivel:nivel}},
 abrir:function(id){if(mundo.byId[id])abrir(mundo.byId[id])},
 entrarAreas:entrarAreas,entrarSis:function(id){var a=AREAS.filter(function(x){return x[0]===id})[0];if(a)entrarSis(a)},subir:subir,zoom:zoom,
 ver:function(y,p,d){tocou=true;yawT=null;yaw=y;pitch=p;dist=dT=d},
 pausar:function(){vivo=false;win.cancelAnimationFrame(raf)},
 retomar:function(){if(vivo)return;vivo=true;clock.getDelta();resize();frame()},
 parar:function(){vivo=false;win.cancelAnimationFrame(raf);win.removeEventListener('resize',resize);try{desfazer(mundo);mat.dispose();renderer.dispose();if(renderer.forceContextLoss)renderer.forceContextLoss()}catch(e){/* já liberado */}el.remove()}
};
}
