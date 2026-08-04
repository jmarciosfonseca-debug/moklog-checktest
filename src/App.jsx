import React, { useState, useEffect, useCallback, useRef } from "react";
import AcessoApp from "./Acesso";
import KeyAccessFalha from "./KeyAccessFalha";
import EquipeApp from "./Equipe";
import AcessoCCO from "./AcessoCCO";
import Ocorrencias from "./Ocorrencias";
import EmpresaInfo from "./EmpresaInfo";
import Equipamentos from "./Equipamentos";
import Visita from "./Visita";
import Bolsao from "./Bolsao";
import RondaVSPP from "./RondaVSPP";
import Inquilinos from "./Inquilinos";
import Perimetral from "./Perimetral";
import Intervalos from "./Intervalos";
import { grantSession, getAccess, hasGerencial, touchSession, isDemo, checkPin } from "./session";
import CCO from "./CCO";
import Iluminacao, { loadIluminacao, tqAlvoVigente, tqAlvoTimestamp, TQ_HORA } from "./Iluminacao";
import BolsaoInquilinos from "./BolsaoInquilinos";
import EnergiaOcorrencias, { loadEnergiaResumoParaPDF } from "./EnergiaOcorrencias";
import RondaDiaria from "./RondaDiaria";
import AnaliseRisco, { ANALISE_RISCO_ELIGIBLE } from "./AnaliseRisco";
import { generatePDF, generateConsolidatedPDF, generateGroupComparativePDF } from "./generatePDF";

// ── Hook de conectividade
function useOnlineStatus() {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  React.useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return isOnline;
}

// ── Firebase save com retry automático (até 3 tentativas)
async function safeFirebaseSave(saveFn, maxRetries = 3) {
  let lastError;
  for(let attempt = 1; attempt <= maxRetries; attempt++) {
    if(!navigator.onLine) {
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 8000);
        window.addEventListener("online", () => { clearTimeout(timeout); resolve(); }, { once: true });
      });
    }
    try {
      await saveFn();
      return { ok: true };
    } catch(e) {
      lastError = e;
      console.warn(`Firebase save attempt ${attempt}/${maxRetries} failed:`, e.message);
      if(attempt < maxRetries) await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  return { ok: false, error: lastError };
}

// ── Escudo de proteção global contra crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError:false, error:null, errorInfo:null };
  }
  static getDerivedStateFromError(error) {
    return { hasError:true, error };
  }
  componentDidCatch(error, info) {
    console.error(`[MokLog ErrorBoundary] Módulo: ${this.props.moduleName||"desconhecido"}`, error, info);
    this.setState({ errorInfo: info });
    try {
      const log = JSON.parse(localStorage.getItem("moklog_errors")||"[]");
      log.unshift({ ts: new Date().toISOString(), module: this.props.moduleName||"?", msg: error?.message||"?", stack: error?.stack?.slice(0,300)||"?" });
      localStorage.setItem("moklog_errors", JSON.stringify(log.slice(0,10)));
    } catch(e){}
  }
  render() {
    if(this.state.hasError) {
      const isInline = this.props.inline;
      const moduleName = this.props.moduleName || "módulo";
      const errMsg = this.state.error?.message || "Erro desconhecido";
      const isNullErr = errMsg.includes("Cannot read") || errMsg.includes("null") || errMsg.includes("undefined");
      const friendlyMsg = isNullErr
        ? "Dado incompleto ou corrompido no banco de dados."
        : errMsg;

      if(isInline) {
        return (
          <div style={{background:"#1a0202",border:"1px solid #ef444444",borderRadius:10,padding:"10px 14px",margin:"4px 0"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>⚠️</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:"#ef4444",fontWeight:700}}>Erro em: {moduleName}</div>
                <div style={{fontSize:11,color:"#94a3b8"}}>{friendlyMsg}</div>
              </div>
              <button onClick={()=>this.setState({hasError:false,error:null,errorInfo:null})}
                style={{background:"#1d4ed8",color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:700,flexShrink:0}}>
                🔄 Tentar
              </button>
            </div>
          </div>
        );
      }

      return (
        <div style={{minHeight:"100vh",background:"#04080f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif",padding:24}}>
          <div style={{background:"#1a0202",border:"2px solid #ef4444",borderRadius:16,padding:"28px 24px",maxWidth:360,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
            <div style={{fontSize:16,fontWeight:800,color:"#f1f5f9",marginBottom:8}}>Algo deu errado</div>
            <div style={{fontSize:12,color:"#94a3b8",marginBottom:6}}>
              Módulo: <strong style={{color:"#f59e0b"}}>{moduleName}</strong>
            </div>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:20,background:"#0f0202",borderRadius:8,padding:"8px 12px",textAlign:"left",wordBreak:"break-word"}}>
              {friendlyMsg}
            </div>
            <button onClick={()=>this.setState({hasError:false,error:null,errorInfo:null})}
              style={{background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",border:"none",borderRadius:10,padding:"12px 24px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",marginBottom:8}}>
              🔄 Tentar novamente
            </button>
            <button onClick={()=>window.location.reload()}
              style={{background:"transparent",color:"#94a3b8",border:"1px solid #1e293b",borderRadius:10,padding:"10px 24px",fontSize:13,fontWeight:600,cursor:"pointer",width:"100%"}}>
              ↩ Recarregar app
            </button>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:12}}>
              Os dados salvos localmente estão protegidos.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children || null;
  }
}

function SafeBlock({ name, children }) {
  return (
    <ErrorBoundary moduleName={name} inline={true}>
      {children}
    </ErrorBoundary>
  );
}
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs, onSnapshot } from "firebase/firestore";
import { setDoc } from "./fireGuard";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const EMAILJS_SERVICE_ID  = "service_k7e0d0j";
const EMAILJS_TEMPLATE_ID = "template_dhncs7j";
const EMAILJS_PUBLIC_KEY  = "qnGBgZu7xNKnavJb7";

async function sendEmailJS(subject, message, fromName) {
  if (isDemo()) { console.log("🎭 demo: e-mail não enviado"); return true; } // demo: simula envio
  try {
    await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: { subject, message, name: fromName || "MokLog CheckTest", email: "moklog@moked.com.br" }
      })
    });
    return true;
  } catch(e) { console.error("EmailJS error:", e); return false; }
}

const firebaseConfig = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
  messagingSenderId: "390165325023",
  appId: "1:390165325023:web:3147cd333503916b0d756a"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// Login anônimo: garante um "crachá" para o Firestore. Enquanto a regra for
// `if true` isto é inofensivo; passa a ser exigido só quando a regra virar
// `if request.auth != null`. Idempotente e à prova de falha (não trava o app).
let _anonTried = false;
function ensureAnonAuth(){
  if(_anonTried) return;
  _anonTried = true;
  try {
    if(!auth.currentUser){
      signInAnonymously(auth).catch(e=>console.warn("[auth] login anônimo falhou:", e?.code||e));
    }
  } catch(e){ console.warn("[auth] indisponível:", e); }
}
ensureAnonAuth();

// ── Puxa os inquilinos/galpões do projeto para anexar ao PDF do relatório
// semanal (mesma fonte do módulo Inquilinos — sem duplicar cadastro)
async function loadInquilinosParaPDF(projectId){
  try {
    const snap = await getDoc(doc(db,"inquilinos",projectId));
    if(snap.exists()) return snap.data().unidades||[];
  } catch(e){}
  try {
    const l = localStorage.getItem(`inquilinos_${projectId}`);
    if(l) return (JSON.parse(l).unidades)||[];
  } catch(e){}
  return [];
}

async function saveToFirebase(projectId, history) {
  const result = await safeFirebaseSave(async () => {
    await setDoc(doc(db,"projects",projectId),{history,updatedAt:new Date().toISOString()});
  });
  if(!result.ok) console.error("Firebase save failed after retries:", result.error);
  return result;
}
async function loadAllFromFirebase() {
  try { const snap=await getDocs(collection(db,"projects")); const data={}; snap.forEach(d=>{data[d.id]=d.data();}); return data; }
  catch(e){ return {}; }
}
async function deleteReportFromFirebase(projectId, newHistory) {
  try { await setDoc(doc(db,"projects",projectId),{history:newHistory,updatedAt:new Date().toISOString()}); }
  catch(e){ console.error("Firebase delete:",e); }
}

function generateViewToken(projectId) {
  return Math.random().toString(36).substring(2,10) + Math.random().toString(36).substring(2,10);
}

const PROJECT_PINS = {
  P601:"16601", P602:"16602", P604:"16604", P605:"16605",
  P606:"16606", P607:"16607", P311A:"16311", P311B:"16311", P505:"16505",
  P260A:"162601", P260B:"162602", P260C:"162603"
};

const JATINOX_SUBS = {
  P260A: { id:"P260A", name:"Jatinox Unidade A", hasAcesso:true,  hasEquipe:true,  hasCaoGuarda:false },
  P260B: { id:"P260B", name:"Jatinox Unidade B", hasAcesso:false, hasEquipe:true,  hasCaoGuarda:false },
  P260C: { id:"P260C", name:"Jatinox Unidade C", hasAcesso:false, hasEquipe:true,  hasCaoGuarda:true  },
};

const ADMIN_PIN = "872101";
const MAX_HISTORY = 26;
// Sessão de PIN centralizada em src/session.js (expiração por inatividade: gerencial 30min, equipe 5min)
const INOP_ALERT_WEEKS = 2;
const RECURRENCE_WARN = 2;
const RECURRENCE_CRIT = 3;

async function requestNotificationPermission() {
  if(!("Notification" in window)) return false;
  if(Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function sendNotification(title, body, icon="") {
  if(Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon: "/favicon.ico" }); }
  catch(e){}
}

function scheduleWeeklyNotifications(projectName, projectId) {
  const schedules = JSON.parse(localStorage.getItem("moklog_notif_schedule")||"{}");
  schedules[projectId] = { projectName, scheduledAt: Date.now() };
  localStorage.setItem("moklog_notif_schedule", JSON.stringify(schedules));
}

function checkPendingNotifications(stored) {
  try {
  if(!("Notification" in window)||Notification.permission !== "granted") return;
  const now = new Date();
  const isSunday = now.getDay() === 0;
  if(!isSunday) return;
  const lastCheck = localStorage.getItem("moklog_notif_lastcheck");
  const today = now.toDateString();
  if(lastCheck === today) return;
  localStorage.setItem("moklog_notif_lastcheck", today);
  const hour = now.getHours();
  Object.values(PROJECTS).forEach(p => {
    const hist = stored[p.id]?.history??[];
    const lastReport = hist.slice(-1)[0];
    const lastDate = lastReport?.meta?.date;
    const todayStr = now.toLocaleDateString("sv-SE");
    const filledToday = lastDate === todayStr;
    if(hour >= 8 && hour < 14) {
      sendNotification("MokLog CheckTest", `${p.id} – ${p.name}: Lembrete do teste semanal de hoje!`);
    }
    if(hour >= 14 && !filledToday) {
      sendNotification("MokLog CheckTest ⚠️", `${p.id} – Teste semanal ainda não registrado. Não esqueça!`);
    }
  });
  } catch(e){ console.log("Notif check error:",e); }
}

// Projetos elegíveis ao módulo de Fiscalização de Bolsão Externo — por ora só Mega CL (P311A/B)
const BOLSAO_ELIGIBLE = ["P311A","P311B"];
// Projetos elegíveis ao Teste Perimetral universal — todos os centros logísticos, exceto Jatinox (P260A/B/C)
const PERIMETRAL_ELIGIBLE = ["P601","P602","P604","P605","P606","P607","P311A","P311B","P505"];
const PROJECTS = {
  P601: {
    id:"P601", name:"Golgi Cajamar", short:"Cajamar",
    categories:[
      {id:"fire",label:"01 - ALARME DE INC\u00caNDIO",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"perimeter",label:"02 - ALARME PERIMETRAL",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04","Zona 05"]},
      {id:"ac",label:"03 - AR-CONDICIONADO",type:"items",itemLabels:["CCO 01","CCO 02","CCO 03","Portaria 01"]},
      {id:"bollards",label:"04 - BOLLARDS / PINOS",type:"items",itemLabels:["01","02","03","04","05","06","07"]},
      {id:"cancelas_adm",label:"05 - CANCELAS ADM (ADMINISTRATIVAS)",type:"items",itemLabels:["Cancela 01","Cancela 02","Cancela 03","Cancela 04"]},
      {id:"cancelas_as",label:"06 - CANCELAS AS (ALTA SEGURAN\u00c7A)",type:"items",itemLabels:["Acesso 01","Acesso 02","Acesso 03","Acesso 04","Acesso 05"]},
      {id:"cftv",label:"07 - CFTV",type:"count",total:71},
      {id:"interfone",label:"08 - INTERFONES",type:"items",itemLabels:["CCO","Apoio Motorista"]},
      {id:"internet",label:"09 - INTERNET",type:"single"},
      {id:"joystick",label:"10 - JOYSTICK",type:"items",itemLabels:["CCO"]},
      {id:"qr_cancelas",label:"11 - LEITORES QR CANCELAS",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Entrada 05","Entrada 06","Entrada 07","Entrada 08","Entrada 09","Entrada 10","Sa\u00edda 01","Sa\u00edda 02","Sa\u00edda 03","Sa\u00edda 04","Sa\u00edda 05","Sa\u00edda 06","Sa\u00edda 07","Sa\u00edda 08","Sa\u00edda 09","Sa\u00edda 10"]},
      {id:"mesa",label:"12 - MESA CONTROLADORA / BOTOEIRA",type:"items",itemLabels:["Mesa 01","Mesa 02"]},
      {id:"mon_cda",label:"13 - MONITOR CCO CDA (CONTROLE DE ACESSO)",type:"items",itemLabels:["Monitor 01"]},
      {id:"mon_cftv",label:"14 - MONITOR CCO CFTV",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03"]},
      {id:"mon_portaria",label:"15 - MONITOR PORTARIA",type:"notes"},
      {id:"nobreaks",label:"16 - NOBREAKS",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"paradox",label:"17 - PARADOX",type:"items",itemLabels:["CCO"]},
      {id:"reverso",label:"18 - PICTOGRAMA REVERSIVO",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Entrada 05","Sa\u00edda 01","Sa\u00edda 02","Sa\u00edda 03","Sa\u00edda 04","Sa\u00edda 05"]},
      {id:"portas_cco",label:"19 - PORTAS CCO",type:"items",itemLabels:["Entrada","Sa\u00edda"]},
      {id:"panic_fix",label:"20 - P\u00c2NICO FIXO",type:"items",itemLabels:["CCO 01","CCO 02","Fixo Externo"]},
      {id:"panic_mob",label:"21 - P\u00c2NICO M\u00d3VEL",type:"items",itemLabels:["L\u00edder","Ronda 01","Ronda 02","Reserva"]},
      {id:"semaforos",label:"22 - SEM\u00c1FOROS",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Entrada 05","Sa\u00edda 01","Sa\u00edda 02","Sa\u00edda 03","Sa\u00edda 04","Sa\u00edda 05"]},
      {id:"sensores",label:"23 - SENSORES ANTI-ESMAGAMENTO",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Entrada 05","Sa\u00edda 01","Sa\u00edda 02","Sa\u00edda 03","Sa\u00edda 04","Sa\u00edda 05"]},
      {id:"telefone",label:"24 - TELEFONE CCO",type:"items",itemLabels:["CCO"]},
      {id:"torniquetes",label:"25 - TORNIQUETES / QR CODE",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 01","Sa\u00edda 02"]},
      {id:"totem_mot",label:"26 - TOTEM MOTORISTA",type:"items",itemLabels:["Totem 01"]},
      {id:"totem_vis",label:"27 - TOTEM VISITANTES",type:"items",itemLabels:["Totem 01"]},
      {id:"manutencao",label:"28 - VISITA DE MANUTEN\u00c7\u00c3O",type:"maintenance"},
      {id:"infra",label:"29 - INFRAESTRUTURA / OBS.",type:"notes"}
    ]
  },
  P602: {id:"P602",name:"Golgi Mau\u00e1",short:"Mau\u00e1",categories:[
      {id:"fire",label:"01 - ALARME DE INC\u00caNDIO",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"perimeter",label:"02 - ALARME PERIMETRAL",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04"]},
      {id:"ac",label:"03 - AR-CONDICIONADO",type:"items",itemLabels:["CCO 01","Portaria 01"]},
      {id:"cco_equip_v2",label:"04 - CCO (EQUIPAMENTOS)",type:"items",itemLabels:["Ar-Condicionado","Mesa Gatbox","Joystick","CPU 01","CPU 02","CPU 03"]},
      {id:"cftv",label:"05 - CFTV",type:"count",total:42},
      {id:"garras",label:"06 - GARRAS (ECLUSAS)",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 01","Sa\u00edda 02"]},
      {id:"internet",label:"07 - INTERNET",type:"single"},
      {id:"mon_cda",label:"08 - MONITOR CCO CDA (CONTROLE DE ACESSO)",type:"items",itemLabels:["Monitor 01"]},
      {id:"mon_cftv",label:"09 - MONITOR CCO CFTV",type:"items",itemLabels:["Monitor 01","Monitor 02"]},
      {id:"mon_portaria",label:"10 - MONITOR PORTARIA",type:"notes"},
      {id:"portaria",label:"11 - PORTARIA",type:"items",itemLabels:["Tablet","Joystick","Ar-Condicionado","Transformador"]},
      {id:"portoes_eclusa",label:"12 - PORT\u00d5ES ECLUSA",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 01","Sa\u00edda 02"]},
      {id:"qr_eclusas",label:"13 - QR ECLUSAS",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Sa\u00edda 01","Sa\u00edda 02","Sa\u00edda 03","Sa\u00edda 04"]},
      {id:"qr_torn",label:"14 - QR TORNIQUETES",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 01","Sa\u00edda 02"]},
      {id:"torniquetes",label:"15 - TORNIQUETES",type:"items",itemLabels:["Torniquete 01","Torniquete 02"]},
      {id:"token",label:"16 - TOTEM ATM",type:"items",itemLabels:["Entrada","Sa\u00edda"]},
      {id:"manutencao",label:"17 - VISITA DE MANUTEN\u00c7\u00c3O",type:"maintenance"},
      {id:"infra",label:"18 - INFRAESTRUTURA / OBS.",type:"notes"}
    ]},
  P604: {id:"P604",name:"Golgi Jundia\u00ed",short:"Jundia\u00ed",categories:[
      {id:"fire",label:"01 - ALARME DE INC\u00caNDIO (REPETIDORAS)",type:"items",itemLabels:["Repetidora 01","Repetidora 02","Repetidora 03","Repetidora 04"]},
      {id:"perimeter",label:"02 - ALARME PERIMETRAL",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04","Zona 05","Zona 06","Zona 07"]},
      {id:"ac",label:"03 - AR-CONDICIONADO",type:"items",itemLabels:["CCO 01","CCO 02","Recep\u00e7\u00e3o"]},
      {id:"cancelas_estac",label:"04 - CANCELAS ADM (ADMINISTRATIVAS)",type:"items",itemLabels:["Cancela 01","Cancela 02"]},
      {id:"cancelas_baia",label:"05 - CANCELAS AS (ALTA SEGURAN\u00c7A)",type:"items",itemLabels:["Cancela 01","Cancela 02","Cancela 03","Cancela 04"]},
      {id:"cftv",label:"06 - CFTV",type:"count",total:73},
      {id:"interfone",label:"07 - INTERFONE / INTERCOMUNICADOR",type:"items",itemLabels:["CCO","Recep\u00e7\u00e3o"]},
      {id:"internet",label:"08 - INTERNET",type:"single"},
      {id:"qr_baia",label:"09 - LEITORES QR (BAIA)",type:"items",itemLabels:["QR 01","QR 02","QR 03","QR 04","QR 05","QR 06","QR 07","QR 08"]},
      {id:"qr_torn",label:"10 - LEITORES QR (TORNIQUETES)",type:"items",itemLabels:["QR 01","QR 02","QR 03","QR 04","QR 05","QR 06","QR 07","QR 08"]},
      {id:"mesa_cco",label:"11 - MESA CONTROLE / BOTOEIRAS CCO",type:"items",itemLabels:["CCO"]},
      {id:"mesa_rec",label:"12 - MESA CONTROLE / BOTOEIRAS RECEP\u00c7\u00c3O",type:"items",itemLabels:["Recep\u00e7\u00e3o"]},
      {id:"joystick",label:"13 - MESA JOYSTICK",type:"items",itemLabels:["CCO"]},
      {id:"mon_cda",label:"14 - MONITOR CCO CDA (CONTROLE DE ACESSO)",type:"items",itemLabels:["Monitor 01"]},
      {id:"mon_cftv",label:"15 - MONITOR CCO CFTV",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03","Monitor 04"]},
      {id:"mon_portaria",label:"16 - MONITOR PORTARIA",type:"notes"},
      {id:"monitores_rec",label:"17 - MONITORES RECEP\u00c7\u00c3O",type:"items",itemLabels:["Monitor 01","Monitor 02"]},
      {id:"nobreak",label:"18 - NOBREAK",type:"items",itemLabels:["CCO"]},
      {id:"paradox",label:"19 - PARADOX",type:"items",itemLabels:["CCO","Recep\u00e7\u00e3o"]},
      {id:"bollards",label:"20 - PINOS BOLLARDS",type:"items",itemLabels:["Pino 01","Pino 02","Pino 03","Pino 04","Pino 05","Pino 06","Pino 07","Pino 08"]},
      {id:"semaforos",label:"21 - SEM\u00c1FOROS (BAIA)",type:"items",itemLabels:["Sem\u00e1foro 01","Sem\u00e1foro 02","Sem\u00e1foro 03","Sem\u00e1foro 04"]},
      {id:"sensores",label:"22 - SENSORES ANTI-ESMAGAMENTO",type:"items",itemLabels:["Sensor 01","Sensor 02","Sensor 03","Sensor 04"]},
      {id:"telefone",label:"23 - TELEFONE",type:"items",itemLabels:["CCO","Recep\u00e7\u00e3o"]},
      {id:"torniquetes",label:"24 - TORNIQUETES",type:"items",itemLabels:["Torniquete 01","Torniquete 02","Torniquete 03","Torniquete 04"]},
      {id:"totem_motorista",label:"25 - TOTEM MOTORISTA",type:"items",itemLabels:["Totem 01"]},
      {id:"totens_pedestre",label:"26 - TOTENS AUTO ATENDIMENTO (PEDESTRES)",type:"items",itemLabels:["Totem 01","Totem 02","Totem 03","Totem 04"]},
      {id:"totens_baia",label:"27 - TOTENS CONTROLE VEICULAR",type:"items",itemLabels:["Totem 01","Totem 02","Totem 03","Totem 04"]},
      {id:"manutencao",label:"28 - VISITA DE MANUTEN\u00c7\u00c3O",type:"maintenance"},
      {id:"infra",label:"29 - INFRAESTRUTURA / OBS.",type:"notes"}
    ]},
  P605: {id:"P605",name:"Golgi Dutra",short:"Dutra",categories:[
      {id:"perimeter",label:"01 - ALARME PERIMETRAL",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04"]},
      {id:"fire",label:"02 - ALARME SDAI",type:"items",itemLabels:["Galp\u00e3o A","Galp\u00e3o B"]},
      {id:"ac",label:"03 - AR-CONDICIONADO",type:"items",itemLabels:["CCO Servidores","CCO Monitores","Portaria"]},
      {id:"bollards",label:"04 - BOLLARDS / PINOS",type:"items",itemLabels:["Entrada 01 \u2013 Pino 01","Entrada 01 \u2013 Pino 02","Reversiva 02 \u2013 Pino 03","Reversiva 02 \u2013 Pino 04","Sa\u00edda 04 \u2013 Pino 05","Sa\u00edda 04 \u2013 Pino 06"]},
      {id:"cancelas",label:"05 - CANCELAS AS (ALTA SEGURAN\u00c7A)",type:"items",itemLabels:["Entrada 01","Entrada 02 Reversa","Sa\u00edda 03 Reversa","Sa\u00edda 04"]},
      {id:"cftv",label:"06 - CFTV",type:"count",total:54},
      {id:"cofres",label:"07 - COFRES",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"eclusas",label:"08 - ECLUSAS",type:"items",itemLabels:["CCO Porta 01 Ext.","CCO Porta 02 Int.","Portaria Porta 01 Int.","Portaria Porta 01 Ext."]},
      {id:"giroflex",label:"09 - GIROFLEX ECLUSAS",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 03 Reversa","Sa\u00edda 04"]},
      {id:"intercomunicador",label:"10 - INTERCOMUNICADORES",type:"items",itemLabels:["CCO","CDA","Elevador"]},
      {id:"internet",label:"11 - INTERNET",type:"items",itemLabels:["ADM","Visitantes"]},
      {id:"joystick",label:"12 - JOYSTICK DIGIFORT",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"qr_cancelas",label:"13 - LEITORES QR CANCELAS",type:"items",itemLabels:["Entrada 01 \u2013 Sup","Entrada 01 \u2013 Inf","Entrada 02 \u2013 Sup","Entrada 02 \u2013 Inf","Sa\u00edda 03 \u2013 Sup","Sa\u00edda 03 \u2013 Inf","Sa\u00edda 04 \u2013 Sup","Sa\u00edda 04 \u2013 Inf"]},
      {id:"mesa",label:"14 - MESA CONTROLADORA",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"mon_cda",label:"15 - MONITOR CCO CDA (CONTROLE DE ACESSO)",type:"items",itemLabels:["Monitor 01"]},
      {id:"mon_cftv",label:"16 - MONITOR CCO CFTV",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03","Monitor 04","Monitor 05"]},
      {id:"mon_portaria",label:"17 - MONITOR PORTARIA",type:"notes"},
      {id:"nobreak",label:"18 - NOBREAK CCO",type:"items",itemLabels:["CCO"]},
      {id:"pictogramas",label:"19 - PICTOGRAMAS / FAR\u00d3IS",type:"items",itemLabels:["Farol 01","Farol 02","Farol 03","Farol 04","Farol 05","Farol 06"]},
      {id:"panic_fix",label:"20 - P\u00c2NICO FIXO",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"panic_mob",label:"21 - P\u00c2NICO M\u00d3VEL",type:"items",itemLabels:["GA L\u00edder 01","GA L\u00edder 02","GB VSPP 01","GB VSPP 02"]},
      {id:"semaforos",label:"22 - SEM\u00c1FOROS / L\u00c2MPADAS PILOTO",type:"items",itemLabels:["Entrada 01","Entrada 02 Reversa","Sa\u00edda 03 Reversa","Sa\u00edda 04"]},
      {id:"telefone",label:"23 - TELEFONES",type:"items",itemLabels:["CCO Ramal","CCO Emergencial","CCO Fixo","Portaria 01","Portaria 02"]},
      {id:"torniquetes",label:"24 - TORNIQUETES",type:"items",itemLabels:["Torniquete 01 E/S","Torniquete 02 E/S","Torniquete 03 E/S","Torniquete 04 E/S"]},
      {id:"totens",label:"25 - TOTENS",type:"items",itemLabels:["Visitantes","Motorista (CDA)"]},
      {id:"manutencao",label:"26 - VISITA DE MANUTEN\u00c7\u00c3O",type:"maintenance"},
      {id:"infra",label:"27 - INFRAESTRUTURA / OBS.",type:"notes"}
    ]},
  P606: {id:"P606",name:"Golgi Duque de Caxias",short:"Duque",categories:[
      {id:"fire",label:"01 - ALARME DE INC\u00caNDIO",type:"items",itemLabels:["CCO","Galp\u00e3o 01","Galp\u00e3o 02","Galp\u00e3o 03","Galp\u00e3o 04","Galp\u00e3o 05","Galp\u00e3o 06","Galp\u00e3o 07","Galp\u00e3o 08","Galp\u00e3o 09","Galp\u00e3o 10"]},
      {id:"perimeter",label:"02 - ALARME PERIMETRAL",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03"]},
      {id:"panic",label:"03 - BOT\u00d5ES DE P\u00c2NICO",type:"items",itemLabels:["M\u00f3vel 01","M\u00f3vel 02","Fixo CCO","Fixo Recep\u00e7\u00e3o","Fixo Guarita"]},
      {id:"cancela",label:"04 - CANCELA",type:"items",itemLabels:["Entrada Principal"]},
      {id:"cftv",label:"05 - CFTV",type:"count",total:72},
      {id:"dilaceradores",label:"06 - DILACERADORES",type:"items",itemLabels:["Entrada 01","Reversiva 02","Sa\u00edda 03"]},
      {id:"interfone",label:"07 - INTERFONES",type:"items",itemLabels:["Portaria 01","Portaria 02","Portaria 03","Guarita Entrada"]},
      {id:"joystick",label:"08 - JOYSTICK CFTV",type:"items",itemLabels:["CCO"]},
      {id:"qr_eclusas",label:"09 - LEITORAS QR ECLUSAS",type:"items",itemLabels:["QR 01","QR 02","QR 03","QR 04","QR 05","QR 06","QR 07","QR 08","QR 09","QR 10","QR 11","QR 12"]},
      {id:"qr_torn",label:"10 - LEITORAS QR TORNIQUETES",type:"items",itemLabels:["QR 01","QR 02","QR 03","QR 04"]},
      {id:"mesa",label:"11 - MESA CONTROLADORA",type:"items",itemLabels:["Portaria","CFTV"]},
      {id:"mon_cda",label:"12 - MONITOR CCO CDA (CONTROLE DE ACESSO)",type:"items",itemLabels:["Monitor 01","Monitor 02"]},
      {id:"mon_cftv",label:"13 - MONITOR CCO CFTV",type:"items",itemLabels:["Monitor 01","Monitor 02"]},
      {id:"mon_portaria",label:"14 - MONITOR PORTARIA",type:"notes"},
      {id:"portoes_balanca",label:"15 - PORT\u00d5ES BALAN\u00c7A HUBLOG",type:"items",itemLabels:["Port\u00e3o 01","Port\u00e3o 02","Port\u00e3o 03","Port\u00e3o 04"]},
      {id:"portoes_portaria",label:"16 - PORT\u00d5ES PORTARIA",type:"items",itemLabels:["Port\u00e3o 01","Port\u00e3o 02","Port\u00e3o 03","Port\u00e3o 04","Port\u00e3o 05","Port\u00e3o 06"]},
      {id:"telefone",label:"17 - TELEFONE FIXO CCO",type:"items",itemLabels:["CCO"]},
      {id:"televisores",label:"18 - TELEVISORES",type:"items",itemLabels:["Apoio Caminhoneiro","Recep\u00e7\u00e3o"]},
      {id:"totens",label:"19 - TOTENS KEYACCESS",type:"items",itemLabels:["\u00c1rea Externa","\u00c1rea Interna"]},
      {id:"manutencao",label:"20 - VISITA DE MANUTEN\u00c7\u00c3O",type:"maintenance"},
      {id:"infra",label:"21 - INFRAESTRUTURA / OBS.",type:"notes"}
    ]},
  P607: {id:"P607",name:"Golgi Bras\u00edlia",short:"Bras\u00edlia",categories:[
      {id:"fire",label:"01 - ALARME DE INC\u00caNDIO",type:"items",itemLabels:["Painel CCO","Painel Guarita","Painel ADM"]},
      {id:"perimeter",label:"02 - ALARME PERIMETRAL",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04"]},
      {id:"anti_esmag",label:"03 - ANTI-ESMAGAMENTO",type:"items",itemLabels:["Eclusa Ent 1 \u2013 AE 01","Eclusa Ent 1 \u2013 AE 02","Eclusa Ent 2 \u2013 AE 01","Eclusa Ent 2 \u2013 AE 02"]},
      {id:"ac",label:"04 - AR-CONDICIONADO CCO",type:"items",itemLabels:["Aparelho 01"]},
      {id:"botoeiras",label:"05 - BOTOEIRAS PORT\u00d5ES",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 01","Sa\u00edda 02"]},
      {id:"cftv",label:"06 - CFTV",type:"count",total:44},
      {id:"guarita",label:"07 - GUARITA / RECEP\u00c7\u00c3O",type:"items",itemLabels:["Computador","Monitor 01","Monitor 02","Modem Internet"]},
      {id:"joystick",label:"08 - JOYSTICK",type:"items",itemLabels:["CCO"]},
      {id:"qr_leitores",label:"09 - LEITORES QR CODE",type:"items",itemLabels:["Torniquete 1 Entrada","Torniquete 1 Sa\u00edda","Torniquete 2 Entrada","Torniquete 2 Sa\u00edda","Eclusa Ent 1 \u2013 QR 01","Eclusa Ent 1 \u2013 QR 02","Eclusa Ent 2 \u2013 QR 01","Eclusa Ent 2 \u2013 QR 02","Eclusa Sa\u00ed 1 \u2013 QR 01","Eclusa Sa\u00ed 1 \u2013 QR 02","Eclusa Sa\u00ed 2 \u2013 QR 01","Eclusa Sa\u00ed 2 \u2013 QR 02"]},
      {id:"mon_cda",label:"10 - MONITOR CCO CDA (CONTROLE DE ACESSO)",type:"items",itemLabels:["Monitor 01"]},
      {id:"mon_cftv",label:"11 - MONITOR CCO CFTV",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03"]},
      {id:"monitor_ka",label:"12 - MONITOR KEYACCESS",type:"items",itemLabels:["Monitor 01"]},
      {id:"mon_portaria",label:"13 - MONITOR PORTARIA",type:"notes"},
      {id:"motores",label:"14 - MOTORES DOS PORT\u00d5ES",type:"items",itemLabels:["Ent 1 \u2013 M01","Ent 1 \u2013 M02","Ent 1 \u2013 M03","Ent 2 \u2013 M01","Ent 2 \u2013 M02","Ent 2 \u2013 M03","Sa\u00ed 1 \u2013 M01","Sa\u00ed 1 \u2013 M02","Sa\u00ed 1 \u2013 M03","Sa\u00ed 1 \u2013 M04","Sa\u00ed 2 \u2013 M01","Sa\u00ed 2 \u2013 M02","Sa\u00ed 2 \u2013 M03","Sa\u00ed 2 \u2013 M04"]},
      {id:"nobreak",label:"15 - NOBREAK",type:"items",itemLabels:["CCO"]},
      {id:"portoes",label:"16 - PORT\u00d5ES",type:"items",itemLabels:["Eclusa Ent 1 \u2013 P01","Eclusa Ent 1 \u2013 P02","Eclusa Ent 2 \u2013 P01","Eclusa Ent 2 \u2013 P02","Eclusa Sa\u00ed 1 \u2013 P01","Eclusa Sa\u00ed 1 \u2013 P02","Eclusa Sa\u00ed 2 \u2013 P01","Eclusa Sa\u00ed 2 \u2013 P02"]},
      {id:"panic",label:"17 - P\u00c2NICO M\u00d3VEL",type:"items",itemLabels:["Ronda","Pista","CCO"]},
      {id:"sensores",label:"18 - SENSORES DOS PORT\u00d5ES",type:"items",itemLabels:["Ent 1 \u2013 S01","Ent 1 \u2013 S02","Ent 1 \u2013 S03","Ent 1 \u2013 S04","Ent 2 \u2013 S01","Ent 2 \u2013 S02","Ent 2 \u2013 S03","Ent 2 \u2013 S04","Sa\u00ed 1 \u2013 S01","Sa\u00ed 1 \u2013 S02","Sa\u00ed 1 \u2013 S03","Sa\u00ed 1 \u2013 S04","Sa\u00ed 2 \u2013 S01","Sa\u00ed 2 \u2013 S02","Sa\u00ed 2 \u2013 S03","Sa\u00ed 2 \u2013 S04"]},
      {id:"tablets",label:"19 - TABLETS KEYACCESS",type:"items",itemLabels:["Tablet 01","Tablet 02"]},
      {id:"totens",label:"20 - TOTENS",type:"items",itemLabels:["Entrada","Sa\u00edda"]},
      {id:"manutencao",label:"21 - VISITA DE MANUTEN\u00c7\u00c3O",type:"maintenance"},
      {id:"infra",label:"22 - INFRAESTRUTURA / OBS.",type:"notes"}
    ]},
  P311A: {id:"P311A",name:"Mega CL Curitiba",short:"Curitiba",categories:[
      {id:"perimeter",label:"01 - ALARME PERIMETRAL",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Alambrado/Gradil"]},
      {id:"ac",label:"02 - AR-CONDICIONADO",type:"items",itemLabels:["CCO","Sala T\u00e9cnica","Sala Gest\u00e3o"]},
      {id:"botoeiras",label:"03 - BOTOEIRAS / PORT\u00d5ES DE ACESSO",type:"items",itemLabels:["Bot\u00e3o 01","Bot\u00e3o 02","Bot\u00e3o 03","Bot\u00e3o 04","Bot\u00e3o 05","Bot\u00e3o 06"]},
      {id:"panic",label:"04 - BOT\u00d5ES DE P\u00c2NICO",type:"items",itemLabels:["L\u00edder","CCO"]},
      {id:"cancelas",label:"05 - CANCELAS DE ACESSO",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Sa\u00edda 01","Sa\u00edda 02"]},
      {id:"portas_cco",label:"06 - CCO / ABERTURA DE PORTAS",type:"items",itemLabels:["Porta 01 Externa","Porta 02 Interna"]},
      {id:"cftv",label:"07 - CFTV",type:"count",total:140},
      {id:"computadores",label:"08 - COMPUTADORES / CCO",type:"items",itemLabels:["Computador 01","Computador 02","Internet/Rede"]},
      {id:"dilaceradores",label:"09 - DILACERADORES",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Sa\u00edda 04","Sa\u00edda 05"]},
      {id:"intercomunicadores",label:"10 - INTERCOMUNICADORES",type:"items",itemLabels:["Intercomunicador 01","Intercomunicador 02","Intercomunicador 03"]},
      {id:"intercom_totem",label:"11 - INTERCOMUNICADORES DE TOTEM",type:"items",itemLabels:["Totem Superior 01","Totem Superior 02","Totem Superior 03","Totem Superior 04","Totem Superior 05","Totem Superior 06","Totem Inferior 01","Totem Inferior 02","Totem Inferior 03","Totem Inferior 04","Totem Inferior 05","Totem Inferior 06"]},
      {id:"qr_code",label:"12 - LEITORES DE QR CODE",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Sa\u00edda 01","Sa\u00edda 02","Sa\u00edda 03"]},
      {id:"materiais",label:"13 - MATERIAIS OPERACIONAIS",type:"items",itemLabels:["Smartphone (x3)","Lanterna (x2)","Armamento (x2)","Muni\u00e7\u00e3o (x36)","R\u00e1dio HT (x3)","Bodycam (x3)","Moto de Ronda","P\u00e2nico ZTRAX (x2)"]},
      {id:"mon_cda",label:"14 - MONITOR CCO CDA (CONTROLE DE ACESSO)",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03"]},
      {id:"mon_cftv",label:"15 - MONITOR CCO CFTV",type:"items",itemLabels:["Monitor 01","Monitor 02"]},
      {id:"portoes",label:"16 - PORT\u00d5ES",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Sa\u00edda 01","Sa\u00edda 02"]},
      {id:"alertas",label:"17 - RECEBIMENTO DE ALERTAS EXTERNOS",type:"items",itemLabels:["Central Moked","Central Auxiliar"]},
      {id:"sdai",label:"18 - SDAI (INC\u00caNDIO)",type:"items",itemLabels:["Central 01","Central 02","Central 03","Central 04","Central 05"]},
      {id:"keyaccess",label:"19 - SISTEMA KEYACCESS",type:"items",itemLabels:["Torniquete 01","Torniquete 02","Torniquete 03"]},
      {id:"totens",label:"20 - TOTENS DE AUTOATENDIMENTO",type:"items",itemLabels:["Entrada","Sa\u00edda"]},
      {id:"video_porteiro",label:"21 - V\u00cdDEO PORTEIRO",type:"items",itemLabels:["V\u00eddeo Porteiro 01","V\u00eddeo Porteiro 02","V\u00eddeo Porteiro 03","V\u00eddeo Porteiro 04"]},
      {id:"manutencao",label:"22 - VISITA DE MANUTEN\u00c7\u00c3O",type:"maintenance"},
      {id:"infra",label:"23 - INFRAESTRUTURA / OBS.",type:"notes"}
    ]},
  P311B: {id:"P311B",name:"Mega CL Itaja\u00ed",short:"Itaja\u00ed",categories:[
      {id:"perimeter",label:"01 - ALARME PERIMETRAL",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04","Zona 05","Zona 06"]},
      {id:"ac",label:"02 - AR-CONDICIONADO",type:"items",itemLabels:["CCO","Sala T\u00e9cnica"]},
      {id:"botoeiras",label:"03 - BOTOEIRAS DO DILACERADOR",type:"items",itemLabels:["Botoeira 01","Botoeira 02","Botoeira 03"]},
      {id:"panic",label:"04 - BOT\u00d5ES DE P\u00c2NICO",type:"items",itemLabels:["CCO Fixo","Ronda M\u00f3vel","L\u00edder M\u00f3vel"]},
      {id:"portas_cco",label:"05 - CCO / CONTROLE DE ACESSO",type:"items",itemLabels:["Porta 01 Externa \u2013 Local","Porta 01 Externa \u2013 Remota","Porta 02 Interna \u2013 Local","Porta 02 Interna \u2013 Remota"]},
      {id:"cftv",label:"06 - CFTV",type:"count",total:114},
      {id:"computadores",label:"07 - COMPUTADORES / CCO",type:"items",itemLabels:["Computador Principal","Computador Secund\u00e1rio","Internet"]},
      {id:"dilaceradores",label:"08 - DILACERADORES",type:"items",itemLabels:["Cancela 01","Cancela 02","Cancela 03","Cancela 04"]},
      {id:"qr_code",label:"09 - LEITORES QR CODE",type:"items",itemLabels:["Cancela 01 Sup","Cancela 01 Inf","Cancela 02 Sup","Cancela 02 Inf","Cancela 04 Sup","Cancela 04 Inf","Sa\u00edda Cancela 02 Sup","Sa\u00edda Cancela 02 Inf","Sa\u00edda Cancela 03 Sup","Sa\u00edda Cancela 03 Inf","Sa\u00edda Cancela 04 Sup","Sa\u00edda Cancela 04 Inf"]},
      {id:"materiais",label:"10 - MATERIAIS OPERACIONAIS",type:"items",itemLabels:["Smartphone (x3)","Lanterna (x2)","Armamento (x2)","Muni\u00e7\u00e3o (x36)","R\u00e1dio HT (x3)","Bodycam (x2)","Moto de Ronda","P\u00e2nico ZTRAX (x2)"]},
      {id:"mon_cda",label:"11 - MONITOR CCO CDA (CONTROLE DE ACESSO)",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03","Monitor 04"]},
      {id:"mon_cftv",label:"12 - MONITOR CCO CFTV",type:"items",itemLabels:["Monitor 01","Monitor 02"]},
      {id:"portoes",label:"13 - PORT\u00d5ES",type:"items",itemLabels:["Port\u00e3o 01","Port\u00e3o 02","Port\u00e3o 03","Port\u00e3o 04"]},
      {id:"sdai",label:"14 - SDAI (INC\u00caNDIO)",type:"items",itemLabels:["Central Portaria","Central Casa de Bombas","Central Sala T\u00e9cnica"]},
      {id:"keyaccess",label:"15 - SISTEMA KEYACCESS",type:"items",itemLabels:["Catraca 01","Catraca 02","Catraca 03"]},
      {id:"totens_cancela",label:"16 - TOTENS NAS CANCELAS",type:"items",itemLabels:["Totem Cancela 01","Totem Cancela 02","Totem Cancela 03","Totem Cancela 04","Totem Cancela 05","Totem Cancela 06"]},
      {id:"manutencao",label:"17 - VISITA DE MANUTEN\u00c7\u00c3O",type:"maintenance"},
      {id:"infra",label:"18 - INFRAESTRUTURA / OBS.",type:"notes"}
    ]},
  P505: {id:"P505",name:"Klog Guarulhos",short:"Guarulhos",categories:[
      {id:"perimeter",label:"01 - ALARME PERIMETRAL",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04","Zona 05","Zona 06","Zona 07","Zona 08","Zona 09","Zona 10","Zona 11","Zona 12"]},
      {id:"sdai",label:"02 - ALARME SDAI PORTARIA",type:"items",itemLabels:["G100","G200"]},
      {id:"ac",label:"03 - AR-CONDICIONADO",type:"items",itemLabels:["CCO","Portaria Aparelho 01"]},
      {id:"panic",label:"04 - BOT\u00d5ES DE P\u00c2NICO",type:"items",itemLabels:["Fixo CCO"]},
      {id:"cancelas",label:"05 - CANCELAS, HASTES E MOTORES",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 03 Reversiva","Sa\u00edda 04"]},
      {id:"cftv",label:"06 - CFTV",type:"count",total:73},
      {id:"eclusas",label:"07 - ECLUSAS CCO E PORTARIA",type:"items",itemLabels:["CCO Porta 01 Ext \u2013 Local","CCO Porta 02 Int \u2013 Local","Portaria Porta 01 Int \u2013 Local","Portaria Porta 02 Ext \u2013 Local"]},
      {id:"eletroima",label:"08 - ELETROIM\u00c3 / ECLUSA / PORTAS",type:"items",itemLabels:["Portaria","CCO","Eclusa"]},
      {id:"farois",label:"09 - FAR\u00d3IS DAS CANCELAS",type:"items",itemLabels:["Cancela Eclusa 01 Ext","Cancela Eclusa 01 Int","Cancela Eclusa 02 Ext","Cancela Eclusa 02 Int","Cancela Eclusa 03 Ext","Cancela Eclusa 03 Int","Cancela Eclusa 04 Ext"]},
      {id:"garra",label:"10 - GARRA DE TIGRE",type:"items",itemLabels:["Eclusa Entrada 01","Eclusa Entrada 02","Eclusa Reversiva 03","Eclusa Sa\u00edda 04"]},
      {id:"giroflex",label:"11 - GIROFLEX DAS ECLUSAS",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 03 Reversiva","Sa\u00edda 04"]},
      {id:"intercomunicadores",label:"12 - INTERCOMUNICADORES",type:"items",itemLabels:["Portaria","CCO","Torniquetes","Cancelas"]},
      {id:"internet",label:"13 - INTERNET",type:"single"},
      {id:"facial",label:"14 - LEITORES FACIAIS ECLUSAS/CANCELAS",type:"items",itemLabels:["Eclusa Entrada 01","Eclusa Entrada 02","Eclusa Sa\u00edda 03 Reversiva","Eclusa Sa\u00edda 04"]},
      {id:"mesa",label:"15 - MESA CONTROLADORA CCO E PORTARIA",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"mon_cda",label:"16 - MONITOR CCO CDA (CONTROLE DE ACESSO)",type:"items",itemLabels:["Monitor 01"]},
      {id:"mon_cftv",label:"17 - MONITOR CCO CFTV",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03","Monitor 04","Monitor 05"]},
      {id:"mon_portaria",label:"18 - MONITOR PORTARIA",type:"notes"},
      {id:"portoes",label:"19 - PORT\u00d5ES / ANTI-ESMAGAMENTO",type:"items",itemLabels:["Eclusa 01 Externa","Eclusa 01 Interna","Eclusa 02 Externa","Eclusa 02 Interna","Eclusa 03 Externa","Eclusa 03 Interna","Eclusa 04 Externa","Eclusa 04 Interna"]},
      {id:"telefone",label:"20 - TELEFONE FIXO CCO E PORTARIA",type:"items",itemLabels:["Ramal CCO","Ramal Portaria"]},
      {id:"torniquetes",label:"21 - TORNIQUETES LEITORES FACIAIS",type:"items",itemLabels:["Torniquete 01 E/S","Torniquete 02 E/S","Torniquete 03 E/S","Torniquete 04 E/S"]},
      {id:"totens",label:"22 - TOTENS VISITANTES / MOTORISTAS",type:"items",itemLabels:["Totem Visitantes","Totem Motoristas"]},
      {id:"manutencao",label:"23 - VISITA DE MANUTEN\u00c7\u00c3O",type:"maintenance"},
      {id:"infra",label:"24 - INFRAESTRUTURA / OBS.",type:"notes"}
    ]},
  P260A: {id:"P260A",name:"Jatinox Unidade A",short:"Jatinox A",categories:[{id:"panic_fix",label:"01 - Bot\u00f5es de P\u00e2nico Fixos",type:"items",itemLabels:["CCO","P1","P2","P3"]},{id:"cerca",label:"02 - Cerca El\u00e9trica",type:"items",itemLabels:["Zona 07","Zona 08"]},{id:"eclusa_cco",label:"03 - Eclusa CCO",type:"items",itemLabels:["Abertura Remota","Sa\u00edda de Emerg\u00eancia"]},{id:"eclusa_p3",label:"04 - Port\u00e3o Eclusa P3",type:"items",itemLabels:["Externa (com interfone)","Interna (com interfone)"]},{id:"telefonia",label:"05 - Telefonia",type:"items",itemLabels:["Smartphone CCO/L\u00edder 01","Smartphone CCO/L\u00edder 02","Ramal P1","Ramal P2"]},{id:"cftv",label:"06 - Imagens CFTV",type:"count",total:65},{id:"campainhas",label:"07 - Campainhas",type:"items",itemLabels:["Port\u00e3o 01","Port\u00e3o 02"]},{id:"sala_cftv",label:"08 - Sala de CFTV CCO",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03","Monitor 04","Monitor 05","Monitor 06","Monitor 07","Teclado 01","Teclado 02","Teclado 03","RAC","Telefone Fixo 01","Telefone Fixo 02"]},{id:"cam_sistema",label:"09 - C\u00e2meras Sistema Sala",type:"count",total:132},{id:"recepcao_p3",label:"10 - Recep\u00e7\u00e3o P3",type:"items",itemLabels:["Monitor 01","Monitor 02","Teclado 01","Teclado 02","CPU 01","CPU 02","Telefone Fixo 01","Telefone Fixo 02","Impressora","Intercomunicador de Guich\u00ea","DVR 01","DVR 02"]},{id:"sirenes",label:"11 - Sirenes c/ Ilumina\u00e7\u00e3o",type:"items",itemLabels:["Roberto Koch (s/ ilum.)","Presidente Wilson 01 (c/ ilum.)","Presidente Wilson 02 (c/ ilum.)","Ubarana 01 (c/ ilum.)","Ubarana 02 (c/ ilum.)","Ubarana 03 (c/ ilum.)","Ubarana 04 (c/ ilum.)","Ubarana 05 (c/ ilum.)"]},{id:"manutencao",label:"12 - Visita de Manuten\u00e7\u00e3o",type:"maintenance"},{id:"infra",label:"13 - Infraestrutura / Obs.",type:"notes"}]},
};

function daysSince(dateStr) {
  if(!dateStr) return null;
  try {
    const d = new Date(dateStr + "T12:00:00");
    const now = new Date();
    return Math.floor((now - d) / (1000 * 60 * 60 * 24));
  } catch { return null; }
}

function getProjectScore(project, history) {
  if(!history || history.length === 0) return null;
  const last6 = history.slice(-6);
  const avg = Math.round(last6.reduce((a, r) => a + computeHealth(project, r.state).pct, 0) / last6.length);
  const consistency = last6.every(r => computeHealth(project, r.state).pct >= 90);
  if(avg >= 95 && consistency) return {grade:"A", color:"#22c55e", label:"Excelente"};
  if(avg >= 88) return {grade:"B", color:"#3b82f6", label:"Bom"};
  if(avg >= 75) return {grade:"C", color:"#f59e0b", label:"Regular"};
  return {grade:"D", color:"#ef4444", label:"Cr\u00edtico"};
}

function isLastSundayOfMonth() {
  const now = new Date();
  if(now.getDay() !== 0) return false;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + 7);
  return nextSunday.getMonth() !== now.getMonth();
}

function getAllPendencies(stored) {
  const result = [];
  Object.values(PROJECTS).forEach(project => {
    const hist = stored[project.id]?.history ?? [];
    if(!hist.length) return;
    const last = hist[hist.length - 1];
    for(const cat of project.categories) {
      const s = last.state[cat.id]; if(!s) continue;
      if(cat.type === "single") {
        const st = s.status ?? (s.ok === false ? "inop" : "ok");
        if(st !== "ok") {
          const days = daysSince(s.since);
          result.push({project, cat: cat.label, item: "\u2014", status: st, since: s.since, days, note: s.note});
        }
      } else if(cat.type === "items") {
        s.forEach((v, i) => {
          const st = v.status ?? (v.ok === false ? "inop" : "ok");
          if(st !== "ok") {
            const days = daysSince(v.since);
            result.push({project, cat: cat.label, item: cat.itemLabels[i], status: st, since: v.since, days, note: v.note});
          }
        });
      } else if(cat.type === "count") {
        (s.inoperative ?? []).forEach(it => {
          const days = daysSince(it.since);
          result.push({project, cat: cat.label, item: it.id||"?", status:"inop", since: it.since, days, note: it.note});
        });
      }
    }
  });
  return result.sort((a,b) => (b.days||0) - (a.days||0));
}

const todayStr = () => new Date().toLocaleDateString("sv-SE");
const isSunday = () => new Date().getDay() === 0; // domingo: dia do teste semanal — botão pisca
function proximoDomingo(){
  const d = new Date(); d.setHours(23,59,59,999);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return d;
}
function ContagemProximoDomingo({ light }){
  const [agora, setAgora] = useState(()=>Date.now());
  useEffect(()=>{
    const t = setInterval(()=>setAgora(Date.now()), 30000);
    return ()=>clearInterval(t);
  },[]);
  const alvo = proximoDomingo();
  const diff = Math.max(0, alvo.getTime() - agora);
  const dias = Math.floor(diff/86400000);
  const horas = Math.floor((diff%86400000)/3600000);
  const minutos = Math.floor((diff%3600000)/60000);
  const dataFmt = alvo.toLocaleDateString("pt-BR");
  const cor = light ? "#bfdbfe" : "#94a3b8";
  return (
    <>
      <div style={{fontSize:12,color:cor,marginTop:2,fontWeight:600}}>Próximo relatório: domingo, {dataFmt}</div>
      <div style={{fontSize:11,color:cor,marginTop:1,fontWeight:700}}>⏳ {dias}d {horas}h {minutos}min</div>
    </>
  );
}
const fmtDate = (d) => { if(!d)return"\u2014"; const[y,m,day]=d.split("-"); return`${day}/${m}/${y}`; };

// Contador regressivo do Teste Quinzenal de Iluminação — mostrado no bloco da home.
// Lê o alvo vigente de iluminacao/{pid} (lazy, sem travar a home). Zera às 21h do
// domingo-alvo e NÃO avança sozinho: fica "pendente" até a equipe concluir o teste
// dentro do módulo. Formato igual ao contador do relatório semanal (Xd Xh Xmin).
function ContadorIluminacao({ projectId }){
  const [tq, setTq] = useState(undefined); // undefined = carregando; null = sem registro
  const [agora, setAgora] = useState(()=>Date.now());
  useEffect(()=>{
    let vivo = true;
    loadIluminacao(projectId).then(d=>{ if(vivo) setTq(d?.testeQuinzenal||null); }).catch(()=>{ if(vivo) setTq(null); });
    return ()=>{ vivo=false; };
  },[projectId]);
  useEffect(()=>{
    const t = setInterval(()=>setAgora(Date.now()), 30000);
    return ()=>clearInterval(t);
  },[]);
  if(tq===undefined) return null; // ainda carregando — não pisca
  const alvo = tqAlvoVigente(tq);
  const limite = tqAlvoTimestamp(alvo);
  const diff = limite - agora;
  const pendente = diff <= 0;
  if(pendente){
    return <div style={{fontSize:10,color:"#f87171",marginTop:3,fontWeight:700}}>⚠️ Teste pendente — concluir</div>;
  }
  const dias = Math.floor(diff/86400000);
  const horas = Math.floor((diff%86400000)/3600000);
  const minutos = Math.floor((diff%3600000)/60000);
  return <div style={{fontSize:10,color:"#eab308",marginTop:3,fontWeight:700}}>⏳ {dias}d {horas}h {minutos}min · dom {fmtDate(alvo)} 21h</div>;
}
const calcPct = (ok,total) => total===0?100:Math.round((ok/total)*100);

function getWeekLabel(dateStr) {
  if(!dateStr) return "S?";
  try {
    const d = new Date(dateStr+"T12:00:00");
    const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    const year = d.getFullYear();
    const monthIdx = d.getMonth();
    const day = d.getDate();
    let firstSun = new Date(year, monthIdx, 1);
    while(firstSun.getDay() !== 0) firstSun.setDate(firstSun.getDate()+1);
    const firstSunDay = firstSun.getDate();
    const diff = day - firstSunDay;
    let week;
    if(diff < 0) { week = 1; }
    else { week = Math.min(Math.floor(diff/7) + 1, 5); }
    return "S"+week+" "+months[monthIdx];
  } catch { return "S?"; }
}

function buildBlank(project) {
  const st = {};
  for(const cat of project.categories){
    if(cat.type==="single") st[cat.id]={status:"ok",note:"",since:""};
    else if(cat.type==="items") st[cat.id]=cat.itemLabels.map(()=>({status:"ok",note:"",since:""}));
    else if(cat.type==="count") st[cat.id]={total:cat.total,inoperative:[]};
    else if(cat.type==="notes") st[cat.id]={items:[]};
    else if(cat.type==="maintenance") st[cat.id]={visits:[]};
  }
  return st;
}

function buildFromLast(project, lastState) {
  if(!lastState) return buildBlank(project);
  const st = {};
  for(const cat of project.categories){
    if(cat.type==="single"){
      const prev=lastState[cat.id];
      const prevSt=prev?.status??(prev?.ok===false?"inop":"ok");
      st[cat.id]={status:prevSt, note:prev?.note||"", since:prevSt!=="ok"?prev?.since||todayStr():""};
    } else if(cat.type==="items"){
      const prev=lastState[cat.id]??cat.itemLabels.map(()=>({status:"ok",note:"",since:""}));
      // normaliza para array (compat com estados antigos salvos como objeto)
      const prevArr=Array.isArray(prev)?prev:Object.keys(prev).sort((a,b)=>(+a)-(+b)).map(k=>prev[k]);
      st[cat.id]=cat.itemLabels.map((_,i)=>{
        const p=prevArr[i]??{status:"ok"};
        const pSt=p.status??(p.ok===false?"inop":"ok");
        return {status:pSt, note:p.note||"", since:pSt!=="ok"?p.since||todayStr():""};
      });
    } else if(cat.type==="count"){
      st[cat.id]={total:lastState[cat.id]?.total??cat.total, inoperative:[...(lastState[cat.id]?.inoperative??[])]};
    } else if(cat.type==="notes") st[cat.id]={items:[]};
    else if(cat.type==="maintenance") st[cat.id]={visits:[]};
  }
  return st;
}

function extractChronicItems(project, state) {
  if(!state) return [];
  const CHRONIC_DAYS = 150;
  const out = [];
  const calcDays = (since) => since ? Math.floor((Date.now()-new Date(since+"T12:00:00").getTime())/86400000) : null;
  for(const cat of project.categories){
    const s = state[cat.id]; if(!s) continue;
    if(cat.type==="single" && s.status && s.status!=="ok" && s.since){
      const days = calcDays(s.since);
      if(days!==null && days>CHRONIC_DAYS) out.push({label:cat.label, since:s.since, days, note:s.note||""});
    } else if(cat.type==="items" && Array.isArray(s)){
      s.forEach((v,i)=>{
        if(v?.status && v.status!=="ok" && v.since){
          const days = calcDays(v.since);
          if(days!==null && days>CHRONIC_DAYS) out.push({label:`${cat.label} — ${cat.itemLabels?.[i]||`Item ${i+1}`}`, since:v.since, days, note:v.note||""});
        }
      });
    } else if(cat.type==="count" && Array.isArray(s.inoperative)){
      s.inoperative.forEach(it=>{
        if(it?.since){
          const days = calcDays(it.since);
          if(days!==null && days>CHRONIC_DAYS) out.push({label:`${cat.label} — ${it.id||"Item"}`, since:it.since, days, note:it.note||""});
        }
      });
    }
  }
  return out;
}

function computeHealth(project, state) {
  let total=0, okCount=0, partial=0, inop=0;
  if(!state || typeof state!=="object") return { total:0, ok:0, partial:0, inop:0, pct:100 };
  for(const cat of project.categories){
    const s=state[cat.id]; if(!s) continue;
    if(cat.type==="single"){
      total++;
      const st=s.status??(s.ok===false?"inop":"ok");
      if(st==="ok") okCount++; else if(st==="partial"){okCount+=0.5;partial++;} else inop++;
    } else if(cat.type==="items"){
      const arr=Array.isArray(s)?s:[];
      total+=arr.length;
      arr.forEach(v=>{
        const st=v?.status??(v?.ok===false?"inop":"ok");
        if(st==="ok") okCount++; else if(st==="partial"){okCount+=0.5;partial++;} else inop++;
      });
    } else if(cat.type==="count"){
      const t=s.total??cat.total??0; total+=t;
      const inopN=Array.isArray(s.inoperative)?s.inoperative.length:0; okCount+=t-inopN; inop+=inopN;
    }
  }
  return { total, ok:Math.round(okCount), partial, inop, pct:calcPct(Math.round(okCount),total) };
}

function analyzeRecurrence(project, history) {
  const recurrence = {};
  history.forEach(r => {
    for(const cat of project.categories){
      const s=r.state[cat.id]; if(!s) continue;
      if(cat.type==="single"){
        const st=s.status??(s.ok===false?"inop":"ok");
        if(st!=="ok"){ const key=`${cat.id}_0`; recurrence[key]=(recurrence[key]||0)+1; }
      } else if(cat.type==="items"){
        s.forEach((v,i)=>{
          const st=v.status??(v.ok===false?"inop":"ok");
          if(st!=="ok"){ const key=`${cat.id}_${i}`; recurrence[key]=(recurrence[key]||0)+1; }
        });
      } else if(cat.type==="count"){
        const inopArr=s.inoperative??[];
        if(inopArr.length>0){ const aggKey=`${cat.id}_count`; recurrence[aggKey]=(recurrence[aggKey]||0)+1; }
        inopArr.forEach(it=>{
          const itemId=(it.id||"").trim();
          if(itemId){ const key=`${cat.id}_id_${itemId}`; recurrence[key]=(recurrence[key]||0)+1; }
        });
      }
    }
  });
  return recurrence;
}

function getRecurrenceBadge(count) {
  if(count>=RECURRENCE_CRIT) return {label:"CR\u00cdTICO",color:"#dc2626",bg:"#fee2e2"};
  if(count>=RECURRENCE_WARN) return {label:"REINCIDENTE",color:"#d97706",bg:"#fef3c7"};
  return null;
}

// Mescla histórico local com o do servidor, em vez de substituir.
// Para cada DATA, prioriza a versão do servidor (já sincronizada); mas mantém
// qualquer relatório que exista SÓ localmente (ainda não enviado) — nunca o descarta.
function mergeHistory(local, server) {
  const byDate = new Map();
  (server||[]).forEach(r => { if(r?.meta?.date) byDate.set(r.meta.date, r); });
  (local||[]).forEach(r => {
    const d = r?.meta?.date;
    if(d && !byDate.has(d)) byDate.set(d, r); // relatório local ainda não sincronizado: preserva
  });
  return Array.from(byDate.values()).sort((a,b)=> (a.meta?.date||"").localeCompare(b.meta?.date||""));
}

function getConsecutiveInopWeeks(project, history, catId, itemIdx) {
  let count = 0;
  const reversed = [...history].reverse();
  for(const r of reversed){
    const s=r.state[catId]; if(!s) break;
    let isInop = false;
    if(typeof itemIdx === "number" && Array.isArray(s)){
      const v=s[itemIdx]; if(!v) break;
      const st=v.status??(v.ok===false?"inop":"ok");
      isInop = st!=="ok";
    } else if(catId && !Array.isArray(s)){
      const st=s.status??(s.ok===false?"inop":"ok");
      isInop = st!=="ok";
    }
    if(isInop) count++; else break;
  }
  return count;
}

function generateReportText(project, state, meta, photos) {
  const L=[];
  L.push("="+"=".repeat(49));
  L.push("  MOKLOG CHECKTEST - RELATORIO DE TESTE SEMANAL");
  L.push("="+"=".repeat(49));
  L.push(`Projeto : ${project.id} - ${project.name}`);
  L.push(`Data    : ${fmtDate(meta.date)}`);
  L.push(`Inicio  : ${meta.start||"--"}  |  Termino: ${meta.end||"--"}`);
  L.push(`Lider   : ${meta.leader||"--"}`);
  L.push(`CCO     : ${meta.cco||"--"}`);
  L.push(`Moked 24h: ${meta.moked||"--"}  |  Contato: ${meta.mokedContact?"Realizado":"Nao realizado"}  ${meta.mokedTime?`as ${meta.mokedTime}`:""}`);
  if(meta.signature) L.push(`Assinatura: ${meta.signature}`);
  L.push("-".repeat(50));
  for(const cat of project.categories){
    const s=state[cat.id]; if(!s) continue;
    if(cat.type==="maintenance"){
      const visits=s.visits??[];
      L.push(`\n${cat.label}`);
      if(!visits.length) L.push("  Sem visitas registradas na semana.");
      visits.forEach((v,i)=>L.push(`  Visita ${i+1}: ${fmtDate(v.date)} | ${v.empresa||"--"} | Tec: ${v.tec1||"--"} | ${v.servico||"--"}`));
      continue;
    }
    if(cat.type==="notes"){
      const items=s.items??[];
      L.push(`\n${cat.label}`);
      if(!items.length) L.push("  Sem pendencias.");
      items.forEach(it=>L.push(`  > ${it.label}${it.since?` (desde ${fmtDate(it.since)})`:""} ${it.note?`- ${it.note}`:""}`));
      continue;
    }
    L.push(`\n${cat.label}`);
    const stLabel=(st,ok)=>{const s2=st??(ok===false?"inop":"ok");return s2==="ok"?"OK":s2==="partial"?"PARCIAL":"INOPERANTE";};
    if(cat.type==="single") L.push(`  ${stLabel(s.status,s.ok)}${s.status!=="ok"&&s.since?` desde ${fmtDate(s.since)}`:""} ${s.note?`- ${s.note}`:""}`);
    else if(cat.type==="items") s.forEach((v,i)=>L.push(`  ${cat.itemLabels[i]}: ${stLabel(v.status,v.ok)}${v.status!=="ok"&&v.since?` desde ${fmtDate(v.since)}`:""} ${v.note?`- ${v.note}`:""}`));
    else if(cat.type==="count"){
      const t=s.total??cat.total; const inop=s.inoperative??[];
      L.push(`  Total: ${t} | OK: ${t-inop.length} | Inoperantes: ${inop.length}`);
      inop.forEach(it=>L.push(`    > ${it.id||"?"}${it.since?` (desde ${fmtDate(it.since)})`:""} ${it.note?`- ${it.note}`:""}`));
    }
  }
  const h=computeHealth(project,state);
  L.push(`\n${"=".repeat(50)}`);
  L.push(`SAUDE GERAL: ${h.pct}%  (${h.ok}/${h.total} unidades OK)`);
  if(meta.obs) L.push(`Observacoes gerais: ${meta.obs}`);
  if(photos?.length) L.push(`Fotos: ${photos.length} foto(s) registrada(s)`);
  L.push("=".repeat(50));
  return L.join("\n");
}

// ── StatusRing: anel de progresso com gradiente, trilho e brilho
function StatusRing({ pct=0, size=64, color="#22c55e", empty=false }) {
  const sw = 6;
  const r = (size - sw*2)/2, C = 2*Math.PI*r;
  const val = Math.max(0, Math.min(100, pct));
  const off = C*(1 - (empty?0:val)/100);
  const gid = "mkring-"+color.replace("#","")+"-"+(empty?"e":val);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{filter:`drop-shadow(0 0 8px ${color}44)`,flexShrink:0}} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color}/>
          <stop offset="100%" stopColor={color+"77"}/>
        </linearGradient>
      </defs>
      {/* Trilho escuro (sempre visível) */}
      <circle cx={size/2} cy={size/2} r={r} stroke="#1a2236" strokeWidth={sw} fill="none"/>
      {/* Arco de progresso com gradiente */}
      {!empty&&<circle cx={size/2} cy={size/2} r={r} stroke={`url(#${gid})`} strokeWidth={sw} fill="none"
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off}
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{filter:`drop-shadow(0 0 4px ${color}88)`}}/>}
      <text x="50%" y="52%" dominantBaseline="central" textAnchor="middle" fill={empty?"#7c3aed":color}
        fontSize={empty?size*0.28:size*0.28} fontWeight="900" fontFamily="inherit">{empty?"—":val+"%"}</text>
    </svg>
  );
}

function MoklogLogo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2a2a2a"/><stop offset="100%" stopColor="#111"/>
        </radialGradient>
        <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d0d0d0"/><stop offset="40%" stopColor="#888"/>
          <stop offset="60%" stopColor="#aaa"/><stop offset="100%" stopColor="#555"/>
        </linearGradient>
        <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#cc2222"/><stop offset="50%" stopColor="#991111"/>
          <stop offset="100%" stopColor="#7a0e0e"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="14" fill="url(#bgGrad)"/>
      <circle cx="50" cy="50" r="38" fill="none" stroke="url(#metalGrad)" strokeWidth="7"/>
      <circle cx="50" cy="50" r="26" fill="none" stroke="url(#redGrad)" strokeWidth="8"/>
      <circle cx="50" cy="50" r="7" fill="#111"/><circle cx="50" cy="50" r="5" fill="#222"/>
      <rect x="47.5" y="8" width="5" height="18" rx="2" fill="url(#redGrad)"/>
      <rect x="47.5" y="74" width="5" height="18" rx="2" fill="url(#redGrad)"/>
      <rect x="8" y="47.5" width="18" height="5" rx="2" fill="url(#metalGrad)"/>
      <rect x="74" y="47.5" width="18" height="5" rx="2" fill="url(#metalGrad)"/>
      <path d="M14 30 L8 30 L8 70 L14 70" fill="none" stroke="url(#metalGrad)" strokeWidth="4" strokeLinecap="round"/>
      <path d="M86 30 L92 30 L92 70 L86 70" fill="none" stroke="url(#metalGrad)" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="35" cy="32" r="3" fill="white" opacity="0.25"/>
    </svg>
  );
}

function HealthRing({ pct, size=56 }) {
  const r=22, circ=2*Math.PI*r, dash=circ*(pct/100);
  const color=pct>=90?"#22c55e":pct>=70?"#f59e0b":"#ef4444";
  return(
    <svg width={size} height={size} viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#1e293b" strokeWidth="5"/>
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 28 28)" style={{transition:"stroke-dasharray .5s ease"}}/>
      <text x="28" y="33" textAnchor="middle" fontSize="11" fontWeight="800" fill={color}>{pct}%</text>
    </svg>
  );
}

function CtmkBadge({ info, onToggle, size="normal" }) {
  const status = info?.status || "online";
  const isOff = status === "offline";
  const days = isOff && info?.offlineSince ? Math.floor((Date.now()-new Date(info.offlineSince).getTime())/86400000) : null;
  const small = size==="small";
  return (
    <div onClick={(e)=>{ e.stopPropagation(); onToggle(); }}
      style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,cursor:"pointer",userSelect:"none"}}
      title="Tocar para alternar status CTMK">
      <div style={{display:"flex",alignItems:"center",gap:5}}>
        <span style={{fontSize:small?9:10,fontWeight:800,color:isOff?"#ef4444":"#22c55e",letterSpacing:.3,
          textShadow:isOff?"0 0 6px #ef444488":"0 0 6px #22c55e66"}}>
          CTMK {isOff?"Off-line":"Online"}
        </span>
        <span style={{fontSize:small?14:16,filter:isOff?"drop-shadow(0 0 4px #ef4444aa)":"drop-shadow(0 0 4px #22c55e88)"}}>
          {isOff?"📵":"📷"}
        </span>
      </div>
      {isOff && days!==null && (
        <span style={{fontSize:small?9:10,fontWeight:700,color:"#ef4444"}}>{days} {days===1?"dia":"dias"} off-line</span>
      )}
    </div>
  );
}

function CtmkConfirmModal({ confirm, project, onCancel, onConfirm }) {
  const [customDate, setCustomDate] = useState(()=>new Date().toLocaleDateString("sv-SE"));
  const [countdown, setCountdown] = useState(10);
  const [palavra, setPalavra] = useState("");
  useEffect(()=>{
    setPalavra("");
  },[confirm]);
  useEffect(()=>{
    if(!confirm) return;
    setCountdown(10);
    const t = setInterval(()=>setCountdown(c=>c>0?c-1:0), 1000);
    return ()=>clearInterval(t);
  },[confirm]);
  if(!confirm) return null;
  const goingOffline = confirm.status!=="offline"; // status atual antes do toque
  const label = project?.id || confirm.pid;
  const diasOff = confirm.status==="offline"&&confirm.offlineSince ? Math.max(0,Math.floor((Date.now()-new Date(confirm.offlineSince).getTime())/86400000)) : 0;
  return (
    <div onClick={onCancel} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#060c18",border:`1px solid ${goingOffline?"#ef444444":"#22c55e44"}`,borderRadius:14,padding:"20px 18px",maxWidth:360,width:"100%"}}>
        <div style={{fontSize:28,textAlign:"center",marginBottom:10}}>{goingOffline?"📵":"📷"}</div>
        <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9",textAlign:"center",marginBottom:6}}>
          {goingOffline ? `Confirmar CTMK Off-line — ${label}?` : `Confirmar volta do CTMK — ${label}?`}
        </div>
        <div style={{fontSize:12,color:"#94a3b8",textAlign:"center",lineHeight:1.5,marginBottom:8}}>
          {goingOffline
            ? "Isso vai marcar a central de monitoramento remoto como sem imagem e começar a contar os dias offline."
            : `Isso vai zerar o contador de dias offline${diasOff>0?` (${diasOff} dias)`:""} e guardar o período anterior no histórico.`}
        </div>

        <div style={{background:goingOffline?"#1a020233":"#021a0d33",border:`1px solid ${goingOffline?"#ef444433":"#22c55e33"}`,borderRadius:8,padding:"10px 12px",marginBottom:14,textAlign:"center"}}>
          <div style={{fontSize:13,fontWeight:800,color:goingOffline?"#ef4444":"#22c55e",marginBottom:4}}>
            {goingOffline ? "⚠ Você certificou que a central está sem imagem?" : "⚠ Você certificou que a central voltou a operar?"}
          </div>
          <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.4}}>
            {goingOffline
              ? "Confirme apenas se realmente verificou que as imagens estão indisponíveis na central de monitoramento."
              : `Confirme apenas se realmente verificou que as imagens estão funcionando normalmente.${diasOff>0?` O registro de ${diasOff} dia(s) offline será arquivado.`:""}`}
          </div>
        </div>

        {goingOffline && confirm.allowDateEdit && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>Desde quando está off-line?</div>
            <input type="date" value={customDate} max={new Date().toLocaleDateString("sv-SE")}
              onChange={e=>setCustomDate(e.target.value)}
              style={{width:"100%",background:"#020510",border:"1px solid #1e293b",borderRadius:8,color:"#f1f5f9",padding:"10px 12px",fontSize:14,boxSizing:"border-box"}}/>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Deixe como hoje se a queda acabou de acontecer. Mude a data se já está sem imagem há mais tempo.</div>
          </div>
        )}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>
            Digite <span style={{color:goingOffline?"#ef4444":"#22c55e"}}>CONFIRMAR</span> para prosseguir
          </div>
          <input value={palavra} onChange={e=>setPalavra(e.target.value)} placeholder="CONFIRMAR" autoCapitalize="characters"
            style={{width:"100%",background:"#020510",border:"1px solid #1e293b",borderRadius:8,color:"#f1f5f9",padding:"10px 12px",fontSize:14,fontWeight:700,letterSpacing:1,textAlign:"center",boxSizing:"border-box"}}/>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onCancel} style={{flex:1,background:"#0f172a",border:"1px solid #1e293b",color:"#94a3b8",borderRadius:8,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Cancelar</button>
          <button onClick={()=>{ if(countdown>0||palavra.trim().toUpperCase()!=="CONFIRMAR") return; onConfirm(goingOffline&&confirm.allowDateEdit?customDate:undefined); }}
            disabled={countdown>0||palavra.trim().toUpperCase()!=="CONFIRMAR"}
            style={{flex:1,background:(countdown>0||palavra.trim().toUpperCase()!=="CONFIRMAR")?"#1e293b":(goingOffline?"linear-gradient(135deg,#dc2626,#991b1b)":"linear-gradient(135deg,#16a34a,#15803d)"),border:"none",color:(countdown>0||palavra.trim().toUpperCase()!=="CONFIRMAR")?"#475569":"#fff",borderRadius:8,padding:"11px",fontSize:13,fontWeight:700,cursor:(countdown>0||palavra.trim().toUpperCase()!=="CONFIRMAR")?"not-allowed":"pointer",opacity:(countdown>0||palavra.trim().toUpperCase()!=="CONFIRMAR")?.6:1}}>
            {countdown>0 ? `Aguarde ${countdown}s...` : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SmartPhotoUpload({catId, catLabel, itemLabel, photos, setPhotos}) {
  const key = itemLabel ? `${catId}_${itemLabel}` : catId;
  const existing = photos.filter(p=>p.photoKey===key);
  const handlePhoto = (e) => {
    try {
      const file = e.target.files?.[0]; if(!file) return;
      if(file.size > 10 * 1024 * 1024) { alert("Foto muito grande. Use uma imagem menor que 10MB."); return; }
      const r = new FileReader();
      r.onerror = () => {
        console.error("Error reading file");
        alert("N\u00e3o foi poss\u00edvel ler a foto. Tente novamente.");
      };
      r.onload = ev => {
        try {
          const img = new Image();
          img.onload = () => {
            try {
              const MAX = 300;
              let w = img.width, h = img.height;
              if(w > h && w > MAX) { h = Math.round(h*MAX/w); w = MAX; }
              else if(h >= w && h > MAX) { w = Math.round(w*MAX/h); h = MAX; }
              const canvas = document.createElement("canvas");
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext("2d");
              if(!ctx) throw new Error("Canvas context unavailable");
              ctx.drawImage(img, 0, 0, w, h);
              let compressed = canvas.toDataURL("image/jpeg", 0.6);
              if(compressed.length > 100*1024) {
                canvas.width = Math.min(w, 200);
                canvas.height = Math.min(h, 200);
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                compressed = canvas.toDataURL("image/jpeg", 0.45);
              }
              if(compressed.length > 150*1024) {
                alert("Foto muito pesada mesmo ap\u00f3s compress\u00e3o. Relat\u00f3rio ser\u00e1 salvo sem ela.");
                return;
              }
              const filtered = photos.filter(p=>p.photoKey!==key);
              setPhotos([...filtered, {photoKey:key, catId, catLabel, itemLabel, name:file.name, url:compressed}]);
            } catch(compressErr) {
              console.error("Compression error:", compressErr);
              alert("Erro ao processar foto. Relat\u00f3rio ser\u00e1 salvo sem ela.");
            }
          };
          img.onerror = () => {
            alert("N\u00e3o foi poss\u00edvel carregar a foto. Relat\u00f3rio ser\u00e1 salvo sem ela.");
          };
          img.src = ev.target.result;
        } catch(err) {
          console.error("Photo save error:", err);
          alert("Erro inesperado na foto. Prosseguindo sem ela.");
        }
      };
      r.readAsDataURL(file);
    } catch(err) { console.error("Photo handle error:", err); }
  };
  const removePhoto = () => setPhotos(photos.filter(p=>p.photoKey!==key));
  if(existing.length>0) return (
    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6,padding:"6px 8px",background:"#020510",borderRadius:6,border:"1px solid #0f172a"}}>
      <img src={existing[0].url} alt="" style={{width:52,height:40,objectFit:"cover",borderRadius:4,border:"1px solid #1e293b"}}/>
      <div style={{flex:1,fontSize:11,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{itemLabel||catLabel}</div>
      <button onClick={removePhoto} style={{...S.iconBtn,color:"#ef4444",flexShrink:0}} aria-label="Remover">✕</button>
    </div>
  );
  return (
    <label style={{display:"flex",alignItems:"center",gap:6,marginTop:6,cursor:"pointer",color:"#94a3b8",fontSize:11,padding:"4px 0"}}>
      <span style={{fontSize:14}}>📷</span>
      <span>Foto: {itemLabel||catLabel} (câmera ou galeria)</span>
      <input type="file" accept="image/*" style={{position:"absolute",opacity:0,width:0,height:0}} onChange={handlePhoto}/>
    </label>
  );
}

function SingleCat({cat, value, onChange, photos, setPhotos, recurrence}){
  const st = value?.status??(value?.ok===false?"inop":"ok");
  const recKey = `${cat.id}_0`;
  const badge = recurrence ? getRecurrenceBadge(recurrence[recKey]||0) : null;
  return(
    <div style={S.catCard}>
      <div style={S.catHeader}>
        <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
          <span style={S.catLabel}>{cat.label}</span>
          {badge&&<span style={{fontSize:11,fontWeight:700,color:badge.color,background:badge.bg,padding:"1px 5px",borderRadius:8}}>{badge.label}</span>}
        </div>
        <div style={{display:"flex",gap:4,flexShrink:0}}>
          <button onClick={()=>onChange({...value,status:"ok",note:"",since:""})} style={{...S.sm,...(st==="ok"?S.smOk:{})}}>OK</button>
          <button onClick={()=>onChange({...value,status:"partial"})} style={{...S.sm,...(st==="partial"?S.smPartial:{})}}>Parc.</button>
          <button onClick={()=>onChange({...value,status:"inop"})} style={{...S.sm,...(st==="inop"?S.smBad:{})}}>Inop.</button>
        </div>
      </div>
      {st!=="ok"&&<div style={S.subRow}>
        <input placeholder="Descricao do problema..." value={value.note||""} onChange={e=>onChange({...value,note:e.target.value})} style={{...S.inp,fontSize:12}}/>
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
          <span style={S.lbl}>Desde:</span>
          <input type="date" value={value.since||""} onChange={e=>onChange({...value,since:e.target.value})} style={{...S.inp,maxWidth:160,fontSize:12}}/>
        </div>
        {setPhotos&&<SmartPhotoUpload catId={cat.id} catLabel={cat.label} photos={photos} setPhotos={setPhotos}/>}
      </div>}
    </div>
  );
}

function ItemsCat({cat, values, onChange, photos, setPhotos, recurrence}){
  const upd=(i,patch)=>{const n=[...values];n[i]={...n[i],...patch};onChange(n);};
  const okN=values.filter(v=>(v.status??"ok")==="ok").length;
  const partN=values.filter(v=>v.status==="partial").length;
  const p=calcPct(okN+(partN*0.5|0),values.length);
  const dotColor=p===100?"#22c55e":p>=50?"#f59e0b":"#ef4444";
  return(
    <div style={S.catCard}>
      <div style={S.catHeader}>
        <span style={S.catLabel}>{cat.label}</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:800,color:dotColor}}>{p}%</span>
          <span style={{fontSize:11,color:"#64748b"}}>{okN}/{values.length}</span>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10}}>
        {values.map((v,i)=>{
          const st=v.status??"ok";
          const recKey=`${cat.id}_${i}`;
          const badge=recurrence?getRecurrenceBadge(recurrence[recKey]||0):null;
          return(
            <div key={i}>
              <div style={{...S.itemRow,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:4,minWidth:80,flexShrink:0}}>
                  <span style={{...S.iLabel,fontSize:12}}>{cat.itemLabels[i]}</span>
                  {badge&&<span style={{fontSize:8,fontWeight:700,color:badge.color,background:badge.bg,padding:"1px 4px",borderRadius:6,whiteSpace:"nowrap"}}>{badge.label}</span>}
                </div>
                <div style={{display:"flex",gap:4,flexShrink:0}}>
                  <button onClick={()=>upd(i,{status:"ok",note:"",since:""})} style={{...S.sm,...(st==="ok"?S.smOk:{})}}>OK</button>
                  <button onClick={()=>upd(i,{status:"partial"})} style={{...S.sm,...(st==="partial"?S.smPartial:{})}}>Parc.</button>
                  <button onClick={()=>upd(i,{status:"inop"})} style={{...S.sm,...(st==="inop"?S.smBad:{})}}>Inop.</button>
                </div>
                {st!=="ok"&&<>
                  <input placeholder="Problema..." value={v.note||""} onChange={e=>upd(i,{note:e.target.value})} style={{...S.inp,flex:1,minWidth:100,fontSize:12}}/>
                  <input type="date" value={v.since||""} onChange={e=>upd(i,{since:e.target.value})} style={{...S.inp,maxWidth:145,fontSize:12}}/>
                </>}
              </div>
              {st!=="ok"&&setPhotos&&<SmartPhotoUpload catId={cat.id} catLabel={cat.label} itemLabel={cat.itemLabels[i]} photos={photos} setPhotos={setPhotos}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CountCat({cat, value, onChange, photos, setPhotos, recurrence}){
  const total=value.total??cat.total;
  const inop=value.inoperative??[];
  const p=calcPct(total-inop.length,total);
  const add=()=>onChange({...value,inoperative:[...inop,{id:"",note:"",since:todayStr()}]});
  const rem=(i)=>onChange({...value,inoperative:inop.filter((_,idx)=>idx!==i)});
  const upd=(i,patch)=>onChange({...value,inoperative:inop.map((it,idx)=>idx===i?{...it,...patch}:it)});
  const recKey=`${cat.id}_count`;
  const badge=recurrence?getRecurrenceBadge(recurrence[recKey]||0):null;
  return(
    <div style={S.catCard}>
      <div style={S.catHeader}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={S.catLabel}>{cat.label}</span>
          {badge&&<span style={{fontSize:11,fontWeight:700,color:badge.color,background:badge.bg,padding:"1px 5px",borderRadius:8}}>{badge.label}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:800,color:p===100?"#22c55e":"#ef4444"}}>{p}%</span>
          <span style={{fontSize:11,color:"#64748b"}}>{total-inop.length}/{total} OK</span>
          <button onClick={()=>onChange({...value,total:total+1})} style={S.iconBtn}>+</button>
          {total>1&&<button onClick={()=>onChange({...value,total:total-1})} style={S.iconBtn}>-</button>}
        </div>
      </div>
      <div style={{marginTop:8}}>
        {inop.map((it,i)=>{
          const itemId=(it.id||"").trim();
          const itemBadge=recurrence&&itemId?getRecurrenceBadge(recurrence[`${cat.id}_id_${itemId}`]||0):null;
          return(
          <div key={i}>
            <div style={{...S.itemRow,flexWrap:"wrap",gap:6,marginBottom:5}}>
              <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                <input placeholder="ID (ex: CF-32)" value={it.id} onChange={e=>upd(i,{id:e.target.value})} style={{...S.inp,width:105,fontSize:12}}/>
                {itemBadge&&<span style={{fontSize:8,fontWeight:700,color:itemBadge.color,background:itemBadge.bg,padding:"1px 4px",borderRadius:6,whiteSpace:"nowrap"}}>{itemBadge.label}</span>}
              </div>
              <input placeholder="Problema..." value={it.note} onChange={e=>upd(i,{note:e.target.value})} style={{...S.inp,flex:1,minWidth:100,fontSize:12}}/>
              <input type="date" value={it.since} onChange={e=>upd(i,{since:e.target.value})} style={{...S.inp,maxWidth:145,fontSize:12}}/>
              <button onClick={()=>rem(i)} style={{...S.iconBtn,color:"#ef4444"}} aria-label="Remover">✕</button>
            </div>
            {setPhotos&&<SmartPhotoUpload catId={cat.id} catLabel={cat.label} itemLabel={it.id||`Item ${i+1}`} photos={photos} setPhotos={setPhotos}/>}
          </div>
          );
        })}
        <button onClick={add} style={S.addBtn}>+ Registrar inoperante</button>
      </div>
    </div>
  );
}

function NotesCat({cat,value,onChange}){
  const items=value.items??[];
  const add=()=>onChange({items:[...items,{label:"",note:"",since:todayStr()}]});
  const rem=(i)=>onChange({items:items.filter((_,idx)=>idx!==i)});
  const upd=(i,p)=>onChange({items:items.map((it,idx)=>idx===i?{...it,...p}:it)});
  return(
    <div style={S.catCard}>
      <div style={S.catHeader}>
        <span style={S.catLabel}>{cat.label}</span>
        <span style={{fontSize:11,color:items.length?"#ef4444":"#22c55e",fontWeight:700}}>{items.length?`${items.length} pendencia(s)`:"Sem pendencias"}</span>
      </div>
      <div style={{marginTop:8}}>
        {items.map((it,i)=>(
          <div key={i} style={{...S.itemRow,flexWrap:"wrap",gap:6,marginBottom:5}}>
            <input placeholder="Item..." value={it.label} onChange={e=>upd(i,{label:e.target.value})} style={{...S.inp,width:140,fontSize:12}}/>
            <input placeholder="Observacao..." value={it.note} onChange={e=>upd(i,{note:e.target.value})} style={{...S.inp,flex:1,minWidth:100,fontSize:12}}/>
            <input type="date" value={it.since} onChange={e=>upd(i,{since:e.target.value})} style={{...S.inp,maxWidth:145,fontSize:12}}/>
            <button onClick={()=>rem(i)} style={{...S.iconBtn,color:"#ef4444"}} aria-label="Remover">✕</button>
          </div>
        ))}
        <button onClick={add} style={S.addBtn}>+ Adicionar item</button>
      </div>
    </div>
  );
}

function MaintenanceCat({cat,value,onChange}){
  const visits=value.visits??[];
  const add=()=>onChange({visits:[...visits,{date:todayStr(),empresa:"",tec1:"",tec2:"",servico:"",obs:""}]});
  const rem=(i)=>onChange({visits:visits.filter((_,idx)=>idx!==i)});
  const upd=(i,p)=>onChange({visits:visits.map((v,idx)=>idx===i?{...v,...p}:v)});
  return(
    <div style={S.catCard}>
      <div style={S.catHeader}>
        <span style={S.catLabel}>{cat.label}</span>
        <span style={{fontSize:11,color:visits.length?"#f59e0b":"#64748b",fontWeight:700}}>{visits.length?`${visits.length} visita(s)`:"Nenhuma visita"}</span>
      </div>
      <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:12}}>
        {visits.map((v,i)=>(
          <div key={i} style={{background:"#020510",borderRadius:8,padding:"10px 12px",border:"1px solid #1e293b"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Visita {i+1}</span>
              <button onClick={()=>rem(i)} style={{...S.iconBtn,color:"#ef4444"}} aria-label="Remover">✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:7}}>
              <div><label style={S.lbl}>Data</label><input type="date" value={v.date} onChange={e=>upd(i,{date:e.target.value})} style={S.inp}/></div>
              <div><label style={S.lbl}>Empresa</label><input placeholder="Empresa..." value={v.empresa} onChange={e=>upd(i,{empresa:e.target.value})} style={S.inp}/></div>
              <div><label style={S.lbl}>Tecnico 01</label><input placeholder="Nome..." value={v.tec1} onChange={e=>upd(i,{tec1:e.target.value})} style={S.inp}/></div>
              <div><label style={S.lbl}>Tecnico 02</label><input placeholder="Opcional" value={v.tec2} onChange={e=>upd(i,{tec2:e.target.value})} style={S.inp}/></div>
            </div>
            <div style={{marginTop:7}}><label style={S.lbl}>Servico Realizado</label><input placeholder="Descreva..." value={v.servico} onChange={e=>upd(i,{servico:e.target.value})} style={S.inp}/></div>
          </div>
        ))}
        <button onClick={add} style={{...S.addBtn,borderStyle:"solid",borderColor:"#f59e0b",color:"#f59e0b"}}>+ Registrar Visita de Manutencao</button>
      </div>
    </div>
  );
}

function ProjectPinGate({project, onSuccess, onBack}) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const correct = PROJECT_PINS[project.id];
  // PIN do projeto entra como líder; PIN master (gerencial) entra como admin em qualquer projeto
  const try_ = () => { const lv = checkPin(pin, { projectPin: correct, projectId: project?.id }); if(lv) onSuccess(lv==="lider"?"lider":lv==="demo"?"demo":"admin"); else setErr(true); };
  return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#060c18",border:"1px solid #1e293b",borderRadius:16,padding:"32px 28px",maxWidth:340,width:"100%",textAlign:"center",margin:16}}>
        <MoklogLogo size={48}/>
        <div style={{fontSize:17,fontWeight:800,color:"#f1f5f9",marginTop:10,marginBottom:2}}>MokLog <span style={{color:"#cc2222"}}>CheckTest</span></div>
        <div style={{fontSize:13,color:"#94a3b8",marginBottom:4}}>{project.id} - {project.name}</div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>Insira o PIN do projeto</div>
        <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pin}
          onChange={e=>{setPin(e.target.value);setErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter") try_();}}
          style={{...S.inp,textAlign:"center",fontSize:22,letterSpacing:10,marginBottom:10}}/>
        {err&&<div role="alert" style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
        <button onClick={try_} style={{...S.primaryBtn,width:"100%",marginBottom:10,fontSize:14}}>Entrar</button>
        <button onClick={onBack} style={{...S.secBtn,width:"100%",fontSize:14}} aria-label="Voltar">← Voltar</button>
      </div>
    </div>
  );
}

function MiniChart({data, width=200, height=60}) {
  if(!data || data.length < 2) return null;
  const min = Math.min(...data) - 5;
  const max = Math.max(...data) + 5;
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length-1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  const last = data[data.length-1];
  const color = last >= 90 ? "#22c55e" : last >= 70 ? "#f59e0b" : "#ef4444";
  return(
    <svg width={width} height={height} style={{overflow:"visible"}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((v,i)=>{
        const x=(i/(data.length-1))*width;
        const y=height-((v-min)/range)*height;
        return <circle key={i} cx={x} cy={y} r="3" fill={color}/>;
      })}
    </svg>
  );
}

// ── VISÃO 360 — score composto de saúde operacional por planta, cruzando todos os módulos.
// Pesos transparentes e calibráveis:
const SCORE360_CFG = {
  ctmkPorDia: 2,   ctmkMax: 20,      // CTMK offline: -2/dia, teto -20
  keyAccess: 5,    keyAccessMax: 15, // falha de acesso aberta: -5 cada, teto -15
  bolsaoCritico: 3, bolsaoMax: 12,   // placa crítica no bolsão: -3 cada, teto -12
  perimetralZona: 2, perimetralMax: 10, // zona não-OK no último teste: -2 cada, teto -10
  rondaBaixa: 10, rondaMedia: 5,     // ronda VSPP do último dia <60%: -10; 60–89%: -5
};

function computeScore360(base, ex) {
  const c = SCORE360_CFG;
  const pen = [];
  if(ex.ctmkDias>0) pen.push({label:`CTMK ${ex.ctmkDias}d off-line`, val:Math.min(c.ctmkMax, ex.ctmkDias*c.ctmkPorDia)});
  if(ex.keyAbertas>0) pen.push({label:`${ex.keyAbertas} falha(s) KeyAccess aberta(s)`, val:Math.min(c.keyAccessMax, ex.keyAbertas*c.keyAccess)});
  if(ex.bolsaoCriticos>0) pen.push({label:`${ex.bolsaoCriticos} placa(s) crítica(s) no bolsão`, val:Math.min(c.bolsaoMax, ex.bolsaoCriticos*c.bolsaoCritico)});
  if(ex.perimetralZonasRuins>0) pen.push({label:`${ex.perimetralZonasRuins} zona(s) perimetral(is) com problema`, val:Math.min(c.perimetralMax, ex.perimetralZonasRuins*c.perimetralZona)});
  if(ex.rondaPct!==null && ex.rondaPct!==undefined && ex.rondaPct<90) pen.push({label:`Ronda VSPP ${ex.rondaPct}% no último dia`, val:ex.rondaPct<60?c.rondaBaixa:c.rondaMedia});
  const totalPen = pen.reduce((a,p)=>a+p.val,0);
  return { score: Math.max(0, Math.round(base - totalPen)), base: Math.round(base), penalidades: pen };
}

function gerarPDFVisao360(rows, mediaGeral, grupoLabel) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const hora = new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  const tituloGrupo = grupoLabel ? `Grupo ${grupoLabel}` : "Consolidado Interno Moked";
  const medal = (i)=> i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}º`;
  const scoreColor = (s)=> s>=90?"#15803d":s>=75?"#d97706":"#dc2626";
  const rowsHtml = rows.map((r,i)=>`
    <tr style="${r.score<75?'background:#fff8f8':''}">
      <td style="text-align:center;font-weight:800">${medal(i)}</td>
      <td style="font-weight:800">${r.id}<div style="font-weight:400;font-size:10px;color:#64748b">${r.name}</div></td>
      <td style="text-align:center"><span style="font-size:18px;font-weight:900;color:${scoreColor(r.score)}">${r.score}</span><span style="font-size:10px;color:#94a3b8">/100</span></td>
      <td style="text-align:center;color:#64748b">${r.base}%</td>
      <td style="text-align:center">${r.ilumDeficientes>0?`<span style="color:#dc2626;font-weight:800">💡 ${r.ilumDeficientes}</span>`:(r.ilumTotal>0?'<span style="color:#15803d;font-weight:700">✓ 0</span>':'<span style="color:#cbd5e1">—</span>')}</td>
      <td style="text-align:center">${r.energiaAberta?'<span style="color:#dc2626;font-weight:900">⚡ EM ABERTO</span>':(r.energiaQuedas7d>0?`<span style="color:#d97706;font-weight:800">⚡ ${r.energiaQuedas7d} (7d)</span>`:'<span style="color:#15803d;font-weight:700">✓ 0</span>')}</td>
      <td style="font-size:10px;color:#64748b">${r.penalidades.length? r.penalidades.map(p=>`<div>−${p.val} · ${p.label}</div>`).join("") : '<span style="color:#15803d;font-weight:700">✓ Sem penalidades</span>'}</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Visão 360 — ${hoje}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px;color:#1e293b;font-size:13px}
  .header{background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;padding:18px 22px;border-radius:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
  table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
  th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase}
  td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  .legend{font-size:10px;color:#94a3b8;margin-top:10px;line-height:1.6}
  .footer{text-align:center;margin-top:14px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
  @media print{body{padding:8px}@page{margin:10mm}.no-print{display:none}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style></head><body>
<div class="no-print" style="text-align:center;margin-bottom:14px">
  <button onclick="window.print()" style="background:#1e3a8a;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="header">
  <div>
    <p style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px">Moked Consulting Security</p>
    <h1 style="font-size:19px;font-weight:900;margin-bottom:3px">🎯 Visão 360 — ${tituloGrupo}</h1>
    <p style="font-size:12px;opacity:.85">Saúde operacional consolidada: checklist + CTMK + KeyAccess + Bolsão + Perimetral + Ronda VSPP</p>
  </div>
  <div style="text-align:right">
    <div style="font-size:30px;font-weight:900">${mediaGeral}<span style="font-size:13px;opacity:.7">/100</span></div>
    <div style="font-size:10px;opacity:.8">MÉDIA DO GRUPO · ${hoje} ${hora}</div>
  </div>
</div>
<table>
  <thead><tr><th style="width:44px;text-align:center">Pos.</th><th>Planta</th><th style="text-align:center;width:80px">Score 360</th><th style="text-align:center;width:70px">Checklist</th><th style="text-align:center;width:80px">💡 Iluminação</th><th style="text-align:center;width:90px">⚡ Energia</th><th>Penalidades aplicadas</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<div class="legend">
  <strong>Como o score é calculado:</strong> parte do % do último checklist semanal e desconta penalidades por pendências ativas nos demais módulos —
  CTMK off-line (−${SCORE360_CFG.ctmkPorDia}/dia, máx −${SCORE360_CFG.ctmkMax}) · falha KeyAccess aberta (−${SCORE360_CFG.keyAccess} cada, máx −${SCORE360_CFG.keyAccessMax}) ·
  placa crítica no bolsão (−${SCORE360_CFG.bolsaoCritico} cada, máx −${SCORE360_CFG.bolsaoMax}) · zona perimetral com problema (−${SCORE360_CFG.perimetralZona} cada, máx −${SCORE360_CFG.perimetralMax}) ·
  Ronda VSPP abaixo de 90% (−${SCORE360_CFG.rondaMedia}) ou de 60% (−${SCORE360_CFG.rondaBaixa}).
</div>
<div class="footer">
  <div>MokLog CheckTest © Moked Consulting Security · Visão 360 Executiva</div>
  <div style="margin-top:3px">José Fonseca · ${hoje} ${hora}</div>
</div>
</body></html>`;
  const blob=new Blob([html],{type:"text/html"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`visao360_${grupoLabel?grupoLabel.toLowerCase()+"_":""}${hoje.replace(/\//g,"-")}.html`;
  a.click(); URL.revokeObjectURL(url);
}

function Dashboard({stored, ctmkData={}, onToggleCtmk, onBack, onDeleteReport, onEditReport}) {
  const [ctmkConfirm, setCtmkConfirm] = useState(null);
  const [v360, setV360] = useState(null); // null | "loading" | {rows, media, erro}
  const [analiseRiscoPacote, setAnaliseRiscoPacote] = useState(null); // "golgi" | "mega" | "klog" | null
  const [v360Grupo, setV360Grupo] = useState("todos"); // todos | golgi | mega | klog — "todos" é uso interno Moked; PDF por cliente nunca mistura
  const V360_GRUPOS = { golgi:{label:"Golgi",ids:["P601","P602","P604","P605","P606","P607"]}, mega:{label:"Mega",ids:["P311A","P311B"]}, klog:{label:"Klog",ids:["P505"]} };
  const carregarVisao360 = async () => {
    setV360("loading");
    try {
      const ids = Object.keys(PROJECTS);
      // Busca em paralelo os módulos que não estão em memória (KeyAccess, Bolsão, Perimetral, Ronda VSPP)
      const [keySnaps, bolsaoSnaps, periSnaps, rondaSnap, ilumSnaps, energiaSnaps] = await Promise.all([
        Promise.all(ids.map(pid=>getDoc(doc(db,"keyaccess_falhas",pid)).catch(()=>null))),
        Promise.all(["P311A","P311B"].map(pid=>getDoc(doc(db,"bolsao",pid)).catch(()=>null))),
        Promise.all(ids.map(pid=>getDoc(doc(db,"perimetral",pid)).catch(()=>null))),
        getDoc(doc(db,"ronda_vspp","P601")).catch(()=>null),
        Promise.all(ids.map(pid=>getDoc(doc(db,"iluminacao",pid)).catch(()=>null))),
        Promise.all(ids.map(pid=>getDoc(doc(db,"energia_ocorrencias",pid)).catch(()=>null))),
      ]);
      const keyAbertasBy = {}; ids.forEach((pid,i)=>{ const regs=keySnaps[i]?.exists()?(keySnaps[i].data().registros||[]):[]; keyAbertasBy[pid]=regs.filter(r=>!r.horaFim).length; });
      const bolsaoBy = {}; ["P311A","P311B"].forEach((pid,i)=>{ const placas=bolsaoSnaps[i]?.exists()?(bolsaoSnaps[i].data().placas||{}):{}; bolsaoBy[pid]=Object.values(placas).filter(p=>p.status==="critico").length; });
      const periBy = {}; ids.forEach((pid,i)=>{ const testes=periSnaps[i]?.exists()?(periSnaps[i].data().testes||[]):[]; if(!testes.length){periBy[pid]=0;return;} const ult=[...testes].sort((a,b)=>(b.data||"").localeCompare(a.data||""))[0]; periBy[pid]=Object.values(ult.zonas||{}).filter(z=>(z?.status||"ok")!=="ok").length; });
      const ilumBy = {}; ids.forEach((pid,i)=>{
        const quads = ilumSnaps[i]?.exists()?(ilumSnaps[i].data().quadrantes||[]):[];
        const total = quads.reduce((a,q)=>a+(Number(q.total)||0),0);
        const def = quads.reduce((a,q)=>a+(Number(q.deficientes)||0),0);
        ilumBy[pid] = { total, def };
      });
      const energiaBy = {}; ids.forEach((pid,i)=>{
        const eventos = energiaSnaps[i]?.exists()?(energiaSnaps[i].data().eventos||[]):[];
        const corte = Date.now()-7*86400000;
        const doPeriodo = eventos.filter(e=>e.inicioQueda && new Date(e.inicioQueda).getTime()>=corte);
        const aberto = eventos.some(e=>!e.concluido);
        energiaBy[pid] = { quedas7d: doPeriodo.length, aberto };
      });
      let rondaPct = null;
      if(rondaSnap?.exists()){ const regs=(rondaSnap.data().registros||[]).slice().sort((a,b)=>(b.data||"").localeCompare(a.data||"")); const ult=regs[0]; if(ult){ const slots=ult.slots||[]; const f=slots.filter(h=>ult.marcacoes?.[h]?.status==="feito").length; rondaPct = slots.length?Math.round((f/slots.length)*100):null; } }
      const rows = ids.map(pid=>{
        const p=PROJECTS[pid];
        const hist=stored[pid]?.history??[];
        const last=hist[hist.length-1];
        const base = last ? computeHealth(p,last.state).pct : 0;
        const c = ctmkData[pid];
        const ctmkDias = c?.status==="offline"&&c.offlineSince ? Math.max(1,Math.floor((Date.now()-new Date(c.offlineSince).getTime())/86400000)) : 0;
        const r = computeScore360(base, {
          ctmkDias,
          keyAbertas: keyAbertasBy[pid]||0,
          bolsaoCriticos: bolsaoBy[pid]||0,
          perimetralZonasRuins: periBy[pid]||0,
          rondaPct: pid==="P601"?rondaPct:null,
        });
        return { id:pid, name:p.name, ...r, semChecklist: !last, ilumDeficientes: ilumBy[pid]?.def||0, ilumTotal: ilumBy[pid]?.total||0, energiaQuedas7d: energiaBy[pid]?.quedas7d||0, energiaAberta: energiaBy[pid]?.aberto||false };
      }).sort((a,b)=>b.score-a.score);
      const media = rows.length?Math.round(rows.reduce((a,r)=>a+r.score,0)/rows.length):0;
      setV360({rows, media});
    } catch(e){ setV360({rows:[], media:0, erro:true}); }
  };
  const ctmkInfoFor = (pid) => {
    try {
      const c = ctmkData[pid]; if(!c) return undefined;
      const days = c.status==="offline" && c.offlineSince ? Math.floor((Date.now()-new Date(c.offlineSince).getTime())/86400000) : null;
      return { status: c.status, days };
    } catch(e) { return undefined; }
  };
  const [pin,setPin]=useState(""); const [auth,setAuth]=useState(()=>hasGerencial()); const [err,setErr]=useState(false);
  const [selProject,setSelProject]=useState(null); const [viewReport,setViewReport]=useState(null);
  const [pendScreen,setPendScreen]=useState(false);
  const [confirmDel,setConfirmDel]=useState(null); const [selReports,setSelReports]=useState({});
  const GOLGI_IDS=["P601","P602","P604","P605","P606","P607"], MEGA_IDS=["P311A","P311B"];
  const buildGroupComparativeData = (ids, selectedDates) => ids.map(id=>{
    const p=PROJECTS[id]; if(!p) return null;
    const hist=stored[id]?.history??[]; if(!hist.length) return null;
    const filtered = selectedDates ? hist.filter(r=>selectedDates.has(r.meta?.date)) : hist;
    if(!filtered.length) return null;
    const weeks=filtered.map(r=>{const h=computeHealth(p,r.state);return{date:r.meta?.date,pct:h.pct,inop:h.inop};});
    const lastReport=filtered[filtered.length-1];
    const chronicItems = extractChronicItems(p, lastReport.state);
    return {id, name:p.name, weeks, chronicItems};
  }).filter(Boolean);
  const getAvailableDates = (ids) => {
    const set=new Set();
    ids.forEach(id=>(stored[id]?.history??[]).forEach(r=>{if(r.meta?.date) set.add(r.meta.date);}));
    return [...set].sort().reverse(); // mais recente primeiro
  };
  const [groupCompScreen,setGroupCompScreen]=useState(null); const [selWeeks,setSelWeeks]=useState(new Set());
  const [sessionTime,setSessionTime]=useState(Date.now());
  const [viewLinks,setViewLinks]=useState(()=>{try{return JSON.parse(localStorage.getItem("moklog_viewlinks")||"{}");}catch{return{};}});
  useEffect(()=>{
    const loadVL = async () => {
      try {
        const { getDoc:gd, doc:dc } = await import("firebase/firestore");
        const snap = await gd(dc(db,"config","viewlinks"));
        if(snap.exists()) {
          const data = snap.data();
          setViewLinks(prev => ({...data,...prev}));
          localStorage.setItem("moklog_viewlinks", JSON.stringify({...data}));
        }
      } catch(e){}
    };
    loadVL();
  },[]);
  useEffect(()=>{
    if(!auth) return;
    const t=setInterval(()=>{if(!hasGerencial()){setAuth(false);setPin("");}},30000);
    return ()=>clearInterval(t);
  },[auth]);
  const resetSess=()=>{setSessionTime(Date.now());touchSession();};
  const toggleViewLink=async(pid)=>{
    const cur=viewLinks[pid]; const next={...viewLinks};
    if(cur) delete next[pid]; else next[pid]=generateViewToken(pid);
    setViewLinks(next);
    localStorage.setItem("moklog_viewlinks",JSON.stringify(next));
    try { await setDoc(doc(db,"config","viewlinks"), next); } catch(e){}
  };
  if(!auth) return(
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}} onClick={resetSess}>
      <div style={{background:"#060c18",border:"1px solid #1e293b",borderRadius:16,padding:"32px 28px",maxWidth:340,width:"100%",textAlign:"center",margin:16}}>
        <MoklogLogo size={48}/>
        <h1 style={{position:"absolute",width:1,height:1,overflow:"hidden"}}>Painel Gerencial</h1>
        <div style={{fontSize:17,fontWeight:800,color:"#f1f5f9",marginTop:10,marginBottom:2}}>MokLog <span style={{color:"#cc2222"}}>CheckTest</span></div>
        <div style={{fontSize:13,color:"#cc2222",fontWeight:700,marginBottom:4}}>Painel Gerencial</div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>Acesso restrito</div>
        <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pin}
          onChange={e=>{setPin(e.target.value);setErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter"){if(checkPin(pin,{})){setAuth(true);resetSess();}else setErr(true);}}}
          style={{...S.inp,textAlign:"center",fontSize:22,letterSpacing:10,marginBottom:10}}/>
        {err&&<div role="alert" style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
        <button onClick={()=>{if(checkPin(pin,{})){setAuth(true);resetSess();}else setErr(true);}} style={{...S.primaryBtn,width:"100%",marginBottom:10,fontSize:14}}>Entrar</button>
        <button onClick={onBack} style={{...S.secBtn,width:"100%",fontSize:14}} aria-label="Voltar">← Voltar</button>
      </div>
    </div>
  );
  if(analiseRiscoPacote) {
    const elegiveis = {};
    Object.keys(PROJECTS).forEach(id=>{ if(ANALISE_RISCO_ELIGIBLE.includes(id)) elegiveis[id]=PROJECTS[id]; });
    return <AnaliseRisco projects={elegiveis} stored={stored} pacote={analiseRiscoPacote} onBack={()=>setAnaliseRiscoPacote(null)} />;
  }
  if(v360) {
    const loadingV = v360==="loading";
    const allRows = loadingV?[]:(v360.rows||[]);
    const grupoSel = v360Grupo!=="todos" ? V360_GRUPOS[v360Grupo] : null;
    const rows = grupoSel ? allRows.filter(r=>grupoSel.ids.includes(r.id)) : allRows;
    const mediaGrupo = rows.length?Math.round(rows.reduce((a,r)=>a+r.score,0)/rows.length):0;
    const tituloGrupo = grupoSel ? grupoSel.label : "Todos (interno Moked)";
    const scoreColor = (s)=> s>=90?"#22c55e":s>=75?"#f59e0b":"#ef4444";
    const medal = (i)=> i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}º`;
    return (
      <div style={S.page}>
        <div style={S.formWrap}>
          <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:8}}>
            <button onClick={()=>setV360(null)} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>🎯 Visão 360 — {tituloGrupo}</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>Saúde operacional consolidada — todos os módulos</div>
            </div>
            {!loadingV&&rows.length>0&&<button onClick={()=>gerarPDFVisao360(rows, mediaGrupo, grupoSel?grupoSel.label:null)}
              style={{...S.secBtn,fontSize:12,color:"#60a5fa",borderColor:"#1d4ed844",padding:"8px 12px"}}>📄 PDF Executivo</button>}
          </div>

          {!loadingV&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:8}}>
            {[["todos","Todos"],["golgi","Golgi"],["mega","Mega"],["klog","Klog"]].map(([k,l])=>(
              <button key={k} onClick={()=>setV360Grupo(k)}
                style={{background:v360Grupo===k?"#1d4ed822":"transparent",border:`1px solid ${v360Grupo===k?"#1d4ed866":"#0f172a"}`,color:v360Grupo===k?"#60a5fa":"#94a3b8",borderRadius:8,padding:"9px 4px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                {l}
              </button>
            ))}
          </div>}
          {!loadingV&&v360Grupo==="todos"&&<div style={{fontSize:11,color:"#f59e0b",background:"#1a1000",border:"1px solid #f59e0b33",borderRadius:8,padding:"8px 12px",marginBottom:8}}>
            ⚠ Visão "Todos" é de uso interno Moked. Para enviar a um cliente, selecione o grupo dele — o PDF nunca mistura clientes.
          </div>}

          {loadingV&&<div style={{textAlign:"center",padding:"50px 0"}}>
            <div style={{fontSize:28,marginBottom:10}}>🎯</div>
            <div style={{fontSize:13,color:"#94a3b8"}}>Cruzando dados de todos os módulos...</div>
          </div>}

          {!loadingV&&v360.erro&&<div style={{textAlign:"center",padding:"40px 0",color:"#ef4444",fontSize:13}}>Erro ao carregar. Tente novamente.</div>}

          {!loadingV&&rows.length>0&&<>
            <div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:12,padding:"14px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:14}}>
              <div style={{fontSize:34,fontWeight:900,color:scoreColor(mediaGrupo)}}>{mediaGrupo}<span style={{fontSize:14,color:"#94a3b8"}}>/100</span></div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:800,color:"#f1f5f9"}}>Média — {tituloGrupo}</div>
                <div style={{fontSize:11,color:"#94a3b8"}}>Checklist + CTMK + KeyAccess + Bolsão + Perimetral + Ronda VSPP</div>
              </div>
            </div>

            {rows.map((r,i)=>(
              <div key={r.id} style={{background:"#060c18",border:`1px solid ${r.score<75?"#ef444433":"#0f172a"}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:r.penalidades.length?8:0}}>
                  <span style={{fontSize:16,minWidth:32,textAlign:"center"}}>{medal(i)}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9"}}>{r.id} <span style={{fontWeight:400,color:"#94a3b8",fontSize:11}}>· {r.name}</span></div>
                    <div style={{fontSize:11,color:"#94a3b8"}}>Checklist base: {r.semChecklist?"sem relatório":r.base+"%"}{r.ilumTotal>0&&<span style={{color:r.ilumDeficientes>0?"#ef4444":"#22c55e",fontWeight:700}}> · 💡 {r.ilumDeficientes} deficiente{r.ilumDeficientes===1?"":"s"}</span>}{(r.energiaAberta||r.energiaQuedas7d>0)&&<span style={{color:r.energiaAberta?"#ef4444":"#f59e0b",fontWeight:700}}> · ⚡ {r.energiaAberta?"em aberto":`${r.energiaQuedas7d} queda${r.energiaQuedas7d===1?"":"s"} (7d)`}</span>}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:22,fontWeight:900,color:scoreColor(r.score)}}>{r.score}</div>
                    <div style={{fontSize:11,color:"#94a3b8"}}>/100</div>
                  </div>
                </div>
                {r.penalidades.length>0&&<div style={{borderTop:"1px solid #0a0f1e",paddingTop:8,display:"flex",flexDirection:"column",gap:3}}>
                  {r.penalidades.map((p,j)=>(
                    <div key={j} style={{fontSize:11,color:"#f59e0b",display:"flex",justifyContent:"space-between"}}>
                      <span>⚠ {p.label}</span><span style={{fontWeight:800,color:"#ef4444"}}>−{p.val}</span>
                    </div>
                  ))}
                </div>}
                {r.penalidades.length===0&&!r.semChecklist&&<div style={{fontSize:11,color:"#22c55e",marginTop:2}}>✓ Sem pendências ativas em nenhum módulo</div>}
              </div>
            ))}

            <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.6,padding:"8px 4px"}}>
              O score parte do último checklist semanal e desconta pendências ativas: CTMK off-line, falhas KeyAccess abertas, placas críticas no bolsão, zonas perimetrais com problema e ronda VSPP abaixo da meta. Pesos documentados no PDF.
            </div>
          </>}
        </div>
      </div>
    );
  }

  if(pendScreen) return <PendenciesScreen stored={stored} onBack={()=>setPendScreen(false)}/>;
  if(groupCompScreen){
    const {label,ids}=groupCompScreen;
    const availDates=(()=>{const set=new Set();ids.forEach(id=>(stored[id]?.history??[]).forEach(r=>{if(r.meta?.date)set.add(r.meta.date);}));return [...set].sort().reverse();})();
    const countForDate=(d)=>ids.filter(id=>(stored[id]?.history??[]).some(r=>r.meta?.date===d)).length;
    const toggleWeek=(d)=>setSelWeeks(prev=>{const next=new Set(prev);next.has(d)?next.delete(d):next.add(d);return next;});
    const applyPreset=(preset)=>{
      if(preset==="hoje") setSelWeeks(new Set(availDates.slice(0,1)));
      else if(preset==="mes") setSelWeeks(new Set(availDates.slice(0,4)));
      else if(preset==="tudo") setSelWeeks(new Set(availDates));
    };
    const gerar=()=>{
      if(selWeeks.size===0) return;
      const data=buildGroupComparativeData(ids, selWeeks);
      const n=selWeeks.size;
      const periodLabel = n===1?`Semana de ${fmtDate([...selWeeks][0])}`:n===availDates.length?`Período completo (${n} semanas)`:`${n} semanas selecionadas`;
      generateGroupComparativePDF(label, data, periodLabel);
    };
    return(
      <div style={S.page} onClick={resetSess}>
        <div style={S.formWrap}>
          <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:12}}>
            <button onClick={()=>setGroupCompScreen(null)} style={S.backBtn} aria-label="Voltar">← Painel</button>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>📊 Comparativo {label}</div><div style={{fontSize:11,color:"#94a3b8"}}>Escolha o período a comparar</div></div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <button onClick={()=>applyPreset("hoje")} style={{...S.secBtn,flex:1,fontSize:12,padding:"10px 6px"}}>🗓 Última semana</button>
            <button onClick={()=>applyPreset("mes")} style={{...S.secBtn,flex:1,fontSize:12,padding:"10px 6px"}}>📅 Último mês</button>
            <button onClick={()=>applyPreset("tudo")} style={{...S.secBtn,flex:1,fontSize:12,padding:"10px 6px"}}>🗂 Tudo</button>
          </div>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Ou selecione manualmente ({selWeeks.size} selecionada{selWeeks.size===1?"":"s"})</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:90}}>
            {availDates.length===0&&<div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:20}}>Nenhum relatório encontrado para este grupo ainda.</div>}
            {availDates.map(d=>{
              const sel=selWeeks.has(d); const cnt=countForDate(d);
              return(
                <div key={d} onClick={()=>toggleWeek(d)} style={{display:"flex",alignItems:"center",gap:10,background:sel?"#0c1f3d":"#060c18",border:`1.5px solid ${sel?"#3b82f6":"#0f172a"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer"}}>
                  <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${sel?"#3b82f6":"#64748b"}`,background:sel?"#3b82f6":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",flexShrink:0}}>{sel?"✓":""}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{getWeekLabel(d)} <span style={{fontSize:11,color:"#94a3b8",fontWeight:400}}>{fmtDate(d)}</span></div>
                  </div>
                  <div style={{fontSize:11,color:"#94a3b8",fontWeight:700}}>{cnt}/{ids.length} projetos</div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#020510",borderTop:"1px solid #0f172a",padding:14}}>
          <button onClick={gerar} disabled={selWeeks.size===0} style={{...S.primaryBtn,width:"100%",background:selWeeks.size===0?"#1e293b":"linear-gradient(135deg,#1d4ed8,#1e3a8a)",fontSize:14,opacity:selWeeks.size===0?0.6:1,maxWidth:480,margin:"0 auto",display:"block"}}>
            📊 Gerar Comparativo ({selWeeks.size} semana{selWeeks.size===1?"":"s"})
          </button>
        </div>
      </div>
    );
  }
  if(viewReport) return(
    <div style={S.page} onClick={resetSess}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:8}}>
          <button onClick={()=>setViewReport(null)} style={S.backBtn} aria-label="Voltar">← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{viewReport.project.id} — {getWeekLabel(viewReport.report.meta?.date)}</div>
            <div style={{fontSize:11,color:"#94a3b8"}}>{fmtDate(viewReport.report.meta?.date)} · Lider: {viewReport.report.meta?.leader||"—"}</div>
          </div>
          <HealthRing pct={computeHealth(viewReport.project,viewReport.report.state).pct} size={46}/>
        </div>
        {viewReport.project.categories.map(cat=>{
          const sv=viewReport.report.state[cat.id]; if(!sv) return null;
          let cp=100;
          if(cat.type==="single"){const st=sv.status??(sv.ok===false?"inop":"ok");cp=st==="ok"?100:st==="partial"?50:0;}
          else if(cat.type==="items"){const okN=sv.filter(v=>(v.status??"ok")==="ok").length;const partN=sv.filter(v=>v.status==="partial").length;cp=calcPct(okN+(partN*0.5|0),sv.length);}
          else if(cat.type==="count"){const t=sv.total??cat.total;cp=calcPct(t-(sv.inoperative?.length??0),t);}
          const dotColor=cp===100?"#22c55e":cp>=50?"#f59e0b":"#ef4444";
          return(
            <div key={cat.id} style={{background:"#060c18",border:`1px solid ${dotColor}22`,borderRadius:8,padding:"10px 12px",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:dotColor,flexShrink:0}}/>
                <span style={{fontSize:12,fontWeight:700,color:"#cbd5e1",flex:1}}>{cat.label}</span>
                {cat.type!=="maintenance"&&cat.type!=="notes"&&<span style={{fontSize:11,fontWeight:800,color:dotColor}}>{cp}%</span>}
              </div>
              {cp<100&&cat.type==="items"&&sv.filter(v=>(v.status??"ok")!=="ok").map((v,idx)=>{
                const i=sv.indexOf(v); const st=v.status??"ok";
                return <div key={idx} style={{fontSize:11,color:st==="partial"?"#f59e0b":"#ef4444",marginLeft:16,marginTop:2}}>
                  ↳ {cat.itemLabels[i]}: {st==="partial"?"PARCIAL":"INOP"}{v.since?` desde ${fmtDate(v.since)}`:""}{v.note?` — ${v.note}`:""}
                </div>;
              })}
              {cp<100&&cat.type==="count"&&(sv.inoperative??[]).map((it,i)=>(
                <div key={i} style={{fontSize:11,color:"#ef4444",marginLeft:16,marginTop:2}}>↳ {it.id||"?"}{it.since?` desde ${fmtDate(it.since)}`:""}{it.note?` — ${it.note}`:""}</div>
              ))}
              {cat.type==="notes"&&(sv.items??[]).map((it,i)=>(
                <div key={i} style={{fontSize:11,color:"#f59e0b",marginLeft:16,marginTop:2}}>▸ {it.label}{it.note?` — ${it.note}`:""}</div>
              ))}
            </div>
          );
        })}
        <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
          <button onClick={async ()=>{
              const proj = viewReport.project||viewReport;
              const [inquilinosInfo, energiaInfo] = await Promise.all([loadInquilinosParaPDF(proj.id), loadEnergiaResumoParaPDF(proj.id)]);
              generatePDF(
                proj,
                viewReport.report?.state||viewReport.state,
                viewReport.report?.meta||viewReport.meta,
                [],
                ctmkInfoFor(proj.id),
                inquilinosInfo,
                energiaInfo
              );
            }}
            style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#7c3aed,#6d28d9)",fontSize:13}}>📄 PDF</button>
          {onEditReport&&<button onClick={()=>onEditReport(viewReport.project,viewReport.report,viewReport.idx)}
            style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#0369a1,#0c4a6e)",fontSize:13}}>✏️ Editar</button>}
          <button onClick={()=>{setConfirmDel({projectId:viewReport.project.id,idx:viewReport.idx,date:viewReport.report.meta?.date});setViewReport(null);}}
            style={{...S.secBtn,flex:1,color:"#ef4444",borderColor:"#ef444433",fontSize:13}} aria-label="Excluir relatório">🗑 Excluir</button>
        </div>
      </div>
    </div>
  );
  if(selProject){
    const p=selProject; const hist=stored[p.id]?.history??[]; const sel=selReports[p.id]??[];
    const toggleSel=(idx)=>{const cur=selReports[p.id]??[];const next=cur.includes(idx)?cur.filter(i=>i!==idx):(cur.length<6?[...cur,idx]:cur);setSelReports(prev=>({...prev,[p.id]:next}));};
    const viewToken=viewLinks[p.id];
    const viewUrl=viewToken?`${window.location.origin}${window.location.pathname}?view=${p.id}_${viewToken}`:"";
    return(
      <div style={S.page} onClick={resetSess}>
        <div style={S.formWrap}>
          <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:8}}>
            <button onClick={()=>{setSelProject(null);setSelReports({});}} style={S.backBtn} aria-label="Voltar ao Painel">← Painel</button>
            <MoklogLogo size={32}/>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{p.id} – {p.name}</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>{hist.length}/{MAX_HISTORY} relatorios</div>
            </div>
          </div>
          <div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:10,padding:"10px 14px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>🔗 Link Manutencao</div>
                <div style={{fontSize:11,color:"#94a3b8"}}>{viewToken?"Ativo":"Inativo"}</div>
              </div>
              <button onClick={()=>toggleViewLink(p.id)} style={{...S.sm,...(viewToken?S.smBad:S.smOk),fontSize:11,padding:"5px 10px"}}>
                {viewToken?"Desativar":"Ativar"}
              </button>
            </div>
            {viewToken&&<div style={{marginTop:8}}>
              <div style={{fontSize:11,color:"#94a3b8",wordBreak:"break-all",background:"#020510",padding:"5px 8px",borderRadius:5,marginBottom:5}}>{viewUrl}</div>
              <button onClick={()=>navigator.clipboard.writeText(viewUrl)} style={{...S.sm,fontSize:11,width:"100%"}}>📋 Copiar Link</button>
            </div>}
          </div>
          {sel.length>=2&&<button onClick={()=>generateConsolidatedPDF(p,sel.map(i=>hist[i]).sort((a,b)=>(a.meta?.date||"").localeCompare(b.meta?.date||"")))}
            style={{...S.primaryBtn,width:"100%",background:"linear-gradient(135deg,#7c3aed,#6d28d9)",marginBottom:8,fontSize:14}}>
            📊 Gerar Consolidado ({sel.length} semanas)</button>}
          {sel.length===0&&hist.length>0&&<div style={{background:"#0f172a",borderRadius:8,padding:"8px",textAlign:"center",fontSize:12,color:"#94a3b8",marginBottom:8}}>☑ Selecione 2 a 6 relatorios para consolidado</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {hist.slice().reverse().map((r,revIdx)=>{
              const realIdx=hist.length-1-revIdx;
              const h=computeHealth(p,r.state);
              const color=h.pct>=90?"#22c55e":h.pct>=70?"#f59e0b":"#ef4444";
              const isSelected=sel.includes(realIdx);
              return(
                <div key={realIdx} style={{background:"#060c18",border:`2px solid ${isSelected?color:"#0f172a"}`,borderRadius:12,padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <button onClick={()=>toggleSel(realIdx)}
                      style={{width:30,height:30,borderRadius:6,border:`2px solid ${isSelected?color:"#94a3b8"}`,background:isSelected?color+"22":"transparent",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:isSelected?color:"#94a3b8"}}>
                      {isSelected?"✓":""}
                    </button>
                    <HealthRing pct={h.pct} size={44}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9"}}>{getWeekLabel(r.meta?.date)} <span style={{fontSize:11,color:"#94a3b8",fontWeight:400}}>{fmtDate(r.meta?.date)}</span></div>
                      <div style={{fontSize:11,color:"#64748b"}}>Lider: {r.meta?.leader||"—"} · CCO: {r.meta?.cco||"—"}{r.meta?.tempoPreenchimentoSeg?` · ⏱️ ${Math.floor(r.meta.tempoPreenchimentoSeg/60)}min`:""}</div>
                      {r.meta?.signature&&<div style={{fontSize:11,color:"#94a3b8"}}>✍ {r.meta.signature}</div>}
                      <div style={{fontSize:11,color:h.inop>0?"#ef4444":"#22c55e",fontWeight:600}}>{h.inop>0?`${h.inop} inop`:"✔ OK"}</div>
                    </div>
                  </div>
                  <div style={{marginTop:8,height:3,background:"#0f172a",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${h.pct}%`,background:color,borderRadius:2}}/>
                  </div>
                  <div style={{display:"flex",gap:6,marginTop:10}}>
                    <button onClick={()=>setViewReport({project:p,report:r,idx:realIdx})} style={{...S.secBtn,flex:1,padding:"9px",fontSize:12}}>👁 Ver</button>
                    <button onClick={async ()=>{ const [inquilinosInfo, energiaInfo] = await Promise.all([loadInquilinosParaPDF(p.id), loadEnergiaResumoParaPDF(p.id)]); generatePDF(p,r.state,r.meta,[],ctmkInfoFor(p.id),inquilinosInfo,energiaInfo); }} style={{...S.primaryBtn,flex:1,padding:"9px",fontSize:12,background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}}>📄 PDF</button>
                    <button onClick={()=>setConfirmDel({projectId:p.id,idx:realIdx,date:r.meta?.date})} style={{...S.secBtn,padding:"9px 12px",fontSize:12,color:"#ef4444",borderColor:"#ef444433"}} aria-label="Excluir relatório">🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {confirmDel&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16}}>
            <div style={{background:"#060c18",border:"1px solid #ef4444",borderRadius:14,padding:"24px 20px",maxWidth:320,width:"100%",textAlign:"center"}}>
              <div style={{fontSize:15,fontWeight:700,color:"#f1f5f9",marginBottom:6}}>Excluir relatorio?</div>
              <div style={{fontSize:12,color:"#94a3b8",marginBottom:20}}>{confirmDel.projectId} — {fmtDate(confirmDel.date)}</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{onDeleteReport(confirmDel.projectId,confirmDel.idx);setConfirmDel(null);setSelProject(null);}}
                  style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#b91c1c,#991b1b)",fontSize:14}}>Excluir</button>
                <button onClick={()=>setConfirmDel(null)} style={{...S.secBtn,flex:1,fontSize:14}}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  const allProjects=Object.values(PROJECTS);
  const valid=allProjects.map(p=>{const hist=stored[p.id]?.history??[];if(!hist.length)return null;const last=hist[hist.length-1];const h=computeHealth(p,last.state);return{...p,pct:h.pct,date:last.meta?.date,inopN:h.inop,hist};}).filter(Boolean);
  const avgPct=valid.length?Math.round(valid.reduce((a,b)=>a+b.pct,0)/valid.length):null;
  const totalInopAll=valid.reduce((a,b)=>a+b.inopN,0);
  const criticalAlerts=[];
  allProjects.forEach(p=>{const hist=stored[p.id]?.history??[];if(!hist.length)return;for(const cat of p.categories){if(cat.type==="items"){const lastState=hist[hist.length-1].state[cat.id];if(!lastState)continue;lastState.forEach((v,i)=>{const st=v.status??(v.ok===false?"inop":"ok");if(st!=="ok"){const wks=getConsecutiveInopWeeks(p,hist,cat.id,i);if(wks>=2)criticalAlerts.push({project:p.id,label:`${cat.label} — ${cat.itemLabels[i]}`,weeks:wks});}});}}});
  criticalAlerts.sort((a,b)=>b.weeks-a.weeks);
  return(
    <div style={S.page} onClick={resetSess}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:8}}>
          <button onClick={onBack} style={S.backBtn} aria-label="Voltar ao Início">← Inicio</button>
          <MoklogLogo size={34}/>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:900,color:"#f1f5f9"}}>MokLog <span style={{color:"#cc2222"}}>CheckTest</span></div><div style={{fontSize:11,color:"#94a3b8"}}>Painel Gerencial</div></div>
          {avgPct!==null&&<HealthRing pct={avgPct} size={52}/>}
        </div>
        {avgPct!==null&&<div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:12,padding:"14px 16px",marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:900,color:avgPct>=90?"#22c55e":"#ef4444"}}>{avgPct}%</div><div style={{fontSize:11,color:"#94a3b8",fontWeight:700}}>SAÚDE GERAL</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:900,color:totalInopAll>0?"#ef4444":"#22c55e"}}>{totalInopAll}</div><div style={{fontSize:11,color:"#94a3b8",fontWeight:700}}>INOP TOTAL</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:900,color:criticalAlerts.length>0?"#ef4444":"#22c55e"}}>{criticalAlerts.length}</div><div style={{fontSize:11,color:"#94a3b8",fontWeight:700}}>ALERTAS</div></div>
          </div>
        </div>}

        {(getAvailableDates(GOLGI_IDS).length>0||getAvailableDates(MEGA_IDS).length>0)&&<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>📋 Análise de Risco por Grupo</div>
          <button onClick={()=>setAnaliseRiscoPacote("golgi")} style={{...S.primaryBtn,width:"100%",background:"linear-gradient(135deg,#14795A,#1D9E75)",fontSize:13,border:"1px solid #1D9E7566"}}>📋 Análise de Risco Golgi</button>
          <button onClick={()=>setAnaliseRiscoPacote("mega")} style={{...S.primaryBtn,width:"100%",background:"linear-gradient(135deg,#14795A,#1D9E75)",fontSize:13,border:"1px solid #1D9E7566"}}>📋 Análise de Risco Mega</button>
          <button onClick={()=>setAnaliseRiscoPacote("klog")} style={{...S.primaryBtn,width:"100%",background:"linear-gradient(135deg,#14795A,#1D9E75)",fontSize:13,border:"1px solid #1D9E7566"}}>📋 Análise de Risco Klog</button>
        </div>}
        {(()=>{const allPend=getAllPendencies(stored);return allPend.length>0?(<div style={{background:"#1a0202",border:"1px solid #ef444444",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",marginBottom:8}} onClick={()=>setPendScreen(true)}><div style={{fontSize:12,fontWeight:700,color:"#ef4444"}}>🔴 {allPend.filter(p=>p.status==="inop").length} Inop · ⚠️ {allPend.filter(p=>p.status==="partial").length} Parcial</div><span style={{color:"#ef4444",fontSize:14,fontWeight:700}}>Ver →</span></div>):null;})()}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {allProjects.map(p=>{const hist=stored[p.id]?.history??[];const last=hist.length?hist[hist.length-1]:null;const h=last?computeHealth(p,last.state):null;const color=h?h.pct>=90?"#22c55e":h.pct>=70?"#f59e0b":"#ef4444":"#334155";return(<div key={p.id} onClick={()=>setSelProject(p)} style={{background:"#060c18",border:`1px solid ${h?color+"44":"#0f172a"}`,borderRadius:12,padding:"14px 16px",cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:12}}>{h?<HealthRing pct={h.pct} size={50}/>:<div style={{width:50,height:50,borderRadius:"50%",border:"2px solid #1e293b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#94a3b8"}}>—</div>}<div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{p.id} – {p.name}</div>{h?<div style={{fontSize:11,color:"#64748b",marginTop:2}}>Ultimo: {fmtDate(last.meta?.date)} · {h.inop} inop</div>:<div style={{fontSize:11,color:"#94a3b8"}}>Sem registros</div>}</div><CtmkBadge info={ctmkData[p.id]} onToggle={()=>setCtmkConfirm({pid:p.id, status: ctmkData[p.id]?.status||"online", allowDateEdit:true, offlineSince:ctmkData[p.id]?.offlineSince||null})} size="small"/></div>{h&&<div style={{marginTop:8,height:4,background:"#0f172a",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${h.pct}%`,background:color,borderRadius:2}}/></div>}</div>);})}
        </div>
      </div>
      {confirmDel&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16}}><div style={{background:"#060c18",border:"1px solid #ef4444",borderRadius:14,padding:"24px 20px",maxWidth:320,width:"100%",textAlign:"center"}}><div style={{fontSize:15,fontWeight:700,color:"#f1f5f9",marginBottom:6}}>Excluir relatorio?</div><div style={{fontSize:12,color:"#94a3b8",marginBottom:20}}>{confirmDel.projectId} — {fmtDate(confirmDel.date)}</div><div style={{display:"flex",gap:8}}><button onClick={()=>{onDeleteReport(confirmDel.projectId,confirmDel.idx);setConfirmDel(null);}} style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#b91c1c,#991b1b)",fontSize:14}}>Excluir</button><button onClick={()=>setConfirmDel(null)} style={{...S.secBtn,flex:1,fontSize:14}}>Cancelar</button></div></div></div>)}
      {ctmkConfirm&&<CtmkConfirmModal confirm={ctmkConfirm} project={{id:ctmkConfirm.pid}} onCancel={()=>setCtmkConfirm(null)} onConfirm={(date)=>{onToggleCtmk(ctmkConfirm.pid,date);setCtmkConfirm(null);}}/>}
    </div>
  );
}

function PendenciesScreen({stored, onBack}) {
  const [filter, setFilter] = useState("all");
  const [openProj, setOpenProj] = useState({});
  const toggleProj = (pid) => setOpenProj(o=>({...o,[pid]:!o[pid]}));
  const all = getAllPendencies(stored);
  const filtered = filter === "all" ? all : filter === "critical" ? all.filter(p => p.status === "inop") : all.filter(p => p.status === "partial");
  const critCount = all.filter(p => p.status === "inop").length;
  const partCount = all.filter(p => p.status === "partial").length;
  return(
    <div style={S.page}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:8}}>
          <button onClick={onBack} style={S.backBtn} aria-label="Voltar">← Voltar</button>
          <div style={{flex:1}}>
            <h1 style={{position:"absolute",width:1,height:1,overflow:"hidden"}}>Pendências Globais</h1>
            <div style={{fontSize:15,fontWeight:800,color:"#f1f5f9"}}>Pendências Globais</div><div style={{fontSize:11,color:"#94a3b8"}}>Todos os projetos · {all.length} itens</div></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
          <div style={{background:"#060c18",border:"1px solid #ef444433",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:"#ef4444"}}>{critCount}</div><div style={{fontSize:11,color:"#94a3b8",fontWeight:700}}>INOP</div></div>
          <div style={{background:"#060c18",border:"1px solid #f59e0b33",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:"#f59e0b"}}>{partCount}</div><div style={{fontSize:11,color:"#94a3b8",fontWeight:700}}>PARCIAL</div></div>
          <div style={{background:"#060c18",border:"1px solid #1e293b",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:"#94a3b8"}}>{all.length}</div><div style={{fontSize:11,color:"#94a3b8",fontWeight:700}}>TOTAL</div></div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {[["all","Todos",all.length],["critical","Inop",critCount],["partial","Parcial",partCount]].map(([key,label,count])=>(
            <button key={key} onClick={()=>setFilter(key)} style={{...S.sm,flex:1,padding:"7px",fontSize:11,...(filter===key?{background:"#1d4ed8",border:"1px solid #1d4ed8",color:"white"}:{})}}>{label} ({count})</button>
          ))}
        </div>
        {filtered.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:"#22c55e",fontSize:14}}><div style={{fontSize:28,marginBottom:8}}>✅</div>Nenhuma pendência encontrada!</div>}
        {(()=>{
          // Agrupa por projeto preservando a ordem (mais antiga primeiro, pois filtered já vem ordenado por dias desc)
          const grupos=[]; const gIdx={};
          filtered.forEach(p=>{
            const pid=p.project.id;
            if(gIdx[pid]===undefined){ gIdx[pid]=grupos.length; grupos.push({project:p.project,itens:[]}); }
            grupos[gIdx[pid]].itens.push(p);
          });
          const todosAbertos = grupos.length>0 && grupos.every(g=>openProj[g.project.id]);
          return (<>
          {grupos.length>1&&(
            <button onClick={()=>{
                const novo={}; if(!todosAbertos) grupos.forEach(g=>{novo[g.project.id]=true;});
                setOpenProj(novo);
              }}
              style={{...S.sm,width:"100%",padding:"7px",fontSize:11,marginBottom:8}}>
              {todosAbertos?"▲ Recolher todos":"▼ Expandir todos"}
            </button>
          )}
          <style>{`@keyframes mkFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes mkBadgePulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {grupos.map((g,gi)=>{
              const pid=g.project.id;
              const aberto=!!openProj[pid];
              const nInop=g.itens.filter(p=>p.status==="inop").length;
              const nParc=g.itens.length-nInop;
              const maisAntiga=g.itens.reduce((m,p)=>(p.days||0)>m?(p.days||0):m,0);
              const corBorda=nInop>0?"#ef4444":"#f59e0b";
              return (
                <div key={pid} style={{background:"#060c18",border:`1px solid ${corBorda}33`,borderRadius:12,overflow:"hidden",animation:"mkFadeIn .3s ease both",animationDelay:`${Math.min(gi*45,400)}ms`}}>
                  <div onClick={()=>toggleProj(pid)} role="button"
                    style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer",
                      background:aberto?`linear-gradient(135deg, ${corBorda}14, transparent)`:"transparent"}}>
                    <span style={{fontSize:12,color:"#94a3b8",flexShrink:0,transform:aberto?"rotate(90deg)":"none",transition:"transform .15s ease"}}>▶</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9"}}>{pid} <span style={{fontWeight:600,color:"#64748b",fontSize:11}}>— {g.project.name}</span></div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>
                        {g.itens.length} pendência{g.itens.length!==1?"s":""}{maisAntiga>0?` · mais antiga: ${maisAntiga} dia${maisAntiga!==1?"s":""}`:""}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:5,flexShrink:0}}>
                      {nInop>0&&<span style={{fontSize:10,fontWeight:800,color:"#ef4444",background:"#ef444422",border:"1px solid #ef444444",padding:"3px 8px",borderRadius:6,animation:"mkBadgePulse 1.8s ease-in-out infinite"}}>{nInop} inop</span>}
                      {nParc>0&&<span style={{fontSize:10,fontWeight:800,color:"#f59e0b",background:"#f59e0b22",border:"1px solid #f59e0b44",padding:"3px 8px",borderRadius:6}}>{nParc} parc</span>}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateRows:aberto?"1fr":"0fr",transition:"grid-template-rows .3s ease"}}><div style={{overflow:"hidden",minHeight:0}}>
                  {aberto&&(
                    <div style={{display:"flex",flexDirection:"column",gap:6,padding:"0 10px 10px"}}>
                      {g.itens.map((p,i)=>{
                        const color = p.status==="inop" ? "#ef4444" : "#f59e0b";
                        const urgency = p.days && p.days >= 30 ? "🔴" : p.days && p.days >= 14 ? "🟡" : "⚪";
                        return(
                          <div key={i} style={{background:"#04080f",border:`1px solid ${color}33`,borderRadius:10,padding:"10px 12px"}}>
                            <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                              <span style={{fontSize:14,flexShrink:0,marginTop:1}}>{urgency}</span>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:3}}>
                                  <span style={{fontSize:11,fontWeight:700,color:color,background:color+"22",padding:"2px 6px",borderRadius:5}}>{p.status==="inop"?"INOP":"PARCIAL"}</span>
                                  {p.days!==null&&<span style={{fontSize:11,color:p.days>=30?"#ef4444":p.days>=14?"#f59e0b":"#94a3b8",fontWeight:700}}>há {p.days} dia{p.days!==1?"s":""}</span>}
                                </div>
                                <div style={{fontSize:12,fontWeight:600,color:"#cbd5e1",marginBottom:2}}>{p.cat}</div>
                                {p.item&&p.item!=="—"&&<div style={{fontSize:11,color:"#94a3b8"}}>↳ {p.item}</div>}
                                {p.note&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2,fontStyle:"italic"}}>{p.note}</div>}
                                <div style={{fontSize:11,color:"#94a3b8",marginTop:3}}>Desde: {fmtDate(p.since)||"—"}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  </div></div>
                </div>
              );
            })}
          </div>
          </>);
        })()}
      </div>
    </div>
  );
}

function HistoryScreen({project, stored, onBack, onEdit, onDelete, canManage}) {
  const [viewReport, setViewReport] = useState(null);
  const hist=(stored[project.id]?.history??[]).slice().reverse();

  if(viewReport) return((()=>{
    const rep = viewReport.report || viewReport;
    const repMeta = rep.meta || {};
    const repState = rep.state || {};
    const ultimos = hist.slice(0,4).map(r=>({ wk:getWeekLabel(r.meta?.date), data:fmtDate(r.meta?.date), leader:r.meta?.leader||"—", cco:r.meta?.cco||"—", sig:r.meta?.signature||"" }));
    return(
    <div style={S.page}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:8}}>
          <button onClick={()=>setViewReport(null)} style={S.backBtn} aria-label="Voltar">← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{project.id} — {getWeekLabel(repMeta.date)}</div>
            <div style={{fontSize:11,color:"#94a3b8"}}>{fmtDate(repMeta.date)}{repMeta.tempoPreenchimentoSeg?` · ⏱️ ${Math.floor(repMeta.tempoPreenchimentoSeg/60)}min`:""}{canManage?"":" · somente leitura"}</div>
          </div>
          <HealthRing pct={computeHealth(project,repState).pct} size={46}/>
        </div>
        {canManage&&(
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <button onClick={()=>onEdit&&onEdit(project,rep,viewReport.idx)} style={{...S.secBtn,flex:1,fontSize:13,color:"#f59e0b",border:"1px solid #f59e0b44"}}>✏️ Editar este relatório</button>
            <button onClick={()=>{if(window.confirm("Excluir definitivamente o relatório de "+fmtDate(repMeta.date)+"? Essa ação não pode ser desfeita.")){onDelete&&onDelete(project.id,viewReport.idx);setViewReport(null);}}} style={{...S.secBtn,flex:1,fontSize:13,color:"#ef4444",border:"1px solid #ef444444"}}>🗑 Excluir</button>
          </div>
        )}
        <div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:10,padding:"12px 14px",marginBottom:8}}>
          <div style={{fontSize:11,color:"#0ea5e9",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>📂 Últimos testes</div>
          {ultimos.map((u,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:i<ultimos.length-1?"1px solid #0a0f1e":"none"}}>
              <span style={{fontSize:11,fontWeight:800,color:"#cbd5e1",minWidth:54}}>{u.wk}</span>
              <span style={{fontSize:11,color:"#64748b",minWidth:74}}>{u.data}</span>
              <span style={{fontSize:11,color:"#94a3b8",flex:1}}>Líder: {u.leader} · CCO: {u.cco}</span>
            </div>
          ))}
        </div>
        <div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:10,padding:"12px 14px",marginBottom:8}}>
          <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>📋 Cabeçalho</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              ["Data",        fmtDate(repMeta.date)],
              ["Início",      repMeta.start||"—"],
              ["Término",     repMeta.end||"—"],
              ["Líder VSPP",  repMeta.leader||"—"],
              ["CCO",         repMeta.cco||"—"],
              ["Moked 24h",   repMeta.moked||"—"],
              ["Assinatura",  repMeta.signature||"—"],
            ].map(([label,val])=>(
              <div key={label}>
                <div style={{fontSize:11,color:"#64748b",fontWeight:700,textTransform:"uppercase",marginBottom:2}}>{label}</div>
                <div style={{fontSize:12,color:"#f1f5f9",fontWeight:600}}>{val}</div>
              </div>
            ))}
          </div>
        </div>
        {project.categories.map(cat=>{
          const sv=repState[cat.id]; if(!sv) return null;
          const itemLabels=Array.isArray(cat.itemLabels)?cat.itemLabels:[];
          let cp=100;
          if(cat.type==="single"){const st=sv.status??(sv.ok===false?"inop":"ok");cp=st==="ok"?100:st==="partial"?50:0;}
          else if(cat.type==="items"){const arr=Array.isArray(sv)?sv:[];const okN=arr.filter(v=>(v?.status??"ok")==="ok").length;const partN=arr.filter(v=>v?.status==="partial").length;cp=calcPct(okN+(partN*0.5|0),arr.length||1);}
          else if(cat.type==="count"){const t=sv.total??cat.total??0;cp=calcPct(t-(sv.inoperative?.length??0),t||1);}
          const dotColor=cp===100?"#22c55e":cp>=50?"#f59e0b":"#ef4444";
          return(
            <div key={cat.id} style={{background:"#060c18",border:`1px solid ${dotColor}22`,borderRadius:8,padding:"10px 12px",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:dotColor,flexShrink:0}}/>
                <span style={{fontSize:12,fontWeight:700,color:"#cbd5e1",flex:1}}>{cat.label}</span>
                {cat.type!=="maintenance"&&cat.type!=="notes"&&<span style={{fontSize:11,fontWeight:800,color:dotColor}}>{cp}%</span>}
              </div>
              {cp<100&&cat.type==="items"&&Array.isArray(sv)&&sv.filter(v=>(v?.status??"ok")!=="ok").map((v,idx)=>{
                const i=sv.indexOf(v);const st=v?.status??"ok";
                return<div key={idx} style={{fontSize:11,color:st==="partial"?"#f59e0b":"#ef4444",marginLeft:16,marginTop:3}}>
                  ↳ {itemLabels[i]||`Item ${i+1}`}: {st==="partial"?"PARCIAL":"INOP"}{v?.since?` desde ${fmtDate(v.since)}`:""}{v?.note?` — ${v.note}`:""}
                </div>;
              })}
              {cp<100&&cat.type==="count"&&Array.isArray(sv.inoperative)&&sv.inoperative.map((it,i)=>(
                <div key={i} style={{fontSize:11,color:"#ef4444",marginLeft:16,marginTop:3}}>↳ {it?.id||"?"}{it?.since?` desde ${fmtDate(it.since)}`:""}{it?.note?` — ${it.note}`:""}</div>
              ))}
              {cat.type==="notes"&&Array.isArray(sv.items)&&sv.items.map((it,i)=>(
                <div key={i} style={{fontSize:11,color:"#f59e0b",marginLeft:16,marginTop:3}}>▸ {it?.label}{it?.note?` — ${it.note}`:""}</div>
              ))}
              {cat.type==="maintenance"&&Array.isArray(sv.visits)&&sv.visits.map((v,i)=>(
                <div key={i} style={{fontSize:11,color:"#94a3b8",marginLeft:16,marginTop:3}}>🔧 {fmtDate(v?.date)} · {v?.empresa||"—"} · {v?.tec1||"—"}</div>
              ))}
            </div>
          );
        })}
        {repMeta.obs&&(
          <div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:8,padding:"10px 14px",marginTop:4}}>
            <div style={{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:4}}>OBSERVAÇÕES</div>
            <div style={{fontSize:12,color:"#94a3b8"}}>{repMeta.obs}</div>
          </div>
        )}
        <div style={{fontSize:11,color:"#94a3b8",textAlign:"center",marginTop:8}}>👁 Somente leitura — sem PDF neste acesso</div>
      </div>
    </div>
    );
  })());

  return(
    <div style={S.page}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:4}}>
          <button onClick={onBack} style={S.backBtn} aria-label="Voltar">← Voltar</button>
          <div><div style={{fontSize:15,fontWeight:800,color:"#f1f5f9"}}>Historico — {project.id}</div><div style={{fontSize:11,color:"#94a3b8"}}>{project.name} · {hist.length} relatório(s)</div></div>
        </div>
        {!hist.length&&<div style={{textAlign:"center",padding:"40px 0",color:"#94a3b8",fontSize:14}}><div style={{fontSize:28,marginBottom:8}}>📭</div>Nenhum relatorio salvo ainda.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {hist.map((r,i)=>{
            const h=computeHealth(project,r.state);
            const color=h.pct>=90?"#22c55e":h.pct>=70?"#f59e0b":"#ef4444";
            return(
              <div key={i} style={{background:"#060c18",border:`1px solid ${color}22`,borderRadius:12,padding:"12px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <HealthRing pct={h.pct} size={46}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{getWeekLabel(r.meta?.date)} <span style={{fontSize:11,color:"#94a3b8",fontWeight:400}}>{fmtDate(r.meta?.date)}</span></div>
                    <div style={{fontSize:11,color:"#64748b"}}>Lider: {r.meta?.leader||"—"} · CCO: {r.meta?.cco||"—"}</div>
                    {r.meta?.signature&&<div style={{fontSize:11,color:"#94a3b8"}}>✍ {r.meta.signature}</div>}
                    <div style={{fontSize:11,color:h.inop>0?"#ef4444":"#22c55e",fontWeight:600}}>{h.inop>0?`${h.inop} inoperante(s)`:"✔ Tudo OK"}</div>
                  </div>
                </div>
                <div style={{marginTop:8,height:3,background:"#0f172a",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${h.pct}%`,background:color,borderRadius:2}}/>
                </div>
                <div style={{marginTop:10}}>
                  <button onClick={()=>setViewReport({project,report:r,idx:hist.length-1-i})}
                    style={{...S.secBtn,width:"100%",fontSize:13,padding:"10px"}}>
                    👁 Ver Relatório Completo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReportScreen({project, state, meta, photos, ctmkData={}, onBack, onHome}) {
  const ctmkInfo = (()=>{
    try {
      const c = ctmkData[project.id]; if(!c) return undefined;
      const days = c.status==="offline" && c.offlineSince ? Math.floor((Date.now()-new Date(c.offlineSince).getTime())/86400000) : null;
      return { status: c.status, days };
    } catch(e) { return undefined; }
  })();
  const [copied,setCopied]=useState(false);
  const [emailSent,setEmailSent]=useState(false);
  const [sending,setSending]=useState(false);
  const text=generateReportText(project,state,meta,photos);
  const subject=`[${project.id}] MokLog CheckTest – Teste Semanal – ${fmtDate(meta.date)}`;
  const handleWhatsApp=()=>{
    const h=computeHealth(project,state);
    const waIssues=[];
    for(const cat of project.categories){const s=state[cat.id];if(!s)continue;if(cat.type==="single"){const st=s.status??(s.ok===false?"inop":"ok");if(st!=="ok")waIssues.push(`• ${cat.label}: ${st==="partial"?"Parcial":"Inop"}`);}else if(cat.type==="items"){s.forEach((v,i)=>{const st=v.status??(v.ok===false?"inop":"ok");if(st!=="ok")waIssues.push(`• ${cat.itemLabels[i]}: ${st==="partial"?"Parcial":"Inop"}`);});}else if(cat.type==="count"){const inopN=s.inoperative?.length??0;if(inopN>0)waIssues.push(`• ${cat.label}: ${inopN} inop`);}}
    const inopText=waIssues.length>0?`\n\n*Itens com problema:*\n${waIssues.slice(0,10).join("\n")}${waIssues.length>10?`\n...+${waIssues.length-10} mais`:""}`:"\n\n✅ Todos os itens operando normalmente.";
    const msg=encodeURIComponent(`*[${project.id}] MokLog CheckTest – ${fmtDate(meta.date)}*\n📍 ${project.name}\n📊 Saúde: *${h.pct}%* | ✅ ${h.ok} OK | ⚠️ ${h.partial} Parcial | 🔴 ${h.inop} Inop\n👤 Líder: ${meta.leader||"—"} · CCO: ${meta.cco||"—"}\n✍️ Assinatura: ${meta.signature||"—"}`+inopText+`\n\n🔗 https://moklog-checktest.vercel.app\n_MokLog CheckTest © Moked Security_`);
    window.open(`https://wa.me/?text=${msg}`,"_blank");
  };
  const handleEmail=async()=>{
    setSending(true);
    const h=computeHealth(project,state);
    const issues=[];
    for(const cat of project.categories){const s=state[cat.id];if(!s)continue;if(cat.type==="single"){const st=s.status??(s.ok===false?"inop":"ok");if(st!=="ok")issues.push(`  • ${cat.label}: ${st==="partial"?"PARCIAL":"INOPERANTE"}${s.since?` desde ${fmtDate(s.since)}`:""} ${s.note?`- ${s.note}`:""}`);}else if(cat.type==="items"){s.forEach((v,i)=>{const st=v.status??(v.ok===false?"inop":"ok");if(st!=="ok")issues.push(`  • ${cat.label} / ${cat.itemLabels[i]}: ${st==="partial"?"PARCIAL":"INOPERANTE"}${v.since?` desde ${fmtDate(v.since)}`:""} ${v.note?`- ${v.note}`:""}`);});}else if(cat.type==="count"){(s.inoperative??[]).forEach(it=>issues.push(`  • ${cat.label} [${it.id||"?"}]${it.since?` desde ${fmtDate(it.since)}`:""} ${it.note?`- ${it.note}`:""}`));}}
    const msg=[`================================================`,"  MOKLOG CHECKTEST - RELATORIO DE TESTE SEMANAL","================================================",`Projeto  : ${project.id} - ${project.name}`,`Data     : ${fmtDate(meta.date)}`,`Lider    : ${meta.leader||"--"}`,`CCO      : ${meta.cco||"--"}`,`Assinatura: ${meta.signature||"--"}`,`Saude: ${h.pct}% | OK: ${h.ok} | Parcial: ${h.partial} | Inop: ${h.inop}`,issues.length>0?`\nProblemas:\n${issues.join("\n")}`:"Todos OK","\nhttps://moklog-checktest.vercel.app","================================================"].join("\n");
    const success=await sendEmailJS(subject,msg,`MokLog CheckTest – ${project.id}`);
    setSending(false);
    if(success)setEmailSent(true);else alert("Erro ao enviar. Verifique a conexao.");
  };
  return(
    <div style={S.page}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <button onClick={onBack} style={S.backBtn} aria-label="Voltar">← Voltar</button>
          <h2 style={{color:"#f1f5f9",fontSize:16,fontWeight:800,margin:0}}>Relatorio — {project.id}</h2>
          <HealthRing pct={computeHealth(project,state).pct} size={44}/>
        </div>
        <div style={{background:"#021a0d",border:"1px solid #22c55e",borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>✅</span>
          <div><div style={{fontSize:13,fontWeight:700,color:"#22c55e"}}>Relatorio finalizado!</div><div style={{fontSize:11,color:"#64748b"}}>Salvo · {fmtDate(meta.date)} · Assinado por {meta.signature||"—"}{meta.tempoPreenchimentoSeg?` · ⏱️ ${Math.floor(meta.tempoPreenchimentoSeg/60)}min${meta.tempoPreenchimentoSeg%60>0?String(meta.tempoPreenchimentoSeg%60).padStart(2,"0")+"s":""}`:""}</div></div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={async ()=>{ const [inquilinosInfo, energiaInfo] = await Promise.all([loadInquilinosParaPDF(project.id), loadEnergiaResumoParaPDF(project.id)]); generatePDF(project,state,meta,photos,ctmkInfo,inquilinosInfo,energiaInfo); }} style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#7c3aed,#6d28d9)",fontSize:13}}>📄 Exportar PDF</button>
          <button onClick={()=>{navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{...S.primaryBtn,flex:1,fontSize:13}}>{copied?"✓ Copiado!":"📋 Copiar Texto"}</button>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={handleEmail} disabled={sending||emailSent} style={{...S.primaryBtn,flex:1,background:emailSent?"linear-gradient(135deg,#16a34a,#15803d)":"linear-gradient(135deg,#059669,#047857)",fontSize:13,opacity:sending?0.7:1}}>{sending?"⟳ Enviando...":emailSent?"✓ Email Enviado!":"✉ Enviar Email"}</button>
          <button onClick={handleWhatsApp} style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#16a34a,#15803d)",fontSize:13}}>💬 WhatsApp</button>
        </div>
        <button onClick={onHome} style={{...S.secBtn,width:"100%",fontSize:13}}>🏠 Inicio</button>
        <div style={{background:"#f8fafc",borderRadius:10,padding:"14px 16px",border:"1px solid #e2e8f0",maxHeight:"45vh",overflowY:"auto",marginTop:12}}>
          <pre style={{margin:0,fontFamily:"'Courier New',monospace",fontSize:11,whiteSpace:"pre-wrap",color:"#1e293b",lineHeight:1.7}}>{text}</pre>
        </div>
      </div>
    </div>
  );
}

function ViewScreen({projectId, token, stored}) {
  const project = PROJECTS[projectId];
  const [validToken, setValidToken] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(()=>{
    const checkToken = async () => {
      try {
        const local = JSON.parse(localStorage.getItem("moklog_viewlinks")||"{}");
        if(local[projectId]) { setValidToken(local[projectId]); setChecking(false); return; }
      } catch(e){}
      try {
        const snap = await getDoc(doc(db,"config","viewlinks"));
        if(snap.exists()) {
          const data = snap.data();
          localStorage.setItem("moklog_viewlinks", JSON.stringify(data));
          setValidToken(data[projectId] || null);
        }
      } catch(e){}
      setChecking(false);
    };
    checkToken();
  },[projectId]);

  if(checking) return (
    <div style={{minHeight:"100vh",background:"#04080f",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontSize:13,color:"#94a3b8"}}>Verificando acesso...</div>
    </div>
  );
  if(!project || !validToken || (token !== validToken && token !== (projectId+"_"+validToken) && token !== validToken.split("_").pop())) {
    return(<div style={{...S.page,alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center",padding:32,color:"#94a3b8"}}><div style={{fontSize:40,marginBottom:12}}>🔒</div><div style={{fontSize:16,fontWeight:700,color:"#f1f5f9",marginBottom:8}}>Link invalido ou expirado</div><div style={{fontSize:13,color:"#94a3b8"}}>Solicite um novo link ao gestor.</div></div></div>);
  }
  const hist = stored[projectId]?.history??[];
  const last = hist.slice(-1)[0];
  if(!last) return(<div style={{...S.page,alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center",padding:32,color:"#94a3b8"}}><div style={{fontSize:40,marginBottom:12}}>📭</div><div style={{fontSize:16,color:"#f1f5f9"}}>Sem relatorios disponíveis ainda.</div></div></div>);
  const h = computeHealth(project, last.state);
  const issues = [];
  for(const cat of project.categories){const s=last.state[cat.id];if(!s)continue;if(cat.type==="single"){const st=s.status??(s.ok===false?"inop":"ok");if(st!=="ok")issues.push({cat:cat.label,item:"—",status:st,since:s.since,note:s.note});}else if(cat.type==="items"){s.forEach((v,i)=>{const st=v.status??(v.ok===false?"inop":"ok");if(st!=="ok")issues.push({cat:cat.label,item:cat.itemLabels[i],status:st,since:v.since,note:v.note});});}else if(cat.type==="count"){(s.inoperative??[]).forEach(it=>issues.push({cat:cat.label,item:it.id||"?",status:"inop",since:it.since,note:it.note}));}}
  return(
    <div style={S.page}>
      <div style={S.formWrap}>
        <div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:12,padding:"16px",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <MoklogLogo size={40}/>
            <div style={{flex:1}}><div style={{fontSize:15,fontWeight:800,color:"#f1f5f9"}}>MokLog CheckTest</div><div style={{fontSize:12,color:"#cc2222",fontWeight:700}}>{project.id} – {project.name}</div><div style={{fontSize:11,color:"#64748b"}}>Pendencias para manutencao · {fmtDate(last.meta?.date)}</div></div>
            <HealthRing pct={h.pct} size={52}/>
          </div>
        </div>
        <div style={{fontSize:12,fontWeight:700,color:"#f1f5f9",marginBottom:8}}>Itens com Pendencia ({issues.length})</div>
        {issues.length===0&&<div style={{textAlign:"center",padding:"20px",color:"#22c55e",fontSize:13}}>✔ Nenhuma pendencia ativa</div>}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {issues.map((iss,i)=>(
            <div key={i} style={{background:"#060c18",border:`1px solid ${iss.status==="partial"?"#f59e0b33":"#ef444433"}`,borderRadius:8,padding:"10px 12px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:iss.status==="partial"?"#f59e0b":"#ef4444",background:iss.status==="partial"?"#fef3c7":"#fee2e2",padding:"2px 6px",borderRadius:8}}>{iss.status==="partial"?"PARCIAL":"INOP"}</span>
                <span style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>{iss.cat}</span>
              </div>
              {iss.item&&iss.item!=="—"&&<div style={{fontSize:11,color:"#94a3b8",marginBottom:2}}>Item: {iss.item}</div>}
              {iss.since&&<div style={{fontSize:11,color:"#94a3b8"}}>Desde: {fmtDate(iss.since)}</div>}
              {iss.note&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{iss.note}</div>}
            </div>
          ))}
        </div>
        <div style={{marginTop:16,fontSize:11,color:"#94a3b8",textAlign:"center"}}>MokLog CheckTest © Moked Security Consulting · Somente leitura</div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────


function EquipamentosListagem({ dark, onBack, onToggleTheme, onOpenEquip }) {
  const bg=dark?"#04080f":"#f1f5f9";
  const cardBg=dark?"#060c18":"#ffffff";
  const border=dark?"#0f172a":"#e2e8f0";
  const txt=dark?"#f1f5f9":"#0f172a";
  const txt2=dark?"#64748b":"#94a3b8";
  const hdrBg=dark?"#04080f":"#f8fafc";
  const hdrBorder=dark?"#0a0f1e":"#e2e8f0";
  const backBtn={background:"transparent",border:`1px solid ${border}`,color:txt2,borderRadius:7,padding:"7px 12px",fontSize:12,cursor:"pointer",flexShrink:0,fontWeight:600};

  const allProjects = [
    ...Object.values(PROJECTS),
    {id:"P260A",name:"Jatinox Unidade A"},{id:"P260B",name:"Jatinox Unidade B"},{id:"P260C",name:"Jatinox Unidade C"}
  ];

  const [equipData, setEquipData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    const loadAll = async () => {
      const results = {};
      for(const p of allProjects) {
        try {
          const local = localStorage.getItem(`equipamentos_${p.id}`);
          if(local) results[p.id] = JSON.parse(local);
        } catch(e){}
      }
      setEquipData(results);
      setLoading(false);
    };
    loadAll();
  },[]);

  const countProblemas = (data) => {
    if(!data) return {inop:0,parcial:0,total:0};
    const all = [...(data.smartphones||[]),...(data.radiosHT||[]),...(data.armamento||[]),...(data.municao||[]),...(data.placas||[]),...(data.lanternas||[]),...(data.ztrax||[]),...(data.bodycam||[]),...(data.moto?[data.moto]:[])];
    return {
      inop:   all.filter(i=>i.status==="inop"||i.status==="critico").length,
      parcial:all.filter(i=>i.status==="parcial"||i.status==="baixo").length,
      total:  all.length,
    };
  };

  return (
    <div style={{minHeight:"100vh",background:bg,display:"flex",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif",paddingBottom:60}}>
      <div style={{width:"100%",maxWidth:480}}>
        <div style={{position:"sticky",top:0,zIndex:10,background:hdrBg,borderBottom:`1px solid ${hdrBorder}`,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onBack} style={backBtn} aria-label="Voltar">← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,color:txt}}>🛡️ Equipamentos</div>
              <div style={{fontSize:11,color:txt2}}>Todos os projetos</div>
            </div>
            <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${border}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,color:txt2}} aria-label="Alternar tema claro/escuro">{dark?"☀️":"🌙"}</button>
          </div>
        </div>

        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
          {loading ? (
            <div style={{textAlign:"center",padding:"40px 0",color:txt2}}>Carregando...</div>
          ) : (
            allProjects.map(p => {
              const d = equipData[p.id];
              const {inop,parcial,total} = countProblemas(d);
              const hasProb = inop>0||parcial>0;
              return (
                <button key={p.id} onClick={()=>onOpenEquip(p)}
                  style={{background:cardBg,border:`2px solid ${hasProb?inop>0?"#ef444444":"#f59e0b44":border}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:44,height:44,borderRadius:10,background:hasProb?inop>0?"#1a0202":"#1a1000":"#021a0d",border:`1px solid ${hasProb?inop>0?"#ef444433":"#f59e0b33":"#22c55e33"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20}}>
                    🛡️
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:800,color:txt}}>{p.id}</div>
                    <div style={{fontSize:11,color:txt2}}>{p.name}</div>
                    {total>0?(
                      <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,fontWeight:700,color:"#0ea5e9",background:"#001a2e",padding:"1px 6px",borderRadius:4}}>{total} itens</span>
                        {inop>0&&<span style={{fontSize:11,fontWeight:700,color:"#ef4444",background:"#1a0202",padding:"1px 6px",borderRadius:4}}>🔴 {inop} inop</span>}
                        {parcial>0&&<span style={{fontSize:11,fontWeight:700,color:"#f59e0b",background:"#1a1000",padding:"1px 6px",borderRadius:4}}>⚠️ {parcial} parcial</span>}
                        {!hasProb&&<span style={{fontSize:11,fontWeight:700,color:"#22c55e",background:"#021a0d",padding:"1px 6px",borderRadius:4}}>✅ OK</span>}
                      </div>
                    ):(
                      <div style={{fontSize:11,color:txt2,marginTop:3}}>Sem itens cadastrados</div>
                    )}
                  </div>
                  <span style={{color:txt2,fontSize:16}}>›</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function RegistrosMenu({ dark, stored, onToggleTheme, onAcessos, onEquipe, onEquipamentos, onBack }) {
  const [subScreen, setSubScreen] = useState(null);
  const [selProject, setSelProject] = useState(null);
  const [pinAuth, setPinAuth] = useState(()=>hasGerencial());
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [equipPinAuth, setEquipPinAuth] = useState(()=>hasGerencial());
  const [equipPinInput, setEquipPinInput] = useState("");
  const [equipPinErr, setEquipPinErr] = useState(false);

  const bg   = dark ? "#04080f" : "#f1f5f9";
  const cardBg = dark ? "#060c18" : "#ffffff";
  const border = dark ? "#0f172a" : "#e2e8f0";
  const txt  = dark ? "#f1f5f9" : "#0f172a";
  const txt2 = dark ? "#64748b" : "#94a3b8";
  const hdrBg = dark ? "#04080f" : "#f8fafc";
  const hdrBorder = dark ? "#0a0f1e" : "#e2e8f0";
  const backBtn = { background:"transparent", border:`1px solid ${border}`, color:txt2, borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 };

  const JATINOX_LIST = [
    { id:"P260B", name:"Jatinox Unidade B" },
    { id:"P260C", name:"Jatinox Unidade C" },
  ];
  const allProjects = [...Object.values(PROJECTS), ...JATINOX_LIST];

  // Estatísticas do dashboard (Colaboradores + Equipamentos) — Firestore com fallback localStorage
  const [dashStats, setDashStats] = useState(null);
  useEffect(()=>{
    let alive = true;
    (async()=>{
      const hoje = new Date().toLocaleDateString("sv-SE");
      let ativos=0, feriasHoje=0, projsColab=0, inop=0, parcial=0, totalEquip=0, projsEquip=0;
      await Promise.all(allProjects.map(async p=>{
        let eqData=null;
        try{ const snap=await getDoc(doc(db,"equipes",p.id)); if(snap.exists()) eqData=snap.data(); }catch(e){}
        if(!eqData){ try{ const l=localStorage.getItem(`equipe_${p.id}`); if(l) eqData=JSON.parse(l); }catch(e){} }
        if(eqData){
          const cols=(eqData.colaboradores||[]).filter(c=>c.status==="ativo");
          if(cols.length>0) projsColab++;
          ativos+=cols.length;
          (Array.isArray(eqData.ferias)?eqData.ferias:[]).forEach(f=>{
            if(f&&f.dataInicio&&f.dataRetorno&&f.dataInicio<=hoje&&hoje<=f.dataRetorno) feriasHoje++;
          });
        }
        let eqpData=null;
        try{ const snap=await getDoc(doc(db,"equipamentos",p.id)); if(snap.exists()) eqpData=snap.data(); }catch(e){}
        if(!eqpData){ try{ const l=localStorage.getItem(`equipamentos_${p.id}`); if(l) eqpData=JSON.parse(l); }catch(e){} }
        if(eqpData){
          let tem=false;
          const contar=(it)=>{
            if(!it||typeof it!=="object"||!it.status) return;
            tem=true; totalEquip++;
            if(it.status==="inop"||it.status==="critico") inop++;
            else if(it.status==="parcial"||it.status==="baixo") parcial++;
          };
          Object.values(eqpData).forEach(v=>{ if(Array.isArray(v)) v.forEach(contar); });
          if(eqpData.moto) contar(eqpData.moto);
          if(tem) projsEquip++;
        }
      }));
      if(alive) setDashStats({ativos, feriasHoje, projsColab, inop, parcial, totalEquip, projsEquip});
    })();
    return ()=>{ alive=false; };
  },[]);

  if(subScreen==="colaboradores" && selProject) {
    return (
      <EquipeReadOnly project={selProject} dark={dark} stored={stored}
        onBack={()=>{ setSelProject(null); }}
        onToggleTheme={onToggleTheme}
        onOpenFull={()=>onEquipe(selProject)}/>
    );
  }

  if(subScreen==="equipamentos" && !equipPinAuth && !hasGerencial()) {
    const bg=dark?"#04080f":"#f1f5f9";
    const cardBg=dark?"#060c18":"#ffffff";
    const border=dark?"#0f172a":"#e2e8f0";
    const txt=dark?"#f1f5f9":"#0f172a";
    const txt2=dark?"#64748b":"#94a3b8";
    return (
      <div style={{minHeight:"100vh",background:bg,display:"flex",justifyContent:"center",alignItems:"center",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
        <div style={{background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:"28px 24px",maxWidth:320,width:"100%",textAlign:"center",margin:16}}>
          <div style={{fontSize:32,marginBottom:8}}>🛡️</div>
          <div style={{fontSize:16,fontWeight:800,color:txt,marginBottom:4}}>Equipamentos</div>
          <div style={{fontSize:12,color:txt2,marginBottom:20}}>PIN gerencial para ver todos os projetos</div>
          <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={equipPinInput}
            onChange={e=>{setEquipPinInput(e.target.value);setEquipPinErr(false);}}
            onKeyDown={e=>{if(e.key==="Enter"){if(checkPin(equipPinInput,{})){setEquipPinAuth(true);}else setEquipPinErr(true);}}}
            style={{width:"100%",background:dark?"#020510":"#fff",border:`1px solid ${equipPinErr?"#ef4444":border}`,borderRadius:7,color:txt,padding:"12px",fontSize:22,letterSpacing:10,textAlign:"center",boxSizing:"border-box",outline:"none",marginBottom:8}}/>
          {equipPinErr && <div role="alert" style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setSubScreen(null);setEquipPinInput("");setEquipPinErr(false);}}
              style={{flex:1,background:dark?"#060c18":"#f8fafc",color:txt2,border:`1px solid ${border}`,borderRadius:10,padding:"12px",fontSize:13,fontWeight:600,cursor:"pointer"}} aria-label="Voltar">
              ← Voltar
            </button>
            <button onClick={()=>{if(checkPin(equipPinInput,{})){setEquipPinAuth(true);}else setEquipPinErr(true);}}
              style={{flex:1,background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if(subScreen==="equipamentos" && (equipPinAuth||hasGerencial())) {
    return <EquipamentosListagem dark={dark} stored={stored} onToggleTheme={onToggleTheme}
      onBack={()=>{setSubScreen(null);setEquipPinAuth(false);setEquipPinInput("");}}
      onOpenEquip={onEquipamentos}/>;
  }

  if(subScreen==="colaboradores" && !pinAuth && !hasGerencial()) {
    return (
      <div style={{ minHeight:"100vh", background:bg, display:"flex", justifyContent:"center", alignItems:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
        <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:16, padding:"28px 24px", maxWidth:320, width:"100%", textAlign:"center", margin:16 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🔐</div>
          <div style={{ fontSize:16, fontWeight:800, color:txt, marginBottom:4 }}>Área Restrita</div>
          <div style={{ fontSize:12, color:txt2, marginBottom:20 }}>Insira o PIN gerencial para ver os colaboradores</div>
          <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pinInput}
            onChange={e=>{ setPinInput(e.target.value); setPinErr(false); }}
            onKeyDown={e=>{ if(e.key==="Enter"){ if(checkPin(pinInput,{})){setPinAuth(true);}else setPinErr(true); } }}
            style={{ width:"100%", background:dark?"#020510":"#fff", border:`1px solid ${pinErr?"#ef4444":border}`, borderRadius:7, color:txt, padding:"12px", fontSize:22, letterSpacing:10, textAlign:"center", boxSizing:"border-box", outline:"none", marginBottom:8 }}/>
          {pinErr && <div role="alert" style={{ fontSize:12, color:"#ef4444", marginBottom:8 }}>PIN incorreto</div>}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>{ setSubScreen(null); setPinInput(""); setPinErr(false); }}
              style={{ flex:1, background:dark?"#060c18":"#f8fafc", color:txt2, border:`1px solid ${border}`, borderRadius:10, padding:"12px", fontSize:13, fontWeight:600, cursor:"pointer" }} aria-label="Voltar">
              ← Voltar
            </button>
            <button onClick={()=>{ if(checkPin(pinInput,{})){setPinAuth(true);}else setPinErr(true); }}
              style={{ flex:1, background:"linear-gradient(135deg,#1d4ed8,#1e40af)", color:"#fff", border:"none", borderRadius:10, padding:"12px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if(subScreen==="colaboradores") {
    return (
      <div style={{ minHeight:"100vh", background:bg, display:"flex", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
        <div style={{ width:"100%", maxWidth:480, display:"flex", flexDirection:"column" }}>
          <div style={{ position:"sticky", top:0, zIndex:10, background:hdrBg, borderBottom:`1px solid ${hdrBorder}`, padding:"14px 16px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={()=>setSubScreen(null)} style={backBtn} aria-label="Voltar">← Voltar</button>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:txt }}>👥 Colaboradores</div>
                <div style={{ fontSize:11, color:txt2 }}>Selecione o projeto</div>
              </div>
              <button onClick={onToggleTheme} style={{ background:"transparent", border:`1px solid ${border}`, borderRadius:8, padding:"5px 10px", cursor:"pointer", fontSize:14, color:txt2 }} aria-label="Alternar tema claro/escuro">{dark?"☀️":"🌙"}</button>
            </div>
          </div>
          <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:8 }}>
            {allProjects.map(p => {
              const hist = stored[p.id]?.history ?? [];
              let colabCount = null;
              try {
                const local = localStorage.getItem(`equipe_${p.id}`);
                if(local) { const d=JSON.parse(local); colabCount=(d.colaboradores||[]).filter(c=>c.status==="ativo").length; }
              } catch(e){}
              return (
                <button key={p.id} onClick={()=>{ setSelProject(p); }}
                  style={{ background:cardBg, border:`1px solid ${colabCount>0?"#0ea5e944":border}`, borderRadius:12, padding:"14px 16px", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:42, height:42, borderRadius:10, background: dark?"#0f172a":"#f1f5f9", border:`1px solid ${border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <span style={{ fontSize:18 }}>👥</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:txt }}>{p.id}</div>
                    <div style={{ fontSize:11, color:txt2 }}>{p.name||""}</div>
                  </div>
                  {colabCount!==null && colabCount>0
                    ? <span style={{ fontSize:11, fontWeight:700, color:"#0ea5e9", background:"#001a2e", padding:"3px 10px", borderRadius:8, flexShrink:0 }}>{colabCount} ativo(s)</span>
                    : <span style={{ color:txt2, fontSize:16 }}>›</span>
                  }
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:bg, display:"flex", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ width:"100%", maxWidth:480, display:"flex", flexDirection:"column" }}>
        <div style={{ position:"sticky", top:0, zIndex:10, background:hdrBg, borderBottom:`1px solid ${hdrBorder}`, padding:"14px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onBack} style={backBtn} aria-label="Voltar ao início">← Início</button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:txt }}>📋 Registros</div>
              <div style={{ fontSize:11, color:txt2 }}>Colaboradores e Acessos</div>
            </div>
            <button onClick={onToggleTheme} style={{ background:"transparent", border:`1px solid ${border}`, borderRadius:8, padding:"5px 10px", cursor:"pointer", fontSize:14, color:txt2 }} aria-label="Alternar tema claro/escuro">{dark?"☀️":"🌙"}</button>
          </div>
        </div>

        <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:12 }}>
          <style>{`@keyframes regPulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes mkFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes mkBadgePulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
          {(()=>{
            const st = dashStats;
            const disp = st&&st.ativos>0 ? Math.round(((st.ativos-st.feriasHoje)/st.ativos)*100) : null;
            const okPct = st&&st.totalEquip>0 ? Math.round(((st.totalEquip-st.inop-st.parcial)/st.totalEquip)*100) : null;
            const Badge = ({cor,pulse,children}) => (
              <span style={{fontSize:11,fontWeight:800,color:cor,background:cor+"1c",border:`1px solid ${cor}44`,padding:"3px 10px",borderRadius:7,animation:pulse?"mkBadgePulse 1.8s ease-in-out infinite":"none"}}>{children}</span>
            );
            const Bar = ({pct,cor}) => (
              <div style={{width:"100%",height:5,borderRadius:3,background:dark?"#0a0f1e":"#e2e8f0",overflow:"hidden",marginTop:9}}>
                <div style={{width:`${pct}%`,height:"100%",borderRadius:3,background:`linear-gradient(90deg,${cor}99,${cor})`,boxShadow:`0 0 8px ${cor}55`,transition:"width .5s ease"}}/>
              </div>
            );
            return (<>
            <button onClick={()=>{ setPinAuth(false); setPinInput(""); setPinErr(false); setSubScreen("colaboradores"); }}
              style={{ background:dark?"linear-gradient(135deg,#07101f,#060c18)":cardBg, border:`2px solid ${dark?"#0ea5e94d":"#bae6fd"}`, borderRadius:16, padding:"18px 20px", cursor:"pointer", textAlign:"left",
                boxShadow:dark?"0 0 16px #0ea5e918, inset 0 1px 0 #0ea5e922":"none", animation:"mkFadeIn .35s ease both" }}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{ width:54, height:54, borderRadius:14, background: dark?"#001a2e":"#e0f2fe", border:`1px solid ${dark?"#0ea5e955":"#7dd3fc"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:dark?"0 0 10px #0ea5e922":"none" }}>
                  <span style={{ fontSize:25 }}>👥</span>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:dark?"#0ea5e9":"#0369a1" }}>Colaboradores</div>
                  <div style={{ fontSize:11, color:txt2, marginTop:2 }}>{st?`${st.projsColab} projeto(s) com equipe cadastrada`:"Carregando equipes..."}</div>
                </div>
                <span style={{ color:txt2, fontSize:20, flexShrink:0 }}>›</span>
              </div>
              {st&&(
                <>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:11}}>
                    <Badge cor="#22c55e">🟢 {st.ativos} ativo(s)</Badge>
                    <Badge cor="#0ea5e9">🏖️ {st.feriasHoje} em férias</Badge>
                  </div>
                  {disp!==null&&(
                    <>
                      <Bar pct={disp} cor="#0ea5e9"/>
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                        <span style={{fontSize:9,color:txt2,fontWeight:700}}>DISPONIBILIDADE HOJE</span>
                        <span style={{fontSize:9,fontWeight:800,color:"#0ea5e9"}}>{disp}%</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </button>

            <button onClick={()=>{setEquipPinAuth(false);setEquipPinInput("");setEquipPinErr(false);setSubScreen("equipamentos");}}
              style={{ background:dark?"linear-gradient(135deg,#120d02,#060c18)":cardBg, border:`2px solid ${st&&st.inop>0?"#ef444466":(dark?"#f59e0b4d":"#fde68a")}`, borderRadius:16, padding:"18px 20px", cursor:"pointer", textAlign:"left",
                boxShadow:st&&st.inop>0?"0 0 16px #ef444433":(dark?"0 0 16px #f59e0b14, inset 0 1px 0 #f59e0b22":"none"), animation:"mkFadeIn .35s ease both", animationDelay:"60ms" }}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{ width:54, height:54, borderRadius:14, background: dark?"#1a1000":"#fffbeb", border:`1px solid ${dark?"#f59e0b55":"#fcd34d"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:dark?"0 0 10px #f59e0b22":"none", position:"relative" }}>
                  <span style={{ fontSize:25 }}>🛡️</span>
                  {st&&st.inop>0&&<span style={{position:"absolute",top:-3,right:-3,width:10,height:10,borderRadius:"50%",background:"#ef4444",boxShadow:"0 0 6px #ef4444",animation:"regPulse 1.4s ease-in-out infinite"}}/>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:dark?"#f59e0b":"#d97706" }}>Equipamentos</div>
                  <div style={{ fontSize:11, color:txt2, marginTop:2 }}>{st?`${st.projsEquip} projeto(s) com inventário · ${st.totalEquip} item(ns)`:"Carregando inventário..."}</div>
                </div>
                <span style={{ color:txt2, fontSize:20, flexShrink:0 }}>›</span>
              </div>
              {st&&(
                <>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:11}}>
                    {st.inop===0&&st.parcial===0
                      ? <Badge cor="#22c55e">✅ Tudo operacional</Badge>
                      : (<>
                          {st.inop>0&&<Badge cor="#ef4444" pulse>🔴 {st.inop} inop</Badge>}
                          {st.parcial>0&&<Badge cor="#f59e0b">⚠️ {st.parcial} parcial</Badge>}
                        </>)
                    }
                  </div>
                  {okPct!==null&&(
                    <>
                      <Bar pct={okPct} cor={okPct>=90?"#22c55e":okPct>=70?"#f59e0b":"#ef4444"}/>
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                        <span style={{fontSize:9,color:txt2,fontWeight:700}}>OPERACIONAIS</span>
                        <span style={{fontSize:9,fontWeight:800,color:okPct>=90?"#22c55e":okPct>=70?"#f59e0b":"#ef4444"}}>{okPct}%</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </button>
            </>);
          })()}
        </div>
      </div>
    </div>
  );
}

function EquipeReadOnly({ project, dark, stored, onBack, onToggleTheme, onOpenFull }) {
  const [equipeData, setEquipeData] = useState(null);
  const [loading, setLoading] = useState(true);

  const bg   = dark ? "#04080f" : "#f1f5f9";
  const cardBg = dark ? "#060c18" : "#ffffff";
  const border = dark ? "#0f172a" : "#e2e8f0";
  const txt  = dark ? "#f1f5f9" : "#0f172a";
  const txt2 = dark ? "#64748b" : "#94a3b8";
  const hdrBg = dark ? "#04080f" : "#f8fafc";
  const hdrBorder = dark ? "#0a0f1e" : "#e2e8f0";
  const backBtn = { background:"transparent", border:`1px solid ${border}`, color:txt2, borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 };

  const TURNO_CONFIG = {
    "Diurno":    { bg:"#1a2e1a", border:"#22c55e33", badge:"#22c55e", icon:"☀️" },
    "Noturno":   { bg:"#0a0a2e", border:"#6366f133", badge:"#818cf8", icon:"🌙" },
    "Folguista": { bg:"#1a1a10", border:"#f59e0b33", badge:"#f59e0b", icon:"☀️🌙" },
    "Diurno A":  { bg:"#1a2e1a", border:"#22c55e33", badge:"#22c55e", icon:"☀️" },
    "Noturno A": { bg:"#0a0a2e", border:"#6366f133", badge:"#818cf8", icon:"🌙" },
    "Diurno B":  { bg:"#1a2a10", border:"#84cc1633", badge:"#a3e635", icon:"🌤️" },
    "Noturno B": { bg:"#0f0a2a", border:"#a855f733", badge:"#c084fc", icon:"🌃" },
  };
  const TURNOS = ["Diurno","Noturno","Folguista","Diurno A","Noturno A","Diurno B","Noturno B"];

  useEffect(()=>{
    const load = async () => {
      try {
        const { initializeApp, getApps } = await import("firebase/app");
        const { getFirestore, doc, getDoc } = await import("firebase/firestore");
        const firebaseConfig = {
          apiKey:"AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
          authDomain:"moklog-checktest.firebaseapp.com",
          projectId:"moklog-checktest",
          storageBucket:"moklog-checktest.firebasestorage.app",
          messagingSenderId:"390165325023",
          appId:"1:390165325023:web:3147cd333503916b0d756a"
        };
        const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        const db = getFirestore(fbApp);
        const snap = await getDoc(doc(db,"equipes",project.id));
        if(snap.exists()) { setEquipeData(snap.data()); setLoading(false); return; }
      } catch(e){}
      try {
        const local = localStorage.getItem(`equipe_${project.id}`);
        if(local) { setEquipeData(JSON.parse(local)); setLoading(false); return; }
      } catch(e){}
      setEquipeData({ colaboradores:[], desligados:[] });
      setLoading(false);
    };
    load();
  },[project.id]);

  if(loading) return (
    <div style={{ minHeight:"100vh", background:bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:28, marginBottom:8 }}>👥</div>
        <div style={{ fontSize:13, color:txt2 }}>Carregando equipe...</div>
      </div>
    </div>
  );

  const ativos = (equipeData?.colaboradores||[]).filter(c=>c.status==="ativo");
  const turnos = TURNOS.filter(t=>ativos.some(c=>c.turno===t));

  const fmtDate = (d) => { if(!d) return "--"; try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; } };

  return (
    <div style={{ minHeight:"100vh", background:bg, display:"flex", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif", paddingBottom:60 }}>
      <div style={{ width:"100%", maxWidth:480 }}>
        <div style={{ position:"sticky", top:0, zIndex:10, background:hdrBg, borderBottom:`1px solid ${hdrBorder}`, padding:"14px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onBack} style={backBtn} aria-label="Voltar">← Voltar</button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:txt }}>👥 {project.id}</div>
              <div style={{ fontSize:11, color:txt2 }}>{project.name} · {ativos.length} ativo(s)</div>
            </div>
            <button onClick={onToggleTheme} style={{ background:"transparent", border:`1px solid ${border}`, borderRadius:8, padding:"5px 10px", cursor:"pointer", fontSize:14, color:txt2 }} aria-label="Alternar tema claro/escuro">{dark?"☀️":"🌙"}</button>
          </div>
        </div>

        <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>

          {turnos.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(turnos.length,3)},1fr)`, gap:8 }}>
              {turnos.map(t=>{
                const tc = TURNO_CONFIG[t] || TURNO_CONFIG["Diurno"];
                const count = ativos.filter(c=>c.turno===t).length;
                return (
                  <div key={t} style={{ background:tc.bg, border:`1px solid ${tc.border}`, borderRadius:10, padding:"10px 12px", textAlign:"center" }}>
                    <div style={{ fontSize:16, marginBottom:2 }}>{tc.icon}</div>
                    <div style={{ fontSize:11, fontWeight:700, color:tc.badge }}>{t}</div>
                    <div style={{ fontSize:11, color:txt2, marginTop:2 }}>{count}</div>
                  </div>
                );
              })}
            </div>
          )}

          {ativos.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>👥</div>
              <div style={{ fontSize:14, color:txt }}>Equipe vazia</div>
              <div style={{ fontSize:12, color:txt2, marginTop:4 }}>Nenhum colaborador cadastrado</div>
            </div>
          ) : (
            <>
              {turnos.map(turno=>{
                const tc = TURNO_CONFIG[turno] || TURNO_CONFIG["Diurno"];
                const cols = ativos.filter(c=>c.turno===turno);
                if(!cols.length) return null;
                return (
                  <div key={turno} style={{ borderRadius:12, overflow:"hidden", border:`1px solid ${tc.border}` }}>
                    <div style={{ background:tc.bg, padding:"10px 14px", display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:15 }}>{tc.icon}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:tc.badge }}>{turno}</span>
                      <span style={{ fontSize:11, color:txt2, background: dark?"#0a0f1e":"#f1f5f9", padding:"2px 8px", borderRadius:10 }}>{cols.length}</span>
                    </div>
                    <div style={{ background: dark?"#04080f":"#f8fafc", padding:"8px" }}>
                      {cols.map(c=>{
                        const faltas = (c.historico||[]).filter(h=>h.tipo==="Falta").length;
                        const fts    = (c.historico||[]).filter(h=>h.tipo==="FT").length;
                        const mds    = (c.historico||[]).filter(h=>h.tipo==="Medida Disciplinar").length;
                        return (
                          <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, background:cardBg, borderRadius:10, padding:"10px 12px", marginBottom:6, border:`1px solid ${tc.border}` }}>
                            <div style={{ width:44, height:44, borderRadius:10, overflow:"hidden", border:`2px solid ${tc.badge}44`, flexShrink:0, background: dark?"#0f172a":"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {c.foto ? <img src={c.foto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <span style={{ fontSize:20 }}>👤</span>}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:700, color:txt, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.nome}</div>
                              <div style={{ fontSize:11, color:txt2 }}>{c.cargo}</div>
                              <div style={{ display:"flex", gap:5, marginTop:3, flexWrap:"wrap" }}>
                                {c.escala && <span style={{ fontSize:11, color:"#0ea5e9", background: dark?"#001a2e":"#e0f2fe", padding:"1px 6px", borderRadius:4, fontWeight:700 }}>{c.escala}</span>}
                                {c.telefone && <span style={{ fontSize:11, color:txt2 }}>📱 {c.telefone}</span>}
                                {c.dataContratacao && <span style={{ fontSize:11, color:txt2 }}>📅 {fmtDate(c.dataContratacao)}</span>}
                              </div>
                            </div>
                            <div style={{ flexShrink:0, textAlign:"right" }}>
                              {faltas>0 && <div style={{ fontSize:11, color:"#ef4444", fontWeight:700 }}>{faltas}F</div>}
                              {fts>0    && <div style={{ fontSize:11, color:"#f59e0b", fontWeight:700 }}>{fts}FT</div>}
                              {mds>0    && <div style={{ fontSize:11, color:"#a855f7", fontWeight:700 }}>{mds}MD</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {ativos.filter(c=>!TURNOS.includes(c.turno)).map(c=>(
                <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, background:cardBg, borderRadius:10, padding:"10px 12px", border:`1px solid ${border}` }}>
                  <div style={{ width:44, height:44, borderRadius:10, overflow:"hidden", border:`2px solid ${border}`, flexShrink:0, background: dark?"#0f172a":"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {c.foto ? <img src={c.foto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <span style={{ fontSize:20 }}>👤</span>}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:txt }}>{c.nome}</div>
                    <div style={{ fontSize:11, color:txt2 }}>{c.cargo}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DemoBanner(){
  if(!isDemo()) return null;
  return (
    <div style={{
      position:"fixed", top:0, left:0, right:0, zIndex:9999,
      background:"linear-gradient(90deg,#7c3aed,#a855f7)", color:"#fff",
      textAlign:"center", fontSize:12, fontWeight:800, letterSpacing:.3,
      padding:"7px 10px", boxShadow:"0 2px 8px rgba(0,0,0,.4)",
    }}>
      🎭 MODO DEMONSTRAÇÃO — nenhuma alteração será salva
    </div>
  );
}

export default function App(){
  const [screen,setScreen]=useState("home");
  // ── Auth anônimo: acompanha se o crachá já chegou. NÃO bloqueia a UI
  // (failsafe): se demorar/falhar, o app segue — a regra ainda é `if true`.
  const [authReady,setAuthReady]=useState(false);
  useEffect(()=>{
    ensureAnonAuth();
    const unsub = onAuthStateChanged(auth, (u)=>{ if(u) setAuthReady(true); });
    // failsafe: libera após 4s mesmo sem confirmação, para nunca travar em campo
    const t = setTimeout(()=>setAuthReady(true), 4000);
    return ()=>{ unsub && unsub(); clearTimeout(t); };
  },[]);
  const [editingIdx,setEditingIdx]=useState(null);
  const isOnline = useOnlineStatus();
  const [showAcesso,setShowAcesso]=useState(false);
  const [acessoScreen,setAcessoScreen]=useState("menu");
  const [dark,setDark]=useState(true);
  const [showRegistros,setShowRegistros]=useState(false);
  const [showAcessoCCO,setShowAcessoCCO]=useState(false);
  const [acessoCCOProject,setAcessoCCOProject]=useState(null);
  const [acessoCCOAbas,setAcessoCCOAbas]=useState(null); // filtro de abas p/ Jatinox B/C (Supervisão+Manutenção)
  const [showOcorrencias,setShowOcorrencias]=useState(false);
  const [ocorrenciasProject,setOcorrenciasProject]=useState(null);
  const [rsCounts,setRsCounts]=useState({}); // { pid: { total, naoVistas } }
  const [rsTotalGeral,setRsTotalGeral]=useState(0); // acumulado de TODAS as RS (visao gerencial)
  // Carrega contagens de RS de todos os projetos elegiveis (todos menos P260B).
  const carregarRsCounts = React.useCallback(async ()=>{
    try {
      const ids = Object.keys(PROJECTS).filter(pid=>pid!=="P260B");
      const snaps = await Promise.all(ids.map(pid=>getDoc(doc(db,"ocorrencias",pid)).catch(()=>null)));
      const counts = {}; let geral = 0;
      ids.forEach((pid,i)=>{
        const regs = snaps[i]&&snaps[i].exists() ? (snaps[i].data().registros||[]) : [];
        const total = regs.length;
        const naoVistas = regs.filter(r=>!r.vistaGerencial).length;
        counts[pid] = { total, naoVistas };
        geral += total;
      });
      setRsCounts(counts);
      setRsTotalGeral(geral);
    } catch(e){ console.error("RS counts load error:", e); }
  },[]);
  useEffect(()=>{
    carregarRsCounts();
    // Ao voltar do módulo RS, recarrega de novo após breve atraso (propagação do Firestore).
    let t;
    if(!showOcorrencias){ t = setTimeout(carregarRsCounts, 1200); }
    return ()=>{ if(t) clearTimeout(t); };
  },[showOcorrencias, carregarRsCounts]);

  const [showEmpresaInfo,setShowEmpresaInfo]=useState(false);
  const [empresaInfoProject,setEmpresaInfoProject]=useState(null);
  const [showEquipamentos,setShowEquipamentos]=useState(false);
  const [equipamentosProject,setEquipamentosProject]=useState(null);
  const [showVisita,setShowVisita]=useState(false);
  const [showBolsao,setShowBolsao]=useState(false);
  const [bolsaoProject,setBolsaoProject]=useState(null);
  const [showRondaVSPP,setShowRondaVSPP]=useState(false);
  const [showInquilinos,setShowInquilinos]=useState(false);
  const [inquilinosProject,setInquilinosProject]=useState(null);
  const [visitaProject,setVisitaProject]=useState(null);
  const [showPerimetral,setShowPerimetral]=useState(false);
  const [showIluminacao,setShowIluminacao]=useState(false);
  const [iluminacaoProject,setIluminacaoProject]=useState(null);
  const [showRonda,setShowRonda]=useState(false);
  const [rondaProject,setRondaProject]=useState(null);
  const [showBolsaoInq,setShowBolsaoInq]=useState(false);
  const [bolsaoInqProject,setBolsaoInqProject]=useState(null);
  const [showEnergia,setShowEnergia]=useState(false);
  const [energiaProject,setEnergiaProject]=useState(null);
  const [perimetralProject,setPerimetralProject]=useState(null);
  const [showKeyAccess,setShowKeyAccess]=useState(false); // 🚨 KeyAccess Falha (em construção)
  const [showIntervalos,setShowIntervalos]=useState(false);
  const [intervalosProject,setIntervalosProject]=useState(null);
  const [showCCO,setShowCCO]=useState(false);
  const [ccoProject,setCcoProject]=useState(null);
  const [showEquipe,setShowEquipe]=useState(false);
  const [equipeProject,setEquipeProject]=useState(null);
  const [homeGroup,setHomeGroup]=useState(null);
  const [jatinoxSel,setJatinoxSel]=useState(null);
  const [project,setProject]=useState(PROJECTS.P601);
  const [state,setState]=useState(null);
  const [meta,setMeta]=useState({date:todayStr(),start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:""});
  const [stored,setStored]=useState({});
  const [ctmkData,setCtmkData]=useState({});
  const [crashed,setCrashed]=useState(false);

  useEffect(()=>{
    window.onerror=()=>{ setCrashed(true); return true; };
    return ()=>{ window.onerror=null; };
  },[]);

  const [photos,setPhotos]=useState([]);
  const [active,setActive]=useState(null);
  const [syncing,setSyncing]=useState(false);
  const [syncStatus,setSyncStatus]=useState("");
  const [loaded,setLoaded]=useState(false);
  const [projectAuth,setProjectAuth]=useState({});
  useEffect(()=>{ // sessão global: qualquer toque/clique renova a atividade (throttle em session.js)
    const renew=()=>touchSession();
    window.addEventListener("click",renew,{passive:true});
    window.addEventListener("touchstart",renew,{passive:true});
    return ()=>{window.removeEventListener("click",renew);window.removeEventListener("touchstart",renew);};
  },[]);
  const [sigError,setSigError]=useState(false);
  const [showConfirmModal,setShowConfirmModal]=useState(false);
  const [showMonthlyPrompt,setShowMonthlyPrompt]=useState(false);
  const [draft,setDraft]=useState(null);
  const [showDraftPrompt,setShowDraftPrompt]=useState(false);
  const [viewParams,setViewParams]=useState(null);
  const [notifGranted,setNotifGranted]=useState(false);
  const [pendingSync,setPendingSync]=useState(null); // {projectId, history} aguardando sincronizar com o servidor
  const savingRef = useRef(false); // trava contra duplo clique no "Confirmar e Enviar"
  const formTimerRef = useRef(null); // timestamp de abertura do formulário
  const [formElapsed, setFormElapsed] = useState(0); // segundos desde a abertura
  const [firestoreDown,setFirestoreDown]=useState(false); // alarme geral: banco fora do ar/bloqueado

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const view=params.get("view");
    if(view){
      const firstUnderscore=view.indexOf("_");
      if(firstUnderscore>0){
        const pid=view.substring(0,firstUnderscore);
        const token=view.substring(firstUnderscore+1);
        if(pid&&token) setViewParams({projectId:pid,token});
      }
    }
  },[]);

  useEffect(()=>{
    requestNotificationPermission().then(granted=>{ setNotifGranted(granted); });
  },[]);

  useEffect(()=>{
    const local=(()=>{try{const r=localStorage.getItem("seccheck_v4");return r?JSON.parse(r):{};}catch{return{};}})();
    setStored(local);
    try{const c=localStorage.getItem("seccheck_ctmk_v1");if(c)setCtmkData(JSON.parse(c));}catch{}
    try{const d=localStorage.getItem("moklog_draft");if(d)setDraft(JSON.parse(d));}catch{}
    loadAllFromFirebase().then(async fb=>{
      if(Object.keys(fb).length>0){
        const merged={...local};
        const resyncs=[];
        Object.keys(fb).forEach(pid=>{
          const serverHist = fb[pid]?.history||[];
          const localHist = local[pid]?.history||[];
          const mergedHist = mergeHistory(localHist, serverHist);
          merged[pid] = {...fb[pid], history: mergedHist};
          if(mergedHist.length > serverHist.length){ resyncs.push({pid, history:mergedHist}); }
        });
        setStored(merged);
        try{ localStorage.setItem("seccheck_v4",JSON.stringify(merged)); }catch(e){}
        // Reenvia automaticamente ao servidor qualquer relatório que só existia neste aparelho
        for(const r of resyncs){ try{ await saveToFirebase(r.pid, r.history); }catch(e){} }
      }
      setLoaded(true);
    }).catch(()=>setLoaded(true));
  },[]);

  useEffect(()=>{ if(loaded) checkPendingNotifications(stored); },[loaded]);

  // ── Monitor de saúde do banco de dados (alarme geral)
  // Testa periodicamente se o Firestore está acessível. Se uma regra de
  // segurança expirar, uma cota for excedida, ou qualquer outra falha de
  // permissão ocorrer, isso avisa na tela em vez de deixar todo mundo
  // trabalhando sem saber que os dados não estão sendo salvos no servidor.
  useEffect(()=>{
    if(!loaded) return;
    let cancelado = false;
    const checarSaude = async () => {
      try {
        await getDoc(doc(db,"projects","P601"));
        if(!cancelado) setFirestoreDown(false);
      } catch(e) {
        if(!cancelado) setFirestoreDown(true);
        console.error("[MokLog] Banco de dados inacessível:", e?.message||e);
      }
    };
    checarSaude();
    const intervalo = setInterval(checarSaude, 120000); // a cada 2 minutos
    return ()=>{ cancelado = true; clearInterval(intervalo); };
  },[loaded]);

  useEffect(()=>{
    if(!loaded) return;
    const unsubs=Object.keys(PROJECTS).map(pid=>
      onSnapshot(doc(db,"projects",pid),(snap)=>{
        if(snap.exists()){
          setStored(prev=>{
            const serverHist = snap.data()?.history||[];
            const localHist = prev[pid]?.history||[];
            let mergedHist = mergeHistory(localHist, serverHist);
            const tomb = deletedTombstoneRef.current[pid];
            if(tomb && tomb.size>0){
              mergedHist = mergedHist.filter(r=>!tomb.has(r.meta?.date));
            }
            const up={...prev,[pid]:{...snap.data(), history: mergedHist}};
            try{ localStorage.setItem("seccheck_v4",JSON.stringify(up)); }catch(e){}
            if(mergedHist.length > serverHist.length){
              saveToFirebase(pid, mergedHist).catch(()=>{});
            }
            return up;
          });
        }
      },()=>{})
    );
    return ()=>unsubs.forEach(u=>u());
  },[loaded]);

  // ── Monitor CTMK (status da central de monitoramento remoto) — todos os projetos, incluindo Jatinox
  useEffect(()=>{
    if(!loaded) return;
    const ctmkIds=[...Object.keys(PROJECTS),"P260A","P260B","P260C"];
    const unsubs=ctmkIds.map(pid=>
      onSnapshot(doc(db,"ctmk",pid),(snap)=>{
        setCtmkData(prev=>{
          const up={...prev,[pid]: snap.exists()?snap.data():(prev[pid]||{status:"online"})};
          try{ localStorage.setItem("seccheck_ctmk_v1",JSON.stringify(up)); }catch(e){}
          return up;
        });
      },()=>{})
    );
    return ()=>unsubs.forEach(u=>u());
  },[loaded]);

  // ── Monitor de falhas KeyAccess ainda abertas (sem horaFim) — alimenta o banner da Home
  const [keyAccessOpenCount, setKeyAccessOpenCount] = useState(0);
  useEffect(()=>{
    if(!loaded) return;
    const ids=Object.keys(PROJECTS);
    const unsubs=ids.map(pid=>
      onSnapshot(doc(db,"keyaccess_falhas",pid),(snap)=>{
        const registros = snap.exists() ? (snap.data().registros||[]) : [];
        const abertas = registros.filter(r=>!r.horaFim).length;
        setKeyAccessOpenCount(prev=>{
          // recalcula o total somando por projeto — guarda por pid num mapa auxiliar
          window.__keyAccessByProject = window.__keyAccessByProject||{};
          window.__keyAccessByProject[pid] = abertas;
          return Object.values(window.__keyAccessByProject).reduce((a,b)=>a+b,0);
        });
      },()=>{})
    );
    return ()=>unsubs.forEach(u=>u());
  },[loaded]);

  // ── Alterna status CTMK (sem senha) — calcula dias offline e guarda histórico da última queda
  const toggleCtmk = async (pid, customOfflineSince) => {
    const cur = ctmkData[pid] || {status:"online"};
    const nowIso = new Date().toISOString();
    let next;
    if(cur.status==="offline"){
      const days = cur.offlineSince ? Math.floor((Date.now()-new Date(cur.offlineSince).getTime())/86400000) : 0;
      next = {
        status:"online",
        offlineSince:null,
        lastOfflinePeriod: { from: cur.offlineSince||nowIso, to: nowIso, days },
        updatedAt: nowIso
      };
    } else {
      // customOfflineSince permite ao gerencial registrar que a queda já vem de antes de hoje
      const since = customOfflineSince ? new Date(customOfflineSince+"T12:00:00").toISOString() : nowIso;
      next = { status:"offline", offlineSince: since, lastOfflinePeriod: cur.lastOfflinePeriod||null, updatedAt: nowIso };
    }
    setCtmkData(prev=>{
      const up={...prev,[pid]:next};
      try{ localStorage.setItem("seccheck_ctmk_v1",JSON.stringify(up)); }catch(e){}
      return up;
    });
    try{ await setDoc(doc(db,"ctmk",pid), next); }catch(e){}
  };

  // ── Confirmação antes de alternar o CTMK (evita perder o histórico por toque acidental)
  const [ctmkConfirm, setCtmkConfirm] = useState(null); // {pid, status, allowDateEdit}
  const requestCtmkToggle = (pid, allowDateEdit=false) => {
    const info = ctmkData[pid] || {};
    const status = info.status || "online";
    setCtmkConfirm({ pid, status, allowDateEdit, offlineSince:info.offlineSince||null });
  };

  // Refs do estado inicial do form — o rascunho só é salvo depois que o usuário MEXE em algo
  // (antes, abrir um form vazio já recriava o rascunho, tornando impossível descartá-lo)
  const initialFormRef = useRef({state:null, meta:null});

  // ── Cronômetro de preenchimento — conta segundos enquanto o formulário está aberto
  useEffect(()=>{
    if(screen==="form"){
      if(!formTimerRef.current) formTimerRef.current = Date.now();
      const t = setInterval(()=>setFormElapsed(Math.floor((Date.now()-formTimerRef.current)/1000)), 1000);
      return ()=>clearInterval(t);
    } else {
      // Não zeramos ao sair — o valor fica disponível pro relatório
    }
  },[screen]);

  useEffect(()=>{
    if(screen==="form"&&state&&editingIdx===null){
      const untouched = state===initialFormRef.current.state && meta===initialFormRef.current.meta && photos.length===0;
      if(untouched) return; // form aberto mas intocado — não cria rascunho
      try {
        const d={projectId:project.id,state,meta,photoCount:photos.length,savedAt:Date.now()};
        localStorage.setItem("moklog_draft",JSON.stringify(d));
        setDraft({...d,photos});
      } catch(err) {
        try {
          const d={projectId:project.id,savedAt:Date.now()};
          localStorage.setItem("moklog_draft",JSON.stringify(d));
        } catch(e) {}
      }
    }
  },[screen,state,meta,photos,editingIdx]);

  const clearDraft=()=>{localStorage.removeItem("moklog_draft");setDraft(null);};
  const checkAuth=(pid)=>!!getAccess(pid);
  const grantAuth=(pid,mode="lider")=>{grantSession(mode,pid);setProjectAuth(prev=>({...prev,[pid]:{mode,ts:Date.now()}}));};
  // modo já liberado para o projeto (null se sessão expirada/inexistente) — usado pelos módulos CCO/Equipe/Equipamentos/Empresas/Visita
  const getProjectAuthMode=(pid)=>getAccess(pid);
  const lastForProject=stored[project.id]?.history?.slice(-1)[0]??null;
  const recurrence=analyzeRecurrence(project,stored[project.id]?.history??[]);

  const saveReport=async(st,mt)=>{
    setSyncing(true);setSyncStatus("");
    if(!st || typeof st !== "object") {
      setSyncing(false);
      alert("Erro: dados do relatório inválidos. Tente novamente.");
      return;
    }
    if(editingIdx!==null){
      const result=await editReport(project.id,editingIdx,st,mt);
      setSyncing(false);
      if(result?.ok!==false){
        setSyncStatus("saved");
        setTimeout(()=>setSyncStatus(""),3000);
      }
      setEditingIdx(null);
      return;
    }
    const prev=stored[project.id]?.history??[];
    if(mt?.date && deletedTombstoneRef.current[project.id]?.has(mt.date)){
      deletedTombstoneRef.current[project.id].delete(mt.date); // novo registro intencional na mesma data — remove o "veto"
    }
    const next=[...prev,{state:st,meta:mt,savedAt:new Date().toISOString()}].slice(-MAX_HISTORY);
    const up={...stored,[project.id]:{...stored[project.id],history:next,updatedAt:new Date().toISOString()}};
    try {
      setStored(up);
      localStorage.setItem("seccheck_v4",JSON.stringify(up));
    } catch(localErr) {
      console.error("localStorage save failed:", localErr);
    }
    clearDraft();
    if(!navigator.onLine) {
      setSyncing(false);
      setPendingSync({projectId:project.id, history:next});
      return;
    }
    try{
      const result = await saveToFirebase(project.id,next);
      if(result?.ok===false){
        setPendingSync({projectId:project.id, history:next});
      } else {
        setSyncStatus("saved");
        setPendingSync(null);
        setTimeout(()=>setSyncStatus(""),3000);
      }
    }
    catch(e){ setPendingSync({projectId:project.id, history:next}); }
    finally{ setSyncing(false); }
    const h=computeHealth(project,st);
    const criticalItems=[];
    for(const cat of project.categories){
      const s=st[cat.id]; if(!s) continue;
      if(cat.type==="items"){
        s.forEach((v,i)=>{
          const wks=getConsecutiveInopWeeks(project,next,cat.id,i);
          if(wks>=INOP_ALERT_WEEKS){ criticalItems.push(`${cat.itemLabels[i]} (${wks}sem)`); }
        });
      }
    }
    if(criticalItems.length>0){ sendNotification(`${project.id} – ALERTA`,`Itens criticos: ${criticalItems.slice(0,3).join(", ")}`); }
    sendNotification(`${project.id} – Relatorio Finalizado`,`${project.name}: ${h.pct}% · Assinado por ${mt.signature||"—"}`);
  };

  const deletedTombstoneRef = useRef({}); // {[projectId]: Set(datas excluídas)} — impede que o merge com o servidor resuscite um relatório que o usuário acabou de excluir
  const deleteReport=async(projectId,idx)=>{
    const prev=stored[projectId]?.history??[];
    const deletedDate = prev[idx]?.meta?.date;
    if(deletedDate){
      deletedTombstoneRef.current[projectId] = new Set([...(deletedTombstoneRef.current[projectId]||[]), deletedDate]);
    }
    const next=prev.filter((_,i)=>i!==idx);
    const up={...stored,[projectId]:{...stored[projectId],history:next,updatedAt:new Date().toISOString()}};
    setStored(up);localStorage.setItem("seccheck_v4",JSON.stringify(up));
    try{await deleteReportFromFirebase(projectId,next);}catch(e){}
  };

  const editReport=async(projectId,idx,newState,newMeta)=>{
    const prev=stored[projectId]?.history??[];
    if(idx<0||idx>=prev.length) return {ok:false};
    const original=prev[idx];
    const updatedReport={...original,state:newState,meta:newMeta,savedAt:original.savedAt||new Date().toISOString(),editedAt:new Date().toISOString()};
    const next=prev.map((r,i)=>i===idx?updatedReport:r);
    const up={...stored,[projectId]:{...stored[projectId],history:next,updatedAt:new Date().toISOString()}};
    setStored(up);
    try{localStorage.setItem("seccheck_v4",JSON.stringify(up));}catch(e){}
    if(!navigator.onLine){ setPendingSync({projectId,history:next}); return {ok:true,offline:true}; }
    const result=await saveToFirebase(projectId,next);
    if(result?.ok===false){ setPendingSync({projectId,history:next}); }
    return result;
  };

  const startEditReport=(proj,report,idx)=>{
    setProject(proj);
    // MIGRAÇÃO: relatório salvo antes de uma atualização pode ter categorias ou
    // itens a menos que o checklist atual (ex: nova zona perimetral, categoria
    // dividida). Completa o que falta preservando tudo que já foi preenchido.
    const raw=JSON.parse(JSON.stringify(report.state||{}));
    const migrado={...raw};
    for(const cat of proj.categories){
      const cur=migrado[cat.id];
      if(cur===undefined||cur===null){
        if(cat.type==="items") migrado[cat.id]=(cat.itemLabels||[]).map(()=>({status:"ok",note:"",since:""}));
        else if(cat.type==="single") migrado[cat.id]={status:"ok",note:"",since:""};
        else if(cat.type==="count") migrado[cat.id]={total:cat.total,inoperative:[]};
        else if(cat.type==="notes") migrado[cat.id]={items:[]};
        else if(cat.type==="maintenance") migrado[cat.id]={visits:[]};
      } else if(cat.type==="items" && cat.itemLabels){
        // normaliza para array e completa itens faltantes (ex: Zona 05 nova)
        let arr=Array.isArray(cur)?[...cur]:Object.keys(cur).sort((a,b)=>(+a)-(+b)).map(k=>cur[k]);
        while(arr.length<cat.itemLabels.length) arr.push({status:"ok",note:"",since:""});
        migrado[cat.id]=arr;
      }
    }
    setState(migrado);
    setMeta({date:todayStr(),start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:"",...report.meta,date:report.meta?.date||todayStr()});
    setPhotos([]);
    setEditingIdx(idx);
    setActive(null);
    setScreen("form");
  };

  const startNew=()=>{
    if(draft&&draft.projectId===project.id){setShowDraftPrompt(true);return;}
    const base=lastForProject?buildFromLast(project,lastForProject.state):buildBlank(project);
    setState(base);
    setMeta({date:todayStr(),start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:""});
    setPhotos([]);setScreen("form");setActive(null);
  };

  const continueDraft=()=>{
    // MIGRAÇÃO: um rascunho salvo antes de uma atualização de checklist pode não
    // ter as categorias novas. Mescla o draft com a estrutura atual do projeto,
    // criando em branco qualquer categoria que falte (sem perder o que foi preenchido).
    const migrado={...(draft.state||{})};
    for(const cat of project.categories){
      if(migrado[cat.id]===undefined||migrado[cat.id]===null){
        if(cat.type==="items") migrado[cat.id]=(cat.itemLabels||[]).map(()=>({status:"ok",note:"",since:""}));
        else if(cat.type==="single") migrado[cat.id]={status:"ok",note:"",since:""};
        else if(cat.type==="count") migrado[cat.id]={total:cat.total,inoperative:[]};
        else if(cat.type==="notes") migrado[cat.id]={items:[]};
        else if(cat.type==="maintenance") migrado[cat.id]={visits:[]};
      }
    }
    setState(migrado);setMeta(draft.meta);initialFormRef.current={state:null,meta:null};setPhotos(draft.photos||[]);setShowDraftPrompt(false);setScreen("form");setActive(null);
  };
  const discardDraft=()=>{clearDraft();setShowDraftPrompt(false);const base=lastForProject?buildFromLast(project,lastForProject.state):buildBlank(project);const m={date:todayStr(),start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:""};setState(base);setMeta(m);initialFormRef.current={state:base,meta:m};setPhotos([]);formTimerRef.current=Date.now();setFormElapsed(0);setScreen("form");setActive(null);};
  const deleteDraftOnly=()=>{clearDraft();setShowDraftPrompt(false);}; // exclui o rascunho e fica onde está

  // Required fields validation
  const missingFields = () => {
    const missing = [];
    if(!meta.date) missing.push("Data");
    if(!meta.start||!meta.end) missing.push("Horário de início e término");
    if(!meta.leader||meta.leader.trim()==="") missing.push("Nome do líder VSPP");
    if(!meta.cco||meta.cco.trim()==="") missing.push("Nome da Central (CCO)");
    if(meta.mokedContact){
      if(!meta.mokedTime||meta.mokedTime.trim()==="") missing.push("Horário do contato com a Central Moked");
      if(!meta.moked||meta.moked.trim()==="") missing.push("Nome do operador Moked 24h");
    }
    if(!meta.signature||meta.signature.trim()==="") missing.push("Assinatura do líder");
    // Trava de Segurança: Visita Técnica Obrigatória — mínimo 2 visitas completas (não se aplica a P311A/P311B)
    if(state && project.id!=="P311A" && project.id!=="P311B"){
      const matCat = project.categories.find(c=>c.type==="maintenance");
      if(matCat){
        const mv = state[matCat.id];
        const visits = (mv && Array.isArray(mv.visits)) ? mv.visits : [];
        const completas = visits.filter(v=>v && v.date && (v.empresa||"").trim() && (v.tec1||"").trim()).length;
        if(completas<2) missing.push("⚠️ Favor inserir visitas técnicas — mínimo 2 com data, técnico e prestador");
      }
    }
    if(state){
      const badWords=["inoperante","inop","inop.","parcial","parc.","sem motivo","problema","defeito"];
      const isBadNote=(note)=>{const n=(note||"").trim().toLowerCase().replace(/[.,!]/g,"");return n===""||badWords.includes(n);};
      for(const cat of project.categories){
        const s=state[cat.id]; if(!s) continue;
        if(cat.type==="single"){
          const st=s.status??(s.ok===false?"inop":"ok");
          if(st!=="ok"&&isBadNote(s.note)) missing.push(`Corrija a descrição de "${cat.label}" — não pode ser só "inoperante" ou "parcial"`);
        } else if(cat.type==="items"){
          s.forEach((v,i)=>{const st=v.status??(v.ok===false?"inop":"ok");if(st!=="ok"&&isBadNote(v.note)) missing.push(`Corrija a descrição de "${cat.itemLabels[i]}" (${cat.label}) — não pode ser só "inoperante" ou "parcial"`);});
        } else if(cat.type==="count"){
          (s.inoperative??[]).forEach(it=>{if(isBadNote(it.note)) missing.push(`Corrija a descrição do item "${it.id||"sem ID"}" (${cat.label}) — não pode ser só "inoperante" ou "parcial"`);});
        }
      }
    }
    return missing;
  };
  const canFinalize = missingFields().length === 0;

  const finalize=()=>{
    const missing = missingFields();
    if(missing.length>0){
      setSigError(true);
      window.scrollTo(0,document.body.scrollHeight);
      return;
    }
    setSigError(false);
    setShowConfirmModal(true);
  };

  const confirmAndSend=()=>{
    if(savingRef.current) return;
    savingRef.current = true;
    setShowConfirmModal(false);
    // Gravar cronômetro e timestamps automáticos no meta
    const tempoPreenchimento = formTimerRef.current ? Math.floor((Date.now()-formTimerRef.current)/1000) : null;
    const metaComTempo = {
      ...meta,
      formAberturaAuto: formTimerRef.current ? new Date(formTimerRef.current).toISOString() : null,
      formEnvioAuto: new Date().toISOString(),
      tempoPreenchimentoSeg: tempoPreenchimento,
    };
    saveReport(state, metaComTempo).finally(()=>{ savingRef.current = false; });
    setMeta(metaComTempo);
    setScreen("report");
  };

  const updateCat=useCallback((id,val)=>setState(prev=>({...prev,[id]:val})),[]);
  const health=state?computeHealth(project,state):null;

  const retrySync = async () => {
    if(!pendingSync) return;
    setSyncing(true);
    try {
      const result = await saveToFirebase(pendingSync.projectId, pendingSync.history);
      if(result?.ok!==false){
        setPendingSync(null);
        setSyncStatus("saved");
        setTimeout(()=>setSyncStatus(""),3000);
      }
    } catch(e){ /* mantém pendingSync para tentar de novo depois */ }
    finally{ setSyncing(false); }
  };

  const SyncBadge=()=>(
    <>
      {syncing && (
        <div style={{position:"fixed",bottom:16,right:16,background:"#1d4ed8",color:"#fff",borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,zIndex:999}}>⟳ Sincronizando...</div>
      )}
      {syncStatus==="saved" && (
        <div style={{position:"fixed",bottom:16,right:16,background:"#15803d",color:"#fff",borderRadius:20,padding:isSunday()?"9px 18px":"7px 14px",fontSize:isSunday()?13:12,fontWeight:800,zIndex:999,boxShadow:isSunday()?"0 4px 18px rgba(21,128,61,.5)":"none"}}>{isSunday()?"✅ Teste Semanal Finalizado!":"✓ Salvo"}</div>
      )}
      {pendingSync && (
        <div style={{position:"fixed",bottom:16,left:16,right:16,maxWidth:420,margin:"0 auto",background:"#7c2d12",color:"#fff",borderRadius:12,padding:"12px 14px",zIndex:1000,display:"flex",alignItems:"center",gap:10,boxShadow:"0 6px 24px rgba(0,0,0,.45)"}}>
          <span style={{fontSize:20,flexShrink:0}}>⚠️</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700}}>Relatório não sincronizado — {pendingSync.projectId}</div>
            <div style={{fontSize:11,opacity:.85}}>Salvo só neste aparelho. Toque em "Tentar" para enviar ao servidor.</div>
          </div>
          <button onClick={retrySync} disabled={syncing} style={{background:"#fff",color:"#7c2d12",border:"none",borderRadius:8,padding:"8px 14px",fontWeight:700,fontSize:12,cursor:syncing?"not-allowed":"pointer",flexShrink:0,opacity:syncing?0.6:1}}>{syncing?"⟳":"Tentar"}</button>
        </div>
      )}
    </>
  );

  if(showAcesso) return <ErrorBoundary moduleName="Acesso Transportadoras"><AcessoApp initialScreen={acessoScreen} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowAcesso(false);setAcessoScreen("menu");}}/></ErrorBoundary>;
  if(showEquipe&&equipeProject) return <ErrorBoundary moduleName="Equipe"><EquipeApp project={equipeProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowEquipe(false);setEquipeProject(null);}} sharedAuth={getProjectAuthMode(equipeProject.id)} onAuthGranted={(mode)=>grantAuth(equipeProject.id,mode)}/></ErrorBoundary>;
  if(showRegistros) return <ErrorBoundary moduleName="Registros"><RegistrosMenu dark={dark} stored={stored} onToggleTheme={()=>setDark(!dark)} onAcessos={()=>{setShowRegistros(false);setAcessoScreen("list");setShowAcesso(true);}} onEquipe={(p)=>{setShowRegistros(false);setEquipeProject(p);setShowEquipe(true);}} onEquipamentos={(p)=>{setShowRegistros(false);setEquipamentosProject(p);setShowEquipamentos(true);}} onBack={()=>setShowRegistros(false)}/></ErrorBoundary>;
  if(showAcessoCCO&&acessoCCOProject) return <ErrorBoundary moduleName="Acesso CCO"><AcessoCCO project={acessoCCOProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowAcessoCCO(false);setAcessoCCOProject(null);setAcessoCCOAbas(null);}} sharedAuth={getProjectAuthMode(acessoCCOProject.id)} onAuthGranted={(mode)=>grantAuth(acessoCCOProject.id,mode)} abasPermitidas={acessoCCOAbas}/></ErrorBoundary>;
  if(showOcorrencias&&ocorrenciasProject) return <ErrorBoundary moduleName="Ocorrências"><Ocorrencias project={ocorrenciasProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowOcorrencias(false);setOcorrenciasProject(null);}} sharedAuth={getProjectAuthMode(ocorrenciasProject.id)} onAuthGranted={(mode)=>grantAuth(ocorrenciasProject.id,mode)}/></ErrorBoundary>;
  if(showEmpresaInfo&&empresaInfoProject) return <ErrorBoundary moduleName="Empresas"><EmpresaInfo project={empresaInfoProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowEmpresaInfo(false);setEmpresaInfoProject(null);}} sharedAuth={getProjectAuthMode(empresaInfoProject.id)} onAuthGranted={(mode)=>grantAuth(empresaInfoProject.id,mode)}/></ErrorBoundary>;
  if(showEquipamentos&&equipamentosProject) return <ErrorBoundary moduleName="Equipamentos"><Equipamentos project={equipamentosProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowEquipamentos(false);setEquipamentosProject(null);}} sharedAuth={getProjectAuthMode(equipamentosProject.id)} onAuthGranted={(mode)=>grantAuth(equipamentosProject.id,mode)}/></ErrorBoundary>;
  // Visita Diária removida a pedido — componente Visita.jsx permanece no repo por histórico
  if(showBolsao&&bolsaoProject) return <ErrorBoundary moduleName="Fiscalização de Bolsão"><Bolsao project={bolsaoProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowBolsao(false);setBolsaoProject(null);}} sharedAuth={getProjectAuthMode(bolsaoProject.id)} onAuthGranted={(mode)=>grantAuth(bolsaoProject.id,mode)}/></ErrorBoundary>;
  if(showRondaVSPP) return <ErrorBoundary moduleName="Ronda VSPP"><RondaVSPP project={PROJECTS["P601"]} dark={dark} onBack={()=>setShowRondaVSPP(false)} sharedAuth={getProjectAuthMode("P601")} onAuthGranted={(mode)=>grantAuth("P601",mode)}/></ErrorBoundary>;
  if(showInquilinos&&inquilinosProject) return <ErrorBoundary moduleName="Inquilinos"><Inquilinos project={inquilinosProject} dark={dark} onBack={()=>{setShowInquilinos(false);setInquilinosProject(null);}} sharedAuth={getProjectAuthMode(inquilinosProject.id)} onAuthGranted={(mode)=>grantAuth(inquilinosProject.id,mode)}/></ErrorBoundary>;
  if(showPerimetral&&perimetralProject) return <ErrorBoundary moduleName="Teste Perimetral"><Perimetral project={perimetralProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowPerimetral(false);setPerimetralProject(null);}} sharedAuth={getProjectAuthMode(perimetralProject.id)} onAuthGranted={(mode)=>grantAuth(perimetralProject.id,mode)}/></ErrorBoundary>;
  if(showIluminacao&&iluminacaoProject) return <ErrorBoundary moduleName="Teste de Iluminação"><Iluminacao project={iluminacaoProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowIluminacao(false);setIluminacaoProject(null);}} sharedAuth={getProjectAuthMode(iluminacaoProject.id)} onAuthGranted={(mode)=>grantAuth(iluminacaoProject.id,mode)}/></ErrorBoundary>;
  if(showRonda&&rondaProject) return <ErrorBoundary moduleName="Ronda Perimetral Diária"><RondaDiaria project={rondaProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowRonda(false);setRondaProject(null);}} sharedAuth={getProjectAuthMode(rondaProject.id)} onAuthGranted={(mode)=>grantAuth(rondaProject.id,mode)}/></ErrorBoundary>;
  if(showBolsaoInq&&bolsaoInqProject) return <ErrorBoundary moduleName="Checagem de Bolsão"><BolsaoInquilinos project={bolsaoInqProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowBolsaoInq(false);setBolsaoInqProject(null);}} sharedAuth={getProjectAuthMode(bolsaoInqProject.id)} onAuthGranted={(mode)=>grantAuth(bolsaoInqProject.id,mode)}/></ErrorBoundary>;
  if(showEnergia&&energiaProject) return <ErrorBoundary moduleName="Ocorrências de Energia"><EnergiaOcorrencias project={energiaProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowEnergia(false);setEnergiaProject(null);}} sharedAuth={getProjectAuthMode(energiaProject.id)} onAuthGranted={(mode)=>grantAuth(energiaProject.id,mode)}/></ErrorBoundary>;
  if(showKeyAccess) return <ErrorBoundary moduleName="KeyAccess Falha"><KeyAccessFalha dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>setShowKeyAccess(false)}/></ErrorBoundary>;
  if(showIntervalos&&intervalosProject) return <ErrorBoundary moduleName="Intervalos"><Intervalos project={intervalosProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowIntervalos(false);setIntervalosProject(null);}}/></ErrorBoundary>;
  if(showCCO&&ccoProject) return <ErrorBoundary moduleName="CCO"><CCO project={ccoProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowCCO(false);setCcoProject(null);}}/></ErrorBoundary>;
  if(viewParams) return <ViewScreen projectId={viewParams.projectId} token={viewParams.token} stored={stored}/>;

  if(showMonthlyPrompt) return(
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#060c18",border:"1px solid #7c3aed",borderRadius:16,padding:"28px 24px",maxWidth:340,width:"100%",textAlign:"center",margin:16}}>
        <div style={{fontSize:28,marginBottom:10}}>📊</div>
        <div style={{fontSize:15,fontWeight:700,color:"#f1f5f9",marginBottom:6}}>Último teste do mês!</div>
        <div style={{fontSize:12,color:"#94a3b8",marginBottom:20}}>Este é o último domingo do mês.<br/>Deseja gerar o consolidado mensal após finalizar?</div>
        <div style={{display:"flex",gap:8,flexDirection:"column"}}>
          <button onClick={()=>{setShowMonthlyPrompt(false);if(!meta.signature||meta.signature.trim()===""){setSigError(true);return;}saveReport(state,meta);setScreen("report");setTimeout(()=>{const hist=stored[project.id]?.history??[];const now=new Date();const monthReports=hist.map((r,i)=>({r,i})).filter(({r})=>{if(!r.meta?.date)return false;const d=new Date(r.meta.date+"T12:00:00");return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});if(monthReports.length>=2){generateConsolidatedPDF(project,monthReports.map(({r})=>r));}},1500);}} style={{...S.primaryBtn,width:"100%",background:"linear-gradient(135deg,#7c3aed,#6d28d9)",fontSize:14}}>
            ✓ Finalizar + Gerar Consolidado
          </button>
          <button onClick={()=>{setShowMonthlyPrompt(false);if(!meta.signature||meta.signature.trim()===""){setSigError(true);return;}saveReport(state,meta);setScreen("report");}} style={{...S.secBtn,width:"100%",fontSize:14}}>Só finalizar</button>
          <button onClick={()=>setShowMonthlyPrompt(false)} style={{...S.secBtn,width:"100%",fontSize:13,color:"#94a3b8"}}>Cancelar</button>
        </div>
      </div>
    </div>
  );

  if(showDraftPrompt) return(
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#060c18",border:"1px solid #f59e0b",borderRadius:16,padding:"28px 24px",maxWidth:320,width:"100%",textAlign:"center",margin:16}}>
        <div style={{fontSize:28,marginBottom:10}}>📝</div>
        <div style={{fontSize:15,fontWeight:700,color:"#f1f5f9",marginBottom:6}}>Rascunho encontrado</div>
        <div style={{fontSize:12,color:"#94a3b8",marginBottom:20}}>Relatorio em andamento de {project.id}. Continuar?</div>
        <div style={{display:"flex",gap:8,flexDirection:"column"}}>
          <button onClick={continueDraft} style={{...S.primaryBtn,width:"100%",fontSize:14}}>↩ Continuar rascunho</button>
          <button onClick={discardDraft} style={{...S.secBtn,width:"100%",fontSize:14}}>📝 Descartar e comecar novo</button>
          <button onClick={deleteDraftOnly} style={{...S.secBtn,width:"100%",fontSize:14,color:"#ef4444",borderColor:"#ef444444"}}>🗑 Excluir rascunho</button>
        </div>
      </div>
    </div>
  );

  if(screen==="pendencies") return <PendenciesScreen stored={stored} onBack={()=>setScreen("home")}/>;
  if(screen==="pin_gate") return <ProjectPinGate project={project} onSuccess={(mode)=>{grantAuth(project.id,mode||"lider");setScreen(project.id==="P260A"?"p260a_home":"home");}} onBack={()=>setScreen("home")}/>;

  // ── Tela dedicada do P260A (checklist semanal Jatinox) — mesmo padrão visual dos projetos de grupo
  if(screen==="p260a_home"&&project?.id==="P260A") {
    const hist=stored["P260A"]?.history??[];
    const last=hist.length?hist[hist.length-1]:null;
    const h=last?computeHealth(project,last.state):null;
    const lastForP260A=last;
    const isAdmin=getProjectAuthMode("P260A")==="admin";
    return(
      <div style={S.page}>
        <div style={S.formWrap}>
          <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a"}}>
            <button onClick={()=>{setHomeGroup("jatinox");setScreen("home");}} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:16,fontWeight:900,color:"#f1f5f9"}}>P260A — Jatinox Unidade A</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>Checklist Semanal · {project.categories.length} categorias</div>
            </div>
            {h&&<HealthRing pct={h.pct} size={50}/>}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:10}}>
            {h&&(
              <div style={{background:"#060c18",border:`1px solid ${h.pct>=90?"#22c55e44":h.pct>=70?"#f59e0b44":"#ef444444"}`,borderRadius:12,padding:"14px",display:"flex",alignItems:"center",gap:14}}>
                <HealthRing pct={h.pct} size={56}/>
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{h.pct}% — {h.inop} inoperante{h.inop!==1?"s":""}</div>
                  <div style={{fontSize:11,color:"#94a3b8"}}>Último: {fmtDate(last?.meta?.date)} · {getWeekLabel(last?.meta?.date)}</div>
                  {last?.meta?.leader&&<div style={{fontSize:11,color:"#64748b"}}>Líder: {last.meta.leader}</div>}
                </div>
              </div>
            )}
            {!h&&(
              <div style={{background:"#060c18",border:"1px solid #7c3aed33",borderRadius:12,padding:"20px",textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:6}}>📋</div>
                <div style={{fontSize:13,color:"#a78bfa",fontWeight:700}}>Nenhum teste realizado ainda</div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>Toque em "Novo Relatório" pra começar</div>
              </div>
            )}

            <button onClick={()=>{const base=lastForP260A?buildFromLast(project,lastForP260A.state):buildBlank(project);const m={date:todayStr(),start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:""};setState(base);setMeta(m);initialFormRef.current={state:base,meta:m};setPhotos([]);setEditingIdx(null);formTimerRef.current=Date.now();setFormElapsed(0);setScreen("form");setActive(null);}}
              style={{background:"linear-gradient(135deg,#3b82f6,#1e40af)",border:"none",borderRadius:20,padding:"16px 18px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:14,textAlign:"left",boxShadow:"0 6px 22px rgba(37,99,235,.4), inset 0 1px 0 rgba(255,255,255,.15)",
                animation:isSunday()?"mkPulse 1.4s ease-in-out infinite":"none"}}>
              <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,255,255,.16)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:24}}>📋</span></div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:16,fontWeight:900,color:"#fff",letterSpacing:.2}}>Novo Relatório Semanal</div>
                <div style={{fontSize:11,color:"#bfdbfe",fontWeight:700}}>P260A</div>
                <ContagemProximoDomingo light/>
              </div>
            </button>
            <style>{`@keyframes mkPulse{0%,100%{box-shadow:0 6px 22px rgba(37,99,235,.4), 0 0 0 0 rgba(59,130,246,.6)}70%{box-shadow:0 6px 22px rgba(37,99,235,.4), 0 0 0 12px rgba(59,130,246,0)}}`}</style>
            <button onClick={()=>setScreen("history")} style={{...S.secBtn,fontSize:14,width:"100%"}}>📅 Histórico de Relatórios Semanais</button>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <button onClick={()=>{setEquipeProject({id:"P260A",name:"Jatinox Unidade A"});setShowEquipe(true);}} style={{background:"linear-gradient(165deg,#0ea5e911,#0ea5e906)",border:"1.5px solid #0ea5e944",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#0ea5e915",border:"1px solid #0ea5e933",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>👥</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#0ea5e9"}}>Equipe</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Gestão de Recursos</div></div><span style={{color:"#0ea5e944",fontSize:18}}>›</span></button>
              <button onClick={()=>{setAcessoCCOProject({id:"P260A",name:"Jatinox Unidade A"});setShowAcessoCCO(true);}} style={{background:"linear-gradient(165deg,#22c55e11,#22c55e06)",border:"1.5px solid #22c55e44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#22c55e15",border:"1px solid #22c55e33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🚪</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#22c55e"}}>CCO</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Central de Operações</div></div><span style={{color:"#22c55e44",fontSize:18}}>›</span></button><button onClick={()=>{setOcorrenciasProject({id:"P260A",name:"Jatinox Unidade A"});setShowOcorrencias(true);}} style={{background:"linear-gradient(165deg,#f59e0b11,#f59e0b06)",border:"1.5px solid #f59e0b44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",gridColumn:"1/-1",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#f59e0b15",border:"1px solid #f59e0b33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>📋</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#f59e0b"}}>Registro Situacional</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Ocorrências (RS)</div></div>{rsCounts["P260A"]&&rsCounts["P260A"].total>0&&(<div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,marginRight:4}}><span style={{fontSize:13,fontWeight:800,color:"#f59e0b"}}>{rsCounts["P260A"].total} RS</span>{rsCounts["P260A"].naoVistas>0&&<span style={{fontSize:9,fontWeight:800,color:"#fff",background:"#B21E27",borderRadius:4,padding:"1px 6px"}}>{rsCounts["P260A"].naoVistas} nova(s)</span>}</div>)}<span style={{color:"#f59e0b44",fontSize:18}}>›</span></button>
            </div>

            <CtmkBadge info={ctmkData["P260A"]} onToggle={()=>requestCtmkToggle("P260A",hasGerencial())} size="large"/>
          </div>
        </div>
      </div>
    );
  }

  if(screen==="dashboard") return <Dashboard stored={stored} ctmkData={ctmkData} onToggleCtmk={toggleCtmk} onBack={()=>setScreen("home")} onDeleteReport={deleteReport} onEditReport={startEditReport}/>;
  if(screen==="history") return <ErrorBoundary moduleName="Histórico de Relatórios"><HistoryScreen project={project} stored={stored} onBack={()=>setScreen(project?.id==="P260A"?"p260a_home":"home")} onEdit={startEditReport} onDelete={deleteReport} canManage={getProjectAuthMode(project.id)==="admin"}/></ErrorBoundary>;
  if(screen==="report") return <ReportScreen project={project} state={state} meta={meta} photos={photos} ctmkData={ctmkData} onBack={()=>setScreen("form")} onHome={()=>setScreen(project?.id==="P260A"?"p260a_home":"home")}/>;

  // ── FORM
  if(screen==="form") return(
    <div style={{...S.page, background:dark?"#04080f":"#f1f5f9"}}>
      {showConfirmModal && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:dark?"#060c18":"#fff",border:"2px solid #f59e0b66",borderRadius:16,padding:"26px 22px",maxWidth:360,width:"100%"}}>
            <div style={{fontSize:28,textAlign:"center",marginBottom:10}}>⚠️</div>
            <div style={{fontSize:15,fontWeight:800,color:dark?"#f1f5f9":"#1e293b",textAlign:"center",marginBottom:10}}>Atenção Líder!</div>
            <div style={{fontSize:13,color:dark?"#94a3b8":"#64748b",lineHeight:1.65,marginBottom:20,textAlign:"center"}}>
              Por favor, revise todo o relatório antes de enviar. Verifique se os textos explicativos estão corretos e se você inseriu a <strong style={{color:dark?"#f1f5f9":"#1e293b"}}>data inicial de todas as ocorrências</strong> e dispositivos inoperantes/parciais.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowConfirmModal(false)}
                style={{flex:1,background:"transparent",border:`1px solid ${dark?"#1e293b":"#e2e8f0"}`,color:dark?"#94a3b8":"#94a3b8",borderRadius:10,padding:"12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                ← Voltar e Revisar
              </button>
              <button onClick={confirmAndSend}
                style={{flex:1,background:"linear-gradient(135deg,#16a34a,#15803d)",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                ✓ Confirmar e Enviar
              </button>
            </div>
          </div>
        </div>
      )}
      <SyncBadge/><DemoBanner/>
      {firestoreDown && (
        <div role="alert" style={{background:"#7c2d12",border:"1px solid #ef4444",borderRadius:10,padding:"10px 14px",margin:"0 0 10px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>🚫</span>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:700,color:"#fff"}}>Servidor não está respondendo</div>
            <div style={{fontSize:11,color:"#fed7aa"}}>O que você salvar agora pode ficar só neste aparelho até a conexão voltar. Avise o suporte se isso persistir.</div>
          </div>
        </div>
      )}
      <div style={S.formWrap}>
        {editingIdx!==null&&(
          <div style={{background:"#001a2e",border:"1px solid #0ea5e966",borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16}}>✏️</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:"#0ea5e9"}}>Modo edição gerencial</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>Você está editando um relatório já salvo. Ao confirmar, ele será sobrescrito (sem duplicar).</div>
            </div>
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #060c18",marginBottom:2}}>
          <button onClick={()=>{if(editingIdx!==null){setEditingIdx(null);setScreen("dashboard");}else{setScreen(project?.id==="P260A"?"p260a_home":"home");}}} style={S.backBtn} aria-label={editingIdx!==null?"Cancelar edição":"Voltar ao início"}>← {editingIdx!==null?"Cancelar":"Inicio"}</button>
          <MoklogLogo size={32}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:900,color:"#f8fafc"}}>MokLog <span style={{color:"#cc2222"}}>CheckTest</span></div>
            <div style={{fontSize:11,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{project.id} – {project.name}{editingIdx!==null?" · editando":""}</div>
          </div>
          {health&&<HealthRing pct={health.pct} size={46}/>}
        </div>
        {health&&<div style={{height:3,background:"#060c18",borderRadius:2,overflow:"hidden",marginBottom:8}}>
          <div style={{height:"100%",width:`${health.pct}%`,background:health.pct>=90?"#22c55e":health.pct>=70?"#f59e0b":"#ef4444",borderRadius:2,transition:"width .4s"}}/>
        </div>}
        {health&&<div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:"#22c55e",background:"#021a0d",padding:"2px 8px",borderRadius:4,fontWeight:700}}>✅ {health.ok} OK</span>
          {health.partial>0&&<span style={{fontSize:11,color:"#d97706",background:"#1a1000",padding:"2px 8px",borderRadius:4,fontWeight:700}}>⚠️ {health.partial} Parcial</span>}
          {health.inop>0&&<span style={{fontSize:11,color:"#ef4444",background:"#1a0202",padding:"2px 8px",borderRadius:4,fontWeight:700}}>🔴 {health.inop} Inop</span>}
        </div>}
        {editingIdx===null&&formTimerRef.current&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"8px 12px",background:"linear-gradient(165deg,#0f172a,#060c18)",border:"1px solid #1d4ed844",borderRadius:10,marginBottom:8}}>
            <span style={{fontSize:14}}>⏱️</span>
            <span style={{fontSize:13,fontWeight:800,color:"#60a5fa",fontVariantNumeric:"tabular-nums",letterSpacing:1}}>
              {String(Math.floor(formElapsed/3600)).padStart(2,"0")}:{String(Math.floor((formElapsed%3600)/60)).padStart(2,"0")}:{String(formElapsed%60).padStart(2,"0")}
            </span>
            <span style={{fontSize:11,color:"#94a3b8"}}>preenchimento</span>
          </div>
        )}
        <div style={S.metaCard}>
          <div style={{fontSize:11,color:"#f59e0b",fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>📋 Cabecalho do Relatorio</div>
          {editingIdx!==null&&<div style={{background:"#1a1000",border:"1px solid #f59e0b44",borderRadius:8,padding:"8px 10px",marginBottom:10,fontSize:11,color:"#fbbf24"}}>
            ✏️ Editando relatório existente — a data abaixo já é a data original deste teste ({fmtDate(meta.date)}). Só altere se for uma <strong>correção retroativa</strong> (ex: data errada no cadastro).
          </div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
            {[["Data","date","date"],["Inicio","start","time"],["Termino","end","time"],["Lider VSPP","leader","text"],["CCO","cco","text"],["Operador Moked 24h","moked","text"],["Horario Contato Moked","mokedTime","time"]].map(([label,key,type])=>(
              <div key={key}>
                <label style={S.lbl}>{label}</label>
                <input type={type} placeholder={type==="text"?"Nome...":""} value={meta[key]} onChange={e=>setMeta(m=>({...m,[key]:e.target.value}))} style={S.inp}/>
              </div>
            ))}
            <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
              <label style={S.lbl}>Contato Moked?</label>
              <div style={{display:"flex",gap:6,marginTop:3}}>
                <button onClick={()=>setMeta(m=>({...m,mokedContact:true}))} style={{...S.sm,...(meta.mokedContact?S.smOk:{}),flex:1}}>✓ Sim</button>
                <button onClick={()=>setMeta(m=>({...m,mokedContact:false}))} style={{...S.sm,...(!meta.mokedContact?S.smBad:{}),flex:1}}>✗ Nao</button>
              </div>
            </div>
          </div>
          <div style={{marginTop:8}}>
            <label style={S.lbl}>Observacoes Gerais</label>
            <textarea placeholder="Observacoes adicionais..." value={meta.obs} onChange={e=>setMeta(m=>({...m,obs:e.target.value}))} style={{...S.inp,height:52,resize:"vertical",fontSize:12}}/>
          </div>
        </div>

        {state&&project.categories.map(cat=>{
          const isOpen=active===cat.id;
          // BLINDAGEM: categoria nova (adicionada em atualização) pode não existir
          // no estado carregado de um teste anterior. Cria o estado em branco na
          // hora para a cascata sempre abrir e ser preenchível.
          let sv=state[cat.id];
          if(sv===undefined||sv===null){
            if(cat.type==="items") sv=(cat.itemLabels||[]).map(()=>({status:"ok",note:"",since:""}));
            else if(cat.type==="single") sv={status:"ok",note:"",since:""};
            else if(cat.type==="count") sv={total:cat.total,inoperative:[]};
            else if(cat.type==="notes") sv={items:[]};
            else if(cat.type==="maintenance") sv={visits:[]};
            else sv=[];
          } else if(cat.type==="items" && Array.isArray(sv) && cat.itemLabels && sv.length<cat.itemLabels.length){
            // categoria existente ganhou itens novos (ex: nova zona perimetral):
            // completa os que faltam em branco, preservando os já preenchidos
            sv=[...sv];
            while(sv.length<cat.itemLabels.length) sv.push({status:"ok",note:"",since:""});
          }
          let cp=100;
          if(cat.type==="single"){const st=sv?.status??(sv?.ok===false?"inop":"ok");cp=st==="ok"?100:st==="partial"?50:0;}
          else if(cat.type==="items"){const a=sv||[];const okN=a.filter(v=>(v.status??"ok")==="ok").length;const partN=a.filter(v=>v.status==="partial").length;cp=calcPct(okN+(partN*0.5|0),a.length);}
          else if(cat.type==="count"){const t=sv?.total??cat.total;cp=calcPct(t-(sv?.inoperative?.length??0),t);}
          else cp=100;
          const dotColor=cat.type==="maintenance"?"#f59e0b":cp===100?"#22c55e":cp>=50?"#f59e0b":"#ef4444";
          return(
            <div key={cat.id} style={{borderBottom:"1px solid #060c18"}}>
              <button onClick={()=>setActive(isOpen?null:cat.id)} style={S.accordion}>
                <span style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:dotColor}}/>
                <span style={{fontSize:12,fontWeight:600,color:"#cbd5e1",textAlign:"left",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.label}</span>
                {cat.type!=="maintenance"&&cat.type!=="notes"&&<span style={{fontSize:11,color:cp===100?"#22c55e":cp>=50?"#f59e0b":"#ef4444",fontWeight:800,flexShrink:0}}>{cp}%</span>}
                <span style={{color:"#94a3b8",fontSize:11,flexShrink:0,marginLeft:4}}>{isOpen?"▲":"▼"}</span>
              </button>
              {isOpen&&sv&&(
                <div style={{paddingBottom:8}}>
                  {cat.type==="single"&&<SingleCat cat={cat} value={sv} onChange={v=>updateCat(cat.id,v)} photos={photos} setPhotos={setPhotos} recurrence={recurrence}/>}
                  {cat.type==="items"&&<ItemsCat cat={cat} values={sv} onChange={v=>updateCat(cat.id,v)} photos={photos} setPhotos={setPhotos} recurrence={recurrence}/>}
                  {cat.type==="count"&&<CountCat cat={cat} value={sv} onChange={v=>updateCat(cat.id,v)} photos={photos} setPhotos={setPhotos} recurrence={recurrence}/>}
                  {cat.type==="notes"&&<NotesCat cat={cat} value={sv} onChange={v=>updateCat(cat.id,v)}/>}
                  {cat.type==="maintenance"&&<MaintenanceCat cat={cat} value={sv} onChange={v=>updateCat(cat.id,v)}/>}
                </div>
              )}
            </div>
          );
        })}

        {state&&(
          <div style={{...S.metaCard,marginTop:8,border:sigError?"1px solid #ef4444":"1px solid #0f172a"}}>
            <div style={{fontSize:11,color:sigError?"#ef4444":"#f59e0b",fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>
              ✍️ Assinatura {sigError&&"— obrigatoria para finalizar"}
            </div>
            <label htmlFor="campo-assinatura" style={{position:"absolute",width:1,height:1,overflow:"hidden"}}>Assinatura do líder</label>
            <input id="campo-assinatura" placeholder="Digite seu nome completo para assinar..." value={meta.signature||""}
              onChange={e=>{setMeta(m=>({...m,signature:e.target.value}));setSigError(false);}}
              style={{...S.inp,fontSize:13,fontWeight:600}}/>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:5}}>Obrigatorio para finalizar o relatorio.</div>
          </div>
        )}
        {state&&(
          <div style={{marginTop:14,display:"flex",gap:8,flexWrap:"wrap"}}>
            {!canFinalize && (
              <div role="alert" style={{width:"100%",background:"#1a0202",border:"1px solid #ef444444",borderRadius:10,padding:"10px 14px",marginBottom:4}}>
                <div style={{fontSize:12,color:"#ef4444",fontWeight:700,marginBottom:4}}>⚠️ Campos obrigatórios não preenchidos:</div>
                {missingFields().map(f=>(
                  <div key={f} style={{fontSize:11,color:"#fca5a5"}}>• {f}</div>
                ))}
              </div>
            )}
            <button onClick={finalize} disabled={!canFinalize}
              style={{...S.primaryBtn,flex:2,fontSize:14,opacity:canFinalize?1:0.45,cursor:canFinalize?"pointer":"not-allowed"}}>
              {editingIdx!==null?"✓ Salvar Alterações":"✓ Finalizar e Gerar Relatório"}
            </button>
            <button onClick={()=>{if(editingIdx!==null){setEditingIdx(null);setScreen("dashboard");}else{setScreen(project?.id==="P260A"?"p260a_home":"home");}}} style={{...S.secBtn,flex:1,fontSize:14}}>Cancelar</button>
          </div>
        )}
        <div style={{fontSize:11,color:"#94a3b8",textAlign:"center",marginTop:4}}>{editingIdx!==null?"✏️ Editando relatório existente":"💾 Rascunho salvo automaticamente"}</div>
      </div>
    </div>
  );

  // ── HOME — Jatinox subscreen
  if(homeGroup==="jatinox") return(
    <div style={{...S.page, background:dark?"#04080f":"#f1f5f9"}}>
      <SyncBadge/><DemoBanner/>
      <div style={S.homeWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a"}}>
          <button onClick={()=>setHomeGroup(null)} style={S.backBtn} aria-label="Voltar">← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:900,color:dark?"#f8fafc":"#0f172a"}}>🏭 Jatinox</div>
            <div style={{fontSize:11,color:"#94a3b8"}}>P260A · P260B · P260C</div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {Object.values(JATINOX_SUBS).map(jp=>{
            const isSel=jatinoxSel===jp.id;
            return(
              <div key={jp.id} style={{background:"#060c18",border:`2px solid ${isSel?"#7c3aed66":"#0f172a"}`,borderRadius:14,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px",cursor:"pointer"}} onClick={()=>setJatinoxSel(isSel?null:jp.id)}>
                  <div style={{width:48,height:48,borderRadius:12,background:"linear-gradient(135deg,#1e1040,#0f0820)",border:"1px solid #3b1d8a",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontSize:22}}>🏭</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{jp.id}</div>
                    <div style={{fontSize:12,color:"#94a3b8"}}>{jp.name}</div>
                    <div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap"}}>
                      {jp.hasAcesso&&<span style={{fontSize:11,color:"#f59e0b",background:"#1a1000",padding:"2px 7px",borderRadius:5,fontWeight:700,border:"1px solid #f59e0b22"}}>🚛 ACESSO</span>}
                      {jp.hasEquipe&&<span style={{fontSize:11,color:"#0ea5e9",background:"#001a2e",padding:"2px 7px",borderRadius:5,fontWeight:700,border:"1px solid #0ea5e922"}}>👥 EQUIPE</span>}
                      {jp.hasCaoGuarda&&<span style={{fontSize:11,color:"#22c55e",background:"#021a0d",padding:"2px 7px",borderRadius:5,fontWeight:700,border:"1px solid #22c55e22"}}>🐕 CÃO GUARDA</span>}
                    </div>
                  </div>
                  <CtmkBadge info={ctmkData[jp.id]} onToggle={()=>requestCtmkToggle(jp.id,hasGerencial())} size="small"/>
                  <div style={{color:"#94a3b8",fontSize:18,flexShrink:0}}>{isSel?"▲":"▼"}</div>
                </div>
                {isSel&&(
                  <div style={{padding:"12px 16px 16px",display:"flex",flexDirection:"column",gap:8,borderTop:"1px solid #0f172a"}}>
                    {jp.hasAcesso&&(
                      <button onClick={()=>setShowAcesso(true)}
                        style={{...S.primaryBtn,fontSize:13,background:"linear-gradient(135deg,#92400e,#78350f)"}}>
                        🚛 Acesso Transportadoras
                      </button>
                    )}
                    {jp.hasEquipe&&(
                      <button onClick={()=>{setEquipeProject({id:jp.id,name:jp.name,hasCaoGuarda:jp.hasCaoGuarda});setShowEquipe(true);}}
                        style={{...S.primaryBtn,fontSize:13,background:"linear-gradient(135deg,#0369a1,#0c4a6e)"}}>
                        👥 Equipe — {jp.id}
                      </button>
                    )}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      {jp.id==="P260A"&&(
                        <button onClick={()=>{setAcessoCCOProject({id:jp.id,name:jp.name});setShowAcessoCCO(true);}}
                          style={{background:"linear-gradient(165deg,#22c55e11,#22c55e06)",border:"1.5px solid #22c55e44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#22c55e15",border:"1px solid #22c55e33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🚪</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#22c55e"}}>CCO</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Central de Operações</div></div><span style={{color:"#22c55e44",fontSize:18}}>›</span></button>
                      )}
                      {(jp.id==="P260A"||jp.id==="P260C")&&(
                        <button onClick={()=>{setOcorrenciasProject({id:jp.id,name:jp.name});setShowOcorrencias(true);}} style={{gridColumn:"1/-1",background:"linear-gradient(165deg,#f59e0b11,#f59e0b06)",border:"1.5px solid #f59e0b44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#f59e0b15",border:"1px solid #f59e0b33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>📋</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#f59e0b"}}>Registro Situacional</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Ocorrências (RS)</div></div>{rsCounts[jp.id]&&rsCounts[jp.id].total>0&&(<div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,marginRight:4}}><span style={{fontSize:13,fontWeight:800,color:"#f59e0b"}}>{rsCounts[jp.id].total} RS</span>{rsCounts[jp.id].naoVistas>0&&<span style={{fontSize:9,fontWeight:800,color:"#fff",background:"#B21E27",borderRadius:4,padding:"1px 6px"}}>{rsCounts[jp.id].naoVistas} nova(s)</span>}</div>)}<span style={{color:"#f59e0b44",fontSize:18}}>›</span></button>
                      )}
                      <button onClick={()=>{setEquipamentosProject({id:jp.id,name:jp.name});setShowEquipamentos(true);}}
                        style={{...S.secBtn,fontSize:12,color:"#f59e0b",borderColor:"#f59e0b22",gridColumn:jp.id==="P260A"?"auto":"1/-1"}}>🛡️ Equipamentos</button>
                      <button onClick={()=>{setEmpresaInfoProject({id:jp.id,name:jp.name});setShowEmpresaInfo(true);}}
                        style={{...S.secBtn,fontSize:12,color:"#a855f7",borderColor:"#a855f722",gridColumn:"1/-1"}}>🏢 Empresas</button>
                      {(jp.id==="P260B"||jp.id==="P260C")&&(
                        <button onClick={()=>{setAcessoCCOProject({id:jp.id,name:jp.name});setAcessoCCOAbas(["supervisao","manutencao"]);setShowAcessoCCO(true);}}
                          style={{gridColumn:"1/-1",background:"linear-gradient(165deg,#a855f711,#a855f706)",border:"1.5px solid #a855f744",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}>
                          <div style={{width:44,height:44,borderRadius:12,background:"#a855f715",border:"1px solid #a855f733",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>👁️</span></div>
                          <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#a855f7"}}>Supervisão / Manutenção</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Registro de visitas técnicas</div></div>
                          <span style={{color:"#a855f744",fontSize:18}}>›</span>
                        </button>
                      )}
                      <button onClick={()=>{setIluminacaoProject({id:jp.id,name:jp.name});setShowIluminacao(true);}} style={{gridColumn:"1/-1",background:"linear-gradient(165deg,#eab30811,#eab30806)",border:"1.5px solid #eab30844",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#facc1515",border:"1px solid #facc1533",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>💡</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#facc15"}}>Teste de Iluminação</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Contagem por Quadrante</div><ContadorIluminacao projectId={jp.id}/></div><span style={{color:"#facc1544",fontSize:18}}>›</span></button>
                      <button onClick={()=>{setRondaProject({id:jp.id,name:jp.name});setShowRonda(true);}} style={{gridColumn:"1/-1",background:"linear-gradient(165deg,#0d948811,#0d948806)",border:"1.5px solid #0d948844",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#2dd4bf15",border:"1px solid #2dd4bf33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🚶</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#2dd4bf"}}>Ronda Perimetral Diária</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Registro por Turno</div></div><span style={{color:"#2dd4bf44",fontSize:18}}>›</span></button>
                      <button onClick={()=>{setEnergiaProject({id:jp.id,name:jp.name});setShowEnergia(true);}} style={{gridColumn:"1/-1",background:"linear-gradient(165deg,#ef444411,#ef444406)",border:"1.5px solid #ef444444",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#ef444415",border:"1px solid #ef444433",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>⚡</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#ef4444"}}>Ocorrências de Energia</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Controle e Estabilidade</div></div><span style={{color:"#ef444444",fontSize:18}}>›</span></button>

                      {jp.id==="P260A"&&(
                        <button onClick={()=>{setHomeGroup(null);setProject(PROJECTS["P260A"]);setScreen(checkAuth("P260A")?"p260a_home":"pin_gate");}}
                          style={{...S.secBtn,fontSize:12,color:"#7c3aed",borderColor:"#7c3aed22",gridColumn:"1/-1"}}>📋 Checklist Semanal</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {ctmkConfirm&&<CtmkConfirmModal confirm={ctmkConfirm} project={{id:ctmkConfirm.pid}} onCancel={()=>setCtmkConfirm(null)} onConfirm={(date)=>{toggleCtmk(ctmkConfirm.pid,date);setCtmkConfirm(null);}}/>}
    </div>
  );

  // ── HOME — Group subscreen (Golgi, Mega, Klog)
  if(homeGroup) {
    const groupProjects = {
      golgi: ["P601","P602","P604","P605","P606","P607"],
      mega:  ["P311A","P311B"],
      klog:  ["P505"],
    }[homeGroup] || [];
    const groupNames = {golgi:"Projetos Golgi",mega:"Projetos Mega",klog:"Projetos Klog"};
    const groupColors = {golgi:"#1d4ed8",mega:"#0ea5e9",klog:"#16a34a"};
    const color = groupColors[homeGroup];
    return (
      <div style={{...S.page, background:dark?"#04080f":"#f1f5f9"}}>
        <SyncBadge/><DemoBanner/>
        <div style={S.homeWrap}>
          <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a"}}>
            <button onClick={()=>setHomeGroup(null)} style={S.backBtn} aria-label="Voltar">← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:16,fontWeight:900,color:dark?"#f8fafc":"#0f172a"}}>{groupNames[homeGroup]}</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>{groupProjects.join(" · ")}</div>
            </div>
            {(()=>{const tp=groupProjects.reduce((a,pid)=>a+((rsCounts[pid]&&rsCounts[pid].naoVistas)||0),0);return tp>0?(
              <div title="RS pendentes de visualização no grupo" style={{display:"flex",alignItems:"center",gap:6,background:"#B21E27",color:"#fff",borderRadius:8,padding:"5px 10px",fontWeight:800,fontSize:12,boxShadow:"0 2px 8px rgba(178,30,39,.4)"}}>
                <span style={{fontSize:14}}>🛡️</span>Total RS Pendentes: {tp}
              </div>
            ):null;})()}
          </div>

          {draft&&groupProjects.includes(draft.projectId)&&(
            <div style={{background:"#0f172a",border:"1px solid #f59e0b55",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>📝</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Rascunho em andamento</div>
                <div style={{fontSize:11,color:"#94a3b8"}}>{draft.projectId} — salvo automaticamente</div>
              </div>
              <button onClick={()=>{setProject(PROJECTS[draft.projectId]);setShowDraftPrompt(true);}} style={{...S.sm,color:"#f59e0b",border:"1px solid #f59e0b44",fontSize:11}}>Continuar</button>
              <button onClick={()=>{if(window.confirm("Excluir este rascunho? Essa ação não pode ser desfeita."))clearDraft();}} aria-label="Excluir rascunho" style={{background:"transparent",border:"1px solid #47556955",borderRadius:8,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",color:"#94a3b8",cursor:"pointer",fontSize:14,flexShrink:0,padding:0}}>×</button>
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {groupProjects.map(pid => {
              const p = PROJECTS[pid]; if(!p) return null;
              const hist = stored[p.id]?.history??[];
              const last = hist.slice(-1)[0];
              const h = last?computeHealth(p,last.state):null;
              const pcolor = h?h.pct>=90?"#22c55e":h.pct>=70?"#f59e0b":"#ef4444":"#334155";
              const score = getProjectScore(p,hist);
              const isActive = p.id===project.id;
              return(
                <div key={pid} style={{background:isActive?"#060f20":"#060c18",border:`2px solid ${isActive?color+"66":"#0f172a"}`,borderRadius:16,padding:"16px 14px",cursor:"pointer"}}
                  onClick={()=>setProject(p)}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    {h?<HealthRing pct={h.pct} size={50}/>:
                      <div style={{width:50,height:50,borderRadius:"50%",border:"2px solid #1e293b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#94a3b8"}}>—</div>}
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{p.id}</div>
                        <div style={{fontSize:12,color:"#94a3b8"}}>— {p.name}</div>
                        {score&&<span style={{fontSize:11,fontWeight:900,color:score.color,background:score.color+"22",padding:"1px 5px",borderRadius:5}}>{score.grade}</span>}
                      </div>
                      {h?<div style={{fontSize:11,color:"#64748b",marginTop:2}}>
                        {h.inop>0&&<span style={{color:"#ef4444",fontWeight:700}}>{h.inop} inop · </span>}
                        Último: {fmtDate(last?.meta?.date)}
                      </div>:<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Sem registros ainda</div>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                      <CtmkBadge info={ctmkData[p.id]} onToggle={()=>requestCtmkToggle(p.id,hasGerencial())}/>
                      {rsCounts[p.id]&&rsCounts[p.id].naoVistas>0&&(
                        <div title="RS pendentes de visualização" style={{display:"flex",alignItems:"center",gap:5,background:"#B21E27",color:"#fff",borderRadius:6,padding:"2px 8px",fontWeight:800,fontSize:12,boxShadow:"0 2px 6px rgba(178,30,39,.4)"}}>
                          <span style={{fontSize:13}}>🛡️</span>{rsCounts[p.id].naoVistas} RS
                        </div>
                      )}
                      {isActive&&<span style={{fontSize:11,color:color,fontWeight:700,background:color+"22",padding:"2px 6px",borderRadius:5}}>SELECIONADO</span>}
                    </div>
                  </div>
                  {h&&<div style={{marginTop:8,height:3,background:"#0f172a",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${h.pct}%`,background:pcolor,borderRadius:2}}/>
                  </div>}
                </div>
              );
            })}
          </div>

          {project&&groupProjects.includes(project.id)&&(
            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:4}}>
              {checkAuth(project.id)?(
                <>
                  <button onClick={()=>{const base=lastForProject?buildFromLast(project,lastForProject.state):buildBlank(project);const m={date:todayStr(),start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:""};setState(base);setMeta(m);initialFormRef.current={state:base,meta:m};setPhotos([]);formTimerRef.current=Date.now();setFormElapsed(0);setScreen("form");setActive(null);}}
                    style={{background:"linear-gradient(135deg,#3b82f6,#1e40af)",border:"none",borderRadius:20,padding:"16px 18px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:14,textAlign:"left",boxShadow:"0 6px 22px rgba(37,99,235,.4), inset 0 1px 0 rgba(255,255,255,.15)",
                      animation:isSunday()?"mkPulse 1.4s ease-in-out infinite":"none"}}>
                    <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,255,255,.16)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:24}}>📋</span></div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:16,fontWeight:900,color:"#fff",letterSpacing:.2}}>Novo Relatório Semanal</div>
                      <div style={{fontSize:11,color:"#bfdbfe",fontWeight:700}}>{project.id}</div>
                      <ContagemProximoDomingo light/>
                    </div>
                  </button>
                  <style>{`@keyframes mkPulse{0%,100%{box-shadow:0 6px 22px rgba(37,99,235,.4), 0 0 0 0 rgba(59,130,246,.6)}70%{box-shadow:0 6px 22px rgba(37,99,235,.4), 0 0 0 12px rgba(59,130,246,0)}}`}</style>
                  <button onClick={()=>setScreen("history")} style={{...S.secBtn,fontSize:13}}>📅 Histórico de Relatórios Semanais</button>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <button onClick={()=>{setEquipeProject(project);setShowEquipe(true);}} style={{background:"linear-gradient(165deg,#0ea5e911,#0ea5e906)",border:"1.5px solid #0ea5e944",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#0ea5e915",border:"1px solid #0ea5e933",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>👥</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#0ea5e9"}}>Equipe</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Gestão de Recursos</div></div><span style={{color:"#0ea5e944",fontSize:18}}>›</span></button>
                    <button onClick={()=>{setAcessoCCOProject(project);setShowAcessoCCO(true);}} style={{background:"linear-gradient(165deg,#22c55e11,#22c55e06)",border:"1.5px solid #22c55e44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#22c55e15",border:"1px solid #22c55e33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🚪</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#22c55e"}}>CCO</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Central de Operações</div></div><span style={{color:"#22c55e44",fontSize:18}}>›</span></button><button onClick={()=>{setOcorrenciasProject(project);setShowOcorrencias(true);}} style={{gridColumn:"1/-1",background:"linear-gradient(165deg,#f59e0b11,#f59e0b06)",border:"1.5px solid #f59e0b44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#f59e0b15",border:"1px solid #f59e0b33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>📋</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#f59e0b"}}>Registro Situacional</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Ocorrências (RS)</div></div>{rsCounts[project.id]&&rsCounts[project.id].total>0&&(<div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,marginRight:4}}><span style={{fontSize:13,fontWeight:800,color:"#f59e0b"}}>{rsCounts[project.id].total} RS</span>{rsCounts[project.id].naoVistas>0&&<span style={{fontSize:9,fontWeight:800,color:"#fff",background:"#B21E27",borderRadius:4,padding:"1px 6px"}}>{rsCounts[project.id].naoVistas} nova(s)</span>}</div>)}<span style={{color:"#f59e0b44",fontSize:18}}>›</span></button>
                    <button onClick={()=>{setEquipamentosProject(project);setShowEquipamentos(true);}} style={{background:"linear-gradient(165deg,#f59e0b11,#f59e0b06)",border:"1.5px solid #f59e0b44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#f59e0b15",border:"1px solid #f59e0b33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🛡️</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#f59e0b"}}>Equipamentos</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Manutenção & Controle</div></div><span style={{color:"#f59e0b44",fontSize:18}}>›</span></button>
                    <button onClick={()=>{setEmpresaInfoProject(project);setShowEmpresaInfo(true);}} style={{background:"linear-gradient(165deg,#a855f711,#a855f706)",border:"1.5px solid #a855f744",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#a855f715",border:"1px solid #a855f733",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🏢</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#a855f7"}}>Empresas</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Parcerias & Vínculos</div></div><span style={{color:"#a855f744",fontSize:18}}>›</span></button>

                    {project.id==="P505"&&<button onClick={()=>{setPerimetralProject(project);setShowPerimetral(true);}} style={{background:"linear-gradient(165deg,#a855f711,#a855f706)",border:"1.5px solid #a855f744",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#e879f915",border:"1px solid #e879f933",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🔒</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#e879f9"}}>Ronda Perimetral Diária</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Zonas Perimetrais</div></div><span style={{color:"#e879f944",fontSize:18}}>›</span></button>}{<button onClick={()=>{setIluminacaoProject(project);setShowIluminacao(true);}} style={{background:"linear-gradient(165deg,#eab30811,#eab30806)",border:"1.5px solid #eab30844",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#facc1515",border:"1px solid #facc1533",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>💡</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#facc15"}}>Teste de Iluminação</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Contagem por Quadrante</div><ContadorIluminacao projectId={project.id}/></div><span style={{color:"#facc1544",fontSize:18}}>›</span></button>}{project.id!=="P505"&&<button onClick={()=>{setRondaProject(project);setShowRonda(true);}} style={{background:"linear-gradient(165deg,#0d948811,#0d948806)",border:"1.5px solid #0d948844",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#2dd4bf15",border:"1px solid #2dd4bf33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🚶</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#2dd4bf"}}>Ronda Perimetral Diária</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Registro por Turno</div></div><span style={{color:"#2dd4bf44",fontSize:18}}>›</span></button>}<button onClick={()=>{setEnergiaProject(project);setShowEnergia(true);}} style={{background:"linear-gradient(165deg,#ef444411,#ef444406)",border:"1.5px solid #ef444444",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#ef444415",border:"1px solid #ef444433",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>⚡</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#ef4444"}}>Ocorrências de Energia</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Controle e Estabilidade</div></div><span style={{color:"#ef444444",fontSize:18}}>›</span></button>{project.id==="P505"&&<button onClick={()=>{setBolsaoInqProject(project);setShowBolsaoInq(true);}} style={{background:"linear-gradient(165deg,#f59e0b11,#f59e0b06)",border:"1.5px solid #f59e0b44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#f59e0b15",border:"1px solid #f59e0b33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🅿️</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#f59e0b"}}>Checagem de Bolsão</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Veículos de Inquilinos</div></div><span style={{color:"#f59e0b44",fontSize:18}}>›</span></button>}
                    {BOLSAO_ELIGIBLE.includes(project.id)&&<button onClick={()=>{setBolsaoProject(project);setShowBolsao(true);}} style={{background:"linear-gradient(165deg,#f59e0b11,#f59e0b06)",border:"1.5px solid #f59e0b44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#f59e0b15",border:"1px solid #f59e0b33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🚧</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#f59e0b"}}>Fiscalização de Bolsão</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Controle de Pátio</div></div><span style={{color:"#f59e0b44",fontSize:18}}>›</span></button>}
                    {project.id==="P601"&&<button onClick={()=>setShowRondaVSPP(true)} style={{background:"linear-gradient(165deg,#0f6e5611,#0f6e5606)",border:"1.5px solid #0f6e5644",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#0f6e5615",border:"1px solid #0f6e5633",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🚗</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#0f6e56"}}>Ronda VSPP</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Patrulhamento Veicular</div></div><span style={{color:"#0f6e5644",fontSize:18}}>›</span></button>}
                    <button onClick={()=>{setInquilinosProject(project);setShowInquilinos(true);}} style={{background:"linear-gradient(165deg,#06b6d411,#06b6d406)",border:"1.5px solid #06b6d444",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#06b6d415",border:"1px solid #06b6d433",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🏗️</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#06b6d4"}}>Inquilinos / Galpões</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Ocupação & Locatários</div></div><span style={{color:"#06b6d444",fontSize:18}}>›</span></button>
                  </div>
                </>
              ):(
                <>
                  <button onClick={()=>setScreen("pin_gate")} style={{position:"relative",background:"linear-gradient(160deg,#1e3a6e 0%,#0b1730 55%,#1e3a6e 100%)",border:"2px solid #7dd3fc",borderRadius:14,padding:"14px 18px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:14,boxShadow:"0 0 0 1px rgba(125,211,252,.25), 0 0 22px rgba(56,189,248,.35), inset 0 1px 0 rgba(255,255,255,.15)"}}>
                    <svg width="40" height="40" viewBox="0 0 100 100" style={{flexShrink:0,filter:"drop-shadow(0 0 6px rgba(56,189,248,.7))"}}>
                      <path d="M50 8 L88 32 L82 78 Q50 96 18 78 L12 32 Z" fill="#0b1730" stroke="#7dd3fc" strokeWidth="2.5"/>
                      <path d="M25 40 Q50 20 75 40 L68 46 Q50 32 32 46 Z" fill="#38bdf8"/>
                      <circle cx="50" cy="52" r="16" fill="#082033" stroke="#38bdf8" strokeWidth="2"/>
                      <circle cx="50" cy="52" r="8" fill="#38bdf8"/>
                      <circle cx="50" cy="52" r="3.5" fill="#0b1730"/>
                    </svg>
                    <div style={{flex:1,minWidth:0,textAlign:"left"}}>
                      <div style={{fontSize:15,fontWeight:900,color:"#e0f2fe",letterSpacing:.5,textTransform:"uppercase",lineHeight:1.25,textShadow:"0 0 8px rgba(56,189,248,.6)"}}>Entrar no Comando<br/>— {project.id}</div>
                      <div style={{fontSize:9,fontWeight:700,color:"#7dd3fc",letterSpacing:1,marginTop:3,textTransform:"uppercase"}}>Vigilância Ativa / Protocolo Moked</div>
                    </div>
                  </button>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <button onClick={()=>{setEquipeProject(project);setShowEquipe(true);}} style={{background:"linear-gradient(165deg,#0ea5e911,#0ea5e906)",border:"1.5px solid #0ea5e944",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#0ea5e915",border:"1px solid #0ea5e933",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>👥</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#0ea5e9"}}>Equipe</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Gestão de Recursos</div></div><span style={{color:"#0ea5e944",fontSize:18}}>›</span></button>
                    <button onClick={()=>{setAcessoCCOProject(project);setShowAcessoCCO(true);}} style={{background:"linear-gradient(165deg,#22c55e11,#22c55e06)",border:"1.5px solid #22c55e44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#22c55e15",border:"1px solid #22c55e33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🚪</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#22c55e"}}>CCO</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Central de Operações</div></div><span style={{color:"#22c55e44",fontSize:18}}>›</span></button><button onClick={()=>{setOcorrenciasProject(project);setShowOcorrencias(true);}} style={{gridColumn:"1/-1",background:"linear-gradient(165deg,#f59e0b11,#f59e0b06)",border:"1.5px solid #f59e0b44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#f59e0b15",border:"1px solid #f59e0b33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>📋</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#f59e0b"}}>Registro Situacional</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Ocorrências (RS)</div></div>{rsCounts[project.id]&&rsCounts[project.id].total>0&&(<div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,marginRight:4}}><span style={{fontSize:13,fontWeight:800,color:"#f59e0b"}}>{rsCounts[project.id].total} RS</span>{rsCounts[project.id].naoVistas>0&&<span style={{fontSize:9,fontWeight:800,color:"#fff",background:"#B21E27",borderRadius:4,padding:"1px 6px"}}>{rsCounts[project.id].naoVistas} nova(s)</span>}</div>)}<span style={{color:"#f59e0b44",fontSize:18}}>›</span></button>
                    <button onClick={()=>{setEquipamentosProject(project);setShowEquipamentos(true);}} style={{background:"linear-gradient(165deg,#f59e0b11,#f59e0b06)",border:"1.5px solid #f59e0b44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#f59e0b15",border:"1px solid #f59e0b33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🛡️</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#f59e0b"}}>Equipamentos</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Manutenção & Controle</div></div><span style={{color:"#f59e0b44",fontSize:18}}>›</span></button>
                    <button onClick={()=>{setEmpresaInfoProject(project);setShowEmpresaInfo(true);}} style={{background:"linear-gradient(165deg,#a855f711,#a855f706)",border:"1.5px solid #a855f744",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#a855f715",border:"1px solid #a855f733",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🏢</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#a855f7"}}>Empresas</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Parcerias & Vínculos</div></div><span style={{color:"#a855f744",fontSize:18}}>›</span></button>

                    {project.id==="P505"&&<button onClick={()=>{setPerimetralProject(project);setShowPerimetral(true);}} style={{background:"linear-gradient(165deg,#a855f711,#a855f706)",border:"1.5px solid #a855f744",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#e879f915",border:"1px solid #e879f933",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🔒</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#e879f9"}}>Ronda Perimetral Diária</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Zonas Perimetrais</div></div><span style={{color:"#e879f944",fontSize:18}}>›</span></button>}{<button onClick={()=>{setIluminacaoProject(project);setShowIluminacao(true);}} style={{background:"linear-gradient(165deg,#eab30811,#eab30806)",border:"1.5px solid #eab30844",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#facc1515",border:"1px solid #facc1533",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>💡</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#facc15"}}>Teste de Iluminação</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Contagem por Quadrante</div><ContadorIluminacao projectId={project.id}/></div><span style={{color:"#facc1544",fontSize:18}}>›</span></button>}{project.id!=="P505"&&<button onClick={()=>{setRondaProject(project);setShowRonda(true);}} style={{background:"linear-gradient(165deg,#0d948811,#0d948806)",border:"1.5px solid #0d948844",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#2dd4bf15",border:"1px solid #2dd4bf33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🚶</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#2dd4bf"}}>Ronda Perimetral Diária</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Registro por Turno</div></div><span style={{color:"#2dd4bf44",fontSize:18}}>›</span></button>}<button onClick={()=>{setEnergiaProject(project);setShowEnergia(true);}} style={{background:"linear-gradient(165deg,#ef444411,#ef444406)",border:"1.5px solid #ef444444",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#ef444415",border:"1px solid #ef444433",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>⚡</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#ef4444"}}>Ocorrências de Energia</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Controle e Estabilidade</div></div><span style={{color:"#ef444444",fontSize:18}}>›</span></button>{project.id==="P505"&&<button onClick={()=>{setBolsaoInqProject(project);setShowBolsaoInq(true);}} style={{background:"linear-gradient(165deg,#f59e0b11,#f59e0b06)",border:"1.5px solid #f59e0b44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#f59e0b15",border:"1px solid #f59e0b33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🅿️</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#f59e0b"}}>Checagem de Bolsão</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Veículos de Inquilinos</div></div><span style={{color:"#f59e0b44",fontSize:18}}>›</span></button>}
                    {BOLSAO_ELIGIBLE.includes(project.id)&&<button onClick={()=>{setBolsaoProject(project);setShowBolsao(true);}} style={{background:"linear-gradient(165deg,#f59e0b11,#f59e0b06)",border:"1.5px solid #f59e0b44",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#f59e0b15",border:"1px solid #f59e0b33",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🚧</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#f59e0b"}}>Fiscalização de Bolsão</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Controle de Pátio</div></div><span style={{color:"#f59e0b44",fontSize:18}}>›</span></button>}
                    {project.id==="P601"&&<button onClick={()=>setShowRondaVSPP(true)} style={{background:"linear-gradient(165deg,#0f6e5611,#0f6e5606)",border:"1.5px solid #0f6e5644",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#0f6e5615",border:"1px solid #0f6e5633",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🚗</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#0f6e56"}}>Ronda VSPP</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Patrulhamento Veicular</div></div><span style={{color:"#0f6e5644",fontSize:18}}>›</span></button>}
                    <button onClick={()=>{setInquilinosProject(project);setShowInquilinos(true);}} style={{background:"linear-gradient(165deg,#06b6d411,#06b6d406)",border:"1.5px solid #06b6d444",borderRadius:16,padding:"16px 14px",cursor:"pointer",width:"100%",display:"flex",alignItems:"center",gap:12,textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"}}><div style={{width:44,height:44,borderRadius:12,background:"#06b6d415",border:"1px solid #06b6d433",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:22}}>🏗️</span></div><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:800,color:"#06b6d4"}}>Inquilinos / Galpões</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>Ocupação & Locatários</div></div><span style={{color:"#06b6d444",fontSize:18}}>›</span></button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      {ctmkConfirm&&<CtmkConfirmModal confirm={ctmkConfirm} project={{id:ctmkConfirm.pid}} onCancel={()=>setCtmkConfirm(null)} onConfirm={(date)=>{toggleCtmk(ctmkConfirm.pid,date);setCtmkConfirm(null);}}/>}
      </div>
    );
  }

  // ── HOME — Main cards
  return(
    <div style={{...S.page, background:dark?"radial-gradient(ellipse at 50% -5%, #0a1628 0%, #04080f 55%)":"#f1f5f9", minHeight:"100vh"}}>
      <style>{`
        @keyframes mkPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}70%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}
        @keyframes mkGlow{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes mkFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes mkRingSpin{0%{transform:rotate(-90deg)}100%{transform:rotate(270deg)}}
      `}</style>
      {!isOnline && (
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,background:"#92400e",padding:"8px 16px",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span style={{fontSize:14}}>📡</span>
          <span style={{fontSize:12,color:"#fef3c7",fontWeight:700}}>Sem conexão — dados salvos localmente, aguardando reconexão...</span>
        </div>
      )}
      {isOnline && firestoreDown && (
        <div role="alert" style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,background:"#7c2d12",padding:"8px 16px",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span style={{fontSize:14}}>🚫</span>
          <span style={{fontSize:12,color:"#fff",fontWeight:700}}>Servidor não está respondendo — o que for salvo agora pode ficar só neste aparelho. Avise o suporte técnico.</span>
        </div>
      )}
      <SyncBadge/><DemoBanner/>
      <div style={S.homeWrap}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
          <MoklogLogo size={52}/>
          <h1 style={{position:"absolute",width:1,height:1,overflow:"hidden"}}>MokLog CheckTest</h1>
          <div>
            <div style={{fontSize:22,fontWeight:900,color:"#f8fafc",letterSpacing:-0.5}}>MokLog</div>
            <div style={{fontSize:14,fontWeight:700,color:"#cc2222",letterSpacing:1}}>CheckTest</div>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>Sistema de Teste Semanal de Seguranca</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            <button onClick={()=>setScreen("pendencies")} style={{background:"rgba(239,68,68,.08)",border:"1px solid #ef444455",borderRadius:11,padding:"8px 11px",cursor:"pointer",fontSize:11,color:"#ef4444",fontWeight:700,animation:"mkPulse 2.2s infinite"}} aria-label="Ver pendências">🔴 Inop</button>
            <button onClick={()=>setShowRegistros(true)} style={{background:"rgba(204,34,34,.07)",border:"1px solid #cc222240",borderRadius:11,padding:"8px 11px",cursor:"pointer",fontSize:11,color:"#e05555",fontWeight:700,position:"relative"}} aria-label="Ver registros">📋 Registros
              {(()=>{const t=Object.values(stored).reduce((a,p)=>{const h=p.history||[];const last=h[h.length-1];if(!last)return a;const inop=Object.values(last.state||{}).reduce((s,cat)=>{if(cat.count!==undefined)return s+(cat.count===0?1:0);return s+Object.values(cat).filter(v=>v==="inop").length;},0);return a+inop;},0);return t>0?<span style={{position:"absolute",top:-4,right:-4,background:"#ef4444",color:"#fff",fontSize:9,fontWeight:900,borderRadius:8,padding:"1px 5px",minWidth:15,textAlign:"center",boxShadow:"0 2px 6px #ef444466"}}>{t>99?"99+":t}</span>:null;})()}
            </button>
            <button onClick={()=>setScreen("dashboard")} style={{background:"rgba(148,163,184,.06)",border:"1px solid #263248",borderRadius:11,padding:"8px 13px",cursor:"pointer",fontSize:12,color:"#a8b6c8",fontWeight:600}} aria-label="Abrir painel gerencial">📊 Painel</button>
            <button onClick={()=>setDark(!dark)} style={{background:"rgba(148,163,184,.06)",border:"1px solid #263248",borderRadius:11,padding:"8px 11px",cursor:"pointer",fontSize:14,color:"#a8b6c8"}} aria-label="Alternar tema claro/escuro">{dark?"☀️":"🌙"}</button>
          </div>
        </div>

        {!notifGranted&&(
          <div style={{background:"#0f172a",border:"1px solid #f59e0b44",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16}}>🔔</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Ativar notificacoes</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>Receba lembretes semanais e alertas</div>
            </div>
            <button onClick={()=>requestNotificationPermission().then(g=>setNotifGranted(g))}
              style={{...S.sm,color:"#f59e0b",border:"1px solid #f59e0b44",fontSize:11}}>Ativar</button>
          </div>
        )}

        {draft&&draft.projectId===project.id&&(
          <div style={{background:"linear-gradient(120deg,#131a2b 0%,#0f172a 55%,#1a1610 100%)",border:"1px solid #f59e0b55",borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 6px 18px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04)"}}>
            <span style={{fontSize:16}}>📝</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Rascunho em andamento</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>{project.id} — salvo automaticamente</div>
            </div>
            <button onClick={()=>setShowDraftPrompt(true)} style={{background:"linear-gradient(135deg,#f5b60b,#b45309)",border:"none",borderRadius:9,padding:"8px 16px",fontSize:12,fontWeight:800,color:"#180e00",cursor:"pointer",boxShadow:"0 2px 10px rgba(245,158,11,.35)"}}>Continuar</button>
            <button onClick={()=>{if(window.confirm("Excluir este rascunho? Essa ação não pode ser desfeita."))clearDraft();}} aria-label="Excluir rascunho" style={{background:"transparent",border:"1px solid #47556955",borderRadius:8,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",color:"#94a3b8",cursor:"pointer",fontSize:15,flexShrink:0,padding:0}}>×</button>
          </div>
        )}

        <div style={{width:"100%"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{height:1,flex:1,background:"linear-gradient(90deg,transparent,#1e293b)"}}/>
            <div style={{fontSize:11,color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5}}>Seleção de Projeto</div>
            <div style={{height:1,flex:1,background:"linear-gradient(90deg,#1e293b,transparent)"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              {key:"golgi",   label:"Projetos Golgi", sub:"P601 — P607",    color:"#1d4ed8", ids:["P601","P602","P604","P605","P606","P607"]},
              {key:"mega",    label:"Projetos Mega",  sub:"P311A, P311B",   color:"#0ea5e9", ids:["P311A","P311B"]},
              {key:"klog",    label:"Projetos Klog",  sub:"P505",           color:"#16a34a", ids:["P505"]},
              {key:"jatinox", label:"Jatinox",        sub:"P260A · B · C",  color:"#7c3aed", ids:["P260A"]},
            ].map(grp=>{
              const grpProjects = grp.ids.map(id=>PROJECTS[id]).filter(Boolean);
              const healths = grpProjects.map(p=>{const hist=stored[p.id]?.history??[];const last=hist.slice(-1)[0];return last?computeHealth(p,last.state):null;}).filter(Boolean);
              const hasProblems = healths.some(h=>h.pct<90);
              const avgPct = healths.length?Math.round(healths.reduce((a,h)=>a+h.pct,0)/healths.length):null;
              const totalInop = healths.reduce((a,h)=>a+h.inop,0);
              return(
                <button key={grp.key} onClick={()=>{setHomeGroup(grp.key);setJatinoxSel(null);}}
                  style={{background:"linear-gradient(165deg,#0c1526 0%,#060c18 65%)",border:`1.5px solid ${hasProblems?grp.color+"99":grp.color+"44"}`,borderRadius:20,padding:"20px 14px 18px",cursor:"pointer",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:8,position:"relative",boxShadow:`0 12px 30px rgba(0,0,0,.55), 0 0 20px ${grp.color}12, inset 0 1px 0 rgba(255,255,255,.05)`}}>
                  {hasProblems&&<div style={{position:"absolute",top:10,right:10,width:8,height:8,borderRadius:"50%",background:"#ef4444",boxShadow:"0 0 8px #ef4444aa",animation:"mkGlow 1.6s infinite"}}/>}
                  <svg width="52" height="44" viewBox="0 0 52 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 18L26 4L48 18V42H4V18Z" stroke={grp.color} strokeWidth="2.5" strokeLinejoin="round" fill={grp.color+"11"}/>
                    <rect x="18" y="26" width="16" height="16" rx="1" stroke={grp.color} strokeWidth="2" fill={grp.color+"22"}/>
                    <rect x="10" y="20" width="8" height="8" rx="1" stroke={grp.color} strokeWidth="1.5" fill="none"/>
                    <rect x="34" y="20" width="8" height="8" rx="1" stroke={grp.color} strokeWidth="1.5" fill="none"/>
                    <line x1="26" y1="26" x2="26" y2="42" stroke={grp.color} strokeWidth="1.5"/>
                  </svg>
                  <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9",lineHeight:1.2}}>{grp.label}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{grp.sub}</div>
                  {avgPct!==null?(
                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                      <StatusRing pct={avgPct} size={64} color={avgPct>=90?"#22c55e":avgPct>=70?"#f59e0b":"#ef4444"}/>
                      {totalInop>0&&<span style={{fontSize:12,color:"#ef4444",fontWeight:700}}>{totalInop} inop</span>}
                    </div>
                  ):(
                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                      <StatusRing empty size={64} color="#7c3aed"/>
                      <span style={{fontSize:12,color:"#a78bfa"}}>Sem dados</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* 🚨 KeyAccess Falha — registro rápido de campo, sem PIN. Cor reage a falhas realmente abertas */}
          <button onClick={()=>setShowKeyAccess(true)}
            style={{marginTop:10,width:"100%",background:keyAccessOpenCount>0?"linear-gradient(160deg,#1e0505,#12060a)":"linear-gradient(165deg,#0c1526 0%,#060c18 65%)",border:`1px solid ${keyAccessOpenCount>0?"#ef444466":"#263248"}`,borderRadius:16,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left",boxShadow:keyAccessOpenCount>0?"0 8px 22px rgba(0,0,0,.5), 0 0 22px #ef444426":"0 8px 22px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04)"}}>
            <div style={{flexShrink:0,width:44,height:44,borderRadius:12,background:dark?"#0f172a":"#fff",border:`1px solid ${keyAccessOpenCount>0?"#ef444444":"#22c55e44"}`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M5 4v14" stroke={keyAccessOpenCount>0?"#ef4444":"#22c55e"} strokeWidth="2.6" strokeLinecap="round"/>
                <path d="M9 11l3 3 6-7" stroke={keyAccessOpenCount>0?"#ef4444":"#22c55e"} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {keyAccessOpenCount>0&&<div style={{position:"absolute",bottom:-4,right:-4,width:16,height:16,borderRadius:"50%",background:"#ef4444",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff",border:`2px solid ${dark?"#04080f":"#fef2f2"}`}}>{keyAccessOpenCount>9?"9+":keyAccessOpenCount}</div>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:800,color:keyAccessOpenCount>0?"#ef4444":(dark?"#f1f5f9":"#1e293b")}}>KeyAccess Falha</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>{keyAccessOpenCount>0?`${keyAccessOpenCount} falha${keyAccessOpenCount!==1?"s":""} aberta${keyAccessOpenCount!==1?"s":""} agora`:"Registrar falha de acesso/saída em campo"}</div>
            </div>
            <span style={{color:keyAccessOpenCount>0?"#ef4444":"#94a3b8",fontSize:18,flexShrink:0}}>›</span>
          </button>

          {(()=>{
            const allP=Object.values(PROJECTS);
            const valid=allP.map(p=>{const hist=stored[p.id]?.history??[];const last=hist.slice(-1)[0];return last?computeHealth(p,last.state):null;}).filter(Boolean);
            if(!valid.length) return null;
            const avg=Math.round(valid.reduce((a,h)=>a+h.pct,0)/valid.length);
            const totalInop=valid.reduce((a,h)=>a+h.inop,0);
            return(
              <div style={{marginTop:10,background:"linear-gradient(165deg,#0a1a12 0%,#060c18 70%)",border:"1px solid #22c55e2e",borderRadius:14,padding:"12px 14px",boxShadow:"0 8px 22px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04)"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{fontSize:11,color:"#a8b6c8",fontWeight:700}}>Saúde Geral da Operação</div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    {totalInop>0&&<span style={{fontSize:11,color:"#ef4444",fontWeight:700}}>🔴 {totalInop} inop</span>}
                    <span style={{fontSize:17,fontWeight:900,color:avg>=90?"#22c55e":avg>=70?"#f59e0b":"#ef4444",textShadow:`0 0 12px ${avg>=90?"#22c55e":avg>=70?"#f59e0b":"#ef4444"}55`}}>{avg}%</span>
                  </div>
                </div>
                <div style={{height:6,background:"#0f172a",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${avg}%`,background:`linear-gradient(90deg,${avg>=90?"#16a34a,#22c55e":avg>=70?"#d97706,#f59e0b":"#dc2626,#ef4444"})`,borderRadius:4,boxShadow:`0 0 12px ${avg>=90?"#22c55e":"#f59e0b"}66`}}/>
                </div>
              </div>
            );
          })()}
        </div>

        <div style={{fontSize:10,color:"#64748b",opacity:.7,textAlign:"center",lineHeight:1.8}}>MokLog CheckTest © Moked Consulting Security</div>
      </div>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S={
  page:{minHeight:"100vh",background:"radial-gradient(ellipse at 50% -5%, #0a1628 0%, #04080f 55%)",display:"flex",justifyContent:"center",padding:"0 0 60px",fontFamily:"'Segoe UI',system-ui,sans-serif"},
  homeWrap:{width:"100%",maxWidth:440,padding:"40px 16px 40px",display:"flex",flexDirection:"column",gap:14},
  formWrap:{width:"100%",maxWidth:720,padding:"16px 12px 40px",display:"flex",flexDirection:"column",gap:8},
  primaryBtn:{background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",border:"none",borderRadius:12,padding:"14px 16px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,boxShadow:"0 4px 20px rgba(29,78,216,.3), inset 0 1px 0 rgba(255,255,255,.08)"},
  secBtn:{background:"linear-gradient(165deg,#0c1526,#060c18)",color:"#94a3b8",border:"1px solid #1e293b",borderRadius:12,padding:"14px 16px",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5,boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"},
  backBtn:{background:"transparent",border:"1px solid #1e293b",color:"#94a3b8",borderRadius:8,padding:"7px 12px",fontSize:12,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap",fontWeight:600},
  projCard:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(165deg,#0c1526,#060c18)",border:"1px solid #1e293b",borderRadius:14,padding:"12px 14px",cursor:"pointer",width:"100%",textAlign:"left",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"},
  metaCard:{background:"linear-gradient(165deg,#0c1526,#060c18)",borderRadius:14,padding:"14px 16px",border:"1px solid #1e293b",boxShadow:"0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)"},
  lbl:{display:"block",fontSize:11,color:"#94a3b8",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:.5},
  inp:{width:"100%",background:"#020510",border:"1px solid #1e293b",borderRadius:8,color:"#e2e8f0",padding:"10px 12px",fontSize:13,boxSizing:"border-box",outline:"none"},
  accordion:{width:"100%",background:"transparent",border:"none",display:"flex",alignItems:"center",gap:8,padding:"12px 4px",cursor:"pointer"},
  catCard:{background:"linear-gradient(165deg,#0c1526,#060c18)",borderRadius:12,padding:"12px 14px",margin:"0 0 6px",border:"1px solid #1e293b",boxShadow:"0 2px 10px rgba(0,0,0,.25)"},
  catHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:5},
  catLabel:{fontSize:13,fontWeight:700,color:"#94a3b8"},
  itemRow:{display:"flex",alignItems:"center",gap:6},
  iLabel:{fontSize:12,color:"#94a3b8",minWidth:80,flexShrink:0},
  tog:{background:"#020510",border:"1px solid #1e293b",color:"#94a3b8",borderRadius:8,padding:"7px 12px",fontSize:12,cursor:"pointer",fontWeight:600},
  togOk:{background:"#021a0d",border:"1px solid #22c55e",color:"#22c55e"},
  togPartial:{background:"#1a130a",border:"1px solid #f59e0b",color:"#f59e0b"},
  togBad:{background:"#1a0202",border:"1px solid #ef4444",color:"#ef4444"},
  sm:{background:"#020510",border:"1px solid #1e293b",color:"#94a3b8",borderRadius:6,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:600},
  smOk:{background:"#021a0d",border:"1px solid #22c55e",color:"#22c55e"},
  smPartial:{background:"#1a130a",border:"1px solid #f59e0b",color:"#f59e0b"},
  smBad:{background:"#1a0202",border:"1px solid #ef4444",color:"#ef4444"},
  iconBtn:{background:"#020510",border:"1px solid #0f172a",color:"#64748b",borderRadius:5,width:24,height:24,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,flexShrink:0},
  addBtn:{background:"transparent",border:"1px dashed #0f172a",color:"#94a3b8",borderRadius:7,padding:"6px 12px",fontSize:11,cursor:"pointer",marginTop:4},
  subRow:{display:"flex",flexDirection:"column",gap:6,marginTop:8,paddingTop:8,borderTop:"1px solid #0f172a"},
};
