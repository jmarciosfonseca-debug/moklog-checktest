// Mapa de Equipe editável (18/10): baixa/inclusão de item pelo mapa, km corrigido no cadastro e no plantão do erro.
const mockBanco = {};
let mockEquip = null;
const mockGrav = [], mockBaixa = [];
jest.mock("firebase/app", () => ({ getApps: () => [{}] }));
jest.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
  doc: (_db, ...c) => ({ id: c.join("/") }),
  collection: () => ({}), query: (c) => c, orderBy: () => null, limit: () => null, where: () => null,
  getDoc: async (ref) => (ref.id.startsWith("equipamentos/") ? { exists: () => !!mockEquip, data: () => mockEquip } : { exists: () => !!mockBanco[ref.id], data: () => mockBanco[ref.id] }),
  getDocFromServer: async (ref) => (ref.id.startsWith("equipamentos/") ? { exists: () => !!mockEquip, data: () => mockEquip } : { exists: () => !!mockBanco[ref.id], data: () => mockBanco[ref.id] }),
  getDocs: async () => ({ docs: [] }),
}));
jest.mock("../fireGuard", () => ({ setDoc: async (ref, d) => { mockBanco[ref.id] = d; } }));
jest.mock("../session", () => ({ isDemo: () => false, authFetchEquipe: () => {} }));
jest.mock("../equipamentosStore", () => ({
  gravarSecaoEquipamentos: async (pid, sec, before, depois) => { mockGrav.push({ pid, sec, depois }); mockEquip = { ...before, [sec]: depois }; return mockEquip; },
  darBaixaEquipamento: async (pid, pedido) => { mockBaixa.push({ pid, pedido }); const lista = mockEquip[pedido.categoria].filter((x) => x.id !== pedido.id); mockEquip = { ...mockEquip, [pedido.categoria]: lista, baixados: [{ id: pedido.id }] }; return mockEquip; },
}));
const dados = require("./dados");
beforeEach(() => { Object.keys(mockBanco).forEach((k) => delete mockBanco[k]); mockGrav.length = 0; mockBaixa.length = 0; mockEquip = null; dados._limparEnviadosParaTeste(); });

test("baixa pelo mapa: id do mapa (categoria:id) vira pedido ao servidor; item sem identificador é recusado com orientação", async () => {
  mockEquip = { lanternas: [{ id: "l1", identificacao: "XRT-6000A", qtd: 1 }, { identificacao: "Sem id" }] };
  const eq = await dados.darBaixaItemEquipamento("P604", "lanternas:l1", { motivo: "Substituído", obs: "tática", por: "Luiz D." });
  expect(mockBaixa[0]).toEqual({ pid: "P604", pedido: { categoria: "lanternas", id: "l1", motivo: "Substituído", obs: "tática", por: "Luiz D." } });
  expect(eq.lanternas.map((x) => x.identificacao)).toEqual(["Sem id"]);
  await expect(dados.darBaixaItemEquipamento("P604", "lanternas:1", { motivo: "Extraviado" })).rejects.toThrow(/sem identificador/);
});

test("item novo cadastrado pelo mapa entra no fim da lista com id, status ok e quantidade", async () => {
  mockEquip = { lanternas: [{ id: "l2", identificacao: "Lanterna 02", qtd: 1 }] };
  const eq = await dados.adicionarItemEquipamento("P604", "lanternas", { identificacao: " Lanterna tática 01 ", qtd: 1 });
  expect(mockGrav[0].sec).toBe("lanternas");
  expect(eq.lanternas[1]).toMatchObject({ identificacao: "Lanterna tática 01", qtd: 1, status: "ok", historico: [] });
  expect(eq.lanternas[1].id).toEqual(expect.any(String));
});

test("cadastro: km corrigido no mapa desce o km do cadastro; sem correção só sobe; outra placa não mexe", async () => {
  mockEquip = { moto: { placa: "ABC1D23", km: 713300 } };
  expect((await dados.atualizarKmMotoNoCadastro("P604", { veiculos: [{ id: "moto", kmAtual: 71380 }] })).atualizado).toBe(false);
  expect(await dados.atualizarKmMotoNoCadastro("P604", { veiculos: [{ id: "moto", kmAtual: 71380, correcaoKm: { de: 713300, para: 71330 } }] })).toEqual({ atualizado: true, km: 71380 });
  expect(mockEquip.moto).toMatchObject({ placa: "ABC1D23", km: 71380 });
  expect((await dados.atualizarKmMotoNoCadastro("P604", { veiculos: [{ id: "moto", placa: "OLD9Z99", kmAtual: 99999 }] })).atualizado).toBe(false);
  expect(mockEquip.moto.km).toBe(71380);
});

test("plantão do erro recebe kmAtualCorrigido sem perder o digitado; repetir não regrava", async () => {
  const K = "equipes/P604/mapas/P604_2026-10-17_N";
  mockBanco[K] = { id: "P604_2026-10-17_N", projetoId: "P604", status: "enviado", enviadoEm: "e", veiculos: [{ id: "moto", rotulo: "Moto", kmAnterior: 71290, kmAtual: 713300 }] };
  expect(await dados.corrigirKmNoMapaAnterior("P604", "P604_2026-10-17_N", "moto", 71330, { motivo: "erro de digitação", porMapa: "P604_2026-10-18_D" })).toEqual({ atualizado: true });
  expect(mockBanco[K]).toMatchObject({ status: "enviado", enviadoEm: "e", veiculos: [{ kmAtual: 713300, kmAtualCorrigido: 71330, kmCorrecao: { para: 71330, motivo: "erro de digitação", porMapa: "P604_2026-10-18_D" } }] });
  expect(await dados.corrigirKmNoMapaAnterior("P604", "P604_2026-10-17_N", "moto", 71330, {})).toEqual({ atualizado: false });
  expect(await dados.corrigirKmNoMapaAnterior("P604", "nao-existe", "moto", 1, {})).toEqual({ atualizado: false });
});

test("plantão pelo mapa: lê o mapa do turno pedido (diurno/noturno) e devolve quem está no posto", async () => {
  mockBanco["equipes/P604/mapas/P604_2026-10-18_N"] = { status: "enviado", postos: [{ id: "p1", rotulo: "Líder", lider: true, pessoaId: "a", pessoaNome: "Titular", situacao: "falta" }, { id: "p2", rotulo: "Posto extra", pessoaId: "f", pessoaNome: "Folguista", situacao: "ft" }] };
  const r = await dados.loadPlantaoDoMapa("P604", "2026-10-18", "noturno");
  expect(r.pessoas.map((x) => x.pessoaNome)).toEqual(["Folguista"]);
  expect(await dados.loadPlantaoDoMapa("P604", "2026-10-18", "diurno")).toBeNull();
});
