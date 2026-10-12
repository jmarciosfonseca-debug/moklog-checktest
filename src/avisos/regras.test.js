import { calcularAvisos, idadeTexto, plantoesDoAviso } from "./regras";
import { AVISOS_CFG } from "./config";

const agora = new Date("2026-10-12T10:00:00-03:00"); // P606: diurno desde 07:00; noturno anterior de 11/10
const ATUAL = "P606_2026-10-12_D", ANT = "P606_2026-10-11_N";
const posto = (id, rotulo, pessoaNome, situacao = "presente", detalhe = {}, extra = {}) => ({ id, rotulo, pessoaNome, situacao, detalhe, ...extra });
const enviado = (postos, extra = {}) => ({ status: "enviado", enviadoEm: "2026-10-11T22:10:00.000Z", postos, ...extra });
const ids = (r) => r.avisos.map((a) => a.id);
const calc = (fontes, gerencial = true) => calcularAvisos({ agora, fontes, gerencial });
const calcK = (fontes) => calcularAvisos({ agora, fontes, gerencial: true, cfg: { ...AVISOS_CFG, keyAccess: { ...AVISOS_CFG.keyAccess, ativo: true } } });

test("plantões: atual e anterior do projeto; sem horário = nada", () => {
  const p = plantoesDoAviso("P606", agora);
  expect(p.map((x) => x.chave)).toEqual([ATUAL, ANT, "P606_2026-10-11_D"]);
  expect(plantoesDoAviso("P606", agora, 2)).toHaveLength(2);
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
    posto("t", "Portaria", "Lia", "troca", { noLugarDe: "Rui" }),
    posto("k", "Ronda 2", "Teo", "cobertura", { deQuem: "Gil", base: true }),
  ], { material: { excecoes: [{ nome: "Moto", situacao: "indisponivel", obs: "pneu" }, { nome: "Rádio HT", situacao: "anomalia" }] } });
  const r = calc({ mapas: { P606: { [ATUAL]: mapa, [ANT]: enviado([]) } } });
  const por = (t) => r.avisos.filter((a) => a.tipo === t);
  expect(por("falta").map((a) => a.titulo).sort()).toEqual(["Falta de Carlos", "Falta de Elaine", "Falta de Gil"]); // Gil: coberto pela Base (Teo) = falta
  expect(por("falta").find((a) => a.titulo.includes("Elaine")).detalhe).toContain("coberta por FT de Rosemeire");
  expect(por("falta").find((a) => a.titulo.includes("Carlos")).detalhe).toContain("coberta por FT de Beto");
  expect(por("falta").find((a) => a.titulo.includes("Gil")).detalhe).toContain("coberta pela Base: Teo");
  expect(por("vago")[0].titulo).toContain("Ronda");
  expect(por("atraso")[0]).toMatchObject({ sev: "info" });
  expect(por("atraso")[0].detalhe).toContain("20 min");
  expect(por("material").map((a) => [a.titulo, a.sev])).toEqual([["Moto: indisponível", "atencao"], ["Rádio HT: com anomalia", "info"]]);
  expect(por("ft").map((a) => a.titulo)).toEqual(["FT: Ana"]); // FT sem falta: só informativo (a FT que cobre falta já está na falta)
  expect(por("troca")[0]).toMatchObject({ sev: "info", titulo: "Troca: Lia" });
  expect(por("troca")[0].detalhe).toContain("no lugar de Rui");
  expect(por("cobertura")[0].titulo).toBe("Cobertura (Base): Teo");
  expect(por("cobertura")[0].detalhe).toContain("cobrindo Gil");
  expect(r.contagem.critico).toBe(4);
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

test("KeyAccess vem DESLIGADO por padrão (o botão da Home já mostra); ligado: aberta sem horaFim, ≥ 48 h = crítico, fechada não avisa", () => {
  expect(calc({ keyaccess: { P605: [{ id: "a", data: "2026-10-01", horaInicio: "08:00" }] } }).avisos).toEqual([]);
  const r = calcK({ keyaccess: { P605: [
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
  const man = (status) => ({ id: "m", data: "2026-10-01", status, empresa: "Acme", sistema: "CFTV", servico: "x" });
  const f1 = { ctmk: { P601: { status: "offline", offlineSince: "2026-10-12T05:00:00-03:00" } }, manutencao: { P605: [man("pendente")] }, mapas: { P606: { [ATUAL]: enviado([posto("a", "Apoio", "Zé", "atraso")]), [ANT]: enviado([]) } } };
  expect(calc(f1).avisos.map((a) => a.sev)).toEqual(["critico", "atencao", "info"]);
  const f2 = { ...f1, manutencao: { P605: [man("concluida")] } };
  expect(ids(calc(f2))).not.toContain("manutencao:P605:m");
});

test("dentro da mesma severidade, o que acontece agora (falta) vem antes do crônico (equipamento inoperante há 41 dias)", () => {
  const r = calc({ pendencias: [{ projetoId: "P604", cat: "Câmeras", item: "—", status: "inop", days: 41 }], mapas: { P606: { [ATUAL]: enviado([]), [ANT]: enviado([posto("c", "CCO", "Elaine", "falta")]) } } });
  expect(r.avisos.map((a) => a.tipo)).toEqual(["falta", "inop"]);
});

test("cobre o dia: plantão diurno de ontem sem envio também vira aviso crítico", () => {
  const r = calc({ mapas: { P606: { [ATUAL]: enviado([]), [ANT]: enviado([]), "P606_2026-10-11_D": null } } });
  expect(r.avisos.map((a) => [a.tipo, a.sev, a.id])).toEqual([["mapa", "critico", "mapa:P606:2026-10-11:D"]]);
});

test("teste quinzenal de iluminação: pendente (atenção; ≥ 7 dias crítico), hoje às 21h (info), em dia não avisa", () => {
  const q = [{ nome: "A", total: 10, deficientes: 0 }];
  const r = calc({ iluminacao: {
    P601: { quadrantes: q, testeQuinzenal: { alvo: "2026-10-11" } },
    P602: { quadrantes: q, testeQuinzenal: { alvo: "2026-10-04" } },
    P604: { quadrantes: q, testeQuinzenal: { alvo: "2026-10-12" } },
    P605: { quadrantes: q, testeQuinzenal: { alvo: "2026-10-25" } },
    P606: { quadrantes: [], testeQuinzenal: { alvo: "2026-10-04" } },
  } });
  expect(r.avisos.map((a) => [a.projetoId, a.sev, a.titulo])).toEqual([
    ["P602", "critico", "Teste quinzenal de iluminação pendente"],
    ["P601", "atencao", "Teste quinzenal de iluminação pendente"],
    ["P604", "info", "Teste de iluminação hoje às 21h"],
  ]);
  expect(r.avisos[1].detalhe).toBe("Previsto para domingo 11/10/2026 às 21h");
});

test("férias: saída nos próximos 7 dias (hoje/amanhã = atenção), retorno nos próximos 3; só ativos", () => {
  const f = (colabId, dataInicio, dataRetorno, extra = {}) => ({ colabId, dataInicio, dataRetorno, ...extra });
  const nomes = { c1: "Ana", c2: "Bia", c3: "Caio", c4: "Davi", c6: "Eva", c7: "Gil" };
  const r = calc({ equipes: { P601: { nomes, ferias: [
    f("c1", "2026-10-13", "2026-11-12", { cobertura: "Zé" }), f("c2", "2026-10-18", "2026-11-17"), f("c3", "2026-10-25", "2026-11-24"),
    f("c4", "2026-09-13", "2026-10-13"), f("c5", "2026-10-13", "2026-11-12"), f("c6", "2026-09-20", "2026-10-20"), f("c7", "2026-08-01", "2026-08-31"),
  ] } } });
  expect(r.avisos.map((a) => [a.titulo, a.sev])).toEqual([["Ana sai de férias amanhã", "atencao"], ["Davi volta de férias amanhã", "info"], ["Bia sai de férias em 6 dias", "info"]]);
  expect(r.avisos[0].detalhe).toBe("Retorno previsto 12/11/2026 · cobertura: Zé");
  expect(calc({ equipes: { P601: { nomes, ferias: [f("c1", "2026-10-13", "2026-11-12")] } } }, false).avisos).toEqual([]); // só gerencial
});
