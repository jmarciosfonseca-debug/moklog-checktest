// ─────────────────────────────────────────────────────────────
// Iluminacao.jsx — Teste de Iluminação (Fase 1)
// Contagem de pontos acesos por QUADRANTE, seguindo o mapa real
// de cada projeto. Disponível para TODOS os projetos (incl. Jatinox).
// Cadência semanal, separado do teste semanal de equipamentos.
// (Fase 2: impacto percentual no teste semanal + PDF.)
//
// Quadrantes são configuráveis pelo gerencial (⚙️): nome + total de
// pontos. Cada teste guarda um SNAPSHOT dos quadrantes no momento do
// registro — mudar a configuração depois não corrompe o histórico.
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

// ── Limiares de status por percentual aceso (ajustáveis)
const PCT_OK = 95;       // >= 95% → Normal
const PCT_ATENCAO = 80;  // >= 80% → Atenção · abaixo → Crítico

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

// ── Semana atual (domingo → sábado), alinhado ao ciclo semanal do app
function inicioSemana(){
  const d = new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function testeNaSemana(history){
  const ini = inicioSemana();
  return (history||[]).some(t=>{ try { return new Date(t.date+"T12:00:00") >= ini; } catch { return false; } });
}

// ── Totais de um teste (a partir do snapshot dos quadrantes)
export function calcTeste(t){
  const tot = (t?.quads||[]).reduce((a,q)=>a+(Number(q.total)||0),0);
  const ac  = (t?.quads||[]).reduce((a,q)=>a+(Number(q.acesas)||0),0);
  const pct = tot ? Math.round((ac/tot)*1000)/10 : 0;
  return { tot, ac, pct };
}

// ── Firestore: doc único por projeto, com tombstone (deletedIds) contra
// ressurreição de testes excluídos, e fallback em localStorage.
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

// ── PIN Gate (fallback — só aparece se não houver sessão válida)
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
  const [screen, setScreen] = useState(()=>(sharedAuth||getAccess(project?.id))?"list":"pin"); // pin | list | form | config | view
  const [data, setData] = useState({ quadrantes:[], history:[], deletedIds:[] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const adminAuth = authLevel==="admin";

  // Form de novo teste
  const [formDate, setFormDate] = useState(todayStrLocal());
  const [formResp, setFormResp] = useState(()=>{ try{return localStorage.getItem("iluminacao_ultimo_nome")||"";}catch{return"";} });
  const [formCounts, setFormCounts] = useState({}); // {quadId: string}
  const [formObs, setFormObs] = useState("");
  const [formErr, setFormErr] = useState(null);

  // Config de quadrantes (edição gerencial)
  const [cfgQuads, setCfgQuads] = useState([]);
  const [cfgErr, setCfgErr] = useState(null);

  // Visualização/exclusão de um teste
  const [viewTest, setViewTest] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(()=>{ loadIluminacao(project.id).then(d=>{ setData(d); setLoading(false); }); },[project.id]);

  const history = [...(data.history||[])].sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.criadoEm||"").localeCompare(a.criadoEm||""));
  const ultimo = history[0]||null;
  const semanaOk = testeNaSemana(history);
  const totalPontos = (data.quadrantes||[]).reduce((a,q)=>a+(Number(q.total)||0),0);

  const abrirForm = () => {
    const counts = {};
    (data.quadrantes||[]).forEach(q=>{ counts[q.id]=""; });
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
      const cur = prev[qid]==="" ? null : Number(prev[qid]);
      let next = cur===null ? (delta>0?max:0) : cur+delta; // primeiro toque no + preenche com o total (caso comum: tudo aceso)
      next = Math.max(0, Math.min(max, next));
      return {...prev,[qid]:String(next)};
    });
    setFormErr(null);
  };

  const salvarTeste = async () => {
    if(!formResp.trim()){ setFormErr("Informe o responsável pelo teste."); return; }
    const pendente = (data.quadrantes||[]).find(q=>formCounts[q.id]==="");
    if(pendente){ setFormErr(`Preencha a contagem do quadrante "${pendente.nome}".`); return; }
    const quads = (data.quadrantes||[]).map(q=>({ id:q.id, nome:q.nome, total:Number(q.total)||0, acesas:Number(formCounts[q.id])||0 }));
    const teste = { id:newId(), date:formDate, responsavel:formResp.trim(), quads, obs:formObs.trim(), criadoEm:new Date().toISOString() };
    const next = { ...data, history:[...(data.history||[]), teste] };
    setSaving(true);
    setData(next);
    try { localStorage.setItem("iluminacao_ultimo_nome", formResp.trim()); } catch(e){}
    await saveIluminacao(project.id, next);
    setSaving(false);
    setScreen("list");
  };

  const abrirConfig = () => {
    setCfgQuads((data.quadrantes||[]).map(q=>({...q, total:String(q.total)})));
    setCfgErr(null);
    setScreen("config");
  };
  const salvarConfig = async () => {
    const limpo = cfgQuads.map(q=>({ id:q.id, nome:(q.nome||"").trim(), total:Number(q.total)||0 }));
    if(limpo.some(q=>!q.nome)){ setCfgErr("Todo quadrante precisa de um nome."); return; }
    if(limpo.some(q=>q.total<=0)){ setCfgErr("Todo quadrante precisa de um total de pontos maior que zero."); return; }
    const next = { ...data, quadrantes:limpo };
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
      deletedIds:[...(data.deletedIds||[]), viewTest.id], // tombstone
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

  // ── Cabeçalho comum
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

  // ── TELA: configuração de quadrantes (gerencial)
  if(screen==="config") return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={S.card}>
          <div style={{fontSize:13,fontWeight:800,...S.txt,marginBottom:2}}>⚙️ Quadrantes do projeto</div>
          <div style={{fontSize:11,...S.txt2}}>Divida o projeto conforme o mapa real. Cada quadrante tem um total de pontos de iluminação; a equipe registra quantos estão acesos. Testes antigos guardam a configuração da época.</div>
        </div>
        {cfgQuads.map((q,i)=>(
          <div key={q.id} style={{...S.card,display:"flex",gap:8,alignItems:"flex-end"}}>
            <div style={{flex:1}}>
              <label style={S.lbl}>Quadrante {String(i+1).padStart(2,"0")}</label>
              <input value={q.nome} onChange={e=>{const v=e.target.value;setCfgQuads(prev=>prev.map(x=>x.id===q.id?{...x,nome:v}:x));setCfgErr(null);}}
                placeholder="Ex: Perímetro Norte" style={S.inp}/>
            </div>
            <div style={{width:92}}>
              <label style={S.lbl}>Pontos</label>
              <input value={q.total} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");setCfgQuads(prev=>prev.map(x=>x.id===q.id?{...x,total:v}:x));setCfgErr(null);}}
                inputMode="numeric" placeholder="0" style={{...S.inp,textAlign:"center"}}/>
            </div>
            <button onClick={()=>setCfgQuads(prev=>prev.filter(x=>x.id!==q.id))} style={{...S.btnSm,color:"#ef4444",borderColor:"#ef444433",padding:"9px 10px"}}>🗑</button>
          </div>
        ))}
        <button onClick={()=>setCfgQuads(prev=>[...prev,{id:newId(),nome:"",total:""}])} style={{...S.btnSec,fontSize:13}}>➕ Adicionar quadrante</button>
        {cfgErr && <div role="alert" style={{fontSize:12,color:"#ef4444",textAlign:"center"}}>{cfgErr}</div>}
        <button onClick={salvarConfig} disabled={saving} style={{...S.btn,opacity:saving?.6:1}}>{saving?"Salvando…":"💾 Salvar quadrantes"}</button>
        <button onClick={()=>setScreen("list")} style={{...S.btnSec,fontSize:13}}>Cancelar</button>
      </div>
    </div></div>
  );

  // ── TELA: novo teste
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
          const val = formCounts[q.id]??"";
          const pct = val==="" ? null : (max? Math.round((Number(val)/max)*1000)/10 : 0);
          return (
            <div key={q.id} style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:13,fontWeight:800,...S.txt}}>{q.nome}</div>
                <div style={{fontSize:11,...S.txt2}}>{val===""?"—":val} / {max} acesas{pct!==null && <span style={{marginLeft:6,fontWeight:800,color:STATUS_CFG[statusFromPct(pct)].color}}>{pct}%</span>}</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>stepCount(q.id,-1,max)} style={{...S.btnSm,fontSize:18,padding:"6px 14px"}}>−</button>
                <input value={val} onChange={e=>setCount(q.id,e.target.value,max)} inputMode="numeric" placeholder={`0–${max}`}
                  style={{...S.inp,textAlign:"center",fontSize:18,fontWeight:800}}/>
                <button onClick={()=>stepCount(q.id,1,max)} style={{...S.btnSm,fontSize:18,padding:"6px 14px"}}>＋</button>
              </div>
              {pct!==null && <div style={{marginTop:8}}><BarraPct pct={pct} dark={dark}/></div>}
            </div>
          );
        })}
        <div style={S.card}>
          <label style={S.lbl}>Observações (opcional)</label>
          <textarea value={formObs} onChange={e=>setFormObs(e.target.value)} rows={2} placeholder="Ex: refletores da doca 3 queimados"
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
            <div style={{fontSize:11,...S.txt2,marginTop:6}}>{r.ac} de {r.tot} pontos acesos</div>
          </div>
          {(viewTest.quads||[]).map(q=>{
            const pct = q.total ? Math.round((q.acesas/q.total)*1000)/10 : 0;
            return (
              <div key={q.id} style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{fontSize:12,fontWeight:700,...S.txt}}>{q.nome}</div>
                  <div style={{fontSize:11,...S.txt2}}>{q.acesas}/{q.total} · <span style={{fontWeight:800,color:STATUS_CFG[statusFromPct(pct)].color}}>{pct}%</span></div>
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

  // ── TELA: lista / home do módulo
  const semQuadrantes = (data.quadrantes||[]).length===0;
  return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>

        {/* Status da semana */}
        <div style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${semanaOk?"#22c55e33":"#f59e0b33"}`}}>
          <div style={{fontSize:12,fontWeight:700,...S.txt}}>Teste desta semana</div>
          <div style={{fontSize:12,fontWeight:800,color:semanaOk?"#22c55e":"#f59e0b"}}>{semanaOk?"✅ Realizado":"⏳ Pendente"}</div>
        </div>

        {/* Resumo do último teste */}
        {ultimo ? (()=>{ const r=calcTeste(ultimo); return (
          <div style={S.card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:11,...S.txt2}}>Último teste · {fmtDate(ultimo.date)}</div>
              <StatusBadge status={statusFromPct(r.pct)}/>
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:8}}>
              <div style={{fontSize:28,fontWeight:900,color:STATUS_CFG[statusFromPct(r.pct)].color}}>{r.pct}%</div>
              <div style={{fontSize:11,...S.txt2}}>{r.ac} de {r.tot} pontos acesos</div>
            </div>
            <BarraPct pct={r.pct} dark={dark}/>
          </div>
        );})() : (
          <div style={{...S.card,textAlign:"center"}}>
            <div style={{fontSize:26,marginBottom:6}}>💡</div>
            <div style={{fontSize:12,...S.txt2}}>Nenhum teste registrado ainda.</div>
          </div>
        )}

        {/* Ações */}
        {semQuadrantes ? (
          <div style={{...S.card,border:"1px solid #f59e0b33"}}>
            <div style={{fontSize:12,...S.txt,marginBottom:4,fontWeight:700}}>⚙️ Quadrantes ainda não configurados</div>
            <div style={{fontSize:11,...S.txt2}}>{adminAuth?"Configure os quadrantes deste projeto conforme o mapa real para liberar o registro.":"Peça ao gerencial para configurar os quadrantes deste projeto."}</div>
          </div>
        ) : (
          <button onClick={abrirForm} style={S.btn}>➕ Novo Teste de Iluminação</button>
        )}
        {adminAuth && <button onClick={abrirConfig} style={{...S.btnSec,fontSize:13}}>⚙️ Configurar Quadrantes {totalPontos>0?`(${(data.quadrantes||[]).length} · ${totalPontos} pontos)`:""}</button>}

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
              <div style={{fontSize:10,...S.txt2}}>{r.ac}/{r.tot} acesas · {t.responsavel||"—"}</div>
            </div>
            <StatusBadge status={statusFromPct(r.pct)}/>
            <span style={{...S.txt2,fontSize:16}}>›</span>
          </button>
        );})}
      </div>
    </div></div>
  );
}
