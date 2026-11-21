import { abaDoAviso, donoDoAviso, agrupar, noticiaExterna, noticiaDoSistema, destaquesPorProjeto, montarCentral, ABAS } from "./contrato";

const A = (o) => ({ id: `${o.tipo}:${o.projetoId || "P601"}:${Math.random()}`, sev: "atencao", projetoId: "P601", titulo: "x", detalhe: "", desde: null, gerencial: false, ...o });
const D = (s) => new Date(s);

describe("contrato dos avisos", () => {
  test("cada tipo vai para a aba certa e nada some", () => {
    expect(abaDoAviso(A({ tipo: "inop" }))).toBe("equipamentos");
    expect(abaDoAviso(A({ tipo: "energia" }))).toBe("equipamentos");
    expect(abaDoAviso(A({ tipo: "manutencao" }))).toBe("cliente");        // com a empresa de manutenção
    expect(abaDoAviso(A({ tipo: "inop", dono: "cliente" }))).toBe("cliente");
    expect(abaDoAviso(A({ tipo: "falta", gerencial: true }))).toBe("equipe");
    expect(abaDoAviso(A({ tipo: "teste" }))).toBe("noticias");
    expect(abaDoAviso(A({ tipo: "tipo-novo-qualquer" }))).toBe("equipamentos");
  });
  test("dono: o informado vale; inválido cai no padrão por tipo", () => {
    expect(donoDoAviso(A({ tipo: "inop" }))).toBe("moked");
    expect(donoDoAviso(A({ tipo: "manutencao" }))).toBe("manutencao");
    expect(donoDoAviso(A({ tipo: "inop", dono: "administracao" }))).toBe("administracao");
    expect(donoDoAviso(A({ tipo: "inop", dono: "marciano" }))).toBe("moked");
  });
  test("agrupa por projeto e sistema, com o mais grave e o mais antigo", () => {
    const g = agrupar([
      A({ tipo: "inop", sev: "atencao", desde: D("2026-11-10") }),
      A({ tipo: "inop", sev: "critico", desde: D("2026-11-01") }),
      A({ tipo: "inop", projetoId: "P604", sev: "info" }),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ projetoId: "P601", qtd: 2, sev: "critico" });
    expect(g[0].desde.toISOString().slice(0, 10)).toBe("2026-11-01");
  });
  test("notícia externa: segurança perto = crítico, longe = atenção, mercado = info; sem título é descartada", () => {
    const base = { id: "a", titulo: "Roubo de carga", resumo: "r", fonte: "G1", data: "2026-11-20T10:00:00Z" };
    expect(noticiaExterna({ ...base, tema: "seguranca", proximidade: "cidade" }, "P601").sev).toBe("critico");
    expect(noticiaExterna({ ...base, tema: "seguranca", proximidade: "regiao" }, "P601").sev).toBe("atencao");
    expect(noticiaExterna({ ...base, tema: "mercado", proximidade: "cidade" }, "P601").sev).toBe("info");
    expect(noticiaExterna({ id: "x" }, "P601")).toBeNull();
    expect(noticiaExterna({ ...base, tema: "mercado", link: "https://a" }, "P601").links).toEqual(["https://a"]);
    expect(noticiaExterna({ ...base, tema: "mercado", data: "lixo" }, "P601").data).toBeNull();
  });
  test("notícia do sistema exige id e título", () => {
    expect(noticiaDoSistema({ titulo: "x" })).toBeNull();
    expect(noticiaDoSistema({ id: "1", titulo: "Teste semanal enviado", projetoId: "P601" })).toMatchObject({ origem: "sistema", tema: "sistema", sev: "info" });
  });
  test("destaques: no máximo N por projeto, mais forte e recente primeiro", () => {
    const n = (id, p, sev, d) => noticiaDoSistema({ id, projetoId: p, titulo: id, sev, data: d });
    const d = destaquesPorProjeto([n("a", "P1", "info", "2026-11-01"), n("b", "P1", "critico", "2026-10-01"), n("c", "P1", "critico", "2026-11-05"), n("d", "P2", "info", "2026-11-02")], 2);
    expect(d.map((x) => x.id)).toEqual(["sis:c", "sis:b", "sis:d"]);
  });
  test("central: gerencial vê Equipe; os demais não, e o dado de pessoa nem entra na conta", () => {
    const avisos = [A({ tipo: "inop", sev: "critico" }), A({ tipo: "falta", gerencial: true, sev: "critico" }), A({ tipo: "manutencao" }), A({ tipo: "teste", sev: "info" })];
    const g = montarCentral({ avisos, gerencial: true });
    const o = montarCentral({ avisos, gerencial: false });
    expect(g.abas.map((a) => a.id)).toEqual(ABAS.map((a) => a.id));
    expect(o.abas.map((a) => a.id)).toEqual(["equipamentos", "cliente", "noticias"]);
    expect(g.total).toBe(4);
    expect(o.total).toBe(3);
    expect(o.abas.find((a) => a.id === "equipe")).toBeUndefined();
    expect(g.abas.find((a) => a.id === "noticias").total).toBe(1);
    expect(g.abas.find((a) => a.id === "cliente").grupos[0].tipo).toBe("manutencao");
  });
  test("central junta notícias de fora e do sistema, sem perder nenhuma", () => {
    const ext = noticiaExterna({ id: "e1", titulo: "Furto na região", tema: "seguranca", proximidade: "cidade", data: "2026-11-20T10:00:00Z" }, "P601");
    const c = montarCentral({ avisos: [A({ tipo: "teste", sev: "info" })], noticias: [ext], gerencial: false });
    const n = c.abas.find((a) => a.id === "noticias");
    expect(n.total).toBe(2);
    expect(n.criticos).toBe(1);
    expect(n.noticias[0].origem).toBe("externa");
  });
  test("entradas vazias ou inválidas não quebram", () => {
    expect(montarCentral().total).toBe(0);
    expect(montarCentral({ avisos: null, noticias: [null, undefined] }).total).toBe(0);
  });
});
