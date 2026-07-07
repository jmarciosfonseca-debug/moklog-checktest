import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import RondaVirtual from "./RondaVirtual"; // ◀ NOVO — aba de ronda virtual CFTV
import TempoGravacao from "./TempoGravacao"; // ◀ aba CFTV Tempo de Gravação

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

import { getAccess, grantSession } from "./session";

const ADMIN_PIN = "872101";
const PROJECT_PINS = {
  P601:"16601",P602:"16602",P604:"16604",P605:"16605",
  P606:"16606",P607:"16607",P311A:"16311",P311B:"16311",
  P505:"16505",P260A:"162601",P260B:"162602",P260C:"162603"
};

// ── Coleções por tema. "acesso" mantém a coleção LEGADA acesso_cco (retrocompatível).
const COLLECTIONS = {
  acesso:     "acesso_cco",
  intervalo:  "cco_intervalo",
  supervisao: "cco_supervisao",
  manutencao: "cco_manutencao",
  ronda:      "cco_ronda",        // ◀ NOVO — coleção própria, não toca as legadas
};

const TEMAS = [
  { key:"acesso",     label:"Acesso",     icon:"🚪", color:"#0ea5e9" },
  { key:"intervalo",  label:"Intervalo",  icon:"⏱️", color:"#22c55e" },
  { key:"supervisao", label:"Supervisão", icon:"👁️", color:"#a855f7" },
  { key:"ronda",      label:"Ronda Virtual", icon:"🎥", color:"#818cf8" }, // ◀ NOVO
  { key:"cftv",       label:"CFTV Gravação", icon:"📹", color:"#0ea5e9" },
  { key:"manutencao", label:"Manutenção", icon:"🛠️", color:"#f59e0b" },
];

const STATUS_MANUT = [
  { key:"concluida", label:"Concluída", color:"#22c55e", bg:"#021a0d", icon:"✅" },
  { key:"parcial",   label:"Parcial",   color:"#f59e0b", bg:"#1a1000", icon:"⚠️" },
  { key:"pendente",  label:"Pendente",  color:"#ef4444", bg:"#1a0202", icon:"⏳" },
];
// Cada colaborador faz 3 intervalos por plantão
const TIPOS_INTERVALO = [
  { key:"cafe1",    icon:"☕",  label:"Café 1" },
  { key:"refeicao", icon:"🍽️", label:"Almoço/Janta" },
  { key:"cafe2",    icon:"☕",  label:"Café 2" },
];
// Categorias de equipamentos (coleção equipamentos/{pid}) para cruzar na supervisão
const EQUIP_CATS = [
  { key:"smartphones", label:"Smartphone" },
  { key:"radiosHT",    label:"Rádio HT" },
  { key:"armamento",   label:"Armamento" },
  { key:"municao",     label:"Munição" },
  { key:"placas",      label:"Placa Balística" },
  { key:"lanternas",   label:"Lanterna" },
  { key:"ztrax",       label:"ZTRAX" },
  { key:"bodycam",     label:"Bodycam" },
];
function isDanificado(status){ return status==="inop"||status==="critico"||status==="parcial"||status==="baixo"; }
const TURNOS = [
  { key:"diurno",  label:"Diurno",  color:"#f59e0b", bg:"#1a1000", icon:"☀️" },
  { key:"noturno", label:"Noturno", color:"#818cf8", bg:"#0a0a2e", icon:"🌙" },
];

function todayStr() { return new Date().toLocaleDateString("sv-SE"); }
function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}
function fmtDate(d) {
  if(!d) return "--";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}
function daysSince(d) {
  if(!d) return null;
  try { return Math.floor((Date.now()-new Date(d+"T12:00:00").getTime())/86400000); } catch { return null; }
}

// ── Firebase load/save por tema (registros guardados em array `registros`)
async function loadTema(tema, projectId) {
  const col = COLLECTIONS[tema];
  try {
    const snap = await getDoc(doc(db,col,projectId));
    if(snap.exists()) {
      const data = snap.data();
      try { localStorage.setItem(`${col}_${projectId}`, JSON.stringify(data.registros||[])); } catch(e){}
      return data.registros || [];
    }
  } catch(e){}
  try {
    const local = localStorage.getItem(`${col}_${projectId}`);
    if(local) return JSON.parse(local);
  } catch(e){}
  return [];
}
async function saveTema(tema, projectId, registros) {
  const col = COLLECTIONS[tema];
  try { await setDoc(doc(db,col,projectId),{registros,updatedAt:new Date().toISOString()}); }
  catch(e){ console.error("Firebase save error:",e); }
  try { localStorage.setItem(`${col}_${projectId}`, JSON.stringify(registros)); }
  catch(e){ console.warn("localStorage save failed:",e); }
}

// Carrega colaboradores ativos da equipe do projeto (equipes/{pid})
async function loadEquipe(projectId) {
  try {
    const snap = await getDoc(doc(db,"equipes",projectId));
    if(snap.exists()) {
      const data = snap.data();
      try { localStorage.setItem(`equipe_${projectId}`, JSON.stringify(data)); } catch(e){}
      return (data.colaboradores||[]).filter(c=>c.status!=="desligado" && (c.nome||"").trim());
    }
  } catch(e){}
  try {
    const local = localStorage.getItem(`equipe_${projectId}`);
    if(local){ const d=JSON.parse(local); return (d.colaboradores||[]).filter(c=>c.status!=="desligado" && (c.nome||"").trim()); }
  } catch(e){}
  return [];
}

// Carrega equipamentos danificados do projeto (equipamentos/{pid})
async function loadEquipDanificados(projectId) {
  let data = null;
  try {
    const snap = await getDoc(doc(db,"equipamentos",projectId));
    if(snap.exists()) data = snap.data();
  } catch(e){}
  if(!data){ try { const local=localStorage.getItem(`equipamentos_${projectId}`); if(local) data=JSON.parse(local); } catch(e){} }
  if(!data) return [];
  const out = [];
  for(const cat of EQUIP_CATS){
    (data[cat.key]||[]).forEach(it=>{
      if(isDanificado(it.status)) out.push({ catKey:cat.key, catLabel:cat.label, id:it.id||"", identificacao:it.identificacao||"", status:it.status, justificativa:it.justificativa||"" });
    });
  }
  if(data.moto && isDanificado(data.moto.status)) out.push({ catKey:"moto", catLabel:"Motocicleta", id:data.moto.id||"", identificacao:data.moto.placa||data.moto.identificacao||"", status:data.moto.status, justificativa:data.moto.justificativa||"" });
  return out;
}

// ── Rascunho por tema + projeto
function draftKey(tema, projectId) { return `cco_draft_${tema}_${projectId}`; }
function loadDraft(tema, projectId) {
  try { const d = localStorage.getItem(draftKey(tema,projectId)); if(d) return JSON.parse(d); } catch(e){}
  return null;
}
function saveDraft(tema, projectId, form) {
  try { localStorage.setItem(draftKey(tema,projectId), JSON.stringify({form,savedAt:Date.now()})); } catch(e){}
}
function clearDraft(tema, projectId) {
  try { localStorage.removeItem(draftKey(tema,projectId)); } catch(e){}
}

// \u2500\u2500 Dots de atividade das abas (chips premium)
function computeCrudDot(registros, temDraft, hoje){
  const h = hoje || todayStr();
  const ativoHoje = (registros||[]).some(r=>!r.arquivado && r.data===h);
  if(ativoHoje) return {color:"#22c55e", pulse:true};   // registro ativo hoje
  if(temDraft)  return {color:"#f59e0b", pulse:false};  // rascunho pendente
  return null;
}
async function loadActivityDots(projectId){
  const hoje = todayStr();
  const out = {};
  const crud = ["acesso","intervalo","supervisao","manutencao"];
  await Promise.all([
    ...crud.map(async t=>{
      const regs = await loadTema(t, projectId);
      out[t] = computeCrudDot(regs, !!loadDraft(t, projectId), hoje);
    }),
    (async()=>{
      try{
        const snap = await getDoc(doc(db,"cco_ronda",projectId));
        if(snap.exists() && (snap.data().turnos||[]).some(t=>t.dataInicio===hoje))
          out.ronda = {color:"#22c55e", pulse:true}; // turno registrado hoje
      }catch(e){}
    })(),
    (async()=>{
      try{
        const snap = await getDoc(doc(db,"cftv_gravacao",projectId));
        if(snap.exists()){
          const cams = snap.data().cameras||[];
          const has = f => cams.some(c=>c.diasGravacao!==null&&c.diasGravacao!==undefined&&f(c.diasGravacao));
          if(has(d=>d<15))      out.cftv = {color:"#ef4444", pulse:true};   // camera critica
          else if(has(d=>d<30)) out.cftv = {color:"#f59e0b", pulse:false};  // camera em atencao
        }
      }catch(e){}
    })(),
  ]);
  return out;
}

function getStyles(dark) {
  return {
    page:    { minHeight:"100vh", background:dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 80px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:480, display:"flex", flexDirection:"column" },
    card:    { background:dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"14px 16px" },
    btn:     { background:"linear-gradient(135deg,#1d4ed8,#1e40af)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnSec:  { background:dark?"#060c18":"#f8fafc", color:dark?"#94a3b8":"#64748b", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
    btnSm:   { background:dark?"#020510":"#f8fafc", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#94a3b8":"#64748b", borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:600 },
    backBtn: { background:"transparent", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#94a3b8":"#94a3b8", borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 },
    inp:     { width:"100%", background:dark?"#020510":"#ffffff", border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`, borderRadius:7, color:dark?"#e2e8f0":"#1e293b", padding:"10px 12px", fontSize:13, boxSizing:"border-box", outline:"none" },
    lbl:     { display:"block", fontSize:11, color:dark?"#64748b":"#94a3b8", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 },
    hdrBg:   { background:dark?"#04080f":"#f8fafc", borderBottom:`1px solid ${dark?"#0a0f1e":"#e2e8f0"}` },
    txt:     { color:dark?"#f1f5f9":"#0f172a" },
    txt2:    { color:dark?"#64748b":"#94a3b8" },
  };
}

// ════════════════════════════════════════════════════════════════════════
// PIN GATE
// ════════════════════════════════════════════════════════════════════════
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
    <div style={{...S.page, alignItems:"center", justifyContent:"center"}}>
      <div style={{...S.card, maxWidth:320, width:"100%", margin:16, textAlign:"center"}}>
        <div style={{fontSize:32, marginBottom:8}}>🚪</div>
        <div style={{fontSize:16, fontWeight:800, ...S.txt, marginBottom:4}}>Acesso CCO</div>
        <div style={{fontSize:12, ...S.txt2, marginBottom:20}}>{project?.id||""} · {project?.name||""}</div>
        {!mode ? (
          <div style={{display:"flex", flexDirection:"column", gap:8}}>
            <button onClick={()=>setMode("lider")} style={{...S.btn, background:"linear-gradient(135deg,#0369a1,#0c4a6e)", fontSize:13}}>🚪 Acesso CCO / Vig CCO</button>
            <button onClick={()=>setMode("admin")} style={{...S.btnSec, fontSize:13, color:"#f59e0b", borderColor:"#f59e0b33"}}>🔐 Acesso Gerencial</button>
            <button onClick={onBack} style={{...S.btnSec, fontSize:13, marginTop:4}}>← Voltar</button>
          </div>
        ) : (
          <>
            <div style={{fontSize:12, ...S.txt2, marginBottom:12}}>{mode==="lider"?"PIN do projeto":"PIN gerencial"}</div>
            <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8}
              value={pin} onChange={e=>{setPin(e.target.value);setErr(false);}}
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

// ════════════════════════════════════════════════════════════════════════
// PDF POR TEMA
// ════════════════════════════════════════════════════════════════════════
function statusLabel(key){ const s=STATUS_MANUT.find(x=>x.key===key); return s?s.label:key||"--"; }
function turnoLabel(key){ const t=TURNOS.find(x=>x.key===key); return t?t.label:key||"--"; }

function gerarPDFTema(tema, project, registros) {
  const temaInfo = TEMAS.find(t=>t.key===tema) || TEMAS[0];
  const hoje = new Date().toLocaleDateString("pt-BR");
  const ativos = registros.filter(r=>!r.arquivado);
  const arquivados = registros.filter(r=>r.arquivado);

  // Cabeçalho de tabela e linhas por tema
  let head = "", rowsAtivos = "", rowsArq = "";
  const ivCell = (col,key)=>{ const iv=col.intervalos?.[key]; return iv&&(iv.saida||iv.retorno)?`${iv.saida||"--"}→${iv.retorno||"--"}`:"--"; };
  const rowFn = {
    acesso: (r)=>`<tr><td><strong>${r.nome||"--"}</strong></td><td>${r.empresa||"--"}</td><td>${fmtDate(r.data)}</td><td>${r.horaEntrada||"--"}</td><td>${r.obs||"--"}</td></tr>`,
    intervalo: (r)=>(r.colaboradores||[]).map(col=>`<tr><td>${fmtDate(r.data)}</td><td>${turnoLabel(r.turno)}</td><td><strong>${col.nome||"--"}</strong><br><span style="font-size:10px;color:#94a3b8">${col.cargo||""}</span></td><td>${ivCell(col,"cafe1")}</td><td>${ivCell(col,"refeicao")}</td><td>${ivCell(col,"cafe2")}</td></tr>`).join(""),
    supervisao: (r)=>{
      const eqs=(r.equipamentos||[]).filter(e=>e.acao).map(e=>`${e.acao==="trocado"?"✔":"✗"} ${e.catLabel}${e.identificacao?` (${e.identificacao})`:""}`).join("<br>")||"--";
      return `<tr><td><strong>${r.supervisor||"--"}</strong></td><td>${turnoLabel(r.turno)}</td><td>${fmtDate(r.data)}</td><td>${r.chegada||"--"}</td><td>${r.saida||"--"}</td><td>${r.resumo||"--"}</td><td style="font-size:10px">${eqs}</td></tr>`;
    },
    manutencao: (r)=>`<tr><td><strong>${r.empresa||"--"}</strong></td><td>${r.tecnico||"--"}</td><td>${r.sistema||"--"}</td><td>${turnoLabel(r.turno)}</td><td>${statusLabel(r.status)}</td><td>${fmtDate(r.data)}</td><td>${r.servico||"--"}</td></tr>`,
  };
  const heads = {
    acesso: "<tr><th>Nome</th><th>Empresa/Setor</th><th>Data</th><th>Entrada</th><th>Observação</th></tr>",
    intervalo: "<tr><th>Data</th><th>Turno</th><th>Colaborador</th><th>Café 1</th><th>Almoço/Janta</th><th>Café 2</th></tr>",
    supervisao: "<tr><th>Supervisor</th><th>Turno</th><th>Data</th><th>Chegada</th><th>Saída</th><th>Observação</th><th>Equipamentos</th></tr>",
    manutencao: "<tr><th>Empresa</th><th>Técnico</th><th>Sistema</th><th>Turno</th><th>Status</th><th>Data</th><th>Serviço</th></tr>",
  };
  head = heads[tema];
  rowsAtivos = ativos.map(rowFn[tema]).join("");
  rowsArq = arquivados.map(rowFn[tema]).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>${temaInfo.label} — ${project.id} ${hoje}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px;color:#1e293b}
  .header{background:linear-gradient(135deg,#0c2340,#081626);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
  .header h1{font-size:18px;margin-bottom:4px}
  .header p{font-size:11px;opacity:.75}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px}
  .card h2{font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #f1f5f9;padding-bottom:8px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
  td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  .footer{text-align:center;margin-top:16px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
  .kpi{display:flex;gap:10px;margin-bottom:14px}
  .kpibox{flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
  .kpibox .n{font-size:22px;font-weight:800;color:#0c2340}
  .kpibox .l{font-size:10px;color:#94a3b8;font-weight:700}
  @media print{body{padding:8px}@page{margin:12mm}.no-print{display:none}}
</style></head>
<body>
<div class="no-print" style="text-align:center;margin-bottom:16px">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="header">
  <div>
    <h1>${temaInfo.icon} ${temaInfo.label} — CCO</h1>
    <p>${project.id} — ${project.name||""}</p>
    <p>Relatório gerado em ${hoje}</p>
  </div>
  <div style="text-align:right;font-size:11px;opacity:.75">
    <div>Moked Consulting Security</div>
    <div>MokLog CheckTest</div>
  </div>
</div>
<div class="kpi">
  <div class="kpibox"><div class="n">${registros.length}</div><div class="l">TOTAL</div></div>
  <div class="kpibox"><div class="n">${ativos.length}</div><div class="l">ATIVOS</div></div>
  <div class="kpibox"><div class="n">${arquivados.length}</div><div class="l">ARQUIVADOS</div></div>
</div>
${rowsAtivos ? `<div class="card"><h2>Registros Ativos</h2><table><thead>${head}</thead><tbody>${rowsAtivos}</tbody></table></div>` : `<div class="card"><h2>Registros Ativos</h2><div style="font-size:12px;color:#94a3b8">Nenhum registro ativo.</div></div>`}
${rowsArq ? `<div class="card"><h2>Arquivados (mantidos para histórico)</h2><table><thead>${head}</thead><tbody>${rowsArq}</tbody></table></div>` : ""}
<div class="footer">
  <div>MokLog CheckTest © Moked Consulting Security</div>
  <div>${temaInfo.label} · ${project.id} · ${hoje}</div>
</div>
</body></html>`;

  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`cco_${tema}_${project.id}_${todayStr()}.html`; a.click();
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════════════════
// COMPONENTES COMPARTILHADOS
// ════════════════════════════════════════════════════════════════════════
function PillGroup({ options, value, onChange, dark }) {
  return (
    <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
      {options.map(o=>{
        const sel = value===o.key;
        return (
          <button key={o.key} onClick={()=>onChange(o.key)}
            style={{flex:1, minWidth:90, background:sel?o.bg:"transparent",
              border:`1px solid ${sel?o.color+"66":dark?"#0f172a":"#e2e8f0"}`,
              color:sel?o.color:dark?"#64748b":"#94a3b8",
              borderRadius:8, padding:"9px 8px", fontSize:12, cursor:"pointer",
              fontWeight:sel?700:500}}>
            {o.icon} {o.label}
          </button>
        );
      })}
    </div>
  );
}

function KPI({ S, val, label, color }) {
  return (
    <div style={{...S.card,textAlign:"center",padding:"10px 8px"}}>
      <div style={{fontSize:22,fontWeight:900,color}}>{val}</div>
      <div style={{fontSize:11,...S.txt2,fontWeight:700}}>{label}</div>
    </div>
  );
}

// Cartão genérico de registro com expandir + arquivar/desarquivar + excluir
function RegistroCard({ tema, r, dark, S, adminAuth, onArquivar, onDesarquivar, onExcluir }) {
  const [open, setOpen] = useState(false);
  const dias = daysSince(r.data);
  const st = tema==="manutencao" ? (STATUS_MANUT.find(s=>s.key===r.status)||STATUS_MANUT[0]) : null;
  const tn = (tema==="manutencao"||tema==="intervalo"||tema==="supervisao") ? (TURNOS.find(t=>t.key===r.turno)||TURNOS[0]) : null;
  const temaInfo = TEMAS.find(t=>t.key===tema)||TEMAS[0];

  // título e subtítulo por tema
  const titulo = {
    acesso: r.nome,
    intervalo: (r.colaboradores&&r.colaboradores.length)?`${r.colaboradores.length} colaborador(es)`:"Intervalo",
    supervisao: r.supervisor,
    manutencao: r.empresa,
  }[tema] || "—";
  const sub = {
    acesso: r.empresa, intervalo: "", supervisao: "", manutencao: r.sistema,
  }[tema] || "";
  const icon = { acesso:"👤", intervalo:"⏱️", supervisao:"👁️", manutencao:"🛠️" }[tema] || "•";
  const borderC = st ? st.color+"33" : (dark?"#0f172a":"#e2e8f0");

  return (
    <div style={{...S.card,border:`1px solid ${borderC}`,opacity:r.arquivado?0.7:1}}>
      <div style={{display:"flex",alignItems:"center",gap:10}} onClick={()=>setOpen(!open)}>
        <div style={{width:40,height:40,borderRadius:10,background:st?st.bg:(dark?"#0f172a":"#f1f5f9"),border:`1px solid ${borderC}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>
          {st?st.icon:icon}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,...S.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {titulo}{r.arquivado&&<span style={{fontSize:11,color:"#94a3b8",fontWeight:700,marginLeft:6,background:dark?"#0f172a":"#f1f5f9",padding:"1px 6px",borderRadius:6}}>📦 Arquivado</span>}
          </div>
          {sub&&<div style={{fontSize:11,...S.txt2}}>{sub}</div>}
          <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
            <span style={{fontSize:11,...S.txt2}}>📅 {fmtDate(r.data)}</span>
            {tema==="acesso"&&r.horaEntrada&&<span style={{fontSize:11,color:"#22c55e"}}>⏱ {r.horaEntrada}</span>}
            {tema==="supervisao"&&r.chegada&&<span style={{fontSize:11,color:"#22c55e"}}>↗ {r.chegada}</span>}
            {tema==="supervisao"&&r.saida&&<span style={{fontSize:11,color:"#f59e0b"}}>↘ {r.saida}</span>}
            {tn&&<span style={{fontSize:11,color:tn.color,fontWeight:700}}>{tn.icon} {tn.label}</span>}
            {st&&<span style={{fontSize:11,color:st.color,fontWeight:700}}>{st.label}</span>}
            {tema==="acesso"&&dias!==null&&<span style={{fontSize:11,color:dias===0?"#22c55e":dias>7?"#ef4444":"#94a3b8",fontWeight:700}}>{dias===0?"Hoje":dias===1?"Ontem":`${dias}d atrás`}</span>}
          </div>
        </div>
        <span style={{...S.txt2,fontSize:12}}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${dark?"#0f172a":"#f1f5f9"}`}}>
          {tema==="intervalo"&&(r.colaboradores||[]).map((col,i)=>(
            <div key={i} style={{marginBottom:8}}>
              <div style={{fontSize:12,fontWeight:700,...S.txt}}>{col.nome}{col.cargo?` · ${col.cargo}`:""}</div>
              {TIPOS_INTERVALO.map(t=>{
                const iv=col.intervalos?.[t.key]; if(!iv||(!iv.saida&&!iv.retorno)) return null;
                return <div key={t.key} style={{fontSize:11,...S.txt2,marginLeft:8}}>{t.icon} {t.label}: {iv.saida||"--"} → {iv.retorno||"--"}</div>;
              })}
            </div>
          ))}
          {tema==="manutencao"&&r.tecnico&&<div style={{fontSize:12,...S.txt,marginBottom:4}}><strong>Técnico:</strong> {r.tecnico}</div>}
          {tema==="manutencao"&&r.servico&&<div style={{fontSize:12,...S.txt,marginBottom:6,lineHeight:1.5}}><strong>Serviço:</strong> {r.servico}</div>}
          {tema==="supervisao"&&r.resumo&&<div style={{fontSize:12,...S.txt,marginBottom:6,lineHeight:1.5}}><strong>Observação:</strong> {r.resumo}</div>}
          {tema==="supervisao"&&(r.equipamentos||[]).filter(e=>e.acao).length>0&&(
            <div style={{marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:"#f59e0b",marginBottom:3}}>🛡️ Equipamentos:</div>
              {(r.equipamentos||[]).filter(e=>e.acao).map((e,i)=>(
                <div key={i} style={{fontSize:11,marginLeft:8,color:e.acao==="trocado"?"#22c55e":"#ef4444"}}>
                  {e.acao==="trocado"?"✅":"⏳"} {e.catLabel}{e.identificacao?` (${e.identificacao})`:""} — {e.acao==="trocado"?"trocado/resolvido":"em aberto"}
                </div>
              ))}
            </div>
          )}
          {r.obs&&<div style={{fontSize:12,...S.txt2,marginBottom:8,lineHeight:1.5}}>{r.obs}</div>}
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {!r.arquivado
              ? <button onClick={onArquivar} style={{...S.btnSm,color:"#94a3b8",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`}}>📦 Arquivar</button>
              : <button onClick={onDesarquivar} style={{...S.btnSm,color:"#0ea5e9",border:"1px solid #0ea5e944"}}>↩ Desarquivar</button>}
            {adminAuth && <button onClick={onExcluir} style={{...S.btnSm,color:"#ef4444",border:"1px solid #ef444433"}}>🗑 Excluir</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// FORMULÁRIOS POR TEMA
// ════════════════════════════════════════════════════════════════════════
function emptyForm(tema) {
  const base = { id: Date.now().toString()+Math.random().toString(36).substring(2,6), data: todayStr(), arquivado:false, obs:"", registradoEm:new Date().toISOString() };
  if(tema==="acesso")     return { ...base, nome:"", empresa:"", horaEntrada:nowTime() };
  if(tema==="intervalo")  return { ...base, turno:"diurno", colaboradores:[] }; // colaboradores:[{id,nome,cargo,intervalos:{cafe1:{saida,retorno},...}}]
  if(tema==="supervisao") return { ...base, supervisor:"", turno:"diurno", chegada:nowTime(), saida:"", resumo:"", equipamentos:[] }; // equipamentos:[{...,acao:"trocado"|"aberto"}]
  if(tema==="manutencao") return { ...base, empresa:"", tecnico:"", sistema:"", turno:"diurno", status:"concluida", servico:"" };
  return base;
}

function TemaForm({ tema, form, setF, S, dark, equipe }) {
  const c = TEMAS.find(t=>t.key===tema).color;
  if(tema==="acesso") return (
    <>
      <div style={{...S.card,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{fontSize:11,color:c,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>👤 Identificação</div>
        <div><label style={S.lbl}>Nome *</label><input value={form.nome} onChange={e=>setF("nome",e.target.value)} placeholder="Nome completo..." style={S.inp}/></div>
        <div><label style={S.lbl}>Empresa / Setor</label><input value={form.empresa} onChange={e=>setF("empresa",e.target.value)} placeholder="Empresa ou setor..." style={S.inp}/></div>
      </div>
      <div style={S.card}>
        <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>⏱️ Data e Hora</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={S.lbl}>Data</label><input type="date" value={form.data} onChange={e=>setF("data",e.target.value)} style={S.inp}/></div>
          <div><label style={S.lbl}>Hora de Entrada</label>
            <div style={{display:"flex",gap:5}}>
              <input type="time" value={form.horaEntrada} onChange={e=>setF("horaEntrada",e.target.value)} style={{...S.inp,flex:1}}/>
              <button onClick={()=>setF("horaEntrada",nowTime())} style={{...S.btnSm,padding:"8px 10px",fontSize:14,flexShrink:0}}>⏱</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
  if(tema==="intervalo") return (
    <>
      <div style={S.card}>
        <div style={{fontSize:11,color:c,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>📅 Plantão</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div><label style={S.lbl}>Data</label><input type="date" value={form.data} onChange={e=>setF("data",e.target.value)} style={S.inp}/></div>
        </div>
        <label style={S.lbl}>Turno</label>
        <PillGroup options={TURNOS} value={form.turno} onChange={v=>setF("turno",v)} dark={dark}/>
      </div>

      <div style={S.card}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontSize:11,color:c,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>👥 Colaboradores ({(form.colaboradores||[]).length})</div>
        </div>
        {/* Seletor: puxa da equipe do projeto, oculta os já adicionados */}
        <select value="" onChange={e=>{
            if(!e.target.value) return;
            const col = (equipe||[]).find(x=>String(x.id)===e.target.value);
            if(!col) return;
            const novo = { id:col.id, nome:col.nome, cargo:col.cargo||"", intervalos:{} };
            TIPOS_INTERVALO.forEach(t=>{ novo.intervalos[t.key]={saida:"",retorno:""}; });
            setF("colaboradores",[...(form.colaboradores||[]), novo]);
          }} style={{...S.inp,marginBottom:6}}>
          <option value="">+ Adicionar colaborador da equipe...</option>
          {(equipe||[]).filter(col=>!(form.colaboradores||[]).some(c=>String(c.id)===String(col.id))).map(col=>(
            <option key={col.id} value={col.id}>{col.nome}{col.cargo?` — ${col.cargo}`:""}{col.turno?` · ${col.turno}`:""}</option>
          ))}
        </select>
        {(equipe||[]).length===0 && <div style={{fontSize:11,color:"#ef4444"}}>Nenhum colaborador cadastrado em equipes/{"{projeto}"}. Cadastre a equipe primeiro.</div>}

        {(form.colaboradores||[]).map((col,ci)=>(
          <div key={col.id} style={{background:dark?"#020510":"#f8fafc",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderRadius:10,padding:"10px 12px",marginTop:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,...S.txt}}>{col.nome}</div>
                {col.cargo&&<div style={{fontSize:11,...S.txt2}}>{col.cargo}</div>}
              </div>
              <button onClick={()=>setF("colaboradores",(form.colaboradores||[]).filter((_,i)=>i!==ci))}
                style={{...S.btnSm,color:"#ef4444",border:"1px solid #ef444433"}}>✕</button>
            </div>
            {TIPOS_INTERVALO.map(t=>{
              const iv = col.intervalos?.[t.key] || {saida:"",retorno:""};
              const upd = (campo,val)=>{
                const novos=[...form.colaboradores];
                novos[ci]={...novos[ci],intervalos:{...novos[ci].intervalos,[t.key]:{...iv,[campo]:val}}};
                setF("colaboradores",novos);
              };
              return (
                <div key={t.key} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                  <span style={{fontSize:11,...S.txt2,width:90,flexShrink:0}}>{t.icon} {t.label}</span>
                  <input type="time" value={iv.saida} onChange={e=>upd("saida",e.target.value)} style={{...S.inp,flex:1,fontSize:12,padding:"7px 8px"}}/>
                  <button onClick={()=>upd("saida",nowTime())} style={{...S.btnSm,padding:"6px 8px",fontSize:12,flexShrink:0}}>⏱</button>
                  <span style={{...S.txt2,fontSize:11}}>→</span>
                  <input type="time" value={iv.retorno} onChange={e=>upd("retorno",e.target.value)} style={{...S.inp,flex:1,fontSize:12,padding:"7px 8px"}}/>
                  <button onClick={()=>upd("retorno",nowTime())} style={{...S.btnSm,padding:"6px 8px",fontSize:12,flexShrink:0}}>⏱</button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
  if(tema==="supervisao") return (
    <>
      <div style={{...S.card,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{fontSize:11,color:c,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>👤 Supervisor</div>
        <div><label style={S.lbl}>Nome do Supervisor *</label><input value={form.supervisor} onChange={e=>setF("supervisor",e.target.value)} placeholder="Nome completo..." style={S.inp}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          <div><label style={S.lbl}>Data</label><input type="date" value={form.data} onChange={e=>setF("data",e.target.value)} style={S.inp}/></div>
          <div><label style={S.lbl}>Chegada</label>
            <div style={{display:"flex",gap:4}}>
              <input type="time" value={form.chegada} onChange={e=>setF("chegada",e.target.value)} style={{...S.inp,flex:1,padding:"8px 6px"}}/>
              <button onClick={()=>setF("chegada",nowTime())} style={{...S.btnSm,padding:"8px",fontSize:13,flexShrink:0}}>⏱</button>
            </div>
          </div>
          <div><label style={S.lbl}>Saída</label>
            <div style={{display:"flex",gap:4}}>
              <input type="time" value={form.saida} onChange={e=>setF("saida",e.target.value)} style={{...S.inp,flex:1,padding:"8px 6px"}}/>
              <button onClick={()=>setF("saida",nowTime())} style={{...S.btnSm,padding:"8px",fontSize:13,flexShrink:0}}>⏱</button>
            </div>
          </div>
        </div>
      </div>
      <div style={S.card}><label style={S.lbl}>Turno</label><PillGroup options={TURNOS} value={form.turno} onChange={v=>setF("turno",v)} dark={dark}/></div>

      {/* Cruzamento com equipamentos danificados */}
      <div style={S.card}>
        <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>🛡️ Equipamentos Danificados</div>
        {(form.equipamentos||[]).length===0 ? (
          <div style={{fontSize:12,color:"#22c55e"}}>✔ Nenhum equipamento danificado registrado no projeto.</div>
        ) : (
          <>
            <div style={{fontSize:11,...S.txt2,marginBottom:8}}>Marque a ação tomada nesta supervisão:</div>
            {(form.equipamentos||[]).map((eq,i)=>(
              <div key={i} style={{background:dark?"#020510":"#f8fafc",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderRadius:8,padding:"8px 10px",marginBottom:6}}>
                <div style={{fontSize:12,fontWeight:700,...S.txt}}>{eq.catLabel}{eq.identificacao?` — ${eq.identificacao}`:""}</div>
                <div style={{fontSize:11,color:"#ef4444",marginBottom:6}}>Status: {eq.status}{eq.justificativa?` · ${eq.justificativa}`:""}</div>
                <div style={{display:"flex",gap:6}}>
                  {[{k:"trocado",l:"✅ Trocado/Resolvido",col:"#22c55e"},{k:"aberto",l:"⏳ Continua em aberto",col:"#ef4444"}].map(opt=>{
                    const sel=eq.acao===opt.k;
                    return (
                      <button key={opt.k} onClick={()=>{
                        const novos=[...form.equipamentos]; novos[i]={...eq,acao:opt.k}; setF("equipamentos",novos);
                      }} style={{flex:1,background:sel?opt.col+"22":"transparent",border:`1px solid ${sel?opt.col+"66":dark?"#0f172a":"#e2e8f0"}`,color:sel?opt.col:dark?"#64748b":"#94a3b8",borderRadius:7,padding:"6px",fontSize:11,cursor:"pointer",fontWeight:sel?700:500}}>{opt.l}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={S.card}>
        <label style={{...S.lbl,marginBottom:8}}>Observação Operacional *</label>
        <textarea value={form.resumo} onChange={e=>setF("resumo",e.target.value)} placeholder="O que foi verificado / alinhado na supervisão..." style={{...S.inp,height:80,resize:"vertical",fontSize:12}}/>
      </div>
    </>
  );
  if(tema==="manutencao") return (
    <>
      <div style={{...S.card,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{fontSize:11,color:c,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>🏢 Dados da Visita</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={S.lbl}>Data</label><input type="date" value={form.data} onChange={e=>setF("data",e.target.value)} style={S.inp}/></div>
          <div><label style={S.lbl}>Empresa *</label><input value={form.empresa} onChange={e=>setF("empresa",e.target.value)} placeholder="Empresa..." style={S.inp}/></div>
        </div>
        <div><label style={S.lbl}>Técnico(s)</label><input value={form.tecnico} onChange={e=>setF("tecnico",e.target.value)} placeholder="Nome do(s) técnico(s)..." style={S.inp}/></div>
        <div><label style={S.lbl}>Sistema</label><input value={form.sistema} onChange={e=>setF("sistema",e.target.value)} placeholder="Ex: CFTV, alarme, cancela..." style={S.inp}/></div>
      </div>
      <div style={S.card}><label style={S.lbl}>Turno</label><PillGroup options={TURNOS} value={form.turno} onChange={v=>setF("turno",v)} dark={dark}/></div>
      <div style={S.card}>
        <label style={{...S.lbl,marginBottom:8}}>Serviço Realizado *</label>
        <textarea value={form.servico} onChange={e=>setF("servico",e.target.value)} placeholder="Descreva o serviço executado..." style={{...S.inp,height:70,resize:"vertical",fontSize:12}}/>
      </div>
      <div style={S.card}><label style={{...S.lbl,marginBottom:8}}>Status</label><PillGroup options={STATUS_MANUT} value={form.status} onChange={v=>setF("status",v)} dark={dark}/></div>
    </>
  );
  return null;
}

function validarForm(tema, form) {
  if(tema==="acesso")     { if(!form.nome.trim()) return "Informe o nome"; }
  if(tema==="intervalo")  { if(!(form.colaboradores||[]).length) return "Adicione ao menos um colaborador da equipe"; }
  if(tema==="supervisao") { if(!form.supervisor.trim()) return "Informe o supervisor"; if(!form.resumo.trim()) return "Descreva a observação operacional"; }
  if(tema==="manutencao") { if(!form.empresa.trim()) return "Informe a empresa"; if(!form.servico.trim()) return "Descreva o serviço"; }
  return null;
}

// ════════════════════════════════════════════════════════════════════════
// MÓDULO PRINCIPAL
// ════════════════════════════════════════════════════════════════════════
export default function AcessoCCO({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }) {
  const S = getStyles(dark||true);
  const [authLevel, setAuthLevel] = useState(()=>sharedAuth||getAccess(project?.id)||null);
  const [tema, setTema] = useState("acesso");
  const [screen, setScreen] = useState(()=>(sharedAuth||getAccess(project?.id))?"list":"pin"); // pin | list | form
  const [showArquivados, setShowArquivados] = useState(false);

  // registros de TODOS os temas (carregados sob demanda ao trocar de aba)
  const [dados, setDados] = useState({ acesso:[], intervalo:[], supervisao:[], manutencao:[] });
  const [loadingTema, setLoadingTema] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  const [dots, setDots] = useState({});
  const [form, setForm] = useState(emptyForm("acesso"));
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));
  const [equipe, setEquipe] = useState([]);
  const [equipDan, setEquipDan] = useState([]);

  const adminAuth = authLevel==="admin";
  const registros = dados[tema] || [];
  const temaInfo = TEMAS.find(t=>t.key===tema) || TEMAS[0];
  const isRonda = tema==="ronda"; // ◀ NOVO — a aba ronda tem fluxo próprio (não usa o CRUD genérico)
  const isCftv = tema==="cftv"; // ◀ aba CFTV Tempo de Gravação — fluxo próprio

  // Carrega dots de atividade de todas as abas (1x na entrada)
  useEffect(()=>{
    if(!project?.id || screen==="pin") return;
    loadActivityDots(project.id).then(setDots);
  },[project?.id, screen==="pin"]);

  // Recalcula o dot da aba atual em tempo real (registros/rascunho)
  useEffect(()=>{
    if(screen==="pin" || isRonda || isCftv) return;
    setDots(prev=>({...prev, [tema]: computeCrudDot(dados[tema]||[], hasDraft)}));
  },[dados, hasDraft, tema, screen]);

  // Carrega o tema atual ao entrar / trocar de aba
  useEffect(()=>{
    if(!project?.id || screen==="pin") return;
    if(isRonda||isCftv){ setLoadingTema(false); setShowArquivados(false); return; } // ◀ ronda/cftv gerenciam o próprio load
    setLoadingTema(true);
    loadTema(tema, project.id).then(r=>{
      setDados(prev=>({...prev,[tema]:r||[]}));
      setLoadingTema(false);
    });
    setHasDraft(!!loadDraft(tema, project.id));
    setShowArquivados(false);
    // Carrega equipe (para Intervalo) e equipamentos danificados (para Supervisão)
    if(tema==="intervalo") loadEquipe(project.id).then(setEquipe);
    if(tema==="supervisao") loadEquipDanificados(project.id).then(setEquipDan);
  },[tema, project?.id, screen==="pin"]);

  // Autosave do rascunho enquanto preenche
  useEffect(()=>{
    if(screen==="form" && project?.id && !isRonda && !isCftv) {
      saveDraft(tema, project.id, form);
      setHasDraft(true);
    }
  },[form, screen, project?.id, tema]);

  const setRegistros = (novaLista) => setDados(prev=>({...prev,[tema]:novaLista}));

  const seedForm = (base) => {
    if(tema==="supervisao") {
      // pré-popula equipamentos danificados (sem ação definida ainda)
      const seeded = equipDan.map(e=>({...e, acao:""}));
      return { ...base, equipamentos: (base.equipamentos&&base.equipamentos.length)?base.equipamentos:seeded };
    }
    return base;
  };
  const novoLimpo = () => { clearDraft(tema, project.id); setHasDraft(false); setForm(seedForm(emptyForm(tema))); setScreen("form"); };
  const continuarRascunho = () => { const d=loadDraft(tema,project.id); setForm(seedForm(d?.form||emptyForm(tema))); setScreen("form"); };
  const salvarRascunho = () => { saveDraft(tema, project.id, form); setHasDraft(true); setScreen("list"); };

  const salvar = async () => {
    const erro = validarForm(tema, form);
    if(erro) { alert(erro); return; }
    setSaving(true);
    try {
      const novo = {...form, arquivado:false, registradoEm:new Date().toISOString()};
      const newList = [novo, ...registros];
      setRegistros(newList);
      await saveTema(tema, project.id, newList);
      clearDraft(tema, project.id);
      setHasDraft(false);
      setForm(emptyForm(tema));
      setScreen("list");
    } catch(e) { console.error(e); alert("Erro ao salvar. Verifique sua conexão."); }
    setSaving(false);
  };

  const arquivar = async (id) => {
    const newList = registros.map(r=>r.id===id?{...r,arquivado:true,arquivadoEm:new Date().toISOString()}:r);
    setRegistros(newList); await saveTema(tema, project.id, newList);
  };
  const desarquivar = async (id) => {
    const newList = registros.map(r=>r.id===id?{...r,arquivado:false}:r);
    setRegistros(newList); await saveTema(tema, project.id, newList);
  };
  const excluir = async (id) => {
    const newList = registros.filter(r=>r.id!==id);
    setRegistros(newList); await saveTema(tema, project.id, newList);
  };

  if(screen==="pin") return (
    <PinGate project={project||{}} dark={dark||true} onBack={onBack}
      onSuccess={(level)=>{ grantSession(level, project.id); setAuthLevel(level); setScreen("list"); onAuthGranted?.(level); }}/>
  );

  // Barra de abas (temas) \u2014 chips premium com icon box, gradiente e dot de atividade
  const TabBar = () => (
    <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"0 16px 12px"}}>
      <style>{`@keyframes ccoDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}`}</style>
      {TEMAS.map(t=>{
        const sel = tema===t.key;
        const dot = dots[t.key];
        return (
          <button key={t.key} onClick={()=>{setTema(t.key);setScreen("list");}}
            style={{flex:"1 1 30%",minWidth:104,position:"relative",display:"flex",alignItems:"center",gap:7,
              background:sel
                ? `linear-gradient(135deg, ${t.color}30, ${t.color}12)`
                : (dark?"#060c18":"#f8fafc"),
              border:`1px solid ${sel?t.color+"77":(dark?"#0f172a":"#e2e8f0")}`,
              boxShadow:sel?`0 0 14px ${t.color}30, inset 0 1px 0 ${t.color}22`:"none",
              color:sel?t.color:(dark?"#94a3b8":"#64748b"),
              borderRadius:11,padding:"8px 9px",fontSize:12,cursor:"pointer",fontWeight:sel?800:600,
              whiteSpace:"nowrap",textAlign:"left",transition:"all .18s ease"}}>
            <span style={{width:26,height:26,borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,
              background:sel?t.color+"2a":(dark?"#0a0f1e":"#eef2f7"),
              border:`1px solid ${sel?t.color+"55":"transparent"}`}}>{t.icon}</span>
            <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis"}}>{t.label}</span>
            {dot&&(
              <span style={{position:"absolute",top:6,right:6,width:8,height:8,borderRadius:"50%",
                background:dot.color,boxShadow:`0 0 6px ${dot.color}`,
                animation:dot.pulse?"ccoDot 1.4s ease-in-out infinite":"none"}}/>
            )}
          </button>
        );
      })}
    </div>
  );

  // ── FORMULÁRIO (não se aplica à aba ronda)
  if(screen==="form" && !isRonda) return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={()=>setScreen("list")} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>{temaInfo.icon} Novo — {temaInfo.label}</div>
              <div style={{fontSize:11,...S.txt2}}>{project?.id||""} · {project?.name||""}</div>
            </div>
            <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,...S.txt2}}>{dark?"☀️":"🌙"}</button>
          </div>
        </div>
        <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          <TemaForm tema={tema} form={form} setF={setF} S={S} dark={dark} equipe={equipe}/>
          <div style={S.card}>
            <label style={S.lbl}>Observação (opcional)</label>
            <textarea value={form.obs} onChange={e=>setF("obs",e.target.value)} placeholder="Observações..." style={{...S.inp,height:50,resize:"vertical",fontSize:12}}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={salvarRascunho} style={{...S.btnSec,flex:1,color:"#f59e0b",borderColor:"#f59e0b33"}}>💾 Salvar Rascunho</button>
            <button onClick={salvar} disabled={saving} style={{...S.btn,flex:1,opacity:saving?0.7:1}}>{saving?"⟳ Salvando...":"✓ Registrar"}</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── LISTA
  const ativos = registros.filter(r=>!r.arquivado);
  const arquivados = registros.filter(r=>r.arquivado);
  const visiveis = showArquivados ? arquivados : ativos;
  const hoje = visiveis.filter(r=>r.data===todayStr());
  const anteriores = visiveis.filter(r=>r.data!==todayStr());

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <button onClick={onBack} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>🚪 CCO / Vig CCO</div>
              <div style={{fontSize:11,...S.txt2}}>{project?.id||""} · {project?.name||""}</div>
            </div>
            <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,...S.txt2}}>{dark?"☀️":"🌙"}</button>
          </div>
          <TabBar/>
        </div>

        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
          {/* ◀ NOVO: aba ronda renderiza o componente próprio */}
          {isRonda ? (
            <RondaVirtual
              project={project} dark={dark||true} S={S} adminAuth={adminAuth}
              loadEquipe={loadEquipe} db={db} doc={doc} setDoc={setDoc} getDoc={getDoc}/>
          ) : isCftv ? (
            <TempoGravacao
              project={project} dark={dark||true} S={S} adminAuth={adminAuth}
              loadEquipe={loadEquipe} db={db} doc={doc} setDoc={setDoc} getDoc={getDoc}/>
          ) : loadingTema ? (
            <div style={{textAlign:"center",padding:"40px 0"}}>
              <div style={{fontSize:28,marginBottom:8}}>{temaInfo.icon}</div>
              <div style={{fontSize:13,...S.txt2}}>Carregando {temaInfo.label.toLowerCase()}...</div>
            </div>
          ) : (
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <KPI S={S} val={registros.length} label="TOTAL" color={temaInfo.color}/>
                <KPI S={S} val={ativos.length} label="ATIVOS" color="#22c55e"/>
                <KPI S={S} val={arquivados.length} label="ARQUIVADOS" color="#94a3b8"/>
              </div>

              {hasDraft && (
                <div style={{background:dark?"#1a1000":"#fffbeb",border:"1px solid #f59e0b55",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:16}}>📝</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Rascunho salvo</div>
                    <div style={{fontSize:11,...S.txt2}}>Continue de onde parou</div>
                  </div>
                  <button onClick={continuarRascunho} style={{...S.btnSm,color:"#f59e0b",border:"1px solid #f59e0b44"}}>Continuar</button>
                </div>
              )}

              <div style={{display:"flex",gap:8}}>
                <button onClick={novoLimpo} style={{...S.btn,flex:2}}>+ Registrar {temaInfo.label}</button>
                <button onClick={()=>gerarPDFTema(tema, project, registros)} disabled={registros.length===0}
                  style={{...S.btnSec,flex:1,color:"#a855f7",borderColor:"#a855f733",opacity:registros.length===0?0.5:1}}>📄 PDF</button>
              </div>

              {/* Toggle ativos / arquivados */}
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setShowArquivados(false)} style={{...S.btnSm,flex:1,padding:"7px",...(!showArquivados?{background:temaInfo.color+"22",border:`1px solid ${temaInfo.color}66`,color:temaInfo.color}:{})}}>Ativos ({ativos.length})</button>
                <button onClick={()=>setShowArquivados(true)} style={{...S.btnSm,flex:1,padding:"7px",...(showArquivados?{background:"#94a3b822",border:"1px solid #94a3b866",color:"#94a3b8"}:{})}}>📦 Arquivados ({arquivados.length})</button>
              </div>

              {visiveis.length===0 && (
                <div style={{textAlign:"center",padding:"36px 0"}}>
                  <div style={{fontSize:30,marginBottom:8}}>{showArquivados?"📦":temaInfo.icon}</div>
                  <div style={{fontSize:13,...S.txt}}>{showArquivados?"Nenhum registro arquivado":`Nenhum registro de ${temaInfo.label.toLowerCase()}`}</div>
                </div>
              )}

              {hoje.length>0 && (<>
                <div style={{fontSize:11,color:temaInfo.color,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Hoje</div>
                {hoje.map(r=><RegistroCard key={r.id} tema={tema} r={r} dark={dark||true} S={S} adminAuth={adminAuth}
                  onArquivar={()=>arquivar(r.id)} onDesarquivar={()=>desarquivar(r.id)}
                  onExcluir={()=>{if(window.confirm("Excluir definitivamente?")) excluir(r.id);}}/>)}
              </>)}
              {anteriores.length>0 && (<>
                <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginTop:4}}>Anteriores</div>
                {anteriores.map(r=><RegistroCard key={r.id} tema={tema} r={r} dark={dark||true} S={S} adminAuth={adminAuth}
                  onArquivar={()=>arquivar(r.id)} onDesarquivar={()=>desarquivar(r.id)}
                  onExcluir={()=>{if(window.confirm("Excluir definitivamente?")) excluir(r.id);}}/>)}
              </>)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
