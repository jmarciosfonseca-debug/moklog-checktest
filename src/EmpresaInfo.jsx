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

// ── Projetos COM aba CCO. Nestes, as visitas de SEGURANÇA são registradas
// na aba CCO → Supervisão (fonte única). Aqui o histórico fica somente-leitura
// e o lançamento é redirecionado ao CCO. P260B/P260C NÃO têm CCO: para eles,
// o histórico de visitas continua funcionando normalmente nesta tela.
const PROJETOS_COM_CCO = ["P601","P602","P604","P605","P606","P607","P311A","P311B","P505","P260A"];
function temCCO(pid){ return PROJETOS_COM_CCO.includes(pid); }

function todayStr() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d) {
  if(!d) return "--";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}
function daysSince(d) {
  if(!d) return null;
  try { return Math.floor((Date.now()-new Date(d+"T12:00:00").getTime())/86400000); } catch { return null; }
}
const VISITA_ALERTA_DIAS = 15;

async function loadInfo(projectId) {
  try {
    const snap = await getDoc(doc(db,"empresa_info",projectId));
    if(snap.exists()) {
      const data = snap.data();
      try { localStorage.setItem(`empresa_info_${projectId}`, JSON.stringify(data)); } catch(e){}
      return data;
    }
  } catch(e){}
  try {
    const local = localStorage.getItem(`empresa_info_${projectId}`);
    if(local) return JSON.parse(local);
  } catch(e){}
  return {
    seguranca: { nome:"", gerente:"", supervisor:"", visitas:[] },
    manutencao: { nome:"", visitas:[] },
    adm: [{ nome:"", cargo:"" }, { nome:"", cargo:"" }, { nome:"", cargo:"" }]
  };
}

async function saveInfo(projectId, data) {
  try { await setDoc(doc(db,"empresa_info",projectId), data); } catch(e){ console.error(e); }
  try { localStorage.setItem(`empresa_info_${projectId}`, JSON.stringify(data)); } catch(e){}
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
    addBtn:  { background:"transparent", border:`1px dashed ${dark?"#1e293b":"#cbd5e1"}`, color:dark?"#475569":"#64748b", borderRadius:8, padding:"8px 14px", fontSize:12, cursor:"pointer", width:"100%", marginTop:6 },
  };
}


// ── Gerar PDF de informações da empresa
function gerarPDFEmpresa(project, info, dark) {
  const seg = info?.seguranca || {};
  const manut = info?.manutencao || {};
  const adm = info?.adm || [];
  const hoje = new Date().toLocaleDateString("pt-BR");
  const fmtD = (d) => { if(!d) return "--"; try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; } };

  const visitasSeg = (seg.visitas||[]).slice(0,10).map(v=>`
    <tr>
      <td>${fmtD(v.data)}</td>
      <td>${v.turno||"--"}</td>
      <td>${v.resumo||"--"}</td>
    </tr>`).join("");

  const visitasManut = (manut.visitas||[]).slice(0,10).map(v=>`
    <tr>
      <td>${fmtD(v.data)}</td>
      <td>${v.tecnico||"--"}</td>
      <td>${v.resumo||"--"}</td>
    </tr>`).join("");

  const admRows = adm.filter(m=>m.nome).map(m=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8fafc;border-radius:8px;margin-bottom:6px;">
      <div>👔</div>
      <div><div style="font-weight:700;color:#0f172a">${m.nome}</div><div style="font-size:12px;color:#64748b">${m.cargo||"—"}</div></div>
    </div>`).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Informações — ${project.id}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px;color:#1e293b;margin:0}
  .header{background:linear-gradient(135deg,#1a1040,#0f0820);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px}
  .card h2{margin:0 0 12px;font-size:13px;color:#475569;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #f1f5f9;padding-bottom:8px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
  td{padding:7px 10px;border-bottom:1px solid #f1f5f9}
  tr:nth-child(even) td{background:#f8fafc}
  .alert{background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:8px 12px;color:#dc2626;font-size:12px;margin-bottom:10px}
  .ok{background:#dcfce7;border:1px solid #86efac;border-radius:8px;padding:8px 12px;color:#15803d;font-size:12px;margin-bottom:10px}
  .footer{text-align:center;font-size:10px;color:#94a3b8;margin-top:16px}
  @media print{body{padding:8px}@page{margin:12mm}}
</style>
</head>
<body>
<div class="no-print" style="text-align:center;margin-bottom:16px">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="header">
  <div>
    <div style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.5px">Moked Consulting Security</div>
    <div style="font-size:20px;font-weight:900">Informações do Projeto</div>
    <div style="font-size:13px;opacity:.8">${project.id} — ${project.name||""}</div>
  </div>
  <div style="font-size:11px;opacity:.7">Emitido em ${hoje}</div>
</div>

<div class="card">
  <h2>🏢 Empresa de Segurança</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
    <div><div style="font-size:10px;color:#94a3b8;font-weight:700">EMPRESA</div><div style="font-weight:700">${seg.nome||"—"}</div></div>
    <div><div style="font-size:10px;color:#94a3b8;font-weight:700">GERENTE</div><div style="font-weight:700">${seg.gerente||"—"}</div></div>
    <div><div style="font-size:10px;color:#94a3b8;font-weight:700">SUPERVISOR</div><div style="font-weight:700">${seg.supervisor||"—"}</div></div>
  </div>
  ${(()=>{
    const visitas=seg.visitas||[];
    const ultima=visitas[0];
    const dias=ultima?Math.floor((Date.now()-new Date(ultima.data+"T12:00:00").getTime())/86400000):null;
    if(!ultima) return '<div class="alert">⚠️ Nenhuma visita registrada</div>';
    if(dias>=15) return `<div class="alert">🔴 Visita em atraso — ${dias} dias sem visita do supervisor</div>`;
    return `<div class="ok">✅ Última visita há ${dias} dia(s) — dentro do prazo</div>`;
  })()}
  ${visitasSeg ? `<table><thead><tr><th>Data</th><th>Turno</th><th>Resumo</th></tr></thead><tbody>${visitasSeg}</tbody></table>` : "<div style='font-size:12px;color:#94a3b8'>Nenhuma visita registrada</div>"}
</div>

<div class="card">
  <h2>🔧 Empresa de Manutenção</h2>
  <div style="margin-bottom:10px"><div style="font-size:10px;color:#94a3b8;font-weight:700">EMPRESA</div><div style="font-weight:700">${manut.nome||"—"}</div></div>
  ${visitasManut ? `<table><thead><tr><th>Data</th><th>Técnico</th><th>Resumo</th></tr></thead><tbody>${visitasManut}</tbody></table>` : "<div style='font-size:12px;color:#94a3b8'>Nenhuma visita registrada</div>"}
</div>

<div class="card">
  <h2>👔 ADM</h2>
  ${admRows || "<div style='font-size:12px;color:#94a3b8'>Nenhum membro cadastrado</div>"}
</div>

<div class="footer">MokLog CheckTest © Moked Consulting Security · ${project.id} · ${hoje}</div>
</body></html>`;

  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`info_${project.id}_${new Date().toISOString().split("T")[0]}.html`;
  a.click(); URL.revokeObjectURL(url);
}

// ── PIN Gate
function PinGate({ project, onSuccess, onBack, dark }) {
  const S = getStyles(dark);
  const [mode, setMode] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);

  const tryPin = () => {
    if(pin === ADMIN_PIN) { onSuccess("admin"); return; }
    if(pin === PROJECT_PINS[project.id]) { onSuccess("lider"); return; }
    setErr(true);
  };

  return (
    <div style={{...S.page, alignItems:"center", justifyContent:"center"}}>
      <div style={{...S.card, maxWidth:320, width:"100%", margin:16, textAlign:"center"}}>
        <div style={{fontSize:32, marginBottom:8}}>🏢</div>
        <div style={{fontSize:16, fontWeight:800, ...S.txt, marginBottom:4}}>Informações do Projeto</div>
        <div style={{fontSize:12, ...S.txt2, marginBottom:20}}>{project.id} · {project.name}</div>
        {!mode ? (
          <div style={{display:"flex", flexDirection:"column", gap:8}}>
            <button onClick={()=>setMode("lider")} style={{...S.btn, background:"linear-gradient(135deg,#0369a1,#0c4a6e)", fontSize:13}}>
              👷 Acesso Líder
            </button>
            <button onClick={()=>setMode("admin")} style={{...S.btnSec, fontSize:13, color:"#f59e0b", borderColor:"#f59e0b33"}}>
              🔐 Acesso Gerencial
            </button>
            <button onClick={onBack} style={{...S.btnSec, fontSize:13, marginTop:4}}>← Voltar</button>
          </div>
        ) : (
          <>
            <div style={{fontSize:12, ...S.txt2, marginBottom:12}}>{mode==="lider"?"PIN do projeto":"PIN gerencial"}</div>
            <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pin}
              onChange={e=>{setPin(e.target.value);setErr(false);}}
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

// ── Seção Empresa de Segurança
// PROPS: + ccoMode (bool) — quando true, o histórico de visitas é somente-leitura
//          e o lançamento é redirecionado à aba CCO → Supervisão (fonte única).
function SecSeguranca({ data, onSave, adminAuth, dark, ccoMode }) {
  const S = getStyles(dark);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({...data});
  const [showAddVisita, setShowAddVisita] = useState(false);
  const [novaVisita, setNovaVisita] = useState({ data:todayStr(), turno:"", resumo:"" });
  const [filtroTurno, setFiltroTurno] = useState("todos");

  const saveEdit = () => {
    onSave(form);
    setEditing(false);
  };

  const addVisita = () => {
    if(!novaVisita.turno) { alert("Selecione o turno (Diurno ou Noturno)"); return; }
    if(!novaVisita.resumo.trim()) { alert("Informe o resumo da visita"); return; }
    const updated = { ...form, visitas: [{ id:Date.now().toString(), ...novaVisita }, ...(form.visitas||[])] };
    setForm(updated);
    onSave(updated);
    setNovaVisita({ data:todayStr(), turno:"", resumo:"" });
    setShowAddVisita(false);
  };

  const removeVisita = (id) => {
    const updated = { ...form, visitas: (form.visitas||[]).filter(v=>v.id!==id) };
    setForm(updated);
    onSave(updated);
  };

  return (
    <div style={{display:"flex", flexDirection:"column", gap:8}}>
      {/* Header */}
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <div style={{fontSize:13, fontWeight:700, color:"#0ea5e9"}}>🏢 Empresa de Segurança</div>
        {adminAuth && !editing && (
          <button onClick={()=>setEditing(true)} style={{...S.btnSm, color:"#f59e0b", border:"1px solid #f59e0b44", fontSize:10}}>✏️ Editar</button>
        )}
      </div>

      {editing ? (
        <div style={{...S.card, display:"flex", flexDirection:"column", gap:10}}>
          {[["Nome da Empresa","nome"],["Gerente Responsável","gerente"],["Supervisor","supervisor"]].map(([label,key])=>(
            <div key={key}>
              <label style={S.lbl}>{label}</label>
              <input value={form[key]||""} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={label+"..."} style={S.inp}/>
            </div>
          ))}
          <div style={{display:"flex", gap:8}}>
            <button onClick={()=>setEditing(false)} style={{...S.btnSec, flex:1, fontSize:13}}>Cancelar</button>
            <button onClick={saveEdit} style={{...S.btn, flex:1, fontSize:13}}>✓ Salvar</button>
          </div>
        </div>
      ) : (
        <div style={S.card}>
          {[["Empresa", data.nome], ["Gerente", data.gerente], ["Supervisor", data.supervisor]].map(([label,val])=>(
            <div key={label} style={{marginBottom:8}}>
              <div style={S.lbl}>{label}</div>
              <div style={{fontSize:13, fontWeight:600, ...S.txt}}>{val||"—"}</div>
            </div>
          ))}
        </div>
      )}

      {/* Histórico Visitas */}
      <div style={{...S.card}}>
        {/* Aviso de fonte única quando o projeto tem aba CCO */}
        {ccoMode && (
          <div style={{background:dark?"#001a2e":"#e0f2fe",border:"1px solid #0ea5e933",borderRadius:8,padding:"8px 12px",marginBottom:8}}>
            <div style={{fontSize:11,color:dark?"#7dd3fc":"#0369a1",fontWeight:700}}>ℹ️ Visitas de supervisão agora ficam no CCO</div>
            <div style={{fontSize:10,...S.txt2,marginTop:2}}>Para registrar uma nova visita do supervisor, use a aba <strong>🚪 CCO → 👁️ Supervisão</strong>. O histórico abaixo é mantido para consulta.</div>
          </div>
        )}
        {/* Contador dias desde última visita supervisor */}
        {(()=>{
          const visitas = data.visitas||[];
          const ultima = visitas.length ? visitas[0] : null;
          const dias = ultima ? daysSince(ultima.data) : null;
          const atrasado = dias !== null && dias >= VISITA_ALERTA_DIAS;
          const semVisita = !ultima;
          if(atrasado || semVisita) return (
            <div style={{background:"#1a0202",border:"1px solid #ef444444",borderRadius:8,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16}}>🔴</span>
              <div>
                <div style={{fontSize:11,color:"#ef4444",fontWeight:700}}>
                  {semVisita?"Nenhuma visita registrada":`Visita em atraso — ${dias} dias sem visita`}
                </div>
                <div style={{fontSize:10,color:"#64748b"}}>Frequência esperada: a cada {VISITA_ALERTA_DIAS} dias</div>
              </div>
            </div>
          );
          return (
            <div style={{background:"#021a0d",border:"1px solid #22c55e33",borderRadius:8,padding:"8px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16}}>✅</span>
              <div>
                <div style={{fontSize:11,color:"#22c55e",fontWeight:700}}>Última visita há {dias} dia(s)</div>
                <div style={{fontSize:10,color:"#64748b"}}>Próxima em até {VISITA_ALERTA_DIAS-dias} dia(s)</div>
              </div>
            </div>
          );
        })()}
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10}}>
          <div style={{fontSize:12, fontWeight:700, ...S.txt}}>📋 Histórico de Visitas <span style={{fontSize:11, ...S.txt2}}>({(data.visitas||[]).length})</span></div>
          {/* Em projetos com CCO, o lançamento é feito no CCO. Sem botão +Visita aqui. */}
          {!ccoMode && (
            <button onClick={()=>setShowAddVisita(!showAddVisita)}
              style={{...S.btnSm, color:"#0ea5e9", border:"1px solid #0ea5e944", fontSize:10}}>+ Visita</button>
          )}
        </div>

        <div style={{display:"flex", gap:6, marginBottom:10}}>
          {[["todos","Geral"],["Diurno","☀️ Diurno"],["Noturno","🌙 Noturno"]].map(([key,label])=>(
            <button key={key} onClick={()=>setFiltroTurno(key)}
              style={{flex:1, padding:"6px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer",
                border:`1px solid ${filtroTurno===key?"#0ea5e9":(dark?"#0f172a":"#e2e8f0")}`,
                background:filtroTurno===key?"#0ea5e922":(dark?"#020510":"#fff"),
                color:filtroTurno===key?"#0ea5e9":(dark?"#64748b":"#94a3b8")}}>
              {label}
            </button>
          ))}
        </div>

        {!ccoMode && showAddVisita && (
          <div style={{background:dark?"#020510":"#f8fafc", borderRadius:8, padding:"10px 12px", marginBottom:10, border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8}}>
              <div>
                <label style={S.lbl}>Data</label>
                <input type="date" value={novaVisita.data} onChange={e=>setNovaVisita(v=>({...v,data:e.target.value}))} style={S.inp}/>
              </div>
            </div>
            <div style={{marginBottom:8}}>
              <label style={S.lbl}>Turno</label>
              <div style={{display:"flex", gap:8}}>
                {[["Diurno","☀️"],["Noturno","🌙"]].map(([t,icon])=>(
                  <button key={t} onClick={()=>setNovaVisita(v=>({...v,turno:t}))}
                    style={{flex:1, padding:"10px", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer",
                      border:`1px solid ${novaVisita.turno===t?(t==="Diurno"?"#f59e0b":"#6366f1"):(dark?"#0f172a":"#e2e8f0")}`,
                      background:novaVisita.turno===t?(t==="Diurno"?"#f59e0b22":"#6366f122"):(dark?"#020510":"#fff"),
                      color:novaVisita.turno===t?(t==="Diurno"?"#f59e0b":"#818cf8"):(dark?"#64748b":"#94a3b8")}}>
                    {icon} {t}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:8}}>
              <label style={S.lbl}>Resumo da Visita</label>
              <textarea value={novaVisita.resumo} onChange={e=>setNovaVisita(v=>({...v,resumo:e.target.value}))} placeholder="Descreva o que foi tratado na visita..." style={{...S.inp,height:60,resize:"vertical",fontSize:12}}/>
            </div>
            <div style={{display:"flex", gap:8}}>
              <button onClick={()=>setShowAddVisita(false)} style={{...S.btnSec, flex:1, fontSize:12}}>Cancelar</button>
              <button onClick={addVisita} style={{...S.btn, flex:1, fontSize:12}}>✓ Adicionar</button>
            </div>
          </div>
        )}

        {(data.visitas||[]).length===0 && !showAddVisita && (
          <div style={{textAlign:"center", padding:"14px 0", fontSize:12, ...S.txt2}}>Nenhuma visita registrada</div>
        )}

        <div style={{display:"flex", flexDirection:"column", gap:6}}>
          {(data.visitas||[]).filter(v=>filtroTurno==="todos"||v.turno===filtroTurno).map(v=>(
            <div key={v.id} style={{background:dark?"#020510":"#f8fafc", borderRadius:8, padding:"10px 12px", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}>
              <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4}}>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <span style={{fontSize:11, color:"#0ea5e9", fontWeight:700}}>📅 {fmtDate(v.data)}</span>
                  {v.turno && (
                    <span style={{fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:5,
                      background:v.turno==="Diurno"?"#f59e0b22":"#6366f122",
                      color:v.turno==="Diurno"?"#f59e0b":"#818cf8"}}>
                      {v.turno==="Diurno"?"☀️":"🌙"} {v.turno}
                    </span>
                  )}
                </div>
                {/* Remoção de visita só fora do modo CCO (no CCO, gerencie pela aba Supervisão) */}
                {adminAuth && !ccoMode && <button onClick={()=>removeVisita(v.id)} style={{background:"transparent", border:"none", color:"#ef444466", fontSize:14, cursor:"pointer"}}>✕</button>}
              </div>
              <div style={{fontSize:12, ...S.txt}}>{v.resumo}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Seção Empresa de Manutenção
// PROPS: + ccoMode (bool) — quando true, o histórico é somente-leitura e o
//          lançamento é redirecionado à aba CCO → Manutenção (fonte única).
function SecManutencao({ data, onSave, adminAuth, dark, ccoMode }) {
  const S = getStyles(dark);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({...data});
  const [showAdd, setShowAdd] = useState(false);
  const [novaVisita, setNovaVisita] = useState({ data:todayStr(), tecnico:"", resumo:"" });

  const saveEdit = () => { onSave(form); setEditing(false); };

  const addVisita = () => {
    if(!novaVisita.resumo.trim()) { alert("Informe o resumo"); return; }
    const updated = { ...form, visitas: [{ id:Date.now().toString(), ...novaVisita }, ...(form.visitas||[])] };
    setForm(updated); onSave(updated);
    setNovaVisita({ data:todayStr(), tecnico:"", resumo:"" });
    setShowAdd(false);
  };

  const removeVisita = (id) => {
    const updated = { ...form, visitas: (form.visitas||[]).filter(v=>v.id!==id) };
    setForm(updated); onSave(updated);
  };

  return (
    <div style={{display:"flex", flexDirection:"column", gap:8}}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <div style={{fontSize:13, fontWeight:700, color:"#f59e0b"}}>🔧 Empresa de Manutenção</div>
        {adminAuth && !editing && (
          <button onClick={()=>setEditing(true)} style={{...S.btnSm, color:"#f59e0b", border:"1px solid #f59e0b44", fontSize:10}}>✏️ Editar</button>
        )}
      </div>

      {editing ? (
        <div style={{...S.card, display:"flex", flexDirection:"column", gap:10}}>
          <div>
            <label style={S.lbl}>Nome da Empresa</label>
            <input value={form.nome||""} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Nome da empresa..." style={S.inp}/>
          </div>
          <div style={{display:"flex", gap:8}}>
            <button onClick={()=>setEditing(false)} style={{...S.btnSec, flex:1, fontSize:13}}>Cancelar</button>
            <button onClick={saveEdit} style={{...S.btn, flex:1, fontSize:13}}>✓ Salvar</button>
          </div>
        </div>
      ) : (
        <div style={S.card}>
          <div style={S.lbl}>Empresa</div>
          <div style={{fontSize:13, fontWeight:600, ...S.txt}}>{data.nome||"—"}</div>
        </div>
      )}

      {/* Histórico */}
      <div style={S.card}>
        {/* Aviso de fonte única quando o projeto tem aba CCO */}
        {ccoMode && (
          <div style={{background:dark?"#1a1000":"#fffbeb",border:"1px solid #f59e0b44",borderRadius:8,padding:"8px 12px",marginBottom:8}}>
            <div style={{fontSize:11,color:"#f59e0b",fontWeight:700}}>ℹ️ Manutenção agora fica no CCO</div>
            <div style={{fontSize:10,...S.txt2,marginTop:2}}>Para registrar uma nova visita de manutenção, use a aba <strong>🚪 CCO → 🛠️ Manutenção</strong>. O histórico abaixo é mantido para consulta.</div>
          </div>
        )}
        {/* Contador dias desde última visita manutenção */}
        {(()=>{
          const visitas = data.visitas||[];
          const ultima = visitas.length ? visitas[0] : null;
          const dias = ultima ? daysSince(ultima.data) : null;
          if(!ultima) return (
            <div style={{background:dark?"#0f172a":"#f8fafc",border:`1px solid ${dark?"#1e293b":"#e2e8f0"}`,borderRadius:8,padding:"8px 12px",marginBottom:8}}>
              <div style={{fontSize:11,...S.txt2}}>Nenhuma visita registrada ainda</div>
            </div>
          );
          return (
            <div style={{background:"#021a0d",border:"1px solid #22c55e33",borderRadius:8,padding:"8px 12px",marginBottom:8}}>
              <div style={{fontSize:11,color:"#22c55e",fontWeight:700}}>🔧 Última visita há {dias} dia(s)</div>
              <div style={{fontSize:10,color:"#64748b"}}>{fmtDate(ultima.data)}{ultima.tecnico?` · ${ultima.tecnico}`:""}</div>
            </div>
          );
        })()}
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10}}>
          <div style={{fontSize:12, fontWeight:700, ...S.txt}}>📋 Histórico de Visitas <span style={{fontSize:11, ...S.txt2}}>({(data.visitas||[]).length})</span></div>
          {!ccoMode && (
            <button onClick={()=>setShowAdd(!showAdd)} style={{...S.btnSm, color:"#f59e0b", border:"1px solid #f59e0b44", fontSize:10}}>+ Visita</button>
          )}
        </div>

        {!ccoMode && showAdd && (
          <div style={{background:dark?"#020510":"#f8fafc", borderRadius:8, padding:"10px 12px", marginBottom:10, border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8}}>
              <div>
                <label style={S.lbl}>Data</label>
                <input type="date" value={novaVisita.data} onChange={e=>setNovaVisita(v=>({...v,data:e.target.value}))} style={S.inp}/>
              </div>
              <div>
                <label style={S.lbl}>Técnico</label>
                <input value={novaVisita.tecnico} onChange={e=>setNovaVisita(v=>({...v,tecnico:e.target.value}))} placeholder="Nome do técnico..." style={S.inp}/>
              </div>
            </div>
            <div style={{marginBottom:8}}>
              <label style={S.lbl}>Resumo do Serviço</label>
              <textarea value={novaVisita.resumo} onChange={e=>setNovaVisita(v=>({...v,resumo:e.target.value}))} placeholder="O que foi feito..." style={{...S.inp,height:60,resize:"vertical",fontSize:12}}/>
            </div>
            <div style={{display:"flex", gap:8}}>
              <button onClick={()=>setShowAdd(false)} style={{...S.btnSec, flex:1, fontSize:12}}>Cancelar</button>
              <button onClick={addVisita} style={{...S.btn, flex:1, fontSize:12}}>✓ Adicionar</button>
            </div>
          </div>
        )}

        {(data.visitas||[]).length===0 && !showAdd && (
          <div style={{textAlign:"center", padding:"14px 0", fontSize:12, ...S.txt2}}>Nenhuma visita registrada</div>
        )}

        <div style={{display:"flex", flexDirection:"column", gap:6}}>
          {(data.visitas||[]).map(v=>(
            <div key={v.id} style={{background:dark?"#020510":"#f8fafc", borderRadius:8, padding:"10px 12px", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}>
              <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4}}>
                <div style={{display:"flex", gap:8, alignItems:"center"}}>
                  <span style={{fontSize:11, color:"#f59e0b", fontWeight:700}}>📅 {fmtDate(v.data)}</span>
                  {v.tecnico && <span style={{fontSize:10, ...S.txt2}}>🔧 {v.tecnico}</span>}
                </div>
                {adminAuth && !ccoMode && <button onClick={()=>removeVisita(v.id)} style={{background:"transparent", border:"none", color:"#ef444466", fontSize:14, cursor:"pointer"}}>✕</button>}
              </div>
              <div style={{fontSize:12, ...S.txt}}>{v.resumo}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Seção ADM  (INALTERADA)
function SecADM({ data, onSave, adminAuth, dark }) {
  const S = getStyles(dark);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState([...(data||[{nome:"",cargo:""},{nome:"",cargo:""},{nome:"",cargo:""}])]);

  const saveEdit = () => { onSave(form); setEditing(false); };
  const upd = (i,k,v) => { const n=[...form]; n[i]={...n[i],[k]:v}; setForm(n); };

  return (
    <div style={{display:"flex", flexDirection:"column", gap:8}}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <div style={{fontSize:13, fontWeight:700, color:"#a855f7"}}>👔 ADM</div>
        {adminAuth && !editing && (
          <button onClick={()=>setEditing(true)} style={{...S.btnSm, color:"#a855f7", border:"1px solid #a855f744", fontSize:10}}>✏️ Editar</button>
        )}
      </div>

      {editing ? (
        <div style={{...S.card, display:"flex", flexDirection:"column", gap:10}}>
          {form.map((m,i)=>(
            <div key={i} style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
              <div>
                <label style={S.lbl}>Nome {i+1}</label>
                <input value={m.nome||""} onChange={e=>upd(i,"nome",e.target.value)} placeholder="Nome..." style={S.inp}/>
              </div>
              <div>
                <label style={S.lbl}>Cargo</label>
                <input value={m.cargo||""} onChange={e=>upd(i,"cargo",e.target.value)} placeholder="Cargo..." style={S.inp}/>
              </div>
            </div>
          ))}
          <div style={{display:"flex", gap:8}}>
            <button onClick={()=>setEditing(false)} style={{...S.btnSec, flex:1, fontSize:13}}>Cancelar</button>
            <button onClick={saveEdit} style={{...S.btn, flex:1, fontSize:13}}>✓ Salvar</button>
          </div>
        </div>
      ) : (
        <div style={S.card}>
          {(data||[]).filter(m=>m.nome).length === 0 ? (
            <div style={{textAlign:"center", padding:"10px 0", fontSize:12, ...S.txt2}}>Nenhum membro cadastrado</div>
          ) : (
            <div style={{display:"flex", flexDirection:"column", gap:8}}>
              {(data||[]).map((m,i)=> m.nome ? (
                <div key={i} style={{display:"flex", alignItems:"center", gap:10, background:dark?"#020510":"#f8fafc", borderRadius:8, padding:"8px 12px"}}>
                  <div style={{width:32, height:32, borderRadius:8, background:"#120a2e", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0}}>👔</div>
                  <div>
                    <div style={{fontSize:12, fontWeight:700, ...S.txt}}>{m.nome}</div>
                    <div style={{fontSize:10, ...S.txt2}}>{m.cargo||"—"}</div>
                  </div>
                </div>
              ) : null)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── App principal
export default function EmpresaInfo({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }) {
  const S = getStyles(dark);
  const [authLevel, setAuthLevel] = useState(sharedAuth||null);
  const [screen, setScreen] = useState(sharedAuth?"main":"pin");
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const adminAuth = authLevel === "admin";
  const ccoMode = temCCO(project.id); // projetos com CCO: visitas de supervisão ficam no CCO

  useEffect(()=>{
    loadInfo(project.id).then(d=>{ setInfo(d); setLoading(false); });
  },[project.id]);

  const saveSection = async (section, data) => {
    setSaving(true);
    const updated = {...info, [section]:data};
    setInfo(updated);
    await saveInfo(project.id, updated);
    setSaving(false);
  };

  if(screen==="pin") return (
    <PinGate project={project} dark={dark} onBack={onBack}
      onSuccess={(level)=>{ setAuthLevel(level); setScreen("main"); onAuthGranted?.(level); }}/>
  );

  if(loading) return (
    <div style={{...S.page, alignItems:"center", justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:30, marginBottom:10}}>🏢</div>
        <div style={{fontSize:13, ...S.txt2}}>Carregando informações...</div>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* Header */}
        <div style={{position:"sticky", top:0, zIndex:10, ...S.hdrBg, padding:"14px 16px"}}>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <button onClick={onBack} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15, fontWeight:800, ...S.txt}}>🏢 Informações</div>
              <div style={{fontSize:11, ...S.txt2}}>{project.id} · {project.name}</div>
            </div>
            {saving && <div style={{fontSize:10, color:"#0ea5e9", fontWeight:700}}>⟳</div>}
            <button onClick={onToggleTheme} style={{background:"transparent", border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`, borderRadius:8, padding:"5px 10px", cursor:"pointer", fontSize:14, ...S.txt2}}>{dark?"☀️":"🌙"}</button>
          </div>
        </div>

        <div style={{padding:"12px 16px", display:"flex", flexDirection:"column", gap:14}}>
          {/* Badge acesso */}
          {adminAuth ? (
            <div style={{background:"#021a0d", border:"1px solid #22c55e33", borderRadius:10, padding:"8px 14px", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
              <div style={{fontSize:12, color:"#22c55e", fontWeight:700}}>🔓 Modo Gerencial — pode editar tudo</div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>gerarPDFEmpresa(project,info,dark)} style={{...S.btnSm, color:"#a855f7", border:"1px solid #a855f744", fontSize:10}}>📄 PDF</button>
                <button onClick={()=>{setAuthLevel(null);setScreen("pin");}} style={{...S.btnSm, color:"#64748b", fontSize:10}}>Sair</button>
              </div>
            </div>
          ) : (
            <div style={{background:"#001a2e", border:"1px solid #0ea5e933", borderRadius:10, padding:"8px 14px", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
              <div style={{fontSize:12, color:"#0ea5e9", fontWeight:700}}>👁 Somente leitura</div>
              <button onClick={()=>{setAuthLevel(null);setScreen("pin");}} style={{...S.btnSm, color:"#64748b", fontSize:10}}>Sair</button>
            </div>
          )}

          {/* Empresa Segurança */}
          <SecSeguranca
            data={info?.seguranca || {nome:"",gerente:"",supervisor:"",visitas:[]}}
            onSave={(d)=>saveSection("seguranca",d)}
            adminAuth={adminAuth}
            dark={dark}
            ccoMode={ccoMode}/>

          {/* Empresa Manutenção */}
          <SecManutencao
            data={info?.manutencao || {nome:"",visitas:[]}}
            onSave={(d)=>saveSection("manutencao",d)}
            adminAuth={adminAuth}
            dark={dark}
            ccoMode={ccoMode}/>

          {/* ADM */}
          <SecADM
            data={info?.adm || [{nome:"",cargo:""},{nome:"",cargo:""},{nome:"",cargo:""}]}
            onSave={(d)=>saveSection("adm",d)}
            adminAuth={adminAuth}
            dark={dark}/>
        </div>
      </div>
    </div>
  );
}
