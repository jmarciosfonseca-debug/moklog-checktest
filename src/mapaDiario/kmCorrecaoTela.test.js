import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MapaDiarioTela from "./MapaDiarioTela";

global.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({}));
jest.mock("../fireGuard", () => ({ setDoc: jest.fn(() => { throw new Error("Gravação real proibida neste teste"); }) }));

const AGORA = new Date("2026-10-11T09:00:00-03:00");
const colabs = [
  { id: "a", nome: "Luiz D.", cargo: "Vigilante Líder", turno: "Diurno", emFerias: false },
  { id: "b", nome: "Marta A.", cargo: "Vig CCO", turno: "Diurno", emFerias: false },
  { id: "c", nome: "Ari A.", cargo: "Vigilante Ronda", turno: "Diurno", emFerias: false },
];
const ULTIMO = { id: "P311B_2026-10-10_N", data: "2026-10-10", turno: "N", status: "enviado", enviadoEm: "2026-10-10T21:00:00.000Z", veiculos: [{ id: "moto", rotulo: "Moto", kmAnterior: 71290, kmAtual: 713300 }] };
let host, root, io, enviados;
const q = (sel) => host.querySelector(sel);
const botao = (txt) => [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === txt);
const clicar = async (el) => act(async () => el.click());
const digitar = async (el, v) => act(async () => { const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });
const montar = async (extra = {}) => {
  enviados = [];
  io = {
    loadColaboradores: jest.fn(async () => colabs),
    loadMapa: jest.fn(async () => null),
    loadUltimoMapa: jest.fn(async () => ({ postos: [{ rotulo: "L1", pessoaId: "a", pessoaNome: "Luiz D." }, { rotulo: "P1", pessoaId: "b", pessoaNome: "Marta A." }, { rotulo: "P2", pessoaId: "c", pessoaNome: "Ari A." }], veiculos: [] })),
    loadUltimoPlantao: jest.fn(async () => ULTIMO),
    loadEquipamentos: jest.fn(async () => ({})),
    loadUltimaVisita: jest.fn(async () => null),
    saveMapa: jest.fn(async (m) => m),
    enviarMapa: jest.fn(async (m) => { enviados.push(m); return m; }),
    corrigirKmNoMapaAnterior: jest.fn(async () => ({ atualizado: true })),
    atualizarKmMotoNoCadastro: jest.fn(async () => ({ atualizado: true })),
    ...extra,
  };
  await act(async () => root.render(<MapaDiarioTela project={{ id: "P311B", name: "Mega Itajaí" }} dark onBack={() => {}} io={io} agoraFn={() => AGORA} />));
  await act(async () => { await Promise.resolve(); });
  await digitar(q('textarea[aria-label="Resumo da passagem"]'), "Sem alteração");
  await clicar(botao("Não houve"));
};
beforeEach(() => { window.confirm = jest.fn(() => true); jest.useFakeTimers("modern"); jest.setSystemTime(AGORA); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); jest.useRealTimers(); });

test("baixa da lanterna pelo mapa (Substituída): sai da lista, a nova é cadastrada e o WhatsApp registra", async () => {
  const xrt = { id: "l1", identificacao: "XRT-6000A", qtd: 1, status: "ok" };
  await montar({
    loadUltimoPlantao: jest.fn(async () => ({ ...ULTIMO, veiculos: [{ id: "moto", rotulo: "Moto", kmAtual: 71330 }] })),
    loadEquipamentos: jest.fn(async () => ({ lanternas: [xrt] })),
    darBaixaItemEquipamento: jest.fn(async () => ({ lanternas: [], baixados: [xrt] })),
    adicionarItemEquipamento: jest.fn(async () => ({ lanternas: [{ id: "n1", identificacao: "Lanterna tática 01", qtd: 1, status: "ok" }] })),
  });
  await clicar(q('button[aria-label="Conferir material"]'));
  await clicar(q('button[aria-label="XRT-6000A: Indisponível"]'));        // exceção marcada antes da baixa
  await clicar(q('button[aria-label="Dar baixa: XRT-6000A"]'));
  await clicar(botao("Confirmar baixa"));
  expect(q('[data-testid="baixa-item"] [role="alert"]').textContent).toContain("Escolha o motivo");
  await act(async () => { const s = q('select[aria-label="Motivo da baixa: XRT-6000A"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(s, "Substituído"); s.dispatchEvent(new Event("change", { bubbles: true })); });
  await digitar(q('input[aria-label="Item que entrou no lugar de XRT-6000A"]'), "Lanterna tática 01");
  await clicar(botao("Confirmar baixa"));
  expect(io.darBaixaItemEquipamento).toHaveBeenCalledWith("P311B", "lanternas:l1", { motivo: "Substituído", obs: "", por: "Luiz D." });
  expect(io.adicionarItemEquipamento).toHaveBeenCalledWith("P311B", "lanternas", { identificacao: "Lanterna tática 01", qtd: 1 });
  expect(host.textContent).toContain("XRT-6000A: baixa registrada (Substituído). Lanterna tática 01 cadastrado no lugar.");
  expect(q('button[aria-label="Dar baixa: XRT-6000A"]')).toBeNull();
  expect(q('button[aria-label="Dar baixa: Lanterna tática 01"]')).not.toBeNull();
  await digitar(q('input[aria-label="Km atual Moto"]'), "71380");
  await clicar(botao("Concluir mapa"));
  expect(io.enviarMapa).toHaveBeenCalledTimes(1);                         // a exceção da XRT saiu junto com a baixa
  expect(enviados[0].material.baixas).toEqual([expect.objectContaining({ id: "lanternas:l1", nome: "XRT-6000A", motivo: "Substituído", substituto: "Lanterna tática 01" })]);
  expect(enviados[0].material.excecoes).toEqual([]);
  expect(q('pre[aria-label="Texto do mapa"]').textContent).toContain("🔻 XRT-6000A — baixa: Substituído · entrou: Lanterna tática 01");
});

test("km anterior errado (713300): líder corrige com motivo, conclui e o plantão do erro recebe o km certo", async () => {
  await montar();
  expect(host.textContent).toContain("anterior 713300");
  await digitar(q('input[aria-label="Km atual Moto"]'), "71380");
  expect(host.textContent).toContain('toque em "Corrigir km anterior"');
  await clicar(botao("Concluir mapa"));
  expect(io.enviarMapa).not.toHaveBeenCalled();                       // trava continua valendo sem correção

  await clicar(q('button[aria-label="Corrigir km anterior Moto"]'));
  await clicar(botao("Salvar correção"));
  expect(q('[data-testid="corrigir-km"]').textContent).toContain("Informe o km correto");
  await digitar(q('input[aria-label="Km anterior correto Moto"]'), "71330");
  await digitar(q('input[aria-label="Motivo da correção do km"]'), "Erro de digitação no plantão anterior");
  await clicar(botao("Salvar correção"));
  expect(host.textContent).toContain("anterior 71330 (corrigido)");
  expect(host.textContent).toContain("rodou 50 km");

  await clicar(botao("Concluir mapa"));
  expect(io.enviarMapa).toHaveBeenCalledTimes(1);
  const moto = enviados[0].veiculos.find((v) => v.id === "moto");
  expect(moto).toMatchObject({ kmAnterior: 71330, kmAtual: 71380, kmAnteriorDe: "P311B_2026-10-10_N", correcaoKm: { de: 713300, para: 71330, por: "Luiz D." } });
  expect(io.corrigirKmNoMapaAnterior).toHaveBeenCalledWith("P311B", "P311B_2026-10-10_N", "moto", 71330, expect.objectContaining({ motivo: "Erro de digitação no plantão anterior", porMapa: enviados[0].id }));
  expect(io.atualizarKmMotoNoCadastro).toHaveBeenCalled();
  expect(q('pre[aria-label="Texto do mapa"]').textContent).toContain("corrigido; era 713300");
});

test("sem correção não chama a gravação no plantão anterior", async () => {
  await montar({ loadUltimoPlantao: jest.fn(async () => ({ ...ULTIMO, veiculos: [{ id: "moto", rotulo: "Moto", kmAtual: 71330 }] })) });
  await digitar(q('input[aria-label="Km atual Moto"]'), "71380");
  await clicar(botao("Concluir mapa"));
  expect(io.enviarMapa).toHaveBeenCalledTimes(1);
  expect(io.corrigirKmNoMapaAnterior).not.toHaveBeenCalled();
});

test("moto substituída no cadastro: o mapa abre com o km inicial da nova e conclui sem trava", async () => {
  await montar({ loadEquipamentos: jest.fn(async () => ({ moto: { placa: "XYZ9K88", km: 1250, kmInicial: 1250, trocadaEm: "2026-10-11T08:00:00.000Z", anteriores: [{ placa: "ABC1D23" }] } })) });
  expect(host.textContent).toContain("Moto XYZ9K88 · anterior 1250");
  expect(host.textContent).toContain("Moto substituída em 11/10/2026 (antes ABC1D23)");
  await digitar(q('input[aria-label="Km atual Moto"]'), "1262");
  await clicar(botao("Concluir mapa"));
  expect(io.enviarMapa).toHaveBeenCalledTimes(1);
  expect(enviados[0].veiculos.find((v) => v.id === "moto")).toMatchObject({ placa: "XYZ9K88", kmAnterior: 1250, kmAtual: 1262 });
});
