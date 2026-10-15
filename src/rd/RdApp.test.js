import React, { act } from "react";
import { createRoot } from "react-dom/client";
import RdApp from "./RdApp";
import { htmlRd } from "./rdPdf";

jest.mock("./rdStore", () => ({ criarRdStore: () => mockStore }));
const mockStore = { ler: jest.fn(), dias: jest.fn(), periodo: jest.fn(), salvar: jest.fn(), salvarFoto: jest.fn(), lerFotos: jest.fn(), excluir: jest.fn() };
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
  mockStore.periodo.mockResolvedValue({ dias: [] });
  let rev = 0;
  mockStore.salvar.mockImplementation(async ({ dia, memoria }) => ({ dia: { ...dia, revisao: ++rev }, memoria: memoria ? { ...memoria, revisao: 4 } : null }));
});

const montar = async (host, root) => act(async () => root.render(<RdApp auth={{ currentUser: { uid: "u", email: "m@moked" } }} onBack={() => {}} criarMarcoFn={criarMarcoFn} comprimirFotoFn={comprimirFotoFn} />));
const botao = (host, t) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(t));
const clicar = (host, t) => { const b = botao(host, t); expect(b).toBeDefined(); return act(async () => b.dispatchEvent(new MouseEvent("click", { bubbles: true }))); };
const digitar = (el, v) => act(async () => {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const d = Object.getOwnPropertyDescriptor(proto, "value"); d.set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true }));
});
const porLabel = (host, texto) => [...host.querySelectorAll("label")].find((l) => l.textContent.includes(texto))?.querySelector("input,textarea");

const DIA_RODADO = { data: "2026-10-15", estado: "aberto", revisao: 2, trechos: [
  { id: "t1", origem: "MK_HOME", destino: "MK602", veiculo: "carro", kmInicial: 100, kmFinal: 174, abertura: { em: "2026-10-15T05:14:00.000-03:00" }, chegada: { em: "2026-10-15T06:16:00.000-03:00" }, pedagios: [], gastos: [], atividades: [{ tag: "adm", texto: "Contato com a administração — Alinhamento do portão", status: null }, { texto: "Trocar a fechadura", status: "aberto" }], obs: "" },
  { id: "t2", origem: "MK602", destino: "MK_HOME", veiculo: "carro", kmInicial: 174, kmFinal: 248, abertura: { em: "2026-10-15T06:17:00.000-03:00" }, chegada: { em: "2026-10-15T07:20:00.000-03:00" }, pedagios: [], gastos: [], atividades: [], obs: "" },
] };

test("fluxo fluido: toque no destino abre; chavinha com caixa em cascata; km final cravado; fechou → próximo destino", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await montar(host, root);
    expect(host.textContent).toContain("Sair de casa — para onde?");
    await digitar(porLabel(host, "Km inicial"), "242323");
    await clicar(host, "MK602");
    expect(host.textContent).toContain("Em deslocamento · MK Home → MK602");
    expect(porLabel(host, "Km final").value).toBe("242397");       // cravado pela rota (242323 + 74)
    expect(host.textContent).toContain("rodou 74 km");             // km em tempo real
    // visita enxuta: pendência da última visita + 4 chavinhas do modelo 2C
    expect(host.textContent).toContain("Pendente da última visita");
    expect(host.querySelector('[aria-label="Contato com emp. de segurança"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Contato com seg. eletrônica"]')).not.toBeNull();
    expect(host.textContent).not.toContain("O que mais foi tratado");     // campo solto saiu
    const chaveAdm = host.querySelector('[aria-label="Contato com a administração"]');
    await act(async () => { chaveAdm.click(); });
    const obs = host.querySelector('[aria-label="Observação contato com a administração"]');
    expect(obs.tagName).toBe("TEXTAREA");                           // caixa em cascata, não linha única
    await digitar(obs, "Alinhamento geral");
    await clicar(host, "Cheguei — fechar o trecho");
    expect(host.textContent).toContain("Você está em MK602");
    const salvo = mockStore.salvar.mock.calls.at(-1)[0];
    expect(salvo.dia.trechos[0].kmFinal).toBe("242397");
    expect(salvo.dia.trechos[0].atividades).toEqual([{ tag: "adm", texto: "Contato com a administração — Alinhamento geral", status: null }]);
    expect(host.textContent).toContain("Para onde agora?");
    expect(porLabel(host, "Km inicial").value).toBe("242397");      // herdado
    await clicar(host, "MK Home");
    expect(host.textContent).toContain("Em deslocamento · MK602 → MK Home");
    expect(porLabel(host, "Km final").value).toBe("242471");        // prévia da volta pela rota inversa
    expect(host.textContent).not.toContain("Visita · MK Home");
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("digitar não derruba o teclado: o MESMO nó sobrevive a cada letra (chavinha e lembrete)", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await montar(host, root);
    await digitar(porLabel(host, "Km inicial"), "242323");
    await clicar(host, "MK602");
    await act(async () => { host.querySelector('[aria-label="Contato com a administração"]').click(); });
    const obs = host.querySelector('[aria-label="Observação contato com a administração"]');
    obs.focus();
    for (const v of ["S", "Si", "Sim"]) {
      await digitar(obs, v);
      expect(host.querySelector('[aria-label="Observação contato com a administração"]')).toBe(obs);
      expect(document.activeElement).toBe(obs);
    }
    const lem = host.querySelector('[aria-label="Lembrete para a próxima visita"]');
    lem.focus();
    await digitar(lem, "Cobrar Key Access");
    expect(host.querySelector('[aria-label="Lembrete para a próxima visita"]')).toBe(lem);
    expect(document.activeElement).toBe(lem);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("trecho antigo expandido abre em LEITURA (estilo 2C); o formulário só no Editar", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await montar(host, root);
    await digitar(porLabel(host, "Km inicial"), "242323");
    await clicar(host, "MK602");
    await clicar(host, "Cheguei — fechar o trecho");
    await clicar(host, "MK Home");                       // o trecho 1 vira linha recolhida
    expect(host.textContent).toContain("Dia em linha · 2 trechos");
    expect(host.textContent).toContain("1 · MK Home → MK602");
    expect(host.textContent).toContain("05:14 – 06:16");
    const head = host.querySelector(".rd-trecho-head");
    await act(async () => head.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    // LEITURA: texto corrido, sem inputs de km do trecho 1
    expect(host.textContent).toContain("Rodou 74 km");
    expect(botao(host, "✎ Editar este trecho")).toBeDefined();
    expect(host.textContent).not.toContain("Salvar alterações");
    await clicar(host, "✎ Editar este trecho");
    expect(host.textContent).toContain("Visita · MK602");
    expect(botao(host, "Salvar alterações")).toBeDefined();
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("salvar e arquivar: confirma o km final, grava, cai na pasta com período e resumo; apagar e abrir dia em consulta", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  mockStore.ler.mockResolvedValue({ dia: DIA_RODADO, memoria: { revisao: 3 } });
  mockStore.dias.mockResolvedValue({ dias: [{ data: "2026-10-15", estado: "fechado", trechos: 2 }, { data: "2026-10-14", estado: "fechado", trechos: 4 }] });
  mockStore.periodo.mockResolvedValue({ dias: [{ ...DIA_RODADO, estado: "fechado" }] });
  mockStore.excluir.mockResolvedValue({ excluido: "2026-10-14" });
  const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
  const abrirJanela = jest.spyOn(window, "open").mockReturnValue({ document: { open: () => {}, write: () => {}, close: () => {} } });
  try {
    await montar(host, root);
    await clicar(host, "Salvar e arquivar o dia — gerar o RD");
    expect(confirmar.mock.calls[0][0]).toContain("Km final do dia: 248");
    const salvo = mockStore.salvar.mock.calls.at(-1)[0];
    expect(salvo.dia.estado).toBe("fechado");
    expect(salvo.memoria.pendencias.MK602[0].texto).toBe("Trocar a fechadura");   // lembrete vira pendência
    // caiu direto na pasta, com aviso, período e resumo do intervalo
    expect(host.textContent).toContain("MK RD · Arquivados");
    expect(host.textContent).toContain("salvo e arquivado");
    expect(porLabel(host, "De")).toBeDefined();
    expect(host.textContent).toContain("Período atual");
    expect(host.textContent).toContain("148 km");                                  // km do período (74+74)
    expect(botao(host, "Gerar consolidado do período (PDF)")).toBeDefined();
    expect(host.textContent).toContain("✓ Arquivado");
    // apagar o dia 14 (fase de teste)
    const apagar = host.querySelector('[aria-label="Apagar o RD de 14/10/2026"]');
    await act(async () => apagar.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(mockStore.excluir).toHaveBeenCalledWith("2026-10-14");
    expect(host.querySelector('[aria-label="Apagar o RD de 14/10/2026"]')).toBeNull();
    // abrir o dia 15 → consulta em LEITURA
    await clicar(host, "15/10/2026");
    expect(host.textContent).toContain("RD de 15/10/2026");
    expect(host.textContent).toContain("✓ Arquivado");
    expect(host.textContent).toContain("Administração —");            // visita como texto corrido
    expect(host.textContent).toContain("Lembrete:");
    expect(host.textContent).not.toContain("Salvar alterações");      // sem formulário na consulta
    expect(botao(host, "Reabrir para ajustar")).toBeDefined();
  } finally { confirmar.mockRestore(); abrirJanela.mockRestore(); await act(async () => root.unmount()); host.remove(); }
});

test("tela 0: dia de hoje arquivado abre o painel pronto; tocar num destino REABRE o dia e continua a linha", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  mockStore.ler.mockResolvedValue({ dia: { ...DIA_RODADO, estado: "fechado" }, memoria: { revisao: 3 } });
  try {
    await montar(host, root);
    // painel de iniciar, com o arquivado numa linha discreta — e NADA de trechos na frente
    expect(host.textContent).toContain("Sair de casa — para onde?");
    expect(host.textContent).toContain("RD de hoje já arquivado");
    expect(host.textContent).not.toContain("Em deslocamento");
    expect(host.textContent).not.toContain("1 · MK Home → MK602");
    await clicar(host, "MK602");
    const salvo = mockStore.salvar.mock.calls.at(-1)[0];
    expect(salvo.dia.estado).toBe("aberto");                          // reabriu sozinho
    expect(salvo.dia.trechos).toHaveLength(3);                        // continua a linha
    expect(host.textContent).toContain("Em deslocamento · MK Home → MK602");
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("em casa com o dia rodado: Salvar e arquivar à vista; Configurar salva sozinha atrás do ⚙", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  mockStore.ler.mockResolvedValue({ dia: { ...DIA_RODADO, trechos: DIA_RODADO.trechos.map((t) => ({ ...t, atividades: [] })) }, memoria: { revisao: 3 } });
  try {
    await montar(host, root);
    expect(botao(host, "Salvar e arquivar o dia — gerar o RD")).toBeDefined();
    expect(host.textContent).toContain("rodou 74 km");
    expect(host.textContent).not.toContain("Km carro (R$)");
    await clicar(host, "⚙");
    expect(host.textContent).toContain("MK RD · Configurar");
    expect(botao(host, "Salvar configuração")).toBeUndefined();        // salva sozinha
    await digitar(porLabel(host, "Km carro"), "1,10");
    await act(async () => { await new Promise((r) => setTimeout(r, 1400)); });
    expect(mockStore.salvar.mock.calls.at(-1)[0].memoria.config.valorKm).toBe("1,10");
    expect(host.textContent).toContain("Configuração salva");
    await clicar(host, "← Voltar ao dia");
    expect(host.textContent).toContain("Você está em MK Home");
  } finally { await act(async () => root.unmount()); host.remove(); }
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

test("fator moto e comprovante no pedágio; RD do dia embute comprovantes e sai sem emoji", async () => {
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
  const dia = { data: "2026-10-15", estado: "fechado", trechos: [{ id: "t1", origem: "MK_HOME", destino: "MK602", veiculo: "moto", kmInicial: 100, kmFinal: 174, abertura: { em: "2026-10-15T05:14:00.000-03:00" }, chegada: { em: "2026-10-15T06:16:00.000-03:00", gps: { lat: -23.66, lng: -46.44 } }, pedagios: [{ descricao: "Pedágio", valor: 5.7, fotoId: "fabc" }], gastos: [], atividades: [{ texto: "Contato com a administração — Alinhamento", status: null, tag: "adm" }, { texto: "Checar calhas", status: "aberto" }], obs: "" }] };
  const html = htmlRd(dia, {}, "m", { fabc: "data:image/jpeg;base64,FOTO" });
  expect(html).toContain("Comprovantes");
  expect(html).toContain("Moto");
  expect(html).not.toMatch(/[\u{1F000}-\u{1FAFF}⚠✔]/u);     // documento profissional: sem emoji
  expect(html).toContain("Contato com a administração");
  expect(html).toContain("— Alinhamento");
  expect(html).toContain("Lembretes para a próxima visita");
  expect(html).toContain("Imprimir / Salvar PDF");                     // barra de salvar no topo
});

test("atividades em casa: voltou para MK Home e registra o que fez; home office abre pelo próprio MK Home, sem exigir km", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  mockStore.ler.mockResolvedValue({ dia: { data: "2026-10-15", estado: "aberto", revisao: 2, trechos: [
    { id: "t1", origem: "MK_HOME", destino: "MK602", veiculo: "carro", kmInicial: 100, kmFinal: 174, abertura: { em: "2026-10-15T05:14:00.000-03:00" }, chegada: { em: "2026-10-15T06:16:00.000-03:00" }, pedagios: [], gastos: [], atividades: [], obs: "" },
    { id: "t2", origem: "MK602", destino: "MK_HOME", veiculo: "carro", kmInicial: 174, kmFinal: 248, abertura: { em: "2026-10-15T12:00:00.000-03:00" }, chegada: { em: "2026-10-15T14:15:00.000-03:00" }, pedagios: [], gastos: [], atividades: [], obs: "" },
  ] }, memoria: { revisao: 3 } });
  try {
    await montar(host, root);
    // chegou em casa: o card oferece o registro das atividades, não a visita
    expect(host.textContent).toContain("Atividades em casa (home office)");
    await digitar(host.querySelector('[aria-label="Nova atividade em casa"]'), "MK311 — contato com o líder e a emp. de segurança");
    await clicar(host, "+ Registrar");
    expect(host.textContent).toContain("MK311 — contato com o líder");
    await clicar(host, "Salvar atividades");
    const salvo = mockStore.salvar.mock.calls.at(-1)[0];
    expect(salvo.dia.trechos[1].atividades[0]).toEqual({ texto: "MK311 — contato com o líder e a emp. de segurança", status: null });
  } finally { await act(async () => root.unmount()); host.remove(); }

  // dia seguinte, home office: MK Home aparece na cascata mesmo estando em casa, e fecha sem km
  const host2 = document.createElement("div"); document.body.appendChild(host2); const root2 = createRoot(host2);
  mockStore.ler.mockResolvedValue({ dia: null, memoria: { revisao: 3 } });
  marcoSeq = [
    { em: "2026-10-16T08:00:00.000-03:00", gps: { lat: -23.6, lng: -46.7, acc: 10 }, endereco: "Taboão da Serra - SP" },
    { em: "2026-10-16T17:30:00.000-03:00", gps: { lat: -23.6, lng: -46.7, acc: 10 }, endereco: "Taboão da Serra - SP" },
  ];
  try {
    await montar(host2, root2);
    expect(host2.textContent).toContain("Home office — trabalhar de casa");
    await clicar(host2, "MK Home");
    expect(host2.textContent).toContain("Home office · trabalhando de casa");
    expect(host2.textContent).toContain("Atividades em casa (home office)");
    await clicar(host2, "Encerrar — fechar o período em casa");     // sem km: não pode travar
    const fechado = mockStore.salvar.mock.calls.at(-1)[0];
    expect(fechado.dia.trechos[0].destino).toBe("MK_HOME");
    expect(fechado.dia.trechos[0].chegada.em).toBe("2026-10-16T17:30:00.000-03:00");
  } finally { await act(async () => root2.unmount()); host2.remove(); }
});
