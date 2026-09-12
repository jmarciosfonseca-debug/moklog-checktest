// ─────────────────────────────────────────────────────────────
// gerenciaisConfig.test.js — Teste anti-órfão REAL de recursos gerenciais.
//
// Diferente da versão anterior (que só comparava listas manuais), este
// teste LÊ o App.jsx de verdade e garante, para cada recurso habilitado
// no registro, que:
//   (a) existe o mapeamento de ação  r.id==="<id>" ? <algo> : ...
//   (b) o ramo verdadeiro NÃO é null (senão o botão não renderiza → órfão)
//   (c) o registro é renderizado via recursosHabilitados().map(...)
//
// Assim, se alguém remover o botão/ação da Visão 360 do App.jsx, o teste
// FALHA no build — a regressão que deixou a Visão 360 órfã não volta.
// ─────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { RECURSOS_GERENCIAIS, recursosHabilitados, isRecursoGerencial } from "./gerenciaisConfig";

function lerAppJsx() {
  // Resolve o App.jsx irmão deste arquivo (src/).
  const p = path.resolve(__dirname, "App.jsx");
  return fs.readFileSync(p, "utf8");
}

export function run() {
  let pass = 0, fail = 0;
  const ok = (n, c) => { c ? pass++ : (fail++, console.log("FAIL:", n)); };

  const app = lerAppJsx();

  // 0) O App.jsx renderiza os recursos a partir do registro (não hardcoded).
  ok("App.jsx usa recursosHabilitados().map",
     /recursosHabilitados\(\)\s*\.\s*map/.test(app));

  // Para cada recurso HABILITADO, o App.jsx precisa ter o mapeamento de ação
  // e o ramo verdadeiro não pode ser null.
  for (const r of recursosHabilitados()) {
    // Procura  r.id==="<id>" ? <acao> : ...   (com aspas simples ou duplas)
    const re = new RegExp(
      'r\\.id\\s*===\\s*["\']' + r.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '["\']\\s*\\?\\s*([A-Za-z0-9_$]+)',
      "m"
    );
    const m = app.match(re);
    ok(`'${r.id}' tem mapeamento de ação no App.jsx`, !!m);
    if (m) {
      const acao = m[1];
      ok(`'${r.id}' ação não é null (botão renderiza)`, acao !== "null" && acao !== "undefined");
      // A função-ação precisa existir no App.jsx (declarada em algum lugar).
      const declarada = new RegExp("(const|function)\\s+" + acao + "\\b").test(app);
      ok(`'${r.id}' ação '${acao}' está declarada no App.jsx`, declarada);
    }
  }

  // Coerência do registro.
  const ids = RECURSOS_GERENCIAIS.map(r => r.id);
  ok("ids únicos no registro", ids.length === new Set(ids).size);
  for (const r of RECURSOS_GERENCIAIS) {
    ok(`'${r.id}' tem label e ícone`, !!r.label && !!r.icone);
  }
  ok("visao-360 registrada e habilitada", isRecursoGerencial("visao-360"));

  console.log(`\n${pass} passaram, ${fail} falharam`);
  return fail === 0;
}

if (typeof require !== "undefined" && require.main === module) {
  process.exit(run() ? 0 : 1);
}
