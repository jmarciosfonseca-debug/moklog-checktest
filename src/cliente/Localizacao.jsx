// Localização do projeto (Marcio, 06/11/2026): satélite embutido + "Como chegar" (o Google Maps parte de onde a pessoa
// está e mostra a distância). Usado na Área do Cliente e no menu do projeto. Sem chave de API: embed público do Maps.
import { useState } from "react";
import { COORDS, mapsDirUrl, mapsVerUrl, mapsEmbedUrl } from "../entorno/locais";
import { C } from "./Cluster";

// Texto de compartilhamento (06/11/2026): nome, endereço e link do Maps — vai pelo WhatsApp ou pelo menu nativo do celular.
export function textoCompartilhar(pid, nome) {
  const c = COORDS[pid]; if (!c) return "";
  return `📍 ${nome || pid}\n${c.endereco}\nComo chegar: ${mapsDirUrl(pid)}`;
}
export const whatsappUrl = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;

export default function Localizacao({ pid, nome = "", compacto = false }) {
  const c = COORDS[pid];
  const [aberto, setAberto] = useState(!compacto);
  const [copiado, setCopiado] = useState(false);
  if (!c) return null;
  const dir = mapsDirUrl(pid), ver = mapsVerUrl(pid);
  const texto = textoCompartilhar(pid, nome);
  const compartilhar = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) { await navigator.share({ title: nome || pid, text: texto }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    window.open(whatsappUrl(texto), "_blank", "noopener");
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { window.prompt("Copie a localização:", texto); } };
  const chanfro = "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)";
  const btn = { display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", padding: "10px 14px", clipPath: chanfro };
  return <div style={C.card} data-testid="localizacao">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
      <div style={C.titulo}>Localização</div>
      {compacto && <button onClick={() => setAberto((v) => !v)} style={{ ...C.back, minHeight: 26, padding: "3px 9px", fontSize: 10.5 }} aria-expanded={aberto}>{aberto ? "Ocultar mapa" : "Ver mapa"}</button>}
    </div>
    <div style={C.micro}>{c.endereco}</div>
    {aberto && <div style={{ marginTop: 8, border: "1px solid #2a2a31", clipPath: chanfro, overflow: "hidden", background: "#000" }}>
      <iframe title={`Mapa ${pid}`} src={mapsEmbedUrl(pid)} width="100%" height={compacto ? 200 : 260} style={{ border: 0, display: "block" }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
    </div>}
    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      <a href={dir} target="_blank" rel="noopener noreferrer" aria-label="Como chegar ao projeto" style={{ ...btn, background: "linear-gradient(180deg, #FF1E27, #9f0710)", color: "#fff", flex: 1, justifyContent: "center" }}>⌖ Como chegar</a>
      <a href={ver} target="_blank" rel="noopener noreferrer" aria-label="Abrir no Google Maps" style={{ ...btn, background: "#111115", border: "1px solid #3a3a42", color: "#d1d5db" }}>Abrir no Maps</a>
    </div>
    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
      <button onClick={compartilhar} aria-label="Compartilhar localização" style={{ ...btn, background: "#0b3d2e", border: "1px solid #25D366aa", color: "#d1fae5", cursor: "pointer", flex: 1, justifyContent: "center" }}>➦ Compartilhar localização</button>
      <a href={whatsappUrl(texto)} target="_blank" rel="noopener noreferrer" aria-label="Enviar pelo WhatsApp" style={{ ...btn, background: "#25D366", color: "#062b1a" }}>WhatsApp</a>
      <button onClick={copiar} aria-label="Copiar localização" style={{ ...btn, background: "#111115", border: "1px solid #3a3a42", color: "#d1d5db", cursor: "pointer" }}>{copiado ? "Copiado ✓" : "Copiar"}</button>
    </div>
    <div style={{ ...C.micro, marginTop: 6 }}>"Como chegar" abre o Google Maps a partir de onde você está. "Compartilhar" envia nome, endereço e o link do trajeto para quem você escolher (WhatsApp ou outro app).</div>
  </div>;
}
