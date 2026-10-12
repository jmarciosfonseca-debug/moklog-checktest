import { mergeRespostasPorAtualizacao } from "./diagnosticoSync";
test("aparelho B abre diagnóstico 100% sem regredir",()=>{
  const celular={D01:{status:"c",updatedAt:"2026-09-23T10:00:00Z"},D02:{status:"c",updatedAt:"2026-09-23T10:01:00Z"}};
  expect(Object.keys(mergeRespostasPorAtualizacao(celular,{}))).toHaveLength(2);
});
test("preserva itens e usa a atualização mais recente no conflito",()=>{
  const remoto={D01:{status:"c",updatedAt:"2026-09-23T10:00:00Z"},D02:{status:"p",updatedAt:"2026-09-23T10:05:00Z"}};
  const local={D03:{status:"c",updatedAt:"2026-09-23T10:06:00Z"},D02:{status:"nc",updatedAt:"2026-09-23T10:07:00Z"}};
  expect(mergeRespostasPorAtualizacao(remoto,local)).toEqual({D01:remoto.D01,D02:local.D02,D03:local.D03});
});

import { filtrarDiagnosticosPorEstado, filtrosConsultaDiagnosticos, friendlyPersistError, criarDiagnosticoId, deveBuscarDiagnosticoRemoto, normalizarAtualizacao } from "./diagnosticoSync";

test("primeira gravação: diagnóstico novo não é lido antes de existir (a regra nega o get)", () => {
  expect(deveBuscarDiagnosticoRemoto(null)).toBe(false);
  expect(deveBuscarDiagnosticoRemoto("")).toBe(false);
  expect(deveBuscarDiagnosticoRemoto("diag-1")).toBe(true);
  expect(criarDiagnosticoId({ randomUUID: () => "uuid-fixo" })).toBe("uuid-fixo");
  expect(criarDiagnosticoId({})).toMatch(/^diag_/);
});
test("compara updatedAt numérico e ISO do mesmo jeito", () => {
  expect(normalizarAtualizacao(200)).toBe(200);
  expect(normalizarAtualizacao("1970-01-01T00:00:00.100Z")).toBe(100);
  expect(normalizarAtualizacao(undefined)).toBe(0);
  expect(mergeRespostasPorAtualizacao({ i: { status: "conforme", updatedAt: 200 } }, { i: { status: "parcial", updatedAt: 100 } }).i.status).toBe("conforme");
});
test("consultas declaram o escopo que as regras exigem", () => {
  expect(filtrosConsultaDiagnosticos({ tipo: "existente", projetoRef: "P607" }, "u")).toEqual([["tipo", "==", "existente"], ["projetoRef", "==", "P607"]]);
  expect(filtrosConsultaDiagnosticos({ tipo: "novo", chave: "novo_u_x" }, "u")).toEqual([["tipo", "==", "novo"], ["projetoRef", "==", null], ["autorUid", "==", "u"]]);
  expect(filtrosConsultaDiagnosticos({ tipo: "novo", chave: "x" })).toEqual([]);
});
test("ativos x arquivados: nada é apagado", () => {
  const docs = [{ id: "a", estado: "rascunho" }, { id: "b", estado: "arquivado" }, { id: "c" }];
  expect(filtrarDiagnosticosPorEstado(docs, "ativos").map((d) => d.id)).toEqual(["a", "c"]);
  expect(filtrarDiagnosticosPorEstado(docs, "arquivados").map((d) => d.id)).toEqual(["b"]);
});
test("mensagens de erro de gravação dizem a causa e que o rascunho está protegido", () => {
  expect(friendlyPersistError({ code: "permission-denied" })).toMatch(/permissão/);
  expect(friendlyPersistError({ code: "unavailable" })).toMatch(/rascunho local continua protegido/);
  expect(friendlyPersistError({})).toMatch(/rascunho local continua protegido/);
});
