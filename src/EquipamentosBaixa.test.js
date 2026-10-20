import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
// Campo 18/10 (P604): o líder não conseguia tirar a lanterna "XRT-6000A" (já trocada por uma tática).
// Agora o líder dá BAIXA (com motivo) e, quando é troca, já cadastra o item novo. Moto: troca com histórico.
const mockGetDoc=jest.fn(),mockGravar=jest.fn(),mockBaixa=jest.fn(),mockUltimo=jest.fn();
jest.mock('firebase/app',()=>({initializeApp:()=>({}),getApps:()=>[{}]}));
jest.mock('firebase/firestore',()=>({getFirestore:()=>({}),doc:()=>({}),getDoc:(...a)=>mockGetDoc(...a)}));
jest.mock('./session',()=>({checkPin:jest.fn(),getAccess:()=> 'lider',grantSession:jest.fn(),clearSession:jest.fn()}));
jest.mock('./equipamentosStore',()=>({gravarSecaoEquipamentos:(...a)=>mockGravar(...a),darBaixaEquipamento:(...a)=>mockBaixa(...a),MOTIVOS_BAIXA:['Substituído','Extraviado','Danificado / inservível','Devolvido','Outro']}));
jest.mock('./mapaDiario/dados',()=>({loadUltimoPlantao:(...a)=>mockUltimo(...a)}));
const Equipamentos=require('./Equipamentos').default;

const xrt={id:'l1',identificacao:'XRT-6000A',status:'ok',qtd:1,historico:[]};
const outra={id:'l2',identificacao:'Lanterna 02',status:'ok',qtd:1,historico:[]};
let host,root;
const botao=t=>[...host.querySelectorAll('button')].find(x=>x.textContent.trim()===t);
const clicar=async el=>{expect(el).toBeTruthy();await act(async()=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));};
const preencher=async(el,v)=>act(async()=>{const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});
const abrir=async nome=>{const h=[...host.querySelectorAll('div')].find(x=>x.textContent===nome);expect(h).toBeDefined();await act(async()=>h.dispatchEvent(new MouseEvent('click',{bubbles:true})));};
const montar=async(doc,auth='lider')=>{mockGetDoc.mockResolvedValue({exists:()=>true,data:()=>doc});host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);await act(async()=>root.render(<Equipamentos project={{id:'P604',name:'Golgi Jundiaí'}} sharedAuth={auth} dark={true}/>));};
beforeAll(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;});
beforeEach(()=>{localStorage.clear();mockGravar.mockReset();mockBaixa.mockReset();mockUltimo.mockReset();mockUltimo.mockResolvedValue(null);window.alert=jest.fn();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});

test('líder dá baixa na XRT-6000A como Substituída: sai da lista, vai para o histórico e o formulário do item novo abre',async()=>{
 await montar({lanternas:[xrt,outra]});
 await abrir('Lanternas');await abrir('XRT-6000A');
 expect(host.textContent).not.toContain('Excluir Item');                 // exclusão definitiva continua só gerencial
 await clicar(host.querySelector('button[aria-label="Dar baixa: XRT-6000A"]'));
 await clicar(botao('Confirmar baixa'));
 expect(host.querySelector('[data-testid="baixa-equip"] [role="alert"]').textContent).toContain('Escolha o motivo');
 expect(mockBaixa).not.toHaveBeenCalled();
 mockBaixa.mockResolvedValue({lanternas:[outra],baixados:[{...xrt,categoria:'lanternas',baixa:{motivo:'Substituído',obs:'Trocada por lanterna tática',por:'Líder (PIN do projeto)',em:'2026-10-18T12:00:00.000Z'}}],updatedAt:'x'});
 await preencher(host.querySelector('select[aria-label="Motivo da baixa: XRT-6000A"]'),'Substituído');
 await preencher(host.querySelector('input[aria-label="Observação da baixa: XRT-6000A"]'),'Trocada por lanterna tática');
 await clicar(botao('Confirmar baixa'));
 expect(mockBaixa).toHaveBeenCalledWith('P604',{categoria:'lanternas',id:'l1',motivo:'Substituído',obs:'Trocada por lanterna tática',por:'Líder (PIN do projeto)'},expect.objectContaining({lanternas:[xrt,outra]}));
 expect(host.querySelector('input[placeholder="Lanterna 01"]')).not.toBeNull();   // cadastrar a lanterna nova
 expect([...host.querySelectorAll('div')].some(d=>d.textContent==='XRT-6000A')).toBe(false);
 expect(host.textContent).toContain('Itens baixados (1)');
 await clicar([...host.querySelectorAll('button')].find(x=>x.textContent.startsWith('Itens baixados (1)')));
 expect(host.textContent).toContain('Lanterna: XRT-6000A');
 expect(host.textContent).toContain('Substituído · Trocada por lanterna tática');
 expect(JSON.parse(localStorage.getItem('equipamentos_P604')).lanternas).toEqual([outra]);
});

test('baixa "Outro" exige descrição; falha do servidor mantém o item e avisa',async()=>{
 await montar({lanternas:[xrt]});
 await abrir('Lanternas');await abrir('XRT-6000A');
 await clicar(host.querySelector('button[aria-label="Dar baixa: XRT-6000A"]'));
 await preencher(host.querySelector('select[aria-label="Motivo da baixa: XRT-6000A"]'),'Outro');
 await clicar(botao('Confirmar baixa'));
 expect(host.textContent).toContain('Descreva o motivo da baixa');
 mockBaixa.mockRejectedValue(Error('Sem conexão'));
 await preencher(host.querySelector('input[aria-label="Observação da baixa: XRT-6000A"]'),'Recolhida pela empresa');
 await clicar(botao('Confirmar baixa'));
 expect(host.textContent).toContain('Sem conexão');
 expect(host.textContent).toContain('XRT-6000A');
});

test('troca de moto: antiga vai para o histórico, nova entra limpa do km inicial',async()=>{
 const antiga={placa:'ABC1D23',modelo:'CG 160',km:71330,status:'ok',historico:[{id:'h1',desc:'óleo'}]};
 await montar({moto:antiga});
 let salvo;mockGravar.mockImplementation(async(pid,sec,before,after)=>{salvo={sec,after};return {...before,[sec]:after};});
 await clicar(host.querySelector('button[aria-label="Substituir moto"]'));
 await clicar(botao('Confirmar troca'));
 expect(host.querySelector('[data-testid="troca-moto"] [role="alert"]').textContent).toContain('placa');
 await preencher(host.querySelector('input[aria-label="Placa da moto nova"]'),'xyz9k88');
 await preencher(host.querySelector('input[aria-label="KM inicial da moto nova"]'),'1.250');
 await preencher(host.querySelector('input[aria-label="Modelo da moto nova"]'),'XRE 190');
 await preencher(host.querySelector('input[aria-label="Itens que acompanham a moto nova"]'),'baú, 2 capacetes');
 await preencher(host.querySelector('input[aria-label="Motivo da troca da moto"]'),'Antiga foi para manutenção');
 await clicar(botao('Confirmar troca'));
 expect(salvo.sec).toBe('moto');
 expect(salvo.after).toMatchObject({placa:'XYZ9K88',modelo:'XRE 190',km:1250,kmInicial:1250,historico:[],itens:'baú, 2 capacetes',trocadaPor:'Líder (PIN do projeto)'});
 expect(salvo.after.anteriores[0]).toMatchObject({placa:'ABC1D23',historico:[{id:'h1',desc:'óleo'}],baixa:{motivo:'Antiga foi para manutenção',kmFinal:71330}});
 expect(host.textContent).toContain('XYZ9K88');
 expect(host.textContent).toContain('Itens baixados (1)');
 // Km da moto nova (1260) não é travado pelo km da moto antiga no último mapa.
 mockUltimo.mockResolvedValue({enviadoEm:'2026-10-17T21:00:00.000Z',veiculos:[{id:'moto',rotulo:'Moto',kmAtual:71330}]});
 await clicar(botao('Editar'));
 await preencher(host.querySelector('input[aria-label="KM Atual"]'),'1260');
 await clicar(botao('Salvar'));
 expect(window.alert).not.toHaveBeenCalled();
 expect(salvo.after).toMatchObject({placa:'XYZ9K88',km:1260});
});

test('líder não troca a placa pelo Editar (é outra moto: usa Substituir); km da mesma moto continua travado',async()=>{
 await montar({moto:{placa:'ABC1D23',km:71330,status:'ok'}});
 mockUltimo.mockResolvedValue({enviadoEm:'2026-10-17T21:00:00.000Z',veiculos:[{id:'moto',rotulo:'Moto',kmAtual:71400}]});
 await clicar(botao('Editar'));
 expect(host.querySelector('input[aria-label="Placa"]').readOnly).toBe(true);
 expect(host.textContent).toContain('Use "Substituir moto"');
 await preencher(host.querySelector('input[aria-label="KM Atual"]'),'71350');
 await clicar(botao('Salvar'));
 expect(window.alert.mock.calls[0][0]).toContain('Corrigir km anterior');
 expect(mockGravar).not.toHaveBeenCalled();
});

test('registrar manutenção atualiza KM Atual e Últ. manutenção sem Editar; próximo km opcional mantém o alerta',async()=>{
 await montar({moto:{placa:'ABC1D23',modelo:'CG 160',km:72100,kmManutencao:72000,proximaRevisao:'2026-12-01',status:'ok',historico:[]}});
 expect(host.textContent).toContain('KM de manutenção atingido');                 // 72100 ≥ 72000
 let salvo;mockGravar.mockImplementation(async(pid,sec,before,after)=>{salvo={sec,after};return {...before,[sec]:after};});
 await clicar(botao('+ Registrar'));
 await preencher(host.querySelector('input[aria-label="KM da manutenção"]'),'72.450');
 const ta=host.querySelector('textarea');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(ta,'Revisão geral');ta.dispatchEvent(new Event('input',{bubbles:true}));});
 await clicar(botao('Registrar manutenção'));
 expect(salvo.sec).toBe('moto');
 expect(salvo.after).toMatchObject({km:72450,kmManutencao:'',historico:[expect.objectContaining({km:72450,desc:'Revisão geral'})]});
 expect(salvo.after.ultimaManutencao).toMatch(/^\d{4}-\d{2}-\d{2}$/);
 expect(host.textContent).toContain('72450 km');
 expect(host.textContent).toContain('Últ. Manutenção');
 expect(host.textContent).not.toContain('Próx. Revisão');
 expect(host.textContent).not.toContain('KM de manutenção atingido');             // km previsto limpo → sem alerta
 // segunda manutenção informando o próximo km abaixo do atual → recusa
 await clicar(botao('+ Registrar'));
 await preencher(host.querySelector('input[aria-label="KM da manutenção"]'),'73000');
 await preencher(host.querySelector('input[aria-label="KM para próxima manutenção (registro)"]'),'72000');
 const ta2=host.querySelector('textarea');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(ta2,'Pneu');ta2.dispatchEvent(new Event('input',{bubbles:true}));});
 await clicar(botao('Registrar manutenção'));
 expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('maior que o km atual'));
});
