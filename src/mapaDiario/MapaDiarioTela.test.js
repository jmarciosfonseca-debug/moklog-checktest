import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MapaDiarioTela from "./MapaDiarioTela";

global.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

test("esqueleto: mostra projeto, 'Em implantação' e volta sem gravar nada", async () => {
  const onBack = jest.fn();
  await act(async () => root.render(<MapaDiarioTela project={{ id: "P311B", name: "Mega Itajaí B" }} dark onBack={onBack} />));
  expect(host.textContent).toContain("Mapa de Equipe diário");
  expect(host.textContent).toContain("P311B");
  expect(host.textContent).toContain("Em implantação");
  expect(host.textContent).toContain("continue enviando o mapa como hoje");
  await act(async () => host.querySelector('button[aria-label="Voltar"]').click());
  expect(onBack).toHaveBeenCalledTimes(1);
});
