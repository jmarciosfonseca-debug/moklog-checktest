import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { TextEncoder as TE } from "util";
import {
  paraB64u, deB64u, lerConfigDigital, digitalLiberada, cadastrarDigital, entrarComDigital, devePerguntarCadastro, adiarCadastro, naoPerguntarMais, marcarTeste,
  K_ID, K_TESTE, K_NAO, K_ADIADO,
} from "./digital";
import BotaoDigital from "./BotaoDigital";
import OfertaDigital from "./OfertaDigital";

global.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof global.TextEncoder === "undefined") global.TextEncoder = TE;

const resp = (j, status = 200) => ({ ok: status < 400, status, json: async () => j });
const fetchSeq = (...rs) => { const f = jest.fn(); rs.forEach((r) => f.mockResolvedValueOnce(r)); return f; };
const buf = (...n) => new Uint8Array(n).buffer;
const winCom = (credentials, extra = {}) => { window.localStorage.clear(); return { localStorage: window.localStorage, navigator: { credentials, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)" }, PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable: async () => true }, location: { search: "" }, ...extra }; };

beforeEach(() => { window.localStorage.clear(); });

describe("base64url", () => {
  test("ida e volta", () => {
    const x = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    expect(Array.from(deB64u(paraB64u(x)))).toEqual(Array.from(x));
    expect(paraB64u(x)).not.toMatch(/[+/=]/);
  });
});

describe("liberação (chave remota + marca de teste + suporte)", () => {
  test("config ausente, ruim ou fora do ar = desligado", async () => {
    expect(await lerConfigDigital(jest.fn().mockRejectedValue(new Error("x")))).toEqual({ modo: "desligado" });
    expect(await lerConfigDigital(fetchSeq(resp({ modo: "qualquer" })))).toEqual({ modo: "desligado" });
    expect(await lerConfigDigital(fetchSeq(resp({}, 500)))).toEqual({ modo: "desligado" });
  });
  test("o arquivo publicado nunca está em \"ligado\" sem decisão (desligado ou teste)", () => {
    const cfg = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "..", "public", "digital-config.json"), "utf8"));
    expect(["desligado", "teste"]).toContain(cfg.modo);
  });
  test("desligado nunca libera; teste só com a marca do aparelho; ligado precisa de suporte", async () => {
    const win = winCom({});
    expect(await digitalLiberada({ win, config: { modo: "desligado" } })).toBe(false);
    expect(await digitalLiberada({ win, config: { modo: "teste" } })).toBe(false);
    win.localStorage.setItem(K_TESTE, "1");
    expect(await digitalLiberada({ win, config: { modo: "teste" } })).toBe(true);
    const sem = winCom({}, { PublicKeyCredential: undefined });
    expect(await digitalLiberada({ win: sem, config: { modo: "ligado" } })).toBe(false);
    expect(await digitalLiberada({ win: winCom({}), config: { modo: "ligado" } })).toBe(true);
  });
  test("?digital=1 marca o aparelho e ?digital=0 desmarca", () => {
    const win = winCom({}, { location: { search: "?digital=1" } });
    marcarTeste(win); expect(win.localStorage.getItem(K_TESTE)).toBe("1");
    win.location.search = "?digital=0"; marcarTeste(win); expect(win.localStorage.getItem(K_TESTE)).toBeNull();
  });
});

describe("oferta de cadastro", () => {
  test("pergunta até cadastrar, adiar (7 dias) ou marcar aparelho compartilhado", () => {
    const win = winCom({});
    expect(devePerguntarCadastro(win, 1000)).toBe(true);
    adiarCadastro(win, 1000);
    expect(devePerguntarCadastro(win, 1000 + 86400000)).toBe(false);
    expect(devePerguntarCadastro(win, 1000 + 8 * 86400000)).toBe(true);
    win.localStorage.removeItem(K_ADIADO);
    naoPerguntarMais(win);
    expect(win.localStorage.getItem(K_NAO)).toBe("1");
    expect(devePerguntarCadastro(win, 9e12)).toBe(false);
    win.localStorage.removeItem(K_NAO); win.localStorage.setItem(K_ID, "abc");
    expect(devePerguntarCadastro(win)).toBe(false);
  });
});

describe("cadastrar e entrar (aparelho simulado)", () => {
  const criado = { rawId: buf(1, 2, 3), response: { clientDataJSON: buf(9), getAuthenticatorData: () => buf(8), getPublicKey: () => buf(7), getPublicKeyAlgorithm: () => -7 } };
  test("cadastro guarda só o id da credencial e manda a chave pública", async () => {
    const create = jest.fn().mockResolvedValue(criado);
    const win = winCom({ create });
    const f = fetchSeq(resp({ ok: true, desafio: "registro.x.1.y", rp: { id: "h", name: "MokLog" }, usuario: { id: "AQID", nome: "admin", nomeExibicao: "MokLog" }, algoritmos: [-7, -257], timeout: 60000 }), resp({ ok: true, id: "AQID", rotulo: "iPhone" }));
    const r = await cadastrarDigital({ token: "t.k", win, fetchFn: f });
    expect(r).toEqual({ ok: true, id: "AQID" });
    expect(win.localStorage.getItem(K_ID)).toBe("AQID");
    const opts = create.mock.calls[0][0].publicKey;
    expect(opts.authenticatorSelection).toMatchObject({ authenticatorAttachment: "platform", userVerification: "required" });
    const enviado = JSON.parse(f.mock.calls[1][1].body);
    expect(enviado).toMatchObject({ acao: "registrar", credentialId: "AQID", alg: -7, rotulo: "iPhone" });
    expect(f.mock.calls[1][1].headers.Authorization).toBe("Bearer t.k");
  });
  test("cancelar no aparelho não é erro; navegador sem suporte avisa e não cadastra", async () => {
    const f = fetchSeq(resp({ ok: true, desafio: "d", rp: {}, usuario: { id: "AQ", nome: "a", nomeExibicao: "b" }, algoritmos: [-7], timeout: 1 }));
    const nao = Object.assign(new Error("x"), { name: "NotAllowedError" });
    const r = await cadastrarDigital({ token: "t.k", win: winCom({ create: jest.fn().mockRejectedValue(nao) }), fetchFn: f });
    expect(r).toMatchObject({ ok: false, cancelado: true });
    const f2 = fetchSeq(resp({ ok: true, desafio: "d", rp: {}, usuario: { id: "AQ", nome: "a", nomeExibicao: "b" }, algoritmos: [-7], timeout: 1 }));
    const velho = { rawId: buf(1), response: { clientDataJSON: buf(1) } };
    const win = winCom({ create: jest.fn().mockResolvedValue(velho) });
    expect((await cadastrarDigital({ token: "t.k", win, fetchFn: f2 })).ok).toBe(false);
    expect(win.localStorage.getItem(K_ID)).toBeNull();
  });
  test("servidor indisponível no cadastro: mensagem e nada guardado", async () => {
    const win = winCom({ create: jest.fn() });
    const r = await cadastrarDigital({ token: "t.k", win, fetchFn: fetchSeq(resp({ ok: false, erro: "Entrada por digital indisponível." }, 503)) });
    expect(r).toMatchObject({ ok: false, erro: "Entrada por digital indisponível." });
    expect(win.navigator.credentials.create).not.toHaveBeenCalled();
  });
  test("entrar devolve a resposta do servidor; sem id, bloqueio e cancelamento tratados", async () => {
    const get = jest.fn().mockResolvedValue({ response: { clientDataJSON: buf(1), authenticatorData: buf(2), signature: buf(3) } });
    const win = winCom({ get }); win.localStorage.setItem(K_ID, "AQID");
    const f = fetchSeq(resp({ ok: true, rpId: "h", desafio: "login.x.1.y", timeout: 1 }), resp({ ok: true, token: "t.k", nivel: "admin", exp: 9e12 }));
    const r = await entrarComDigital({ win, fetchFn: f });
    expect(r.ok).toBe(true);
    expect(r.dados).toMatchObject({ ok: true, token: "t.k", nivel: "admin" });
    expect(get.mock.calls[0][0].publicKey).toMatchObject({ rpId: "h", userVerification: "required" });
    expect((await entrarComDigital({ win: winCom({ get }), fetchFn: jest.fn() })).ok).toBe(false); // sem id
    const w2 = winCom({ get }); w2.localStorage.setItem(K_ID, "AQID");
    const b = await entrarComDigital({ win: w2, fetchFn: fetchSeq(resp({ ok: false, erro: "Limite de tentativas. Aguarde 15 minutos." }, 429)) });
    expect(b).toMatchObject({ ok: false, bloqueado: true });
    const w3 = winCom({ get: jest.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "NotAllowedError" })) }); w3.localStorage.setItem(K_ID, "AQID");
    expect(await entrarComDigital({ win: w3, fetchFn: fetchSeq(resp({ ok: true, rpId: "h", desafio: "d", timeout: 1 })) })).toMatchObject({ ok: false, cancelado: true, erro: "" });
  });
});

describe("telas: invisíveis quando desligado", () => {
  const cfg = (modo) => { global.fetch = jest.fn().mockResolvedValue(resp({ modo })); };
  let host, root;
  beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); delete global.fetch; });
  const montar = (el) => act(async () => { root.render(el); await new Promise((r) => setTimeout(r, 30)); });
  test("botão não aparece com a chave desligada, mesmo com digital cadastrada", async () => {
    window.localStorage.setItem(K_ID, "AQID"); cfg("desligado");
    await montar(<BotaoDigital onSucesso={() => {}} />);
    expect(host.querySelector('[data-testid="entrar-digital"]')).toBeNull();
  });
  test("oferta não aparece sem sessão (nem para líder, equipe, CCO ou demo, que nunca têm sessão elegível)", async () => {
    cfg("ligado");
    await montar(<OfertaDigital />);
    expect(host.innerHTML).toBe("");
  });
});
