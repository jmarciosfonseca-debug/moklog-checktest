import { coletarRegional, REGIONAL } from "./regionalConfig";

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
