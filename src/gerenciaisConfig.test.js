// Teste anti-órfão de recursos gerenciais.
// Falha se um recurso habilitado no registro não tiver ação/ponto de
// entrada implementado. Trava a regressão que deixou a Visão 360 órfã.

import { RECURSOS_GERENCIAIS, recursosHabilitados, isRecursoGerencial } from "./gerenciaisConfig";

// IDs que TÊM ação acionável implementada no menu do Dashboard (App.jsx).
// Ao adicionar um recurso ao registro, o dev DEVE adicionar seu id aqui e
// mapear a ação no App.jsx — senão este teste falha, sinalizando órfão.
const IDS_COM_ACAO = ["visao-360"];

export function run() {
  let pass=0, fail=0;
  const ok=(n,c)=>{ c?pass++:(fail++,console.log("FAIL:",n)); };

  // 1) Todo recurso HABILITADO precisa ter ação implementada.
  for(const r of recursosHabilitados()){
    ok(`recurso habilitado '${r.id}' tem acao`, IDS_COM_ACAO.includes(r.id));
  }

  // 2) Todo id com ação precisa existir e estar habilitado no registro
  //    (evita ação apontando para recurso removido/desabilitado).
  for(const id of IDS_COM_ACAO){
    ok(`acao '${id}' existe e habilitada`, isRecursoGerencial(id));
  }

  // 3) IDs únicos no registro.
  const ids = RECURSOS_GERENCIAIS.map(r=>r.id);
  ok("ids unicos", ids.length===new Set(ids).size);

  // 4) Cada recurso tem label e ícone (botão renderizável).
  for(const r of RECURSOS_GERENCIAIS){
    ok(`'${r.id}' tem label e icone`, !!r.label && !!r.icone);
  }

  // 5) visao-360 continua registrada e habilitada (regressão específica).
  ok("visao-360 registrada e habilitada", isRecursoGerencial("visao-360"));

  console.log(`\n${pass} passaram, ${fail} falharam`);
  return fail===0;
}

if (typeof require !== "undefined" && require.main === module) {
  process.exit(run() ? 0 : 1);
}
