// MokPat (11/11/2026): 17 projetos (13 residenciais, 4 comerciais), gestor da divisão separado do MokLog.
import { checkPin, checkPinAnyProject, getAccess, getSession, clearSession, setDivisaoAtiva, hasGerencial, gerencialNaDivisao, getClienteScope, authFetch } from "./session";
const { CARGOS_MOKPAT, MOKPAT_IDS, idsDoSegmento, projetosMokpat, divisaoDoProjeto, faixa } = require("./divisoes");

beforeEach(() => { clearSession(); setDivisaoAtiva("moklog"); global.fetch = jest.fn(); });
afterEach(() => { delete global.fetch; });
const reply = (extra) => ({ ok: true, status: 200, json: async () => ({ ok: true, token: "tok", exp: Date.now() + 8 * 3600000, ...extra }) });

test("cadastro: 17 projetos, residencial × comercial, sem checklist inicial", () => {
  expect(MOKPAT_IDS).toHaveLength(17);
  expect(idsDoSegmento("comercial")).toEqual(["P740", "P770", "P777", "P868"]);
  expect(idsDoSegmento("residencial")).toHaveLength(13);
  expect(faixa(idsDoSegmento("residencial"))).toBe("P032 — P956");
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
  expect(getClienteScope()).toBeNull();                                                         // não abre a Área do Cliente MokLog
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
  expect(src).toMatch(/divisaoDoProjeto\(project\.id\) === "mokpat" \? CARGOS_MOKPAT/);
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
