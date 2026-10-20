import { plantoesAfastamento, afastamentoVigente, promocaoRecente, desligamentosRecentes, linhaDesligamento, agruparHistorico } from './equipeEventos';
import { lancamentosDoMapa } from './mapaDiario/ficha';
import { montarTextoWhatsApp } from './mapaDiario/texto';
import { validarParaConcluir } from './mapaDiario/modelo';

test('plantões de afastamento: inteiro 2..90', () => {
  expect(plantoesAfastamento('4')).toBe(4);
  for (const v of [1, 0, 91, '', 'a', 2.5, null]) expect(plantoesAfastamento(v)).toBeNull();
});
test('afastamento vigente só dentro da janela e com plantões válidos', () => {
  const h = [{ tipo: 'Falta', data: '2026-10-10', afastamentoPlantoes: 4 }, { tipo: 'Falta', data: '2026-10-15' }];
  expect(afastamentoVigente(h, '2026-10-16').plantoes).toBe(4);
  expect(afastamentoVigente(h, '2026-10-16').rotulo).toMatch(/4 plantões desde 10\/10\/2026/);
  expect(afastamentoVigente(h, '2026-10-30')).toBeNull();
  expect(afastamentoVigente([], '2026-10-16')).toBeNull();
});
test('promoção recente (90 dias)', () => {
  const h = [{ tipo: 'Promoção', data: '2026-09-01', cargoNovo: 'Líder' }];
  expect(promocaoRecente(h, '2026-10-16').cargoNovo).toBe('Líder');
  expect(promocaoRecente(h, '2027-03-01')).toBeNull();
});
test('desligamentos das últimas 24h, com quem apontou', () => {
  const agora = new Date('2026-10-16T18:00:00Z');
  const d = [
    { id: 'a', nome: 'Fulano', cargo: 'Vigilante', tipoDesligamento: 'Demissão', desligadoPor: 'Líder Beltrano', desligadoRegistroEm: '2026-10-16T12:00:00Z' },
    { id: 'b', nome: 'Antigo', desligadoRegistroEm: '2026-10-14T12:00:00Z' },
    { id: 'c', nome: 'SemCarimbo' },
  ];
  const r = desligamentosRecentes(d, agora, 24);
  expect(r.map(x => x.id)).toEqual(['a']);
  expect(linhaDesligamento(r[0])).toMatch(/Fulano \(Vigilante\) — Demissão — apontado por Líder Beltrano/);
});
const mapa = (postos) => ({ id: 'P1_2026-10-16_D', data: '2026-10-16', turno: 'D', projetoId: 'P601', postos, veiculos: [], material: { semAlteracao: true } });
test('falta com afastamento vai para a ficha e para o texto do WhatsApp', () => {
  const m = mapa([{ id: 'p1', rotulo: 'Portaria', pessoaId: 'c1', pessoaNome: 'Ana', situacao: 'falta', detalhe: { afastamentoSim: true, afastamentoPlantoes: 4 } }]);
  const l = lancamentosDoMapa(m);
  expect(l[0]).toMatchObject({ tipo: 'Falta', afastamentoPlantoes: 4 });
  expect(l[0].detalhe).toMatch(/AFASTAMENTO: 4 plantões/);
  expect(montarTextoWhatsApp(m)).toMatch(/AFASTADO por 4 plantões/);
  const sem = lancamentosDoMapa(mapa([{ id: 'p1', rotulo: 'Portaria', pessoaId: 'c1', pessoaNome: 'Ana', situacao: 'falta', detalhe: {} }]));
  expect(sem[0].afastamentoPlantoes).toBeUndefined();
});
test('afastamento na cobertura vai para a ficha de quem foi coberto', () => {
  const m = mapa([{ id: 'p1', rotulo: 'Portaria', pessoaId: 'c2', pessoaNome: 'Bia', situacao: 'cobertura', detalhe: { deQuemId: 'c1', deQuem: 'Ana', afastamentoSim: true, afastamentoPlantoes: 3 } }]);
  const l = lancamentosDoMapa(m);
  expect(l).toHaveLength(1);
  expect(l[0]).toMatchObject({ colabId: 'c1', afastamentoPlantoes: 3 });
});
test('Sim sem número válido bloqueia a conclusão', () => {
  const m = mapa([{ id: 'p1', rotulo: 'Portaria', pessoaId: 'c1', pessoaNome: 'Ana', situacao: 'falta', detalhe: { afastamentoSim: true, afastamentoPlantoes: '' } }]);
  expect(validarParaConcluir(m).join(' ')).toMatch(/quantos plantões de afastamento/);
  m.postos[0].detalhe.afastamentoPlantoes = 4;
  expect(validarParaConcluir(m).join(' ')).not.toMatch(/quantos plantões de afastamento/);
});
test('texto do mapa traz o desligamento recente com o líder', () => {
  const m = mapa([]);
  const t = montarTextoWhatsApp(m, { desligamentos: [{ id: 'a', nome: 'Fulano', cargo: 'Vigilante', tipo: 'Demissão', por: 'Líder Beltrano', em: '2026-10-16T12:00:00Z' }] });
  expect(t).toMatch(/FUNCIONÁRIO DESLIGADO/); expect(t).toMatch(/Líder Beltrano/);
});

test('histórico em ordem cronológica pela data do fato, não pelo lançamento', () => {
  const { ordenarHistorico, agruparHistorico } = require('./equipeEventos');
  const h = [
    { id: 'novo-lancado-hoje-fato-2023', tipo: 'Treinamento', data: '2023-05-10', registradoEm: '2026-10-18T10:00:00Z' },
    { id: 'falta-2026', tipo: 'Falta', data: '2026-10-01', registradoEm: '2026-10-01T08:00:00Z' },
    { id: 'ft-2025', tipo: 'FT', data: '2025-03-02', registradoEm: '2025-03-02T08:00:00Z' },
    { id: 'sem-data', tipo: 'Atraso', registradoEm: '2026-01-05T08:00:00Z' },
    { id: 'mesmo-dia-b', tipo: 'Falta', data: '2026-10-01', registradoEm: '2026-10-01T12:00:00Z' },
  ];
  const copia = JSON.stringify(h);
  expect(ordenarHistorico(h).map(x => x.id)).toEqual(['novo-lancado-hoje-fato-2023', 'ft-2025', 'sem-data', 'falta-2026', 'mesmo-dia-b']);
  expect(JSON.stringify(h)).toBe(copia);          // não altera os dados
  expect(ordenarHistorico(undefined)).toEqual([]);
});

test('agruparHistorico: por categoria, último primeiro dentro do grupo, ordem fixa dos grupos', () => {
  const h = [
    { id: 1, tipo: 'Treinamento', data: '2026-04-09' }, { id: 2, tipo: 'Falta', data: '2026-08-03' }, { id: 3, tipo: 'Falta', data: '2026-09-12' },
    { id: 4, tipo: 'Treinamento', data: '2026-10-11' }, { id: 5, tipo: 'FT', data: '2026-05-01' }, { id: 6, tipo: 'Falta', data: '2026-10-10' },
  ];
  const g = agruparHistorico(h);
  expect(g.map(x => x.tipo)).toEqual(['Falta', 'FT', 'Treinamento']);
  expect(g[0].itens.map(x => x.data)).toEqual(['2026-10-10', '2026-09-12', '2026-08-03']);
  expect(g[2].itens.map(x => x.id)).toEqual([4, 1]);
  expect(agruparHistorico(null)).toEqual([]);
});
