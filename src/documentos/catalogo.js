// Documentos de consulta rápida por projeto (manual de bolso, MNP, POPs…). Cada item aponta para um arquivo em
// public/documentos. Para publicar um documento novo: colocar o arquivo lá e acrescentar UMA linha abaixo.
//   projetos: projetos que veem o documento ("*" = todos os projetos) · site: deep link (?site=) quando o documento cobre vários projetos.
export const DOCUMENTOS = [
  { id: "mnp-p505", titulo: "MNP", sub: "Normas e procedimentos do posto — P505", arquivo: "/documentos/MNP-P505.html", projetos: ["P505"] },
  { id: "ri-p505", titulo: "Regulamento Interno", sub: "Manual de bolso · Rev. 00", arquivo: "/documentos/MAN-RI-P505-001_Rev00.html", projetos: ["P505"] },
  { id: "ri-golgi", titulo: "Regulamento Interno", sub: "Manual de bolso Golgi · Rev. 00", arquivo: "/documentos/MAN-RI-GOLGI-001_Rev00.html", projetos: ["P601", "P602", "P604", "P605", "P606", "P607"], site: true },
  { id: "reverse-control", titulo: "Reverse Control®", sub: "Modelo operacional de proteção patrimonial · MOKED", arquivo: "/documentos/Reverse-Control-MOKED.html", projetos: ["*"] },
];

export const documentosDoProjeto = (pid) => DOCUMENTOS.filter((d) => d.projetos.includes("*") || d.projetos.includes(pid));
export const temDocumentos = (pid) => documentosDoProjeto(pid).length > 0;
export const urlDoDocumento = (doc, pid) => (doc.site ? `${doc.arquivo}?site=${encodeURIComponent(pid)}` : doc.arquivo);
