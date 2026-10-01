// ─────────────────────────────────────────────────────────────
// GestaoFV.jsx — Adendo 2. Tela SOMENTE LEITURA do FV sincronizado.
// Fonte: fv/{pid} e fv/{pid}/lancamentos (gravados pelo robô).
// Acesso: PIN gerencial (validado pelo App via validarPin).
// "Atualizar agora": POST /api/fv-sync (PIN validado no servidor).
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { FV_PROJETOS, FV_NOMES, FV_TIPOS, FV_TIPO_ROTULO, FV_DESATUALIZADO_H } from "./fvConfig";

const FB_CONFIG = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
  messagingSenderId: "390165325023",
  appId: "1:390165325023:web:3147cd333503916b0d756a"
};
const db = getFirestore(getApps().length ? getApps()[0] : initializeApp(FB_CONFIG));

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
  const [liberado, setLiberado] = useState(false);
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

  const carregar = useCallback(async () => {
    try {
      const snaps = await Promise.all(FV_PROJETOS.map(pid => getDoc(doc(db, "fv", pid))));
      const r = {}; snaps.forEach((s, i) => { if (s.exists()) r[FV_PROJETOS[i]] = s.data(); });
      setResumos(r);
      const st = await getDoc(doc(db, "fv_sync", "status"));
      setStatus(st.exists() ? st.data() : null);
      return st.exists() ? st.data() : null;
    } catch (e) { console.warn("Gestão FV: falha na leitura", e); return null; }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { if (liberado) carregar(); }, [liberado, carregar]);

  useEffect(() => {
    if (!sel) { setLancs(null); return; }
    let vivo = true; setLancs(null); setTipo("todos"); setPosto("todos");
    getDocs(query(collection(db, "fv", sel, "lancamentos"), orderBy("data", "desc"), limit(300)))
      .then(qs => { if (vivo) setLancs(qs.docs.map(d => d.data())); })
      .catch(e => { console.warn(e); if (vivo) setLancs([]); });
    return () => { vivo = false; };
  }, [sel]);

  const atualizarAgora = async () => {
    setSincronizando(true); setMsgSync("Solicitando sincronização...");
    try {
      const r = await fetch("/api/fv-sync", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ pin }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsgSync(j.erro || `Erro ${r.status}`); setSincronizando(false); return; }
      setMsgSync(j.mensagem || "Sincronização iniciada.");
      const antes = status?.ultimaExecucao || "";
      let n = 0;
      const t = setInterval(async () => {
        n++;
        const st = await carregar();
        if ((st && st.ultimaExecucao && st.ultimaExecucao !== antes && !st.emExecucao) || n >= 15) {
          clearInterval(t); setSincronizando(false);
          setMsgSync(st && st.status === "erro" ? `Falhou: ${st.erro}` : (n >= 15 ? "Sem retorno em 5 min. Confira mais tarde." : "Atualizado."));
        }
      }, 20000);
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
        <button id="fvPinOk" onClick={() => { if (validarPin && validarPin(pin)) setLiberado(true); else setPinErro("PIN inválido"); }}
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
      <div style={{ fontSize:10.5, color:c.txt2, marginTop:6 }}>Automático às 08h e 16h · somente leitura · fonte: plataforma Gestão FV</div>
      {msgSync && <div style={{ fontSize:11, color:"#0ea5e9", marginTop:6 }}>{msgSync}</div>}
    </div>
  );

  // ── Detalhe do projeto
  if (sel) {
    const r = resumos[sel];
    const lista = (lancs || []).filter(l => (tipo === "todos" || l.tipo === tipo) && (posto === "todos" || (l.posto || "—") === posto));
    const postos = [...new Set((lancs || []).map(l => l.posto || "—"))].sort();
    const tm = r?.totaisMes || {};
    const box = (rot, v, cor) => (
      <div style={{ ...card, padding:"10px 12px" }}><div style={{ fontSize:10.5, color:c.txt2 }}>{rot}</div><div style={{ fontSize:17, fontWeight:800, color:cor || c.txt }}>{brl(v)}</div></div>
    );
    return (
      <Page bg={c.bg}>
        <button onClick={() => setSel(null)} style={{ ...btn, alignSelf:"flex-start" }}>← Todos os projetos</button>
        <div style={{ fontSize:16, fontWeight:800, color:c.txt }}>{sel} · {FV_NOMES[sel]}</div>
        {statusBox}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {box("Saldo atual", r?.saldoAtual, r ? (r.saldoAtual < 0 ? "#ef4444" : "#22c55e") : c.txt2)}
          {box("Créditos + aportes (mês)", (tm.credito || 0) + (tm.aporte || 0))}
          {box("VT (mês)", tm.vt || 0)}
          {box("AM (mês)", tm.am || 0)}
        </div>
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
        {lancs === null && <div style={{ fontSize:12, color:c.txt2 }}>Carregando lançamentos...</div>}
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
      {!carregando && FV_PROJETOS.map(pid => {
        const r = resumos[pid];
        const cor = !r ? c.txt2 : (r.saldoAtual < 0 ? "#ef4444" : "#22c55e");
        return (
          <div key={pid} onClick={() => r && setSel(pid)} style={{ ...card, cursor:r ? "pointer" : "default", border:`1px solid ${r && r.saldoAtual < 0 ? "#ef444455" : c.bd}` }}>
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
