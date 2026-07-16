// ─────────────────────────────────────────────────────────────
// RondaDiaria.jsx — Ronda Perimetral Diária (v3)
// Novidades desta versão:
// • Equipe: regra única p/ todos os projetos — TODOS os cargos entram,
//   exceto Porteiro, CDA e Vigilante CCO (central)
// • Executante por ronda: quem registra (líder) pode ser diferente de
//   quem executa — seletor em cada ronda, padrão = responsável do turno
// • Teste Perimetral dentro do plantão (só Golgi P601–P607): 1 por
//   plantão, zonas dinâmicas (➕ adiciona, numeração automática Z-01…),
//   OK/Parcial/Inoperante + observação; entra no PDF consolidado
// Correções da v2 (mantidas):
// • Foco no teclado: campos renderizados inline (sem componente aninhado)
//   — digitação contínua na observação e nos horários
// • Fotos por ronda (até 2), com opção de câmera; comprimidas p/ ~640px
// • Seleção de responsável: lista COMPLETA do cadastro Equipe do projeto,
//   excluindo apenas cargos de CCO
// • Armazenamento: 1 documento por plantão (rondas_plantoes/{id}) + índice
//   leve por projeto (rondas/{projectId}) — fotos não estouram o limite
//   de 1MB do Firestore. Compatível com plantões da versão anterior
//   (embutidos no índice): continuam legíveis e migram ao serem tocados.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { setDoc } from "./fireGuard";
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

const MAX_FOTOS_RONDA = 2;
const MAX_FOTOS_PLANTAO = 20; // segurança p/ o limite de 1MB do documento

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
const VESTIARIO_ELIGIBLE = ["P601","P602","P604","P605","P606"]; // ronda de vestiário — só Golgi (exceto P607)
const PERIMETRAL_ELIGIBLE = ["P601","P602","P604","P605","P606","P607"]; // teste perimetral dentro do plantão — todos os Golgi

// Mapa perimetral sobreposto (bolinha por zona) — projetos com posições aqui
// ganham as bolinhas coloridas sobre a foto aérea /mapas/{id}-ronda.jpg.
// Posições em % (x=esq→dir, y=topo→base). Cada índice casa com a Nª zona do teste (Z-01 = 1º ponto).
const ZONA_MAPA = {
  P602: [ {x:57,y:92}, {x:8,y:57}, {x:29,y:13}, {x:84,y:33} ],
};
const nomeZona = (i)=>`Z-${String(i+1).padStart(2,"0")}`;
const STATUS_ZONA = {
  ok:         { label:"OK",         mark:"✓", cor:"#22c55e", corPdf:"#16a34a" },
  parcial:    { label:"Parcial",    mark:"~", cor:"#f59e0b", corPdf:"#d97706" },
  inoperante: { label:"Inoperante", mark:"✗", cor:"#ef4444", corPdf:"#dc2626" },
};

// ── Foto: comprime para ~640px JPEG antes de guardar
function comprimirFoto(file){
  return new Promise((resolve)=>{
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const MAX = 640;
          let w = img.width, h = img.height;
          const s = Math.min(1, MAX/Math.max(w,h));
          w = Math.max(1, Math.round(w*s)); h = Math.max(1, Math.round(h*s));
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL("image/jpeg", 0.55));
        } catch(e){ resolve(null); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch(e){ resolve(null); }
  });
}

// ── Firestore
// Índice leve por projeto: rondas/{projectId} = { plantoes:[entrada leve], deletedIds }
// Plantão completo (com fotos): rondas_plantoes/{plantaoId}
// Compat: entradas antigas do índice podem trazer "rondas" embutidas.
function entradaLeve(p){
  return {
    id:p.id, dataPlantao:p.dataPlantao, turno:p.turno, lider:p.lider||"",
    nRondas:(p.rondas||[]).length, enviado:!!p.enviado, enviadoEm:p.enviadoEm||null,
    criadoEm:p.criadoEm||null,
  };
}
async function loadIndex(projectId){
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
async function loadPlantaoFull(entrada){
  if(!entrada) return null;
  if(entrada.rondas) return entrada; // formato antigo: já vem completo
  let data = null;
  try {
    const snap = await getDoc(doc(db,"rondas_plantoes",entrada.id));
    if(snap.exists()) data = snap.data();
  } catch(e){}
  if(!data){
    try { const l = localStorage.getItem(`rondas_full_${entrada.id}`); if(l) data = JSON.parse(l); } catch(e){}
  }
  return data || { ...entrada, rondas:[] };
}
async function saveIndex(projectId, idx){
  const payload = { ...idx, updatedAt:new Date().toISOString() };
  try { await setDoc(doc(db,"rondas",projectId), payload); } catch(e){ console.error("Rondas index save:", e); }
  try { localStorage.setItem(`rondas_${projectId}`, JSON.stringify(payload)); } catch(e){}
}
// ── Grava UMA entrada no índice sem sobrescrever o que outros dispositivos
// já salvaram enquanto esta tela estava aberta: busca a versão mais atual
// no servidor, funde a entrada (upsert por id) e só então salva de volta.
// Evita o "sumiço" de plantões quando dois líderes/turnos usam ao mesmo
// tempo (a versão antiga em memória de um não apaga a do outro).
async function saveIndexEntry(projectId, entradaAtualizada, deletedIdExtra){
  const fresco = await loadIndex(projectId);
  let plantoes;
  if(deletedIdExtra){
    plantoes = fresco.plantoes.filter(p=>p.id!==deletedIdExtra);
  } else {
    const jaExiste = fresco.plantoes.some(p=>p.id===entradaAtualizada.id);
    plantoes = jaExiste ? fresco.plantoes.map(p=>p.id===entradaAtualizada.id?entradaAtualizada:p) : [...fresco.plantoes, entradaAtualizada];
  }
  const deletedIds = deletedIdExtra ? [...new Set([...(fresco.deletedIds||[]), deletedIdExtra])] : (fresco.deletedIds||[]);
  const novoIdx = { plantoes, deletedIds };
  await saveIndex(projectId, novoIdx);
  return novoIdx;
}
async function savePlantaoFull(p){
  try { await setDoc(doc(db,"rondas_plantoes",p.id), p); } catch(e){ console.error("Plantao save:", e); }
  try { localStorage.setItem(`rondas_full_${p.id}`, JSON.stringify(p)); } catch(e){}
}

// ── Colaboradores: lista completa do cadastro Equipe (regra única, todos
// os projetos): entram TODOS os vigilantes disponíveis, EXCETO os cargos
// Porteiro, CDA e Vigilante CCO/Central. Folguista e cobertura de líder
// sempre entram.
const CARGOS_EXCLUIDOS = ["porteiro","cda","cco","central"];

function coberturaAtiva(colab){
  if(!colab?.coberturaAtiva || !colab.coberturaInicio || !colab.coberturaFim) return false;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const ini = new Date(colab.coberturaInicio+"T00:00:00");
  const fim = new Date(colab.coberturaFim+"T23:59:59");
  return hoje>=ini && hoje<=fim;
}

async function loadColaboradores(projectId){
  let equipe = null;
  try {
    const snap = await getDoc(doc(db,"equipes",projectId));
    if(snap.exists()) equipe = snap.data();
  } catch(e){}
  if(!equipe){
    try { const l = localStorage.getItem(`equipe_${projectId}`); if(l) equipe = JSON.parse(l); } catch(e){}
  }
  const ativos = (equipe?.colaboradores||[])
    .filter(c=>(c.status||"ativo")==="ativo" && (c.nome||"").trim());
  let filtrados = ativos.filter(c=>{
    const cg = norm(c.cargo);
    if(cg.includes("folg")) return true; // folguista cobre qualquer cargo, sempre entra
    if(coberturaAtiva(c)) return true; // cobertura temporária de líder também entra
    return !CARGOS_EXCLUIDOS.some(x=>cg.includes(x));
  });
  if(filtrados.length===0) filtrados = ativos; // cadastro só com cargos excluídos: não trava a operação
  return filtrados
    .sort((a,b)=>norm(a.nome).localeCompare(norm(b.nome)))
    .map(c=>({ nome:c.nome, cargo: coberturaAtiva(c) ? `${c.cargo} 🔁 cobertura líder` : (c.cargo||"") }));
}

function getStyles(dark) {
  return {
    page:    { minHeight:"100vh", background:dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 90px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:480, display:"flex", flexDirection:"column" },
    card:    { background:dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"14px 16px" },
    btn:     { background:"linear-gradient(135deg,#0d9488,#0f766e)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnSec:  { background:dark?"#060c18":"#f8fafc", color:dark?"#cbd5e1":"#475569", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
    btnSm:   { background:dark?"#020510":"#f8fafc", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#cbd5e1":"#475569", borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:700 },
    backBtn: { background:"transparent", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#cbd5e1":"#64748b", borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:700 },
    inp:     { width:"100%", background:dark?"#020510":"#ffffff", border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`, borderRadius:7, color:dark?"#e2e8f0":"#1e293b", padding:"9px 10px", fontSize:13, boxSizing:"border-box", outline:"none" },
    lbl:     { display:"block", fontSize:10, color:dark?"#94a3b8":"#64748b", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 },
    txt:     { color:dark?"#f8fafc":"#0f172a", fontWeight:600 },
    txt2:    { color:dark?"#94a3b8":"#64748b", fontWeight:500 },
  };
}

// ── PIN Gate (fallback — só aparece sem sessão válida)
function PinGate({ project, onSuccess, onBack, dark }) {
  const S = getStyles(dark);
  const [mode, setMode] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const tryPin = () => {
    if(pin==="601604"){ grantSession("demo"); onSuccess("admin"); return; } // PIN GAL demo
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

async function loadTodosPlantoes(projectId, idx){
  const entradas = idx.plantoes||[];
  const cheios = await Promise.all(entradas.map(e=>loadPlantaoFull(e)));
  return cheios.filter(Boolean).sort((a,b)=>(a.dataPlantao||"").localeCompare(b.dataPlantao||"")||(a.turno==="noturno"?1:-1));
}

function gerarPdfConsolidado(project, plantoes){
  const agora = new Date();
  const totalRondas = plantoes.reduce((a,p)=>a+((p.rondas||[]).length),0);
  const secoes = plantoes.map(p=>{
    const t = TURNO_UI[p.turno]||TURNO_UI.diurno;
    const linhas = (p.rondas||[]).map((r,i)=>`<tr>
        <td>${i+1}</td>
        <td>${r.inicio||"—"} – ${r.fim||"—"}</td>
        <td>${(r.executante||p.lider||"—").replace(/</g,"&lt;")}</td>
        <td>${r.externa?"Sim":"Não"}</td>
        <td>${(r.obs||"").replace(/</g,"&lt;")}</td>
      </tr>`).join("");
    const per = p.perimetral;
    const perHtml = per?.feito ? (()=>{
      const zonas = per.zonas||[];
      const marks = zonas.map((z,zi)=>{
        const st = STATUS_ZONA[z.status]||STATUS_ZONA.ok;
        return `<span style="color:${st.corPdf};font-weight:700">${nomeZona(zi)} ${st.mark}</span>`;
      }).join(" · ");
      const probs = zonas.map((z,zi)=>({z,zi})).filter(o=>{const s=o.z.status||"ok";return s!=="ok"&&o.z.obs;});
      return `<div style="font-size:11px;margin-bottom:6px">🔒 Teste Perimetral: ${zonas.length?marks:"realizado (sem zonas detalhadas)"}${per.obs?`<br><span style="color:#64748b">Obs: ${String(per.obs).replace(/</g,"&lt;")}</span>`:""}${probs.map(o=>`<br><span style="color:${(STATUS_ZONA[o.z.status]||STATUS_ZONA.ok).corPdf}">${nomeZona(o.zi)}: ${String(o.z.obs).replace(/</g,"&lt;")}</span>`).join("")}</div>`;
    })() : "";
    return `<div class="plantao">
      <div class="plantao-head">
        <div><b>${t.icon} ${t.label}</b> · ${fmtData(p.dataPlantao)} · Responsável: ${p.lider||"—"}</div>
        <div class="badge ${p.enviado?"ok":"pend"}">${p.enviado?"Enviado":"Pendente"}</div>
      </div>
      ${p.vestiario?.feito!=null?`<div style="font-size:11px;margin-bottom:6px;color:${p.vestiario.status==="anomalia"?"#dc2626":"#16a34a"}">🚿 Vestiário: ${p.vestiario.feito?(p.vestiario.status==="anomalia"?`⚠️ Anomalia — ${(p.vestiario.obs||"").replace(/</g,"&lt;")}`:"✅ OK"):"Não realizado"}</div>`:""}
      ${perHtml}
      <table><thead><tr><th>#</th><th>Horário</th><th>Executante</th><th>Externa</th><th>Observação</th></tr></thead>
      <tbody>${linhas||'<tr><td colspan="5" style="text-align:center;color:#94a3b8">Sem rondas registradas</td></tr>'}</tbody></table>
    </div>`;
  }).join("");
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Ronda Consolidada ${project.id}</title>
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;color:#0f172a;padding:20px;max-width:860px;margin:0 auto}
  h1{font-size:19px;margin:0}
  .sub{font-size:12px;color:#64748b;margin-top:2px}
  .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}
  .kpi{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
  .kpi-val{font-size:22px;font-weight:900}
  .kpi-lbl{font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:3px}
  .plantao{margin-top:18px;page-break-inside:avoid}
  .plantao-head{display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:6px}
  .badge{font-size:10px;font-weight:800;padding:3px 9px;border-radius:6px}
  .badge.ok{color:#16a34a;background:#f0fdf4;border:1px solid #bbf7d0}
  .badge.pend{color:#d97706;background:#fffbeb;border:1px solid #fde68a}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#1e293b;color:#fff;padding:6px 9px;text-align:left;font-size:10px}
  td{padding:6px 9px;border-bottom:1px solid #f1f5f9}
  .footer{text-align:center;margin-top:20px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
  @media print{body{padding:8px}@page{margin:10mm}.no-print{display:none}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}}
</style></head>
<body>
<div class="no-print" style="text-align:center;margin-bottom:14px">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<h1>🚶 Ronda Perimetral Diária — Consolidado ${project.id}</h1>
<div class="sub">${project.name||""} · Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-val">${plantoes.length}</div><div class="kpi-lbl">Plantões</div></div>
  <div class="kpi"><div class="kpi-val">${totalRondas}</div><div class="kpi-lbl">Rondas registradas</div></div>
  <div class="kpi"><div class="kpi-val">${plantoes.filter(p=>p.enviado).length}</div><div class="kpi-lbl">Enviados</div></div>
</div>
${secoes}
<div class="footer">MokLog CheckTest · Moked Consulting Security · Ronda Perimetral Diária ${project.id}</div>
</body></html>`;
  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ronda_consolidado_${project.id}_${agora.toLocaleDateString("sv-SE")}.html`;
  a.click();
}

// ── App principal
export default function RondaDiaria({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }) {
  const S = getStyles(dark);
  const [authLevel, setAuthLevel] = useState(()=>sharedAuth||getAccess(project?.id)||null);
  const [screen, setScreen] = useState(()=>(sharedAuth||getAccess(project?.id))?"home":"pin"); // pin | home | view
  const [idx, setIdx] = useState({ plantoes:[], deletedIds:[] });
  const [atualFull, setAtualFull] = useState(null);
  const [colabs, setColabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewFull, setViewFull] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [confirmEnvio, setConfirmEnvio] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [envioErr, setEnvioErr] = useState(null);
  const [openRondaId, setOpenRondaId] = useState(null); // accordion: só uma ronda aberta por vez
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [liderDropOpen, setLiderDropOpen] = useState(false); // lista de responsáveis em cascata (fechada por padrão)
  const adminAuth = authLevel==="admin";

  const turno = turnoAtual();
  const dataP = dataPlantaoAtual();
  const tui = TURNO_UI[turno];

  const saveTimer = useRef(null);
  const pendRef = useRef(null); // {full, idx} pendente de gravação

  useEffect(()=>{
    (async()=>{
      const [i, c] = await Promise.all([loadIndex(project.id), loadColaboradores(project.id)]);
      setIdx(i); setColabs(c);
      const entrada = (i.plantoes||[]).find(p=>p.dataPlantao===dataP && p.turno===turno);
      if(entrada){ setAtualFull(await loadPlantaoFull(entrada)); }
      setLoading(false);
    })();
    return ()=>{
      if(saveTimer.current){ clearTimeout(saveTimer.current); }
      if(pendRef.current){ savePlantaoFull(pendRef.current.full); saveIndexEntry(project.id, entradaLeve(pendRef.current.full)); }
    };
  },[project.id]); // eslint-disable-line

  const historico = (idx.plantoes||[]).filter(p=>!(p.dataPlantao===dataP && p.turno===turno))
    .sort((a,b)=>(b.dataPlantao||"").localeCompare(a.dataPlantao||"")||(a.turno==="noturno"?-1:1));

  const ant = slotAnterior(dataP, turno);
  const plantaoAnt = (idx.plantoes||[]).find(p=>p.dataPlantao===ant.dataPlantao && p.turno===ant.turno);
  const pendenciaAnt = (idx.plantoes||[]).length>0 && (!plantaoAnt || !plantaoAnt.enviado);

  // grava plantão completo + índice (entrada leve), com debounce e merge
  // seguro contra sobrescrita de outro dispositivo/turno usando ao mesmo tempo
  const persist = (full, imediato) => {
    const plantoes = (idx.plantoes||[]).some(p=>p.id===full.id)
      ? (idx.plantoes||[]).map(p=>p.id===full.id?entradaLeve(full):p)
      : [...(idx.plantoes||[]), entradaLeve(full)];
    setIdx({ ...idx, plantoes }); setAtualFull(full); // atualização otimista da tela
    pendRef.current = { full };
    if(saveTimer.current) clearTimeout(saveTimer.current);
    const doSave = async () => {
      pendRef.current = null;
      setSaving(true);
      await savePlantaoFull(full);
      const novoIdx = await saveIndexEntry(project.id, entradaLeve(full));
      setIdx(novoIdx); // sincroniza com o que realmente ficou salvo (inclui o que outros gravaram)
      setSaving(false);
    };
    if(imediato) doSave();
    else saveTimer.current = setTimeout(doSave, 1200);
  };
  const upsertAtual = (mut, imediato=true) => {
    // Encadeia a partir do último valor pendente (ainda não gravado), não do
    // "atualFull" da renderização — evita perder ronda quando duas ações
    // acontecem em sequência rápida (ex: marcar vestiário logo após
    // registrar uma ronda) e a segunda sobrescreve a primeira.
    let p = pendRef.current?.full || atualFull;
    if(!p){ p = { id:newId(), projectId:project.id, dataPlantao:dataP, turno, lider:"", rondas:[], enviado:false, criadoEm:new Date().toISOString() }; }
    persist(mut({ ...p, rondas:[...(p.rondas||[])] }), imediato);
    setEnvioErr(null);
  };

  const totalFotos = (atualFull?.rondas||[]).reduce((a,r)=>a+((r.fotos||[]).length),0);

  const addRonda = () => {
    const ini = horaAgora();
    const rid = newId();
    upsertAtual(p=>({ ...p, rondas:[...p.rondas, { id:rid, inicio:ini, fim:fimAuto(ini), externa:true, executante:(p.lider||""), obs:"", fotos:[] }] }));
    setOpenRondaId(rid); // colapsa a anterior, abre a nova
  };
  const editRonda = (rid, campo, valor, imediato=false) => {
    upsertAtual(p=>({ ...p, rondas:p.rondas.map(r=>{
      if(r.id!==rid) return r;
      const nr = { ...r, [campo]:valor };
      if(campo==="inicio") nr.fim = fimAuto(valor);
      return nr;
    })}), imediato);
  };
  const delRonda = (rid) => upsertAtual(p=>({ ...p, rondas:p.rondas.filter(r=>r.id!==rid) }));
  const setLider = (nome) => upsertAtual(p=>({ ...p, lider:nome }));
  const setVestiario = (campo,valor) => upsertAtual(p=>({ ...p, vestiario:{ feito:true, status:"ok", obs:"", ...(p.vestiario||{}), [campo]:valor } }), campo==="obs");

  // ── Teste Perimetral do plantão (só Golgi) — zonas dinâmicas, 1 teste por plantão
  const perBase = (p)=>({ feito:false, zonas:[], obs:"", ...(p.perimetral||{}) });
  // Zonas FIXAS (não dinâmicas) para projetos com mapa: sempre 4 zonas prontas,
  // gravadas por índice fixo (0→Zona 01 … 3→Zona 04), casando com as bolinhas do mapa.
  const NUM_ZONAS_FIXAS = (ZONA_MAPA[project.id]||[]).length; // 4 no P602, 0 nos demais
  const nomeZonaFixa = (i)=>`Zona 0${i+1}`;
  const setZonaFixa = (idx,campo,valor,imediato=true) => upsertAtual(p=>{
    const per = perBase(p);
    const zs = [...(per.zonas||[])];
    // garante que o array tenha ao menos idx+1 posições, cada uma com id estável
    while(zs.length < NUM_ZONAS_FIXAS){ zs.push({ id:newId(), status:"ok", obs:"" }); }
    zs[idx] = { ...zs[idx], [campo]:valor };
    return { ...p, perimetral:{ ...per, feito:true, zonas:zs } };
  }, imediato);
  const setPerimetral = (campo,valor,imediato=true) => upsertAtual(p=>({ ...p, perimetral:{ ...perBase(p), [campo]:valor } }), imediato);
  const addZonaPer = () => upsertAtual(p=>{ const per=perBase(p); return { ...p, perimetral:{ ...per, feito:true, zonas:[...(per.zonas||[]), { id:newId(), status:"ok", obs:"" }] } }; });
  const editZonaPer = (zid,campo,valor,imediato=true) => upsertAtual(p=>{ const per=perBase(p); return { ...p, perimetral:{ ...per, zonas:(per.zonas||[]).map(z=>z.id===zid?{...z,[campo]:valor}:z) } }; }, imediato);
  const delZonaPer = (zid) => upsertAtual(p=>{ const per=perBase(p); return { ...p, perimetral:{ ...per, zonas:(per.zonas||[]).filter(z=>z.id!==zid) } }; });

  const addFoto = async (rid, file) => {
    if(!file) return;
    if(totalFotos >= MAX_FOTOS_PLANTAO){ setEnvioErr(`Limite de ${MAX_FOTOS_PLANTAO} fotos por plantão atingido.`); return; }
    const b64 = await comprimirFoto(file);
    if(!b64){ setEnvioErr("Não consegui processar essa foto."); return; }
    upsertAtual(p=>({ ...p, rondas:p.rondas.map(r=>{
      if(r.id!==rid) return r;
      const fotos = [...(r.fotos||[])];
      if(fotos.length>=MAX_FOTOS_RONDA) return r;
      return { ...r, fotos:[...fotos, b64] };
    })}));
  };
  const delFoto = (rid, fi) => upsertAtual(p=>({ ...p, rondas:p.rondas.map(r=>r.id===rid?{...r,fotos:(r.fotos||[]).filter((_,j)=>j!==fi)}:r) }));

  const enviarTurno = () => {
    if(!atualFull || !atualFull.lider){ setEnvioErr("Selecione o responsável pelo turno antes de enviar."); setConfirmEnvio(false); return; }
    const validas = (atualFull.rondas||[]).filter(r=>(r.inicio||"").trim());
    if(validas.length===0){ setEnvioErr("Registre ao menos uma ronda antes de enviar."); setConfirmEnvio(false); return; }
    upsertAtual(p=>({ ...p, enviado:true, enviadoEm:new Date().toISOString() }));
    setConfirmEnvio(false);
  };
  const reabrirAtual = () => upsertAtual(p=>({ ...p, enviado:false, reabertoEm:new Date().toISOString() }));
  const reabrirView = async () => {
    if(!viewFull) return;
    const novo = { ...viewFull, enviado:false, reabertoEm:new Date().toISOString() };
    setViewFull(novo);
    setSaving(true);
    if(!viewFull.__embutido) await savePlantaoFull(novo);
    const novoIdx = await saveIndexEntry(project.id, entradaLeve(novo));
    setIdx(novoIdx);
    setSaving(false);
  };
  const excluirPlantao = async (pid) => {
    setSaving(true);
    const novoIdx = await saveIndexEntry(project.id, null, pid);
    setIdx(novoIdx);
    setSaving(false);
    setConfirmDel(false); setViewFull(null); setScreen("home");
  };
  const abrirView = async (entrada) => {
    setConfirmDel(false); setViewLoading(true); setScreen("view");
    if(entrada.rondas){ setViewFull({ ...entrada, __embutido:true }); setViewLoading(false); return; }
    const full = await loadPlantaoFull(entrada);
    setViewFull({ ...full, enviado:entrada.enviado, lider:full.lider||entrada.lider });
    setViewLoading(false);
  };

  const baixarPdfConsolidado = async () => {
    setGerandoPdf(true);
    const todos = await loadTodosPlantoes(project.id, idx);
    gerarPdfConsolidado(project, todos);
    setGerandoPdf(false);
  };

  if(screen==="pin") return <PinGate project={project} dark={dark} onBack={onBack} onSuccess={(l)=>{grantSession(l,project.id);setAuthLevel(l);setScreen("home");onAuthGranted?.(l);}}/>;

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.txt2,fontSize:13}}>Carregando rondas…</div>
    </div>
  );

  const Header = (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px 10px"}}>
      <style>{`@keyframes mkPulseDot{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(34,197,94,.6);}50%{opacity:.7;box-shadow:0 0 0 5px rgba(34,197,94,0);}}`}</style>
      <button onClick={()=>{ if(screen==="home") onBack(); else { setViewFull(null); setConfirmDel(false); setScreen("home"); } }} style={S.backBtn} aria-label="Voltar">←</button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:800,...S.txt}}>🚶 Ronda Perimetral Diária</div>
        <div style={{fontSize:10,...S.txt2}}>{project.id} · {project.name}</div>
      </div>
      {onToggleTheme && <button onClick={onToggleTheme} style={S.btnSm}>{dark?"☀️":"🌙"}</button>}
    </div>
  );

  // Linha de ronda INLINE (accordion): colapsada mostra resumo + bolinha
  // verde pulsando; expandida mostra os campos completos. Fecha sozinha
  // quando outra é aberta (addRonda já troca o openRondaId).
  const renderRonda = (r, i, travado) => {
    const aberta = openRondaId===r.id;
    const concluida = !!(r.inicio && r.fim);
    return (
      <div key={r.id} style={{...S.card,padding:aberta?"12px 14px":"10px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}
          onClick={()=>setOpenRondaId(aberta?null:r.id)}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {concluida && (
              <span style={{position:"relative",width:10,height:10,flexShrink:0}}>
                <span style={{position:"absolute",inset:0,borderRadius:"50%",background:"#22c55e",animation:"mkPulseDot 1.6s ease-in-out infinite"}}/>
              </span>
            )}
            <div style={{fontSize:16,fontWeight:900,...S.txt}}>Ronda {i+1}</div>
            {!aberta && <div style={{fontSize:13,fontWeight:600,...S.txt2}}>{r.inicio||"—"} – {r.fim||"—"}{r.executante?` · ${String(r.executante).split(" ")[0]}`:""}</div>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {!aberta && (r.fotos||[]).length>0 && <span style={{fontSize:12,...S.txt2}}>📷{(r.fotos||[]).length}</span>}
            <span style={{...S.txt2,fontSize:14,transform:aberta?"rotate(180deg)":"none",transition:"transform .2s"}}>▾</span>
          </div>
        </div>
        {aberta && (
          <div style={{marginTop:12}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
              <button disabled={travado} onClick={()=>!travado&&editRonda(r.id,"externa",!r.externa,true)}
                style={{...S.btnSm, fontSize:13, padding:"7px 12px", color:r.externa?"#22c55e":(dark?"#64748b":"#475569"), borderColor:r.externa?"#22c55e44":undefined, opacity:travado?.6:1}}>
                {r.externa?"✓ Externa":"Externa?"}
              </button>
              {!travado && <button onClick={()=>delRonda(r.id)} style={{...S.btnSm,fontSize:13,padding:"7px 12px",color:"#ef4444",borderColor:"#ef444433",marginLeft:6}}>🗑</button>}
            </div>
            <div style={{marginBottom:10}}>
              <label style={{...S.lbl,fontSize:11}}>👤 Executante da ronda</label>
              <select value={r.executante||""} disabled={travado}
                onChange={e=>editRonda(r.id,"executante",e.target.value,true)}
                style={{...S.inp,fontSize:14,padding:"11px 12px",opacity:travado?.7:1}}>
                <option value="">— selecionar —</option>
                {r.executante && !colabs.some(c=>c.nome===r.executante) && <option value={r.executante}>{r.executante}</option>}
                {colabs.map(c=><option key={c.nome} value={c.nome}>{c.nome}{c.cargo?` · ${c.cargo}`:""}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}>
                <label style={{...S.lbl,fontSize:11}}>Início</label>
                <input type="time" value={r.inicio||""} disabled={travado} onChange={e=>editRonda(r.id,"inicio",e.target.value)} style={{...S.inp,fontSize:15,padding:"11px 12px"}}/>
              </div>
              <div style={{flex:1}}>
                <label style={{...S.lbl,fontSize:11}}>Fim (auto +20 min)</label>
                <input type="time" value={r.fim||""} disabled={travado} onChange={e=>editRonda(r.id,"fim",e.target.value)} style={{...S.inp,fontSize:15,padding:"11px 12px"}}/>
              </div>
            </div>
            <div style={{marginTop:10}}>
              <input value={r.obs||""} disabled={travado} onChange={e=>editRonda(r.id,"obs",e.target.value)}
                placeholder="Observação (ex: teste de zonas, intervalo CCO)" style={{...S.inp,fontSize:14,padding:"11px 12px"}}/>
            </div>
            <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center",flexWrap:"wrap"}}>
              {(r.fotos||[]).map((f,fi)=>(
                <div key={fi} style={{position:"relative"}}>
                  <img src={f} alt={`Foto ${fi+1}`} style={{width:68,height:68,objectFit:"cover",borderRadius:8,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,display:"block"}}/>
                  {!travado && <button onClick={()=>delFoto(r.id,fi)}
                    style={{position:"absolute",top:-6,right:-6,background:"#ef4444",color:"#fff",border:"none",borderRadius:"50%",width:21,height:21,fontSize:12,cursor:"pointer",lineHeight:"21px",padding:0}}>×</button>}
                </div>
              ))}
              {!travado && (r.fotos||[]).length<MAX_FOTOS_RONDA && (
                <>
                  <label style={{...S.btnSm,padding:"10px 13px",fontSize:13,display:"inline-flex",alignItems:"center",gap:6}}>
                    📷 Câmera
                    <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                      onChange={e=>{ addFoto(r.id, e.target.files?.[0]); e.target.value=""; }}/>
                  </label>
                  <label style={{...S.btnSm,padding:"10px 13px",fontSize:13,display:"inline-flex",alignItems:"center",gap:6}}>
                    🖼️ Galeria
                    <input type="file" accept="image/*" style={{display:"none"}}
                      onChange={e=>{ addFoto(r.id, e.target.files?.[0]); e.target.value=""; }}/>
                  </label>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── TELA: detalhe de plantão do histórico
  if(screen==="view"){
    const p = viewFull;
    const t = p ? (TURNO_UI[p.turno]||TURNO_UI.diurno) : TURNO_UI.diurno;
    return (
      <div style={S.page}><div style={S.wrap}>
        {Header}
        <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
          {viewLoading || !p ? (
            <div style={{...S.card,textAlign:"center",fontSize:12,...S.txt2}}>Carregando plantão…</div>
          ) : (
            <>
              <div style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:800,...S.txt}}>{t.icon} {t.label} · {fmtData(p.dataPlantao)}</div>
                    <div style={{fontSize:11,...S.txt2}}>Responsável: {p.lider||"—"} · {(p.rondas||[]).length} ronda{(p.rondas||[]).length===1?"":"s"}</div>
                  </div>
                  <span style={{fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:6,
                    color:p.enviado?"#22c55e":"#f59e0b", background:p.enviado?"#021a0d":"#1a1000",
                    border:`1px solid ${p.enviado?"#22c55e33":"#f59e0b33"}`}}>{p.enviado?"✅ Enviado":"⏳ Pendente"}</span>
                </div>
              </div>
              {p.perimetral?.feito && (
                <div style={S.card}>
                  <div style={{fontSize:11,fontWeight:800,...S.txt,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>🔒 Teste Perimetral — realizado</div>
                  {(p.perimetral.zonas||[]).length>0 ? (
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      {(p.perimetral.zonas||[]).map((z,zi)=>{
                        const st = STATUS_ZONA[z.status]||STATUS_ZONA.ok;
                        return (
                          <div key={z.id||zi} style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}>
                            <span style={{width:8,height:8,borderRadius:"50%",background:st.cor,flexShrink:0}}/>
                            <span style={{fontWeight:800,...S.txt}}>{nomeZona(zi)}</span>
                            <span style={{color:st.cor,fontWeight:700,marginLeft:"auto"}}>{st.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : <div style={{fontSize:11,...S.txt2}}>Sem zonas detalhadas.</div>}
                  {(p.perimetral.zonas||[]).map((z,zi)=>((z.status==="parcial"||z.status==="inoperante")&&z.obs)?(
                    <div key={"o"+(z.id||zi)} style={{fontSize:11,...S.txt2,marginTop:6}}><span style={{fontWeight:800,color:(STATUS_ZONA[z.status]||STATUS_ZONA.ok).cor}}>{nomeZona(zi)}:</span> {z.obs}</div>
                  ):null)}
                  {p.perimetral.obs && <div style={{fontSize:11,...S.txt2,marginTop:6}}>Obs: {p.perimetral.obs}</div>}
                </div>
              )}
              {(p.rondas||[]).map((r,i)=>(
                <div key={r.id} style={{...S.card,padding:"10px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <div style={{fontSize:12,fontWeight:800,...S.txt}}>Ronda {i+1}</div>
                    <div style={{fontSize:12,...S.txt2}}>{r.inicio||"—"} – {r.fim||"—"} {r.externa?"· Externa (sim)":""}</div>
                  </div>
                  {r.executante && <div style={{fontSize:11,...S.txt2,marginTop:2}}>👤 Executou: {r.executante}</div>}
                  {r.obs && <div style={{fontSize:11,...S.txt2,marginTop:4}}>{r.obs}</div>}
                  {(r.fotos||[]).length>0 && (
                    <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                      {(r.fotos||[]).map((f,fi)=><img key={fi} src={f} alt={`Foto ${fi+1}`} style={{width:96,height:96,objectFit:"cover",borderRadius:8,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}/>)}
                    </div>
                  )}
                </div>
              ))}
              {adminAuth && p.enviado && <button onClick={reabrirView} style={{...S.btnSec,fontSize:13}}>🔓 Reabrir plantão (gerencial)</button>}
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
            </>
          )}
          <button onClick={()=>{setViewFull(null);setConfirmDel(false);setScreen("home");}} style={{...S.btnSec,fontSize:13}}>← Voltar</button>
        </div>
      </div></div>
    );
  }

  // ── TELA: home (plantão atual + histórico)
  const travado = !!atualFull?.enviado;
  const nRondas = (atualFull?.rondas||[]).length;
  return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>

        {(()=>{
          const pts = ZONA_MAPA[project.id];
          const zonas = atualFull?.perimetral?.zonas || [];
          return (
            <div style={{position:"relative",width:"100%"}}>
              <img src={`/mapas/${project.id}-ronda.jpg`} alt="" style={{width:"100%",borderRadius:12,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,display:"block"}}
                onError={(e)=>{e.currentTarget.style.display="none";}}/>
              {pts && pts.map((p,idx)=>{
                const z = zonas[idx];
                const st = z ? (STATUS_ZONA[z.status]||STATUS_ZONA.ok) : null;
                const cor = st ? st.cor : "#64748b";
                return (
                  <div key={idx} title={`Zona 0${idx+1}${st?` — ${st.label}`:""}`}
                    style={{position:"absolute",left:`${p.x}%`,top:`${p.y}%`,transform:"translate(-50%,-50%)",
                      display:"flex",flexDirection:"column",alignItems:"center",gap:2,pointerEvents:"none"}}>
                    <div style={{width:16,height:16,borderRadius:"50%",background:cor,
                      border:"2px solid #fff",boxShadow:"0 1px 4px rgba(0,0,0,.5)"}}/>
                    <span style={{fontSize:9,fontWeight:800,color:"#fff",textShadow:"0 1px 2px #000",lineHeight:1}}>{`0${idx+1}`}</span>
                  </div>
                );
              })}
              {pts && (
                <div style={{position:"absolute",right:6,bottom:6,display:"flex",gap:8,background:"#000000aa",
                  borderRadius:7,padding:"4px 8px",pointerEvents:"none"}}>
                  {Object.values(STATUS_ZONA).map((c,i)=>(
                    <span key={i} style={{display:"flex",alignItems:"center",gap:3,fontSize:9,fontWeight:700,color:"#fff"}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:c.cor}}/>{c.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {pendenciaAnt && (
          <div style={{...S.card,border:"1px solid #ef444455",background:dark?"#1a0202":"#fef2f2"}}>
            <div style={{fontSize:12,fontWeight:800,color:"#ef4444"}}>⚠️ Plantão anterior sem envio</div>
            <div style={{fontSize:11,...S.txt2,marginTop:2}}>{TURNO_UI[ant.turno].icon} {TURNO_UI[ant.turno].label} de {fmtData(ant.dataPlantao)} {plantaoAnt?"não foi enviado.":"não foi registrado."}</div>
          </div>
        )}

        <div style={{...S.card,border:`1px solid ${tui.cor}44`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:17,fontWeight:900,color:tui.cor}}>{tui.icon} {tui.label} · {fmtData(dataP)}</div>
            {travado
              ? <span style={{fontSize:10,fontWeight:800,color:"#22c55e",background:"#021a0d",border:"1px solid #22c55e33",padding:"3px 9px",borderRadius:6}}>✅ Enviado</span>
              : <span style={{fontSize:10,fontWeight:700,...S.txt2}}>envio até {tui.limite}</span>}
          </div>
          <div style={{marginTop:10}}>
            <label style={S.lbl}>Responsável pelo registro</label>
            {atualFull?.lider ? (
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1,fontSize:16,fontWeight:800,...S.txt}}>{atualFull.lider}</div>
                {!travado && <button onClick={()=>{setLider("");setLiderDropOpen(false);}} style={S.btnSm}>trocar</button>}
              </div>
            ) : (
              <div>
                <button onClick={()=>setLiderDropOpen(o=>!o)}
                  style={{...S.inp,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",fontSize:14,fontWeight:600,color:dark?"#94a3b8":"#64748b"}}>
                  <span>Toque para selecionar…</span>
                  <span style={{fontSize:11,transform:liderDropOpen?"rotate(180deg)":"none",transition:"transform .15s"}}>▾</span>
                </button>
                {liderDropOpen && (
                  <div style={{marginTop:6,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderRadius:8,overflow:"hidden",maxHeight:260,overflowY:"auto"}}>
                    {colabs.map((c,i)=>(
                      <button key={c.nome} onClick={()=>{setLider(c.nome);setLiderDropOpen(false);}}
                        style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"12px 14px",
                          background:dark?"#020510":"#fff",border:"none",borderTop:i>0?`1px solid ${dark?"#0f172a":"#e2e8f0"}`:"none",
                          cursor:"pointer",fontSize:14,fontWeight:700,color:dark?"#f8fafc":"#1e293b",textAlign:"left"}}>
                        {c.nome}<span style={{fontSize:10,fontWeight:600,...S.txt2}}>{c.cargo}</span>
                      </button>
                    ))}
                    {colabs.length===0 && <div style={{padding:"12px 14px",fontSize:11,...S.txt2}}>Nenhum colaborador no cadastro Equipe — cadastre a equipe primeiro.</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {VESTIARIO_ELIGIBLE.includes(project.id) && (()=>{
          const v = atualFull?.vestiario || {};
          const marcado = !!v.feito;
          return (
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <label style={S.lbl}>🚿 Ronda Vestiário</label>
                <button disabled={travado} onClick={()=>!travado&&setVestiario("feito",!marcado)}
                  style={{...S.btnSm,fontSize:12,padding:"7px 14px",color:marcado?"#22c55e":(dark?"#cbd5e1":"#475569"),borderColor:marcado?"#22c55e44":undefined,opacity:travado?.6:1}}>
                  {marcado?"✓ Feita":"Marcar como feita"}
                </button>
              </div>
              {marcado && (
                <>
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button disabled={travado} onClick={()=>!travado&&setVestiario("status","ok")}
                      style={{flex:1,padding:"10px",borderRadius:8,fontWeight:800,fontSize:13,cursor:travado?"default":"pointer",
                        border:`1px solid ${v.status==="ok"||!v.status?"#22c55e":(dark?"#0f172a":"#e2e8f0")}`,background:v.status==="ok"||!v.status?"#22c55e22":(dark?"#020510":"#fff"),
                        color:v.status==="ok"||!v.status?"#22c55e":(dark?"#cbd5e1":"#94a3b8"),opacity:travado?.6:1}}>✅ OK</button>
                    <button disabled={travado} onClick={()=>!travado&&setVestiario("status","anomalia")}
                      style={{flex:1,padding:"10px",borderRadius:8,fontWeight:800,fontSize:13,cursor:travado?"default":"pointer",
                        border:`1px solid ${v.status==="anomalia"?"#ef4444":(dark?"#0f172a":"#e2e8f0")}`,background:v.status==="anomalia"?"#ef444422":(dark?"#020510":"#fff"),
                        color:v.status==="anomalia"?"#ef4444":(dark?"#cbd5e1":"#94a3b8"),opacity:travado?.6:1}}>⚠️ Anomalia</button>
                  </div>
                  {v.status==="anomalia" && (
                    <input value={v.obs||""} disabled={travado} onChange={e=>setVestiario("obs",e.target.value)}
                      placeholder="Descreva a anomalia..." style={{...S.inp,fontSize:13,marginTop:8}}/>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {PERIMETRAL_ELIGIBLE.includes(project.id) && (()=>{
          const per = atualFull?.perimetral || {};
          const marcado = !!per.feito;
          const zonas = per.zonas||[];
          return (
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <label style={S.lbl}>🔒 Teste Perimetral</label>
                <button disabled={travado} onClick={()=>!travado&&setPerimetral("feito",!marcado)}
                  style={{...S.btnSm,fontSize:12,padding:"7px 14px",color:marcado?"#22c55e":(dark?"#cbd5e1":"#475569"),borderColor:marcado?"#22c55e44":undefined,opacity:travado?.6:1}}>
                  {marcado?"✓ Feito":"Marcar como feito"}
                </button>
              </div>
              {marcado && NUM_ZONAS_FIXAS>0 && (
                <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
                  {Array.from({length:NUM_ZONAS_FIXAS}).map((_,zi)=>{
                    const z = zonas[zi] || { status:"ok", obs:"" };
                    const precisaObs = (z.status==="parcial"||z.status==="inoperante");
                    return (
                      <div key={zi} style={{border:`1px solid ${precisaObs?(STATUS_ZONA[z.status].cor+"66"):(dark?"#0f172a":"#e2e8f0")}`,borderRadius:8,padding:"9px 10px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{fontSize:13,fontWeight:900,...S.txt,minWidth:66}}>{nomeZonaFixa(zi)}</div>
                          <div style={{display:"flex",gap:5,flex:1}}>
                            {Object.entries(STATUS_ZONA).map(([k,cfg])=>{
                              const sel = (z.status||"ok")===k;
                              return (
                                <button key={k} disabled={travado} onClick={()=>!travado&&setZonaFixa(zi,"status",k)}
                                  style={{flex:1,padding:"9px 4px",borderRadius:7,fontWeight:800,fontSize:11,cursor:travado?"default":"pointer",
                                    border:`1px solid ${sel?cfg.cor:(dark?"#0f172a":"#e2e8f0")}`,
                                    background:sel?cfg.cor+"22":(dark?"#020510":"#fff"),
                                    color:sel?cfg.cor:(dark?"#cbd5e1":"#94a3b8"),opacity:travado?.6:1}}>
                                  {cfg.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {precisaObs && (
                          <input value={z.obs||""} disabled={travado} onChange={e=>setZonaFixa(zi,"obs",e.target.value,false)}
                            placeholder={`Justifique a ${nomeZonaFixa(zi)} (ex: testado, perímetro não disparou)...`}
                            style={{...S.inp,fontSize:13,marginTop:8,borderColor:STATUS_ZONA[z.status].cor+"55"}}/>
                        )}
                      </div>
                    );
                  })}
                  <input value={per.obs||""} disabled={travado} onChange={e=>setPerimetral("obs",e.target.value,false)}
                    placeholder="Observação geral do teste (opcional)..." style={{...S.inp,fontSize:13}}/>
                </div>
              )}
              {marcado && NUM_ZONAS_FIXAS===0 && (
                <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
                  {zonas.map((z,zi)=>{
                    const st = STATUS_ZONA[z.status]||STATUS_ZONA.ok;
                    return (
                      <div key={z.id} style={{border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderRadius:8,padding:"8px 10px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{fontSize:13,fontWeight:900,...S.txt,minWidth:44}}>{nomeZona(zi)}</div>
                          <div style={{display:"flex",gap:5,flex:1}}>
                            {Object.entries(STATUS_ZONA).map(([k,cfg])=>(
                              <button key={k} disabled={travado} onClick={()=>!travado&&editZonaPer(z.id,"status",k)}
                                style={{flex:1,padding:"8px 4px",borderRadius:7,fontWeight:800,fontSize:11,cursor:travado?"default":"pointer",
                                  border:`1px solid ${z.status===k||( !z.status&&k==="ok")?cfg.cor:(dark?"#0f172a":"#e2e8f0")}`,
                                  background:z.status===k||(!z.status&&k==="ok")?cfg.cor+"22":(dark?"#020510":"#fff"),
                                  color:z.status===k||(!z.status&&k==="ok")?cfg.cor:(dark?"#cbd5e1":"#94a3b8"),opacity:travado?.6:1}}>
                                {cfg.label}
                              </button>
                            ))}
                          </div>
                          {!travado && <button onClick={()=>delZonaPer(z.id)} style={{...S.btnSm,padding:"6px 9px",fontSize:12,color:"#ef4444",borderColor:"#ef444433"}}>🗑</button>}
                        </div>
                        {(z.status==="parcial"||z.status==="inoperante") && (
                          <input value={z.obs||""} disabled={travado} onChange={e=>editZonaPer(z.id,"obs",e.target.value,false)}
                            placeholder={`Observação da ${nomeZona(zi)}...`} style={{...S.inp,fontSize:13,marginTop:8}}/>
                        )}
                      </div>
                    );
                  })}
                  {!travado && (
                    <button onClick={addZonaPer} style={{...S.btnSec,fontSize:13,padding:"11px 14px"}}>➕ Adicionar zona ({zonas.length===0?"Z-01":nomeZona(zonas.length)})</button>
                  )}
                  <input value={per.obs||""} disabled={travado} onChange={e=>setPerimetral("obs",e.target.value,false)}
                    placeholder="Observação geral do teste (opcional)..." style={{...S.inp,fontSize:13}}/>
                </div>
              )}
            </div>
          );
        })()}

        {(atualFull?.rondas||[]).map((r,i)=>renderRonda(r,i,travado))}

        {!travado && (atualFull?.lider
          ? <button onClick={addRonda} style={S.btn}>▶ Registrar ronda (agora)</button>
          : <div style={{...S.card,textAlign:"center",fontSize:12,...S.txt2,border:"1px solid #f59e0b44"}}>⚠️ Selecione o responsável acima antes de registrar a primeira ronda.</div>
        )}

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
        {travado && adminAuth && <button onClick={reabrirAtual} style={{...S.btnSec,fontSize:13}}>🔓 Reabrir plantão (gerencial)</button>}
        {saving && <div style={{fontSize:10,...S.txt2,textAlign:"center"}}>salvando…</div>}

        {adminAuth && (
          <button onClick={baixarPdfConsolidado} disabled={gerandoPdf} style={{...S.btn,background:"linear-gradient(135deg,#7c3aed,#6d28d9)",opacity:gerandoPdf?.7:1}}>
            {gerandoPdf?"Gerando…":"📄 PDF Consolidado (gerencial)"}
          </button>
        )}

        {historico.length>0 && <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginTop:4}}>Plantões anteriores ({historico.length})</div>}
        {historico.map(p=>{
          const t = TURNO_UI[p.turno]||TURNO_UI.diurno;
          const nr = p.rondas ? p.rondas.length : (p.nRondas||0);
          return (
            <button key={p.id} onClick={()=>abrirView(p)}
              style={{...S.card,cursor:"pointer",textAlign:"left",width:"100%",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>{t.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,...S.txt}}>{t.label} · {fmtData(p.dataPlantao)}</div>
                <div style={{fontSize:10,...S.txt2}}>{nr} ronda{nr===1?"":"s"} · {p.lider||"—"}</div>
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
