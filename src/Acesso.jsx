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

function todayStr() { return new Date().toLocaleDateString("sv-SE"); } // AUD-005: data de negócio no fuso local (America/Sao_Paulo), não UTC
function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}
function fmtDate(d) {
  if(!d) return "--";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
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

// ── Gerar PDF de um único registro
function gerarPDFRegistro(r, projectId) {
  const dur = calcDuracao(r.entradaPatio, r.saidaPatio);
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Registro Acesso ${projectId}</title>
<style>
  body{font-family:'Segoe UI',sans-serif;margin:0;padding:24px;background:#f1f5f9;color:#1e293b}
  .header{background:linear-gradient(135deg,#1a1040,#0f0820);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:20px}
  .header h1{margin:0 0 4px;font-size:18px}
  .header p{margin:0;font-size:11px;opacity:.7}
  .card{background:#fff;border-radius:10px;padding:16px 20px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .card h2{margin:0 0 12px;font-size:13px;color:#475569;text-transform:uppercase;letter-spacing:.5px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .field label{font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;display:block;margin-bottom:3px}
  .field span{font-size:14px;font-weight:600;color:#0f172a}
  .dur{background:#e0f2fe;border-radius:8px;padding:10px 14px;text-align:center;color:#0369a1;font-weight:700;font-size:15px}
  .footer{text-align:center;font-size:10px;color:#94a3b8;margin-top:16px}
  @media print{body{padding:10px}}
</style>
</head>
<body>
<div class="header">
  <h1>🚛 Registro de Acesso — ${projectId}</h1>
  <p>Emitido em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</p>
</div>
<div class="card">
  <h2>📦 Dados da Carga</h2>
  <div class="grid">
    <div class="field"><label>Data</label><span>${fmtDate(r.data)}</span></div>
    <div class="field"><label>Placa do Veículo</label><span>${r.placa||"--"}</span></div>
    <div class="field"><label>Transportadora</label><span>${r.transportadora||"--"}</span></div>
    <div class="field"><label>Motorista</label><span>${r.motorista||"--"}</span></div>
  </div>
</div>
<div class="card">
  <h2>⏱️ Horários</h2>
  <div class="grid">
    <div class="field"><label>Estacionou (Ext.)</label><span>${r.estacionou||"--"}</span></div>
    <div class="field"><label>Chamado CCO</label><span>${r.chamado||"--"}</span></div>
    <div class="field"><label>Entrada Pátio</label><span>${r.entradaPatio||"--"}</span></div>
    <div class="field"><label>Saída Pátio</label><span>${r.saidaPatio||"--"}</span></div>
  </div>
  ${dur?`<div class="dur" style="margin-top:12px">⏳ Tempo no pátio: ${dur}</div>`:""}
</div>
<div class="footer">MokLog CheckTest © Moked Consulting Security · Controle de Acesso ${projectId}</div>
</body>
</html>`;
  const blob = new Blob([html], {type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `acesso_${projectId}_${r.data||todayStr()}_${r.placa||"reg"}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Gerar PDF consolidado de múltiplos registros
function gerarPDFConsolidado(lista, projectId) {
  const sorted = [...lista].sort((a,b)=>a.data.localeCompare(b.data));
  const rows = sorted.map((r,i) => {
    const dur = calcDuracao(r.entradaPatio, r.saidaPatio);
    return `<tr style="background:${i%2===0?"#f8fafc":"#ffffff"}">
      <td>${fmtDate(r.data)}</td>
      <td>${r.transportadora||"--"}</td>
      <td>${r.placa||"--"}</td>
      <td>${r.motorista||"--"}</td>
      <td>${r.estacionou||"--"}</td>
      <td>${r.chamado||"--"}</td>
      <td>${r.entradaPatio||"--"}</td>
      <td>${r.saidaPatio||"--"}</td>
      <td style="color:${dur?"#0369a1":"#94a3b8"};font-weight:${dur?"700":"400"}">${dur||"--"}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Consolidado Acesso ${projectId}</title>
<style>
  body{font-family:'Segoe UI',sans-serif;margin:0;padding:20px;background:#f1f5f9}
  .header{background:linear-gradient(135deg,#1a1040,#0f0820);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:16px}
  .header h1{margin:0 0 4px;font-size:18px}
  .header p{margin:0;font-size:11px;opacity:.7}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
  .kpi{background:#fff;border-radius:10px;padding:12px 14px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .kpi-val{font-size:24px;font-weight:900;color:#1d4ed8}
  .kpi-lbl{font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:2px}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);font-size:12px}
  th{background:#1e293b;color:#fff;padding:9px 10px;text-align:left;font-size:11px;font-weight:700}
  td{padding:8px 10px;border-bottom:1px solid #f1f5f9;color:#1e293b}
  .footer{text-align:center;margin-top:14px;font-size:10px;color:#94a3b8}
  @media print{body{padding:8px}}
</style>
</head>
<body>
<div class="header">
  <h1>🚛 Consolidado de Acessos — ${projectId}</h1>
  <p>Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} · ${sorted.length} registro(s)</p>
</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-val">${sorted.length}</div><div class="kpi-lbl">Total</div></div>
  <div class="kpi"><div class="kpi-val">${new Set(sorted.map(r=>r.transportadora).filter(Boolean)).size}</div><div class="kpi-lbl">Transportadoras</div></div>
  <div class="kpi"><div class="kpi-val">${sorted.filter(r=>r.saidaPatio).length}</div><div class="kpi-lbl">Saídas OK</div></div>
  <div class="kpi"><div class="kpi-val">${sorted.filter(r=>r.entradaPatio&&!r.saidaPatio).length}</div><div class="kpi-lbl">No Pátio</div></div>
</div>
<table>
  <thead>
    <tr><th>Data</th><th>Transportadora</th><th>Placa</th><th>Motorista</th><th>Estacionou</th><th>Chamado</th><th>Entrada</th><th>Saída</th><th>Duração</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">MokLog CheckTest © Moked Consulting Security</div>
</body>
</html>`;

  const blob = new Blob([html], {type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `consolidado_acesso_${projectId}_${todayStr()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── WhatsApp do registro
function enviarWhatsApp(r, projectId) {
  const dur = calcDuracao(r.entradaPatio, r.saidaPatio);
  const msg = encodeURIComponent(
    `*🚛 Registro de Acesso — ${projectId}*\n` +
    `📅 Data: ${fmtDate(r.data)}\n` +
    `🏢 Transportadora: ${r.transportadora||"--"}\n` +
    `🚗 Placa: ${r.placa||"--"}\n` +
    `👤 Motorista: ${r.motorista||"--"}\n\n` +
    `*⏱️ Horários:*\n` +
    `Estacionou: ${r.estacionou||"--"}\n` +
    `Chamado CCO: ${r.chamado||"--"}\n` +
    `Entrada Pátio: ${r.entradaPatio||"--"}\n` +
    `Saída Pátio: ${r.saidaPatio||"--"}\n` +
    (dur?`⏳ Tempo no pátio: ${dur}\n`:"")+
    `\n_MokLog CheckTest © Moked Security_`
  );
  window.open(`https://wa.me/?text=${msg}`, "_blank");
}


// ── Tela VER registro individual
function ViewRegistro({ r, onBack, onExcluir, dark, S }) {
  const dur = calcDuracao(r.entradaPatio, r.saidaPatio);
  const noPatioAgora = r.entradaPatio && !r.saidaPatio;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ position:"sticky", top:0, zIndex:10, ...S.headerBg, padding:"14px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onBack} style={S.backBtn}>← Voltar</button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"#f59e0b" }}>🚛 Registro — P260A</div>
              <div style={{ fontSize:11, color:"#475569" }}>{fmtDate(r.data)}</div>
            </div>
            {noPatioAgora && (
              <span style={{ fontSize:10, color:"#f59e0b", background:"#1a1000", border:"1px solid #f59e0b33", padding:"3px 8px", borderRadius:5, fontWeight:700 }}>NO PÁTIO</span>
            )}
          </div>
        </div>

        <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
          {/* Dados da carga */}
          <div style={S.card}>
            <div style={{ fontSize:11, color:"#f59e0b", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:12 }}>📦 Dados da Carga</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {[
                ["Data",          fmtDate(r.data)],
                ["Placa",         r.placa||"--"],
                ["Transportadora",r.transportadora||"--"],
                ["Motorista",     r.motorista||"--"],
              ].map(([label,val])=>(
                <div key={label}>
                  <div style={S.lbl}>{label}</div>
                  <div style={{ fontSize:14, color:"#f1f5f9", fontWeight:600 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Horários */}
          <div style={S.card}>
            <div style={{ fontSize:11, color:"#0ea5e9", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:12 }}>⏱️ Horários</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {[
                ["Estacionou (Ext.)", r.estacionou||"--"],
                ["Chamado CCO",       r.chamado||"--"],
                ["Entrada Pátio",     r.entradaPatio||"--"],
                ["Saída Pátio",       r.saidaPatio||"--"],
              ].map(([label,val])=>(
                <div key={label}>
                  <div style={S.lbl}>{label}</div>
                  <div style={{ fontSize:14, color: label.includes("Entrada")?"#22c55e":label.includes("Saída")?"#ef4444":"#f1f5f9", fontWeight:700 }}>{val}</div>
                </div>
              ))}
            </div>
            {dur && (
              <div style={{ marginTop:12, background:"#001a2e", border:"1px solid #0ea5e922", borderRadius:8, padding:"10px 14px", textAlign:"center" }}>
                <span style={{ fontSize:15, color:"#0ea5e9", fontWeight:800 }}>⏳ Tempo no pátio: {dur}</span>
              </div>
            )}
          </div>

          {/* Ações */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <button onClick={()=>gerarPDFRegistro(r,"P260A")}
              style={{ ...S.btnPurple, fontSize:13 }}>📄 PDF</button>
            <button onClick={()=>enviarWhatsApp(r,"P260A")}
              style={{ ...S.btn, fontSize:13 }}>💬 WhatsApp</button>
          </div>

          <button onClick={()=>{ if(window.confirm("Excluir este registro?")) onExcluir(r.id); }}
            style={{ ...S.btnSec, color:"#ef4444", borderColor:"#ef444433", fontSize:13 }}>
            🗑 Excluir Registro
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AcessoApp({ onBack, initialScreen, dark: darkProp, onToggleTheme }) {
  const projectId = "P260A";
  const [darkLocal, setDarkLocal] = useState(true);
  const dark = darkProp !== undefined ? darkProp : darkLocal;
  const toggleDark = onToggleTheme || (()=>setDarkLocal(!darkLocal));
  const S = {
    page:    { minHeight:"100vh", background:dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 80px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:520, padding:"0", display:"flex", flexDirection:"column" },
    card:    { background:dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"16px" },
    btn:     { background:"linear-gradient(135deg,#16a34a,#15803d)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnBlue: { background:"linear-gradient(135deg,#1d4ed8,#1e40af)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnPurple:{ background:"linear-gradient(135deg,#7c3aed,#6d28d9)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnSec:  { background:dark?"#060c18":"#f8fafc", color:dark?"#64748b":"#475569", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
    btnSm:   { background:dark?"#020510":"#f8fafc", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#64748b":"#475569", borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:600 },
    backBtn: { background:"transparent", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#94a3b8":"#64748b", borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 },
    inp:     { width:"100%", background:dark?"#020510":"#ffffff", border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`, borderRadius:7, color:dark?"#e2e8f0":"#1e293b", padding:"10px 12px", fontSize:13, boxSizing:"border-box", outline:"none" },
    lbl:     { display:"block", fontSize:10, color:dark?"#475569":"#64748b", fontWeight:700, marginBottom:5, textTransform:"uppercase", letterSpacing:.5 },
    headerBg:{ background:dark?"#04080f":"#f8fafc", borderBottom:`1px solid ${dark?"#0a0f1e":"#e2e8f0"}` },
    txtPrimary: { color:dark?"#f1f5f9":"#0f172a" },
    txtSec:  { color:dark?"#475569":"#64748b" },
  };
  const [screen, setScreen] = useState(initialScreen || "menu");
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selIds, setSelIds] = useState([]);
  const [viewReg, setViewReg] = useState(null);

  const emptyForm = () => ({
    id: crypto.randomUUID(),
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
    // Envia WhatsApp
    enviarWhatsApp(novoRegistro, projectId);
    setForm(emptyForm());
    setScreen("menu");
  };

  const excluirRegistro = async (id) => {
    const newList = registros.filter(r=>r.id!==id);
    setRegistros(newList);
    await saveRegistros(projectId, newList);
    setSelIds(prev=>prev.filter(s=>s!==id));
    if(viewReg?.id===id) { setViewReg(null); setScreen("list"); }
  };

  const toggleSel = (id) => setSelIds(prev=>prev.includes(id)?prev.filter(s=>s!==id):[...prev,id]);
  const selecionarTodos = () => setSelIds(registros.map(r=>r.id));
  const limparSel = () => setSelIds([]);

  const gerarConsolidado = () => {
    const lista = selIds.length>0 ? registros.filter(r=>selIds.includes(r.id)) : registros;
    if(!lista.length) { alert("Nenhum registro para gerar"); return; }
    gerarPDFConsolidado(lista, projectId);
  };

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:30,marginBottom:10}}>🚛</div>
        <div style={{fontSize:13,color:"#64748b"}}>Carregando registros...</div>
      </div>
    </div>
  );

  // ── VER registro individual
  if(screen==="view"&&viewReg) return (
    <ViewRegistro r={viewReg} dark={dark} S={S}
      onBack={()=>{ setViewReg(null); setScreen("list"); }}
      onExcluir={excluirRegistro}/>
  );

  // ── MENU
  if(screen==="menu") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ position:"sticky", top:0, zIndex:10, ...S.headerBg, padding:"14px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onBack} style={S.backBtn}>← Menu Jatinox</button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:dark?"#f1f5f9":"#0f172a" }}>🚛 Acesso — P260A</div>
              <div style={{ fontSize:11, color:"#475569" }}>Controle de Transportadoras</div>
            </div>
            <button onClick={toggleDark} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,color:dark?"#94a3b8":"#475569"}}>{dark?"☀️":"🌙"}</button>
          </div>
        </div>

        <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div style={{ ...S.card, textAlign:"center" }}>
              <div style={{ fontSize:28, fontWeight:900, color:"#f59e0b" }}>{registros.length}</div>
              <div style={{ fontSize:10, color:"#64748b", fontWeight:700 }}>TOTAL REGISTROS</div>
            </div>
            <div style={{ ...S.card, textAlign:"center" }}>
              <div style={{ fontSize:28, fontWeight:900, color:"#22c55e" }}>{registros.filter(r=>r.data===todayStr()).length}</div>
              <div style={{ fontSize:10, color:"#64748b", fontWeight:700 }}>HOJE</div>
            </div>
          </div>

          <button onClick={()=>{ setForm(emptyForm()); setScreen("form"); }} style={S.btn}>
            🚛 Novo Registro de Acesso
          </button>

          <button onClick={()=>{ setSelIds([]); setScreen("list"); }}
            style={{ ...S.btnSec, color:"#0ea5e9", borderColor:"#0ea5e922", fontSize:13 }}>
            📋 Ver Registros ({registros.length})
          </button>
        </div>
      </div>
    </div>
  );

  // ── FORMULÁRIO
  if(screen==="form") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ position:"sticky", top:0, zIndex:10, ...S.headerBg, padding:"14px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={()=>setScreen("menu")} style={S.backBtn}>← Voltar</button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"#f59e0b" }}>🚛 Novo Registro</div>
              <div style={{ fontSize:11, color:"#475569" }}>Controle de Fluxo — P260A</div>
            </div>
          </div>
        </div>

        <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:12 }}>
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

          <div style={S.card}>
            <div style={{ fontSize:11, color:"#0ea5e9", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:12 }}>⏱️ Horários</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                ["Estacionou (Ext.)","estacionou"],
                ["Chamado CCO",      "chamado"],
                ["Entrada Pátio",    "entradaPatio"],
                ["Saída Pátio",      "saidaPatio"],
              ].map(([label,key])=>(
                <div key={key}>
                  <label style={S.lbl}>{label}</label>
                  <div style={{ display:"flex", gap:5 }}>
                    <input type="time" value={form[key]} onChange={e=>setF(key,e.target.value)} style={{ ...S.inp, flex:1 }}/>
                    <button onClick={()=>setF(key,nowTime())} style={{ ...S.btnSm, padding:"8px 10px", fontSize:14, flexShrink:0 }}>⏱</button>
                  </div>
                </div>
              ))}
            </div>
            {form.entradaPatio && form.saidaPatio && (
              <div style={{ marginTop:10, background:"#001a2e", border:"1px solid #0ea5e922", borderRadius:8, padding:"8px 12px" }}>
                <span style={{ fontSize:12, color:"#0ea5e9", fontWeight:700 }}>
                  ⏳ Duração: {calcDuracao(form.entradaPatio, form.saidaPatio)||"--"}
                </span>
              </div>
            )}
          </div>

          <button onClick={transmitir} disabled={saving} style={{ ...S.btn, opacity:saving?0.7:1 }}>
            {saving?"⟳ Transmitindo...":"💾 Salvar e Enviar WhatsApp"}
          </button>
          <div style={{ fontSize:10, color:"#334155", textAlign:"center" }}>
            Salva o registro e abre WhatsApp com o resumo
          </div>
        </div>
      </div>
    </div>
  );

  // ── LISTA
  if(screen==="list") {
    const regHoje = registros.filter(r=>r.data===todayStr());
    const regAnt  = registros.filter(r=>r.data!==todayStr());
    const todosSel = registros.length>0 && selIds.length===registros.length;

    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={{ position:"sticky", top:0, zIndex:10, ...S.headerBg, padding:"14px 16px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={()=>{ setSelIds([]); setScreen("menu"); }} style={S.backBtn}>← Voltar</button>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:"#f1f5f9" }}>📋 Registros — P260A</div>
                <div style={{ fontSize:11, color:"#475569" }}>
                  {registros.length} registro(s) {selIds.length>0?`· ${selIds.length} selecionado(s)`:""}
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>

            {/* Ações consolidado */}
            {registros.length > 0 && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <button onClick={todosSel?limparSel:selecionarTodos}
                  style={{ ...S.btnSm, padding:"8px 14px", fontSize:12, color:"#0ea5e9", border:"1px solid #0ea5e944", flex:1 }}>
                  {todosSel?"✓ Desmarcar todos":"☐ Selecionar todos"}
                </button>
                <button onClick={gerarConsolidado}
                  style={{ ...S.btnPurple, flex:2, fontSize:13, padding:"9px 14px" }}>
                  📊 {selIds.length>0?`PDF Consolidado (${selIds.length})`:"PDF Consolidado Geral"}
                </button>
              </div>
            )}

            {registros.length===0 && (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#334155" }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📭</div>
                <div style={{ fontSize:13 }}>Nenhum registro ainda</div>
              </div>
            )}

            {regHoje.length>0 && (
              <>
                <div style={{ fontSize:10, color:"#f59e0b", fontWeight:700, textTransform:"uppercase", letterSpacing:.8 }}>Hoje</div>
                {regHoje.map(r=>(
                  <RegistroCard key={r.id} r={r} selIds={selIds} toggleSel={toggleSel} dark={dark}
                    onVer={()=>{ setViewReg(r); setScreen("view"); }}/>
                ))}
              </>
            )}

            {regAnt.length>0 && (
              <>
                <div style={{ fontSize:10, color:"#475569", fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginTop:4 }}>Anteriores</div>
                {regAnt.map(r=>(
                  <RegistroCard key={r.id} r={r} selIds={selIds} toggleSel={toggleSel} dark={dark}
                    onVer={()=>{ setViewReg(r); setScreen("view"); }}/>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function RegistroCard({ r, selIds, toggleSel, onVer, dark }) {
  const isSelected = selIds.includes(r.id);
  const dur = calcDuracao(r.entradaPatio, r.saidaPatio);
  const noPatioAgora = r.entradaPatio && !r.saidaPatio;

  return (
    <div style={{
      background:dark?"#060c18":"#ffffff",
      border:`2px solid ${isSelected?"#7c3aed66":noPatioAgora?"#f59e0b33":dark?"#0f172a":"#e2e8f0"}`,
      borderRadius:12, padding:"12px 14px"
    }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
        {/* Checkbox */}
        <div onClick={()=>toggleSel(r.id)} style={{ width:22, height:22, borderRadius:6, border:`2px solid ${isSelected?"#7c3aed":"#1e293b"}`, background:isSelected?"#7c3aed22":"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", marginTop:2, cursor:"pointer" }}>
          {isSelected && <span style={{ fontSize:12, color:"#a78bfa" }}>✓</span>}
        </div>

        {/* Info */}
        <div style={{ flex:1, minWidth:0 }} onClick={()=>toggleSel(r.id)} >
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontSize:13, fontWeight:800, color:"#f1f5f9" }}>{r.transportadora||"Sem transportadora"}</span>
            {r.placa && <span style={{ fontSize:11, color:"#0ea5e9", background:"#001a2e", padding:"2px 8px", borderRadius:5, fontWeight:700 }}>{r.placa}</span>}
            {noPatioAgora && <span style={{ fontSize:9, color:"#f59e0b", background:"#1a1000", padding:"2px 6px", borderRadius:4, fontWeight:700 }}>NO PÁTIO</span>}
          </div>
          {r.motorista && <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>👤 {r.motorista}</div>}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:10, color:"#475569" }}>📅 {fmtDate(r.data)}</span>
            {r.entradaPatio && <span style={{ fontSize:10, color:"#22c55e" }}>↓ {r.entradaPatio}</span>}
            {r.saidaPatio   && <span style={{ fontSize:10, color:"#ef4444" }}>↑ {r.saidaPatio}</span>}
            {dur && <span style={{ fontSize:10, color:"#0ea5e9", fontWeight:700 }}>⏱ {dur}</span>}
          </div>
        </div>

        {/* Botão VER */}
        <button onClick={onVer}
          style={{ background:"#0f172a", border:"1px solid #1e293b", color:"#94a3b8", borderRadius:7, padding:"6px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 }}>
          👁 Ver
        </button>
      </div>
    </div>
  );
}
