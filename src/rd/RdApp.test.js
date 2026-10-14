import React, { act } from "react";
import { createRoot } from "react-dom/client";
import RdApp from "./RdApp";
import { htmlRd } from "./rdPdf";

jest.mock("./rdStore", () => ({ criarRdStore: () => mockStore }));
const mockStore = { ler: jest.fn(), dias: jest.fn(), salvar: jest.fn() };
let marcoSeq;
const criarMarcoFn = async () => marcoSeq.shift();

beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => {
  localStorage.clear(); jest.clearAllMocks();
  marcoSeq = [
    { em: "2026-10-14T09:00:00.000Z", gps: { lat: -23.6, lng: -46.7, acc: 10 }, endereco: "Taboão da Serra - SP" },
    { em: "2026-10-14T10:05:00.000Z", gps: { lat: -23.1, lng: -46.9, acc: 8 }, endereco: "Av. Tal, Jundiaí - SP" },
    { em: "2026-10-14T13:30:00.000Z", gps: { lat: -23.1, lng: -46.9, acc: 9 }, endereco: "Av. Tal, Jundiaí - SP" },
  ];
  mockStore.ler.mockResolvedValue({ dia: null, memoria: { rotas: { "MK_HOME>MK604": { viagens: 2, kmMedia: 62, pedagios: [{ descricao: "SP-348", valor: 16 }] } }, pendencias: { MK604: [{ texto: "Orçamento da cancela", desde: "2026-10-07" }] }, revisao: 3 } });
  mockStore.dias.mockResolvedValue({ dias: [] });
  let rev = 0;
  mockStore.salvar.mockImplementation(async ({ dia, memoria }) => ({ dia: { ...dia, revisao: ++rev }, memoria: memoria ? { ...memoria, revisao: 4 } : null }));
});

const montar = async (host, root) => act(async () => root.render(<RdApp auth={{ currentUser: { uid: "u", email: "m@moked" } }} onBack={() => {}} criarMarcoFn={criarMarcoFn} />));
const botao = (host, t) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(t));
const clicar = (host, t) => { const b = botao(host, t); expect(b).toBeDefined(); return act(async () => b.dispatchEvent(new MouseEvent("click", { bubbles: true }))); };
const digitar = (el, v) => act(async () => { const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value"); d.set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); });

test("fluxo Jundiaí: abre com GPS e projeção, chegada fecha sem abrir a volta, pendência vira lembrete, volta herda km", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await montar(host, root);
    await clicar(host, "Sair de casa — abrir o dia");
    await clicar(host, "MK604");
    const kmIni = [...host.querySelectorAll("label")].find((l) => l.textContent.includes("Km inicial")).querySelector("input");
    await digitar(kmIni, "41200");
    expect(host.textContent).toContain("projeção de chegada");
    expect(host.textContent).toContain("41.262");                        // 41200 + 62 de média
    await clicar(host, "Abrir trecho (crava hora e local)");
    expect(host.textContent).toContain("Em deslocamento · MK Home → MK604");
    expect(host.textContent).toContain("Taboão da Serra - SP");          // GPS cravado na saída
    expect(host.querySelector('[aria-label="Pedágio 1"]').value).toBe("SP-348"); // pedágio da última ida pré-preenchido
    expect(host.querySelector('[aria-label="Valor pedágio 1"]').value).toBe("16");
    // chegada: km final e fechar — e o dia FICA em aberto no cliente, sem abrir a volta sozinho
    const kmFim = [...host.querySelectorAll("label")].find((l) => l.textContent.includes("Km final")).querySelector("input");
    await digitar(kmFim, "41263");
    await clicar(host, "Cheguei — fechar o trecho");
    expect(host.textContent).toContain("Você está em MK604");
    expect(host.textContent).toContain("Av. Tal, Jundiaí - SP");
    expect(host.textContent).not.toContain("Em deslocamento ·");
    expect(host.textContent).toContain("Pendente da última visita");
    expect(host.textContent).toContain("Orçamento da cancela");
    // abrir a volta: origem é o cliente e o km inicial vem herdado do km final
    await clicar(host, "Abrir próximo trecho");
    expect(host.textContent).toContain("saindo de MK604");
    const kmVolta = [...host.querySelectorAll("label")].find((l) => l.textContent.includes("Km inicial")).querySelector("input");
    expect(kmVolta.value).toBe("41263");
    await clicar(host, "MK Home");
    await clicar(host, "Abrir trecho (crava hora e local)");
    expect(host.textContent).toContain("Em deslocamento · MK604 → MK Home");
    expect(mockStore.salvar).toHaveBeenCalledTimes(3);
    const memSalva = mockStore.salvar.mock.calls[1][0].memoria;          // fechar o trecho atualizou a memória da rota
    expect(memSalva.rotas["MK_HOME>MK604"].viagens).toBe(3);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("destino novo: prefixo MK fixo, só o número; relatório escapa HTML e traz permanência", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await montar(host, root);
    await clicar(host, "Sair de casa — abrir o dia");
    await clicar(host, "Novo…");
    await digitar(host.querySelector('[aria-label="Número do projeto novo"]'), "077");
    await clicar(host, "Abrir trecho (crava hora e local)");
    expect(host.textContent).toContain("MK Home → MK077");
  } finally { await act(async () => root.unmount()); host.remove(); }
  const dia = { data: "2026-10-14", estado: "fechado", trechos: [
    { id: "t1", origem: "MK_HOME", destino: "MK604", kmInicial: 100, kmFinal: 160, abertura: { em: "2026-10-14T09:00:00.000Z" }, chegada: { em: "2026-10-14T10:00:00.000Z", gps: { lat: -23.1, lng: -46.9 }, endereco: "Jundiaí" }, pedagios: [{ descricao: "SP-348", valor: 16 }], gastos: [], atividades: [{ texto: "<script>x</script>", status: "aberto" }], obs: "" },
    { id: "t2", origem: "MK604", destino: "MK_HOME", kmInicial: 160, kmFinal: 220, abertura: { em: "2026-10-14T12:00:00.000Z" }, chegada: { em: "2026-10-14T13:00:00.000Z" }, pedagios: [], gastos: [], atividades: [], obs: "" },
  ] };
  const html = htmlRd(dia, { config: { valorKm: 2 } }, "m@moked");
  expect(html).toContain("2h00");                                        // permanência no cliente
  expect(html).toContain("google.com/maps?q=-23.1,-46.9");
  expect(html).not.toContain("<script>x");
  expect(html).toContain("Em aberto:");
  expect(html).toContain("R$"); // km + despesas com valor do km configurado
});
