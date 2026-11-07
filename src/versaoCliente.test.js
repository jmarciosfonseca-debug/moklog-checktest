// Versão para o cliente (06/11/2026): parecer do consultor na Análise de Risco e recorte no consolidado perimetral.
// Regra: o documento sempre registra a classificação do motor / o recorte usado — nunca substitui em silêncio.
import { gerarConsolidadoPerimetralHTML } from "./relatorios/perimetralConsolidado";

jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), doc: () => ({}), getDoc: async () => ({ exists: () => false }), collection: () => ({}), getDocs: async () => ({ docs: [] }), query: (...a) => a, where: (...a) => a }));
const { gerarAnaliseSingle } = require("./single/singleRisco");
const { calcularInspecao } = require("./single/singleCalc");

const texto = (html) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const item = (id, nome, grupo, total, extra = {}) => ({ id, familiaId: id, nome, grupo, total, parcial: 0, inoperante: 0, falhas: [], ...extra });
const single = { id: "sg_x1", nome: "Cliente X", codigo: "CX1", responsavel: "Marcio" };
const inspecao = calcularInspecao({ id: "i1", estado: "concluida", data: "2026-11-06", responsavel: "Marcio", itens: [item("ala_panico_fixo", "Botões de pânico fixos", "Alarmes", 8, { inoperante: 8 }), item("cftv_fixas", "Câmeras fixas", "CFTV e CCO", 20, { inoperante: 2 })] });

test("AR: parecer do consultor muda a classificação em destaque, mas o motor fica registrado; enxuta omite a memória; ref ganha -C", async () => {
  const base = await gerarAnaliseSingle({ single, inspecao, diagnosticos: [], usarDiagnostico: false });
  const motor = base.analise.geral.label;
  expect(["ELEVADO", "CRÍTICO", "MODERADO"]).toContain(motor);
  const { gerarHTMLAnaliseRisco } = require("./AnaliseRisco");
  const html = gerarHTMLAnaliseRisco({ ...base.analise, versaoCliente: { nivel: 1, label: "BAIXO", motivo: "Contenção compensada por vigilância 24h; reparo contratado com prazo", consultor: "Marcio Fonseca", enxuta: true } }, null, null);
  const t = texto(html);
  expect(t).toMatch(/Parecer do consultor: classificação definida como BAIXO por Marcio Fonseca — Contenção compensada/);
  expect(t).toMatch(new RegExp(`Classificação do motor de risco Moked: ${motor}`));
  expect(t).not.toMatch(/memória de cálculo/i);
  expect(t).toMatch(/MK-CX1-AR-0001-C/);
  // sem versão cliente: memória presente, sem parecer, sem -C
  const t0 = texto(base.html);
  expect(t0).toMatch(/memória de cálculo/i); expect(t0).not.toMatch(/Parecer do consultor/); expect(t0).not.toMatch(/-0001-C/);
  // mesma classificação do motor: só confirma
  const t1 = texto(gerarHTMLAnaliseRisco({ ...base.analise, versaoCliente: { nivel: base.analise.geral.nivel, label: motor, motivo: "", consultor: "Marcio Fonseca", enxuta: false } }, null, null));
  expect(t1).toMatch(/confirma a classificação do motor/);
  expect(t1).toMatch(/memória de cálculo/i);
});

test("Perimetral: recorte do consultor limita zonas, declara as zonas fora, omite observações na enxuta e ganha -C", () => {
  const project = { id: "P604", name: "Golgi Jundiaí" };
  const pcfg = { zonas: ["Zona 01", "Zona 02", "Zona 03"], clienteNome: "Golgi" };
  const t = (d, z3) => ({ id: d, data: d, turno: "Diurno", hora: "08:00", quemFez: "Ana", zonas: { "Zona 01": { status: "ok", obs: "" }, "Zona 02": { status: "ok", obs: "" }, "Zona 03": { status: z3, obs: z3 === "ok" ? "" : "Sensor em falha" } } });
  const testes = [t("2026-11-01", "inop"), t("2026-11-02", "inop"), t("2026-11-03", "ok")];
  const cheio = texto(gerarConsolidadoPerimetralHTML({ testes, project, pcfg, hoje: new Date("2026-11-03T12:00:00") }));
  expect(cheio).toMatch(/Sensor em falha/); expect(cheio).toMatch(/MK-PE-P604-20261103 /); expect(cheio).not.toMatch(/Recorte definido/);
  const cli = texto(gerarConsolidadoPerimetralHTML({ testes, project, pcfg, hoje: new Date("2026-11-03T12:00:00"), versaoCliente: { zonas: ["Zona 01", "Zona 02"], enxuta: true, consultor: "Marcio Fonseca" } }));
  expect(cli).toMatch(/MK-PE-P604-20261103-C/);
  expect(cli).toMatch(/Recorte definido pelo consultor \(Marcio Fonseca\)\. Período .* 3 teste\(s\) · 2 de 3 zonas · zonas não incluídas neste documento: Zona 03 · versão enxuta/);
  expect(cli).not.toMatch(/Sensor em falha/);
  expect(cli).toMatch(/Taxa OK/);
  // com a Zona 03 dentro do recorte, a falha e a observação continuam no documento (recorte não apaga falha declarada)
  const cli2 = texto(gerarConsolidadoPerimetralHTML({ testes, project, pcfg, hoje: new Date("2026-11-03T12:00:00"), versaoCliente: { zonas: ["Zona 01", "Zona 02", "Zona 03"], enxuta: false } }));
  expect(cli2).toMatch(/Sensor em falha/); expect(cli2).toMatch(/3 de 3 zonas/);
});
