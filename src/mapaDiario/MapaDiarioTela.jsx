// Tela "Mapa de Equipe diário" do projeto (esqueleto). Abre pelo botão da home do projeto.
// Ainda sem preenchimento e sem gravação: mostra o que vem aí. A tela de preencher entra na próxima etapa.

export default function MapaDiarioTela({ project, dark, onBack }) {
  const bg = dark ? "#04080f" : "#f1f5f9";
  const card = dark ? "#060c18" : "#ffffff";
  const border = dark ? "#1e293b" : "#e2e8f0";
  const txt = dark ? "#f1f5f9" : "#0f172a";
  const txt2 = dark ? "#94a3b8" : "#64748b";
  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", justifyContent: "center", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 480, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} aria-label="Voltar" style={{ background: "transparent", border: `1px solid ${border}`, color: txt2, borderRadius: 7, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>← Voltar</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: txt }}>Mapa de Equipe diário</div>
            <div style={{ fontSize: 11, color: txt2 }}>{project?.id}{project?.name ? ` · ${project.name}` : ""}</div>
          </div>
        </div>
        <div style={{ background: card, border: `1.5px solid ${border}`, borderRadius: 16, padding: "16px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#f59e0b", marginBottom: 8 }}>Em implantação</div>
          <div style={{ fontSize: 13, color: txt, lineHeight: 1.5 }}>
            Aqui o líder vai preencher o mapa do turno: o app já traz a equipe pela escala e você informa só as exceções (falta, atraso, FT, cobertura, troca). Ao concluir, libera o envio no WhatsApp.
          </div>
          <div style={{ fontSize: 12, color: txt2, marginTop: 10, lineHeight: 1.5 }}>
            Por enquanto, continue enviando o mapa como hoje. Nada é gravado por esta tela.
          </div>
        </div>
      </div>
    </div>
  );
}
