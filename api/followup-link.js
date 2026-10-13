const auth = require("./ai/lib/accessAuth");
const { getDb } = require("./ai/lib/firebaseAdmin");
const L = require("./ai/lib/followupLink");

// Ações públicas (o token do link é a credencial) e ações da Moked (sessão gerencial).
const PUBLICAS = {
  ver: (db, b) => L.ver(db, b.token),
  enviar: (db, b) => L.enviar(db, b.token, b.envios),
  decidir: (db, b) => L.decidir(db, b.token, b),
};
const GERENCIAIS = {
  criar: (db, b) => L.criar(db, b),
  listar: async (db, b) => ({ links: await L.listar(db, b.pid) }),
  revogar: (db, b) => L.revogar(db, b),
  renovar: (db, b) => L.renovar(db, b),
  sincronizar: (db, b) => L.sincronizar(db, b),
  mover: (db, b) => L.mover(db, b),
};

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });
  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {}; } catch { return res.status(400).json({ ok: false, erro: "Pedido inválido" }); }
  if (JSON.stringify(body).length > 400000) return res.status(413).json({ ok: false, erro: "Pedido grande demais" });
  const acao = body.acao;
  try {
    if (PUBLICAS[acao]) {
      const r = await PUBLICAS[acao](getDb(), body);
      return res.status(200).json({ ok: true, ...r });
    }
    if (GERENCIAIS[acao]) {
      const a = auth.verify(/^Bearer (.+)$/.exec(req.headers?.authorization || "")?.[1]);
      if (!a) return res.status(401).json({ ok: false, erro: "Sessão ausente ou expirada. Entre novamente." });
      if (a.nivel !== "admin") return res.status(403).json({ ok: false, erro: "Somente o perfil gerencial gera e gerencia links." });
      const r = await GERENCIAIS[acao](getDb(), body);
      return res.status(200).json({ ok: true, ...r });
    }
    return res.status(400).json({ ok: false, erro: "Ação inválida" });
  } catch (e) {
    if (e instanceof L.Erro) return res.status(e.status).json({ ok: false, erro: e.message });
    console.error("followup-link", { acao, code: e && e.code });
    return res.status(503).json({ ok: false, erro: "Servidor indisponível. Tente novamente em instantes." });
  }
};
