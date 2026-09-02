// Testes unitários (sem OpenAI/Firestore) — rodam com: node __tests__/unit.test.js
// Cobrem: tempo/fuso, duração, idade, auth (assinatura/expiração),
// ordenação por criticidade, validação de projectId, grade de rondas.

const assert = require("assert");
const time = require("../lib/time");
const shape = require("../lib/shape");
const { buildSlots, analisarTurno } = require("../tools/virtualRounds");
const { minutosFalha } = require("../tools/keyAccess");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ✓", name); }
  catch (e) { failed++; console.log("  ✗", name, "\n     ", e.message); }
}

console.log("\n[time]");
test("toMillis: data-only ancora ao meio-dia local", () => {
  const ms = time.toMillis("2026-08-07");
  const d = new Date(ms);
  // meio-dia local → hora local deve ser 12
  assert.strictEqual(d.getHours(), 12);
});
test("toMillis: ISO válido", () => {
  assert.ok(time.toMillis("2026-08-07T18:00:00-03:00") > 0);
});
test("toMillis: Firestore Timestamp {seconds}", () => {
  assert.strictEqual(time.toMillis({ seconds: 1000, nanoseconds: 0 }), 1000000);
});
test("toMillis: inválido → null", () => {
  assert.strictEqual(time.toMillis("xyz"), null);
  assert.strictEqual(time.toMillis(null), null);
});
test("durationMinutes: 2h = 120", () => {
  assert.strictEqual(time.durationMinutes(0, 120 * 60000), 120);
});
test("durationMinutes: entrada nula → null", () => {
  assert.strictEqual(time.durationMinutes(null, 1), null);
});
test("ageDays: 30 dias atrás", () => {
  const ms = Date.now() - 30 * 86400000;
  assert.strictEqual(time.ageDays(ms), 30);
});
test("humanDuration: 1500min = 1d 1h", () => {
  assert.strictEqual(time.humanDuration(1500), "1d 1h");
});
test("toIsoSaoPaulo contém offset", () => {
  const iso = time.toIsoSaoPaulo(Date.parse("2026-08-07T15:00:00Z"));
  assert.ok(/[-+]\d{2}:\d{2}$/.test(iso), "deve terminar com offset");
});

console.log("\n[shape]");
test("validateProjectId: válido normaliza p/ maiúsculas", () => {
  assert.deepStrictEqual(shape.validateProjectId("p601"), { valid: true, id: "P601" });
});
test("validateProjectId: vazio = todos (id null)", () => {
  assert.deepStrictEqual(shape.validateProjectId(""), { valid: true, id: null });
});
test("validateProjectId: inexistente = inválido", () => {
  assert.strictEqual(shape.validateProjectId("P999").valid, false);
});
test("sortBySeverityThenAge: crítico antes; mais antigo antes", () => {
  const recs = [
    { severity: "low", occurredAt: "2026-01-01T00:00:00-03:00" },
    { severity: "critical", occurredAt: "2026-05-01T00:00:00-03:00" },
    { severity: "critical", occurredAt: "2026-02-01T00:00:00-03:00" },
  ];
  const s = shape.sortBySeverityThenAge(recs);
  assert.strictEqual(s[0].severity, "critical");
  assert.strictEqual(s[0].occurredAt, "2026-02-01T00:00:00-03:00"); // mais antigo dos críticos
  assert.strictEqual(s[2].severity, "low");
});
test("applyLimit: trunca e sinaliza", () => {
  const { rows, truncated } = shape.applyLimit([1, 2, 3, 4, 5], 3, 100);
  assert.strictEqual(rows.length, 3);
  assert.strictEqual(truncated, true);
});
test("resolveTargets: sem projeto = todos os 12", () => {
  assert.strictEqual(shape.resolveTargets(null).length, 12);
});
test("P260B/C são projetos válidos e individuais", () => {
  assert.strictEqual(shape.validateProjectId("P260B").id, "P260B");
  assert.strictEqual(shape.validateProjectId("P260C").id, "P260C");
  assert.notStrictEqual(shape.PROJECT_NAMES.P260B, shape.PROJECT_NAMES.P260C);
});

console.log("\n[auth]");
process.env.AI_SESSION_SECRET = "test-secret-suficientemente-longo";
process.env.AI_GERENCIAL_PIN = "135790"; // valor FICTICIO de teste (nao e um PIN real do app)
const auth = require("../lib/auth");
test("pinIsGerencial: PIN certo passa, errado falha", () => {
  assert.strictEqual(auth.pinIsGerencial("135790"), true);
  assert.strictEqual(auth.pinIsGerencial("000000"), false);
});
test("issue/verify: token válido é aceito", () => {
  const t = auth.issueSession();
  assert.strictEqual(auth.verifySession(t).valid, true);
});
test("verify: token adulterado é rejeitado", () => {
  const t = auth.issueSession();
  const tampered = t.slice(0, -2) + (t.slice(-2) === "aa" ? "bb" : "aa");
  assert.strictEqual(auth.verifySession(tampered).valid, false);
});
test("verify: token expirado é rejeitado", () => {
  const t = auth.issueSession(-1000); // já expirado
  const r = auth.verifySession(t);
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.reason, "expired");
});
test("requireGerencial: sem header → não autorizado", () => {
  assert.strictEqual(auth.requireGerencial({ headers: {} }).authorized, false);
});
test("requireGerencial: Bearer válido → autorizado", () => {
  const t = auth.issueSession();
  assert.strictEqual(auth.requireGerencial({ headers: { authorization: `Bearer ${t}` } }).authorized, true);
});

console.log("\n[rondas]");
test("buildSlots noturno padrão: 18h→05h de hora em hora (12 slots)", () => {
  const slots = buildSlots("noturno", "P601");
  assert.strictEqual(slots[0].label, "18:00");
  assert.strictEqual(slots[0].offsetMin, 0);
  assert.strictEqual(slots.length, 12); // 18,19,20,21,22,23,00,01,02,03,04,05
});
test("buildSlots P311A: grade especial 30min tem mais slots", () => {
  const normal = buildSlots("noturno", "P601").length;
  const especial = buildSlots("noturno", "P311A").length;
  assert.ok(especial > normal, "grade de 30min deve ter mais slots");
});
test("buildSlots P606: janela deslocada começa 19:00", () => {
  assert.strictEqual(buildSlots("noturno", "P606")[0].label, "19:00");
});
test("analisarTurno: conta feitas/atrasadas/sem evidência", () => {
  const turno = {
    tipo: "noturno",
    rondas: { "0": { inicio: "18:03", atrasada: false }, "60": { inicio: "19:40", atrasada: true } },
  };
  const a = analisarTurno(turno, "P601");
  assert.strictEqual(a.feitas, 2);
  assert.strictEqual(a.atrasadas, 1);
  assert.strictEqual(a.semEvidencia, a.previstas - 2);
});

console.log("\n[keyaccess]");
test("minutosFalha: 22:00→22:45 = 45min", () => {
  assert.strictEqual(minutosFalha("22:00", "22:45"), 45);
});
test("minutosFalha: cruza meia-noite 23:30→00:15 = 45min", () => {
  assert.strictEqual(minutosFalha("23:30", "00:15"), 45);
});
test("minutosFalha: sem fim → null", () => {
  assert.strictEqual(minutosFalha("22:00", ""), null);
});

console.log(`\n──────────────\nResultado: ${passed} passaram, ${failed} falharam\n`);
process.exit(failed ? 1 : 0);
