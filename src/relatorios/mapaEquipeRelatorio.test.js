// Mapa de Equipe (PDF) — dados fictícios. Equivalência tela × PDF: ambos usam calcularMapaEquipe.
import { gerarMapaEquipeHTML, radarEquipe, miniGauge, barrasEixos } from './mapaEquipeRelatorio';
import { calcularMapaEquipe, rotuloTreinamentos } from '../equipe/maturidade';
const HOJE = '2026-10-09';
const project = { id: 'TESTE', name: 'Projeto fictício' };
const colaborador = { id: '1', nome: 'Pessoa fictícia', cargo: 'porteiro', status: 'ativo', dataContratacao: '2020-01-01', foto: 'data:image/png;base64,TESTE', historico: [] };
const gerar = (equipe, extra = {}) => gerarMapaEquipeHTML({ project, equipe, hoje: HOJE, ...extra });

test('padrão Moked: nº do documento, 3 colunas, foto, cabeçalho/rodapé e paginação', () => {
  const html = gerar({ colaboradores: [colaborador] });
  expect(html).toContain('MK-EQ-TESTE-20261009');
  expect(html).toContain('repeat(3,minmax(0,1fr))');
  expect(html).toContain(colaborador.foto);
  expect(html).toContain('counter(pages)');
  expect(html).toContain('class="mk-topo"');
  expect(html).toContain('referência 09/10/2026');
  expect(html).toContain('Imprimir / Salvar PDF');
});
test('ficha compacta: foto + identificação + mini-indicador + cinco barras', () => {
  const html = gerar({ colaboradores: [colaborador] });
  expect(html).toContain('class="eq-topo"');
  expect(html).toContain('class="eq-gauge"');
  expect((html.match(/class="eq-eixo[ "]/g) || []).length).toBe(5);
  expect(html).toContain('Assiduidade'); expect(html).toContain('Folga trabalhada'); expect(html).toContain('Obrigatórios'); expect(html).toContain('Reciclagem'); expect(html).toContain('Tempo de casa');
});
test('índice zero é diferente de não aferido (gauge e barras)', () => {
  expect(miniGauge(0)).toContain('>0<'); expect(miniGauge(0)).toContain('stroke-dasharray="0.0');
  expect(miniGauge(null)).toContain('n/a'); expect(miniGauge(null)).not.toContain('stroke-dasharray');
  const b = barrasEixos({ assiduidade: 0, ft: null, treinamento: null, reciclagem: 50, tempoCasa: 100 });
  expect(b).toContain('width:0%'); expect(b).toContain('>n/a<'); expect(b).toContain('s/ catálogo');
});
test('sem registros nas fichas: resumo diz exatamente "não aferido — sem treinamento registrado nas fichas" e não cria seção de treinamento', () => {
  const html = gerar({ colaboradores: [colaborador] });
  expect(html).toContain('Treinamentos aplicados — últimos 12 meses');
  expect(html).toContain('Não aferido — sem treinamento registrado nas fichas');
  expect(html).not.toContain('Treinamentos registrados (');
  expect(html).toContain('sem catálogo para aferir conclusão');
});
test('com registros nas fichas: cobertura "X de Y — Z%" no resumo e cursos completos na ficha (sem truncar), com escape de HTML', () => {
  const longo = 'CONTEXTO DE INSTRUÇÃO: TTI (TIRO TÁTICO ISRAELENSE) — 120 disparos .38 + 6 de calibre 12 por participante; técnicas em pé, agachado, protegido e sob estresse. '.repeat(3);
  const html = gerar({ colaboradores: [
    { ...colaborador, historico: [{ tipo: 'Treinamento', detalhe: '<script>teste</script>', data: '2026-10-01' }, { tipo: 'Treinamento', detalhe: longo, data: '2026-08-18' }, { tipo: 'Treinamento', detalhe: 'Brigada (antigo)', data: '2020-01-01' }, { tipo: 'Treinamento', detalhe: 'Agendado', data: '2027-01-01' }] },
    { ...colaborador, id: '2', nome: 'Segunda Pessoa Fictícia Com Nome Muito Longo & Caracteres "Especiais" <ç>' },
  ] });
  expect(html).toContain('1 de 2 · 50%');
  expect(html).toContain('Treinamentos registrados (4)');
  expect(html).toContain('&lt;script&gt;teste&lt;/script&gt;'); expect(html).not.toContain('<script>teste');
  expect(html).toContain(longo.trim().replace(/"/g, '&quot;'));   // conteúdo integral
  expect(html).toContain('>histórico<'); expect(html).toContain('>agendado<');
  expect(html).toContain('&amp; Caracteres &quot;Especiais&quot; &lt;ç&gt;');
});
test('radar não transforma ausência em nota zero', () => {
  const html = radarEquipe({ assiduidade: null, ft: null, treinamento: null, reciclagem: null, tempoCasa: 100 });
  expect(html).toContain('Radar incompleto');
  expect(html).not.toContain('fill="#B91C1C22"');
});
test('desligados em seção separada, só quando incluídos; assinatura fica junto do fecho', () => {
  const equipe = { colaboradores: [colaborador], desligados: [{ id: 'd', nome: 'Ex-colaborador fictício', cargo: 'vigilante', desligadoEm: '2026-05-05' }] };
  const com = gerar(equipe); const sem = gerar(equipe, { incluirDesligados: false });
  expect(com).toContain('Desligados nos últimos 12 meses'); expect(com).toContain('Ex-colaborador fictício');
  expect(sem).not.toContain('Desligados nos últimos 12 meses');
  expect(com).toMatch(/Desligados[\s\S]*Como ler[\s\S]*class="eq-fim"[\s\S]*José Fonseca/);
  expect((com.match(/José Fonseca/g) || []).length).toBe(2);   // cabeçalho + assinatura compacta (sem bloco padrão duplicado)
});
test('equivalência tela × PDF: os mesmos números do motor aparecem no HTML', () => {
  const equipe = { colaboradores: [{ ...colaborador, historico: [{ tipo: 'Treinamento', detalhe: 'DDS fictício', data: '2026-09-01' }] }, { ...colaborador, id: '2', nome: 'Outra Pessoa' }] };
  const m = calcularMapaEquipe(equipe, HOJE);
  const html = gerar(equipe);
  expect(html).toContain(`${m.treinamentos.comRegistro12m} de ${m.treinamentos.total} · ${Math.round(m.treinamentos.percentual12m)}%`);
  expect(rotuloTreinamentos(m.treinamentos)).toBe('1 de 2 colaboradores com registro — 50%');
  expect(html).toContain(`>${Math.round(m.indice)}<`);
  expect(html).toContain(m.classe);
});
test('17 pessoas com registros curtos: uma ficha por pessoa, sem blocos repetidos de foto no resumo', () => {
  const colaboradores = Array.from({ length: 17 }, (_, n) => ({ ...colaborador, id: String(n), nome: `Pessoa ${n}`, historico: n % 2 ? [{ tipo: 'Treinamento', detalhe: 'DDS fictício', data: '2026-09-01' }] : [] }));
  const html = gerar({ colaboradores });
  expect((html.match(/class="eq-card"/g) || []).length).toBe(17);
  expect((html.match(/class="eq-foto"/g) || []).length).toBe(17);   // fotos só nas fichas
});
