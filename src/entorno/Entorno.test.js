// Entorno — tela do gestor e lista com filtros (02/11/2026).
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import EntornoLista, { filtrar } from "./EntornoLista";

const docs = {};
jest.mock("firebase/app", () => ({ getApps: () => [{}] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), doc: (_db, col, id) => `${col}/${id}`, getDoc: async (ref) => ({ exists: () => !!docs[ref], data: () => docs[ref] }) }));
const mockAuthFetch = jest.fn();
jest.mock("../session", () => ({ authFetch: (...a) => mockAuthFetch(...a) }));
jest.mock("../generatePDF", () => ({ MOKED_LOGO: "" }));
const Entorno = require("./Entorno").default;

const agora = new Date();
const d = (dias) => new Date(agora.getTime() - dias * 86400000).toISOString();
const ITENS = [
  { id: "a", tema: "seguranca", tipo: "roubo_carga", titulo: "Carga roubada na Anhanguera", link: "https://g1/a", fonte: "G1", data: d(2), cidade: "Cajamar", proximidade: "cidade", confianca: 90, resumo: "r" },
  { id: "b", tema: "seguranca", tipo: "furto", titulo: "Furto em galpão", link: "https://uol/b", fonte: "UOL", data: d(50), proximidade: "vizinha", confianca: 70 },
  { id: "c", tema: "mercado", tipo: "expansao", titulo: "Mercado Livre amplia CD em Cajamar", link: "https://r7/c", fonte: "R7", data: d(5), proximidade: "cidade", confianca: 85 },
];
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { mockAuthFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, mensagem: "Entorno atualizado para todos os parques." }) })); }); // CRA usa resetMocks
const clicar = async (el) => { expect(el).toBeTruthy(); await act(async () => el.dispatchEvent(new MouseEvent("click", { bubbles: true }))); };
const botao = (host, t) => [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === t || b.getAttribute("aria-label") === t);
const link = (host, t) => [...host.querySelectorAll("a")].find((a) => a.textContent.includes(t));

test("filtrar por tema, tipo e período", () => {
  expect(filtrar(ITENS, { dias: 30 }).map((i) => i.id)).toEqual(["a", "c"]);
  expect(filtrar(ITENS, { tema: "seguranca", dias: 90 }).map((i) => i.id)).toEqual(["a", "b"]);
  expect(filtrar(ITENS, { tipo: "expansao" }).map((i) => i.id)).toEqual(["c"]);
});

test("lista mostra as notícias com link para a fonte e filtra ao tocar nos botões", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<EntornoLista itens={ITENS} />));
    expect(host.textContent).toContain("3 notícias");
    expect(link(host, "Carga roubada").getAttribute("href")).toBe("https://g1/a");
    expect(link(host, "Carga roubada").getAttribute("target")).toBe("_blank");
    await clicar(botao(host, "Mercado logístico"));
    expect(host.textContent).toContain("1 notícia");
    expect(host.textContent).not.toContain("Carga roubada");
    await clicar(botao(host, "Tudo")); await clicar(botao(host, "30 dias"));
    expect(host.textContent).toContain("2 notícias");
    expect(host.textContent).toContain("Notícia não é boletim de ocorrência");
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("tela do gestor: cards por parque, abre um parque e 'Atualizar' chama o coletor com sessão gerencial", async () => {
  docs["entorno/P601"] = { itens: ITENS, atualizadoEm: d(0), resumo: { seguranca: { d30: 1, d60: 2, d90: 2, graves: 1, porTipo: { roubo_carga: 1, furto: 1 }, tendencia: "alta", anterior30: 0 }, mercado: { d30: 1, d90: 1 }, total: 3 }, ultimaColeta: { em: d(0), lidos: 40, candidatos: 5, aceitos: 3, erros: [] } };
  docs["entorno/_status"] = { ultimaEm: d(0) };
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<Entorno onBack={() => {}} />));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(botao(host, "Abrir entorno de Golgi Cajamar")).toBeTruthy();
    expect(botao(host, "Abrir entorno de Klog Guarulhos")).toBeTruthy();
    expect(host.textContent).toContain("Jatinox Unidade A");
    expect(host.textContent).toContain("Últimos 30 dias · todos os parques");
    await clicar(botao(host, "Abrir entorno de Golgi Cajamar"));
    expect(link(host, "Carga roubada")).toBeTruthy();
    expect(host.textContent).toContain("40 lidas · 3 novas");
    await clicar(botao(host, "Atualizar agora"));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(mockAuthFetch).toHaveBeenCalledWith("/api/entorno-coletar?pid=P601", { method: "POST" });
    expect(host.querySelector('[role="status"]').textContent).toContain("Entorno atualizado");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
