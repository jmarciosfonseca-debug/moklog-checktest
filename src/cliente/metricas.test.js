import { testeSemanal, equipeResumo, mapaResumo, equipamentosResumo, consolidarGrupo, corDe } from "./metricas";

const proj = { id: "P601", categories: [{ id: "c1", type: "items", itemLabels: ["A", "B"] }] };
const health = (p, state) => { const arr = state.c1 || []; const inop = arr.filter((x) => x.status === "inop").length; const partial = arr.filter((x) => x.status === "partial").length; return { total: arr.length, ok: arr.length - inop - partial, partial, inop, pct: Math.round(((arr.length - inop - partial * 0.5) / arr.length) * 100) }; };

test("teste semanal: último relatório, atraso > 8 dias e série", () => {
  const hist = [{ meta: { date: "2026-10-04" }, state: { c1: [{ status: "ok" }, { status: "ok" }] } }, { meta: { date: "2026-10-11" }, state: { c1: [{ status: "ok" }, { status: "inop" }] } }];
  const t = testeSemanal(hist, health, proj, "2026-10-13");
  expect(t).toMatchObject({ pct: 50, inop: 1, data: "2026-10-11", diasAtras: 2, atrasado: false });
  expect(t.serie.map((s) => s.pct)).toEqual([100, 50]);
  expect(testeSemanal(hist, health, proj, "2026-10-25").atrasado).toBe(true);
  expect(testeSemanal([], health, proj, "2026-10-25")).toMatchObject({ pct: null, atrasado: true });
});
test("equipe: ativos, turnover 12 m (fórmula da maturidade), treinados e últimos treinamentos", () => {
  const eq = { colaboradores: [
    { id: "a", nome: "Ana", cargo: "Vigilante", status: "ativo", dataContratacao: "2024-01-10", historico: [{ tipo: "Treinamento", data: "2026-09-24", detalhe: "Brigada" }, { tipo: "Falta", data: "2026-10-01" }] },
    { id: "b", nome: "Bia", cargo: "Vigilante", status: "ativo", dataContratacao: "2025-06-01", historico: [] },
    { id: "c", nome: "Caio", cargo: "Líder", status: "ativo", dataContratacao: "2023-01-01", historico: [{ tipo: "Treinamento", data: "2026-10-11", detalhe: "DDS" }] },
  ], desligados: [{ id: "z", nome: "Zé", desligadoEm: "2026-05-05", dataContratacao: "2024-01-01" }] };
  const r = equipeResumo(eq, "2026-10-20");
  expect(r.ativos).toBe(3); expect(r.porCargo).toEqual({ Vigilante: 2, "Líder": 1 });
  expect(r.turnover).toBe(28.6); expect(r.saidas12m).toBe(1); expect(r.entradas12m).toBe(0);
  expect(r.treinadosPct).toBe(67);
  expect(r.ultimosTreinos.map((t) => t.detalhe)).toEqual(["DDS", "Brigada"]);
  expect(r.tempoMedioMeses).toBeGreaterThan(20);
});
test("mapa: último enviado, presença por posto, hoje ou não", () => {
  const mapas = [
    { data: "2026-10-20", turno: "D", status: "rascunho", postos: [] },
    { data: "2026-10-19", turno: "N", status: "enviado", postos: [{ rotulo: "P1", pessoaId: "a", pessoaNome: "Ana", situacao: "presente" }, { rotulo: "P2", pessoaId: "b", pessoaNome: "Bia", situacao: "falta" }, { rotulo: "P3", pessoaId: "c", pessoaNome: "Caio", situacao: "ft" }, { rotulo: "P4", situacao: "vago" }] },
    { data: "2026-10-19", turno: "D", status: "enviado", postos: [] },
  ];
  const m = mapaResumo(mapas, "2026-10-20");
  expect(m).toMatchObject({ temMapa: true, data: "2026-10-19", turno: "N", hoje: false, postos: 4, presentes: 2, faltas: 1, ft: 1, vagos: 1 });
  expect(mapaResumo([], "2026-10-20").temMapa).toBe(false);
});
test("equipamentos e consolidado do grupo", () => {
  expect(equipamentosResumo({ smartphones: [{ status: "ok" }, { status: "inop" }], moto: { status: "parcial" } })).toMatchObject({ total: 3, inop: 1, parcial: 1, ok: 1, pct: 50 });
  const g = consolidarGrupo({ P601: { teste: { pct: 90, atrasado: false }, equipe: { ativos: 10, turnover: 10, treinadosPct: 50 }, equip: { pct: 100, inop: 0 }, mapa: { hoje: true, faltas: 1 } }, P602: { teste: { pct: 70, atrasado: true }, equipe: { ativos: 5, turnover: null }, equip: { pct: 80, inop: 2 }, mapa: { hoje: false, faltas: 3 } } });
  expect(g).toMatchObject({ projetos: 2, testePct: 80, testesAtrasados: 1, equipeAtivos: 15, turnover: 10, equipPct: 90, equipInop: 2, faltasHoje: 1, mapasHoje: 1 });
  expect(corDe(95)).toBe("#22c55e"); expect(corDe(75)).toBe("#f59e0b"); expect(corDe(10)).toBe("#ef4444"); expect(corDe(null)).toBe("#64748b");
});

test("sistemas (insumos da Visão 360) e luzes de aviso", () => {
  const { sistemasResumo, luzes } = require("./metricas");
  const agora = Date.parse("2026-10-20T12:00:00Z");
  const s = sistemasResumo({ ctmk: { status: "offline", offlineSince: "2026-10-17T12:00:00Z" }, keyaccess: { registros: [{ horaFim: null }, { horaFim: "10:00" }] }, iluminacao: { quadrantes: [{ total: 10, deficientes: 2 }] }, energia: { eventos: [{ inicioQueda: "2026-10-18T01:00:00Z", concluido: false }, { inicioQueda: "2026-09-01T01:00:00Z", concluido: true }] }, perimetralZonasRuins: 1, score360: { score: 81.4, vulnerabilidades: ["CTMK off-line"] } }, agora);
  expect(s).toMatchObject({ ctmkOff: true, ctmkDias: 3, keyAbertas: 1, ilumPct: 80, quedas7d: 1, energiaAberta: true, perimetralZonasRuins: 1, score360: 81 });
  const l = luzes({ teste: { atrasado: true, inop: 0 }, mapa: { hoje: true, faltas: 1 }, equip: { inop: 0 }, sistemas: s });
  expect(l.filter((x) => x.on).map((x) => x.id)).toEqual(["teste", "falta", "ctmk", "energia", "key"]);
});

// Marcio, 26/10/2026: "treinado" conta treinamento aplicado na ficha OU reciclagem em dia; contagens separadas.
test("equipe: reciclagem em dia conta como treinado; contagens de ficha e reciclagem", () => {
  const hoje = "2026-10-26";
  const eq = { colaboradores: [
    { id: "a", nome: "A", status: "ativo", historico: [{ tipo: "Treinamento", data: "2026-05-01", detalhe: "NR-35 altura" }] },
    { id: "b", nome: "B", status: "ativo", ultimaReciclagem: "2025-12-01" },
    { id: "c", nome: "C", status: "ativo", ultimaReciclagem: "2023-01-01" },
    { id: "d", nome: "D", status: "ativo" },
  ] };
  const r = equipeResumo(eq, hoje, []);
  expect(r.comTreinoFicha).toBe(1); expect(r.comReciclagem).toBe(1); expect(r.treinadosPct).toBe(50);
});
