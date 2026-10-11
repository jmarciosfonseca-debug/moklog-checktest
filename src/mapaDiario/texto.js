// Mapa de Equipe diário — texto do WhatsApp (puro).
// Mantém o jeito do mapa de hoje, mais limpo. P260B e P260C saem com cabeçalho "P260-B"/"P260-C"
// (o P260B envia ao grupo do P260A).
import { rotuloDia } from "./regras";
import { ROTULO_SITUACAO, kmRodado } from "./modelo";

export const cabecalhoProjeto = (pid) => (/^P260[BC]$/.test(pid) ? `P260-${pid.slice(-1)}` : pid);

const dataBR = (iso) => iso.split("-").reverse().join("/");
const hh = (h) => (h ? h.replace(":", "h") : "");
export const rotuloTurno = (turno, horario) => {
  const nome = turno === "N" ? "Noturno" : "Diurno";
  return horario ? `${nome} ${hh(horario.inicio)}–${hh(horario.fim)}` : nome;
};

function linhaPosto(p) {
  const nome = (p.pessoaNome || "").trim();
  const d = p.detalhe || {};
  const horario = p.horario ? ` (${hh(p.horario.inicio)}–${hh(p.horario.fim)})` : "";
  const base = `• ${p.rotulo}${horario}: `;
  switch (p.situacao) {
    case "vago": return `${base}— sem ninguém no posto`;
    case "falta": return `${base}${nome} — FALTA`;
    case "atraso": return `${base}${nome} — atraso${d.hora ? `, chegou às ${hh(d.hora)}` : ""}${d.minutos ? ` (${d.minutos} min)` : ""}`;
    case "ft": return `${base}${nome} — FT (folga trabalhada)`;
    case "cobertura": return `${base}${nome}${d.base ? " (Base)" : ""} — cobertura de ${d.deQuem}`;
    case "troca": return `${base}${nome} — troca de plantão, no lugar de ${d.noLugarDe}`;
    default: return `${base}${nome}`;
  }
}

export function montarTextoWhatsApp(mapa, { nomeProjeto = "" } = {}) {
  const L = [];
  L.push("*MAPA DE EQUIPE*");
  L.push(`*Projeto:* ${cabecalhoProjeto(mapa.projetoId)}${nomeProjeto ? ` — ${nomeProjeto}` : ""}`);
  L.push(`*Turno:* ${rotuloTurno(mapa.turno, mapa.horario)}`);
  L.push(`*Data:* ${rotuloDia(mapa.data)}, ${dataBR(mapa.data)}`);
  L.push("");
  L.push("*Equipe:*");
  (mapa.postos || []).forEach((p) => { L.push(linhaPosto(p)); if (p.obs && p.obs.trim()) L.push(`   ↳ ${p.obs.trim()}`); });
  const excPostos = (mapa.postos || []).filter((p) => p.situacao !== "presente" && ROTULO_SITUACAO[p.situacao]);
  L.push("");
  L.push(`*Faltas/atrasos/FT/trocas:* ${excPostos.length ? excPostos.map((p) => `${p.rotulo} — ${ROTULO_SITUACAO[p.situacao]}`).join("; ") : "Sem ocorrências"}`);
  const mat = mapa.material || { semAlteracao: true };
  const exc = (mat.excecoes || []);
  if (mat.semAlteracao && !exc.length) {
    L.push(`*Material (armamento, munição, rádios):* Sem alteração — conferido e disponível${mat.conferidos ? ` (${mat.conferidos})` : ""}`);
  } else {
    L.push("*Material (armamento, munição, rádios):* COM ALTERAÇÃO");
    exc.forEach((e) => L.push(`• ${e.nome}${e.detalhe ? ` (${e.detalhe})` : ""} — ${e.situacao === "indisponivel" ? "INDISPONÍVEL" : "ANOMALIA"}: ${(e.obs || "").trim()}`));
    if ((mat.obs || "").trim()) L.push(`   ↳ ${mat.obs.trim()}`);
  }
  const qs = Object.values(mat.quantidades || {}).filter((q) => q && String(q.qtd).trim());
  if (qs.length) L.push(`   Quantidades conferidas: ${qs.map((q) => `${q.nome} ${q.qtd}`).join(" · ")}`);
  (mapa.veiculos || []).forEach((v) => {
    const r = kmRodado(v);
    const partes = [];
    if (v.kmAnterior != null && v.kmAnterior !== "") partes.push(`anterior ${v.kmAnterior}`);
    if (v.kmAtual != null && v.kmAtual !== "") partes.push(`atual ${v.kmAtual}`);
    if (r != null) partes.push(`rodado ${r} km`);
    L.push(`*${v.rotulo || "Veículo"}:* ${partes.length ? partes.join(" · ") : "—"}`);
  });
  const s = mapa.supervisao;
  L.push(`*Última visita da supervisão:* ${s && s.ultimaData ? `${dataBR(s.ultimaData)}${s.supervisor ? ` — ${s.supervisor}` : ""}${s.turno ? ` (${s.turno})` : ""}` : "—"}`);
  if (mapa.resumo && mapa.resumo.trim()) { L.push(""); L.push(`*Resumo da passagem:* ${mapa.resumo.trim()}`); }
  if (mapa.observacoes && mapa.observacoes.trim()) L.push(`*Observações:* ${mapa.observacoes.trim()}`);
  return L.join("\n");
}

export const linkWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
