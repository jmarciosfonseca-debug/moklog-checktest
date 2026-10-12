import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PainelAvisos from "./PainelAvisos";
import { lerVisto, gravarVisto, marcarNovos } from "./visto";

jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), doc: jest.fn(), onSnapshot: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(), collection: jest.fn(), query: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), where: jest.fn(), getDocFromServer: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;

const memoria = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; };
let host, root, ctl;
const fake = () => { ctl = { parar: jest.fn(), chamadas: 0 }; return (args) => { ctl.args = args; ctl.chamadas++; return { esperados: 2, parar: ctl.parar }; }; };
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const montar = (props) => act(async () => root.render(<PainelAvisos dark={false} gerencial={false} projetos={["P601", "P605"]} {...props} />));
const dados = (f, p, v) => act(async () => ctl.args.onDados(f, p, v));
const aviso = () => [...host.querySelectorAll('[data-testid="aviso"]')].map((b) => b.textContent);
const KEY = { id: "a", data: "2026-10-01", horaInicio: "08:00" };

test("lê as fontes (carregando) e depois mostra 'tudo em dia' quando não há aviso", async () => {
  await montar({ assinar: fake(), storage: memoria() });
  expect(host.textContent).toContain("Lendo as fontes");
  expect(host.textContent).not.toContain("Tudo em dia");
  await dados("keyaccess", "P601", []); await dados("energia", "P601", []);
  expect(host.textContent).toContain("Tudo em dia");
  expect(host.querySelector('[data-testid="avisos-status"]').textContent).toContain("Ao vivo");
});

test("aviso aparece em tempo real, some quando o problema é resolvido", async () => {
  await montar({ assinar: fake(), storage: memoria() });
  await dados("keyaccess", "P605", [KEY]); await dados("energia", "P601", []);
  expect(aviso()).toHaveLength(1);
  expect(aviso()[0]).toContain("Falha de acesso aberta");
  expect(aviso()[0]).toContain("P605");
  await dados("keyaccess", "P605", [{ ...KEY, horaFim: "09:00" }]);
  expect(aviso()).toHaveLength(0);
  expect(host.textContent).toContain("Tudo em dia");
});

test("fonte com erro: avisa que não leu e nunca diz 'tudo em dia'", async () => {
  await montar({ assinar: fake(), storage: memoria() });
  await dados("energia", "P601", []);
  await act(async () => ctl.args.onErro("keyaccess", "P605", new Error("x")));
  expect(host.querySelector('[role="alert"]').textContent).toContain("Não consegui ler: KeyAccess");
  expect(host.textContent).not.toContain("Tudo em dia");
  await act(async () => ctl.args.onErro("keyaccess", "P605", null)); // voltou
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

test("CTMK e equipamento inoperante vêm da Home (props) e entram no painel", async () => {
  await montar({ assinar: fake(), storage: memoria(), ctmkData: { P601: { status: "offline", offlineSince: new Date(Date.now() - 5 * 86400000).toISOString() } }, pendencias: [{ projetoId: "P605", cat: "Câmeras", item: "Cam 3", status: "inop", days: 40 }] });
  await dados("keyaccess", "P601", []); await dados("energia", "P601", []);
  expect(aviso().map((t) => (t.includes("CTMK") ? "ctmk" : t.includes("inoperante") ? "inop" : "?")).sort()).toEqual(["ctmk", "inop"]);
  expect(host.textContent).toContain("2 crítico");
});

test("NOVO desde a última visita; primeira visita não marca; clique grava o visto e chama onAbrir", async () => {
  const st = memoria();
  const onAbrir = jest.fn();
  await montar({ assinar: fake(), storage: st, onAbrir });
  await dados("keyaccess", "P605", [KEY]); await dados("energia", "P601", []);
  expect(host.textContent).not.toContain("NOVO"); // primeira visita
  await act(async () => host.querySelector('[data-testid="aviso"]').dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ tipo: "keyaccess", projetoId: "P605" }));
  expect(lerVisto(false, st).ids).toEqual(["keyaccess:P605:a"]);
  // nova abertura do app: o aviso antigo não é novo, o que chegou depois é
  await act(async () => root.unmount()); root = createRoot(host);
  await montar({ assinar: fake(), storage: st });
  await dados("keyaccess", "P605", [KEY, { id: "b", data: "2026-10-02", horaInicio: "10:00" }]); await dados("energia", "P601", []);
  const novos = [...host.querySelectorAll('[data-testid="aviso"]')].filter((b) => b.textContent.includes("NOVO"));
  expect(novos).toHaveLength(1);
});

test("com mais de 6 avisos mostra os principais e o botão 'Ver todos'", async () => {
  await montar({ assinar: fake(), storage: memoria() });
  const regs = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, data: "2026-10-01", horaInicio: `0${i}:00` }));
  await dados("keyaccess", "P605", regs); await dados("energia", "P601", []);
  expect(aviso()).toHaveLength(6);
  const b = [...host.querySelectorAll("button")].find((x) => x.textContent.includes("Ver todos os 9"));
  await act(async () => b.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(aviso()).toHaveLength(9);
});

test("gerencial assina com gerencial=true e para a assinatura ao sair", async () => {
  await montar({ assinar: fake(), gerencial: true, storage: memoria() });
  expect(ctl.args.gerencial).toBe(true);
  await act(async () => root.unmount()); root = createRoot(host);
  expect(ctl.parar).toHaveBeenCalled();
});

test("visto: grava ids atuais; storage quebrado não derruba", () => {
  const st = memoria();
  expect(lerVisto(true, st)).toBeNull();
  expect(gravarVisto(true, [{ id: "x" }], new Date("2026-10-12T10:00:00Z"), st)).toBe(true);
  expect(lerVisto(true, st).ids).toEqual(["x"]);
  expect(lerVisto(false, st)).toBeNull(); // perfis separados
  const ruim = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
  expect(lerVisto(true, ruim)).toBeNull();
  expect(gravarVisto(true, [], new Date(), ruim)).toBe(false);
  expect(marcarNovos([{ id: "a" }], null)[0].novo).toBe(false);
  expect(marcarNovos([{ id: "a" }, { id: "b" }], { ids: ["a"] }).map((a) => a.novo)).toEqual([false, true]);
});
