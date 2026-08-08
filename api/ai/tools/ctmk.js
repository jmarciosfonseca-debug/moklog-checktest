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
  ok, fail, classifyError, isGlobalConfigError, safeDebugFields, isPreviewEnv,
  record, sortBySeverityThenAge,
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
  const now = Date.now();
  const records = [];
  const warnings = [];

  // getDb() pode lançar na inicialização do Admin SDK (ex.: variável de
  // ambiente ausente/malformada). Isso acontece ANTES do loop, então
  // tratamos aqui — senão o erro sobe sem passar pelo diagnóstico da ferramenta.
  let db;
  try {
    db = getDb();
  } catch (e) {
    const c = classifyError(e, "get_ctmk_status:init");
    if (isPreviewEnv()) {
      try {
        // eslint-disable-next-line no-console
        console.warn("[ctmk-debug]", JSON.stringify({ tool: "get_ctmk_status", phase: "getDb", ...safeDebugFields(e) }));
      } catch (_) { /* ignore */ }
    }
    return fail(c.errorCode, c.message, c.retryable, { stage: c.stage, partial: false });
  }

  // Controle de varredura resiliente: uma falha pontual em um PID NÃO derruba
  // a consulta inteira. Só abortamos em erro global (config/auth).
  const attemptedProjects = [];
  const successfulProjects = [];
  const failedProjects = [];
  let firstError = null;
  let globalError = null;

  for (const pid of targets) {
    attemptedProjects.push(pid);
    let snap;
    try {
      snap = await db.collection("ctmk").doc(pid).get();
    } catch (e) {
      const c = classifyError(e, "get_ctmk_status");
      if (!firstError) firstError = c;
      failedProjects.push(pid);
      // Warning sanitizado (só PID + errorCode) — nunca mensagem bruta.
      warnings.push(`${pid}: falha na leitura de CTMK (${c.errorCode}).`);

      // Debug efêmero server-side — SOMENTE no Preview. Durante o diagnóstico,
      // registra QUALQUER erro (não só QUERY_FAILED) para revelar o código
      // técnico real. Só metadados seguros; nunca vai ao navegador nem à OpenAI.
      if (isPreviewEnv()) {
        try {
          // eslint-disable-next-line no-console
          console.warn("[ctmk-debug]", JSON.stringify({ tool: "get_ctmk_status", phase: "get", projectId: pid, errorCode: c.errorCode, ...safeDebugFields(e) }));
        } catch (_) { /* ignore */ }
      }

      // Erro global (permissão/credencial) → não adianta seguir; aborta.
      if (isGlobalConfigError(c)) { globalError = c; break; }
      continue;
    }
    successfulProjects.push(pid);
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

  // Erro global (permissão/credencial) → falha total, mesmo que algum PID
  // anterior tenha sido lido. Não misturar dados com autorização incompleta.
  if (globalError) {
    return fail(globalError.errorCode, globalError.message, globalError.retryable, { stage: globalError.stage, partial: false });
  }

  // Todos os projetos falharam (sem erro global) → ok:false com o 1º código
  // classificado. NÃO declarar "zero offline" nesse caso.
  if (successfulProjects.length === 0 && failedProjects.length > 0) {
    const c = firstError || { errorCode: "QUERY_FAILED", message: "Falha ao consultar CTMK.", retryable: false, stage: "get_ctmk_status" };
    return fail(c.errorCode, c.message, c.retryable, { stage: c.stage, partial: false });
  }

  const partial = failedProjects.length > 0;

  const envelope = ok({
    filters: { projectId: v.id, status: statusFilter },
    summary: {
      totalProjetosAlvo: targets.length,
      attemptedProjects: attemptedProjects.length,
      successfulProjects: successfulProjects.length,
      failedProjectCount: failedProjects.length,
      offline: offlineCount,
      online: records.length - offlineCount,
      maiorTempoOffline: rows.find(r => r.status === "offline")?.durationMinutes ?? null,
    },
    records: rows,
    dataQualityWarnings: warnings,
    truncated,
  });
  envelope.partial = partial;
  return envelope;
}

module.exports = { get_ctmk_status };
