// Abertura SIS⁺ (Marcio, 21/11/2026): estilos isolados dentro do Shadow DOM da abertura (não vazam para o app nem recebem estilo dele).
// Gerado a partir do protótipo aprovado; os ícones vivos vêm de iconesSIS.js.
import { CSS_ICONES } from "./iconesSIS";

export const CSS_SIS = `.sisx{color-scheme:dark;--bg:#07070b;--fg:#f3f4f6;--mut:#9ca3af;--red:#FF1E27;--eq:#94a3b8;--pe:#7dd3fc;--pr:#fde68a;--out:#ff6a70;--card:rgba(14,15,22,.93)}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
button{font:inherit;color:inherit}
/* ───────── ÓRBITA (cópia fiel da abertura do app) ───────── */
.sis{position:absolute;inset:0;-webkit-touch-callout:none;background:radial-gradient(90% 60% at 50% 42%,#1a0a0e 0%,#08080c 58%,#050507 100%);overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
.sis.drag{cursor:grabbing}
.sis-ghost{position:absolute;pointer-events:none;opacity:0;transition:opacity 1.6s ease}.sis.on .sis-ghost{opacity:1}
.sis-ghost .ring{position:absolute;inset:0;border-radius:50%;opacity:.2;background:conic-gradient(from 180deg,#b91c1c 0deg,#ef4444 25deg,#f97316 55deg,#facc15 95deg,#84cc16 135deg,#16a34a 180deg,#84cc16 225deg,#facc15 265deg,#f97316 305deg,#ef4444 335deg,#b91c1c 360deg);-webkit-mask:radial-gradient(circle,transparent 58%,#000 59%,#000 70%,transparent 71%);mask:radial-gradient(circle,transparent 58%,#000 59%,#000 70%,transparent 71%)}
.sis-ghost svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.sis-corpo{position:absolute;inset:0;opacity:0;transition:opacity 1s ease,transform .1s linear,filter .75s}
.sis.on .sis-corpo{opacity:1}
.sis.mergulho .sis-corpo{transform:scale(3.6)!important;opacity:0!important;filter:blur(8px);transition:opacity .7s ease,transform .75s cubic-bezier(.5,0,.8,.3),filter .75s}
.sis.mergulho .sis-ghost{opacity:0;transition:opacity .5s}
.sis-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.sis-orb{position:absolute;left:0;top:0;border-radius:50%;display:grid;place-items:center;text-align:center;pointer-events:none;background:radial-gradient(circle at 50% 38%,rgba(42,13,18,calc(1 - var(--p,0)*.93)),rgba(10,10,14,calc(1 - var(--p,0)*.9)) 72%);border:1px solid #ff1e2766;box-shadow:0 0 40px rgba(255,30,39,.32),inset 0 0 calc(28px + var(--p,0)*40px) rgba(255,30,39,calc(.14 + var(--p,0)*.5))}
.sis-glow{position:absolute;left:0;top:0;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(255,30,39,.62) 0,rgba(255,30,39,.26) 26%,rgba(255,30,39,.08) 48%,rgba(255,30,39,0) 68%);opacity:.3;will-change:opacity,transform}
.sis-orb::after{content:"";position:absolute;inset:-10%;border-radius:50%;border:1px solid #ff1e2733;animation:sisPulso 3.2s ease-out infinite}
@keyframes sisPulso{0%{transform:scale(.9);opacity:.9}100%{transform:scale(1.4);opacity:0}}
.sis-logo{font-weight:700;letter-spacing:.28em;padding-left:.28em;font-size:var(--lf,18px)}.sis-logo b{color:#FF1E27}
.sis-orb small{display:block;font-size:calc(var(--lf,18px)*.42);letter-spacing:.3em;color:#9ca3af;margin-top:3px}
.sis-nd{position:absolute;left:0;top:0;border-radius:50%;display:grid;place-items:center;pointer-events:none;color:#e5e7eb;border:1px solid var(--c,#3a3f52);background:radial-gradient(circle at 35% 30%,#252a3a,#10121a 72%);box-shadow:0 6px 16px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.12);will-change:transform;transition:box-shadow .25s,border-color .25s,color .25s,filter .25s}
.sis-nd svg{width:48%;height:48%;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.sis-nd.eq{--c:#475569}.sis-nd.pe{--c:#38bdf866;color:#bae6fd}.sis-nd.pr{--c:#facc1566;color:#fde68a}
.sis-nd svg.rg{position:absolute;left:-11px;top:-11px;width:calc(100% + 22px);height:calc(100% + 22px);stroke:none;fill:none;overflow:visible;pointer-events:none;transform:rotate(-90deg)}
.sis-nd svg.rg circle{fill:none;stroke:var(--ac,#ff4b52);stroke-width:3.4;stroke-linecap:round;stroke-dasharray:100;stroke-dashoffset:100;opacity:0;filter:drop-shadow(0 0 3px var(--ac,#ff4b52))}
.sis-nd.carga svg.rg{animation:giraRg .85s linear infinite}
@keyframes giraRg{from{transform:rotate(-90deg)}to{transform:rotate(270deg)}}
.sis-nd.lido::after{content:"";position:absolute;right:3px;top:3px;width:7px;height:7px;border-radius:50%;background:var(--ac,#ff4b52);box-shadow:0 0 8px var(--ac,#ff4b52)}
.sis-nd.hot{border-color:#ff5a61;color:#fff;box-shadow:0 0 30px rgba(255,30,39,.7),0 6px 16px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.2)}
.sis.foco .sis-nd:not(.hot){filter:brightness(.55) saturate(.7)}
.sis-pr{position:absolute;pointer-events:none;overflow:visible}
.sis-pr circle{fill:none;stroke:#ff4b52;stroke-width:3;filter:drop-shadow(0 0 4px #ff1e27);stroke-linecap:round;transform-origin:center;transform:rotate(-90deg);opacity:0;transition:opacity .2s}
.sis-hint{position:absolute;left:0;right:0;top:calc(30px + env(safe-area-inset-top,0px));text-align:center;font-size:11px;letter-spacing:.2em;color:#9ca3af;text-transform:uppercase;pointer-events:none;padding:0 18px}
.sis-dica{position:absolute;left:0;right:0;top:calc(52px + env(safe-area-inset-top,0px));text-align:center;font-size:11px;letter-spacing:.08em;color:#ff8a90;pointer-events:none;opacity:0;transition:opacity .8s}
.sis-dica.v{opacity:1}
.sis-leg{position:absolute;left:0;right:0;bottom:calc(20px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;gap:14px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af;pointer-events:none}
.sis.limpa .sis-fx,.sis.limpa .sis-dots,.sis.limpa .sis-leg,.sis.limpa .card{display:none}
.sis-leg i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;vertical-align:1px}
.sis-info{position:absolute;left:0;right:0;bottom:calc(112px + env(safe-area-inset-bottom,0px));text-align:center;padding:0 24px;pointer-events:none}
.sis-info b{display:block;font-size:15px;letter-spacing:.06em}.sis-info span{display:block;font-size:12px;color:#9ca3af;margin-top:3px}
.btn-entrar{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(54px + env(safe-area-inset-bottom,0px));background:#B91C1C;color:#fff;border:none;padding:11px 34px;font-weight:900;letter-spacing:2.5px;font-size:12px;text-transform:uppercase;cursor:pointer;clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)}
.btn-entrar:active{filter:brightness(1.15)}
.sis.foco .btn-entrar,.sis.foco .sis-info{opacity:0;pointer-events:none}
/* cartão do ícone */
.card{position:absolute;left:12px;right:12px;bottom:calc(18px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;background:var(--card);border:1px solid var(--cc,#475569);border-radius:18px;padding:14px 16px 14px;box-shadow:0 18px 50px rgba(0,0,0,.6);box-shadow:0 18px 50px rgba(0,0,0,.6),0 0 30px color-mix(in srgb,var(--cc,#475569) 25%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transform:translateY(130%);opacity:0;transition:transform .38s cubic-bezier(.2,.8,.2,1),opacity .3s;z-index:6;touch-action:manipulation}
.card.v{transform:none;opacity:1}
.card .k{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--cc,#94a3b8)}
.card h3{margin:3px 0 4px;font-size:19px;letter-spacing:.01em}
.card p{margin:0 0 10px;font-size:13px;line-height:1.45;color:#cbd5e1}
.card .lb{font-size:10px;letter-spacing:.16em;color:#9ca3af;text-transform:uppercase;margin:8px 0 6px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:11.5px;padding:5px 10px;border-radius:99px;border:1px solid #2a2f3f;background:#0d0f16;color:#e5e7eb}
.card .acoes{display:flex;gap:8px;margin-top:12px}
.card .acoes button{flex:1;border:1px solid #2a2f3f;background:#0d0f16;border-radius:12px;padding:10px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
.card .acoes button.pri{background:#B91C1C;border-color:#B91C1C;font-weight:800}
/* ───────── MERGULHO ───────── */
.dive{position:absolute;inset:0;background:radial-gradient(100% 70% at 50% 30%,#14080c 0%,#07070b 60%,#040406 100%);opacity:0;transform:scale(.82);transition:opacity .6s ease .15s,transform .75s cubic-bezier(.2,.8,.2,1);z-index:20;overflow:hidden}
.dive.on{opacity:1;transform:none}
.dive canvas.bg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.dv-top{position:absolute;left:0;right:0;top:0;padding:calc(10px + env(safe-area-inset-top,0px)) max(12px,calc(var(--gut,0px) + 12px)) 8px;display:flex;align-items:center;gap:8px;z-index:8;background:linear-gradient(#05060880,#05060800)}
.tabs{flex:1;display:flex;gap:4px;background:#0d0f16cc;border:1px solid #1f2433;border-radius:99px;padding:3px}
.tab{flex:1;border:none;background:none;padding:8px 4px;border-radius:99px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9ca3af;cursor:pointer;transition:background .25s,color .25s}
.tab.on{background:#B91C1C;color:#fff;font-weight:800}
.x{width:38px;height:38px;border-radius:50%;border:1px solid #2a2f3f;background:#0d0f16cc;cursor:pointer;font-size:18px;line-height:1}
.pn{position:absolute;inset:0;opacity:0;pointer-events:none;transition:opacity .45s ease}
.pn.on{opacity:1;pointer-events:auto}
/* História */
.hist{-webkit-mask-image:linear-gradient(transparent 54px,#000 112px);mask-image:linear-gradient(transparent 54px,#000 112px);position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;perspective:900px;padding:calc(70px + env(safe-area-inset-top,0px)) var(--gut,0px) 90px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y}
.rail{position:absolute;left:calc(var(--gut,0px) + 26px);top:calc(70px + env(safe-area-inset-top,0px));bottom:30px;width:2px;background:#ffffff14;z-index:2;pointer-events:none}
.rail i{position:absolute;inset:0;background:linear-gradient(#FF1E27,#f97316);transform-origin:top;transform:scaleY(0);box-shadow:0 0 10px #ff1e27aa}
.cap{position:relative;min-height:54vh;display:flex;flex-direction:column;justify-content:center;padding:18px 22px 18px 58px;will-change:transform,opacity;overflow:visible}
.cap::before{content:"";position:absolute;left:21px;top:50%;width:12px;height:12px;margin-top:-6px;border-radius:50%;background:#1a1d29;border:2px solid #475569;transition:all .4s;z-index:3}
.cap.ativo::before{background:var(--red);border-color:#ffb3b6;box-shadow:0 0 14px 3px #ff1e27aa}
.cap .kk{font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--red)}
.cap .yr{font-size:62px;font-weight:900;letter-spacing:-.03em;line-height:1;margin:6px 0 4px;color:transparent;-webkit-text-stroke:1.2px #ffffff55}
.cap.ativo .yr{-webkit-text-stroke-color:#ffffffcc}
.cap h2{margin:2px 0 8px;font-size:23px;line-height:1.15}
.cap p{margin:0;font-size:14.5px;line-height:1.55;color:#cbd5e1;max-width:34em;text-shadow:0 1px 10px #000c}.cap h2,.cap .kk,.cap .yr{text-shadow:0 1px 12px #000b}
.cap p b{color:#fff}
.icos{display:flex;gap:10px;margin-top:14px}
.icos .sis-nd{position:relative;width:52px;height:52px}
.icos small{display:block;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#9ca3af;text-align:center;margin-top:6px}
.divs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;max-width:360px}
.dv{border:1px solid #2a2f3f;border-radius:12px;padding:9px 11px;background:#0d0f16}
.dv b{display:flex;align-items:center;gap:7px;font-size:14px}.dv b i{width:7px;height:7px;border-radius:50%;background:#22e07a;box-shadow:0 0 8px #22e07a}
.dv.off b i{background:#475569;box-shadow:none}.dv.off{opacity:.6}
.dv span{display:block;font-size:11px;color:#9ca3af;margin-top:2px}
.resumo{padding:26px 22px 40px 58px;color:#cbd5e1;font-size:14.5px;line-height:1.6}
.resumo h3{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--red);margin:0 0 12px}
.resumo p{margin:0 0 12px;max-width:34em}.resumo b{color:#fff}
.fim{font-size:15px;color:#fff;font-weight:600;border-left:3px solid var(--red);padding-left:12px;margin-top:16px}
.nota{font-size:10.5px;color:#6b7280;margin-top:20px;letter-spacing:.04em}
/* Universo */
.univ{position:absolute;inset:0}
.univ canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab;-webkit-touch-callout:none}
.uhint{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom,0px));text-align:center;font-size:10.5px;letter-spacing:.1em;color:#9ca3af;pointer-events:none;padding:0 16px;transition:opacity .4s}
.uleg{position:absolute;left:12px;top:calc(62px + env(safe-area-inset-top,0px));display:flex;flex-direction:column;gap:5px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#9ca3af;pointer-events:none}
.uleg i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px}
.ucont{position:absolute;right:12px;top:calc(62px + env(safe-area-inset-top,0px));text-align:right;font-size:10px;letter-spacing:.1em;color:#9ca3af;pointer-events:none;line-height:1.5}
.ucont b{display:block;font-size:22px;color:#fff;letter-spacing:0}
#boom{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:7}
.flash{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:8;background:radial-gradient(circle at var(--fx,50%) var(--fy,43%),#fff 0,#ffd9da 8%,#ff6a70 22%,#ff1e27 40%,rgba(255,30,39,0) 72%)}
.flash.v{animation:flash .7s ease-out forwards}
@keyframes flash{0%{opacity:0}12%{opacity:1}100%{opacity:0}}
.onda{position:absolute;left:var(--fx,50%);top:var(--fy,43%);width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;border:2px solid #ff6a70;pointer-events:none;opacity:0;z-index:7;box-shadow:0 0 24px #ff1e27aa,inset 0 0 18px #ff1e2766}
.onda.v{animation:onda 1.1s cubic-bezier(.1,.7,.2,1) forwards}
@keyframes onda{0%{opacity:.95;transform:scale(.3)}100%{opacity:0;transform:scale(14)}}
.esp{height:var(--esp,52vh);display:flex;align-items:flex-end;justify-content:center;padding-bottom:6px;pointer-events:none}
.tit{text-align:center;text-shadow:0 2px 14px #000}.tit b{display:block;font-size:12px;letter-spacing:.34em;padding-left:.34em;color:#fff;text-transform:uppercase}.tit span{display:block;margin-top:5px;font-size:10px;letter-spacing:.22em;color:#aeb7b2;text-transform:uppercase}
.rola{margin-top:16px;text-align:center;font-size:10px;letter-spacing:.24em;color:#cbd5e1;text-transform:uppercase;pointer-events:none;transition:opacity .5s;text-shadow:0 1px 8px #000}
.rola i{display:block;width:1px;height:18px;margin:6px auto 0;background:linear-gradient(#fff,transparent);animation:rolaA 1.6s ease-in-out infinite}
@keyframes rolaA{0%{transform:scaleY(.3);transform-origin:top;opacity:.2}60%{transform:scaleY(1);opacity:1}100%{transform:scaleY(1);opacity:0}}
#cena{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#bk{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#pl{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.sis-dots{position:absolute;left:0;right:0;bottom:calc(176px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;gap:8px;pointer-events:none}
.sis-dots i{width:6px;height:6px;border-radius:50%;background:#ffffff30;transition:all .35s}
.sis-dots i.on{background:var(--c);box-shadow:0 0 10px var(--c);transform:scale(1.4)}
#logoV{position:absolute;left:0;top:0;z-index:9;pointer-events:none;opacity:0;text-align:center;font-weight:700;letter-spacing:.28em;padding-left:.28em;will-change:transform,opacity,filter;text-shadow:0 0 22px rgba(170,215,255,.8);transform:translate(-50%,-50%)}
#logoV i{font-style:normal;color:#FF1E27}#logoV small{display:block;font-size:.42em;letter-spacing:.3em;color:#cbd5e1;margin-top:3px;font-weight:600}
#wflash{position:absolute;inset:0;z-index:30;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 43%,#fff 0,#e8f4ff 38%,#a9d4ff 100%)}
.som{position:absolute;left:12px;top:calc(8px + env(safe-area-inset-top,0px));font-size:9px;letter-spacing:.18em;color:#9ca3af;border:1px solid #2a2f3f;border-radius:99px;padding:3px 9px;background:#0d0f16;z-index:5;cursor:pointer}
.som.off{opacity:.5;text-decoration:line-through}
@media (prefers-reduced-motion:reduce){.sis-orb::after{animation:none}.dive,.dive.on{transition:opacity .2s}}

/* ───────── contêiner, saída e ignição (a abertura que já estava no app) ───────── */
.sisx{position:absolute;inset:0;overflow:hidden;background:var(--bg);color:var(--fg);font-family:'Segoe UI',system-ui,-apple-system,Roboto,sans-serif;-webkit-text-size-adjust:100%;--gut:max(0px,calc((100% - 520px)/2));transition:opacity .6s ease,transform .6s cubic-bezier(.5,0,.8,.3),filter .6s}
.sisx.saindo{opacity:0;transform:scale(2.4);filter:blur(6px);pointer-events:none}
.btn-fim{position:static;transform:none;display:block;margin-top:22px;padding:11px 30px}
.sis-ign{position:absolute;inset:0;z-index:25;background:#000;perspective:900px;perspective-origin:50% 42%;transition:opacity .7s ease .1s;touch-action:none}.sis-ign.fim{opacity:0;pointer-events:none}
.sis-dot{position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#fff;box-shadow:0 0 18px 4px rgba(255,255,255,.8);transform:translateY(42vh) scale(.4);opacity:0;transition:transform .95s cubic-bezier(.2,.7,.2,1),opacity .4s}
.sis-ign.sobe .sis-dot{transform:translateY(0) scale(1);opacity:1}
.sis-ign.acende .sis-dot{transform:translateY(0) scale(2.4);box-shadow:0 0 60px 24px rgba(255,255,255,.95);transition:transform .35s ease-in,box-shadow .35s}
.sis-flash{position:absolute;inset:0;background:#fff;opacity:0;transition:opacity .22s ease-in}.sis-ign.flash .sis-flash{opacity:1}.sis-ign.apaga .sis-flash{opacity:0;transition:opacity .75s ease-out}
@media (prefers-reduced-motion:reduce){.sisx{transition:opacity .2s}.sisx.saindo{transform:none;filter:none}}
/* PC: a barra de abas e o texto acompanham a coluna; foco visível no teclado */
.tabs{max-width:420px}
button:focus-visible{outline:2px solid #ff6a70;outline-offset:2px}

${CSS_ICONES}
`;
