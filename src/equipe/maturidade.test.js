import { calcularRH, agregarEixos, calcularTreinamento, calcularEstabilidade, agregarEquipe, calcularReciclagem, calcularTempoCasa, calcularMapaEquipe } from './maturidade';
import { statusReciclagem } from '../pendencias';

test.each(['2026-10-09', '2026-10-08', '2026-08-24'])('reciclagem equivalente ao módulo canônico em %s', referencia => {
  jest.useFakeTimers().setSystemTime(new Date(`${referencia}T12:00:00`));
  try {
    const real = statusReciclagem('2024-10-08');
    const motor = calcularReciclagem({ cargo: 'vigilante', ultimaReciclagem: '2024-10-08' }, referencia);
    expect(motor.estado).toBe(real.estado);
    expect(motor.diasRestantes).toBe(real.diasRestantes);
    expect(+motor.vencimento).toBe(+real.vencimento);
  } finally { jest.useRealTimers(); }
});
test.each([['2026-09-01', 20], ['2026-07-08', 50], ['2025-10-08', 80], ['2022-10-08', 100], [null, null]])('tempo de casa %s', (admissao, nota) => {
  expect(calcularTempoCasa(admissao, '2026-10-08')).toBe(nota);
});
test('modelo comum conserva empates no top 3 e alerta férias sem cobertura', () => {
  const colaboradores = Array.from({ length: 4 }, (_, n) => ({ id: String(n), nome: `Pessoa ${n}`, status: 'ativo', cargo: 'porteiro', dataContratacao: '2020-01-01', historico: [] }));
  const mapa = calcularMapaEquipe({ colaboradores, ferias: [{ colabId: '0', dataInicio: '2026-10-20' }] }, '2026-10-08');
  expect(mapa.top).toHaveLength(4);
  expect(mapa.eixos.treinamento).toBeNull();
  expect(mapa.alertas[0].texto).toContain('sem cobertura');
  expect(mapa.indice).toBe(100);
});
const hoje = '2026-10-08';
const colab = { dataContratacao: '2020-01-01', historico: [] };
test('histórico vazio sem cobertura não recebe nota', () => {
  expect(calcularRH(colab, null, hoje).assiduidade).toBeNull();
});
test('cobertura inferior a 90 dias não aferida', () => {
  expect(calcularRH(colab, '2026-10-01', hoje).ft).toBeNull();
});
test('cobertura confirmada, zero faltas e FT neutra', () => {
  expect(calcularRH(colab, '2025-01-01', hoje)).toMatchObject({ assiduidade: 100, ft: 50 });
});
test('período tem teto e justificada metade', () => {
  const c = { ...colab, historico: [{ tipo: 'Falta', subtipo: 'Período', data: '2026-09-01', dataFim: '2026-09-30', justificada: true }] };
  expect(calcularRH(c, '2025-01-01', hoje).assiduidade).toBe(85);
});
test('afastamento aberto não penaliza e sinaliza exclusão após 30 dias', () => {
  const c = { ...colab, historico: [{ tipo: 'Falta', emAberto: true, data: '2026-09-01' }] };
  expect(calcularRH(c, '2025-01-01', hoje)).toMatchObject({ assiduidade: 100, afastado: true });
});
test('FT positiva com teto', () => {
  const c = { ...colab, historico: Array.from({ length: 8 }, () => ({ tipo: 'FT', data: '2026-09-01' })) };
  expect(calcularRH(c, '2025-01-01', hoje).ft).toBe(100);
});
test('null renormaliza e todos ausentes não ganham zero', () => {
  expect(agregarEixos({ tempoCasa: 80 }).indice).toBe(80);
  expect(agregarEixos({}).indice).toBeNull();
});
test.each([[85, 'Referência'], [70, 'Consolidado'], [50, 'Em desenvolvimento'], [49, 'Atenção']])('corte %s', (valor, classe) => {
  expect(agregarEixos({ tempoCasa: valor }).classe).toBe(classe);
});
test('treinamento sem catálogo não é zero', () => {
  expect(calcularTreinamento(colab, [], hoje)).toBeNull();
});
test('treinamentos obrigatórios válidos por nome normalizado', () => {
  const c = { historico: [{ tipo: 'Treinamento', detalhe: ' INTEGRAÇÃO ', data: '2026-09-01' }] };
  expect(calcularTreinamento(c, [{ nome: 'integracao', obrigatorio: true }, { nome: 'NR35', obrigatorio: true }], hoje)).toBe(50);
});
test('treinamento expirado não conta', () => {
  const c = { historico: [{ tipo: 'Treinamento', detalhe: 'NR35', data: '2020-01-01' }] };
  expect(calcularTreinamento(c, [{ nome: 'NR35', obrigatorio: true, validadeMeses: 12 }], hoje)).toBe(0);
});
test('estabilidade sem saídas e efetivo suficiente é 100', () => {
  expect(calcularEstabilidade({ colaboradores: Array.from({ length: 4 }, () => ({ ...colab, status: 'ativo' })) }, hoje).estabilidade).toBe(100);
});
test('efetivo pequeno ou desligamento sem data não aferido', () => {
  expect(calcularEstabilidade({ colaboradores: [] }, hoje).estabilidade).toBeNull();
  expect(calcularEstabilidade({ colaboradores: Array.from({ length: 4 }, () => ({ ...colab, status: 'ativo' })), desligados: [{}] }, hoje).estabilidade).toBeNull();
});
test('equipe renormaliza estabilidade ausente e exclui afastado', () => {
  expect(agregarEquipe([{ indice: 80 }, { indice: 0, afastado: true }], null).indice).toBe(80);
  expect(agregarEquipe([], 100).indice).toBeNull();
});
