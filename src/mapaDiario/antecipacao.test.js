// Antecipação de plantão (Marcio, 26/10/2026): nova situação do posto; motivo obrigatório —
// "falta de alguém" (quem faltou vai para a ficha; quem antecipou NÃO recebe FT) ou "outro" (texto: VSPP, reciclagem…).
import { SITUACOES, mudarSituacao, definirMotivoAntecipacao, vincularFalta, validarParaConcluir } from "./modelo";
import { lancamentosDoMapa } from "./ficha";
import { montarTextoWhatsApp } from "./texto";

const base = () => ({
  id: "m1", projetoId: "P602", data: "2026-10-26", turno: "D", resumo: "Sem alteração", visita: { houve: false }, material: { excecoes: [] }, veiculos: [],
  postos: [
    { id: "a", rotulo: "Líder", lider: true, pessoaId: "c1", pessoaNome: "Ana", situacao: "presente", detalhe: {} },
    { id: "b", rotulo: "Portaria", pessoaId: "c2", pessoaNome: "Bruno", situacao: "presente", detalhe: {} },
  ],
});
const colabs = [{ id: "c1", nome: "Ana" }, { id: "c2", nome: "Bruno" }, { id: "c3", nome: "Carlos" }];
const errosDe = (m) => validarParaConcluir(m).filter((e) => /Portaria/.test(e));

test("situação existe e exige motivo", () => {
  expect(SITUACOES.some((s) => s.id === "antecipacao")).toBe(true);
  const m = mudarSituacao(base(), "b", "antecipacao");
  expect(errosDe(m).some((e) => /antecipação por quê/i.test(e))).toBe(true);
});

test("motivo falta: exige quem faltou; a falta vai para a ficha e quem antecipou não recebe FT", () => {
  let m = definirMotivoAntecipacao(mudarSituacao(base(), "b", "antecipacao"), "b", "falta");
  expect(errosDe(m).some((e) => /falta de quem/i.test(e))).toBe(true);
  m = vincularFalta(m, "b", "c:c3", colabs);
  expect(errosDe(m)).toEqual([]);
  const lanc = lancamentosDoMapa(m);
  expect(lanc.map((x) => [x.colabId, x.tipo])).toEqual([["c3", "Falta"]]);
  expect(lanc[0].detalhe).toMatch(/antecipação de plantão de Bruno/);
  expect(montarTextoWhatsApp(m)).toMatch(/ANTECIPAÇÃO DE PLANTÃO.*cobrindo a falta de Carlos/);
});

test("motivo outro: exige texto, limpa vínculo de falta e nada vai para a ficha", () => {
  let m = vincularFalta(definirMotivoAntecipacao(mudarSituacao(base(), "b", "antecipacao"), "b", "falta"), "b", "c:c3", colabs);
  m = definirMotivoAntecipacao(m, "b", "outro", "");
  expect(m.postos[1].detalhe.quemFaltouId).toBeUndefined();
  expect(errosDe(m).some((e) => /descreva o motivo/i.test(e))).toBe(true);
  m = definirMotivoAntecipacao(m, "b", "outro", "VSPP");
  expect(errosDe(m)).toEqual([]);
  expect(lancamentosDoMapa(m)).toEqual([]);
  expect(montarTextoWhatsApp(m)).toMatch(/ANTECIPAÇÃO DE PLANTÃO.*motivo: VSPP/);
});
