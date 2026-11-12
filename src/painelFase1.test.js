// Painel do projeto — Fase 1: histórico da checagem de equipe e data de fim da falha de KeyAccess.
const { arquivarChecagem, save } = require("../api/ai/lib/equipeMerge");
const { chkEqResumoCiclo, chkEqArquivar, CHK_EQ_HISTORICO_MAX } = require("./checagemEquipeRegras");
const { minutosDaFalha, duracaoDaFalha, dataFimDaFalha } = require("./keyaccessDuracao");

const eq12x36 = [{ id: "a", escala: "12x36" }, { id: "b", escala: "12x36" }];
const ciclo = (alvo, slots, concluidoEm) => ({ alvo, checkins: slots.map((slotId) => ({ slotId, lider: "Fulano de Tal", em: "x" })), ...(concluidoEm ? { concluidoEm } : {}) });

describe("histórico da checagem de equipe", () => {
  test("resumo do ciclo: só números e datas; completo e incompleto", () => {
    const inc = chkEqResumoCiclo(ciclo("2026-11-07", ["sab_diurno", "sab_noturno", "dom_diurno"]), "P601", eq12x36, "T");
    expect(inc).toEqual({ alvo: "2026-11-07", feitos: 3, esperados: 4, completo: false, concluidoEm: null, arquivadoEm: "T" });
    expect(JSON.stringify(inc)).not.toContain("Fulano");
    expect(chkEqResumoCiclo(ciclo("2026-11-07", ["diurno", "noturno"], "2026-11-08T20:00:00Z"), "P505", [], "T")).toMatchObject({ feitos: 2, esperados: 2, completo: true, concluidoEm: "2026-11-08T20:00:00Z" });
    expect(chkEqResumoCiclo(ciclo("2026-11-07", ["x"]), "P260B", [], "T")).toBeNull(); // P260B não faz checagem
    expect(chkEqResumoCiclo({ checkins: [] }, "P601", eq12x36, "T")).toBeNull();
  });
  test("arquiva um por fim de semana, mais recente primeiro, no máximo 12", () => {
    let h = [];
    for (let i = 1; i <= 14; i++) h = chkEqArquivar(h, { alvo: `2026-${String(Math.ceil(i / 4)).padStart(2, "0")}-${String(((i - 1) % 4) * 7 + 1).padStart(2, "0")}`, feitos: 4, esperados: 4, completo: true });
    expect(h).toHaveLength(CHK_EQ_HISTORICO_MAX); expect(h[0].alvo > h[11].alvo).toBe(true);
    const de = chkEqArquivar(h, { ...h[0], feitos: 1, completo: false }); expect(de).toHaveLength(12); expect(de[0]).toMatchObject({ feitos: 1, completo: false }); // mesmo alvo não duplica
  });
  test("ao virar o fim de semana, o servidor arquiva o ciclo anterior — inclusive o incompleto", () => {
    const current = { colaboradores: eq12x36, checagemEquipe: ciclo("2026-11-07", ["sab_diurno", "dom_noturno"]), checagemHistorico: [{ alvo: "2026-10-31", feitos: 4, esperados: 4, completo: true }] };
    const mesmo = { ...current, checagemEquipe: ciclo("2026-11-07", ["sab_diurno", "dom_noturno", "dom_diurno"]) };
    arquivarChecagem("P601", current, mesmo); expect(mesmo.checagemHistorico).toHaveLength(1); // mesmo fim de semana: nada a arquivar
    const novo = { ...current, checagemEquipe: ciclo("2026-11-14", ["sab_diurno"]) };
    arquivarChecagem("P601", current, novo);
    expect(novo.checagemHistorico.map((x) => [x.alvo, x.feitos, x.completo])).toEqual([["2026-11-07", 2, false], ["2026-10-31", 4, true]]);
    const volta = { ...current, checagemEquipe: ciclo("2026-10-31", []) }; arquivarChecagem("P601", current, volta); expect(volta.checagemHistorico).toHaveLength(1); // correção para trás não arquiva
  });
  test("gravação real: líder registra o 1º check-in do novo fim de semana e o histórico nasce; ninguém edita o histórico pela tela", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-14T13:00:00Z")); // sábado
    let banco = { colaboradores: eq12x36, desligados: [], checagemEquipe: ciclo("2026-11-07", ["sab_diurno", "sab_noturno", "dom_diurno"]) };
    const db = { collection: () => ({ doc: () => "ref" }), runTransaction: async (f) => f({ get: async () => ({ exists: true, data: () => JSON.parse(JSON.stringify(banco)) }), set: (_, v) => { banco = v; } }) };
    try {
      const depois = { ...banco, checagemEquipe: ciclo("2026-11-14", ["sab_diurno"]) };
      const r = await save(db, "P601", banco, depois, { nivel: "lider", pid: "P601" });
      expect(r.checagemHistorico).toEqual([expect.objectContaining({ alvo: "2026-11-07", feitos: 3, esperados: 4, completo: false })]);
      await expect(save(db, "P601", banco, { ...banco, checagemHistorico: [] }, { nivel: "lider", pid: "P601" })).rejects.toThrow(/mantido pelo servidor/);
      await expect(save(db, "P601", banco, { ...banco, checagemHistorico: [] }, { nivel: "admin" })).rejects.toThrow(/mantido pelo servidor/);
    } finally { jest.useRealTimers(); }
  });
});

describe("KeyAccess: duração com data de fim", () => {
  test("registro novo com dataFim mede dias inteiros; antigo segue a regra anterior", () => {
    expect(minutosDaFalha({ data: "2026-11-10", horaInicio: "22:00", horaFim: "06:00", dataFim: "2026-11-12" })).toBe(32 * 60);
    expect(duracaoDaFalha({ data: "2026-11-10", horaInicio: "22:00", horaFim: "06:00", dataFim: "2026-11-12" })).toBe("1d 8h 0min");
    expect(minutosDaFalha({ data: "2026-11-10", horaInicio: "08:00", horaFim: "09:30", dataFim: "2026-11-10" })).toBe(90);
    expect(minutosDaFalha({ data: "2026-11-10", horaInicio: "08:00", horaFim: "09:30" })).toBe(90);             // antigo, mesmo dia
    expect(minutosDaFalha({ data: "2026-11-10", hora: "23:00", horaFim: "01:00" })).toBe(120);                   // antigo, virou o dia
    expect(duracaoDaFalha({ data: "2026-11-10", horaInicio: "08:00", horaFim: "08:45" })).toBe("45 min");
  });
  test("aberta, hora inválida e retorno antes do início não geram duração", () => {
    expect(minutosDaFalha({ data: "2026-11-10", horaInicio: "08:00", horaFim: "" })).toBeNull();
    expect(minutosDaFalha({ data: "2026-11-10", horaInicio: "08:00", horaFim: "07:00", dataFim: "2026-11-10" })).toBeNull();
    expect(minutosDaFalha({ data: "2026-11-10", horaInicio: "8h", horaFim: "09:00" })).toBeNull();
    expect(dataFimDaFalha({ data: "2026-11-10", horaFim: "" })).toBeNull();
    expect(dataFimDaFalha({ data: "2026-11-10", horaFim: "09:00" })).toBe("2026-11-10");                       // antigo sem dataFim = data do início
    expect(dataFimDaFalha({ data: "2026-11-10", horaFim: "09:00", dataFim: "2026-11-12" })).toBe("2026-11-12");
  });
});
