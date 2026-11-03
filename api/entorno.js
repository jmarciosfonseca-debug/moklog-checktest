// ─────────────────────────────────────────────────────────────
// api/entorno.js — Leitura do Entorno pelo servidor (Vercel Serverless).
//
// 03/11/2026: o app lia entorno/{pid} direto do Firestore e recebia "sem coleta" mesmo com a coleta gravada —
// a coleção não está nas regras do Firestore (fail-closed) e a leitura do navegador era negada em silêncio.
// Aqui a leitura é feita com o Admin SDK e devolvida só para quem tem sessão válida:
//   admin/demo → todos os parques · cliente → só os pids do escopo · líder/ronda → só o próprio parque.
// GET /api/entorno            → { ok, docs:{pid:doc}, geral, status }
// GET /api/entorno?pid=P601   → só aquele parque (+ geral)
// ─────────────────────────────────────────────────────────────
const { verify } = require("./ai/lib/accessAuth");
const { getDb } = require("./ai/lib/firebaseAdmin");
const { projetosComEntorno, GERAL, recebeGeral } = require("../src/entorno/locais");

function permitidos(a) {
  const todos = projetosComEntorno();
  if (a.nivel === "admin" || a.nivel === "demo") return todos;
  if (a.nivel === "cliente") return todos.filter((p) => (a.pids || []).includes(p));
  if (a.nivel === "lider" || a.nivel === "ronda") return todos.filter((p) => p === a.pid);
  return [];
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ ok: false, erro: "Método não permitido" });
  const m = /^Bearer ([-\w]+\.[-\w]+)$/.exec(req.headers?.authorization || "");
  const a = m && verify(m[1]);
  if (!a) return res.status(401).json({ ok: false, erro: "Sessão ausente ou expirada. Entre novamente." });
  let db;
  try { db = getDb(); } catch { return res.status(500).json({ ok: false, erro: "Firebase não configurado no servidor." }); }
  const ok = permitidos(a);
  const pedido = typeof req.query?.pid === "string" ? req.query.pid : null;
  if (pedido && !ok.includes(pedido)) return res.status(403).json({ ok: false, erro: "Sem acesso a este parque." });
  const pids = pedido ? [pedido] : ok;
  const precisaGeral = pids.some(recebeGeral);
  try {
    const refs = [...pids.map((p) => db.collection("entorno").doc(p)), ...(precisaGeral ? [db.collection("entorno").doc(GERAL.id)] : []), ...(a.nivel === "admin" || a.nivel === "demo" ? [db.collection("entorno").doc("_status")] : [])];
    const snaps = refs.length ? await db.getAll(...refs) : [];
    const docs = {}; let geral = null, status = null;
    snaps.forEach((s) => { if (!s.exists) return; const d = s.data(); if (s.id === GERAL.id) geral = d; else if (s.id === "_status") status = d; else docs[s.id] = d; });
    return res.status(200).json({ ok: true, pids, docs, geral, status });
  } catch (e) {
    console.error("entorno/ler", e && e.message);
    return res.status(502).json({ ok: false, erro: `Falha ao ler o entorno: ${(e && e.message) || "erro"}` });
  }
};
