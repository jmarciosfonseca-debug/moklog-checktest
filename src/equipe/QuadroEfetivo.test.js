import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QuadroEfetivo from './QuadroEfetivo';
import { carregarOcupacoes } from './carregarOcupacoes';

const ativo = (id, cargo, dataContratacao = '2026-01-10') => ({ id, nome: id, cargo, status: 'ativo', dataContratacao });

describe('QuadroEfetivo (tela da Equipe)', () => {
  it('mostra ativos/previsto, vagas e turnover sobre o quadro', () => {
    const cols = [
      ...['a', 'b', 'c', 'd'].map((i) => ativo(`l${i}`, 'Vigilante Líder')),
      ...['a', 'b', 'c'].map((i) => ativo(`r${i}`, 'Vigilante Ronda')),
      ...['a', 'b', 'c', 'd'].map((i) => ativo(`p${i}`, 'Porteiro CCO')),
      ...['a'].map((i) => ativo(`x${i}`, 'Vigilante Apoio')),
    ];
    const deslig = [{ id: 'z1', nome: 'Z1', desligadoEm: '2026-09-01' }, { id: 'z2', nome: 'Z2', desligadoEm: '2026-08-01' }];
    const html = renderToStaticMarkup(<QuadroEfetivo projectId="P311A" equipe={{ colaboradores: cols, desligados: deslig }} hoje="2026-10-13" onMatriz={() => {}} />);
    expect(html).toContain('12/14');
    expect(html).toContain('2 vaga(s)');
    expect(html).toContain('Vigilante Apoio');
    expect(html).toContain('Matriz de efetivo (PDF)');
  });
  it('projeto sem quadro previsto não renderiza nada', () => {
    expect(renderToStaticMarkup(<QuadroEfetivo projectId="PXXX" equipe={{ colaboradores: [], desligados: [] }} hoje="2026-10-13" />)).toBe('');
  });
});

describe('carregarOcupacoes', () => {
  it('deixa de fora projeto sem dado ou com erro de leitura', async () => {
    const o = await carregarOcupacoes(async (pid) => { if (pid === 'P311A') return { colaboradores: [ativo('a', 'Vigilante Líder')] }; if (pid === 'P601') throw new Error('x'); return null; });
    expect(Object.keys(o)).toEqual(['P311A']);
    expect(o.P311A.ativos).toBe(1);
  });
});
