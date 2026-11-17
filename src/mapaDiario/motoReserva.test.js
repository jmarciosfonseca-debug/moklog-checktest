// Pedido dos líderes (17/11/2026): moto principal recolhida para manutenção, moto reserva em uso por vários plantões, retorno da principal ou entrada de outra.
import { novoMapa, kmRodado, iniciarReserva, encerrarReserva, desfazerTrocaNoPlantao, herdarKmDoUltimoPlantao, veiculosInteiros, validarParaConcluir, kmMenorQueAnterior, rotuloReserva, rotuloTrocaNoPlantao, motoTrocadaDesde } from "./modelo";
import { montarTextoWhatsApp } from "./texto";

const AGORA = new Date("2026-11-17T10:00:00-03:00");
const CAD = { placa: "AAA1A11", km: 105058, kmInicial: 90000, trocadaEm: "2026-01-01T00:00:00.000Z" };
const mapaDe = (data, turno, ultimo) => herdarKmDoUltimoPlantao(novoMapa({ projetoId: "P601", data, turno, agora: AGORA }), ultimo, CAD);
const comKm = (m, km) => ({ ...m, veiculos: m.veiculos.map((v) => (v.id === "moto" ? { ...v, kmAtual: String(km) } : v)) });
const enviar = (m, id) => ({ ...veiculosInteiros(m), id, status: "enviado", enviadoEm: `${m.data}T21:00:00.000Z` });
const moto = (m) => m.veiculos.find((v) => v.id === "moto");
const ANTERIOR = { id: "P601_2026-11-16_N", data: "2026-11-16", turno: "N", status: "enviado", enviadoEm: "2026-11-16T09:00:00.000Z", veiculos: [{ id: "moto", rotulo: "Moto", placa: "AAA1A11", kmAnterior: 105000, kmAtual: 105058 }] };

describe("moto reserva", () => {
  test("ciclo completo: principal para manutenção → reserva por dois plantões → principal volta", () => {
    // Plantão 1: a principal parou com 105.058 e a reserva chegou com 100.211.
    let m1 = mapaDe("2026-11-17", "D", ANTERIOR);
    expect(moto(m1).kmAnterior).toBe(105058);
    const r1 = iniciarReserva(m1, "moto", { kmFinalPrincipal: "105058", kmInicialReserva: "100211", placaReserva: "rrr9r99", motivo: "problema mecânico", por: "Líder", agora: AGORA });
    expect(r1.erros).toEqual([]);
    m1 = comKm(r1.mapa, 100251);
    expect(moto(m1)).toMatchObject({ placa: "RRR9R99", reserva: { placa: "RRR9R99", kmInicial: 100211, principal: { placa: "AAA1A11", km: 105058 } } });
    expect(kmRodado(moto(m1))).toBe(40);                       // 0 da principal + 40 da reserva: nada de número negativo
    expect(kmMenorQueAnterior(m1)).toEqual([]);
    expect(validarParaConcluir(m1).filter((e) => /km|moto/i.test(e))).toEqual([]);
    expect(rotuloTrocaNoPlantao(moto(m1))).toContain("a reserva (RRR9R99) chegou com 100211");
    const e1 = enviar(m1, "P601_2026-11-17_D");

    // Plantão 2: a reserva continua, sem o líder fazer nada; o km anterior é o da reserva.
    let m2 = mapaDe("2026-11-17", "N", e1);
    expect(moto(m2)).toMatchObject({ kmAnterior: 100251, placa: "RRR9R99" });
    expect(moto(m2).reserva.kmInicial).toBe(100211);
    expect(moto(m2).trocaNoPlantao).toBeUndefined();
    expect(motoTrocadaDesde(CAD, e1)).toBe(false);             // o cadastro (principal) não "zera" o km da reserva
    m2 = comKm(m2, 100300);
    expect(kmRodado(moto(m2))).toBe(49);
    expect(rotuloReserva(moto(m2))).toBe("moto reserva RRR9R99 em uso desde 17/11 · principal AAA1A11 em manutenção (parou com 105058) · problema mecânico");
    expect(montarTextoWhatsApp(veiculosInteiros(m2), { nome: "Golgi Cajamar" })).toContain("Moto reserva RRR9R99 em uso");
    const e2 = enviar(m2, "P601_2026-11-17_N");

    // Plantão 3: a reserva é recolhida com 100.320 e a principal volta com 105.060.
    let m3 = mapaDe("2026-11-18", "D", e2);
    const r3 = encerrarReserva(m3, "moto", { tipo: "mesma", kmFinalReserva: "100320", kmRetorno: "105060", por: "Líder", agora: AGORA });
    expect(r3.erros).toEqual([]);
    m3 = comKm(r3.mapa, 105100);
    expect(moto(m3).reserva).toBeUndefined();
    expect(moto(m3)).toMatchObject({ placa: "AAA1A11", reservaEncerrada: { placa: "RRR9R99", kmInicial: 100211, kmFinal: 100320, retorno: { tipo: "mesma", km: 105060, placa: "AAA1A11" } } });
    expect(kmRodado(moto(m3))).toBe(20 + 40);                  // 20 da reserva + 40 da principal
    expect(rotuloTrocaNoPlantao(moto(m3))).toContain("a moto principal voltou com 105060");
    const e3 = enviar(m3, "P601_2026-11-18_D");

    // Plantão 4: tudo normal de novo, com a principal.
    const m4 = mapaDe("2026-11-18", "N", e3);
    expect(moto(m4)).toMatchObject({ kmAnterior: 105100, placa: "AAA1A11" });
    expect(moto(m4).reserva).toBeUndefined();
    expect(moto(m4).reservaEncerrada).toBeUndefined();
    // Auditoria: cada mapa enviado guarda o que aconteceu nele.
    expect(moto(e1).trocaNoPlantao.tipo).toBe("reserva"); expect(moto(e2).reserva.placa).toBe("RRR9R99"); expect(moto(e3).reservaEncerrada.kmFinal).toBe(100320);
  });

  test("em vez da mesma moto, vem outra moto principal", () => {
    const e1 = enviar(comKm(iniciarReserva(mapaDe("2026-11-17", "D", ANTERIOR), "moto", { kmInicialReserva: "100211", agora: AGORA }).mapa, 100251), "P601_2026-11-17_D");
    let m2 = mapaDe("2026-11-17", "N", e1);
    const r = encerrarReserva(m2, "moto", { tipo: "nova", kmRetorno: "50", placaNova: "nnn2n22", agora: AGORA });
    m2 = comKm(r.mapa, 90);
    expect(moto(m2)).toMatchObject({ placa: "NNN2N22", trocaNoPlantao: { tipo: "nova-principal", placaNova: "NNN2N22", placaAnterior: "AAA1A11", kmInicialNova: 50 } });
    expect(kmRodado(moto(m2))).toBe(40);
    const e2 = enviar(m2, "P601_2026-11-17_N");
    const m3 = mapaDe("2026-11-18", "D", e2);                  // cadastro ainda na principal antiga: o km do mapa é o que vale
    expect(moto(m3).kmAnterior).toBe(90);
  });

  test("validações e desfazer", () => {
    const m = mapaDe("2026-11-17", "D", ANTERIOR);
    expect(iniciarReserva(m, "moto", { kmInicialReserva: "" }).erros).toHaveLength(1);
    expect(encerrarReserva(m, "moto", { kmRetorno: "1" }).erros).toEqual(["Não há moto reserva em uso."]);
    const r = iniciarReserva(m, "moto", { kmInicialReserva: "100211", placaReserva: "RRR9R99", agora: AGORA });
    expect(moto(r.mapa).reserva.principal.km).toBe(105058);    // sem informar, vale o km anterior da principal
    expect(iniciarReserva(r.mapa, "moto", { kmInicialReserva: "5" }).erros[0]).toContain("Já existe uma moto reserva");
    expect(encerrarReserva(r.mapa, "moto", { kmRetorno: "105060" }).erros[0]).toContain("começou neste mesmo plantão");
    const d = desfazerTrocaNoPlantao(r.mapa, "moto");          // entrou por engano: volta ao que era
    expect(moto(d).reserva).toBeUndefined(); expect(moto(d).placa).toBe("AAA1A11"); expect(moto(d).trocaNoPlantao).toBeUndefined();
    // desfazer a saída devolve a reserva em uso
    const e1 = enviar(comKm(r.mapa, 100251), "P601_2026-11-17_D");
    const m2 = mapaDe("2026-11-17", "N", e1);
    const fim = encerrarReserva(m2, "moto", { kmRetorno: "105060", agora: AGORA });
    expect(encerrarReserva(m2, "moto", { kmRetorno: "" }).erros).toHaveLength(1);
    const volta = desfazerTrocaNoPlantao(fim.mapa, "moto");
    expect(moto(volta).reserva).toMatchObject({ placa: "RRR9R99", kmInicial: 100211 });
    expect(moto(volta).reservaEncerrada).toBeUndefined(); expect(moto(volta).placa).toBe("RRR9R99");
    // rascunho reaberto depois de encerrar: a herança não recoloca a reserva
    expect(moto(herdarKmDoUltimoPlantao(fim.mapa, e1, CAD)).reserva).toBeUndefined();
  });
});

// ---- Cadastro de Equipamentos: a principal fica parada e a reserva entra no histórico ----
describe("cadastro da moto depois de cada mapa", () => {
  const { cadastroDaMotoAposMapa } = require("./modelo");
  test("reserva em uso: principal parada no km da recolhida; km da reserva em reservaAtual", () => {
    const m1 = comKm(iniciarReserva(mapaDe("2026-11-17", "D", ANTERIOR), "moto", { kmFinalPrincipal: "105058", kmInicialReserva: "100211", placaReserva: "RRR9R99", agora: AGORA }).mapa, 100251);
    const c1 = cadastroDaMotoAposMapa(CAD, moto(veiculosInteiros(m1)));
    expect(c1.moto).toMatchObject({ placa: "AAA1A11", km: 105058, reservaAtual: { placa: "RRR9R99", kmInicial: 100211, km: 100251 } });
    // plantão seguinte com a reserva: só o km dela anda
    const m2 = comKm(mapaDe("2026-11-17", "N", enviar(m1, "x1")), 100300);
    const c2 = cadastroDaMotoAposMapa(c1.moto, moto(veiculosInteiros(m2)));
    expect(c2.moto).toMatchObject({ placa: "AAA1A11", km: 105058, reservaAtual: { km: 100300 } });
    // principal volta: reserva vai para o histórico e o km da principal segue do retorno
    const m3 = comKm(encerrarReserva(mapaDe("2026-11-18", "D", enviar(m2, "x2")), "moto", { kmFinalReserva: "100320", kmRetorno: "105060", agora: AGORA }).mapa, 105100);
    const c3 = cadastroDaMotoAposMapa(c2.moto, moto(veiculosInteiros(m3)));
    expect(c3.moto.reservaAtual).toBeUndefined();
    expect(c3.moto).toMatchObject({ placa: "AAA1A11", km: 105100 });
    expect(c3.moto.reservas).toEqual([expect.objectContaining({ placa: "RRR9R99", kmInicial: 100211, kmFinal: 100320, retorno: { tipo: "mesma", km: 105060, placa: "AAA1A11" } })]);
  });
  test("outra moto principal no lugar: a antiga vai para o histórico com a baixa e as reservas ficam guardadas", () => {
    const m1 = comKm(iniciarReserva(mapaDe("2026-11-17", "D", ANTERIOR), "moto", { kmInicialReserva: "100211", agora: AGORA }).mapa, 100251);
    const c1 = cadastroDaMotoAposMapa(CAD, moto(veiculosInteiros(m1)));
    const m2 = comKm(encerrarReserva(mapaDe("2026-11-17", "N", enviar(m1, "x1")), "moto", { tipo: "nova", kmRetorno: "50", placaNova: "NNN2N22", agora: AGORA }).mapa, 90);
    const c2 = cadastroDaMotoAposMapa(c1.moto, moto(veiculosInteiros(m2)));
    expect(c2.trocada).toBe(true);
    expect(c2.moto).toMatchObject({ placa: "NNN2N22", km: 90, kmInicial: 50 });
    expect(c2.moto.anteriores.slice(-1)[0]).toMatchObject({ placa: "AAA1A11", baixa: { kmFinal: 105058 } });
    expect(c2.moto.reservas).toHaveLength(1);
  });
  test("uso normal continua igual: km sobe, não desce, e placa diferente não grava", () => {
    expect(cadastroDaMotoAposMapa(CAD, { id: "moto", placa: "AAA1A11", kmAnterior: 105058, kmAtual: 105100 }).moto.km).toBe(105100);
    expect(cadastroDaMotoAposMapa(CAD, { id: "moto", placa: "AAA1A11", kmAnterior: 105058, kmAtual: 105000 })).toBeNull();
    expect(cadastroDaMotoAposMapa(CAD, { id: "moto", placa: "ZZZ0Z00", kmAnterior: 1, kmAtual: 200000 })).toBeNull();
    expect(cadastroDaMotoAposMapa(CAD, { id: "moto", kmAtual: 105058 })).toBeNull();
    expect(cadastroDaMotoAposMapa(null, { id: "moto", kmAtual: 5 })).toBeNull();
  });
});
