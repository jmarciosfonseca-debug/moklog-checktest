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

// ── Puxado automático da CCO (Marcio, 16/11/2026) ────────────────────────────
// A CCO já mede câmera por câmera em "CFTV — Tempo de Gravação" (cftv_gravacao/{pid}). O teste semanal passa a puxar
// dali a QUANTIDADE de câmeras abaixo de 30 dias, sem o líder abrir e contar. Fica em state.cftv.gravacao com origem "cco".
const temMedida = (c) => c && c.diasGravacao !== null && c.diasGravacao !== undefined && c.diasGravacao !== "" && Number.isFinite(Number(c.diasGravacao));
export function resumoGravacaoCCO(dados) {
  const cams = dados && Array.isArray(dados.cameras) ? dados.cameras : [];
  const medidas = cams.filter(temMedida);
  if (!medidas.length) return null; // CCO ainda não mediu: o líder informa a faixa à mão, como antes
  const em = medidas.map((c) => c.ultimaChecagem).filter(Boolean).sort().pop() || dados.updatedAt || null;
  return { cadastradas: cams.length, medidas: medidas.length, abaixo: medidas.filter((c) => Number(c.diasGravacao) < MINIMO_DIAS).length, em };
}
// Faixa equivalente ao percentual real (as cores, a nota do cliente e o Painel continuam lendo a faixa).
export const faixaDoPercentual = (p) => (!(p > 0) ? 0 : FAIXAS_GRAVACAO.find((f) => f > 0 && p <= f) ?? FAIXAS_GRAVACAO[FAIXAS_GRAVACAO.length - 1]);
export function gravacaoDaCCO(resumo, total, obs = "") {
  const base = Number(total) || resumo.cadastradas || resumo.medidas;
  return { pct: faixaDoPercentual(base ? (resumo.abaixo / base) * 100 : 0), obs: String(obs || ""), origem: "cco", cameras: resumo.abaixo, medidas: resumo.medidas, registradoEm: resumo.em || null };
}
const dm = (ts) => { const d = ts ? new Date(ts) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""; };

// Lê o indicador do estado de um teste. Devolve null quando a categoria CFTV não existe no projeto;
// pct null quando o teste é anterior ao campo (não informado).
export function gravacaoDoTeste(project, state) {
  const cat = (project?.categories || []).find((c) => c.id === "cftv" && c.type === "count");
  if (!cat) return null;
  const s = state?.[cat.id] || {};
  const total = Number(s.total ?? cat.total ?? 0) || 0;
  const g = s.gravacao && typeof s.gravacao === "object" ? s.gravacao : null;
  const pct = g && FAIXAS_GRAVACAO.includes(Number(g.pct)) ? Number(g.pct) : null;
  const daCCO = !!g && g.origem === "cco" && pct !== null && Number.isFinite(Number(g.cameras));
  const cameras = pct === null ? null : daCCO ? Number(g.cameras) : camerasDaFaixa(total, pct);
  return { total, pct, cameras, obs: String(g?.obs || "").trim(), nivel: nivelGravacao(pct), cor: corGravacao(pct),
    ...(daCCO ? { origem: "cco", pctReal: total ? Math.round((cameras / total) * 100) : 0, medidas: Number(g.medidas) || null, registradoEm: g.registradoEm || null } : {}) };
}

// Frase única da gravação (sem o rótulo), para telas e relatórios. Da CCO: quantidade exata; manual: faixa.
export function fraseGravacao(g) {
  if (!g) return "";
  if (g.pct === null) return "não informado";
  if (g.origem === "cco") {
    const reg = dm(g.registradoEm) ? ` · registro da CCO de ${dm(g.registradoEm)}` : " · registro da CCO";
    return (g.cameras === 0 ? `nenhuma câmera com menos de ${MINIMO_DIAS} dias` : `${g.cameras} de ${g.total} câmeras (${g.pctReal}%) com menos de ${MINIMO_DIAS} dias`) + reg;
  }
  return g.pct === 0 ? `todas as ${g.total} câmeras com ≥ ${MINIMO_DIAS} dias` : `até ${g.pct}% das câmeras (até ≈ ${g.cameras} de ${g.total}) com menos de ${MINIMO_DIAS} dias`;
}

// Texto curto para WhatsApp/relatórios.
export function textoGravacao(g) {
  if (!g) return "";
  if (g.pct === null) return `Tempo de gravação (mín. ${MINIMO_DIAS} dias): não informado`;
  const base = `Tempo de gravação: ${fraseGravacao(g)}`;
  return g.obs ? `${base} — ${g.obs}` : base;
}
