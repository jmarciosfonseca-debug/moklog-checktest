// Documentos de consulta rápida por projeto (manual de bolso, MNP, POPs…). Cada item aponta para um arquivo em
// public/documentos. Para publicar um documento novo: colocar o arquivo lá e acrescentar UMA linha abaixo.
//   projetos: projetos que veem o documento ("*" = todos os projetos) · site: deep link (?site=) quando o documento cobre vários projetos.
export const DOCUMENTOS = [
  { id: "mnp-p505", titulo: "MNP", sub: "Normas e procedimentos do posto — P505", arquivo: "/documentos/MNP-P505.html", projetos: ["P505"] },
  { id: "ri-p505", titulo: "Regulamento Interno", sub: "Manual de bolso · Rev. 00", arquivo: "/documentos/MAN-RI-P505-001_Rev00.html", projetos: ["P505"] },
  { id: "ri-golgi", titulo: "Regulamento Interno", sub: "Manual de bolso Golgi · Rev. 00", arquivo: "/documentos/MAN-RI-GOLGI-001_Rev00.html", projetos: ["P601", "P602", "P604", "P605", "P606", "P607"], site: true },
  { id: "memorial-p505", titulo: "Memorial Descritivo de Segurança", sub: "KLOG Guarulhos · P505 · emissão nov/2026", arquivo: "/documentos/Memorial-Descritivo-P505.pdf", projetos: ["P505"] },
  { id: "memorial-p601", titulo: "Memorial Descritivo de Segurança", sub: "Golgi Cajamar · P601 · emissão nov/2026", arquivo: "/documentos/Memorial-Descritivo-P601.pdf", projetos: ["P601"] },
  { id: "memorial-p602", titulo: "Memorial Descritivo de Segurança", sub: "Golgi Mauá I · P602 · emissão nov/2026", arquivo: "/documentos/Memorial-Descritivo-P602.pdf", projetos: ["P602"] },
  { id: "memorial-p604", titulo: "Memorial Descritivo de Segurança", sub: "Golgi Jundiaí · P604 · emissão nov/2026", arquivo: "/documentos/Memorial-Descritivo-P604.pdf", projetos: ["P604"] },
  { id: "memorial-p605", titulo: "Memorial Descritivo de Segurança", sub: "Golgi Dutra · P605 · emissão nov/2026", arquivo: "/documentos/Memorial-Descritivo-P605.pdf", projetos: ["P605"] },
  { id: "memorial-p606", titulo: "Memorial Descritivo de Segurança", sub: "Golgi Duque de Caxias · P606 · emissão nov/2026", arquivo: "/documentos/Memorial-Descritivo-P606.pdf", projetos: ["P606"] },
  { id: "memorial-p607", titulo: "Memorial Descritivo de Segurança", sub: "Golgi Brasília · P607 · emissão nov/2026", arquivo: "/documentos/Memorial-Descritivo-P607.pdf", projetos: ["P607"] },
  { id: "reverse-control", titulo: "Reverse Control®", sub: "Modelo operacional de proteção patrimonial · MOKED", arquivo: "/documentos/Reverse-Control-MOKED.html", projetos: ["*"] },
];

export const documentosDoProjeto = (pid) => DOCUMENTOS.filter((d) => d.projetos.includes("*") || d.projetos.includes(pid));
export const temDocumentos = (pid) => documentosDoProjeto(pid).length > 0;
export const urlDoDocumento = (doc, pid) => (doc.site ? `${doc.arquivo}?site=${encodeURIComponent(pid)}` : doc.arquivo);
