import { analisarTurno, consolidarRondas, duracaoDaRonda, montarRelatorioTurno, montarConsolidadoRonda, periodoUltimosDias, rotulosColaboradoras } from "./rondaVirtualRelatorio";
import { buildSlots, statusSlot, limiteFinalTurnoMin } from "../rondaVirtualGrade";
const P601 = { id: "P601", name: "Golgi Cajamar" };
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const r = (inicio, fim, extra = {}) => ({ inicio, fim, ...extra });
// turno real de 04/10 (P601 noturno), como no PDF enviado pelo Marcio
const T0410 = { id: "t1", tipo: "noturno", dataInicio: "2026-10-04", plantonista: { id: "w1", nome: "Wanessa", cargo: "Vig CCO" },
  rondas: { "0": r("18:00", "18:06"), "60": r("19:00", "19:07"), "120": r("20:03", "20:08"), "180": r("21:00", "21:07"), "240": r("22:00", "22:00") } };

test("turno em andamento: aguardando ≠ não executada; 0 min sinalizado e fora da média", () => {
  const a = analisarTurno(P601, T0410, new Date("2026-10-04T22:23:00"));
  expect(a.encerrado).toBe(false);
  expect([a.previstas, a.realizadas, a.naoExec, a.pendentes]).toEqual([12, 5, 0, 7]);
  expect(a.inconsistencias).toEqual([{ horario: "22:00", texto: "início igual ao fim (0 min)" }]);
  expect(a.duracoes).toEqual([6, 7, 5, 7]);
});

test("'agora' congelado: o mesmo turno, já encerrado, conta as não executadas (sem justificativa)", () => {
  const a = analisarTurno(P601, { ...T0410, arquivado: true }, new Date("2026-10-06T10:00:00"));
  expect(a.encerrado).toBe(true);
  expect([a.realizadas, a.naoExec, a.semJust, a.pendentes]).toEqual([5, 7, 7, 0]);
});

test("turno aberto preserva o limite estendido do último slot (05:58 ainda é 'aguardando', não 'não executada')", () => {
  const a = analisarTurno(P601, T0410, new Date("2026-10-05T05:58:00"));
  expect(a.encerrado).toBe(false);
  expect(a.linhas[a.linhas.length - 1].grupo).toBe("pendente");
  // e a tela usa o mesmo limite: mesmo status que a função da grade com limiteFinalTurnoMin
  const slots = buildSlots("noturno", "P601"); const ult = slots[slots.length - 1];
  expect(statusSlot(ult, null, 718, null, limiteFinalTurnoMin("noturno", "P601"))).toBe("atraso_aberto");
});

test("duração ancorada no slot e no turno", () => {
  const slots = buildSlots("noturno", "P601"); const s23 = slots.find((s) => s.label === "23:00"), s22 = slots.find((s) => s.label === "22:00");
  expect(duracaoDaRonda(P601, T0410, s23, null, r("23:50", "00:10")).duracao).toBe(20);                    // vira a meia-noite no noturno
  expect(duracaoDaRonda(P601, T0410, s22, null, r("22:00", "21:50")).inconsistencia).toBe("fim anterior ao início"); // não vira "+1 dia"
  const dia = { ...T0410, tipo: "diurno", dataInicio: "2026-10-04" }; const sd = buildSlots("diurno", "P601")[2];
  expect(duracaoDaRonda(P601, dia, sd, null, r("08:10", "08:05")).inconsistencia).toBe("fim anterior ao início");
  expect(duracaoDaRonda(P601, T0410, s22, null, r("22:00", "")).duracao).toBeNull();
});

test("turno arquivado com ronda em andamento é inconsistência objetiva", () => {
  const t = { ...T0410, arquivado: true, rondas: { ...T0410.rondas, "300": { inicio: "23:01" } } };
  const a = analisarTurno(P601, t, new Date("2026-10-06T10:00:00"));
  expect(a.inconsistencias.map((x) => x.texto)).toContain("turno arquivado com ronda em andamento (início sem fim)");
});

const turno = (id, data, p, rondas, extra = {}) => ({ id, tipo: "noturno", dataInicio: data, arquivado: true, plantonista: p, rondas, ...extra });
const A = { id: "a1", nome: "Ana", cargo: "Vig CCO" }, A2 = { id: "a2", nome: "Ana", cargo: "Folguista" }, B = { id: "b1", nome: "Bia", cargo: "Vig CCO" };
const cheias = Object.fromEntries(buildSlots("noturno", "P601").map((s) => [String(s.offsetMin), r(s.label, s.label.replace(/:00$/, ":05"))]));
const TURNOS = [
  turno("x1", "2026-09-28", A, cheias),
  turno("x2", "2026-09-29", B, { "0": r("18:00", "18:05"), "60": r("19:20", "19:30", { atrasada: true, justificativa: "Atendimento na portaria" }) }),
  turno("x3", "2026-09-30", A2, cheias),
  turno("x4", "2026-10-02", B, { "0": r("18:00", "18:05") }),
];
const AGORA = new Date("2026-10-05T12:00:00");

test('atalhos incluem exatamente 7, 15 ou 30 datas até hoje', () => {
  expect(periodoUltimosDias(7, AGORA)).toEqual({ de: '2026-09-29', ate: '2026-10-05' });
  expect(periodoUltimosDias(15, AGORA).de).toBe('2026-09-21');
  expect(periodoUltimosDias(30, AGORA).de).toBe('2026-09-06');
  const c = consolidarRondas(P601, TURNOS, {agora: AGORA, ...periodoUltimosDias(7, AGORA)});
  expect(c.analises.map(a=>a.turno.id)).toEqual(['x2','x3','x4']);
});

test('homônimas com mesmo cargo têm rótulos distintos sem expor ID interno', () => {
  const pessoas = [A, {...A, id:'id-interno-b'}];
  const rotulos = rotulosColaboradoras(pessoas).map(p=>p.rotulo);
  expect(new Set(rotulos).size).toBe(2);
  expect(rotulos.join(' ')).not.toContain('id-interno');
  expect(rotulosColaboradoras([...pessoas].reverse()).map(p=>p.rotulo).reverse()).toEqual(rotulos);
  const c = consolidarRondas(P601, pessoas.map((p,i)=>turno(String(i),'2026-10-03',p,cheias)),{agora:AGORA});
  expect(new Set(c.colaboradoras.map(p=>p.rotulo)).size).toBe(2);
});

test('card de não executadas não atribui atraso sem justificativa a não execução', () => {
  const t = turno('atraso', '2026-10-03', A, {...cheias,'0':r('18:10','18:15',{atrasada:true})});
  const resultado = montarRelatorioTurno(P601,t,{agora:AGORA});
  expect(resultado.analise.naoExec).toBe(0);
  expect(resultado.analise.semJust).toBe(1);
  expect(resultado.analise.semJustAtraso).toBe(1);
  expect(resultado.analise.semJustNaoExec).toBe(0);
  expect(resultado.html).toContain('0 destas sem justificativa registrada');
  expect(montarConsolidadoRonda(P601,[t],{agora:AGORA}).html).toContain('1 em atrasos · 0 em não executadas');
});

test("consolidado: por colaboradora com id estável; homônimas separadas; % só de turnos encerrados", () => {
  const c = consolidarRondas(P601, TURNOS, { agora: AGORA });
  expect(c.colaboradoras.map((p) => p.rotulo)).toEqual(["Ana (Folguista)", "Ana (Vig CCO)", "Bia"]);
  const bia = c.colaboradoras.find((p) => p.nome === "Bia");
  expect([bia.turnos, bia.atraso, bia.comJust, bia.naoExec, bia.semJust]).toEqual([2, 1, 1, 21, 21]);
  expect(Math.round(c.colaboradoras.find((p) => p.chave === "id:a1").execucao)).toBe(100);
  const aberto = consolidarRondas(P601, [{ ...T0410 }], { agora: new Date("2026-10-04T22:23:00") });
  expect(aberto.colaboradoras[0].execucao).toBeNull(); expect(aberto.totais.execucao).toBeNull();
});

test("filtros: período, colaboradoras e tipo; seleção manual intacta", () => {
  expect(consolidarRondas(P601, TURNOS, { agora: AGORA, de: "2026-09-29", ate: "2026-09-30" }).totais.turnos).toBe(2);
  expect(consolidarRondas(P601, TURNOS, { agora: AGORA, colaboradores: ["id:b1"] }).colaboradoras.map((p) => p.nome)).toEqual(["Bia"]);
  expect(consolidarRondas(P601, TURNOS, { agora: AGORA, tipo: "diurno" }).totais.turnos).toBe(0);
  expect(consolidarRondas(P601, TURNOS.slice(0, 2), { agora: AGORA }).totais.turnos).toBe(2);
});

test("PDFs: nomes na versão cliente (decisão do Marcio); conferência só na interna; sem selo de classificação", () => {
  const cli = montarConsolidadoRonda(P601, TURNOS, { agora: AGORA }).html;
  const int = montarConsolidadoRonda(P601, TURNOS, { agora: AGORA, interno: true }).html;
  expect(cli).toContain("Bia"); expect(cli).toContain("Ana (Vig CCO)"); expect(cli).toContain("Comparação por colaboradora");
  expect(cli).not.toContain("Conferência do registro"); expect(int).toContain("Conferência do registro"); expect(int).toContain("VERSÃO INTERNA");
  for (const h of [cli, int]) {
    expect(h).not.toMatch(EMOJI); expect(h).not.toMatch(/neglig/i); expect(h).not.toMatch(/REGULAR|ATENÇÃO|CRÍTICO/);
    expect(h).toContain('counter(page) " de " counter(pages)');
  }
  const t = montarRelatorioTurno(P601, T0410, { agora: new Date("2026-10-04T22:23:00"), interno: true }).html;
  expect(t).toContain("turno em andamento"); expect(t).toContain("22:00 — início igual ao fim (0 min)"); expect(t).not.toMatch(EMOJI);
  expect(montarRelatorioTurno(P601, T0410, { agora: new Date("2026-10-04T22:23:00") }).html).not.toContain("Conferência do registro");
});

test("totais iguais ao consolidado anterior para turnos encerrados (mesmas regras de contagem)", () => {
  const c = consolidarRondas(P601, TURNOS, { agora: AGORA }).totais;
  // regra do gerador anterior (reimplementada aqui como referência): realizada = início e fim; atraso = feita_atrasada;
  // não executada = naoexec | bloqueado; status calculado com o relógio, sem limite estendido (turnos encerrados)
  const ref = { previstas: 0, realizadas: 0, atraso: 0, naoExec: 0 };
  TURNOS.forEach((t) => { const slots = buildSlots(t.tipo, "P601"); const ag = Math.floor((AGORA - new Date(`${t.dataInicio}T18:00:00`)) / 60000);
    slots.forEach((s, i) => { const reg = t.rondas[String(s.offsetMin)] || null; const st = statusSlot(s, slots[i + 1] ? slots[i + 1].offsetMin : null, ag, reg);
      if (reg && reg.inicio && reg.fim) ref.realizadas++; if (st === "feita_atrasada") ref.atraso++; if (st === "naoexec" || st === "bloqueado") ref.naoExec++; });
    ref.previstas += slots.length; });
  expect({ previstas: c.previstas, realizadas: c.noHorario + c.atraso, atraso: c.atraso, naoExec: c.naoExec }).toEqual(ref);
});
