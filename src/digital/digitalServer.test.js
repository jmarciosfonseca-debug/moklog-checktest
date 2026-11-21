/** @jest-environment node */
const crypto = require("crypto");

const state = new Map();
let seq = 0;
const mk = (c, id) => ({ path: `${c}/${id}`, get: async () => ({ exists: state.has(`${c}/${id}`), id, data: () => state.get(`${c}/${id}`) }), set: async (v) => { state.set(`${c}/${id}`, JSON.parse(JSON.stringify(v))); }, delete: async () => { state.delete(`${c}/${id}`); } });
const db = {
  collection: (c) => ({
    doc: (id) => mk(c, id || `auto${seq++}`),
    where: (f, _op, v) => ({ limit: (n) => ({ get: async () => ({ docs: [...state.entries()].filter(([k, d]) => k.startsWith(c + "/") && d[f] === v).slice(0, n).map(([k, d]) => ({ id: k.split("/")[1], data: () => d })) }) }) }),
    limit: (n) => ({ get: async () => ({ docs: [...state.entries()].filter(([k]) => k.startsWith(c + "/")).slice(0, n).map(([k, d]) => ({ id: k.split("/")[1], data: () => d })) }) }),
  }),
  runTransaction: async (fn) => {
    const staged = [];
    const t = { get: (ref) => ref.get(), set: (ref, v) => staged.push(["set", ref, v]), delete: (ref) => staged.push(["del", ref]) };
    const r = await fn(t);
    for (const [op, ref, v] of staged) { if (op === "set") await ref.set(v); else await ref.delete(); }
    return r;
  },
};
jest.mock("../../api/ai/lib/firebaseAdmin", () => ({ getDb: () => db }));

const auth = require("../../api/ai/lib/accessAuth");
const D = require("../../api/ai/lib/digitalCore");
const handler = require("../../api/digital");

const ORIGEM = "https://moked-checktest.vercel.app";
const RPID = "moked-checktest.vercel.app";
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
const res = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(b) { this.body = b; return this; } });
async function chamar(body, { token, origin = ORIGEM, ip = "10.0.0.1" } = {}) {
  const r = res();
  await handler({ method: "POST", socket: { remoteAddress: ip }, headers: { ...(origin ? { origin } : {}), ...(token ? { authorization: "Bearer " + token } : {}) }, body }, r);
  return r;
}

// Autenticador de mentira (ES256), como o do iPhone/Android faria.
function novoAparelho() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const credId = crypto.randomBytes(32);
  return { publicKey, privateKey, credId, credentialId: credId.toString("base64url"), spki: publicKey.export({ type: "spki", format: "der" }).toString("base64url"), contagem: 0 };
}
const authData = (ap, { flags, contagem, comCredencial = false, rpId = RPID } = {}) => {
  if (flags == null) flags = comCredencial ? 0x45 : 0x05; // UP+UV (+AT no cadastro)
  const base = Buffer.concat([crypto.createHash("sha256").update(rpId).digest(), Buffer.from([flags]), Buffer.alloc(4)]);
  base.writeUInt32BE(contagem, 33);
  if (!comCredencial) return base;
  const n = Buffer.alloc(2); n.writeUInt16BE(ap.credId.length);
  return Buffer.concat([base, Buffer.alloc(16), n, ap.credId, Buffer.from("cose-ignorado")]);
};
const clientData = (tipo, desafio, origin = ORIGEM) => Buffer.from(JSON.stringify({ type: tipo === "registro" ? "webauthn.create" : "webauthn.get", challenge: Buffer.from(desafio).toString("base64url"), origin, crossOrigin: false }));
const assina = (ap, ad, cd) => crypto.sign("sha256", Buffer.concat([ad, crypto.createHash("sha256").update(cd).digest()]), { key: ap.privateKey, dsaEncoding: "der" }).toString("base64url");

async function cadastrar(ap, token, rotulo = "iPhone do Marcio") {
  const o = await chamar({ acao: "opcoes-registro" }, { token });
  if (o.code !== 200) return o;
  ap.contagem = 0;
  const ad = authData(ap, { contagem: 0, comCredencial: true }), cd = clientData("registro", o.body.desafio);
  return chamar({ acao: "registrar", credentialId: ap.credentialId, clientDataJSON: cd.toString("base64url"), authenticatorData: ad.toString("base64url"), publicKey: ap.spki, alg: -7, rotulo }, { token });
}
async function entrar(ap, { ip, flags = 0x05, usarContagem, outraChave, origem } = {}) {
  const o = await chamar({ acao: "opcoes-login", credentialId: ap.credentialId }, { ip });
  ap.contagem = usarContagem ?? ap.contagem + 1;
  const ad = authData(ap, { flags, contagem: ap.contagem }), cd = clientData("login", o.body.desafio, origem);
  const quem = outraChave ? { privateKey: outraChave } : ap;
  return chamar({ acao: "entrar", credentialId: ap.credentialId, clientDataJSON: cd.toString("base64url"), authenticatorData: ad.toString("base64url"), signature: assina(quem, ad, cd) }, { ip });
}

let tokenAdmin, tokenCliente, tokenLider;
beforeEach(() => {
  state.clear();
  delete process.env.VERCEL;
  process.env.DIGITAL_ATIVO = "1";
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.ADMIN_PIN_HASH = hash("pin-admin");
  process.env.DEMO_PIN_HASH = hash("pin-demo");
  process.env.RONDA_PIN_HASH = hash("pin-ronda");
  process.env.LIDER_PIN_HASHES = JSON.stringify({ P601: hash("pin-lider") });
  process.env.CLIENTE_PIN_HASHES = JSON.stringify({ GOLGI: hash("pin-golgi"), P311A: hash("pin-p311a") });
  const c = auth.hashes(), now = Date.now();
  tokenAdmin = auth.issue({ nivel: "admin" }, now, c).token;
  tokenCliente = auth.issue({ nivel: "cliente", escopo: "GOLGI", pids: c.cliente.GOLGI.pids }, now, c).token;
  tokenLider = auth.issue({ nivel: "lider", pid: "P601" }, now, c).token;
});
afterEach(() => { delete process.env.DIGITAL_ATIVO; });

describe("digital: chave de desligamento e origem", () => {
  test("sem DIGITAL_ATIVO tudo responde indisponível (PIN segue valendo)", async () => {
    delete process.env.DIGITAL_ATIVO;
    expect((await chamar({ acao: "opcoes-login" })).code).toBe(503);
    expect((await chamar({ acao: "opcoes-registro" }, { token: tokenAdmin })).code).toBe(503);
  });
  test("origem fora da lista é recusada", async () => {
    expect((await chamar({ acao: "opcoes-login" }, { origin: "https://site-falso.com" })).code).toBe(403);
    expect((await chamar({ acao: "opcoes-login" }, { origin: null })).code).toBe(403);
  });
  test("só POST", async () => {
    const r = res(); await handler({ method: "GET", headers: {} }, r); expect(r.code).toBe(405);
  });
});

describe("digital: cadastro", () => {
  test("gerencial cadastra e a credencial fica selada, com só a chave pública", async () => {
    const ap = novoAparelho();
    const r = await cadastrar(ap, tokenAdmin);
    expect(r.code).toBe(200);
    const d = state.get(`digital_credenciais/${ap.credentialId}`);
    expect(d.grupo).toBe("admin");
    expect(d.spki).toBe(ap.spki);
    expect(JSON.stringify(d)).not.toMatch(/PRIVATE/);
    expect(D.igual(D.selarCredencial(process.env.SESSION_SECRET, d), d.sel)).toBe(true);
  });
  test("líder, ronda e demo não cadastram (só PIN); sem sessão também não", async () => {
    expect((await chamar({ acao: "opcoes-registro" }, { token: tokenLider })).code).toBe(403);
    const c = auth.hashes();
    expect((await chamar({ acao: "opcoes-registro" }, { token: auth.issue({ nivel: "demo" }, Date.now(), c).token })).code).toBe(403);
    expect((await chamar({ acao: "opcoes-registro" }, { token: auth.issue({ nivel: "ronda", pid: "P601" }, Date.now(), c).token })).code).toBe(403);
    expect((await chamar({ acao: "opcoes-registro" })).code).toBe(401);
  });
  test("desafio de cadastro não serve duas vezes nem para outro tipo", async () => {
    const ap = novoAparelho();
    const o = await chamar({ acao: "opcoes-registro" }, { token: tokenAdmin });
    const body = (desafio, tipo = "registro") => ({ acao: "registrar", credentialId: ap.credentialId, clientDataJSON: clientData(tipo, desafio).toString("base64url"), authenticatorData: authData(ap, { contagem: 0, comCredencial: true }).toString("base64url"), publicKey: ap.spki, alg: -7 });
    expect((await chamar(body(o.body.desafio), { token: tokenAdmin })).code).toBe(200);
    state.delete(`digital_credenciais/${ap.credentialId}`);
    expect((await chamar(body(o.body.desafio), { token: tokenAdmin })).code).toBe(400); // reuso
    const l = await chamar({ acao: "opcoes-login" });
    expect((await chamar(body(l.body.desafio), { token: tokenAdmin })).code).toBe(400); // desafio de login no cadastro
  });
  test("credencial que não confere com o authenticatorData, chave inválida e sem digital são recusadas", async () => {
    const ap = novoAparelho(), outro = novoAparelho();
    const o = async () => (await chamar({ acao: "opcoes-registro" }, { token: tokenAdmin })).body.desafio;
    const base = async (ex = {}) => ({ acao: "registrar", credentialId: ap.credentialId, clientDataJSON: clientData("registro", await o()).toString("base64url"), authenticatorData: authData(ap, { contagem: 0, comCredencial: true }).toString("base64url"), publicKey: ap.spki, alg: -7, ...ex });
    expect((await chamar(await base({ credentialId: outro.credentialId }), { token: tokenAdmin })).code).toBe(400);
    expect((await chamar(await base({ publicKey: "AAAA" }), { token: tokenAdmin })).code).toBe(400);
    expect((await chamar(await base({ alg: -8 }), { token: tokenAdmin })).code).toBe(400);
    expect((await chamar(await base({ authenticatorData: authData(ap, { flags: 0x41, contagem: 0, comCredencial: true }).toString("base64url") }), { token: tokenAdmin })).code).toBe(400); // sem UV
  });
});

describe("digital: entrada", () => {
  test("cadastrar e entrar: devolve sessão gerencial válida; segunda entrada também (contador avança)", async () => {
    const ap = novoAparelho(); await cadastrar(ap, tokenAdmin);
    const r = await entrar(ap);
    expect(r.code).toBe(200);
    expect(auth.verify(r.body.token)).toMatchObject({ nivel: "admin" });
    expect((await entrar(ap)).code).toBe(200);
  });
  test("cliente entra só no escopo dele", async () => {
    const ap = novoAparelho(); await cadastrar(ap, tokenCliente);
    const r = await entrar(ap);
    expect(r.code).toBe(200);
    const p = auth.verify(r.body.token);
    expect(p).toMatchObject({ nivel: "cliente", escopo: "GOLGI" });
    expect(p.pids).toEqual(auth.hashes().cliente.GOLGI.pids);
  });
  test("a mesma resposta não vale duas vezes (replay)", async () => {
    const ap = novoAparelho(); await cadastrar(ap, tokenAdmin);
    const o = await chamar({ acao: "opcoes-login", credentialId: ap.credentialId });
    const ad = authData(ap, { contagem: 5 }), cd = clientData("login", o.body.desafio);
    const corpo = { acao: "entrar", credentialId: ap.credentialId, clientDataJSON: cd.toString("base64url"), authenticatorData: ad.toString("base64url"), signature: assina(ap, ad, cd) };
    expect((await chamar(corpo)).code).toBe(200);
    expect((await chamar(corpo)).code).toBe(401);
  });
  test("assinatura de outra chave, sem digital/rosto e origem falsa são recusadas", async () => {
    const ap = novoAparelho(); await cadastrar(ap, tokenAdmin);
    expect((await entrar(ap, { outraChave: novoAparelho().privateKey })).code).toBe(401);
    expect((await entrar(ap, { flags: 0x01 })).code).toBe(401);
    expect((await entrar(ap, { origem: "https://site-falso.com" })).code).toBe(401);
  });
  test("contador que não avança (aparelho clonado) é recusado", async () => {
    const ap = novoAparelho(); await cadastrar(ap, tokenAdmin);
    expect((await entrar(ap, { usarContagem: 10 })).code).toBe(200);
    expect((await entrar(ap, { usarContagem: 10 })).code).toBe(401);
    expect((await entrar(ap, { usarContagem: 3 })).code).toBe(401);
    expect((await entrar(ap, { usarContagem: 11 })).code).toBe(200);
  });
  test("trocar o PIN do perfil derruba as digitais dele, e só dele", async () => {
    const adm = novoAparelho(), cli = novoAparelho();
    await cadastrar(adm, tokenAdmin); await cadastrar(cli, tokenCliente);
    process.env.ADMIN_PIN_HASH = hash("pin-admin-novo");
    expect((await entrar(adm)).code).toBe(401);
    expect((await entrar(cli, { ip: "10.0.0.9" })).code).toBe(200); // o PIN do cliente não mudou: a digital dele segue valendo
  });
  test("perfil de cliente removido da configuração não entra", async () => {
    const cli = novoAparelho(); await cadastrar(cli, tokenCliente);
    const antes = auth.hashes();
    process.env.CLIENTE_PIN_HASHES = JSON.stringify({ P311A: hash("pin-p311a") });
    expect(auth.hashes().cliente.GOLGI).toBeUndefined();
    expect(antes.cliente.GOLGI).toBeDefined();
    expect((await entrar(cli)).code).toBe(401);
  });
  test("credencial escrita direto no banco, sem o selo do servidor, não entra (o Firestore do app é aberto)", async () => {
    const falso = novoAparelho();
    state.set(`digital_credenciais/${falso.credentialId}`, { id: falso.credentialId, grupo: "admin", identidade: { nivel: "admin" }, spki: falso.spki, alg: -7, contagem: 0, pv: "x", rpId: RPID, sel: "qualquer" });
    expect((await entrar(falso)).code).toBe(401);
  });
  test("5 falhas bloqueiam por 15 min, inclusive a digital certa, e outro IP não é afetado", async () => {
    const ap = novoAparelho(); await cadastrar(ap, tokenAdmin);
    const ruim = novoAparelho().privateKey;
    for (let i = 0; i < 5; i++) expect((await entrar(ap, { outraChave: ruim, ip: "10.9.9.9" })).code).toBe(401);
    const r = await chamar({ acao: "opcoes-login" }, { ip: "10.9.9.9" });
    expect(r.code).toBe(429);
    expect((await entrar(ap, { ip: "10.1.1.1" })).code).toBe(200);
  });
});

describe("digital: gestão dos aparelhos", () => {
  test("cliente vê e remove só os dele; gerencial vê todos e remove qualquer um", async () => {
    const a = novoAparelho(), b = novoAparelho(), c = novoAparelho();
    await cadastrar(a, tokenAdmin, "iPhone Marcio"); await cadastrar(b, tokenCliente, "Android Golgi"); 
    const mega = auth.issue({ nivel: "cliente", escopo: "P311A", pids: auth.hashes().cliente.P311A.pids }, Date.now(), auth.hashes()).token;
    await cadastrar(c, mega, "iPad Mega");
    const lc = await chamar({ acao: "listar" }, { token: tokenCliente });
    expect(lc.body.itens.map((i) => i.rotulo)).toEqual(["Android Golgi"]);
    const la = await chamar({ acao: "listar" }, { token: tokenAdmin });
    expect(la.body.itens.map((i) => i.rotulo).sort()).toEqual(["Android Golgi", "iPad Mega", "iPhone Marcio"]);
    expect((await chamar({ acao: "remover", id: a.credentialId }, { token: tokenCliente })).code).toBe(403);
    expect((await chamar({ acao: "remover", id: b.credentialId }, { token: tokenCliente })).code).toBe(200);
    expect((await chamar({ acao: "remover", id: c.credentialId }, { token: tokenAdmin })).code).toBe(200);
    expect((await entrar(c)).code).toBe(401); // removido não entra mais
  });
  test("limite de aparelhos por perfil", async () => {
    for (let i = 0; i < 20; i++) expect((await cadastrar(novoAparelho(), tokenAdmin)).code).toBe(200);
    expect((await cadastrar(novoAparelho(), tokenAdmin)).code).toBe(409);
  });
});

describe("digitalCore", () => {
  test("desafio: expira, tipo errado e adulterado", () => {
    const s = "segredo-de-teste-com-mais-de-32-caracteres";
    const d = D.criarDesafio("login", s, 1000);
    expect(D.lerDesafio(d, "login", s, 1000 + 1)).toBeTruthy();
    expect(D.lerDesafio(d, "login", s, 1000 + D.TTL_DESAFIO)).toBeNull();
    expect(D.lerDesafio(d, "registro", s, 1001)).toBeNull();
    expect(D.lerDesafio(d.replace(/.$/, "x"), "login", s, 1001)).toBeNull();
  });
  test("identidade: só admin, gestor e cliente viram digital", () => {
    expect(D.identidadeDoToken({ nivel: "admin" })).toEqual({ nivel: "admin" });
    expect(D.identidadeDoToken({ nivel: "gestor", div: "mokpat" })).toEqual({ nivel: "gestor", div: "mokpat" });
    expect(D.identidadeDoToken({ nivel: "cliente", escopo: "GOLGI", pids: ["P601"] })).toEqual({ nivel: "cliente", escopo: "GOLGI", pids: ["P601"] });
    for (const n of ["lider", "ronda", "demo"]) expect(D.identidadeDoToken({ nivel: n, pid: "P601" })).toBeNull();
  });
});
