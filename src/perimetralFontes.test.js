import { normalizarZona, resumirColecaoPerimetral, escolherFontePerimetral, MOTIVO_SEM_HISTORICO } from "./perimetralFontes";
import { vetoresPerimetraisParaTeste } from "./AnaliseRisco";

const testes = [
  { data: "2026-10-08", turno: "Diurno", zonas: { "Zona 01": { status: "ok" }, "Zona 02": { status: "ok" } } },
  { data: "2026-10-10", turno: "Noturno", zonas: { "Zona 01": { status: "ok" }, "Zona 02": { status: "inop" }, "Zona 03": { status: "parcial" } } },
];

test("coleção: usa o teste mais recente e dá identidade canônica a cada zona", () => {
  const r = resumirColecaoPerimetral(testes, (d) => `fmt:${d}`);
  expect(r.ok).toBe(true);
  expect(r.fonte).toBe("colecao");
  expect(r.dataUltISO).toBe("2026-10-10");
  expect(r.dataUlt).toBe("fmt:2026-10-10");
  expect(r.zonas.map((z) => z.zonaCanonica)).toEqual(["Z-01", "Z-02", "Z-03"]);
  expect(r.zonas.map((z) => z.ruins)).toEqual([0, 1, 1]);
  expect(r.pctOk).toBe(33);
  expect(r.totalTestes).toBe(2);
});

test("coleção: sem testes ou sem zonas = sem dado (não erro)", () => {
  expect(resumirColecaoPerimetral([]).temDado).toBe(false);
  expect(resumirColecaoPerimetral([{ data: "2026-10-10", zonas: {} }]).temDado).toBe(false);
});

const rondasOk = { ok: true, temDado: true, fonte: "rondas", dataUltimaRonda: "2026-10-09T08:00:00", zonas: [] };
const colOk = { ok: true, temDado: true, fonte: "colecao", dataUltISO: "2026-10-10", zonas: [] };
const vazio = { ok: false, temDado: false, motivo: "sem dados perimetrais" };

test("só ronda → ronda; só coleção → coleção (qualquer projeto)", () => {
  expect(escolherFontePerimetral(rondasOk, vazio).fonte).toBe("rondas");
  expect(escolherFontePerimetral(vazio, colOk).fonte).toBe("colecao");
  expect(escolherFontePerimetral(vazio, colOk).fontesLidas).toEqual(["colecao"]);
});

test("as duas com dado → a mais recente; empate → ronda", () => {
  expect(escolherFontePerimetral(rondasOk, colOk).fonte).toBe("colecao");
  expect(escolherFontePerimetral({ ...rondasOk, dataUltimaRonda: "2026-10-11T07:00" }, colOk).fonte).toBe("rondas");
  expect(escolherFontePerimetral({ ...rondasOk, dataUltimaRonda: "2026-10-10T07:00" }, colOk).fonte).toBe("rondas");
});

test("nenhuma com histórico → desconsiderada, com motivo claro", () => {
  const r = escolherFontePerimetral(vazio, vazio);
  expect(r.ok).toBe(false);
  expect(r.semHistorico).toBe(true);
  expect(r.motivo).toBe(MOTIVO_SEM_HISTORICO);
});

test("erro de leitura nunca vira 'sem histórico'", () => {
  const r = escolherFontePerimetral({ ok: false, temDado: false, erro: true, motivo: "erro" }, vazio);
  expect(r.erro).toBe(true);
  expect(r.semHistorico).toBeUndefined();
  expect(r.motivo).toMatch(/erro/i);
});

test("erro numa origem, dado na outra → usa o dado", () => {
  expect(escolherFontePerimetral({ ok: false, erro: true }, colOk).fonte).toBe("colecao");
});

test("histórico antigo sem resumo não é 'sem histórico'", () => {
  const r = escolherFontePerimetral({ ok: false, temDado: false, historicoSemResumo: 5, motivo: "Ronda Perimetral não avaliada neste ciclo — histórico ainda não consolidado" }, vazio);
  expect(r.semHistorico).toBeUndefined();
  expect(r.historicoSemResumo).toBe(5);
});

test("normalizarZona continua igual", () => {
  expect(normalizarZona("Zona 4")).toBe("Z-04");
  expect(normalizarZona("z-12")).toBe("Z-12");
});

test("vetores: cada zona ruim da coleção vira um vetor com chave própria (P311A/P505)", () => {
  const peri = resumirColecaoPerimetral(testes, (d) => d);
  const v = vetoresPerimetraisParaTeste(peri);
  expect(v.map((x) => x.chave)).toEqual(["perimetral:Z-02", "perimetral:Z-03"]);
  expect(new Set(v.map((x) => x.zonaCanonica)).size).toBe(2);
});

// Turno automático do Teste Perimetral (Marcio, 02/11/2026)
test("turno do teste perimetral vem da hora: 18h–5h59 Noturno, 6h–17h59 Diurno", () => {
  const { turnoPorHora } = require("./Perimetral");
  const em = (h) => new Date(Date.UTC(2026, 10, 2, h + 3, 0)); // UTC-3
  expect(turnoPorHora(em(5))).toBe("Noturno");
  expect(turnoPorHora(em(6))).toBe("Diurno");
  expect(turnoPorHora(em(17))).toBe("Diurno");
  expect(turnoPorHora(em(18))).toBe("Noturno");
  expect(turnoPorHora(em(23))).toBe("Noturno");
});

test("turnoPorHora aceita HH:MM e o formulário não tem mais botão de escolher turno", () => {
  const { turnoPorHora } = require("./Perimetral");
  expect(turnoPorHora("18:20")).toBe("Noturno"); expect(turnoPorHora("05:59")).toBe("Noturno"); expect(turnoPorHora("06:00")).toBe("Diurno"); expect(turnoPorHora("17:59")).toBe("Diurno");
  const src = require("fs").readFileSync(require("path").join(__dirname, "Perimetral.jsx"), "utf8");
  expect(src).not.toMatch(/\["Diurno","Noturno"\]\.map\(t=>\(\s*<button/);
  expect(src).toMatch(/Editar teste \(data, hora, zonas\)/);
  expect(src).toMatch(/turno:turnoPorHora\(form\.hora\|\|nowTime\(\)\)/);
});

test("gerencial pode registrar Teste do consultor (Moked) no perimetral", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "Perimetral.jsx"), "utf8");
  expect(src).toMatch(/Teste do consultor \(Moked\)/);
  expect(src).toMatch(/\["Marcio Fonseca","Christian Lopes"\]/);
  expect(src).toMatch(/teste\.consultor\?" · <b>Consultor Moked<\/b>":""/);
});
