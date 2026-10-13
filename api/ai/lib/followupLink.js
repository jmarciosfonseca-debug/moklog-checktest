// Link de follow-up para empresas externas (manutenção) e administração do cliente.
// Piloto: P601. Tudo passa pelo servidor (Firebase Admin): a página pública nunca fala direto com o Firestore.
//
// Fluxo (dito pelo Marcio, 13/10/2026):
//   manutenção preenche e "Concluir e enviar" → o item sai da mão dela e cai na Moked (comQuem = "moked");
//   a Moked confere no painel e ENCAMINHA à administração (comQuem = "administracao");
//   a administração aprova/reprova no link dela → aprovado volta para a manutenção executar; reprovado volta para a Moked.
const crypto = require("crypto");

const PILOTO = ["P601"]; // projetos liberados; ampliar aqui e em src/followupLink/config.js
const PAPEIS = ["manutencao", "administracao"];
const COLECAO = "followup_links";
const DIAS_PADRAO = 15;
const DIAS_MAX = 60;
const STATUS_MANUTENCAO = ["aguardando", "proposta", "execucao", "executado"];
const COM_QUEM = ["manutencao", "administracao", "moked"];
const MAX_ITENS = 300;
const MAX_ENVIOS = 100;

class Erro extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const novoToken = () => crypto.randomBytes(32).toString("base64url");
const hashToken = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const tokenValido = (t) => typeof t === "string" && /^[-\w]{43}$/.test(t);
const txt = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const iso = (d) => new Date(d).toISOString();

// Itens em aberto enviados pelo app (cópia do que a tela de Pendências mostra).
function sanitizarItens(itens) {
  if (!Array.isArray(itens)) throw new Erro(400, "Itens inválidos.");
  const vistos = new Set();
  const saida = [];
  for (const x of itens.slice(0, MAX_ITENS)) {
    const key = txt(x && x.key, 200);
    if (!key || vistos.has(key)) continue;
    vistos.add(key);
    saida.push({
      key,
      cat: txt(x.cat, 120),
      item: txt(x.item, 160),
      status: x.status === "partial" ? "partial" : "inop",
      since: txt(x.since, 40),
      note: txt(x.note, 300),
    });
  }
  return saida;
}

function diasDesde(since, agora) {
  const t = Date.parse(since);
  return Number.isFinite(t) ? Math.max(0, Math.floor((agora - t) / 86400000)) : null;
}

function pegarRegistros(data) {
  const mapa = {};
  if (data && Array.isArray(data.registros)) data.registros.forEach((r) => { if (r && r.key) mapa[r.key] = r; });
  return mapa;
}

const comQuemDe = (reg) => (reg && COM_QUEM.includes(reg.comQuem) ? reg.comQuem : "manutencao");

// ── validação do link ────────────────────────────────────────────────────────
async function obterLink(db, token, agora = Date.now()) {
  if (!tokenValido(token)) throw new Erro(404, "Link inválido ou expirado.");
  const ref = db.collection(COLECAO).doc(hashToken(token));
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : null;
  if (!data || data.revogado || !(Date.parse(data.expiraEm) > agora)) throw new Erro(404, "Link inválido ou expirado.");
  return { ref, data };
}

// ── visão pública (somente o que o papel precisa ver) ────────────────────────
function resumoEntrada(e) {
  return {
    status: e.status || "", texto: txt(e.texto, 1000), em: e.em || "", responsavel: txt(e.responsavel, 80),
    ...(e.proposta ? { proposta: { numero: txt(e.proposta.numero, 40), valor: txt(String(e.proposta.valor ?? ""), 30) } } : {}),
    ...(e.previsao ? { previsao: txt(e.previsao, 30) } : {}),
  };
}

function montarVisao(link, registros, agora = Date.now()) {
  const itens = link.itens.map((it) => {
    const reg = registros[it.key] || null;
    const entradas = reg && Array.isArray(reg.entries) ? reg.entries : [];
    return {
      key: it.key, cat: it.cat, item: it.item, status: it.status, since: it.since, note: it.note,
      dias: diasDesde(it.since, agora),
      comQuem: comQuemDe(reg),
      statusAtual: reg ? reg.statusAtual || "" : "",
      resolvido: !!(reg && reg.resolvido),
      historico: entradas.slice(0, 4).map(resumoEntrada),
    };
  }).filter((i) => !i.resolvido);
  return {
    pid: link.pid, projeto: link.projetoNome || link.pid, papel: link.papel, empresa: link.empresa || "",
    expiraEm: link.expiraEm, itensEm: link.itensEm || "",
    itens,
  };
}

async function ver(db, token, agora = Date.now()) {
  const { ref, data } = await obterLink(db, token, agora);
  const snap = await db.collection("followups").doc(data.pid).get();
  const visao = montarVisao(data, pegarRegistros(snap.exists ? snap.data() : {}), agora);
  ref.update({ ultimoAcesso: iso(agora) }).catch(() => {});
  return visao;
}

// ── gravação em followups/{pid} (mesmo formato do app: lista "registros") ────
function novaEntrada(base, agora) {
  return { id: crypto.randomUUID(), link: "", ...base, em: iso(agora) };
}

function aplicarEntrada(registros, key, entrada, extra) {
  const atual = registros.find((r) => r && r.key === key) || { key, entries: [] };
  const reg = {
    ...atual, key, ...extra,
    entries: [entrada, ...(Array.isArray(atual.entries) ? atual.entries : [])],
    statusAtual: entrada.status, resolvido: false, resolvidoEm: "", atualizadoEm: entrada.em,
  };
  return [...registros.filter((r) => !(r && r.key === key)), reg];
}

async function gravarNoFollowup(db, pid, agora, fn) {
  const ref = db.collection("followups").doc(pid);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const registros = snap.exists && Array.isArray(snap.data().registros) ? snap.data().registros : [];
    const novo = fn(registros);
    t.set(ref, { registros: novo, updatedAt: iso(agora) });
    return novo;
  });
}

// Manutenção: "Concluir e enviar".
async function enviar(db, token, envios, agora = Date.now()) {
  const { data } = await obterLink(db, token, agora);
  if (data.papel !== "manutencao") throw new Erro(403, "Este link não permite enviar tratativas.");
  if (!Array.isArray(envios) || !envios.length || envios.length > MAX_ENVIOS) throw new Erro(400, "Nada para enviar.");
  const chaves = new Set(data.itens.map((i) => i.key));
  const limpos = envios.map((e) => {
    const key = txt(e && e.key, 200);
    const status = txt(e && e.status, 20);
    if (!chaves.has(key)) throw new Erro(400, "Item não pertence a este link.");
    if (!STATUS_MANUTENCAO.includes(status)) throw new Erro(400, "Situação inválida.");
    const numero = txt(e.propostaNumero, 40);
    if (status === "proposta" && !numero) throw new Erro(400, "Informe o número da proposta.");
    const out = { key, status, texto: txt(e.texto, 1000), previsao: txt(e.previsao, 30) };
    if (status === "proposta") out.proposta = { numero, valor: txt(String(e.propostaValor ?? ""), 30) };
    if (!out.texto && status !== "proposta") throw new Erro(400, "Descreva a situação de cada item preenchido.");
    return out;
  });
  const repetido = new Set();
  limpos.forEach((e) => { if (repetido.has(e.key)) throw new Erro(400, "Item repetido no envio."); repetido.add(e.key); });
  await gravarNoFollowup(db, data.pid, agora, (registros) => {
    let lista = registros;
    for (const e of limpos) {
      const atual = lista.find((r) => r && r.key === e.key);
      if (comQuemDe(atual) !== "manutencao") throw new Erro(409, "Um dos itens já foi enviado e está com a Moked ou com a administração.");
      const passaAdiante = e.status === "proposta" || e.status === "executado";
      const { key, ...resto } = e;
      const entrada = novaEntrada({ ...resto, responsavel: data.empresa || "Manutenção", origem: "link", papel: "manutencao" }, agora);
      lista = aplicarEntrada(lista, key, entrada, { comQuem: passaAdiante ? "moked" : "manutencao", pendenteValidacao: passaAdiante });
    }
    return lista;
  });
  return { gravados: limpos.length };
}

// Administração: aprova ou reprova uma proposta que a Moked encaminhou.
async function decidir(db, token, { key, decisao, texto }, agora = Date.now()) {
  const { data } = await obterLink(db, token, agora);
  if (data.papel !== "administracao") throw new Erro(403, "Este link não permite aprovar.");
  const k = txt(key, 200);
  if (!data.itens.some((i) => i.key === k)) throw new Erro(400, "Item não pertence a este link.");
  if (!["aprovado", "reprovado"].includes(decisao)) throw new Erro(400, "Decisão inválida.");
  await gravarNoFollowup(db, data.pid, agora, (registros) => {
    const atual = registros.find((r) => r && r.key === k);
    if (comQuemDe(atual) !== "administracao") throw new Erro(409, "Este item não está aguardando a administração.");
    const entrada = novaEntrada({ status: decisao, texto: txt(texto, 500), responsavel: data.empresa || "Administração", origem: "link", papel: "administracao" }, agora);
    return aplicarEntrada(registros, k, entrada, { comQuem: decisao === "aprovado" ? "manutencao" : "moked", pendenteValidacao: decisao === "reprovado" });
  });
  return { ok: true };
}

// ── ações da Moked (sessão gerencial) ────────────────────────────────────────
async function criar(db, { pid, papel, empresa, projetoNome, dias, itens }, agora = Date.now()) {
  if (!PILOTO.includes(pid)) throw new Erro(403, "Link de follow-up ainda não liberado para este projeto (piloto).");
  if (!PAPEIS.includes(papel)) throw new Erro(400, "Tipo de link inválido.");
  const d = Math.min(DIAS_MAX, Math.max(1, Math.floor(Number(dias) || DIAS_PADRAO)));
  const token = novoToken();
  const doc = {
    pid, papel, empresa: txt(empresa, 80), projetoNome: txt(projetoNome, 80), token,
    criadoEm: iso(agora), expiraEm: iso(agora + d * 86400000), revogado: false,
    itens: sanitizarItens(itens), itensEm: iso(agora),
  };
  await db.collection(COLECAO).doc(hashToken(token)).set(doc);
  return { id: hashToken(token), ...doc };
}

async function listar(db, pid) {
  if (!PILOTO.includes(pid)) return [];
  const snap = await db.collection(COLECAO).where("pid", "==", pid).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((l) => !l.revogado)
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .map(({ itens, ...resto }) => ({ ...resto, nItens: Array.isArray(itens) ? itens.length : 0 }));
}

async function doProjeto(db, id, pid) {
  const ref = db.collection(COLECAO).doc(String(id));
  const snap = await ref.get();
  if (!snap.exists || snap.data().pid !== pid) throw new Erro(404, "Link não encontrado.");
  return ref;
}

async function revogar(db, { pid, id }) {
  const ref = await doProjeto(db, id, pid);
  await ref.update({ revogado: true });
  return { ok: true };
}

async function renovar(db, { pid, id, dias }, agora = Date.now()) {
  const ref = await doProjeto(db, id, pid);
  const d = Math.min(DIAS_MAX, Math.max(1, Math.floor(Number(dias) || DIAS_PADRAO)));
  await ref.update({ expiraEm: iso(agora + d * 86400000) });
  return { ok: true };
}

// Atualiza a lista de itens em aberto de todos os links ativos do projeto (chamado ao abrir o painel).
async function sincronizar(db, { pid, itens }, agora = Date.now()) {
  if (!PILOTO.includes(pid)) return { atualizados: 0 };
  const limpos = sanitizarItens(itens);
  const snap = await db.collection(COLECAO).where("pid", "==", pid).get();
  const ativos = snap.docs.filter((d) => !d.data().revogado);
  await Promise.all(ativos.map((d) => d.ref.update({ itens: limpos, itensEm: iso(agora) })));
  return { atualizados: ativos.length };
}

// Moked move o item entre as mãos: encaminhar à administração, devolver à manutenção, ficar com a Moked.
async function mover(db, { pid, key, para, texto }, agora = Date.now()) {
  if (!PILOTO.includes(pid)) throw new Erro(403, "Projeto fora do piloto.");
  if (!COM_QUEM.includes(para)) throw new Erro(400, "Destino inválido.");
  const k = txt(key, 200);
  if (!k) throw new Erro(400, "Item inválido.");
  const rotulo = { administracao: "Encaminhado à administração para aprovação.", manutencao: "Devolvido à empresa de manutenção.", moked: "Item com a Moked." }[para];
  await gravarNoFollowup(db, pid, agora, (registros) => {
    const atual = registros.find((r) => r && r.key === k);
    const status = (atual && atual.statusAtual) || "aguardando";
    const entrada = novaEntrada({ status, texto: txt(texto, 500) || rotulo, responsavel: "Moked", origem: "gerencial", papel: "moked" }, agora);
    return aplicarEntrada(registros, k, entrada, { comQuem: para, pendenteValidacao: false });
  });
  return { ok: true };
}

module.exports = {
  Erro, PILOTO, PAPEIS, COLECAO, DIAS_PADRAO, STATUS_MANUTENCAO,
  novoToken, hashToken, tokenValido, sanitizarItens, comQuemDe, montarVisao, pegarRegistros,
  obterLink, ver, enviar, decidir, criar, listar, revogar, renovar, sincronizar, mover,
};
