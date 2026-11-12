import React,{act} from "react";
import {createRoot} from "react-dom/client";
const hist=[
  {id:"t1",tipo:"Treinamento",data:"2026-04-09",label:"Concierge"},{id:"f1",tipo:"Falta",data:"2026-08-03"},{id:"f2",tipo:"Falta",data:"2026-09-12"},
  {id:"f3",tipo:"Falta",data:"2026-09-14"},{id:"t2",tipo:"Treinamento",data:"2026-09-24",label:"Brigada"},{id:"f4",tipo:"Falta",data:"2026-10-10"},
  {id:"t3",tipo:"Treinamento",data:"2026-10-11",label:"DDS sigilo"},{id:"t4",tipo:"Treinamento",data:"2026-10-11",label:"DDS acesso"},{id:"t5",tipo:"Treinamento",data:"2026-10-11",label:"DDS incêndio"},
];
const mockDocEquipe={colaboradores:[{id:"c1",nome:"Fulano Teste",cargo:"Vigilante Apoio",turno:"Diurno",status:"ativo",escala:"12x36",foto:"",historico:hist,uniforme:{solicitacoes:[]}}],desligados:[]};
jest.mock("firebase/app",()=>({initializeApp:()=>({}),getApps:()=>[{}]}));
jest.mock("firebase/firestore",()=>({getFirestore:()=>({}),doc:(...a)=>({p:a.slice(1).join("/")}),collection:(...a)=>({p:a.slice(1).join("/")}),
  getDoc:async()=>({exists:()=>true,data:()=>JSON.parse(JSON.stringify(mockDocEquipe))}),getDocFromServer:async()=>({exists:()=>true,data:()=>JSON.parse(JSON.stringify(mockDocEquipe))}),
  getDocs:async()=>({forEach:()=>{},docs:[]}),query:r=>r,where:()=>({}),setDoc:jest.fn(),deleteDoc:jest.fn()}));
jest.mock("./fireGuard",()=>({setDoc:jest.fn(),deleteDoc:jest.fn()}));
const EquipeApp=require("./Equipe").default;
beforeAll(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;});
const clicar=async el=>{expect(el).toBeTruthy();await act(async()=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));};
test("ficha: histórico por categoria, último primeiro, 3 visíveis por grupo e 'ver mais' em cascata",async()=>{
  const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<EquipeApp project={{id:"P601",nome:"Golgi Cajamar"}} onBack={()=>{}} dark sharedAuth="admin" onAuthGranted={()=>{}}/>));
    await act(async()=>{await new Promise(r=>setTimeout(r,50));});
    const card=[...host.querySelectorAll("div")].find(d=>d.textContent.trim()==="Fulano Teste"); await clicar(card.closest("[role='button'],button,div[style*='cursor']")||card);
    await act(async()=>{await new Promise(r=>setTimeout(r,30));});
    const grupos=[...host.querySelectorAll("[data-testid^='hist-grupo-']")].map(g=>g.getAttribute("data-testid"));
    expect(grupos).toEqual(["hist-grupo-Falta","hist-grupo-Treinamento"]);
    const falta=host.querySelector("[data-testid='hist-grupo-Falta']");
    const datasFalta=[...falta.querySelectorAll("div")].map(d=>d.textContent).filter(t=>/^\d{2}\/\d{2}\/\d{4}$/.test(t)).filter((t,i,a)=>t!==a[i-1]);
    expect(datasFalta).toEqual(["10/10/2026","14/09/2026","12/09/2026"]);          // 3 últimas, mais recente primeiro
    expect(falta.textContent).toContain("Ver mais 1");
    await clicar([...falta.querySelectorAll("button")].find(b=>b.textContent.includes("Ver mais")));
    expect(host.querySelector("[data-testid='hist-grupo-Falta']").textContent).toContain("03/08/2026");
    const trein=host.querySelector("[data-testid='hist-grupo-Treinamento']");
    expect(trein.textContent).toContain("DDS sigilo"); expect(trein.textContent).not.toContain("Concierge"); // 5 no grupo → 3 visíveis
    expect(trein.textContent).toContain("Ver mais 2");
    // cascata geral: um toque abre todos os grupos; outro recolhe
    const cascata=host.querySelector("[data-testid='hist-cascata']"); expect(cascata.textContent).toContain("Ver tudo");
    await clicar(cascata);
    expect(host.querySelector("[data-testid='hist-grupo-Treinamento']").textContent).toContain("Concierge");
    expect(host.querySelector("[data-testid='hist-cascata']").textContent).toContain("Recolher");
    await clicar(host.querySelector("[data-testid='hist-cascata']"));
    expect(host.querySelector("[data-testid='hist-grupo-Treinamento']").textContent).not.toContain("Concierge");
    expect(host.querySelector("[data-testid='hist-grupo-Falta']").textContent).not.toContain("03/08/2026");
  }finally{await act(async()=>root.unmount());host.remove();}
});

test("saídas por período: 12, 24, 36 meses ou todas; mantém o índice original", () => {
  const { desligadosNoPeriodo } = require("./Equipe");
  const lista = [{ id: "a", desligadoEm: "2026-10-01" }, { id: "b", desligadoEm: "2025-06-01" }, { id: "c", desligadoEm: "2024-03-01" }, { id: "d", desligadoEm: "2021-01-01" }, { id: "e" }, null];
  const hoje = new Date("2026-11-12T12:00:00");
  const ids = (m) => desligadosNoPeriodo(lista, m, hoje).map((x) => x.c.id);
  expect(ids(12)).toEqual(["a"]); expect(ids(24)).toEqual(["a", "b"]); expect(ids(36)).toEqual(["a", "b", "c"]); expect(ids(0)).toEqual(["a", "b", "c", "d", "e"]);
  expect(desligadosNoPeriodo(lista, 24, hoje).map((x) => x.idx)).toEqual([0, 1]);
});
