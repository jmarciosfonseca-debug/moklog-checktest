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
const { SYSTEM_PROMPT } = require("./lib/systemPrompt");

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
    msgItem("system", SYSTEM_PROMPT),
    ...safeHistory,
    msgItem("user", userMessage),
  ];

  const tools = toResponsesTools(TOOL_SCHEMAS);
  const toolsUsed = [];
  let toolCallCount = 0;
  const cap = maxToolCalls();

  try {
    for (let step = 0; step < cap + 1; step++) {
      const { outputText, toolCalls, raw } = await callModel({ input, tools });

      if (!toolCalls || toolCalls.length === 0) {
        const durationMs = Date.now() - t0;
        logEvent({ requestId, sid, event: "completed", model: model(), tools: toolsUsed, toolCalls: toolCallCount, durationMs });
        return res.status(200).json({
          ok: true,
          answer: outputText || "",
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
