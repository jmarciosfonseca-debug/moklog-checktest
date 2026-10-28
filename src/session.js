// Token emitido pelo servidor. O PIN nunca é guardado; o token fica na memória e, por decisão do Marcio (26/10/2026),
// também no aparelho por uma janela curta de inatividade — gerencial/cliente 30 min, líder 15 min — para não pedir PIN
// a cada troca de tela ou ao fechar e reabrir. A janela renova a cada toque; o teto é a validade do token no servidor.
let current=null,pending=null;
export const SESSION_TIMEOUTS={gerencial:30*60000,equipe:15*60000,demo:30*60000,ronda:15*60000,cliente:30*60000};
const CHAVE='moklog_session_v2';
const announce=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('moklog-auth-changed'));};
try{localStorage.removeItem('moklog_session_v1');}catch{}
let ultimaGravacao=0;
function persistir(force){try{if(!current){localStorage.removeItem(CHAVE);return;}const t=Date.now();if(!force&&t-ultimaGravacao<10000)return;ultimaGravacao=t;localStorage.setItem(CHAVE,JSON.stringify(current));}catch{}}
function restaurar(){try{const raw=localStorage.getItem(CHAVE);if(!raw)return;const s=JSON.parse(raw);if(!s||typeof s.token!=='string'||!SESSION_TIMEOUTS[s.nivel]||!Number.isFinite(s.exp)||!Number.isFinite(s.srvExp)||s.exp<=Date.now()||s.srvExp<=Date.now()){localStorage.removeItem(CHAVE);return;}current=s;}catch{}}
restaurar();
const janela=(nivel,srvExp)=>Math.min(srvExp,Date.now()+SESSION_TIMEOUTS[nivel]);
export function getSession(){if(current&&Date.now()>=current.exp)clearSession();return current;}
export function getAccess(pid){const s=getSession();if(!s)return null;if(['gerencial','demo'].includes(s.nivel))return 'admin';return s.nivel==='equipe'&&s.projectId===pid?'lider':null;}
export function isDemo(){return getSession()?.nivel==='demo';}
export function hasGerencial(){return ['gerencial','demo'].includes(getSession()?.nivel);}
export function getScopedProjectId(){const s=getSession();return s?.nivel==='equipe'?s.projectId:null;}
// Painel do Cliente: {escopo:'GOLGI'|'P601', pids:[...]} ou null. Gerencial/demo veem todos (escopo 'MOKED').
export function getClienteScope(){const s=getSession();if(!s)return null;if(s.nivel==='cliente')return {escopo:s.escopo,pids:s.pids||[]};if(['gerencial','demo'].includes(s.nivel))return {escopo:'MOKED',pids:null};return null;}
export function clearSession(){current=null;persistir(true);announce();}
export function touchSession(){const s=getSession();if(!s)return;s.exp=janela(s.nivel,s.srvExp);persistir(false);}
export function grantSession(){return getSession();} // Legacy callbacks cannot manufacture access.
export async function checkPin(value,opts={}){
 const pin=String(value||'').trim();if(!pin||pending)return null;
 pending=(async()=>{
 // Sem resposta em 12 s o pedido é abortado: antes, um fetch pendurado deixava `pending` preso e todo PIN seguinte
 // voltava "inválido" até recarregar a página (relato do Marcio no computador, 28/10/2026).
 const ctrl=typeof AbortController!=='undefined'?new AbortController():null;const tmr=ctrl?setTimeout(()=>ctrl.abort(),12000):null;
 let r;try{r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin,...(opts.projectId?{pid:opts.projectId}:{}),...(opts.ronda?{ronda:true}:{})}),...(ctrl?{signal:ctrl.signal}:{})});}finally{if(tmr)clearTimeout(tmr);}
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.ok){window.dispatchEvent(new CustomEvent('moklog-auth-error',{detail:data.erro||'Servidor de acesso indisponível.'}));return null;}
 if(!['admin','lider','demo','ronda','cliente'].includes(data.nivel)||typeof data.token!=='string'||!Number.isFinite(data.exp)||data.exp<=Date.now()||(data.nivel==='lider'&&opts.projectId&&data.pid!==opts.projectId))return null;
 if(opts.allowAdmin===false&&data.nivel==='admin')return null;
 if(data.nivel==='cliente'&&!opts.cliente)return null; // PIN de cliente só entra pelo Painel do Cliente
 if(opts.cliente&&!['cliente','admin','demo'].includes(data.nivel))return null;
 if((opts.adminOnly||(!opts.projectId&&!opts.anyProject&&!opts.cliente))&&!['admin','demo'].includes(data.nivel))return null;
 const nivel={admin:'gerencial',lider:'equipe',demo:'demo',ronda:'ronda',cliente:'cliente'}[data.nivel];
 current={token:data.token,nivel,projectId:data.pid||null,srvExp:data.exp,exp:janela(nivel,data.exp),...(data.nivel==='cliente'?{escopo:data.escopo,pids:Array.isArray(data.pids)?data.pids:[]}:{})};persistir(true);announce();return data.nivel;
 })();
 try{return await pending;}catch{window.dispatchEvent(new CustomEvent('moklog-auth-error',{detail:'Sem conexão com o servidor de acesso.'}));return null;}finally{pending=null;}
}
export async function checkPinAnyProject(value){const level=await checkPin(value,{anyProject:true});return level?{level,projectId:getSession()?.projectId||null}:null;}
export function authHeaders(){const s=getSession();if(!s||s.nivel!=='gerencial')throw Error('Sessão gerencial ausente ou expirada. Entre novamente.');return {'Content-Type':'application/json',Authorization:'Bearer '+s.token};}
export async function authFetch(url,options={}){const r=await fetch(url,{...options,headers:{...options.headers,...authHeaders()}});if(r.status===401)clearSession();return r;}
// Exclusivo da Equipe. O servidor valida também o projeto do líder; FV segue gerencial.
export function authHeadersEquipe(){const s=getSession();if(!s||!['gerencial','equipe'].includes(s.nivel))throw Error('Sessão ausente ou expirada. Entre novamente com o PIN.');return {'Content-Type':'application/json',Authorization:'Bearer '+s.token};}
export async function authFetchEquipe(url,options={}){const r=await fetch(url,{...options,headers:{...options.headers,...authHeadersEquipe()}});if(r.status===401)clearSession();return r;}
