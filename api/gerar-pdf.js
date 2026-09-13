// ─────────────────────────────────────────────────────────────
// api/gerar-pdf.js — Geração de PDF VERDADEIRO do dossiê de
// Auditoria Operacional (Fase 1B · piloto P311A).
//
// Rota aprovada: pdf-lib (sem Chromium/Puppeteer). O servidor
// monta o PDF a partir de DADOS ESTRUTURADOS enviados pela tela —
// NÃO converte HTML livre do navegador. Sem Storage, sem Firestore,
// sem Base64: gera e devolve o arquivo para download.
// ─────────────────────────────────────────────────────────────

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Cores (Moked).
const VERMELHO = rgb(0.70, 0.12, 0.15);
const PRETO = rgb(0.07, 0.07, 0.07);
const CINZA = rgb(0.39, 0.45, 0.55);
const CINZA_CLARO = rgb(0.90, 0.92, 0.94);
const VERDE = rgb(0.08, 0.50, 0.24);
const LARANJA = rgb(0.70, 0.25, 0.05);
const AMARELO = rgb(0.63, 0.33, 0.0);

const SIT_COR = {
  "conforme": VERDE, "nao-conforme": VERMELHO, "parcial": AMARELO,
  "pendente": AMARELO, "sem-dado": CINZA,
};
const SIT_LABEL = {
  "conforme": "Conforme", "nao-conforme": "Nao conforme", "parcial": "Parcial",
  "pendente": "Pendente", "sem-dado": "Sem dado",
};

// Remove caracteres fora do WinAnsi (pdf-lib fonte padrão) para não quebrar.
function limpa(s) {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\x20-\x7E]/g, "");                      // só ASCII imprimível
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo nao permitido. Use POST." });
    return;
  }

  // Payload esperado (dados estruturados, não HTML).
  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body); } catch (e) { body = null; }
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Payload invalido." });
    return;
  }
  const {
    projectId = "P311A", projetoNome = "", emissao = "", responsavel = "",
    relId = "", cobertura = {}, conformidade = {}, linhas = [],
    vulnerabilidades = [], acoes = [],
  } = body;

  if (!Array.isArray(linhas) || linhas.length === 0) {
    res.status(400).json({ error: "Sem linhas de matriz para gerar o dossie." });
    return;
  }

  try {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([595, 842]); // A4 retrato (pt)
    const M = 48;                        // margem
    const W = 595 - M * 2;
    let y = 842 - M;

    const novaPagina = () => { page = pdf.addPage([595, 842]); y = 842 - M; };
    const espaco = (h) => { if (y - h < M) novaPagina(); };

    const texto = (t, x, size, f, cor, maxW) => {
      const s = limpa(t);
      if (maxW) {
        // quebra simples por largura
        const palavras = s.split(" ");
        let linha = "", yy = y;
        for (const p of palavras) {
          const teste = linha ? linha + " " + p : p;
          if (f.widthOfTextAtSize(teste, size) > maxW && linha) {
            page.drawText(linha, { x, y: yy, size, font: f, color: cor });
            yy -= size + 3; linha = p;
            if (yy < M) { novaPagina(); yy = y; }
          } else linha = teste;
        }
        if (linha) { page.drawText(linha, { x, y: yy, size, font: f, color: cor }); yy -= size + 3; }
        y = yy;
        return;
      }
      page.drawText(s, { x, y, size, font: f, color: cor });
    };

    // ── Cabeçalho / capa ──
    page.drawRectangle({ x: M, y: y - 46, width: W, height: 46, color: PRETO });
    page.drawRectangle({ x: M, y: y - 46, width: 5, height: 46, color: VERMELHO });
    page.drawText("MOKED CONSULTING SECURITY", { x: M + 14, y: y - 18, size: 9, font: fontBold, color: rgb(1,1,1) });
    page.drawText("Auditoria Operacional", { x: M + 14, y: y - 34, size: 15, font: fontBold, color: rgb(1,1,1) });
    y -= 60;

    texto(`${limpa(projectId)} - ${limpa(projetoNome)}`, M, 12, fontBold, PRETO); y -= 18;
    texto(`Emissao: ${limpa(emissao)}`, M, 9, font, CINZA); y -= 12;
    texto(`Responsavel: ${limpa(responsavel) || "-"}`, M, 9, font, CINZA); y -= 12;
    texto(`Identificador: ${limpa(relId)}`, M, 9, font, CINZA); y -= 20;

    // ── Cobertura x Conformidade ──
    page.drawRectangle({ x: M, y: y - 52, width: W, height: 52, color: rgb(0.96,0.97,0.98) });
    const covPct = cobertura.pct != null ? cobertura.pct + "%" : "-";
    const confPct = conformidade.pct != null ? conformidade.pct + "%" : "-";
    page.drawText("Cobertura de evidencia", { x: M + 14, y: y - 16, size: 8, font, color: CINZA });
    page.drawText(covPct, { x: M + 14, y: y - 38, size: 20, font: fontBold, color: rgb(0.05,0.55,0.85) });
    page.drawText(`${cobertura.comDado||0}/${cobertura.total||0} com dado`, { x: M + 14, y: y - 48, size: 7, font, color: CINZA });
    page.drawText("Conformidade operacional", { x: M + W/2 + 14, y: y - 16, size: 8, font, color: CINZA });
    page.drawText(confPct, { x: M + W/2 + 14, y: y - 38, size: 20, font: fontBold, color: conformidade.pct==null?CINZA:(conformidade.pct>=80?VERDE:conformidade.pct>=60?AMARELO:VERMELHO) });
    page.drawText(`${conformidade.conformes||0}/${conformidade.avaliaveis||0} conformes`, { x: M + W/2 + 14, y: y - 48, size: 7, font, color: CINZA });
    y -= 62;
    texto("Conformidade calculada so sobre requisitos com evidencia. Ausencia de dado e 'Sem dado', nunca 'Conforme'.", M, 7.5, font, CINZA, W); y -= 8;

    // ── Matriz ──
    espaco(30);
    page.drawText("Matriz de auditoria", { x: M, y, size: 12, font: fontBold, color: PRETO }); y -= 20;

    for (const l of linhas) {
      espaco(58);
      const cor = SIT_COR[l.situacao] || CINZA;
      // título do requisito + badge situação
      page.drawText(limpa(l.requisito).slice(0, 70), { x: M, y, size: 10, font: fontBold, color: PRETO });
      const lbl = SIT_LABEL[l.situacao] || "-";
      const lblW = fontBold.widthOfTextAtSize(lbl, 8);
      page.drawRectangle({ x: M + W - lblW - 12, y: y - 3, width: lblW + 12, height: 14, color: cor });
      page.drawText(lbl, { x: M + W - lblW - 6, y, size: 8, font: fontBold, color: rgb(1,1,1) });
      y -= 14;
      texto(`Modulo: ${limpa(l.modulo)} | Prioridade: ${limpa(l.prioridade)}`, M, 8, font, CINZA); y -= 11;
      texto(`Evidencia: ${limpa(l.evidencia)}`, M, 8.5, font, PRETO, W); y -= 3;
      texto(`Origem: ${limpa(l.origem)}${l.data?" | "+limpa(l.data):""}${l.responsavel?" | "+limpa(l.responsavel):""}`, M, 7.5, font, CINZA, W); y -= 3;
      if (l.acao && l.acao !== "-") { texto(`Acao: ${limpa(l.acao)}`, M, 8, font, LARANJA, W); y -= 3; }
      // separador
      page.drawLine({ start: { x: M, y: y - 2 }, end: { x: M + W, y: y - 2 }, thickness: 0.5, color: CINZA_CLARO });
      y -= 12;
    }

    // ── Vulnerabilidades ──
    if (vulnerabilidades.length) {
      espaco(30);
      page.drawText("Principais vulnerabilidades e pendencias", { x: M, y, size: 12, font: fontBold, color: PRETO }); y -= 18;
      for (const v of vulnerabilidades) {
        espaco(14);
        const cor = SIT_COR[v.situacao] || CINZA;
        page.drawCircle({ x: M + 3, y: y + 3, size: 2.5, color: cor });
        texto(`${limpa(v.requisito)} - ${SIT_LABEL[v.situacao]||""} (${limpa(v.prioridade)})`, M + 12, 9, font, PRETO, W - 12); y -= 4;
      }
      y -= 8;
    }

    // ── Ações ──
    if (acoes.length) {
      espaco(30);
      page.drawText("Acoes recomendadas", { x: M, y, size: 12, font: fontBold, color: PRETO }); y -= 18;
      for (const a of acoes) {
        espaco(14);
        texto(`- ${limpa(a.acao)} (${limpa(a.prioridade)})`, M, 8.5, font, CINZA, W); y -= 4;
      }
      y -= 8;
    }

    // ── Rodapé (aviso) ──
    espaco(24);
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: CINZA_CLARO }); y -= 12;
    texto("Dados operacionais extraidos do MokLog CheckTest. Conclusoes criticas exigem validacao gerencial.", M, 7.5, font, CINZA, W);

    const bytes = await pdf.save();
    const dataArq = (emissao || "").slice(0,10).replace(/\//g,"-") || new Date().toISOString().slice(0,10);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Auditoria-Operacional-${limpa(projectId)}-${dataArq}.pdf"`);
    res.status(200).send(Buffer.from(bytes));
  } catch (e) {
    res.status(500).json({ error: "Falha ao gerar PDF: " + (e && e.message ? e.message : "desconhecido") });
  }
}
