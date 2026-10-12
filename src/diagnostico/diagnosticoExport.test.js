import { montarRelatorioDiagnostico, gerarDiagnosticoHTML, relatorioDiagnosticoTexto, copiaDeSegurancaRascunho, nomeArquivoDiagnostico, nomeCopiaSeguranca, numeroDiagnostico } from "./diagnosticoExport";

const catalogo = { versao: "1.0.0", categorias: [{ id: "D01", nome: "Perímetro", ordem: 1 }, { id: "D02", nome: "CFTV", ordem: 2 }], subcategorias: [{ id: "D01.01", categoria: "D01", nome: "Muros", ordem: 1 }, { id: "D02.01", categoria: "D02", nome: "Câmeras", ordem: 1 }] };
const itens = [
  { id: "D01.01.01", subcategoria: "D01.01", texto: "Muro íntegro", criticidade: "critico", ordem: 1 },
  { id: "D01.01.02", subcategoria: "D01.01", texto: "Iluminação do muro", criticidade: "relevante", ordem: 2 },
  { id: "D02.01.01", subcategoria: "D02.01", texto: "Câmeras <ok>", criticidade: "informativo", ordem: 3 },
  { id: "D02.01.02", subcategoria: "D02.01", texto: "Gravação 30 dias", criticidade: "critico", ordem: 4 },
  { id: "D02.01.99", subcategoria: "D02.01", texto: "Item antigo", criticidade: "critico", ordem: 5, deprecado: true },
];
const respostas = {
  "D01.01.01": { status: "nao_conforme", situacao: "Trecho caído", impacto: "Acesso indevido", indicacao: "Reconstruir" },
  "D01.01.02": { status: "conforme" },
  "D02.01.01": { status: "parcial", situacao: "3 de 10 sem imagem" },
  "D02.01.02": { status: "sem_dado", observacao: "Sem acesso ao gravador" },
};
const rel = () => montarRelatorioDiagnostico({ catalogo, itens, respostas, contexto: { projetoRef: "P607", grupo: "golgi" }, diagnosticoId: "d1", estado: "rascunho", geradoEm: "2026-10-12T13:00:00.000Z" });

test("números: itens depreciados fora, progresso e achados na ordem de gravidade", () => {
  const r = rel();
  expect(r).toMatchObject({ total: 4, respondidos: 4, percentual: 100, nAchados: 3, projeto: "P607" });
  expect(r.contagens).toMatchObject({ conforme: 1, nao_conforme: 1, parcial: 1, sem_dado: 1 });
  expect(r.achados.map((a) => a.id)).toEqual(["D01.01.01", "D02.01.01", "D02.01.02"]);
});
test("PDF no padrão Moked: KPIs, achados com registro de campo, texto escapado", () => {
  const h = gerarDiagnosticoHTML(rel(), { hoje: new Date("2026-10-12T10:00:00-03:00") });
  expect(h).toContain("Diagnóstico Situacional");
  expect(h).toContain("MK-DIA-P607-261012");
  expect(h).toContain("Trecho caído");
  expect(h).toContain("Reconstruir");
  expect(h).toContain("Câmeras &lt;ok&gt;");
  expect(h).not.toContain("Câmeras <ok>");
  expect(h).toContain("Itens críticos não conformes ou ausentes");
  expect(h).toContain("Muro íntegro");
  expect(h).not.toContain("Item antigo");
});
test("sem respostas: avisa em vez de dizer que está tudo conforme", () => {
  const vazio = montarRelatorioDiagnostico({ catalogo, itens, respostas: {}, contexto: { projetoRef: "P607" }, geradoEm: "2026-10-12T13:00:00.000Z" });
  const h = gerarDiagnosticoHTML(vazio);
  expect(h).toContain("Nenhum item foi respondido ainda");
  expect(h).toContain("rascunho local");
});
test("TXT traz o registro de campo", () => {
  const t = relatorioDiagnosticoTexto(rel());
  expect(t).toContain("[Não conforme] D01.01.01 - Muro íntegro");
  expect(t).toContain("Indicação: Reconstruir");
});
test("cópia de segurança guarda o rascunho inteiro sem alterá-lo", () => {
  const draft = { versao: "1.0.0", respostas, savedAt: 1 };
  const c = copiaDeSegurancaRascunho({ chave: "P607", projeto: "P607", draft, exportadoEm: "2026-10-12T13:00:00.000Z" });
  expect(c).toMatchObject({ tipo: "moklog_diagnostico_copia", chave: "P607", draft });
  expect(c.draft).toBe(draft);
  expect(nomeCopiaSeguranca("P607", "2026-10-12T13:00:00.000Z")).toBe("copia_diagnostico_P607_2026-10-12.json");
  expect(nomeArquivoDiagnostico(rel(), "txt")).toBe("diagnostico_P607_2026-10-12.txt");
  expect(numeroDiagnostico(rel())).toBe("MK-DIA-P607-261012");
});

// ── Relatório consolidado: prioridade, plano, padrão Moked, semáforo e evolução ──
import { prioridadeAchado, compararRevisoes, leituraDoDiagnostico } from "./diagnosticoExport";

test("prioridade: crítico que falha = P1; crítico parcial ou relevante que falha = P2; demais = P3; sem dado = levantar informação", () => {
  expect(prioridadeAchado("critico", "nao_conforme")).toBe(1);
  expect(prioridadeAchado("critico", "ausente_necessario")).toBe(1);
  expect(prioridadeAchado("critico", "parcial")).toBe(2);
  expect(prioridadeAchado("relevante", "nao_conforme")).toBe(2);
  expect(prioridadeAchado("relevante", "parcial")).toBe(3);
  expect(prioridadeAchado("informativo", "nao_conforme")).toBe(3);
  expect(prioridadeAchado("critico", "sem_dado")).toBe(4);
});

test("plano de ação agrupa por prioridade, mantém Indicação e deixa Responsável/prazo em branco; semáforo por categoria", () => {
  const r = rel();
  expect(r.plano.map((g) => [g.prioridade, g.itens.map((i) => i.id)])).toEqual([[1, ["D01.01.01"]], [3, ["D02.01.01"]], [4, ["D02.01.02"]]]);
  expect(r.secoes.find((s) => s.id === "D01").semaforo).toBe("critico");
  expect(r.secoes.find((s) => s.id === "D02").semaforo).toBe("observacao");
  const h = gerarDiagnosticoHTML(r);
  expect(h).toContain("Plano de ação priorizado");
  expect(h).toContain("Prioridade 1 — imediata");
  expect(h).toContain("Levantar informação");
  expect(h).toContain("Ação recomendada");
  expect(h).toContain("Responsável / prazo");
  expect(h).toContain("Situação por categoria");
  expect(h).toContain("Leitura do diagnóstico");
  expect(h).not.toContain("Evolução em relação");
});

test("padrão Moked × existente: só itens com padrão definido e já avaliados; nada de padrão inventado para os demais", () => {
  const cat = { versao: "1.0.0", categorias: [{ id: "D01", nome: "Portaria", ordem: 1 }], subcategorias: [{ id: "D01.03", categoria: "D01", nome: "Barreiras", ordem: 1 }] };
  const its = [
    { id: "D01.03.02", subcategoria: "D01.03", texto: "Cancelas de alta segurança", criticidade: "critico", ordem: 1 },
    { id: "D01.03.99", subcategoria: "D01.03", texto: "Item sem padrão", criticidade: "relevante", ordem: 2 },
    { id: "D01.03.03", subcategoria: "D01.03", texto: "Bollards", criticidade: "relevante", ordem: 3 },
  ];
  const r = montarRelatorioDiagnostico({ catalogo: cat, itens: its, respostas: { "D01.03.02": { status: "ausente_necessario", situacao: "Sem cancela AS" }, "D01.03.99": { status: "nao_conforme" }, "D01.03.03": { status: "na" } }, contexto: { projetoRef: "P505" }, geradoEm: "2026-10-12T13:00:00.000Z" });
  expect(r.padrao.map((p) => p.id)).toEqual(["D01.03.02"]);
  const h = gerarDiagnosticoHTML(r);
  expect(h).toContain("Padrão Moked × existente");
  expect(h).toContain("Cancela de alta segurança (haste reforçada");
  expect(h).toContain("Sem cancela AS");
  expect(r.plano[0].itens[0].padrao).toContain("alta segurança");
});

test("evolução entre revisões: corrigidos, melhoraram, pioraram, novos e persistem", () => {
  const its = ["a", "b", "c", "d", "e", "f"].map((x, i) => ({ id: `D01.01.0${i + 1}`, subcategoria: "D01.01", texto: `Item ${x}`, criticidade: "relevante", ordem: i + 1 }));
  const antes = { "D01.01.01": { status: "nao_conforme" }, "D01.01.02": { status: "nao_conforme" }, "D01.01.03": { status: "conforme" }, "D01.01.04": { status: "parcial" }, "D01.01.05": { status: "sem_dado" } };
  const agora = { "D01.01.01": { status: "conforme" }, "D01.01.02": { status: "parcial" }, "D01.01.03": { status: "nao_conforme" }, "D01.01.04": { status: "parcial" }, "D01.01.05": { status: "parcial" }, "D01.01.06": { status: "nao_conforme" } };
  const g = compararRevisoes(its, agora, antes);
  expect(g.corrigidos.map((i) => i.id)).toEqual(["D01.01.01"]);
  expect(g.melhoraram.map((i) => i.id)).toEqual(["D01.01.02"]);
  expect(g.pioraram.map((i) => i.id)).toEqual(["D01.01.03"]);
  expect(g.persistem.map((i) => i.id)).toEqual(["D01.01.04"]);
  expect(g.novos.map((i) => i.id).sort()).toEqual(["D01.01.05", "D01.01.06"]);
  const cat = { versao: "1.0.0", categorias: [{ id: "D01", nome: "Perímetro", ordem: 1 }], subcategorias: [{ id: "D01.01", categoria: "D01", nome: "Muros", ordem: 1 }] };
  const r = montarRelatorioDiagnostico({ catalogo: cat, itens: its, respostas: agora, contexto: { projetoRef: "P601" }, geradoEm: "2026-10-12T13:00:00.000Z", anterior: { respostas: antes, rotulo: "Revisão 1", data: "01/10/2026" }, rotuloRevisao: "Revisão 2" });
  const h = gerarDiagnosticoHTML(r);
  expect(h).toContain("Evolução em relação à Revisão 1");
  expect(h).toContain("Revisão 2");
  expect(leituraDoDiagnostico(r).join(" ")).toContain("1 corrigido(s)");
  expect(relatorioDiagnosticoTexto(r)).toContain("EVOLUÇÃO EM RELAÇÃO À REVISÃO 1");
});
