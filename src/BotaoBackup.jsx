import { useState } from "react";
import { Ico } from "./Icones";
import { baixarBackup } from "./backup";

// Cópia de segurança manual de TODO o app (JSON). Disponível no painel gerencial.
export default function BotaoBackup() {
  const [estado, setEstado] = useState(null); // null | {txt, erro}
  const [busy, setBusy] = useState(false);
  const rodar = async () => {
    setBusy(true); setEstado({ txt: "Preparando…" });
    try {
      const r = await baixarBackup((n, total, nome) => setEstado({ txt: `Lendo ${nome} (${n}/${total})…` }));
      setEstado({ txt: `Backup baixado: ${r.docs} registros em ${r.colecoes} coleções.${r.falhas.length ? ` Atenção: ${r.falhas.length} coleção(ões) não lidas.` : ""}`, erro: r.falhas.length > 0 });
    } catch (e) { setEstado({ txt: "Não foi possível gerar o backup. Verifique a conexão e tente de novo.", erro: true }); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ marginBottom: 8 }}>
      <button disabled={busy} onClick={rodar} style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: "1px solid #38bdf866", background: "linear-gradient(165deg,#0ea5e91a,#0ea5e90a)", color: "#e2e8f0", fontWeight: 800, fontSize: 14, cursor: busy ? "wait" : "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20, color: "#38bdf8", display: "flex" }}><Ico n="disquete" /></span>
        <span style={{ flex: 1 }}>Backup completo<div style={{ fontSize: 10, fontWeight: 500, color: "#94a3b8" }}>Baixa todos os registros do app em um arquivo</div></span>
      </button>
      {estado && <div role="status" style={{ marginTop: 6, fontSize: 11.5, color: estado.erro ? "#f59e0b" : "#94a3b8" }}>{estado.txt}</div>}
    </div>
  );
}
