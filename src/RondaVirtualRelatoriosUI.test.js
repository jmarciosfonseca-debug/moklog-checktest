import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import RondaVirtual from './RondaVirtual';
import {onSnapshot} from 'firebase/firestore';
import {baixarHtml} from './relatorios/padraoMoked';
jest.mock('firebase/firestore',()=>({onSnapshot:jest.fn()}));
jest.mock('./fireGuard',()=>({setDoc:jest.fn(()=>{throw Error('Não gravar no teste de relatório');})}));
jest.mock('./relatorios/padraoMoked',()=>({...jest.requireActual('./relatorios/padraoMoked'),baixarHtml:jest.fn()}));
global.IS_REACT_ACT_ENVIRONMENT=true;
test('filtro da tela distingue homônimas, exporta período e não grava dados',async()=>{
  jest.useFakeTimers('modern');jest.setSystemTime(new Date('2026-10-05T15:00:00Z'));
  localStorage.clear();
  const turnos=['2026-09-28','2026-09-29','2026-10-03'].map((dataInicio,i)=>({id:'turno'+i,tipo:'noturno',dataInicio,arquivado:true,rondas:{},plantonista:{id:'teste-'+i,nome:'Ana Teste',cargo:'CCO'}}));
  onSnapshot.mockImplementation((ref,cb)=>{cb({exists:()=>true,data:()=>({turnos})});return ()=>{};});
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host),save=jest.fn();
  const click=async text=>{const b=[...host.querySelectorAll('button')].find(x=>x.textContent.includes(text));expect(b).toBeDefined();await act(async()=>b.click());};
  try{
    await act(async()=>root.render(<RondaVirtual project={{id:'P601',name:'TESTE'}} dark S={{}} adminAuth loadEquipe={async()=>[]} db={{}} doc={()=>({})} setDoc={save} getDoc={jest.fn()}/>));
    await click('Arquivados (3)');await click('7 dias');
    expect([...host.querySelectorAll('input[type="date"]')].map(x=>x.value)).toEqual(['2026-09-29','2026-10-05']);
    const chips=[...host.querySelectorAll('button')].filter(x=>x.textContent.includes('Ana Teste (CCO)'));
    expect(chips).toHaveLength(3);expect(new Set(chips.map(x=>x.textContent)).size).toBe(3);
    expect(chips.every(x=>!x.textContent.includes('sem identificador'))).toBe(true);
    await click('Consolidado do filtro');
    expect(baixarHtml).toHaveBeenCalledTimes(1);
    const texto=baixarHtml.mock.calls[0].join(' ');expect(texto).toContain('29/09/2026');expect(texto).toContain('2 turnos');
    expect(save).not.toHaveBeenCalled();
  }finally{await act(async()=>root.unmount());host.remove();jest.useRealTimers();}
});
