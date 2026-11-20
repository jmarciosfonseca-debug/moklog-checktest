import { pendenciasDeEquipamento, rotuloPendenciaEquip, comPendenciasDeEquipamento, novoMapa } from "./modelo";
import { montarTextoWhatsApp } from "./texto";

// Marcio, 18/11/2026: equipamento inoperante cadastrado entra sozinho em todo mapa, com "há X dias", até a equipe resolver.
const EQ = {
  lanternas: [{ id: "l1", identificacao: "Lanterna Tático", status: "inop", dataProblem: "2026-11-15", justificativa: "Não acende" }, { id: "l2", identificacao: "Lanterna Líder", status: "ok" }],
  radiosHT: [{ id: "r1", identificacao: "Rádio CCO", status: "parcial", dataProblem: "2026-11-17", justificativa: "Bateria viciada" }],
  bodycam: [{ id: "b1", identificacao: "Bodycam Reserva", status: "inop", dataProblem: "2026-11-18", justificativa: "Não entregue" }],
  moto: { placa: "SXX0E52", status: "inop", dataProblem: "2026-11-16", justificativa: "Em manutenção" },
};

test("puxa inoperantes e parciais (inclusive a moto), com dias contados até a data do mapa; ok não entra", () => {
  const l = pendenciasDeEquipamento(EQ, "2026-11-18", "P311B");
  expect(l.map((p) => [p.nome, p.situacao, p.dias])).toEqual([["Lanterna Tático", "inoperante", 3], ["Moto SXX0E52", "inoperante", 2], ["Bodycam Reserva", "inoperante", 0], ["Rádio CCO", "parcial", 1]]);
  expect(l.some((p) => p.nome === "Lanterna Líder")).toBe(false);
});
test("bodycam só vale no P311A/B", () => {
  expect(pendenciasDeEquipamento(EQ, "2026-11-18", "P604").some((p) => p.nome === "Bodycam Reserva")).toBe(false);
});
test("rótulo: há 1 dia, há 3 dias, desde hoje, desde dd/mm e motivo", () => {
  const l = pendenciasDeEquipamento(EQ, "2026-11-18", "P311B");
  expect(rotuloPendenciaEquip(l[0])).toBe("Lanterna Tático — INOPERANTE há 3 dias (desde 15/11): Não acende");
  expect(rotuloPendenciaEquip(l[2])).toBe("Bodycam Reserva — INOPERANTE desde hoje (desde 18/11): Não entregue");
  expect(rotuloPendenciaEquip(l[3])).toContain("PARCIAL há 1 dia");
});
test("avança dia a dia no mesmo equipamento: 1 dia, 2 dias, 3 dias", () => {
  const um = { lanternas: [{ id: "l", identificacao: "Lanterna", status: "inop", dataProblem: "2026-11-15" }] };
  expect([16, 17, 18].map((d) => rotuloPendenciaEquip(pendenciasDeEquipamento(um, `2026-11-${d}`)[0]))).toEqual(["Lanterna — INOPERANTE há 1 dia (desde 15/11)", "Lanterna — INOPERANTE há 2 dias (desde 15/11)", "Lanterna — INOPERANTE há 3 dias (desde 15/11)"]);
});
test("resolveu (status ok): sai sozinho do mapa", () => {
  const m = comPendenciasDeEquipamento(novoMapa({ projetoId: "P311B", data: "2026-11-18", turno: "D" }), EQ);
  expect(m.material.pendenciasEquip).toHaveLength(4);
  const resolvido = { ...EQ, lanternas: [{ ...EQ.lanternas[0], status: "ok", dataProblem: "", justificativa: "" }, EQ.lanternas[1]] };
  const m2 = comPendenciasDeEquipamento(m, resolvido);
  expect(m2.material.pendenciasEquip.map((p) => p.nome)).not.toContain("Lanterna Tático");
  expect(comPendenciasDeEquipamento(m2, { lanternas: [] }).material.pendenciasEquip).toEqual([]);
});
test("sem pendência: o mapa não muda (nem ganha campo)", () => {
  const m = novoMapa({ projetoId: "P311B", data: "2026-11-18", turno: "D" });
  expect(comPendenciasDeEquipamento(m, { lanternas: [{ id: "x", status: "ok" }] })).toBe(m);
  expect(comPendenciasDeEquipamento(m, null)).toBe(m);
});
test("WhatsApp: bloco próprio com as linhas; sem pendência não aparece", () => {
  const m = comPendenciasDeEquipamento(novoMapa({ projetoId: "P311B", data: "2026-11-18", turno: "D" }), EQ);
  const t = montarTextoWhatsApp(m);
  expect(t).toContain("🔧 *EQUIPAMENTOS COM PENDÊNCIA*");
  expect(t).toContain("• Lanterna Tático — INOPERANTE há 3 dias (desde 15/11): Não acende");
  expect(montarTextoWhatsApp(novoMapa({ projetoId: "P311B", data: "2026-11-18", turno: "D" }))).not.toContain("EQUIPAMENTOS COM PENDÊNCIA");
});
