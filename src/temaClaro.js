import { createElement } from "react";
import { Ico } from "./Icones";
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
export function iconeTema() { return createElement(Ico, { n: _atual === "sol" || _atual === "nuvem" ? _atual : "lua" }); }
export function tituloTema() { return `Tema ${NOMES[_atual]} — toque para trocar (Lua · Nuvem · Sol)`; }

// Legibilidade no celular (só nos temas claros): letras minúsculas maiores e
// cinzas claros demais escurecidos para dar contraste sobre fundo branco/creme.
const LEGIBILIDADE = [
  '[style*="font-size: 9px"]{font-size:11px !important}',
  '[style*="font-size: 10px"]{font-size:11px !important}',
  '[style^="color: rgb(148, 163, 184)"],[style*="; color: rgb(148, 163, 184)"]{color:#64748b !important}',
  '[style^="color: rgb(203, 213, 225)"],[style*="; color: rgb(203, 213, 225)"]{color:#64748b !important}',
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
  try { localStorage.setItem(CHAVE, tema); } catch {}
  let el = document.getElementById(ID);
  if (tema === "lua") { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("style"); el.id = ID; document.head.appendChild(el); }
  const tints = MAPA.map(([rgb, nova]) => `[style*="background: ${rgb}"]{background:${nova} !important}`).join("\n");
  el.textContent = ["body{color:#1e293b}", tints, LEGIBILIDADE, tema === "sol" ? SOL : ""].join("\n");
}
