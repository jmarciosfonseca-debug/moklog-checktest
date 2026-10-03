import React,{act} from "react";
import {createRoot} from "react-dom/client";
const mockGetDoc=jest.fn();
jest.mock("firebase/app",()=>({initializeApp:()=>({}),getApps:()=>[{}]}));
jest.mock("firebase/firestore",()=>({getFirestore:()=>({}),doc:(...a)=>a.join("/"),getDoc:(...a)=>mockGetDoc(...a),getDocFromServer:jest.fn(),collection:jest.fn(),getDocs:jest.fn(),query:jest.fn(),where:jest.fn(),setDoc:jest.fn(),deleteDoc:jest.fn()}));
const {ContadorEquipe}=require("./Equipe");
beforeAll(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;});
beforeEach(()=>{jest.useFakeTimers();mockGetDoc.mockReset();mockGetDoc.mockResolvedValue({exists:()=>true,data:()=>({colaboradores:[],checagemEquipe:null})});localStorage.clear();});
afterEach(()=>{jest.useRealTimers();});
async function montar(dia){
  jest.setSystemTime(dia);
  const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
  await act(async()=>root.render(<ContadorEquipe projectId="P601"/>));
  return {host,fechar:async()=>{await act(async()=>root.unmount());host.remove();}};
}
test("em dia de semana NÃO baixa o documento da equipe e não mostra nada",async()=>{
  const {host,fechar}=await montar(new Date(2026,9,7,12));      // quarta-feira
  try{expect(mockGetDoc).not.toHaveBeenCalled();expect(host.textContent).toBe("");}finally{await fechar();}
});
test("no sábado baixa uma vez e mostra o contador sem contagem regressiva",async()=>{
  const {host,fechar}=await montar(new Date(2026,9,3,10));      // sábado
  try{expect(mockGetDoc).toHaveBeenCalledTimes(1);expect(host.textContent).toContain("Checar a equipe");expect(host.textContent).toContain("0/4");expect(host.textContent).toContain("fecha dom 23:59");expect(host.textContent).not.toMatch(/\dh \d+min/);}finally{await fechar();}
});
test("avançar 10 minutos não dispara novas leituras nem re-renderiza por relógio",async()=>{
  const {fechar}=await montar(new Date(2026,9,3,10));
  try{await act(async()=>{jest.advanceTimersByTime(10*60*1000);});expect(mockGetDoc).toHaveBeenCalledTimes(1);}finally{await fechar();}
});
