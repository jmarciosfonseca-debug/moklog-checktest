import { gerarImpactosOperacionais, RISCO_IMPACTO_TEXTOS } from "./riscoImpactoConfig";

const vetor = (dados = {}) => ({
  label: "Vetor operacional",
  nivel: 3,
  bloqueadorCaido: false,
  observacaoManutencao: false,
  fonteCredito: "Teste Semanal",
  ...dados,
});

test("matriz é condicional, consolidada por família e limitada a quatro cards", () => {
  const cards = gerarImpactosOperacionais({
    vetores: [
      vetor({ label: "CFTV", inop: 14, total: 73 }),
      vetor({ label: "CFTV — doca", inop: 1, total: 73 }),
      vetor({ label: "Iluminação", inop: 8, total: 20 }),
      vetor({ label: "Garra veicular", bloqueadorCaido: true, inop: 2, total: 4 }),
      vetor({ label: "Pânico fixo", bloqueadorCaido: true, inop: 1, total: 1 }),
      vetor({ label: "Fornecimento de energia", nivel: 2, inop: 1, total: 2 }),
    ],
    geral: { metricas: { cftvInoperante: 15 } },
  });

  expect(cards).toHaveLength(4);
  expect(cards.filter((c) => c.familia === "CFTV")).toHaveLength(1);
  expect(cards.some((c) => c.familia === "CONTROLE_ACESSO")).toBe(false);
  expect(cards[0].peso).toBe("BLOQUEADOR");
});

test("P311A distingue exposição primária de perda de redundância", () => {
  const cards = gerarImpactosOperacionais({
    vetores: [
      vetor({ label: "01B - ALARME ALPHA SENSE", camadaPerimetral: "primaria", bloqueadorCaido: true, inop: 1, total: 8 }),
      vetor({ label: "01 - ALARME CERCA ELÉTRICA", camadaPerimetral: "secundaria", nivel: 1, observacaoManutencao: true, inop: 1, total: 4 }),
    ],
    geral: { metricas: { alphaSenseInoperante: 1, cercaEletricaInoperante: 1 } },
  });

  expect(cards.map((c) => c.familia)).toEqual(["PERIMETRO_PRIMARIO", "PERIMETRO_SECUNDARIO"]);
  expect(cards[0].titulo).toContain("barreira perimetral primária");
  expect(cards[1].titulo).toContain("perda parcial de redundância");
  expect(cards[1].prioridade).toBe("PROGRAMADA");
});

test("dois vetores perimetrais determinantes aparecem como exposição ampliada", () => {
  const cards = gerarImpactosOperacionais({
    vetores: [
      vetor({ label: "Perímetro eletrônico — Z-01", barreiraFisica: "perimetro", zonaCanonica: "Z-01", bloqueadorCaido: true, inop: 1, total: 8, nivel: 3 }),
      vetor({ label: "Perímetro eletrônico — Z-02", barreiraFisica: "perimetro", zonaCanonica: "Z-02", bloqueadorCaido: true, inop: 1, total: 8, nivel: 3 }),
    ],
    geral: { nivel: 4, motivoMatriz: "duas ou mais zonas perimetrais inoperantes" },
  });

  expect(cards).toHaveLength(1);
  expect(cards[0].faixa).toBe("MULTIPLA");
  expect(cards[0].medida).toContain("2 de 8");
  expect(cards[0].consequencia).toContain("pode elevar");
});

test("todas as consequências propostas usam linguagem de possibilidade", () => {
  const consequencias = Object.values(RISCO_IMPACTO_TEXTOS)
    .flatMap((faixas) => Object.values(faixas))
    .map((texto) => texto.consequencia);

  consequencias.forEach((texto) => {
    expect(texto).toMatch(/\bpode\b|\bpodem\b/i);
    expect(texto).not.toMatch(/\b(vai|resultará|haverá|ocorrerá)\b/i);
  });
});

test("matriz não promove vetor de soma a bloqueador", () => {
  const cards = gerarImpactosOperacionais({
    vetores: [
      vetor({ label: "Perímetro eletrônico — Z-01", barreiraFisica: "perimetro", bloqueadorCaido: true, inop: 1, total: 4, nivel: 3 }),
      vetor({ label: "Perímetro eletrônico — Z-02", barreiraFisica: "perimetro", bloqueadorCaido: true, inop: 1, total: 4, nivel: 3 }),
      vetor({ label: "Iluminação — quadrante sul", inop: 6, total: 10, nivel: 2 }),
    ],
    geral: { nivel: 4, motivoMatriz: "duas ou mais zonas perimetrais inoperantes" },
  });

  expect(cards.find((c) => c.familia === "PERIMETRO").peso).toBe("BLOQUEADOR");
  expect(cards.find((c) => c.familia === "ILUMINACAO").peso).toBe("SOMA");
});

test("CFTV que elevou a classe por quantidade não some por ter baixa proporção", () => {
  const cards = gerarImpactosOperacionais({
    vetores: [vetor({ label: "03 - CFTV", nivel: 1, inop: 6, total: 120 })],
    geral: {
      nivel: 3,
      motivoMatriz: "mais de cinco câmeras inoperantes (perímetro íntegro)",
      metricas: { cftvInoperante: 6 },
    },
  });

  expect(cards).toHaveLength(1);
  expect(cards[0].familia).toBe("CFTV");
  expect(cards[0].medida).toContain("6 de 120");
  expect(cards[0].peso).toBe("TATICO");
});

test("classe BAIXO não reapresenta manutenção residual como bloqueador", () => {
  const cards = gerarImpactosOperacionais({
    vetores: [
      vetor({ label: "Pânico fixo", bloqueadorCaido: true, inop: 4, total: 4 }),
      vetor({ label: "Cancela", nivel: 2, inop: 1, total: 20 }),
    ],
    geral: { nivel: 1, motivoMatriz: "somente manutenção ou barreira isolada" },
  });

  expect(cards).toEqual([]);
});

test("energia e equipe permanecem fora da matriz de impacto físico", () => {
  const cards = gerarImpactosOperacionais({
    vetores: [
      vetor({ label: "Fornecimento de energia", grupo: "energia", nivel: 3, inop: 2, total: 1 }),
      vetor({ label: "Equipe e liderança", grupo: "equipe", nivel: 3, inop: 2, total: 4 }),
      vetor({ label: "CFTV", grupo: "cftv", nivel: 3, inop: 6, total: 74 }),
    ],
    geral: { metricas: { cftvInoperante: 6 } },
  });

  expect(cards.map((card) => card.familia)).toEqual(["CFTV"]);
});

test("matriz nunca apresenta percentual superior a cem", () => {
  const cards = gerarImpactosOperacionais({
    vetores: [vetor({ label: "Pânico fixo", inop: 4, total: 3, bloqueadorCaido: true })],
    geral: {},
  });

  expect(cards[0].medida).toContain("3 de 3");
  expect(cards[0].medida).toContain("100%");
});
