// ─────────────────────────────────────────────────────────────
// tools/energy.js — get_recent_energy_events
//
// Fonte real (auditada em EnergiaOcorrencias.jsx): coleção
// `energia_ocorrencias/{pid}`, documento por projeto:
//   { eventos:[ { id, inicioQueda:ISO, fimQueda:ISO|null, turno,
//                 concluido:bool, arquivado:bool, criadoEm } ],
//     config:{ concessionaria, telefoneConcessionaria, monitorandoDesde } }
//
// Regra de qualidade: fimQueda ausente = "sem encerramento formal".
// NÃO expor telefone da concessionária.
// ─────────────────────────────────────────────────────────────

const { getDb } = require("../lib/firebaseAdmin");
const { toMillis, toIsoSaoPaulo, durationMinutes, humanDuration } = require("../lib/time");
const {
  ok, fail, failFrom, record, validateProjectId, resolveTargets, applyLimit, PROJECT_NAMES,
} = require("../lib/shape");

async function get_recent_energy_events(args = {}) {
  const v = validateProjectId(args.projectId);
  if (!v.valid) return fail("VALIDATION_ERROR", "projectId inválido.");

  const startMs = args.startDate ? toMillis(args.startDate) : null;
  const endMs = args.endDate ? toMillis(args.endDate) : null;
  const onlyOpen = !!args.onlyOpen;

  const targets = resolveTargets(v.id);
  const db = getDb();
  const records = [];
  const warnings = [];

  for (const pid of targets) {
    let snap;
    try {
      snap = await db.collection("energia_ocorrencias").doc(pid).get();
    } catch (e) {
      return failFrom(e, "get_recent_energy_events");
    }
    if (!snap.exists) continue;
    const data = snap.data() || {};
    const eventos = Array.isArray(data.eventos) ? data.eventos : [];
    const concessionaria = (data.config && data.config.concessionaria) || null;

    for (const ev of eventos) {
      const iniMs = toMillis(ev.inicioQueda);
      if (iniMs == null) { warnings.push(`${pid}: evento sem início válido (id ${ev.id || "?"}).`); continue; }
      if (startMs != null && iniMs < startMs) continue;
      if (endMs != null && iniMs > endMs) continue;

      const fimMs = toMillis(ev.fimQueda);
      const semEncerramento = fimMs == null;
      if (onlyOpen && !semEncerramento) continue;

      const durMin = fimMs != null ? durationMinutes(iniMs, fimMs) : null;

      // Divergência: marcado concluído mas sem fimQueda.
      if (ev.concluido === true && semEncerramento) {
        warnings.push(`${pid}: evento marcado como concluído porém sem horário de retorno (id ${ev.id || "?"}).`);
      }

      let severity = "medium";
      if (semEncerramento) severity = "high";
      else if (durMin != null && durMin >= 120) severity = "high";
      else if (durMin != null && durMin < 15) severity = "low";

      records.push(record({
        projectId: pid,
        module: "energia",
        recordId: ev.id || "",
        status: semEncerramento ? "sem encerramento formal" : "normalizado",
        severity,
        occurredAt: toIsoSaoPaulo(iniMs),
        resolvedAt: fimMs != null ? toIsoSaoPaulo(fimMs) : null,
        durationMinutes: durMin,
        description: semEncerramento
          ? `Queda de energia iniciada${ev.turno ? ` (turno ${ev.turno})` : ""} sem horário de retorno registrado.`
          : `Queda de energia de ${humanDuration(durMin)}${ev.turno ? ` (turno ${ev.turno})` : ""}.`,
        evidence: [
          `Projeto ${PROJECT_NAMES[pid] || pid}`,
          concessionaria ? `Concessionária ${concessionaria}` : null,
        ].filter(Boolean),
        source: { collection: "energia_ocorrencias", recordId: `${pid}/eventos/${ev.id || "?"}` },
      }));
    }
  }

  // mais recente primeiro para "últimas ocorrências"
  records.sort((a, b) => (Date.parse(b.occurredAt || 0) - Date.parse(a.occurredAt || 0)));
  const { rows, truncated } = applyLimit(records, args.limit, 100);

  return ok({
    filters: { projectId: v.id, startDate: args.startDate || null, endDate: args.endDate || null, onlyOpen },
    summary: {
      total: records.length,
      semEncerramento: records.filter(r => r.status === "sem encerramento formal").length,
    },
    records: rows,
    dataQualityWarnings: warnings,
    truncated,
  });
}

module.exports = { get_recent_energy_events };
