// Página pública do link, painel de edição de tratativas e laudo semanal com "com quem está" / proposta.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PaginaExterna, { prepararEnvios } from "./PaginaExterna";
import { recalcularRegistro } from "../followups";
import { montarLaudoSemanal } from "../relatorios/laudoSemanal";
import { resumoPorMao, linkLiberado, semRetorno, diasSemRetorno, PROJETOS_LIBERADOS } from "./config";
import { gerarLinksFaltantes } from "./gerarTodos";

global.IS_REACT_ACT_ENVIRONMENT = true;

test("prepararEnvios: só envia o preenchido; proposta exige nº; demais exigem texto", () => {
  const { envios, faltando } = prepararEnvios({
    a: { status: "proposta", propostaNumero: "123", propostaValor: "R$ 10", texto: "" },
    b: { status: "aguardando", texto: "Técnico quinta" },
    c: { status: "" },
    d: { status: "proposta", propostaNumero: " " },
    e: { status: "execucao", texto: "  " },
  });
  expect(envios.map((e) => e.key)).toEqual(["a", "b"]);
  expect(faltando.map((f) => f.key)).toEqual(["d", "e"]);
});

test("liberado para todos os projetos do teste semanal (cliente e servidor com a mesma lista); contagem por mão", () => {
  const servidor = require("../../api/ai/lib/followupLink").LIBERADOS;
  expect([...PROJETOS_LIBERADOS].sort()).toEqual([...servidor].sort());
  ["P601", "P602", "P604", "P605", "P606", "P607", "P311A", "P311B", "P505", "P260A", "P260B", "P260C"].forEach((p) => expect(linkLiberado(p)).toBe(true));
  expect(linkLiberado("P999")).toBe(false);
  expect(resumoPorMao([{ comQuem: "moked" }, { comQuem: "administracao" }, {}, { comQuem: "manutencao" }])).toEqual({ manutencao: 2, moked: 1, administracao: 1 });
});

test("recalcularRegistro: excluir a última tratativa reabre o status; resolvido só se a última for resolvida", () => {
  const reg = { key: "k", entries: [{ id: "2", status: "resolvido", em: "2026-10-12" }, { id: "1", status: "proposta", em: "2026-10-10" }], statusAtual: "resolvido", resolvido: true };
  const sem = recalcularRegistro({ ...reg, entries: reg.entries.filter((e) => e.id !== "2") });
  expect(sem).toMatchObject({ statusAtual: "proposta", resolvido: false, resolvidoEm: "" });
  expect(recalcularRegistro(reg)).toMatchObject({ statusAtual: "resolvido", resolvido: true, resolvidoEm: "2026-10-12" });
});

test("laudo semanal mostra com quem está o item e a proposta informada pelo link", () => {
  const project = { id: "P601", name: "Golgi Cajamar", categories: [{ id: "cancelas", label: "04 - CANCELAS", type: "items", itemLabels: ["Saída 04"] }] };
  const state = { cancelas: [{ status: "inop", since: "2026-10-01", note: "Haste quebrada" }] };
  const fu = { "04cancelas__saida04": { key: "04cancelas__saida04", statusAtual: "proposta", comQuem: "administracao", entries: [{ id: "1", status: "proposta", em: "2026-10-12T10:00:00Z", responsavel: "Cancelas Brasil", texto: "Troca da haste", proposta: { numero: "XYZ-1", valor: "R$ 12.500,00" }, previsao: "2026-10-20" }] } };
  const html = montarLaudoSemanal(project, state, { date: "2026-10-13" }, { followupsInfo: fu, hoje: new Date("2026-10-13T12:00:00Z") });
  expect(html).toContain("Aguardando aprovação da administração");
  expect(html).toContain("Proposta nº XYZ-1");
  expect(html).toContain("R$ 12.500,00");
});

// ── página pública ──
let host, root;
const visao = (papel, itens) => ({ ok: true, pid: "P601", projeto: "Golgi Cajamar", papel, empresa: papel === "manutencao" ? "Cancelas Brasil" : "Administração", expiraEm: "2026-10-28T12:00:00Z", itensEm: "2026-10-13T12:00:00Z", itens });
const item = (key, extra = {}) => ({ key, cat: "04 - CANCELAS", item: key, status: "inop", since: "2026-10-01", note: "", dias: 12, comQuem: "manutencao", statusAtual: "", resolvido: false, historico: [], ...extra });
const resposta = (corpo) => Promise.resolve({ ok: true, status: 200, json: async () => corpo });
const montar = async (token = "t".repeat(43)) => { await act(async () => root.render(<PaginaExterna token={token} />)); for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve(); }); };
const botao = (t) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(t));
const digitar = async (el, valor) => { const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set; await act(async () => { set.call(el, valor); el.dispatchEvent(new Event("input", { bubbles: true })); }); };
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); window.scrollTo = jest.fn(); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); delete global.fetch; });

test("manutenção: preenche proposta, 'Concluir e enviar' manda só o preenchido e o item passa para a Moked", async () => {
  const chamadas = [];
  global.fetch = jest.fn((url, opts) => {
    const corpo = JSON.parse(opts.body); chamadas.push(corpo);
    if (corpo.acao === "ver") return resposta(chamadas.filter((c) => c.acao === "enviar").length ? visao("manutencao", [item("a", { comQuem: "moked", statusAtual: "proposta" }), item("b")]) : visao("manutencao", [item("a"), item("b")]));
    return resposta({ ok: true, gravados: 1 });
  });
  await montar();
  expect(host.textContent).toContain("Para você tratar (2)");
  expect(botao("Concluir e enviar").disabled).toBe(true);
  await act(async () => { host.querySelectorAll("button")[0].click(); });
  await act(async () => { [...host.querySelectorAll("button")].find((b) => b.textContent.includes("Proposta enviada")).click(); });
  const numero = host.querySelector('input[placeholder="Ex.: 2026-0412"]');
  await digitar(numero, "XYZ-9");
  await act(async () => { botao("Concluir e enviar").click(); });
  for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve(); });
  const envio = chamadas.find((c) => c.acao === "enviar");
  expect(envio.envios).toEqual([{ key: "a", status: "proposta", texto: "", propostaNumero: "XYZ-9", propostaValor: "", previsao: "" }]);
  expect(host.textContent).toContain("seguiram para a Moked");
  expect(host.textContent).toContain("Já enviados (1)");
});

test("administração: vê só o que foi encaminhado e aprova", async () => {
  const chamadas = [];
  global.fetch = jest.fn((url, opts) => {
    const corpo = JSON.parse(opts.body); chamadas.push(corpo);
    if (corpo.acao === "ver") return resposta(visao("administracao", [item("a", { comQuem: "administracao", statusAtual: "proposta", historico: [{ status: "proposta", proposta: { numero: "XYZ-9", valor: "R$ 5.000,00" }, responsavel: "Cancelas Brasil", em: "2026-10-12T10:00:00Z", texto: "Troca" }] }), item("b", { comQuem: "manutencao" })]));
    return resposta({ ok: true });
  });
  await montar();
  expect(host.textContent).toContain("Aguardando sua decisão (1)");
  expect(host.textContent).toContain("Proposta nº XYZ-9");
  expect(host.textContent).not.toContain("Concluir e enviar");
  await act(async () => { botao("Aprovar").click(); });
  for (let i = 0; i < 3; i++) await act(async () => { await Promise.resolve(); });
  expect(chamadas.find((c) => c.acao === "decidir")).toMatchObject({ key: "a", decisao: "aprovado" });
});

test("link expirado mostra mensagem clara", async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 404, json: async () => ({ ok: false, erro: "Link inválido ou expirado." }) }));
  await montar();
  expect(host.textContent).toContain("inválido ou expirou");
});

test("laudo semanal com link: traz QR e o endereço; sem link nada muda", () => {
  const project = { id: "P601", name: "Golgi Cajamar", categories: [{ id: "cancelas", label: "04 - CANCELAS", type: "items", itemLabels: ["Saída 04"] }] };
  const state = { cancelas: [{ status: "inop", since: "2026-10-01", note: "Haste quebrada" }] };
  const base = montarLaudoSemanal(project, state, { date: "2026-10-13" }, { hoje: new Date("2026-10-13T12:00:00Z") });
  expect(base).not.toContain("Atualização de follow-up pela empresa de manutenção");
  const com = montarLaudoSemanal(project, state, { date: "2026-10-13" }, { linkFollowup: { url: "https://moklog-checktest.vercel.app/?fu=abc", qr: "data:image/png;base64,AAA" }, hoje: new Date("2026-10-13T12:00:00Z") });
  expect(com).toContain("Atualização de follow-up pela empresa de manutenção");
  expect(com).toContain("https://moklog-checktest.vercel.app/?fu=abc");
  expect(com).toContain('src="data:image/png;base64,AAA"');
});

test("urlDoLink: domínios vercel.app (inclusive preview) saem pelo domínio principal; domínio próprio é mantido", () => {
  const { urlDoLink } = require("./api");
  const t = "a".repeat(43);
  expect(urlDoLink(t, "https://moklog-checktest-git-x-marcio.vercel.app")).toBe(`https://moklog-checktest.vercel.app/?fu=${t}`);
  expect(urlDoLink(t, "https://app.moked.com.br")).toBe(`https://app.moked.com.br/?fu=${t}`);
});

test("sem proposta: análise do técnico mantém o item com a manutenção, e a Moked vê quem está sem retorno", () => {
  const agora = Date.parse("2026-10-20T12:00:00Z");
  const reg = (dias) => ({ entries: [{ status: "aguardando", em: new Date(agora - dias * 86400000).toISOString() }] });
  expect(semRetorno("manutencao", reg(2), agora)).toBe(false);
  expect(semRetorno("manutencao", reg(7), agora)).toBe(true);
  expect(semRetorno("manutencao", null, agora)).toBe(true); // nunca teve retorno
  expect(semRetorno("moked", reg(30), agora)).toBe(false); // bola com a Moked não é atraso da manutenção
  expect(semRetorno("administracao", reg(30), agora)).toBe(false);
  expect(diasSemRetorno(reg(9), agora)).toBe(9);
});

test("laudo semanal: análise do técnico sem proposta aparece como tal", () => {
  const project = { id: "P601", name: "Golgi Cajamar", categories: [{ id: "cftv", label: "06 - CFTV", type: "items", itemLabels: ["CF35"] }] };
  const state = { cftv: [{ status: "inop", since: "2026-10-01", note: "Sem imagem" }] };
  const fu = { "06cftv__cf35": { key: "06cftv__cf35", statusAtual: "aguardando", comQuem: "manutencao", entries: [{ id: "1", status: "aguardando", em: "2026-10-12T10:00:00Z", texto: "Fonte queimada", responsavel: "Cancelas Brasil" }] } };
  const html = montarLaudoSemanal(project, state, { date: "2026-10-13" }, { followupsInfo: fu, hoje: new Date("2026-10-13T12:00:00Z") });
  expect(html).toContain("Com a manutenção — análise do técnico, sem proposta");
});

test("gerar links que faltam: cria só o que não existe, com os itens do último teste de cada projeto", async () => {
  const chamadas = [];
  const existentes = { P601: [{ papel: "manutencao" }, { papel: "administracao" }], P602: [{ papel: "manutencao" }] };
  const chamar = async (acao, corpo) => { chamadas.push([acao, corpo]); return acao === "listar" ? { links: existentes[corpo.pid] || [] } : { ok: true }; };
  const pendencias = [{ project: { id: "P602" }, cat: "06 - CFTV", item: "CF35", status: "inop", since: "2026-10-01" }];
  const r = await gerarLinksFaltantes({ pendencias, nomeDe: (pid) => "Projeto " + pid, chamar });
  const criar = chamadas.filter(([a]) => a === "criar").map(([, c]) => c);
  expect(r.criados).toBe(1 + 2 * (PROJETOS_LIBERADOS.length - 2));
  expect(criar.some((c) => c.pid === "P601")).toBe(false);
  expect(criar.filter((c) => c.pid === "P602").map((c) => c.papel)).toEqual(["administracao"]);
  expect(criar.find((c) => c.pid === "P602").itens).toHaveLength(1);
  expect(criar.find((c) => c.pid === "P604").itens).toEqual([]);
});
