// Fluxo real da tela: primeira gravação sem ler antes, rascunho local protegido se falhar, sai só depois de gravar.
import React, { act } from "react";
import { createRoot } from "react-dom/client";

global.IS_REACT_ACT_ENVIRONMENT = true;
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockGetDocs = jest.fn();
jest.mock("firebase/firestore", () => ({
  collection: (...a) => ({ _col: a.map((x) => (x && x._doc) || (x && x._col) || x).join("/") }),
  doc: (...a) => ({ _doc: a.map((x) => (x && (x._doc || x._col)) || x).filter((x) => typeof x === "string").join("/") }),
  getDoc: (...a) => mockGetDoc(...a),
  getDocs: (...a) => mockGetDocs(...a),
  setDoc: (...a) => mockSetDoc(...a),
  updateDoc: jest.fn(),
  orderBy: jest.fn(),
  query: (...a) => ({ _q: a }),
  where: (...a) => ({ _w: a }),
  serverTimestamp: jest.fn(),
}));
jest.mock("firebase/auth", () => ({ onAuthStateChanged: (auth, cb) => { cb(auth.currentUser); return () => {}; }, signInWithEmailAndPassword: jest.fn() }));
jest.mock("../single/singleStore", () => ({ criarStore: () => ({}) }));
jest.mock("../single/SingleApp", () => () => null);

import DiagnosticoSituacional from "./DiagnosticoSituacional";
import { CATALOGO_REF } from "./catalogoSchema";

const catalogo = { status: "publicado", seedCompleto: true, versao: CATALOGO_REF.versao, perfil: "centro_logistico", categorias: [{ id: "D01", nome: "Perímetro", ordem: 1 }], subcategorias: [{ id: "D01.01", categoria: "D01", nome: "Muros", ordem: 1 }] };
const itensDocs = [{ id: "D01.01.01", data: () => ({ subcategoria: "D01.01", texto: "Muro íntegro", criticidade: "critico", ordem: 1 }) }];
const snap = (id, data, existe = true) => ({ exists: () => existe, data: () => data, id });

let host, root;
const auth = { currentUser: { uid: "u1", isAnonymous: false } };
beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockGetDoc.mockImplementation(async (ref) => {
    if (ref._doc === "usuarios/u1") return snap("u1", { active: true, role: "gerente" });
    if (ref._doc === `catalogos_diagnostico/${CATALOGO_REF.catalogoId}`) return snap("c", catalogo);
    throw new Error("getDoc inesperado: " + ref._doc); // ler diagnóstico inexistente = negado pelas regras
  });
  mockGetDocs.mockImplementation(async (q) => {
    const col = (q._q && q._q[0] && q._q[0]._col) || (q._col || "");
    if (String(col).includes("itens") && String(col).startsWith("catalogos_diagnostico")) return { docs: itensDocs };
    return { docs: [] };
  });
  mockSetDoc.mockResolvedValue();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const botao = (t) => [...host.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(t));
const clicar = async (el) => act(async () => el.click());
const montar = async () => {
  await act(async () => root.render(<DiagnosticoSituacional auth={auth} db={{}} dark onBack={() => {}} projects={{ P607: { name: "Golgi" } }} projectGroups={{ golgi: ["P607"] }} />));
  for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
};

test("primeira gravação do P607: grava sem ler o documento antes e remove o rascunho local só depois", async () => {
  await montar();
  await clicar(botao("P607"));
  await act(async () => { await Promise.resolve(); });
  await clicar(botao("CConforme")); // marca o item
  await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  const chaveLocal = Object.keys(window.localStorage).find((k) => k.endsWith(":P607"));
  expect(chaveLocal).toBeTruthy(); // rascunho do aparelho existe antes de salvar
  await clicar(botao("Salvar diagnóstico"));
  await act(async () => { await Promise.resolve(); });
  expect(mockSetDoc).toHaveBeenCalledTimes(1);
  const [ref, payload] = mockSetDoc.mock.calls[0];
  expect(ref._doc).toMatch(/^diagnosticos\/P607\/itens\//);
  expect(payload).toMatchObject({ tipo: "existente", projetoRef: "P607", estado: "rascunho", autorUid: "u1" });
  expect(payload.respostas["D01.01.01"].status).toBe("conforme");
  expect(mockGetDoc.mock.calls.some((c) => String(c[0]._doc).startsWith("diagnosticos/"))).toBe(false);
  expect(host.textContent).toContain("Diagnóstico salvo no Firestore");
  expect(window.localStorage.getItem(chaveLocal)).toBeNull();
});

test("se a gravação falhar, o rascunho local continua e a mensagem diz o motivo", async () => {
  mockSetDoc.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "permission-denied" }));
  await montar();
  await clicar(botao("P607"));
  await act(async () => { await Promise.resolve(); });
  await clicar(botao("CConforme"));
  await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  await clicar(botao("Salvar diagnóstico"));
  await act(async () => { await Promise.resolve(); });
  expect(host.querySelector('[role="alert"]').textContent).toContain("Seu perfil não tem permissão para salvar neste projeto");
  expect(Object.keys(window.localStorage).some((k) => k.endsWith(":P607"))).toBe(true);
  // repetir usa o MESMO id (não duplica) e agora grava
  const idPrimeiro = mockSetDoc.mock.calls[0][0]._doc;
  await clicar(botao("Salvar diagnóstico"));
  await act(async () => { await Promise.resolve(); });
  expect(mockSetDoc.mock.calls[1][0]._doc).toBe(idPrimeiro);
  expect(host.textContent).toContain("Diagnóstico salvo no Firestore");
});

test("rascunho do aparelho nunca some: volta como 'Continuar rascunho deste aparelho'", async () => {
  await montar();
  await clicar(botao("P607"));
  await act(async () => { await Promise.resolve(); });
  await clicar(botao("CConforme"));
  await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
  await clicar(botao("Trocar projeto"));
  await clicar(botao("P607"));
  await act(async () => { await Promise.resolve(); });
  expect(host.textContent).toContain("Continuar rascunho deste aparelho");
  expect(botao("＋ Novo diagnóstico").disabled).toBe(true);
});

test("cópia de segurança e PDF existem na tela", async () => {
  await montar();
  await clicar(botao("P607"));
  await act(async () => { await Promise.resolve(); });
  expect(botao("PDF (padrão Moked)")).toBeTruthy();
  expect(botao("Baixar TXT")).toBeTruthy();
  expect(botao("Cópia de segurança")).toBeTruthy();
});

test("nova revisão a partir de um diagnóstico salvo: copia as respostas, guarda baseId e o original fica intacto; PDF direto da lista", async () => {
  const antigo = { tipo: "existente", projetoRef: "P607", estado: "rascunho", criadoEm: "2026-10-01T10:00:00.000Z", atualizadoEm: "2026-10-01T10:00:00.000Z", respostas: { "D01.01.01": { status: "nao_conforme", situacao: "Trecho caído", updatedAt: 1 } } };
  mockGetDocs.mockImplementation(async (q) => {
    const col = (q._q && q._q[0] && q._q[0]._col) || (q._col || "");
    if (String(col).includes("itens") && String(col).startsWith("catalogos_diagnostico")) return { docs: itensDocs };
    if (String(col).includes("diagnosticos/P607/itens")) return { docs: [{ id: "diag-antigo", data: () => antigo }] };
    return { docs: [] };
  });
  await montar();
  await clicar(botao("P607"));
  await act(async () => { await Promise.resolve(); });
  expect(host.textContent).toContain("Rev. 1");
  expect(botao("PDF")).toBeTruthy();
  expect(botao("＋ Novo diagnóstico em branco")).toBeTruthy();
  await clicar(botao("Nova revisão a partir deste"));
  expect(host.textContent).toContain("Revisão 2");
  await clicar(botao("Salvar diagnóstico"));
  await act(async () => { await Promise.resolve(); });
  expect(mockSetDoc).toHaveBeenCalledTimes(1);
  const [ref, payload] = mockSetDoc.mock.calls[0];
  expect(ref._doc).not.toContain("diag-antigo");
  expect(payload.baseId).toBe("diag-antigo");
  expect(payload.respostas["D01.01.01"]).toMatchObject({ status: "nao_conforme", situacao: "Trecho caído" });
  expect(antigo.respostas["D01.01.01"].status).toBe("nao_conforme");
});
