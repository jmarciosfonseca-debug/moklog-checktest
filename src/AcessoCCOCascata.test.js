import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import AcessoCCO from './AcessoCCO';
import {getDoc} from 'firebase/firestore';
import {setDoc} from './fireGuard';
import {baixarHtml} from './relatorios/padraoMoked';
jest.mock('firebase/app',()=>({getApps:()=>[{}],initializeApp:()=>({})}));
jest.mock('firebase/firestore',()=>({getFirestore:()=>({}),doc:(_db,col,id)=>({col,id}),getDoc:jest.fn()}));
jest.mock('./fireGuard',()=>({setDoc:jest.fn(()=>{throw Error('Gravação proibida neste teste');})}));
jest.mock('./session',()=>({getAccess:()=>null,checkPin:jest.fn(),grantSession:jest.fn()}));
jest.mock('./RondaVirtual',()=>()=>null);
jest.mock('./TempoGravacao',()=>()=>null);
jest.mock('./BodycamSection',()=>()=>null);
jest.mock('./relatorios/padraoMoked',()=>({...jest.requireActual('./relatorios/padraoMoked'),baixarHtml:jest.fn()}));
global.IS_REACT_ACT_ENVIRONMENT=true;
Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=> 'TESTE-UUID'}});
// Registros fora de ordem de inserção (retroativo no meio): a tela deve mostrar o mais recente primeiro, 3 por bloco.
const regs=[{id:'a',data:'2026-09-20',nome:'Antigo A',horaEntrada:'09:00'},{id:'b',data:'2026-10-04',nome:'Recente B',horaEntrada:'09:00'},{id:'c',data:'2026-09-01',nome:'Antigo C',horaEntrada:'09:00'},{id:'d',data:'2026-10-03',nome:'Recente D',horaEntrada:'09:00'},{id:'e',data:'2026-10-01',nome:'Meio E',horaEntrada:'09:00'}];
test('Acesso CCO: anteriores do mais recente para o mais antigo, 3 visíveis e ver mais',async()=>{
  jest.useFakeTimers('modern');jest.setSystemTime(new Date('2026-10-05T15:00:00Z'));
  getDoc.mockImplementation(async()=>({exists:()=>true,data:()=>({registros:regs})}));
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(<AcessoCCO project={{id:'P601',name:'TESTE'}} sharedAuth="admin" dark onBack={()=>{}}/>));
    const t=host.textContent;
    const pos=n=>t.indexOf(n);
    expect(pos('Recente B')).toBeGreaterThan(-1);
    expect(pos('Recente B')).toBeLessThan(pos('Recente D'));
    expect(pos('Recente D')).toBeLessThan(pos('Meio E'));
    expect(t).not.toContain('Antigo A');expect(t).not.toContain('Antigo C');
    expect(t).toContain('Ver mais 2');
    const b=[...host.querySelectorAll('button')].find(x=>x.textContent.includes('Ver mais 2'));
    await act(async()=>b.click());
    expect(host.textContent.indexOf('Antigo A')).toBeLessThan(host.textContent.indexOf('Antigo C'));
  }finally{await act(async()=>root.unmount());host.remove();jest.useRealTimers();}
});
