import React, { act } from "react";
import { createRoot } from "react-dom/client";
import fs from "fs";
import path from "path";
import Entrada, { DIVISOES } from "./Entrada";
import { posicoes, ativoDe, maisProximo, girar, vetor } from "./esferaMotor";

// Contexto 2D de mentira: qualquer método existe e não faz nada (jsdom não desenha canvas).
const ctxFalso = () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ addColorStop() {} })), set: (o, k, v) => { o[k] = v; return true; } });
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
const clicar = async (el) => { expect(el).toBeTruthy(); await act(async () => el.dispatchEvent(new MouseEvent("click", { bubbles: true }))); };
const montar = async (props) => { const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host); await act(async () => root.render(<Entrada etapaInicial="areas" {...props} />)); return { host, fim: async () => { await act(async () => root.unmount()); host.remove(); } }; };

test("geometria: cada área centraliza no seu próprio ângulo e o giro escolhe a mais próxima do centro", () => {
  const pos = posicoes(6);
  pos.forEach((p, i) => { expect(ativoDe(pos, -p.lon, p.lat)).toBe(i); const v = girar(vetor(p.lon, p.lat), -p.lon, p.lat); expect(v[0]).toBeCloseTo(0, 6); expect(v[1]).toBeCloseTo(0, 6); expect(v[2]).toBeCloseTo(1, 6); });
  expect(ativoDe(pos, -pos[1].lon + 0.2, 0)).toBe(1); // um pouco fora do centro ainda é a mesma área
  expect(maisProximo(0, Math.PI * 2 - 0.1)).toBeCloseTo(Math.PI * 2, 6); // volta pelo caminho curto
});

test("com canvas: abre a esfera na MokLog; Acessar área chama o app; Área do Cliente também", async () => {
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(ctxFalso); jest.useFakeTimers();
  const esc = jest.fn(); const { host, fim } = await montar({ onEscolher: esc });
  try {
    const tela = host.querySelector('[data-testid="entrada-areas"]'); expect(tela.getAttribute("data-modo")).toBe("esfera");
    expect(host.textContent).toContain("Escolha a sua área"); expect(host.querySelector('[data-testid="esfera-nome"]').textContent).toBe("Mok Log");
    expect(host.querySelectorAll(".mk-esf-no").length).toBe(DIVISOES.length);
    await clicar(host.querySelector('[data-testid="esfera-acessar"]')); expect(esc).not.toHaveBeenCalled(); // primeiro a esfera some
    await act(async () => { jest.advanceTimersByTime(600); }); expect(esc).toHaveBeenLastCalledWith("moklog");
    await clicar(host.querySelector('[aria-label="Área do Cliente"]')); expect(esc).toHaveBeenLastCalledWith("cliente");
  } finally { await fim(); }
});

test("\"ver em lista\" mostra os cartões de sempre e \"ver em esfera\" volta", async () => {
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(ctxFalso);
  const { host, fim } = await montar({ onEscolher: jest.fn() });
  try {
    await clicar(host.querySelector('[data-testid="esfera-lista"]'));
    expect(host.querySelector('[data-testid="entrada-areas"]').getAttribute("data-modo")).toBeNull(); expect(host.querySelector('button[aria-label="MokVip"]')).not.toBeNull();
    await clicar(host.querySelector('[data-testid="voltar-esfera"]')); expect(host.querySelector('[data-testid="entrada-areas"]').getAttribute("data-modo")).toBe("esfera");
  } finally { await fim(); }
});

test("sem canvas 2D o aparelho cai nos cartões (nada quebra)", async () => {
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const { host, fim } = await montar({ onEscolher: jest.fn() });
  try { expect(host.querySelector('[data-testid="entrada-areas"]').getAttribute("data-modo")).toBeNull(); expect(host.querySelector('button[aria-label="MokLog"]')).not.toBeNull(); } finally { await fim(); }
});

test("toda divisão tem o seu cenário em public/moked/cenarios", () => {
  DIVISOES.forEach((d) => { const f = path.join(__dirname, "..", "..", "public", "moked", "cenarios", `${d.id}.jpg`); expect(fs.existsSync(f)).toBe(true); expect(fs.statSync(f).size).toBeLessThan(400 * 1024); });
});
