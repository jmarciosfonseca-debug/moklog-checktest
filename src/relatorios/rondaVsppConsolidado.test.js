import { montarConsolidadoVSPP, filtrarPeriodo, analisarConsolidado } from "./rondaVsppConsolidado";
const regs = [
  { data: "2026-10-08", executor: "Luciano", kmInicial: "2810", kmFinal: "2859", slots: ["08:00","09:00"], marcacoes: { "08:00": { status: "feito" }, "09:00": { status: "nao_feito", obs: "chuva" } } },
  { data: "2026-10-09", executor: "Gildo", kmInicial: "2863", kmFinal: "2892", slots: ["08:00","09:00"], marcacoes: { "08:00": { status: "feito" }, "09:00": { status: "feito" } } },
  { data: "2026-09-01", executor: "Gildo", slots: ["08:00"], marcacoes: {} },
];
test("filtra por período e ordena do mais recente", () => {
  expect(filtrarPeriodo(regs, "2026-10-01", "").map(r=>r.data)).toEqual(["2026-10-09","2026-10-08"]);
  expect(filtrarPeriodo(regs, "", "").length).toBe(3);
});
test("totais e por executor", () => {
  const a = analisarConsolidado(filtrarPeriodo(regs, "2026-10-01", ""));
  expect(a.feitas).toBe(3); expect(a.naoFeitas).toBe(1); expect(a.totSlots).toBe(4); expect(a.pct).toBe(75);
  expect(a.km).toBe(78); expect(a.pendencias.length).toBe(1);
  expect(a.executores.map(e=>e.nome).sort()).toEqual(["Gildo","Luciano"]);
});
test("monta HTML com executor e período", () => {
  const { html } = montarConsolidadoVSPP({ id:"P601", name:"Golgi Cajamar" }, regs, { de:"2026-10-01" });
  expect(html).toContain("Ronda VSPP — Consolidado"); expect(html).toContain("Luciano"); expect(html).toContain("chuva"); expect(html).not.toContain("01/09/2026");
});
