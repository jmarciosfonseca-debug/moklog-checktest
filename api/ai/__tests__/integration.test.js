// Testes de integração com Firestore MOCKADO (sem rede).
// Provam que as ferramentas normalizam dados no formato REAL do app.
// Rodam com: node __tests__/integration.test.js
//
// Estratégia: injetamos um mock no módulo firebaseAdmin via require cache,
// ANTES de carregar as ferramentas.

const assert = require("assert");
const path = require("path");

// ── Mock do Firestore Admin ─────────────────────────────────
// Estrutura: fake[collection][docId] = data | undefined
const fake = {
  ctmk: {
    P601: { status: "offline", offlineSince: new Date(Date.now() - 12 * 86400000).toISOString() },
    P602: { status: "online" },
    P604: { status: "offline", offlineSince: new Date(Date.now() - 2 * 86400000).toISOString() },
    P605: { status: "offline" }, // offline sem timestamp → data quality warning
  },
  energia_ocorrencias: {
    P311B: {
      eventos: [
        { id: "e1", inicioQueda: new Date(Date.now() - 3 * 3600000).toISOString(), fimQueda: new Date(Date.now() - 2 * 3600000).toISOString(), turno: "noturno", concluido: true },
        { id: "e2", inicioQueda: new Date(Date.now() - 1 * 3600000).toISOString(), fimQueda: null, turno: "noturno", concluido: false }, // aberto
        { id: "e3", inicioQueda: new Date(Date.now() - 5 * 3600000).toISOString(), fimQueda: null, turno: "noturno", concluido: true }, // divergência
      ],
      config: { concessionaria: "Celesc", telefoneConcessionaria: "0800-XXX" },
    },
  },
  keyaccess_falhas: {
    P601: {
      registros: [
        { data: "2026-08-05", horaInicio: "22:00", horaFim: "22:45", tipos: ["leitor"], registradoPor: { nome: "João" } },
        { data: "2026-08-06", horaInicio: "23:30", horaFim: "", tipos: ["normalizado"], registradoPor: { nome: "Maria" } }, // sem término + divergência
      ],
    },
  },
  cco_ronda: {
    P601: {
      turnos: [
        {
          id: "t1", tipo: "noturno", dataInicio: "2026-08-04", arquivado: true,
          arquivadoEm: "2026-08-05T06:00:00-03:00", plantonista: { nome: "Carlos" },
          rondas: { "0": { inicio: "18:02", atrasada: false }, "60": { inicio: "19:50", atrasada: true } },
        },
        {
          id: "t2", tipo: "noturno", dataInicio: "2026-08-06", arquivado: false, // em andamento → NÃO conta
          plantonista: { nome: "Ana" }, rondas: {},
        },
      ],
    },
  },
  equipamentos: {
    P601: {
      cftv: [
        { id: "c1", identificacao: "Câmera 12", status: "inop", dataProblem: "2026-06-01", justificativa: "queimada" }, // >30d
        { id: "c2", identificacao: "Câmera 30", status: "parcial", dataProblem: "2026-08-05" }, // recente
      ],
      moto: { id: "m1", placa: "ABC1D23", status: "inop", dataProblem: "2026-07-25" },
    },
  },
};

function makeDocRef(col, id) {
  return { get: async () => ({ exists: fake[col] && fake[col][id] !== undefined, data: () => fake[col] && fake[col][id] }) };
}
const mockDb = { collection: (col) => ({ doc: (id) => makeDocRef(col, id) }) };

// Injeta o mock no cache do require ANTES de carregar as ferramentas.
const adminPath = require.resolve("../lib/firebaseAdmin");
require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: { getDb: () => mockDb } };

const { get_ctmk_status } = require("../tools/ctmk");
const { get_recent_energy_events } = require("../tools/energy");
const { get_keyaccess_failures } = require("../tools/keyAccess");
const { get_virtual_round_nonconformities } = require("../tools/virtualRounds");
const { get_weekly_report_items } = require("../tools/weeklyReports");

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { failed++; console.log("  ✗", name, "\n     ", e.message); }
}

(async () => {
  console.log("\n[CTMK]");
  await test("ordena maior tempo offline primeiro; P601(12d) antes de P604(2d)", async () => {
    const r = await get_ctmk_status({});
    assert.strictEqual(r.ok, true);
    const offlines = r.records.filter(x => x.status === "offline");
    assert.strictEqual(offlines[0].projectId, "P601");
    assert.ok(offlines[0].severity === "critical"); // 12d >= 10
  });
  await test("P605 offline sem timestamp gera dataQualityWarning", async () => {
    const r = await get_ctmk_status({});
    assert.ok(r.dataQualityWarnings.some(w => w.includes("P605")));
  });
  await test("filtro projectId específico", async () => {
    const r = await get_ctmk_status({ projectId: "P602" });
    assert.strictEqual(r.records.length, 1);
    assert.strictEqual(r.records[0].status, "online");
  });

  console.log("\n[Energia]");
  await test("evento sem fimQueda vira 'sem encerramento formal'", async () => {
    const r = await get_recent_energy_events({ projectId: "P311B" });
    const aberto = r.records.find(x => x.recordId === "e2");
    assert.strictEqual(aberto.status, "sem encerramento formal");
  });
  await test("concluído sem fimQueda gera warning de divergência", async () => {
    const r = await get_recent_energy_events({ projectId: "P311B" });
    assert.ok(r.dataQualityWarnings.some(w => w.includes("concluído")));
  });
  await test("NÃO expõe telefone da concessionária", async () => {
    const r = await get_recent_energy_events({ projectId: "P311B" });
    const blob = JSON.stringify(r);
    assert.ok(!blob.includes("0800-XXX"), "telefone não pode aparecer");
  });
  await test("onlyOpen filtra só abertos", async () => {
    const r = await get_recent_energy_events({ projectId: "P311B", onlyOpen: true });
    assert.ok(r.records.every(x => x.status === "sem encerramento formal"));
  });

  console.log("\n[KeyAccess]");
  await test("falha sem horaFim = sem término formal", async () => {
    const r = await get_keyaccess_failures({ projectId: "P601", onlyOpen: true });
    assert.strictEqual(r.records.length, 1);
    assert.strictEqual(r.records[0].status, "sem término formal");
  });
  await test("tipo 'normalizado' sem término gera divergência", async () => {
    const r = await get_keyaccess_failures({ projectId: "P601" });
    assert.ok(r.dataQualityWarnings.some(w => w.toLowerCase().includes("restaura")));
  });

  console.log("\n[Rondas Virtuais]");
  await test("turno arquivado com atraso aparece; turno em andamento NÃO", async () => {
    const r = await get_virtual_round_nonconformities({ projectId: "P601" });
    assert.ok(r.records.some(x => x.recordId === "t1"));
    assert.ok(!r.records.some(x => x.recordId === "t2"), "t2 em andamento não pode contar");
  });

  console.log("\n[Equipamentos]");
  await test("olderThanDays=30 pega só INOP antigos", async () => {
    const r = await get_weekly_report_items({ projectId: "P601", olderThanDays: 30 });
    assert.ok(r.records.some(x => x.recordId === "c1"), "Câmera 12 (>30d) deve aparecer");
    assert.ok(!r.records.some(x => x.recordId === "c2"), "Câmera 30 (recente) não");
  });
  await test("Câmera 12 INOP >30d = severity critical", async () => {
    const r = await get_weekly_report_items({ projectId: "P601" });
    const c1 = r.records.find(x => x.recordId === "c1");
    assert.strictEqual(c1.severity, "critical");
  });
  await test("moto INOP é varrida genericamente", async () => {
    const r = await get_weekly_report_items({ projectId: "P601" });
    assert.ok(r.records.some(x => x.module === "equipamentos" && /moto/i.test(x.description)));
  });

  console.log("\n[Validação de argumentos]");
  await test("projectId inválido → VALIDATION_ERROR", async () => {
    const r = await get_ctmk_status({ projectId: "P999" });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.errorCode, "VALIDATION_ERROR");
  });

  console.log(`\n──────────────\nResultado: ${passed} passaram, ${failed} falharam\n`);
  process.exit(failed ? 1 : 0);
})();
