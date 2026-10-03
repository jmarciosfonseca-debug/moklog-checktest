import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {FolhaWhats,SeloWhats} from './EquipeWhats';
import {ASSINATURA_APROVADOR} from './equipeSolicitacoes';
import {UniformeModulo,AprovacaoInline,AprovacoesScreen} from './Equipe';
jest.mock('firebase/app',()=>({getApps:()=>[{}],initializeApp:()=>({})}));
jest.mock('firebase/firestore',()=>({getFirestore:()=>({})}));
jest.mock('./session',()=>({isDemo:()=>false,getAccess:()=>null,getSession:()=>null}));
global.IS_REACT_ACT_ENVIRONMENT=true;
let host,root;
beforeEach(()=>{
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=> 'evento-id'}});
 jest.spyOn(window,'open').mockImplementation(()=>null);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();jest.restoreAllMocks();});
const render=async ui=>act(async()=>root.render(ui));
const btn=text=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes(text));
const click=async text=>{const b=btn(text);expect(b).toBeDefined();await act(async()=>b.click());};
const s={id:'solic-123456',item:'Camisa',solicitadoEm:'2026-10-02T12:00:00Z',solicitadoPor:'Líder P260A',exigeWhats:true,status:'pendente',aprovacao:'aguardando'};
const ap={...s,aprovacao:'aprovado',aprovadoEm:'2026-10-02T21:18:57Z',aprovadoPor:'Gerencial'};

test('folha usa novo clique para abrir WhatsApp; falha mostra retry idempotente',async()=>{
 const registrar=jest.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({});
 await render(<FolhaWhats solicitacoes={[ap]} colab={{id:'c',nome:'Ana'}} projectNome="P260A" onRegistrar={registrar} onFechar={()=>{}}/>);
 expect(window.open).not.toHaveBeenCalled();
 await click('Enviar no WhatsApp');
 expect(window.open).toHaveBeenCalledWith('about:blank','_blank');
 expect(host.textContent).toContain('Não foi possível registrar o envio');
 await click('Tentar registrar de novo');
 expect(window.open).toHaveBeenCalledTimes(1);
 expect(registrar.mock.calls[0]).toEqual(registrar.mock.calls[1]);
 expect(host.textContent).toContain('Toque registrado');
});

test('WhatsApp só recebe destino após confirmação da gravação, inclusive com página oculta',async()=>{
 let resolver;const registrar=jest.fn(()=>new Promise(r=>{resolver=r;}));
 const janela={opener:window,closed:false,location:{replace:jest.fn()}};
 window.open.mockReturnValue(janela);
 await render(<FolhaWhats solicitacoes={[ap]} colab={{id:'c',nome:'Ana'}} projectNome="P260A" onRegistrar={registrar} onFechar={()=>{}}/>);
 await click('Enviar no WhatsApp');
 expect(janela.opener).toBeNull();expect(janela.location.replace).not.toHaveBeenCalled();
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
 document.dispatchEvent(new Event('visibilitychange'));
 expect(janela.location.replace).not.toHaveBeenCalled();
 await act(async()=>resolver());
 expect(janela.location.replace).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/?text='));
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
});

test('selo: aguardando, aprovada (falta enviar), negada, enviada e legado',async()=>{
 await render(<SeloWhats solic={{}}/>);expect(host.textContent).toBe('Sem registro de envio');
 await render(<SeloWhats solic={s}/>);expect(host.textContent).toContain('Aguardando aprovação do gerencial');
 await render(<SeloWhats solic={ap}/>);expect(host.textContent).toContain('Aprovada — falta enviar ao grupo');
 await render(<SeloWhats solic={{...s,aprovacao:'negado'}}/>);expect(host.textContent).toContain('Negada');
 await render(<SeloWhats solic={{...ap,whatsEnviadoEm:'2026-10-02T22:00:00Z',whatsEnvios:1}}/>);expect(host.textContent).toContain('Enviado ao grupo em');
 await render(<SeloWhats solic={{...ap,whatsEnviadoEm:s.solicitadoEm,whatsEnvios:1}}/>);expect(host.textContent).toContain('falta enviar a mensagem assinada');   // toque do fluxo antigo, anterior à aprovação
});

test('gerencial aprova a qualquer momento (sem depender do WhatsApp) e líder não vê botões de aprovação',async()=>{
 const aprovar=jest.fn();
 await render(<AprovacaoInline solic={s} canApprove onAprovar={aprovar}/>);
 expect(btn('Aprovado').disabled).toBe(false);expect(btn('Negado').disabled).toBe(false);
 expect(btn('Aprovar mesmo sem envio')).toBeUndefined();                                   // a dispensa deixou de existir
 await click('Aprovado');expect(aprovar).toHaveBeenCalledWith('aprovado',undefined);
 await render(<AprovacaoInline solic={s} canApprove={false} onAprovar={aprovar}/>);
 expect(host.querySelectorAll('button')).toHaveLength(0);
});

test('múltiplo registra uma vez e AVISA que aguarda aprovação: nada de WhatsApp antes de aprovar',async()=>{
 const itens=Object.fromEntries(['Calça','Camisa / Camisão','Boné','Capa de Chuva','Galocha'].map(item=>[item,{usa:true,tamanho:'M'}]));
 const solicitar=jest.fn(async(id,lote)=>lote.map((i,n)=>({...s,...i,id:'id-'+n})));
 const colab={id:'c',nome:'Ana',uniforme:{listaMontada:true,itens,solicitacoes:[]}};
 await render(<UniformeModulo colab={colab} projectNome="P260A" canManage onSolicitar={solicitar}/>);
 await act(async()=>[...host.querySelectorAll('div')].find(el=>el.textContent.startsWith('📦 Uniforme e Material Tático')&&el.style.cursor==='pointer').click());
 await click('Uniforme completo');await click('Registrar 5 itens');
 expect(solicitar).toHaveBeenCalledTimes(1);expect(solicitar.mock.calls[0][1]).toHaveLength(5);
 expect(host.textContent).toContain('Aguardando aprovação do gerencial');expect(host.querySelector('[role="dialog"]')).toBeNull();
 expect(window.open).not.toHaveBeenCalled();expect(btn('Enviar no WhatsApp')).toBeUndefined();
 const cartao=sol=><UniformeModulo colab={{...colab,uniforme:{...colab.uniforme,solicitacoes:sol}}} canManage projectNome="P260A"/>;
 await render(cartao([s]));                                                                  // seção já aberta; aguardando: sem botão
 expect(host.textContent).toContain('Aguardando aprovação do gerencial');expect(btn('Enviar no WhatsApp')).toBeUndefined();
 await render(cartao([{...s,aprovacao:'negado'}]));expect(btn('Enviar no WhatsApp')).toBeUndefined();expect(host.textContent).toContain('Negada');
 await render(cartao([ap]));                                                                  // aprovada: botão liberado
 expect(btn('Enviar no WhatsApp')).toBeDefined();expect(host.textContent).toContain('Aprovada — falta enviar ao grupo');
 await render(cartao([{...ap,whatsEnviadoEm:'2026-10-02T22:00:00Z'}]));                         // enviado DEPOIS de aprovar
 expect(btn('Reenviar no WhatsApp')).toBeDefined();
 await render(cartao([{...ap,whatsEnviadoEm:s.solicitadoEm}]));                               // enviado ANTES de aprovar (fluxo antigo): precisa enviar de novo, assinado
 expect(btn('Reenviar no WhatsApp')).toBeUndefined();expect(btn('Enviar no WhatsApp')).toBeDefined();
});

test('várias aprovadas pendentes de envio: um botão só envia todas numa mensagem assinada',async()=>{
 const colab={id:'c',nome:'Ana',uniforme:{listaMontada:true,itens:{},solicitacoes:[{...ap,id:'a1-111111',item:'Boné'},{...ap,id:'a2-222222',item:'Calça'},{...s,id:'a3-333333',item:'Galocha'}]}};
 await render(<UniformeModulo colab={colab} projectNome="P260A" canManage onRegistrarWhats={jest.fn()}/>);
 await act(async()=>[...host.querySelectorAll('div')].find(el=>el.textContent.startsWith('📦 Uniforme e Material Tático')&&el.style.cursor==='pointer').click());
 expect(btn('Enviar aprovadas no WhatsApp (2)')).toBeDefined();                              // a aguardando fica de fora
 await click('Enviar aprovadas no WhatsApp (2)');
 expect(host.querySelector('[role="dialog"]')).not.toBeNull();expect(host.textContent).toContain('2 item(ns) aprovado(s)');
 expect(host.textContent).toContain('Aprovado pelo '+ASSINATURA_APROVADOR);
});

test('Aprovar todas da aba Aguardando exclui entregue legado e não fala mais em bloqueio',async()=>{
 const todas=jest.fn();const colab={id:'c',nome:'Ana',uniforme:{solicitacoes:[s,{...s,id:'livre',exigeWhats:false},{id:'legado',status:'entregue',solicitadoEm:s.solicitadoEm}]}};
 await render(<AprovacoesScreen colaboradores={[colab]} ano={2026} anos={[2026]} onTodas={todas}/>);
 expect(host.textContent).toContain('Aprovar todas (2)');expect(host.textContent).not.toContain('bloqueada');
 await click('Aprovar todas (2)');expect(todas).toHaveBeenCalledWith([{colabId:'c',solicId:s.id},{colabId:'c',solicId:'livre'}]);
});
