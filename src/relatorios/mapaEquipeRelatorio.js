import { documentoMoked, escHTML as esc, dataBR } from './padraoMoked';
import { calcularMapaEquipe } from '../equipe/maturidade';

const rotulos = { assiduidade: 'Assiduidade', ft: 'Folga trabalhada', treinamento: 'Treinamento', reciclagem: 'Reciclagem', tempoCasa: 'Tempo de casa' };
const nota = n => n === null ? 'Não aferido' : Math.round(n);
const foto = c => c.foto ? `<img class="eq-foto" src="${esc(c.foto)}" alt="Foto de ${esc(c.nome)}">` : '<div class="eq-foto">Foto não cadastrada</div>';
function barras(eixos) {
  return Object.entries(rotulos).map(([k, label]) => `<div class="eq-eixo"><span>${label}</span><span class="eq-trilho"><i style="width:${eixos[k] ?? 0}%"></i></span><b>${nota(eixos[k])}</b></div>`).join('');
}
export function radarEquipe(eixos) {
  const pontos = (raio, valores = null) => Object.keys(rotulos).map((k, i) => {
    const a = i * Math.PI * 2 / 5 - Math.PI / 2;
    const r = raio * (valores ? (valores[k] ?? 0) / 100 : 1);
    return `${130 + Math.cos(a) * r},${115 + Math.sin(a) * r}`;
  }).join(' ');
  // Ausência não é nota zero: sem polígono quando qualquer eixo não foi aferido.
  const completo = Object.keys(rotulos).every(k => eixos[k] !== null);
  return `<svg viewBox="0 0 260 230" role="img" aria-label="Radar dos cinco eixos"><g fill="none" stroke="#cbd5e1">${[20,40,60,80].map(r => `<polygon points="${pontos(r)}"/>`).join('')}</g>${completo ? `<polygon points="${pontos(80, eixos)}" fill="#b91c1c22" stroke="#b91c1c"/>` : ''}${Object.entries(rotulos).map(([k, label], i) => { const a = i * Math.PI * 2 / 5 - Math.PI / 2; return `<text x="${130 + Math.cos(a) * 101}" y="${115 + Math.sin(a) * 101}" text-anchor="middle" font-size="8">${label}: ${nota(eixos[k])}</text>`; }).join('')}</svg>${completo ? '' : '<div class="mk-nota">Radar incompleto: eixos não aferidos não são representados como zero.</div>'}`;
}

export function gerarMapaEquipeHTML({ project, equipe, hoje, empresa = {}, selecionados = null, incluirDesligados = true }) {
  const modelo = calcularMapaEquipe(equipe, hoje);
  const temLider = modelo.individuos.some(i => /l[íi]der/i.test(i.colaborador.cargo || ''));
  const lider = i => /l[íi]der/i.test(i.colaborador.cargo || '') || (!temLider && /ronda/i.test(i.colaborador.cargo || ''));
  modelo.individuos.sort((a,b) => Number(lider(b)) - Number(lider(a)) || String(a.colaborador.nome).localeCompare(String(b.colaborador.nome), 'pt-BR'));
  const cards = modelo.individuos.filter(i => !selecionados || selecionados.includes(i.colaborador.id)).map(i => {
    const c = i.colaborador;
    return `<article class="eq-card">${foto(c)}<h3>${esc(c.nome)}</h3><div>${esc(c.cargo)}</div><div class="mk-mu">Admissão ${dataBR(c.dataContratacao)}</div><div>Reciclagem: ${esc(i.reciclagem.estado)}</div><div>Próximas férias: ${i.ferias[0] ? dataBR(i.ferias[0].dataInicio) : 'não registradas'}</div><strong class="eq-nota">${nota(i.indice)}${i.indice === null ? '' : '/100'}</strong><div>${esc(i.classe)}${i.afastado ? ' · Afastado, fora da média' : ''}</div>${barras(i.eixos)}</article>`;
  }).join('');
  const registros = modelo.individuos.flatMap(i => (i.colaborador.historico || []).filter(h => h.tipo === 'Treinamento').map(h => ({ ...h, nome: i.colaborador.nome })));
  const catalogo = equipe.treinamentosEsperados || [];
  const treinamento = registros.length || catalogo.length ? `<section><h2 class="mk-h2">Treinamentos</h2>${catalogo.length ? `<p>Catálogo esperado: ${catalogo.map(t => `${esc(t.nome)}${t.obrigatorio ? ' (obrigatório)' : ''}${t.validadeMeses ? ` · ${t.validadeMeses} meses` : ' · sem prazo de validade'}`).join('; ')}</p>` : '<p>Treinamentos registrados (sem catálogo de obrigatórios).</p>'}<div class="eq-grade">${registros.map(h => `<div class="eq-card"><b>${esc(h.detalhe)}</b><div>${esc(h.nome)}</div><div>${dataBR(h.data)}</div></div>`).join('')}</div></section>` : '';
  const inicio = new Date(`${hoje}T12:00:00`); inicio.setFullYear(inicio.getFullYear() - 1);
  const desligados = incluirDesligados ? (equipe.desligados || []).filter(c => c.desligadoEm && new Date(`${c.desligadoEm}T12:00:00`) >= inicio && c.desligadoEm <= hoje) : [];
  const corpo = `<style>.eq-grade{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.eq-card{border:1px solid #ddd;border-radius:6px;padding:9px;break-inside:avoid;overflow-wrap:anywhere;font-size:8pt}.eq-card h3{font-size:10pt;margin:4px 0}.eq-foto{width:60px;height:64px;object-fit:cover;float:left;margin:0 7px 7px 0;font-size:7pt}.eq-nota{display:block;clear:both;font-size:18pt;margin-top:8px}.eq-eixo{display:grid;grid-template-columns:74px 1fr 55px;align-items:center;gap:3px;font-size:7pt;margin-top:4px}.eq-trilho{background:#eee;height:6px}.eq-trilho i{display:block;background:#334155;height:6px}.eq-radar{width:260px;max-width:100%}.eq-empresa{height:35px;max-width:160px;object-fit:contain}</style>
  ${empresa.logo ? `<img class="eq-empresa" src="${esc(empresa.logo)}" alt="${esc(empresa.empresa)}">` : ''}
  <div class="mk-kpis"><div class="mk-k">Efetivo ativo<strong class="eq-nota">${modelo.individuos.length}</strong></div><div class="mk-k">Treinamento<strong class="eq-nota">${nota(modelo.eixos.treinamento)}</strong></div><div class="mk-k">Turnover 12 meses<strong class="eq-nota">${nota(modelo.turnover)}</strong></div><div class="mk-k">Aferidos<strong class="eq-nota">${modelo.quantidadeAferida}</strong></div></div>
  <section class="mk-hero"><div><div class="mk-lb">Maturidade da equipe</div><div class="mk-big">${nota(modelo.indice)}</div><b>${esc(modelo.classe)}</b><p>Estabilidade: ${nota(modelo.estabilidade)}</p><p class="mk-nota">Índice descritivo dos registros disponíveis; não mede diretamente o conhecimento do posto.</p></div><div class="eq-radar">${radarEquipe(modelo.eixos)}</div></section>
  <div class="mk-duas"><section><h2 class="mk-h2">Top 3 (com empates)</h2>${modelo.top.slice(0,3).map(i => `<div class="eq-card">${foto(i.colaborador)}<b>${esc(i.colaborador.nome)}</b><div>${nota(i.indice)}/100</div><div style="clear:both"></div></div>`).join('') || 'Sem índices aferidos'}${modelo.top.length > 3 ? `<p class="mk-nota">Também empatados: ${modelo.top.slice(3).map(i => `${esc(i.colaborador.nome)} (${nota(i.indice)})`).join('; ')}. Fotos nas fichas abaixo.</p>` : ''}</section><section><h2 class="mk-h2">Alertas</h2>${modelo.alertas.map(a => `<p><b>${esc(a.nome)}</b>: ${esc(a.texto)}</p>`).join('') || 'Nenhum alerta nos dados aferidos'}</section></div>
  ${treinamento}<h2 class="mk-h2">Equipe - fichas individuais</h2><div class="eq-grade">${cards}</div>
  ${desligados.length ? `<h2 class="mk-h2">Desligados nos últimos 12 meses</h2>${desligados.map(c => `<p>${esc(c.nome)} · ${esc(c.cargo)} · ${dataBR(c.desligadoEm)}</p>`).join('')}` : ''}
  <p class="mk-nota">Como ler: assiduidade considera faltas e atrasos na janela aferida; FT é folga trabalhada; treinamento considera obrigatórios válidos; reciclagem segue o alerta de 45 dias; tempo de casa usa a admissão. Eixos sem fonte são excluídos e os pesos renormalizados. Afastados há mais de 30 dias não compõem a média. Reativações podem remover o histórico de desligamento. Dados na referência ${dataBR(hoje)}.</p>`;
  return documentoMoked({ project, titulo: 'Mapa de Equipe', subtitulo: esc(`${project.id} · ${project.name || ''}`), numero: `MK-EQ-${project.id}-${hoje.replace(/-/g, '')}`, hoje: new Date(`${hoje}T12:00:00`), corpo });
}
