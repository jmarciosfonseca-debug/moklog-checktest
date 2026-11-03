// Coletor do Entorno (api/entorno-coletar.js): autorização, pré-filtro + IA, gravação sem apagar o existente.
jest.mock("../../api/ai/lib/accessAuth", () => ({ requireAdmin: (req, res) => { if (req.headers.authorization === "Bearer admin") return { nivel: "admin" }; res.status(401).json({ ok: false }); return null; } }));
const docs = {};
const col = (nome) => ({ doc: (id) => ({ get: async () => ({ data: () => docs[`${nome}/${id}`] }), set: async (d, o) => { docs[`${nome}/${id}`] = o && o.merge ? { ...(docs[`${nome}/${id}`] || {}), ...d } : d; } }) });
jest.mock("../../api/ai/lib/firebaseAdmin", () => ({ getDb: () => global.__dbMock || ({ collection: col }) }));
const chamadasIA = [];
jest.mock("../../api/ai/lib/openai", () => ({ callText: async (prompt) => { if (global.__iaFalha) throw new Error("tool_choice inválido"); chamadasIA.push(prompt); const ids = [...prompt.matchAll(/id=(n[a-z0-9]+)/g)].map((m) => m[1]); return JSON.stringify(ids.map((id) => ({ id, relevante: true, tipo: "roubo", cidade: "Cajamar", bairro: "", proximidade: "cidade", confianca: 80, resumo: "ok" }))); } }));
const handler = require("../../api/entorno-coletar");

const RSS = (t, l) => `<rss><channel><item><title>${t} - G1</title><link>${l}</link><pubDate>Fri, 30 Oct 2026 10:00:00 GMT</pubDate><source url="x">G1</source><description>d</description></item></channel></rss>`;
const resposta = () => { const r = { code: 200, body: null, headers: {} }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = () => {}; return r; };

beforeEach(() => { for (const k of Object.keys(docs)) delete docs[k]; chamadasIA.length = 0; global.fetch = jest.fn(async (url) => url.startsWith("https://nominatim") ? { ok: true, json: async () => [{ lat: "-23.34", lon: "-46.82" }] } : { ok: true, text: async () => (decodeURIComponent(url).includes("roubo") ? RSS("Assalto a caminhão em Cajamar", "https://g1/a") : RSS("Neymar ganha a bola de ouro", "https://uol/b")) }); process.env.CRON_SECRET = "s3"; });

test("GET sem CRON_SECRET correto e POST sem sessão gerencial são recusados", async () => {
  let res = resposta(); await handler({ method: "GET", headers: {}, query: {} }, res); expect(res.code).toBe(401);
  res = resposta(); await handler({ method: "POST", headers: { authorization: "Bearer x" }, query: {} }, res); expect(res.code).toBe(401);
  res = resposta(); await handler({ method: "DELETE", headers: {}, query: {} }, res); expect(res.code).toBe(405);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("coleta de um projeto: lê Google News + portais, só o item do tema vai à IA, grava itens + resumo e preserva o existente", async () => {
  docs["entorno/P601"] = { itens: [{ id: "antigo", tema: "mercado", tipo: "expansao", data: new Date().toISOString(), titulo: "x", link: "y" }] };
  const res = resposta();
  await handler({ method: "POST", headers: { authorization: "Bearer admin" }, query: { pid: "P601" } }, res);
  expect(res.code).toBe(200);
  expect(global.fetch).toHaveBeenCalledTimes(11); // 2 buscas + 3 portais do P601 + 5 portais gerais + 1 geocodificação
  expect(chamadasIA).toHaveLength(1);
  expect(chamadasIA[0]).toMatch(/Assalto a caminhão/);
  expect(chamadasIA[0]).not.toMatch(/Neymar/);
  const d = docs["entorno/P601"];
  expect(d.itens.map((i) => i.id)).toEqual(expect.arrayContaining(["antigo"]));
  expect(d.itens).toHaveLength(2);
  const novo = d.itens.find((i) => i.id !== "antigo");
  expect(novo.geo).toEqual({ lat: -23.34, lng: -46.82 }); expect(novo.km).toBeGreaterThan(0); expect(novo.km).toBeLessThan(2);
  expect(docs["entorno/_geo"]).toBeTruthy(); // cache gravado
  expect(d.resumo.seguranca.d30).toBe(1);
  expect(d.ultimaColeta).toMatchObject({ candidatos: 1, aceitos: 1, erros: [] });
  expect(d.ultimaColeta.fontes.slice(0, 5).map((f) => f.fonte)).toEqual(["Google News", "Google News", "Portal Notícia 360", "Portal Dois Pontos", "G1 Cajamar"]);
  expect(res.body.feitos.P601.aceitos).toBe(1);
  expect(docs["entorno/_status"].emAndamentoAte).toBe(0);
});

test("rotina (GET com CRON_SECRET) percorre os parques com cidade; falha de RSS não derruba a rodada", async () => {
  global.fetch = jest.fn(async () => { throw new Error("rede"); });
  const res = resposta();
  await handler({ method: "GET", headers: { authorization: "Bearer s3" }, query: {} }, res);
  expect(res.code).toBe(200);
  const feitos = Object.keys(res.body.feitos);
  expect(feitos).toEqual(expect.arrayContaining(["_geral", "P601", "P505", "P311B", "P260A"]));
  expect(feitos[0]).toBe("_geral");
  expect(docs["entorno/P601"].ultimaColeta.erros).toHaveLength(10);
  expect(docs["entorno/P601"].ultimaColeta.fontes.every((f) => !f.ok)).toBe(true);
  expect(chamadasIA).toHaveLength(0); // nada lido → IA não é chamada → custo zero
});

test("falha da IA não impede a gravação: o doc sai com o erro registrado", async () => {
  global.__iaFalha = true;
  try {
    const res = resposta();
    await handler({ method: "POST", headers: { authorization: "Bearer admin" }, query: { pid: "P601" } }, res);
    expect(res.code).toBe(200);
    expect(docs["entorno/P601"].itens).toEqual([]);
    expect(docs["entorno/P601"].ultimaColeta.erros.join()).toMatch(/IA: tool_choice/);
  } finally { global.__iaFalha = false; }
});

// GET /api/entorno — leitura pelo servidor com escopo da sessão (03/11/2026).
jest.mock("../../api/ai/lib/accessAuth", () => ({
  requireAdmin: (req, res) => { if (req.headers.authorization === "Bearer admin") return { nivel: "admin" }; res.status(401).json({ ok: false }); return null; },
  verify: (t) => ({ "a.a": { nivel: "admin" }, "c.c": { nivel: "cliente", pids: ["P601", "P602"] }, "l.l": { nivel: "lider", pid: "P505" } }[t] || null),
}));
const lerApi = require("../../api/entorno");
test("leitura: admin vê todos + status; cliente só o escopo + geral; líder só o seu; sem sessão 401; pid fora do escopo 403", async () => {
  docs["entorno/P601"] = { itens: [{ id: "a" }] }; docs["entorno/P505"] = { itens: [] }; docs["entorno/_geral"] = { itens: [{ id: "g" }] }; docs["entorno/_status"] = { ultimaEm: "x" };
  const getAll = async (...refs) => refs.map((r) => ({ id: r.id, exists: !!docs[`entorno/${r.id}`], data: () => docs[`entorno/${r.id}`] }));
  const dbMock = { collection: () => ({ doc: (id) => ({ id }) }), getAll };
  global.__dbMock = dbMock;
  let res = resposta(); await lerApi({ method: "GET", headers: {}, query: {} }, res); expect(res.code).toBe(401);
  res = resposta(); await lerApi({ method: "GET", headers: { authorization: "Bearer a.a" }, query: {} }, res);
  expect(res.code).toBe(200); expect(Object.keys(res.body.docs)).toEqual(["P601", "P505"]); expect(res.body.status).toEqual({ ultimaEm: "x" }); expect(res.body.geral.itens).toHaveLength(1);
  res = resposta(); await lerApi({ method: "GET", headers: { authorization: "Bearer c.c" }, query: {} }, res);
  expect(res.body.pids).toEqual(["P601", "P602"]); expect(Object.keys(res.body.docs)).toEqual(["P601"]); expect(res.body.status).toBeNull(); expect(res.body.geral).toBeTruthy();
  res = resposta(); await lerApi({ method: "GET", headers: { authorization: "Bearer c.c" }, query: { pid: "P505" } }, res); expect(res.code).toBe(403);
  res = resposta(); await lerApi({ method: "GET", headers: { authorization: "Bearer l.l" }, query: {} }, res); expect(res.body.pids).toEqual(["P505"]);
});
