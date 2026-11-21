// Ronda Virtual: o trabalho da operadora não pode sumir (20/11/2026, reclamação do P260A CCO).
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import RondaVirtual from "./RondaVirtual";
import { onSnapshot } from "firebase/firestore";
import { setDoc as fgSetDoc } from "./fireGuard";
jest.mock("firebase/firestore", () => ({ onSnapshot: jest.fn() }));
jest.mock("./fireGuard", () => ({ setDoc: jest.fn(async () => {}) }));
jest.mock("./mapaDiario/PlantaoDoMapa", () => ({ __esModule: true, default: () => null, usePlantaoDoMapa: () => [] }));
global.IS_REACT_ACT_ENVIRONMENT = true;

const feita = (inicio, fim) => ({ inicio, fim, atrasada: false, naoExec: false, anomalia: false });
const turnoBase = (extra = {}) => ({ id: "t1", tipo: "noturno", dataInicio: "2026-11-20", arquivado: false, plantonista: { id: "p1", nome: "Ilma", cargo: "Vigilante CCO" },
  rondas: { 0: feita("18:01", "18:03"), 60: feita("19:01", "19:03"), 120: feita("20:01", "20:03") }, ...extra });

let cbSnap, getDoc;
const montar = async (turnos) => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  onSnapshot.mockImplementation((ref, cb) => { cbSnap = cb; cb({ exists: () => true, data: () => ({ turnos }) }); return () => {}; });
  await act(async () => root.render(<RondaVirtual project={{ id: "P260A", name: "Jatinox A" }} dark S={{}} adminAuth={false} loadEquipe={async () => []} db={{}} doc={() => ({})} setDoc={() => {}} getDoc={getDoc} />));
  return { host, root };
};
const botao = (host, t) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(t));
const clicar = async (host, t) => { const b = botao(host, t); expect(b).toBeTruthy(); await act(async () => { b.click(); }); };
const esperar = async (ciclos = 8) => { for (let i = 0; i < ciclos; i++) await act(async () => { jest.advanceTimersByTime(500); }); };
const desmontar = async (m) => { await act(async () => m.root.unmount()); m.host.remove(); };

beforeEach(() => {
  jest.useFakeTimers("modern"); jest.setSystemTime(new Date(2026, 10, 20, 21, 2)); // sexta 20/11 (feriado), 21:02
  localStorage.clear(); fgSetDoc.mockClear(); fgSetDoc.mockImplementation(async () => {});
  getDoc = jest.fn(async () => ({ exists: () => true, data: () => ({ turnos: [turnoBase()] }) }));
  window.confirm = jest.fn(() => true);
});
afterEach(() => { jest.useRealTimers(); });

test("leitura do servidor falhou: NÃO grava a lista local por cima do servidor, avisa e mantém a ronda na tela", async () => {
  getDoc = jest.fn(async () => { throw new Error("offline"); });
  const m = await montar([turnoBase()]);
  await clicar(m.host, "Iniciar"); await esperar();
  expect(fgSetDoc).not.toHaveBeenCalled();
  expect(m.host.textContent).toContain("Falha ao salvar a ronda");
  expect(m.host.textContent).toMatch(/Início\s*21:02/); // a operadora continua vendo o que registrou
  // voltou o sinal: tentar de novo grava, com a ronda
  getDoc = jest.fn(async () => ({ exists: () => true, data: () => ({ turnos: [turnoBase()] }) }));
  await desmontar(m);
});

test("concluir e arquivar no MEIO do plantão pede confirmação (e não arquiva se cancelar)", async () => {
  const m = await montar([turnoBase()]);
  window.confirm = jest.fn(() => false);
  await clicar(m.host, "Concluir e arquivar"); await esperar();
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(window.confirm.mock.calls[0][0]).toMatch(/ainda está em andamento/);
  expect(fgSetDoc).not.toHaveBeenCalled();
  expect(m.host.textContent).toContain("Ativos (1)");
  await desmontar(m);
});

test("turno ativo que o servidor 'perdeu' (outro aparelho sobrescreveu) continua na tela e é regravado", async () => {
  const m = await montar([turnoBase()]);
  await clicar(m.host, "Iniciar"); await esperar(); // grava com sucesso → o aparelho passa a "dono" confirmado do turno
  expect(fgSetDoc).toHaveBeenCalledTimes(1);
  fgSetDoc.mockClear();
  await act(async () => { cbSnap({ exists: () => true, data: () => ({ turnos: [], updatedAt: "outro-aparelho" }) }); });
  await esperar();
  expect(m.host.textContent).toContain("Ativos (1)"); // não sumiu
  expect(fgSetDoc).toHaveBeenCalledTimes(1); // regravou
  expect(JSON.stringify(fgSetDoc.mock.calls[0][1].turnos)).toContain("Ilma");
  await desmontar(m);
});

test("aviso quando o registro do projeto chega perto do limite de 1 MB do banco", async () => {
  const gordo = Array.from({ length: 60 }, (_, i) => turnoBase({ id: "x" + i, arquivado: true, dataInicio: "2026-09-" + String((i % 28) + 1).padStart(2, "0"), rondas: { 0: { ...feita("18:01", "18:02"), obs: "x".repeat(14000) } } }));
  const m = await montar(gordo);
  expect(m.host.textContent).toMatch(/Registro de rondas quase no limite/);
  await desmontar(m);
});
