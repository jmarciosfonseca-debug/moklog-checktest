// Botão "Entrar com digital" das portas (MokLog e Área do Cliente). Só aparece se a digital estiver liberada (chave remota),
// o aparelho suportar e já tiver digital cadastrada. O PIN fica sempre ao lado. Resposta do servidor passa pelas mesmas regras do PIN.
import { useEffect, useState } from "react";
import { digitalLiberada, temDigitalNoAparelho, entrarComDigital, marcarTeste } from "./digital";
import { entrarComResposta } from "../session";

export default function BotaoDigital({ opts = {}, onSucesso, estilo = {}, rotulo = "Entrar com digital" }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    (async () => { try { marcarTeste(); const l = await digitalLiberada(); if (vivo) setOk(l && temDigitalNoAparelho()); } catch { /* sem digital: só PIN */ } })();
    return () => { vivo = false; };
  }, []);
  if (!ok) return null;
  const tentar = async () => {
    if (busy) return;
    setBusy(true); setErro("");
    try {
      const r = await entrarComDigital();
      if (!r.ok) { if (r.erro) setErro(r.erro); return; }
      const nivel = entrarComResposta(r.dados, opts);
      if (!nivel) { setErro("Esta digital não abre esta porta. Use o PIN."); return; }
      onSucesso && onSucesso(nivel);
    } finally { setBusy(false); }
  };
  return <div style={{ marginTop: 10 }}>
    <button type="button" onClick={tentar} disabled={busy} data-testid="entrar-digital"
      style={{ background: "transparent", border: "1px solid #38bdf8", color: "#bae6fd", padding: "10px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", borderRadius: 6, opacity: busy ? .6 : 1, ...estilo }}>
      {busy ? "Aguardando digital…" : `🔐 ${rotulo}`}
    </button>
    {erro && <div role="alert" style={{ fontSize: 12, color: "#fca5a5", fontWeight: 700, marginTop: 6 }}>{erro}</div>}
  </div>;
}
