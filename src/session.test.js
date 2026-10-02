import {checkPin,checkPinAnyProject,getSession,getAccess,grantSession,clearSession,authFetch,touchSession,isDemo} from './session';
beforeEach(()=>{clearSession();global.fetch=jest.fn();});
afterEach(()=>{jest.restoreAllMocks();delete global.fetch;});
const reply=(nivel,pid)=>({ok:true,status:200,json:async()=>({ok:true,nivel,pid,token:'synthetic-token',exp:Date.now()+8*3600000})});
test('gerencial usa autenticação remota e token em memória, nunca no armazenamento',async()=>{
 const local=jest.spyOn(Storage.prototype,'setItem');fetch.mockResolvedValue(reply('admin'));
 expect(await checkPin('synthetic-pin')).toBe('admin');expect(getAccess('P601')).toBe('admin');expect(local).not.toHaveBeenCalled();
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
test('8 horas é expiração absoluta, atividade não prolonga; 401 limpa sessão',async()=>{
 const now=Date.now();const clock=jest.spyOn(Date,'now').mockReturnValue(now);fetch.mockResolvedValue(reply('admin'));await checkPin('synthetic-pin');
 clock.mockReturnValue(now+7*3600000);touchSession();expect(getSession().exp).toBe(now+8*3600000);
 clock.mockReturnValue(now+8*3600000);expect(getSession()).toBeNull();
 clock.mockReturnValue(now);await checkPin('synthetic-pin');fetch.mockResolvedValue({status:401});await authFetch('/api/fv-read');expect(getSession()).toBeNull();
});
test('erro de rede/configuração não concede acesso; gate aguarda resposta assíncrona',async()=>{
 fetch.mockRejectedValue(Error('network'));expect(await checkPin('synthetic-pin')).toBeNull();expect(getSession()).toBeNull();
 let resolve;fetch.mockImplementation(()=>new Promise(r=>resolve=r));const promise=checkPin('synthetic-pin');expect(getSession()).toBeNull();resolve(reply('admin'));expect(await promise).toBe('admin');
});
