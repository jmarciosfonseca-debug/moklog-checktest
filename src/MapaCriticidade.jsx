import React from "react";

const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const CORES_GRAU = Object.freeze({ GRAVISSIMO: "#b91c1c", GRAVE: "#c2410c", MODERADO: "#a16207", BAIXO: "#15803d" });

export function gerarLeituraTerritorialHTML(regional = {}) {
  const leitura = regional.leituraTerritorial;
  if (!leitura?.setores?.length) return "";
  return `<section class="leitura-territorial"><h3>Leitura territorial — observação, consequência e verificação</h3><p><b>Base documental.</b> ${escapeHTML(leitura.base)}</p>${leitura.setores.map((s) => `<div class="qcard"><div class="qh"><b>${escapeHTML(s.setor)}</b><span class="qg">GRAU NÃO AFERIDO</span></div><p><b>Observado.</b> ${escapeHTML(s.observacao)}</p><p><b>Consequência possível.</b> ${escapeHTML(s.implicacao)}</p><p><b>Verificação operacional.</b> ${escapeHTML(s.acao)}</p></div>`).join("")}<p><b>Limites da análise.</b> ${escapeHTML(leitura.limitacao)}</p></section>`;
}

// Esquema consultivo, não mapa georreferenciado. Nunca infere orientação,
// distância ou grau ausente a partir de uma planta operacional.
export function gerarMapaCriticidadeHTML(regional = {}) {
  const quadrantes = regional.quadrantes || [];
  if (!quadrantes.length) return '<div class="terr-pend">Quadrantes e graus do entorno não aferidos para esta localização.</div>';
  return `<div class="criticidade"><b>Esquema de criticidade do entorno</b><p>Sem escala cartográfica. Cores representam o grau registrado, não a orientação; não alteram a classificação operacional.</p><div class="quad">${quadrantes.map((q) => {
    const grau = String(q.grau || "").toUpperCase();
    const cor = CORES_GRAU[grau] || "#64748b";
    const rotulo = grau === "GRAVISSIMO" ? "GRAVÍSSIMO" : grau || "NÃO AFERIDO";
    const vetores = (q.vetores || []).map((v) => `<li>${escapeHTML(v.desc || v.natureza)}</li>`).join("");
    return `<div class="qcard" style="border-top:4px solid ${cor}"><div class="qh"><span class="qn">${escapeHTML(q.lado || "Quadrante")}</span><span class="qg" style="color:${cor}">${escapeHTML(rotulo)}</span></div><div class="qsub">${escapeHTML(q.regiao)}</div><ul>${vetores || "<li>Vetores não aferidos.</li>"}</ul></div>`;
  }).join("")}</div></div>`;
}

export default function MapaCriticidade({ regional }) {
  return <section aria-label="Esquema de criticidade do entorno" dangerouslySetInnerHTML={{ __html: gerarMapaCriticidadeHTML(regional) }} />;
}
