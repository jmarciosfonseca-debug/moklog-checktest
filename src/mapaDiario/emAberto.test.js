import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { emAbertoDosItens, emAbertoDoMapa, desdeDoItem, linhaEmAberto, rotuloDias } from "./emAberto";
import { itensDeEquipamento } from "./modelo";
import { montarTextoWhatsApp } from "./texto";
import MapaVisual from "./MapaVisual";
import { gerarConsolidadoMapasHTML } from "../relatorios/consolidadoMapasRelatorio";
import { consolidar } from "./consolidado";

global.IS_REACT_ACT_ENVIRONMENT = true;
const AGORA = new Date("2026-11-20T21:00:00-03:00");

const cadastro = {
  armamento: [
    { id: "a1", identificacao: "Revólver 01", status: "ok" },
    { id: "a2", identificacao: "Revólver 02", status: "inop", dataProblem: "2026-11-17", justificativa: "Gatilho travando" },
  ],
  radiosHT: [{ id: "r1", identificacao: "Rádio HT 03", status: "parcial", dataProblem: "2026-11-19", justificativa: "Bateria fraca" }],
  bodycam: [{ id: "b3", identificacao: "Obra Apoio/Bodycam 03/Ok.", status: "parcial", dataProblem: "2026-11-20", justificativa: "Conector de transferência danificado." }],
  municao: [{ id: "m1", identificacao: "Munição .38", qtd: 0, status: "inop", dataProblem: "2026-11-18", justificativa: "acabou" }],
  lanternas: [{ id: "l1", identificacao: "Lanterna 01", status: "inop", ocorrencias: [{ abertaEm: "2026-11-10", status: "inop", fechadaEm: "2026-11-12" }, { abertaEm: "2026-11-18", status: "inop" }] }],
};

describe("emAbertoDosItens — parcial/inoperante do cadastro de Equipamentos", () => {
  const itens = itensDeEquipamento(cadastro, "P311A", "D");
  const lista = emAbertoDosItens(itens, AGORA);

  test("pega só parcial e inoperante; ok e munição ficam de fora", () => {
    const nomes = lista.map((x) => x.nome);
    expect(nomes).toEqual(expect.arrayContaining(["Revólver 02", "Rádio HT 03", "Obra Apoio/Bodycam 03/Ok.", "Lanterna 01"]));
    expect(nomes).not.toContain("Revólver 01");
    expect(nomes.some((n) => /Munição/.test(n))).toBe(false);
  });
  test("conta os dias em aberto (hoje = 0) e usa a ocorrência aberta quando falta a data", () => {
    const por = Object.fromEntries(lista.map((x) => [x.nome, x]));
    expect(por["Revólver 02"].dias).toBe(3);
    expect(por["Rádio HT 03"].dias).toBe(1);
    expect(por["Obra Apoio/Bodycam 03/Ok."].dias).toBe(0);
    expect(por["Lanterna 01"].dias).toBe(2);
    expect(por["Lanterna 01"].desde).toBe("2026-11-18");
  });
  test("inoperante vem antes de parcial; dentro de cada um, o mais antigo primeiro", () => {
    expect(lista.map((x) => x.nome)).toEqual(["Revólver 02", "Lanterna 01", "Rádio HT 03", "Obra Apoio/Bodycam 03/Ok."]);
    expect(lista.map((x) => x.status)).toEqual(["inoperante", "inoperante", "parcial", "parcial"]);
  });
  test("campos simples, sem undefined (o mapa vai para o Firestore)", () => {
    lista.forEach((x) => Object.values(x).forEach((v) => expect(v).not.toBeUndefined()));
  });
  test("sem cadastro ou item sem data: não quebra e não inventa dias", () => {
    expect(emAbertoDosItens(null, AGORA)).toEqual([]);
    const semData = emAbertoDosItens(itensDeEquipamento({ radiosHT: [{ id: "x", identificacao: "Rádio 9", status: "inop" }] }, "P311A", "D"), AGORA);
    expect(semData[0].dias).toBeNull();
    expect(linhaEmAberto(semData[0])).toBe("Rádio 9 — inoperante");
  });
  test("resolvido em Equipamentos (status ok) some sozinho", () => {
    const resolvido = { ...cadastro, armamento: [{ id: "a2", identificacao: "Revólver 02", status: "ok", dataProblem: "", justificativa: "" }] };
    expect(emAbertoDosItens(itensDeEquipamento(resolvido, "P311A", "D"), AGORA).map((x) => x.nome)).not.toContain("Revólver 02");
  });
  test("desdeDoItem e rotuloDias", () => {
    expect(desdeDoItem({ dataProblem: "2026-11-01" })).toBe("2026-11-01");
    expect(desdeDoItem({ ocorrencias: [{ abertaEm: "2026-11-02", fechadaEm: "2026-11-03" }] })).toBe("");
    expect([0, 1, 5, null].map(rotuloDias)).toEqual(["desde hoje", "há 1 dia", "há 5 dias", ""]);
  });
});

const mapaComAberto = {
  id: "P311A_2026-11-20_N", projetoId: "P311A", data: "2026-11-20", turno: "N", status: "enviado", enviadoEm: "2026-11-20T21:05:00.000Z",
  postos: [{ id: "l", rotulo: "Líder", pessoaNome: "Carlos", situacao: "presente", lider: true }],
  material: { semAlteracao: true, obs: "", excecoes: [], emAberto: emAbertoDosItens(itensDeEquipamento(cadastro, "P311A", "N"), AGORA) },
};

test("WhatsApp: bloco próprio, separado por linha em branco, com status e dias", () => {
  const t = montarTextoWhatsApp(mapaComAberto);
  expect(t).toContain("\n\n⚠️ *EQUIPAMENTOS EM ABERTO*\n• Revólver 02 — inoperante há 3 dias · Gatilho travando\n• Lanterna 01 — inoperante há 2 dias\n• Rádio HT 03 — parcial há 1 dia · Bateria fraca\n• Obra Apoio/Bodycam 03/Ok. — parcial desde hoje");
});
test("WhatsApp: sem item em aberto o bloco nem aparece", () => {
  const t = montarTextoWhatsApp({ ...mapaComAberto, material: { semAlteracao: true, obs: "", excecoes: [], emAberto: [] } });
  expect(t).not.toContain("EQUIPAMENTOS EM ABERTO");
  expect(montarTextoWhatsApp({ ...mapaComAberto, material: { semAlteracao: true, obs: "", excecoes: [] } })).not.toContain("EQUIPAMENTOS EM ABERTO");
  expect(emAbertoDoMapa({})).toEqual([]);
});
test("VER (MapaVisual): linhas discretas com triângulo", () => {
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<MapaVisual mapa={mapaComAberto} dark />));
  const linhas = [...host.querySelectorAll('[data-testid="em-aberto"]')].map((n) => n.textContent);
  expect(linhas).toHaveLength(4);
  expect(linhas[0]).toContain("⚠ Revólver 02 — inoperante há 3 dias");
  act(() => root.unmount()); host.remove();
});
test("PDF consolidado: linha Equipamentos em aberto no mapa", () => {
  const html = gerarConsolidadoMapasHTML({ resultado: consolidar([mapaComAberto], { de: "2026-11-01", ate: "2026-11-30" }), nomeProj: (p) => p, hoje: new Date("2026-11-21T12:00:00"), detalhado: true });
  expect(html).toContain("Equipamentos em aberto:");
  expect(html).toContain("Revólver 02 — inoperante há 3 dias · Gatilho travando");
});
