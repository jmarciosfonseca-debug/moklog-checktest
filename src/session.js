// Server-issued token, held only in this page's memory. Never persist PINs or tokens.
let current=null,pending=null;
export const SESSION_TIMEOUTS={gerencial:8*3600000,equipe:8*3600000,demo:8*3600000,ronda:8*3600000};
const announce=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('moklog-auth-changed'));};
try{localStorage.removeItem('moklog_session_v1');}catch{}
export function getSession(){if(current&&Date.now()>=current.exp)clearSession();return current;}
export function getAccess(pid){const s=getSession();if(!s)return null;if(['gerencial','demo'].includes(s.nivel))return 'admin';return s.nivel==='equipe'&&s.projectId===pid?'lider':null;}
export function isDemo(){return getSession()?.nivel==='demo';}
export function hasGerencial(){return ['gerencial','demo'].includes(getSession()?.nivel);}
export function getScopedProjectId(){const s=getSession();return s?.nivel==='equipe'?s.projectId:null;}
export function clearSession(){current=null;announce();}
export function touchSession(){getSession();}
export function grantSession(){return getSession();} // Legacy callbacks cannot manufacture access.
export async function checkPin(value,opts={}){
 const pin=String(value||'').trim();if(!pin||pending)return null;
 pending=(async()=>{
 const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin,...(opts.projectId?{pid:opts.projectId}:{}),...(opts.ronda?{ronda:true}:{})})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok||!data.ok){window.dispatchEvent(new CustomEvent('moklog-auth-error',{detail:data.erro||'Servidor de acesso indisponível.'}));return null;}
 if(!['admin','lider','demo','ronda'].includes(data.nivel)||typeof data.token!=='string'||!Number.isFinite(data.exp)||data.exp<=Date.now()||(data.nivel==='lider'&&opts.projectId&&data.pid!==opts.projectId))return null;
 if(opts.allowAdmin===false&&data.nivel==='admin')return null;
 if((opts.adminOnly||(!opts.projectId&&!opts.anyProject))&&!['admin','demo'].includes(data.nivel))return null;
 current={token:data.token,nivel:{admin:'gerencial',lider:'equipe',demo:'demo',ronda:'ronda'}[data.nivel],projectId:data.pid||null,exp:data.exp};announce();return data.nivel;
 })();
 try{return await pending;}catch{window.dispatchEvent(new CustomEvent('moklog-auth-error',{detail:'Sem conexão com o servidor de acesso.'}));return null;}finally{pending=null;}
}
export async function checkPinAnyProject(value){const level=await checkPin(value,{anyProject:true});return level?{level,projectId:getSession()?.projectId||null}:null;}
export function authHeaders(){const s=getSession();if(!s||s.nivel!=='gerencial')throw Error('Sessão gerencial ausente ou expirada. Entre novamente.');return {'Content-Type':'application/json',Authorization:'Bearer '+s.token};}
export async function authFetch(url,options={}){const r=await fetch(url,{...options,headers:{...options.headers,...authHeaders()}});if(r.status===401)clearSession();return r;}
