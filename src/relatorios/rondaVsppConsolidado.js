// ─────────────────────────────────────────────────────────────
// Ronda VSPP — consolidado geral (todas as rondas ou um período) no padrão Moked.
// Puro: recebe os registros de ronda_vspp/{pid}.registros e devolve o HTML.
// ─────────────────────────────────────────────────────────────
import { documentoMoked, escHTML, num1, dataBR } from "./padraoMoked";

const SLOTS_PADRAO = 15;

export function resumoRonda(r) {
  const slots = (r.slots && r.slots.length) || SLOTS_PADRAO;
  const m = r.marcacoes || {};
  const feitas = Object.values(m).filter((x) => x && x.status === "feito").length;
  const naoFeitas = Object.values(m).filter((x) => x && x.status === "nao_feito").length;
  const pct = slots ? Math.round((feitas / slots) * 100) : 0;
  const ki = parseFloat(r.kmInicial), kf = parseFloat(r.kmFinal);
  const km = Number.isFinite(ki) && Number.isFinite(kf) && kf >= ki ? kf - ki : null;
  return { slots, feitas, naoFeitas, pendentes: Math.max(0, slots - feitas - naoFeitas), pct, km };
}

export function filtrarPeriodo(registros, de, ate) {
  return (registros || []).filter((r) => r && r.data && (!de || r.data >= de) && (!ate || r.data <= ate))
    .sort((a, b) => b.data.localeCompare(a.data));
}

export function analisarConsolidado(registros) {
  const linhas = registros.map((r) => ({ r, s: resumoRonda(r) }));
  const totSlots = linhas.reduce((a, x) => a + x.s.slots, 0);
  const feitas = linhas.reduce((a, x) => a + x.s.feitas, 0);
  const naoFeitas = linhas.reduce((a, x) => a + x.s.naoFeitas, 0);
  const km = linhas.reduce((a, x) => a + (x.s.km || 0), 0);
  const porExec = {};
  linhas.forEach(({ r, s }) => {
    const k = (r.executor || "").trim() || "Executor não informado";
    const e = porExec[k] || (porExec[k] = { nome: k, dias: 0, slots: 0, feitas: 0, naoFeitas: 0, km: 0 });
    e.dias++; e.slots += s.slots; e.feitas += s.feitas; e.naoFeitas += s.naoFeitas; e.km += s.km || 0;
  });
  const executores = Object.values(porExec).sort((a, b) => b.dias - a.dias);
  const pendencias = [];
  linhas.forEach(({ r, s }) => {
    Object.entries(r.marcacoes || {}).forEach(([h, m]) => {
      if (m && m.status === "nao_feito") pendencias.push({ data: r.data, hora: h, exec: r.executor || "", obs: m.obs || "" });
    });
  });
  pendencias.sort((a, b) => b.data.localeCompare(a.data) || a.hora.localeCompare(b.hora));
  return { linhas, dias: linhas.length, totSlots, feitas, naoFeitas, pct: totSlots ? Math.round((feitas / totSlots) * 100) : 0, km, executores, pendencias };
}

const clsPct = (p) => (p >= 90 ? "mk-ok" : p >= 60 ? "mk-wa" : "mk-da");

export function montarConsolidadoVSPP(project, registros, { de = "", ate = "", hoje = new Date() } = {}) {
  const lista = filtrarPeriodo(registros, de, ate);
  const a = analisarConsolidado(lista);
  const numero = `MK-${project.id}-RVSPP-${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}`;
  const periodo = lista.length ? `${dataBR(lista[lista.length - 1].data)} a ${dataBR(lista[0].data)}` : "sem rondas no período";
  const kpis = `<div class="mk-kpis">
<div class="mk-k"><div class="mk-kv">${a.dias}</div><div class="mk-kl">dia(s) com ronda</div></div>
<div class="mk-k"><div class="mk-kv ${clsPct(a.pct)}">${a.pct}%</div><div class="mk-kl">execução (${a.feitas} de ${a.totSlots} horários)</div></div>
<div class="mk-k"><div class="mk-kv${a.naoFeitas ? " mk-da" : ""}">${a.naoFeitas}</div><div class="mk-kl">rondas não feitas</div></div>
<div class="mk-k"><div class="mk-kv">${num1(a.km)}</div><div class="mk-kl">km percorridos</div></div></div>`;
  const exec = a.executores.length ? `<h2 class="mk-h2">Por executor</h2><table class="mk-tb"><thead><tr><th>Executor</th><th class="mk-num">Dias</th><th class="mk-num">Feitas</th><th class="mk-num">Não feitas</th><th class="mk-num">Execução</th><th class="mk-num">Km</th></tr></thead><tbody>${a.executores.map((e) => {
    const p = e.slots ? Math.round((e.feitas / e.slots) * 100) : 0;
    return `<tr><td><b>${escHTML(e.nome)}</b></td><td class="mk-num">${e.dias}</td><td class="mk-num">${e.feitas}</td><td class="mk-num">${e.naoFeitas}</td><td class="mk-num ${clsPct(p)}"><b>${p}%</b></td><td class="mk-num">${num1(e.km)}</td></tr>`;
  }).join("")}</tbody></table>` : "";
  const dias = a.linhas.length ? `<h2 class="mk-h2" style="margin-top:12px">Rondas por dia <span class="mk-mu">(mais recente primeiro)</span></h2><table class="mk-tb"><thead><tr><th>Data</th><th>Executor</th><th class="mk-num">Feitas</th><th class="mk-num">Não feitas</th><th class="mk-num">Pend.</th><th class="mk-num">Execução</th><th class="mk-num">Km ini</th><th class="mk-num">Km fim</th><th class="mk-num">Km</th></tr></thead><tbody>${a.linhas.map(({ r, s }) =>
    `<tr><td class="mk-dv">${dataBR(r.data)}</td><td>${escHTML(r.executor || "—")}</td><td class="mk-num">${s.feitas}</td><td class="mk-num${s.naoFeitas ? " mk-da" : ""}">${s.naoFeitas}</td><td class="mk-num mk-mu">${s.pendentes}</td><td class="mk-num ${clsPct(s.pct)}"><b>${s.pct}%</b></td><td class="mk-num">${escHTML(r.kmInicial || "—")}</td><td class="mk-num">${escHTML(r.kmFinal || "—")}</td><td class="mk-num">${s.km == null ? "—" : num1(s.km)}</td></tr>`).join("")}</tbody></table>` : `<div class="mk-vazio"><div class="mk-lb">Nenhuma ronda registrada no período</div></div>`;
  const pend = a.pendencias.length ? `<h2 class="mk-h2" style="margin-top:12px">Rondas não feitas <span class="mk-mu">(${a.pendencias.length})</span></h2><table class="mk-tb"><thead><tr><th>Data</th><th>Horário</th><th>Executor</th><th>Observação</th></tr></thead><tbody>${a.pendencias.map((p) =>
    `<tr><td class="mk-dv">${dataBR(p.data)}</td><td>${escHTML(p.hora)}</td><td>${escHTML(p.exec || "—")}</td><td class="mk-mu">${escHTML(p.obs || "—")}</td></tr>`).join("")}</tbody></table>` : "";
  const corpo = `${kpis}${exec}${dias}${pend}<p class="mk-nota">Execução = horários feitos ÷ horários previstos de cada dia. Km = km final − km inicial informados em cada dia.</p>`;
  const html = documentoMoked({ project, titulo: "Ronda VSPP — Consolidado", subtitulo: `${escHTML(project.id)} — ${escHTML(project.name || "")} · ${periodo}`, numero, corpo, hoje });
  return { html, numero, analise: a };
}
