import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Entrada from "./Entrada";
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { sessionStorage.clear(); });
const clicar = async (el) => { expect(el).toBeTruthy(); await act(async () => el.dispatchEvent(new MouseEvent("click", { bubbles: true }))); };
const botao = (host, t) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(t) || b.getAttribute("aria-label") === t);

test("logo → Entrar → vídeo (pulável) → escolha de área; MokLog e Área do Cliente chamam o app; outras divisões ficam em breve", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host); const esc = jest.fn();
  try {
    await act(async () => root.render(<Entrada onEscolher={esc} />));
    expect(host.querySelector('[data-testid="entrada-splash"]')).not.toBeNull();
    await clicar(botao(host, "Entrar"));
    expect(host.querySelector('[data-testid="entrada-video"] video')).not.toBeNull();
    await clicar(botao(host, "Pular"));
    expect(host.querySelector('[data-testid="entrada-areas"]')).not.toBeNull();
    expect(host.textContent).toContain("Escolha a sua área"); expect(host.textContent).toContain("Área do Cliente");
    expect(botao(host, "MokPat").disabled).toBe(true); expect(host.textContent).toContain("Em breve");
    await clicar(botao(host, "MokLog")); expect(esc).toHaveBeenLastCalledWith("moklog");
    await clicar(botao(host, "Área do Cliente")); expect(esc).toHaveBeenLastCalledWith("cliente");
    expect(sessionStorage.getItem("moked_intro_visto_v1")).toBe("1");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
test("vídeo só uma vez por sessão: na segunda entrada vai direto às áreas", async () => {
  sessionStorage.setItem("moked_intro_visto_v1", "1");
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<Entrada onEscolher={() => {}} />));
    await clicar(botao(host, "Entrar"));
    expect(host.querySelector('[data-testid="entrada-areas"]')).not.toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
