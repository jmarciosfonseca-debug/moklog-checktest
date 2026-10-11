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

const colabs=[{id:"c1",nome:"Ana Teste",cargo:"Vigilante Apoio",turno:"Diurno",status:"ativo",escala:"12x36",historico:[],uniforme:{solicitacoes:[]}}];
const COMPLETO={tipoEquipe:"vspp",armada:"sim",ccoDedicada:"sim"};

async function montar(perfil,auth){
  mockDocEquipe={colaboradores:colabs,desligados:[],...(perfil?{perfilSeguranca:perfil}:{})};
  const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
  await act(async()=>root.render(<EquipeApp project={{id:"P601",nome:"Golgi Cajamar"}} onBack={()=>{}} dark sharedAuth={auth} onAuthGranted={()=>{}}/>));
  await act(async()=>{await new Promise(r=>setTimeout(r,50));});
  const card=()=>[...host.querySelectorAll("div")].filter(d=>d.firstElementChild&&d.firstElementChild.textContent.includes("Perfil de Segurança")).sort((a,b)=>a.textContent.length-b.textContent.length)[0].parentElement;   // o menor é o cabeçalho; o cartão é o pai
  const botao=(t)=>[...card().querySelectorAll("button")].find(b=>b.textContent.trim()===t);
  const fechar=async()=>{await act(async()=>root.unmount());host.remove();};
  return {host,card,botao,fechar,root};
}

test("admin com perfil completo: recolhido em uma linha (tipo, armada, CCO) e botão Editar",async()=>{
  const m=await montar(COMPLETO,"admin");
  try{
    const t=m.card().textContent;
    expect(t).toContain("VSPP");expect(t).toContain("Sim");
    expect(t).not.toContain("Tipo de Equipe");expect(t).not.toContain("Equipe Armada");   // opções de edição ocultas
    expect(m.card().querySelectorAll("button").length).toBe(1);                             // só o Editar
    expect(m.botao("Editar")).toBeTruthy();
  }finally{await m.fechar();}
});

test("Editar reabre as opções e Pronto recolhe de novo",async()=>{
  const m=await montar(COMPLETO,"admin");
  try{
    await act(async()=>{m.botao("Editar").click();});
    expect(m.card().textContent).toContain("Tipo de Equipe");
    expect(m.card().textContent).toContain("Equipe Armada");
    expect(m.card().textContent).toContain("CCO Dedicada");
    expect(m.botao("Pronto")).toBeTruthy();
    await act(async()=>{m.botao("Pronto").click();});
    expect(m.card().textContent).not.toContain("Equipe Armada");
    expect(m.botao("Editar")).toBeTruthy();
  }finally{await m.fechar();}
});

test("perfil incompleto (admin): mostra as opções para preencher, sem Editar",async()=>{
  const m=await montar({tipoEquipe:"vspp",armada:"",ccoDedicada:""},"admin");
  try{
    expect(m.card().textContent).toContain("Equipe Armada");
    expect(m.card().textContent).toContain("CCO Dedicada");
    expect(m.botao("Editar")).toBeFalsy();
  }finally{await m.fechar();}
});

test("sem perfil definido (admin): mostra as opções; líder vê só leitura",async()=>{
  const a=await montar(null,"admin");
  try{expect(a.card().textContent).toContain("Tipo de Equipe");}finally{await a.fechar();}
  const l=await montar(COMPLETO,"lider");
  try{
    expect(l.card().textContent).toContain("Somente leitura");
    expect(l.card().textContent).not.toContain("Equipe Armada");
    expect(l.botao("Editar")).toBeFalsy();
    expect(l.botao("Pronto")).toBeFalsy();
  }finally{await l.fechar();}
});
