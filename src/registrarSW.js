// Registra o service worker (shell do app offline). Só em produção.
export function registrarSW() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      try { console.warn("[sw] não registrou:", e); } catch {}
    });
  });
}
