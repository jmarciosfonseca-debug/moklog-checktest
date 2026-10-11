// lixeira.js — nada é apagado de verdade sem deixar cópia.
// Antes de qualquer deleteDoc (fireGuard) e de excluir relatório, salvamos uma cópia em
// "lixeira/" (caminho, dados, data, quem). Também fica uma cópia local no aparelho.
// Falha ao copiar NUNCA impede o uso do app (regras/offline), mas é registrada.
import { getFirestore, doc, getDocFromServer, setDoc } from "firebase/firestore";

const LOCAL_KEY = "mk_lixeira_local_v1";

function guardarLocal(item) {
  try {
    const lista = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    lista.unshift(item);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(lista.slice(0, 30)));
  } catch { /* sem espaço/privado: ignora */ }
}
export function lixeiraLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch { return []; }
}

export async function arquivarItem(tipo, caminho, dados, extra = {}) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const item = { tipo, caminho, excluidoEm: new Date().toISOString(), dados: JSON.stringify(dados ?? null), ...extra };
  guardarLocal({ id, ...item });
  try {
    await setDoc(doc(getFirestore(), "lixeira", id), item);
    return true;
  } catch (e) {
    try { console.warn("[lixeira] cópia no servidor falhou (cópia local mantida):", e && e.message); } catch {}
    return false;
  }
}

// Copia o documento atual (lido do servidor) para a lixeira antes de apagar.
export async function arquivarDoc(ref) {
  try {
    const snap = await getDocFromServer(ref);
    if (snap.exists()) await arquivarItem("documento", ref.path, snap.data());
  } catch (e) {
    try { console.warn("[lixeira] não foi possível ler antes de excluir:", e && e.message); } catch {}
  }
}
