import { reconciliarItem, reconciliarLista, diasEntre } from "./equipamentosOcorrencias";
const AGORA = new Date("2026-11-18T10:00:00-03:00");
const ok = { id: "a", identificacao: "Bodycam Reserva", status: "ok" };
const inop = { ...ok, status: "inop", dataProblem: "2026-11-15", justificativa: "Não foi entregue" };

test("abrir: item que vira problema ganha uma ocorrência aberta", () => {
  const r = reconciliarItem(ok, inop, { agora: AGORA });
  expect(r.ocorrencias).toEqual([{ abertaEm: "2026-11-15", status: "inop", justificativa: "Não foi entregue" }]);
});
test("fechar: resolver (status ok) fecha a ocorrência com a data de hoje e quem fechou", () => {
  const aberto = reconciliarItem(ok, inop, { agora: AGORA });
  const r = reconciliarItem(aberto, { ...aberto, status: "ok", dataProblem: "", justificativa: "" }, { agora: AGORA, por: "Gerencial" });
  expect(r.ocorrencias).toEqual([{ abertaEm: "2026-11-15", status: "inop", justificativa: "Não foi entregue", fechadaEm: "2026-11-18", fechadaPor: "Gerencial" }]);
  expect(r.status).toBe("ok");
});
test("pendência antiga (sem histórico) também fecha com a abertura original", () => {
  const r = reconciliarItem(inop, { ...inop, status: "ok", dataProblem: "", justificativa: "" }, { agora: AGORA });
  expect(r.ocorrencias[0]).toMatchObject({ abertaEm: "2026-11-15", fechadaEm: "2026-11-18" });
});
test("parcial → inoperante e correção de data atualizam a ocorrência aberta, sem abrir outra", () => {
  const a = reconciliarItem(ok, { ...inop, status: "parcial" }, { agora: AGORA });
  const b = reconciliarItem(a, { ...a, status: "inop", dataProblem: "2026-11-13" }, { agora: AGORA });
  expect(b.ocorrencias).toEqual([{ abertaEm: "2026-11-13", status: "inop", justificativa: "Não foi entregue" }]);
});
test("reabrir depois de resolver cria nova ocorrência e mantém a anterior", () => {
  const a = reconciliarItem(ok, inop, { agora: AGORA });
  const b = reconciliarItem(a, { ...a, status: "ok", dataProblem: "", justificativa: "" }, { agora: AGORA });
  const c = reconciliarItem(b, { ...b, status: "parcial", dataProblem: "2026-11-18", justificativa: "Voltou a falhar" }, { agora: AGORA });
  expect(c.ocorrencias).toHaveLength(2);
  expect(c.ocorrencias[0].fechadaEm).toBe("2026-11-18");
  expect(c.ocorrencias[1]).toMatchObject({ abertaEm: "2026-11-18", status: "parcial" });
  expect(c.ocorrencias[1].fechadaEm).toBeUndefined();
});
test("item sem mudança de status/data/texto não é tocado (nem recebe campo novo)", () => {
  const outro = { id: "b", identificacao: "Lanterna", status: "ok", qtd: 2 };
  const [x, y] = reconciliarLista([ok, outro], [{ ...ok, status: "inop", dataProblem: "2026-11-15", justificativa: "x" }, { ...outro, qtd: 3 }], { agora: AGORA });
  expect(x.ocorrencias).toHaveLength(1);
  expect(y).toEqual({ ...outro, qtd: 3 });
});
test("item novo já com problema abre ocorrência; sem data usa hoje", () => {
  const [n] = reconciliarLista([], [{ id: "n", status: "inop", justificativa: "Chegou quebrado" }], { agora: AGORA });
  expect(n.ocorrencias).toEqual([{ abertaEm: "2026-11-18", status: "inop", justificativa: "Chegou quebrado" }]);
});
test("diasEntre", () => {
  expect(diasEntre("2026-11-15", "2026-11-18")).toBe(3);
  expect(diasEntre("2026-11-18", "2026-11-15")).toBe(0);
  expect(diasEntre("", "2026-11-15")).toBeNull();
});
