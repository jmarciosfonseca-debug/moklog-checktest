// Marcio, 16/11/2026: o teste semanal puxa da CCO a quantidade de câmeras abaixo de 30 dias; o cliente abre o relatório das câmeras.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { resumoGravacaoCCO, gravacaoDaCCO, faixaDoPercentual, gravacaoDoTeste, textoGravacao, fraseGravacao } from "./gravacaoSemanal";
import BotaoRelatorioCameras, { camerasParaCliente, abrirRelatorioCameras } from "./cliente/RelatorioCameras";

jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), doc: jest.fn(), getDoc: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;

const P = { id: "P311B", name: "Mega CL Itajaí", categories: [{ id: "cftv", label: "06 - CFTV", type: "count", total: 114 }] };
const cam = (n, dias, extra = {}) => ({ id: `c${n}`, nome: `Câmera ${n}`, diasGravacao: dias, ultimaChecagem: "2026-11-15T10:00:00.000Z", checadoPor: "Fulano", ...extra });
const DOC = { cameras: [...Array.from({ length: 10 }, (_, i) => cam(i, 12)), ...Array.from({ length: 90 }, (_, i) => cam(100 + i, 31)), cam(900, null), cam(901, "")], updatedAt: "2026-11-15T11:00:00.000Z" };

describe("puxado automático da CCO", () => {
  test("resumo: conta só câmeras medidas; sem medição devolve null (segue manual)", () => {
    expect(resumoGravacaoCCO(DOC)).toEqual({ cadastradas: 102, medidas: 100, abaixo: 10, em: "2026-11-15T10:00:00.000Z" });
    expect(resumoGravacaoCCO({ cameras: [cam(1, null)] })).toBeNull();
    expect(resumoGravacaoCCO(null)).toBeNull();
  });
  test("faixa equivalente ao percentual real", () => {
    expect([0, 3, 5, 8.8, 10, 11, 25, 31, 80].map(faixaDoPercentual)).toEqual([0, 5, 5, 10, 10, 20, 30, 50, 50]);
  });
  test("o teste guarda a QUANTIDADE exata e a origem; a faixa continua valendo para cor e nota", () => {
    const g = gravacaoDaCCO(resumoGravacaoCCO(DOC), 114);
    expect(g).toMatchObject({ origem: "cco", cameras: 10, medidas: 100, pct: 10, registradoEm: "2026-11-15T10:00:00.000Z" });
    const lido = gravacaoDoTeste(P, { cftv: { total: 114, inoperative: [], gravacao: g } });
    expect(lido).toMatchObject({ total: 114, pct: 10, cameras: 10, pctReal: 9, origem: "cco", nivel: "atencao" });
    expect(textoGravacao(lido)).toMatch(/^Tempo de gravação: 10 de 114 câmeras \(9%\) com menos de 30 dias · registro da CCO de \d\d\/11$/);
  });
  test("nenhuma abaixo de 30 dias", () => {
    const g = gravacaoDaCCO({ cadastradas: 5, medidas: 5, abaixo: 0, em: null }, 114);
    expect(g.pct).toBe(0);
    expect(fraseGravacao(gravacaoDoTeste(P, { cftv: { gravacao: g } }))).toBe("nenhuma câmera com menos de 30 dias · registro da CCO");
  });
  test("teste informado à mão continua igual ao que era", () => {
    const lido = gravacaoDoTeste(P, { cftv: { total: 114, gravacao: { pct: 20, obs: "NVR 2" } } });
    expect(lido).toMatchObject({ pct: 20, cameras: 23 });
    expect(lido.origem).toBeUndefined();
    expect(textoGravacao(lido)).toBe("Tempo de gravação: até 20% das câmeras (até ≈ 23 de 114) com menos de 30 dias — NVR 2");
    expect(textoGravacao(gravacaoDoTeste(P, { cftv: { gravacao: { pct: 0 } } }))).toBe("Tempo de gravação: todas as 114 câmeras com ≥ 30 dias");
  });
});

describe("relatório das câmeras para o cliente", () => {
  test("não leva o nome de quem checou", () => {
    expect(camerasParaCliente(DOC.cameras).some((c) => "checadoPor" in c)).toBe(false);
    let html = "";
    abrirRelatorioCameras({ pid: "P311B", nome: "Mega CL Itajaí" }, DOC.cameras, { abrir: (h) => { html = h; return "aba"; }, hoje: new Date("2026-11-16T12:00:00") });
    expect(html).toContain("CFTV — Tempo de Gravação");
    expect(html).toContain("Câmera 0");
    expect(html).not.toContain("Fulano");
  });
  test("botão aparece só com câmeras registradas e abre o relatório no toque", async () => {
    const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
    const abrir = jest.fn(() => "aba");
    await act(async () => root.render(<BotaoRelatorioCameras pid="P311B" nome="Mega CL Itajaí" ler={async () => DOC.cameras} abrir={abrir} />));
    await act(async () => { await Promise.resolve(); });
    const b = host.querySelector('[data-testid="abrir-relatorio-cameras"]');
    expect(b).not.toBeNull();
    await act(async () => b.click());
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir.mock.calls[0][0]).toContain("abaixo de 30 dias de gravação");
    await act(async () => root.render(<BotaoRelatorioCameras pid="P602" nome="x" ler={async () => []} abrir={abrir} />));
    await act(async () => { await Promise.resolve(); });
    expect(host.querySelector('[data-testid="abrir-relatorio-cameras"]')).toBeNull();
    await act(async () => root.unmount()); host.remove();
  });
});
