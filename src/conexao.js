// Estado de conexão ÚNICO do app. Quem precisa saber se está online, offline, sincronizando ou com envio pendente lê daqui;
// ninguém decide sozinho. Puro e injetável (sem depender de window no teste). Nada aqui grava em Firestore nem mexe em cache.
let estado = { online: true, sincronizando: false, pendentes: 0, ultimoSyncEm: null, ultimoErro: "" };
const ouvintes = new Set();
const emitir = () => { const s = lerConexao(); ouvintes.forEach((f) => { try { f(s); } catch { /* um ouvinte com defeito não derruba os outros */ } }); };

export const lerConexao = () => ({ ...estado });
export function assinarConexao(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }

export function definirOnline(on) { const v = !!on; if (v !== estado.online) { estado = { ...estado, online: v }; emitir(); } }
export function definirPendentes(n) { const v = Math.max(0, Math.floor(Number(n) || 0)); if (v !== estado.pendentes) { estado = { ...estado, pendentes: v }; emitir(); } }
export function marcarSincronizando(b) { const v = !!b; if (v !== estado.sincronizando) { estado = { ...estado, sincronizando: v }; emitir(); } }
export function registrarSync(ok, erro = "", agora = new Date()) { estado = { ...estado, sincronizando: false, ultimoSyncEm: ok ? agora : estado.ultimoSyncEm, ultimoErro: ok ? "" : String(erro || "Falha ao enviar.") }; emitir(); }

// Resumo para a tela: uma chave e um texto curto (selo "pendente de envio" etc.).
export function resumoConexao(s = estado) {
  if (!s.online) return { chave: "offline", texto: s.pendentes ? `Sem conexão · ${s.pendentes} ${s.pendentes === 1 ? "envio pendente" : "envios pendentes"}` : "Sem conexão · mostrando o último dado" };
  if (s.sincronizando) return { chave: "sincronizando", texto: "Enviando…" };
  if (s.ultimoErro) return { chave: "erro", texto: s.ultimoErro };
  if (s.pendentes) return { chave: "pendente", texto: `${s.pendentes} ${s.pendentes === 1 ? "envio pendente" : "envios pendentes"}` };
  return { chave: "online", texto: "Conectado" };
}

// Liga aos eventos do navegador. Devolve a função que desliga. Só reflete o aparelho (navigator.onLine); o envio real é de quem usa.
export function iniciarConexao(win = typeof window !== "undefined" ? window : null) {
  if (!win || !win.addEventListener) return () => {};
  const nav = win.navigator || {};
  if (typeof nav.onLine === "boolean") definirOnline(nav.onLine);
  const on = () => definirOnline(true), off = () => definirOnline(false);
  win.addEventListener("online", on); win.addEventListener("offline", off);
  return () => { win.removeEventListener("online", on); win.removeEventListener("offline", off); };
}

// Só para teste.
export function _reiniciarConexao() { estado = { online: true, sincronizando: false, pendentes: 0, ultimoSyncEm: null, ultimoErro: "" }; ouvintes.clear(); }
