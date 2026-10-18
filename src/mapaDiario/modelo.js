import { plantoesAfastamento, MAX_PLANTOES_AFASTAMENTO } from "../equipeEventos";
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
import { postosDoProjeto, defDoPosto, projetoPuxaEquipe, cargoCabe } from "./postos";
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
export function completarPostosFixos(mapa, colabs = []) {
  const pid = mapa.projetoId, turno = mapa.turno;
  const defs = postosPadrao(pid, turno, mapa.data);
  const postos = mapa.postos || [];
  const usados = new Set();
  // "Posto extra" comum (presente, com pessoa) é quase sempre um posto fixo que o líder tirou e refez à mão: a pessoa volta para o posto fixo que faltou.
  const deslocados = postos.filter((p) => !defDoPosto(pid, turno, p.rotulo) && /^posto extra$/i.test((p.rotulo || "").trim()) && p.situacao === "presente" && (p.pessoaId || (p.pessoaNome || "").trim()));
  const cargoDe = (x) => ((colabs || []).find((c) => c.id === x.pessoaId) || {}).cargo;
  const casa = (d, x) => cargoCabe(d, cargoDe(x)); // pelo cargo da pessoa no cadastro
  const jaTem = (d) => postos.find((p) => !usados.has(p.id) && (defDoPosto(pid, turno, p.rotulo) || {}).rotulo === d.rotulo);
  const faltam = defs.filter((d) => !jaTem(d));
  const preenchidos = {};
  defs.forEach((d) => { const ex = jaTem(d); if (ex) { usados.add(ex.id); preenchidos[d.rotulo] = ex; } });
  // 1º pelo cargo (vale até para o posto de líder); 2º, o que sobrar vai em ordem para os postos que não são de líder.
  faltam.forEach((d) => { const x = deslocados.find((y) => !usados.has(y.id) && casa(defDoPosto(pid, turno, d.rotulo) || d, y)); if (x) { usados.add(x.id); preenchidos[d.rotulo] = x; } });
  faltam.forEach((d) => { if (preenchidos[d.rotulo] || d.lider) return; const x = deslocados.find((y) => !usados.has(y.id)); if (x) { usados.add(x.id); preenchidos[d.rotulo] = x; } });
  const fixos = defs.map((d) => {
    const ex = preenchidos[d.rotulo];
    if (ex && !deslocados.includes(ex)) return ex;
    const vazio = postoVazio(d.rotulo, d.horario, { lider: d.lider, cargos: d.cargos });
    return ex ? { ...vazio, pessoaId: ex.pessoaId || "", pessoaNome: ex.pessoaNome || "", detalhe: ex.detalhe || {} } : vazio;
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
        cad.push({ id: `${cat}:${it.id != null ? it.id : i}`, categoria: cat, rotuloCategoria: rotuloCat, nome, detalhe: det, cadastro: it.status || "ok", identificacao: it.identificacao || "", qtd: it.qtd ?? null });
      });
    });
  }
  // Base do Codex (o que o projeto declara nos mapas) + cadastro: o cadastro vence por categoria.
  // Categoria que já teve cadastro (mesmo que tudo tenha sido baixado) não volta para a linha genérica da base.
  const comCadastro = new Set([...cad.map((i) => i.categoria), ...((data && Array.isArray(data.baixados) ? data.baixados : []).map((b) => b && b.categoria).filter(Boolean))]);
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

// ── Baixa de equipamento pelo líder (troca, extravio, dano, devolução) ───────
// Mesma lista do servidor (api/ai/lib/equipamentosSave.js). O cadastro é atualizado pelo servidor; o mapa só guarda o registro.
export const MOTIVOS_BAIXA = ["Substituído", "Extraviado", "Danificado / inservível", "Devolvido", "Outro"];
export function validarBaixa({ motivo, obs }) {
  if (!MOTIVOS_BAIXA.includes(motivo)) return "Escolha o motivo da baixa.";
  if (motivo === "Outro" && String(obs || "").trim().length < 3) return "Descreva o motivo da baixa.";
  return "";
}
// O item baixado sai das exceções do material deste mapa e fica anotado em material.baixas (vai no WhatsApp e no histórico).
export function registrarBaixaNoMapa(mapa, item, { motivo, obs = "", substituto = "" }, agora = new Date()) {
  const mat = { ...materialNovo(), ...(mapa.material || {}) };
  const excecoes = (mat.excecoes || []).filter((e) => e.id !== item.id);
  const baixas = [...(mat.baixas || []).filter((b) => b.id !== item.id), { id: item.id, categoria: item.categoria || "outros", nome: item.nome, motivo, obs: String(obs || "").trim(), substituto: String(substituto || "").trim(), em: agora.toISOString() }];
  return { ...mapa, material: { ...mat, excecoes, baixas, semAlteracao: excecoes.length ? false : !(mat.obs || "").trim() } };
}
export const rotuloBaixa = (b) => `${b.nome} — baixa: ${b.motivo}${b.obs ? ` (${b.obs})` : ""}${b.substituto ? ` · entrou: ${b.substituto}` : ""}`;

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

// "71.330" (ponto de milhar, como o pessoal digita) vale 71330 — nunca 71,33.
const num = (v) => {
  if (v === "" || v == null) return null;
  const t = String(v).trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return Number(t.replace(",", "."));
};
// Odômetro: só dígitos (sem ponto, vírgula ou símbolo).
export const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

// Km final de um veículo no plantão: o corrigido depois (erro de digitação apontado pelo plantão seguinte) vence o digitado.
export const kmFinalDoVeiculo = (v) => (v ? (v.kmAtualCorrigido != null && v.kmAtualCorrigido !== "" ? v.kmAtualCorrigido : v.kmAtual) : null);

export function kmRodado(v) {
  const a = num(v.kmAnterior), b = num(kmFinalDoVeiculo(v));
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
      else if (!d.deQuemId) erros.push(`${nome}: escolha "${d.deQuem}" na lista do cadastro (sem isso a falta não vai para a ficha)`);
      else if (!d.semFalta && (mapa.postos || []).some((x) => x.id !== p.id && x.pessoaId === d.deQuemId && x.situacao !== "falta")) erros.push(`${nome}: ${d.deQuem} está coberto(a) por falta, mas aparece presente em outro posto — ajuste o mapa`);
      if (d.base && !p.pessoaNome) erros.push(`${nome}: digite o nome de quem da Base está cobrindo`);
    }
    if (p.situacao === "ft") {
      if (!d.quemFaltouId && !d.quemFaltou && !d.semFalta && !d.postoVago) erros.push(`${nome}: FT cobrindo falta de quem? Escolha quem faltou`);
      if (d.quemFaltouId && d.quemFaltouId === p.pessoaId) erros.push(`${nome}: quem faltou não pode ser a própria pessoa da FT`);
    }
    const ausenteComAfastamento = p.situacao === "falta" || (p.situacao === "cobertura" && d.deQuem && !d.semFalta) || (p.situacao === "ft" && d.quemFaltou);
    if (ausenteComAfastamento && d.afastamentoSim && !plantoesAfastamento(d.afastamentoPlantoes)) erros.push(`${nome}: informe quantos plantões de afastamento (de 2 a ${MAX_PLANTOES_AFASTAMENTO})`);
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

const semVinculo = (d = {}) => { const { quemFaltouId, quemFaltou, faltaPostoId, semFalta, postoVago, ...resto } = d; return resto; };

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

// valor: "" | "__ninguem" | "__vago" (posto vago: ninguém faltou, o posto estava sem titular) | "p:<postoId>" (efetivo do mapa) | "c:<colabId>" (outro colaborador do projeto)
export function vincularFalta(mapa, ftId, valor, colabs = []) {
  let m = desfazerVinculoFalta(mapa, ftId);
  if (valor === "__vago") return { ...m, postos: m.postos.map((x) => (x.id === ftId ? { ...x, detalhe: { ...x.detalhe, postoVago: true } } : x)) };
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
  return { ...m, postos: m.postos.map((x) => (x.id === id ? { ...x, situacao: nova, detalhe: x.detalhe && x.detalhe.livre ? { livre: true } : {} } : x)) }; // nunca undefined: o Firestore recusa o mapa inteiro
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

// Correção de grafia nos mapas já gravados: o posto de RONDA entrou com "Honda" nos rótulos
// (P607 e P311B) e saiu errado em tela, WhatsApp e PDF. Normaliza na LEITURA, então mapa antigo
// também sai certo em todo lugar; só mexe em "Honda" como palavra do rótulo (nada de marca de moto).
export function corrigirRondaNosRotulos(mapa) {
  if (!mapa || !Array.isArray(mapa.postos)) return mapa;
  if (!mapa.postos.some((p) => p && typeof p.rotulo === "string" && /\bHonda\b/.test(p.rotulo))) return mapa;
  return { ...mapa, postos: mapa.postos.map((p) => (p && typeof p.rotulo === "string" ? { ...p, rotulo: p.rotulo.replace(/\bHonda\b/g, "Ronda") } : p)) };
}

// O Firestore recusa documento com valor `undefined` (a gravação inteira falha). Tira de qualquer profundidade antes de gravar.
export function semUndefined(v) {
  if (Array.isArray(v)) return v.map(semUndefined);
  if (v && typeof v === "object") return Object.keys(v).reduce((o, k) => { if (v[k] !== undefined) o[k] = semUndefined(v[k]); return o; }, {});
  return v;
}

// ── Cobertura: quem foi coberto recebe a Falta na ficha, então precisa estar identificado pelo cadastro ──────
// colab = cadastro escolhido (ou null para limpar). Férias no cadastro já vem como "não foi falta".
export function definirCobertoDe(mapa, postoId, colab) {
  return { ...mapa, postos: (mapa.postos || []).map((x) => {
    if (x.id !== postoId) return x;
    const { deQuem, deQuemId, semFalta, ...resto } = x.detalhe || {};
    if (!colab) return { ...x, detalhe: resto };
    return { ...x, detalhe: { ...resto, deQuem: colab.nome, deQuemId: colab.id, ...(colab.emFerias ? { semFalta: true } : {}) } };
  }) };
}
export function marcarCoberturaSemFalta(mapa, postoId, semFalta) {
  return { ...mapa, postos: (mapa.postos || []).map((x) => {
    if (x.id !== postoId) return x;
    const { semFalta: _s, ...resto } = x.detalhe || {};
    return { ...x, detalhe: semFalta ? { ...resto, semFalta: true } : resto };
  }) };
}
// Mapa antigo (só o nome em "cobertura de quem"): completa o id quando o nome bate com UM cadastro do projeto.
export function completarIdsCobertura(mapa, colabs = []) {
  const norm = (t) => String(t || "").trim().toLowerCase().replace(/\s+/g, " ");
  let mudou = false;
  const postos = (mapa.postos || []).map((x) => {
    const d = x.detalhe || {};
    if (x.situacao !== "cobertura" || !d.deQuem || d.deQuemId) return x;
    const achados = colabs.filter((c) => norm(c.nome) === norm(d.deQuem));
    if (achados.length !== 1) return x;
    mudou = true;
    return { ...x, detalhe: { ...d, deQuemId: achados[0].id } };
  });
  return mudou ? { ...mapa, postos } : mapa;
}

// ── Quilometragem (A1) ───────────────────────────────────────────────────────
// Inteiro ou null. "71.330", "71330", 71330 → 71330; vazio/inválido → null.
export const kmInteiro = (v) => { const n = num(v); return n == null || Number.isNaN(n) ? null : Math.round(n); };

// O km anterior vem do ÚLTIMO plantão enviado do projeto (qualquer turno/equipe) e não do último do mesmo turno.
// O veículo casa por id, depois por rótulo (Moto sempre vira id "moto"). Veículo que existia no plantão
// anterior e não está neste mapa entra com o km anterior dele. kmAtual do mapa em edição nunca é tocado.
// Km anterior corrigido à mão pelo líder (correcaoKm) nunca é sobrescrito pela herança.
// motoCadastro (opcional) = equipamentos/{pid}.moto: identifica a moto atual (placa) e a troca de moto.
export function herdarKmDoUltimoPlantao(mapa, ultimo, motoCadastro = null) {
  const lista = (ultimo && Array.isArray(ultimo.veiculos) ? ultimo.veiculos : []).filter(Boolean);
  const norm = (r) => String(r || "").trim().toLowerCase();
  const idEstavel = (v) => (ehMoto(v) ? "moto" : v.id);
  let veiculos = (mapa.veiculos || []).map((v) => ({ ...v, id: idEstavel(v) }));
  const trocada = motoTrocadaDesde(motoCadastro, ultimo);
  lista.forEach((u) => {
    const km = kmInteiro(kmFinalDoVeiculo(u) ?? u.kmAnterior);
    const uid = idEstavel(u);
    let alvo = veiculos.findIndex((v) => v.id === uid || (norm(v.rotulo) && norm(v.rotulo) === norm(u.rotulo)));
    if (alvo < 0) { veiculos = [...veiculos, { id: uid, rotulo: u.rotulo, kmAnterior: null, kmAtual: null }]; alvo = veiculos.length - 1; }
    if (uid === "moto" && trocada) return;                    // moto nova: o km da antiga não serve de anterior
    if (km != null) veiculos = veiculos.map((v, i) => (i === alvo && !v.correcaoKm ? { ...v, kmAnterior: km, kmAnteriorDe: ultimo.id || null } : v));
  });
  const cad = motoCadastro && typeof motoCadastro === "object" ? motoCadastro : null;
  // Rascunho reaberto quando a troca já não vale (ex.: o plantão anterior já é da moto nova): tira o aviso antigo.
  if (cad && !trocada) veiculos = veiculos.map((v) => { if (!ehMoto(v) || !v.trocaMoto) return v; const { trocaMoto, ...resto } = v; return resto; });
  if (cad && (cad.placa || trocada)) {
    const iMoto = veiculos.findIndex(ehMoto);
    if (iMoto >= 0) veiculos = veiculos.map((v, i) => {
      if (i !== iMoto) return v;
      const comPlaca = cad.placa ? { ...v, placa: String(cad.placa).trim() } : v;
      if (!trocada || v.correcaoKm) return comPlaca;
      const um = lista.find(ehMoto);
      const placaAnterior = (um && um.placa) || ((cad.anteriores || []).slice(-1)[0] || {}).placa || "";
      return { ...comPlaca, kmAnterior: kmInteiro(cad.kmInicial ?? cad.km), kmAnteriorDe: null, trocaMoto: { placaAnterior, placaNova: cad.placa || "", em: cad.trocadaEm || null } };
    });
  }
  return { ...mapa, veiculos };
}

// ── Troca de moto ────────────────────────────────────────────────────────────
const normPlaca = (p) => String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
// A moto do cadastro é outra que a do último plantão? Pela placa (quando os dois têm) ou pela data da troca.
export function motoTrocadaDesde(motoCadastro, ultimo) {
  const cad = motoCadastro && typeof motoCadastro === "object" ? motoCadastro : null;
  if (!cad || !cad.trocadaEm) return false;                 // nunca houve troca registrada: segue como sempre
  const um = ((ultimo && ultimo.veiculos) || []).find(ehMoto);
  if (um && um.placa && cad.placa) return normPlaca(um.placa) !== normPlaca(cad.placa);
  if (!ultimo) return true;
  const quando = ultimo.enviadoEm || `${ultimo.data || ""}T23:59:59.999Z`;
  return String(quando) < String(cad.trocadaEm);
}

// Substitui a moto no cadastro: a antiga vai para o histórico (anteriores) com a baixa; a nova começa limpa.
export function substituirMoto(motoAtual, { placa, modelo = "", ano = "", kmInicial, motivo, por = "", agora = new Date() }) {
  const erros = [];
  const p = String(placa || "").trim().toUpperCase();
  const k = String(kmInicial ?? "").replace(/\D/g, "");
  if (normPlaca(p).length < 7) erros.push("Informe a placa da moto nova (ex.: ABC1D23).");
  if (k === "") erros.push("Informe o km inicial da moto nova (só números).");
  if (String(motivo || "").trim().length < 3) erros.push("Informe o motivo da troca.");
  const atual = motoAtual && typeof motoAtual === "object" ? motoAtual : null;
  if (atual && atual.placa && normPlaca(atual.placa) === normPlaca(p)) erros.push("A placa nova é igual à da moto atual.");
  if (erros.length) return { erros };
  const em = agora.toISOString();
  const { anteriores = [], ...semHist } = atual || {};
  const baixada = atual && (atual.placa || atual.km) ? [{ ...semHist, baixa: { em, por, motivo: String(motivo).trim(), kmFinal: kmInteiro(atual.km) } }] : [];
  const nova = { placa: p, modelo: String(modelo || "").trim(), ano: String(ano || "").trim(), km: Number(k), kmInicial: Number(k), kmManutencao: "", proximaRevisao: "", status: "ok", historico: [], trocadaEm: em, trocadaPor: por, anteriores: [...(Array.isArray(anteriores) ? anteriores : []), ...baixada] };
  return { erros: [], moto: nova };
}

// ── Correção do km anterior (erro de digitação no plantão anterior) ─────────
// Só o km ANTERIOR deste mapa muda; o original fica guardado e a correção vai para o histórico do mapa.
// Ao concluir, o mapa anterior recebe `kmAtualCorrigido` (o `kmAtual` digitado lá nunca é apagado).
export function corrigirKmAnterior(mapa, veiculoId, { km, motivo, por = "", agora = new Date() }) {
  const erros = [];
  const k = String(km ?? "").replace(/\D/g, "");
  if (k === "") erros.push("Informe o km correto (só números).");
  if (String(motivo || "").trim().length < 3) erros.push("Informe o motivo da correção (ex.: erro de digitação no plantão anterior).");
  const v = (mapa.veiculos || []).find((x) => x.id === veiculoId);
  if (!v) erros.push("Veículo não encontrado no mapa.");
  if (erros.length) return { mapa, erros };
  const para = Number(k);
  const original = v.correcaoKm ? (v.kmAnteriorOriginal ?? null) : kmInteiro(v.kmAnterior);
  if (original === para && !v.correcaoKm) return { mapa, erros: ["O km informado é igual ao anterior: nada a corrigir."] };
  const em = agora.toISOString();
  const correcaoKm = { de: original, para, motivo: String(motivo).trim(), por, em };
  const veiculos = mapa.veiculos.map((x) => (x.id === veiculoId ? { ...x, kmAnteriorOriginal: original, kmAnterior: para, correcaoKm } : x));
  const alteracoes = [...(mapa.alteracoes || []), { em, por, tipo: "correcao-km", veiculoId, de: original, para, motivo: correcaoKm.motivo }];
  return { mapa: { ...mapa, veiculos, alteracoes }, erros: [] };
}
// Desfaz a correção (volta ao km herdado do plantão anterior).
export function desfazerCorrecaoKm(mapa, veiculoId) {
  return { ...mapa, veiculos: (mapa.veiculos || []).map((x) => {
    if (x.id !== veiculoId || !x.correcaoKm) return x;
    const { correcaoKm, kmAnteriorOriginal, ...resto } = x;
    return { ...resto, kmAnterior: kmAnteriorOriginal ?? null };
  }) };
}
// "anterior 71330 (corrigido; era 713300 — erro de digitação)"
export function rotuloCorrecaoKm(v) {
  const c = v && v.correcaoKm;
  if (!c) return "";
  return `corrigido; era ${c.de ?? "—"} — ${c.motivo}`;
}

// Na hora de enviar: km como número inteiro e id estável do veículo.
export function veiculosInteiros(mapa) {
  return { ...mapa, veiculos: (mapa.veiculos || []).map((v) => ({ ...v, id: ehMoto(v) ? "moto" : v.id, kmAnterior: kmInteiro(v.kmAnterior), kmAtual: kmInteiro(v.kmAtual) })) };
}

export const LIMITE_KM_PLANTAO = 300;
// Veículos que rodaram mais que o limite num único plantão (só para confirmar, nunca bloqueia).
export const rodadoAlto = (mapa, limite = LIMITE_KM_PLANTAO) => (mapa.veiculos || []).filter((v) => { const r = kmRodado(v); return r != null && r > limite; });

// ── Saída antecipada / substituição (A2) ─────────────────────────────────────
// Mapa já enviado: material, km, supervisão e resumo ficam travados; só dá para apontar que alguém saiu
// no meio do plantão e quem entrou no lugar. Quem saiu vira Falta na ficha; quem cobre NÃO recebe FT.
export const MOTIVOS_SAIDA = ["Mal súbito", "Necessidade de saída antecipada", "Outro"];
export const TIPOS_COBERTURA = [["base", "Colaborador da base"], ["ft", "Colega em FT"], ["adiantando", "Colega adiantando o plantão"]];
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function rotuloSaida(p) {
  const sd = p && p.saida;
  if (!sd) return "";
  const motivo = sd.motivo === "Outro" ? (sd.outro || "Outro") : sd.motivo;
  const cob = (sd.coberturas || []).map((c) => `${c.pessoaNome}${c.tipo === "base" ? " (Base)" : c.tipo === "ft" ? " (FT)" : ""} das ${c.de}${c.ate ? ` às ${c.ate}` : ""}`);
  return `Saída antecipada às ${sd.hora} — ${motivo}${cob.length ? ` — cobertura: ${cob.join("; ")}` : " — sem cobertura informada"}`;
}

export function registrarSaidaAntecipada(mapa, { postoId, motivo, outro = "", hora, coberturas = [], agora = new Date(), por = "" }) {
  const erros = [];
  const posto = (mapa.postos || []).find((x) => x.id === postoId);
  if (!posto || !posto.pessoaId) erros.push("Escolha o colaborador que saiu (precisa estar no cadastro da Equipe).");
  if (!MOTIVOS_SAIDA.includes(motivo)) erros.push("Escolha o motivo da saída.");
  if (motivo === "Outro" && !String(outro).trim()) erros.push('Descreva o motivo em "Outro".');
  if (!HORA.test(String(hora || ""))) erros.push("Informe o horário da saída (HH:MM).");
  const cobs = (coberturas || []).filter((c) => c && (c.pessoaId || String(c.pessoaNome || "").trim()));
  cobs.forEach((c) => {
    if (!TIPOS_COBERTURA.some(([k]) => k === c.tipo)) erros.push("Informe se quem cobre é da base, FT ou adiantando o plantão.");
    if (!HORA.test(String(c.de || ""))) erros.push(`Informe o horário de entrada de ${c.pessoaNome || "quem cobre"}.`);
    if (c.ate && !HORA.test(String(c.ate))) erros.push(`Horário final de ${c.pessoaNome || "quem cobre"} inválido.`);
  });
  if (erros.length) return { mapa, erros: [...new Set(erros)] };
  const anterior = { rotulo: posto.rotulo, pessoaId: posto.pessoaId, pessoaNome: posto.pessoaNome, situacao: posto.situacao, saida: posto.saida || null };
  const saida = { motivo, outro: motivo === "Outro" ? String(outro).trim() : "", hora, coberturas: cobs.map((c) => ({ tipo: c.tipo, pessoaId: c.pessoaId || "", pessoaNome: String(c.pessoaNome || "").trim(), de: c.de, ate: c.ate || "" })), registradoEm: agora.toISOString() };
  const postos = mapa.postos.map((x) => (x.id === postoId ? { ...x, saida } : x));
  const alteracoes = [...(mapa.alteracoes || []), { em: agora.toISOString(), por, tipo: "saida-antecipada", postoId, estadoAnterior: anterior }];
  return { mapa: { ...mapa, postos, alteracoes }, erros: [] };
}
