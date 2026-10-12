// Cobertura (Base ou colaborador) → Falta de QUEM FOI COBERTO na ficha, automática e rastreável; "Posto vago" na FT.
import { lancamentosDoMapa, aplicarNaFicha, descricaoLancamentos, resumoLancamento } from "./ficha";
import { ocorrenciasDoMapa } from "./consolidado";
import { montarTextoWhatsApp } from "./texto";
import { definirCobertoDe, marcarCoberturaSemFalta, completarIdsCobertura, validarParaConcluir, vincularFalta } from "./modelo";
import { calcularAvisos } from "../avisos/regras";

const mapa = (postos) => ({ id: "P505_2026-10-12_D", projetoId: "P505", data: "2026-10-12", turno: "D", status: "enviado", postos });
const cda = (extra = {}) => ({ id: "p1", rotulo: "CDA", pessoaId: "", pessoaNome: "Patrícia Rodrigues", situacao: "cobertura", detalhe: { base: true, livre: true, deQuem: "Amanda Pinho da Silva", deQuemId: "amanda", ...extra }, obs: "" });
const doc = () => ({ colaboradores: [{ id: "amanda", nome: "Amanda Pinho da Silva", historico: [{ id: "velho", tipo: "Falta", data: "2026-09-12", detalhe: "Falta" }] }, { id: "pat", nome: "Patrícia Rodrigues", historico: [] }] });

test("cobertura da Base: a Falta vai para a ficha de quem foi coberto, na data do mapa; quem cobre não recebe nada", () => {
  const l = lancamentosDoMapa(mapa([cda()]));
  expect(l).toHaveLength(1);
  expect(l[0]).toMatchObject({ id: "mapa:P505_2026-10-12_D:amanda:Falta", colabId: "amanda", tipo: "Falta", data: "2026-10-12", origem: "mapa", diasFalta: 1, label: "12/10/2026" });
  expect(l[0].detalhe).toBe("Falta no posto CDA (coberta pela Base: Patrícia Rodrigues) — mapa de 12/10/2026 (diurno)");
});

test("aplica na ficha da Amanda com data 12/10 e não mexe na falta antiga de 12/09", () => {
  const r = aplicarNaFicha(doc(), mapa([cda()]), new Date("2026-10-12T13:00:00Z"));
  expect(r).toMatchObject({ mudou: true, adicionados: 1, ignorados: 0 });
  const h = r.after.colaboradores[0].historico;
  expect(h.map((x) => x.data)).toEqual(["2026-10-12", "2026-09-12"]);
  expect(h[0]).toMatchObject({ origem: "mapa", mapaId: "P505_2026-10-12_D", registradoEm: "2026-10-12T13:00:00.000Z" });
  expect(h[1].origem).toBeUndefined(); // a de 12/09 continua sendo a manual de antes
  expect(r.after.colaboradores[1].historico).toEqual([]); // Patrícia (Base) sem FT nem falta
  expect(aplicarNaFicha(r.after, mapa([cda()])).mudou).toBe(false); // concluir de novo não duplica
});

test("corrigir o mapa (tirar a cobertura ou marcar 'não foi falta') desfaz só o que o mapa lançou", () => {
  const r1 = aplicarNaFicha(doc(), mapa([cda()]));
  const r2 = aplicarNaFicha(r1.after, mapa([cda({ semFalta: true })]));
  expect(r2.removidos).toBe(1);
  expect(r2.after.colaboradores[0].historico.map((x) => x.id)).toEqual(["velho"]);
});

test("não lança: 'não foi falta', sem id do cadastro, ou a própria pessoa", () => {
  expect(lancamentosDoMapa(mapa([cda({ semFalta: true })]))).toEqual([]);
  expect(lancamentosDoMapa(mapa([cda({ deQuemId: undefined })]))).toEqual([]);
  expect(lancamentosDoMapa(mapa([{ ...cda(), pessoaId: "amanda" }]))).toEqual([]);
});

test("cobertura por colaborador (não Base) também lança a falta de quem foi coberto", () => {
  const p = { ...cda({ base: false, livre: false }), pessoaId: "pat" };
  const l = lancamentosDoMapa(mapa([p]));
  expect(l.map((x) => [x.colabId, x.tipo])).toEqual([["amanda", "Falta"]]);
  expect(l[0].detalhe).toContain("coberta por Patrícia Rodrigues");
});

test("a mesma pessoa em cobertura e como falta marcada não duplica", () => {
  const falta = { id: "p0", rotulo: "CDA", pessoaId: "amanda", pessoaNome: "Amanda Pinho da Silva", situacao: "falta", detalhe: {}, obs: "" };
  expect(lancamentosDoMapa(mapa([falta, cda()])).filter((x) => x.tipo === "Falta")).toHaveLength(1);
});

test("a tela mostra 'Falta de Amanda…' e o resumo conta 1 falta", () => {
  const m = mapa([cda()]);
  expect(descricaoLancamentos(m)).toEqual(["Falta de Amanda Pinho da Silva"]);
  expect(resumoLancamento({ removidos: 0 }, m)).toBe("Ficha atualizada: 1 falta.");
});

test("consolidado: a falta aparece (derivada) e não duplica quando o posto dela já está como falta", () => {
  const o = ocorrenciasDoMapa(mapa([cda()]));
  const f = o.filter((x) => x.tipo === "falta");
  expect(f).toHaveLength(1);
  expect(f[0]).toMatchObject({ pessoa: "Amanda Pinho da Silva", pessoaId: "amanda", posto: "CDA", derivada: true });
  expect(f[0].detalhe).toBe("coberta pela Base: Patrícia Rodrigues");
  expect(o.some((x) => x.tipo === "cobertura")).toBe(true);
  const falta = { id: "p0", rotulo: "CDA", pessoaId: "amanda", pessoaNome: "Amanda Pinho da Silva", situacao: "falta", detalhe: {}, obs: "" };
  expect(ocorrenciasDoMapa(mapa([falta, cda()])).filter((x) => x.tipo === "falta")).toHaveLength(1);
  expect(ocorrenciasDoMapa(mapa([cda({ semFalta: true })])).filter((x) => x.tipo === "falta")).toHaveLength(0);
});

test("painel de avisos: falta de quem foi coberto pela Base", () => {
  const agora = new Date("2026-10-12T10:00:00-03:00");
  const m = { status: "enviado", enviadoEm: "2026-10-12T08:00:00-03:00", postos: [{ id: "k", rotulo: "CDA", pessoaNome: "Patrícia Rodrigues", situacao: "cobertura", detalhe: { base: true, deQuem: "Amanda Pinho da Silva", deQuemId: "amanda" } }] };
  const r = calcularAvisos({ agora, fontes: { mapas: { P606: { "P606_2026-10-12_D": m, "P606_2026-10-11_N": { status: "enviado", enviadoEm: "2026-10-11T22:10:00.000Z", postos: [] } } } }, gerencial: true });
  const f = r.avisos.filter((a) => a.tipo === "falta");
  expect(f.map((a) => a.titulo)).toEqual(["Falta de Amanda Pinho da Silva"]);
  expect(f[0].detalhe).toContain("coberta pela Base: Patrícia Rodrigues");
  m.postos[0].detalhe.semFalta = true;
  const r2 = calcularAvisos({ agora, fontes: { mapas: { P606: { "P606_2026-10-12_D": m } } }, gerencial: true });
  expect(r2.avisos.filter((a) => a.tipo === "falta")).toEqual([]);
});

test("modelo: escolher o coberto grava nome e id; férias já marca 'não foi falta'; limpar remove", () => {
  const m0 = mapa([{ ...cda(), detalhe: { base: true, livre: true } }]);
  const m1 = definirCobertoDe(m0, "p1", { id: "amanda", nome: "Amanda Pinho da Silva" });
  expect(m1.postos[0].detalhe).toMatchObject({ deQuem: "Amanda Pinho da Silva", deQuemId: "amanda", base: true });
  expect(m1.postos[0].detalhe.semFalta).toBeUndefined();
  const mF = definirCobertoDe(m0, "p1", { id: "amanda", nome: "Amanda", emFerias: true });
  expect(mF.postos[0].detalhe.semFalta).toBe(true);
  expect(marcarCoberturaSemFalta(m1, "p1", true).postos[0].detalhe.semFalta).toBe(true);
  expect(marcarCoberturaSemFalta(marcarCoberturaSemFalta(m1, "p1", true), "p1", false).postos[0].detalhe).not.toHaveProperty("semFalta");
  const m2 = definirCobertoDe(m1, "p1", null);
  expect(m2.postos[0].detalhe).toEqual({ base: true, livre: true });
  expect(JSON.stringify(m2)).not.toMatch(/undefined/);
});

test("mapa antigo (só o nome): completa o id quando o nome bate com um único cadastro", () => {
  const velho = mapa([cda({ deQuemId: undefined })]);
  delete velho.postos[0].detalhe.deQuemId;
  const cs = [{ id: "amanda", nome: "Amanda Pinho da Silva" }, { id: "x", nome: "Outra" }];
  expect(completarIdsCobertura(velho, cs).postos[0].detalhe.deQuemId).toBe("amanda");
  expect(completarIdsCobertura(velho, [...cs, { id: "dup", nome: "amanda pinho da silva" }])).toBe(velho); // ambíguo: não chuta
  expect(completarIdsCobertura(velho, [{ id: "z", nome: "Fulana" }])).toBe(velho);
});

test("validação: cobertura exige o cadastro e barra o coberto que aparece presente em outro posto", () => {
  const base = (postos) => validarParaConcluir(mapa(postos)).filter((e) => /cobert|cadastro|presente em outro/.test(e));
  const semId = cda(); delete semId.detalhe.deQuemId;
  expect(base([semId]).join(" ")).toMatch(/lista do cadastro/);
  expect(base([cda()])).toEqual([]);
  const presente = { id: "p9", rotulo: "P2", pessoaId: "amanda", pessoaNome: "Amanda Pinho da Silva", situacao: "presente", detalhe: {}, obs: "" };
  expect(base([cda(), presente]).join(" ")).toMatch(/presente em outro posto/);
  expect(base([cda({ semFalta: true }), presente])).toEqual([]);
});

test("FT: 'Posto vago' é uma escolha explícita — não gera falta e aparece como tal", () => {
  const ft = { id: "f1", rotulo: "Posto extra", pessoaId: "pat", pessoaNome: "Patrícia", situacao: "ft", detalhe: {}, obs: "" };
  const m = vincularFalta(mapa([ft]), "f1", "__vago");
  expect(m.postos[0].detalhe).toEqual({ postoVago: true });
  expect(validarParaConcluir(m).filter((e) => /FT cobrindo/.test(e))).toEqual([]);
  expect(validarParaConcluir(mapa([ft])).some((e) => /FT cobrindo/.test(e))).toBe(true);
  expect(lancamentosDoMapa(m).map((x) => x.tipo)).toEqual(["FT"]);
  expect(ocorrenciasDoMapa(m).find((x) => x.tipo === "ft").detalhe).toBe("cobrindo posto vago");
  expect(montarTextoWhatsApp(m)).toContain("cobrindo posto vago");
  // trocar a escolha limpa o 'posto vago'
  expect(vincularFalta(m, "f1", "__ninguem").postos[0].detalhe).toEqual({ semFalta: true });
});
