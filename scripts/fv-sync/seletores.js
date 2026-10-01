// ─────────────────────────────────────────────────────────────
// seletores.js — ÚNICO arquivo a ajustar quando o portal mudar.
// Preenchido a partir dos prints reais do portal (pendente).
// Enquanto CONFIGURADO=false o robô aborta sem tocar no Firestore.
// ─────────────────────────────────────────────────────────────
module.exports = {
  CONFIGURADO: false,
  urlLogin: null,          // ex.: página de login do portal
  login: { usuario: null, senha: null, entrar: null, confirmaLogado: null },
  // Mapa código/nome do projeto no portal → PID do app.
  mapaProjetos: {},
  // Seletores de extração (tela de saldo e de lançamentos).
  extracao: {},
};
