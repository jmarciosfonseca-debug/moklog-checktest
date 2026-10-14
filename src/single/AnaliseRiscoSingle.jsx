import React, { useEffect, useState } from "react";
import { fontesDoSingle } from "./singleFontes";

const dataBR = (iso) => { const p = String(iso || "").slice(0, 10).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : "—"; };

// Aba "Análise de Risco" do Single: mostra o que entra (vistoria + diagnóstico), o modelo (1 ou 2) e gera o PDF.
// O motor é o mesmo dos projetos fixos; o carregamento é sob demanda para não pesar a abertura do Single.
export default function AnaliseRiscoSingle({ store, project, history }) {
  const [diagnosticos, setDiagnosticos] = useState(null);
  const [usarDiag, setUsarDiag] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    let ativo = true;
    store.listarDiagnosticos(project.id)
      .then((r) => { if (ativo) setDiagnosticos(r.diagnosticos || []); })
      .catch((e) => { if (ativo) { setDiagnosticos([]); setErro("Não consegui ler o Diagnóstico agora: " + (e.message || e) + " A análise sai sem ele (Modelo 1)."); } });
    return () => { ativo = false; };
  }, [store, project.id]);

  const fontes = fontesDoSingle({ single: project, inspecoes: history, diagnosticos: diagnosticos || [] });
  const comDiag = fontes.diagnostico.ok && usarDiag;

  async function gerar() {
    if (busy || !fontes.vistoria) return;
    // A janela precisa abrir dentro do clique; o relatório é escrito depois que o motor responde.
    const janela = window.open("", "_blank");
    setBusy(true); setErro("");
    try {
      const { gerarAnaliseSingle } = await import("./singleRisco");
      const r = await gerarAnaliseSingle({ single: project, inspecao: fontes.vistoria, diagnosticos: diagnosticos || [], usarDiagnostico: usarDiag });
      if (janela) { janela.document.open(); janela.document.write(r.html); janela.document.close(); }
      else { const url = URL.createObjectURL(new Blob([r.html], { type: "text/html" })); const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
      setResultado({ classe: r.analise.geral.label, modelo: r.modelo, ref: r.analise.ref, html: r.html });
    } catch (e) {
      try { janela && janela.close(); } catch { /* janela já fechada */ }
      setErro(e.message || "Não foi possível gerar a Análise de Risco.");
    } finally { setBusy(false); }
  }

  return <section className="single-ar">
    <h2>Análise de Risco do Single</h2>
    <p className="single-hint">Cruza a vistoria do Single com o Diagnóstico Situacional, com o mesmo motor dos projetos fixos. O perfil de barreiras vem dos itens cadastrados; o território é só contexto e não altera a classe.</p>
    {erro && <p role="alert" className="single-error">{erro}</p>}
    <ul className="single-ar-fontes">
      <li>{fontes.vistoria ? "✔" : "✖"} <strong>Vistoria do Single</strong>: {fontes.vistoria ? `concluída em ${dataBR(fontes.vistoria.data)}` : "nenhuma vistoria concluída. Conclua uma na aba Relatório (Estado: concluída) para liberar a análise."}</li>
      <li>{diagnosticos === null ? "…" : fontes.diagnostico.ok ? "✔" : "—"} <strong>Diagnóstico Situacional</strong>: {diagnosticos === null ? "lendo…" : fontes.diagnostico.ok ? `concluído (${dataBR(fontes.diagnostico.atualizadoEm)})` : `fora desta análise — ${fontes.diagnostico.motivo}`}</li>
      <li>— <strong>Território</strong>: contexto apenas; Single não tem diagnóstico regional.</li>
    </ul>
    {fontes.diagnostico.ok && <label><input type="checkbox" checked={usarDiag} onChange={(e) => setUsarDiag(e.target.checked)} /> Incluir o Diagnóstico concluído (Modelo 2)</label>}
    {fontes.vistoria && <p>Será gerado o <strong>Modelo {comDiag ? "2 — com Diagnóstico Situacional" : "1 — só vistoria"}</strong>.</p>}
    <button disabled={busy || !fontes.vistoria || diagnosticos === null} onClick={gerar}>{busy ? "Consolidando…" : "Gerar Análise de Risco (PDF)"}</button>
    {resultado && <p role="status">Classe apurada: <strong>{resultado.classe}</strong> · Modelo {resultado.modelo} · {resultado.ref}</p>}
  </section>;
}
