import React,{act} from "react";
import {createRoot} from "react-dom/client";
import {chkEqNumCheckins,chkEqSlots,chkEqFeitos,checagemEquipeAplica} from "./checagemEquipeRegras";
const mockGetDoc=jest.fn();
jest.mock("firebase/app",()=>({initializeApp:()=>({}),getApps:()=>[{}]}));
jest.mock("firebase/firestore",()=>({getFirestore:()=>({}),doc:(...a)=>a.join("/"),getDoc:(...a)=>mockGetDoc(...a),getDocFromServer:jest.fn(),collection:jest.fn(),getDocs:jest.fn(),query:jest.fn(),where:jest.fn(),setDoc:jest.fn(),deleteDoc:jest.fn()}));
const {ContadorEquipe}=require("./Equipe");
const ck=(slotId)=>({slotId,lider:"L",em:"x"});

describe("regras (decisões de 03/10/2026)",()=>{
  test("P260B não participa",()=>{expect(chkEqNumCheckins("P260B",[])).toBe(0);expect(checagemEquipeAplica("P260B",[])).toBe(false);expect(chkEqSlots(0)).toEqual([]);});
  test("P505, P260A e P260C: 2 check-ins, Diurno e Noturno",()=>{
    ["P505","P260A","P260C"].forEach(p=>expect(chkEqNumCheckins(p,[])).toBe(2));
    expect(chkEqSlots(2).map(s=>s.id)).toEqual(["diurno","noturno"]);
    expect(chkEqSlots(2).map(s=>s.turno)).toEqual(["Diurno","Noturno"]);
  });
  test("12x36 (Golgi, Mega): 4 check-ins sáb/dom × diurno/noturno",()=>{
    ["P601","P602","P604","P605","P606","P607","P311A","P311B"].forEach(p=>expect(chkEqNumCheckins(p,[{escala:"12x36"}])).toBe(4));
    expect(chkEqSlots(4).map(s=>s.id)).toEqual(["sab_diurno","sab_noturno","dom_diurno","dom_noturno"]);
  });
  test("projeto novo com escala 4x2 predominante segue a regra de 2 turnos",()=>{
    expect(chkEqNumCheckins("P999",[{escala:"4x2"},{escala:"4x2"},{escala:"12x36"}])).toBe(2);
    expect(chkEqNumCheckins("P999",[{escala:"4x2",status:"desligado"},{escala:"12x36"}])).toBe(4);
  });
  test("contagem: um por plantão, limitada ao exigido; check-ins da regra antiga (check_1..3) continuam valendo",()=>{
    expect(chkEqFeitos([ck("diurno"),ck("diurno")],2)).toBe(1);
    expect(chkEqFeitos([ck("check_1"),ck("check_2"),ck("check_3")],2)).toBe(2);
    expect(chkEqFeitos([ck("check_1")],2)).toBe(1);
    expect(chkEqFeitos([],4)).toBe(0);expect(chkEqFeitos(null,2)).toBe(0);expect(chkEqFeitos([ck("x")],0)).toBe(0);
  });
});

describe("contador da home",()=>{
  beforeAll(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;});
  beforeEach(()=>{jest.useFakeTimers();jest.setSystemTime(new Date(2026,9,4,10));mockGetDoc.mockReset();localStorage.clear();});
  afterEach(()=>{jest.useRealTimers();});
  const montar=async(pid,doc)=>{mockGetDoc.mockResolvedValue({exists:()=>true,data:()=>doc});const h=document.createElement("div");const r=createRoot(h);await act(async()=>r.render(<ContadorEquipe projectId={pid}/>));return {h,fechar:()=>act(async()=>r.unmount())};};
  test("P260B: não mostra nada e nem baixa o documento (domingo)",async()=>{
    const {h,fechar}=await montar("P260B",{colaboradores:[]});expect(h.textContent).toBe("");expect(mockGetDoc).not.toHaveBeenCalled();await fechar();
  });
  test("P505: 0/2 no domingo; com um check-in antigo do sábado mostra 1/2",async()=>{
    let m=await montar("P505",{colaboradores:[],checagemEquipe:null});expect(m.h.textContent).toContain("0/2");await m.fechar();
    m=await montar("P505",{colaboradores:[],checagemEquipe:{alvo:"2026-10-03",checkins:[ck("check_1")]}});expect(m.h.textContent).toContain("1/2");await m.fechar();
  });
  test("P260C concluída com Diurno e Noturno; P601 continua 0/4",async()=>{
    let m=await montar("P260C",{colaboradores:[],checagemEquipe:{alvo:"2026-10-03",checkins:[ck("diurno"),ck("noturno")]}});expect(m.h.textContent).toContain("concluída (2/2)");await m.fechar();
    m=await montar("P601",{colaboradores:[{escala:"12x36"}],checagemEquipe:null});expect(m.h.textContent).toContain("0/4");await m.fechar();
  });
});

test("servidor: os novos plantões aparecem no caminho de conflito (diagnóstico)",()=>{
  const {merge}=require("../api/ai/lib/equipeMerge");const c=x=>JSON.parse(JSON.stringify(x));
  const b={colaboradores:[],desligados:[]};const A=c(b);A.checagemEquipe={alvo:"2026-10-03",checkins:[{slotId:"noturno",lider:"A",em:"1"}]};
  const C=c(b);C.checagemEquipe={alvo:"2026-10-03",checkins:[{slotId:"noturno",lider:"B",em:"2"}]};
  let e;try{merge(b,A,C);}catch(x){e=x;}expect(e.path).toBe("checagemEquipe/checkins[noturno]");
});
test("código: nenhuma cópia da regra antiga sobrou na Equipe ou no Painel do Líder",()=>{
  const fs=require("fs");const eq=fs.readFileSync("src/Equipe.jsx","utf8"),pl=fs.readFileSync("src/PainelLider.jsx","utf8");
  expect(eq).not.toMatch(/CHK_EQUIPE_4X2|CHK_EQ_SLOTS_4x2|function chkEqNumCheckins/);expect(pl).not.toMatch(/CHK_EQUIPE_4X2|numCheckinsEquipe/);
  expect(pl).toContain("Não se aplica");
});
