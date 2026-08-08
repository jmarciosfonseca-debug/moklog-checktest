// Testes do patch QUERY_FAILED (classificação de erro real, dedup,
// resultado parcial de weeklyReports, log sanitizado, limites).
// Firestore MOCKADO — sem rede. Rodam com: node __tests__/classify.test.js
//
// Estratégia igual à do integration.test.js: injeta um mock de
// firebaseAdmin no require cache ANTES de carregar as ferramentas.
// Aqui o mock pode LANÇAR erros com código gRPC por (coleção, projeto),
// para provar que cada ferramenta NÃO mascara o erro real.

const assert = require("assert");

// ── Mock configurável do Firestore Admin ────────────────────
// data[collection][docId] = objeto  → get() resolve com esse doc
// data[collection][docId] === undefined → doc inexistente (exists:false)
// throwFor[collection] = <errObj>  → get() LANÇA esse erro p/ QUALQUER doc
// throwFor["collection/docId"] = <errObj> → lança só p/ aquele doc
let data = {};
let throwFor = {};

function makeErr(code) {
  const e = new Error("erro bruto que NUNCA deve vazar: " + code);
  e.code = code; // número gRPC ou string canônica
  return e;
}

function makeDocRef(col, id) {
  return {
    get: async () => {
      const perDoc = throwFor[`${col}/${id}`];
      const perCol = throwFor[col];
      if (perDoc) throw perDoc;
      if (perCol) throw perCol;
      const exists = data[col] && data[col][id] !== undefined;
      return { exists, data: () => data[col] && data[col][id] };
    },
  };
}
const mockDb = { collection: (col) => ({ doc: (id) => makeDocRef(col, id) }) };

const adminPath = require.resolve("../lib/firebaseAdmin");
require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: { getDb: () => mockDb } };

const shape = require("../lib/shape");
const { get_ctmk_status } = require("../tools/ctmk");
const { get_recent_energy_events } = require("../tools/energy");
const { get_virtual_round_nonconformities } = require("../tools/virtualRounds");
const { get_perimeter_round_gaps } = require("../tools/perimeterRounds");
const { get_keyaccess_failures } = require("../tools/keyAccess");
const { get_staffing_and_vacation_gaps } = require("../tools/staffing");
const { get_weekly_report_items } = require("../tools/weeklyReports");
const { runTool } = require("../tools/index");
const { get_project_status } = require("../tools/overview");

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { failed++; console.log("  ✗", name, "\n     ", e.message); }
}
function reset() { data = {}; throwFor = {}; }

(async () => {
  // ── classifyError: reconhece só códigos específicos ─────────
  console.log("\n[classifyError]");
  await test("permission-denied (gRPC 7) → PERMISSION_DENIED, retryable:false", () => {
    const c = shape.classifyError(makeErr(7));
    assert.strictEqual(c.errorCode, "PERMISSION_DENIED");
    assert.strictEqual(c.retryable, false);
  });
  await test("unavailable (gRPC 14) → UNAVAILABLE, retryable:true", () => {
    const c = shape.classifyError(makeErr(14));
    assert.strictEqual(c.errorCode, "UNAVAILABLE");
    assert.strictEqual(c.retryable, true);
  });
  await test("code string 'permission-denied' reconhecido", () => {
    assert.strictEqual(shape.classifyError(makeErr("permission-denied")).errorCode, "PERMISSION_DENIED");
  });
  await test("novos códigos: aborted/cancelled/failed-precondition/invalid-argument/internal", () => {
    assert.strictEqual(shape.classifyError(makeErr("aborted")).errorCode, "ABORTED");
    assert.strictEqual(shape.classifyError(makeErr("aborted")).retryable, true);
    assert.strictEqual(shape.classifyError(makeErr("cancelled")).errorCode, "CANCELLED");
    assert.strictEqual(shape.classifyError(makeErr("failed-precondition")).errorCode, "FAILED_PRECONDITION");
    assert.strictEqual(shape.classifyError(makeErr("failed-precondition")).retryable, false);
    assert.strictEqual(shape.classifyError(makeErr("invalid-argument")).errorCode, "INVALID_ARGUMENT");
    assert.strictEqual(shape.classifyError(makeErr("internal")).errorCode, "INTERNAL");
    assert.strictEqual(shape.classifyError(makeErr("internal")).retryable, true);
  });
  await test("desconhecido → QUERY_FAILED e NÃO retryable cego", () => {
    const c = shape.classifyError(new Error("qualquer coisa aleatória"));
    assert.strictEqual(c.errorCode, "QUERY_FAILED");
    assert.strictEqual(c.retryable, false);
  });
  await test("NÃO usa 'invalid'/'environment' amplos como classificação", () => {
    const c = shape.classifyError({ message: "some invalid environment misconfig" });
    assert.strictEqual(c.errorCode, "QUERY_FAILED"); // não vira INVALID_ARGUMENT
  });
  await test("mensagem sanitizada nunca contém o texto bruto", () => {
    const c = shape.classifyError(makeErr(7));
    assert.ok(!/erro bruto/.test(c.message));
  });

  // ── fail() só preserva metadata permitida ───────────────────
  console.log("\n[fail metadata]");
  await test("fail preserva stage e partial; descarta o resto", () => {
    const f = shape.fail("X", "m", false, { stage: "s", partial: true, segredo: "NAO" });
    assert.deepStrictEqual(f, { ok: false, errorCode: "X", message: "m", retryable: false, stage: "s", partial: true });
  });

  // ── Cada ferramenta NÃO mascara permission-denied/unavailable ──
  console.log("\n[ferramentas não mascaram o erro real]");
  const toolCases = [
    ["get_ctmk_status", get_ctmk_status, "ctmk"],
    ["get_recent_energy_events", get_recent_energy_events, "energia_ocorrencias"],
    ["get_virtual_round_nonconformities", get_virtual_round_nonconformities, "cco_ronda"],
    ["get_perimeter_round_gaps", get_perimeter_round_gaps, "perimetral"],
    ["get_keyaccess_failures", get_keyaccess_failures, "keyaccess_falhas"],
    ["get_staffing_and_vacation_gaps", get_staffing_and_vacation_gaps, "equipes"],
    ["get_weekly_report_items", get_weekly_report_items, "equipamentos"],
  ];
  for (const [stage, fn, col] of toolCases) {
    await test(`${stage}: permission-denied não vira QUERY_FAILED cego`, async () => {
      reset(); throwFor[col] = makeErr(7);
      const r = await fn({ projectId: "P601" });
      assert.strictEqual(r.ok, false);
      assert.strictEqual(r.errorCode, "PERMISSION_DENIED");
      assert.strictEqual(r.retryable, false);
      assert.strictEqual(r.stage, stage, "stage preservado");
      assert.ok(!/erro bruto/.test(JSON.stringify(r)), "sem texto bruto");
    });
    await test(`${stage}: unavailable → retryable:true e stage preservado`, async () => {
      reset(); throwFor[col] = makeErr(14);
      const r = await fn({ projectId: "P601" });
      assert.strictEqual(r.errorCode, "UNAVAILABLE");
      assert.strictEqual(r.retryable, true);
      assert.strictEqual(r.stage, stage);
    });
  }

  // ── stage preservado pelo dispatcher runTool ────────────────
  console.log("\n[dispatcher preserva stage]");
  await test("runTool: erro dentro da ferramenta preserva stage=nome", async () => {
    reset(); throwFor["ctmk"] = makeErr(7);
    const r = await runTool("get_ctmk_status", { projectId: "P601" });
    assert.strictEqual(r.errorCode, "PERMISSION_DENIED");
    assert.strictEqual(r.stage, "get_ctmk_status");
  });

  // ── Deduplicação (chave estável) ────────────────────────────
  console.log("\n[deduplicação]");
  await test("stableToolKey: mesma ferramenta+args em ordens diferentes = mesma chave", () => {
    const k1 = shape.stableToolKey("t", { a: 1, b: 2, c: { x: 1, y: 2 } });
    const k2 = shape.stableToolKey("t", { c: { y: 2, x: 1 }, b: 2, a: 1 });
    assert.strictEqual(k1, k2);
  });
  await test("stableToolKey: args diferentes = chaves diferentes", () => {
    assert.notStrictEqual(shape.stableToolKey("t", { a: 1 }), shape.stableToolKey("t", { a: 2 }));
  });
  await test("stableToolKey: string JSON e objeto equivalem", () => {
    assert.strictEqual(shape.stableToolKey("t", '{"b":2,"a":1}'), shape.stableToolKey("t", { a: 1, b: 2 }));
  });

  // ── weeklyReports: parcial / todas falham / docs inexistentes ─
  console.log("\n[weeklyReports resultado parcial]");
  await test("parcial: 1 projeto lê, outro falha → ok:true, partial:true", async () => {
    reset();
    data.equipamentos = {
      P601: { cftv: [{ id: "c1", identificacao: "Cam", status: "inop", dataProblem: "2026-06-01" }] },
    };
    throwFor["equipamentos/P602"] = makeErr(14);
    // varre só P601 e P602 via chamadas dirigidas? weeklyReports varre todos;
    // então falha só P602 e demais inexistentes → sucesso parcial.
    const r = await get_weekly_report_items({});
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.partial, true);
    assert.ok(r.summary.failedProjects.includes("P602"));
    assert.ok(r.records.some(x => x.recordId === "c1"));
  });
  await test("todas falham → ok:false com errorCode do 1º erro classificado", async () => {
    reset();
    throwFor["equipamentos"] = makeErr(7); // todos os projetos falham
    const r = await get_weekly_report_items({});
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.errorCode, "PERMISSION_DENIED");
    assert.strictEqual(r.stage, "get_weekly_report_items");
  });
  await test("docs inexistentes (leituras ok) → ok:true, partial:false, lista vazia", async () => {
    reset(); // nenhum doc existe, nenhuma exceção
    const r = await get_weekly_report_items({});
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.partial, false);
    assert.strictEqual(r.records.length, 0);
    assert.strictEqual(r.summary.successfulProjects, r.summary.attemptedProjects);
  });

  // ── overview com uma ferramenta falhando ────────────────────
  console.log("\n[overview parcial]");
  await test("get_project_status: falha de CTMK não derruba o resumo", async () => {
    reset();
    throwFor["ctmk"] = makeErr(14); // CTMK falha
    data.equipamentos = { P601: { cftv: [{ id: "c1", identificacao: "Cam", status: "inop", dataProblem: "2026-06-01" }] } };
    const r = await get_project_status({ projectId: "P601" });
    assert.strictEqual(r.ok, true, "resumo consolidado sobrevive");
    assert.ok(r.dataQualityWarnings.some(w => /CTMK/i.test(w)), "avisa falha de CTMK");
    assert.ok(r.records.some(x => x.recordId === "c1"), "dados que funcionaram aparecem");
  });

  // ── log sanitizado (chat.js) ────────────────────────────────
  console.log("\n[log sanitizado]");
  await test("chat.js não loga mensagem bruta no catch (só metadata)", () => {
    const src = require("fs").readFileSync(require("path").join(__dirname, "..", "chat.js"), "utf8");
    // não pode haver String(e.message) sendo logado
    assert.ok(!/message:\s*String\(e\s*&&\s*e\.message\)/.test(src), "String(e.message) removido do log");
    assert.ok(/errorCode:\s*c\.errorCode/.test(src), "loga errorCode");
    assert.ok(/stage:\s*c\.stage/.test(src), "loga stage");
  });

  console.log(`\n──────────────\nResultado: ${passed} passaram, ${failed} falharam\n`);
  process.exit(failed ? 1 : 0);
})();
