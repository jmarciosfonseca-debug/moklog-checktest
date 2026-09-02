const assert = require("assert");
const { SYSTEM_PROMPT, buildDateContext, offsetDate } = require("../lib/systemPrompt");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("resolve hoje, ontem e janelas em São Paulo", () => {
  const c = buildDateContext(new Date("2026-09-02T14:30:00Z"));
  assert.deepStrictEqual(
    [c.today, c.yesterday, c.last7Start, c.last30Start],
    ["2026-09-02", "2026-09-01", "2026-08-27", "2026-08-04"],
  );
});

test("semana corrente começa na segunda e termina hoje", () => {
  const c = buildDateContext(new Date("2026-09-02T14:30:00Z"));
  assert.strictEqual(c.weekStart, "2026-08-31");
  assert.strictEqual(c.weekEnd, "2026-09-02");
});

test("respeita São Paulo próximo da meia-noite UTC", () => {
  const c = buildDateContext(new Date("2026-09-02T01:30:00Z"));
  assert.strictEqual(c.today, "2026-09-01");
  assert.strictEqual(c.yesterday, "2026-08-31");
});

test("trata viradas de mês, ano e ano bissexto", () => {
  assert.strictEqual(offsetDate("2026-03-01", -1), "2026-02-28");
  assert.strictEqual(offsetDate("2026-01-01", -1), "2025-12-31");
  assert.strictEqual(offsetDate("2024-03-01", -1), "2024-02-29");
});

test("domingo pertence à semana iniciada na segunda anterior", () => {
  const c = buildDateContext(new Date("2026-09-06T15:00:00Z"));
  assert.strictEqual(c.weekStart, "2026-08-31");
  assert.strictEqual(c.weekEnd, "2026-09-06");
});

test("prompt injeta datas e exige o intervalo efetivo", () => {
  const prompt = SYSTEM_PROMPT(new Date("2026-09-02T14:30:00Z"));
  assert.match(prompt, /HOJE = 2026-09-02/);
  assert.match(prompt, /ONTEM = 2026-09-01/);
  assert.match(prompt, /ÚLTIMOS 7 DIAS = 2026-08-27 a 2026-09-02/);
  assert.match(prompt, /ESTA SEMANA = 2026-08-31 a 2026-09-02/);
  assert.match(prompt, /Sempre declare o intervalo YYYY-MM-DD/);
});

test("rejeita data inválida", () => {
  assert.throws(() => buildDateContext(new Date("invalid")), /inválida/);
});

(async () => {
  let passed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      passed += 1;
      console.log(`✓ ${t.name}`);
    } catch (error) {
      console.error(`✗ ${t.name}`);
      console.error(error);
      process.exitCode = 1;
    }
  }
  console.log(`\n${passed}/${tests.length} testes de datas passaram.`);
})();

