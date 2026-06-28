import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";

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
const CONSULTORES = [
  { nome: "Marcio Fonseca", pin: "872101" },
  { nome: "Cristian", pin: "872101" }
];

function todayStr() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d) {
  if(!d) return "--";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}
function daysSince(d) {
  if(!d) return 0;
  try { return Math.floor((Date.now()-new Date(d+"T12:00:00").getTime())/86400000); } catch { return 0; }
}
function addDays(d, n) {
  try {
    const dt = new Date(d+"T12:00:00");
    dt.setDate(dt.getDate()+n);
    return dt.toISOString().split("T")[0];
  } catch { return d; }
}

const PEND_TIPOS = [
  { key:"uniforme",     icon:"👕", label:"Uniforme",     subs:["Sapato","Camisa","Calça","Blusa","Colete","Outro"] },
  { key:"financeiro",   icon:"💰", label:"Financeiro",   subs:["FT não recebida","Pagamento errado","Convênio médico","Férias","Outro"] },
  { key:"interpessoal", icon:"🤝", label:"Interpessoal", subs:[] },
  { key:"reclamacao",   icon:"📋", label:"Reclamação",   subs:[] },
  { key:"observacao",   icon:"📝", label:"Observação",   subs:[] },
];

const ADM_TIPOS = [
  { key:"operacional",  icon:"⚙️",  label:"Operacional" },
  { key:"administrativo",icon:"📄", label:"Administrativo" },
  { key:"solicitacao",  icon:"📬",  label:"Solicitação" },
  { key:"outro",        icon:"📝",  label:"Outro" },
];

// ── Firebase helpers
async function loadVisita(projectId, data) {
  try {
    const snap = await getDoc(doc(db,"visitas",`${projectId}_${data}`));
    if(snap.exists()) return snap.data();
  } catch(e){}
  try {
    const local = localStorage.getItem(`visita_${projectId}_${data}`);
    if(local) return JSON.parse(local);
  } catch(e){}
  return null;
}

async function saveVisita(projectId, data, visita) {
  try { await setDoc(doc(db,"visitas",`${projectId}_${data}`), visita); } catch(e){ console.error(e); }
  try { localStorage.setItem(`visita_${projectId}_${data}`, JSON.stringify(visita)); } catch(e){}
}

async function loadAllVisitas(projectId) {
  const result = [];
  try {
    // Load from localStorage keys
    for(let i=0; i<localStorage.length; i++) {
      const key = localStorage.key(i);
      if(key && key.startsWith(`visita_${projectId}_`)) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if(data) result.push(data);
        } catch(e){}
      }
    }
  } catch(e){}
  return result.sort((a,b)=>b.data.localeCompare(a.data));
}

async function loadEquipeData(projectId) {
  try {
    const snap = await getDoc(doc(db,"equipes",projectId));
    if(snap.exists()) return snap.data();
  } catch(e){}
  try {
    const local = localStorage.getItem(`equipe_${projectId}`);
    if(local) return JSON.parse(local);
  } catch(e){}
  return { colaboradores:[] };
}

async function loadEquipData(projectId) {
  try {
    const snap = await getDoc(doc(db,"equipamentos",projectId));
    if(snap.exists()) return snap.data();
  } catch(e){}
  try {
    const local = localStorage.getItem(`equipamentos_${projectId}`);
    if(local) return JSON.parse(local);
  } catch(e){}
  return {};
}

// ── Gerar PDF da visita
function gerarPDFVisita(visita, project) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const pendEquip = (visita.equipamentos||[]).filter(e=>e.status!=="resolvido");
  const pendResolvidos = (visita.equipamentos||[]).filter(e=>e.status==="resolvido");
  const pendColabs = visita.colaboradores||[];
  const contatos = visita.administracao||[];
  const obs = visita.observacoes||"";

  const equipRows = [
    ...pendResolvidos.map(e=>`<tr><td>✅ ${e.nome}</td><td style="color:#15803d;font-weight:700">Resolvido nesta visita</td><td>—</td></tr>`),
    ...pendEquip.map(e=>`<tr><td>⚠️ ${e.nome}</td><td style="color:${e.status==="inop"?"#dc2626":"#d97706"};font-weight:700">${e.status==="inop"?"Inoperante":"Parcial"} — continua</td><td>${e.diasAberto||0}d</td></tr>`)
  ].join("");

  const colabRows = pendColabs.map(p=>{
    const dias = daysSince(p.criadoEm?.split("T")[0]||visita.data);
    const status = p.resolvido ? "✅ Resolvido" : `⏳ Em aberto — ${dias}d`;
    return `<tr>
      <td><strong>${p.colaboradorNome||"—"}</strong><br><span style="font-size:10px;color:#64748b">${p.colaboradorCargo||""}</span></td>
      <td>${p.tipoIcon||""} ${p.tipoLabel||"—"}<br><span style="font-size:10px;color:#64748b">${p.subTipo||""}</span></td>
      <td>${p.descricao||"—"}</td>
      <td style="color:${p.resolvido?"#15803d":"#d97706"};font-size:11px;font-weight:700">${status}</td>
    </tr>`;
  }).join("");

  const admRows = contatos.map(c=>`<tr>
    <td>${c.tipoIcon||""} ${c.tipoLabel||"—"}</td>
    <td>${c.resumo||"—"}</td>
    <td>${c.providencia||"—"}</td>
    <td><span style="background:${c.prioridade==="imediato"?"#fee2e2":"#fef3c7"};color:${c.prioridade==="imediato"?"#dc2626":"#d97706"};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">${c.prioridade==="imediato"?"⚡ Imediato":"📅 Ação futura"}</span>${c.prazo?`<br><span style="font-size:10px;color:#64748b">Até ${fmtDate(c.prazo)}</span>`:""}</td>
  </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Visita — ${project.id} ${fmtDate(visita.data)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px;color:#1e293b}
  .header{background:linear-gradient(135deg,#1a1040,#0f0820);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
  .header h1{font-size:18px;margin-bottom:4px}
  .header p{font-size:11px;opacity:.7}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px}
  .card h2{font-size:13px;color:#475569;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #f1f5f9;padding-bottom:8px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
  td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  .obs{background:#f8fafc;border-radius:8px;padding:12px;font-size:13px;color:#334155;line-height:1.6}
  .footer{text-align:center;margin-top:16px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
  .sig{margin-top:8px;font-weight:700;color:#1e293b}
  @media print{body{padding:8px}@page{margin:12mm}.no-print{display:none}}
</style></head>
<body>
<div class="no-print" style="text-align:center;margin-bottom:16px">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="header">
  <div>
    <h1>📋 Relatório de Visita</h1>
    <p>${project.id} — ${project.name||""}</p>
    <p>Data: ${fmtDate(visita.data)} · Consultor: ${visita.consultor||"Moked Consulting"}</p>
  </div>
  <div style="text-align:right;font-size:11px;opacity:.7">
    <div>Moked Consulting Security</div>
    <div>Gerado em ${hoje}</div>
  </div>
</div>

${equipRows ? `<div class="card">
  <h2>🛡️ Equipamentos</h2>
  <table><thead><tr><th>Item</th><th>Status</th><th>Dias em aberto</th></tr></thead>
  <tbody>${equipRows}</tbody></table>
</div>` : ""}

${colabRows ? `<div class="card">
  <h2>👥 Pendências de Colaboradores</h2>
  <table><thead><tr><th>Colaborador</th><th>Tipo</th><th>Descrição</th><th>Status</th></tr></thead>
  <tbody>${colabRows}</tbody></table>
</div>` : ""}

${admRows ? `<div class="card">
  <h2>🏢 Contato com Administração</h2>
  <table><thead><tr><th>Tipo</th><th>Resumo</th><th>Providência</th><th>Prioridade</th></tr></thead>
  <tbody>${admRows}</tbody></table>
</div>` : ""}

${obs ? `<div class="card"><h2>📝 Observações Gerais</h2><div class="obs">${obs}</div></div>` : ""}

<div class="footer">
  <div>MokLog CheckTest © Moked Consulting Security</div>
  <div class="sig">${visita.consultor||"Consultor Moked"}</div>
  <div>${project.id} · ${fmtDate(visita.data)}</div>
</div>
</body></html>`;

  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url;
  a.download=`visita_${project.id}_${visita.data}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── WhatsApp da pendência
function whatsappPendencia(visita, project, tipo, item) {
  let msg = "";
  if(tipo==="colab") {
    msg = `*📋 Pendência de Colaborador — ${project.id}*\n` +
      `📍 ${project.name||project.id}\n` +
      `📅 Visita: ${fmtDate(visita.data)}\n\n` +
      `👤 *${item.colaboradorNome}* — ${item.colaboradorCargo||""}\n` +
      `${item.tipoIcon} ${item.tipoLabel}${item.subTipo?` — ${item.subTipo}`:""}\n` +
      `📝 ${item.descricao||""}\n\n` +
      `⏳ Prazo: ${item.prazo?fmtDate(item.prazo):"A definir"}\n` +
      `_MokLog © Moked Consulting Security_`;
  } else if(tipo==="adm") {
    msg = `*🏢 Ação — ${project.id}*\n` +
      `📍 ${project.name||project.id}\n` +
      `📅 ${fmtDate(visita.data)}\n\n` +
      `${item.tipoIcon} ${item.tipoLabel}\n` +
      `📋 ${item.resumo||""}\n` +
      `✅ Providência: ${item.providencia||"—"}\n` +
      (item.prazo?`⏰ Prazo: ${fmtDate(item.prazo)}\n`:"")+
      `_MokLog © Moked Consulting Security_`;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");
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

// ── PIN Gate
function PinGate({ project, onSuccess, onBack, dark, initialStep, onPinOk }) {
  const S = getStyles(dark);
  const [pin, setPin] = useState("");
  const [consultor, setConsultor] = useState("");
  const [step, setStep] = useState(initialStep||"pin"); // pin | consultor
  const [err, setErr] = useState(false);

  const tryPin = () => {
    if(pin === ADMIN_PIN) { setStep("consultor"); setErr(false); onPinOk?.(); }
    else { setErr(true); }
  };

  const confirmConsultor = () => {
    if(!consultor) { setErr(true); return; }
    onSuccess(consultor);
  };

  if(step==="consultor") return (
    <div style={{...S.page, alignItems:"center", justifyContent:"center"}}>
      <div style={{...S.card, maxWidth:320, width:"100%", margin:16, textAlign:"center"}}>
        <div style={{fontSize:32, marginBottom:8}}>👤</div>
        <div style={{fontSize:16, fontWeight:800, ...S.txt, marginBottom:4}}>Quem está visitando?</div>
        <div style={{fontSize:12, ...S.txt2, marginBottom:20}}>{project.id} · {project.name}</div>
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {["Marcio Fonseca","Cristian"].map(nome=>(
            <button key={nome} onClick={()=>setConsultor(nome)}
              style={{...S.btnSec, fontSize:13, color:consultor===nome?"#0ea5e9":undefined, borderColor:consultor===nome?"#0ea5e944":undefined, background:consultor===nome?dark?"#001a2e":"#e0f2fe":undefined}}>
              {consultor===nome?"✓ ":""}{nome}
            </button>
          ))}
        </div>
        {err && <div style={{fontSize:12, color:"#ef4444", marginTop:8}}>Selecione o consultor</div>}
        <button onClick={confirmConsultor} style={{...S.btn, marginTop:12}}>Confirmar</button>
      </div>
    </div>
  );

  return (
    <div style={{...S.page, alignItems:"center", justifyContent:"center"}}>
      <div style={{...S.card, maxWidth:320, width:"100%", margin:16, textAlign:"center"}}>
        <div style={{fontSize:32, marginBottom:8}}>📋</div>
        <div style={{fontSize:16, fontWeight:800, ...S.txt, marginBottom:4}}>Visita Diária</div>
        <div style={{fontSize:12, ...S.txt2, marginBottom:20}}>{project.id} · {project.name}</div>
        <div style={{fontSize:12, ...S.txt2, marginBottom:12}}>PIN Gerencial</div>
        <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pin}
          onChange={e=>{setPin(e.target.value);setErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter") tryPin();}}
          style={{...S.inp, textAlign:"center", fontSize:22, letterSpacing:10, marginBottom:8}}/>
        {err && <div style={{fontSize:12, color:"#ef4444", marginBottom:8}}>PIN incorreto</div>}
        <div style={{display:"flex", gap:8}}>
          <button onClick={onBack} style={{...S.btnSec, flex:1, fontSize:13}}>← Voltar</button>
          <button onClick={tryPin} style={{...S.btn, flex:1, fontSize:13}}>Entrar</button>
        </div>
      </div>
    </div>
  );
}

export default function Visita({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }) {
  const S = getStyles(dark);
  const [screen, setScreen] = useState("pin");
  const [consultor, setConsultor] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [visita, setVisita] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [equipeData, setEquipeData] = useState(null);
  const [equipData, setEquipData] = useState(null);
  const [historicoVisitas, setHistoricoVisitas] = useState([]);
  const [viewVisita, setViewVisita] = useState(null);

  // Modals
  const [showAddColab, setShowAddColab] = useState(false);
  const [showAddAdm, setShowAddAdm] = useState(false);
  const [formColab, setFormColab] = useState({colaboradorId:"",colaboradorNome:"",colaboradorCargo:"",tipo:"uniforme",subTipo:"",descricao:"",prazo:addDays(todayStr(),3),criadoEm:new Date().toISOString()});
  const [formAdm, setFormAdm] = useState({tipo:"operacional",resumo:"",providencia:"",prioridade:"imediato",prazo:"",criadoEm:new Date().toISOString()});
  const [obsText, setObsText] = useState("");

  const setFC = (k,v) => setFormColab(f=>({...f,[k]:v}));
  const setFA = (k,v) => setFormAdm(f=>({...f,[k]:v}));

  // Load equipe and equip data
  useEffect(()=>{
    loadEquipeData(project.id).then(d=>setEquipeData(d));
    loadEquipData(project.id).then(d=>setEquipData(d));
    loadAllVisitas(project.id).then(d=>setHistoricoVisitas(d));
  },[project.id]);

  // Load visita for selected date
  const loadVisitaForDate = async (date) => {
    setLoading(true);
    const v = await loadVisita(project.id, date);
    if(v) {
      setVisita(v);
      setObsText(v.observacoes||"");
    } else {
      // Build new visita from current data
      const equip = equipData || {};
      const allItems = [
        ...(equip.smartphones||[]).map(i=>({...i,categoria:"Smartphones"})),
        ...(equip.radiosHT||[]).map(i=>({...i,categoria:"Rádios HT"})),
        ...(equip.armamento||[]).map(i=>({...i,categoria:"Armamento"})),
        ...(equip.lanternas||[]).map(i=>({...i,categoria:"Lanternas"})),
        ...(equip.placas||[]).map(i=>({...i,categoria:"Placas Balísticas"})),
        ...(equip.ztrax||[]).map(i=>({...i,categoria:"ZTRAX"})),
        ...(equip.bodycam||[]).map(i=>({...i,categoria:"Bodycam"})),
        ...(equip.moto?[{...equip.moto,identificacao:`Moto ${equip.moto.placa||""}`,categoria:"Motocicleta"}]:[]),
      ].filter(i=>i.status && i.status!=="ok");

      const equipPendentes = allItems.map(i=>({
        id: i.id||Math.random().toString(36).substring(2,8),
        nome: `${i.categoria} — ${i.identificacao||""}`,
        status: i.status,
        diasAberto: i.dataProblem ? daysSince(i.dataProblem) : 0,
        justificativa: i.justificativa||"",
        visitaStatus: "pendente", // pendente | resolvido | continua
      }));

      const newVisita = {
        projectId: project.id,
        data: date,
        consultor: consultor,
        equipamentos: equipPendentes,
        colaboradores: [],
        administracao: [],
        observacoes: "",
        criadoEm: new Date().toISOString(),
      };
      setVisita(newVisita);
      setObsText("");
    }
    setLoading(false);
  };

  const saveCurrentVisita = async (updated) => {
    setSaving(true);
    const toSave = {...updated, updatedAt: new Date().toISOString()};
    setVisita(toSave);
    await saveVisita(project.id, selectedDate, toSave);
    setSaving(false);
  };

  // ── Handlers
  const updateEquipStatus = (id, status) => {
    const updated = {...visita, equipamentos: visita.equipamentos.map(e=>e.id===id?{...e,visitaStatus:status}:e)};
    saveCurrentVisita(updated);
  };

  const addPendenciaColab = () => {
    if(!formColab.colaboradorNome) { alert("Selecione o colaborador"); return; }
    if(!formColab.descricao) { alert("Descreva a pendência"); return; }
    const tipo = PEND_TIPOS.find(t=>t.key===formColab.tipo);
    const entry = { ...formColab, id:Date.now().toString(), tipoIcon:tipo?.icon||"📝", tipoLabel:tipo?.label||formColab.tipo, resolvido:false, criadoEm:new Date().toISOString() };
    const updated = {...visita, colaboradores:[...(visita.colaboradores||[]), entry]};
    saveCurrentVisita(updated);
    setShowAddColab(false);
    setFormColab({colaboradorId:"",colaboradorNome:"",colaboradorCargo:"",tipo:"uniforme",subTipo:"",descricao:"",prazo:addDays(todayStr(),3),criadoEm:new Date().toISOString()});
  };

  const addContatoAdm = () => {
    if(!formAdm.resumo) { alert("Descreva o contato"); return; }
    const tipo = ADM_TIPOS.find(t=>t.key===formAdm.tipo);
    const entry = { ...formAdm, id:Date.now().toString(), tipoIcon:tipo?.icon||"📝", tipoLabel:tipo?.label||formAdm.tipo, resolvido:false, criadoEm:new Date().toISOString() };
    const updated = {...visita, administracao:[...(visita.administracao||[]), entry]};
    saveCurrentVisita(updated);
    setShowAddAdm(false);
    setFormAdm({tipo:"operacional",resumo:"",providencia:"",prioridade:"imediato",prazo:"",criadoEm:new Date().toISOString()});
  };

  const resolverPendColab = (id) => {
    const updated = {...visita, colaboradores: visita.colaboradores.map(c=>c.id===id?{...c,resolvido:true,resolvidoEm:new Date().toISOString()}:c)};
    saveCurrentVisita(updated);
  };

  const removerPendColab = (id) => {
    const updated = {...visita, colaboradores: visita.colaboradores.filter(c=>c.id!==id)};
    saveCurrentVisita(updated);
  };

  const resolverAdm = (id) => {
    const updated = {...visita, administracao: visita.administracao.map(a=>a.id===id?{...a,resolvido:true,resolvidoEm:new Date().toISOString()}:a)};
    saveCurrentVisita(updated);
  };

  const extenderPrazo = (id, dias) => {
    const updated = {...visita, colaboradores: visita.colaboradores.map(c=>c.id===id?{...c,prazo:addDays(c.prazo||todayStr(),dias)}:c)};
    saveCurrentVisita(updated);
  };

  const saveObs = () => {
    const updated = {...visita, observacoes: obsText};
    saveCurrentVisita(updated);
  };

  if(screen==="pin") return (
    <PinGate project={project} dark={dark} onBack={onBack}
      initialStep={sharedAuth==="admin"?"consultor":"pin"} onPinOk={()=>onAuthGranted?.("admin")}
      onSuccess={(cons)=>{ setConsultor(cons); setScreen("menu"); }}/>
  );

  // ── HISTÓRICO DE VISITAS
  if(screen==="historico") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>setScreen("menu")} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>📅 Histórico de Visitas</div>
              <div style={{fontSize:11,...S.txt2}}>{project.id} · {historicoVisitas.length} visita(s)</div>
            </div>
          </div>
        </div>
        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
          {historicoVisitas.length===0 && (
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:32,marginBottom:8}}>📅</div>
              <div style={{fontSize:13,...S.txt2}}>Nenhuma visita registrada ainda</div>
            </div>
          )}
          {historicoVisitas.map(v=>{
            const pendentes = (v.colaboradores||[]).filter(c=>!c.resolvido).length + (v.administracao||[]).filter(a=>!a.resolvido).length;
            return (
              <div key={v.data} style={{...S.card,cursor:"pointer"}} onClick={()=>{ setViewVisita(v); setScreen("viewVisita"); }}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:44,height:44,borderRadius:10,background:dark?"#0f172a":"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>📋</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,...S.txt}}>{fmtDate(v.data)}</div>
                    <div style={{fontSize:11,...S.txt2}}>Consultor: {v.consultor||"—"}</div>
                    {pendentes>0&&<div style={{fontSize:10,color:"#f59e0b",fontWeight:700,marginTop:2}}>{pendentes} pendência(s) em aberto</div>}
                  </div>
                  <span style={{...S.txt2,fontSize:16}}>›</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── VIEW VISITA (histórico)
  if(screen==="viewVisita" && viewVisita) return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>setScreen("historico")} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>📋 {fmtDate(viewVisita.data)}</div>
              <div style={{fontSize:11,...S.txt2}}>{viewVisita.consultor||"—"}</div>
            </div>
            <button onClick={()=>gerarPDFVisita(viewVisita,project)}
              style={{...S.btnSm,color:"#a855f7",border:"1px solid #a855f744",fontSize:11}}>📄 PDF</button>
          </div>
        </div>
        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
          {/* Equipamentos */}
          {(viewVisita.equipamentos||[]).length>0&&(
            <div style={S.card}>
              <div style={{fontSize:11,color:"#0ea5e9",fontWeight:700,textTransform:"uppercase",marginBottom:10}}>🛡️ Equipamentos</div>
              {viewVisita.equipamentos.map(e=>(
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:14}}>{e.visitaStatus==="resolvido"?"✅":"⚠️"}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,...S.txt}}>{e.nome}</div>
                    <div style={{fontSize:10,color:e.visitaStatus==="resolvido"?"#22c55e":"#f59e0b"}}>
                      {e.visitaStatus==="resolvido"?"Resolvido nesta visita":"Continua em aberto"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Colaboradores */}
          {(viewVisita.colaboradores||[]).length>0&&(
            <div style={S.card}>
              <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",marginBottom:10}}>👥 Colaboradores</div>
              {viewVisita.colaboradores.map(c=>(
                <div key={c.id} style={{marginBottom:8,padding:"8px 10px",background:dark?"#020510":"#f8fafc",borderRadius:8,border:`1px solid ${c.resolvido?"#22c55e33":dark?"#0f172a":"#e2e8f0"}`}}>
                  <div style={{fontSize:12,fontWeight:700,...S.txt}}>{c.colaboradorNome}</div>
                  <div style={{fontSize:11,...S.txt2}}>{c.tipoIcon} {c.tipoLabel}{c.subTipo?` — ${c.subTipo}`:""}</div>
                  <div style={{fontSize:11,...S.txt}}>{c.descricao}</div>
                  <div style={{fontSize:10,color:c.resolvido?"#22c55e":"#f59e0b",fontWeight:700,marginTop:3}}>{c.resolvido?"✅ Resolvido":"⏳ Em aberto"}</div>
                </div>
              ))}
            </div>
          )}
          {/* Administração */}
          {(viewVisita.administracao||[]).length>0&&(
            <div style={S.card}>
              <div style={{fontSize:11,color:"#a855f7",fontWeight:700,textTransform:"uppercase",marginBottom:10}}>🏢 Administração</div>
              {viewVisita.administracao.map(a=>(
                <div key={a.id} style={{marginBottom:8,padding:"8px 10px",background:dark?"#020510":"#f8fafc",borderRadius:8,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}>
                  <div style={{fontSize:12,fontWeight:700,...S.txt}}>{a.tipoIcon} {a.tipoLabel}</div>
                  <div style={{fontSize:11,...S.txt}}>{a.resumo}</div>
                  {a.providencia&&<div style={{fontSize:10,...S.txt2,marginTop:2}}>✅ {a.providencia}</div>}
                  <div style={{fontSize:10,color:a.prioridade==="imediato"?"#ef4444":"#f59e0b",fontWeight:700,marginTop:3}}>
                    {a.prioridade==="imediato"?"⚡ Imediato":"📅 Ação futura"}{a.prazo?` — até ${fmtDate(a.prazo)}`:""}
                  </div>
                </div>
              ))}
            </div>
          )}
          {viewVisita.observacoes&&(
            <div style={S.card}>
              <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>📝 Observações</div>
              <div style={{fontSize:13,...S.txt,lineHeight:1.6}}>{viewVisita.observacoes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── MENU (selecionar data)
  if(screen==="menu") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onBack} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>📋 Visita Diária</div>
              <div style={{fontSize:11,...S.txt2}}>{project.id} · {consultor}</div>
            </div>
            <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,...S.txt2}}>{dark?"☀️":"🌙"}</button>
          </div>
        </div>

        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          {/* Selecionar data */}
          <div style={S.card}>
            <label style={S.lbl}>Data da Visita</label>
            <input type="date" value={selectedDate}
              onChange={e=>setSelectedDate(e.target.value)}
              max={todayStr()} style={S.inp}/>
          </div>

          {/* Pendências gerais */}
          {equipData && (()=>{
            const all = [...(equipData.smartphones||[]),...(equipData.radiosHT||[]),...(equipData.armamento||[]),...(equipData.lanternas||[]),...(equipData.placas||[]),...(equipData.moto?[equipData.moto]:[])];
            const probs = all.filter(i=>i.status&&i.status!=="ok");
            if(!probs.length) return null;
            return (
              <div style={{background:"#1a0202",border:"1px solid #ef444433",borderRadius:10,padding:"10px 14px"}}>
                <div style={{fontSize:11,color:"#ef4444",fontWeight:700,marginBottom:4}}>⚠️ {probs.length} equipamento(s) com problema</div>
                {probs.slice(0,3).map((p,i)=>(
                  <div key={i} style={{fontSize:10,color:"#94a3b8"}}>• {p.identificacao||"Item"} — {p.status}</div>
                ))}
                {probs.length>3&&<div style={{fontSize:10,color:"#64748b"}}>+{probs.length-3} mais</div>}
              </div>
            );
          })()}

          <button onClick={()=>{ loadVisitaForDate(selectedDate); setScreen("visita"); }}
            style={S.btnGreen} disabled={loading}>
            {loading?"⟳ Carregando...":"📋 Iniciar / Continuar Visita"}
          </button>

          <button onClick={()=>setScreen("historico")}
            style={{...S.btnSec,color:"#0ea5e9",borderColor:"#0ea5e922",fontSize:13}}>
            📅 Histórico de Visitas ({historicoVisitas.length})
          </button>
        </div>
      </div>
    </div>
  );

  // ── VISITA PRINCIPAL
  if(screen==="visita" && visita) return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>setScreen("menu")} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>📋 {fmtDate(visita.data)}</div>
              <div style={{fontSize:11,...S.txt2}}>{project.id} · {consultor}</div>
            </div>
            {saving&&<div style={{fontSize:10,color:"#0ea5e9",fontWeight:700}}>⟳</div>}
            <button onClick={()=>gerarPDFVisita({...visita,observacoes:obsText},project)}
              style={{...S.btnSm,color:"#a855f7",border:"1px solid #a855f744",fontSize:11}}>📄 PDF</button>
          </div>
        </div>

        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:12}}>

          {/* ── SEÇÃO 1: Equipamentos */}
          <div style={S.card}>
            <div style={{fontSize:11,color:"#0ea5e9",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>
              🛡️ Equipamentos com Problema ({(visita.equipamentos||[]).length})
            </div>
            {(visita.equipamentos||[]).length===0 && (
              <div style={{fontSize:12,...S.txt2,textAlign:"center",padding:"8px 0"}}>✅ Nenhum equipamento com problema</div>
            )}
            {(visita.equipamentos||[]).map(e=>(
              <div key={e.id} style={{background:dark?"#020510":"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:6,border:`1px solid ${e.visitaStatus==="resolvido"?"#22c55e33":dark?"#0f172a":"#e2e8f0"}`}}>
                <div style={{fontSize:12,fontWeight:700,...S.txt,marginBottom:6}}>{e.nome}</div>
                <div style={{fontSize:10,...S.txt2,marginBottom:8}}>
                  Status: <span style={{color:e.status==="inop"?"#ef4444":"#f59e0b",fontWeight:700}}>{e.status==="inop"?"Inoperante":"Parcial"}</span>
                  {e.diasAberto>0&&<span style={{color:"#64748b"}}> · {e.diasAberto}d em aberto</span>}
                </div>
                <div style={{display:"flex",gap:6}}>
                  {["resolvido","continua"].map(st=>(
                    <button key={st} onClick={()=>updateEquipStatus(e.id,st)}
                      style={{flex:1,background:e.visitaStatus===st?(st==="resolvido"?"#021a0d":"#1a0202"):"transparent",border:`1px solid ${e.visitaStatus===st?(st==="resolvido"?"#22c55e44":"#ef444444"):dark?"#0f172a":"#e2e8f0"}`,color:e.visitaStatus===st?(st==="resolvido"?"#22c55e":"#ef4444"):dark?"#475569":"#94a3b8",borderRadius:7,padding:"6px 8px",fontSize:11,cursor:"pointer",fontWeight:e.visitaStatus===st?700:400}}>
                      {st==="resolvido"?"✅ Resolvido":"⚠️ Continua"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── SEÇÃO 2: Colaboradores */}
          <div style={S.card}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>
                👥 Pendências Colaboradores ({(visita.colaboradores||[]).length})
              </div>
              <button onClick={()=>setShowAddColab(!showAddColab)}
                style={{...S.btnSm,color:"#f59e0b",border:"1px solid #f59e0b44",fontSize:10}}>+ Adicionar</button>
            </div>

            {showAddColab && (
              <div style={{background:dark?"#020510":"#f8fafc",borderRadius:10,padding:"12px",marginBottom:10,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}>
                {/* Selecionar colaborador */}
                <div style={{marginBottom:8}}>
                  <label style={S.lbl}>Colaborador</label>
                  <select value={formColab.colaboradorId}
                    onChange={e=>{
                      const col = (equipeData?.colaboradores||[]).find(c=>c.id===e.target.value);
                      setFC("colaboradorId",e.target.value);
                      setFC("colaboradorNome",col?.nome||"");
                      setFC("colaboradorCargo",col?.cargo||"");
                    }}
                    style={{...S.inp}}>
                    <option value="">— Selecione —</option>
                    {(equipeData?.colaboradores||[]).filter(c=>c.status==="ativo").map(c=>(
                      <option key={c.id} value={c.id}>{c.nome} — {c.cargo}</option>
                    ))}
                  </select>
                </div>

                {/* Tipo */}
                <div style={{marginBottom:8}}>
                  <label style={S.lbl}>Tipo de Pendência</label>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {PEND_TIPOS.map(t=>(
                      <button key={t.key} onClick={()=>setFC("tipo",t.key)}
                        style={{background:formColab.tipo===t.key?dark?"#001a2e":"#e0f2fe":"transparent",border:`1px solid ${formColab.tipo===t.key?"#0ea5e944":dark?"#0f172a":"#e2e8f0"}`,color:formColab.tipo===t.key?"#0ea5e9":dark?"#475569":"#94a3b8",borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:formColab.tipo===t.key?700:400}}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtipo */}
                {PEND_TIPOS.find(t=>t.key===formColab.tipo)?.subs?.length>0 && (
                  <div style={{marginBottom:8}}>
                    <label style={S.lbl}>Detalhe</label>
                    <select value={formColab.subTipo} onChange={e=>setFC("subTipo",e.target.value)} style={S.inp}>
                      <option value="">— Selecione —</option>
                      {PEND_TIPOS.find(t=>t.key===formColab.tipo).subs.map(s=>(
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{marginBottom:8}}>
                  <label style={S.lbl}>Descrição</label>
                  <textarea value={formColab.descricao} onChange={e=>setFC("descricao",e.target.value)}
                    placeholder="Descreva a pendência..." style={{...S.inp,height:60,resize:"vertical",fontSize:12}}/>
                </div>

                <div style={{marginBottom:10}}>
                  <label style={S.lbl}>Prazo para solução</label>
                  <input type="date" value={formColab.prazo} onChange={e=>setFC("prazo",e.target.value)} style={S.inp}/>
                </div>

                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setShowAddColab(false)} style={{...S.btnSec,flex:1,fontSize:12}}>Cancelar</button>
                  <button onClick={addPendenciaColab} style={{...S.btn,flex:1,fontSize:12}}>✓ Adicionar</button>
                </div>
              </div>
            )}

            {(visita.colaboradores||[]).length===0 && !showAddColab && (
              <div style={{fontSize:12,...S.txt2,textAlign:"center",padding:"8px 0"}}>Nenhuma pendência registrada</div>
            )}

            {(visita.colaboradores||[]).map(c=>{
              const dias = daysSince(c.criadoEm?.split("T")[0]||visita.data);
              const vencido = c.prazo && new Date(c.prazo) < new Date() && !c.resolvido;
              return (
                <div key={c.id} style={{background:dark?"#020510":"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:6,border:`2px solid ${c.resolvido?"#22c55e33":vencido?"#ef444444":dark?"#0f172a":"#e2e8f0"}`}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,...S.txt}}>{c.colaboradorNome}</div>
                      <div style={{fontSize:10,...S.txt2}}>{c.colaboradorCargo}</div>
                      <div style={{fontSize:11,...S.txt,marginTop:3}}>{c.tipoIcon} {c.tipoLabel}{c.subTipo?` — ${c.subTipo}`:""}</div>
                      <div style={{fontSize:11,...S.txt2,marginTop:2}}>{c.descricao}</div>
                      <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                        {c.prazo&&<span style={{fontSize:9,color:vencido?"#ef4444":"#64748b"}}>📅 Prazo: {fmtDate(c.prazo)}</span>}
                        {!c.resolvido&&<span style={{fontSize:9,color:vencido?"#ef4444":"#f59e0b",fontWeight:700}}>{dias}d desde registro</span>}
                        {c.resolvido&&<span style={{fontSize:9,color:"#22c55e",fontWeight:700}}>✅ Resolvido</span>}
                        {vencido&&<span style={{fontSize:9,color:"#ef4444",fontWeight:700}}>🔴 VENCIDO</span>}
                      </div>
                    </div>
                  </div>
                  {!c.resolvido && (
                    <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                      <button onClick={()=>whatsappPendencia(visita,project,"colab",c)}
                        style={{...S.btnSm,color:"#22c55e",border:"1px solid #22c55e44",fontSize:10}}>💬 WhatsApp</button>
                      <button onClick={()=>extenderPrazo(c.id,5)}
                        style={{...S.btnSm,color:"#0ea5e9",border:"1px solid #0ea5e944",fontSize:10}}>+5 dias</button>
                      <button onClick={()=>resolverPendColab(c.id)}
                        style={{...S.btnSm,color:"#22c55e",border:"1px solid #22c55e44",fontSize:10}}>✓ Resolvido</button>
                      <button onClick={()=>removerPendColab(c.id)}
                        style={{...S.btnSm,color:"#ef4444",border:"1px solid #ef444433",fontSize:10}}>✕</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── SEÇÃO 3: Administração */}
          <div style={S.card}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:11,color:"#a855f7",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>
                🏢 Contato Administração ({(visita.administracao||[]).length})
              </div>
              <button onClick={()=>setShowAddAdm(!showAddAdm)}
                style={{...S.btnSm,color:"#a855f7",border:"1px solid #a855f744",fontSize:10}}>+ Adicionar</button>
            </div>

            {showAddAdm && (
              <div style={{background:dark?"#020510":"#f8fafc",borderRadius:10,padding:"12px",marginBottom:10,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}>
                <div style={{marginBottom:8}}>
                  <label style={S.lbl}>Tipo</label>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {ADM_TIPOS.map(t=>(
                      <button key={t.key} onClick={()=>setFA("tipo",t.key)}
                        style={{background:formAdm.tipo===t.key?dark?"#120a2e":"#f3e8ff":"transparent",border:`1px solid ${formAdm.tipo===t.key?"#a855f744":dark?"#0f172a":"#e2e8f0"}`,color:formAdm.tipo===t.key?"#a855f7":dark?"#475569":"#94a3b8",borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:formAdm.tipo===t.key?700:400}}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{marginBottom:8}}>
                  <label style={S.lbl}>Resumo do contato / assunto</label>
                  <textarea value={formAdm.resumo} onChange={e=>setFA("resumo",e.target.value)}
                    placeholder="O que foi tratado..." style={{...S.inp,height:60,resize:"vertical",fontSize:12}}/>
                </div>

                <div style={{marginBottom:8}}>
                  <label style={S.lbl}>Providência tomada</label>
                  <input value={formAdm.providencia} onChange={e=>setFA("providencia",e.target.value)}
                    placeholder="O que foi feito / encaminhado..." style={S.inp}/>
                </div>

                <div style={{marginBottom:8}}>
                  <label style={S.lbl}>Prioridade</label>
                  <div style={{display:"flex",gap:8}}>
                    {[{key:"imediato",icon:"⚡",label:"Imediato",color:"#ef4444"},{key:"futuro",icon:"📅",label:"Ação Futura",color:"#f59e0b"}].map(p=>(
                      <button key={p.key} onClick={()=>setFA("prioridade",p.key)}
                        style={{flex:1,background:formAdm.prioridade===p.key?dark?"#1a0202":"#fff5f5":"transparent",border:`2px solid ${formAdm.prioridade===p.key?p.color+"66":dark?"#0f172a":"#e2e8f0"}`,color:formAdm.prioridade===p.key?p.color:dark?"#475569":"#94a3b8",borderRadius:8,padding:"8px",fontSize:12,cursor:"pointer",fontWeight:formAdm.prioridade===p.key?700:400}}>
                        {p.icon} {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {formAdm.prioridade==="futuro" && (
                  <div style={{marginBottom:8}}>
                    <label style={S.lbl}>Prazo</label>
                    <input type="date" value={formAdm.prazo} onChange={e=>setFA("prazo",e.target.value)} style={S.inp}/>
                  </div>
                )}

                <div style={{display:"flex",gap:8,marginTop:4}}>
                  <button onClick={()=>setShowAddAdm(false)} style={{...S.btnSec,flex:1,fontSize:12}}>Cancelar</button>
                  <button onClick={addContatoAdm} style={{...S.btn,flex:1,fontSize:12}}>✓ Registrar</button>
                </div>
              </div>
            )}

            {(visita.administracao||[]).length===0 && !showAddAdm && (
              <div style={{fontSize:12,...S.txt2,textAlign:"center",padding:"8px 0"}}>Nenhum contato registrado</div>
            )}

            {(visita.administracao||[]).map(a=>{
              const vencido = a.prazo && new Date(a.prazo) < new Date() && !a.resolvido && a.prioridade==="futuro";
              return (
                <div key={a.id} style={{background:dark?"#020510":"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:6,border:`2px solid ${a.resolvido?"#22c55e33":vencido?"#ef444444":a.prioridade==="imediato"?"#ef444422":dark?"#0f172a":"#e2e8f0"}`}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
                        <span style={{fontSize:12,fontWeight:700,...S.txt}}>{a.tipoIcon} {a.tipoLabel}</span>
                        <span style={{fontSize:9,background:a.prioridade==="imediato"?"#fee2e2":"#fef3c7",color:a.prioridade==="imediato"?"#dc2626":"#d97706",padding:"1px 6px",borderRadius:4,fontWeight:700}}>
                          {a.prioridade==="imediato"?"⚡ Imediato":"📅 Ação futura"}
                        </span>
                      </div>
                      <div style={{fontSize:12,...S.txt}}>{a.resumo}</div>
                      {a.providencia&&<div style={{fontSize:11,...S.txt2,marginTop:2}}>✅ {a.providencia}</div>}
                      <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                        {a.prazo&&<span style={{fontSize:9,color:vencido?"#ef4444":"#64748b"}}>📅 Até: {fmtDate(a.prazo)}</span>}
                        {vencido&&<span style={{fontSize:9,color:"#ef4444",fontWeight:700}}>🔴 VENCIDO</span>}
                        {a.resolvido&&<span style={{fontSize:9,color:"#22c55e",fontWeight:700}}>✅ Resolvido</span>}
                      </div>
                    </div>
                  </div>
                  {!a.resolvido && (
                    <div style={{display:"flex",gap:6,marginTop:8}}>
                      <button onClick={()=>whatsappPendencia(visita,project,"adm",a)}
                        style={{...S.btnSm,color:"#22c55e",border:"1px solid #22c55e44",fontSize:10}}>💬 WhatsApp</button>
                      <button onClick={()=>resolverAdm(a.id)}
                        style={{...S.btnSm,color:"#22c55e",border:"1px solid #22c55e44",fontSize:10}}>✓ Resolvido</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── SEÇÃO 4: Observações */}
          <div style={S.card}>
            <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>📝 Observações Gerais</div>
            <textarea value={obsText} onChange={e=>setObsText(e.target.value)}
              placeholder="Situação geral da operação, alinhamentos, qualquer observação do dia..."
              style={{...S.inp,height:80,resize:"vertical",fontSize:13}}/>
            <button onClick={saveObs}
              style={{...S.btnSm,marginTop:6,color:"#0ea5e9",border:"1px solid #0ea5e944",fontSize:11,padding:"6px 14px"}}>
              💾 Salvar observações
            </button>
          </div>

          {/* ── Botão PDF final */}
          <button onClick={()=>gerarPDFVisita({...visita,observacoes:obsText},project)}
            style={{...S.btn,background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}}>
            📄 Gerar Relatório de Visita
          </button>

        </div>
      </div>
    </div>
  );

  return null;
}
