import { STATUS_ITEM_LISTA } from "./catalogoSchema";

export const DIAGNOSTICO_DRAFT_PREFIX = "moklog_diagnostico_draft_v1";

export function draftStorageKey(catalogoId, uid) {
  return `${DIAGNOSTICO_DRAFT_PREFIX}:${catalogoId}:${uid}`;
}

export function buildCatalogSections(catalogo, itens) {
  const categorias = Array.isArray(catalogo?.categorias) ? catalogo.categorias : [];
  const subcategorias = Array.isArray(catalogo?.subcategorias) ? catalogo.subcategorias : [];
  const ativos = (Array.isArray(itens) ? itens : [])
    .filter((item) => item && item.deprecado !== true)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  return [...categorias]
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .map((categoria) => ({
      ...categoria,
      subcategorias: subcategorias
        .filter((subcategoria) => subcategoria.categoria === categoria.id)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map((subcategoria) => ({
          ...subcategoria,
          itens: ativos.filter((item) => item.subcategoria === subcategoria.id),
        })),
    }));
}

export function calculateProgress(itens, respostas = {}) {
  const ativos = (Array.isArray(itens) ? itens : []).filter((item) => item && item.deprecado !== true);
  const respondidos = ativos.filter((item) => STATUS_ITEM_LISTA.includes(respostas[item.id]?.status)).length;
  const avaliados = ativos.filter((item) => {
    const status = respostas[item.id]?.status;
    return STATUS_ITEM_LISTA.includes(status) && status !== "na" && status !== "sem_dado";
  }).length;
  const total = ativos.length;
  return { total, respondidos, avaliados, percentual: total ? Math.round((respondidos / total) * 100) : 0 };
}

export function readDraft(storage, key, versao) {
  try {
    const parsed = JSON.parse(storage.getItem(key) || "null");
    if (!parsed || parsed.versao !== versao || typeof parsed.respostas !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft(storage, key, draft) {
  storage.setItem(key, JSON.stringify(draft));
}
