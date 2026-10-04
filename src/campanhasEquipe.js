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
