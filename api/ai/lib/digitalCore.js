// Núcleo da entrada por digital / Face ID (WebAuthn). Só Node (crypto), sem biblioteca externa, funções puras e testáveis.
// Nada aqui toca o banco. Regras de segurança que este arquivo garante:
//  - o desafio é SELADO (HMAC) e expira em 5 min: o servidor não precisa confiar no que está no banco;
//  - a origem do pedido precisa estar na lista permitida e o rpId é o domínio dela;
//  - a digital/rosto é exigida (flag UV) e a presença do usuário (flag UP);
//  - a credencial guardada é SELADA e amarrada ao PIN vigente: trocar o PIN do perfil invalida as digitais cadastradas;
//  - contador de uso que não avança (aparelho clonado) é recusado.
const crypto = require('crypto');

const TTL_DESAFIO = 5 * 60000;
const ALGS = { '-7': 'ES256', '-257': 'RS256' };
const ORIGENS_PADRAO = ['https://moked-checktest.vercel.app']; // só o endereço oficial (passkey é amarrada ao domínio); outros por DIGITAL_ORIGENS
const NIVEIS = ['admin', 'gestor', 'cliente']; // gerencial, gestor de divisão e cliente. Líder, equipe, CCO e demo: só PIN.

const b64u = (b) => Buffer.from(b).toString('base64url');
const deB64u = (s) => Buffer.from(String(s || ''), 'base64url');
const hmac = (secret, txt) => crypto.createHmac('sha256', secret).update(txt).digest('base64url');
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function origensPermitidas(env = process.env) {
  const l = String(env.DIGITAL_ORIGENS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return l.length ? l : ORIGENS_PADRAO;
}
const rpIdDaOrigem = (origin, permitidas = origensPermitidas()) => (typeof origin === 'string' && permitidas.includes(origin) ? new URL(origin).hostname : null);

// ── desafio selado ─────────────────────────────────────────────
function criarDesafio(tipo, secret, now = Date.now()) {
  const corpo = `${tipo}.${b64u(crypto.randomBytes(16))}.${now + TTL_DESAFIO}`;
  return `${corpo}.${hmac(secret, 'desafio|' + corpo)}`;
}
function lerDesafio(texto, tipo, secret, now = Date.now()) {
  const p = String(texto || '').split('.');
  if (p.length !== 4 || p[0] !== tipo) return null;
  const corpo = p.slice(0, 3).join('.');
  if (!igual(hmac(secret, 'desafio|' + corpo), p[3])) return null;
  const exp = Number(p[2]);
  if (!Number.isSafeInteger(exp) || exp <= now) return null;
  return { nonce: p[1], exp };
}

// clientDataJSON: tipo certo, origem permitida, desafio nosso e válido.
function verificarClientData(clientDataB64u, { tipo, secret, now = Date.now(), origens = origensPermitidas() }) {
  let cd;
  try { cd = JSON.parse(deB64u(clientDataB64u).toString('utf8')); } catch { throw erro('clientData inválido'); }
  if (!cd || cd.type !== (tipo === 'registro' ? 'webauthn.create' : 'webauthn.get')) throw erro('tipo de operação incorreto');
  if (cd.crossOrigin === true) throw erro('origem cruzada não permitida');
  const rpId = rpIdDaOrigem(cd.origin, origens);
  if (!rpId) throw erro('origem não permitida');
  const d = lerDesafio(deB64u(cd.challenge).toString('utf8'), tipo, secret, now);
  if (!d) throw erro('desafio inválido ou vencido');
  return { rpId, nonce: d.nonce };
}

// authenticatorData: rpIdHash, flags (UP e UV obrigatórios) e contador.
function lerAuthData(authDataB64u, rpId) {
  const a = deB64u(authDataB64u);
  if (a.length < 37) throw erro('authenticatorData inválido');
  const esperado = crypto.createHash('sha256').update(rpId).digest();
  if (!crypto.timingSafeEqual(a.subarray(0, 32), esperado)) throw erro('domínio diferente do esperado');
  const flags = a[32];
  if (!(flags & 0x01)) throw erro('presença do usuário ausente');
  if (!(flags & 0x04)) throw erro('digital/rosto não confirmados');
  return { flags, contagem: a.readUInt32BE(33), bruto: a };
}

// No cadastro, o authenticatorData traz o id da credencial (flag AT): confere com o id informado.
function credencialDoAuthData(a, credentialId) {
  if (!(a.flags & 0x40) || a.bruto.length < 55) throw erro('dados da credencial ausentes');
  const n = a.bruto.readUInt16BE(53);
  const id = a.bruto.subarray(55, 55 + n);
  if (id.length !== n || !igual(b64u(id), credentialId)) throw erro('credencial não confere');
}

function chavePublicaValida(spkiB64u, alg) {
  if (!ALGS[String(alg)]) throw erro('algoritmo não suportado');
  try {
    const k = crypto.createPublicKey({ key: deB64u(spkiB64u), format: 'der', type: 'spki' });
    if (alg === -7 && !(k.asymmetricKeyType === 'ec' && k.asymmetricKeyDetails.namedCurve === 'prime256v1')) throw 0;
    if (alg === -257 && !(k.asymmetricKeyType === 'rsa' && (k.asymmetricKeyDetails.modulusLength || 0) >= 2048)) throw 0;
  } catch { throw erro('chave pública inválida'); }
}

function verificarAssinatura({ spkiB64u, alg, authDataB64u, clientDataB64u, assinaturaB64u }) {
  try {
    const dados = Buffer.concat([deB64u(authDataB64u), crypto.createHash('sha256').update(deB64u(clientDataB64u)).digest()]);
    const key = crypto.createPublicKey({ key: deB64u(spkiB64u), format: 'der', type: 'spki' });
    return alg === -7
      ? crypto.verify('sha256', dados, { key, dsaEncoding: 'der' }, deB64u(assinaturaB64u))
      : crypto.verify('sha256', dados, key, deB64u(assinaturaB64u));
  } catch { return false; }
}

// ── identidade e selos ─────────────────────────────────────────
// O que a digital pode virar: só gerencial, gestor de divisão e cliente (decisão do Marcio, 21/11/2026).
function identidadeDoToken(p) {
  if (!p || !NIVEIS.includes(p.nivel)) return null;
  if (p.nivel === 'admin') return { nivel: 'admin' };
  if (p.nivel === 'gestor') return p.div ? { nivel: 'gestor', div: String(p.div) } : null;
  return Array.isArray(p.pids) && p.pids.length && p.escopo ? { nivel: 'cliente', escopo: String(p.escopo), pids: p.pids.map(String) } : null;
}
const grupoDaIdentidade = (i) => (i.nivel === 'admin' ? 'admin' : i.nivel === 'gestor' ? `gestor:${i.div}` : `cliente:${i.escopo}`);

// PIN vigente da identidade (hash). Trocar o PIN muda isto e derruba as digitais daquele perfil.
function hashDoPerfil(i, c) {
  if (i.nivel === 'admin') return c.admin || null;
  if (i.nivel === 'gestor') return (c.gestor || {})[i.div] || null;
  const e = (c.cliente || {})[i.escopo];
  return e && JSON.stringify(e.pids) === JSON.stringify(i.pids) ? e.hash : null;
}
const selarCredencial = (secret, { id, identidade, spki, pv }) => hmac(secret, `cred|${id}|${JSON.stringify(identidade)}|${spki}|${pv}`);
const versaoDoPerfil = (secret, i, c) => { const h = hashDoPerfil(i, c); return h ? hmac(secret, `pin|${grupoDaIdentidade(i)}|${h}`) : null; };

function erro(msg) { const e = new Error(msg); e.digital = true; return e; }

module.exports = {
  TTL_DESAFIO, ALGS, NIVEIS, ORIGENS_PADRAO, b64u, deB64u, hmac, igual,
  origensPermitidas, rpIdDaOrigem, criarDesafio, lerDesafio, verificarClientData, lerAuthData, credencialDoAuthData,
  chavePublicaValida, verificarAssinatura, identidadeDoToken, grupoDaIdentidade, hashDoPerfil, selarCredencial, versaoDoPerfil, erro,
};
