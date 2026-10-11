import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { PainelMapasView } from "./PainelMapasEquipe";
import { resumoDoPainel, PROJETOS_DO_MAPA } from "./painel";

jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), collection: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;

const agora = new Date("2026-10-11T09:00:00-03:00");
const env = (p) => ({ projetoId: p, data: "2026-10-11", turno: "D", enviadoEm: "2026-10-11T06:10:00-03:00" });
let host, root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const mostrar = (props) => act(async () => root.render(<PainelMapasView dark={false} onToggle={() => {}} {...props} />));
const card = () => host.querySelector('[data-testid="painel-mapas"]');

test("mostra o contador n de 12 e brilha quando falta projeto", async () => {
  const resumo = resumoDoPainel({ agora, mapas: PROJETOS_DO_MAPA.filter((p) => p !== "P604").map(env) });
  await mostrar({ resumo, aberto: true });
  expect(host.textContent).toContain("11 de 12");
  expect(host.textContent).toContain("Há projeto sem mapa enviado");
  expect(card().style.animation).toMatch(/mkMapaBrilho/);
  expect(host.textContent).toContain("P604");
  expect((host.textContent.match(/Pendente/g) || []).length).toBe(1);
});
test("12 de 12 não brilha", async () => {
  await mostrar({ resumo: resumoDoPainel({ agora, mapas: PROJETOS_DO_MAPA.map(env) }) });
  expect(host.textContent).toContain("12 de 12");
  expect(card().style.animation).toBe("none");
});
test("falha de leitura não mostra contador falso", async () => {
  await mostrar({ resumo: resumoDoPainel({ agora, mapas: [] }), erro: true });
  expect(host.textContent).not.toMatch(/\d+ de 12/);
  expect(host.textContent).toContain("Não consegui ler os mapas agora");
  expect(card().style.animation).toBe("none");
});
test("o clique alterna a lista", async () => {
  const onToggle = jest.fn();
  await mostrar({ resumo: resumoDoPainel({ agora, mapas: [] }), onToggle });
  await act(async () => host.querySelector('[role="button"]').click());
  expect(onToggle).toHaveBeenCalledTimes(1);
});
