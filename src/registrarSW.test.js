import fs from "fs";
import path from "path";
import { decidir, lerConfig, desligar, iniciarOffline, _reiniciarSW } from "./registrarSW";
import { mostrarAvisoVersao } from "./avisoVersao";

beforeEach(() => { _reiniciarSW(); document.body.innerHTML = ""; });

const resp = (j, ok = true) => ({ ok, json: async () => j });
const fetchCom = (j, ok = true) => jest.fn().mockResolvedValue(resp(j, ok));

describe("chave remota", () => {
  test("decidir: sem config não muda nada; ativo=false desliga; ligar só para perfil permitido", () => {
    expect(decidir(null, "demo")).toBe("manter");
    expect(decidir({ ativo: false, perfis: ["demo"] }, "demo")).toBe("desligar");
    expect(decidir({ ativo: true, perfis: ["demo"] }, "demo")).toBe("ligar");
    expect(decidir({ ativo: true, perfis: ["demo"] }, "gerencial")).toBe("manter");
    expect(decidir({ ativo: true, perfis: ["demo"] }, null)).toBe("manter");
    expect(decidir({ ativo: true, perfis: ["todos"] }, "equipe")).toBe("ligar");
    expect(decidir({ ativo: "sim", perfis: ["demo"] }, "demo")).toBe("manter");
  });
  test("lerConfig: erro de rede, resposta ruim ou JSON ruim viram null (nunca lança)", async () => {
    expect(await lerConfig(jest.fn().mockRejectedValue(new Error("offline")))).toBeNull();
    expect(await lerConfig(fetchCom({}, false))).toBeNull();
    expect(await lerConfig(jest.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error("x"); } }))).toBeNull();
    expect(await lerConfig(fetchCom({ ativo: true }))).toEqual({ ativo: true });
  });
  test("o arquivo publicado começa DESLIGADO e só para o testador", () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "offline-config.json"), "utf8"));
    expect(cfg.ativo).toBe(false);
    expect(cfg.perfis).toEqual(["demo"]);
  });
});

describe("desligar e iniciar", () => {
  test("desligar desregistra e apaga só os caches mk-", async () => {
    const unreg = jest.fn().mockResolvedValue(true);
    const cacheApi = { keys: async () => ["mk-shell-1", "mk-assets-1", "outro"], delete: jest.fn().mockResolvedValue(true) };
    await desligar({ nav: { serviceWorker: { getRegistrations: async () => [{ unregister: unreg }] } }, cacheApi });
    expect(unreg).toHaveBeenCalledTimes(1);
    expect(cacheApi.delete.mock.calls.map((c) => c[0])).toEqual(["mk-shell-1", "mk-assets-1"]);
  });
  test("navegador sem service worker: indisponível, sem erro", async () => {
    expect(await iniciarOffline({ nav: {}, fetchFn: fetchCom({ ativo: true, perfis: ["demo"] }) })).toBe("indisponivel");
  });
  test("sem conseguir ler a chave: mantém (não liga nem desliga)", async () => {
    const register = jest.fn(); const getRegistrations = jest.fn();
    const r = await iniciarOffline({ perfil: "demo", nav: { serviceWorker: { register, getRegistrations } }, fetchFn: jest.fn().mockRejectedValue(new Error("x")) });
    expect(r).toBe("mantido"); expect(register).not.toHaveBeenCalled(); expect(getRegistrations).not.toHaveBeenCalled();
  });
  test("ativo=false desliga mesmo antes do login (perfil null)", async () => {
    const unreg = jest.fn().mockResolvedValue(true);
    const nav = { serviceWorker: { getRegistrations: async () => [{ unregister: unreg }] } };
    const r = await iniciarOffline({ perfil: null, nav, fetchFn: fetchCom({ ativo: false }), cacheApi: { keys: async () => [], delete: jest.fn() } });
    expect(r).toBe("desligado"); expect(unreg).toHaveBeenCalled();
  });
  test("perfil não permitido: não registra", async () => {
    const register = jest.fn();
    expect(await iniciarOffline({ perfil: "gerencial", nav: { serviceWorker: { register } }, fetchFn: fetchCom({ ativo: true, perfis: ["demo"] }) })).toBe("mantido");
    expect(register).not.toHaveBeenCalled();
  });
  test("perfil permitido registra uma vez só; versão nova espera o usuário e só então troca e recarrega", async () => {
    const ouvintes = {}; const waiting = { postMessage: jest.fn() };
    const reg = { waiting, installing: null, addEventListener: (e, f) => { ouvintes[e] = f; }, update: jest.fn().mockResolvedValue() };
    const sw = { controller: {}, register: jest.fn().mockResolvedValue(reg), addEventListener: jest.fn((e, f) => { ouvintes["sw:" + e] = f; }) };
    const win = { location: { reload: jest.fn() }, document: { addEventListener: jest.fn(), visibilityState: "visible" } };
    const onAtualizacao = jest.fn();
    const args = { perfil: "demo", nav: { serviceWorker: sw }, win, fetchFn: fetchCom({ ativo: true, perfis: ["demo"] }), onAtualizacao };
    expect(await iniciarOffline(args)).toBe("ligado");
    expect(await iniciarOffline(args)).toBe("ligado");
    expect(sw.register).toHaveBeenCalledTimes(1);
    expect(onAtualizacao).toHaveBeenCalledTimes(1);               // já havia versão esperando
    expect(waiting.postMessage).not.toHaveBeenCalled();           // nada acontece sozinho
    onAtualizacao.mock.calls[0][0].aplicar();
    expect(waiting.postMessage).toHaveBeenCalledWith({ tipo: "PULAR_ESPERA" });
    ouvintes["sw:controllerchange"]();
    expect(win.location.reload).toHaveBeenCalledTimes(1);
  });
  test("primeira instalação (sem controller) não oferece atualização", async () => {
    const reg = { waiting: { postMessage() {} }, addEventListener() {}, update: jest.fn() };
    const sw = { controller: null, register: jest.fn().mockResolvedValue(reg), addEventListener() {} };
    const onAtualizacao = jest.fn();
    await iniciarOffline({ perfil: "demo", nav: { serviceWorker: sw }, win: { document: { addEventListener() {} } }, fetchFn: fetchCom({ ativo: true, perfis: ["demo"] }), onAtualizacao });
    expect(onAtualizacao).not.toHaveBeenCalled();
  });
  test("falha ao registrar não derruba e permite tentar de novo", async () => {
    const sw = { register: jest.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue({ addEventListener() {}, update() {} }), addEventListener() {} };
    const args = { perfil: "demo", nav: { serviceWorker: sw }, win: { document: { addEventListener() {} } }, fetchFn: fetchCom({ ativo: true, perfis: ["demo"] }) };
    expect(await iniciarOffline(args)).toBe("erro");
    expect(await iniciarOffline(args)).toBe("ligado");
  });
});

describe("faixa de nova versão", () => {
  test("aparece uma vez, 'Depois' some, 'Atualizar' chama aplicar", () => {
    const aplicar = jest.fn();
    expect(mostrarAvisoVersao({ aplicar })).not.toBeNull();
    expect(mostrarAvisoVersao({ aplicar })).toBeNull();
    const botoes = [...document.querySelectorAll("#mk-aviso-versao button")];
    botoes.find((b) => b.textContent === "Atualizar").click();
    expect(aplicar).toHaveBeenCalledTimes(1);
    botoes.find((b) => b.textContent === "Depois").click();
    expect(document.getElementById("mk-aviso-versao")).toBeNull();
  });
});

describe("arquivo do service worker", () => {
  const sw = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");
  test("não se ativa sozinho (sem skipWaiting no install) e só pula a espera por mensagem", () => {
    const install = sw.slice(sw.indexOf('addEventListener("install"'), sw.indexOf('addEventListener("activate"'));
    expect(install).not.toMatch(/skipWaiting/);
    expect(sw).toMatch(/PULAR_ESPERA/);
    expect(sw).not.toMatch(/clients\.claim/);
  });
  test("nunca intercepta API, outros domínios nem não-GET; tem marcador de versão", () => {
    expect(sw).toMatch(/\/api\//);
    expect(sw).toMatch(/url\.origin !== self\.location\.origin/);
    expect(sw).toMatch(/req\.method !== "GET"/);
    expect(sw).toContain("__BUILD_ID__");
  });
});
