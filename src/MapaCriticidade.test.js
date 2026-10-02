import { gerarMapaCriticidadeHTML } from "./MapaCriticidade";

test("a cor depende do grau, nunca do lado do quadrante", () => {
  for (const lado of ["NORTE", "SUL"]) {
    const html = gerarMapaCriticidadeHTML({ quadrantes: [{ lado, grau: "GRAVE" }] });
    expect(html).toContain("border-top:4px solid #c2410c");
    expect(html).toContain("não alteram a classificação operacional");
  }
});
test("ausência de quadrantes não vira grau baixo ou moderado", () => {
  const html = gerarMapaCriticidadeHTML({ quadrantes: [] });
  expect(html).toContain("não aferidos");
  expect(html).not.toContain("MODERADO");
});
test("texto do diagnóstico é escapado", () => {
  const html = gerarMapaCriticidadeHTML({ quadrantes: [{ lado: '<script>alert(1)</script>', grau: "BAIXO", vetores: [{ desc: '<img onerror="x">' }] }] });
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<img");
});
