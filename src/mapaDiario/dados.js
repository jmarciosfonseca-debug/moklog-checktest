// Mapa de Equipe diário — leitura e gravação no Firestore.
// Documentos em equipes/{pid}/mapas/{projeto_AAAA-MM-DD_D|N}: subpasta da Equipe do próprio projeto,
// que as regras atuais já cobrem (como equipes/{pid}/fv). Não depende de coleção nova.
import { getApps } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { setDoc } from "../fireGuard";
import { diasEntre } from "./regras";

const db = () => {
  const app = getApps()[0];
  if (!app) throw new Error("Firebase não iniciado");
  return getFirestore(app);
};

export async function loadColaboradores(pid, hojeISO) {
  const snap = await getDoc(doc(db(), "equipes", pid));
  const d = snap.exists() ? snap.data() : {};
  const ferias = new Set((Array.isArray(d.ferias) ? d.ferias : [])
    .filter((f) => f && f.dataInicio && f.dataRetorno && f.dataInicio <= hojeISO && hojeISO <= f.dataRetorno)
    .map((f) => f.colabId));
  return (d.colaboradores || [])
    .filter((c) => c.status === "ativo")
    .map((c) => ({ id: c.id, nome: c.nome || "", cargo: c.cargo || "", turno: c.turno || "", emFerias: ferias.has(c.id), equipeLiderId: c.equipeLiderId || null }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// Cadastro de Equipamentos do projeto (somente leitura) para conferir o material no mapa.
export async function loadEquipamentos(pid) {
  const snap = await getDoc(doc(db(), "equipamentos", pid));
  return snap.exists() ? snap.data() : null;
}

export async function loadMapa(pid, chave) {
  const snap = await getDoc(doc(db(), "equipes", pid, "mapas", chave));
  return snap.exists() ? snap.data() : null;
}

// Último mapa já enviado do mesmo turno, anterior a `antesDe` (serve de base para pré-preencher).
// 12x36 (`gapPar`): a turma só volta a cada 2 dias, então só vale mapa com número PAR de dias de diferença
// (o de ontem é da outra turma).
// Ordena só por data (sem índice composto) e filtra no cliente.
export async function loadUltimoMapa(pid, turno, antesDe, { gapPar = false } = {}) {
  const snap = await getDocs(query(collection(db(), "equipes", pid, "mapas"), orderBy("data", "desc"), limit(14)));
  const lista = snap.docs.map((d) => d.data()).filter((m) => m.turno === turno && m.status === "enviado" && m.data < antesDe && (!gapPar || Math.abs(diasEntre(m.data, antesDe)) % 2 === 0));
  return lista[0] || null;
}

export async function saveMapa(mapa) {
  const agora = new Date().toISOString();
  const doc_ = { ...mapa, atualizadoEm: agora };
  await setDoc(doc(db(), "equipes", mapa.projetoId, "mapas", mapa.id), doc_);
  return doc_;
}

// Última visita da supervisão — fonte única: CCO (cco_supervisao/{pid}.registros[]);
// projeto sem CCO cai em empresa_info.seguranca.visitas.
export async function loadUltimaVisita(pid) {
  const rotuloTurno = (t) => (t === "diurno" ? "Diurno" : t === "noturno" ? "Noturno" : t || "");
  try {
    const snap = await getDoc(doc(db(), "cco_supervisao", pid));
    const regs = snap.exists() ? (snap.data().registros || []).filter((r) => r && !r.rascunho && r.data) : [];
    if (regs.length) {
      const r = regs.slice().sort((a, b) => (b.data || "").localeCompare(a.data || ""))[0];
      return { ultimaData: r.data, supervisor: r.supervisor || "", turno: rotuloTurno(r.turno), fonte: "cco" };
    }
  } catch (e) { /* cai no empresa_info */ }
  try {
    const snap = await getDoc(doc(db(), "empresa_info", pid));
    const seg = snap.exists() ? (snap.data().seguranca || {}) : {};
    const v = (seg.visitas || []).filter((x) => x && x.data).sort((a, b) => b.data.localeCompare(a.data))[0];
    if (v) return { ultimaData: v.data, supervisor: v.supervisor || seg.supervisor || "", turno: rotuloTurno(v.turno), fonte: "empresa" };
  } catch (e) { /* sem visita */ }
  return null;
}

// Para a barra do gerencial: o mapa do turno em vigor de cada projeto, lido por id (sem consulta).
export async function loadEnviosDoTurno(itens) {
  const res = await Promise.all(itens.map(async ({ projetoId, data, turno, chave }) => {
    const m = await loadMapa(projetoId, chave);
    return { projetoId, data, turno, enviadoEm: m && m.status === "enviado" ? m.enviadoEm : null };
  }));
  return res;
}
