// Mapa de Equipe diário — leitura e gravação no Firestore.
// Documentos em equipes/{pid}/mapas/{projeto_AAAA-MM-DD_D|N}: subpasta da Equipe do próprio projeto,
// que as regras atuais já cobrem (como equipes/{pid}/fv). Não depende de coleção nova.
import { getApps } from "firebase/app";
import { getFirestore, doc, getDoc, getDocFromServer, collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { setDoc } from "../fireGuard";
import { diasEntre } from "./regras";
import { isDemo, authFetchEquipe } from "../session";
import { aplicarNaFicha, lancamentosDoMapa } from "./ficha";
import { semUndefined } from "./modelo";

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
    .map((c) => ({ id: c.id, nome: c.nome || "", cargo: c.cargo || "", turno: c.turno || "", emFerias: ferias.has(c.id), equipeLiderId: c.equipeLiderId || null, equipeLideresExtra: Array.isArray(c.equipeLideresExtra) ? c.equipeLideresExtra : [] }))
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

// Consolidado (gerencial): mapas CONCLUÍDOS de vários projetos num período [de, ate] (datas ISO).
// Filtro de faixa e ordenação no mesmo campo (`data`): não exige índice composto. Se um projeto falhar, a leitura inteira falha
// (consolidado com projeto faltando seria número errado) — quem chama avisa.
export async function loadMapasPeriodo(projetos, de, ate) {
  const por = await Promise.all(projetos.map(async (pid) => {
    const snap = await getDocs(query(collection(db(), "equipes", pid, "mapas"), where("data", ">=", de), where("data", "<=", ate), orderBy("data")));
    return snap.docs.map((d) => ({ projetoId: pid, ...d.data() })).filter((m) => m.status === "enviado");
  }));
  return por.flat();
}

export async function saveMapa(mapa) {
  const agora = new Date().toISOString();
  const doc_ = semUndefined({ ...mapa, atualizadoEm: agora });
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

// Lança Falta/FT/Atraso do mapa na ficha (histórico do colaborador) pelo mesmo endpoint da tela de Equipe,
// que faz a mescla segura (nada é sobrescrito). Sem exceções novas, não grava nada.
export async function lancarNaFicha(mapa) {
  const ref = doc(db(), "equipes", mapa.projetoId);
  // Sempre do servidor (nunca do cache do aparelho): a base da mescla tem que ser a ficha de verdade.
  const ler = async () => { try { return await getDocFromServer(ref); } catch (e) { return getDoc(ref); } };
  let r = null;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const snap = await ler();
    const before = snap.exists() ? snap.data() : { colaboradores: [], desligados: [] };
    r = aplicarNaFicha(before, mapa);
    if (!r.mudou || isDemo()) break;
    const resp = await authFetchEquipe("/api/equipe-save", { method: "POST", body: JSON.stringify({ pid: mapa.projetoId, before, after: r.after }) });
    const res = await resp.json().catch(() => ({}));
    if (resp.status === 409 && tentativa === 0) continue; // alguém mexeu na ficha no meio: relê e tenta de novo
    if (!resp.ok || !res.ok) throw new Error(res.erro || "Não foi possível salvar na ficha.");
    break;
  }
  if (isDemo()) return r;
  // Confere de volta no servidor: o que o mapa pede tem que estar na ficha.
  const conf = await ler();
  const colabs = (conf.exists() ? conf.data() : {}).colaboradores || [];
  const faltando = lancamentosDoMapa(mapa).filter((l) => colabs.some((c) => c.id === l.colabId) && !((colabs.find((c) => c.id === l.colabId) || {}).historico || []).some((h) => h && h.id === l.id));
  if (faltando.length) throw new Error("a gravação não conferiu na ficha");
  return { ...r, conferido: true };
}
