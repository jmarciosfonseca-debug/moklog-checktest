import { analisarMarcos, minutosEntre, textoDuracao, perguntaVirada } from "./acessoHorarios";

test("marcos em ordem ficam no mesmo dia", () => {
  const r = analisarMarcos("2026-08-28", { estacionou: "07:00", chamado: "07:12", entradaPatio: "07:30", saidaPatio: "08:45" });
  expect(r.viradas).toEqual([]);
  expect(r.marcos.saidaPatio).toBe("2026-08-28T08:45");
  expect(textoDuracao(minutosEntre(r.marcos.entradaPatio, r.marcos.saidaPatio))).toBe("1h 15min");
});
test("P260A 28/08: estacionou 19:20 e chamado 07:12 → pergunta se foi no dia seguinte; confirmado, a data do chamado é 29/08", () => {
  const r = analisarMarcos("2026-08-28", { estacionou: "19:20", chamado: "07:12" });
  expect(r.viradas).toHaveLength(1);
  expect(r.viradas[0]).toMatchObject({ campo: "chamado", anterior: "Estacionou (Ext.)" });
  expect(r.marcos).toEqual({ estacionou: "2026-08-28T19:20", chamado: "2026-08-29T07:12" });
  expect(perguntaVirada(r.viradas)).toContain("DIA SEGUINTE");
});
test("duração atravessa a meia-noite; campos vazios e hora inválida são ignorados", () => {
  const r = analisarMarcos("2026-08-28", { entradaPatio: "23:30", saidaPatio: "00:40", chamado: "" });
  expect(textoDuracao(minutosEntre(r.marcos.entradaPatio, r.marcos.saidaPatio))).toBe("1h 10min");
  expect(analisarMarcos("2026-08-28", { chamado: "99:99" }).invalidos).toEqual(["chamado"]);
  expect(minutosEntre(null, "2026-08-28T10:00")).toBeNull();
});
