// Eventos da Equipe que aparecem no mapa/lista: afastamento por falta, promoção e desligamento recente. Funções puras.
const dias = (aISO, bISO) => Math.round((Date.parse(`${bISO}T12:00:00Z`) - Date.parse(`${aISO}T12:00:00Z`)) / 86400000);
const dataBR = iso => String(iso || '').split('-').reverse().join('/');

export const MAX_PLANTOES_AFASTAMENTO = 90;
// Número de plantões informado (inteiro 2..90) ou null.
export function plantoesAfastamento(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 2 && n <= MAX_PLANTOES_AFASTAMENTO ? n : null;
}
// Falta mais recente com afastamento informado que ainda pode estar valendo (janela = 2 dias por plantão: cobre 12x36).
export function afastamentoVigente(historico, hojeISO) {
  const cand = (Array.isArray(historico) ? historico : [])
    .filter(h => h && h.tipo === 'Falta' && plantoesAfastamento(h.afastamentoPlantoes) && h.data)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];
  if (!cand) return null;
  const n = plantoesAfastamento(cand.afastamentoPlantoes);
  const d = dias(cand.data, hojeISO);
  if (d < 0 || d >= n * 2) return null;
  return { plantoes: n, desde: cand.data, rotulo: `Afastado — ${n} plantões desde ${dataBR(cand.data)}` };
}
// Promoção mais recente dentro da janela (padrão 90 dias).
export function promocaoRecente(historico, hojeISO, janela = 90) {
  const p = (Array.isArray(historico) ? historico : [])
    .filter(h => h && h.tipo === 'Promoção' && h.data)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];
  if (!p) return null;
  const d = dias(p.data, hojeISO);
  return d >= 0 && d <= janela ? p : null;
}
// Desligados registrados nas últimas `horas` (carimbo de registro; sem carimbo não aparece).
export function desligamentosRecentes(desligados, agora = new Date(), horas = 24) {
  const lim = agora.getTime() - horas * 3600000;
  return (Array.isArray(desligados) ? desligados : [])
    .filter(d => d && d.desligadoRegistroEm && Date.parse(d.desligadoRegistroEm) >= lim && Date.parse(d.desligadoRegistroEm) <= agora.getTime() + 60000)
    .map(d => ({ id: d.id, nome: d.nome || '', cargo: d.cargo || '', tipo: d.tipoDesligamento || '', por: d.desligadoPor || '', em: d.desligadoRegistroEm }))
    .sort((a, b) => b.em.localeCompare(a.em));
}
export function linhaDesligamento(d) {
  const quando = new Date(d.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `${d.nome}${d.cargo ? ` (${d.cargo})` : ''}${d.tipo ? ` — ${d.tipo}` : ''} — apontado por ${d.por || 'não informado'} em ${quando}`;
}
