// Painel do projeto — régua: sem dado, não se aplica, travas e faixas (Fase 2).
const { calcularPainel, faixaDe, PESOS } = require("./regua");

const perfeito = () => ({
  teste: { total: 200, inop: 0, parcial: 0, diasAtras: 3, ruins: [] }, pendencias: { totalItens: 200, lista: [] },
  mapa: { enviados: 60, esperados: 60 }, ronda: { aplica: true, slots: 400, executados: 400, atrasados: 0, naoExec: 0 },
  equipe: { ativos: 17, previsto: 17, faltas30: 0, turnover: 5 }, capacitacao: { ativos: 17, emDia: 17 },
  sistemas: { ctmk: { aplica: true, diasOff: 0 }, key: { aplica: true, abertas: 0 }, perimetro: { aplica: true, zonasRuins: 0 } },
  eventos: { energia: { usa: true, n30: 0 }, ambulancia: { usa: false, n30: 0, graves30: 0 }, sinistro: { registrado: false, em30: false } },
});
const item = (r, id) => r.itens.find((i) => i.id === id);

test("pesos somam 100 e projeto sem perda fecha 100 · Bom, sem trava e sem ação", () => {
  expect(Object.values(PESOS).reduce((a, b) => a + b, 0)).toBe(100);
  const r = calcularPainel(perfeito());
  expect(r).toMatchObject({ nota: 100, faixa: "Bom", travaAplicada: false, cobertura: 100, redistribuido: false });
  expect(r.travas).toEqual([]); expect(r.acoes).toEqual([]);
  expect(r.itens.map((i) => i.possivel)).toEqual([25, 20, 15, 15, 10, 10, 5]);
});

test("sem dado = metade dos pontos do item, com o texto de nota neutra, e baixa a cobertura", () => {
  const d = perfeito(); d.teste = null; d.pendencias = null;
  const r = calcularPainel(d);
  expect(item(r, "equipamentos")).toMatchObject({ estado: "neutro", pontos: 12.5, possivel: 25 });
  expect(item(r, "equipamentos").frase).toMatch(/nota neutra/);
  expect(item(r, "pendencias")).toMatchObject({ estado: "neutro", pontos: 7.5 });
  expect(r.nota).toBe(80); expect(r.cobertura).toBe(60);
  const vazio = calcularPainel({});
  expect(vazio.itens.filter((i) => i.estado === "neutro").map((i) => i.id)).toEqual(["equipamentos", "rotina", "pendencias", "equipe", "capacitacao", "ocorrencias"]);
  expect(vazio.travas.map((t) => t.id)).toEqual(["cobertura"]); expect(vazio.faixa).toBe("Crítico");
});

test("não se aplica: o item sai da conta e o peso é redistribuído proporcionalmente", () => {
  const d = perfeito(); d.sistemas = { ctmk: { aplica: false }, key: { aplica: false }, perimetro: { aplica: false } };
  const r = calcularPainel(d);
  expect(item(r, "sistemas")).toMatchObject({ estado: "na", pontos: 0, possivel: 0, frase: "Não se aplica a este projeto." });
  expect(r.redistribuido).toBe(true); expect(r.nota).toBe(100);
  expect(item(r, "equipamentos").possivel).toBe(27.8); // 25 × 100/90
  expect(Math.round(r.itens.reduce((s, i) => s + i.possivel, 0))).toBe(100);
  // KeyAccess fora (ex.: P505): CTMK e perímetro seguem valendo, e a frase avisa
  const k = perfeito(); k.sistemas.key = { aplica: false }; k.sistemas.ctmk.diasOff = 2;
  const rk = calcularPainel(k);
  expect(item(rk, "sistemas").pontos).toBeCloseTo(10 * (1 - 4 / 30), 1); expect(item(rk, "sistemas").frase).toMatch(/Não se aplica: KeyAccess/);
});

test("sem ronda virtual no projeto, os 20 pontos da rotina vão para o mapa diário", () => {
  const d = perfeito(); d.ronda = { aplica: false }; d.mapa = { enviados: 54, esperados: 60 };
  expect(item(calcularPainel(d), "rotina").pontos).toBe(18);
  const c = perfeito(); c.mapa = { enviados: 54, esperados: 60 }; c.ronda = { aplica: true, slots: 400, executados: 380, atrasados: 40, naoExec: 20 };
  expect(item(calcularPainel(c), "rotina").pontos).toBe(18); // mapa 9/10 + ronda (380 − 20)/400 = 9/10
});

test("pendências: pesa idade e falta de tratativa; sem pendência = cheio", () => {
  const d = perfeito(); d.teste = { total: 200, inop: 4, parcial: 0, diasAtras: 3, ruins: [] };
  d.pendencias = { totalItens: 200, lista: [{ cat: "CFTV", item: "CF1", semanas: 1, tratativa: true }, { cat: "CFTV", item: "CF2", semanas: 1, tratativa: false }, { cat: "CFTV", item: "CF3", semanas: 3, tratativa: false }, { cat: "CFTV", item: "CF4", semanas: 6, tratativa: false }] };
  const i = item(calcularPainel(d), "pendencias"); // carga 0,5 + 1 + 2 + 3 = 6,5 sobre limite 30
  expect(i.pontos).toBe(11.8); // 15 × (1 − 6,5/30) = 11,75 expect(i.frase).toBe("4 pendências — 3 sem tratativa, 1 há mais de 30 dias."); expect(i.perdas).toHaveLength(4);
  expect(item(calcularPainel(perfeito()), "pendencias").frase).toBe("Nenhuma pendência aberta.");
});

test.each([
  ["teste semanal com mais de 10 dias", (d) => { d.teste.diasAtras = 11; }, "teste"],
  ["CTMK fora do ar há mais de 3 dias", (d) => { d.sistemas.ctmk.diasOff = 4; }, "ctmk"],
  ["zona do perímetro com problema", (d) => { d.sistemas.perimetro.zonasRuins = 1; }, "perimetro"],
  ["sinistro nos últimos 30 dias", (d) => { d.eventos.sinistro = { registrado: true, em30: true }; }, "sinistro"],
])("trava: %s → no máximo Alerta, e a tela sabe qual trava", (_, mudar, id) => {
  const d = perfeito(); mudar(d); const r = calcularPainel(d);
  expect(r.travas.map((t) => t.id)).toContain(id); expect(r.faixa).not.toBe("Bom");
  if (r.nota >= 92) expect(r).toMatchObject({ faixa: "Alerta", travaAplicada: true });
});
test("no limite as travas não disparam (10 dias de teste, 3 dias de CTMK)", () => {
  const d = perfeito(); d.teste.diasAtras = 10; d.sistemas.ctmk.diasOff = 3;
  expect(calcularPainel(d).travas.map((t) => t.id)).toEqual([]);
});
test("trava de pouco dado: mais de 40% do peso em nota neutra", () => {
  const d = perfeito(); d.teste = null; d.pendencias = null; d.capacitacao = null; // 50% neutro
  const r = calcularPainel(d); expect(r.cobertura).toBe(50); expect(r.travas.map((t) => t.id)).toEqual(["cobertura"]);
});

test("faixas da régua Moked: 92+ Bom · 80–91 Alerta · abaixo de 80 Crítico", () => {
  expect([100, 92, 91, 80, 79, 0, null].map((n) => faixaDe(n, false))).toEqual(["Bom", "Bom", "Alerta", "Alerta", "Crítico", "Crítico", "Sem dado"]);
  expect(faixaDe(95, true)).toBe("Alerta"); expect(faixaDe(70, true)).toBe("Crítico");
});

test("o que fazer para subir: os 3 itens com mais pontos perdidos, com ação concreta", () => {
  const d = perfeito(); d.teste = { total: 200, inop: 40, parcial: 0, diasAtras: 3, ruins: [] }; d.equipe = { ativos: 12, previsto: 17, faltas30: 6, turnover: 30 }; d.capacitacao = { ativos: 12, emDia: 6 }; d.mapa = { enviados: 57, esperados: 60 };
  const r = calcularPainel(d);
  expect(r.acoes.map((a) => a.id)).toEqual(["equipe", "equipamentos", "capacitacao"]);
  expect(r.acoes[0].acao).toBe("Repor 5 postos em aberto."); expect(r.acoes.every((a) => a.perdidos > 0)).toBe(true);
});
