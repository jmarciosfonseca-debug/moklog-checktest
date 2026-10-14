// Monta as ocupações do quadro (postos x ativos x vagas) dos 12 projetos para a Matriz de Dimensionamento de Efetivo.
// `lerEquipe(pid)` devolve o documento da equipe (ou null quando não há dado). Projeto sem dado fica de fora
// e a matriz avisa que os totais são parciais — nunca é preenchido com zero.
import { ORDEM_PROJETOS, ocupacaoDoQuadro } from './quadroPrevisto';

export async function carregarOcupacoes(lerEquipe, projetos = ORDEM_PROJETOS) {
  const ocupacoes = {};
  await Promise.all(projetos.map(async (pid) => {
    let d = null;
    try { d = await lerEquipe(pid); } catch (e) { d = null; }
    if (d) ocupacoes[pid] = ocupacaoDoQuadro(pid, d.colaboradores || []);
  }));
  return ocupacoes;
}
