// Painel do projeto — tela e cartão de entrada (Fase 2).
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PainelProjeto from "./PainelProjeto";
import CartaoPainel from "./CartaoPainel";
import { calcularPainel } from "./regua";
import { DADOS_DEMO } from "./dados";
import { esquecerPainel } from "./carregar";

jest.mock("firebase/app", () => ({ initializeApp: () => ({}), getApps: () => [{}] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), doc: () => ({}), collection: () => ({}), getDoc: async () => ({ exists: () => false }), getDocs: async () => ({ docs: [] }), query: (r) => r, orderBy: () => ({}), limit: () => ({}) }));
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => esquecerPainel());

const montar = async (el) => { const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host); await act(async () => root.render(el)); await act(async () => { await new Promise((r) => setTimeout(r, 20)); }); return { host, fim: async () => { await act(async () => root.unmount()); host.remove(); } }; };
const resultado = (d = DADOS_DEMO) => ({ ...calcularPainel(d), calculadoEm: "2026-11-12T23:00:00.000Z" });

test("tela: nota, faixa, os 7 itens com pontos, detalhe ao tocar e as 3 ações", async () => {
  const carregar = jest.fn(async () => resultado());
  const { host, fim } = await montar(<PainelProjeto project={{ id: "P601", name: "Golgi Cajamar" }} carregar={carregar} onBack={() => {}} />);
  try {
    expect(carregar).toHaveBeenCalledWith(expect.objectContaining({ pid: "P601", forcar: false }));
    expect(host.querySelector("[data-testid='painel-nota']").textContent).toBe("90/100");
    expect(host.querySelector("[data-testid='painel-faixa']").textContent).toBe("Alerta");
    expect(host.querySelectorAll("[data-testid^='painel-item-']")).toHaveLength(7);
    const pend = host.querySelector("[data-testid='painel-item-pendencias']");
    expect(pend.textContent).toContain("12,5/15"); expect(pend.textContent).not.toContain("CF35");
    await act(async () => pend.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.querySelector("[data-testid='painel-item-pendencias']").textContent).toContain("06 - CFTV — CF35");
    expect(host.querySelectorAll(".ol-acao")).toHaveLength(3);
    expect(host.textContent).toContain("Intervalos registrados em 30 dias: 59");
    expect(host.querySelector("[data-testid='painel-travas']")).toBeNull();
  } finally { await fim(); }
});

test("tela: mostra a trava aplicada e por quê; item que não se aplica aparece sem pontos", async () => {
  const d = JSON.parse(JSON.stringify(DADOS_DEMO)); d.teste = { total: 200, inop: 0, parcial: 0, diasAtras: 12, ruins: [] }; d.pendencias = { totalItens: 200, lista: [] };
  d.mapa = { enviados: 60, esperados: 60 }; d.ronda = { aplica: false }; d.equipe = { ativos: 17, previsto: 17, faltas30: 0, turnover: 5 }; d.capacitacao = { ativos: 17, emDia: 17 };
  d.sistemas = { ctmk: { aplica: false }, key: { aplica: false }, perimetro: { aplica: false } }; d.eventos.energia.n30 = 0;
  const { host, fim } = await montar(<PainelProjeto project={{ id: "P505", name: "Klog" }} resultadoInicial={resultado(d)} onBack={() => {}} />);
  try {
    expect(host.querySelector("[data-testid='painel-nota']").textContent).toBe("100/100");
    expect(host.querySelector("[data-testid='painel-faixa']").textContent).toBe("Alerta");
    expect(host.querySelector("[data-testid='painel-travas']").textContent).toMatch(/Faixa limitada a Alerta.*Teste semanal há 12 dias/);
    expect(host.querySelector("[data-testid='painel-item-sistemas']").textContent).toContain("Não se aplica a este projeto.");
    expect(host.textContent).toContain("peso redistribuído");
  } finally { await fim(); }
});

test("cartão de entrada: nota e faixa no projeto com painel; 'disponível em breve' nos demais, sem ler nada", async () => {
  const carregar = jest.fn(async () => resultado()); const onAbrir = jest.fn();
  const a = await montar(<CartaoPainel project={{ id: "P601", name: "Golgi Cajamar" }} carregar={carregar} onAbrir={onAbrir} />);
  try {
    expect(a.host.textContent).toContain("Painel do projeto — nota 90 · Alerta");
    await act(async () => a.host.querySelector("[data-testid='cartao-painel']").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ nota: 90 }));
  } finally { await a.fim(); }
  for (const pid of ["P260B", "P939"]) {
    const c2 = jest.fn(); const b = await montar(<CartaoPainel project={{ id: pid, name: pid }} carregar={c2} onAbrir={onAbrir} />);
    try { expect(b.host.textContent).toContain("Painel disponível em breve."); expect(c2).not.toHaveBeenCalled(); expect(b.host.querySelector("button").disabled).toBe(true); } finally { await b.fim(); }
  }
});
