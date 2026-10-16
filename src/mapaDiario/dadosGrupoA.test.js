// A1 (último plantão, qualquer turno) e A3/equipamentos (km da moto, correção de item) — com Firestore simulado.
const mockMapas = [];
let mockEquip = null;
const mockGrav = [];
jest.mock("firebase/app", () => ({ getApps: () => [{}] }));
jest.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
  doc: (_db, ...caminho) => ({ caminho }),
  collection: (_db, ...caminho) => ({ caminho }),
  query: (c) => c, orderBy: () => null, limit: () => null, where: () => null,
  getDoc: async () => ({ exists: () => !!mockEquip, data: () => mockEquip }),
  getDocFromServer: async () => ({ exists: () => !!mockEquip, data: () => mockEquip }),
  getDocs: async () => ({ docs: mockMapas.map((m) => ({ data: () => m })) }),
}));
jest.mock("../fireGuard", () => ({ setDoc: () => {} }));
jest.mock("../session", () => ({ isDemo: () => false, authFetchEquipe: () => {} }));
jest.mock("../equipamentosStore", () => ({ gravarSecaoEquipamentos: async (pid, sec, before, depois) => { mockGrav.push({ pid, sec, depois }); return { ...before, [sec]: depois }; } }));

const dados = require("./dados");

beforeEach(() => { mockMapas.length = 0; mockGrav.length = 0; mockEquip = null; });

test("último plantão: qualquer turno/equipe, enviado, anterior a este (D antes de N no mesmo dia)", async () => {
  mockMapas.push(
    { data: "2026-10-15", turno: "N", status: "rascunho", veiculos: [{ kmAtual: 1 }] },
    { data: "2026-10-15", turno: "D", status: "enviado", veiculos: [{ id: "moto", kmAtual: 71285 }] },
    { data: "2026-10-14", turno: "N", status: "enviado", veiculos: [{ id: "moto", kmAtual: 71241 }] },
  );
  expect((await dados.loadUltimoPlantao("P311A", "2026-10-15", "N")).veiculos[0].kmAtual).toBe(71285);   // noturno herda o diurno do mesmo dia
  expect((await dados.loadUltimoPlantao("P311A", "2026-10-15", "D")).veiculos[0].kmAtual).toBe(71241);   // diurno herda o noturno de ontem
  expect(await dados.loadUltimoPlantao("P311A", "2026-10-14", "N")).toBeNull();
});

test("km da moto no cadastro só sobe", async () => {
  mockEquip = { moto: { placa: "SFJ2D44", km: 71145 } };
  const r = await dados.atualizarKmMotoNoCadastro("P311A", { veiculos: [{ id: "moto", rotulo: "Moto", kmAtual: 71330 }] });
  expect(r).toEqual({ atualizado: true, km: 71330 });
  expect(mockGrav[0]).toMatchObject({ sec: "moto", depois: { placa: "SFJ2D44", km: 71330 } });
  mockGrav.length = 0;
  expect((await dados.atualizarKmMotoNoCadastro("P311A", { veiculos: [{ rotulo: "Moto", kmAtual: 71000 }] })).atualizado).toBe(false);
  expect(mockGrav).toHaveLength(0);
});

test("corrigir item do cadastro pelo mapa: troca só a quantidade/identificação daquele item", async () => {
  mockEquip = { municao: [{ id: "m1", identificacao: "Munição .38", qtd: 24 }, { id: "m2", identificacao: "Munição 12", qtd: 10 }] };
  await dados.corrigirItemEquipamento("P311B", "municao:m1", { qtd: 30 });
  expect(mockGrav[0].sec).toBe("municao");
  expect(mockGrav[0].depois).toEqual([{ id: "m1", identificacao: "Munição .38", qtd: 30 }, { id: "m2", identificacao: "Munição 12", qtd: 10 }]);
  await expect(dados.corrigirItemEquipamento("P311B", "municao:zz", { qtd: 1 })).rejects.toThrow(/não está mais no cadastro/);
});
