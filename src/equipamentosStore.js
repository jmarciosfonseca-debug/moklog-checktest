import {authFetchEquipe,isDemo} from './session';
export async function gravarSecaoEquipamentos(pid,section,before,after){
 if(isDemo())return {...before,[section]:after};
 const r=await authFetchEquipe('/api/equipamentos-save',{method:'POST',body:JSON.stringify({pid,section,before:before[section]??null,after})});
 const b=await r.json().catch(()=>({}));
 if(!r.ok||!b.ok||!b.data)throw Object.assign(Error(b.erro||'Falha ao salvar equipamentos.'),{status:r.status});
 return b.data;
}
// Baixa de um equipamento (líder com PIN ou gerencial): o servidor tira o item da lista ativa e guarda em `baixados`
// com motivo, quem e quando — numa gravação só. Devolve o documento atualizado.
export const MOTIVOS_BAIXA=['Substituído','Extraviado','Danificado / inservível','Devolvido','Outro'];
export async function darBaixaEquipamento(pid,{categoria,id,motivo,obs='',por=''},atual=null){
 if(isDemo()){const lista=(atual&&atual[categoria])||[];const alvo=lista.find(x=>x&&String(x.id)===String(id));return {...(atual||{}),[categoria]:lista.filter(x=>x!==alvo),baixados:[...((atual&&atual.baixados)||[]),...(alvo?[{...alvo,categoria,baixa:{motivo,obs,por,em:new Date().toISOString()}}]:[])]};}
 const r=await authFetchEquipe('/api/equipamentos-save',{method:'POST',body:JSON.stringify({pid,section:'baixa',before:null,after:{categoria,id,motivo,obs,por}})});
 const b=await r.json().catch(()=>({}));
 if(!r.ok||!b.ok||!b.data)throw Object.assign(Error(b.erro||'Falha ao dar baixa no equipamento.'),{status:r.status});
 return b.data;
}
