// ─────────────────────────────────────────────────────────────
// RondaDiaria.jsx — Ronda Perimetral Diária (v2)
// Correções desta versão:
// • Foco no teclado: campos renderizados inline (sem componente aninhado)
//   — digitação contínua na observação e nos horários
// • Fotos por ronda (até 2), com opção de câmera; comprimidas p/ ~640px
// • Seleção de responsável: lista COMPLETA do cadastro Equipe do projeto,
//   excluindo apenas cargos de CCO
// • Armazenamento: 1 documento por plantão (rondas_plantoes/{id}) + índice
//   leve por projeto (rondas/{projectId}) — fotos não estouram o limite
//   de 1MB do Firestore. Compatível com plantões da versão anterior
//   (embutidos no índice): continuam legíveis e migram ao serem tocados.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAccess, grantSession } from "./session";

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

const MAX_FOTOS_RONDA = 2;
const MAX_FOTOS_PLANTAO = 20; // segurança p/ o limite de 1MB do documento

function norm(s){ return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(); }

// ── Turno/plantão pelo relógio
export function turnoAtual(){
  const h = new Date().getHours();
  return (h>=6 && h<18) ? "diurno" : "noturno";
}
export function dataPlantaoAtual(){
  const d = new Date();
  if(d.getHours() < 6) d.setDate(d.getDate()-1); // madrugada = plantão noturno de ontem
  return d.toLocaleDateString("sv-SE");
}
function horaAgora(){
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
// Fim automático: início + 20 min, sem passar da hora cheia
export function fimAuto(inicio){
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(inicio||"").trim());
  if(!m) return "";
  const h = Math.min(23, +m[1]); const min = Math.min(59, +m[2]);
  const tot = min + 20;
  if(tot >= 60) return `${String(h).padStart(2,"0")}:59`;
  return `${String(h).padStart(2,"0")}:${String(tot).padStart(2,"0")}`;
}
function slotAnterior(dataPlantao, turno){
  if(turno==="noturno") return { dataPlantao, turno:"diurno" };
  const d = new Date(dataPlantao+"T12:00:00"); d.setDate(d.getDate()-1);
  return { dataPlantao: d.toLocaleDateString("sv-SE"), turno:"noturno" };
}
function fmtData(d){ try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d||"—"; } }
function newId(){ try { return crypto.randomUUID(); } catch { return "id-"+Date.now()+"-"+Math.random().toString(36).slice(2,8); } }

const TURNO_UI = {
  diurno:  { label:"Diurno",  icon:"☀️", cor:"#f59e0b", limite:"18:00" },
  noturno: { label:"Noturno", icon:"🌙", cor:"#818cf8", limite:"06:00" },
};

// ── Foto: comprime para ~640px JPEG antes de guardar
function comprimirFoto(file){
  return new Promise((resolve)=>{
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const MAX = 640;
          let w = img.width, h = img.height;
          const s = Math.min(1, MAX/Math.max(w,h));
          w = Math.max(1, Math.round(w*s)); h = Math.max(1, Math.round(h*s));
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL("image/jpeg", 0.55));
        } catch(e){ resolve(null); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch(e){ resolve(null); }
  });
}

// ── Firestore
// Índice leve por projeto: rondas/{projectId} = { plantoes:[entrada leve], deletedIds }
// Plantão completo (com fotos): rondas_plantoes/{plantaoId}
// Compat: entradas antigas do índice podem trazer "rondas" embutidas.
function entradaLeve(p){
  return {
    id:p.id, dataPlantao:p.dataPlantao, turno:p.turno, lider:p.lider||"",
    nRondas:(p.rondas||[]).length, enviado:!!p.enviado, enviadoEm:p.enviadoEm||null,
    criadoEm:p.criadoEm||null,
  };
}
async function loadIndex(projectId){
  let data = null;
  try {
    const snap = await getDoc(doc(db,"rondas",projectId));
    if(snap.exists()){
      data = snap.data();
      try { localStorage.setItem(`rondas_${projectId}`, JSON.stringify(data)); } catch(e){}
    }
  } catch(e){}
  if(!data){
    try { const l = localStorage.getItem(`rondas_${projectId}`); if(l) data = JSON.parse(l); } catch(e){}
  }
  data = data || {};
  const del = new Set(data.deletedIds||[]);
  return { plantoes:(data.plantoes||[]).filter(p=>!del.has(p.id)), deletedIds:data.deletedIds||[] };
}
async function loadPlantaoFull(entrada){
  if(!entrada) return null;
  if(entrada.rondas) return entrada; // formato antigo: já vem completo
  let data = null;
  try {
    const snap = await getDoc(doc(db,"rondas_plantoes",entrada.id));
    if(snap.exists()) data = snap.data();
  } catch(e){}
  if(!data){
    try { const l = localStorage.getItem(`rondas_full_${entrada.id}`); if(l) data = JSON.parse(l); } catch(e){}
  }
  return data || { ...entrada, rondas:[] };
}
async function saveIndex(projectId, idx){
  const payload = { ...idx, updatedAt:new Date().toISOString() };
  try { await setDoc(doc(db,"rondas",projectId), payload); } catch(e){ console.error("Rondas index save:", e); }
  try { localStorage.setItem(`rondas_${projectId}`, JSON.stringify(payload)); } catch(e){}
}
async function savePlantaoFull(p){
  try { await setDoc(doc(db,"rondas_plantoes",p.id), p); } catch(e){ console.error("Plantao save:", e); }
  try { localStorage.setItem(`rondas_full_${p.id}`, JSON.stringify(p)); } catch(e){}
}

// ── Colaboradores: lista completa do cadastro Equipe, exceto cargos de CCO
async function loadColaboradores(projectId){
  let equipe = null;
  try {
    const snap = await getDoc(doc(db,"equipes",projectId));
    if(snap.exists()) equipe = snap.data();
  } catch(e){}
  if(!equipe){
    try { const l = localStorage.getItem(`equipe_${projectId}`); if(l) equipe = JSON.parse(l); } catch(e){}
  }
  return (equipe?.colaboradores||[])
    .filter(c=>(c.status||"ativo")==="ativo" && (c.nome||"").trim())
    .filter(c=>!norm(c.cargo).includes("cco"))
    .sort((a,b)=>norm(a.nome).localeCompare(norm(b.nome)))
    .map(c=>({ nome:c.nome, cargo:c.cargo||"" }));
}

function getStyles(dark) {
  return {
    page:    { minHeight:"100vh", background:dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 90px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:480, display:"flex", flexDirection:"column" },
    card:    { background:dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"14px 16px" },
    btn:     { background:"linear-gradient(135deg,#0d9488,#0f766e)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnSec:  { background:dark?"#060c18":"#f8fafc", color:dark?"#64748b":"#475569", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
    btnSm:   { background:dark?"#020510":"#f8fafc", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#64748b":"#475569", borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:600 },
    backBtn: { background:"transparent", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#94a3b8":"#64748b", borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 },
    inp:     { width:"100%", background:dark?"#020510":"#ffffff", border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`, borderRadius:7, color:dark?"#e2e8f0":"#1e293b", padding:"9px 10px", fontSize:13, boxSizing:"border-box", outline:"none" },
    lbl:     { display:"block", fontSize:10, color:dark?"#475569":"#64748b", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 },
    txt:     { color:dark?"#f1f5f9":"#0f172a" },
    txt2:    { color:dark?"#475569":"#64748b" },
  };
}

// ── PIN Gate (fallback — só aparece sem sessão válida)
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
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,maxWidth:320,width:"100%",margin:16,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>🚶</div>
        <div style={{fontSize:16,fontWeight:800,...S.txt,marginBottom:4}}>Ronda Perimetral Diária</div>
        <div style={{fontSize:12,...S.txt2,marginBottom:20}}>{project.id} · {project.name}</div>
        {!mode ? (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={()=>setMode("lider")} style={{...S.btn,fontSize:13}}>👷 Acesso Líder</button>
            <button onClick={()=>setMode("admin")} style={{...S.btnSec,fontSize:13,color:"#f59e0b",borderColor:"#f59e0b33"}}>🔐 Acesso Gerencial</button>
            <button onClick={onBack} style={{...S.btnSec,fontSize:13,marginTop:4}}>← Voltar</button>
          </div>
        ) : (
          <>
            <div style={{fontSize:12,...S.txt2,marginBottom:12}}>{mode==="lider"?"PIN do projeto":"PIN gerencial"}</div>
            <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pin}
              onChange={e=>{setPin(e.target.value);setErr(false);}}
              onKeyDown={e=>{if(e.key==="Enter") tryPin();}}
              style={{...S.inp,textAlign:"center",fontSize:22,letterSpacing:10,marginBottom:8}}/>
            {err&&<div role="alert" style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setMode(null);setPin("");setErr(false);}} style={{...S.btnSec,flex:1,fontSize:13}}>← Voltar</button>
              <button onClick={tryPin} style={{...S.btn,flex:1,fontSize:13}}>Entrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── App principal
export default function RondaDiaria({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }) {
  const S = getStyles(dark);
  const [authLevel, setAuthLevel] = useState(()=>sharedAuth||getAccess(project?.id)||null);
  const [screen, setScreen] = useState(()=>(sharedAuth||getAccess(project?.id))?"home":"pin"); // pin | home | view
  const [idx, setIdx] = useState({ plantoes:[], deletedIds:[] });
  const [atualFull, setAtualFull] = useState(null);
  const [colabs, setColabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewFull, setViewFull] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [confirmEnvio, setConfirmEnvio] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [envioErr, setEnvioErr] = useState(null);
  const adminAuth = authLevel==="admin";

  const turno = turnoAtual();
  const dataP = dataPlantaoAtual();
  const tui = TURNO_UI[turno];

  const saveTimer = useRef(null);
  const pendRef = useRef(null); // {full, idx} pendente de gravação

  useEffect(()=>{
    (async()=>{
      const [i, c] = await Promise.all([loadIndex(project.id), loadColaboradores(project.id)]);
      setIdx(i); setColabs(c);
      const entrada = (i.plantoes||[]).find(p=>p.dataPlantao===dataP && p.turno===turno);
      if(entrada){ setAtualFull(await loadPlantaoFull(entrada)); }
      setLoading(false);
    })();
    return ()=>{
      if(saveTimer.current){ clearTimeout(saveTimer.current); }
      if(pendRef.current){ savePlantaoFull(pendRef.current.full); saveIndex(project.id, pendRef.current.idx); }
    };
  },[project.id]); // eslint-disable-line

  const historico = (idx.plantoes||[]).filter(p=>!(p.dataPlantao===dataP && p.turno===turno))
    .sort((a,b)=>(b.dataPlantao||"").localeCompare(a.dataPlantao||"")||(a.turno==="noturno"?-1:1));

  const ant = slotAnterior(dataP, turno);
  const plantaoAnt = (idx.plantoes||[]).find(p=>p.dataPlantao===ant.dataPlantao && p.turno===ant.turno);
  const pendenciaAnt = (idx.plantoes||[]).length>0 && (!plantaoAnt || !plantaoAnt.enviado);

  // grava plantão completo + índice (entrada leve), com debounce
  const persist = (full, imediato) => {
    const plantoes = (idx.plantoes||[]).some(p=>p.id===full.id)
      ? (idx.plantoes||[]).map(p=>p.id===full.id?entradaLeve(full):p)
      : [...(idx.plantoes||[]), entradaLeve(full)];
    const novoIdx = { ...idx, plantoes };
    setIdx(novoIdx); setAtualFull(full);
    pendRef.current = { full, idx:novoIdx };
    if(saveTimer.current) clearTimeout(saveTimer.current);
    const doSave = async () => {
      pendRef.current = null;
      setSaving(true);
      await savePlantaoFull(full);
      await saveIndex(project.id, novoIdx);
      setSaving(false);
    };
    if(imediato) doSave();
    else saveTimer.current = setTimeout(doSave, 1200);
  };
  const upsertAtual = (mut, imediato=true) => {
    let p = atualFull;
    if(!p){ p = { id:newId(), projectId:project.id, dataPlantao:dataP, turno, lider:"", rondas:[], enviado:false, criadoEm:new Date().toISOString() }; }
    persist(mut({ ...p, rondas:[...(p.rondas||[])] }), imediato);
    setEnvioErr(null);
  };

  const totalFotos = (atualFull?.rondas||[]).reduce((a,r)=>a+((r.fotos||[]).length),0);

  const addRonda = () => {
    const ini = horaAgora();
    upsertAtual(p=>({ ...p, rondas:[...p.rondas, { id:newId(), inicio:ini, fim:fimAuto(ini), externa:true, obs:"", fotos:[] }] }));
  };
  const editRonda = (rid, campo, valor, imediato=false) => {
    upsertAtual(p=>({ ...p, rondas:p.rondas.map(r=>{
      if(r.id!==rid) return r;
      const nr = { ...r, [campo]:valor };
      if(campo==="inicio") nr.fim = fimAuto(valor);
      return nr;
    })}), imediato);
  };
  const delRonda = (rid) => upsertAtual(p=>({ ...p, rondas:p.rondas.filter(r=>r.id!==rid) }));
  const setLider = (nome) => upsertAtual(p=>({ ...p, lider:nome }));

  const addFoto = async (rid, file) => {
    if(!file) return;
    if(totalFotos >= MAX_FOTOS_PLANTAO){ setEnvioErr(`Limite de ${MAX_FOTOS_PLANTAO} fotos por plantão atingido.`); return; }
    const b64 = await comprimirFoto(file);
    if(!b64){ setEnvioErr("Não consegui processar essa foto."); return; }
    upsertAtual(p=>({ ...p, rondas:p.rondas.map(r=>{
      if(r.id!==rid) return r;
      const fotos = [...(r.fotos||[])];
      if(fotos.length>=MAX_FOTOS_RONDA) return r;
      return { ...r, fotos:[...fotos, b64] };
    })}));
  };
  const delFoto = (rid, fi) => upsertAtual(p=>({ ...p, rondas:p.rondas.map(r=>r.id===rid?{...r,fotos:(r.fotos||[]).filter((_,j)=>j!==fi)}:r) }));

  const enviarTurno = () => {
    if(!atualFull || !atualFull.lider){ setEnvioErr("Selecione o responsável pelo turno antes de enviar."); setConfirmEnvio(false); return; }
    const validas = (atualFull.rondas||[]).filter(r=>(r.inicio||"").trim());
    if(validas.length===0){ setEnvioErr("Registre ao menos uma ronda antes de enviar."); setConfirmEnvio(false); return; }
    upsertAtual(p=>({ ...p, enviado:true, enviadoEm:new Date().toISOString() }));
    setConfirmEnvio(false);
  };
  const reabrirAtual = () => upsertAtual(p=>({ ...p, enviado:false, reabertoEm:new Date().toISOString() }));
  const reabrirView = async () => {
    if(!viewFull) return;
    const novo = { ...viewFull, enviado:false, reabertoEm:new Date().toISOString() };
    setViewFull(novo);
    const plantoes = (idx.plantoes||[]).map(p=>p.id===novo.id?{...entradaLeve(novo)}:p);
    const novoIdx = { ...idx, plantoes };
    setIdx(novoIdx);
    setSaving(true);
    if(!viewFull.__embutido) await savePlantaoFull(novo);
    await saveIndex(project.id, viewFull.__embutido ? { ...novoIdx, plantoes:(idx.plantoes||[]).map(p=>p.id===novo.id?{...novo,__embutido:undefined}:p) } : novoIdx);
    setSaving(false);
  };
  const excluirPlantao = async (pid) => {
    const novoIdx = { ...idx, plantoes:(idx.plantoes||[]).filter(p=>p.id!==pid), deletedIds:[...(idx.deletedIds||[]),pid] };
    setIdx(novoIdx);
    setSaving(true);
    await saveIndex(project.id, novoIdx);
    setSaving(false);
    setConfirmDel(false); setViewFull(null); setScreen("home");
  };
  const abrirView = async (entrada) => {
    setConfirmDel(false); setViewLoading(true); setScreen("view");
    if(entrada.rondas){ setViewFull({ ...entrada, __embutido:true }); setViewLoading(false); return; }
    const full = await loadPlantaoFull(entrada);
    setViewFull({ ...full, enviado:entrada.enviado, lider:full.lider||entrada.lider });
    setViewLoading(false);
  };

  if(screen==="pin") return <PinGate project={project} dark={dark} onBack={onBack} onSuccess={(l)=>{grantSession(l,project.id);setAuthLevel(l);setScreen("home");onAuthGranted?.(l);}}/>;

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.txt2,fontSize:13}}>Carregando rondas…</div>
    </div>
  );

  const Header = (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px 10px"}}>
      <button onClick={()=>{ if(screen==="home") onBack(); else { setViewFull(null); setConfirmDel(false); setScreen("home"); } }} style={S.backBtn} aria-label="Voltar">←</button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:800,...S.txt}}>🚶 Ronda Perimetral Diária</div>
        <div style={{fontSize:10,...S.txt2}}>{project.id} · {project.name}</div>
      </div>
      {onToggleTheme && <button onClick={onToggleTheme} style={S.btnSm}>{dark?"☀️":"🌙"}</button>}
    </div>
  );

  // Linha de ronda renderizada INLINE (função chamada, não componente) —
  // preserva a identidade dos inputs e corrige a perda de foco a cada tecla
  const renderRonda = (r, i, travado) => (
    <div key={r.id} style={{...S.card,padding:"10px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:900,...S.txt}}>Ronda {i+1}</div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button disabled={travado} onClick={()=>!travado&&editRonda(r.id,"externa",!r.externa,true)}
            style={{...S.btnSm, color:r.externa?"#22c55e":(dark?"#64748b":"#475569"), borderColor:r.externa?"#22c55e44":undefined, opacity:travado?.6:1}}>
            {r.externa?"✓ Externa":"Externa?"}
          </button>
          {!travado && <button onClick={()=>delRonda(r.id)} style={{...S.btnSm,color:"#ef4444",borderColor:"#ef444433"}}>🗑</button>}
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <div style={{flex:1}}>
          <label style={S.lbl}>Início</label>
          <input type="time" value={r.inicio||""} disabled={travado} onChange={e=>editRonda(r.id,"inicio",e.target.value)} style={S.inp}/>
        </div>
        <div style={{flex:1}}>
          <label style={S.lbl}>Fim (auto +20 min)</label>
          <input type="time" value={r.fim||""} disabled={travado} onChange={e=>editRonda(r.id,"fim",e.target.value)} style={S.inp}/>
        </div>
      </div>
      <div style={{marginTop:8}}>
        <input value={r.obs||""} disabled={travado} onChange={e=>editRonda(r.id,"obs",e.target.value)}
          placeholder="Observação (ex: teste de zonas, intervalo CCO)" style={{...S.inp,fontSize:12}}/>
      </div>
      {/* Fotos da ronda */}
      <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center",flexWrap:"wrap"}}>
        {(r.fotos||[]).map((f,fi)=>(
          <div key={fi} style={{position:"relative"}}>
            <img src={f} alt={`Foto ${fi+1}`} style={{width:64,height:64,objectFit:"cover",borderRadius:8,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,display:"block"}}/>
            {!travado && <button onClick={()=>delFoto(r.id,fi)}
              style={{position:"absolute",top:-6,right:-6,background:"#ef4444",color:"#fff",border:"none",borderRadius:"50%",width:20,height:20,fontSize:11,cursor:"pointer",lineHeight:"20px",padding:0}}>×</button>}
          </div>
        ))}
        {!travado && (r.fotos||[]).length<MAX_FOTOS_RONDA && (
          <label style={{...S.btnSm,padding:"9px 12px",fontSize:12,display:"inline-flex",alignItems:"center",gap:6}}>
            📷 Foto
            <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
              onChange={e=>{ addFoto(r.id, e.target.files?.[0]); e.target.value=""; }}/>
          </label>
        )}
      </div>
    </div>
  );

  // ── TELA: detalhe de plantão do histórico
  if(screen==="view"){
    const p = viewFull;
    const t = p ? (TURNO_UI[p.turno]||TURNO_UI.diurno) : TURNO_UI.diurno;
    return (
      <div style={S.page}><div style={S.wrap}>
        {Header}
        <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
          {viewLoading || !p ? (
            <div style={{...S.card,textAlign:"center",fontSize:12,...S.txt2}}>Carregando plantão…</div>
          ) : (
            <>
              <div style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:800,...S.txt}}>{t.icon} {t.label} · {fmtData(p.dataPlantao)}</div>
                    <div style={{fontSize:11,...S.txt2}}>Responsável: {p.lider||"—"} · {(p.rondas||[]).length} ronda{(p.rondas||[]).length===1?"":"s"}</div>
                  </div>
                  <span style={{fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:6,
                    color:p.enviado?"#22c55e":"#f59e0b", background:p.enviado?"#021a0d":"#1a1000",
                    border:`1px solid ${p.enviado?"#22c55e33":"#f59e0b33"}`}}>{p.enviado?"✅ Enviado":"⏳ Pendente"}</span>
                </div>
              </div>
              {(p.rondas||[]).map((r,i)=>(
                <div key={r.id} style={{...S.card,padding:"10px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <div style={{fontSize:12,fontWeight:800,...S.txt}}>Ronda {i+1}</div>
                    <div style={{fontSize:12,...S.txt2}}>{r.inicio||"—"} – {r.fim||"—"} {r.externa?"· Externa (sim)":""}</div>
                  </div>
                  {r.obs && <div style={{fontSize:11,...S.txt2,marginTop:4}}>{r.obs}</div>}
                  {(r.fotos||[]).length>0 && (
                    <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                      {(r.fotos||[]).map((f,fi)=><img key={fi} src={f} alt={`Foto ${fi+1}`} style={{width:96,height:96,objectFit:"cover",borderRadius:8,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}/>)}
                    </div>
                  )}
                </div>
              ))}
              {adminAuth && p.enviado && <button onClick={reabrirView} style={{...S.btnSec,fontSize:13}}>🔓 Reabrir plantão (gerencial)</button>}
              {adminAuth && !confirmDel && <button onClick={()=>setConfirmDel(true)} style={{...S.btnSec,color:"#ef4444",borderColor:"#ef444433",fontSize:13}}>🗑 Excluir plantão</button>}
              {adminAuth && confirmDel && (
                <div style={{...S.card,border:"1px solid #ef444455"}}>
                  <div style={{fontSize:12,...S.txt,marginBottom:10}}>Excluir definitivamente o plantão {t.label.toLowerCase()} de {fmtData(p.dataPlantao)}?</div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setConfirmDel(false)} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
                    <button onClick={()=>excluirPlantao(p.id)} style={{...S.btn,flex:1,fontSize:13,background:"linear-gradient(135deg,#dc2626,#991b1b)"}}>Excluir</button>
                  </div>
                </div>
              )}
            </>
          )}
          <button onClick={()=>{setViewFull(null);setConfirmDel(false);setScreen("home");}} style={{...S.btnSec,fontSize:13}}>← Voltar</button>
        </div>
      </div></div>
    );
  }

  // ── TELA: home (plantão atual + histórico)
  const travado = !!atualFull?.enviado;
  const nRondas = (atualFull?.rondas||[]).length;
  return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>

        <img src={`/mapas/${project.id}-ronda.jpg`} alt="" style={{width:"100%",borderRadius:12,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,display:"block"}}
          onError={(e)=>{e.currentTarget.style.display="none";}}/>

        {pendenciaAnt && (
          <div style={{...S.card,border:"1px solid #ef444455",background:dark?"#1a0202":"#fef2f2"}}>
            <div style={{fontSize:12,fontWeight:800,color:"#ef4444"}}>⚠️ Plantão anterior sem envio</div>
            <div style={{fontSize:11,...S.txt2,marginTop:2}}>{TURNO_UI[ant.turno].icon} {TURNO_UI[ant.turno].label} de {fmtData(ant.dataPlantao)} {plantaoAnt?"não foi enviado.":"não foi registrado."}</div>
          </div>
        )}

        <div style={{...S.card,border:`1px solid ${tui.cor}44`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:15,fontWeight:900,color:tui.cor}}>{tui.icon} {tui.label} · {fmtData(dataP)}</div>
            {travado
              ? <span style={{fontSize:10,fontWeight:800,color:"#22c55e",background:"#021a0d",border:"1px solid #22c55e33",padding:"3px 9px",borderRadius:6}}>✅ Enviado</span>
              : <span style={{fontSize:10,fontWeight:700,...S.txt2}}>envio até {tui.limite}</span>}
          </div>
          <div style={{marginTop:10}}>
            <label style={S.lbl}>Responsável pelo registro</label>
            {atualFull?.lider ? (
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1,fontSize:14,fontWeight:800,...S.txt}}>{atualFull.lider}</div>
                {!travado && <button onClick={()=>setLider("")} style={S.btnSm}>trocar</button>}
              </div>
            ) : (
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {colabs.map(c=>(
                  <button key={c.nome} onClick={()=>setLider(c.nome)}
                    style={{...S.btnSm,padding:"8px 12px",fontSize:12,color:dark?"#e2e8f0":"#1e293b"}}>
                    {c.nome}<span style={{marginLeft:6,fontSize:9,...S.txt2}}>{c.cargo}</span>
                  </button>
                ))}
                {colabs.length===0 && <div style={{fontSize:11,...S.txt2}}>Nenhum colaborador no cadastro Equipe — cadastre a equipe primeiro.</div>}
              </div>
            )}
          </div>
        </div>

        {(atualFull?.rondas||[]).map((r,i)=>renderRonda(r,i,travado))}

        {!travado && <button onClick={addRonda} style={S.btn}>▶ Registrar ronda (agora)</button>}

        {envioErr && <div role="alert" style={{fontSize:12,color:"#ef4444",textAlign:"center"}}>{envioErr}</div>}
        {!travado && nRondas>0 && !confirmEnvio && (
          <button onClick={()=>setConfirmEnvio(true)} style={{...S.btn,background:"linear-gradient(135deg,#2563eb,#1d4ed8)"}}>📤 Enviar rondas do turno ({nRondas})</button>
        )}
        {!travado && confirmEnvio && (
          <div style={{...S.card,border:"1px solid #2563eb55"}}>
            <div style={{fontSize:12,...S.txt,marginBottom:10}}>Enviar o plantão {tui.label.toLowerCase()} com {nRondas} ronda{nRondas===1?"":"s"}? Depois do envio o plantão fica travado.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConfirmEnvio(false)} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
              <button onClick={enviarTurno} style={{...S.btn,flex:1,fontSize:13,background:"linear-gradient(135deg,#2563eb,#1d4ed8)"}}>Confirmar envio</button>
            </div>
          </div>
        )}
        {travado && adminAuth && <button onClick={reabrirAtual} style={{...S.btnSec,fontSize:13}}>🔓 Reabrir plantão (gerencial)</button>}
        {saving && <div style={{fontSize:10,...S.txt2,textAlign:"center"}}>salvando…</div>}

        {historico.length>0 && <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginTop:4}}>Plantões anteriores ({historico.length})</div>}
        {historico.map(p=>{
          const t = TURNO_UI[p.turno]||TURNO_UI.diurno;
          const nr = p.rondas ? p.rondas.length : (p.nRondas||0);
          return (
            <button key={p.id} onClick={()=>abrirView(p)}
              style={{...S.card,cursor:"pointer",textAlign:"left",width:"100%",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>{t.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,...S.txt}}>{t.label} · {fmtData(p.dataPlantao)}</div>
                <div style={{fontSize:10,...S.txt2}}>{nr} ronda{nr===1?"":"s"} · {p.lider||"—"}</div>
              </div>
              <span style={{fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:6,
                color:p.enviado?"#22c55e":"#ef4444", background:p.enviado?"#021a0d":"#1a0202",
                border:`1px solid ${p.enviado?"#22c55e33":"#ef444433"}`}}>{p.enviado?"✅":"⏳ pendente"}</span>
              <span style={{...S.txt2,fontSize:16}}>›</span>
            </button>
          );
        })}
      </div>
    </div></div>
  );
}
