import { validarKmMoto, kmMotoDoMapa, soDigitosKm } from "./kmMoto";
test("km da moto: só dígitos, inteiro e não menor que o último do mapa", () => {
  expect(soDigitosKm("71.145 km")).toBe("71145");
  expect(validarKmMoto({ km: "71145", kmManutencao: "75000" }, 71330)).toMatchObject({ ok: false });
  expect(validarKmMoto({ km: "71.330", kmManutencao: "" }, 71330)).toEqual({ ok: true, km: 71330, kmManutencao: null });
  expect(validarKmMoto({ km: "", kmManutencao: "" }, 71330).ok).toBe(true);
  expect(kmMotoDoMapa({ veiculos: [{ id: "moto", kmAtual: 71330 }] })).toBe(71330);
  expect(kmMotoDoMapa({ veiculos: [{ rotulo: "Carro", kmAtual: 5 }] })).toBeNull();
});
