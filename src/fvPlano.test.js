import { serieMensal, saldoHistorico, mediaMensal, parametros, projecao, totalReservas, efeito, valorLanc, somaMes, rotuloMes, somaAportes12, resumoPeriodo, categoriaDebito, totalRecorrentes } from "./fvPlano";

const REF = new Date(2026, 8, 30); // 30/09/2026
const lancs = [
  { data:"2026-06-10", tipo:"aporte", valor:9000 }, { data:"2026-07-10", tipo:"aporte", valor:8000 },
  { data:"2026-08-10", tipo:"aporte", valor:7000 }, { data:"2026-09-10", tipo:"aporte", valor:8000 },
  { data:"2026-07-05", tipo:"vt", valor:4200 }, { data:"2026-08-05", tipo:"vt", valor:4200 }, { data:"2026-09-05", tipo:"vt", valor:4200 },
  { data:"2026-07-05", tipo:"am", valor:1800 }, { data:"2026-08-05", tipo:"am", valor:1800 },
  { data:"2026-08-20", tipo:"debito", valor:900, descricao:"Uniforme" },
  { data:"2026-05-20", tipo:"debito", valor:300, descricao:"GALOCHA" },
  { data:"2026-04-20", tipo:"debito", valor:2483.3, descricao:"Ovos de pascoa" },
];
const catalogo = [{ id:"it1", nome:"Camisa", valor:150 }, { id:"it2", nome:"Kit uniforme", valor:600 }];

describe("fvPlano v2", () => {
  test("datas de mês", () => {
    expect(somaMes("2026-12", 1)).toBe("2027-01");
    expect(somaMes("2026-01", -1)).toBe("2025-12");
    expect(rotuloMes("2026-10")).toBe("out/26");
  });
  test("série mensal e saldo reconstruído", () => {
    const s = serieMensal(lancs, 12, REF);
    expect(s[11]).toEqual({ mes:"2026-09", creditos:8000, debitos:4200 });
    expect(s[10]).toEqual({ mes:"2026-08", creditos:7000, debitos:6900 });
    expect(saldoHistorico(35000, s)[10].saldo).toBe(31200);
    expect(saldoHistorico(undefined, s).every(x => x.saldo === null)).toBe(true);
  });
  test("média dos 3 meses completos", () => {
    expect(mediaMensal(lancs, ["aporte","credito"], 3, REF)).toBe(8000);
    expect(mediaMensal(lancs, ["vt"], 3, REF)).toBe(2800);
  });
  test("categoria de débito e resumo do período", () => {
    expect(categoriaDebito({ tipo:"debito", descricao:"GALOCHA" })).toBe("uniforme");
    expect(categoriaDebito({ tipo:"debito", descricao:"Ovos de pascoa" })).toBe("outros");
    expect(categoriaDebito({ tipo:"vt" })).toBe("vt");
    expect(categoriaDebito({ tipo:"aporte" })).toBe(null);
    const r = resumoPeriodo(lancs, 12, REF);
    expect(r.creditos).toBe(32000);
    expect(r.porCategoria).toEqual({ vt:12600, am:3600, uniforme:1200, outros:2483.3 });
    expect(r.maiores[0].descricao).toBe("Ovos de pascoa");
    expect(r.resultado).toBe(32000 - 19883.3);
  });
  test("parâmetros: oficial > média, manual > oficial, recorrentes nos fixos", () => {
    const plano = { recorrentes:[{ id:"r1", descricao:"Café", valor:250, ativo:true }, { id:"r2", descricao:"Água", valor:100, ativo:false }] };
    expect(totalRecorrentes(plano)).toBe(250);
    const p = parametros(plano, lancs, REF, 6510.56);
    expect(p.creditoMensal).toBe(6510.56);
    expect(p.creditoOficial).toBe(true);
    expect(p.recorrentes).toBe(250);
    expect(p.fixos).toBe(2800 + 1200 + 250);
    expect(parametros({ creditoMensal:7000 }, lancs, REF, 6510.56).creditoMensal).toBe(7000);
    expect(parametros({ creditoMensal:null }, lancs, REF, null).creditoMensal).toBe(8000);
  });
  test("valor por catálogo, cesta e direto", () => {
    const ctx = { qtdCestas:14, catalogo };
    expect(valorLanc({ vinculo:"catalogo", itemId:"it2", qtd:10 }, ctx)).toBe(6000);
    expect(valorLanc({ vinculo:"catalogo", itemId:"inexistente", qtd:10 }, ctx)).toBe(0);
    expect(valorLanc({ vinculo:"cestaNatal", valorMedio:150 }, ctx)).toBe(2100);
    expect(valorLanc({ valor:3000 }, ctx)).toBe(3000);
    expect(efeito({ tipo:"outros", sinal:"+", valor:100 })).toBe(100);
    expect(efeito({ tipo:"reserva", vinculo:"cestaNatal", valorMedio:150 }, ctx)).toBe(-2100);
    expect(totalReservas({ lancamentos:[{ tipo:"reserva", vinculo:"cestaNatal", valorMedio:150 }, { tipo:"reserva", valor:500, realizado:true }] }, ctx)).toBe(2100);
  });
  test("projeção com fixos, recorrentes, catálogo e totais", () => {
    const plano = { creditoMensal:8000, vtMensal:4200, amMensal:1800, recorrentes:[{ id:"r1", descricao:"Café", valor:250 }], lancamentos:[
      { id:"a", tipo:"reserva", descricao:"Ovo de Páscoa", valor:3000, mes:"2027-03" },
      { id:"b", tipo:"debito", descricao:"Kits", vinculo:"catalogo", itemId:"it2", qtd:5, mes:"2026-11" },
      { id:"c", tipo:"aporte", descricao:"Extra", valor:5000, mes:"2026-12", realizado:true },
      { id:"d", tipo:"aporte", descricao:"Extra 2", valor:1000, mes:"2027-01" },
    ]};
    const p = projecao({ saldoAtual:35000, plano, lancamentos:lancs, ctx:{ qtdCestas:0, catalogo }, ref:REF });
    expect(p.margem).toBe(1750);
    expect(p.serie[0]).toEqual({ mes:"2026-10", saldo:36750, margem:1750, extra:0, eventos:[] });
    expect(p.serie[1].extra).toBe(-3000);
    expect(p.serie[1].eventos[0].descricao).toBe("Kits");
    expect(p.saldoFinal).toBe(35000 + 12 * 1750 - 3000 - 3000 + 1000);
    expect(p.totais).toEqual({ creditos:8000 * 12 + 1000, gastosFixos:6250 * 12, previstosSaida:6000, previstosEntrada:1000, gastos:6250 * 12 + 6000, resultado:8000 * 12 + 1000 - 6250 * 12 - 6000 });
    expect(p.primeiroNegativo).toBe(null);
  });
  test("primeiro mês negativo e lançamento atrasado", () => {
    const p = projecao({ saldoAtual:1000, plano:{ creditoMensal:1000, vtMensal:1500, amMensal:0 }, lancamentos:[], ref:REF });
    expect(p.primeiroNegativo).toBe("2026-12"); // out 500 · nov 0 · dez -500
    const q = projecao({ saldoAtual:0, plano:{ creditoMensal:0, vtMensal:0, amMensal:0, lancamentos:[{ id:"z", tipo:"debito", valor:100, mes:"2026-05" }] }, lancamentos:[], ref:REF });
    expect(q.serie[0].extra).toBe(-100);
  });
  test("soma de aportes 12 meses", () => { expect(somaAportes12(lancs, REF)).toBe(32000); });
});
