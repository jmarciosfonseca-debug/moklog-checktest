import React, { act } from "react";
import { createRoot } from "react-dom/client";
const mockGetDoc = jest.fn(), mockGetDocs = jest.fn();
jest.mock("firebase/app", () => ({ initializeApp: () => ({}), getApps: () => [{}] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), doc: (_d, col, id) => ({ p: `${col}/${id}` }), collection: (_d, ...a) => ({ p: a.join("/") }), query: (r) => r, orderBy: () => ({}), limit: () => ({}), getDoc: (...a) => mockGetDoc(...a), getDocs: (...a) => mockGetDocs(...a) }));
jest.mock("../lerServidor", () => ({ getDocsSeguro: async () => ({ forEach: () => {} }) }));
const mockCheckPin = jest.fn(); global.__escopo = null;
jest.mock("../session", () => ({ checkPin: (...a) => mockCheckPin(...a), clearSession: () => { global.__escopo = null; }, getClienteScope: () => global.__escopo }));
const PainelCliente = require("./PainelCliente").default;
const PROJECTS = { P601: { id: "P601", name: "Golgi Cajamar", categories: [{ id: "c1", type: "items", itemLabels: ["A", "B"] }] }, P602: { id: "P602", name: "Golgi Mauá I", categories: [{ id: "c1", type: "items", itemLabels: ["A"] }] } };
const health = (p, state) => { const arr = state.c1 || []; const inop = arr.filter((x) => x.status === "inop").length; return { total: arr.length, ok: arr.length - inop, partial: 0, inop, pct: Math.round(((arr.length - inop) / arr.length) * 100) }; };
const hoje = new Date().toLocaleDateString("sv-SE");
const stored = { P601: { history: [{ meta: { date: hoje }, state: { c1: [{ status: "ok" }, { status: "inop", note: "sem imagem" }] } }] }, P602: { history: [] } };
const equipe = { colaboradores: [{ id: "a", nome: "Ana Lima", cargo: "Vigilante", status: "ativo", dataContratacao: "2024-01-10", historico: [{ tipo: "Treinamento", data: "2026-09-24", detalhe: "Brigada" }] }, { id: "b", nome: "Bia Souza", cargo: "Líder", status: "ativo", historico: [] }], desligados: [] };
const mapas = [{ data: hoje, turno: "D", status: "enviado", postos: [{ rotulo: "P1", pessoaId: "a", pessoaNome: "Ana Lima", situacao: "presente" }, { rotulo: "P2", pessoaId: "b", pessoaNome: "Bia Souza", situacao: "falta" }] }];
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { global.__escopo = null; mockCheckPin.mockReset();
  mockGetDoc.mockImplementation(async (ref) => ({ exists: () => true, data: () => ref.p.startsWith("equipes/") ? equipe : { smartphones: [{ status: "ok" }, { status: "inop" }] } }));
  mockGetDocs.mockImplementation(async () => ({ docs: mapas.map((m) => ({ data: () => m })) })); });
const clicar = async (el) => { expect(el).toBeTruthy(); await act(async () => el.dispatchEvent(new MouseEvent("click", { bubbles: true }))); };
const botao = (host, t) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(t) || b.getAttribute("aria-label") === t);
const montar = async (host, root) => { await act(async () => root.render(<PainelCliente PROJECTS={PROJECTS} stored={stored} computeHealth={health} onBack={() => {}} />)); await act(async () => { await new Promise((r) => setTimeout(r, 20)); }); };

test("PIN de proprietário: macro do grupo → parque → detalhe do mapa com nome e situação", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  mockCheckPin.mockImplementation(async (_p, o) => { if (!o.cliente) return null; global.__escopo = { escopo: "GOLGI", pids: ["P601", "P602"] }; return "cliente"; });
  try {
    await montar(host, root);
    const input = host.querySelector('[aria-label="PIN do cliente"]');
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "1234"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await clicar(botao(host, "Entrar")); await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(mockCheckPin).toHaveBeenCalledWith("1234", { cliente: true });
    expect(host.textContent).toContain("Golgi · 2 parques");
    expect(host.textContent).toContain("Proprietário · visão macro");
    expect(host.textContent).toContain("2 faltas");                        // consolidado do dia (mock: mesmo mapa nos 2 parques)
    await clicar(botao(host, "Abrir Golgi Cajamar"));
    expect(host.textContent).toContain("Teste semanal"); expect(host.textContent).toContain("50%");
    expect(host.textContent).toContain("2 ativos");
    expect(host.textContent).toContain("Brigada");                          // último treinamento
    await clicar(botao(host, "Abrir mapa do dia"));
    expect(host.textContent).toContain("Bia Souza"); expect(host.textContent).toContain("Falta");
    await clicar(botao(host, "← Golgi Cajamar")); await clicar(botao(host, "Abrir pendências"));
    expect(host.textContent).toContain("INOPERANTE"); expect(host.textContent).toContain("sem imagem");
    await clicar(botao(host, "← Golgi Cajamar")); await clicar(botao(host, "← Meus parques"));
    expect(host.textContent).toContain("Golgi · 2 parques");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
test("PIN de gestor do parque: entra direto no parque, sem botão de macro; PIN errado avisa", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  mockCheckPin.mockResolvedValueOnce(null).mockImplementation(async () => { global.__escopo = { escopo: "P601", pids: ["P601"] }; return "cliente"; });
  try {
    await montar(host, root);
    await clicar(botao(host, "Entrar")); expect(host.textContent).toContain("PIN inválido");
    await clicar(botao(host, "Entrar")); await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(host.textContent).toContain("Gestor do parque");
    expect(host.textContent).toContain("Golgi Cajamar");
    expect(botao(host, "← Meus parques")).toBeUndefined();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
