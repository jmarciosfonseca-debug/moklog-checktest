import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MostradorSIS from "./MostradorSIS";
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });

const montar = async (el) => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  await act(async () => root.render(el));
  return { m: host.querySelector('[data-testid="mostrador-sis"]'), fim: () => { act(() => root.unmount()); host.remove(); } };
};

test("modo valor mostra o percentual e anuncia o valor", async () => {
  const { m, fim } = await montar(<MostradorSIS mini valor={87} />);
  expect(m.getAttribute("aria-label")).toBe("SIS 87%");
  expect(m.textContent).toContain("87%"); fim();
});

test("sem dado não inventa número", async () => {
  const { m, fim } = await montar(<MostradorSIS mini valor={null} />);
  expect(m.getAttribute("aria-label")).toBe("Sem dados");
  expect(m.textContent).toBe("—");
  expect(m.className).toContain("vazio"); fim();
});

test("modo scan é decorativo: sem percentual", async () => {
  const { m, fim } = await montar(<MostradorSIS scan />);
  expect(m.className).toContain("scan");
  expect(m.textContent).not.toMatch(/\d+%/);
  expect(m.textContent).toContain("SIS"); fim();
});

test("valor fora de 0–100 é limitado", async () => {
  const { m, fim } = await montar(<MostradorSIS mini valor={140} />);
  expect(m.textContent).toContain("100%"); fim();
});

test("anel fino é variante do mesmo mostrador e a lista de projetos do grupo usa", async () => {
  const { m, fim } = await montar(<MostradorSIS mini fino valor={72} />);
  expect(m.className).toContain("fino");
  expect(m.textContent).toContain("72%"); fim();
  const app = require("fs").readFileSync("src/App.jsx", "utf8");
  expect(app).toContain("<MostradorSIS mini fino tamanho={52} valor={h.pct}");
});
