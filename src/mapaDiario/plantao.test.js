import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { quemEstaDePlantao, liderDePlantao, turnoDoMapa, rotuloNoPlantao } from "./plantao";
import PlantaoDoMapa, { usePlantaoDoMapa } from "./PlantaoDoMapa";

jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({}));
jest.mock("../fireGuard", () => ({ setDoc: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;

// Campo 18/10: o titular faltou e um colega (ou a Base) cobriu — a ronda continuava com o nome do titular.
const mapa = {
  status: "rascunho",
  postos: [
    { id: "p1", rotulo: "L1 · Vigilante Líder", lider: true, pessoaId: "titular", pessoaNome: "Carlos Titular", situacao: "falta", detalhe: {} },
    { id: "p2", rotulo: "P1 · Vigilante CCO", pessoaId: "b", pessoaNome: "Marta A.", situacao: "presente", detalhe: {} },
    { id: "p3", rotulo: "P2 · Vigilante Ronda", pessoaId: "", pessoaNome: "José da Base", situacao: "cobertura", detalhe: { base: true, livre: true, deQuem: "Ari A.", deQuemId: "c" } },
    { id: "p4", rotulo: "Posto extra", pessoaId: "d", pessoaNome: "João FT", situacao: "ft", detalhe: { quemFaltouId: "titular", faltaPostoId: "p1" } },
    { id: "p5", rotulo: "Apoio", pessoaId: "", pessoaNome: "", situacao: "vago", detalhe: {} },
  ],
};

test("falta e posto vago ficam fora; cobertura (Base), FT e presentes entram", () => {
  const l = quemEstaDePlantao(mapa);
  expect(l.map((x) => x.pessoaNome)).toEqual(["Marta A.", "José da Base", "João FT"]);
  expect(l.find((x) => x.pessoaNome === "José da Base")).toMatchObject({ base: true, situacao: "cobertura", pessoaId: "" });
  expect(liderDePlantao(l)).toBeNull();                       // o líder titular faltou: ninguém no posto de líder
});

test("quem cobre o posto de líder vira o líder do plantão (e vem primeiro)", () => {
  const m = { postos: [mapa.postos[1], { ...mapa.postos[0], pessoaId: "f", pessoaNome: "Folguista Luiz", situacao: "cobertura", detalhe: { deQuem: "Carlos Titular", deQuemId: "titular" } }] };
  const l = quemEstaDePlantao(m);
  expect(l[0]).toMatchObject({ pessoaNome: "Folguista Luiz", lider: true });
  expect(liderDePlantao(l).pessoaNome).toBe("Folguista Luiz");
});

test("saída antecipada: quem saiu sai da lista e quem cobriu entra no mesmo posto", () => {
  const m = { postos: [{ id: "p1", rotulo: "Líder", lider: true, pessoaId: "a", pessoaNome: "Luiz D.", situacao: "presente", saida: { hora: "14:00", coberturas: [{ tipo: "base", pessoaId: "", pessoaNome: "Rui (Base)", de: "14:10" }] } }] };
  expect(quemEstaDePlantao(m)).toEqual([expect.objectContaining({ pessoaNome: "Rui (Base)", lider: true, base: true, situacao: "cobertura", desde: "14:10" })]);
});

test("utilitários: turno e rótulo", () => {
  expect(turnoDoMapa("noturno")).toBe("N");
  expect(turnoDoMapa("Diurno")).toBe("D");
  expect(turnoDoMapa("N")).toBe("N");
  expect(rotuloNoPlantao({ pessoaNome: "José", posto: "P2", situacao: "cobertura", base: true })).toBe("José · P2 (cobertura Base)");
  expect(quemEstaDePlantao(null)).toEqual([]);
});

describe("componente", () => {
  let host, root;
  beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  function Teste({ io, data, turno, onEscolher }) {
    const p = usePlantaoDoMapa("P311B", data, turno, io);
    return <PlantaoDoMapa plantao={p} onEscolher={onEscolher} selecionado="Marta A." />;
  }
  test("lista quem está no mapa do turno pedido; um toque escolhe", async () => {
    const io = { loadPlantaoDoMapa: jest.fn(async () => ({ mapa, pessoas: quemEstaDePlantao(mapa) })) };
    const escolher = jest.fn();
    await act(async () => root.render(<Teste io={io} data="2026-10-18" turno="diurno" onEscolher={escolher} />));
    expect(io.loadPlantaoDoMapa).toHaveBeenCalledWith("P311B", "2026-10-18", "D");
    expect(host.textContent).toContain("diurno 18/10/2026 (rascunho)");
    expect(host.textContent).not.toContain("Carlos Titular");
    expect(host.querySelector('button[aria-label="Usar Marta A. (Mapa de Equipe)"]').getAttribute("aria-pressed")).toBe("true");
    await act(async () => host.querySelector('button[aria-label="Usar José da Base (Mapa de Equipe)"]').click());
    expect(escolher).toHaveBeenCalledWith(expect.objectContaining({ pessoaNome: "José da Base", base: true }));
  });
  test("sem mapa, erro de leitura ou desligado (null): não aparece nada", async () => {
    await act(async () => root.render(<Teste io={{ loadPlantaoDoMapa: async () => null }} data="2026-10-18" turno="D" />));
    expect(host.querySelector('[data-testid="plantao-do-mapa"]')).toBeNull();
    await act(async () => root.render(<Teste io={{ loadPlantaoDoMapa: async () => { throw new Error("offline"); } }} data="2026-10-19" turno="D" />));
    expect(host.querySelector('[data-testid="plantao-do-mapa"]')).toBeNull();
    const io = { loadPlantaoDoMapa: jest.fn() };
    await act(async () => root.render(<Teste io={io} data={null} turno={null} />));
    expect(io.loadPlantaoDoMapa).not.toHaveBeenCalled();
  });
});
