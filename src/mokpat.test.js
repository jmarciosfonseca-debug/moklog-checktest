// MokPat (11/11/2026): 17 projetos (13 residenciais, 4 comerciais), gestor da divisão separado do MokLog.
import { checkPin, checkPinAnyProject, getAccess, getSession, clearSession, setDivisaoAtiva, hasGerencial, gerencialNaDivisao, getClienteScope, authFetch } from "./session";
const { CARGOS_MOKPAT, MOKPAT_IDS, idsDoSegmento, projetosMokpat, divisaoDoProjeto, faixa } = require("./divisoes");

beforeEach(() => { clearSession(); setDivisaoAtiva("moklog"); global.fetch = jest.fn(); });
afterEach(() => { delete global.fetch; });
const reply = (extra) => ({ ok: true, status: 200, json: async () => ({ ok: true, token: "tok", exp: Date.now() + 8 * 3600000, ...extra }) });

test("cadastro: 17 projetos, residencial × comercial, sem checklist inicial", () => {
  expect(MOKPAT_IDS).toHaveLength(32); // 17 iniciais + 15 de 11/11 (tarde)
  expect(idsDoSegmento("comercial")).toEqual(["P703", "P740", "P763", "P770", "P777", "P868"]);
  expect(idsDoSegmento("residencial")).toHaveLength(26); expect(idsDoSegmento("residencial")).toEqual(expect.arrayContaining(["P931", "P944", "P961"]));
  expect(faixa(idsDoSegmento("residencial"))).toBe("P032 — P961");
  const p = projetosMokpat();
  expect(p.P032).toMatchObject({ id: "P032", name: "Residencial", div: "mokpat", seg: "residencial", categories: [] });
  expect(divisaoDoProjeto("P740")).toBe("mokpat"); expect(divisaoDoProjeto("P601")).toBe("moklog");
});

test("PIN do gestor MokPat: só entra pela porta MokPat e só alcança projetos MokPat", async () => {
  fetch.mockResolvedValue(reply({ nivel: "gestor", div: "mokpat" }));
  expect(await checkPinAnyProject("x")).toBeNull(); expect(getSession()).toBeNull();          // porta MokLog recusa
  setDivisaoAtiva("mokpat");
  expect((await checkPinAnyProject("x")).level).toBe("admin");
  expect(hasGerencial()).toBe(true); expect(gerencialNaDivisao("mokpat")).toBe(true); expect(gerencialNaDivisao("moklog")).toBe(false);
  expect(getAccess("P032")).toBe("admin"); expect(getAccess("P601")).toBeNull();
  expect(getClienteScope()).toMatchObject({ escopo: "MOKPAT" }); expect(getClienteScope().pids).toEqual(MOKPAT_IDS); // Área do Cliente: só projetos MokPat
  await expect(authFetch("/api/fv-plano")).rejects.toThrow("gerencial");                        // FV segue exclusivo do gerencial Moked
});

test("gerencial Moked é global; líder não cruza de divisão", async () => {
  fetch.mockResolvedValue(reply({ nivel: "admin" }));
  expect(await checkPin("x")).toBe("admin"); expect(gerencialNaDivisao("mokpat")).toBe(true); expect(getAccess("P032")).toBe("admin"); expect(getAccess("P601")).toBe("admin");
  clearSession(); fetch.mockResolvedValue(reply({ nivel: "lider", pid: "P032" }));
  expect(await checkPinAnyProject("x")).toBeNull();                                             // líder MokPat na porta MokLog
  setDivisaoAtiva("mokpat"); expect((await checkPinAnyProject("x")).projectId).toBe("P032"); expect(getAccess("P032")).toBe("lider");
});

test("servidor: gestor classificado pela divisão; admin só nos projetos dela; requireAdmin recusa", () => {
  const crypto = require("crypto"), h = (p) => crypto.createHash("sha256").update(p).digest("hex");
  const antes = { ...process.env };
  Object.assign(process.env, { SESSION_SECRET: "s".repeat(40), ADMIN_PIN_HASH: h("adm"), DEMO_PIN_HASH: h("demo"), MOKPAT_PIN_HASH: h("pat"), LIDER_PIN_HASHES: JSON.stringify({ P601: h("l601"), P032: h("l032") }) });
  try {
    const auth = require("../api/ai/lib/accessAuth"), c = auth.hashes();
    expect(auth.PROJECTS).toEqual(expect.arrayContaining(["P601", "P032", "P956"]));
    expect(auth.classify("pat", c)).toEqual({ nivel: "gestor", div: "mokpat" });
    expect(auth.classify("pat", c, "P601")).toBeNull();
    expect(auth.classify("l032", c)).toEqual({ nivel: "lider", pid: "P032" });
    const v = auth.verify(auth.issue(auth.classify("pat", c), Date.now(), c).token);
    expect(v).toMatchObject({ nivel: "gestor", div: "mokpat" });
    expect(auth.noProjeto(v, "P740").nivel).toBe("admin"); expect(auth.noProjeto(v, "P601").nivel).toBe("negado");
    const res = { status(s) { this.s = s; return this; }, json() {} };
    expect(auth.requireAdmin({ headers: { authorization: "Bearer " + auth.issue(auth.classify("pat", c), Date.now(), c).token } }, res)).toBeNull(); expect(res.s).toBe(403);
    process.env.MOKPAT_PIN_HASH = h("l601"); expect(auth.classify("l601", auth.hashes())).toEqual({ nivel: "lider", pid: "P601" }); // colisão não derruba o líder
    delete process.env.MOKPAT_PIN_HASH; expect(auth.classify("pat", auth.hashes())).toBeNull(); // sem a variável, a divisão fica sem gestor (não quebra o resto)
  } finally { for (const k of Object.keys(process.env)) if (!(k in antes)) delete process.env[k]; Object.assign(process.env, antes); }
});

test("funções do colaborador MokPat: as 9 pedidas, com VSPP Líder igual ao MokLog; Equipe usa a lista da divisão", () => {
  expect(CARGOS_MOKPAT).toEqual(["VSPP Líder", "VSPP Apoio", "Vigilante de Monitoramento", "Vigilante", "Controlador de Acesso", "Recepcionista", "Porteiro", "Mensageiro", "Ascensorista"]);
  const src = require("fs").readFileSync(require("path").join(__dirname, "Equipe.jsx"), "utf8");
  expect(src).toMatch(/divisaoDoProjeto\(project\.id\) !== "moklog" \? CARGOS_MOKPAT/); // vale para MokPat e MokImp
});

test("P939 tem localização cravada (distância do colaborador), mas não ganha página pública de endereço", async () => {
  const { coordsDe } = require("./entorno/locais");
  expect(coordsDe("P939")).toMatchObject({ lat: -23.5482861, lng: -46.7142361 });
  const { distanciaAteProjeto } = require("./equipe/enderecoColab");
  const km = distanciaAteProjeto({ lat: -23.561, lng: -46.656 }, "P939"); // região da Av. Paulista
  expect(km).toBeGreaterThan(5); expect(km).toBeLessThan(7);
  const handler = require("../api/local");
  const res = { status(s) { this.s = s; return this; }, setHeader() {}, end(t) { this.t = t; } };
  await handler({ query: { pid: "P939" }, headers: {} }, res);
  expect(res.s).toBe(404);
});

test("Área do Cliente: PIN do gestor MokPat entra direto (sem passar pela porta MokPat); PIN de cliente por variável própria", async () => {
  fetch.mockResolvedValue(reply({ nivel: "gestor", div: "mokpat" }));
  expect(await checkPin("x", { cliente: true })).toBe("admin"); expect(getClienteScope().escopo).toBe("MOKPAT"); expect(getAccess("P601")).toBeNull();
  const crypto = require("crypto"), h = (p) => crypto.createHash("sha256").update(p).digest("hex"); const antes = { ...process.env };
  Object.assign(process.env, { SESSION_SECRET: "s".repeat(40), ADMIN_PIN_HASH: h("adm"), DEMO_PIN_HASH: h("demo"), CLIENTE_PIN_HASHES: JSON.stringify({ GOLGI: h("golgi") }), CLIENTE_PIN_HASH_P939: h("pin-cliente-teste") });
  try {
    const auth = require("../api/ai/lib/accessAuth"), c = auth.hashes();
    expect(auth.classify("pin-cliente-teste", c)).toEqual({ nivel: "cliente", escopo: "P939", pids: ["P939", "P944"] }); // P944 cadastrado em 11/11
    expect(auth.classify("golgi", c)).toMatchObject({ nivel: "cliente", escopo: "GOLGI" });
    expect(auth.verify(auth.issue(auth.classify("pin-cliente-teste", c), Date.now(), c).token)).toMatchObject({ nivel: "cliente", pids: ["P939", "P944"] });
  } finally { for (const k of Object.keys(process.env)) if (!(k in antes)) delete process.env[k]; Object.assign(process.env, antes); }
});

test("MokImp: área aberta sem projetos; mesmo PIN provisório nos dois gestores é resolvido pela porta", async () => {
  const { DIVISOES, DIVISAO_IDS } = require("./divisoes");
  expect(DIVISOES.mokimp).toMatchObject({ nome: "MokImp", sub: "Implantação" }); expect(DIVISAO_IDS.mokimp).toEqual([]);
  const crypto = require("crypto"), h = (p) => crypto.createHash("sha256").update(p).digest("hex"); const antes = { ...process.env };
  Object.assign(process.env, { SESSION_SECRET: "s".repeat(40), ADMIN_PIN_HASH: h("adm"), DEMO_PIN_HASH: h("demo"), MOKPAT_PIN_HASH: h("igual"), MOKIMP_PIN_HASH: h("igual") });
  try {
    const auth = require("../api/ai/lib/accessAuth"), c = auth.hashes();
    expect(auth.classify("igual", c, undefined, false, "mokpat")).toEqual({ nivel: "gestor", div: "mokpat" });
    expect(auth.classify("igual", c, undefined, false, "mokimp")).toEqual({ nivel: "gestor", div: "mokimp" });
    expect(auth.classify("igual", c)).toEqual({ nivel: "gestor", div: "mokpat" });            // Área do Cliente: a divisão que já tem projetos
    expect(auth.classify("igual", c, "P939")).toEqual({ nivel: "gestor", div: "mokpat" });
    expect(auth.noProjeto({ nivel: "gestor", div: "mokimp" }, "P939").nivel).toBe("negado");   // gestor MokImp não alcança projeto MokPat
    process.env.MOKIMP_PIN_HASH = h("outro"); const c2 = auth.hashes();
    expect(auth.classify("outro", c2, undefined, false, "mokpat")).toBeNull();                 // PINs diferentes: gestor MokImp não entra pela porta MokPat
    expect(auth.classify("outro", c2, undefined, false, "mokimp")).toEqual({ nivel: "gestor", div: "mokimp" });
  } finally { for (const k of Object.keys(process.env)) if (!(k in antes)) delete process.env[k]; Object.assign(process.env, antes); }
  setDivisaoAtiva("mokimp"); fetch.mockResolvedValue(reply({ nivel: "gestor", div: "mokimp" }));
  expect((await checkPinAnyProject("x")).level).toBe("admin"); expect(JSON.parse(fetch.mock.calls[0][1].body).div).toBe("mokimp");
  expect(gerencialNaDivisao("mokimp")).toBe(true); expect(gerencialNaDivisao("mokpat")).toBe(false); expect(getAccess("P939")).toBeNull();
  expect(getClienteScope()).toEqual({ escopo: "MOKIMP", pids: [] });
});
