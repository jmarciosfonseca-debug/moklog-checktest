import React,{act} from "react";
import {createRoot} from "react-dom/client";
const mockJPG=n=>"data:image/jpeg;base64,"+"Z".repeat(n);
const MIG=mockJPG(30), LEG=mockJPG(40), REMOVIDA=mockJPG(50);
const mockDocEquipe={colaboradores:[
  {id:"c1",nome:"Migrada Silva",cargo:"Vigilante Apoio",turno:"Diurno",status:"ativo",escala:"12x36",foto:"",fotoRef:"c1-abc",temFoto:true,historico:[],uniforme:{solicitacoes:[]}},
  {id:"c2",nome:"Legada Souza",cargo:"Vigilante Apoio",turno:"Diurno",status:"ativo",escala:"12x36",foto:LEG,historico:[],uniforme:{solicitacoes:[]}},
  {id:"c3",nome:"Removida Lima",cargo:"Vigilante Apoio",turno:"Noturno",status:"ativo",escala:"12x36",foto:REMOVIDA,temFoto:false,historico:[],uniforme:{solicitacoes:[]}},
  {id:"c4",nome:"Pendente Rocha",cargo:"Vigilante Apoio",turno:"Noturno",status:"ativo",escala:"12x36",foto:"",fotoRef:"c4-xyz",temFoto:true,historico:[],uniforme:{solicitacoes:[]}}],desligados:[]};
const mockGetDocs=jest.fn();
jest.mock("firebase/app",()=>({initializeApp:()=>({}),getApps:()=>[{}]}));
jest.mock("firebase/firestore",()=>({getFirestore:()=>({}),doc:(...a)=>({p:a.slice(1).join("/")}),collection:(...a)=>({p:a.slice(1).join("/")}),
  getDoc:async()=>({exists:()=>true,data:()=>JSON.parse(JSON.stringify(mockDocEquipe))}),getDocFromServer:async()=>({exists:()=>true,data:()=>JSON.parse(JSON.stringify(mockDocEquipe))}),
  getDocs:(...a)=>mockGetDocs(...a),query:r=>r,where:()=>({}),setDoc:jest.fn(),deleteDoc:jest.fn()}));
jest.mock("./fireGuard",()=>({setDoc:jest.fn(),deleteDoc:jest.fn()}));
const EquipeApp=require("./Equipe").default;
beforeAll(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;Object.defineProperty(global,"crypto",{value:{randomUUID:()=>"u-1"},configurable:true});});
beforeEach(()=>{mockGetDocs.mockImplementation(async ref=>{const itens=(ref&&ref.p||"").endsWith("/fotos")?[{id:"c1-abc",data:()=>({data:MIG})}]:[];return {forEach:fn=>itens.forEach(fn),docs:itens};});});
test("lista da Equipe: migrada pela referência, legada do documento, marcada sem foto NÃO aparece e pendente mostra o ícone",async()=>{
  const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<EquipeApp project={{id:"P601",nome:"Golgi Cajamar"}} onBack={()=>{}} dark sharedAuth="admin" onAuthGranted={()=>{}}/>));
    await act(async()=>{await new Promise(r=>setTimeout(r,50));});
    const srcs=[...host.querySelectorAll("img")].map(i=>i.getAttribute("src"));
    expect(host.textContent).toContain("Migrada Silva");
    expect(srcs).toContain(MIG);                  // equipes/P601/fotos/c1-abc
    expect(srcs).toContain(LEG);                  // ainda no documento principal (antes da migração)
    expect(srcs).not.toContain(REMOVIDA);         // R2/risco 3: temFoto:false nunca mostra foto, nem a legada
    expect(mockGetDocs.mock.calls.some(c=>c[0].p==="equipes/P601/fotos")).toBe(true);
    expect(host.querySelector("svg")).not.toBeNull();     // quem não tem foto (ou ainda não carregou) mostra o ícone
  }finally{await act(async()=>root.unmount());host.remove();}
});
