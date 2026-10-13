// Página pública do link de follow-up (?fu=TOKEN). Sem login: o token é a credencial.
// Manutenção: preenche a situação de cada item e usa "Concluir e enviar" (sai da mão dela e cai na Moked).
// Administração: aprova ou reprova as propostas que a Moked encaminhou.
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { publico } from "./api";
import { SITUACOES_MANUTENCAO, ROTULO_STATUS, comQuemInfo, resumoPorMao } from "./config";

const C = { fundo: "#f1f5f9", card: "#ffffff", borda: "#e2e8f0", texto: "#0f172a", mudo: "#64748b", marca: "#B21E27", ok: "#15803d" };
const pagina = { minHeight: "100vh", background: C.fundo, color: C.texto, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif", paddingBottom: 110 };
const miolo = { width: "100%", maxWidth: 760, margin: "0 auto", padding: "0 16px" };
const campo = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.borda}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, background: "#fff", color: C.texto, fontFamily: "inherit" };
const rotuloCampo = { display: "block", fontSize: 12, fontWeight: 700, color: C.mudo, margin: "10px 0 4px" };

const fmtData = (iso) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR") : ""; };
const fmtDataHora = (iso) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""; };

function Selo({ children, cor, fundo }) {
  return <span style={{ display: "inline-block", fontSize: 11, fontWeight: 800, color: cor, background: fundo, padding: "3px 8px", borderRadius: 999 }}>{children}</span>;
}

function Historico({ itens = [] }) {
  if (!itens.length) return null;
  return (
    <div style={{ marginTop: 10, borderTop: `1px dashed ${C.borda}`, paddingTop: 8 }}>
      {itens.map((h, i) => (
        <div key={i} style={{ fontSize: 12, color: C.mudo, marginBottom: 6 }}>
          <b style={{ color: C.texto }}>{ROTULO_STATUS[h.status] || h.status}</b>
          {h.proposta && <> · proposta nº {h.proposta.numero}{h.proposta.valor ? ` · ${h.proposta.valor}` : ""}</>}
          {h.previsao && <> · previsão {h.previsao}</>}
          <span> · {fmtDataHora(h.em)}{h.responsavel ? ` · ${h.responsavel}` : ""}</span>
          {h.texto && <div style={{ color: C.texto, marginTop: 2, whiteSpace: "pre-wrap" }}>{h.texto}</div>}
        </div>
      ))}
    </div>
  );
}

function Cabecalho({ item }) {
  const inop = item.status === "inop";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "space-between" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{item.item && item.item !== "—" ? item.item : item.cat}</div>
        {item.item && item.item !== "—" && <div style={{ fontSize: 12, color: C.mudo }}>{item.cat}</div>}
        {item.note && <div style={{ fontSize: 12, color: C.mudo, marginTop: 3 }}>Registro do teste: {item.note}</div>}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <Selo cor={inop ? "#b91c1c" : "#b45309"} fundo={inop ? "#fee2e2" : "#fef3c7"}>{inop ? "INOPERANTE" : "PARCIAL"}</Selo>
        {item.dias != null && <div style={{ fontSize: 12, color: item.dias >= 30 ? "#b91c1c" : C.mudo, fontWeight: 700, marginTop: 4 }}>há {item.dias} dia{item.dias === 1 ? "" : "s"}</div>}
      </div>
    </div>
  );
}

function CartaoManutencao({ item, valor, onChange }) {
  const v = valor || { status: "", texto: "", propostaNumero: "", propostaValor: "", previsao: "" };
  const set = (p) => onChange({ ...v, ...p });
  return (
    <div style={{ background: C.card, border: `1px solid ${v.status ? C.marca : C.borda}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <Cabecalho item={item} />
      <Historico itens={item.historico} />
      <span style={rotuloCampo}>Situação atual</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 6 }}>
        {SITUACOES_MANUTENCAO.map((s) => (
          <button key={s.id} type="button" onClick={() => set({ status: v.status === s.id ? "" : s.id })}
            style={{ textAlign: "left", cursor: "pointer", border: `2px solid ${v.status === s.id ? C.marca : C.borda}`, background: v.status === s.id ? "#fef2f2" : "#fff", borderRadius: 10, padding: "9px 10px", fontFamily: "inherit" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.texto }}>{s.label}</div>
            <div style={{ fontSize: 11, color: C.mudo }}>{s.dica}</div>
          </button>
        ))}
      </div>
      {v.status && (
        <>
          {v.status === "proposta" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><span style={rotuloCampo}>Nº da proposta *</span><input style={campo} value={v.propostaNumero} onChange={(e) => set({ propostaNumero: e.target.value })} placeholder="Ex.: 2026-0412" maxLength={40} inputMode="text" /></div>
              <div><span style={rotuloCampo}>Valor</span><input style={campo} value={v.propostaValor} onChange={(e) => set({ propostaValor: e.target.value })} placeholder="R$ 0,00" maxLength={30} inputMode="decimal" /></div>
            </div>
          )}
          <span style={rotuloCampo}>{v.status === "proposta" ? "Observação (opcional)" : "O que foi verificado / feito *"}</span>
          <textarea style={{ ...campo, resize: "vertical" }} rows={3} maxLength={1000} value={v.texto} onChange={(e) => set({ texto: e.target.value })}
            placeholder={v.status === "aguardando" ? "Ex.: Fonte queimada; técnico agendado para quinta." : v.status === "execucao" ? "Ex.: Haste trocada; falta calibrar o sensor." : v.status === "executado" ? "Ex.: Cancela substituída e testada em 3 ciclos." : "Escopo resumido da proposta"} />
          {v.status !== "executado" && (
            <><span style={rotuloCampo}>Previsão (opcional)</span><input style={campo} type="date" value={v.previsao} onChange={(e) => set({ previsao: e.target.value })} /></>
          )}
        </>
      )}
    </div>
  );
}

function CartaoSomenteLeitura({ item }) {
  const q = comQuemInfo(item.comQuem);
  return (
    <div style={{ background: C.card, border: `1px solid ${C.borda}`, borderRadius: 12, padding: 14, marginBottom: 10, opacity: 0.95 }}>
      <Cabecalho item={item} />
      <div style={{ marginTop: 8 }}><Selo cor={q.cor} fundo={q.fundo}>{q.label}</Selo></div>
      <Historico itens={item.historico.slice(0, 2)} />
    </div>
  );
}

function CartaoDecisao({ item, onDecidir, ocupado }) {
  const [texto, setTexto] = useState("");
  const proposta = item.historico.find((h) => h.proposta) || item.historico[0];
  return (
    <div style={{ background: C.card, border: `2px solid #6d28d9`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <Cabecalho item={item} />
      {proposta && (
        <div style={{ background: "#f5f3ff", borderRadius: 8, padding: 10, marginTop: 10, fontSize: 13 }}>
          {proposta.proposta && <div><b>Proposta nº {proposta.proposta.numero}</b>{proposta.proposta.valor ? ` · ${proposta.proposta.valor}` : ""}</div>}
          {proposta.responsavel && <div style={{ color: C.mudo }}>Enviada por {proposta.responsavel} em {fmtData(proposta.em)}</div>}
          {proposta.previsao && <div style={{ color: C.mudo }}>Previsão de execução: {proposta.previsao}</div>}
          {proposta.texto && <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{proposta.texto}</div>}
        </div>
      )}
      <span style={rotuloCampo}>Comentário (opcional)</span>
      <textarea style={{ ...campo, resize: "vertical" }} rows={2} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Aprovado, pode executar. / Valor acima do orçado." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <button type="button" disabled={ocupado} onClick={() => onDecidir(item.key, "aprovado", texto)} style={{ background: C.ok, color: "#fff", border: 0, borderRadius: 10, padding: "13px 10px", fontSize: 15, fontWeight: 800, cursor: "pointer", opacity: ocupado ? 0.6 : 1 }}>Aprovar</button>
        <button type="button" disabled={ocupado} onClick={() => onDecidir(item.key, "reprovado", texto)} style={{ background: "#fff", color: "#b91c1c", border: "2px solid #b91c1c", borderRadius: 10, padding: "11px 10px", fontSize: 15, fontWeight: 800, cursor: "pointer", opacity: ocupado ? 0.6 : 1 }}>Reprovar</button>
      </div>
    </div>
  );
}

// Só envia o que foi preenchido e está completo.
export function prepararEnvios(rascunhos = {}) {
  const envios = [], faltando = [];
  Object.entries(rascunhos).forEach(([key, v]) => {
    if (!v || !v.status) return;
    if (v.status === "proposta" && !String(v.propostaNumero || "").trim()) { faltando.push({ key, motivo: "Informe o número da proposta" }); return; }
    if (v.status !== "proposta" && !String(v.texto || "").trim()) { faltando.push({ key, motivo: "Descreva o que foi verificado ou feito" }); return; }
    envios.push({ key, status: v.status, texto: v.texto || "", propostaNumero: v.propostaNumero || "", propostaValor: v.propostaValor || "", previsao: v.previsao || "" });
  });
  return { envios, faltando };
}

export default function PaginaExterna({ token }) {
  const [estado, setEstado] = useState({ carregando: true });
  const [rascunhos, setRascunhos] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [enviado, setEnviado] = useState(0);

  const carregar = useCallback(async () => {
    try { const v = await publico("ver", { token }); setEstado({ visao: v }); }
    catch (e) { setEstado({ erro: e.status === 404 ? "Este link é inválido ou expirou. Peça um novo link à Moked." : e.message }); }
  }, [token]);
  useEffect(() => { carregar(); }, [carregar]);

  const visao = estado.visao;
  const manut = visao?.papel === "manutencao";
  const { envios, faltando } = useMemo(() => prepararEnvios(rascunhos), [rascunhos]);
  const paraAgir = useMemo(() => (visao ? visao.itens.filter((i) => i.comQuem === "manutencao") : []), [visao]);
  const deOutros = useMemo(() => (visao ? visao.itens.filter((i) => i.comQuem !== "manutencao") : []), [visao]);
  const paraDecidir = useMemo(() => (visao ? visao.itens.filter((i) => i.comQuem === "administracao") : []), [visao]);
  const emAndamento = useMemo(() => (visao ? visao.itens.filter((i) => i.comQuem !== "administracao") : []), [visao]);

  const concluirEnviar = async () => {
    if (faltando.length) { setAviso(`${faltando.length} item(ns) incompleto(s): ${faltando[0].motivo.toLowerCase()}.`); return; }
    if (!envios.length) return;
    setEnviando(true); setAviso("");
    try { await publico("enviar", { token, envios }); setEnviado(envios.length); setRascunhos({}); await carregar(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (e) { setAviso(e.message); }
    finally { setEnviando(false); }
  };
  const decidir = async (key, decisao, texto) => {
    setEnviando(true); setAviso("");
    try { await publico("decidir", { token, key, decisao, texto }); setEnviado(1); await carregar(); }
    catch (e) { setAviso(e.message); }
    finally { setEnviando(false); }
  };

  if (estado.carregando) return <div style={{ ...pagina, display: "flex", alignItems: "center", justifyContent: "center" }}>Carregando…</div>;
  if (estado.erro) return (
    <div style={{ ...pagina, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div><div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Link indisponível</div><div style={{ color: C.mudo }}>{estado.erro}</div></div>
    </div>
  );

  const mãos = resumoPorMao(visao.itens);
  return (
    <div style={pagina}>
      <div style={{ background: "#fff", borderBottom: `3px solid ${C.marca}`, marginBottom: 16 }}>
        <div style={{ ...miolo, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.marca, letterSpacing: 1 }}>MOKED · FOLLOW-UP {manut ? "DE MANUTENÇÃO" : "DA ADMINISTRAÇÃO"}</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{visao.pid} — {visao.projeto}</div>
          <div style={{ fontSize: 12, color: C.mudo }}>{visao.empresa ? `${visao.empresa} · ` : ""}itens em aberto atualizados em {fmtDataHora(visao.itensEm)} · link válido até {fmtData(visao.expiraEm)}</div>
        </div>
      </div>
      <div style={miolo}>
        {enviado > 0 && (
          <div role="status" style={{ background: "#dcfce7", border: "1px solid #86efac", color: "#14532d", borderRadius: 10, padding: 12, marginBottom: 12, fontWeight: 700 }}>
            {manut ? `Enviado: ${enviado} item(ns) seguiram para a Moked.` : "Decisão registrada. O item voltou para a Moked/manutenção."}
          </div>
        )}
        {aviso && <div role="alert" style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#7f1d1d", borderRadius: 10, padding: 12, marginBottom: 12, fontWeight: 700 }}>{aviso}</div>}

        {manut ? (
          <>
            <p style={{ fontSize: 14, color: C.mudo, marginTop: 0 }}>Escolha a situação de cada item sob sua responsabilidade e descreva. Se já enviou proposta, informe o número e o valor. Ao terminar, toque em <b>Concluir e enviar</b>. Itens que você não preencher ficam como estão.</p>
            <h2 style={{ fontSize: 15, margin: "16px 0 8px" }}>Para você tratar ({paraAgir.length})</h2>
            {!paraAgir.length && <div style={{ color: C.mudo, background: "#fff", border: `1px solid ${C.borda}`, borderRadius: 12, padding: 14 }}>Nenhum item pendente com você neste momento.</div>}
            {paraAgir.map((it) => <CartaoManutencao key={it.key} item={it} valor={rascunhos[it.key]} onChange={(v) => setRascunhos((r) => ({ ...r, [it.key]: v }))} />)}
            {deOutros.length > 0 && (<><h2 style={{ fontSize: 15, margin: "20px 0 8px" }}>Já enviados ({deOutros.length})</h2>{deOutros.map((it) => <CartaoSomenteLeitura key={it.key} item={it} />)}</>)}
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: C.mudo, marginTop: 0 }}>Estas são as propostas encaminhadas pela Moked para sua decisão. Ao aprovar, o item volta para a empresa de manutenção executar.</p>
            <h2 style={{ fontSize: 15, margin: "16px 0 8px" }}>Aguardando sua decisão ({paraDecidir.length})</h2>
            {!paraDecidir.length && <div style={{ color: C.mudo, background: "#fff", border: `1px solid ${C.borda}`, borderRadius: 12, padding: 14 }}>Nenhuma proposta aguardando sua decisão.</div>}
            {paraDecidir.map((it) => <CartaoDecisao key={it.key} item={it} ocupado={enviando} onDecidir={decidir} />)}
            {emAndamento.length > 0 && (<><h2 style={{ fontSize: 15, margin: "20px 0 8px" }}>Demais itens em andamento ({emAndamento.length})</h2>{emAndamento.map((it) => <CartaoSomenteLeitura key={it.key} item={it} />)}</>)}
          </>
        )}
        <div style={{ fontSize: 11, color: C.mudo, textAlign: "center", marginTop: 24 }}>
          Com a manutenção {mãos.manutencao} · Com a Moked {mãos.moked} · Aguardando a administração {mãos.administracao}<br />MokLog CheckTest © Moked Security Consulting
        </div>
      </div>

      {manut && paraAgir.length > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#fff", borderTop: `1px solid ${C.borda}`, padding: "10px 16px calc(10px + env(safe-area-inset-bottom))", boxShadow: "0 -4px 16px rgba(15,23,42,.08)" }}>
          <div style={{ ...miolo, padding: 0, display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1, fontSize: 13, color: C.mudo }}>{envios.length ? <><b style={{ color: C.texto }}>{envios.length}</b> item(ns) preenchido(s){faltando.length ? ` · ${faltando.length} incompleto(s)` : ""}</> : "Preencha ao menos um item"}</div>
            <button type="button" onClick={concluirEnviar} disabled={enviando || !envios.length}
              style={{ background: C.marca, color: "#fff", border: 0, borderRadius: 10, padding: "13px 20px", fontSize: 15, fontWeight: 800, cursor: envios.length ? "pointer" : "default", opacity: enviando || !envios.length ? 0.55 : 1 }}>
              {enviando ? "Enviando…" : "Concluir e enviar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
