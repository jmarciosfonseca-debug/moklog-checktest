// ─────────────────────────────────────────────────────────────
// RondaDiaria.jsx — Ronda Perimetral Diária (todos os projetos exceto P505)
// • Turno automático pelo relógio: 06:00–17:59 Diurno · 18:00–05:59 Noturno
//   (madrugada 00:00–05:59 pertence ao plantão NOTURNO do dia anterior)
// • Líder puxado do cadastro Equipe (equipes/{projectId}), filtrado por
//   cargo conforme o projeto + turno atual (Folguista/Perista nos dois)
// • Rondas livres: início na hora do toque (editável); fim automático
//   = início + 20 min, sem passar da hora cheia (13:45 → 13:59); editável
// • Envio obrigatório no fechamento do turno — trava o plantão
// • Espelha o formato atual dos registros: Ronda N, início/fim,
//   Externa (sim/não) e observação livre (testes de zona, intervalo CCO…)
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

// ── Filtro de cargo dos responsáveis pela ronda, por projeto
// (cada entrada: lista de tokens que o cargo precisa conter, sem acento)
const CARGOS_RONDA = {
  P607:  [["vigilante","ronda"],["vigilante","apoio"]],
  P606:  [["vigilante","lider"]],
  P311A: [["vigilante","lider"]],
  P311B: [["vigilante","lider"]],
  P601:  [["vspp","lider"]],
  P602:  [["vspp","lider"]],
  P604:  [["vspp","lider"]],
  P605:  [["vspp","lider"]],
  P260A: [["vspp","lider"]],
  P260B: [["vspp","lider"]],
  P260C: [["vspp","lider"]],
};

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
// Slot anterior ao atual (para a pendência de envio)
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

// ── Firestore: doc único por projeto + fallback localStorage + tombstone
async function loadRondas(projectId){
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
async function saveRondas(projectId, data){
  const payload = { ...data, updatedAt:new Date().toISOString() };
  try { await setDoc(doc(db,"rondas",projectId), payload); } catch(e){ console.error("Rondas save:", e); }
  try { localStorage.setItem(`rondas_${projectId}`, JSON.stringify(payload)); } catch(e){}
}
async function loadLideres(projectId){
  // Puxa do cadastro Equipe, filtrando cargo do projeto + ativos
  let equipe = null;
  try {
    const snap = await getDoc(doc(db,"equipes",projectId));
    if(snap.exists()) equipe = snap.data();
  } catch(e){}
  if(!equipe){
    try { const l = localStorage.getItem(`equipe_${projectId}`); if(l) equipe = JSON.parse(l); } catch(e){}
  }
  const colabs = (equipe?.colaboradores||[]).filter(c=>(c.status||"ativo")==="ativo" && (c.nome||"").trim());
  const regras = CARGOS_RONDA[projectId] || [["lider"]];
  const bate = (c)=>{
    const cg = norm(c.cargo);
    if(cg.includes("folg")) return true; // folguista sempre entra
    return regras.some(tokens=>tokens.every(t=>cg.includes(t)));
  };
  let lista = colabs.filter(bate);
  if(lista.length===0) lista = colabs; // fallback: cadastro sem os cargos esperados
  return lista.map(c=>({ nome:c.nome, cargo:c.cargo||"", turno:c.turno||"" }));
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
  const [data, setData] = useState({ plantoes:[], deletedIds:[] });
  const [lideres, setLideres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewPlantao, setViewPlantao] = useState(null);
  const [confirmEnvio, setConfirmEnvio] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [envioErr, setEnvioErr] = useState(null);
  const adminAuth = authLevel==="admin";

  const saveTimer = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(()=>{
    Promise.all([loadRondas(project.id), loadLideres(project.id)]).then(([d,l])=>{
      setData(d); setLideres(l); setLoading(false);
    });
    return ()=>{ if(saveTimer.current){ clearTimeout(saveTimer.current); saveRondas(project.id, dataRef.current); } };
  },[project.id]);

  const turno = turnoAtual();
  const dataP = dataPlantaoAtual();
  const tui = TURNO_UI[turno];

  const atual = (data.plantoes||[]).find(p=>p.dataPlantao===dataP && p.turno===turno) || null;
  const historico = [...(data.plantoes||[])].filter(p=>p!==atual)
    .sort((a,b)=>(b.dataPlantao||"").localeCompare(a.dataPlantao||"")||(a.turno==="noturno"?-1:1));

  // Pendência do plantão anterior (só depois que o módulo já tem uso)
  const ant = slotAnterior(dataP, turno);
  const plantaoAnt = (data.plantoes||[]).find(p=>p.dataPlantao===ant.dataPlantao && p.turno===ant.turno);
  const pendenciaAnt = (data.plantoes||[]).length>0 && (!plantaoAnt || !plantaoAnt.enviado);

  // Líderes do turno atual (folguista/perista aparecem sempre)
  const lideresTurno = lideres.filter(l=>{
    const t = norm(l.turno);
    if(!t || t.includes("folg") || t.includes("peri")) return true;
    return t === turno;
  });
  const listaLideres = lideresTurno.length>0 ? lideresTurno : lideres;

  const persist = (next, imediato) => {
    setData(next);
    if(saveTimer.current) clearTimeout(saveTimer.current);
    if(imediato){ setSaving(true); saveRondas(project.id,next).then(()=>setSaving(false)); }
    else saveTimer.current = setTimeout(()=>saveRondas(project.id,next), 1200);
  };
  const upsertAtual = (mut, imediato=true) => {
    let plantoes = [...(data.plantoes||[])];
    let p = plantoes.find(x=>x.dataPlantao===dataP && x.turno===turno);
    if(!p){ p = { id:newId(), dataPlantao:dataP, turno, lider:"", rondas:[], enviado:false, criadoEm:new Date().toISOString() }; plantoes.push(p); }
    const novo = mut({...p, rondas:[...(p.rondas||[])]});
    plantoes = plantoes.map(x=>x.id===p.id?novo:x);
    persist({ ...data, plantoes }, imediato);
    setEnvioErr(null);
  };

  const addRonda = () => {
    const ini = horaAgora();
    upsertAtual(p=>({ ...p, rondas:[...p.rondas, { id:newId(), inicio:ini, fim:fimAuto(ini), externa:true, obs:"" }] }));
  };
  const editRonda = (rid, campo, valor) => {
    upsertAtual(p=>({ ...p, rondas:p.rondas.map(r=>{
      if(r.id!==rid) return r;
      const nr = { ...r, [campo]:valor };
      if(campo==="inicio") nr.fim = fimAuto(valor); // recalcula; o campo fim continua editável depois
      return nr;
    })}), false);
  };
  const delRonda = (rid) => upsertAtual(p=>({ ...p, rondas:p.rondas.filter(r=>r.id!==rid) }));
  const setLider = (nome) => upsertAtual(p=>({ ...p, lider:nome }));

  const enviarTurno = () => {
    if(!atual || !atual.lider){ setEnvioErr("Selecione o líder do turno antes de enviar."); setConfirmEnvio(false); return; }
    const validas = (atual.rondas||[]).filter(r=>(r.inicio||"").trim());
    if(validas.length===0){ setEnvioErr("Registre ao menos uma ronda antes de enviar."); setConfirmEnvio(false); return; }
    upsertAtual(p=>({ ...p, enviado:true, enviadoEm:new Date().toISOString() }));
    setConfirmEnvio(false);
  };
  const reabrir = (pid) => {
    const plantoes = (data.plantoes||[]).map(p=>p.id===pid?{...p,enviado:false,reabertoEm:new Date().toISOString()}:p);
    persist({ ...data, plantoes }, true);
  };
  const excluirPlantao = (pid) => {
    persist({ ...data, plantoes:(data.plantoes||[]).filter(p=>p.id!==pid), deletedIds:[...(data.deletedIds||[]),pid] }, true);
    setConfirmDel(false); setViewPlantao(null); setScreen("home");
  };

  if(screen==="pin") return <PinGate project={project} dark={dark} onBack={onBack} onSuccess={(l)=>{grantSession(l,project.id);setAuthLevel(l);setScreen("home");onAuthGranted?.(l);}}/>;

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.txt2,fontSize:13}}>Carregando rondas…</div>
    </div>
  );

  const Header = (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px 10px"}}>
      <button onClick={()=>{ if(screen==="home") onBack(); else { setViewPlantao(null); setConfirmDel(false); setScreen("home"); } }} style={S.backBtn} aria-label="Voltar">←</button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:800,...S.txt}}>🚶 Ronda Perimetral Diária</div>
        <div style={{fontSize:10,...S.txt2}}>{project.id} · {project.name}</div>
      </div>
      {onToggleTheme && <button onClick={onToggleTheme} style={S.btnSm}>{dark?"☀️":"🌙"}</button>}
    </div>
  );

  const RondaLinha = ({ r, i, travado }) => (
    <div style={{...S.card,padding:"10px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:900,...S.txt}}>Ronda {i+1}</div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button disabled={travado} onClick={()=>!travado&&editRonda(r.id,"externa",!r.externa)}
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
    </div>
  );

  // ── TELA: detalhe de plantão do histórico
  if(screen==="view" && viewPlantao){
    const p = viewPlantao;
    const t = TURNO_UI[p.turno]||TURNO_UI.diurno;
    return (
      <div style={S.page}><div style={S.wrap}>
        {Header}
        <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={S.card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:14,fontWeight:800,...S.txt}}>{t.icon} {t.label} · {fmtData(p.dataPlantao)}</div>
                <div style={{fontSize:11,...S.txt2}}>Líder: {p.lider||"—"} · {(p.rondas||[]).length} ronda{(p.rondas||[]).length===1?"":"s"}</div>
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
            </div>
          ))}
          {adminAuth && p.enviado && <button onClick={()=>{reabrir(p.id); setViewPlantao({...p,enviado:false});}} style={{...S.btnSec,fontSize:13}}>🔓 Reabrir plantão (gerencial)</button>}
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
          <button onClick={()=>{setViewPlantao(null);setConfirmDel(false);setScreen("home");}} style={{...S.btnSec,fontSize:13}}>← Voltar</button>
        </div>
      </div></div>
    );
  }

  // ── TELA: home (plantão atual + histórico)
  const travado = !!atual?.enviado;
  const nRondas = (atual?.rondas||[]).length;
  return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>

        {/* Foto aérea do projeto (sem zonas) */}
        <img src={`/mapas/${project.id}-ronda.jpg`} alt="" style={{width:"100%",borderRadius:12,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,display:"block"}}
          onError={(e)=>{e.currentTarget.style.display="none";}}/>

        {/* Pendência do plantão anterior */}
        {pendenciaAnt && (
          <div style={{...S.card,border:"1px solid #ef444455",background:dark?"#1a0202":"#fef2f2"}}>
            <div style={{fontSize:12,fontWeight:800,color:"#ef4444"}}>⚠️ Plantão anterior sem envio</div>
            <div style={{fontSize:11,...S.txt2,marginTop:2}}>{TURNO_UI[ant.turno].icon} {TURNO_UI[ant.turno].label} de {fmtData(ant.dataPlantao)} {plantaoAnt?"não foi enviado.":"não foi registrado."}</div>
          </div>
        )}

        {/* Plantão atual */}
        <div style={{...S.card,border:`1px solid ${tui.cor}44`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:15,fontWeight:900,color:tui.cor}}>{tui.icon} {tui.label} · {fmtData(dataP)}</div>
            {travado
              ? <span style={{fontSize:10,fontWeight:800,color:"#22c55e",background:"#021a0d",border:"1px solid #22c55e33",padding:"3px 9px",borderRadius:6}}>✅ Enviado</span>
              : <span style={{fontSize:10,fontWeight:700,...S.txt2}}>envio até {tui.limite}</span>}
          </div>
          {/* Líder do turno */}
          <div style={{marginTop:10}}>
            <label style={S.lbl}>Líder responsável pelo registro</label>
            {atual?.lider ? (
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1,fontSize:14,fontWeight:800,...S.txt}}>{atual.lider}</div>
                {!travado && <button onClick={()=>setLider("")} style={S.btnSm}>trocar</button>}
              </div>
            ) : (
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {listaLideres.map(l=>(
                  <button key={l.nome} onClick={()=>setLider(l.nome)}
                    style={{...S.btnSm,padding:"8px 12px",fontSize:12,color:dark?"#e2e8f0":"#1e293b"}}>
                    {l.nome}<span style={{marginLeft:6,fontSize:9,...S.txt2}}>{l.cargo}</span>
                  </button>
                ))}
                {listaLideres.length===0 && <div style={{fontSize:11,...S.txt2}}>Nenhum colaborador no cadastro Equipe — cadastre a equipe primeiro.</div>}
              </div>
            )}
          </div>
        </div>

        {/* Rondas do plantão */}
        {(atual?.rondas||[]).map((r,i)=><RondaLinha key={r.id} r={r} i={i} travado={travado}/>)}

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
        {travado && adminAuth && <button onClick={()=>reabrir(atual.id)} style={{...S.btnSec,fontSize:13}}>🔓 Reabrir plantão (gerencial)</button>}
        {saving && <div style={{fontSize:10,...S.txt2,textAlign:"center"}}>salvando…</div>}

        {/* Histórico */}
        {historico.length>0 && <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginTop:4}}>Plantões anteriores ({historico.length})</div>}
        {historico.map(p=>{
          const t = TURNO_UI[p.turno]||TURNO_UI.diurno;
          return (
            <button key={p.id} onClick={()=>{setViewPlantao(p);setConfirmDel(false);setScreen("view");}}
              style={{...S.card,cursor:"pointer",textAlign:"left",width:"100%",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>{t.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,...S.txt}}>{t.label} · {fmtData(p.dataPlantao)}</div>
                <div style={{fontSize:10,...S.txt2}}>{(p.rondas||[]).length} ronda{(p.rondas||[]).length===1?"":"s"} · {p.lider||"—"}</div>
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
