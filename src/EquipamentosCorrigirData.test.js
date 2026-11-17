import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
// 17/11 (P311B): a equipe informou a data errada da ocorrência (Bodycam Reserva). Só o gerencial corrige a data e o texto.
const mockGetDoc=jest.fn(),mockGravar=jest.fn(),mockUltimo=jest.fn();
jest.mock('firebase/app',()=>({initializeApp:()=>({}),getApps:()=>[{}]}));
jest.mock('firebase/firestore',()=>({getFirestore:()=>({}),doc:()=>({}),getDoc:(...a)=>mockGetDoc(...a)}));
jest.mock('./session',()=>({checkPin:jest.fn(),getAccess:()=> 'lider',grantSession:jest.fn(),clearSession:jest.fn()}));
jest.mock('./equipamentosStore',()=>({gravarSecaoEquipamentos:(...a)=>mockGravar(...a),darBaixaEquipamento:jest.fn(),MOTIVOS_BAIXA:['Outro']}));
jest.mock('./mapaDiario/dados',()=>({loadUltimoPlantao:(...a)=>mockUltimo(...a)}));
const Equipamentos=require('./Equipamentos').default;
const {aplicarCorrecaoOcorrencia}=require('./Equipamentos');

const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const diasAtras=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
const errada=diasAtras(1),certa=diasAtras(3);
const cam={id:'b1',identificacao:'Bodycam Reserva',status:'inop',qtd:1,justificativa:'Não foi entregue no posto',dataProblem:errada,historico:[]};
let host,root;
const botao=t=>[...host.querySelectorAll('button')].find(x=>x.textContent.trim()===t);
const clicar=async el=>{expect(el).toBeTruthy();await act(async()=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));};
const preencher=async(el,v)=>act(async()=>{const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));});
const abrir=async nome=>{const h=[...host.querySelectorAll('div')].find(x=>x.textContent===nome);expect(h).toBeDefined();await act(async()=>h.dispatchEvent(new MouseEvent('click',{bubbles:true})));};
const montar=async(doc,auth)=>{mockGetDoc.mockResolvedValue({exists:()=>true,data:()=>doc});host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);await act(async()=>root.render(<Equipamentos project={{id:'P311B',name:'Mega CL Itajaí'}} sharedAuth={auth} dark={true}/>));};
beforeAll(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;});
beforeEach(()=>{localStorage.clear();mockGravar.mockReset();mockUltimo.mockReset();mockUltimo.mockResolvedValue(null);window.alert=jest.fn();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});

test('gerencial corrige a data da ocorrência de qualquer equipamento e a correção fica registrada',async()=>{
 await montar({bodycam:[cam]},'admin');
 await abrir('Bodycam');await abrir('Bodycam Reserva');
 await clicar(host.querySelector('button[aria-label="Corrigir data da ocorrência"]'));
 await preencher(host.querySelector('input[aria-label="Data da ocorrência"]'),certa);
 mockGravar.mockImplementation(async(pid,sec,antes,depois)=>({[sec]:depois,updatedAt:'x'}));
 await clicar(botao('Salvar correção'));
 expect(mockGravar).toHaveBeenCalledTimes(1);
 const [pid,sec,,depois]=mockGravar.mock.calls[0];
 expect(pid).toBe('P311B');expect(sec).toBe('bodycam');
 expect(depois[0]).toMatchObject({id:'b1',status:'inop',dataProblem:certa,justificativa:'Não foi entregue no posto'});
 expect(depois[0].correcoes).toHaveLength(1);
 expect(depois[0].correcoes[0]).toMatchObject({por:'Gerencial',de:{dataProblem:errada},para:{dataProblem:certa}});
 expect(host.textContent).toContain('3d em aberto');
});

test('líder (PIN do projeto) não vê a correção; item sem problema também não',async()=>{
 await montar({bodycam:[cam,{id:'b2',identificacao:'Bodycam Ronda',status:'ok',qtd:1,historico:[]}]},'lider');
 await abrir('Bodycam');await abrir('Bodycam Reserva');
 expect(host.querySelector('button[aria-label="Corrigir data da ocorrência"]')).toBeNull();
});

test('regras: data futura, texto vazio e nada alterado são recusados',()=>{
 const agora=new Date();
 expect(aplicarCorrecaoOcorrencia(cam,{dataProblem:iso(new Date(agora.getTime()+3*86400000)),justificativa:'x y z'},{agora}).ok).toBe(false);
 expect(aplicarCorrecaoOcorrencia(cam,{dataProblem:certa,justificativa:' '},{agora}).erro).toMatch(/justificativa/i);
 expect(aplicarCorrecaoOcorrencia(cam,{dataProblem:errada,justificativa:cam.justificativa},{agora}).erro).toMatch(/Nada/);
 const r=aplicarCorrecaoOcorrencia(cam,{dataProblem:certa,justificativa:'Bodycam não entregue no posto (corrigido)'},{agora});
 expect(r.ok).toBe(true);expect(cam.correcoes).toBeUndefined();   // não muta o original
});
