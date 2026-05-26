import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
  messagingSenderId: "390165325023",
  appId: "1:390165325023:web:3147cd333503916b0d756a"
};
const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

const ADMIN_PIN = "872101";
const PROJECT_PINS = {
  P601:"16601",P602:"16602",P604:"16604",P605:"16605",
  P606:"16606",P607:"16607",P311A:"16311",P311B:"16311",
  P505:"16505",P260A:"162601",P260B:"162602",P260C:"162603"
};

function todayStr() { return new Date().toISOString().split("T")[0]; }
function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}
function fmtDate(d) {
  if(!d) return "--";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}
function daysSince(d) {
  if(!d) return null;
  try { return Math.floor((Date.now()-new Date(d+"T12:00:00").getTime())/86400000); } catch { return null; }
}

async function loadAcessos(projectId) {
  try {
    const snap = await getDoc(doc(db,"acesso_cco",projectId));
    if(snap.exists()) {
      const data = snap.data();
      try { localStorage.setItem(`acesso_cco_${projectId}`, JSON.stringify(data.registros||[])); } catch(e){}
      return data.registros || [];
    }
  } catch(e){}
  try {
    const local = localStorage.getItem(`acesso_cco_${projectId}`);
    if(local) return JSON.parse(local);
  } catch(e){}
  return [];
}

async function saveAcessos(projectId, registros) {
  try {
    await setDoc(doc(db,"acesso_cco",projectId),{registros,updatedAt:new Date().toISOString()});
  } catch(e){ console.error("Firebase save error:",e); }
  try {
    localStorage.setItem(`acesso_cco_${projectId}`, JSON.stringify(registros));
  } catch(e){ console.warn("localStorage save failed:",e); }
}

function getStyles(dark) {
  return {
    page:    { minHeight:"100vh", background:dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 80px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:480, display:"flex", flexDirection:"column" },
    card:    { background:dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"14px 16px" },
    btn:     { background:"linear-gradient(135deg,#1d4ed8,#1e40af)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnSec:  { background:dark?"#060c18":"#f8fafc", color:dark?"#64748b":"#475569", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
    btnSm:   { background:dark?"#020510":"#f8fafc", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#64748b":"#475569", borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:600 },
    backBtn: { background:"transparent", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#94a3b8":"#64748b", borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 },
    inp:     { width:"100%", background:dark?"#020510":"#ffffff", border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`, borderRadius:7, color:dark?"#e2e8f0":"#1e293b", padding:"10px 12px", fontSize:13, boxSizing:"border-box", outline:"none" },
    lbl:     { display:"block", fontSize:10, color:dark?"#475569":"#64748b", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 },
    hdrBg:   { background:dark?"#04080f":"#f8fafc", borderBottom:`1px solid ${dark?"#0a0f1e":"#e2e8f0"}` },
    txt:     { color:dark?"#f1f5f9":"#0f172a" },
    txt2:    { color:dark?"#475569":"#64748b" },
  };
}

// ── PIN Gate
function PinGate({ project, onSuccess, onBack, dark }) {
  const S = getStyles(dark);
  const [mode, setMode] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);

  const tryPin = () => {
    if(pin===ADMIN_PIN){ onSuccess("admin"); return; }
    if(pin===PROJECT_PINS[project.id]){ onSuccess("lider"); return; }
    setErr(true);
  };

  return (
    <div style={{...S.page, alignItems:"center", justifyContent:"center"}}>
      <div style={{...S.card, maxWidth:320, width:"100%", margin:16, textAlign:"center"}}>
        <div style={{fontSize:32, marginBottom:8}}>🚪</div>
        <div style={{fontSize:16, fontWeight:800, ...S.txt, marginBottom:4}}>Acesso CCO</div>
        <div style={{fontSize:12, ...S.txt2, marginBottom:20}}>{project?.id||""} · {project?.name||""}</div>
        {!mode ? (
          <div style={{display:"flex", flexDirection:"column", gap:8}}>
            <button onClick={()=>setMode("lider")} style={{...S.btn, background:"linear-gradient(135deg,#0369a1,#0c4a6e)", fontSize:13}}>
              🚪 Acesso CCO / Líder
            </button>
            <button onClick={()=>setMode("admin")} style={{...S.btnSec, fontSize:13, color:"#f59e0b", borderColor:"#f59e0b33"}}>
              🔐 Acesso Gerencial
            </button>
            <button onClick={onBack} style={{...S.btnSec, fontSize:13, marginTop:4}}>← Voltar</button>
          </div>
        ) : (
          <>
            <div style={{fontSize:12, ...S.txt2, marginBottom:12}}>
              {mode==="lider"?"PIN do projeto":"PIN gerencial"}
            </div>
            <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8}
              value={pin} onChange={e=>{setPin(e.target.value);setErr(false);}}
              onKeyDown={e=>{if(e.key==="Enter") tryPin();}}
              style={{...S.inp, textAlign:"center", fontSize:22, letterSpacing:10, marginBottom:8}}/>
            {err && <div style={{fontSize:12, color:"#ef4444", marginBottom:8}}>PIN incorreto</div>}
            <div style={{display:"flex", gap:8}}>
              <button onClick={()=>{setMode(null);setPin("");setErr(false);}} style={{...S.btnSec, flex:1, fontSize:13}}>← Voltar</button>
              <button onClick={tryPin} style={{...S.btn, flex:1, fontSize:13}}>Entrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AcessoCCO({ project, onBack, dark, onToggleTheme }) {
  const S = getStyles(dark||true);
  const [authLevel, setAuthLevel] = useState(null);
  const [screen, setScreen] = useState("pin");
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const adminAuth = authLevel==="admin";

  const emptyForm = () => ({
    id: Date.now().toString()+Math.random().toString(36).substring(2,6),
    data: todayStr(),
    nome:"",
    empresa:"",
    horaEntrada: nowTime(),
    obs:"",
    registradoEm: new Date().toISOString()
  });
  const [form, setForm] = useState(emptyForm());
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    if(!project?.id) return;
    loadAcessos(project.id).then(r=>{ setRegistros(r||[]); setLoading(false); });
  },[project?.id]);

  const salvar = async () => {
    if(!form.nome.trim()) { alert("Informe o nome"); return; }
    setSaving(true);
    try {
      const novo = {...form, registradoEm: new Date().toISOString()};
      const newList = [novo, ...registros];
      setRegistros(newList);
      await saveAcessos(project.id, newList);
      setForm(emptyForm());
      setScreen("list");
    } catch(e) {
      console.error("Erro ao salvar:",e);
      alert("Erro ao salvar. Verifique sua conexão.");
    }
    setSaving(false);
  };

  const excluir = async (id) => {
    const newList = registros.filter(r=>r.id!==id);
    setRegistros(newList);
    await saveAcessos(project.id, newList);
  };

  if(screen==="pin") return (
    <PinGate project={project||{}} dark={dark||true} onBack={onBack}
      onSuccess={(level)=>{ setAuthLevel(level); setScreen("list"); }}/>
  );

  if(loading) return (
    <div style={{...S.page, alignItems:"center", justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:30, marginBottom:10}}>🚪</div>
        <div style={{fontSize:13, ...S.txt2}}>Carregando registros...</div>
      </div>
    </div>
  );

  // ── FORMULÁRIO
  if(screen==="form") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>setScreen("list")} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>🚪 Novo Acesso CCO</div>
              <div style={{fontSize:11,...S.txt2}}>{project?.id||""} · {project?.name||""}</div>
            </div>
            <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,...S.txt2}}>
              {dark?"☀️":"🌙"}
            </button>
          </div>
        </div>

        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          {/* Identificação */}
          <div style={{...S.card,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:11,color:"#0ea5e9",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>
              👤 Identificação
            </div>
            <div>
              <label style={S.lbl}>Nome *</label>
              <input value={form.nome} onChange={e=>setF("nome",e.target.value)}
                placeholder="Nome completo..." style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Empresa / Setor</label>
              <input value={form.empresa} onChange={e=>setF("empresa",e.target.value)}
                placeholder="Empresa ou setor..." style={S.inp}/>
            </div>
          </div>

          {/* Data e Hora Entrada */}
          <div style={S.card}>
            <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>
              ⏱️ Data e Hora de Acesso
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={S.lbl}>Data</label>
                <input type="date" value={form.data} onChange={e=>setF("data",e.target.value)} style={S.inp}/>
              </div>
              <div>
                <label style={S.lbl}>Hora de Entrada</label>
                <div style={{display:"flex",gap:5}}>
                  <input type="time" value={form.horaEntrada}
                    onChange={e=>setF("horaEntrada",e.target.value)} style={{...S.inp,flex:1}}/>
                  <button onClick={()=>setF("horaEntrada",nowTime())}
                    style={{...S.btnSm,padding:"8px 10px",fontSize:14,flexShrink:0}}>⏱</button>
                </div>
              </div>
            </div>
          </div>

          {/* Observação */}
          <div style={S.card}>
            <label style={S.lbl}>Observação (opcional)</label>
            <textarea value={form.obs} onChange={e=>setF("obs",e.target.value)}
              placeholder="Motivo da visita, observações..."
              style={{...S.inp,height:60,resize:"vertical",fontSize:12}}/>
          </div>

          <button onClick={salvar} disabled={saving}
            style={{...S.btn, opacity:saving?0.7:1}}>
            {saving?"⟳ Salvando...":"✓ Registrar Acesso"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── LISTA
  const hoje = registros.filter(r=>r.data===todayStr());
  const anteriores = registros.filter(r=>r.data!==todayStr());

  // Último acesso
  const ultimoAcesso = registros.length > 0 ? registros[0] : null;
  const diasUltimo = ultimoAcesso ? daysSince(ultimoAcesso.data) : null;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onBack} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>🚪 Acesso CCO</div>
              <div style={{fontSize:11,...S.txt2}}>{project?.id||""} · {registros.length} registro(s)</div>
            </div>
            <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,...S.txt2}}>
              {dark?"☀️":"🌙"}
            </button>
          </div>
        </div>

        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>

          {/* KPIs */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div style={{...S.card,textAlign:"center",padding:"10px 8px"}}>
              <div style={{fontSize:22,fontWeight:900,color:"#0ea5e9"}}>{registros.length}</div>
              <div style={{fontSize:9,...S.txt2,fontWeight:700}}>TOTAL</div>
            </div>
            <div style={{...S.card,textAlign:"center",padding:"10px 8px"}}>
              <div style={{fontSize:22,fontWeight:900,color:"#22c55e"}}>{hoje.length}</div>
              <div style={{fontSize:9,...S.txt2,fontWeight:700}}>HOJE</div>
            </div>
          </div>

          {/* Último acesso */}
          {ultimoAcesso && (
            <div style={{background:diasUltimo===0?dark?"#021a0d":"#dcfce7":diasUltimo&&diasUltimo>7?dark?"#1a0202":"#fee2e2":dark?"#060c18":"#ffffff",border:`1px solid ${diasUltimo===0?"#22c55e33":diasUltimo&&diasUltimo>7?"#ef444433":dark?"#0f172a":"#e2e8f0"}`,borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontSize:10,color:diasUltimo===0?"#22c55e":diasUltimo&&diasUltimo>7?"#ef4444":"#0ea5e9",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>
                📅 Último Acesso
              </div>
              <div style={{fontSize:13,fontWeight:700,...S.txt}}>{ultimoAcesso.nome}</div>
              <div style={{fontSize:11,...S.txt2}}>{ultimoAcesso.empresa&&`${ultimoAcesso.empresa} · `}{fmtDate(ultimoAcesso.data)} às {ultimoAcesso.horaEntrada}</div>
              <div style={{fontSize:11,color:diasUltimo===0?"#22c55e":diasUltimo&&diasUltimo>7?"#ef4444":"#64748b",fontWeight:700,marginTop:3}}>
                {diasUltimo===0?"Hoje":diasUltimo===1?"Ontem":`Há ${diasUltimo} dias`}
              </div>
            </div>
          )}

          <button onClick={()=>{setForm(emptyForm());setScreen("form");}} style={S.btn}>
            + Registrar Acesso ao CCO
          </button>

          {registros.length===0 && (
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:32,marginBottom:10}}>🚪</div>
              <div style={{fontSize:13,...S.txt}}>Nenhum registro ainda</div>
            </div>
          )}

          {hoje.length>0 && (
            <>
              <div style={{fontSize:10,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Hoje</div>
              {hoje.map(r=><RegistroCard key={r.id} r={r} dark={dark||true} S={S} adminAuth={adminAuth} onExcluir={()=>{if(window.confirm("Excluir?")) excluir(r.id);}}/>)}
            </>
          )}

          {anteriores.length>0 && (
            <>
              <div style={{fontSize:10,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginTop:4}}>Anteriores</div>
              {anteriores.map(r=><RegistroCard key={r.id} r={r} dark={dark||true} S={S} adminAuth={adminAuth} onExcluir={()=>{if(window.confirm("Excluir?")) excluir(r.id);}}/>)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RegistroCard({ r, dark, S, adminAuth, onExcluir }) {
  const [open, setOpen] = useState(false);
  const dias = daysSince(r.data);

  return (
    <div style={{...S.card,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10}} onClick={()=>setOpen(!open)}>
        <div style={{width:40,height:40,borderRadius:10,background:dark?"#0f172a":"#f1f5f9",border:`1px solid ${dark?"#1e293b":"#e2e8f0"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>
          👤
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,...S.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {r.nome}
          </div>
          {r.empresa&&<div style={{fontSize:11,...S.txt2}}>{r.empresa}</div>}
          <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
            <span style={{fontSize:10,...S.txt2}}>📅 {fmtDate(r.data)}</span>
            {r.horaEntrada&&<span style={{fontSize:10,color:"#22c55e"}}>⏱ {r.horaEntrada}</span>}
            <span style={{fontSize:10,color:dias===0?"#22c55e":dias&&dias>7?"#ef4444":"#64748b",fontWeight:700}}>
              {dias===0?"Hoje":dias===1?"Ontem":`${dias}d atrás`}
            </span>
          </div>
        </div>
        <span style={{...S.txt2,fontSize:12}}>{open?"▲":"▼"}</span>
      </div>

      {open && (
        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${dark?"#0f172a":"#f1f5f9"}`}}>
          {r.obs&&<div style={{fontSize:12,...S.txt,marginBottom:8,lineHeight:1.5}}>{r.obs}</div>}
          {adminAuth && (
            <button onClick={onExcluir}
              style={{...S.btnSm,color:"#ef4444",border:"1px solid #ef444433",fontSize:11}}>
              🗑 Excluir
            </button>
          )}
        </div>
      )}
    </div>
  );
}
