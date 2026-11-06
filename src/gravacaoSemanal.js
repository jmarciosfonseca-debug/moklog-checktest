// Tempo de gravação no TESTE SEMANAL (Marcio, 06/11/2026).
// A equipe não aponta câmera por câmera: informa a FAIXA (%) de câmeras com menos de 30 dias de gravação,
// e o app traduz para o quantitativo do projeto (ex.: P604 tem 73 câmeras → 10% ≈ 7, 20% ≈ 15, 30% ≈ 22, 50% ≈ 37).
// Fica guardado em state.cftv.gravacao = { pct, obs }. Não entra na Saúde Geral do teste: é indicador próprio.
export const MINIMO_DIAS = 30;
// Faixas (Marcio, 06/11): 0 · até 5% · 10% · 20% · 30% · 50% (máx.). "Até 5%" cobre o projeto grande com poucas câmeras abaixo
// (150 câmeras com 8 abaixo não é 10%). Cada faixa é lida como "até X%".
export const FAIXAS_GRAVACAO = [0, 5, 10, 20, 30, 50];

export const camerasDaFaixa = (total, pct) => Math.round(((Number(total) || 0) * (Number(pct) || 0)) / 100);

// Legenda "10% ≈ 7 · 20% ≈ 15 · …" calculada com o total do projeto.
export function legendaGravacao(total) {
  return FAIXAS_GRAVACAO.filter((p) => p > 0).map((p) => ({ pct: p, cameras: camerasDaFaixa(total, p), texto: `${p}% ≈ ${camerasDaFaixa(total, p)}` }));
}

// Cor: 0% verde · até 10% amarelo · acima vermelho · não informado cinza.
export const corGravacao = (pct) => (pct === null || pct === undefined ? "#64748b" : pct === 0 ? "#22c55e" : pct <= 10 ? "#f59e0b" : "#ef4444");
export const nivelGravacao = (pct) => (pct === null || pct === undefined ? "nao_informado" : pct === 0 ? "ok" : pct <= 10 ? "atencao" : "critico");

// Lê o indicador do estado de um teste. Devolve null quando a categoria CFTV não existe no projeto;
// pct null quando o teste é anterior ao campo (não informado).
export function gravacaoDoTeste(project, state) {
  const cat = (project?.categories || []).find((c) => c.id === "cftv" && c.type === "count");
  if (!cat) return null;
  const s = state?.[cat.id] || {};
  const total = Number(s.total ?? cat.total ?? 0) || 0;
  const g = s.gravacao && typeof s.gravacao === "object" ? s.gravacao : null;
  const pct = g && FAIXAS_GRAVACAO.includes(Number(g.pct)) ? Number(g.pct) : null;
  return { total, pct, cameras: pct === null ? null : camerasDaFaixa(total, pct), obs: String(g?.obs || "").trim(), nivel: nivelGravacao(pct), cor: corGravacao(pct) };
}

// Texto curto para WhatsApp/relatórios.
export function textoGravacao(g) {
  if (!g) return "";
  if (g.pct === null) return `Tempo de gravação (mín. ${MINIMO_DIAS} dias): não informado`;
  const base = g.pct === 0 ? `Tempo de gravação: todas as ${g.total} câmeras com ≥ ${MINIMO_DIAS} dias` : `Tempo de gravação: até ${g.pct}% das câmeras (até ≈ ${g.cameras} de ${g.total}) com menos de ${MINIMO_DIAS} dias`;
  return g.obs ? `${base} — ${g.obs}` : base;
}
