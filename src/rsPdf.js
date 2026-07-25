// ── MokLog CheckTest — rsPdf.js
// Gerador de relatório do módulo RS (Registro Situacional / Ocorrências).
// Reusa o tema por cliente (cores + logos) de generatePDF.js.
// Gera HTML + CSS e baixa um .html que o usuário abre e imprime como PDF
// (mesmo padrão dos demais relatórios do app).
//
// Suporta:
//   • RS individual  → gerarPdfRS(project, registro)
//   • Pacote de RS    → gerarPdfPacoteRS(project, registros, meta)
//
// Regras de layout fechadas com o gestor:
//   • Documento SEMPRE mascarado no PDF (LGPD).
//   • SEM duração calculada (início→término não aparece).
//   • Fotos em GALERIA ÚNICA com legenda (local e CFTV juntas).

import { getTheme } from "./generatePDF";
import { getNatureza, getSubtipo, sevLabel, sevCor, RS_STATUS } from "./rsCatalogo";

// ── Helpers ───────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDataHora(iso) {
  if (!iso) return "--";
  // aceita "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm"
  const [d, h] = String(iso).split("T");
  if (!d) return "--";
  const [ano, mes, dia] = d.split("-");
  if (!ano) return esc(iso);
  const dataBR = `${dia}/${mes}/${ano}`;
  return h ? `${dataBR} ${h.slice(0, 5)}` : dataBR;
}

// Mascaramento LGPD — sempre parcial no PDF, independente do valor bruto.
function mascararDoc(doc) {
  if (!doc) return "";
  const so = String(doc).replace(/\D/g, "");
  if (so.length === 11) {
    // CPF: 824.***.***-00  (mostra 3 primeiros e 2 últimos)
    return `${so.slice(0, 3)}.***.***-${so.slice(9)}`;
  }
  if (so.length === 14) {
    // CNPJ: 12.***.***/****-55
    return `${so.slice(0, 2)}.***.***/****-${so.slice(12)}`;
  }
  // formato desconhecido: mascara o miolo
  if (so.length <= 4) return "***";
  return `${so.slice(0, 2)}${"*".repeat(Math.max(0, so.length - 4))}${so.slice(-2)}`;
}

function mascararTelefone(tel) {
  if (!tel) return "";
  const so = String(tel).replace(/\D/g, "");
  if (so.length < 6) return "****";
  return `(${so.slice(0, 2)}) *****-${so.slice(-2)}`;
}

// Gera um ID legível a partir do projeto + número sequencial já gravado.
function idRS(project, registro) {
  if (registro?.id) return registro.id;
  const base = (project?.id || "RS").replace(/^P/, "");
  const seq = registro?.seq != null ? String(registro.seq).padStart(4, "0") : "----";
  return `${base}-${seq}`;
}

// ── CSS (segue a mesma linguagem visual do generatePDF.js) ─────
function getCSS(theme) {
  return `
    *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;color:#0f172a;padding:24px;font-size:13px;line-height:1.55}
    .header{background:${theme.headerBg};border-radius:14px;margin-bottom:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.18)}
    .header-top{padding:22px 26px;display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
    .header-accent{height:5px;background:rgba(255,255,255,0.25)}
    .rs-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 22px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.05);page-break-inside:avoid}
    .rs-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #f1f5f9;padding-bottom:12px;margin-bottom:14px}
    .rs-id{font-size:11px;font-weight:800;color:${theme.primary};letter-spacing:1px}
    .rs-nat{font-size:18px;font-weight:900;color:#0f172a;margin-top:2px;letter-spacing:-0.3px}
    .rs-sub{font-size:13px;color:#475569;font-weight:600;margin-top:2px}
    .sev{display:inline-block;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:800;color:#fff;letter-spacing:.5px;white-space:nowrap}
    .section-title{font-size:11px;font-weight:800;color:${theme.primary};text-transform:uppercase;letter-spacing:1px;border-left:4px solid ${theme.headerBg};padding-left:10px;margin:16px 0 10px}
    .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px 18px}
    .info-item label{font-size:9.5px;color:#94a3b8;font-weight:700;text-transform:uppercase;display:block;margin-bottom:2px;letter-spacing:.5px}
    .info-item span{font-size:14px;font-weight:700;color:#0f172a}
    .detalhe{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;font-size:13.5px;color:#1e293b;line-height:1.6;white-space:pre-wrap}
    .medidas{background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;padding:12px 16px;font-size:13px;color:#14532d;white-space:pre-wrap}
    .flags{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
    .flag{display:inline-block;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe}
    .galeria{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
    .foto{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#fff;page-break-inside:avoid}
    .foto img{width:100%;height:180px;object-fit:cover;display:block;background:#f1f5f9}
    .foto .legenda{padding:8px 12px;font-size:11.5px;color:#475569;font-weight:600;border-top:1px solid #f1f5f9}
    .foto .tag{display:inline-block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;padding:2px 7px;border-radius:5px;margin-right:6px;color:#fff}
    .footer{text-align:center;margin-top:14px;padding-top:12px;border-top:2px solid #e2e8f0;font-size:11px;color:#64748b;font-weight:500}
    .status-tag{display:inline-block;padding:3px 10px;border-radius:5px;font-size:10px;font-weight:800;letter-spacing:.3px}
    @media print{body{padding:10px}@page{margin:14mm}.no-print{display:none!important}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}}
  `;
}

// ── Cabeçalho ─────────────────────────────────────────────────
function buildHeader(theme, project, subtitulo) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  return `
    <div class="header">
      <div class="header-top">
        <div style="flex:1">
          <p style="font-size:10px;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600">Moked Consulting Security</p>
          <h1 style="font-size:24px;font-weight:900;color:#fff;margin-bottom:6px;letter-spacing:-0.5px">Registro Situacional (RS)</h1>
          <p style="font-size:14px;color:rgba(255,255,255,.9);font-weight:600;margin-bottom:3px">${esc(project?.id || "")} — ${esc(project?.name || "")}</p>
          ${subtitulo ? `<p style="font-size:12px;color:rgba(255,255,255,.7);margin-top:2px">${esc(subtitulo)}</p>` : ""}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;flex-shrink:0">
          <div style="display:flex;align-items:center;gap:10px">
            <img src="${theme.mokedLogo}" style="height:56px;max-width:130px;object-fit:contain;filter:brightness(1.1)" alt="Moked"/>
            <div style="width:1px;background:rgba(255,255,255,.25);height:44px;flex-shrink:0"></div>
            <img src="${theme.empresaLogo}" style="height:56px;max-width:150px;object-fit:contain;background:rgba(255,255,255,.14);border-radius:10px;padding:5px 12px" alt="${esc(theme.empresaNome)}"/>
          </div>
          <div style="text-align:right;font-size:11px;color:rgba(255,255,255,.6)">
            <div style="font-weight:600">Gerado em ${hoje}</div>
            <div>José Fonseca · jose.fonseca@moked.com.br</div>
          </div>
        </div>
      </div>
      <div class="header-accent"></div>
    </div>`;
}

// ── Bloco de um RS (reutilizado no individual e no pacote) ─────
function buildRSCard(project, registro) {
  const nat = getNatureza(registro?.natureza);
  const sub = getSubtipo(registro?.subtipo);
  const natLabel = nat?.label || registro?.natureza || "—";
  const subLabel = sub?.label || registro?.subtipo || "";
  const sev = registro?.severidade || sub?.sevPadrao || "info";

  const st = registro?.status || RS_STATUS.PENDENTE;
  const stBg = st === RS_STATUS.ARQUIVADO ? "#f1f5f9" : "#fff8f0";
  const stFg = st === RS_STATUS.ARQUIVADO ? "#64748b" : "#b45309";
  const stTxt = st === RS_STATUS.ARQUIVADO ? "ARQUIVADO" : "PENDENTE";

  // Campos de identificação (mascarados quando sensíveis)
  const info = [];
  const push = (label, val) => { if (val) info.push([label, val]); };
  push("Data / hora", fmtDataHora(registro?.dataHora || registro?.data));
  push("Líder", registro?.lider);
  push("Quem avisou", registro?.quemAvisou);
  push("Envolvido", registro?.nomeEnvolvido);
  if (registro?.documentoEnvolvido) push("Documento", mascararDoc(registro.documentoEnvolvido));
  if (registro?.telefoneEnvolvido) push("Telefone", mascararTelefone(registro.telefoneEnvolvido));
  push("Transportadora / Inquilino", registro?.transportadora || registro?.inquilino);
  if (registro?.placaCavalo) {
    push("Placa", registro.placaCarreta ? `${registro.placaCavalo} / ${registro.placaCarreta}` : registro.placaCavalo);
  }
  push("Doca / Local", registro?.local);

  const infoHtml = info.map(([l, v]) =>
    `<div class="info-item"><label>${esc(l)}</label><span>${esc(v)}</span></div>`
  ).join("");

  // Flags secundárias
  const flags = Array.isArray(registro?.flags) ? registro.flags : [];
  const flagsHtml = flags.length
    ? `<div class="flags">${flags.map(f => `<span class="flag">${esc(f)}</span>`).join("")}</div>`
    : "";

  // Galeria única de fotos (local + CFTV juntas, com tag e legenda)
  const fotos = Array.isArray(registro?.fotos) ? registro.fotos : [];
  const galeriaHtml = fotos.length
    ? `<div class="section-title">Evidências</div>
       <div class="galeria">
         ${fotos.map(f => {
           const origem = (f?.origem || "").toUpperCase();
           const tagCor = origem === "CFTV" ? "#7c3aed" : "#0ea5e9";
           const tagTxt = origem === "CFTV" ? "CFTV" : "LOCAL";
           const legenda = esc(f?.legenda || "");
           return `<div class="foto">
             <img src="${f?.dataUrl || f?.url || ""}" alt="evidência"/>
             <div class="legenda"><span class="tag" style="background:${tagCor}">${tagTxt}</span>${legenda}</div>
           </div>`;
         }).join("")}
       </div>`
    : "";

  return `
  <div class="rs-card">
    <div class="rs-top">
      <div>
        <div class="rs-id">RS ${esc(idRS(project, registro))}
          &nbsp;·&nbsp;<span class="status-tag" style="background:${stBg};color:${stFg}">${stTxt}</span>
        </div>
        <div class="rs-nat">${esc(natLabel)}</div>
        ${subLabel ? `<div class="rs-sub">${esc(subLabel)}</div>` : ""}
      </div>
      <div class="sev" style="background:${sevCor(sev)}">${esc(sevLabel(sev))}</div>
    </div>

    ${infoHtml ? `<div class="info-grid">${infoHtml}</div>` : ""}

    ${registro?.resumo ? `<div class="section-title">Resumo</div><div style="font-size:14px;font-weight:600;color:#0f172a">${esc(registro.resumo)}</div>` : ""}

    ${registro?.detalhamento ? `<div class="section-title">Detalhamento</div><div class="detalhe">${esc(registro.detalhamento)}</div>` : ""}

    ${registro?.medidas ? `<div class="section-title">Medidas tomadas</div><div class="medidas">${esc(registro.medidas)}</div>` : ""}

    ${registro?.observacao ? `<div class="section-title">Observação</div><div class="detalhe">${esc(registro.observacao)}</div>` : ""}

    ${flags.length ? `<div class="section-title">Classificação secundária</div>${flagsHtml}` : ""}

    ${galeriaHtml}
  </div>`;
}

// ── Empacota HTML final e dispara o download do .html ──────────
function baixarHtml(html, nomeArquivo) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

function envelope(theme, project, subtitulo, corpoHtml, rodapeExtra) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>RS — ${esc(project?.id || "")}</title>
<style>${getCSS(theme)}</style></head><body>
${buildHeader(theme, project, subtitulo)}
<div class="no-print" style="text-align:center;margin-bottom:16px">
  <button onclick="window.print()" style="background:${theme.headerBg};color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
${corpoHtml}
<div class="footer">
  MokLog CheckTest © Moked Consulting Security · ${esc(theme.empresaNome)}
  ${rodapeExtra ? ` · ${esc(rodapeExtra)}` : ""}
</div>
</body></html>`;
}

// ── API pública ───────────────────────────────────────────────

// RS individual
export function gerarPdfRS(project, registro) {
  if (!project || !registro) return;
  const theme = getTheme(project.id);
  const sub = getSubtipo(registro?.subtipo);
  const subtitulo = sub?.label ? `Ocorrência: ${sub.label}` : "Ocorrência";
  const corpo = buildRSCard(project, registro);
  const html = envelope(theme, project, subtitulo, corpo, `RS ${idRS(project, registro)}`);
  baixarHtml(html, `RS_${project.id}_${idRS(project, registro)}.html`);
}

// Pacote de RS (vários registros num único documento)
export function gerarPdfPacoteRS(project, registros, meta = {}) {
  if (!project || !Array.isArray(registros) || registros.length === 0) return;
  const theme = getTheme(project.id);
  const n = registros.length;
  const subtitulo = meta.titulo || `Pacote de ${n} ocorrência${n > 1 ? "s" : ""}`;
  const corpo = registros.map(r => buildRSCard(project, r)).join("");
  const html = envelope(theme, project, subtitulo, corpo, `${n} RS`);
  const dataArq = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD local
  baixarHtml(html, `RS_${project.id}_pacote_${dataArq}.html`);
}
