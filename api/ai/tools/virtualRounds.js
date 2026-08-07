// ─────────────────────────────────────────────────────────────
// tools/virtualRounds.js — get_virtual_round_nonconformities
//
// Fonte real (auditada em RondaVirtual.jsx): coleção `cco_ronda/{pid}`,
// documento por projeto com array `.turnos[]`. Cada turno:
//   { id, tipo:"noturno"|"diurno", dataInicio:"YYYY-MM-DD",
//     plantonista:{ nome, cargo }, arquivado, arquivadoEm,
//     rondas: { "<offsetMin>": { inicio, fim, atrasada, justificativa, obs } } }
//
// Só turnos ARQUIVADOS representam ciclos completos avaliáveis. Um
// turno em andamento NÃO é classificado como falta (regra do briefing).
//
// A grade de horários é reconstruída fielmente do app (buildSlots).
// ─────────────────────────────────────────────────────────────

const { getDb } = require("../lib/firebaseAdmin");
const { toMillis, toIsoSaoPaulo } = require("../lib/time");
const {
  ok, fail, record, validateProjectId, resolveTargets, applyLimit, PROJECT_NAMES,
} = require("../lib/shape");

// Projetos com grade especial de 30min (P311A / P311B).
const GRADE_ESPECIAL = new Set(["P311A", "P311B"]);

// Porta fiel de buildSlots(tipo, projectId) do RondaVirtual.jsx.
function buildSlots(tipo, projectId) {
  const slots = [];
  const especial = GRADE_ESPECIAL.has(projectId);
  const desloc = projectId === "P606" ? 1 : 0;
  if (tipo === "noturno") {
    const iniN = 18 + desloc;
    for (let h = iniN; h <= 22; h++) slots.push({ label: `${String(h).padStart(2, "0")}:00`, offsetMin: (h - iniN) * 60 });
    if (especial) {
      let off = (23 - iniN) * 60, cur = 23 * 60, fim = (24 + 5) * 60 + 30;
      while (cur <= fim) {
        const hh = Math.floor((cur % 1440) / 60), mm = cur % 60;
        slots.push({ label: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, offsetMin: off });
        cur += 30; off += 30;
      }
    } else {
      let off = (23 - iniN) * 60, cur = 23 * 60, fim = (24 + 5 + desloc) * 60;
      while (cur <= fim) {
        const hh = Math.floor((cur % 1440) / 60), mm = cur % 60;
        slots.push({ label: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, offsetMin: off });
        cur += 60; off += 60;
      }
    }
  } else {
    const iniD = 6 + desloc, fimD = 17 + desloc;
    for (let h = iniD; h <= fimD; h++) slots.push({ label: `${String(h).padStart(2, "0")}:00`, offsetMin: (h - iniD) * 60 });
  }
  return slots;
}

// Classifica um turno arquivado: conta executadas / atrasadas / sem evidência.
function analisarTurno(turno, projectId) {
  const slots = buildSlots(turno.tipo, projectId);
  const rondas = turno.rondas || {};
  let feitas = 0, atrasadas = 0, semEvidencia = 0;
  const horariosSemEvidencia = [];
  for (const s of slots) {
    const r = rondas[String(s.offsetMin)];
    if (r && r.inicio) {
      feitas += 1;
      if (r.atrasada) atrasadas += 1;
    } else {
      semEvidencia += 1;
      horariosSemEvidencia.push(s.label);
    }
  }
  return { previstas: slots.length, feitas, atrasadas, semEvidencia, horariosSemEvidencia };
}

async function get_virtual_round_nonconformities(args = {}) {
  const v = validateProjectId(args.projectId);
  if (!v.valid) return fail("VALIDATION_ERROR", "projectId inválido.");

  const startMs = args.startDate ? toMillis(args.startDate) : null;
  const endMs = args.endDate ? toMillis(args.endDate) : null;
  const shift = args.shift ? String(args.shift).toLowerCase() : null;
  if (shift && !["noturno", "diurno"].includes(shift)) return fail("VALIDATION_ERROR", "shift inválido.");
  const ncType = args.nonconformityType ? String(args.nonconformityType).toLowerCase() : null;

  const targets = resolveTargets(v.id);
  const db = getDb();
  const records = [];
  const warnings = [];

  for (const pid of targets) {
    let snap;
    try {
      snap = await db.collection("cco_ronda").doc(pid).get();
    } catch (e) {
      return fail("QUERY_FAILED", "Falha ao consultar rondas virtuais.", true);
    }
    if (!snap.exists) continue;
    const data = snap.data() || {};
    const turnos = Array.isArray(data.turnos) ? data.turnos : [];

    for (const t of turnos) {
      if (!t.arquivado) continue; // só ciclos completos
      if (shift && t.tipo !== shift) continue;
      const iniMs = toMillis(t.dataInicio);
      if (startMs != null && (iniMs == null || iniMs < startMs)) continue;
      if (endMs != null && (iniMs == null || iniMs > endMs)) continue;

      const a = analisarTurno(t, pid);
      const temNC = a.semEvidencia > 0 || a.atrasadas > 0;
      if (!temNC) continue;

      // Filtro por tipo de não conformidade, se pedido.
      if (ncType === "atraso" && a.atrasadas === 0) continue;
      if ((ncType === "falta" || ncType === "sem_evidencia") && a.semEvidencia === 0) continue;

      const pctFeitas = a.previstas ? Math.round((a.feitas / a.previstas) * 100) : 0;
      let severity = "low";
      if (a.semEvidencia > 0) severity = pctFeitas < 50 ? "critical" : pctFeitas < 80 ? "high" : "medium";
      else if (a.atrasadas > 0) severity = "low";

      const arqMs = toMillis(t.arquivadoEm);

      records.push(record({
        projectId: pid,
        module: "ronda_virtual",
        recordId: t.id || "",
        status: a.semEvidencia > 0 ? "horários sem evidência" : "com atraso",
        severity,
        occurredAt: iniMs != null ? toIsoSaoPaulo(iniMs) : null,
        resolvedAt: arqMs != null ? toIsoSaoPaulo(arqMs) : null,
        durationMinutes: null,
        description: [
          `Turno ${t.tipo || "?"} de ${t.dataInicio || "?"}:`,
          `${a.feitas}/${a.previstas} rondas evidenciadas (${pctFeitas}%)`,
          a.atrasadas ? `, ${a.atrasadas} com atraso` : "",
          a.semEvidencia ? `, ${a.semEvidencia} sem evidência` : "",
          ".",
        ].join(""),
        evidence: [
          `Projeto ${PROJECT_NAMES[pid] || pid}`,
          t.plantonista && t.plantonista.nome ? `Plantonista ${t.plantonista.nome}` : "Plantonista não informado",
          a.horariosSemEvidencia.length ? `Sem evidência: ${a.horariosSemEvidencia.slice(0, 12).join(", ")}${a.horariosSemEvidencia.length > 12 ? "…" : ""}` : null,
        ].filter(Boolean),
        source: { collection: "cco_ronda", recordId: `${pid}/turnos/${t.id || "?"}` },
      }));

      if (!(t.plantonista && t.plantonista.nome)) {
        warnings.push(`${pid}: turno ${t.id || "?"} sem plantonista responsável.`);
      }
    }
  }

  records.sort((x, y) => Date.parse(y.occurredAt || 0) - Date.parse(x.occurredAt || 0));
  const { rows, truncated } = applyLimit(records, args.limit, 100);

  return ok({
    filters: { projectId: v.id, startDate: args.startDate || null, endDate: args.endDate || null, shift, nonconformityType: ncType },
    summary: {
      turnosComNaoConformidade: records.length,
      comHorariosSemEvidencia: records.filter(r => r.status === "horários sem evidência").length,
      apenasAtraso: records.filter(r => r.status === "com atraso").length,
    },
    records: rows,
    dataQualityWarnings: warnings,
    truncated,
  });
}

module.exports = { get_virtual_round_nonconformities, buildSlots, analisarTurno };
