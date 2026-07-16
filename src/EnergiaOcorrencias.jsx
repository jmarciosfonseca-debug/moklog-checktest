// ─────────────────────────────────────────────────────────────
// EnergiaOcorrencias.jsx — Ocorrências de Energia (redesign v2)
// Baseado no mockup + spec aprovados em 12/07/2026. Todos os projetos.
//
// Estrutura da tela (home):
// 1. Card do condomínio — recolhido (concessionária + telefone), expande
//    ao tocar mostrando todos os dados + "Editar dados" (bottom sheet)
// 2. Ocorrência em aberto (cartão vermelho, cronômetro ao vivo) OU botão
//    "➕ Registrar falta de energia" — nunca os dois ao mesmo tempo
// 3. Últimos registros — 6 mais recentes + "Ver todos"; toca abre detalhe
// 4. Relatório por período (gerencial) no rodapé
//
// Regras: só uma ocorrência aberta por vez; duração sempre calculada
// (nunca digitada); rascunho aberto persiste se o app fechar; contador
// de estabilidade conta desde a config (se não houver quedas) ou desde
// o fim da última queda concluída.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
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

const COR = { purple:"#8b7cf6", red:"#e0524f", redBg:"#2a1215", redBorder:"#57262a", green:"#3fbf7f", amber:"#f5b942" };

function newId(){ try { return crypto.randomUUID(); } catch { return "id-"+Date.now()+"-"+Math.random().toString(36).slice(2,8); } }
function pad2(n){ return String(n).padStart(2,"0"); }
function fmtDataHora(iso){ if(!iso) return "—"; try { const d=new Date(iso); return d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); } catch { return "—"; } }
function fmtHora(iso){ if(!iso) return "—"; try { return new Date(iso).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); } catch { return "—"; } }
function fmtDiaMes(iso){ if(!iso) return {d:"—",m:""}; try { const d=new Date(iso); return { d: pad2(d.getDate()), m: d.toLocaleDateString("pt-BR",{month:"short"}).replace(".","") }; } catch { return {d:"—",m:""}; } }
function turnoAgora(){ const h=new Date().getHours(); return (h>=6&&h<18) ? "Diurno" : "Noturno"; }
function duracaoFmt(msIni, msFim){
  const diff = Math.max(0, msFim-msIni);
  const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
  return `${h}h ${pad2(m)}min`;
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
  return linhas.join("\\n");
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

function gerarPdfPeriodo(project, eventos, dias, label){
  const corte = Date.now() - dias*86400000;
  const doPeriodo = eventos.filter(e=>e.inicioQueda && new Date(e.inicioQueda).getTime()>=corte).sort((a,b)=>(b.inicioQueda||"").localeCompare(a.inicioQueda||""));
  const tempoTotalMs = doPeriodo.reduce((a,e)=>a+(e.fimQueda?(new Date(e.fimQueda)-new Date(e.inicioQueda)):0),0);
  const totH = Math.floor(tempoTotalMs/3600000), totM = Math.floor((tempoTotalMs%3600000)/60000);
  const mediaDias = doPeriodo.length>1 ? Math.round((dias/doPeriodo.length)*10)/10 : dias;
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
    page:{minHeight:"100vh",background:dark?"#05070f":"#f1f5f9",display:"flex",justifyContent:"center",padding:"0 0 90px",fontFamily:"'Segoe UI',system-ui,sans-serif"},
    wrap:{width:"100%",maxWidth:480,display:"flex",flexDirection:"column",position:"relative"},
    card:{background:dark?"#10162b":"#fff",border:`1px solid ${dark?"#232b4a":"#e2e8f0"}`,borderRadius:16,padding:"14px 16px"},
    btn:{background:`linear-gradient(135deg,${COR.red},#c23a37)`,color:"#fff",border:"none",borderRadius:14,padding:"15px 16px",fontSize:15,fontWeight:800,cursor:"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8},
    btnSec:{background:dark?"#10162b":"#f8fafc",color:dark?"#eef1fa":"#475569",border:`1px solid ${dark?"#232b4a":"#e2e8f0"}`,borderRadius:12,padding:"13px 16px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center"},
    btnSm:{background:dark?"#151c36":"#f8fafc",border:`1px solid ${dark?"#232b4a":"#e2e8f0"}`,color:dark?"#eef1fa":"#475569",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:700},
    backBtn:{width:42,height:42,borderRadius:12,background:dark?"#10162b":"#fff",border:`1px solid ${dark?"#232b4a":"#e2e8f0"}`,color:dark?"#eef1fa":"#0f172a",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0},
    inp:{width:"100%",background:dark?"#05070f":"#fff",border:`1px solid ${dark?"#232b4a":"#cbd5e1"}`,borderRadius:12,color:dark?"#eef1fa":"#1e293b",padding:"13px 14px",fontSize:15,boxSizing:"border-box",outline:"none"},
    lbl:{display:"block",fontSize:12,color:dark?"#8f97b5":"#64748b",fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:.6},
    txt:{color:dark?"#eef1fa":"#0f172a",fontWeight:700}, txt2:{color:dark?"#8f97b5":"#64748b",fontWeight:500},
  };
}

function Toggle({ value, onChange, disabled, dark }){
  return (
    <button disabled={disabled} onClick={()=>!disabled&&onChange(!value)}
      style={{width:46,height:27,borderRadius:14,border:"none",cursor:disabled?"default":"pointer",flexShrink:0,
        background:value?COR.green:(dark?"#232b4a":"#cbd5e1"),position:"relative",transition:"background .2s",opacity:disabled?.6:1}}>
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
            <button onClick={()=>setMode("admin")} style={{...S.btnSec,fontSize:13,color:COR.amber,borderColor:"#f5b94255"}}>🔐 Acesso Gerencial</button>
            <button onClick={onBack} style={{...S.btnSec,fontSize:13,marginTop:4}}>← Voltar</button>
          </div>
        ) : (
          <>
            <div style={{fontSize:12,...S.txt2,marginBottom:12}}>{mode==="lider"?"PIN do projeto":"PIN gerencial"}</div>
            <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pin}
              onChange={e=>{setPin(e.target.value);setErr(false);}} onKeyDown={e=>{if(e.key==="Enter") tryPin();}}
              style={{...S.inp,textAlign:"center",fontSize:22,letterSpacing:10,marginBottom:8}}/>
            {err&&<div role="alert" style={{fontSize:12,color:COR.red,marginBottom:8}}>PIN incorreto</div>}
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

// ── Toast simples (feedback de ações rápidas)
function Toast({ msg, dark }){
  if(!msg) return null;
  return (
    <div style={{position:"fixed",left:"50%",bottom:24,transform:"translateX(-50%)",background:dark?"#1c2444":"#1e293b",
      color:"#eef1fa",padding:"11px 18px",borderRadius:12,fontSize:13.5,fontWeight:600,zIndex:999,whiteSpace:"nowrap",
      boxShadow:"0 8px 24px rgba(0,0,0,.35)"}}>{msg}</div>
  );
}

// ── Bottom sheet de edição dos dados do condomínio
function EditSheet({ cfgForm, setCfgForm, erro, onSave, onClose, saving, dark, S }){
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:40}}/>
      <div style={{position:"fixed",left:0,right:0,bottom:0,maxWidth:480,margin:"0 auto",background:dark?"#131a33":"#fff",
        borderRadius:"22px 22px 0 0",padding:"10px 18px 24px",zIndex:41,borderTop:`1px solid ${dark?"#232b4a":"#e2e8f0"}`,
        maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{width:42,height:5,borderRadius:99,background:dark?"#232b4a":"#e2e8f0",margin:"6px auto 16px"}}/>
        <div style={{fontSize:17,fontWeight:800,...S.txt,marginBottom:14}}>Editar dados do condomínio</div>
        <label style={S.lbl}>Concessionária *</label>
        <input value={cfgForm.concessionaria||""} onChange={e=>setCfgForm(f=>({...f,concessionaria:e.target.value}))} placeholder="Ex: Enel" style={{...S.inp,marginBottom:12}}/>
        <label style={S.lbl}>Telefone (0800) *</label>
        <input value={cfgForm.telefoneConcessionaria||""} onChange={e=>setCfgForm(f=>({...f,telefoneConcessionaria:e.target.value}))} placeholder="0800..." style={{...S.inp,marginBottom:12}}/>
        <label style={S.lbl}>CNPJ *</label>
        <input value={cfgForm.cnpj||""} onChange={e=>setCfgForm(f=>({...f,cnpj:e.target.value}))} placeholder="00.000.000/0000-00" style={{...S.inp,marginBottom:12}}/>
        <label style={S.lbl}>Nº da instalação *</label>
        <input value={cfgForm.numeroInstalacao||""} onChange={e=>setCfgForm(f=>({...f,numeroInstalacao:e.target.value}))} placeholder="Ex: 123456789" style={{...S.inp,marginBottom:12}}/>
        <label style={S.lbl}>Endereço *</label>
        <input value={cfgForm.endereco||""} onChange={e=>setCfgForm(f=>({...f,endereco:e.target.value}))} placeholder="Rua, número, bairro, cidade" style={{...S.inp,marginBottom:12}}/>
        <label style={S.lbl}>Empresa de Manutenção (opcional)</label>
        <input value={cfgForm.empresaManutencao||""} onChange={e=>setCfgForm(f=>({...f,empresaManutencao:e.target.value}))} placeholder="Ex: Álamo" style={S.inp}/>
        {erro && <div role="alert" style={{fontSize:12,color:COR.red,marginTop:10,textAlign:"center"}}>{erro}</div>}
        <button onClick={onSave} disabled={saving} style={{width:"100%",marginTop:18,padding:15,borderRadius:13,border:"none",background:COR.purple,color:"#fff",fontSize:15.5,fontWeight:800,cursor:"pointer"}}>
          {saving?"Salvando…":"Salvar alterações"}
        </button>
      </div>
    </>
  );
}

export default function EnergiaOcorrencias({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }){
  const S = getStyles(dark);
  const [authLevel,setAuthLevel]=useState(()=>sharedAuth||getAccess(project?.id)||null);
  const [screen,setScreen]=useState(()=>(sharedAuth||getAccess(project?.id))?"home":"pin"); // pin|home|concluir|detalhe
  const [data,setData]=useState({config:{},eventos:[]});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [agora,setAgora]=useState(Date.now());
  const [toastMsg,setToastMsg]=useState(null);
  const adminAuth = authLevel==="admin";
  const liderAuth = authLevel==="lider" || authLevel==="admin";

  const [condAberto,setCondAberto]=useState(false);
  const [showSheet,setShowSheet]=useState(false);
  const [verTodos,setVerTodos]=useState(false);
  const [cfgForm,setCfgForm]=useState({});
  const [form,setForm]=useState({});
  const [erro,setErro]=useState(null);
  const [editandoId,setEditandoId]=useState(null);
  const [viewId,setViewId]=useState(null);
  const [confirmDelId,setConfirmDelId]=useState(null);

  useEffect(()=>{ loadEnergia(project.id).then(d=>{setData(d);setLoading(false);}); },[project.id]);
  useEffect(()=>{ const t=setInterval(()=>setAgora(Date.now()),15000); return ()=>clearInterval(t); },[]);
  useEffect(()=>{ if(!toastMsg) return; const t=setTimeout(()=>setToastMsg(null),2200); return ()=>clearTimeout(t); },[toastMsg]);

  const eventos = data.eventos||[];
  const aberto = eventos.find(e=>!e.concluido);
  const concluidos = [...eventos].filter(e=>e.concluido).sort((a,b)=>(b.inicioQueda||"").localeCompare(a.inicioQueda||""));
  const ultimaConcluida = concluidos[0];
  const baseContagem = ultimaConcluida?.fimQueda || data.config?.monitorandoDesde || null;
  const diasSemQueda = baseContagem ? Math.floor((agora-new Date(baseContagem).getTime())/86400000) : null;

  const persist = async (next) => { setSaving(true); setData(next); await saveEnergia(project.id,next); setSaving(false); };

  const registrarQueda = async () => {
    const ev = { id:newId(), inicioQueda:new Date().toISOString(), turno:turnoAgora(), concluido:false, arquivado:false, criadoEm:new Date().toISOString() };
    await persist({ ...data, eventos:[...eventos, ev] });
    setToastMsg("Queda registrada — em aberto ⏳");
  };

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
      setToastMsg("Alterações salvas ✅");
    } else {
      const evFinal = { ...aberto, ...form, fimQueda:new Date().toISOString(), concluido:true };
      await persist({ ...data, eventos:eventos.map(e=>e.id===aberto.id?evFinal:e) });
      setToastMsg("Ocorrência concluída ✅");
    }
    setEditandoId(null);
    setScreen("home");
  };
  const arquivar = async (id) => { await persist({ ...data, eventos:eventos.map(e=>e.id===id?{...e,arquivado:true}:e) }); setToastMsg("Arquivada 📥"); setScreen("home"); };
  const excluirEvento = async (id) => { await persist({ ...data, eventos:eventos.filter(e=>e.id!==id) }); setConfirmDelId(null); setScreen("home"); setToastMsg("Registro excluído"); };

  const abrirSheet = () => { setCfgForm({...data.config}); setErro(null); setShowSheet(true); };
  const salvarConfig = async () => {
    if(!cfgForm.concessionaria?.trim()){ setErro("Informe a concessionária."); return; }
    if(!cfgForm.telefoneConcessionaria?.trim()){ setErro("Informe o telefone da concessionária."); return; }
    if(!cfgForm.cnpj?.trim()){ setErro("Informe o CNPJ do condomínio."); return; }
    if(!cfgForm.numeroInstalacao?.trim()){ setErro("Informe o número de instalação."); return; }
    if(!cfgForm.endereco?.trim()){ setErro("Informe o endereço do condomínio."); return; }
    const cfgFinal = data.config?.monitorandoDesde ? cfgForm : { ...cfgForm, monitorandoDesde:new Date().toISOString() };
    await persist({ ...data, config:cfgFinal });
    setShowSheet(false);
    setToastMsg("Dados salvos ✅");
  };

  if(screen==="pin") return <PinGate project={project} dark={dark} onBack={onBack} onSuccess={(l)=>{grantSession(l,project.id);setAuthLevel(l);setScreen("home");onAuthGranted?.(l);}}/>;
  if(loading) return <div style={{...S.page,alignItems:"center",justifyContent:"center"}}><div style={{...S.txt2,fontSize:13}}>Carregando…</div></div>;

  const Header = (
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 14px 14px"}}>
      <button onClick={()=>{ if(screen==="home") onBack(); else setScreen("home"); }} style={S.backBtn}>←</button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:19,fontWeight:700,...S.txt}}>⚡ Ocorrências de Energia</div>
        <div style={{fontSize:12.5,...S.txt2,fontWeight:500}}>{project.id} · {project.name}</div>
      </div>
      {onToggleTheme && <button onClick={onToggleTheme} style={S.btnSm}>{dark?"☀️":"🌙"}</button>}
    </div>
  );

  // ── Concluir / Editar
  if(screen==="concluir" && (aberto || editandoId)) return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 14px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={S.card}>
          <div style={{fontSize:15,fontWeight:800,...S.txt}}>{editandoId?"✏️ Editando ocorrência":"✅ Voltou a energia"}</div>
          {editandoId ? (
            <div style={{fontSize:12,...S.txt2,marginTop:2}}>{(()=>{const ev=eventos.find(e=>e.id===editandoId);return ev?`Queda de ${fmtDataHora(ev.inicioQueda)} até ${fmtDataHora(ev.fimQueda)}`:"";})()}</div>
          ) : (
            <div style={{fontSize:12,...S.txt2,marginTop:2}}>Queda iniciada em {fmtDataHora(aberto.inicioQueda)} · retorno registrado agora ({fmtHora(new Date().toISOString())})</div>
          )}
        </div>
        <div style={S.card}>
          <label style={S.lbl}>Operador</label>
          <input value={form.operador} onChange={e=>{setForm(f=>({...f,operador:e.target.value}));setErro(null);}} placeholder="Seu nome" style={{...S.inp,marginBottom:12}}/>
          <label style={S.lbl}>Protocolo junto à concessionária</label>
          <input value={form.protocolo} onChange={e=>setForm(f=>({...f,protocolo:e.target.value}))} placeholder="Nº do protocolo (opcional)" style={S.inp}/>
        </div>
        <div style={S.card}>
          <label style={S.lbl}>Gerador foi acionado?</label>
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <button onClick={()=>{setForm(f=>({...f,gerador:"sim"}));setErro(null);}}
              style={{flex:1,padding:"12px",borderRadius:11,fontWeight:900,fontSize:14,cursor:"pointer",
                border:`2px solid ${form.gerador==="sim"?COR.green:(dark?"#232b4a":"#e2e8f0")}`,
                background:form.gerador==="sim"?COR.green:(dark?"#151c36":"#fff"),
                color:form.gerador==="sim"?"#04140b":(dark?"#eef1fa":"#475569")}}>✅ Sim</button>
            <button onClick={()=>{setForm(f=>({...f,gerador:"nao"}));setErro(null);}}
              style={{flex:1,padding:"12px",borderRadius:11,fontWeight:900,fontSize:14,cursor:"pointer",
                border:`2px solid ${form.gerador==="nao"?COR.red:(dark?"#232b4a":"#e2e8f0")}`,
                background:form.gerador==="nao"?COR.red:(dark?"#151c36":"#fff"),
                color:form.gerador==="nao"?"#2a0303":(dark?"#eef1fa":"#475569")}}>❌ Não</button>
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
            <input value={form.inquilinosAfetados} onChange={e=>{setForm(f=>({...f,inquilinosAfetados:e.target.value}));setErro(null);}} placeholder="Qual(is)? Ex: GAC — voltou mas não atualizou pro inquilino" style={{...S.inp,marginTop:8,fontSize:13}}/>
          )}
        </div>
        <div style={S.card}>
          <label style={S.lbl}>Observações extras</label>
          <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} rows={2} placeholder="Ex: pico de energia queimou o componente X" style={{...S.inp,resize:"vertical",fontFamily:"inherit"}}/>
          <label style={{...S.lbl,marginTop:10}}>Foto (opcional)</label>
          {form.foto ? (
            <div style={{position:"relative",width:88,height:88,marginTop:4}}>
              <img src={form.foto} alt="" style={{width:88,height:88,objectFit:"cover",borderRadius:8,border:`1px solid ${dark?"#232b4a":"#e2e8f0"}`}}/>
              <button onClick={()=>setForm(f=>({...f,foto:null}))} style={{position:"absolute",top:-6,right:-6,background:COR.red,color:"#fff",border:"none",borderRadius:"50%",width:21,height:21,fontSize:12,cursor:"pointer"}}>×</button>
            </div>
          ) : (
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <label style={{...S.btnSec,fontSize:12,cursor:"pointer",width:"auto",padding:"9px 13px"}}>📷 Câmera<input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{addFoto(e.target.files?.[0]);e.target.value="";}}/></label>
              <label style={{...S.btnSec,fontSize:12,cursor:"pointer",width:"auto",padding:"9px 13px"}}>🖼️ Galeria<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{addFoto(e.target.files?.[0]);e.target.value="";}}/></label>
            </div>
          )}
        </div>
        {erro && <div role="alert" style={{fontSize:12,color:COR.red,textAlign:"center"}}>{erro}</div>}
        <button onClick={()=>{setEditandoId(null);setScreen("home");}} style={{...S.btnSec,fontSize:13}}>Cancelar</button>
        <button onClick={concluir} disabled={saving} style={S.btn}>{saving?"Salvando…":(editandoId?"💾 Salvar Edição":"✓ Concluir Ocorrência")}</button>
      </div>
    </div></div>
  );

  // ── Detalhe de um registro do histórico
  if(screen==="detalhe" && viewId){
    const ev = eventos.find(e=>e.id===viewId);
    if(!ev) { setScreen("home"); return null; }
    return (
      <div style={S.page}><div style={S.wrap}>
        {Header}
        <div style={{padding:"0 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={S.card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>{fmtDataHora(ev.inicioQueda)} → {fmtHora(ev.fimQueda)}</div>
              <span style={{fontSize:10.5,fontWeight:700,padding:"4px 9px",borderRadius:999,letterSpacing:.4,
                background:ev.turno==="Diurno"?"rgba(245,185,66,.12)":"rgba(139,124,246,.14)",
                color:ev.turno==="Diurno"?COR.amber:COR.purple}}>{ev.turno}</span>
            </div>
            <div style={{fontSize:12,...S.txt2,marginTop:4}}>Duração: {duracaoFmt(new Date(ev.inicioQueda),new Date(ev.fimQueda))}{ev.arquivado?" · Arquivada":""}</div>
          </div>
          <div style={S.card}>
            <div style={{fontSize:12,...S.txt2,marginBottom:6}}>Protocolo: <b style={S.txt}>{ev.protocolo||"—"}</b></div>
            <div style={{fontSize:12,...S.txt2,marginBottom:6}}>Operador: <b style={S.txt}>{ev.operador||"—"}</b></div>
            <div style={{fontSize:12,...S.txt2,marginBottom:6}}>Gerador acionado: <b style={{color:ev.gerador==="sim"?COR.green:COR.red}}>{ev.gerador==="sim"?"Sim":"Não"}</b>{ev.obsGerador?` — ${ev.obsGerador}`:""}</div>
            <div style={{fontSize:12,...S.txt2,marginBottom:6}}>Manutencista: <b style={S.txt}>{ev.manutencista?"Sim":"Não"}</b></div>
            <div style={{fontSize:12,...S.txt2,marginBottom:6}}>Impacto na operação: <b style={{color:ev.impactoOperacao?COR.red:S.txt.color}}>{ev.impactoOperacao?"Sim":"Não"}</b>{ev.obsImpacto?` — ${ev.obsImpacto}`:""}</div>
            <div style={{fontSize:12,...S.txt2}}>Inquilino impactado: <b style={S.txt}>{ev.inquilinoImpactado?(ev.inquilinosAfetados||"Sim"):"Não"}</b></div>
            {ev.obs && <div style={{fontSize:12,...S.txt2,marginTop:6}}>📝 {ev.obs}</div>}
          </div>
          {ev.foto && <div style={S.card}><img src={ev.foto} alt="" style={{width:"100%",borderRadius:10}}/></div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>gerarPdfEvento(project,data.config,ev)} style={{...S.btnSec,flex:1,fontSize:12,color:COR.purple}}>📄 PDF</button>
            <button onClick={()=>abrirWhatsApp(project,data.config,ev)} style={{...S.btnSec,flex:1,fontSize:12,color:COR.green}}>📲 WhatsApp</button>
          </div>
          {liderAuth && !ev.arquivado && <button onClick={()=>abrirEdicao(ev)} style={{...S.btnSec,fontSize:13,color:COR.amber}}>✏️ Editar</button>}
          {liderAuth && !ev.arquivado && <button onClick={()=>arquivar(ev.id)} style={{...S.btnSec,fontSize:13}}>📥 Arquivar</button>}
          {adminAuth && (confirmDelId===ev.id
            ? <button onClick={()=>excluirEvento(ev.id)} style={{...S.btn,background:"#dc2626"}}>Confirmar exclusão</button>
            : <button onClick={()=>setConfirmDelId(ev.id)} style={{...S.btnSec,fontSize:13,color:COR.red}}>🗑 Excluir registro</button>)}
          <button onClick={()=>{setViewId(null);setConfirmDelId(null);setScreen("home");}} style={{...S.btnSec,fontSize:13}}>← Voltar</button>
        </div>
      </div></div>
    );
  }

  // ── Home
  const historicoVisivel = verTodos ? concluidos : concluidos.slice(0,6);

  return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 14px",display:"flex",flexDirection:"column",gap:12}}>

        {/* Card do condomínio — recolhido/expansível */}
        {data.config?.concessionaria ? (
          <div style={{background:dark?"linear-gradient(160deg,#151c36,#10162b)":"#fff",border:`1px solid ${dark?"#232b4a":"#e2e8f0"}`,borderRadius:16,overflow:"hidden"}}>
            <div onClick={()=>setCondAberto(o=>!o)} style={{padding:16,display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
              <div style={{width:44,height:44,borderRadius:12,background:"rgba(139,124,246,.14)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🏢</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:17,fontWeight:700,...S.txt}}>{data.config.concessionaria}</div>
                <div style={{fontSize:15,color:COR.purple,fontWeight:600,marginTop:2}}>📞 {data.config.telefoneConcessionaria}</div>
              </div>
              <span style={{color:S.txt2.color,fontSize:14,transform:condAberto?"rotate(180deg)":"none",transition:"transform .25s",flexShrink:0}}>▼</span>
            </div>
            {condAberto && (
              <div style={{padding:"0 16px 16px",borderTop:`1px solid ${dark?"#232b4a":"#e2e8f0"}`}}>
                {[["Concessionária",data.config.concessionaria],["Telefone",data.config.telefoneConcessionaria,`tel:${(data.config.telefoneConcessionaria||"").replace(/\\D/g,"")}`],["CNPJ",data.config.cnpj],["Nº da instalação",data.config.numeroInstalacao],["Endereço",data.config.endereco],["Manutenção",data.config.empresaManutencao||"—"]].map(([k,v,href],i)=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"11px 0",borderBottom:i<5?`1px solid ${dark?"#232b4a88":"#f1f5f9"}`:"none"}}>
                    <span style={{fontSize:12,color:S.txt2.color,textTransform:"uppercase",letterSpacing:.6}}>{k}</span>
                    {href ? <a href={href} style={{fontSize:14,fontWeight:600,color:COR.purple,textDecoration:"none"}}>{v}</a>
                      : <span style={{fontSize:14,fontWeight:600,...S.txt,textAlign:"right"}}>{v}</span>}
                  </div>
                ))}
                {liderAuth && <button onClick={abrirSheet} style={{...S.btnSec,marginTop:8,fontSize:13}}>✏️ Editar dados</button>}
              </div>
            )}
          </div>
        ) : liderAuth ? (
          <div style={{...S.card,border:"1px solid #f5b94255",background:dark?"#1a1000":"#fffbeb"}}>
            <div style={{fontSize:13,fontWeight:800,color:COR.amber}}>⚠️ Cadastro pendente</div>
            <div style={{fontSize:12,...S.txt2,marginTop:2,marginBottom:10}}>Configure a concessionária uma única vez antes de registrar ocorrências.</div>
            <button onClick={abrirSheet} style={{...S.btnSec,fontSize:13}}>⚙️ Configurar agora</button>
          </div>
        ) : null}

        {/* Ocorrência em aberto OU botão de registrar (nunca os dois) */}
        {aberto ? (
          <div style={{background:COR.redBg,border:`1px solid ${COR.redBorder}`,borderRadius:16,padding:16}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11.5,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",
              color:COR.red,background:"rgba(224,82,79,.12)",padding:"5px 10px",borderRadius:999,marginBottom:10}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:COR.red,animation:"mkEnergyPulse 1.4s infinite"}}/>
              Em aberto — aguardando retorno
            </div>
            <style>{`@keyframes mkEnergyPulse{0%{box-shadow:0 0 0 0 rgba(224,82,79,.5)}70%{box-shadow:0 0 0 7px rgba(224,82,79,0)}100%{box-shadow:0 0 0 0 rgba(224,82,79,0)}}`}</style>
            <div style={{fontSize:17,fontWeight:700,color:"#fff",marginBottom:4}}>⚡ Queda de energia</div>
            <div style={{fontSize:13.5,color:"#d8a5a5",marginBottom:4}}>Início: {fmtDataHora(aberto.inicioQueda)} · {aberto.turno}</div>
            <div style={{fontSize:26,fontWeight:800,letterSpacing:.5,margin:"8px 0 14px",color:"#fff"}}>
              {duracaoFmt(new Date(aberto.inicioQueda),agora)} <small style={{fontSize:13,color:"#d8a5a5",fontWeight:500}}>sem energia</small>
            </div>
            <button onClick={abrirConcluir} style={{width:"100%",padding:15,borderRadius:13,border:"none",
              background:`linear-gradient(135deg,${COR.green},#2e9c66)`,color:"#06130c",fontSize:15.5,fontWeight:800,cursor:"pointer"}}>
              ✅ Concluir — voltou a energia
            </button>
          </div>
        ) : (
          <>
            <div style={{...S.card,textAlign:"center",border:diasSemQueda!=null&&diasSemQueda<3?"1px solid #f5b94255":`1px solid ${dark?"#1e4a35":"#bbf7d0"}`}}>
              <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>Estabilidade da rede</div>
              <div style={{fontSize:30,fontWeight:900,color:diasSemQueda==null?S.txt2.color:(diasSemQueda<3?COR.amber:COR.green),marginTop:4}}>
                {diasSemQueda==null?"—":diasSemQueda}
              </div>
              <div style={{fontSize:12,...S.txt2}}>{diasSemQueda==null?"Configure a concessionária para iniciar a contagem":`dia${diasSemQueda===1?"":"s"} sem quedas de energia${!ultimaConcluida?" · desde a configuração":""}`}</div>
            </div>
            <button onClick={registrarQueda} disabled={saving} style={S.btn}>➕ Registrar falta de energia</button>
          </>
        )}

        {/* Últimos registros */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"6px 2px 0"}}>
          <div style={{fontSize:13,fontWeight:700,color:S.txt2.color,textTransform:"uppercase",letterSpacing:1}}>Últimos registros</div>
          {concluidos.length>6 && <button onClick={()=>setVerTodos(v=>!v)} style={{background:"none",border:"none",fontSize:13,color:COR.purple,fontWeight:600,cursor:"pointer"}}>{verTodos?"Ver menos":"Ver todos"}</button>}
        </div>
        {concluidos.length===0 ? (
          <div style={{...S.card,textAlign:"center",fontSize:12,...S.txt2}}>Nenhum registro concluído ainda</div>
        ) : (
          <div style={{background:dark?"#10162b":"#fff",border:`1px solid ${dark?"#232b4a":"#e2e8f0"}`,borderRadius:16,overflow:"hidden"}}>
            {historicoVisivel.map((ev,i)=>{
              const dm = fmtDiaMes(ev.inicioQueda);
              return (
                <div key={ev.id} onClick={()=>{setViewId(ev.id);setConfirmDelId(null);setScreen("detalhe");}}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",cursor:"pointer",
                    borderBottom:i<historicoVisivel.length-1?`1px solid ${dark?"#232b4a88":"#f1f5f9"}`:"none"}}>
                  <div style={{textAlign:"center",flexShrink:0,width:44}}>
                    <div style={{fontSize:16,fontWeight:800,...S.txt}}>{dm.d}</div>
                    <div style={{fontSize:10.5,color:S.txt2.color,textTransform:"uppercase",letterSpacing:.5}}>{dm.m}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,...S.txt}}>{fmtHora(ev.inicioQueda)} → {fmtHora(ev.fimQueda)}{ev.arquivado?" 📥":""}</div>
                    <div style={{fontSize:12.5,color:S.txt2.color,marginTop:2}}>Duração: {duracaoFmt(new Date(ev.inicioQueda),new Date(ev.fimQueda))}</div>
                  </div>
                  <span style={{fontSize:10.5,fontWeight:700,padding:"4px 9px",borderRadius:999,letterSpacing:.4,flexShrink:0,
                    background:ev.turno==="Diurno"?"rgba(245,185,66,.12)":"rgba(139,124,246,.14)",
                    color:ev.turno==="Diurno"?COR.amber:COR.purple}}>{ev.turno}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Relatório por período (gerencial) */}
        {adminAuth && eventos.length>0 && (
          <div style={{...S.card,marginTop:6}}>
            <div style={{fontSize:12,color:S.txt2.color,textTransform:"uppercase",letterSpacing:.8,marginBottom:10,fontWeight:700}}>📄 Relatório por período (gerencial)</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>gerarPdfPeriodo(project,eventos,7,"Semanal")} style={{flex:1,padding:"11px 4px",borderRadius:11,background:"transparent",border:`1px solid ${dark?"#232b4a":"#e2e8f0"}`,color:COR.purple,fontSize:13.5,fontWeight:600,cursor:"pointer"}}>Semanal</button>
              <button onClick={()=>gerarPdfPeriodo(project,eventos,15,"Quinzenal")} style={{flex:1,padding:"11px 4px",borderRadius:11,background:"transparent",border:`1px solid ${dark?"#232b4a":"#e2e8f0"}`,color:COR.purple,fontSize:13.5,fontWeight:600,cursor:"pointer"}}>Quinzenal</button>
              <button onClick={()=>gerarPdfPeriodo(project,eventos,30,"Mensal")} style={{flex:1,padding:"11px 4px",borderRadius:11,background:"transparent",border:`1px solid ${dark?"#232b4a":"#e2e8f0"}`,color:COR.purple,fontSize:13.5,fontWeight:600,cursor:"pointer"}}>Mensal</button>
            </div>
          </div>
        )}
      </div>

      {showSheet && <EditSheet cfgForm={cfgForm} setCfgForm={setCfgForm} erro={erro} onSave={salvarConfig} onClose={()=>setShowSheet(false)} saving={saving} dark={dark} S={S}/>}
      <Toast msg={toastMsg} dark={dark}/>
    </div></div>
  );
}
