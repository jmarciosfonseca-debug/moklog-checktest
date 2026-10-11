import { novoMapa, postosPadrao, validarParaConcluir, kmRodado, excecoesDoMapa, pessoasRepetidas, itensDeEquipamento, definirSituacaoMaterial, materialNovo } from "./modelo";
import { montarTextoWhatsApp, cabecalhoProjeto, linkWhatsApp } from "./texto";

const H = { inicio: "06:00", fim: "18:00" };
const mapa = (extra = {}) => ({ ...novoMapa({ projetoId: "P311B", data: "2026-10-11", turno: "D", horario: H }), ...extra });
const preencher = (m, nomes) => ({ ...m, postos: m.postos.map((p, i) => ({ ...p, pessoaId: `c${i}`, pessoaNome: nomes[i] })) });

test("postos de partida seguem o mapeamento confirmado", () => {
  expect(postosPadrao("P311B", "D").map((p) => p.rotulo)).toEqual(["L1", "P1", "P2"]);
  expect(postosPadrao("P311A", "D").map((p) => p.rotulo)).toEqual(["Líder", "Tático", "Apoio", "Portaria"]);
  expect(postosPadrao("P311A", "N").map((p) => p.rotulo)).toEqual(["Líder", "Tático", "Portaria"]);
  expect(postosPadrao("P605", "D")[0].rotulo).toBe("Líder/CCO");
  expect(postosPadrao("P601", "D").find((p) => p.rotulo === "VSPP Apoio").horario).toEqual({ inicio: "08:00", fim: "20:00" });
  expect(postosPadrao("P999", "D").length).toBe(3);
});
test("mapa novo: rascunho, material sem alteração já marcado, todos presentes", () => {
  const m = mapa();
  expect(m.id).toBe("P311B_2026-10-11_D");
  expect(m.status).toBe("rascunho");
  expect(m.material.semAlteracao).toBe(true);
  expect(m.postos.every((p) => p.situacao === "presente")).toBe(true);
});
test("pré-preenche do mapa anterior: mesmas pessoas, situação zerada e km anterior = km atual do último", () => {
  const ant = { postos: [{ rotulo: "L1", pessoaId: "a", pessoaNome: "Ana", situacao: "falta" }, { rotulo: "P1", pessoaId: "b", pessoaNome: "Bia" }], veiculos: [{ id: "moto", rotulo: "Moto", kmAtual: 1200 }] };
  const m = novoMapa({ projetoId: "P311B", data: "2026-10-13", turno: "D", horario: H, base: ant });
  expect(m.postos.map((p) => [p.rotulo, p.pessoaNome, p.situacao])).toEqual([["L1", "Ana", "presente"], ["P1", "Bia", "presente"]]);
  expect(m.veiculos[0]).toMatchObject({ kmAnterior: 1200, kmAtual: null });
});
test("pode concluir quando todos os postos têm pessoa e nada pendente", () => {
  expect(validarParaConcluir(preencher(mapa(), ["A", "B", "C"]))).toEqual([]);
});
test("posto sem pessoa só passa se marcado 'Sem ninguém' (campo vazio não vira falta)", () => {
  const m = mapa();
  expect(validarParaConcluir(m).length).toBe(3);
  const ok = { ...m, postos: m.postos.map((p) => ({ ...p, situacao: "vago" })) };
  expect(validarParaConcluir(ok)).toEqual([]);
});
test("exceções exigem o detalhe mínimo", () => {
  const m = preencher(mapa(), ["A", "B", "C"]);
  const com = (i, situacao, detalhe) => ({ ...m, postos: m.postos.map((p, k) => (k === i ? { ...p, situacao, detalhe } : p)) });
  expect(validarParaConcluir(com(0, "atraso", {})).join()).toMatch(/hora de chegada ou os minutos/);
  expect(validarParaConcluir(com(0, "atraso", { minutos: 15 }))).toEqual([]);
  expect(validarParaConcluir(com(0, "atraso", { hora: "06:20" }))).toEqual([]);
  expect(validarParaConcluir(com(1, "cobertura", {})).join()).toMatch(/cobertura de quem/);
  expect(validarParaConcluir(com(1, "cobertura", { deQuem: "Fulano", base: true })).join()).toBeDefined();
  expect(validarParaConcluir(com(2, "troca", {})).join()).toMatch(/no lugar de quem/);
  expect(validarParaConcluir(com(2, "troca", { noLugarDe: "Beto" }))).toEqual([]);
  expect(validarParaConcluir(com(0, "falta", {}))).toEqual([]);
  expect(validarParaConcluir(com(0, "ft", {}))).toEqual([]);
});
test("quilometragem: rodado = atual − anterior; negativo bloqueia", () => {
  expect(kmRodado({ kmAnterior: 1200, kmAtual: 1262 })).toBe(62);
  expect(kmRodado({ kmAnterior: "1200,5", kmAtual: "1210,5" })).toBe(10);
  expect(kmRodado({ kmAnterior: 1200, kmAtual: null })).toBeNull();
  const m = { ...preencher(mapa(), ["A", "B", "C"]), veiculos: [{ rotulo: "Moto", kmAnterior: 1200, kmAtual: 1100 }] };
  expect(validarParaConcluir(m).join()).toMatch(/km atual menor/);
});
test("exceções e pessoas repetidas", () => {
  const m = preencher(mapa(), ["A", "B", "C"]);
  const x = { ...m, postos: m.postos.map((p, i) => (i === 1 ? { ...p, situacao: "falta" } : p)) };
  expect(excecoesDoMapa(x).map((p) => p.rotulo)).toEqual(["P1"]);
  const dup = { ...m, postos: m.postos.map((p, i) => (i === 2 ? { ...p, pessoaId: "c0", pessoaNome: "A" } : p)) };
  expect(pessoasRepetidas(dup)).toEqual([{ pessoa: "A", postos: ["L1", "P2"] }]);
  expect(pessoasRepetidas(m)).toEqual([]);
});

describe("texto do WhatsApp", () => {
  test("formato completo, com dia da semana vindo da data", () => {
    let m = preencher(mapa({ supervisao: { ultimaData: "2026-10-09", supervisor: "Marcio", turno: "Diurno" }, resumo: "Preleção às 06h10, sem alterações." }), ["Luiz D.", "Marta A.", "Ari A."]);
    m = { ...m, veiculos: [{ rotulo: "Moto", kmAnterior: 1200, kmAtual: 1262 }] };
    const t = montarTextoWhatsApp(m, { nomeProjeto: "Mega Itajaí B" });
    expect(t).toContain("*MAPA DE EQUIPE*");
    expect(t).toContain("*Projeto:* P311B — Mega Itajaí B");
    expect(t).toContain("*Turno:* Diurno 06h00–18h00");
    expect(t).toContain("*Data:* Domingo, 11/10/2026");
    expect(t).toContain("• L1: Luiz D.");
    expect(t).toContain("*Faltas/atrasos/FT/trocas:* Sem ocorrências");
    expect(t).toContain("*Material (armamento, munição, rádios):* Sem alteração");
    expect(t).toContain("*Moto:* anterior 1200 · atual 1262 · rodado 62 km");
    expect(t).toContain("*Última visita da supervisão:* 09/10/2026 — Marcio (Diurno)");
    expect(t).toContain("*Resumo da passagem:* Preleção às 06h10, sem alterações.");
  });
  test("exceções saem no posto e no resumo; troca não é FT", () => {
    const m = preencher(mapa(), ["Ana", "Bia", "Caio"]);
    const x = { ...m, postos: [
      { ...m.postos[0], situacao: "atraso", detalhe: { hora: "06:20", minutos: 20 } },
      { ...m.postos[1], situacao: "troca", detalhe: { noLugarDe: "Dani" } },
      { ...m.postos[2], situacao: "cobertura", detalhe: { deQuem: "Edu", base: true } },
    ] };
    const t = montarTextoWhatsApp(x);
    expect(t).toContain("• L1: Ana — atraso, chegou às 06h20 (20 min)");
    expect(t).toContain("• P1: Bia — troca de plantão, no lugar de Dani");
    expect(t).toContain("• P2: Caio (Base) — cobertura de Edu");
    expect(t).not.toMatch(/Bia.*FT/);
    expect(t).toContain("L1 — Atraso; P1 — Troca; P2 — Cobertura");
  });
  test("P260B/C saem com cabeçalho P260-B/C; noturno e posto com horário próprio", () => {
    expect(cabecalhoProjeto("P260B")).toBe("P260-B");
    expect(cabecalhoProjeto("P260C")).toBe("P260-C");
    expect(cabecalhoProjeto("P260A")).toBe("P260A");
    const m = preencher(novoMapa({ projetoId: "P260B", data: "2026-10-11", turno: "N", horario: { inicio: "18:00", fim: "06:00" } }), ["A", "B", "C"]);
    const t = montarTextoWhatsApp(m);
    expect(t).toContain("*Projeto:* P260-B");
    expect(t).toContain("*Turno:* Noturno 18h00–06h00");
    const p601 = preencher(novoMapa({ projetoId: "P601", data: "2026-10-11", turno: "D", horario: H }), ["a", "b", "c", "d", "e"]);
    expect(montarTextoWhatsApp(p601)).toContain("• VSPP Apoio (08h00–20h00): b");
  });
  test("link do WhatsApp codifica o texto", () => {
    expect(linkWhatsApp("a b\n*c*")).toBe("https://wa.me/?text=a%20b%0A*c*");
  });
});

describe("material, armamento e munição", () => {
  const eq = { armamento: [{ id: "a1", identificacao: "Arma 01", calibre: ".38", nSerie: "123", status: "ok" }], municao: [{ id: "m1", identificacao: "Munição .38", qtd: 24, status: "ok" }], radiosHT: [{ id: "r1", identificacao: "Rádio 01", status: "inop" }], placas: [] };
  test("lista conferível vem do cadastro de Equipamentos, com detalhe e status do cadastro", () => {
    const it = itensDeEquipamento(eq);
    expect(it.map((i) => i.nome)).toEqual(["Arma 01", "Munição .38", "Rádio 01"]);
    expect(it[0]).toMatchObject({ categoria: "armamento", detalhe: ".38 · nº 123", cadastro: "ok" });
    expect(it[1].detalhe).toBe("24 un.");
    expect(it[2].cadastro).toBe("inop");
    expect(itensDeEquipamento(null)).toEqual([]);
  });
  test("anomalia tira o 'sem alteração'; voltar para disponível remove a exceção", () => {
    const [arma] = itensDeEquipamento(eq);
    let m = definirSituacaoMaterial(materialNovo(), arma, "anomalia", "Coronha trincada");
    expect(m.semAlteracao).toBe(false);
    expect(m.excecoes).toEqual([expect.objectContaining({ nome: "Arma 01", situacao: "anomalia", obs: "Coronha trincada" })]);
    m = definirSituacaoMaterial(m, arma, "indisponivel");
    expect(m.excecoes[0]).toMatchObject({ situacao: "indisponivel", obs: "Coronha trincada" });
    m = definirSituacaoMaterial(m, arma, "ok");
    expect(m.excecoes).toEqual([]);
  });
  test("conclusão exige observação em cada anomalia e nome no item livre", () => {
    const base = preencher(mapa(), ["A", "B", "C"]);
    const [arma] = itensDeEquipamento(eq);
    const comAnom = { ...base, material: definirSituacaoMaterial(materialNovo(), arma, "anomalia", "") };
    expect(validarParaConcluir(comAnom).join()).toMatch(/Material — Arma 01: descreva a anomalia/);
    const ok = { ...base, material: definirSituacaoMaterial(materialNovo(), arma, "anomalia", "Coronha trincada") };
    expect(validarParaConcluir(ok)).toEqual([]);
    const indisp = { ...base, material: definirSituacaoMaterial(materialNovo(), arma, "indisponivel", "") };
    expect(validarParaConcluir(indisp).join()).toMatch(/descreva a indisponibilidade/);
    const livre = { ...base, material: { ...materialNovo(), semAlteracao: false, excecoes: [{ id: "livre:x", nome: "", situacao: "anomalia", obs: "x y z" }] } };
    expect(validarParaConcluir(livre).join()).toMatch(/informe qual item/);
    const semMarca = { ...base, material: { ...materialNovo(), semAlteracao: false } };
    expect(validarParaConcluir(semMarca).join()).toMatch(/marque "Sem alteração" ou descreva/);
  });
  test("no WhatsApp: sem alteração = conferido; com exceção lista item, situação e observação", () => {
    const base = preencher(mapa(), ["A", "B", "C"]);
    expect(montarTextoWhatsApp(base)).toContain("Sem alteração — conferido e disponível");
    const [arma, mun] = itensDeEquipamento(eq);
    let m = definirSituacaoMaterial(materialNovo(), arma, "anomalia", "Coronha trincada");
    m = definirSituacaoMaterial(m, mun, "indisponivel", "Faltam 6 munições");
    const t = montarTextoWhatsApp({ ...base, material: { ...m, obs: "Acionado o armeiro" } });
    expect(t).toContain("COM ALTERAÇÃO");
    expect(t).toContain("• Arma 01 (.38 · nº 123) — ANOMALIA: Coronha trincada");
    expect(t).toContain("• Munição .38 (24 un.) — INDISPONÍVEL: Faltam 6 munições");
    expect(t).toContain("↳ Acionado o armeiro");
    expect(t).not.toContain("Sem alteração — conferido");
  });
});
