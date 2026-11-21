// Liga/desliga o modo offline (service worker v2). Tudo aqui é CAUTELA:
//  - quem manda é a chave remota public/offline-config.json (ativo + perfis). Padrão: DESLIGADO;
//  - ativo=false desliga e apaga os caches em todos os aparelhos na próxima abertura;
//  - sem conseguir ler a chave (sem internet, erro): NÃO muda nada (nem liga, nem desliga);
//  - a versão nova nunca entra sozinha: oferece "Atualizar" e só troca quando o usuário aceita.
const CONFIG_URL = "/offline-config.json";
const SW_URL = "/sw.js";
const A_CADA_MS = 10 * 60000;

export async function lerConfig(fetchFn = typeof fetch !== "undefined" ? fetch : null, ms = 4000) {
  if (!fetchFn) return null;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
  try {
    const r = await fetchFn(`${CONFIG_URL}?t=${Date.now()}`, { cache: "no-store", ...(ctrl ? { signal: ctrl.signal } : {}) });
    if (!r || !r.ok) return null;
    const j = await r.json();
    return j && typeof j === "object" ? j : null;
  } catch { return null; } finally { if (t) clearTimeout(t); }
}

// "ligar" | "desligar" | "manter"
export function decidir(config, perfil) {
  if (!config) return "manter";
  if (config.ativo === false) return "desligar";
  if (config.ativo === true && perfil && Array.isArray(config.perfis) && (config.perfis.includes(perfil) || config.perfis.includes("todos"))) return "ligar";
  return "manter";
}

export async function desligar({ nav = typeof navigator !== "undefined" ? navigator : null, cacheApi = typeof caches !== "undefined" ? caches : null } = {}) {
  try { const regs = nav && nav.serviceWorker && nav.serviceWorker.getRegistrations ? await nav.serviceWorker.getRegistrations() : []; await Promise.all(regs.map((r) => r.unregister())); } catch { /* melhor-esforço */ }
  try { if (cacheApi) { const ks = await cacheApi.keys(); await Promise.all(ks.filter((k) => k.indexOf("mk-") === 0).map((k) => cacheApi.delete(k))); } } catch { /* melhor-esforço */ }
}

let ligado = false;
export const _reiniciarSW = () => { ligado = false; };

/**
 * @param perfil  nivel da sessão ("demo", "gerencial", "cliente", "equipe") ou null antes do login
 * @param onAtualizacao  ({ aplicar }) quando há versão nova esperando; aplicar() troca e recarrega
 */
export async function iniciarOffline({ perfil = null, onAtualizacao, nav = typeof navigator !== "undefined" ? navigator : null, win = typeof window !== "undefined" ? window : null, fetchFn, agora = () => Date.now(), cacheApi } = {}) {
  if (!nav || !nav.serviceWorker) return "indisponivel";
  const acao = decidir(await lerConfig(fetchFn), perfil);
  if (acao === "desligar") { ligado = false; await desligar({ nav, ...(cacheApi !== undefined ? { cacheApi } : {}) }); return "desligado"; }
  if (acao !== "ligar") return "mantido";
  if (ligado) return "ligado";
  ligado = true;
  let reg;
  try { reg = await nav.serviceWorker.register(SW_URL); } catch { ligado = false; return "erro"; }
  const oferecer = (w) => { if (onAtualizacao) onAtualizacao({ aplicar: () => { nav.serviceWorker.addEventListener("controllerchange", () => win && win.location.reload(), { once: true }); w.postMessage({ tipo: "PULAR_ESPERA" }); } }); };
  if (reg.waiting && nav.serviceWorker.controller) oferecer(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const w = reg.installing;
    if (w) w.addEventListener("statechange", () => { if (w.state === "installed" && nav.serviceWorker.controller) oferecer(w); });
  });
  let ult = agora();
  if (win && win.document) win.document.addEventListener("visibilitychange", () => { if (win.document.visibilityState === "visible" && agora() - ult > A_CADA_MS) { ult = agora(); reg.update().catch(() => {}); } });
  return "ligado";
}
