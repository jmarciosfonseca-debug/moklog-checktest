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

// Fórmula de 16/11/2026: (admissões + desligamentos) ÷ 2 ÷ efetivo médio. Antes era só saídas ÷ efetivo médio (60%).
test('P311A: (10 admissões + 6 saídas) ÷ 2 ÷ efetivo médio 10 = 80%', () => {
  const r = calcularEstabilidade(p311a(), HOJE);
  expect(r).toMatchObject({ ativosHoje: 12, entradas12m: 10, desligados12m: 6, efetivoInicial: 8, efetivoMedio: 10, duplicadosIgnorados: 0 });
  expect(r.turnover).toBeCloseTo(80, 5);
});

test('registro duplicado da Josiane (mesmo id) não soma: continua 6 saídas e 80%', () => {
  const r = calcularEstabilidade(p311a([deslig('d3', 'Josiane Andrade da Silva', '2026-07-10')]), HOJE);
  expect(r.desligados12m).toBe(6);
  expect(r.duplicadosIgnorados).toBe(1);
  expect(r.turnover).toBeCloseTo(80, 5);
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
  expect(Math.round(calcularEstabilidade(p311a(), HOJE).taxaSaidas)).toBe(60); // só saídas: segue 60%
  expect(Math.round(calcularEstabilidade(p311a(), HOJE).turnover)).toBe(80);   // fórmula nova (com as 10 admissões)
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

// ---- Fórmula do cliente e busca por período (Marcio, 16/11/2026) ----
describe('turnover = (admissões + desligamentos) ÷ 2 ÷ efetivo médio', () => {
  const eq = (ativos, desligados = []) => ({ colaboradores: ativos, desligados });
  const antigos = (n) => Array.from({ length: n }, (_, i) => ativo(`v${i}`, '2020-01-10'));
  const saiu = (id, em, adm) => ({ id, nome: `Saiu ${id}`, status: 'desligado', desligadoEm: em, dataContratacao: adm });

  test('equipe estável com reposição: 4 saíram e 4 entraram em 20 → 20% (igual à fórmula antiga)', () => {
    const r = calcularEstabilidade(eq([...antigos(16), ...Array.from({ length: 4 }, (_, i) => ativo(`n${i}`, '2026-03-01'))], Array.from({ length: 4 }, (_, i) => saiu(`s${i}`, '2026-02-01', '2019-05-05'))), HOJE);
    expect(r).toMatchObject({ admissoes: 4, saidas: 4, movimentacao: 4, efetivoInicial: 20, efetivoMedio: 20 });
    expect(r.turnover).toBeCloseTo(20, 5);
    expect(r.taxaSaidas).toBeCloseTo(20, 5);
  });
  test('equipe que cresce de 20 para 24 sem ninguém sair: 9,1% (antes 0%)', () => {
    const r = calcularEstabilidade(eq([...antigos(20), ...Array.from({ length: 4 }, (_, i) => ativo(`n${i}`, '2026-03-01'))]), HOJE);
    expect(r.turnover).toBeCloseTo(2 / 22 * 100, 5);
    expect(r.taxaSaidas).toBe(0);
  });
  test('quem entrou e saiu dentro da janela conta como admissão e como desligamento, e não infla o efetivo inicial', () => {
    const r = calcularEstabilidade(eq(antigos(10), [saiu('x', '2026-08-01', '2026-03-01')]), HOJE);
    expect(r).toMatchObject({ admissoes: 1, saidas: 1, efetivoInicial: 10, efetivoMedio: 10, entradas12m: 0 });
    expect(r.turnover).toBeCloseTo(10, 5);
  });
  test('transferência entre projetos não entra como admissão nem como desligamento', () => {
    const r = calcularEstabilidade(eq(antigos(10), [{ ...saiu('t', '2026-08-01', '2026-03-01'), tipoDesligamento: 'Transferência' }]), HOJE);
    expect(r).toMatchObject({ admissoes: 0, saidas: 0 });
    expect(r.turnover).toBe(0);
  });
  test('24 e 36 meses: o turnover é a média por ano; o acumulado vai à parte', () => {
    const e = eq(antigos(10), [saiu('a', '2026-08-01', '2019-01-01'), saiu('b', '2025-06-01', '2019-01-01'), saiu('c', '2024-06-01', '2019-01-01')]);
    const r12 = calcularEstabilidade(e, HOJE), r24 = calcularEstabilidade(e, HOJE, { meses: 24 }), r36 = calcularEstabilidade(e, HOJE, { meses: 36 });
    expect([r12.saidas, r24.saidas, r36.saidas]).toEqual([1, 2, 3]);
    expect(r12.meses).toBe(12); expect(r36.meses).toBe(36);
    expect(r36.turnoverPeriodo).toBeCloseTo(1.5 / 11.5 * 100, 5);
    expect(r36.turnover).toBeCloseTo(r36.turnoverPeriodo / 3, 5);
    expect(r24.turnover).toBeCloseTo(r24.turnoverPeriodo / 2, 5);
    expect(calcularEstabilidade(e, HOJE, { meses: 7 }).meses).toBe(12); // janela inválida cai no padrão
  });
  test('continua "não aferido" com cadastro incompleto ou efetivo médio abaixo de 3', () => {
    expect(calcularEstabilidade(eq([ativo(1, '2020-01-01'), ativo(2, null), ativo(3, '2021-01-01')]), HOJE).turnover).toBeNull();
    expect(calcularEstabilidade(eq([ativo(1, '2020-01-01')]), HOJE).motivoNaoAferido).toBe('efetivo médio abaixo de 3');
  });
});
