import React, { act } from "react";
import { createRoot } from "react-dom/client";
import VerMapasProjeto, { plantoesRecentes } from "./VerMapasProjeto";

jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), collection: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), doc: jest.fn(), getDoc: jest.fn(), getDocFromServer: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;

const posto = (id, rotulo, pessoaNome, situacao = "presente", detalhe = {}, extra = {}) => ({ id, rotulo, pessoaNome, situacao, detalhe, ...extra });
const NOITE_11 = { projetoId: "P606", data: "2026-10-11", turno: "N", status: "enviado", enviadoEm: "2026-10-11T22:15:00.000Z", resumo: "Moto com pneu furado",
  postos: [posto("l", "Líder", "Luiz Felipe"), posto("c", "CCO", "Rosemeire", "ft", { quemFaltou: "Elaine Farias" }), posto("v", "Vigilante", "Murilo")] };
const DIA_12 = { projetoId: "P606", data: "2026-10-12", turno: "D", status: "enviado", enviadoEm: "2026-10-12T10:00:00.000Z", postos: [posto("l", "Líder", "Roger", "presente", {}, { lider: true }), posto("c", "CCO", "Alessandra")] };
const MAPAS = { "P606_2026-10-12_D": DIA_12, "P606_2026-10-11_N": NOITE_11 };

let host, root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const montar = (ler, lerFotos = async () => null) => act(async () => root.render(<VerMapasProjeto projetoId="P606" data="2026-10-12" turno="D" dark={false} ler={ler} lerFotos={lerFotos} />));
const clicar = async (el) => act(async () => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

test("plantões recentes: o atual e os três anteriores, do mais novo ao mais antigo", () => {
  expect(plantoesRecentes("2026-10-12", "D")).toEqual([{ data: "2026-10-12", turno: "D" }, { data: "2026-10-11", turno: "N" }, { data: "2026-10-11", turno: "D" }, { data: "2026-10-10", turno: "N" }]);
  expect(plantoesRecentes("2026-10-01", "N")).toEqual([{ data: "2026-10-01", turno: "N" }, { data: "2026-10-01", turno: "D" }, { data: "2026-09-30", turno: "N" }, { data: "2026-09-30", turno: "D" }]);
});

test("mostra 4 plantões, o atual já aberto com o mapa visual; os outros abrem ao tocar", async () => {
  const ler = jest.fn(async (pid, chave) => MAPAS[chave] || null);
  await montar(ler);
  expect(ler.mock.calls.map((c) => c[1])).toEqual(["P606_2026-10-12_D", "P606_2026-10-11_N", "P606_2026-10-11_D", "P606_2026-10-10_N"]);
  const cab = [...host.querySelectorAll('[role="button"]')];
  expect(cab).toHaveLength(4);
  expect(cab[0].textContent).toContain("Plantão atual");
  expect(cab[1].textContent).toContain("Anterior");
  expect(cab[2].textContent).toContain("Sem mapa");
  // atual aberto: efetivo visível
  expect(host.querySelector('[data-testid="mapa-visual"]').textContent).toContain("Roger");
  expect(host.textContent).not.toContain("Moto com pneu furado");
  // abre o anterior: FT + a falta de quem foi coberto aparece
  await clicar(cab[1]);
  const vis = host.querySelector('[data-testid="mapa-visual"]').textContent;
  expect(vis).toContain("Moto com pneu furado");
  expect(vis).toContain("Elaine Farias");
  expect(vis).toContain("Falta");
  expect(vis).toContain("FT");
  expect(cab[1].textContent).toContain("1 falta");
  expect(cab[1].textContent).toContain("1 FT");
  // plantão sem mapa explica
  await clicar([...host.querySelectorAll('[role="button"]')][2]);
  expect(host.textContent).toContain("Não há mapa para este plantão.");
});

test("plantão atual ainda sem mapa e falha de leitura são ditos com clareza", async () => {
  await montar(jest.fn(async (pid, chave) => { if (chave.includes("10-11_N")) throw new Error("offline"); return null; }));
  expect(host.textContent).toContain("Este plantão ainda não tem mapa preenchido.");
  const cab = [...host.querySelectorAll('[role="button"]')];
  expect(cab[1].textContent).toContain("Não consegui ler");
});

test("rascunho aparece como não concluído", async () => {
  await montar(jest.fn(async (pid, chave) => (chave === "P606_2026-10-12_D" ? { ...DIA_12, status: "rascunho", enviadoEm: undefined } : null)));
  expect(host.textContent).toContain("Rascunho");
  expect(host.querySelector('[data-testid="mapa-visual"]').textContent).toContain("Rascunho — ainda não concluído");
});

test("foto do cadastro aparece no mapa; quem não tem foto mostra iniciais; falha na foto não derruba o mapa", async () => {
  const ler = async (pid, chave) => MAPAS[chave] || null;
  const MAPAS_ID = { ...MAPAS, "P606_2026-10-12_D": { ...DIA_12, postos: [posto("l", "Líder", "Roger Dias", "presente", {}, { lider: true, pessoaId: "r" }), posto("c", "CCO", "Alessandra Rocha", "presente", {}, { pessoaId: "a" })] } };
  await montar(async (pid, chave) => MAPAS_ID[chave] || null, async () => ({ porId: { r: "data:image/jpeg;base64,QUJD" }, porNome: {} }));
  const vis = host.querySelector('[data-testid="mapa-visual"]');
  expect(vis.querySelectorAll('img[data-testid="avatar-foto"]')).toHaveLength(1);
  expect(vis.querySelector('[data-testid="avatar-iniciais"]').textContent).toBe("AR");
  await act(async () => root.unmount()); root = createRoot(host);
  await montar(ler, async () => { throw new Error("sem foto"); });
  expect(host.querySelector('[data-testid="mapa-visual"]').textContent).toContain("Roger");
  expect(host.querySelectorAll('img[data-testid="avatar-foto"]')).toHaveLength(0);
});

// ── Cartão de identidade no painel gerencial (Marcio, 20/11/2026) ──
const FOTOS = { porId: {}, porNome: {} };
test("gerencial: tocar na pessoa do mapa abre o cartão de identidade e completa com a ficha (cargo, turno, desde, treinos)", async () => {
  const lerColabs = jest.fn(async () => [{ id: "p1", nome: "Luiz Felipe", cargo: "VSPP Líder", turno: "Noturno", desde: "2023-10-10", treinos: 6 }]);
  const mapa = { ...NOITE_11, postos: [posto("l", "Líder", "Luiz Felipe", "presente", {}, { pessoaId: "p1", lider: true }), posto("v", "Vigilante", "Murilo")] };
  await act(async () => root.render(<VerMapasProjeto projetoId="P606" data="2026-10-11" turno="N" dark ler={async () => mapa} lerFotos={async () => FOTOS} lerColabs={lerColabs} />));
  await act(async () => { await Promise.resolve(); });
  expect(host.querySelector('[data-testid="cartao-identidade"]')).toBeNull();
  const linha = [...host.querySelectorAll('[data-testid="posto-linha"]')][0];
  await clicar(linha);
  await act(async () => { await Promise.resolve(); });
  const cartao = document.querySelector('[data-testid="cartao-identidade"]');
  expect(cartao).not.toBeNull();
  expect(cartao.textContent).toContain("IDENTIFICAÇÃO");
  expect(cartao.textContent).toContain("Luiz Felipe");
  expect(cartao.textContent).toContain("LÍDER DO PLANTÃO");
  expect(cartao.textContent).toContain("VSPP Líder");
  expect(cartao.textContent).toContain("Noturno");
  expect(cartao.textContent).toContain("10/10/2023");
  expect(cartao.textContent).toContain("6 registrados");
  expect(lerColabs).toHaveBeenCalledTimes(1);
  await clicar(document.querySelector('button[aria-label="Fechar"]'));
  expect(document.querySelector('[data-testid="cartao-identidade"]')).toBeNull();
});
test("gerencial: se a ficha não puder ser lida, o cartão abre com o que o mapa tem; com onPessoa de fora (cliente) o cartão interno não abre", async () => {
  const mapa = { ...NOITE_11, postos: [posto("v", "Vigilante", "Murilo", "falta")] };
  await act(async () => root.render(<VerMapasProjeto projetoId="P606" data="2026-10-11" turno="N" dark ler={async () => mapa} lerFotos={async () => FOTOS} lerColabs={async () => { throw new Error("offline"); }} />));
  await act(async () => { await Promise.resolve(); });
  await clicar(host.querySelector('[data-testid="posto-linha"]'));
  await act(async () => { await Promise.resolve(); });
  const c = document.querySelector('[data-testid="cartao-identidade"]');
  expect(c.textContent).toContain("Murilo");
  expect(c.textContent).toContain("Falta");
  await clicar(document.querySelector('button[aria-label="Fechar"]'));
  const fora = jest.fn();
  await act(async () => root.render(<VerMapasProjeto projetoId="P606" data="2026-10-11" turno="N" dark ler={async () => mapa} lerFotos={async () => FOTOS} onPessoa={fora} />));
  await act(async () => { await Promise.resolve(); });
  await clicar(host.querySelector('[data-testid="posto-linha"]'));
  expect(fora).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[data-testid="cartao-identidade"]')).toBeNull();
});
