import { diagnosticarDigital, ENDERECOS_OFICIAIS } from "./diagnostico";
import { K_TESTE, K_ID } from "./digital";

const jsonOk = (j) => ({ ok: true, status: 200, json: async () => j });
const mkFetch = (statusApi, modo = "teste") => jest.fn(async (url) => (String(url).startsWith("/digital-config.json") ? jsonOk({ modo }) : { ok: statusApi === 200, status: statusApi, json: async () => ({}) }));
const mkWin = ({ host = "moked-checktest.vercel.app", marca = true, cadastro = false, uvpaa = true, api = true, seguro = true } = {}) => {
  const mem = {}; if (marca) mem[K_TESTE] = "1"; if (cadastro) mem[K_ID] = "abc";
  return { location: { hostname: host }, isSecureContext: seguro, localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: () => {}, removeItem: () => {} },
    ...(api ? { PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable: async () => uvpaa }, navigator: { credentials: {} } } : { navigator: {} }) };
};
const ach = (r, id) => r.itens.find((i) => i.id === id);

test("os dois endereços oficiais são reconhecidos (o antigo continua em uso no celular)", async () => {
  expect(ENDERECOS_OFICIAIS).toEqual(["moked-checktest.vercel.app", "moklog-checktest.vercel.app"]);
  for (const host of ENDERECOS_OFICIAIS) expect(ach(await diagnosticarDigital({ win: mkWin({ host }), fetchFn: mkFetch(200) }), "endereco").ok).toBe(true);
  expect(ach(await diagnosticarDigital({ win: mkWin({ host: "outro.vercel.app" }), fetchFn: mkFetch(200) }), "endereco").ok).toBe(false);
});

test("tudo certo: pronto, só falta cadastrar", async () => {
  const r = await diagnosticarDigital({ win: mkWin(), fetchFn: mkFetch(200) });
  expect(r.pronto).toBe(true); expect(r.motivo).toBe("");
  expect(ach(r, "cadastro").ok).toBe(false); // não é impedimento: cadastra-se depois do PIN
});

test("aponta o motivo certo em cada falha", async () => {
  expect((await diagnosticarDigital({ win: mkWin({ marca: false }), fetchFn: mkFetch(200) })).motivo).toContain("?digital=1");
  expect((await diagnosticarDigital({ win: mkWin({ api: false }), fetchFn: mkFetch(200) })).motivo).toContain("Chrome");
  expect((await diagnosticarDigital({ win: mkWin({ uvpaa: false }), fetchFn: mkFetch(200) })).motivo).toContain("bloqueio de tela");
  expect((await diagnosticarDigital({ win: mkWin(), fetchFn: mkFetch(503) })).motivo).toContain("desligada no servidor");
  expect((await diagnosticarDigital({ win: mkWin(), fetchFn: mkFetch(403) })).motivo).toContain("não aceita este endereço");
  expect((await diagnosticarDigital({ win: mkWin(), fetchFn: mkFetch(200, "desligado") })).motivo).toContain("Desligada no app");
});

test("nunca lança, mesmo sem janela ou sem rede", async () => {
  const r = await diagnosticarDigital({ win: null, fetchFn: null });
  expect(r.itens.length).toBeGreaterThan(5); expect(r.pronto).toBe(false);
  const semRede = await diagnosticarDigital({ win: mkWin(), fetchFn: jest.fn(async () => { throw new Error("x"); }) });
  expect(ach(semRede, "servidor").detalhe).toContain("Sem conexão");
});
