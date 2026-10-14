import React,{act} from "react";
import {createRoot} from "react-dom/client";
import SingleApp from "./SingleApp";
import {calcularInspecao} from "./singleCalc";
const {executar}=require("./singleServer");
jest.mock("./singleStore",()=>({criarStore:()=>mockStore}));

const clone=x=>JSON.parse(JSON.stringify(x));
function banco(){
 const values={"usuarios/a":{active:true,role:"auditor"}};
 const snap=p=>({exists:values[p]!=null,data:()=>values[p]==null?undefined:clone(values[p])});
 const docRef=path=>({path,collection:n=>({doc:id=>docRef(path+"/"+n+"/"+id)}),get:async()=>snap(path)});
 return {values,collection:n=>({doc:id=>docRef(n+"/"+id)}),runTransaction:async fn=>{const pend=[];const r=await fn({get:async x=>snap(x.path),set:(x,d)=>pend.push([x.path,clone(d)])});pend.forEach(([p,d])=>{values[p]=d;});return r;}};
}
const ua={uid:"a",role:"auditor"};
test("servidor: diagnóstico do Single pode ser CONCLUÍDO (exige respostas) e voltar a rascunho",async()=>{
 const db=banco();
 const p=(await executar(db,ua,{acao:"criar",pid:"sg_x",revisao:0,data:{nome:"PXXX123",responsavel:"A",dataVistoria:"2026-10-13"}})).data;
 const base={acao:"diagnostico",pid:"sg_x",diagnosticoId:"d1",revisao:0,data:{catalogoId:"mestre",versaoCatalogo:"1",respostas:{"D01.03.02":{status:"conforme"}}}};
 await expect(executar(db,ua,{...base,data:{...base.data,estado:"concluido",respostas:{}}})).rejects.toMatchObject({status:400});
 await expect(executar(db,ua,{...base,data:{...base.data,estado:"qualquer"}})).rejects.toMatchObject({status:400});
 const r=await executar(db,ua,{...base,data:{...base.data,estado:"concluido"}});
 expect(r.data.estado).toBe("concluido");expect(p.id).toBe("sg_x");
 expect(db.values["diagnosticos/sg_x/itens/d1"].estado).toBe("concluido");
 // volta a rascunho ao editar e salvar como rascunho
 const r2=await executar(db,ua,{...base,revisao:r.data.revisao,data:{...base.data,estado:"rascunho"}});
 expect(r2.data.estado).toBe("rascunho");
});

const single={id:"sg_pxxx",nome:"PXXX123",responsavel:"A",estado:"ativo",revisao:2,ativos:[{id:"vei_dilaceradores",familiaId:"vei_dilaceradores",nome:"Dilaceradores",grupo:"Veículos",total:4},{id:"cftv_fixas",familiaId:"cftv_fixas",nome:"Câmeras fixas",grupo:"CFTV e CCO",total:20}]};
const mockStore={listar:jest.fn(),lerCatalogo:jest.fn(),listarInspecoes:jest.fn(),listarDiagnosticos:jest.fn(),salvarInspecao:jest.fn(),diagnosticosNovos:jest.fn()};
beforeAll(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(global,"crypto",{value:{randomUUID:()=>"test-uuid"},configurable:true});});
beforeEach(()=>{localStorage.clear();jest.clearAllMocks();
 mockStore.listar.mockResolvedValue({projetos:[single]});mockStore.lerCatalogo.mockResolvedValue({data:null});mockStore.listarInspecoes.mockResolvedValue({inspecoes:[]});
 mockStore.diagnosticosNovos.mockResolvedValue({diagnosticos:[]});mockStore.listarDiagnosticos.mockResolvedValue({diagnosticos:[]});
 mockStore.salvarInspecao.mockImplementation(async(_,i)=>({data:{...calcularInspecao(i),revisao:1}}));});
test("tela: ao salvar vistoria CONCLUÍDA abre a aba Análise de Risco e gera o PDF (Modelo 1)",async()=>{
 const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
 const escrito=[];const janela={document:{open:()=>{},write:h=>escrito.push(h),close:()=>{}},close:()=>{}};
 const abrir=jest.spyOn(window,"open").mockImplementation(()=>janela);
 const click=async t=>{const el=[...host.querySelectorAll("button")].find(b=>b.textContent.includes(t));expect(el).toBeDefined();await act(async()=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));};
 try{
  await act(async()=>root.render(<SingleApp auth={{currentUser:{uid:"a"}}} profile={{role:"auditor"}} onBack={()=>{}} onDiagnostico={()=>{}}/>));
  await click("PXXX123");
  // sem vistoria concluída a análise não é liberada
  await click("Análise de Risco");
  expect(host.textContent).toContain("nenhuma vistoria concluída");
  expect([...host.querySelectorAll("button")].find(b=>b.textContent.includes("Gerar Análise")).disabled).toBe(true);
  await click("Cenário");await click("Iniciar vistoria");
  const sel=[...host.querySelectorAll("select")].find(s=>[...s.options].some(o=>o.value==="concluida"));
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(sel,"concluida");sel.dispatchEvent(new Event("change",{bubbles:true}));});
  const inops=host.querySelectorAll("fieldset")[0].querySelectorAll("input");
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(inops[1],"1");inops[1].dispatchEvent(new Event("input",{bubbles:true}));});
  await click("Salvar vistoria");
  expect(host.textContent).toContain("Análise de Risco do Single");expect(host.textContent).toContain("Modelo 1");
   await click("Gerar Análise");
  await act(async()=>{await new Promise(r=>setTimeout(r,50));});
  expect(abrir).toHaveBeenCalled();expect(escrito.join("")).toContain("PXXX123");
  expect(host.textContent).toContain("Classe apurada");
 }finally{abrir.mockRestore();await act(async()=>root.unmount());host.remove();}
});
