import { buildCatalogSections, calculateProgress, draftStorageKey, isDiagnosticDataReady, readDraft, writeDraft } from "./diagnosticoDraft";

describe("rascunho do Diagnóstico Situacional", () => {
  const catalogo = {
    categorias: [{ id: "D02", nome: "Dois", ordem: 2 }, { id: "D01", nome: "Um", ordem: 1 }],
    subcategorias: [
      { id: "D01.01", categoria: "D01", nome: "Primeira", ordem: 1 },
      { id: "D02.01", categoria: "D02", nome: "Segunda", ordem: 2 },
    ],
  };
  const itens = [
    { id: "D02.01.01", subcategoria: "D02.01", ordem: 2 },
    { id: "D01.01.01", subcategoria: "D01.01", ordem: 1 },
    { id: "D01.01.99", subcategoria: "D01.01", ordem: 99, deprecado: true },
  ];

  test("organiza categorias e itens na ordem publicada", () => {
    const secoes = buildCatalogSections(catalogo, itens);
    expect(secoes.map((categoria) => categoria.id)).toEqual(["D01", "D02"]);
    expect(secoes[0].subcategorias[0].itens.map((item) => item.id)).toEqual(["D01.01.01"]);
  });

  test("calcula respondidos e avaliados segundo os estados oficiais", () => {
    expect(calculateProgress(itens, {
      "D01.01.01": { status: "conforme" },
      "D02.01.01": { status: "sem_dado" },
    })).toEqual({ total: 2, respondidos: 2, avaliados: 1, percentual: 100 });
  });

  test("salva e restaura somente rascunho da mesma versão", () => {
    const dados = new Map();
    const storage = { getItem: (key) => dados.get(key) || null, setItem: (key, value) => dados.set(key, value) };
    const key = draftStorageKey("catalogo", "usuario");
    writeDraft(storage, key, { versao: "1.0.0", respostas: { a: { status: "na" } } });
    expect(readDraft(storage, key, "1.0.0").respostas.a.status).toBe("na");
    expect(readDraft(storage, key, "2.0.0")).toBeNull();
  });

  test("não libera a tela entre o login e o carregamento dos dados", () => {
    expect(isDiagnosticDataReady(null, null)).toBe(false);
    expect(isDiagnosticDataReady({ versao: "1.0.0" }, null)).toBe(false);
    expect(isDiagnosticDataReady({ versao: "1.0.0" }, { role: "gerente" })).toBe(true);
  });
});
