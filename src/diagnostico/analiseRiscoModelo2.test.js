// Modelo 2 da Análise de Risco (com Diagnóstico concluído): seleção, resumo, blocos HTML e integração com o relatório.
import { escolherDiagnosticoConcluido, motivoSemConcluido, resumoModelo2, blocosModelo2, refModelo2 } from "./analiseRiscoModelo2";
import { classificarProjeto, vetoresDoTesteSemanal, gerarHTMLAnaliseRisco } from "../AnaliseRisco";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const resp = { "D01.03.02": { status: "ausente_necessario", situacao: "Sem cancela AS", indicacao: "Instalar cancela AS" } };
const d = (id, estado, atualizadoEm, respostas = resp) => ({ id, estado, atualizadoEm, respostas });

test("só diagnóstico CONCLUÍDO entra; rascunho e arquivado ficam de fora; vale o mais recente", () => {
  expect(escolherDiagnosticoConcluido([d("a", "rascunho", "2026-10-12"), d("b", "arquivado", "2026-10-11")])).toBeNull();
  expect(escolherDiagnosticoConcluido([d("a", "concluido", "2026-10-10"), d("b", "concluido", "2026-10-12"), d("c", "rascunho", "2026-10-13")]).id).toBe("b");
  expect(escolherDiagnosticoConcluido([d("a", "concluido", "2026-10-10", {})])).toBeNull();
  expect(escolherDiagnosticoConcluido([])).toBeNull();
});

test("motivo de não entrar: rascunho salvo x nada salvo", () => {
  expect(motivoSemConcluido([d("a", "rascunho", "2026-10-12")])).toContain("Concluir diagnóstico");
  expect(motivoSemConcluido([])).toBe("nenhum diagnóstico salvo para este projeto");
  expect(motivoSemConcluido([d("a", "arquivado", "2026-10-12")])).toBe("nenhum diagnóstico salvo para este projeto");
});

test("refModelo2 acrescenta -DX uma única vez", () => {
  expect(refModelo2("MK-P605-AR-0001")).toBe("MK-P605-AR-0001-DX");
  expect(refModelo2("MK-P605-AR-0001-DX")).toBe("MK-P605-AR-0001-DX");
});

const catalogo = { categorias: [{ id: "D01", nome: "Perímetro", ordem: 1 }], subcategorias: [{ id: "D01.03", categoria: "D01", nome: "Barreiras", ordem: 1 }] };
const itens = [
  { id: "D01.03.02", subcategoria: "D01.03", texto: "Cancelas de alta segurança", criticidade: "critico", padrao: "Cancela AS homologada", ordem: 1 },
  { id: "D01.03.04", subcategoria: "D01.03", texto: "Dilaceradores", criticidade: "relevante", padrao: "Dilacerador na saída", ordem: 2 },
];
const diag = { id: "d1", estado: "concluido", respostas: { ...resp, "D01.03.04": { status: "conforme" } } };

test("resumoModelo2 + blocosModelo2: categoria, plano priorizado e padrão Moked × existente", () => {
  const m = resumoModelo2({ catalogo, itens, diag, todos: [diag], projetoRef: "P505", nomeProjeto: "Klog" });
  expect(m.total).toBe(2);
  expect(m.respondidos).toBe(2);
  expect(m.secoes.length).toBeGreaterThan(0);
  const html = blocosModelo2(m, esc);
  expect(html).toContain("Diagnóstico Situacional — situação por categoria");
  expect(html).toContain("Plano de ação priorizado do Diagnóstico");
  expect(html).toContain("Instalar cancela AS");
  expect(html).toContain("Padrão Moked × existente");
  expect(html).toContain("haste reforçada");
  expect(blocosModelo2(null, esc)).toBe("");
});

// ── integração: modelo 1 (sem diagnóstico) intacto; modelo 2 só com diagnóstico concluído ──
const pend = [{ catId: "cftv", catLabel: "06 - CFTV FIXAS", itemLabel: "CF1", status: "INOPERANTE", dias: 3, since: "2026-10-01", note: "" }];
const ts = { ok: true, temDado: true, pid: "P505", pend, catAgg: { "06 - CFTV FIXAS": { total: 78, inop: 1, piorDias: 3 } }, data: "04/10/2026", dataRaw: "2026-10-04", pct: 98, total: 100, okItens: 98 };
const rodar = (dadosDiag) => classificarProjeto({ id: "P505", name: "Klog Guarulhos" }, vetoresDoTesteSemanal(ts, "04/10/2026"), { ts, ...(dadosDiag ? { diag: dadosDiag } : {}) });
const htmlDe = (r) => gerarHTMLAnaliseRisco({ project: { id: "P505", name: "Klog Guarulhos" }, pacoteLabel: "Klog", vetores: r.vetores, geral: r.geral, fontesUsadas: [{ titulo: "Teste Semanal", detalhe: "98%" }], ts: { ok: false }, ctmk: null, regional: { ok: false }, contextos: {}, ref: "MK-P505-AR-0001" });

test("sem diagnóstico: relatório do modelo 1, sem -DX e sem seções do diagnóstico", () => {
  const html = htmlDe(rodar(null));
  expect(html).toContain("Nº MK-P505-AR-0001<");
  expect(html).not.toContain("Modelo 2");
  expect(html).not.toContain("Plano de ação priorizado do Diagnóstico");
});

test("com diagnóstico concluído: modelo 2 = relatório base + seções do diagnóstico, número com -DX", () => {
  const modelo2 = resumoModelo2({ catalogo, itens, diag, todos: [diag], projetoRef: "P505", nomeProjeto: "Klog" });
  const html = htmlDe(rodar({ ok: true, id: "d1", itens, rotulo: "Revisão 1", atualizadoEm: "2026-10-12T10:00:00Z", percentual: 100, respostas: diag.respostas, modelo2 }));
  expect(html).toContain("Nº MK-P505-AR-0001-DX");
  expect(html).toContain("Modelo 2 — com Diagnóstico Situacional");
  expect(html).toContain("Classificação do ativo"); // base do modelo 1 preservada
  expect(html).toContain("Diagnóstico Situacional anexado");
  expect(html).toContain("Plano de ação priorizado do Diagnóstico");
});
