// ─────────────────────────────────────────────────────────────
// auth.js — Sessão gerencial assinada pelo servidor (BACKEND ONLY)
//
// Decisão (Marcio): usar o PIN gerencial atual do app como está,
// porém validado no SERVIDOR e nunca no bundle. Fluxo:
//
//   1. Frontend chama POST /api/ai/session com { pin }.
//   2. Servidor compara com AI_GERENCIAL_PIN (env). Se casar, emite
//      um token curto assinado (HMAC) com expiração (default 30min,
//      igual à sessão gerencial do app).
//   3. O token vai no header Authorization das chamadas /api/ai/chat.
//   4. O PIN NUNCA é enviado ao modelo nem gravado em log.
//
// LIMITAÇÃO CONHECIDA (dívida documentada): o PIN é compartilhado e
// de origem client. Isto protege a chave OpenAI e restringe por posse
// do PIN, mas não é identidade forte. Fechamento previsto na migração
// Firebase Anonymous Auth (regra if request.auth != null).
// ─────────────────────────────────────────────────────────────

const crypto = require("crypto");

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 min, igual ao app

function _secret() {
  const s = process.env.AI_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AI_SESSION_SECRET ausente ou muito curto (>=16 chars).");
  }
  return s;
}

function _b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function _fromB64url(s) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// Compara PIN em tempo constante contra o env. NUNCA logar o valor.
function pinIsGerencial(pin) {
  const expected = process.env.AI_GERENCIAL_PIN || "";
  if (!expected) return false;
  const a = Buffer.from(String(pin || ""));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Emite token assinado { role:"gerencial", iat, exp }.
function issueSession(ttlMs = DEFAULT_TTL_MS) {
  const now = Date.now();
  const payload = { role: "gerencial", iat: now, exp: now + ttlMs };
  const body = _b64url(JSON.stringify(payload));
  const sig = _b64url(crypto.createHmac("sha256", _secret()).update(body).digest());
  return `${body}.${sig}`;
}

// Verifica token. Retorna { valid, payload?, reason? }.
function verifySession(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, reason: "malformed" };
  }
  const [body, sig] = token.split(".");
  let expected;
  try {
    expected = _b64url(crypto.createHmac("sha256", _secret()).update(body).digest());
  } catch (e) {
    return { valid: false, reason: "no_secret" };
  }
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "bad_signature" };
  }
  let payload;
  try {
    payload = JSON.parse(_fromB64url(body).toString("utf8"));
  } catch (e) {
    return { valid: false, reason: "bad_payload" };
  }
  if (!payload || payload.role !== "gerencial") return { valid: false, reason: "not_gerencial" };
  if (Date.now() > (payload.exp || 0)) return { valid: false, reason: "expired" };
  return { valid: true, payload };
}

// Extrai token do header Authorization: "Bearer <token>".
function tokenFromHeader(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

// Guard para handlers: retorna {authorized, payload?} ou responde 401 fora.
function requireGerencial(req) {
  const token = tokenFromHeader(req);
  const v = verifySession(token);
  return v.valid ? { authorized: true, payload: v.payload } : { authorized: false, reason: v.reason };
}

// Identificador NÃO sensível de sessão para observabilidade (hash do token).
function sessionFingerprint(req) {
  const token = tokenFromHeader(req) || "anon";
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 12);
}

module.exports = {
  DEFAULT_TTL_MS, pinIsGerencial, issueSession, verifySession,
  tokenFromHeader, requireGerencial, sessionFingerprint,
};
