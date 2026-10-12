// Mapa de Equipe diário — modelo do documento e regras de preenchimento (puro).
// Documento: equipes/{pid}/mapas/{projeto_AAAA-MM-DD_D|N}
//
// Regras de produto já decididas com o Marcio:
//  - o mapa abre pré-preenchido; o líder só informa exceções;
//  - campo vazio não é falta; nome digitado (cobertura de Base) não é cadastro;
//  - troca de plantão/permuta NÃO é FT; sem motivo de saúde; férias e afastado não são falta;
//  - material/armamento/munição: uma linha "sem alteração" já marcada;
//  - quilometragem rodada = odômetro atual − anterior.

import { itensDaBase } from "./materialBase";
import { chaveMapa } from "./regras";
import { postosDoProjeto, defDoPosto, projetoPuxaEquipe } from "./postos";
import { pertenceA } from "../equipe/vinculos";

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

// Postos de partida por projeto/turno: ver postos.js (hierarquia definida pelo Marcio).
export function postosPadrao(projetoId, turno, dataISO = null) {
  return postosDoProjeto(projetoId, turno, dataISO).map((p) => ({ rotulo: p.rotulo, horario: p.horario || null, lider: !!p.lider, cargos: p.cargos }));
}

// Moto: P601–P607, P311A/B e P505 têm moto (dos mapas reais); P260A/B/C não têm veículo. Km atual da moto é obrigatório.
export const PROJETOS_SEM_MOTO = ["P260A", "P260B", "P260C"];
export const projetoComMoto = (pid) => !!pid && !PROJETOS_SEM_MOTO.includes(pid);
export const ehMoto = (v) => !!v && (v.id === "moto" || /moto/i.test(v.rotulo || ""));
export const garantirMoto = (mapa) => (!projetoComMoto(mapa.projetoId) || (mapa.veiculos || []).some(ehMoto) ? mapa : { ...mapa, veiculos: [{ id: "moto", rotulo: "Moto", kmAnterior: null, kmAtual: null }, ...(mapa.veiculos || [])] });

let _seq = 0;
const novoId = () => `p${Date.now().toString(36)}${(_seq++).toString(36)}`;

export function postoVazio(rotulo = "", horario = null, extra = {}) {
  return { id: novoId(), rotulo, horario, pessoaId: "", pessoaNome: "", situacao: "presente", detalhe: {}, obs: "", ...extra };
}

export function novoMapa({ projetoId, data, turno, horario, base = null, agora = new Date() }) {
  const chave = chaveMapa(projetoId, data, turno);
  // Estrutura SEMPRE pela definição atual do projeto; as pessoas vêm do último mapa só nos projetos 12x36
  // (nos 4x2 a equipe muda a cada plantão, então não se repete ninguém).
  const usaBase = projetoPuxaEquipe(projetoId) && base && base.postos && base.postos.length;
  const defs = postosPadrao(projetoId, turno, data);
  const doBase = (p) => (usaBase ? base.postos.find((b) => b.rotulo === p.rotulo || (defDoPosto(projetoId, turno, b.rotulo) || {}).rotulo === p.rotulo) : null);
  const postos = defs.map((p) => {
    const b = doBase(p);
    return postoVazio(p.rotulo, p.horario, { lider: p.lider, cargos: p.cargos, pessoaId: (b && b.pessoaId) || "", pessoaNome: (b && b.pessoaNome) || "" });
  });
  if (usaBase) base.postos.forEach((b) => { // postos extras que o líder tinha incluído
    if (!defDoPosto(projetoId, turno, b.rotulo) && !postos.some((p) => p.rotulo === b.rotulo)) postos.push(postoVazio(b.rotulo, b.horario || null, { pessoaId: b.pessoaId || "", pessoaNome: b.pessoaNome || "" }));
  });
  const veiculos = base && base.veiculos && base.veiculos.length
    ? base.veiculos.map((v) => ({ id: v.id, rotulo: v.rotulo, kmAnterior: v.kmAtual ?? v.kmAnterior ?? null, kmAtual: null }))
    : [];
  return garantirMoto({
    id: chave, projetoId, data, turno, horario: horario || null, status: "rascunho",
    postos, material: { ...materialNovo(), ...(base && base.material && base.material.quantidades ? { quantidades: base.material.quantidades } : {}) }, veiculos,
    preenchidoDe: usaBase ? { data: base.data || null, turno: base.turno || turno } : null,
    supervisao: null, visita: null, resumo: "", observacoes: "",
    criadoEm: agora.toISOString(), atualizadoEm: agora.toISOString(), enviadoEm: null, enviadoPor: "",
  });
}

// Mapa já gravado (ou enviado) que perdeu um posto fixo — ex.: tirado com o antigo "×": devolve o posto vazio, na ordem do escopo.
// Os postos extras continuam como estão, depois dos fixos.
export function completarPostosFixos(mapa) {
  const pid = mapa.projetoId, turno = mapa.turno;
  const defs = postosPadrao(pid, turno, mapa.data);
  const postos = mapa.postos || [];
  const usados = new Set();
  // "Posto extra" comum (presente, com pessoa) é quase sempre um posto fixo que o líder tirou e refez à mão: a pessoa volta para o posto fixo que faltou.
  const deslocados = postos.filter((p) => !defDoPosto(pid, turno, p.rotulo) && /^posto extra$/i.test((p.rotulo || "").trim()) && p.situacao === "presente" && (p.pessoaId || (p.pessoaNome || "").trim()));
  const fixos = defs.map((d) => {
    const ex = postos.find((p) => !usados.has(p.id) && (defDoPosto(pid, turno, p.rotulo) || {}).rotulo === d.rotulo);
    if (ex) { usados.add(ex.id); return ex; }
    const vazio = postoVazio(d.rotulo, d.horario, { lider: d.lider, cargos: d.cargos });
    const desl = !d.lider ? deslocados.find((x) => !usados.has(x.id)) : null;
    if (!desl) return vazio;
    usados.add(desl.id);
    return { ...vazio, pessoaId: desl.pessoaId || "", pessoaNome: desl.pessoaNome || "", detalhe: desl.detalhe || {} };
  });
  const extras = postos.filter((p) => !usados.has(p.id));
  const novos = [...fixos, ...extras];
  const igual = novos.length === postos.length && novos.every((p, i) => p === postos[i]);
  return igual ? mapa : { ...mapa, postos: novos };
}

// ── Material / armamento / munição ────────────────────────────────────────────
// semAlteracao: o líder conferiu tudo visualmente e está disponível. Qualquer exceção (anomalia ou
// item indisponível) tira o "sem alteração" e exige observação do que houve.
export const SITUACOES_MATERIAL = [
  { id: "ok", rotulo: "Disponível" },
  { id: "anomalia", rotulo: "Anomalia" },
  { id: "indisponivel", rotulo: "Indisponível" },
];
export const materialNovo = () => ({ semAlteracao: true, obs: "", excecoes: [] });

const CATEGORIAS_MATERIAL = [
  ["armamento", "Armamento"], ["municao", "Munição"], ["placas", "Placas balísticas"], ["radiosHT", "Rádios HT"],
  ["smartphones", "Smartphones"], ["lanternas", "Lanternas"], ["bodycam", "Bodycam"], ["ztrax", "ZTRAX"], ["outros", "Outros"],
];
// Lista conferível a partir do cadastro de Equipamentos do projeto (somente leitura).
// Bodycam e ZTRAX só existem no P311A/P311B (mesma regra do módulo Equipamentos).
const SO_NO_MEGA_CURITIBA_ITAJAI = { bodycam: ["P311A", "P311B"], ztrax: ["P311A", "P311B"] };
export function itensDeEquipamento(data, projetoId = null, turno = null) {
  const rotulos = Object.fromEntries(CATEGORIAS_MATERIAL);
  const cad = [];
  if (data) {
    CATEGORIAS_MATERIAL.forEach(([cat, rotuloCat]) => {
      const restrito = SO_NO_MEGA_CURITIBA_ITAJAI[cat];
      if (restrito && projetoId && !restrito.includes(projetoId)) return;
      (Array.isArray(data[cat]) ? data[cat] : []).forEach((it, i) => {
        if (!it || typeof it !== "object") return;
        const nome = it.identificacao || it.modelo || it.marca || `${rotuloCat} ${i + 1}`;
        const det = [it.calibre, it.nSerie ? `nº ${it.nSerie}` : "", it.qtd > 1 ? `${it.qtd} un.` : ""].filter(Boolean).join(" · ");
        cad.push({ id: `${cat}:${it.id || i}`, categoria: cat, rotuloCategoria: rotuloCat, nome, detalhe: det, cadastro: it.status || "ok" });
      });
    });
  }
  // Base do Codex (o que o projeto declara nos mapas) + cadastro: o cadastro vence por categoria.
  const comCadastro = new Set(cad.map((i) => i.categoria));
  const base = itensDaBase(projetoId, turno, rotulos).filter((i) => !comCadastro.has(i.categoria));
  const ordem = CATEGORIAS_MATERIAL.map(([c]) => c);
  return [...cad, ...base].sort((a, b) => ordem.indexOf(a.categoria) - ordem.indexOf(b.categoria));
}

// "Armamento 2 · Munição 1 · Rádios HT 3": o que existe neste projeto para conferir.
export function resumoItens(itens) {
  const cont = new Map();
  (itens || []).forEach((i) => cont.set(i.rotuloCategoria, (cont.get(i.rotuloCategoria) || 0) + 1));
  return [...cont.entries()].map(([k, n]) => `${k} ${n}`).join(" · ");
}

// Itens que o líder precisa contar e informar (quantidade desconhecida na base).
export const itensContaveis = (itens) => (itens || []).filter((i) => i.contar);
export function definirQuantidade(material, item, qtd) {
  const base = { ...materialNovo(), ...(material || {}) };
  return { ...base, quantidades: { ...(base.quantidades || {}), [item.chaveQtd]: { nome: item.nome, qtd: String(qtd) } } };
}

// Atualiza a situação de um item (ok remove a exceção). Mantém `semAlteracao` coerente.
export function definirSituacaoMaterial(material, item, situacao, obs) {
  const base = { ...materialNovo(), ...(material || {}) };
  const outras = (base.excecoes || []).filter((e) => e.id !== item.id);
  const atual = (base.excecoes || []).find((e) => e.id === item.id);
  const excecoes = situacao === "ok" ? outras : [...outras, { id: item.id, categoria: item.categoria || "outros", nome: item.nome, detalhe: item.detalhe || "", situacao, obs: obs != null ? obs : (atual ? atual.obs : "") }];
  // Sem exceções e sem observação solta: volta a "sem alteração" (o líder desfez a anomalia).
  return { ...base, excecoes, semAlteracao: excecoes.length ? false : !(base.obs || "").trim() };
}

const num = (v) => (v === "" || v == null ? null : Number(String(v).replace(",", ".")));

export function kmRodado(v) {
  const a = num(v.kmAnterior), b = num(v.kmAtual);
  if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return null;
  return b - a;
}

// Validação para concluir. Devolve lista de textos curtos; vazia = pode concluir.
export function validarParaConcluir(mapa, itensContaveis = []) {
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
    if (p.situacao === "ft") {
      if (!d.quemFaltouId && !d.quemFaltou && !d.semFalta) erros.push(`${nome}: FT cobrindo falta de quem? Escolha quem faltou`);
      if (d.quemFaltouId && d.quemFaltouId === p.pessoaId) erros.push(`${nome}: quem faltou não pode ser a própria pessoa da FT`);
    }
    if (p.situacao === "troca" && !d.noLugarDe) erros.push(`${nome}: troca no lugar de quem?`);
  });
  // Obrigatórios: km da moto, resumo da passagem e se houve visita da supervisão neste turno.
  if (projetoComMoto(mapa.projetoId)) {
    const moto = (mapa.veiculos || []).find(ehMoto);
    if (!moto || num(moto.kmAtual) == null || Number.isNaN(num(moto.kmAtual))) erros.push("Moto: informe a quilometragem atual (obrigatório)");
  }
  if (!(mapa.resumo || "").trim()) erros.push('Resumo da passagem: escreva o resumo (se não houve nada, escreva "Sem alteração")');
  const vis = mapa.visita;
  if (!vis || typeof vis.houve !== "boolean") erros.push("Supervisão: informe se houve visita neste turno (Sim ou Não)");
  else if (vis.houve && !(vis.supervisor || "").trim()) erros.push("Supervisão: informe quem visitou");
  const mat = mapa.material || materialNovo();
  (mat.excecoes || []).forEach((e) => {
    if (!(e.nome || "").trim()) { erros.push("Material: informe qual item tem anomalia"); return; }
    if (!e.obs || e.obs.trim().length < 3) erros.push(`Material — ${e.nome}: descreva a ${e.situacao === "indisponivel" ? "indisponibilidade" : "anomalia"}`);
  });
  (itensContaveis || []).forEach((it) => {
    const q = Number(String((mat.quantidades || {})[it.chaveQtd]?.qtd ?? "").replace(",", "."));
    if (!(q > 0)) erros.push(`Material — informe a quantidade de ${it.nome}`);
  });
  if (!mat.semAlteracao && !(mat.excecoes || []).length && !(mat.obs || "").trim()) erros.push('Material: marque "Sem alteração" ou descreva o que mudou');
  (mapa.veiculos || []).forEach((v) => {
    const r = kmRodado(v);
    if (num(v.kmAtual) != null && num(v.kmAnterior) != null && r != null && r < 0) erros.push(`${v.rotulo || "Veículo"}: km atual menor que o anterior`);
  });
  return erros;
}

// O resumo (texto livre) fala de extra/FT/falta/atraso/cobertura/troca, mas nenhum posto foi marcado como exceção:
// o mapa sairia "Sem ocorrências" e a ficha não receberia nada. Devolve o aviso (ou "") para o líder conferir.
const PALAVRAS_EXCECAO = /(^|[^a-zà-ú])(extra|ft|folga trabalhada|falta|faltas|faltou|atraso|atrasou|atrasada|cobrindo|cobertura|troca|permuta)(?![a-zà-ú])/i;
export function avisoResumoSemExcecao(mapa) {
  const texto = `${mapa.resumo || ""} ${mapa.observacoes || ""}`;
  const m = PALAVRAS_EXCECAO.exec(texto);
  if (!m) return "";
  if ((mapa.postos || []).some((p) => p.situacao && p.situacao !== "presente")) return "";
  return `O resumo fala de "${m[2]}", mas nenhum posto está marcado como Falta, FT, Atraso, Cobertura ou Troca. Marque no posto (botão Exceção): é isso que vai para "Faltas/atrasos/FT/trocas" e para a ficha.`;
}

// ── FT: sempre no posto extra (o efetivo já vem marcado pelo escopo do projeto) ───────────────────────
// "Quem faltou?" escolhe alguém do efetivo do mapa: o posto dele passa a FALTA (porFtDe) e a falta vai para a ficha dele.
export const ehPostoExtra = (mapa, p) => !!p && !defDoPosto(mapa.projetoId, mapa.turno, p.rotulo);

// Quem pode ser apontado como "quem faltou": o efetivo do mapa (posto com pessoa, presente ou já em falta).
export const candidatosAFalta = (mapa, ftId) =>
  (mapa.postos || []).filter((x) => x.id !== ftId && (x.pessoaId || (x.pessoaNome || "").trim()) && ["presente", "falta"].includes(x.situacao) && !(x.situacao === "falta" && x.detalhe && x.detalhe.porFtDe && x.detalhe.porFtDe !== ftId));

const semVinculo = (d = {}) => { const { quemFaltouId, quemFaltou, faltaPostoId, semFalta, ...resto } = d; return resto; };

export function desfazerVinculoFalta(mapa, ftId) {
  const ft = (mapa.postos || []).find((x) => x.id === ftId);
  if (!ft) return mapa;
  const alvo = ft.detalhe && ft.detalhe.faltaPostoId;
  return { ...mapa, postos: mapa.postos.map((x) => {
    if (x.id === ftId) return { ...x, detalhe: semVinculo(x.detalhe) };
    if (x.id === alvo && x.situacao === "falta" && x.detalhe && x.detalhe.porFtDe === ftId) { const { porFtDe, ...d } = x.detalhe; return { ...x, situacao: "presente", detalhe: d }; }
    return x;
  }) };
}

// valor: "" | "__ninguem" | "p:<postoId>" (efetivo do mapa) | "c:<colabId>" (outro colaborador do projeto)
export function vincularFalta(mapa, ftId, valor, colabs = []) {
  let m = desfazerVinculoFalta(mapa, ftId);
  if (valor === "__ninguem") return { ...m, postos: m.postos.map((x) => (x.id === ftId ? { ...x, detalhe: { ...x.detalhe, semFalta: true } } : x)) };
  if (valor && valor.startsWith("p:")) {
    const q = m.postos.find((x) => x.id === valor.slice(2));
    if (!q) return m;
    return { ...m, postos: m.postos.map((x) => {
      if (x.id === q.id) return { ...x, situacao: "falta", detalhe: { ...x.detalhe, porFtDe: ftId } };
      if (x.id === ftId) return { ...x, detalhe: { ...x.detalhe, quemFaltouId: q.pessoaId || "", quemFaltou: q.pessoaNome || "", faltaPostoId: q.id } };
      return x;
    }) };
  }
  if (valor && valor.startsWith("c:")) {
    const c = colabs.find((x) => x.id === valor.slice(2));
    if (!c) return m;
    return { ...m, postos: m.postos.map((x) => (x.id === ftId ? { ...x, detalhe: { ...x.detalhe, quemFaltouId: c.id, quemFaltou: c.nome } } : x)) };
  }
  return m;
}

// Quem é da equipe montada do líder do mapa (12x36) e ficou fora dos postos: candidato natural a "quem faltou".
const liderDoMapa = (mapa) => (mapa.postos || []).find((p) => p.lider && p.pessoaId);
export function ausentesDaEquipe(mapa, colabs) {
  const lp = liderDoMapa(mapa);
  if (!lp || !projetoPuxaEquipe(mapa.projetoId)) return [];
  const noMapa = new Set((mapa.postos || []).map((p) => p.pessoaId).filter(Boolean));
  return (colabs || []).filter((c) => pertenceA(c, lp.pessoaId) && c.id !== lp.pessoaId && !c.emFerias && !noMapa.has(c.id));
}
// Pessoa num posto que NÃO é da equipe do líder (12x36 com equipe montada): o app pergunta se é FT/cobertura/troca.
export function foraDaEquipe(mapa, posto, colabs) {
  if (!projetoPuxaEquipe(mapa.projetoId) || posto.lider || !posto.pessoaId || posto.situacao !== "presente" || (posto.detalhe && posto.detalhe.livre)) return null;
  const lp = liderDoMapa(mapa);
  if (!lp) return null;
  const membros = (colabs || []).filter((c) => pertenceA(c, lp.pessoaId) && c.id !== lp.pessoaId);
  if (!membros.length) return null; // líder sem equipe montada: não há como dizer quem é de fora
  const pessoa = (colabs || []).find((c) => c.id === posto.pessoaId);
  if (!pessoa || pertenceA(pessoa, lp.pessoaId)) return null;
  return { pessoa, lider: (colabs || []).find((c) => c.id === lp.pessoaId) || { nome: lp.pessoaNome } };
}

// Troca a situação de um posto mantendo o vínculo FT ⇄ falta coerente.
export function mudarSituacao(mapa, id, nova) {
  const p = (mapa.postos || []).find((x) => x.id === id);
  if (!p || p.situacao === nova) return mapa;
  let m = mapa;
  if (p.situacao === "ft") m = desfazerVinculoFalta(m, id);
  const porFt = p.situacao === "falta" && p.detalhe && p.detalhe.porFtDe;
  if (porFt) m = { ...m, postos: m.postos.map((x) => (x.id === porFt ? { ...x, detalhe: semVinculo(x.detalhe) } : x)) };
  return { ...m, postos: m.postos.map((x) => (x.id === id ? { ...x, situacao: nova, detalhe: { livre: x.detalhe && x.detalhe.livre } } : x)) };
}

export function removerPosto(mapa, id) {
  const m = desfazerVinculoFalta(mapa, id);
  return { ...m, postos: m.postos.filter((x) => x.id !== id) };
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
