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
// Normaliza um candidato a código: minúsculas, remove namespace conhecido
// (ex.: "firestore/permission-denied" → "permission-denied"), troca "_" por "-".
// NÃO interpreta texto livre — apenas formata um token de código.
function normalizeCodeToken(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // Só aceita tokens curtos e seguros (evita frases/mensagens).
  if (s.length > 40) return null;
  if (!/^[A-Za-z0-9_/.\-]+$/.test(s)) return null;
  s = s.toLowerCase();
  // Remove SOMENTE namespaces conhecidos antes da barra (não qualquer prefixo).
  const KNOWN_NS = ["firestore/", "grpc/", "google/", "admin/", "app/", "auth/"];
  for (const ns of KNOWN_NS) {
    if (s.startsWith(ns)) { s = s.slice(ns.length); break; }
  }
  // Normaliza separadores.
  s = s.replace(/_/g, "-");
  return s;
}

function extractCode(e) {
  if (!e || typeof e !== "object") return null;

  // 1) code numérico (gRPC) — só se for inteiro conhecido.
  if (typeof e.code === "number" && GRPC_CODE_NAMES[e.code]) {
    return GRPC_CODE_NAMES[e.code];
  }
  // 2) code string: numérica ("7"), canônica, com namespace, ou MAIÚSCULA/underscore.
  if (typeof e.code === "string") {
    // string numérica pura → mapa gRPC
    if (/^\d+$/.test(e.code.trim())) {
      const n = parseInt(e.code.trim(), 10);
      if (GRPC_CODE_NAMES[n]) return GRPC_CODE_NAMES[n];
    }
    const tok = normalizeCodeToken(e.code);
    if (tok && ERROR_TABLE[tok]) return tok;
  }
  // 3) status textual (algumas libs usam e.status): número, string numérica ou token.
  if (typeof e.status === "number" && GRPC_CODE_NAMES[e.status]) {
    return GRPC_CODE_NAMES[e.status];
  }
  if (typeof e.status === "string") {
    if (/^\d+$/.test(e.status.trim())) {
      const n = parseInt(e.status.trim(), 10);
      if (GRPC_CODE_NAMES[n]) return GRPC_CODE_NAMES[n];
    }
    const tok = normalizeCodeToken(e.status);
    if (tok && ERROR_TABLE[tok]) return tok;
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

// isGlobalConfigError — erro que NÃO adianta continuar tentando outros PIDs
// (credencial/autenticação/config). Nesses casos abortamos a varredura.
// Pontuais (unavailable, deadline, aborted, internal, not-found, etc.) NÃO
// são globais: seguimos para o próximo PID.
function isGlobalConfigError(classified) {
  if (!classified) return false;
  return classified.errorCode === "PERMISSION_DENIED"
      || classified.errorCode === "UNAUTHENTICATED";
}

// isPreviewEnv — verdadeiro SOMENTE no ambiente Preview da Vercel.
// Em Production, Development ou unknown retorna false. Garante que o log de
// debug efêmero jamais rode em produção.
function isPreviewEnv() {
  return process.env.VERCEL_ENV === "preview";
}

// safeDebugFields — extrai APENAS metadados seguros de um erro, para log
// server-side efêmero no Preview. Nunca message, nunca stack, nunca dados.
// Só tipos/códigos curtos e os NOMES das propriedades.
function safeDebugFields(e) {
  const out = {};
  if (!e || typeof e !== "object") { out.typeofError = typeof e; return out; }
  out.typeofCode = typeof e.code;
  if ((typeof e.code === "string" && e.code.length <= 40 && /^[A-Za-z0-9_/.\-]+$/.test(e.code)) || typeof e.code === "number") {
    out.code = e.code;
  }
  if (typeof e.name === "string" && e.name.length <= 60 && /^[A-Za-z0-9_/.\-]+$/.test(e.name)) out.name = e.name;
  if ((typeof e.status === "string" && e.status.length <= 40 && /^[A-Za-z0-9_/.\-]+$/.test(e.status)) || typeof e.status === "number") {
    out.status = e.status;
  }
  try { out.keys = Object.keys(e).slice(0, 20); } catch (_) { /* ignore */ }
  return out;
}
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
  isGlobalConfigError, safeDebugFields, isPreviewEnv,
  record, sortBySeverityThenAge,
  validateProjectId, resolveTargets, applyLimit,
};
