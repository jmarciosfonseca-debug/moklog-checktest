// Conflito de gravação (409) na Equipe: o app precisa SAIR da base antiga, senão cada nova tentativa
// reenvia a mesma base desatualizada e falha de novo (foi o que os líderes viram: toques repetidos, 409 repetido).
export const MSG_CONFLITO = "Outra pessoa alterou os dados ao mesmo tempo. Atualizei a tela com a versão mais recente: confira e repita a ação.";
export const MSG_CONFLITO_SEM_ATUALIZAR = "Outra pessoa alterou os dados ao mesmo tempo e não consegui atualizar a tela agora. Verifique a conexão, reabra a Equipe e repita a ação.";
// `recarregar` deve devolver true SOMENTE quando a tela foi realmente atualizada com a versão do servidor.
export async function tratarErroGravacao(err, recarregar) {
  if (err && err.status === 409) {
    let atualizou = false;
    try { atualizou = (await recarregar()) === true; } catch (_) { atualizou = false; }
    return atualizou ? MSG_CONFLITO : MSG_CONFLITO_SEM_ATUALIZAR;
  }
  return (err && err.message) || "Não foi possível salvar.";
}
// Executa a gravação e, em 409, atualiza a tela e troca a mensagem. Usado por TODAS as gravações da Equipe.
export async function gravarComRecuperacao(salvar, recarregar) {
  try { return await salvar(); }
  catch (e) { if (e && e.status === 409) e.message = await tratarErroGravacao(e, recarregar); throw e; }
}
