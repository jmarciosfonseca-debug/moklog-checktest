// Relatório de Iluminação — padrão Moked (aprovado em 04/10/2026).
// Mapa do projeto (com os quadrantes desenhados) EMBUTIDO no arquivo como data URL, para aparecer também
// quando o PDF/HTML é aberto fora do app (WhatsApp, e-mail). Visual + texto: KPIs, mapa, tabela por
// quadrante com barra, e destaques escritos a partir dos números.
import { documentoMoked, escHTML, dataBR, num1 } from "./padraoMoked";

const calcQuad = (q) => {
  const total = Number(q?.total) || 0;
  const def = q?.deficientes == null || q?.deficientes === "" ? null : Math.min(total, Number(q.deficientes) || 0);
  const ops = def == null ? total : total - def;
  const pct = total ? Math.round((ops / total) * 1000) / 10 : 0;
  return { total, def, ops, pct };
};
const faixa = (pct) => (pct >= 95 ? "ok" : pct >= 85 ? "wa" : "da");

export function analisarIluminacao(data) {
  const qs = (data?.quadrantes || []).map((q) => ({ nome: q.nome || "—", atualizadoEm: q.atualizadoEm || null, ...calcQuad(q) }));
  const aferidos = qs.filter((q) => q.def != null);
  const total = qs.reduce((a, q) => a + q.total, 0);
  const def = aferidos.reduce((a, q) => a + q.def, 0);
  const pct = total ? Math.round(((total - def) / total) * 1000) / 10 : 0;
  const ult = data?.testeQuinzenal?.ultimoRegistro || null;
  const dataUlt = ult?.data || null;
  const desatualizados = dataUlt ? qs.filter((q) => q.atualizadoEm && String(q.atualizadoEm).slice(0, 10) < dataUlt) : [];
  const piores = [...aferidos].filter((q) => q.def > 0).sort((a, b) => a.pct - b.pct || b.def - a.def);
  return {
    qs, total, def, ops: total - def, pct,
    naoAferidos: qs.filter((q) => q.def == null),
    zerados: aferidos.filter((q) => q.total > 0 && q.pct === 0),
    piores, desatualizados,
    ultimoTeste: dataUlt, assinadoPor: ult?.assinadoPor || null,
    proximoAlvo: data?.testeQuinzenal?.alvo || null,
  };
}

export function montarRelatorioIluminacao(project, data, { mapaDataUrl = null, hoje = new Date() } = {}) {
  const a = analisarIluminacao(data);
  const numero = `MK-${project.id}-IL-${String(hoje.getMonth() + 1).padStart(2, "0")}${String(hoje.getDate()).padStart(2, "0")}`;
  const sub = `<b>${escHTML(project.id)} — ${escHTML(project.name || "")}</b> · ${a.qs.length} quadrantes · ${a.total} pontos de iluminação${a.ultimoTeste ? ` · último teste quinzenal ${dataBR(a.ultimoTeste)}` : ""}`;

  const kpis = `<section class="mk-kpis">
    <div class="mk-k"><div class="mk-kv ${a.pct < 85 ? "mk-da" : a.pct < 95 ? "mk-wa" : ""}">${num1(a.pct)}%</div><div class="mk-kl">pontos operantes</div><div class="mk-mu mk-sm">${a.ops} de ${a.total}</div></div>
    <div class="mk-k"><div class="mk-kv ${a.def ? "mk-da" : ""}">${a.def}</div><div class="mk-kl">pontos deficientes</div><div class="mk-mu mk-sm">em ${a.piores.length} de ${a.qs.length} quadrantes</div></div>
    <div class="mk-k"><div class="mk-kv">${a.ultimoTeste ? dataBR(a.ultimoTeste) : "—"}</div><div class="mk-kl">último teste quinzenal</div><div class="mk-mu mk-sm">${a.assinadoPor ? "assinado por " + escHTML(a.assinadoPor) : "sem assinatura registrada"}</div></div>
    <div class="mk-k"><div class="mk-kv">${a.proximoAlvo ? dataBR(a.proximoAlvo) : "—"}</div><div class="mk-kl">próximo teste</div><div class="mk-mu mk-sm">domingo, 21h</div></div></section>`;

  const mapa = mapaDataUrl
    ? `<figure class="mk-card" style="margin:0 0 10px;padding:8px;page-break-inside:avoid"><div class="mk-lb" style="margin-bottom:6px">Mapa do projeto e divisão por quadrante</div>
       <img src="${mapaDataUrl}" alt="Mapa de quadrantes ${escHTML(project.id)}" style="width:100%;max-height:150mm;object-fit:contain;border-radius:4px;display:block">
       <figcaption class="mk-mu mk-sm" style="margin-top:4px">Os rótulos no mapa correspondem aos quadrantes da tabela abaixo.</figcaption></figure>`
    : `<div class="mk-dest"><b>Mapa não configurado.</b> Cadastre a imagem com os quadrantes em Teste de Iluminação → Configuração.</div>`;

  const dest = [];
  if (a.piores.length) {
    const t = a.piores.slice(0, 3).map((q) => `<b>${escHTML(q.nome)}</b> (${num1(q.pct)}%, ${q.def} de ${q.total})`).join("; ");
    dest.push(`<li>Quadrantes com mais falha: ${t}.</li>`);
  } else if (a.qs.length) dest.push(`<li>Nenhum ponto deficiente nos quadrantes aferidos.</li>`);
  if (a.zerados.length) dest.push(`<li><b>Sem iluminação operante:</b> ${a.zerados.map((q) => escHTML(q.nome)).join(", ")}. Risco de ponto cego para CFTV e ronda.</li>`);
  if (a.naoAferidos.length) dest.push(`<li><b>Não aferidos</b> (sem número de deficientes): ${a.naoAferidos.map((q) => escHTML(q.nome)).join(", ")}. Entram no total, mas não no percentual de falha.</li>`);
  if (a.desatualizados.length) dest.push(`<li><b>${a.desatualizados.length} quadrante(s)</b> sem atualização desde o último teste quinzenal (${dataBR(a.ultimoTeste)}): ${a.desatualizados.slice(0, 6).map((q) => `${escHTML(q.nome)} (${dataBR(String(q.atualizadoEm).slice(0, 10))})`).join(", ")}${a.desatualizados.length > 6 ? "…" : ""}.</li>`);
  const destaques = dest.length ? `<section class="mk-dest"><div class="mk-h2">Análise</div><ul>${dest.join("")}</ul></section>` : "";

  const linhas = a.qs.map((q) => {
    const f = q.def == null ? "in" : faixa(q.pct);
    return `<tr><td><b>${escHTML(q.nome)}</b>${q.atualizadoEm ? `<div class="mk-mu">atualizado ${dataBR(String(q.atualizadoEm).slice(0, 10))}</div>` : ""}</td>
      <td class="mk-num">${q.total}</td><td class="mk-num">${q.def == null ? '<span class="mk-nao">—</span>' : q.def}</td><td class="mk-num">${q.ops}</td>
      <td><div style="display:flex;align-items:center;gap:6px"><span style="flex:1;height:7px;background:#EEF0F3;border-radius:4px;overflow:hidden"><span style="display:block;height:100%;width:${q.def == null ? 0 : q.pct}%;background:${f === "da" ? "#B91C1C" : f === "wa" ? "#D97706" : "#374151"}"></span></span>
      <span class="mk-b mk-b-${f}">${q.def == null ? "não aferido" : num1(q.pct) + "%"}</span></div></td></tr>`;
  }).join("");
  const tabela = a.qs.length
    ? `<section><div class="mk-h2">Pontos por quadrante</div><table class="mk-tb"><colgroup><col style="width:30%"><col style="width:11%"><col style="width:13%"><col style="width:12%"><col style="width:34%"></colgroup>
      <thead><tr><th>Quadrante</th><th class="mk-num">Pontos</th><th class="mk-num">Deficientes</th><th class="mk-num">Operantes</th><th>% operante</th></tr></thead><tbody>${linhas}</tbody></table></section>`
    : `<div class="mk-vazio"><div class="mk-big">0</div><div class="mk-kl">quadrantes cadastrados</div></div>`;

  return documentoMoked({ project, titulo: "Relatório de Iluminação", subtitulo: sub, numero, hoje, corpo: kpis + mapa + destaques + tabela });
}

// Converte a imagem do mapa (URL do próprio app) em data URL, para embutir no arquivo.
export async function mapaParaDataUrl(url) {
  if (!url) return null;
  try {
    const r = await fetch(url, { cache: "force-cache" });
    if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(null); fr.readAsDataURL(b); });
  } catch (e) { return null; }
}
