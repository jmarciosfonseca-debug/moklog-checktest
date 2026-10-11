import React,{act} from "react";
import {createRoot} from "react-dom/client";
const mockRegs=[
  {id:"a",data:"2026-09-01",hora:"10:00",turno:"Diurno",placa:"AAA1A11"},
  {id:"b",data:"2026-10-05",hora:"23:30",turno:"Noturno",placa:"BBB2B22"},
  {id:"c",data:"2026-10-10",hora:"02:10",turno:"Noturno",placa:"CCC3C33"}];
jest.mock("firebase/app",()=>({initializeApp:()=>({}),getApps:()=>[{}]}));
jest.mock("firebase/firestore",()=>({getFirestore:()=>({}),doc:(...a)=>({p:a.slice(1).join("/")}),collection:(...a)=>({p:a.slice(1).join("/")}),
  getDoc:async()=>({exists:()=>true,data:()=>({registros:[]})}),getDocFromServer:async()=>({exists:()=>true,data:()=>({registros:[]})}),
  getDocs:async()=>({docs:mockRegs.map(r=>({id:r.id,data:()=>({...r})}))}),getDocsFromServer:async()=>({docs:mockRegs.map(r=>({id:r.id,data:()=>({...r})}))}),query:r=>r,where:()=>({}),setDoc:jest.fn(),deleteDoc:jest.fn(),onSnapshot:()=>()=>{}}));
jest.mock("./fireGuard",()=>({setDoc:jest.fn(),deleteDoc:jest.fn()}));
const Ambulancia=require("./Ambulancia").default;
beforeAll(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;});
test("contador da Ambulância se chama TOTAL HISTÓRICO e não 'TOTAL' solto",async()=>{
  const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<Ambulancia project={{id:"P311B",nome:"Mega Itajaí"}} onBack={()=>{}} dark sharedAuth="admin" onAuthGranted={()=>{}}/>));
    await act(async()=>{await new Promise(r=>setTimeout(r,80));});
    const t=host.textContent;
    expect(t).toContain("TOTAL HISTÓRICO");
    expect(t).toContain("3TOTAL HISTÓRICO1DIURNO2NOTURNO");   // soma de todo o histórico, diurno + noturno = total
    expect(/(^|[^A-Z])TOTAL(?! HISTÓRICO)/.test(t)).toBe(false);
  }finally{await act(async()=>root.unmount());host.remove();}
});
