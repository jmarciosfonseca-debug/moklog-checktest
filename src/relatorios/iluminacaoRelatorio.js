// Relatório de Iluminação — padrão Moked (aprovado em 04/10/2026).
// Visual + texto: KPIs; mapa do projeto com os quadrantes desenhados E marcadores sobre cada quadrante
// (quantos pontos deficientes e % operante, na cor da faixa); gráfico "pontos que requerem atenção";
// análise escrita a partir dos números; plano de ação por prioridade; tabela por quadrante.
// O mapa é EMBUTIDO no arquivo como data URL, para aparecer também fora do app (WhatsApp, e-mail).
import { documentoMoked, escHTML, dataBR, num1 } from "./padraoMoked";
import { posicoesDoProjeto, posicaoQuadrante } from "./mapaQuadrantes";

// Faixas (mesmo critério do gráfico, dos marcadores e da tabela):
//   ≥ 95% operante → ok (grafite) · 85–95% → atenção (âmbar) · < 85% → crítico (vermelho)
export const FAIXA_OK = 95, FAIXA_ATENCAO = 85;
const COR = { ok: "#374151", wa: "#D97706", da: "#B91C1C", in: "#1D4ED8" };
const ROTULO = { ok: "adequado", wa: "atenção", da: "crítico", in: "não aferido" };
const faixa = (pct) => (pct >= FAIXA_OK ? "ok" : pct >= FAIXA_ATENCAO ? "wa" : "da");

const calcQuad = (q) => {
  const total = Number(q?.total) || 0;
  const def = q?.deficientes == null || q?.deficientes === "" ? null : Math.min(total, Number(q.deficientes) || 0);
  const ops = def == null ? total : total - def;
  const pct = total ? Math.round((ops / total) * 1000) / 10 : 0;
  return { total, def, ops, pct, faixa: def == null ? "in" : faixa(pct) };
};

export function analisarIluminacao(data) {
  const qs = (data?.quadrantes || []).map((q) => ({ nome: q.nome || "—", atualizadoEm: q.atualizadoEm || null, ...calcQuad(q) }));
  const aferidos = qs.filter((q) => q.def != null);
  const total = qs.reduce((a, q) => a + q.total, 0);
  const def = aferidos.reduce((a, q) => a + q.def, 0);
  const pct = total ? Math.round(((total - def) / total) * 1000) / 10 : 0;
  const ult = data?.testeQuinzenal?.ultimoRegistro || null;
  const dataUlt = ult?.data || null;
  const desatualizados = dataUlt ? qs.filter((q) => q.atualizadoEm && String(q.atualizadoEm).slice(0, 10) < dataUlt) : [];
  // Prioridade: mais pontos deficientes primeiro; empate → menor % operante.
  const atencao = [...aferidos].filter((q) => q.def > 0).sort((a, b) => b.def - a.def || a.pct - b.pct);
  const criticos = aferidos.filter((q) => q.faixa === "da");
  const emAtencao = aferidos.filter((q) => q.faixa === "wa");
  return {
    qs, total, def, ops: total - def, pct, faixaGeral: faixa(pct),
    naoAferidos: qs.filter((q) => q.def == null),
    zerados: aferidos.filter((q) => q.total > 0 && q.pct === 0),
    atencao, criticos, emAtencao, desatualizados,
    concentracao: def ? Math.round((atencao[0]?.def || 0) / def * 100) : 0, // % das falhas no pior quadrante
    ultimoTeste: dataUlt, assinadoPor: ult?.assinadoPor || null,
    proximoAlvo: data?.testeQuinzenal?.alvo || null,
    baseEm: data?.quadrantes?.map((q) => q.atualizadoEm).filter(Boolean).sort().pop() || null,
  };
}

// Marcadores sobre o mapa: um por quadrante aferido, na posição do rótulo (mapaQuadrantes.js).
function marcadoresMapa(project, data, a) {
  const pos = posicoesDoProjeto(project?.id, data?.mapa?.posicoes);
  const itens = a.qs.map((q) => ({ q, p: posicaoQuadrante(pos, q.nome) })).filter((x) => x.p);
  if (!itens.length) return { html: "", semPosicao: a.qs.length > 0 };
  const html = itens.map(({ q, p }) => {
    const cor = COR[q.faixa];
    const txt = q.def == null ? "não aferido" : `${q.def} def. · ${num1(q.pct)}%`;
    const prio = a.atencao.findIndex((x) => x.nome === q.nome);
    const rank = prio >= 0 && prio < 3 && q.faixa !== "ok" ? `<span class="il-rk">${prio + 1}</span>` : "";
    return `<div class="il-mk il-${q.faixa}" style="left:${p[0]}%;top:${p[1]}%"><span class="il-pin" style="background:${cor}"></span><span class="il-tag" style="border-color:${cor}">${rank}<b>${escHTML(q.nome)}</b> ${txt}</span></div>`;
  }).join("");
  return { html, semPosicao: false };
}

// Gráfico de barras (HTML/CSS, imprime igual em qualquer navegador): pontos deficientes por quadrante.
// Compacto de propósito: cabe ao lado do mapa (retrato) ou em largura total (paisagem).
function graficoAtencao(a, { lado = false } = {}) {
  const itens = a.atencao;
  if (!itens.length) return `<div class="mk-vazio" style="margin:0"><div class="mk-big" style="font-size:22pt">0</div><div class="mk-kl">pontos deficientes</div></div>`;
  const mx = Math.max(1, ...itens.map((q) => q.def));
  const linhas = itens.map((q, i) => `<div class="il-gr"><span class="il-gq">${i < 3 ? `<span class="il-rk">${i + 1}</span>` : ""}<b>${escHTML(q.nome)}</b></span>
    <span class="il-gt"><span style="width:${(q.def / mx * 100).toFixed(1)}%;background:${COR[q.faixa]}"></span></span>
    <span class="il-gv"><b>${q.def}</b><span class="mk-mu"> / ${q.total}</span></span><span class="mk-b mk-b-${q.faixa}">${num1(q.pct)}%</span></div>`).join("");
  return `<div class="il-graf${lado ? " il-graf-lado" : ""}"><div class="mk-h2" style="margin-top:0">Pontos que requerem atenção</div><div class="mk-mu mk-sm" style="margin:-4px 0 6px">Pontos deficientes por quadrante (deficientes / total), do maior para o menor. ①–③ = ordem de prioridade.</div>${linhas}</div>`;
}

// Histórico de aferições: testes quinzenais assinados (testeQuinzenal.registros, com a foto dos números),
// o último registro legado (só data e assinatura) e os testes v2/v3 (history) — mais recente primeiro.
export function historicoAfericoes(data) {
  const del = new Set(data?.deletedIds || []);
  const regs = [];
  const n = (v) => (v == null || v === "" ? null : Number(v));
  for (const r of data?.testeQuinzenal?.registros || []) {
    if (!r?.data) continue;
    regs.push({ data: String(r.data).slice(0, 10), por: r.assinadoPor || null, total: n(r.total), def: n(r.deficientes), ts: r.ts || null, origem: "quinzenal" });
  }
  const u = data?.testeQuinzenal?.ultimoRegistro;
  if (u?.data && !regs.some((r) => r.data === String(u.data).slice(0, 10))) regs.push({ data: String(u.data).slice(0, 10), por: u.assinadoPor || null, total: n(u.total), def: n(u.deficientes), ts: u.ts || null, origem: "quinzenal" });
  for (const h of data?.history || []) {
    if (!h || del.has(h.id)) continue;
    const d = String(h.date || h.criadoEm || "").slice(0, 10);
    if (!d || regs.some((r) => r.data === d)) continue;
    const quads = h.quads || [];
    const total = quads.reduce((a, q) => a + (Number(q.total) || 0), 0);
    const def = quads.reduce((a, q) => a + (q.inoperantes != null ? Number(q.inoperantes) || 0 : q.acesas != null ? Math.max(0, (Number(q.total) || 0) - (Number(q.acesas) || 0)) : 0), 0);
    regs.push({ data: d, por: h.assinadoPor || h.responsavel || h.autor || h.por || null, total: total || null, def: total ? def : null, ts: h.criadoEm || null, origem: "legado" });
  }
  regs.sort((a, b) => b.data.localeCompare(a.data) || String(b.ts || "").localeCompare(String(a.ts || "")));
  return regs.map((r) => ({ ...r, pct: r.total && r.def != null ? Math.round(((r.total - r.def) / r.total) * 1000) / 10 : null }));
}

// Seção "Aferições": quem assinou, quando e com que resultado — pelo menos os 3 últimos testes (até 6).
function secaoAfericoes(hist, a) {
  const linhas = hist.slice(0, 6);
  if (!linhas.length) return `<section><div class="mk-h2">Aferições <span class="mk-mu">· testes quinzenais assinados</span></div><div class="mk-dest">Nenhum teste quinzenal concluído e assinado no app até a emissão. A partir do primeiro "Concluir teste realizado", este quadro passa a listar data, responsável e resultado de cada aferição (mínimo das 3 últimas).</div></section>`;
  const tr = linhas.map((r, i) => {
    const ant = linhas[i + 1];
    const delta = r.pct != null && ant?.pct != null ? Math.round((r.pct - ant.pct) * 10) / 10 : null;
    const varTxt = delta == null ? '<span class="mk-nao">—</span>' : delta === 0 ? "estável" : `<span class="${delta > 0 ? "mk-ok" : "mk-da"}" style="font-weight:700">${delta > 0 ? "▲ +" : "▼ "}${num1(delta)} pp</span>`;
    const f = r.pct == null ? "in" : faixa(r.pct);
    return `<tr><td><b>${dataBR(r.data)}</b>${i === 0 ? ' <span class="mk-b mk-b-ok" style="margin-left:4px">atual</span>' : ""}</td><td>${r.por ? escHTML(r.por) : '<span class="mk-nao">sem assinatura</span>'}</td>
      <td class="mk-num">${r.total ?? '<span class="mk-nao">—</span>'}</td><td class="mk-num">${r.def ?? '<span class="mk-nao">—</span>'}</td>
      <td>${r.pct == null ? '<span class="mk-nao">—</span>' : `<div style="display:flex;align-items:center;gap:6px"><span style="flex:1;height:7px;background:#EEF0F3;border-radius:4px;overflow:hidden"><span style="display:block;height:100%;width:${r.pct}%;background:${COR[f]}"></span></span><span class="mk-b mk-b-${f}">${num1(r.pct)}%</span></div>`}</td>
      <td class="mk-num">${varTxt}</td></tr>`;
  }).join("");
  const nota = hist.length < 3
    ? `<div class="mk-nota">${hist.length === 1 ? "Há 1 aferição registrada" : `Há ${hist.length} aferições registradas`}; o quadro passa a mostrar as 3 últimas conforme os testes quinzenais forem concluídos e assinados no app (ciclo de 14 dias, domingo 21h).</div>`
    : `<div class="mk-nota">Cada linha é um teste quinzenal concluído e assinado no app, com os números no momento da assinatura. Variação = pontos percentuais em relação à aferição anterior.</div>`;
  return `<section class="il-afer"><div class="mk-h2">Aferições <span class="mk-mu">· quem aferiu, quando e o resultado (${hist.length >= 6 ? "6 últimas" : hist.length === 1 ? "1 registrada" : hist.length + " últimas"})</span></div>
  <table class="mk-tb"><colgroup><col style="width:17%"><col style="width:27%"><col style="width:9%"><col style="width:12%"><col style="width:23%"><col style="width:12%"></colgroup>
  <thead><tr><th>Data</th><th>Aferido / assinado por</th><th class="mk-num">Pontos</th><th class="mk-num">Deficientes</th><th>% operante</th><th class="mk-num">Variação</th></tr></thead><tbody>${tr}</tbody></table>${nota}</section>`;
}

function planoAcao(a) {
  const itens = a.atencao.filter((q) => q.faixa !== "ok").slice(0, 5);
  if (!itens.length) return "";
  const prazo = (q) => (q.faixa === "da" ? "até 7 dias" : "até 15 dias");
  const acao = (q) => q.pct === 0 ? "Restabelecer o circuito; até lá, reforçar ronda e cobertura de CFTV no trecho."
    : q.faixa === "da" ? "Abrir chamado de manutenção para os pontos apagados; confirmar reparo no próximo teste quinzenal."
    : "Incluir os pontos na rotina de manutenção; reavaliar no próximo teste quinzenal.";
  const linhas = itens.map((q, i) => `<tr><td class="mk-num"><span class="il-rk">${i + 1}</span></td><td><b>${escHTML(q.nome)}</b></td><td class="mk-num">${q.def} de ${q.total}</td><td><span class="mk-b mk-b-${q.faixa}">${ROTULO[q.faixa]} · ${num1(q.pct)}%</span></td><td>${acao(q)}</td><td>${prazo(q)}</td></tr>`).join("");
  return `<section><div class="mk-h2">Plano de ação sugerido</div><table class="mk-tb"><colgroup><col style="width:5%"><col style="width:12%"><col style="width:11%"><col style="width:17%"><col style="width:41%"><col style="width:14%"></colgroup>
  <thead><tr><th>#</th><th>Quadrante</th><th class="mk-num">Deficientes</th><th>Situação</th><th>Ação</th><th>Prazo</th></tr></thead><tbody>${linhas}</tbody></table></section>`;
}

// mapaDim {w,h} (opcional): com o mapa em retrato (cabe em ~100 mm de altura sem passar de 100 mm de largura),
// o gráfico vai ao lado do mapa; em paisagem, o mapa ocupa a largura e o gráfico vem abaixo.
export const MAPA_ALTURA_MM = 100;
export function montarRelatorioIluminacao(project, data, { mapaDataUrl = null, mapaDim = null, hoje = new Date() } = {}) {
  const a = analisarIluminacao(data);
  const numero = `MK-${project.id}-IL-${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}`;
  const base = a.baseEm || a.ultimoTeste;
  const sub = `<b>${escHTML(project.id)} — ${escHTML(project.name || "")}</b> · ${a.qs.length} quadrantes · ${a.total} pontos de iluminação${base ? ` · base: levantamento de ${dataBR(base)}` : ""}`;
  const pior = a.atencao[0] || null;

  const kpis = `<section class="mk-kpis">
    <div class="mk-k"><div class="mk-kv ${a.faixaGeral === "da" ? "mk-da" : a.faixaGeral === "wa" ? "mk-wa" : ""}">${num1(a.pct)}%</div><div class="mk-kl">pontos operantes</div><div class="mk-mu mk-sm">${a.ops} de ${a.total} · ${ROTULO[a.faixaGeral]}</div></div>
    <div class="mk-k"><div class="mk-kv ${a.def ? "mk-da" : ""}">${a.def}</div><div class="mk-kl">pontos deficientes</div><div class="mk-mu mk-sm">em ${a.atencao.length} de ${a.qs.length} quadrantes</div></div>
    <div class="mk-k"><div class="mk-kv ${pior ? (pior.faixa === "da" ? "mk-da" : pior.faixa === "wa" ? "mk-wa" : "") : ""}">${pior ? escHTML(pior.nome) : "—"}</div><div class="mk-kl">quadrante prioritário</div><div class="mk-mu mk-sm">${pior ? `${pior.def} deficientes · ${num1(pior.pct)}% operante` : "sem pontos deficientes"}</div></div>
    <div class="mk-k"><div class="mk-kv">${a.ultimoTeste ? dataBR(a.ultimoTeste) : "—"}</div><div class="mk-kl">último teste quinzenal</div><div class="mk-mu mk-sm">${a.assinadoPor ? "assinado por " + escHTML(a.assinadoPor) : a.proximoAlvo ? "próximo " + dataBR(a.proximoAlvo) : "sem assinatura registrada"}</div></div></section>`;

  const legenda = `<div class="il-leg"><span><i style="background:${COR.da}"></i>crítico (&lt; ${FAIXA_ATENCAO}%)</span><span><i style="background:${COR.wa}"></i>atenção (${FAIXA_ATENCAO}–${FAIXA_OK}%)</span><span><i style="background:${COR.ok}"></i>adequado (≥ ${FAIXA_OK}%)</span><span><i style="background:${COR.in}"></i>não aferido</span><span><span class="il-rk">1</span>prioridade</span></div>`;
  let mapa;
  if (mapaDataUrl) {
    const m = marcadoresMapa(project, data, a);
    const larguraMm = mapaDim?.w && mapaDim?.h ? MAPA_ALTURA_MM * mapaDim.w / mapaDim.h : null;
    const lado = larguraMm != null && larguraMm <= 100; // retrato: mapa à esquerda (100 mm de altura), gráfico à direita
    const legendaTxt = m.semPosicao
      ? "Posição dos quadrantes ainda não cadastrada para este projeto: os marcadores aparecem quando a posição for configurada (Teste de Iluminação → Configuração)."
      : "Cada marcador mostra o quadrante, os pontos deficientes e o % operante; a cor segue a faixa da tabela.";
    const img = `<div class="il-map${lado ? " il-map-lado" : ""}"><img src="${mapaDataUrl}" alt="Mapa de quadrantes ${escHTML(project.id)}">${m.html}</div>`;
    mapa = lado
      ? `<section class="mk-card il-fig"><div class="mk-lb" style="margin-bottom:6px">Mapa do projeto, divisão por quadrante e pontos deficientes</div>
         <div class="il-duo"><div>${img}</div><div>${graficoAtencao(a, { lado: true })}${legenda}<div class="mk-mu mk-sm" style="margin-top:4px">${legendaTxt}</div></div></div></section>`
      : `<section class="mk-card il-fig"><div class="mk-lb" style="margin-bottom:6px">Mapa do projeto, divisão por quadrante e pontos deficientes</div>
         <div class="il-wrap">${img}</div>${legenda}<div class="mk-mu mk-sm" style="margin-top:2px">${legendaTxt}</div></section>
         <section class="mk-card il-card">${graficoAtencao(a)}</section>`;
  } else {
    mapa = `<div class="mk-dest"><b>Mapa não configurado.</b> Cadastre a imagem com os quadrantes em Teste de Iluminação → Configuração.</div><section class="mk-card il-card">${graficoAtencao(a)}</section>`;
  }

  const hist = historicoAfericoes(data);
  const dest = [];
  if (a.qs.length && !a.atencao.length) dest.push(`<li>Nenhum ponto deficiente nos quadrantes aferidos.</li>`);
  if (pior) dest.push(`<li><b>${escHTML(pior.nome)}</b> concentra <b>${pior.def} dos ${a.def}</b> pontos deficientes (${a.concentracao}% do total) e opera com ${num1(pior.pct)}%: é o quadrante prioritário.</li>`);
  if (a.criticos.length) dest.push(`<li><b>Abaixo de ${FAIXA_ATENCAO}% operante</b> (crítico): ${a.criticos.map((q) => `${escHTML(q.nome)} (${num1(q.pct)}%)`).join(", ")}.</li>`);
  if (a.emAtencao.length) dest.push(`<li><b>Entre ${FAIXA_ATENCAO}% e ${FAIXA_OK}%</b> (atenção): ${a.emAtencao.map((q) => `${escHTML(q.nome)} (${num1(q.pct)}%)`).join(", ")}.</li>`);
  if (a.zerados.length) dest.push(`<li><b>Sem iluminação operante:</b> ${a.zerados.map((q) => escHTML(q.nome)).join(", ")}. Risco de ponto cego para CFTV e ronda.</li>`);
  if (a.naoAferidos.length) dest.push(`<li><b>Não aferidos</b> (sem número de deficientes): ${a.naoAferidos.map((q) => escHTML(q.nome)).join(", ")}. Entram no total, mas não no percentual.</li>`);
  if (a.desatualizados.length) dest.push(`<li><b>${a.desatualizados.length} quadrante(s)</b> sem atualização desde o último teste quinzenal (${dataBR(a.ultimoTeste)}): ${a.desatualizados.slice(0, 6).map((q) => `${escHTML(q.nome)} (${dataBR(String(q.atualizadoEm).slice(0, 10))})`).join(", ")}${a.desatualizados.length > 6 ? "…" : ""}.</li>`);
  if (hist.length >= 2 && hist[0].pct != null && hist[1].pct != null) {
    const d = Math.round((hist[0].pct - hist[1].pct) * 10) / 10;
    dest.push(`<li><b>Evolução:</b> ${d === 0 ? "sem variação" : (d > 0 ? "melhora de " : "piora de ") + num1(Math.abs(d)) + " pp"} entre a aferição de ${dataBR(hist[1].data)} (${num1(hist[1].pct)}%) e a de ${dataBR(hist[0].data)} (${num1(hist[0].pct)}%)${hist[0].por ? `, assinada por ${escHTML(hist[0].por)}` : ""}.</li>`);
  }
  if (a.total && a.faixaGeral !== "ok") dest.push(`<li>Para o projeto voltar à faixa adequada (≥ ${FAIXA_OK}%), é preciso reparar pelo menos <b>${Math.max(0, Math.ceil(a.total * FAIXA_OK / 100) - a.ops)}</b> dos ${a.def} pontos deficientes.</li>`);
  const destaques = dest.length ? `<section class="mk-dest"><div class="mk-h2">Análise</div><ul>${dest.join("")}</ul></section>` : "";

  const linhas = a.qs.map((q) => `<tr><td><b>${escHTML(q.nome)}</b>${q.atualizadoEm ? `<div class="mk-mu">atualizado ${dataBR(String(q.atualizadoEm).slice(0, 10))}</div>` : ""}</td>
      <td class="mk-num">${q.total}</td><td class="mk-num">${q.def == null ? '<span class="mk-nao">—</span>' : q.def}</td><td class="mk-num">${q.ops}</td>
      <td><div style="display:flex;align-items:center;gap:6px"><span style="flex:1;height:7px;background:#EEF0F3;border-radius:4px;overflow:hidden"><span style="display:block;height:100%;width:${q.def == null ? 0 : q.pct}%;background:${COR[q.faixa]}"></span></span>
      <span class="mk-b mk-b-${q.faixa}">${q.def == null ? "não aferido" : num1(q.pct) + "%"}</span></div></td></tr>`).join("");
  const tabela = a.qs.length
    ? `<section><div class="mk-h2">Pontos por quadrante</div><table class="mk-tb"><colgroup><col style="width:30%"><col style="width:11%"><col style="width:13%"><col style="width:12%"><col style="width:34%"></colgroup>
      <thead><tr><th>Quadrante</th><th class="mk-num">Pontos</th><th class="mk-num">Deficientes</th><th class="mk-num">Operantes</th><th>% operante</th></tr></thead>
      <tbody>${linhas}<tr class="il-tot"><td><b>Total</b></td><td class="mk-num"><b>${a.total}</b></td><td class="mk-num"><b>${a.def}</b></td><td class="mk-num"><b>${a.ops}</b></td><td><span class="mk-b mk-b-${a.faixaGeral}">${num1(a.pct)}%</span></td></tr></tbody></table></section>`
    : `<div class="mk-vazio"><div class="mk-big">0</div><div class="mk-kl">quadrantes cadastrados</div></div>`;

  const css = `<style>
.il-fig{margin:0 0 10px;padding:8px 10px;page-break-inside:avoid}.il-wrap{text-align:center}
.il-map{position:relative;display:inline-block;max-width:100%;text-align:left;line-height:0}.il-map img{max-width:100%;max-height:${MAPA_ALTURA_MM - 5}mm;width:auto;height:auto;border:1px solid #D1D5DB;border-radius:4px;display:block;image-rendering:auto}
.il-map-lado img{height:${MAPA_ALTURA_MM}mm;max-height:none}
.il-duo{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start}
.il-mk{position:absolute;transform:translate(-50%,-100%);margin-top:-3px;display:flex;flex-direction:column;align-items:center;white-space:nowrap;line-height:1.3}
.il-pin{width:11px;height:11px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.4);order:2}
.il-tag{order:1;background:rgba(255,255,255,.97);border:1.5px solid;border-radius:4px;padding:1px 5px;font-size:7.8pt;color:#111827;margin-bottom:2px;box-shadow:0 1px 2px rgba(0,0,0,.3)}
.il-da .il-tag{background:#FEE2E2}.il-wa .il-tag{background:#FEF3C7}.il-in .il-tag{background:#EFF6FF}
.il-rk{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:50%;background:#111827;color:#fff;font-size:7pt;font-weight:700;margin-right:3px;vertical-align:middle;line-height:1}
.il-leg{display:flex;gap:10px;flex-wrap:wrap;font-size:7.8pt;color:#374151;margin:6px 0 0}.il-leg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:-1px}
.il-card{margin-bottom:10px;page-break-inside:avoid}.il-graf{page-break-inside:avoid}
.il-gr{display:grid;grid-template-columns:52px 1fr 48px 52px;gap:7px;align-items:center;font-size:8.8pt;margin:4px 0}.il-gq{white-space:nowrap}
.il-gt{height:12px;background:#F3F4F6;border-radius:2px;overflow:hidden;display:block}.il-gt span{display:block;height:12px;border-radius:2px}.il-gv{text-align:right;white-space:nowrap}
.il-graf-lado .il-gr{grid-template-columns:48px 1fr 44px 50px;font-size:8.6pt}
.il-tot td{border-top:1.5px solid #111827;border-bottom:none}.il-afer{page-break-inside:avoid}
@media screen and (max-width:640px){.il-duo{grid-template-columns:1fr}.il-map-lado img{height:auto;max-height:${MAPA_ALTURA_MM}mm;max-width:100%}.il-wrap,.il-duo>div:first-child{text-align:center}}
.il-tag,.il-pin,.il-rk,.il-gt span,.il-leg i,.il-da .il-tag,.il-wa .il-tag,.il-in .il-tag{-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style>`;

  return documentoMoked({ project, titulo: "Relatório de Iluminação", subtitulo: sub, numero, hoje, corpo: css + kpis + mapa + destaques + secaoAfericoes(hist, a) + planoAcao(a), fecho: tabela });
}

// Carrega o mapa (URL do próprio app) como data URL + dimensões. Os bytes originais são mantidos (sem recompressão).
export async function carregarMapa(url) {
  const dataUrl = await mapaParaDataUrl(url);
  if (!dataUrl) return null;
  const dim = await new Promise((ok) => {
    try { const im = new Image(); im.onload = () => ok({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => ok(null); im.src = dataUrl; }
    catch (e) { ok(null); }
  });
  return { dataUrl, dim };
}

// Converte a imagem do mapa (URL do próprio app) em data URL, para embutir no arquivo.
export async function mapaParaDataUrl(url) {
  if (!url) return null;
  try {
    const r = await fetch(url, { cache: "force-cache" });
    if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(null); fr.readAsDataURL(b); });
  } catch (e) { return null; }
}
