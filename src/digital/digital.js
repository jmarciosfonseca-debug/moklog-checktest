// Entrada por digital / Face ID (WebAuthn) no aparelho. Só gerencial, gestor e cliente; o PIN continua sempre disponível.
// Tudo aqui é opcional e à prova de falha: qualquer erro devolve "não deu" e a pessoa entra pelo PIN como sempre.
// Liberação (digital-config.json): "desligado" (padrão) | "teste" (só aparelhos habilitados com ?digital=1) | "ligado".
export const K_ID = "mk-digital-id";           // id da credencial deste aparelho (não é segredo)
export const K_TESTE = "mk-digital-teste";     // aparelho habilitado para o teste
export const K_NAO = "mk-digital-nao";         // "aparelho compartilhado: não perguntar mais"
export const K_ADIADO = "mk-digital-adiado";   // "agora não": não perguntar de novo por 7 dias
const ADIAR_MS = 7 * 86400000;

const seguro = (f, p = null) => { try { return f(); } catch { return p; } };
const ls = (win) => seguro(() => win.localStorage, null);
const ler = (st, k) => seguro(() => st.getItem(k), null);
const gravar = (st, k, v) => seguro(() => { st.setItem(k, v); return true; }, false);
const apagar = (st, k) => seguro(() => { st.removeItem(k); return true; }, false);

// ── base64url ↔ bytes (sem Buffer no navegador) ──
export const paraB64u = (buf) => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
export const deB64u = (s) => { const t = String(s).replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4)); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const bytesDoTexto = (t) => new TextEncoder().encode(t);

export async function lerConfigDigital(fetchFn = typeof fetch !== "undefined" ? fetch : null, ms = 4000) {
  if (!fetchFn) return { modo: "desligado" };
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
  try {
    const r = await fetchFn(`/digital-config.json?t=${Date.now()}`, { cache: "no-store", ...(ctrl ? { signal: ctrl.signal } : {}) });
    const j = r && r.ok ? await r.json() : null;
    return j && ["desligado", "teste", "ligado"].includes(j.modo) ? j : { modo: "desligado" };
  } catch { return { modo: "desligado" }; } finally { if (t) clearTimeout(t); }
}

// ?digital=1 habilita ESTE aparelho para o teste; ?digital=0 tira. A marca fica no aparelho.
export function marcarTeste(win = window) {
  const st = ls(win); if (!st) return;
  const v = seguro(() => new URLSearchParams(win.location.search).get("digital"), null);
  if (v === "1") gravar(st, K_TESTE, "1");
  if (v === "0") apagar(st, K_TESTE);
}

export async function aparelhoSuporta(win = window) {
  const PK = win && win.PublicKeyCredential;
  if (!PK || !win.navigator || !win.navigator.credentials) return false;
  try { return typeof PK.isUserVerifyingPlatformAuthenticatorAvailable === "function" ? !!(await PK.isUserVerifyingPlatformAuthenticatorAvailable()) : false; } catch { return false; }
}

// Pode mostrar a digital neste aparelho? (chave remota + marca de teste + suporte do aparelho)
export async function digitalLiberada({ win = window, fetchFn, config } = {}) {
  const cfg = config || await lerConfigDigital(fetchFn);
  if (cfg.modo === "desligado") return false;
  const st = ls(win);
  if (cfg.modo === "teste" && ler(st, K_TESTE) !== "1") return false;
  return aparelhoSuporta(win);
}

export const temDigitalNoAparelho = (win = window) => { const st = ls(win); return !!(st && ler(st, K_ID)); };
export function devePerguntarCadastro(win = window, agora = Date.now()) {
  const st = ls(win); if (!st) return false;
  if (ler(st, K_ID) || ler(st, K_NAO) === "1") return false;
  const t = Number(ler(st, K_ADIADO));
  return !(Number.isFinite(t) && t > 0 && agora - t < ADIAR_MS);
}
export const adiarCadastro = (win = window, agora = Date.now()) => { const st = ls(win); if (st) gravar(st, K_ADIADO, String(agora)); };
export const naoPerguntarMais = (win = window) => { const st = ls(win); if (st) gravar(st, K_NAO, "1"); };
export const esquecerDigitalDoAparelho = (win = window) => { const st = ls(win); if (st) { apagar(st, K_ID); } };

async function chamar(acao, corpo, { token, fetchFn = fetch, ms = 15000 } = {}) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
  try {
    const r = await fetchFn("/api/digital", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ acao, ...corpo }), ...(ctrl ? { signal: ctrl.signal } : {}) });
    const j = await r.json().catch(() => ({}));
    return { ok: !!(r.ok && j.ok), status: r.status, ...j };
  } catch { return { ok: false, status: 0, erro: "Sem conexão com o servidor de acesso." }; } finally { if (t) clearTimeout(t); }
}

export function rotuloDoAparelho(win = window) {
  const ua = seguro(() => win.navigator.userAgent, "") || "";
  const tipo = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Macintosh/.test(ua) ? "Mac" : "Aparelho";
  return tipo;
}

// Cadastra a digital deste aparelho. Precisa de sessão ativa (token). Devolve { ok, erro? }; nunca lança.
export async function cadastrarDigital({ token, rotulo, win = window, fetchFn } = {}) {
  try {
    const o = await chamar("opcoes-registro", {}, { token, fetchFn });
    if (!o.ok) return { ok: false, erro: o.erro || "Digital indisponível agora." };
    const cred = await win.navigator.credentials.create({ publicKey: {
      challenge: bytesDoTexto(o.desafio), rp: o.rp,
      user: { id: deB64u(o.usuario.id), name: o.usuario.nome, displayName: o.usuario.nomeExibicao },
      pubKeyCredParams: o.algoritmos.map((alg) => ({ type: "public-key", alg })),
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      attestation: "none", timeout: o.timeout,
    } });
    const r = cred && cred.response;
    if (!r || typeof r.getAuthenticatorData !== "function" || typeof r.getPublicKey !== "function" || typeof r.getPublicKeyAlgorithm !== "function") return { ok: false, erro: "Este navegador não suporta digital. Use o PIN." };
    const id = paraB64u(cred.rawId);
    const s = await chamar("registrar", { credentialId: id, clientDataJSON: paraB64u(r.clientDataJSON), authenticatorData: paraB64u(r.getAuthenticatorData()), publicKey: paraB64u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm(), rotulo: rotulo || rotuloDoAparelho(win) }, { token, fetchFn });
    if (!s.ok) return { ok: false, erro: s.erro || "Não foi possível cadastrar a digital." };
    const st = ls(win); if (st) gravar(st, K_ID, id);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, cancelado: !!(e && e.name === "NotAllowedError"), erro: e && e.name === "NotAllowedError" ? "Cancelado." : "Não foi possível usar a digital agora. Use o PIN." };
  }
}

// Entra com a digital. Devolve { ok, dados } (dados = resposta do servidor, a validar em session.entrarComResposta) ou { ok:false, erro }.
export async function entrarComDigital({ win = window, fetchFn } = {}) {
  try {
    const st = ls(win), id = st && ler(st, K_ID);
    if (!id) return { ok: false, erro: "Este aparelho ainda não tem digital cadastrada." };
    const o = await chamar("opcoes-login", { credentialId: id }, { fetchFn });
    if (!o.ok) return { ok: false, erro: o.erro || "Digital indisponível agora. Use o PIN.", bloqueado: o.status === 429 };
    const cred = await win.navigator.credentials.get({ publicKey: { challenge: bytesDoTexto(o.desafio), rpId: o.rpId, allowCredentials: [{ type: "public-key", id: deB64u(id) }], userVerification: "required", timeout: o.timeout } });
    const r = cred && cred.response;
    if (!r) return { ok: false, erro: "Digital não reconhecida. Use o PIN." };
    const s = await chamar("entrar", { credentialId: id, clientDataJSON: paraB64u(r.clientDataJSON), authenticatorData: paraB64u(r.authenticatorData), signature: paraB64u(r.signature) }, { fetchFn });
    if (!s.ok) { if (s.status === 401 && st) { /* credencial recusada: mantém o id; o servidor já contou a tentativa */ } return { ok: false, erro: s.erro || "Digital não reconhecida. Use o PIN.", bloqueado: s.status === 429 }; }
    const { ok, status, ...dados } = s; // eslint-disable-line no-unused-vars
    return { ok: true, dados: { ok: true, ...dados } };
  } catch (e) {
    return { ok: false, cancelado: !!(e && e.name === "NotAllowedError"), erro: e && e.name === "NotAllowedError" ? "" : "Não foi possível usar a digital agora. Use o PIN." };
  }
}

export const listarAparelhos = ({ token, fetchFn } = {}) => chamar("listar", {}, { token, fetchFn });
export async function removerAparelho({ token, id, win = window, fetchFn } = {}) {
  const r = await chamar("remover", { id }, { token, fetchFn });
  if (r.ok) { const st = ls(win); if (st && ler(st, K_ID) === id) apagar(st, K_ID); }
  return r;
}
