#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   fix_contraste_App.js — MokLog CheckTest
   Corrige contraste de TEXTO e tamanhos de fonte no App.jsx.

   COMO USAR:
     1) Coloque este arquivo na mesma pasta do seu App.jsx (ex.: src/)
     2) Rode:  node fix_contraste_App.js App.jsx
     3) Ele cria App.jsx.bak (backup) e regrava App.jsx corrigido.
     4) Faça o build/deploy normalmente. Se algo estranhar, restaure o .bak.

   O QUE ELE FAZ (e só isso):
     • Troca cores de TEXTO fracas (#334155 / #1e293b) por #94a3b8, APENAS
       quando aparecem como `color:"..."` — nunca em border/background.
     • Sobe alguns fontSize:9 → 10 em textos de informação.
   NÃO mexe em: bordas, fundos, gradientes, cores de marca, lógica, PINs.
   ════════════════════════════════════════════════════════════════════════ */

const fs = require("fs");

const file = process.argv[2] || "App.jsx";
if (!fs.existsSync(file)) {
  console.error("✗ Arquivo não encontrado:", file);
  console.error("  Uso: node fix_contraste_App.js App.jsx");
  process.exit(1);
}

let code = fs.readFileSync(file, "utf8");
const original = code;
let trocas = 0;
const log = [];

function aplica(desc, regex, repl) {
  const antes = code;
  let n = 0;
  code = code.replace(regex, (...args) => { n++; return repl(...args); });
  if (n > 0) { trocas += n; log.push(`  ✓ ${desc}: ${n}x`); }
  else log.push(`  · ${desc}: 0 (nada a trocar)`);
}

// ── 1) COR DE TEXTO: color:"#334155" → color:"#94a3b8"
// Só casa quando a chave é exatamente `color`, com aspas simples ou duplas.
aplica(
  'color "#334155" → "#94a3b8" (texto fraco)',
  /color:(\s*)(["'])#334155\2/g,
  (_m, sp, q) => `color:${sp}${q}#94a3b8${q}`
);

// ── 2) COR DE TEXTO: color:"#1e293b" → color:"#94a3b8"
// IMPORTANTÍSSIMO: só troca quando é `color:`. Onde #1e293b é borda
// (border:"1px solid #1e293b") NÃO casa, porque ali a chave não é `color`.
aplica(
  'color "#1e293b" → "#94a3b8" (texto quase invisível)',
  /color:(\s*)(["'])#1e293b\2/g,
  (_m, sp, q) => `color:${sp}${q}#94a3b8${q}`
);

// ── 3) FONTE: subir fontSize:9 → 10 (informação pequena demais)
// Casa fontSize:9 não seguido de outro dígito (para não pegar 90, etc.)
aplica(
  'fontSize:9 → 10 (legibilidade mobile)',
  /fontSize:(\s*)9(?!\d)/g,
  (_m, sp) => `fontSize:${sp}10`
);

// ── Relatório (ReportScreen): o <pre> usa color:"#1e293b" sobre fundo claro
// (#f8fafc). Esse caso é LEGÍVEL (texto escuro em fundo claro) e NÃO deve
// virar cinza. Por isso restauramos esse ponto específico, se foi trocado.
// Identificação pelo contexto do <pre> com fundo claro.
code = code.replace(
  /(fontFamily:"'Courier New',monospace"[^}]*color:)(["'])#94a3b8\2/g,
  (_m, pre, q) => `${pre}${q}#1e293b${q}`
);
if (original.includes("'Courier New'")) {
  log.push("  ↩ <pre> do relatório (fundo claro): cor escura preservada");
}

// ── Confirmação modal (fundo claro quando dark=false): há textos que usam
// dark?"#f1f5f9":"#1e293b" — esses são TERNÁRIOS e a regex acima NÃO casa
// (porque o valor não é literal "#1e293b" logo após color:, e sim uma
// expressão). Então estão naturalmente protegidos. Nada a fazer.

if (trocas === 0) {
  console.log("Nenhuma troca aplicada — talvez já esteja corrigido.");
  process.exit(0);
}

// Backup + gravação
fs.writeFileSync(file + ".bak", original, "utf8");
fs.writeFileSync(file, code, "utf8");

console.log("════════════════════════════════════════");
console.log(" Correção de contraste/fontes — App.jsx");
console.log("════════════════════════════════════════");
log.forEach(l => console.log(l));
console.log("----------------------------------------");
console.log(` Total de trocas: ${trocas}`);
console.log(` Backup salvo em: ${file}.bak`);
console.log(" Revise no navegador. Para reverter: mv "+file+".bak "+file);
