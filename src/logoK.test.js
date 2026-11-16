// Marcio, 16/11/2026: o "K" de MOKED parecia um "X" nos PDFs. O K tem haste cheia à esquerda e dois braços; vale para as duas versões do logo.
import fs from "fs";
import path from "path";
import { logoMokedSVG, LOGO_MOKED_OFICIAL, LOGO_MOKED_OFICIAL_ESCURO } from "./logoOficial";

test("o K é a letra redesenhada (haste + dois braços), não os dois arcos antigos", () => {
  const svg = logoMokedSVG("claro");
  expect(svg).toContain('<g data-letra="K"><rect x="1198" y="11"');
  expect((svg.match(/data-letra="K"/g) || []).length).toBe(1);
  expect(svg).not.toContain("__NEUTRO__");
});
test("no fundo escuro o K inteiro fica branco, junto com o resto do nome", () => {
  const svg = logoMokedSVG("escuro");
  const k = svg.slice(svg.indexOf('<g data-letra="K">'), svg.indexOf("</g></g>") + 8);
  expect(k).toContain('fill="#ffffff"');
  expect(k).toContain('stroke="#ffffff"');
  expect(k).not.toContain("#000000");
  expect(svg).not.toContain("__NEUTRO__");
  expect(decodeURIComponent(LOGO_MOKED_OFICIAL_ESCURO)).toContain(k);
  expect(decodeURIComponent(LOGO_MOKED_OFICIAL)).toContain('data-letra="K"');
});
test("os arquivos estáticos do logo são a mesma arte corrigida", () => {
  const ler = (f) => fs.readFileSync(path.join(__dirname, "..", "public", "moked", f), "utf8");
  expect(ler("logo-moked.svg")).toBe(logoMokedSVG("claro"));
  expect(ler("logo-moked-escuro.svg")).toBe(logoMokedSVG("escuro"));
});
