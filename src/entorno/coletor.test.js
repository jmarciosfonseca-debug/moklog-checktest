// Coletor do Entorno (api/entorno-coletar.js): autorização, pré-filtro + IA, gravação sem apagar o existente.
jest.mock("../../api/ai/lib/accessAuth", () => ({ requireAdmin: (req, res) => { if (req.headers.authorization === "Bearer admin") return { nivel: "admin" }; res.status(401).json({ ok: false }); return null; } }));
const docs = {};
const col = (nome) => ({ doc: (id) => ({ get: async () => ({ data: () => docs[`${nome}/${id}`] }), set: async (d, o) => { docs[`${nome}/${id}`] = o && o.merge ? { ...(docs[`${nome}/${id}`] || {}), ...d } : d; } }) });
jest.mock("../../api/ai/lib/firebaseAdmin", () => ({ getDb: () => ({ collection: col }) }));
const chamadasIA = [];
jest.mock("../../api/ai/lib/openai", () => ({ callModel: async ({ input }) => { chamadasIA.push(input[0].content); const ids = [...input[0].content.matchAll(/id=(n[a-z0-9]+)/g)].map((m) => m[1]); return { outputText: JSON.stringify(ids.map((id) => ({ id, relevante: true, tipo: "roubo", cidade: "Cajamar", bairro: "", proximidade: "cidade", confianca: 80, resumo: "ok" }))) }; } }));
const handler = require("../../api/entorno-coletar");

const RSS = (t, l) => `<rss><channel><item><title>${t} - G1</title><link>${l}</link><pubDate>Fri, 30 Oct 2026 10:00:00 GMT</pubDate><source url="x">G1</source><description>d</description></item></channel></rss>`;
const resposta = () => { const r = { code: 200, body: null, headers: {} }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = () => {}; return r; };

beforeEach(() => { for (const k of Object.keys(docs)) delete docs[k]; chamadasIA.length = 0; global.fetch = jest.fn(async (url) => ({ ok: true, text: async () => (decodeURIComponent(url).includes("roubo") ? RSS("Assalto a caminhão em Cajamar", "https://g1/a") : RSS("Neymar ganha a bola de ouro", "https://uol/b")) })); process.env.CRON_SECRET = "s3"; });

test("GET sem CRON_SECRET correto e POST sem sessão gerencial são recusados", async () => {
  let res = resposta(); await handler({ method: "GET", headers: {}, query: {} }, res); expect(res.code).toBe(401);
  res = resposta(); await handler({ method: "POST", headers: { authorization: "Bearer x" }, query: {} }, res); expect(res.code).toBe(401);
  res = resposta(); await handler({ method: "DELETE", headers: {}, query: {} }, res); expect(res.code).toBe(405);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("coleta de um projeto: lê 2 feeds, só o item do tema vai à IA, grava itens + resumo e preserva o existente", async () => {
  docs["entorno/P601"] = { itens: [{ id: "antigo", tema: "mercado", tipo: "expansao", data: new Date().toISOString(), titulo: "x", link: "y" }] };
  const res = resposta();
  await handler({ method: "POST", headers: { authorization: "Bearer admin" }, query: { pid: "P601" } }, res);
  expect(res.code).toBe(200);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(chamadasIA).toHaveLength(1);
  expect(chamadasIA[0]).toMatch(/Assalto a caminhão/);
  expect(chamadasIA[0]).not.toMatch(/Neymar/);
  const d = docs["entorno/P601"];
  expect(d.itens.map((i) => i.id)).toEqual(expect.arrayContaining(["antigo"]));
  expect(d.itens).toHaveLength(2);
  expect(d.resumo.seguranca.d30).toBe(1);
  expect(d.ultimaColeta).toMatchObject({ lidos: 2, candidatos: 1, aceitos: 1, erros: [] });
  expect(res.body.feitos.P601.aceitos).toBe(1);
  expect(docs["entorno/_status"].emAndamentoAte).toBe(0);
});

test("rotina (GET com CRON_SECRET) percorre os parques com cidade; falha de RSS não derruba a rodada", async () => {
  global.fetch = jest.fn(async () => { throw new Error("rede"); });
  const res = resposta();
  await handler({ method: "GET", headers: { authorization: "Bearer s3" }, query: {} }, res);
  expect(res.code).toBe(200);
  const feitos = Object.keys(res.body.feitos);
  expect(feitos).toEqual(expect.arrayContaining(["P601", "P505", "P311B"]));
  expect(feitos).not.toContain("P260A");
  expect(docs["entorno/P601"].ultimaColeta.erros).toHaveLength(2);
  expect(chamadasIA).toHaveLength(0); // nada lido → IA não é chamada → custo zero
});
