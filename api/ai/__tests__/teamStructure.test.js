const assert = require("assert");

const fake = { equipes: { P601: {
  colaboradores: [
    { id: "l1", nome: "Líder A", cargo: "VSPP Líder", turno: "Diurno", telefone: "NÃO EXPOR" },
    { id: "m1", nome: "Agente B", cargo: "VSPP", turno: "Diurno", equipeLiderId: "l1", cpf: "NÃO EXPOR" },
    { id: "m2", nome: "Agente C", cargo: "VSPP", turno: "Noturno" },
  ],
  desligados: [{ id: "d1", nome: "Ex-colaborador", cargo: "VSPP", desligadoEm: "2026-09-04", tipoDesligamento: "Demissão", motivoDesligamento: "NÃO EXPOR MOTIVO", telefone: "NÃO EXPOR" }],
} } };
const mockDb = { collection: name => ({ doc: id => ({ get: async () => ({ exists: !!fake[name]?.[id], data: () => fake[name]?.[id] }) }) }) };
const adminPath = require.resolve("../lib/firebaseAdmin");
require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: { getDb: () => mockDb } };
const { get_staff_departures, get_team_composition } = require("../tools/teamStructure");

let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log("  ✓", name); } catch (error) { failed++; console.log("  ✗", name, "\n     ", error.message); } }

(async () => {
  console.log("\n[team structure]");
  await test("desligamento expõe apenas campos operacionais permitidos", async () => {
    const result = await get_staff_departures({ projectId: "P601" });
    assert.strictEqual(result.summary.totalDesligamentos, 1);
    const output = JSON.stringify(result);
    assert.ok(output.includes("Ex-colaborador"));
    assert.ok(output.includes("Demissão"));
    assert.ok(!output.includes("NÃO EXPOR"));
  });
  await test("composição agrupa membros pelo líder", async () => {
    const result = await get_team_composition({ projectId: "P601", shift: "diurno" });
    assert.strictEqual(result.records.length, 1);
    assert.strictEqual(result.records[0].evidence.length, 1);
    assert.ok(result.records[0].evidence[0].includes("Agente B"));
    assert.ok(result.dataQualityWarnings.some(item => item.includes("sem líder")));
  });
  await test("dados pessoais proibidos não vazam na composição", async () => {
    const output = JSON.stringify(await get_team_composition({ projectId: "P601" }));
    assert.ok(!output.includes("NÃO EXPOR"));
  });
  await test("projectId inválido é rejeitado", async () => {
    assert.strictEqual((await get_staff_departures({ projectId: "P999" })).errorCode, "VALIDATION_ERROR");
  });
  await test("filtro de período avisa sobre desligamento sem data omitido", async () => {
    fake.equipes.P601.desligados.push({ nome: "Sem data", tipoDesligamento: "Demissão", motivoDesligamento: "NÃO EXPOR" });
    const result = await get_staff_departures({ projectId: "P601", startDate: "2026-09-01" });
    assert.ok(result.dataQualityWarnings.some(item => item.includes("sem data válida")));
    assert.ok(!JSON.stringify(result).includes("Sem data"));
  });
  await test("filtro de turno exclui membro de outro turno e avisa", async () => {
    fake.equipes.P601.colaboradores.push({ id: "m3", nome: "Agente D", cargo: "VSPP", turno: "Noturno", equipeLiderId: "l1" });
    const result = await get_team_composition({ projectId: "P601", shift: "diurno" });
    assert.ok(!JSON.stringify(result.records).includes("Agente D"));
    assert.ok(result.dataQualityWarnings.some(item => item.includes("outro turno")));
  });
  console.log(`\n──────────────\nResultado: ${passed} passaram, ${failed} falharam\n`);
  process.exit(failed ? 1 : 0);
})();
