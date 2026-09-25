import { criarDiagnosticoId, deveBuscarDiagnosticoRemoto, mergeRespostasPorAtualizacao, normalizarAtualizacao } from "./diagnosticoSync";

test("não tenta ler um diagnóstico remoto antes da primeira gravação",()=>{
  expect(deveBuscarDiagnosticoRemoto(null)).toBe(false);
  expect(deveBuscarDiagnosticoRemoto("")).toBe(false);
  expect(deveBuscarDiagnosticoRemoto("diag-existente")).toBe(true);
});

test("mantém um id estável gerado pela API do navegador",()=>{
  expect(criarDiagnosticoId({randomUUID:()=>"uuid-fixo"})).toBe("uuid-fixo");
});

test("compara corretamente timestamps numéricos e ISO",()=>{
  expect(normalizarAtualizacao(200)).toBe(200);
  expect(normalizarAtualizacao("1970-01-01T00:00:00.100Z")).toBe(100);
  const merged=mergeRespostasPorAtualizacao(
    {item:{status:"conforme",updatedAt:200}},
    {item:{status:"parcial",updatedAt:100}},
  );
  expect(merged.item.status).toBe("conforme");
});
