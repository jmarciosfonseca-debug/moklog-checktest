import { resumoDoRegistro, testesDoHistorico, compararTestes } from "./testeSemanal";

const resolveStatus = (o) => (!o || typeof o !== "object" ? "ok" : ["ok", "partial", "inop"].includes(o.status) ? o.status : o.ok === false ? "inop" : "ok");
const computeHealth = (project, state) => {
  let total = 0, okN = 0, partial = 0, inop = 0;
  for (const cat of project.categories) {
    const s = state[cat.id]; if (!s) continue;
    if (cat.type === "single") { total++; const r = resolveStatus(s); if (r === "ok") okN++; else if (r === "partial") partial++; else inop++; }
    else if (cat.type === "items") s.forEach((v) => { total++; const r = resolveStatus(v); if (r === "ok") okN++; else if (r === "partial") partial++; else inop++; });
    else { total += s.total; okN += s.total - s.inoperative.length; inop += s.inoperative.length; }
  }
  return { total, ok: okN, partial, inop, pct: total ? Math.round((okN / total) * 100) : 100 };
};
const deps = { resolveStatus, computeHealth };
const P = { id: "P601", categories: [
  { id: "cftv", type: "count", label: "Câmeras", total: 10 },
  { id: "port", type: "single", label: "Portão" },
  { id: "rad", type: "items", label: "Rádios", itemLabels: ["HT 1", "HT 2"] },
] };
const reg = (date, cftvInop = [], portao = "ok", r1 = "ok", r2 = "ok") => ({ meta: { date }, state: { cftv: { total: 10, inoperative: cftvInop.map((id) => ({ id })) }, port: { status: portao }, rad: [{ status: r1 }, { status: r2 }] } });

test("resumo do registro: percentual, contagens e itens fora do normal com rótulo legível", () => {
  const r = resumoDoRegistro(P, reg("2026-10-11", ["Cam 3"], "inop", "partial"), deps);
  expect(r).toMatchObject({ data: "2026-10-11", total: 13, inop: 2, parcial: 1, pct: 77 });
  expect(Object.values(r.itens).map((i) => i.rotulo).sort()).toEqual(["Câmeras — Cam 3", "Portão", "Rádios — HT 1"]);
  expect(resumoDoRegistro(P, { meta: {}, state: {} }, deps)).toBeNull();
});

test("histórico: último e o da semana anterior (data menor), mesmo fora de ordem; sem relatório = fora", () => {
  const stored = { P601: { history: [reg("2026-10-11", ["Cam 3"]), reg("2026-10-04", ["Cam 3", "Cam 4"]), reg("2026-10-11", ["Cam 3"])] }, P602: { history: [] } };
  const t = testesDoHistorico({ P601: P, P602: { id: "P602", categories: [] } }, stored, deps);
  expect(Object.keys(t)).toEqual(["P601"]);
  expect(t.P601.ultima.data).toBe("2026-10-11");
  expect(t.P601.anterior.data).toBe("2026-10-04");
  const unico = testesDoHistorico({ P601: P }, { P601: { history: [reg("2026-10-11")] } }, deps);
  expect(unico.P601.anterior).toBeNull();
});

test("comparação: novos, resolvidos, persistem e variação", () => {
  const ant = resumoDoRegistro(P, reg("2026-10-04", ["Cam 3", "Cam 4"], "inop"), deps);
  const ult = resumoDoRegistro(P, reg("2026-10-11", ["Cam 3"], "ok", "inop"), deps);
  const c = compararTestes(ult, ant);
  expect(c.novos).toEqual(["Rádios — HT 1"]);
  expect(c.resolvidos.sort()).toEqual(["Câmeras — Cam 4", "Portão"]);
  expect(c.persistem).toBe(1);
  expect(typeof c.deltaPct).toBe("number");
  expect(compararTestes(ult, null)).toBeNull();
});
