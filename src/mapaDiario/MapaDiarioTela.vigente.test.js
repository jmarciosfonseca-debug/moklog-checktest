import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MapaDiarioTela from "./MapaDiarioTela";

global.IS_REACT_ACT_ENVIRONMENT = true;
// Aba aberta da véspera: a seleção ficou no noturno de 13/10, mas agora é quarta 14/10 às 19:56.
const AGORA = () => new Date("2026-10-14T22:56:00.000Z");
const io = {
  loadColaboradores: async () => [],
  loadMapa: async () => null,
  loadUltimoMapa: async () => null,
  saveMapa: jest.fn(async (m) => ({ ...m, status: "enviado", enviadoEm: AGORA().toISOString() })),
  loadMaterialBase: async () => null,
};

test("mapa fora do plantão em vigor: banner com atalho e Concluir só com confirmação explícita", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  const confirmar = jest.spyOn(window, "confirm").mockReturnValue(false);
  try {
    await act(async () => root.render(<MapaDiarioTela project={{ id: "P311B", name: "Mega CL Itajaí" }} dark onBack={() => {}} io={io} agoraFn={AGORA} />));
    // força a seleção para o plantão de ontem (como uma aba antiga faria)
    const dataInput = host.querySelector('[aria-label="Data do mapa"]');
    await act(async () => { const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value"); d.set.call(dataInput, "2026-10-13"); dataInput.dispatchEvent(new Event("input", { bubbles: true })); });
    const noturno = [...host.querySelectorAll("button")].find((b) => b.textContent === "Noturno");
    await act(async () => noturno.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.textContent).toContain("O plantão em vigor é Quarta-feira, 14/10/2026");
    expect(host.textContent).toContain("Ir para o plantão em vigor");
    const concluirBtn = [...host.querySelectorAll("button")].find((b) => b.textContent.includes("Concluir"));
    if (concluirBtn) {
      await act(async () => concluirBtn.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      expect(confirmar).toHaveBeenCalled();                    // sem OK, nada é gravado no plantão antigo
      expect(io.saveMapa).not.toHaveBeenCalled();
    }
    // atalho leva ao plantão atual e o banner some
    const ir = [...host.querySelectorAll("button")].find((b) => b.textContent === "Ir para o plantão em vigor");
    await act(async () => ir.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(host.textContent).not.toContain("Ir para o plantão em vigor");
  } finally { confirmar.mockRestore(); await act(async () => root.unmount()); host.remove(); }
});
