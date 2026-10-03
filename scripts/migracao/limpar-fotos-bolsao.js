#!/usr/bin/env node
// Remove as FOTOS do Bolsão de inquilinos (texto, placas e inquilinos ficam). Decisão do Marcio: fotos do Bolsão são desnecessárias.
// Só remove as fotos que constam do BACKUP; fotos adicionadas depois permanecem.
//   node scripts/migracao/limpar-fotos-bolsao.js --pid P505                                    (simulação)
//   node scripts/migracao/limpar-fotos-bolsao.js --pid P505 --executar --confirmo-apagar-fotos --backup-dir D:\backup
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const core = require("./fotosEquipe.core");
const arg = n => { const i = process.argv.indexOf("--" + n); return i < 0 ? null : (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true); };
const kb = n => (n / 1024).toFixed(0) + " KB";
async function main() {
  const pid = arg("pid"), executar = !!arg("executar"), dir = arg("backup-dir");
  if (!pid || pid === true || !/^P\d{3}[A-C]?$/.test(pid)) throw new Error("Informe --pid (ex.: P505).");
  if (executar && !arg("confirmo-apagar-fotos")) throw new Error("Apagar fotos exige --confirmo-apagar-fotos.");
  if (executar) {
    let raiz; try { raiz = execSync("git rev-parse --show-toplevel", { cwd: __dirname }).toString().trim(); } catch (_) { raiz = path.resolve(__dirname, "..", ".."); }
    const problema = core.validarPastaBackup(dir === true ? "" : dir, raiz);
    if (problema) throw new Error(problema);
  }
  const admin = require("firebase-admin");
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || "moklog-checktest" });
  const db = admin.firestore(), ref = db.collection("bolsao_inquilinos").doc(pid), snap = await ref.get();
  if (!snap.exists) throw new Error("Documento bolsao_inquilinos/" + pid + " não existe.");
  const p = core.planejarBolsao(snap.data());
  console.log(`${pid}: documento ${kb(p.bytesDoc)} | ${p.checagens} checagem(ns), ${p.comFoto} com foto, ${p.fotos} foto(s) (${kb(p.bytesFotos)}) | depois ≈ ${kb(p.bytesDoc - p.bytesFotos)}`);
  if (!executar) { console.log("Simulação: nada foi gravado."); return; }
  fs.mkdirSync(dir, { recursive: true });
  const arquivo = path.join(dir, `bolsao_${pid}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(arquivo, JSON.stringify(snap.data()), { flag: "wx" });
  console.log("Backup do documento completo:", arquivo);
  const noBackup = core.conjuntoDoBackup(snap.data());
  const r = await db.runTransaction(async tx => { const out = core.removerFotosBolsao((await tx.get(ref)).data(), noBackup); tx.set(ref, out.doc); return out; });
  console.log(`Removidas: ${r.removidas} | preservadas (adicionadas depois do backup): ${r.preservadas} | documento agora ${kb(core.planejarBolsao((await ref.get()).data()).bytesDoc)}`);
}
main().catch(e => { console.error("ERRO:", e.message); process.exit(1); });
