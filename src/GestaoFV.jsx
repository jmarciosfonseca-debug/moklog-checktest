// ─────────────────────────────────────────────────────────────
// GestaoFV.jsx — Adendo 2. Tela SOMENTE LEITURA do FV sincronizado.
// Fonte: fv/{pid} e fv/{pid}/lancamentos (gravados pelo robô).
// Acesso: PIN gerencial (validado pelo App via validarPin).
// "Atualizar agora": POST /api/fv-sync (PIN validado no servidor).
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { FV_PROJETOS, FV_NOMES, FV_TIPOS, FV_TIPO_ROTULO, FV_DESATUALIZADO_H } from "./fvConfig";
import FVPainel from "./FVPainel";
import {authFetch,getSession} from './session';

const FB_CONFIG = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
  messagingSenderId: "390165325023",
  appId: "1:390165325023:web:3147cd333503916b0d756a"
};
if (!getApps().length) initializeApp(FB_CONFIG);

async function lerFV(pid, signal) {
  const response = await authFetch("/api/fv-read", { method:"POST", body:JSON.stringify(pid ? {pid} : {}), signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.erro || `Falha de leitura (${response.status})`);
  return data;
}

const brl = n => typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" }) : "—";
const dt = iso => iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR") : "—";
const dth = iso => iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" }) : "—";
const horasDesde = iso => { const t = iso ? new Date(iso).getTime() : NaN; return Number.isFinite(t) ? (Date.now() - t) / 36e5 : null; };

// Definido fora do componente para não remontar a cada render (evita perder o foco do input).
function Page({ bg, children }) {
  return (
    <div style={{ minHeight:"100vh", background:bg, fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", justifyContent:"center" }}>
      <div style={{ width:"100%", maxWidth:520, padding:"14px 14px 80px", display:"flex", flexDirection:"column", gap:10 }}>{children}</div>
    </div>
  );
}

export default function GestaoFV({ dark = true, onBack, validarPin }) {
  const c = dark
    ? { bg:"#04080f", card:"#060c18", bd:"#0f172a", txt:"#e8ecf5", txt2:"#94a3b8" }
    : { bg:"#f1f5f9", card:"#ffffff", bd:"#e2e8f0", txt:"#0f172a", txt2:"#64748b" };
  const card = { background:c.card, border:`1px solid ${c.bd}`, borderRadius:12, padding:"12px 14px" };
  const btn = { background:"transparent", border:`1px solid ${c.bd}`, color:c.txt2, borderRadius:8, padding:"7px 12px", fontSize:12, fontWeight:700, cursor:"pointer" };

  const [pin, setPin] = useState("");
  const [liberado, setLiberado] = useState(getSession()?.nivel==='gerencial');
  const [pinErro, setPinErro] = useState("");
  const [resumos, setResumos] = useState({});
  const [status, setStatus] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [sel, setSel] = useState(null);
  const [lancs, setLancs] = useState(null);
  const [tipo, setTipo] = useState("todos");
  const [posto, setPosto] = useState("todos");
  const [msgSync, setMsgSync] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [versaoDados, setVersaoDados] = useState(0);
  const [leituraErro, setLeituraErro] = useState("");
  const [lancErro, setLancErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const data = await lerFV();
      setResumos(data.resumos); setStatus(data.status); setLeituraErro("");
      return data.status;
    } catch (e) { setLeituraErro(e.message); return null; }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { if (liberado) carregar(); }, [liberado, carregar]);

  useEffect(() => {
    if (!sel) { setLancs(null); return; }
    let vivo = true; const controller = new AbortController();
    setLancs(null); setLancErro(""); setTipo("todos"); setPosto("todos");
    lerFV(sel, controller.signal)
      .then(data => { if (vivo) { setLancs(data.lancamentos); if (data.resumo) setResumos(r => ({...r,[sel]:data.resumo})); } })
      .catch(e => { if (vivo && e.name !== "AbortError") setLancErro(e.message); });
    return () => { vivo = false; controller.abort(); };
  }, [sel, versaoDados]);

  const atualizarAgora = async () => {
    setSincronizando(true); setMsgSync("Aplicando arquivos Excel preparados...");
    try {
      const r = await authFetch("/api/fv-apply", { method:"POST", body: JSON.stringify({}) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsgSync(j.erro || `Erro ${r.status}`); setSincronizando(false); return; }
      await carregar(); setVersaoDados(v => v + 1);
      setMsgSync(j.mensagem || "Atualizado."); setSincronizando(false);
    } catch (e) { setMsgSync("Sem conexão com o servidor."); setSincronizando(false); }
  };

  // ── PIN gerencial
  if (!liberado) return (
    <Page bg={c.bg}>
      <button onClick={onBack} style={{ ...btn, alignSelf:"flex-start" }}>← Voltar</button>
      <div style={{ ...card, textAlign:"center" }}>
        <div style={{ fontSize:16, fontWeight:800, color:c.txt }}>💰 Gestão FV</div>
        <div style={{ fontSize:12, color:c.txt2, margin:"4px 0 12px" }}>Acesso restrito · PIN gerencial</div>
        <input type="password" inputMode="numeric" value={pin} onChange={e => { setPin(e.target.value); setPinErro(""); }}
          onKeyDown={e => { if (e.key === "Enter") document.getElementById("fvPinOk")?.click(); }}
          style={{ width:"100%", boxSizing:"border-box", padding:"11px", borderRadius:8, fontSize:16, textAlign:"center", background:c.bg, color:c.txt, border:`1px solid ${pinErro ? "#ef4444" : c.bd}` }}/>
        {pinErro && <div style={{ fontSize:11, color:"#ef4444", marginTop:6 }}>{pinErro}</div>}
        <button id="fvPinOk" onClick={async () => { if (validarPin && await validarPin(pin)) {setPin('');setLiberado(true);} else {setPin('');setPinErro("PIN inválido ou acesso indisponível");} }}
          style={{ ...btn, width:"100%", marginTop:10, background:"#16a34a", color:"#fff", border:"none", padding:"10px" }}>Entrar</button>
      </div>
    </Page>
  );

  const horasSync = horasDesde(status?.ultimaOk);
  const desatualizado = horasSync === null || horasSync > FV_DESATUALIZADO_H;
  const statusBox = (
    <div style={{ ...card, border:`1px solid ${status?.status === "erro" || desatualizado ? "#f59e0b66" : c.bd}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
        <div>
          <div style={{ fontSize:11, color:c.txt2 }}>Última sincronização com sucesso</div>
          <div style={{ fontSize:14, fontWeight:800, color:c.txt }}>{dth(status?.ultimaOk)}</div>
        </div>
        <button disabled={sincronizando} onClick={atualizarAgora} style={{ ...btn, color:"#0ea5e9", borderColor:"#0ea5e955", opacity:sincronizando ? .6 : 1 }}>{sincronizando ? "Sincronizando..." : "🔄 Atualizar agora"}</button>
      </div>
      {status?.status === "erro" && <div style={{ fontSize:11, color:"#f59e0b", marginTop:6 }}>⚠️ Última tentativa ({dth(status.ultimaExecucao)}) falhou: {status.erro}. Exibindo o último dado válido.</div>}
      {status?.status !== "erro" && desatualizado && <div style={{ fontSize:11, color:"#f59e0b", marginTop:6 }}>⚠️ Dados desatualizados{horasSync !== null ? ` (há ${Math.floor(horasSync)} h)` : ""}.</div>}
      <div style={{ fontSize:10.5, color:c.txt2, marginTop:6 }}>Atualização manual por Excel · aplicada somente ao clicar · não consulta o portal em tempo real.</div>
      {status?.dataExportacao && <div style={{ fontSize:10.5, color:c.txt2, marginTop:4 }}>Dados exportados em {dt(status.dataExportacao)}. Projeções são estimativas internas.</div>}
      {msgSync && <div style={{ fontSize:11, color:"#0ea5e9", marginTop:6 }}>{msgSync}</div>}
      {leituraErro && <div role="alert" style={{fontSize:12,color:"#ef4444",marginTop:8}}>{leituraErro} <button style={btn} onClick={carregar}>Tentar leitura novamente</button></div>}
    </div>
  );

  // ── Detalhe do projeto
  if (sel) {
    const r = resumos[sel];
    const lista = (lancs || []).filter(l => (tipo === "todos" || l.tipo === tipo) && (posto === "todos" || (l.posto || "—") === posto));
    const postos = [...new Set((lancs || []).map(l => l.posto || "—"))].sort();
    return (
      <Page bg={c.bg}>
        <button onClick={() => setSel(null)} style={{ ...btn, alignSelf:"flex-start" }}>← Todos os projetos</button>
        <div style={{ fontSize:16, fontWeight:800, color:c.txt }}>{sel} · {FV_NOMES[sel]}</div>
        {statusBox}
        {r?.diferencaConferenciaCentavos !== 0 && typeof r?.diferencaConferenciaCentavos === "number" && <div style={{ ...card, color:"#f59e0b", fontSize:11 }}>Saldo oficial preservado. Diferença entre soma dos lançamentos e saldo: {brl(r.diferencaConferenciaCentavos / 100)}.</div>}
        {lancErro ? <div role="alert" style={{...card,color:"#ef4444"}}>{lancErro} <button style={btn} onClick={() => setVersaoDados(v => v + 1)}>Tentar novamente</button></div> : lancs === null
          ? <div style={{ fontSize:12, color:c.txt2 }}>Carregando painel...</div>
          : <FVPainel pid={sel} nome={FV_NOMES[sel]} resumo={r} lancamentos={lancs} dark={dark} podeEditar={liberado}/>}
        <div style={{ fontSize:12.5, fontWeight:700, color:c.txt }}>Lançamentos sincronizados (portal)</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["todos", ...FV_TIPOS].map(k => (
            <button key={k} onClick={() => setTipo(k)} style={{ ...btn, padding:"5px 10px", fontSize:11, color:tipo === k ? "#fff" : c.txt2, background:tipo === k ? "#0ea5e9" : "transparent", borderColor:tipo === k ? "#0ea5e9" : c.bd }}>{k === "todos" ? "Todos" : FV_TIPO_ROTULO[k]}</button>
          ))}
        </div>
        {postos.length > 1 && (
          <select value={posto} onChange={e => setPosto(e.target.value)} style={{ padding:"7px 10px", borderRadius:8, background:c.card, color:c.txt, border:`1px solid ${c.bd}` }}>
            <option value="todos">Todos os postos</option>
            {postos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {lancs === null && !lancErro && <div style={{ fontSize:12, color:c.txt2 }}>Carregando lançamentos...</div>}
        {lancs && lista.length === 0 && <div style={{ fontSize:12, color:c.txt2, textAlign:"center", padding:12 }}>Nenhum lançamento.</div>}
        {lista.map(l => {
          const entrada = l.tipo === "credito" || l.tipo === "aporte";
          return (
            <div key={l.id} style={{ ...card, padding:"10px 12px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:12.5, fontWeight:700, color:c.txt }}>{FV_TIPO_ROTULO[l.tipo] || l.tipo}{l.descricao ? ` · ${l.descricao}` : ""}</div>
                <div style={{ fontSize:11, color:c.txt2 }}>{dt(l.data)} · {l.posto || "Sem posto"}</div>
              </div>
              <span style={{ fontSize:13, fontWeight:800, color:entrada ? "#22c55e" : "#ef4444", whiteSpace:"nowrap" }}>{entrada ? "+ " : "− "}{brl(l.valor)}</span>
            </div>
          );
        })}
      </Page>
    );
  }

  // ── Visão geral
  return (
    <Page bg={c.bg}>
      <button onClick={onBack} style={{ ...btn, alignSelf:"flex-start" }}>← Voltar</button>
      <div style={{ fontSize:16, fontWeight:800, color:c.txt }}>💰 Gestão FV</div>
      {statusBox}
      {carregando && <div style={{ fontSize:12, color:c.txt2 }}>Carregando...</div>}
      {!carregando && (!leituraErro || Object.keys(resumos).length > 0) && FV_PROJETOS.map(pid => {
        const r = resumos[pid];
        const cor = !r ? c.txt2 : (r.saldoAtual < 0 ? "#ef4444" : "#22c55e");
        return (
          <div key={pid} onClick={() => setSel(pid)} style={{ ...card, cursor:"pointer", border:`1px solid ${r && r.saldoAtual < 0 ? "#ef444455" : c.bd}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:c.txt }}>{pid} · {FV_NOMES[pid]}</div>
                <div style={{ fontSize:11, color:c.txt2 }}>{r ? (r.ultimoCredito ? `Último crédito ${dt(r.ultimoCredito.data)} · ${brl(r.ultimoCredito.valor)}` : "Sem créditos registrados") : "Aguardando primeira sincronização"}</div>
                {r?.statusSincronizacao === "erro" && <div style={{ fontSize:10.5, color:"#f59e0b" }}>⚠️ Última tentativa falhou · dado de {dth(r.sincronizadoEm)}</div>}
              </div>
              <span style={{ fontSize:15, fontWeight:800, color:cor, whiteSpace:"nowrap" }}>{r ? brl(r.saldoAtual) : "—"}</span>
            </div>
          </div>
        );
      })}
    </Page>
  );
}
