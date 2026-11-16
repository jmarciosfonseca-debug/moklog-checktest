import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { faltasPorProjeto, somarFaltas, textoFalta, textoPlantao, contarFaltasDoMapa } from "./faltasDoDia";
import { plantoesDoAviso } from "./regras";
import { resumoDoPainel } from "../mapaDiario/painel";
import SeloFalta from "./SeloFalta";

jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), doc: jest.fn(), onSnapshot: jest.fn(), getDoc: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = (el) => act(async () => root.render(el));

const agora = new Date("2026-11-14T10:00:00-03:00");
const posto = (id, situacao, extra = {}) => ({ id, rotulo: `Posto ${id}`, pessoaId: `c${id}`, pessoaNome: `Pessoa ${id}`, situacao, ...extra });

describe("falta no posto — contagem por projeto", () => {
  const pls = plantoesDoAviso("P601", agora);
  const atual = pls[0];

  test("há plantão em vigor para o projeto de teste", () => { expect(atual).toBeTruthy(); });

  test("sem falta nem posto vago: projeto não aparece", () => {
    const mapas = { P601: { [atual.chave]: { status: "enviado", postos: [posto(1, "presente"), posto(2, "atraso")] } } };
    expect(faltasPorProjeto({ agora, mapas })).toEqual({});
  });

  test("conta falta e posto vago, inclusive em rascunho", () => {
    const mapas = { P601: { [atual.chave]: { status: "rascunho", postos: [posto(1, "falta"), posto(2, "vago"), posto(3, "presente")] } } };
    const r = faltasPorProjeto({ agora, mapas });
    expect(r.P601.faltas).toBe(1);
    expect(r.P601.vagos).toBe(1);
    expect(r.P601.plantoes[0]).toMatchObject({ data: atual.data, turno: atual.turno });
  });

  test("falta coberta por FT conta uma vez só", () => {
    const postos = [posto(1, "falta", { detalhe: { porFtDe: 9 } }), posto(9, "ft", { detalhe: { quemFaltouId: "c1", quemFaltou: "Pessoa 1", faltaPostoId: 1 } })];
    expect(contarFaltasDoMapa({ postos }, { projetoId: "P601", data: atual.data, turno: atual.turno }).faltas).toBe(1);
  });

  test("mapa fora da janela do dia é ignorado; projeto não lido não gera selo", () => {
    const mapas = { P601: { "P601_2026-11-01_D": { status: "enviado", postos: [posto(1, "falta")] } }, P602: null };
    expect(faltasPorProjeto({ agora, mapas })).toEqual({});
  });

  test("soma do grupo e textos", () => {
    const por = { P601: { faltas: 1, vagos: 0, plantoes: [{ data: "2026-11-14", turno: "D" }] }, P602: { faltas: 2, vagos: 1, plantoes: [] } };
    expect(somarFaltas(por, ["P601", "P602", "P604"])).toEqual({ faltas: 3, vagos: 1 });
    expect(textoFalta(por.P601)).toBe("1 falta");
    expect(textoFalta(por.P602)).toBe("2 faltas · 1 posto vago");
    expect(textoFalta({ faltas: 0, vagos: 0 })).toBe("");
    expect(textoPlantao(por.P601)).toBe("diurno 14/11");
  });
});

describe("selo de falta", () => {
  test("sem falta não desenha nada", async () => {
    await render(<SeloFalta info={{ faltas: 0, vagos: 0 }} />);
    expect(host.firstChild).toBeNull();
  });
  test("com falta mostra o texto e abre ao tocar", async () => {
    const abrir = jest.fn();
    await render(<SeloFalta info={{ faltas: 1, vagos: 0, plantoes: [{ data: "2026-11-14", turno: "N" }] }} detalhe onClick={abrir} />);
    const selo = host.querySelector('[data-testid="selo-falta"]');
    expect(selo.textContent).toContain("1 falta");
    expect(selo.textContent).toContain("noturno 14/11");
    await act(async () => selo.click());
    expect(abrir).toHaveBeenCalled();
  });
});

test("barra do Mapa de Equipe soma as faltas do turno em vigor", () => {
  const v = plantoesDoAviso("P601", agora)[0];
  const r = resumoDoPainel({ agora, projetos: ["P601"], mapas: [{ projetoId: "P601", data: v.data, turno: v.turno, enviadoEm: agora.toISOString(), ocorrencias: 1, faltas: 1, vagos: 0 }] });
  expect(r.faltas).toBe(1);
  expect(r.itens[0].faltas).toBe(1);
});
