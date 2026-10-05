// Regressões da auditoria de 04/10/2026 (caso P607): reconciliação de zonas, parcial explícito e paginação.
import { gerarImpactosOperacionais } from "./riscoImpactoConfig";
import { gerarHTMLAnaliseRisco, vetoresDoTesteSemanal } from "./AnaliseRisco";

const zona = (n, extra = {}) => ({ chave: `cat:01 - ALARME PERIMETRAL:zona-0${n}`, label: "01 - ALARME PERIMETRAL", nivel: 4, bloqueadorCaido: true,
  inop: 1, total: 4, zonaCanonica: `zona-0${n}`, barreiraFisica: "perimetro", fonteCredito: "Teste Semanal", descricao: `Zona 0${n}`, ...extra });
const semZona = { chave: "ronda:sem-cadastro", label: "Perímetro eletrônico — ponto sem cadastro", nivel: 4, bloqueadorCaido: true, inop: 1, total: 4,
  zonaCanonica: "perimetro-sem-cadastro", pendenciaCadastro: true, barreiraFisica: "perimetro", fonteCredito: "Ronda Perimetral" };
const geral = { label: "CRÍTICO", nivel: 4, nBloqueadores: 4, motivoMatriz: "duas ou mais zonas perimetrais inoperantes", metricas: { zonasNomeadas: 3 } };

test("P607: 3 zonas nomeadas + 1 ponto da ronda sem zona → matriz diz 3 de 4 e mostra o ponto à parte (não 4 de 4)", () => {
  const cards = gerarImpactosOperacionais({ vetores: [zona(1), zona(2), zona(3, { parciais: 1 }), semZona], geral });
  const per = cards.find((c) => c.familia === "PERIMETRO");
  expect(per.medida).toMatch(/^3 de 4 indisponíveis/);
  expect(per.medida).toContain("75%");
  expect(per.medida).toContain("mais 1 ponto(s) da ronda sem identificação de zona");
  expect(per.medida).toContain("inclui 1 parcial(is), tratado(s) como indisponível(is)");
  expect(per.medida).not.toMatch(/4 de 4/);
});

test("sem ponto sem zona, a medida bate com a memória", () => {
  const cards = gerarImpactosOperacionais({ vetores: [zona(1), zona(2), zona(3)], geral });
  expect(cards.find((c) => c.familia === "PERIMETRO").medida).toBe("3 de 4 indisponíveis · 75%");
});

test("zona parcial: vetor diz 'parcial', marca parciais e a memória declara o critério conservador", () => {
  const ts = { ok: true, pid: "P607", catAgg: { "01 - ALARME PERIMETRAL": { total: 4, inop: 3, piorDias: 40 } }, pend: [
    { catId: "perimeter", catLabel: "01 - ALARME PERIMETRAL", itemLabel: "Zona 01", status: "INOPERANTE", dias: 40, since: "2026-08-25" },
    { catId: "perimeter", catLabel: "01 - ALARME PERIMETRAL", itemLabel: "Zona 02", status: "INOPERANTE", dias: 20, since: "2026-09-14" },
    { catId: "perimeter", catLabel: "01 - ALARME PERIMETRAL", itemLabel: "Zona 03", status: "PARCIAL", dias: 10, since: "2026-09-24" } ] };
  const vs = vetoresDoTesteSemanal(ts, "04/10/2026");
  const z3 = vs.find((v) => /zona-03/.test(v.zonaCanonica || ""));
  expect(z3.sinceTxt).toMatch(/^parcial desde/); expect(z3.parciais).toBe(1); expect(z3.inop).toBe(1);   // continua indisponível para o risco
  const html = gerarHTMLAnaliseRisco({ project: { id: "P607", name: "Golgi Santa Maria" }, pacoteLabel: "Golgi", vetores: vs,
    geral: { ...geral, metricas: { zonasNomeadas: 3 } }, fontesUsadas: [], ts: { ok: false }, ctmk: null, regional: { ok: false }, contextos: {} });
  expect(html).toContain("item(ns) parcial(is) contado(s) como indisponível(is) — critério conservador do motor");
  expect(html).toContain("3 de 4 indisponíveis");
});

test("paginação recorrente: rodapé com nº do documento e 'pág. X de Y'", () => {
  const html = gerarHTMLAnaliseRisco({ project: { id: "P607", name: "Golgi Santa Maria" }, pacoteLabel: "Golgi", vetores: [zona(1)], geral,
    fontesUsadas: [], ts: { ok: false }, ctmk: null, regional: { ok: false }, contextos: {}, ref: "MK-607-AR-0001" });
  expect(html).toContain('@bottom-left{content:"MK-P607-AR-0001 · Análise de Risco · P607 Golgi Santa Maria');
  expect(html).toContain('content:"pág. " counter(page) " de " counter(pages)');
});
