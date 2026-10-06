// ─────────────────────────────────────────────────────────────
// HTML Executivo (Visão 360) — arquivo HTML autocontido e navegável, por CLIENTE (nunca "Todos").
// Pedido do Marcio (05/10/2026): ao lado do "PDF Executivo", um relatório vivo de navegar: Cliente → Projeto → Resumo.
// Versão de demonstração: usa SÓ o que a tela da Visão 360 já calculou (linhas: score, base, penalidades, iluminação,
// energia) + o histórico de checklists em memória. Nenhuma leitura nova, nenhuma fórmula nova, nenhuma escrita.
// O que ainda não entra aparece como "não incluído nesta versão" — nunca como zero.
// ─────────────────────────────────────────────────────────────
import { escHTML, dataBR } from "./padraoMoked";

export const MODULOS_FUTUROS = ["Análise de risco", "Ronda virtual (CFTV)", "Tempo de gravação (CFTV)", "Manutenção técnica", "Acessos de ambulância", "Equipamentos críticos"];

// Converte as penalidades da Visão 360 em cartões legíveis (mesmos textos e valores calculados no app).
function cartoesPenalidade(row) {
  return (row.penalidades || []).map((p) => {
    const l = String(p.label || "");
    // tipo e quantidade vêm ESTRUTURADOS de computeScore360 (sem extrair número do rótulo). Sem eles: título genérico
    // e o próprio rótulo, sem número inventado.
    const TIT = { keyaccess: "KeyAccess", ctmk: "Monitor CTMK", bolsao: "Bolsão", perimetro: "Perímetro", ronda: "Ronda VSPP" };
    const titulo = TIT[p.tipo] || "Pendência";
    const n = Number.isFinite(p.qtd) ? p.qtd : null;
    const pl = (um, varios) => (n === 1 ? um : varios);
    const valor = n == null ? `−${p.val}` : p.tipo === "ronda" ? `${n}%` : p.tipo === "keyaccess" ? `${n} ${pl("aberta", "abertas")}` : p.tipo === "ctmk" ? `${n} d off-line`
      : p.tipo === "bolsao" ? `${n} ${pl("placa", "placas")}` : p.tipo === "perimetro" ? `${n} ${pl("zona", "zonas")}` : `−${p.val}`;
    return { titulo, valor, texto: l, nivel: p.val >= 10 ? "alerta" : "atencao", efeito: `−${p.val} na pontuação` };
  });
}

export function montarProjetos(rows, extras = {}) {
  return (rows || []).map((r) => {
    const ex = extras[r.id] || {};
    const cards = [];
    if (ex.ultimo) cards.push({ titulo: "Checklist semanal", valor: `${ex.ultimo.pct}%`, texto: `${ex.ultimo.total} pontos · ${ex.ultimo.inop} inoperantes · ${ex.ultimo.partial} parciais · checklist de ${dataBR(ex.ultimo.data)}`,
      nivel: ex.ultimo.pct >= 90 ? "bom" : ex.ultimo.pct >= 75 ? "atencao" : "alerta", efeito: "base da pontuação" });
    else cards.push({ titulo: "Checklist semanal", valor: "—", texto: "Nenhum checklist registrado", nivel: "neutro", efeito: "sem base para a pontuação" });
    cards.push(...cartoesPenalidade(r));
    if (r.energiaTemDados === false) cards.push({ titulo: "Energia", valor: "—", texto: "Sem registros de energia no app para este projeto", nivel: "neutro", efeito: "não aferido" });
    else if (r.energiaQuedas7d || r.energiaAberta) cards.push({ titulo: "Energia", valor: `${r.energiaQuedas7d}`, texto: `${r.energiaQuedas7d === 1 ? "queda" : "quedas"} nos últimos 7 dias${r.energiaAberta ? " · ocorrência em aberto" : ""}`, nivel: r.energiaAberta ? "alerta" : "atencao", efeito: "exibido, sem pontuação" });
    else cards.push({ titulo: "Energia", valor: "0", texto: "Nenhuma queda nos últimos 7 dias", nivel: "bom", efeito: "exibido, sem pontuação" });
    if (r.ilumTotal) cards.push({ titulo: "Iluminação", valor: `${r.ilumDeficientes}`, texto: `pontos deficientes de ${r.ilumTotal}`, nivel: r.ilumDeficientes ? "atencao" : "bom", efeito: "exibido, sem pontuação" });
    return { id: r.id, nome: r.name, score: r.score, base: r.base, semChecklist: !!r.semChecklist, penalidades: r.penalidades || [], tendencia: ex.tendencia || [], cards };
  });
}

function sparkSVG(t) {
  if (!t || t.length < 2) return "";
  const w = 180, h = 40, v = t.map((x) => x.pct), mn = Math.min(...v) - 1, mx = Math.max(...v) + 1;
  const x = (i) => (i * w) / (v.length - 1), y = (a) => h - ((a - mn) / (mx - mn || 1)) * h;
  return `<svg viewBox="0 0 ${w} ${h + 4}" width="180" height="44" role="img" aria-label="Checklist nas últimas ${v.length} semanas"><polyline fill="none" stroke="currentColor" stroke-width="2" points="${v.map((a, i) => `${x(i).toFixed(1)},${y(a).toFixed(1)}`).join(" ")}"/><circle cx="${x(v.length - 1).toFixed(1)}" cy="${y(v[v.length - 1]).toFixed(1)}" r="3.5" fill="#B21E27"/></svg>`;
}

export function montarHTMLExecutivo({ rows, grupoLabel, agora = new Date(), extras = {}, notaCalculo = "", logoSrc = "" }) {
  if (!grupoLabel) throw new Error("HTML Executivo é por cliente: selecione um grupo (a visão Todos é interna).");
  const projetos = montarProjetos([...(rows || [])].sort((a, b) => b.score - a.score), extras);
  const media = projetos.length ? Math.round(projetos.reduce((s, p) => s + p.score, 0) / projetos.length) : 0;
  const emissao = `${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  const dados = projetos.map((p) => ({ ...p, spark: sparkSVG(p.tendencia), cards: p.cards.map((c) => ({ ...c, titulo: escHTML(c.titulo), valor: escHTML(c.valor), texto: escHTML(c.texto), efeito: escHTML(c.efeito) })),
    nome: escHTML(p.nome), penalidades: p.penalidades.map((x) => ({ val: x.val, label: escHTML(x.label) })) }));
  const json = JSON.stringify(dados).replace(/</g, "\\u003c");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Relatório Executivo — ${escHTML(grupoLabel)}</title>
<style>
:root{--bg:#F5F6F8;--papel:#fff;--tinta:#121212;--tinta2:#4B5563;--mu:#6B7280;--linha:#E5E7EB;--moked:#B21E27;--ok:#15803D;--wa:#B45309;--barra:#1F2937;--suave:#F3F4F6}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0F1115;--papel:#171A21;--tinta:#F3F4F6;--tinta2:#CBD5E1;--mu:#94A3B8;--linha:#2A2F3A;--barra:#E5E7EB;--suave:#1F242E}}
:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}*,*::before,*::after{box-sizing:inherit}
body{margin:0;background:var(--bg);color:var(--tinta);font-family:Calibri,Carlito,"Segoe UI",system-ui,Arial,sans-serif;font-size:15px;line-height:1.45}
.wrap{max-width:1040px;margin:0 auto;padding:18px 16px 40px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-bottom:3px solid var(--tinta);padding-bottom:12px;position:relative}
header::after{content:"";position:absolute;right:0;bottom:-3px;width:28%;height:3px;background:var(--moked)}
.marca{display:flex;align-items:center;gap:12px}.marca img{height:34px;background:#fff;border-radius:4px;padding:2px}.marca b{font-size:17px}.marca span{display:block;font-size:12.5px;color:var(--mu)}
.emit{font-size:12.5px;color:var(--mu);text-align:right}
.trilha{font-size:13.5px;color:var(--mu);margin:14px 0 6px}.trilha a{color:var(--tinta2);cursor:pointer;text-decoration:underline;text-underline-offset:2px}
h1{font-size:26px;margin:2px 0 4px}.sub{color:var(--tinta2);margin:0 0 16px}
.painel{background:var(--papel);border:1px solid var(--linha);border-radius:10px;padding:16px 18px;margin-bottom:14px}
.media{display:flex;align-items:baseline;gap:10px;margin-bottom:10px}.media b{font-size:40px;line-height:1}.media span{color:var(--tinta2)}
.lin{display:grid;grid-template-columns:34px minmax(150px,1.2fr) 3fr 56px;gap:12px;align-items:center;padding:10px 8px;border-radius:8px;cursor:pointer;border:1px solid transparent;background:none;font:inherit;color:inherit;text-align:left;width:100%}
.lin:hover,.lin:focus-visible{background:var(--suave);border-color:var(--linha);outline:none}
.pos{font-weight:700;color:var(--mu);text-align:center}.lin:first-child .pos{color:var(--moked)}.nome b{display:block}.nome span{font-size:12.5px;color:var(--mu)}
.trilho{height:12px;background:var(--suave);border-radius:3px;overflow:hidden}.trilho i{display:block;height:100%;background:var(--barra)}
.nota{font-size:22px;font-weight:700;text-align:right}.nota small{font-size:11px;color:var(--mu);font-weight:400}.fator{grid-column:2 / -1;font-size:12.5px;color:var(--mu);margin-top:-4px}
table{width:100%;border-collapse:collapse;font-size:13.5px}th{font-size:11.5px;color:var(--mu);text-align:left;border-bottom:1.5px solid var(--tinta);padding:6px}td{border-bottom:1px solid var(--linha);padding:7px 6px}.rol{overflow-x:auto}
.cab{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:end}
.cadeia{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.mod{background:var(--papel);border:1px solid var(--linha);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px;min-height:120px}
.mod .t{font-size:13px;color:var(--mu)}.mod .v{font-size:24px;font-weight:700;line-height:1.1}.mod .d{font-size:13px;color:var(--tinta2)}.mod .e{margin-top:auto;font-size:12px;color:var(--mu)}
.alerta{border-left:4px solid var(--moked)}.atencao{border-left:4px solid var(--wa)}.bom{border-left:4px solid var(--ok)}.neutro{border-left:4px solid var(--linha)}
.fut{font-size:13px;color:var(--mu);margin-top:12px}.rodape{font-size:12px;color:var(--mu);margin-top:22px;border-top:1px solid var(--linha);padding-top:10px}
button:focus-visible,a:focus-visible{outline:2px solid var(--moked);outline-offset:2px}
@media (max-width:620px){.lin{grid-template-columns:28px 1fr 46px}.lin .trilho{grid-column:2 / -1;grid-row:2}.cab{grid-template-columns:1fr}h1{font-size:22px}}
@media print{body{background:#fff}.lin{break-inside:avoid}}
</style></head><body><div class="wrap">
<header><div class="marca">${logoSrc ? `<img src="${escHTML(logoSrc)}" alt="Moked Consulting Security">` : ""}<div><b>Relatório Executivo — ${escHTML(grupoLabel)}</b><span>Saúde operacional consolidada por projeto</span></div></div>
<div class="emit">Emissão ${escHTML(emissao)}<br>Moked Consulting Security</div></header>
<main id="app"></main>
<div class="rodape">${escHTML(notaCalculo)} Documento gerado pelo MokLog CheckTest com os dados disponíveis no momento da emissão; não se atualiza sozinho.</div>
</div>
<script>
var D=${json};var GRUPO=${JSON.stringify(escHTML(grupoLabel))};var MEDIA=${media};var FUT=${JSON.stringify(MODULOS_FUTUROS)};var est=null;
var app=document.getElementById("app");
function grupo(){return '<div class="trilha">'+GRUPO+'</div><h1>'+GRUPO+': '+D.length+(D.length===1?' projeto':' projetos')+'</h1><p class="sub">Clique num projeto para ver o resumo dos relatórios dele.</p>'+
 '<section class="painel"><div class="media"><b>'+MEDIA+'</b><span>pontuação média de 100 — checklist semanal descontado das pendências abertas nos demais módulos</span></div><div>'+
 D.map(function(p,i){return '<button class="lin" data-p="'+p.id+'"><span class="pos">'+(i+1)+'º</span><span class="nome"><b>'+p.id+' · '+p.nome+'</b><span>'+(p.semChecklist?'sem checklist registrado':'checklist '+p.base+'%')+'</span></span><span class="trilho"><i style="width:'+Math.max(0,Math.min(100,p.score))+'%"></i></span><span class="nota">'+p.score+'<small>/100</small></span><span class="fator">'+(p.penalidades.length?p.penalidades.map(function(x){return x.label+' (−'+x.val+')';}).join(' · '):'Sem pendências que descontem a pontuação')+'</span></button>';}).join('')+'</div></section>'+
 '<section class="painel"><h2 style="font-size:17px;margin:0 0 8px">Comparação</h2><div class="rol"><table><thead><tr><th>Projeto</th><th>Pontuação</th><th>Checklist</th><th>Pendências que descontam</th><th>Energia (7 dias)</th><th>Iluminação</th></tr></thead><tbody>'+
 D.map(function(p){var en=p.cards.filter(function(c){return c.titulo==='Energia';})[0];var il=p.cards.filter(function(c){return c.titulo==='Iluminação';})[0];return '<tr><td><b>'+p.id+'</b></td><td>'+p.score+'</td><td>'+(p.semChecklist?'—':p.base+'%')+'</td><td>'+p.penalidades.length+'</td><td>'+(en?en.valor:'—')+'</td><td>'+(il?il.valor+' deficientes':'—')+'</td></tr>';}).join('')+'</tbody></table></div></section>';}
function projeto(p){return '<div class="trilha"><a tabindex="0" data-voltar>'+GRUPO+'</a> › '+p.id+'</div><div class="cab"><div><h1>'+p.id+' · '+p.nome+'</h1><p class="sub">'+p.score+' de 100'+(p.penalidades.length?' · '+p.penalidades.length+(p.penalidades.length===1?' pendência desconta':' pendências descontam')+' a pontuação':' · sem pendências que descontem a pontuação')+'.</p></div>'+
 (p.spark?'<div>'+p.spark+'<div style="font-size:12px;color:var(--mu)">checklist nas últimas '+p.tendencia.length+' semanas</div></div>':'')+'</div>'+
 '<div class="cadeia">'+p.cards.map(function(c){return '<div class="mod '+c.nivel+'"><span class="t">'+c.titulo+'</span><span class="v">'+c.valor+'</span><span class="d">'+c.texto+'</span><span class="e">'+c.efeito+'</span></div>';}).join('')+'</div>'+
 '<p class="fut">Não incluídos nesta versão: '+FUT.join(', ')+'.</p>';}
function render(){app.innerHTML=est?projeto(D.filter(function(p){return p.id===est;})[0]):grupo();
 Array.prototype.forEach.call(app.querySelectorAll('[data-p]'),function(b){b.onclick=function(){est=b.getAttribute('data-p');render();window.scrollTo(0,0);};});
 Array.prototype.forEach.call(app.querySelectorAll('[data-voltar]'),function(a){a.onclick=function(){est=null;render();};a.onkeydown=function(e){if(e.key==='Enter')a.onclick();};});}
render();
</script></body></html>`;
}
