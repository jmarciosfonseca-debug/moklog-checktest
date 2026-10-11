// Mapa de Equipe diário — modelo do documento e regras de preenchimento (puro).
// Documento: equipes/{pid}/mapas/{projeto_AAAA-MM-DD_D|N}
//
// Regras de produto já decididas com o Marcio:
//  - o mapa abre pré-preenchido; o líder só informa exceções;
//  - campo vazio não é falta; nome digitado (cobertura de Base) não é cadastro;
//  - troca de plantão/permuta NÃO é FT; sem motivo de saúde; férias e afastado não são falta;
//  - material/armamento/munição: uma linha "sem alteração" já marcada;
//  - quilometragem rodada = odômetro atual − anterior.

import { chaveMapa } from "./regras";

export const SITUACOES = [
  { id: "presente", rotulo: "Presente" },
  { id: "atraso", rotulo: "Atraso" },
  { id: "falta", rotulo: "Falta" },
  { id: "ft", rotulo: "FT" },
  { id: "cobertura", rotulo: "Cobertura" },
  { id: "troca", rotulo: "Troca" },
  { id: "vago", rotulo: "Sem ninguém" },
];
export const ROTULO_SITUACAO = Object.fromEntries(SITUACOES.map((s) => [s.id, s.rotulo]));

// Postos de partida por projeto/turno (o líder pode renomear, incluir e remover).
// P311B: L1 = Vigilante Líder, P1 = Vig CCO, P2 = Vigilante Ronda.
// P311A: Líder, Tático (Vig Ronda), Apoio, Portaria (Porteiro CCO).
// P605: um posto único Líder/CCO.
const BASE = {
  P311A: { D: ["Líder", "Tático", "Apoio", "Portaria"], N: ["Líder", "Tático", "Portaria"] },
  P311B: { D: ["L1", "P1", "P2"], N: ["L1", "P1", "P2"] },
  P601: { D: ["Líder", "VSPP Apoio", "VSPP P1", "CCO", "CDA"], N: ["Líder", "CCO", "CDA"] },
  P605: { D: ["Líder/CCO", "VSPP", "CDA"], N: ["Líder/CCO", "VSPP"] },
};
const GENERICO = ["Líder", "CCO", "Vigilante"];
// Horário próprio de posto (ver horarios.js): só como dica de exibição.
const HORARIO_POSTO = { P601: { "VSPP Apoio": { inicio: "08:00", fim: "20:00" } }, P505: { Ronda: { inicio: "08:00", fim: "20:00" } } };

let _seq = 0;
const novoId = () => `p${Date.now().toString(36)}${(_seq++).toString(36)}`;

export function postosPadrao(projetoId, turno) {
  const lista = (BASE[projetoId] && BASE[projetoId][turno]) || GENERICO;
  return lista.map((rotulo) => ({ rotulo, horario: (HORARIO_POSTO[projetoId] || {})[rotulo] || null }));
}

export function postoVazio(rotulo = "", horario = null) {
  return { id: novoId(), rotulo, horario, pessoaId: "", pessoaNome: "", situacao: "presente", detalhe: {}, obs: "" };
}

export function novoMapa({ projetoId, data, turno, horario, base = null, agora = new Date() }) {
  const chave = chaveMapa(projetoId, data, turno);
  const postos = base && base.postos && base.postos.length
    ? base.postos.map((p) => ({ ...postoVazio(p.rotulo, p.horario || null), pessoaId: p.pessoaId || "", pessoaNome: p.pessoaNome || "" }))
    : postosPadrao(projetoId, turno).map((p) => postoVazio(p.rotulo, p.horario));
  const veiculos = base && base.veiculos && base.veiculos.length
    ? base.veiculos.map((v) => ({ id: v.id, rotulo: v.rotulo, kmAnterior: v.kmAtual ?? v.kmAnterior ?? null, kmAtual: null }))
    : [];
  return {
    id: chave, projetoId, data, turno, horario: horario || null, status: "rascunho",
    postos, material: { semAlteracao: true, obs: "" }, veiculos,
    supervisao: null, resumo: "", observacoes: "",
    criadoEm: agora.toISOString(), atualizadoEm: agora.toISOString(), enviadoEm: null, enviadoPor: "",
  };
}

const num = (v) => (v === "" || v == null ? null : Number(String(v).replace(",", ".")));

export function kmRodado(v) {
  const a = num(v.kmAnterior), b = num(v.kmAtual);
  if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return null;
  return b - a;
}

// Validação para concluir. Devolve lista de textos curtos; vazia = pode concluir.
export function validarParaConcluir(mapa) {
  const erros = [];
  (mapa.postos || []).forEach((p) => {
    const nome = p.rotulo || "Posto";
    if (p.situacao !== "vago" && !p.pessoaNome && !p.pessoaId) erros.push(`${nome}: escolha quem está no posto ou marque "Sem ninguém"`);
    const d = p.detalhe || {};
    if (p.situacao === "atraso" && !d.minutos && !d.hora) erros.push(`${nome}: informe a hora de chegada ou os minutos de atraso`);
    if (p.situacao === "cobertura") {
      if (!d.deQuem) erros.push(`${nome}: cobertura de quem?`);
      if (d.base && !p.pessoaNome) erros.push(`${nome}: digite o nome de quem da Base está cobrindo`);
    }
    if (p.situacao === "troca" && !d.noLugarDe) erros.push(`${nome}: troca no lugar de quem?`);
  });
  (mapa.veiculos || []).forEach((v) => {
    const r = kmRodado(v);
    if (num(v.kmAtual) != null && num(v.kmAnterior) != null && r != null && r < 0) erros.push(`${v.rotulo || "Veículo"}: km atual menor que o anterior`);
  });
  return erros;
}

// Exceções do turno (o que o gerencial e o líder precisam enxergar rápido).
export function excecoesDoMapa(mapa) {
  return (mapa.postos || []).filter((p) => p.situacao && p.situacao !== "presente");
}

// Quem já está ocupando mais de um posto no mapa (erro comum de digitação).
export function pessoasRepetidas(mapa) {
  const vistos = new Map();
  const rep = [];
  (mapa.postos || []).forEach((p) => {
    const k = p.pessoaId || (p.detalhe && p.detalhe.base ? "" : (p.pessoaNome || "").trim().toLowerCase());
    if (!k || p.situacao === "vago") return;
    if (vistos.has(k)) rep.push({ pessoa: p.pessoaNome, postos: [vistos.get(k), p.rotulo] });
    else vistos.set(k, p.rotulo);
  });
  return rep;
}
