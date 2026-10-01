import React from 'react';
import {createRoot} from 'react-dom/client';
import {act} from 'react-dom/test-utils';
import FVPainel from './FVPainel';

test('painel carrega via servidor e salva recorrente com PIN, sem escrita direta',async()=>{
 let plano={lancamentos:[],recorrentes:[]};const requests=[];
 global.IS_REACT_ACT_ENVIRONMENT=true;
 global.fetch=jest.fn(async(url,opts)=>{
  const b=JSON.parse(opts.body);requests.push(b);
  if(b.acao==='recorrente_salvar')plano={...plano,recorrentes:[b.item]};
  return {ok:true,json:async()=>({ok:true,plano,catalogo:[{id:'kit',nome:'Kit uniforme',valor:650}],qtdCestas:0})};
 });
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 const click=async text=>{const button=[...host.querySelectorAll('button')].find(x=>x.textContent.includes(text));expect(button).toBeDefined();await act(async()=>button.dispatchEvent(new MouseEvent('click',{bubbles:true})));};
 await act(async()=>root.render(<FVPainel pid="P260A" nome="Jatinox" resumo={{saldoAtual:62036.93}} lancamentos={[]} pin="test-pin"/>));
 expect(host.textContent).toContain('Gastos previstos 12m');expect(requests[0].acao).toBe('ler');
 await click('+ Recorrente');
 await act(async()=>{
  for(const [placeholder,value] of [['Descrição (ex.: Café)','Café'],['Valor/mês','250']]){
   const input=[...host.querySelectorAll('input')].find(x=>x.placeholder===placeholder);
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
   input.dispatchEvent(new Event('input',{bubbles:true}));
  }
 });
 await click('Salvar');
 expect(requests.at(-1)).toMatchObject({pid:'P260A',pin:'test-pin',acao:'recorrente_salvar',item:{descricao:'Café',valor:250,ativo:true}});
 expect(host.textContent).toContain('250,00/mês');
 await click('+ Lançamento');await click('Item do catálogo × qtd');
 await act(async()=>{const input=host.querySelector('input[type="number"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'12');input.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(host.textContent).toContain('7.800,00');
 await act(async()=>root.unmount());host.remove();delete global.IS_REACT_ACT_ENVIRONMENT;delete global.fetch;
});
