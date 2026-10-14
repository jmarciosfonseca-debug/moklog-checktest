import React,{act} from "react";
import {createRoot} from "react-dom/client";
import SingleApp from "./SingleApp";
import {htmlSingle} from "./pdfSingle";
import {singleComoProjeto} from "./singleAdaptador";
import {calcularInspecao} from "./singleCalc";
import {lerDraft,salvarDraft} from "./singleDraft";
jest.mock("./singleStore",()=>({criarStore:()=>mockStore}));
const p={id:"sg_teste",nome:"Condomínio Teste",responsavel:"Teste",estado:"ativo",revisao:2,ativos:[{id:"cftv_cameras",familiaId:"cftv_cameras",nome:"CFTV",grupo:"CFTV",total:100},{id:"ped_torniquetes",familiaId:"ped_torniquetes",nome:"Torniquetes",grupo:"Pedestres",total:8}]};
const mockStore={listar:jest.fn(async()=>({projetos:[p]})),lerCatalogo:jest.fn(async()=>({data:null})),listarInspecoes:jest.fn(async()=>({inspecoes:[]})),arquivar:jest.fn(),excluir:jest.fn(),salvarInspecao:jest.fn(async(_,i)=>({data:{...calcularInspecao(i),revisao:1}}))};
beforeAll(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(global,"crypto",{value:{randomUUID:()=>"test-uuid"},configurable:true});});
beforeEach(()=>{localStorage.clear();jest.clearAllMocks();mockStore.listar.mockResolvedValue({projetos:[p]});mockStore.lerCatalogo.mockResolvedValue({data:null});mockStore.listarInspecoes.mockResolvedValue({inspecoes:[]});mockStore.salvarInspecao.mockImplementation(async(_,i)=>({data:{...calcularInspecao(i),revisao:1}}));});
test("tela abre cenário, calcula 90% e 87,5%, rejeita excesso e salva uma vistoria",async()=>{
 const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
 const click=async t=>{const el=[...host.querySelectorAll("button")].find(b=>b.textContent.includes(t));expect(el).toBeDefined();await act(async()=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));};
 try{
 await act(async()=>root.render(<SingleApp auth={{currentUser:{uid:"u"}}} profile={{role:"auditor"}} onBack={()=>{}} onDiagnostico={()=>{}}/>));
 await click("Condomínio Teste");await click("Preencher a vistoria");
 const set=async(el,v)=>{await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,v);el.dispatchEvent(new Event("input",{bubbles:true}));});};
 const fs=[...host.querySelectorAll("fieldset")];const a=fs[0].querySelectorAll("input");
 await set(a[0],"4");await set(a[1],"6");await set(fs[1].querySelectorAll("input")[1],"1");
 expect(host.textContent).toContain("90,0%");expect(host.textContent).toContain("87,5%");
 await click("Salvar vistoria");expect(mockStore.salvarInspecao).toHaveBeenCalledTimes(1);
 await set(a[1],"100");expect(host.textContent).toContain("não pode ultrapassar");
 expect([...host.querySelectorAll("button")].find(x=>x.textContent==="Salvar vistoria").disabled).toBe(true);
 expect(localStorage.length).toBeGreaterThan(0);
 }finally{await act(async()=>root.unmount());host.remove();}
});
test("PDF escapa HTML, usa cálculo único e inclui introdução/logo/falhas",()=>{
 const i={id:"i",data:"2026-10-03",itens:[{id:"c",familiaId:"cftv_cameras",nome:"CFTV",total:100,parcial:4,inoperante:6,falhas:[{qtd:6,descricao:"<script>bad()</script>",criticidade:"alta",desde:"2026-10-02"}]}]};
 const html=htmlSingle({nome:"<Cliente>",id:"sg_test"},i);
 expect(html).toContain("90,0%");expect(html).toContain("Contexto da verificação");expect(html).toContain("Moked 30 anos");
 expect(html).not.toContain("<script>bad");expect(html).toContain("&lt;Cliente&gt;");
 const a=singleComoProjeto({id:"sg_test",nome:"Cliente"},i);
 expect(a.project.categories[0].label).toBe("CFTV");
 expect(a.stored.sg_test.history[0].state.c.inoperative).toHaveLength(6);
 expect(a.stored.sg_test.history[0].state.c.partial).toHaveLength(4);
});
test("rascunho inválido e armazenamento cheio não quebram a tela",()=>{
 expect(lerDraft({getItem:()=>"{invalido"},"k")).toBeNull();
 expect(salvarDraft({setItem:()=>{throw Error();}},"k",{})).toBe(false);
});

test("ações do projeto: exportar HTML, arquivar e apagar (só gerente)",async()=>{
 const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
 const btn=t=>[...host.querySelectorAll("button")].find(b=>b.textContent===t);
 const click=async t=>{expect(btn(t)).toBeDefined();await act(async()=>btn(t).dispatchEvent(new MouseEvent("click",{bubbles:true})));};
 const confirmar=jest.spyOn(window,"confirm").mockReturnValue(true);
 mockStore.excluir.mockResolvedValue({excluido:p.id});
 mockStore.arquivar.mockResolvedValue({data:{...p,estado:"arquivado",revisao:3}});
 mockStore.listarInspecoes.mockResolvedValue({inspecoes:[{id:"i1",revisao:1,estado:"concluida",tipo:"situacional",data:"2026-10-03",responsavel:"T",observacoes:"",itens:[{id:"cftv_cameras",familiaId:"cftv_cameras",nome:"CFTV",grupo:"CFTV",total:100,parcial:4,inoperante:6,falhas:[]}]}]});
 const baixar=jest.fn();const orig=URL.createObjectURL;URL.createObjectURL=()=> "blob:x";URL.revokeObjectURL=()=>{};
 const click0=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){baixar(this.download);};
 try{
  await act(async()=>root.render(<SingleApp auth={{currentUser:{uid:"u"}}} profile={{role:"auditor"}} onBack={()=>{}} onDiagnostico={()=>{}}/>));
  await click("Condomínio Teste · ativo");
  expect(btn("Apagar")).toBeUndefined();                                   // auditor não vê Apagar
  await click("Exportar HTML");expect(baixar).toHaveBeenCalledWith(expect.stringMatching(/^Relatorio-Single-Condominio-Teste-2026-10-03\.html$/));
  await click("Arquivar");expect(mockStore.arquivar).toHaveBeenCalledTimes(1);
  await act(async()=>root.unmount());
  const root2=createRoot(host);
  await act(async()=>root2.render(<SingleApp auth={{currentUser:{uid:"g"}}} profile={{role:"gerente"}} onBack={()=>{}} onDiagnostico={()=>{}}/>));
  await click("Condomínio Teste · ativo");
  await click("Apagar");
  expect(confirmar).toHaveBeenCalled();expect(mockStore.excluir).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("Single apagado");expect(host.textContent).not.toContain("Condomínio Teste · ativo");
  await act(async()=>root2.unmount());
 }finally{HTMLAnchorElement.prototype.click=click0;URL.createObjectURL=orig;confirmar.mockRestore();host.remove();}
});
