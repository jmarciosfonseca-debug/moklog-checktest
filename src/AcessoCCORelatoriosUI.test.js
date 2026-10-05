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
const snap=()=>({exists:()=>true,data:()=>({registros:[{id:'TESTE',data:'2026-10-04',nome:'Pessoa TESTE',horaEntrada:'09:00'}]})});
let host,root;
const pdf=()=>[...host.querySelectorAll('button')].find(b=>/PDF|Gerando/.test(b.textContent));
beforeEach(async()=>{
  jest.useFakeTimers('modern');jest.setSystemTime(new Date('2026-10-05T15:00:00Z'));
  jest.clearAllMocks();baixarHtml.mockReset();localStorage.clear();getDoc.mockImplementation(async()=>snap());
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>root.render(<AcessoCCO project={{id:'P601',name:'TESTE'}} sharedAuth="admin" dark onBack={()=>{}}/>));
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();expect(setDoc).not.toHaveBeenCalled();jest.useRealTimers();});
async function interna(){const label=[...host.querySelectorAll('label')].find(e=>e.textContent.includes('Versão interna'));await act(async()=>label.querySelector('input').click());}
async function data(label,value){const input=host.querySelector(`[aria-label="${label}"]`);await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});}
test('período invertido e vazio bloqueiam exportação antes da consulta',async()=>{
  await interna();await data('Início do período','2026-10-06');getDoc.mockClear();
  await act(async()=>pdf().click());expect(host.querySelector('[role="alert"]')).not.toBeNull();expect(getDoc).not.toHaveBeenCalled();expect(baixarHtml).not.toHaveBeenCalled();
  await data('Início do período','');await act(async()=>pdf().click());expect(getDoc).not.toHaveBeenCalled();expect(baixarHtml).not.toHaveBeenCalled();
});
test('espera leitura, bloqueia clique repetido e libera após sucesso',async()=>{
  await interna();let resolve;getDoc.mockClear();getDoc.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  await act(async()=>pdf().click());expect(pdf().disabled).toBe(true);expect(pdf().textContent).toContain('Gerando');
  await act(async()=>pdf().click());expect(getDoc).toHaveBeenCalledTimes(1);expect(baixarHtml).not.toHaveBeenCalled();
  await act(async()=>resolve(snap()));expect(baixarHtml).toHaveBeenCalledTimes(1);expect(pdf().disabled).toBe(false);
});
test('erro de exportação é visível e permite nova tentativa',async()=>{
  baixarHtml.mockImplementationOnce(()=>{throw Error('Falha simulada');});
  await act(async()=>pdf().click());expect(host.querySelector('[role="alert"]').textContent).toContain('Não foi possível');expect(pdf().disabled).toBe(false);
  await act(async()=>pdf().click());expect(baixarHtml).toHaveBeenCalledTimes(2);expect(host.querySelector('[role="alert"]')).toBeNull();
});
