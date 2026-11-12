// CPF do colaborador (Marcio, 12/11/2026). O cadastro da equipe é lido direto pelo app, então o CPF NUNCA fica
// em texto no documento: o servidor cifra (AES-256-GCM, chave só no servidor) e guarda apenas
//   cpfCifrado  — o número cifrado (só o servidor abre, e só para o consultor);
//   cpfFinal    — os 2 últimos dígitos, para a tela mostrar •••.•••.•••-NN;
//   cpfHmac     — impressão com chave, para no futuro localizar o colaborador pelo CPF sem expor o número.
const crypto=require('crypto');
const erro=(status,msg)=>Object.assign(new Error(msg),{status});
const digitos=v=>String(v==null?'':v).replace(/\D/g,'');
function valido(v){
 const d=digitos(v);if(d.length!==11||/^(\d)\1{10}$/.test(d))return false;
 const dv=n=>{let s=0;for(let i=0;i<n;i++)s+=Number(d[i])*(n+1-i);const r=(s*10)%11;return r===10?0:r;};
 return dv(9)===Number(d[9])&&dv(10)===Number(d[10]);
}
function chave(env=process.env){
 const h=String(env.CPF_CHAVE||'');
 if(!/^[a-f0-9]{64}$/i.test(h))throw erro(503,'Cadastro de CPF ainda não habilitado no servidor. O restante não foi alterado; tente sem o CPF.');
 return Buffer.from(h,'hex');
}
function cifrar(cpf,env){
 const k=chave(env),iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',k,iv);
 const corpo=Buffer.concat([c.update(digitos(cpf),'utf8'),c.final()]);
 return ['v1',iv.toString('hex'),c.getAuthTag().toString('hex'),corpo.toString('hex')].join(':');
}
function decifrar(texto,env){
 const m=/^v1:([a-f0-9]{24}):([a-f0-9]{32}):([a-f0-9]+)$/i.exec(String(texto||''));if(!m)return null;
 try{const d=crypto.createDecipheriv('aes-256-gcm',chave(env),Buffer.from(m[1],'hex'));d.setAuthTag(Buffer.from(m[2],'hex'));
  return Buffer.concat([d.update(Buffer.from(m[3],'hex')),d.final()]).toString('utf8');}catch(e){if(e.status)throw e;return null;}
}
const hmac=(cpf,env)=>crypto.createHmac('sha256',chave(env)).update('cpf:'+digitos(cpf)).digest('hex');
const DERIVADOS=['cpfCifrado','cpfFinal','cpfHmac'];
// Antes de gravar: todo "cpf" em texto que veio da tela vira os três campos protegidos. "" apaga o CPF.
function protegerCpfs(doc,env){
 for(const lista of [doc&&doc.colaboradores,doc&&doc.desligados])for(const c of Array.isArray(lista)?lista:[]){
  if(!c||typeof c!=='object'||!('cpf' in c))continue;
  const d=digitos(c.cpf);delete c.cpf;
  if(!d){for(const k of DERIVADOS)delete c[k];continue;}
  if(!valido(d))throw erro(400,'CPF inválido. Confira os 11 dígitos.');
  c.cpfCifrado=cifrar(d,env);c.cpfFinal=d.slice(9);c.cpfHmac=hmac(d,env);
 }
 return doc;
}
const formatar=d=>{const x=digitos(d);return x.length===11?`${x.slice(0,3)}.${x.slice(3,6)}.${x.slice(6,9)}-${x.slice(9)}`:x;};
module.exports={valido,digitos,cifrar,decifrar,hmac,protegerCpfs,formatar,DERIVADOS};
