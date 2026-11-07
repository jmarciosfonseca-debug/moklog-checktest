// Localização do projeto (Marcio, 06/11/2026): satélite embutido + "Como chegar" (o Google Maps parte de onde a pessoa
// está e mostra a distância). Usado na Área do Cliente e no menu do projeto. Sem chave de API: embed público do Maps.
import { useState } from "react";
import { COORDS, mapsDirUrl, mapsVerUrl, mapsEmbedUrl } from "../entorno/locais";
import { C } from "./Cluster";

export default function Localizacao({ pid, compacto = false }) {
  const c = COORDS[pid];
  const [aberto, setAberto] = useState(!compacto);
  if (!c) return null;
  const dir = mapsDirUrl(pid), ver = mapsVerUrl(pid);
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
    <div style={{ ...C.micro, marginTop: 6 }}>"Como chegar" abre o Google Maps a partir de onde você está, com a distância e o tempo até o parque.</div>
  </div>;
}
