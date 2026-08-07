// ─────────────────────────────────────────────────────────────
// tools/weeklyReports.js — get_weekly_report_items
//
// Fonte real (auditada em AcessoCCO.jsx): coleção `equipamentos/{pid}`.
// O documento tem arrays por categoria (ex.: cftv, cancelas, alarme…),
// cada item { id, identificacao, status, justificativa, dataProblem }.
// status danificado = "inop" | "critico" | "parcial" | "baixo".
//
// A idade da pendência vem de `dataProblem` (mesma lógica de
// pendencias.js: daysSince). Itens INOP há >30 dias são os alvos.
//
// NOTA: a lista exata de chaves de categoria (EQUIP_CATS) vive no app;
// aqui varremos TODAS as chaves de array do documento de forma genérica,
// o que é aditivo e resistente a mudanças de catálogo.
// ─────────────────────────────────────────────────────────────

const { getDb } = require("../lib/firebaseAdmin");
const { toMillis, toIsoSaoPaulo, ageDays } = require("../lib/time");
const {
  ok, fail, record, validateProjectId, resolveTargets, applyLimit, PROJECT_NAMES,
} = require("../lib/shape");

const DANIFICADO = new Set(["inop", "critico", "parcial", "baixo"]);

async function get_weekly_report_items(args = {}) {
  const v = validateProjectId(args.projectId);
  if (!v.valid) return fail("VALIDATION_ERROR", "projectId inválido.");

  const statusFilter = args.status ? String(args.status).toLowerCase() : null;
  const olderThanDays = args.olderThanDays != null ? parseInt(args.olderThanDays, 10) : null;

  const targets = resolveTargets(v.id);
  const db = getDb();
  const now = Date.now();
  const records = [];
  const warnings = [];

  for (const pid of targets) {
    let snap;
    try {
      snap = await db.collection("equipamentos").doc(pid).get();
    } catch (e) {
      return fail("QUERY_FAILED", "Falha ao consultar equipamentos.", true);
    }
    if (!snap.exists) continue;
    const data = snap.data() || {};

    // Varre genericamente arrays de itens + o objeto "moto" (caso especial).
    const buckets = [];
    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val)) buckets.push([key, val]);
    }
    if (data.moto && typeof data.moto === "object") buckets.push(["moto", [data.moto]]);

    for (const [catKey, items] of buckets) {
      for (const it of items) {
        if (!it || typeof it !== "object") continue;
        const status = String(it.status || "").toLowerCase();
        if (!DANIFICADO.has(status)) continue;
        if (statusFilter && status !== statusFilter) continue;

        const dpMs = toMillis(it.dataProblem);
        const idade = dpMs != null ? ageDays(dpMs, now) : null;
        if (olderThanDays != null && (idade == null || idade < olderThanDays)) continue;
        if (idade == null) warnings.push(`${pid}/${catKey}: item ${it.identificacao || it.id || "?"} sem dataProblem (idade desconhecida).`);

        let severity = "medium";
        if (status === "inop" || status === "critico") severity = idade != null && idade >= 30 ? "critical" : idade != null && idade >= 6 ? "high" : "medium";
        else if (status === "parcial") severity = idade != null && idade >= 30 ? "high" : "medium";
        else severity = "low";

        records.push(record({
          projectId: pid,
          module: "equipamentos",
          recordId: it.id || `${catKey}-${it.identificacao || "?"}`,
          status,
          severity,
          occurredAt: dpMs != null ? toIsoSaoPaulo(dpMs) : null,
          resolvedAt: null,
          durationMinutes: null,
          description: `${catKey}: ${it.identificacao || "item"} em ${status.toUpperCase()}${idade != null ? ` há ${idade} dia(s)` : " (data de abertura ausente)"}${it.justificativa ? ` — ${it.justificativa}` : ""}.`,
          evidence: [
            `Projeto ${PROJECT_NAMES[pid] || pid}`,
            `Categoria ${catKey}`,
            idade != null ? `${idade}d em aberto` : "sem data de abertura",
          ],
          source: { collection: "equipamentos", recordId: `${pid}/${catKey}` },
        }));
      }
    }
  }

  // ordena: mais antigo primeiro (maior idade), depois criticidade
  records.sort((a, b) => {
    const ia = a.occurredAt ? Date.parse(a.occurredAt) : Infinity;
    const ib = b.occurredAt ? Date.parse(b.occurredAt) : Infinity;
    return ia - ib;
  });
  const { rows, truncated } = applyLimit(records, args.limit, 150);

  return ok({
    filters: { projectId: v.id, status: statusFilter, olderThanDays },
    summary: {
      total: records.length,
      inop: records.filter(r => r.status === "inop").length,
      parcial: records.filter(r => r.status === "parcial").length,
      acima30dias: records.filter(r => r.occurredAt && ageDays(Date.parse(r.occurredAt), now) >= 30).length,
    },
    records: rows,
    dataQualityWarnings: warnings,
    truncated,
  });
}

module.exports = { get_weekly_report_items };
