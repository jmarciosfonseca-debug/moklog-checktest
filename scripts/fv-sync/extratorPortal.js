// ─────────────────────────────────────────────────────────────
// extratorPortal.js — login + leitura do portal via Playwright.
// Retorna o formato bruto esperado por fvCore.normalizar().
// Credenciais SOMENTE de process.env (GitHub Secrets).
// ─────────────────────────────────────────────────────────────
const SEL = require("./seletores");

// Erros de configuração não adiantam repetir.
function erroFixo(msg) { const e = new Error(msg); e.naoRepetir = true; return e; }

async function extrair() {
  if (!SEL.CONFIGURADO) throw erroFixo("Extrator não configurado: seletores.js aguardando mapeamento do portal.");
  const user = process.env.FV_USER, pass = process.env.FV_PASS;
  if (!user || !pass) throw erroFixo("Credenciais FV_USER/FV_PASS ausentes.");
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    await page.goto(SEL.urlLogin, { waitUntil: "domcontentloaded" });
    await page.fill(SEL.login.usuario, user);
    await page.fill(SEL.login.senha, pass);
    await Promise.all([page.waitForLoadState("networkidle"), page.click(SEL.login.entrar)]);
    await page.waitForSelector(SEL.login.confirmaLogado);
    // Extração específica do portal — implementada após os prints (seletores.extracao).
    if (typeof SEL.extracao.executar !== "function") throw new Error("Rotina de extração não definida em seletores.js");
    return await SEL.extracao.executar(page);
  } finally {
    await browser.close();
  }
}

module.exports = { extrair };
