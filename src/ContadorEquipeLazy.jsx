// Contador do card da Equipe na Home. A regra de quando aparece (janela do fim de semana, projeto sem checagem) fica AQUI,
// em módulos leves; só então baixa a tela da Equipe (300 KB). Fora da janela a Home nem toca nesse arquivo.
import React, { Suspense } from "react";
import { janelaChecagemAberta, useAtualizarAoVoltar } from "./janelaChecagem";
import { CHK_EQ_SEM_CHECAGEM } from "./checagemEquipeRegras";
import { lazyTela } from "./lazyTela";

const Real = lazyTela(() => import("./Equipe").then((m) => ({ default: m.ContadorEquipe })));

export default function ContadorEquipe({ projectId }) {
  useAtualizarAoVoltar();
  if (!(janelaChecagemAberta() && !CHK_EQ_SEM_CHECAGEM.includes(projectId))) return null;
  return <Suspense fallback={null}><Real projectId={projectId} /></Suspense>;
}
