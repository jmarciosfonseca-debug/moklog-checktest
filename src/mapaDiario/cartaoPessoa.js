// ─────────────────────────────────────────────────────────────
// Cartão de identidade a partir do Mapa de Equipe (Marcio, 20/11/2026): no painel gerencial, tocar numa pessoa do mapa
// abre o MESMO cartão da Área do Cliente (foto grande + posto, situação, cargo, turno, no projeto desde, treinamentos).
// Só leitura: lê equipes/{pid} para completar cargo/turno/desde/treinos; sem isso, o cartão abre com o que o mapa já tem.
// ─────────────────────────────────────────────────────────────
import { getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { ROTULO_SITUACAO } from "./modelo";

const COR_SITUACAO = { presente: "#22c55e", atraso: "#f59e0b", falta: "#ef4444", vago: "#ef4444", ft: "#a855f7", cobertura: "#38bdf8", troca: "#38bdf8" };
export const corSituacao = (s) => COR_SITUACAO[s] || "#64748b";
const sem = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Colaboradores do projeto no formato do cartão. Falha de leitura devolve [] (o cartão abre só com os dados do mapa).
export async function loadColabsCartao(pid) {
  const app = getApps()[0];
  if (!app) return [];
  const snap = await getDoc(doc(getFirestore(app), "equipes", pid));
  const d = snap.exists() ? snap.data() : {};
  return [...(d.colaboradores || []), ...(d.desligados || [])].filter((c) => c && typeof c === "object").map((c) => ({
    id: c.id, nome: c.nome || "", cargo: c.cargo || "", turno: c.turno || "", desde: c.dataContratacao || "",
    treinos: (c.historico || []).filter((h) => h && h.tipo === "Treinamento").length,
  }));
}

// x = { pessoaId, nome, posto, situacao, foto, lider } vindo do MapaVisual. Mesma regra do cartão da Área do Cliente.
export function montarCartao(x, colabs = []) {
  const k = (colabs || []).find((c) => (x.pessoaId && c.id === x.pessoaId) || (x.nome && sem(c.nome) === sem(x.nome)));
  const sit = x.situacao || "presente";
  return {
    nome: x.nome || (k && k.nome) || "", posto: x.posto, situacaoRotulo: ROTULO_SITUACAO[sit] || sit, cor: corSituacao(sit),
    foto: x.foto || undefined, cargo: k && k.cargo, turno: k && k.turno, desde: k && k.desde, treinos: k && k.treinos,
    lider: !!x.lider || /l[ií]der/i.test(`${x.posto || ""} ${(k && k.cargo) || ""}`),
  };
}
