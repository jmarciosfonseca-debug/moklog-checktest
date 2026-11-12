// TEMPORÁRIO — Fase 0 do Painel do projeto. Botão do consultor que mede o uso real dos módulos (só leitura) e mostra a tabela.
// Apagar junto com api/painel-uso.js depois que a tabela for entregue.
import { useState } from "react";
import { authFetch, isDemo } from "../session";

const COLS = [["testeSemanal", "Teste sem.", (v) => v.d30], ["mapaDiario", "Mapa D/N", (v) => `${v.enviadosD}/${v.enviadosN}`], ["rondaVirtual", "Ronda virt. (turnos)", (v) => v.noturnos30 + v.diurnos30],
  ["intervalos", "Intervalos", (v) => v.d30], ["keyaccess", "KeyAccess", (v) => v.d30], ["equipamentos", "Equip. c/ problema", (v) => v.comProblema], ["followups", "Tratativas", (v) => v.tratativas30],
  ["perimetral", "Perimetral", (v) => v.d30], ["energia", "Energia", (v) => v.d30], ["ocorrenciasRS", "RS", (v) => v.d30], ["ambulancia", "Ambul.", (v) => v.d30]];
const cel = (v, f) => { if (!v) return "—"; if (v.erro) return "erro"; try { const x = f(v); return x === undefined || Number.isNaN(x) ? "—" : String(x); } catch { return "—"; } };

export default function UsoTemp() {
  const [est, setEst] = useState({ fase: "parado" });
  const medir = async () => {
    if (isDemo()) { setEst({ fase: "erro", msg: "Demonstração: a medição só roda com o PIN gerencial." }); return; }
    setEst({ fase: "medindo" });
    try {
      const r = await authFetch("/api/painel-uso", { method: "POST" }); const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw Error(j.erro || "Não foi possível medir.");
      setEst({ fase: "pronto", dados: j, texto: JSON.stringify(j) });
    } catch (e) { setEst({ fase: "erro", msg: e.message || "Não foi possível medir." }); }
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(est.texto); setEst((s) => ({ ...s, copiado: true })); } catch { setEst((s) => ({ ...s, mostrarTexto: true })); } };
  const d = est.dados;
  return (
    <div data-testid="uso-temp" style={{ margin: "12px 16px 0", padding: "12px 14px", borderRadius: 12, border: "1px dashed #f59e0b88", background: "#1a1206", color: "#e2e8f0", fontSize: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}><b style={{ color: "#f59e0b" }}>Medição de uso (temporário)</b><div style={{ color: "#94a3b8", marginTop: 2 }}>Conta os registros dos últimos 30 dias nos 12 projetos MokLog. Só lê; não grava nada.</div></div>
        <button onClick={medir} disabled={est.fase === "medindo"} style={{ background: "#b45309", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{est.fase === "medindo" ? "Medindo… (até 1 min)" : "Medir agora"}</button>
        {d && <button onClick={copiar} style={{ background: "#15803d", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{est.copiado ? "Copiado ✓" : "Copiar resultado"}</button>}
      </div>
      {est.fase === "erro" && <div role="alert" style={{ color: "#ef4444", marginTop: 8 }}>{est.msg}</div>}
      {d && (<>
        <div style={{ color: "#94a3b8", margin: "10px 0 6px" }}>{d.periodo}. Toque em "Copiar resultado" e cole no chat.</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11, whiteSpace: "nowrap" }}>
            <thead><tr><th style={{ textAlign: "left", padding: "4px 8px" }}>Projeto</th>{COLS.map(([k, r]) => <th key={k} style={{ padding: "4px 8px", color: "#94a3b8", fontWeight: 600 }}>{r}</th>)}</tr></thead>
            <tbody>{Object.entries(d.projetos).map(([pid, l]) => (
              <tr key={pid} style={{ borderTop: "1px solid #33415566" }}><td style={{ padding: "4px 8px", fontWeight: 800 }}>{pid}</td>{COLS.map(([k, , f]) => <td key={k} style={{ padding: "4px 8px", textAlign: "center" }}>{cel(l[k], f)}</td>)}</tr>))}</tbody>
          </table>
        </div>
        <div style={{ color: "#94a3b8", marginTop: 8 }}>
          RD identifica o projeto visitado: <b style={{ color: "#e2e8f0" }}>{d.rd && d.rd.identificaProjeto ? "sim" : "não"}</b>{d.rd && d.rd.diasComRd30 !== undefined ? ` (${d.rd.diasComRd30} dias de RD no período)` : ""} · Documentos acima de 700 KB: <b style={{ color: d.documentosGrandes.length ? "#ef4444" : "#22c55e" }}>{d.documentosGrandes.length ? d.documentosGrandes.map((g) => `${g.pid} ${g.doc} ${g.kb} KB`).join(", ") : "nenhum"}</b>
        </div>
        {est.mostrarTexto && <textarea readOnly value={est.texto} onFocus={(e) => e.target.select()} style={{ width: "100%", height: 120, marginTop: 8, fontSize: 10 }} />}
      </>)}
    </div>
  );
}
