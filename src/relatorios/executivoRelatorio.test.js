import { montarHTMLExecutivo, montarProjetos, MODULOS_FUTUROS } from "./executivoRelatorio";
const AG = new Date("2026-10-05T22:30:00");
const ROWS = [
  { id: "P601", name: "Golgi Cajamar", score: 72, base: 92, penalidades: [{ label: "2 falha(s) KeyAccess aberta(s)", val: 10, tipo: "keyaccess", qtd: 2 }, { label: "Ronda VSPP 54% no último dia", val: 10, tipo: "ronda", qtd: 54 }], ilumDeficientes: 6, ilumTotal: 120, energiaQuedas7d: 1, energiaAberta: false, energiaTemDados: true },
  { id: "P605", name: "Golgi Dutra", score: 82, base: 92, penalidades: [{ label: "2 falha(s) KeyAccess aberta(s)", val: 10 }], ilumDeficientes: 19, ilumTotal: 200, energiaQuedas7d: 0, energiaAberta: false },
  { id: "P604", name: "Golgi <b>Jundiaí</b>", score: 67, base: 82, penalidades: [], ilumDeficientes: 0, ilumTotal: 0, energiaQuedas7d: 0, energiaAberta: false, energiaTemDados: false, semChecklist: true },
];
const EX = { P601: { ultimo: { pct: 92, total: 182, ok: 166, partial: 1, inop: 15, data: "2026-10-04" }, tendencia: [{ pct: 91 }, { pct: 92 }, { pct: 92 }] } };
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

test("por cliente: sem grupo (visão Todos) não gera", () => {
  expect(() => montarHTMLExecutivo({ rows: ROWS, grupoLabel: null, agora: AG })).toThrow(/selecione um grupo/);
});
test("classificação por pontuação, média e cartões vindos só das linhas da Visão 360", () => {
  const ps = montarProjetos([...ROWS].sort((a, b) => b.score - a.score), EX);
  expect(ps.map((p) => p.id)).toEqual(["P605", "P601", "P604"]);
  const p601 = ps.find((p) => p.id === "P601");
  expect(p601.cards.map((c) => c.titulo)).toEqual(["Checklist semanal", "KeyAccess", "Ronda VSPP", "Energia", "Iluminação", "Consolidado (tendência)"]);
  expect(p601.cards[0].texto).toContain("182 pontos · 15 inoperantes · 1 parciais · checklist de 04/10/2026");
  expect(p601.cards.find((c) => c.titulo === "KeyAccess").valor).toBe("2 abertas");
  expect(p601.cards.find((c) => c.titulo === "KeyAccess").efeito).toBe("−10 na pontuação");
  expect(p601.cards.find((c) => c.titulo === "Ronda VSPP").valor).toBe("54%");
  const p604 = ps.find((p) => p.id === "P604");
  expect(p604.cards[0].valor).toBe("—");                                   // sem checklist: nunca vira zero
  expect(p604.cards.map((c) => c.titulo)).not.toContain("Iluminação");     // sem dado de iluminação: cartão omitido
  const en604 = p604.cards.find((c) => c.titulo === "Energia");
  expect([en604.valor, en604.efeito]).toEqual(["—", "não aferido"]);          // sem registros de energia ≠ "nenhuma queda"
  // penalidade sem tipo/quantidade estruturados: nenhum número extraído do rótulo
  const semTipo = montarProjetos([{ id: "X", name: "X", score: 90, base: 95, penalidades: [{ label: "3 algo 7", val: 5 }], energiaTemDados: true }])[0];
  expect(semTipo.cards.find((c) => c.titulo === "Pendência").valor).toBe("−5");
  const html = montarHTMLExecutivo({ rows: ROWS, grupoLabel: "Golgi", agora: AG, extras: EX, notaCalculo: "Nota." });
  expect(html).toContain("var MEDIA=74;");                                  // (82 + 72 + 67) / 3 = 73,7 → 74
});
test("ausências declaradas, escape de texto, sem emojis e sem fechar o script por dado", () => {
  const html = montarHTMLExecutivo({ rows: ROWS, grupoLabel: "Golgi", agora: AG, extras: EX });
  for (const m of MODULOS_FUTUROS) expect(html).toContain(m);
  expect(html).toContain("Não incluídos nesta versão");
  expect(html).not.toContain("<b>Jundiaí</b>"); expect(html).toContain("&lt;b&gt;Jundiaí&lt;/b&gt;");
  expect((html.match(/<\/script>/g) || []).length).toBe(1);
  expect(html).not.toMatch(EMOJI);
  expect(html).toContain("não se atualiza sozinho");
});

describe("nível 3 — resumo de cada relatório", () => {
  test("iluminação: pontos checados, % operacionais, pior quadrante e tabela por quadrante", () => {
    const quads = [{ nome: "A1", total: 100, deficientes: 3, atualizadoEm: "2026-10-04T21:00:00" }, { nome: "B2", total: 80, deficientes: 12 }, { nome: "C3", total: 50, deficientes: null }];
    const c = montarProjetos([{ id: "P605", name: "X", score: 82, base: 92, penalidades: [], ilumDeficientes: 15, ilumTotal: 230 }], { P605: { iluminacao: quads } })[0].cards.filter((x) => x.titulo === "Iluminação");
    expect(c.length).toBe(1);                                                  // substitui o cartão simples da linha
    expect(c[0].valor).toBe("15 deficientes");
    expect(c[0].texto).toBe("180 de 230 pontos checados · 91,7% operacionais · pior quadrante: B2 (12 de 80)");
    expect(c[0].detalhe).toContain("<td>B2</td><td>80</td><td>12</td><td>85%</td>"); expect(c[0].detalhe).toContain("não informado");
    expect(c[0].detalhe).toContain("1 quadrante(s) sem deficientes informados");
    const nulo = montarProjetos([{ id: "P605", name: "X", score: 82, base: 92, penalidades: [] }], { P605: { iluminacao: null } })[0].cards.find((x) => x.titulo === "Iluminação");
    expect(nulo.efeito).toBe("não aferido");
  });
  test("iluminação: todos não informados = não aferido (nunca '0 deficientes'); texto e negativo não viram número", () => {
    const ilu = (quads) => montarProjetos([{ id: "P605", name: "X", score: 82, base: 92, penalidades: [] }], { P605: { iluminacao: quads } })[0].cards.find((x) => x.titulo === "Iluminação");
    const todos = ilu([{ nome: "A1", total: 100, deficientes: null }, { nome: "B2", total: 80 }]);
    expect([todos.valor, todos.nivel, todos.efeito]).toEqual(["—", "neutro", "não aferido"]);
    expect(todos.texto).toBe("2 quadrante(s), 180 pontos cadastrados, sem deficientes informados");
    const inval = ilu([{ nome: "A1", total: 100, deficientes: "abc" }, { nome: "B2", total: 80, deficientes: -3 }, { nome: "C3", total: 50, deficientes: "4" }]);
    expect(inval.valor).toBe("4 deficientes"); expect(inval.texto).toContain("50 de 230 pontos checados");
    expect((inval.detalhe.match(/valor inválido/g) || []).length).toBe(2);
  });
  test("sem registros × não aferido × sem registros no período (estados explícitos)", () => {
    const base = { ultimo: { pct: 92, total: 1, ok: 1, partial: 0, inop: 0, data: "2026-10-04" } };
    const p = montarProjetos([{ id: "P601", name: "X", score: 90, base: 92, penalidades: [], energiaTemDados: true }], { P601: { ...base, keyaccess: [], rondaTurnos: [], cameras: [], manutencao: [], ambulancia: [] } }, new Date("2026-10-06T07:00:00"))[0];
    const t = (x) => p.cards.find((c) => c.titulo === x);
    for (const x of ["KeyAccess", "Ronda virtual (CFTV)", "Tempo de gravação (CFTV)", "Manutenção técnica", "Acessos de ambulância"]) { expect(t(x).valor).toBe("—"); expect(t(x).efeito).toBe("sem registros"); }
    const antigo = [{ id: "t", tipo: "noturno", dataInicio: "2026-08-01", arquivado: true, plantonista: { id: "a", nome: "A" }, rondas: {} }];
    const p2 = montarProjetos([{ id: "P601", name: "X", score: 90, base: 92, penalidades: [] }], { P601: { ...base, rondaTurnos: antigo } }, new Date("2026-10-06T07:00:00"))[0];
    expect(p2.cards.find((c) => c.titulo === "Ronda virtual (CFTV)").efeito).toBe("sem registros no período");
  });
  test("KeyAccess: valor e desconto preservados da linha da Visão 360 (sem fórmula paralela)", () => {
    const row = { id: "P601", name: "X", score: 82, base: 92, penalidades: [{ label: "2 falha(s) KeyAccess aberta(s)", val: 10, tipo: "keyaccess", qtd: 2 }] };
    const lidas = [{ data: "2026-10-01" }, { data: "2026-10-02" }, { data: "2026-10-03" }];
    const c = montarProjetos([row], { P601: { keyaccess: lidas } })[0].cards.find((x) => x.titulo === "KeyAccess");
    expect([c.valor, c.efeito]).toEqual(["2 abertas", "−10 na pontuação"]);
    expect(c.detalhe).toContain("Leitura na emissão: 3 em aberto. A pontuação usa a leitura da Visão 360 (2).");
  });
  test("tabela do grupo declara o período da energia", () => {
    const html = montarHTMLExecutivo({ rows: [{ id: "P601", name: "X", score: 90, base: 92, penalidades: [], energiaTemDados: true, energiaQuedas7d: 1 }], grupoLabel: "Golgi", agora: new Date("2026-10-06T07:00:00"),
      extras: { P601: { energia: [{ inicioQueda: "2026-10-01T10:00:00", fimQueda: "2026-10-01T11:00:00" }] } } });
    expect(html).toContain("Energia (quedas)"); expect(html).toContain('"periodo":"30 dias"'); expect(html).not.toContain("Energia (7 dias)");
  });
  const AG3 = new Date("2026-10-06T07:00:00");
  const row = { id: "P601", name: "Golgi Cajamar", score: 72, base: 92, penalidades: [], ilumDeficientes: 6, ilumTotal: 140, energiaQuedas7d: 1, energiaAberta: false, energiaTemDados: true };
  const ex = {
    ultimo: { pct: 92, total: 182, ok: 166, partial: 1, inop: 15, data: "2026-10-04" }, tendencia: [{ pct: 93, data: "2026-09-27" }, { pct: 92, data: "2026-10-04" }],
    falhasSistemas: [{ cat: "Pânico móvel <x>", inop: 4, parcial: 0 }],
    keyaccess: [{ data: "2026-10-01", horaInicio: "08:00", portal: "Portaria 1" }, { data: "2026-09-20", horaInicio: "09:00", horaFim: "09:30" }],
    energia: [{ inicioQueda: "2026-09-21T18:08:00", fimQueda: "2026-09-21T23:08:00", gerador: "sim" }, { inicioQueda: "2026-10-03T10:00:00", fimQueda: "2026-10-03T10:30:00", gerador: "sim" }],
    rondaTurnos: [], cameras: [{ diasGravacao: 19 }, { diasGravacao: 24 }, { diasGravacao: null }, { diasGravacao: "" }],
    manutencao: [{ data: "2026-09-15", sistema: "Perímetro", status: "parcial", servico: "Técnico CPF: 933.707.925-91" }, { data: "2026-09-24", sistema: "Torniquete", status: "concluida" }],
  };
  const ps = (e) => montarProjetos([row], { P601: e }, AG3)[0];
  test("cartões com resumo: laudo, consolidado, KeyAccess, energia, gravação e manutenção", () => {
    const p = ps(ex); const t = (x) => p.cards.find((c) => c.titulo === x);
    expect(t("Checklist semanal").detalhe).toContain("Pânico móvel &lt;x&gt;");
    expect(t("Consolidado (tendência)").valor).toBe("-1 pp");
    expect(t("KeyAccess").valor).toBe("0 abertas"); expect(t("KeyAccess").efeito).toBe("sem desconto na pontuação");   // valor da linha
    expect(t("KeyAccess").detalhe).toContain("Portaria 1"); expect(t("KeyAccess").detalhe).toContain("Leitura na emissão: 1 em aberto");
    expect(t("Energia").valor).toBe("2 quedas");   // 21/09 e 03/10 estão nos 30 dias antes de 06/10
    expect(t("Energia").detalhe).toContain("Gerador acionado em 2 de 2 quedas");
    expect(t("Tempo de gravação (CFTV)").valor).toBe("19–24 dias"); expect(t("Tempo de gravação (CFTV)").texto).toContain("2 sem medição");   // "" não vira 0
    expect(t("Manutenção técnica").valor).toBe("1 em aberto"); expect(t("Manutenção técnica").detalhe).not.toContain("933.707");   // sem texto livre/CPF
  });
  test("fonte que falhou = não aferido; documento inexistente = sem registros", () => {
    const p = ps({ ...ex, keyaccess: null, energia: [], cameras: null, manutencao: null });
    expect(p.cards.find((c) => c.titulo === "KeyAccess").efeito).toBe("não aferido");
    expect(p.cards.find((c) => c.titulo === "Energia").texto).toBe("Sem registros de energia no app para este projeto");
    expect(p.cards.find((c) => c.titulo === "Tempo de gravação (CFTV)").valor).toBe("—");
    expect(p.cards.find((c) => c.titulo === "Manutenção técnica").efeito).toBe("não aferido");
  });
  test("ambulância só quando a fonte foi pedida (Mega), sem dado de vítima", () => {
    expect(ps(ex).cards.find((c) => c.titulo === "Acessos de ambulância")).toBeUndefined();
    const amb = [{ data: "2026-10-01", horaEntrada: "10:00", horaSaida: "10:40", inquilino: "Inquilino A", tipo: "Mal súbito", paciente: "NOME DA VÍTIMA" }];
    const c = ps({ ...ex, ambulancia: amb }).cards.find((x) => x.titulo === "Acessos de ambulância");
    expect(c.valor).toBe("1"); expect(c.detalhe).toContain("Inquilino A"); expect(c.detalhe).not.toContain("NOME DA VÍTIMA");
  });
});
