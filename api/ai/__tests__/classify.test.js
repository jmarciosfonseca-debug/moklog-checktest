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

let readCount = 0;
let readPids = [];
function makeDocRef(col, id) {
  return {
    get: async () => {
      readCount += 1;
      readPids.push(`${col}/${id}`);
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
function reset() { data = {}; throwFor = {}; readCount = 0; readPids = []; }

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

  // ── extractCode melhorado (formatos variados) ───────────────
  console.log("\n[extractCode formatos]");
  await test("string numérica '7' → PERMISSION_DENIED", () => {
    assert.strictEqual(shape.classifyError({ code: "7" }).errorCode, "PERMISSION_DENIED");
  });
  await test("MAIÚSCULA 'PERMISSION_DENIED' reconhecida", () => {
    assert.strictEqual(shape.classifyError({ code: "PERMISSION_DENIED" }).errorCode, "PERMISSION_DENIED");
  });
  await test("underscore 'permission_denied' reconhecida", () => {
    assert.strictEqual(shape.classifyError({ code: "permission_denied" }).errorCode, "PERMISSION_DENIED");
  });
  await test("namespace 'firestore/unavailable' reconhecida", () => {
    assert.strictEqual(shape.classifyError({ code: "firestore/unavailable" }).errorCode, "UNAVAILABLE");
  });
  await test("status numérico 14 → UNAVAILABLE", () => {
    assert.strictEqual(shape.classifyError({ status: 14 }).errorCode, "UNAVAILABLE");
  });
  await test("token longo/estranho NÃO é classificado (fica QUERY_FAILED)", () => {
    assert.strictEqual(shape.classifyError({ code: "isso é uma mensagem enorme e não um código" }).errorCode, "QUERY_FAILED");
  });

  // ── CTMK resiliente (não aborta no 1º PID que falha) ────────
  console.log("\n[ctmk resiliente]");
  const okDoc = { status: "offline", offlineSince: "2026-08-01T10:00:00.000Z" };
  async function ctmkAll() { return get_ctmk_status({}); } // varre todos os PIDs

  await test("1º PID falha (transitório), demais funcionam → ok:true, partial:true", async () => {
    reset(); data.ctmk = {}; shape.PROJECT_IDS.forEach(p => { data.ctmk[p] = okDoc; });
    throwFor["ctmk/P601"] = makeErr(14); // unavailable = transitório, não global
    const r = await ctmkAll();
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.partial, true);
    assert.strictEqual(r.summary.failedProjectCount, 1);
    assert.ok(r.dataQualityWarnings.some(w => w.includes("P601") && w.includes("UNAVAILABLE")));
    assert.ok(r.summary.successfulProjects >= 1, "leu os demais");
  });
  await test("PID intermediário falha → parcial", async () => {
    reset(); data.ctmk = {}; shape.PROJECT_IDS.forEach(p => { data.ctmk[p] = okDoc; });
    throwFor["ctmk/P604"] = makeErr(14);
    const r = await ctmkAll();
    assert.strictEqual(r.ok, true);
    assert.ok(r.dataQualityWarnings.some(w => w.includes("P604")));
    assert.ok(r.summary.successfulProjects >= 1);
  });
  await test("último PID falha → parcial", async () => {
    reset(); data.ctmk = {}; shape.PROJECT_IDS.forEach(p => { data.ctmk[p] = okDoc; });
    const last = shape.PROJECT_IDS[shape.PROJECT_IDS.length - 1];
    throwFor["ctmk/" + last] = makeErr(14);
    const r = await ctmkAll();
    assert.strictEqual(r.ok, true);
    assert.ok(r.dataQualityWarnings.some(w => w.includes(last)));
  });
  await test("todos falham (transitório) → ok:false, 1º código, partial:false", async () => {
    reset(); throwFor["ctmk"] = makeErr(14);
    const r = await ctmkAll();
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.errorCode, "UNAVAILABLE");
    assert.strictEqual(r.partial, false);
    assert.strictEqual(r.stage, "get_ctmk_status");
  });
  await test("documento inexistente NÃO é falha → ok:true, não conta em failedProjects", async () => {
    reset(); data.ctmk = {}; // nenhum doc existe, nenhuma exceção
    const r = await ctmkAll();
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.partial, false);
    assert.strictEqual(r.summary.failedProjectCount, 0);
    assert.strictEqual(r.summary.offline, 0);
  });
  await test("erro global no 1º PID: ok:false, PERMISSION_DENIED, só 1 read, nenhum outro PID consultado", async () => {
    reset(); data.ctmk = {}; shape.PROJECT_IDS.forEach(p => { data.ctmk[p] = okDoc; });
    const first = shape.PROJECT_IDS[0];
    throwFor["ctmk/" + first] = makeErr(7); // permission-denied só no 1º
    const r = await ctmkAll();
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.errorCode, "PERMISSION_DENIED");
    assert.strictEqual(readCount, 1, "só tentou 1 leitura");
    assert.deepStrictEqual(readPids, ["ctmk/" + first], "nenhum outro PID consultado");
  });
  await test("erro global APÓS um PID bem-sucedido: interrompe, não consulta posteriores, resposta = falha total (ok:false)", async () => {
    reset(); data.ctmk = {}; shape.PROJECT_IDS.forEach(p => { data.ctmk[p] = okDoc; });
    const second = shape.PROJECT_IDS[1];
    throwFor["ctmk/" + second] = makeErr(7); // 1º lê ok, 2º dá permission-denied
    const r = await ctmkAll();
    // Recomendação conservadora do Codex: permission-denied → ok:false,
    // não misturar dados anteriores com autorização incompleta.
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.errorCode, "PERMISSION_DENIED");
    assert.strictEqual(readCount, 2, "parou no 2º; não consultou os posteriores");
    assert.ok(!readPids.includes("ctmk/" + shape.PROJECT_IDS[2]), "3º PID não foi consultado");
  });
  await test("CTMK: warning sanitizado nunca traz mensagem bruta nem dado do doc", async () => {
    reset(); data.ctmk = {}; shape.PROJECT_IDS.forEach(p => { data.ctmk[p] = okDoc; });
    throwFor["ctmk/P601"] = makeErr(14);
    const r = await ctmkAll();
    const blob = JSON.stringify(r);
    assert.ok(!/erro bruto/.test(blob), "sem mensagem bruta");
    assert.ok(!/offlineSince/.test(JSON.stringify(r.dataQualityWarnings)), "warning não vaza campo do doc");
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

  // ── Debug [ctmk-debug] restrito ao Preview (ponto 1) ────────
  console.log("\n[debug restrito ao Preview]");
  // helper: captura console.warn e roda ctmkAll com VERCEL_ENV forçado
  async function runCapturingWarn(vercelEnv, setup) {
    const prev = process.env.VERCEL_ENV;
    if (vercelEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = vercelEnv;
    const origWarn = console.warn;
    const logs = [];
    console.warn = (...a) => { logs.push(a.map(String).join(" ")); };
    try { setup(); await ctmkAll(); }
    finally { console.warn = origWarn; if (prev === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = prev; }
    return logs;
  }
  const setupUnknownErr = () => { reset(); data.ctmk = {}; shape.PROJECT_IDS.forEach(p => { data.ctmk[p] = okDoc; }); throwFor["ctmk/" + shape.PROJECT_IDS[0]] = { name: "WeirdErr" }; }; // sem code → QUERY_FAILED
  const setupKnownErr = () => { reset(); data.ctmk = {}; shape.PROJECT_IDS.forEach(p => { data.ctmk[p] = okDoc; }); throwFor["ctmk/" + shape.PROJECT_IDS[0]] = makeErr(14); }; // unavailable → conhecido

  await test("Preview + QUERY_FAILED → loga [ctmk-debug]", async () => {
    const logs = await runCapturingWarn("preview", setupUnknownErr);
    assert.ok(logs.some(l => l.includes("[ctmk-debug]")));
  });
  await test("Production + QUERY_FAILED → NÃO loga", async () => {
    const logs = await runCapturingWarn("production", setupUnknownErr);
    assert.ok(!logs.some(l => l.includes("[ctmk-debug]")));
  });
  await test("Development + QUERY_FAILED → NÃO loga", async () => {
    const logs = await runCapturingWarn("development", setupUnknownErr);
    assert.ok(!logs.some(l => l.includes("[ctmk-debug]")));
  });
  await test("unknown (sem VERCEL_ENV) + QUERY_FAILED → NÃO loga", async () => {
    const logs = await runCapturingWarn(undefined, setupUnknownErr);
    assert.ok(!logs.some(l => l.includes("[ctmk-debug]")));
  });
  await test("Preview + erro CONHECIDO → NÃO loga debug (só QUERY_FAILED loga)", async () => {
    const logs = await runCapturingWarn("preview", setupKnownErr);
    assert.ok(!logs.some(l => l.includes("[ctmk-debug]")));
  });

  // ── safeDebugFields sanitiza error.name (ponto 2) ───────────
  console.log("\n[safeDebugFields sanitiza name]");
  await test("error.name com espaços/segredo NÃO entra no debug", () => {
    const f = shape.safeDebugFields({ name: "SEGREDO INTERNO DO CLIENTE", code: 13 });
    assert.strictEqual(f.name, undefined, "name inseguro descartado");
    assert.strictEqual(f.code, 13, "code numérico seguro mantido");
  });
  await test("error.name token seguro é mantido", () => {
    const f = shape.safeDebugFields({ name: "FirebaseError", code: "unavailable" });
    assert.strictEqual(f.name, "FirebaseError");
  });
  await test("safeDebugFields nunca inclui message nem stack", () => {
    const f = shape.safeDebugFields({ name: "X", message: "texto secreto", stack: "linha1\nlinha2", code: 14 });
    const blob = JSON.stringify(f);
    assert.ok(!/texto secreto/.test(blob));
    assert.ok(!/linha1/.test(blob));
  });

  // ── namespace só remove prefixos conhecidos (ponto 5) ───────
  console.log("\n[namespace conhecido]");
  await test("firestore/unavailable → UNAVAILABLE; xpto/unavailable → NÃO reconhecido", () => {
    assert.strictEqual(shape.classifyError({ code: "firestore/unavailable" }).errorCode, "UNAVAILABLE");
    assert.strictEqual(shape.classifyError({ code: "xpto/unavailable" }).errorCode, "QUERY_FAILED");
  });

  console.log(`\n──────────────\nResultado: ${passed} passaram, ${failed} falharam\n`);
  process.exit(failed ? 1 : 0);
})();
