import { itensDoEstado, resumo, porCategoria, falhasPorSistema, classificar, estadoTratativa } from "./metricas";
import { PROJ, SEMANAS } from "./fixtureP605";
import { montarConsolidado, generatePDF } from "../generatePDF";
import { canonicalFollowupKey } from "../followups";
const HOJE = "2026-10-04T15:00:00";
const ULT = SEMANAS[2].state;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("métricas únicas", () => {
  test("CFTV entra câmera a câmera pela lista 'inoperative' (antes as câmeras paradas sumiam)", () => {
    const r = resumo(itensDoEstado(PROJ, ULT));
    expect(r).toMatchObject({ total: 61, ok: 56, parcial: 2, inop: 3 });
    expect(r.saude).toBeCloseTo((56 + 0.5 * 2) / 61 * 100, 6);
  });
  test("categorias: parcial conta como meio (Pânico fixo parcial = 50%, não 0%)", () => {
    const c = Object.fromEntries(porCategoria(itensDoEstado(PROJ, ULT)).map(x => [x.cat, x]));
    expect(Math.round(c["20 - PÂNICO FIXO"].saude)).toBe(50);
    expect(c["06 - CFTV"]).toMatchObject({ total: 54, ok: 52, inop: 2 });
    expect(c["Observações"]).toBeUndefined();
  });
  test("falhas por sistema, maior primeiro", () => {
    expect(falhasPorSistema(itensDoEstado(PROJ, ULT)).map(f => [f.cat, f.inop, f.parcial])).toEqual([
      ["06 - CFTV", 2, 0], ["01 - ALARME PERIMETRAL", 1, 0], ["20 - PÂNICO FIXO", 0, 1], ["23 - TELEFONES", 0, 1]]);
  });
  test("situação no período", () => {
    expect(classificar(["ok", "ok", "ok"])).toBeNull();
    expect(classificar(["inop", "partial", "ok"])).toBe("Resolvida");
    expect(classificar(["inop", "inop", "inop"])).toBe("Persistente");
    expect(classificar(["inop", "ok", "inop"])).toBe("Reincidente");
    expect(classificar(["ok", "ok", "partial"])).toBe("Nova");
    expect(classificar([null, "inop", "inop"])).toBe("Persistente");
  });
  test("tratativa: sem / vencida (> 15 dias) / em dia", () => {
    const hoje = new Date(HOJE);
    expect(estadoTratativa(null, hoje).estado).toBe("sem");
    expect(estadoTratativa({ resolvido: true, entries: [{ em: "2026-10-01" }] }, hoje).estado).toBe("sem");
    expect(estadoTratativa({ entries: [{ status: "proposta", em: "2026-09-08T12:00:00Z" }] }, hoje)).toMatchObject({ estado: "vencido", status: "proposta" });
    expect(estadoTratativa({ entries: [{ status: "aguardando", em: "2026-10-01T12:00:00Z" }] }, hoje).estado).toBe("emdia");
  });
});

describe("consolidado novo", () => {
  const followups = {
    [canonicalFollowupKey("P605", "06 - CFTV", "CF 05")]: { statusAtual: "aguardando", entries: [{ status: "aguardando", em: "2026-09-07T12:00:00Z" }] },
    [canonicalFollowupKey("P605", "23 - TELEFONES", "CCO Emergencial")]: { statusAtual: "execucao", entries: [{ status: "execucao", em: "2026-10-01T12:00:00Z" }] },
  };
  const C = montarConsolidado(PROJ, SEMANAS, { followups, hoje: HOJE });
  const I = montarConsolidado(PROJ, SEMANAS, { followups, hoje: HOJE, interno: true });
  test("saúde semanal com a mesma fórmula do laudo", () => {
    const esperado = SEMANAS.map(s => resumo(itensDoEstado(PROJ, s.state)).saude);
    expect(C.series).toEqual(esperado);
    expect(C.html).toContain(`${(Math.round(esperado[2] * 10) / 10).toFixed(1).replace(".", ",")}%`);
  });
  test("pendências da última semana, por tempo em aberto, com situação e tratativa", () => {
    expect(C.pend.map(p => [p.item, p.sit, p.t.estado])).toEqual([
      ["CF 05", "Persistente", "vencido"], ["CCO Emergencial", "Persistente", "emdia"], ["MD 05", "Nova", "sem"],
      ["20 - PÂNICO FIXO", "Nova", "sem"], ["Zona 04", "Nova", "sem"]]);
    expect(C.html).toContain("1 de 5"); expect(C.html).toContain("com tratativa em dia");
    expect(C.html).toContain("Sem tratativa"); expect(C.html).toContain("follow-up vencido");
  });
  test("matriz só com itens que tiveram ocorrência; demais viram uma linha", () => {
    expect(C.linhasMat.map(l => [l.item, l.sit]).sort()).toEqual([["20 - PÂNICO FIXO", "Nova"], ["CCO Emergencial", "Persistente"], ["CF 05", "Persistente"], ["MD 05", "Nova"], ["Zona 03", "Resolvida"], ["Zona 04", "Nova"]]);
    expect(C.nOk).toBe(55);
    expect(C.html).toContain("55 dispositivos operacionais em todas as 3 semanas");
    expect(C.resolvidas.map(r => [r.item, r.quando])).toEqual([["Zona 03", "S1 Out"]]);
  });
  test("conferência automática SÓ na versão interna", () => {
    expect(I.html).toContain("VERSÃO INTERNA"); expect(I.html).toContain("Conferência automática");
    expect(I.html).toMatch(/MD 05.*20 - PÂNICO FIXO|20 - PÂNICO FIXO.*MD 05/s);
    expect(C.html).not.toContain("VERSÃO INTERNA"); expect(C.html).not.toContain("Conferência automática");
  });
  test("sem emojis, texto do usuário escapado, nº do documento", () => {
    expect(C.html).not.toMatch(EMOJI);
    const s = JSON.parse(JSON.stringify(SEMANAS)); s[2].state.alarme[3].note = "<script>x</script>";
    expect(montarConsolidado(PROJ, s, { hoje: HOJE }).html).not.toContain("<script>x</script>");
    expect(C.docNum).toBe("MK-P605-RC-1004");
  });
});

describe("laudo semanal", () => {
  let html;
  beforeAll(async () => {
    const origBlob = global.Blob;
    global.Blob = class { constructor(p) { html = p.join(""); } };
    global.URL.createObjectURL = jest.fn(() => "blob:x"); global.URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    window.open = jest.fn(() => null);   // sem aba no jsdom → cai no download (Blob capturado acima)
    await generatePDF(PROJ, ULT, SEMANAS[2].meta, [], null, null, null, {});
    global.Blob = origBlob;
  });
  test("padrão Moked: cabeçalho, nº do documento e assinatura", () => {
    expect(html).toContain('class="mk-regua"'); expect(html).toContain("Nº MK-P605-RS-1004"); expect(html).toContain("José Fonseca");
    expect(html).not.toMatch(EMOJI);
  });
  test("rosca com o total de ativos e 'Onde estão as falhas' (sistemas com falha primeiro)", () => {
    expect(html).toContain("Visão geral dos ativos"); expect(html).toContain("Onde estão as falhas");
    expect(html).toMatch(/aria-label="61 ativos: 56 operacionais, 2 parciais, 3 inoperantes"/);
    expect(html.indexOf("<b>06 - CFTV</b>")).toBeLessThan(html.indexOf("<b>01 - ALARME PERIMETRAL</b>"));
  });
  test("saúde do laudo = saúde da mesma semana no consolidado (mesma base e fórmula)", () => {
    const saudeCons = Math.round(montarConsolidado(PROJ, SEMANAS, { hoje: HOJE }).series[2]);
    const m = html.match(/class="mk-big[^"]*">(\d+),(\d)%<\/div>/);
    expect(Math.round(Number(`${m[1]}.${m[2]}`))).toBe(saudeCons); expect(saudeCons).toBe(93);     // antes: 95%, com as câmeras paradas ignoradas
  });
  test("Pânico fixo parcial aparece como 50%, não 0%", () => {
    expect(html).toMatch(/<b>20 - PÂNICO FIXO<\/b><\/td><td class="mk-num">0\/1<\/td>[\s\S]{0,900}?mk-b-da">50,0%/);
  });
  test("pendências por tempo em aberto, com 'desde' e status", () => {
    expect(html.indexOf("<b>CF 05</b>")).toBeLessThan(html.indexOf("<b>CCO Emergencial</b>"));
    expect(html).toMatch(/desde 26\/12\/2025/); expect(html).toContain("Sem tratativa");
  });
});
