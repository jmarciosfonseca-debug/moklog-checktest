import React, { act } from "react";
import { createRoot } from "react-dom/client";
import fs from "fs";
import path from "path";
import Documentos from "./Documentos";
import { DOCUMENTOS, documentosDoProjeto, temDocumentos, urlDoDocumento } from "./catalogo";

global.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const montar = (project, onBack = () => {}) => act(async () => root.render(<Documentos project={project} dark={false} onBack={onBack} />));
const clicar = (el) => act(async () => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

test("todo documento do catálogo existe em public/documentos", () => {
  for (const d of DOCUMENTOS) expect(fs.existsSync(path.join(__dirname, "../../public", d.arquivo))).toBe(true);
});

test("catálogo: Golgi P601–P607 (menos P603, que não existe) com deep link; P505 com MNP e Regulamento; demais sem documento", () => {
  for (const p of ["P601", "P602", "P604", "P605", "P606", "P607"]) {
    expect(documentosDoProjeto(p).map((d) => d.id)).toEqual(["ri-golgi"]);
    expect(urlDoDocumento(documentosDoProjeto(p)[0], p)).toBe(`/documentos/MAN-RI-GOLGI-001_Rev00.html?site=${p}`);
  }
  expect(documentosDoProjeto("P505").map((d) => d.id)).toEqual(["mnp-p505", "ri-p505"]);
  expect(urlDoDocumento(documentosDoProjeto("P505")[0], "P505")).toBe("/documentos/MNP-P505.html");
  expect(temDocumentos("P311A")).toBe(false);
  expect(temDocumentos("P260C")).toBe(false);
});

test("manual Golgi aceita ?site= e todos os códigos de projeto existem nele", () => {
  const html = fs.readFileSync(path.join(__dirname, "../../public/documentos/MAN-RI-GOLGI-001_Rev00.html"), "utf8");
  expect(html).toContain("URLSearchParams(location.search).get('site')");
  for (const p of ["P601", "P602", "P604", "P605", "P606", "P607"]) expect(html).toContain(`"code": "${p}"`);
});

test("um documento só: abre direto, com deep link do projeto; voltar sai do módulo", async () => {
  const onBack = jest.fn();
  await montar({ id: "P602", name: "Golgi Mauá I" }, onBack);
  const f = host.querySelector("iframe");
  expect(f.getAttribute("src")).toBe("/documentos/MAN-RI-GOLGI-001_Rev00.html?site=P602");
  await clicar(host.querySelector('[aria-label="Voltar"]'));
  expect(onBack).toHaveBeenCalled();
});

test("vários documentos (P505): lista, abre um, voltar retorna à lista e só então sai", async () => {
  const onBack = jest.fn();
  await montar({ id: "P505", name: "KLOG" }, onBack);
  expect(host.querySelectorAll('[data-testid="documento-card"]')).toHaveLength(2);
  await clicar(host.querySelectorAll('[data-testid="documento-card"]')[0]);
  expect(host.querySelector("iframe").getAttribute("src")).toBe("/documentos/MNP-P505.html");
  await clicar(host.querySelector('[aria-label="Voltar"]'));
  expect(host.querySelector("iframe")).toBeNull();
  expect(onBack).not.toHaveBeenCalled();
  await clicar(host.querySelector('[aria-label="Voltar"]'));
  expect(onBack).toHaveBeenCalled();
});
