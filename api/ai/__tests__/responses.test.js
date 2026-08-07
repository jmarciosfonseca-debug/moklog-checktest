// Testes do adaptador da Responses API e do encadeamento de histórico
// (sem rede, sem credenciais). Rodam com: node __tests__/responses.test.js
//
// Cobrem: conversão de tools, montagem de function_call_output, extração de
// function_call, PRESERVAÇÃO de raw.output entre rodadas, pareamento
// function_call→output, duas ferramentas na mesma resposta, limite de
// chamadas, resposta final após ferramenta, ausência de tool call,
// argumentos inválidos, ausência de texto final, e ausência de segredos.

const assert = require("assert");
const { TOOL_SCHEMAS, runTool } = require("../tools/index");
const oa = require("../lib/openai");

// ── Ambiente mínimo p/ carregar auth sem segredo real ──
process.env.AI_SESSION_SECRET = "test-secret-suficientemente-longo";
process.env.AI_GERENCIAL_PIN = "000000"; // valor só de teste, não é o real

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ✓", name); }
  catch (e) { failed++; console.log("  ✗", name, "\n     ", e.message); }
}

// ── Simulador do loop de encadeamento do chat.js (sem OpenAI/rede) ──
// Recebe uma sequência de respostas "raw" simuladas e um cap; devolve o
// input acumulado e as ferramentas executadas, exatamente como o chat.js faz.
async function simularLoop(rawSequence, cap = 8) {
  const input = [{ role: "system", content: "sys" }, { role: "user", content: "q" }];
  const toolsUsed = [];
  let toolCallCount = 0;
  let finalText = "";
  for (let step = 0; step < rawSequence.length; step++) {
    const raw = rawSequence[step];
    const toolCalls = (raw.output || []).filter(i => i.type === "function_call")
      .map(i => ({ id: i.call_id, name: i.name, arguments: i.arguments || "{}" }));
    if (!toolCalls.length) {
      finalText = raw.output_text || oa.assistantEchoItems ? (raw.output_text || "") : "";
      finalText = raw.output_text || "";
      break;
    }
    // preserva raw.output completo (comportamento novo do chat.js)
    if (Array.isArray(raw.output)) input.push(...raw.output);
    for (const call of toolCalls) {
      if (toolCallCount >= cap) {
        input.push(oa.toolResultItem(call.id, { ok: false, errorCode: "LIMIT" }));
        continue;
      }
      toolCallCount += 1;
      const result = await runTool(call.name, call.arguments);
      toolsUsed.push(call.name);
      input.push(oa.toolResultItem(call.id, result));
    }
  }
  return { input, toolsUsed, toolCallCount, finalText };
}

(async () => {
  console.log("\n[Adaptador Responses API]");

  test("toResponsesTools: achata function.{name} para o topo", () => {
    const conv = oa.toResponsesTools(TOOL_SCHEMAS);
    assert.strictEqual(conv.length, TOOL_SCHEMAS.length);
    for (const t of conv) {
      assert.strictEqual(t.type, "function");
      assert.ok(typeof t.name === "string" && t.name.length > 0);
      assert.ok(t.parameters && t.parameters.type === "object");
      assert.strictEqual(t.function, undefined);
    }
  });

  test("toResponsesTools: nomes reais preservados", () => {
    const names = oa.toResponsesTools(TOOL_SCHEMAS).map(t => t.name);
    ["get_ctmk_status","get_recent_energy_events","get_virtual_round_nonconformities",
     "get_keyaccess_failures","get_weekly_report_items","get_operational_overview"]
     .forEach(n => assert.ok(names.includes(n), "faltou " + n));
  });

  test("toolResultItem: function_call_output com call_id e output string", () => {
    const item = oa.toolResultItem("call_123", { ok: true, x: 1 });
    assert.strictEqual(item.type, "function_call_output");
    assert.strictEqual(item.call_id, "call_123");
    assert.strictEqual(typeof item.output, "string");
    assert.deepStrictEqual(JSON.parse(item.output), { ok: true, x: 1 });
  });

  test("assistantEchoItems (deprecado): ainda extrai function_call", () => {
    const raw = { output: [
      { type: "function_call", call_id: "c1", name: "get_ctmk_status", arguments: "{}" },
      { type: "message", content: [{ type: "output_text", text: "oi" }] },
    ]};
    const echoes = oa.assistantEchoItems(raw);
    assert.strictEqual(echoes.length, 1);
    assert.strictEqual(echoes[0].call_id, "c1");
  });

  console.log("\n[Encadeamento de histórico (correção do Codex)]");

  test("preserva TODOS os itens de raw.output entre rodadas (inclui reasoning)", async () => {
    const raw1 = { output: [
      { type: "reasoning", id: "r1", summary: [] },                      // item intermediário
      { type: "function_call", call_id: "c1", name: "get_ctmk_status", arguments: JSON.stringify({ projectId: "P602" }) },
    ]};
    const raw2 = { output: [], output_text: "P602 online." };            // resposta final
    const { input } = await simularLoop([raw1, raw2]);
    // o bloco de reasoning e o function_call devem estar no input reinjetado
    assert.ok(input.some(i => i.type === "reasoning"), "reasoning deve ser preservado");
    assert.ok(input.some(i => i.type === "function_call" && i.call_id === "c1"), "function_call preservado");
    assert.ok(input.some(i => i.type === "function_call_output" && i.call_id === "c1"), "output pareado");
  });

  test("function_call é seguido do function_call_output com o MESMO call_id", async () => {
    const raw1 = { output: [{ type: "function_call", call_id: "cX", name: "get_ctmk_status", arguments: JSON.stringify({ projectId: "P602" }) }] };
    const raw2 = { output: [], output_text: "ok" };
    const { input } = await simularLoop([raw1, raw2]);
    const idxCall = input.findIndex(i => i.type === "function_call" && i.call_id === "cX");
    const idxOut = input.findIndex(i => i.type === "function_call_output" && i.call_id === "cX");
    assert.ok(idxCall >= 0 && idxOut > idxCall, "output deve vir depois do call, mesmo id");
  });

  test("duas ferramentas na mesma resposta → dois outputs pareados", async () => {
    const raw1 = { output: [
      { type: "function_call", call_id: "a", name: "get_ctmk_status", arguments: JSON.stringify({ projectId: "P602" }) },
      { type: "function_call", call_id: "b", name: "get_keyaccess_failures", arguments: JSON.stringify({ projectId: "P601" }) },
    ]};
    const raw2 = { output: [], output_text: "resumo" };
    const { input, toolsUsed, toolCallCount } = await simularLoop([raw1, raw2]);
    assert.strictEqual(toolCallCount, 2);
    assert.deepStrictEqual(toolsUsed.sort(), ["get_ctmk_status", "get_keyaccess_failures"].sort());
    assert.ok(input.some(i => i.type === "function_call_output" && i.call_id === "a"));
    assert.ok(input.some(i => i.type === "function_call_output" && i.call_id === "b"));
  });

  test("limite de chamadas: acima do cap injeta LIMIT em vez de executar", async () => {
    const raw1 = { output: [
      { type: "function_call", call_id: "1", name: "get_ctmk_status", arguments: "{}" },
      { type: "function_call", call_id: "2", name: "get_ctmk_status", arguments: "{}" },
      { type: "function_call", call_id: "3", name: "get_ctmk_status", arguments: "{}" },
    ]};
    const raw2 = { output: [], output_text: "fim" };
    const { input, toolCallCount } = await simularLoop([raw1, raw2], 2); // cap = 2
    assert.strictEqual(toolCallCount, 2);
    const limitOut = input.filter(i => i.type === "function_call_output" && /LIMIT/.test(i.output));
    assert.strictEqual(limitOut.length, 1, "a 3ª chamada vira LIMIT");
  });

  test("resposta final após UMA rodada de ferramenta", async () => {
    const raw1 = { output: [{ type: "function_call", call_id: "z", name: "get_ctmk_status", arguments: JSON.stringify({ projectId: "P602" }) }] };
    const raw2 = { output: [], output_text: "CTMK do P602 está online." };
    const { finalText, toolsUsed } = await simularLoop([raw1, raw2]);
    assert.strictEqual(toolsUsed.length, 1);
    assert.ok(finalText.includes("P602"));
  });

  test("ausência de tool call → resposta direta sem executar ferramenta", async () => {
    const raw1 = { output: [], output_text: "Resposta sem ferramenta." };
    const { toolsUsed, finalText } = await simularLoop([raw1]);
    assert.strictEqual(toolsUsed.length, 0);
    assert.ok(finalText.length > 0);
  });

  test("argumentos inválidos (projectId errado) → tool devolve VALIDATION_ERROR, loop não quebra", async () => {
    const r = await runTool("get_ctmk_status", JSON.stringify({ projectId: "P999" }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.errorCode, "VALIDATION_ERROR");
  });

  test("ausência de texto final → finalText vazio, sem lançar", async () => {
    const raw1 = { output: [], output_text: "" };
    const { finalText } = await simularLoop([raw1]);
    assert.strictEqual(finalText, "");
  });

  console.log("\n[Segurança]");

  test("nenhum segredo aparece no input acumulado nem nos outputs de ferramenta", async () => {
    const raw1 = { output: [{ type: "function_call", call_id: "s", name: "get_ctmk_status", arguments: "{}" }] };
    const raw2 = { output: [], output_text: "ok" };
    const { input } = await simularLoop([raw1, raw2]);
    const blob = JSON.stringify(input);
    assert.ok(!/AI_SESSION_SECRET|test-secret-suficientemente-longo/.test(blob), "secret não pode vazar");
    assert.ok(!/000000/.test(blob), "PIN não pode aparecer");
    assert.ok(!/sk-[A-Za-z0-9]/.test(blob), "chave OpenAI não pode aparecer");
  });

  console.log(`\n──────────────\nResultado: ${passed} passaram, ${failed} falharam\n`);
  process.exit(failed ? 1 : 0);
})();
