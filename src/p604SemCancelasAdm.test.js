// Marcio, 16/11/2026: as 2 cancelas administrativas saíram do teste semanal do P604; o percentual passa a ignorá-las.
import fs from "fs";
import path from "path";

const fonte = fs.readFileSync(path.join(__dirname, "App.jsx"), "utf8");
const blocoP604 = fonte.slice(fonte.indexOf('P604: {id:"P604"'), fonte.indexOf('P605: {id:"P605"'));

test("P604 não tem mais a categoria de cancelas administrativas", () => {
  expect(blocoP604.length).toBeGreaterThan(500);
  expect(blocoP604).not.toMatch(/\{id:"cancelas_estac"/);
  expect(blocoP604).not.toMatch(/label:"04 - CANCELAS ADM/);
});
test("as cancelas de alta segurança e os demais rótulos continuam iguais (chave das tratativas)", () => {
  expect(blocoP604).toContain('{id:"cancelas_baia",label:"05 - CANCELAS AS (ALTA SEGURAN\\u00c7A)",type:"items",itemLabels:["Cancela 01","Cancela 02","Cancela 03","Cancela 04"]}');
  expect(blocoP604).toContain('label:"03 - AR-CONDICIONADO"');
  expect(blocoP604).toContain('label:"06 - CFTV"');
});
test("o P601 mantém as cancelas administrativas dele", () => {
  expect(fonte).toContain('{id:"cancelas_adm",label:"05 - CANCELAS ADM (ADMINISTRATIVAS)"');
});
