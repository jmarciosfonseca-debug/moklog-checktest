// Mapa de Equipe diário — leitura e gravação no Firestore.
// Documentos em equipes/{pid}/mapas/{projeto_AAAA-MM-DD_D|N}: subpasta da Equipe do próprio projeto,
// que as regras atuais já cobrem (como equipes/{pid}/fv). Não depende de coleção nova.
import { getApps } from "firebase/app";
import { getFirestore, doc, getDoc, getDocFromServer, collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { setDoc } from "../fireGuard";
import { diasEntre } from "./regras";
import { contarOcorrencias } from "./painel";
import { isDemo, authFetchEquipe } from "../session";
import { aplicarNaFicha, lancamentosDoMapa } from "./ficha";
import { semUndefined, corrigirRondaNosRotulos, ehMoto, kmInteiro } from "./modelo";
import { gravarSecaoEquipamentos } from "../equipamentosStore";
import { afastamentoVigente, desligamentosRecentes } from "../equipeEventos";

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
    .map((c) => ({ id: c.id, nome: c.nome || "", cargo: c.cargo || "", turno: c.turno || "", emFerias: ferias.has(c.id), equipeLiderId: c.equipeLiderId || null, equipeLideresExtra: Array.isArray(c.equipeLideresExtra) ? c.equipeLideresExtra : [], afastamento: afastamentoVigente(c.historico, hojeISO) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// Desligamentos registrados nas últimas 24h (aviso no mapa).
export async function loadDesligamentosRecentes(pid, agora = new Date()) {
  const snap = await getDoc(doc(db(), "equipes", pid));
  const d = snap.exists() ? snap.data() : {};
  return desligamentosRecentes(d.desligados, agora, 24);
}

// Cadastro de Equipamentos do projeto (somente leitura) para conferir o material no mapa.
export async function loadEquipamentos(pid) {
  const snap = await getDoc(doc(db(), "equipamentos", pid));
  return snap.exists() ? snap.data() : null;
}

export async function loadMapa(pid, chave) {
  const snap = await getDoc(doc(db(), "equipes", pid, "mapas", chave));
  return snap.exists() ? corrigirRondaNosRotulos(snap.data()) : null;
}

// Último mapa já enviado do mesmo turno, anterior a `antesDe` (serve de base para pré-preencher).
// 12x36 (`gapPar`): a turma só volta a cada 2 dias, então só vale mapa com número PAR de dias de diferença
// (o de ontem é da outra turma).
// Ordena só por data (sem índice composto) e filtra no cliente.
export async function loadUltimoMapa(pid, turno, antesDe, { gapPar = false } = {}) {
  const snap = await getDocs(query(collection(db(), "equipes", pid, "mapas"), orderBy("data", "desc"), limit(14)));
  const lista = snap.docs.map((d) => d.data()).filter((m) => m.turno === turno && m.status === "enviado" && m.data < antesDe && (!gapPar || Math.abs(diasEntre(m.data, antesDe)) % 2 === 0));
  return corrigirRondaNosRotulos(lista[0] || null);
}

// Último plantão ENVIADO do projeto, de qualquer turno/equipe, anterior a este (data + turno; D antes de N).
// Serve só para o km anterior dos veículos — a moto é a mesma para todo mundo.
export async function loadUltimoPlantao(pid, data, turno) {
  const snap = await getDocs(query(collection(db(), "equipes", pid, "mapas"), orderBy("data", "desc"), limit(14)));
  const ord = (m) => `${m.data}${m.turno === "N" ? "1" : "0"}`;
  const alvo = `${data}${turno === "N" ? "1" : "0"}`;
  const lista = snap.docs.map((d) => d.data()).filter((m) => m.status === "enviado" && ord(m) < alvo).sort((a, b) => ord(b).localeCompare(ord(a)));
  return lista[0] || null;
}

// Consolidado (gerencial): mapas CONCLUÍDOS de vários projetos num período [de, ate] (datas ISO).
// Filtro de faixa e ordenação no mesmo campo (`data`): não exige índice composto. Se um projeto falhar, a leitura inteira falha
// (consolidado com projeto faltando seria número errado) — quem chama avisa.
export async function loadMapasPeriodo(projetos, de, ate) {
  const por = await Promise.all(projetos.map(async (pid) => {
    const snap = await getDocs(query(collection(db(), "equipes", pid, "mapas"), where("data", ">=", de), where("data", "<=", ate), orderBy("data")));
    return snap.docs.map((d) => corrigirRondaNosRotulos({ projetoId: pid, ...d.data() })).filter((m) => m.status === "enviado");
  }));
  return por.flat();
}

// Nunca deixar uma gravação pendurada sem resposta: no posto o sinal oscila e o setDoc pode
// ficar esperando para sempre — o líder fica no escuro e o mapa "some" (bug de campo 15/10).
const comTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => { setTimeout(() => rej(new Error(msg)), ms); })]);

export async function saveMapa(mapa) {
  const agora = new Date().toISOString();
  const doc_ = semUndefined({ ...mapa, atualizadoEm: agora });
  await comTimeout(setDoc(doc(db(), "equipes", mapa.projetoId, "mapas", mapa.id), doc_), 8000, "Sem resposta do servidor — confira a conexão.");
  return doc_;
}

// ENVIO OFICIAL do mapa (Concluir): grava e CONFIRMA lendo de volta DO SERVIDOR.
// Só com a confirmação o WhatsApp é liberado — acaba o "enviei mas o painel ficou Pendente":
// ou o mapa está comprovadamente no servidor, ou o líder é avisado na hora de que não chegou.
export async function enviarMapa(mapa, { timeoutMs = 12000 } = {}) {
  const agora = new Date().toISOString();
  const doc_ = semUndefined({ ...mapa, atualizadoEm: agora });
  const ref = doc(db(), "equipes", mapa.projetoId, "mapas", mapa.id);
  await comTimeout(setDoc(ref, doc_), timeoutMs, "o mapa NÃO chegou ao servidor (sem conexão)");
  if (isDemo()) return doc_;                                  // demonstração: nada vai ao banco mesmo
  const conf = await comTimeout(getDocFromServer(ref), timeoutMs, "gravou, mas não deu para CONFIRMAR no servidor");
  if (!conf.exists() || conf.data().atualizadoEm !== agora) throw new Error("a confirmação no servidor não bateu");
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
// SEMPRE do servidor: cache nunca decide quem está Pendente. Falhou a leitura de um projeto?
// Ele volta marcado como "sem leitura" — nunca como Pendente falso.
export async function loadEnviosDoTurno(itens) {
  const res = await Promise.all(itens.map(async ({ projetoId, data, turno, chave }) => {
    try {
      const snap = await getDocFromServer(doc(db(), "equipes", projetoId, "mapas", chave));
      const m = snap.exists() ? corrigirRondaNosRotulos(snap.data()) : null;
      return { projetoId, data, turno, enviadoEm: m && m.status === "enviado" ? m.enviadoEm : null, ocorrencias: m && m.status === "enviado" ? contarOcorrencias(m) : 0 };
    } catch (e) {
      return { projetoId, data, turno, erroLeitura: true };
    }
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

// ── Equipamentos pelo mapa ───────────────────────────────────────────────────
// Sempre do servidor: a base da gravação (before) tem que ser o cadastro de verdade.
export async function loadEquipamentosFresco(pid) {
  const ref = doc(db(), "equipamentos", pid);
  let snap;
  try { snap = await getDocFromServer(ref); } catch (e) { snap = await getDoc(ref); }
  return snap.exists() ? snap.data() : null;
}

// O líder corrige no mapa o cadastro de um item (identificação e/ou quantidade). id = "categoria:idDoItem".
export async function corrigirItemEquipamento(pid, itemId, { identificacao, qtd }) {
  const [cat, ...resto] = String(itemId).split(":");
  const idItem = resto.join(":");
  const eq = (await loadEquipamentosFresco(pid)) || {};
  const lista = Array.isArray(eq[cat]) ? eq[cat] : [];
  const alvo = lista.find((x, i) => String(x && x.id != null ? x.id : i) === idItem);
  if (!alvo) throw new Error("Este item não está mais no cadastro. Feche e abra o mapa de novo.");
  const novo = { ...alvo };
  if (identificacao != null) novo.identificacao = String(identificacao).trim();
  if (qtd != null) novo.qtd = Number(qtd);
  const depois = lista.map((x) => (x === alvo ? novo : x));
  await gravarSecaoEquipamentos(pid, cat, eq, depois);
  return loadEquipamentosFresco(pid);
}

// Ao enviar o mapa: o km da Moto no cadastro acompanha o odômetro (só se for maior).
export async function atualizarKmMotoNoCadastro(pid, mapa) {
  const v = (mapa.veiculos || []).find(ehMoto);
  const km = v ? kmInteiro(v.kmAtual) : null;
  if (km == null) return { atualizado: false };
  const eq = (await loadEquipamentosFresco(pid)) || {};
  const moto = eq.moto;
  if (!moto || typeof moto !== "object") return { atualizado: false };
  const atual = kmInteiro(moto.km);
  if (atual != null && km <= atual) return { atualizado: false };
  await gravarSecaoEquipamentos(pid, "moto", eq, { ...moto, km });
  return { atualizado: true, km };
}
