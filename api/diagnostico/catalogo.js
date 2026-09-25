const admin = require("firebase-admin");
const { getDb } = require("../ai/lib/firebaseAdmin");

const CATALOGO_ID = "centro_logistico_v1_0_0";

function tokenFromHeader(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

function serializarCatalogo(catalogo, itens) {
  return {
    id: catalogo.catalogoId || CATALOGO_ID,
    versao: catalogo.versao || "",
    perfil: catalogo.perfil || "",
    status: catalogo.status || "",
    categorias: Array.isArray(catalogo.categorias) ? catalogo.categorias : [],
    subcategorias: Array.isArray(catalogo.subcategorias) ? catalogo.subcategorias : [],
    statusPossiveisPadrao: Array.isArray(catalogo.statusPossiveisPadrao) ? catalogo.statusPossiveisPadrao : [],
    statusQueExcluemDenominador: Array.isArray(catalogo.statusQueExcluemDenominador) ? catalogo.statusQueExcluemDenominador : [],
    statusQueNaoContamComoAvaliados: Array.isArray(catalogo.statusQueNaoContamComoAvaliados) ? catalogo.statusQueNaoContamComoAvaliados : [],
    statusQuePermanecemNoDenominador: Array.isArray(catalogo.statusQuePermanecemNoDenominador) ? catalogo.statusQuePermanecemNoDenominador : [],
    itens,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, message: "Método não permitido." });

  try {
    const db = getDb();
    const token = tokenFromHeader(req);
    if (!token) return res.status(401).json({ ok: false, message: "Sessão Firebase ausente." });

    await admin.auth().verifyIdToken(token, true);

    const ref = db.collection("catalogos_diagnostico").doc(CATALOGO_ID);
    const [catalogoSnap, itensSnap] = await Promise.all([
      ref.get(),
      ref.collection("itens").orderBy("ordem", "asc").get(),
    ]);

    if (!catalogoSnap.exists) return res.status(404).json({ ok: false, message: "Catálogo não encontrado." });
    const catalogo = catalogoSnap.data() || {};
    if (catalogo.status !== "publicado") return res.status(404).json({ ok: false, message: "Catálogo não publicado." });

    const itens = itensSnap.docs.map((snap) => ({ id: snap.id, ...snap.data() }));
    return res.status(200).json({ ok: true, catalogo: serializarCatalogo(catalogo, itens) });
  } catch (error) {
    console.error("[diagnostico/catalogo] falha:", error?.code || error?.message || error);
    const unauthorized = String(error?.code || "").includes("auth/");
    return res.status(unauthorized ? 401 : 500).json({
      ok: false,
      message: unauthorized ? "Sessão Firebase inválida ou expirada." : "Não foi possível carregar o catálogo.",
    });
  }
};
