// TEMPORÁRIO — contagens puras da Fase 0 (uso real dos módulos). CommonJS: usado pela rota api/painel-uso.js e pelos testes.
// Tudo aqui devolve só números. Nada de nome, telefone, CPF ou foto.
const DATA = /^(\d{4}-\d{2}-\d{2})/;
const CAMPOS_DATA = ["data", "dataInicio", "date", "dataOcorrido", "dataProblem", "criadoEm", "createdAt", "em", "registradoEm", "abertoEm", "inicio", "updatedAt"];
const somarDias = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dataDe = (r) => { if (!r || typeof r !== "object") return null; for (const k of CAMPOS_DATA) { const m = DATA.exec(String(r[k] || "")); if (m) return m[1]; } if (r.meta) return dataDe(r.meta); return null; };
const noPeriodo = (iso, hoje) => !!iso && iso > somarDias(hoje, -30) && iso <= hoje;
const tamanhoKB = (d) => (d ? Math.round(Buffer.byteLength(JSON.stringify(d), "utf8") / 1024) : 0);

// Conta uma lista de registros: total, nos 30 dias, sem data reconhecível, e a data mais recente.
function lista(regs, hoje) {
  if (regs === undefined) return { erro: true };
  const l = Array.isArray(regs) ? regs.filter((r) => r && typeof r === "object") : [];
  const datas = l.map(dataDe);
  const validas = datas.filter(Boolean).sort();
  return { total: l.length, d30: datas.filter((d) => noPeriodo(d, hoje)).length, semData: datas.filter((d) => !d).length, ultimo: validas[validas.length - 1] || null };
}
// Documento "lista": pega a maior lista de objetos de primeiro nível (registros, turnos, plantoes, quadrantes…).
function documento(d, hoje) {
  if (d === undefined) return { erro: true };
  if (!d) return { existe: false, total: 0, d30: 0 };
  const listas = Object.entries(d).filter(([, v]) => Array.isArray(v) && v.some((x) => x && typeof x === "object"));
  const [campo, maior] = listas.sort((a, b) => b[1].length - a[1].length)[0] || [null, []];
  return { existe: true, campo, ...lista(maior, hoje), atualizado: DATA.exec(String(d.updatedAt || d.atualizadoEm || ""))?.[1] || null };
}
const testes = (proj, hoje) => (proj === undefined ? { erro: true } : lista(proj && proj.history, hoje));
function mapas(docs, hoje) {
  if (docs === undefined) return { erro: true };
  const no = docs.filter((m) => noPeriodo(dataDe(m) || DATA.exec(String(m.id || "").split("_")[1] || "")?.[1], hoje));
  const env = (t) => no.filter((m) => String(m.turno || "").toUpperCase().startsWith(t) && m.status === "enviado").length;
  return { total: docs.length, d30: no.length, enviadosD: env("D"), enviadosN: env("N"), rascunho: no.filter((m) => m.status !== "enviado").length, esperadoPorTurno: 30 };
}
function ronda(d, hoje) {
  if (d === undefined) return { erro: true };
  const t = (d && Array.isArray(d.turnos) ? d.turnos : []).filter((x) => x && noPeriodo(dataDe(x), hoje));
  const slots = t.flatMap((x) => Object.values(x.rondas || {}));
  return { turnosTotal: d && Array.isArray(d.turnos) ? d.turnos.length : 0, noturnos30: t.filter((x) => x.tipo === "noturno").length, diurnos30: t.filter((x) => x.tipo === "diurno").length,
    slots: slots.length, executados: slots.filter((s) => s && s.inicio && !s.naoExec).length, naoExec: slots.filter((s) => s && s.naoExec).length, atrasados: slots.filter((s) => s && s.atrasada).length };
}
function equipamentos(d) {
  if (d === undefined) return { erro: true };
  let itens = 0, problema = 0, comData = 0;
  const andar = (v, nivel) => { if (!v || nivel > 4) return; if (Array.isArray(v)) return v.forEach((x) => andar(x, nivel + 1)); if (typeof v !== "object") return;
    if (typeof v.status === "string") { itens++; if (!["ok", "", "baixado"].includes(v.status)) { problema++; if (DATA.test(String(v.dataProblem || ""))) comData++; } }
    Object.entries(v).forEach(([k, x]) => { if (k !== "historico") andar(x, nivel + 1); }); };
  andar(d, 0);
  return { existe: !!d, itens, comProblema: problema, problemaComData: comData, checagemSemanal: d && d.checagemSemanal ? d.checagemSemanal.ultimaChecagem || null : null };
}
function followups(d, hoje) {
  if (d === undefined) return { erro: true };
  const regs = d && Array.isArray(d.registros) ? d.registros : [];
  const entradas = regs.flatMap((r) => (Array.isArray(r.entries) ? r.entries : []));
  return { pendenciasComTratativa: regs.length, tratativas: entradas.length, tratativas30: entradas.filter((e) => noPeriodo(dataDe(e), hoje)).length };
}
function equipe(d, hoje) {
  if (d === undefined) return { erro: true };
  const ativos = (d && d.colaboradores || []).filter((c) => c && (c.status || "ativo") === "ativo");
  const hist = ativos.flatMap((c) => (Array.isArray(c.historico) ? c.historico : []));
  const porTipo = {}; hist.filter((h) => noPeriodo(dataDe(h), hoje)).forEach((h) => { const t = String(h.tipo || "?"); porTipo[t] = (porTipo[t] || 0) + 1; });
  const chk = d && d.checagemEquipe;
  return { ativos: ativos.length, lancamentos30: porTipo, checagemAtual: chk ? { alvo: chk.alvo || null, checkins: (chk.checkins || []).length, concluida: !!chk.concluidoEm } : null, cadeadoFechado: !!(d && d.cadeado && d.cadeado.fechado) };
}
// RD: cada dia tem trechos com origem/destino = código do projeto. Devolve dias com visita por projeto (30 dias), sem identificar o consultor.
function visitasRd(dias, hoje, pids) {
  const l = (Array.isArray(dias) ? dias : []).filter((d) => d && noPeriodo(dataDe(d), hoje));
  const porProjeto = Object.fromEntries(pids.map((p) => [p, 0]));
  let comCodigo = 0, trechos = 0;
  for (const d of l) { const vistos = new Set();
    for (const t of Array.isArray(d.trechos) ? d.trechos : []) { trechos++; const c = String(t.destino || "").toUpperCase().trim(); if (c) comCodigo++; if (c in porProjeto) vistos.add(c); }
    vistos.forEach((p) => porProjeto[p]++); }
  return { diasComRd30: l.length, trechos30: trechos, trechosComDestino: comCodigo, diasComVisitaPorProjeto: porProjeto, identificaProjeto: comCodigo > 0 };
}
const contarUso = { lista, documento, testes, mapas, ronda, equipamentos, followups, equipe };
module.exports = { contarUso, tamanhoKB, visitasRd, dataDe, noPeriodo };
