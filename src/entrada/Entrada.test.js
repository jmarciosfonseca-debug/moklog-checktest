import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Entrada from "./Entrada";
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null); }); // jsdom não desenha canvas: a abertura tolera isso
afterAll(() => { jest.restoreAllMocks(); });
beforeEach(() => { sessionStorage.clear(); });
const clicar = async (el) => { expect(el).toBeTruthy(); await act(async () => el.dispatchEvent(new MouseEvent("click", { bubbles: true }))); };
const botao = (host, t) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(t) || b.getAttribute("aria-label") === t);

test("logo → Entrar → vídeo (pulável) → escolha de área; MokLog e Área do Cliente chamam o app; outras divisões ficam em breve", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host); const esc = jest.fn();
  try {
    await act(async () => root.render(<Entrada onEscolher={esc} pularVideo={false} />));
    expect(host.querySelector('[data-testid="entrada-splash"]')).not.toBeNull();
    await clicar(botao(host, "Entrar"));
    expect(host.querySelector('[data-testid="entrada-video"] video')).not.toBeNull();
    await clicar(botao(host, "Pular"));
    expect(host.querySelector('[data-testid="entrada-areas"]')).not.toBeNull();
    expect(host.textContent).toContain("Escolha a sua área"); expect(host.textContent).toContain("Área do Cliente");
    expect(host.textContent).toContain("Em breve");
    await clicar(botao(host, "MokVip")); expect(host.querySelector('[data-testid="entrada-construcao"]')).not.toBeNull(); expect(host.textContent).toContain("Em construção"); expect(esc).not.toHaveBeenCalled();
    await clicar(botao(host, "Voltar")); expect(host.querySelector('[data-testid="entrada-areas"]')).not.toBeNull();
    await clicar(botao(host, "MokLog")); expect(esc).toHaveBeenLastCalledWith("moklog");
    await clicar(botao(host, "MokPat")); expect(esc).toHaveBeenLastCalledWith("mokpat"); // MokPat ativo (11/11/2026)
    await clicar(botao(host, "Área do Cliente")); expect(esc).toHaveBeenLastCalledWith("cliente");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
test("vídeo toca a cada entrada; se o navegador bloquear o autoplay, aparece o botão Tocar", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  const play = jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.reject(new Error("NotAllowed")));
  try {
    await act(async () => root.render(<Entrada onEscolher={() => {}} pularVideo={false} />));
    await clicar(botao(host, "Entrar"));
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(host.querySelector('[data-testid="entrada-video"]')).not.toBeNull();
    expect(botao(host, "Tocar vídeo")).toBeTruthy();
  } finally { play.mockRestore(); await act(async () => root.unmount()); host.remove(); }
});
test("por padrão o vídeo antigo NÃO toca: Entrar vai direto para a escolha de área", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<Entrada onEscolher={() => {}} />));
    await clicar(botao(host, "Entrar"));
    expect(host.querySelector('[data-testid="entrada-video"]')).toBeNull();
    expect(host.querySelector("video")).toBeNull();
    expect(host.querySelector('[data-testid="entrada-areas"]')).not.toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("etapaInicial='areas' (voltar de dentro de uma área) abre direto na escolha de área, sem passar por Entrar", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<Entrada onEscolher={() => {}} etapaInicial="areas" />));
    expect(host.querySelector('[data-testid="entrada-splash"]')).toBeNull();
    expect(host.querySelector('[data-testid="entrada-areas"]')).not.toBeNull();
    expect(host.textContent).toContain("Escolha a sua área");
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("abertura mostra a frase da marca e o mostrador decorativo", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<Entrada onEscolher={() => {}} />));
    expect(host.querySelector('[data-testid="entrada-frase"]').textContent).toMatch(/o software por trás do hardware/);
    expect(host.querySelector('[data-testid="mostrador-sis"]').className).toContain("scan");
    expect(botao(host, "Entrar")).toBeTruthy();
  } finally { act(() => root.unmount()); host.remove(); }
});

test("abertura do SIS toca quando pedida (frase → órbita) e Enter leva direto às Áreas", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<Entrada onEscolher={() => {}} comAbertura />));
    const ab = host.querySelector('[data-testid="entrada-abertura"]');
    expect(ab).not.toBeNull();
    expect(host.querySelector('[data-testid="entrada-splash"]')).toBeNull();
    const sr = ab.shadowRoot; expect(sr).not.toBeNull(); // a abertura vive num Shadow DOM (estilo isolado do app)
    expect(sr.querySelectorAll("[data-no]").length).toBe(11); // componentes do SIS, não as divisões
    expect(sr.textContent).toMatch(/Sistema Integrado de Segurança/);
    expect(botao(host, "Entrar")).toBeFalsy(); // o botão "Entrar" da órbita fica dentro da abertura, não no app
    expect(sr.querySelector(".sis-ign .sis-frase").textContent).toBe("o softwarepor trásdo hardware"); // a frase da marca abre a sequência
    await act(async () => { ab.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await new Promise((r) => setTimeout(r, 700)); });
    expect(host.querySelector('[data-testid="entrada-abertura"]')).toBeNull();
    expect(host.querySelector('[data-testid="entrada-areas"]')).not.toBeNull();
  } finally { act(() => root.unmount()); host.remove(); }
});

test("sem abertura pedida (voltou logo / Áreas) não toca a abertura", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<Entrada onEscolher={() => {}} etapaInicial="areas" />));
    expect(host.querySelector('[data-testid="entrada-abertura"]')).toBeNull();
    expect(host.querySelector('[data-testid="entrada-areas"]')).not.toBeNull();
  } finally { act(() => root.unmount()); host.remove(); }
});

test("Áreas: botão discreto 'voltar à abertura' reabre a abertura e, ao tocar, volta às Áreas", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<Entrada onEscolher={() => {}} etapaInicial="areas" />));
    const b = host.querySelector('[data-testid="voltar-abertura"]');
    expect(b).not.toBeNull();
    expect(b.textContent).toContain("voltar à abertura");
    expect(Number(b.style.opacity)).toBeLessThan(0.6); // discreto, meio transparente
    await act(async () => b.click());
    const ab = host.querySelector('[data-testid="entrada-abertura"]');
    expect(ab).not.toBeNull();
    await act(async () => { ab.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await new Promise((r) => setTimeout(r, 700)); });
    expect(host.querySelector('[data-testid="entrada-areas"]')).not.toBeNull();
  } finally { act(() => root.unmount()); host.remove(); }
});
