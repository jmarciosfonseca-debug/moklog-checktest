import { baixarBolsao } from "./relatorios/bolsaoRelatorio";
import { checkPin } from "./session";
import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { setDoc } from "./fireGuard";
import { SEED_P311B_JUN2026 } from "./BolsaoSeedP311B";

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




// ── Regras do POP — janela de 12h e limiares de status (ajustáveis)
const JANELA_HORAS = 12;       // mesma placa vista de novo só conta como "+1 dia" se passou desse tempo
const DIAS_ATENCAO = 5;        // a partir de quantos dias consecutivos entra em "Atenção" (calibrado com dados reais do P311B)
const DIAS_CRITICO = 8;        // a partir de quantos dias consecutivos entra em "Crítico" (calibrado com dados reais do P311B)
const MAX_SIGHTINGS = 40;      // histórico de avistamentos guardado por placa (evita doc crescer infinito)

const STATUS_CFG = {
  normal:  { label:"Normal",   color:"#22c55e", bg:"#021a0d", border:"#22c55e33" },
  atencao: { label:"Atenção",  color:"#f59e0b", bg:"#1a1000", border:"#f59e0b33" },
  critico: { label:"Crítico",  color:"#ef4444", bg:"#1a0202", border:"#ef444433" },
};

function statusFromDias(dias){
  if(dias>=DIAS_CRITICO) return "critico";
  if(dias>=DIAS_ATENCAO) return "atencao";
  return "normal";
}

function normalizaPlaca(s){
  return (s||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,7);
}

// ── Correção posicional O/0 — placas BR têm posições fixas de letra/número (tanto no
// padrão antigo LLL-NNNN quanto no Mercosul LLL N L NN). Posições 1-3 são SEMPRE letra;
// posições 4, 6 e 7 são SEMPRE número. A posição 5 é ambígua (letra no Mercosul, número
// no antigo) então não corrigimos ela automaticamente — fica como o vigilante digitou.
function corrigirOZero(placa){
  if(!placa || placa.length<4) return placa;
  const chars = placa.split("");
  for(let i=0;i<chars.length;i++){
    if(i<3){ if(chars[i]==="0") chars[i]="O"; }       // posições 1-3: força letra
    else if(i===3||i===5||i===6){ if(chars[i]==="O") chars[i]="0"; } // posições 4,6,7: força número
  }
  return chars.join("");
}

// ── Resolve placa digitada para a "placa principal" se ela bater com algum alias
// conhecido (variação de digitação já registrada antes) — redireciona de forma invisível.
function resolveAliasPrincipal(placaDigitada, placas){
  if(placas[placaDigitada]) return placaDigitada; // já é a principal
  for(const principal in placas){
    if((placas[principal].aliases||[]).includes(placaDigitada)) return principal;
  }
  return placaDigitada;
}

function fmtDateTime(iso){
  if(!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}); } catch { return "—"; }
}
function fmtDate(d){
  if(!d) return "—";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d||"—"; }
}
function todayStrLocal(){ return new Date().toLocaleDateString("sv-SE"); }

async function loadBolsao(projectId) {
  try {
    const snap = await getDoc(doc(db,"bolsao",projectId));
    if(snap.exists()) {
      const data = snap.data();
      try { localStorage.setItem(`bolsao_${projectId}`, JSON.stringify(data)); } catch(e){}
      return data.placas||{};
    }
  } catch(e){}
  try {
    const local = localStorage.getItem(`bolsao_${projectId}`);
    if(local) return JSON.parse(local).placas||{};
  } catch(e){}
  return {};
}

async function saveBolsao(projectId, placas) {
  const data = { placas, updatedAt: new Date().toISOString() };
  try { await setDoc(doc(db,"bolsao",projectId), data); } catch(e){ console.error(e); }
  try { localStorage.setItem(`bolsao_${projectId}`, JSON.stringify(data)); } catch(e){}
}

function getStyles(dark) {
  return {
    page:    { minHeight:"100vh", background:dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 90px", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:480, display:"flex", flexDirection:"column" },
    card:    { background:dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"14px 16px" },
    btn:     { background:"linear-gradient(135deg,#1d4ed8,#1e40af)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnSec:  { background:dark?"#060c18":"#f8fafc", color:dark?"#64748b":"#475569", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
    btnSm:   { background:dark?"#020510":"#f8fafc", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#64748b":"#475569", borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:600 },
    backBtn: { minHeight:44, minWidth:44, background:"transparent", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#94a3b8":"#64748b", borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 },
    inp:     { width:"100%", background:dark?"#020510":"#ffffff", border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`, borderRadius:7, color:dark?"#e2e8f0":"#1e293b", padding:"10px 12px", fontSize:13, boxSizing:"border-box", outline:"none" },
    lbl:     { display:"block", fontSize:10, color:dark?"#475569":"#64748b", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 },
    txt:     { color:dark?"#f1f5f9":"#0f172a" },
    txt2:    { color:dark?"#475569":"#64748b" },
  };
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.normal;
  return <span style={{fontSize:10,fontWeight:700,color:cfg.color,background:cfg.bg,border:`1px solid ${cfg.border}`,padding:"2px 8px",borderRadius:5}}>{cfg.label}</span>;
}

// ── Teclado próprio — letras maiúsculas + números juntos, pensado para uso com uma mão em campo
function PlacaInputNativo({ value, onChange, dark }) {
  return (
    <input
      value={value}
      onChange={e=>onChange(normalizaPlaca(e.target.value))}
      placeholder="Digite a placa..."
      autoCapitalize="characters"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      inputMode="text"
      style={{
        width:"100%", background:dark?"#020510":"#fff", border:`2px solid ${dark?"#1e293b":"#cbd5e1"}`,
        borderRadius:10, color:dark?"#f1f5f9":"#1e293b", padding:"14px 12px", fontSize:26, fontWeight:900,
        letterSpacing:4, textAlign:"center", textTransform:"uppercase", boxSizing:"border-box", outline:"none"
      }}
    />
  );
}

function PinGate({ project, onSuccess, onBack, dark }) {
  const S = getStyles(dark);
  const [mode, setMode] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const tryPin = async () => { const level=await checkPin(pin,{projectId:project?.id}); if(level) { onSuccess(level === 'demo' ? 'admin' : level); } else setErr(true); };
  return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,maxWidth:320,width:"100%",margin:16,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>🚧</div>
        <div style={{fontSize:16,fontWeight:800,...S.txt,marginBottom:4}}>Fiscalização de Bolsão</div>
        <div style={{fontSize:12,...S.txt2,marginBottom:20}}>{project.id} · {project.name}</div>
        {!mode ? (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={()=>setMode("lider")} style={{...S.btn,background:"linear-gradient(135deg,#0369a1,#0c4a6e)",fontSize:13}}>👷 Acesso Líder</button>
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
            {err&&<div style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
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

function classificaTurno(date){
  const h = date.getHours();
  return (h>=6 && h<18) ? "Diurno" : "Noturno";
}

// ── Relatório PDF — Diário / Por Turno / Semanal / Personalizado
// periodo: { label, from: Date, to: Date, turno: "Diurno"|"Noturno"|null }
// ── Relatório focado em UMA placa — histórico completo dela, bem mais curto, ideal pra evidência pontual
function gerarPDFBolsaoPlaca(project, p) { baixarBolsao({project, placas:{[p.placa]:p}}); }
function gerarPDFBolsao(project, placas, periodo, modo="geral") { baixarBolsao({project, placas, periodo, modo}); }

// ── App principal
export default function Bolsao({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }) {
  const S = getStyles(dark);
  const [authLevel, setAuthLevel] = useState(()=>sharedAuth||getAccess(project?.id)||null);
  const [screen, setScreen] = useState(()=>(sharedAuth||getAccess(project?.id))?"list":"pin"); // pin | list | registrar | relatorio
  const [placas, setPlacas] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aba, setAba] = useState("todos"); // todos | alerta | critico | bloqueados

  // Registro
  const [placaInput, setPlacaInput] = useState("");
  const [tipoInput, setTipoInput] = useState("caminhao"); // caminhao | carreta_desengatada
  const [registradoPor, setRegistradoPor] = useState(()=>{ try{return localStorage.getItem("bolsao_ultimo_nome")||"";}catch{return"";} });
  const [feedback, setFeedback] = useState(null); // {placa,status,dias,novoDia}
  const [dataIni, setDataIni] = useState(todayStrLocal());
  const [dataFim, setDataFim] = useState(todayStrLocal());
  const [modoRelatorio, setModoRelatorio] = useState("geral"); // geral | alerta
  const [buscaPlacaRelatorio, setBuscaPlacaRelatorio] = useState("");
  const [placaBloqueioForm, setPlacaBloqueioForm] = useState(null); // placa em edição dos dados do motorista
  const [importStatus, setImportStatus] = useState(null); // null | "importando" | {added, skipped}
  const [formMotorista, setFormMotorista] = useState("");
  const [formEmpresa, setFormEmpresa] = useState("");
  const [formInquilino, setFormInquilino] = useState("");
  const [formPlacaCavalo, setFormPlacaCavalo] = useState("");

  useEffect(()=>{ loadBolsao(project.id).then(p=>{ setPlacas(p||{}); setLoading(false); }); },[project.id]);

  const listaPlacas = Object.values(placas).sort((a,b)=>b.diasConsecutivos-a.diasConsecutivos);
  const listaFiltrada = listaPlacas.filter(p=>{
    if(aba==="alerta") return p.status==="atencao"||p.status==="critico";
    if(aba==="critico") return p.status==="critico";
    if(aba==="bloqueados") return !!p.bloqueado;
    return true;
  });
  const sugestoes = placaInput.length>=2
    ? listaPlacas
        .filter(p=>p.placa.startsWith(placaInput) && p.placa!==placaInput)
        .sort((a,b)=>new Date(b.ultimaVista)-new Date(a.ultimaVista))
        .slice(0,6)
    : [];

  // ── Alerta proativo: enquanto digita, se a placa (já corrigida/resolvida por alias) já é
  // conhecida e está em Atenção/Crítico, avisa o vigilante na hora — antes mesmo de confirmar o registro.
  const matchAtual = placaInput.length>=6
    ? placas[resolveAliasPrincipal(corrigirOZero(normalizaPlaca(placaInput)), placas)]
    : null;

  const registrar = async () => {
    const digitada = normalizaPlaca(placaInput);
    if(digitada.length<6){ alert("Placa incompleta — confira os caracteres."); return; }
    if(!registradoPor.trim()){ alert("Informe quem está registrando."); return; }
    try{ localStorage.setItem("bolsao_ultimo_nome",registradoPor.trim()); }catch(e){}

    // Higienização: maiúscula + corrige O/0 nas posições previsíveis + resolve alias conhecido (silencioso)
    const corrigida = corrigirOZero(digitada);
    const placa = resolveAliasPrincipal(corrigida, placas);

    setSaving(true);
    const now = new Date();
    const nowIso = now.toISOString();
    const existente = placas[placa];
    let novoDia = false;
    let entry;

    if(!existente){
      entry = { placa, primeiraVista:nowIso, ultimaVista:nowIso, diasConsecutivos:1, status:"normal", aliases:[],
        sightings:[{ts:nowIso,registradoPor:registradoPor.trim(),tipo:tipoInput}] };
      novoDia = true;
    } else {
      const horasDesde = (now.getTime()-new Date(existente.ultimaVista).getTime())/3600000;
      const sightings = [...(existente.sightings||[]), {ts:nowIso,registradoPor:registradoPor.trim(),tipo:tipoInput}].slice(-MAX_SIGHTINGS);
      if(horasDesde>=JANELA_HORAS){
        const dias = existente.diasConsecutivos+1;
        entry = { ...existente, ultimaVista:nowIso, diasConsecutivos:dias, status:statusFromDias(dias), sightings };
        novoDia = true;
      } else {
        entry = { ...existente, ultimaVista:nowIso, sightings };
      }
    }

    const next = {...placas, [placa]:entry};
    setPlacas(next);
    await saveBolsao(project.id, next);
    setSaving(false);
    setFeedback({placa, status:entry.status, dias:entry.diasConsecutivos, novoDia, aliasRedirect: placa!==digitada?digitada:null});
    setPlacaInput("");
  };

  const toggleBloqueio = async (placa) => {
    const existente = placas[placa]; if(!existente) return;
    const next = {...placas, [placa]: existente.bloqueado
      ? {...existente, bloqueado:false} // desmarca (engano ou liberado sem coleta de dados)
      : {...existente, bloqueado:true, dataBloqueio:new Date().toISOString()}
    };
    setPlacas(next);
    await saveBolsao(project.id, next);
  };

  const abrirFormMotorista = (placa) => {
    const p = placas[placa];
    setFormMotorista(p?.bloqueioDados?.motorista||"");
    setFormEmpresa(p?.bloqueioDados?.empresa||"");
    setFormInquilino(p?.bloqueioDados?.inquilino||"");
    setFormPlacaCavalo(p?.bloqueioDados?.placaCavalo||"");
    setPlacaBloqueioForm(placa);
  };

  const salvarDadosMotorista = async () => {
    if(!formMotorista.trim()||!formEmpresa.trim()||!formInquilino.trim()){
      alert("Preencha Motorista, Empresa/Transportadora e Inquilino Relacionado.");
      return;
    }
    const placa = placaBloqueioForm;
    const existente = placas[placa]; if(!existente) return;
    const bloqueioDados = {
      motorista: formMotorista.trim(), empresa: formEmpresa.trim(),
      inquilino: formInquilino.trim(), placaCavalo: normalizaPlaca(formPlacaCavalo),
      coletadoEm: new Date().toISOString(),
    };
    const next = {...placas, [placa]: {...existente, bloqueioDados}};
    setPlacas(next);
    await saveBolsao(project.id, next);
    setPlacaBloqueioForm(null);
  };

  const importarHistorico = async () => {
    if(!window.confirm(`Importar histórico de Junho/2026 (177 placas) para ${project.id}? Placas que você já tenha registrado manualmente NÃO serão sobrescritas.`)) return;
    setImportStatus("importando");
    let added=0, skipped=0;
    const next = {...placas};
    for(const placa in SEED_P311B_JUN2026){
      if(next[placa]){ skipped++; continue; } // já existe (registro real) — nunca sobrescreve
      next[placa] = SEED_P311B_JUN2026[placa];
      added++;
    }
    setPlacas(next);
    await saveBolsao(project.id, next);
    setImportStatus({added, skipped});
  };

  if(screen==="pin") return <PinGate project={project} dark={dark} onBack={onBack} onSuccess={(l)=>{grantSession(l,project.id);setAuthLevel(l);setScreen("list");onAuthGranted?.(l);}}/>;

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:30,marginBottom:10}}>🚧</div><div style={{fontSize:13,...S.txt2}}>Carregando...</div></div>
    </div>
  );

  // ── Tela de registro (foco em uso de campo, uma mão)
  // ── Tela de Relatório — seleção de período
  if(screen==="relatorio") {
    const gerar = (periodo) => { gerarPDFBolsao(project, placas, periodo, modoRelatorio); setScreen("list"); };
    const hojeInicio = (h=0) => { const d=new Date(); d.setHours(h,0,0,0); return d; };
    const hojeFim = () => new Date();
    const buscaResultados = buscaPlacaRelatorio.length>=2
      ? listaPlacas.filter(p=>p.placa.startsWith(normalizaPlaca(buscaPlacaRelatorio))).slice(0,8)
      : [];
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderBottom:`1px solid ${dark?"#0a0f1e":"#e2e8f0"}`}}>
            <button onClick={()=>setScreen("list")} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,...S.txt}}>📄 Gerar Relatório</div>
              <div style={{fontSize:11,...S.txt2}}>{project.id} · {project.name}</div>
            </div>
          </div>
          <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>

            <div style={S.card}>
              <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>🎯 Relatório de 1 Placa Específica</div>
              <div style={{fontSize:10,...S.txt2,marginBottom:8}}>Histórico completo só dela — ideal pra evidência pontual, fica bem mais curto.</div>
              <input value={buscaPlacaRelatorio} onChange={e=>setBuscaPlacaRelatorio(normalizaPlaca(e.target.value))} placeholder="Digite a placa..." autoCapitalize="characters" style={{...S.inp,fontWeight:800,letterSpacing:2,marginBottom:buscaResultados.length?8:0}}/>
              {buscaResultados.map(p=>(
                <button key={p.placa} onClick={()=>{ gerarPDFBolsaoPlaca(project, p); setScreen("list"); }}
                  style={{...S.btnSm,width:"100%",display:"flex",justifyContent:"space-between",marginBottom:5,padding:"9px 12px",color:STATUS_CFG[p.status].color,borderColor:STATUS_CFG[p.status].border}}>
                  <span style={{fontWeight:800}}>{p.placa}</span>
                  <span>{p.diasConsecutivos}d · {STATUS_CFG[p.status].label} →</span>
                </button>
              ))}
            </div>

            <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",marginTop:4}}>📊 Relatório por Período</div>

            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setModoRelatorio("geral")} style={{...S.btnSm,flex:1,padding:"10px",fontSize:12,fontWeight:700,...(modoRelatorio==="geral"?{background:"#1d4ed822",borderColor:"#1d4ed866",color:"#60a5fa"}:{})}}>📚 Geral (todas)</button>
              <button onClick={()=>setModoRelatorio("alerta")} style={{...S.btnSm,flex:1,padding:"10px",fontSize:12,fontWeight:700,...(modoRelatorio==="alerta"?{background:"#ef444422",borderColor:"#ef444466",color:"#f87171"}:{})}}>⚠️ Só Atenção/Crítico</button>
            </div>
            <div style={{fontSize:10,...S.txt2,marginTop:-4}}>{modoRelatorio==="alerta"?"Relatório bem mais curto — ignora as placas Normais.":"Inclui todas as placas do período (pode ficar longo)."}</div>

            <button onClick={()=>gerar({label:"Hoje (últimas 24h)", from:new Date(Date.now()-86400000), to:hojeFim(), turno:null})} style={{...S.btn,fontSize:14}}>🗓 Hoje (últimas 24h)</button>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>gerar({label:"Turno Diurno (hoje)", from:hojeInicio(0), to:hojeFim(), turno:"Diurno"})} style={{...S.btnSec,flex:1,fontSize:13,color:"#f59e0b",borderColor:"#f59e0b33"}}>☀️ Turno Diurno</button>
              <button onClick={()=>gerar({label:"Turno Noturno (hoje)", from:hojeInicio(0), to:hojeFim(), turno:"Noturno"})} style={{...S.btnSec,flex:1,fontSize:13,color:"#6366f1",borderColor:"#6366f133"}}>🌙 Turno Noturno</button>
            </div>
            <button onClick={()=>gerar({label:"Última semana (7 dias)", from:new Date(Date.now()-7*86400000), to:hojeFim(), turno:null})} style={{...S.btnSec,fontSize:14}}>📅 Última semana (7 dias)</button>

            <div style={{...S.card,marginTop:6}}>
              <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>🗂 Período personalizado</div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <div style={{flex:1}}><label style={S.lbl}>De</label><input type="date" value={dataIni} max={dataFim} onChange={e=>setDataIni(e.target.value)} style={S.inp}/></div>
                <div style={{flex:1}}><label style={S.lbl}>Até</label><input type="date" value={dataFim} min={dataIni} max={todayStrLocal()} onChange={e=>setDataFim(e.target.value)} style={S.inp}/></div>
              </div>
              <button onClick={()=>{
                const from = new Date(dataIni+"T00:00:00");
                const to = new Date(dataFim+"T23:59:59");
                const label = dataIni===dataFim ? `Dia ${fmtDate(dataIni)}` : `${fmtDate(dataIni)} a ${fmtDate(dataFim)}`;
                gerar({label, from, to, turno:null});
              }} style={{...S.btn,background:"linear-gradient(135deg,#92400e,#78350f)",fontSize:13}}>📄 Gerar Personalizado</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if(screen==="registrar") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",...{borderBottom:`1px solid ${dark?"#0a0f1e":"#e2e8f0"}`}}}>
          <button onClick={()=>{setScreen("list");setFeedback(null);}} style={S.backBtn}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,...S.txt}}>Registrar Placa</div>
            <div style={{fontSize:11,...S.txt2}}>{project.id} · {project.name}</div>
          </div>
        </div>

        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:12}}>
          {feedback && (
            <div style={{...S.card,textAlign:"center",border:`2px solid ${STATUS_CFG[feedback.status].border}`,background:STATUS_CFG[feedback.status].bg}}>
              <div style={{fontSize:11,...S.txt2,marginBottom:4}}>{feedback.novoDia?"✅ Registrado — novo dia computado":"✅ Registrado — dentro da janela de 12h (mesmo dia)"}</div>
              <div style={{fontSize:20,fontWeight:900,letterSpacing:2,...S.txt}}>{feedback.placa}</div>
              {feedback.aliasRedirect&&<div style={{fontSize:10,color:"#0ea5e9",marginTop:2}}>🔁 Digitado "{feedback.aliasRedirect}" — reconhecido como a mesma placa</div>}
              <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:6,alignItems:"center"}}>
                <StatusBadge status={feedback.status}/>
                <span style={{fontSize:12,fontWeight:700,color:STATUS_CFG[feedback.status].color}}>{feedback.dias}d consecutivo{feedback.dias!==1?"s":""}</span>
              </div>
            </div>
          )}

          <div style={S.card}>
            <label style={S.lbl}>Tipo de Veículo</label>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <button onClick={()=>setTipoInput("caminhao")} style={{...S.btnSm,flex:1,padding:"10px",fontSize:13,fontWeight:700,...(tipoInput==="caminhao"?{background:"#1d4ed822",borderColor:"#1d4ed866",color:"#60a5fa"}:{})}}>🚛 Caminhão</button>
              <button onClick={()=>setTipoInput("carreta_desengatada")} style={{...S.btnSm,flex:1,padding:"10px",fontSize:13,fontWeight:700,...(tipoInput==="carreta_desengatada"?{background:"#ef444422",borderColor:"#ef444466",color:"#f87171"}:{})}}>🔓 Carreta Desengatada</button>
            </div>

            <label style={S.lbl}>Placa</label>
            <PlacaInputNativo value={placaInput} onChange={setPlacaInput} dark={dark}/>
            <div style={{fontSize:10,...S.txt2,textAlign:"center",marginTop:6}}>Digite com o teclado do celular — sai sempre em maiúscula</div>

            {matchAtual && matchAtual.status!=="normal" && (
              <div style={{marginTop:12,padding:"12px 14px",borderRadius:9,background:STATUS_CFG[matchAtual.status].bg,border:`2px solid ${STATUS_CFG[matchAtual.status].border}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:18}}>{matchAtual.status==="critico"?"🚨":"⚠️"}</span>
                  <span style={{fontSize:13,fontWeight:800,color:STATUS_CFG[matchAtual.status].color}}>
                    Placa já reincidente — {matchAtual.diasConsecutivos} dia{matchAtual.diasConsecutivos!==1?"s":""} consecutivo{matchAtual.diasConsecutivos!==1?"s":""}
                  </span>
                </div>
                <div style={{fontSize:11,...S.txt2,marginBottom:matchAtual.status==="critico"&&!matchAtual.bloqueado?10:0}}>
                  {matchAtual.status==="critico"
                    ? "Já passou do limite do POP. Sugestão: avaliar bloqueio agora."
                    : `Em observação — entra em Crítico a partir de ${DIAS_CRITICO} dias.`}
                </div>
                {matchAtual.status==="critico" && !matchAtual.bloqueado && (
                  <button onClick={()=>toggleBloqueio(matchAtual.placa)} style={{...S.btnSm,width:"100%",background:"#ef444422",color:"#ef4444",borderColor:"#ef444466",fontWeight:800,padding:"9px"}}>🔒 Marcar Bloqueio Agora</button>
                )}
                {matchAtual.bloqueado && <div style={{fontSize:11,color:"#ef4444",fontWeight:700,textAlign:"center"}}>🔒 Já está marcada como Bloqueada</div>}
              </div>
            )}

            {sugestoes.length>0 && (
              <div style={{marginTop:12}}>
                <div style={{fontSize:10,...S.txt2,fontWeight:700,marginBottom:6}}>🕘 Já registradas antes, começando assim:</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {sugestoes.map(s=>(
                    <button key={s.placa} onClick={()=>setPlacaInput(s.placa)}
                      style={{...S.btnSm,color:STATUS_CFG[s.status].color,borderColor:STATUS_CFG[s.status].border,fontWeight:800,fontSize:12,padding:"7px 10px"}}>
                      {s.placa} · {s.diasConsecutivos}d
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={S.card}>
            <label style={S.lbl}>Quem está registrando</label>
            <input value={registradoPor} onChange={e=>setRegistradoPor(e.target.value)} placeholder="Nome do vigilante..." style={S.inp}/>
          </div>

          <button onClick={registrar} disabled={saving||placaInput.length<6} style={{...S.btn,opacity:(saving||placaInput.length<6)?0.5:1,fontSize:15,padding:"15px"}}>
            {saving?"Salvando...":`✓ Registrar ${placaInput||"placa"}`}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Lista principal
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderBottom:`1px solid ${dark?"#0a0f1e":"#e2e8f0"}`}}>
          <button onClick={onBack} style={S.backBtn}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,...S.txt}}>🚧 Fiscalização de Bolsão</div>
            <div style={{fontSize:11,...S.txt2}}>{project.id} · {project.name}</div>
          </div>
        </div>

        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
          <button onClick={()=>{setScreen("registrar");setFeedback(null);}} style={{...S.btn,fontSize:15,padding:"15px"}}>📋 Registrar Placa</button>
          <button onClick={()=>setScreen("relatorio")} style={{...S.btnSec,fontSize:13,color:"#92400e",borderColor:"#92400e44"}}>📄 Gerar Relatório</button>

          {authLevel==="admin" && project.id==="P311B" && (
            <div style={{...S.card,border:"1px dashed #0ea5e944"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#0ea5e9",marginBottom:6}}>📥 Importação de Histórico (Gerencial)</div>
              <div style={{fontSize:10,...S.txt2,marginBottom:8,lineHeight:1.4}}>
                Carrega o relatório de reincidências de Junho/2026 (177 placas) pra dar histórico ao módulo. Nunca sobrescreve placas já registradas no app.
              </div>
              {importStatus==="importando" && <div style={{fontSize:12,color:"#0ea5e9",textAlign:"center"}}>Importando...</div>}
              {importStatus && importStatus!=="importando" && (
                <div style={{fontSize:11,color:"#22c55e",textAlign:"center",marginBottom:6}}>✅ {importStatus.added} importada(s){importStatus.skipped>0?`, ${importStatus.skipped} já existiam (preservadas)`:""}</div>
              )}
              {(!importStatus || importStatus==="importando") && (
                <button onClick={importarHistorico} disabled={importStatus==="importando"} style={{...S.btnSm,width:"100%",color:"#0ea5e9",borderColor:"#0ea5e944",fontWeight:700,padding:"9px"}}>Importar Histórico Jun/2026</button>
              )}
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {[{k:"todos",l:"Todos",n:listaPlacas.length},{k:"alerta",l:"Alerta",n:listaPlacas.filter(p=>p.status==="atencao"||p.status==="critico").length},{k:"critico",l:"Críticos",n:listaPlacas.filter(p=>p.status==="critico").length},{k:"bloqueados",l:"🔒 Bloq.",n:listaPlacas.filter(p=>p.bloqueado).length}].map(t=>(
              <button key={t.k} onClick={()=>setAba(t.k)}
                style={{...S.btnSm,padding:"9px 2px",fontSize:10.5,fontWeight:700,...(aba===t.k?{background:"#1d4ed822",borderColor:"#1d4ed866",color:"#60a5fa"}:{})}}>
                {t.l} ({t.n})
              </button>
            ))}
          </div>

          {listaFiltrada.length===0 && (
            <div style={{textAlign:"center",padding:"30px 0"}}>
              <div style={{fontSize:28,marginBottom:8}}>🚧</div>
              <div style={{fontSize:12,...S.txt2}}>{aba==="todos"?"Nenhuma placa registrada ainda":"Nenhuma placa nessa categoria"}</div>
            </div>
          )}

          {listaFiltrada.map(p=>{
            const ultimoTipo = (p.sightings||[]).length ? p.sightings[p.sightings.length-1].tipo : "caminhao";
            return (
            <div key={p.placa} style={{...S.card,border:`1px solid ${p.bloqueado?"#ef444466":STATUS_CFG[p.status].border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:17,fontWeight:900,letterSpacing:1.5,...S.txt}}>{ultimoTipo==="carreta_desengatada"?"🔓":"🚛"} {p.placa}</span>
                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                  {p.bloqueado&&<span style={{fontSize:10,fontWeight:700,color:"#ef4444",background:"#1a0202",padding:"2px 8px",borderRadius:5}}>🔒 Bloqueado</span>}
                  <StatusBadge status={p.status}/>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,...S.txt2}}>
                <span>{p.diasConsecutivos} dia{p.diasConsecutivos!==1?"s":""} consecutivo{p.diasConsecutivos!==1?"s":""}</span>
                <span>Última: {fmtDateTime(p.ultimaVista)}</span>
              </div>
              <div style={{fontSize:10,...S.txt2,marginTop:3}}>{(p.sightings||[]).length} avistamento(s) registrado(s){p.aliases?.length?` · alias: ${p.aliases.join(", ")}`:""}</div>

              {p.bloqueado && p.bloqueioDados && (
                <div style={{marginTop:8,padding:"8px 10px",background:dark?"#020510":"#f8fafc",borderRadius:7,fontSize:11,...S.txt2}}>
                  <div><strong style={S.txt}>Motorista:</strong> {p.bloqueioDados.motorista}</div>
                  <div><strong style={S.txt}>Empresa:</strong> {p.bloqueioDados.empresa}</div>
                  <div><strong style={S.txt}>Inquilino:</strong> {p.bloqueioDados.inquilino}</div>
                  {p.bloqueioDados.placaCavalo&&<div><strong style={S.txt}>Placa Cavalo:</strong> {p.bloqueioDados.placaCavalo}</div>}
                </div>
              )}

              <div style={{display:"flex",gap:6,marginTop:9}}>
                {!p.bloqueado && (p.status==="atencao"||p.status==="critico") &&
                  <button onClick={()=>toggleBloqueio(p.placa)} style={{...S.btnSm,flex:1,color:"#ef4444",borderColor:"#ef444444",fontWeight:700}}>🔒 Marcar Bloqueio</button>}
                {p.bloqueado && !p.bloqueioDados &&
                  <button onClick={()=>abrirFormMotorista(p.placa)} style={{...S.btnSm,flex:1,color:"#f59e0b",borderColor:"#f59e0b44",fontWeight:700}}>📝 Coletar Dados do Motorista</button>}
                {p.bloqueado && p.bloqueioDados &&
                  <button onClick={()=>abrirFormMotorista(p.placa)} style={{...S.btnSm,flex:1,fontWeight:700}}>✏️ Editar Dados</button>}
                {p.bloqueado &&
                  <button onClick={()=>{if(window.confirm("Desmarcar bloqueio desta placa?")) toggleBloqueio(p.placa);}} style={{...S.btnSm,color:"#64748b"}}>✕</button>}
              </div>
            </div>
          );})}

          <div style={{fontSize:10,...S.txt2,textAlign:"center",marginTop:6,lineHeight:1.5}}>
            Regra do POP: mesma placa avistada de novo após {JANELA_HORAS}h conta +1 dia. Atenção a partir de {DIAS_ATENCAO}d · Crítico a partir de {DIAS_CRITICO}d.
          </div>
        </div>
      </div>

      {placaBloqueioForm && (
        <div onClick={()=>setPlacaBloqueioForm(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{...S.card,maxWidth:380,width:"100%",maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:15,fontWeight:800,...S.txt,marginBottom:2}}>📝 Dados do Motorista</div>
            <div style={{fontSize:18,fontWeight:900,letterSpacing:1.5,color:"#ef4444",marginBottom:14}}>{placaBloqueioForm}</div>

            <label style={S.lbl}>Nome do Motorista *</label>
            <input value={formMotorista} onChange={e=>setFormMotorista(e.target.value)} placeholder="Nome completo..." style={{...S.inp,marginBottom:10}}/>

            <label style={S.lbl}>Empresa / Transportadora *</label>
            <input value={formEmpresa} onChange={e=>setFormEmpresa(e.target.value)} placeholder="Razão social..." style={{...S.inp,marginBottom:10}}/>

            <label style={S.lbl}>Inquilino Relacionado *</label>
            <input value={formInquilino} onChange={e=>setFormInquilino(e.target.value)} placeholder="Nome do inquilino, ou 'Outros' se não for do condomínio..." style={{...S.inp,marginBottom:10}}/>

            <label style={S.lbl}>Placa do Cavalo (se for carreta)</label>
            <input value={formPlacaCavalo} onChange={e=>setFormPlacaCavalo(normalizaPlaca(e.target.value))} placeholder="Opcional..." autoCapitalize="characters" style={{...S.inp,marginBottom:14,textTransform:"uppercase"}}/>

            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setPlacaBloqueioForm(null)} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
              <button onClick={salvarDadosMotorista} style={{...S.btn,flex:1,fontSize:13,background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>✓ Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
