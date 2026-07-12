// ─────────────────────────────────────────────────────────────
// EnergiaOcorrencias.jsx — Ocorrências de Energia (todos os projetos)
//
// Fluxo pensado pra ser rápido no calor da hora:
// 1. Caiu a luz → toca "⚡ Registrar Queda (agora)" — só isso, marca o
//    início e já mostra um cronômetro ao vivo na home.
// 2. Voltou → toca "✅ Concluir — Voltou a energia" e preenche o resto:
//    protocolo, operador, gerador, manutencista, impacto na operação,
//    inquilino(s) afetado(s), observações, foto.
// 3. Depois de concluído: 📄 PDF do evento, 📲 WhatsApp com o resumo
//    pronto (abre o compartilhamento — quem escolhe o grupo é você) e
//    📥 Arquivar.
// • Contador da home: "X dias sem quedas" contado a partir do fim da
//   última queda concluída. Assim que uma nova queda é registrada, a
//   home já mostra "⚡ Sem energia agora" no lugar do contador.
// • Cabeçalho fixo (concessionária/telefone/CNPJ/instalação) configurado
//   uma vez pelo gerencial.
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

function newId(){ try { return crypto.randomUUID(); } catch { return "id-"+Date.now()+"-"+Math.random().toString(36).slice(2,8); } }
function pad2(n){ return String(n).padStart(2,"0"); }
function nowLocalInput(){ const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function fmtDataHora(iso){ if(!iso) return "—"; try { const d=new Date(iso); return d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); } catch { return "—"; } }
function fmtHora(iso){ if(!iso) return "—"; try { return new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); } catch { return "—"; } }
function turnoAgora(){ const h=new Date().getHours(); return (h>=6&&h<18) ? "Diurno" : "Noturno"; }
function duracaoFmt(msIni, msFim){
  const diff = Math.max(0, msFim-msIni);
  const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
  return `${h}h ${m}min`;
}

async function loadEnergia(projectId){
  let data = null;
  try {
    const snap = await getDoc(doc(db,"energia_ocorrencias",projectId));
    if(snap.exists()){ data=snap.data(); try{localStorage.setItem(`energia_${projectId}`,JSON.stringify(data));}catch(e){} }
  } catch(e){}
  if(!data){ try{ const l=localStorage.getItem(`energia_${projectId}`); if(l) data=JSON.parse(l); }catch(e){} }
  data = data || {};
  return { config: data.config||{}, eventos: data.eventos||[] };
}
async function saveEnergia(projectId, data){
  const payload = { ...data, updatedAt:new Date().toISOString() };
  try { await setDoc(doc(db,"energia_ocorrencias",projectId), payload); } catch(e){ console.error("energia save:", e); }
  try { localStorage.setItem(`energia_${projectId}`, JSON.stringify(payload)); } catch(e){}
}

// ── Puxado pelo relatório semanal (App.jsx) — resumo dos últimos 7 dias
export async function loadEnergiaResumoParaPDF(projectId, diasJanela=7){
  const { eventos } = await loadEnergia(projectId);
  const corte = Date.now() - diasJanela*86400000;
  const doPeriodo = eventos.filter(e=>e.inicioQueda && new Date(e.inicioQueda).getTime()>=corte);
  const tempoTotalMs = doPeriodo.reduce((a,e)=>a+(e.fimQueda?(new Date(e.fimQueda)-new Date(e.inicioQueda)):0),0);
  return { quedas: doPeriodo.length, tempoTotalMs, eventos: doPeriodo };
}

function comprimirFoto(file){
  return new Promise((resolve)=>{
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const MAX=640; let w=img.width,h=img.height;
          const s=Math.min(1,MAX/Math.max(w,h));
          w=Math.max(1,Math.round(w*s)); h=Math.max(1,Math.round(h*s));
          const c=document.createElement("canvas"); c.width=w; c.height=h;
          c.getContext("2d").drawImage(img,0,0,w,h);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL("image/jpeg",0.6));
        } catch(e){ resolve(null); }
      };
      img.onerror=()=>{URL.revokeObjectURL(url);resolve(null);};
      img.src=url;
    } catch(e){ resolve(null); }
  });
}

// ── Mensagem pronta pro WhatsApp (o usuário escolhe o grupo/contato ao compartilhar)
function montarMensagemWhats(project, config, ev){
  const linhas = [
    `⚡ *QUEDA DE ENERGIA — ${project.id} ${project.name||""}*`,
    ``,
    `🕐 De ${fmtDataHora(ev.inicioQueda)} até ${fmtDataHora(ev.fimQueda)} (${duracaoFmt(new Date(ev.inicioQueda),new Date(ev.fimQueda))})`,
    `🏭 Turno: ${ev.turno||"—"}`,
    `📋 Protocolo concessionária: ${ev.protocolo||"—"}`,
    `☎️ ${config.concessionaria||"—"} · ${config.telefoneConcessionaria||"—"}`,
    ``,
    `🔌 Gerador acionado: ${ev.gerador==="sim"?"Sim":"Não"}${ev.gerador!=="sim"&&ev.obsGerador?` — ${ev.obsGerador}`:""}`,
    `🔧 Manutencista acionado: ${ev.manutencista?"Sim":"Não"}`,
    `🏢 Impacto na operação: ${ev.impactoOperacao?"Sim":"Não"}${ev.impactoOperacao&&ev.obsImpacto?` — ${ev.obsImpacto}`:""}`,
    `👥 Inquilino(s) impactado(s): ${ev.inquilinoImpactado?(ev.inquilinosAfetados||"Sim"):"Não"}`,
  ];
  if(ev.obs) linhas.push(``, `📝 ${ev.obs}`);
  linhas.push(``, `Operador: ${ev.operador||"—"} · Registrado via MokLog CheckTest`);
  return linhas.join("\n");
}
function abrirWhatsApp(project, config, ev){
  const msg = montarMensagemWhats(project, config, ev);
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
}

function gerarPdfEvento(project, config, ev){
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Queda de Energia ${project.id}</title>
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;color:#0f172a;padding:20px;max-width:760px;margin:0 auto}
  h1{font-size:18px;margin:0} .sub{font-size:12px;color:#64748b;margin-top:2px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-top:12px}
  .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:12px}
  .lbl{color:#64748b;font-weight:700}
  @media print{body{padding:8px}@page{margin:10mm}.no-print{display:none}}
</style></head><body>
<div class="no-print" style="text-align:center;margin-bottom:14px"><button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button></div>
<h1>⚡ Queda de Energia — ${project.id}</h1>
<div class="sub">${project.name||""} · ${config.concessionaria||"—"} (${config.telefoneConcessionaria||"—"})</div>
<div class="card">
  <div class="row"><span class="lbl">Início</span><span>${fmtDataHora(ev.inicioQueda)}</span></div>
  <div class="row"><span class="lbl">Retorno</span><span>${fmtDataHora(ev.fimQueda)}</span></div>
  <div class="row"><span class="lbl">Duração</span><span>${duracaoFmt(new Date(ev.inicioQueda),new Date(ev.fimQueda))}</span></div>
  <div class="row"><span class="lbl">Turno</span><span>${ev.turno||"—"}</span></div>
  <div class="row"><span class="lbl">Protocolo</span><span>${ev.protocolo||"—"}</span></div>
  <div class="row"><span class="lbl">Operador</span><span>${ev.operador||"—"}</span></div>
  <div class="row"><span class="lbl">Gerador acionado</span><span>${ev.gerador==="sim"?"Sim":"Não"}${ev.obsGerador?` — ${ev.obsGerador}`:""}</span></div>
  <div class="row"><span class="lbl">Manutencista acionado</span><span>${ev.manutencista?"Sim":"Não"}</span></div>
  <div class="row"><span class="lbl">Impacto na operação</span><span>${ev.impactoOperacao?"Sim":"Não"}${ev.obsImpacto?` — ${ev.obsImpacto}`:""}</span></div>
  <div class="row"><span class="lbl">Inquilino impactado</span><span>${ev.inquilinoImpactado?(ev.inquilinosAfetados||"Sim"):"Não"}</span></div>
  <div class="row" style="border:none"><span class="lbl">Observações</span><span>${ev.obs||"—"}</span></div>
</div>
${ev.foto?`<div class="card"><img src="${ev.foto}" style="width:100%;border-radius:8px"/></div>`:""}
</body></html>`;
  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`energia_${project.id}_${new Date(ev.inicioQueda).toLocaleDateString("sv-SE")}.html`; a.click();
}

// ── Relatório por período (Semanal/Quinzenal/Mensal) — admin
function gerarPdfPeriodo(project, eventos, dias, label){
  const corte = Date.now() - dias*86400000;
  const doPeriodo = eventos.filter(e=>e.inicioQueda && new Date(e.inicioQueda).getTime()>=corte).sort((a,b)=>(b.inicioQueda||"").localeCompare(a.inicioQueda||""));
  const tempoTotalMs = doPeriodo.reduce((a,e)=>a+(e.fimQueda?(new Date(e.fimQueda)-new Date(e.inicioQueda)):0),0);
  const totH = Math.floor(tempoTotalMs/3600000), totM = Math.floor((tempoTotalMs%3600000)/60000);
  const mediaDias = doPeriodo.length>1 ? Math.round((dias/doPeriodo.length)*10)/10 : (doPeriodo.length===1?dias:dias);
  const geradores = doPeriodo.filter(e=>e.gerador==="sim").length;
  const manutencistas = doPeriodo.filter(e=>e.manutencista).length;
  const linhas = doPeriodo.map(e=>`<tr>
      <td>${fmtDataHora(e.inicioQueda)}</td>
      <td>${e.fimQueda?duracaoFmt(new Date(e.inicioQueda),new Date(e.fimQueda)):"em aberto"}</td>
      <td>${e.turno||"—"}</td>
      <td style="text-align:center">${e.gerador==="sim"?"✅":"—"}</td>
      <td style="text-align:center">${e.manutencista?"✅":"—"}</td>
      <td style="text-align:center">${e.impactoOperacao?"⚠️":"—"}</td>
      <td>${e.protocolo||"—"}</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Energia ${label} ${project.id}</title>
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;color:#0f172a;padding:20px;max-width:900px;margin:0 auto}
  h1{font-size:19px;margin:0} .sub{font-size:12px;color:#64748b;margin-top:2px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
  .kpi{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
  .kpi-val{font-size:20px;font-weight:900} .kpi-lbl{font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:3px}
  table{width:100%;border-collapse:collapse;font-size:11px} th{background:#1e293b;color:#fff;padding:6px 9px;text-align:left;font-size:10px}
  td{padding:6px 9px;border-bottom:1px solid #f1f5f9}
  .footer{text-align:center;margin-top:18px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
  @media print{body{padding:8px}@page{margin:10mm}.no-print{display:none}}
</style></head><body>
<div class="no-print" style="text-align:center;margin-bottom:14px"><button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button></div>
<h1>⚡ Ocorrências de Energia — ${label} — ${project.id}</h1>
<div class="sub">${project.name||""} · Últimos ${dias} dias · Gerado em ${new Date().toLocaleDateString("pt-BR")}</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-val">${doPeriodo.length}</div><div class="kpi-lbl">Quedas no período</div></div>
  <div class="kpi"><div class="kpi-val">${totH}h${totM}m</div><div class="kpi-lbl">Tempo total s/ energia</div></div>
  <div class="kpi"><div class="kpi-val">${mediaDias}</div><div class="kpi-lbl">Média dias estabilidade</div></div>
  <div class="kpi"><div class="kpi-val">${geradores}🔌 / ${manutencistas}🔧</div><div class="kpi-lbl">Gerador / Manutencista</div></div>
</div>
<table><thead><tr><th>Início</th><th>Duração</th><th>Turno</th><th>Gerador</th><th>Manut.</th><th>Impacto</th><th>Protocolo</th></tr></thead>
<tbody>${linhas||'<tr><td colspan="7" style="text-align:center;color:#94a3b8">Sem quedas no período</td></tr>'}</tbody></table>
<div class="footer">MokLog CheckTest · Moked Consulting Security · Energia ${project.id}</div>
</body></html>`;
  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`energia_${label.toLowerCase()}_${project.id}_${new Date().toLocaleDateString("sv-SE")}.html`; a.click();
}

function getStyles(dark){
  return {
    page:{minHeight:"100vh",background:dark?"#04080f":"#f1f5f9",display:"flex",justifyContent:"center",padding:"0 0 90px",fontFamily:"'Segoe UI',system-ui,sans-serif"},
    wrap:{width:"100%",maxWidth:480,display:"flex",flexDirection:"column"},
    card:{background:dark?"#060c18":"#fff",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderRadius:12,padding:"14px 16px"},
    btn:{background:"linear-gradient(135deg,#ef4444,#b91c1c)",color:"#fff",border:"none",borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8},
    btnSec:{background:dark?"#0f172a":"#f8fafc",color:dark?"#f1f5f9":"#475569",border:`1px solid ${dark?"#1e293b":"#e2e8f0"}`,borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:800,cursor:"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center"},
    btnSm:{background:dark?"#0f172a":"#f8fafc",border:`1px solid ${dark?"#1e293b":"#e2e8f0"}`,color:dark?"#f1f5f9":"#475569",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:800},
    backBtn:{background:"transparent",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,color:dark?"#cbd5e1":"#64748b",borderRadius:7,padding:"7px 12px",fontSize:12,cursor:"pointer",flexShrink:0,fontWeight:700},
    inp:{width:"100%",background:dark?"#020510":"#fff",border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`,borderRadius:7,color:dark?"#f8fafc":"#1e293b",padding:"10px 12px",fontSize:13,boxSizing:"border-box",outline:"none"},
    lbl:{display:"block",fontSize:11,color:dark?"#cbd5e1":"#475569",fontWeight:800,marginBottom:5,textTransform:"uppercase",letterSpacing:.5},
    txt:{color:dark?"#ffffff":"#0f172a",fontWeight:700}, txt2:{color:dark?"#cbd5e1":"#475569",fontWeight:600},
  };
}

function Toggle({ value, onChange, disabled, dark }){
  return (
    <button disabled={disabled} onClick={()=>!disabled&&onChange(!value)}
      style={{width:46,height:27,borderRadius:14,border:"none",cursor:disabled?"default":"pointer",flexShrink:0,
        background:value?"#22c55e":(dark?"#1e293b":"#cbd5e1"),position:"relative",transition:"background .2s",opacity:disabled?.6:1}}>
      <div style={{width:21,height:21,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:value?22:3,transition:"left .2s"}}/>
    </button>
  );
}

function PinGate({ project, onSuccess, onBack, dark }){
  const S = getStyles(dark);
  const [mode,setMode]=useState(null); const [pin,setPin]=useState(""); const [err,setErr]=useState(false);
  const tryPin=()=>{ if(pin===ADMIN_PIN){onSuccess("admin");return;} if(pin===PROJECT_PINS[project.id]){onSuccess("lider");return;} setErr(true); };
  return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,maxWidth:320,width:"100%",margin:16,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>⚡</div>
        <div style={{fontSize:16,fontWeight:800,...S.txt,marginBottom:4}}>Ocorrências de Energia</div>
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
              onChange={e=>{setPin(e.target.value);setErr(false);}} onKeyDown={e=>{if(e.key==="Enter") tryPin();}}
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

export default function EnergiaOcorrencias({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }){
  const S = getStyles(dark);
  const [authLevel,setAuthLevel]=useState(()=>sharedAuth||getAccess(project?.id)||null);
  const [screen,setScreen]=useState(()=>(sharedAuth||getAccess(project?.id))?"home":"pin"); // pin|home|concluir|config
  const [data,setData]=useState({config:{},eventos:[]});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [agora,setAgora]=useState(Date.now());
  const adminAuth = authLevel==="admin";
  const liderAuth = authLevel==="lider" || authLevel==="admin";

  const [cfgForm,setCfgForm]=useState({});
  const [form,setForm]=useState({});
  const [erro,setErro]=useState(null);

  useEffect(()=>{ loadEnergia(project.id).then(d=>{setData(d);setLoading(false);}); },[project.id]);
  useEffect(()=>{ const t=setInterval(()=>setAgora(Date.now()),30000); return ()=>clearInterval(t); },[]);

  const eventos = data.eventos||[];
  const aberto = eventos.find(e=>!e.concluido);
  const concluidosNaoArquivados = [...eventos].filter(e=>e.concluido&&!e.arquivado).sort((a,b)=>(b.inicioQueda||"").localeCompare(a.inicioQueda||""));
  const arquivados = [...eventos].filter(e=>e.arquivado).sort((a,b)=>(b.inicioQueda||"").localeCompare(a.inicioQueda||""));
  const ultimaConcluida = [...eventos].filter(e=>e.concluido).sort((a,b)=>(b.fimQueda||"").localeCompare(a.fimQueda||""))[0];
  const diasSemQueda = ultimaConcluida?.fimQueda ? Math.floor((agora-new Date(ultimaConcluida.fimQueda).getTime())/86400000) : null;

  const persist = async (next) => { setSaving(true); setData(next); await saveEnergia(project.id,next); setSaving(false); };

  const registrarQueda = async () => {
    const ev = { id:newId(), inicioQueda:new Date().toISOString(), turno:turnoAgora(), concluido:false, arquivado:false, criadoEm:new Date().toISOString() };
    await persist({ ...data, eventos:[...eventos, ev] });
  };

  const [editandoId, setEditandoId] = useState(null); // id do evento em edição (null = concluindo o aberto)
  const [confirmDelId, setConfirmDelId] = useState(null);

  const abrirConcluir = () => {
    setEditandoId(null);
    setForm({ protocolo:"", operador:"", gerador:"", obsGerador:"", manutencista:false, impactoOperacao:false, obsImpacto:"", inquilinoImpactado:false, inquilinosAfetados:"", obs:"", foto:null });
    setErro(null); setScreen("concluir");
  };
  const abrirEdicao = (ev) => {
    setEditandoId(ev.id);
    setForm({ protocolo:ev.protocolo||"", operador:ev.operador||"", gerador:ev.gerador||"", obsGerador:ev.obsGerador||"",
      manutencista:!!ev.manutencista, impactoOperacao:!!ev.impactoOperacao, obsImpacto:ev.obsImpacto||"",
      inquilinoImpactado:!!ev.inquilinoImpactado, inquilinosAfetados:ev.inquilinosAfetados||"", obs:ev.obs||"", foto:ev.foto||null });
    setErro(null); setScreen("concluir");
  };
  const addFoto = async (file) => {
    if(!file) return;
    const b64 = await comprimirFoto(file);
    if(b64) setForm(f=>({...f,foto:b64})); else setErro("Não consegui processar essa foto.");
  };
  const concluir = async () => {
    if(!form.operador.trim()){ setErro("Informe o nome do operador."); return; }
    if(!form.gerador){ setErro("Informe se o gerador foi acionado."); return; }
    if(form.gerador!=="sim" && !form.obsGerador.trim()){ setErro("Explique por que o gerador não foi acionado."); return; }
    if(form.impactoOperacao && !form.obsImpacto.trim()){ setErro("Descreva o impacto na operação."); return; }
    if(form.inquilinoImpactado && !form.inquilinosAfetados.trim()){ setErro("Informe qual(is) inquilino(s) foi(ram) impactado(s)."); return; }
    if(editandoId){
      await persist({ ...data, eventos:eventos.map(e=>e.id===editandoId?{...e,...form}:e) });
    } else {
      const evFinal = { ...aberto, ...form, fimQueda:new Date().toISOString(), concluido:true };
      await persist({ ...data, eventos:eventos.map(e=>e.id===aberto.id?evFinal:e) });
    }
    setEditandoId(null);
    setScreen("home");
  };
  const arquivar = async (id) => { await persist({ ...data, eventos:eventos.map(e=>e.id===id?{...e,arquivado:true}:e) }); };
  const excluirEvento = async (id) => { await persist({ ...data, eventos:eventos.filter(e=>e.id!==id) }); setConfirmDelId(null); };

  const abrirConfig = () => { setCfgForm({...data.config}); setScreen("config"); };
  const salvarConfig = async () => { await persist({ ...data, config:cfgForm }); setScreen("home"); };

  if(screen==="pin") return <PinGate project={project} dark={dark} onBack={onBack} onSuccess={(l)=>{grantSession(l,project.id);setAuthLevel(l);setScreen("home");onAuthGranted?.(l);}}/>;
  if(loading) return <div style={{...S.page,alignItems:"center",justifyContent:"center"}}><div style={{...S.txt2,fontSize:13}}>Carregando…</div></div>;

  const Header = (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px 10px"}}>
      <button onClick={()=>{ if(screen==="home") onBack(); else setScreen("home"); }} style={S.backBtn}>←</button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:800,...S.txt}}>⚡ Ocorrências de Energia</div>
        <div style={{fontSize:10,...S.txt2}}>{project.id} · {project.name}</div>
      </div>
      {onToggleTheme && <button onClick={onToggleTheme} style={S.btnSm}>{dark?"☀️":"🌙"}</button>}
    </div>
  );

  // ── Config (cabeçalho fixo — gerencial)
  if(screen==="config") return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={S.card}>
          <label style={S.lbl}>Concessionária</label>
          <input value={cfgForm.concessionaria||""} onChange={e=>setCfgForm(f=>({...f,concessionaria:e.target.value}))} placeholder="Ex: Enel" style={{...S.inp,marginBottom:10}}/>
          <label style={S.lbl}>Telefone da Concessionária</label>
          <input value={cfgForm.telefoneConcessionaria||""} onChange={e=>setCfgForm(f=>({...f,telefoneConcessionaria:e.target.value}))} placeholder="0800..." style={{...S.inp,marginBottom:10}}/>
          <label style={S.lbl}>CNPJ do Condomínio</label>
          <input value={cfgForm.cnpj||""} onChange={e=>setCfgForm(f=>({...f,cnpj:e.target.value}))} placeholder="00.000.000/0000-00" style={{...S.inp,marginBottom:10}}/>
          <label style={S.lbl}>Número de Instalação</label>
          <input value={cfgForm.numeroInstalacao||""} onChange={e=>setCfgForm(f=>({...f,numeroInstalacao:e.target.value}))} placeholder="Ex: 123456789" style={S.inp}/>
        </div>
        <button onClick={salvarConfig} disabled={saving} style={S.btn}>{saving?"Salvando…":"💾 Salvar"}</button>
        <button onClick={()=>setScreen("home")} style={{...S.btnSec,fontSize:13}}>Cancelar</button>
      </div>
    </div></div>
  );

  // ── Concluir (voltou a energia) ou Editar um evento existente
  if(screen==="concluir" && (aberto || editandoId)) return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={S.card}>
          <div style={{fontSize:13,fontWeight:800,...S.txt}}>{editandoId?"✏️ Editando ocorrência":"✅ Voltou a energia"}</div>
          {editandoId ? (
            <div style={{fontSize:11,...S.txt2,marginTop:2}}>{(()=>{const ev=eventos.find(e=>e.id===editandoId);return ev?`Queda de ${fmtDataHora(ev.inicioQueda)} até ${fmtDataHora(ev.fimQueda)}`:"";})()}</div>
          ) : (
            <div style={{fontSize:11,...S.txt2,marginTop:2}}>Queda iniciada em {fmtDataHora(aberto.inicioQueda)} · retorno registrado agora ({fmtHora(new Date().toISOString())})</div>
          )}
        </div>
        <div style={S.card}>
          <label style={S.lbl}>Operador</label>
          <input value={form.operador} onChange={e=>{setForm(f=>({...f,operador:e.target.value}));setErro(null);}} placeholder="Seu nome" style={{...S.inp,marginBottom:10}}/>
          <label style={S.lbl}>Protocolo junto à concessionária</label>
          <input value={form.protocolo} onChange={e=>setForm(f=>({...f,protocolo:e.target.value}))} placeholder="Nº do protocolo (opcional)" style={S.inp}/>
        </div>
        <div style={S.card}>
          <label style={S.lbl}>Gerador foi acionado?</label>
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <button onClick={()=>{setForm(f=>({...f,gerador:"sim"}));setErro(null);}}
              style={{flex:1,padding:"12px",borderRadius:9,fontWeight:900,fontSize:14,cursor:"pointer",
                border:`2px solid ${form.gerador==="sim"?"#22c55e":(dark?"#1e293b":"#e2e8f0")}`,
                background:form.gerador==="sim"?"#22c55e":(dark?"#0f172a":"#fff"),
                color:form.gerador==="sim"?"#04140b":(dark?"#f1f5f9":"#475569")}}>✅ Sim</button>
            <button onClick={()=>{setForm(f=>({...f,gerador:"nao"}));setErro(null);}}
              style={{flex:1,padding:"12px",borderRadius:9,fontWeight:900,fontSize:14,cursor:"pointer",
                border:`2px solid ${form.gerador==="nao"?"#ef4444":(dark?"#1e293b":"#e2e8f0")}`,
                background:form.gerador==="nao"?"#ef4444":(dark?"#0f172a":"#fff"),
                color:form.gerador==="nao"?"#2a0303":(dark?"#f1f5f9":"#475569")}}>❌ Não</button>
          </div>
          {form.gerador==="nao" && (
            <input value={form.obsGerador} onChange={e=>{setForm(f=>({...f,obsGerador:e.target.value}));setErro(null);}} placeholder="Por que não acionou? Qual o impacto?" style={{...S.inp,marginTop:10,fontSize:13}}/>
          )}
        </div>
        <div style={S.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <label style={S.lbl}>Manutencista acionado?</label>
            <Toggle value={form.manutencista} onChange={v=>setForm(f=>({...f,manutencista:v}))} dark={dark}/>
          </div>
        </div>
        <div style={S.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <label style={S.lbl}>Impactou a operação?</label>
            <Toggle value={form.impactoOperacao} onChange={v=>{setForm(f=>({...f,impactoOperacao:v}));setErro(null);}} dark={dark}/>
          </div>
          {form.impactoOperacao && (
            <textarea value={form.obsImpacto} onChange={e=>{setForm(f=>({...f,obsImpacto:e.target.value}));setErro(null);}} rows={2} placeholder="Descreva o impacto..." style={{...S.inp,marginTop:8,resize:"vertical",fontFamily:"inherit"}}/>
          )}
        </div>
        <div style={S.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <label style={S.lbl}>Algum inquilino impactado?</label>
            <Toggle value={form.inquilinoImpactado} onChange={v=>{setForm(f=>({...f,inquilinoImpactado:v}));setErro(null);}} dark={dark}/>
          </div>
          {form.inquilinoImpactado && (
            <input value={form.inquilinosAfetados} onChange={e=>{setForm(f=>({...f,inquilinosAfetados:e.target.value}));setErro(null);}} placeholder="Qual(is)? Ex: GAC — energia da concessionária voltou mas não atualizou pro inquilino" style={{...S.inp,marginTop:8,fontSize:13}}/>
          )}
        </div>
        <div style={S.card}>
          <label style={S.lbl}>Observações extras</label>
          <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} rows={2} placeholder="Ex: pico de energia queimou o componente X" style={{...S.inp,resize:"vertical",fontFamily:"inherit"}}/>
          <label style={{...S.lbl,marginTop:10}}>Foto (opcional)</label>
          {form.foto ? (
            <div style={{position:"relative",width:88,height:88,marginTop:4}}>
              <img src={form.foto} alt="" style={{width:88,height:88,objectFit:"cover",borderRadius:8,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}/>
              <button onClick={()=>setForm(f=>({...f,foto:null}))} style={{position:"absolute",top:-6,right:-6,background:"#ef4444",color:"#fff",border:"none",borderRadius:"50%",width:21,height:21,fontSize:12,cursor:"pointer"}}>×</button>
            </div>
          ) : (
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <label style={{...S.btnSec,fontSize:12,cursor:"pointer",width:"auto",padding:"9px 13px"}}>📷 Câmera<input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{addFoto(e.target.files?.[0]);e.target.value="";}}/></label>
              <label style={{...S.btnSec,fontSize:12,cursor:"pointer",width:"auto",padding:"9px 13px"}}>🖼️ Galeria<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{addFoto(e.target.files?.[0]);e.target.value="";}}/></label>
            </div>
          )}
        </div>
        {erro && <div role="alert" style={{fontSize:12,color:"#ef4444",textAlign:"center"}}>{erro}</div>}
        <button onClick={()=>setScreen("home")} style={{...S.btnSec,fontSize:13}}>Cancelar</button>
        <button onClick={concluir} disabled={saving} style={S.btn}>{saving?"Salvando…":(editandoId?"💾 Salvar Edição":"✓ Concluir Ocorrência")}</button>
      </div>
    </div></div>
  );

  // ── Home
  return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>

        {aberto ? (
          <div style={{...S.card,border:"1px solid #ef444455",background:dark?"#1a0202":"#fef2f2"}}>
            <div style={{fontSize:13,fontWeight:900,color:"#ef4444"}}>⚡ Energia interrompida agora</div>
            <div style={{fontSize:11,...S.txt2,marginTop:2}}>Desde {fmtDataHora(aberto.inicioQueda)} · {aberto.turno} · há {duracaoFmt(new Date(aberto.inicioQueda),agora)}</div>
          </div>
        ) : (
          <div style={{...S.card,textAlign:"center",border:diasSemQueda!=null&&diasSemQueda<3?"1px solid #f59e0b55":"1px solid #22c55e33"}}>
            <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase"}}>Estabilidade da rede</div>
            <div style={{fontSize:30,fontWeight:900,color:diasSemQueda==null?(dark?"#475569":"#94a3b8"):(diasSemQueda<3?"#f59e0b":"#22c55e"),marginTop:4}}>
              {diasSemQueda==null?"—":diasSemQueda}
            </div>
            <div style={{fontSize:12,...S.txt2}}>{diasSemQueda==null?"Nenhuma queda registrada ainda":`dia${diasSemQueda===1?"":"s"} sem quedas de energia`}</div>
          </div>
        )}

        {aberto
          ? <button onClick={abrirConcluir} style={S.btn}>✅ Concluir — Voltou a energia</button>
          : <button onClick={registrarQueda} disabled={saving} style={S.btn}>⚡ Registrar Queda / Pico de Energia (agora)</button>}

        {liderAuth && <button onClick={abrirConfig} style={{...S.btnSec,fontSize:13}}>⚙️ Configurar Concessionária{data.config?.concessionaria?" (já configurada)":""}</button>}

        {adminAuth && eventos.length>0 && (
          <div style={S.card}>
            <div style={{fontSize:12,fontWeight:800,...S.txt,marginBottom:8}}>📄 Relatório por período (gerencial)</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>gerarPdfPeriodo(project,eventos,7,"Semanal")} style={{...S.btnSm,flex:1,padding:"9px",fontSize:12,color:"#7c3aed",borderColor:"#7c3aed44"}}>Semanal</button>
              <button onClick={()=>gerarPdfPeriodo(project,eventos,15,"Quinzenal")} style={{...S.btnSm,flex:1,padding:"9px",fontSize:12,color:"#7c3aed",borderColor:"#7c3aed44"}}>Quinzenal</button>
              <button onClick={()=>gerarPdfPeriodo(project,eventos,30,"Mensal")} style={{...S.btnSm,flex:1,padding:"9px",fontSize:12,color:"#7c3aed",borderColor:"#7c3aed44"}}>Mensal</button>
            </div>
          </div>
        )}

        {concluidosNaoArquivados.length>0 && <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginTop:4}}>Concluídas — pendente arquivar ({concluidosNaoArquivados.length})</div>}
        {concluidosNaoArquivados.map(ev=>(
          <div key={ev.id} style={S.card}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div style={{fontSize:12,fontWeight:800,...S.txt}}>{fmtDataHora(ev.inicioQueda)}</div>
              <div style={{fontSize:11,...S.txt2}}>{duracaoFmt(new Date(ev.inicioQueda),new Date(ev.fimQueda))}</div>
            </div>
            <div style={{fontSize:11,...S.txt2,marginTop:2}}>{ev.turno} · Operador: {ev.operador} {ev.impactoOperacao&&<span style={{color:"#ef4444",fontWeight:700}}> · ⚠️ impactou operação</span>}</div>
            <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
              <button onClick={()=>gerarPdfEvento(project,data.config,ev)} style={{...S.btnSm,flex:1,padding:"8px",fontSize:11,color:"#7c3aed",borderColor:"#7c3aed44"}}>📄 PDF</button>
              <button onClick={()=>abrirWhatsApp(project,data.config,ev)} style={{...S.btnSm,flex:1,padding:"8px",fontSize:11,color:"#22c55e",borderColor:"#22c55e44"}}>📲 WhatsApp</button>
              <button onClick={()=>arquivar(ev.id)} style={{...S.btnSm,flex:1,padding:"8px",fontSize:11}}>📥 Arquivar</button>
            </div>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              {liderAuth && <button onClick={()=>abrirEdicao(ev)} style={{...S.btnSm,flex:1,padding:"8px",fontSize:11,color:"#f59e0b",borderColor:"#f59e0b44"}}>✏️ Editar</button>}
              {adminAuth && (confirmDelId===ev.id
                ? <button onClick={()=>excluirEvento(ev.id)} style={{...S.btnSm,flex:1,padding:"8px",fontSize:11,color:"#fff",background:"#dc2626",borderColor:"#dc2626"}}>Confirmar exclusão</button>
                : <button onClick={()=>setConfirmDelId(ev.id)} style={{...S.btnSm,flex:1,padding:"8px",fontSize:11,color:"#ef4444",borderColor:"#ef444444"}}>🗑 Excluir</button>)}
            </div>
          </div>
        ))}

        {arquivados.length>0 && <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginTop:4}}>Arquivadas ({arquivados.length})</div>}
        {arquivados.map(ev=>(
          <div key={ev.id} style={{...S.card,padding:"10px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div style={{fontSize:12,fontWeight:700,...S.txt}}>{fmtDataHora(ev.inicioQueda)}</div>
              <div style={{fontSize:11,...S.txt2}}>{duracaoFmt(new Date(ev.inicioQueda),new Date(ev.fimQueda))}</div>
            </div>
            <div style={{fontSize:10,...S.txt2}}>{ev.turno} · {ev.operador}</div>
            {adminAuth && (
              <div style={{marginTop:8}}>
                {confirmDelId===ev.id
                  ? <button onClick={()=>excluirEvento(ev.id)} style={{...S.btnSm,width:"100%",padding:"7px",fontSize:11,color:"#fff",background:"#dc2626",borderColor:"#dc2626"}}>Confirmar exclusão</button>
                  : <button onClick={()=>setConfirmDelId(ev.id)} style={{...S.btnSm,width:"100%",padding:"7px",fontSize:11,color:"#ef4444",borderColor:"#ef444444"}}>🗑 Excluir</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div></div>
  );
}
