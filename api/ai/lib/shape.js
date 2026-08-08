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

// Envelope de erro canônico. Só deixa passar metadata sanitizada e
// permitida (stage, partial); qualquer outro campo de meta é descartado.
// A assinatura antiga fail(code, msg, retryable) continua válida.
const ALLOWED_ERROR_META = ["stage", "partial"];

function fail(errorCode, message, retryable = false, meta = null) {
  const out = { ok: false, errorCode, message, retryable };
  if (meta && typeof meta === "object") {
    for (const k of ALLOWED_ERROR_META) {
      if (meta[k] !== undefined) out[k] = meta[k];
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// classifyError — mapeia um erro real (Firestore/Admin/rede) para um
// errorCode estável, retryable correto e mensagem SANITIZADA (nunca a
// mensagem bruta). Reconhece SOMENTE códigos/sinais específicos; não
// usa classificações amplas como "environment"/"invalid" isoladas.
// Aceita um `stage` opcional para rastrear a origem (ferramenta/etapa).
// ─────────────────────────────────────────────────────────────

// gRPC/Firestore status codes numéricos → nome canônico.
const GRPC_CODE_NAMES = {
  1: "cancelled",
  2: "unknown",
  3: "invalid-argument",
  4: "deadline-exceeded",
  5: "not-found",
  7: "permission-denied",
  8: "resource-exhausted",
  9: "failed-precondition",
  10: "aborted",
  13: "internal",
  14: "unavailable",
  16: "unauthenticated",
};

// Mapa canônico: código reconhecido → { errorCode, retryable, message }.
const ERROR_TABLE = {
  "permission-denied": { errorCode: "PERMISSION_DENIED", retryable: false, message: "Sem permissão para ler estes dados no banco." },
  "unauthenticated": { errorCode: "UNAUTHENTICATED", retryable: false, message: "Credencial do servidor inválida ao acessar o banco." },
  "unavailable": { errorCode: "UNAVAILABLE", retryable: true, message: "Banco temporariamente indisponível. Tente novamente." },
  "deadline-exceeded": { errorCode: "DEADLINE_EXCEEDED", retryable: true, message: "A consulta demorou demais. Tente novamente." },
  "resource-exhausted": { errorCode: "RESOURCE_EXHAUSTED", retryable: true, message: "Limite de uso do banco atingido. Tente novamente em instantes." },
  "aborted": { errorCode: "ABORTED", retryable: true, message: "Operação interrompida pelo banco. Tente novamente." },
  "cancelled": { errorCode: "CANCELLED", retryable: true, message: "Operação cancelada. Tente novamente." },
  "internal": { errorCode: "INTERNAL", retryable: true, message: "Erro interno do banco. Tente novamente." },
  "not-found": { errorCode: "NOT_FOUND", retryable: false, message: "Recurso não encontrado no banco." },
  "failed-precondition": { errorCode: "FAILED_PRECONDITION", retryable: false, message: "Pré-condição do banco não satisfeita (ex.: índice ausente)." },
  "invalid-argument": { errorCode: "INVALID_ARGUMENT", retryable: false, message: "Argumento inválido enviado ao banco." },
};

// Extrai um nome de código canônico do erro, sem confiar em texto livre.
function extractCode(e) {
  if (!e || typeof e !== "object") return null;

  // 1) code numérico (gRPC) — só se for inteiro conhecido.
  if (typeof e.code === "number" && GRPC_CODE_NAMES[e.code]) {
    return GRPC_CODE_NAMES[e.code];
  }
  // 2) code string exatamente igual a um código canônico conhecido.
  if (typeof e.code === "string") {
    const c = e.code.toLowerCase();
    if (ERROR_TABLE[c]) return c;
    if (GRPC_CODE_NAMES[e.code]) return GRPC_CODE_NAMES[e.code]; // "7" etc.
  }
  // 3) status textual (algumas libs usam e.status).
  if (typeof e.status === "string") {
    const s = e.status.toLowerCase().replace(/_/g, "-");
    if (ERROR_TABLE[s]) return s;
  }
  return null;
}

function classifyError(e, stage = null) {
  const code = extractCode(e);
  if (code && ERROR_TABLE[code]) {
    const t = ERROR_TABLE[code];
    return { errorCode: t.errorCode, retryable: t.retryable, message: t.message, stage: stage || null };
  }
  // Desconhecido: NÃO assume retryable:true cego. Mensagem sanitizada,
  // sem vazar texto bruto do erro.
  return { errorCode: "QUERY_FAILED", retryable: false, message: "Falha ao consultar o banco.", stage: stage || null };
}

// failFrom — atalho: classifica o erro e monta o envelope fail() já com
// stage (e partial, se aplicável) preservados.
function failFrom(e, stage = null, extraMeta = null) {
  const c = classifyError(e, stage);
  const meta = { stage: c.stage };
  if (extraMeta && extraMeta.partial !== undefined) meta.partial = extraMeta.partial;
  return fail(c.errorCode, c.message, c.retryable, meta);
}

// ─────────────────────────────────────────────────────────────
// stableToolKey — chave estável para deduplicar chamadas de ferramenta
// dentro de UMA pergunta. Ordena as chaves do objeto de argumentos de
// forma recursiva, para que {a:1,b:2} e {b:2,a:1} gerem a MESMA chave.
// ─────────────────────────────────────────────────────────────
function sortedStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(sortedStringify).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + sortedStringify(value[k])).join(",") + "}";
}

function stableToolKey(name, args) {
  let parsed = args;
  if (typeof args === "string") {
    try { parsed = JSON.parse(args || "{}"); } catch (e) { parsed = { __raw: String(args) }; }
  }
  if (parsed == null || typeof parsed !== "object") parsed = {};
  return String(name) + "|" + sortedStringify(parsed);
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
  ok, fail, failFrom, classifyError, stableToolKey,
  record, sortBySeverityThenAge,
  validateProjectId, resolveTargets, applyLimit,
};
