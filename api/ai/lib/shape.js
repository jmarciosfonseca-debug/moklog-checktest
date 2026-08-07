// ─────────────────────────────────────────────────────────────
// shape.js — Formato de retorno canônico das ferramentas + utilidades
//
// Todas as ferramentas retornam o MESMO envelope, para o modelo
// (e o frontend) tratarem de forma uniforme. Ver "PADRÃO DE RETORNO
// DAS FERRAMENTAS" no briefing.
// ─────────────────────────────────────────────────────────────

const { nowIso, TIMEZONE } = require("./time");

// IDs de projeto reais do app (auditados no App.jsx). Ferramentas usam
// esta lista para validar projectId e para varrer "todos os projetos".
const PROJECT_IDS = [
  "P601", "P602", "P604", "P605", "P606", "P607",
  "P311A", "P311B", "P505", "P260A",
];

const PROJECT_NAMES = {
  P601: "Golgi Cajamar", P602: "Golgi Mauá", P604: "Golgi Jundiaí",
  P605: "Golgi Dutra", P606: "Golgi Duque de Caxias", P607: "Golgi Brasília",
  P311A: "Mega Curitiba", P311B: "Mega Itajaí",
  P505: "Klog Guarulhos", P260A: "Jatinox P260A",
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function ok({ filters = {}, summary = {}, records = [], dataQualityWarnings = [], truncated = false }) {
  return {
    ok: true,
    asOf: nowIso(),
    timezone: TIMEZONE,
    filters,
    summary,
    records,
    dataQualityWarnings,
    truncated,
  };
}

function fail(errorCode, message, retryable = false) {
  return { ok: false, errorCode, message, retryable };
}

// Ordena registros: criticidade primeiro, depois mais antigo primeiro.
function sortBySeverityThenAge(records) {
  return [...records].sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity] ?? 9;
    const sb = SEVERITY_ORDER[b.severity] ?? 9;
    if (sa !== sb) return sa - sb;
    const ta = a.occurredAt ? Date.parse(a.occurredAt) : Infinity;
    const tb = b.occurredAt ? Date.parse(b.occurredAt) : Infinity;
    return ta - tb; // mais antigo primeiro
  });
}

// Molde de um registro; preenche defaults para manter o shape estável.
function record(partial) {
  return {
    projectId: partial.projectId || "",
    module: partial.module || "",
    recordId: partial.recordId || "",
    status: partial.status || "",
    severity: partial.severity || "info",
    occurredAt: partial.occurredAt || null,
    resolvedAt: partial.resolvedAt ?? null,
    durationMinutes: partial.durationMinutes ?? null,
    description: partial.description || "",
    evidence: partial.evidence || [],
    source: partial.source || { collection: "", recordId: "" },
  };
}

// Valida projectId opcional. Retorna {valid, id} — id normalizado em maiúsculas.
function validateProjectId(projectId) {
  if (projectId == null || projectId === "") return { valid: true, id: null };
  const id = String(projectId).toUpperCase().trim();
  if (!PROJECT_IDS.includes(id)) return { valid: false, id: null };
  return { valid: true, id };
}

// Resolve a lista de projetos a varrer a partir de um projectId opcional.
function resolveTargets(projectId) {
  return projectId ? [projectId] : PROJECT_IDS;
}

// Trunca uma lista a um limite de servidor, sinalizando truncamento.
function applyLimit(list, limit, hardMax = 200) {
  const cap = Math.min(Math.max(1, limit || hardMax), hardMax);
  const truncated = list.length > cap;
  return { rows: list.slice(0, cap), truncated };
}

module.exports = {
  PROJECT_IDS, PROJECT_NAMES, SEVERITY_ORDER,
  ok, fail, record, sortBySeverityThenAge,
  validateProjectId, resolveTargets, applyLimit,
};
