// Nomes digitados à mão: padroniza e sugere (primeiro o cadastro da equipe, depois os já usados).
const MIUDAS = new Set(["de", "da", "do", "das", "dos", "e"]);

export function padronizarNome(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase().split(" ").map((p, i) => (i > 0 && MIUDAS.has(p) ? p : p.replace(/(^|[-'])\p{L}/gu, (m) => m.toUpperCase()))).join(" ");
}

// Lista para <datalist>: equipe do projeto primeiro, depois nomes já digitados; sem repetir (ignora caixa/acento).
export function listaSugestoes(equipe = [], usados = []) {
  const chave = (n) => padronizarNome(n).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const vistos = new Set();
  const out = [];
  [...equipe, ...usados].forEach((n) => {
    const nome = padronizarNome(typeof n === "string" ? n : n && n.nome);
    if (!nome || vistos.has(chave(nome))) return;
    vistos.add(chave(nome));
    out.push(nome);
  });
  return out;
}
