import React, { act } from "react";
import { createRoot } from "react-dom/client";
import RdApp from "./RdApp";
import { htmlRd } from "./rdPdf";

jest.mock("./rdStore", () => ({ criarRdStore: () => mockStore }));
const mockStore = { ler: jest.fn(), dias: jest.fn(), salvar: jest.fn(), salvarFoto: jest.fn(), lerFotos: jest.fn(), excluir: jest.fn() };
let marcoSeq;
const criarMarcoFn = async () => marcoSeq.shift();
const comprimirFotoFn = async () => "data:image/jpeg;base64,FOTOPEQ";

beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => {
  localStorage.clear(); jest.clearAllMocks();
  marcoSeq = [
    { em: "2026-10-15T05:14:00.000-03:00", gps: { lat: -23.6, lng: -46.7, acc: 10 }, endereco: "Taboão da Serra - SP" },
    { em: "2026-10-15T06:16:00.000-03:00", gps: { lat: -23.66, lng: -46.44, acc: 8 }, endereco: "Mauá - SP" },
    { em: "2026-10-15T06:40:00.000-03:00", gps: { lat: -23.66, lng: -46.44, acc: 9 }, endereco: "Mauá - SP" },
  ];
  mockStore.ler.mockResolvedValue({ dia: null, memoria: { rotas: { "MK_HOME>MK602": { viagens: 3, kmMedia: 74, pedagios: [{ descricao: "Pedágio", valor: 5.7 }] } }, pendencias: { MK602: [{ texto: "Conversar com a supervisão sobre o portão", desde: "2026-10-08" }] }, revisao: 3 } });
  mockStore.dias.mockResolvedValue({ dias: [] });
  let rev = 0;
  mockStore.salvar.mockImplementation(async ({ dia, memoria }) => ({ dia: { ...dia, revisao: ++rev }, memoria: memoria ? { ...memoria, revisao: 4 } : null }));
});

const montar = async (host, root) => act(async () => root.render(<RdApp auth={{ currentUser: { uid: "u", email: "m@moked" } }} onBack={() => {}} criarMarcoFn={criarMarcoFn} comprimirFotoFn={comprimirFotoFn} />));
const botao = (host, t) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(t));
const clicar = (host, t) => { const b = botao(host, t); expect(b).toBeDefined(); return act(async () => b.dispatchEvent(new MouseEvent("click", { bubbles: true }))); };
const digitar = (el, v) => act(async () => { const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value"); d.set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); });
const porLabel = (host, texto) => [...host.querySelectorAll("label")].find((l) => l.textContent.includes(texto))?.querySelector("input,textarea");

test("fluxo fluido: toque no destino abre; visita no mesmo card com chavinha e lembrete; km final já vem cravado; fechou → cascata do próximo destino", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await montar(host, root);
    // dia começa direto na cascata: um toque no MK602 abre o trecho (sem botão intermediário)
    expect(host.textContent).toContain("Sair de casa — para onde?");
    const kmIni = porLabel(host, "Km inicial");
    await digitar(kmIni, "242323");
    await clicar(host, "MK602");
    expect(host.textContent).toContain("Em deslocamento · MK Home → MK602");
    // km inicial e final lado a lado; final já CRAVADO pela projeção (242323 + 74)
    expect(porLabel(host, "Km final").value).toBe("242397");
    expect(host.textContent).toContain("km final já cravado");
    // visita disponível JÁ no deslocamento, com lembrete da última visita e chavinhas
    expect(host.textContent).toContain("Pendente da última visita");
    expect(host.textContent).toContain("Conversar com a supervisão sobre o portão");
    const chaveAdm = host.querySelector('[aria-label="Contato com a administração"]');
    await act(async () => { chaveAdm.click(); });
    await digitar(host.querySelector('[aria-label="Observação contato com a administração"]'), "Alinhamento geral");
    // km rodado calculado em tempo real, antes mesmo de fechar
    expect(host.textContent).toContain("rodou 74 km");
    // cheguei: fecha com o km cravado, sem digitar nada
    await clicar(host, "Cheguei — fechar o trecho");
    expect(host.textContent).toContain("Você está em MK602");
    const salvo = mockStore.salvar.mock.calls.at(-1)[0];
    expect(salvo.dia.trechos[0].kmFinal).toBe("242397");
    expect(salvo.dia.trechos[0].atividades).toEqual([{ tag: "adm", texto: "Contato com a administração — Alinhamento geral", status: null }]);
    // a escolha do próximo destino já está na tela, sem botão intermediário; km herdado
    expect(host.textContent).toContain("Para onde agora?");
    expect(porLabel(host, "Km inicial").value).toBe("242397");
    await clicar(host, "MK Home");
    expect(host.textContent).toContain("Em deslocamento · MK602 → MK Home");
    // volta: projeção pela rota inversa (74 km) já cravada
    expect(porLabel(host, "Km final").value).toBe("242471");
    // retorno para casa não mostra bloco de visita
    expect(host.textContent).not.toContain("Visita · MK Home");
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("digitar não derruba o teclado: o MESMO nó de input sobrevive a cada letra (sem remontagem)", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await montar(host, root);
    await digitar(porLabel(host, "Km inicial"), "242323");
    await clicar(host, "MK602");
    // liga a chavinha e digita na observação letra a letra, como no celular
    await act(async () => { host.querySelector('[aria-label="Contato com a administração"]').click(); });
    const obs = host.querySelector('[aria-label="Observação contato com a administração"]');
    obs.focus();
    for (const v of ["S", "Si", "Sim"]) {
      await digitar(obs, v);
      expect(host.querySelector('[aria-label="Observação contato com a administração"]')).toBe(obs); // mesmo nó do DOM
      expect(document.activeElement).toBe(obs);                                                      // foco (teclado) de pé
    }
    // o mesmo vale para atividade livre, lembrete e observações da visita
    const atv = host.querySelector('[aria-label="Nova atividade"]');
    atv.focus();
    await digitar(atv, "Ronda");
    expect(host.querySelector('[aria-label="Nova atividade"]')).toBe(atv);
    expect(document.activeElement).toBe(atv);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("dia em linha (como o RD 2C): trecho antigo vira card recolhido de uma linha e abre num toque para corrigir", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await montar(host, root);
    await digitar(porLabel(host, "Km inicial"), "242323");
    await clicar(host, "MK602");
    await clicar(host, "Cheguei — fechar o trecho");
    await clicar(host, "MK Home");                       // abre a volta: o trecho 1 vira linha recolhida
    expect(host.textContent).toContain("Dia em linha · 2 trechos");
    expect(host.textContent).toContain("1 · MK Home → MK602");
    expect(host.textContent).toContain("05:14 – 06:16");
    expect(host.textContent).not.toContain("Visita · MK602");   // recolhido: sem formulário na tela
    const head = host.querySelector('.rd-trecho-head');
    await act(async () => head.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.textContent).toContain("Visita · MK602");        // expandiu: dá para corrigir hora, km, gastos e visita
    expect(botao(host, "Salvar alterações")).toBeDefined();
    await act(async () => head.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.textContent).not.toContain("Salvar alterações"); // recolheu de novo
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("em casa com o dia rodado aparece Fechar o dia; Configurar fica atrás do ⚙, fora da tela do dia", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  mockStore.ler.mockResolvedValue({ dia: { data: "2026-10-15", estado: "aberto", revisao: 2, trechos: [
    { id: "t1", origem: "MK_HOME", destino: "MK602", veiculo: "carro", kmInicial: 100, kmFinal: 174, abertura: { em: "2026-10-15T05:14:00.000-03:00" }, chegada: { em: "2026-10-15T06:16:00.000-03:00" }, pedagios: [], gastos: [], atividades: [], obs: "" },
    { id: "t2", origem: "MK602", destino: "MK_HOME", veiculo: "carro", kmInicial: 174, kmFinal: 248, abertura: { em: "2026-10-15T06:17:00.000-03:00" }, chegada: { em: "2026-10-15T07:20:00.000-03:00" }, pedagios: [], gastos: [], atividades: [], obs: "" },
  ] }, memoria: { revisao: 3 } });
  try {
    await montar(host, root);
    expect(botao(host, "Salvar e arquivar o dia — gerar o RD")).toBeDefined();
    expect(host.textContent).toContain("rodou 74 km");                // km do trecho calculado na chegada
    expect(host.textContent).not.toContain("Km carro (R$)");          // configuração fora da tela do dia
    await clicar(host, "⚙");
    expect(host.textContent).toContain("MK RD · Configurar");
    // a configuração salva sozinha ao digitar (sem botão de salvar)
    expect(botao(host, "Salvar configuração")).toBeUndefined();
    await digitar(porLabel(host, "Km carro"), "1,10");
    await act(async () => { await new Promise((r) => setTimeout(r, 1400)); });
    const cfg = mockStore.salvar.mock.calls.at(-1)[0];
    expect(cfg.memoria.config.valorKm).toBe("1,10");
    expect(host.textContent).toContain("Configuração salva");
    await clicar(host, "← Voltar ao dia");
    expect(host.textContent).toContain("Você está em MK Home");
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("salvar e arquivar: confirma o km final, fecha o dia e abre a pasta de RDs arquivados", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  mockStore.ler.mockResolvedValue({ dia: { data: "2026-10-15", estado: "aberto", revisao: 2, trechos: [
    { id: "t1", origem: "MK_HOME", destino: "MK602", veiculo: "carro", kmInicial: 100, kmFinal: 174, abertura: { em: "2026-10-15T05:14:00.000-03:00" }, chegada: { em: "2026-10-15T06:16:00.000-03:00" }, pedagios: [], gastos: [], atividades: [{ texto: "Trocar a fechadura", status: "aberto" }], obs: "" },
    { id: "t2", origem: "MK602", destino: "MK_HOME", veiculo: "carro", kmInicial: 174, kmFinal: 248, abertura: { em: "2026-10-15T06:17:00.000-03:00" }, chegada: { em: "2026-10-15T07:20:00.000-03:00" }, pedagios: [], gastos: [], atividades: [], obs: "" },
  ] }, memoria: { revisao: 3 } });
  mockStore.dias.mockResolvedValue({ dias: [{ data: "2026-10-15", estado: "fechado", trechos: 2 }, { data: "2026-10-14", estado: "fechado", trechos: 4 }] });
  const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
  const abrirJanela = jest.spyOn(window, "open").mockReturnValue({ document: { open: () => {}, write: () => {}, close: () => {} } });
  try {
    await montar(host, root);
    mockStore.excluir.mockResolvedValue({ excluido: "2026-10-14" });
    await clicar(host, "Salvar e arquivar o dia — gerar o RD");
    expect(confirmar.mock.calls.at(-1)[0]).toContain("Km final do dia: 248");          // "quilometragem final está correta?"
    const salvo = mockStore.salvar.mock.calls.at(-1)[0];
    expect(salvo.dia.estado).toBe("fechado");
    expect(salvo.memoria.pendencias.MK602[0].texto).toBe("Trocar a fechadura");        // lembrete vira pendência p/ próxima visita
    // arquivou → cai DIRETO na pastinha, com o aviso
    expect(host.textContent).toContain("MK RD · Arquivados");
    expect(host.textContent).toContain("salvo e arquivado");
    expect(host.textContent).toContain("14/10/2026");
    expect(host.textContent).toContain("✓ Arquivado");
    // fase de teste: apagar um RD da lista (o do dia 14)
    const apagar = host.querySelector('[aria-label="Apagar o RD de 14/10/2026"]');
    await act(async () => apagar.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(mockStore.excluir).toHaveBeenCalledWith("2026-10-14");
    expect(host.textContent).toContain("RD de 14/10/2026 apagado");
    expect(host.querySelector('[aria-label="Apagar o RD de 14/10/2026"]')).toBeNull(); // saiu da lista
    // abrir o RD de um dia direto da lista
    await clicar(host, "15/10/2026");
    expect(host.textContent).toContain("RD de 15/10/2026 salvo e arquivado");
  } finally { confirmar.mockRestore(); abrirJanela.mockRestore(); await act(async () => root.unmount()); host.remove(); }
});

test("tema acompanha o app: claro ganha .rd-claro, escuro fica no padrão", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<RdApp auth={{ currentUser: { uid: "u" } }} onBack={() => {}} dark={false} criarMarcoFn={criarMarcoFn} comprimirFotoFn={comprimirFotoFn} />));
    expect(host.querySelector("main.rd.rd-claro")).not.toBeNull();
    await act(async () => root.render(<RdApp auth={{ currentUser: { uid: "u" } }} onBack={() => {}} dark criarMarcoFn={criarMarcoFn} comprimirFotoFn={comprimirFotoFn} />));
    expect(host.querySelector("main.rd.rd-claro")).toBeNull();
    expect(host.querySelector("main.rd")).not.toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("destino novo pela cascata (MK + número) e cancelar trecho aberto por engano", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
  try {
    await montar(host, root);
    await clicar(host, "Novo…");
    await digitar(host.querySelector('[aria-label="Número do projeto novo"]'), "077");
    await clicar(host, "Abrir →");
    expect(host.textContent).toContain("Em deslocamento · MK Home → MK077");
    await clicar(host, "Abri por engano — cancelar este trecho");
    expect(host.textContent).toContain("Trecho cancelado");
    expect(host.textContent).toContain("Sair de casa — para onde?");
  } finally { confirmar.mockRestore(); await act(async () => root.unmount()); host.remove(); }
});

test("fator moto e comprovante no pedágio continuam no fluxo novo; RD do dia embute comprovantes", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  mockStore.salvarFoto.mockResolvedValue({ fotoId: "x" });
  try {
    await montar(host, root);
    await clicar(host, "🏍 Moto");
    await clicar(host, "MK602");
    expect(mockStore.salvar.mock.calls[0][0].dia.trechos[0].veiculo).toBe("moto");
    const anexo = host.querySelector('[aria-label="Anexar comprovante"]');
    await act(async () => {
      Object.defineProperty(anexo, "files", { value: [new File(["x"], "recibo.jpg", { type: "image/jpeg" })], configurable: true });
      anexo.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(mockStore.salvarFoto).toHaveBeenCalledWith(expect.stringMatching(/^f[a-z0-9]+$/), "data:image/jpeg;base64,FOTOPEQ");
    expect(host.querySelector(".rd-comprovante.ok")).not.toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); }
  const dia = { data: "2026-10-15", estado: "fechado", trechos: [{ id: "t1", origem: "MK_HOME", destino: "MK602", veiculo: "moto", kmInicial: 100, kmFinal: 174, abertura: { em: "2026-10-15T05:14:00.000-03:00" }, chegada: { em: "2026-10-15T06:16:00.000-03:00", gps: { lat: -23.66, lng: -46.44 } }, pedagios: [{ descricao: "Pedágio", valor: 5.7, fotoId: "fabc" }], gastos: [], atividades: [{ texto: "Contato com a administração — Alinhamento", status: null, tag: "adm" }], obs: "" }] };
  const html = htmlRd(dia, {}, "m", { fabc: "data:image/jpeg;base64,FOTO" });
  expect(html).toContain("Comprovantes");
  expect(html).toContain("🏍");
  expect(html).toContain("Contato com a administração");   // título da chavinha em destaque…
  expect(html).toContain("— Alinhamento");                  // …com a observação ao lado
});
