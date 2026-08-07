// ─────────────────────────────────────────────────────────────
// iaClient.js — Cliente do Assistente IA (FRONTEND)
//
// Fala SOMENTE com o backend do MokLog (/api/ai/*). Nunca conhece a
// chave OpenAI nem toca no Firestore diretamente para a IA.
//
// Fluxo: sessão(pin) → token em memória → chat(token).
// O token fica só em memória (não em localStorage) e expira sozinho.
// ─────────────────────────────────────────────────────────────

let _token = null;
let _tokenExp = 0;

// Base configurável; em produção Vercel, mesmo domínio → caminho relativo.
const BASE = process.env.REACT_APP_AI_BASE || "";

export function hasValidToken() {
  return !!_token && Date.now() < _tokenExp;
}

export function clearToken() {
  _token = null;
  _tokenExp = 0;
}

// Troca o PIN gerencial por um token de sessão assinado pelo servidor.
// O PIN é enviado só ao NOSSO backend (nunca ao modelo) e não é guardado.
export async function abrirSessao(pin) {
  const resp = await fetch(`${BASE}/api/ai/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.ok) {
    const msg = data && data.message ? data.message : "Não foi possível iniciar a sessão da IA.";
    throw new Error(msg);
  }
  _token = data.token;
  _tokenExp = Date.now() + (data.expiresInMs || 0) - 5000; // margem de 5s
  return true;
}

// Envia uma pergunta. history = [{role, content}] só da sessão atual.
// signal permite cancelar (AbortController).
export async function perguntar(message, history = [], signal) {
  if (!hasValidToken()) throw new Error("SESSAO_EXPIRADA");
  const resp = await fetch(`${BASE}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${_token}`,
    },
    body: JSON.stringify({ message, history }),
    signal,
  });
  if (resp.status === 401) { clearToken(); throw new Error("SESSAO_EXPIRADA"); }
  if (resp.status === 429) throw new Error("Muitas perguntas em pouco tempo. Aguarde um instante.");
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.ok) {
    throw new Error((data && data.message) || "Erro ao consultar a IA.");
  }
  return { answer: data.answer, toolsUsed: data.toolsUsed || [], asOf: data.asOf };
}
