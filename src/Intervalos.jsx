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

const PROJECT_PINS = {
  P601:"16601",P602:"16602",P604:"16604",P605:"16605",
  P606:"16606",P607:"16607",P311A:"16311",P311B:"16311",
  P505:"16505",P260A:"162601",P260B:"162602",P260C:"162603"
};
const ADMIN_PIN = "872101";

const TIPOS_INTERVALO = [
  { key:"cafe1",    icon:"☕", label:"Café",         cor:"#f59e0b" },
  { key:"refeicao", icon:"🍽️", label:"Almoço/Janta", cor:"#22c55e" },
  { key:"cafe2",    icon:"☕", label:"Café",          cor:"#f59e0b" },
];

function todayStr() { return new Date().toLocaleDateString("sv-SE"); }
function nowTime() {
  const n=new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}
function fmtDate(d) {
  if(!d) return "--";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}
function calcDuracao(saida, retorno) {
  if(!saida||!retorno) return null;
  try {
    const [sh,sm]=saida.split(":").map(Number);
    const [rh,rm]=retorno.split(":").map(Number);
    let mins=(rh*60+rm)-(sh*60+sm);
    if(mins<0) mins+=24*60;
    if(mins<=0) return null;
    const h=Math.floor(mins/60), m=mins%60;
    return h>0?`${h}h ${m}min`:`${m} min`;
  } catch { return null; }
}

async function loadIntervalos(projectId) {
  try {
    const snap = await getDoc(doc(db,"intervalos",projectId));
    if(snap.exists()) {
      const data = snap.data().registros||[];
      try { localStorage.setItem(`intervalos_${projectId}`, JSON.stringify(data)); } catch(e){}
      return data;
    }
  } catch(e){}
  try {
    const local = localStorage.getItem(`intervalos_${projectId}`);
    if(local) return JSON.parse(local);
  } catch(e){}
  return [];
}

async function saveIntervalos(projectId, registros) {
  try { await setDoc(doc(db,"intervalos",projectId),{registros,updatedAt:new Date().toISOString()}); } catch(e){ console.error(e); }
  try { localStorage.setItem(`intervalos_${projectId}`, JSON.stringify(registros)); } catch(e){}
}

async function loadEquipe(projectId) {
  try {
    const snap = await getDoc(doc(db,"equipes",projectId));
    if(snap.exists()) {
      const cols = snap.data().colaboradores||[];
      return cols.filter(c=>c.status!=="desligado"&&c.nome&&c.nome.trim());
    }
  } catch(e){}
  return [];
}

function getStyles(dark) {
  return {
    page:    { minHeight:"100vh", background:dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 80px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:480, display:"flex", flexDirection:"column" },
    card:    { background:dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"14px 16px" },
    btn:     { background:"linear-gradient(135deg,#1d4ed8,#1e40af)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnGreen:{ background:"linear-gradient(135deg,#16a34a,#15803d)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
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

function emptyRegistro() {
  return {
    id: Date.now().toString()+Math.random().toString(36).substring(2,5),
    data: todayStr(),
    turno: "Diurno",
    intervalos: {
      cafe1:    { saida:"", retorno:"", colaboradores:[] },
      refeicao: { saida:"", retorno:"", colaboradores:[] },
      cafe2:    { saida:"", retorno:"", colaboradores:[] },
    },
    criadoEm: new Date().toISOString(),
  };
}

function PinGate({ project, onSuccess, onBack, dark }) {
  const S = getStyles(dark);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const tryPin = () => {
    if(pin===ADMIN_PIN){ onSuccess("admin"); return; }
    if(pin===PROJECT_PINS[project.id]){ onSuccess("lider"); return; }
    setErr(true);
  };
  return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,maxWidth:320,width:"100%",margin:16,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>⏱️</div>
        <div style={{fontSize:16,fontWeight:800,...S.txt,marginBottom:4}}>Intervalos de Turno</div>
        <div style={{fontSize:12,...S.txt2,marginBottom:20}}>{project.id} · {project.name}</div>
        <div style={{fontSize:12,...S.txt2,marginBottom:12}}>PIN do projeto (Central)</div>
        <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8}
          value={pin} onChange={e=>{setPin(e.target.value);setErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter") tryPin();}}
          style={{...S.inp,textAlign:"center",fontSize:22,letterSpacing:10,marginBottom:8}}/>
        {err&&<div role="alert" style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onBack} style={{...S.btnSec,flex:1,fontSize:13}}>← Voltar</button>
          <button onClick={tryPin} style={{...S.btn,flex:1,fontSize:13}}>Entrar</button>
        </div>
      </div>
    </div>
  );
}

export default function Intervalos({ project, onBack, dark, onToggleTheme }) {
  const S = getStyles(dark||true);
  const [authLevel, setAuthLevel] = useState(null);
  const [screen, setScreen] = useState("pin");
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [viewReg, setViewReg] = useState(null);
  const [equipe, setEquipe] = useState([]);
  const adminAuth = authLevel==="admin";

  // ── Rascunho automático (evita perder o preenchimento se a aba fechar,
  // o navegador travar, ou a pessoa voltar sem querer antes de salvar).
  const [draft, setDraft] = useState(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const draftKey = project?.id ? `intervalos_draft_${project.id}` : null;

  const clearDraft = () => {
    if(draftKey) { try{ localStorage.removeItem(draftKey); }catch(e){} }
    setDraft(null);
  };

  useEffect(()=>{
    if(!project?.id) return;
    loadIntervalos(project.id).then(r=>{ setRegistros(r||[]); setLoading(false); });
    loadEquipe(project.id).then(setEquipe);
    try {
      const d = localStorage.getItem(`intervalos_draft_${project.id}`);
      if(d) setDraft(JSON.parse(d));
    } catch(e){}
  },[project?.id]);

  // Salva o formulário automaticamente a cada alteração, enquanto está sendo preenchido.
  useEffect(()=>{
    if(screen==="form" && form && draftKey){
      try { localStorage.setItem(draftKey, JSON.stringify(form)); } catch(e){}
      setDraft(form);
    }
  },[form, screen, draftKey]);

  const setIntervalo = (tipo, campo, val) => {
    setForm(f=>({...f, intervalos:{...f.intervalos,[tipo]:{...f.intervalos[tipo],[campo]:val}}}));
  };

  const addColab = (tipo, colab) => {
    setForm(f=>{
      const iv = f.intervalos[tipo]||{};
      const lista = iv.colaboradores||[];
      if(lista.some(c=>c.id===colab.id)) return f;
      return {...f, intervalos:{...f.intervalos,[tipo]:{...iv, colaboradores:[...lista,{id:colab.id,nome:colab.nome,saida:"",retorno:""}]}}};
    });
  };

  const addColabManual = (tipo, nome) => {
    if(!nome||!nome.trim()) return;
    setForm(f=>{
      const iv = f.intervalos[tipo]||{};
      const lista = iv.colaboradores||[];
      return {...f, intervalos:{...f.intervalos,[tipo]:{...iv, colaboradores:[...lista,{id:"m"+Date.now(),nome:nome.trim(),saida:"",retorno:""}]}}};
    });
  };

  const removeColab = (tipo, id) => {
    setForm(f=>{
      const iv = f.intervalos[tipo]||{};
      return {...f, intervalos:{...f.intervalos,[tipo]:{...iv, colaboradores:(iv.colaboradores||[]).filter(c=>c.id!==id)}}};
    });
  };

  const setColabTime = (tipo, id, campo, val) => {
    setForm(f=>{
      const iv = f.intervalos[tipo]||{};
      return {...f, intervalos:{...f.intervalos,[tipo]:{...iv, colaboradores:(iv.colaboradores||[]).map(c=>c.id===id?{...c,[campo]:val}:c)}}};
    });
  };

  // ── Aviso de duplicidade: evita dois registros pro mesmo dia + turno
  // (ex.: duas pessoas registrando o intervalo do mesmo turno sem perceber).
  const salvar = async () => {
    const duplicado = registros.some(r => r.id!==form.id && r.data===form.data && r.turno===form.turno);
    if(duplicado){
      const continuar = window.confirm(
        `Já existe um registro de intervalos para ${form.turno} em ${fmtDate(form.data)}.\n\n` +
        `Deseja salvar mesmo assim? Isso vai criar um registro duplicado para esse turno.`
      );
      if(!continuar) return;
    }
    setSaving(true);
    try {
      const novo = {...form, criadoEm:new Date().toISOString()};
      const newList = [novo,...registros];
      setRegistros(newList);
      await saveIntervalos(project.id, newList);
      clearDraft();
      setScreen("list");
      setForm(null);
    } catch(e){ alert("Erro ao salvar"); }
    setSaving(false);
  };

  const excluir = async (id) => {
    const newList = registros.filter(r=>r.id!==id);
    setRegistros(newList);
    await saveIntervalos(project.id, newList);
    if(viewReg?.id===id){ setViewReg(null); setScreen("list"); }
  };

  const abrirNovoRegistro = () => {
    if(draft){ setShowDraftPrompt(true); return; }
    setForm(emptyRegistro());
    setScreen("form");
  };

  if(screen==="pin") return <PinGate project={project||{}} dark={dark||true} onBack={onBack} onSuccess={(l)=>{setAuthLevel(l);setScreen("list");}}/>;

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:30,marginBottom:10}}>⏱️</div><div style={{fontSize:13,...S.txt2}}>Carregando...</div></div>
    </div>
  );

  // ── PROMPT DE RASCUNHO
  if(showDraftPrompt) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,maxWidth:320,width:"100%",margin:16,textAlign:"center",border:"1px solid #f59e0b"}}>
        <div style={{fontSize:28,marginBottom:10}}>📝</div>
        <div style={{fontSize:15,fontWeight:700,...S.txt,marginBottom:6}}>Rascunho encontrado</div>
        <div style={{fontSize:12,...S.txt2,marginBottom:20}}>
          Há um registro de intervalos em andamento ({draft?.turno||"—"} · {fmtDate(draft?.data)}). Continuar de onde parou?
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={()=>{setForm(draft);setShowDraftPrompt(false);setScreen("form");}} style={S.btn}>↩ Continuar rascunho</button>
          <button onClick={()=>{clearDraft();setShowDraftPrompt(false);setForm(emptyRegistro());setScreen("form");}} style={{...S.btnSec,color:"#ef4444"}}>🗑 Descartar e começar novo</button>
          <button onClick={()=>setShowDraftPrompt(false)} style={{...S.btnSec,fontSize:12}}>Cancelar</button>
        </div>
      </div>
    </div>
  );

  // ── VIEW
  if(screen==="view"&&viewReg) return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>{setViewReg(null);setScreen("list");}} style={S.backBtn} aria-label="Voltar">← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>⏱️ Intervalos</div>
              <div style={{fontSize:11,...S.txt2}}>{viewReg.turno} · {fmtDate(viewReg.data)}</div>
            </div>
          </div>
        </div>
        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={S.card}>
            {TIPOS_INTERVALO.map((t,i)=>{
              const iv = viewReg.intervalos[t.key]||{};
              const lista = iv.colaboradores||[];
              const dur = calcDuracao(iv.saida, iv.retorno);
              return (
                <div key={t.key} style={{padding:"10px 0",borderBottom:i<2?`1px solid ${dark?"#0f172a":"#f1f5f9"}`:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:22,flexShrink:0}}>{t.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,...S.txt}}>{t.label} {i===0?"(1º)":i===2?"(2º)":""}</div>
                      {lista.length===0 && (
                        <div style={{display:"flex",gap:10,marginTop:3}}>
                          {iv.saida&&<span style={{fontSize:11,color:"#ef4444"}}>Saída: {iv.saida}</span>}
                          {iv.retorno&&<span style={{fontSize:11,color:"#22c55e"}}>Retorno: {iv.retorno}</span>}
                          {!iv.saida&&<span style={{fontSize:10,...S.txt2}}>—</span>}
                        </div>
                      )}
                    </div>
                    {lista.length===0&&dur&&<span style={{fontSize:12,fontWeight:700,color:t.cor,background:t.cor+"22",padding:"3px 10px",borderRadius:8,flexShrink:0}}>{dur}</span>}
                  </div>
                  {lista.length>0 && (
                    <div style={{marginTop:6,marginLeft:34,display:"flex",flexDirection:"column",gap:4}}>
                      {lista.map(c=>{
                        const cd=calcDuracao(c.saida,c.retorno);
                        return (
                          <div key={c.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:11}}>
                            <span style={{...S.txt,fontWeight:600,minWidth:90}}>👤 {c.nome}</span>
                            {c.saida&&<span style={{color:"#ef4444"}}>↑ {c.saida}</span>}
                            {c.retorno&&<span style={{color:"#22c55e"}}>↓ {c.retorno}</span>}
                            {cd&&<span style={{fontWeight:700,color:t.cor}}>{cd}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {adminAuth&&<button onClick={()=>{if(window.confirm("Excluir?")) excluir(viewReg.id);}} style={{...S.btnSec,color:"#ef4444",borderColor:"#ef444433",fontSize:13}}>🗑 Excluir</button>}
        </div>
      </div>
    </div>
  );

  // ── FORMULÁRIO
  if(screen==="form"&&form) return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>{setScreen("list");setForm(null);}} style={S.backBtn} aria-label="Voltar">← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>⏱️ Registrar Intervalos</div>
              <div style={{fontSize:11,...S.txt2}}>{project.id} · {project.name}</div>
            </div>
            <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,...S.txt2}} aria-label="Alternar tema claro/escuro">{dark?"☀️":"🌙"}</button>
          </div>
        </div>
        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontSize:10,...S.txt2,textAlign:"center"}}>💾 Rascunho salvo automaticamente</div>
          {/* Data e Turno */}
          <div style={{...S.card,display:"flex",flexDirection:"column",gap:10}}>
            <div>
              <label style={S.lbl}>Data</label>
              <input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Turno</label>
              <div style={{display:"flex",gap:8}}>
                {["Diurno","Noturno"].map(t=>(
                  <button key={t} onClick={()=>setForm(f=>({...f,turno:t}))}
                    style={{flex:1,background:form.turno===t?t==="Diurno"?"#1a2e1a":"#0a0a2e":"transparent",border:`2px solid ${form.turno===t?t==="Diurno"?"#22c55e":"#818cf8":"#0f172a"}`,color:form.turno===t?t==="Diurno"?"#22c55e":"#818cf8":dark?"#475569":"#94a3b8",borderRadius:8,padding:"10px",fontSize:13,cursor:"pointer",fontWeight:form.turno===t?700:400}}>
                    {t==="Diurno"?"☀️ Diurno":"🌙 Noturno"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {registros.some(r=>r.id!==form.id && r.data===form.data && r.turno===form.turno) && (
            <div role="alert" style={{background:dark?"#1a1000":"#fffbeb",border:"1px solid #f59e0b66",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>⚠️</span>
              <div style={{fontSize:11,color:dark?"#fbbf24":"#92400e"}}>Já existe um registro para <strong>{form.turno}</strong> em <strong>{fmtDate(form.data)}</strong>. Salvar agora vai criar um registro duplicado.</div>
            </div>
          )}

          {/* 3 Intervalos */}
          {TIPOS_INTERVALO.map((tipo,i)=>{
            const iv = form.intervalos[tipo.key]||{};
            const lista = iv.colaboradores||[];
            const jaAdd = new Set(lista.map(c=>c.id));
            const disponiveis = equipe.filter(c=>!jaAdd.has(c.id));
            return (
              <div key={tipo.key} style={S.card}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                  <span style={{fontSize:20}}>{tipo.icon}</span>
                  <div style={{fontSize:13,fontWeight:700,...S.txt}}>{i+1}º Intervalo — {tipo.label}</div>
                  {lista.length>0&&<span style={{fontSize:11,fontWeight:700,color:tipo.cor,background:tipo.cor+"22",padding:"2px 10px",borderRadius:8,marginLeft:"auto"}}>{lista.length} colaborador(es)</span>}
                </div>

                {/* Lista de colaboradores adicionados */}
                {lista.map(c=>{
                  const dur=calcDuracao(c.saida,c.retorno);
                  return (
                    <div key={c.id} style={{background:dark?"#020510":"#f8fafc",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderRadius:8,padding:"8px 10px",marginBottom:6}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                        <span style={{fontSize:13,fontWeight:600,...S.txt,flex:1}}>👤 {c.nome}</span>
                        {dur&&<span style={{fontSize:11,fontWeight:700,color:tipo.cor}}>{dur}</span>}
                        <button onClick={()=>removeColab(tipo.key,c.id)} style={{background:"transparent",border:"none",color:"#ef444488",fontSize:15,cursor:"pointer",padding:"0 4px"}} aria-label={`Remover ${c.nome}`}>✕</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div>
                          <label style={{...S.lbl,fontSize:9}}>Saída</label>
                          <div style={{display:"flex",gap:4}}>
                            <input type="time" value={c.saida||""} onChange={e=>setColabTime(tipo.key,c.id,"saida",e.target.value)} style={{...S.inp,flex:1,fontSize:12,padding:"7px 8px"}}/>
                            <button onClick={()=>setColabTime(tipo.key,c.id,"saida",nowTime())} style={{...S.btnSm,padding:"6px 8px",fontSize:12,flexShrink:0}} aria-label="Usar horário atual na saída">⏱</button>
                          </div>
                        </div>
                        <div>
                          <label style={{...S.lbl,fontSize:9}}>Retorno</label>
                          <div style={{display:"flex",gap:4}}>
                            <input type="time" value={c.retorno||""} onChange={e=>setColabTime(tipo.key,c.id,"retorno",e.target.value)} style={{...S.inp,flex:1,fontSize:12,padding:"7px 8px"}}/>
                            <button onClick={()=>setColabTime(tipo.key,c.id,"retorno",nowTime())} style={{...S.btnSm,padding:"6px 8px",fontSize:12,flexShrink:0}} aria-label="Usar horário atual no retorno">⏱</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Adicionar colaborador */}
                <div style={{marginTop:lista.length>0?8:0}}>
                  <label style={S.lbl}>+ Adicionar colaborador</label>
                  {disponiveis.length>0 ? (
                    <select value="" onChange={e=>{const c=equipe.find(x=>x.id===e.target.value);if(c)addColab(tipo.key,c);e.target.value="";}}
                      style={{...S.inp,cursor:"pointer"}}>
                      <option value="">Selecione um colaborador...</option>
                      {disponiveis.map(c=>(
                        <option key={c.id} value={c.id}>{c.nome} — {c.turno||"—"}{c.cargo?` · ${c.cargo}`:""}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{fontSize:11,...S.txt2,padding:"6px 0"}}>
                      {equipe.length===0?"Nenhum colaborador cadastrado na equipe deste projeto.":"Todos os colaboradores já foram adicionados."}
                    </div>
                  )}
                  <button onClick={()=>{const nome=prompt("Nome do colaborador (não cadastrado na equipe):");if(nome)addColabManual(tipo.key,nome);}}
                    style={{...S.btnSm,marginTop:6,width:"100%",padding:"7px"}}>+ Outro (digitar nome)</button>
                </div>
              </div>
            );
          })}

          <button onClick={salvar} disabled={saving} style={{...S.btnGreen,opacity:saving?0.7:1}}>
            {saving?"⟳ Salvando...":"✓ Salvar Intervalos"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── LISTA
  const hoje = registros.filter(r=>r.data===todayStr());
  const anteriores = registros.filter(r=>r.data!==todayStr());

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onBack} style={S.backBtn} aria-label="Voltar">← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>⏱️ Intervalos</div>
              <div style={{fontSize:11,...S.txt2}}>{project.id} · {registros.length} registro(s)</div>
            </div>
            <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,...S.txt2}} aria-label="Alternar tema claro/escuro">{dark?"☀️":"🌙"}</button>
          </div>
        </div>

        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
          {draft&&(
            <div style={{background:dark?"#1a1000":"#fffbeb",border:"1px solid #f59e0b55",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>📝</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Rascunho em andamento</div>
                <div style={{fontSize:11,...S.txt2}}>{draft.turno} · {fmtDate(draft.data)} — salvo automaticamente</div>
              </div>
              <button onClick={()=>{setForm(draft);setScreen("form");}} style={{...S.btnSm,color:"#f59e0b",border:"1px solid #f59e0b44"}}>Continuar</button>
            </div>
          )}

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

          <button onClick={abrirNovoRegistro} style={S.btn}>
            + Registrar Intervalos do Turno
          </button>

          {registros.length===0&&(
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:32,marginBottom:10}}>⏱️</div>
              <div style={{fontSize:13,...S.txt}}>Nenhum registro ainda</div>
            </div>
          )}

          {hoje.length>0&&(
            <>
              <div style={{fontSize:10,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Hoje</div>
              {hoje.map(r=><RegistroCard key={r.id} r={r} dark={dark||true} S={S} onVer={()=>{setViewReg(r);setScreen("view");}}/>)}
            </>
          )}
          {anteriores.length>0&&(
            <>
              <div style={{fontSize:10,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginTop:4}}>Anteriores</div>
              {anteriores.map(r=><RegistroCard key={r.id} r={r} dark={dark||true} S={S} onVer={()=>{setViewReg(r);setScreen("view");}}/>)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RegistroCard({ r, dark, S, onVer }) {
  const totalColabs = TIPOS_INTERVALO.reduce((acc,t)=>acc+((r.intervalos[t.key]?.colaboradores||[]).length),0);
  const duracoes = TIPOS_INTERVALO.map(t=>{
    const iv = r.intervalos[t.key]||{};
    return calcDuracao(iv.saida, iv.retorno);
  }).filter(Boolean);

  return (
    <div style={{...S.card,cursor:"pointer"}} onClick={onVer}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:40,height:40,borderRadius:10,background:r.turno==="Diurno"?dark?"#1a2e1a":"#dcfce7":dark?"#0a0a2e":"#e0e7ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20}}>
          {r.turno==="Diurno"?"☀️":"🌙"}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,...S.txt}}>{r.turno} · {fmtDate(r.data)}</div>
          <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
            {totalColabs>0 ? (
              <span style={{fontSize:10,color:"#0ea5e9",background:"#0ea5e922",padding:"1px 7px",borderRadius:5,fontWeight:700}}>👤 {totalColabs} colaborador(es)</span>
            ) : (
              <>
                {TIPOS_INTERVALO.map((t)=>{
                  const iv = r.intervalos[t.key]||{};
                  const dur = calcDuracao(iv.saida,iv.retorno);
                  return dur?(
                    <span key={t.key} style={{fontSize:10,color:t.cor,background:t.cor+"22",padding:"1px 7px",borderRadius:5,fontWeight:700}}>
                      {t.icon} {dur}
                    </span>
                  ):null;
                })}
                {duracoes.length===0&&<span style={{fontSize:10,...S.txt2}}>Sem horários registrados</span>}
              </>
            )}
          </div>
        </div>
        <span style={{...S.txt2,fontSize:16}}>›</span>
      </div>
    </div>
  );
}
