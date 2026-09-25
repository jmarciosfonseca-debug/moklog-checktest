import { criarPdfDiagnostico, montarRelatorioDiagnostico, nomeArquivoDiagnostico, relatorioDiagnosticoTexto } from "./diagnosticoExport";
import fs from "fs";
import path from "path";
import { TextDecoder, TextEncoder } from "util";

global.TextEncoder=TextEncoder;
global.TextDecoder=TextDecoder;

const fixture=()=>montarRelatorioDiagnostico({
  catalogo:{id:"cat",versao:"1.0.0",categorias:[{id:"D01",nome:"Gestão",ordem:1}],subcategorias:[{id:"D01.01",nome:"Governança",categoria:"D01",ordem:1}]},
  itens:[{id:"D01.01.01",texto:"Política documentada e vigente",subcategoria:"D01.01",ordem:1,criticidade:"critico"},{id:"D01.01.02",texto:"Indicadores revisados",subcategoria:"D01.01",ordem:2}],
  respostas:{"D01.01.01":{status:"conforme",updatedAt:1},"D01.01.02":{status:"parcial",situacao:"Revisão atrasada",impacto:"Decisão sem dado atual",indicacao:"Atualizar mensalmente",updatedAt:2}},
  contexto:{tipo:"existente",projetoRef:"P607",grupo:"golgi"},diagnosticoId:"diag-1",geradoEm:"2026-09-25T12:00:00.000Z",
});

test("monta resumo e texto completo do diagnóstico",()=>{const r=fixture();expect(r.percentual).toBe(100);expect(r.achados).toBe(1);expect(relatorioDiagnosticoTexto(r)).toContain("Indicação: Atualizar mensalmente");expect(nomeArquivoDiagnostico(r,"pdf")).toBe("diagnostico_P607_2026-09-25.pdf");});
test("gera PDF verdadeiro com múltiplos blocos",async()=>{const pdf=await criarPdfDiagnostico(fixture());const bytes=new Uint8Array(pdf.output("arraybuffer"));expect(bytes.slice(0,4)).toEqual(new Uint8Array([37,80,68,70]));expect(bytes.length).toBeGreaterThan(3000);});

test("gera amostra visual representativa quando solicitado",async()=>{
  if(process.env.WRITE_DIAGNOSTICO_PDF_SAMPLE!=="1")return;
  const base=fixture();
  const itens=Array.from({length:36},(_,index)=>({
    id:`D01.01.${String(index+1).padStart(2,"0")}`,
    texto:`Controle operacional ${index+1} documentado, aplicado e acompanhado pela liderança do projeto`,
    subcategoria:"D01.01",ordem:index+1,criticidade:index%4===0?"critico":"relevante",
  }));
  const respostas=Object.fromEntries(itens.map((item,index)=>[item.id,index%5===0?{
    status:"parcial",situacao:"Evidência disponível, mas a revisão do período ainda não foi concluída.",impacto:"Pode reduzir a rastreabilidade da decisão operacional.",indicacao:"Concluir a revisão, anexar a evidência e registrar o responsável.",
  }:{status:"conforme"}]));
  const relatorio=montarRelatorioDiagnostico({
    catalogo:{id:"centro_logistico_v1_0_0",versao:"1.0.0",categorias:[{id:"D01",nome:"Gestão e controles operacionais",ordem:1}],subcategorias:[{id:"D01.01",nome:"Governança, evidências e melhoria contínua",categoria:"D01",ordem:1}]},
    itens,respostas,contexto:{projetoRef:"P607",grupo:"golgi"},diagnosticoId:"amostra-p607",geradoEm:"2026-09-25T12:00:00.000Z",
  });
  const pdf=await criarPdfDiagnostico(relatorio);
  const destino=path.resolve(process.cwd(),"output/pdf/diagnostico_situacional_exemplo.pdf");
  fs.mkdirSync(path.dirname(destino),{recursive:true});
  fs.writeFileSync(destino,Buffer.from(pdf.output("arraybuffer")));
  expect(fs.statSync(destino).size).toBeGreaterThan(5000);
});
