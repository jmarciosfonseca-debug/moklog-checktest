import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
const mockGetDoc=jest.fn(),mockGravar=jest.fn();
jest.mock('firebase/app',()=>({initializeApp:()=>({}),getApps:()=>[{}]}));
jest.mock('firebase/firestore',()=>({getFirestore:()=>({}),doc:()=>({}),getDoc:(...a)=>mockGetDoc(...a)}));
jest.mock('./session',()=>({checkPin:jest.fn(),getAccess:()=> 'lider',grantSession:jest.fn(),clearSession:jest.fn()}));
jest.mock('./equipamentosStore',()=>({gravarSecaoEquipamentos:(...a)=>mockGravar(...a)}));
const Equipamentos=require('./Equipamentos').default;
const item={id:'a',identificacao:'Arma 01',status:'ok',qtd:1,nSerie:'TESTE',historico:[{id:'h',nota:'manter'}]};
let host,root;
const click=async text=>{const b=[...host.querySelectorAll('button')].find(x=>x.textContent===text);expect(b).toBeDefined();await act(async()=>b.dispatchEvent(new MouseEvent('click',{bubbles:true})));};
const fill=async(input,value)=>act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
async function abrir(nome='Armamento'){const h=[...host.querySelectorAll('div')].find(x=>x.textContent===nome);expect(h).toBeDefined();await act(async()=>h.dispatchEvent(new MouseEvent('click',{bubbles:true})));}
beforeAll(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;});
beforeEach(async()=>{localStorage.clear();mockGravar.mockReset();mockGetDoc.mockResolvedValue({exists:()=>true,data:()=>({armamento:[item]})});host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);await act(async()=>root.render(<Equipamentos project={{id:'P505',name:'Teste'}} sharedAuth="lider" dark={true}/>));await abrir();await abrir('Arma 01');});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
test('líder vê adicionar e editar, sem excluir; edição preserva histórico',async()=>{
 expect(host.textContent).toContain('+ Adicionar');expect(host.textContent).not.toContain('Excluir');
 mockGravar.mockImplementation(async(pid,section,before,after)=>({...before,[section]:after}));
 await click('Editar equipamento');const input=host.querySelector('input[placeholder="Arma 01"]');await fill(input,'Arma revisada');await fill(host.querySelector('input[aria-label="Quantidade"]'),'2');await click('Salvar alterações');
 expect(mockGravar).toHaveBeenCalledWith('P505','armamento',{armamento:[item]},[expect.objectContaining({id:'a',identificacao:'Arma revisada',qtd:2,historico:item.historico})]);
});
test('líder inclui item novo com quantidade e ele entra no resumo',async()=>{
 mockGravar.mockImplementation(async(pid,section,before,after)=>({...before,[section]:after}));await click('+ Adicionar');await fill(host.querySelector('input[placeholder="Arma 01"]'),'Arma 02');await fill(host.querySelector('input[aria-label="Quantidade"]'),'3');await click('✓ Adicionar');
 expect(mockGravar.mock.calls[0][3]).toHaveLength(2);expect(host.textContent).toContain('Arma 02');await abrir('Arma 02');expect(host.textContent).toContain('Qtd: 3');
});
test('falha não fecha edição, não troca cache confirmado e preserva cópia',async()=>{
 mockGravar.mockRejectedValue(Object.assign(Error('Conflito de seção'),{status:409}));await click('Editar equipamento');await fill(host.querySelector('input[placeholder="Arma 01"]'),'Tentativa');await click('Salvar alterações');
 expect(host.querySelector('[role="alert"]').textContent).toContain('Conflito');expect(host.textContent).toContain('Salvar alterações');expect(JSON.parse(localStorage.getItem('equipamentos_P505')).armamento[0].identificacao).toBe('Arma 01');expect(Object.keys(localStorage).some(k=>k.startsWith('equipamentos_tentativa_P505'))).toBe(true);
});
