// ─────────────────────────────────────────────────────────────
// extratorPortal.js — login + leitura do Fundo Variável (Playwright).
// Credenciais SOMENTE de process.env (GitHub Secrets). Somente leitura:
// o robô apenas navega e lê; não clica em aprovar, editar ou excluir.
// ─────────────────────────────────────────────────────────────
const SEL = require("./seletores");
const { parseTabelaPortal } = require("./fvCore");

function erroFixo(msg) { const e = new Error(msg); e.naoRepetir = true; return e; }

async function autenticar(page, user, pass) {
  await page.locator(SEL.login.usuario).first().fill(user);
  await page.locator(SEL.login.senha).first().fill(pass);
  await Promise.all([
    page.waitForLoadState("networkidle").catch(() => {}),
    page.locator(SEL.login.entrar).first().click(),
  ]);
  await page.waitForTimeout(1500);
  if (await SEL.ehTelaLogin(page)) throw erroFixo("Login recusado pelo portal (usuário/senha ou verificação adicional).");
}

async function extrair() {
  if (!SEL.CONFIGURADO) throw erroFixo("Extrator não configurado: seletores.js aguardando mapeamento do portal.");
  const user = process.env.FV_USER, pass = process.env.FV_PASS;
  if (!user || !pass) throw erroFixo("Credenciais FV_USER/FV_PASS ausentes.");
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ locale: "pt-BR" });
    const page = await ctx.newPage();
    page.setDefaultTimeout(45000);

    // Vai direto ao 1º posto; se cair na tela de login, autentica e volta.
    const primeiro = SEL.postos[0];
    await page.goto(SEL.urlPosto(primeiro), { waitUntil: "domcontentloaded" });
    if (await SEL.ehTelaLogin(page)) {
      await autenticar(page, user, pass);
      await page.goto(SEL.urlPosto(primeiro), { waitUntil: "domcontentloaded" });
      if (await SEL.ehTelaLogin(page)) throw erroFixo("Após o login, o portal voltou à tela de login.");
    }

    const projetos = {};
    for (const posto of SEL.postos) {
      await page.goto(SEL.urlPosto(posto), { waitUntil: "domcontentloaded" });
      if (await SEL.ehTelaLogin(page)) throw new Error(`Sessão expirou ao abrir o posto ${posto}.`);
      await page.waitForSelector("text=Saldo atual", { timeout: 30000 });
      const linhas = await SEL.lerLinhas(page);
      const t = parseTabelaPortal(linhas);
      if (t.saldo === null) throw new Error(`Posto ${posto}: "Saldo atual" não encontrado na página.`);
      projetos[posto] = { saldo: t.saldo, lancamentos: t.lancamentos.map(l => ({ ...l, posto })), conferirSoma: true };
      console.log(`Posto ${posto} (${SEL.mapaProjetos[posto]}): ${t.lancamentos.length} lançamento(s), saldo ${t.saldo}`);
    }
    return { projetos };
  } finally {
    await browser.close();
  }
}

module.exports = { extrair };
