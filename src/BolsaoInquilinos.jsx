// ─────────────────────────────────────────────────────────────
// BolsaoInquilinos.jsx — Checagem de Bolsão (P505), padrão Mega (P311A/B)
// adaptado para vínculo com INQUILINO em vez de bloqueio de motorista.
//
// • Cada ronda de checagem registra várias placas de uma vez (mais de um
//   inquilino por rodada), com líder + hora + tipo (interno/externo).
// • Digitou uma placa já conhecida → autocompleta o inquilino sozinho e
//   mostra há quantos dias ela está pernoitando (mesma regra de janela de
//   12h do Bolsão do Mega: só soma +1 dia se a última vista foi há mais
//   de 12h, senão é a mesma "noite").
// • Fotos do local (até 3, câmera ou galeria) por rodada de checagem.
// • Relatório em PDF: período coberto, placas envolvidas e quantas vezes/
//   dias cada uma apareceu.
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
const PROJECT_PINS = { P505:"16505" };

const JANELA_HORAS = 12;   // mesma placa vista de novo só conta +1 dia se passou desse tempo
const DIAS_ATENCAO = 3;
const DIAS_CRITICO = 7;

const STATUS_CFG = {
  normal:  { label:"Normal",  color:"#22c55e", bg:"#021a0d", border:"#22c55e33" },
  atencao: { label:"Atenção", color:"#f59e0b", bg:"#1a1000", border:"#f59e0b33" },
  critico: { label:"Crítico", color:"#ef4444", bg:"#1a0202", border:"#ef444433" },
};
function statusFromDias(d){ if(d>=DIAS_CRITICO) return "critico"; if(d>=DIAS_ATENCAO) return "atencao"; return "normal"; }

function normalizaPlaca(s){ return (s||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,7); }
function corrigirOZero(placa){
  if(!placa || placa.length<4) return placa;
  const chars = placa.split("");
  for(let i=0;i<chars.length;i++){
    if(i<3){ if(chars[i]==="0") chars[i]="O"; }
    else if(i===3||i===5||i===6){ if(chars[i]==="O") chars[i]="0"; }
  }
  return chars.join("");
}
function resolveAliasPrincipal(placaDigitada, placas){
  if(placas[placaDigitada]) return placaDigitada;
  for(const principal in placas){
    if((placas[principal].aliases||[]).includes(placaDigitada)) return principal;
  }
  return placaDigitada;
}
function fmtDateTime(iso){ if(!iso) return "—"; try { return new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}); } catch { return "—"; } }
function fmtData(d){ if(!d) return "—"; try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d||"—"; } }
function todayStrLocal(){ return new Date().toLocaleDateString("sv-SE"); }
function newId(){ try { return crypto.randomUUID(); } catch { return "id-"+Date.now()+"-"+Math.random().toString(36).slice(2,8); } }

async function loadDados(projectId){
  let data = null;
  try {
    const snap = await getDoc(doc(db,"bolsao_inquilinos",projectId));
    if(snap.exists()){ data = snap.data(); try { localStorage.setItem(`bolsao_inq_${projectId}`, JSON.stringify(data)); } catch(e){} }
  } catch(e){}
  if(!data){ try { const l = localStorage.getItem(`bolsao_inq_${projectId}`); if(l) data = JSON.parse(l); } catch(e){} }
  data = data || {};
  return { placas: data.placas||{}, checagens: data.checagens||[] };
}
async function saveDados(projectId, data){
  const payload = { ...data, updatedAt:new Date().toISOString() };
  try { await setDoc(doc(db,"bolsao_inquilinos",projectId), payload); } catch(e){ console.error("bolsao_inquilinos save:", e); }
  try { localStorage.setItem(`bolsao_inq_${projectId}`, JSON.stringify(payload)); } catch(e){}
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

// ── Atualiza (ou cria) o registro de uma placa: soma +1 dia se já passou
// a janela de 12h desde a última vez que foi vista, senão mantém o dia.
function upsertPlaca(placas, placaDigitadaBruta, inquilino, tipo, nowIso){
  const digitada = normalizaPlaca(placaDigitadaBruta);
  const corrigida = corrigirOZero(digitada);
  const placa = resolveAliasPrincipal(corrigida, placas);
  const existente = placas[placa];
  let entry;
  if(!existente){
    entry = { placa, inquilino, tipo, primeiraVista:nowIso, ultimaVista:nowIso, diasConsecutivos:1, aliases:[] };
  } else {
    const horasDesde = (new Date(nowIso).getTime()-new Date(existente.ultimaVista).getTime())/3600000;
    const novoDia = horasDesde >= JANELA_HORAS;
    entry = {
      ...existente,
      inquilino: inquilino||existente.inquilino, // atualiza se veio preenchido
      tipo: tipo||existente.tipo,
      ultimaVista: nowIso,
      diasConsecutivos: novoDia ? existente.diasConsecutivos+1 : existente.diasConsecutivos,
      aliases: placa!==digitada && !(existente.aliases||[]).includes(digitada) ? [...(existente.aliases||[]),digitada] : (existente.aliases||[]),
    };
  }
  return { ...placas, [placa]:entry };
}

function gerarPdfBolsao(project, placas, checagens){
  const agora = new Date();
  const lista = Object.values(placas).sort((a,b)=>b.diasConsecutivos-a.diasConsecutivos);
  const datas = checagens.map(c=>c.data).filter(Boolean).sort();
  const periodo = datas.length ? `${fmtData(datas[0])} a ${fmtData(datas[datas.length-1])}` : "—";
  const linhasPlacas = lista.map(p=>{
    const cor = STATUS_CFG[statusFromDias(p.diasConsecutivos)].color;
    return `<tr>
      <td style="font-weight:900;letter-spacing:1px">${p.placa}</td>
      <td>${p.inquilino||"—"}</td>
      <td>${p.tipo==="interno"?"Interno":"Externo"}</td>
      <td style="text-align:center;font-weight:800;color:${cor}">${p.diasConsecutivos}</td>
      <td>${fmtDateTime(p.ultimaVista)}</td>
    </tr>`;
  }).join("");
  const linhasChecagens = [...checagens].sort((a,b)=>(b.criadoEm||"").localeCompare(a.criadoEm||"")).map(c=>`<tr>
      <td>${fmtData(c.data)} ${c.hora||""}</td>
      <td>${c.lider||"—"}</td>
      <td>${c.tipo==="interno"?"Interno":"Externo"}</td>
      <td>${(c.itens||[]).map(i=>`${i.placa} (${i.inquilino||"—"})`).join(", ")}</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Bolsão ${project.id}</title>
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;color:#0f172a;padding:20px;max-width:900px;margin:0 auto}
  h1{font-size:19px;margin:0} .sub{font-size:12px;color:#64748b;margin-top:2px}
  .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}
  .kpi{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
  .kpi-val{font-size:22px;font-weight:900} .kpi-lbl{font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:3px}
  h2{font-size:13px;margin:18px 0 6px}
  table{width:100%;border-collapse:collapse;font-size:11px} th{background:#1e293b;color:#fff;padding:6px 9px;text-align:left;font-size:10px}
  td{padding:6px 9px;border-bottom:1px solid #f1f5f9}
  .footer{text-align:center;margin-top:18px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
  @media print{body{padding:8px}@page{margin:10mm}.no-print{display:none}*{-webkit-print-color-adjust:exact!important}}
</style></head><body>
<div class="no-print" style="text-align:center;margin-bottom:14px">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<h1>🅿️ Checagem de Bolsão — ${project.id}</h1>
<div class="sub">${project.name||""} · Período: ${periodo} · Gerado em ${agora.toLocaleDateString("pt-BR")}</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-val">${lista.length}</div><div class="kpi-lbl">Placas Envolvidas</div></div>
  <div class="kpi"><div class="kpi-val">${checagens.length}</div><div class="kpi-lbl">Rondas de Checagem</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#ef4444">${lista.filter(p=>statusFromDias(p.diasConsecutivos)!=="normal").length}</div><div class="kpi-lbl">Em Atenção/Crítico</div></div>
</div>
<h2>Placas no Bolsão (por dias consecutivos)</h2>
<table><thead><tr><th>Placa</th><th>Inquilino</th><th>Tipo</th><th>Dias</th><th>Última vista</th></tr></thead><tbody>${linhasPlacas}</tbody></table>
<h2>Histórico de Rondas de Checagem</h2>
<table><thead><tr><th>Data/Hora</th><th>Líder</th><th>Tipo</th><th>Placas checadas</th></tr></thead><tbody>${linhasChecagens}</tbody></table>
<div class="footer">MokLog CheckTest · Moked Consulting Security · Bolsão ${project.id}</div>
</body></html>`;
  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`bolsao_${project.id}_${agora.toLocaleDateString("sv-SE")}.html`; a.click();
}

function getStyles(dark){
  return {
    page:{minHeight:"100vh",background:dark?"#04080f":"#f1f5f9",display:"flex",justifyContent:"center",padding:"0 0 90px",fontFamily:"'Segoe UI',system-ui,sans-serif"},
    wrap:{width:"100%",maxWidth:480,display:"flex",flexDirection:"column"},
    card:{background:dark?"#060c18":"#fff",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderRadius:12,padding:"14px 16px"},
    btn:{background:"linear-gradient(135deg,#f59e0b,#b45309)",color:"#fff",border:"none",borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8},
    btnSec:{background:dark?"#060c18":"#f8fafc",color:dark?"#64748b":"#475569",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:600,cursor:"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center"},
    btnSm:{background:dark?"#020510":"#f8fafc",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,color:dark?"#64748b":"#475569",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:600},
    backBtn:{background:"transparent",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,color:dark?"#94a3b8":"#64748b",borderRadius:7,padding:"7px 12px",fontSize:12,cursor:"pointer",flexShrink:0,fontWeight:600},
    inp:{width:"100%",background:dark?"#020510":"#fff",border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`,borderRadius:7,color:dark?"#e2e8f0":"#1e293b",padding:"10px 12px",fontSize:13,boxSizing:"border-box",outline:"none"},
    lbl:{display:"block",fontSize:10,color:dark?"#475569":"#64748b",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:.5},
    txt:{color:dark?"#f1f5f9":"#0f172a"}, txt2:{color:dark?"#475569":"#64748b"},
  };
}
function StatusBadge({status}){ const c=STATUS_CFG[status]||STATUS_CFG.normal; return <span style={{fontSize:10,fontWeight:700,color:c.color,background:c.bg,border:`1px solid ${c.border}`,padding:"2px 8px",borderRadius:5}}>{c.label}</span>; }

function PinGate({ project, onSuccess, onBack, dark }){
  const S = getStyles(dark);
  const [mode,setMode]=useState(null); const [pin,setPin]=useState(""); const [err,setErr]=useState(false);
  const tryPin=()=>{ if(pin===ADMIN_PIN){onSuccess("admin");return;} if(pin===PROJECT_PINS[project.id]){onSuccess("lider");return;} setErr(true); };
  return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,maxWidth:320,width:"100%",margin:16,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>🅿️</div>
        <div style={{fontSize:16,fontWeight:800,...S.txt,marginBottom:4}}>Checagem de Bolsão</div>
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

export default function BolsaoInquilinos({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }){
  const S = getStyles(dark);
  const [authLevel,setAuthLevel]=useState(()=>sharedAuth||getAccess(project?.id)||null);
  const [screen,setScreen]=useState(()=>(sharedAuth||getAccess(project?.id))?"list":"pin"); // pin|list|form
  const [data,setData]=useState({placas:{},checagens:[]});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [gerandoPdf,setGerandoPdf]=useState(false);
  const adminAuth = authLevel==="admin";

  const [tipo,setTipo]=useState("interno");
  const [lider,setLider]=useState("");
  const [itens,setItens]=useState([{id:newId(),placa:"",inquilino:""}]);
  const [fotos,setFotos]=useState([]);
  const [erro,setErro]=useState(null);

  useEffect(()=>{ loadDados(project.id).then(d=>{setData(d);setLoading(false);}); },[project.id]);

  const listaPlacas = Object.values(data.placas).sort((a,b)=>b.diasConsecutivos-a.diasConsecutivos);
  const checagensOrdenadas = [...data.checagens].sort((a,b)=>(b.criadoEm||"").localeCompare(a.criadoEm||""));

  const abrirForm = () => {
    setTipo("interno"); setLider("");
    setItens([{id:newId(),placa:"",inquilino:""}]);
    setFotos([]); setErro(null);
    setScreen("form");
  };

  const setItemCampo = (id, campo, valor) => {
    setItens(prev=>prev.map(it=>{
      if(it.id!==id) return it;
      const novo = {...it,[campo]:valor};
      if(campo==="placa"){
        const p = resolveAliasPrincipal(corrigirOZero(normalizaPlaca(valor)), data.placas);
        const conhecida = data.placas[p];
        if(conhecida && !it.inquilino) novo.inquilino = conhecida.inquilino||"";
      }
      return novo;
    }));
    setErro(null);
  };
  const addItem = () => setItens(prev=>[...prev,{id:newId(),placa:"",inquilino:""}]);
  const delItem = (id) => setItens(prev=>prev.length>1?prev.filter(i=>i.id!==id):prev);

  const addFoto = async (file) => {
    if(!file || fotos.length>=3) return;
    const b64 = await comprimirFoto(file);
    if(b64) setFotos(prev=>[...prev,b64]); else setErro("Não consegui processar essa foto.");
  };
  const delFoto = (i) => setFotos(prev=>prev.filter((_,j)=>j!==i));

  const registrar = async () => {
    if(!lider.trim()){ setErro("Informe o nome do líder que está fazendo a checagem."); return; }
    const validos = itens.filter(i=>normalizaPlaca(i.placa).length>=6);
    if(validos.length===0){ setErro("Registre ao menos uma placa (mínimo 6 caracteres)."); return; }
    const semInquilino = validos.find(i=>!i.inquilino.trim());
    if(semInquilino){ setErro(`Informe o inquilino da placa "${semInquilino.placa}".`); return; }

    const agora = new Date();
    const nowIso = agora.toISOString();
    let placasAtualizadas = {...data.placas};
    const itensRegistro = [];
    for(const it of validos){
      placasAtualizadas = upsertPlaca(placasAtualizadas, it.placa, it.inquilino.trim(), tipo, nowIso);
      const principal = resolveAliasPrincipal(corrigirOZero(normalizaPlaca(it.placa)), placasAtualizadas);
      itensRegistro.push({ placa:principal, inquilino:it.inquilino.trim() });
    }
    const checagem = {
      id:newId(), data:todayStrLocal(), hora:agora.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),
      lider:lider.trim(), tipo, itens:itensRegistro, fotos, criadoEm:nowIso,
    };
    const next = { placas:placasAtualizadas, checagens:[...data.checagens, checagem] };
    setSaving(true);
    setData(next);
    await saveDados(project.id, next);
    setSaving(false);
    setScreen("list");
  };

  const baixarPdf = async () => { setGerandoPdf(true); gerarPdfBolsao(project, data.placas, data.checagens); setGerandoPdf(false); };

  if(screen==="pin") return <PinGate project={project} dark={dark} onBack={onBack} onSuccess={(l)=>{grantSession(l,project.id);setAuthLevel(l);setScreen("list");onAuthGranted?.(l);}}/>;
  if(loading) return <div style={{...S.page,alignItems:"center",justifyContent:"center"}}><div style={{...S.txt2,fontSize:13}}>Carregando bolsão…</div></div>;

  const Header = (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px 10px"}}>
      <button onClick={()=>{ if(screen==="list") onBack(); else setScreen("list"); }} style={S.backBtn}>←</button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:800,...S.txt}}>🅿️ Checagem de Bolsão</div>
        <div style={{fontSize:10,...S.txt2}}>{project.id} · {project.name}</div>
      </div>
      {onToggleTheme && <button onClick={onToggleTheme} style={S.btnSm}>{dark?"☀️":"🌙"}</button>}
    </div>
  );

  // ── Formulário de nova ronda de checagem
  if(screen==="form") return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={S.card}>
          <label style={S.lbl}>Tipo de bolsão</label>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            {[["interno","🏠 Interno"],["externo","🌐 Externo"]].map(([v,l])=>(
              <button key={v} onClick={()=>setTipo(v)} style={{flex:1,padding:"11px",borderRadius:8,fontWeight:800,fontSize:13,cursor:"pointer",
                border:`1px solid ${tipo===v?"#f59e0b":(dark?"#0f172a":"#e2e8f0")}`,background:tipo===v?"#f59e0b22":(dark?"#020510":"#fff"),
                color:tipo===v?"#f59e0b":(dark?"#64748b":"#94a3b8")}}>{l}</button>
            ))}
          </div>
          <label style={S.lbl}>Líder responsável pela checagem</label>
          <input value={lider} onChange={e=>{setLider(e.target.value);setErro(null);}} placeholder="Nome completo" style={S.inp}/>
          <div style={{fontSize:10,...S.txt2,marginTop:6}}>Horário registrado automaticamente: {new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
        </div>

        {itens.map((it,i)=>{
          const p = resolveAliasPrincipal(corrigirOZero(normalizaPlaca(it.placa)), data.placas);
          const conhecida = normalizaPlaca(it.placa).length>=6 ? data.placas[p] : null;
          return (
            <div key={it.id} style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:12,fontWeight:800,...S.txt}}>Veículo {i+1}</div>
                {itens.length>1 && <button onClick={()=>delItem(it.id)} style={{...S.btnSm,color:"#ef4444",borderColor:"#ef444433"}}>🗑</button>}
              </div>
              <label style={S.lbl}>Placa</label>
              <input value={it.placa} onChange={e=>setItemCampo(it.id,"placa",e.target.value)} placeholder="ABC1D23"
                style={{...S.inp,textTransform:"uppercase",letterSpacing:2,fontWeight:800,marginBottom:8}}/>
              {conhecida && (
                <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,marginBottom:8}}>
                  🔁 Já conhecida — pernoitando há {conhecida.diasConsecutivos} dia{conhecida.diasConsecutivos===1?"":"s"} <StatusBadge status={statusFromDias(conhecida.diasConsecutivos)}/>
                </div>
              )}
              <label style={S.lbl}>Inquilino</label>
              <input value={it.inquilino} onChange={e=>setItemCampo(it.id,"inquilino",e.target.value)} placeholder="Ex: GAC" style={S.inp}/>
            </div>
          );
        })}
        <button onClick={addItem} style={{...S.btnSec,fontSize:13}}>➕ Adicionar outro inquilino/placa</button>

        <div style={S.card}>
          <label style={S.lbl}>Fotos do local (opcional, até 3)</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            {fotos.map((f,i)=>(
              <div key={i} style={{position:"relative"}}>
                <img src={f} alt="Foto" style={{width:72,height:72,objectFit:"cover",borderRadius:8,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}/>
                <button onClick={()=>delFoto(i)} style={{position:"absolute",top:-6,right:-6,background:"#ef4444",color:"#fff",border:"none",borderRadius:"50%",width:21,height:21,fontSize:12,cursor:"pointer"}}>×</button>
              </div>
            ))}
            {fotos.length<3 && (
              <>
                <label style={{...S.btnSec,padding:"10px 13px",fontSize:12,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,width:"auto"}}>
                  📷 Câmera
                  <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{addFoto(e.target.files?.[0]);e.target.value="";}}/>
                </label>
                <label style={{...S.btnSec,padding:"10px 13px",fontSize:12,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,width:"auto"}}>
                  🖼️ Galeria
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{addFoto(e.target.files?.[0]);e.target.value="";}}/>
                </label>
              </>
            )}
          </div>
        </div>

        {erro && <div role="alert" style={{fontSize:12,color:"#ef4444",textAlign:"center"}}>{erro}</div>}
        <button onClick={()=>setScreen("list")} style={{...S.btnSec,fontSize:13}}>Cancelar</button>
        <button onClick={registrar} disabled={saving} style={{...S.btn,opacity:saving?.6:1}}>{saving?"Salvando…":"✓ Registrar Checagem"}</button>
      </div>
    </div></div>
  );

  // ── Lista principal
  return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
        <button onClick={abrirForm} style={S.btn}>▶ Nova Checagem de Ronda</button>
        {data.checagens.length>0 && (
          <button onClick={baixarPdf} disabled={gerandoPdf} style={{...S.btnSec,fontSize:13,color:"#7c3aed",borderColor:"#7c3aed44"}}>{gerandoPdf?"Gerando…":"📄 Gerar PDF"}</button>
        )}

        {listaPlacas.length>0 && <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginTop:4}}>No bolsão ({listaPlacas.length})</div>}
        {listaPlacas.map(p=>(
          <div key={p.placa} style={{...S.card,padding:"10px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:14,fontWeight:900,...S.txt,letterSpacing:1}}>{p.placa}</div>
                <div style={{fontSize:11,...S.txt2}}>{p.inquilino||"—"} · {p.tipo==="interno"?"Interno":"Externo"}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:16,fontWeight:900,color:STATUS_CFG[statusFromDias(p.diasConsecutivos)].color}}>{p.diasConsecutivos}d</div>
                <StatusBadge status={statusFromDias(p.diasConsecutivos)}/>
              </div>
            </div>
            <div style={{fontSize:10,...S.txt2,marginTop:6}}>Última checagem: {fmtDateTime(p.ultimaVista)}</div>
          </div>
        ))}

        {checagensOrdenadas.length>0 && <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginTop:4}}>Histórico de rondas ({checagensOrdenadas.length})</div>}
        {checagensOrdenadas.map(c=>(
          <div key={c.id} style={{...S.card,padding:"10px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <div style={{fontSize:12,fontWeight:700,...S.txt}}>{fmtData(c.data)} · {c.hora}</div>
              <span style={{fontSize:10,fontWeight:800,color:"#f59e0b"}}>{c.tipo==="interno"?"Interno":"Externo"}</span>
            </div>
            <div style={{fontSize:11,...S.txt2,marginTop:2}}>Líder: {c.lider}</div>
            <div style={{fontSize:11,...S.txt2}}>{(c.itens||[]).map(i=>`${i.placa} (${i.inquilino})`).join(", ")}</div>
            {(c.fotos||[]).length>0 && (
              <div style={{display:"flex",gap:6,marginTop:8}}>
                {c.fotos.map((f,i)=><img key={i} src={f} alt="" style={{width:56,height:56,objectFit:"cover",borderRadius:6,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}/>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div></div>
  );
}
