// Marcio, 16/11/2026: em teste novo o bloco puxa sozinho da CCO; teste antigo em edição não é mexido; sem CCO segue à mão.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import GravacaoBloco from "./GravacaoBloco";

jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), doc: jest.fn(), getDoc: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;
const S = { iconBtn: {}, inp: {} };
const CCO = { cadastradas: 114, medidas: 110, abaixo: 10, em: "2026-11-15T10:00:00.000Z" };
let host, root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const montar = async (props) => { await act(async () => root.render(<GravacaoBloco S={S} pid="P311B" total={114} {...props} />)); await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const botao = (t) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(t));

test("teste novo: puxa da CCO a quantidade exata, sem o líder tocar em nada", async () => {
  const onChange = jest.fn();
  await montar({ value: null, onChange, ler: async () => CCO });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0]).toMatchObject({ origem: "cco", cameras: 10, pct: 10, medidas: 110 });
  await montar({ value: onChange.mock.calls[0][0], onChange, ler: async () => CCO });
  expect(host.querySelector('[data-testid="gravacao-cco"]').textContent).toContain("10 de 114 câmeras (9%) com menos de 30 dias");
  expect(host.textContent).toContain("Puxado automático do registro da CCO de 15/11/2026");
  expect(onChange).toHaveBeenCalledTimes(1); // não fica regravando
});
test("teste antigo em edição (já tinha valor): não é sobrescrito", async () => {
  const onChange = jest.fn();
  await montar({ value: { pct: 20, obs: "NVR 2" }, onChange, ler: async () => CCO });
  expect(onChange).not.toHaveBeenCalled();
  expect(botao("Usar o registro da CCO")).toBeDefined();
});
test("CCO sem medição ou leitura com erro: segue a faixa à mão, como antes", async () => {
  const onChange = jest.fn();
  await montar({ value: null, onChange, ler: async () => null });
  expect(onChange).not.toHaveBeenCalled();
  expect(host.textContent).toContain("A CCO ainda não registrou");
  await act(async () => botao("até 10%").click());
  expect(onChange).toHaveBeenCalledWith({ pct: 10, obs: "", origem: "manual" });
  const onChange2 = jest.fn();
  await montar({ value: null, onChange: onChange2, ler: async () => { throw new Error("offline"); } });
  expect(onChange2).not.toHaveBeenCalled();
});
test("o líder pode trocar para a faixa à mão e voltar para a CCO", async () => {
  const onChange = jest.fn();
  await montar({ value: { pct: 10, obs: "", origem: "cco", cameras: 10, medidas: 110, registradoEm: CCO.em }, onChange, ler: async () => CCO });
  await act(async () => botao("Informar à mão").click());
  expect(onChange).toHaveBeenLastCalledWith({ pct: null, obs: "", origem: "manual" });
});
