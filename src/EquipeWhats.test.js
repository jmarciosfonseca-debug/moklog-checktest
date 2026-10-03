import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {FolhaWhats,SeloWhats} from './EquipeWhats';
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

test('folha usa novo clique para abrir WhatsApp; falha mostra retry idempotente',async()=>{
 const registrar=jest.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({});
 await render(<FolhaWhats solicitacoes={[s]} colab={{id:'c',nome:'Ana'}} projectNome="P260A" onRegistrar={registrar} onFechar={()=>{}}/>);
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
 await render(<FolhaWhats solicitacoes={[s]} colab={{id:'c',nome:'Ana'}} projectNome="P260A" onRegistrar={registrar} onFechar={()=>{}}/>);
 await click('Enviar no WhatsApp');
 expect(janela.opener).toBeNull();expect(janela.location.replace).not.toHaveBeenCalled();
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
 document.dispatchEvent(new Event('visibilitychange'));
 expect(janela.location.replace).not.toHaveBeenCalled();
 await act(async()=>resolver());
 expect(janela.location.replace).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/?text='));
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
});

test('legado é cinza, novo líder fica bloqueado e enviado mostra horário',async()=>{
 await render(<SeloWhats solic={{}}/>);expect(host.textContent).toBe('Sem registro de envio');
 await render(<SeloWhats solic={s}/>);expect(host.textContent).toContain('🔒');
 await render(<SeloWhats solic={{...s,whatsEnviadoEm:s.solicitadoEm,whatsEnvios:1}}/>);expect(host.textContent).toContain('Enviado em');
});

test('gerencial precisa confirmar dispensa e líder não vê aprovação',async()=>{
 const aprovar=jest.fn();jest.spyOn(window,'confirm').mockReturnValue(false);
 await render(<AprovacaoInline solic={s} canApprove onAprovar={aprovar}/>);
 expect(btn('Aprovado').disabled).toBe(true);expect(btn('Negado').disabled).toBe(false);
 await click('Aprovar mesmo sem envio');expect(aprovar).not.toHaveBeenCalled();
 window.confirm.mockReturnValue(true);await click('Aprovar mesmo sem envio');
 expect(aprovar).toHaveBeenCalledWith('aprovado',{dispensarWhats:true});
 await render(<AprovacaoInline solic={s} canApprove={false} onAprovar={aprovar}/>);
 expect(host.querySelectorAll('button')).toHaveLength(0);
});

test('múltiplo registra uma vez e depois abre folha; enviar depois deixa pendente',async()=>{
 const itens=Object.fromEntries(['Calça','Camisa / Camisão','Boné','Capa de Chuva','Galocha'].map(item=>[item,{usa:true,tamanho:'M'}]));
 const solicitar=jest.fn(async(id,lote)=>lote.map((i,n)=>({...s,...i,id:'id-'+n})));
 const colab={id:'c',nome:'Ana',uniforme:{listaMontada:true,itens,solicitacoes:[]}};
 await render(<UniformeModulo colab={colab} projectNome="P260A" canManage onSolicitar={solicitar}/>);
 await act(async()=>[...host.querySelectorAll('div')].find(el=>el.textContent.startsWith('📦 Uniforme e Material Tático')&&el.style.cursor==='pointer').click());
 await click('Uniforme completo');await click('Registrar 5 itens');
 expect(solicitar).toHaveBeenCalledTimes(1);expect(solicitar.mock.calls[0][1]).toHaveLength(5);
 expect(host.textContent).toContain('Solicitação registrada');expect(window.open).not.toHaveBeenCalled();
 await click('Enviar depois');expect(host.querySelector('[role="dialog"]')).toBeNull();
 await render(<UniformeModulo colab={{...colab,uniforme:{...colab.uniforme,solicitacoes:[s]}}} canManage projectNome="P260A"/>);
 expect(host.textContent).toContain('🔒 Envio ao WhatsApp pendente');
 await render(<UniformeModulo colab={{...colab,uniforme:{...colab.uniforme,solicitacoes:[{...s,whatsEnviadoEm:s.solicitadoEm}]}}} canManage projectNome="P260A"/>);
 expect(btn('Reenviar no WhatsApp')).toBeDefined();
});

test('Aprovar todas da aba Aguardando exclui entregue legado',async()=>{
 const todas=jest.fn();const colab={id:'c',nome:'Ana',uniforme:{solicitacoes:[s,{...s,id:'livre',exigeWhats:false},{id:'legado',status:'entregue',solicitadoEm:s.solicitadoEm}]}};
 await render(<AprovacoesScreen colaboradores={[colab]} ano={2026} anos={[2026]} onTodas={todas}/>);
 expect(host.textContent).toContain('Aprovar todas (2)');expect(host.textContent).toContain('1 bloqueadas');
 await click('Aprovar todas (2)');expect(todas).toHaveBeenCalledWith([{colabId:'c',solicId:s.id},{colabId:'c',solicId:'livre'}]);
});
