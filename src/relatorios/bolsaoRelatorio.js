import { documentoMoked, escHTML as e, baixarHtml } from './padraoMoked';
import { bolsaoTipo, placasObservadas, reguaOcupacao, internoExterno, dataLocal } from './bolsaoRegras';

const dt = s => { const d = new Date(s); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit' }); };
const status = p => ({critico:'Crítico',atencao:'Atenção',normal:'Normal'}[p.status] || 'Não informado');
const statusInterno = p => Number(p.diasConsecutivos) >= 7 ? 'Crítico' : Number(p.diasConsecutivos) >= 3 ? 'Atenção' : 'Normal';
const tipoNome = t => t === 'interno' ? 'Interno' : t === 'externo' ? 'Externo' : 'Não informado';
const kpis = itens => `<div class="bol-grid">${itens.map(([v,l]) => `<div class="mk-k"><div class="mk-kv">${e(v)}</div><div class="mk-kl">${e(l)}</div></div>`).join('')}</div>`;
const cards = itens => itens.length ? `<div class="bol-grid">${itens.map(x => `<div class="bol-item">${x}</div>`).join('')}</div>` : '<p class="mk-nota">Sem registros no período.</p>';
const titulo = s => `<h2 class="mk-h2">${e(s)}</h2>`;
const css = `<style>.bol-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:6px 0 12px}.bol-item{border-bottom:1px solid #ddd;padding:5px;overflow-wrap:anywhere;font-size:8.5pt;break-inside:avoid}.bol-item b{font-size:9pt}.bol-fotos{break-before:page;page-break-before:always}.bol-foto{margin:10px 0;break-inside:avoid}.bol-foto img{display:block;width:100%;height:auto;max-height:205mm;object-fit:contain}.bol-foto figcaption{font-size:8pt;color:#4b5563}.bol-bar{height:6px;background:#eee;margin-top:4px}.bol-bar span{display:block;height:6px;background:#78350f}.bol-externo .mk-h1{color:#78350f}@media screen and (max-width:600px){.bol-grid{grid-template-columns:1fr}}@media print{.bol-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.bol-item,.mk-k{break-inside:avoid}}</style>`;
function fotoSegura(s) { return typeof s === 'string' && (/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(s) || /^https:\/\//i.test(s)); }

export function gerarBolsaoHtml({ project, placas = {}, checagens = [], periodo, modo = 'geral', hoje = new Date() }) {
  const interno = bolsaoTipo(project) === 'interno';
  const datas = (interno ? checagens.map(c => c.data || dataLocal(c.criadoEm)) : Object.values(placas).flatMap(p => (p.sightings || []).map(s => dataLocal(s.ts)))).filter(Boolean).sort();
  const inicio = periodo?.from ? dataLocal(periodo.from) : datas[0] || dataLocal(hoje);
  const fim = periodo?.to ? dataLocal(periodo.to) : datas[datas.length - 1] || inicio;
  const numero = `MK-BOLSAO-${project.id}-${inicio.replace(/-/g,'')}-${fim.replace(/-/g,'')}`;
  const label = periodo?.label || `${inicio.split('-').reverse().join('/')} a ${fim.split('-').reverse().join('/')}`;
  let corpo = css;
  if (interno) {
    const rondas = checagens.filter(c => { const d = c.data || dataLocal(c.criadoEm); return d >= inicio && d <= fim; });
    const lista = placasObservadas(placas, rondas).sort((a,b) => (b.diasConsecutivos || 0) - (a.diasConsecutivos || 0));
    const regua = reguaOcupacao(lista);
    const tipos = internoExterno(lista);
    corpo += kpis([[lista.length,'Placas envolvidas'],[rondas.length,'Rondas de checagem'],[lista.filter(p => statusInterno(p) !== 'Normal').length,'Em atenção / crítico (atual)']]);
    corpo += titulo('Régua de ocupação por inquilino');
    corpo += '<p class="mk-nota">Placa·dias = soma de dias distintos com checagem registrada no período. Não presume presença nos intervalos sem registro. Vínculo por placa: último inquilino observado no período. Percentuais arredondados podem não somar exatamente 100%.</p>';
    corpo += cards(regua.map(g => `<b>${e(g.inquilino)}</b><br>${g.placaDias} placa·dias · ${g.numPlacas} placas · ${g.pct}%<div class="bol-bar"><span style="width:${g.pct}%"></span></div>`));
    corpo += kpis(tipos.filter(t => t.quantidade).map(t => [`${t.quantidade} (${t.pct}%)`,tipoNome(t.tipo)]));
    corpo += titulo('Placas no bolsão (por dias consecutivos atuais)');
    corpo += cards(lista.map(p => `<b>${e(p.placa)}</b> · ${e(p.inquilino || 'Não informado')}<br>${tipoNome(p.tipo)} · ${e(p.diasConsecutivos ?? '—')} dias consecutivos<br>${p.dias.length} dias observados no período<br>Última vista: ${e(dt(p.ultimaVista))}`));
    corpo += titulo('Rondas de checagem');
    corpo += cards([...rondas].sort((a,b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).map(c => `<b>${e((c.data || '').split('-').reverse().join('/'))} ${e(c.hora || '')}</b><br>${e(c.lider || '—')} · ${tipoNome(c.tipo)}<br>${(c.itens || []).length} placas: ${e((c.itens || []).map(i => i.placa).join(', '))}`));
    const fotos = rondas.flatMap(c => (c.fotos || []).filter(fotoSegura).map((f,i) => `<figure class="bol-foto"><figcaption>${e(c.data)} ${e(c.hora || '')} · ${e(c.lider || '—')} · ${tipoNome(c.tipo)} · Foto ${i+1}</figcaption><img src="${e(f)}" alt="Foto do local, ronda ${e(c.data)} ${e(c.hora)}"></figure>`));
    if (fotos.length) corpo += `<section class="bol-fotos">${titulo('Fotos do local - por ronda')}${fotos.join('')}</section>`;
  } else {
    const todas = Object.values(placas);
    const from = periodo?.from ? new Date(periodo.from).getTime() : -Infinity;
    const to = periodo?.to ? new Date(periodo.to).getTime() : Infinity;
    const av = todas.flatMap(p => (modo === 'alerta' && status(p) === 'Normal' ? [] : (p.sightings || [])).filter(s => {
      const t = new Date(s.ts); const hora = Number(t.toLocaleString('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hour12:false}));
      return t.getTime() >= from && t.getTime() <= to && (!periodo?.turno || (hora >= 6 && hora < 18 ? 'Diurno' : 'Noturno') === periodo.turno);
    }).map(s => ({ ...s, p }))).sort((a,b) => new Date(b.ts) - new Date(a.ts));
    const ranking = [...new Map(av.map(a => [a.p.placa, a.p])).values()].map(p => ({...p,count:av.filter(a => a.p.placa === p.placa).length})).sort((a,b) => b.count-a.count || (b.diasConsecutivos||0)-(a.diasConsecutivos||0));
    const bloqueados = todas.filter(p => p.bloqueado && new Date(p.dataBloqueio).getTime() >= from && new Date(p.dataBloqueio).getTime() <= to);
    corpo += '<div class="bol-externo">';
    corpo += kpis([[av.length,'Avistamentos'],[ranking.length,'Placas únicas'],[ranking.filter(p => status(p)==='Atenção').length,'Em atenção (atual)'],[ranking.filter(p => status(p)==='Crítico').length,'Em crítico (atual)'],[bloqueados.length,'Bloqueados']]);
    corpo += titulo('Ranking de recorrência');
    corpo += cards(ranking.map(p => `<b>${e(p.placa)}</b><br>${p.count} avistamentos no período<br>${e(p.diasConsecutivos ?? '—')} dias consecutivos atuais · ${status(p)}`));
    corpo += titulo('Veículos bloqueados no período');
    corpo += cards(bloqueados.map(p => `<b>${e(p.placa)}</b><br>Motorista: ${e(p.bloqueioDados?.motorista || '—')}<br>Empresa/transportadora: ${e(p.bloqueioDados?.empresa || '—')}<br>Cavalo: ${e(p.bloqueioDados?.placaCavalo || '—')}<br>Bloqueado em: ${e(dt(p.dataBloqueio))}`));
    corpo += titulo(`Registro detalhado - ${av.length} avistamentos (${Math.min(av.length,50)} mais recentes)`);
    corpo += cards(av.slice(0,50).map(a => `<b>${e(a.p.placa)}</b> · ${status(a.p)}<br>${e(dt(a.ts))}<br>Registrado por: ${e(a.registradoPor || '—')}`));
    corpo += '</div>';
  }
  return documentoMoked({ project, titulo: interno ? 'Checagem de Bolsão Interno' : 'Fiscalização de Bolsão Externo', numero, hoje, rodape: e(`${numero} · Moked Consulting Security`), subtitulo: `${e(project.id)} · ${e(project.name || '')} · ${e(label)}${modo==='alerta'?' · Somente Atenção/Crítico':''}`, corpo });
}
export function baixarBolsao(opcoes) { baixarHtml(gerarBolsaoHtml(opcoes), `bolsao_${opcoes.project.id}_${dataLocal(new Date())}.html`); }
