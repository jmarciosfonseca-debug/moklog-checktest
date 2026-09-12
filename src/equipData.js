// ─────────────────────────────────────────────────────────────
// equipData.js — Fonte ÚNICA de leitura de equipamentos e de
// montagem da lista de projetos, para o seletor e o dashStats
// nunca mais divergirem.
//
// Antes: o seletor lia SÓ localStorage (mostrava "sem itens" para
// projetos fora do cache), enquanto o dashStats lia Firestore. E
// três construções de lista duplicavam Jatinox (P260A/B/C já estão
// em PROJECTS, mas eram re-adicionados). Isto elimina os dois.
//
// Regra de leitura (disciplina exigida): Firestore PRIORITÁRIO;
// o cache localStorage é usado APENAS se o documento não existir
// ou a leitura falhar. O cache NUNCA sobrescreve um documento
// Firestore existente.
// ─────────────────────────────────────────────────────────────

// Lista canônica de projetos SEM duplicação. Recebe o objeto
// PROJECTS e devolve seus valores — Jatinox (P260A/B/C) já está
// dentro de PROJECTS, então NÃO se acrescenta nada manualmente.
// Garante unicidade por id defensivamente.
export function listaProjetosUnica(PROJECTS) {
  const vistos = new Set();
  const out = [];
  for (const p of Object.values(PROJECTS || {})) {
    if (!p || !p.id || vistos.has(p.id)) continue;
    vistos.add(p.id);
    out.push(p);
  }
  return out;
}

// Lê o documento de equipamentos de um projeto.
// deps: { db, doc, getDoc, getCache } — injetáveis para teste.
//   getCache(pid) → objeto do cache local ou null.
// Retorna { data, fonte } onde fonte ∈ "firestore" | "cache" | "vazio".
// Firestore prioritário: só usa cache se o doc não existir OU a
// leitura lançar erro. Nunca deixa o cache sobrescrever o Firestore.
export async function loadEquipData(pid, deps) {
  const { db, doc, getDoc, getCache } = deps || {};
  // 1) Firestore primeiro.
  try {
    const snap = await getDoc(doc(db, "equipamentos", pid));
    if (snap && snap.exists && snap.exists()) {
      return { data: snap.data(), fonte: "firestore" };
    }
    // Documento não existe → tenta cache como fallback.
  } catch (e) {
    // Leitura falhou → tenta cache como fallback.
  }
  // 2) Fallback: cache local, apenas se Firestore não trouxe nada.
  try {
    const cached = getCache ? getCache(pid) : null;
    if (cached) return { data: cached, fonte: "cache" };
  } catch (e) {}
  return { data: null, fonte: "vazio" };
}

// Categorias canônicas de equipamento (estrutura oficial).
export const EQUIP_CATS = ["smartphones","radiosHT","armamento","municao","placas","lanternas","ztrax","bodycam"];

// Conta itens de um documento de equipamentos, sem duplicar.
// Retorna { total, inop, parcial }.
export function contarEquip(data) {
  if (!data) return { total: 0, inop: 0, parcial: 0 };
  let total = 0, inop = 0, parcial = 0;
  const contar = (it) => {
    if (!it || typeof it !== "object" || !it.status) return;
    total++;
    if (it.status === "inop" || it.status === "critico") inop++;
    else if (it.status === "parcial" || it.status === "baixo") parcial++;
  };
  EQUIP_CATS.forEach(k => { if (Array.isArray(data[k])) data[k].forEach(contar); });
  if (data.moto) contar(data.moto);
  return { total, inop, parcial };
}
