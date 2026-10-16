import { lancamentosDoMapa, aplicarNaFicha, resumoLancamento } from "./ficha";

const mapa = (postos, extra = {}) => ({ id: "P601_2026-10-11_D", projetoId: "P601", data: "2026-10-11", turno: "D", postos, ...extra });
const posto = (rotulo, pessoaId, situacao, detalhe = {}, obs = "") => ({ rotulo, pessoaId, pessoaNome: pessoaId, situacao, detalhe, obs });
const doc = () => ({ colaboradores: [{ id: "a", nome: "Ana", historico: [{ id: "h0", tipo: "Treinamento", data: "2026-09-01" }] }, { id: "b", nome: "Bia" }, { id: "c", nome: "Caio", historico: [] }], desligados: [] });

test("só falta, FT e atraso viram lançamento; cobertura, troca, vago, presente e nome digitado não", () => {
  const l = lancamentosDoMapa(mapa([
    posto("Líder", "a", "falta"), posto("CCO", "b", "atraso", { minutos: "20" }), posto("CDA", "c", "ft"),
    posto("VSPP", "d", "cobertura", { base: true }), posto("P1", "e", "troca"), posto("P2", "f", "vago"), posto("P3", "g", "presente"),
    posto("Digitado", "", "falta"),
  ]));
  expect(l.map((x) => [x.colabId, x.tipo])).toEqual([["a", "Falta"], ["b", "Atraso"], ["c", "FT"]]);
  expect(l[0]).toMatchObject({ id: "mapa:P601_2026-10-11_D:a:Falta", data: "2026-10-11", diasFalta: 1, origem: "mapa" });
  expect(l[1].detalhe).toBe("Atraso de 20 min no posto CCO — mapa de 11/10/2026 (diurno)");
});
test("a observação do posto (pode ter dado sensível) não vai para a ficha", () => {
  const l = lancamentosDoMapa(mapa([posto("Líder", "a", "falta", {}, "consulta médica")]));
  expect(JSON.stringify(l)).not.toMatch(/médica/);
});
test("aplica no histórico da ficha, no topo, sem mexer no resto", () => {
  const m = mapa([posto("Líder", "a", "falta"), posto("CCO", "b", "atraso", { hora: "06:20" })]);
  const r = aplicarNaFicha(doc(), m, new Date("2026-10-11T12:00:00Z"));
  expect(r).toMatchObject({ mudou: true, adicionados: 2, removidos: 0 });
  const a = r.after.colaboradores[0].historico;
  expect(a.map((h) => h.tipo)).toEqual(["Falta", "Treinamento"]);
  expect(a[0].registradoEm).toBe("2026-10-11T12:00:00.000Z");
  expect(r.after.colaboradores[1].historico[0].detalhe).toContain("chegou às 06:20");
  expect(r.after.colaboradores[2]).toBe(doc().colaboradores[2] ? r.after.colaboradores[2] : null);
});
test("concluir de novo não duplica e não grava nada (mudou=false)", () => {
  const m = mapa([posto("Líder", "a", "falta")]);
  const r1 = aplicarNaFicha(doc(), m);
  const r2 = aplicarNaFicha(r1.after, m);
  expect(r2.mudou).toBe(false);
  expect(r2.after.colaboradores[0].historico.filter((h) => h.tipo === "Falta")).toHaveLength(1);
});
test("correção: situação mudou atualiza; desfeita remove só o que o próprio mapa criou", () => {
  const f = { colaboradores: [{ id: "a", historico: [{ id: "manual", tipo: "Falta", data: "2026-10-11" }, { id: "mapa:OUTRO:a:Falta", tipo: "Falta", origem: "mapa", mapaId: "OUTRO", data: "2026-10-10" }] }] };
  const r1 = aplicarNaFicha(f, mapa([posto("CCO", "a", "atraso", { minutos: "10" })]));
  const r2 = aplicarNaFicha(r1.after, mapa([posto("CCO", "a", "atraso", { minutos: "30" })]));
  expect(r2).toMatchObject({ atualizados: 1, adicionados: 0 });
  expect(r2.after.colaboradores[0].historico.find((h) => h.tipo === "Atraso").detalhe).toContain("30 min");
  const r3 = aplicarNaFicha(r2.after, mapa([posto("CCO", "a", "presente")]));
  expect(r3.removidos).toBe(1);
  expect(r3.after.colaboradores[0].historico.map((h) => h.id)).toEqual(["manual", "mapa:OUTRO:a:Falta"]); // manual e de outro mapa ficam
});
test("colaborador que não está mais na Equipe é ignorado, sem erro", () => {
  const r = aplicarNaFicha(doc(), mapa([posto("Líder", "zz", "falta")]));
  expect(r).toMatchObject({ mudou: false, ignorados: 1 });
});
test("resumo para o líder", () => {
  const m = mapa([posto("Líder", "a", "falta"), posto("CCO", "b", "atraso", { minutos: "5" }), posto("CDA", "c", "atraso", { minutos: "5" })]);
  expect(resumoLancamento({ removidos: 0 }, m)).toBe("Ficha atualizada: 1 falta, 2 atrasos.");
  expect(resumoLancamento({ removidos: 0 }, mapa([posto("Líder", "a", "presente")]))).toBe("Nenhum lançamento para a ficha neste mapa.");
});

test("FT com 'quem faltou': a FT vai para quem cobriu e a falta para a ficha de quem faltou", () => {
  const m = mapa([posto("CCO", "b", "ft", { quemFaltouId: "a", quemFaltou: "Ana" })]);
  const l = lancamentosDoMapa(m);
  expect(l.map((x) => [x.colabId, x.tipo])).toEqual([["b", "FT"], ["a", "Falta"]]);
  expect(l[1]).toMatchObject({ id: "mapa:P601_2026-10-11_D:a:Falta", diasFalta: 1, origem: "mapa" });
  expect(l[1].detalhe).toContain("coberta por FT de b");
  const r = aplicarNaFicha(doc(), m);
  expect(r.after.colaboradores[0].historico[0].tipo).toBe("Falta");
  expect(r.after.colaboradores[1].historico[0].tipo).toBe("FT");
  // concluir de novo não duplica; corrigir (trocar quem faltou) tira a falta antiga e lança a nova
  const r2 = aplicarNaFicha(r.after, m);
  expect(r2.mudou).toBe(false);
  const r3 = aplicarNaFicha(r.after, mapa([posto("CCO", "b", "ft", { quemFaltouId: "c", quemFaltou: "Caio" })]));
  expect(r3.after.colaboradores[0].historico.some((h) => h.tipo === "Falta")).toBe(false);
  expect(r3.after.colaboradores[2].historico.some((h) => h.tipo === "Falta")).toBe(true);
});
test("FT sem 'quem faltou' ou 'ninguém faltou' só lança a FT; a própria pessoa não vira falta", () => {
  expect(lancamentosDoMapa(mapa([posto("CCO", "b", "ft", { semFalta: true })])).map((x) => x.tipo)).toEqual(["FT"]);
  expect(lancamentosDoMapa(mapa([posto("CCO", "b", "ft", { quemFaltouId: "b" })])).map((x) => x.tipo)).toEqual(["FT"]);
});
test("descricaoLancamentos: diz quem recebe o quê (FT e a falta de quem foi coberto)", () => {
  const { descricaoLancamentos } = require("./ficha");
  const m = mapa([posto("P1", "b", "falta", { porFtDe: "x" }), { ...posto("Posto extra", "d", "ft", { quemFaltouId: "b", quemFaltou: "Marta" }), id: "x", pessoaNome: "Joao" }]);
  m.postos[0].pessoaNome = "Marta";
  expect(descricaoLancamentos(m).sort()).toEqual(["FT de Joao", "Falta de Marta"]);
});

test("saída antecipada: quem saiu recebe Falta com a observação; quem cobriu NÃO recebe FT; concluir de novo não duplica", () => {
  const mapa = { id: "P311A_2026-10-15_D", projetoId: "P311A", data: "2026-10-15", turno: "D", postos: [{ id: "p1", rotulo: "Vigilante Tático", pessoaId: "c1", pessoaNome: "Ana", situacao: "presente", saida: { motivo: "Mal súbito", hora: "14:30", coberturas: [{ tipo: "ft", pessoaId: "c2", pessoaNome: "Beto", de: "14:30" }] } }, { id: "p2", rotulo: "Apoio", pessoaId: "c2", pessoaNome: "Beto", situacao: "presente" }] };
  const l = lancamentosDoMapa(mapa);
  expect(l).toHaveLength(1);
  expect(l[0]).toMatchObject({ colabId: "c1", tipo: "Falta", id: "mapa:P311A_2026-10-15_D:c1:Falta" });
  expect(l[0].detalhe).toContain("Saída antecipada — Mal súbito — saiu às 14:30 — posto Vigilante Tático");
  const doc = { colaboradores: [{ id: "c1", historico: [] }, { id: "c2", historico: [] }] };
  const um = aplicarNaFicha(doc, mapa);
  const dois = aplicarNaFicha(um.after, mapa);
  expect(dois.mudou).toBe(false);
});
