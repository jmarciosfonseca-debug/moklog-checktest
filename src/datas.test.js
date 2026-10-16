import { hojeISO, avaliarDataRegistro, escolherDataRegistro } from "./datas";

test("hoje é a data de Brasília", () => {
  expect(hojeISO(new Date("2026-10-16T02:00:00Z"))).toBe("2026-10-15");
  expect(hojeISO(new Date("2026-10-16T12:00:00Z"))).toBe("2026-10-16");
});
test("futuro é bloqueado; até 7 dias passa; acima disso é retroativo e pede confirmação", () => {
  const hoje = "2026-10-16";
  expect(avaliarDataRegistro("2026-10-17", hoje)).toMatchObject({ futura: true });
  expect(avaliarDataRegistro("2026-10-09", hoje)).toMatchObject({ futura: false, retroativo: false, dias: 7 });
  expect(avaliarDataRegistro("2026-10-08", hoje)).toMatchObject({ retroativo: true, dias: 8 });
  const avisar = jest.fn();
  expect(escolherDataRegistro("2026-10-20", { hoje, avisar, confirmar: () => true })).toEqual({ aceita: false, retroativo: false });
  expect(avisar).toHaveBeenCalled();
  expect(escolherDataRegistro("2026-10-01", { hoje, confirmar: () => false })).toEqual({ aceita: false, retroativo: false });
  expect(escolherDataRegistro("2026-10-01", { hoje, confirmar: () => true })).toEqual({ aceita: true, retroativo: true });
  expect(escolherDataRegistro("2026-10-15", { hoje })).toEqual({ aceita: true, retroativo: false });
  expect(escolherDataRegistro("", { hoje })).toEqual({ aceita: true, retroativo: false });
});
