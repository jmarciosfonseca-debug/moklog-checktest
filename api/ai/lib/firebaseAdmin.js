// ─────────────────────────────────────────────────────────────
// firebaseAdmin.js — Inicialização única do Firebase Admin SDK (BACKEND ONLY)
//
// NUNCA importar este arquivo no frontend. Ele usa a service account
// (FIREBASE_PRIVATE_KEY) que jamais pode chegar ao navegador.
//
// As ferramentas de IA leem o Firestore por AQUI, com privilégio de
// servidor — não pela config client-side pública do app.
// ─────────────────────────────────────────────────────────────

const admin = require("firebase-admin");

let _db = null;

function getDb() {
  if (_db) return _db;

  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // Na Vercel, quebras de linha da chave vêm escapadas como "\n" literais.
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Firebase Admin: variáveis de ambiente ausentes.");
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  _db = admin.firestore();
  return _db;
}

module.exports = { getDb };
