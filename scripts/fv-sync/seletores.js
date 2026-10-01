// ─────────────────────────────────────────────────────────────
// seletores.js — mapeamento do portal mokedsystem.com (Fundo Variável).
// ÚNICO arquivo a ajustar quando o portal mudar.
// Tela: /sistemas/csms/nota_fiscal/fundoVariavel/visualizar.php?posto=<ID>
// Tabela: Data | Descrição | Crédito | Débito | Status | Empresa
// Rodapé: Total: <créd> <déb> · Saldo atual: <saldo>
// ─────────────────────────────────────────────────────────────
const BASE = "https://mokedsystem.com/sistemas/csms";

// posto do portal → PID do app (P311A/B fora do FV).
const POSTOS = {
  "104": "P260A",
  "105": "P260B",
  "106": "P260C",
  "221": "P505",
  "36":  "P601",
  "228": "P602",
  "101": "P604",
  "100": "P605",
  "121": "P606",
  "129": "P607",
};

module.exports = {
  CONFIGURADO: true,
  urlLogin: `${BASE}/`,
  urlPosto: id => `${BASE}/nota_fiscal/fundoVariavel/visualizar.php?posto=${id}`,
  mapaProjetos: POSTOS,
  postos: Object.keys(POSTOS),
  login: {
    // Seletores genéricos: primeiro campo de texto/e-mail e o de senha do formulário de login.
    usuario: 'input[type="text"], input[type="email"], input[name*="user" i], input[name*="login" i]',
    senha: 'input[type="password"]',
    entrar: 'button[type="submit"], input[type="submit"], button:has-text("Entrar"), button:has-text("Acessar")',
  },
  // Detecta tela de login (senha visível) → precisa autenticar.
  ehTelaLogin: async page => (await page.locator('input[type="password"]').count()) > 0,
  // Lê todas as linhas da página do posto como matriz de textos.
  lerLinhas: async page => page.$$eval("table tr", trs => trs.map(tr => Array.from(tr.querySelectorAll("td,th")).map(td => td.innerText))),
};
