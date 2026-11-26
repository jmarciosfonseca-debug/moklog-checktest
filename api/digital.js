// Entrada por digital / Face ID (WebAuthn) — só gerencial, gestor de divisão e cliente. Líder, equipe, CCO e demo: só PIN.
// DESLIGADO por padrão: sem DIGITAL_ATIVO=1 no ambiente, todas as ações respondem "indisponível" e o PIN segue como sempre.
// O servidor guarda apenas a chave PÚBLICA do aparelho; digital e rosto nunca saem do aparelho. Ver ai/lib/digitalCore.js.
const crypto = require('crypto');
const { getDb } = require('./ai/lib/firebaseAdmin');
const auth = require('./ai/lib/accessAuth');
const D = require('./ai/lib/digitalCore');

const COL = 'digital_credenciais', USADOS = 'digital_usados', TENT = 'digital_tentativas';
const JANELA = 15 * 60000, MAX_FALHAS = 5, MAX_POR_GRUPO = 20;
const txt = (v, n) => String(v == null ? '' : v).slice(0, n);
const tam = (v, n) => typeof v === 'string' && v.length > 0 && v.length <= n;

function sessao(req) {
  const m = /^Bearer ([-\w]+\.[-\w]+)$/.exec(req.headers?.authorization || '');
  return m ? auth.verify(m[1]) : null;
}

async function bloqueadoAte(db, ip, secret, now) {
  const s = await db.collection(TENT).doc(D.hmac(secret, 'ip|' + ip)).get();
  const d = (s.exists && s.data()) || {};
  return d.bloqueadoAte > now ? d.bloqueadoAte : 0;
}
async function registrarFalha(db, ip, secret, now) {
  const ref = db.collection(TENT).doc(D.hmac(secret, 'ip|' + ip));
  await db.runTransaction(async (t) => {
    const s = await t.get(ref), old = (s.exists && s.data()) || {};
    const reset = !old.inicioMs || now - old.inicioMs >= JANELA || (old.bloqueadoAte && old.bloqueadoAte <= now);
    const falhas = reset ? 1 : (old.falhas || 0) + 1;
    t.set(ref, { falhas, inicioMs: reset ? now : old.inicioMs, bloqueadoAte: falhas >= MAX_FALHAS ? now + JANELA : 0, expiraEm: new Date(now + JANELA * 2) });
  });
}
const zerarFalhas = (db, ip, secret) => db.collection(TENT).doc(D.hmac(secret, 'ip|' + ip)).set({ falhas: 0, inicioMs: 0, bloqueadoAte: 0 });

// Só vale credencial selada por nós (o Firestore do app é legível/gravável pelo navegador: nada ali é confiável sem o selo).
const credencialValida = (secret, d) => d && d.id && d.identidade && d.spki && typeof d.pv === 'string' && d.sel && D.igual(D.selarCredencial(secret, d), d.sel);

async function usarUmaVez(t, db, nonce, now) {
  const ref = db.collection(USADOS).doc(nonce);
  const s = await t.get(ref);
  if (s.exists) throw D.erro('desafio já usado');
  t.set(ref, { em: now, expiraEm: new Date(now + D.TTL_DESAFIO * 2) });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, erro: 'Método não permitido' });
  if (process.env.DIGITAL_ATIVO !== '1') return res.status(503).json({ ok: false, erro: 'Entrada por digital indisponível.' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}; } catch { return res.status(400).json({ ok: false, erro: 'Pedido inválido' }); }
  const rpId = D.rpIdDaOrigem(req.headers?.origin);
  if (!rpId) return res.status(403).json({ ok: false, erro: 'Origem não permitida' });
  const now = Date.now();
  let ip = '';
  try {
    const secret = auth.secret(), c = auth.hashes(), db = getDb();
    const acao = body.acao;

    // ── login: sem sessão, com limite de tentativas ──
    if (acao === 'opcoes-login' || acao === 'entrar') {
      ip = auth.clientIp(req);
      const ate = await bloqueadoAte(db, ip, secret, now);
      if (ate) { const retry = Math.ceil((ate - now) / 1000); res.setHeader('Retry-After', String(retry)); return res.status(429).json({ ok: false, erro: 'Limite de tentativas. Aguarde 15 minutos.', retryAfter: retry }); }
    }
    if (acao === 'opcoes-login') {
      return res.status(200).json({ ok: true, rpId, desafio: D.criarDesafio('login', secret, now), credencial: tam(body.credentialId, 1400) ? body.credentialId : null, timeout: 60000 });
    }
    if (acao === 'entrar') {
      const falha = async () => { try { await registrarFalha(db, ip, secret, now); } catch { /* o limite é melhor-esforço */ } return res.status(401).json({ ok: false, erro: 'Digital não reconhecida. Use o PIN.' }); };
      if (!tam(body.credentialId, 1400) || !tam(body.clientDataJSON, 4000) || !tam(body.authenticatorData, 4000) || !tam(body.signature, 2000)) return falha();
      try {
        const ref = db.collection(COL).doc(body.credentialId);
        const snap = await ref.get(), d = snap.exists && snap.data();
        if (!credencialValida(secret, d) || d.rpId !== rpId) return falha();
        if (D.versaoDoPerfil(secret, d.identidade, c) !== d.pv) return falha(); // PIN do perfil mudou ou perfil removido
        const cd = D.verificarClientData(body.clientDataJSON, { tipo: 'login', secret, now });
        if (cd.rpId !== rpId) return falha();
        const ad = D.lerAuthData(body.authenticatorData, rpId);
        if (!D.verificarAssinatura({ spkiB64u: d.spki, alg: d.alg, authDataB64u: body.authenticatorData, clientDataB64u: body.clientDataJSON, assinaturaB64u: body.signature })) return falha();
        await db.runTransaction(async (t) => {
          await usarUmaVez(t, db, cd.nonce, now);
          const atual = await t.get(ref), a = atual.exists && atual.data();
          if (!credencialValida(secret, a)) throw D.erro('credencial removida');
          if ((ad.contagem > 0 || a.contagem > 0) && ad.contagem <= a.contagem) throw D.erro('contador não avançou'); // aparelho clonado
          t.set(ref, { ...a, contagem: ad.contagem, ultimoUsoEm: new Date(now).toISOString() });
        });
        await zerarFalhas(db, ip, secret).catch(() => {});
        return res.status(200).json({ ok: true, ...auth.issue(d.identidade, now, c) });
      } catch (e) {
        if (e && e.digital) return falha();
        throw e;
      }
    }

    // ── cadastro e gestão: exigem sessão (PIN) de gerencial, gestor ou cliente ──
    const sess = sessao(req);
    if (!sess) return res.status(401).json({ ok: false, erro: 'Sessão ausente ou expirada. Entre novamente.' });
    const identidade = D.identidadeDoToken(sess);
    if (!identidade || !D.hashDoPerfil(identidade, c)) return res.status(403).json({ ok: false, erro: 'Não recomendamos usar a biometria neste acesso, porque ele é compartilhado. Use o PIN.' });
    const grupo = D.grupoDaIdentidade(identidade);

    if (acao === 'opcoes-registro') {
      return res.status(200).json({
        ok: true, rp: { id: rpId, name: 'MokLog' }, desafio: D.criarDesafio('registro', secret, now),
        usuario: { id: D.b64u(crypto.randomBytes(16)), nome: grupo, nomeExibicao: 'MokLog' }, // id novo a cada cadastro: dois aparelhos não se substituem
        algoritmos: [-7, -257], timeout: 60000,
      });
    }
    if (acao === 'registrar') {
      if (!tam(body.credentialId, 1400) || !tam(body.clientDataJSON, 4000) || !tam(body.authenticatorData, 4000) || !tam(body.publicKey, 2000)) return res.status(400).json({ ok: false, erro: 'Pedido inválido' });
      try {
        const alg = Number(body.alg);
        const cd = D.verificarClientData(body.clientDataJSON, { tipo: 'registro', secret, now });
        if (cd.rpId !== rpId) throw D.erro('domínio diferente');
        const ad = D.lerAuthData(body.authenticatorData, rpId);
        D.credencialDoAuthData(ad, body.credentialId);
        D.chavePublicaValida(body.publicKey, alg);
        const existentes = await db.collection(COL).where('grupo', '==', grupo).limit(MAX_POR_GRUPO).get();
        if (existentes.docs.length >= MAX_POR_GRUPO) return res.status(409).json({ ok: false, erro: 'Limite de aparelhos cadastrados. Remova algum.' });
        const pv = D.versaoDoPerfil(secret, identidade, c);
        const doc = { id: body.credentialId, grupo, identidade, spki: body.publicKey, alg, contagem: ad.contagem, rotulo: txt(body.rotulo, 40) || 'Aparelho', criadoEm: new Date(now).toISOString(), ultimoUsoEm: null, pv, rpId };
        doc.sel = D.selarCredencial(secret, doc);
        const ref = db.collection(COL).doc(body.credentialId);
        await db.runTransaction(async (t) => {
          await usarUmaVez(t, db, cd.nonce, now);
          if ((await t.get(ref)).exists) throw D.erro('credencial já cadastrada');
          t.set(ref, doc);
        });
        return res.status(200).json({ ok: true, id: doc.id, rotulo: doc.rotulo });
      } catch (e) {
        if (e && e.digital) return res.status(400).json({ ok: false, erro: 'Não foi possível cadastrar a digital neste aparelho. Use o PIN.' });
        throw e;
      }
    }
    if (acao === 'listar') {
      const q = identidade.nivel === 'admin' ? db.collection(COL).limit(100) : db.collection(COL).where('grupo', '==', grupo).limit(50);
      const r = await q.get();
      const itens = r.docs.map((x) => x.data()).filter((d) => credencialValida(secret, d)).map((d) => ({ id: d.id, grupo: d.grupo, rotulo: d.rotulo, criadoEm: d.criadoEm, ultimoUsoEm: d.ultimoUsoEm || null }));
      return res.status(200).json({ ok: true, itens, todos: identidade.nivel === 'admin' });
    }
    if (acao === 'remover') {
      if (!tam(body.id, 1400)) return res.status(400).json({ ok: false, erro: 'Pedido inválido' });
      const ref = db.collection(COL).doc(body.id), s = await ref.get(), d = s.exists && s.data();
      if (!d) return res.status(404).json({ ok: false, erro: 'Aparelho não encontrado.' });
      if (identidade.nivel !== 'admin' && d.grupo !== grupo) return res.status(403).json({ ok: false, erro: 'Sem permissão para remover este aparelho.' });
      await ref.delete();
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, erro: 'Pedido inválido' });
  } catch (e) {
    console.error('Digital indisponível', { code: e.code || e.message });
    return res.status(503).json({ ok: false, erro: 'Entrada por digital indisponível. Use o PIN.' });
  }
};
