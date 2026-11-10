// SIS+ (10/11/2026): pilares RT/RH/RA, duas réguas (cliente × Moked), indicadores "a definir" zerados e fora da conta.
import { grupoDaCategoria, categoriasDoTeste, baseSIS, calcularSIS, faixa, REGUAS, INDICADORES, lerFavoritos, gravarFavoritos, FAVORITOS_PADRAO } from "./sis";

const PROJ = { id: "P601", categories: [
  { id: "cftv", label: "06 - CFTV", type: "count", total: 70 },
  { id: "tq", label: "24 - TORNIQUETES", type: "items", itemLabels: ["T1", "T2", "T3", "T4"] },
  { id: "pf", label: "20 - PÂNICO FIXO", type: "items", itemLabels: ["B1", "B2"] },
  { id: "peri", label: "01 - ALARME PERIMETRAL", type: "items", itemLabels: ["Z1", "Z2", "Z3", "Z4", "Z5"] },
  { id: "mon", label: "16 - MONITOR CCO CFTV", type: "single" },
  { id: "net", label: "08 - INTERNET", type: "single" },
  { id: "nb", label: "18 - NOBREAK", type: "single" },
  { id: "vis", label: "28 - VISITA DE MANUTENÇÃO", type: "single" },
] };
const STATE = {
  cftv: { total: 70, inoperative: [{ id: "CF35", note: "sem imagem" }, { id: "CF40" }, { id: "CF41" }, { id: "CF42" }, { id: "CF43" }, { id: "CF44" }, { id: "CF45" }], gravacao: { pct: 10 } },
  tq: [{ status: "ok" }, { status: "partial" }, { status: "partial" }, { status: "inop" }],
  pf: [{ status: "ok" }, { status: "ok" }],
  peri: [{ status: "ok" }, { status: "ok" }, { status: "ok" }, { status: "ok" }, { status: "inop" }],
  mon: { status: "ok" }, net: { status: "ok" }, nb: { status: "ok" }, vis: { status: "inop" },
};

test("rótulo do checklist → indicador técnico; visita/obs fica fora", () => {
  expect(["06 - CFTV", "05 - CÂMERAS SISTEMA SALA", "16 - MONITOR CCO CFTV", "24 - TORNIQUETES", "13 - QR ECLUSAS", "20 - PÂNICO FIXO", "01 - ALARME CERCA ELÉTRICA", "18 - SDAI (INCÊNDIO)", "18 - NOBREAK CCO", "08 - INTERNET", "28 - VISITA DE MANUTENÇÃO", "29 - INFRAESTRUTURA / OBS.", "03 - AR-CONDICIONADO"].map((label) => grupoDaCategoria({ label })))
    .toEqual(["cftv", "cftv", "cco", "acesso", "acesso", "panico", "perimetro", "incendio", "energia", "comunicacao", "ignorar", "ignorar", "infra"]);
  const c = categoriasDoTeste(PROJ, STATE);
  expect(c.cftv).toMatchObject({ total: 70, inop: 7, partial: 0 });
  expect(c.acesso).toMatchObject({ total: 4, inop: 1, partial: 2 });
  expect(c.ignorar).toBeUndefined();
});

const base = (extra = {}) => ({
  pid: "P601",
  teste: { pct: 90, data: "2026-11-08", diasAtras: 2, atrasado: false, gravacao: { total: 70, pct: 10, cameras: 7, obs: "", nivel: "atencao" } },
  equipe: { ativos: 24, turnover: 8, saidas12m: 2, entradas12m: 3, treinadosPct: 90, comReciclagem: 21, comTreinoFicha: 20 },
  sistemas: { perimetralZonasRuins: 1, energiaAberta: false, quedas7d: 0, ilumTotal: 0, ilumDef: 0, temCtmk: true, temKey: true, ctmkOff: false, keyAbertas: 1 },
  sisBase: baseSIS({ project: PROJ, state: STATE, hojeISO: "2026-11-10", agoraMs: Date.parse("2026-11-10T12:00:00Z"),
    equipeDoc: { colaboradores: [{ id: "a", rotaKm: 8 }, { id: "b", rotaKm: 12 }, { id: "c", rotaKm: 30 }, { id: "d" }] },
    mapas: ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10"].map((d) => ({ data: d, turno: "D", status: "enviado" })),
    followups: { "06cftv__cf35": { key: "06cftv__cf35", entries: [{ em: "2026-11-09T10:00:00Z" }] }, "24torniquetes__t4": { key: "24torniquetes__t4", entries: [{ em: "2026-10-01T10:00:00Z" }] } },
    maturidade: { indice: 78.4, classe: "Consolidado", eixos: { assiduidade: 94 } } }),
  ...extra,
});

test("cliente × Moked: parcial 0,5 × 0, faixas 85/70 × 92/80, indicadores a definir zerados e fora da conta", () => {
  const cli = calcularSIS(base(), "cliente"), mok = calcularSIS(base(), "moked");
  const it = (s, id) => s.itens.find((i) => i.id === id);
  expect(it(cli, "cftv").valor).toBe(90); expect(it(mok, "cftv").valor).toBe(90);       // 63/70 (contagem não tem parcial)
  expect(it(cli, "acesso").valor).toBe(50); expect(it(mok, "acesso").valor).toBe(25);   // (1 + 2×0,5)/4 × 1/4
  expect(it(cli, "gravacao").valor).toBe(90); expect(it(mok, "gravacao").valor).toBe(80);
  expect(it(cli, "perimetro").valor).toBe(75); expect(it(mok, "perimetro").valor).toBe(70); // 80% − zona ruim (5 × 10)
  expect(it(cli, "turnover").valor).toBe(84); expect(it(mok, "turnover").valor).toBe(76);
  expect(it(cli, "distancia").valor).toBe(67); expect(it(mok, "distancia").valor).toBe(67); // 2 de 3 até 25 km × 2 de 3 até 15 km
  expect(it(cli, "tratativas")).toMatchObject({ valor: 18 }); expect(it(mok, "tratativas").valor).toBe(9); // 11 pendências (visita fica fora): 2 com tratativa, 1 recente
  expect(it(cli, "mapa").valor).toBe(100);
  expect(it(cli, "maturidade").valor).toBe(78); expect(it(cli, "assiduidade").valor).toBe(94);
  for (const id of ["satisfacao", "salario", "beneficios", "documentos"]) expect(it(cli, id)).toMatchObject({ aDefinir: true, valor: null, exibir: 0, faixa: "Sem dado" });
  // a média do RH não muda com os "a definir" (não entram na conta)
  const rh = cli.pilares.RH; expect(rh.contam).toBe(5); expect(rh.itens).toHaveLength(8);
  expect(typeof cli.geral).toBe("number"); expect(mok.geral).toBeLessThan(cli.geral);
  expect(faixa(86, REGUAS.cliente).rotulo).toBe("Bom"); expect(faixa(86, REGUAS.moked).rotulo).toBe("Alerta"); expect(faixa(79, REGUAS.moked).rotulo).toBe("Crítico");
  expect(faixa(null).rotulo).toBe("Sem dado");
});

test("sem dado não vira 100%: projeto sem CTMK, sem endereços, sem teste", () => {
  const p = base({ teste: { pct: null, data: null, diasAtras: null, atrasado: true, gravacao: null }, sistemas: {}, sisBase: baseSIS({ project: { categories: [] }, state: null, hojeISO: "2026-11-10" }) });
  const s = calcularSIS(p, "cliente"); const it = (id) => s.itens.find((i) => i.id === id);
  expect(it("ctmk").valor).toBeNull(); expect(it("distancia").valor).toBeNull(); expect(it("cftv").valor).toBeNull(); expect(it("mapa").valor).toBeNull();
  expect(it("teste").valor).toBe(0);
  expect(s.pilares.RT.valor).toBeNull();
  expect(s.geral).not.toBeNull(); // RH e RA ainda contam
  expect(INDICADORES.every((i) => ["RT", "RH", "RA"].includes(i.pilar))).toBe(true);
});

test("favoritos por PIN no aparelho; sem storage cai no padrão", () => {
  window.localStorage.clear();
  expect(lerFavoritos("GOLGI")).toEqual(FAVORITOS_PADRAO);
  gravarFavoritos("GOLGI", ["turnover", "inexistente"]);
  expect(lerFavoritos("GOLGI")).toEqual(["turnover"]);
  expect(lerFavoritos("P505")).toEqual(FAVORITOS_PADRAO);
});
