import { registrarManutencao, ultimaManutencao } from "./motoManutencao";

const moto = { placa: "ABC-1234", km: 12000, kmManutencao: 13000, proximaRevisao: "2026-12-01", historico: [{ id: "1", data: "2026-08-01", km: 9000, desc: "óleo" }] };

test("registrar atualiza KM Atual e Últ. manutenção, limpa o km previsto e guarda histórico", () => {
  const r = registrarManutencao(moto, { data: "2026-10-19", km: "13250", desc: "Revisão geral" });
  expect(r.ok).toBe(true);
  expect(r.moto).toMatchObject({ km: 13250, ultimaManutencao: "2026-10-19", kmManutencao: "" });
  expect(r.moto.historico[0]).toMatchObject({ data: "2026-10-19", km: 13250, desc: "Revisão geral" });
  expect(r.moto.historico).toHaveLength(2);
  expect(r.moto.proximaRevisao).toBe("2026-12-01"); // dado antigo não é apagado, só deixa de ser usado
});
test("próximo km opcional: mantém o alerta quando informado", () => {
  const r = registrarManutencao(moto, { data: "2026-10-19", km: "13250", desc: "x", proximoKm: "18000" });
  expect(r.moto.kmManutencao).toBe(18000);
  expect(registrarManutencao(moto, { data: "2026-10-19", km: "13250", desc: "x", proximoKm: "13000" }).ok).toBe(false);
});
test("validações: data, km, descrição, km não anda para trás", () => {
  expect(registrarManutencao(moto, { data: "", km: "1", desc: "x" }).ok).toBe(false);
  expect(registrarManutencao(moto, { data: "2026-10-19", km: "", desc: "x" }).ok).toBe(false);
  expect(registrarManutencao(moto, { data: "2026-10-19", km: "13250", desc: " " }).ok).toBe(false);
  expect(registrarManutencao(moto, { data: "2026-10-19", km: "12500", desc: "x" }, 12800).erro).toContain("Mapa de Equipe");
});
test("última manutenção pela data mais recente", () => {
  expect(ultimaManutencao({ historico: [{ data: "2026-01-01" }, { data: "2026-09-10" }, { data: "2026-05-05" }] }).data).toBe("2026-09-10");
  expect(ultimaManutencao({})).toBeNull();
});
