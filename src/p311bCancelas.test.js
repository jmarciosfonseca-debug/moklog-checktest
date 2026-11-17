// Marcio, 16/11/2026: o P311B não tinha as cancelas na lista do teste semanal. Entram 4 (Cancela / Haste).
import fs from "fs";
import path from "path";
const fonte = fs.readFileSync(path.join(__dirname, "App.jsx"), "utf8");
const bloco = fonte.slice(fonte.indexOf('P311B: {id:"P311B"'), fonte.indexOf('P505: {id:"P505"'));
test("P311B tem a categoria Cancelas / Haste com 4 cancelas", () => {
  expect(bloco).toContain('{id:"cancelas",label:"08B - CANCELAS / HASTE",type:"items",itemLabels:["Cancela 01","Cancela 02","Cancela 03","Cancela 04"]}');
});
test("os outros rótulos do P311B não mudaram (chave das tratativas)", () => {
  expect(bloco).toContain('label:"08 - DILACERADORES"');
  expect(bloco).toContain('label:"09 - LEITORES QR CODE"');
  expect((bloco.match(/\{id:"cancelas"/g) || []).length).toBe(1);
});

// Marcio, 17/11/2026: materiais operacionais não fazem parte do teste semanal do P311B (são equipamento operacional).
test("P311B não tem mais a categoria Materiais Operacionais; os vizinhos seguem iguais", () => {
  expect(bloco).not.toMatch(/\{id:"materiais"/);
  expect(bloco).toContain('label:"09 - LEITORES QR CODE"');
  expect(bloco).toContain('label:"11 - MONITOR CCO CDA (CONTROLE DE ACESSO)"');
});
