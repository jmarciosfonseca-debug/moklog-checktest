// Visão 360 em PDF — padrão único Moked (A4). Módulo puro (sem DOM): recebe as linhas já calculadas pela tela
// (computeScore360 + iluminação + energia) e devolve o HTML. "Todos" = versão interna; grupo = documento de cliente.
import { documentoMoked, escHTML, barrasMoked } from "./padraoMoked";

const e = escHTML;

export const FAIXA = { bom: 90, atencao: 75 }; // ≥90 bom · 75–89 atenção · <75 crítico
export const faixaDe = (s) => (s >= FAIXA.bom ? "ok" : s >= FAIXA.atencao ? "wa" : "da");
const ROTULO_FAIXA = { ok: "Bom", wa: "Atenção", da: "Crítico" };
const COR_NUM = { ok: "mk-ok", wa: "mk-wa", da: "mk-da" };
const TIPOS = { ctmk: "CTMK off-line", keyaccess: "Falha KeyAccess aberta", bolsao: "Placa crítica no bolsão", perimetro: "Zona perimetral com problema", ronda: "Ronda VSPP abaixo da meta" };

export const numero360 = (grupoLabel, hoje = new Date()) => {
  const iso = hoje.toLocaleDateString("sv-SE").replace(/-/g, "").slice(2);
  const g = grupoLabel ? String(grupoLabel).toUpperCase().replace(/[^A-Z0-9]/g, "") : "INT";
  return `MK-360-${g}-${iso}`;
};

// Soma dos pontos descontados por tipo de pendência, em todas as plantas.
export function penalidadesPorTipo(rows) {
  const por = {};
  rows.forEach((r) => (r.penalidades || []).forEach((p) => { por[p.tipo] = (por[p.tipo] || 0) + p.val; }));
  return Object.entries(por).map(([tipo, pts]) => [TIPOS[tipo] || tipo, pts]).sort((a, b) => b[1] - a[1]);
}

// Pontos de atenção: planta crítica, energia em aberto, iluminação deficiente, sem checklist. Só o que existe.
export function pontosDeAtencao(rows) {
  const itens = [];
  rows.forEach((r) => {
    const tag = `<b>${e(r.id)}</b>`;
    if (r.score < FAIXA.atencao) itens.push({ ordem: 0, html: `${tag} com nota ${r.score}/100${r.penalidades.length ? ` — ${r.penalidades.map((p) => e(p.label)).join("; ")}` : ""}` });
    else if (r.penalidades.length) itens.push({ ordem: 2, html: `${tag} (nota ${r.score}): ${r.penalidades.map((p) => e(p.label)).join("; ")}` });
    if (r.energiaAberta) itens.push({ ordem: 1, html: `${tag}: ocorrência de energia em aberto` });
    if (r.ilumDeficientes > 0) itens.push({ ordem: 3, html: `${tag}: ${r.ilumDeficientes} ponto${r.ilumDeficientes === 1 ? "" : "s"} de iluminação deficiente${r.ilumDeficientes === 1 ? "" : "s"}` });
    if (r.semChecklist) itens.push({ ordem: 4, html: `${tag}: sem checklist semanal enviado (a nota parte de 0)` });
  });
  return itens.sort((a, b) => a.ordem - b.ordem).map((i) => i.html);
}

function kpis(rows, media) {
  const criticas = rows.filter((r) => r.score < FAIXA.atencao).length;
  const comPend = rows.filter((r) => r.penalidades.length || r.energiaAberta).length;
  const pts = rows.reduce((a, r) => a + r.penalidades.reduce((b, p) => b + p.val, 0), 0);
  return `<div class="mk-kpis">
<div class="mk-k"><div class="mk-kv ${COR_NUM[faixaDe(media)]}">${media}<span class="mk-sm mk-mu">/100</span></div><div class="mk-kl">Nota média</div></div>
<div class="mk-k"><div class="mk-kv">${rows.length}</div><div class="mk-kl">Plantas avaliadas</div></div>
<div class="mk-k"><div class="mk-kv ${criticas ? "mk-da" : ""}">${criticas}</div><div class="mk-kl">Plantas críticas (abaixo de ${FAIXA.atencao})</div></div>
<div class="mk-k"><div class="mk-kv ${comPend ? "mk-wa" : ""}">${pts}</div><div class="mk-kl">Pontos descontados · ${comPend} planta${comPend === 1 ? "" : "s"} com pendência</div></div>
</div>`;
}

function blocoAtencao(itens) {
  if (!itens.length) return `<div class="mk-vazio"><div class="mk-dv">Nenhum ponto de atenção</div><div class="mk-nota">Todas as plantas avaliadas estão sem pendências nos módulos cruzados.</div></div>`;
  return `<div class="mk-qual"><h2 class="mk-h2">Pontos de atenção <span class="mk-mu">· ${itens.length}</span></h2><ul>${itens.map((h) => `<li>${h}</li>`).join("")}</ul></div>`;
}

const celulaIlum = (r) => (r.ilumDeficientes > 0 ? `<span class="mk-b mk-b-da">${r.ilumDeficientes} deficiente${r.ilumDeficientes === 1 ? "" : "s"}</span>` : r.ilumTotal > 0 ? '<span class="mk-sim">OK</span>' : '<span class="mk-nao">—</span>');
const celulaEnergia = (r) => (r.energiaAberta ? '<span class="mk-b mk-b-da">EM ABERTO</span>' : r.energiaQuedas7d > 0 ? `<span class="mk-b mk-b-wa">${r.energiaQuedas7d} queda${r.energiaQuedas7d === 1 ? "" : "s"} (7d)</span>` : r.energiaTemDados ? '<span class="mk-sim">OK</span>' : '<span class="mk-nao">—</span>');

function tabelaRanking(rows) {
  const linhas = rows.map((r, i) => {
    const fx = faixaDe(r.score);
    const pen = r.penalidades.length ? r.penalidades.map((p) => `<div>−${p.val} · ${e(p.label)}</div>`).join("") : '<span class="mk-sim">Sem penalidades</span>';
    return `<tr><td class="mk-num">${i + 1}º</td><td><span class="mk-dv">${e(r.id)}</span><div class="mk-mu mk-sm">${e(r.name)}</div></td><td class="mk-num"><b class="${COR_NUM[fx]}" style="font-size:12pt">${r.score}</b> <span class="mk-b mk-b-${fx}">${ROTULO_FAIXA[fx].toUpperCase()}</span></td><td class="mk-num">${r.semChecklist ? '<span class="mk-inv">sem relatório</span>' : `${r.base}%`}</td><td>${celulaIlum(r)}</td><td>${celulaEnergia(r)}</td><td class="mk-mu">${pen}</td></tr>`;
  }).join("");
  return `<section><h2 class="mk-h2">Ranking das plantas</h2><table class="mk-tb"><thead><tr><th class="mk-num" style="text-align:right">Pos.</th><th>Planta</th><th class="mk-num" style="text-align:right">Nota 360</th><th class="mk-num" style="text-align:right">Checklist</th><th>Iluminação</th><th>Energia</th><th>Penalidades aplicadas</th></tr></thead><tbody>${linhas}</tbody></table></section>`;
}

function legenda(cfg) {
  const c = cfg;
  return `<p class="mk-nota"><b>Como a nota é calculada:</b> parte do % do último checklist semanal e desconta as pendências ativas nos demais módulos — CTMK off-line (−${c.ctmkPorDia}/dia, máx. −${c.ctmkMax}) · falha KeyAccess aberta (−${c.keyAccess} cada, máx. −${c.keyAccessMax}) · placa crítica no bolsão (−${c.bolsaoCritico} cada, máx. −${c.bolsaoMax}) · zona perimetral com problema (−${c.perimetralZona} cada, máx. −${c.perimetralMax}) · Ronda VSPP abaixo de 90% (−${c.rondaMedia}) ou de 60% (−${c.rondaBaixa}). Faixas: ${FAIXA.bom}–100 bom · ${FAIXA.atencao}–${FAIXA.bom - 1} atenção · abaixo de ${FAIXA.atencao} crítico. Iluminação e energia aparecem como informação e não entram na nota.</p>`;
}

// rows: linhas da Visão 360 já ordenadas por nota (maior primeiro). grupoLabel: "Golgi" | "Mega" | "Klog" | null (interno).
export function gerarVisao360HTML({ rows, media, grupoLabel = null, cfg, hoje = new Date() }) {
  const numero = numero360(grupoLabel, hoje);
  const escopo = grupoLabel ? `Grupo ${grupoLabel}` : "Todas as plantas (uso interno Moked)";
  const hora = hoje.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const sub = `${e(escopo)} · saúde operacional consolidada: checklist, CTMK, KeyAccess, bolsão, perímetro, ronda VSPP, iluminação e energia · dados de ${hoje.toLocaleDateString("pt-BR")} ${hora}`;
  const pend = penalidadesPorTipo(rows);
  const corpo = !rows.length
    ? `<div class="mk-vazio"><div class="mk-dv">Nenhuma planta avaliada</div></div>`
    : `${kpis(rows, media)}${blocoAtencao(pontosDeAtencao(rows))}${tabelaRanking(rows)}${pend.length ? `<section class="mk-bloco"><h2 class="mk-h2">Onde a nota foi descontada <span class="mk-mu">· pontos por tipo de pendência</span></h2>${barrasMoked(pend, (v) => `−${v}`)}</section>` : ""}${legenda(cfg)}`;
  const unico = { id: grupoLabel ? `Grupo ${grupoLabel}` : "Todas as plantas", name: "" };
  return documentoMoked({ project: unico, titulo: "Visão 360", subtitulo: sub, numero, corpo, interno: !grupoLabel, hoje, empresaLogo: false, rodape: `${numero} · Visão 360 · ${unico.id} · Moked Consulting Security · MokLog CheckTest` });
}
