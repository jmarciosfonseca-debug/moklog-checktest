import { zonasRuinsProjeto, zonasRuinsDeRondas } from "./v360Perimetral";
test("Golgi lê último plantão com perimetral feito", () => {
  const idx = { deletedIds:["c"], plantoes:[
    { id:"a", perimetralResumo:{ feito:true, data:"2026-10-01", zonas:[{status:"ok"},{status:"falha"}] } },
    { id:"b", perimetralResumo:{ feito:true, data:"2026-10-05", zonas:[{status:"ok"},{status:"ok"}] } },
    { id:"c", perimetralResumo:{ feito:true, data:"2026-10-08", zonas:[{status:"falha"}] } },
    { id:"d", temPerimetral:false },
  ]};
  expect(zonasRuinsDeRondas(idx)).toBe(0);
  idx.plantoes[1].perimetralResumo.zonas[0].status="falha";
  expect(zonasRuinsProjeto("P602", null, idx)).toBe(1);
});
test("Mega/Klog seguem perimetral/{pid}", () => {
  const d = { testes:[{data:"2026-09-01",zonas:{z1:{status:"falha"}}},{data:"2026-10-01",zonas:{z1:{status:"ok"},z2:{status:"falha"}}}] };
  expect(zonasRuinsProjeto("P505", d, null)).toBe(1);
  expect(zonasRuinsProjeto("P601", d, null)).toBe(0);
});
