// ─────────────────────────────────────────────────────────────
// pdfSolicitacoes.js — PDF das solicitações de material/uniforme
// pendentes, padrão Moked, para envio à empresa (GSS etc.).
//
// Duas saídas:
//   gerarPDFSolicitacoesColaborador(project, colaborador)
//   gerarPDFSolicitacoesLote(project, colaboradores)
//
// Reaproveita getTheme() de generatePDF.js (logo Moked + paleta por
// cliente). Mesma mecânica dos laudos: HTML → Blob → janela com botão
// "Imprimir / Salvar PDF" (window.print), compatível com Safari iOS.
// Não cria fonte de verdade: lê uniforme.solicitacoes já existentes.
// ─────────────────────────────────────────────────────────────

import { getTheme } from "./generatePDF";

const SLA_ALERTA = 5; // dias em aberto para alertar (espelha Equipe.jsx)

function diasAberto(desdeIso) {
  if (!desdeIso) return 0;
  const t = new Date(desdeIso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function fmtBR(d) {
  if (!d) return "—";
  try {
    const iso = String(d).length === 10 ? d + "T12:00:00" : d;
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch { return String(d); }
}

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Extrai as solicitações pendentes de um colaborador (projeção segura).
function pendentesDe(colab) {
  const sl = colab && colab.uniforme && Array.isArray(colab.uniforme.solicitacoes)
    ? colab.uniforme.solicitacoes : [];
  return sl
    .filter(s => s.status === "pendente") // estrito: status ausente NÃO é pendente
    .map(s => {
      const temData = !!s.solicitadoEm; // SLA só com solicitadoEm; sem substitutos
      return {
        item: s.item || s.nome || "Material",
        tamanho: s.tamanho || "",
        marca: s.marca || "",
        motivo: s.motivo || "",
        desde: temData ? s.solicitadoEm : null,
        dias: temData ? diasAberto(s.solicitadoEm) : null, // null = cadastro incompleto
      };
    });
}

const NOMES_PROJETO = {
  P601:"Golgi Cajamar", P602:"Golgi Mauá", P604:"Golgi Jundiaí", P605:"Golgi Dutra",
  P606:"Golgi Duque de Caxias", P607:"Golgi Brasília",
  P311A:"Mega Curitiba", P311B:"Mega Itajaí", P505:"KLOG Guarulhos",
  P260A:"Jatinox A", P260B:"Jatinox B", P260C:"Jatinox C",
};

// Monta as linhas <tr> de uma tabela de itens pendentes.
function linhasItens(pendentes, theme) {
  if (!pendentes.length) {
    return `<tr><td colspan="5" style="padding:12px;text-align:center;color:#64748b;">Sem solicitações pendentes.</td></tr>`;
  }
  return pendentes.map(p => {
    const badge = (p.dias == null)
      ? `<span style="color:#94a3b8;">Cadastro incompleto (sem data)</span>`
      : (p.dias >= SLA_ALERTA
          ? `<span style="color:#b91c1c;font-weight:700;">${p.dias} dia(s) · SLA excedido</span>`
          : `<span style="color:#b45309;">${p.dias} dia(s)</span>`);
    const detalhe = [p.tamanho ? `Tam ${esc(p.tamanho)}` : "", p.marca ? esc(p.marca) : ""].filter(Boolean).join(" · ");
    return `<tr>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;font-weight:600;">${esc(p.item)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;">${detalhe || "—"}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;">${esc(p.motivo) || "—"}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;">${fmtBR(p.desde)}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;text-align:center;">${badge}</td>
    </tr>`;
  }).join("");
}

// Bloco de um colaborador (usado no individual e no lote).
function blocoColaborador(colab, pendentes, theme) {
  const funcao = esc(colab.cargo || colab.funcao || "");
  return `
  <div class="bloco">
    <div class="colab-hdr">
      <div class="colab-nome">${esc(colab.nome || "Colaborador")}</div>
      <div class="colab-func">${funcao}${pendentes.length ? ` · ${pendentes.length} item(ns) pendente(s)` : ""}</div>
    </div>
    <table class="tbl">
      <thead>
        <tr>
          <th>Item</th><th>Tam/Marca</th><th>Motivo</th><th>Aberta em</th><th>Em aberto</th>
        </tr>
      </thead>
      <tbody>${linhasItens(pendentes, theme)}</tbody>
    </table>
  </div>`;
}

function css(theme) {
  return `
  *{margin:0;padding:0;box-sizing:border-box;}
  html{background:#565c64;}
  body{font-family:Arial,Helvetica,sans-serif;color:#15181d;line-height:1.45;-webkit-font-smoothing:antialiased;}
  .folha{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:16mm 15mm 14mm;box-shadow:0 6px 30px rgba(0,0,0,.28);}
  .topo{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${theme.headerBg};padding-bottom:10px;margin-bottom:6px;}
  .topo img{height:46px;}
  .topo .tit{text-align:right;}
  .topo .tit h1{font-size:17px;color:${theme.headerBg};letter-spacing:.5px;}
  .topo .tit .sub{font-size:11px;color:#475569;margin-top:2px;}
  .meta{display:flex;justify-content:space-between;font-size:11px;color:#475569;margin:8px 0 14px;}
  .bloco{margin-bottom:16px;page-break-inside:avoid;}
  .colab-hdr{background:${theme.headerBg};color:#fff;padding:7px 10px;border-radius:6px 6px 0 0;}
  .colab-nome{font-size:13px;font-weight:700;}
  .colab-func{font-size:10.5px;opacity:.9;margin-top:1px;}
  .tbl{width:100%;border-collapse:collapse;font-size:11px;border:1px solid #e5e7eb;border-top:none;}
  .tbl thead th{background:#f1f5f9;color:#334155;text-align:left;padding:7px 9px;font-size:10px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #cbd5e1;}
  .tbl thead th:last-child{text-align:center;}
  .rodape{margin-top:18px;border-top:1px solid #d2d7dd;padding-top:8px;font-size:9.5px;color:#64748b;display:flex;justify-content:space-between;}
  .no-print{position:fixed;top:12px;right:12px;}
  @media print{ .no-print{display:none!important;} html{background:#fff;} .folha{box-shadow:none;margin:0;width:auto;min-height:auto;padding:12mm;} .bloco{page-break-inside:avoid;} *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;} @page{margin:12mm;} }`;
}

function montarHTML({ theme, projectId, titulo, corpo, totalItens }) {
  const nomeProj = NOMES_PROJETO[projectId] || projectId;
  const hoje = new Date().toLocaleDateString("pt-BR");
  const logo = theme.mokedLogo ? `<img src="${theme.mokedLogo}" alt="Moked"/>` : `<div style="font-weight:800;color:${theme.headerBg};font-size:18px;">MOKED</div>`;
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} — ${esc(projectId)}</title>
<style>${css(theme)}</style></head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="background:${theme.headerBg};color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:14px;font-weight:700;cursor:pointer;">🖨️ Gerar documento para imprimir/salvar em PDF</button>
  </div>
  <div class="folha">
    <div class="topo">
      ${logo}
      <div class="tit"><h1>${esc(titulo)}</h1><div class="sub">Solicitações de material pendentes</div></div>
    </div>
    <div class="meta">
      <span><b>${esc(projectId)}</b> — ${esc(nomeProj)}</span>
      <span>Emissão: ${hoje} · ${totalItens} item(ns) pendente(s)</span>
    </div>
    ${corpo}
    <div class="rodape">
      <span>Moked Consulting Security · Gestão de Uniforme e Material Tático</span>
      <span>Documento gerado automaticamente pelo MokLog CheckTest</span>
    </div>
  </div>
</body></html>`;
}

// Abre o HTML como arquivo (mesma mecânica dos laudos, compatível iOS).
function abrir(html, nomeArquivo) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomeArquivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ── PDF individual ────────────────────────────────────────────────────
export function gerarPDFSolicitacoesColaborador(project, colaborador) {
  const projectId = project?.id || project;
  const theme = getTheme(projectId);
  const pend = pendentesDe(colaborador);
  const corpo = blocoColaborador(colaborador, pend, theme);
  const html = montarHTML({
    theme, projectId,
    titulo: "Solicitação de Material",
    corpo, totalItens: pend.length,
  });
  const slug = String(colaborador?.nome || "colaborador").normalize("NFD").replace(/[^\w]+/g, "_").toLowerCase();
  abrir(html, `solicitacoes_${projectId}_${slug}.html`);
  return pend.length;
}

// ── PDF em lote (todo o projeto) ──────────────────────────────────────
// Inclui apenas colaboradores COM pendências; ordena por mais itens.
export function gerarPDFSolicitacoesLote(project, colaboradores) {
  const projectId = project?.id || project;
  const theme = getTheme(projectId);
  const ativos = (colaboradores || []).filter(c => (c.status || "ativo") === "ativo");
  const comPend = ativos
    .map(c => ({ colab: c, pend: pendentesDe(c) }))
    .filter(x => x.pend.length > 0)
    .sort((a, b) => b.pend.length - a.pend.length);

  const totalItens = comPend.reduce((n, x) => n + x.pend.length, 0);
  const corpo = comPend.length
    ? comPend.map(x => blocoColaborador(x.colab, x.pend, theme)).join("")
    : `<div style="padding:24px;text-align:center;color:#64748b;">Nenhuma solicitação pendente neste projeto.</div>`;

  const html = montarHTML({
    theme, projectId,
    titulo: "Solicitações de Material — Equipe",
    corpo, totalItens,
  });
  abrir(html, `solicitacoes_${projectId}_lote.html`);
  return { colaboradores: comPend.length, itens: totalItens };
}
