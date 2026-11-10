import React, { act } from "react";
import { createRoot } from "react-dom/client";
const mockGetDoc = jest.fn(), mockGetDocs = jest.fn();
jest.mock("firebase/app", () => ({ initializeApp: () => ({}), getApps: () => [{}] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), doc: (_d, col, id) => ({ p: `${col}/${id}` }), collection: (_d, ...a) => ({ p: a.join("/") }), query: (r) => r, orderBy: () => ({}), limit: () => ({}), getDoc: (...a) => mockGetDoc(...a), getDocs: (...a) => mockGetDocs(...a) }));
jest.mock("../lerServidor", () => ({ getDocsSeguro: async () => ({ forEach: () => {} }) }));
jest.mock("../generatePDF", () => ({ MOKED_LOGO: "data:image/png;base64,x" }));
jest.mock("../v360Perimetral", () => ({ PERIMETRAL_VIA_RONDAS: [], zonasRuinsProjeto: () => 0 }));
jest.mock("../mapaDiario/VerMapasProjeto", () => () => <div data-testid="ver-mapas-mock">MAPA DO LÍDER</div>);
jest.mock("../mapaDiario/painel", () => ({ turnoVigente: () => ({ data: "2026-10-20", turno: "D" }) }));
jest.mock("../equipe/QuadroEfetivo", () => () => <div>QUADRO</div>);
jest.mock("../equipe/MaturidadeResumo", () => () => <div>MATURIDADE</div>);
const mockCheckPin = jest.fn(), mockPDF = jest.fn(); global.__escopo = null;
jest.mock("../session", () => ({ checkPin: (...a) => mockCheckPin(...a), clearSession: () => { global.__escopo = null; }, getClienteScope: () => global.__escopo }));
const PainelCliente = require("./PainelCliente").default;
const PROJECTS = { P601: { id: "P601", name: "Golgi Cajamar", categories: [{ id: "c1", type: "items", itemLabels: ["A", "B"] }] }, P602: { id: "P602", name: "Golgi Mauá I", categories: [{ id: "c1", type: "items", itemLabels: ["A"] }] } };
const health = (p, state) => { const arr = state.c1 || []; const inop = arr.filter((x) => x.status === "inop").length; return { total: arr.length, ok: arr.length - inop, partial: 0, inop, pct: Math.round(((arr.length - inop) / arr.length) * 100) }; };
const hoje = new Date().toLocaleDateString("sv-SE");
const stored = { P601: { history: [{ meta: { date: hoje }, state: { c1: [{ status: "ok" }, { status: "inop", note: "sem imagem" }] } }] }, P602: { history: [] } };
const equipe = { colaboradores: [{ id: "a", nome: "Ana Lima", cargo: "Vigilante", turno: "Diurno", status: "ativo", dataContratacao: "2024-01-10", historico: [{ tipo: "Treinamento", data: "2026-09-24", detalhe: "Brigada" }] }, { id: "b", nome: "Bia Souza", cargo: "VSPP Líder", turno: "Noturno", status: "ativo", dataContratacao: "2026-08-01", historico: [{ tipo: "Treinamento", data: "2026-07-16", detalhe: "Brigada — não aplicado" }] }], ferias: [{ colabId: "a", dataInicio: "2026-01-01", dataRetorno: "2099-01-01" }], desligados: [{ id: "z", nome: "Zé Saiu", cargo: "Vigilante", desligadoEm: "2026-06-01", motivoDesligamento: "Pediu demissão" }] };
const mapas = [{ data: hoje, turno: "D", status: "enviado", postos: [{ rotulo: "P1", pessoaId: "a", pessoaNome: "Ana Lima", situacao: "presente" }, { rotulo: "P2", pessoaId: "b", pessoaNome: "Bia Souza", situacao: "falta" }] }];
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => { global.__escopo = null; mockCheckPin.mockReset();
  mockGetDoc.mockImplementation(async (ref) => ref.p.startsWith("equipes/") ? { exists: () => true, data: () => equipe } : ref.p.startsWith("equipamentos/") ? { exists: () => true, data: () => ({ smartphones: [{ status: "ok" }, { status: "inop" }] }) } : ref.p.startsWith("keyaccess_falhas/") ? { exists: () => true, data: () => ({ registros: [{ horaFim: null }] }) } : { exists: () => false });
  mockGetDocs.mockImplementation(async () => ({ docs: mapas.map((m) => ({ data: () => m })) })); });
const clicar = async (el) => { expect(el).toBeTruthy(); await act(async () => el.dispatchEvent(new MouseEvent("click", { bubbles: true }))); };
const botao = (host, t) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(t) || b.getAttribute("aria-label") === t);
const montar = async (host, root) => { await act(async () => root.render(<PainelCliente PROJECTS={PROJECTS} stored={stored} computeHealth={health} ctmkData={{ P601: { status: "offline", offlineSince: "2026-10-18T10:00:00Z" } }} score360={async () => ({ score: 77.7, vulnerabilidades: ["CTMK off-line"] })} risco={async () => ({ nivel: 3, label: "ELEVADO", motivo: "1 via transponível", determinante: "Cancela P1", faltantes: [], vetores: [{ label: "Cancela P1", nivel: 3, inop: 2, total: 5, piorDias: 12, detalhe: "Cancela inoperante há 12 dias", note: "" }] })} abrirPDF={mockPDF} onBack={() => {}} />)); await act(async () => { await new Promise((r) => setTimeout(r, 20)); }); };

const menu = async (host, item) => { await clicar(botao(host, "Menu")); await clicar([...host.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === item)); };

test("PIN de proprietário: macro do grupo → parque (padrão SIS+) → telas do menu ☰ com os dados de antes", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  mockCheckPin.mockImplementation(async (_p, o) => { if (!o.cliente) return null; global.__escopo = { escopo: "GOLGI", pids: ["P601", "P602"] }; return "cliente"; });
  try {
    await montar(host, root);
    const input = host.querySelector('[aria-label="PIN do cliente"]');
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "1234"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await clicar(botao(host, "ENTRAR")); await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(mockCheckPin).toHaveBeenCalledWith("1234", { cliente: true });
    expect(host.textContent).toContain("Olá, Golgi"); expect(host.textContent).toContain("2 parques · 4 colaboradores");
    expect(host.textContent).toContain("Proprietário · visão macro");
    expect(host.textContent).toContain("2 faltas nos mapas de hoje");                    // consolidado do dia (mock: mesmo mapa nos 2 parques)
    await clicar(botao(host, "Abrir Golgi Cajamar"));
    expect(host.textContent).toContain("Olá, Golgi Cajamar"); expect(host.textContent).toContain("P601 · status da sua segurança");
    expect(host.textContent).toContain("MOKED"); expect(host.textContent).toContain("Sistema Integrado de Segurança");
    expect(host.textContent).toContain("⭐ Favoritos"); expect(host.textContent).toContain("Informativos · entorno"); expect(host.textContent).toContain("⚠ Comunicar problema");
    expect(host.textContent).toContain("Equipe de plantão agora"); expect(host.textContent).toContain("Ana"); expect(host.textContent).toContain("1 falta");
    // 🔔 avisos = luzes acesas
    await clicar(botao(host, "Avisos: 4")); expect(host.textContent).toContain("CTMK off"); await clicar(botao(host, "← Início"));
    // análise de risco pelo menu
    await menu(host, "Análise de risco"); expect(host.textContent).toContain("ELEVADO"); expect(host.textContent).not.toContain("há 12 dias");
    await clicar(botao(host, "Detalhe: Cancela P1")); expect(host.textContent).toContain("2 de 5 inoperantes · há 12 dias");
    await clicar(botao(host, "← Golgi Cajamar")); expect(host.textContent).toContain("Olá, Golgi Cajamar");
    // equipe de plantão: abas mapa (modelo do líder) / equipe completa por turno
    await clicar(botao(host, "Abrir equipe de plantão"));
    expect(host.querySelector('[data-testid="ver-mapas-mock"]')).not.toBeNull();
    await clicar(botao(host, "Equipe montada"));
    expect(host.querySelector('[data-testid="equipes-montadas"]')).not.toBeNull(); expect(host.textContent).toContain("NOTURNO"); expect(host.textContent).toContain("Bia Souza");
    await clicar(botao(host, "Maturidade")); expect(host.textContent).toContain("QUADRO"); expect(host.textContent).toContain("MATURIDADE");
    await clicar(botao(host, "← Golgi Cajamar"));
    await menu(host, "Férias"); expect(host.textContent).toContain("Ana Lima"); await clicar(botao(host, "← Golgi Cajamar"));
    // turnover: tabela + quem saiu
    await menu(host, "Turnover");
    expect(host.textContent).toContain("Quantos temos hoje"); expect(host.textContent).not.toContain("Zé Saiu");
    await clicar(botao(host, "Ver quem saiu")); expect(host.textContent).toContain("Zé Saiu"); expect(host.textContent).toContain("Pediu demissão");
    expect(host.textContent).toContain("Entraram nos últimos 12 meses");
    await clicar(botao(host, "Ver quem entrou")); expect(host.textContent).toContain("Bia Souza (VSPP Líder, desde 01/08/2026)");
    // teste semanal: toque abre o PDF
    await clicar(botao(host, "← Golgi Cajamar")); await menu(host, "Teste semanal");
    expect(host.textContent).toContain("O que está puxando a nota para baixo"); expect(host.textContent).toContain("sem imagem");
    await clicar(botao(host, `Abrir teste de ${hoje.slice(8, 10)}/${hoje.slice(5, 7)}/${hoje.slice(0, 4)}`));
    expect(mockPDF).toHaveBeenCalledWith("P601", stored.P601.history[0]);
    // treinamentos por colaborador
    await clicar(botao(host, "← Golgi Cajamar")); await menu(host, "Treinamentos");
    expect(host.textContent).toContain('1 registro "não aplicado" (não contam)');
    await clicar(botao(host, "Treinamentos de Ana Lima")); expect(host.textContent).toContain("Brigada");
    await clicar(botao(host, "Treinamentos de Bia Souza")); expect(host.textContent).toContain("NÃO APLICADO");
    // equipamentos item a item
    await clicar(botao(host, "← Golgi Cajamar")); await menu(host, "Equipamentos de plantão");
    expect(host.textContent).toContain("Smartphones");
    await clicar(botao(host, "← Golgi Cajamar")); await menu(host, "Sistemas");
    expect(host.textContent).toContain("OFF-LINE"); expect(host.textContent).toContain("1 falha em aberto");
    await clicar(botao(host, "Detalhe: CTMK (central)")); expect(host.textContent).toContain("Sem comunicação com a central");
    await clicar(botao(host, "← Golgi Cajamar")); await menu(host, "Meus parques");
    expect(host.textContent).toContain("2 parques · 4 colaboradores");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
test("PIN de gestor do parque: entra direto no parque, sem 'Meus parques' no menu; PIN errado avisa", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  mockCheckPin.mockResolvedValueOnce(null).mockImplementation(async () => { global.__escopo = { escopo: "P601", pids: ["P601"] }; return "cliente"; });
  try {
    await montar(host, root);
    await clicar(botao(host, "ENTRAR")); expect(host.textContent).toContain("PIN inválido");
    await clicar(botao(host, "ENTRAR")); await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(host.textContent).toContain("Olá, Golgi Cajamar");
    await clicar(botao(host, "Menu"));
    expect(host.textContent).toContain("Gestor do parque · somente leitura");
    expect(botao(host, "Meus parques")).toBeUndefined();
    await clicar(botao(host, "Sair")); expect(host.querySelector('[aria-label="PIN do cliente"]')).not.toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
test("SIS+: mostrador 360 → pilares → indicador; ★ favorita no início; gerencial vê a régua Moked e pode ver como o cliente", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  window.localStorage.clear();
  mockCheckPin.mockImplementation(async () => { global.__escopo = { escopo: "P601", pids: ["P601"] }; return "cliente"; });
  try {
    await montar(host, root);
    await clicar(botao(host, "ENTRAR")); await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect([...host.querySelectorAll("[role=img]")].some((e) => (e.getAttribute("aria-label") || "").startsWith("SIS+ condição geral"))).toBe(true);
    expect(host.textContent).not.toContain("Área do Gestor");
    await clicar(botao(host, "Ver detalhes da nota"));
    expect(host.textContent).toContain("SIS+ · detalhamento"); expect(host.textContent).toContain("Nota geral = RT 45% + RH 35% + RA 20%"); expect(host.textContent).toContain("Régua do cliente: ≥ 85 Bom");
    await clicar(botao(host, "Abrir Recursos Humanos"));
    expect(host.textContent).toContain("Satisfação da equipe"); expect(host.textContent).toContain("a definir");
    await clicar(botao(host, "Pôr nos favoritos: Satisfação da equipe"));
    await clicar([...host.querySelectorAll('[role="button"]')].find((b) => b.getAttribute("aria-label") === "Abrir Turnover (12 meses)"));
    expect(host.textContent).toContain("O que compõe"); expect(host.textContent).toContain("★ Nos favoritos"); // turnover é favorito padrão
    await clicar(botao(host, "Ver dados de Turnover (12 meses)")); expect(host.textContent).toContain("Quantos temos hoje");
    await clicar(botao(host, "← Golgi Cajamar")); expect(host.textContent).toContain("O que compõe"); // volta ao indicador
    await clicar(botao(host, "← Voltar")); await clicar(botao(host, "← Voltar")); await clicar(botao(host, "← Início"));
    expect(host.textContent).toContain("⭐ Favoritos"); expect(botao(host, "Abrir Satisfação da equipe")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem("sis_favs:P601"))).toContain("satisfacao");
    await clicar(botao(host, "Editar favoritos")); expect(host.textContent).toContain("⭐ Editar favoritos");
  } finally { await act(async () => root.unmount()); host.remove(); }
  // gerencial
  const host2 = document.createElement("div"); document.body.appendChild(host2); const root2 = createRoot(host2);
  global.__escopo = { escopo: "MOKED", pids: ["P601"] };
  try {
    await montar(host2, root2); await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(host2.textContent).toContain("Área do Gestor · régua interna Moked");
    await clicar(botao(host2, "Ver detalhes da nota")); expect(host2.textContent).toContain("Régua Moked: ≥ 92 Bom · 80–91 Alerta");
    await clicar(botao(host2, "ver como o cliente")); expect(host2.textContent).toContain("Área do Gestor · vendo como o cliente"); expect(host2.textContent).toContain("Régua do cliente: ≥ 85 Bom");
  } finally { await act(async () => root2.unmount()); host2.remove(); }
});
