import { montarMatrizEfetivo } from "./matrizEfetivo";
import { ocupacaoDoQuadro, ORDEM_PROJETOS } from "../equipe/quadroPrevisto";

const HOJE = new Date("2026-10-13T15:00:00");
const nomes = { P311A: "Mega CL Curitiba", P601: "Golgi Cajamar" };

test("matriz sem dados de equipe: cabeçalho, 12 unidades, 146 de total e tabelas por escala", () => {
  const h = montarMatrizEfetivo({ nomes, hoje: HOJE });
  expect(h).toContain("Matriz de Dimensionamento de Efetivo");
  expect(h).toContain("MK-ME-20261013");
  expect(h).toContain("Moked Consulting Security");
  expect(h).toContain("146");
  ORDEM_PROJETOS.forEach((pid) => expect(h).toContain(`Total ${pid}`));
  expect(h).toContain("12x36"); expect(h).toContain("4x2"); expect(h).toContain("5x2");
  expect(h).toContain("1 Diurno, 1 Noturno, 1 Folguista");
  expect(h).toContain("não informado nesta emissão");
});

test("matriz com ocupação: P311A mostra 12 ativos, 2 vagas e total de vagas na rede", () => {
  const f = (cargo) => ({ cargo, status: "ativo" });
  const ativos = [...Array(4).fill(f("Vigilante Líder")), ...Array(3).fill(f("Porteiro CCO")), ...Array(4).fill(f("Vigilante Ronda")), f("Vigilante Apoio")];
  const ocupacoes = { P311A: ocupacaoDoQuadro("P311A", ativos) };
  const h = montarMatrizEfetivo({ nomes, ocupacoes, hoje: HOJE });
  expect(h).toContain("Ativos hoje");
  expect(h).toMatch(/Total P311A<\/b><\/td><td class="mk-num"><b>14<\/b><\/td><td class="mk-num"><b>12<\/b><\/td><td class="mk-num"><b>2<\/b>/);
  expect(h).toContain("86%");
});

test("ocupação parcial (unidade sem equipe cadastrada): totais só das unidades com dados, com aviso", () => {
  const ocupacoes = { P311A: ocupacaoDoQuadro("P311A", Array(12).fill({ cargo: "Vigilante Ronda", status: "ativo" })) };
  const h = montarMatrizEfetivo({ nomes, ocupacoes, hoje: HOJE });
  expect(h).toContain("dados de 1 de 12 unidades");
  expect(h).toContain("Totais parciais: 11 unidade(s) sem cadastro");
  expect(h).toContain("86%");
});
