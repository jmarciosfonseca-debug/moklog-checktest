// CPF protegido e cadeado da equipe (12/11/2026).
const cpf = require("../api/ai/lib/cpf");
const { validateLeader } = require("../api/ai/lib/equipeMerge");
const { cpfValido } = require("./Equipe");
const env = { CPF_CHAVE: "0f".repeat(32) };
const clone = (x) => JSON.parse(JSON.stringify(x));
const NUM = "52998224725"; // CPF de exemplo com dígitos verificadores válidos (não é de pessoa real)

test("valida dígitos verificadores (servidor e tela iguais)", () => {
  for (const [v, ok] of [[NUM, true], ["529.982.247-25", true], ["52998224726", false], ["11111111111", false], ["123", false], ["", false]]) { expect(cpf.valido(v)).toBe(ok); expect(cpfValido(v)).toBe(ok); }
});

test("o documento gravado nunca leva o CPF em texto: só cifrado, final e impressão", () => {
  const doc = { colaboradores: [{ id: "a", nome: "A", cpf: "529.982.247-25" }, { id: "b", nome: "B" }], desligados: [] };
  cpf.protegerCpfs(doc, env);
  const a = doc.colaboradores[0];
  expect(a.cpf).toBeUndefined(); expect(a.cpfFinal).toBe("25"); expect(a.cpfHmac).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(doc)).not.toContain(NUM); expect(JSON.stringify(doc)).not.toContain("529.982");
  expect(cpf.decifrar(a.cpfCifrado, env)).toBe(NUM);
  expect(cpf.decifrar(a.cpfCifrado, { CPF_CHAVE: "aa".repeat(32) })).toBeNull(); // outra chave não abre
  expect(cpf.hmac(NUM, env)).toBe(a.cpfHmac);                                       // mesma pessoa, mesma impressão (login futuro)
  expect(cpf.cifrar(NUM, env)).not.toBe(a.cpfCifrado);                             // cifra não repete
  expect(doc.colaboradores[1]).toEqual({ id: "b", nome: "B" });
});

test("CPF inválido é recusado; vazio apaga; sem chave no servidor não grava CPF", () => {
  expect(() => cpf.protegerCpfs({ colaboradores: [{ id: "a", cpf: "52998224726" }] }, env)).toThrow(/CPF inválido/);
  const d = { colaboradores: [{ id: "a", cpf: "", cpfCifrado: "x", cpfFinal: "25", cpfHmac: "y" }] };
  expect(cpf.protegerCpfs(d, env).colaboradores[0]).toEqual({ id: "a" });
  expect(() => cpf.protegerCpfs({ colaboradores: [{ id: "a", cpf: NUM }] }, {})).toThrow(/não habilitado/);
  expect(() => cpf.protegerCpfs({ colaboradores: [{ id: "a", nome: "sem cpf" }] }, {})).not.toThrow();
});

describe("cadeado", () => {
  const base = (fechado) => ({ cadeado: { fechado }, colaboradores: [{ id: "a", nome: "A", cargo: "Vigilante", telefone: "1", historico: [{ id: "h1", tipo: "Falta" }], uniforme: { solicitacoes: [] } }, { id: "b", nome: "B", historico: [] }], desligados: [{ id: "z", nome: "Z" }] });
  const tenta = (fechado, mudar) => { const b = base(fechado), a = clone(b); mudar(a); return () => validateLeader(b, a); };

  test("fechado: o líder segue lançando o dia a dia", () => {
    expect(tenta(true, (a) => a.colaboradores[0].historico.unshift({ id: "h2", tipo: "FT", data: "2026-11-12" }))).not.toThrow();
    expect(tenta(true, (a) => { a.colaboradores[1].rotaKm = 12; a.colaboradores[1].ultimaReciclagem = "2026-11-01"; })).not.toThrow();
    expect(tenta(true, (a) => { a.checagemEquipe = { alvo: "2026-11-14", checkins: [] }; })).not.toThrow();
  });
  test.each([
    ["cadastrar", (a) => a.colaboradores.push({ id: "c", nome: "C" })],
    ["excluir", (a) => a.colaboradores.pop()],
    ["desligar", (a) => a.desligados.unshift({ ...a.colaboradores.shift(), status: "desligado" })],
    ["reativar", (a) => a.colaboradores.push(a.desligados.pop())],
    ["editar nome", (a) => { a.colaboradores[0].nome = "Outro"; }],
    ["editar telefone", (a) => { a.colaboradores[0].telefone = "2"; }],
    ["trocar CPF", (a) => { a.colaboradores[0].cpfCifrado = "v1:x"; }],
    ["apagar lançamento antigo", (a) => { a.colaboradores[0].historico = []; }],
  ])("fechado: líder não consegue %s", (_, mudar) => { expect(tenta(true, mudar)).toThrow(/trancada pelo consultor/); });
  test("aberto: o líder faz tudo isso; e nunca mexe no próprio cadeado", () => {
    expect(tenta(false, (a) => a.colaboradores.push({ id: "c", nome: "C" }))).not.toThrow();
    expect(tenta(false, (a) => { a.colaboradores[0].nome = "Outro"; })).not.toThrow();
    expect(tenta(true, (a) => { a.cadeado = { fechado: false }; })).toThrow(/exclusivamente gerencial/);
    expect(tenta(false, (a) => { a.cadeado = { fechado: true }; })).toThrow(/exclusivamente gerencial/);
  });
});

describe("ver CPF completo", () => {
  const montar = (nivel, extra = {}) => {
    jest.resetModules(); process.env.CPF_CHAVE = env.CPF_CHAVE;
    const c = require("../api/ai/lib/cpf");
    const doc = { colaboradores: [{ id: "a", cpfCifrado: c.cifrar(NUM), cpfFinal: "25" }, { id: "b" }] };
    jest.doMock("../api/ai/lib/firebaseAdmin", () => ({ getDb: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => doc }) }) }) }) }));
    jest.doMock("../api/ai/lib/accessAuth", () => ({ verify: () => ({ nivel, ...extra }), PROJECTS: ["P311A", "P939"] }));
    const res = { setHeader() {}, status(x) { this.c = x; return this; }, json(j) { this.j = j; return this; } };
    return { h: require("../api/equipe-save"), res };
  };
  const req = (b) => ({ method: "POST", headers: { authorization: "Bearer t" }, body: { acao: "cpf", pid: "P311A", colabId: "a", ...b } });
  let log; beforeEach(() => { log = jest.spyOn(console, "log").mockImplementation(() => {}); }); afterEach(() => { log.mockRestore(); delete process.env.CPF_CHAVE; });
  test("consultor vê; líder e gestor de outra divisão não; o número não vai para o log", async () => {
    const a = montar("admin"); await a.h(req(), a.res); expect(a.res.j).toEqual({ ok: true, cpf: "529.982.247-25" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("529"); 
    const l = montar("lider", { pid: "P311A" }); await l.h(req(), l.res); expect(l.res.c).toBe(403);
    const g = montar("gestor", { div: "mokpat" }); await g.h(req(), g.res); expect(g.res.c).toBe(403);
    const s = montar("admin"); await s.h(req({ colabId: "b" }), s.res); expect(s.res.c).toBe(404);
  });
});
