// Mapa de Equipe diário — foto do colaborador cadastrado (somente leitura), para o "Ver" na tela e para o PDF consolidado.
// Reaproveita o resolvedor único da Equipe (fotoDe): foto por referência imutável (equipes/{pid}/fotos) ou legada no cadastro.
// Posto com nome digitado sem cadastro, ou colaborador sem foto, fica sem foto (a tela mostra as iniciais) — nunca quebra.
import { getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { carregarFotos, fotoDe } from "../fotosEquipe";

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const normNome = norm;

export const iniciais = (nome) => {
  const p = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
};

// colaboradores: itens do cadastro (com fotoRef/foto/temFoto); mapaFotos: { ref: dataUrl }. Devolve dados simples { porId, porNome }.
export function montarFotos(colaboradores, mapaFotos) {
  const porId = {}, porNome = {};
  for (const c of colaboradores || []) {
    const f = fotoDe(c, mapaFotos);
    if (!f) continue;
    if (c.id) porId[c.id] = f;
    const n = norm(c.nome);
    if (n && !porNome[n]) porNome[n] = f;
  }
  return { porId, porNome };
}

// Foto de uma pessoa: pelo id do cadastro; sem id (ou sem foto), pelo nome completo igual ao do cadastro.
export function fotoDaPessoa(fotos, pessoaId, nome) {
  if (!fotos) return "";
  return (pessoaId && fotos.porId[pessoaId]) || (nome && fotos.porNome[norm(nome)]) || "";
}

const cache = new Map();
const VALIDADE_MS = 10 * 60 * 1000;
export function limparCacheFotosMapa() { cache.clear(); }

export async function loadFotosProjeto(pid) {
  const c = cache.get(pid);
  if (c && Date.now() - c.em < VALIDADE_MS) return c.fotos;
  const app = getApps()[0];
  if (!app) throw new Error("Firebase não iniciado");
  const db = getFirestore(app);
  const [snap, mapaFotos] = await Promise.all([getDoc(doc(db, "equipes", pid)), carregarFotos(db, pid)]);
  const d = snap.exists() ? snap.data() : {};
  const fotos = montarFotos([...(d.colaboradores || []), ...(d.desligados || [])], mapaFotos);
  cache.set(pid, { fotos, em: Date.now() });
  return fotos;
}
