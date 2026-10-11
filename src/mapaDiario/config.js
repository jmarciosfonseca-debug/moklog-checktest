// Mapa de Equipe diário — configuração de postos por projeto (puro, sem Firestore).
// Documento previsto: mapaEquipeConfig/{projetoId} = { projetoId, postos: [...] }
//
// Cada posto:
//   { id, rotulo, ordem, turnos:["D","N"], regra }
// `rotulo` é o nome que aparece no mapa (ex.: "L1", "P1", "Tático").
// `regra` é a do motor (regras.js): 12x36 {ancora,turmas}, 4x2 {ancora,titularD,titularN,folguista}, 5x2 {pessoas}.
//   - 12x36 tem pessoas diferentes por turno: um posto por turno (ex.: "L1-D" e "L1-N", mesmo rótulo).
//   - 4x2 é um grupo de 3 que cobre D e N: um posto com turnos ["D","N"].
// Os ids de pessoas são ids de colaborador do cadastro (equipes/{pid}.colaboradores[].id).

import { previstoDoGrupo, ehDataISO } from "./regras";

const TURNOS = ["D", "N"];

export function validarConfig(config) {
  const erros = [];
  if (!config || !config.projetoId) return ["Projeto obrigatório"];
  const ids = new Set();
  for (const p of config.postos || []) {
    if (!p.id) { erros.push("Posto sem id"); continue; }
    if (ids.has(p.id)) erros.push(`Posto repetido: ${p.id}`);
    ids.add(p.id);
    if (!p.rotulo) erros.push(`Posto ${p.id} sem rótulo`);
    if (!Array.isArray(p.turnos) || !p.turnos.length || p.turnos.some((t) => !TURNOS.includes(t))) {
      erros.push(`Posto ${p.id} com turnos inválidos`);
    }
    const r = p.regra;
    if (!r) { erros.push(`Posto ${p.id} sem regra`); continue; }
    if (r.tipo === "12x36" || r.tipo === "4x2") {
      if (!ehDataISO(r.ancora)) erros.push(`Posto ${p.id}: âncora inválida`);
    }
    if (r.tipo === "12x36" && (!Array.isArray(r.turmas) || r.turmas.length !== 2)) {
      erros.push(`Posto ${p.id}: 12x36 precisa de 2 turmas`);
    }
    if (r.tipo === "4x2" && !(r.titularD && r.titularN && r.folguista)) {
      erros.push(`Posto ${p.id}: 4x2 precisa de titular D, titular N e folguista`);
    }
    if (!["12x36", "4x2", "5x2"].includes(r.tipo)) erros.push(`Posto ${p.id}: escala desconhecida`);
  }
  return erros;
}

// Previsto do mapa de um dia e turno: um item por posto, na ordem de exibição.
// Devolve também `conflitos` (mesma pessoa prevista em dois postos do mesmo turno).
// É só sugestão: o líder confirma e informa as exceções.
export function previstoDoMapa(config, dataISO, turno) {
  const postos = (config?.postos || [])
    .filter((p) => (p.turnos || []).includes(turno))
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const itens = postos.map((p) => {
    const prev = previstoDoGrupo(p.regra, dataISO, turno);
    return { postoId: p.id, rotulo: p.rotulo, pessoas: prev.pessoas, origem: prev.origem, papel: prev.papel || null };
  });
  const vistos = new Map();
  const conflitos = [];
  for (const it of itens) {
    for (const pessoa of it.pessoas) {
      if (vistos.has(pessoa)) conflitos.push({ pessoa, postos: [vistos.get(pessoa), it.rotulo] });
      else vistos.set(pessoa, it.rotulo);
    }
  }
  return { itens, conflitos };
}
