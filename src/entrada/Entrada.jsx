// Porta de entrada da plataforma Moked (decisão do Marcio, 20/10): logo centralizado → "Entrar" → vídeo curto de
// introdução (public/moked/intro.mp4; se não existir ou falhar, pula) → "Escolha a sua área" (divisões) com a
// Área do Cliente no topo. MokLog abre o app atual; as demais divisões ficam "em breve" até existirem.
import { useEffect, useRef, useState } from "react";

export const DIVISOES = [
  { id: "moklog", nome: "MokLog", sub: "Condomínios logísticos", ativo: true, cor: "#E50914" },
  { id: "mokpat", nome: "MokPat", sub: "Patrimonial", ativo: false, cor: "#f59e0b" },
  { id: "mokvip", nome: "MokVip", sub: "Executivos e eventos", ativo: false, cor: "#a855f7" },
  { id: "mokres", nome: "MokRes", sub: "Residencial", ativo: false, cor: "#22c55e" },
  { id: "mokimp", nome: "MokImp", sub: "Implantação", ativo: false, cor: "#38bdf8" },
];
export const LOGO_MOKED_URL = "/moked/logo-moked.png";
export const VIDEO_INTRO_URL = "/moked/intro.mp4";
const CHAVE_VISTO = "moked_intro_visto_v1"; // vídeo uma vez por sessão do navegador

const fundo = { minHeight: "100vh", background: "radial-gradient(140% 70% at 50% -10%, #2a0609 0%, #0a0a0d 45%, #050507 100%)", color: "#e5e7eb", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 };
const chanfro = "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";
const botaoVermelho = { background: "linear-gradient(180deg, #FF1E27, #9f0710)", color: "#fff", border: "none", padding: "13px 38px", fontWeight: 900, letterSpacing: 2.5, fontSize: 14, cursor: "pointer", clipPath: chanfro, boxShadow: "0 0 18px #FF1E2766", textTransform: "uppercase" };

export default function Entrada({ onEscolher, logo = LOGO_MOKED_URL, video = VIDEO_INTRO_URL, pularVideo = false }) {
  const [etapa, setEtapa] = useState("splash"); // splash | video | areas
  const vid = useRef(null);
  const jaViu = () => { try { return sessionStorage.getItem(CHAVE_VISTO) === "1"; } catch { return false; } };
  const marcar = () => { try { sessionStorage.setItem(CHAVE_VISTO, "1"); } catch { /* sem storage */ } };
  const entrar = () => { if (pularVideo || jaViu()) setEtapa("areas"); else setEtapa("video"); };
  const fimVideo = () => { marcar(); setEtapa("areas"); };

  useEffect(() => { if (etapa !== "video") return undefined; const t = setTimeout(fimVideo, 15000); return () => clearTimeout(t); }, [etapa]); // nunca prende o usuário

  if (etapa === "splash") return <main style={fundo} data-testid="entrada-splash">
    <img src={logo} alt="Moked Security Consulting" style={{ width: "min(70vw, 320px)", filter: "drop-shadow(0 0 24px rgba(229,9,20,.35))" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
    <div style={{ marginTop: 36 }}><button onClick={entrar} style={botaoVermelho}>Entrar</button></div>
    <div style={{ marginTop: 14, fontSize: 10.5, color: "#6b7280", letterSpacing: 1 }}>SECURITY · CONSULTING</div>
  </main>;

  if (etapa === "video") return <main style={{ ...fundo, padding: 0, background: "#000" }} data-testid="entrada-video">
    <video ref={vid} src={video} autoPlay muted playsInline onEnded={fimVideo} onError={fimVideo} style={{ width: "100%", maxWidth: 560, maxHeight: "80vh", background: "#000" }} />
    <button onClick={fimVideo} style={{ ...botaoVermelho, position: "fixed", right: 16, bottom: 20, padding: "8px 16px", fontSize: 11, letterSpacing: 1.5 }}>Pular</button>
  </main>;

  return <main style={{ ...fundo, justifyContent: "flex-start", paddingTop: 28 }} data-testid="entrada-areas">
    <img src={logo} alt="Moked" style={{ width: 150, marginBottom: 6 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
    <div style={{ width: "100%", maxWidth: 480 }}>
      <button onClick={() => onEscolher("cliente")} aria-label="Área do Cliente" style={{ width: "100%", background: "linear-gradient(180deg,#2a0b0e,#160507)", border: "1px solid #E50914aa", color: "#fecaca", padding: "14px 16px", fontWeight: 900, letterSpacing: 2, fontSize: 13, cursor: "pointer", clipPath: chanfro, marginBottom: 22, textTransform: "uppercase", boxShadow: "0 0 16px #E5091433" }}>Área do Cliente ›</button>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.5, color: "#9ca3af", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Escolha a sua área</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {DIVISOES.map((d) => <button key={d.id} aria-label={d.nome} disabled={!d.ativo} onClick={() => d.ativo && onEscolher(d.id)}
          style={{ background: "linear-gradient(160deg, #15151a 0%, #0b0b0e 60%)", border: `1px solid ${d.ativo ? d.cor + "aa" : "#2a2a31"}`, color: d.ativo ? "#f3f4f6" : "#6b7280", padding: "18px 12px", textAlign: "left", cursor: d.ativo ? "pointer" : "default", clipPath: chanfro, boxShadow: d.ativo ? `0 0 14px ${d.cor}33, inset 0 1px 0 rgba(255,255,255,.06)` : "inset 0 1px 0 rgba(255,255,255,.04)", gridColumn: d.id === "moklog" ? "1 / -1" : "auto" }}>
          <div style={{ fontSize: d.id === "moklog" ? 20 : 15, fontWeight: 900, letterSpacing: 1 }}><span style={{ color: d.ativo ? d.cor : "#4b5563" }}>Mok</span>{d.nome.slice(3)}</div>
          <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 3 }}>{d.sub}{d.ativo ? "" : " · em breve"}</div>
        </button>)}
      </div>
      <div style={{ marginTop: 18, fontSize: 10, color: "#4b5563", textAlign: "center" }}>Moked Security Consulting</div>
    </div>
  </main>;
}
