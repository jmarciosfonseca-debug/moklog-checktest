import { montarHTMLExecutivo, montarProjetos, MODULOS_FUTUROS } from "./executivoRelatorio";
const AG = new Date("2026-10-05T22:30:00");
const ROWS = [
  { id: "P601", name: "Golgi Cajamar", score: 72, base: 92, penalidades: [{ label: "2 falha(s) KeyAccess aberta(s)", val: 10 }, { label: "Ronda VSPP 54% no último dia", val: 10 }], ilumDeficientes: 6, ilumTotal: 120, energiaQuedas7d: 1, energiaAberta: false },
  { id: "P605", name: "Golgi Dutra", score: 82, base: 92, penalidades: [{ label: "2 falha(s) KeyAccess aberta(s)", val: 10 }], ilumDeficientes: 19, ilumTotal: 200, energiaQuedas7d: 0, energiaAberta: false },
  { id: "P604", name: "Golgi <b>Jundiaí</b>", score: 67, base: 82, penalidades: [], ilumDeficientes: 0, ilumTotal: 0, energiaQuedas7d: 0, energiaAberta: false, semChecklist: true },
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
  expect(p601.cards.map((c) => c.titulo)).toEqual(["Checklist semanal", "KeyAccess", "Ronda VSPP", "Energia", "Iluminação"]);
  expect(p601.cards[0].texto).toContain("182 pontos · 15 inoperantes · 1 parciais · checklist de 04/10/2026");
  expect(p601.cards.find((c) => c.titulo === "KeyAccess").valor).toBe("2 abertas");
  expect(p601.cards.find((c) => c.titulo === "KeyAccess").efeito).toBe("−10 na pontuação");
  expect(p601.cards.find((c) => c.titulo === "Ronda VSPP").valor).toBe("54%");
  const p604 = ps.find((p) => p.id === "P604");
  expect(p604.cards[0].valor).toBe("—");                                   // sem checklist: nunca vira zero
  expect(p604.cards.map((c) => c.titulo)).not.toContain("Iluminação");     // sem dado de iluminação: cartão omitido
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
