import React, { act } from "react";
import { createRoot } from "react-dom/client";

// Sessão de DEMONSTRAÇÃO: o fireGuard finge gravar, então a tela precisa avisar — senão o líder manda
// o WhatsApp achando que concluiu e o painel gerencial fica "Pendente" (bug de campo 15/10, P505/P607).
jest.mock("../session", () => ({ isDemo: () => true, authFetchEquipe: jest.fn() }));
const MapaDiarioTela = require("./MapaDiarioTela").default;

global.IS_REACT_ACT_ENVIRONMENT = true;
const AGORA = () => new Date("2026-10-15T10:30:00.000Z"); // quinta 15/10, 07:30 em Brasília (diurno em vigor)
const io = {
  loadColaboradores: async () => [],
  loadMapa: async () => null,
  loadUltimoMapa: async () => null,
  saveMapa: jest.fn(async (m) => ({ ...m })),
  loadMaterialBase: async () => null,
};

test("em demonstração a tela avisa que nada é gravado no banco", async () => {
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<MapaDiarioTela project={{ id: "P505", name: "Klog Guarulhos" }} dark onBack={() => {}} io={io} agoraFn={AGORA} />));
    expect(host.textContent).toContain("DEMONSTRAÇÃO");
    expect(host.textContent).toContain("nada é gravado no banco");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
