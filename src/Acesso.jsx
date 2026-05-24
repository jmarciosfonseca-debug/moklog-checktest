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

function todayStr() { return new Date().toISOString().split("T")[0]; }
function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}
function fmtDate(d) {
  if(!d) return "--";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}
function fmtDateTime(iso) {
  if(!iso) return "--";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  } catch { return iso; }
}

async function loadRegistros(projectId) {
  try {
    const snap = await getDoc(doc(db,"acesso",projectId));
    if(snap.exists()) return snap.data().registros || [];
  } catch(e){}
  try {
    const local = localStorage.getItem(`acesso_${projectId}`);
    if(local) return JSON.parse(local);
  } catch(e){}
  return [];
}

async function saveRegistros(projectId, registros) {
  try { await setDoc(doc(db,"acesso",projectId), { registros, updatedAt: new Date().toISOString() }); } catch(e){}
  try { localStorage.setItem(`acesso_${projectId}`, JSON.stringify(registros)); } catch(e){}
}

function calcDuracao(entrada, saida) {
  if(!entrada || !saida) return null;
  try {
    const [eh,em] = entrada.split(":").map(Number);
    const [sh,sm] = saida.split(":").map(Number);
    let mins = (sh*60+sm) - (eh*60+em);
    if(mins < 0) mins += 24*60;
    if(mins <= 0) return null;
    const h = Math.floor(mins/60);
    const m = mins%60;
    return h>0 ? `${h}h${m>0?` ${m}min`:""}` : `${m}min`;
  } catch { return null; }
}

function generateConsolidadoHTML(registros, projectId) {
  const sorted = [...registros].sort((a,b)=>a.data.localeCompare(b.data));
  const rows = sorted.map((r,i) => {
    const dur = calcDuracao(r.entradaPatio, r.saidaPatio);
    return `
      <tr style="background:${i%2===0?"#f8fafc":"#ffffff"}">
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px">${fmtDate(r.data)}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px">${r.transportadora||"--"}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px">${r.placa||"--"}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px">${r.motorista||"--"}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px">${r.estacionou||"--"}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px">${r.chamado||"--"}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px">${r.entradaPatio||"--"}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px">${r.saidaPatio||"--"}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;color:${dur?"#0369a1":"#94a3b8"}">${dur||"--"}</td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório Acesso — ${projectId}</title>
<style>
  body{font-family:'Segoe UI',sans-serif;margin:0;padding:20px;background:#f1f5f9}
  .header{background:linear-gradient(135deg,#1a1040,#0f0820);color:#fff;padding:24px 28px;border-radius:12px;margin-bottom:20px}
  .header h1{margin:0 0 4px;font-size:20px}
  .header p{margin:0;font-size:12px;opacity:.7}
  .kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px}
  .kpi{background:#fff;border-radius:10px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .kpi-val{font-size:26px;font-weight:900;color:#1d4ed8}
  .kpi-lbl{font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:3px}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  th{background:#1e293b;color:#fff;padding:10px 12px;text-align:left;font-size:12px;font-weight:700}
  .footer{text-align:center;margin-top:16px;font-size:11px;color:#94a3b8}
  @media print{body{padding:10px}.header{border-radius:0}}
</style>
</head>
<body>
<div class="header">
  <h1>🚛 Relatório de Acesso — ${projectId}</h1>
  <p>Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} · ${sorted.length} registro(s)</p>
</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-val">${sorted.length}</div><div class="kpi-lbl">Total de Registros</div></div>
  <div class="kpi"><div class="kpi-val">${new Set(sorted.map(r=>r.transportadora).filter(Boolean)).size}</div><div class="kpi-lbl">Transportadoras</div></div>
  <div class="kpi"><div class="kpi-val">${sorted.filter(r=>r.saidaPatio).length}</div><div class="kpi-lbl">Saídas Registradas</div></div>
  <div class="kpi"><div class="kpi-val">${sorted.filter(r=>r.entradaPatio&&!r.saidaPatio).length}</div><div class="kpi-lbl">No Pátio Agora</div></div>
</div>
<table>
  <thead>
    <tr>
      <th>Data</th><th>Transportadora</th><th>Placa</th><th>Motorista</th>
      <th>Estacionou</th><th>Chamado</th><th>Entrada Pátio</th><th>Saída Pátio</th><th>Duração</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">MokLog CheckTest © Moked Consulting Security · Controle de Acesso ${projectId}</div>
</body>
</html>`;

  const blob = new Blob([html], {type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `acesso_${projectId}_${todayStr()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

const S = {
  page:    { minHeight:"100vh", background:"#04080f", display:"flex", justifyContent:"center", padding:"0 0 80px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
  wrap:    { width:"100%", maxWidth:480, padding:"0", display:"flex", flexDirection:"column" },
  card:    { background:"#060c18", border:"1px solid #0f172a", borderRadius:12, padding:"16px" },
  btn:     { background:"linear-gradient(135deg,#16a34a,#15803d)", color:"#fff", border:"none", borderRadius:10, padding:"14px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
  btnSec:  { background:"#060c18", color:"#64748b", border:"1px solid #0f172a", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
  btnSm:   { background:"#020510", border:"1px solid #0f172a", color:"#64748b", borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:600 },
  backBtn: { background:"transparent", border:"1px solid #0f172a", color:"#334155", borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 },
  inp:     { width:"100%", background:"#020510", border:"1px solid #0f172a", borderRadius:7, color:"#e2e8f0", padding:"10px 12px", fontSize:13, boxSizing:"border-box", outline:"none" },
  lbl:     { display:"block", fontSize:10, color:"#475569", fontWeight:700, marginBottom:5, textTransform:"uppercase", letterSpacing:.5 },
};

export default function AcessoApp({ onBack, initialScreen }) {
  const projectId = "P260A";
  const [screen, setScreen] = useState(initialScreen || "menu"); // menu | form | list
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selIds, setSelIds] = useState([]);

  const emptyForm = () => ({
    id: Date.now().toString() + Math.random().toString(36).substring(2,6),
    data: todayStr(),
    transportadora:"", placa:"", motorista:"",
    estacionou:"", chamado:"", entradaPatio:"", saidaPatio:"",
    registradoEm: new Date().toISOString()
  });
  const [form, setForm] = useState(emptyForm());
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    loadRegistros(projectId).then(r=>{ setRegistros(r||[]); setLoading(false); });
  },[]);

  const transmitir = async () => {
    if(!form.transportadora && !form.placa && !form.motorista) {
      alert("Informe pelo menos Transportadora, Placa ou Motorista");
      return;
    }
    setSaving(true);
    const novoRegistro = { ...form, registradoEm: new Date().toISOString() };
    const newList = [novoRegistro, ...registros];
    setRegistros(newList);
    await saveRegistros(projectId, newList);
    setSaving(false);
    setForm(emptyForm());
    alert("✅ Registro transmitido ao CCO!");
    setScreen("menu");
  };

  const excluirRegistro = async (id) => {
    if(!window.confirm("Excluir este registro?")) return;
    const newList = registros.filter(r=>r.id!==id);
    setRegistros(newList);
    await saveRegistros(projectId, newList);
    setSelIds(prev=>prev.filter(sid=>sid!==id));
  };

  const toggleSel = (id) => {
    setSelIds(prev => prev.includes(id) ? prev.filter(s=>s!==id) : [...prev,id]);
  };

  const gerarConsolidado = () => {
    const selecionados = selIds.length > 0
      ? registros.filter(r=>selIds.includes(r.id))
      : registros;
    if(selecionados.length===0) { alert("Nenhum registro para gerar relatório"); return; }
    generateConsolidadoHTML(selecionados, projectId);
  };

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:30,marginBottom:10}}>🚛</div>
        <div style={{fontSize:13,color:"#64748b"}}>Carregando registros...</div>
      </div>
    </div>
  );

  // ── MENU
  if(screen==="menu") return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* Header */}
        <div style={{ position:"sticky", top:0, zIndex:10, background:"#04080f", borderBottom:"1px solid #0a0f1e", padding:"16px 16px 12px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onBack} style={S.backBtn}>← Menu Jatinox</button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"#f1f5f9" }}>🚛 Acesso — P260A</div>
              <div style={{ fontSize:11, color:"#475569" }}>Controle de Transportadoras</div>
            </div>
          </div>
        </div>

        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:12 }}>
          {/* KPI rápido */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div style={{ ...S.card, textAlign:"center" }}>
              <div style={{ fontSize:28, fontWeight:900, color:"#f59e0b" }}>{registros.length}</div>
              <div style={{ fontSize:10, color:"#64748b", fontWeight:700 }}>REGISTROS TOTAIS</div>
            </div>
            <div style={{ ...S.card, textAlign:"center" }}>
              <div style={{ fontSize:28, fontWeight:900, color:"#22c55e" }}>
                {registros.filter(r=>r.data===todayStr()).length}
              </div>
              <div style={{ fontSize:10, color:"#64748b", fontWeight:700 }}>HOJE</div>
            </div>
          </div>

          {/* Ações */}
          <button onClick={()=>{ setForm(emptyForm()); setScreen("form"); }}
            style={{ ...S.btn, fontSize:14 }}>
            🚛 Novo Registro de Acesso
          </button>

          <button onClick={()=>{ setSelIds([]); setScreen("list"); }}
            style={{ ...S.btnSec, fontSize:13, color:"#0ea5e9", borderColor:"#0ea5e922" }}>
            📋 Ver Registros ({registros.length})
          </button>
        </div>
      </div>
    </div>
  );

  // ── FORMULÁRIO NOVO REGISTRO
  if(screen==="form") return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* Header */}
        <div style={{ position:"sticky", top:0, zIndex:10, background:"#04080f", borderBottom:"1px solid #0a0f1e", padding:"16px 16px 12px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={()=>setScreen("menu")} style={S.backBtn}>← Voltar</button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"#f59e0b" }}>🚛 Novo Registro</div>
              <div style={{ fontSize:11, color:"#475569" }}>Controle de Fluxo — P260A</div>
            </div>
          </div>
        </div>

        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:12 }}>
          {/* Dados da carga */}
          <div style={S.card}>
            <div style={{ fontSize:11, color:"#f59e0b", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:12 }}>📦 Dados da Carga</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div>
                <label style={S.lbl}>Data</label>
                <input type="date" value={form.data} onChange={e=>setF("data",e.target.value)} style={S.inp}/>
              </div>
              <div>
                <label style={S.lbl}>Placa do Veículo</label>
                <input value={form.placa} onChange={e=>setF("placa",e.target.value.toUpperCase())} placeholder="ABC-1234" style={S.inp}/>
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={S.lbl}>Transportadora</label>
              <input value={form.transportadora} onChange={e=>setF("transportadora",e.target.value)} placeholder="Nome da transportadora..." style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Motorista</label>
              <input value={form.motorista} onChange={e=>setF("motorista",e.target.value)} placeholder="Nome do motorista..." style={S.inp}/>
            </div>
          </div>

          {/* Horários */}
          <div style={S.card}>
            <div style={{ fontSize:11, color:"#0ea5e9", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:12 }}>⏱️ Horários</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                ["Estacionou (Ext.)", "estacionou"],
                ["Chamado CCO",       "chamado"],
                ["Entrada Pátio",     "entradaPatio"],
                ["Saída Pátio",       "saidaPatio"],
              ].map(([label, key])=>(
                <div key={key}>
                  <label style={S.lbl}>{label}</label>
                  <div style={{ display:"flex", gap:5 }}>
                    <input type="time" value={form[key]} onChange={e=>setF(key,e.target.value)} style={{ ...S.inp, flex:1 }}/>
                    <button onClick={()=>setF(key, nowTime())}
                      style={{ ...S.btnSm, padding:"8px", fontSize:14, flexShrink:0 }}>⏱</button>
                  </div>
                </div>
              ))}
            </div>
            {form.entradaPatio && form.saidaPatio && (
              <div style={{ marginTop:10, background:"#001a2e", border:"1px solid #0ea5e922", borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:12 }}>⏳</span>
                <span style={{ fontSize:12, color:"#0ea5e9", fontWeight:700 }}>
                  Duração no pátio: {calcDuracao(form.entradaPatio, form.saidaPatio) || "--"}
                </span>
              </div>
            )}
          </div>

          <button onClick={transmitir} disabled={saving}
            style={{ ...S.btn, opacity:saving?0.7:1 }}>
            {saving ? "⟳ Transmitindo..." : "💾 Transmitir Registro ao CCO"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── LISTA DE REGISTROS
  if(screen==="list") {
    const regHoje = registros.filter(r=>r.data===todayStr());
    const regAnt  = registros.filter(r=>r.data!==todayStr());

    return (
      <div style={S.page}>
        <div style={S.wrap}>
          {/* Header */}
          <div style={{ position:"sticky", top:0, zIndex:10, background:"#04080f", borderBottom:"1px solid #0a0f1e", padding:"16px 16px 12px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={()=>{ setSelIds([]); setScreen("menu"); }} style={S.backBtn}>← Voltar</button>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:"#f1f5f9" }}>📋 Registros — P260A</div>
                <div style={{ fontSize:11, color:"#475569" }}>{registros.length} registro(s) · {selIds.length>0?`${selIds.length} selecionado(s)`:"selecione para consolidado"}</div>
              </div>
            </div>
          </div>

          <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>

            {/* Botões de ação */}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={gerarConsolidado}
                style={{ ...S.btn, flex:1, fontSize:13, background:"linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
                📊 {selIds.length>0?`Consolidado (${selIds.length})`:"Consolidado Geral"}
              </button>
              {selIds.length>0 && (
                <button onClick={()=>setSelIds([])} style={{ ...S.btnSm, padding:"10px 14px", fontSize:12, color:"#64748b" }}>
                  Limpar
                </button>
              )}
            </div>

            {registros.length === 0 && (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#334155" }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📭</div>
                <div style={{ fontSize:13 }}>Nenhum registro ainda</div>
              </div>
            )}

            {/* Hoje */}
            {regHoje.length > 0 && (
              <>
                <div style={{ fontSize:10, color:"#f59e0b", fontWeight:700, textTransform:"uppercase", letterSpacing:.8 }}>Hoje</div>
                {regHoje.map(r => <RegistroCard key={r.id} r={r} selIds={selIds} toggleSel={toggleSel} onExcluir={excluirRegistro}/>)}
              </>
            )}

            {/* Anteriores */}
            {regAnt.length > 0 && (
              <>
                <div style={{ fontSize:10, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginTop:4 }}>Anteriores</div>
                {regAnt.map(r => <RegistroCard key={r.id} r={r} selIds={selIds} toggleSel={toggleSel} onExcluir={excluirRegistro}/>)}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function RegistroCard({ r, selIds, toggleSel, onExcluir }) {
  const isSelected = selIds.includes(r.id);
  const dur = calcDuracao(r.entradaPatio, r.saidaPatio);
  const noPatioAgora = r.entradaPatio && !r.saidaPatio;

  return (
    <div style={{
      background:"#060c18",
      border:`2px solid ${isSelected?"#7c3aed66":noPatioAgora?"#f59e0b33":"#0f172a"}`,
      borderRadius:12, padding:"12px 14px",
      cursor:"pointer"
    }}
      onClick={()=>toggleSel(r.id)}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
        {/* Checkbox */}
        <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${isSelected?"#7c3aed":"#1e293b"}`, background:isSelected?"#7c3aed22":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", marginTop:2 }}>
          {isSelected && <span style={{ fontSize:12, color:"#a78bfa" }}>✓</span>}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontSize:13, fontWeight:800, color:"#f1f5f9" }}>{r.transportadora||"Transportadora"}</span>
            {r.placa && <span style={{ fontSize:11, color:"#0ea5e9", background:"#001a2e", padding:"2px 8px", borderRadius:5, fontWeight:700 }}>{r.placa}</span>}
            {noPatioAgora && <span style={{ fontSize:9, color:"#f59e0b", background:"#1a1000", padding:"2px 6px", borderRadius:4, fontWeight:700 }}>NO PÁTIO</span>}
          </div>
          {r.motorista && <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>👤 {r.motorista}</div>}
          <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
            <span style={{ fontSize:10, color:"#475569" }}>📅 {fmtDate(r.data)}</span>
            {r.entradaPatio && <span style={{ fontSize:10, color:"#22c55e" }}>↓ {r.entradaPatio}</span>}
            {r.saidaPatio   && <span style={{ fontSize:10, color:"#ef4444" }}>↑ {r.saidaPatio}</span>}
            {dur && <span style={{ fontSize:10, color:"#0ea5e9", fontWeight:700 }}>⏱ {dur}</span>}
          </div>
        </div>

        {/* Excluir */}
        <button onClick={e=>{e.stopPropagation();onExcluir(r.id);}}
          style={{ background:"transparent", border:"none", color:"#ef444444", fontSize:16, cursor:"pointer", padding:"2px 6px", flexShrink:0 }}>
          ✕
        </button>
      </div>
    </div>
  );
}
