// "Escolha a sua área" em esfera (Marcio, 22/11/2026): gira-se a esfera com o dedo; a área que centraliza troca o cenário inteiro
// (foto de public/moked/cenarios/<id>.jpg). "Acessar área" segue o fluxo de sempre (onAcessar). Sem canvas 2D → aoFalhar (cartões).
import { useEffect, useRef, useState } from "react";
import { iniciarEsfera } from "./esferaMotor";

export const cenarioDivisao = (id) => `/moked/cenarios/${id}.jpg`;
const CSS = `
.mk-esf{position:fixed;inset:0;overflow:hidden;background:#05070d;color:#f2f5fa;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;animation:mkEsfIn .6s ease}
@keyframes mkEsfIn{from{opacity:0}to{opacity:1}}
.mk-esf-bg{position:absolute;inset:-6%;background-size:cover;background-position:center;opacity:0;transition:opacity .9s ease;will-change:transform,opacity}
.mk-esf-bg.on{opacity:1}
.mk-esf-dim{position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom,rgba(3,5,10,.72) 0,rgba(3,5,10,.2) 13%,transparent 22%,transparent 68%,rgba(3,5,10,.6) 86%,rgba(3,5,10,.88) 100%)}
.mk-esf canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.mk-esf-dim,.mk-esf canvas,.mk-esf-nos,.mk-esf-hud{transition:opacity .4s}
.mk-esf.indo .mk-esf-dim,.mk-esf.indo canvas,.mk-esf.indo .mk-esf-nos,.mk-esf.indo .mk-esf-hud{opacity:0}
.mk-esf-nos{position:absolute;inset:0;pointer-events:none}
.mk-esf-no{position:absolute;left:0;top:0;cursor:pointer;white-space:nowrap;font-weight:800;font-size:14px;line-height:1;color:#fff;padding:8px 6px;opacity:0;text-shadow:0 1px 8px rgba(0,0,0,.95),0 0 3px rgba(0,0,0,.8);will-change:transform,opacity}
.mk-esf em{font-style:normal;color:#ff4a3c}
.mk-esf-top{position:absolute;left:0;right:0;top:0;padding:max(12px,env(safe-area-inset-top,0px)) 16px 0;display:flex;flex-direction:column;align-items:center;gap:7px;pointer-events:none}
.mk-esf-top img{width:min(46vw,220px);height:auto;filter:drop-shadow(0 4px 12px rgba(0,0,0,.7))}
.mk-esf-tit{display:flex;align-items:center;gap:10px;width:100%;max-width:360px}
.mk-esf-tit i{flex:1;height:1px;background:linear-gradient(90deg,transparent,#ff4a3c)}
.mk-esf-tit i:last-child{background:linear-gradient(270deg,transparent,#ff4a3c)}
.mk-esf-tit span{font-weight:700;letter-spacing:.3em;font-size:clamp(10px,2.9vw,13px);white-space:nowrap;text-transform:uppercase;text-shadow:0 2px 8px #000}
.mk-esf-dica{font-weight:600;font-size:10px;letter-spacing:.24em;color:#dfe6f3;text-shadow:0 2px 8px #000;text-transform:uppercase}
.mk-esf-hud{position:absolute;left:0;right:0;bottom:0;padding:0 16px max(12px,env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:center;gap:9px;pointer-events:none}
.mk-esf-info{text-align:center;text-shadow:0 2px 14px rgba(0,0,0,.9),0 0 2px rgba(0,0,0,.6)}
.mk-esf-cnt{font-weight:600;font-size:10px;letter-spacing:.32em;color:#b9c3d6}
.mk-esf-nm{font-weight:900;font-size:clamp(34px,10.5vw,46px);line-height:1.05;color:#fff}
.mk-esf-sub{display:inline-block;white-space:nowrap;margin-top:5px;padding:4px 12px 5px;font-weight:700;font-size:clamp(10.5px,3vw,12.5px);letter-spacing:.18em;text-transform:uppercase;color:#fff;border-left:2px solid #ff4a3c;border-right:2px solid #ff4a3c;background:rgba(210,47,33,.28);text-shadow:none}
.mk-esf-sub.breve{border-color:#8792a6;background:rgba(40,46,58,.4);color:#d5dbe8}
.mk-esf-row{display:flex;gap:10px;width:min(100%,400px)}
.mk-esf-row button{flex:1;pointer-events:auto;cursor:pointer;text-align:center;padding:13px 6px;font-weight:800;font-size:12.5px;letter-spacing:.16em;white-space:nowrap;text-transform:uppercase;border:0;box-shadow:none}
.mk-esf-go{color:#fff;background:linear-gradient(180deg,rgba(214,50,36,.94),rgba(160,32,26,.94));clip-path:polygon(0 0,100% 0,100% 62%,93% 100%,0 100%)}
.mk-esf-go.breve{background:rgba(38,43,54,.7);color:#c3cbd9}
.mk-esf-row .mk-esf-cli{color:#eef2f8;border:1px solid rgba(255,255,255,.3);background:rgba(8,12,20,.38);font-weight:700}
.mk-esf-links{display:flex;gap:18px;pointer-events:auto}
.mk-esf-links button{background:transparent;border:0;color:#c9d2e2;opacity:.6;font-size:10.5px;letter-spacing:.12em;cursor:pointer;padding:6px 4px;text-transform:lowercase;text-shadow:0 1px 6px #000}
`;
const partes = (nome) => [nome.slice(0, 3), nome.slice(3)];

export default function AreasEsfera({ divisoes, logo, onAcessar, onCliente, onVoltarAbertura, onLista, aoFalhar, inicial = 0 }) {
  const raiz = useRef(null), canvas = useRef(null), nos = useRef([]), fundos = useRef([]), motor = useRef(null), saida = useRef(0);
  const [ativo, setAtivo] = useState(inicial), [indo, setIndo] = useState(false);
  const [carregar, setCarregar] = useState(() => new Set([inicial]));
  useEffect(() => {
    const m = iniciarEsfera({ raiz: raiz.current, canvas: canvas.current, nos: nos.current, fundos: fundos.current, inicial, aoAtivar: setAtivo });
    if (!m) { if (aoFalhar) aoFalhar(); return undefined; }
    motor.current = m; return () => { m.parar(); clearTimeout(saida.current); };
  }, []); // monta uma vez
  const n = divisoes.length;
  // Baixa só o cenário da área ativa e dos vizinhos (não as seis fotos de uma vez).
  useEffect(() => { setCarregar((s) => { const k = new Set(s); [ativo, (ativo + 1) % n, (ativo + n - 1) % n].forEach((i) => k.add(i)); return k.size === s.size ? s : k; }); }, [ativo, n]);
  const d = divisoes[ativo] || divisoes[0], [a, b] = partes(d.nome);
  const acessar = () => {
    if (!d.ativo) { onAcessar(d); return; }
    setIndo(true); if (motor.current) motor.current.aproximar(); // a esfera some e fica só o ambiente, depois entra
    saida.current = setTimeout(() => onAcessar(d), 480);
  };
  return <main ref={raiz} className={`mk-esf${indo ? " indo" : ""}`} data-testid="entrada-areas" data-modo="esfera">
    <style>{CSS}</style>
    {divisoes.map((x, i) => <div key={x.id} ref={(el) => { fundos.current[i] = el; }} className={`mk-esf-bg${i === ativo ? " on" : ""}`} style={carregar.has(i) ? { backgroundImage: `url(${cenarioDivisao(x.id)})` } : undefined} aria-hidden="true" />)}
    <div className="mk-esf-dim" aria-hidden="true" />
    <canvas ref={canvas} aria-hidden="true" />
    <div className="mk-esf-nos">{divisoes.map((x, i) => { const [p, q] = partes(x.nome); return <div key={x.id} ref={(el) => { nos.current[i] = el; }} className="mk-esf-no" data-no={i}>{p} <em>{q}</em></div>; })}</div>
    <div className="mk-esf-top">
      <img src={logo} alt="Moked" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <div className="mk-esf-tit"><i /><span>Escolha a sua área</span><i /></div>
      <div className="mk-esf-dica">Gire a esfera</div>
    </div>
    <div className="mk-esf-hud">
      <div className="mk-esf-info">
        <div className="mk-esf-cnt">ÁREA {String(ativo + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</div>
        <div className="mk-esf-nm" data-testid="esfera-nome">{a} <em>{b}</em></div>
        <div className={`mk-esf-sub${d.ativo ? "" : " breve"}`}>{d.sub}</div>
      </div>
      <div className="mk-esf-row">
        <button type="button" className={`mk-esf-go${d.ativo ? "" : " breve"}`} data-testid="esfera-acessar" onClick={acessar}>{d.ativo ? "Acessar área ›" : "Em breve ›"}</button>
        <button type="button" className="mk-esf-cli" aria-label="Área do Cliente" onClick={onCliente}>Área do Cliente ›</button>
      </div>
      <div className="mk-esf-links">
        <button type="button" data-testid="esfera-lista" onClick={onLista}>ver em lista</button>
        <button type="button" data-testid="voltar-abertura" aria-label="Voltar à abertura" onClick={onVoltarAbertura}>↺ voltar à abertura</button>
      </div>
    </div>
  </main>;
}
