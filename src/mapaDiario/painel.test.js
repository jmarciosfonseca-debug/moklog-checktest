import { turnoVigente, resumoDoPainel, PROJETOS_DO_MAPA, dataBrasilia } from "./painel";

const em = (s) => new Date(`${s}-03:00`);

test("são 12 projetos no painel", () => {
  expect(PROJETOS_DO_MAPA).toHaveLength(12);
});
test("data de Brasília: 01:00 UTC ainda é o dia anterior", () => {
  expect(dataBrasilia(new Date("2026-10-11T01:00:00Z"))).toBe("2026-10-10");
});
test("turno vigente: manhã = diurno de hoje; noite = noturno de hoje; madrugada = noturno de ontem", () => {
  expect(turnoVigente("P311B", em("2026-10-11T09:00:00"))).toMatchObject({ data: "2026-10-11", turno: "D" });
  expect(turnoVigente("P311B", em("2026-10-11T19:00:00"))).toMatchObject({ data: "2026-10-11", turno: "N" });
  expect(turnoVigente("P311B", em("2026-10-12T03:00:00"))).toMatchObject({ data: "2026-10-11", turno: "N" });
  expect(turnoVigente("P311B", em("2026-10-11T05:59:00"))).toMatchObject({ data: "2026-10-10", turno: "N" });
});
test("P606 (07–19) às 06:30 ainda está no noturno; os demais já estão no diurno", () => {
  const t = em("2026-10-11T06:30:00");
  expect(turnoVigente("P606", t)).toMatchObject({ data: "2026-10-10", turno: "N" });
  expect(turnoVigente("P601", t)).toMatchObject({ data: "2026-10-11", turno: "D" });
});

describe("contador do gerencial", () => {
  const dia = "2026-10-11";
  const env = (pid, turno = "D") => ({ projetoId: pid, data: dia, turno, enviadoEm: `${dia}T06:20:00-03:00` });

  test("às 06:10 sem nenhum envio: 0 de 12 e o painel brilha", () => {
    const r = resumoDoPainel({ agora: em("2026-10-11T06:10:00"), mapas: [] });
    expect(r.total).toBe(12);
    expect(r.enviados).toBe(0);
    expect(r.brilha).toBe(true);
    expect(r.emCobranca.length).toBe(11); // P606 ainda está no noturno de ontem, já passou de 1 h: pendente
    expect(r.pendentes.map((i) => i.projetoId)).toEqual(["P606"]);
  });
  test("vai subindo: 1 de 12, 2 de 12... e às 09:00 faltando um, só ele brilha", () => {
    const todos = PROJETOS_DO_MAPA.filter((p) => p !== "P602");
    const mapas = todos.map((p) => env(p));
    const r = resumoDoPainel({ agora: em("2026-10-11T09:00:00"), mapas });
    expect(r.enviados).toBe(11);
    expect(r.total).toBe(12);
    expect(r.itens.filter((i) => i.brilha).map((i) => i.projetoId)).toEqual(["P602"]);
    expect(r.itens[0].projetoId).toBe("P602"); // quem não mandou vem primeiro
    expect(r.itens[0].estado).toBe("pendente");
  });
  test("12 de 12: nada brilha", () => {
    const r = resumoDoPainel({ agora: em("2026-10-11T09:00:00"), mapas: PROJETOS_DO_MAPA.map((p) => env(p)) });
    expect(r.enviados).toBe(12);
    expect(r.brilha).toBe(false);
  });
  test("mapa de outro turno ou outro dia não conta para o turno vigente", () => {
    const r = resumoDoPainel({ agora: em("2026-10-11T09:00:00"), mapas: [env("P311B", "N"), { ...env("P311A"), data: "2026-10-10" }] });
    expect(r.enviados).toBe(0);
  });
  test("mapa só rascunho (sem enviadoEm) não conta como enviado", () => {
    const r = resumoDoPainel({ agora: em("2026-10-11T09:00:00"), mapas: [{ projetoId: "P311B", data: dia, turno: "D" }] });
    expect(r.enviados).toBe(0);
  });
  test("mapa malformado é ignorado sem derrubar o painel", () => {
    expect(() => resumoDoPainel({ agora: em("2026-10-11T09:00:00"), mapas: [{ projetoId: "", data: "x", turno: "Z" }] })).not.toThrow();
  });
});
