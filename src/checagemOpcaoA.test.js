import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
jest.mock('firebase/app',()=>({getApps:()=>[{}],initializeApp:()=>({})}));
jest.mock('firebase/firestore',()=>({getFirestore:()=>({})}));
jest.mock('./session',()=>({isDemo:()=>false,getAccess:()=>null,getSession:()=>null}));
const {ChecagemEquipeModal}=require('./Equipe');
const {save}=require('../api/ai/lib/equipeMerge');
const check={slotId:'dom_diurno',slotLabel:'Domingo · Diurno',lider:'Líder A',em:'2026-10-04T12:00:00Z',statusEquipe:'sem_alteracoes'};
const base={colaboradores:[],desligados:[],checagemEquipe:{alvo:'2026-10-03',checkins:[check]}};
const changed={...base,checagemEquipe:{...base.checagemEquipe,checkins:[{...check,lider:'Líder B'}]}};
function banco(){const set=jest.fn();return {set,collection:()=>({doc:()=>({})}),runTransaction:fn=>fn({get:async()=>({exists:true,data:()=>base}),set})};}
test('líder não substitui assinatura mesmo com base atual; admin preserva histórico',async()=>{
 const db=banco();await expect(save(db,'P605',base,changed,{nivel:'lider'})).rejects.toMatchObject({status:403});expect(db.set).not.toHaveBeenCalled();
 const result=await save(db,'P605',base,changed,{nivel:'admin'});expect(result.checagemCorrecoes[0]).toMatchObject({anterior:check,novo:{lider:'Líder B'},corrigidoPor:'Gerencial'});
});
test('líder não remove check-in e cliente não fabrica histórico',async()=>{
 await expect(save(banco(),'P605',base,{...base,checagemEquipe:{...base.checagemEquipe,checkins:[]}},{nivel:'lider'})).rejects.toMatchObject({status:403});
 await expect(save(banco(),'P605',base,{...base,checagemCorrecoes:[{falso:true}]},{nivel:'admin'})).rejects.toMatchObject({status:403});
});
test('não contorna bloqueio apagando checagem ou inventando outro ciclo; retry idêntico passa',async()=>{
 await expect(save(banco(),'P605',base,{...base,checagemEquipe:null},{nivel:'lider'})).rejects.toMatchObject({status:403});
 await expect(save(banco(),'P605',base,{...changed,checagemEquipe:{...changed.checagemEquipe,alvo:'2099-10-03'}},{nivel:'lider'})).rejects.toMatchObject({status:403});
 await expect(save(banco(),'P605',base,base,{nivel:'lider'})).resolves.toEqual(base);
});
test('gerencial mantém acesso à revisão mesmo com todos os plantões completos',()=>{
 const source=require('fs').readFileSync('src/Equipe.jsx','utf8');
 expect(source).toContain('(!completo||adminAuth)');expect(source).toContain('Revisar checagem (gerencial)');
});
global.IS_REACT_ACT_ENVIRONMENT=true;
test('modal bloqueia ocupado para líder, libera admin e impede clique duplo',async()=>{
 jest.useFakeTimers({now:new Date('2026-10-04T15:00:00Z')});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let resolver;const confirm=jest.fn(()=>new Promise(r=>{resolver=r;}));
 const render=adminAuth=>act(async()=>root.render(<ChecagemEquipeModal project={{id:'P605'}} equipeData={base} dark onConfirm={confirm} onCancel={()=>{}} adminAuth={adminAuth}/>));
 const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes(text));
 try{
  await render(false);await act(async()=>button('Domingo · Diurno').click());
  expect(host.textContent).toContain('Já checado por Líder A');expect(button('Plantão já checado').disabled).toBe(true);
  await render(true);const input=host.querySelector('input[placeholder="Ou digite o nome do líder"]');
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Líder B');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>{const b=button('Corrigir checagem');b.click();b.click();});
  expect(confirm).toHaveBeenCalledTimes(1);expect(button('Salvando').disabled).toBe(true);
  await act(async()=>resolver());
 }finally{await act(async()=>root.unmount());host.remove();jest.useRealTimers();}
});
