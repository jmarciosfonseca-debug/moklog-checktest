import { perfilDoSingle, codigoDoSingle, gerarAnaliseSingle, fontesDoSingle } from "./singleRisco";
import { calcularInspecao } from "./singleCalc";

const catalogoMock = { categorias: [{ id: "D01", nome: "Perímetro", ordem: 1 }], subcategorias: [{ id: "D01.03", categoria: "D01", nome: "Barreiras", ordem: 1 }] };
const itensMock = [
  { id: "D01.03.02", subcategoria: "D01.03", texto: "Cancelas de alta segurança", criticidade: "critico", padrao: "Cancela AS homologada", ordem: 1 },
  { id: "D01.03.04", subcategoria: "D01.03", texto: "Dilaceradores", criticidade: "relevante", padrao: "Dilacerador na saída", ordem: 2 },
];
jest.mock("firebase/firestore", () => ({
  getFirestore: () => ({}), doc: (...a) => ({ a }), collection: (...a) => ({ a }), query: (...a) => a, where: (...a) => a,
  getDoc: async () => ({ exists: () => true, data: () => catalogoMock }),
  getDocs: async () => ({ docs: itensMock.map((i) => ({ id: i.id, data: () => { const { id, ...r } = i; return r; } })) }),
}));

const single = { id: "sg_pxxx123", nome: "PXXX123", codigo: "", responsavel: "Marcio" };
const unid = (pref, n, ruins = {}) => Array.from({ length: n }, (_, i) => ({ id: pref + i, nome: pref.toUpperCase() + String(i + 1).padStart(2, "0"), status: ruins[i] || "operante", ...(ruins[i] ? { desde: "2026-09-20", nota: "Sem comunicação" } : {}) }));
const item = (id, nome, grupo, total, extra = {}) => ({ id, familiaId: id, nome, grupo, total, parcial: 0, inoperante: 0, falhas: [], ...extra });
const inspecao = (itens, estado = "concluida") => calcularInspecao({ id: "i1", estado, data: "2026-10-13", responsavel: "Marcio", itens });
const texto = (html) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const cenarioBase = () => [
  item("cftv_fixas", "Câmeras fixas", "CFTV e CCO", 150, { unidades: unid("cf", 150, { 0: "inoperante", 1: "inoperante", 2: "parcial" }) }),
  item("vei_dilaceradores", "Dilaceradores", "Veículos", 4, { unidades: unid("dl", 4, { 0: "inoperante" }) }),
  item("vei_cancelas", "Cancelas comuns (administrativas / acesso)", "Veículos", 6, { inoperante: 1 }),
  item("ala_panico_fixo", "Botões de pânico fixos", "Alarmes", 8, { inoperante: 1 }),
  item("ala_panico_movel", "Botões de pânico móveis", "Alarmes", 10),
];

test("perfil de barreiras sai só dos itens cadastrados (total > 0) e eclusa não conta como via", () => {
  expect(perfilDoSingle(cenarioBase())).toMatchObject({ vias: ["dilacerador"], cancelaAS: false, cancelaTransponivel: true, naoAferido: false });
  const completo = perfilDoSingle([item("vei_bollards", "Bollards / pinos", "Veículos", 5), item("vei_cancelas_as", "Cancelas de alta segurança", "Veículos", 2), item("vei_cancelas", "Cancelas comuns", "Veículos", 2), item("vei_dilaceradores", "Dilaceradores", "Veículos", 0)]);
  expect(completo.vias).toEqual(["bollard", "bolard", "pino"]);
  expect(completo).toMatchObject({ cancelaAS: true, cancelaTransponivel: false });
  const semVia = perfilDoSingle([item("ecl_garras", "Garras de tigre das eclusas", "Eclusas", 6), item("cftv_fixas", "Câmeras fixas", "CFTV e CCO", 10)]);
  expect(semVia).toMatchObject({ vias: [], naoAferido: true });
  // item personalizado é reconhecido pelo nome
  expect(perfilDoSingle([{ id: "x_1", familiaId: null, custom: true, nome: "Dilaceradores", grupo: "Personalizado", total: 3 }]).vias).toEqual(["dilacerador"]);
});

test("código do documento: código do cadastro, senão nome do cliente, senão SG+id", () => {
  expect(codigoDoSingle({ codigo: "px-9", nome: "Outro" })).toBe("PX9");
  expect(codigoDoSingle(single)).toBe("PXXX123");
  expect(codigoDoSingle({ id: "sg_ab12cd", nome: "" })).toBe("SGB12CD".slice(0, 2) + "12CD");
});

test("Modelo 1: dilacerador inoperante = 1 via → ELEVADO; cancela comum e pânico fixo não passam disso; território só contexto", async () => {
  const r = await gerarAnaliseSingle({ single, inspecao: inspecao(cenarioBase()), diagnosticos: [] });
  expect(r.modelo).toBe(1);
  expect(r.analise.geral.label).toBe("ELEVADO");
  expect(r.analise.geral.vias.n).toBe(1);
  expect(r.analise.geral.determinante.label).toBe("Dilaceradores");
  const t = texto(r.html);
  expect(t).toContain("PXXX123");expect(t).toContain("DL01");expect(t).toContain("MK-PXXX123-AR-0001");
  expect(t).toContain("não há diagnóstico territorial cadastrado");
  expect(r.html).not.toContain("class=\"ar-lg\"");expect(t).not.toContain("PXXX123 — PXXX123");
  expect(t).not.toContain("robusta");expect(t).not.toContain("-DX");
});

test("sem nenhuma barreira de via cadastrada o motor marca 'não aferido' e pânico fixo sozinho não chega a CRÍTICO", async () => {
  const r = await gerarAnaliseSingle({ single, inspecao: inspecao([item("ala_panico_fixo", "Botões de pânico fixos", "Alarmes", 8, { inoperante: 8 }), item("cftv_fixas", "Câmeras fixas", "CFTV e CCO", 20)]), diagnosticos: [] });
  expect(r.analise.geral.vias.naoAferido).toBe(true);
  expect(r.analise.geral.label).toBe("ELEVADO");
});

test("sem pendência alguma: BAIXO; vistoria em rascunho não gera", async () => {
  const ok = await gerarAnaliseSingle({ single, inspecao: inspecao([item("cftv_fixas", "Câmeras fixas", "CFTV e CCO", 20), item("vei_dilaceradores", "Dilaceradores", "Veículos", 2)]), diagnosticos: [] });
  expect(ok.analise.geral.label).toBe("BAIXO");
  await expect(gerarAnaliseSingle({ single, inspecao: inspecao(cenarioBase(), "rascunho"), diagnosticos: [] })).rejects.toThrow(/Conclua uma vistoria/);
});

test("Modelo 2: diagnóstico concluído (com cancela AS ausente) entra, só sobe o nível e vira -DX; rascunho fica de fora", async () => {
  const concluido = { id: "d1", estado: "concluido", atualizadoEm: "2026-10-13T10:00:00Z", respostas: { "D01.03.02": { status: "ausente_necessario", situacao: "Sem cancela AS", indicacao: "Instalar cancela AS" } } };
  const leve = inspecao([item("cftv_fixas", "Câmeras fixas", "CFTV e CCO", 20), item("vei_dilaceradores", "Dilaceradores", "Veículos", 2)]);
  const m2 = await gerarAnaliseSingle({ single, inspecao: leve, diagnosticos: [concluido] });
  expect(m2.modelo).toBe(2);
  expect(m2.analise.geral.label).toBe("ELEVADO"); // base BAIXO, a barreira ausente do diagnóstico sobe
  const t = texto(m2.html);
  expect(t).toContain("Modelo 2");expect(t).toContain("Instalar cancela AS");
  const m1 = await gerarAnaliseSingle({ single, inspecao: leve, diagnosticos: [{ ...concluido, estado: "rascunho" }] });
  expect(m1.modelo).toBe(1);expect(m1.analise.geral.label).toBe("BAIXO");
  const forcado = await gerarAnaliseSingle({ single, inspecao: leve, diagnosticos: [concluido], usarDiagnostico: false });
  expect(forcado.modelo).toBe(1);
});

test("fontesDoSingle: usa a vistoria concluída mais recente e diz por que o diagnóstico não entrou", () => {
  const i1 = { id: "a", estado: "concluida", data: "2026-10-01" }, i2 = { id: "b", estado: "concluida", data: "2026-10-10" }, i3 = { id: "c", estado: "rascunho", data: "2026-10-13" };
  const f = fontesDoSingle({ single, inspecoes: [i1, i3, i2], diagnosticos: [{ id: "d", estado: "rascunho", respostas: { x: { status: "conforme" } } }] });
  expect(f.vistoria.id).toBe("b");expect(f.modelo).toBe(1);expect(f.diagnostico.ok).toBe(false);expect(f.diagnostico.motivo).toContain("Concluir diagnóstico");
  expect(fontesDoSingle({ single, inspecoes: [i3], diagnosticos: [] }).vistoria).toBeNull();
  expect(fontesDoSingle({ single, inspecoes: [i1], diagnosticos: [{ id: "d", estado: "concluido", respostas: { x: { status: "conforme" } } }] }).modelo).toBe(2);
});
