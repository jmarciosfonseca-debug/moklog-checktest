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
