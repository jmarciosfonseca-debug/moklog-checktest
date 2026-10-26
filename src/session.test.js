import {checkPin,checkPinAnyProject,getSession,getAccess,grantSession,clearSession,authFetch,touchSession,isDemo} from './session';
beforeEach(()=>{clearSession();global.fetch=jest.fn();});
afterEach(()=>{jest.restoreAllMocks();delete global.fetch;});
const reply=(nivel,pid)=>({ok:true,status:200,json:async()=>({ok:true,nivel,pid,token:'synthetic-token',exp:Date.now()+8*3600000})});
test('gerencial usa autenticação remota; o token (nunca o PIN) fica no aparelho pela janela de inatividade',async()=>{
 const local=jest.spyOn(Storage.prototype,'setItem');fetch.mockResolvedValue(reply('admin'));
 expect(await checkPin('synthetic-pin')).toBe('admin');expect(getAccess('P601')).toBe('admin');
 expect(local).toHaveBeenCalled();const gravado=local.mock.calls.at(-1)[1];expect(gravado).toContain('synthetic-token');expect(gravado).not.toContain('synthetic-pin');
 fetch.mockResolvedValue({status:200});await authFetch('/api/fv-plano',{method:'POST',body:JSON.stringify({pid:'P601',acao:'ler'})});
 const [url,opts]=fetch.mock.calls.at(-1);expect(url).toBe('/api/fv-plano');expect(opts.headers.Authorization).toBe('Bearer synthetic-token');expect(JSON.parse(opts.body)).not.toHaveProperty('pin');
});
test('líder limitado ao projeto e recusado em gates gerenciais/FV',async()=>{
 fetch.mockResolvedValue(reply('lider','P601'));expect(await checkPin('synthetic-pin')).toBeNull();expect(getSession()).toBeNull();
 expect((await checkPinAnyProject('synthetic-pin')).level).toBe('lider');expect(getAccess('P601')).toBe('lider');expect(getAccess('P602')).toBeNull();
 await expect(authFetch('/api/fv-plano')).rejects.toThrow('gerencial');
 expect(await checkPin('synthetic-pin',{projectId:'P602'})).toBeNull();expect(getAccess('P601')).toBe('lider');
});
test('callback legado não fabrica sessão; demo não recebe headers FV',async()=>{
 grantSession('admin');expect(getSession()).toBeNull();fetch.mockResolvedValue(reply('demo'));expect(await checkPin('synthetic-pin')).toBe('demo');expect(isDemo()).toBe(true);
 grantSession('admin');expect(isDemo()).toBe(true);await expect(authFetch('/api/fv-plano')).rejects.toThrow('gerencial');
});
test('janela de inatividade: gerencial 30 min renovada pelo toque, líder 15 min; teto = validade do servidor; 401 limpa sessão',async()=>{
 const now=Date.now();const clock=jest.spyOn(Date,'now').mockReturnValue(now);fetch.mockResolvedValue(reply('admin'));await checkPin('synthetic-pin');
 expect(getSession().exp).toBe(now+30*60000);
 clock.mockReturnValue(now+20*60000);touchSession();expect(getSession().exp).toBe(now+50*60000);   // renova a partir do toque
 clock.mockReturnValue(now+51*60000);expect(getSession()).toBeNull();                              // 31 min sem toque: caiu
 clock.mockReturnValue(now);fetch.mockResolvedValue({ok:true,status:200,json:async()=>({ok:true,nivel:'admin',token:'synthetic-token',exp:now+20*60000})});await checkPin('synthetic-pin');
 expect(getSession().exp).toBe(now+20*60000);clock.mockReturnValue(now+10*60000);touchSession();expect(getSession().exp).toBe(now+20*60000); // nunca passa do servidor
 clearSession();clock.mockReturnValue(now);fetch.mockResolvedValue(reply('lider','P601'));await checkPinAnyProject('synthetic-pin');expect(getSession().exp).toBe(now+15*60000);
 clock.mockReturnValue(now+16*60000);expect(getSession()).toBeNull();
 clock.mockReturnValue(now);fetch.mockResolvedValue(reply('admin'));
 clock.mockReturnValue(now);await checkPin('synthetic-pin');fetch.mockResolvedValue({status:401});await authFetch('/api/fv-read');expect(getSession()).toBeNull();
});
test('erro de rede/configuração não concede acesso; gate aguarda resposta assíncrona',async()=>{
 fetch.mockRejectedValue(Error('network'));expect(await checkPin('synthetic-pin')).toBeNull();expect(getSession()).toBeNull();
 let resolve;fetch.mockImplementation(()=>new Promise(r=>resolve=r));const promise=checkPin('synthetic-pin');expect(getSession()).toBeNull();resolve(reply('admin'));expect(await promise).toBe('admin');
});

test('cliente: só entra pelo Painel do Cliente e carrega o escopo; gerencial no painel vê tudo',async()=>{
 const {getClienteScope}=require('./session');
 clearSession();
 fetch.mockResolvedValue({ok:true,status:200,json:async()=>({ok:true,nivel:'cliente',escopo:'GOLGI',pids:['P601','P602'],token:'t',exp:Date.now()+8*3600000})});
 expect(await checkPin('synthetic-pin')).toBeNull();                       // tela de PIN comum recusa cliente
 expect(await checkPin('synthetic-pin',{projectId:'P601'})).toBeNull();
 expect(await checkPin('synthetic-pin',{cliente:true})).toBe('cliente');
 expect(getClienteScope()).toEqual({escopo:'GOLGI',pids:['P601','P602']});
 expect(getAccess('P601')).toBeNull();                                     // cliente nunca vira líder/admin
 clearSession();
 fetch.mockResolvedValue(reply('admin'));expect(await checkPin('synthetic-pin',{cliente:true})).toBe('admin');
 expect(getClienteScope()).toEqual({escopo:'MOKED',pids:null});
 clearSession();
 fetch.mockResolvedValue(reply('lider','P601'));expect(await checkPin('synthetic-pin',{cliente:true})).toBeNull();
});
