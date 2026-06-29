import React, { useState, useEffect, useCallback, useRef } from "react";
import AcessoApp from "./Acesso";
import KeyAccessFalha from "./KeyAccessFalha";
import EquipeApp from "./Equipe";
import AcessoCCO from "./AcessoCCO";
import EmpresaInfo from "./EmpresaInfo";
import Equipamentos from "./Equipamentos";
import Visita from "./Visita";
import Perimetral from "./Perimetral";
import Intervalos from "./Intervalos";
import CCO from "./CCO";
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
            <div style={{fontSize:11,color:"#64748b",marginBottom:20,background:"#0f0202",borderRadius:8,padding:"8px 12px",textAlign:"left",wordBreak:"break-word"}}>
              {friendlyMsg}
            </div>
            <button onClick={()=>this.setState({hasError:false,error:null,errorInfo:null})}
              style={{background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",border:"none",borderRadius:10,padding:"12px 24px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",marginBottom:8}}>
              🔄 Tentar novamente
            </button>
            <button onClick={()=>window.location.reload()}
              style={{background:"transparent",color:"#64748b",border:"1px solid #1e293b",borderRadius:10,padding:"10px 24px",fontSize:13,fontWeight:600,cursor:"pointer",width:"100%"}}>
              ↩ Recarregar app
            </button>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:12}}>
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
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, onSnapshot } from "firebase/firestore";

const EMAILJS_SERVICE_ID  = "service_k7e0d0j";
const EMAILJS_TEMPLATE_ID = "template_dhncs7j";
const EMAILJS_PUBLIC_KEY  = "qnGBgZu7xNKnavJb7";

async function sendEmailJS(subject, message, fromName) {
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
const SESSION_TIMEOUT = 10 * 60 * 1000;
const PROJECT_SESSION_TIMEOUT = 45 * 60 * 1000; // sessão de PIN por projeto: 45min, compartilhada entre CCO/Equipe/Equipamentos/Empresas/Visita
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
    const todayStr = now.toISOString().split("T")[0];
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

// Projetos elegíveis ao Teste Perimetral universal — todos os centros logísticos, exceto Jatinox (P260A/B/C)
const PERIMETRAL_ELIGIBLE = ["P601","P602","P604","P605","P606","P607","P311A","P311B","P505"];
const PROJECTS = {
  P601: {
    id:"P601", name:"Golgi Cajamar", short:"Cajamar",
    categories:[
      {id:"fire",label:"01 - Alarme de Inc\u00eandio",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"panic_mob",label:"02 - P\u00e2nico M\u00f3vel",type:"items",itemLabels:["L\u00edder","Ronda 01","Ronda 02","Reserva"]},
      {id:"panic_fix",label:"03 - P\u00e2nico Fixo",type:"items",itemLabels:["CCO 01","CCO 02","Fixo Externo"]},
      {id:"perimeter",label:"04 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04"]},
      {id:"bollards",label:"05 - Bollards / Pinos",type:"items",itemLabels:["01","02","03","04","05","06","07"]},
      {id:"cftv",label:"06 - CFTV",type:"count",total:70},
      {id:"ac",label:"07 - Ar-Condicionado",type:"items",itemLabels:["CCO 01","CCO 02","CCO 03","Portaria 01"]},
      {id:"portas_cco",label:"08 - Portas CCO",type:"items",itemLabels:["Entrada","Sa\u00edda"]},
      {id:"internet",label:"09 - Internet",type:"single"},
      {id:"totem_vis",label:"10 - Totem Visitantes",type:"items",itemLabels:["Totem 01"]},
      {id:"totem_mot",label:"11 - Totem Motorista",type:"items",itemLabels:["Totem 01"]},
      {id:"monitores",label:"12 - Monitores CCO",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03","Monitor 04"]},
      {id:"torniquetes",label:"13 - Torniquetes / QR Code",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 01","Sa\u00edda 02"]},
      {id:"paradox",label:"14 - Paradox",type:"items",itemLabels:["CCO"]},
      {id:"cancelas",label:"15 - Cancelas",type:"items",itemLabels:["Inclusa 01","Inclusa 02","Inclusa 03","Inclusa 04","Inclusa 05","Bollard 01","Bollard 02","Bollard 03","Bollard 04"]},
      {id:"qr_cancelas",label:"16 - Leitores QR Cancelas",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Entrada 05","Entrada 06","Entrada 07","Entrada 08","Entrada 09","Entrada 10","Sa\u00edda 01","Sa\u00edda 02","Sa\u00edda 03","Sa\u00edda 04","Sa\u00edda 05","Sa\u00edda 06","Sa\u00edda 07","Sa\u00edda 08","Sa\u00edda 09","Sa\u00edda 10"]},
      {id:"semaforos",label:"17 - Sem\u00e1foros",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Entrada 05","Sa\u00edda 01","Sa\u00edda 02","Sa\u00edda 03","Sa\u00edda 04","Sa\u00edda 05"]},
      {id:"sensores",label:"18 - Sensores Anti-esmagamento",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Entrada 05","Sa\u00edda 01","Sa\u00edda 02","Sa\u00edda 03","Sa\u00edda 04","Sa\u00edda 05"]},
      {id:"nobreaks",label:"19 - Nobreaks",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"mesa",label:"20 - Mesa Controladora / Botoeira",type:"items",itemLabels:["Mesa 01","Mesa 02"]},
      {id:"telefone",label:"21 - Telefone CCO",type:"items",itemLabels:["CCO"]},
      {id:"reverso",label:"22 - Reverso Inclusa",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Entrada 05","Sa\u00edda 01","Sa\u00edda 02","Sa\u00edda 03","Sa\u00edda 04","Sa\u00edda 05"]},
      {id:"interfone",label:"23 - Interfones",type:"items",itemLabels:["CCO","Apoio Motorista"]},
      {id:"joystick",label:"24 - Joystick",type:"items",itemLabels:["CCO"]},
      {id:"manutencao",label:"25 - Visita de Manuten\u00e7\u00e3o",type:"maintenance"},
      {id:"infra",label:"26 - Infraestrutura / Obs.",type:"notes"},
    ]
  },
  P602: {id:"P602",name:"Golgi Mau\u00e1",short:"Mau\u00e1",categories:[{id:"fire",label:"01 - Alarme de Inc\u00eandio",type:"items",itemLabels:["CCO","Portaria"]},{id:"garras",label:"02 - Garras (Eclusas)",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 01","Sa\u00edda 02"]},{id:"portoes_eclusa",label:"03 - Port\u00f5es Eclusa",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 01","Sa\u00edda 02"]},{id:"torniquetes",label:"04 - Torniquetes",type:"items",itemLabels:["Torniquete 01","Torniquete 02"]},{id:"qr_torn",label:"05 - QR Torniquetes",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 01","Sa\u00edda 02"]},{id:"qr_eclusas",label:"06 - QR Eclusas",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Sa\u00edda 01","Sa\u00edda 02","Sa\u00edda 03","Sa\u00edda 04"]},{id:"portaria",label:"07 - Portaria",type:"items",itemLabels:["Tablet","Joystick","Ar-Condicionado","Transformador"]},{id:"cco_equip",label:"08 - CCO (Equipamentos)",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03","Ar-Condicionado","Mesa Gatbox","Joystick","CPU 01","CPU 02","CPU 03"]},{id:"cftv",label:"09 - CFTV",type:"count",total:42},{id:"token",label:"10 - Totem ATM",type:"items",itemLabels:["Entrada","Sa\u00edda"]},{id:"internet",label:"11 - Internet",type:"single"},{id:"perimeter",label:"12 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04"]},{id:"ac",label:"13 - Ar-Condicionado",type:"items",itemLabels:["CCO 01","Portaria 01"]},{id:"manutencao",label:"14 - Visita de Manuten\u00e7\u00e3o",type:"maintenance"},{id:"infra",label:"15 - Infraestrutura / Obs.",type:"notes"}]},
  P604: {id:"P604",name:"Golgi Jundia\u00ed",short:"Jundia\u00ed",categories:[{id:"fire",label:"01 - Alarme de Inc\u00eandio (Repetidoras)",type:"items",itemLabels:["Repetidora 01","Repetidora 02","Repetidora 03","Repetidora 04"]},{id:"monitores_cco",label:"02 - Monitores CCO",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03","Monitor 04","Monitor 05"]},{id:"cftv",label:"03 - CFTV",type:"count",total:73},{id:"joystick",label:"04 - Mesa Joystick",type:"items",itemLabels:["CCO"]},{id:"nobreak",label:"05 - Nobreak",type:"items",itemLabels:["CCO"]},{id:"paradox",label:"06 - Paradox",type:"items",itemLabels:["CCO","Recep\u00e7\u00e3o"]},{id:"mesa_cco",label:"07 - Mesa Controle / Botoeiras CCO",type:"items",itemLabels:["CCO"]},{id:"telefone",label:"08 - Telefone",type:"items",itemLabels:["CCO","Recep\u00e7\u00e3o"]},{id:"interfone",label:"09 - Interfone / Intercomunicador",type:"items",itemLabels:["CCO","Recep\u00e7\u00e3o"]},{id:"ac",label:"10 - Ar-Condicionado",type:"items",itemLabels:["CCO 01","CCO 02","Recep\u00e7\u00e3o"]},{id:"cancelas_baia",label:"11 - Cancelas (Baia)",type:"items",itemLabels:["Cancela 01","Cancela 02","Cancela 03","Cancela 04"]},{id:"cancelas_estac",label:"12 - Cancelas Estac. (Rec. Facial)",type:"items",itemLabels:["Cancela 01","Cancela 02"]},{id:"semaforos",label:"13 - Sem\u00e1foros (Baia)",type:"items",itemLabels:["Sem\u00e1foro 01","Sem\u00e1foro 02","Sem\u00e1foro 03","Sem\u00e1foro 04"]},{id:"bollards",label:"14 - Pinos Bollards",type:"items",itemLabels:["Pino 01","Pino 02","Pino 03","Pino 04","Pino 05","Pino 06","Pino 07","Pino 08"]},{id:"sensores",label:"15 - Sensores Anti-esmagamento",type:"items",itemLabels:["Sensor 01","Sensor 02","Sensor 03","Sensor 04"]},{id:"totens_baia",label:"16 - Totens Controle Veicular",type:"items",itemLabels:["Totem 01","Totem 02","Totem 03","Totem 04"]},{id:"qr_baia",label:"17 - Leitores QR (Baia)",type:"items",itemLabels:["QR 01","QR 02","QR 03","QR 04","QR 05","QR 06","QR 07","QR 08"]},{id:"monitores_rec",label:"18 - Monitores Recep\u00e7\u00e3o",type:"items",itemLabels:["Monitor 01","Monitor 02"]},{id:"mesa_rec",label:"19 - Mesa Controle / Botoeiras Recep\u00e7\u00e3o",type:"items",itemLabels:["Recep\u00e7\u00e3o"]},{id:"torniquetes",label:"20 - Torniquetes",type:"items",itemLabels:["Torniquete 01","Torniquete 02","Torniquete 03","Torniquete 04"]},{id:"qr_torn",label:"21 - Leitores QR (Torniquetes)",type:"items",itemLabels:["QR 01","QR 02","QR 03","QR 04","QR 05","QR 06","QR 07","QR 08"]},{id:"totens_pedestre",label:"22 - Totens Auto Atendimento (Pedestres)",type:"items",itemLabels:["Totem 01","Totem 02","Totem 03","Totem 04"]},{id:"totem_motorista",label:"23 - Totem Motorista",type:"items",itemLabels:["Totem 01"]},{id:"internet",label:"24 - Internet",type:"single"},{id:"perimeter",label:"25 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04","Zona 05","Zona 06","Zona 07"]},{id:"manutencao",label:"26 - Visita de Manuten\u00e7\u00e3o",type:"maintenance"},{id:"infra",label:"27 - Infraestrutura / Obs.",type:"notes"}]},
  P605: {id:"P605",name:"Golgi Dutra",short:"Dutra",categories:[{id:"panic_fix",label:"01 - P\u00e2nico Fixo",type:"items",itemLabels:["CCO","Portaria"]},{id:"panic_mob",label:"02 - P\u00e2nico M\u00f3vel",type:"items",itemLabels:["GA L\u00edder 01","GA L\u00edder 02","GB VSPP 01","GB VSPP 02"]},{id:"giroflex",label:"03 - Giroflex Eclusas",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 03 Reversa","Sa\u00edda 04"]},{id:"fire",label:"04 - Alarme SDAI",type:"items",itemLabels:["Galp\u00e3o A","Galp\u00e3o B"]},{id:"bollards",label:"05 - Bollards / Pinos",type:"items",itemLabels:["Entrada 01 \u2013 Pino 01","Entrada 01 \u2013 Pino 02","Reversiva 02 \u2013 Pino 03","Reversiva 02 \u2013 Pino 04","Sa\u00edda 04 \u2013 Pino 05","Sa\u00edda 04 \u2013 Pino 06"]},{id:"cftv",label:"06 - CFTV",type:"count",total:54},{id:"monitores",label:"07 - Monitores",type:"items",itemLabels:["CCO 01","CCO 02","CCO 03","CCO 04","CCO 05","CCO 06","CCO 07","Portaria 01","Portaria 02","Portaria 03","Portaria 04"]},{id:"totens",label:"08 - Totens",type:"items",itemLabels:["Visitantes","Motorista (CDA)"]},{id:"cofres",label:"09 - Cofres",type:"items",itemLabels:["CCO","Portaria"]},{id:"cancelas",label:"10 - Cancelas",type:"items",itemLabels:["Entrada 01","Entrada 02 Reversa","Sa\u00edda 03 Reversa","Sa\u00edda 04"]},{id:"perimeter",label:"11 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04"]},{id:"eclusas",label:"12 - Eclusas",type:"items",itemLabels:["CCO Porta 01 Ext.","CCO Porta 02 Int.","Portaria Porta 01 Int.","Portaria Porta 01 Ext."]},{id:"internet",label:"13 - Internet",type:"items",itemLabels:["ADM","Visitantes"]},{id:"qr_cancelas",label:"14 - Leitores QR Cancelas",type:"items",itemLabels:["Entrada 01 \u2013 Sup","Entrada 01 \u2013 Inf","Entrada 02 \u2013 Sup","Entrada 02 \u2013 Inf","Sa\u00edda 03 \u2013 Sup","Sa\u00edda 03 \u2013 Inf","Sa\u00edda 04 \u2013 Sup","Sa\u00edda 04 \u2013 Inf"]},{id:"torniquetes",label:"15 - Torniquetes",type:"items",itemLabels:["Torniquete 01 E/S","Torniquete 02 E/S","Torniquete 03 E/S","Torniquete 04 E/S"]},{id:"mesa",label:"16 - Mesa Controladora",type:"items",itemLabels:["CCO","Portaria"]},{id:"semaforos",label:"17 - Sem\u00e1foros / L\u00e2mpadas Piloto",type:"items",itemLabels:["Entrada 01","Entrada 02 Reversa","Sa\u00edda 03 Reversa","Sa\u00edda 04"]},{id:"pictogramas",label:"18 - Pictogramas / Far\u00f3is",type:"items",itemLabels:["Farol 01","Farol 02","Farol 03","Farol 04","Farol 05","Farol 06"]},{id:"ac",label:"19 - Ar-Condicionado",type:"items",itemLabels:["CCO Servidores","CCO Monitores","Portaria"]},{id:"telefone",label:"20 - Telefones",type:"items",itemLabels:["CCO Ramal","CCO Emergencial","CCO Fixo","Portaria 01","Portaria 02"]},{id:"intercomunicador",label:"21 - Intercomunicadores",type:"items",itemLabels:["CCO","CDA","Elevador"]},{id:"joystick",label:"22 - Joystick Digifort",type:"items",itemLabels:["CCO","Portaria"]},{id:"nobreak",label:"23 - Nobreak CCO",type:"items",itemLabels:["CCO"]},{id:"manutencao",label:"24 - Visita de Manuten\u00e7\u00e3o",type:"maintenance"},{id:"infra",label:"25 - Infraestrutura / Obs.",type:"notes"}]},
  P606: {id:"P606",name:"Golgi Duque de Caxias",short:"Duque",categories:[{id:"fire",label:"01 - Alarme de Inc\u00eandio",type:"items",itemLabels:["CCO","Galp\u00e3o 01","Galp\u00e3o 02","Galp\u00e3o 03","Galp\u00e3o 04","Galp\u00e3o 05","Galp\u00e3o 06","Galp\u00e3o 07","Galp\u00e3o 08","Galp\u00e3o 09","Galp\u00e3o 10"]},{id:"portoes_portaria",label:"02 - Port\u00f5es Portaria",type:"items",itemLabels:["Port\u00e3o 01","Port\u00e3o 02","Port\u00e3o 03","Port\u00e3o 04","Port\u00e3o 05","Port\u00e3o 06"]},{id:"portoes_balanca",label:"03 - Port\u00f5es Balan\u00e7a HubLog",type:"items",itemLabels:["Port\u00e3o 01","Port\u00e3o 02","Port\u00e3o 03","Port\u00e3o 04"]},{id:"dilaceradores",label:"04 - Dilaceradores",type:"items",itemLabels:["Entrada 01","Reversiva 02","Sa\u00edda 03"]},{id:"cftv",label:"05 - CFTV",type:"count",total:72},{id:"monitores",label:"06 - Monitores",type:"items",itemLabels:["CCO 01","CCO 02","CCO 03","CCO 04","CCO 05","Portaria 01"]},{id:"joystick",label:"07 - Joystick CFTV",type:"items",itemLabels:["CCO"]},{id:"cancela",label:"08 - Cancela",type:"items",itemLabels:["Entrada Principal"]},{id:"perimeter",label:"09 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03"]},{id:"panic",label:"10 - Bot\u00f5es de P\u00e2nico",type:"items",itemLabels:["M\u00f3vel 01","M\u00f3vel 02","Fixo CCO","Fixo Recep\u00e7\u00e3o","Fixo Guarita"]},{id:"totens",label:"11 - Totens Keyaccess",type:"items",itemLabels:["\u00c1rea Externa","\u00c1rea Interna"]},{id:"qr_eclusas",label:"12 - Leitoras QR Eclusas",type:"items",itemLabels:["QR 01","QR 02","QR 03","QR 04","QR 05","QR 06","QR 07","QR 08","QR 09","QR 10","QR 11","QR 12"]},{id:"qr_torn",label:"13 - Leitoras QR Torniquetes",type:"items",itemLabels:["QR 01","QR 02","QR 03","QR 04"]},{id:"telefone",label:"14 - Telefone Fixo CCO",type:"items",itemLabels:["CCO"]},{id:"mesa",label:"15 - Mesa Controladora",type:"items",itemLabels:["Portaria","CFTV"]},{id:"interfone",label:"16 - Interfones",type:"items",itemLabels:["Portaria 01","Portaria 02","Portaria 03","Guarita Entrada"]},{id:"televisores",label:"17 - Televisores",type:"items",itemLabels:["Apoio Caminhoneiro","Recep\u00e7\u00e3o"]},{id:"manutencao",label:"18 - Visita de Manuten\u00e7\u00e3o",type:"maintenance"},{id:"infra",label:"19 - Infraestrutura / Obs.",type:"notes"}]},
  P607: {id:"P607",name:"Golgi Bras\u00edlia",short:"Bras\u00edlia",categories:[{id:"fire",label:"01 - Alarme de Inc\u00eandio",type:"items",itemLabels:["Painel CCO","Painel Guarita","Painel ADM"]},{id:"cftv",label:"02 - CFTV",type:"count",total:44},{id:"monitores_cco",label:"03 - Monitores CCO",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03"]},{id:"monitor_ka",label:"04 - Monitor KeyAccess",type:"items",itemLabels:["Monitor 01"]},{id:"joystick",label:"05 - Joystick",type:"items",itemLabels:["CCO"]},{id:"nobreak",label:"06 - Nobreak",type:"items",itemLabels:["CCO"]},{id:"ac",label:"07 - Ar-Condicionado CCO",type:"items",itemLabels:["Aparelho 01"]},{id:"botoeiras",label:"08 - Botoeiras Port\u00f5es",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 01","Sa\u00edda 02"]},{id:"perimeter",label:"09 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04"]},{id:"panic",label:"10 - P\u00e2nico M\u00f3vel",type:"items",itemLabels:["Ronda","Pista","CCO"]},{id:"totens",label:"11 - Totens",type:"items",itemLabels:["Entrada","Sa\u00edda"]},{id:"qr_leitores",label:"12 - Leitores QR Code",type:"items",itemLabels:["Torniquete 1 Entrada","Torniquete 1 Sa\u00edda","Torniquete 2 Entrada","Torniquete 2 Sa\u00edda","Eclusa Ent 1 \u2013 QR 01","Eclusa Ent 1 \u2013 QR 02","Eclusa Ent 2 \u2013 QR 01","Eclusa Ent 2 \u2013 QR 02","Eclusa Sa\u00ed 1 \u2013 QR 01","Eclusa Sa\u00ed 1 \u2013 QR 02","Eclusa Sa\u00ed 2 \u2013 QR 01","Eclusa Sa\u00ed 2 \u2013 QR 02"]},{id:"tablets",label:"13 - Tablets KeyAccess",type:"items",itemLabels:["Tablet 01","Tablet 02"]},{id:"portoes",label:"14 - Port\u00f5es",type:"items",itemLabels:["Eclusa Ent 1 \u2013 P01","Eclusa Ent 1 \u2013 P02","Eclusa Ent 2 \u2013 P01","Eclusa Ent 2 \u2013 P02","Eclusa Sa\u00ed 1 \u2013 P01","Eclusa Sa\u00ed 1 \u2013 P02","Eclusa Sa\u00ed 2 \u2013 P01","Eclusa Sa\u00ed 2 \u2013 P02"]},{id:"motores",label:"15 - Motores dos Port\u00f5es",type:"items",itemLabels:["Ent 1 \u2013 M01","Ent 1 \u2013 M02","Ent 1 \u2013 M03","Ent 2 \u2013 M01","Ent 2 \u2013 M02","Ent 2 \u2013 M03","Sa\u00ed 1 \u2013 M01","Sa\u00ed 1 \u2013 M02","Sa\u00ed 1 \u2013 M03","Sa\u00ed 1 \u2013 M04","Sa\u00ed 2 \u2013 M01","Sa\u00ed 2 \u2013 M02","Sa\u00ed 2 \u2013 M03","Sa\u00ed 2 \u2013 M04"]},{id:"sensores",label:"16 - Sensores dos Port\u00f5es",type:"items",itemLabels:["Ent 1 \u2013 S01","Ent 1 \u2013 S02","Ent 1 \u2013 S03","Ent 1 \u2013 S04","Ent 2 \u2013 S01","Ent 2 \u2013 S02","Ent 2 \u2013 S03","Ent 2 \u2013 S04","Sa\u00ed 1 \u2013 S01","Sa\u00ed 1 \u2013 S02","Sa\u00ed 1 \u2013 S03","Sa\u00ed 1 \u2013 S04","Sa\u00ed 2 \u2013 S01","Sa\u00ed 2 \u2013 S02","Sa\u00ed 2 \u2013 S03","Sa\u00ed 2 \u2013 S04"]},{id:"anti_esmag",label:"17 - Anti-esmagamento",type:"items",itemLabels:["Eclusa Ent 1 \u2013 AE 01","Eclusa Ent 1 \u2013 AE 02","Eclusa Ent 2 \u2013 AE 01","Eclusa Ent 2 \u2013 AE 02"]},{id:"guarita",label:"18 - Guarita / Recep\u00e7\u00e3o",type:"items",itemLabels:["Computador","Monitor 01","Monitor 02","Modem Internet"]},{id:"manutencao",label:"19 - Visita de Manuten\u00e7\u00e3o",type:"maintenance"},{id:"infra",label:"20 - Infraestrutura / Obs.",type:"notes"}]},
  P311A: {id:"P311A",name:"Mega CL Curitiba",short:"Curitiba",categories:[{id:"cftv",label:"01 - CFTV",type:"count",total:140},{id:"perimeter",label:"02 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Alambrado/Gradil"]},{id:"botoeiras",label:"03 - Botoeiras / Port\u00f5es de Acesso",type:"items",itemLabels:["Bot\u00e3o 01","Bot\u00e3o 02","Bot\u00e3o 03","Bot\u00e3o 04","Bot\u00e3o 05","Bot\u00e3o 06"]},{id:"panic",label:"04 - Bot\u00f5es de P\u00e2nico",type:"items",itemLabels:["L\u00edder","CCO"]},{id:"alertas",label:"05 - Recebimento de Alertas Externos",type:"items",itemLabels:["Central Moked","Central Auxiliar"]},{id:"portas_cco",label:"06 - CCO / Abertura de Portas",type:"items",itemLabels:["Porta 01 Externa","Porta 02 Interna"]},{id:"keyaccess",label:"07 - Sistema KeyAccess",type:"items",itemLabels:["Torniquete 01","Torniquete 02","Torniquete 03"]},{id:"totens",label:"08 - Totens de Autoatendimento",type:"items",itemLabels:["Entrada","Sa\u00edda"]},{id:"qr_code",label:"09 - Leitores de QR Code",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Sa\u00edda 01","Sa\u00edda 02","Sa\u00edda 03"]},{id:"computadores",label:"10 - Computadores / CCO",type:"items",itemLabels:["Computador 01","Computador 02","Internet/Rede"]},{id:"portoes",label:"11 - Port\u00f5es",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Sa\u00edda 01","Sa\u00edda 02"]},{id:"cancelas",label:"12 - Cancelas de Acesso",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Sa\u00edda 01","Sa\u00edda 02"]},{id:"dilaceradores",label:"13 - Dilaceradores",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Sa\u00edda 04","Sa\u00edda 05"]},{id:"ac",label:"14 - Ar-Condicionado",type:"items",itemLabels:["CCO","Sala T\u00e9cnica","Sala Gest\u00e3o"]},{id:"intercomunicadores",label:"15 - Intercomunicadores",type:"items",itemLabels:["Portaria"]},{id:"sdai",label:"16 - SDAI (Inc\u00eandio)",type:"items",itemLabels:["Central 01","Central 02","Central 03","Central 04","Central 05"]},{id:"materiais",label:"17 - Materiais Operacionais",type:"items",itemLabels:["Smartphone (x3)","Lanterna (x2)","Armamento (x2)","Muni\u00e7\u00e3o (x36)","R\u00e1dio HT (x3)","Bodycam (x3)","Moto de Ronda","P\u00e2nico ZTRAX (x2)"]},{id:"manutencao",label:"18 - Visita de Manuten\u00e7\u00e3o",type:"maintenance"},{id:"infra",label:"19 - Infraestrutura / Obs.",type:"notes"}]},
  P311B: {id:"P311B",name:"Mega CL Itaja\u00ed",short:"Itaja\u00ed",categories:[{id:"cftv",label:"01 - CFTV",type:"count",total:114},{id:"perimeter",label:"02 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04","Zona 05","Zona 06"]},{id:"botoeiras",label:"03 - Botoeiras do Dilacerador",type:"items",itemLabels:["Botoeira 01","Botoeira 02","Botoeira 03"]},{id:"panic",label:"04 - Bot\u00f5es de P\u00e2nico",type:"items",itemLabels:["CCO Fixo","Ronda M\u00f3vel","L\u00edder M\u00f3vel"]},{id:"portas_cco",label:"05 - CCO / Controle de Acesso",type:"items",itemLabels:["Porta 01 Externa \u2013 Local","Porta 01 Externa \u2013 Remota","Porta 02 Interna \u2013 Local","Porta 02 Interna \u2013 Remota"]},{id:"keyaccess",label:"06 - Sistema KeyAccess",type:"items",itemLabels:["Catraca 01","Catraca 02","Catraca 03"]},{id:"totens_cancela",label:"07 - Totens nas Cancelas",type:"items",itemLabels:["Totem Cancela 01","Totem Cancela 02","Totem Cancela 03","Totem Cancela 04","Totem Cancela 05","Totem Cancela 06"]},{id:"qr_code",label:"08 - Leitores QR Code",type:"items",itemLabels:["Cancela 01 Sup","Cancela 01 Inf","Cancela 02 Sup","Cancela 02 Inf","Cancela 04 Sup","Cancela 04 Inf","Sa\u00edda Cancela 02 Sup","Sa\u00edda Cancela 02 Inf","Sa\u00edda Cancela 03 Sup","Sa\u00edda Cancela 03 Inf","Sa\u00edda Cancela 04 Sup","Sa\u00edda Cancela 04 Inf"]},{id:"computadores",label:"09 - Computadores / CCO",type:"items",itemLabels:["Computador Principal","Computador Secund\u00e1rio","Internet"]},{id:"portoes",label:"10 - Port\u00f5es",type:"items",itemLabels:["Port\u00e3o 01","Port\u00e3o 02","Port\u00e3o 03","Port\u00e3o 04"]},{id:"dilaceradores",label:"11 - Dilaceradores",type:"items",itemLabels:["Cancela 01","Cancela 02","Cancela 03","Cancela 04"]},{id:"ac",label:"12 - Ar-Condicionado",type:"items",itemLabels:["CCO","Sala T\u00e9cnica"]},{id:"materiais",label:"13 - Materiais Operacionais",type:"items",itemLabels:["Smartphone (x3)","Lanterna (x2)","Armamento (x2)","Muni\u00e7\u00e3o (x36)","R\u00e1dio HT (x3)","Bodycam (x2)","Moto de Ronda","P\u00e2nico ZTRAX (x2)"]},{id:"sdai",label:"14 - SDAI (Inc\u00eandio)",type:"items",itemLabels:["Central Portaria","Central Casa de Bombas","Central Sala T\u00e9cnica"]},{id:"manutencao",label:"15 - Visita de Manuten\u00e7\u00e3o",type:"maintenance"},{id:"infra",label:"16 - Infraestrutura / Obs.",type:"notes"}]},
  P505: {id:"P505",name:"Klog Guarulhos",short:"Guarulhos",categories:[{id:"panic",label:"01 - Bot\u00f5es de P\u00e2nico",type:"items",itemLabels:["Fixo CCO"]},{id:"giroflex",label:"02 - Giroflex das Eclusas",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 03 Reversiva","Sa\u00edda 04"]},{id:"sdai",label:"03 - Alarme SDAI Portaria",type:"items",itemLabels:["G100","G200"]},{id:"garra",label:"04 - Garra de Tigre",type:"items",itemLabels:["Eclusa Entrada 01","Eclusa Entrada 02","Eclusa Reversiva 03","Eclusa Sa\u00edda 04"]},{id:"cftv",label:"05 - CFTV",type:"count",total:73},{id:"monitores",label:"06 - Monitores CCO e Portaria",type:"items",itemLabels:["CCO 01","CCO 02","CCO 03","Portaria 01","Portaria 02","Portaria 03"]},{id:"totens",label:"07 - Totens Visitantes / Motoristas",type:"items",itemLabels:["Totem Visitantes","Totem Motoristas"]},{id:"cofres",label:"08 - Cofres",type:"items",itemLabels:["CCO","Portaria"]},{id:"cancelas",label:"09 - Cancelas, Hastes e Motores",type:"items",itemLabels:["Entrada 01","Entrada 02","Sa\u00edda 03 Reversiva","Sa\u00edda 04"]},{id:"perimeter",label:"10 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04","Zona 05","Zona 06","Zona 07","Zona 08","Zona 09","Zona 10","Zona 11","Zona 12"]},{id:"eclusas",label:"11 - Eclusas CCO e Portaria",type:"items",itemLabels:["CCO Porta 01 Ext \u2013 Local","CCO Porta 02 Int \u2013 Local","Portaria Porta 01 Int \u2013 Local","Portaria Porta 02 Ext \u2013 Local"]},{id:"internet",label:"12 - Internet",type:"single"},{id:"facial",label:"13 - Leitores Faciais Eclusas/Cancelas",type:"items",itemLabels:["Eclusa Entrada 01","Eclusa Entrada 02","Eclusa Sa\u00edda 03 Reversiva","Eclusa Sa\u00edda 04"]},{id:"torniquetes",label:"14 - Torniquetes Leitores Faciais",type:"items",itemLabels:["Torniquete 01 E/S","Torniquete 02 E/S","Torniquete 03 E/S","Torniquete 04 E/S"]},{id:"mesa",label:"15 - Mesa Controladora CCO e Portaria",type:"items",itemLabels:["CCO","Portaria"]},{id:"ac",label:"16 - Ar-Condicionado",type:"items",itemLabels:["CCO","Portaria Aparelho 01"]},{id:"telefone",label:"17 - Telefone Fixo CCO e Portaria",type:"items",itemLabels:["Ramal CCO","Ramal Portaria"]},{id:"intercomunicadores",label:"18 - Intercomunicadores",type:"items",itemLabels:["Portaria","CCO","Torniquetes","Cancelas"]},{id:"eletroima",label:"19 - Eletroim\u00e3 / Eclusa / Portas",type:"items",itemLabels:["Portaria","CCO","Eclusa"]},{id:"portoes",label:"20 - Port\u00f5es / Anti-esmagamento",type:"items",itemLabels:["Eclusa 01 Externa","Eclusa 01 Interna","Eclusa 02 Externa","Eclusa 02 Interna","Eclusa 03 Externa","Eclusa 03 Interna","Eclusa 04 Externa","Eclusa 04 Interna"]},{id:"farois",label:"21 - Far\u00f3is das Cancelas",type:"items",itemLabels:["Cancela Eclusa 01 Ext","Cancela Eclusa 01 Int","Cancela Eclusa 02 Ext","Cancela Eclusa 02 Int","Cancela Eclusa 03 Ext","Cancela Eclusa 03 Int","Cancela Eclusa 04 Ext"]},{id:"manutencao",label:"22 - Visita de Manuten\u00e7\u00e3o",type:"maintenance"},{id:"infra",label:"23 - Infraestrutura / Obs.",type:"notes"}]},
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

const todayStr = () => new Date().toISOString().split("T")[0];
const fmtDate = (d) => { if(!d)return"\u2014"; const[y,m,day]=d.split("-"); return`${day}/${m}/${y}`; };
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
      st[cat.id]=cat.itemLabels.map((_,i)=>{
        const p=prev[i]??{status:"ok"};
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
  const [customDate, setCustomDate] = useState(()=>new Date().toISOString().split("T")[0]);
  if(!confirm) return null;
  const goingOffline = confirm.status!=="offline"; // status atual antes do toque
  const label = project?.id || confirm.pid;
  return (
    <div onClick={onCancel} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#060c18",border:"1px solid #1e293b",borderRadius:14,padding:"20px 18px",maxWidth:360,width:"100%"}}>
        <div style={{fontSize:28,textAlign:"center",marginBottom:10}}>{goingOffline?"📵":"📷"}</div>
        <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9",textAlign:"center",marginBottom:6}}>
          {goingOffline ? `Confirmar CTMK Off-line — ${label}?` : `Confirmar volta do CTMK — ${label}?`}
        </div>
        <div style={{fontSize:12,color:"#94a3b8",textAlign:"center",lineHeight:1.5,marginBottom:goingOffline&&confirm.allowDateEdit?14:18}}>
          {goingOffline
            ? "Isso vai marcar a central de monitoramento remoto como sem imagem e começar a contar os dias offline."
            : "Isso vai zerar o contador de dias offline e guardar o período anterior no histórico."}
        </div>
        {goingOffline && confirm.allowDateEdit && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:5}}>Desde quando está off-line?</div>
            <input type="date" value={customDate} max={new Date().toISOString().split("T")[0]}
              onChange={e=>setCustomDate(e.target.value)}
              style={{width:"100%",background:"#020510",border:"1px solid #1e293b",borderRadius:8,color:"#f1f5f9",padding:"10px 12px",fontSize:14,boxSizing:"border-box"}}/>
            <div style={{fontSize:10,color:"#64748b",marginTop:4}}>Deixe como hoje se a queda acabou de acontecer. Mude a data se já está sem imagem há mais tempo.</div>
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onCancel} style={{flex:1,background:"#0f172a",border:"1px solid #1e293b",color:"#94a3b8",borderRadius:8,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Cancelar</button>
          <button onClick={()=>onConfirm(goingOffline&&confirm.allowDateEdit?customDate:undefined)}
            style={{flex:1,background:goingOffline?"linear-gradient(135deg,#dc2626,#991b1b)":"linear-gradient(135deg,#16a34a,#15803d)",border:"none",color:"#fff",borderRadius:8,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            Confirmar
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
      <div style={{flex:1,fontSize:10,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{itemLabel||catLabel}</div>
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
          {badge&&<span style={{fontSize:9,fontWeight:700,color:badge.color,background:badge.bg,padding:"1px 5px",borderRadius:8}}>{badge.label}</span>}
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
          <span style={{fontSize:11,color:"#475569"}}>{okN}/{values.length}</span>
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
          {badge&&<span style={{fontSize:9,fontWeight:700,color:badge.color,background:badge.bg,padding:"1px 5px",borderRadius:8}}>{badge.label}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:800,color:p===100?"#22c55e":"#ef4444"}}>{p}%</span>
          <span style={{fontSize:11,color:"#475569"}}>{total-inop.length}/{total} OK</span>
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
        <span style={{fontSize:11,color:visits.length?"#f59e0b":"#475569",fontWeight:700}}>{visits.length?`${visits.length} visita(s)`:"Nenhuma visita"}</span>
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
  const try_ = () => { if(pin===correct) onSuccess(); else setErr(true); };
  return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#060c18",border:"1px solid #1e293b",borderRadius:16,padding:"32px 28px",maxWidth:340,width:"100%",textAlign:"center",margin:16}}>
        <MoklogLogo size={48}/>
        <div style={{fontSize:17,fontWeight:800,color:"#f1f5f9",marginTop:10,marginBottom:2}}>MokLog <span style={{color:"#cc2222"}}>CheckTest</span></div>
        <div style={{fontSize:13,color:"#94a3b8",marginBottom:4}}>{project.id} - {project.name}</div>
        <div style={{fontSize:12,color:"#475569",marginBottom:20}}>Insira o PIN do projeto</div>
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

function Dashboard({stored, ctmkData={}, onToggleCtmk, onBack, onDeleteReport, onEditReport}) {
  const [ctmkConfirm, setCtmkConfirm] = useState(null);
  const ctmkInfoFor = (pid) => {
    try {
      const c = ctmkData[pid]; if(!c) return undefined;
      const days = c.status==="offline" && c.offlineSince ? Math.floor((Date.now()-new Date(c.offlineSince).getTime())/86400000) : null;
      return { status: c.status, days };
    } catch(e) { return undefined; }
  };
  const [pin,setPin]=useState(""); const [auth,setAuth]=useState(false); const [err,setErr]=useState(false);
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
    const t=setInterval(()=>{if(Date.now()-sessionTime>SESSION_TIMEOUT){setAuth(false);setPin("");}},30000);
    return ()=>clearInterval(t);
  },[auth,sessionTime]);
  const resetSess=()=>setSessionTime(Date.now());
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
        <div style={{fontSize:12,color:"#475569",marginBottom:20}}>Acesso restrito</div>
        <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pin}
          onChange={e=>{setPin(e.target.value);setErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter"){if(pin===ADMIN_PIN){setAuth(true);resetSess();}else setErr(true);}}}
          style={{...S.inp,textAlign:"center",fontSize:22,letterSpacing:10,marginBottom:10}}/>
        {err&&<div role="alert" style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
        <button onClick={()=>{if(pin===ADMIN_PIN){setAuth(true);resetSess();}else setErr(true);}} style={{...S.primaryBtn,width:"100%",marginBottom:10,fontSize:14}}>Entrar</button>
        <button onClick={onBack} style={{...S.secBtn,width:"100%",fontSize:14}} aria-label="Voltar">← Voltar</button>
      </div>
    </div>
  );
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
          <div style={{fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Ou selecione manualmente ({selWeeks.size} selecionada{selWeeks.size===1?"":"s"})</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:90}}>
            {availDates.length===0&&<div style={{fontSize:12,color:"#64748b",textAlign:"center",padding:20}}>Nenhum relatório encontrado para este grupo ainda.</div>}
            {availDates.map(d=>{
              const sel=selWeeks.has(d); const cnt=countForDate(d);
              return(
                <div key={d} onClick={()=>toggleWeek(d)} style={{display:"flex",alignItems:"center",gap:10,background:sel?"#0c1f3d":"#060c18",border:`1.5px solid ${sel?"#3b82f6":"#0f172a"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer"}}>
                  <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${sel?"#3b82f6":"#475569"}`,background:sel?"#3b82f6":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",flexShrink:0}}>{sel?"✓":""}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{getWeekLabel(d)} <span style={{fontSize:11,color:"#94a3b8",fontWeight:400}}>{fmtDate(d)}</span></div>
                  </div>
                  <div style={{fontSize:10,color:"#64748b",fontWeight:700}}>{cnt}/{ids.length} projetos</div>
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
          <button onClick={()=>generatePDF(
              viewReport.project||viewReport,
              viewReport.report?.state||viewReport.state,
              viewReport.report?.meta||viewReport.meta,
              [],
              ctmkInfoFor((viewReport.project||viewReport).id)
            )}
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
                <div style={{fontSize:10,color:"#64748b"}}>{viewToken?"Ativo":"Inativo"}</div>
              </div>
              <button onClick={()=>toggleViewLink(p.id)} style={{...S.sm,...(viewToken?S.smBad:S.smOk),fontSize:11,padding:"5px 10px"}}>
                {viewToken?"Desativar":"Ativar"}
              </button>
            </div>
            {viewToken&&<div style={{marginTop:8}}>
              <div style={{fontSize:9,color:"#64748b",wordBreak:"break-all",background:"#020510",padding:"5px 8px",borderRadius:5,marginBottom:5}}>{viewUrl}</div>
              <button onClick={()=>navigator.clipboard.writeText(viewUrl)} style={{...S.sm,fontSize:10,width:"100%"}}>📋 Copiar Link</button>
            </div>}
          </div>
          {sel.length>=2&&<button onClick={()=>generateConsolidatedPDF(p,sel.map(i=>hist[i]).sort((a,b)=>(a.meta?.date||"").localeCompare(b.meta?.date||"")))}
            style={{...S.primaryBtn,width:"100%",background:"linear-gradient(135deg,#7c3aed,#6d28d9)",marginBottom:8,fontSize:14}}>
            📊 Gerar Consolidado ({sel.length} semanas)</button>}
          {sel.length===0&&hist.length>0&&<div style={{background:"#0f172a",borderRadius:8,padding:"8px",textAlign:"center",fontSize:12,color:"#64748b",marginBottom:8}}>☑ Selecione 2 a 6 relatorios para consolidado</div>}
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
                      <div style={{fontSize:11,color:"#475569"}}>Lider: {r.meta?.leader||"—"} · CCO: {r.meta?.cco||"—"}</div>
                      {r.meta?.signature&&<div style={{fontSize:11,color:"#64748b"}}>✍ {r.meta.signature}</div>}
                      <div style={{fontSize:11,color:h.inop>0?"#ef4444":"#22c55e",fontWeight:600}}>{h.inop>0?`${h.inop} inop`:"✔ OK"}</div>
                    </div>
                  </div>
                  <div style={{marginTop:8,height:3,background:"#0f172a",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${h.pct}%`,background:color,borderRadius:2}}/>
                  </div>
                  <div style={{display:"flex",gap:6,marginTop:10}}>
                    <button onClick={()=>setViewReport({project:p,report:r,idx:realIdx})} style={{...S.secBtn,flex:1,padding:"9px",fontSize:12}}>👁 Ver</button>
                    <button onClick={()=>generatePDF(p,r.state,r.meta,[],ctmkInfoFor(p.id))} style={{...S.primaryBtn,flex:1,padding:"9px",fontSize:12,background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}}>📄 PDF</button>
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
              <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>{confirmDel.projectId} — {fmtDate(confirmDel.date)}</div>
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
            <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:900,color:avgPct>=90?"#22c55e":"#ef4444"}}>{avgPct}%</div><div style={{fontSize:9,color:"#64748b",fontWeight:700}}>SAÚDE GERAL</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:900,color:totalInopAll>0?"#ef4444":"#22c55e"}}>{totalInopAll}</div><div style={{fontSize:9,color:"#64748b",fontWeight:700}}>INOP TOTAL</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:26,fontWeight:900,color:criticalAlerts.length>0?"#ef4444":"#22c55e"}}>{criticalAlerts.length}</div><div style={{fontSize:9,color:"#64748b",fontWeight:700}}>ALERTAS</div></div>
          </div>
        </div>}
        {(getAvailableDates(GOLGI_IDS).length>0||getAvailableDates(MEGA_IDS).length>0)&&<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
          <div style={{fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>📊 Comparativo Interparques</div>
          {getAvailableDates(GOLGI_IDS).length>0&&<button onClick={()=>{setSelWeeks(new Set());setGroupCompScreen({label:"Golgi",ids:GOLGI_IDS});}} style={{...S.primaryBtn,width:"100%",background:"linear-gradient(135deg,#1d4ed8,#1e3a8a)",fontSize:13}}>📊 Comparativo Golgi</button>}
          {getAvailableDates(MEGA_IDS).length>0&&<button onClick={()=>{setSelWeeks(new Set());setGroupCompScreen({label:"Mega",ids:MEGA_IDS});}} style={{...S.primaryBtn,width:"100%",background:"linear-gradient(135deg,#0ea5e9,#0369a1)",fontSize:13}}>📊 Comparativo Mega</button>}
        </div>}
        {(()=>{const allPend=getAllPendencies(stored);return allPend.length>0?(<div style={{background:"#1a0202",border:"1px solid #ef444444",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",marginBottom:8}} onClick={()=>setPendScreen(true)}><div style={{fontSize:12,fontWeight:700,color:"#ef4444"}}>🔴 {allPend.filter(p=>p.status==="inop").length} Inop · ⚠️ {allPend.filter(p=>p.status==="partial").length} Parcial</div><span style={{color:"#ef4444",fontSize:14,fontWeight:700}}>Ver →</span></div>):null;})()}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {allProjects.map(p=>{const hist=stored[p.id]?.history??[];const last=hist.length?hist[hist.length-1]:null;const h=last?computeHealth(p,last.state):null;const color=h?h.pct>=90?"#22c55e":h.pct>=70?"#f59e0b":"#ef4444":"#334155";return(<div key={p.id} onClick={()=>setSelProject(p)} style={{background:"#060c18",border:`1px solid ${h?color+"44":"#0f172a"}`,borderRadius:12,padding:"14px 16px",cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:12}}>{h?<HealthRing pct={h.pct} size={50}/>:<div style={{width:50,height:50,borderRadius:"50%",border:"2px solid #1e293b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#94a3b8"}}>—</div>}<div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{p.id} – {p.name}</div>{h?<div style={{fontSize:11,color:"#475569",marginTop:2}}>Ultimo: {fmtDate(last.meta?.date)} · {h.inop} inop</div>:<div style={{fontSize:11,color:"#94a3b8"}}>Sem registros</div>}</div><CtmkBadge info={ctmkData[p.id]} onToggle={()=>setCtmkConfirm({pid:p.id, status: ctmkData[p.id]?.status||"online", allowDateEdit:true})} size="small"/></div>{h&&<div style={{marginTop:8,height:4,background:"#0f172a",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${h.pct}%`,background:color,borderRadius:2}}/></div>}</div>);})}
        </div>
      </div>
      {confirmDel&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16}}><div style={{background:"#060c18",border:"1px solid #ef4444",borderRadius:14,padding:"24px 20px",maxWidth:320,width:"100%",textAlign:"center"}}><div style={{fontSize:15,fontWeight:700,color:"#f1f5f9",marginBottom:6}}>Excluir relatorio?</div><div style={{fontSize:12,color:"#64748b",marginBottom:20}}>{confirmDel.projectId} — {fmtDate(confirmDel.date)}</div><div style={{display:"flex",gap:8}}><button onClick={()=>{onDeleteReport(confirmDel.projectId,confirmDel.idx);setConfirmDel(null);}} style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#b91c1c,#991b1b)",fontSize:14}}>Excluir</button><button onClick={()=>setConfirmDel(null)} style={{...S.secBtn,flex:1,fontSize:14}}>Cancelar</button></div></div></div>)}
      {ctmkConfirm&&<CtmkConfirmModal confirm={ctmkConfirm} project={{id:ctmkConfirm.pid}} onCancel={()=>setCtmkConfirm(null)} onConfirm={(date)=>{onToggleCtmk(ctmkConfirm.pid,date);setCtmkConfirm(null);}}/>}
    </div>
  );
}

function PendenciesScreen({stored, onBack}) {
  const [filter, setFilter] = useState("all");
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
          <div style={{background:"#060c18",border:"1px solid #ef444433",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:"#ef4444"}}>{critCount}</div><div style={{fontSize:10,color:"#64748b",fontWeight:700}}>INOP</div></div>
          <div style={{background:"#060c18",border:"1px solid #f59e0b33",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:"#f59e0b"}}>{partCount}</div><div style={{fontSize:10,color:"#64748b",fontWeight:700}}>PARCIAL</div></div>
          <div style={{background:"#060c18",border:"1px solid #1e293b",borderRadius:10,padding:"10px",textAlign:"center"}}><div style={{fontSize:22,fontWeight:900,color:"#94a3b8"}}>{all.length}</div><div style={{fontSize:10,color:"#64748b",fontWeight:700}}>TOTAL</div></div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {[["all","Todos",all.length],["critical","Inop",critCount],["partial","Parcial",partCount]].map(([key,label,count])=>(
            <button key={key} onClick={()=>setFilter(key)} style={{...S.sm,flex:1,padding:"7px",fontSize:11,...(filter===key?{background:"#1d4ed8",border:"1px solid #1d4ed8",color:"white"}:{})}}>{label} ({count})</button>
          ))}
        </div>
        {filtered.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:"#22c55e",fontSize:14}}><div style={{fontSize:28,marginBottom:8}}>✅</div>Nenhuma pendência encontrada!</div>}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {filtered.map((p,i)=>{
            const color = p.status==="inop" ? "#ef4444" : "#f59e0b";
            const urgency = p.days && p.days >= 30 ? "🔴" : p.days && p.days >= 14 ? "🟡" : "⚪";
            return(
              <div key={i} style={{background:"#060c18",border:`1px solid ${color}33`,borderRadius:10,padding:"10px 12px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <span style={{fontSize:14,flexShrink:0,marginTop:1}}>{urgency}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:3}}>
                      <span style={{fontSize:10,fontWeight:700,color:"#f1f5f9",background:"#0f172a",padding:"2px 6px",borderRadius:5}}>{p.project.id}</span>
                      <span style={{fontSize:10,fontWeight:700,color:color,background:color+"22",padding:"2px 6px",borderRadius:5}}>{p.status==="inop"?"INOP":"PARCIAL"}</span>
                      {p.days!==null&&<span style={{fontSize:10,color:p.days>=30?"#ef4444":p.days>=14?"#f59e0b":"#64748b",fontWeight:700}}>há {p.days} dia{p.days!==1?"s":""}</span>}
                    </div>
                    <div style={{fontSize:12,fontWeight:600,color:"#cbd5e1",marginBottom:2}}>{p.cat}</div>
                    {p.item&&p.item!=="—"&&<div style={{fontSize:11,color:"#94a3b8"}}>↳ {p.item}</div>}
                    {p.note&&<div style={{fontSize:11,color:"#64748b",marginTop:2,fontStyle:"italic"}}>{p.note}</div>}
                    <div style={{fontSize:10,color:"#94a3b8",marginTop:3}}>Desde: {fmtDate(p.since)||"—"} · {p.project.name}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HistoryScreen({project, stored, onBack}) {
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
            <div style={{fontSize:11,color:"#94a3b8"}}>{fmtDate(repMeta.date)} · somente leitura</div>
          </div>
          <HealthRing pct={computeHealth(project,repState).pct} size={46}/>
        </div>
        <div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:10,padding:"12px 14px",marginBottom:8}}>
          <div style={{fontSize:10,color:"#0ea5e9",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>📂 Últimos testes</div>
          {ultimos.map((u,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:i<ultimos.length-1?"1px solid #0a0f1e":"none"}}>
              <span style={{fontSize:11,fontWeight:800,color:"#cbd5e1",minWidth:54}}>{u.wk}</span>
              <span style={{fontSize:10,color:"#475569",minWidth:74}}>{u.data}</span>
              <span style={{fontSize:11,color:"#94a3b8",flex:1}}>Líder: {u.leader} · CCO: {u.cco}</span>
            </div>
          ))}
        </div>
        <div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:10,padding:"12px 14px",marginBottom:8}}>
          <div style={{fontSize:10,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>📋 Cabeçalho</div>
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
                <div style={{fontSize:9,color:"#475569",fontWeight:700,textTransform:"uppercase",marginBottom:2}}>{label}</div>
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
                <div key={i} style={{fontSize:11,color:"#64748b",marginLeft:16,marginTop:3}}>🔧 {fmtDate(v?.date)} · {v?.empresa||"—"} · {v?.tec1||"—"}</div>
              ))}
            </div>
          );
        })}
        {repMeta.obs&&(
          <div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:8,padding:"10px 14px",marginTop:4}}>
            <div style={{fontSize:10,color:"#475569",fontWeight:700,marginBottom:4}}>OBSERVAÇÕES</div>
            <div style={{fontSize:12,color:"#94a3b8"}}>{repMeta.obs}</div>
          </div>
        )}
        <div style={{fontSize:10,color:"#94a3b8",textAlign:"center",marginTop:8}}>👁 Somente leitura — sem PDF neste acesso</div>
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
                    <div style={{fontSize:11,color:"#475569"}}>Lider: {r.meta?.leader||"—"} · CCO: {r.meta?.cco||"—"}</div>
                    {r.meta?.signature&&<div style={{fontSize:11,color:"#64748b"}}>✍ {r.meta.signature}</div>}
                    <div style={{fontSize:11,color:h.inop>0?"#ef4444":"#22c55e",fontWeight:600}}>{h.inop>0?`${h.inop} inoperante(s)`:"✔ Tudo OK"}</div>
                  </div>
                </div>
                <div style={{marginTop:8,height:3,background:"#0f172a",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${h.pct}%`,background:color,borderRadius:2}}/>
                </div>
                <div style={{marginTop:10}}>
                  <button onClick={()=>setViewReport({project,report:r,idx:i})}
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
          <div><div style={{fontSize:13,fontWeight:700,color:"#22c55e"}}>Relatorio finalizado!</div><div style={{fontSize:11,color:"#475569"}}>Salvo · {fmtDate(meta.date)} · Assinado por {meta.signature||"—"}</div></div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={()=>generatePDF(project,state,meta,photos,ctmkInfo)} style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#7c3aed,#6d28d9)",fontSize:13}}>📄 Exportar PDF</button>
          <button onClick={()=>{navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{...S.primaryBtn,flex:1,fontSize:13}}>{copied?"✓ Copiado!":"📋 Copiar Texto"}</button>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={handleEmail} disabled={sending||emailSent} style={{...S.primaryBtn,flex:1,background:emailSent?"linear-gradient(135deg,#16a34a,#15803d)":"linear-gradient(135deg,#059669,#047857)",fontSize:13,opacity:sending?0.7:1}}>{sending?"⟳ Enviando...":emailSent?"✓ Email Enviado!":"✉ Enviar Email"}</button>
          <button onClick={handleWhatsApp} style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#16a34a,#15803d)",fontSize:13}}>💬 WhatsApp</button>
        </div>
        <button onClick={onHome} style={{...S.secBtn,width:"100%",fontSize:13}}>🏠 Inicio</button>
        <div style={{background:"#f8fafc",borderRadius:10,padding:"14px 16px",border:"1px solid #e2e8f0",maxHeight:"45vh",overflowY:"auto",marginTop:12}}>
          <pre style={{margin:0,fontFamily:"'Courier New',monospace",fontSize:10,whiteSpace:"pre-wrap",color:"#1e293b",lineHeight:1.7}}>{text}</pre>
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
      <div style={{fontSize:13,color:"#64748b"}}>Verificando acesso...</div>
    </div>
  );
  if(!project || !validToken || (token !== validToken && token !== (projectId+"_"+validToken) && token !== validToken.split("_").pop())) {
    return(<div style={{...S.page,alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center",padding:32,color:"#94a3b8"}}><div style={{fontSize:40,marginBottom:12}}>🔒</div><div style={{fontSize:16,fontWeight:700,color:"#f1f5f9",marginBottom:8}}>Link invalido ou expirado</div><div style={{fontSize:13,color:"#64748b"}}>Solicite um novo link ao gestor.</div></div></div>);
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
            <div style={{flex:1}}><div style={{fontSize:15,fontWeight:800,color:"#f1f5f9"}}>MokLog CheckTest</div><div style={{fontSize:12,color:"#cc2222",fontWeight:700}}>{project.id} – {project.name}</div><div style={{fontSize:11,color:"#475569"}}>Pendencias para manutencao · {fmtDate(last.meta?.date)}</div></div>
            <HealthRing pct={h.pct} size={52}/>
          </div>
        </div>
        <div style={{fontSize:12,fontWeight:700,color:"#f1f5f9",marginBottom:8}}>Itens com Pendencia ({issues.length})</div>
        {issues.length===0&&<div style={{textAlign:"center",padding:"20px",color:"#22c55e",fontSize:13}}>✔ Nenhuma pendencia ativa</div>}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {issues.map((iss,i)=>(
            <div key={i} style={{background:"#060c18",border:`1px solid ${iss.status==="partial"?"#f59e0b33":"#ef444433"}`,borderRadius:8,padding:"10px 12px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontSize:9,fontWeight:700,color:iss.status==="partial"?"#f59e0b":"#ef4444",background:iss.status==="partial"?"#fef3c7":"#fee2e2",padding:"2px 6px",borderRadius:8}}>{iss.status==="partial"?"PARCIAL":"INOP"}</span>
                <span style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>{iss.cat}</span>
              </div>
              {iss.item&&iss.item!=="—"&&<div style={{fontSize:11,color:"#94a3b8",marginBottom:2}}>Item: {iss.item}</div>}
              {iss.since&&<div style={{fontSize:11,color:"#64748b"}}>Desde: {fmtDate(iss.since)}</div>}
              {iss.note&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{iss.note}</div>}
            </div>
          ))}
        </div>
        <div style={{marginTop:16,fontSize:10,color:"#94a3b8",textAlign:"center"}}>MokLog CheckTest © Moked Security Consulting · Somente leitura</div>
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
  const txt2=dark?"#475569":"#64748b";
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
                        <span style={{fontSize:9,fontWeight:700,color:"#0ea5e9",background:"#001a2e",padding:"1px 6px",borderRadius:4}}>{total} itens</span>
                        {inop>0&&<span style={{fontSize:9,fontWeight:700,color:"#ef4444",background:"#1a0202",padding:"1px 6px",borderRadius:4}}>🔴 {inop} inop</span>}
                        {parcial>0&&<span style={{fontSize:9,fontWeight:700,color:"#f59e0b",background:"#1a1000",padding:"1px 6px",borderRadius:4}}>⚠️ {parcial} parcial</span>}
                        {!hasProb&&<span style={{fontSize:9,fontWeight:700,color:"#22c55e",background:"#021a0d",padding:"1px 6px",borderRadius:4}}>✅ OK</span>}
                      </div>
                    ):(
                      <div style={{fontSize:10,color:txt2,marginTop:3}}>Sem itens cadastrados</div>
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
  const [pinAuth, setPinAuth] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [equipPinAuth, setEquipPinAuth] = useState(false);
  const [equipPinInput, setEquipPinInput] = useState("");
  const [equipPinErr, setEquipPinErr] = useState(false);

  const bg   = dark ? "#04080f" : "#f1f5f9";
  const cardBg = dark ? "#060c18" : "#ffffff";
  const border = dark ? "#0f172a" : "#e2e8f0";
  const txt  = dark ? "#f1f5f9" : "#0f172a";
  const txt2 = dark ? "#475569" : "#64748b";
  const hdrBg = dark ? "#04080f" : "#f8fafc";
  const hdrBorder = dark ? "#0a0f1e" : "#e2e8f0";
  const backBtn = { background:"transparent", border:`1px solid ${border}`, color:txt2, borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 };

  const JATINOX_LIST = [
    { id:"P260A", name:"Jatinox Unidade A" },
    { id:"P260B", name:"Jatinox Unidade B" },
    { id:"P260C", name:"Jatinox Unidade C" },
  ];
  const allProjects = [...Object.values(PROJECTS), ...JATINOX_LIST];

  if(subScreen==="colaboradores" && selProject) {
    return (
      <EquipeReadOnly project={selProject} dark={dark} stored={stored}
        onBack={()=>{ setSelProject(null); }}
        onToggleTheme={onToggleTheme}
        onOpenFull={()=>onEquipe(selProject)}/>
    );
  }

  if(subScreen==="equipamentos" && !equipPinAuth) {
    const bg=dark?"#04080f":"#f1f5f9";
    const cardBg=dark?"#060c18":"#ffffff";
    const border=dark?"#0f172a":"#e2e8f0";
    const txt=dark?"#f1f5f9":"#0f172a";
    const txt2=dark?"#475569":"#64748b";
    return (
      <div style={{minHeight:"100vh",background:bg,display:"flex",justifyContent:"center",alignItems:"center",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
        <div style={{background:cardBg,border:`1px solid ${border}`,borderRadius:16,padding:"28px 24px",maxWidth:320,width:"100%",textAlign:"center",margin:16}}>
          <div style={{fontSize:32,marginBottom:8}}>🛡️</div>
          <div style={{fontSize:16,fontWeight:800,color:txt,marginBottom:4}}>Equipamentos</div>
          <div style={{fontSize:12,color:txt2,marginBottom:20}}>PIN gerencial para ver todos os projetos</div>
          <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={equipPinInput}
            onChange={e=>{setEquipPinInput(e.target.value);setEquipPinErr(false);}}
            onKeyDown={e=>{if(e.key==="Enter"){if(equipPinInput==="872101"){setEquipPinAuth(true);}else setEquipPinErr(true);}}}
            style={{width:"100%",background:dark?"#020510":"#fff",border:`1px solid ${equipPinErr?"#ef4444":border}`,borderRadius:7,color:txt,padding:"12px",fontSize:22,letterSpacing:10,textAlign:"center",boxSizing:"border-box",outline:"none",marginBottom:8}}/>
          {equipPinErr && <div role="alert" style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setSubScreen(null);setEquipPinInput("");setEquipPinErr(false);}}
              style={{flex:1,background:dark?"#060c18":"#f8fafc",color:txt2,border:`1px solid ${border}`,borderRadius:10,padding:"12px",fontSize:13,fontWeight:600,cursor:"pointer"}} aria-label="Voltar">
              ← Voltar
            </button>
            <button onClick={()=>{if(equipPinInput==="872101"){setEquipPinAuth(true);}else setEquipPinErr(true);}}
              style={{flex:1,background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if(subScreen==="equipamentos" && equipPinAuth) {
    return <EquipamentosListagem dark={dark} stored={stored} onToggleTheme={onToggleTheme}
      onBack={()=>{setSubScreen(null);setEquipPinAuth(false);setEquipPinInput("");}}
      onOpenEquip={onEquipamentos}/>;
  }

  if(subScreen==="colaboradores" && !pinAuth) {
    return (
      <div style={{ minHeight:"100vh", background:bg, display:"flex", justifyContent:"center", alignItems:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
        <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:16, padding:"28px 24px", maxWidth:320, width:"100%", textAlign:"center", margin:16 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🔐</div>
          <div style={{ fontSize:16, fontWeight:800, color:txt, marginBottom:4 }}>Área Restrita</div>
          <div style={{ fontSize:12, color:txt2, marginBottom:20 }}>Insira o PIN gerencial para ver os colaboradores</div>
          <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pinInput}
            onChange={e=>{ setPinInput(e.target.value); setPinErr(false); }}
            onKeyDown={e=>{ if(e.key==="Enter"){ if(pinInput==="872101"){setPinAuth(true);}else setPinErr(true); } }}
            style={{ width:"100%", background:dark?"#020510":"#fff", border:`1px solid ${pinErr?"#ef4444":border}`, borderRadius:7, color:txt, padding:"12px", fontSize:22, letterSpacing:10, textAlign:"center", boxSizing:"border-box", outline:"none", marginBottom:8 }}/>
          {pinErr && <div role="alert" style={{ fontSize:12, color:"#ef4444", marginBottom:8 }}>PIN incorreto</div>}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>{ setSubScreen(null); setPinInput(""); setPinErr(false); }}
              style={{ flex:1, background:dark?"#060c18":"#f8fafc", color:txt2, border:`1px solid ${border}`, borderRadius:10, padding:"12px", fontSize:13, fontWeight:600, cursor:"pointer" }} aria-label="Voltar">
              ← Voltar
            </button>
            <button onClick={()=>{ if(pinInput==="872101"){setPinAuth(true);}else setPinErr(true); }}
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
          <button onClick={()=>{ setPinAuth(false); setPinInput(""); setPinErr(false); setSubScreen("colaboradores"); }}
            style={{ background:cardBg, border:`2px solid ${dark?"#0ea5e933":"#bae6fd"}`, borderRadius:16, padding:"22px 20px", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:56, height:56, borderRadius:14, background: dark?"#001a2e":"#e0f2fe", border:`1px solid ${dark?"#0ea5e933":"#7dd3fc"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontSize:26 }}>👥</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:16, fontWeight:800, color:dark?"#0ea5e9":"#0369a1" }}>Colaboradores</div>
              <div style={{ fontSize:12, color:txt2, marginTop:3 }}>Ver equipes cadastradas em todos os projetos</div>
              <div style={{ fontSize:11, color:dark?"#334155":"#94a3b8", marginTop:5 }}>
                {allProjects.length} projeto(s) disponíveis
              </div>
            </div>
            <span style={{ color:txt2, fontSize:20 }}>›</span>
          </button>

          <button onClick={()=>{setEquipPinAuth(false);setEquipPinInput("");setEquipPinErr(false);setSubScreen("equipamentos");}}
            style={{ background:cardBg, border:`2px solid ${dark?"#f59e0b33":"#fde68a"}`, borderRadius:16, padding:"22px 20px", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:56, height:56, borderRadius:14, background: dark?"#1a1000":"#fffbeb", border:`1px solid ${dark?"#f59e0b33":"#fcd34d"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontSize:26 }}>🛡️</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:16, fontWeight:800, color:dark?"#f59e0b":"#d97706" }}>Equipamentos</div>
              <div style={{ fontSize:12, color:txt2, marginTop:3 }}>Inventário de equipamentos por projeto</div>
              <div style={{ fontSize:11, color:dark?"#334155":"#94a3b8", marginTop:5 }}>
                Ver status, problemas e gerar PDF
              </div>
            </div>
            <span style={{ color:txt2, fontSize:20 }}>›</span>
          </button>
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
  const txt2 = dark ? "#475569" : "#64748b";
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
                      <span style={{ fontSize:10, color:txt2, background: dark?"#0a0f1e":"#f1f5f9", padding:"2px 8px", borderRadius:10 }}>{cols.length}</span>
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
                                {c.escala && <span style={{ fontSize:9, color:"#0ea5e9", background: dark?"#001a2e":"#e0f2fe", padding:"1px 6px", borderRadius:4, fontWeight:700 }}>{c.escala}</span>}
                                {c.telefone && <span style={{ fontSize:9, color:txt2 }}>📱 {c.telefone}</span>}
                                {c.dataContratacao && <span style={{ fontSize:9, color:txt2 }}>📅 {fmtDate(c.dataContratacao)}</span>}
                              </div>
                            </div>
                            <div style={{ flexShrink:0, textAlign:"right" }}>
                              {faltas>0 && <div style={{ fontSize:9, color:"#ef4444", fontWeight:700 }}>{faltas}F</div>}
                              {fts>0    && <div style={{ fontSize:9, color:"#f59e0b", fontWeight:700 }}>{fts}FT</div>}
                              {mds>0    && <div style={{ fontSize:9, color:"#a855f7", fontWeight:700 }}>{mds}MD</div>}
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

export default function App(){
  const [screen,setScreen]=useState("home");
  const [editingIdx,setEditingIdx]=useState(null);
  const isOnline = useOnlineStatus();
  const [showAcesso,setShowAcesso]=useState(false);
  const [acessoScreen,setAcessoScreen]=useState("menu");
  const [dark,setDark]=useState(true);
  const [showRegistros,setShowRegistros]=useState(false);
  const [showAcessoCCO,setShowAcessoCCO]=useState(false);
  const [acessoCCOProject,setAcessoCCOProject]=useState(null);
  const [showEmpresaInfo,setShowEmpresaInfo]=useState(false);
  const [empresaInfoProject,setEmpresaInfoProject]=useState(null);
  const [showEquipamentos,setShowEquipamentos]=useState(false);
  const [equipamentosProject,setEquipamentosProject]=useState(null);
  const [showVisita,setShowVisita]=useState(false);
  const [visitaProject,setVisitaProject]=useState(null);
  const [showPerimetral,setShowPerimetral]=useState(false);
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
  const [sigError,setSigError]=useState(false);
  const [showConfirmModal,setShowConfirmModal]=useState(false);
  const [showMonthlyPrompt,setShowMonthlyPrompt]=useState(false);
  const [draft,setDraft]=useState(null);
  const [showDraftPrompt,setShowDraftPrompt]=useState(false);
  const [viewParams,setViewParams]=useState(null);
  const [notifGranted,setNotifGranted]=useState(false);
  const [pendingSync,setPendingSync]=useState(null); // {projectId, history} aguardando sincronizar com o servidor
  const savingRef = useRef(false); // trava contra duplo clique no "Confirmar e Enviar"
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
            const mergedHist = mergeHistory(localHist, serverHist);
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
    const status = ctmkData[pid]?.status || "online";
    setCtmkConfirm({ pid, status, allowDateEdit });
  };

  useEffect(()=>{
    if(screen==="form"&&state&&editingIdx===null){
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
  const checkAuth=(pid)=>{const a=projectAuth[pid];return a&&(Date.now()-a.ts)<PROJECT_SESSION_TIMEOUT;};
  const grantAuth=(pid,mode="lider")=>setProjectAuth(prev=>({...prev,[pid]:{mode,ts:Date.now()}}));
  // modo já liberado para o projeto (null se sessão expirada/inexistente) — usado pelos módulos CCO/Equipe/Equipamentos/Empresas/Visita
  const getProjectAuthMode=(pid)=>{const a=projectAuth[pid];if(!a||(Date.now()-a.ts)>=PROJECT_SESSION_TIMEOUT)return null;return a.mode;};
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

  const deleteReport=async(projectId,idx)=>{
    const prev=stored[projectId]?.history??[];
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
    setState(JSON.parse(JSON.stringify(report.state)));
    setMeta({date:todayStr(),start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:"",...report.meta});
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

  const continueDraft=()=>{setState(draft.state);setMeta(draft.meta);setPhotos(draft.photos||[]);setShowDraftPrompt(false);setScreen("form");setActive(null);};
  const discardDraft=()=>{clearDraft();setShowDraftPrompt(false);const base=lastForProject?buildFromLast(project,lastForProject.state):buildBlank(project);setState(base);setMeta({date:todayStr(),start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:""});setPhotos([]);setScreen("form");setActive(null);};

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
    saveReport(state,meta).finally(()=>{ savingRef.current = false; });
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
        <div style={{position:"fixed",bottom:16,right:16,background:"#15803d",color:"#fff",borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,zIndex:999}}>✓ Salvo</div>
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
  if(showAcessoCCO&&acessoCCOProject) return <ErrorBoundary moduleName="Acesso CCO"><AcessoCCO project={acessoCCOProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowAcessoCCO(false);setAcessoCCOProject(null);}} sharedAuth={getProjectAuthMode(acessoCCOProject.id)} onAuthGranted={(mode)=>grantAuth(acessoCCOProject.id,mode)}/></ErrorBoundary>;
  if(showEmpresaInfo&&empresaInfoProject) return <ErrorBoundary moduleName="Empresas"><EmpresaInfo project={empresaInfoProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowEmpresaInfo(false);setEmpresaInfoProject(null);}} sharedAuth={getProjectAuthMode(empresaInfoProject.id)} onAuthGranted={(mode)=>grantAuth(empresaInfoProject.id,mode)}/></ErrorBoundary>;
  if(showEquipamentos&&equipamentosProject) return <ErrorBoundary moduleName="Equipamentos"><Equipamentos project={equipamentosProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowEquipamentos(false);setEquipamentosProject(null);}} sharedAuth={getProjectAuthMode(equipamentosProject.id)} onAuthGranted={(mode)=>grantAuth(equipamentosProject.id,mode)}/></ErrorBoundary>;
  if(showVisita&&visitaProject) return <ErrorBoundary moduleName="Visita Diária"><Visita project={visitaProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowVisita(false);setVisitaProject(null);}} sharedAuth={getProjectAuthMode(visitaProject.id)} onAuthGranted={(mode)=>grantAuth(visitaProject.id,mode)}/></ErrorBoundary>;
  if(showPerimetral&&perimetralProject) return <ErrorBoundary moduleName="Teste Perimetral"><Perimetral project={perimetralProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowPerimetral(false);setPerimetralProject(null);}} sharedAuth={getProjectAuthMode(perimetralProject.id)} onAuthGranted={(mode)=>grantAuth(perimetralProject.id,mode)}/></ErrorBoundary>;
  if(showKeyAccess) return <ErrorBoundary moduleName="KeyAccess Falha"><KeyAccessFalha dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>setShowKeyAccess(false)}/></ErrorBoundary>;
  if(showIntervalos&&intervalosProject) return <ErrorBoundary moduleName="Intervalos"><Intervalos project={intervalosProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowIntervalos(false);setIntervalosProject(null);}}/></ErrorBoundary>;
  if(showCCO&&ccoProject) return <ErrorBoundary moduleName="CCO"><CCO project={ccoProject} dark={dark} onToggleTheme={()=>setDark(!dark)} onBack={()=>{setShowCCO(false);setCcoProject(null);}}/></ErrorBoundary>;
  if(viewParams) return <ViewScreen projectId={viewParams.projectId} token={viewParams.token} stored={stored}/>;

  if(showMonthlyPrompt) return(
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#060c18",border:"1px solid #7c3aed",borderRadius:16,padding:"28px 24px",maxWidth:340,width:"100%",textAlign:"center",margin:16}}>
        <div style={{fontSize:28,marginBottom:10}}>📊</div>
        <div style={{fontSize:15,fontWeight:700,color:"#f1f5f9",marginBottom:6}}>Último teste do mês!</div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>Este é o último domingo do mês.<br/>Deseja gerar o consolidado mensal após finalizar?</div>
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
        <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>Relatorio em andamento de {project.id}. Continuar?</div>
        <div style={{display:"flex",gap:8,flexDirection:"column"}}>
          <button onClick={continueDraft} style={{...S.primaryBtn,width:"100%",fontSize:14}}>↩ Continuar rascunho</button>
          <button onClick={discardDraft} style={{...S.secBtn,width:"100%",fontSize:14}}>🗑 Descartar e comecar novo</button>
        </div>
      </div>
    </div>
  );

  if(screen==="pendencies") return <PendenciesScreen stored={stored} onBack={()=>setScreen("home")}/>;
  if(screen==="pin_gate") return <ProjectPinGate project={project} onSuccess={()=>{grantAuth(project.id);setScreen("home");}} onBack={()=>setScreen("home")}/>;
  if(screen==="dashboard") return <Dashboard stored={stored} ctmkData={ctmkData} onToggleCtmk={toggleCtmk} onBack={()=>setScreen("home")} onDeleteReport={deleteReport} onEditReport={startEditReport}/>;
  if(screen==="history") return <ErrorBoundary moduleName="Histórico de Relatórios"><HistoryScreen project={project} stored={stored} onBack={()=>setScreen("home")}/></ErrorBoundary>;
  if(screen==="report") return <ReportScreen project={project} state={state} meta={meta} photos={photos} ctmkData={ctmkData} onBack={()=>setScreen("form")} onHome={()=>setScreen("home")}/>;

  // ── FORM
  if(screen==="form") return(
    <div style={{...S.page, background:dark?"#04080f":"#f1f5f9"}}>
      {showConfirmModal && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:dark?"#060c18":"#fff",border:"2px solid #f59e0b66",borderRadius:16,padding:"26px 22px",maxWidth:360,width:"100%"}}>
            <div style={{fontSize:28,textAlign:"center",marginBottom:10}}>⚠️</div>
            <div style={{fontSize:15,fontWeight:800,color:dark?"#f1f5f9":"#1e293b",textAlign:"center",marginBottom:10}}>Atenção Líder!</div>
            <div style={{fontSize:13,color:dark?"#94a3b8":"#475569",lineHeight:1.65,marginBottom:20,textAlign:"center"}}>
              Por favor, revise todo o relatório antes de enviar. Verifique se os textos explicativos estão corretos e se você inseriu a <strong style={{color:dark?"#f1f5f9":"#1e293b"}}>data inicial de todas as ocorrências</strong> e dispositivos inoperantes/parciais.
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowConfirmModal(false)}
                style={{flex:1,background:"transparent",border:`1px solid ${dark?"#1e293b":"#e2e8f0"}`,color:dark?"#94a3b8":"#64748b",borderRadius:10,padding:"12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
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
      <SyncBadge/>
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
              <div style={{fontSize:11,color:"#64748b"}}>Você está editando um relatório já salvo. Ao confirmar, ele será sobrescrito (sem duplicar).</div>
            </div>
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #060c18",marginBottom:2}}>
          <button onClick={()=>{if(editingIdx!==null){setEditingIdx(null);setScreen("dashboard");}else{setScreen("home");}}} style={S.backBtn} aria-label={editingIdx!==null?"Cancelar edição":"Voltar ao início"}>← {editingIdx!==null?"Cancelar":"Inicio"}</button>
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
          <span style={{fontSize:10,color:"#22c55e",background:"#021a0d",padding:"2px 8px",borderRadius:4,fontWeight:700}}>✅ {health.ok} OK</span>
          {health.partial>0&&<span style={{fontSize:10,color:"#d97706",background:"#1a1000",padding:"2px 8px",borderRadius:4,fontWeight:700}}>⚠️ {health.partial} Parcial</span>}
          {health.inop>0&&<span style={{fontSize:10,color:"#ef4444",background:"#1a0202",padding:"2px 8px",borderRadius:4,fontWeight:700}}>🔴 {health.inop} Inop</span>}
        </div>}
        <div style={S.metaCard}>
          <div style={{fontSize:11,color:"#f59e0b",fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>📋 Cabecalho do Relatorio</div>
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
          const sv=state[cat.id];
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
                <span style={{color:"#94a3b8",fontSize:10,flexShrink:0,marginLeft:4}}>{isOpen?"▲":"▼"}</span>
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
            <div style={{fontSize:10,color:"#94a3b8",marginTop:5}}>Obrigatorio para finalizar o relatorio.</div>
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
            <button onClick={()=>{if(editingIdx!==null){setEditingIdx(null);setScreen("dashboard");}else{setScreen("home");}}} style={{...S.secBtn,flex:1,fontSize:14}}>Cancelar</button>
          </div>
        )}
        <div style={{fontSize:10,color:"#94a3b8",textAlign:"center",marginTop:4}}>{editingIdx!==null?"✏️ Editando relatório existente":"💾 Rascunho salvo automaticamente"}</div>
      </div>
    </div>
  );

  // ── HOME — Jatinox subscreen
  if(homeGroup==="jatinox") return(
    <div style={{...S.page, background:dark?"#04080f":"#f1f5f9"}}>
      <SyncBadge/>
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
                    <div style={{fontSize:12,color:"#64748b"}}>{jp.name}</div>
                    <div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap"}}>
                      {jp.hasAcesso&&<span style={{fontSize:9,color:"#f59e0b",background:"#1a1000",padding:"2px 7px",borderRadius:5,fontWeight:700,border:"1px solid #f59e0b22"}}>🚛 ACESSO</span>}
                      {jp.hasEquipe&&<span style={{fontSize:9,color:"#0ea5e9",background:"#001a2e",padding:"2px 7px",borderRadius:5,fontWeight:700,border:"1px solid #0ea5e922"}}>👥 EQUIPE</span>}
                      {jp.hasCaoGuarda&&<span style={{fontSize:9,color:"#22c55e",background:"#021a0d",padding:"2px 7px",borderRadius:5,fontWeight:700,border:"1px solid #22c55e22"}}>🐕 CÃO GUARDA</span>}
                    </div>
                  </div>
                  <CtmkBadge info={ctmkData[jp.id]} onToggle={()=>requestCtmkToggle(jp.id,false)} size="small"/>
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
                          style={{...S.secBtn,fontSize:12,color:"#22c55e",borderColor:"#22c55e22"}}>🚪 CCO</button>
                      )}
                      <button onClick={()=>{setEquipamentosProject({id:jp.id,name:jp.name});setShowEquipamentos(true);}}
                        style={{...S.secBtn,fontSize:12,color:"#f59e0b",borderColor:"#f59e0b22",gridColumn:jp.id==="P260A"?"auto":"1/-1"}}>🛡️ Equipamentos</button>
                      <button onClick={()=>{setEmpresaInfoProject({id:jp.id,name:jp.name});setShowEmpresaInfo(true);}}
                        style={{...S.secBtn,fontSize:12,color:"#a855f7",borderColor:"#a855f722",gridColumn:"1/-1"}}>🏢 Empresas</button>
                      <button onClick={()=>{setVisitaProject({id:jp.id,name:jp.name});setShowVisita(true);}}
                        style={{...S.secBtn,fontSize:12,color:"#0ea5e9",borderColor:"#0ea5e922",gridColumn:"1/-1"}}>📋 Visita Diária</button>

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
        <SyncBadge/>
        <div style={S.homeWrap}>
          <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a"}}>
            <button onClick={()=>setHomeGroup(null)} style={S.backBtn} aria-label="Voltar">← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:16,fontWeight:900,color:dark?"#f8fafc":"#0f172a"}}>{groupNames[homeGroup]}</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>{groupProjects.join(" · ")}</div>
            </div>
          </div>

          {draft&&groupProjects.includes(draft.projectId)&&(
            <div style={{background:"#0f172a",border:"1px solid #f59e0b55",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>📝</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Rascunho em andamento</div>
                <div style={{fontSize:11,color:"#64748b"}}>{draft.projectId} — salvo automaticamente</div>
              </div>
              <button onClick={()=>{setProject(PROJECTS[draft.projectId]);setShowDraftPrompt(true);}} style={{...S.sm,color:"#f59e0b",border:"1px solid #f59e0b44",fontSize:11}}>Continuar</button>
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
                <div key={pid} style={{background:isActive?"#060f20":"#060c18",border:`2px solid ${isActive?color+"66":"#0f172a"}`,borderRadius:14,padding:"14px 16px",cursor:"pointer"}}
                  onClick={()=>setProject(p)}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    {h?<HealthRing pct={h.pct} size={50}/>:
                      <div style={{width:50,height:50,borderRadius:"50%",border:"2px solid #1e293b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#94a3b8"}}>—</div>}
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{p.id}</div>
                        <div style={{fontSize:12,color:"#64748b"}}>— {p.name}</div>
                        {score&&<span style={{fontSize:9,fontWeight:900,color:score.color,background:score.color+"22",padding:"1px 5px",borderRadius:5}}>{score.grade}</span>}
                      </div>
                      {h?<div style={{fontSize:11,color:"#475569",marginTop:2}}>
                        {h.inop>0&&<span style={{color:"#ef4444",fontWeight:700}}>{h.inop} inop · </span>}
                        Último: {fmtDate(last?.meta?.date)}
                      </div>:<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Sem registros ainda</div>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                      <CtmkBadge info={ctmkData[p.id]} onToggle={()=>requestCtmkToggle(p.id,false)}/>
                      {isActive&&<span style={{fontSize:9,color:color,fontWeight:700,background:color+"22",padding:"2px 6px",borderRadius:5}}>SELECIONADO</span>}
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
                  <button onClick={()=>{const base=lastForProject?buildFromLast(project,lastForProject.state):buildBlank(project);setState(base);setMeta({date:todayStr(),start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:""});setPhotos([]);setScreen("form");setActive(null);}} style={{...S.primaryBtn,fontSize:13}}>📋 Novo Relatório — {project.id}</button>
                  <button onClick={()=>setScreen("history")} style={{...S.secBtn,fontSize:13}}>📅 Histórico</button>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <button onClick={()=>{setEquipeProject(project);setShowEquipe(true);}} style={{...S.secBtn,fontSize:12,color:"#0ea5e9",borderColor:"#0ea5e922"}}>👥 Equipe</button>
                    <button onClick={()=>{setAcessoCCOProject(project);setShowAcessoCCO(true);}} style={{...S.secBtn,fontSize:12,color:"#22c55e",borderColor:"#22c55e22"}}>🚪 CCO</button>
                    <button onClick={()=>{setEquipamentosProject(project);setShowEquipamentos(true);}} style={{...S.secBtn,fontSize:12,color:"#f59e0b",borderColor:"#f59e0b22"}}>🛡️ Equipamentos</button>
                    <button onClick={()=>{setEmpresaInfoProject(project);setShowEmpresaInfo(true);}} style={{...S.secBtn,fontSize:12,color:"#a855f7",borderColor:"#a855f722"}}>🏢 Empresas</button>
                    <button onClick={()=>{setVisitaProject(project);setShowVisita(true);}} style={{...S.secBtn,fontSize:12,color:"#0ea5e9",borderColor:"#0ea5e922",gridColumn:"1/-1"}}>📋 Visita Diária</button>
                    {PERIMETRAL_ELIGIBLE.includes(project.id)&&<button onClick={()=>{setPerimetralProject(project);setShowPerimetral(true);}} style={{...S.secBtn,fontSize:12,color:"#a855f7",borderColor:"#a855f722",gridColumn:"1/-1"}}>🔒 Teste Perimetral</button>}
                  </div>
                </>
              ):(
                <>
                  <button onClick={()=>setScreen("pin_gate")} style={{...S.primaryBtn,fontSize:14}}>🔐 Acessar — {project.id}</button>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <button onClick={()=>{setEquipeProject(project);setShowEquipe(true);}} style={{...S.secBtn,fontSize:12,color:"#0ea5e9",borderColor:"#0ea5e922"}}>👥 Equipe</button>
                    <button onClick={()=>{setAcessoCCOProject(project);setShowAcessoCCO(true);}} style={{...S.secBtn,fontSize:12,color:"#22c55e",borderColor:"#22c55e22"}}>🚪 CCO</button>
                    <button onClick={()=>{setEquipamentosProject(project);setShowEquipamentos(true);}} style={{...S.secBtn,fontSize:12,color:"#f59e0b",borderColor:"#f59e0b22"}}>🛡️ Equipamentos</button>
                    <button onClick={()=>{setEmpresaInfoProject(project);setShowEmpresaInfo(true);}} style={{...S.secBtn,fontSize:12,color:"#a855f7",borderColor:"#a855f722"}}>🏢 Empresas</button>
                    <button onClick={()=>{setVisitaProject(project);setShowVisita(true);}} style={{...S.secBtn,fontSize:12,color:"#0ea5e9",borderColor:"#0ea5e922",gridColumn:"1/-1"}}>📋 Visita Diária</button>
                    {PERIMETRAL_ELIGIBLE.includes(project.id)&&<button onClick={()=>{setPerimetralProject(project);setShowPerimetral(true);}} style={{...S.secBtn,fontSize:12,color:"#a855f7",borderColor:"#a855f722",gridColumn:"1/-1"}}>🔒 Teste Perimetral</button>}
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
    <div style={{...S.page, background:dark?"#04080f":"#f1f5f9"}}>
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
      <SyncBadge/>
      <div style={S.homeWrap}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
          <MoklogLogo size={52}/>
          <h1 style={{position:"absolute",width:1,height:1,overflow:"hidden"}}>MokLog CheckTest</h1>
          <div>
            <div style={{fontSize:22,fontWeight:900,color:"#f8fafc",letterSpacing:-0.5}}>MokLog</div>
            <div style={{fontSize:14,fontWeight:700,color:"#cc2222",letterSpacing:1}}>CheckTest</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>Sistema de Teste Semanal de Seguranca</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            <button onClick={()=>setScreen("pendencies")} style={{background:"#1a0202",border:"1px solid #ef444444",borderRadius:8,padding:"8px 10px",cursor:"pointer",fontSize:11,color:"#ef4444",fontWeight:700}} aria-label="Ver pendências">🔴 Inop</button>
            <button onClick={()=>setShowRegistros(true)} style={{background:"#0a0202",border:"1px solid #cc222244",borderRadius:8,padding:"8px 10px",cursor:"pointer",fontSize:11,color:"#cc2222",fontWeight:700}} aria-label="Ver registros">📋 Registros</button>
            <button onClick={()=>setScreen("dashboard")} style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:12,color:"#64748b"}} aria-label="Abrir painel gerencial">📊 Painel</button>
            <button onClick={()=>setDark(!dark)} style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,padding:"8px 10px",cursor:"pointer",fontSize:14,color:"#94a3b8"}} aria-label="Alternar tema claro/escuro">{dark?"☀️":"🌙"}</button>
          </div>
        </div>

        {!notifGranted&&(
          <div style={{background:"#0f172a",border:"1px solid #f59e0b44",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16}}>🔔</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Ativar notificacoes</div>
              <div style={{fontSize:11,color:"#64748b"}}>Receba lembretes semanais e alertas</div>
            </div>
            <button onClick={()=>requestNotificationPermission().then(g=>setNotifGranted(g))}
              style={{...S.sm,color:"#f59e0b",border:"1px solid #f59e0b44",fontSize:11}}>Ativar</button>
          </div>
        )}

        {draft&&draft.projectId===project.id&&(
          <div style={{background:"#0f172a",border:"1px solid #f59e0b55",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16}}>📝</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Rascunho em andamento</div>
              <div style={{fontSize:11,color:"#64748b"}}>{project.id} — salvo automaticamente</div>
            </div>
            <button onClick={()=>setShowDraftPrompt(true)} style={{...S.sm,color:"#f59e0b",border:"1px solid #f59e0b44",fontSize:11}}>Continuar</button>
          </div>
        )}

        <div style={{width:"100%"}}>
          <div style={{fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Seleção de Projeto</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              {key:"golgi",   label:"Projetos Golgi", sub:"P601 — P607",    color:"#1d4ed8", ids:["P601","P602","P604","P605","P606","P607"]},
              {key:"mega",    label:"Projetos Mega",  sub:"P311A, P311B",   color:"#0ea5e9", ids:["P311A","P311B"]},
              {key:"klog",    label:"Projetos Klog",  sub:"P505",           color:"#16a34a", ids:["P505"]},
              {key:"jatinox", label:"Jatinox",        sub:"P260A · B · C",  color:"#7c3aed", ids:[]},
            ].map(grp=>{
              const grpProjects = grp.ids.map(id=>PROJECTS[id]).filter(Boolean);
              const healths = grpProjects.map(p=>{const hist=stored[p.id]?.history??[];const last=hist.slice(-1)[0];return last?computeHealth(p,last.state):null;}).filter(Boolean);
              const hasProblems = healths.some(h=>h.pct<90);
              const avgPct = healths.length?Math.round(healths.reduce((a,h)=>a+h.pct,0)/healths.length):null;
              const totalInop = healths.reduce((a,h)=>a+h.inop,0);
              return(
                <button key={grp.key} onClick={()=>{setHomeGroup(grp.key);setJatinoxSel(null);}}
                  style={{background:"#060c18",border:`2px solid ${hasProblems?grp.color+"88":grp.color+"22"}`,borderRadius:16,padding:"20px 14px",cursor:"pointer",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:8,position:"relative"}}>
                  {hasProblems&&<div style={{position:"absolute",top:8,right:8,width:8,height:8,borderRadius:"50%",background:"#ef4444"}}/>}
                  <svg width="52" height="44" viewBox="0 0 52 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 18L26 4L48 18V42H4V18Z" stroke={grp.color} strokeWidth="2.5" strokeLinejoin="round" fill={grp.color+"11"}/>
                    <rect x="18" y="26" width="16" height="16" rx="1" stroke={grp.color} strokeWidth="2" fill={grp.color+"22"}/>
                    <rect x="10" y="20" width="8" height="8" rx="1" stroke={grp.color} strokeWidth="1.5" fill="none"/>
                    <rect x="34" y="20" width="8" height="8" rx="1" stroke={grp.color} strokeWidth="1.5" fill="none"/>
                    <line x1="26" y1="26" x2="26" y2="42" stroke={grp.color} strokeWidth="1.5"/>
                  </svg>
                  <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9",lineHeight:1.2}}>{grp.label}</div>
                  <div style={{fontSize:11,color:"#475569"}}>{grp.sub}</div>
                  {avgPct!==null&&(
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                      <span style={{fontSize:13,fontWeight:900,color:avgPct>=90?"#22c55e":avgPct>=70?"#f59e0b":"#ef4444"}}>{avgPct}%</span>
                      {totalInop>0&&<span style={{fontSize:10,color:"#ef4444",fontWeight:700}}>{totalInop} inop</span>}
                    </div>
                  )}
                  {avgPct===null&&<div style={{fontSize:10,color:"#94a3b8"}}>Sem dados</div>}
                </button>
              );
            })}
          </div>

          {/* 🚨 KeyAccess Falha — registro rápido de campo, sem PIN */}
          <button onClick={()=>setShowKeyAccess(true)}
            style={{marginTop:10,width:"100%",background:dark?"#1a0202":"#fef2f2",border:"2px solid #ef444466",borderRadius:16,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left"}}>
            <div style={{flexShrink:0,width:44,height:44,borderRadius:12,background:dark?"#0f172a":"#fff",border:"1px solid #22c55e44",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M5 4v14" stroke="#22c55e" strokeWidth="2.6" strokeLinecap="round"/>
                <path d="M9 11l3 3 6-7" stroke="#22c55e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div style={{position:"absolute",bottom:-4,right:-4,width:16,height:16,borderRadius:"50%",background:"#ef4444",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:"#fff",border:`2px solid ${dark?"#04080f":"#fef2f2"}`}}>!</div>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:800,color:"#ef4444"}}>KeyAccess Falha</div>
              <div style={{fontSize:11,color:dark?"#94a3b8":"#64748b"}}>Registrar falha de acesso/saída em campo</div>
            </div>
            <span style={{color:"#ef4444",fontSize:18,flexShrink:0}}>›</span>
          </button>

          {(()=>{
            const allP=Object.values(PROJECTS);
            const valid=allP.map(p=>{const hist=stored[p.id]?.history??[];const last=hist.slice(-1)[0];return last?computeHealth(p,last.state):null;}).filter(Boolean);
            if(!valid.length) return null;
            const avg=Math.round(valid.reduce((a,h)=>a+h.pct,0)/valid.length);
            const totalInop=valid.reduce((a,h)=>a+h.inop,0);
            return(
              <div style={{marginTop:10,background:"#060c18",border:"1px solid #0f172a",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{fontSize:11,color:"#94a3b8",fontWeight:700}}>Saúde Geral da Operação</div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  {totalInop>0&&<span style={{fontSize:11,color:"#ef4444",fontWeight:700}}>🔴 {totalInop} inop</span>}
                  <span style={{fontSize:16,fontWeight:900,color:avg>=90?"#22c55e":avg>=70?"#f59e0b":"#ef4444"}}>{avg}%</span>
                </div>
              </div>
            );
          })()}
        </div>

        <div style={{fontSize:10,color:"#94a3b8",textAlign:"center",lineHeight:1.8}}>MokLog CheckTest © Moked Consulting Security</div>
      </div>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S={
  page:{minHeight:"100vh",background:"#04080f",display:"flex",justifyContent:"center",padding:"0 0 60px",fontFamily:"'Segoe UI',system-ui,sans-serif"},
  homeWrap:{width:"100%",maxWidth:440,padding:"40px 16px 40px",display:"flex",flexDirection:"column",gap:14},
  formWrap:{width:"100%",maxWidth:720,padding:"16px 12px 40px",display:"flex",flexDirection:"column",gap:8},
  primaryBtn:{background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",border:"none",borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,boxShadow:"0 4px 20px rgba(29,78,216,.3)"},
  secBtn:{background:"#060c18",color:"#64748b",border:"1px solid #0f172a",borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5},
  backBtn:{background:"transparent",border:"1px solid #0f172a",color:"#94a3b8",borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"},
  projCard:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#060c18",border:"1px solid #0a0f1e",borderRadius:10,padding:"10px 13px",cursor:"pointer",width:"100%",textAlign:"left"},
  metaCard:{background:"#060c18",borderRadius:11,padding:"12px 14px",border:"1px solid #0f172a"},
  lbl:{display:"block",fontSize:10,color:"#94a3b8",fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:.5},
  inp:{width:"100%",background:"#020510",border:"1px solid #0f172a",borderRadius:7,color:"#e2e8f0",padding:"8px 10px",fontSize:12,boxSizing:"border-box",outline:"none"},
  accordion:{width:"100%",background:"transparent",border:"none",display:"flex",alignItems:"center",gap:8,padding:"12px 4px",cursor:"pointer"},
  catCard:{background:"#060c18",borderRadius:9,padding:"11px 13px",margin:"0 0 4px"},
  catHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:5},
  catLabel:{fontSize:12,fontWeight:700,color:"#94a3b8"},
  itemRow:{display:"flex",alignItems:"center",gap:6},
  iLabel:{fontSize:11,color:"#94a3b8",minWidth:80,flexShrink:0},
  tog:{background:"#020510",border:"1px solid #0f172a",color:"#94a3b8",borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer",fontWeight:600},
  togOk:{background:"#021a0d",border:"1px solid #22c55e",color:"#22c55e"},
  togPartial:{background:"#1a130a",border:"1px solid #f59e0b",color:"#f59e0b"},
  togBad:{background:"#1a0202",border:"1px solid #ef4444",color:"#ef4444"},
  sm:{background:"#020510",border:"1px solid #0f172a",color:"#94a3b8",borderRadius:5,padding:"4px 8px",fontSize:11,cursor:"pointer",fontWeight:600},
  smOk:{background:"#021a0d",border:"1px solid #22c55e",color:"#22c55e"},
  smPartial:{background:"#1a130a",border:"1px solid #f59e0b",color:"#f59e0b"},
  smBad:{background:"#1a0202",border:"1px solid #ef4444",color:"#ef4444"},
  iconBtn:{background:"#020510",border:"1px solid #0f172a",color:"#475569",borderRadius:5,width:24,height:24,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,flexShrink:0},
  addBtn:{background:"transparent",border:"1px dashed #0f172a",color:"#94a3b8",borderRadius:7,padding:"6px 12px",fontSize:11,cursor:"pointer",marginTop:4},
  subRow:{display:"flex",flexDirection:"column",gap:6,marginTop:8,paddingTop:8,borderTop:"1px solid #0f172a"},
};
