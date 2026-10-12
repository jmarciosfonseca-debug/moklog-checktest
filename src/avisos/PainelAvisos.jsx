// Painel de Avisos da Home (substitui "Saúde Geral da Operação"). Ao abrir o app mostra o que exige atenção AGORA e
// se atualiza sozinho. Cada aviso é calculado do estado atual (regras.js): resolveu, some.
import { useEffect, useMemo, useRef, useState } from "react";
import { Ico } from "../Icones";
import { AVISOS_CFG } from "./config";
import { calcularAvisos } from "./regras";
import { assinarFontes, ROTULO_FONTE } from "./fontes";
import { lerVisto, gravarVisto, marcarNovos } from "./visto";

const COR = { critico: "#ef4444", atencao: "#f59e0b", info: "#64748b" };
const ROTULO_SEV = { critico: "crítico", atencao: "atenção", info: "informativo" };
const ICONE = { falta: "usuario", vago: "usuarios", atraso: "relogio", mapa: "prancheta", material: "ferramenta", supervisao: "olho", keyaccess: "chave", ctmk: "antena", energia: "raio", manutencao: "ferramenta", inop: "alerta", relatorio: "calendario", iluminacao: "lampada", bolsao: "estacionamento" };
const hhmm = (d) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function PainelAvisosView({ avisos, contagem, carregando, falhas = [], offline = false, dark, atualizadoEm, nomeProj = (p) => p, aberto, onToggle, onAbrir, visiveis = AVISOS_CFG.visiveis }) {
  const txt = dark ? "#f1f5f9" : "#0f172a";
  const txt2 = dark ? "#94a3b8" : "#64748b";
  const linha = dark ? "#0f172a" : "#eef2f7";
  const lista = aberto ? avisos : avisos.slice(0, visiveis);
  const temCritico = contagem.critico > 0;
  const corBorda = carregando ? (dark ? "#263248" : "#cbd5e1") : temCritico ? COR.critico : contagem.atencao ? COR.atencao : falhas.length ? COR.atencao : "#22c55e";
  const total = avisos.length;
  return (
    <div data-testid="painel-avisos" style={{ marginTop: 10, background: dark ? "linear-gradient(165deg,#0c1526 0%,#060c18 70%)" : "linear-gradient(165deg,#ffffff 0%,#f8fafc 100%)", border: `1px solid ${corBorda}55`, borderRadius: 14, padding: "12px 14px", boxShadow: dark ? "0 8px 22px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04)" : "0 4px 14px rgba(15,23,42,.08)" }}>
      <style>{`@keyframes mkAvisoPulso{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: offline ? COR.atencao : "#22c55e", flexShrink: 0, animation: offline || carregando ? "none" : "mkAvisoPulso 2s ease-in-out infinite" }} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: txt }}>Painel de Avisos</div>
          <div style={{ fontSize: 10.5, color: txt2 }} data-testid="avisos-status">
            {offline ? "Sem conexão — mostrando o último dado deste aparelho" : carregando ? "Lendo as fontes…" : `Ao vivo${atualizadoEm ? ` · atualizado ${hhmm(atualizadoEm)}` : ""}`}
          </div>
        </div>
        {!carregando && total > 0 && (
          <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
            {contagem.critico > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: COR.critico, background: COR.critico + "1f", border: `1px solid ${COR.critico}55`, borderRadius: 7, padding: "2px 8px" }}>{contagem.critico} crítico{contagem.critico === 1 ? "" : "s"}</span>}
            {contagem.atencao > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: COR.atencao, background: COR.atencao + "1f", border: `1px solid ${COR.atencao}55`, borderRadius: 7, padding: "2px 8px" }}>{contagem.atencao} atenção</span>}
          </div>
        )}
      </div>

      {falhas.length > 0 && !carregando && (
        <div role="alert" style={{ fontSize: 11, color: COR.atencao, background: COR.atencao + "14", border: `1px solid ${COR.atencao}44`, borderRadius: 8, padding: "6px 10px", marginBottom: 8 }}>
          Não consegui ler: {falhas.map((f) => ROTULO_FONTE[f] || f).join(", ")}. Os avisos podem estar incompletos.
        </div>
      )}

      {!carregando && total === 0 && falhas.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 4px", color: "#22c55e", fontSize: 13, fontWeight: 700 }}>
          <span style={{ display: "flex", fontSize: 18 }}><Ico n="checkCirculo" /></span> Tudo em dia — nenhum aviso agora.
        </div>
      )}

      {lista.map((a) => (
        <button key={a.id} onClick={() => onAbrir && onAbrir(a)} data-testid="aviso" aria-label={`${ROTULO_SEV[a.sev]}: ${a.titulo}, ${nomeProj(a.projetoId)}`}
          style={{ display: "flex", alignItems: "flex-start", gap: 9, width: "100%", textAlign: "left", background: "transparent", border: "none", borderTop: `1px solid ${linha}`, borderLeft: `3px solid ${COR[a.sev]}`, padding: "8px 4px 8px 9px", cursor: "pointer", marginTop: 0 }}>
          <span style={{ display: "flex", fontSize: 16, color: COR[a.sev], marginTop: 1, flexShrink: 0 }}><Ico n={ICONE[a.tipo] || "alerta"} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: txt2, background: dark ? "#0f172a" : "#e2e8f0", borderRadius: 5, padding: "1px 6px" }}>{a.projetoId}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: txt }}>{a.titulo}</span>
              {a.novo && <span style={{ fontSize: 9.5, fontWeight: 900, color: "#fff", background: "#2563eb", borderRadius: 5, padding: "1px 6px", letterSpacing: .4 }}>NOVO</span>}
            </div>
            {a.detalhe && <div style={{ fontSize: 11, color: txt2, marginTop: 2, lineHeight: 1.35 }}>{a.detalhe}</div>}
          </div>
          {a.idade && <span style={{ fontSize: 10.5, color: txt2, whiteSpace: "nowrap", flexShrink: 0, marginTop: 2 }}>{a.idade}</span>}
        </button>
      ))}

      {!carregando && total > visiveis && (
        <button onClick={onToggle} style={{ width: "100%", marginTop: 6, background: "transparent", border: `1px dashed ${dark ? "#263248" : "#cbd5e1"}`, borderRadius: 8, padding: "6px", fontSize: 11.5, fontWeight: 700, color: txt2, cursor: "pointer" }}>
          {aberto ? "Mostrar só os principais" : `Ver todos os ${total} avisos`}
        </button>
      )}
    </div>
  );
}

// Container: lê as fontes em tempo real, calcula, marca "novo" e entrega à tela.
// ctmkData/pendencias/ultimoRelatorio já vivem na Home (tempo real); as demais fontes são assinadas aqui.
export default function PainelAvisos({ dark = true, gerencial = false, projetos = [], ctmkData = {}, pendencias = [], ultimoRelatorio = {}, nomeProj, onAbrir, assinar = assinarFontes, mapasAtivo = true, storage }) {
  const [agora, setAgora] = useState(() => new Date());
  const [dados, setDados] = useState({});
  const [falhasMap, setFalhasMap] = useState({});
  const [recebidos, setRecebidos] = useState(0);
  const [esperados, setEsperados] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const vistoBase = useRef(null);
  if (vistoBase.current === null) vistoBase.current = { v: lerVisto(gerencial, storage) };
  const primeiros = useRef(new Set());

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30000);
    const aoVoltar = () => { if (document.visibilityState === "visible") setAgora(new Date()); };
    const on = () => setOffline(false), off = () => setOffline(true);
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const chaveProjetos = projetos.join(",");
  useEffect(() => {
    setDados({}); setFalhasMap({}); setRecebidos(0); setEsperados(null); primeiros.current = new Set();
    const marca = (fonte, pid) => { const k = `${fonte}:${pid}`; if (!primeiros.current.has(k)) { primeiros.current.add(k); setRecebidos(primeiros.current.size); } };
    const h = assinar({
      projetos, gerencial, mapasAtivo,
      onDados: (fonte, pid, valor) => { setDados((d) => ({ ...d, [fonte]: { ...(d[fonte] || {}), [pid]: valor } })); setAtualizadoEm(new Date()); marca(fonte, pid); },
      onErro: (fonte, pid, erro) => {
        setFalhasMap((m) => { const k = `${fonte}:${pid}`; if (!erro) { if (!m[k]) return m; const { [k]: _x, ...resto } = m; return resto; } return m[k] ? m : { ...m, [k]: fonte }; });
        if (erro) marca(fonte, pid);
      },
    });
    setEsperados(h.esperados);
    return () => h.parar();
    // eslint-disable-next-line
  }, [gerencial, chaveProjetos, mapasAtivo, assinar]);

  const carregando = esperados === null || recebidos < esperados;
  const falhas = useMemo(() => [...new Set(Object.values(falhasMap))], [falhasMap]);
  const { avisos, contagem } = useMemo(
    () => calcularAvisos({ agora, gerencial, fontes: { ...dados, ctmk: ctmkData, pendencias, ultimoRelatorio } }),
    [agora, gerencial, dados, ctmkData, pendencias, ultimoRelatorio]
  );
  const marcados = useMemo(() => marcarNovos(avisos, vistoBase.current.v), [avisos]);

  // Registra "já vi" quando o usuário abre a lista, depois de 10 s na tela ou ao sair do app — e só com tudo lido,
  // para não gravar uma lista incompleta que pintaria avisos antigos como novos na próxima visita.
  const completo = !carregando && falhas.length === 0;
  const ref = useRef({ completo, avisos });
  ref.current = { completo, avisos };
  const confirmar = () => { if (ref.current.completo) gravarVisto(gerencial, ref.current.avisos, new Date(), storage); };
  useEffect(() => {
    if (!completo) return undefined;
    const t = setTimeout(confirmar, 10000);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [completo, gerencial]);
  useEffect(() => {
    const aoSair = () => { if (document.visibilityState === "hidden") confirmar(); };
    document.addEventListener("visibilitychange", aoSair); window.addEventListener("pagehide", confirmar);
    return () => { document.removeEventListener("visibilitychange", aoSair); window.removeEventListener("pagehide", confirmar); confirmar(); };
    // eslint-disable-next-line
  }, [gerencial]);

  return <PainelAvisosView avisos={marcados} contagem={contagem} carregando={carregando} falhas={falhas} offline={offline} dark={dark} atualizadoEm={atualizadoEm} nomeProj={nomeProj}
    aberto={aberto} onToggle={() => { setAberto((v) => !v); confirmar(); }} onAbrir={(a) => { confirmar(); onAbrir && onAbrir(a); }} />;
}
