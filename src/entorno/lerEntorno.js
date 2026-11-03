// Leitura do Entorno pelo servidor (GET /api/entorno), com a sessão atual (gerencial, cliente ou líder).
// 03/11/2026: a coleção entorno não está liberada para leitura direta do navegador nas regras do Firestore.
import { getSession, clearSession } from "../session";

export async function lerEntorno(pid = null) {
  const s = getSession();
  if (!s || !s.token) return { docs: {}, geral: null, status: null, erro: "Sessão ausente ou expirada. Entre novamente." };
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const tmr = ctrl ? setTimeout(() => ctrl.abort(), 15000) : null;
  try {
    const r = await fetch("/api/entorno" + (pid ? `?pid=${encodeURIComponent(pid)}` : ""), { headers: { Authorization: "Bearer " + s.token }, ...(ctrl ? { signal: ctrl.signal } : {}) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) clearSession();
    if (!r.ok || !j.ok) return { docs: {}, geral: null, status: null, erro: j.erro || `Servidor respondeu ${r.status}.` };
    return { docs: j.docs || {}, geral: j.geral || null, status: j.status || null, erro: "" };
  } catch (e) {
    return { docs: {}, geral: null, status: null, erro: (e && e.name === "AbortError") ? "O servidor demorou a responder. Tente de novo." : "Sem conexão com o servidor." };
  } finally { if (tmr) clearTimeout(tmr); }
}
