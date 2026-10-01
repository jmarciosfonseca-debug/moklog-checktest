const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("./fvCore");
const expect = (v) => ({ toBe:(x)=>assert.strictEqual(v,x), toEqual:(x)=>assert.deepStrictEqual(v,x) });

const mapa = { "GOLGI CAJAMAR":"P601", "GOLGI JUNDIAI":"P604", "MEGA CURITIBA":"P311A" };
const bruto = { projetos: {
  "GOLGI CAJAMAR": { saldo:"R$ 1.000,00", lancamentos:[
    { data:"25/09/2026", tipo:"Aporte", valor:"R$ 12.000,00", posto:"Portaria 1", descricao:"Aporte mensal" },
    { data:"05/09/2026", tipo:"VT", valor:"-4.210,00", posto:"Portaria 1" },
    { data:"05/08/2026", tipo:"credito", valor:"500" },
  ]},
  "GOLGI JUNDIAI": { saldo:"(2.340,50)", lancamentos:[] },
  "MEGA CURITIBA": { saldo:"10", lancamentos:[] },
  "DESCONHECIDO": { saldo:"1", lancamentos:[] },
}};

describe("fvCore", () => {
  test("parseValor BRL, negativos e inválidos", () => {
    expect(core.parseValor("R$ 1.234,56")).toBe(1234.56);
    expect(core.parseValor("(2.340,50)")).toBe(-2340.5);
    expect(core.parseValor("-10")).toBe(-10);
    expect(core.parseValor("1234.5")).toBe(1234.5);
    expect(core.parseValor("")).toBe(null);
    expect(core.parseValor("abc")).toBe(null);
  });
  test("parseData", () => {
    expect(core.parseData("25/09/2026")).toBe("2026-09-25");
    expect(core.parseData("2026-09-25T10:00")).toBe("2026-09-25");
    expect(core.parseData("x")).toBe(null);
  });
  test("normalizar: escopo, mapeamento e resumo", () => {
    const r = core.normalizar(bruto, mapa, "2026-09-30T12:00:00.000Z");
    expect(Object.keys(r.docs).sort()).toEqual(["P601","P604"]);
    expect(r.erros).toEqual([]);
    expect(r.avisos.some(a => a.includes("P311A fora do escopo"))).toBe(true);
    expect(r.avisos.some(a => a.includes("DESCONHECIDO"))).toBe(true);
    const p601 = r.docs.P601.resumo;
    expect(p601.saldoAtual).toBe(1000);
    expect(p601.positivo).toBe(true);
    expect(p601.ultimoCredito).toEqual({ data:"2026-09-25", valor:12000, tipo:"aporte" });
    expect(p601.totaisMes).toEqual({ credito:0, aporte:12000, debito:0, vt:4210, am:0 });
    expect(r.docs.P604.resumo.positivo).toBe(false);
    expect(r.docs.P604.resumo.saldoAtual).toBe(-2340.5);
  });
  test("hash estável: mesma entrada gera mesmo id (idempotência)", () => {
    const a = core.normalizar(bruto, mapa, "2026-09-30T12:00:00.000Z");
    const b = core.normalizar(bruto, mapa, "2026-10-01T08:00:00.000Z");
    expect(a.docs.P601.lancamentos.map(l=>l.id)).toEqual(b.docs.P601.lancamentos.map(l=>l.id));
  });
  test("lançamento inválido bloqueia gravação", () => {
    const ruim = { projetos: { "GOLGI CAJAMAR": { saldo:"10", lancamentos:[{ data:"??", tipo:"vt", valor:"1" }] } } };
    const r = core.normalizar(ruim, mapa);
    expect(core.podeGravar(r)).toBe(false);
  });
  test("saldo ilegível bloqueia; vazio bloqueia", () => {
    expect(core.podeGravar(core.normalizar({ projetos:{ "GOLGI CAJAMAR":{ saldo:"--" } } }, mapa))).toBe(false);
    expect(core.podeGravar(core.normalizar({ projetos:{} }, mapa))).toBe(false);
  });
});

describe("portal mokedsystem", () => {
  // Recorte fiel ao layout do posto 105 (P260B), com rodapé coerente.
  const linhas = [
    ["Data","Descrição","Crédito","Débito","Status","Empresa"],
    ["01/06/2026","Credito Junho","R$ 1.860,75","-","-","Grupo GR"],
    ["03/06/2026","GALOCHA","-","R$ -165,87","-","Grupo GR"],
    ["02/07/2026","convenio medico","-","R$ -1.506,88","Aprovado","Grupo GR"],
    ["02/07/2026","Credito Julho","R$ 1.860,75","-","-","Grupo GR"],
    ["31/08/2026","vale trasporte","-","R$ -1.005,28","Aprovado","Grupo GR"],
    ["12/05/2026","SALDO MÊS","R$ 4.216,00","-","-","GSS SEGURANÇA"],
    ["12/05/2026","SALDO MÊS","R$ 4.216,00","-","-","GSS SEGURANÇA"],
    ["","Total:","R$ 12.153,50","R$ -2.678,03","Saldo atual:","R$ 9.475,47"],
  ];
  test("lê linhas, classifica e captura o rodapé", () => {
    const t = core.parseTabelaPortal(linhas);
    expect(t.lancamentos.length).toBe(7);
    expect(t.saldo).toBe(9475.47);
    expect(t.totalCred).toBe(12153.5);
    expect(t.lancamentos.map(l => l.tipo)).toEqual(["credito","debito","am","credito","vt","credito","credito"]);
    expect(t.lancamentos[2].status).toBe("aprovado");
  });
  test("linhas idênticas viram lançamentos distintos e a soma confere", () => {
    const t = core.parseTabelaPortal(linhas);
    const r = core.normalizar({ projetos: { "36": t } }, { "36":"P601" }, "2026-09-30T12:00:00.000Z");
    expect(r.erros).toEqual([]);
    const ids = r.docs.P601.lancamentos.map(l => l.id);
    expect(new Set(ids).size).toBe(7);
    expect(r.docs.P601.resumo.saldoAtual).toBe(9475.47);
  });
  test("soma divergente do saldo bloqueia a gravação", () => {
    const t = core.parseTabelaPortal(linhas.slice(0, 3).concat([["","Total:","R$ 1,00","R$ -1,00","Saldo atual:","R$ 999,00"]]));
    const r = core.normalizar({ projetos: { "36": t } }, { "36":"P601" });
    expect(core.podeGravar(r)).toBe(false);
  });
  test("classificação de descrições reais", () => {
    expect(core.classificar("VT - COMBUSTIVEL FEV", false)).toBe("vt");
    expect(core.classificar("A.M 04.26", false)).toBe("am");
    expect(core.classificar("JUN/26 - ASS MÉDICA", false)).toBe("am");
    expect(core.classificar("Uniforme", false)).toBe("debito");
    expect(core.classificar("FV MAIO", true)).toBe("credito");
  });
});
