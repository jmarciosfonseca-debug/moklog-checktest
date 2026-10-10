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
export function aplicarTemaClaro(claro) {
  if (typeof document === "undefined") return;
  let el = document.getElementById(ID);
  if (!claro) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("style"); el.id = ID; document.head.appendChild(el); }
  el.textContent = MAPA.map(([rgb, nova]) => `[style*="background: ${rgb}"]{background:${nova} !important}`).join("\n");
}
