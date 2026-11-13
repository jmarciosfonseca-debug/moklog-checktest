// Painel do projeto — dos documentos para os números da régua, sem nenhum dado pessoal.
import { montarDados, painelDisponivel, DADOS_DEMO } from "./dados";
import { calcularPainel } from "./regua";

const HOJE = "2026-11-12";
const project = { id: "P601", categories: [{ id: "cftv", label: "06 - CFTV", type: "count", total: 10 }, { id: "tq", label: "24 - TORNIQUETES", type: "items", itemLabels: ["T1", "T2"] }] };
const estado = (inop, t2) => ({ cftv: { total: 10, inoperative: inop.map((id) => ({ id })) }, tq: [{ status: "ok" }, { status: t2 }] });
const base = () => ({
  pid: "P601", project, hojeISO: HOJE, agoraMs: Date.parse("2026-11-12T15:00:00Z"),
  history: [{ meta: { date: "2026-10-18" }, state: estado(["CF1"], "ok") }, { meta: { date: "2026-10-25" }, state: estado(["CF1", "CF2"], "ok") }, { meta: { date: "2026-11-08" }, state: estado(["CF1", "CF2"], "partial") }],
  followupsDoc: { registros: [{ key: "06cftv__cf1", entries: [{ em: "2026-11-09T10:00:00Z" }] }] },
  equipeDoc: { colaboradores: [{ id: "a", nome: "Fulano de Tal", telefone: "11999990000", cpfCifrado: "v1:x", status: "ativo", dataContratacao: "2020-01-01", historico: [{ tipo: "Falta", data: "2026-11-02" }, { tipo: "Falta", data: "2026-08-01" }, { tipo: "Treinamento", data: "2026-10-01", detalhe: "Brigada" }] },
    { id: "b", nome: "Beltrano", status: "ativo", dataContratacao: "2021-01-01", historico: [] }], desligados: [] },
  mapas: [{ data: "2026-11-11", turno: "D", status: "enviado" }, { data: "2026-11-11", turno: "N", status: "enviado" }, { data: "2026-11-12", turno: "D", status: "enviado" }, { data: "2026-11-10", turno: "D", status: "rascunho" }, { data: "2026-09-01", turno: "D", status: "enviado" }],
  rondaDoc: { turnos: [{ tipo: "noturno", dataInicio: "2026-11-10", rondas: { 0: { inicio: "18:00" }, 60: { naoExec: true }, 120: { inicio: "20:10", atrasada: true } } }, { tipo: "noturno", dataInicio: "2026-08-01", rondas: { 0: { inicio: "18:00" } } }] },
  keyDoc: { registros: [{ data: "2026-11-01", horaInicio: "08:00" }, { data: "2026-10-01", horaInicio: "08:00", horaFim: "09:00" }] },
  rondasDoc: { plantoes: [{ id: "p1", dataPlantao: "2026-11-11", perimetralResumo: { feito: true, zonas: [{ status: "ok" }, { status: "falha" }] } }] },
  energiaDoc: { eventos: [{ inicioQueda: "2026-11-05T03:00:00Z" }, { inicioQueda: "2026-07-01T03:00:00Z" }] },
  ambulancias: [], sinistroDoc: null, intervaloDoc: { registros: [{ data: "2026-11-11" }, { data: "2026-01-01" }] },
  ctmk: { status: "offline", offlineSince: "2026-11-07T15:00:00Z" },
});

test("monta os números da régua a partir dos documentos do app", () => {
  const d = montarDados(base());
  expect(d.teste).toMatchObject({ total: 12, inop: 2, parcial: 1, diasAtras: 4 });
  expect(d.pendencias.lista.map((x) => [x.item, x.semanas, x.tratativa])).toEqual([["CF1", 3, true], ["CF2", 2, false], ["T2", 1, false]]);
  expect(d.mapa).toEqual({ enviados: 2, esperados: 60 });            // hoje (12/11) ainda não venceu; rascunho e mapa antigo não contam
  expect(d.ronda).toEqual({ aplica: true, slots: 3, executados: 2, atrasados: 1, naoExec: 1 });
  expect(d.equipe).toMatchObject({ ativos: 2, faltas30: 1 }); expect(d.capacitacao).toMatchObject({ ativos: 2 });
  expect(d.sistemas).toEqual({ ctmk: { aplica: true, diasOff: 5 }, key: { aplica: true, abertas: 1 }, perimetro: { aplica: true, zonasRuins: 1 } });
  expect(d.eventos).toEqual({ energia: { usa: true, n30: 1 }, ambulancia: { usa: false, n30: 0, graves30: 0 }, sinistro: { registrado: false, em30: false } });
  expect(d.intervalos).toEqual({ registros30: 1 });
  const r = calcularPainel(d);
  expect(r.travas.map((t) => t.id)).toEqual(["ctmk", "perimetro"]);
  expect(JSON.stringify([d, r])).not.toMatch(/Fulano|Beltrano|11999990000|v1:x/); // nenhum dado pessoal chega à tela
});

test("projeto sem nada cadastrado não quebra: tudo vira nota neutra ou não se aplica", () => {
  const d = montarDados({ pid: "P605", project: { id: "P605", categories: [] }, hojeISO: HOJE, agoraMs: Date.now() });
  expect(d.teste).toBeNull(); expect(d.mapa).toBeNull(); expect(d.ronda.aplica).toBe(false);
  const r = calcularPainel(d); expect(typeof r.nota).toBe("number"); expect(r.faixa).toBe("Crítico");
});

test("sinistro e ambulância: evento do mês conta, antigo não", () => {
  const b = base(); b.sinistroDoc = { houve: true, dataOcorrido: "2026-11-01" }; b.ambulancias = [{ data: "2026-11-03", gravidade: "Grave" }, { data: "2026-11-04", gravidade: "Leve" }, { data: "2026-02-01", gravidade: "Grave" }];
  const d = montarDados(b);
  expect(d.eventos.sinistro).toEqual({ registrado: true, em30: true }); expect(d.eventos.ambulancia).toEqual({ usa: true, n30: 2, graves30: 1 });
  b.sinistroDoc = { houve: true, dataOcorrido: "2026-06-01" }; expect(montarDados(b).eventos.sinistro.em30).toBe(false);
  b.sinistroDoc = { houve: false, semSinistroFaixa: "12m" }; expect(montarDados(b).eventos.sinistro).toEqual({ registrado: true, em30: false });
});

test("quem recebe nota nesta versão: MokLog, menos P260B e P260C; exemplo do modo demo calcula", () => {
  expect(["P601", "P311A", "P505", "P260A"].every(painelDisponivel)).toBe(true);
  expect(["P260B", "P260C", "P939", "P703"].some(painelDisponivel)).toBe(false);
  expect(calcularPainel(DADOS_DEMO)).toMatchObject({ nota: 90, faixa: "Alerta" });
});
