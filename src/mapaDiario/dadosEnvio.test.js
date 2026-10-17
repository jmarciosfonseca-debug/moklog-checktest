// Bug de campo 17/10 (P260B/P604): rascunho atrasado do autosave regravava o mapa depois do Concluir.
const mockBanco = {};
let mockOrdem = [];
let mockAtrasoRascunho = 0;
jest.mock("firebase/app", () => ({ getApps: () => [{}] }));
jest.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
  doc: (_db, ...c) => ({ id: c.join("/") }),
  collection: () => ({}), query: (c) => c, orderBy: () => null, limit: () => null, where: () => null,
  getDoc: async () => ({ exists: () => false, data: () => null }),
  getDocs: async () => ({ docs: [] }),
  getDocFromServer: async (ref) => ({ exists: () => !!mockBanco[ref.id], data: () => mockBanco[ref.id] }),
}));
jest.mock("../fireGuard", () => ({
  setDoc: async (ref, d) => {
    if (d.status !== "enviado" && mockAtrasoRascunho) await new Promise((r) => setTimeout(r, mockAtrasoRascunho));
    mockOrdem.push(d.status); mockBanco[ref.id] = d;
  },
}));
jest.mock("../session", () => ({ isDemo: () => false, authFetchEquipe: () => {} }));
jest.mock("../equipamentosStore", () => ({ gravarSecaoEquipamentos: async () => {} }));

const dados = require("./dados");
const K = "equipes/P260B/mapas/P260B_2026-10-17_D";
const base = { id: "P260B_2026-10-17_D", projetoId: "P260B", data: "2026-10-17", turno: "D", postos: [], veiculos: [] };
beforeEach(() => { Object.keys(mockBanco).forEach((k) => delete mockBanco[k]); mockOrdem = []; mockAtrasoRascunho = 0; dados._limparEnviadosParaTeste(); });

test("rascunho lento em andamento NÃO ultrapassa o envio: o mapa termina 'enviado' e confirmado", async () => {
  mockAtrasoRascunho = 40;
  const rascunho = dados.saveMapa({ ...base, status: "rascunho" });          // autosave ainda gravando
  const env = dados.enviarMapa({ ...base, status: "enviado", enviadoEm: "2026-10-17T09:00:00.000Z" });
  await Promise.all([rascunho, env]);
  expect(mockOrdem).toEqual(["rascunho", "enviado"]);
  expect(mockBanco[K].status).toBe("enviado");
});

test("rascunho que dispara depois do envio é descartado e não rebaixa o mapa", async () => {
  await dados.enviarMapa({ ...base, status: "enviado", enviadoEm: "2026-10-17T09:00:00.000Z" });
  await dados.saveMapa({ ...base, status: "rascunho" });                      // timer atrasado do autosave
  expect(mockOrdem).toEqual(["enviado"]);
  expect(mockBanco[K].status).toBe("enviado");
});

test("correção de mapa já enviado (status enviado) continua gravando", async () => {
  await dados.enviarMapa({ ...base, status: "enviado", enviadoEm: "2026-10-17T09:00:00.000Z" });
  await dados.saveMapa({ ...base, status: "enviado", enviadoEm: "2026-10-17T09:00:00.000Z", resumo: "corrigido" });
  expect(mockBanco[K].resumo).toBe("corrigido");
});

test("se outra gravação cobrir a nossa antes da confirmação, regrava uma vez e confirma", async () => {
  const fg = require("../fireGuard");
  let n = 0; const original = fg.setDoc;
  fg.setDoc = async (ref, d) => { n++; await original(ref, d); if (n === 1) mockBanco[ref.id] = { ...d, status: "rascunho", atualizadoEm: "outro" }; };
  const r = await dados.enviarMapa({ ...base, status: "enviado", enviadoEm: "2026-10-17T09:00:00.000Z" });
  fg.setDoc = original;
  expect(n).toBe(2); expect(r.status).toBe("enviado"); expect(mockBanco[K].status).toBe("enviado");
});
