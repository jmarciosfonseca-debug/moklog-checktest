// Mapa de Equipe diário — postos de cada projeto e "puxar a equipe do líder" (puro).
// Os postos seguem a hierarquia que o Marcio definiu por projeto. `cargos` diz quais cargos do cadastro de
// Equipe cabem no posto (para puxar a equipe montada pelo líder). `legado` = rótulos antigos, só para
// aproveitar mapas já gravados.
import { diaDaSemana } from "./regras";

const LIDER = ["VSPP Líder", "Vigilante Líder"];
const CCO = ["Vig CCO", "Porteiro CCO"];
const APOIO = ["VSPP Apoio", "Vigilante Apoio"];
const VIG = ["Vigilante", "VSPP Apoio", "Vigilante Apoio"];
const h0820 = { inicio: "08:00", fim: "20:00" };

const P = (rotulo, cargos, extra = {}) => ({ rotulo, cargos, ...extra });
const lider = (rotulo, cargos = LIDER, extra = {}) => P(rotulo, cargos, { lider: true, ...extra });

const GENERICO = [lider("Líder"), P("CCO", CCO), P("Vigilante", VIG)];

export const POSTOS = {
  P601: {
    D: [lider("Líder"), P("VSPP Apoio", APOIO, { horario: h0820 }), P("VSPP P1", APOIO), P("CCO", CCO), P("CDA", ["CDA"])],
    N: [lider("Líder"), P("CCO", CCO), P("CDA", ["CDA"])],
  },
  P602: { D: GENERICO, N: GENERICO },
  P604: {
    D: [lider("Líder"), P("VSPP 1", APOIO), P("VSPP 2", APOIO), P("CCO", CCO), P("CDA", ["CDA"]), P("Recepção", ["Recepção"])],
    N: [lider("Líder"), P("VSPP 1", APOIO), P("VSPP 2", APOIO), P("CCO", CCO)],
  },
  P605: {
    D: [lider("Líder/CCO", [...LIDER, ...CCO]), P("VSPP", APOIO), P("CDA", ["CDA"]), P("Recepção", ["Recepção"])],
    N: [lider("Líder/CCO", [...LIDER, ...CCO]), P("VSPP", APOIO)],
  },
  P606: { D: GENERICO, N: GENERICO },
  // P607 não tem posto de líder: a hierarquia é Honda (ronda), AGP CCO, Vigilante pista e AGP portaria (só de dia).
  P607: {
    D: [lider("Vigilante Honda", ["Vigilante Ronda"]), P("AGP CCO", ["AGP CCO"]), P("Vigilante Pista", ["Vigilante Apoio"]), P("AGP Portaria", ["AGP"])],
    N: [lider("Vigilante Honda", ["Vigilante Ronda"]), P("AGP CCO", ["AGP CCO"]), P("Vigilante Pista", ["Vigilante Apoio"])],
  },
  P311A: {
    D: [lider("Vigilante Líder", ["Vigilante Líder"], { legado: ["Líder"] }), P("Vigilante Apoio", ["Vigilante Apoio"], { legado: ["Apoio"] }), P("Vigilante Tático", ["Vigilante Ronda"], { legado: ["Tático"] }), P("Porteiro CCO", ["Porteiro CCO"], { legado: ["Portaria"] })],
    N: [lider("Vigilante Líder", ["Vigilante Líder"], { legado: ["Líder"] }), P("Vigilante Tático", ["Vigilante Ronda"], { legado: ["Tático"] }), P("Porteiro CCO", ["Porteiro CCO"], { legado: ["Portaria"] })],
  },
  // P311B: o símbolo vem na frente (L1, P1, P2), como eles escrevem no WhatsApp.
  P311B: {
    D: [lider("L1 · Vigilante Líder", ["Vigilante Líder"], { legado: ["L1"] }), P("P1 · Vigilante CCO", ["Vig CCO"], { legado: ["P1"] }), P("P2 · Vigilante Honda", ["Vigilante Ronda", "Vigilante Apoio"], { legado: ["P2"] })],
    N: [lider("L1 · Vigilante Líder", ["Vigilante Líder"], { legado: ["L1"] }), P("P1 · Vigilante CCO", ["Vig CCO"], { legado: ["P1"] }), P("P2 · Vigilante Honda", ["Vigilante Ronda", "Vigilante Apoio"], { legado: ["P2"] })],
  },
  P505: {
    D: [lider("VSPP Líder"), P("VSPP Apoio", APOIO), P("Vigilante CCO", CCO), P("VSPP Ronda", APOIO, { horario: h0820 }), P("CDA", ["CDA"])],
    N: [lider("VSPP Líder"), P("VSPP Apoio", APOIO), P("Vigilante CCO", CCO), P("CDA", ["CDA"])],
  },
  // P260A: dois VSPP de apoio de segunda a sexta (5x2), só de dia.
  P260A: {
    D: [lider("VSPP Líder"), P("VSPP Apoio 1", APOIO, { dias: [1, 2, 3, 4, 5] }), P("VSPP Apoio 2", APOIO, { dias: [1, 2, 3, 4, 5] }), P("Vigilante CCO", CCO)],
    N: [lider("VSPP Líder"), P("Vigilante CCO", CCO)],
  },
  // P260B: um posto só por turno.
  P260B: { D: [lider("VSPP", [...LIDER, ...APOIO])], N: [lider("VSPP", [...LIDER, ...APOIO])] },
  // P260C: um VSPP líder e um vigilante; sem CCO nem portaria.
  P260C: { D: [lider("VSPP Líder"), P("Vigilante", VIG)], N: [lider("VSPP Líder"), P("Vigilante", VIG)] },
};

// 12x36 com equipe montada por líder (Equipe → Montagem). P505 e P260A/B/C são 4x2/5x2: a equipe muda a cada
// plantão (o líder trabalha hoje com o João e amanhã com o José), então NÃO se puxa a equipe nem se repete o último mapa.
const SEM_MONTAGEM = ["P505", "P260A", "P260B", "P260C"];
export const projetoPuxaEquipe = (pid) => !SEM_MONTAGEM.includes(pid);

export function postosDoProjeto(pid, turno, dataISO = null) {
  const lista = (POSTOS[pid] && POSTOS[pid][turno]) || GENERICO;
  const dow = dataISO ? diaDaSemana(dataISO) : null;
  return lista.filter((p) => !p.dias || dow == null || p.dias.includes(dow));
}

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Posto definido para um rótulo (inclui rótulos antigos de mapas já gravados).
export function defDoPosto(pid, turno, rotulo) {
  const lista = (POSTOS[pid] && POSTOS[pid][turno]) || GENERICO;
  const r = norm(rotulo);
  return lista.find((p) => norm(p.rotulo) === r) || lista.find((p) => (p.legado || []).some((l) => norm(l) === r)) || null;
}

export const cargoCabe = (def, cargo) => !!def && (def.cargos || []).some((c) => norm(c) === norm(cargo));

// Puxa a equipe montada pelo líder (Equipe → equipeLiderId) para os postos. Só mexe nos postos sem exceção e sem
// nome digitado; quem já estava (de outro líder) sai. Devolve { postos, puxados, semEquipe }.
export function puxarEquipe({ postos, lider: lid, colabs, pid, turno, limparSeSemEquipe = false }) {
  const membros = (colabs || []).filter((c) => lid && c.equipeLiderId === lid.id && c.id !== lid.id && !c.emFerias);
  if (!membros.length && !limparSeSemEquipe) return { postos, puxados: 0, semEquipe: true };
  const usados = new Set();
  let puxados = 0;
  const novos = postos.map((p) => {
    if (p.lider || p.situacao !== "presente" || (p.detalhe && p.detalhe.livre)) return p;
    const def = defDoPosto(pid, turno, p.rotulo) || { cargos: p.cargos || [] };
    const m = membros.find((c) => !usados.has(c.id) && cargoCabe(def, c.cargo));
    if (!m) return { ...p, pessoaId: "", pessoaNome: "" };
    usados.add(m.id); puxados += 1;
    return { ...p, pessoaId: m.id, pessoaNome: m.nome };
  });
  return { postos: novos, puxados, semEquipe: membros.length === 0 };
}
