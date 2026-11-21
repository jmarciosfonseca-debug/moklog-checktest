// Depois do login por PIN de gerencial ou cliente: oferece ativar a digital neste aparelho e permite gerenciar os aparelhos.
// Invisível enquanto a chave remota estiver "desligado" (padrão) e para quem entra como líder, equipe, CCO ou demo.
import { useCallback, useEffect, useState } from "react";
import { getSession } from "./../session";
import { digitalLiberada, temDigitalNoAparelho, devePerguntarCadastro, adiarCadastro, naoPerguntarMais, cadastrarDigital, listarAparelhos, removerAparelho, esquecerDigitalDoAparelho, K_ID } from "./digital";

const NIVEIS = ["gerencial", "cliente"];
const painel = { position: "fixed", left: 12, bottom: "calc(12px + env(safe-area-inset-bottom, 0px))", zIndex: 60, maxWidth: "min(92vw, 360px)", background: "#1F2937", color: "#F3F4F6", border: "1px solid #3b4859", borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,.35)", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" };
const btn = (forte) => ({ background: forte ? "#38bdf8" : "transparent", color: forte ? "#062033" : "#CBD5E1", border: `1px solid ${forte ? "#38bdf8" : "#3b4859"}`, borderRadius: 6, padding: "8px 12px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" });
const fmt = (iso) => { try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); } catch { return ""; } };

export default function OfertaDigital() {
  const [sess, setSess] = useState(() => getSession());
  const [liberada, setLiberada] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [itens, setItens] = useState(null);
  const [neste, setNeste] = useState(() => temDigitalNoAparelho());

  useEffect(() => {
    const f = () => setSess(getSession());
    window.addEventListener("moklog-auth-changed", f);
    return () => window.removeEventListener("moklog-auth-changed", f);
  }, []);
  const elegivel = !!(sess && NIVEIS.includes(sess.nivel));
  useEffect(() => {
    let vivo = true;
    if (!elegivel) { setLiberada(false); setAberto(false); return undefined; }
    (async () => {
      try { const l = await digitalLiberada(); if (!vivo) return; setLiberada(l); setNeste(temDigitalNoAparelho()); if (l && devePerguntarCadastro()) setAberto(true); } catch { /* só PIN */ }
    })();
    return () => { vivo = false; };
  }, [elegivel]);

  const carregar = useCallback(async () => {
    const s = getSession(); if (!s) return;
    const r = await listarAparelhos({ token: s.token });
    setItens(r.ok ? r.itens : []);
  }, []);
  useEffect(() => { if (aberto && liberada && neste) carregar(); }, [aberto, liberada, neste, carregar]);

  if (!elegivel || !liberada) return null;
  if (!aberto) return <button type="button" onClick={() => setAberto(true)} data-testid="digital-chip" aria-label="Digital neste aparelho" style={{ ...painel, padding: "7px 11px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", color: "#CBD5E1" }}>🔐 Digital</button>;

  const ativar = async () => {
    const s = getSession(); if (!s || busy) return;
    setBusy(true); setMsg("");
    const r = await cadastrarDigital({ token: s.token });
    setBusy(false);
    if (r.ok) { setNeste(true); setMsg("Pronto: neste aparelho você entra com a digital. O PIN continua valendo."); carregar(); }
    else if (!r.cancelado) setMsg(r.erro || "Não foi possível ativar agora.");
  };
  const remover = async (id) => {
    const s = getSession(); if (!s || busy) return;
    setBusy(true);
    const r = await removerAparelho({ token: s.token, id });
    setBusy(false);
    if (r.ok) { setNeste(temDigitalNoAparelho()); setMsg("Aparelho removido."); carregar(); } else setMsg(r.erro || "Não foi possível remover.");
  };
  const idAqui = (() => { try { return window.localStorage.getItem(K_ID); } catch { return null; } })();

  return <div style={{ ...painel, padding: 14 }} role="dialog" aria-label="Entrar com digital" data-testid="digital-painel">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: 13.5, fontWeight: 900 }}>🔐 Entrar com digital / Face ID</div>
      <button type="button" onClick={() => { if (!neste) adiarCadastro(); setAberto(false); }} aria-label="Fechar" style={{ ...btn(false), padding: "3px 9px" }}>✕</button>
    </div>
    {!neste
      ? <>
        <div style={{ fontSize: 12, color: "#CBD5E1", marginTop: 6, lineHeight: 1.4 }}>Ative neste aparelho para entrar sem digitar o PIN. A digital fica só no aparelho; o PIN continua sempre disponível.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button type="button" onClick={ativar} disabled={busy} style={btn(true)} data-testid="digital-ativar">{busy ? "Aguardando…" : "Ativar neste aparelho"}</button>
          <button type="button" onClick={() => { adiarCadastro(); setAberto(false); }} style={btn(false)}>Agora não</button>
          <button type="button" onClick={() => { naoPerguntarMais(); setAberto(false); }} style={btn(false)}>Aparelho compartilhado</button>
        </div>
      </>
      : <div style={{ fontSize: 12, color: "#CBD5E1", marginTop: 6 }}>Ativa neste aparelho. Aparelhos cadastrados:</div>}
    {neste && (itens === null ? <div style={{ fontSize: 12, color: "#CBD5E1", marginTop: 8 }}>Lendo…</div>
      : <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, maxHeight: 180, overflowY: "auto" }}>
        {itens.map((i) => <li key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid #3b4859", fontSize: 12 }}>
          <span>{i.rotulo}{i.id === idAqui ? " (este)" : ""} · {i.grupo !== "admin" ? i.grupo.replace("cliente:", "") + " · " : ""}{i.ultimoUsoEm ? `usado ${fmt(i.ultimoUsoEm)}` : `criado ${fmt(i.criadoEm)}`}</span>
          <button type="button" onClick={() => remover(i.id)} disabled={busy} style={btn(false)}>Remover</button>
        </li>)}
        {itens.length === 0 && <li style={{ fontSize: 12, color: "#CBD5E1" }}>Nenhum aparelho.</li>}
      </ul>)}
    {neste && <button type="button" onClick={() => { esquecerDigitalDoAparelho(); setNeste(false); setMsg("Neste aparelho a digital deixou de ser usada. Para apagar o cadastro no servidor, use Remover."); }} style={{ ...btn(false), marginTop: 8 }}>Parar de usar neste aparelho</button>}
    {msg && <div role="status" style={{ fontSize: 12, color: "#bae6fd", marginTop: 8, lineHeight: 1.4 }}>{msg}</div>}
  </div>;
}
