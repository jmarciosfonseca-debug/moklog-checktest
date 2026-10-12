import { calcularAvisos, idadeTexto, plantoesDoAviso } from "./regras";
import { AVISOS_CFG } from "./config";

const agora = new Date("2026-10-12T10:00:00-03:00"); // P606: diurno desde 07:00; noturno anterior de 11/10
const ATUAL = "P606_2026-10-12_D", ANT = "P606_2026-10-11_N";
const posto = (id, rotulo, pessoaNome, situacao = "presente", detalhe = {}, extra = {}) => ({ id, rotulo, pessoaNome, situacao, detalhe, ...extra });
const enviado = (postos, extra = {}) => ({ status: "enviado", enviadoEm: "2026-10-11T22:10:00.000Z", postos, ...extra });
const ids = (r) => r.avisos.map((a) => a.id);
const calc = (fontes, gerencial = true) => calcularAvisos({ agora, fontes, gerencial });
const calcK = (fontes) => calcularAvisos({ agora, fontes, gerencial: true, cfg: { ...AVISOS_CFG, keyAccess: { ...AVISOS_CFG.keyAccess, ativo: true } } });

test("plantões: só os que começaram há ≤ 24 h (atual sempre entra); sem horário = nada", () => {
  const p = plantoesDoAviso("P606", agora); // diurno de ontem começou às 07:00 de 11/10 = 27 h atrás: fora
  expect(p.map((x) => x.chave)).toEqual([ATUAL, ANT]);
  expect(plantoesDoAviso("P606", agora, 3, 48).map((x) => x.chave)).toEqual([ATUAL, ANT, "P606_2026-10-11_D"]);
  expect(plantoesDoAviso("P606", agora, 1)).toHaveLength(1);
  expect(plantoesDoAviso("P606", agora, 3, 0).map((x) => x.chave)).toEqual([ATUAL]);
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

test("dado de pessoa (falta, mapa, supervisão, férias) só do gerencial/testador; os demais veem só o que é de equipamento", () => {
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

test("janela de 24 h: plantão de 27 h atrás não vira aviso (nem mapa sem envio, nem falta); o de 15 h atrás vira", () => {
  const velho = "P606_2026-10-11_D"; // começou às 07:00 de 11/10
  const r = calc({ mapas: { P606: { [ATUAL]: enviado([]), [ANT]: enviado([]), [velho]: null } } });
  expect(r.avisos).toEqual([]);
  const f = calc({ mapas: { P606: { [ATUAL]: enviado([]), [ANT]: enviado([posto("c", "CCO", "Elaine", "falta")]), [velho]: enviado([posto("d", "CCO", "Beto", "falta")]) } } });
  expect(f.avisos.map((a) => a.titulo)).toEqual(["Falta de Elaine"]);
  expect(f.avisos[0].idade).toBe("há 15 h");
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

// ───────── 12/10/2026: painel só do dia, em tempo real, assertivo ─────────
const noite = new Date("2026-10-12T20:00:00-03:00"); // P606: noturno de 12/10 desde 19:00 · diurno de 12/10 desde 07:00 (13 h) · noturno de 11/10 desde 19:00 (25 h)
const calcEm = (agoraX, fontes, gerencial = true) => calcularAvisos({ agora: agoraX, fontes, gerencial });

test("falta de 25 h atrás some; a de 13 h atrás aparece com a idade certa", () => {
  const r = calcEm(noite, { mapas: { P606: {
    "P606_2026-10-12_N": enviado([]),
    "P606_2026-10-12_D": enviado([posto("c", "CCO", "Elaine", "falta")]),
    "P606_2026-10-11_N": enviado([posto("d", "CCO", "Beto", "falta"), posto("e", "Apoio", "Zé", "ft", { semFalta: true })]),
  } } });
  expect(r.avisos.map((a) => [a.titulo, a.idade])).toEqual([["Falta de Elaine", "há 13 h"]]);
});

test("nada novo, nada no painel: mapas concluídos sem ocorrência não geram aviso", () => {
  const r = calcEm(noite, { mapas: { P606: { "P606_2026-10-12_N": enviado([posto("a", "CCO", "Ana")]), "P606_2026-10-12_D": enviado([posto("a", "CCO", "Ana")]) }, P260C: {} } });
  expect(r.avisos).toEqual([]);
});

test("mapa em rascunho já avisa a falta (tempo real), dizendo que o mapa ainda não foi concluído", () => {
  const r = calcEm(noite, { mapas: { P606: { "P606_2026-10-12_N": { status: "rascunho", postos: [posto("c", "CCO", "Elaine", "falta")] }, "P606_2026-10-12_D": enviado([]) } } });
  const f = r.avisos.find((a) => a.tipo === "falta");
  expect(f.titulo).toBe("Falta de Elaine");
  expect(f.detalhe).toContain("mapa em rascunho");
  expect(r.avisos.find((a) => a.tipo === "falta").detalhe).toContain("sem cobertura registrada");
  // concluído: o aviso continua, sem a marca de rascunho
  const c = calcEm(noite, { mapas: { P606: { "P606_2026-10-12_N": enviado([posto("c", "CCO", "Elaine", "falta")]), "P606_2026-10-12_D": enviado([]) } } });
  expect(c.avisos.find((a) => a.tipo === "falta").detalhe).not.toContain("rascunho");
});

test("falta marcada e depois desfeita no mapa some do painel na hora (nada fica gravado)", () => {
  const com = { P606: { "P606_2026-10-12_N": { status: "rascunho", postos: [posto("c", "CCO", "Elaine", "falta")] }, "P606_2026-10-12_D": enviado([]) } };
  const sem = { P606: { "P606_2026-10-12_N": { status: "rascunho", postos: [posto("c", "CCO", "Elaine", "presente")] }, "P606_2026-10-12_D": enviado([]) } };
  expect(calcEm(noite, { mapas: com }).avisos.some((a) => a.tipo === "falta")).toBe(true);
  expect(calcEm(noite, { mapas: sem }).avisos.some((a) => a.tipo === "falta")).toBe(false);
});

// ── coerência: a falta do painel é a MESMA do consolidado e da ficha ──
import { lancamentosDoMapa } from "../mapaDiario/ficha";
import { ocorrenciasDoMapa } from "../mapaDiario/consolidado";
const mapaCompleto = () => ({
  id: "P606_2026-10-12_N", projetoId: "P606", data: "2026-10-12", turno: "N", status: "enviado", enviadoEm: "2026-10-12T22:10:00.000Z",
  postos: [
    posto("l", "Líder", "Lia", "presente", {}, { pessoaId: "c1" }),
    posto("c", "CCO", "Elaine", "falta", { porFtDe: "f" }, { pessoaId: "c2" }),
    posto("f", "Posto extra", "Rosemeire", "ft", { quemFaltouId: "c2", quemFaltou: "Elaine", faltaPostoId: "c" }, { pessoaId: "c3" }),
    posto("g", "Portaria", "Beto", "ft", { quemFaltouId: "c9", quemFaltou: "Carlos" }, { pessoaId: "c4" }),   // FT sem o posto do Carlos marcado: falta derivada
    posto("h", "Ronda", "Ana", "ft", { semFalta: true }, { pessoaId: "c5" }),                                  // FT sem falta: não é falta
    posto("k", "Apoio", "Teo", "cobertura", { deQuemId: "c7", deQuem: "Gil", base: true }, { pessoaId: "c6" }),  // quem foi coberto faltou
    posto("m", "Apoio 2", "Uma", "cobertura", { deQuemId: "c8", deQuem: "Vera", semFalta: true }, { pessoaId: "c10" }), // cobertura "não foi falta"
    posto("t", "Portaria 2", "Lia2", "troca", { noLugarDe: "Rui" }, { pessoaId: "c11" }),
    posto("v", "Ronda 2", "", "vago"),
    posto("z", "Sem id", "Zeca", "falta", {}),
  ],
});
test("coerência: faltas do painel = faltas do consolidado = faltas lançadas na ficha", () => {
  const mapa = mapaCompleto();
  const painel = calcEm(noite, { mapas: { P606: { [mapa.id]: mapa, "P606_2026-10-12_D": enviado([]) } } }).avisos.filter((a) => a.tipo === "falta").map((a) => a.titulo.replace("Falta de ", "")).sort();
  const consolidado = ocorrenciasDoMapa(mapa).filter((l) => l.tipo === "falta").map((l) => l.pessoa).sort();
  expect(painel).toEqual(consolidado);
  expect(painel).toEqual(["Carlos", "Elaine", "Gil", "Zeca"]); // Ana (FT sem falta), Vera (não foi falta) e a troca NÃO são falta
  // ficha: quem tem cadastro (id) recebe a falta; quem foi digitado sem cadastro (Zeca) fica só no painel/consolidado
  const ficha = lancamentosDoMapa(mapa).filter((l) => l.tipo === "Falta").map((l) => l.colabId).sort();
  expect(ficha).toEqual(["c2", "c7", "c9"]);
});

test("coerência: dois lançamentos da mesma pessoa no mesmo plantão viram um aviso só", () => {
  const mapa = { ...mapaCompleto(), postos: [posto("c", "CCO", "Elaine", "falta", {}, { pessoaId: "c2" }), posto("x", "Extra", "Teo", "ft", { quemFaltouId: "c2", quemFaltou: "Elaine" }, { pessoaId: "c3" })] };
  const r = calcEm(noite, { mapas: { P606: { [mapa.id]: mapa, "P606_2026-10-12_D": enviado([]) } } });
  expect(r.avisos.filter((a) => a.tipo === "falta")).toHaveLength(1);
});

// ── Teste semanal ──
const teste = (data, pct, inop, itens = {}, extra = {}) => ({ data, pct, total: 50, inop, parcial: 0, itens, ...extra });
const it = (rotulo) => ({ rotulo, st: "inop" });
const SEG = new Date("2026-10-12T10:00:00-03:00");  // segunda; teste de domingo 11/10
const T = {
  P601: { ultima: teste("2026-10-11", 92, 2, { a: it("Câmeras — Cam 3"), b: it("Cancela") }), anterior: teste("2026-10-04", 94, 1, { b: it("Cancela"), c: it("Rádio") }) },
  P602: { ultima: teste("2026-10-11", 100, 0), anterior: teste("2026-10-04", 100, 0) },
  P605: { ultima: teste("2026-09-27", 88, 3, { a: it("X") }), anterior: teste("2026-09-20", 88, 3, { a: it("X") }) },
};
const tipoT = (r, tipo = "teste") => r.avisos.filter((a) => a.tipo === tipo);

test("teste semanal recente com novidade: compara com a semana anterior (novo, resolvido, variação)", () => {
  const r = calcEm(SEG, { testes: T, ctmk: { P604: { status: "offline", offlineSince: "2026-10-12T08:00:00-03:00" } } }, false); // há outro aviso: só entra quem tem novidade
  const t = tipoT(r).filter((a) => a.id.startsWith("teste:"));
  expect(t.map((a) => a.projetoId)).toEqual(["P601"]);
  expect(t[0]).toMatchObject({ sev: "atencao", titulo: "Último teste semanal (11/10/2026): 92% · 2 inoperantes" });
  expect(t[0].detalhe).toBe("Desde 04/10/2026: 1 novo (Câmeras — Cam 3) · 1 resolvido (Rádio) · -2 p.p.");
});

test("teste semanal sem novidade e com outros avisos no painel: não aparece (só o aviso do próximo teste)", () => {
  const r = calcEm(SEG, { testes: { P602: T.P602, P605: T.P605 }, ctmk: { P604: { status: "offline", offlineSince: "2026-10-12T08:00:00-03:00" } } }, false);
  expect(tipoT(r).map((a) => a.id)).toEqual(["teste-prox:2026-10-18"]);
});

test("painel sem mais nada: puxa o mínimo — o último teste de cada projeto, com a comparação", () => {
  const r = calcEm(SEG, { testes: T }, false);
  const t = tipoT(r).filter((a) => a.id.startsWith("teste:"));
  expect(t.map((a) => a.projetoId).sort()).toEqual(["P601", "P602", "P605"]);
  expect(t.find((a) => a.projetoId === "P602").detalhe).toBe("Sem mudança desde 04/10/2026");
  expect(t.find((a) => a.projetoId === "P602").titulo).toContain("sem pendência");
  expect(t.find((a) => a.projetoId === "P605").detalhe).toBe("Sem mudança desde 20/09/2026 · 1 item segue pendente");
  expect(t.find((a) => a.projetoId === "P605").idade).toBe("há 14 dias");
  expect(r.contagem.critico + r.contagem.atencao).toBe(1); // só o P601 (item novo) chama atenção
});

test("primeiro teste registrado: não inventa comparação", () => {
  const r = calcEm(SEG, { testes: { P601: { ultima: teste("2026-10-11", 90, 1, { a: it("X") }), anterior: null } } }, false);
  expect(tipoT(r).find((a) => a.id.startsWith("teste:")).detalhe).toBe("Primeiro teste registrado — ainda sem comparação");
});

test("teste semanal (equipamentos) vale para todos os perfis; sem dados de teste não aparece nada", () => {
  expect(tipoT(calcEm(SEG, { testes: T }, true)).length).toBe(tipoT(calcEm(SEG, { testes: T }, false)).length);
  expect(calcEm(SEG, {}, true).avisos).toEqual([]);
  expect(calcEm(SEG, { testes: {} }, true).avisos).toEqual([]);
});

test("próximo teste: domingo da semana que vem, em preparação; no domingo, o andamento do dia", () => {
  const semana = calcEm(SEG, { testes: T }, false).avisos.find((a) => a.id.startsWith("teste-prox"));
  expect(semana).toMatchObject({ projetoId: "TODOS", sev: "info", titulo: "Próximo teste semanal: domingo 18/10/2026" });
  expect(semana.detalhe).toContain("em preparação");
  const sabado = calcEm(new Date("2026-10-17T10:00:00-03:00"), { testes: T }, false).avisos.find((a) => a.id.startsWith("teste-prox"));
  expect(sabado.titulo).toContain("18/10/2026");
  const dom = calcEm(new Date("2026-10-18T10:00:00-03:00"), { testes: { ...T, P601: { ...T.P601, ultima: teste("2026-10-18", 95, 0) } } }, false).avisos.find((a) => a.id.startsWith("teste-hoje"));
  expect(dom).toMatchObject({ titulo: "Teste semanal de hoje (18/10/2026)", detalhe: "1 de 3 projetos já enviaram" });
  const todos = { P601: { ultima: teste("2026-10-18", 95, 0) } };
  expect(calcEm(new Date("2026-10-18T22:00:00-03:00"), { testes: todos }, false).avisos.some((a) => a.id.startsWith("teste-hoje"))).toBe(false); // todos enviaram: segue para o próximo domingo
});
