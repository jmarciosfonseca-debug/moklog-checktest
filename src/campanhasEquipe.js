export const CAMPANHAS = {
  natal: { nome: 'Cesta de Natal', colecao: 'cestaNatal', inicio: 10, fim: 12 },
  pascoa: { nome: 'Ovo de Páscoa', colecao: 'ovoPascoa', inicio: 2, fim: 4 },
};
export function calendarioCampanha(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(agora);
  const ano = Number(partes.find(p => p.type === 'year').value);
  const mes = Number(partes.find(p => p.type === 'month').value);
  const tipo = Object.keys(CAMPANHAS).find(k => mes >= CAMPANHAS[k].inicio && mes < CAMPANHAS[k].fim) || null;
  return { ano, tipo };
}
export const chaveCampanha = (tipo, ano) => `${tipo}_${ano}`;
export function campanhaDisponivel(agora, configs = {}) {
  const c = calendarioCampanha(agora);
  return { ...c, disponivel: !!c.tipo && configs[chaveCampanha(c.tipo, c.ano)]?.oculta !== true };
}
export function valorCampanhaCentavos(texto) {
  const s = String(texto ?? '').trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s)) return null;
  const n = Math.round(Number(s.replace(/\./g, '').replace(',', '.')) * 100);
  return Number.isSafeInteger(n) && n >= 0 && n <= 100000000 ? n : null;
}
export function totalCampanha(qtd, centavos) {
  if (!Number.isSafeInteger(qtd) || qtd < 0 || !Number.isSafeInteger(centavos) || centavos < 0) return null;
  const total = qtd * centavos;
  return Number.isSafeInteger(total) ? total / 100 : null;
}

// ── Itens extras (gerencial): além dos colaboradores marcados pela equipe, o gerencial pode acrescentar
// itens avulsos (ex.: "modelo XY para a administração") com quantidade, valor unitário, observação e foto de catálogo.
export const MAX_EXTRAS = 30;
export const novoIdExtra = () => `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export function extraValido(x) {
  return !!x && typeof x === 'object' && typeof x.id === 'string' && /^[-\w]{1,40}$/.test(x.id)
    && typeof x.descricao === 'string' && x.descricao.trim().length >= 1 && x.descricao.length <= 120
    && Number.isSafeInteger(x.qtd) && x.qtd >= 1 && x.qtd <= 10000
    && Number.isSafeInteger(x.valorCentavos) && x.valorCentavos >= 0 && x.valorCentavos <= 100000000
    && (x.obs == null || (typeof x.obs === 'string' && x.obs.length <= 300))
    && (x.fotoRef == null || (typeof x.fotoRef === 'string' && /^[-\w]{1,100}$/.test(x.fotoRef)));
}
export const totalExtra = x => totalCampanha(x?.qtd, x?.valorCentavos);
export function totaisExtras(extras = []) {
  const lista = Array.isArray(extras) ? extras : [];
  const qtd = lista.reduce((s, x) => s + (Number.isSafeInteger(x?.qtd) ? x.qtd : 0), 0);
  const valor = lista.reduce((s, x) => s + (totalExtra(x) ?? 0), 0);
  return { qtd, valor: Math.round(valor * 100) / 100 };
}
// Resultado do lote: colaboradores (qtd × valor unitário da campanha) + extras.
export function totalGeralCampanha(qtdColabs, centavosUnit, extras = []) {
  const base = centavosUnit == null ? 0 : (totalCampanha(qtdColabs, centavosUnit) ?? 0);
  const ex = totaisExtras(extras);
  return { qtd: qtdColabs + ex.qtd, valor: Math.round((base + ex.valor) * 100) / 100, baseCalculada: centavosUnit != null };
}
