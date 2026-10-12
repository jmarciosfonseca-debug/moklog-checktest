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

// updatedAt aparece como número (Date.now) ou ISO: compara os dois do mesmo jeito.
export function normalizarAtualizacao(valor) {
  if(typeof valor==="number"&&Number.isFinite(valor))return valor;
  const parsed=Date.parse(valor||"");
  return Number.isFinite(parsed)?parsed:0;
}

export function criarDiagnosticoId(cryptoApi=globalThis.crypto) {
  if(typeof cryptoApi?.randomUUID==="function")return cryptoApi.randomUUID();
  return `diag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
}

// Um diagnóstico novo NÃO pode ser lido antes de existir: a regra de leitura nega o get de documento inexistente
// (era a causa do "Não foi possível salvar" na primeira gravação).
export function deveBuscarDiagnosticoRemoto(diagnosticoId) {
  return typeof diagnosticoId==="string"&&diagnosticoId.length>0;
}

// Consulta declara o escopo que as regras do Firestore exigem (sem isso a listagem é negada).
export function filtrosConsultaDiagnosticos(contexto,uid) {
  if(contexto?.tipo==="existente"&&contexto.projetoRef){
    return [["tipo","==","existente"],["projetoRef","==",contexto.projetoRef]];
  }
  if(contexto?.tipo==="novo"&&contexto.chave&&uid){
    return [["tipo","==","novo"],["projetoRef","==",null],["autorUid","==",uid]];
  }
  return [];
}

export function filtrarDiagnosticosPorEstado(diagnosticos=[],filtro="ativos") {
  return diagnosticos.filter(d=>filtro==="arquivados"?d?.estado==="arquivado":d?.estado!=="arquivado");
}

export function friendlyPersistError(error) {
  const code=String(error?.code||"");
  if(code.includes("permission-denied"))return "Seu perfil não tem permissão para salvar neste projeto.";
  if(/unavailable|network-request-failed/.test(code))return "Sem conexão com o Firestore. O rascunho local continua protegido.";
  if(code.includes("resource-exhausted"))return "O diagnóstico excedeu o limite aceito pelo Firestore.";
  return "Não foi possível salvar o diagnóstico no Firestore. O rascunho local continua protegido.";
}

// Numeração de revisões do projeto: ordem de criação (1 = primeira). Arquivados contam, para o número não mudar.
export function numerosRevisao(diagnosticos=[]) {
  const ordenados=[...diagnosticos].sort((a,b)=>String(a?.criadoEm||a?.atualizadoEm||"").localeCompare(String(b?.criadoEm||b?.atualizadoEm||"")));
  return ordenados.reduce((mapa,d,i)=>{if(d?.id)mapa[d.id]=i+1;return mapa;},{});
}

// Revisão contra a qual o relatório compara: a de origem (baseId) se houver; senão a salva imediatamente antes.
export function escolherAnterior(diagnosticos=[],atualId=null,baseId=null) {
  const outros=diagnosticos.filter(d=>d?.id&&d.id!==atualId&&d.respostas&&Object.keys(d.respostas).length);
  if(baseId){const base=outros.find(d=>d.id===baseId);if(base)return base;}
  const atual=diagnosticos.find(d=>d?.id===atualId);
  const marco=String(atual?.criadoEm||"");
  const candidatos=marco?outros.filter(d=>String(d.criadoEm||"")<marco):outros;
  return [...candidatos].sort((a,b)=>String(b.criadoEm||b.atualizadoEm||"").localeCompare(String(a.criadoEm||a.atualizadoEm||"")))[0]||null;
}

export function rotuloRevisaoDe(numero) {
  return numero?`Revisão ${numero}`:"";
}
