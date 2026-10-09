// Tela × PDF: mesmo motor, mesma referência de data (dados fictícios).
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MaturidadeResumo, { IndiceIndividual } from './MaturidadeResumo';
import { calcularMapaEquipe, rotuloTreinamentos } from './maturidade';
import { gerarMapaEquipeHTML } from '../relatorios/mapaEquipeRelatorio';
const HOJE = '2026-10-09';
const equipe = { colaboradores: [
  { id: '1', nome: 'Pessoa Fictícia Um', cargo: 'vigilante', status: 'ativo', dataContratacao: '2021-02-01', ultimaReciclagem: '2025-06-01', historico: [{ tipo: 'Treinamento', detalhe: 'Brigada (fictício)', data: '2026-07-15' }] },
  { id: '2', nome: 'Pessoa Fictícia Dois', cargo: 'porteiro', status: 'ativo', dataContratacao: '2024-02-01', historico: [] },
] };
test('visão Maturidade mostra título com janela, cobertura X de Y e "sem catálogo" (não zero)', () => {
  const html = renderToStaticMarkup(<MaturidadeResumo equipe={equipe} hoje={HOJE} />);
  expect(html).toContain('Treinamentos aplicados — últimos 12 meses');
  expect(html).toContain('1 de 2 colaboradores com registro — 50%');
  expect(html).toContain('Sem catálogo para aferir');
  expect(html).not.toContain('Treinamento não aferido');
});
test('indicador individual no card: índice, classe e eixos', () => {
  const m = calcularMapaEquipe(equipe, HOJE);
  const html = renderToStaticMarkup(<IndiceIndividual resultado={m.individuos[0]} />);
  expect(html).toContain('Índice:'); expect(html).toContain(m.individuos[0].classe);
  expect(html).toContain('Sem catálogo para aferir conclusão');
  expect(html).toContain('Treinamentos registrados na ficha: 1 (1 nos últimos 12 meses)');
});
test('equivalência tela × PDF: mesmos números', () => {
  const m = calcularMapaEquipe(equipe, HOJE);
  const tela = renderToStaticMarkup(<MaturidadeResumo equipe={equipe} hoje={HOJE} />);
  const pdf = gerarMapaEquipeHTML({ project: { id: 'TESTE', name: 'Fictício' }, equipe, hoje: HOJE });
  expect(tela).toContain(rotuloTreinamentos(m.treinamentos));
  expect(pdf).toContain(`${m.treinamentos.comRegistro12m} de ${m.treinamentos.total} · ${Math.round(m.treinamentos.percentual12m)}%`);
  expect(tela).toContain(`${Math.round(m.indice)}/100`); expect(pdf).toContain(`>${Math.round(m.indice)}<`);
  expect(tela).toContain(m.classe); expect(pdf).toContain(m.classe);
});
