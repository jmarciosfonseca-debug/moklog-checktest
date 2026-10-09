// Consolidado Perimetral — dados FICTÍCIOS apenas.
import { gerarConsolidadoPerimetralHTML as gerar, calcularConsolidado, normalizarStatus, ordenarTestes, codigoZona, faixaFrequencia } from './perimetralConsolidado';
const ZONAS = Array.from({ length: 12 }, (_, n) => `Zona ${String(n + 1).padStart(2, '0')}`);
const POS = Object.fromEntries(ZONAS.map((z, n) => [z, { x: 8 + n * 7, y: 20 + (n % 4) * 18 }]));
const project = { id: 'P999', name: 'Projeto Fictício' };
const pcfg = (zonas = ZONAS, extra = {}) => ({ zonas, zonaPos: POS, mapaB64: null, clienteNome: 'Cliente Fictício', ...extra });
const HOJE = new Date('2026-10-09T12:00:00');
const mk = (id, data, turno = 'Diurno', st = {}, extra = {}) => ({ id, data, turno, quemFez: 'Fulano Fictício', zonas: Object.fromEntries(ZONAS.map(z => [z, { status: st[z] || 'ok', obs: '' }])), ...extra });
const g = (testes, extra = {}) => gerar({ testes, project, pcfg: pcfg(), hoje: HOJE, ...extra });
const linhasMatriz = (html) => (html.match(/<tr(?: class="pe-nd")?><td class="pe-l"><b>/g) || []).length;

test('padrão Moked: paisagem, número do documento, rodapé com paginação, título e escopo', () => {
  const html = g([mk('a', '2026-10-01')], { escopo: 'periodo' });
  expect(html).toContain('size:A4 landscape'); expect(html).toContain('MK-PE-P999-20261009'); expect(html).toContain('counter(pages)');
  expect(html).toContain('Consolidado de Testes Perimetrais'); expect(html).toContain('todos os testes do período');
  expect(g([mk('a', '2026-10-01')])).toContain('testes selecionados');
  expect(html).toContain('class="mk-topo"');
});
test('um teste', () => {
  const html = g([mk('a', '2026-10-01')]);
  const c = calcularConsolidado([mk('a', '2026-10-01')], ZONAS);
  expect(c).toMatchObject({ nTestes: 1, avaliacoes: 12, ok: 12, taxaOk: 100 }); expect(linhasMatriz(html)).toBe(1);
  expect(html).toContain('01/10/2026');
});
test('58 testes em 12 zonas: 696 avaliações, soma dos status = total, matriz com 58 linhas', () => {
  const testes = Array.from({ length: 58 }, (_, n) => mk(`t${n}`, `2026-09-${String(1 + (n % 28)).padStart(2, '0')}`, n % 2 ? 'Noturno' : 'Diurno', n % 5 === 0 ? { 'Zona 04': 'inop', 'Zona 09': 'parcial' } : {}));
  const c = calcularConsolidado(testes, ZONAS);
  expect(c.avaliacoes).toBe(696); expect(c.ok + c.parcial + c.inop + c.sem).toBe(696);
  expect(c.parcial).toBe(12); expect(c.inop).toBe(12);
  const html = g(testes); expect(linhasMatriz(html)).toBe(58);
  expect(html).toContain('>58<'); expect(html).toContain('>696<');
});
test('200 testes: nenhuma linha omitida', () => {
  const testes = Array.from({ length: 200 }, (_, n) => mk(`t${n}`, `2026-0${1 + (n % 9)}-1${n % 9}`));
  expect(linhasMatriz(g(testes))).toBe(200);
});
test('nenhum registro: documento válido, sem divisão por zero, sem tabela quebrada', () => {
  const html = g([]);
  expect(html).toContain('Nenhum teste registrado.'); expect(html).not.toMatch(/NaN%|>NaN<|Infinity/);
  expect(calcularConsolidado([], ZONAS).taxaOk).toBeNull();
});
test('todas as zonas OK: taxa 100%, sem adversos', () => {
  const html = g([mk('a', '2026-10-01'), mk('b', '2026-10-02')]);
  expect(html).toContain('100,0%'); expect(html).toContain('nenhum resultado adverso');
});
test('parciais e inoperantes ficam separados nos totais e no gráfico (não agregados)', () => {
  const testes = [mk('a', '2026-10-01', 'Diurno', { 'Zona 01': 'parcial', 'Zona 02': 'inop' }), mk('b', '2026-10-02')];
  const c = calcularConsolidado(testes, ZONAS);
  expect(c).toMatchObject({ parcial: 1, inop: 1, ok: 22, sem: 0 });
  expect(c.porZona[0]).toMatchObject({ parcial: 1, inop: 0, adversos: 1, pct: 50, faixa: 'média' });
  expect(c.porZona[1]).toMatchObject({ parcial: 0, inop: 1, adversos: 1 });
  const html = g(testes);
  expect(html).toContain('1 parc · 0 inop / 2'); expect(html).toContain('0 parc · 1 inop / 2');
  expect(html).toContain('PARC'); expect(html).toContain('INOP');
  expect(html).toContain('não representam nível de risco');
});
test('zona sem resultado: S/R, fora do denominador, nunca OK nem inoperante', () => {
  const t = mk('a', '2026-10-01'); delete t.zonas['Zona 03']; t.zonas['Zona 05'] = { status: '' };
  const c = calcularConsolidado([t, mk('b', '2026-10-02')], ZONAS);
  expect(c).toMatchObject({ sem: 2, ok: 22, aferidas: 22 }); expect(c.taxaOk).toBe(100);
  expect(c.porZona[2]).toMatchObject({ sem: 1, aferidas: 1 });
  expect(normalizarStatus(undefined)).toBe('sem'); expect(normalizarStatus({ status: 'xyz' })).toBe('sem');
  expect(normalizarStatus({ status: 'inoperante' })).toBe('inop'); expect(normalizarStatus({ status: 'INOP' })).toBe('inop');
  const html = g([t]); expect(html).toContain('S/R'); expect(html).toContain('2 s/r'.replace('2', '1'));
});
test('projeto com número de zonas diferente de 12: colunas vêm da configuração', () => {
  const z4 = ZONAS.slice(0, 4);
  const t = { id: 'a', data: '2026-10-01', turno: 'Diurno', quemFez: 'X', zonas: Object.fromEntries(z4.map(z => [z, { status: 'ok' }])) };
  const html = gerar({ testes: [t], project, pcfg: pcfg(z4), hoje: HOJE });
  expect(calcularConsolidado([t], z4).avaliacoes).toBe(4); expect(html).toContain('4 × 4 zonas'.replace('4 × 4', '1 × 4'));
  expect(html).not.toContain('>Z05<'); expect((html.match(/<th>Z\d\d<\/th>/g) || []).length).toBe(4);
  const html20 = gerar({ testes: [], project, pcfg: pcfg(Array.from({ length: 20 }, (_, n) => `Zona ${n + 1}`)), hoje: HOJE });
  expect((html20.match(/<th>Z\d\d<\/th>/g) || []).length).toBe(20); expect(codigoZona('Zona 7')).toBe('Z07'); expect(codigoZona('Portão Norte')).toBe('Portão Norte');
});
test('nomes e observações longos preservados integralmente; escape de HTML e caracteres especiais', () => {
  const longo = 'Câmera da torre norte sem imagem após chuva forte; acionada manutenção — protocolo 123/45 & verificação "completa" <b>x</b> '.repeat(4).trim();
  const t = mk('a', '2026-10-01', 'Diurno', { 'Zona 04': 'inop' }, { quemFez: 'João da Silva Pereira de Albuquerque Neto <script>alert(1)</script> & Cia' });
  t.zonas['Zona 04'].obs = longo;
  const html = g([t]);
  expect(html).toContain(longo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  expect(html).not.toContain('<script>alert'); expect(html).toContain('João da Silva Pereira de Albuquerque Neto &lt;script&gt;');
  expect(html).toContain('<sup>1</sup>'); expect(html).toContain('Observações registradas');
});
test('observação só existe se existir: sem obs, sem seção; numeração liga teste/zona', () => {
  expect(g([mk('a', '2026-10-01')])).not.toContain('Observações registradas');
  const a = mk('a', '2026-10-01'), b = mk('b', '2026-10-02'); a.zonas['Zona 01'].obs = 'primeira'; b.zonas['Zona 02'].obs = 'segunda';
  const html = g([a, b]);   // ordem decrescente: b vem antes de a
  expect(html.indexOf('segunda')).toBeLessThan(html.indexOf('primeira'));
  expect(html).toMatch(/<b>1<\/b> · 02\/10\/2026[\s\S]*?Z02[\s\S]*?segunda/); expect(html).toMatch(/<b>2<\/b> · 01\/10\/2026[\s\S]*?Z01[\s\S]*?primeira/);
});
test('mesmo dia e turno: ambas as execuções preservadas, com identificador curto, sem deduplicar', () => {
  const a = mk('abc-1111', '2026-10-01', 'Diurno', { 'Zona 01': 'inop' }), b = mk('abc-2222', '2026-10-01', 'Diurno');
  const html = g([a, b]);
  expect(linhasMatriz(html)).toBe(2); expect(html).toContain('reg. #1111'); expect(html).toContain('reg. #2222');
  expect(g([mk('x', '2026-10-01', 'Diurno'), mk('y', '2026-10-01', 'Noturno')])).not.toContain('reg. #');
});
test('ordem: data decrescente, horário decrescente quando existe, ordem recebida quando não existe (sem inventar sequência)', () => {
  const t1 = mk('1', '2026-10-01', 'Diurno', {}, { hora: '08:00' }), t2 = mk('2', '2026-10-01', 'Diurno', {}, { hora: '15:30' }), t3 = mk('3', '2026-10-02');
  expect(ordenarTestes([t1, t2, t3]).map(t => t.id)).toEqual(['3', '2', '1']);
  const s1 = mk('s1', '2026-10-01'), s2 = mk('s2', '2026-10-01');
  expect(ordenarTestes([s1, s2]).map(t => t.id)).toEqual(['s1', 's2']);
  expect(g([s1, s2])).not.toContain('<th>Hora</th>'); expect(g([t1, t2])).toContain('<th>Hora</th>');
});
test('seleção parcial × todos do período: o documento contém exatamente os registros recebidos e o escopo correto', () => {
  const todos = Array.from({ length: 10 }, (_, n) => mk(`t${n}`, `2026-10-0${1 + (n % 9)}`));
  const parcial = [todos[2], todos[5], todos[7]];
  const hp = g(parcial, { escopo: 'selecionados' }), ht = g(todos, { escopo: 'periodo' });
  expect(linhasMatriz(hp)).toBe(3); expect(hp).toContain('3 teste(s) · testes selecionados');
  expect(linhasMatriz(ht)).toBe(10); expect(ht).toContain('10 teste(s) · todos os testes do período');
});
test('virada de mês e datas de fronteira: intervalo real, ordem e separação de dias', () => {
  const html = g([mk('a', '2026-09-30'), mk('b', '2026-10-01'), mk('c', '2026-12-31'), mk('d', '2027-01-01')]);
  expect(html).toContain('30/09/2026 a 01/01/2027');
  expect(html.indexOf('01/01/2027')).toBeLessThan(html.indexOf('31/12/2026')); expect(html.indexOf('31/12/2026')).toBeLessThan(html.indexOf('>01/10/2026'));
  expect((html.match(/class="pe-nd"/g) || []).length).toBe(3);
  expect(g([mk('a', '2026-10-01'), mk('b', '2026-10-01')])).toContain('· 01/10/2026 ·');
});
test('totais e percentuais por zona usam o denominador da própria zona', () => {
  const t1 = mk('a', '2026-10-01', 'Diurno', { 'Zona 01': 'inop' }), t2 = mk('b', '2026-10-02', 'Diurno', { 'Zona 01': 'parcial' }), t3 = mk('c', '2026-10-03'); delete t3.zonas['Zona 01'];
  const z1 = calcularConsolidado([t1, t2, t3], ZONAS).porZona[0];
  expect(z1).toMatchObject({ aferidas: 2, adversos: 2, pct: 100, sem: 1 });
  expect(faixaFrequencia(29)).toBe('baixa'); expect(faixaFrequencia(30)).toBe('média'); expect(faixaFrequencia(59.9)).toBe('média'); expect(faixaFrequencia(60)).toBe('alta'); expect(faixaFrequencia(null)).toBeNull();
});
test('modos de conteúdo: só testes, testes + rondas, só rondas — títulos e seções distintos', () => {
  const t = mk('a', '2026-10-01', 'Diurno', {}, { rondas: [{ hora: '10:00', executante: 'Vig <A>', obs: 'ronda extra & ok' }] });
  const so = g([t]); expect(so).not.toContain('Rondas adicionais registradas nos testes');
  const ambos = g([t], { incluirRondas: true }); expect(ambos).toContain('Rondas adicionais registradas nos testes'); expect(ambos).toContain('Vig &lt;A&gt;'); expect(ambos).toContain('ronda extra &amp; ok'); expect(ambos).toContain('Consolidado de Testes Perimetrais');
  const r = g([t], { incluirPerim: false, incluirRondas: true });
  expect(r).toContain('Consolidado de Rondas Adicionais'); expect(r).not.toContain('class="pe-mx"><colgroup><col style="width:18mm">'); expect(r).not.toContain('Frequência de resultados adversos por zona');
  expect(g([mk('b', '2026-10-01')], { incluirRondas: true })).toContain('Nenhuma ronda adicional');
});
test('mapa e gráfico preservados: mapa proporcional (sem preserveAspectRatio none, sem altura fixa) com marcadores; barras por zona', () => {
  const html = gerar({ testes: [mk('a', '2026-10-01', 'Diurno', { 'Zona 04': 'inop' })], project, pcfg: pcfg(ZONAS, { mapaB64: 'AAAA' }), hoje: HOJE });
  expect(html).toContain('data:image/jpeg;base64,AAAA'); expect(html).not.toContain('preserveAspectRatio="none"'); expect(html).not.toContain('object-fit:cover');
  expect((html.match(/<circle/g) || []).length).toBe(24); expect(html).toContain('Z04 · 100%');
  expect((html.match(/class="pe-row"/g) || []).length).toBe(12);
  expect(g([mk('a', '2026-10-01')])).toContain('Mapa ainda não cadastrado');
});
test('indicadores coerentes com a matriz: cabeçalho = linhas; OK+parc+inop+s/r = avaliações; taxa com denominador explícito', () => {
  const testes = Array.from({ length: 7 }, (_, n) => mk(`t${n}`, `2026-10-0${n + 1}`, 'Diurno', n === 3 ? { 'Zona 02': 'parcial' } : {}));
  testes[1].zonas['Zona 07'] = undefined;
  const c = calcularConsolidado(testes, ZONAS), html = g(testes);
  expect(c.nTestes).toBe(linhasMatriz(html)); expect(c.ok + c.parcial + c.inop + c.sem).toBe(c.avaliacoes);
  expect(html).toContain(`${c.ok} OK ÷ ${c.aferidas} aferidas`); expect(html).toContain('7 × 12 zonas'.replace('7 × 12', '7 × 12'));
});
