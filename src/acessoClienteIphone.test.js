// Marcio, 16/11/2026: cliente do P311 com PIN certo não entrava (digitava na porta da divisão) e iPhones antigos não abriam o app.
import fs from "fs";
import path from "path";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { checkPin, checkPinPorta, checkPinAnyProject, getClienteScope, getAccess, clearSession } from "./session";
import PinMoklog from "./entrada/PinMoklog";
import { tratarDisciplinar } from "./relatorios/ccoRelatorio";

global.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { clearSession(); global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); delete global.fetch; });
const cliente = () => ({ ok: true, status: 200, json: async () => ({ ok: true, nivel: "cliente", escopo: "MEGA", pids: ["P311A", "P311B"], token: "synthetic-token", exp: Date.now() + 8 * 3600000 }) });

describe("PIN de cliente na porta da divisão", () => {
  test("a porta aceita o PIN de cliente e devolve level cliente, com o escopo dele", async () => {
    fetch.mockResolvedValue(cliente());
    expect(await checkPinPorta("synthetic-pin")).toEqual({ level: "cliente", projectId: null });
    expect(getClienteScope()).toEqual({ escopo: "MEGA", pids: ["P311A", "P311B"] });
    expect(getAccess("P311A")).toBeNull(); // cliente nunca vira líder nem gerencial
    expect(fetch).toHaveBeenCalledTimes(1); // um pedido só: PIN errado não gasta tentativa em dobro
  });
  test("as demais telas de PIN do app continuam recusando cliente", async () => {
    fetch.mockResolvedValue(cliente());
    expect(await checkPin("synthetic-pin")).toBeNull();
    expect(await checkPinAnyProject("synthetic-pin")).toBeNull();
    expect(getClienteScope()).toBeNull();
  });
  test("tela: PIN de cliente chama onEntrar com level cliente; erro do servidor aparece com o motivo real", async () => {
    const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
    const onEntrar = jest.fn();
    await act(async () => root.render(<PinMoklog onEntrar={onEntrar} onVoltar={() => {}} />));
    const input = host.querySelector('input[aria-label="PIN MokLog"]');
    const digitar = async (v) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, v); input.dispatchEvent(new Event("input", { bubbles: true })); });
    const entrar = async () => { await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Entrar").click()); await act(async () => { await Promise.resolve(); }); };
    fetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({ ok: false, erro: "Limite de tentativas. Aguarde 15 minutos." }) });
    await digitar("000"); await entrar();
    expect(host.querySelector('[role="alert"]').textContent).toBe("Limite de tentativas. Aguarde 15 minutos.");
    expect(onEntrar).not.toHaveBeenCalled();
    fetch.mockResolvedValue(cliente());
    await digitar("311"); await entrar();
    expect(onEntrar).toHaveBeenCalledWith({ level: "cliente", projectId: null });
    await act(async () => root.unmount()); host.remove();
  });
  test("relógio do aparelho adiantado: mensagem própria em vez de 'PIN inválido'", async () => {
    let motivo = ""; const ouvir = (e) => { motivo = e.detail; };
    window.addEventListener("moklog-auth-error", ouvir);
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, nivel: "cliente", escopo: "MEGA", pids: ["P311A"], token: "t", exp: Date.now() - 1000 }) });
    expect(await checkPin("synthetic-pin", { cliente: true })).toBeNull();
    window.removeEventListener("moklog-auth-error", ouvir);
    expect(motivo).toContain("data e a hora deste aparelho");
  });
});

describe("compatibilidade com iPhone antigo", () => {
  const listar = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listar(path.join(dir, e.name)) : /\.(js|jsx)$/.test(e.name) && !/\.test\.js$/.test(e.name) ? [path.join(dir, e.name)] : []));
  test("nenhum arquivo do app usa regex com lookbehind (quebra o Safari anterior ao iOS 16.4 e o app não abre)", () => {
    const comLookbehind = listar(__dirname).filter((f) => /\(\?<[=!]/.test(fs.readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n")));
    expect(comLookbehind.map((f) => path.relative(__dirname, f))).toEqual([]);
  });
  test("a separação de frases sem lookbehind dá o mesmo resultado", () => {
    const t = "Ronda normal. Aplicada advertência verbal ao posto 2! Sem mais; fim\nNova linha.";
    expect(tratarDisciplinar(t, { interno: false, modo: "A" })).toEqual({ texto: "Ronda normal. [trecho de uso interno omitido] Sem mais; fim Nova linha.", omitidos: 1, oculto: false });
    expect(tratarDisciplinar("Sem pontuação", { interno: false, modo: "A" }).texto).toBe("Sem pontuação");
  });
  test("o complemento de compatibilidade cobre Array.at, String.at e randomUUID quando faltam", () => {
    const at = Array.prototype.at, sat = String.prototype.at, uuid = globalThis.crypto && globalThis.crypto.randomUUID;
    try {
      delete Array.prototype.at; delete String.prototype.at;
      if (globalThis.crypto) Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true, writable: true });
      jest.isolateModules(() => { require("./compat"); });
      expect([1, 2, 3].at(-1)).toBe(3); expect([1, 2, 3].at(0)).toBe(1); expect([].at(-1)).toBeUndefined();
      expect("abc".at(-1)).toBe("c");
      if (globalThis.crypto && globalThis.crypto.getRandomValues) expect(globalThis.crypto.randomUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Array.prototype.at = at; String.prototype.at = sat; // eslint-disable-line no-extend-native
      if (globalThis.crypto && uuid) Object.defineProperty(globalThis.crypto, "randomUUID", { value: uuid, configurable: true, writable: true });
    }
  });
});
