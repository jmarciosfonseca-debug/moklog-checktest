import { validarQuadrante } from "./iluminacaoValida";
import fs from "fs";
import path from "path";

test("deficientes maior que os pontos avisa e não grava (nada é cortado em silêncio)", () => {
  expect(validarQuadrante({ nome: "A1", total: "42", deficientes: "50" }).erro).toBe("Deficientes não pode ser maior que os pontos (42). Corrija um dos dois números.");
  expect(validarQuadrante({ nome: "A1", total: "42", deficientes: "42" })).toEqual({ nome: "A1", total: 42, deficientes: 42 });
  expect(validarQuadrante({ nome: "", total: "5", deficientes: "0" }).erro).toMatch(/nome/);
  expect(validarQuadrante({ nome: "A1", total: "0", deficientes: "0" }).erro).toMatch(/pontos de iluminação/);
  expect(validarQuadrante({ nome: " a1 ", total: "5", deficientes: "1" }, [{ id: "x", nome: "A1" }], "y").erro).toMatch(/Já existe/);
  expect(validarQuadrante({ nome: "A1", total: "5", deficientes: "1" }, [{ id: "x", nome: "A1" }], "x").total).toBe(5);
});

test("Perimetral e Ronda não têm nome de projeto fixo na interface", () => {
  ["Perimetral.jsx", "RondaDiaria.jsx"].forEach((f) => {
    const p = path.join(__dirname, f);
    if (!fs.existsSync(p)) return;
    const src = fs.readFileSync(p, "utf8").replace(/MAPA_B64_\w+\s*=\s*"[^"]*"/g, "");
    expect(src).not.toMatch(/>\s*P\d{3}[AB]?\s*·\s*(Klog|Golgi|Mega|Jatinox)/);
  });
});
