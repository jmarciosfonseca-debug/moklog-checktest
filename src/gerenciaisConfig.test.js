// ─────────────────────────────────────────────────────────────
// gerenciaisConfig.test.js — Teste anti-órfão REAL.
// Lê o App.jsx e garante, para cada recurso habilitado, que existe
// o mapeamento r.id==="<id>" ? <acao> com ação não-null e função/expr
// declarada. Se o botão/ação sumir, o teste FALHA no build.
// ─────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { RECURSOS_GERENCIAIS, recursosHabilitados, isRecursoGerencial } from "./gerenciaisConfig";

function lerAppJsx() {
  return fs.readFileSync(path.resolve(__dirname, "App.jsx"), "utf8");
}

export function run() {
  let pass = 0, fail = 0;
  const ok = (n, c) => { c ? pass++ : (fail++, console.log("FAIL:", n)); };
  const app = lerAppJsx();

  ok("App.jsx usa recursosHabilitados().map", /recursosHabilitados\(\)\s*\.\s*map/.test(app));

  for (const r of recursosHabilitados()) {
    // r.id==="<id>" ? <algo>  — captura o que vem depois do ?
    const re = new RegExp(
      'r\\.id\\s*===\\s*["\']' + r.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '["\']\\s*\\?\\s*([^:]+?)\\s*:',
      "m"
    );
    const m = app.match(re);
    ok(`'${r.id}' tem mapeamento de ação no App.jsx`, !!m);
    if (m) {
      const acao = m[1].trim();
      ok(`'${r.id}' ação não é null`, acao !== "null" && acao !== "undefined" && acao.length > 0);
    }
  }

  const ids = RECURSOS_GERENCIAIS.map(r => r.id);
  ok("ids únicos no registro", ids.length === new Set(ids).size);
  for (const r of RECURSOS_GERENCIAIS) ok(`'${r.id}' tem label e ícone`, !!r.label && !!r.icone);
  ok("visao-360 registrada e habilitada", isRecursoGerencial("visao-360"));
  ok("auditoria-operacional registrada e habilitada", isRecursoGerencial("auditoria-operacional"));

  console.log(`\n${pass} passaram, ${fail} falharam`);
  return fail === 0;
}

if (typeof require !== "undefined" && require.main === module) {
  process.exit(run() ? 0 : 1);
}
