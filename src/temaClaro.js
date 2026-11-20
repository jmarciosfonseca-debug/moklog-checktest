import { createElement } from "react";
// temaClaro.js — ajuste do MODO CLARO para blocos com fundo escuro fixo.
// Várias telas (Equipe, Equipamentos, CCO etc.) pintam avisos/etiquetas com
// fundos escuros "chapados" (vermelho, verde, âmbar...) que só fazem sentido
// no modo escuro. No modo claro, esta folha de estilo troca SOMENTE esses
// fundos por tons claros equivalentes. No modo escuro a folha é removida,
// então o visual escuro permanece exatamente como estava.
const ID = "mk-tema-claro";
const MAPA = [
  ["rgb(2, 26, 13)", "#dcfce7"],   // verde
  ["rgb(26, 2, 2)", "#fee2e2"],    // vermelho
  ["rgb(42, 2, 2)", "#fecaca"],    // vermelho forte
  ["rgb(26, 16, 0)", "#fef3c7"],   // âmbar
  ["rgb(18, 10, 46)", "#f3e8ff"],  // roxo
  ["rgb(0, 26, 46)", "#e0f2fe"],   // azul
  ["rgb(2, 5, 16)", "#f1f5f9"],    // campo/aba inativa
  ["rgb(10, 15, 30)", "#e2e8f0"],  // fundo de grade/contador
  ["rgb(4, 20, 31)", "#e0f2fe"],
  ["rgb(26, 26, 16)", "#fef3c7"],
  ["rgb(26, 46, 26)", "#dcfce7"],  // cabeçalho turno diurno
  ["rgb(10, 10, 46)", "#e0e7ff"],  // cabeçalho turno noturno
  ["rgb(10, 26, 46)", "#e0f2fe"],  // cabeçalho ferista
];

// ── Três temas: Lua (escuro), Nuvem (claro neutro) e Sol (claro amarelado) ──
export const TEMAS = ["lua", "nuvem", "sol"];
export const ICONES = { lua: "🌙", nuvem: "☁️", sol: "☀️" };
export const NOMES = { lua: "Lua", nuvem: "Nuvem", sol: "Sol" };
const CHAVE = "mk-tema";
let _atual = "lua";

export function temaSalvo() {
  try { const t = localStorage.getItem(CHAVE); if (TEMAS.includes(t)) return t; } catch {}
  return "lua";
}
export function proximoTema(t) { return TEMAS[(TEMAS.indexOf(t) + 1) % TEMAS.length]; }
// chamado no corpo do App: mantém o ícone dos botões sincronizado já no mesmo render
export function definirTema(t) { _atual = t; }
export function iconeTema() { const t = _atual === "sol" || _atual === "nuvem" ? _atual : "lua"; return createElement("img", { src: `/icones/tema/${t}.svg`, alt: NOMES[t] || t, width: 26, height: 26, draggable: false, style: { display: "block" } }); }
export function tituloTema() { return `Tema ${NOMES[_atual]} — toque para trocar (Lua · Nuvem · Sol)`; }

// Texto em cores vivas (azul-céu, verde, âmbar, vermelho, roxo...) pensado para fundo escuro some no fundo branco/creme:
// no tema claro troca por tons escuros da mesma família (contraste mínimo 4,5:1). Só texto (color), nunca borda/fundo.
const ACENTOS = [
  ["14, 165, 233", "#0369a1"], ["56, 189, 248", "#0369a1"], ["96, 165, 250", "#1d4ed8"], ["59, 130, 246", "#1d4ed8"],
  ["34, 197, 94", "#15803d"], ["74, 222, 128", "#15803d"], ["16, 185, 129", "#047857"],
  ["245, 158, 11", "#b45309"], ["245, 185, 66", "#b45309"], ["251, 191, 36", "#b45309"], ["250, 204, 21", "#854d0e"], ["234, 179, 8", "#854d0e"],
  ["239, 68, 68", "#b91c1c"], ["248, 113, 113", "#b91c1c"],
  ["168, 85, 247", "#7e22ce"], ["192, 132, 252", "#7e22ce"], ["167, 139, 250", "#5b21b6"], ["124, 58, 237", "#5b21b6"],
  ["45, 212, 191", "#0f766e"], ["20, 184, 166", "#0f766e"], ["6, 182, 212", "#0e7490"], ["34, 211, 238", "#0e7490"],
  ["156, 163, 175", "#64748b"],
];
const ACENTOS_CLAROS = ACENTOS.map(([rgb, cor]) => `[style^="color: rgb(${rgb})"],[style*="; color: rgb(${rgb})"]{color:${cor} !important}`);

// Legibilidade no celular (só nos temas claros): letras minúsculas maiores e
// cinzas claros demais escurecidos para dar contraste sobre fundo branco/creme.
const LEGIBILIDADE = [
  '[style*="font-size: 9px"]{font-size:11px !important}',
  '[style*="font-size: 10px"]{font-size:11px !important}',
  '[style^="color: rgb(148, 163, 184)"],[style*="; color: rgb(148, 163, 184)"]{color:#64748b !important}',
  '[style^="color: rgb(203, 213, 225)"],[style*="; color: rgb(203, 213, 225)"]{color:#64748b !important}',
  ...ACENTOS_CLAROS,
].join("\n");

// Sol: troca os neutros frios do claro por creme quente (mesma estrutura, outro tom).
const SOL = [
  'body,[style*="background: rgb(241, 245, 249)"]{background:#fbf4e2 !important}',
  '[style*="background: rgb(255, 255, 255)"]{background:#fffbf0 !important}',
  '[style*="background: rgb(248, 250, 252)"]{background:#f8efd8 !important}',
  '[style*="rgb(226, 232, 240)"]{border-color:#e6d8b4 !important}',
  'input,select,textarea{background-color:#fffdf6 !important}',
].join("\n");

export function aplicarTema(tema) {
  _atual = tema;
  if (typeof document === "undefined") return;
  document.documentElement.dataset.mokedTema = tema;
  try { localStorage.setItem(CHAVE, tema); } catch {}
  let el = document.getElementById(ID);
  if (tema === "lua") { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("style"); el.id = ID; document.head.appendChild(el); }
  const tints = MAPA.map(([rgb, nova]) => `[style*="background: ${rgb}"]{background:${nova} !important}`).join("\n");
  el.textContent = ["body{color:#1e293b}", "svg.mk-ico{filter:none !important}", tints, LEGIBILIDADE, tema === "sol" ? SOL : ""].join("\n");
}
