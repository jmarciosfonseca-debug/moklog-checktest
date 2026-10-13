// Aviso de "retorno novo" do follow-up: resumo por projeto e baixa quando a Moked vê.
import { resumirProjeto } from "./config";

const mem = {};
jest.mock("firebase/firestore", () => ({
  doc: (_db, col, id) => ({ col, id }),
  getDoc: async (r) => ({ exists: () => mem[`${r.col}/${r.id}`] !== undefined, data: () => JSON.parse(JSON.stringify(mem[`${r.col}/${r.id}`])) }),
}));
jest.mock("../fireGuard", () => ({ setDoc: async (r, v) => { mem[`${r.col}/${r.id}`] = JSON.parse(JSON.stringify(v)); } }));

const { marcarRetornosVistos, loadFollowups } = require("../followups");

const agora = Date.parse("2026-10-20T12:00:00Z");
const dia = (d) => new Date(agora - d * 86400000).toISOString();

test("resumirProjeto conta retornos novos, parados e quem está com a bola", () => {
  const mapa = {
    a: { key: "a", comQuem: "moked", retornoNovo: true, entries: [{ em: dia(1) }] },
    b: { key: "b", comQuem: "manutencao", entries: [{ status: "aguardando", em: dia(8) }] },
    c: { key: "c", comQuem: "administracao", entries: [{ em: dia(20) }] },
    d: { key: "d", comQuem: "manutencao", resolvido: true, retornoNovo: true, entries: [] },
  };
  const r = resumirProjeto(["a", "b", "c", "d", "e"], mapa, agora);
  expect(r).toEqual({ novos: 1, parados: 2, comMoked: 1, comAdm: 1, comManut: 2 }); // "e" nunca teve retorno → parado
});

test("marcarRetornosVistos baixa o aviso sem mexer no resto", async () => {
  mem["followups/P601"] = { registros: [
    { key: "a", comQuem: "moked", retornoNovo: true, entries: [{ id: "1" }] },
    { key: "b", comQuem: "manutencao", retornoNovo: false, entries: [] },
  ] };
  const novo = await marcarRetornosVistos({}, "P601");
  expect(novo.a.retornoNovo).toBe(false);
  expect(novo.a.comQuem).toBe("moked");
  expect((await loadFollowups({}, "P601")).a.retornoNovo).toBe(false);
});
