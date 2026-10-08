import { gerarMapaEquipeHTML, radarEquipe } from './mapaEquipeRelatorio';
const project = { id: 'TESTE', name: 'Projeto fictício' };
const colaborador = { id: '1', nome: 'Pessoa fictícia', cargo: 'porteiro', status: 'ativo', dataContratacao: '2020-01-01', foto: 'data:image/png;base64,TESTE', historico: [] };
const gerar = equipe => gerarMapaEquipeHTML({ project, equipe, hoje: '2026-10-08' });
test('mapa usa padrão Moked, três colunas, foto e número estável', () => {
  const html = gerar({ colaboradores: [colaborador] });
  expect(html).toContain('MK-EQ-TESTE-20261008');
  expect(html).toContain('repeat(3,minmax(0,1fr))');
  expect(html).toContain(colaborador.foto);
  expect(html).toContain('counter(pages)');
});
test('sem catálogo ou registros não cria seção de treinamento', () => {
  expect(gerar({ colaboradores: [colaborador] })).not.toContain('<h2 class="mk-h2">Treinamentos</h2>');
});
test('treinamento livre aparece e conteúdo é escapado', () => {
  const html = gerar({ colaboradores: [{ ...colaborador, historico: [{ tipo: 'Treinamento', detalhe: '<script>teste</script>', data: '2026-10-01' }] }] });
  expect(html).toContain('<h2 class="mk-h2">Treinamentos</h2>');
  expect(html).toContain('&lt;script&gt;teste&lt;/script&gt;');
  expect(html).not.toContain('<script>teste');
});
test('radar não transforma ausência em nota zero', () => {
  const html = radarEquipe({ assiduidade: null, ft: null, treinamento: null, reciclagem: null, tempoCasa: 100 });
  expect(html).toContain('Radar incompleto');
  expect(html).not.toContain('fill="#b91c1c22"');
});
