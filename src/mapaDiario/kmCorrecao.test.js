import { corrigirKmAnterior, desfazerCorrecaoKm, herdarKmDoUltimoPlantao, kmRodado, kmFinalDoVeiculo, validarParaConcluir, veiculosInteiros, motoTrocadaDesde, substituirMoto, rotuloCorrecaoKm } from "./modelo";
import { kmMotoDoMapa, validarKmMoto } from "../kmMoto";
import { montarTextoWhatsApp } from "./texto";
import { consolidar } from "./consolidado";

const AGORA = new Date("2026-10-18T09:00:00-03:00");
const mapaBase = (veic) => ({ id: "P604_2026-10-18_D", projetoId: "P604", data: "2026-10-18", turno: "D", postos: [], veiculos: veic, material: { semAlteracao: true, excecoes: [] }, resumo: "Sem alteração", visita: { houve: false } });
// Plantão anterior lançou 713300 no lugar de 71330 (erro de digitação).
const ultimoComErro = { id: "P604_2026-10-17_N", data: "2026-10-17", turno: "N", status: "enviado", enviadoEm: "2026-10-17T21:10:00.000Z", veiculos: [{ id: "moto", rotulo: "Moto", kmAnterior: 71290, kmAtual: 713300 }] };

describe("Correção do km anterior (erro de digitação no plantão passado)", () => {
  test("sem correção o mapa não conclui; corrigido, conclui e guarda original, motivo e quem", () => {
    let m = herdarKmDoUltimoPlantao(mapaBase([{ id: "moto", rotulo: "Moto", kmAnterior: null, kmAtual: null }]), ultimoComErro);
    expect(m.veiculos[0]).toMatchObject({ kmAnterior: 713300, kmAnteriorDe: "P604_2026-10-17_N" });
    m = { ...m, veiculos: m.veiculos.map((v) => ({ ...v, kmAtual: "71380" })) };
    expect(validarParaConcluir(m).join(" ")).toContain("km atual menor que o anterior");

    const r = corrigirKmAnterior(m, "moto", { km: "71.330", motivo: "Erro de digitação no plantão anterior", por: "Luiz D.", agora: AGORA });
    expect(r.erros).toEqual([]);
    const v = r.mapa.veiculos[0];
    expect(v).toMatchObject({ kmAnterior: 71330, kmAnteriorOriginal: 713300, correcaoKm: { de: 713300, para: 71330, por: "Luiz D.", em: AGORA.toISOString() } });
    expect(kmRodado(v)).toBe(50);
    expect(validarParaConcluir(r.mapa)).toEqual([]);
    expect(r.mapa.alteracoes).toEqual([expect.objectContaining({ tipo: "correcao-km", de: 713300, para: 71330 })]);
    expect(veiculosInteiros(r.mapa).veiculos[0]).toMatchObject({ kmAnterior: 71330, kmAtual: 71380, correcaoKm: expect.any(Object) });
  });

  test("motivo e km são obrigatórios; igual ao anterior não é correção", () => {
    const m = mapaBase([{ id: "moto", rotulo: "Moto", kmAnterior: 71330, kmAtual: null }]);
    expect(corrigirKmAnterior(m, "moto", { km: "", motivo: "" }).erros.length).toBe(2);
    expect(corrigirKmAnterior(m, "moto", { km: "71330", motivo: "teste" }).erros[0]).toContain("igual");
  });

  test("reabrir o rascunho não desfaz a correção (herança não sobrescreve) e dá para desfazer à mão", () => {
    const m0 = herdarKmDoUltimoPlantao(mapaBase([{ id: "moto", rotulo: "Moto", kmAnterior: null, kmAtual: null }]), ultimoComErro);
    const { mapa } = corrigirKmAnterior(m0, "moto", { km: "71330", motivo: "erro de digitação", agora: AGORA });
    const reaberto = herdarKmDoUltimoPlantao(mapa, ultimoComErro);
    expect(reaberto.veiculos[0].kmAnterior).toBe(71330);
    const desfeito = desfazerCorrecaoKm(reaberto, "moto");
    expect(desfeito.veiculos[0].kmAnterior).toBe(713300);
    expect(desfeito.veiculos[0].correcaoKm).toBeUndefined();
  });

  test("corrigir duas vezes mantém o original do plantão anterior", () => {
    const m0 = mapaBase([{ id: "moto", rotulo: "Moto", kmAnterior: 713300, kmAtual: null }]);
    const a = corrigirKmAnterior(m0, "moto", { km: "71300", motivo: "erro", agora: AGORA }).mapa;
    const b = corrigirKmAnterior(a, "moto", { km: "71330", motivo: "erro, conferido no odômetro", agora: AGORA }).mapa;
    expect(b.veiculos[0]).toMatchObject({ kmAnterior: 71330, kmAnteriorOriginal: 713300, correcaoKm: { de: 713300, para: 71330 } });
  });

  test("plantão do erro: kmAtualCorrigido vence o digitado no rodado, na herança e na trava do cadastro", () => {
    const corrigido = { ...ultimoComErro, veiculos: [{ ...ultimoComErro.veiculos[0], kmAtualCorrigido: 71330 }] };
    expect(kmFinalDoVeiculo(corrigido.veiculos[0])).toBe(71330);
    expect(kmRodado(corrigido.veiculos[0])).toBe(40);                 // e não 641.010 km
    expect(kmRodado(ultimoComErro.veiculos[0])).toBe(642010);         // sem a correção: km irreal
    expect(herdarKmDoUltimoPlantao(mapaBase([{ id: "moto", rotulo: "Moto", kmAnterior: null, kmAtual: null }]), corrigido).veiculos[0].kmAnterior).toBe(71330);
    expect(kmMotoDoMapa(corrigido)).toBe(71330);
    expect(validarKmMoto({ km: "71400" }, kmMotoDoMapa(corrigido)).ok).toBe(true);
    expect(validarKmMoto({ km: "71400" }, kmMotoDoMapa(ultimoComErro)).erro).toContain("Corrigir km anterior");
    expect(consolidar([{ ...corrigido, projetoId: "P604", postos: [] }]).totais.km).toBe(40);
  });

  test("texto do WhatsApp mostra a correção nos dois plantões", () => {
    const { mapa } = corrigirKmAnterior(mapaBase([{ id: "moto", rotulo: "Moto", kmAnterior: 713300, kmAtual: 71380 }]), "moto", { km: "71330", motivo: "erro de digitação", agora: AGORA });
    expect(rotuloCorrecaoKm(mapa.veiculos[0])).toBe("corrigido; era 713300 — erro de digitação");
    expect(montarTextoWhatsApp({ ...mapa, status: "enviado" })).toContain("anterior 71330 (corrigido; era 713300 — erro de digitação) · atual 71380 · rodado 50 km");
    const anterior = { ...mapaBase([{ id: "moto", rotulo: "Moto", kmAnterior: 71290, kmAtual: 713300, kmAtualCorrigido: 71330 }]), status: "enviado" };
    expect(montarTextoWhatsApp(anterior)).toContain("atual 713300 (corrigido depois para 71330) · rodado 40 km");
  });
});

describe("Troca de moto", () => {
  const motoAntiga = { placa: "ABC1D23", modelo: "CG 160", km: 71330, historico: [{ id: "h1", desc: "troca de óleo" }], status: "parcial" };

  test("substituirMoto: antiga vai para o histórico com a baixa; nova começa limpa, do km inicial", () => {
    const r = substituirMoto(motoAntiga, { placa: "xyz-9k88", modelo: "XRE 190", kmInicial: "1.250", motivo: "Moto antiga devolvida à locadora", por: "Luiz D.", agora: AGORA });
    expect(r.erros).toEqual([]);
    expect(r.moto).toMatchObject({ placa: "XYZ-9K88", modelo: "XRE 190", km: 1250, kmInicial: 1250, historico: [], status: "ok", trocadaEm: AGORA.toISOString(), trocadaPor: "Luiz D." });
    expect(r.moto.anteriores).toEqual([expect.objectContaining({ placa: "ABC1D23", historico: [{ id: "h1", desc: "troca de óleo" }], baixa: { em: AGORA.toISOString(), por: "Luiz D.", motivo: "Moto antiga devolvida à locadora", kmFinal: 71330 } })]);
    const de2 = substituirMoto(r.moto, { placa: "QWE4R56", kmInicial: "10", motivo: "outra troca", agora: AGORA });
    expect(de2.moto.anteriores.map((x) => x.placa)).toEqual(["ABC1D23", "XYZ-9K88"]);
    expect(de2.moto.anteriores[1].anteriores).toBeUndefined();     // histórico não se aninha
  });

  test("substituirMoto valida placa, km inicial, motivo e placa repetida", () => {
    expect(substituirMoto(motoAntiga, { placa: "", kmInicial: "", motivo: "" }).erros.length).toBe(3);
    expect(substituirMoto(motoAntiga, { placa: "ABC-1D23", kmInicial: "5", motivo: "teste" }).erros[0]).toContain("igual");
  });

  test("mapa depois da troca: km anterior = km inicial da nova (sem trava) e a placa entra no mapa", () => {
    const nova = substituirMoto(motoAntiga, { placa: "XYZ9K88", kmInicial: "1250", motivo: "troca", agora: AGORA }).moto;
    const ultimo = { ...ultimoComErro, veiculos: [{ id: "moto", rotulo: "Moto", kmAnterior: 71290, kmAtual: 71330 }] };
    expect(motoTrocadaDesde(nova, ultimo)).toBe(true);
    const m = herdarKmDoUltimoPlantao(mapaBase([{ id: "moto", rotulo: "Moto", kmAnterior: null, kmAtual: "1260" }]), ultimo, nova);
    expect(m.veiculos[0]).toMatchObject({ placa: "XYZ9K88", kmAnterior: 1250, kmAnteriorDe: null, trocaMoto: { placaAnterior: "ABC1D23", placaNova: "XYZ9K88" } });
    expect(validarParaConcluir(m)).toEqual([]);
    expect(kmRodado(m.veiculos[0])).toBe(10);
    // Plantão seguinte: o último mapa já tem a placa nova → herança normal.
    const proximoUltimo = { id: "x", enviadoEm: "2026-10-18T21:00:00.000Z", veiculos: [{ id: "moto", rotulo: "Moto", placa: "XYZ9K88", kmAtual: 1300 }] };
    expect(motoTrocadaDesde(nova, proximoUltimo)).toBe(false);
    const m2 = herdarKmDoUltimoPlantao(mapaBase([{ id: "moto", rotulo: "Moto", kmAnterior: null, kmAtual: null }]), proximoUltimo, nova);
    expect(m2.veiculos[0]).toMatchObject({ kmAnterior: 1300, placa: "XYZ9K88" });
    expect(m2.veiculos[0].trocaMoto).toBeUndefined();
  });

  test("sem troca registrada nada muda (retrocompatível); a placa do cadastro só é anotada", () => {
    const ultimo = { ...ultimoComErro, veiculos: [{ id: "moto", rotulo: "Moto", kmAtual: 71330 }] };
    expect(motoTrocadaDesde(motoAntiga, ultimo)).toBe(false);
    const m = herdarKmDoUltimoPlantao(mapaBase([{ id: "moto", rotulo: "Moto", kmAnterior: null, kmAtual: null }]), ultimo, motoAntiga);
    expect(m.veiculos[0]).toMatchObject({ kmAnterior: 71330, placa: "ABC1D23" });
    expect(herdarKmDoUltimoPlantao(mapaBase([{ id: "moto", rotulo: "Moto", kmAnterior: null, kmAtual: null }]), ultimo).veiculos[0].kmAnterior).toBe(71330);
  });

  test("troca de moto mais recente que o último mapa (mapa antigo sem placa) também é detectada", () => {
    const nova = { placa: "XYZ9K88", km: 1250, kmInicial: 1250, trocadaEm: "2026-10-18T08:00:00.000Z" };
    expect(motoTrocadaDesde(nova, { enviadoEm: "2026-10-17T21:00:00.000Z", veiculos: [{ id: "moto", kmAtual: 71330 }] })).toBe(true);
    expect(motoTrocadaDesde(nova, { enviadoEm: "2026-10-18T09:30:00.000Z", veiculos: [{ id: "moto", kmAtual: 1300 }] })).toBe(false);
  });
});

import { itensDeEquipamento } from "./modelo";
test("revisão: categoria toda baixada não volta para a linha genérica da base (sem contagem obrigatória)", () => {
  expect(itensDeEquipamento({ radiosHT: [] }, "P604", "D").some((i) => i.categoria === "radiosHT")).toBe(true);   // nunca teve cadastro: base vale
  expect(itensDeEquipamento({ radiosHT: [], baixados: [{ id: "r1", categoria: "radiosHT" }] }, "P604", "D").some((i) => i.categoria === "radiosHT")).toBe(false);
});
test("revisão: aviso de troca de moto some ao reabrir quando a troca já não vale", () => {
  const nova = { placa: "XYZ9K88", km: 1250, kmInicial: 1250, trocadaEm: "2026-10-18T08:00:00.000Z" };
  const rascunho = mapaBase([{ id: "moto", rotulo: "Moto", placa: "XYZ9K88", kmAnterior: 1250, kmAtual: null, trocaMoto: { placaAnterior: "ABC1D23" } }]);
  const ultimo = { id: "x", enviadoEm: "2026-10-18T09:30:00.000Z", veiculos: [{ id: "moto", rotulo: "Moto", placa: "XYZ9K88", kmAtual: 1300 }] };
  const m = herdarKmDoUltimoPlantao(rascunho, ultimo, nova);
  expect(m.veiculos[0].trocaMoto).toBeUndefined();
  expect(m.veiculos[0].kmAnterior).toBe(1300);
});
