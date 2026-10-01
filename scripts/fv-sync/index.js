// ─────────────────────────────────────────────────────────────
// index.js — orquestrador do robô FV (GitHub Actions).
// Uso: node scripts/fv-sync/index.js [--dry-run]
//   --dry-run  extrai e valida, NÃO grava no Firestore.
// Regras: nunca apaga o último dado válido; erro fica registrado.
// ─────────────────────────────────────────────────────────────
const core = require("./fvCore");
const SEL = require("./seletores");
const { extrair } = require("./extratorPortal");

const DRY = process.argv.includes("--dry-run");
const TENTATIVAS = 3;
const TRAVA_MIN = 30;

function initFirestore() {
  const admin = require("firebase-admin");
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT ausente.");
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  return admin.firestore();
}

const espera = ms => new Promise(r => setTimeout(r, ms));

async function comTentativas(fn) {
  let ultimo;
  for (let i = 1; i <= TENTATIVAS; i++) {
    try { return await fn(); }
    catch (e) { ultimo = e; if (e.naoRepetir) throw e; console.warn(`Tentativa ${i}/${TENTATIVAS} falhou: ${e.message}`); if (i < TENTATIVAS) await espera(20000 * i); }
  }
  throw ultimo;
}

async function main() {
  const agora = new Date().toISOString();
  const origem = process.env.FV_ORIGEM || "cron";
  const db = DRY ? null : initFirestore();
  const statusRef = db && db.collection("fv_sync").doc("status");

  if (statusRef) {
    const st = (await statusRef.get()).data() || {};
    if (st.emExecucao && st.inicioEm && (Date.now() - new Date(st.inicioEm).getTime()) < TRAVA_MIN * 60000) {
      console.log("Outra execução em andamento. Abortando."); return;
    }
    await statusRef.set({ emExecucao: true, inicioEm: agora, disparadoPor: origem }, { merge: true });
  }

  try {
    const bruto = await comTentativas(extrair);
    const r = core.normalizar(bruto, SEL.mapaProjetos, agora);
    r.avisos.forEach(a => console.log("AVISO:", a));
    if (!core.podeGravar(r)) throw new Error("Validação falhou: " + (r.erros.join("; ") || "nenhum projeto extraído"));

    console.log(`OK ${Object.keys(r.docs).length} projeto(s): ${Object.keys(r.docs).join(', ')}; valores não expostos nos logs.`);
    if (DRY) { console.log("DRY-RUN: nada gravado."); return; }

    for (const [pid, d] of Object.entries(r.docs)) {
      const ref = db.collection("fv").doc(pid);
      const lotes = [];
      let batch = db.batch(), n = 0;
      d.lancamentos.forEach(l => {
        batch.set(ref.collection("lancamentos").doc(l.id), { ...l, sincronizadoEm: agora }, { merge: true });
        if (++n % 400 === 0) { lotes.push(batch); batch = db.batch(); }
      });
      batch.set(ref, d.resumo, { merge: true });
      lotes.push(batch);
      for (const b of lotes) await b.commit();
    }
    await statusRef.set({ emExecucao: false, ultimaExecucao: agora, ultimaOk: agora, status: "ok", erro: null, avisos: r.avisos }, { merge: true });
  } catch (e) {
    console.error("FALHA:", e.message);
    if (db) {
      // Marca erro SEM apagar dados válidos.
      const batch = db.batch();
      core.FV_PROJETOS.forEach(pid => batch.set(db.collection("fv").doc(pid), { statusSincronizacao: "erro", erroSincronizacao: e.message, tentativaEm: agora }, { merge: true }));
      batch.set(statusRef, { emExecucao: false, ultimaExecucao: agora, status: "erro", erro: e.message }, { merge: true });
      await batch.commit();
    }
    process.exitCode = 1;
  }
}

main();
