// Botão "Entrar com digital" das portas (MokLog e Área do Cliente). Só aparece se a digital estiver liberada (chave remota),
// o aparelho suportar e já tiver digital cadastrada. O PIN fica sempre ao lado. Resposta do servidor passa pelas mesmas regras do PIN.
import { useEffect, useRef, useState } from "react";
import { digitalLiberada, temDigitalNoAparelho, entrarComDigital, marcarTeste } from "./digital";
import { entrarComResposta } from "../session";

// Ao abrir o app num aparelho com biometria ativa, a porta já pede a biometria sozinha (25/11/2026). Uma vez por abertura:
// quem cancela fica na tela com o PIN e o botão, sem o aparelho insistir. Navegador que exige toque (Safari) só recusa em silêncio.
let jaPediuSozinho = false;
export const reiniciarPedidoAutomatico = () => { jaPediuSozinho = false; };

export default function BotaoDigital({ opts = {}, onSucesso, estilo = {}, rotulo = "Entrar com biometria", auto = true }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    (async () => { try { marcarTeste(); const l = await digitalLiberada(); if (vivo) setOk(l && temDigitalNoAparelho()); } catch { /* sem digital: só PIN */ } })();
    return () => { vivo = false; };
  }, []);
  const tentarRef = useRef(null);
  const tentar = async (sozinho) => {
    if (busy) return;
    setBusy(true); setErro("");
    try {
      const r = await entrarComDigital();
      if (!r.ok) { if (r.erro && !(sozinho === true && !r.bloqueado)) setErro(r.erro); return; }
      const nivel = entrarComResposta(r.dados, opts);
      if (!nivel) { setErro("Esta biometria não abre esta porta. Use o PIN."); return; }
      onSucesso && onSucesso(nivel);
    } finally { setBusy(false); }
  };
  tentarRef.current = tentar;
  useEffect(() => {
    if (!ok || !auto || jaPediuSozinho) return;
    jaPediuSozinho = true;
    tentarRef.current(true);
  }, [ok, auto]);
  if (!ok) return null;
  return <div style={{ marginTop: 10 }}>
    <button type="button" onClick={() => tentar(false)} disabled={busy} data-testid="entrar-digital"
      style={{ background: "transparent", border: "1px solid #38bdf8", color: "#bae6fd", padding: "10px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", borderRadius: 6, opacity: busy ? .6 : 1, ...estilo }}>
      {busy ? "Aguardando biometria…" : `🔐 ${rotulo}`}
    </button>
    {erro && <div role="alert" style={{ fontSize: 12, color: "#fca5a5", fontWeight: 700, marginTop: 6 }}>{erro}</div>}
  </div>;
}
