// Painel "Diagnóstico da digital": abre com ?digital=1 ou ?digital=diag no endereço, ou pelo chip "Digital" quando algo impede.
import { useEffect, useState } from "react";
import { diagnosticarDigital } from "./diagnostico";

export const EVENTO_DIAGNOSTICO = "mk-digital-diag";
const abrirPorUrl = () => { try { const v = new URLSearchParams(window.location.search).get("digital"); return v === "1" || v === "diag"; } catch { return false; } };

export default function DiagnosticoDigital() {
  const [aberto, setAberto] = useState(abrirPorUrl);
  const [res, setRes] = useState(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const f = () => setAberto(true);
    window.addEventListener(EVENTO_DIAGNOSTICO, f);
    return () => window.removeEventListener(EVENTO_DIAGNOSTICO, f);
  }, []);
  useEffect(() => {
    if (!aberto) return undefined;
    let vivo = true;
    setRes(null);
    // Dá um instante para a marca de teste (?digital=1) ser gravada antes de ler.
    const t = setTimeout(() => { diagnosticarDigital().then((r) => { if (vivo) setRes(r); }).catch(() => { if (vivo) setRes({ itens: [], pronto: false, motivo: "Não foi possível diagnosticar." }); }); }, 150);
    return () => { vivo = false; clearTimeout(t); };
  }, [aberto, n]);
  if (!aberto) return null;
  return <div role="dialog" aria-label="Diagnóstico da digital" data-testid="digital-diag" style={{ position: "fixed", left: 10, right: 10, top: "calc(10px + env(safe-area-inset-top, 0px))", zIndex: 80, maxWidth: 420, margin: "0 auto", maxHeight: "86vh", overflowY: "auto", background: "#1F2937", color: "#F3F4F6", border: "1px solid #3b4859", borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,.45)", padding: 14, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 900 }}>🔐 Diagnóstico da digital</div>
      <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" style={{ background: "transparent", color: "#CBD5E1", border: "1px solid #3b4859", borderRadius: 6, padding: "3px 9px", cursor: "pointer", fontWeight: 800 }}>✕</button>
    </div>
    {!res ? <div style={{ fontSize: 12.5, color: "#CBD5E1", marginTop: 10 }}>Verificando este aparelho…</div> : <>
      <div style={{ fontSize: 12.5, marginTop: 8, fontWeight: 800, color: res.pronto ? "#86efac" : "#fca5a5" }}>{res.pronto ? "Tudo certo para usar a digital neste aparelho." : `O que impede: ${res.motivo}`}</div>
      <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
        {res.itens.map((i) => <li key={i.id} style={{ borderTop: "1px solid #3b4859", padding: "7px 0", fontSize: 12.5, lineHeight: 1.4 }}>
          <span style={{ color: i.ok ? "#86efac" : "#fca5a5", fontWeight: 900 }}>{i.ok ? "✓" : "✗"}</span> <b>{i.rotulo}</b>
          <div style={{ color: "#CBD5E1", fontSize: 12 }}>{i.detalhe}</div>
        </li>)}
      </ul>
      <button type="button" onClick={() => setN((x) => x + 1)} style={{ marginTop: 10, background: "transparent", color: "#CBD5E1", border: "1px solid #3b4859", borderRadius: 6, padding: "8px 12px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>Verificar de novo</button>
    </>}
  </div>;
}
