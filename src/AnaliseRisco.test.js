import { gerarHTMLAnaliseRisco, MAPA_REGIONAL } from "./AnaliseRisco";

function contexto(vetores = []) {
  return {
    project: { id: "P604", name: "Golgi Jundiaí" },
    pacoteLabel: "Golgi",
    vetores,
    geral: {
      label: "CRÍTICO",
      nivel: 4,
      nBloqueadores: 2,
      alerta: true,
      motivoMatriz: "duas ou mais zonas perimetrais inoperantes",
      metricas: { zonasNomeadas: 2, cftvInoperante: 14, barreirasCriticas: 1 },
    },
    fontesUsadas: [
      { titulo: "Teste Semanal", detalhe: "84%" },
      { titulo: "Ronda Perimetral", detalhe: "57% OK" },
    ],
    ts: { ok: true, pct: 84, total: 168, okItens: 141, dataRaw: "2026-09-20" },
    ctmk: { ok: true, offline: false },
    ilum: null,
    rondaVirtual: null,
    equipe: null,
    regional: { ok: false },
    contextos: {},
  };
}

const vetor = (i) => ({
  chave: `risco-${i}`,
  label: `Vetor ${i}`,
  nivel: 4,
  bloqueadorCaido: true,
  fonteCredito: "Teste Semanal",
  descricao: `Evidência operacional ${i}`,
  zonaCanonica: `Z-${String(i).padStart(2, "0")}`,
  barreiraFisica: "perimetro",
});

test("todos os Golgis possuem referência de mapa configurada", () => {
  ["P601", "P602", "P604", "P605", "P606", "P607"].forEach((id) => {
    expect(MAPA_REGIONAL[id]).toBeTruthy();
  });
  expect(MAPA_REGIONAL.P602).toBe("/mapas/P602.jpg");
  expect(MAPA_REGIONAL.P604).toBe("/mapas/P604.jpg");
  expect(MAPA_REGIONAL.P605).toBe("/mapas/P605.jpg");
  expect(MAPA_REGIONAL.P606).toBe("/mapas/P606.jpg");
});

test("PDF executivo usa três colunas, explica o cálculo e limita apontamentos", () => {
  const html = gerarHTMLAnaliseRisco(contexto(Array.from({ length: 12 }, (_, i) => vetor(i + 1))));

  expect(html).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
  expect(html).toContain("memória de cálculo");
  expect(html).toContain("duas ou mais zonas perimetrais inoperantes");
  expect(html).toContain("Mais 3 apontamento(s)");
  expect((html.match(/class=\"vuln\"/g) || [])).toHaveLength(9);
  expect(html).toContain("Anexo Técnico separado");
});

test("projeto sem diagnóstico regional ainda exibe o mapa como referência", () => {
  const html = gerarHTMLAnaliseRisco(contexto([vetor(1)]), "data:image/jpeg;base64,AA==");

  expect(html).toContain("Mapa de referência do P604");
  expect(html).toContain("diagnóstico territorial interpretativo permanece em elaboração");
});
