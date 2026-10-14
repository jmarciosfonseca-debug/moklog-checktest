import React,{act} from "react";
import {createRoot} from "react-dom/client";
import SingleApp,{chaveNome} from "./SingleApp";
const {executar}=require("./singleServer");
jest.mock("./singleStore",()=>({criarStore:()=>mockStore}));

const clone=x=>JSON.parse(JSON.stringify(x));
// Banco em memória com subcoleções, listDocuments, limit/get e transação com várias gravações.
function banco(init){
 const values={"usuarios/a":{active:true,role:"auditor"},"usuarios/b":{active:true,role:"auditor"},...init};
 const snap=p=>({exists:values[p]!=null,data:()=>values[p]==null?undefined:clone(values[p])});
 const colecao=base=>({
  doc:id=>docRef(base+"/"+id),
  limit:()=>({get:async()=>({docs:Object.keys(values).filter(k=>k.startsWith(base+"/")&&!k.slice(base.length+1).includes("/")).map(k=>({id:k.slice(base.length+1),data:()=>clone(values[k])}))})}),
  listDocuments:async()=>[...new Set(Object.keys(values).filter(k=>k.startsWith(base+"/")).map(k=>k.slice(base.length+1).split("/")[0]))].map(id=>docRef(base+"/"+id)),
 });
 const docRef=path=>({path,id:path.split("/").pop(),collection:n=>colecao(path+"/"+n),get:async()=>snap(path)});
 return {values,collection:n=>colecao(n),runTransaction:async fn=>{const pend=[];const r=await fn({get:async x=>snap(x.path),set:(x,d)=>pend.push([x.path,clone(d)])});pend.forEach(([p,d])=>{values[p]=d;});return r;}};
}
const ua={uid:"a",role:"auditor"},ub={uid:"b",role:"auditor"};
const resp={"1.1":{status:"parcial",situacao:"CFTV com pontos cegos"},"1.2":{status:"conforme"}};
const chave="novo_a_pxxx123_abc";
const origem=()=>({[`diagnosticos/${chave}/itens/seg`]:{tipo:"novo",rotuloLivre:"PXXX123",estado:"rascunho",respostas:resp,autorUid:"a",atualizadoEm:"2026-10-10T10:00:00Z",catalogoId:"mestre",versaoCatalogo:"1"},
 "diagnosticos/novo_b_outro_x/itens/seg":{tipo:"novo",rotuloLivre:"Outro",estado:"rascunho",respostas:resp,autorUid:"b"}});
const criar=db=>executar(db,ua,{acao:"criar",pid:"sg_pxxx",revisao:0,data:{nome:"PXXX 123",responsavel:"A",dataVistoria:"2026-10-13"}});

test("chaveNome ignora acento, caixa, espaço e pontuação",()=>{
 expect(chaveNome("PXXX 123")).toBe(chaveNome("pxxx-123"));expect(chaveNome("Condomínio São José")).toBe("condominiosaojose");expect(chaveNome("  ")).toBe("");
});
test("diagnosticos_novos lista só os diagnósticos do próprio usuário",async()=>{
 const db=banco(origem());
 const r=await executar(db,ua,{acao:"diagnosticos_novos"});
 expect(r.diagnosticos).toHaveLength(1);
 expect(r.diagnosticos[0]).toMatchObject({chave,rotuloLivre:"PXXX123",itens:[{id:"seg",estado:"rascunho",respondidos:2}]});
 expect((await executar(db,ub,{acao:"diagnosticos_novos"})).diagnosticos[0].rotuloLivre).toBe("Outro");
});
test("importar_diagnostico copia as respostas para o Single e registra a origem",async()=>{
 const db=banco(origem());const p=(await criar(db)).data;
 const r=await executar(db,ua,{acao:"importar_diagnostico",pid:p.id,chave,revisao:p.revisao});
 expect(r.importados).toBe(1);
 expect(r.data.diagnosticoImportado).toMatchObject({chave,rotuloLivre:"PXXX123",itens:1});expect(r.data.revisao).toBe(p.revisao+1);
 const copia=db.values["diagnosticos/sg_pxxx/itens/seg"];
 expect(copia).toMatchObject({tipo:"novo",estado:"rascunho",importadoDe:chave,autorUid:"a",rotuloLivre:"PXXX 123"});
 expect(copia.respostas["1.1"]).toMatchObject({status:"parcial",situacao:"CFTV com pontos cegos"});
 expect(db.values[`diagnosticos/${chave}/itens/seg`].respostas).toEqual(resp); // origem intacta
 await expect(executar(db,ua,{acao:"importar_diagnostico",pid:p.id,chave,revisao:r.data.revisao})).rejects.toMatchObject({status:409});
});
test("importar_diagnostico recusa chave de outro usuário, revisão velha e origem vazia",async()=>{
 const db=banco({...origem(),"diagnosticos/novo_a_vazio_z/itens/seg":{tipo:"novo",rotuloLivre:"Vazio",respostas:{},autorUid:"a"}});const p=(await criar(db)).data;
 await expect(executar(db,ua,{acao:"importar_diagnostico",pid:p.id,chave:"novo_b_outro_x",revisao:p.revisao})).rejects.toMatchObject({status:403});
 await expect(executar(db,ua,{acao:"importar_diagnostico",pid:p.id,chave,revisao:p.revisao-1})).rejects.toMatchObject({status:409});
 await expect(executar(db,ua,{acao:"importar_diagnostico",pid:p.id,chave:"novo_a_vazio_z",revisao:p.revisao})).rejects.toMatchObject({status:404});
 await expect(executar(db,ub,{acao:"importar_diagnostico",pid:p.id,chave,revisao:p.revisao})).rejects.toMatchObject({status:403});
 await expect(executar(db,ua,{acao:"importar_diagnostico",pid:"x_1",chave,revisao:1})).rejects.toMatchObject({status:400});
});

const base={id:"sg_pxxx",nome:"PXXX 123",responsavel:"A",estado:"ativo",revisao:1,ativos:[]};
const mockStore={listar:jest.fn(),lerCatalogo:jest.fn(),listarInspecoes:jest.fn(),criarSingle:jest.fn(),diagnosticosNovos:jest.fn(),importarDiagnostico:jest.fn()};
beforeAll(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(global,"crypto",{value:{randomUUID:()=>"u"},configurable:true});});
beforeEach(()=>{localStorage.clear();jest.clearAllMocks();
 mockStore.listar.mockResolvedValue({projetos:[]});mockStore.lerCatalogo.mockResolvedValue({data:null});mockStore.listarInspecoes.mockResolvedValue({inspecoes:[]});
 mockStore.diagnosticosNovos.mockResolvedValue({diagnostico:[],diagnosticos:[{chave,rotuloLivre:"PXXX123",itens:[{id:"seg",estado:"rascunho",atualizadoEm:"",respondidos:2}]}]});
 mockStore.criarSingle.mockResolvedValue({data:base});
 mockStore.importarDiagnostico.mockImplementation(async p=>({data:{...p,revisao:p.revisao+1,diagnosticoImportado:{chave,rotuloLivre:"PXXX123",em:"2026-10-13T12:00:00Z",itens:1}},importados:1}));});
async function montar(fn){
 const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
 const set=async(el,v)=>{await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,v);el.dispatchEvent(new Event("input",{bubbles:true}));});};
 const click=async t=>{const el=[...host.querySelectorAll("button")].find(b=>b.textContent.includes(t));expect(el).toBeDefined();await act(async()=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));};
 try{await act(async()=>root.render(<SingleApp auth={{currentUser:{uid:"a"}}} profile={{role:"auditor"}} onBack={()=>{}} onDiagnostico={()=>{}}/>));await fn({host,set,click});}
 finally{await act(async()=>root.unmount());host.remove();}
}
test("tela: ao digitar o mesmo nome do diagnóstico, avisa e importa ao criar o Single",async()=>{
 mockStore.listar.mockResolvedValueOnce({projetos:[]}).mockResolvedValue({projetos:[{...base,revisao:2,diagnosticoImportado:{chave,rotuloLivre:"PXXX123",em:"2026-10-13T12:00:00Z",itens:1}}]});
 await montar(async({host,set,click})=>{
  const nome=host.querySelector("form input");
  expect(host.textContent).not.toContain("Encontrei o diagnóstico");
  await set(nome,"pxxx 123");expect(host.textContent).toContain("Encontrei o diagnóstico de PXXX123");expect(host.textContent).toContain("2 resposta(s)");
  await click("Criar projeto");
  expect(mockStore.importarDiagnostico).toHaveBeenCalledWith(expect.objectContaining({id:"sg_pxxx"}),chave);
  expect(host.textContent).toContain("importado");
 });
});
test("tela: desmarcar a caixa cria o Single sem importar",async()=>{
 await montar(async({host,set,click})=>{
  await set(host.querySelector("form input"),"PXXX123");
  await act(async()=>host.querySelector('input[type="checkbox"]').dispatchEvent(new MouseEvent("click",{bubbles:true})));
  await click("Criar projeto");
  expect(mockStore.criarSingle).toHaveBeenCalled();expect(mockStore.importarDiagnostico).not.toHaveBeenCalled();
 });
});
test("tela: nome sem diagnóstico correspondente não mostra aviso; falha ao listar não quebra",async()=>{
 await montar(async({host,set})=>{await set(host.querySelector("form input"),"Cliente Novo");expect(host.textContent).not.toContain("Encontrei o diagnóstico");});
 mockStore.diagnosticosNovos.mockRejectedValue(new Error("falha"));
 await montar(async({host,set})=>{await set(host.querySelector("form input"),"PXXX123");expect(host.textContent).not.toContain("Encontrei");expect(host.textContent).not.toContain("falha");});
});
