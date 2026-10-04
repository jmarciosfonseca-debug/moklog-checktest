// ─────────────────────────────────────────────────────────────
// Padrão visual MOKED para os relatórios (aprovado pelo Marcio em 04/10/2026): fundo branco, grafite com o vermelho
// da Moked só como detalhe, cor apenas para exceção, uma família de fonte, rodapé com o nº do documento.
// Classes com prefixo "mk-" para não colidir com outros estilos no mesmo arquivo (ex.: anexos).
// ─────────────────────────────────────────────────────────────
import { MOKED_LOGO, getTheme } from "../generatePDF";

export const escHTML = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const num1 = (x) => (Math.round(x * 10) / 10).toFixed(1).replace(".", ",");
export const milhar = (x) => Math.round(x).toLocaleString("pt-BR");
export const hm = (min) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;
export const dataBR = (iso) => { if (!iso) return "—"; const d = new Date(String(iso).length <= 10 ? iso + "T12:00:00" : iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR"); };
export const horaBR = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };

export function barrasMoked(itens, fmt = (v) => String(v)) {
  const mx = Math.max(1, ...itens.map(([, v]) => v));
  return `<div class="mk-bars">${itens.map(([k, v]) => `<div class="mk-bar"><span>${escHTML(k)}</span><span class="mk-tr"><span style="width:${(v / mx * 100).toFixed(1)}%"></span></span><span class="mk-v">${fmt(v)}</span></div>`).join("")}</div>`;
}

export function documentoMoked({ project, titulo, subtitulo, numero, corpo, interno = false, hoje = new Date(), rodape }) {
  const theme = getTheme(project?.id) || {};
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escHTML(titulo)} — ${escHTML(project?.id || "")}</title><style>${cssMoked()}${rodapePagina(rodape || `${numero} · ${titulo} · ${project?.id || ""} ${project?.name || ""} · Moked Consulting Security · MokLog CheckTest`)}</style></head><body>
<div class="mk-noprint"><button onclick="window.print()" class="mk-print">Imprimir / Salvar PDF</button></div>
<header class="mk-topo"><div class="mk-logos"><img src="${MOKED_LOGO}" class="mk-lm" alt="Moked Consulting Security">${theme.empresaLogo ? `<span class="mk-sep"></span><img src="${theme.empresaLogo}" class="mk-lg" alt="${escHTML(theme.empresaNome || "")}">` : ""}</div>
<div class="mk-meta">${interno ? '<div class="mk-tag">VERSÃO INTERNA</div>' : ""}<div><b>${escHTML(titulo)}</b> · Nº ${escHTML(numero)}</div><div>Emissão ${hoje.toLocaleDateString("pt-BR")} · José Fonseca</div></div></header>
<div class="mk-regua"></div><h1 class="mk-h1">${escHTML(titulo)}</h1><p class="mk-sub">${subtitulo}</p>
${corpo}
<section class="mk-fim"><div><div class="mk-mu">Base dos dados</div><div class="mk-sm">Registros lançados pelas equipes no MokLog CheckTest, supervisionados pela Moked Consulting Security.</div></div>
<div class="mk-ass"><div class="mk-linha"></div><b>José Fonseca</b><div class="mk-mu">Consultor de Segurança · Moked Consulting Security</div><div class="mk-mu">jose.fonseca@moked.com.br</div></div></section>
</body></html>`;
}

// Rodapé em todas as páginas impressas, com "pág. X de Y" (margens de página do CSS; navegadores sem suporte simplesmente não mostram).
export function rodapePagina(texto) {
  const t = String(texto || "").replace(/[\\"]/g, "").replace(/[\r\n]+/g, " ");
  return `@page{@bottom-left{content:"${t}";font-family:Calibri,Carlito,Arial,sans-serif;font-size:7.5pt;color:#9CA3AF}@bottom-right{content:"pág. " counter(page) " de " counter(pages);font-family:Calibri,Carlito,Arial,sans-serif;font-size:7.5pt;color:#9CA3AF}}`;
}

export function baixarHtml(html, nome) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click(); URL.revokeObjectURL(url);
}

export function cssMoked() {
  return `@page{size:A4;margin:14mm 14mm 18mm 14mm}
body{font-family:Calibri,Carlito,"Segoe UI",Arial,sans-serif;color:#1F2937;font-size:9.6pt;line-height:1.35;margin:0 auto;max-width:190mm;padding:8px;background:#fff}
.mk-noprint{text-align:center;margin:0 0 16px}.mk-print{background:#111827;color:#fff;border:none;border-radius:6px;padding:10px 26px;font-size:14px;font-weight:700;cursor:pointer}
@media print{.mk-noprint{display:none}body{padding:0;max-width:none}}
.mk-mu{color:#6B7280}.mk-sm{font-size:8.4pt}
.mk-topo{display:flex;justify-content:space-between;align-items:center}.mk-logos{display:flex;align-items:center;gap:12px}.mk-lm{height:36px}.mk-lg{height:34px;max-width:130px;object-fit:contain}.mk-sep{width:1px;height:30px;background:#D1D5DB}
.mk-meta{text-align:right;font-size:8.6pt;color:#4B5563;line-height:1.45}.mk-tag{display:inline-block;font-size:7.4pt;letter-spacing:.08em;font-weight:700;color:#B91C1C;border:1px solid #FCA5A5;border-radius:3px;padding:1px 6px;margin-bottom:3px}
.mk-regua{height:3px;background:linear-gradient(90deg,#111827 0 72%,#B91C1C 72% 100%);margin:9px 0 12px;border-radius:2px}
.mk-h1{font-size:19pt;font-weight:700;margin:0;color:#111827}.mk-sub{margin:2px 0 12px;color:#4B5563;font-size:10pt}
.mk-hero{display:grid;grid-template-columns:34% 1fr;gap:12px;border:1px solid #E5E7EB;border-radius:8px;padding:12px 14px;margin-bottom:10px}
.mk-lb{font-size:8pt;text-transform:uppercase;letter-spacing:.07em;color:#6B7280;font-weight:700}.mk-big{font-size:34pt;font-weight:700;color:#111827;line-height:1.05;margin:6px 0 3px}
.mk-chip{display:inline-block;font-size:8.6pt;font-weight:700;border-radius:999px;padding:2px 8px;margin-bottom:6px}.mk-chip-ok{background:#DCFCE7;color:#166534}.mk-chip-wa{background:#FEF3C7;color:#92400E}
.mk-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}.mk-k{border:1px solid #E5E7EB;border-radius:8px;padding:8px 10px}
.mk-kv{font-size:18pt;font-weight:700;color:#111827;line-height:1.1}.mk-kl{font-size:8.6pt;color:#374151;font-weight:600}.mk-ok{color:#15803D}.mk-da{color:#B91C1C}.mk-wa{color:#B45309}
.mk-dest{background:#F9FAFB;border-left:3px solid #111827;border-radius:0 6px 6px 0;padding:8px 12px;margin-bottom:12px}.mk-dest ul,.mk-qual ul{margin:4px 0 0;padding-left:16px}.mk-dest li,.mk-qual li{margin:2px 0}
.mk-h2{font-size:11pt;font-weight:700;color:#111827;margin:4px 0 6px;page-break-after:avoid}.mk-h2 .mk-mu{font-weight:400;font-size:9pt}
.mk-duas{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px}.mk-card{border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px}
.mk-bars{display:grid;gap:4px;margin-top:5px}.mk-bar{display:grid;grid-template-columns:96px 1fr 74px;gap:8px;align-items:center;font-size:8.8pt}
.mk-tr{height:11px;background:#F3F4F6;border-radius:2px;overflow:hidden;display:block}.mk-tr span{display:block;height:11px;background:#111827;border-radius:2px}.mk-v{text-align:right;color:#374151;font-weight:600}
table.mk-tb{width:100%;border-collapse:collapse}.mk-tb th{font-size:7.8pt;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;text-align:left;font-weight:700;border-bottom:1.5px solid #111827;padding:5px 6px}
.mk-tb td{border-bottom:1px solid #EEF0F3;padding:4px 6px;vertical-align:top}.mk-tb tr{page-break-inside:avoid}.mk-tb .mk-mu{font-size:8.2pt;line-height:1.25}
.mk-num{text-align:right;white-space:nowrap}.mk-dv{font-weight:700;color:#111827}
.mk-b{display:inline-block;font-size:7.8pt;font-weight:700;border-radius:3px;padding:1px 6px;white-space:nowrap}.mk-b-ok{background:#DCFCE7;color:#166534}.mk-b-wa{background:#FEF3C7;color:#92400E}.mk-b-da{background:#FEE2E2;color:#991B1B}.mk-b-in{background:#EFF6FF;color:#1D4ED8}
.mk-sim{color:#15803D;font-weight:700}.mk-nao{color:#9CA3AF}.mk-inv{color:#B45309;font-weight:700}
.mk-nota{font-size:8pt;color:#6B7280;margin:5px 0 0}
.mk-qual{border:1px solid #FDE68A;background:#FFFBEB;border-radius:8px;padding:8px 12px;margin:8px 0 12px}
.mk-vazio{border:1px solid #BBF7D0;background:#F0FDF4;border-radius:10px;padding:18px 16px;margin:10px 0 12px;text-align:center}.mk-vazio .mk-big{color:#15803D}
.mk-bloco{page-break-inside:avoid}section{margin-bottom:6px}
.mk-fim{display:grid;grid-template-columns:1fr 210px;gap:20px;margin-top:14px;border-top:1px solid #E5E7EB;padding-top:10px;page-break-inside:avoid}.mk-ass{font-size:9pt;text-align:center}.mk-linha{border-top:1px solid #111827;margin:24px 0 4px}
.mk-regua,.mk-chip,.mk-b,.mk-tr span,.mk-qual,.mk-vazio{-webkit-print-color-adjust:exact;print-color-adjust:exact}`;
}
