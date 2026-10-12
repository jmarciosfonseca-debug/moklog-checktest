import { calcularAvisos, idadeTexto, plantoesDoAviso } from "./regras";

const agora = new Date("2026-10-12T10:00:00-03:00"); // P606: diurno desde 07:00; noturno anterior de 11/10
const ATUAL = "P606_2026-10-12_D", ANT = "P606_2026-10-11_N";
const posto = (id, rotulo, pessoaNome, situacao = "presente", detalhe = {}, extra = {}) => ({ id, rotulo, pessoaNome, situacao, detalhe, ...extra });
const enviado = (postos, extra = {}) => ({ status: "enviado", enviadoEm: "2026-10-11T22:10:00.000Z", postos, ...extra });
const ids = (r) => r.avisos.map((a) => a.id);
const calc = (fontes, gerencial = true) => calcularAvisos({ agora, fontes, gerencial });

test("plantões: atual e anterior do projeto; sem horário = nada", () => {
  const p = plantoesDoAviso("P606", agora);
  expect(p.map((x) => x.chave)).toEqual([ATUAL, ANT]);
  expect(plantoesDoAviso("XXX", agora)).toEqual([]);
});

test("idade em texto", () => {
  const t = (ms) => idadeTexto(new Date(agora.getTime() - ms), agora);
  expect(t(60000)).toBe("agora há pouco");
  expect(t(25 * 60000)).toBe("há 25 min");
  expect(t(5 * 3600000)).toBe("há 5 h");
  expect(t(86400000)).toBe("há 1 dia");
  expect(t(3 * 86400000)).toBe("há 3 dias");
  expect(idadeTexto(null, agora)).toBe("");
});

test("mapa: plantão atual passou da janela sem envio = atenção; anterior sem envio = crítico; enviado não avisa", () => {
  const r = calc({ mapas: { P606: { [ATUAL]: null, [ANT]: null } } });
  expect(r.avisos.map((a) => [a.tipo, a.sev])).toEqual([["mapa", "critico"], ["mapa", "atencao"]]);
  expect(r.avisos[1].detalhe).toContain("Ainda não foi aberto");
  const ok = calc({ mapas: { P606: { [ATUAL]: enviado([]), [ANT]: enviado([]) } } });
  expect(ok.avisos).toEqual([]);
  const rasc = calc({ mapas: { P606: { [ATUAL]: { status: "rascunho", postos: [] }, [ANT]: enviado([]) } } });
  expect(rasc.avisos[0].detalhe).toContain("rascunho");
});

test("mapa ainda não lido (undefined) não gera aviso", () => {
  expect(calc({ mapas: { P606: {} } }).avisos).toEqual([]);
  expect(calc({}).avisos).toEqual([]);
});

test("falta coberta por FT, falta só na FT, posto vago, atraso e material", () => {
  const mapa = enviado([
    posto("c", "CCO", "Elaine", "falta", { porFtDe: "f" }),
    posto("f", "Posto extra", "Rosemeire", "ft", { quemFaltou: "Elaine" }),
    posto("g", "Portaria", "Beto", "ft", { quemFaltou: "Carlos", quemFaltouId: "c9" }),
    posto("v", "Ronda", "", "vago"),
    posto("a", "Apoio", "Zé", "atraso", { minutos: 20 }),
    posto("h", "Hum", "Ana", "ft", { semFalta: true }),
  ], { material: { excecoes: [{ nome: "Moto", situacao: "indisponivel", obs: "pneu" }, { nome: "Rádio HT", situacao: "anomalia" }] } });
  const r = calc({ mapas: { P606: { [ATUAL]: mapa, [ANT]: enviado([]) } } });
  const por = (t) => r.avisos.filter((a) => a.tipo === t);
  expect(por("falta").map((a) => a.titulo).sort()).toEqual(["Falta de Carlos", "Falta de Elaine"]);
  expect(por("falta").find((a) => a.titulo.includes("Elaine")).detalhe).toContain("coberta por FT de Rosemeire");
  expect(por("falta").find((a) => a.titulo.includes("Carlos")).detalhe).toContain("coberta por FT de Beto");
  expect(por("vago")[0].titulo).toContain("Ronda");
  expect(por("atraso")[0]).toMatchObject({ sev: "info" });
  expect(por("atraso")[0].detalhe).toContain("20 min");
  expect(por("material").map((a) => [a.titulo, a.sev])).toEqual([["Moto: indisponível", "atencao"], ["Rádio HT: com anomalia", "info"]]);
  expect(r.avisos.some((a) => a.titulo.includes("Ana"))).toBe(false); // FT sem falta não é aviso
  expect(r.contagem.critico).toBe(3);
});

test("a falta da FT não duplica quando o posto de falta já existe (por id, nome ou posto)", () => {
  const mapa = enviado([posto("c", "CCO", "Elaine", "falta"), posto("f", "Extra", "Rosemeire", "ft", { quemFaltou: "elaine" })]);
  const r = calc({ mapas: { P606: { [ATUAL]: mapa, [ANT]: enviado([]) } } });
  expect(r.avisos.filter((a) => a.tipo === "falta")).toHaveLength(1);
});

test("perfil não gerencial não vê aviso de pessoa/supervisão/mapa", () => {
  const mapa = enviado([posto("c", "CCO", "Elaine", "falta")]);
  const fontes = { mapas: { P606: { [ATUAL]: mapa, [ANT]: null } }, supervisao: { P606: [{ data: "2026-08-01" }] }, ctmk: { P601: { status: "offline", offlineSince: "2026-10-09T10:00:00-03:00" } } };
  expect(calc(fontes, true).avisos.map((a) => a.tipo).sort()).toEqual(["ctmk", "falta", "mapa", "supervisao"]);
  expect(calc(fontes, false).avisos.map((a) => a.tipo)).toEqual(["ctmk"]);
});

test("KeyAccess: aberta sem horaFim; ≥ 48 h = crítico; fechada não avisa", () => {
  const r = calc({ keyaccess: { P605: [
    { id: "a", data: "2026-10-12", horaInicio: "08:00", tipos: ["catraca"] },
    { id: "b", data: "2026-10-09", hora: "09:00" },
    { id: "c", data: "2026-10-12", horaInicio: "08:00", horaFim: "09:00" },
  ] } });
  expect(r.avisos.map((a) => [a.id, a.sev])).toEqual([["keyaccess:P605:b", "critico"], ["keyaccess:P605:a", "atencao"]]);
  expect(r.avisos[0].idade).toBe("há 3 dias");
});

test("CTMK off-line: atenção e crítico depois de 3 dias; online não avisa", () => {
  const r = calc({ ctmk: { P601: { status: "offline", offlineSince: "2026-10-12T05:00:00-03:00" }, P602: { status: "offline", offlineSince: "2026-10-08T05:00:00-03:00" }, P604: { status: "online" } } });
  expect(r.avisos.map((a) => [a.projetoId, a.sev])).toEqual([["P602", "critico"], ["P601", "atencao"]]);
});

test("energia: só queda aberta (não diesel avulso, não concluída); ≥ 4 h crítico", () => {
  const r = calc({ energia: { P601: [
    { id: "1", inicioQueda: "2026-10-12T08:00:00-03:00", concluido: false },
    { id: "2", inicioQueda: "2026-10-12T01:00:00-03:00", concluido: true },
    { id: "3", inicioQueda: "2026-10-12T01:00:00-03:00", concluido: false, tipoRegistro: "diesel_avulso" },
  ], P602: [{ id: "4", inicioQueda: "2026-10-12T04:00:00-03:00", concluido: false }] } });
  expect(r.avisos.map((a) => [a.projetoId, a.sev])).toEqual([["P602", "critico"], ["P601", "atencao"]]);
});

test("manutenção: pendente/parcial só depois de 3 dias; ≥ 7 crítico; concluída e arquivada não", () => {
  const m = (id, data, status, extra = {}) => ({ id, data, status, empresa: "Acme", sistema: "CFTV", servico: "Trocar DVR", ...extra });
  const r = calc({ manutencao: { P601: [m("a", "2026-10-11", "pendente"), m("b", "2026-10-08", "parcial"), m("c", "2026-10-01", "pendente"), m("d", "2026-10-01", "concluida"), m("e", "2026-10-01", "pendente", { arquivado: true })] } });
  expect(r.avisos.map((a) => [a.id, a.sev])).toEqual([["manutencao:P601:c", "critico"], ["manutencao:P601:b", "atencao"]]);
  expect(r.avisos[0].titulo).toContain("Manutenção pendente: CFTV");
});

test("equipamento inoperante: um aviso por planta, com o mais antigo; parcial não entra", () => {
  const p = (projetoId, cat, item, status, days) => ({ projetoId, cat, item, status, days });
  const r = calc({ pendencias: [p("P605", "Câmeras", "Cam 3", "inop", 41), p("P605", "Rádio", "—", "inop", 3), p("P605", "Alarme", "—", "inop", 1), p("P605", "Cerca", "—", "partial", 90), p("P601", "Portão", "—", "inop", 5)] });
  expect(r.avisos.map((a) => [a.id, a.sev, a.titulo])).toEqual([["inop:P605", "critico", "3 equipamentos inoperantes"], ["inop:P601", "atencao", "1 equipamento inoperante"]]);
  expect(r.avisos[0].detalhe).toBe("Câmeras — Cam 3 (41 d); Rádio (3 d) e mais 1");
});

test("relatório semanal atrasado, supervisão, iluminação e bolsão", () => {
  const r = calc({
    ultimoRelatorio: { P601: "2026-10-10", P602: "2026-10-02", P604: "2026-09-20", P605: null },
    supervisao: { P601: [{ data: "2026-10-01" }, { data: "2026-09-01" }], P602: [{ data: "2026-08-20" }], P604: [], P605: [{ data: "2026-08-01", rascunho: true }] },
    iluminacao: { P601: [{ deficientes: 2 }, { deficientes: 1 }], P602: [{ deficientes: 0 }] },
    bolsao: { P311A: { x: { status: "critico" }, y: { status: "ok" } } },
  });
  const t = (tipo) => r.avisos.filter((a) => a.tipo === tipo).map((a) => [a.projetoId, a.sev]);
  expect(t("relatorio")).toEqual([["P604", "critico"], ["P602", "atencao"]]);
  expect(t("supervisao")).toEqual([["P602", "critico"]]);
  expect(r.avisos.find((a) => a.id === "iluminacao:P601").titulo).toBe("3 pontos de iluminação deficientes");
  expect(t("iluminacao")).toEqual([["P601", "atencao"]]);
  expect(t("bolsao")).toEqual([["P311A", "atencao"]]);
});

test("problema resolvido some no recálculo; ordem: crítico, atenção, info; mais antigo primeiro", () => {
  const f1 = { ctmk: { P601: { status: "offline", offlineSince: "2026-10-12T05:00:00-03:00" } }, keyaccess: { P605: [{ id: "a", data: "2026-10-09", horaInicio: "08:00" }] }, mapas: { P606: { [ATUAL]: enviado([posto("a", "Apoio", "Zé", "atraso")]), [ANT]: enviado([]) } } };
  expect(calc(f1).avisos.map((a) => a.sev)).toEqual(["critico", "atencao", "info"]);
  const f2 = { ...f1, keyaccess: { P605: [{ id: "a", data: "2026-10-09", horaInicio: "08:00", horaFim: "10:00" }] } };
  expect(ids(calc(f2))).not.toContain("keyaccess:P605:a");
});

test("dentro da mesma severidade, o que acontece agora (falta) vem antes do crônico (equipamento inoperante há 41 dias)", () => {
  const r = calc({ pendencias: [{ projetoId: "P604", cat: "Câmeras", item: "—", status: "inop", days: 41 }], mapas: { P606: { [ATUAL]: enviado([]), [ANT]: enviado([posto("c", "CCO", "Elaine", "falta")]) } } });
  expect(r.avisos.map((a) => a.tipo)).toEqual(["falta", "inop"]);
});
