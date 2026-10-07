// Regras exclusivas dos relatórios: não modificam registros nem contadores operacionais.
export const BOLSAO_PROJETOS = { P505: { bolsaoTipo: 'interno' }, P311A: { bolsaoTipo: 'externo' }, P311B: { bolsaoTipo: 'externo' } };
export function bolsaoTipo(project = {}) {
  return ['interno', 'externo'].includes(project.bolsaoTipo) ? project.bolsaoTipo : (BOLSAO_PROJETOS[project.id]?.bolsaoTipo || 'externo');
}
export function normalizarInquilino(nome) {
  const s = String(nome || '').trim().replace(/\s+/g, ' ');
  const k = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/^gat(?: logistica)?$/.test(k)) return 'GAT Logística';
  if (/^kuehne\s*\+\s*nagel(?: servicos logisticos ltda\.?)?$/.test(k)) return 'Kuehne+Nagel';
  if (/^chama(?: supermercados)?$/.test(k)) return 'Chama';
  return s ? s.toLocaleLowerCase('pt-BR').replace(/(^|\s)\S/g, c => c.toLocaleUpperCase('pt-BR')) : 'Não informado';
}
export function dataLocal(ts) {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}
export function placaDias(p) { return new Set(p.dias || []).size; }
export function placasObservadas(placas = {}, checagens = []) {
  const mapa = new Map();
  const alias = new Map();
  Object.entries(placas).forEach(([key,p]) => { alias.set(key, p.placa || key); (p.aliases || []).forEach(a => alias.set(a, p.placa || key)); });
  checagens.forEach(c => {
    const dia = c.data || dataLocal(c.criadoEm);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return;
    (c.itens || []).forEach(i => {
      const placa = alias.get(i.placa) || i.placa;
      if (!placa) return;
      const base = placas[placa] || {};
      const ts = c.criadoEm || `${dia}T${c.hora || '00:00'}:00-03:00`;
      let p = mapa.get(placa);
      if (!p) { p = { ...base, placa, dias: [], ultimaVista: '', inquilino: i.inquilino || base.inquilino, tipo: c.tipo || base.tipo }; mapa.set(placa, p); }
      p.dias.push(dia);
      if (ts >= p.ultimaVista) { p.ultimaVista = ts; p.inquilino = i.inquilino || base.inquilino; p.tipo = c.tipo || base.tipo; }
    });
  });
  return [...mapa.values()].map(p => ({ ...p, dias: [...new Set(p.dias)].sort() }));
}
export function reguaOcupacao(placas) {
  const grupos = new Map();
  placas.forEach(p => {
    const nome = normalizarInquilino(p.inquilino);
    if (!grupos.has(nome)) grupos.set(nome, new Map());
    const g = grupos.get(nome);
    if (!g.has(p.placa)) g.set(p.placa, new Set());
    (p.dias || []).forEach(d => g.get(p.placa).add(d));
  });
  const linhas = [...grupos].map(([inquilino, ps]) => ({ inquilino, numPlacas: ps.size, placaDias: [...ps.values()].reduce((n, ds) => n + ds.size, 0) }));
  const total = linhas.reduce((n, p) => n + p.placaDias, 0);
  return linhas.map(p => ({ ...p, pct: total ? Math.round(100 * p.placaDias / total) : 0 })).sort((a,b) => b.placaDias - a.placaDias || a.inquilino.localeCompare(b.inquilino));
}
export function internoExterno(placas) {
  const unicas = [...new Map(placas.map(p => [p.placa, p])).values()];
  return ['interno', 'externo', 'naoInformado'].map(tipo => {
    const quantidade = unicas.filter(p => (['interno','externo'].includes(p.tipo) ? p.tipo : 'naoInformado') === tipo).length;
    return { tipo, quantidade, pct: unicas.length ? Math.round(100 * quantidade / unicas.length) : 0 };
  });
}
export function percentualPorInquilino(placas) {
  const unicas = [...new Map(placas.map(p => [p.placa, p])).values()];
  const grupos = reguaOcupacao(unicas);
  return grupos.map(g => ({ inquilino: g.inquilino, numPlacas: g.numPlacas, pct: unicas.length ? Math.round(100 * g.numPlacas / unicas.length) : 0 }));
}
