export function mergeRespostasPorAtualizacao(remotas={}, locais={}) {
  const merged={...remotas};
  Object.entries(locais).forEach(([id,local])=>{
    const remote=remotas[id];
    const lt=Date.parse(local?.updatedAt||"")||0;
    const rt=Date.parse(remote?.updatedAt||"")||0;
    if(!remote||lt>=rt) merged[id]=local;
  });
  return merged;
}
