import React,{act} from "react";
import {createRoot} from "react-dom/client";
let mockDocEquipe={};
jest.mock("firebase/app",()=>({initializeApp:()=>({}),getApps:()=>[{}]}));
jest.mock("firebase/firestore",()=>({getFirestore:()=>({}),doc:(...a)=>({p:a.slice(1).join("/")}),collection:(...a)=>({p:a.slice(1).join("/")}),
  getDoc:async()=>({exists:()=>true,data:()=>JSON.parse(JSON.stringify(mockDocEquipe))}),getDocFromServer:async()=>({exists:()=>true,data:()=>JSON.parse(JSON.stringify(mockDocEquipe))}),
  getDocs:async()=>({forEach:()=>{},docs:[]}),query:r=>r,where:()=>({}),setDoc:jest.fn(),deleteDoc:jest.fn()}));
jest.mock("./fireGuard",()=>({setDoc:jest.fn(),deleteDoc:jest.fn()}));
const EquipeApp=require("./Equipe").default;
beforeAll(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(global,"crypto",{value:{randomUUID:()=>"u-1"},configurable:true});});

// Abre "Adicionar" no projeto informado e devolve as opções do campo Cargo.
async function cargosDoCadastro(pid){
  mockDocEquipe={colaboradores:[{id:"c1",nome:"Ana Teste",cargo:"VSPP Apoio",turno:"Diurno",status:"ativo",escala:"12x36",historico:[],uniforme:{solicitacoes:[]}}],desligados:[]};
  const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<EquipeApp project={{id:pid,name:"Teste"}} onBack={()=>{}} dark sharedAuth="admin" onAuthGranted={()=>{}}/>));
    await act(async()=>{await new Promise(r=>setTimeout(r,50));});
    const add=[...host.querySelectorAll("button")].find(b=>b.textContent.trim()==="+ Cadastrar Colaborador");
    expect(add).toBeTruthy();
    await act(async()=>{add.click();});
    const sel=[...host.querySelectorAll("select")].find(s=>[...s.options].some(o=>/VSPP|Vigilante|Vig CCO/.test(o.textContent)));
    expect(sel).toBeTruthy();
    return {opcoes:[...sel.options].map(o=>o.textContent),padrao:sel.value};
  }finally{await act(async()=>root.unmount());host.remove();}
}

test("P260C: Vigilante é cargo cadastrável, sem tirar os demais nem mudar o padrão",async()=>{
  const r=await cargosDoCadastro("P260C");
  expect(r.opcoes).toEqual(["VSPP Líder","VSPP Apoio","Vigilante","Vig CCO","Cão de Guarda"]);
  expect(r.padrao).toBe("VSPP Líder");
});

test("outros projetos seguem com a lista que já tinham (P260B sem Vigilante)",async()=>{
  const r=await cargosDoCadastro("P260B");
  expect(r.opcoes).toEqual(["VSPP Líder","VSPP Apoio","Vig CCO"]);
});
