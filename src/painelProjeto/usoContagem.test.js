// Fase 0 (temporário): contagens de uso só devolvem números e respeitam a janela de 30 dias.
const { contarUso, visitasRd, tamanhoKB } = require("./usoContagem");
const HOJE = "2026-11-12";

test("lista: total, 30 dias, sem data e último", () => {
  expect(contarUso.lista([{ data: "2026-11-10" }, { data: "2026-10-13" }, { data: "2026-10-14" }, { criadoEm: "2026-11-01T10:00:00Z" }, { x: 1 }], HOJE)).toEqual({ total: 5, d30: 3, semData: 1, ultimo: "2026-11-10" });
  expect(contarUso.lista(undefined, HOJE)).toEqual({ erro: true });
  expect(contarUso.testes({ history: [{ meta: { data: "2026-11-08" } }, { meta: { data: "2026-09-01" } }] }, HOJE)).toMatchObject({ total: 2, d30: 1 });
});
test("documento-lista pega a maior lista; documento ausente não quebra", () => {
  expect(contarUso.documento({ registros: [{ data: "2026-11-11" }, { data: "2020-01-01" }], outra: [{ a: 1 }], updatedAt: "2026-11-11T12:00:00Z" }, HOJE)).toMatchObject({ existe: true, campo: "registros", total: 2, d30: 1, atualizado: "2026-11-11" });
  expect(contarUso.documento(null, HOJE)).toEqual({ existe: false, total: 0, d30: 0 });
});
test("mapas enviados por turno e ronda virtual executada vs não executada", () => {
  const m = [{ id: "P601_2026-11-11_D", data: "2026-11-11", turno: "D", status: "enviado" }, { id: "P601_2026-11-11_N", data: "2026-11-11", turno: "N", status: "rascunho" }, { id: "P601_2026-09-01_D", data: "2026-09-01", turno: "D", status: "enviado" }];
  expect(contarUso.mapas(m, HOJE)).toMatchObject({ total: 3, d30: 2, enviadosD: 1, enviadosN: 0, rascunho: 1 });
  const r = { turnos: [{ tipo: "noturno", dataInicio: "2026-11-11", rondas: { 0: { inicio: "18:00", fim: "18:10" }, 60: { naoExec: true }, 120: { inicio: "20:05", atrasada: true } } }, { tipo: "diurno", dataInicio: "2026-08-01", rondas: { 0: { inicio: "06:00" } } }] };
  expect(contarUso.ronda(r, HOJE)).toEqual({ turnosTotal: 2, noturnos30: 1, diurnos30: 0, slots: 3, executados: 2, naoExec: 1, atrasados: 1 });
});
test("equipamentos, tratativas, equipe e RD: só números, nenhum dado pessoal", () => {
  expect(contarUso.equipamentos({ cftv: [{ id: "CF1", status: "ok" }, { id: "CF2", status: "problem", dataProblem: "2026-10-20", historico: [{ status: "x" }] }] })).toMatchObject({ itens: 2, comProblema: 1, problemaComData: 1 });
  expect(contarUso.followups({ registros: [{ key: "a", entries: [{ em: "2026-11-09T10:00:00Z" }, { em: "2026-08-01T10:00:00Z" }] }] }, HOJE)).toEqual({ pendenciasComTratativa: 1, tratativas: 2, tratativas30: 1 });
  const eq = { colaboradores: [{ id: "c1", nome: "Fulano de Tal", telefone: "11999990000", cpfCifrado: "v1:x", historico: [{ tipo: "Falta", data: "2026-11-02" }, { tipo: "FT", data: "2026-11-03" }, { tipo: "Falta", data: "2026-01-01" }] }], checagemEquipe: { alvo: "2026-11-14", checkins: [{}], concluidoEm: null } };
  const e = contarUso.equipe(eq, HOJE);
  expect(e).toEqual({ ativos: 1, lancamentos30: { Falta: 1, FT: 1 }, checagemAtual: { alvo: "2026-11-14", checkins: 1, concluida: false }, cadeadoFechado: false });
  const rd = visitasRd([{ uid: "u1", data: "2026-11-10", trechos: [{ destino: "P601" }, { destino: "p601" }, { destino: "P604" }] }, { uid: "u1", data: "2026-11-11", trechos: [{ destino: "P601" }] }, { uid: "u1", data: "2026-01-01", trechos: [{ destino: "P601" }] }], HOJE, ["P601", "P604", "P605"]);
  expect(rd).toEqual({ diasComRd30: 2, trechos30: 4, trechosComDestino: 4, diasComVisitaPorProjeto: { P601: 2, P604: 1, P605: 0 }, identificaProjeto: true });
  expect(JSON.stringify([e, rd])).not.toMatch(/Fulano|11999990000|v1:x|u1/);
  expect(tamanhoKB({ a: "x".repeat(2048) })).toBe(2);
});
