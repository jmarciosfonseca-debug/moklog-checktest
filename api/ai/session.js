// ─────────────────────────────────────────────────────────────
// /api/ai/session — Troca o PIN gerencial por um token de sessão assinado.
//
// O PIN é validado AQUI (servidor), nunca no bundle. O token retornado
// autoriza /api/ai/chat por tempo limitado. O PIN não é logado.
// ─────────────────────────────────────────────────────────────

const { pinIsGerencial, issueSession, DEFAULT_TTL_MS } = require("./lib/auth");
const { check, ipFromReq } = require("./lib/rateLimit");

function setCors(res) {
  const origin = process.env.AI_ALLOWED_ORIGIN || "";
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, errorCode: "VALIDATION_ERROR", message: "Método não permitido." });

  // Rate limit por IP para não permitir brute force do PIN.
  const rl = check(`session:${ipFromReq(req)}`);
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    return res.status(429).json({ ok: false, errorCode: "RATE_LIMIT", message: "Muitas tentativas. Aguarde." });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const pin = body && body.pin;

  if (!pinIsGerencial(pin)) {
    // Não revelar se o PIN existe; resposta genérica.
    return res.status(401).json({ ok: false, errorCode: "UNAUTHORIZED", message: "PIN gerencial inválido." });
  }

  const token = issueSession();
  return res.status(200).json({ ok: true, token, expiresInMs: DEFAULT_TTL_MS });
};
