import React from 'react';
import {createRoot} from 'react-dom/client';
import {act} from 'react-dom/test-utils';
import FVPainel from './FVPainel';
jest.mock('./session',()=>({authFetch:(url,opts)=>fetch(url,{...opts,headers:{Authorization:'Bearer test-token'}})}));

test('painel carrega e salva recorrente com token, sem PIN ou escrita direta',async()=>{
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
 expect(requests.at(-1)).toMatchObject({pid:'P260A',acao:'recorrente_salvar',item:{descricao:'Café',valor:250,ativo:true}});
 expect(requests.at(-1)).not.toHaveProperty('pin');expect(global.fetch.mock.calls.at(-1)[1].headers.Authorization).toBe('Bearer test-token');
 expect(host.textContent).toContain('250,00/mês');
 await click('+ Lançamento');await click('Item do catálogo × qtd');
 await act(async()=>{const input=host.querySelector('input[type="number"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'12');input.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(host.textContent).toContain('7.800,00');
 await act(async()=>root.unmount());host.remove();delete global.IS_REACT_ACT_ENVIRONMENT;delete global.fetch;
});
test('origem Equipe tem aviso de preço e somente ação Realizado',async()=>{
 global.IS_REACT_ACT_ENVIRONMENT=true;const requests=[];
 global.fetch=jest.fn(async(url,opts)=>{requests.push(JSON.parse(opts.body));return {ok:true,json:async()=>({ok:true,plano:{lancamentos:[{id:'ap_s1',vinculo:'aprovacao',tipo:'debito',colabNome:'Ana',item:'Camisa / Camisão',descricao:'Camisa / Camisão · Ana',mes:'2026-11',qtd:2,realizado:false}],recorrentes:[]},catalogo:[],qtdCestas:0})};});
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 await act(async()=>root.render(<FVPainel pid="P260A" nome="Jatinox" resumo={{saldoAtual:1000}} lancamentos={[]} pin="test-pin"/>));
 expect(host.textContent).toContain('Equipe · Camisa / Camisão · Ana');expect(host.textContent).toContain('Sem preço no catálogo');
 const button=[...host.querySelectorAll('button')].find(x=>x.textContent==='Realizado');expect(button).toBeDefined();
 await act(async()=>button.dispatchEvent(new MouseEvent('click',{bubbles:true})));
 expect(requests.at(-1)).toMatchObject({acao:'realizarAprovacao',id:'ap_s1',realizado:true});
 expect([...host.querySelectorAll('button')].filter(x=>x.textContent==='✏️')).toHaveLength(0);
 await act(async()=>root.unmount());host.remove();delete global.IS_REACT_ACT_ENVIRONMENT;delete global.fetch;
});
