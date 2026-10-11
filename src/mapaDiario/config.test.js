import { validarConfig, previstoDoMapa } from "./config";

// P311B (12x36): L1 / P1 / P2, duas turmas por turno. Turma 0 = dias ímpares de outubro.
const A = "2026-10-01";
const p311b = {
  projetoId: "P311B",
  postos: [
    { id: "L1-D", rotulo: "L1", ordem: 1, turnos: ["D"], regra: { tipo: "12x36", ancora: A, turmas: [["LD"], ["JV"]] } },
    { id: "P1-D", rotulo: "P1", ordem: 2, turnos: ["D"], regra: { tipo: "12x36", ancora: A, turmas: [["MA"], ["AF"]] } },
    { id: "P2-D", rotulo: "P2", ordem: 3, turnos: ["D"], regra: { tipo: "12x36", ancora: A, turmas: [["AA"], ["JP"]] } },
    { id: "L1-N", rotulo: "L1", ordem: 1, turnos: ["N"], regra: { tipo: "12x36", ancora: A, turmas: [["N1"], ["N2"]] } },
  ],
};

test("config válida não tem erros", () => {
  expect(validarConfig(p311b)).toEqual([]);
});
test("config com problemas aponta cada um", () => {
  const ruim = {
    projetoId: "X",
    postos: [
      { id: "a", rotulo: "A", turnos: ["D"], regra: { tipo: "4x2", ancora: "2026-10-01", titularD: "1" } },
      { id: "a", rotulo: "", turnos: ["Z"], regra: { tipo: "12x36", ancora: "01/10", turmas: [[]] } },
      { id: "c", rotulo: "C", turnos: ["D"] },
    ],
  };
  const e = validarConfig(ruim).join("|");
  expect(e).toMatch(/Posto repetido: a/);
  expect(e).toMatch(/4x2 precisa de titular/);
  expect(e).toMatch(/sem rótulo/);
  expect(e).toMatch(/turnos inválidos/);
  expect(e).toMatch(/âncora inválida/);
  expect(e).toMatch(/2 turmas/);
  expect(e).toMatch(/Posto c sem regra/);
  expect(validarConfig(null)).toEqual(["Projeto obrigatório"]);
});
test("previsto do dia segue a turma e a ordem dos postos", () => {
  const impar = previstoDoMapa(p311b, "2026-10-07", "D");
  expect(impar.itens.map((i) => [i.rotulo, i.pessoas[0]])).toEqual([["L1", "LD"], ["P1", "MA"], ["P2", "AA"]]);
  const par = previstoDoMapa(p311b, "2026-10-08", "D");
  expect(par.itens.map((i) => i.pessoas[0])).toEqual(["JV", "AF", "JP"]);
  expect(par.conflitos).toEqual([]);
});
test("só entram os postos do turno pedido", () => {
  expect(previstoDoMapa(p311b, "2026-10-07", "N").itens.map((i) => i.postoId)).toEqual(["L1-N"]);
});
test("4x2: um posto cobre D e N pelo grupo de 3", () => {
  const cfg = { projetoId: "P260B", postos: [{ id: "G1", rotulo: "VSPP 1", turnos: ["D", "N"], regra: { tipo: "4x2", ancora: "2026-10-06", titularD: "SS", titularN: "GBS", folguista: "DV" } }] };
  expect(previstoDoMapa(cfg, "2026-10-04", "D").itens[0].pessoas).toEqual(["DV"]);
  expect(previstoDoMapa(cfg, "2026-10-04", "N").itens[0].pessoas).toEqual(["GBS"]);
});
test("a mesma pessoa em dois postos do turno vira conflito, não some", () => {
  const cfg = { projetoId: "P1", postos: [
    { id: "a", rotulo: "A", ordem: 1, turnos: ["D"], regra: { tipo: "5x2", pessoas: ["X"] } },
    { id: "b", rotulo: "B", ordem: 2, turnos: ["D"], regra: { tipo: "5x2", pessoas: ["X"] } },
  ] };
  expect(previstoDoMapa(cfg, "2026-10-05", "D").conflitos).toEqual([{ pessoa: "X", postos: ["A", "B"] }]);
});
