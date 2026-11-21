// HTML Visão 360 com SIS⁺ (grupo → ranking → parque → camada → requisito). Substitui o "HTML Executivo" antigo.
// Decisão do Marcio (20/11/2026): SIS⁺ novo SÓ nos relatórios HTML; o SIS+ do app (RT/RH/RA) não muda.
// Tudo o que aparece vem do motor (nenhum número digitado). O que o app não mede é "a confirmar" (0,5) e dito como tal.
import { escHTML as esc } from "../padraoMoked";
import { avaliar, CAMADAS, FASES, REGUAS, ROT_STATUS, faixa } from "./motor";
import { dadosDoApp } from "./dadosApp";
import { CSS_SIS } from "./cssSis";
import { montarProjetos } from "../executivoRelatorio";
import { consolidarRondas, periodoUltimosDias } from "../rondaVirtualRelatorio";

const n1 = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
const pt = (x) => String(x).replace(".", ",");

const fx = (v) => `style="--cli:${faixa(v, REGUAS.cliente).cor};--mok:${faixa(v, REGUAS.moked).cor}"`;
const lbl = (v) => `<span class="l-cli">${faixa(v, REGUAS.cliente).rotulo}</span><span class="l-mok">${faixa(v, REGUAS.moked).rotulo}</span>`;
const chipFx = (v) => `<span class="chip fxbg" ${fx(v)}>${lbl(v)}</span>`;

// Mostrador no modelo do SIS+ da Área do Cliente (anel com gradiente, marcas, agulha). 0% na base, 100% no topo.
const PARADAS = [[0, [216, 53, 63]], [55, [232, 130, 58]], [95, [239, 196, 63]], [135, [143, 203, 69]], [180, [47, 207, 117]]];
const corEm = (d) => { for (let i = 1; i < PARADAS.length; i++) if (d <= PARADAS[i][0]) { const [d0, c0] = PARADAS[i - 1], [d1, c1] = PARADAS[i], t = (d - d0) / (d1 - d0); return `rgb(${c0.map((x, k) => Math.round(x + (c1[k] - x) * t)).join(",")})`; } return "rgb(47,207,117)"; };
function dial(v, id, grande) {
  const ang = (100 - v) * 1.8;
  const P = (r, th) => [(100 + r * Math.sin(th)).toFixed(2), (100 + r * Math.cos(th)).toFixed(2)];
  let anel = "";
  for (let g = 0; g < 360; g += 2) { const a0 = (g * Math.PI) / 180, a1 = ((g + 2.8) * Math.PI) / 180, [x0, y0] = P(82, a0), [x1, y1] = P(82, a1), d = g < 180 ? g : 360 - g; anel += `<path d="M${x0} ${y0}A82 82 0 0 0 ${x1} ${y1}" stroke="${corEm(Math.min(180, d + 1))}" stroke-width="28" fill="none"/>`; }
  let ticks = "";
  for (let i = 0; i < 60; i++) { const u = (i * 6 * Math.PI) / 180, maior = i % 5 === 0, r1 = maior ? 80.7 : 84, r2 = 86.7; const x = (r) => (100 + Math.sin(u) * r).toFixed(2), y = (r) => (100 - Math.cos(u) * r).toFixed(2);
    ticks += `<line x1="${x(r1)}" y1="${y(r1)}" x2="${x(r2)}" y2="${y(r2)}" stroke="#000" stroke-opacity="${maior ? .67 : .4}" stroke-width="${maior ? 1.33 : .67}"/>`; }
  const rb = 65.3, lb = (rb * Math.sin(0.07)).toFixed(2), cb = (rb * Math.cos(0.07)).toFixed(2);
  const sid = String(id).replace(/[^A-Za-z0-9_-]/g, "");
  return `<svg class="dial ${grande ? "g" : ""}" viewBox="0 0 200 200" role="img" aria-label="SIS+ ${v}%">
<defs><radialGradient id="dk${sid}" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#17171c"/><stop offset="1" stop-color="#09090b"/></radialGradient>
<linearGradient id="bz${sid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a414e"/><stop offset=".5" stop-color="#12151b"/><stop offset="1" stop-color="#2b313c"/></linearGradient></defs>
<circle cx="100" cy="100" r="99" fill="#0a0c10" stroke="url(#bz${sid})" stroke-width="2"/>
<g>${anel}</g><circle cx="100" cy="100" r="68" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.5"/>${ticks}
<circle cx="100" cy="100" r="67.5" fill="url(#dk${sid})" stroke="#26262c" stroke-width=".7"/>
<g class="agulha" data-ang="${ang}" style="transform-origin:100px 100px">
<line x1="100" y1="42.7" x2="100" y2="20" stroke="#f3f4f6" stroke-width="2" stroke-linecap="round" style="filter:drop-shadow(0 0 3px #fff)"/>
<polygon points="100,10.7 ${(100 - lb).toFixed(2)},${(100 - cb).toFixed(2)} ${(100 + +lb).toFixed(2)},${(100 - cb).toFixed(2)}" fill="#f3f4f6" style="filter:drop-shadow(0 0 3.5px #fffa)"/></g>
<text x="100" y="72" text-anchor="middle" class="d-moked">MOKED</text>
<text x="100" y="112" text-anchor="middle" class="d-num">${v}<tspan class="d-pc">%</tspan></text>
<text x="100" y="131" text-anchor="middle" class="d-faixa"><tspan class="l-cli">${faixa(v, REGUAS.cliente).rotulo.toUpperCase()}</tspan><tspan class="l-mok">${faixa(v, REGUAS.moked).rotulo.toUpperCase()}</tspan></text>
<text x="100" y="149" text-anchor="middle" class="d-sis">SIS<tspan class="d-plus">⁺</tspan></text></svg>`;
}

const stChip = (r) => r.conf ? `<span class="st conf">A confirmar</span>` : `<span class="st s${String(r.s).replace(".", "")}">${ROT_STATUS[r.s]}</span>`;
const pesoDots = (p) => `<span class="peso" title="Peso ${p} de 5">${"●".repeat(p)}<i>${"●".repeat(5 - p)}</i></span>`;

function reqHTML(r) {
  const falha = r.s < 1;
  const nota = r.teto < 1 ? `<span class="tag">${r.impacto > 0 ? "Teto 50%: depende de projeto técnico" : "No teto até o projeto técnico ser feito"}</span>` : "";
  const origem = r.medido ? `<span class="orig app">Medido pelo app</span>` : `<span class="orig diag">Aguardando validação</span>`;
  const corpo = r.conf
    ? `<div class="fazer"><b>Validar primeiro</b><p>Sem leitura no app. Validar em campo ou no diagnóstico. Se confirmado: ${esc(r.acao)}</p>`
    : `<div class="fazer"><b>O que fazer</b><p>${esc(r.acao)}</p>`;
  return `<li class="req ${falha ? "falha" : ""}"><div class="req-topo">${stChip(r)}<span class="req-nome">${esc(r.nome)}</span>${pesoDots(r.peso)}</div>
<div class="req-meta">${origem}${r.ev ? `<span class="ev">${esc(r.ev)}</span>` : ""}</div>
${falha ? `${corpo}<div class="tags"><span class="tag f${r.fase}">${FASES[r.fase]}</span>${r.impacto > 0 ? `<span class="tag ganho">+${pt(r.impacto)} pts no SIS⁺</span>` : ""}${nota}</div></div>` : ""}</li>`;
}

function camadaHTML(c, aberta) {
  const falhas = c.reqs.filter((r) => r.s < 1);
  const ord = [...c.reqs].sort((a, b) => a.s - b.s || b.peso - a.peso);
  return `<details class="camada" ${aberta ? "open" : ""}><summary><span class="cod">${c.cod}</span><span class="cn"><b>${esc(c.nome)}</b><small>${falhas.length ? `${falhas.length} de ${c.reqs.length} requisitos precisam de ação ou validação` : `${c.reqs.length} requisitos atendidos`}</small></span>
<span class="barra"><i class="fxbg" ${fx(c.valor)} style="--w:${c.valor}%;--cli:${faixa(c.valor, REGUAS.cliente).cor};--mok:${faixa(c.valor, REGUAS.moked).cor}"></i></span><span class="cv fx" ${fx(c.valor)}>${c.valor}%</span>${chipFx(c.valor)}<span class="seta">▾</span></summary>
<ul class="reqs">${ord.map(reqHTML).join("")}</ul></details>`;
}

function planoHTML(res) {
  const p = res.plano, pas = [["Hoje", p.hoje], ["Após o imediato", p.imediato], ["Após 90 dias", p["90_dias"]], ["Após o estruturante", p.estruturante]];
  return `<div class="plano">${pas.map(([n, v], i) => `<div class="passo ${i === 3 ? "meta" : ""}"><div class="col"><i class="fxbg" ${fx(v)} style="height:${Math.max(6, v)}%"></i></div><b class="fx" ${fx(v)}>${v}%</b><small>${n}</small></div>`).join("")}</div>
<p class="peq">O plano soma as correções por fase. Ele inclui os requisitos a confirmar, que só entram se a validação mostrar a falha.</p>
<h4>Por que a meta não é 100%</h4><p class="peq">A meta é ${res.meta}%. ${res.porQueNao100.length ? "Ficam abaixo do máximo, mesmo depois das correções:" : "Todos os requisitos chegam ao máximo."}</p>
<ul class="lista">${res.porQueNao100.map((r) => `<li><b>${esc(r.nome)}</b> <span class="mut">· ${r.s === .5 ? "depende de projeto técnico ainda não feito (tecnologia, especificação ou mapeamento)" : "sem correção prevista"}</span></li>`).join("")}</ul>`;
}

function memoria(res) {
  const lin = (r) => `<tr><td>${r.cod}</td><td>${esc(r.nome)}</td><td>${r.peso}</td><td>${r.conf ? "a confirmar (0,5)" : pt(r.s)}</td><td>${pt(r.peso * r.s)}</td><td>${esc(r.ev || "—")}${r.regra ? `<br><i>${esc(r.regra)}</i>` : ""}</td><td>${r.fase}</td><td>${pt(r.teto)}</td></tr>`;
  return res.camadas.map((c) => `<h4>${c.cod} · ${esc(c.nome)}</h4><div class="tb"><table><thead><tr><th>Cód.</th><th>Requisito</th><th>Peso</th><th>Atend.</th><th>Pontos</th><th>Evidência e regra</th><th>Fase</th><th>Teto</th></tr></thead><tbody>${c.reqs.map(lin).join("")}</tbody></table></div><p class="conta"><b>${esc(c.nome)}:</b> ${pt(c.pontos)} de ${c.maximo} pontos = ${c.valor}%</p>`).join("")
    + `<p class="conta tot"><b>SIS⁺ geral:</b> ${pt(res.pontos)} de ${res.maximo} pontos = ${res.geral}% (ponderado pelos pesos; não é a média das camadas).</p>`;
}

// Resumo de cada relatório do app (checklist, KeyAccess, energia, iluminação…) — a evidência por trás do índice.
function evidenciasHTML(p) {
  if (!p.cards.length) return "";
  const cartao = (c) => `<details class="evc ${esc(c.nivel || "neutro")}"><summary><span class="evt">${esc(c.titulo)}</span><b>${esc(c.valor)}</b><span class="evd">${esc(c.texto)}</span></summary><div class="evb">${c.detalhe || `<p>${esc(c.texto)}.</p>`}<p class="mut">${esc(c.efeito)}</p></div></details>`;
  return `<h3>Relatórios do projeto</h3><p class="peq">Pontuação da Visão 360 (checklist com descontos): <b>${p.score} de 100</b>${p.semChecklist ? " · sem checklist registrado" : ` · checklist base ${p.base}%`}. Cada item abre o resumo do relatório.</p><div class="evl">${p.cards.map(cartao).join("")}</div>`;
}

function projetoHTML(p) {
  const r = p.r, menor = [...r.camadas].sort((a, b) => a.valor - b.valor)[0].cod;
  const top = r.reqs.filter((x) => x.medido && x.s < 1 && x.impacto > 0).sort((a, b) => b.impacto - a.impacto).slice(0, 5);
  const validar = r.aConfirmar.length;
  const medidos = r.reqs.filter((x) => x.medido).length;
  const id = esc(p.id);
  return `<section class="vista" id="v-projeto-${id}" hidden>
<a class="voltar" href="#grupo">← Todos os projetos</a>
<header class="hero"><div class="hero-dial">${dial(r.geral, p.id, true)}<div class="cap">SISTEMA INTEGRADO DE SEGURANÇA</div></div>
<div class="hero-txt"><p class="eyebrow">${id} · ${esc(p.nome)}</p><h2>SIS⁺ hoje: <span class="fx" ${fx(r.geral)}>${r.geral}% · ${lbl(r.geral)}</span></h2>
<div class="duo"><div><small>Equipamentos operando</small><b>${p.disp == null ? "—" : n1(p.disp) + "%"}</b></div><div><small>SIS⁺ do conjunto</small><b class="fx" ${fx(r.geral)}>${r.geral}%</b></div><div><small>Meta após o plano</small><b>${r.meta}%</b></div></div>
<p class="chave">${validar ? `Índice provisório: o app mediu ${medidos} de ${r.reqs.length} requisitos. Os outros ${validar} contam 0,5 até serem validados.` : "Todos os requisitos têm leitura ou validação."}</p></div></header>

<details class="met"><summary>Como o SIS⁺ é calculado</summary><p>O SIS⁺ mede se o conjunto protege: equipamentos, pessoas, procedimentos e integração trabalhando juntos. São ${r.reqs.length} requisitos em 5 camadas, cada um com peso de 1 a 5 e atendimento Atende (1), Parcial (0,5) ou Não atende (0). SIS⁺ da camada = Σ(peso × atendimento) ÷ Σ pesos × 100. O geral é ponderado pelos pesos. Requisito sem leitura no app vale 0,5 (a confirmar) até ser validado. Faixas: cliente Bom ≥ 85, Atenção 70–84, Crítico &lt; 70; Moked Bom ≥ 92, Alerta 80–91, Crítico &lt; 80.</p></details>

<div class="topo-sec"><h3>Camadas</h3><span><button class="mini" type="button" data-abrir="1">Abrir tudo</button><button class="mini" type="button" data-abrir="0">Fechar tudo</button></span></div>
${r.camadas.map((c) => camadaHTML(c, c.cod === menor)).join("")}
<div class="camada g"><span class="cod">G</span><span class="cn"><b>Gestão e método Moked</b><small>Não pontuada: é o software por trás do hardware, ainda a integrar</small></span><span class="chip neutro">A integrar</span></div>

<h3>Corrija primeiro</h3>${top.length ? `<p class="peq">Os requisitos medidos pelo app que mais sobem o SIS⁺ quando resolvidos.</p>
<ol class="top">${top.map((x) => `<li><span class="cod">${x.cod}</span><span class="tn"><b>${esc(x.nome)}</b><small>${esc(x.acao)}</small></span><span class="tag ganho">+${pt(x.impacto)} pts</span><span class="tag f${x.fase}">${FASES[x.fase]}</span></li>`).join("")}</ol>` : `<p class="peq">Nenhuma falha medida pelo app. Veja os pontos a validar abaixo.</p>`}

<h3>Plano e meta</h3>${planoHTML(r)}
<h3>Cenários de equipe</h3><p class="peq">Só a camada de pessoas e procedimentos muda em cada cenário. Hoje ela depende de validação.</p>
<div class="cen">${[["Atual", r.cenarios.atual], ["Aceitável", r.cenarios.aceitavel], ["Recomendado", r.cenarios.recomendado]].map(([n, v]) => `<div><small>${n}</small><b class="fx" ${fx(v)}>${v}%</b><div class="bar"><i class="fxbg" ${fx(v)} style="width:${v}%"></i></div></div>`).join("")}</div>
${validar ? `<h3>Pontos a validar</h3><p class="peq">Sem leitura no app. Contam como parcial (0,5) até a validação em campo ou no diagnóstico.</p><ul class="lista">${[...r.aConfirmar].sort((a, b) => b.peso - a.peso).map((x) => `<li><b>${x.cod}</b> ${esc(x.nome)} ${pesoDots(x.peso)}</li>`).join("")}</ul>` : ""}
${evidenciasHTML(p)}
<details class="met anexo"><summary>Anexo · Memória de cálculo</summary>${memoria(r)}</details>
</section>`;
}

function grupoHTML(parques, grupoLabel) {
  const media = parques.length ? Math.round(parques.reduce((a, p) => a + p.r.geral, 0) / parques.length) : 0;
  const med = parques.reduce((a, p) => a + p.r.reqs.filter((x) => x.medido).length, 0), tot = parques.reduce((a, p) => a + p.r.reqs.length, 0);
  const cards = parques.map((p, i) => { const id = esc(p.id); return `<a class="pcard" href="#projeto-${id}"><span class="rk">${i + 1}</span><div class="pc-mid"><b>${id} · ${esc(p.nome)}</b><small>Equipamentos ${p.disp == null ? "—" : n1(p.disp) + "%"} · ${p.r.reqs.filter((r) => r.s < 1).length} requisitos com ação ou validação</small><div class="bar"><i class="fxbg" ${fx(p.r.geral)} style="width:${p.r.geral}%"></i></div></div><div class="pc-v"><b class="fx" ${fx(p.r.geral)}>${p.r.geral}%</b>${chipFx(p.r.geral)}</div><span class="seta2">›</span></a>`; }).join("");
  const heat = `<div class="tb"><table class="heat"><thead><tr><th>Projeto</th>${CAMADAS.map((c) => `<th title="${esc(c.nome)}">${c.cod}</th>`).join("")}<th>SIS⁺</th></tr></thead><tbody>${parques.map((p) => `<tr><td><a href="#projeto-${esc(p.id)}">${esc(p.id)}</a></td>${p.r.camadas.map((c) => `<td><span class="cel fxbg" ${fx(c.valor)}>${c.valor}</span></td>`).join("")}<td><span class="cel fxbg" ${fx(p.r.geral)}><b>${p.r.geral}</b></span></td></tr>`).join("")}</tbody></table></div>
<p class="leg">P Perímetro · A Acessos · I Áreas internas · M Monitoramento · H Pessoas e procedimentos</p>`;
  return `<section class="vista" id="v-grupo"><header class="hero grupo"><div class="hero-dial">${dial(media, "g", true)}<div class="cap">SISTEMA INTEGRADO DE SEGURANÇA</div></div><div class="hero-txt"><p class="eyebrow">${esc(grupoLabel)} · ${parques.length} ${parques.length === 1 ? "projeto" : "projetos"}</p><h2>SIS⁺ médio: <span class="fx" ${fx(media)}>${media}% · ${lbl(media)}</span></h2><p class="peq">Média simples dos projetos. Toque em um projeto para abrir o detalhe, camada por camada.</p></div></header>
<p class="previa"><b>Índice provisório.</b> O app mediu ${med} de ${tot} requisitos (${tot ? Math.round((med / tot) * 100) : 0}%). Os demais contam 0,5 (a confirmar) até a validação em campo ou no diagnóstico. Por isso o SIS⁺ ainda não é o resultado final.</p>
<h3>Ranking dos projetos</h3><div class="rank">${cards}</div><p class="leg">Os traços finos nas barras marcam os limites das faixas da versão escolhida.</p><h3>Comparativo por camada</h3>${heat}</section>`;
}

const CSS_EXTRA = `
.st.conf{background:#6b7280;color:#fff}
.orig.diag{background:var(--soft);color:var(--mut)}
.evl{display:grid;gap:8px}.evc{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:10px;padding:0}
.evc.alerta{border-left-color:var(--bad)}.evc.atencao{border-left-color:var(--warn)}.evc.bom{border-left-color:var(--ok)}
.evc>summary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:10px 12px;cursor:pointer;list-style:none}.evc>summary::-webkit-details-marker{display:none}
.evc .evt{font-size:12px;color:var(--mut)}.evc b{font-size:16px;text-align:right}.evc .evd{grid-column:1/-1;font-size:13px;color:var(--fg)}
.evb{padding:0 12px 12px;font-size:13px;overflow-x:auto}.evb table{width:100%;border-collapse:collapse;margin:6px 0}.evb th,.evb td{text-align:left;padding:5px 6px;border-bottom:1px solid var(--line);font-size:12.5px}.evb ul{padding-left:18px;margin:6px 0}.evb .rel{color:var(--mut)}
.marca img{height:30px;background:#fff;border-radius:4px;padding:2px;vertical-align:middle;margin-right:10px}
`;

const JS = `
(function(){
var raiz=document.documentElement;raiz.setAttribute("data-regua","cliente");
document.querySelectorAll("[data-r]").forEach(function(b){b.addEventListener("click",function(){raiz.setAttribute("data-regua",b.getAttribute("data-r"));document.querySelectorAll("[data-r]").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false")})})});
function rota(){var h=(location.hash||"#grupo").slice(1);var id="v-"+(document.getElementById("v-"+h)?h:"grupo");document.querySelectorAll(".vista").forEach(function(v){v.hidden=v.id!==id});
 var v=document.getElementById(id);v.querySelectorAll(".agulha").forEach(function(a){a.style.transform="rotate(0deg)";requestAnimationFrame(function(){requestAnimationFrame(function(){a.style.transform="rotate("+a.getAttribute("data-ang")+"deg)"})})});window.scrollTo(0,0)}
window.addEventListener("hashchange",rota);rota();
document.querySelectorAll("[data-abrir]").forEach(function(b){b.addEventListener("click",function(){var ab=b.getAttribute("data-abrir")==="1";b.closest(".vista").querySelectorAll("details.camada").forEach(function(d){d.open=ab})})});
})();`;

/** Avalia cada projeto: motor + o que o app mede. Exportado para teste. */
export function avaliarProjetos({ rows, extras = {}, agora = new Date() }) {
  const cards = montarProjetos([...(rows || [])], extras, agora);
  const porId = Object.fromEntries(cards.map((c) => [c.id, c]));
  return (rows || []).map((row) => {
    const ex = extras[row.id] || {};
    let ronda = null;
    if (Array.isArray(ex.rondaTurnos) && ex.rondaTurnos.length) {
      try { const per = periodoUltimosDias(30, agora); const c = consolidarRondas({ id: row.id, name: row.name }, ex.rondaTurnos, { agora, de: per.de, ate: per.ate }); if (c.totais.turnos && c.totais.execucao != null) ronda = { execucao: c.totais.execucao }; } catch (e) { ronda = null; }
    }
    const { dados } = dadosDoApp({ row, ex, categorias: ex.categorias || [], ronda });
    const r = avaliar(dados);
    const base = porId[row.id] || { cards: [] };
    return { id: row.id, nome: row.name, score: row.score, base: row.base, semChecklist: !!row.semChecklist, disp: row.semChecklist ? null : row.base, cards: base.cards, r };
  }).sort((a, b) => b.r.geral - a.r.geral);
}

export function montarHTMLSis({ rows, grupoLabel, agora = new Date(), extras = {}, logoSrc = "" }) {
  if (!grupoLabel) throw new Error("O HTML Visão 360 é por cliente: selecione um grupo (a visão Todos é interna).");
  const parques = avaliarProjetos({ rows, extras, agora });
  const emissao = `${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Visão 360 SIS⁺ — ${esc(grupoLabel)}</title>
<style>${CSS_SIS}${CSS_EXTRA}</style></head><body>
<div class="faixa-topo"><div class="wrap"><div class="marca">${logoSrc ? `<img src="${esc(logoSrc)}" alt="Moked Consulting Security">` : ""}<span>MOKED<small>VISÃO 360 · SIS⁺ SISTEMA INTEGRADO DE SEGURANÇA</small></span></div>
<div class="seg" role="group" aria-label="Versão do relatório"><button type="button" data-r="cliente" aria-pressed="true">Versão do cliente</button><button type="button" data-r="moked" aria-pressed="false">Versão Moked</button></div></div></div>
<div class="wrap">${grupoHTML(parques, grupoLabel)}${parques.map(projetoHTML).join("")}
<p class="rodape">Moked Consulting Security · SIS⁺ calculado por requisito (peso × atendimento) · emissão ${esc(emissao)} · documento gerado pelo Moked CheckTest com os dados disponíveis no momento; não se atualiza sozinho.</p></div>
<script>${JS}</script></body></html>`;
}
