// Histórico de sinistros por projeto. Fonte real: sinistros/{projectId}.
// Somente leitura. Textos livres (observacao/tipoOutro) e atualizadoPor
// nunca são devolvidos ao modelo.
const { getDb } = require("../lib/firebaseAdmin");
const { get_project_vulnerabilities } = require("./vulnerabilities");
const { toMillis, toIsoSaoPaulo, ageDays } = require("../lib/time");
const {
  ok, fail, record, validateProjectId, resolveTargets, applyLimit, PROJECT_NAMES,
} = require("../lib/shape");

const TYPES = {
  invasao_perimetral: { label: "Invasão perimetral", nature: "perimetro" },
  roubo_bolsao: { label: "Roubo externo do bolsão", nature: "acesso" },
  furto: { label: "Furto", nature: "furto" },
  outro: { label: "Outro", nature: null },
};
const NO_INCIDENT_RANGES = new Set(["30d", "6m", "12m", "24m"]);
const LEVEL_BY_SEVERITY = { info: 1, low: 1, medium: 2, high: 3, critical: 4 };

async function loadRiskVectors(projectId) {
  const result = await get_project_vulnerabilities({ projectId });
  if (!result?.ok) return { vectors: [], warning: `${projectId}: não foi possível cruzar o sinistro com as vulnerabilidades do projeto.` };
  return {
    vectors: (result.records || []).map(item => ({
      label: item.description || item.category || item.module || "",
      nivel: LEVEL_BY_SEVERITY[item.severity] || 0,
    })),
    warning: null,
  };
}

// Espelha src/Sinistros.jsx::moduladorSinistro.
function computeSinistroModifier(data, vectors = [], nowMs = Date.now()) {
  if (!data || typeof data.houve !== "boolean") return { delta: 0, reason: null, days: null, matched: false };
  if (data.houve === false) {
    return data.semSinistroFaixa === "24m"
      ? { delta: -1, reason: "sem sinistros há 24 meses ou mais", days: null, matched: false }
      : { delta: 0, reason: "sem sinistro recente registrado", days: null, matched: false };
  }

  const occurredMs = toMillis(data.dataOcorrido);
  const days = occurredMs == null ? null : ageDays(occurredMs, nowMs);
  const type = TYPES[data.tipo] || null;
  const pattern = {
    perimetro: /perimetr|cerca|bollard/i,
    acesso: /cancela|eclusa|portao|acesso|garra|dilacerador/i,
    furto: /cftv|camera|monitor|ctmk/i,
  }[type?.nature];
  const matched = !!(pattern && Array.isArray(vectors)
    && vectors.some(v => pattern.test(String(v?.label || "")) && Number(v?.nivel || 0) >= 3));

  let delta;
  if (days != null && days <= 180) delta = matched ? 2 : 1;
  else if (days != null && days <= 365) delta = 1;
  else delta = matched ? 1 : 0;
  const when = days != null ? `há ${days} dias` : "em data não informada";
  const matchText = matched ? ", coincidente com vulnerabilidade operacional da mesma natureza" : "";
  return {
    delta,
    reason: `sinistro registrado (${type?.label || "outro"}) ${when}${matchText}`,
    days,
    matched,
  };
}

function severityForIncident(days) {
  if (days == null) return "medium";
  if (days <= 180) return "high";
  if (days <= 365) return "medium";
  return "low";
}

async function get_project_sinistro_history(args = {}) {
  const validation = validateProjectId(args.projectId);
  if (!validation.valid) return fail("VALIDATION_ERROR", "projectId inválido.");
  const startMs = args.startDate ? toMillis(args.startDate) : null;
  const endMs = args.endDate ? toMillis(args.endDate) : null;
  const onlyOccurred = !!args.onlyOccurred;
  const records = [];
  const warnings = [];
  const db = getDb();

  for (const pid of resolveTargets(validation.id)) {
    let snap;
    try { snap = await db.collection("sinistros").doc(pid).get(); }
    catch { return fail("QUERY_FAILED", "Falha ao consultar histórico de sinistros.", true); }
    if (!snap.exists) { warnings.push(`${pid}: sem registro de sinistros.`); continue; }
    const data = snap.data() || {};
    if (typeof data.houve !== "boolean") { warnings.push(`${pid}: campo houve ausente ou inválido.`); continue; }
    if (onlyOccurred && !data.houve) continue;

    if (data.houve) {
      const occurredMs = toMillis(data.dataOcorrido);
      if (occurredMs == null) warnings.push(`${pid}: sinistro registrado sem data válida.`);
      if ((startMs != null || endMs != null) && occurredMs == null) continue;
      if (startMs != null && occurredMs < startMs) continue;
      if (endMs != null && occurredMs > endMs) continue;
      if (!TYPES[data.tipo]) warnings.push(`${pid}: tipo de sinistro ausente ou inválido.`);
      const risk = await loadRiskVectors(pid);
      if (risk.warning) warnings.push(risk.warning);
      const modifier = computeSinistroModifier(data, risk.vectors);
      const type = TYPES[data.tipo] || null;
      records.push(record({
        projectId: pid,
        module: "sinistros",
        recordId: pid,
        status: "sinistro registrado",
        severity: severityForIncident(modifier.days),
        occurredAt: occurredMs == null ? null : toIsoSaoPaulo(occurredMs),
        description: `${type?.label || "Sinistro de tipo não informado"}${modifier.days == null ? ", sem data válida" : `, há ${modifier.days} dias`}.`,
        evidence: [
          `Projeto ${PROJECT_NAMES[pid] || pid}`,
          `Modulador base de risco: ${modifier.delta >= 0 ? "+" : ""}${modifier.delta}`,
          modifier.matched ? "Coincide com vulnerabilidade operacional da mesma natureza" : null,
          type?.nature ? `Natureza: ${type.nature}` : null,
        ].filter(Boolean),
        source: { collection: "sinistros", recordId: pid },
      }));
    } else {
      const range = NO_INCIDENT_RANGES.has(data.semSinistroFaixa) ? data.semSinistroFaixa : null;
      if (!range) warnings.push(`${pid}: faixa sem sinistro ausente ou inválida.`);
      const modifier = computeSinistroModifier(data);
      records.push(record({
        projectId: pid,
        module: "sinistros",
        recordId: pid,
        status: "sem sinistro declarado",
        severity: range === "24m" ? "low" : "info",
        description: range ? `Sem sinistro na faixa declarada (${range}).` : "Sem sinistro declarado, mas sem faixa temporal válida.",
        evidence: [
          `Projeto ${PROJECT_NAMES[pid] || pid}`,
          `Modulador de risco: ${modifier.delta}`,
        ],
        source: { collection: "sinistros", recordId: pid },
      }));
    }
  }

  records.sort((a, b) => Date.parse(b.occurredAt || 0) - Date.parse(a.occurredAt || 0));
  const { rows, truncated } = applyLimit(records, args.limit, 100);
  return ok({
    filters: { projectId: validation.id, startDate: args.startDate || null, endDate: args.endDate || null, onlyOccurred },
    summary: {
      projetosComDados: records.length,
      comSinistro: records.filter(r => r.status === "sinistro registrado").length,
      semSinistro: records.filter(r => r.status === "sem sinistro declarado").length,
      atenuados24m: records.filter(r => r.status === "sem sinistro declarado" && r.evidence.includes("Modulador de risco: -1")).length,
    },
    records: rows,
    dataQualityWarnings: warnings,
    truncated,
  });
}

module.exports = { get_project_sinistro_history, computeSinistroModifier, TYPES };
