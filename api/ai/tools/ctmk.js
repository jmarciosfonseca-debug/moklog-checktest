// ─────────────────────────────────────────────────────────────
// tools/ctmk.js — get_ctmk_status
//
// Fonte real (auditada em AnaliseRisco.jsx): coleção `ctmk/{pid}`,
// documento por projeto com campos:
//   status: "offline" | (outro/undefined = considerado online)
//   offlineSince: ISO string (quando offline)
//
// CTMK = central de câmera Moked (terminologia real do código).
// ─────────────────────────────────────────────────────────────

const { getDb } = require("../lib/firebaseAdmin");
const { toMillis, toIsoSaoPaulo, durationMinutes, humanDuration } = require("../lib/time");
const {
  ok, fail, failFrom, record, sortBySeverityThenAge,
  validateProjectId, resolveTargets, applyLimit, PROJECT_NAMES,
} = require("../lib/shape");

async function get_ctmk_status(args = {}) {
  const v = validateProjectId(args.projectId);
  if (!v.valid) return fail("VALIDATION_ERROR", "projectId inválido.");
  const statusFilter = args.status ? String(args.status).toLowerCase() : null;
  if (statusFilter && !["online", "offline", "partial", "unknown"].includes(statusFilter)) {
    return fail("VALIDATION_ERROR", "status inválido.");
  }

  const targets = resolveTargets(v.id);
  const db = getDb();
  const now = Date.now();
  const records = [];
  const warnings = [];

  for (const pid of targets) {
    let snap;
    try {
      snap = await db.collection("ctmk").doc(pid).get();
    } catch (e) {
      return failFrom(e, "get_ctmk_status");
    }
    if (!snap.exists) {
      warnings.push(`${pid}: sem registro de CTMK.`);
      continue;
    }
    const d = snap.data() || {};
    const isOffline = d.status === "offline";
    const status = isOffline ? "offline" : "online";

    if (statusFilter && statusFilter !== status && statusFilter !== "unknown") continue;

    let occurredAt = null, durMin = null, sinceMs = null;
    if (isOffline) {
      sinceMs = toMillis(d.offlineSince);
      if (sinceMs == null) {
        warnings.push(`${pid}: offline sem timestamp confiável (offlineSince ausente/ inválido).`);
      } else {
        occurredAt = toIsoSaoPaulo(sinceMs);
        durMin = durationMinutes(sinceMs, now);
      }
    }

    const days = durMin != null ? Math.floor(durMin / 1440) : null;
    let severity = "info";
    if (isOffline) severity = days != null && days >= 10 ? "critical" : days != null && days >= 3 ? "high" : "medium";

    records.push(record({
      projectId: pid,
      module: "ctmk",
      recordId: pid,
      status,
      severity,
      occurredAt,
      resolvedAt: null,
      durationMinutes: durMin,
      description: isOffline
        ? `CTMK off-line${days != null ? ` há ${days} dia(s)` : " (sem timestamp confiável)"}${durMin != null ? ` — ${humanDuration(durMin)} sem imagem` : ""}.`
        : "CTMK online.",
      evidence: [
        `Projeto ${PROJECT_NAMES[pid] || pid}`,
        isOffline && occurredAt ? `Desconectado desde ${occurredAt}` : null,
      ].filter(Boolean),
      source: { collection: "ctmk", recordId: pid },
    }));
  }

  // Ordena por maior tempo offline primeiro (offline antes de online).
  records.sort((a, b) => {
    const ao = a.status === "offline" ? 0 : 1;
    const bo = b.status === "offline" ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return (b.durationMinutes || 0) - (a.durationMinutes || 0);
  });

  const { rows, truncated } = applyLimit(records, args.limit, 50);
  const offlineCount = records.filter(r => r.status === "offline").length;

  return ok({
    filters: { projectId: v.id, status: statusFilter },
    summary: {
      totalProjetos: targets.length,
      offline: offlineCount,
      online: records.length - offlineCount,
      maiorTempoOffline: rows.find(r => r.status === "offline")?.durationMinutes ?? null,
    },
    records: rows,
    dataQualityWarnings: warnings,
    truncated,
  });
}

module.exports = { get_ctmk_status };
