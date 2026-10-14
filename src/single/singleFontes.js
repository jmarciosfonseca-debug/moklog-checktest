// Leve de propósito: a tela do Single usa isto sem carregar o motor da Análise de Risco (que só entra ao clicar em Gerar).
import { escolherDiagnosticoConcluido, motivoSemConcluido } from "../diagnostico/analiseRiscoModelo2";

// Situação das fontes para a tela (antes de gerar): o que entra e por quê.
export function fontesDoSingle({ single, inspecoes = [], diagnosticos = [] }) {
  const concluidas = inspecoes.filter((i) => i.estado === "concluida").sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
  const vistoria = concluidas[0] || null;
  const diag = escolherDiagnosticoConcluido(diagnosticos);
  return {
    vistoria,
    diagnostico: diag ? { ok: true, id: diag.id, atualizadoEm: diag.atualizadoEm || "" } : { ok: false, motivo: motivoSemConcluido(diagnosticos) },
    modelo: vistoria && diag ? 2 : 1,
  };
}
