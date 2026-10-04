import {authFetchEquipe,isDemo} from './session';
export async function gravarSecaoEquipamentos(pid,section,before,after){
 if(isDemo())return {...before,[section]:after};
 const r=await authFetchEquipe('/api/equipamentos-save',{method:'POST',body:JSON.stringify({pid,section,before:before[section]??null,after})});
 const b=await r.json().catch(()=>({}));
 if(!r.ok||!b.ok||!b.data)throw Object.assign(Error(b.erro||'Falha ao salvar equipamentos.'),{status:r.status});
 return b.data;
}
