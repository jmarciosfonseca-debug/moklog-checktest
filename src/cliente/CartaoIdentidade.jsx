// Cartão de identidade do colaborador (Área do Cliente): foto em tela cheia + dados do posto.
// Abre ao tocar em qualquer pessoa da equipe de plantão (líder e demais). Só leitura.
import { useEffect } from "react";

const CHANFRO = "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)";
const fmt = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const iniciais = (n) => { const p = String(n || "?").trim().split(/\s+/).filter(Boolean); return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); };

export default function CartaoIdentidade({ pessoa, onFechar }) {
  useEffect(() => {
    if (!pessoa) return undefined;
    const tecla = (e) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", tecla);
    const ant = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", tecla); document.body.style.overflow = ant; };
  }, [pessoa, onFechar]);
  if (!pessoa) return null;
  const cor = pessoa.cor || "#22c55e";
  const dados = [
    ["Posto", pessoa.posto], ["Situação", pessoa.situacaoRotulo], ["Cargo", pessoa.cargo],
    ["Turno", pessoa.turno], ["No projeto desde", fmt(pessoa.desde)], ["Treinamentos", pessoa.treinos ? `${pessoa.treinos} registrados` : ""],
  ].filter(([, v]) => v);
  return <div role="dialog" aria-modal="true" aria-label={`Identificação de ${pessoa.nome}`} data-testid="cartao-identidade" onClick={onFechar}
    style={{ position: "fixed", inset: 0, zIndex: 9999, background: "radial-gradient(120% 80% at 50% 0%, #1a0608 0%, #050507 70%)", display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", padding: "max(16px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))", color: "#f3f4f6", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
    <div style={{ width: "100%", maxWidth: 420, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div style={{ fontWeight: 900, letterSpacing: 4, fontSize: 16 }}>MOK<span style={{ color: "#FF1E27" }}>E</span>D</div>
      <button onClick={onFechar} aria-label="Fechar" style={{ background: "#111115", border: "1px solid #3a3a42", color: "#e5e7eb", width: 38, height: 38, fontSize: 18, cursor: "pointer" }}>✕</button>
    </div>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "linear-gradient(160deg, #15151a, #0a0a0d)", border: `1px solid ${cor}88`, boxShadow: `0 0 28px ${cor}33`, clipPath: CHANFRO, padding: 14 }}>
      <div style={{ fontSize: 10, letterSpacing: 3, color: "#9ca3af", fontWeight: 800, marginBottom: 8 }}>IDENTIFICAÇÃO · EQUIPE DE PLANTÃO</div>
      <div style={{ width: "100%", aspectRatio: "3 / 4", maxHeight: "62vh", background: "#0b0b0e", border: `2px solid ${cor}`, clipPath: "polygon(8% 0, 100% 0, 100% 92%, 92% 100%, 0 100%, 0 8%)", display: "grid", placeItems: "center", overflow: "hidden" }}>
        {pessoa.foto ? <img src={pessoa.foto} alt={pessoa.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 96, fontWeight: 900, color: "#475569" }}>{iniciais(pessoa.nome)}</span>}
      </div>
      <div style={{ marginTop: 12, fontSize: 22, fontWeight: 900, lineHeight: 1.15, overflowWrap: "anywhere" }}>{pessoa.nome}</div>
      {pessoa.lider && <span style={{ display: "inline-block", marginTop: 6, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.5, padding: "3px 9px", border: "1px solid #38bdf888", background: "#38bdf814", color: "#7dd3fc" }}>LÍDER DO PLANTÃO</span>}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", fontSize: 13 }}>
        {dados.map(([k, v]) => <div key={k} style={{ display: "contents" }}><span style={{ color: "#9ca3af" }}>{k}</span><b style={{ color: k === "Situação" ? cor : "#f3f4f6" }}>{v}</b></div>)}
      </div>
    </div>
    <div style={{ marginTop: 10, fontSize: 11, color: "#6b7280" }}>Toque fora do cartão ou em ✕ para fechar</div>
  </div>;
}
