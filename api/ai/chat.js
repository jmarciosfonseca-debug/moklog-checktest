// ─────────────────────────────────────────────────────────────
// /api/ai/chat — Endpoint principal do Assistente IA Gerencial (BACKEND)
//
// Fluxo (Responses API): valida sessão gerencial → rate limit → monta
// input (system + histórico + pergunta) → loop de tool calling
// (máx AI_MAX_TOOL_CALLS) → resposta final.
//
// Somente leitura. Chave OpenAI e Firebase Admin nunca saem daqui.
// Logs sanitizados (sem PIN, sem chave, sem conteúdo pessoal).
// ─────────────────────────────────────────────────────────────

const crypto = require("crypto");
const { requireGerencial, sessionFingerprint } = require("./lib/auth");
const { check } = require("./lib/rateLimit");
const {
  callModel, model, toResponsesTools, toolResultItem,
} = require("./lib/openai");
const { TOOL_SCHEMAS, runTool } = require("./tools/index");
const { SYSTEM_PROMPT, buildDateContext } = require("./lib/systemPrompt");

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_MESSAGES = 20;

function setCors(res) {
  const origin = process.env.AI_ALLOWED_ORIGIN || "";
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function maxToolCalls() {
  const n = parseInt(process.env.AI_MAX_TOOL_CALLS || "8", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 8) : 8;
}

function logEvent(ev) {
  try { console.log(JSON.stringify({ svc: "ai_chat", ...ev })); } catch (e) { /* noop */ }
}

// Converte uma mensagem simples {role, content} em item da Responses API.
function msgItem(role, content) {
  return { role, content: String(content == null ? "" : content) };
}

function cleanPlainText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, block => block.replace(/```[^\n]*\n?/g, ""))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractProjectId(message) {
  const match = String(message || "").toUpperCase().match(/\bP\d{3,4}[A-C]?\b/);
  return match ? match[0] : null;
}

function requiredPrefetch(message, now = new Date()) {
  const text = String(message || "").toLowerCase();
  if (/((pior|melhor|menor|maior).{0,35}(índice|percentual|saúde)|(índice|percentual|saúde).{0,35}(pior|melhor|menor|maior))/.test(text)) {
    return { name: "get_health_ranking", args: { order: /(melhor|maior)/.test(text) ? "best" : "worst" }, reason: "A pergunta pede ranking numérico de saúde do dashboard." };
  }
  if (/\b(equipe|efetivo|colaborador(?:es)?|afastamento(?:s)?|férias|ferias|cobertura(?:s)?)\b/.test(text)) {
    return { name: "get_staffing_and_vacation_gaps", args: { projectId: extractProjectId(message) || undefined }, reason: "A pergunta é sobre equipe/efetivo." };
  }
  if (/\b(ronda|rondas|teste|testes)\s+perimetra/.test(text) && /\b(menor|maior|menos|mais|ranking|compar)/.test(text)) {
    const c = buildDateContext(now);
    return { name: "get_perimeter_round_gaps", args: { startDate: c.last7Start, endDate: c.today }, reason: "A pergunta pede comparação de rondas perimetrais." };
  }
  return null;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const requestId = crypto.randomUUID();
  const t0 = Date.now();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, errorCode: "VALIDATION_ERROR", message: "Método não permitido." });
  }

  // 1. Autorização gerencial (token assinado pelo servidor).
  const auth = requireGerencial(req);
  const sid = sessionFingerprint(req);
  if (!auth.authorized) {
    logEvent({ requestId, sid, event: "unauthorized", reason: auth.reason });
    return res.status(401).json({ ok: false, errorCode: "UNAUTHORIZED", message: "Sessão gerencial inválida ou expirada." });
  }

  // 2. Rate limit por sessão.
  const rl = check(`chat:${sid}`);
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    logEvent({ requestId, sid, event: "rate_limited" });
    return res.status(429).json({ ok: false, errorCode: "RATE_LIMIT", message: "Muitas perguntas em pouco tempo. Aguarde um instante." });
  }

  // 3. Validação de entrada.
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const userMessage = body && body.message;
  const history = Array.isArray(body && body.history) ? body.history : [];

  if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) {
    return res.status(400).json({ ok: false, errorCode: "VALIDATION_ERROR", message: "Mensagem vazia." });
  }
  if (userMessage.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ ok: false, errorCode: "VALIDATION_ERROR", message: `Mensagem muito longa (máx ${MAX_MESSAGE_CHARS} caracteres).` });
  }

  const safeHistory = history
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY_MESSAGES)
    .map(m => msgItem(m.role, String(m.content).slice(0, MAX_MESSAGE_CHARS)));

  // Input inicial da Responses API: system + histórico + pergunta.
  const input = [
    msgItem("system", SYSTEM_PROMPT(new Date())),
    ...safeHistory,
    msgItem("user", userMessage),
  ];

  const tools = toResponsesTools(TOOL_SCHEMAS);
  const toolsUsed = [];
  let toolCallCount = 0;
  const cap = maxToolCalls();

  try {
    const prefetch = requiredPrefetch(userMessage, new Date());
    if (prefetch) {
      const canonical = await runTool(prefetch.name, prefetch.args);
      toolsUsed.push(prefetch.name);
      toolCallCount += 1;
      input.push(msgItem("system", `FONTE CANÔNICA OBRIGATÓRIA (${prefetch.reason})\nFerramenta: ${prefetch.name}\nResultado: ${JSON.stringify(canonical)}\nResponda a partir deste resultado. Não substitua esta métrica por outra ferramenta.`));
    }
    // Ranking de saúde é uma métrica fechada do dashboard. Depois da leitura
    // canônica, não oferecemos outras ferramentas ao modelo: isso impede que
    // CTMK/criticidade seja confundido com o menor percentual de saúde.
    const modelTools = prefetch && prefetch.name === "get_health_ranking" ? [] : tools;
    for (let step = 0; step < cap + 1; step++) {
      const { outputText, toolCalls, raw } = await callModel({ input, tools: modelTools });

      if (!toolCalls || toolCalls.length === 0) {
        const durationMs = Date.now() - t0;
        logEvent({ requestId, sid, event: "completed", model: model(), tools: toolsUsed, toolCalls: toolCallCount, durationMs });
        return res.status(200).json({
          ok: true,
          answer: cleanPlainText(outputText || ""),
          toolsUsed,
          asOf: new Date().toISOString(),
          requestId,
        });
      }

      // Preserva TODOS os itens de saída do modelo desta rodada (function_call
      // e, em modelos de raciocínio, blocos de reasoning intermediários). Na
      // Responses API com histórico gerenciado manualmente, descartar itens
      // pode quebrar a continuidade do tool calling — então reinjetamos raw.output
      // inteiro antes dos function_call_output correspondentes.
      if (raw && Array.isArray(raw.output)) input.push(...raw.output);

      // Executa cada ferramenta e injeta o resultado.
      for (const call of toolCalls) {
        if (toolCallCount >= cap) {
          input.push(toolResultItem(call.id, { ok: false, errorCode: "LIMIT", message: "Limite de consultas atingido." }));
          continue;
        }
        toolCallCount += 1;
        const result = await runTool(call.name, call.arguments);
        toolsUsed.push(call.name);
        input.push(toolResultItem(call.id, result));
      }
    }

    const durationMs = Date.now() - t0;
    logEvent({ requestId, sid, event: "tool_loop_exhausted", tools: toolsUsed, toolCalls: toolCallCount, durationMs });
    return res.status(200).json({
      ok: true,
      answer: "Consultei os dados, mas atingi o limite de consultas por pergunta antes de concluir. Refaça a pergunta de forma mais específica (ex.: um projeto ou um período).",
      toolsUsed,
      asOf: new Date().toISOString(),
      requestId,
    });
  } catch (e) {
    logEvent({ requestId, sid, event: "error", message: String(e && e.message).slice(0, 200), tools: toolsUsed });
    return res.status(500).json({ ok: false, errorCode: "QUERY_FAILED", message: "Erro ao processar a pergunta.", retryable: true });
  }
};

module.exports.cleanPlainText = cleanPlainText;
module.exports.extractProjectId = extractProjectId;
module.exports.requiredPrefetch = requiredPrefetch;

