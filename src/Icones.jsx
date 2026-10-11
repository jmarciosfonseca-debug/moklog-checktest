// Icones.jsx — conjunto único de ícones da interface (traço 2px, estilo linear).
// Substitui os emojis: mesmo desenho em qualquer celular, herda a cor do texto
// (currentColor) e acompanha o tamanho da fonte (1.1em por padrão).
import React from "react";

const T = {
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  alerta: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  checkCirculo: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  xCirculo: <><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></>,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>,
  arquivo: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></>,
  editar: <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z" />,
  notas: <><path d="M12 20h9" /><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  prancheta: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h4" /></>,
  cadeado: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  cadeadoAberto: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></>,
  chave: <><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" /></>,
  cronometro: <><path d="M10 2h4M12 14l3-3" /><circle cx="12" cy="14" r="8" /></>,
  relogio: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  ampulheta: <path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2" />,
  calendario: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  lixeira: <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />,
  sol: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  lua: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />,
  nuvem: <path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z" />,
  escudo: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  usuarios: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  usuario: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  predio: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></>,
  camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" /></>,
  grafico: <path d="M3 3v18h18M7 16V9M12 16V5M17 16v-4" />,
  raio: <path d="M13 2 3 14h9l-1 8 10-12h-9z" />,
  pacote: <><path d="m7.5 4.3 9 5.2M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
  mais: <path d="M12 5v14M5 12h14" />,
  caminhao: <><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.7a1 1 0 0 0-.2-.6l-3.4-4.3a1 1 0 0 0-.8-.4H14" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
  disquete: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
  impressora: <><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  combustivel: <path d="M3 22h12M4 9h10M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.8a2 2 0 0 0-.6-1.4L18 5" />,
  carro: <><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></>,
  sirene: <path d="M7 18v-6a5 5 0 1 1 10 0v6M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2zM21 12h1M18.5 4.5 18 5M2 12h1M12 2v1M4.9 4.9l.7.7" />,
  lampada: <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4" />,
  olho: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  capacete: <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1zM10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5M4 15v-3a6 6 0 0 1 6-6M14 6a6 6 0 0 1 6 6v3" />,
  porta: <><rect x="5" y="2" width="14" height="20" rx="1" /><path d="M15 12h.01" /></>,
  pessoa: <><circle cx="12" cy="5" r="1" /><path d="m9 20 3-6 3 6M6 8l6 2 6-2M12 10v4" /></>,
  video: <><path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11z" /><rect x="2" y="6" width="14" height="12" rx="2" /></>,
  atualizar: <path d="M3 12a9 9 0 0 1 9-9 9.7 9.7 0 0 1 6.7 2.8L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.7 9.7 0 0 1-6.7-2.8L3 16M8 16H3v5" />,
  guardachuva: <><path d="M22 12a10 10 0 0 0-20 0z" /><path d="M12 12v8a2 2 0 0 0 4 0M12 2v1" /></>,
  obras: <><rect x="2" y="6" width="20" height="8" rx="1" /><path d="M17 14v7M7 14v7M17 3v3M7 3v3M8 6l8 8" /></>,
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  celular: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></>,
  ferramenta: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" />,
  imagem: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>,
  mensagem: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  alvo: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  pino: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  cruz: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />,
  globo: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" /></>,
  quadrado: <rect x="4" y="4" width="16" height="16" rx="2" />,
  quadradoCheck: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m9 12 2 2 4-4" /></>,
  estrela: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />,
  sino: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />,
  bussola: <><circle cx="12" cy="12" r="10" /><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z" /></>,
  busca: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  casa: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>,
  elo: <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />,
  seta: <path d="M5 12h14M12 5l7 7-7 7" />,
  pasta: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />,
  upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
  telefone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />,
  engrenagem: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  mapa: <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" />,
  moeda: <><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8M12 6v2M12 16v2" /></>,
  livro: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5V21h16" /></>,
  etiqueta: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" /><path d="M7 7h.01" /></>,
  antena: <><path d="M4.9 19.1a10 10 0 0 1 0-14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M19.1 4.9a10 10 0 0 1 0 14.2" /><circle cx="12" cy="12" r="1" /></>,
};

// Pontos de status coloridos (substituem as bolinhas 🔴🟢🟡…) — cor fixa de semáforo.
const PONTOS = { pontoVermelho: "#ef4444", pontoVerde: "#22c55e", pontoAmarelo: "#eab308", pontoLaranja: "#f97316", pontoAzul: "#3b82f6", pontoRoxo: "#a855f7", pontoPreto: "#94a3b8" };

export function Ico({ n, size = "1.1em", style, title }) {
  const base = { verticalAlign: "-0.2em", flexShrink: 0, display: "inline-block", ...style };
  if (PONTOS[n]) {
    return <svg width="0.8em" height="0.8em" viewBox="0 0 24 24" aria-hidden={title ? undefined : "true"} role={title ? "img" : undefined} style={{ ...base, verticalAlign: "-0.05em" }}>{title ? <title>{title}</title> : null}<circle cx="12" cy="12" r="9" fill={PONTOS[n]} /></svg>;
  }
  const d = T[n];
  if (!d) return null;
  return <svg className="mk-ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : "true"} role={title ? "img" : undefined} style={base}>{title ? <title>{title}</title> : null}{d}</svg>;
}

export const NOMES_ICONES = Object.freeze([...Object.keys(T), ...Object.keys(PONTOS)]);

// emoji → nome do ícone (usado pela migração e por textos dinâmicos)
export const EMOJI_PARA_ICONE = Object.freeze({
  "✓": "check", "✔": "check", "✅": "checkCirculo", "☑": "quadradoCheck", "☐": "quadrado",
  "✕": "x", "✗": "x", "✖": "x", "❌": "xCirculo", "⛔": "xCirculo", "🚫": "xCirculo",
  "⚠": "alerta", "❗": "alerta", "ℹ": "info",
  "📄": "arquivo", "📃": "arquivo", "📑": "arquivo", "✏": "editar", "✍": "editar", "📝": "notas",
  "📋": "prancheta", "🔒": "cadeado", "🔓": "cadeadoAberto", "🔐": "chave", "🔑": "chave",
  "⏱": "cronometro", "⏰": "relogio", "🕐": "relogio", "⏳": "ampulheta", "⌛": "ampulheta",
  "📅": "calendario", "🗓": "calendario", "📆": "calendario", "🗑": "lixeira",
  "☀": "sol", "🌙": "lua", "☁": "nuvem", "🛡": "escudo", "👥": "usuarios", "👤": "usuario",
  "🏢": "predio", "🏭": "predio", "📷": "camera", "📸": "camera", "📊": "grafico", "📈": "grafico",
  "⚡": "raio", "📦": "pacote", "➕": "mais", "🚛": "caminhao", "🚚": "caminhao", "💾": "disquete",
  "🖨": "impressora", "⛽": "combustivel", "🚗": "carro", "🚨": "sirene", "💡": "lampada",
  "👁": "olho", "👷": "capacete", "🚪": "porta", "🚶": "pessoa", "🎥": "video", "📹": "video",
  "🔄": "atualizar", "🔁": "atualizar", "🏖": "guardachuva", "🚧": "obras", "📥": "download",
  "📱": "celular", "📲": "celular", "🔧": "ferramenta", "🖼": "imagem", "💬": "mensagem",
  "🎯": "alvo", "📍": "pino", "🚑": "cruz", "🌐": "globo", "⭐": "estrela", "🔔": "sino",
  "🧭": "bussola", "🔍": "busca", "🔎": "busca", "🏠": "casa", "🔗": "elo", "📭": "pasta", "🗂": "pasta", "📂": "pasta", "🧍": "pessoa", "💰": "moeda", "🏗": "obras", "📡": "antena", "🎬": "video", "📚": "livro", "🕘": "relogio", "🛠": "ferramenta", "👔": "usuario", "📞": "telefone", "⚙": "engrenagem", "🏷": "etiqueta", "📤": "upload", "🗺": "mapa", "➡": "seta", "→": null,
  "🔴": "pontoVermelho", "🟢": "pontoVerde", "🟡": "pontoAmarelo", "🟠": "pontoLaranja",
  "🔵": "pontoAzul", "🟣": "pontoRoxo", "⚫": "pontoPreto",
});

// Converte emoji inicial de um texto/rótulo em ícone de linha (quando mapeado).
// Ex.: <IcoTxt>{"☀️ Diurno"}</IcoTxt> → [sol] Diurno. Sem mapa, mantém o texto.
const _EMOJI_INI = /^(\p{Extended_Pictographic}|[✓✗✔✖])️?\s*/u;
export function icoDe(emoji) {
  const k = String(emoji || "").replace(/️/g, "");
  return EMOJI_PARA_ICONE[k] || null;
}
export function IcoTxt({ children }) {
  const s = typeof children === "string" ? children : null;
  if (s === null) return children;
  const m = s.match(_EMOJI_INI);
  const n = m && icoDe(m[1]);
  if (!n) return s;
  return <><Ico n={n} />{" "}{s.slice(m[0].length)}</>;
}
export function EmIco({ e }) {
  const n = icoDe(e);
  return n ? <Ico n={n} /> : <>{e}</>;
}
