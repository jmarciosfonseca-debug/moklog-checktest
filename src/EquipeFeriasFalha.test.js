import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {ProjecaoFerias} from './Equipe';
jest.mock('firebase/app',()=>({getApps:()=>[{}],initializeApp:()=>({})}));
jest.mock('firebase/firestore',()=>({getFirestore:()=>({})}));
jest.mock('./session',()=>({isDemo:()=>false,getAccess:()=>null,getSession:()=>null}));
global.IS_REACT_ACT_ENVIRONMENT=true;
test('falha na gravação de férias libera o botão e permite tentar novamente',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const aviso=jest.spyOn(window,'alert').mockImplementation(()=>{});
 const onSave=jest.fn().mockRejectedValueOnce(Error('Falha simulada')).mockResolvedValueOnce({});
 try{
  await act(async()=>root.render(<ProjecaoFerias project={{id:'P601',nome:'Teste'}} colaboradores={[{id:'c',nome:'Teste',cargo:'Apoio'}]} liderAuth onSave={onSave} ferias={[]}/>));
  const botao=()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Salvar Ordem'));
  expect(botao()).toBeDefined();
  await act(async()=>botao().click());
  expect(aviso).toHaveBeenCalledWith('Falha simulada');expect(botao().disabled).toBe(false);
  await act(async()=>botao().click());
  expect(onSave).toHaveBeenCalledTimes(2);expect(botao().disabled).toBe(false);
 }finally{await act(async()=>root.unmount());host.remove();aviso.mockRestore();}
});
