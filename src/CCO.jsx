import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { setDoc } from "./fireGuard";

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

// ── Coleções Firebase (novas, não tocam em nada existente)
const COLLECTIONS = {
  manutencao: "cco_manutencao",
  intervalo:  "cco_intervalo",
  supervisao: "cco_supervisao",
};

const STATUS_MANUT = [
  { key:"concluida", label:"Concluída", color:"#22c55e", bg:"#021a0d", icon:"✅" },
  { key:"parcial",   label:"Parcial",   color:"#f59e0b", bg:"#1a1000", icon:"⚠️" },
  { key:"pendente",  label:"Pendente",  color:"#ef4444", bg:"#1a0202", icon:"⏳" },
];

const TURNOS = [
  { key:"diurno",  label:"Diurno",  color:"#f59e0b", bg:"#1a1000", icon:"☀️" },
  { key:"noturno", label:"Noturno", color:"#818cf8", bg:"#0a0a2e", icon:"🌙" },
];

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

// ── Firebase load/save genérico por seção
async function loadRegistros(section, projectId) {
  const col = COLLECTIONS[section];
  try {
    const snap = await getDoc(doc(db,col,projectId));
    if(snap.exists()) {
      const data = snap.data();
      try { localStorage.setItem(`${col}_${projectId}`, JSON.stringify(data.registros||[])); } catch(e){}
      return data.registros || [];
    }
  } catch(e){}
  try {
    const local = localStorage.getItem(`${col}_${projectId}`);
    if(local) return JSON.parse(local);
  } catch(e){}
  return [];
}

async function saveRegistros(section, projectId, registros) {
  const col = COLLECTIONS[section];
  try {
    await setDoc(doc(db,col,projectId),{registros,updatedAt:new Date().toISOString()});
  } catch(e){ console.error("Firebase save error:",e); }
  try {
    localStorage.setItem(`${col}_${projectId}`, JSON.stringify(registros));
  } catch(e){ console.warn("localStorage save failed:",e); }
}

// ── Rascunho (draft) salvável por seção + projeto
function draftKey(section, projectId) { return `cco_draft_${section}_${projectId}`; }
function loadDraft(section, projectId) {
  try {
    const d = localStorage.getItem(draftKey(section,projectId));
    if(d) return JSON.parse(d);
  } catch(e){}
  return null;
}
function saveDraft(section, projectId, form) {
  try { localStorage.setItem(draftKey(section,projectId), JSON.stringify({form,savedAt:Date.now()})); } catch(e){}
}
function clearDraft(section, projectId) {
  try { localStorage.removeItem(draftKey(section,projectId)); } catch(e){}
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

// ── PIN Gate (dual-level: admin / líder do projeto)
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
        <div style={{fontSize:32, marginBottom:8}}>🏢</div>
        <div style={{fontSize:16, fontWeight:800, ...S.txt, marginBottom:4}}>CCO</div>
        <div style={{fontSize:12, ...S.txt2, marginBottom:20}}>{project?.id||""} · {project?.name||""}</div>
        {!mode ? (
          <div style={{display:"flex", flexDirection:"column", gap:8}}>
            <button onClick={()=>setMode("lider")} style={{...S.btn, background:"linear-gradient(135deg,#0369a1,#0c4a6e)", fontSize:13}}>
              🏢 Acesso CCO / Líder
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

// ── Pílula de seleção (botão-grupo reutilizável)
function PillGroup({ options, value, onChange, S, dark }) {
  return (
    <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
      {options.map(o=>{
        const sel = value===o.key;
        return (
          <button key={o.key} onClick={()=>onChange(o.key)}
            style={{flex:1, minWidth:90, background:sel?o.bg:"transparent",
              border:`1px solid ${sel?o.color+"66":dark?"#0f172a":"#e2e8f0"}`,
              color:sel?o.color:dark?"#475569":"#94a3b8",
              borderRadius:8, padding:"9px 8px", fontSize:12, cursor:"pointer",
              fontWeight:sel?700:500}}>
            {o.icon} {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CCO({ project, onBack, dark, onToggleTheme }) {
  const S = getStyles(dark||true);
  const [authLevel, setAuthLevel] = useState(null);
  const [screen, setScreen] = useState("pin"); // pin | menu | manutencao | intervalo | supervisao
  const adminAuth = authLevel==="admin";

  if(screen==="pin") return (
    <PinGate project={project||{}} dark={dark||true} onBack={onBack}
      onSuccess={(level)=>{ setAuthLevel(level); setScreen("menu"); }}/>
  );

  // ── MENU CCO (3 botões)
  if(screen==="menu") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onBack} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>🏢 CCO</div>
              <div style={{fontSize:11,...S.txt2}}>{project?.id||""} · {project?.name||""}</div>
            </div>
            <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,...S.txt2}}>
              {dark?"☀️":"🌙"}
            </button>
          </div>
        </div>

        <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
          <MenuCard icon="🛠️" color="#f59e0b" colorDark={dark?"#1a1000":"#fffbeb"} borderC={dark?"#f59e0b33":"#fcd34d"}
            title="Visita de Manutenção" sub="Visita técnica · empresa, técnico, sistema, status"
            dark={dark} onClick={()=>setScreen("manutencao")}/>
          <MenuCard icon="⏱️" color="#0ea5e9" colorDark={dark?"#001a2e":"#e0f2fe"} borderC={dark?"#0ea5e933":"#7dd3fc"}
            title="Intervalo" sub="Registro de intervalo / pausa da equipe"
            dark={dark} onClick={()=>setScreen("intervalo")}/>
          <MenuCard icon="👁️" color="#a855f7" colorDark={dark?"#120a2e":"#f3e8ff"} borderC={dark?"#a855f733":"#d8b4fe"}
            title="Visita da Supervisão" sub="Visita de supervisão · turno diurno / noturno"
            dark={dark} onClick={()=>setScreen("supervisao")}/>
        </div>
      </div>
    </div>
  );

  if(screen==="manutencao") return (
    <ManutencaoSection project={project} dark={dark||true} adminAuth={adminAuth}
      onBack={()=>setScreen("menu")} onToggleTheme={onToggleTheme}/>
  );
  if(screen==="intervalo") return (
    <IntervaloSection project={project} dark={dark||true} adminAuth={adminAuth}
      onBack={()=>setScreen("menu")} onToggleTheme={onToggleTheme}/>
  );
  if(screen==="supervisao") return (
    <SupervisaoSection project={project} dark={dark||true} adminAuth={adminAuth}
      onBack={()=>setScreen("menu")} onToggleTheme={onToggleTheme}/>
  );

  return null;
}

function MenuCard({ icon, color, colorDark, borderC, title, sub, dark, onClick }) {
  const txt2 = dark?"#475569":"#64748b";
  const cardBg = dark?"#060c18":"#ffffff";
  return (
    <button onClick={onClick}
      style={{background:cardBg, border:`2px solid ${borderC}`, borderRadius:16, padding:"20px 18px",
        cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:16, width:"100%"}}>
      <div style={{width:54, height:54, borderRadius:14, background:colorDark, border:`1px solid ${borderC}`,
        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:26}}>
        {icon}
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:15, fontWeight:800, color}}>{title}</div>
        <div style={{fontSize:11, color:txt2, marginTop:3}}>{sub}</div>
      </div>
      <span style={{color:txt2, fontSize:20}}>›</span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SEÇÃO 1 — VISITA DE MANUTENÇÃO
// ════════════════════════════════════════════════════════════════════════
function ManutencaoSection({ project, dark, adminAuth, onBack, onToggleTheme }) {
  const S = getStyles(dark);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screen, setScreen] = useState("list"); // list | form
  const [hasDraft, setHasDraft] = useState(false);

  const emptyForm = () => ({
    id: Date.now().toString()+Math.random().toString(36).substring(2,6),
    data: todayStr(),
    empresa:"",
    tecnico:"",
    sistema:"",
    servico:"",
    turno:"diurno",
    status:"concluida",
    obs:"",
    registradoEm: new Date().toISOString()
  });
  const [form, setForm] = useState(emptyForm());
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    if(!project?.id) return;
    loadRegistros("manutencao", project.id).then(r=>{ setRegistros(r||[]); setLoading(false); });
    setHasDraft(!!loadDraft("manutencao", project.id));
  },[project?.id]);

  // Autosave do rascunho enquanto preenche o formulário
  useEffect(()=>{
    if(screen==="form" && project?.id) {
      saveDraft("manutencao", project.id, form);
      setHasDraft(true);
    }
  },[form, screen, project?.id]);

  const novoComRascunho = () => {
    const d = loadDraft("manutencao", project.id);
    if(d?.form) setForm(d.form); else setForm(emptyForm());
    setScreen("form");
  };
  const novoLimpo = () => { clearDraft("manutencao", project.id); setHasDraft(false); setForm(emptyForm()); setScreen("form"); };

  const salvarRascunho = () => {
    saveDraft("manutencao", project.id, form);
    setHasDraft(true);
    setScreen("list");
  };

  const salvar = async () => {
    if(!form.empresa.trim()) { alert("Informe a empresa"); return; }
    if(!form.servico.trim()) { alert("Descreva o serviço"); return; }
    setSaving(true);
    try {
      const novo = {...form, registradoEm: new Date().toISOString()};
      const newList = [novo, ...registros];
      setRegistros(newList);
      await saveRegistros("manutencao", project.id, newList);
      clearDraft("manutencao", project.id);
      setHasDraft(false);
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
    await saveRegistros("manutencao", project.id, newList);
  };

  if(loading) return <LoadingScreen S={S} icon="🛠️" label="Carregando manutenções..."/>;

  // ── FORMULÁRIO
  if(screen==="form") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <SectionHeader S={S} dark={dark} title="🛠️ Visita de Manutenção" sub={`${project?.id||""} · novo registro`}
          onBack={()=>setScreen("list")} onToggleTheme={onToggleTheme}/>
        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>

          <div style={{...S.card,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>🏢 Dados da Visita</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={S.lbl}>Data</label><input type="date" value={form.data} onChange={e=>setF("data",e.target.value)} style={S.inp}/></div>
              <div><label style={S.lbl}>Empresa *</label><input value={form.empresa} onChange={e=>setF("empresa",e.target.value)} placeholder="Empresa..." style={S.inp}/></div>
            </div>
            <div><label style={S.lbl}>Técnico(s)</label><input value={form.tecnico} onChange={e=>setF("tecnico",e.target.value)} placeholder="Nome do(s) técnico(s)..." style={S.inp}/></div>
            <div><label style={S.lbl}>Sistema</label><input value={form.sistema} onChange={e=>setF("sistema",e.target.value)} placeholder="Ex: CFTV, alarme, cancela..." style={S.inp}/></div>
          </div>

          <div style={S.card}>
            <label style={S.lbl}>Turno</label>
            <PillGroup options={TURNOS} value={form.turno} onChange={v=>setF("turno",v)} S={S} dark={dark}/>
          </div>

          <div style={S.card}>
            <label style={{...S.lbl,marginBottom:8}}>Serviço Realizado *</label>
            <textarea value={form.servico} onChange={e=>setF("servico",e.target.value)}
              placeholder="Descreva o serviço executado..." style={{...S.inp,height:70,resize:"vertical",fontSize:12}}/>
          </div>

          <div style={S.card}>
            <label style={{...S.lbl,marginBottom:8}}>Status</label>
            <PillGroup options={STATUS_MANUT} value={form.status} onChange={v=>setF("status",v)} S={S} dark={dark}/>
          </div>

          <div style={S.card}>
            <label style={S.lbl}>Observação (opcional)</label>
            <textarea value={form.obs} onChange={e=>setF("obs",e.target.value)}
              placeholder="Observações..." style={{...S.inp,height:50,resize:"vertical",fontSize:12}}/>
          </div>

          <div style={{display:"flex",gap:8}}>
            <button onClick={salvarRascunho} style={{...S.btnSec,flex:1,color:"#f59e0b",borderColor:"#f59e0b33"}}>💾 Salvar Rascunho</button>
            <button onClick={salvar} disabled={saving} style={{...S.btn,flex:1,opacity:saving?0.7:1}}>
              {saving?"⟳ Salvando...":"✓ Registrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── LISTA
  const hoje = registros.filter(r=>r.data===todayStr());
  const anteriores = registros.filter(r=>r.data!==todayStr());
  const pendentes = registros.filter(r=>r.status==="pendente").length;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <SectionHeader S={S} dark={dark} title="🛠️ Visita de Manutenção" sub={`${project?.id||""} · ${registros.length} registro(s)`}
          onBack={onBack} onToggleTheme={onToggleTheme}/>
        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <KPI S={S} val={registros.length} label="TOTAL" color="#0ea5e9"/>
            <KPI S={S} val={hoje.length} label="HOJE" color="#22c55e"/>
            <KPI S={S} val={pendentes} label="PENDENTES" color={pendentes>0?"#ef4444":"#22c55e"}/>
          </div>

          {hasDraft && (
            <div style={{background:dark?"#1a1000":"#fffbeb",border:"1px solid #f59e0b55",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>📝</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Rascunho salvo</div>
                <div style={{fontSize:11,...S.txt2}}>Continue de onde parou</div>
              </div>
              <button onClick={novoComRascunho} style={{...S.btnSm,color:"#f59e0b",border:"1px solid #f59e0b44"}}>Continuar</button>
            </div>
          )}

          <button onClick={novoLimpo} style={S.btn}>+ Nova Visita de Manutenção</button>

          {registros.length===0 && (
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:32,marginBottom:10}}>🛠️</div>
              <div style={{fontSize:13,...S.txt}}>Nenhuma visita registrada</div>
            </div>
          )}

          {hoje.length>0 && (<>
            <div style={{fontSize:10,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Hoje</div>
            {hoje.map(r=><ManutCard key={r.id} r={r} dark={dark} S={S} adminAuth={adminAuth} onExcluir={()=>{if(window.confirm("Excluir?")) excluir(r.id);}}/>)}
          </>)}
          {anteriores.length>0 && (<>
            <div style={{fontSize:10,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginTop:4}}>Anteriores</div>
            {anteriores.map(r=><ManutCard key={r.id} r={r} dark={dark} S={S} adminAuth={adminAuth} onExcluir={()=>{if(window.confirm("Excluir?")) excluir(r.id);}}/>)}
          </>)}
        </div>
      </div>
    </div>
  );
}

function ManutCard({ r, dark, S, adminAuth, onExcluir }) {
  const [open, setOpen] = useState(false);
  const st = STATUS_MANUT.find(s=>s.key===r.status) || STATUS_MANUT[0];
  const tn = TURNOS.find(t=>t.key===r.turno) || TURNOS[0];
  return (
    <div style={{...S.card,border:`1px solid ${st.color}33`}}>
      <div style={{display:"flex",alignItems:"center",gap:10}} onClick={()=>setOpen(!open)}>
        <div style={{width:40,height:40,borderRadius:10,background:st.bg,border:`1px solid ${st.color}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>
          {st.icon}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,...S.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.empresa||"—"}</div>
          {r.sistema&&<div style={{fontSize:11,...S.txt2}}>{r.sistema}</div>}
          <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
            <span style={{fontSize:10,...S.txt2}}>📅 {fmtDate(r.data)}</span>
            <span style={{fontSize:10,color:tn.color,fontWeight:700}}>{tn.icon} {tn.label}</span>
            <span style={{fontSize:10,color:st.color,fontWeight:700}}>{st.label}</span>
          </div>
        </div>
        <span style={{...S.txt2,fontSize:12}}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${dark?"#0f172a":"#f1f5f9"}`}}>
          {r.tecnico&&<div style={{fontSize:12,...S.txt,marginBottom:4}}><strong>Técnico:</strong> {r.tecnico}</div>}
          {r.servico&&<div style={{fontSize:12,...S.txt,marginBottom:6,lineHeight:1.5}}><strong>Serviço:</strong> {r.servico}</div>}
          {r.obs&&<div style={{fontSize:12,...S.txt2,marginBottom:8,lineHeight:1.5}}>{r.obs}</div>}
          {adminAuth && (
            <button onClick={onExcluir} style={{...S.btnSm,color:"#ef4444",border:"1px solid #ef444433"}}>🗑 Excluir</button>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SEÇÃO 2 — INTERVALO
// ════════════════════════════════════════════════════════════════════════
function IntervaloSection({ project, dark, adminAuth, onBack, onToggleTheme }) {
  const S = getStyles(dark);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screen, setScreen] = useState("list");
  const [hasDraft, setHasDraft] = useState(false);

  const emptyForm = () => ({
    id: Date.now().toString()+Math.random().toString(36).substring(2,6),
    data: todayStr(),
    nome:"",
    cargo:"",
    turno:"diurno",
    saida: nowTime(),
    retorno:"",
    obs:"",
    registradoEm: new Date().toISOString()
  });
  const [form, setForm] = useState(emptyForm());
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    if(!project?.id) return;
    loadRegistros("intervalo", project.id).then(r=>{ setRegistros(r||[]); setLoading(false); });
    setHasDraft(!!loadDraft("intervalo", project.id));
  },[project?.id]);

  useEffect(()=>{
    if(screen==="form" && project?.id) {
      saveDraft("intervalo", project.id, form);
      setHasDraft(true);
    }
  },[form, screen, project?.id]);

  const novoComRascunho = () => {
    const d = loadDraft("intervalo", project.id);
    if(d?.form) setForm(d.form); else setForm(emptyForm());
    setScreen("form");
  };
  const novoLimpo = () => { clearDraft("intervalo", project.id); setHasDraft(false); setForm(emptyForm()); setScreen("form"); };

  const salvarRascunho = () => { saveDraft("intervalo", project.id, form); setHasDraft(true); setScreen("list"); };

  const salvar = async () => {
    if(!form.nome.trim()) { alert("Informe o nome do colaborador"); return; }
    setSaving(true);
    try {
      const novo = {...form, registradoEm: new Date().toISOString()};
      const newList = [novo, ...registros];
      setRegistros(newList);
      await saveRegistros("intervalo", project.id, newList);
      clearDraft("intervalo", project.id);
      setHasDraft(false);
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
    await saveRegistros("intervalo", project.id, newList);
  };

  if(loading) return <LoadingScreen S={S} icon="⏱️" label="Carregando intervalos..."/>;

  if(screen==="form") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <SectionHeader S={S} dark={dark} title="⏱️ Intervalo" sub={`${project?.id||""} · novo registro`}
          onBack={()=>setScreen("list")} onToggleTheme={onToggleTheme}/>
        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>

          <div style={{...S.card,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:11,color:"#0ea5e9",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>👤 Colaborador</div>
            <div><label style={S.lbl}>Nome *</label><input value={form.nome} onChange={e=>setF("nome",e.target.value)} placeholder="Nome completo..." style={S.inp}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={S.lbl}>Cargo</label><input value={form.cargo} onChange={e=>setF("cargo",e.target.value)} placeholder="Cargo..." style={S.inp}/></div>
              <div><label style={S.lbl}>Data</label><input type="date" value={form.data} onChange={e=>setF("data",e.target.value)} style={S.inp}/></div>
            </div>
          </div>

          <div style={S.card}>
            <label style={S.lbl}>Turno</label>
            <PillGroup options={TURNOS} value={form.turno} onChange={v=>setF("turno",v)} S={S} dark={dark}/>
          </div>

          <div style={S.card}>
            <div style={{fontSize:11,color:"#22c55e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>⏱️ Horários</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={S.lbl}>Saída</label>
                <div style={{display:"flex",gap:5}}>
                  <input type="time" value={form.saida} onChange={e=>setF("saida",e.target.value)} style={{...S.inp,flex:1}}/>
                  <button onClick={()=>setF("saida",nowTime())} style={{...S.btnSm,padding:"8px 10px",fontSize:14,flexShrink:0}}>⏱</button>
                </div>
              </div>
              <div>
                <label style={S.lbl}>Retorno</label>
                <div style={{display:"flex",gap:5}}>
                  <input type="time" value={form.retorno} onChange={e=>setF("retorno",e.target.value)} style={{...S.inp,flex:1}}/>
                  <button onClick={()=>setF("retorno",nowTime())} style={{...S.btnSm,padding:"8px 10px",fontSize:14,flexShrink:0}}>⏱</button>
                </div>
              </div>
            </div>
          </div>

          <div style={S.card}>
            <label style={S.lbl}>Observação (opcional)</label>
            <textarea value={form.obs} onChange={e=>setF("obs",e.target.value)}
              placeholder="Observações..." style={{...S.inp,height:50,resize:"vertical",fontSize:12}}/>
          </div>

          <div style={{display:"flex",gap:8}}>
            <button onClick={salvarRascunho} style={{...S.btnSec,flex:1,color:"#f59e0b",borderColor:"#f59e0b33"}}>💾 Salvar Rascunho</button>
            <button onClick={salvar} disabled={saving} style={{...S.btn,flex:1,opacity:saving?0.7:1}}>
              {saving?"⟳ Salvando...":"✓ Registrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const hoje = registros.filter(r=>r.data===todayStr());
  const anteriores = registros.filter(r=>r.data!==todayStr());

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <SectionHeader S={S} dark={dark} title="⏱️ Intervalo" sub={`${project?.id||""} · ${registros.length} registro(s)`}
          onBack={onBack} onToggleTheme={onToggleTheme}/>
        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <KPI S={S} val={registros.length} label="TOTAL" color="#0ea5e9"/>
            <KPI S={S} val={hoje.length} label="HOJE" color="#22c55e"/>
          </div>

          {hasDraft && (
            <div style={{background:dark?"#1a1000":"#fffbeb",border:"1px solid #f59e0b55",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>📝</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Rascunho salvo</div>
                <div style={{fontSize:11,...S.txt2}}>Continue de onde parou</div>
              </div>
              <button onClick={novoComRascunho} style={{...S.btnSm,color:"#f59e0b",border:"1px solid #f59e0b44"}}>Continuar</button>
            </div>
          )}

          <button onClick={novoLimpo} style={S.btn}>+ Novo Intervalo</button>

          {registros.length===0 && (
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:32,marginBottom:10}}>⏱️</div>
              <div style={{fontSize:13,...S.txt}}>Nenhum intervalo registrado</div>
            </div>
          )}

          {hoje.length>0 && (<>
            <div style={{fontSize:10,color:"#22c55e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Hoje</div>
            {hoje.map(r=><IntervaloCard key={r.id} r={r} dark={dark} S={S} adminAuth={adminAuth} onExcluir={()=>{if(window.confirm("Excluir?")) excluir(r.id);}}/>)}
          </>)}
          {anteriores.length>0 && (<>
            <div style={{fontSize:10,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginTop:4}}>Anteriores</div>
            {anteriores.map(r=><IntervaloCard key={r.id} r={r} dark={dark} S={S} adminAuth={adminAuth} onExcluir={()=>{if(window.confirm("Excluir?")) excluir(r.id);}}/>)}
          </>)}
        </div>
      </div>
    </div>
  );
}

function IntervaloCard({ r, dark, S, adminAuth, onExcluir }) {
  const [open, setOpen] = useState(false);
  const tn = TURNOS.find(t=>t.key===r.turno) || TURNOS[0];
  return (
    <div style={{...S.card,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10}} onClick={()=>setOpen(!open)}>
        <div style={{width:40,height:40,borderRadius:10,background:dark?"#0f172a":"#f1f5f9",border:`1px solid ${dark?"#1e293b":"#e2e8f0"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>
          👤
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,...S.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.nome}</div>
          {r.cargo&&<div style={{fontSize:11,...S.txt2}}>{r.cargo}</div>}
          <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
            <span style={{fontSize:10,...S.txt2}}>📅 {fmtDate(r.data)}</span>
            <span style={{fontSize:10,color:tn.color,fontWeight:700}}>{tn.icon} {tn.label}</span>
            {r.saida&&<span style={{fontSize:10,color:"#f59e0b"}}>↗ {r.saida}</span>}
            {r.retorno&&<span style={{fontSize:10,color:"#22c55e"}}>↘ {r.retorno}</span>}
          </div>
        </div>
        <span style={{...S.txt2,fontSize:12}}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${dark?"#0f172a":"#f1f5f9"}`}}>
          {r.obs&&<div style={{fontSize:12,...S.txt,marginBottom:8,lineHeight:1.5}}>{r.obs}</div>}
          {adminAuth && (
            <button onClick={onExcluir} style={{...S.btnSm,color:"#ef4444",border:"1px solid #ef444433"}}>🗑 Excluir</button>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// SEÇÃO 3 — VISITA DA SUPERVISÃO
// ════════════════════════════════════════════════════════════════════════
function SupervisaoSection({ project, dark, adminAuth, onBack, onToggleTheme }) {
  const S = getStyles(dark);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screen, setScreen] = useState("list");
  const [hasDraft, setHasDraft] = useState(false);

  const emptyForm = () => ({
    id: Date.now().toString()+Math.random().toString(36).substring(2,6),
    data: todayStr(),
    supervisor:"",
    turno:"diurno",
    hora: nowTime(),
    resumo:"",
    obs:"",
    registradoEm: new Date().toISOString()
  });
  const [form, setForm] = useState(emptyForm());
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    if(!project?.id) return;
    loadRegistros("supervisao", project.id).then(r=>{ setRegistros(r||[]); setLoading(false); });
    setHasDraft(!!loadDraft("supervisao", project.id));
  },[project?.id]);

  useEffect(()=>{
    if(screen==="form" && project?.id) {
      saveDraft("supervisao", project.id, form);
      setHasDraft(true);
    }
  },[form, screen, project?.id]);

  const novoComRascunho = () => {
    const d = loadDraft("supervisao", project.id);
    if(d?.form) setForm(d.form); else setForm(emptyForm());
    setScreen("form");
  };
  const novoLimpo = () => { clearDraft("supervisao", project.id); setHasDraft(false); setForm(emptyForm()); setScreen("form"); };

  const salvarRascunho = () => { saveDraft("supervisao", project.id, form); setHasDraft(true); setScreen("list"); };

  const salvar = async () => {
    if(!form.supervisor.trim()) { alert("Informe o nome do supervisor"); return; }
    if(!form.resumo.trim()) { alert("Descreva o resumo da visita"); return; }
    setSaving(true);
    try {
      const novo = {...form, registradoEm: new Date().toISOString()};
      const newList = [novo, ...registros];
      setRegistros(newList);
      await saveRegistros("supervisao", project.id, newList);
      clearDraft("supervisao", project.id);
      setHasDraft(false);
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
    await saveRegistros("supervisao", project.id, newList);
  };

  if(loading) return <LoadingScreen S={S} icon="👁️" label="Carregando supervisões..."/>;

  if(screen==="form") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <SectionHeader S={S} dark={dark} title="👁️ Visita da Supervisão" sub={`${project?.id||""} · novo registro`}
          onBack={()=>setScreen("list")} onToggleTheme={onToggleTheme}/>
        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>

          <div style={{...S.card,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:11,color:"#a855f7",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>👤 Supervisor</div>
            <div><label style={S.lbl}>Nome do Supervisor *</label><input value={form.supervisor} onChange={e=>setF("supervisor",e.target.value)} placeholder="Nome completo..." style={S.inp}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={S.lbl}>Data</label><input type="date" value={form.data} onChange={e=>setF("data",e.target.value)} style={S.inp}/></div>
              <div>
                <label style={S.lbl}>Hora</label>
                <div style={{display:"flex",gap:5}}>
                  <input type="time" value={form.hora} onChange={e=>setF("hora",e.target.value)} style={{...S.inp,flex:1}}/>
                  <button onClick={()=>setF("hora",nowTime())} style={{...S.btnSm,padding:"8px 10px",fontSize:14,flexShrink:0}}>⏱</button>
                </div>
              </div>
            </div>
          </div>

          <div style={S.card}>
            <label style={S.lbl}>Turno</label>
            <PillGroup options={TURNOS} value={form.turno} onChange={v=>setF("turno",v)} S={S} dark={dark}/>
          </div>

          <div style={S.card}>
            <label style={{...S.lbl,marginBottom:8}}>Resumo da Visita *</label>
            <textarea value={form.resumo} onChange={e=>setF("resumo",e.target.value)}
              placeholder="O que foi verificado / alinhado na supervisão..." style={{...S.inp,height:80,resize:"vertical",fontSize:12}}/>
          </div>

          <div style={S.card}>
            <label style={S.lbl}>Observação (opcional)</label>
            <textarea value={form.obs} onChange={e=>setF("obs",e.target.value)}
              placeholder="Observações..." style={{...S.inp,height:50,resize:"vertical",fontSize:12}}/>
          </div>

          <div style={{display:"flex",gap:8}}>
            <button onClick={salvarRascunho} style={{...S.btnSec,flex:1,color:"#f59e0b",borderColor:"#f59e0b33"}}>💾 Salvar Rascunho</button>
            <button onClick={salvar} disabled={saving} style={{...S.btn,flex:1,opacity:saving?0.7:1}}>
              {saving?"⟳ Salvando...":"✓ Registrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const hoje = registros.filter(r=>r.data===todayStr());
  const anteriores = registros.filter(r=>r.data!==todayStr());

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <SectionHeader S={S} dark={dark} title="👁️ Visita da Supervisão" sub={`${project?.id||""} · ${registros.length} registro(s)`}
          onBack={onBack} onToggleTheme={onToggleTheme}/>
        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <KPI S={S} val={registros.length} label="TOTAL" color="#a855f7"/>
            <KPI S={S} val={hoje.length} label="HOJE" color="#22c55e"/>
          </div>

          {hasDraft && (
            <div style={{background:dark?"#1a1000":"#fffbeb",border:"1px solid #f59e0b55",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>📝</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Rascunho salvo</div>
                <div style={{fontSize:11,...S.txt2}}>Continue de onde parou</div>
              </div>
              <button onClick={novoComRascunho} style={{...S.btnSm,color:"#f59e0b",border:"1px solid #f59e0b44"}}>Continuar</button>
            </div>
          )}

          <button onClick={novoLimpo} style={S.btn}>+ Nova Visita de Supervisão</button>

          {registros.length===0 && (
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:32,marginBottom:10}}>👁️</div>
              <div style={{fontSize:13,...S.txt}}>Nenhuma supervisão registrada</div>
            </div>
          )}

          {hoje.length>0 && (<>
            <div style={{fontSize:10,color:"#a855f7",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Hoje</div>
            {hoje.map(r=><SupervisaoCard key={r.id} r={r} dark={dark} S={S} adminAuth={adminAuth} onExcluir={()=>{if(window.confirm("Excluir?")) excluir(r.id);}}/>)}
          </>)}
          {anteriores.length>0 && (<>
            <div style={{fontSize:10,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginTop:4}}>Anteriores</div>
            {anteriores.map(r=><SupervisaoCard key={r.id} r={r} dark={dark} S={S} adminAuth={adminAuth} onExcluir={()=>{if(window.confirm("Excluir?")) excluir(r.id);}}/>)}
          </>)}
        </div>
      </div>
    </div>
  );
}

function SupervisaoCard({ r, dark, S, adminAuth, onExcluir }) {
  const [open, setOpen] = useState(false);
  const tn = TURNOS.find(t=>t.key===r.turno) || TURNOS[0];
  return (
    <div style={{...S.card,border:`1px solid #a855f733`}}>
      <div style={{display:"flex",alignItems:"center",gap:10}} onClick={()=>setOpen(!open)}>
        <div style={{width:40,height:40,borderRadius:10,background:dark?"#120a2e":"#f3e8ff",border:"1px solid #a855f733",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>
          👁️
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,...S.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.supervisor}</div>
          <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
            <span style={{fontSize:10,...S.txt2}}>📅 {fmtDate(r.data)}</span>
            {r.hora&&<span style={{fontSize:10,color:"#22c55e"}}>⏱ {r.hora}</span>}
            <span style={{fontSize:10,color:tn.color,fontWeight:700}}>{tn.icon} {tn.label}</span>
          </div>
        </div>
        <span style={{...S.txt2,fontSize:12}}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${dark?"#0f172a":"#f1f5f9"}`}}>
          {r.resumo&&<div style={{fontSize:12,...S.txt,marginBottom:6,lineHeight:1.5}}><strong>Resumo:</strong> {r.resumo}</div>}
          {r.obs&&<div style={{fontSize:12,...S.txt2,marginBottom:8,lineHeight:1.5}}>{r.obs}</div>}
          {adminAuth && (
            <button onClick={onExcluir} style={{...S.btnSm,color:"#ef4444",border:"1px solid #ef444433"}}>🗑 Excluir</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componentes compartilhados
function SectionHeader({ S, dark, title, sub, onBack, onToggleTheme }) {
  return (
    <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <button onClick={onBack} style={S.backBtn}>← Voltar</button>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:800,...S.txt}}>{title}</div>
          <div style={{fontSize:11,...S.txt2}}>{sub}</div>
        </div>
        {onToggleTheme && (
          <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,...S.txt2}}>
            {dark?"☀️":"🌙"}
          </button>
        )}
      </div>
    </div>
  );
}

function KPI({ S, val, label, color }) {
  return (
    <div style={{...S.card,textAlign:"center",padding:"10px 8px"}}>
      <div style={{fontSize:22,fontWeight:900,color}}>{val}</div>
      <div style={{fontSize:9,...S.txt2,fontWeight:700}}>{label}</div>
    </div>
  );
}

function LoadingScreen({ S, icon, label }) {
  return (
    <div style={{...S.page, alignItems:"center", justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:30, marginBottom:10}}>{icon}</div>
        <div style={{fontSize:13, ...S.txt2}}>{label}</div>
      </div>
    </div>
  );
}
