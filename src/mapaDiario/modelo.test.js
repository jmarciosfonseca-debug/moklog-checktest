import { ehPostoExtra, vincularFalta, desfazerVinculoFalta, mudarSituacao, removerPosto, candidatosAFalta, avisoResumoSemExcecao, novoMapa, postosPadrao, validarParaConcluir, kmRodado, excecoesDoMapa, pessoasRepetidas, itensDeEquipamento, resumoItens, definirSituacaoMaterial, materialNovo } from "./modelo";
import { montarTextoWhatsApp, cabecalhoProjeto, linkWhatsApp } from "./texto";

import { postoVazio as postoVazioT } from "./modelo";
const H = { inicio: "06:00", fim: "18:00" };
const mapa = (extra = {}) => ({ ...novoMapa({ projetoId: "P311B", data: "2026-10-11", turno: "D", horario: H }), ...extra });
const preencher = (m, nomes) => ({ ...m, postos: m.postos.map((p, i) => ({ ...p, pessoaId: `c${i}`, pessoaNome: nomes[i] })) });

test("postos de partida seguem o mapeamento confirmado", () => {
  expect(postosPadrao("P311B", "D").map((p) => p.rotulo)).toEqual(["L1 · Vigilante Líder", "P1 · Vigilante CCO", "P2 · Vigilante Honda"]);
  expect(postosPadrao("P311A", "D").map((p) => p.rotulo)).toEqual(["Vigilante Líder", "Vigilante Apoio", "Vigilante Tático", "Porteiro CCO"]);
  expect(postosPadrao("P311A", "N").map((p) => p.rotulo)).toEqual(["Vigilante Líder", "Vigilante Tático", "Porteiro CCO"]);
  expect(postosPadrao("P605", "D")[0].rotulo).toBe("Líder/CCO");
  expect(postosPadrao("P601", "D").find((p) => p.rotulo === "VSPP Apoio/Ronda").horario).toEqual({ inicio: "08:00", fim: "20:00" });
  expect(postosPadrao("P999", "D").length).toBe(3);
  expect(postosPadrao("P607", "D").map((p) => p.rotulo)).toEqual(["Vigilante Honda", "AGP CCO", "Vigilante Pista", "AGP Portaria"]);
  expect(postosPadrao("P607", "N").map((p) => p.rotulo)).toEqual(["Vigilante Honda", "AGP CCO", "Vigilante Pista"]);
  expect(postosPadrao("P505", "D").map((p) => p.rotulo)).toEqual(["VSPP Líder", "VSPP Apoio", "Vigilante CCO", "VSPP Ronda", "CDA"]);
  expect(postosPadrao("P505", "N").map((p) => p.rotulo)).toEqual(["VSPP Líder", "VSPP Apoio", "Vigilante CCO", "CDA"]);
  expect(postosPadrao("P260B", "D").map((p) => p.rotulo)).toEqual(["VSPP"]);
  expect(postosPadrao("P260C", "N").map((p) => p.rotulo)).toEqual(["VSPP Líder", "Vigilante"]);
  expect(postosPadrao("P604", "D").map((p) => p.rotulo)).toContain("Recepção");
  expect(postosPadrao("P605", "D").map((p) => p.rotulo)).toContain("Recepção");
  expect(postosPadrao("P260A", "D", "2026-10-12").map((p) => p.rotulo)).toEqual(["VSPP Líder", "VSPP Apoio 1", "VSPP Apoio 2", "Vigilante CCO"]);
  expect(postosPadrao("P260A", "D", "2026-10-11").map((p) => p.rotulo)).toEqual(["VSPP Líder", "Vigilante CCO"]);
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
  expect(m.postos.map((p) => [p.rotulo, p.pessoaNome, p.situacao])).toEqual([["L1 · Vigilante Líder", "Ana", "presente"], ["P1 · Vigilante CCO", "Bia", "presente"], ["P2 · Vigilante Honda", "", "presente"]]);
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
  expect(validarParaConcluir(com(0, "ft", { quemFaltouId: "z", quemFaltou: "Z" }))).toEqual([]);
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
  expect(excecoesDoMapa(x).map((p) => p.rotulo)).toEqual(["P1 · Vigilante CCO"]);
  const dup = { ...m, postos: m.postos.map((p, i) => (i === 2 ? { ...p, pessoaId: "c0", pessoaNome: "A" } : p)) };
  expect(pessoasRepetidas(dup)).toEqual([{ pessoa: "A", postos: ["L1 · Vigilante Líder", "P2 · Vigilante Honda"] }]);
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
    expect(t).toContain("• L1 · Vigilante Líder: Luiz D.");
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
    expect(t).toContain("• L1 · Vigilante Líder: Ana — atraso, chegou às 06h20 (20 min)");
    expect(t).toContain("• P1 · Vigilante CCO: Bia — troca de plantão, no lugar de Dani");
    expect(t).toContain("• P2 · Vigilante Honda: Caio (Base) — cobertura de Edu");
    expect(t).not.toMatch(/Bia.*FT/);
    expect(t).toContain("L1 · Vigilante Líder — Atraso; P1 · Vigilante CCO — Troca; P2 · Vigilante Honda — Cobertura");
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
    expect(montarTextoWhatsApp(p601)).toContain("• VSPP Apoio/Ronda (08h00–20h00): b");
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

describe("lista de material por projeto", () => {
  const eq = { armamento: [{ id: "a1", identificacao: "Arma 01" }, { id: "a2", identificacao: "Arma 02" }], municao: [{ id: "m1", identificacao: "Munição" }], bodycam: [{ id: "b1", identificacao: "Bodycam 01" }], ztrax: [{ id: "z1", identificacao: "ZTRAX 1" }] };
  test("bodycam e ZTRAX só aparecem no P311A/P311B", () => {
    expect(itensDeEquipamento(eq, "P311A").map((i) => i.nome)).toContain("Bodycam 01");
    expect(itensDeEquipamento(eq, "P311B").map((i) => i.nome)).toContain("ZTRAX 1");
    const p601 = itensDeEquipamento(eq, "P601").map((i) => i.nome);
    expect(p601).not.toContain("Bodycam 01");
    expect(p601).not.toContain("ZTRAX 1");
    expect(p601).toEqual(["Arma 01", "Arma 02", "Munição", "Par de placas balísticas"]);
  });
  test("resumo mostra o que existe no projeto; vai no texto do WhatsApp quando está tudo ok", () => {
    expect(resumoItens(itensDeEquipamento(eq, "P601"))).toBe("Armamento 2 · Munição 1 · Placas balísticas 1");
    expect(resumoItens([])).toBe("");
    const m = preencher(mapa(), ["A", "B", "C"]);
    const t = montarTextoWhatsApp({ ...m, material: { ...materialNovo(), conferidos: "Armamento 2 · Munição 1" } });
    expect(t).toContain("Sem alteração — conferido e disponível (Armamento 2 · Munição 1)");
  });
});

describe("base do Codex por projeto", () => {
  const nomes = (pid, turno, eq = null) => itensDeEquipamento(eq, pid, turno).map((i) => i.nome);
  test("P311A: bodycam e rádios por turno (dia 4/5, noite 3/4); P311B sem bodycam", () => {
    expect(nomes("P311A", "D").filter((n) => n.startsWith("Bodycam"))).toHaveLength(4);
    expect(nomes("P311A", "N").filter((n) => n.startsWith("Bodycam"))).toHaveLength(3);
    expect(nomes("P311A", "D").filter((n) => n.startsWith("Rádio HT"))).toHaveLength(5);
    expect(nomes("P311A", "N").filter((n) => n.startsWith("Rádio HT"))).toHaveLength(4);
    expect(nomes("P311B", "D").some((n) => /Bodycam/.test(n))).toBe(false);
    expect(resumoItens(itensDeEquipamento(null, "P311B", "D"))).toBe("Armamento 2 · Munição 1 · Placas balísticas 4");
  });
  test("quantidades confirmadas pelo Marcio: P601/P602 2 rev. + 36 mun.; P505 3 rev. + 52 mun.; P260C 1 pistola + 1 revólver", () => {
    ["P601", "P602"].forEach((pid) => { expect(nomes(pid, "D").filter((n) => n.startsWith("Revólver .38"))).toHaveLength(2); expect(itensDeEquipamento(null, pid, "D").find((i) => i.categoria === "municao").detalhe).toBe("36 munições"); });
    expect(nomes("P505", "D").filter((n) => n.startsWith("Revólver .38"))).toHaveLength(3);
    expect(itensDeEquipamento(null, "P505", "N").find((i) => i.categoria === "municao").detalhe).toBe("52 munições");
    expect(nomes("P260C", "D").filter((n) => /^(Pistola|Revólver)/.test(n))).toEqual(["Pistola .380", "Revólver .38"]);
  });
  test("projetos sem bodycam; P505 só tem armamento revólver", () => {
    ["P601", "P602", "P604", "P605", "P606", "P607", "P260A", "P260B", "P260C"].forEach((pid) => expect(nomes(pid, "D").some((n) => /Bodycam/.test(n))).toBe(false));
        expect(nomes("P505", "D")).toEqual(expect.arrayContaining(["Lanterna", "Rádio HT", "Smartphone"]));
  });
  test("P260A pistolas .380 x3 e P260B x1; P604 diurno tem rádio/tablet, noturno não", () => {
    expect(nomes("P260A", "D").filter((n) => n.startsWith("Pistola .380"))).toHaveLength(3);
    expect(nomes("P260B", "D").filter((n) => n.startsWith("Pistola .380"))).toHaveLength(1);
    expect(nomes("P604", "D")).toEqual(expect.arrayContaining(["Rádio", "Tablet"]));
    expect(nomes("P604", "N")).not.toContain("Tablet");
  });
  test("cadastro de Equipamentos substitui a base só na categoria que ele cobre", () => {
    const eq = { armamento: [{ id: "a1", identificacao: "Arma 01" }] };
    const it = itensDeEquipamento(eq, "P605", "D");
    expect(it.filter((i) => i.categoria === "armamento").map((i) => i.nome)).toEqual(["Arma 01"]);
    expect(it.filter((i) => i.categoria === "placas")).toHaveLength(2);
  });
  test("projeto fora da base e sem cadastro continua vazio", () => {
    expect(itensDeEquipamento(null, "P999", "D")).toEqual([]);
  });
});

describe("texto do WhatsApp: um bloco por assunto", () => {
  test("linha em branco entre equipe, faltas, material, veículo, supervisão e resumo", () => {
    let m = preencher(mapa({ supervisao: { ultimaData: "2026-10-09", supervisor: "Marcio", turno: "Diurno" }, resumo: "Sem novidades." }), ["A", "B", "C"]);
    m = { ...m, veiculos: [{ rotulo: "Moto", kmAnterior: 1200, kmAtual: 1262 }] };
    const blocos = montarTextoWhatsApp(m).split("\n\n");
    expect(blocos.map((b) => b.split("\n")[0].replace(/\*/g, "").split(":")[0])).toEqual(["MAPA DE EQUIPE", "Equipe", "Faltas/atrasos/FT/trocas", "Material (armamento, munição, rádios)", "Moto", "Última visita da supervisão", "Resumo da passagem"]);
    expect(blocos[1].split("\n")).toHaveLength(4); // título + 3 postos
  });
  test("veículo sem nenhuma leitura não vira linha 'Veículo 2: —'", () => {
    const m = { ...preencher(mapa(), ["A", "B", "C"]), veiculos: [{ rotulo: "Moto", kmAtual: 27854 }, { rotulo: "Veículo 2" }] };
    const t = montarTextoWhatsApp(m);
    expect(t).toContain("*Moto:* atual 27854");
    expect(t).not.toContain("Veículo 2");
  });
});
describe("resumo que fala de exceção sem posto marcado", () => {
  const base = preencher(mapa(), ["A", "B", "C"]);
  test("avisa quando cita extra/FT/falta/atraso e nenhum posto é exceção", () => {
    expect(avisoResumoSemExcecao({ ...base, resumo: "Informo que a vigilante Rosemeire está trabalhando em caráter de extra." })).toMatch(/"extra"/);
    expect(avisoResumoSemExcecao({ ...base, resumo: "Houve atraso do CCO." })).toMatch(/"atraso"/);
  });
  test("não avisa sem palavra de exceção, nem quando já há posto marcado, nem em palavra parecida", () => {
    expect(avisoResumoSemExcecao({ ...base, resumo: "Pneu da moto furado. Extrato conferido." })).toBe("");
    const comFt = { ...base, resumo: "Rosemeire de extra", postos: base.postos.map((p, i) => (i === 0 ? { ...p, situacao: "ft" } : p)) };
    expect(avisoResumoSemExcecao(comFt)).toBe("");
  });
});

test("FT exige 'quem faltou' (ou 'ninguém faltou') e não aceita a própria pessoa", () => {
  const base = preencher(mapa(), ["A", "B", "C"]);
  const com = (detalhe) => ({ ...base, postos: base.postos.map((p, i) => (i === 1 ? { ...p, pessoaId: "x", situacao: "ft", detalhe } : p)) });
  expect(validarParaConcluir(com({})).join("|")).toMatch(/FT cobrindo falta de quem/);
  expect(validarParaConcluir(com({ quemFaltouId: "y", quemFaltou: "Y" }))).toEqual([]);
  expect(validarParaConcluir(com({ semFalta: true }))).toEqual([]);
  expect(validarParaConcluir(com({ quemFaltouId: "x" })).join("|")).toMatch(/própria pessoa/);
});
test("WhatsApp: a FT diz de quem foi a falta coberta", () => {
  const m = mapa();
  const t = montarTextoWhatsApp({ ...m, postos: m.postos.map((p, i) => (i === 0 ? { ...p, pessoaNome: "Rosemeire", situacao: "ft", detalhe: { quemFaltou: "Elaine", quemFaltouId: "e" } } : p)) });
  expect(t).toContain("Rosemeire — FT (folga trabalhada), cobrindo a falta de Elaine");
});

test("FT no posto extra: vincula a falta ao efetivo e desfaz ao sair de FT, remover o extra ou limpar a falta", () => {
  const base = preencher(mapa(), ["A", "B", "C"]);
  const extra = { ...postoVazioT(), id: "x1", rotulo: "Posto extra", pessoaId: "z", pessoaNome: "Zé", situacao: "ft" };
  const m0 = { ...base, postos: [...base.postos, extra] };
  expect(ehPostoExtra(m0, extra)).toBe(true);
  expect(ehPostoExtra(m0, base.postos[0])).toBe(false);
  expect(candidatosAFalta(m0, "x1").map((p) => p.pessoaNome)).toEqual(["A", "B", "C"]);
  const alvo = base.postos[1];
  const m1 = vincularFalta(m0, "x1", `p:${alvo.id}`);
  expect(m1.postos[1]).toMatchObject({ situacao: "falta", detalhe: { porFtDe: "x1" } });
  expect(m1.postos[3].detalhe).toMatchObject({ quemFaltouId: "c1", quemFaltou: "B", faltaPostoId: alvo.id });
  expect(validarParaConcluir(m1)).toEqual([]);
  // trocar quem faltou desfaz o anterior
  const m2 = vincularFalta(m1, "x1", `p:${base.postos[2].id}`);
  expect(m2.postos[1].situacao).toBe("presente");
  expect(m2.postos[2].situacao).toBe("falta");
  // sair de FT desfaz; remover o extra desfaz; limpar a falta no posto limpa o vínculo no FT
  expect(mudarSituacao(m1, "x1", "presente").postos[1].situacao).toBe("presente");
  expect(removerPosto(m1, "x1").postos).toHaveLength(3);
  expect(removerPosto(m1, "x1").postos[1].situacao).toBe("presente");
  const m3 = mudarSituacao(m1, alvo.id, "presente");
  expect(m3.postos[3].detalhe.quemFaltouId).toBeUndefined();
  expect(validarParaConcluir(m3).join("|")).toMatch(/FT cobrindo falta de quem/);
  expect(desfazerVinculoFalta(m0, "x1")).toEqual(m0);
});
