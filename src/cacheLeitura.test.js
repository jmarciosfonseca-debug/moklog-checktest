import fs from "fs";
import path from "path";

jest.mock("firebase/app", () => ({ initializeApp: jest.fn(() => ({ nome: "app" })), getApps: jest.fn(() => []) }));
jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(),
  initializeFirestore: jest.fn(),
  persistentLocalCache: jest.fn((o) => ({ cache: "persistente", ...o })),
  persistentSingleTabManager: jest.fn(() => ({ tab: "unica" })),
}));
import { getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";
import {
  CHAVE_LIGADO, CHAVE_QUARENTENA, CHAVE_LIMPAR, QUARENTENA_MS, LIMITE_LOCALSTORAGE,
  modoDeCache, iniciarFirestore, decidirLeitura, aplicarLeitura, limparCacheDoAparelho, vigiarFalha, ehFalhaDoFirestore, emQuarentena,
} from "./cacheLeitura";

const mem = (ini = {}) => { const d = { ...ini }; return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; }, key: (i) => Object.keys(d)[i] ?? null, get length() { return Object.keys(d).length; }, _d: d }; };
beforeEach(() => { persistentSingleTabManager.mockReturnValue({ tab: "unica" }); persistentLocalCache.mockImplementation((o) => ({ cache: "persistente", ...o })); });

describe("modo de cache na abertura", () => {
  test("padrão (sem marca) = memória, igual ao comportamento de hoje", () => {
    expect(modoDeCache(mem())).toBe("memoria");
    const r = iniciarFirestore({ st: mem(), app: {} });
    expect(r.modo).toBe("memoria");
    expect(initializeFirestore).not.toHaveBeenCalled();
    expect(getFirestore).toHaveBeenCalledTimes(1);
  });
  test("ligado: cache persistente de UMA aba só, nunca o de várias abas", () => {
    const r = iniciarFirestore({ st: mem({ [CHAVE_LIGADO]: "1" }), app: {} });
    expect(r).toEqual({ modo: "persistente", motivo: "" });
    expect(persistentSingleTabManager).toHaveBeenCalledTimes(1);
    expect(persistentLocalCache).toHaveBeenCalledWith({ tabManager: { tab: "unica" } });
    expect(initializeFirestore).toHaveBeenCalledTimes(1);
  });
  test("localStorage cheio demais: fica em memória e diz o motivo", () => {
    const st = mem({ [CHAVE_LIGADO]: "1", lixo: "x".repeat(LIMITE_LOCALSTORAGE + 10) });
    const r = iniciarFirestore({ st, app: {} });
    expect(r).toEqual({ modo: "memoria", motivo: "localStorage cheio" });
    expect(initializeFirestore).not.toHaveBeenCalled();
  });
  test("em quarentena: memória por 7 dias; depois pode voltar", () => {
    const agora = 1_700_000_000_000;
    const st = mem({ [CHAVE_LIGADO]: "1", [CHAVE_QUARENTENA]: String(agora - 1000) });
    expect(iniciarFirestore({ st, app: {}, agora })).toEqual({ modo: "memoria", motivo: "quarentena" });
    expect(emQuarentena(st, agora + QUARENTENA_MS + 1)).toBe(false);
    expect(modoDeCache(st, agora + QUARENTENA_MS + 1)).toBe("persistente");
  });
  test("falha ao iniciar o persistente: cai para memória, apaga a marca e não lança", () => {
    initializeFirestore.mockImplementationOnce(() => { throw new Error("já iniciado"); });
    const st = mem({ [CHAVE_LIGADO]: "1" });
    const r = iniciarFirestore({ st, app: {} });
    expect(r).toEqual({ modo: "memoria", motivo: "falha ao iniciar" });
    expect(st.getItem(CHAVE_LIGADO)).toBeNull();
    expect(getFirestore).toHaveBeenCalled();
  });
  test("sem localStorage (bloqueado): memória", () => {
    expect(iniciarFirestore({ st: null, app: {} }).modo).toBe("memoria");
    const quebrado = { getItem() { throw new Error("bloqueado"); }, length: 0 };
    expect(modoDeCache(quebrado)).toBe("memoria");
  });
});

describe("chave remota da leitura", () => {
  test("decidirLeitura: sem config não muda; sem bloco 'leitura' ou ativo=false desliga; só liga para perfil listado", () => {
    expect(decidirLeitura(null, "demo")).toBe("manter");
    expect(decidirLeitura({ ativo: true, perfis: ["demo"] }, "demo")).toBe("desligar");
    expect(decidirLeitura({ ativo: true, leitura: { ativo: false, perfis: ["demo"] } }, "demo")).toBe("desligar");
    expect(decidirLeitura({ ativo: false, leitura: { ativo: true, perfis: ["demo"] } }, "demo")).toBe("desligar"); // chave geral manda
    expect(decidirLeitura({ ativo: true, leitura: { ativo: true, perfis: ["demo"] } }, "demo")).toBe("ligar");
    expect(decidirLeitura({ ativo: true, leitura: { ativo: true, perfis: ["demo"] } }, "gerencial")).toBe("manter");
    expect(decidirLeitura({ ativo: true, leitura: { ativo: true, perfis: ["demo"] } }, null)).toBe("manter");
  });
  test("aplicar: liga a marca; desligar remove a marca e pede limpeza do cache do aparelho; quarentena impede ligar", () => {
    const cfgOn = { ativo: true, leitura: { ativo: true, perfis: ["demo"] } };
    const st = mem();
    expect(aplicarLeitura(cfgOn, "demo", st)).toBe("ligado");
    expect(st.getItem(CHAVE_LIGADO)).toBe("1");
    expect(aplicarLeitura({ ativo: true, leitura: { ativo: false } }, "demo", st)).toBe("desligado");
    expect(st.getItem(CHAVE_LIGADO)).toBeNull();
    expect(st.getItem(CHAVE_LIMPAR)).toBe("1");
    const q = mem({ [CHAVE_QUARENTENA]: String(Date.now()) });
    expect(aplicarLeitura(cfgOn, "demo", q)).toBe("quarentena");
    expect(q.getItem(CHAVE_LIGADO)).toBeNull();
    expect(aplicarLeitura(null, "demo", mem())).toBe("mantido");
  });
  test("o arquivo publicado começa com a leitura DESLIGADA e só para o testador", () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "offline-config.json"), "utf8"));
    expect(cfg.leitura.ativo).toBe(false);
    expect(cfg.leitura.perfis).toEqual(["demo"]);
  });
});

describe("trava automática", () => {
  test("reconhece o erro antigo do Firestore", () => {
    expect(ehFalhaDoFirestore("FIRESTORE (10.14.1) INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9)")).toBe(true);
    expect(ehFalhaDoFirestore("Network request failed")).toBe(false);
    expect(ehFalhaDoFirestore(undefined)).toBe(false);
  });
  test("o erro antigo (error ou promessa rejeitada) entra em quarentena, desliga e pede limpeza", () => {
    const handlers = {};
    const win = { addEventListener: (t, f) => { handlers[t] = f; }, removeEventListener: jest.fn() };
    const st = mem({ [CHAVE_LIGADO]: "1" });
    const aoFalhar = jest.fn();
    vigiarFalha({ win, st, agora: () => 1234, aoFalhar });
    handlers.error({ message: "outro erro qualquer" });
    expect(st.getItem(CHAVE_LIGADO)).toBe("1");
    handlers.unhandledrejection({ reason: new Error("FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state (ID: ve:-1)") });
    expect(st.getItem(CHAVE_LIGADO)).toBeNull();
    expect(st.getItem(CHAVE_QUARENTENA)).toBe("1234");
    expect(st.getItem(CHAVE_LIMPAR)).toBe("1");
    expect(aoFalhar).toHaveBeenCalledTimes(1);
  });
  test("limpar o cache do aparelho apaga só os bancos do Firestore e tira a marca de limpeza", async () => {
    const apagados = [];
    const idb = { databases: async () => [{ name: "firestore/[DEFAULT]/p/main" }, { name: "outro" }], deleteDatabase: (n) => { apagados.push(n); const r = {}; setTimeout(() => r.onsuccess && r.onsuccess(), 0); return r; } };
    const st = mem({ [CHAVE_LIMPAR]: "1" });
    expect(await limparCacheDoAparelho({ idb, st })).toBe(true);
    expect(apagados).toEqual(["firestore/[DEFAULT]/p/main"]);
    expect(st.getItem(CHAVE_LIMPAR)).toBeNull();
    expect(await limparCacheDoAparelho({ idb: null, st })).toBe(false);
  });
});

describe("ordem de carga", () => {
  test("firebaseInicio é importado logo depois do compat e antes do App", () => {
    const src = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
    expect(src.indexOf("./compat")).toBeLessThan(src.indexOf("./firebaseInicio"));
    expect(src.indexOf("./firebaseInicio")).toBeLessThan(src.indexOf("from './App'"));
  });
});
