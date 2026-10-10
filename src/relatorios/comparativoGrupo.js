// Relatório Comparativo Interparques (painel gerencial) — padrão Moked.
// groupData: [{ id, name, weeks:[{date,pct,inop}], chronicItems:[{label,since,days,note}] }], semanas em ordem
// cronológica no recorte escolhido. Conteúdo preservado do layout antigo: ranking por média do período, % atual,
// inoperantes, tendência, situação (destaque/atenção/crítico, sem evolução, mantém excelência), gráfico de
// evolução, itens crônicos (150+ dias) e projetos sem evolução. Sem emojis; cor só onde há exceção.
import { documentoMoked, escHTML, dataBR, num1 } from "./padraoMoked";

export const DIAS_CRONICO = 150;
const SERIES = ["#111827", "#B91C1C", "#D97706", "#1D4ED8", "#0F766E", "#7C3AED", "#DB2777", "#65A30D"];
const tier = (avg) => (avg >= 90 ? { rot: "Destaque positivo", cls: "ok" } : avg >= 70 ? { rot: "Atenção", cls: "wa" } : { rot: "Crítico", cls: "da" });

export function analisarGrupo(groupData) {
  const rows = (groupData || []).map((g, idx) => {
    const weeks = g.weeks || [];
    const n = weeks.length;
    const pcts = weeks.map((w) => Number(w.pct) || 0);
    const avg = n ? Math.round(pcts.reduce((a, b) => a + b, 0) / n) : 0;
    const latest = weeks[n - 1] || { pct: 0, inop: 0, date: null };
    const first = weeks[0] || { pct: latest.pct };
    const delta = (Number(latest.pct) || 0) - (Number(first.pct) || 0);
    const flat = n >= 3 && Math.abs(delta) <= 1;
    return { id: g.id, name: g.name || "", n, avg, latestPct: Number(latest.pct) || 0, latestInop: Number(latest.inop) || 0, latestDate: latest.date || null,
      delta, estagnadoCritico: flat && avg < 90, estagnadoExcelencia: flat && avg >= 90, tier: tier(avg), weeks,
      chronic: (g.chronicItems || []).slice().sort((a, b) => b.days - a.days), cor: SERIES[idx % SERIES.length] };
  }).sort((a, b) => b.avg - a.avg || b.latestPct - a.latestPct);
  const chronic = rows.flatMap((r) => r.chronic.map((c) => ({ ...c, pid: r.id, pname: r.name }))).sort((a, b) => b.days - a.days);
  const mediaGrupo = rows.length ? Math.round(rows.reduce((a, r) => a + r.avg, 0) / rows.length * 10) / 10 : 0;
  return { rows, best: rows[0], worst: rows[rows.length - 1], inopGrupo: rows.reduce((a, r) => a + r.latestInop, 0), chronic,
    estagnados: rows.filter((r) => r.estagnadoCritico), mediaGrupo, abaixoMeta: rows.filter((r) => r.avg < 90) };
}

function graficoEvolucao(rows) {
  const W = 420, H = 150, pl = 30, pr = 10, pt = 12, pb = 26;
  const maxW = Math.max(1, ...rows.map((r) => r.n));
  const step = maxW > 1 ? (W - pl - pr) / (maxW - 1) : 0;
  const xr = (m, i) => (W - pr) - (m - 1 - i) * step;
  // Escala vertical dinâmica (como no consolidado): do piso abaixo do menor valor até 100, grade de 5 em 5.
  const todos = rows.flatMap((r) => r.weeks.map((w) => Number(w.pct) || 0));
  const lo = Math.max(0, Math.floor((Math.min(90, ...todos) - 3) / 5) * 5), hi = 100;
  const y = (p) => pt + ((hi - Math.max(lo, p)) / (hi - lo || 1)) * (H - pt - pb);
  const grade = []; for (let g = lo; g <= hi; g += (hi - lo) > 40 ? 10 : 5) grade.push(g);
  const ref = rows.find((r) => r.n === maxW) || rows[0];
  const eixo = (ref?.weeks || []).map((w, i) => `<text x="${xr(maxW, i).toFixed(1)}" y="${H - pb + 14}" font-size="8" fill="#6B7280" text-anchor="middle">${escHTML(dataBR(w.date).slice(0, 5))}</text>`).join("");
  const series = rows.map((r) => {
    if (r.n < 2) return `<circle cx="${xr(r.n, 0).toFixed(1)}" cy="${y(r.weeks[0]?.pct || 0).toFixed(1)}" r="3.5" fill="${r.cor}"/>`;
    const pts = r.weeks.map((w, i) => `${xr(r.n, i).toFixed(1)},${y(Number(w.pct) || 0).toFixed(1)}`).join(" ");
    return `<polyline points="${pts}" fill="none" stroke="${r.cor}" stroke-width="2" stroke-linejoin="round"/>${r.weeks.map((w, i) => `<circle cx="${xr(r.n, i).toFixed(1)}" cy="${y(Number(w.pct) || 0).toFixed(1)}" r="2.8" fill="#fff" stroke="${r.cor}" stroke-width="1.8"/>`).join("")}`;
  }).join("");
  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:${H}px;display:block" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Evolução semanal da saúde por projeto">
    ${grade.map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#EEF0F3"/><text x="${pl - 5}" y="${(y(v) + 3).toFixed(1)}" font-size="8" fill="#9CA3AF" text-anchor="end">${v}</text>`).join("")}
    <line x1="${pl}" x2="${W - pr}" y1="${y(90).toFixed(1)}" y2="${y(90).toFixed(1)}" stroke="#111827" stroke-dasharray="4 3" stroke-width="1"/><text x="${W - pr}" y="${(y(90) - 4).toFixed(1)}" font-size="8" fill="#111827" font-weight="700" text-anchor="end">meta 90%</text>
    ${series}${eixo}</svg>
    <div class="cg-leg">${rows.map((r) => `<span><i style="background:${r.cor}"></i>${escHTML(r.id)}</span>`).join("")}</div>`;
  return svg;
}

export function montarComparativoGrupo(groupLabel, groupData, periodLabel, { hoje = new Date() } = {}) {
  const a = analisarGrupo(groupData);
  const numero = `MK-${String(groupLabel || "GRUPO").replace(/\s+/g, "").toUpperCase().slice(0, 10)}-CI-${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}`;
  const sub = `<b>Grupo ${escHTML(groupLabel)}</b> · ${a.rows.length} unidade${a.rows.length === 1 ? "" : "s"} avaliada${a.rows.length === 1 ? "" : "s"}${periodLabel ? ` · ${escHTML(periodLabel)}` : ""} · ${a.rows.map((r) => escHTML(r.id)).join(" · ")}`;
  const fxMedia = a.mediaGrupo >= 90 ? "" : a.mediaGrupo >= 70 ? "mk-wa" : "mk-da";

  const hero = `<section class="mk-hero"><div><div class="mk-lb">Média do grupo no período</div><div class="mk-big ${fxMedia}">${num1(a.mediaGrupo)}%</div>
    <div class="mk-mu mk-sm">média simples das unidades · meta 90%</div>
    <div class="mk-sm" style="margin-top:6px">${a.abaixoMeta.length ? `<b class="${a.abaixoMeta.length ? "mk-da" : ""}">${a.abaixoMeta.length}</b> de ${a.rows.length} abaixo da meta: ${a.abaixoMeta.map((r) => escHTML(r.id)).join(", ")}` : "Todas as unidades na meta."}</div></div>
    <div><div class="mk-lb">Evolução semanal da saúde</div>${graficoEvolucao(a.rows)}</div></section>`;

  const kpis = `<section class="mk-kpis">
    <div class="mk-k"><div class="mk-kv">${a.best ? escHTML(a.best.id) : "—"}</div><div class="mk-kl">melhor desempenho</div><div class="mk-mu mk-sm">${a.best ? `${a.best.avg}% no período` : ""}</div></div>
    <div class="mk-k"><div class="mk-kv ${a.worst && a.worst.avg < 90 ? "mk-da" : ""}">${a.worst ? escHTML(a.worst.id) : "—"}</div><div class="mk-kl">requer atenção</div><div class="mk-mu mk-sm">${a.worst ? `${a.worst.avg}% no período` : ""}</div></div>
    <div class="mk-k"><div class="mk-kv ${a.inopGrupo ? "mk-da" : ""}">${a.inopGrupo}</div><div class="mk-kl">inoperantes no grupo</div><div class="mk-mu mk-sm">na semana mais recente</div></div>
    <div class="mk-k"><div class="mk-kv ${a.chronic.length ? "mk-wa" : ""}">${a.chronic.length}</div><div class="mk-kl">itens crônicos</div><div class="mk-mu mk-sm">mais de ${DIAS_CRONICO} dias em aberto</div></div></section>`;

  const tend = (r) => r.n < 2 ? '<span class="mk-nao">—</span>' : r.delta > 1 ? `<span class="mk-ok" style="font-weight:700">▲ +${r.delta} pp</span>` : r.delta < -1 ? `<span class="mk-da" style="font-weight:700">▼ ${r.delta} pp</span>` : `<span class="mk-mu">→ estável</span>`;
  const linhas = a.rows.map((r, i) => `<tr><td class="mk-num"><b>${i + 1}º</b></td><td><b>${escHTML(r.id)}</b><div class="mk-mu">${escHTML(r.name)}</div></td>
    <td><div style="display:flex;align-items:center;gap:6px"><span style="flex:1;height:7px;background:#EEF0F3;border-radius:4px;overflow:hidden"><span style="display:block;height:100%;width:${r.avg}%;background:${r.tier.cls === "ok" ? "#374151" : r.tier.cls === "wa" ? "#D97706" : "#B91C1C"}"></span></span><b style="min-width:34px;text-align:right">${r.avg}%</b></div></td>
    <td class="mk-num">${r.latestPct}%</td><td class="mk-num ${r.latestInop ? "mk-da" : ""}"><b>${r.latestInop}</b></td><td class="mk-num">${tend(r)}</td>
    <td><span class="mk-b mk-b-${r.tier.cls}">${r.tier.rot}</span>${r.estagnadoCritico ? '<div style="margin-top:2px"><span class="mk-b mk-b-da">sem evolução</span></div>' : ""}${r.estagnadoExcelencia ? '<div style="margin-top:2px"><span class="mk-b mk-b-in">mantém excelência</span></div>' : ""}</td></tr>`).join("");
  const ranking = `<section><div class="mk-h2">Ranking de eficiência operacional <span class="mk-mu">· por saúde média no período</span></div>
    <table class="mk-tb"><colgroup><col style="width:5%"><col style="width:24%"><col style="width:25%"><col style="width:9%"><col style="width:9%"><col style="width:11%"><col style="width:17%"></colgroup>
    <thead><tr><th>#</th><th>Unidade</th><th>Saúde média</th><th class="mk-num">Atual</th><th class="mk-num">Inop.</th><th class="mk-num">Tendência</th><th>Situação</th></tr></thead><tbody>${linhas}</tbody></table>
    <div class="mk-nota">Saúde média = média simples das saúdes semanais do recorte. Tendência = diferença entre a última e a primeira semana do recorte (±1 pp = estável). Situação: ≥ 90% destaque positivo · 70–89% atenção · abaixo de 70% crítico. "Sem evolução" = estável em 3+ semanas abaixo de 90%.</div></section>`;

  const cronicos = a.chronic.length ? `<section><div class="mk-h2">Itens crônicos do grupo <span class="mk-mu">· mais de ${DIAS_CRONICO} dias em aberto, cruzados entre unidades</span></div>
    <table class="mk-tb"><colgroup><col style="width:11%"><col style="width:36%"><col style="width:10%"><col style="width:43%"></colgroup><thead><tr><th>Unidade</th><th>Item</th><th class="mk-num">Dias</th><th>Descrição</th></tr></thead>
    <tbody>${a.chronic.map((c) => `<tr><td><b>${escHTML(c.pid)}</b><div class="mk-mu">${escHTML(c.pname)}</div></td><td>${escHTML(c.label)}${c.since ? `<div class="mk-mu">desde ${dataBR(c.since)}</div>` : ""}</td><td class="mk-num"><b class="mk-da">${c.days} d</b></td><td>${c.note ? escHTML(c.note) : '<span class="mk-nao">—</span>'}</td></tr>`).join("")}</tbody></table>
    <div class="mk-nota">Pendências antigas para cobrança direcionada às equipes terceirizadas e empresas de manutenção.</div></section>` : "";

  const semEvolucao = a.estagnados.length ? `<section class="mk-dest"><div class="mk-h2">Unidades sem evolução</div><ul>${a.estagnados.map((r) => `<li><b>${escHTML(r.id)} — ${escHTML(r.name)}</b>: sem evolução significativa no período (variação de ${r.delta >= 0 ? "+" : ""}${r.delta} pp, média de ${r.avg}%).</li>`).join("")}</ul></section>` : "";

  const css = `<style>.cg-leg{display:flex;flex-wrap:wrap;gap:10px;font-size:8pt;color:#374151;margin-top:4px}.cg-leg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:-1px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @media screen and (max-width:640px){.mk-hero{grid-template-columns:1fr}}</style>`;
  const projeto = { id: a.rows[0]?.id || "", name: `Grupo ${groupLabel}` };
  return documentoMoked({ project: projeto, titulo: "Relatório Comparativo Interparques", subtitulo: sub, numero, hoje, tag: "ACESSO GERENCIAL", empresaLogo: false,
    corpo: css + hero + kpis + ranking + cronicos + semEvolucao,
    rodape: `${numero} · Comparativo Interparques · Grupo ${groupLabel} · Moked Consulting Security · MokLog CheckTest` });
}
