// ─────────────────────────────────────────────────────────────
// Ronda Virtual (CFTV) — cálculo e relatórios no padrão Moked (F2-1, autorizado pelo Marcio em 05/10/2026).
// • Cálculo puro: "agora" é argumento (testes reproduzíveis); grade e status vêm de rondaVirtualGrade.js (mesma
//   fonte da tela). Nada é gravado: só leitura dos turnos.
// • Sem classificação de pessoas e sem limites inventados: o relatório mostra fatos (no horário, atraso, não
//   executada, com/sem justificativa, duração) e aponta só inconsistências objetivas do registro (versão interna).
// • Nomes das colaboradoras aparecem também na versão cliente (decisão do Marcio, 05/10/2026).
// ─────────────────────────────────────────────────────────────
import { buildSlots, statusSlot, minutosDesdeInicio, limiteFinalTurnoMin, inicioTurnoHora } from "../rondaVirtualGrade";
import { documentoMoked, barrasMoked, escHTML, dataBR } from "./padraoMoked";

const TIPO_LABEL = { noturno: "Noturno", diurno: "Diurno" };
const hhmm = (v) => /^\d{1,2}:\d{2}$/.test(String(v || "").trim()) ? String(v).trim().padStart(5, "0") : null;
const minDoDia = (v) => { const h = hhmm(v); return h == null ? null : Number(h.slice(0, 2)) * 60 + Number(h.slice(3)); };

// Turno encerrado = arquivado ou já passou do último minuto da jornada.
export function turnoEncerrado(project, turno, agora) {
  if (turno?.arquivado) return true;
  return minutosDesdeInicio(turno.tipo, turno.dataInicio, agora, project.id) > limiteFinalTurnoMin(turno.tipo, project.id);
}

// Duração ancorada no slot e no turno (critério do Codex): início e fim viram minutos absolutos a partir do dia de
// início do turno. O início fica no dia mais próximo do horário previsto do slot. Fim antes do início só passa para o
// dia seguinte em turno NOTURNO (o único que atravessa a meia-noite) e desde que o fim resultante fique dentro da
// jornada; fora disso é inconsistência do registro — não se "conserta" o dado.
export function duracaoDaRonda(project, turno, slot, prox, reg) {
  const i = minDoDia(reg?.inicio), f = minDoDia(reg?.fim);
  if (i == null || f == null) return { duracao: null, inconsistencia: null };
  const base = inicioTurnoHora(turno.tipo, project.id) * 60;
  const previsto = base + slot.offsetMin;
  const fimJornada = base + limiteFinalTurnoMin(turno.tipo, project.id) + 1;
  const candidatos = [i - 1440, i, i + 1440, i + 2880];
  const ini = candidatos.reduce((m, c) => Math.abs(c - previsto) < Math.abs(m - previsto) ? c : m, candidatos[0]);
  let fim = Math.floor(ini / 1440) * 1440 + f;
  if (fim < ini) {
    if (turno.tipo === "noturno" && fim + 1440 <= fimJornada) fim += 1440;
    else return { duracao: null, inconsistencia: "fim anterior ao início" };
  }
  if (fim === ini) return { duracao: 0, inconsistencia: "início igual ao fim (0 min)" };
  return { duracao: fim - ini, inconsistencia: null };
}

export function analisarTurno(project, turno, agora = new Date()) {
  const slots = buildSlots(turno.tipo, project.id);
  const encerrado = turnoEncerrado(project, turno, agora);
  const agoraMin = minutosDesdeInicio(turno.tipo, turno.dataInicio, agora, project.id);
  // turno aberto preserva o limite estendido do último slot (como a tela); encerrado usa o comportamento original
  const limite = (!encerrado && turno.tipo === "noturno") ? limiteFinalTurnoMin(turno.tipo, project.id) : null;
  const r = { turno, encerrado, previstas: slots.length, noHorario: 0, atraso: 0, naoExec: 0, emAndamento: 0, pendentes: 0,
    comJust: 0, semJust: 0, anomalias: 0, duracoes: [], linhas: [], inconsistencias: [] };
  slots.forEach((s, i) => {
    const prox = slots[i + 1] ? slots[i + 1].offsetMin : null;
    const reg = turno.rondas?.[String(s.offsetMin)] || null;
    const st = statusSlot(s, prox, agoraMin, reg, limite);
    const just = String(reg?.justificativa || "").trim();
    const d = duracaoDaRonda(project, turno, s, prox, reg);
    let grupo;
    if (st === "feita") { grupo = "noHorario"; r.noHorario++; }
    else if (st === "feita_atrasada") { grupo = "atraso"; r.atraso++; just ? r.comJust++ : r.semJust++; }
    else if (st === "naoexec" || st === "bloqueado") { grupo = "naoExec"; r.naoExec++; just ? r.comJust++ : r.semJust++; }
    else if (st === "em_andamento") { grupo = "emAndamento"; r.emAndamento++; }
    else { grupo = "pendente"; r.pendentes++; }
    if (reg?.fim && reg?.anomalia) r.anomalias++;
    if (d.duracao != null && !d.inconsistencia) r.duracoes.push(d.duracao);
    if (d.inconsistencia) r.inconsistencias.push({ horario: s.label, texto: d.inconsistencia });
    if (st === "em_andamento" && turno.arquivado) r.inconsistencias.push({ horario: s.label, texto: "turno arquivado com ronda em andamento (início sem fim)" });
    r.linhas.push({ slot: s, status: st, grupo, reg, just, obs: String(reg?.obs || "").trim(), duracao: d.duracao, inconsistencia: d.inconsistencia });
  });
  r.realizadas = r.noHorario + r.atraso;
  return r;
}

// Chave estável da colaboradora: id do plantonista; sem id, cai no nome (e é sinalizado na conferência).
const chaveDe = (p) => p?.id ? `id:${p.id}` : `nome:${String(p?.nome || "").trim().toLowerCase()}`;
export const chaveColaboradora = chaveDe;

export function consolidarRondas(project, turnos, { agora = new Date(), de = null, ate = null, colaboradores = null, tipo = null } = {}) {
  const sel = (turnos || []).filter((t) => t && t.dataInicio
    && (!de || t.dataInicio >= de) && (!ate || t.dataInicio <= ate)
    && (!tipo || t.tipo === tipo)
    && (!colaboradores || !colaboradores.length || colaboradores.includes(chaveDe(t.plantonista))))
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio) || String(a.tipo).localeCompare(String(b.tipo)));
  const analises = sel.map((t) => analisarTurno(project, t, agora));
  const pessoas = new Map();
  analises.forEach((a) => {
    const p = a.turno.plantonista || {};
    const k = chaveDe(p);
    if (!pessoas.has(k)) pessoas.set(k, { chave: k, id: p.id || null, nome: String(p.nome || "").trim() || "Sem nome", cargo: p.cargo || "",
      turnos: 0, encerrados: 0, previstasEnc: 0, realizadasEnc: 0, noHorario: 0, atraso: 0, naoExec: 0, emAndamento: 0, comJust: 0, semJust: 0, anomalias: 0, duracoes: [] });
    const c = pessoas.get(k);
    c.turnos++; c.noHorario += a.noHorario; c.atraso += a.atraso; c.naoExec += a.naoExec; c.emAndamento += a.emAndamento;
    c.comJust += a.comJust; c.semJust += a.semJust; c.anomalias += a.anomalias; c.duracoes.push(...a.duracoes);
    if (a.encerrado) { c.encerrados++; c.previstasEnc += a.previstas; c.realizadasEnc += a.realizadas; }
  });
  const lista = [...pessoas.values()].map((c) => ({ ...c,
    execucao: c.previstasEnc ? (c.realizadasEnc / c.previstasEnc) * 100 : null,          // sem turno encerrado = não disponível
    duracaoMedia: c.duracoes.length ? c.duracoes.reduce((x, y) => x + y, 0) / c.duracoes.length : null }));
  // homônimos com ids diferentes ficam separados; o rótulo ganha o cargo para distinguir
  const contaNome = {}; lista.forEach((c) => { contaNome[c.nome] = (contaNome[c.nome] || 0) + 1; });
  lista.forEach((c) => { c.rotulo = contaNome[c.nome] > 1 ? `${c.nome}${c.cargo ? ` (${c.cargo})` : ` (${c.chave})`}` : c.nome; });
  lista.sort((a, b) => a.rotulo.localeCompare(b.rotulo));
  const tot = (k) => analises.reduce((s, a) => s + a[k], 0);
  const enc = analises.filter((a) => a.encerrado);
  const previstasEnc = enc.reduce((s, a) => s + a.previstas, 0), realizadasEnc = enc.reduce((s, a) => s + a.realizadas, 0);
  return { analises, colaboradoras: lista,
    totais: { turnos: analises.length, encerrados: enc.length, previstas: tot("previstas"), noHorario: tot("noHorario"), atraso: tot("atraso"),
      naoExec: tot("naoExec"), emAndamento: tot("emAndamento"), comJust: tot("comJust"), semJust: tot("semJust"), anomalias: tot("anomalias"),
      execucao: previstasEnc ? (realizadasEnc / previstasEnc) * 100 : null },
    semId: analises.filter((a) => !a.turno.plantonista?.id).map((a) => a.turno),
    periodo: { de: de || sel[0]?.dataInicio || null, ate: ate || sel[sel.length - 1]?.dataInicio || null } };
}

const pct = (v) => v == null ? "não disponível" : `${Math.round(v)}%`;
const minTxt = (v) => v == null ? "—" : `${Math.round(v)} min`;
const MMDD = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
const STATUS_TXT = { feita: ["No horário", "mk-b-ok"], feita_atrasada: ["Com atraso", "mk-b-wa"], naoexec: ["Não executada", "mk-b-da"], bloqueado: ["Não executada", "mk-b-da"],
  em_andamento: ["Em andamento", "mk-b-in"], aguardando: ["Aguardando", "mk-b-in"], aberto: ["Aguardando", "mk-b-in"], atraso_aberto: ["Aguardando", "mk-b-in"] };

export function montarRelatorioTurno(project, turno, { agora = new Date(), interno = false } = {}) {
  const a = analisarTurno(project, turno, agora);
  const p = turno.plantonista || {};
  const numero = `MK-${project.id}-RV-${MMDD(agora)}`;
  const sub = `<b>${escHTML(project.id)} — ${escHTML(project.name || "")}</b> · Turno ${escHTML(TIPO_LABEL[turno.tipo] || turno.tipo)} de ${dataBR(turno.dataInicio)} · Plantonista: <b>${escHTML(p.nome || "—")}</b>${p.cargo ? ` (${escHTML(p.cargo)})` : ""}${a.encerrado ? "" : " · <b>turno em andamento</b>"}`;
  const linhas = a.linhas.map((l) => { const [txt, cls] = STATUS_TXT[l.status] || ["—", "mk-b-in"];
    return `<tr><td><b>${escHTML(l.slot.label)}</b></td><td><span class="mk-b ${cls}">${txt}</span></td><td>${escHTML(hhmm(l.reg?.inicio) || "—")}</td><td>${escHTML(hhmm(l.reg?.fim) || "—")}</td>
      <td class="mk-num">${l.duracao != null && !l.inconsistencia ? `${l.duracao} min` : "—"}</td><td>${l.reg?.fim ? (l.reg.anomalia ? '<span class="mk-inv">Com anomalia</span>' : "Sem anomalia") : "—"}</td>
      <td class="mk-sm">${escHTML([l.just, l.obs].filter(Boolean).join(" · ")) || '<span class="mk-nao">—</span>'}</td></tr>`; }).join("");
  let corpo = `<section class="mk-kpis">
    <div class="mk-k"><div class="mk-kv">${a.previstas}</div><div class="mk-kl">rondas previstas</div></div>
    <div class="mk-k"><div class="mk-kv mk-ok">${a.realizadas}</div><div class="mk-kl">realizadas</div><div class="mk-mu mk-sm">${a.noHorario} no horário · ${a.atraso} com atraso</div></div>
    <div class="mk-k"><div class="mk-kv ${a.naoExec ? "mk-da" : ""}">${a.naoExec}</div><div class="mk-kl">não executadas</div><div class="mk-mu mk-sm">${a.semJust} sem justificativa registrada</div></div>
    <div class="mk-k"><div class="mk-kv">${a.encerrado ? minTxt(a.duracoes.length ? a.duracoes.reduce((x, y) => x + y, 0) / a.duracoes.length : null) : a.pendentes + a.emAndamento}</div><div class="mk-kl">${a.encerrado ? "duração média da ronda" : "aguardando ou em andamento"}</div>${a.encerrado ? "" : `<div class="mk-mu mk-sm">${a.emAndamento} em andamento · ${a.pendentes} aguardando</div>`}</div></section>
    <section><div class="mk-h2">Rondas do turno</div><table class="mk-tb"><thead><tr><th>Horário</th><th>Status</th><th>Início</th><th>Fim</th><th class="mk-num">Duração</th><th>Resultado</th><th>Justificativa / observação</th></tr></thead><tbody>${linhas}</tbody></table>
    ${a.encerrado ? "" : '<p class="mk-nota">Turno em andamento: rondas "aguardando" ainda estão dentro do horário e não contam como não executadas.</p>'}</section>`;
  if (interno) corpo += conferenciaHTML(a.inconsistencias.map((x) => `${escHTML(x.horario)} — ${escHTML(x.texto)}`).concat(p.id ? [] : ["plantonista sem identificador no cadastro do turno"]));
  return { html: documentoMoked({ project, titulo: "Ronda Virtual (CFTV)", subtitulo: sub, numero, corpo, interno, hoje: agora }), analise: a, numero };
}

function conferenciaHTML(itens) {
  return `<section class="mk-qual mk-bloco"><div class="mk-h2">Conferência do registro <span class="mk-mu">— versão interna</span></div>${itens.length ? `<ul>${itens.map((t) => `<li>${t}</li>`).join("")}</ul>` : '<div class="mk-sm">Nenhuma inconsistência encontrada.</div>'}</section>`;
}

export function montarConsolidadoRonda(project, turnos, { agora = new Date(), interno = false, de = null, ate = null, colaboradores = null, tipo = null } = {}) {
  const c = consolidarRondas(project, turnos, { agora, de, ate, colaboradores, tipo });
  const t = c.totais;
  const numero = `MK-${project.id}-RVC-${MMDD(agora)}`;
  const filtroTxt = [tipo ? `turno ${TIPO_LABEL[tipo] || tipo}` : null, colaboradores?.length ? `${c.colaboradoras.length} colaboradora(s) selecionada(s)` : null].filter(Boolean).join(" · ");
  const sub = `<b>${escHTML(project.id)} — ${escHTML(project.name || "")}</b> · ${dataBR(c.periodo.de)} a ${dataBR(c.periodo.ate)} · ${t.turnos} ${t.turnos === 1 ? "turno" : "turnos"}${filtroTxt ? ` · ${escHTML(filtroTxt)}` : ""}`;
  let corpo;
  if (!t.turnos) corpo = '<div class="mk-vazio"><div class="mk-big">0</div><div class="mk-kl">turnos no filtro selecionado</div></div>';
  else {
    const comp = c.colaboradoras.map((p) => `<tr><td><div class="mk-dv">${escHTML(p.rotulo)}</div>${p.id ? "" : '<div class="mk-mu">sem identificador</div>'}</td><td class="mk-num">${p.turnos}</td>
      <td class="mk-num">${p.noHorario}</td><td class="mk-num">${p.atraso}</td><td class="mk-num">${p.naoExec}</td><td class="mk-num">${p.semJust}</td>
      <td class="mk-num"><b>${pct(p.execucao)}</b></td><td class="mk-num">${minTxt(p.duracaoMedia)}</td><td class="mk-num">${p.anomalias}</td></tr>`).join("");
    const ocorr = [];
    c.analises.forEach((a) => a.linhas.filter((l) => (l.grupo === "atraso" || l.grupo === "naoExec") && !l.just).forEach((l) =>
      ocorr.push(`<tr><td>${escHTML(a.turno.plantonista?.nome || "—")}</td><td>${dataBR(a.turno.dataInicio)}</td><td>${escHTML(TIPO_LABEL[a.turno.tipo] || a.turno.tipo)}</td><td>${escHTML(l.slot.label)}</td><td><span class="mk-b ${l.grupo === "naoExec" ? "mk-b-da" : "mk-b-wa"}">${l.grupo === "naoExec" ? "Não executada" : "Com atraso"}</span></td></tr>`)));
    const comExec = c.colaboradoras.filter((p) => p.execucao != null);
    corpo = `<section class="mk-kpis">
      <div class="mk-k"><div class="mk-kv">${t.turnos}</div><div class="mk-kl">turnos</div><div class="mk-mu mk-sm">${t.encerrados} encerrados · ${t.previstas} rondas previstas</div></div>
      <div class="mk-k"><div class="mk-kv">${pct(t.execucao)}</div><div class="mk-kl">execução</div><div class="mk-mu mk-sm">realizadas ÷ previstas, só turnos encerrados</div></div>
      <div class="mk-k"><div class="mk-kv ${t.naoExec ? "mk-da" : ""}">${t.naoExec}</div><div class="mk-kl">não executadas</div><div class="mk-mu mk-sm">${t.atraso} com atraso</div></div>
      <div class="mk-k"><div class="mk-kv ${t.semJust ? "mk-wa" : ""}">${t.semJust}</div><div class="mk-kl">sem justificativa registrada</div><div class="mk-mu mk-sm">${t.comJust} com justificativa</div></div></section>
      ${comExec.length > 1 ? `<div class="mk-card" style="margin-bottom:10px"><div class="mk-lb">Execução por colaboradora (turnos encerrados)</div>${barrasMoked(comExec.map((p) => [p.rotulo, p.execucao]), (v) => `${Math.round(v)}%`)}</div>` : ""}
      <section><div class="mk-h2">Comparação por colaboradora</div><table class="mk-tb"><thead><tr><th>Colaboradora</th><th class="mk-num">Turnos</th><th class="mk-num">No horário</th><th class="mk-num">Atraso</th><th class="mk-num">Não exec.</th><th class="mk-num">Sem justif.</th><th class="mk-num">Execução</th><th class="mk-num">Duração média</th><th class="mk-num">Anomalias</th></tr></thead><tbody>${comp}</tbody></table>
      <p class="mk-nota">Execução = rondas realizadas (no horário ou com atraso) ÷ previstas, apenas em turnos encerrados; sem turno encerrado, "não disponível". Duração média considera só rondas com início e fim consistentes.</p></section>
      <section class="mk-bloco"><div class="mk-h2">Ocorrências sem justificativa registrada</div>${ocorr.length ? `<table class="mk-tb"><thead><tr><th>Colaboradora</th><th>Data</th><th>Turno</th><th>Horário</th><th>Ocorrência</th></tr></thead><tbody>${ocorr.join("")}</tbody></table>` : '<div class="mk-sm">Todas as ocorrências do período têm justificativa registrada.</div>'}</section>
      <section class="mk-bloco"><div class="mk-h2">Turnos incluídos</div><table class="mk-tb"><thead><tr><th>Data</th><th>Turno</th><th>Plantonista</th><th class="mk-num">Realizadas</th><th>Situação</th></tr></thead><tbody>
      ${c.analises.map((a) => `<tr><td>${dataBR(a.turno.dataInicio)}</td><td>${escHTML(TIPO_LABEL[a.turno.tipo] || a.turno.tipo)}</td><td>${escHTML(a.turno.plantonista?.nome || "—")}</td><td class="mk-num">${a.realizadas} de ${a.previstas}</td><td>${a.encerrado ? "Encerrado" : '<span class="mk-b mk-b-in">Em andamento</span>'}</td></tr>`).join("")}</tbody></table></section>`;
    if (interno) {
      const it = [];
      c.analises.forEach((a) => a.inconsistencias.forEach((x) => it.push(`${dataBR(a.turno.dataInicio)} ${escHTML(TIPO_LABEL[a.turno.tipo] || "")} (${escHTML(a.turno.plantonista?.nome || "—")}), ${escHTML(x.horario)} — ${escHTML(x.texto)}`)));
      if (c.semId.length) it.push(`${c.semId.length} turno(s) com plantonista sem identificador no cadastro — agrupados pelo nome`);
      corpo += conferenciaHTML(it);
    }
  }
  return { html: documentoMoked({ project, titulo: "Consolidado de Ronda Virtual (CFTV)", subtitulo: sub, numero, corpo, interno, hoje: agora }), consolidado: c, numero };
}
