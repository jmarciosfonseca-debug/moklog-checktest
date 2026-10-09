// Consolidado de Testes Perimetrais — padrão Moked (A4 paisagem).
// Módulo puro (sem DOM): recebe os testes e a configuração do projeto e devolve o HTML.
//  - indicadores reconstruídos dos MESMOS registros da matriz;
//  - ausência de resultado ("sem registro") nunca vira OK e fica fora do denominador da taxa;
//  - frequência de resultados adversos (parcial + inoperante) NÃO é nível de risco;
//  - nenhuma deduplicação por data/turno/responsável: cada registro (id) é uma linha.
import { documentoMoked, escHTML, dataBR, num1 } from './padraoMoked';

export const FAIXA_MEDIA = 30;
export const FAIXA_ALTA = 60;

// ok | parcial | inop | sem. Entrada ausente ou status desconhecido = "sem" (não é OK).
export function normalizarStatus(entrada) {
  const s = String(entrada?.status ?? '').trim().toLowerCase();
  if (s === 'ok') return 'ok';
  if (s === 'parcial') return 'parcial';
  if (s === 'inop' || s === 'inoperante') return 'inop';
  return 'sem';
}

export const faixaFrequencia = (pct) => pct === null ? null : pct >= FAIXA_ALTA ? 'alta' : pct >= FAIXA_MEDIA ? 'média' : 'baixa';
export const codigoZona = (zona) => { const m = String(zona).match(/^zona\s*0*(\d+)$/i); return m ? `Z${String(m[1]).padStart(2, '0')}` : String(zona); };
const horaValida = (t) => /^\d{2}:\d{2}/.test(String(t?.hora || '')) ? String(t.hora).slice(0, 5) : '';

// Ordem: data decrescente; dentro do dia, horário decrescente quando existir; sem horário mantém a ordem recebida.
export function ordenarTestes(testes) {
  return testes.map((t, i) => ({ t, i }))
    .sort((a, b) => String(b.t.data || '').localeCompare(String(a.t.data || '')) || horaValida(b.t).localeCompare(horaValida(a.t)) || a.i - b.i)
    .map(x => x.t);
}

export function calcularConsolidado(testes, zonas) {
  const porZona = zonas.map(zona => ({ zona, ok: 0, parcial: 0, inop: 0, sem: 0 }));
  for (const t of testes) porZona.forEach(z => { z[normalizarStatus(t.zonas?.[z.zona])]++; });
  const tot = { ok: 0, parcial: 0, inop: 0, sem: 0 };
  porZona.forEach(z => {
    z.aferidas = z.ok + z.parcial + z.inop;
    z.adversos = z.parcial + z.inop;
    z.pct = z.aferidas ? (z.adversos / z.aferidas) * 100 : null;
    z.faixa = faixaFrequencia(z.pct);
    for (const k of Object.keys(tot)) tot[k] += z[k];
  });
  const aferidas = tot.ok + tot.parcial + tot.inop;
  const datas = testes.map(t => t.data).filter(Boolean).sort();
  return {
    nTestes: testes.length, nZonas: zonas.length, avaliacoes: testes.length * zonas.length,
    ...tot, aferidas, taxaOk: aferidas ? (tot.ok / aferidas) * 100 : null,
    porZona, de: datas[0] || null, ate: datas[datas.length - 1] || null,
  };
}

export function rotuloIntervalo(de, ate) {
  if (!de) return 'sem data';
  return de === ate ? dataBR(de) : `${dataBR(de)} a ${dataBR(ate)}`;
}

const CSS = `<style>
@page{size:A4 landscape;margin:10mm 10mm 14mm 10mm}
@media screen{body{max-width:277mm}}
.pe-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(34mm,1fr));gap:6px;margin-bottom:8px}.pe-kpis .mk-k{padding:5px 9px}.pe-kpis .mk-kv{font-size:15pt}.pe-kpis .mk-kl{font-size:8pt}.pe-nota-k{font-size:7pt;color:#6B7280;line-height:1.2}
.pe-duas{display:grid;grid-template-columns:1.15fr 1fr;gap:10px;align-items:start;margin-bottom:6px}.pe-card{border:1px solid #E5E7EB;border-radius:8px;padding:8px 10px;break-inside:avoid}
.pe-map{position:relative;display:inline-block;max-width:100%;line-height:0}.pe-map img{display:block;max-width:100%;max-height:100mm;width:auto;height:auto;border-radius:4px}.pe-map svg{position:absolute;left:0;top:0;width:100%;height:100%}
.pe-leg{font-size:7.6pt;color:#4B5563;line-height:1.3;margin-top:4px}.pe-leg b{color:#111827}
.pe-row{display:grid;grid-template-columns:30px 1fr 205px;gap:6px;align-items:center;margin-bottom:3px;font-size:8pt}.pe-row b{font-size:8.4pt}
.pe-trilho{display:flex;height:11px;background:#F3F4F6;border-radius:2px;overflow:hidden}.pe-trilho i{display:block;height:11px}.pe-pa{background:#D97706}.pe-in{background:#B91C1C}
.pe-val{white-space:nowrap;color:#374151;font-size:7.4pt;line-height:1.15}
.pe-top{margin:5px 0 0;font-size:8pt}.pe-crit{font-size:7.4pt;color:#4B5563;line-height:1.3;margin-top:4px}
table.pe-mx{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8pt}
.pe-mx thead{display:table-header-group}.pe-mx tr{break-inside:avoid;page-break-inside:avoid}
.pe-mx th{font-size:7.4pt;text-transform:uppercase;color:#6B7280;border-bottom:1.5px solid #111827;padding:3px 3px;text-align:center;font-weight:700}
.pe-mx th.pe-l,.pe-mx td.pe-l{text-align:left}
.pe-mx td{border-bottom:1px solid #EEF0F3;padding:2px 3px;vertical-align:middle;overflow-wrap:anywhere;line-height:1.15}
.pe-mx tr.pe-nd td{border-top:1.4px solid #9CA3AF}
.pe-mx .pe-legrow th{text-transform:none;font-weight:400;text-align:left;font-size:7.2pt;color:#4B5563;border-bottom:none;padding:0 0 3px}
.pe-c{text-align:center;font-size:7.3pt;font-weight:700;letter-spacing:.01em}.pe-c-ok{color:#6B7280;font-weight:600}.pe-c-pa{background:#FEF3C7;color:#92400E}.pe-c-in{background:#FEE2E2;color:#991B1B}.pe-c-sem{background:#F3F4F6;color:#6B7280;font-weight:600}
.pe-c sup{font-size:6pt;font-weight:700;margin-left:1px}.pe-id{color:#6B7280;font-size:6.8pt;white-space:nowrap}
.pe-obs{font-size:8pt;line-height:1.25}.pe-obs li{margin:0 0 2px;break-inside:avoid}.pe-obs b{color:#111827}
.pe-h2{font-size:10.5pt;font-weight:700;color:#111827;margin:6px 0 4px;break-after:avoid}.pe-h2 .mk-mu{font-weight:400;font-size:8.4pt}
.pe-matriz{break-before:page}.pe-fim{display:grid;grid-template-columns:1fr 1.2fr;gap:16px;margin-top:6px;border-top:1px solid #E5E7EB;padding-top:3px;font-size:7.6pt;break-inside:avoid;page-break-inside:avoid}.pe-ass{text-align:center}.pe-ass .mk-linha{margin:4px 0 2px}
.pe-trilho,.pe-pa,.pe-in,.pe-c-pa,.pe-c-in,.pe-c-sem{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style>`;

function celula(st, ref) {
  const sup = ref ? `<sup>${ref}</sup>` : '';
  if (st === 'ok') return `<td class="pe-c pe-c-ok">OK${sup}</td>`;
  if (st === 'parcial') return `<td class="pe-c pe-c-pa">PARC${sup}</td>`;
  if (st === 'inop') return `<td class="pe-c pe-c-in">INOP${sup}</td>`;
  return `<td class="pe-c pe-c-sem">S/R${sup}</td>`;
}

function marcadores(pcfg, calc) {
  return pcfg.zonas.map(zona => {
    const pos = pcfg.zonaPos?.[zona]; if (!pos) return '';
    const z = calc.porZona.find(x => x.zona === zona);
    const cor = !z || z.pct === null ? '#6B7280' : z.pct >= FAIXA_ALTA ? '#DC2626' : z.pct >= FAIXA_MEDIA ? '#D97706' : '#15803D';
    const txt = `${codigoZona(zona)}${z && z.pct !== null ? ` · ${Math.round(z.pct)}%` : ' · s/r'}`;
    return `<g><circle cx="${pos.x}%" cy="${pos.y}%" r="9" fill="${cor}" fill-opacity="0.25"/><circle cx="${pos.x}%" cy="${pos.y}%" r="4.6" fill="${cor}" stroke="#fff" stroke-width="1.4"/><text x="${pos.x}%" y="${pos.y}%" dy="-9" text-anchor="middle" style="font-size:9.5px;font-weight:700;fill:#fff;paint-order:stroke;stroke:#111827;stroke-width:2.6px;stroke-linejoin:round">${escHTML(txt)}</text></g>`;
  }).join('');
}

function graficoZonas(calc) {
  const maxPct = Math.max(20, Math.ceil(Math.max(0, ...calc.porZona.map(z => z.pct ?? 0)) / 10) * 10);
  return calc.porZona.map(z => {
    const wP = z.aferidas ? (z.parcial / z.aferidas) * 100 / maxPct * 100 : 0;
    const wI = z.aferidas ? (z.inop / z.aferidas) * 100 / maxPct * 100 : 0;
    const val = z.pct === null ? 'sem registro' : `<b>${Math.round(z.pct)}%</b> · ${z.parcial} parc · ${z.inop} inop / ${z.aferidas}`;
    const freq = z.faixa ? ` · freq. ${z.faixa}` : '';
    return `<div class="pe-row"><b>${escHTML(codigoZona(z.zona))}</b><span class="pe-trilho"><i class="pe-pa" style="width:${wP.toFixed(1)}%"></i><i class="pe-in" style="width:${wI.toFixed(1)}%"></i></span><span class="pe-val">${val}${freq}${z.sem ? ` · ${z.sem} s/r` : ''}</span></div>`;
  }).join('') + `<div class="pe-leg">Barra = parciais (âmbar) + inoperantes (vermelho) ÷ avaliações aferidas da zona · escala 0–${maxPct}% · parc = parcial, inop = inoperante, s/r = sem registro.</div>`;
}

function destaque(calc) {
  const ord = calc.porZona.filter(z => z.adversos > 0).sort((a, b) => b.adversos - a.adversos);
  if (!ord.length) return '<div class="pe-top">Maior recorrência: nenhum resultado adverso registrado no período.</div>';
  const corte = ord[Math.min(2, ord.length - 1)].adversos;
  const top = ord.filter((z, i) => i < 3 || z.adversos === corte);
  return `<div class="pe-top"><b>Maior recorrência de resultados adversos:</b> ${top.map(z => `${escHTML(codigoZona(z.zona))} (${z.adversos} de ${z.aferidas}${z.pct !== null ? ` · ${Math.round(z.pct)}%` : ''})`).join('; ')}.</div>`;
}

export function gerarConsolidadoPerimetralHTML({ testes, project, pcfg, escopo = 'selecionados', incluirPerim = true, incluirRondas = false, hoje = new Date() }) {
  const lista = ordenarTestes(Array.isArray(testes) ? testes : []);
  const zonas = pcfg?.zonas || [];
  const calc = calcularConsolidado(lista, zonas);
  const intervalo = rotuloIntervalo(calc.de, calc.ate);
  const escopoTxt = escopo === 'periodo' ? 'todos os testes do período' : 'testes selecionados';
  const soRondas = !incluirPerim && incluirRondas;
  const titulo = soRondas ? 'Consolidado de Rondas Adicionais' : 'Consolidado de Testes Perimetrais';
  const nome = pcfg?.clienteNome || project.name || '';
  const ymd = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`;
  const numero = `MK-PE-${project.id}-${ymd}`;
  const nRondas = lista.reduce((a, t) => a + ((t.rondas || []).length), 0);

  // Observações vinculadas ao teste e à zona (somente as que existem).
  const observacoes = [];
  const refs = new Map(); // `${indice}|${zona}` -> n
  lista.forEach((t, i) => zonas.forEach(z => {
    const txt = String(t.zonas?.[z]?.obs ?? '').trim();
    if (txt) { const n = observacoes.length + 1; observacoes.push({ n, t, zona: z, txt }); refs.set(`${i}|${z}`, n); }
  }));

  const comHora = lista.some(t => horaValida(t));
  const contagemDia = {};
  lista.forEach(t => { const k = `${t.data}|${t.turno}`; contagemDia[k] = (contagemDia[k] || 0) + 1; });

  const kpis = incluirPerim
    ? `<div class="pe-kpis">
  <div class="mk-k"><div class="mk-kv">${calc.nTestes}</div><div class="mk-kl">Testes</div><div class="pe-nota-k">registros incluídos</div></div>
  <div class="mk-k"><div class="mk-kv">${calc.avaliacoes}</div><div class="mk-kl">Avaliações de zona</div><div class="pe-nota-k">${calc.nTestes} × ${calc.nZonas} zonas</div></div>
  <div class="mk-k"><div class="mk-kv mk-ok">${calc.ok}</div><div class="mk-kl">Resultados OK</div></div>
  <div class="mk-k"><div class="mk-kv mk-wa">${calc.parcial}</div><div class="mk-kl">Parciais</div></div>
  <div class="mk-k"><div class="mk-kv mk-da">${calc.inop}</div><div class="mk-kl">Inoperantes</div></div>
  <div class="mk-k"><div class="mk-kv">${calc.sem}</div><div class="mk-kl">Sem registro</div><div class="pe-nota-k">fora da taxa</div></div>
  <div class="mk-k"><div class="mk-kv">${calc.taxaOk === null ? '—' : `${num1(calc.taxaOk)}%`}</div><div class="mk-kl">Taxa OK</div><div class="pe-nota-k">${calc.ok} OK ÷ ${calc.aferidas} aferidas</div></div>
</div>`
    : `<div class="pe-kpis"><div class="mk-k"><div class="mk-kv">${calc.nTestes}</div><div class="mk-kl">Testes com rondas</div></div><div class="mk-k"><div class="mk-kv">${nRondas}</div><div class="mk-kl">Rondas adicionais</div></div></div>`;

  const mapaCard = pcfg?.mapaB64
    ? `<div class="pe-card"><div class="pe-h2" style="margin-top:0">Mapa perimetral <span class="mk-mu">· frequência de resultados adversos por zona</span></div>
<div class="pe-map"><img src="data:image/jpeg;base64,${pcfg.mapaB64}" alt="Mapa ${escHTML(project.id)}"><svg>${marcadores(pcfg, calc)}</svg></div>
<div class="pe-leg"><b>●</b> verde &lt;30% · <b>●</b> âmbar 30–59% · <b>●</b> vermelho ≥60% · cinza = sem registro. Cada marcador traz a zona e o percentual de parciais + inoperantes.</div></div>`
    : `<div class="pe-card"><div class="pe-h2" style="margin-top:0">Mapa perimetral</div><div class="mk-mu" style="padding:24px 0;text-align:center">Mapa ainda não cadastrado para este projeto.</div></div>`;
  const graficoCard = `<div class="pe-card"><div class="pe-h2" style="margin-top:0">Frequência de resultados adversos por zona</div>${graficoZonas(calc)}${destaque(calc)}</div>`;
  const criterios = `<div class="pe-crit"><b>Critérios.</b> Teste = um registro do sistema; avaliação = resultado de uma zona em um teste. Taxa OK = OK ÷ avaliações aferidas; "sem registro" não entra no denominador nem conta como OK. As faixas baixa (&lt;30%), média (30–59%) e alta (≥60%) classificam a <b>frequência</b> de resultados parciais + inoperantes no período; não representam nível de risco operacional nem disponibilidade contínua do sistema. A matriz lista os acionamentos registrados; dia sem registro não indica teste não executado nem descumprimento de escala.</div>`;

  const resumo = incluirPerim ? `${kpis}<div class="pe-duas">${mapaCard}${graficoCard}</div>${criterios}` : kpis;

  const colgroup = `<colgroup><col style="width:18mm">${comHora ? '<col style="width:11mm">' : ''}<col style="width:19mm"><col style="width:${zonas.length > 14 ? 40 : 54}mm">${zonas.map(() => '<col>').join('')}</colgroup>`;
  const colunas = 3 + (comHora ? 1 : 0) + zonas.length;
  const linhas = lista.map((t, i) => {
    const novoDia = i > 0 && lista[i - 1].data !== t.data;
    const dup = contagemDia[`${t.data}|${t.turno}`] > 1 && t.id ? `<br><span class="pe-id">reg. #${escHTML(String(t.id).replace(/[^A-Za-z0-9]/g, '').slice(-4))}</span>` : '';
    return `<tr${novoDia ? ' class="pe-nd"' : ''}><td class="pe-l"><b>${dataBR(t.data)}</b></td>${comHora ? `<td>${escHTML(horaValida(t) || '—')}</td>` : ''}<td class="pe-l">${escHTML(t.turno || '—')}${dup}</td><td class="pe-l">${escHTML(t.quemFez || '—')}</td>${zonas.map(z => celula(normalizarStatus(t.zonas?.[z]), refs.get(`${i}|${z}`))).join('')}</tr>`;
  }).join('');
  const matriz = incluirPerim ? `<section class="pe-matriz"><table class="pe-mx">${colgroup}<thead>
<tr class="pe-legrow"><th colspan="${colunas}">${escHTML(project.id)} · ${escHTML(intervalo)} · ${escopoTxt} · <b>OK</b> = ok · <b>PARC</b> = parcial · <b>INOP</b> = inoperante · <b>S/R</b> = sem registro · número sobrescrito = observação (ver seção Observações)</th></tr>
<tr><th class="pe-l">Data</th>${comHora ? '<th>Hora</th>' : ''}<th class="pe-l">Turno</th><th class="pe-l">Responsável</th>${zonas.map(z => `<th>${escHTML(codigoZona(z))}</th>`).join('')}</tr></thead>
<tbody>${linhas || `<tr><td colspan="${colunas}" class="mk-mu" style="text-align:center;padding:14px">Nenhum teste registrado.</td></tr>`}</tbody></table></section>` : '';

  const obsHTML = incluirPerim && observacoes.length
    ? `<h2 class="pe-h2">Observações registradas <span class="mk-mu">· ${observacoes.length} no período</span></h2><ol class="pe-obs" style="list-style:none;padding:0;margin:0;columns:2;column-gap:14px">${observacoes.map(o => `<li><b>${o.n}</b> · ${dataBR(o.t.data)} ${escHTML(o.t.turno || '')}${horaValida(o.t) ? ` ${escHTML(horaValida(o.t))}` : ''} · ${escHTML(codigoZona(o.zona))} (${escHTML(String(o.zona))}) · ${escHTML(o.t.quemFez || '—')}<br>${escHTML(o.txt)}</li>`).join('')}</ol>` : '';

  const rondasLinhas = lista.flatMap(t => (t.rondas || []).map((r, k) => `<tr><td class="pe-l"><b>${dataBR(t.data)}</b></td><td class="pe-l">${escHTML(t.turno || '—')}</td><td>${k + 1}</td><td>${escHTML(r.hora || '—')}</td><td class="pe-l">${escHTML(r.executante || '—')}</td><td class="pe-l">${escHTML(r.obs || '—')}</td></tr>`)).join('');
  const rondasHTML = incluirRondas
    ? `<h2 class="pe-h2" style="${incluirPerim ? 'break-before:page' : ''}">Rondas adicionais registradas nos testes <span class="mk-mu">· ${nRondas} registro(s) — não fazem parte da matriz perimetral</span></h2>
<table class="pe-mx"><colgroup><col style="width:20mm"><col style="width:20mm"><col style="width:10mm"><col style="width:16mm"><col style="width:60mm"><col></colgroup><thead><tr><th class="pe-l">Data</th><th class="pe-l">Turno</th><th>#</th><th>Hora</th><th class="pe-l">Executante</th><th class="pe-l">Observação</th></tr></thead><tbody>${rondasLinhas || `<tr><td colspan="6" class="mk-mu" style="text-align:center;padding:12px">Nenhuma ronda adicional registrada no período.</td></tr>`}</tbody></table>` : '';

  const fim = `<section class="pe-fim"><div><b>Base dos dados.</b> Registros lançados pelas equipes no MokLog CheckTest, supervisionados pela Moked Consulting Security.</div><div class="pe-ass"><div class="mk-linha"></div><b>José Fonseca</b> · Consultor de Segurança · Moked Consulting Security · jose.fonseca@moked.com.br</div></section>`;

  return documentoMoked({
    project, titulo,
    subtitulo: `${escHTML(project.id)} · ${escHTML(nome)} · ${escHTML(intervalo)} · ${calc.nTestes} teste(s) · ${escopoTxt}`,
    numero, hoje, fimEmbutido: true,
    rodape: `${numero} · ${titulo} · ${project.id} · ${intervalo}`,
    corpo: `${CSS}${resumo}${matriz}${obsHTML}${rondasHTML}<div class="mk-fecho">${fim}</div>`,
  });
}
