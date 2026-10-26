// Porta do MokLog (Marcio, 26/10/2026): o PIN vem ANTES da Home. PIN gerencial → Home completa (todos os grupos);
// PIN de projeto (líder) → só o painel do projeto dele. A Área do Cliente tem a própria porta.
import { useState } from "react";
import { checkPinAnyProject } from "../session";

const fundo = { minHeight: "100vh", background: "radial-gradient(140% 70% at 50% -10%, #1a0507 0%, #0b0f19 40%, #0b0f19 100%)", color: "#e5e7eb", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 };
const chanfro = "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";
const botao = { background: "linear-gradient(180deg, #FF1E27, #9f0710)", color: "#fff", border: "none", padding: "13px 38px", fontWeight: 900, letterSpacing: 2.5, fontSize: 14, cursor: "pointer", clipPath: chanfro, boxShadow: "0 0 18px #FF1E2766", textTransform: "uppercase", width: "100%" };

export default function PinMoklog({ onEntrar, onVoltar, logo = "/moked/divisoes/moklog.jpg" }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const tentar = async () => {
    if (!pin.trim() || busy) return;
    setBusy(true); setErro("");
    try {
      const r = await checkPinAnyProject(pin.trim());
      if (!r) { setErro("PIN inválido"); return; }
      onEntrar(r); // { level: "admin"|"demo"|"lider", projectId }
    } finally { setBusy(false); }
  };
  return <main style={fundo} data-testid="moklog-pin">
    <img src={logo} alt="MokLog" style={{ width: "min(60vw, 240px)", background: "#fff", padding: "8px 16px", clipPath: chanfro, marginBottom: 22 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
    <div style={{ width: "100%", maxWidth: 360, background: "linear-gradient(160deg,#121216,#0b0b0e)", border: "1px solid #2a2a31", padding: "22px 20px", clipPath: chanfro, textAlign: "center" }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.5, color: "#9ca3af", textTransform: "uppercase" }}>Acesso MokLog</div>
      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 4, marginBottom: 16 }}>PIN do consultor abre todos os parques · PIN do projeto abre só o seu</div>
      <input type="password" inputMode="numeric" aria-label="PIN MokLog" placeholder="PIN" maxLength={8} value={pin} autoFocus
        onChange={(e) => { setPin(e.target.value); setErro(""); }} onKeyDown={(e) => { if (e.key === "Enter") tentar(); }}
        style={{ width: "100%", boxSizing: "border-box", background: "#050507", color: "#f3f4f6", border: "1px solid #3a3a42", padding: "12px 10px", fontSize: 22, letterSpacing: 10, textAlign: "center", marginBottom: 10 }} />
      {erro && <div role="alert" style={{ fontSize: 12, color: "#FF1E27", fontWeight: 700, marginBottom: 8 }}>{erro}</div>}
      <button onClick={tentar} disabled={busy} style={{ ...botao, opacity: busy ? .6 : 1 }}>{busy ? "Verificando…" : "Entrar"}</button>
      <button onClick={onVoltar} style={{ marginTop: 10, background: "transparent", border: "1px solid #3a3a42", color: "#9ca3af", padding: "9px 16px", fontSize: 12, cursor: "pointer", clipPath: chanfro, width: "100%" }}>← Voltar</button>
    </div>
  </main>;
}
