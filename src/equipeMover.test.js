// Mover colaborador entre projetos (12/11/2026): só o consultor; sai da origem como Transferência e entra inteiro no destino.
const { mover } = require("../api/ai/lib/equipeMover");
const { calcularEstabilidade } = require("./equipe/maturidade");

const ana = { id: "c1", nome: "Ana", cargo: "Vigilante", status: "ativo", email: "ana@exemplo.com", dataContratacao: "2024-01-10", fotoRef: "c1-abc", geo: { lat: -23.5, lng: -46.6 }, distanciaKm: 12, rotaKm: 18, rotaMin: 30, rotaVersao: 1, historico: [{ id: "h1", tipo: "Treinamento", fotoRef: "treino-h1-zz" }], endereco: { logradouro: "Rua A", cidade: "São Paulo" } };
const origem = { colaboradores: [ana, { id: "c2", nome: "Beto", status: "ativo" }], desligados: [], fv: { x: 1 } };
const destino = { colaboradores: [{ id: "c9", nome: "Caio", status: "ativo" }], desligados: [{ id: "c1", nome: "Ana", tipoDesligamento: "Transferência" }] };
const args = { colabId: "c1", de: "P311A", para: "P311B", data: "2026-11-12", agora: "2026-11-12T18:00:00.000Z" };

test("sai da origem como Transferência e entra no destino com o cadastro inteiro", () => {
  const r = mover(origem, destino, args);
  expect(r.origem.colaboradores.map((c) => c.id)).toEqual(["c2"]);
  expect(r.origem.fv).toEqual({ x: 1 });
  expect(r.origem.desligados[0]).toMatchObject({ id: "c1", status: "desligado", tipoDesligamento: "Transferência", motivoDesligamento: "Transferido para P311B", desligadoEm: "2026-11-12", transferidoPara: "P311B" });
  const novo = r.destino.colaboradores.find((c) => c.id === "c1");
  expect(novo).toMatchObject({ nome: "Ana", status: "ativo", email: "ana@exemplo.com", dataContratacao: "2024-01-10", fotoRef: "c1-abc", transferidoDe: "P311A", rotaKm: null, rotaMin: null, rotaVersao: null });
  expect(novo.endereco).toEqual(ana.endereco); expect(novo.historico).toEqual(ana.historico);
  expect(novo.desligadoEm).toBeUndefined(); expect(novo.tipoDesligamento).toBeUndefined();
  expect(typeof novo.distanciaKm).toBe("number"); expect(novo.distanciaKm).not.toBe(12); // refeita para o P311B
  expect(novo.trajetoria).toEqual([{ id: "mov_" + Date.parse(args.agora), de: "P311A", para: "P311B", data: "2026-11-12", registradoEm: args.agora, por: "Gerencial" }]);
  expect(r.destino.desligados).toEqual([]); // já tinha passado pelo destino: some do histórico de saídas dele
  expect(r.fotos).toEqual(["c1-abc", "treino-h1-zz"]);
  expect(JSON.stringify(r)).not.toContain("undefined");
});

test("segunda mudança acumula a trajetória; projeto sem coordenada fica sem distância", () => {
  const r1 = mover(origem, { colaboradores: [], desligados: [] }, args);
  const r2 = mover(r1.destino, null, { ...args, de: "P311B", para: "P956", data: "2026-12-01", agora: "2026-12-01T10:00:00.000Z" });
  const c = r2.destino.colaboradores[0];
  expect(c.trajetoria.map((m) => `${m.de}>${m.para}`)).toEqual(["P311A>P311B", "P311B>P956"]);
  expect(c.distanciaKm).toBeNull();
});

test("recusas: mesmo projeto, data inválida, quem não está ativo na origem, quem já está no destino", () => {
  expect(() => mover(origem, destino, { ...args, para: "P311A" })).toThrow(/diferente/);
  expect(() => mover(origem, destino, { ...args, data: "12/11/2026" })).toThrow(/Data/);
  expect(() => mover(origem, destino, { ...args, colabId: "zz" })).toThrow(/não está mais ativo/);
  expect(() => mover(origem, { colaboradores: [{ id: "c1" }] }, args)).toThrow(/já consta/);
});

test("transferência não conta como desligamento no turnover", () => {
  const ativos = ["a", "b", "c", "d"].map((id) => ({ id, status: "ativo", dataContratacao: "2020-01-01" }));
  const base = { colaboradores: ativos, desligados: [{ id: "x", desligadoEm: "2026-10-01", tipoDesligamento: "Transferência" }] };
  expect(calcularEstabilidade(base, "2026-11-12").desligados12m).toBe(0);
  expect(calcularEstabilidade({ ...base, desligados: [{ id: "x", desligadoEm: "2026-10-01", tipoDesligamento: "Demissão" }] }, "2026-11-12").desligados12m).toBe(1);
});

describe("endpoint", () => {
  const montar = (nivel, extra = {}) => {
    jest.resetModules();
    const moverNoBanco = jest.fn(async () => ({ colaboradores: [], desligados: [] }));
    jest.doMock("../api/ai/lib/equipeMover", () => ({ moverNoBanco }));
    jest.doMock("../api/ai/lib/firebaseAdmin", () => ({ getDb: () => ({}) }));
    jest.doMock("../api/ai/lib/accessAuth", () => ({ verify: () => ({ nivel, ...extra }), PROJECTS: ["P311A", "P311B", "P939", "P956"] }));
    const h = require("../api/equipe-save");
    const res = { setHeader() {}, status(c) { this.c = c; return this; }, json(j) { this.j = j; return this; } };
    return { h, res, moverNoBanco };
  };
  const req = (body) => ({ method: "POST", headers: { authorization: "Bearer t" }, body });
  const pedido = { acao: "mover", pid: "P311A", para: "P311B", colabId: "c1", data: "2026-11-12" };
  let log; beforeEach(() => { log = jest.spyOn(console, "log").mockImplementation(() => {}); }); afterEach(() => log.mockRestore());

  test("consultor move; líder não", async () => {
    const a = montar("admin"); await a.h(req(pedido), a.res);
    expect(a.res.c).toBe(200); expect(a.moverNoBanco).toHaveBeenCalledWith({}, { de: "P311A", para: "P311B", colabId: "c1", data: "2026-11-12" });
    const l = montar("lider", { pid: "P311A" }); await l.h(req(pedido), l.res);
    expect(l.res.c).toBe(403); expect(l.moverNoBanco).not.toHaveBeenCalled();
  });
  test("gestor de divisão só move dentro da divisão dele", async () => {
    const dentro = montar("gestor", { div: "mokpat" }); await dentro.h(req({ ...pedido, pid: "P939", para: "P956" }), dentro.res);
    expect(dentro.res.c).toBe(200);
    const fora = montar("gestor", { div: "mokpat" }); await fora.h(req({ ...pedido, pid: "P939", para: "P311B" }), fora.res);
    expect(fora.res.c).toBe(403); expect(fora.moverNoBanco).not.toHaveBeenCalled();
  });
  test("projeto desconhecido e id inválido são recusados; o log não leva nome nem id de pessoa", async () => {
    const x = montar("admin"); await x.h(req({ ...pedido, para: "P999" }), x.res); expect(x.res.c).toBe(403);
    const y = montar("admin"); await y.h(req({ ...pedido, colabId: "a b" }), y.res); expect(y.res.c).toBe(400);
    const z = montar("admin"); await z.h(req(pedido), z.res); expect(JSON.stringify(log.mock.calls)).not.toContain("c1");
  });
});
