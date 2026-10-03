// Núcleo da migração das fotos da equipe e da limpeza do Bolsão (testável, sem rede). Usado pelos scripts desta pasta.
// Regras de ouro:
//   • NENHUMA foto é apagada sem cópia conferida. A foto é copiada para equipes/{pid}/fotos/{id}-{sha16} (imutável),
//     conferida por SHA-256 DENTRO da transação que a remove do documento principal, e o colaborador passa a ter fotoRef.
//   • Nunca sobrescreve foto existente. Nunca mexe em quem já tem fotoRef (é foto mais nova).
//   • Bolsão: remove só as fotos que estão no backup; fotos adicionadas depois ficam.
const crypto = require("crypto");
const path = require("path");
const eh = v => typeof v === "string" && v.startsWith("data:image/");
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const idFoto = (colabId, dataUrl) => colabId + "-" + sha(dataUrl).slice(0, 16);      // MESMA regra do servidor (api/ai/lib/equipeFoto.js)
const LISTAS = ["colaboradores", "desligados"];

function planejar(doc) {
  const itens = [];
  for (const lista of LISTAS) for (const c of (Array.isArray(doc && doc[lista]) ? doc[lista] : [])) {
    if (c && typeof c.id === "string" && c.id && !c.fotoRef && eh(c.foto)) itens.push({ id: c.id, lista, chars: c.foto.length, sha: sha(c.foto), ref: idFoto(c.id, c.foto) });
  }
  const ids = itens.map(x => x.id);
  const bytesDoc = Buffer.byteLength(JSON.stringify(doc || {}), "utf8"), bytesFotos = itens.reduce((s, x) => s + x.chars, 0);
  return { itens, qtd: itens.length, repetidos: ids.length - new Set(ids).size, bytesDoc, bytesFotos, bytesDepois: bytesDoc - bytesFotos + itens.length * 40 };
}
// verificados: Map ref -> sha (conferidos AGORA, na transação). Só limpa quem ainda não tem fotoRef e cuja foto continua idêntica.
function aplicarLimpeza(doc, verificados) {
  const novo = JSON.parse(JSON.stringify(doc)), limpos = [], ignorados = [];
  for (const lista of LISTAS) for (const c of (Array.isArray(novo[lista]) ? novo[lista] : [])) {
    if (!c || c.fotoRef || !eh(c.foto)) continue;
    const ref = idFoto(c.id, c.foto);
    if (verificados.get(ref) === sha(c.foto)) { c.foto = ""; c.fotoRef = ref; c.temFoto = true; limpos.push(c.id); }
    else ignorados.push(c.id);
  }
  return { doc: novo, limpos, ignorados };
}
// Executada DENTRO de db.runTransaction: relê o documento, confere origem e destino e só então remove a foto do documento.
async function limparNaTransacao(tx, refDoc, refFoto /* ref -> DocumentReference */, esperados /* Map ref -> sha */) {
  const atual = (await tx.get(refDoc)).data();
  const refs = [...esperados.keys()];
  const snaps = refs.length ? await tx.getAll(...refs.map(refFoto)) : [];
  const verificados = new Map();
  snaps.forEach((s, i) => { const d = s.exists ? (s.data() || {}).data : null; if (eh(d) && sha(d) === esperados.get(refs[i])) verificados.set(refs[i], esperados.get(refs[i])); });
  const out = aplicarLimpeza(atual, verificados);
  tx.set(refDoc, out.doc);
  return out;
}
// Pasta de backup precisa ser absoluta e ficar FORA do repositório.
function validarPastaBackup(dir, raizRepo) {
  if (!dir || typeof dir !== "string") return "Informe --backup-dir.";
  if (!path.isAbsolute(dir)) return "--backup-dir deve ser um caminho absoluto.";
  const rel = path.relative(path.resolve(raizRepo), path.resolve(dir));
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) return "--backup-dir está DENTRO do repositório; use uma pasta fora dele.";
  return null;
}

// ── Bolsão ──
const fotosDoBolsao = doc => (Array.isArray(doc && doc.checagens) ? doc.checagens : []).flatMap(c => (Array.isArray(c.fotos) ? c.fotos : [])).map(String);
function planejarBolsao(doc) {
  const ch = Array.isArray(doc && doc.checagens) ? doc.checagens : [], fotos = fotosDoBolsao(doc);
  return { checagens: ch.length, comFoto: ch.filter(c => Array.isArray(c.fotos) && c.fotos.length).length, fotos: fotos.length,
    bytesFotos: fotos.reduce((s, f) => s + f.length, 0), bytesDoc: Buffer.byteLength(JSON.stringify(doc || {}), "utf8") };
}
const conjuntoDoBackup = doc => new Set(fotosDoBolsao(doc).map(sha));
// Remove SOMENTE as fotos que constam do backup; as adicionadas depois permanecem.
function removerFotosBolsao(doc, noBackup /* Set de sha */) {
  const novo = JSON.parse(JSON.stringify(doc)); let removidas = 0, preservadas = 0;
  for (const c of (Array.isArray(novo.checagens) ? novo.checagens : [])) if (Array.isArray(c.fotos)) {
    const mantidas = c.fotos.filter(f => { if (noBackup.has(sha(String(f)))) { removidas++; return false; } preservadas++; return true; });
    c.fotos = mantidas;
  }
  return { doc: novo, removidas, preservadas };
}
module.exports = { planejar, aplicarLimpeza, limparNaTransacao, validarPastaBackup, planejarBolsao, conjuntoDoBackup, removerFotosBolsao, sha, eh, idFoto };
