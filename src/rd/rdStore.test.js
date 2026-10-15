import { criarRdStore } from "./rdStore";

jest.mock("../session", () => ({ isDemo: jest.fn(() => false), getSession: jest.fn(() => null) }));
const { isDemo, getSession } = require("../session");

const respostaOk = () => Promise.resolve({ ok: true, json: async () => ({ ok: true, dia: null, memoria: null }) });

beforeEach(() => { jest.clearAllMocks(); isDemo.mockReturnValue(false); getSession.mockReturnValue(null); });

test("com login do Diagnóstico usa o token do Firebase", async () => {
  const request = jest.fn(respostaOk);
  const store = criarRdStore({ currentUser: { uid: "g", isAnonymous: false, getIdToken: async () => "FIREBASE" } }, request);
  await store.ler("2026-10-15");
  expect(request.mock.calls[0][1].headers.Authorization).toBe("Bearer FIREBASE");
});

test("sem login do Firebase, a sessão do PIN gerencial basta (mesmo token de Registros)", async () => {
  getSession.mockReturnValue({ nivel: "gerencial", token: "PINTOKEN", exp: Date.now() + 1000 });
  const request = jest.fn(respostaOk);
  const store = criarRdStore({ currentUser: null }, request);
  await store.ler("2026-10-15");
  expect(request.mock.calls[0][1].headers.Authorization).toBe("Bearer PINTOKEN");
});

test("sem Firebase e sem sessão gerencial, orienta a entrar em Registros com o PIN (sem pedir login do Diagnóstico)", async () => {
  const store = criarRdStore({ currentUser: null }, jest.fn(respostaOk));
  await expect(store.ler("2026-10-15")).rejects.toThrow(/PIN gerencial/);
  // sessão de líder não dá acesso ao RD
  getSession.mockReturnValue({ nivel: "equipe", token: "T", projectId: "P602" });
  await expect(store.ler("2026-10-15")).rejects.toThrow(/PIN gerencial/);
});

test("modo demonstração nunca chama o servidor", async () => {
  isDemo.mockReturnValue(true);
  const request = jest.fn(respostaOk);
  const store = criarRdStore({ currentUser: { uid: "g", isAnonymous: false, getIdToken: async () => "F" } }, request);
  await expect(store.salvar({ data: "2026-10-15", revisao: 0, dia: {} })).rejects.toThrow(/demonstração/i);
  expect(request).not.toHaveBeenCalled();
});
