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

const PROJECT_ID = "P505";
const PIN_LIDER  = "16505";
const PIN_ADMIN  = "872101";
const ZONAS = Array.from({length:12},(_,i)=>`Zona ${String(i+1).padStart(2,"0")}`);

const STATUS_CFG = {
  ok:      { label:"OK",        color:"#22c55e", bg:"#021a0d", border:"#22c55e33" },
  parcial: { label:"Parcial",   color:"#f59e0b", bg:"#1a1000", border:"#f59e0b33" },
  inop:    { label:"Inoperante",color:"#ef4444", bg:"#1a0202", border:"#ef444433" },
};

function todayStr() { return new Date().toISOString().split("T")[0]; }
function nowTime() {
  const n=new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}
function fmtDate(d) {
  if(!d) return "--";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}

async function loadTestes() {
  try {
    const snap = await getDoc(doc(db,"perimetral",PROJECT_ID));
    if(snap.exists()) {
      const data = snap.data().testes||[];
      try { localStorage.setItem("perimetral_P505", JSON.stringify(data)); } catch(e){}
      return data;
    }
  } catch(e){}
  try {
    const local = localStorage.getItem("perimetral_P505");
    if(local) return JSON.parse(local);
  } catch(e){}
  return [];
}

async function saveTestes(testes) {
  try { await setDoc(doc(db,"perimetral",PROJECT_ID),{testes,updatedAt:new Date().toISOString()}); } catch(e){ console.error(e); }
  try { localStorage.setItem("perimetral_P505", JSON.stringify(testes)); } catch(e){}
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

function emptyTeste() {
  return {
    id: Date.now().toString()+Math.random().toString(36).substring(2,5),
    data: todayStr(),
    hora: nowTime(),
    turno: "Diurno",
    quemFez: "",
    centralAcompanhou: "",
    zonas: Object.fromEntries(ZONAS.map(z=>[z,{status:"ok",obs:""}])),
    criadoEm: new Date().toISOString(),
  };
}

// ── Gerador de PDF
function gerarPDFTeste(teste) {
  const zonaRows = ZONAS.map(z=>{
    const zd = teste.zonas[z]||{status:"ok",obs:""};
    const cfg = STATUS_CFG[zd.status]||STATUS_CFG.ok;
    return `<tr style="background:${zd.status!=="ok"?"#fff5f5":"#fff"}">
      <td>${z}</td>
      <td><span style="background:${cfg.bg};color:${cfg.color};padding:2px 10px;border-radius:4px;font-size:11px;font-weight:700">${cfg.label}</span></td>
      <td>${zd.obs||"—"}</td>
    </tr>`;
  }).join("");

  const problemCount = ZONAS.filter(z=>(teste.zonas[z]?.status||"ok")!=="ok").length;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <title>Teste Perimetral P505 ${fmtDate(teste.data)}</title>
  <style>
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px;color:#1e293b;margin:0}
    .header{background:linear-gradient(135deg,#1a1040,#0f0820);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:16px}
    .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
    .kpi{background:#fff;border-radius:10px;padding:12px;text-align:center;border:1px solid #e2e8f0}
    .kpi-val{font-size:24px;font-weight:900}
    .kpi-lbl{font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
    td{padding:8px 10px;border-bottom:1px solid #f1f5f9}
    .footer{text-align:center;font-size:10px;color:#94a3b8;margin-top:14px}
    @media print{body{padding:8px}@page{margin:12mm}}
  </style></head>
  <body>
  <div style="text-align:center;margin-bottom:14px">
    <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / PDF</button>
  </div>
  <div class="header">
    <h1 style="margin:0 0 4px;font-size:18px">🔒 Teste Perimetral Diário</h1>
    <p style="margin:0 0 2px;font-size:13px">P505 — Klog Guarulhos · ${teste.turno}</p>
    <p style="margin:0;font-size:11px;opacity:.7">${fmtDate(teste.data)} às ${teste.hora}</p>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-val" style="color:#22c55e">${12-problemCount}</div><div class="kpi-lbl">OK</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#ef4444">${problemCount}</div><div class="kpi-lbl">Com Problema</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#0ea5e9">12</div><div class="kpi-lbl">Total Zonas</div></div>
  </div>
  <div class="card">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div><div style="font-size:10px;color:#94a3b8;font-weight:700">QUEM FEZ O TESTE</div><div style="font-weight:700">${teste.quemFez||"—"}</div></div>
      <div><div style="font-size:10px;color:#94a3b8;font-weight:700">ACOMPANHOU NA CENTRAL</div><div style="font-weight:700">${teste.centralAcompanhou||"—"}</div></div>
    </div>
    <table><thead><tr><th>Zona</th><th>Status</th><th>Observação</th></tr></thead>
    <tbody>${zonaRows}</tbody></table>
  </div>
  <div class="footer">MokLog CheckTest © Moked Consulting Security · P505 · ${fmtDate(teste.data)}</div>
  </body></html>`;

  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url;
  a.download=`perimetral_P505_${teste.data}_${teste.turno}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PIN Gate
function PinGate({ onSuccess, onBack, dark }) {
  const S = getStyles(dark);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);

  const tryPin = () => {
    if(pin===PIN_ADMIN){ onSuccess("admin"); return; }
    if(pin===PIN_LIDER){ onSuccess("lider"); return; }
    setErr(true);
  };

  return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,maxWidth:320,width:"100%",margin:16,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>🔒</div>
        <div style={{fontSize:16,fontWeight:800,...S.txt,marginBottom:4}}>Teste Perimetral</div>
        <div style={{fontSize:12,...S.txt2,marginBottom:20}}>P505 · Klog Guarulhos</div>
        <div style={{fontSize:12,...S.txt2,marginBottom:12}}>PIN do projeto</div>
        <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8}
          value={pin} onChange={e=>{setPin(e.target.value);setErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter") tryPin();}}
          style={{...S.inp,textAlign:"center",fontSize:22,letterSpacing:10,marginBottom:8}}/>
        {err && <div style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onBack} style={{...S.btnSec,flex:1,fontSize:13}}>← Voltar</button>
          <button onClick={tryPin} style={{...S.btn,flex:1,fontSize:13}}>Entrar</button>
        </div>
      </div>
    </div>
  );
}

export default function Perimetral({ onBack, dark, onToggleTheme }) {
  const S = getStyles(dark||true);
  const [authLevel, setAuthLevel] = useState(null);
  const [screen, setScreen] = useState("pin");
  const [testes, setTestes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [viewTeste, setViewTeste] = useState(null);

  const adminAuth = authLevel==="admin";

  useEffect(()=>{
    loadTestes().then(t=>{ setTestes(t||[]); setLoading(false); });
  },[]);

  const salvar = async () => {
    if(!form.quemFez.trim()) { alert("Informe quem fez o teste"); return; }
    setSaving(true);
    try {
      const novo = {...form, criadoEm: new Date().toISOString()};
      const newList = [novo, ...testes];
      setTestes(newList);
      await saveTestes(newList);
      setScreen("list");
      setForm(null);
    } catch(e) { alert("Erro ao salvar"); }
    setSaving(false);
  };

  const excluir = async (id) => {
    const newList = testes.filter(t=>t.id!==id);
    setTestes(newList);
    await saveTestes(newList);
    if(viewTeste?.id===id){ setViewTeste(null); setScreen("list"); }
  };

  const updateZona = (zona, field, val) => {
    setForm(f=>({...f, zonas:{...f.zonas, [zona]:{...f.zonas[zona],[field]:val}}}));
  };

  if(screen==="pin") return <PinGate dark={dark||true} onBack={onBack} onSuccess={(l)=>{setAuthLevel(l);setScreen("list");}}/>;

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:30,marginBottom:10}}>🔒</div>
        <div style={{fontSize:13,...S.txt2}}>Carregando testes...</div>
      </div>
    </div>
  );

  // ── VIEW teste
  if(screen==="view"&&viewTeste) {
    const problemCount = ZONAS.filter(z=>(viewTeste.zonas[z]?.status||"ok")!=="ok").length;
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>{setViewTeste(null);setScreen("list");}} style={S.backBtn}>← Voltar</button>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:800,...S.txt}}>🔒 {viewTeste.turno}</div>
                <div style={{fontSize:11,...S.txt2}}>{fmtDate(viewTeste.data)} às {viewTeste.hora}</div>
              </div>
              <button onClick={()=>gerarPDFTeste(viewTeste)} style={{...S.btnSm,color:"#a855f7",border:"1px solid #a855f744",fontSize:11}}>📄 PDF</button>
            </div>
          </div>
          <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
            {/* Cabeçalho */}
            <div style={S.card}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div><div style={S.lbl}>Quem fez</div><div style={{fontSize:13,fontWeight:600,...S.txt}}>{viewTeste.quemFez||"—"}</div></div>
                <div><div style={S.lbl}>Central</div><div style={{fontSize:13,fontWeight:600,...S.txt}}>{viewTeste.centralAcompanhou||"—"}</div></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {[{l:"OK",v:12-problemCount,c:"#22c55e"},{l:"Problemas",v:problemCount,c:"#ef4444"},{l:"Total",v:12,c:"#0ea5e9"}].map(({l,v,c})=>(
                  <div key={l} style={{textAlign:"center",background:dark?"#020510":"#f8fafc",borderRadius:8,padding:"8px"}}>
                    <div style={{fontSize:20,fontWeight:900,color:c}}>{v}</div>
                    <div style={{fontSize:9,...S.txt2,fontWeight:700}}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Zonas */}
            <div style={S.card}>
              <div style={{fontSize:11,color:"#0ea5e9",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>🔒 Status das Zonas</div>
              {ZONAS.map(zona=>{
                const zd = viewTeste.zonas[zona]||{status:"ok",obs:""};
                const cfg = STATUS_CFG[zd.status]||STATUS_CFG.ok;
                return (
                  <div key={zona} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,padding:"6px 8px",borderRadius:7,background:zd.status!=="ok"?cfg.bg+"88":"transparent"}}>
                    <span style={{fontSize:11,fontWeight:700,...S.txt,width:60,flexShrink:0}}>{zona}</span>
                    <span style={{fontSize:10,fontWeight:700,color:cfg.color,background:cfg.bg,padding:"2px 8px",borderRadius:4}}>{cfg.label}</span>
                    {zd.obs&&<span style={{fontSize:10,...S.txt2,flex:1}}>— {zd.obs}</span>}
                  </div>
                );
              })}
            </div>
            {adminAuth&&<button onClick={()=>{if(window.confirm("Excluir este teste?")) excluir(viewTeste.id);}} style={{...S.btnSec,color:"#ef4444",borderColor:"#ef444433",fontSize:13}}>🗑 Excluir</button>}
          </div>
        </div>
      </div>
    );
  }

  // ── FORMULÁRIO
  if(screen==="form"&&form) return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>{setScreen("list");setForm(null);}} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>🔒 Novo Teste Perimetral</div>
              <div style={{fontSize:11,...S.txt2}}>P505 · Klog Guarulhos</div>
            </div>
            <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,...S.txt2}}>{dark?"☀️":"🌙"}</button>
          </div>
        </div>

        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          {/* Cabeçalho do teste */}
          <div style={{...S.card,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={S.lbl}>Data</label>
                <input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} style={S.inp}/>
              </div>
              <div>
                <label style={S.lbl}>Hora</label>
                <div style={{display:"flex",gap:5}}>
                  <input type="time" value={form.hora} onChange={e=>setForm(f=>({...f,hora:e.target.value}))} style={{...S.inp,flex:1}}/>
                  <button onClick={()=>setForm(f=>({...f,hora:nowTime()}))} style={{...S.btnSm,padding:"8px 10px",fontSize:14,flexShrink:0}}>⏱</button>
                </div>
              </div>
            </div>
            {/* Turno */}
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
            <div>
              <label style={S.lbl}>Quem fez o teste *</label>
              <input value={form.quemFez} onChange={e=>setForm(f=>({...f,quemFez:e.target.value}))} placeholder="Nome do responsável..." style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Acompanhou na Central</label>
              <input value={form.centralAcompanhou} onChange={e=>setForm(f=>({...f,centralAcompanhou:e.target.value}))} placeholder="Nome da operadora..." style={S.inp}/>
            </div>
          </div>

          {/* Zonas */}
          <div style={S.card}>
            <div style={{fontSize:11,color:"#0ea5e9",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>🔒 Status das 12 Zonas</div>
            {ZONAS.map(zona=>{
              const zd = form.zonas[zona]||{status:"ok",obs:""};
              const temProb = zd.status!=="ok";
              return (
                <div key={zona} style={{marginBottom:10,padding:"10px 12px",background:temProb?STATUS_CFG[zd.status].bg+"66":dark?"#020510":"#f8fafc",borderRadius:8,border:`1px solid ${temProb?STATUS_CFG[zd.status].border:dark?"#0f172a":"#e2e8f0"}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:temProb?8:0}}>
                    <span style={{fontSize:12,fontWeight:700,...S.txt,width:65,flexShrink:0}}>{zona}</span>
                    <div style={{display:"flex",gap:5,flex:1}}>
                      {["ok","parcial","inop"].map(s=>{
                        const cfg = STATUS_CFG[s];
                        const isSel = zd.status===s;
                        return (
                          <button key={s} onClick={()=>updateZona(zona,"status",s)}
                            style={{flex:1,background:isSel?cfg.bg:"transparent",border:`2px solid ${isSel?cfg.color:"#0f172a"}`,color:isSel?cfg.color:dark?"#334155":"#94a3b8",borderRadius:6,padding:"5px 4px",fontSize:10,cursor:"pointer",fontWeight:isSel?700:400}}>
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {temProb&&(
                    <input value={zd.obs} onChange={e=>updateZona(zona,"obs",e.target.value)}
                      placeholder="Observação..." style={{...S.inp,fontSize:12,marginTop:2}}/>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={salvar} disabled={saving} style={{...S.btnGreen,opacity:saving?0.7:1}}>
            {saving?"⟳ Salvando...":"✓ Finalizar Teste"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── LISTA
  const ultimoTeste = testes[0]||null;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onBack} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>🔒 Teste Perimetral</div>
              <div style={{fontSize:11,...S.txt2}}>P505 · {testes.length} teste(s)</div>
            </div>
            <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,...S.txt2}}>{dark?"☀️":"🌙"}</button>
          </div>
        </div>

        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
          {/* Último teste */}
          {ultimoTeste&&(
            <div style={{background:dark?"#001a2e":"#e0f2fe",border:"1px solid #0ea5e933",borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontSize:10,color:"#0ea5e9",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>📋 Último Teste</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,...S.txt}}>{ultimoTeste.turno} · {fmtDate(ultimoTeste.data)}</div>
                  <div style={{fontSize:11,...S.txt2}}>{ultimoTeste.quemFez||"—"} · {ultimoTeste.hora}</div>
                </div>
                <button onClick={()=>{setViewTeste(ultimoTeste);setScreen("view");}}
                  style={{...S.btnSm,color:"#0ea5e9",border:"1px solid #0ea5e944",fontSize:11}}>👁 Ver</button>
              </div>
            </div>
          )}

          <button onClick={()=>{setForm(emptyTeste());setScreen("form");}} style={S.btn}>
            + Novo Teste Perimetral
          </button>

          {testes.length===0&&(
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:32,marginBottom:10}}>🔒</div>
              <div style={{fontSize:13,...S.txt}}>Nenhum teste registrado</div>
            </div>
          )}

          {testes.length>0&&(
            <>
              <div style={{fontSize:10,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Histórico</div>
              {testes.map(t=>{
                const probs = ZONAS.filter(z=>(t.zonas[z]?.status||"ok")!=="ok").length;
                return (
                  <div key={t.id} style={{...S.card,cursor:"pointer"}} onClick={()=>{setViewTeste(t);setScreen("view");}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:40,height:40,borderRadius:10,background:probs>0?dark?"#1a0202":"#fee2e2":dark?"#021a0d":"#dcfce7",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>
                        {probs>0?"⚠️":"✅"}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700,...S.txt}}>{t.turno} · {fmtDate(t.data)}</div>
                        <div style={{fontSize:11,...S.txt2}}>{t.quemFez||"—"} · {t.hora}</div>
                        {probs>0&&<div style={{fontSize:10,color:"#ef4444",fontWeight:700,marginTop:2}}>{probs} zona(s) com problema</div>}
                      </div>
                      <span style={{...S.txt2,fontSize:16}}>›</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
