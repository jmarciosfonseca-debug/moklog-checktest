import { gerarConsolidadoMapasHTML } from "./consolidadoMapasRelatorio";
import { consolidar } from "../mapaDiario/consolidado";
import { criarAvatares } from "./consolidadoMapasRelatorio";

const posto = (id, rotulo, pessoaNome, situacao = "presente", detalhe = {}, extra = {}) => ({ id, rotulo, pessoaNome, situacao, detalhe, ...extra });
const mapas = [
  { id: "a", projetoId: "P606", data: "2026-10-11", turno: "N", horario: { inicio: "19:00", fim: "07:00" }, status: "enviado", enviadoEm: "2026-10-11T22:10:00.000Z", resumo: "Sem novidades <b>x</b>", veiculos: [{ rotulo: "Moto", kmAnterior: 10, kmAtual: 55 }], supervisao: { ultimaData: "2026-10-01", supervisor: "Fulano" }, visita: { houve: false },
    postos: [posto("l", "Líder", "Marcos <script>", "presente", {}, { lider: true }), posto("c", "CCO", "Elaine", "falta", { porFtDe: "f" }), posto("f", "Posto extra", "Rosemeire", "ft", { quemFaltou: "Elaine" })] },
  { id: "b", projetoId: "P601", data: "2026-10-10", turno: "D", status: "enviado", postos: [posto("l", "Líder", "Carlos", "presente", {}, { lider: true })] },
];
const f = { de: "2026-10-01", ate: "2026-10-31" };
const html = (extra = {}, opts = {}) => gerarConsolidadoMapasHTML({ resultado: consolidar(mapas, { ...f, ...extra }), nomeProj: (p) => `${p} · Nome`, hoje: new Date("2026-10-12T12:00:00"), ...opts });

test("padrão Moked: título, número, filtros, KPIs, resumo por projeto e ocorrências", () => {
  const h = html();
  expect(h).toContain("Consolidado do Mapa de Equipe");
  expect(h).toContain("MK-MEQ-261001-261031");
  expect(h).toContain("Período 01/10/2026 a 31/10/2026");
  expect(h).toContain("Mapas concluídos");
  expect(h).toContain("Resumo por projeto");
  expect(h).toContain("P606 · Nome");
  expect(h).toContain("coberta por FT de Rosemeire");
  expect(h).toContain("cobrindo a falta de Elaine");
  expect(h).toContain("Imprimir / Salvar PDF");
});
test("texto de usuário é escapado (nome, resumo)", () => {
  const h = html({}, { detalhado: true });
  expect(h).not.toContain("<script>");
  expect(h).toContain("Marcos &lt;script&gt;");
  expect(h).toContain("Sem novidades &lt;b&gt;x&lt;/b&gt;");
});
test("com um projeto só não repete a tabela de resumo por projeto", () => {
  expect(html({ projetos: ["P606"] })).not.toContain("Resumo por projeto");
});
test("detalhado traz efetivo, km e supervisão; o simples não", () => {
  const simples = html();
  const det = html({}, { detalhado: true });
  expect(simples).not.toContain("Mapas do período");
  expect(det).toContain("Mapas do período");
  expect(det).toContain("Moto 45 km");
  expect(det).toContain("sem visita neste turno");
  expect(det).toContain("última visita 01/10/2026 (Fulano)");
});
test("filtro sem resultado diz que não achou, sem número inventado", () => {
  const h = html({ ocorrencia: "falta", projetos: ["P601"] });
  expect(h).toContain("Nenhum mapa concluído encontrado com esses filtros");
  expect(h).not.toContain("Resumo por projeto");
});
test("só FT ou falta: o PDF só lista o que foi pedido", () => {
  const h = html({ ocorrencia: "falta" });
  expect(h).toContain("Somente falta");
  expect(h).not.toContain("cobrindo a falta de Elaine"); // linha da FT fica fora
  expect(h).toContain("coberta por FT de Rosemeire");
});

test("fotos: cada foto entra uma vez (classe CSS), sem foto vira iniciais, sem a opção não há avatar", () => {
  const FOTO = "data:image/jpeg;base64,QUJD";
  const m2 = mapas.map((m) => (m.projetoId === "P606" ? { ...m, postos: m.postos.map((p) => (p.id === "f" ? { ...p, pessoaId: "r1" } : p)) } : m));
  const fotos = { P606: { porId: { r1: FOTO }, porNome: { "elaine souza": FOTO } }, P601: { porId: {}, porNome: {} } };
  const h = gerarConsolidadoMapasHTML({ resultado: consolidar(m2, { ...f }), nomeProj: (p) => p, hoje: new Date("2026-10-12T12:00:00"), fotos, detalhado: true });
  expect(h.split(FOTO).length - 1).toBe(1); // Rosemeire (id) e Elaine (nome) com a mesma foto de teste: uma cópia só
  expect(h).toContain("mk-f0");
  expect(h).toContain('class="mk-av mk-ini">'); // quem não tem foto: iniciais
  const sem = gerarConsolidadoMapasHTML({ resultado: consolidar(m2, { ...f }), nomeProj: (p) => p, hoje: new Date("2026-10-12T12:00:00") });
  expect(sem).not.toContain("mk-av");
});
test("criarAvatares: sem fotos não gera nada; nome é escapado", () => {
  expect(criarAvatares(null).html("P1", "x", "Ana")).toBe("");
  const av = criarAvatares({ P1: { porId: {}, porNome: {} } });
  expect(av.html("P1", "", "Ana <b>")).toContain("A");
  expect(av.html("P1", "", "Ana <b>")).not.toContain("<b>");
  expect(av.usadas()).toBe(0);
});
test("falta derivada da FT aparece no PDF mesmo sem posto de falta", () => {
  const antigo = [{ id: "z", projetoId: "P606", data: "2026-10-11", turno: "N", status: "enviado", postos: [posto("l", "Líder", "Luiz"), posto("c", "CCO", "Rosemeire", "ft", { quemFaltou: "Elaine Farias" }, { obs: "Falta com atestado" })] }];
  const h = gerarConsolidadoMapasHTML({ resultado: consolidar(antigo, f), nomeProj: (p) => p, hoje: new Date("2026-10-12T12:00:00") });
  expect(h).toContain("Elaine Farias");
  expect(h).toContain("coberta por FT de Rosemeire");
  expect(h).toMatch(/<div class="mk-kv mk-da">1<\/div><div class="mk-kl">Faltas/);
});

test("posto com saída antecipada mostra a saída e a cobertura no PDF", () => {
  const { rotuloSaida } = require("../mapaDiario/modelo");
  const p = { rotulo: "Tático", pessoaNome: "Ana", saida: { motivo: "Mal súbito", hora: "14:30", coberturas: [{ tipo: "base", pessoaNome: "Beto", de: "14:30" }] } };
  expect(rotuloSaida(p)).toContain("cobertura: Beto (Base) das 14:30");
});
