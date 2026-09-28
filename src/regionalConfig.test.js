import { coletarRegional, moduladorRegional, REGIONAL } from "./regionalConfig";

const PROJETOS_TERRITORIAIS = ["P601", "P602", "P604", "P605", "P606", "P607", "P311A", "P311B", "P505"];

test("P606 possui diagnóstico territorial versionado e mapa dedicado", () => {
  const p606 = REGIONAL.P606;

  expect(p606).toBeTruthy();
  expect(p606.codigo).toBe("AR-PAT-2026-606");
  expect(p606.pdfPath).toBe("/regional/P606.jpg");
  expect(p606.quadrantes).toHaveLength(2);
  expect(p606.fontes.map((fonte) => fonte.orgao)).toEqual(
    expect.arrayContaining(["ISP-RJ", "Sinesp/MJSP"]),
  );
  expect(p606).not.toHaveProperty("classe");
});

test("P606 mantém estimativas de pronta-resposta explicitamente identificadas", () => {
  const p606 = coletarRegional("P606");

  expect(p606.ok).toBe(true);
  expect(p606.protecao).not.toHaveLength(0);
  p606.protecao.forEach((item) => {
    expect(item.fonte).toMatch(/estimativa operacional/i);
  });
});

test("vetores territoriais do P606 usam redação condicional", () => {
  const descricoes = REGIONAL.P606.quadrantes.flatMap((q) =>
    q.vetores.map((vetor) => vetor.desc),
  );

  descricoes.forEach((descricao) => {
    expect(descricao).toMatch(/\bpodem?\b/i);
  });
});

test("cadastros territoriais ativos possuem fontes reproduzíveis", () => {
  PROJETOS_TERRITORIAIS.forEach((projectId) => {
    const regional = REGIONAL[projectId];
    expect(regional.fontes?.length).toBeGreaterThan(0);
    regional.fontes.forEach((fonte) => {
      expect(fonte.orgao).toBeTruthy();
      expect(fonte.url).toMatch(/^https:\/\//);
      expect(fonte.periodo).toBeTruthy();
      expect(fonte.consulta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

test("vetores territoriais ativos usam consequência condicional", () => {
  PROJETOS_TERRITORIAIS.forEach((projectId) => {
    REGIONAL[projectId].quadrantes.forEach((quadrante) => {
      quadrante.vetores.forEach((vetor) => {
        expect(vetor.desc).toMatch(/\bpodem?\b/i);
      });
    });
  });
});

test("pronta-resposta ativa não apresenta estimativa como medição", () => {
  PROJETOS_TERRITORIAIS.forEach((projectId) => {
    REGIONAL[projectId].protecao.forEach((item) => {
      expect(item.fonte).toMatch(/estimad|estimativa/i);
    });
  });
});

test("territorial não fixa classe nem usa grau fora do schema", () => {
  const grausAceitos = new Set(["GRAVISSIMO", "GRAVE", "MODERADO", "BAIXO"]);

  PROJETOS_TERRITORIAIS.forEach((projectId) => {
    const regional = REGIONAL[projectId];
    expect(regional).not.toHaveProperty("classe");
    regional.quadrantes.forEach((quadrante) => {
      expect(grausAceitos.has(quadrante.grau)).toBe(true);
    });
  });
});

test("contextos qualitativos novos permanecem neutros na régua", () => {
  ["P311A", "P311B", "P505"].forEach((projectId) => {
    const regional = coletarRegional(projectId);
    expect(regional.aplicarModulador).toBe(false);
    expect(moduladorRegional(regional, [{ label: "Perímetro", nivel: 4 }])).toEqual({
      delta: 0,
      motivo: "contexto territorial qualitativo; sem modulador quantitativo validado",
    });
  });
});
