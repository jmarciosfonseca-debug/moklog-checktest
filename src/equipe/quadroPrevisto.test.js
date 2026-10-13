import { QUADRO_PREVISTO, ORDEM_PROJETOS, TOTAL_HOMOLOGADO, qtdPorRegra, totalQuadro, totalGeral, ocupacaoDoQuadro, turnoverSobreQuadro, funcaoDoCargo } from './quadroPrevisto';

const ESPERADO = { P260A: 8, P260B: 3, P260C: 7, P311A: 14, P311B: 12, P505: 14, P601: 16, P602: 12, P604: 19, P605: 15, P606: 12, P607: 14 };

test('gabarito oficial: totais por projeto e 146 colaboradores homologados', () => {
  ORDEM_PROJETOS.forEach((pid) => expect(totalQuadro(pid)).toBe(ESPERADO[pid]));
  expect(ORDEM_PROJETOS).toHaveLength(12);
  expect(totalGeral()).toBe(TOTAL_HOMOLOGADO);
  expect(TOTAL_HOMOLOGADO).toBe(146);
  expect(Object.keys(QUADRO_PREVISTO).sort()).toEqual(Object.keys(ESPERADO).sort());
});

test('cada posto obedece à regra de cobertura da escala (4x2=3, 12x36 24h=4, 12x36 diurno=2)', () => {
  Object.values(QUADRO_PREVISTO).flat().forEach((x) => {
    const regra = qtdPorRegra(x.regime, x.escala, x.postos);
    if (regra !== null) expect({ cargo: x.cargo, qtd: x.qtd }).toEqual({ cargo: x.cargo, qtd: regra });
    else expect(x.qtd).toBeGreaterThanOrEqual(1);
  });
});

const ficha = (cargo, i) => ({ id: `c${i}`, cargo, status: 'ativo' });

test('P311A em 13/10/2026: 12 ativos em 14 postos, vagas = 1 porteiro + 1 apoio', () => {
  const ativos = [...Array(4).fill('Vigilante Líder'), ...Array(3).fill('Porteiro CCO'), ...Array(4).fill('Vigilante Ronda'), 'Vigilante Apoio'].map(ficha);
  const o = ocupacaoDoQuadro('P311A', ativos);
  expect(o).toMatchObject({ previsto: 14, ativos: 12, vagas: 2, excedente: 0, semPosto: 0, ocupacaoPct: 86 });
  expect(o.linhas.filter((l) => l.vagas > 0).map((l) => [l.cargo, l.vagas])).toEqual([['Porteiro CCO', 1], ['Vigilante Apoio', 1]]);
});

test('turnover sobre o quadro: P311A 6 ÷ 14 = 43%', () => {
  expect(Math.round(turnoverSobreQuadro('P311A', 6))).toBe(43);
  expect(turnoverSobreQuadro('P999', 6)).toBeNull();
});

test('cargo não reconhecido não é inventado: vai para semPosto, e o total de vagas continua certo', () => {
  const o = ocupacaoDoQuadro('P311A', [ficha('Supervisor Geral', 1), ficha('Vigilante Líder', 2)]);
  expect(o.semPosto).toBe(1);
  expect(o.ativos).toBe(2);
  expect(o.vagas).toBe(12);
});

test('reconhece por função quando o nome do cargo muda de grafia; ambíguo não casa', () => {
  expect(funcaoDoCargo('Vig. Monitoramento (CCO)')).toBe('cco');
  expect(funcaoDoCargo('Porteiro CCO')).toBe('cco');
  const o = ocupacaoDoQuadro('P601', [ficha('VSPP Ronda', 1), ficha('Vigilante CCO', 2), ficha('Controlador de Acesso', 3), ficha('VSPP Diurno', 4)]);
  const por = Object.fromEntries(o.linhas.map((l) => [l.cargo, l.ocupados]));
  expect(por['VSPP Ronda Diurno']).toBe(1); expect(por['Vig. Monitoramento (CCO)']).toBe(1);
  expect(por['Controlador de Acesso (CDA)']).toBe(1); expect(por['VSPP Diurno']).toBe(1);
  expect(o.semPosto).toBe(0);
});

test('desligados e afastados fora do status ativo não ocupam posto; excedente é sinalizado', () => {
  const ativos = [ficha('VSPP Operacional', 1), ficha('VSPP Operacional', 2), ficha('VSPP Operacional', 3), ficha('VSPP Operacional', 4), { cargo: 'VSPP Operacional', status: 'desligado' }];
  const o = ocupacaoDoQuadro('P260B', ativos);
  expect(o).toMatchObject({ previsto: 3, ativos: 4, vagas: 0, excedente: 1 });
});
