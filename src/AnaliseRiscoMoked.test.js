// Layout padrão Moked da Análise de Risco (aprovado em 04/10/2026). O motor (riscoConfig) não muda.
import { gerarHTMLAnaliseRisco, normalizarRefAR, vetoresDoTesteSemanal } from "./AnaliseRisco";
import { canonicalFollowupKey } from "./followups";
import { PROJ, SEMANAS } from "./relatorios/fixtureP605";
import { itensDoEstado, resumo } from "./relatorios/metricas";

const vet = (o) => ({ chave: o.label, nivel: 3, fonteCredito: "Teste Semanal", descricao: "", ...o });
function ctx(extra = {}) {
  return {
    project: PROJ, pacoteLabel: "Golgi",
    vetores: [
      vet({ label: "20 - PÂNICO FIXO", nivel: 3, bloqueadorCaido: true, travaTipo: "panicoFixoInoperante", classeV2: "Bloqueador", piorDias: 26 }),
      vet({ label: "01 - ALARME PERIMETRAL", nivel: 3, bloqueadorCaido: true, classeV2: "Bloqueador", piorDias: 3 }),
      vet({ label: "23 - TELEFONES", nivel: 1, classeV2: "Periférico", observacaoManutencao: true, inop: 1, total: 2, piorDias: 91 }),
    ],
    geral: { label: "CRÍTICO", nivel: 4, nBloqueadores: 2, alerta: true, motivoMatriz: "uma zona perimetral inoperante somada a outra falha relevante", metricas: { zonasNomeadas: 1 } },
    fontesUsadas: [{ titulo: "Teste Semanal / Comparativo", detalhe: "" }],
    ts: { ok: true, pct: 93, total: 61, okItens: 56, data: "04/10/2026", dataRaw: "2026-10-04", estado: SEMANAS[2].state,
      pend: [
        { catLabel: "20 - PÂNICO FIXO", itemLabel: "", status: "PARCIAL", dias: 26, since: "2026-09-08" },
        { catLabel: "01 - ALARME PERIMETRAL", itemLabel: "Zona 04", status: "INOPERANTE", dias: 3, since: "2026-10-01" },
        { catLabel: "23 - TELEFONES", itemLabel: "CCO Emergencial", status: "PARCIAL", dias: 91, since: "2026-07-05" },
      ] },
    ctmk: { ok: true, offline: false }, regional: { ok: false }, contextos: {}, ...extra,
  };
}

test("base operacional = mesma do laudo (mesma fórmula e mesmos números)", () => {
  const html = gerarHTMLAnaliseRisco(ctx());
  const r = resumo(itensDoEstado(PROJ, SEMANAS[2].state));
  expect(html).toContain(`aria-label="${r.total} ativos: ${r.ok} operacionais, ${r.parcial} parciais, ${r.inop} inoperantes"`);
  expect(html).toContain(`Saúde <b>${Math.round(r.saude)}%</b>`);
  expect(html).toContain("Onde estão as falhas");
});

test("classificação com 'por que', vetores em tabela e manutenção separada", () => {
  const html = gerarHTMLAnaliseRisco(ctx());
  expect(html).toMatch(/Classificação do ativo<\/div><div class="ar-cls"[^>]*>CRÍTICO</);
  expect(html).toContain("O motor de risco identificou <b>uma zona perimetral inoperante somada a outra falha relevante</b>");
  expect(html).toContain("trava do site");
  expect((html.match(/class="vt-linha"/g) || [])).toHaveLength(2);           // telefones não entram nos vetores
  expect(html).toContain("Itens em manutenção");
  const man = html.slice(html.indexOf("Itens em manutenção"));
  expect(man).toContain("CCO Emergencial");
  expect(html).toContain("Pânico fixo · parcial");                          // status correto (não "inoperante")
});

test("tratativa por item: sem tratativa / vencida / em dia, e ações priorizadas", () => {
  const followups = {
    [canonicalFollowupKey("P605", "01 - ALARME PERIMETRAL", "Zona 04")]: { entries: [{ status: "execucao", em: new Date().toISOString() }] },
    [canonicalFollowupKey("P605", "23 - TELEFONES", "CCO Emergencial")]: { entries: [{ status: "proposta", em: "2026-01-10T12:00:00Z" }] },
  };
  const html = gerarHTMLAnaliseRisco(ctx({ followups }));
  expect(html).toContain("Sem tratativa");           // pânico fixo
  expect(html).toContain("Em execução");              // zona 04, em dia
  expect(html).toContain("follow-up vencido");        // telefones
  const acoes = html.slice(html.indexOf("Ações priorizadas"));
  expect(acoes).toContain("Restabelecer Pânico fixo");
  expect(acoes).toContain("imediata (bloqueador)");
  expect(acoes).toContain("cobrar o retorno do follow-up");
  expect((acoes.slice(0, acoes.indexOf("</ol>")).match(/<li>/g) || []).length).toBeLessThanOrEqual(5);
});

test("nº do documento com o 'P' do projeto; referências antigas normalizadas na exibição", () => {
  expect(normalizarRefAR("P605", "MK-605-AR-0001")).toBe("MK-P605-AR-0001");
  expect(normalizarRefAR("P311A", "MK-311-AR-0003")).toBe("MK-P311A-AR-0003");
  expect(normalizarRefAR("P605", "MK-P605-AR-0007")).toBe("MK-P605-AR-0007");
  expect(gerarHTMLAnaliseRisco(ctx({ ref: "MK-605-AR-0001" }))).toContain("Nº MK-P605-AR-0001");
  expect(gerarHTMLAnaliseRisco(ctx())).toContain("Nº MK-P605-AR-0001");
});

test("vetor do teste semanal diz 'parcial desde' quando o item é parcial", () => {
  const ts = { ok: true, pid: "P605", pend: [{ catId: "panic_fix", catLabel: "20 - PÂNICO FIXO", itemLabel: "CCO", status: "PARCIAL", dias: 26, since: "2026-09-08" }],
    catAgg: { "20 - PÂNICO FIXO": { total: 1, inop: 1, piorDias: 26 } } };
  const [v] = vetoresDoTesteSemanal(ts, "04/10/2026");
  expect(v.sinceTxt).toMatch(/^parcial desde/);
});

test("seções aprovadas continuam: memória de cálculo, matriz, território e pontos fortes", () => {
  const html = gerarHTMLAnaliseRisco(ctx());
  const ordem = ["Vetores que definem o risco", "Como se chega à classificação — memória de cálculo", "Matriz de Impacto Operacional e Exposição ao Risco", "Diagnóstico territorial — por que a falha importa aqui", "Ações priorizadas", "O que sustenta a operação — pontos fortes", "Palavra do consultor"];
  const pos = ordem.map((t) => html.indexOf(t));
  pos.forEach((p) => expect(p).toBeGreaterThan(-1));
  expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  expect(html).not.toContain("undefined");
  expect(html).toContain(".corpo{padding-bottom:0}.rodape{padding-top:8px;padding-bottom:8px;break-before:avoid;page-break-before:avoid}");
});

test("zonas da mesma categoria preservam nome, status e tratativa de cada ponto", () => {
  const label = "01 - ALARME PERIMETRAL";
  const pend = [
    { catLabel: label, itemLabel: "Zona 01", status: "INOPERANTE", dias: 100, since: "2026-06-26" },
    { catLabel: label, itemLabel: "Zona 03", status: "PARCIAL", dias: 10, since: "2026-09-24" },
  ];
  const dados = ctx({
    vetores: pend.map((p, i) => vet({ label, zonaCanonica: i ? "zona-03" : "zona-01", bloqueadorCaido: true, inop: 1, total: 4 })),
    followups: { [canonicalFollowupKey("P605", label, "Zona 03")]: { entries: [{ status: "execucao", em: new Date().toISOString() }] } },
  });
  dados.ts.pend = pend;
  const linhas = gerarHTMLAnaliseRisco(dados).match(/<tr class="vt-linha">[\s\S]*?<\/tr>/g);
  expect(linhas).toHaveLength(2);
  expect(linhas[0]).toContain("Zona 01");
  expect(linhas[0]).toContain("Sem tratativa");
  expect(linhas[1]).toContain("Zona 03");
  expect(linhas[1]).toContain("parcial");
  expect(linhas[1]).toContain("Em execução");
  expect(linhas[1]).not.toContain("Zona 01");
  expect(linhas[1]).not.toContain("e mais");
});
