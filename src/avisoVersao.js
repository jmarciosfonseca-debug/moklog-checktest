// Faixa "Nova versão disponível" (DOM puro, independente das telas do app). Nunca troca sozinha: só quando o usuário toca em Atualizar.
export function mostrarAvisoVersao({ aplicar }, doc = typeof document !== "undefined" ? document : null) {
  if (!doc || doc.getElementById("mk-aviso-versao")) return null;
  const faixa = doc.createElement("div");
  faixa.id = "mk-aviso-versao"; faixa.setAttribute("role", "status");
  faixa.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:99999;background:#1F2937;color:#F3F4F6;border:1px solid #3b4859;border-radius:12px;padding:10px 12px;display:flex;gap:10px;align-items:center;font:13px/1.35 system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.28)";
  const t = doc.createElement("span"); t.style.flex = "1"; t.textContent = "Nova versão disponível. Atualize quando terminar o que está fazendo.";
  const b = doc.createElement("button"); b.textContent = "Atualizar"; b.style.cssText = "background:#38bdf8;color:#062033;border:0;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer";
  const d = doc.createElement("button"); d.textContent = "Depois"; d.style.cssText = "background:transparent;color:#CBD5E1;border:0;padding:7px 6px;cursor:pointer";
  b.onclick = () => { b.disabled = true; b.textContent = "Atualizando…"; aplicar(); };
  d.onclick = () => faixa.remove();
  faixa.append(t, b, d);
  doc.body.appendChild(faixa);
  return faixa;
}
