// Mapa de Equipe — padrão Moked (compacto: resumo + fichas em 3 colunas).
// Toda a aritmética vem de equipe/maturidade.js (mesmo motor da tela).
import { documentoMoked, escHTML as esc, dataBR } from './padraoMoked';
import { calcularMapaEquipe, rotuloTreinamentos, notaTreinamentos, TITULO_TREINAMENTOS, CONFIG_MATURIDADE } from '../equipe/maturidade';

export const ROTULOS = { assiduidade: 'Assiduidade', ft: 'Folga trabalhada', treinamento: 'Obrigatórios', reciclagem: 'Reciclagem', tempoCasa: 'Tempo de casa' };
const ROTULOS_CURTOS = { assiduidade: 'Assiduidade', ft: 'Folga trab.', treinamento: 'Obrigatórios', reciclagem: 'Reciclagem', tempoCasa: 'Tempo casa' };
const nota = n => (n === null || n === undefined) ? 'Não aferido' : String(Math.round(n));
const pct = n => (n === null || n === undefined) ? 'Não aferido' : `${Math.round(n)}%`;
const corNota = n => n === null ? '#9CA3AF' : n >= 85 ? '#166534' : n >= 70 ? '#111827' : n >= 50 ? '#B45309' : '#B91C1C';

const foto = c => c.foto
  ? `<img class="eq-foto" src="${esc(c.foto)}" alt="Foto de ${esc(c.nome)}">`
  : `<div class="eq-foto eq-semfoto">sem foto</div>`;

// Anel compacto 0–100. Sem índice → anel cinza com "n/a" (não é zero).
export function miniGauge(indice) {
  const r = 13, C = 2 * Math.PI * r;
  const v = indice === null || indice === undefined ? null : Math.max(0, Math.min(100, indice));
  const dash = v === null ? 0 : (v / 100) * C;
  return `<svg class="eq-gauge" viewBox="0 0 34 34" role="img" aria-label="Índice ${v === null ? 'não aferido' : Math.round(v)}">
    <circle cx="17" cy="17" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="4"/>
    ${v === null ? '' : `<circle cx="17" cy="17" r="${r}" fill="none" stroke="${corNota(v)}" stroke-width="4" stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 17 17)" stroke-linecap="round"/>`}
    <text x="17" y="20.5" text-anchor="middle" font-size="${v === null ? 7 : 10}" font-weight="700" fill="${v === null ? '#9CA3AF' : '#111827'}">${v === null ? 'n/a' : Math.round(v)}</text></svg>`;
}

// Cinco barras compactas. Eixo não aferido: trilho vazio + rótulo (nunca 0).
export function barrasEixos(eixos) {
  return `<div class="eq-eixos">${Object.entries(ROTULOS_CURTOS).map(([k, label]) => {
    const v = eixos[k];
    const na = v === null || v === undefined;
    const txt = na ? (k === 'treinamento' ? 's/ catálogo' : 'n/a') : Math.round(v);
    return `<div class="eq-eixo${na ? ' eq-na' : ''}" title="${esc(ROTULOS[k])}"><span>${label}</span><span class="eq-trilho">${na ? '' : `<i style="width:${Math.max(0, Math.min(100, v))}%"></i>`}</span><b>${txt}</b></div>`;
  }).join('')}</div>`;
}

export function radarEquipe(eixos, tamanho = 200) {
  const cx = 140, cy = 94, R = 56;
  const pontos = (raio, valores = null) => Object.keys(ROTULOS).map((k, i) => {
    const a = i * Math.PI * 2 / 5 - Math.PI / 2;
    const r = raio * (valores ? (valores[k] ?? 0) / 100 : 1);
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');
  // Ausência não é nota zero: sem polígono quando qualquer eixo não foi aferido.
  const completo = Object.keys(ROTULOS).every(k => eixos[k] !== null && eixos[k] !== undefined);
  const rot = Object.entries(ROTULOS).map(([k, label], i) => {
    const a = i * Math.PI * 2 / 5 - Math.PI / 2;
    const x = cx + Math.cos(a) * (R + 10), y = cy + Math.sin(a) * (R + 14);
    const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
    const v = eixos[k] === null || eixos[k] === undefined ? 'n/a' : Math.round(eixos[k]);
    return `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${anchor}" font-size="8.2" fill="#374151">${label} <tspan font-weight="700">${v}</tspan></text>`;
  }).join('');
  return `<svg viewBox="0 0 280 190" width="${tamanho}" role="img" aria-label="Radar dos cinco eixos"><g fill="none" stroke="#D1D5DB" stroke-width=".7">${[0.25, 0.5, 0.75, 1].map(f => `<polygon points="${pontos(R * f)}"/>`).join('')}${Object.keys(ROTULOS).map((_, i) => { const a = i * Math.PI * 2 / 5 - Math.PI / 2; return `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * R).toFixed(1)}" y2="${(cy + Math.sin(a) * R).toFixed(1)}"/>`; }).join('')}</g>${completo ? `<polygon points="${pontos(R, eixos)}" fill="#B91C1C22" stroke="#B91C1C" stroke-width="1.4"/>` : ''}${rot}</svg>${completo ? '' : '<div class="mk-nota" style="text-align:center">Radar incompleto: eixo não aferido não é zero.</div>'}`;
}

const tempoCasaTxt = (admissao, hoje) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(admissao || '')) return '';
  const a = new Date(`${admissao}T12:00:00`), b = new Date(`${hoje}T12:00:00`);
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0);
  if (meses < 0) return '';
  const anos = Math.floor(meses / 12); meses %= 12;
  return anos ? `${anos} ano${anos > 1 ? 's' : ''}` : `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
};
const reciclagemTxt = r => ({ ok: 'Reciclagem em dia', alerta: `Reciclagem vence em ${r.diasRestantes} d`, vencido: `Reciclagem vencida há ${Math.abs(r.diasRestantes)} d`, 'sem-data': 'Reciclagem sem data', 'não se aplica': 'Reciclagem não se aplica' }[r.estado] || '');

function fichaHTML(i, hoje) {
  const c = i.colaborador;
  const t = i.treinamentosFicha || { recentes: [], antigos: [], semData: [], futuros: [] };
  const cursos = [
    ...t.recentes.map(h => ({ h, tag: '' })),
    ...t.antigos.map(h => ({ h, tag: 'histórico' })),
    ...t.semData.map(h => ({ h, tag: 'sem data' })),
    ...t.futuros.map(h => ({ h, tag: 'agendado' })),
  ];
  const linhaCurso = ({ h, tag }) => `<li>${h.data && /^\d{4}-\d{2}-\d{2}$/.test(h.data) ? `<b>${dataBR(h.data)}</b> — ` : ''}${esc(String(h.detalhe).trim())}${tag ? ` <span class="eq-tag">${tag}</span>` : ''}</li>`;
  const tempo = tempoCasaTxt(c.dataContratacao, hoje);
  const aviso = i.afastado ? '<span class="eq-tag eq-tag-wa">afastado · fora da média</span>' : '';
  return `<article class="eq-card">
    <div class="eq-topo">${foto(c)}<div class="eq-id"><div class="eq-nome">${esc(c.nome)}</div><div class="eq-cargo">${esc(c.cargo || '')}</div>
      <div class="mk-mu eq-meta">Adm. ${dataBR(c.dataContratacao)}${tempo ? ` · ${tempo}` : ''}</div>
      <div class="mk-mu eq-meta">${esc(reciclagemTxt(i.reciclagem))}${i.ferias[0] ? ` · Férias ${dataBR(i.ferias[0].dataInicio)}` : ''}</div>${aviso}</div>
      <div class="eq-ind">${miniGauge(i.indice)}<div class="eq-classe">${esc(i.classe)}</div></div></div>
    ${barrasEixos(i.eixos)}
    ${cursos.length ? `<div class="eq-cursos"><b>Treinamentos registrados (${cursos.length})</b><ul>${cursos.map(linhaCurso).join('')}</ul></div>` : ''}
  </article>`;
}

export function gerarMapaEquipeHTML({ project, equipe, hoje, empresa = {}, selecionados = null, incluirDesligados = true }) {
  const modelo = calcularMapaEquipe(equipe, hoje);
  const temLider = modelo.individuos.some(i => /l[íi]der/i.test(i.colaborador.cargo || ''));
  const lider = i => /l[íi]der/i.test(i.colaborador.cargo || '') || (!temLider && /ronda/i.test(i.colaborador.cargo || ''));
  modelo.individuos.sort((a, b) => Number(lider(b)) - Number(lider(a)) || String(a.colaborador.nome).localeCompare(String(b.colaborador.nome), 'pt-BR'));
  const fichas = modelo.individuos.filter(i => !selecionados || selecionados.includes(i.colaborador.id));
  const tr = modelo.treinamentos;
  const catalogo = Array.isArray(equipe.treinamentosEsperados) ? equipe.treinamentosEsperados.filter(t => t && String(t.nome || '').trim()) : [];
  const inicio = new Date(`${hoje}T12:00:00`); inicio.setFullYear(inicio.getFullYear() - 1);
  const desligados = incluirDesligados ? (equipe.desligados || []).filter(c => c.desligadoEm && new Date(`${c.desligadoEm}T12:00:00`) >= inicio && c.desligadoEm <= hoje) : [];
  const alertas = modelo.alertas;

  const kpis = `<div class="mk-kpis eq-kpis">
    <div class="mk-k"><div class="mk-kl">Efetivo ativo</div><div class="mk-kv">${modelo.individuos.length}</div><div class="mk-nota">${modelo.quantidadeAferida} com índice aferido${fichas.length !== modelo.individuos.length ? ` · ${fichas.length} nas fichas` : ''}</div></div>
    <div class="mk-k"><div class="mk-kl">${esc(TITULO_TREINAMENTOS)}</div><div class="mk-kv ${tr.comRegistro ? '' : 'mk-mu'}" style="font-size:${tr.comRegistro ? '15pt' : '10pt'}">${tr.comRegistro ? `${tr.comRegistro12m} de ${tr.total} · ${pct(tr.percentual12m)}` : esc(rotuloTreinamentos(tr))}</div><div class="mk-nota">${tr.comRegistro ? 'colaboradores com treinamento registrado na ficha · ' : ''}${esc(notaTreinamentos(tr))}</div></div>
    <div class="mk-k"><div class="mk-kl">Maturidade da equipe</div><div class="mk-kv" style="color:${corNota(modelo.indice)}">${nota(modelo.indice)}</div><div class="mk-nota"><b>${esc(modelo.classe)}</b> · 0–100</div></div>
    <div class="mk-k"><div class="mk-kl">Turnover · últimos 12 meses</div><div class="mk-kv">${pct(modelo.turnover)}</div><div class="mk-nota">${modelo.desligados12m} desligamento(s) · estabilidade ${nota(modelo.estabilidade)}${modelo.turnover === null ? ' · base insuficiente' : ''}</div></div>
  </div>`;

  const resumo = `<section class="eq-resumo">
    <div class="eq-radar">${radarEquipe(modelo.eixos, 210)}</div>
    <div><div class="mk-lb">Destaques por índice <span class="mk-mu">(top 3, com empates)</span></div>
      ${modelo.top.length ? `<ol class="eq-top">${modelo.top.map(i => `<li><b>${esc(i.colaborador.nome)}</b> <span class="mk-mu">${esc(i.colaborador.cargo || '')}</span> <b style="color:${corNota(i.indice)}">${nota(i.indice)}</b></li>`).join('')}</ol>` : '<div class="mk-nota">Sem índices aferidos.</div>'}
      ${catalogo.length ? `<div class="mk-lb" style="margin-top:6px">Catálogo de obrigatórios</div><div class="mk-nota">${catalogo.map(t => `${esc(t.nome)}${t.obrigatorio ? ' (obrigatório)' : ''}${t.validadeMeses ? ` · ${t.validadeMeses} m` : ''}`).join(' · ')}</div>` : '<div class="mk-nota" style="margin-top:6px"><b>Conclusão dos obrigatórios:</b> sem catálogo para aferir conclusão. Os treinamentos registrados nas fichas aparecem abaixo.</div>'}
    </div>
    <div><div class="mk-lb">Alertas <span class="mk-mu">(${alertas.length})</span></div>
      ${alertas.length ? `<ul class="eq-alertas">${alertas.slice(0, 14).map(a => `<li><b>${esc(a.nome)}</b>: ${esc(a.texto)}</li>`).join('')}${alertas.length > 14 ? `<li class="mk-mu">e mais ${alertas.length - 14} (ver fichas)</li>` : ''}</ul>` : '<div class="mk-nota">Nenhum alerta nos dados aferidos.</div>'}
    </div>
  </section>`;

  // Linhas de 3 fichas: a quebra de página acontece ENTRE linhas, nunca dentro de uma ficha
  // (grid único não fragmenta bem na impressão e deixa página meio vazia).
  const linhas = [];
  for (let n = 0; n < fichas.length; n += 3) linhas.push(fichas.slice(n, n + 3));
  const grade = `<h2 class="mk-h2">Fichas individuais <span class="mk-mu">· ${fichas.length} colaborador(es) · referência ${dataBR(hoje)}</span></h2>${linhas.map(l => `<div class="eq-grade">${l.map(i => fichaHTML(i, hoje)).join('')}</div>`).join('')}`;

  const desligadosHTML = desligados.length ? `<h2 class="mk-h2">Desligados nos últimos 12 meses <span class="mk-mu">· ${desligados.length}</span></h2><div class="eq-deslig">${desligados.map(c => `<div><b>${esc(c.nome)}</b> <span class="mk-mu">${esc(c.cargo || '')} · ${dataBR(c.desligadoEm)}</span></div>`).join('')}</div>` : '';

  const comoLer = `<p class="mk-nota eq-comoler"><b>Como ler.</b> Índice individual e maturidade (0–100) descrevem os registros disponíveis no MokLog; não medem diretamente competência ou conhecimento do posto. Assiduidade: faltas e atrasos na janela aferida (justificada conta metade) · Folga trabalhada: FT registradas (positivo) · Obrigatórios: conclusão do catálogo esperado (sem catálogo = não aferido) · Reciclagem: alerta a ${CONFIG_MATURIDADE.reciclagemAlertaDias} dias do vencimento · Tempo de casa: pela admissão. Eixo sem fonte sai do cálculo; afastados há mais de 30 dias ficam fora da média. "Treinamentos aplicados" conta pessoas com registro na ficha nos últimos 12 meses; antigos ou sem data ficam como histórico.</p>`;

  const css = `<style>
  .eq-empresa{height:32px;max-width:150px;object-fit:contain;margin:0 0 6px}
  .eq-kpis{grid-template-columns:1.1fr 1.9fr 1.1fr 1.3fr;gap:6px;margin-bottom:6px}.eq-kpis .mk-k{padding:5px 9px}.eq-kpis .mk-kv{font-size:14pt}.eq-kpis .mk-nota{margin-top:2px;line-height:1.25}
  .eq-resumo{display:grid;grid-template-columns:210px 1fr 1fr;gap:10px;border:1px solid #E5E7EB;border-radius:8px;padding:5px 10px;margin-bottom:5px;page-break-inside:avoid}
  .eq-top{margin:3px 0 0;padding-left:16px;font-size:8.4pt}.eq-top li{margin:1px 0}.eq-alertas{margin:3px 0 0;padding-left:14px;font-size:7.8pt;line-height:1.3}.eq-alertas li{margin:1px 0}
  .eq-grade{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-bottom:4px;break-inside:avoid;page-break-inside:avoid}
  .eq-card{border:1px solid #E5E7EB;border-radius:6px;padding:4px 6px;break-inside:avoid;page-break-inside:avoid;overflow-wrap:anywhere;font-size:7.4pt;line-height:1.22}
  .eq-topo{display:grid;grid-template-columns:40px 1fr 42px;gap:5px;align-items:start}
  .eq-foto{width:40px;height:44px;object-fit:cover;border-radius:4px;background:#F3F4F6}.eq-semfoto{display:flex;align-items:center;justify-content:center;font-size:6.5pt;color:#9CA3AF;text-align:center}
  .eq-nome{font-weight:700;font-size:8.2pt;color:#111827;line-height:1.15}.eq-cargo{font-size:7.4pt;color:#374151}.eq-meta{font-size:6.8pt;line-height:1.2}
  .eq-ind{text-align:center}.eq-gauge{width:33px;height:33px;display:block;margin:0 auto}.eq-classe{font-size:6pt;color:#374151;line-height:1.1;margin-top:1px;white-space:nowrap}
  .eq-tag{display:inline-block;font-size:6.3pt;font-weight:700;color:#6B7280;background:#F3F4F6;border-radius:3px;padding:0 4px;margin-left:3px;vertical-align:middle}.eq-tag-wa{color:#92400E;background:#FEF3C7}
  .eq-eixos{margin-top:3px;display:grid;gap:0}.eq-eixo{display:grid;grid-template-columns:48px 1fr 38px;gap:4px;align-items:center;font-size:6.3pt;line-height:1.18;color:#374151;white-space:nowrap}
  .eq-trilho{display:block;height:3.5px;background:#F3F4F6;border-radius:2px;overflow:hidden}.eq-trilho i{display:block;height:3.5px;background:#111827;border-radius:2px}.eq-eixo b{text-align:right;font-size:6.6pt}.eq-na b{color:#9CA3AF;font-weight:600}
  .eq-cursos{border-top:1px solid #EEF0F3;margin-top:3px;padding-top:2px;font-size:6.5pt;line-height:1.18}.eq-cursos ul{margin:1px 0 0;padding-left:10px}.eq-cursos li{margin:0}
  .eq-deslig{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px 10px;font-size:7.8pt;margin-bottom:3px}
  .eq-comoler{margin:2px 0 0;line-height:1.22;font-size:7.1pt}.eq-fim{display:grid;grid-template-columns:1fr 1.2fr;gap:16px;margin-top:4px;border-top:1px solid #E5E7EB;padding-top:4px;page-break-inside:avoid;break-inside:avoid;font-size:8pt}.eq-ass{text-align:center;font-size:8pt}.eq-ass .mk-linha{margin:8px 0 3px}
  .eq-gauge circle,.eq-trilho i,.eq-tag{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  </style>`;

  // Fecho compacto (uma faixa de ~12 mm): "Como ler" flui com o texto; só a assinatura é indivisível.
  // Evita a folha isolada apenas com assinatura que o bloco padrão (mais alto) pode gerar.
  const fim = `<section class="eq-fim"><div><div class="mk-mu">Base dos dados</div><div class="mk-sm">Registros lançados pelas equipes no MokLog CheckTest, supervisionados pela Moked Consulting Security.</div></div>
    <div class="eq-ass"><div class="mk-linha"></div><b>José Fonseca</b> · Consultor de Segurança · Moked Consulting Security · jose.fonseca@moked.com.br</div></section>`;
  // "Como ler" + assinatura formam um bloco indivisível (~25 mm): a assinatura nunca fica sozinha numa folha.
  const corpo = `${css}${empresa.logo ? `<img class="eq-empresa" src="${esc(empresa.logo)}" alt="${esc(empresa.empresa || '')}">` : ''}${kpis}${resumo}${grade}${desligadosHTML}<div class="mk-fecho">${comoLer}${fim}</div>`;
  return documentoMoked({
    project, titulo: 'Mapa de Equipe',
    subtitulo: `${esc(project.id)} · ${esc(project.name || '')} · referência ${dataBR(hoje)} · motor de maturidade v1`,
    numero: `MK-EQ-${project.id}-${hoje.replace(/-/g, '')}`, hoje: new Date(`${hoje}T12:00:00`),
    corpo, fimEmbutido: true,
  });
}
