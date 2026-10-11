import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MapaDiarioTela from "./MapaDiarioTela";

global.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({}));
jest.mock("../fireGuard", () => ({ setDoc: jest.fn(() => { throw new Error("Gravação real proibida neste teste"); }) }));

const AGORA = new Date("2026-10-11T09:00:00-03:00"); // domingo, diurno já em andamento
const colabs = [
  { id: "a", nome: "Luiz D.", cargo: "Vigilante Líder", turno: "Diurno", emFerias: false },
  { id: "b", nome: "Marta A.", cargo: "Vig CCO", turno: "Diurno", emFerias: false },
  { id: "c", nome: "Ari A.", cargo: "Vigilante Ronda", turno: "Diurno", emFerias: false },
  { id: "d", nome: "Joao V.", cargo: "Vigilante Ronda", turno: "Folguista", emFerias: false },
];
let host, root, io, salvos;
const montar = async (extra = {}) => {
  salvos = [];
  io = {
    loadColaboradores: jest.fn(async () => colabs),
    loadMapa: jest.fn(async () => null),
    loadUltimoMapa: jest.fn(async () => ({ postos: [{ rotulo: "L1", pessoaId: "a", pessoaNome: "Luiz D." }, { rotulo: "P1", pessoaId: "b", pessoaNome: "Marta A." }, { rotulo: "P2", pessoaId: "c", pessoaNome: "Ari A." }], veiculos: [{ id: "m", rotulo: "Moto", kmAtual: 1200 }] })),
    loadUltimaVisita: jest.fn(async () => ({ ultimaData: "2026-10-09", supervisor: "Marcio", turno: "Diurno" })),
    saveMapa: jest.fn(async (m) => { salvos.push(m); return { ...m, atualizadoEm: "x" }; }),
    ...extra,
  };
  await act(async () => root.render(<MapaDiarioTela project={{ id: "P311B", name: "Mega Itajaí B" }} dark onBack={() => {}} io={io} agoraFn={() => AGORA} />));
  await act(async () => { await Promise.resolve(); });
};
beforeEach(() => { jest.useFakeTimers("modern"); jest.setSystemTime(AGORA); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); jest.useRealTimers(); });
const q = (sel) => host.querySelector(sel);
const clicar = async (el) => act(async () => el.click());
const abrirExc = async (rot) => clicar(q(`button[aria-label="Exceção do posto ${rot}"]`));
const botao = (txt) => [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === txt);
const digitar = async (el, v) => act(async () => { const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });

test("abre pré-preenchido do último mapa, com cabeçalho pela data e supervisão da CCO", async () => {
  await montar();
  expect(host.textContent).toContain("Domingo, 11/10/2026");
  expect(host.textContent).toContain("Diurno 06h00–18h00");
  expect(q('select[aria-label="Quem está no posto L1"]').value).toBe("a");
  expect(q('select[aria-label="Quem está no posto P2"]').value).toBe("c");
  expect(host.textContent).toContain("09/10/2026 — Marcio (Diurno)");
  expect(host.textContent).toContain("anterior 1200");
  expect(q('input[type="checkbox"]').checked).toBe(true); // material sem alteração já marcado
  expect(host.textContent).toContain("Mapa pendente"); // 09:00, 3 h depois de assumir, sem envio
});
test("concluir só grava depois de validar; atraso exige hora ou minutos", async () => {
  await montar();
  await abrirExc("L1");
  await clicar(botao("Atraso")); // primeiro posto (L1)
  await clicar(botao("Concluir mapa"));
  expect(q('[role="alert"]').textContent).toContain("informe a hora de chegada ou os minutos");
  expect(io.saveMapa).not.toHaveBeenCalled();
  await digitar(q('input[aria-label="Minutos de atraso"]'), "15");
  await clicar(botao("Concluir mapa"));
  expect(io.saveMapa).toHaveBeenCalledTimes(1);
  const m = salvos[0];
  expect(m.status).toBe("enviado");
  expect(m.enviadoEm).toBe(AGORA.toISOString());
  expect(m.postos[0]).toMatchObject({ situacao: "atraso", pessoaNome: "Luiz D." });
});
test("só libera o WhatsApp depois de gravar; se a gravação falhar, não libera", async () => {
  await montar({ saveMapa: jest.fn(async () => { throw new Error("offline"); }) });
  await clicar(botao("Concluir mapa"));
  expect(host.textContent).not.toContain("Abrir WhatsApp");
  expect(q('[role="alert"]').textContent).toContain("Não gravou");
});
test("depois de gravar mostra o texto e o link do WhatsApp", async () => {
  await montar();
  await clicar(botao("Concluir mapa"));
  expect(host.textContent).toContain("Mapa gravado");
  const t = q('pre[aria-label="Texto do mapa"]').textContent;
  expect(t).toContain("*MAPA DE EQUIPE*");
  expect(t).toContain("• L1: Luiz D.");
  expect(t).toContain("Sem ocorrências");
  expect(q('a[href^="https://wa.me/?text="]')).not.toBeNull();
});
test("troca não é FT e exige 'no lugar de quem'", async () => {
  await montar();
  await abrirExc("P1");
  await clicar(botao("Troca")); // P1
  await clicar(botao("Concluir mapa"));
  expect(q('[role="alert"]').textContent).toContain("P1: troca no lugar de quem?");
  await digitar(q('select[aria-label="Troca no lugar de quem"]'), "d");
  await clicar(botao("Concluir mapa"));
  const t = q('pre[aria-label="Texto do mapa"]').textContent;
  expect(t).toContain("• P1: Marta A. — troca de plantão, no lugar de Joao V.");
  expect(t).not.toContain("FT (folga trabalhada)");
});
test("autosalva o rascunho depois de alterar", async () => {
  await montar();
  await digitar(q('textarea[aria-label="Resumo da passagem"]'), "Preleção feita");
  expect(io.saveMapa).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(1600); });
  expect(io.saveMapa).toHaveBeenCalledTimes(1);
  expect(salvos[0].resumo).toBe("Preleção feita");
  expect(salvos[0].status).toBe("rascunho");
});
test("erro ao abrir não destrói nada e avisa", async () => {
  await montar({ loadColaboradores: jest.fn(async () => { throw new Error("x"); }) });
  expect(q('[role="alert"]').textContent).toContain("Não consegui abrir o mapa agora");
  expect(io.saveMapa).not.toHaveBeenCalled();
});
