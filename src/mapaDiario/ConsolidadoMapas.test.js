import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ConsolidadoMapas, { validarPeriodo } from "./ConsolidadoMapas";

jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), collection: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), doc: jest.fn(), getDoc: jest.fn(), getDocFromServer: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;

const posto = (id, rotulo, pessoaNome, situacao = "presente", detalhe = {}, extra = {}) => ({ id, rotulo, pessoaNome, situacao, detalhe, ...extra });
const MAPAS = [
  { projetoId: "P606", data: "2026-10-11", turno: "N", status: "enviado", postos: [posto("l", "Líder", "Marcos", "presente", {}, { lider: true }), posto("c", "CCO", "Elaine", "falta", { porFtDe: "f" }), posto("f", "Posto extra", "Rosemeire", "ft", { quemFaltou: "Elaine" })] },
  { projetoId: "P601", data: "2026-10-10", turno: "D", status: "enviado", postos: [posto("l", "Líder", "Carlos", "presente", {}, { lider: true })] },
];
const agora = () => new Date("2026-10-12T12:00:00-03:00");

let host, root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

const montar = (props) => act(async () => root.render(<ConsolidadoMapas dark={false} agora={agora} projetos={["P601", "P606"]} {...props} />));
const clicarTexto = async (t) => { const b = [...host.querySelectorAll("button")].find((x) => x.textContent.includes(t)); expect(b).toBeTruthy(); await act(async () => b.dispatchEvent(new MouseEvent("click", { bubbles: true }))); };
const definir = async (label, valor) => {
  const el = host.querySelector(`[aria-label="${label}"]`);
  const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, "value").set.call(el, valor); el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
};
const resumo = () => host.querySelector('[data-testid="consolidado-resumo"]').textContent;

test("validarPeriodo", () => {
  expect(validarPeriodo("2026-10-01", "2026-10-11")).toBe("");
  expect(validarPeriodo("2026-10-11", "2026-10-01")).toMatch(/depois da final/);
  expect(validarPeriodo("", "2026-10-01")).toMatch(/Informe/);
  expect(validarPeriodo("2026-01-01", "2026-12-31")).toMatch(/máximo/);
});

test("fluxo: busca o período, filtra por falta/FT e baixa o PDF com o filtro aplicado", async () => {
  const ler = jest.fn(async () => MAPAS);
  const abrir = jest.fn(() => "aba");
  await montar({ ler, abrir, lerFotos: jest.fn(async () => ({ porId: {}, porNome: {} })) });
  expect(host.textContent).not.toContain("Buscar mapas do período"); // fechado
  await clicarTexto("Consolidado em PDF");
  await clicarTexto("Buscar mapas do período");
  expect(ler).toHaveBeenCalledWith(["P601", "P606"], "2026-10-06", "2026-10-12"); // padrão: últimos 7 dias
  expect(resumo()).toContain("2 mapas concluídos · 1 falta · 1 FT");
  await definir("Falta ou FT", "falta");
  expect(resumo()).toContain("1 mapa concluído · 1 falta · 0 FT");
  await definir("Falta ou FT", "todos");
  await definir("Líder", "Carlos");
  expect(resumo()).toContain("1 mapa concluído · 0 faltas");
  await definir("Líder", "");
  await definir("Plantão", "N");
  await clicarTexto("Baixar consolidado");
  expect(abrir).toHaveBeenCalledTimes(1);
  const [html, nome] = abrir.mock.calls[0];
  expect(nome).toBe("consolidado_mapa_equipe_2026-10-06_2026-10-12.html");
  expect(html).toContain("Consolidado do Mapa de Equipe");
  expect(html).toContain("Plantão noturno");
  expect(html).toContain("Elaine");
  expect(html).not.toContain("Carlos");
});

test("projeto escolhido vai para a leitura; período inválido não lê", async () => {
  const ler = jest.fn(async () => MAPAS);
  await montar({ ler, abrir: jest.fn() });
  await clicarTexto("Consolidado em PDF");
  await definir("Projeto", "P606");
  await clicarTexto("Buscar mapas do período");
  expect(ler).toHaveBeenLastCalledWith(["P606"], "2026-10-06", "2026-10-12");
  await definir("Data inicial", "2026-10-12");
  await definir("Data final", "2026-10-12");
  await clicarTexto("Hoje");
  expect(host.querySelector('[aria-label="Data inicial"]').value).toBe("2026-10-12");
  await definir("Data inicial", "");
  await clicarTexto("Buscar mapas do período");
  expect(host.querySelector('[role="alert"]').textContent).toMatch(/Informe/);
  expect(ler).toHaveBeenCalledTimes(1);
});

test("falha de leitura avisa e não mostra 0 mapas nem libera o PDF", async () => {
  await montar({ ler: jest.fn(async () => { throw new Error("offline"); }), abrir: jest.fn() });
  await clicarTexto("Consolidado em PDF");
  await clicarTexto("Buscar mapas do período");
  expect(host.querySelector('[role="alert"]').textContent).toContain("Não consegui ler os mapas agora");
  expect(host.querySelector('[data-testid="consolidado-resumo"]')).toBeNull();
  expect([...host.querySelectorAll("button")].some((b) => b.textContent.includes("Baixar consolidado"))).toBe(false);
});

test("popup bloqueado: avisa que baixou o HTML", async () => {
  await montar({ ler: jest.fn(async () => MAPAS), abrir: jest.fn(() => "download") });
  await clicarTexto("Consolidado em PDF");
  await clicarTexto("Buscar mapas do período");
  await clicarTexto("Baixar consolidado");
  expect(host.querySelector('[role="status"]').textContent).toContain("baixado como HTML");
});

const FOTO = "data:image/jpeg;base64,AAAA";
test("fotos: busca a foto de cada projeto do consolidado, usa uma vez no PDF e avisa se alguma falhar", async () => {
  const lerFotos = jest.fn(async (pid) => { if (pid === "P601") throw new Error("sem acesso"); return { porId: {}, porNome: { "elaine": FOTO, "rosemeire": FOTO } }; });
  const abrir = jest.fn(() => "aba");
  const MAPAS2 = [{ ...MAPAS[0], postos: [posto("l", "Líder", "Marcos", "presente", {}, { lider: true }), posto("c", "CCO", "Elaine", "falta", { porFtDe: "f" }), posto("f", "Posto extra", "Rosemeire", "ft", { quemFaltou: "Elaine" })] }, MAPAS[1]];
  await montar({ ler: jest.fn(async () => MAPAS2), abrir, lerFotos });
  await clicarTexto("Consolidado em PDF");
  await clicarTexto("Buscar mapas do período");
  await clicarTexto("Baixar consolidado");
  expect(lerFotos.mock.calls.map((c) => c[0]).sort()).toEqual(["P601", "P606"]);
  const html = abrir.mock.calls[0][0];
  expect(html.split(FOTO).length - 1).toBe(1); // a mesma foto não se repete
  expect(html).toContain("mk-f0");
  expect(host.querySelector('[role="status"]').textContent).toContain("Algumas fotos não carregaram");
});
test("sem a opção de fotos, não lê foto nenhuma e o PDF sai sem avatares", async () => {
  const lerFotos = jest.fn(async () => ({ porId: {}, porNome: {} }));
  const abrir = jest.fn(() => "aba");
  await montar({ ler: jest.fn(async () => MAPAS), abrir, lerFotos });
  await clicarTexto("Consolidado em PDF");
  await clicarTexto("Buscar mapas do período");
  const cb = [...host.querySelectorAll('input[type="checkbox"]')].find((c) => c.parentElement.textContent.includes("fotos dos colaboradores"));
  await act(async () => cb.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await clicarTexto("Baixar consolidado");
  expect(lerFotos).not.toHaveBeenCalled();
  expect(abrir.mock.calls[0][0]).not.toContain("mk-av");
});
