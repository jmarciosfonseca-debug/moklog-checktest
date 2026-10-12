// "Novo desde a última visita": guarda no aparelho quais avisos já estavam na tela na última vez que o usuário olhou.
// Só conveniência por aparelho (localStorage pode falhar ou vir vazio): sem ele, nada é marcado como novo.
const chave = (gerencial) => `moklog_avisos_visto_v1_${gerencial ? "g" : "o"}`;

export function lerVisto(gerencial, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    const v = JSON.parse(storage.getItem(chave(gerencial)) || "null");
    return v && Array.isArray(v.ids) ? { ids: v.ids.map(String), em: v.em || null } : null;
  } catch (e) { return null; }
}

// Grava exatamente os avisos atuais: o que foi resolvido sai da lista e, se voltar, aparece de novo como novo.
export function gravarVisto(gerencial, avisos, agora = new Date(), storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try { storage.setItem(chave(gerencial), JSON.stringify({ ids: avisos.map((a) => a.id), em: agora.toISOString() })); return true; } catch (e) { return false; }
}

// Primeira visita neste aparelho (visto = null): nada é "novo" — evita pintar tudo de novo no primeiro acesso.
export const marcarNovos = (avisos, visto) => avisos.map((a) => ({ ...a, novo: !!visto && !visto.ids.includes(a.id) }));
