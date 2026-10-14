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
    expect(documentosDoProjeto(p).map((d) => d.id)).toEqual(["ri-golgi", "reverse-control"]);
    expect(urlDoDocumento(documentosDoProjeto(p)[0], p)).toBe(`/documentos/MAN-RI-GOLGI-001_Rev00.html?site=${p}`);
  }
  expect(documentosDoProjeto("P505").map((d) => d.id)).toEqual(["mnp-p505", "ri-p505", "reverse-control"]);
  expect(urlDoDocumento(documentosDoProjeto("P505")[0], "P505")).toBe("/documentos/MNP-P505.html");
});

test("Reverse Control® aparece em TODOS os projetos, sem deep link; o arquivo é autossuficiente", () => {
  for (const p of ["P311A", "P311B", "P260C", "P505", "P601", "P607", "QUALQUER"]) {
    expect(temDocumentos(p)).toBe(true);
    expect(documentosDoProjeto(p).map((d) => d.id)).toContain("reverse-control");
  }
  const rc = DOCUMENTOS.find((d) => d.id === "reverse-control");
  expect(urlDoDocumento(rc, "P311A")).toBe("/documentos/Reverse-Control-MOKED.html");
  const html = fs.readFileSync(path.join(__dirname, "../../public", rc.arquivo), "utf8");
  expect(html).toContain("Reverse Control");
  expect(html).not.toMatch(/(?:src|href)=["']https?:\/\//);   // sem dependência externa: abre offline
});

test("projeto sem outro documento (P311A) abre o Reverse Control direto", async () => {
  await montar({ id: "P311A", name: "Mega CL Curitiba" });
  expect(host.querySelector("iframe").getAttribute("src")).toBe("/documentos/Reverse-Control-MOKED.html");
});

test("manual Golgi aceita ?site= e todos os códigos de projeto existem nele", () => {
  const html = fs.readFileSync(path.join(__dirname, "../../public/documentos/MAN-RI-GOLGI-001_Rev00.html"), "utf8");
  expect(html).toContain("URLSearchParams(location.search).get('site')");
  for (const p of ["P601", "P602", "P604", "P605", "P606", "P607"]) expect(html).toContain(`"code": "${p}"`);
});

test("Golgi: lista os 2 documentos; o Regulamento abre com deep link do projeto; voltar volta à lista e então sai", async () => {
  const onBack = jest.fn();
  await montar({ id: "P602", name: "Golgi Mauá I" }, onBack);
  expect(host.querySelectorAll('[data-testid="documento-card"]')).toHaveLength(2);
  await clicar(host.querySelectorAll('[data-testid="documento-card"]')[0]);
  const f = host.querySelector("iframe");
  expect(f.getAttribute("src")).toBe("/documentos/MAN-RI-GOLGI-001_Rev00.html?site=P602");
  await clicar(host.querySelector('[aria-label="Voltar"]'));
  expect(onBack).not.toHaveBeenCalled();
  await clicar(host.querySelector('[aria-label="Voltar"]'));
  expect(onBack).toHaveBeenCalled();
});

test("vários documentos (P505): lista, abre um, voltar retorna à lista e só então sai", async () => {
  const onBack = jest.fn();
  await montar({ id: "P505", name: "KLOG" }, onBack);
  expect(host.querySelectorAll('[data-testid="documento-card"]')).toHaveLength(3);
  await clicar(host.querySelectorAll('[data-testid="documento-card"]')[0]);
  expect(host.querySelector("iframe").getAttribute("src")).toBe("/documentos/MNP-P505.html");
  await clicar(host.querySelector('[aria-label="Voltar"]'));
  expect(host.querySelector("iframe")).toBeNull();
  expect(onBack).not.toHaveBeenCalled();
  await clicar(host.querySelector('[aria-label="Voltar"]'));
  expect(onBack).toHaveBeenCalled();
});
