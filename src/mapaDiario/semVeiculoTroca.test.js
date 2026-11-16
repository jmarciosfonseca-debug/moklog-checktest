// Marcio, 16/11/2026: "Sem veículo" some com o bloco e nada de km é cobrado; veículo trocado no meio do plantão não trava o mapa.
import { novoMapa, validarParaConcluir, kmRodado, marcarSemVeiculo, semVeiculo, registrarTrocaNoPlantao, desfazerTrocaNoPlantao, rotuloTrocaNoPlantao, kmMenorQueAnterior, herdarKmDoUltimoPlantao, veiculosInteiros, motoTrocadaDesde, rodadoAlto } from "./modelo";
import { montarTextoWhatsApp } from "./texto";

const AGORA = new Date("2026-11-16T10:00:00-03:00");
const base = () => {
  const m = novoMapa({ projetoId: "P601", data: "2026-11-16", turno: "D", agora: AGORA });
  return { ...m, postos: m.postos.map((p, i) => ({ ...p, pessoaId: `c${i}`, pessoaNome: `Pessoa ${i}` })), resumo: "Sem alteração", visita: { houve: false }, material: { ...m.material, semAlteracao: true } };
};
const errosDeVeiculo = (m) => validarParaConcluir(m).filter((e) => /moto|ve[ií]culo|km/i.test(e));

describe("sem veículo no plantão", () => {
  test("sem a marca, o km da moto é obrigatório; com a marca, não é", () => {
    const m = base();
    expect(errosDeVeiculo(m).join(" ")).toContain("Moto: informe a quilometragem atual");
    const s = marcarSemVeiculo(m, true, { por: "Líder", agora: AGORA });
    expect(semVeiculo(s)).toBe(true);
    expect(errosDeVeiculo(s)).toEqual([]);
  });
  test("ao enviar sem veículo não vai km; o texto diz 'Sem veículo'", () => {
    let m = base();
    m = { ...m, veiculos: m.veiculos.map((v) => ({ ...v, kmAnterior: 1000, kmAtual: "900" })) };
    m = marcarSemVeiculo(m, true, { agora: AGORA });
    expect(kmMenorQueAnterior(m)).toEqual([]);
    expect(rodadoAlto(m)).toEqual([]);
    const f = veiculosInteiros(m);
    expect(f.veiculos[0].kmAtual).toBeNull();
    expect(f.veiculos[0].kmAnterior).toBe(1000);
    expect(montarTextoWhatsApp(f, { nome: "Golgi Cajamar" })).toContain("Sem veículo neste plantão");
  });
  test("a marca passa para o próximo plantão e pode ser desfeita", () => {
    const ultimo = { id: "P601_2026-11-15_N", data: "2026-11-15", turno: "N", status: "enviado", semVeiculo: { em: "x", por: "Líder" }, veiculos: [{ id: "moto", rotulo: "Moto", kmAnterior: 1000, kmAtual: null }] };
    const h = herdarKmDoUltimoPlantao(base(), ultimo);
    expect(semVeiculo(h)).toBe(true);
    expect(h.semVeiculo.herdado).toBe(true);
    expect(h.veiculos[0].kmAnterior).toBe(1000);                        // quando voltar a ter veículo, o km anterior continua certo
    const d = marcarSemVeiculo(h, false);
    expect(semVeiculo(herdarKmDoUltimoPlantao(d, ultimo))).toBe(false); // desmarcado à mão: a herança não remarca
  });
});

describe("veículo trocado no meio do plantão", () => {
  const comKm = (kmAnterior, kmAtual) => { const m = base(); return { ...m, veiculos: m.veiculos.map((v) => ({ ...v, placa: "AAA1A11", kmAnterior, kmAtual })) }; };

  test("km menor que o anterior não bloqueia: só entra na lista de confirmação", () => {
    const m = comKm(50000, "12080");
    expect(errosDeVeiculo(m)).toEqual([]);
    expect(kmMenorQueAnterior(m)).toHaveLength(1);
  });
  test("troca apontada: rodado soma os dois trechos e nada fica a confirmar", () => {
    const r = registrarTrocaNoPlantao(comKm(50000, "12080"), "moto", { kmFinalAnterior: "50.030", kmInicialNova: "12000", placaNova: "bbb2b22", motivo: "moto quebrou", por: "Líder", agora: AGORA });
    expect(r.erros).toEqual([]);
    const v = r.mapa.veiculos[0];
    expect(kmRodado(v)).toBe(30 + 80);
    expect(v.placa).toBe("BBB2B22");
    expect(v.trocaNoPlantao.placaAnterior).toBe("AAA1A11");
    expect(kmMenorQueAnterior(r.mapa)).toEqual([]);
    expect(errosDeVeiculo(r.mapa)).toEqual([]);
    expect(rotuloTrocaNoPlantao(v)).toContain("começou em 12000");
    expect(montarTextoWhatsApp(veiculosInteiros(r.mapa), { nome: "Golgi Cajamar" })).toContain("rodado 110 km");
  });
  test("sem o km final do veículo que saiu, conta só o trecho do novo", () => {
    const r = registrarTrocaNoPlantao(comKm(50000, "12080"), "moto", { kmInicialNova: "12000", agora: AGORA });
    expect(kmRodado(r.mapa.veiculos[0])).toBe(80);
    expect(r.mapa.veiculos[0].placa).toBe("AAA1A11"); // placa não informada: fica a que estava
  });
  test("km inicial do novo é o único campo obrigatório; desfazer devolve a placa", () => {
    const m = comKm(50000, "12080");
    expect(registrarTrocaNoPlantao(m, "moto", { kmInicialNova: "" }).erros).toHaveLength(1);
    const r = registrarTrocaNoPlantao(m, "moto", { kmInicialNova: "12000", placaNova: "BBB2B22", agora: AGORA });
    const d = desfazerTrocaNoPlantao(r.mapa, "moto");
    expect(d.veiculos[0].trocaNoPlantao).toBeUndefined();
    expect(d.veiculos[0].placa).toBe("AAA1A11");
  });
  test("o plantão seguinte herda o km do veículo novo, mesmo com o cadastro ainda na moto antiga", () => {
    const r = registrarTrocaNoPlantao(comKm(50000, "12080"), "moto", { kmInicialNova: "12000", placaNova: "BBB2B22", agora: AGORA });
    const ultimo = { ...veiculosInteiros(r.mapa), status: "enviado", enviadoEm: "2026-11-16T21:00:00.000Z" };
    const cadastroAntigo = { placa: "AAA1A11", km: 50000, kmInicial: 40000, trocadaEm: "2026-01-01T00:00:00.000Z" };
    expect(motoTrocadaDesde(cadastroAntigo, ultimo)).toBe(false);
    const prox = herdarKmDoUltimoPlantao(novoMapa({ projetoId: "P601", data: "2026-11-16", turno: "N", agora: AGORA }), ultimo, cadastroAntigo);
    expect(prox.veiculos[0].kmAnterior).toBe(12080);
    expect(prox.veiculos[0].trocaNoPlantao).toBeUndefined();
  });
});

// ---- Tela: os botões aparecem e funcionam ----
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MapaDiarioTela from "./MapaDiarioTela";
jest.mock("firebase/app", () => ({ getApps: () => [] }));
jest.mock("firebase/firestore", () => ({ getFirestore: () => ({}), doc: jest.fn(), getDoc: jest.fn(), getDocFromServer: jest.fn(), collection: jest.fn(), getDocs: jest.fn(), query: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), where: jest.fn(), onSnapshot: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;

test("tela: 'Sem veículo neste plantão' esconde o km e 'Tem veículo' devolve; troca abre o formulário", async () => {
  const io = { loadColaboradores: jest.fn(async () => []), loadMapa: jest.fn(async () => null), loadUltimoMapa: jest.fn(async () => null), loadUltimoPlantao: jest.fn(async () => null), loadEquipamentos: jest.fn(async () => ({})), loadUltimaVisita: jest.fn(async () => null), saveMapa: jest.fn(async (m) => m), enviarMapa: jest.fn(async (m) => m) };
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  await act(async () => root.render(<MapaDiarioTela project={{ id: "P601", name: "Golgi Cajamar" }} dark onBack={() => {}} io={io} agoraFn={() => AGORA} />));
  for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
  const botao = (t) => [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === t);
  const clicar = (b) => act(async () => b.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(host.querySelector('input[aria-label="Km atual Moto"]')).not.toBeNull();
  await clicar(host.querySelector('button[aria-label="Troquei de veículo neste plantão Moto"]'));
  expect(host.querySelector('[data-testid="troca-veiculo"]')).not.toBeNull();
  await clicar(botao("Sem veículo neste plantão"));
  expect(host.querySelector('input[aria-label="Km atual Moto"]')).toBeNull();
  expect(host.querySelector('[data-testid="sem-veiculo"]')).not.toBeNull();
  await clicar(botao("Tem veículo"));
  expect(host.querySelector('input[aria-label="Km atual Moto"]')).not.toBeNull();
  await act(async () => root.unmount()); host.remove();
});
