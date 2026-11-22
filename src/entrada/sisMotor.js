/* eslint-disable */
// Abertura SIS⁺ (Marcio, 21/11/2026): motor da órbita em 3D, segurar ícone/MOKED, explosão, História da Moked e Universo SIS⁺.
// Código imperativo (canvas, WebAudio e ponteiros) herdado do protótipo aprovado e testado em celular e PC; por isso fica fora do lint.
// Contrato: iniciarSIS(raiz, host, { onFim }) monta tudo dentro de `raiz` (Shadow DOM do host) e devolve destruir().
import { ICONES_SIS, COR_ICONE } from "./iconesSIS";
import { FLAG_IL } from "./sisBandeira";
import { HTML_SIS } from "./sisHtml";
import { CSS_SIS } from "./sisCss";

export function iniciarSIS(root, host, opc) {
opc = opc || {};
var morto = false, timers = [];
function after(fn, ms) { var id = setTimeout(function () { if (!morto) fn(); }, ms); timers.push(id); return id; }
var NOCTX = new Proxy(function () {}, { get: function (t, k) { return k === Symbol.toPrimitive ? function () { return 0; } : NOCTX; }, set: function () { return true; }, apply: function () { return NOCTX; } });
function ctx2d(c) { var g = null; try { g = c.getContext('2d'); } catch (e) { g = null; } return g || NOCTX; }
var fino = false; try { fino = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches); } catch (e) { fino = false; }
function tx(toque, mouse) { return fino ? mouse : toque; }
root.innerHTML = '<style>' + CSS_SIS + '</style>' + HTML_SIS;
var box = root.querySelector('#sisx');
var ICONES=ICONES_SIS, COR=COR_ICONE;
var $=function(s,r){return (r||root).querySelector(s)}, $$=function(s,r){return Array.prototype.slice.call((r||root).querySelectorAll(s))};
var NS='http://www.w3.org/2000/svg';
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};
var reduz=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function vibra(n){try{if(navigator.vibrate)navigator.vibrate(n)}catch(e){}}

/* ═════ dados dos ícones (mesmos 11 do app + o que cada um alimenta) ═════ */
var NOS=[
 {k:'cftv',t:'CFTV',d:'Câmeras e tempo de gravação',g:'eq',r:0,x:'Imagem que vira evidência: quantas câmeras o projeto tem, se estão gravando e por quanto tempo.',f:['Tempo de gravação','Câmeras e bodycam','Ronda Virtual']},
 {k:'peri',t:'Perímetro',d:'Cerca, sensores e zonas',g:'eq',r:0,x:'A linha que separa o parque do mundo: cobertura diária do perímetro, cerca e sensores.',f:['Teste Perimetral','Zonas e sensores']},
 {k:'acesso',t:'Controle de acesso',d:'Portarias, catracas e credenciais',g:'eq',r:0,x:'Quem entra, quando e por onde: portarias, catracas, credenciais, horários e chaves.',f:['Controle de acesso','Horários de acesso','Chaves e acessos com falha']},
 {k:'ilum',t:'Iluminação',d:'Pontos e quadrantes',g:'eq',r:1,x:'Pontos de luz por quadrante e as ocorrências de energia que deixam o parque às escuras.',f:['Iluminação e quadrantes','Energia · ocorrências']},
 {k:'panico',t:'Botão de pânico',d:'Acionamento e resposta',g:'eq',r:1,x:'O botão que precisa funcionar no pior dia: teste de acionamento e tempo de resposta.',f:['Teste Semanal','Ocorrências']},
 {k:'cco',t:'CCO',d:'Central de monitoramento',g:'eq',r:1,x:'O cérebro da operação: acessos, rondas virtuais e relatórios do dia.',f:['Acesso CCO','Ronda Virtual','Relatórios do CCO']},
 {k:'central',t:'Central Moked online',d:'Central remota, monitoramento 24h',g:'eq',r:1,x:'A central remota da MOKED, sempre ligada, apoiando a operação local.',f:['Monitoramento 24h','Ronda Virtual']},
 {k:'radio',t:'Rádios HT',d:'Comunicação da equipe',g:'eq',r:2,x:'Comunicação direta da equipe em campo, controlada como qualquer outro equipamento.',f:['Inventário de equipamentos','Teste Semanal']},
 {k:'pessoas',t:'Pessoas',d:'Equipe, treinamento e maturidade',g:'pe',r:2,x:'Quem executa: cadastro, treinamentos, maturidade da equipe e índice individual.',f:['Equipe','Mapa de Equipe','Índice individual','FV']},
 {k:'pop',t:'POPs',d:'Procedimentos operacionais padrão',g:'pr',r:2,x:'O jeito certo de fazer, escrito e verificável, por projeto.',f:['POPs por projeto','Teste Semanal']},
 {k:'mnp',t:'MNP',d:'Manual de normas e procedimentos',g:'pr',r:0,x:'O manual que sustenta a operação: normas e procedimentos do projeto.',f:['Manual de normas','Documentos por projeto']}
];
var COREG={eq:'#94a3b8',pe:'#7dd3fc',pr:'#fde68a',out:'#ff6a70'};
var NOMEG={eq:'Equipamentos',pe:'Pessoas',pr:'Procedimentos',out:'Entrega'};

/* ═════ ÓRBITA ═════ */
var sis=$('#sis'),corpo=$('#corpo'),fx=$('.sis-fx'),ghost=$('.sis-ghost'),prEl=$('#pr'),prC=$('#pr circle');
var ANEIS=[{tx:1.15,tz:0,k:1,v:.22},{tx:.3,tz:-.95,k:.8,v:-.28},{tx:-.95,tz:.65,k:.92,v:.18}];
var aL=$('.g-aL'),aP=$('.g-aP'),ticks=$('.g-ticks');
(function(){var tk='';for(var i=0;i<60;i++){var u=i*6*Math.PI/180,r1=i%5?126:121,r2=130;tk+='<line x1="'+(150+Math.sin(u)*r1).toFixed(2)+'" y1="'+(150-Math.cos(u)*r1).toFixed(2)+'" x2="'+(150+Math.sin(u)*r2).toFixed(2)+'" y2="'+(150-Math.cos(u)*r2).toFixed(2)+'" stroke="#fff" stroke-opacity="'+(i%5?.1:.22)+'" stroke-width="'+(i%5?1:2)+'"/>'}ticks.innerHTML=tk})();
function agulha(v){var t=v*1.8*Math.PI/180;function P(r,d){d=d||0;return[150+Math.sin(t+d)*r,150+Math.cos(t+d)*r]}var a=P(134),b=P(98,.07),c=P(98,-.07),h1=P(86),h2=P(120);aL.setAttribute('x1',h1[0]);aL.setAttribute('y1',h1[1]);aL.setAttribute('x2',h2[0]);aL.setAttribute('y2',h2[1]);aP.setAttribute('points',a.join(',')+' '+b.join(',')+' '+c.join(','))}
var aneisEl=ANEIS.map(function(){var p=document.createElementNS(NS,'path');p.setAttribute('fill','none');p.setAttribute('stroke','#ff1e27');p.setAttribute('stroke-opacity','.22');p.setAttribute('stroke-width','1');fx.appendChild(p);return p});
var linhas=[],pacotes=[],els=[];
NOS.forEach(function(n){var l=document.createElementNS(NS,'line');l.setAttribute('stroke','#ff1e27');l.setAttribute('stroke-width','.8');fx.appendChild(l);linhas.push(l);var c=document.createElementNS(NS,'circle');c.setAttribute('r','2');c.setAttribute('fill','#ff6a70');fx.appendChild(c);pacotes.push(c)});
var glow=document.createElement('div');glow.className='sis-glow';corpo.appendChild(glow);
var orb=document.createElement('div');orb.className='sis-orb';orb.innerHTML='<div><div class="sis-logo">MOK<b>E</b>D</div><small>SIS<sup style="color:#FF1E27">+</sup></small></div>';corpo.appendChild(orb);
NOS.forEach(function(n){var d=document.createElement('div');d.className='sis-nd '+n.g;d.setAttribute('data-no',n.k);d.style.setProperty('--ac',COR[n.k]||'#94a3b8');d.innerHTML='<svg viewBox="0 0 24 24">'+ICONES[n.k]+'</svg><svg class="rg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="100"></circle></svg>';corpo.appendChild(d);els.push(d)});
var rgs=els.map(function(e){return $('svg.rg circle',e)}),prog=NOS.map(function(){return 0}),lido=NOS.map(function(){return false});
var cont=[0,0,0];NOS.forEach(function(n){n.i=cont[n.r]++});NOS.forEach(function(n){n.a0=n.i/cont[n.r]*Math.PI*2+n.r*.7});
var W=0,H=0,cx=0,cy=0,R=0,F=0,N=0;
function medir(){W=host.clientWidth||window.innerWidth||390;H=host.clientHeight||window.innerHeight||800;cx=W/2;cy=H*.43;R=Math.min(W*.37,H*.27);F=R*3.6;N=Math.max(38,Math.min(62,R*.42));fx.setAttribute('viewBox','0 0 '+W+' '+H);var D=R*2/.903;ghost.style.width=ghost.style.height=D+'px';ghost.style.left=(cx-D/2)+'px';ghost.style.top=(cy-D/2)+'px';var od=R*.66;orb.style.width=orb.style.height=od+'px';orb.style.setProperty('--lf',Math.max(11,od*.17)+'px');els.forEach(function(e){e.style.width=e.style.height=N+'px'});corpo.style.transformOrigin=cx+'px '+cy+'px';var gd=od*4.6;glow.style.width=glow.style.height=gd+'px';glow.style.left=(cx-gd/2)+'px';glow.style.top=(cy-gd/2)+'px';var pd=od*1.28;prEl.style.width=prEl.style.height=pd+'px';prEl.style.left=(cx-pd/2)+'px';prEl.style.top=(cy-pd/2)+'px';if(uni)uniMedir();plMedir();bkMedir();fxMedir();cenaMedir()}
var uni=null;
var yaw=.5,pitch=.42,yv=0,pv=0,idle=0,arr=false,tRel=0,hot=-1,ultimo=0,foco=-1,velF=1,pausaOrb=false;
var cg={k:-1,ok:false},cc={on:false},ccP=0,pinP=0,pShown=-1,boom=null,nLido=0,DUR_I=.7,DUR_C=1.25;
function rx(p,a){var c=Math.cos(a),s=Math.sin(a);return[p[0],p[1]*c-p[2]*s,p[1]*s+p[2]*c]}
function ry(p,a){var c=Math.cos(a),s=Math.sin(a);return[p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c]}
function rz(p,a){var c=Math.cos(a),s=Math.sin(a);return[p[0]*c-p[1]*s,p[0]*s+p[1]*c,p[2]]}
function pj(p){var s=F/(F-p[2]);return{x:cx+p[0]*s,y:cy+p[1]*s,s:s,z:p[2]}}
function anel(ri,th){var A=ANEIS[ri],Rr=R*A.k;return rx(ry(rz(rx([Rr*Math.cos(th),Rr*Math.sin(th),0],A.tx),A.tz),yaw),pitch)}
var pos=[],raf=0,orbVivo=true,vsU=0,entrando=false;
function quadro(t){
  if(!orbVivo||morto)return;
  var dt=Math.min(.05,(t-(ultimo||t))/1000);ultimo=t;
  velF+=((foco>=0||pausaOrb||cg.k>=0||cc.on||boom?0:1)-velF)*Math.min(1,dt*5);
  var bp=boom?clamp((t-boom.t0)/900,0,1):0,ex=1+bp*bp*7;
  tRel+=dt*velF;
  if(!arr){yaw+=yv*dt;pitch+=pv*dt;yv*=Math.pow(.06,dt);pv*=Math.pow(.06,dt);if(Math.abs(yv)<.05&&Math.abs(pv)<.05){idle+=dt;if(idle>1.6&&!reduz&&foco<0)yaw+=.16*dt}else idle=0}
  ANEIS.forEach(function(a,ri){var d='';for(var s=0;s<=72;s++){var p=pj(anel(ri,s/72*Math.PI*2));d+=(s?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)}aneisEl[ri].setAttribute('d',d)});
  NOS.forEach(function(n,k){
    var th=n.a0+(reduz?0:tRel)*ANEIS[n.r].v,p=anel(n.r,th),s3=pj(p);pos[k]=s3;
    var dep=Math.max(0,Math.min(1,(p[2]+R)/(2*R))),e=els[k];
    var X=cx+(s3.x-cx)*ex,Y=cy+(s3.y-cy)*ex,esc=s3.s*(k===foco?1.22:1);
    if(k===cg.k){prog[k]=Math.min(1,prog[k]+dt/DUR_I);if(prog[k]>=1&&!cg.ok){cg.ok=true;completo(k)}}else if(prog[k]>0)prog[k]=Math.max(0,prog[k]-dt*3.2);
    if(prog[k]!==n.pg){n.pg=prog[k];var rc=rgs[k];rc.style.strokeDashoffset=(100-100*prog[k]).toFixed(1);rc.style.opacity=prog[k]>.01?1:0;e.classList.toggle('carga',prog[k]>.01&&prog[k]<1)}
    e.style.transform='translate('+(X-N/2).toFixed(1)+'px,'+(Y-N/2).toFixed(1)+'px) scale('+esc.toFixed(3)+')';
    e.style.opacity=((foco>=0&&k!==foco?.35:(.42+.58*dep))*(1-bp)).toFixed(2);e.style.zIndex=Math.round(s3.z+R*2)+(k===foco?500:0);
    var L=linhas[k];L.setAttribute('x1',cx);L.setAttribute('y1',cy);L.setAttribute('x2',X);L.setAttribute('y2',Y);L.setAttribute('stroke-opacity',((k===foco?.75:.08+.2*dep)*(1-bp)).toFixed(2));L.setAttribute('stroke-width',k===foco?'1.6':'.8');
    var ph=((t/2800)+k*.173)%1,pk=pacotes[k];pk.setAttribute('cx',cx+(X-cx)*ph);pk.setAttribute('cy',cy+(Y-cy)*ph);pk.setAttribute('opacity',(Math.sin(ph*Math.PI)*.9*(.3+.7*dep)*(1-bp)).toFixed(2))
  });
  if(!boom){
    if(cc.on&&!pinch&&!mergulhando){var pa=ccP;ccP=Math.min(1,ccP+dt/DUR_C);if((ccP>=.34&&pa<.34)||(ccP>=.67&&pa<.67))vibra(10);if(ccP>=1)explodir(t)}
    else if(ccP>0)ccP=Math.max(0,ccP-dt*2.4);
    var pe=Math.max(ccP,pinP);if(pe!==pShown){pShown=pe;setP(pe)}
  }
  var ow=parseFloat(orb.style.width)||0,amp=reduz?0:ccP*ccP*4,jx=(Math.random()-.5)*amp*2,jy=(Math.random()-.5)*amp*2;orb.style.zIndex=Math.round(R*2);orb.style.transform='translate('+(cx-ow/2+jx).toFixed(1)+'px,'+(cy-ow/2+jy).toFixed(1)+'px)'+(bp>0?' scale('+(1+bp*5).toFixed(2)+')':'');orb.style.opacity=(1-Math.max(0,(bp-.15)/.5)).toFixed(2);
  var ge=Math.max(ccP,pinP);glow.style.opacity=Math.min(1,(.28+ge*.32+(nLido/NOS.length)*.3)*(1-bp)).toFixed(2);glow.style.transform='scale('+(.8+ge*.45+bp*1.2).toFixed(3)+')';
  agulha(reduz?72:62+22*Math.sin(t/2300)+6*Math.sin(t/770));
  var plp=boom?(1-clamp((t-boom.t0)/1100,0,1)):ge;plasma(t,plp,boom?bp*2.2:0);bokeh(t,boom?1-bp:1,ge);
  var vs=boom?0:(cc.on?ccP:(cg.k>=0?prog[cg.k]:0));vs=Math.max(vs,boom?0:pinP);if(Math.abs(vs-vsU)>.01||(vs===0&&vsU!==0)){vsU=vs;cargaSom(vs,cc.on||pinP>0)}
  raf=requestAnimationFrame(quadro)
}
function perto(x,y){var m=-1,b=(N*.95)*(N*.95);pos.forEach(function(p,k){var d=(p.x-x)*(p.x-x)+(p.y-y)*(p.y-y);if(d<b&&p.z>-R*.2){b=d;m=k}});return m}
function dentroOrb(x,y,f){var od=(parseFloat(orb.style.width)||R*.66)*(f||.75);return Math.hypot(x-cx,y-cy)<=od}

/* cartão do ícone */
var card=$('#card');
function abrirCard(k){
  foco=k;sis.classList.add('foco');
  els.forEach(function(e,i){e.classList.toggle('hot',i===k)});
  var n=NOS[k];card.style.setProperty('--cc',COR[n.k]||'#94a3b8');
  $('#ck').textContent=({eq:'Equipamentos',pe:'Pessoas',pr:'Procedimentos'})[n.g];$('#ct').textContent=n.t;$('#cd').textContent=n.x;
  $('#cf').innerHTML=n.f.map(function(s){return '<span class="chip">'+s+'</span>'}).join('');
  card.classList.add('v');vibra(8)
}
function fecharCard(){foco=-1;sis.classList.remove('foco');els.forEach(function(e){e.classList.remove('hot')});card.classList.remove('v')}
$('#cx').addEventListener('click',function(e){e.stopPropagation();fecharCard()});
$('#ce').addEventListener('click',function(e){e.stopPropagation();entrar()});
$('#entrar').addEventListener('click',function(e){e.stopPropagation();entrar()});
var saiu=false;
function entrar(){if(saiu||morto)return;saiu=true;fecharCard();box.classList.add('saindo');after(function(){if(opc.onFim)opc.onFim()},reduz?0:560)}

/* carga dos ícones, explosão e entrada */
function atualizaHint(){dotsAtualiza();var h=$('#hint');h.textContent=nLido===0?tx('Segure o dedo num ícone','Clique e segure num ícone'):(nLido>=NOS.length?tx('Tudo descoberto · agora segure o MOKED','Tudo descoberto · agora clique e segure o MOKED'):nLido+' de '+NOS.length+tx(' · continue, ou segure o MOKED',' · continue, ou clique e segure o MOKED'));orb.style.setProperty('--heat',(nLido/NOS.length).toFixed(2));if(nLido===3)dica(tx('Dica: afaste dois dedos sobre o MOKED','Dica: role o mouse sobre o MOKED'))}
function completo(k){somPing();lido[k]=true;els[k].classList.add('lido');ignorar=true;abrirCard(k);vibra([12,30,16]);nLido=lido.filter(Boolean).length;atualizaHint()}
/* ── áudio sintetizado (só depois do primeiro toque) ── */
var AC=null,mestre=null,somOn=true,chO=null,chG=null,chF=null;
function audioIniciar(){if(AC)return;try{var C=window.AudioContext||window.webkitAudioContext;if(!C)return;AC=new C();mestre=AC.createGain();mestre.gain.value=somOn?.9:0;mestre.connect(AC.destination)}catch(e){AC=null}}
var audioOk=false;
function audioAcordar(){try{if(AC&&AC.state==='suspended')AC.resume();if(AC&&!audioOk){audioOk=true;var b=AC.createBuffer(1,1,22050),s=AC.createBufferSource();s.buffer=b;s.connect(AC.destination);s.start(0)}}catch(e){}}
var pend=null,pendT=0;
function audioPendente(){if(pend&&AC&&performance.now()-pendT<2600){var f=pend;pend=null;try{AC.resume().then(f)}catch(e){}}else pend=null}
function ruido(dur){var n=Math.floor(AC.sampleRate*dur),b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(var i=0;i<n;i++)d[i]=Math.random()*2-1;var s=AC.createBufferSource();s.buffer=b;return s}
function tom(f0,f1,dur,tipo,vol,atraso){if(!AC||!somOn||AC.state!=='running')return;try{var t=AC.currentTime+(atraso||0),o=AC.createOscillator(),g=AC.createGain();o.type=tipo||'sine';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(mestre);o.start(t);o.stop(t+dur+.05)}catch(e){}}
// 22/11/2026 (Marcio): sem o som da ignição (zumbido de carga e explosão). Ficam só o ping suave de cada cartão e o botão SOM.
function cargaSom(){}
function somPing(){tom(660,990,.28,'sine',.16);tom(990,1480,.34,'triangle',.07,.05)}
function somExplosao(){}
$('#som').addEventListener('click',function(e){e.stopPropagation();audioIniciar();audioAcordar();somOn=!somOn;this.classList.toggle('off',!somOn);try{if(mestre)mestre.gain.setTargetAtTime(somOn?.9:0,AC.currentTime,.02)}catch(_){}if(somOn)tom(520,780,.2,'sine',.12)});

/* ── plasma atrás do MOKED (cresce enquanto o dedo segura) ── */
var pl=$('#pl'),plc=ctx2d(pl),plLimpo=true,plSem=[];
for(var pi=0;pi<40;pi++)plSem.push({a:Math.random()*6.283,w:.6+Math.random()*1.4,f:Math.random()*6.283,l:.55+Math.random()*.5,g:Math.random()});
function plMedir(){var d=Math.min(1.5,window.devicePixelRatio||1);pl.width=W*d;pl.height=H*d;plc.setTransform(d,0,0,d,0,0);plLimpo=false}
function plasma(t,p,k){
  if(p<.01){if(!plLimpo){plc.clearRect(0,0,W,H);plLimpo=true}return}
  plLimpo=false;plc.clearRect(0,0,W,H);
  var od=parseFloat(orb.style.width)||R*.66,r=od/2*(.85+p*1.7)*(1+(k||0)),s=t/1000,a=Math.pow(p,.75);
  plc.globalCompositeOperation='lighter';
  var g=plc.createRadialGradient(cx,cy,0,cx,cy,r*1.3);
  g.addColorStop(0,'rgba(255,244,210,'+(.8*a).toFixed(3)+')');g.addColorStop(.28,'rgba(255,172,64,'+(.72*a).toFixed(3)+')');g.addColorStop(.6,'rgba(255,70,28,'+(.42*a).toFixed(3)+')');g.addColorStop(1,'rgba(255,20,10,0)');
  plc.fillStyle=g;plc.beginPath();plc.arc(cx,cy,r*1.3,0,6.2832);plc.fill();
  plc.lineCap='round';
  for(var i=0;i<plSem.length;i++){var sd=plSem[i],ang=sd.a+s*sd.w*.35*(i%2?1:-1),off=.45*Math.sin(s*1.3+sd.f),r0=r*.22,r1=r*(.8+.25*Math.sin(s*sd.w+sd.f));
    plc.strokeStyle='rgba(255,'+(150+Math.round(sd.g*100))+',90,'+(.55*a*sd.l).toFixed(3)+')';plc.lineWidth=1.2+a*1.8;
    plc.beginPath();plc.moveTo(cx+Math.cos(ang)*r0,cy+Math.sin(ang)*r0);plc.quadraticCurveTo(cx+Math.cos(ang+off)*r*.55,cy+Math.sin(ang+off)*r*.55,cx+Math.cos(ang+off*.4)*r1,cy+Math.sin(ang+off*.4)*r1);plc.stroke()}
  plc.strokeStyle='rgba(255,196,110,'+(.7*a).toFixed(3)+')';plc.lineWidth=1.5+a*2;plc.beginPath();plc.arc(cx,cy,r*(.98+.02*Math.sin(s*9)),0,6.2832);plc.stroke();
  plc.globalCompositeOperation='source-over'
}

/* ── bokeh de fundo da órbita ── */
var bk=$('#bk'),bkc=ctx2d(bk),bkS=[],bkSp=[];
function bkSprite(rgb){var c=document.createElement('canvas');c.width=c.height=64;var g=ctx2d(c),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba('+rgb+',.95)');r.addColorStop(.35,'rgba('+rgb+',.4)');r.addColorStop(.7,'rgba('+rgb+',.09)');r.addColorStop(1,'rgba('+rgb+',0)');g.fillStyle=r;g.fillRect(0,0,64,64);return c}
bkSp=[bkSprite('255,120,100'),bkSprite('255,232,214'),bkSprite('150,182,255')];
for(var bi=0;bi<46;bi++)bkS.push({x:Math.random(),y:Math.random(),s:3+Math.random()*13,a:.05+Math.random()*.22,v:.2+Math.random()*.8,f:Math.random()*6.283,k:Math.random()<.5?0:(Math.random()<.7?1:2)});
function bkMedir(){bk.width=W;bk.height=H}
function bokeh(t,vis,calor){
  bkc.clearRect(0,0,W,H);if(vis<.02)return;bkc.globalCompositeOperation='lighter';
  for(var i=0;i<bkS.length;i++){var b=bkS[i],yy=reduz?b.y:((b.y-t*b.v*.000011)%1+1)%1,xx=b.x*W+(reduz?0:Math.sin(t/3800*b.v+b.f)*14),al=b.a*(.7+.3*Math.sin(t/900*b.v+b.f))*vis*(1+calor*.8);
    bkc.globalAlpha=Math.min(.6,al);var d=b.s*(1+calor*.4);bkc.drawImage(bkSp[b.k],xx-d,yy*H-d,d*2,d*2)}
  bkc.globalAlpha=1;bkc.globalCompositeOperation='source-over'
}

/* ── pontos sob a órbita: um por ícone descoberto ── */
function dotsAtualiza(){var d=$('#dots');if(!d.firstChild)d.innerHTML=NOS.map(function(n){return '<i style="--c:'+(COR[n.k]||'#94a3b8')+'"></i>'}).join('');$$('i',d).forEach(function(e,i){e.classList.toggle('on',!!lido[i])})}

/* ── sequência do vídeo: plasma → explosão → túnel → logo → clarão → bandeiras ── */
var bm=$('#boom'),bmc=ctx2d(bm),fxV=false,seq=null,fxD=1,estW=[],fa=[],logoV=$('#logoV'),wfl=$('#wflash');
function fxMedir(){fxD=Math.min(1.5,window.devicePixelRatio||1);bm.width=W*fxD;bm.height=H*fxD;bmc.setTransform(fxD,0,0,fxD,0,0)}
function novaEst(ini){var mr=Math.hypot(W,H)*.55;return{a:Math.random()*6.283,r:ini?Math.random()*mr:4+Math.random()*20,c:Math.random(),s:.8+Math.random()*1.6}}
function sm(a,b,x){var u=clamp((x-a)/(b-a),0,1);return u*u*(3-2*u)}
function fxIniciar(t){
  fxMedir();fa=[];for(var i=0;i<150;i++){var a=Math.random()*6.283,v=180+Math.random()*900;fa.push({x:cx,y:cy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:0,L:.5+Math.random()*1.1,s:1+Math.random()*2.6,h:Math.random()})}
  estW=[];for(i=0;i<200;i++)estW.push(novaEst(true));
  logoV.style.left=cx+'px';logoV.style.top=cy+'px';logoV.style.fontSize=Math.round(Math.min(W*.09,38))+'px';
  seq={t0:t,aberto:false};fxV=true;fxLoop.t=0;requestAnimationFrame(fxLoop)
}
function fxLoop(t){
  if(!fxV||!seq||morto)return;
  var dt=Math.min(.05,(t-(fxLoop.t||t))/1000);fxLoop.t=t;
  var u=(t-seq.t0)/1000,mr=Math.hypot(W,H)*.55;
  bmc.clearRect(0,0,W,H);
  var wk=sm(.3,1.15,u)*(1-sm(2.25,2.6,u));
  if(wk>.01){var g=bmc.createRadialGradient(cx,cy,0,cx,cy,mr);g.addColorStop(0,'rgba(190,225,255,'+(.5*wk).toFixed(3)+')');g.addColorStop(.25,'rgba(70,120,230,'+(.3*wk).toFixed(3)+')');g.addColorStop(1,'rgba(8,12,40,'+(.55*wk).toFixed(3)+')');bmc.fillStyle=g;bmc.fillRect(0,0,W,H)}
  bmc.globalCompositeOperation='lighter';bmc.lineCap='round';
  var vel=1+9*wk*wk;
  for(var i=0;i<estW.length;i++){var s=estW[i];
    s.r+=(s.r*1.9+36)*dt*vel*(.6+s.c*.8);
    if(s.r>mr){var n=novaEst(false);s.a=n.a;s.r=n.r;s.c=n.c;s.s=n.s}
    var al=Math.min(1,s.r/mr*3)*wk*.85;if(al<.02)continue;
    var len=Math.min(s.r*.9,6+s.r*.2*wk*vel),ca=Math.cos(s.a),sa=Math.sin(s.a);
    bmc.strokeStyle=s.c<.6?'rgba(190,225,255,'+al.toFixed(2)+')':(s.c<.85?'rgba(255,255,255,'+al.toFixed(2)+')':'rgba(255,170,90,'+al.toFixed(2)+')');
    bmc.lineWidth=s.s*(.5+s.r/mr*1.1);bmc.beginPath();bmc.moveTo(cx+ca*(s.r-len),cy+sa*(s.r-len));bmc.lineTo(cx+ca*s.r,cy+sa*s.r);bmc.stroke()}
  if(wk>.02){for(var j=0;j<7;j++){var ph=((u*.85+j/7)%1),rr=mr*Math.pow(ph,2.3);bmc.strokeStyle='rgba(170,210,255,'+(Math.sin(ph*Math.PI)*.32*wk).toFixed(3)+')';bmc.lineWidth=1+ph*4;bmc.beginPath();bmc.arc(cx,cy,rr,0,6.2832);bmc.stroke()}}
  fa.forEach(function(q){q.l+=dt;if(q.l>q.L)return;q.x+=q.vx*dt;q.y+=q.vy*dt;var f=Math.pow(.18,dt);q.vx*=f;q.vy*=f;var a=1-q.l/q.L;bmc.strokeStyle='rgba(255,'+(90+Math.round(q.h*140))+','+(60+Math.round(q.h*60))+','+(a*.9).toFixed(2)+')';bmc.lineWidth=q.s;bmc.beginPath();bmc.moveTo(q.x,q.y);bmc.lineTo(q.x-q.vx*.035,q.y-q.vy*.035);bmc.stroke()});
  var ce=sm(1.2,2.45,u);if(ce>.01){var rg=mr*(.15+ce*.6),g2=bmc.createRadialGradient(cx,cy,0,cx,cy,rg);g2.addColorStop(0,'rgba(255,255,255,'+(.95*ce).toFixed(3)+')');g2.addColorStop(.4,'rgba(200,225,255,'+(.5*ce).toFixed(3)+')');g2.addColorStop(1,'rgba(120,170,255,0)');bmc.fillStyle=g2;bmc.beginPath();bmc.arc(cx,cy,rg,0,6.2832);bmc.fill()}
  bmc.globalCompositeOperation='source-over';
  var e=clamp((u-.8)/1.5,0,1);
  if(e>0&&e<1){var ee=Math.pow(e,1.7),sc=.12*Math.pow(120,ee),op=sm(0,.12,e)*(1-sm(.78,.98,e));logoV.style.opacity=op.toFixed(3);logoV.style.transform='translate(-50%,-50%) scale('+sc.toFixed(3)+')';logoV.style.filter=e>.7?'blur('+(((e-.7)/.3)*7).toFixed(1)+'px)':'none'}else logoV.style.opacity=0;
  wfl.style.opacity=(sm(2.05,2.45,u)*(1-sm(2.6,3.55,u))).toFixed(3);
  if(!seq.aberto&&u>=2.5){seq.aberto=true;abrirHistoria(true)}
  if(u>=3.65){fxFim();return}
  requestAnimationFrame(fxLoop)
}
function fxFim(){
  fxV=false;seq=null;bmc.clearRect(0,0,W,H);logoV.style.opacity=0;logoV.style.filter='none';wfl.style.opacity=0;
  ['#flash','#o1','#o2','#o3'].forEach(function(s){$(s).classList.remove('v')});
  restaurar();entrando=false
}
function explodir(t){
  if(boom||entrando)return;entrando=true;boom={t0:t};cc.on=false;cg.k=-1;ignorar=true;ccP=0;pinP=0;setP(0);pShown=0;fecharCard();
  var fl=$('#flash');[fl,$('#o1'),$('#o2'),$('#o3')].forEach(function(e){e.style.setProperty('--fx',cx+'px');e.style.setProperty('--fy',cy+'px');e.classList.remove('v')});void fl.offsetWidth;
  fl.classList.add('v');['#o1','#o2','#o3'].forEach(function(s,i){after(function(){$(s).classList.add('v')},i*130)});
  vibra([30,40,70,40,140]);somExplosao();
  if(reduz){abrirHistoria(true);after(fxFim,600)}else fxIniciar(t)
}
function restaurar(){
  boom=null;ccP=0;pinP=0;cc.on=false;cg.k=-1;setP(0);pShown=0;fecharCard();
  for(var i=0;i<prog.length;i++){prog[i]=0;lido[i]=false;els[i].classList.remove('lido')}nLido=0;atualizaHint();orb.style.opacity=1;plasma(0,0,0)
}

/* gestos: segurar ícone, segurar MOKED, pinça no MOKED, roda do mouse */
var ptrs={},nptr=0,mv=0,sx=0,sy=0,lx=0,ly=0,ignorar=false,pinch=null,mergulhando=false;
function setP(p){orb.style.setProperty('--p',p.toFixed(3));prC.style.strokeDashoffset=(100-100*p).toFixed(1);prC.style.opacity=p>.02?1:0;corpo.style.transform=p>0?'scale('+(1+p*.45).toFixed(3)+')':''}
function dist(){var a=Object.keys(ptrs).map(function(i){return ptrs[i]});return a.length<2?0:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}
function mid(){var a=Object.keys(ptrs).map(function(i){return ptrs[i]});return{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}}
function noGesto(e){return e.target.closest&&e.target.closest('.card,.btn-entrar,.som')}
sis.addEventListener('pointerdown',function(e){
  if(mergulhando||entrando||noGesto(e))return;
  audioIniciar();audioAcordar();
  ptrs[e.pointerId]={x:e.clientX,y:e.clientY};nptr++;try{sis.setPointerCapture(e.pointerId)}catch(_){}
  if(nptr===1){ignorar=false;arr=true;mv=0;sx=lx=e.clientX;sy=ly=e.clientY;yv=pv=0;idle=0;sis.classList.add('drag');
    cg.ok=false;var k0=perto(sx,sy);if(k0>=0&&dentroOrb(sx,sy,.95)){var q0=pos[k0];if(Math.hypot(q0.x-sx,q0.y-sy)>N*q0.s*.55)k0=-1}if(k0>=0){cg.k=k0;if(lido[k0])prog[k0]=0}else if(dentroOrb(sx,sy,.95))cc.on=true}
  else if(nptr===2){cc.on=false;cg.k=-1;arr=false;ignorar=true;var m=mid();pinch=dentroOrb(m.x,m.y,1.25)?{d0:dist()||1}:null}
});
sis.addEventListener('pointermove',function(e){
  if(!ptrs[e.pointerId])return;ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
  if(nptr>=2&&pinch){var r=dist()/pinch.d0,p=clamp((r-1)/.5,0,1);pinP=p;if(p>=1){pinch=null;ptrs={};nptr=0;explodir(performance.now())}return}
  if(nptr===1&&arr){var dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;mv=Math.max(mv,Math.hypot(e.clientX-sx,e.clientY-sy));if(mv>=9){cg.k=-1;cc.on=false}yaw+=dx*.009;pitch+=dy*.009;yv=dx*.009*60;pv=dy*.009*60;idle=0}
});
function soltar(e){
  audioIniciar();audioAcordar();audioPendente();
  if(!ptrs[e.pointerId])return;delete ptrs[e.pointerId];nptr=Math.max(0,nptr-1);
  if(pinch&&nptr<2){pinch=null;pinP=0}
  if(nptr===0){cg.k=-1;cc.on=false;arr=false;sis.classList.remove('drag');
    if(!ignorar&&mv<9&&e.type==='pointerup')tocar(e.clientX,e.clientY);ignorar=false}
}
sis.addEventListener('pointerup',soltar);sis.addEventListener('pointercancel',soltar);
function tocar(x,y){
  var k=perto(x,y);
  if(k>=0){dica(tx('Segure o dedo no ícone até fechar o círculo','Clique e segure o ícone até fechar o círculo'));return}
  if(foco>=0){fecharCard();return}
  if(dentroOrb(x,y,1)){dica(tx('Segure o dedo no MOKED','Clique e segure o MOKED'));return}
  entrar()
}
var dicaT=0;function dica(tx){var d=$('#dica');if(tx)d.textContent=tx;d.classList.add('v');clearTimeout(dicaT);dicaT=after(function(){d.classList.remove('v')},3200)}
var roda=0;
sis.addEventListener('wheel',function(e){if(mergulhando||entrando||!dentroOrb(e.clientX,e.clientY,1.2))return;e.preventDefault();roda=clamp(roda+(e.deltaY<0?.12:-.12),0,1);pinP=roda;if(roda>=1){roda=0;explodir(performance.now())}},{passive:false});
sis.addEventListener('dblclick',function(e){if(!entrando&&!mergulhando&&dentroOrb(e.clientX,e.clientY,1))explodir(performance.now())});
after(function(){if(!nLido)dica(tx('Segure o dedo sobre um ícone','Clique e segure um ícone'))},5500);

/* ═════ MERGULHO ═════ */
var dive=$('#dive'),abaAtual='hist';
function abrirHistoria(cine){
  if(mergulhando&&!cine)return;mergulhando=true;
  if(!cine){fecharCard();pinP=0;ccP=0;cc.on=false;cg.k=-1;setP(0);pShown=0}
  vibra(cine?[20,30,40]:[14,40,22]);
  sis.classList.add('mergulho');dive.hidden=false;hist.scrollTop=0;hScroll=0;
  after(function(){dive.classList.add('on')},30);
  bgT0=0;bgVivo=true;requestAnimationFrame(bgLoop);
  cenaIniciar();irAba('hist',true);
  after(function(){if(mergulhando){orbVivo=false;cancelAnimationFrame(raf)}},cine?300:800)
}
function mergulhar(){abrirHistoria(false)}
function voltar(){
  if(!mergulhando)return;dive.classList.remove('on');bgVivo=false;univVivo=false;cenaPara();
  orbVivo=true;ultimo=0;raf=requestAnimationFrame(quadro);
  after(function(){sis.classList.remove('mergulho');},180);
  after(function(){dive.hidden=true;mergulhando=false},760)
}
$('#fechar').addEventListener('click',voltar);
function tecla(e){
  if(morto)return;
  if(e.key==='Escape'&&mergulhando){voltar();return}
  if((e.key==='Enter'||e.key===' ')&&!mergulhando&&!entrando&&!boom){var al=e.composedPath?e.composedPath()[0]:e.target;if(al&&al.tagName==='BUTTON')return;e.preventDefault();entrar()}
}
document.addEventListener('keydown',tecla);
$$('.tab').forEach(function(b){b.addEventListener('click',function(){irAba(b.getAttribute('data-a'))})});
function irAba(a,primeira){
  abaAtual=a;$$('.tab').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-a')===a)});
  $$('.pn').forEach(function(p){p.classList.toggle('on',p.id==='p-'+a)});
  univVivo=(a==='univ');
  if(a==='hist'){cenaLigar()}else{cenaPara()}
  if(a==='univ'){if(!uni)uniIniciar();uniFechar();uniVoo(true);requestAnimationFrame(univLoop)}
  if(a==='hist')after(efeitoHist,30)
}

/* fundo: estrelas que fluem do centro */
var bg=$('#bg'),bgc=ctx2d(bg),bgVivo=false,estrelas=[],bgW=0,bgH=0,bgT0=0;
function bgMedir(){var d=Math.min(2,window.devicePixelRatio||1);bgW=W;bgH=H;bg.width=bgW*d;bg.height=bgH*d;bgc.setTransform(d,0,0,d,0,0)}
function bgLoop(t){
  if(!bgVivo||morto)return;if(!bgT0)bgT0=t;var warp=Math.max(0,1-(t-bgT0)/1400);
  if(bg.width!==Math.round(bgW*Math.min(2,window.devicePixelRatio||1)))bgMedir();
  bgc.clearRect(0,0,bgW,bgH);
  while(estrelas.length<70)estrelas.push({a:Math.random()*6.283,r:Math.random()*.9,v:.02+Math.random()*.05,s:.6+Math.random()*1.4});
  var mx=bgW/2,my=bgH*.4,mr=Math.hypot(bgW,bgH)/2;
  estrelas.forEach(function(s){s.r+=s.v*(reduz?0:.016)*(1+warp*14);if(s.r>1){s.r=.02;s.a=Math.random()*6.283}
    var r=s.r*s.r*mr,x=mx+Math.cos(s.a)*r,y=my+Math.sin(s.a)*r,al=Math.min(1,s.r*2)*(.18+.5*(1-s.r));
    bgc.strokeStyle='rgba(255,'+(110+Math.round(s.r*120))+',120,'+al.toFixed(2)+')';bgc.lineWidth=s.s;
    var tr=1+warp*10;bgc.beginPath();bgc.moveTo(x,y);bgc.lineTo(x-Math.cos(s.a)*s.s*tr*2,y-Math.sin(s.a)*s.s*tr*2);bgc.stroke()});
  requestAnimationFrame(bgLoop)
}
function aoRedim(){if(morto)return;medir();bgMedir()}
window.addEventListener('resize',aoRedim);window.addEventListener('orientationchange',aoRedim);
var ro=null;try{if(window.ResizeObserver){ro=new ResizeObserver(aoRedim);ro.observe(host)}}catch(e){ro=null}

/* ── História: cenário das bandeiras + efeito de túnel ── */
var hist=$('#hist'),caps=$$('.cap'),railp=$('#railp'),rolaEl=$('#rola'),hScroll=0;
var cena=$('#cena'),cnx=ctx2d(cena),cenaVivo=false,cenaRaf=0,cenaD=1,cenaT0=0,cenaPronta=false,imgIL=new Image(),spIL=null,mote=[],raios=[],glints=[];
imgIL.onload=function(){spIL=bandSprite(imgIL)};imgIL.src=FLAG_IL;
function bandSprite(im){var c=document.createElement('canvas');c.width=900;c.height=675;ctx2d(c).drawImage(im,0,0,900,675);return c}
for(var mi=0;mi<34;mi++)mote.push({x:Math.random(),y:Math.random(),s:3+Math.random()*14,a:.04+Math.random()*.14,v:.2+Math.random()*.8,f:Math.random()*6.283,k:Math.random()<.65?1:2});
for(var ri=0;ri<11;ri++)raios.push({a:-1+ri*.2+(Math.random()-.5)*.08,w:.05+Math.random()*.08,al:.07+Math.random()*.09,sp:.3+Math.random()*.5,f:Math.random()*6.283});

function geoBand(){var col=Math.min(W,520),fw=Math.min(col*.88,H*.36/.75),fh=fw*.75;return{fw:fw,fh:fh,px:W/2-fw/2-4}}
function cenaMedir(){var G=geoBand();hist.style.setProperty('--esp',Math.round(100+G.fh*1.11+8+24+96-70)+'px');cenaD=Math.min(1.5,window.devicePixelRatio||1);cena.width=Math.round(W*cenaD);cena.height=Math.round(H*cenaD);cnx.setTransform(cenaD,0,0,cenaD,0,0)}
function cenaIniciar(){cenaMedir();cenaT0=0;cenaPronta=true}
function cenaLigar(){if(!cenaPronta)return;cenaVivo=true;cancelAnimationFrame(cenaRaf);cenaRaf=requestAnimationFrame(cenaLoop)}
function cenaPara(){cenaVivo=false;cancelAnimationFrame(cenaRaf);cnx.clearRect(0,0,W,H)}
function ondaDy(u,t,amp){return (Math.sin(u*5.2-t*2.4)+.38*Math.sin(u*11.5-t*3.7+1.3))*amp*(.1+.9*u)/1.38}
function bandeira(g,sp,x0,y0,w,h,t,amp,sweep,d){
  if(!sp)return;var n=110,sw=sp.width/n;
  for(var i=0;i<n;i++){var ul=i/n,ur=(i+1)/n,u=(i+.5)/n,e0=Math.round((x0+ul*w)*d)/d,e1=Math.round((x0+ur*w)*d)/d,dw=e1-e0,yl=y0+ondaDy(ul,t,amp),yr=y0+ondaDy(ur,t,amp),m=(yr-yl)/dw,sl=clamp((ondaDy(u+.012,t,amp)-ondaDy(u-.012,t,amp))/(amp*.16+.001),-1,1),dd=(u-sweep)/.09,hl=Math.exp(-dd*dd)*.3,a0=sl<0?-sl*.4*u:0,a1=(sl>0?sl*.14*u:0)+hl;
    g.setTransform(d,m*d,0,d,e0*d,yl*d);
    g.drawImage(sp,i*sw,0,sw,sp.height,0,0,dw,h);
    if(a0>.005){g.fillStyle='rgba(0,0,0,'+a0.toFixed(3)+')';g.fillRect(0,0,dw,h)}
    if(a1>.005){g.fillStyle='rgba(255,255,255,'+Math.min(.6,a1).toFixed(3)+')';g.fillRect(0,0,dw,h)}}
  g.setTransform(1,0,0,1,0,0)
}
var fo=document.createElement('canvas'),fc=ctx2d(fo);
function glint(x,y,r,a){cnx.strokeStyle='rgba(235,246,255,'+a.toFixed(3)+')';cnx.lineWidth=1.2;cnx.beginPath();cnx.moveTo(x-r,y);cnx.lineTo(x+r,y);cnx.moveTo(x,y-r*1.3);cnx.lineTo(x,y+r*1.3);cnx.stroke();var g=cnx.createRadialGradient(x,y,0,x,y,r*.6);g.addColorStop(0,'rgba(255,255,255,'+a.toFixed(3)+')');g.addColorStop(1,'rgba(255,255,255,0)');cnx.fillStyle=g;cnx.fillRect(x-r,y-r,r*2,r*2)}
function cenaLoop(t){
  if(!cenaVivo||morto)return;if(!cenaT0)cenaT0=t;
  var s=t/1000,tin=clamp((t-cenaT0)/1300,0,1),st=hScroll,sa=clamp(1-st/(H*.55),0,1)*tin,fa=clamp(1-st/(H*.4),0,1)*tin;
  var G=geoBand(),fw=G.fw,fh=G.fh,px=G.px,y0=100-st*.92,unf=tin*tin*(3-2*tin),amp=reduz?0:fh*.11*unf,cxF=px+fw/2,cyF=y0+fh/2;
  cnx.clearRect(0,0,W,H);
  if(sa>.01){
    cnx.globalAlpha=sa;var g=cnx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#869b91');g.addColorStop(.3,'#52645b');g.addColorStop(.55,'#1b2421');g.addColorStop(1,'#0a0d0c');cnx.fillStyle=g;cnx.fillRect(0,0,W,H);
    var vg=cnx.createRadialGradient(W/2,H*.3,H*.2,W/2,H*.3,H*.85);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.5)');cnx.fillStyle=vg;cnx.fillRect(0,0,W,H);
    cnx.globalCompositeOperation='lighter';var sx=cxF+fw*.12,sy=y0-fh*.35,L=H*1.3;
    for(var i=0;i<raios.length;i++){var r=raios[i],an=Math.PI/2+r.a+(reduz?0:Math.sin(s*r.sp+r.f)*.04),x1=sx+Math.cos(an-r.w/2)*L,y1=sy+Math.sin(an-r.w/2)*L,x2=sx+Math.cos(an+r.w/2)*L,y2=sy+Math.sin(an+r.w/2)*L,rg=cnx.createLinearGradient(sx,sy,sx+Math.cos(an)*L,sy+Math.sin(an)*L),al=r.al*(.75+.25*Math.sin(s*r.sp*1.7+r.f));
      rg.addColorStop(0,'rgba(225,245,235,'+al.toFixed(3)+')');rg.addColorStop(1,'rgba(225,245,235,0)');cnx.fillStyle=rg;cnx.beginPath();cnx.moveTo(sx,sy);cnx.lineTo(x1,y1);cnx.lineTo(x2,y2);cnx.closePath();cnx.fill()}
    cnx.globalCompositeOperation='source-over';cnx.globalAlpha=1
  }
  var va=Math.max(sa,.3)*tin;
  if(va>.02){cnx.globalCompositeOperation='lighter';
    for(var j=0;j<mote.length;j++){var m=mote[j],yy=reduz?m.y:((m.y-s*m.v*.012)%1+1)%1,xx=m.x*W+(reduz?0:Math.sin(s*.7*m.v+m.f)*12);cnx.globalAlpha=Math.min(.45,m.a*va*(.7+.3*Math.sin(s*1.1*m.v+m.f)));var d=m.s;cnx.drawImage(bkSp[m.k],xx-d,yy*H-d,d*2,d*2)}
    cnx.globalAlpha=1;cnx.globalCompositeOperation='source-over'}
  if(fa>.01){
    cnx.globalAlpha=fa;cnx.globalCompositeOperation='lighter';
    var hg=cnx.createRadialGradient(cxF,cyF,0,cxF,cyF,fw*1.02);hg.addColorStop(0,'rgba(222,240,255,'+(.52+.1*Math.sin(s*1.3)).toFixed(3)+')');hg.addColorStop(.5,'rgba(160,205,235,.2)');hg.addColorStop(1,'rgba(150,200,230,0)');cnx.fillStyle=hg;cnx.fillRect(cxF-fw*1.1,cyF-fw*1.1,fw*2.2,fw*2.2);
    var ls=cnx.createLinearGradient(px-fw*.25,0,px+fw*1.25,0);ls.addColorStop(0,'rgba(190,225,255,0)');ls.addColorStop(.5,'rgba(220,240,255,.45)');ls.addColorStop(1,'rgba(190,225,255,0)');cnx.fillStyle=ls;cnx.fillRect(px-fw*.25,cyF-1,fw*1.5,2);
    cnx.globalCompositeOperation='source-over';
    var pg=cnx.createLinearGradient(0,y0-8,0,y0+fh*1.9);pg.addColorStop(0,'rgba(228,233,231,.9)');pg.addColorStop(1,'rgba(228,233,231,0)');cnx.fillStyle=pg;cnx.fillRect(px-2,y0-8,4,fh*1.9);cnx.fillStyle='#f0cf72';cnx.beginPath();cnx.arc(px,y0-11,5,0,6.2832);cnx.fill();
    /* pano translúcido: desenha à parte, dissolve as bordas na névoa e só então coloca na cena */
    var pad=Math.ceil(amp+10),ow=Math.ceil(fw+pad*2+4),oh=Math.ceil(fh+amp*2+pad*2),dd2=cenaD;
    if(fo.width!==Math.ceil(ow*dd2)||fo.height!==Math.ceil(oh*dd2)){fo.width=Math.ceil(ow*dd2);fo.height=Math.ceil(oh*dd2)}else{fc.setTransform(1,0,0,1,0,0);fc.clearRect(0,0,fo.width,fo.height)}
    bandeira(fc,spIL,pad+2,pad+amp,fw,fh,s,amp,-.25+((s%7)/7)*1.6,dd2);
    fc.globalCompositeOperation='destination-in';
    var gm=fc.createLinearGradient((pad+2)*dd2,0,(pad+2+fw)*dd2,0);gm.addColorStop(0,'#000');gm.addColorStop(.6,'#000');gm.addColorStop(1,'rgba(0,0,0,.3)');fc.fillStyle=gm;fc.fillRect(0,0,fo.width,fo.height);
    var gv=fc.createLinearGradient(0,(pad+amp)*dd2,0,(pad+amp+fh)*dd2);gv.addColorStop(0,'rgba(0,0,0,.9)');gv.addColorStop(.5,'#000');gv.addColorStop(1,'rgba(0,0,0,.4)');fc.fillStyle=gv;fc.fillRect(0,0,fo.width,fo.height);
    fc.globalCompositeOperation='source-over';
    cnx.globalAlpha=fa*.8;cnx.drawImage(fo,px+2-pad-2,y0-pad-amp,fo.width/dd2,fo.height/dd2);
    cnx.globalAlpha=1
  }
  cenaRaf=requestAnimationFrame(cenaLoop)
}
function efeitoHist(){
  var r=hist.getBoundingClientRect(),cyy=r.top+r.height/2;hScroll=hist.scrollTop;
  caps.forEach(function(c){var b=c.getBoundingClientRect(),d=((b.top+b.height/2)-cyy)/r.height,a=Math.min(1,Math.abs(d));
    c.style.opacity=(1-a*.85).toFixed(2);c.style.transform='translate3d(0,0,'+(-a*160)+'px) scale('+(1-a*.07).toFixed(3)+')';c.classList.toggle('ativo',a<.3)});
  var mx=hist.scrollHeight-hist.clientHeight;railp.style.transform='scaleY('+(mx>0?hist.scrollTop/mx:0).toFixed(3)+')';
  rolaEl.style.opacity=(abaAtual==='hist'&&hScroll<14)?1:0
}
var hT=0;hist.addEventListener('scroll',function(){if(hT)return;hT=requestAnimationFrame(function(){hT=0;efeitoHist()})},{passive:true});
$('#icos').innerHTML=['cftv','pessoas','pop'].map(function(k,i){return '<div><div class="sis-nd '+(['eq','pe','pr'][i])+'" style="--ac:'+COR[k]+'"><svg viewBox="0 0 24 24">'+ICONES[k]+'</svg></div><small>'+(['Equip.','Pessoas','Proced.'][i])+'</small></div>'}).join('');

/* ═════ UNIVERSO ═════ */
var uc=$('#uni'),ux=ctx2d(uc),univVivo=false;
var UN=[
 ['grav','eq','Tempo de gravação','Quanto tempo cada câmera guarda de imagem, por projeto.'],
 ['body','eq','Câmeras e bodycam','Câmeras do projeto e o uso de bodycam.'],
 ['peri','eq','Teste Perimetral','Cobertura diária do perímetro, cerca e sensores.'],
 ['acc','eq','Controle de acesso','Portarias, catracas, credenciais, horários e chaves.'],
 ['ilum','eq','Iluminação e energia','Pontos, quadrantes e ocorrências de energia.'],
 ['equip','eq','Equipamentos','Inventário, edição, baixa e ocorrências por equipamento.'],
 ['cco','eq','CCO','Central de monitoramento e seus relatórios.'],
 ['rondav','eq','Ronda Virtual','Ronda pelas câmeras, com relatório e registro de perdas.'],
 ['equipe','pe','Equipe','Cadastro, fotos, férias e movimentações da equipe.'],
 ['mapaeq','pe','Mapa de Equipe','Treinamentos, maturidade e índice individual por colaborador.'],
 ['mapadia','pe','Mapa diário','Escala do dia por projeto, no lugar do texto do WhatsApp.'],
 ['fv','pe','FV · Gestão','Painel, projeção e relatório do FV.'],
 ['camp','pe','Campanhas de equipe','Controle das campanhas, como a cesta de natal.'],
 ['lider','pe','Painel do Líder','A visão do líder sobre o seu projeto.'],
 ['tsem','pr','Teste Semanal','Os itens do teste semanal, por projeto, com registro.'],
 ['rondad','pr','Ronda Diária','O que a ronda viu hoje, no padrão da operação.'],
 ['audit','pr','Auditoria operacional','Verificação do que foi feito contra o que deveria ser feito.'],
 ['pops','pr','POPs e MNP','Procedimentos e manual de normas, por projeto.'],
 ['risco','pr','Análise de Risco','Motor de risco e mapa de criticidade do parque.'],
 ['diag','pr','Diagnóstico Situacional','Retrato da situação de um projeto, do entorno ao interno.'],
 ['ocorr','pr','Ocorrências · RS','Relatório Situacional e recorrência das ocorrências.'],
 ['sinis','pr','Sinistros e ambulância','Registro de sinistros e atendimentos.'],
 ['entorno','pr','Entorno','Notícias e criminalidade da região de cada parque.'],
 ['follow','pr','Follow-ups','Pendências, inclusive com link externo para manutenção e administração.'],
 ['avisos','out','Painel de Avisos','Tudo o que pede atenção hoje, logo na Home.'],
 ['nota','out','Nota do Projeto','Uma nota de 0 a 100 por projeto.'],
 ['cliente','out','Painel do Cliente','A visão do proprietário ou gestor do parque, com acesso próprio.'],
 ['pdf','out','Relatórios padrão Moked','PDFs padronizados e encadeados, prontos para enviar.'],
 ['v360','out','Visão 360','O projeto inteiro numa leitura só.']
];
var PIL=[['eq','Equipamentos',-90],['pe','Pessoas',30],['pr','Procedimentos',150]];
var LIG=[['tsem','avisos'],['tsem','pdf'],['ocorr','avisos'],['ocorr','pdf'],['risco','cliente'],['risco','pdf'],['diag','pdf'],['mapaeq','nota'],['equipe','mapaeq'],['mapadia','nota'],['rondav','pdf'],['grav','tsem'],['peri','tsem'],['acc','tsem'],['ilum','tsem'],['equip','tsem'],['entorno','cliente'],['follow','avisos'],['audit','nota'],['avisos','cliente'],['pdf','v360'],['nota','cliente'],['fv','nota'],['sinis','pdf'],['cco','rondav']];
var CAM={x:0,y:0,k:.4},UW=0,UH=0,UD=1,alvo=null,sel=null,uptr={},unp=0,umv=0,up0=null,upinch=0,glifos={},uIni=false;
var byId={};
function glifoImg(k,cor){var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 30 30" width="96" height="96"><style>*{stroke-linecap:round;stroke-linejoin:round}svg>*,g>*{fill:none;stroke:#e5e7eb;stroke-width:1.7}.acf{fill:'+cor+'!important;stroke:none!important}.ac{stroke:'+cor+'!important}.cone,.glow{fill:'+cor+'!important;stroke:none!important;opacity:.25}.rec,.led,.btn{fill:#ff3b42!important;stroke:none!important}.on{fill:#22e07a!important;stroke:none!important}.on-ring,.rip,.w,.ray,.scan,.t{opacity:.0}.ck{stroke:'+cor+'!important}.pg{fill:rgba(252,211,77,.1)!important}</style>'+ICONES[k]+'</svg>';var im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);return im}
function uniIniciar(){
  uIni=true;uni={};
  var nodes=[{id:'centro',g:'c',lab:'MOKED SIS⁺',r:40,x:0,y:0,ax:0,ay:0}];
  PIL.forEach(function(p){var a=p[2]*Math.PI/180;nodes.push({id:'p_'+p[0],g:p[0],pil:true,lab:p[1],r:25,x:Math.cos(a)*150,y:Math.sin(a)*150,a:a,ic:{eq:'cftv',pe:'pessoas',pr:'pop'}[p[0]]})});
  PIL.forEach(function(p){var mods=UN.filter(function(u){return u[1]===p[0]}),n=mods.length,a=p[2]*Math.PI/180,pc={x:Math.cos(a)*150,y:Math.sin(a)*150},st=Math.min(.62,3.2/n);
    mods.forEach(function(u,i){var an=a+(i-(n-1)/2)*st,rad=105+(i%2?24:0);nodes.push({id:u[0],g:u[1],lab:u[2],desc:u[3],r:12,x:pc.x+Math.cos(an)*rad,y:pc.y+Math.sin(an)*rad})})});
  var outs=UN.filter(function(u){return u[1]==='out'}),oa=[-62,-8,48,104,160];
  outs.forEach(function(u,i){var an=oa[i]*Math.PI/180;nodes.push({id:u[0],g:'out',lab:u[2],desc:u[3],r:17,x:Math.cos(an)*300,y:Math.sin(an)*420})});
  nodes.forEach(function(n){n.x*=.9;n.y*=1.12;n.x0=n.x;n.y0=n.y;byId[n.id]=n});
  for(var it=0;it<260;it++){for(var i=0;i<nodes.length;i++){for(var j=i+1;j<nodes.length;j++){var A=nodes[i],B=nodes[j],dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy)||.1,m=(A.r+B.r)+14;if(d<m){var f=(m-d)/2/d;if(i>0){A.x-=dx*f;A.y-=dy*f}B.x+=dx*f;B.y+=dy*f}}}
    nodes.forEach(function(n,i){if(i===0)return;n.x+=(n.x0-n.x)*.02;n.y+=(n.y0-n.y)*.02})}
  var links=[];PIL.forEach(function(p){links.push({a:'centro',b:'p_'+p[0],t:0});UN.filter(function(u){return u[1]===p[0]}).forEach(function(u){links.push({a:'p_'+p[0],b:u[0],t:0})})});
  LIG.forEach(function(l){links.push({a:l[0],b:l[1],t:1})});
  links.forEach(function(l,i){l.ph=(i*.137)%1;l.A=byId[l.a];l.B=byId[l.b]});
  nodes.forEach(function(n){n.rec=[];n.ali=[]});links.filter(function(l){return l.t===1}).forEach(function(l){l.A.ali.push(l.B);l.B.rec.push(l.A)});
  uni.nodes=nodes;uni.links=links;
  PIL.forEach(function(p){var n=byId['p_'+p[0]];glifos[n.id]=glifoImg(n.ic,COREG[p[0]])});
  $('#ucn').textContent=UN.length;
  uniMedir();uniFit()
}
function uniMedir(){if(!uni)return;UD=Math.min(2,window.devicePixelRatio||1);UW=W;UH=H;uc.width=UW*UD;uc.height=UH*UD}
var kFit=.4;
function uniFit(){var mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9;uni.nodes.forEach(function(n){mnx=Math.min(mnx,n.x-n.r);mxx=Math.max(mxx,n.x+n.r);mny=Math.min(mny,n.y-n.r);mxy=Math.max(mxy,n.y+n.r)});
  kFit=Math.min((UW-64)/(mxx-mnx),(UH-290)/(mxy-mny));CAM.x=(mnx+mxx)/2;CAM.y=(mny+mxy)/2;CAM.k=kFit;uni.cx=CAM.x;uni.cy=CAM.y}
function uniVoo(inicio){if(!uni)return;if(inicio){CAM.x=0;CAM.y=0;CAM.k=reduz?kFit:kFit*2.6;alvo={x:uni.cx,y:uni.cy,k:kFit,v:.045}}}
function w2s(x,y){return[UW/2+(x-CAM.x)*CAM.k,UH*.52+(y-CAM.y)*CAM.k]}
function s2w(x,y){return[(x-UW/2)/CAM.k+CAM.x,(y-UH*.52)/CAM.k+CAM.y]}
function univLoop(t){
  if(!univVivo||!uni||morto)return;
  if(alvo){CAM.x+=(alvo.x-CAM.x)*alvo.v;CAM.y+=(alvo.y-CAM.y)*alvo.v;CAM.k+=(alvo.k-CAM.k)*alvo.v;if(Math.abs(alvo.k-CAM.k)<.002&&Math.hypot(alvo.x-CAM.x,alvo.y-CAM.y)<.5)alvo=null}
  ux.setTransform(UD,0,0,UD,0,0);ux.clearRect(0,0,UW,UH);
  var o=w2s(0,0);
  // órbitas
  ux.setLineDash([3,7]);ux.lineWidth=1;[150,265,420].forEach(function(r,i){ux.strokeStyle='rgba(255,30,39,'+(.1-i*.02)+')';ux.beginPath();ux.ellipse(o[0],o[1],r*.9*CAM.k,r*1.12*CAM.k,0,0,6.283);ux.stroke()});ux.setLineDash([]);
  var rel=sel?{}:null;if(sel){rel[sel.id]=1;sel.rec.concat(sel.ali).forEach(function(n){rel[n.id]=1});if(sel.pil||sel.id==='centro'){uni.links.forEach(function(l){if(l.a===sel.id)rel[l.b]=1;if(l.b===sel.id)rel[l.a]=1})}}
  // ligações
  uni.links.forEach(function(l){var a=w2s(l.A.x,l.A.y),b=w2s(l.B.x,l.B.y),on=sel&&(l.A===sel||l.B===sel),dim=sel&&!on;
    var cxm=(a[0]+b[0])/2+(b[1]-a[1])*.12*(l.t?1:0),cym=(a[1]+b[1])/2-(b[0]-a[0])*.12*(l.t?1:0);
    ux.strokeStyle=on?'rgba(255,106,112,.95)':(l.t?'rgba(255,106,112,'+(dim?.05:.2)+')':'rgba(148,163,184,'+(dim?.04:.16)+')');ux.lineWidth=on?2:1;
    ux.beginPath();ux.moveTo(a[0],a[1]);ux.quadraticCurveTo(cxm,cym,b[0],b[1]);ux.stroke();
    if(!dim||on){var q=((t/(l.t?2600:3800))+l.ph)%1,u=1-q,px=u*u*a[0]+2*u*q*cxm+q*q*b[0],py=u*u*a[1]+2*u*q*cym+q*q*b[1];ux.fillStyle=l.t?'rgba(255,140,146,'+(on?1:.8)+')':'rgba(203,213,225,.6)';ux.beginPath();ux.arc(px,py,(on?2.6:1.8),0,6.283);ux.fill()}});
  // nós
  var rots=[];
  uni.nodes.forEach(function(n){var p=w2s(n.x,n.y),r=Math.max(n.r*CAM.k,n.pil?9:(n.g==='out'?8:3.5)),cor=n.g==='c'?'#ff1e27':COREG[n.g],dim=sel&&!rel[n.id];
    if(p[0]<-60||p[0]>UW+60||p[1]<-60||p[1]>UH+60)return;
    ux.globalAlpha=dim?.22:1;
    if(n.g==='c'||n.pil||n.g==='out'){var gr=ux.createRadialGradient(p[0],p[1],r*.3,p[0],p[1],r*2.4);gr.addColorStop(0,cor+'55');gr.addColorStop(1,cor+'00');ux.fillStyle=gr;ux.beginPath();ux.arc(p[0],p[1],r*2.4,0,6.283);ux.fill()}
    ux.fillStyle=n.g==='c'?'#1a0a0e':'#0d0f16';ux.strokeStyle=cor;ux.lineWidth=n===sel?3:(n.pil||n.g==='c'?1.8:1.3);
    ux.beginPath();if(n.g==='out'){var s=r*.95;ux.moveTo(p[0],p[1]-s*1.15);ux.lineTo(p[0]+s*1.15,p[1]);ux.lineTo(p[0],p[1]+s*1.15);ux.lineTo(p[0]-s*1.15,p[1]);ux.closePath()}else ux.arc(p[0],p[1],r,0,6.283);ux.fill();ux.stroke();
    if(n.g==='c'){ux.fillStyle='#fff';var fm=Math.max(8,r*.3);ux.font='700 '+fm+'px Segoe UI,system-ui,sans-serif';ux.textAlign='center';ux.textBaseline='middle';ux.fillText('MOKED',p[0],p[1]-fm*.42);ux.fillStyle='#9ca3af';ux.font='600 '+Math.max(6.5,fm*.62)+'px Segoe UI,system-ui,sans-serif';ux.fillText('SIS⁺',p[0],p[1]+fm*.62)}
    else if(n.pil&&glifos[n.id]&&glifos[n.id].complete){var gs=r*1.25;try{ux.drawImage(glifos[n.id],p[0]-gs/2,p[1]-gs/2,gs,gs)}catch(e){}}
    var mostra=sel?(n===sel||rel[n.id]):(n.pil||n.g==='out'||CAM.k>=.78);
    if(mostra&&n.g!=='c')rots.push([n,p,r,dim]);
    ux.globalAlpha=1});
  rots.forEach(function(q){var n=q[0],p=q[1],r=q[2],dim=q[3],fs=n.pil?11.5:(n.g==='out'?11:10.5);ux.globalAlpha=dim?.35:1;ux.font=(n.pil||n.g==='out'?'700 ':'600 ')+fs+'px Segoe UI,system-ui,sans-serif';ux.textAlign='center';ux.textBaseline='top';
    var tx=ux.measureText(n.lab).width,ty=p[1]+r+5,cx=Math.min(Math.max(p[0],tx/2+8),UW-tx/2-8);ux.fillStyle='rgba(7,7,11,.78)';ux.fillRect(cx-tx/2-4,ty-2,tx+8,fs+5);ux.fillStyle=dim?'#6b7280':(n.pil||n.g==='out'?'#fff':'#cbd5e1');ux.fillText(n.lab,cx,ty);ux.globalAlpha=1});
  requestAnimationFrame(univLoop)
}
var ucard=$('#ucard');
function uniAbrir(n){
  sel=n;var c=n.g==='c'?'#ff1e27':COREG[n.g];ucard.style.setProperty('--cc',c);
  $('#uk').textContent=n.g==='c'?'Centro':(n.pil?'Pilar':NOMEG[n.g]);$('#ut').textContent=n.lab;
  var desc=n.desc||(n.pil?{eq:'O que protege: câmeras, perímetro, acessos, iluminação, CCO e rádios.',pe:'Quem executa: equipe, treinamento, maturidade e escala.',pr:'Como se faz: testes, rondas, auditorias, risco e ocorrências.'}[n.g]:'O SIS⁺ junta equipamentos, pessoas e procedimentos num só lugar.');
  $('#ud').textContent=desc;
  var rc=n.rec&&n.rec.length?n.rec:null,al=n.ali&&n.ali.length?n.ali:null;
  if(n.pil||n.g==='c'){rc=null;al=uni.links.filter(function(l){return l.a===n.id}).map(function(l){return l.B})}
  $('#ulr').style.display=rc?'':'none';$('#ur').innerHTML=rc?rc.map(function(m){return '<span class="chip">'+m.lab+'</span>'}).join(''):'';
  $('#ula').style.display=al?'':'none';$('#ula').textContent=(n.pil||n.g==='c')?'Reúne':'Alimenta';$('#ua').innerHTML=al?al.map(function(m){return '<span class="chip">'+m.lab+'</span>'}).join(''):'';
  ucard.classList.add('v');$('#uhint').style.opacity=0;
  var kk=Math.max(CAM.k,n.pil||n.g==='c'?.6:.8);alvo={x:n.x,y:n.y+(UH*.25)/kk,k:kk,v:.1};vibra(6)
}
function uniFechar(){sel=null;ucard.classList.remove('v');$('#uhint').style.opacity=1}
$('#ux').addEventListener('click',function(e){e.stopPropagation();uniFechar();if(uni)alvo={x:uni.cx,y:uni.cy,k:kFit,v:.08}});
function uHit(x,y){var w=s2w(x,y),m=null,b=1e9;uni.nodes.forEach(function(n){var d=Math.hypot(w[0]-n.x,w[1]-n.y)*CAM.k,rr=Math.max(n.r*CAM.k,10)+12;if(d<rr&&d<b){b=d;m=n}});return m}
uc.addEventListener('pointerdown',function(e){if(!uni)return;uptr[e.pointerId]={x:e.clientX,y:e.clientY};unp++;try{uc.setPointerCapture(e.pointerId)}catch(_){}alvo=null;
  if(unp===1){umv=0;up0={x:e.clientX,y:e.clientY}}else{var a=Object.keys(uptr).map(function(i){return uptr[i]});upinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1}});
uc.addEventListener('pointermove',function(e){if(!uptr[e.pointerId])return;var p=uptr[e.pointerId],dx=e.clientX-p.x,dy=e.clientY-p.y;
  if(unp===1){umv=Math.max(umv,Math.hypot(e.clientX-up0.x,e.clientY-up0.y));CAM.x-=dx/CAM.k;CAM.y-=dy/CAM.k}
  uptr[e.pointerId]={x:e.clientX,y:e.clientY};
  if(unp>=2){var a=Object.keys(uptr).map(function(i){return uptr[i]}),d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1,m=[(a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2],w0=s2w(m[0],m[1]);CAM.k=clamp(CAM.k*d/upinch,.22,3);upinch=d;var w1=s2w(m[0],m[1]);CAM.x+=w0[0]-w1[0];CAM.y+=w0[1]-w1[1];umv=99}});
function uSolta(e){if(!uptr[e.pointerId])return;delete uptr[e.pointerId];unp=Math.max(0,unp-1);
  if(unp===0&&e.type==='pointerup'&&umv<8){var n=uHit(e.clientX,e.clientY);if(n)uniAbrir(n);else if(sel){uniFechar()}}}
uc.addEventListener('pointerup',uSolta);uc.addEventListener('pointercancel',uSolta);
uc.addEventListener('wheel',function(e){if(!uni)return;e.preventDefault();var w0=s2w(e.clientX,e.clientY);CAM.k=clamp(CAM.k*(e.deltaY<0?1.12:.89),.22,3);var w1=s2w(e.clientX,e.clientY);CAM.x+=w0[0]-w1[0];CAM.y+=w0[1]-w1[1];alvo=null},{passive:false});

/* ═════ partida ═════ */
medir();bgMedir();dotsAtualiza();
$('#uhint').textContent=tx('arraste · aproxime com dois dedos · toque num módulo','arraste · role para aproximar · clique num módulo');
$('#hint').textContent=tx('Segure o dedo num ícone','Clique e segure num ícone');
$('#entrar2').addEventListener('click',function(e){e.stopPropagation();entrar()});
var ign=$('#ign'),tIntro=[];
function intro(fn,ms){tIntro.push(after(fn,ms))}
function ligar(){sis.classList.add('on');ign.classList.add('apaga');after(function(){ign.classList.add('fim')},800)}
function pulaIgn(){if(!sis.classList.contains('on')){tIntro.forEach(clearTimeout);tIntro=[];sis.classList.add('on');ign.classList.add('fim')}}
if(reduz){sis.classList.add('on');ign.classList.add('fim')}
else{intro(function(){ign.classList.add('sobe')},300);intro(function(){ign.classList.add('acende')},1240);intro(function(){ign.classList.add('flash')},1520);intro(ligar,1760)}
ign.addEventListener('pointerdown',function(e){e.stopPropagation();audioIniciar();audioAcordar();pulaIgn()});
/* iOS: sem isto o pinça/arrasto rola ou dá zoom na página */
function semGesto(e){if(e.cancelable)e.preventDefault()}
sis.addEventListener('touchmove',semGesto,{passive:false});sis.addEventListener('gesturestart',semGesto);sis.addEventListener('gesturechange',semGesto);
uc.addEventListener('touchmove',semGesto,{passive:false});uc.addEventListener('gesturestart',semGesto);uc.addEventListener('gesturechange',semGesto);
sis.addEventListener('contextmenu',semGesto);uc.addEventListener('contextmenu',semGesto);
raf=requestAnimationFrame(quadro);
host.__sis={mergulhar:mergulhar,seq:function(){return seq?{u:(performance.now()-seq.t0)/1000,aberto:seq.aberto}:null},entrando:function(){return entrando},irAba:irAba,voltar:voltar,abrirCard:abrirCard,explodir:function(){explodir(performance.now())},estado:function(){return{foco:foco,mergulhando:mergulhando,aba:abaAtual,nodes:uni?uni.nodes.length:0,lido:nLido,boom:!!boom,ccP:ccP,prog:prog.map(function(v){return +v.toFixed(2)})}},uniAbrir:function(id){uniAbrir(byId[id])},nos:function(){return pos.map(function(p){return{x:p.x,y:p.y,z:p.z}})},centro:function(){return{cx:cx,cy:cy,R:R}}};

return function destruir() {
  if (morto) return; morto = true;
  timers.forEach(clearTimeout);
  try { cancelAnimationFrame(raf); cancelAnimationFrame(cenaRaf); } catch (e) {}
  window.removeEventListener('resize', aoRedim); window.removeEventListener('orientationchange', aoRedim);
  document.removeEventListener('keydown', tecla);
  try { if (ro) ro.disconnect(); } catch (e) {}
  try { if (AC && AC.close) AC.close(); } catch (e) {}
  AC = null;
};
}
