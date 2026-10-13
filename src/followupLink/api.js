import { authFetch } from "../session";

async function ler(r) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) { const e = new Error(data.erro || "Servidor indisponível. Tente novamente."); e.status = r.status; throw e; }
  return data;
}

// Páginas públicas: o token do link é a credencial.
export async function publico(acao, corpo) {
  const r = await fetch("/api/followup-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao, ...corpo }) });
  return ler(r);
}

// Painel gerencial: sessão gerencial (PIN).
export async function gerencial(acao, corpo) {
  const r = await authFetch("/api/followup-link", { method: "POST", body: JSON.stringify({ acao, ...corpo }) });
  return ler(r);
}

// Endereço público do app: links gerados em domínios de preview (protegidos pela Vercel) saem sempre pelo domínio principal.
export const ORIGEM_PUBLICA = "https://moklog-checktest.vercel.app";
export const urlDoLink = (token, origem = window.location.origin) => {
  const base = /\.vercel\.app$/.test(new URL(origem).hostname) ? ORIGEM_PUBLICA : origem;
  return `${base}/?fu=${token}`;
};
