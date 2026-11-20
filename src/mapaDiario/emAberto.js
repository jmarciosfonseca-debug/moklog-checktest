// ─────────────────────────────────────────────────────────────
// Equipamentos EM ABERTO no Mapa de Equipe (Marcio, 18/11 e 20/11/2026): item de Equipamentos (armamento, rádio HT,
// lanterna, bodycam etc.) marcado Parcial ou Inoperante sai AUTOMÁTICO em todo plantão, com os dias em aberto, até a
// equipe marcar "Resolvido" em Equipamentos. Aviso discreto (triângulo, sem piscar): é informação, não alarme.
// Puro: lê o que já está no cadastro (status, dataProblem, justificativa, ocorrencias) e não grava nada.
// ─────────────────────────────────────────────────────────────
import { diasEntre } from "../equipamentosOcorrencias";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const hojeISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Valores de status do cadastro (Equipamentos.jsx) que contam como "em aberto".
const ROTULO_STATUS = { parcial: "parcial", inop: "inoperante", inoperante: "inoperante" };
// Munição tem a própria contagem (quantidade) e o status dela vem da quantidade, não de defeito do equipamento.
const FORA = new Set(["municao"]);

// Desde quando o item está em aberto: dataProblem do cadastro; senão a abertura da ocorrência ainda não fechada.
export function desdeDoItem(it) {
  if (!it) return "";
  if (ISO.test(String(it.dataProblem || ""))) return it.dataProblem;
  const oc = Array.isArray(it.ocorrencias) ? it.ocorrencias : [];
  for (let k = oc.length - 1; k >= 0; k--) if (oc[k] && !oc[k].fechadaEm && ISO.test(String(oc[k].abertaEm || ""))) return oc[k].abertaEm;
  return "";
}

// itens = lista do mapa (itensDeEquipamento): { id, categoria, rotuloCategoria, nome, cadastro, desde, motivo }.
// Devolve só o que está parcial/inoperante, já com os dias. Campos simples (vão no documento do mapa, sem undefined).
export function emAbertoDosItens(itens, agora = new Date()) {
  const hoje = hojeISO(agora);
  const out = [];
  (Array.isArray(itens) ? itens : []).forEach((i) => {
    if (!i || i.origem === "base" || FORA.has(i.categoria)) return;
    const status = ROTULO_STATUS[String(i.cadastro || "").toLowerCase()];
    if (!status) return;
    const desde = ISO.test(String(i.desde || "")) ? i.desde : "";
    out.push({
      id: String(i.id), categoria: i.categoria || "", rotuloCategoria: i.rotuloCategoria || "", nome: String(i.nome || "").trim() || "Equipamento",
      status, desde, dias: desde ? diasEntre(desde, hoje) : null, motivo: String(i.motivo || "").trim().slice(0, 140),
    });
  });
  // Inoperante antes de parcial; dentro de cada um, o mais antigo primeiro.
  return out.sort((a, b) => (a.status === b.status ? 0 : a.status === "inoperante" ? -1 : 1) || (b.dias ?? -1) - (a.dias ?? -1));
}

// O que ficou gravado no mapa ao concluir (ou []).
export function emAbertoDoMapa(mapa) {
  const l = mapa && mapa.material && mapa.material.emAberto;
  return Array.isArray(l) ? l.filter((x) => x && x.nome && ROTULO_STATUS[x.status]) : [];
}

export function rotuloDias(dias) {
  if (dias == null) return "";
  if (dias === 0) return "desde hoje";
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

// "Rádio HT 02 — inoperante há 3 dias · conector danificado"
export function linhaEmAberto(x, { comMotivo = true } = {}) {
  const dias = rotuloDias(x.dias);
  return `${x.nome} — ${x.status}${dias ? ` ${dias}` : ""}${comMotivo && x.motivo ? ` · ${x.motivo}` : ""}`;
}
