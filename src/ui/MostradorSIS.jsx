// Mostrador SIS em 3D sutil (Marcio, 19/11/2026). Só para as telas de vitrine: abertura e cards do início do MokLog.
// Dentro dos projetos e dos formulários de preenchimento o visual continua o de sempre.
// Modo "valor": ponteiro em `valor` (0–100, 0% na base, 100% no topo). Modo "scan": ponteiro varre a escala sem número,
// usado na abertura (decorativo, não afirma nenhuma nota).
import { useEffect, useRef, useState } from "react";

const ESTILO_ID = "mk-mostrador-css";
export const CSS_MOSTRADOR = `
.mkd{--s:300px;--k:.6;--a:80;--d:.2s;width:var(--s);height:var(--s);position:relative;perspective:calc(var(--s)*3.2);flex:none;margin:calc(var(--s)*.045);max-width:100%;color:#f3f4f6;font-family:inherit}
.mkd-tilt{position:absolute;inset:0;transform-style:preserve-3d;transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .28s ease-out}
.mkd-tilt>*{position:absolute;border-radius:50%}
.mkd-rim{inset:calc(var(--k)*-2.6% - 1%);background:conic-gradient(from 210deg,#5a5a65,#17171c 18%,#80808c 38%,#1b1b21 58%,#6e6e79 78%,#5a5a65);box-shadow:0 calc(var(--s)*.05*var(--k)) calc(var(--s)*.09) rgba(0,0,0,.6),0 0 calc(var(--s)*.24) rgba(229,9,20,.15);transform:translateZ(calc(var(--s)*-.012*var(--k)))}
.mkd-well{inset:calc(var(--k)*-1% - .2%);background:#040406;box-shadow:inset 0 calc(var(--s)*.015) calc(var(--s)*.03) #000;transform:translateZ(calc(var(--s)*-.006*var(--k)))}
.mkd-ring{inset:0;background:conic-gradient(from 180deg,#b91c1c 0deg,#ef4444 25deg,#f97316 55deg,#facc15 95deg,#84cc16 135deg,#16a34a 180deg,#84cc16 225deg,#facc15 265deg,#f97316 305deg,#ef4444 335deg,#b91c1c 360deg);-webkit-mask:radial-gradient(circle,transparent 58%,#000 59%,#000 70%,transparent 71%);mask:radial-gradient(circle,transparent 58%,#000 59%,#000 70%,transparent 71%)}
.mkd-sheen{inset:0;background:conic-gradient(from 0deg,transparent 0 66%,rgba(255,255,255,calc(.34*var(--k))) 78%,transparent 90%);-webkit-mask:radial-gradient(circle,transparent 58%,#000 59%,#000 70%,transparent 71%);mask:radial-gradient(circle,transparent 58%,#000 59%,#000 70%,transparent 71%);transform:translateZ(calc(var(--s)*.008*var(--k)));animation:mkdSpin 8s linear infinite}
@keyframes mkdSpin{to{transform:translateZ(calc(var(--s)*.008*var(--k))) rotate(360deg)}}
.mkd-face{inset:16%;background:radial-gradient(circle at 50% 35%,#1f1f26,#09090b 72%);box-shadow:inset 0 calc(var(--s)*.025) calc(var(--s)*.05) #000,inset 0 calc(var(--s)*-.006) 0 #ffffff14,0 0 0 calc(var(--s)*.008) #000;transform:translateZ(calc(var(--s)*.012*var(--k)))}
.mkd-ticks{inset:0;width:100%;height:100%;border-radius:0;transform:translateZ(calc(var(--s)*.014*var(--k)))}
.mkd-needle{inset:0;--z:calc(var(--s)*.05*var(--k));transform:translateZ(var(--z)) rotate(calc(var(--a)*-1.8deg));animation:mkdSweep 2.1s cubic-bezier(.3,.7,.3,1) var(--d) backwards}
.mkd-needle svg{width:100%;height:100%;display:block;overflow:visible;filter:drop-shadow(0 calc(var(--s)*.014*var(--k)) calc(var(--s)*.012) rgba(0,0,0,.75)) drop-shadow(0 0 calc(var(--s)*.014) #fffa)}
@keyframes mkdSweep{0%{transform:translateZ(var(--z)) rotate(0deg)}72%{transform:translateZ(var(--z)) rotate(calc(var(--a)*-1.8deg - 8deg))}100%{transform:translateZ(var(--z)) rotate(calc(var(--a)*-1.8deg))}}
.mkd.scan .mkd-needle{animation:mkdScan 5.2s cubic-bezier(.45,.05,.35,1) var(--d) infinite alternate}
@keyframes mkdScan{0%{transform:translateZ(var(--z)) rotate(-14deg)}100%{transform:translateZ(var(--z)) rotate(-166deg)}}
.mkd-glass{inset:16%;background:radial-gradient(120% 70% at 30% 8%,rgba(255,255,255,calc(.11*var(--k))),transparent 55%);transform:translateZ(calc(var(--s)*.07*var(--k)));pointer-events:none}
.mkd-txt{inset:16%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:calc(var(--s)*.012);transform:translateZ(calc(var(--s)*.04*var(--k)))}
.mkd-top{font-weight:900;letter-spacing:calc(var(--s)*.016);font-size:calc(var(--s)*.05);color:#f3f4f6}
.mkd-num{font-weight:900;font-size:calc(var(--s)*.173);letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1;color:#f3f4f6}
.mkd-sis{font-weight:900;font-style:italic;font-size:calc(var(--s)*.15);letter-spacing:1px;line-height:1;color:#f3f4f6}
.mkd-sis sup{color:#FF1E27}
.mkd-sub{font-size:calc(var(--s)*.03);color:#9ca3af;letter-spacing:1px;text-transform:uppercase;white-space:nowrap}
.mkd.mini{--s:56px}
.mkd.mini .mkd-num{font-size:calc(var(--s)*.27)}
.mkd.mini .mkd-needle line{stroke-width:9}
.mkd.mini .mkd-ticks{display:none}
.mkd.vazio .mkd-needle{display:none}
.mkd.vazio .mkd-num{color:#6b7280}
/* Brilho (Marcio, 19/11): reflexo suave nos cards de vitrine. Não muda tamanho nem posição de nada. */
.mk-brilho{position:relative;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease}
.mk-brilho::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(155deg,rgba(255,255,255,.13) 0%,rgba(255,255,255,.04) 28%,transparent 46%);box-shadow:inset 0 1px 0 rgba(255,255,255,.22)}
.mk-brilho::after{content:"";position:absolute;top:0;bottom:0;width:46%;left:-60%;pointer-events:none;background:linear-gradient(100deg,transparent,rgba(255,255,255,.16),transparent);transform:skewX(-18deg);animation:mkBrilho 7s ease-in-out 1.2s infinite}
@keyframes mkBrilho{0%,62%{left:-60%}100%{left:130%}}
.mk-brilho{transform:perspective(800px) rotateX(var(--crx,0deg)) rotateY(var(--cry,0deg));filter:drop-shadow(0 12px 12px rgba(0,0,0,.34))}
.mk-brilho:active{filter:drop-shadow(0 4px 6px rgba(0,0,0,.3))}
@media (hover:none){.mk-brilho{animation:mkSway 8s ease-in-out infinite alternate}.mk-brilho:nth-child(2n){animation-delay:-2.7s;animation-duration:9.5s}.mk-brilho:nth-child(3n){animation-delay:-5.1s}}
@keyframes mkSway{0%{transform:perspective(800px) rotateX(2.4deg) rotateY(-3deg)}100%{transform:perspective(800px) rotateX(-2.4deg) rotateY(3deg)}}
@media (prefers-reduced-motion:reduce){.mkd-needle,.mkd-sheen,.mk-brilho,.mk-brilho::after{animation:none!important}.mkd-tilt,.mk-brilho{transition:none}}
`;
if (typeof document !== "undefined" && !document.getElementById(ESTILO_ID)) {
  const el = document.createElement("style");
  el.id = ESTILO_ID;
  el.textContent = CSS_MOSTRADOR;
  document.head.appendChild(el);
}

const TICKS = Array.from({ length: 60 }, (_, i) => {
  const u = (i * 6 * Math.PI) / 180, r1 = i % 5 ? 126 : 121, r2 = 130;
  return { i, x1: 150 + Math.sin(u) * r1, y1: 150 - Math.cos(u) * r1, x2: 150 + Math.sin(u) * r2, y2: 150 - Math.cos(u) * r2, forte: i % 5 === 0 };
});

const reduzido = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Número que sobe até o valor (só na primeira vez em que aparece).
function useContagem(alvo, atrasoMs, ligado) {
  const [n, setN] = useState(ligado && !reduzido() ? 0 : alvo);
  useEffect(() => {
    if (typeof alvo !== "number") return undefined;
    if (!ligado || reduzido() || typeof requestAnimationFrame === "undefined") { setN(alvo); return undefined; }
    let raf; const t0 = performance.now(), dur = 1500;
    const tick = (t) => {
      const p = Math.min(1, Math.max(0, (t - t0 - atrasoMs) / dur));
      setN(Math.round(alvo * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [alvo, atrasoMs, ligado]);
  return typeof alvo === "number" ? n : null;
}

/**
 * valor: número 0–100 (ou null/undefined = "sem dado")
 * tamanho: px do diâmetro; mini: versão de card (só o %)
 * scan: ponteiro varrendo, sem número (abertura)
 * intensidade: 0.6 sutil (padrão) · 1.3 marcado
 */
export default function MostradorSIS({ valor = null, tamanho, mini = false, scan = false, intensidade = 0.6, atraso = 0.2, inclinar = false, rotulo = "MOKED", legenda = "Sistema Integrado de Segurança", className = "", style }) {
  const ref = useRef(null);
  const tem = typeof valor === "number" && !scan;
  const n = useContagem(tem ? Math.max(0, Math.min(100, valor)) : null, atraso * 1000 + 250, !mini);
  const v = tem ? Math.max(0, Math.min(100, valor)) : 0;

  // Inclinação com o dedo/mouse (só onde pedido; respeita movimento reduzido).
  const mover = (e) => {
    if (!inclinar || reduzido() || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.setProperty("--ry", `${(x * 14).toFixed(1)}deg`);
    ref.current.style.setProperty("--rx", `${(-y * 14).toFixed(1)}deg`);
  };
  const soltar = () => { if (ref.current) { ref.current.style.setProperty("--ry", "0deg"); ref.current.style.setProperty("--rx", "0deg"); } };

  const vars = { "--k": intensidade, "--a": v, "--d": `${atraso}s`, ...(tamanho ? { "--s": `${tamanho}px` } : null), ...style };
  const aria = scan ? "Mostrador SIS+ (decorativo)" : tem ? `SIS ${v}%` : "Sem dados";
  return (
    <div ref={ref} className={`mkd${mini ? " mini" : ""}${scan ? " scan" : ""}${tem || scan ? "" : " vazio"} ${className}`.trim()} style={vars}
      role="img" aria-label={aria} data-testid="mostrador-sis" onPointerMove={mover} onPointerLeave={soltar}>
      <div className="mkd-tilt">
        <div className="mkd-rim" /><div className="mkd-well" /><div className="mkd-ring" /><div className="mkd-sheen" /><div className="mkd-face" />
        <svg className="mkd-ticks" viewBox="0 0 300 300" aria-hidden="true">
          {TICKS.map((t) => <line key={t.i} x1={t.x1.toFixed(2)} y1={t.y1.toFixed(2)} x2={t.x2.toFixed(2)} y2={t.y2.toFixed(2)} stroke={t.forte ? "#000000aa" : "#00000066"} strokeWidth={t.forte ? 2 : 1} />)}
        </svg>
        <div className="mkd-needle">
          <svg viewBox="0 0 300 300" aria-hidden="true"><line x1="150" y1="236" x2="150" y2="270" stroke="#f3f4f6" strokeWidth="3" strokeLinecap="round" /><polygon points="150,284 143.15,247.8 156.85,247.8" fill="#f3f4f6" /></svg>
        </div>
        <div className="mkd-glass" />
        <div className="mkd-txt">
          {scan
            ? <><div className="mkd-top">{rotulo}</div><div className="mkd-sis">SIS<sup>+</sup></div><div className="mkd-sub">{legenda}</div></>
            : mini
              ? <div className="mkd-num">{tem ? `${v}%` : "—"}</div>
              : <><div className="mkd-top">{rotulo}</div><div className="mkd-num">{tem ? `${n}%` : "—"}</div></>}
        </div>
      </div>
    </div>
  );
}

// Inclinação do card com o ponteiro (mouse/caneta; no toque o card balança sozinho, devagar).
export function inclinarCard(e) {
  if (e.pointerType === "touch" || reduzido()) return;
  const el = e.currentTarget, r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty("--cry", `${(x * 9).toFixed(1)}deg`);
  el.style.setProperty("--crx", `${(-y * 9).toFixed(1)}deg`);
}
export function soltarCard(e) { e.currentTarget.style.setProperty("--cry", "0deg"); e.currentTarget.style.setProperty("--crx", "0deg"); }
