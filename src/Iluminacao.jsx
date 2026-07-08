// ─────────────────────────────────────────────────────────────
// Iluminacao.jsx — Teste de Iluminação v3
// • Tela da equipe LIMPA: mapa + lista de quadrantes (pontos, inoperantes,
//   % operante). Nada de percentuais/grade na frente da operação.
// • Quadrantes de ÁREA LIVRE: cada quadrante pode ter sua própria área
//   {x,y,w,h} em % do mapa — cobre os desenhos irregulares (P601, P505,
//   P311B, P604). A grade continua existindo para os simétricos e agora
//   também gera as áreas automaticamente. Compatível com configs antigas.
// • Selecionou A1 (no mapa ou na lista) → o A1 PULSA destacado no mapa.
// • Permissões: equipe edita totais (levantamento) e registra testes;
//   gerencial exclui quadrante/teste e pode LIMPAR TUDO do projeto.
// • Registros v1 (campo "acesas") continuam válidos.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
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

const PCT_OK = 95;
const PCT_ATENCAO = 80;

const STATUS_CFG = {
  normal:  { label:"Normal",  color:"#22c55e", bg:"#021a0d", border:"#22c55e33" },
  atencao: { label:"Atenção", color:"#f59e0b", bg:"#1a1000", border:"#f59e0b33" },
  critico: { label:"Crítico", color:"#ef4444", bg:"#1a0202", border:"#ef444433" },
};
function statusFromPct(pct){
  if(pct>=PCT_OK) return "normal";
  if(pct>=PCT_ATENCAO) return "atencao";
  return "critico";
}

function fmtDate(d){
  if(!d) return "—";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d||"—"; }
}
function todayStrLocal(){ return new Date().toLocaleDateString("sv-SE"); }
function newId(){ try { return crypto.randomUUID(); } catch { return "id-"+Date.now()+"-"+Math.random().toString(36).slice(2,8); } }

function inicioSemana(){
  const d = new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function testeNaSemana(history){
  const ini = inicioSemana();
  return (history||[]).some(t=>{ try { return new Date(t.date+"T12:00:00") >= ini; } catch { return false; } });
}

// ── Operantes de um quadrante de teste (compatível com v1 "acesas")
function opsDe(q){
  const total = Number(q?.total)||0;
  if(q && q.inoperantes!=null) return Math.max(0, total - (Number(q.inoperantes)||0));
  if(q && q.acesas!=null) return Number(q.acesas)||0;
  return total;
}
export function calcTeste(t){
  const quads = t?.quads||[];
  const tot  = quads.reduce((a,q)=>a+(Number(q.total)||0),0);
  const ops  = quads.reduce((a,q)=>a+opsDe(q),0);
  const inop = Math.max(0, tot-ops);
  const pct  = tot ? Math.round((ops/tot)*1000)/10 : 0;
  return { tot, ops, inop, pct };
}
function pctQuad(q){
  const total = Number(q?.total)||0;
  return total ? Math.round((opsDe(q)/total)*1000)/10 : 0;
}

// ── Grade → células; usada quando os quadrantes não têm área própria
export function gradeCells(mapa){
  const norm = (arr)=>[...new Set((arr||[]).map(Number).filter(n=>n>0&&n<100))].sort((a,b)=>a-b);
  const cols = [0,...norm(mapa?.cols),100];
  const rows = [0,...norm(mapa?.rows),100];
  const cells = [];
  for(let r=0;r<rows.length-1;r++){
    for(let c=0;c<cols.length-1;c++){
      cells.push({
        nome: String.fromCharCode(65+r)+(c+1),
        left: cols[c], top: rows[r],
        w: cols[c+1]-cols[c], h: rows[r+1]-rows[r],
      });
    }
  }
  return cells;
}
function parsePcts(str){
  return String(str||"").split(/[,;\s]+/).map(s=>Number(s)).filter(n=>!isNaN(n)&&n>0&&n<100);
}
// Células a desenhar: áreas próprias dos quadrantes (se houver) ou grade
export function cellsDoMapa(mapa, quadrantes){
  const comArea = (quadrantes||[]).filter(q=>q.area && Number(q.area.w)>0 && Number(q.area.h)>0);
  if(comArea.length>0){
    return comArea.map(q=>({ nome:q.nome, left:Number(q.area.x)||0, top:Number(q.area.y)||0, w:Number(q.area.w), h:Number(q.area.h) }));
  }
  return gradeCells(mapa);
}

// ── Firestore: doc único por projeto, tombstone + fallback localStorage
export async function loadIluminacao(projectId){
  let data = null;
  try {
    const snap = await getDoc(doc(db,"iluminacao",projectId));
    if(snap.exists()){
      data = snap.data();
      try { localStorage.setItem(`iluminacao_${projectId}`, JSON.stringify(data)); } catch(e){}
    }
  } catch(e){}
  if(!data){
    try { const l = localStorage.getItem(`iluminacao_${projectId}`); if(l) data = JSON.parse(l); } catch(e){}
  }
  data = data || {};
  const del = new Set(data.deletedIds||[]);
  return {
    mapa: data.mapa||null,
    quadrantes: data.quadrantes||[],
    history: (data.history||[]).filter(t=>!del.has(t.id)),
    deletedIds: data.deletedIds||[],
  };
}

async function saveIluminacao(projectId, data){
  const payload = { ...data, updatedAt: new Date().toISOString() };
  try { await setDoc(doc(db,"iluminacao",projectId), payload); } catch(e){ console.error("Iluminacao save:", e); }
  try { localStorage.setItem(`iluminacao_${projectId}`, JSON.stringify(payload)); } catch(e){}
}

function getStyles(dark) {
  return {
    page:    { minHeight:"100vh", background:dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 90px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:480, display:"flex", flexDirection:"column" },
    card:    { background:dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"14px 16px" },
    btn:     { background:"linear-gradient(135deg,#ca8a04,#a16207)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
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

function BarraPct({ pct, dark }) {
  const cfg = STATUS_CFG[statusFromPct(pct)];
  return (
    <div style={{height:8,borderRadius:4,background:dark?"#0f172a":"#e2e8f0",overflow:"hidden"}}>
      <div style={{height:"100%",width:`${Math.min(100,Math.max(0,pct))}%`,background:cfg.color,borderRadius:4,transition:"width .35s ease"}}/>
    </div>
  );
}

// ── Mapa interativo: quadrantes de área livre (ou grade), com PULSO no selecionado
function MapaQuadrantes({ mapa, quadrantes, selNome, onSelect, ultimoPorNome, dark }) {
  const cells = cellsDoMapa(mapa, quadrantes);
  if(!mapa?.url || cells.length===0) return null;
  return (
    <div style={{position:"relative", borderRadius:12, overflow:"hidden", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, lineHeight:0}}>
      <style>{`@keyframes mkPulse{0%,100%{box-shadow:0 0 0 0 rgba(56,189,248,.65);}50%{box-shadow:0 0 0 7px rgba(56,189,248,0);}}`}</style>
      <img src={mapa.url} alt="Mapa do projeto" style={{width:"100%",display:"block"}}
        onError={(e)=>{e.currentTarget.style.minHeight="180px";e.currentTarget.alt="Mapa não encontrado em "+mapa.url;}}/>
      {cells.map(cell=>{
        const q = ultimoPorNome[cell.nome];
        const pct = q ? pctQuad(q) : null;
        const cor = pct===null ? "#94a3b8" : STATUS_CFG[statusFromPct(pct)].color;
        const sel = selNome===cell.nome;
        return (
          <div key={cell.nome} role="button" aria-label={`Quadrante ${cell.nome}`}
            onClick={()=>onSelect(sel?null:cell.nome)}
            style={{position:"absolute", left:`${cell.left}%`, top:`${cell.top}%`, width:`${cell.w}%`, height:`${cell.h}%`,
              boxSizing:"border-box", cursor:"pointer", borderRadius:sel?6:0,
              border: sel? "3px solid #38bdf8" : `1.5px solid ${cor}99`,
              background: sel? "#38bdf82e" : `${cor}${pct===null?"10":"1f"}`,
              animation: sel? "mkPulse 1.1s ease-in-out infinite" : "none",
              zIndex: sel?2:1,
              transition:"background .2s ease, border .2s ease"}}>
            <span style={{position:"absolute", top:4, left:6, background:"rgba(2,6,16,.75)", color: sel?"#38bdf8":cor,
              fontSize:11, fontWeight:900, padding:"2px 7px", borderRadius:5, lineHeight:"14px", letterSpacing:.5}}>
              {cell.nome}{pct!==null && <span style={{marginLeft:5,fontWeight:700}}>{pct}%</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
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
        <div style={{fontSize:32,marginBottom:8}}>💡</div>
        <div style={{fontSize:16,fontWeight:800,...S.txt,marginBottom:4}}>Teste de Iluminação</div>
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
export default function Iluminacao({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }) {
  const S = getStyles(dark);
  const [authLevel, setAuthLevel] = useState(()=>sharedAuth||getAccess(project?.id)||null);
  const [screen, setScreen] = useState(()=>(sharedAuth||getAccess(project?.id))?"list":"pin"); // pin | list | form | config | survey | view
  const [data, setData] = useState({ mapa:null, quadrantes:[], history:[], deletedIds:[] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const adminAuth = authLevel==="admin";

  const [selNome, setSelNome] = useState(null);

  // Form de novo teste (inoperantes por quadrante)
  const [formDate, setFormDate] = useState(todayStrLocal());
  const [formResp, setFormResp] = useState(()=>{ try{return localStorage.getItem("iluminacao_ultimo_nome")||"";}catch{return"";} });
  const [formCounts, setFormCounts] = useState({});
  const [formObs, setFormObs] = useState("");
  const [formErr, setFormErr] = useState(null);

  // Config (gerencial)
  const [cfgUrl, setCfgUrl] = useState("");
  const [cfgCols, setCfgCols] = useState("");
  const [cfgRows, setCfgRows] = useState("");
  const [cfgQuads, setCfgQuads] = useState([]);
  const [cfgErr, setCfgErr] = useState(null);
  const [confirmLimpar, setConfirmLimpar] = useState(0); // 0 | 1 | 2 (dupla confirmação)

  // Levantamento (equipe/admin): totais por quadrante — EDITÁVEL, sem excluir
  const [survTotais, setSurvTotais] = useState({});

  const [viewTest, setViewTest] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(()=>{ loadIluminacao(project.id).then(d=>{ setData(d); setLoading(false); }); },[project.id]);

  const history = [...(data.history||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.criadoEm||"").localeCompare(a.criadoEm||""));
  const ultimo = history[0]||null;
  const semanaOk = testeNaSemana(history);
  const totalPontos = (data.quadrantes||[]).reduce((a,q)=>a+(Number(q.total)||0),0);
  const semLevantamento = totalPontos===0 && (data.quadrantes||[]).length>0;

  const ultimoPorNome = {};
  (ultimo?.quads||[]).forEach(q=>{ if(q.nome) ultimoPorNome[q.nome]=q; });

  const abrirForm = () => {
    const counts = {};
    (data.quadrantes||[]).forEach(q=>{ counts[q.id]="0"; });
    setFormCounts(counts); setFormDate(todayStrLocal()); setFormObs(""); setFormErr(null);
    setScreen("form");
  };

  const setCount = (qid, val, max) => {
    let v = String(val).replace(/[^0-9]/g,"");
    if(v!=="" && Number(v)>max) v = String(max);
    setFormCounts(prev=>({...prev,[qid]:v}));
    setFormErr(null);
  };
  const stepCount = (qid, delta, max) => {
    setFormCounts(prev=>{
      const cur = prev[qid]==="" ? 0 : Number(prev[qid]);
      const next = Math.max(0, Math.min(max, cur+delta));
      return {...prev,[qid]:String(next)};
    });
    setFormErr(null);
  };

  const salvarTeste = async () => {
    if(!formResp.trim()){ setFormErr("Informe o responsável pelo teste."); return; }
    const pendente = (data.quadrantes||[]).find(q=>formCounts[q.id]==="" || formCounts[q.id]==null);
    if(pendente){ setFormErr(`Preencha os inoperantes do quadrante "${pendente.nome}".`); return; }
    const quads = (data.quadrantes||[]).map(q=>({ id:q.id, nome:q.nome, total:Number(q.total)||0, inoperantes:Number(formCounts[q.id])||0 }));
    const teste = { id:newId(), date:formDate, responsavel:formResp.trim(), quads, obs:formObs.trim(), criadoEm:new Date().toISOString() };
    const next = { ...data, history:[...(data.history||[]), teste] };
    setSaving(true);
    setData(next);
    try { localStorage.setItem("iluminacao_ultimo_nome", formResp.trim()); } catch(e){}
    await saveIluminacao(project.id, next);
    setSaving(false);
    setScreen("list");
  };

  // ── Config (gerencial)
  const abrirConfig = () => {
    setCfgUrl(data.mapa?.url || `/mapas/${project.id}.jpg`);
    setCfgCols((data.mapa?.cols||[]).join(", "));
    setCfgRows((data.mapa?.rows||[]).join(", "));
    setCfgQuads((data.quadrantes||[]).map(q=>({
      ...q, total:String(q.total??""),
      ax:String(q.area?.x??""), ay:String(q.area?.y??""), aw:String(q.area?.w??""), ah:String(q.area?.h??""),
    })));
    setCfgErr(null); setConfirmLimpar(0);
    setScreen("config");
  };
  // Grade → cria/atualiza quadrantes E preenche a área de cada um pela célula
  const gerarDaGrade = () => {
    const cells = gradeCells({ cols:parsePcts(cfgCols), rows:parsePcts(cfgRows) });
    if(cells.length<=1){ setCfgErr("Defina ao menos uma divisória (ex: colunas 30, 68 · linhas 50)."); return; }
    setCfgQuads(prev=>cells.map(c=>{
      const ex = prev.find(q=>q.nome===c.nome);
      const area = { ax:String(Math.round(c.left*10)/10), ay:String(Math.round(c.top*10)/10), aw:String(Math.round(c.w*10)/10), ah:String(Math.round(c.h*10)/10) };
      return ex ? { ...ex, ...area } : { id:newId(), nome:c.nome, total:"", ...area };
    }));
    setCfgErr(null);
  };
  const salvarConfig = async () => {
    const limpo = cfgQuads.map(q=>{
      const area = (Number(q.aw)>0 && Number(q.ah)>0)
        ? { x:Number(q.ax)||0, y:Number(q.ay)||0, w:Number(q.aw), h:Number(q.ah) }
        : null;
      return { id:q.id, nome:(q.nome||"").trim(), total:Number(q.total)||0, ...(area?{area}:{}) };
    });
    if(limpo.length===0){ setCfgErr("Gere os quadrantes da grade ou adicione manualmente."); return; }
    if(limpo.some(q=>!q.nome)){ setCfgErr("Todo quadrante precisa de um nome."); return; }
    const mapa = cfgUrl.trim() ? { url:cfgUrl.trim(), cols:parsePcts(cfgCols), rows:parsePcts(cfgRows) } : null;
    const next = { ...data, mapa, quadrantes:limpo };
    setSaving(true);
    setData(next); setSelNome(null);
    await saveIluminacao(project.id, next);
    setSaving(false);
    setScreen("list");
  };
  // Limpar TUDO do projeto (gerencial, dupla confirmação): testes tombstonados,
  // quadrantes zerados; o mapa (caminho + divisórias) é mantido
  const limparTudo = async () => {
    const idsTestes = (data.history||[]).map(t=>t.id);
    const next = {
      ...data,
      quadrantes:[],
      history:[],
      deletedIds:[...(data.deletedIds||[]), ...idsTestes],
    };
    setSaving(true);
    setData(next); setSelNome(null); setConfirmLimpar(0);
    await saveIluminacao(project.id, next);
    setSaving(false);
    setScreen("list");
  };

  // ── Levantamento (equipe/admin)
  const abrirSurvey = () => {
    const t = {};
    (data.quadrantes||[]).forEach(q=>{ t[q.id]=String(q.total??""); });
    setSurvTotais(t);
    setScreen("survey");
  };
  const salvarSurvey = async () => {
    const next = { ...data, quadrantes:(data.quadrantes||[]).map(q=>({...q, total:Number(survTotais[q.id])||0})) };
    setSaving(true);
    setData(next);
    await saveIluminacao(project.id, next);
    setSaving(false);
    setScreen("list");
  };

  const excluirTeste = async () => {
    if(!viewTest) return;
    const next = {
      ...data,
      history:(data.history||[]).filter(t=>t.id!==viewTest.id),
      deletedIds:[...(data.deletedIds||[]), viewTest.id],
    };
    setSaving(true);
    setData(next);
    await saveIluminacao(project.id, next);
    setSaving(false);
    setConfirmDel(false); setViewTest(null); setScreen("list");
  };

  if(screen==="pin") return <PinGate project={project} dark={dark} onBack={onBack} onSuccess={(l)=>{grantSession(l,project.id);setAuthLevel(l);setScreen("list");onAuthGranted?.(l);}}/>;

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.txt2,fontSize:13}}>Carregando iluminação…</div>
    </div>
  );

  const Header = (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px 10px"}}>
      <button onClick={()=>{ if(screen==="list") onBack(); else { setViewTest(null); setScreen("list"); } }} style={S.backBtn} aria-label="Voltar">←</button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:800,...S.txt}}>💡 Teste de Iluminação</div>
        <div style={{fontSize:10,...S.txt2}}>{project.id} · {project.name}</div>
      </div>
      {onToggleTheme && <button onClick={onToggleTheme} style={S.btnSm}>{dark?"☀️":"🌙"}</button>}
    </div>
  );

  // ── TELA: configuração (SÓ gerencial)
  if(screen==="config") return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={S.card}>
          <label style={S.lbl}>Imagem do mapa (public/mapas/)</label>
          <input value={cfgUrl} onChange={e=>setCfgUrl(e.target.value)} placeholder={`/mapas/${project.id}.jpg`} style={S.inp}/>
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <div style={{flex:1}}>
              <label style={S.lbl}>Colunas %</label>
              <input value={cfgCols} onChange={e=>setCfgCols(e.target.value)} placeholder="30, 68" style={S.inp}/>
            </div>
            <div style={{flex:1}}>
              <label style={S.lbl}>Linhas %</label>
              <input value={cfgRows} onChange={e=>setCfgRows(e.target.value)} placeholder="50" style={S.inp}/>
            </div>
          </div>
          <button onClick={gerarDaGrade} style={{...S.btnSec,fontSize:12,marginTop:10}}>🔲 Gerar quadrantes da grade</button>
          <div style={{fontSize:10,...S.txt2,marginTop:8}}>Cada quadrante tem sua própria ÁREA no mapa (X, Y, Largura e Altura em % da imagem). A grade preenche as áreas automaticamente; para layouts irregulares, ajuste os números de cada quadrante olhando a prévia.</div>
        </div>
        {cfgUrl.trim() && (
          <MapaQuadrantes
            mapa={{url:cfgUrl.trim(),cols:parsePcts(cfgCols),rows:parsePcts(cfgRows)}}
            quadrantes={cfgQuads.map(q=>({nome:q.nome,area:(Number(q.aw)>0&&Number(q.ah)>0)?{x:Number(q.ax)||0,y:Number(q.ay)||0,w:Number(q.aw),h:Number(q.ah)}:null}))}
            selNome={null} onSelect={()=>{}} ultimoPorNome={{}} dark={dark}/>
        )}
        {cfgQuads.map(q=>(
          <div key={q.id} style={{...S.card,padding:"10px 14px"}}>
            <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
              <div style={{flex:1}}>
                <label style={S.lbl}>Quadrante</label>
                <input value={q.nome} onChange={e=>{const v=e.target.value;setCfgQuads(prev=>prev.map(x=>x.id===q.id?{...x,nome:v}:x));setCfgErr(null);}}
                  placeholder="Ex: A1" style={S.inp}/>
              </div>
              <div style={{width:80}}>
                <label style={S.lbl}>Pontos</label>
                <input value={q.total} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");setCfgQuads(prev=>prev.map(x=>x.id===q.id?{...x,total:v}:x));}}
                  inputMode="numeric" placeholder="—" style={{...S.inp,textAlign:"center"}}/>
              </div>
              <button onClick={()=>setCfgQuads(prev=>prev.filter(x=>x.id!==q.id))} style={{...S.btnSm,color:"#ef4444",borderColor:"#ef444433",padding:"9px 10px"}}>🗑</button>
            </div>
            <div style={{display:"flex",gap:6,marginTop:8}}>
              {[["ax","X %"],["ay","Y %"],["aw","Larg %"],["ah","Alt %"]].map(([campo,rotulo])=>(
                <div key={campo} style={{flex:1}}>
                  <label style={S.lbl}>{rotulo}</label>
                  <input value={q[campo]} inputMode="decimal"
                    onChange={e=>{const v=e.target.value.replace(/[^0-9.]/g,"");setCfgQuads(prev=>prev.map(x=>x.id===q.id?{...x,[campo]:v}:x));}}
                    placeholder="—" style={{...S.inp,textAlign:"center",padding:"8px 6px",fontSize:12}}/>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button onClick={()=>setCfgQuads(prev=>[...prev,{id:newId(),nome:"",total:"",ax:"",ay:"",aw:"",ah:""}])} style={{...S.btnSec,fontSize:13}}>➕ Adicionar quadrante manual</button>
        {cfgErr && <div role="alert" style={{fontSize:12,color:"#ef4444",textAlign:"center"}}>{cfgErr}</div>}
        <button onClick={salvarConfig} disabled={saving} style={{...S.btn,opacity:saving?.6:1}}>{saving?"Salvando…":"💾 Salvar configuração"}</button>
        <button onClick={()=>setScreen("list")} style={{...S.btnSec,fontSize:13}}>Cancelar</button>

        {/* Zona de perigo — LIMPAR TUDO (gerencial, dupla confirmação) */}
        <div style={{...S.card,border:"1px solid #ef444433",marginTop:6}}>
          <div style={{fontSize:11,fontWeight:800,color:"#ef4444",marginBottom:6}}>ZONA DE PERIGO</div>
          {confirmLimpar===0 && <button onClick={()=>setConfirmLimpar(1)} style={{...S.btnSec,fontSize:13,color:"#ef4444",borderColor:"#ef444433"}}>🧹 Limpar tudo deste projeto</button>}
          {confirmLimpar===1 && (
            <>
              <div style={{fontSize:12,...S.txt,marginBottom:8}}>Apagar TODOS os quadrantes e TODOS os testes de iluminação do {project.id}? O mapa configurado é mantido.</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setConfirmLimpar(0)} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
                <button onClick={()=>setConfirmLimpar(2)} style={{...S.btn,flex:1,fontSize:13,background:"linear-gradient(135deg,#dc2626,#991b1b)"}}>Continuar</button>
              </div>
            </>
          )}
          {confirmLimpar===2 && (
            <>
              <div style={{fontSize:12,color:"#ef4444",fontWeight:700,marginBottom:8}}>Última confirmação — essa ação não pode ser desfeita.</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setConfirmLimpar(0)} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
                <button onClick={limparTudo} disabled={saving} style={{...S.btn,flex:1,fontSize:13,background:"linear-gradient(135deg,#dc2626,#991b1b)"}}>{saving?"Limpando…":"🧹 Apagar tudo"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div></div>
  );

  // ── TELA: levantamento de pontos (equipe e admin — editar sim, excluir não)
  if(screen==="survey") return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={S.card}>
          <div style={{fontSize:13,fontWeight:800,...S.txt,marginBottom:2}}>📋 Pontos de iluminação por quadrante</div>
          <div style={{fontSize:11,...S.txt2}}>Conte em campo e registre. Se recontar e o número mudar, é só corrigir aqui.</div>
        </div>
        {(data.quadrantes||[]).map(q=>(
          <div key={q.id} style={{...S.card,display:"flex",alignItems:"center",gap:12,padding:"10px 14px"}}>
            <div style={{flex:1,fontSize:14,fontWeight:800,...S.txt}}>{q.nome}</div>
            <div style={{width:110}}>
              <input value={survTotais[q.id]??""} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");setSurvTotais(prev=>({...prev,[q.id]:v}));}}
                inputMode="numeric" placeholder="pontos" style={{...S.inp,textAlign:"center",fontSize:16,fontWeight:800}}/>
            </div>
          </div>
        ))}
        <button onClick={salvarSurvey} disabled={saving} style={{...S.btn,opacity:saving?.6:1}}>{saving?"Salvando…":"💾 Salvar pontos"}</button>
        <button onClick={()=>setScreen("list")} style={{...S.btnSec,fontSize:13}}>Cancelar</button>
      </div>
    </div></div>
  );

  // ── TELA: novo teste (inoperantes por quadrante)
  if(screen==="form") return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{...S.card,display:"flex",gap:8}}>
          <div style={{flex:1}}>
            <label style={S.lbl}>Data</label>
            <input type="date" value={formDate} onChange={e=>setFormDate(e.target.value)} style={S.inp}/>
          </div>
          <div style={{flex:1.4}}>
            <label style={S.lbl}>Responsável</label>
            <input value={formResp} onChange={e=>{setFormResp(e.target.value);setFormErr(null);}} placeholder="Nome" style={S.inp}/>
          </div>
        </div>
        {(data.quadrantes||[]).map(q=>{
          const max = Number(q.total)||0;
          const val = formCounts[q.id]??"0";
          const inop = val===""?0:Number(val);
          const pct = max ? Math.round(((max-inop)/max)*1000)/10 : 0;
          return (
            <div key={q.id} style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:14,fontWeight:900,...S.txt}}>{q.nome} <span style={{fontSize:11,fontWeight:600,...S.txt2}}>· {max} pontos</span></div>
                <div style={{fontSize:11,fontWeight:800,color:STATUS_CFG[statusFromPct(pct)].color}}>{pct}% operante</div>
              </div>
              <label style={S.lbl}>Inoperantes</label>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>stepCount(q.id,-1,max)} style={{...S.btnSm,fontSize:18,padding:"6px 14px"}}>−</button>
                <input value={val} onChange={e=>setCount(q.id,e.target.value,max)} inputMode="numeric" placeholder={`0–${max}`}
                  style={{...S.inp,textAlign:"center",fontSize:18,fontWeight:800}}/>
                <button onClick={()=>stepCount(q.id,1,max)} style={{...S.btnSm,fontSize:18,padding:"6px 14px"}}>＋</button>
              </div>
              <div style={{marginTop:8}}><BarraPct pct={pct} dark={dark}/></div>
            </div>
          );
        })}
        <div style={S.card}>
          <label style={S.lbl}>Observações (opcional)</label>
          <textarea value={formObs} onChange={e=>setFormObs(e.target.value)} rows={2} placeholder="Ex: refletores da doca 3 queimados (B2)"
            style={{...S.inp,resize:"vertical",fontFamily:"inherit"}}/>
        </div>
        {formErr && <div role="alert" style={{fontSize:12,color:"#ef4444",textAlign:"center"}}>{formErr}</div>}
        <button onClick={salvarTeste} disabled={saving} style={{...S.btn,opacity:saving?.6:1}}>{saving?"Salvando…":"💾 Registrar teste"}</button>
        <button onClick={()=>setScreen("list")} style={{...S.btnSec,fontSize:13}}>Cancelar</button>
      </div>
    </div></div>
  );

  // ── TELA: detalhe de um teste
  if(screen==="view" && viewTest){
    const r = calcTeste(viewTest);
    return (
      <div style={S.page}><div style={S.wrap}>
        {Header}
        <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={S.card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:14,fontWeight:800,...S.txt}}>{fmtDate(viewTest.date)}</div>
                <div style={{fontSize:11,...S.txt2}}>por {viewTest.responsavel||"—"}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:22,fontWeight:900,color:STATUS_CFG[statusFromPct(r.pct)].color}}>{r.pct}%</div>
                <StatusBadge status={statusFromPct(r.pct)}/>
              </div>
            </div>
            <div style={{marginTop:10}}><BarraPct pct={r.pct} dark={dark}/></div>
            <div style={{fontSize:11,...S.txt2,marginTop:6}}>{r.inop} inoperante{r.inop===1?"":"s"} de {r.tot} pontos · {r.ops} operantes</div>
          </div>
          {(viewTest.quads||[]).map(q=>{
            const pct = pctQuad(q);
            const inop = (Number(q.total)||0) - opsDe(q);
            return (
              <div key={q.id} style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{fontSize:12,fontWeight:800,...S.txt}}>{q.nome}</div>
                  <div style={{fontSize:11,...S.txt2}}>{inop} inop. / {q.total} · <span style={{fontWeight:800,color:STATUS_CFG[statusFromPct(pct)].color}}>{pct}%</span></div>
                </div>
                <BarraPct pct={pct} dark={dark}/>
              </div>
            );
          })}
          {viewTest.obs && <div style={S.card}><label style={S.lbl}>Observações</label><div style={{fontSize:12,...S.txt}}>{viewTest.obs}</div></div>}
          {adminAuth && !confirmDel && <button onClick={()=>setConfirmDel(true)} style={{...S.btnSec,color:"#ef4444",borderColor:"#ef444433",fontSize:13}}>🗑 Excluir este teste</button>}
          {adminAuth && confirmDel && (
            <div style={{...S.card,border:"1px solid #ef444455"}}>
              <div style={{fontSize:12,...S.txt,marginBottom:10}}>Excluir definitivamente o teste de {fmtDate(viewTest.date)}?</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setConfirmDel(false)} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
                <button onClick={excluirTeste} disabled={saving} style={{...S.btn,flex:1,fontSize:13,background:"linear-gradient(135deg,#dc2626,#991b1b)"}}>{saving?"Excluindo…":"Excluir"}</button>
              </div>
            </div>
          )}
          <button onClick={()=>{setConfirmDel(false);setViewTest(null);setScreen("list");}} style={{...S.btnSec,fontSize:13}}>← Voltar</button>
        </div>
      </div></div>
    );
  }

  // ── TELA: lista / home do módulo — LIMPA: mapa + lista de quadrantes
  const semQuadrantes = (data.quadrantes||[]).length===0;
  return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>

        {/* Mapa interativo */}
        {data.mapa?.url && !semQuadrantes && (
          <MapaQuadrantes mapa={data.mapa} quadrantes={data.quadrantes} selNome={selNome} onSelect={setSelNome} ultimoPorNome={ultimoPorNome} dark={dark}/>
        )}

        {/* Semana + resumo compactos */}
        <div style={{display:"flex",gap:8}}>
          <div style={{...S.card,flex:1,padding:"10px 12px",border:`1px solid ${semanaOk?"#22c55e33":"#f59e0b33"}`}}>
            <div style={{fontSize:9,...S.txt2,fontWeight:700,textTransform:"uppercase"}}>Semana</div>
            <div style={{fontSize:13,fontWeight:800,color:semanaOk?"#22c55e":"#f59e0b"}}>{semanaOk?"✅ Feito":"⏳ Pendente"}</div>
          </div>
          {ultimo && (()=>{ const r=calcTeste(ultimo); return (
            <div style={{...S.card,flex:1.6,padding:"10px 12px"}}>
              <div style={{fontSize:9,...S.txt2,fontWeight:700,textTransform:"uppercase"}}>Último · {fmtDate(ultimo.date)}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                <div style={{fontSize:17,fontWeight:900,color:STATUS_CFG[statusFromPct(r.pct)].color}}>{r.pct}%</div>
                <div style={{fontSize:10,...S.txt2}}>{r.inop} inop. de {r.tot}</div>
              </div>
            </div>
          );})()}
        </div>

        {/* Lista de quadrantes: pontos, inoperantes, % — toca ↔ realça no mapa */}
        {!semQuadrantes && (data.quadrantes||[]).map(q=>{
          const uq = ultimoPorNome[q.nome];
          const pct = uq ? pctQuad(uq) : null;
          const inop = uq ? (Number(uq.total)||0)-opsDe(uq) : null;
          const cor = pct===null ? (dark?"#475569":"#94a3b8") : STATUS_CFG[statusFromPct(pct)].color;
          const sel = selNome===q.nome;
          return (
            <button key={q.id} onClick={()=>setSelNome(sel?null:q.nome)}
              style={{...S.card,padding:"10px 14px",cursor:"pointer",textAlign:"left",width:"100%",display:"flex",alignItems:"center",gap:12,
                border:`1.5px solid ${sel?"#38bdf8":(dark?"#0f172a":"#e2e8f0")}`, background: sel? (dark?"#071a26":"#eff9ff") : (dark?"#060c18":"#fff")}}>
              <div style={{width:40,textAlign:"center",flexShrink:0,fontSize:15,fontWeight:900,color:sel?"#38bdf8":cor}}>{q.nome}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,...S.txt}}>{Number(q.total)?`${q.total} pontos`:"sem levantamento"}</div>
                <div style={{fontSize:10,...S.txt2}}>{pct===null?"sem teste":`${inop} inoperante${inop===1?"":"s"} · ${pct}% operante`}</div>
              </div>
              {pct!==null
                ? <div style={{width:74,flexShrink:0}}><BarraPct pct={pct} dark={dark}/></div>
                : <span style={{fontSize:10,...S.txt2}}>—</span>}
            </button>
          );
        })}

        {/* Ações */}
        {semQuadrantes ? (
          <div style={{...S.card,border:"1px solid #f59e0b33"}}>
            <div style={{fontSize:12,...S.txt,marginBottom:4,fontWeight:700}}>⚙️ Quadrantes ainda não configurados</div>
            <div style={{fontSize:11,...S.txt2}}>{adminAuth?"Configure o mapa e os quadrantes deste projeto.":"Peça ao gerencial para configurar os quadrantes deste projeto."}</div>
          </div>
        ) : semLevantamento ? (
          <button onClick={abrirSurvey} style={{...S.btn,background:"linear-gradient(135deg,#0369a1,#0c4a6e)"}}>📋 Fazer levantamento de pontos</button>
        ) : (
          <>
            <button onClick={abrirForm} style={S.btn}>➕ Novo Teste de Iluminação</button>
            <button onClick={abrirSurvey} style={{...S.btnSec,fontSize:13}}>📋 Editar Pontos por Quadrante ({totalPontos})</button>
          </>
        )}
        {adminAuth && <button onClick={abrirConfig} style={{...S.btnSec,fontSize:13}}>⚙️ Configurar Mapa e Quadrantes</button>}

        {/* Histórico */}
        {history.length>0 && <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginTop:4}}>Histórico ({history.length})</div>}
        {history.map(t=>{ const r=calcTeste(t); return (
          <button key={t.id} onClick={()=>{setViewTest(t);setConfirmDel(false);setScreen("view");}}
            style={{...S.card,cursor:"pointer",textAlign:"left",width:"100%",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:52,textAlign:"center",flexShrink:0}}>
              <div style={{fontSize:16,fontWeight:900,color:STATUS_CFG[statusFromPct(r.pct)].color}}>{r.pct}%</div>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,...S.txt}}>{fmtDate(t.date)}</div>
              <div style={{fontSize:10,...S.txt2}}>{r.inop} inop. de {r.tot} · {t.responsavel||"—"}</div>
            </div>
            <StatusBadge status={statusFromPct(r.pct)}/>
            <span style={{...S.txt2,fontSize:16}}>›</span>
          </button>
        );})}
      </div>
    </div></div>
  );
}
