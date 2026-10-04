// Consolidado de Acessos de Ambulância — padrão Moked (aprovado em 04/10/2026).
// LGPD: o nome da vítima (campo "paciente") NUNCA entra no consolidado; os registros individuais do anexo
// já não o mostram. Condição de saúde aparece só como tipo de ocorrência, sem identificar a pessoa.
import { documentoMoked, barrasMoked, escHTML, dataBR } from "./padraoMoked";
import { cssRegistroAmbulancia, cabecalhoRegistroAmbulancia, cardRegistroAmbulancia } from "../ambulanciaPdf";

export const permanencia = (r) => {
  const p = (h) => /^\d{1,2}:\d{2}$/.test(h || "") ? Number(h.split(":")[0]) * 60 + Number(h.split(":")[1]) : null;
  const a = p(r?.horaEntrada), b = p(r?.horaSaida);
  return a == null || b == null ? null : (b - a + 1440) % 1440;   // atravessa a meia-noite
};
export const tipoDe = (r) => (r?.tipo === "Outro" && r?.tipoOutro) ? r.tipoOutro : (r?.tipo || "Não informado");
const contar = (arr, f) => { const m = new Map(); arr.forEach(x => { const k = f(x); m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))); };

export function analisarAmbulancia(registros, { inicio, fim, inquilinosLista } = {}) {
  const lista = (registros || []).filter(r => r && r.data && (!inicio || r.data >= inicio) && (!fim || r.data <= fim))
    .sort((a, b) => `${b.data} ${b.horaEntrada || ""}`.localeCompare(`${a.data} ${a.horaEntrada || ""}`));
  const perms = lista.map(permanencia).filter(x => x != null);
  const grav = (r) => r.gravidade || "Não informada";
  const cadastro = new Set((inquilinosLista || []).map(n => String(n).trim().toLowerCase()));
  return {
    lista, n: lista.length,
    diurno: lista.filter(r => r.turno === "Diurno").length, noturno: lista.filter(r => r.turno === "Noturno").length,
    permMedia: perms.length ? perms.reduce((a, b) => a + b, 0) / perms.length : null, permMin: perms.length ? Math.min(...perms) : null, permMax: perms.length ? Math.max(...perms) : null,
    porGravidade: contar(lista, grav), porInquilino: contar(lista, r => r.inquilino || "Não informado"), porTipo: contar(lista, tipoDe),
    graves: lista.filter(r => /^(grave|moder)/i.test(r.gravidade || "")).length,
    semTipo: lista.filter(r => tipoDe(r) === "Não informado").length, semGravidade: lista.filter(r => !r.gravidade).length,
    semHorario: lista.filter(r => permanencia(r) == null).length,
    removidas: lista.filter(r => r.vitimaRemovida === "Sim").length,
    foraDoCadastro: cadastro.size ? [...new Set(lista.map(r => r.inquilino).filter(n => n && !cadastro.has(n.trim().toLowerCase())))] : [],
  };
}

export function montarConsolidadoAmbulancia(project, registros, { inicio, fim, interno = false, comAnexo = false, inquilinosLista, hoje = new Date() } = {}) {
  const a = analisarAmbulancia(registros, { inicio, fim, inquilinosLista });
  const numero = `MK-${project.id}-AMB-${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}`;
  const periodo = a.n ? `${dataBR(inicio || a.lista[a.n - 1].data)} a ${dataBR(fim || a.lista[0].data)}` : `${dataBR(inicio)} a ${dataBR(fim)}`;
  const sub = `<b>${escHTML(project.id)} — ${escHTML(project.name || "")}</b> · ${periodo} · ${a.n} ${a.n === 1 ? "atendimento" : "atendimentos"}`;
  const corG = (g) => /^grave/i.test(g) ? "mk-b-da" : /^moder/i.test(g) ? "mk-b-wa" : /^leve/i.test(g) ? "mk-b-ok" : "mk-b-in";
  let corpo;
  if (!a.n) corpo = `<div class="mk-vazio"><div class="mk-big">0</div><div class="mk-kl">acessos de ambulância no período</div></div>`;
  else {
    const top = a.porInquilino[0];
    corpo = `<section class="mk-kpis">
      <div class="mk-k"><div class="mk-kv">${a.n}</div><div class="mk-kl">atendimentos</div><div class="mk-mu mk-sm">${a.diurno} diurnos · ${a.noturno} noturnos</div></div>
      <div class="mk-k"><div class="mk-kv">${a.permMedia != null ? Math.round(a.permMedia) + " min" : "—"}</div><div class="mk-kl">permanência média</div><div class="mk-mu mk-sm">${a.permMin != null ? `de ${a.permMin} a ${a.permMax} min no condomínio` : "horários não informados"}</div></div>
      <div class="mk-k"><div class="mk-kv">${a.graves}</div><div class="mk-kl">moderadas ou graves</div><div class="mk-mu mk-sm">${a.porGravidade.map(([g, q]) => `${q} ${escHTML(g.toLowerCase())}`).join(" · ")}</div></div>
      <div class="mk-k"><div class="mk-kv ${a.semTipo ? "mk-wa" : ""}">${a.semTipo} de ${a.n}</div><div class="mk-kl">sem tipo de ocorrência</div><div class="mk-mu mk-sm">campo "não informado"</div></div></section>
      <div class="mk-duas"><div class="mk-card"><div class="mk-lb">Atendimentos por inquilino</div>${barrasMoked(a.porInquilino.slice(0, 8))}</div>
      <div class="mk-card"><div class="mk-lb">Por tipo de ocorrência</div>${barrasMoked(a.porTipo.slice(0, 8))}</div></div>
      <section class="mk-dest"><div class="mk-h2">Destaques do período</div><ul>
      <li><b>${escHTML(top[0])}</b> concentrou ${top[1]} dos ${a.n} atendimentos.</li>
      ${a.permMax != null ? `<li>A permanência mais longa foi de <b>${a.permMax} min</b>; a média, ${Math.round(a.permMedia)} min.</li>` : ""}
      <li>Vítima removida em ${a.removidas} de ${a.n} atendimentos.</li>
      ${a.semTipo ? `<li>Em <b>${a.semTipo} de ${a.n}</b> atendimentos o tipo de ocorrência ficou "não informado".</li>` : ""}</ul></section>
      <section><div class="mk-h2">Registro dos atendimentos <span class="mk-mu">— sem dados pessoais da vítima</span></div>
      <table class="mk-tb"><colgroup><col style="width:13%"><col style="width:13%"><col style="width:18%"><col style="width:17%"><col style="width:11%"><col style="width:9%"><col style="width:6%"><col style="width:13%"></colgroup>
      <thead><tr><th>Data</th><th>Entrada–saída</th><th>Inquilino</th><th>Ocorrência</th><th>Gravidade</th><th>Removida</th><th class="mk-num">Fotos</th><th>Nº do registro</th></tr></thead><tbody>
      ${a.lista.map(r => `<tr><td><b>${dataBR(r.data)}</b><div class="mk-mu">${escHTML(r.turno || "")}</div></td><td>${escHTML(r.horaEntrada || "—")}–${escHTML(r.horaSaida || "—")}${permanencia(r) != null ? `<div class="mk-mu">${permanencia(r)} min</div>` : ""}</td>
      <td><b>${escHTML(r.inquilino || "—")}</b></td><td>${tipoDe(r) === "Não informado" ? '<span class="mk-nao">Não informado</span>' : escHTML(tipoDe(r))}</td><td><span class="mk-b ${corG(r.gravidade || "")}">${escHTML(r.gravidade || "Não informada")}</span></td>
      <td>${escHTML(r.vitimaRemovida || "—")}</td><td class="mk-num">${Array.isArray(r.fotos) ? r.fotos.filter(Boolean).length : 0}</td><td class="mk-sm mk-mu">${escHTML(`${project.id}-AMB-${String(r.id || "").slice(-10)}`)}</td></tr>`).join("")}
      </tbody></table>${comAnexo ? '<p class="mk-nota">Anexo neste mesmo arquivo: os registros individuais (fotos, equipe da ambulância e responsável), um por página.</p>' : ""}</section>`;
    if (interno) {
      const it = [];
      if (a.semTipo) it.push(`<li><b>Tipo de ocorrência</b> não informado em ${a.semTipo} de ${a.n}.</li>`);
      if (a.semGravidade) it.push(`<li><b>Gravidade</b> não informada em ${a.semGravidade} de ${a.n}.</li>`);
      if (a.semHorario) it.push(`<li><b>Horário de entrada ou saída</b> faltando em ${a.semHorario} de ${a.n}.</li>`);
      if (a.foraDoCadastro.length) it.push(`<li><b>Inquilino fora do cadastro do condomínio:</b> ${a.foraDoCadastro.map(n => `“${escHTML(n)}”`).join(", ")} — escolher da lista evita grafias diferentes.</li>`);
      corpo += `<section class="mk-qual mk-bloco"><div class="mk-h2">Conferência do registro <span class="mk-mu">— versão interna</span></div>${it.length ? `<ul>${it.join("")}</ul>` : '<div class="mk-sm">Nenhuma inconsistência encontrada.</div>'}</section>`;
    }
  }
  let html = documentoMoked({ project, titulo: "Acessos de Ambulância — Consolidado", subtitulo: sub, numero, corpo, interno, hoje });
  if (comAnexo && a.n) {
    const anexo = a.lista.map(r => `<div class="mk-anexo" style="page-break-before:always">${cabecalhoRegistroAmbulancia(project, r)}${cardRegistroAmbulancia(project, r)}<div class="footer"><b>MOKED SECURITY CONSULTING</b> · Registro de Acesso de Ambulância · Documento de Uso Interno e Confidencial</div></div>`).join("");
    html = html.replace("</style>", `${prefixarCSS(cssRegistroAmbulancia(), ".mk-anexo")}.mk-anexo{font-size:14px;line-height:1.5}</style>`).replace("</body></html>", `${anexo}</body></html>`);
  }
  return { html, analise: a, numero };
}

// Restringe um CSS a um escopo (o CSS do registro individual tem regras globais em "*" e "body").
export function prefixarCSS(css, escopo) {
  let out = "", i = 0;
  while (i < css.length) {
    const j = css.indexOf("{", i); if (j < 0) break;
    const sel = css.slice(i, j).trim();
    let d = 1, k = j + 1; while (k < css.length && d) { if (css[k] === "{") d++; else if (css[k] === "}") d--; k++; }
    const corpo = css.slice(j + 1, k - 1);
    if (sel.startsWith("@media")) out += `${sel}{${prefixarCSS(corpo, escopo)}}`;
    else if (!sel.startsWith("@")) out += sel.split(",").map(s => { s = s.trim(); return (s === "body" || s === "html") ? escopo : s === "*" ? `${escopo},${escopo} *` : `${escopo} ${s}`; }).join(",") + `{${corpo}}`;
    i = k;
  }
  return out;
}
