// avisoSalvar.js — aviso visível quando a gravação no servidor falha.
// Os módulos gravam no Firestore e, em paralelo, no aparelho (localStorage).
// Antes, a falha do servidor era só registrada no console e o usuário
// achava que tinha salvo. Agora o erro continua não interrompendo o fluxo
// (o dado fica no aparelho), mas aparece uma faixa vermelha por alguns
// segundos avisando que o registro NÃO chegou ao servidor.
const ID = "mk-aviso-salvar";

export function avisarFalhaServidor(modulo, erro) {
  try { console.error(`[${modulo}] falha ao gravar no servidor:`, erro); } catch {}
  if (typeof document === "undefined") return;
  try {
    let el = document.getElementById(ID);
    if (!el) {
      el = document.createElement("div");
      el.id = ID;
      el.setAttribute("role", "alert");
      el.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;background:#991b1b;color:#fff;padding:10px 16px;text-align:center;font:700 12px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.4)";
      document.body.appendChild(el);
    }
    el.textContent = `⚠️ ${modulo}: não foi possível gravar no servidor. O registro ficou só neste aparelho — tente salvar de novo com conexão.`;
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = "none"; }, 8000);
  } catch {}
}
