// ─────────────────────────────────────────────────────────────
// openai.js — Wrapper da OpenAI via RESPONSES API (BACKEND ONLY)
//
// A chave (OPENAI_API_KEY) vive SÓ aqui, no servidor. Jamais no
// bundle, jamais com prefixo REACT_APP_.
//
// Modelo 100% configurável por OPENAI_MODEL (inicial: gpt-5.6-terra).
// Confirmado (documentação OpenAI): gpt-5.6-terra é válido e a
// Responses API é indicada para raciocínio, conversação e tool calling.
//
// Este wrapper isola a Responses API. O restante do sistema (chat.js,
// tools) fala com um contrato estável via as funções abaixo:
//
//   toResponsesTools(chatTools)  → converte schema p/ o formato Responses
//   callModel({ input, tools })  → uma rodada; devolve { outputText, toolCalls[], raw }
//   toolResultItem(callId, json) → monta o item de retorno de ferramenta
//   assistantEchoItems(raw)      → itens function_call a reinjetar no input
// ─────────────────────────────────────────────────────────────

const OpenAI = require("openai");

let _client = null;
function client() {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente.");
  _client = new OpenAI({ apiKey });
  return _client;
}

function model() {
  return process.env.OPENAI_MODEL || "gpt-5.6-terra";
}

function reasoningEffort() {
  const e = (process.env.OPENAI_REASONING || "low").toLowerCase();
  return ["low", "medium", "high"].includes(e) ? e : "low";
}

// Converte tools do formato Chat Completions ({type:"function", function:{name,…}})
// para o formato da Responses API ({type:"function", name, description, parameters}).
function toResponsesTools(chatTools) {
  return (chatTools || []).map((t) => {
    const f = t.function || t;
    return {
      type: "function",
      name: f.name,
      description: f.description || "",
      parameters: f.parameters || { type: "object", properties: {} },
    };
  });
}

// Monta o item de RESULTADO de ferramenta para reinjetar no input.
// Na Responses API é { type:"function_call_output", call_id, output }.
function toolResultItem(callId, resultObj) {
  return {
    type: "function_call_output",
    call_id: callId,
    output: typeof resultObj === "string" ? resultObj : JSON.stringify(resultObj),
  };
}

// DEPRECADO (mantido por compatibilidade). Extrai só os function_call.
// O chat.js NÃO usa mais esta função: ele preserva raw.output inteiro
// (incluindo blocos de reasoning) entre as rodadas, o que é mais robusto
// para modelos de raciocínio na Responses API. Mantido apenas para não
// quebrar contrato de importação externo.
function assistantEchoItems(raw) {
  const out = [];
  const items = (raw && raw.output) || [];
  for (const it of items) {
    if (it && it.type === "function_call") {
      out.push({
        type: "function_call",
        call_id: it.call_id,
        name: it.name,
        arguments: it.arguments || "{}",
      });
    }
  }
  return out;
}

// Fallback de extração de texto, caso output_text não venha.
function extractText(resp) {
  const parts = [];
  for (const it of (resp.output || [])) {
    if (it && it.type === "message" && Array.isArray(it.content)) {
      for (const c of it.content) {
        if (c && (c.type === "output_text" || c.type === "text") && typeof c.text === "string") parts.push(c.text);
      }
    }
  }
  return parts.join("\n");
}

// Uma rodada do modelo via Responses API.
// input: array de items (system/user/tool outputs/echoes).
// tools: já no formato Responses (use toResponsesTools).
// Retorna { outputText, toolCalls:[{id,name,arguments}], raw }.
async function callModel({ input, tools }) {
  const params = {
    model: model(),
    input,
    tools,
    tool_choice: "auto",
  };
  const eff = reasoningEffort();
  if (eff) {
    params.reasoning = { effort: eff };
  }

  const resp = await client().responses.create(params);

  const outputText = resp.output_text != null ? resp.output_text : extractText(resp);

  const toolCalls = [];
  for (const it of (resp.output || [])) {
    if (it && it.type === "function_call") {
      toolCalls.push({ id: it.call_id, name: it.name, arguments: it.arguments || "{}" });
    }
  }

  return { outputText: outputText || "", toolCalls, raw: resp };
}

module.exports = {
  callModel, model, reasoningEffort,
  toResponsesTools, toolResultItem, assistantEchoItems,
};
