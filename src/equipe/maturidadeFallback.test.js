import { calcularMapaEquipe, primeiroRegistro, treinamentosLancados } from './maturidade';

const equipe = (extra = {}) => ({
  colaboradores: [
    { id: 'a', nome: 'A', status: 'ativo', dataContratacao: '2020-01-01', cargo: 'Vigilante', historico: [
      { tipo: 'Falta', subtipo: 'Dia', data: '2026-03-10' }, { tipo: 'FT', data: '2026-04-01' },
      { tipo: 'Treinamento', detalhe: 'Brigada de incêndio', data: '2026-05-01' }] },
    { id: 'b', nome: 'B', status: 'ativo', dataContratacao: '2021-01-01', cargo: 'Vigilante', historico: [
      { tipo: 'Treinamento', detalhe: ' brigada de incendio ', data: '2026-05-02' }, { tipo: 'Treinamento', detalhe: 'Tiro', data: '2026-06-02' }] },
  ],
  desligados: [], ...extra,
});

test('primeiro registro = menor data de falta/FT/atraso', () => {
  expect(primeiroRegistro(equipe())).toBe('2026-03-10');
  expect(primeiroRegistro({ colaboradores: [], desligados: [] })).toBeNull();
});

test('sem data configurada, assiduidade usa o 1º registro (>= 90 dias) e aferição acontece', () => {
  const m = calcularMapaEquipe(equipe(), '2026-10-10');
  expect(m.eixos.assiduidade).not.toBeNull();
  expect(m.eixos.ft).not.toBeNull();
});

test('com menos de 90 dias de histórico continua não aferido', () => {
  const m = calcularMapaEquipe(equipe(), '2026-04-20');
  expect(m.eixos.assiduidade).toBeNull();
});

test('treinamentos lançados são agrupados sem diferenciar caixa/acento', () => {
  const l = treinamentosLancados(equipe());
  expect(l.find(x => /brigada/i.test(x.nome)).pessoas).toBe(2);
  expect(l).toHaveLength(2);
});
