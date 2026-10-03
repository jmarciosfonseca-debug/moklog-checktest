export const hoje=()=>new Date().toLocaleDateString("sv-SE");
export const draftKey=(uid,pid)=>"single:v1:"+uid+":"+pid;
export function lerDraft(storage,key){try{return JSON.parse(storage.getItem(key)||"null");}catch{return null;}}
export function salvarDraft(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export function novoId(nome){const slug=String(nome).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,50);return "sg_"+slug+"_"+Date.now().toString(36)+"_"+crypto.randomUUID().slice(0,8);}
