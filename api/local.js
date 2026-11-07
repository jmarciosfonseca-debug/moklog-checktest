// ─────────────────────────────────────────────────────────────
// api/local.js — página pública de localização do projeto (Marcio, 06/11/2026).
// Compartilhada pelo WhatsApp: o link gera a prévia com o LOGO DA MOKED em cima
// ("Compartilhamos o endereço para sua chegada tranquila no … — projeto com consultoria da Moked")
// e a página abre com satélite, "Como chegar" e "Abrir no Maps". Não expõe nada além do endereço do parque.
// Rota amigável: /local/P601 (vercel.json → /api/local?pid=P601).
// ─────────────────────────────────────────────────────────────
const { COORDS, LOCAIS, mapsDirUrl, mapsVerUrl, mapsEmbedUrl } = require("../src/entorno/locais");

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BASE = "https://moklog-checktest.vercel.app";

function nomeDe(pid) { return (LOCAIS[pid] && LOCAIS[pid].nome) || pid; }

function paginaHTML(pid) {
  const c = COORDS[pid], nome = nomeDe(pid);
  const titulo = `${nome} — ${pid}`;
  const desc = `Compartilhamos o endereço para sua chegada tranquila no ${nome} (${pid}), projeto com consultoria da Moked. ${c.endereco}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} · Moked</title>
<meta property="og:type" content="website"><meta property="og:site_name" content="Moked Consulting Security · MokLog CheckTest">
<meta property="og:title" content="${esc(titulo)} · consultoria Moked"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${BASE}/moked/logo-moked.png"><meta property="og:image:width" content="1000"><meta property="og:image:height" content="700">
<meta property="og:url" content="${BASE}/local/${esc(pid)}"><meta name="twitter:card" content="summary">
<style>body{margin:0;background:#0b0b0e;color:#e5e7eb;font-family:'Segoe UI',system-ui,-apple-system,sans-serif}main{max-width:560px;margin:0 auto;padding:18px 14px 40px}
.logo{background:#fff;padding:8px 14px;display:inline-block;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}.logo img{height:40px;display:block}
h1{font-size:20px;margin:16px 0 4px}.pid{color:#9ca3af;font-size:12px;letter-spacing:2px;text-transform:uppercase}.end{color:#d1d5db;font-size:14px;margin:8px 0 14px}
.mapa{border:1px solid #2a2a31;background:#000;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}iframe{border:0;display:block;width:100%;height:280px}
.bt{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}a.b{flex:1;text-align:center;text-decoration:none;font-weight:800;letter-spacing:1px;text-transform:uppercase;font-size:13px;padding:13px 14px;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}
.p{background:linear-gradient(180deg,#FF1E27,#9f0710);color:#fff}.s{background:#111115;border:1px solid #3a3a42;color:#d1d5db}.nota{color:#6b7280;font-size:11px;margin-top:14px}</style></head>
<body><main>
<div class="logo"><img src="/moked/logo-moked.png" alt="Moked Consulting Security"></div>
<div class="pid" style="margin-top:14px">${esc(pid)} · consultoria Moked</div>
<h1>${esc(nome)}</h1>
<div class="end">📍 ${esc(c.endereco)}</div>
<div class="mapa"><iframe title="Mapa" src="${esc(mapsEmbedUrl(pid, 16))}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>
<div class="bt"><a class="b p" href="${esc(mapsDirUrl(pid))}">⌖ Como chegar</a><a class="b s" href="${esc(mapsVerUrl(pid))}">Abrir no Maps</a></div>
<div class="nota">Compartilhamos o endereço para sua chegada tranquila. "Como chegar" abre o Google Maps a partir de onde você está. Moked Consulting Security · MokLog CheckTest.</div>
</main></body></html>`;
}

module.exports = async (req, res) => {
  const pid = String(req.query?.pid || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  res.setHeader("Cache-Control", "public, max-age=3600");
  if (!COORDS[pid]) { res.status(404).setHeader("Content-Type", "text/plain; charset=utf-8"); return res.end("Projeto não encontrado."); }
  res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
  return res.end(paginaHTML(pid));
};
module.exports.paginaHTML = paginaHTML;
