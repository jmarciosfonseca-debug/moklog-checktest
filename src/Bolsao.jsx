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

// ── Regras do POP — janela de 12h e limiares de status (ajustáveis)
const JANELA_HORAS = 12;       // mesma placa vista de novo só conta como "+1 dia" se passou desse tempo
const DIAS_ATENCAO = 2;        // a partir de quantos dias consecutivos entra em "Atenção"
const DIAS_CRITICO = 4;        // a partir de quantos dias consecutivos entra em "Crítico"
const MAX_SIGHTINGS = 40;      // histórico de avistamentos guardado por placa (evita doc crescer infinito)

const STATUS_CFG = {
  normal:  { label:"Normal",   color:"#22c55e", bg:"#021a0d", border:"#22c55e33" },
  atencao: { label:"Atenção",  color:"#f59e0b", bg:"#1a1000", border:"#f59e0b33" },
  critico: { label:"Crítico",  color:"#ef4444", bg:"#1a0202", border:"#ef444433" },
};

function statusFromDias(dias){
  if(dias>=DIAS_CRITICO) return "critico";
  if(dias>=DIAS_ATENCAO) return "atencao";
  return "normal";
}

function normalizaPlaca(s){
  return (s||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,7);
}

function fmtDateTime(iso){
  if(!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}); } catch { return "—"; }
}

async function loadBolsao(projectId) {
  try {
    const snap = await getDoc(doc(db,"bolsao",projectId));
    if(snap.exists()) {
      const data = snap.data();
      try { localStorage.setItem(`bolsao_${projectId}`, JSON.stringify(data)); } catch(e){}
      return data.placas||{};
    }
  } catch(e){}
  try {
    const local = localStorage.getItem(`bolsao_${projectId}`);
    if(local) return JSON.parse(local).placas||{};
  } catch(e){}
  return {};
}

async function saveBolsao(projectId, placas) {
  const data = { placas, updatedAt: new Date().toISOString() };
  try { await setDoc(doc(db,"bolsao",projectId), data); } catch(e){ console.error(e); }
  try { localStorage.setItem(`bolsao_${projectId}`, JSON.stringify(data)); } catch(e){}
}

function getStyles(dark) {
  return {
    page:    { minHeight:"100vh", background:dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 90px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:480, display:"flex", flexDirection:"column" },
    card:    { background:dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"14px 16px" },
    btn:     { background:"linear-gradient(135deg,#1d4ed8,#1e40af)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnSec:  { background:dark?"#060c18":"#f8fafc", color:dark?"#64748b":"#475569", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
    btnSm:   { background:dark?"#020510":"#f8fafc", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#64748b":"#475569", borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:600 },
    backBtn: { background:"transparent", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#94a3b8":"#64748b", borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 },
    inp:     { width:"100%", background:dark?"#020510":"#ffffff", border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`, borderRadius:7, color:dark?"#e2e8f0":"#1e293b", padding:"10px 12px", fontSize:13, boxSizing:"border-box", outline:"none" },
    lbl:     { display:"block", fontSize:10, color:dark?"#475569":"#64748b", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 },
    txt:     { color:dark?"#f1f5f9":"#0f172a" },
    txt2:    { color:dark?"#475569":"#64748b" },
  };
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.normal;
  return <span style={{fontSize:10,fontWeight:700,color:cfg.color,background:cfg.bg,border:`1px solid ${cfg.border}`,padding:"2px 8px",borderRadius:5}}>{cfg.label}</span>;
}

// ── Teclado próprio — letras maiúsculas + números juntos, pensado para uso com uma mão em campo
function TecladoPlaca({ value, onChange, dark }) {
  const ROWS = [
    ["1","2","3","4","5","6","7","8","9","0"],
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["Z","X","C","V","B","N","M"],
  ];
  const press = (ch) => { if(value.length<7) onChange(normalizaPlaca(value+ch)); };
  const back = () => onChange(value.slice(0,-1));
  const keyBtn = { flex:1, minWidth:0, height:42, borderRadius:8, border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`, background:dark?"#0c1424":"#fff", color:dark?"#f1f5f9":"#1e293b", fontSize:15, fontWeight:700, cursor:"pointer" };
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6,background:dark?"#020510":"#f1f5f9",borderRadius:10,padding:8}}>
      {ROWS.map((row,i)=>(
        <div key={i} style={{display:"flex",gap:5}}>
          {row.map(ch=><button key={ch} onClick={()=>press(ch)} style={keyBtn}>{ch}</button>)}
          {i===0&&<button onClick={back} style={{...keyBtn,flex:1.4,background:"#7c2d2d",color:"#fff",borderColor:"#7c2d2d"}}>⌫</button>}
        </div>
      ))}
      <button onClick={()=>onChange("")} style={{...keyBtn,height:34,flex:"none",background:"transparent",color:dark?"#64748b":"#94a3b8",border:"none",fontSize:11,fontWeight:600}}>Limpar tudo</button>
    </div>
  );
}

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
        <div style={{fontSize:32,marginBottom:8}}>🚧</div>
        <div style={{fontSize:16,fontWeight:800,...S.txt,marginBottom:4}}>Fiscalização de Bolsão</div>
        <div style={{fontSize:12,...S.txt2,marginBottom:20}}>{project.id} · {project.name}</div>
        {!mode ? (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={()=>setMode("lider")} style={{...S.btn,background:"linear-gradient(135deg,#0369a1,#0c4a6e)",fontSize:13}}>👷 Acesso Líder</button>
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
            {err&&<div style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
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
export default function Bolsao({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }) {
  const S = getStyles(dark);
  const [authLevel, setAuthLevel] = useState(sharedAuth||null);
  const [screen, setScreen] = useState(sharedAuth?"list":"pin"); // pin | list | registrar
  const [placas, setPlacas] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aba, setAba] = useState("todos"); // todos | alerta | critico

  // Registro
  const [placaInput, setPlacaInput] = useState("");
  const [registradoPor, setRegistradoPor] = useState(()=>{ try{return localStorage.getItem("bolsao_ultimo_nome")||"";}catch{return"";} });
  const [feedback, setFeedback] = useState(null); // {placa,status,dias,novoDia}

  useEffect(()=>{ loadBolsao(project.id).then(p=>{ setPlacas(p||{}); setLoading(false); }); },[project.id]);

  const listaPlacas = Object.values(placas).sort((a,b)=>b.diasConsecutivos-a.diasConsecutivos);
  const listaFiltrada = listaPlacas.filter(p=>{
    if(aba==="alerta") return p.status==="atencao"||p.status==="critico";
    if(aba==="critico") return p.status==="critico";
    return true;
  });
  const sugestoes = placaInput.length>=3
    ? listaPlacas.filter(p=>p.placa.startsWith(placaInput) && p.placa!==placaInput && (p.status==="atencao"||p.status==="critico")).slice(0,5)
    : [];

  const registrar = async () => {
    const placa = normalizaPlaca(placaInput);
    if(placa.length<6){ alert("Placa incompleta — confira os caracteres."); return; }
    if(!registradoPor.trim()){ alert("Informe quem está registrando."); return; }
    try{ localStorage.setItem("bolsao_ultimo_nome",registradoPor.trim()); }catch(e){}

    setSaving(true);
    const now = new Date();
    const nowIso = now.toISOString();
    const existente = placas[placa];
    let novoDia = false;
    let entry;

    if(!existente){
      entry = { placa, primeiraVista:nowIso, ultimaVista:nowIso, diasConsecutivos:1, status:"normal",
        sightings:[{ts:nowIso,registradoPor:registradoPor.trim()}] };
      novoDia = true;
    } else {
      const horasDesde = (now.getTime()-new Date(existente.ultimaVista).getTime())/3600000;
      const sightings = [...(existente.sightings||[]), {ts:nowIso,registradoPor:registradoPor.trim()}].slice(-MAX_SIGHTINGS);
      if(horasDesde>=JANELA_HORAS){
        const dias = existente.diasConsecutivos+1;
        entry = { ...existente, ultimaVista:nowIso, diasConsecutivos:dias, status:statusFromDias(dias), sightings };
        novoDia = true;
      } else {
        entry = { ...existente, ultimaVista:nowIso, sightings };
      }
    }

    const next = {...placas, [placa]:entry};
    setPlacas(next);
    await saveBolsao(project.id, next);
    setSaving(false);
    setFeedback({placa, status:entry.status, dias:entry.diasConsecutivos, novoDia});
    setPlacaInput("");
  };

  if(screen==="pin") return <PinGate project={project} dark={dark} onBack={onBack} onSuccess={(l)=>{setAuthLevel(l);setScreen("list");onAuthGranted?.(l);}}/>;

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:30,marginBottom:10}}>🚧</div><div style={{fontSize:13,...S.txt2}}>Carregando...</div></div>
    </div>
  );

  // ── Tela de registro (foco em uso de campo, uma mão)
  if(screen==="registrar") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",...{borderBottom:`1px solid ${dark?"#0a0f1e":"#e2e8f0"}`}}}>
          <button onClick={()=>{setScreen("list");setFeedback(null);}} style={S.backBtn}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,...S.txt}}>Registrar Placa</div>
            <div style={{fontSize:11,...S.txt2}}>{project.id} · {project.name}</div>
          </div>
        </div>

        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:12}}>
          {feedback && (
            <div style={{...S.card,textAlign:"center",border:`2px solid ${STATUS_CFG[feedback.status].border}`,background:STATUS_CFG[feedback.status].bg}}>
              <div style={{fontSize:11,...S.txt2,marginBottom:4}}>{feedback.novoDia?"✅ Registrado — novo dia computado":"✅ Registrado — dentro da janela de 12h (mesmo dia)"}</div>
              <div style={{fontSize:20,fontWeight:900,letterSpacing:2,...S.txt}}>{feedback.placa}</div>
              <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:6,alignItems:"center"}}>
                <StatusBadge status={feedback.status}/>
                <span style={{fontSize:12,fontWeight:700,color:STATUS_CFG[feedback.status].color}}>{feedback.dias}d consecutivo{feedback.dias!==1?"s":""}</span>
              </div>
            </div>
          )}

          <div style={S.card}>
            <label style={S.lbl}>Placa</label>
            <input value={placaInput} readOnly placeholder="Toque no teclado abaixo"
              style={{...S.inp,fontSize:24,fontWeight:900,letterSpacing:4,textAlign:"center",marginBottom:10}}/>

            {sugestoes.length>0 && (
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,...S.txt2,fontWeight:700,marginBottom:6}}>⚠️ Placas frequentes (Atenção/Crítico) que começam assim:</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {sugestoes.map(s=>(
                    <button key={s.placa} onClick={()=>setPlacaInput(s.placa)}
                      style={{...S.btnSm,color:STATUS_CFG[s.status].color,borderColor:STATUS_CFG[s.status].border,fontWeight:800,fontSize:12,padding:"7px 10px"}}>
                      {s.placa} · {s.diasConsecutivos}d
                    </button>
                  ))}
                </div>
              </div>
            )}

            <TecladoPlaca value={placaInput} onChange={setPlacaInput} dark={dark}/>
          </div>

          <div style={S.card}>
            <label style={S.lbl}>Quem está registrando</label>
            <input value={registradoPor} onChange={e=>setRegistradoPor(e.target.value)} placeholder="Nome do vigilante..." style={S.inp}/>
          </div>

          <button onClick={registrar} disabled={saving||placaInput.length<6} style={{...S.btn,opacity:(saving||placaInput.length<6)?0.5:1,fontSize:15,padding:"15px"}}>
            {saving?"Salvando...":`✓ Registrar ${placaInput||"placa"}`}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Lista principal
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderBottom:`1px solid ${dark?"#0a0f1e":"#e2e8f0"}`}}>
          <button onClick={onBack} style={S.backBtn}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,...S.txt}}>🚧 Fiscalização de Bolsão</div>
            <div style={{fontSize:11,...S.txt2}}>{project.id} · {project.name}</div>
          </div>
        </div>

        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
          <button onClick={()=>{setScreen("registrar");setFeedback(null);}} style={{...S.btn,fontSize:15,padding:"15px"}}>📋 Registrar Placa</button>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
            {[{k:"todos",l:"Todos",n:listaPlacas.length},{k:"alerta",l:"Em Alerta",n:listaPlacas.filter(p=>p.status==="atencao"||p.status==="critico").length},{k:"critico",l:"Críticos",n:listaPlacas.filter(p=>p.status==="critico").length}].map(t=>(
              <button key={t.k} onClick={()=>setAba(t.k)}
                style={{...S.btnSm,padding:"9px 4px",fontSize:11,fontWeight:700,...(aba===t.k?{background:"#1d4ed822",borderColor:"#1d4ed866",color:"#60a5fa"}:{})}}>
                {t.l} ({t.n})
              </button>
            ))}
          </div>

          {listaFiltrada.length===0 && (
            <div style={{textAlign:"center",padding:"30px 0"}}>
              <div style={{fontSize:28,marginBottom:8}}>🚧</div>
              <div style={{fontSize:12,...S.txt2}}>{aba==="todos"?"Nenhuma placa registrada ainda":"Nenhuma placa nessa categoria"}</div>
            </div>
          )}

          {listaFiltrada.map(p=>(
            <div key={p.placa} style={{...S.card,border:`1px solid ${STATUS_CFG[p.status].border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:17,fontWeight:900,letterSpacing:1.5,...S.txt}}>{p.placa}</span>
                <StatusBadge status={p.status}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,...S.txt2}}>
                <span>{p.diasConsecutivos} dia{p.diasConsecutivos!==1?"s":""} consecutivo{p.diasConsecutivos!==1?"s":""}</span>
                <span>Última: {fmtDateTime(p.ultimaVista)}</span>
              </div>
              <div style={{fontSize:10,...S.txt2,marginTop:3}}>{(p.sightings||[]).length} avistamento(s) registrado(s)</div>
            </div>
          ))}

          <div style={{fontSize:10,...S.txt2,textAlign:"center",marginTop:6,lineHeight:1.5}}>
            Regra do POP: mesma placa avistada de novo após {JANELA_HORAS}h conta +1 dia. Atenção a partir de {DIAS_ATENCAO}d · Crítico a partir de {DIAS_CRITICO}d.
          </div>
        </div>
      </div>
    </div>
  );
}
