// Cruzamento Diagnóstico × Análise de Risco: só sobe, mostra a conta, e sem a caixa marcada nada muda.
import { avaliarDiagnosticoParaRisco, aplicarDiagnosticoNaMemoria } from "./diagnosticoRisco";
import { classificarProjeto, vetoresDoTesteSemanal, gerarHTMLAnaliseRisco } from "../AnaliseRisco";
import { NIVEL } from "../riscoConfig";

const itens = [
  { id: "D01.03.02", texto: "Cancelas de alta segurança", criticidade: "critico" },
  { id: "D01.03.04", texto: "Dilaceradores", criticidade: "relevante" },
  { id: "D03.01.01", texto: "Muro, gradil e portões", criticidade: "critico" },
  { id: "D02.01.01", texto: "Ambiente segregado e controle de entrada", criticidade: "critico" },
  { id: "D02.02.01", texto: "Cobertura de câmeras por área", criticidade: "critico" },
  { id: "D02.03.07", texto: "Nobreak, gerador e autonomia elétrica", criticidade: "critico" },
  { id: "D05.01.05", texto: "Botão de pânico/coação (fixo ou móvel)", criticidade: "critico" },
  { id: "D02.01.03", texto: "Monitores", criticidade: "relevante" },
];
const av = (respostas, nivelBase = NIVEL.MODERADO) => avaliarDiagnosticoParaRisco({ respostas, itens, nivelBase });
const st = (status, x = {}) => ({ status, ...x });

test("1 via de bloqueio ausente (P505 sem cancela de alta segurança) sobe MODERADO → ELEVADO e mostra a conta", () => {
  const r = av({ "D01.03.02": st("ausente_necessario", { situacao: "Sem cancela AS", indicacao: "Instalar" }) });
  expect(r).toMatchObject({ nivelFinal: NIVEL.ELEVADO, subiu: true, labelBase: "MODERADO", labelFinal: "ELEVADO" });
  expect(r.linhas[0].regra).toBe("1 via de bloqueio transponível → piso ELEVADO");
  expect(r.linhas[0].fato).toContain("Cancelas de alta segurança (ausente)");
  expect(r.resultado).toContain("elevou a classificação de MODERADO para ELEVADO");
  expect(r.recomendacoes[0]).toMatchObject({ id: "D01.03.02", eleva: true, indicacao: "Instalar" });
  expect(r.recomendacoes[0].padrao).toContain("alta segurança");
});

test("2 ou mais vias de bloqueio = CRÍTICO (mesma doutrina v2)", () => {
  const r = av({ "D01.03.02": st("ausente_necessario"), "D01.03.04": st("nao_conforme") }, NIVEL.BAIXO);
  expect(r.nivelFinal).toBe(NIVEL.CRITICO);
  expect(r.linhas[0].regra).toContain("2 vias de bloqueio transponíveis → piso CRÍTICO");
});

test("outros críticos fora do padrão: 1-2 = piso MODERADO, 3 ou mais = piso ELEVADO", () => {
  expect(av({ "D02.01.01": st("nao_conforme") }, NIVEL.BAIXO).nivelFinal).toBe(NIVEL.MODERADO);
  expect(av({ "D02.01.01": st("nao_conforme"), "D02.02.01": st("ausente_necessario") }, NIVEL.BAIXO).nivelFinal).toBe(NIVEL.MODERADO);
  const tres = av({ "D02.01.01": st("nao_conforme"), "D02.02.01": st("nao_conforme"), "D02.03.07": st("ausente_necessario") }, NIVEL.BAIXO);
  expect(tres.nivelFinal).toBe(NIVEL.ELEVADO);
  expect(tres.linhas[0].regra).toBe("3 crítico(s) fora do padrão → piso ELEVADO");
});

test("nunca reduz: diagnóstico todo conforme não baixa um projeto CRÍTICO", () => {
  const r = av({ "D01.03.02": st("conforme"), "D02.01.01": st("conforme") }, NIVEL.CRITICO);
  expect(r).toMatchObject({ nivelFinal: NIVEL.CRITICO, subiu: false });
  expect(r.resultado).toContain("não alterou a classificação");
});

test("parcial, sem dado, não aplicável e relevantes não elevam; ficam listados", () => {
  const r = av({ "D03.01.01": st("parcial", { situacao: "Muro caído" }), "D02.02.01": st("sem_dado"), "D01.03.02": st("na"), "D02.01.03": st("nao_conforme") }, NIVEL.BAIXO);
  expect(r.nivelFinal).toBe(NIVEL.BAIXO);
  expect(r.subiu).toBe(false);
  expect(r.semAgravante.map((x) => x.item).join(" ")).toContain("parcial");
  expect(r.semAgravante.map((x) => x.item).join(" ")).toContain("sem dado");
  expect(r.recomendacoes.map((x) => x.id)).toEqual(expect.arrayContaining(["D03.01.01", "D02.01.03"]));
});

test("memória de cálculo: linha do diagnóstico entra primeiro e como determinante só quando elevou", () => {
  const memoria = { linhas: [{ fato: "CFTV", regra: "x", nivel: 2, nivelLabel: "MODERADO", determinante: true, ordem: 1 }], semAgravante: [], resultado: "= MODERADO" };
  const subiu = aplicarDiagnosticoNaMemoria(memoria, av({ "D01.03.02": st("ausente_necessario") }));
  expect(subiu.linhas[0].fonte).toBe("Diagnóstico Situacional");
  expect(subiu.linhas[0].determinante).toBe(true);
  expect(subiu.linhas[1].determinante).toBe(false);
  expect(subiu.resultado).toMatch(/^= ELEVADO/);
  expect(memoria.linhas[0].determinante).toBe(true); // entrada intacta
  const igual = aplicarDiagnosticoNaMemoria(memoria, av({ "D02.01.01": st("conforme") }));
  expect(igual.linhas[0].fato).toBe("CFTV");
  expect(igual.linhas[0].determinante).toBe(true);
});

// ── integração com o motor da Análise de Risco ──
const pend = [{ catId: "cftv", catLabel: "06 - CFTV FIXAS", itemLabel: "CF1", status: "INOPERANTE", dias: 3, since: "2026-10-01", note: "" }];
const ts = { ok: true, temDado: true, pid: "P505", pend, catAgg: { "06 - CFTV FIXAS": { total: 78, inop: 1, piorDias: 3 } }, data: "04/10/2026", dataRaw: "2026-10-04", pct: 98, total: 100, okItens: 98 };
const rodar = (diag) => {
  const dados = { ts, ...(diag ? { diag } : {}) };
  return classificarProjeto({ id: "P505", name: "Klog Guarulhos" }, vetoresDoTesteSemanal(ts, "04/10/2026"), dados);
};
const diag = { ok: true, id: "d9", itens, rotulo: "Revisão 2", atualizadoEm: "2026-10-12T10:00:00Z", percentual: 80, respostas: { "D01.03.02": st("ausente_necessario", { situacao: "Sem cancela de alta segurança", indicacao: "Instalar cancela AS" }) } };
const htmlDe = (r) => gerarHTMLAnaliseRisco({ project: { id: "P505", name: "Klog Guarulhos" }, pacoteLabel: "Klog", vetores: r.vetores, geral: r.geral, fontesUsadas: [{ titulo: "Teste Semanal", detalhe: "98%" }], ts: { ok: false }, ctmk: null, regional: { ok: false }, contextos: {} });

test("sem a fonte marcada: classificação idêntica à de antes e nada do diagnóstico no documento", () => {
  const base = rodar(null);
  expect(base.geral.diagnostico).toBeNull();
  const html = htmlDe(base);
  expect(html).not.toContain("Diagnóstico Situacional anexado");
});

test("com a fonte marcada: sobe o nível, a memória mostra a conta e o documento traz recomendações", () => {
  const base = rodar(null);
  const com = rodar(diag);
  expect(com.geral.nivel).toBeGreaterThanOrEqual(base.geral.nivel);
  expect(com.geral.nivel).toBe(NIVEL.ELEVADO);
  expect(com.geral.diagnostico.subiu).toBe(base.geral.nivel < NIVEL.ELEVADO);
  expect(com.geral.memoria.linhas.some((l) => l.fonte === "Diagnóstico Situacional")).toBe(true);
  const html = htmlDe(com);
  expect(html).toContain("Diagnóstico Situacional anexado — Revisão 2");
  expect(html).toContain("1 via de bloqueio transponível → piso ELEVADO");
  expect(html).toContain("Instalar cancela AS");
  expect(html).toContain("O diagnóstico só eleva o nível, nunca o reduz");
});
