// Marcio, 17/11/2026: o Inventário de Equipamentos estava fora do padrão Moked. Só a apresentação muda; os dados e as contagens não.
import fs from "fs";
import path from "path";
import { montarRelatorioEquipamentos, resumoEquipamentos, SECOES_EQUIPAMENTOS } from "./equipamentosRelatorio";

const HOJE = new Date("2026-11-17T15:00:00-03:00");
const P = { id: "P311B", name: "Mega CL Itajaí" };
// Mesmo conteúdo do PDF que o Marcio enviou (dados de equipamento, sem pessoas).
const DADOS = {
  smartphones: [{ identificacao: "Smartphone Lider" }, { identificacao: "Smartphone CCO" }, { identificacao: "Smartphone Tático" }],
  radiosHT: ["Rádio Vigilancia", "Rádio Lider", "Rádio CCO", "RADIO TÁTICO", "RÁDIO ZELADOR"].map((identificacao) => ({ identificacao, marca: "Intelbras", status: "ok" })),
  armamento: [{ identificacao: "Revólver 01", calibre: ".38", nSerie: "AGD184004" }, { identificacao: "Revólver 02", calibre: ".38", nSerie: "AGD184019" }],
  municao: [{ identificacao: ".38", qtd: 36 }],
  placas: [{ identificacao: "Colete Líder Diurno", nSerie: "325.753", validade: "2031-04-25" }, { identificacao: "Colete Tático Diurno", nSerie: "325.752", validade: "2031-04-25" }, { identificacao: "Colete Líder Noturno", nSerie: "330.366", validade: "2031-09-11" }, { identificacao: "Colete Tático Noturno", nSerie: "330.365", validade: "2031-09-11" }],
  lanternas: [{ identificacao: "Lanterna Lider" }, { identificacao: "Lanterna Tático" }],
  ztrax: [{ identificacao: "ZTRAX Diurno" }, { identificacao: "ZTRAX Noturno" }],
  bodycam: [{ identificacao: "Bodycam Líder" }, { identificacao: "Bodycam Ronda" }, { identificacao: "Bodycam Reserva", status: "inop", dataProblem: "2026-11-15", justificativa: "A Bodycam Reserva não foi entregue no posto" }],
  moto: { placa: "SXX 0E52", modelo: "2025", ano: "2025", km: 44587, kmManutencao: 44691, historico: [{ data: "2026-10-15", km: 42294, desc: "Troca de óleo" }] },
};

test("contagens iguais às do relatório anterior: 23 itens, 22 ok, 0 parcial, 1 inoperante", () => {
  expect(resumoEquipamentos(DADOS)).toEqual({ total: 23, ok: 22, parcial: 0, inop: 1 });
  expect(resumoEquipamentos({})).toEqual({ total: 0, ok: 0, parcial: 0, inop: 0 });
});

test("documento no padrão Moked: cabeçalho, número, sem emoji e sem o cabeçalho roxo antigo", () => {
  const { html, numero } = montarRelatorioEquipamentos(P, DADOS, { hoje: HOJE });
  expect(numero).toBe("MK-P311B-EQ-1117");
  expect(html).toContain('class="mk-topo"');
  expect(html).toContain("Inventário de Equipamentos");
  expect(html).toContain("P311B — Mega CL Itajaí · posição em 17/11/2026");
  expect(html).toContain(numero);
  expect(html).not.toMatch(/linear-gradient\(135deg,#1a1040/);
  expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  expect(html.lastIndexOf("mk-fim")).toBeGreaterThan(html.lastIndexOf("Motocicleta"));
});

test("mantém todas as seções, colunas e dados", () => {
  const { html } = montarRelatorioEquipamentos(P, DADOS, { hoje: HOJE });
  ["Smartphones", "Rádios HT", "Armamento", "Munição", "Placas balísticas", "Lanternas", "Pânico ZTRAX", "Bodycam", "Motocicleta"].forEach((t) => expect(html).toContain(t));
  expect(html).not.toContain("Outros equipamentos");            // seção vazia não aparece
  ["Intelbras", "AGD184004", "AGD184019", "325.753", "25/04/2031", "11/09/2031", "SXX 0E52", "44587 km", "44691 km", "42294 km", "Troca de óleo", "15/10/2026"].forEach((t) => expect(html).toContain(t));
  expect(html).toContain("<td><b>36</b></td>");
  expect(html).toContain("2 d em aberto");
  expect(html).toContain("A Bodycam Reserva não foi entregue no posto");
  expect(html).toContain('<span class="mk-b mk-b-da">1 com problema</span>');
  expect(html).toContain("5 itens"); expect(html).toContain("1 item");
});

test("validade vencida, km de manutenção atingido, moto reserva e texto do usuário escapado", () => {
  const { html } = montarRelatorioEquipamentos(P, { placas: [{ identificacao: "Colete <b>X</b>", validade: "2025-01-01" }], outros: [{ identificacao: "Cone & fita", qtd: 4, status: "baixo", dataProblem: "2026-11-10", justificativa: "<script>x</script>" }], moto: { placa: "AAA1A11", km: 50000, kmManutencao: 49000, reservaAtual: { placa: "RRR9R99", kmInicial: 100211, km: 100300, desde: "2026-11-17T10:00:00.000Z" } } }, { hoje: HOJE });
  expect(html).toContain('<span class="mk-b mk-b-da">vencida</span>');
  expect(html).toContain("km de manutenção atingido");
  expect(html).toContain("Moto reserva em uso</b> (RRR9R99): chegou com 100211 km · km atual 100300 km");
  expect(html).toContain("Colete &lt;b&gt;X&lt;/b&gt;"); expect(html).toContain("Cone &amp; fita"); expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
  expect(html).toContain('<span class="mk-b mk-b-wa">Baixo</span>');
});

test("projeto sem equipamento: aviso em vez de página vazia", () => {
  expect(montarRelatorioEquipamentos(P, {}, { hoje: HOJE }).html).toContain("Nenhum equipamento cadastrado neste projeto.");
  expect(SECOES_EQUIPAMENTOS.map((s) => s.chave)).toEqual(["outros", "smartphones", "radiosHT", "armamento", "municao", "placas", "lanternas", "ztrax", "bodycam"]);
});

test("a tela de Equipamentos usa o relatório padronizado", () => {
  const fonte = fs.readFileSync(path.join(__dirname, "..", "Equipamentos.jsx"), "utf8");
  expect(fonte).toContain("montarRelatorioEquipamentos(project, data || {})");
  expect(fonte).not.toContain("Imprimir / Salvar PDF");
});

if (process.env.SALVAR_HTML) fs.writeFileSync(process.env.SALVAR_HTML, montarRelatorioEquipamentos(P, DADOS, { hoje: HOJE }).html);
