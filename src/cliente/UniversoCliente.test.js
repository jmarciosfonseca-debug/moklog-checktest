import React, { act } from "react";
import { createRoot } from "react-dom/client";
import UniversoCliente, { lerFotoPerfil, gravarFotoPerfil } from "./UniversoCliente";

beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => localStorage.clear());
const montar = async (props) => { const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host); await act(async () => root.render(<UniversoCliente nome="Golgi Cajamar" divisao="MokLog" perfilId="P601" perfilNome="Gestor do parque" itens={[]} {...props} />)); await act(async () => {}); return { host, fim: async () => { await act(async () => root.unmount()); host.remove(); } }; };

test("o cliente entra no universo como parte dele: projeto, divisão e perfil (com a foto guardada) vão para o 3D", async () => {
  gravarFotoPerfil("P601", "data:image/jpeg;base64,AAA");
  let recebido = null; const api = { parar: jest.fn(), foto: jest.fn() };
  const carregar = async () => ({ iniciarUniverso3D: (o) => { recebido = o; return api; } });
  const onAcao = jest.fn(), onInicio = jest.fn();
  const { host, fim } = await montar({ carregar, onAcao, onInicio, itens: [{ id: "teste", nome: "Teste semanal" }] });
  try {
    expect(host.querySelector('[data-testid="universo-cliente"]')).not.toBeNull();
    expect(recebido.dados.cliente).toMatchObject({ nome: "Golgi Cajamar", divisao: "MokLog", eu: { nome: "Gestor do parque", foto: "data:image/jpeg;base64,AAA" } });
    recebido.aoAcao("teste", "pdf"); expect(onAcao).toHaveBeenCalledWith("teste", "pdf");
    recebido.aoInicio(); expect(onInicio).toHaveBeenCalled();
    recebido.aoAcao("eu", "sem-foto"); expect(lerFotoPerfil("P601")).toBe(""); expect(api.foto).toHaveBeenCalledWith(""); expect(onAcao).toHaveBeenCalledTimes(1); // a foto é assunto do universo, não da área
  } finally { await fim(); }
  expect(api.parar).toHaveBeenCalled();
});

test("sem 3D no aparelho: avisa e o Início devolve para a área", async () => {
  const onInicio = jest.fn(); const { host, fim } = await montar({ carregar: async () => ({ iniciarUniverso3D: () => null }), onInicio });
  try { expect(host.textContent).toContain("não abriu o universo 3D"); await act(async () => host.querySelector("button").dispatchEvent(new MouseEvent("click", { bubbles: true }))); expect(onInicio).toHaveBeenCalled(); } finally { await fim(); }
});

test("a foto de cada perfil fica separada (cliente de um projeto não vê a do outro)", () => {
  gravarFotoPerfil("P601", "a"); gravarFotoPerfil("MOKED", "b");
  expect(lerFotoPerfil("P601")).toBe("a"); expect(lerFotoPerfil("MOKED")).toBe("b"); expect(lerFotoPerfil("P602")).toBe("");
});
