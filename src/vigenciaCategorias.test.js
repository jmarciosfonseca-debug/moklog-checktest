// Marcio, 22/11/2026: o P311B e o P311A deixam de testar "MATERIAIS OPERACIONAIS" (cada equipamento tem relatório próprio) a partir de hoje; o histórico até 21/11 não muda.
import fs from "fs";
import path from "path";
import { categoriaVigente, categoriasVigentes, semCategoriasRetiradas } from "./vigenciaCategorias";

const fonte = fs.readFileSync(path.join(__dirname, "App.jsx"), "utf8");
const bloco = fonte.slice(fonte.indexOf('P311B: {id:"P311B"'), fonte.indexOf('P505: {id:"P505"'));
const blocoA = fonte.slice(fonte.indexOf('P311A: {id:"P311A"'), fonte.indexOf('P311B: {id:"P311B"'));
const proj = { categories: [{ id: "a", label: "01 - A" }, { id: "materiais", label: "10 - M", ate: "2026-11-21" }, { id: "b", label: "11 - B" }] };

test("categoria com `ate`: relatórios até 21/11 mantêm, de 22/11 em diante não têm", () => {
  const cat = proj.categories[1];
  expect(categoriaVigente(cat, "2026-11-15")).toBe(true);
  expect(categoriaVigente(cat, "2026-11-21")).toBe(true);
  expect(categoriaVigente(cat, "2026-11-22")).toBe(false);
  expect(categoriaVigente(cat, "2027-01-03")).toBe(false);
  expect(categoriaVigente(proj.categories[0], "2030-01-01")).toBe(true); // sem `ate` vale sempre
});
test("lista vigente e estado: só relatório de 22/11 em diante perde a categoria; o antigo fica igual", () => {
  expect(categoriasVigentes(proj, "2026-11-22").map((c) => c.id)).toEqual(["a", "b"]);
  expect(categoriasVigentes(proj, "2026-11-08").map((c) => c.id)).toEqual(["a", "materiais", "b"]);
  const st = { a: [{ status: "ok" }], materiais: [{ status: "inop" }], b: [{ status: "ok" }] };
  expect(semCategoriasRetiradas(proj, st, "2026-11-08")).toBe(st); // histórico: mesmo objeto, intocado
  const novo = semCategoriasRetiradas(proj, st, "2026-11-22");
  expect(Object.keys(novo)).toEqual(["a", "b"]);
  expect(Object.keys(st)).toEqual(["a", "materiais", "b"]); // não altera o original
});
test("data inválida ou ausente vale como hoje (relatório novo)", () => {
  expect(categoriaVigente(proj.categories[1], undefined)).toBe(false); // hoje é depois de 21/11/2026
  expect(categoriaVigente(proj.categories[1], "22/11/2026")).toBe(false);
});
test("P311B: só a categoria 10 tem `ate`; rótulos dos demais seguem iguais (chave das tratativas); outros projetos não mudam", () => {
  expect(bloco).toContain('{id:"materiais",label:"10 - MATERIAIS OPERACIONAIS",ate:"2026-11-21",type:"items"');
  expect((bloco.match(/ate:"/g) || []).length).toBe(1);
  for (const r of ['"11 - MONITOR CCO CDA', '"12 - MONITOR CCO CFTV"', '"13 - PORT', '"14 - SDAI', '"15 - SISTEMA KEYACCESS"', '"16 - TOTENS NAS CANCELAS"', '"17 - VISITA', '"18 - INFRAESTRUTURA']) expect(bloco).toContain("label:" + r);
  expect(blocoA).toContain('{id:"materiais",label:"13 - MATERIAIS OPERACIONAIS",ate:"2026-11-21",type:"items"');
  expect((blocoA.match(/ate:"/g) || []).length).toBe(1);
  expect((fonte.match(/ate:"2026-11-21"/g) || []).length).toBe(2); // só P311A e P311B; demais projetos continuam como estavam
});
test("o App usa a vigência ao criar, editar, restaurar rascunho, salvar e desenhar o formulário", () => {
  expect(fonte).toContain("if(!categoriaVigente(cat)) continue; // categoria retirada (ver vigenciaCategorias.js)");
  expect(fonte).toContain("if(!categoriaVigente(cat)) continue; // categoria retirada: não herda do relatório anterior");
  expect(fonte).toContain("if(!categoriaVigente(cat,report.meta?.date)) continue;");
  expect(fonte).toContain("if(!categoriaVigente(cat,draft.meta?.date)) continue;");
  expect(fonte).toContain("st=semCategoriasRetiradas(project,st,mt?.date);");
  expect(fonte).toContain("categoriasVigentes(project,meta.date).map(cat=>{");
});

test("formulário semanal: aviso de servidor fora do ar fica dentro do formWrap (não vira coluna ao lado do formulário)", () => {
  const i = fonte.indexOf("<div style={S.formWrap}>\n        {/* 22/11/2026: o aviso");
  expect(i).toBeGreaterThan(0);
  const j = fonte.indexOf("Servidor não está respondendo</div>");
  expect(j).toBeGreaterThan(i);
  expect(j - i).toBeLessThan(1200); // logo no começo do formWrap
  expect(fonte.slice(i - 400, i)).not.toContain("firestoreDown &&"); // nada solto antes do formWrap
});
