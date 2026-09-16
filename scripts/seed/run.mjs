// ─────────────────────────────────────────────────────────────
// scripts/seed/run.mjs — Executor ONE-SHOT do catálogo (Admin SDK)
//
// FORA de src/. Não entra no bundle. Roda uma única vez (com retomada
// segura), por um operador, com credencial administrativa (service
// account) FORA do repositório — via GOOGLE_APPLICATION_CREDENTIALS
// (Application Default Credentials). NÃO depende de Firebase Auth
// (E-mail/Senha é para criar o gerente, não para o seed).
//
// Após a carga, o Firestore é a fonte de verdade única e vencedora.
//
// Política de execução segura (idempotente, com marca de conclusão):
//   • raiz inexistente        → create() raiz {seedCompleto:false, createdAt,
//                               updatedAt} (create falha se já existir, evitando
//                               corrida entre get() e escrita — se ALREADY_EXISTS,
//                               aborta e pede nova execução p/ retomada); grava
//                               itens em batches; só após o último marca
//                               seedCompleto:true.
//   • raiz, versão diferente  → ABORTA sem escrever (erro de versão).
//   • raiz, mesma versão, seedCompleto===true → ABORTA ("seed já aplicado").
//   • raiz, mesma versão, seedCompleto!==true → RETOMADA segura: NÃO altera
//                               createdAt; regrava itens estáveis com
//                               merge:true; ao final marca seedCompleto:true.
//   createdAt nunca é sobrescrito. A raiz não é recriada com merge:true.
//
// Uso:
//   GOOGLE_APPLICATION_CREDENTIALS=/caminho/sa.json node scripts/seed/run.mjs
//   SEED_DRY_RUN=1 → apenas confere integridade e imprime plano; NÃO escreve.
// ─────────────────────────────────────────────────────────────

// NOTA: os imports de firebase-admin são DINÂMICOS, feitos só no fluxo
// não-dry-run (dentro de main, após o retorno do SEED_DRY_RUN). Assim o
// DRY_RUN valida integridade sem exigir a dependência instalada nem tocar
// em credencial/rede.
import { CATALOGO_SEED } from "./catalogoSeed.mjs";

const DRY = process.env.SEED_DRY_RUN === "1";
const CHUNK = 400;

function assertIntegridade(s) {
  const errs = [];
  if (s.itens.length !== 110) errs.push(`esperado 110 itens, achou ${s.itens.length}`);
  const catIds = new Set(s.categorias.map(c => c.id));
  const subIds = new Set(s.subcategorias.map(x => x.id));
  for (const it of s.itens) {
    if (!catIds.has(it.categoria)) errs.push(`item ${it.id}: categoria órfã ${it.categoria}`);
    if (!subIds.has(it.subcategoria)) errs.push(`item ${it.id}: subcategoria órfã ${it.subcategoria}`);
  }
  const dup = s.itens.map(i => i.id).filter((v, i, a) => a.indexOf(v) !== i);
  if (dup.length) errs.push(`ids duplicados: ${dup.join(",")}`);
  if (errs.length) throw new Error("Integridade falhou:\n- " + errs.join("\n- "));
}

async function gravarItens(db, rootRef, itens, FieldValue) {
  const now = FieldValue.serverTimestamp();
  let n = 0;
  for (let i = 0; i < itens.length; i += CHUNK) {
    const batch = db.batch();
    for (const it of itens.slice(i, i + CHUNK)) {
      batch.set(rootRef.collection("itens").doc(it.id), { ...it, updatedAt: now }, { merge: true });
      n++;
    }
    await batch.commit();
  }
  return n;
}

async function main() {
  const s = CATALOGO_SEED;
  assertIntegridade(s);
  console.log(`Catálogo ${s.catalogoId} v${s.versao}: ${s.categorias.length} cat, ${s.subcategorias.length} subcat, ${s.itens.length} itens.`);

  if (DRY) { console.log("DRY RUN — integridade OK; nada gravado."); return; }

  // Imports DINÂMICOS — só chegam aqui no fluxo não-dry-run.
  const { initializeApp, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");

  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();
  const rootRef = db.collection("catalogos_diagnostico").doc(s.catalogoId);

  const snap = await rootRef.get();

  // Campos declarativos e metadados da raiz (sem createdAt — tratado à parte).
  const rootMeta = {
    catalogoId: s.catalogoId, versao: s.versao, perfil: s.perfil, status: s.status,
    statusPossiveisPadrao: s.statusPossiveisPadrao,
    statusQueExcluemDenominador: s.statusQueExcluemDenominador,
    statusQuePermanecemNoDenominador: s.statusQuePermanecemNoDenominador,
    statusQueNaoContamComoAvaliados: s.statusQueNaoContamComoAvaliados,
    categorias: s.categorias, subcategorias: s.subcategorias,
  };

  if (!snap.exists) {
    // Criação nova — create() (não set): falha se a raiz já existir,
    // impedindo que duas execuções simultâneas sobrescrevam a raiz entre
    // o get() e a escrita. seedCompleto:false até o último batch.
    try {
      await rootRef.create({
        ...rootMeta,
        seedCompleto: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      if (e && (e.code === 6 || e.code === "already-exists" || /ALREADY_EXISTS/i.test(e.message || ""))) {
        throw new Error("ABORTADO: outra execução criou a raiz entre o get() e a escrita. Rode novamente para aplicar a política de retomada segura.");
      }
      throw e;
    }
    const n = await gravarItens(db, rootRef, s.itens, FieldValue);
    await rootRef.update({ seedCompleto: true, updatedAt: FieldValue.serverTimestamp() });
    console.log(`OK — catálogo criado + ${n} itens. seedCompleto=true.`);
    return;
  }

  const cur = snap.data() || {};
  if (cur.versao !== s.versao) {
    throw new Error(`ABORTADO: raiz já existe com versão "${cur.versao}", seed é "${s.versao}". Erro de versão — não sobrescrevo.`);
  }
  if (cur.seedCompleto === true) {
    console.log(`ABORTADO: seed já aplicado (versão ${s.versao}, seedCompleto=true). Nada a fazer.`);
    return;
  }

  // Mesma versão, seedCompleto !== true → retomada segura. NÃO altera createdAt.
  console.log("Retomada: raiz existe com mesma versão e seed incompleto. Regravando itens…");
  await rootRef.set({ ...rootMeta, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const n = await gravarItens(db, rootRef, s.itens, FieldValue);
  await rootRef.update({ seedCompleto: true, updatedAt: FieldValue.serverTimestamp() });
  console.log(`OK — retomada concluída + ${n} itens regravados. seedCompleto=true. createdAt preservado.`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
