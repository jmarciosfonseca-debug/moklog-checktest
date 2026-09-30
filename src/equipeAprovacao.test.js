import { statusAprovacao, aplicarAprovacao, solicitacoesPorAprovacao, contadoresAprovacao, cestaDocId, novoFV, parseValorBR, anosFiltro, fmtBRL } from "./equipeAprovacao";

const base = () => ([
  { id:"c1", nome:"Ana", uniforme:{ itens:{}, solicitacoes:[
    { id:"s1", item:"Calça", status:"pendente", solicitadoEm:"2026-09-01T10:00:00.000Z" },
    { id:"s2", item:"Camisa", status:"entregue", solicitadoEm:"2026-08-01T10:00:00.000Z", entregueEm:"2026-08-05T10:00:00.000Z" },
  ]}},
  { id:"c2", nome:"Bruno", uniforme:{ itens:{}, solicitacoes:[
    { id:"s3", item:"Coturno", status:"pendente", solicitadoEm:"2025-12-01T10:00:00.000Z", aprovacao:"negado" },
  ]}},
  { id:"c3", nome:"Caio" },
]);

describe("equipeAprovacao", () => {
  test("ausência de aprovacao = aguardando", () => {
    expect(statusAprovacao({})).toBe("aguardando");
    expect(statusAprovacao({ aprovacao:"xyz" })).toBe("aguardando");
    expect(statusAprovacao({ aprovacao:"aprovado" })).toBe("aprovado");
  });

  test("aplicarAprovacao em lote altera só os alvos e preserva status/SLA", () => {
    const entrada = base();
    const copia = JSON.parse(JSON.stringify(entrada));
    const { colaboradores, alterados } = aplicarAprovacao(entrada, [{colabId:"c1",solicId:"s1"},{colabId:"c1",solicId:"s2"}], "aprovado", "2026-09-30T12:00:00.000Z");
    expect(alterados).toBe(2);
    expect(entrada).toEqual(copia); // não muta a entrada
    const s1 = colaboradores[0].uniforme.solicitacoes[0];
    expect(s1.aprovacao).toBe("aprovado");
    expect(s1.aprovadoPor).toBe("Gerencial");
    expect(s1.precoUnit).toBeNull();
    expect(s1.status).toBe("pendente");
    expect(s1.solicitadoEm).toBe("2026-09-01T10:00:00.000Z");
    expect(s1.aprovacaoHist).toEqual([{ de:"aguardando", para:"aprovado", em:"2026-09-30T12:00:00.000Z", por:"Gerencial" }]);
    expect(colaboradores[0].uniforme.solicitacoes[1].entregueEm).toBe("2026-08-05T10:00:00.000Z");
    expect(colaboradores[1]).toBe(entrada[1]); // intocado (mesma referência)
    expect(colaboradores[2]).toBe(entrada[2]);
  });

  test("histórico acumula aprovar -> negar", () => {
    const r1 = aplicarAprovacao(base(), [{colabId:"c1",solicId:"s1"}], "aprovado", "2026-09-30T12:00:00.000Z");
    const r2 = aplicarAprovacao(r1.colaboradores, [{colabId:"c1",solicId:"s1"}], "negado", "2026-10-01T12:00:00.000Z");
    const s1 = r2.colaboradores[0].uniforme.solicitacoes[0];
    expect(s1.aprovacao).toBe("negado");
    expect(s1.aprovacaoHist.length).toBe(2);
  });

  test("decisão igual não gera alteração", () => {
    const r = aplicarAprovacao(base(), [{colabId:"c2",solicId:"s3"}], "negado");
    expect(r.alterados).toBe(0);
  });

  test("decisão inválida lança erro", () => {
    expect(() => aplicarAprovacao(base(), [], "talvez")).toThrow();
  });

  test("filtro por aprovação e ano", () => {
    const [c1, c2] = base();
    expect(solicitacoesPorAprovacao(c1, "aguardando", 2026).length).toBe(2);
    expect(solicitacoesPorAprovacao(c2, "negado", 2026).length).toBe(0);
    expect(solicitacoesPorAprovacao(c2, "negado", 2025).length).toBe(1);
    expect(contadoresAprovacao(base(), 2026)).toEqual({ aprovado:0, aguardando:2, negado:0 });
  });

  test("cesta, FV e parse de valor", () => {
    expect(cestaDocId(2026, "c1")).toBe("2026_c1");
    const fv1 = novoFV(null, 35000, "2026-09-30T12:00:00.000Z");
    expect(fv1).toEqual({ valor:35000, atualizadoEm:"2026-09-30T12:00:00.000Z", historico:[{ data:"2026-09-30T12:00:00.000Z", anterior:null, novo:35000 }] });
    const fv2 = novoFV(fv1, 49000, "2026-10-30T12:00:00.000Z");
    expect(fv2.historico.length).toBe(2);
    expect(fv2.historico[1].anterior).toBe(35000);
    expect(parseValorBR("35.000,50")).toBe(35000.5);
    expect(parseValorBR("1000")).toBe(1000);
    expect(parseValorBR("abc")).toBeNull();
    expect(anosFiltro(2026)).toEqual([2026, 2025, 2024, 2023]);
  });
});

describe("equipeAprovacao — casos adicionais", () => {
  test("concorrência lógica: aprovação sobre dado relido preserva solicitação nova do líder", () => {
    // Servidor já contém uma solicitação criada pelo líder depois que o gerencial abriu a tela.
    const servidor = base();
    servidor[0].uniforme.solicitacoes.push({ id:"s9", item:"Boné", status:"pendente", solicitadoEm:"2026-09-30T11:00:00.000Z" });
    const { colaboradores } = aplicarAprovacao(servidor, [{colabId:"c1",solicId:"s1"}], "aprovado");
    const ids = colaboradores[0].uniforme.solicitacoes.map(s=>s.id);
    expect(ids).toEqual(["s1","s2","s9"]);
    expect(statusAprovacao(colaboradores[0].uniforme.solicitacoes[2])).toBe("aguardando");
  });

  test("alvo inexistente no servidor não gera alteração", () => {
    const r = aplicarAprovacao(base(), [{colabId:"c1",solicId:"nao-existe"},{colabId:"zz",solicId:"s1"}], "aprovado");
    expect(r.alterados).toBe(0);
  });

  test("solicitação sem aprovacaoHist cria histórico a partir de aguardando", () => {
    const r = aplicarAprovacao(base(), [{colabId:"c2",solicId:"s3"}], "aprovado", "2026-09-30T12:00:00.000Z");
    const s3 = r.colaboradores[1].uniforme.solicitacoes[0];
    expect(s3.aprovacaoHist).toEqual([{ de:"negado", para:"aprovado", em:"2026-09-30T12:00:00.000Z", por:"Gerencial" }]);
  });

  test("status entregue preservado ao aprovar", () => {
    const r = aplicarAprovacao(base(), [{colabId:"c1",solicId:"s2"}], "aprovado");
    const s2 = r.colaboradores[0].uniforme.solicitacoes[1];
    expect(s2.status).toBe("entregue");
    expect(s2.entregueEm).toBe("2026-08-05T10:00:00.000Z");
  });

  test("precoUnit existente é preservado", () => {
    const d = base();
    d[0].uniforme.solicitacoes[0].precoUnit = 120;
    const r = aplicarAprovacao(d, [{colabId:"c1",solicId:"s1"}], "aprovado");
    expect(r.colaboradores[0].uniforme.solicitacoes[0].precoUnit).toBe(120);
  });

  test("filtro ano=null retorna todos os anos", () => {
    const [, c2] = base();
    expect(solicitacoesPorAprovacao(c2, null, null).length).toBe(1);
    expect(contadoresAprovacao(base(), null)).toEqual({ aprovado:0, aguardando:2, negado:1 });
  });

  test("fmtBRL e parseValorBR com entradas vazias", () => {
    expect(fmtBRL(null)).toBe("—");
    expect(fmtBRL(NaN)).toBe("—");
    expect(parseValorBR("")).toBeNull();
    expect(parseValorBR(null)).toBeNull();
  });

  test("cestaDocId com entradas inválidas retorna null", () => {
    expect(cestaDocId(null, "c1")).toBeNull();
    expect(cestaDocId("abc", "c1")).toBeNull();
    expect(cestaDocId(2026.5, "c1")).toBeNull();
    expect(cestaDocId(2026, "")).toBeNull();
    expect(cestaDocId(2026, null)).toBeNull();
    expect(cestaDocId(2026, "a/b")).toBeNull();
    expect(cestaDocId("2026", " c1 ")).toBe("2026_c1");
  });
});
