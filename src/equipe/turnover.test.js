import { calcularEstabilidade, desligadosUnicos } from './maturidade';

const HOJE = '2026-10-13';
const ativo = (n, adm) => ({ id: `a${n}`, nome: `Ativo ${n}`, status: 'ativo', dataContratacao: adm });
const deslig = (id, nome, em) => ({ id, nome, status: 'desligado', desligadoEm: em });

// P311A em 13/10/2026: 12 ativos (10 admitidos nos últimos 12 meses) e 6 desligados.
function p311a(extra = []) {
  const colaboradores = [
    ativo(1, '2022-04-01'), ativo(2, '2025-10-02'),
    ...Array.from({ length: 10 }, (_, i) => ativo(i + 3, `2026-0${(i % 8) + 1}-15`)),
  ];
  const desligados = [
    deslig('d1', 'Jenifer Brunel Ferreira', '2026-10-02'), deslig('d2', 'Francisco De Assis', '2026-07-17'),
    deslig('d3', 'Josiane Andrade da Silva', '2026-07-10'), deslig('d4', 'Felipe Nobre Bottega', '2026-07-02'),
    deslig('d5', 'Enderson Guimarães', '2026-06-24'), deslig('d6', 'Luciano Rogério de Mello', '2026-06-15'),
    ...extra,
  ];
  return { colaboradores, desligados };
}

test('P311A: 6 saídas ÷ efetivo médio 10 = 60%', () => {
  const r = calcularEstabilidade(p311a(), HOJE);
  expect(r).toMatchObject({ ativosHoje: 12, entradas12m: 10, desligados12m: 6, efetivoInicial: 8, efetivoMedio: 10, duplicadosIgnorados: 0 });
  expect(r.turnover).toBeCloseTo(60, 5);
});

test('registro duplicado da Josiane (mesmo id) não soma: continua 6 saídas e 60%', () => {
  const r = calcularEstabilidade(p311a([deslig('d3', 'Josiane Andrade da Silva', '2026-07-10')]), HOJE);
  expect(r.desligados12m).toBe(6);
  expect(r.duplicadosIgnorados).toBe(1);
  expect(r.turnover).toBeCloseTo(60, 5);
});

test('duplicidade com id diferente: mesmo nome (com/sem acento, caixa) e mesma data é um desligamento só', () => {
  const r = calcularEstabilidade(p311a([deslig('x9', 'JOSIANE ANDRADE DA SILVA', '2026-07-10')]), HOJE);
  expect(r.desligados12m).toBe(6);
  expect(r.duplicadosIgnorados).toBe(1);
});

test('mesma pessoa com dois lançamentos (mesmo id, ou sem id e mesmo nome) conta uma vez, pela saída mais recente', () => {
  const { unicos } = desligadosUnicos([deslig('a', 'Maria Souza', '2026-03-01'), deslig('a', 'Maria Souza', '2026-08-01')]);
  expect(unicos).toHaveLength(1);
  expect(unicos[0].desligadoEm).toBe('2026-08-01');
  const semId = desligadosUnicos([{ nome: 'Maria Souza', desligadoEm: '2026-03-01' }, { nome: 'maria souza', desligadoEm: '2026-08-01' }]);
  expect(semId.unicos).toHaveLength(1);
});

test('quem consta como ativo e também como desligado (mesmo id) não conta como saída', () => {
  const eq = p311a([deslig('a5', 'Ativo 5', '2026-09-01')]);
  const r = calcularEstabilidade(eq, HOJE);
  expect(r.desligados12m).toBe(6);
  expect(r.duplicadosIgnorados).toBe(1);
});

test('versão enviada em 12/10 (7 em 18 = 39%) vs correta: a duplicata inflava o número', () => {
  expect(Math.round(7 / 18 * 100)).toBe(39);
  expect(Math.round(calcularEstabilidade(p311a(), HOJE).turnover)).toBe(60);
});

test('saída fora da janela de 12 meses não entra', () => {
  const r = calcularEstabilidade(p311a([deslig('d9', 'Antigo', '2025-06-01')]), HOJE);
  expect(r.desligados12m).toBe(6);
});

test('sem data de admissão/saída ou efetivo muito pequeno: não aferido, com motivo', () => {
  const eq = p311a(); eq.colaboradores[0].dataContratacao = null;
  let r = calcularEstabilidade(eq, HOJE);
  expect(r.turnover).toBeNull(); expect(r.motivoNaoAferido).toMatch(/sem data de admissão/);
  r = calcularEstabilidade({ colaboradores: [ativo(1, '2020-01-01'), ativo(2, '2020-01-01')], desligados: [] }, HOJE);
  expect(r.turnover).toBeNull(); expect(r.motivoNaoAferido).toMatch(/abaixo de 3/);
});
