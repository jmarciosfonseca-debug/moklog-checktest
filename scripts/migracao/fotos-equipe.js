#!/usr/bin/env node
// Migração das fotos da equipe para equipes/{pid}/fotos/{id}-{sha16} (imutáveis). NADA é apagado sem cópia conferida.
//
//   node scripts/migracao/fotos-equipe.js --pid P601                                      (simulação: só lê e mostra números)
//   node scripts/migracao/fotos-equipe.js --pid P601 --executar --backup-dir D:\backup    (copia e confere; o documento NÃO muda)
//   node scripts/migracao/fotos-equipe.js --pid P601 --executar --limpar --backup-dir D:\backup   (tira a foto do documento, conferindo na transação)
//
// Credencial: Application Default Credentials (gcloud auth application-default login). NÃO usa chave de conta de serviço.
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const core = require("./fotosEquipe.core");
const arg = n => { const i = process.argv.indexOf("--" + n); return i < 0 ? null : (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true); };
const kb = n => (n / 1024).toFixed(0) + " KB";

async function main() {
  const pid = arg("pid"), executar = !!arg("executar"), limpar = !!arg("limpar"), dir = arg("backup-dir");
  if (!pid || pid === true || !/^P\d{3}[A-C]?$/.test(pid)) throw new Error("Informe --pid (ex.: P601).");
  if (limpar && !executar) throw new Error("--limpar só vale junto com --executar (a cópia é conferida na mesma execução).");
  if (executar) {
    let raiz; try { raiz = execSync("git rev-parse --show-toplevel", { cwd: __dirname }).toString().trim(); } catch (_) { raiz = path.resolve(__dirname, "..", ".."); }
    const problema = core.validarPastaBackup(dir === true ? "" : dir, raiz);
    if (problema) throw new Error(problema);
  }
  const admin = require("firebase-admin");
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || "moklog-checktest" });
  const db = admin.firestore(), ref = db.collection("equipes").doc(pid), fotos = ref.collection("fotos");
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Documento equipes/" + pid + " não existe.");
  const doc = snap.data(), plano = core.planejar(doc);
  console.log(`\n${pid}: documento ${kb(plano.bytesDoc)} | ${plano.qtd} foto(s) a mover (${kb(plano.bytesFotos)}) | depois ≈ ${kb(plano.bytesDepois)}${plano.repetidos ? " | ATENÇÃO: ids repetidos " + plano.repetidos : ""}`);
  if (plano.repetidos) throw new Error("Há colaboradores com o mesmo id; resolva antes de migrar.");
  if (!executar) { console.log("Simulação: nada foi gravado."); return; }

  fs.mkdirSync(dir, { recursive: true });
  const arquivo = path.join(dir, `equipes_${pid}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(arquivo, JSON.stringify(doc), { flag: "wx" });
  console.log("Backup do documento completo:", arquivo);

  const esperados = new Map();
  for (const it of plano.itens) {
    const c = [...(doc.colaboradores || []), ...(doc.desligados || [])].find(x => x.id === it.id);
    const alvo = fotos.doc(it.ref);
    try { await alvo.create({ data: c.foto, bytes: c.foto.length, sha256: it.sha, colabId: it.id, criadoEm: new Date().toISOString(), origem: "migracao" }); }
    catch (e) { if (!(e && (e.code === 6 || /already exists/i.test(e.message || "")))) throw e; }    // já existe: NÃO sobrescreve; confere abaixo
    const lido = (await alvo.get()).data();
    if (lido && lido.data === c.foto && core.sha(lido.data) === it.sha) esperados.set(it.ref, it.sha);
    else console.error("FALHA na conferência de", it.id, "(destino existente com conteúdo diferente: nada foi sobrescrito)");
  }
  console.log(`Copiadas e conferidas: ${esperados.size}/${plano.qtd}`);
  if (esperados.size !== plano.qtd) throw new Error("Nem todas as fotos foram conferidas; o documento principal NÃO foi alterado.");
  if (!limpar) { console.log("Documento principal intacto. Rode de novo com --limpar para tirar as fotos dele."); return; }

  const r = await db.runTransaction(tx => core.limparNaTransacao(tx, ref, id => fotos.doc(id), esperados));
  const depois = (await ref.get()).data();
  console.log(`Limpos: ${r.limpos.length} | mantidos (mudaram, já tinham fotoRef ou não conferiram): ${r.ignorados.length} | documento agora ${kb(core.planejar(depois).bytesDoc)}`);
}
main().catch(e => { console.error("ERRO:", e.message); process.exit(1); });
