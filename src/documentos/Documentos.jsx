// Documentos do projeto: lista curta e abre o documento dentro do app (sem PIN, para a equipe ter na palma da mão).
// Com um único documento, abre direto (menos um toque).
import { useState } from "react";
import { documentosDoProjeto, urlDoDocumento } from "./catalogo";

export default function Documentos({ project, dark = true, onBack }) {
  const docs = documentosDoProjeto(project?.id);
  const [aberto, setAberto] = useState(() => (docs.length === 1 ? docs[0].id : null));
  const doc = docs.find((d) => d.id === aberto) || null;
  const txt = dark ? "#f1f5f9" : "#0f172a";
  const txt2 = dark ? "#94a3b8" : "#64748b";
  const fundo = dark ? "#04080f" : "#f1f5f9";
  const card = dark ? "linear-gradient(165deg,#0c1526 0%,#060c18 70%)" : "#ffffff";
  const borda = dark ? "#263248" : "#cbd5e1";
  const voltar = () => (doc && docs.length > 1 ? setAberto(null) : onBack && onBack());
  const barra = (titulo, extra) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "calc(10px + env(safe-area-inset-top)) 12px 10px", background: dark ? "#0a1322" : "#ffffff", borderBottom: `1px solid ${borda}` }}>
      <button onClick={voltar} aria-label="Voltar" style={{ background: "transparent", border: `1px solid ${borda}`, borderRadius: 10, color: txt, fontSize: 18, padding: "4px 12px", cursor: "pointer" }}>‹</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: txt, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titulo}</div>
        <div style={{ fontSize: 10.5, color: txt2 }}>{project?.id}{project?.name ? ` · ${project.name}` : ""}</div>
      </div>
      {extra}
    </div>
  );

  if (doc) {
    const url = urlDoDocumento(doc, project.id);
    return (
      <div data-testid="documento-aberto" style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", background: fundo }}>
        {barra(`${doc.titulo}`, <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: txt2, textDecoration: "none", border: `1px solid ${borda}`, borderRadius: 8, padding: "5px 9px" }}>Abrir ↗</a>)}
        <iframe title={doc.titulo} src={url} sandbox="allow-scripts allow-same-origin allow-popups allow-modals allow-downloads" style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
      </div>
    );
  }
  return (
    <div data-testid="documentos-lista" style={{ position: "fixed", inset: 0, zIndex: 50, overflowY: "auto", background: fundo }}>
      {barra("Documentos")}
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {docs.length === 0 && <div style={{ color: txt2, fontSize: 13 }}>Este projeto ainda não tem documentos.</div>}
        {docs.map((d) => (
          <button key={d.id} onClick={() => setAberto(d.id)} data-testid="documento-card" style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", background: card, border: `1.5px solid ${borda}`, borderRadius: 16, padding: "16px 14px" }}>
            <span style={{ fontSize: 26 }} aria-hidden="true">📘</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: txt }}>{d.titulo}</div>
              <div style={{ fontSize: 11, color: txt2, marginTop: 2 }}>{d.sub}</div>
            </div>
            <span style={{ color: txt2, fontSize: 18 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
