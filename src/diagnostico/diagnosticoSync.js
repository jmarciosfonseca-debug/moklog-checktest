export function mergeRespostasPorAtualizacao(remotas={}, locais={}) {
  const merged={...remotas};
  Object.entries(locais).forEach(([id,local])=>{
    const remote=remotas[id];
    const lt=normalizarAtualizacao(local?.updatedAt);
    const rt=normalizarAtualizacao(remote?.updatedAt);
    if(!remote||lt>=rt) merged[id]=local;
  });
  return merged;
}

export function normalizarAtualizacao(valor) {
  if(typeof valor==="number"&&Number.isFinite(valor))return valor;
  const parsed=Date.parse(valor||"");
  return Number.isFinite(parsed)?parsed:0;
}

export function criarDiagnosticoId(cryptoApi=globalThis.crypto) {
  if(typeof cryptoApi?.randomUUID==="function")return cryptoApi.randomUUID();
  return `diag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
}

export function deveBuscarDiagnosticoRemoto(diagnosticoId) {
  return typeof diagnosticoId==="string"&&diagnosticoId.length>0;
}

export function filtrosConsultaDiagnosticos(contexto,uid) {
  if(contexto?.tipo==="existente"&&contexto.projetoRef){
    return [["tipo","==","existente"],["projetoRef","==",contexto.projetoRef]];
  }
  if(contexto?.tipo==="novo"&&contexto.chave&&uid){
    return [["tipo","==","novo"],["projetoRef","==",null],["autorUid","==",uid]];
  }
  return [];
}
