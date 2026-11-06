// Tempo de gravação no teste semanal (06/11/2026): faixa % → quantidade do projeto, legenda, cor, texto e relatório.
import { camerasDaFaixa, legendaGravacao, corGravacao, gravacaoDoTeste, textoGravacao, FAIXAS_GRAVACAO } from "./gravacaoSemanal";
import { montarLaudoSemanal } from "./relatorios/laudoSemanal";
import { testeSemanal, luzes } from "./cliente/metricas";

const P604 = { id: "P604", name: "Golgi Jundiaí", categories: [{ id: "cftv", label: "06 - CFTV", type: "count", total: 73 }, { id: "internet", label: "08 - INTERNET", type: "single" }] };

test("faixas 0/10/20/30/50 e legenda em quantidade do projeto (P604 = 73 câmeras; 100 câmeras = 10/20/30/50)", () => {
  expect(FAIXAS_GRAVACAO).toEqual([0, 5, 10, 20, 30, 50]);
  expect(legendaGravacao(73).map((l) => l.texto)).toEqual(["5% ≈ 4", "10% ≈ 7", "20% ≈ 15", "30% ≈ 22", "50% ≈ 37"]);
  expect(legendaGravacao(150).map((l) => l.cameras)).toEqual([8, 15, 30, 45, 75]); // 150 câmeras com 8 abaixo = faixa "até 5%"
  expect(legendaGravacao(100).map((l) => l.cameras)).toEqual([5, 10, 20, 30, 50]);
  expect(camerasDaFaixa(140, 10)).toBe(14);
  expect([corGravacao(null), corGravacao(0), corGravacao(5), corGravacao(10), corGravacao(20)]).toEqual(["#64748b", "#22c55e", "#f59e0b", "#f59e0b", "#ef4444"]);
});

test("lê o estado do teste: não informado (teste antigo), 0%, faixa com observação; projeto sem CFTV = null", () => {
  expect(gravacaoDoTeste(P604, { cftv: { total: 73, inoperative: [] } })).toMatchObject({ total: 73, pct: null, cameras: null, nivel: "nao_informado" });
  expect(gravacaoDoTeste(P604, { cftv: { total: 73, inoperative: [], gravacao: { pct: 0, obs: "" } } })).toMatchObject({ pct: 0, cameras: 0, nivel: "ok" });
  const g = gravacaoDoTeste(P604, { cftv: { total: 73, inoperative: [], gravacao: { pct: 20, obs: "NVR 2 com 12 dias" } } });
  expect(g).toMatchObject({ pct: 20, cameras: 15, nivel: "critico", obs: "NVR 2 com 12 dias" });
  expect(textoGravacao(g)).toBe("Tempo de gravação: até 20% das câmeras (até ≈ 15 de 73) com menos de 30 dias — NVR 2 com 12 dias");
  expect(gravacaoDoTeste(P604, { cftv: { total: 73, gravacao: { pct: 37 } } }).pct).toBeNull(); // valor fora das faixas = não informado
  expect(gravacaoDoTeste({ categories: [{ id: "internet", type: "single" }] }, {})).toBeNull();
});

test("relatório semanal mostra o bloco de gravação; não entra na saúde geral", () => {
  const state = { cftv: { total: 73, inoperative: [], gravacao: { pct: 10, obs: "HD em troca" } }, internet: { status: "ok" } };
  const html = montarLaudoSemanal(P604, state, { date: "2026-11-08", leader: "Ana", cco: "Bruno" }, { hoje: new Date("2026-11-08T12:00:00Z") });
  expect(html).toMatch(/Tempo de gravação CFTV/);
  expect(html).toMatch(/Até 10% das câmeras \(até ≈ 7 de 73\)/);
  expect(html).toMatch(/HD em troca/);
  expect(html).toMatch(/74<\/div><div class="mk-kl">ativos testados/); // 73 câmeras + internet: gravação não altera a conta
});

test("Área do Cliente: métrica do teste traz a gravação e a luz acende só acima de 10%", () => {
  const health = () => ({ pct: 100, inop: 0, partial: 0, total: 74 });
  const hist = (pct) => [{ meta: { date: "2026-11-08" }, state: { cftv: { total: 73, inoperative: [], gravacao: { pct } } } }];
  const t20 = testeSemanal(hist(20), health, P604, "2026-11-08");
  expect(t20.gravacao).toMatchObject({ pct: 20, cameras: 15, nivel: "critico" });
  expect(luzes({ teste: t20 }).find((l) => l.id === "gravacao").on).toBe(true);
  expect(luzes({ teste: testeSemanal(hist(10), health, P604, "2026-11-08") }).find((l) => l.id === "gravacao").on).toBe(false);
  expect(luzes({ teste: testeSemanal([{ meta: { date: "2026-11-08" }, state: { cftv: { total: 73 } } }], health, P604, "2026-11-08") }).find((l) => l.id === "gravacao").on).toBe(false);
});
