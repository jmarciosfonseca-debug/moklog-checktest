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

// Histórico da ficha em ORDEM CRONOLÓGICA pela data do fato (aplicação/realização), não pela data do lançamento no sistema.
// Mais antigo primeiro, mais recente no fim; empate pela hora do lançamento. Só ordena a exibição: nada é alterado ou apagado.
export function ordenarHistorico(historico) {
  const chave = h => (/^\d{4}-\d{2}-\d{2}/.test(h && h.data) ? h.data.slice(0, 10) : String(h && h.registradoEm || '').slice(0, 10)) || '0000-00-00';
  return (Array.isArray(historico) ? historico : [])
    .map((h, i) => ({ h, i }))
    .sort((a, b) => chave(a.h).localeCompare(chave(b.h)) || String(a.h.registradoEm || '').localeCompare(String(b.h.registradoEm || '')) || a.i - b.i)
    .map(x => x.h);
}

// Tela da ficha: histórico AGRUPADO por categoria (Falta, FT, Treinamento, Férias, Atraso, …), cada grupo do mais
// recente para o mais antigo (último primeiro). Em cascata: só as 3 últimas datas visíveis; "ver mais" abre o resto.
export const HIST_VISIVEIS = 3;
export const HIST_ORDEM_GRUPOS = ['Falta', 'FT', 'Atraso', 'Medida Disciplinar', 'Férias', 'Treinamento', 'Promoção'];
export function agruparHistorico(historico) {
  const desc = ordenarHistorico(historico).reverse();
  const grupos = new Map();
  for (const h of desc) { const t = (h && h.tipo) || 'Outros'; if (!grupos.has(t)) grupos.set(t, []); grupos.get(t).push(h); }
  const pos = t => { const i = HIST_ORDEM_GRUPOS.indexOf(t); return i < 0 ? 99 : i; };
  return [...grupos.entries()].sort((a, b) => pos(a[0]) - pos(b[0]) || a[0].localeCompare(b[0])).map(([tipo, itens]) => ({ tipo, itens }));
}
