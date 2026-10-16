import { padronizarNome, listaSugestoes } from "./nomes";
test("padroniza espaços e caixa, mantendo de/da/do minúsculos", () => {
  expect(padronizarNome("  joão   DA silva ")).toBe("João da Silva");
  expect(padronizarNome("maria d'ávila-souza")).toBe("Maria D'Ávila-Souza");
  expect(padronizarNome("")).toBe("");
});
test("sugestões: equipe primeiro, depois já digitados, sem repetir", () => {
  const l = listaSugestoes([{ nome: "ana lima" }, { nome: "Beto Souza" }], ["ANA LIMA", "carlos  dias", "Beto souza", "João"]);
  expect(l).toEqual(["Ana Lima", "Beto Souza", "Carlos Dias", "João"]);
});
