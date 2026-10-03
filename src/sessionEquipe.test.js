import {checkPin,getSession,clearSession,authFetch,authFetchEquipe} from './session';
beforeEach(()=>{clearSession();global.fetch=jest.fn();});
afterEach(()=>{jest.restoreAllMocks();delete global.fetch;});
const reply=(nivel,pid)=>({ok:true,status:200,json:async()=>({ok:true,nivel,pid,token:'synthetic-token',exp:Date.now()+8*3600000})});
const entrar=async(nivel,pid,opts)=>{fetch.mockResolvedValue(reply(nivel,pid));await checkPin('synthetic-pin',opts);fetch.mockReset();fetch.mockResolvedValue({status:200});};
test('líder grava na Equipe; FV continua gerencial',async()=>{
 await entrar('lider','P601',{projectId:'P601'});
 expect(getSession().nivel).toBe('equipe');
 await authFetchEquipe('/api/equipe-save',{method:'POST',body:'{}'});
 expect(fetch.mock.calls.at(-1)[1].headers.Authorization).toBe('Bearer synthetic-token');
 await expect(authFetch('/api/fv-plano')).rejects.toThrow('gerencial');
});
test('gerencial grava na Equipe e no FV',async()=>{
 await entrar('admin');await authFetchEquipe('/api/equipe-save');await authFetch('/api/fv-plano');
 expect(fetch.mock.calls.map(c=>c[0])).toEqual(['/api/equipe-save','/api/fv-plano']);
});
test('demo, ronda e ausência de sessão bloqueados',async()=>{
 await expect(authFetchEquipe('/api/equipe-save')).rejects.toThrow('Sessão ausente ou expirada');
 await entrar('demo');await expect(authFetchEquipe('/api/equipe-save')).rejects.toThrow('Sessão ausente ou expirada');
 clearSession();await entrar('ronda','P601',{ronda:true,projectId:'P601'});
 await expect(authFetchEquipe('/api/equipe-save')).rejects.toThrow('Sessão ausente ou expirada');
});
test('401 limpa sessão sem modificar o corpo da edição',async()=>{
 await entrar('lider','P601',{projectId:'P601'});fetch.mockResolvedValue({status:401});
 const options={method:'POST',body:'{"rascunho":"preservado"}'};
 await authFetchEquipe('/api/equipe-save',options);expect(getSession()).toBeNull();
 expect(options.body).toBe('{"rascunho":"preservado"}');
});
