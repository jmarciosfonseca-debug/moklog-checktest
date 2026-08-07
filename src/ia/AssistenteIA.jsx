// ─────────────────────────────────────────────────────────────
// AssistenteIA.jsx — Drawer do Assistente IA Gerencial MokLog (FRONTEND)
//
// Autossuficiente. Recebe apenas { open, onClose }. Usa iaClient para
// falar com o backend. Tema escuro Moked (mesma paleta do painel),
// responsivo e seguro para iPhone (safe-area, sem <form>).
//
// Uso no App.jsx (dentro do Painel Gerencial):
//   import AssistenteIA, { BotaoIA } from "./ia/AssistenteIA";
//   const [iaOpen, setIaOpen] = useState(false);
//   <BotaoIA onClick={() => setIaOpen(true)} />
//   <AssistenteIA open={iaOpen} onClose={() => setIaOpen(false)} />
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from "react";
import { abrirSessao, perguntar, hasValidToken } from "./iaClient";

const RED = "#cc2222";
const BG = "#060c18";
const BG2 = "#020510";
const TXT = "#f1f5f9";
const MUTED = "#94a3b8";
const BORDER = "#0f172a";
const ACCENT = "#0ea5e9";

const SUGESTOES = [
  "Quais projetos precisam de atenção agora?",
  "Qual projeto está há mais tempo offline na CTMK?",
  "Não conformidades das rondas dos últimos 7 dias",
  "Quais ocorrências continuam sem encerramento?",
  "Resuma a situação do P311B",
  "Quais equipamentos estão INOP há mais de 30 dias?",
];

// Botão flutuante de acesso (renderizar no painel gerencial).
export function BotaoIA({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Abrir Assistente IA MokLog"
      style={{
        position: "fixed", right: 16, bottom: "calc(84px + env(safe-area-inset-bottom, 0px))",
        zIndex: 9998, width: 56, height: 56, borderRadius: "50%",
        background: `linear-gradient(135deg, ${RED}, #7a1414)`,
        border: "1px solid rgba(255,255,255,.12)", color: "#fff",
        fontSize: 22, cursor: "pointer", boxShadow: "0 6px 20px rgba(0,0,0,.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      ✨
    </button>
  );
}

function Bolha({ role, children }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div style={{
        maxWidth: "86%", padding: "10px 12px", borderRadius: 12,
        background: isUser ? "#0b1e33" : "#0a1120",
        border: `1px solid ${isUser ? "#12395e" : BORDER}`,
        color: TXT, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {children}
      </div>
    </div>
  );
}

export default function AssistenteIA({ open, onClose }) {
  const [pin, setPin] = useState("");
  const [autenticado, setAutenticado] = useState(() => hasValidToken());
  const [erroAuth, setErroAuth] = useState("");
  const [mensagens, setMensagens] = useState([]); // {role, content, asOf?, tools?}
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensagens, carregando]);

  useEffect(() => { if (open) setAutenticado(hasValidToken()); }, [open]);

  if (!open) return null;

  async function entrar() {
    setErroAuth("");
    try {
      await abrirSessao(pin.trim());
      setAutenticado(true);
      setPin("");
    } catch (e) {
      setErroAuth(e.message || "PIN inválido.");
    }
  }

  async function enviar(texto) {
    const pergunta = (texto != null ? texto : input).trim();
    if (!pergunta || carregando) return;
    setErro("");
    setInput("");
    const novoHistorico = [...mensagens, { role: "user", content: pergunta }];
    setMensagens(novoHistorico);
    setCarregando(true);
    abortRef.current = new AbortController();
    try {
      const historyParaApi = novoHistorico
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content }));
      const { answer, toolsUsed, asOf } = await perguntar(pergunta, historyParaApi.slice(0, -1), abortRef.current.signal);
      setMensagens(m => [...m, { role: "assistant", content: answer, asOf, tools: toolsUsed }]);
    } catch (e) {
      if (e.name === "AbortError") {
        setMensagens(m => [...m, { role: "assistant", content: "Consulta cancelada." }]);
      } else if (e.message === "SESSAO_EXPIRADA") {
        setAutenticado(false);
        setErro("Sua sessão expirou. Informe o PIN gerencial novamente.");
      } else {
        setErro(e.message || "Erro ao consultar a IA.");
      }
    } finally {
      setCarregando(false);
      abortRef.current = null;
    }
  }

  function cancelar() {
    if (abortRef.current) abortRef.current.abort();
  }

  function novaConversa() {
    setMensagens([]);
    setErro("");
  }

  const fmtHora = (iso) => {
    try { return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }); }
    catch { return ""; }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
        zIndex: 9999, display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 100%)", height: "100%", background: BG,
          borderLeft: `1px solid ${BORDER}`, display: "flex", flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Cabeçalho */}
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${BORDER}`, background: BG2, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${RED}, #7a1414)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✨</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: TXT }}>Assistente IA <span style={{ color: RED }}>MokLog</span></div>
            <div style={{ fontSize: 11, color: MUTED }}>Consulta dados operacionais atuais · somente leitura</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "none", border: "none", color: MUTED, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {!autenticado ? (
          // Gate: PIN gerencial (validado no servidor).
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: MUTED }}>Informe o PIN gerencial para usar o assistente.</div>
            <input
              type="password" inputMode="numeric" value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") entrar(); }}
              placeholder="PIN gerencial"
              style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#0a1120", color: TXT, fontSize: 16, outline: "none" }}
            />
            {erroAuth ? <div style={{ fontSize: 12, color: "#ef4444" }}>{erroAuth}</div> : null}
            <button onClick={entrar} style={{ padding: "12px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${RED}, #7a1414)`, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Entrar</button>
          </div>
        ) : (
          <>
            {/* Corpo / mensagens */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {mensagens.length === 0 ? (
                <div>
                  <div style={{ fontSize: 13, color: MUTED, marginBottom: 12 }}>Pergunte sobre a operação. Exemplos:</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {SUGESTOES.map((s, i) => (
                      <button key={i} onClick={() => enviar(s)} style={{ textAlign: "left", padding: "10px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#0a1120", color: TXT, fontSize: 13, cursor: "pointer" }}>{s}</button>
                    ))}
                  </div>
                </div>
              ) : (
                mensagens.map((m, i) => (
                  <div key={i}>
                    <Bolha role={m.role}>{m.content}</Bolha>
                    {m.role === "assistant" && (m.asOf || (m.tools && m.tools.length)) ? (
                      <div style={{ fontSize: 10, color: MUTED, margin: "-4px 0 10px 2px" }}>
                        {m.asOf ? `Referência: ${fmtHora(m.asOf)}` : ""}
                        {m.tools && m.tools.length ? ` · Fontes: ${[...new Set(m.tools)].join(", ")}` : ""}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
              {carregando ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: ACCENT, fontSize: 13, padding: "6px 2px" }}>
                  <span className="ia-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT, animation: "iaPulse 1s infinite" }} />
                  Consultando dados atuais…
                </div>
              ) : null}
            </div>

            {/* Aviso */}
            <div style={{ fontSize: 10, color: MUTED, padding: "0 16px 8px", lineHeight: 1.4 }}>
              As respostas devem ser confirmadas antes de decisões críticas.
            </div>

            {/* Barra de entrada */}
            <div style={{ borderTop: `1px solid ${BORDER}`, padding: 12, background: BG2 }}>
              {erro ? <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>{erro}</div> : null}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  placeholder="Pergunte sobre a operação…"
                  rows={1}
                  style={{ flex: 1, resize: "none", maxHeight: 120, padding: "10px 12px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#0a1120", color: TXT, fontSize: 15, outline: "none", fontFamily: "inherit" }}
                />
                {carregando ? (
                  <button onClick={cancelar} style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid #ef4444`, background: "transparent", color: "#ef4444", fontSize: 14, cursor: "pointer" }}>Cancelar</button>
                ) : (
                  <button onClick={() => enviar()} disabled={!input.trim()} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: input.trim() ? `linear-gradient(135deg, ${RED}, #7a1414)` : "#1e293b", color: "#fff", fontSize: 14, fontWeight: 700, cursor: input.trim() ? "pointer" : "default" }}>Enviar</button>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button onClick={novaConversa} style={{ background: "none", border: "none", color: MUTED, fontSize: 12, cursor: "pointer" }}>Nova conversa</button>
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes iaPulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
    </div>
  );
}
