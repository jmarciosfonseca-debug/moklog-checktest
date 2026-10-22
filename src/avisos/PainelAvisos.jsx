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
const ICONE = { ferias: "guardachuva", troca: "atualizar", cobertura: "usuarios", ft: "calendario", falta: "usuario", vago: "usuarios", atraso: "relogio", mapa: "prancheta", material: "ferramenta", supervisao: "olho", keyaccess: "chave", ctmk: "antena", energia: "raio", manutencao: "ferramenta", inop: "alerta", relatorio: "calendario", iluminacao: "lampada", bolsao: "estacionamento", teste: "calendario" };
// Sorteia até 2 manchetes diferentes (e, havendo mais de 2, diferentes do par que já está na tela).
export function sortearPar(n, anterior = [], rnd = Math.random) {
  if (n <= 2) return Array.from({ length: n }, (_, i) => i);
  const igual = (p) => anterior.length === 2 && p.every((x) => anterior.includes(x));
  let par;
  for (let t = 0; t < 8; t++) {
    const a = Math.floor(rnd() * n);
    let b = Math.floor(rnd() * (n - 1)); if (b >= a) b++;
    par = [a, b];
    if (!igual(par)) break;
  }
  return par;
}
const hhmm = (d) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// Recolhido: UMA manchete que troca sozinha (como um painel de notícias) + contadores. Tocar abre a lista completa (com rolagem).
export function PainelAvisosView({ avisos, contagem, carregando, falhas = [], offline = false, dark, atualizadoEm, nomeProj = (p) => p, aberto, onToggle, onAbrir, tickerMs = AVISOS_CFG.tickerMs, tickerMax = AVISOS_CFG.tickerMax, aleatorio = Math.random }) {
  const txt = dark ? "#f1f5f9" : "#0f172a";
  const txt2 = dark ? "#94a3b8" : "#64748b";
  const linha = dark ? "#0f172a" : "#eef2f7";
  const total = avisos.length;
  const manchetes = useMemo(() => avisos.slice(0, tickerMax), [avisos, tickerMax]);
  const [par, setPar] = useState([0, 1]); // começa pelas 2 mais importantes; depois sorteia
  const [pausa, setPausa] = useState(false);
  useEffect(() => {
    if (aberto || pausa || manchetes.length < 3) return undefined;
    const t = setInterval(() => setPar((p) => sortearPar(manchetes.length, p, aleatorio)), tickerMs);
    return () => clearInterval(t);
  }, [aberto, pausa, manchetes.length, tickerMs, aleatorio]);
  const mostradas = manchetes.length <= 2 ? manchetes : par.filter((i) => i < manchetes.length).map((i) => manchetes[i]);
  const atual = mostradas[0] || null;
  const temCritico = contagem.critico > 0;
  const corBorda = carregando ? (dark ? "#263248" : "#cbd5e1") : temCritico ? COR.critico : contagem.atencao || falhas.length ? COR.atencao : "#22c55e";
  const linhaAviso = (a, comTopo) => (
    <button key={a.id} onClick={() => onAbrir && onAbrir(a)} data-testid="aviso" aria-label={`${ROTULO_SEV[a.sev]}: ${a.titulo}, ${nomeProj(a.projetoId)}`}
      style={{ display: "flex", alignItems: "flex-start", gap: 9, width: "100%", textAlign: "left", background: "transparent", border: "none", borderTop: comTopo ? `1px solid ${linha}` : "none", borderLeft: `3px solid ${COR[a.sev]}`, padding: "8px 4px 8px 9px", cursor: "pointer" }}>
      <span style={{ display: "flex", fontSize: 16, color: COR[a.sev], marginTop: 1, flexShrink: 0 }}><Ico n={ICONE[a.tipo] || "alerta"} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: txt2, background: dark ? "#1f1f25" : "#e2e8f0", borderRadius: 5, padding: "1px 6px" }}>{a.projetoId}</span>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: txt }}>{a.titulo}</span>
          {a.novo && <span style={{ fontSize: 9.5, fontWeight: 900, color: "#fff", background: "#2563eb", borderRadius: 5, padding: "1px 6px", letterSpacing: .4 }}>NOVO</span>}
        </div>
        {a.detalhe && <div style={{ fontSize: 11, color: txt2, marginTop: 2, lineHeight: 1.35 }}>{a.detalhe}</div>}
      </div>
      {a.idade && <span style={{ fontSize: 10.5, color: txt2, whiteSpace: "nowrap", flexShrink: 0, marginTop: 2 }}>{a.idade}</span>}
    </button>
  );
  return (
    <div data-testid="painel-avisos" style={{ marginTop: 10, background: dark ? "linear-gradient(160deg,#15151a 0%,#0b0b0e 70%)" : "linear-gradient(165deg,#ffffff 0%,#f8fafc 100%)", border: `1px solid ${corBorda}55`, borderRadius: 14, padding: "10px 14px", boxShadow: dark ? "0 8px 22px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04)" : "0 4px 14px rgba(15,23,42,.08)" }}
      onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}>
      <style>{`@keyframes mkAvisoPulso{0%,100%{opacity:1}50%{opacity:.45}}@keyframes mkAvisoEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div onClick={total ? onToggle : undefined} role={total ? "button" : undefined} aria-expanded={total ? !!aberto : undefined} style={{ display: "flex", alignItems: "center", gap: 8, cursor: total ? "pointer" : "default" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: offline ? COR.atencao : "#22c55e", flexShrink: 0, animation: offline || carregando ? "none" : "mkAvisoPulso 2s ease-in-out infinite" }} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: txt }}>Painel de Avisos</div>
          <div style={{ fontSize: 10.5, color: txt2 }} data-testid="avisos-status">
            {offline ? "Sem conexão — mostrando o último dado deste aparelho" : carregando ? "Lendo as fontes…" : `Ao vivo${atualizadoEm ? ` · atualizado ${hhmm(atualizadoEm)}` : ""}`}
          </div>
        </div>
        {!carregando && total > 0 && (
          <div style={{ display: "flex", gap: 5, flexShrink: 0, alignItems: "center" }}>
            {contagem.critico > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: COR.critico, background: COR.critico + "1f", border: `1px solid ${COR.critico}55`, borderRadius: 7, padding: "2px 8px" }}>{contagem.critico} crítico{contagem.critico === 1 ? "" : "s"}</span>}
            {contagem.atencao > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: COR.atencao, background: COR.atencao + "1f", border: `1px solid ${COR.atencao}55`, borderRadius: 7, padding: "2px 8px" }}>{contagem.atencao} atenção</span>}
            <span style={{ color: txt2, fontSize: 16, marginLeft: 2 }}>{aberto ? "⌄" : "›"}</span>
          </div>
        )}
      </div>

      {falhas.length > 0 && !carregando && (
        <div role="alert" style={{ fontSize: 11, color: COR.atencao, background: COR.atencao + "14", border: `1px solid ${COR.atencao}44`, borderRadius: 8, padding: "6px 10px", marginTop: 8 }}>
          Não consegui ler: {falhas.map((f) => ROTULO_FONTE[f] || f).join(", ")}. Os avisos podem estar incompletos.
        </div>
      )}

      {!carregando && contagem.critico === 0 && contagem.atencao === 0 && falhas.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 2px 2px", color: "#22c55e", fontSize: 13, fontWeight: 700 }}>
          <span style={{ display: "flex", fontSize: 18 }}><Ico n="checkCirculo" /></span> {total === 0 ? "Tudo em dia — nenhum aviso agora." : "Tudo em dia — nada crítico agora."}
        </div>
      )}

      {!carregando && atual && !aberto && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${linha}`, paddingTop: 2 }} aria-live="polite" data-testid="avisos-manchetes">
          {mostradas.map((m, i) => <div key={m.id} style={{ animation: "mkAvisoEntra .35s ease both", borderTop: i ? `1px solid ${linha}` : "none" }}>{linhaAviso(m, false)}</div>)}
          {total > mostradas.length && (
            <button onClick={onToggle} style={{ width: "100%", background: "transparent", border: "none", fontSize: 10.5, color: txt2, cursor: "pointer", padding: "2px 0 0" }}>
              Mostrando {mostradas.length} de {total} · toque para ver todos
            </button>
          )}
        </div>
      )}

      {!carregando && aberto && total > 0 && (
        <div style={{ marginTop: 8, maxHeight: 320, overflowY: "auto", WebkitOverflowScrolling: "touch" }} data-testid="avisos-lista">
          {avisos.map((a, i) => linhaAviso(a, i > 0))}
        </div>
      )}
    </div>
  );
}

// Container: lê as fontes em tempo real, calcula, marca "novo" e entrega à tela.
// ctmkData/pendencias/ultimoRelatorio já vivem na Home (tempo real); as demais fontes são assinadas aqui.
export default function PainelAvisos({ dark = true, gerencial = false, projetos = [], ctmkData = {}, pendencias = [], ultimoRelatorio = {}, testes = {}, nomeProj, onAbrir, assinar = assinarFontes, mapasAtivo = true, storage, cfg }) {
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
    () => calcularAvisos({ agora, gerencial, cfg: cfg || AVISOS_CFG, fontes: { ...dados, ctmk: ctmkData, pendencias, ultimoRelatorio, testes } }),
    [agora, gerencial, dados, ctmkData, pendencias, ultimoRelatorio, testes, cfg]
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
