import { gerarVisao360HTML, numero360, penalidadesPorTipo, pontosDeAtencao, faixaDe } from "./visao360Relatorio";

const CFG = { ctmkPorDia: 2, ctmkMax: 20, keyAccess: 5, keyAccessMax: 15, bolsaoCritico: 3, bolsaoMax: 12, perimetralZona: 2, perimetralMax: 10, rondaBaixa: 10, rondaMedia: 5 };
const base = { semChecklist: false, ilumDeficientes: 0, ilumTotal: 0, energiaQuedas7d: 0, energiaAberta: false, energiaTemDados: false, penalidades: [] };
const ROWS = [
  { ...base, id: "P605", name: "Planta <A>", score: 79, base: 94, penalidades: [{ tipo: "keyaccess", label: "3 falha(s) KeyAccess aberta(s)", val: 15, qtd: 3 }] },
  { ...base, id: "P601", name: "Matriz", score: 64, base: 90, ilumDeficientes: 2, ilumTotal: 10, energiaAberta: true, energiaTemDados: true, penalidades: [{ tipo: "ronda", label: "Ronda VSPP 50% no último dia", val: 10, qtd: 50 }, { tipo: "keyaccess", label: "1 falha(s) KeyAccess aberta(s)", val: 5, qtd: 1 }] },
  { ...base, id: "P607", name: "Limpa", score: 95, base: 95 },
];
const hoje = new Date("2026-10-12T14:30:00");

test("faixas", () => { expect(faixaDe(90)).toBe("ok"); expect(faixaDe(75)).toBe("wa"); expect(faixaDe(74)).toBe("da"); });
test("número do documento", () => {
  expect(numero360("Golgi", hoje)).toBe("MK-360-GOLGI-261012");
  expect(numero360(null, hoje)).toBe("MK-360-INT-261012");
});
test("penalidades por tipo somam pontos de todas as plantas", () => {
  expect(penalidadesPorTipo(ROWS)).toEqual([["Falha KeyAccess aberta", 20], ["Ronda VSPP abaixo da meta", 10]]);
});
test("pontos de atenção: crítica primeiro, energia, iluminação; planta limpa não entra", () => {
  const p = pontosDeAtencao(ROWS);
  expect(p[0]).toContain("P601");
  expect(p.join(" ")).toContain("energia em aberto");
  expect(p.join(" ")).toContain("2 pontos de iluminação deficientes");
  expect(p.join(" ")).not.toContain("P607");
});
test("padrão Moked: título, número, KPIs, ranking, legenda; interno sem grupo", () => {
  const h = gerarVisao360HTML({ rows: ROWS, media: 79, grupoLabel: null, cfg: CFG, hoje });
  expect(h).toContain("Visão 360");
  expect(h).toContain("MK-360-INT-261012");
  expect(h).toContain("VERSÃO INTERNA");
  expect(h).toContain("Nota média");
  expect(h).toContain("Plantas críticas");
  expect(h).toContain("Ranking das plantas");
  expect(h).toContain("EM ABERTO");
  expect(h).toContain("Onde a nota foi descontada");
  expect(h).toContain("Como a nota é calculada");
  expect(h).toContain("KeyAccess aberta (−5 cada, máx. −15)");
  expect(h).toContain("Imprimir / Salvar PDF");
  expect(h).not.toContain("🥇");
});
test("grupo: sem etiqueta interna, título do grupo; texto escapado", () => {
  const h = gerarVisao360HTML({ rows: ROWS, media: 79, grupoLabel: "Golgi", cfg: CFG, hoje });
  expect(h).not.toContain("VERSÃO INTERNA");
  expect(h).toContain("Grupo Golgi");
  expect(h).toContain("MK-360-GOLGI-261012");
  expect(h).toContain("Planta &lt;A&gt;");
  expect(h).not.toContain("Planta <A>");
});
test("sem pendências: mostra caixa verde e não mostra desconto", () => {
  const h = gerarVisao360HTML({ rows: [ROWS[2]], media: 95, grupoLabel: "Klog", cfg: CFG, hoje });
  expect(h).toContain("Nenhum ponto de atenção");
  expect(h).not.toContain("Onde a nota foi descontada");
});
test("sem checklist é dito, não escondido", () => {
  const h = gerarVisao360HTML({ rows: [{ ...base, id: "P505", name: "Klog", score: 0, base: 0, semChecklist: true }], media: 0, grupoLabel: "Klog", cfg: CFG, hoje });
  expect(h).toContain("sem relatório");
  expect(h).toContain("sem checklist semanal enviado");
});
test("lista vazia", () => {
  expect(gerarVisao360HTML({ rows: [], media: 0, grupoLabel: null, cfg: CFG, hoje })).toContain("Nenhuma planta avaliada");
});
