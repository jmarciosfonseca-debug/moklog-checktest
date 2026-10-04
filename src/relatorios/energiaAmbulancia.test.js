import { analisarEnergia, montarRelatorioEnergia, protocoloValido, turnoPelaHora, ehTeste } from "./energiaRelatorio";
import { analisarAmbulancia, montarConsolidadoAmbulancia, permanencia, prefixarCSS } from "./ambulanciaRelatorio";
import P601 from "./fixtureEnergiaP601.json";   // transcrição do PDF real do P601 (04/10/2026)
const HOJE = new Date("2026-10-04T23:00:00");
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const PROJ = (id, name) => ({ id, name, categories: [] });

describe("energia — correções sobre o relatório anterior (dados do P601)", () => {
  const a = analisarEnergia(P601, HOJE);
  test("diesel avulso não é queda: 20 quedas (o relatório antigo mostrava 23)", () => {
    expect(P601).toHaveLength(23); expect(a.quedas).toHaveLength(20); expect(a.abastecimentos).toHaveLength(4);
  });
  test("tempo total confere com o PDF (86h38) e gerador cobre 20 de 20", () => {
    expect(a.tempoTotal).toBe(86 * 60 + 38); expect(a.gerador).toBe(20); expect(a.manutencista).toBe(15);
  });
  test("protocolo: 15 válidos ('Nao' e 'N/A' não contam) e o número repetido é detectado", () => {
    expect(a.protocolosValidos).toBe(15); expect(a.protocolosTexto.map(e => e.protocolo).sort()).toEqual(["N/A", "N/A", "Nao"]);
    expect([...a.repetidos]).toEqual(["202608173330865817"]);
  });
  test("turno pela hora (03:55 e 05:00 lançadas como Diurno) e impacto sem marcação (21/09)", () => {
    expect(a.turnoDivergente.map(e => e.inicioQueda.slice(0, 10)).sort()).toEqual(["2026-08-31", "2026-09-08"]);
    expect(a.impactoSemMarca.map(e => e.inicioQueda.slice(0, 10))).toEqual(["2026-09-21"]);
    expect(a.afetadas).toHaveLength(2);
  });
  test("intervalo médio entre quedas, mediana, maior queda, diesel", () => {
    expect(a.mediaIntervalo).toBeCloseTo(4.4, 1); expect(a.mediana).toBe(237.5);
    expect(a.maior.inicioQueda.slice(0, 16)).toBe("2026-09-21T15:22"); expect(a.litros).toBe(1323); expect(a.fornecedores).toBe(3);
  });
  test("ordem: mais recentes primeiro, por data E hora (19/07 17:14 antes de 15:54)", () => {
    const d19 = a.quedas.filter(e => e.inicioQueda.startsWith("2026-07-19")).map(e => e.inicioQueda.slice(11, 16));
    expect(d19).toEqual(["17:14", "15:54"]);
  });
  test("HTML: padrão Moked, sem emojis; conferência só na versão interna", () => {
    const c = montarRelatorioEnergia(PROJ("P601", "Golgi Cajamar"), P601, { hoje: HOJE }).html;
    const i = montarRelatorioEnergia(PROJ("P601", "Golgi Cajamar"), P601, { hoje: HOJE, interno: true }).html;
    expect(c).toContain("86h38"); expect(c).toContain("Gerador acionado em 20 de 20 quedas"); expect(c).toContain("15 de 20");
    expect(c).toContain("Abastecimento de diesel"); expect(c).toContain("1.323 L"); expect(c).not.toMatch(EMOJI);
    expect(c).not.toContain("Conferência do registro"); expect(i).toContain("Conferência do registro"); expect(i).toContain("VERSÃO INTERNA");
    expect(i).toContain("202608173330865817");
  });
});

describe("energia — projeto com poucos dados (P604)", () => {
  const teste = [{ id: "t1", inicioQueda: "2026-07-14T10:03:00", fimQueda: "2026-07-14T10:03:00", gerador: "sim", protocolo: "14/07/2026", obs: "Teste início da contagem" }];
  test("registro de teste fica fora das contas e o relatório mostra os dias sem queda", () => {
    const a = analisarEnergia(teste, HOJE); expect(a.quedas).toHaveLength(0); expect(a.testes).toHaveLength(1); expect(a.diasDeRegistro).toBe(82);
    const h = montarRelatorioEnergia(PROJ("P604", "Golgi Jundiaí"), teste, { hoje: HOJE }).html;
    expect(h).toContain("82 dias"); expect(h).toContain("sem queda de energia registrada"); expect(h).not.toContain("Registro das quedas");
  });
  test("ehTeste não exclui queda real que menciona 'teste' mas teve duração", () => {
    expect(ehTeste({ inicioQueda: "2026-07-14T10:00:00", fimQueda: "2026-07-14T11:00:00", obs: "teste do gerador durante a queda" })).toBe(false);
    expect(ehTeste({ teste: true, inicioQueda: "2026-07-14T10:00:00", fimQueda: "2026-07-14T11:00:00" })).toBe(true);
  });
  test("protocolo e turno", () => {
    expect(protocoloValido("20261004351592717")).toBe(true); expect(protocoloValido("2026 / 2027 0000 1")).toBe(true);
    expect(protocoloValido("14/07/2026")).toBe(false);   // data digitada no lugar do número (caso real do P604)
    ["Nao", "N/A", "", null, "123"].forEach(p => expect(protocoloValido(p)).toBe(false));
    expect(turnoPelaHora("2026-09-08T03:55:00")).toBe("Noturno"); expect(turnoPelaHora("2026-09-08T17:59:00")).toBe("Diurno"); expect(turnoPelaHora("2026-09-08T18:00:00")).toBe("Noturno");
  });
});

describe("ambulância — consolidado e 'Baixar todos' (registros do P311A)", () => {
  const FOTO = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
  const R = [
    { id: "a-c44da5d027", data: "2026-10-03", turno: "Diurno", horaEntrada: "12:54", horaSaida: "14:04", inquilino: "Boticário Cálamo", tipo: "", gravidade: "Leve", vitimaRemovida: "Sim", condutor: "Rudnei Portela", socorrista1: "William Dias", fotos: [FOTO], registradoPor: "Tatiana da Silva de Carvalho", paciente: "NOME DA VITIMA 1" },
    { id: "a2", data: "2026-10-01", turno: "Diurno", horaEntrada: "11:58", horaSaida: "13:10", inquilino: "Boticário", tipo: "", gravidade: "Leve", paciente: "NOME DA VITIMA 2", fotos: [] },
    { id: "a3", data: "2026-10-01", turno: "Diurno", horaEntrada: "08:18", horaSaida: "08:50", inquilino: "Boticário", tipo: "", gravidade: "Leve", fotos: [FOTO] },
    { id: "a4", data: "2026-09-30", turno: "Noturno", horaEntrada: "23:34", horaSaida: "23:52", inquilino: "Bosh", tipo: "Outro", tipoOutro: "Crise de ansiedade", gravidade: "Moderada", paciente: "NOME DA VITIMA 4", fotos: [FOTO] },
    { id: "a5", data: "2026-09-28", turno: "Noturno", horaEntrada: "19:05", horaSaida: "19:44", inquilino: "Boticário", tipo: "", gravidade: "Leve" },
    { id: "fora", data: "2026-08-15", turno: "Diurno", horaEntrada: "10:00", horaSaida: "10:30", inquilino: "Outro", gravidade: "Leve" },
  ];
  const P = PROJ("P311A", "Mega CL Curitiba");
  test("análise do período", () => {
    const a = analisarAmbulancia(R, { inicio: "2026-09-28", fim: "2026-10-03", inquilinosLista: ["Boticário", "Boticário Cálamo"] });
    expect(a.n).toBe(5); expect([a.diurno, a.noturno]).toEqual([3, 2]); expect(Math.round(a.permMedia)).toBe(46); expect([a.permMin, a.permMax]).toEqual([18, 72]);
    expect(a.semTipo).toBe(4); expect(a.graves).toBe(1); expect(a.porInquilino[0]).toEqual(["Boticário", 3]); expect(a.foraDoCadastro).toEqual(["Bosh"]);
    expect(a.porTipo.find(([t]) => t === "Crise de ansiedade")[1]).toBe(1);
  });
  test("permanência atravessa a meia-noite", () => { expect(permanencia({ horaEntrada: "23:43", horaSaida: "00:10" })).toBe(27); expect(permanencia({ horaEntrada: "23:43" })).toBeNull(); });
  test("LGPD: nome da vítima nunca aparece (nem no consolidado, nem no anexo)", () => {
    const { html } = montarConsolidadoAmbulancia(P, R, { inicio: "2026-09-28", fim: "2026-10-03", interno: true, comAnexo: true, hoje: HOJE });
    expect(html).not.toMatch(/NOME DA VITIMA/);
  });
  test("Baixar todos: consolidado + um registro por página, com CSS do anexo isolado", () => {
    const { html } = montarConsolidadoAmbulancia(P, R, { inicio: "2026-09-28", fim: "2026-10-03", comAnexo: true, hoje: HOJE });
    expect(html.match(/class="mk-anexo"/g)).toHaveLength(5);
    expect(html).toContain("Rudnei Portela"); expect(html.split(FOTO).length - 1).toBe(3);
    const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    expect(css).toContain(".mk-anexo .header"); expect(css).not.toMatch(/}\s*body\{background:#f4f4f4/); expect(css).not.toMatch(/(^|})\*\{box-sizing/);
  });
  test("consolidado sem anexo, versão cliente: sem conferência e sem emojis", () => {
    const { html } = montarConsolidadoAmbulancia(P, R, { inicio: "2026-09-28", fim: "2026-10-03", hoje: HOJE });
    expect(html).not.toContain("mk-anexo\""); expect(html).not.toContain("Conferência do registro"); expect(html).not.toMatch(EMOJI);
    expect(html).toContain("Acessos de Ambulância — Consolidado"); expect(html).toContain("5 atendimentos");
  });
  test("prefixarCSS isola regras globais e mantém @media", () => {
    const out = prefixarCSS("*{margin:0}body{padding:2px}.a,.b{x:1}@media print{body{y:1}.c{z:1}@page{margin:8mm}}", ".esc");
    expect(out).toBe(".esc,.esc *{margin:0}.esc{padding:2px}.esc .a,.esc .b{x:1}@media print{.esc{y:1}.esc .c{z:1}}");
  });
});
