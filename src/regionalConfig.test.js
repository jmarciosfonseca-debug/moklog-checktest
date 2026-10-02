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

test("cadastros territoriais explicam método, recorte e limitação sem inventar indicadores", () => {
  PROJETOS_TERRITORIAIS.forEach((projectId) => {
    const regional = REGIONAL[projectId];
    expect(regional.auditoria?.metodo).toMatch(/leitura qualitativa/i);
    expect(regional.auditoria?.recorte).toBeTruthy();
    expect(regional.auditoria?.conclusao).toBeTruthy();
    expect(regional.auditoria?.limitacao).toMatch(/não foi usado número estimado/i);
    expect(regional.indicadores).toEqual(expect.arrayContaining([
      expect.objectContaining({ valor: null }),
    ]));
  });
});

test("fontes Sinesp usam página institucional estável", () => {
  PROJETOS_TERRITORIAIS.forEach((projectId) => {
    REGIONAL[projectId].fontes
      .filter((fonte) => /Sinesp/i.test(fonte.orgao))
      .forEach((fonte) => {
        expect(fonte.url).toBe("https://www.gov.br/mj/pt-br/acesso-a-informacao/dados-abertos/ocorrencias-criminais-sinesp");
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

test("P505 usa o local confirmado sem herdar os vetores do endereço antigo", () => {
  expect(REGIONAL.P505.municipioUF).toBe("Guarulhos / SP");
  expect(REGIONAL.P505.marcoZero).toContain("Indubel, 940");
  expect(REGIONAL.P505.mapsUrl).toBe("https://maps.app.goo.gl/sZjhSZwo8Zzy1erVA");
  expect(REGIONAL.P505.coordenadas).toBe("-23.4420114, -46.4476851");
  expect(REGIONAL.P505.quadrantes).toEqual([]);
  expect(REGIONAL.P505.fontes.every((f) => /Guarulhos/.test(f.escopo))).toBe(true);
});

test("P311A preserva nome comercial mas corrige município cadastral", () => {
  expect(REGIONAL.P311A.ativo).toContain("Mega Curitiba");
  expect(REGIONAL.P311A.municipioUF).toBe("Campina Grande do Sul / PR");
  expect(REGIONAL.P311A.fontes[0].escopo).toBe("Campina Grande do Sul");
});

test.each(["P311A", "P311B", "P505"])("%s possui leitura visual rastreável sem grau inventado", (pid) => {
  const r = REGIONAL[pid];
  expect(r.leituraTerritorial.base).toContain("Marcio");
  expect(r.leituraTerritorial.setores).toHaveLength(3);
  r.leituraTerritorial.setores.forEach((s) => {
    expect(s.observacao).toBeTruthy();
    expect(s.implicacao).toMatch(/\bpode(m)?\b/);
    expect(s.acao).toBeTruthy();
    expect(s).not.toHaveProperty("grau");
  });
  expect(r.quadrantes).toEqual([]);
  expect(r.aplicarModulador).toBe(false);
});
