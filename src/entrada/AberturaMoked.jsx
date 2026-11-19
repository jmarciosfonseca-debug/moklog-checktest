// Abertura em 3D (Marcio, 19/11/2026): a frase "o software por trás do hardware" surge em vermelho e recua para o fundo;
// o logo vem do fundo para a frente e entra "Security · Consulting". Só toca na abertura de verdade (ver src/retomar.js).
// Toque em qualquer lugar pula. Com "reduzir movimento" ligado, mostra o logo parado e segue.
import { useEffect, useRef } from "react";

export const DURACAO_ABERTURA_MS = 6200;

const CSS = `
.ab{position:fixed;inset:0;z-index:60;background:radial-gradient(120% 80% at 50% 38%,#1a0609 0%,#0b0f19 52%,#05070c 100%);overflow:hidden;color:#e5e7eb;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;perspective:900px;perspective-origin:50% 42%;animation:abSai .55s ease 5.6s forwards;cursor:pointer;touch-action:manipulation}
.ab-cena{position:absolute;inset:0;transform-style:preserve-3d;transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .25s ease-out}
.ab-piso{position:absolute;left:-60%;right:-60%;bottom:-8%;height:62%;transform-origin:50% 100%;transform:rotateX(74deg);background:repeating-linear-gradient(90deg,rgba(229,9,20,.30) 0 2px,transparent 2px 64px),repeating-linear-gradient(0deg,rgba(229,9,20,.30) 0 2px,transparent 2px 64px);-webkit-mask:linear-gradient(to top,#000 0%,transparent 88%);mask:linear-gradient(to top,#000 0%,transparent 88%);animation:abPiso 2.2s linear infinite,abFadeIn 1s ease both}
@keyframes abPiso{to{background-position:0 64px,0 64px}}
@keyframes abFadeIn{from{opacity:0}}
.ab-frase{position:absolute;left:0;right:0;top:50%;margin-top:-21vmin;text-align:center;transform-style:preserve-3d;animation:abFrase 2.95s cubic-bezier(.55,0,.25,1) .2s both;will-change:transform,opacity}
.ab-frase p{margin:0;font-weight:900;line-height:1.02;letter-spacing:-.02em;font-size:clamp(40px,11.5vw,128px);color:#E50914;text-shadow:0 1px 0 #c0070f,0 2px 0 #b0060e,0 3px 0 #a0060d,0 4px 0 #90050c,0 5px 0 #80050b,0 6px 0 #70040a,0 12px 22px rgba(0,0,0,.65),0 0 46px rgba(229,9,20,.45)}
@media (min-width:1024px){.ab-frase p{font-size:clamp(64px,8.2vw,150px)}}
@keyframes abFrase{0%{transform:translate3d(0,0,520px) rotateX(-10deg);opacity:0}14%{opacity:1;transform:translate3d(0,0,160px) rotateX(-4deg)}40%{opacity:1;transform:translate3d(0,0,0) rotateX(0deg)}100%{opacity:0;transform:translate3d(0,-10%,-2800px) rotateX(16deg)}}
.ab-logo{position:absolute;left:0;right:0;top:50%;display:flex;flex-direction:column;align-items:center;transform-style:preserve-3d;margin-top:-17vmin}
.ab-lw{position:relative;overflow:hidden;width:min(80vw,460px);animation:abLogo 2s cubic-bezier(.2,.85,.25,1.04) 2.05s both;will-change:transform,opacity;filter:drop-shadow(0 18px 26px rgba(0,0,0,.7)) drop-shadow(0 0 40px rgba(229,9,20,.25))}
.ab-lw img{display:block;width:100%}
.ab-lw::after{content:"";position:absolute;top:0;bottom:0;width:38%;left:-50%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-18deg);animation:abBrilho 1.1s ease 4.15s both}
@keyframes abLogo{0%{transform:translate3d(0,0,-2600px) rotateY(-78deg) rotateX(12deg);opacity:0}45%{opacity:1}78%{transform:translate3d(0,0,90px) rotateY(7deg) rotateX(-2deg);opacity:1}100%{transform:translate3d(0,0,0) rotateY(0) rotateX(0);opacity:1}}
@keyframes abBrilho{to{left:130%}}
.ab-linha{height:2px;width:min(62vw,340px);margin-top:22px;background:linear-gradient(90deg,transparent,#E50914,transparent);transform:scaleX(0);animation:abLinha .9s ease 4.0s forwards}
@keyframes abLinha{to{transform:scaleX(1)}}
.ab-sec{margin-top:14px;font-weight:800;font-size:clamp(12px,3.4vw,19px);color:#9ca3af;text-transform:uppercase;letter-spacing:.2em;opacity:0;animation:abSec 1.3s cubic-bezier(.2,.8,.2,1) 4.1s forwards;white-space:nowrap}
.ab-sec i{color:#E50914;font-style:normal;margin:0 .5em}
@keyframes abSec{from{opacity:0;letter-spacing:.05em;transform:translateZ(-300px)}to{opacity:1;letter-spacing:.5em}}
@keyframes abSai{to{opacity:0;visibility:hidden}}
.ab-pular{position:absolute;right:calc(16px + env(safe-area-inset-right,0px));bottom:calc(20px + env(safe-area-inset-bottom,0px));background:transparent;border:1px solid #475569;color:#9ca3af;padding:8px 16px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;z-index:2}
@media (prefers-reduced-motion:reduce){.ab,.ab *{animation:none!important;transition:none!important}.ab-frase{display:none}.ab-lw{opacity:1}.ab-linha{transform:none}.ab-sec{opacity:1;letter-spacing:.4em}.ab-piso{opacity:.5}}
`;

const reduzido = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function AberturaMoked({ logo, onFim }) {
  const cena = useRef(null);
  const fim = useRef(onFim);
  fim.current = onFim;
  useEffect(() => {
    const t = setTimeout(() => fim.current && fim.current(), reduzido() ? 1400 : DURACAO_ABERTURA_MS);
    return () => clearTimeout(t);
  }, []);
  const mover = (e) => {
    if (reduzido() || !cena.current) return;
    const x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5;
    cena.current.style.setProperty("--ry", `${(x * 7).toFixed(1)}deg`);
    cena.current.style.setProperty("--rx", `${(-y * 5).toFixed(1)}deg`);
  };
  return (
    <div className="ab" data-testid="entrada-abertura" role="presentation" onClick={() => onFim && onFim()} onPointerMove={mover}>
      <style>{CSS}</style>
      <div className="ab-cena" ref={cena}>
        <div className="ab-piso" aria-hidden="true" />
        <div className="ab-frase" aria-label="O software por trás do hardware">
          <p>o software</p><p>por trás</p><p>do hardware</p>
        </div>
        <div className="ab-logo">
          <div className="ab-lw"><img src={logo} alt="Moked" onError={(e) => { e.currentTarget.style.display = "none"; }} /></div>
          <div className="ab-linha" aria-hidden="true" />
          <div className="ab-sec">Security<i>·</i>Consulting</div>
        </div>
      </div>
      <button type="button" className="ab-pular" onClick={(e) => { e.stopPropagation(); onFim && onFim(); }}>Pular</button>
    </div>
  );
}
