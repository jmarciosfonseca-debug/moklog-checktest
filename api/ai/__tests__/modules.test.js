// Testes do query_module com Firestore MOCKADO (sem rede).
// Rodam com: node api/ai/__tests__/modules.test.js

const assert = require("assert");
const path = require("path");

const fake = {
  acesso_cco: {
    P601: { registros: [
      { id: "a1", data: "2026-09-02", horaEntrada: "08:10", empresa: "Elevadores X", nome: "José da Silva", arquivado: true },
      { id: "a2", data: "2026-09-15", horaEntrada: "14:00", empresa: "Elevadores X", nome: "Ana", arquivado: true },
      { id: "a3", data: "2026-10-05", horaEntrada: "09:30", empresa: "Limpeza Y", nome: "Pedro", arquivado: false },
    ] },
  },
  ambulancias: {
    P311B: { registros: [
      { id: "m1", data: "2026-09-03", turno: "Noturno", inquilino: "Shopee Soc", gravidade: "Leve", paciente: "Fulana", condutor: "X" },
    ] },
  },
  "ambulancias/P311B/registros": [
    { id: "m2", data: "2026-09-20", turno: "Diurno", inquilino: "Shopee Soc", gravidade: "Moderada", paciente: "Beltrano", socorrista1: "Y" },
    { id: "m3", data: "2026-09-21", turno: "Diurno", inquilino: "Mercado livre", gravidade: "Leve", paciente: "Fonseca teste" },
    { id: "m4", data: "2026-08-01", turno: "Diurno", inquilino: "Domazzi", gravidade: "Leve", paciente: "Z" },
  ],
  bolsao: {
    P311A: { placas: {
      AAA1A11: { placa: "AAA1A11", status: "critico", diasConsecutivos: 31, bloqueado: false, bloqueioDados: { motorista: "Sicrano", cpf: "123" } },
      BBB2B22: { placa: "BBB2B22", status: "critico", diasConsecutivos: 22, bloqueado: true },
      CCC3C33: { placa: "CCC3C33", status: "atencao", diasConsecutivos: 6, bloqueado: false },
      DDD4D44: { placa: "DDD4D44", status: "normal", diasConsecutivos: 1, bloqueado: false },
    } },
  },
  iluminacao: {
    P601: { quadrantes: [{ nome: "Portaria", total: 40, deficientes: 4, atualizadoEm: "2026-09-27" }, { nome: "Pátio", total: 60, deficientes: 6 }], testeQuinzenal: { ultimoRegistro: { data: "2026-09-27", assinadoPor: "Líder" } } },
    P604: { quadrantes: [{ nome: "A", total: 10, deficientes: 5 }] },
  },
};

function docRef(col, id) {
  return {
    get: async () => {
      const data = (fake[col] || {})[id];
      return { exists: data !== undefined, data: () => data };
    },
    collection: (sub) => ({
      get: async () => {
        const list = fake[`${col}/${id}/${sub}`] || [];
        return { forEach: (fn) => list.forEach((r) => fn({ id: r.id, data: () => { const { id: _i, ...rest } = r; return rest; } })) };
      },
    }),
  };
}
const mockDb = { collection: (col) => ({ doc: (id) => docRef(col, id) }) };
const adminPath = path.resolve(__dirname, "../lib/firebaseAdmin.js");
require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: { getDb: () => mockDb } };

const { query_module } = require("../tools/modules");
const { TOOL_SCHEMAS, runTool } = require("../tools/index");

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { failed++; console.log("  ✗", name, "\n     ", e.message); }
}
const json = (o) => JSON.stringify(o);

(async () => {
  console.log("\n[query_module]");

  await test("1. acessos ao CCO do P601 nos últimos 30 dias, sem nomes", async () => {
    const r = await query_module({ module: "cco_acesso", projectId: "P601", startDate: "2026-09-10", endDate: "2026-10-09" });
    assert.ok(r.ok);
    assert.strictEqual(r.summary.total, 2);
    assert.strictEqual(r.summary.porProjeto.P601.por.contagem["Elevadores X"], 1);
    assert.ok(!json(r).includes("José") && !json(r).includes("Pedro"), "vazou nome");
  });

  await test("2. ambulâncias P311B em setembro: lê array + subcoleção, exclui teste, sem paciente", async () => {
    const r = await query_module({ module: "ambulancia", projectId: "P311B", startDate: "2026-09-01", endDate: "2026-09-30" });
    assert.strictEqual(r.summary.total, 2);
    assert.strictEqual(r.summary.porProjeto.P311B.registrosDeTesteExcluidos, 1);
    assert.strictEqual(r.summary.porProjeto.P311B.por.contagem["Shopee Soc"], 2);
    const s = json(r);
    assert.ok(!s.includes("Fulana") && !s.includes("Beltrano") && !s.includes("socorrista") && !s.includes("condutor"), "vazou dado pessoal");
  });

  await test("3. bolsão no P601 → módulo não existe no projeto", async () => {
    const r = await query_module({ module: "bolsao", projectId: "P601" });
    assert.ok(r.ok);
    assert.strictEqual(r.summary.moduloExisteNoProjeto, false);
    assert.ok(/não existe no P601/.test(r.summary.mensagem));
  });

  await test("4. placas críticas e bloqueadas no P311A, sem dados do motorista", async () => {
    const r = await query_module({ module: "bolsao", projectId: "P311A" });
    const p = r.summary.porProjeto.P311A;
    assert.strictEqual(p.porStatus.critico, 2);
    assert.strictEqual(p.bloqueadas, 1);
    assert.strictEqual(r.records[0].placa, "AAA1A11");
    assert.ok(!json(r).includes("Sicrano") && !json(r).includes("cpf"), "vazou bloqueioDados");
  });

  await test("5. iluminação de dois projetos: percentual por projeto", async () => {
    const a = await query_module({ module: "iluminacao", projectId: "P601" });
    assert.strictEqual(a.summary.porProjeto.P601.operantesPct, 90);
    assert.strictEqual(a.summary.porProjeto.P601.ultimoTesteQuinzenal, "2026-09-27");
    const b = await query_module({ module: "iluminacao", projectId: "P604" });
    assert.strictEqual(b.summary.porProjeto.P604.operantesPct, 50);
  });

  await test("6. módulo fora do catálogo é recusado", async () => {
    const r = await query_module({ module: "usuarios" });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.errorCode, "NOT_FOUND");
    const r2 = await runTool("query_module", { module: "../config/viewlinks" });
    assert.strictEqual(r2.ok, false);
  });

  await test("7. projectId inválido é recusado", async () => {
    const r = await query_module({ module: "cco_acesso", projectId: "X999" });
    assert.strictEqual(r.ok, false);
  });

  await test("schema registrado no tools/index", async () => {
    assert.ok(TOOL_SCHEMAS.some((t) => t.function.name === "query_module"));
  });

  console.log(`\n${passed} passaram, ${failed} falharam\n`);
  process.exit(failed ? 1 : 0);
})();
