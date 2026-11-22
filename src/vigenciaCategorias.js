// Categoria retirada do teste semanal a partir de uma data (Marcio, 22/11/2026).
// `ate` = última data de relatório (AAAA-MM-DD) em que a categoria ainda existe. Relatórios até essa data seguem como foram feitos
// (aparecem e contam, o histórico não muda). Relatórios de data posterior já nascem sem a categoria: não aparece no formulário,
// não entra na saúde, nas pendências nem nos relatórios. As telas e contas leem o que está gravado em cada relatório.
const hoje = () => new Date().toLocaleDateString("sv-SE");
const dataValida = (d) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : hoje());

export const categoriaVigente = (cat, data) => !cat || !cat.ate || dataValida(data) <= cat.ate;
export const categoriasVigentes = (project, data) => (project?.categories || []).filter((c) => categoriaVigente(c, data));

// Cópia do estado sem as categorias já retiradas para a data do relatório (rascunho ou relatório de hoje feito antes da retirada).
export function semCategoriasRetiradas(project, state, data) {
  if (!state || typeof state !== "object") return state;
  const fora = (project?.categories || []).filter((c) => !categoriaVigente(c, data));
  if (!fora.length) return state;
  const out = { ...state };
  fora.forEach((c) => { delete out[c.id]; });
  return out;
}
