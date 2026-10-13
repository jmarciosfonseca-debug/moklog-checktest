// Painel da Moked para o follow-up externo (piloto P601): gera/revoga links, mostra com quem está cada item
// e deixa a Moked encaminhar à administração, devolver à manutenção ou concluir.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { gerencial, urlDoLink } from "./api";
import { comQuemInfo, resumoPorMao, ROTULO_STATUS, semRetorno, diasSemRetorno, DIAS_SEM_RETORNO } from "./config";
import { loadFollowups, canonicalFollowupKey, concluirFollowup } from "../followups";

const K = { card: "#060c18", borda: "#1e293b", texto: "#f1f5f9", mudo: "#94a3b8", marca: "#cc2222" };
const btn = { background: "#0f172a", color: K.texto, border: `1px solid ${K.borda}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const btnPrim = { ...btn, background: "#1d4ed8", borderColor: "#1d4ed8" };
const inp = { background: "#0b1220", color: K.texto, border: `1px solid ${K.borda}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, width: "100%", boxSizing: "border-box" };

export const itensEmAberto = (pendencias) => pendencias.map((p) => ({
  key: canonicalFollowupKey(p.project.id, p.cat, p.item || "—"),
  cat: p.cat, item: p.item || "—", status: p.status, since: p.since || "", note: p.note || "",
}));

function BlocoLink({ titulo, ajuda, papel, link, pid, nomeProjeto, itens, onMudou, db }) {
  const [empresa, setEmpresa] = useState("");
  const [dias, setDias] = useState(15);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const url = link ? urlDoLink(link.token) : "";
  useEffect(() => { let vivo = true; if (url) QRCode.toDataURL(url, { margin: 1, width: 240 }).then((d) => vivo && setQr(d)).catch(() => {}); else setQr(""); return () => { vivo = false; }; }, [url]);
  const rodar = async (fn) => { setBusy(true); setMsg(""); try { await fn(); await onMudou(); } catch (e) { setMsg(e.message); } finally { setBusy(false); } };
  const copiar = async () => { try { await navigator.clipboard.writeText(url); setMsg("Link copiado."); } catch { window.prompt("Copie o link:", url); } };
  return (
    <div style={{ background: K.card, border: `1px solid ${K.borda}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: K.texto }}>{titulo}</div>
      <div style={{ fontSize: 11, color: K.mudo, marginBottom: 8 }}>{ajuda}</div>
      {!link ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px auto", gap: 6, alignItems: "end" }}>
          <div><div style={{ fontSize: 10, color: K.mudo, fontWeight: 700 }}>{papel === "manutencao" ? "EMPRESA DE MANUTENÇÃO" : "ADMINISTRAÇÃO / PROPRIETÁRIO"}</div><input style={inp} value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome (aparece nas tratativas)" maxLength={80} /></div>
          <div><div style={{ fontSize: 10, color: K.mudo, fontWeight: 700 }}>VALIDADE</div><select style={inp} value={dias} onChange={(e) => setDias(Number(e.target.value))}>{[7, 15, 30, 60].map((d) => <option key={d} value={d}>{d} dias</option>)}</select></div>
          <button type="button" disabled={busy || !empresa.trim()} style={{ ...btnPrim, opacity: busy || !empresa.trim() ? 0.5 : 1 }}
            onClick={() => rodar(() => gerencial("criar", { pid, papel, empresa: empresa.trim(), projetoNome: nomeProjeto, dias, itens }))}>Gerar link</button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: K.mudo, marginBottom: 4 }}>{link.empresa} · válido até {new Date(link.expiraEm).toLocaleDateString("pt-BR")}{link.ultimoAcesso ? ` · último acesso ${new Date(link.ultimoAcesso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : " · ainda não acessado"}</div>
          <input style={inp} readOnly value={url} onFocus={(e) => e.target.select()} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "flex-start" }}>
            <button type="button" style={btnPrim} onClick={copiar}>Copiar link</button>
            <a href={url} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: "none" }}>Abrir</a>
            <button type="button" style={btn} disabled={busy} onClick={() => rodar(() => gerencial("renovar", { pid, id: link.id, dias: 15 }))}>Renovar +15 dias</button>
            <button type="button" style={{ ...btn, color: "#f87171" }} disabled={busy} onClick={() => { if (window.confirm("Revogar este link? Quem tem o link perde o acesso imediatamente.")) rodar(() => gerencial("revogar", { pid, id: link.id })); }}>Revogar</button>
          </div>
          {qr && <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}><img src={qr} alt="QR Code do link" width={120} height={120} style={{ background: "#fff", borderRadius: 6 }} /><a href={qr} download={`QR-followup-${pid}-${papel}.png`} style={{ ...btn, textDecoration: "none" }}>Baixar QR Code</a></div>}
        </>
      )}
      {msg && <div role="status" style={{ fontSize: 11, color: "#fbbf24", marginTop: 6 }}>{msg}</div>}
    </div>
  );
}

export default function GestaoLinks({ db, project, pendencias, onFechar }) {
  const pid = project.id;
  const itens = useMemo(() => itensEmAberto(pendencias), [pendencias]);
  const [links, setLinks] = useState([]);
  const [mapa, setMapa] = useState({});
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState("");

  const carregar = useCallback(async () => {
    try {
      await gerencial("sincronizar", { pid, itens }); // mantém a lista dos links igual ao último teste
      const [l, m] = await Promise.all([gerencial("listar", { pid }), loadFollowups(db, pid)]);
      setLinks(l.links || []); setMapa(m || {}); setErro("");
    } catch (e) { setErro(e.message); }
  }, [db, pid, itens]);
  useEffect(() => { carregar(); }, [carregar]);

  const comItem = itens.map((i) => ({ ...i, reg: mapa[i.key] || null, comQuem: mapa[i.key]?.comQuem || "manutencao", resolvido: !!mapa[i.key]?.resolvido })).filter((i) => !i.resolvido);
  const contagem = resumoPorMao(comItem);
  const naFila = comItem.filter((i) => i.comQuem === "moked");
  const parados = comItem.filter((i) => semRetorno(i.comQuem, i.reg)); // com a manutenção e sem retorno há DIAS_SEM_RETORNO dias ou mais
  const linkDe = (papel) => links.find((l) => l.papel === papel);

  const acao = async (key, fn) => { setBusy(key); setErro(""); try { await fn(); await carregar(); } catch (e) { setErro(e.message); } finally { setBusy(""); } };
  const ultima = (reg) => (reg && reg.entries && reg.entries[0]) || null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 1000, display: "flex", justifyContent: "center", overflowY: "auto", padding: 12 }}>
      <div style={{ background: "#04080f", border: `1px solid ${K.borda}`, borderRadius: 14, width: "100%", maxWidth: 720, height: "fit-content", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: K.texto }}>Follow-up externo · {pid} <span style={{ fontSize: 10, color: "#fbbf24", border: "1px solid #fbbf24", borderRadius: 6, padding: "1px 5px", marginLeft: 6 }}>PILOTO</span></div>
            <div style={{ fontSize: 11, color: K.mudo }}>Quem está com a bola em cada pendência e os links para manutenção e administração.</div>
          </div>
          <button type="button" style={btn} onClick={onFechar}>Fechar</button>
        </div>
        {erro && <div role="alert" style={{ background: "#450a0a", color: "#fecaca", borderRadius: 8, padding: 8, fontSize: 12, marginBottom: 8 }}>{erro}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
          {["manutencao", "moked", "administracao"].map((q) => { const i = comQuemInfo(q); return (
            <div key={q} style={{ background: K.card, border: `1px solid ${K.borda}`, borderRadius: 10, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: i.fundo }}>{contagem[q]}</div>
              <div style={{ fontSize: 10, color: K.mudo, fontWeight: 700 }}>{i.label}</div>
            </div>); })}
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, color: K.texto, margin: "4px 0 6px" }}>Para a Moked agir ({naFila.length})</div>
        {!naFila.length && <div style={{ fontSize: 12, color: K.mudo, marginBottom: 10 }}>Nada aguardando a Moked. Quando a manutenção enviar uma proposta ou um serviço executado, aparece aqui.</div>}
        {naFila.map((i) => { const u = ultima(i.reg); return (
          <div key={i.key} style={{ background: K.card, border: `1px solid ${K.borda}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: K.texto }}>{i.item && i.item !== "—" ? i.item : i.cat} <span style={{ fontWeight: 400, color: K.mudo }}>{i.item && i.item !== "—" ? `· ${i.cat}` : ""}</span></div>
            {u && <div style={{ fontSize: 12, color: K.mudo, margin: "4px 0 8px" }}>
              <b style={{ color: K.texto }}>{ROTULO_STATUS[u.status] || u.status}</b>{u.proposta ? ` · proposta nº ${u.proposta.numero}${u.proposta.valor ? ` · ${u.proposta.valor}` : ""}` : ""}{u.previsao ? ` · previsão ${u.previsao}` : ""} · {u.responsavel}
              {u.texto && <div style={{ color: "#cbd5e1", whiteSpace: "pre-wrap" }}>{u.texto}</div>}
            </div>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" style={btnPrim} disabled={busy === i.key} onClick={() => acao(i.key, () => gerencial("mover", { pid, key: i.key, para: "administracao" }))}>Encaminhar à administração</button>
              <button type="button" style={btn} disabled={busy === i.key} onClick={() => acao(i.key, () => gerencial("mover", { pid, key: i.key, para: "manutencao", texto: window.prompt("Motivo da devolução (opcional):") || "" }))}>Devolver à manutenção</button>
              <button type="button" style={{ ...btn, color: "#4ade80" }} disabled={busy === i.key} onClick={() => { if (window.confirm("Marcar este item como concluído?")) acao(i.key, () => concluirFollowup(db, pid, i.key)); }}>Concluir</button>
            </div>
          </div>); })}

        {parados.length > 0 && (
          <div style={{ background: "#1c1407", border: "1px solid #78350f", borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#fbbf24" }}>Com a manutenção sem retorno há {DIAS_SEM_RETORNO}+ dias ({parados.length})</div>
            {parados.slice(0, 8).map((i) => { const d = diasSemRetorno(i.reg); return (
              <div key={i.key} style={{ fontSize: 12, color: "#e2e8f0", marginTop: 4 }}>• {i.item && i.item !== "—" ? i.item : i.cat} <span style={{ color: K.mudo }}>{d === null ? "— nunca teve retorno" : `— último retorno há ${d} dias`}</span></div>); })}
            {parados.length > 8 && <div style={{ fontSize: 11, color: K.mudo, marginTop: 4 }}>e mais {parados.length - 8}…</div>}
            {linkDe("manutencao") && <button type="button" style={{ ...btn, marginTop: 8 }} onClick={async () => {
              const msg = `Olá! No ${project.id} - ${project.name} há ${parados.length} item(ns) aguardando retorno da manutenção. Por favor, acesse o link e informe a situação de cada um (análise do técnico, proposta ou execução): ${urlDoLink(linkDe("manutencao").token)}`;
              try { await navigator.clipboard.writeText(msg); setErro(""); window.alert("Mensagem de cobrança copiada. Cole no WhatsApp ou e-mail."); } catch { window.prompt("Copie a mensagem:", msg); }
            }}>Copiar mensagem de cobrança</button>}
          </div>)}

        <div style={{ fontSize: 12, fontWeight: 800, color: K.texto, margin: "14px 0 6px" }}>Links</div>
        <BlocoLink titulo="Link da empresa de manutenção" ajuda="Ela vê os itens em aberto, informa situação, proposta (nº e valor) e usa Concluir e enviar."
          papel="manutencao" link={linkDe("manutencao")} pid={pid} nomeProjeto={project.name} itens={itens} onMudou={carregar} db={db} />
        <BlocoLink titulo="Link da administração / proprietário" ajuda="Vê só o que você encaminhar e aprova ou reprova. Aprovado volta para a manutenção executar."
          papel="administracao" link={linkDe("administracao")} pid={pid} nomeProjeto={project.name} itens={itens} onMudou={carregar} db={db} />
        <div style={{ fontSize: 10, color: K.mudo }}>Os links não pedem PIN. Quem tem o link acessa só este projeto e só a lista de pendências. Use o QR Code no PDF ou o link no WhatsApp; revogue a qualquer momento.</div>
      </div>
    </div>
  );
}
