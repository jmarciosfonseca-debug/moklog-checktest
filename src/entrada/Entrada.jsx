// Porta de entrada da plataforma Moked (decisão do Marcio, 20/10): logo centralizado → "Entrar" → vídeo curto de
// introdução (public/moked/intro.mp4, ~14 s; se não existir ou falhar, pula) → "Escolha a sua área" (divisões) com a
// Área do Cliente no topo. MokLog abre o app atual; as demais divisões ficam "em breve" até existirem.
import { useEffect, useRef, useState } from "react";
import MostradorSIS from "../ui/MostradorSIS";
import AberturaSIS from "./AberturaSIS";

export const DIVISOES = [
  { id: "moklog", nome: "MokLog", sub: "Condomínios logísticos", ativo: true, cor: "#E50914" },
  { id: "mokpat", nome: "MokPat", sub: "Patrimonial", ativo: true, cor: "#E50914" },
  { id: "mokvip", nome: "MokVip", sub: "Executivos e eventos", ativo: false, cor: "#a855f7" },
  { id: "mokres", nome: "MokRes", sub: "Residencial", ativo: false, cor: "#22c55e" },
  { id: "mokimp", nome: "MokImp", sub: "Implantação", ativo: true, cor: "#E50914" },
  { id: "moktec", nome: "MokTec", sub: "Tecnologia", ativo: false, cor: "#e11d48" },
];
export const logoDivisao = (id) => `/moked/divisoes/${id}.jpg`;
export const LOGO_MOKED_URL = "/moked/logo-moked-escuro.svg"; // logo oficial (12/11/2026), versão para fundo escuro, vetorial
export const VIDEO_INTRO_URL = "/moked/intro.mp4";
// O vídeo toca a cada entrada (decisão do Marcio); "Pular" fica sempre visível.

// Fundo = a mesma cor do PNG do logo (#0b0f19), para o logo não aparecer como um retângulo.
const fundo = { minHeight: "100vh", background: "#0b0f19", color: "#e5e7eb", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 };
const chanfro = "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";
const botaoVermelho = { background: "#B91C1C", color: "#fff", border: "none", padding: "13px 38px", fontWeight: 900, letterSpacing: 2.5, fontSize: 14, cursor: "pointer", clipPath: chanfro, boxShadow: "none", textTransform: "uppercase" };

const reducao = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Áreas "flutuando" (Marcio, 20/11/2026): cartões levitam com sombra no chão, inclinação leve com o dedo/mouse, fundo com o anel do SIS
// bem apagado e piso em perspectiva. A Área do Cliente fica larga, mais abaixo.
const CSS_AREAS = `
.mk-flut{position:relative;overflow:hidden;perspective:900px;perspective-origin:50% 38%;background:radial-gradient(90% 60% at 50% 30%,#1a0a0e 0%,#0b0f19 58%,#05070c 100%) !important}
.mk-flut-anel{position:absolute;left:50%;top:34%;width:min(150vw,900px);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;opacity:.16;background:conic-gradient(from 180deg,#b91c1c,#ef4444 25deg,#f97316 55deg,#facc15 95deg,#84cc16 135deg,#16a34a 180deg,#84cc16 225deg,#facc15 265deg,#f97316 305deg,#ef4444 335deg,#b91c1c);-webkit-mask:radial-gradient(circle,transparent 58%,#000 59%,#000 70%,transparent 71%);mask:radial-gradient(circle,transparent 58%,#000 59%,#000 70%,transparent 71%)}
.mk-flut-piso{position:absolute;left:-60%;right:-60%;bottom:-10%;height:50%;transform-origin:50% 100%;transform:rotateX(74deg);pointer-events:none;background:repeating-linear-gradient(90deg,rgba(229,9,20,.16) 0 1px,transparent 1px 56px),repeating-linear-gradient(0deg,rgba(229,9,20,.16) 0 1px,transparent 1px 56px);-webkit-mask:linear-gradient(0deg,#000,transparent 85%);mask:linear-gradient(0deg,#000,transparent 85%);animation:mkPiso 6s linear infinite}
@keyframes mkAreasIn{from{opacity:0}to{opacity:1}}
@keyframes mkPiso{to{background-position:0 56px,0 56px}}
.mk-flut .mk-areas-wrap{position:relative;transform-style:preserve-3d;transform:rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .3s ease-out;display:flex;flex-direction:column}
.mk-flut .mk-areas-grid{transform-style:preserve-3d}
.mk-t{position:relative;transform-style:preserve-3d;opacity:0;translate:0 40px;animation:mkEnt .9s cubic-bezier(.2,.8,.2,1) calc(.15s + var(--i)*.09s) forwards,mkFlut 6.4s ease-in-out calc(var(--d)) infinite}
.mk-t::after{content:"";position:absolute;left:14%;right:14%;bottom:-15px;height:12px;border-radius:50%;background:radial-gradient(rgba(0,0,0,.7),transparent 70%);animation:mkSombra 6.4s ease-in-out calc(var(--d)) infinite;pointer-events:none}
.mk-t > button{filter:drop-shadow(0 10px 14px rgba(0,0,0,.55));transition:filter .2s}
.mk-t > button:active{filter:brightness(1.12)}
.mk-flut .mk-cli{margin-top:44px}
.mk-flut .mk-cli::after{bottom:-19px}
@keyframes mkEnt{to{opacity:1;translate:0 0}}
@keyframes mkFlut{0%,100%{transform:translateZ(var(--z,30px)) translateY(0) rotateX(0)}50%{transform:translateZ(var(--z,30px)) translateY(-8px) rotateX(2.5deg)}}
@keyframes mkSombra{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(.82);opacity:.5}}
@media (prefers-reduced-motion:reduce){.mk-t,.mk-t::after,.mk-flut-piso{animation:none!important}.mk-t{opacity:1;translate:0 0}}
@media (min-width:1024px){.mk-flut .mk-areas-wrap{max-width:1040px !important}.mk-flut .mk-cli{max-width:520px;width:100%;margin-left:auto;margin-right:auto;margin-top:56px}}
`;

export default function Entrada({ onEscolher, logo = LOGO_MOKED_URL, video = VIDEO_INTRO_URL, pularVideo = true, etapaInicial = "splash", comAbertura = false, onAberturaFim }) {
  const [etapa, setEtapa] = useState(comAbertura && etapaInicial === "splash" ? "abertura" : etapaInicial); // abertura | splash | video | areas | construcao
  const veioDaAbertura = useRef(comAbertura);
  const [emConstrucao, setEmConstrucao] = useState(null);
  const vid = useRef(null);
  const [bloqueado, setBloqueado] = useState(false); // navegador recusou o autoplay → mostra "Tocar"
  // Vídeo antigo desligado (texto "Moqued", logo antigo, "Mok Dir"). Volta com pularVideo={false} quando houver abertura nova aprovada.
  const entrar = () => { if (pularVideo) setEtapa("areas"); else setEtapa("video"); };
  const fimVideo = () => setEtapa("areas");
  const tocar = () => { const v = vid.current; if (!v) return; const r = v.play(); if (r && r.catch) r.then(() => setBloqueado(false)).catch(() => setBloqueado(true)); };

  useEffect(() => { if (etapa !== "video") return undefined; tocar(); const t = setTimeout(fimVideo, 25000); return () => clearTimeout(t); }, [etapa]); // nunca prende o usuário

  if (etapa === "abertura") return <AberturaSIS onFim={() => { setEtapa("areas"); if (onAberturaFim) onAberturaFim(); }} />; // órbita do SIS → qualquer toque vai às Áreas (sem "Entrar")

  // No computador (padrão de site): marca e texto à esquerda, acesso à direita. No celular: como sempre, tudo centralizado.
  if (etapa === "splash") return <main style={veioDaAbertura.current ? { ...fundo, animation: "mkFadeIn .6s ease" } : fundo} className="mk-entrada" data-testid="entrada-splash">
    <div className="mk-entrada-hero">
      <img src={logo} alt="Moked Security Consulting" style={{ width: "min(78vw, 360px)", borderRadius: 18, padding: "18px 22px", background: "#0b0f19", boxShadow: "0 0 0 1px #475569" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <div className="mk-frase" data-testid="entrada-frase"><b>MOKED</b> · o software por trás do hardware</div>
      <div className="mk-so-pc">
        <h1>Moked <span>CheckTest</span></h1>
        <p>A operação de segurança de cada projeto em um só lugar: testes, equipe, rondas e a nota que explica como o projeto está hoje.</p>
      </div>
    </div>
    <div className="mk-entrada-acesso">
      <div className="mk-entrada-dial"><MostradorSIS scan inclinar tamanho={190} intensidade={0.6} atraso={0.3} /></div>
      <div className="mk-entrar" style={{ marginTop: 18 }}><button onClick={entrar} style={botaoVermelho}>Entrar</button></div>
      <div style={{ marginTop: 14, fontSize: 10.5, color: "#6b7280", letterSpacing: 1 }}>SECURITY · CONSULTING</div>
    </div>
  </main>;

  if (etapa === "video") return <main style={{ ...fundo, padding: 0, background: "#000" }} data-testid="entrada-video">
    <video ref={vid} src={video} autoPlay muted playsInline preload="auto" onEnded={fimVideo} onError={fimVideo} onPlaying={() => setBloqueado(false)} style={{ width: "100%", maxWidth: 560, maxHeight: "80vh", background: "#000" }} />
    {bloqueado && <button onClick={tocar} style={{ ...botaoVermelho, position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>▶ Tocar vídeo</button>}
    <button onClick={fimVideo} style={{ ...botaoVermelho, position: "fixed", right: 16, bottom: 20, padding: "8px 16px", fontSize: 11, letterSpacing: 1.5 }}>Pular</button>
  </main>;

  if (emConstrucao) return <main style={fundo} data-testid="entrada-construcao">
    {emConstrucao.semLogo
      ? <div style={{ width: "min(70vw, 300px)", background: "#fff", padding: "18px 16px", clipPath: chanfro, textAlign: "center", fontWeight: 900, letterSpacing: 3, fontSize: 20, color: "#0b0b0e" }}>CENTRAL <span style={{ color: "#E50914" }}>MOKED</span></div>
      : <img src={logoDivisao(emConstrucao.id)} alt={emConstrucao.nome} style={{ width: "min(70vw, 300px)", background: "#fff", padding: "10px 16px", clipPath: chanfro }} />}
    <div style={{ marginTop: 22, fontSize: 18, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>Em construção</div>
    <div style={{ marginTop: 6, fontSize: 12, color: "#9ca3af", textAlign: "center", maxWidth: 320 }}>A área {emConstrucao.nome} ({emConstrucao.sub}) ainda está sendo construída na plataforma Moked.</div>
    {emConstrucao.oferece && <div style={{ marginTop: 18, width: "100%", maxWidth: 360, background: "linear-gradient(160deg,#121216,#0b0b0e)", border: "1px solid #2a2a31", padding: "14px 16px", clipPath: chanfro }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>O que vai oferecer</div>
      {emConstrucao.oferece.map((t) => <div key={t} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "#e5e7eb", lineHeight: 1.45, marginBottom: 6 }}><span style={{ color: "#E50914", fontWeight: 900 }}>›</span><span>{t}</span></div>)}
    </div>}
    <div style={{ marginTop: 26 }}><button onClick={() => setEmConstrucao(null)} style={botaoVermelho}>Voltar</button></div>
  </main>;

  const inclinar = (e) => { if (reducao()) return; const w = e.currentTarget.querySelector(".mk-areas-wrap"); if (!w) return; w.style.setProperty("--ry", ((e.clientX / window.innerWidth - 0.5) * 8).toFixed(1) + "deg"); w.style.setProperty("--rx", (-(e.clientY / window.innerHeight - 0.5) * 6).toFixed(1) + "deg"); };
  return <main style={{ ...fundo, justifyContent: "flex-start", padding: "34px 20px 24px", animation: veioDaAbertura.current ? "mkAreasIn .7s ease" : undefined }} className="mk-areas mk-flut" data-testid="entrada-areas" onPointerMove={inclinar}>
    <style>{CSS_AREAS}</style>
    <div className="mk-flut-anel" aria-hidden="true" />
    <div className="mk-flut-piso" aria-hidden="true" />
    <img src={logo} alt="Moked" style={{ width: 190, marginBottom: 6, position: "relative" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
    <div className="mk-areas-wrap" style={{ width: "100%", maxWidth: 480 }}>
      <div className="mk-flut-tit" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.5, color: "#9ca3af", textTransform: "uppercase", textAlign: "center", marginBottom: 16 }}>Escolha a sua área</div>
      <div className="mk-areas-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 14px" }}>
        {DIVISOES.map((d, i) => <div key={d.id} className="mk-t" style={{ "--i": i, "--d": `${-i * 1.1}s`, "--z": `${24 + (i % 2) * 16}px`, "--c": d.cor, gridColumn: d.largo ? "1 / -1" : "auto" }}><button aria-label={d.nome} onClick={() => (d.ativo ? onEscolher(d.id) : setEmConstrucao(d))}
          style={{ background: "#fff", border: `2px solid ${d.ativo ? d.cor : "#2a2a31"}`, padding: 0, cursor: "pointer", clipPath: chanfro, boxShadow: "none", opacity: d.ativo ? 1 : .6, position: "relative", overflow: "hidden", width: "100%", display: "block" }}>
          {d.semLogo
            ? <div style={{ height: 76, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, letterSpacing: 3, fontSize: 18, color: "#0b0b0e", paddingBottom: 14 }}>CENTRAL <span style={{ color: "#E50914", marginLeft: 6 }}>MOKED</span></div>
            : <img src={logoDivisao(d.id)} alt={d.nome} style={{ display: "block", width: "100%", height: 76, objectFit: "contain", background: "#fff", padding: "8px 14px", boxSizing: "border-box" }} />}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: d.ativo ? d.cor : "#2a2a31", color: "#fff", fontSize: 9.5, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", padding: "3px 8px", textAlign: "center" }}>{d.ativo ? d.sub : "Em breve"}</div>
        </button></div>)}
      </div>
      <div className="mk-t mk-cli" style={{ "--i": DIVISOES.length, "--d": "-2.2s", "--z": "70px", "--c": "#7dd3fc" }}><button onClick={() => onEscolher("cliente")} aria-label="Área do Cliente" style={{ width: "100%", background: "#1f2937", border: "1px solid #475569", color: "#f3f4f6", padding: "18px 16px", fontWeight: 900, letterSpacing: 2, fontSize: 13, cursor: "pointer", clipPath: chanfro, textTransform: "uppercase", boxShadow: "none" }}>Área do Cliente ›</button></div>
      <div style={{ marginTop: 26, fontSize: 10, color: "#4b5563", textAlign: "center" }}>Moked Security Consulting</div>
      <div style={{ textAlign: "center", marginTop: 6 }}><button type="button" data-testid="voltar-abertura" onClick={() => { veioDaAbertura.current = true; setEtapa("abertura"); }} aria-label="Voltar à abertura"
        style={{ background: "transparent", border: 0, color: "#9ca3af", opacity: 0.4, fontSize: 10.5, letterSpacing: 1.5, cursor: "pointer", padding: "8px 14px", textTransform: "lowercase" }}>↺ voltar à abertura</button></div>
    </div>
  </main>;
}
