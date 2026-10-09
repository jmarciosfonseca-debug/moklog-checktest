// Cobertura de treinamentos registrados nas fichas (dados fictícios).
import { resumirTreinamentos, rotuloTreinamentos, notaTreinamentos, classificarTreinamentos, calcularMapaEquipe, SEM_TREINAMENTO, TITULO_TREINAMENTOS } from './maturidade';
const HOJE = '2026-10-09';
const curso = (data = '2026-05-01', detalhe = 'Brigada / estande de tiro (fictício)') => ({ tipo: 'Treinamento', detalhe, data });
const pessoa = (id, historico = []) => ({ id, nome: `Pessoa ${id}`, status: 'ativo', cargo: 'porteiro', dataContratacao: '2020-01-01', historico });

test('nenhuma pessoa com registro → não aferido, com a frase exigida', () => {
  const r = resumirTreinamentos([pessoa('a'), pessoa('b')], HOJE);
  expect(r).toMatchObject({ total: 2, comRegistro: 0, comRegistro12m: 0, percentual12m: null });
  expect(rotuloTreinamentos(r)).toBe(SEM_TREINAMENTO);
  expect(rotuloTreinamentos(r)).toBe('Não aferido — sem treinamento registrado nas fichas');
  expect(notaTreinamentos(r)).toMatch(/não prova/);
});
test('uma pessoa treinada entre duas: 50% — e o título declara a janela de 12 meses', () => {
  const m = calcularMapaEquipe({ colaboradores: [pessoa('a', [curso()]), pessoa('b')] }, HOJE);
  expect(m.treinamentos).toMatchObject({ comRegistro: 1, comRegistro12m: 1, percentual12m: 50, total: 2, janelaMeses: 12 });
  expect(rotuloTreinamentos(m.treinamentos)).toBe('1 de 2 colaboradores com registro — 50%');
  expect(TITULO_TREINAMENTOS).toBe('Treinamentos aplicados — últimos 12 meses');
  expect(m.eixos.treinamento).toBeNull(); // cobertura não vira conclusão de obrigatórios
});
test('uma pessoa com vários cursos conta uma vez', () => {
  const r = resumirTreinamentos([pessoa('a', [curso(), curso('2026-06-01'), curso('2026-07-01')]), pessoa('b')], HOJE);
  expect(r.comRegistro12m).toBe(1); expect(r.percentual12m).toBe(50);
});
test('todas as pessoas com registro: 100%', () => {
  expect(resumirTreinamentos([pessoa('a', [curso()]), pessoa('b', [curso('2026-09-30')])], HOJE).percentual12m).toBe(100);
});
test('registro antigo e sem data ficam como histórico, sem inflar os 12 meses', () => {
  const r = resumirTreinamentos([pessoa('a', [curso('2020-01-01')]), pessoa('b', [curso('')]), pessoa('c', [curso('31/12/2025')])], HOJE);
  expect(r).toMatchObject({ comRegistro: 3, comRegistro12m: 0, percentual12m: 0, somenteHistorico: 3 });
  expect(rotuloTreinamentos(r)).toBe('0 de 3 colaboradores com registro — 0%');
  expect(notaTreinamentos(r)).toMatch(/nenhum registro dentro dos últimos 12 meses/);
  expect(notaTreinamentos(r)).toMatch(/3 só com registro antigo ou sem data/);
});
test('registro futuro não conta como realizado; registro vazio é descartado', () => {
  const t = classificarTreinamentos(pessoa('a', [curso('2027-01-01'), { tipo: 'Treinamento', detalhe: '   ' }, { tipo: 'Treinamento' }]), HOJE);
  expect(t).toMatchObject({ registros: 0 }); expect(t.futuros).toHaveLength(1);
  const r = resumirTreinamentos([pessoa('a', [curso('2027-01-01')]), pessoa('b', [curso('2025-10-09')])], HOJE);
  expect(r).toMatchObject({ comRegistro: 1, comRegistro12m: 1, comFuturo: 1, percentual12m: 50 });   // borda da janela entra
  expect(notaTreinamentos(r)).toMatch(/1 com treinamento agendado/);
});
test('desligado fica fora do denominador ativo; status ausente conta como ativo (regra do app)', () => {
  const m = calcularMapaEquipe({ colaboradores: [pessoa('a', [curso()]), { ...pessoa('b'), status: 'desligado' }, { ...pessoa('c', [curso()]), status: undefined }] }, HOJE);
  expect(m.treinamentos).toMatchObject({ total: 2, comRegistro12m: 2, percentual12m: 100 });
});
test('treinamento registrado sem catálogo: cobertura aparece, obrigatórios ficam sem catálogo (não zero)', () => {
  const m = calcularMapaEquipe({ colaboradores: [pessoa('a', [curso()])] }, HOJE);
  expect(m.treinamentos.percentual12m).toBe(100);
  expect(m.individuos[0].eixos.treinamento).toBeNull();
  expect(m.individuos[0].naoAferidos).toContain('treinamento');
  expect(m.individuos[0].alertas).not.toContain('Treinamento obrigatório pendente');
});
test('ficha recebe os registros classificados (recentes, antigos, sem data, futuros) ordenados por data desc', () => {
  const m = calcularMapaEquipe({ colaboradores: [pessoa('a', [curso('2026-01-10', 'B'), curso('2026-08-01', 'A'), curso('2019-01-01', 'C'), curso('', 'D'), curso('2027-02-02', 'E')])] }, HOJE);
  const t = m.individuos[0].treinamentosFicha;
  expect(t.recentes.map(h => h.detalhe)).toEqual(['A', 'B']);
  expect(t.antigos.map(h => h.detalhe)).toEqual(['C']);
  expect(t.semData.map(h => h.detalhe)).toEqual(['D']);
  expect(t.futuros.map(h => h.detalhe)).toEqual(['E']);
});
