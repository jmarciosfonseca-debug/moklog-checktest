// Matriz de Dimensionamento de Efetivo — gabarito oficial Moked (13/10/2026): postos, regime, escala e quantitativo
// previsto por projeto. Referência para "postos x colaboradores ativos x postos vagos" e para o turnover sobre o quadro.
// Regras de cobertura por escala (por posto): 4x2 contínua 24h = 3 (1 diurno + 1 noturno + 1 folguista);
// 12x36 contínua 24h = 4 (2 diurnos A/B + 2 noturnos A/B); 12x36 diurna 12h = 2 (1 diurno A + 1 diurno B);
// 5x2 diurna/comercial = titulares fixos (1 ou 2, conforme o posto).
export const REGIME = Object.freeze({ C24: '24h contínuo', D12: '12h diurno', COM: 'Comercial diurno' });
export const COMP = Object.freeze({
  '4x2': '1 Diurno, 1 Noturno, 1 Folguista',
  '12x36-24h': '2 Diurnos A/B, 2 Noturnos A/B',
  '12x36-12h': '1 Diurno A, 1 Diurno B',
});

// Quantidade que a regra de escala exige por posto (null = escala comercial, quantidade informada no gabarito).
export function qtdPorRegra(regime, escala, postos = 1) {
  if (escala === '4x2' && regime === REGIME.C24) return 3 * postos;
  if (escala === '12x36' && regime === REGIME.C24) return 4 * postos;
  if (escala === '12x36' && regime === REGIME.D12) return 2 * postos;
  return null;
}

const p = (cargo, regime, escala, qtd, extra = {}) => {
  const postos = extra.postos || 1;
  const composicao = extra.composicao || (escala === '4x2' ? COMP['4x2'] : escala === '12x36' ? (regime === REGIME.C24 ? COMP['12x36-24h'] : COMP['12x36-12h']) : (qtd === 1 ? '1 titular diurno' : `${qtd} titulares diurnos`));
  return { cargo, regime, escala, qtd, postos, composicao };
};
const C = REGIME.C24, D = REGIME.D12, M = REGIME.COM;

export const QUADRO_PREVISTO = Object.freeze({
  P260A: [p('VSPP Líder', C, '4x2', 3), p('Vig. Monitoramento (CCO)', C, '4x2', 3), p('VSPP Apoio', D, '5x2', 2)],
  P260B: [p('VSPP Operacional', C, '4x2', 3)],
  P260C: [p('VSPP Líder', C, '4x2', 3), p('Vigilante Patrimonial', C, '12x36', 4)],
  P311A: [p('Vigilante Líder', C, '12x36', 4), p('Vigilante Ronda', C, '12x36', 4), p('Porteiro CCO', C, '12x36', 4), p('Vigilante Apoio', D, '12x36', 2)],
  P311B: [p('Vigilante Líder', C, '12x36', 4), p('Vigilante CCO', C, '12x36', 4), p('Vigilante Ronda', C, '12x36', 4)],
  P505: [p('VSPP Líder', C, '4x2', 3), p('Vig. Monitoramento (CCO)', C, '4x2', 3), p('VSPP Ronda', M, '5x2', 1), p('Controlador de Acesso (CDA)', C, '12x36', 4), p('VSPP Apoio', C, '4x2', 3)],
  P601: [p('VSPP Líder', C, '12x36', 4), p('Vig. Monitoramento (CCO)', C, '12x36', 4), p('VSPP Diurno', D, '12x36', 2), p('VSPP Ronda Diurno', D, '12x36', 2), p('Controlador de Acesso (CDA)', C, '12x36', 4)],
  P602: [p('VSPP Líder', C, '12x36', 4), p('Vigilante Apoio', C, '12x36', 4), p('Vig. Monitoramento (CCO)', C, '12x36', 4)],
  P604: [p('Recepcionista', M, '5x2', 1), p('Controlador de Acesso (CDA)', D, '12x36', 2), p('VSPP Líder', C, '12x36', 4), p('Vig. Monitoramento (CCO)', C, '12x36', 4),
    p('VSPP Apoio (2 postos)', C, '12x36', 8, { postos: 2, composicao: '4 Diurnos (2A/2B), 4 Noturnos (2A/2B)' })],
  P605: [p('Recepcionista', M, '5x2', 1), p('Controlador de Acesso (CDA)', D, '12x36', 2), p('VSPP Líder', C, '12x36', 4), p('Vig. Monitoramento (CCO)', C, '12x36', 4), p('VSPP Apoio', C, '12x36', 4)],
  P606: [p('Vigilante Líder', C, '12x36', 4), p('Vig. Monitoramento (CCO)', C, '12x36', 4), p('Vigilante Apoio', C, '12x36', 4)],
  P607: [p('AGP Portaria', D, '12x36', 2), p('Vigilante Ronda', C, '12x36', 4), p('Vigilante Pista', C, '12x36', 4), p('AGP CCO', C, '12x36', 4)],
});

export const TOTAL_HOMOLOGADO = 146;
export const ORDEM_PROJETOS = Object.freeze(['P260A', 'P260B', 'P260C', 'P311A', 'P311B', 'P505', 'P601', 'P602', 'P604', 'P605', 'P606', 'P607']);

export const quadroDoProjeto = (pid) => QUADRO_PREVISTO[pid] || null;
export const totalQuadro = (pid) => (QUADRO_PREVISTO[pid] || []).reduce((s, x) => s + x.qtd, 0);
export const totalGeral = () => ORDEM_PROJETOS.reduce((s, pid) => s + totalQuadro(pid), 0);

// ── Reconhecimento do posto a partir do cargo cadastrado na ficha ──
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function funcaoDoCargo(cargo) {
  const n = norm(cargo);
  if (!n) return '';
  if (n.includes('lider')) return 'lider';
  if (n.includes('ronda')) return 'ronda';
  if (n.includes('apoio')) return 'apoio';
  if (n.includes('cda') || n.includes('controladordeacesso')) return 'cda';
  if (n.includes('recepcion')) return 'recepcao';
  if (n.includes('pista')) return 'pista';
  if (n.includes('cco') || n.includes('monitoramento')) return 'cco';
  if (n.includes('portaria')) return 'portaria';
  if (n.includes('porteiro')) return 'porteiro';
  if (n.includes('operacional')) return 'operacional';
  if (n.includes('patrimonial')) return 'patrimonial';
  if (n.includes('diurno')) return 'diurno';
  return '';
}

// Ocupação do quadro: ativos por posto (quando o cargo da ficha identifica o posto sem ambiguidade),
// vagas por posto e total. `ativos` = fichas ativas do projeto. Nunca inventa: o que não for reconhecido vai para semPosto.
export function ocupacaoDoQuadro(pid, ativos) {
  const postos = QUADRO_PREVISTO[pid];
  if (!postos) return null;
  const lista = (Array.isArray(ativos) ? ativos : []).filter((c) => c && (c.status || 'ativo') === 'ativo');
  const linhas = postos.map((x) => ({ ...x, ocupados: 0 }));
  let semPosto = 0;
  lista.forEach((c) => {
    const nc = norm(c.cargo);
    let alvo = linhas.find((l) => norm(l.cargo) === nc);
    if (!alvo) {
      const fn = funcaoDoCargo(c.cargo);
      const candidatos = fn ? linhas.filter((l) => funcaoDoCargo(l.cargo) === fn) : [];
      if (candidatos.length === 1) alvo = candidatos[0];
    }
    if (alvo) alvo.ocupados += 1; else semPosto += 1;
  });
  const previsto = linhas.reduce((s, l) => s + l.qtd, 0);
  const ativosTotal = lista.length;
  linhas.forEach((l) => { l.vagas = Math.max(0, l.qtd - l.ocupados); l.excedente = Math.max(0, l.ocupados - l.qtd); });
  return { pid, linhas, previsto, ativos: ativosTotal, vagas: Math.max(0, previsto - ativosTotal), excedente: Math.max(0, ativosTotal - previsto), semPosto, ocupacaoPct: previsto ? Math.round(ativosTotal / previsto * 100) : null };
}

// Turnover sobre o quadro previsto: desligamentos dos últimos 12 meses ÷ postos do quadro completo.
export function turnoverSobreQuadro(pid, desligados12m) {
  const q = totalQuadro(pid);
  return q > 0 ? desligados12m / q * 100 : null;
}
