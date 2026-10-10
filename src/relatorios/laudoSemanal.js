// Laudo Técnico Semanal (Relatório Semanal de Operacionalidade) — padrão Moked.
// Substitui o layout antigo (serifado, com cor do cliente) mantendo TODO o conteúdo: saúde, visão geral dos
// ativos (rosca), onde estão as falhas, disponibilidade por sistema, pendências com tratativas, energia,
// CTMK, dados da execução do teste. Métricas pela fonte única (relatorios/metricas.js), igual ao consolidado.
import { documentoMoked, escHTML, dataBR, num1, horaBR } from "./padraoMoked";
import { itensDoEstado, resumo, porCategoria, falhasPorSistema, diasEntre, DIAS_FOLLOWUP_VENCIDO } from "./metricas";
import { canonicalFollowupKey } from "../followups";

const COR = { ok: "#374151", wa: "#D97706", da: "#B91C1C" };
const faixa = (pct) => (pct >= 95 ? "ok" : pct >= 85 ? "wa" : "da");
const FU_ROTULO = { aguardando: "Aguardando retorno", proposta: "Proposta enviada", aprovado: "Aprovado", execucao: "Em execução", resolvido: "Resolvido" };
const FU_CLASSE = { aguardando: "wa", proposta: "in", aprovado: "in", execucao: "wa", resolvido: "ok" };
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// "S1 Outubro": semana do mês contada a partir do primeiro domingo (mesma regra do app).
export function rotuloSemana(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "";
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  while (first.getDay() !== 0) first.setDate(first.getDate() + 1);
  const diff = d.getDate() - first.getDate();
  const semana = diff < 0 ? 1 : Math.min(Math.floor(diff / 7) + 1, 5);
  return `S${semana} ${MESES[d.getMonth()]}`;
}

export function numeroLaudo(project, meta) {
  if (meta?.docNum) return meta.docNum;
  const d = meta?.date ? String(meta.date).replace(/-/g, "") : "0000";
  return `MK-${project.id}-RS-${d.slice(-4)}`;
}

// Pendências (itens em falha) com aging e tratativas ativas do follow-up.
export function pendenciasDoLaudo(project, itens, followupsInfo, hoje = new Date()) {
  const fu = followupsInfo || {};
  return itens.filter((x) => x.status !== "ok").map((x) => {
    const itemFu = x.unico ? "—" : x.item;
    const reg = fu[canonicalFollowupKey(project.id, x.cat, itemFu)] || fu[canonicalFollowupKey(project.id, x.cat, x.item)];
    let trat = null;
    if (reg && !reg.resolvido) {
      const entries = Array.isArray(reg.entries) ? reg.entries : Array.isArray(reg.registros) ? reg.registros : [];
      if (entries.length || reg.statusAtual) trat = { statusAtual: reg.statusAtual || "aguardando", entries };
    }
    return { ...x, dias: diasEntre(x.since, hoje), trat };
  }).sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
}

export function montarLaudoSemanal(project, state, meta, { ctmkInfo = null, energiaInfo = null, followupsInfo = null, hoje = new Date() } = {}) {
  const itens = itensDoEstado(project, state);
  const r = resumo(itens);
  const saude = Math.round(r.saude * 10) / 10;
  const fx = faixa(saude);
  // Sistemas com falha primeiro (mais falhas no topo), depois os 100% na ordem do projeto — mesma leitura do
  // "Onde estão as falhas" aprovado em 04/10/2026.
  const cats = porCategoria(itens).map((c, i) => ({ ...c, _i: i, _f: c.inop + c.parcial })).sort((a, b) => b._f - a._f || b.inop - a.inop || a._i - b._i);
  const fs = falhasPorSistema(itens);
  const pend = pendenciasDoLaudo(project, itens, followupsInfo, hoje);
  const maiorAging = pend.reduce((m, p) => Math.max(m, p.dias ?? 0), 0);
  const maior = pend.find((p) => p.dias != null);
  const semTrat = pend.filter((p) => !p.trat).length;
  const numero = numeroLaudo(project, meta);
  const semana = rotuloSemana(meta?.date);
  const sub = `<b>${escHTML(project.id)} — ${escHTML(project.name || "")}</b> · ${escHTML(semana)} · teste de ${dataBR(meta?.date)} · Sistemas eletrônicos de segurança patrimonial`;

  // ── Hero: saúde + rosca dos ativos (aprovado em 04/10/2026)
  const C = 2 * Math.PI * 56, seg = (q) => (r.total ? (q / r.total) * C : 0), pctTxt = (q) => (r.total ? num1((q / r.total) * 100) : "0,0");
  const rosca = `<svg viewBox="0 0 160 160" width="118" height="118" role="img" aria-label="${r.total} ativos: ${r.ok} operacionais, ${r.parcial} parciais, ${r.inop} inoperantes">
    <g transform="rotate(-90 80 80)" fill="none" stroke-width="18"><circle cx="80" cy="80" r="56" stroke="#E5E7EB"/>
    <circle cx="80" cy="80" r="56" stroke="#9CA3AF" stroke-dasharray="${seg(r.ok).toFixed(1)} ${C.toFixed(1)}"/>
    <circle cx="80" cy="80" r="56" stroke="#D97706" stroke-dasharray="${seg(r.parcial).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-seg(r.ok)).toFixed(1)}"/>
    <circle cx="80" cy="80" r="56" stroke="#B91C1C" stroke-dasharray="${seg(r.inop).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-(seg(r.ok) + seg(r.parcial))).toFixed(1)}"/></g>
    <text x="80" y="78" text-anchor="middle" font-size="26" font-weight="700" fill="#111827" font-family="Calibri,Carlito,Arial,sans-serif">${r.total}</text><text x="80" y="97" text-anchor="middle" font-size="11" fill="#6B7280" font-family="Calibri,Carlito,Arial,sans-serif">ativos</text></svg>`;
  const legenda = `<div class="ls-leg"><div><i style="background:#9CA3AF"></i>Operacional <b>${r.ok}</b> <span>(${pctTxt(r.ok)}%)</span></div><div><i style="background:#D97706"></i>Parcial <b>${r.parcial}</b> <span>(${pctTxt(r.parcial)}%)</span></div><div><i style="background:#B91C1C"></i>Inoperante <b>${r.inop}</b> <span>(${pctTxt(r.inop)}%)</span></div></div>`;
  const hero = `<section class="mk-hero"><div><div class="mk-lb">Saúde geral na semana (${escHTML(semana)})</div><div class="mk-big ${fx === "da" ? "mk-da" : fx === "wa" ? "mk-wa" : ""}">${num1(saude)}%</div>
    <div class="mk-mu mk-sm">${r.total} ativos testados · ${r.inop} inoperante${r.inop === 1 ? "" : "s"} · ${r.parcial} parcia${r.parcial === 1 ? "l" : "is"}</div>
    ${ctmkInfo ? `<div class="mk-sm" style="margin-top:6px">CTMK: ${ctmkInfo.status === "offline" ? `<span class="mk-b mk-b-da">OFF${ctmkInfo.days != null ? ` · ${ctmkInfo.days} d` : ""}</span>` : '<span class="mk-b mk-b-ok">ON</span>'}</div>` : ""}</div>
    <div><div class="mk-lb">Visão geral dos ativos</div><div class="ls-vg">${rosca}${legenda}</div></div></section>`;

  const kpis = `<section class="mk-kpis">
    <div class="mk-k"><div class="mk-kv">${r.total}</div><div class="mk-kl">ativos testados</div><div class="mk-mu mk-sm">${cats.length} sistemas</div></div>
    <div class="mk-k"><div class="mk-kv ${pend.length ? "mk-da" : ""}">${pend.length}</div><div class="mk-kl">pendências</div><div class="mk-mu mk-sm">${r.inop} inoperantes · ${r.parcial} parciais</div></div>
    <div class="mk-k"><div class="mk-kv ${maiorAging > 0 ? "mk-da" : ""}">${maiorAging ? maiorAging + " d" : "—"}</div><div class="mk-kl">maior tempo em aberto</div><div class="mk-mu mk-sm">${maior ? escHTML(maior.unico ? maior.cat : maior.item) : "sem pendências"}</div></div>
    <div class="mk-k"><div class="mk-kv ${pend.length && semTrat ? "mk-wa" : ""}">${pend.length ? `${pend.length - semTrat} de ${pend.length}` : "—"}</div><div class="mk-kl">com tratativa registrada</div><div class="mk-mu mk-sm">${pend.length ? `${semTrat} sem tratativa` : ""}</div></div></section>
  <div class="mk-nota" style="margin:-4px 0 10px">Cada dispositivo é testado individualmente e registrado em tempo real pelo líder no MokLog CheckTest. Status: 0% = inoperante · 1–99% = parcial · 100% = operacional. Saúde = (operacionais + 0,5 × parciais) ÷ ativos testados; cada câmera do CFTV conta como um ativo.</div>`;

  // ── Disponibilidade por sistema (tabela com barra) + onde estão as falhas
  const mx = Math.max(1, ...fs.map((f) => f.inop + f.parcial));
  const linhasCat = cats.map((c) => {
    const s = Math.round(c.saude * 10) / 10, f = faixa(s);
    const falhas = fs.find((x) => x.cat === c.cat);
    return `<tr><td><b>${escHTML(c.cat)}</b></td><td class="mk-num">${c.ok}/${c.total}</td>
      <td>${falhas ? `<div class="ls-fb"><span class="ls-ft">${falhas.inop ? `<span style="background:#B91C1C;width:${((falhas.inop / mx) * 100).toFixed(1)}%"></span>` : ""}${falhas.parcial ? `<span style="background:#D97706;width:${((falhas.parcial / mx) * 100).toFixed(1)}%"></span>` : ""}</span><span class="mk-sm">${falhas.inop ? `<b class="mk-da">${falhas.inop}</b> inop.` : ""}${falhas.inop && falhas.parcial ? " · " : ""}${falhas.parcial ? `<b class="mk-wa">${falhas.parcial}</b> parc.` : ""}</span></div>` : '<span class="mk-nao">—</span>'}</td>
      <td><div style="display:flex;align-items:center;gap:6px"><span style="flex:1;height:7px;background:#EEF0F3;border-radius:4px;overflow:hidden"><span style="display:block;height:100%;width:${s}%;background:${COR[f]}"></span></span><span class="mk-b mk-b-${f}">${num1(s)}%</span></div></td></tr>`;
  }).join("");
  const disponibilidade = cats.length
    ? `<section><div class="mk-h2">Disponibilidade por sistema <span class="mk-mu">· ${cats.length} sistemas · ${fs.length ? `falhas em ${fs.length}, listados primeiro` : "nenhuma falha"}</span></div>
      <table class="mk-tb"><colgroup><col style="width:34%"><col style="width:12%"><col style="width:26%"><col style="width:28%"></colgroup>
      <thead><tr><th>Sistema</th><th class="mk-num">Operac./total</th><th>Onde estão as falhas</th><th>Saúde</th></tr></thead><tbody>${linhasCat}</tbody></table></section>`
    : `<div class="mk-vazio"><div class="mk-big">0</div><div class="mk-kl">sistemas cadastrados</div></div>`;

  // ── Pendências e tratativas
  const pill = (st) => (st === "partial" ? '<span class="mk-b mk-b-wa">Parcial</span>' : '<span class="mk-b mk-b-da">Inoperante</span>');
  const linhasPend = pend.map((p) => {
    const nome = p.unico ? p.cat : p.item;
    const linha = `<tr><td><b>${escHTML(nome)}</b>${p.unico ? "" : `<div class="mk-mu">${escHTML(p.cat)}</div>`}</td>
      <td>${p.note && p.note !== "--" ? escHTML(p.note) : '<span class="mk-nao">Sem descrição registrada</span>'}</td>
      <td class="mk-num">${p.dias != null ? `<b class="${p.dias > 180 ? "mk-da" : p.dias >= 30 ? "mk-wa" : ""}">${p.dias} d</b>` : '<span class="mk-nao">—</span>'}${p.since ? `<div class="mk-mu">desde ${dataBR(p.since)}</div>` : ""}</td>
      <td>${pill(p.status)}</td>
      <td>${p.trat ? `<span class="mk-b mk-b-${FU_CLASSE[p.trat.entries.length ? p.trat.entries[p.trat.entries.length - 1].status || p.trat.statusAtual : p.trat.statusAtual] || "wa"}">${escHTML(FU_ROTULO[p.trat.entries.length ? p.trat.entries[p.trat.entries.length - 1].status || p.trat.statusAtual : p.trat.statusAtual] || "Aguardando retorno")}</span>` : '<span class="mk-nao">Sem tratativa</span>'}</td></tr>`;
    if (!p.trat || !p.trat.entries.length) return linha;
    const itensTrat = p.trat.entries.map((e) => {
      const st = e.status || p.trat.statusAtual;
      const quando = e.em || e.data || "";
      const d = quando ? new Date(quando) : null;
      const quandoFmt = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR") : "";
      const dias = diasEntre(quando, hoje);
      return `<div class="ls-tr"><span class="mk-b mk-b-${FU_CLASSE[st] || "wa"}">${escHTML(FU_ROTULO[st] || "Aguardando retorno")}</span><span class="mk-mu mk-sm">${quandoFmt}${e.responsavel ? ` · ${escHTML(e.responsavel)}` : ""}${dias != null && dias > DIAS_FOLLOWUP_VENCIDO ? ` · <span class="mk-inv">há ${dias} dias</span>` : ""}</span>${e.texto ? `<div>${escHTML(e.texto)}</div>` : ""}${e.link ? `<div class="mk-sm" style="word-break:break-all">↳ <a href="${escHTML(e.link)}" style="color:#1D4ED8">${escHTML(e.link)}</a></div>` : ""}</div>`;
    }).join("");
    return linha + `<tr class="ls-trl"><td colspan="5"><div class="ls-trw"><div class="mk-lb" style="margin-bottom:4px">Tratativas registradas (${p.trat.entries.length})</div>${itensTrat}</div></td></tr>`;
  }).join("");
  const pendencias = `<section><div class="mk-h2">Pendências e tratativas <span class="mk-mu">· ${pend.length} ${pend.length === 1 ? "item" : "itens"}, por tempo em aberto</span></div>
    ${pend.length ? `<table class="mk-tb"><colgroup><col style="width:24%"><col style="width:30%"><col style="width:12%"><col style="width:13%"><col style="width:21%"></colgroup>
      <thead><tr><th>Dispositivo</th><th>Diagnóstico</th><th class="mk-num">Em aberto</th><th>Status</th><th>Tratativa</th></tr></thead><tbody>${linhasPend}</tbody></table>
      <div class="mk-nota">Itens inoperantes e parciais em ordem decrescente de tempo em aberto. As tratativas vêm do registro de follow-up da gestão Moked; itens resolvidos deixam de ser exibidos. Follow-up há mais de ${DIAS_FOLLOWUP_VENCIDO} dias sem atualização é marcado como vencido.</div>`
    : `<div class="mk-vazio"><div class="mk-big">0</div><div class="mk-kl">pendências</div><div class="mk-mu mk-sm">Todos os dispositivos operacionais nesta verificação.</div></div>`}</section>`;

  // ── Energia (últimos 7 dias)
  let energia = "";
  if (energiaInfo && energiaInfo.quedas > 0) {
    const eh = Math.floor(energiaInfo.tempoTotalMs / 3600000), em = Math.floor((energiaInfo.tempoTotalMs % 3600000) / 60000);
    energia = `<section class="mk-dest"><div class="mk-h2">Ocorrências de energia <span class="mk-mu">· últimos 7 dias</span></div><b>${energiaInfo.quedas}</b> queda${energiaInfo.quedas === 1 ? "" : "s"} de energia registrada${energiaInfo.quedas === 1 ? "" : "s"} · <b>${eh}h ${String(em).padStart(2, "0")}m</b> de indisponibilidade total no período.</section>`;
  }

  // ── Execução do teste (fecho: imprime junto da assinatura)
  const preench = meta?.tempoPreenchimentoSeg ? `${Math.floor(meta.tempoPreenchimentoSeg / 60)} min${meta.tempoPreenchimentoSeg % 60 ? ` ${meta.tempoPreenchimentoSeg % 60} s` : ""}` : "—";
  const abertura = meta?.formAberturaAuto ? `${horaBR(meta.formAberturaAuto)} (automática)` : "—";
  const campo = (l, v, cls = "") => `<div class="ls-i"><div class="mk-lb">${l}</div><div class="${cls}">${v}</div></div>`;
  const execucao = `<section class="mk-bloco"><div class="mk-h2">Execução do teste</div><div class="ls-info">
    ${campo("Líder VSPP", escHTML(meta?.leader || "—"))}${campo("CCO", escHTML(meta?.cco || "—"))}${campo("Operador Moked 24h", escHTML(meta?.moked || "—"))}${campo("Horário", `${escHTML(meta?.start || "—")} – ${escHTML(meta?.end || "—")}`)}
    ${campo("Contato Moked", meta?.mokedContact ? "Realizado" : "Não realizado", meta?.mokedContact ? "mk-sim" : "mk-da")}${campo("Horário do contato", escHTML(meta?.mokedTime || "—"))}${campo("Preenchimento", preench)}${campo("Abertura do formulário", abertura)}
  </div></section>`;

  const css = `<style>
.ls-vg{display:flex;gap:14px;align-items:center}.ls-leg{font-size:8.8pt;color:#374151;display:grid;gap:4px}.ls-leg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}.ls-leg span{color:#6B7280}
.ls-fb{display:flex;align-items:center;gap:6px}.ls-ft{display:flex;gap:2px;flex:1;height:8px}.ls-ft span{display:block;height:8px;border-radius:2px}
.ls-trl td{padding:0 6px 6px;border-bottom:1px solid #EEF0F3}.ls-trw{border-left:2.5px solid #111827;background:#F9FAFB;padding:6px 10px;border-radius:0 6px 6px 0}.ls-tr{margin:3px 0 5px;font-size:8.8pt}.ls-tr .mk-b{margin-right:6px}
.ls-info{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #E5E7EB;border-radius:8px;overflow:hidden}.ls-i{padding:7px 10px;border-right:1px solid #EEF0F3;border-bottom:1px solid #EEF0F3;font-size:9.4pt;font-weight:600}.ls-i:nth-child(4n){border-right:none}.ls-i:nth-last-child(-n+4){border-bottom:none}
.ls-leg i,.ls-ft span,.ls-trw{-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media screen and (max-width:640px){.ls-info{grid-template-columns:1fr 1fr}.ls-i:nth-child(4n){border-right:1px solid #EEF0F3}.ls-i:nth-child(2n){border-right:none}}
</style>`;

  return documentoMoked({ project, titulo: "Relatório Semanal de Operacionalidade", subtitulo: sub, numero, hoje, corpo: css + hero + kpis + disponibilidade + pendencias + energia, fecho: execucao,
    rodape: `${numero} · Laudo Técnico Semanal · ${project.id} ${project.name || ""} · ${semana} · Moked Consulting Security · MokLog CheckTest` });
}
