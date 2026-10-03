import React,{act} from "react";
import {createRoot} from "react-dom/client";
import SingleApp from "./SingleApp";
jest.mock("./singleStore",()=>({criarStore:()=>mockStore}));
const ativos=[{id:"cftv_cameras",familiaId:"cftv_cameras",nome:"CFTV",grupo:"CFTV e CCO",total:100}];
const p={id:"sg_teste",nome:"Condomínio Teste",responsavel:"T",estado:"ativo",revisao:3,ativos};
const mockStore={listar:jest.fn(),lerCatalogo:jest.fn(),listarInspecoes:jest.fn()};
const KEY="single:v1:u:sg_teste";
beforeAll(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(global,"crypto",{value:{randomUUID:()=>"test-uuid"},configurable:true});});
beforeEach(()=>{jest.restoreAllMocks();localStorage.clear();jest.clearAllMocks();mockStore.listar.mockResolvedValue({projetos:[p]});mockStore.lerCatalogo.mockResolvedValue({data:null});mockStore.listarInspecoes.mockResolvedValue({inspecoes:[]});});
async function abrir(){
 const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
 await act(async()=>root.render(<SingleApp auth={{currentUser:{uid:"u"}}} profile={{role:"auditor"}} onBack={()=>{}} onDiagnostico={()=>{}}/>));
 const b=[...host.querySelectorAll("button")].find(x=>x.textContent.includes("Condomínio Teste"));
 await act(async()=>b.dispatchEvent(new MouseEvent("click",{bubbles:true})));
 return {host,fechar:async()=>{await act(async()=>root.unmount());host.remove();}};
}
test("rascunho de revisão antiga NÃO sobrepõe o servidor e vira cópia de conflito",async()=>{
 localStorage.setItem(KEY,JSON.stringify({project:{...p,revisao:1,ativos:[]},assets:[{id:"cftv_cameras",familiaId:"cftv_cameras",nome:"CFTV",grupo:"CFTV e CCO",total:7}],inspection:null}));
 const {host,fechar}=await abrir();
 try{
  expect(host.textContent).toContain("O projeto mudou no servidor");
  expect([...host.querySelectorAll("input")].some(i=>i.value==="100")).toBe(true);     // cenário do servidor
  expect([...host.querySelectorAll("input")].some(i=>i.value==="7")).toBe(false);      // não o rascunho antigo
  expect(Object.keys(localStorage).some(k=>k.startsWith(KEY+":conflito:"))).toBe(true); // nada foi descartado
 }finally{await fechar();}
});
test("rascunho da MESMA revisão é recuperado",async()=>{
 localStorage.setItem(KEY,JSON.stringify({project:p,assets:[{id:"cftv_cameras",familiaId:"cftv_cameras",nome:"CFTV",grupo:"CFTV e CCO",total:7}],inspection:null}));
 const {host,fechar}=await abrir();
 try{expect(host.textContent).toContain("Rascunho local recuperado");expect([...host.querySelectorAll("input")].some(i=>i.value==="7")).toBe(true);
  expect(Object.keys(localStorage).some(k=>k.includes(":conflito:"))).toBe(false);}finally{await fechar();}
});
test("vistoria alterada em outro aparelho também invalida rascunho com projeto na mesma revisão",async()=>{
 localStorage.setItem(KEY,JSON.stringify({project:p,assets:ativos,inspection:{id:"i1",revisao:1,itens:[]}}));
 mockStore.listarInspecoes.mockResolvedValue({inspecoes:[{id:"i1",revisao:2,data:"2026-10-03",itens:[]}]});
 const {host,fechar}=await abrir();
 try{expect(host.textContent).toContain("O projeto mudou no servidor");expect(Object.keys(localStorage).some(k=>k.startsWith(KEY+":conflito:"))).toBe(true);}finally{await fechar();}
});
test("se a cópia de conflito falhar, não sobrescreve o rascunho original",async()=>{
 const original=JSON.stringify({project:{...p,revisao:1},assets:[],inspection:null});localStorage.setItem(KEY,original);
 jest.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("QuotaExceeded");});
 const {host,fechar}=await abrir();
 try{expect(host.textContent).toContain("Não foi possível preservar a cópia local");expect(localStorage.getItem(KEY)).toBe(original);}finally{await fechar();}
});
