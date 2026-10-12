import { consolidar, ocorrenciasDoMapa, listaLideres, descreverFiltros, liderDoMapa } from "./consolidado";

const posto = (id, rotulo, pessoaNome, situacao = "presente", detalhe = {}, extra = {}) => ({ id, rotulo, pessoaNome, situacao, detalhe, ...extra });
const mapa = (projetoId, data, turno, postos, extra = {}) => ({ id: `${projetoId}_${data}_${turno}`, projetoId, data, turno, status: "enviado", postos, veiculos: [], ...extra });

const A = mapa("P606", "2026-10-11", "N", [
  posto("l", "Líder", "Marcos", "presente", {}, { lider: true }),
  posto("c", "CCO", "Elaine", "falta", { porFtDe: "f1" }),
  posto("f1", "Posto extra", "Rosemeire", "ft", { quemFaltouId: "e", quemFaltou: "Elaine", faltaPostoId: "c" }),
]);
const B = mapa("P601", "2026-10-10", "D", [posto("l", "Líder", "Carlos", "presente", {}, { lider: true }), posto("c", "CCO", "Ana")], { veiculos: [{ rotulo: "Moto", kmAnterior: 100, kmAtual: 160 }] });
const C = mapa("P601", "2026-10-09", "D", [posto("l", "Líder", "Carlos", "falta", {}, { lider: true })], { status: "rascunho" });
const D = mapa("P606", "2026-10-05", "D", [posto("l", "Líder", "Marcos", "presente", {}, { lider: true }), posto("c", "CCO", "Elaine", "atraso", { hora: "06:40", minutos: 40 })]);
const E = mapa("P260A", "2026-10-11", "D", [posto("l", "VSPP Líder", "Paulo", "presente", {}, { lider: true }), posto("x", "Posto extra", "Rosemeire", "ft", { semFalta: true })]);
const TODOS = [A, B, C, D, E];
const base = { de: "2026-10-01", ate: "2026-10-31" };

test("só entram mapas concluídos, dentro do período", () => {
  const r = consolidar(TODOS, base);
  expect(r.totais.mapas).toBe(4);
  expect(r.mapas.some((m) => m.status !== "enviado")).toBe(false);
  expect(consolidar(TODOS, { ...base, de: "2026-10-10", ate: "2026-10-10" }).mapas.map((m) => m.projetoId)).toEqual(["P601"]);
  expect(consolidar(TODOS, { ...base, ate: "2026-10-04" }).totais.mapas).toBe(0);
});
test("ordena por data, projeto e plantão", () => {
  expect(consolidar(TODOS, base).mapas.map((m) => `${m.data} ${m.projetoId}`)).toEqual(["2026-10-05 P606", "2026-10-10 P601", "2026-10-11 P260A", "2026-10-11 P606"]);
});
test("filtra por projeto, plantão e líder", () => {
  expect(consolidar(TODOS, { ...base, projetos: ["P606"] }).totais.mapas).toBe(2);
  expect(consolidar(TODOS, { ...base, turno: "N" }).mapas.map((m) => m.projetoId)).toEqual(["P606"]);
  expect(consolidar(TODOS, { ...base, lider: "Marcos" }).totais.mapas).toBe(2);
  expect(consolidar(TODOS, { ...base, lider: "Carlos" }).totais.mapas).toBe(1);
});
test("falta e FT: contagem e linhas coerentes com o filtro", () => {
  const todos = consolidar(TODOS, base).totais;
  expect(todos).toMatchObject({ falta: 1, ft: 2, atraso: 1 });
  const soFalta = consolidar(TODOS, { ...base, ocorrencia: "falta" });
  expect(soFalta.mapas.map((m) => m.projetoId)).toEqual(["P606"]);
  expect(soFalta.ocorrencias.map((o) => o.tipo)).toEqual(["falta"]);
  expect(soFalta.totais).toMatchObject({ mapas: 1, falta: 1, ft: 0 });
  const soFt = consolidar(TODOS, { ...base, ocorrencia: "ft" });
  expect(soFt.totais).toMatchObject({ mapas: 2, falta: 0, ft: 2 });
  const ambos = consolidar(TODOS, { ...base, ocorrencia: "falta_ft" });
  expect(ambos.totais).toMatchObject({ mapas: 2, falta: 1, ft: 2, atraso: 0 });
  expect(consolidar(TODOS, { ...base, ocorrencia: "qualquer" }).totais.mapas).toBe(3); // B não tem ocorrência
});
test("detalhe das ocorrências: quem faltou, quem cobriu, FT sem falta", () => {
  const o = ocorrenciasDoMapa(A);
  expect(o.find((x) => x.tipo === "falta").detalhe).toBe("coberta por FT de Rosemeire");
  expect(o.find((x) => x.tipo === "ft").detalhe).toBe("cobrindo a falta de Elaine");
  expect(ocorrenciasDoMapa(E)[0].detalhe).toMatch(/sem falta/);
  expect(ocorrenciasDoMapa(D)[0].detalhe).toBe("chegou às 06h40 · 40 min");
  expect(o[0].lider).toBe("Marcos");
});
test("colaborador: acha a pessoa sem acento/caixa e restringe as linhas a ela", () => {
  const r = consolidar(TODOS, { ...base, colaborador: "rosemeire" });
  expect(r.mapas.map((m) => m.projetoId).sort()).toEqual(["P260A", "P606"]);
  expect(r.ocorrencias.every((o) => o.envolvidos.some((n) => /rosemeire/i.test(n)))).toBe(true);
  // Elaine aparece como falta (A) e atraso (D); a FT da Rosemeire cita a Elaine
  const e = consolidar(TODOS, { ...base, colaborador: "ELAINE" });
  expect(e.totais.falta).toBe(1);
  expect(e.totais.atraso).toBe(1);
  expect(consolidar(TODOS, { ...base, colaborador: "ninguem assim" }).totais.mapas).toBe(0);
});
test("km soma o rodado dos veículos; km negativo/ausente não entra", () => {
  const r = consolidar([B, mapa("P601", "2026-10-12", "D", [], { veiculos: [{ rotulo: "Moto", kmAnterior: 500, kmAtual: 400 }, { rotulo: "Carro", kmAnterior: null, kmAtual: 10 }] })], base);
  expect(r.totais.km).toBe(60);
  expect(r.porProjeto).toEqual([expect.objectContaining({ projetoId: "P601", mapas: 2, km: 60 })]);
});
test("lista de líderes e rótulos dos filtros", () => {
  expect(listaLideres(TODOS)).toEqual(["Carlos", "Marcos", "Paulo"]);
  expect(liderDoMapa(mapa("P1", "2026-10-01", "D", []))).toBe("");
  const txt = descreverFiltros({ ...base, projetos: ["P606"], turno: "N", lider: "Marcos", ocorrencia: "falta_ft" }, (p) => `${p} · Nome`).join(" | ");
  expect(txt).toContain("Período 01/10/2026 a 31/10/2026");
  expect(txt).toContain("P606 · Nome");
  expect(txt).toContain("Plantão noturno");
  expect(txt).toContain("Líder: Marcos");
  expect(txt).toContain("Falta ou FT");
});
test("entrada vazia ou malformada não quebra", () => {
  expect(consolidar([], base).totais.mapas).toBe(0);
  expect(consolidar(null, base).totais.mapas).toBe(0);
  expect(consolidar([null, { status: "enviado" }], base).totais.mapas).toBe(0);
});

// Mapa antigo do P606 (11/10 noturno): sem a marca de líder e a FT entrou direto no posto CCO; a Elaine só está em "quem faltou".
const ANTIGO = mapa("P606", "2026-10-11", "N", [
  posto("l", "Líder", "Luiz Felipe"),
  posto("c", "CCO", "Rosemeire", "ft", { quemFaltou: "Elaine Farias", quemFaltouId: "e1" }, { obs: "Falta com atestado" }),
  posto("v", "Vigilante", "Murilo"),
]);
test("FT cobrindo falta sempre mostra a falta, mesmo sem posto marcado como falta", () => {
  const o = ocorrenciasDoMapa(ANTIGO);
  expect(o.map((x) => x.tipo)).toEqual(["falta", "ft"]);
  expect(o[0]).toMatchObject({ pessoa: "Elaine Farias", posto: "CCO", derivada: true });
  expect(o[0].detalhe).toBe("coberta por FT de Rosemeire — Falta com atestado");
  const r = consolidar([ANTIGO], base);
  expect(r.totais).toMatchObject({ mapas: 1, falta: 1, ft: 1 });
  expect(consolidar([ANTIGO], { ...base, ocorrencia: "falta" }).totais.falta).toBe(1);
  expect(consolidar([ANTIGO], { ...base, colaborador: "elaine" }).ocorrencias.map((x) => x.tipo)).toEqual(["falta", "ft"]);
});
test("não duplica a falta quando o posto da falta já está no mapa; FT sem falta não gera falta", () => {
  expect(ocorrenciasDoMapa(A).filter((x) => x.tipo === "falta")).toHaveLength(1);
  expect(ocorrenciasDoMapa(A).find((x) => x.tipo === "falta").derivada).toBeUndefined();
  expect(ocorrenciasDoMapa(E).map((x) => x.tipo)).toEqual(["ft"]);
  const porNome = mapa("P1", "2026-10-02", "D", [posto("a", "CCO", "Elaine Farias", "falta"), posto("f", "Posto extra", "Rosemeire", "ft", { quemFaltou: "elaine farias" })]);
  expect(ocorrenciasDoMapa(porNome).filter((x) => x.tipo === "falta")).toHaveLength(1);
});
test("líder de mapa antigo (sem marca) sai do posto com Líder no nome", () => {
  expect(liderDoMapa(ANTIGO)).toBe("Luiz Felipe");
  expect(consolidar([ANTIGO], { ...base, lider: "Luiz Felipe" }).totais.mapas).toBe(1);
});
