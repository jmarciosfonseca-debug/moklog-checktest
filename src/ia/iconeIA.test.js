import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";
import { BotaoIA } from "./AssistenteIA";
import IconeIA, { ICONE_IA_SRC } from "./IconeIA";

test("o SVG do ícone da IA existe, é um SVG 1024x1024 e não contém script", () => {
  const f = path.join(__dirname, "../../public", ICONE_IA_SRC);
  const svg = fs.readFileSync(f, "utf8");
  expect(svg).toMatch(/<svg[^>]*viewBox="0 0 1024 1024"/);
  expect(svg).not.toMatch(/<script/i);
  expect(svg).not.toMatch(/\bon[a-z]+\s*=/i);
});

test("IconeIA renderiza a imagem no tamanho pedido", () => {
  const html = renderToStaticMarkup(<IconeIA size={40} />);
  expect(html).toContain('src="/icones/ia-moked.svg"');
  expect(html).toContain('width="40"');
});

test("BotaoIA usa o ícone novo (sem emoji) e mantém o rótulo acessível", () => {
  const html = renderToStaticMarkup(<BotaoIA onClick={() => {}} />);
  expect(html).toContain("/icones/ia-moked.svg");
  expect(html).toContain('aria-label="Abrir Assistente IA MokLog"');
  expect(html).not.toContain("✨");
});
