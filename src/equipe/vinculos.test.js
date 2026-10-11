import { lideresDe, pertenceA, semEquipeAlguma, alternarVinculo, removerVinculo, cargoCompartilhado } from "./vinculos";

test("campo antigo continua valendo: equipeLiderId sozinho", () => {
  expect(lideresDe({ equipeLiderId: "l1" })).toEqual(["l1"]);
  expect(pertenceA({ equipeLiderId: "l1" }, "l1")).toBe(true);
  expect(semEquipeAlguma({})).toBe(true);
  expect(semEquipeAlguma({ equipeLiderId: "l1" })).toBe(false);
});
test("vincular sem equipe: entra como principal", () => {
  expect(alternarVinculo({ id: "r" }, "l1")).toEqual({ id: "r", equipeLiderId: "l1" });
});
test("em outra equipe: mover troca; duplicar mantém nas duas", () => {
  const rec = { id: "r", equipeLiderId: "l1" };
  expect(alternarVinculo(rec, "l2")).toEqual({ id: "r", equipeLiderId: "l2" });
  const dup = alternarVinculo(rec, "l2", { duplicar: true });
  expect(dup).toEqual({ id: "r", equipeLiderId: "l1", equipeLideresExtra: ["l2"] });
  expect(pertenceA(dup, "l1") && pertenceA(dup, "l2")).toBe(true);
  expect(alternarVinculo(dup, "l3", { duplicar: true }).equipeLideresExtra).toEqual(["l2", "l3"]);
});
test("tocar de novo tira só desta equipe; sair do principal promove o próximo", () => {
  const dup = { id: "r", equipeLiderId: "l1", equipeLideresExtra: ["l2"] };
  expect(alternarVinculo(dup, "l2")).toEqual({ id: "r", equipeLiderId: "l1" });
  expect(alternarVinculo(dup, "l1")).toEqual({ id: "r", equipeLiderId: "l2" });
  expect(alternarVinculo({ id: "r", equipeLiderId: "l1" }, "l1")).toEqual({ id: "r", equipeLiderId: null });
});
test("desfazer a equipe de um líder não tira o duplicado das outras", () => {
  const dup = { id: "r", equipeLiderId: "l1", equipeLideresExtra: ["l2"] };
  expect(lideresDe(removerVinculo(dup, "l1"))).toEqual(["l2"]);
  expect(removerVinculo({ id: "x", equipeLiderId: "l9" }, "l1")).toEqual({ id: "x", equipeLiderId: "l9" });
});
test("recepção é o cargo que já duplica ao toque", () => {
  expect(cargoCompartilhado("Recepção")).toBe(true);
  expect(cargoCompartilhado("Vig CCO")).toBe(false);
});
