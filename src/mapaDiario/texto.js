// Mapa de Equipe diário — texto do WhatsApp (puro).
// Títulos em negrito e emoji por assunto (início, efetivo, destaque de falta/FT e informações adicionais abaixo). P260B e P260C saem com cabeçalho "P260-B"/"P260-C"
// (o P260B envia ao grupo do P260A).
import { rotuloDia } from "./regras";
import { ROTULO_SITUACAO, kmRodado, rotuloSaida } from "./modelo";

export const cabecalhoProjeto = (pid) => (/^P260[BC]$/.test(pid) ? `P260-${pid.slice(-1)}` : pid);

const dataBR = (iso) => iso.split("-").reverse().join("/");
const hh = (h) => (h ? h.replace(":", "h") : "");
export const rotuloTurno = (turno, horario) => {
  const nome = turno === "N" ? "Noturno" : "Diurno";
  return horario ? `${nome} ${hh(horario.inicio)}–${hh(horario.fim)}` : nome;
};

const SEPARADOR = "━━━━━━━━━━━━━━";
const nomeDe = (p) => (p.pessoaNome || "").trim();
const horarioDe = (p) => (p.horario ? ` (${hh(p.horario.inicio)}–${hh(p.horario.fim)})` : "");

// Linha do efetivo: posto em negrito; a exceção ganha emoji e a palavra em negrito.
function linhaPosto(p) {
  const nome = nomeDe(p);
  const d = p.detalhe || {};
  const rot = `*${p.rotulo}${horarioDe(p)}:*`;
  switch (p.situacao) {
    case "vago": return `⚪ ${rot} sem ninguém no posto`;
    case "falta": return `❌ ${rot} ${nome} — *FALTA*`;
    case "atraso": return `⏰ ${rot} ${nome} — *ATRASO*${d.hora ? `, chegou às ${hh(d.hora)}` : ""}${d.minutos ? ` (${d.minutos} min)` : ""}`;
    case "ft": return `🔄 ${rot} ${nome} — *FT* (folga trabalhada)${d.quemFaltou ? `, cobrindo a falta de ${d.quemFaltou}` : d.postoVago ? ", cobrindo posto vago" : ""}`;
    case "cobertura": return `🤝 ${rot} ${nome}${d.base ? " (Base)" : ""} — *COBERTURA* de ${d.deQuem}${d.semFalta ? " (não foi falta)" : ""}`;
    case "troca": return `🔁 ${rot} ${nome} — *TROCA DE PLANTÃO*, no lugar de ${d.noLugarDe}`;
    default: return `✅ ${rot} ${nome}`;
  }
}

// Bloco de destaque: só o que saiu do normal, com o detalhe (quem faltou, quem cobriu).
function linhaOcorrencia(p, postos) {
  const nome = nomeDe(p);
  const d = p.detalhe || {};
  const onde = `${p.rotulo}${horarioDe(p)}`;
  switch (p.situacao) {
    case "vago": return `⚪ *SEM NINGUÉM* — ${onde}`;
    case "falta": {
      const ft = (postos || []).find((x) => x.id && x.id === d.porFtDe);
      return `❌ *FALTA* — ${nome} (${onde})${ft && nomeDe(ft) ? ` — coberta por FT de ${nomeDe(ft)}` : ""}`;
    }
    case "atraso": return `⏰ *ATRASO* — ${nome} (${onde})${d.hora ? `, chegou às ${hh(d.hora)}` : ""}${d.minutos ? ` (${d.minutos} min)` : ""}`;
    case "ft": return `🔄 *FT* — ${nome} (${onde})${d.quemFaltou ? `, cobrindo a falta de ${d.quemFaltou}` : d.postoVago ? ", cobrindo posto vago" : ""}`;
    case "cobertura": return `🤝 *COBERTURA* — ${nome}${d.base ? " (Base)" : ""} (${onde}), cobrindo ${d.deQuem}${d.semFalta ? " (não foi falta)" : ""}`;
    case "troca": return `🔁 *TROCA DE PLANTÃO* — ${nome} (${onde}), no lugar de ${d.noLugarDe}`;
    default: return "";
  }
}

// Cada assunto é um bloco com título em negrito e o conteúdo logo abaixo; blocos separados por linha em branco.
export function montarTextoWhatsApp(mapa, { nomeProjeto = "" } = {}) {
  const blocos = [];
  blocos.push([
    "📋 *MAPA DE EQUIPE*",
    SEPARADOR,
    `🏢 *Projeto:* ${cabecalhoProjeto(mapa.projetoId)}${nomeProjeto ? ` — ${nomeProjeto}` : ""}`,
    `🕒 *Turno:* ${rotuloTurno(mapa.turno, mapa.horario)}`,
    `📅 *Data:* ${rotuloDia(mapa.data)}, ${dataBR(mapa.data)}`,
  ]);
  const eq = ["👥 *EFETIVO*"];
  (mapa.postos || []).forEach((p) => { eq.push(linhaPosto(p)); if (p.saida) eq.push(`      ↳ 🚪 ${rotuloSaida(p)}`); if (p.obs && p.obs.trim()) eq.push(`      ↳ ${p.obs.trim()}`); });
  blocos.push(eq);
  const exc = (mapa.postos || []).filter((p) => (p.situacao !== "presente" && linhaOcorrencia(p, mapa.postos)) || p.saida);
  blocos.push(["🚨 *FALTAS / ATRASOS / FT / TROCAS*", ...(exc.length ? exc.flatMap((p) => [linhaOcorrencia(p, mapa.postos), p.saida ? `🚪 *SAÍDA ANTECIPADA* — ${nomeDe(p)} (${p.rotulo}${horarioDe(p)}): ${rotuloSaida(p)}` : ""].filter(Boolean)) : ["✅ Sem ocorrências"])]);
  const mat = mapa.material || { semAlteracao: true };
  const mexc = (mat.excecoes || []);
  const m = ["🧰 *MATERIAL (armamento, munição, rádios)*"];
  if (mat.semAlteracao && !mexc.length) {
    m.push(`✅ Sem alteração — conferido e disponível${mat.conferidos ? ` (${mat.conferidos})` : ""}`);
  } else {
    m.push("⚠️ *COM ALTERAÇÃO*");
    mexc.forEach((e) => m.push(`• ${e.nome}${e.detalhe ? ` (${e.detalhe})` : ""} — *${e.situacao === "indisponivel" ? "INDISPONÍVEL" : "ANOMALIA"}:* ${(e.obs || "").trim()}`));
    if ((mat.obs || "").trim()) m.push(`      ↳ ${mat.obs.trim()}`);
  }
  const qs = Object.values(mat.quantidades || {}).filter((q) => q && String(q.qtd).trim());
  if (qs.length) m.push(`📦 Quantidades conferidas: ${qs.map((q) => `${q.nome} ${q.qtd}`).join(" · ")}`);
  blocos.push(m);
  // Veículo sem nenhuma leitura não vira linha (antes saía "Veículo 2: —").
  const veic = [];
  (mapa.veiculos || []).forEach((v) => {
    const r = kmRodado(v);
    const partes = [];
    if (v.kmAnterior != null && v.kmAnterior !== "") partes.push(`anterior ${v.kmAnterior}`);
    if (v.kmAtual != null && v.kmAtual !== "") partes.push(`atual ${v.kmAtual}`);
    if (r != null) partes.push(`rodado ${r} km`);
    if (partes.length) veic.push(`• *${v.rotulo || "Veículo"}:* ${partes.join(" · ")}`);
  });
  if (veic.length) blocos.push(["🚗 *VEÍCULOS*", ...veic]);
  const s = mapa.supervisao;
  const vis = mapa.visita;
  blocos.push(["🔎 *ÚLTIMA VISITA DA SUPERVISÃO*", s && s.ultimaData ? `${dataBR(s.ultimaData)}${s.supervisor ? ` — ${s.supervisor}` : ""}${s.turno ? ` (${s.turno})` : ""}` : "—",
    ...(vis && typeof vis.houve === "boolean" ? [vis.houve ? `Neste turno: visita de ${(vis.supervisor || "").trim()}` : "Neste turno: sem visita"] : [])]);
  if (mapa.resumo && mapa.resumo.trim()) blocos.push(["📝 *RESUMO DA PASSAGEM*", mapa.resumo.trim()]);
  if (mapa.observacoes && mapa.observacoes.trim()) blocos.push(["💬 *OBSERVAÇÕES*", mapa.observacoes.trim()]);
  return blocos.map((b) => b.join("\n")).join("\n\n");
}

export const linkWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
