import { avaliar, lista, CAMADAS, faixa, REGUAS } from "./motor";
import { dadosDoApp } from "./dadosApp";
import { montarHTMLSis, avaliarProjetos } from "./htmlSis";

const AG = new Date("2026-11-20T22:30:00");
const TOTAL_REQ = CAMADAS.reduce((a, c) => a + c.reqs.length, 0);
const cat = (catId, total, ok, parcial, inop, nome = catId) => ({ catId, cat: nome, total, ok, parcial, inop, saude: total ? ((ok + 0.5 * parcial) / total) * 100 : 100 });

describe("motor SIS⁺", () => {
  test("sem nenhum dado, todos os requisitos ficam 'a confirmar' (0,5) e o índice é 50", () => {
    const r = avaliar({});
    expect(r.reqs).toHaveLength(TOTAL_REQ);
    expect(r.reqs.every((x) => x.conf && x.s === 0.5 && !x.medido)).toBe(true);
    expect(r.geral).toBe(50);
    expect(r.aConfirmar).toHaveLength(TOTAL_REQ);
  });
  test("padrão 'atende' mantém o comportamento do modelo (ausente = 1)", () => {
    expect(avaliar({}, { padrao: "atende" }).geral).toBe(100);
  });
  test("geral é ponderado pelos pesos, não a média das camadas", () => {
    const r = avaliar({ P2: { s: 0, ev: "x" } }, { padrao: "atende" });
    const peso = CAMADAS.flatMap((c) => c.reqs).reduce((a, q) => a + q[2], 0);
    expect(r.geral).toBe(Math.round(((peso - 5) / peso) * 100));
    expect(r.camadas.find((c) => c.cod === "P").valor).toBe(Math.round(((CAMADAS[0].reqs.reduce((a, q) => a + q[2], 0) - 5) / CAMADAS[0].reqs.reduce((a, q) => a + q[2], 0)) * 100));
  });
  test("meta nunca chega a 100% quando há requisito com teto parcial; plano é crescente", () => {
    const r = avaliar({ P2: { s: 0 } }, { padrao: "atende" });
    expect(r.meta).toBeLessThan(100);
    expect(r.porQueNao100.map((x) => x.cod)).toContain("P2");
    expect(r.plano.hoje).toBeLessThanOrEqual(r.plano.imediato);
    expect(r.plano.imediato).toBeLessThanOrEqual(r.plano["90_dias"]);
    expect(r.plano["90_dias"]).toBeLessThanOrEqual(r.plano.estruturante);
  });
  test("réguas: cliente 85/70 e Moked 92/80 sobre o mesmo valor", () => {
    expect(faixa(85, REGUAS.cliente).rotulo).toBe("Bom");
    expect(faixa(84, REGUAS.cliente).rotulo).toBe("Atenção");
    expect(faixa(69, REGUAS.cliente).rotulo).toBe("Crítico");
    expect(faixa(88, REGUAS.moked).rotulo).toBe("Alerta");
    expect(faixa(92, REGUAS.moked).rotulo).toBe("Bom");
    expect(faixa(79, REGUAS.moked).rotulo).toBe("Crítico");
    expect(lista({}).length).toBe(TOTAL_REQ);
  });
});

describe("dados do app", () => {
  test("sem leitura nenhuma, nada é medido", () => {
    expect(dadosDoApp({}).medidos).toEqual([]);
  });
  test("equipamentos: 100% = Atende, ≥80% = Parcial, abaixo = Não atende", () => {
    const r = (c) => dadosDoApp({ categorias: [c] }).dados.M1;
    expect(r(cat("cftv", 40, 40, 0, 0)).s).toBe(1);
    expect(r(cat("cftv", 40, 34, 0, 6)).s).toBe(0.5);        // 85%
    expect(r(cat("cftv", 40, 20, 0, 20)).s).toBe(0);         // 50%
    expect(r(cat("cftv", 40, 34, 0, 6)).ev).toContain("34 de 40 operando, 6 inoperante(s)");
  });
  test("mapeia categorias para requisitos e ignora LEGADO", () => {
    const { dados, medidos } = dadosDoApp({ categorias: [cat("bollards", 7, 6, 0, 1), cat("torniquetes", 8, 8, 0, 0), cat("qr_cancelas", 13, 13, 0, 0), cat("cancelas_adm", 4, 4, 0, 0), cat("nobreaks", 2, 2, 0, 0), cat("panic_fix", 2, 2, 0, 0), cat("panic_mob", 4, 3, 1, 0), cat("portoes", 3, 0, 0, 3, "LEGADO (HISTÓRICO) — PORTÕES")] });
    expect(dados.A7.s).toBe(0.5);
    expect(dados.A9.s).toBe(1);
    expect(dados.A11.s).toBe(1);                              // o LEGADO não derruba as cancelas
    expect(dados.M13.s).toBe(0.5);
    expect(medidos).toEqual(expect.arrayContaining(["A7", "A9", "A11", "I10", "M11", "M12", "M13"]));
    expect(dados.P1).toBeUndefined();                         // requisito de diagnóstico nunca é medido
  });
  test("zona perimetral com problema rebaixa P2 para no máximo Parcial", () => {
    const row = { penalidades: [{ tipo: "perimetro", qtd: 2, val: 10, label: "x" }] };
    expect(dadosDoApp({ row, categorias: [cat("perimeter", 5, 5, 0, 0)] }).dados.P2.s).toBe(0.5);
    expect(dadosDoApp({ row, categorias: [cat("perimeter", 5, 2, 0, 3)] }).dados.P2.s).toBe(0);
    expect(dadosDoApp({ row: {}, categorias: [cat("perimeter", 5, 5, 0, 0)] }).dados.P2.s).toBe(1);
  });
  test("iluminação, gravação e ronda virtual só medem com número de verdade", () => {
    const d = (o) => dadosDoApp(o).dados;
    expect(d({ row: { ilumTotal: 200, ilumDeficientes: 0 } }).I1.s).toBe(1);
    expect(d({ row: { ilumTotal: 200, ilumDeficientes: 40 } }).I1.s).toBe(0.5);   // 80%
    expect(d({ row: { ilumTotal: 200, ilumDeficientes: 60 } }).I1.s).toBe(0);     // 70%
    expect(d({ row: { ilumTotal: 0, ilumDeficientes: 0 } }).I1).toBeUndefined();
    expect(d({ ex: { cameras: [{ diasGravacao: 30 }, { diasGravacao: "45" }] } }).M8.s).toBe(1);
    expect(d({ ex: { cameras: [{ diasGravacao: 19 }, { diasGravacao: 30 }] } }).M8.s).toBe(0);
    expect(d({ ex: { cameras: [{ diasGravacao: "" }, { diasGravacao: null }, { diasGravacao: "abc" }] } }).M8).toBeUndefined();
    expect(d({ ronda: { execucao: 95 } }).M6.s).toBe(1);
    expect(d({ ronda: { execucao: 75 } }).M6.s).toBe(0.5);
    expect(d({ ronda: { execucao: 40 } }).M6.s).toBe(0);
    expect(d({ ronda: { execucao: null } }).M6).toBeUndefined();
  });
  test("joystick inoperante rebaixa a ronda virtual", () => {
    const r = dadosDoApp({ ronda: { execucao: 95 }, categorias: [cat("joystick", 1, 0, 0, 1)] }).dados.M6;
    expect(r.s).toBe(0);
  });
});

const ROWS = [
  { id: "P601", name: "Golgi Cajamar", score: 72, base: 92, penalidades: [{ label: "2 zona(s) perimetral(is) com problema", val: 10, tipo: "perimetro", qtd: 2 }], ilumDeficientes: 19, ilumTotal: 200, energiaQuedas7d: 0, energiaAberta: false, energiaTemDados: true },
  { id: "P604", name: "Golgi <b>Jundiaí</b>", score: 67, base: 82, penalidades: [], ilumDeficientes: 0, ilumTotal: 0, energiaQuedas7d: 0, energiaAberta: false, energiaTemDados: false, semChecklist: true },
];
const EX = { P601: { ultimo: { pct: 92, total: 182, ok: 166, partial: 1, inop: 15, data: "2026-11-14" }, categorias: [cat("cftv", 71, 65, 0, 6), cat("perimeter", 5, 5, 0, 0)] } };

describe("HTML Visão 360 SIS⁺", () => {
  test("exige grupo (visão Todos é interna)", () => {
    expect(() => montarHTMLSis({ rows: ROWS, grupoLabel: null, agora: AG })).toThrow(/selecione um grupo/);
  });
  test("estrutura: grupo, projetos, réguas, camadas, plano, memória e aviso de provisório", () => {
    const html = montarHTMLSis({ rows: ROWS, grupoLabel: "Golgi", agora: AG, extras: EX });
    expect(html).toContain('id="v-grupo"');
    expect(html).toContain('id="v-projeto-P601"');
    expect(html).toContain('id="v-projeto-P604"');
    expect(html).toContain('data-r="cliente"');
    expect(html).toContain('data-r="moked"');
    expect(html).toContain("Índice provisório");
    expect(html).toContain("Memória de cálculo");
    expect(html).toContain("Por que a meta não é 100%");
    expect(html).toContain("Cenários de equipe");
    expect(html).toContain("Relatórios do projeto");
    expect(html).toContain("Medido pelo app");
    expect(html).toContain("Aguardando validação");
    for (const c of ["P", "A", "I", "M", "H"]) expect(html).toContain(`<span class="cod">${c}</span>`);
  });
  test("projeto sem leitura fica em 50 e o medido sai do 50", () => {
    const ps = avaliarProjetos({ rows: ROWS, extras: EX, agora: AG });
    const sem = ps.find((p) => p.id === "P604"), com = ps.find((p) => p.id === "P601");
    expect(sem.r.geral).toBe(50);
    expect(sem.disp).toBeNull();                                  // sem checklist: nunca vira zero
    expect(com.r.reqs.filter((x) => x.medido).length).toBeGreaterThan(0);
    expect(com.r.reqs.find((x) => x.cod === "M1").s).toBe(0.5);   // 65 de 71 = 91,5%
  });
  test("escapa texto, não fecha o script por dado e não usa emoji", () => {
    const html = montarHTMLSis({ rows: ROWS, grupoLabel: "Golgi <i>x</i>", agora: AG, extras: EX });
    expect(html).not.toContain("<b>Jundiaí</b>");
    expect(html).toContain("&lt;b&gt;Jundiaí&lt;/b&gt;");
    expect(html).not.toContain("<i>x</i>");
    expect((html.match(/<\/script>/g) || []).length).toBe(1);
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
  test("ordena pelo SIS⁺ e funciona com um projeto só", () => {
    const html = montarHTMLSis({ rows: [ROWS[0]], grupoLabel: "Golgi", agora: AG, extras: EX });
    expect(html).toContain("1 projeto");
  });
});
