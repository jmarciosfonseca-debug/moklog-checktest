const assert = require("assert");

const fake = { sinistros: {
  P601: { houve: true, tipo: "outro", tipoOutro: "SEGREDO LIVRE", dataOcorrido: "2026-01-01", observacao: "DADO LIVRE SENSÍVEL" },
  P602: { houve: false, semSinistroFaixa: "24m" },
} };
const mockDb = { collection: col => ({ doc: id => ({ get: async () => ({ exists: fake[col]?.[id] !== undefined, data: () => fake[col]?.[id] }) }) }) };
const adminPath = require.resolve("../lib/firebaseAdmin");
require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: { getDb: () => mockDb } };
const vulnerabilitiesPath = require.resolve("../tools/vulnerabilities");
require.cache[vulnerabilitiesPath] = {
  id: vulnerabilitiesPath, filename: vulnerabilitiesPath, loaded: true,
  exports: { get_project_vulnerabilities: async ({ projectId }) => ({
    ok: true,
    records: projectId === "P601" ? [{ description: "CFTV inoperante", severity: "high" }] : [],
    dataQualityWarnings: [],
  }) },
};

const { get_project_sinistro_history, computeSinistroModifier } = require("../tools/sinistros");
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log("  ✓", name); } catch (error) { failed++; console.log("  ✗", name, "\n     ", error.message); } }

(async () => {
  console.log("\n[sinistros]");
  await test("modulador espelha sinistro recente sem casamento", () => {
    const result = computeSinistroModifier({ houve: true, tipo: "furto", dataOcorrido: "2026-06-01" }, [], Date.parse("2026-09-01T12:00:00-03:00"));
    assert.strictEqual(result.delta, 1);
    assert.strictEqual(result.matched, false);
  });
  await test("modulador agrava quando furto casa com CFTV crucial", () => {
    const result = computeSinistroModifier({ houve: true, tipo: "furto", dataOcorrido: "2026-06-01" }, [{ label: "CFTV", nivel: 3 }], Date.parse("2026-09-01T12:00:00-03:00"));
    assert.strictEqual(result.delta, 2);
    assert.strictEqual(result.matched, true);
  });
  await test("24 meses sem sinistro atenua em menos um", () => {
    assert.strictEqual(computeSinistroModifier({ houve: false, semSinistroFaixa: "24m" }).delta, -1);
  });
  await test("documento inexistente gera warning sem inventar registro", async () => {
    const result = await get_project_sinistro_history({ projectId: "P604" });
    assert.strictEqual(result.records.length, 0);
    assert.ok(result.dataQualityWarnings.some(warning => warning.includes("P604")));
  });
  await test("projectId inválido é rejeitado", async () => {
    const result = await get_project_sinistro_history({ projectId: "P999" });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.errorCode, "VALIDATION_ERROR");
  });
  await test("textos livres nunca são devolvidos", async () => {
    const result = await get_project_sinistro_history({ projectId: "P601" });
    const output = JSON.stringify(result);
    assert.ok(!output.includes("SEGREDO LIVRE"));
    assert.ok(!output.includes("DADO LIVRE SENSÍVEL"));
  });
  await test("tool real cruza sinistro com vulnerabilidade elevada", async () => {
    fake.sinistros.P601 = { houve: true, tipo: "furto", dataOcorrido: new Date().toISOString().slice(0, 10) };
    const result = await get_project_sinistro_history({ projectId: "P601" });
    assert.ok(result.records[0].evidence.includes("Modulador base de risco: +2"));
    assert.ok(result.records[0].evidence.includes("Coincide com vulnerabilidade operacional da mesma natureza"));
  });
  console.log(`\n──────────────\nResultado: ${passed} passaram, ${failed} falharam\n`);
  process.exit(failed ? 1 : 0);
})();
