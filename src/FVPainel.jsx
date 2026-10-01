// ─────────────────────────────────────────────────────────────
// FVPainel.jsx — painel por projeto dentro da Gestão FV (v2).
// Saldo real: fv/{pid} (somente leitura).
// Plano: fv_plano/{pid} → creditoMensal, vtMensal, amMensal, recorrentes[], lancamentos[].
// Catálogo de preços: fv_plano/_catalogo → itens[{id,nome,valor}] (compartilhado).
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { getTheme } from "./generatePDF";
import { FV_CREDITO_MENSAL } from "./fvConfig";
import { LOGO_MOKED_30 } from "./fvLogo";
import {
  PLANO_TIPOS, PLANO_ROTULO, CATEGORIAS, serieMensal, saldoHistorico, projecao, totalReservas,
  resumoPeriodo, valorLanc, efeito, rotuloMes, mesDe, somaMes, novoIdPlano, recorrentesAtivos,
} from "./fvPlano";

const brl = n => (typeof n === "number" && Number.isFinite(n)) ? n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" }) : "—";
const brlK = n => (typeof n === "number" && Number.isFinite(n)) ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits:1 })}k` : "";
const parseBR = t => { if (t == null) return null; const s = String(t).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."); if (s === "" || s === "-") return null; const n = Number(s); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
const txtBR = n => String(n ?? "").replace(".", ",");

// ── Gráficos SVG ─────────────────────────────────────────────
export function svgBarras(serie, w = 340, h = 160) {
  const max = Math.max(1, ...serie.map(s => Math.max(s.creditos, s.debitos)));
  const pad = 24, bw = (w - pad) / serie.length, base = h - 20;
  const y = v => base - (v / max) * (h - 36);
  let out = `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">`;
  [0.5, 1].forEach(f => { out += `<line x1="${pad}" x2="${w}" y1="${y(max * f)}" y2="${y(max * f)}" stroke="#cbd5e1" stroke-width=".4" stroke-dasharray="2 3"/><text x="0" y="${y(max * f) + 3}" font-size="7" fill="#94a3b8">${brlK(max * f)}</text>`; });
  serie.forEach((s, i) => {
    const x = pad + i * bw, b = Math.max(2, bw / 2 - 2);
    out += `<rect x="${x + 1}" y="${y(s.creditos)}" width="${b}" height="${base - y(s.creditos)}" fill="#22c55e" rx="1"/>`;
    out += `<rect x="${x + 1 + b}" y="${y(s.debitos)}" width="${b}" height="${base - y(s.debitos)}" fill="#ef4444" rx="1"/>`;
    out += `<text x="${x + bw / 2}" y="${h - 6}" font-size="7.5" fill="#64748b" text-anchor="middle">${rotuloMes(s.mes).slice(0, 3)}</text>`;
  });
  return out + "</svg>";
}
export function svgLinha(real, proj, w = 340, h = 170) {
  const pts = [...real, ...proj].filter(p => typeof p.saldo === "number");
  if (!pts.length) return "";
  const vals = pts.map(p => p.saldo);
  const min = Math.min(0, ...vals), max = Math.max(1, ...vals);
  const n = real.length + proj.length, pad = 28, top = 10, bottom = 26;
  const x = i => pad + (i / Math.max(1, n - 1)) * (w - pad - 8);
  const y = v => top + (1 - (v - min) / (max - min || 1)) * (h - top - bottom);
  const path = (arr, off) => arr.map((p, i) => typeof p.saldo === "number" ? `${i === 0 ? "M" : "L"}${x(i + off).toFixed(1)},${y(p.saldo).toFixed(1)}` : "").join(" ");
  const ultimo = real.length - 1;
  const projComPonte = real.length ? [real[ultimo], ...proj] : proj;
  let out = `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">`;
  if (min < 0) out += `<line x1="${pad}" x2="${w}" y1="${y(0)}" y2="${y(0)}" stroke="#ef4444" stroke-width=".7" stroke-dasharray="3 3"/>`;
  out += `<line x1="${x(ultimo)}" x2="${x(ultimo)}" y1="${top}" y2="${h - bottom}" stroke="#cbd5e1" stroke-width=".6" stroke-dasharray="2 2"/>`;
  out += `<text x="0" y="${top + 4}" font-size="7" fill="#94a3b8">${brlK(max)}</text><text x="0" y="${h - bottom}" font-size="7" fill="#94a3b8">${brlK(min)}</text>`;
  out += `<path d="${path(real, 0)}" fill="none" stroke="#0ea5e9" stroke-width="2"/>`;
  out += `<path d="${path(projComPonte, real.length ? ultimo : 0)}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="5 4"/>`;
  // marcadores de eventos planejados
  proj.forEach((p, i) => {
    if (!p.eventos || !p.eventos.length) return;
    const px = x(real.length + i), py = y(p.saldo);
    out += `<circle cx="${px}" cy="${py}" r="3" fill="${p.extra < 0 ? "#ef4444" : "#22c55e"}"/>`;
    const ly = (i % 2 === 0) ? py - 7 : py + 11; // alterna acima/abaixo para não sobrepor meses vizinhos
    const anc = px > w - 40 ? "end" : "middle";
    out += `<text x="${px}" y="${ly}" font-size="6.5" fill="#475569" text-anchor="${anc}">${esc(p.eventos[0].descricao).slice(0, 16)}${p.eventos.length > 1 ? " +" + (p.eventos.length - 1) : ""}</text>`;
  });
  // valores inicial e final
  if (real.length && typeof real[0].saldo === "number") out += `<text x="${x(0)}" y="${y(real[0].saldo) + 11}" font-size="7" fill="#0ea5e9">${brlK(real[0].saldo)}</text>`;
  if (real.length && typeof real[ultimo].saldo === "number") out += `<text x="${x(ultimo)}" y="${y(real[ultimo].saldo) - 5}" font-size="7" fill="#0ea5e9" text-anchor="middle">${brlK(real[ultimo].saldo)}</text>`;
  if (proj.length) out += `<text x="${x(n - 1)}" y="${y(proj[proj.length - 1].saldo) - 5}" font-size="7" fill="#475569" text-anchor="end">${brlK(proj[proj.length - 1].saldo)}</text>`;
  [0, ultimo, n - 1].forEach(i => {
    const mes = i < real.length ? real[i]?.mes : proj[i - real.length]?.mes;
    if (mes) out += `<text x="${x(i)}" y="${h - 6}" font-size="7.5" fill="#64748b" text-anchor="${i === n - 1 ? "end" : i === 0 ? "start" : "middle"}">${rotuloMes(mes)}</text>`;
  });
  return out + "</svg>";
}

// ── PDF do projeto ───────────────────────────────────────────
export function gerarPDFProjetoFV({ pid, nome, resumo, real, serie, proj, plano, ctx, reservas, periodo }) {
  const theme = getTheme(pid) || {};
  const cor = theme.headerBg || "#B21E27";
  const P = proj.parametros, T = proj.totais;
  const lancs = ((plano && plano.lancamentos) || []);
  const recs = recorrentesAtivos(plano);
  const saldo = resumo?.saldoAtual;
  const disponivel = typeof saldo === "number" ? Math.round((saldo - reservas) * 100) / 100 : null;
  const sinal = v => `<span style="color:${v < 0 ? "#dc2626" : "#15803d"}">${brl(v)}</span>`;
  const detalheLanc = l => l.vinculo === "cestaNatal" ? ` (${ctx.qtdCestas} × ${brl(Number(l.valorMedio) || 0)})` : l.vinculo === "catalogo" ? ` (${l.qtd} × ${brl(valorLanc({ ...l, qtd:1 }, ctx))})` : "";
  const kpi = (r, v, sub = "", cls = "") => `<td class="${cls}"><div class="kr">${r}</div><div class="kv">${v}</div>${sub ? `<div class="ks2">${sub}</div>` : ""}</td>`;

  const tabCat = Object.entries(periodo.porCategoria).map(([k, v]) => `<tr><td>${CATEGORIAS[k]}</td><td class="r">${brl(v)}</td><td class="r">${periodo.debitos ? Math.round(v / periodo.debitos * 100) : 0}%</td></tr>`).join("");
  const tabMaiores = periodo.maiores.map(m => `<tr><td>${esc(m.descricao || "—")}</td><td>${m.data ? rotuloMes(String(m.data).slice(0, 7)) : "—"}</td><td class="r">${brl(m.valor)}</td></tr>`).join("");
  const tabFixos = [["Vale-transporte", P.vt], ["Assistência médica", P.am], ...recs.map(x => [x.descricao, x.valor])].map(([d, v]) => `<tr><td>${esc(d)}</td><td class="r">${brl(v)}</td><td class="r">${brl(v * 12)}</td></tr>`).join("");
  const tabPlano = lancs.length ? lancs.map(l => `<tr><td>${esc(PLANO_ROTULO[l.tipo] || l.tipo)}</td><td>${esc(l.descricao || "")}${detalheLanc(l)}</td><td>${l.mes ? rotuloMes(l.mes) : "—"}</td><td class="r">${sinal(efeito(l, ctx))}</td><td>${l.realizado ? "Realizado" : "Previsto"}</td></tr>`).join("") : `<tr><td colspan="5" style="color:#64748b">Nenhum lançamento de planejamento cadastrado.</td></tr>`;
  const tabProj = proj.serie.map(p => `<tr><td>${rotuloMes(p.mes)}</td><td class="r" style="color:#15803d">${brl(P.creditoMensal)}</td><td class="r" style="color:#dc2626">${brl(P.fixos)}</td><td class="r">${p.extra ? sinal(p.extra) : "—"}</td><td style="color:#475569;font-size:10px">${p.eventos.map(e => esc(e.descricao)).join(", ") || ""}</td><td class="r" style="font-weight:700;color:${p.saldo < 0 ? "#dc2626" : "#111"}">${brl(p.saldo)}</td></tr>`).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gestão FV ${esc(pid)}</title>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;color:#111;margin:0;padding:24px;max-width:840px;margin:auto;font-size:12px}
.hd{display:table;width:100%;border-bottom:3px solid ${cor};padding-bottom:10px;margin-bottom:10px}
.hd>div{display:table-cell;vertical-align:middle}
h1{font-size:19px;margin:0;color:${cor}}h2{font-size:13px;margin:16px 0 6px;color:${cor};border-left:4px solid ${cor};padding-left:8px}
.intro{font-size:11px;color:#475569;margin:0 0 12px;line-height:1.45}
.ks{width:100%;border-collapse:separate;border-spacing:6px 0;margin:0 -6px}.ks td{width:25%;vertical-align:top;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;background:#f8fafc}
.ks td.hi{background:${cor};border-color:${cor}}.ks td.hi .kr,.ks td.hi .kv,.ks td.hi .ks2{color:#fff}
.kr{font-size:9.5px;color:#64748b;text-transform:uppercase;letter-spacing:.3px}.kv{font-size:16px;font-weight:700;margin-top:2px}.ks2{font-size:9.5px;color:#64748b;margin-top:2px}
table.t{width:100%;border-collapse:collapse;font-size:11px}table.t th,table.t td{padding:5px 7px;border-bottom:1px solid #e5e7eb;text-align:left}table.t th{background:${cor};color:#fff;font-weight:600}
.r{text-align:right}.two{display:table;width:100%;border-spacing:10px 0;margin:0 -10px}.two>div{display:table-cell;width:50%;vertical-align:top}
.leg{font-size:10px;color:#64748b;margin:2px 0 4px}.leg b{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:middle}
.note{font-size:10.5px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:7px 10px;margin-top:6px}
.alert{color:#dc2626;font-weight:700;font-size:12px;margin:8px 0 0}
.bl{page-break-inside:avoid}.ft{margin-top:16px;font-size:9.5px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px;line-height:1.5}
thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4;margin:12mm}@media print{body{padding:0}.print-tools{display:none}}
</style></head><body>
<div class="print-tools" style="padding:12px;background:#f1f5f9;margin-bottom:12px"><button onclick="window.print()">Imprimir / Salvar como PDF</button> Selecione “Salvar como PDF” na janela de impressão.</div>
<div class="hd"><div style="width:230px"><img src="${LOGO_MOKED_30}" alt="Moked Security Consulting" style="width:220px"/></div>
<div style="text-align:right"><h1>Gestão FV · ${esc(pid)} ${esc(nome)}</h1>
<div style="font-size:10px;color:#64748b;margin-top:3px">Emissão ${new Date().toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" })} · FV atualizado em ${resumo?.sincronizadoEm ? new Date(resumo.sincronizadoEm).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" }) : "—"}</div></div></div>

<p class="intro">Este relatório consolida o <b>Fundo Variável (FV)</b> do projeto: o saldo atual registrado na plataforma Gestão FV, o comportamento dos últimos 12 meses (créditos recebidos e débitos realizados), os gastos fixos e os lançamentos de planejamento cadastrados pela gerência, e a <b>projeção para os próximos 12 meses</b>. O saldo real nunca é editado neste documento; a projeção é uma estimativa de planejamento interno.</p>

<div class="bl"><h2>1. Situação atual</h2>
<table class="ks"><tr>
${kpi("Saldo atual do FV", brl(saldo), "fonte: Gestão FV", "hi")}
${kpi("Reservas comprometidas", brl(reservas), reservas > 0 ? "disponível: " + brl(disponivel) : "nenhuma reserva cadastrada")}
${kpi("Saldo projetado em " + rotuloMes(proj.serie[proj.serie.length - 1].mes), brl(proj.saldoFinal), (proj.saldoFinal - (saldo || 0) >= 0 ? "+" : "") + brl(proj.saldoFinal - (saldo || 0)) + " em 12 meses")}
${kpi("Gastos previstos 12 meses", brl(T.gastos), "fixos " + brl(T.gastosFixos) + " · planejados " + brl(T.previstosSaida))}
</tr></table>
${proj.primeiroNegativo ? `<p class="alert">⚠ Atenção: pela projeção, o FV fica negativo em ${rotuloMes(proj.primeiroNegativo)}.</p>` : ""}
</div>

<div class="bl"><h2>2. Base mensal da projeção</h2>
<div class="two"><div>
<table class="t"><thead><tr><th>Entrada mensal</th><th class="r">Mês</th><th class="r">12 meses</th></tr></thead>
<tbody><tr><td>Crédito do FV${P.creditoOficial && !P.creditoManual ? " (valor oficial)" : P.creditoManual ? " (ajustado)" : " (média)"}</td><td class="r" style="color:#15803d">${brl(P.creditoMensal)}</td><td class="r">${brl(P.creditoMensal * 12)}</td></tr></tbody></table>
<div class="note"><b>Margem mensal: ${brl(P.margem)}</b> = crédito ${brl(P.creditoMensal)} − gastos fixos ${brl(P.fixos)}</div>
</div><div>
<table class="t"><thead><tr><th>Gastos fixos mensais</th><th class="r">Mês</th><th class="r">12 meses</th></tr></thead>
<tbody>${tabFixos}<tr><td><b>Total fixo</b></td><td class="r"><b>${brl(P.fixos)}</b></td><td class="r"><b>${brl(P.fixos * 12)}</b></td></tr></tbody></table>
</div></div>
</div>

<div class="bl"><h2>3. Últimos 12 meses — o que entrou e o que saiu</h2>
<div class="leg"><b style="background:#22c55e"></b>Créditos ${brl(periodo.creditos)} &nbsp; <b style="background:#ef4444"></b>Débitos ${brl(periodo.debitos)} &nbsp; · Resultado do período: <span style="color:${periodo.resultado < 0 ? "#dc2626" : "#15803d"};font-weight:700">${brl(periodo.resultado)}</span></div>
${svgBarras(serie, 760, 170)}
<div class="two"><div>
<table class="t"><thead><tr><th>Débitos por categoria</th><th class="r">Valor</th><th class="r">%</th></tr></thead><tbody>${tabCat}</tbody></table>
</div><div>
<table class="t"><thead><tr><th>Maiores débitos avulsos</th><th>Mês</th><th class="r">Valor</th></tr></thead><tbody>${tabMaiores || `<tr><td colspan="3" style="color:#64748b">Nenhum débito avulso no período.</td></tr>`}</tbody></table>
</div></div>
</div>

<div class="bl"><h2>4. Evolução do saldo — real e projeção</h2>
<div class="leg"><b style="background:#0ea5e9"></b>Saldo real (12 meses) &nbsp; <b style="background:#94a3b8"></b>Projeção (12 meses) &nbsp; <b style="background:#ef4444"></b>Evento planejado</div>
${svgLinha(real, proj.serie, 760, 190)}
<div class="note">Projeção: saldo atual ${brl(saldo)} + 12 × margem ${brl(P.margem)} = ${brl((saldo || 0) + P.margem * 12)}${T.previstosSaida || T.previstosEntrada ? `; com os lançamentos planejados (−${brl(T.previstosSaida)} / +${brl(T.previstosEntrada)}) → <b>${brl(proj.saldoFinal)}</b>` : ` → <b>${brl(proj.saldoFinal)}</b>`}.</div>
</div>

<div class="bl"><h2>5. Lançamentos de planejamento</h2>
<table class="t"><thead><tr><th>Tipo</th><th>Descrição</th><th>Mês</th><th class="r">Efeito</th><th>Situação</th></tr></thead><tbody>${tabPlano}</tbody></table>
</div>

<div class="bl"><h2>6. Projeção mês a mês</h2>
<table class="t"><thead><tr><th>Mês</th><th class="r">Crédito</th><th class="r">Fixos</th><th class="r">Planejado</th><th>Eventos</th><th class="r">Saldo projetado</th></tr></thead><tbody>${tabProj}</tbody></table>
</div>

<div class="ft"><b>Como ler.</b> Saldo atual: valor registrado na plataforma Gestão FV (somente leitura). Reservas: valores separados para compromissos futuros (ex.: Cesta de Natal), descontados do disponível. Gastos fixos: VT, assistência médica e despesas recorrentes cadastradas. Lançamentos de planejamento: previsões da gerência; ao serem efetivados no FV, são marcados como "Realizado" e deixam de contar. Projeção: estimativa interna, não substitui o extrato oficial.<br/>MOKED Security Consulting · Fundada em 1995 · Documento de planejamento interno.</div>
</body></html>`;
  const report = window.open("", "_blank");
  if (report) { report.document.open(); report.document.write(html); report.document.close(); return; }
  // Se o navegador bloquear a aba, preserve o relatório completo para abrir e imprimir.
  const blob = new Blob([html], { type:"text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `GestaoFV_${pid}_${mesDe(new Date())}.html`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ── Subcomponentes (fora do principal para não remontar inputs) ───────
function Campo({ c, ...p }) {
  return <input {...p} style={{ width:"100%", boxSizing:"border-box", padding:"8px 10px", borderRadius:8, fontSize:13, background:c.in, color:c.txt, border:`1px solid ${c.bd}`, ...(p.style || {}) }}/>;
}
function Botao({ c, cor, solid, children, ...p }) {
  return <button {...p} style={{ background:solid ? (cor || "#0ea5e9") : "transparent", border:`1px solid ${solid ? "transparent" : (cor ? cor + "66" : c.bd)}`, color:solid ? "#fff" : (cor || c.txt2), borderRadius:8, padding:"6px 10px", fontSize:11.5, fontWeight:700, cursor:p.disabled ? "default" : "pointer", opacity:p.disabled ? .5 : 1, ...(p.style || {}) }}>{children}</button>;
}

// Linha editável de valor mensal (crédito, VT, AM).
function LinhaParam({ c, rot, sub, valor, manual, onSalvar, podeEditar }) {
  const [edit, setEdit] = useState(false); const [txt, setTxt] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, padding:"7px 0", borderTop:`1px solid ${c.bd}` }}>
      <div><div style={{ fontSize:12, color:c.txt }}>{rot}</div><div style={{ fontSize:10, color:c.txt2 }}>{sub}</div></div>
      {edit ? (
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          <Campo c={c} autoFocus inputMode="decimal" value={txt} onChange={e => setTxt(e.target.value)} style={{ width:110 }}/>
          <Botao c={c} disabled={busy} onClick={async () => { setBusy(true); const n = txt.trim() === "" ? null : parseBR(txt); if (txt.trim() !== "" && n === null) { setBusy(false); return; } if (await onSalvar(n)) setEdit(false); setBusy(false); }}>OK</Botao>
          <Botao c={c} onClick={() => setEdit(false)}>✕</Botao>
        </div>
      ) : (
        <Botao c={c} disabled={!podeEditar} onClick={() => { setTxt(manual ? txtBR(valor) : ""); setEdit(true); }} style={{ color:c.txt, fontSize:13 }}>{brl(valor)} ✏️</Botao>
      )}
    </div>
  );
}

// Formulário de recorrente (café, água, internet…).
function FormRecorrente({ c, inicial, onSalvar, onCancelar, onExcluir }) {
  const [id] = useState(() => inicial?.id || novoIdPlano("rc"));
  const [d, setD] = useState(inicial?.descricao || ""); const [v, setV] = useState(inicial ? txtBR(inicial.valor) : ""); const [busy, setBusy] = useState(false);
  return (
    <div style={{ display:"flex", gap:6, alignItems:"center", padding:"6px 0", flexWrap:"wrap" }}>
      <Campo c={c} placeholder="Descrição (ex.: Café)" value={d} onChange={e => setD(e.target.value)} style={{ flex:2, minWidth:120 }}/>
      <Campo c={c} inputMode="decimal" placeholder="Valor/mês" value={v} onChange={e => setV(e.target.value)} style={{ flex:1, minWidth:90 }}/>
      <Botao c={c} solid cor="#16a34a" disabled={busy} onClick={async () => { const n = parseBR(v); if (!d.trim() || n === null) return; setBusy(true); await onSalvar({ id, descricao:d.trim(), valor:n }); setBusy(false); }}>Salvar</Botao>
      {onExcluir && <Botao c={c} cor="#ef4444" disabled={busy} onClick={onExcluir}>Excluir</Botao>}
      <Botao c={c} onClick={onCancelar}>✕</Botao>
    </div>
  );
}

// Formulário de item do catálogo.
function FormItem({ c, inicial, onSalvar, onCancelar, onExcluir }) {
  const [id] = useState(() => inicial?.id || novoIdPlano("it"));
  const [d, setD] = useState(inicial?.nome || ""); const [v, setV] = useState(inicial ? txtBR(inicial.valor) : ""); const [busy, setBusy] = useState(false);
  return (
    <div style={{ display:"flex", gap:6, alignItems:"center", padding:"6px 0", flexWrap:"wrap" }}>
      <Campo c={c} placeholder="Item (ex.: Camisa)" value={d} onChange={e => setD(e.target.value)} style={{ flex:2, minWidth:120 }}/>
      <Campo c={c} inputMode="decimal" placeholder="Preço unitário" value={v} onChange={e => setV(e.target.value)} style={{ flex:1, minWidth:90 }}/>
      <Botao c={c} solid cor="#16a34a" disabled={busy} onClick={async () => { const n = parseBR(v); if (!d.trim() || n === null) return; setBusy(true); await onSalvar({ id, nome:d.trim(), valor:n }); setBusy(false); }}>Salvar</Botao>
      {onExcluir && <Botao c={c} cor="#ef4444" disabled={busy} onClick={onExcluir}>Excluir</Botao>}
      <Botao c={c} onClick={onCancelar}>✕</Botao>
    </div>
  );
}

// Formulário de lançamento de planejamento.
function FormLancamento({ c, inicial, catalogo, qtdCestas, onSalvar, onCancelar, onExcluir }) {
  const proxMes = somaMes(mesDe(new Date()), 1);
  const modoIni = inicial?.vinculo === "cestaNatal" ? "cesta" : inicial?.vinculo === "catalogo" ? "catalogo" : "valor";
  const [f, setF] = useState({
    tipo: inicial?.tipo || "reserva", descricao: inicial?.descricao || "", mes: inicial?.mes || proxMes, sinal: inicial?.sinal || "-",
    realizado: !!inicial?.realizado, modo: modoIni,
    valorTxt: inicial ? txtBR(modoIni === "cesta" ? inicial.valorMedio : inicial.valor) : "",
    itemId: inicial?.itemId || (catalogo[0]?.id || ""), qtd: inicial?.qtd || 1,
  });
  const [erro, setErro] = useState(""); const [busy, setBusy] = useState(false);
  const [idLanc] = useState(() => inicial?.id || novoIdPlano());
  const up = p => setF(x => ({ ...x, ...p }));
  const item = catalogo.find(i => i.id === f.itemId);
  const previa = f.modo === "catalogo" ? (item ? item.valor * (Number(f.qtd) || 0) : 0) : f.modo === "cesta" ? (parseBR(f.valorTxt) || 0) * qtdCestas : (parseBR(f.valorTxt) || 0);
  const salvar = async () => {
    const reg = { id: idLanc, tipo: f.tipo, descricao: f.descricao.trim(), mes: f.mes, realizado: f.realizado };
    if (f.tipo === "outros") reg.sinal = f.sinal;
    if (f.modo === "cesta") { const n = parseBR(f.valorTxt); if (n === null) return setErro("Informe o valor médio por cesta."); reg.vinculo = "cestaNatal"; reg.valorMedio = n; }
    else if (f.modo === "catalogo") { if (!item) return setErro("Escolha um item do catálogo."); const q = Number(f.qtd); if (!Number.isSafeInteger(q) || q < 1) return setErro("Informe uma quantidade inteira positiva."); reg.vinculo = "catalogo"; reg.itemId = item.id; reg.qtd = q; if (!reg.descricao) reg.descricao = `${q} × ${item.nome}`; }
    else { const n = parseBR(f.valorTxt); if (n === null) return setErro("Informe o valor."); reg.valor = n; }
    if (!reg.descricao) return setErro("Informe a descrição.");
    if (!/^\d{4}-\d{2}$/.test(reg.mes)) return setErro("Informe o mês.");
    setBusy(true); setErro(""); await onSalvar(reg); setBusy(false);
  };
  const seg = (lista, val, set) => (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
      {lista.map(([k, r]) => <Botao key={k} c={c} solid={val === k} onClick={() => set(k)}>{r}</Botao>)}
    </div>
  );
  return (
    <div style={{ background:c.card, border:"1px solid #0ea5e966", borderRadius:12, padding:"12px 14px" }}>
      <div style={{ fontSize:12.5, fontWeight:700, color:c.txt, marginBottom:8 }}>{inicial ? "Editar lançamento" : "Novo lançamento de planejamento"}</div>
      {seg(PLANO_TIPOS.map(t => [t, PLANO_ROTULO[t]]), f.tipo, k => up({ tipo:k }))}
      {seg([["valor", "Valor direto"], ["catalogo", "Item do catálogo × qtd"], ["cesta", "Cesta de Natal × equipe"]], f.modo, k => up({ modo:k }))}
      <Campo c={c} placeholder="Descrição (ex.: Treinamento, Ovo de Páscoa)" value={f.descricao} onChange={e => up({ descricao:e.target.value })} style={{ marginBottom:6 }}/>
      {f.modo === "catalogo" && (
        <div style={{ display:"flex", gap:6, marginBottom:6 }}>
          <select value={f.itemId} onChange={e => up({ itemId:e.target.value })} style={{ flex:2, padding:"8px 10px", borderRadius:8, background:c.in, color:c.txt, border:`1px solid ${c.bd}` }}>
            {catalogo.length === 0 && <option value="">Catálogo vazio — cadastre itens acima</option>}
            {catalogo.map(i => <option key={i.id} value={i.id}>{i.nome} · {brl(i.valor)}</option>)}
          </select>
          <Campo c={c} type="number" min="1" value={f.qtd} onChange={e => up({ qtd:e.target.value })} style={{ width:80 }}/>
        </div>
      )}
      {f.modo !== "catalogo" && (
        <Campo c={c} inputMode="decimal" placeholder={f.modo === "cesta" ? "Valor médio por cesta" : "Valor"} value={f.valorTxt} onChange={e => up({ valorTxt:e.target.value })} style={{ marginBottom:6 }}/>
      )}
      <div style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
        <input type="month" value={f.mes} onChange={e => up({ mes:e.target.value })} style={{ flex:1, padding:"8px 10px", borderRadius:8, background:c.in, color:c.txt, border:`1px solid ${c.bd}` }}/>
        <div style={{ fontSize:12, color:c.txt2 }}>Total: <b style={{ color:c.txt }}>{brl(previa)}</b></div>
      </div>
      {f.modo === "cesta" && <div style={{ fontSize:11, color:c.txt2, marginBottom:6 }}>{qtdCestas} cesta(s) marcadas na Equipe × valor médio. Atualiza sozinho.</div>}
      {f.tipo === "outros" && seg([["-", "Saída (−)"], ["+", "Entrada (+)"]], f.sinal, k => up({ sinal:k }))}
      <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11.5, color:c.txt2, marginBottom:8 }}>
        <input type="checkbox" checked={f.realizado} onChange={e => up({ realizado:e.target.checked })}/> Realizado (já consta no FV — sai da projeção e das reservas)
      </label>
      {erro && <div style={{ fontSize:11.5, color:"#ef4444", marginBottom:6 }}>{erro}</div>}
      <div style={{ display:"flex", gap:6 }}>
        {onExcluir && <Botao c={c} cor="#ef4444" disabled={busy} onClick={onExcluir}>Excluir</Botao>}
        <Botao c={c} onClick={onCancelar} style={{ flex:1 }}>Cancelar</Botao>
        <Botao c={c} solid cor="#16a34a" disabled={busy} onClick={salvar} style={{ flex:1 }}>{busy ? "Salvando..." : "Salvar"}</Botao>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────
export default function FVPainel({ pid, nome, resumo, lancamentos, pin, dark = true, podeEditar = true }) {
  const c = dark ? { card:"#060c18", bd:"#0f172a", txt:"#e8ecf5", txt2:"#94a3b8", in:"#020510" } : { card:"#fff", bd:"#e2e8f0", txt:"#0f172a", txt2:"#64748b", in:"#fff" };
  const card = { background:c.card, border:`1px solid ${c.bd}`, borderRadius:12, padding:"12px 14px" };
  const titulo = (t, extra) => <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}><div style={{ fontSize:12.5, fontWeight:700, color:c.txt }}>{t}</div>{extra}</div>;

  const [plano, setPlano] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [qtdCestas, setQtdCestas] = useState(0);
  const [formLanc, setFormLanc] = useState(null);     // null | {} novo | lançamento
  const [formRec, setFormRec] = useState(null);        // null | {} | recorrente
  const [formItem, setFormItem] = useState(null);      // null | {} | item
  const [mostraCat, setMostraCat] = useState(false);
  const [erro, setErro] = useState("");
  const anoAtual = new Date().getFullYear();

  const requisitar = async operacao => {
    const response = await fetch("/api/fv-plano", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({pin,pid,...operacao}) });
    let data; try { data = await response.json(); } catch { throw new Error("Servidor não retornou o planejamento. Tente novamente."); }
    if (!response.ok || !data.ok) throw new Error(data.erro || "Não foi possível salvar o planejamento.");
    return data;
  };

  useEffect(() => {
    let vivo = true;
    setPlano(null); setCatalogo(null); setErro("");
    requisitar({acao:"ler"}).then(data => { if(vivo) {setPlano(data.plano);setCatalogo(data.catalogo);setQtdCestas(data.qtdCestas);} }).catch(e => vivo && setErro(e.message || "Falha ao carregar planejamento."));
    return () => { vivo = false; };
  }, [pid, pin]);

  const msgErro = e => e.message || "Não foi possível salvar. Tente novamente.";
  // Releitura + alteração + gravação (plano do projeto).
  const gravarPlano = async (mutar) => {
    setErro("");
    try {
      const base = plano;
      const novo = mutar({ ...base, lancamentos:[...(base.lancamentos || [])], recorrentes:[...(base.recorrentes || [])] });
      let op;
      for (const campo of ["creditoMensal","vtMensal","amMensal"]) if(novo[campo] !== base[campo]) op = {acao:"parametro",campo,valor:novo[campo]};
      for (const [field,save,del] of [["lancamentos","salvar","excluir"],["recorrentes","recorrente_salvar","recorrente_excluir"]]) {
        const old = base[field] || [], next = novo[field] || [];
        const changed = next.find(x => JSON.stringify(x) !== JSON.stringify(old.find(y=>y.id===x.id)));
        const removed = old.find(x=>!next.some(y=>y.id===x.id));
        if(changed) op = {acao:save,[field === "lancamentos" ? "lancamento" : "item"]:changed};
        else if(removed) op = {acao:del,id:removed.id};
      }
      if(!op) return true;
      const data = await requisitar(op); setPlano(data.plano); return true;
    } catch (e) { console.error("fv_plano:", e); setErro(msgErro(e)); return false; }
  };
  const gravarCatalogo = async (mutar) => {
    setErro("");
    try {
      const itens = mutar([...catalogo]);
      const item = itens.find(x=>JSON.stringify(x)!==JSON.stringify(catalogo.find(y=>y.id===x.id)));
      const removed = catalogo.find(x=>!itens.some(y=>y.id===x.id));
      if(!item && !removed) return true;
      const data = await requisitar(item ? {acao:"catalogo_salvar",item} : {acao:"catalogo_excluir",id:removed.id});setCatalogo(data.catalogo);return true;
    } catch (e) { console.error("fv_plano/_catalogo:", e); setErro(msgErro(e)); return false; }
  };

  if (!plano || !catalogo) return <div style={{ fontSize:12, color:erro ? "#ef4444" : c.txt2 }}>{erro || "Carregando painel..."}{erro && <button onClick={()=>window.location.reload()}>Tentar novamente</button>}</div>;

  const ctx = { qtdCestas, catalogo };
  const L = lancamentos || [];
  const serie = serieMensal(L, 12), real = saldoHistorico(resumo?.saldoAtual, serie);
  const proj = projecao({ saldoAtual:resumo?.saldoAtual, plano, lancamentos:L, ctx, creditoOficial:FV_CREDITO_MENSAL[pid] ?? null });
  const periodo = resumoPeriodo(L, 12);
  const reservas = totalReservas(plano, ctx);
  const saldo = resumo?.saldoAtual;
  const disponivel = typeof saldo === "number" ? Math.round((saldo - reservas) * 100) / 100 : null;
  const P = proj.parametros, T = proj.totais;
  const corV = v => typeof v !== "number" ? c.txt2 : v < 0 ? "#ef4444" : "#22c55e";
  const kpi = (r, v, cor, sub) => <div style={{ ...card, padding:"10px 12px" }}><div style={{ fontSize:10, color:c.txt2, textTransform:"uppercase", letterSpacing:.3 }}>{r}</div><div style={{ fontSize:16, fontWeight:800, color:cor || c.txt }}>{v}</div>{sub && <div style={{ fontSize:10, color:c.txt2 }}>{sub}</div>}</div>;
  const recs = (plano.recorrentes || []);
  const temCesta = (plano.lancamentos || []).some(l => l.vinculo === "cestaNatal");
  const salvarLanc = async reg => { if (await gravarPlano(b => { const i = b.lancamentos.findIndex(l => l.id === reg.id); if (i >= 0) b.lancamentos[i] = reg; else b.lancamentos.push(reg); return b; })) setFormLanc(null); };
  const excluirLanc = async id => { if (window.confirm("Excluir este lançamento?") && await gravarPlano(b => ({ ...b, lancamentos:b.lancamentos.filter(l => l.id !== id) }))) setFormLanc(null); };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {/* 1. Situação */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {kpi("Saldo atual do FV", brl(saldo), corV(saldo), "fonte: Gestão FV")}
        {kpi("Reservas", brl(reservas), null, reservas > 0 ? `disponível ${brl(disponivel)}` : "nenhuma reserva")}
        {kpi(`Projetado ${rotuloMes(proj.serie[11].mes)}`, brl(proj.saldoFinal), corV(proj.saldoFinal), `${proj.saldoFinal - (saldo || 0) >= 0 ? "+" : ""}${brl(proj.saldoFinal - (saldo || 0))} em 12 meses`)}
        {kpi("Gastos previstos 12m", brl(T.gastos), "#ef4444", `fixos ${brl(T.gastosFixos)} · planejados ${brl(T.previstosSaida)}`)}
      </div>
      {proj.primeiroNegativo && <div style={{ fontSize:12, color:"#ef4444", fontWeight:700 }}>⚠️ Pela projeção, o FV fica negativo em {rotuloMes(proj.primeiroNegativo)}.</div>}

      {/* 2. Base mensal */}
      <div style={card}>
        {titulo("Base mensal da projeção")}
        <LinhaParam c={c} podeEditar={podeEditar} rot="Crédito do FV" sub={P.creditoManual ? `ajustado · referência ${brl(P.auto.credito)}` : P.creditoOficial ? "valor oficial do projeto" : "média dos últimos 3 meses"} valor={P.creditoMensal} manual={P.creditoManual} onSalvar={n => gravarPlano(b => ({ ...b, creditoMensal:n }))}/>
        <LinhaParam c={c} podeEditar={podeEditar} rot="Vale-transporte (fixo)" sub={P.vtManual ? `ajustado · média ${brl(P.auto.vt)}` : "média dos últimos 3 meses"} valor={P.vt} manual={P.vtManual} onSalvar={n => gravarPlano(b => ({ ...b, vtMensal:n }))}/>
        <LinhaParam c={c} podeEditar={podeEditar} rot="Assistência médica (fixo)" sub={P.amManual ? `ajustado · média ${brl(P.auto.am)}` : "média dos últimos 3 meses"} valor={P.am} manual={P.amManual} onSalvar={n => gravarPlano(b => ({ ...b, amMensal:n }))}/>
        <div style={{ borderTop:`1px solid ${c.bd}`, paddingTop:7 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:12, color:c.txt }}>Despesas recorrentes <span style={{ fontSize:10, color:c.txt2 }}>(café, água, internet…)</span></div>
            {podeEditar && !formRec && <Botao c={c} cor="#0ea5e9" onClick={() => setFormRec({})}>+ Recorrente</Botao>}
          </div>
          {recs.map(r => formRec && formRec.id === r.id
            ? <FormRecorrente key={r.id} c={c} inicial={r} onCancelar={() => setFormRec(null)} onSalvar={async d => { if (await gravarPlano(b => ({ ...b, recorrentes:b.recorrentes.map(x => x.id === r.id ? { ...x, ...d } : x) }))) setFormRec(null); }} onExcluir={async () => { if (await gravarPlano(b => ({ ...b, recorrentes:b.recorrentes.filter(x => x.id !== r.id) }))) setFormRec(null); }}/>
            : <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", opacity:r.ativo === false ? .5 : 1 }}>
                <span style={{ fontSize:12, color:c.txt2 }}>{r.descricao}</span>
                <span style={{ display:"flex", gap:6, alignItems:"center" }}><span style={{ fontSize:12, color:c.txt }}>{brl(r.valor)}/mês</span>{podeEditar && <Botao c={c} onClick={() => setFormRec(r)} style={{ padding:"3px 7px" }}>✏️</Botao>}</span>
              </div>)}
          {formRec && !formRec.id && <FormRecorrente c={c} onCancelar={() => setFormRec(null)} onSalvar={async d => { if (await gravarPlano(b => ({ ...b, recorrentes:[...b.recorrentes, { id:novoIdPlano("rc"), ativo:true, ...d }] }))) setFormRec(null); }}/>}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", borderTop:`1px solid ${c.bd}`, paddingTop:7, marginTop:4 }}>
          <span style={{ fontSize:12, color:c.txt2 }}>Gastos fixos {brl(P.fixos)} → <b>Margem mensal</b></span>
          <span style={{ fontSize:14, fontWeight:800, color:corV(P.margem) }}>{brl(P.margem)}</span>
        </div>
        <div style={{ fontSize:10, color:c.txt2, marginTop:4 }}>Para voltar ao automático, salve o campo vazio.</div>
      </div>

      {/* 3. Catálogo de preços */}
      <div style={card}>
        {titulo(`Catálogo de preços unitários (${catalogo.length})`, <Botao c={c} onClick={() => setMostraCat(v => !v)}>{mostraCat ? "Ocultar" : "Mostrar"}</Botao>)}
        <div style={{ fontSize:10.5, color:c.txt2 }}>Compartilhado entre os projetos. Alterar um preço recalcula os planejamentos vinculados, sem alterar o saldo real.</div>
        {mostraCat && (
          <div style={{ marginTop:6 }}>
            {catalogo.map(it => formItem && formItem.id === it.id
              ? <FormItem key={it.id} c={c} inicial={it} onCancelar={() => setFormItem(null)} onSalvar={async d => { if (await gravarCatalogo(l => l.map(x => x.id === it.id ? { ...x, ...d } : x))) setFormItem(null); }} onExcluir={async () => { if (window.confirm("Excluir item do catálogo?") && await gravarCatalogo(l => l.filter(x => x.id !== it.id))) setFormItem(null); }}/>
              : <div key={it.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", borderTop:`1px solid ${c.bd}` }}>
                  <span style={{ fontSize:12, color:c.txt }}>{it.nome}</span>
                  <span style={{ display:"flex", gap:6, alignItems:"center" }}><span style={{ fontSize:12, color:c.txt2 }}>{brl(it.valor)}</span>{podeEditar && <Botao c={c} onClick={() => setFormItem(it)} style={{ padding:"3px 7px" }}>✏️</Botao>}</span>
                </div>)}
            {formItem && !formItem.id && <FormItem c={c} onCancelar={() => setFormItem(null)} onSalvar={async d => { if (await gravarCatalogo(l => [...l, { id:novoIdPlano("it"), ...d }])) setFormItem(null); }}/>}
            {podeEditar && !formItem && <Botao c={c} cor="#0ea5e9" onClick={() => setFormItem({})} style={{ marginTop:6 }}>+ Item (camisa, calça, sapato, kit…)</Botao>}
          </div>
        )}
      </div>

      {/* 4. Planejamento */}
      <div style={card}>
        {titulo("Planejamento (reservas e previstos)", podeEditar && !formLanc && <Botao c={c} cor="#0ea5e9" onClick={() => setFormLanc({})}>+ Lançamento</Botao>)}
        {podeEditar && !temCesta && !formLanc && <Botao c={c} onClick={() => setFormLanc({ tipo:"reserva", descricao:`Cesta de Natal ${anoAtual}`, mes:`${anoAtual}-12`, vinculo:"cestaNatal" })} style={{ width:"100%", marginTop:6 }}>🎄 Criar reserva Cesta de Natal ({qtdCestas} cesta(s) marcadas na Equipe)</Botao>}
        {(plano.lancamentos || []).length === 0 && <div style={{ fontSize:11.5, color:c.txt2, marginTop:8 }}>Nenhum lançamento. Exemplos: Cesta de Natal, Ovo de Páscoa, treinamento, kit de uniforme × quantidade.</div>}
        {[...(plano.lancamentos || [])].sort((a, b) => String(a.mes).localeCompare(String(b.mes))).map(l => {
          const ef = efeito(l, ctx);
          const det = l.vinculo === "cestaNatal" ? ` · ${qtdCestas} × ${brl(Number(l.valorMedio) || 0)}` : l.vinculo === "catalogo" ? ` · ${l.qtd} × ${brl(valorLanc({ ...l, qtd:1 }, ctx))}` : "";
          return (
            <div key={l.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, padding:"8px 0", borderTop:`1px solid ${c.bd}`, marginTop:6, opacity:l.realizado ? .5 : 1 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:c.txt }}>{l.descricao}</div>
                <div style={{ fontSize:10.5, color:c.txt2 }}>{PLANO_ROTULO[l.tipo]} · {l.mes ? rotuloMes(l.mes) : "—"}{det}{l.realizado ? " · realizado" : ""}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ fontSize:12.5, fontWeight:800, color:ef < 0 ? "#ef4444" : "#22c55e", whiteSpace:"nowrap" }}>{brl(ef)}</span>
                {podeEditar && <Botao c={c} onClick={() => setFormLanc(l)} style={{ padding:"4px 7px" }}>✏️</Botao>}
              </div>
            </div>
          );
        })}
      </div>
      {formLanc && <FormLancamento c={c} inicial={formLanc.id ? formLanc : (Object.keys(formLanc).length ? formLanc : null)} catalogo={catalogo} qtdCestas={qtdCestas} onSalvar={salvarLanc} onCancelar={() => setFormLanc(null)} onExcluir={formLanc.id ? () => excluirLanc(formLanc.id) : null}/>}
      {erro && <div style={{ fontSize:11.5, color:"#ef4444" }}>{erro}</div>}

      {/* 5. Histórico */}
      <div style={card}>
        {titulo("Últimos 12 meses")}
        <div style={{ fontSize:10.5, color:c.txt2, marginBottom:4 }}><span style={{ color:"#22c55e" }}>■</span> créditos {brl(periodo.creditos)} · <span style={{ color:"#ef4444" }}>■</span> débitos {brl(periodo.debitos)} · resultado <b style={{ color:corV(periodo.resultado) }}>{brl(periodo.resultado)}</b></div>
        <div dangerouslySetInnerHTML={{ __html: svgBarras(serie) }}/>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4, marginTop:6 }}>
          {Object.entries(periodo.porCategoria).map(([k, v]) => <div key={k} style={{ fontSize:11, color:c.txt2 }}>{CATEGORIAS[k]}: <b style={{ color:c.txt }}>{brl(v)}</b></div>)}
        </div>
      </div>

      {/* 6. Evolução */}
      <div style={card}>
        {titulo("Evolução do saldo")}
        <div style={{ fontSize:10.5, color:c.txt2, marginBottom:4 }}><span style={{ color:"#0ea5e9" }}>━</span> real · <span>┅</span> projeção · <span style={{ color:"#ef4444" }}>●</span> evento planejado</div>
        <div dangerouslySetInnerHTML={{ __html: svgLinha(real, proj.serie) }}/>
        <div style={{ fontSize:11, color:c.txt2, marginTop:4 }}>{brl(saldo)} + 12 × {brl(P.margem)}{T.previstosSaida ? ` − ${brl(T.previstosSaida)} planejados` : ""}{T.previstosEntrada ? ` + ${brl(T.previstosEntrada)} aportes previstos` : ""} = <b style={{ color:corV(proj.saldoFinal) }}>{brl(proj.saldoFinal)}</b></div>
      </div>

      <button onClick={() => gerarPDFProjetoFV({ pid, nome, resumo, real, serie, proj, plano, ctx, reservas, periodo })}
        style={{ background:"linear-gradient(135deg,#B21E27,#121212)", color:"#fff", border:"none", borderRadius:9, padding:"11px", fontSize:12.5, fontWeight:700, cursor:"pointer" }}>📄 Relatório · Imprimir / Salvar PDF · {pid}</button>
    </div>
  );
}
