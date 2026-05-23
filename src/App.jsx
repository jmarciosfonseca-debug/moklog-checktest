import { useState, useEffect, useCallback, useRef } from "react";
import { generatePDF, generateConsolidatedPDF } from "./generatePDF";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection, getDocs, onSnapshot } from "firebase/firestore";

// ─── EmailJS Config ───────────────────────────────────────────────────────────
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

// ─── Firebase ─────────────────────────────────────────────────────────────────
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
  try { await setDoc(doc(db,"projects",projectId),{history,updatedAt:new Date().toISOString()}); }
  catch(e){ console.error("Firebase save:",e); }
}
async function loadAllFromFirebase() {
  try { const snap=await getDocs(collection(db,"projects")); const data={}; snap.forEach(d=>{data[d.id]=d.data();}); return data; }
  catch(e){ return {}; }
}
async function deleteReportFromFirebase(projectId, newHistory) {
  try { await setDoc(doc(db,"projects",projectId),{history:newHistory,updatedAt:new Date().toISOString()}); }
  catch(e){ console.error("Firebase delete:",e); }
}

// ─── View Links (Manutenção) ──────────────────────────────────────────────────
function generateViewToken(projectId) {
  return Math.random().toString(36).substring(2,10) + Math.random().toString(36).substring(2,10);
}

// ─── Config ───────────────────────────────────────────────────────────────────
const PROJECT_PINS = {
  P601:"16601",P602:"16602",P604:"16604",P605:"16605",
  P606:"16606",P607:"16607",P311A:"16311",P311B:"16311",P505:"16505"
};
const ADMIN_PIN = "872101";
const MAX_HISTORY = 26;
const SESSION_TIMEOUT = 10 * 60 * 1000;
const INOP_ALERT_WEEKS = 2;
const RECURRENCE_WARN = 2;
const RECURRENCE_CRIT = 3;

// ─── Push Notifications ───────────────────────────────────────────────────────
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
  // Store schedule in localStorage
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

const PROJECTS = {
  P601: {
    id:"P601", name:"Golgi Cajamar", short:"Cajamar",
    categories:[
      {id:"fire",label:"01 - Alarme de Incêndio",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"panic_mob",label:"02 - Pânico Móvel",type:"items",itemLabels:["Líder","Ronda 01","Ronda 02","Reserva"]},
      {id:"panic_fix",label:"03 - Pânico Fixo",type:"items",itemLabels:["CCO 01","CCO 02","Fixo Externo"]},
      {id:"perimeter",label:"04 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04"]},
      {id:"bollards",label:"05 - Bollards / Pinos",type:"items",itemLabels:["01","02","03","04","05","06","07"]},
      {id:"cftv",label:"06 - CFTV",type:"count",total:70},
      {id:"ac",label:"07 - Ar-Condicionado",type:"items",itemLabels:["CCO 01","CCO 02","CCO 03","Portaria 01"]},
      {id:"portas_cco",label:"08 - Portas CCO",type:"items",itemLabels:["Entrada","Saída"]},
      {id:"internet",label:"09 - Internet",type:"single"},
      {id:"totem_vis",label:"10 - Totem Visitantes",type:"items",itemLabels:["Totem 01"]},
      {id:"totem_mot",label:"11 - Totem Motorista",type:"items",itemLabels:["Totem 01"]},
      {id:"monitores",label:"12 - Monitores CCO",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03","Monitor 04"]},
      {id:"torniquetes",label:"13 - Torniquetes / QR Code",type:"items",itemLabels:["Entrada 01","Entrada 02","Saída 01","Saída 02"]},
      {id:"paradox",label:"14 - Paradox",type:"items",itemLabels:["CCO"]},
      {id:"cancelas",label:"15 - Cancelas",type:"items",itemLabels:["Inclusa 01","Inclusa 02","Inclusa 03","Inclusa 04","Inclusa 05","Bollard 01","Bollard 02","Bollard 03","Bollard 04"]},
      {id:"qr_cancelas",label:"16 - Leitores QR Cancelas",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Entrada 05","Entrada 06","Entrada 07","Entrada 08","Entrada 09","Entrada 10","Saída 01","Saída 02","Saída 03","Saída 04","Saída 05","Saída 06","Saída 07","Saída 08","Saída 09","Saída 10"]},
      {id:"semaforos",label:"17 - Semáforos",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Entrada 05","Saída 01","Saída 02","Saída 03","Saída 04","Saída 05"]},
      {id:"sensores",label:"18 - Sensores Anti-esmagamento",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Entrada 05","Saída 01","Saída 02","Saída 03","Saída 04","Saída 05"]},
      {id:"nobreaks",label:"19 - Nobreaks",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"mesa",label:"20 - Mesa Controladora / Botoeira",type:"items",itemLabels:["Mesa 01","Mesa 02"]},
      {id:"telefone",label:"21 - Telefone CCO",type:"items",itemLabels:["CCO"]},
      {id:"reverso",label:"22 - Reverso Inclusa",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Entrada 05","Saída 01","Saída 02","Saída 03","Saída 04","Saída 05"]},
      {id:"interfone",label:"23 - Interfones",type:"items",itemLabels:["CCO","Apoio Motorista"]},
      {id:"joystick",label:"24 - Joystick",type:"items",itemLabels:["CCO"]},
      {id:"manutencao",label:"25 - Visita de Manutenção",type:"maintenance"},
      {id:"infra",label:"26 - Infraestrutura / Obs.",type:"notes"},
    ]
  },
  P602: {
    id:"P602", name:"Golgi Mauá", short:"Mauá",
    categories:[
      {id:"fire",label:"01 - Alarme de Incêndio",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"garras",label:"02 - Garras (Eclusas)",type:"items",itemLabels:["Entrada 01","Entrada 02","Saída 01","Saída 02"]},
      {id:"portoes_eclusa",label:"03 - Portões Eclusa",type:"items",itemLabels:["Entrada 01","Entrada 02","Saída 01","Saída 02"]},
      {id:"torniquetes",label:"04 - Torniquetes",type:"items",itemLabels:["Torniquete 01","Torniquete 02"]},
      {id:"qr_torn",label:"05 - QR Torniquetes",type:"items",itemLabels:["Entrada 01","Entrada 02","Saída 01","Saída 02"]},
      {id:"qr_eclusas",label:"06 - QR Eclusas",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Saída 01","Saída 02","Saída 03","Saída 04"]},
      {id:"portaria",label:"07 - Portaria",type:"items",itemLabels:["Tablet","Joystick","Ar-Condicionado","Transformador"]},
      {id:"cco_equip",label:"08 - CCO (Equipamentos)",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03","Ar-Condicionado","Mesa Gatbox","Joystick","CPU 01","CPU 02","CPU 03"]},
      {id:"cftv",label:"09 - CFTV",type:"count",total:42},
      {id:"token",label:"10 - Token / Totem",type:"items",itemLabels:["Entrada","Saída"]},
      {id:"internet",label:"11 - Internet",type:"single"},
      {id:"manutencao",label:"12 - Visita de Manutenção",type:"maintenance"},
      {id:"infra",label:"13 - Infraestrutura / Obs.",type:"notes"},
    ]
  },
  P604: {
    id:"P604", name:"Golgi Jundiaí", short:"Jundiaí",
    categories:[
      {id:"fire",label:"01 - Alarme de Incêndio (Repetidoras)",type:"items",itemLabels:["Repetidora 01","Repetidora 02","Repetidora 03","Repetidora 04"]},
      {id:"monitores_cco",label:"02 - Monitores CCO",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03","Monitor 04","Monitor 05"]},
      {id:"cftv",label:"03 - CFTV",type:"count",total:73},
      {id:"joystick",label:"04 - Mesa Joystick",type:"items",itemLabels:["CCO"]},
      {id:"nobreak",label:"05 - Nobreak",type:"items",itemLabels:["CCO"]},
      {id:"paradox",label:"06 - Paradox",type:"items",itemLabels:["CCO","Recepção"]},
      {id:"mesa_cco",label:"07 - Mesa Controle / Botoeiras CCO",type:"items",itemLabels:["CCO"]},
      {id:"telefone",label:"08 - Telefone",type:"items",itemLabels:["CCO","Recepção"]},
      {id:"interfone",label:"09 - Interfone / Intercomunicador",type:"items",itemLabels:["CCO","Recepção"]},
      {id:"ac",label:"10 - Ar-Condicionado",type:"items",itemLabels:["CCO 01","CCO 02","Recepção"]},
      {id:"cancelas_baia",label:"11 - Cancelas (Baia)",type:"items",itemLabels:["Cancela 01","Cancela 02","Cancela 03","Cancela 04"]},
      {id:"cancelas_estac",label:"12 - Cancelas Estac. (Rec. Facial)",type:"items",itemLabels:["Cancela 01","Cancela 02"]},
      {id:"semaforos",label:"13 - Semáforos (Baia)",type:"items",itemLabels:["Semáforo 01","Semáforo 02","Semáforo 03","Semáforo 04"]},
      {id:"bollards",label:"14 - Pinos Bollards",type:"items",itemLabels:["Pino 01","Pino 02","Pino 03","Pino 04","Pino 05","Pino 06","Pino 07","Pino 08"]},
      {id:"sensores",label:"15 - Sensores Anti-esmagamento",type:"items",itemLabels:["Sensor 01","Sensor 02","Sensor 03","Sensor 04"]},
      {id:"totens_baia",label:"16 - Totens Controle Veicular",type:"items",itemLabels:["Totem 01","Totem 02","Totem 03","Totem 04"]},
      {id:"qr_baia",label:"17 - Leitores QR (Baia)",type:"items",itemLabels:["QR 01","QR 02","QR 03","QR 04","QR 05","QR 06","QR 07","QR 08"]},
      {id:"monitores_rec",label:"18 - Monitores Recepção",type:"items",itemLabels:["Monitor 01","Monitor 02"]},
      {id:"mesa_rec",label:"19 - Mesa Controle / Botoeiras Recepção",type:"items",itemLabels:["Recepção"]},
      {id:"torniquetes",label:"20 - Torniquetes",type:"items",itemLabels:["Torniquete 01","Torniquete 02","Torniquete 03","Torniquete 04"]},
      {id:"qr_torn",label:"21 - Leitores QR (Torniquetes)",type:"items",itemLabels:["QR 01","QR 02","QR 03","QR 04","QR 05","QR 06","QR 07","QR 08"]},
      {id:"totens_pedestre",label:"22 - Totens Auto Atendimento (Pedestres)",type:"items",itemLabels:["Totem 01","Totem 02","Totem 03","Totem 04"]},
      {id:"totem_motorista",label:"23 - Totem Motorista",type:"items",itemLabels:["Totem 01"]},
      {id:"internet",label:"24 - Internet",type:"single"},
      {id:"perimeter",label:"25 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04","Zona 05","Zona 06","Zona 07"]},
      {id:"manutencao",label:"26 - Visita de Manutenção",type:"maintenance"},
      {id:"infra",label:"27 - Infraestrutura / Obs.",type:"notes"},
    ]
  },
  P605: {
    id:"P605", name:"Golgi Dutra", short:"Dutra",
    categories:[
      {id:"panic_fix",label:"01 - Pânico Fixo",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"panic_mob",label:"02 - Pânico Móvel",type:"items",itemLabels:["GA Líder 01","GA Líder 02","GB VSPP 01","GB VSPP 02"]},
      {id:"giroflex",label:"03 - Giroflex Eclusas",type:"items",itemLabels:["Entrada 01","Entrada 02","Saída 03 Reversa","Saída 04"]},
      {id:"fire",label:"04 - Alarme SDAI",type:"items",itemLabels:["Galpão A","Galpão B"]},
      {id:"bollards",label:"05 - Bollards / Pinos",type:"items",itemLabels:["Entrada 01 – Pino 01","Entrada 01 – Pino 02","Reversiva 02 – Pino 03","Reversiva 02 – Pino 04","Saída 04 – Pino 05","Saída 04 – Pino 06"]},
      {id:"cftv",label:"06 - CFTV",type:"count",total:54},
      {id:"monitores",label:"07 - Monitores",type:"items",itemLabels:["CCO 01","CCO 02","CCO 03","CCO 04","CCO 05","CCO 06","CCO 07","Portaria 01","Portaria 02","Portaria 03","Portaria 04"]},
      {id:"totens",label:"08 - Totens",type:"items",itemLabels:["Visitantes","Motorista (CDA)"]},
      {id:"cofres",label:"09 - Cofres",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"cancelas",label:"10 - Cancelas",type:"items",itemLabels:["Entrada 01","Entrada 02 Reversa","Saída 03 Reversa","Saída 04"]},
      {id:"perimeter",label:"11 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04"]},
      {id:"eclusas",label:"12 - Eclusas",type:"items",itemLabels:["CCO Porta 01 Ext.","CCO Porta 02 Int.","Portaria Porta 01 Int.","Portaria Porta 01 Ext."]},
      {id:"internet",label:"13 - Internet",type:"items",itemLabels:["ADM","Visitantes"]},
      {id:"qr_cancelas",label:"14 - Leitores QR Cancelas",type:"items",itemLabels:["Entrada 01 – Sup","Entrada 01 – Inf","Entrada 02 – Sup","Entrada 02 – Inf","Saída 03 – Sup","Saída 03 – Inf","Saída 04 – Sup","Saída 04 – Inf"]},
      {id:"torniquetes",label:"15 - Torniquetes",type:"items",itemLabels:["Torniquete 01 E/S","Torniquete 02 E/S","Torniquete 03 E/S","Torniquete 04 E/S"]},
      {id:"mesa",label:"16 - Mesa Controladora",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"semaforos",label:"17 - Semáforos / Lâmpadas Piloto",type:"items",itemLabels:["Entrada 01","Entrada 02 Reversa","Saída 03 Reversa","Saída 04"]},
      {id:"pictogramas",label:"18 - Pictogramas / Faróis",type:"items",itemLabels:["Farol 01","Farol 02","Farol 03","Farol 04","Farol 05","Farol 06"]},
      {id:"ac",label:"19 - Ar-Condicionado",type:"items",itemLabels:["CCO Servidores","CCO Monitores","Portaria"]},
      {id:"telefone",label:"20 - Telefones",type:"items",itemLabels:["CCO Ramal","CCO Emergencial","CCO Fixo","Portaria 01","Portaria 02"]},
      {id:"intercomunicador",label:"21 - Intercomunicadores",type:"items",itemLabels:["CCO","CDA","Elevador"]},
      {id:"joystick",label:"22 - Joystick Digifort",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"nobreak",label:"23 - Nobreak CCO",type:"items",itemLabels:["CCO"]},
      {id:"manutencao",label:"24 - Visita de Manutenção",type:"maintenance"},
      {id:"infra",label:"25 - Infraestrutura / Obs.",type:"notes"},
    ]
  },
  P606: {
    id:"P606", name:"Golgi Duque de Caxias", short:"Duque",
    categories:[
      {id:"fire",label:"01 - Alarme de Incêndio",type:"items",itemLabels:["CCO","Galpão 01","Galpão 02","Galpão 03","Galpão 04","Galpão 05","Galpão 06","Galpão 07","Galpão 08","Galpão 09","Galpão 10"]},
      {id:"portoes_portaria",label:"02 - Portões Portaria",type:"items",itemLabels:["Portão 01","Portão 02","Portão 03","Portão 04","Portão 05","Portão 06"]},
      {id:"portoes_balanca",label:"03 - Portões Balança HubLog",type:"items",itemLabels:["Portão 01","Portão 02","Portão 03","Portão 04"]},
      {id:"dilaceradores",label:"04 - Dilaceradores",type:"items",itemLabels:["Entrada 01","Reversiva 02","Saída 03"]},
      {id:"cftv",label:"05 - CFTV",type:"count",total:72},
      {id:"monitores",label:"06 - Monitores",type:"items",itemLabels:["CCO 01","CCO 02","CCO 03","CCO 04","CCO 05","Portaria 01"]},
      {id:"joystick",label:"07 - Joystick CFTV",type:"items",itemLabels:["CCO"]},
      {id:"cancela",label:"08 - Cancela",type:"items",itemLabels:["Entrada Principal"]},
      {id:"perimeter",label:"09 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03"]},
      {id:"panic",label:"10 - Botões de Pânico",type:"items",itemLabels:["Móvel 01","Móvel 02","Fixo CCO","Fixo Recepção","Fixo Guarita"]},
      {id:"totens",label:"11 - Totens Keyaccess",type:"items",itemLabels:["Área Externa","Área Interna"]},
      {id:"qr_eclusas",label:"12 - Leitoras QR Eclusas",type:"items",itemLabels:["QR 01","QR 02","QR 03","QR 04","QR 05","QR 06","QR 07","QR 08","QR 09","QR 10","QR 11","QR 12"]},
      {id:"qr_torn",label:"13 - Leitoras QR Torniquetes",type:"items",itemLabels:["QR 01","QR 02","QR 03","QR 04"]},
      {id:"telefone",label:"14 - Telefone Fixo CCO",type:"items",itemLabels:["CCO"]},
      {id:"mesa",label:"15 - Mesa Controladora",type:"items",itemLabels:["Portaria","CFTV"]},
      {id:"interfone",label:"16 - Interfones",type:"items",itemLabels:["Portaria 01","Portaria 02","Portaria 03","Guarita Entrada"]},
      {id:"televisores",label:"17 - Televisores",type:"items",itemLabels:["Apoio Caminhoneiro","Recepção"]},
      {id:"manutencao",label:"18 - Visita de Manutenção",type:"maintenance"},
      {id:"infra",label:"19 - Infraestrutura / Obs.",type:"notes"},
    ]
  },
  P607: {
    id:"P607", name:"Golgi Brasília", short:"Brasília",
    categories:[
      {id:"fire",label:"01 - Alarme de Incêndio",type:"items",itemLabels:["Painel CCO","Painel Guarita","Painel ADM"]},
      {id:"cftv",label:"02 - CFTV",type:"count",total:44},
      {id:"monitores_cco",label:"03 - Monitores CCO",type:"items",itemLabels:["Monitor 01","Monitor 02","Monitor 03"]},
      {id:"monitor_ka",label:"04 - Monitor KeyAccess",type:"items",itemLabels:["Monitor 01"]},
      {id:"joystick",label:"05 - Joystick",type:"items",itemLabels:["CCO"]},
      {id:"nobreak",label:"06 - Nobreak",type:"items",itemLabels:["CCO"]},
      {id:"ac",label:"07 - Ar-Condicionado CCO",type:"items",itemLabels:["Aparelho 01"]},
      {id:"botoeiras",label:"08 - Botoeiras Portões",type:"items",itemLabels:["Entrada 01","Entrada 02","Saída 01","Saída 02"]},
      {id:"perimeter",label:"09 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04"]},
      {id:"panic",label:"10 - Pânico Móvel",type:"items",itemLabels:["Ronda","Pista","CCO"]},
      {id:"totens",label:"11 - Totens",type:"items",itemLabels:["Entrada","Saída"]},
      {id:"qr_leitores",label:"12 - Leitores QR Code",type:"items",itemLabels:["Torniquete 1 Entrada","Torniquete 1 Saída","Torniquete 2 Entrada","Torniquete 2 Saída","Eclusa Ent 1 – QR 01","Eclusa Ent 1 – QR 02","Eclusa Ent 2 – QR 01","Eclusa Ent 2 – QR 02","Eclusa Saí 1 – QR 01","Eclusa Saí 1 – QR 02","Eclusa Saí 2 – QR 01","Eclusa Saí 2 – QR 02"]},
      {id:"tablets",label:"13 - Tablets KeyAccess",type:"items",itemLabels:["Tablet 01","Tablet 02"]},
      {id:"portoes",label:"14 - Portões",type:"items",itemLabels:["Eclusa Ent 1 – P01","Eclusa Ent 1 – P02","Eclusa Ent 2 – P01","Eclusa Ent 2 – P02","Eclusa Saí 1 – P01","Eclusa Saí 1 – P02","Eclusa Saí 2 – P01","Eclusa Saí 2 – P02"]},
      {id:"motores",label:"15 - Motores dos Portões",type:"items",itemLabels:["Ent 1 – M01","Ent 1 – M02","Ent 1 – M03","Ent 2 – M01","Ent 2 – M02","Ent 2 – M03","Saí 1 – M01","Saí 1 – M02","Saí 1 – M03","Saí 1 – M04","Saí 2 – M01","Saí 2 – M02","Saí 2 – M03","Saí 2 – M04"]},
      {id:"sensores",label:"16 - Sensores dos Portões",type:"items",itemLabels:["Ent 1 – S01","Ent 1 – S02","Ent 1 – S03","Ent 1 – S04","Ent 2 – S01","Ent 2 – S02","Ent 2 – S03","Ent 2 – S04","Saí 1 – S01","Saí 1 – S02","Saí 1 – S03","Saí 1 – S04","Saí 2 – S01","Saí 2 – S02","Saí 2 – S03","Saí 2 – S04"]},
      {id:"anti_esmag",label:"17 - Anti-esmagamento",type:"items",itemLabels:["Eclusa Ent 1 – AE 01","Eclusa Ent 1 – AE 02","Eclusa Ent 2 – AE 01","Eclusa Ent 2 – AE 02"]},
      {id:"guarita",label:"18 - Guarita / Recepção",type:"items",itemLabels:["Computador","Monitor 01","Monitor 02","Modem Internet"]},
      {id:"manutencao",label:"19 - Visita de Manutenção",type:"maintenance"},
      {id:"infra",label:"20 - Infraestrutura / Obs.",type:"notes"},
    ]
  },
  P311A: {
    id:"P311A", name:"Mega CL Curitiba", short:"Curitiba",
    categories:[
      {id:"cftv",label:"01 - CFTV",type:"count",total:140},
      {id:"perimeter",label:"02 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Alambrado/Gradil"]},
      {id:"botoeiras",label:"03 - Botoeiras / Portões de Acesso",type:"items",itemLabels:["Botão 01","Botão 02","Botão 03","Botão 04","Botão 05","Botão 06"]},
      {id:"panic",label:"04 - Botões de Pânico",type:"items",itemLabels:["Líder","CCO"]},
      {id:"alertas",label:"05 - Recebimento de Alertas Externos",type:"items",itemLabels:["Central Moked","Central Auxiliar"]},
      {id:"portas_cco",label:"06 - CCO / Abertura de Portas",type:"items",itemLabels:["Porta 01 Externa","Porta 02 Interna"]},
      {id:"keyaccess",label:"07 - Sistema KeyAccess",type:"items",itemLabels:["Torniquete 01","Torniquete 02","Torniquete 03"]},
      {id:"totens",label:"08 - Totens de Autoatendimento",type:"items",itemLabels:["Entrada","Saída"]},
      {id:"qr_code",label:"09 - Leitores de QR Code",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Saída 01","Saída 02","Saída 03"]},
      {id:"computadores",label:"10 - Computadores / CCO",type:"items",itemLabels:["Computador 01","Computador 02","Internet/Rede"]},
      {id:"portoes",label:"11 - Portões",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Saída 01","Saída 02"]},
      {id:"cancelas",label:"12 - Cancelas de Acesso",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Saída 01","Saída 02"]},
      {id:"dilaceradores",label:"13 - Dilaceradores",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Saída 04","Saída 05"]},
      {id:"ac",label:"14 - Ar-Condicionado",type:"items",itemLabels:["CCO","Sala Técnica","Sala Gestão"]},
      {id:"intercomunicadores",label:"15 - Intercomunicadores",type:"items",itemLabels:["Portaria"]},
      {id:"sdai",label:"16 - SDAI (Incêndio)",type:"items",itemLabels:["Central 01","Central 02","Central 03","Central 04","Central 05"]},
      {id:"materiais",label:"17 - Materiais Operacionais",type:"items",itemLabels:["Smartphone (x3)","Lanterna (x2)","Armamento (x2)","Munição (x36)","Rádio HT (x3)","Bodycam (x3)","Moto de Ronda","Pânico ZTRAX (x2)"]},
      {id:"manutencao",label:"18 - Visita de Manutenção",type:"maintenance"},
      {id:"infra",label:"19 - Infraestrutura / Obs.",type:"notes"},
    ]
  },
  P311B: {
    id:"P311B", name:"Mega CL Itajaí", short:"Itajaí",
    categories:[
      {id:"cftv",label:"01 - CFTV",type:"count",total:114},
      {id:"perimeter",label:"02 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04","Zona 05","Zona 06"]},
      {id:"botoeiras",label:"03 - Botoeiras do Dilacerador",type:"items",itemLabels:["Botoeira 01","Botoeira 02","Botoeira 03"]},
      {id:"panic",label:"04 - Botões de Pânico",type:"items",itemLabels:["CCO Fixo","Ronda Móvel","Líder Móvel"]},
      {id:"portas_cco",label:"05 - CCO / Controle de Acesso",type:"items",itemLabels:["Porta 01 Externa – Local","Porta 01 Externa – Remota","Porta 02 Interna – Local","Porta 02 Interna – Remota"]},
      {id:"keyaccess",label:"06 - Sistema KeyAccess",type:"items",itemLabels:["Catraca 01","Catraca 02","Catraca 03"]},
      {id:"totens_cancela",label:"07 - Totens nas Cancelas",type:"items",itemLabels:["Totem Cancela 01","Totem Cancela 02","Totem Cancela 03","Totem Cancela 04","Totem Cancela 05","Totem Cancela 06"]},
      {id:"qr_code",label:"08 - Leitores QR Code",type:"items",itemLabels:["Cancela 01 Sup","Cancela 01 Inf","Cancela 02 Sup","Cancela 02 Inf","Cancela 04 Sup","Cancela 04 Inf","Saída Cancela 02 Sup","Saída Cancela 02 Inf","Saída Cancela 03 Sup","Saída Cancela 03 Inf","Saída Cancela 04 Sup","Saída Cancela 04 Inf"]},
      {id:"computadores",label:"09 - Computadores / CCO",type:"items",itemLabels:["Computador Principal","Computador Secundário","Internet"]},
      {id:"portoes",label:"10 - Portões",type:"items",itemLabels:["Portão 01","Portão 02","Portão 03","Portão 04"]},
      {id:"dilaceradores",label:"11 - Dilaceradores",type:"items",itemLabels:["Cancela 01","Cancela 02","Cancela 03","Cancela 04"]},
      {id:"ac",label:"12 - Ar-Condicionado",type:"items",itemLabels:["CCO","Sala Técnica"]},
      {id:"materiais",label:"13 - Materiais Operacionais",type:"items",itemLabels:["Smartphone (x3)","Lanterna (x2)","Armamento (x2)","Munição (x36)","Rádio HT (x3)","Bodycam (x2)","Moto de Ronda","Pânico ZTRAX (x2)"]},
      {id:"sdai",label:"14 - SDAI (Incêndio)",type:"items",itemLabels:["Central Portaria","Central Casa de Bombas","Central Sala Técnica"]},
      {id:"manutencao",label:"15 - Visita de Manutenção",type:"maintenance"},
      {id:"infra",label:"16 - Infraestrutura / Obs.",type:"notes"},
    ]
  },
  P505: {
    id:"P505", name:"Klog Guarulhos", short:"Guarulhos",
    categories:[
      {id:"panic",label:"01 - Botões de Pânico",type:"items",itemLabels:["Fixo CCO"]},
      {id:"giroflex",label:"02 - Giroflex das Eclusas",type:"items",itemLabels:["Entrada 01","Entrada 02","Saída 03 Reversiva","Saída 04"]},
      {id:"sdai",label:"03 - Alarme SDAI Portaria",type:"items",itemLabels:["G100","G200"]},
      {id:"garra",label:"04 - Garra de Tigre",type:"items",itemLabels:["Eclusa Entrada 01","Eclusa Entrada 02","Eclusa Reversiva 03","Eclusa Saída 04"]},
      {id:"cftv",label:"05 - CFTV",type:"count",total:73},
      {id:"monitores",label:"06 - Monitores CCO e Portaria",type:"items",itemLabels:["CCO 01","CCO 02","CCO 03","Portaria 01","Portaria 02","Portaria 03"]},
      {id:"totens",label:"07 - Totens Visitantes / Motoristas",type:"items",itemLabels:["Totem Visitantes","Totem Motoristas"]},
      {id:"cofres",label:"08 - Cofres",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"cancelas",label:"09 - Cancelas, Hastes e Motores",type:"items",itemLabels:["Entrada 01","Entrada 02","Saída 03 Reversiva","Saída 04"]},
      {id:"perimeter",label:"10 - Alarme Perimetral",type:"items",itemLabels:["Zona 01","Zona 02","Zona 03","Zona 04","Zona 05","Zona 06","Zona 07","Zona 08","Zona 09","Zona 10","Zona 11","Zona 12"]},
      {id:"eclusas",label:"11 - Eclusas CCO e Portaria",type:"items",itemLabels:["CCO Porta 01 Ext – Local","CCO Porta 02 Int – Local","Portaria Porta 01 Int – Local","Portaria Porta 02 Ext – Local"]},
      {id:"internet",label:"12 - Internet",type:"single"},
      {id:"facial",label:"13 - Leitores Faciais Eclusas/Cancelas",type:"items",itemLabels:["Eclusa Entrada 01","Eclusa Entrada 02","Eclusa Saída 03 Reversiva","Eclusa Saída 04"]},
      {id:"torniquetes",label:"14 - Torniquetes Leitores Faciais",type:"items",itemLabels:["Torniquete 01 E/S","Torniquete 02 E/S","Torniquete 03 E/S","Torniquete 04 E/S"]},
      {id:"mesa",label:"15 - Mesa Controladora CCO e Portaria",type:"items",itemLabels:["CCO","Portaria"]},
      {id:"ac",label:"16 - Ar-Condicionado",type:"items",itemLabels:["CCO","Portaria Aparelho 01"]},
      {id:"telefone",label:"17 - Telefone Fixo CCO e Portaria",type:"items",itemLabels:["Ramal CCO","Ramal Portaria"]},
      {id:"intercomunicadores",label:"18 - Intercomunicadores",type:"items",itemLabels:["Portaria","CCO","Torniquetes","Cancelas"]},
      {id:"eletroima",label:"19 - Eletroímã / Eclusa / Portas",type:"items",itemLabels:["Portaria","CCO","Eclusa"]},
      {id:"portoes",label:"20 - Portões / Anti-esmagamento",type:"items",itemLabels:["Eclusa 01 Externa","Eclusa 01 Interna","Eclusa 02 Externa","Eclusa 02 Interna","Eclusa 03 Externa","Eclusa 03 Interna","Eclusa 04 Externa","Eclusa 04 Interna"]},
      {id:"farois",label:"21 - Faróis das Cancelas",type:"items",itemLabels:["Cancela Eclusa 01 Ext","Cancela Eclusa 01 Int","Cancela Eclusa 02 Ext","Cancela Eclusa 02 Int","Cancela Eclusa 03 Ext","Cancela Eclusa 03 Int","Cancela Eclusa 04 Ext"]},
      {id:"manutencao",label:"22 - Visita de Manutenção",type:"maintenance"},
      {id:"infra",label:"23 - Infraestrutura / Obs.",type:"notes"},
    ]
  },
};


// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  return {grade:"D", color:"#ef4444", label:"Crítico"};
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
          result.push({project, cat: cat.label, item: "—", status: st, since: s.since, days, note: s.note});
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
const fmtDate = (d) => { if(!d)return"—"; const[y,m,day]=d.split("-"); return`${day}/${m}/${y}`; };
const calcPct = (ok,total) => total===0?100:Math.round((ok/total)*100);

function getWeekLabel(dateStr) {
  if(!dateStr) return "S?";
  try {
    const d=new Date(dateStr+"T12:00:00");
    const months=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return `S${Math.ceil(d.getDate()/7)} ${months[d.getMonth()]}`;
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

// Build from last report — carry statuses, blank header
function buildFromLast(project, lastState) {
  if(!lastState) return buildBlank(project);
  const st = {};
  for(const cat of project.categories){
    if(cat.type==="single"){
      const prev=lastState[cat.id];
      const prevSt=prev?.status??(prev?.ok===false?"inop":"ok");
      // carry inop/partial with since date
      st[cat.id]={status:prevSt, note:prev?.note||"", since:prevSt!=="ok"?prev?.since||todayStr():""};
    } else if(cat.type==="items"){
      const prev=lastState[cat.id]??cat.itemLabels.map(()=>({status:"ok",note:"",since:""}));
      st[cat.id]=cat.itemLabels.map((_,i)=>{
        const p=prev[i]??{status:"ok"};
        const pSt=p.status??(p.ok===false?"inop":"ok");
        return {status:pSt, note:p.note||"", since:pSt!=="ok"?p.since||todayStr():""};
      });
    } else if(cat.type==="count"){
      // carry inoperatives
      st[cat.id]={total:lastState[cat.id]?.total??cat.total, inoperative:[...(lastState[cat.id]?.inoperative??[])]};
    } else if(cat.type==="notes") st[cat.id]={items:[]};
    else if(cat.type==="maintenance") st[cat.id]={visits:[]};
  }
  return st;
}

function computeHealth(project, state) {
  let total=0, okCount=0, partial=0, inop=0;
  for(const cat of project.categories){
    const s=state[cat.id]; if(!s) continue;
    if(cat.type==="single"){
      total++;
      const st=s.status??(s.ok===false?"inop":"ok");
      if(st==="ok") okCount++; else if(st==="partial"){okCount+=0.5;partial++;} else inop++;
    } else if(cat.type==="items"){
      total+=s.length;
      s.forEach(v=>{
        const st=v.status??(v.ok===false?"inop":"ok");
        if(st==="ok") okCount++; else if(st==="partial"){okCount+=0.5;partial++;} else inop++;
      });
    } else if(cat.type==="count"){
      const t=s.total??cat.total; total+=t;
      const inopN=s.inoperative?.length??0; okCount+=t-inopN; inop+=inopN;
    }
  }
  return { total, ok:Math.round(okCount), partial, inop, pct:calcPct(Math.round(okCount),total) };
}

// ─── Recurrence Analysis ──────────────────────────────────────────────────────
function analyzeRecurrence(project, history) {
  // Returns map of {catId_itemIdx: {count, consecutiveWeeks}}
  const recurrence = {};
  history.forEach(r => {
    for(const cat of project.categories){
      const s=r.state[cat.id]; if(!s) continue;
      if(cat.type==="single"){
        const st=s.status??(s.ok===false?"inop":"ok");
        if(st!=="ok"){
          const key=`${cat.id}_0`;
          recurrence[key]=(recurrence[key]||0)+1;
        }
      } else if(cat.type==="items"){
        s.forEach((v,i)=>{
          const st=v.status??(v.ok===false?"inop":"ok");
          if(st!=="ok"){
            const key=`${cat.id}_${i}`;
            recurrence[key]=(recurrence[key]||0)+1;
          }
        });
      } else if(cat.type==="count"){
        if((s.inoperative?.length??0)>0){
          const key=`${cat.id}_count`;
          recurrence[key]=(recurrence[key]||0)+1;
        }
      }
    }
  });
  return recurrence;
}

function getRecurrenceBadge(count) {
  if(count>=RECURRENCE_CRIT) return {label:"CRÍTICO",color:"#dc2626",bg:"#fee2e2"};
  if(count>=RECURRENCE_WARN) return {label:"REINCIDENTE",color:"#d97706",bg:"#fef3c7"};
  return null;
}

// ─── Consecutive weeks inop ───────────────────────────────────────────────────
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

// ─── MokLog Logo ──────────────────────────────────────────────────────────────
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

// ─── Smart Photo Upload ───────────────────────────────────────────────────────
function SmartPhotoUpload({catId, catLabel, itemLabel, photos, setPhotos}) {
  const key = itemLabel ? `${catId}_${itemLabel}` : catId;
  const existing = photos.filter(p=>p.photoKey===key);
  const handlePhoto = (e) => {
    try {
      const file = e.target.files?.[0]; if(!file) return;
      // Check file size - limit to 5MB to avoid crash
      if(file.size > 5 * 1024 * 1024) {
        alert("Foto muito grande. Use uma imagem menor que 5MB.");
        return;
      }
      const r = new FileReader();
      r.onerror = () => console.error("Error reading file");
      r.onload = ev => {
        try {
          const filtered = photos.filter(p=>p.photoKey!==key);
          setPhotos([...filtered, {photoKey:key, catId, catLabel, itemLabel, name:file.name, url:ev.target.result}]);
        } catch(err) { console.error("Photo save error:", err); }
      };
      r.readAsDataURL(file);
    } catch(err) { console.error("Photo handle error:", err); }
  };
  const removePhoto = () => setPhotos(photos.filter(p=>p.photoKey!==key));
  if(existing.length>0) return (
    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6,padding:"6px 8px",background:"#020510",borderRadius:6,border:"1px solid #0f172a"}}>
      <img src={existing[0].url} alt="" style={{width:52,height:40,objectFit:"cover",borderRadius:4,border:"1px solid #1e293b"}}/>
      <div style={{flex:1,fontSize:10,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{itemLabel||catLabel}</div>
      <button onClick={removePhoto} style={{...S.iconBtn,color:"#ef4444",flexShrink:0}}>✕</button>
    </div>
  );
  return (
    <label style={{display:"flex",alignItems:"center",gap:6,marginTop:6,cursor:"pointer",color:"#334155",fontSize:11,padding:"4px 0"}}>
      <span style={{fontSize:14}}>📷</span>
      <span>Foto: {itemLabel||catLabel} (câmera ou galeria)</span>
      <input type="file" accept="image/*" style={{position:"absolute",opacity:0,width:0,height:0}} onChange={handlePhoto}/>
    </label>
  );
}

// ─── Category Components ──────────────────────────────────────────────────────
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
        {inop.map((it,i)=>(
          <div key={i}>
            <div style={{...S.itemRow,flexWrap:"wrap",gap:6,marginBottom:5}}>
              <input placeholder="ID (ex: CF-32)" value={it.id} onChange={e=>upd(i,{id:e.target.value})} style={{...S.inp,width:105,fontSize:12}}/>
              <input placeholder="Problema..." value={it.note} onChange={e=>upd(i,{note:e.target.value})} style={{...S.inp,flex:1,minWidth:100,fontSize:12}}/>
              <input type="date" value={it.since} onChange={e=>upd(i,{since:e.target.value})} style={{...S.inp,maxWidth:145,fontSize:12}}/>
              <button onClick={()=>rem(i)} style={{...S.iconBtn,color:"#ef4444"}}>✕</button>
            </div>
            {setPhotos&&<SmartPhotoUpload catId={cat.id} catLabel={cat.label} itemLabel={it.id||`Item ${i+1}`} photos={photos} setPhotos={setPhotos}/>}
          </div>
        ))}
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
            <button onClick={()=>rem(i)} style={{...S.iconBtn,color:"#ef4444"}}>✕</button>
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
              <button onClick={()=>rem(i)} style={{...S.iconBtn,color:"#ef4444"}}>✕</button>
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

// ─── PIN Gate ─────────────────────────────────────────────────────────────────
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
        {err&&<div style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
        <button onClick={try_} style={{...S.primaryBtn,width:"100%",marginBottom:10,fontSize:14}}>Entrar</button>
        <button onClick={onBack} style={{...S.secBtn,width:"100%",fontSize:14}}>← Voltar</button>
      </div>
    </div>
  );
}

// ─── MiniChart ───────────────────────────────────────────────────────────────
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
      <defs>
        <linearGradient id={`grad_${data.length}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((v,i)=>{
        const x=(i/(data.length-1))*width;
        const y=height-((v-min)/range)*height;
        return <circle key={i} cx={x} cy={y} r="3" fill={color}/>;
      })}
    </svg>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({stored, onBack, onDeleteReport}) {
  const [pin,setPin]=useState(""); const [auth,setAuth]=useState(false); const [err,setErr]=useState(false);
  const [selProject,setSelProject]=useState(null); const [viewReport,setViewReport]=useState(null);
  const [pendScreen,setPendScreen]=useState(false);
  const [confirmDel,setConfirmDel]=useState(null); const [selReports,setSelReports]=useState({});
  const [sessionTime,setSessionTime]=useState(Date.now());
  const [viewLinks,setViewLinks]=useState(()=>{try{return JSON.parse(localStorage.getItem("moklog_viewlinks")||"{}");}catch{return{};}});

  useEffect(()=>{
    if(!auth) return;
    const t=setInterval(()=>{if(Date.now()-sessionTime>SESSION_TIMEOUT){setAuth(false);setPin("");}},30000);
    return ()=>clearInterval(t);
  },[auth,sessionTime]);

  const resetSess=()=>setSessionTime(Date.now());

  const toggleViewLink=(pid)=>{
    const cur=viewLinks[pid];
    const next={...viewLinks};
    if(cur) delete next[pid]; else next[pid]=generateViewToken(pid);
    setViewLinks(next);
    localStorage.setItem("moklog_viewlinks",JSON.stringify(next));
  };

  if(!auth) return(
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}} onClick={resetSess}>
      <div style={{background:"#060c18",border:"1px solid #1e293b",borderRadius:16,padding:"32px 28px",maxWidth:340,width:"100%",textAlign:"center",margin:16}}>
        <MoklogLogo size={48}/>
        <div style={{fontSize:17,fontWeight:800,color:"#f1f5f9",marginTop:10,marginBottom:2}}>MokLog <span style={{color:"#cc2222"}}>CheckTest</span></div>
        <div style={{fontSize:13,color:"#cc2222",fontWeight:700,marginBottom:4}}>Painel Gerencial</div>
        <div style={{fontSize:12,color:"#475569",marginBottom:20}}>Acesso restrito</div>
        <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pin}
          onChange={e=>{setPin(e.target.value);setErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter"){if(pin===ADMIN_PIN){setAuth(true);resetSess();}else setErr(true);}}}
          style={{...S.inp,textAlign:"center",fontSize:22,letterSpacing:10,marginBottom:10}}/>
        {err&&<div style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
        <button onClick={()=>{if(pin===ADMIN_PIN){setAuth(true);resetSess();}else setErr(true);}} style={{...S.primaryBtn,width:"100%",marginBottom:10,fontSize:14}}>Entrar</button>
        <button onClick={onBack} style={{...S.secBtn,width:"100%",fontSize:14}}>← Voltar</button>
      </div>
    </div>
  );

  if(pendScreen) return <PendenciesScreen stored={stored} onBack={()=>setPendScreen(false)}/>;

  // View single report
  if(viewReport) return(
    <div style={S.page} onClick={resetSess}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:8}}>
          <button onClick={()=>setViewReport(null)} style={S.backBtn}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{viewReport.project.id} — {getWeekLabel(viewReport.report.meta?.date)}</div>
            <div style={{fontSize:11,color:"#334155"}}>{fmtDate(viewReport.report.meta?.date)} · Lider: {viewReport.report.meta?.leader||"—"}</div>
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
          <button onClick={()=>generatePDF(viewReport.project,viewReport.report.state,viewReport.report.meta,[])}
            style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#7c3aed,#6d28d9)",fontSize:13}}>📄 PDF</button>
          <button onClick={()=>{setConfirmDel({projectId:viewReport.project.id,idx:viewReport.idx,date:viewReport.report.meta?.date});setViewReport(null);}}
            style={{...S.secBtn,flex:1,color:"#ef4444",borderColor:"#ef444433",fontSize:13}}>🗑 Excluir</button>
        </div>
      </div>
    </div>
  );

  // Project detail
  if(selProject){
    const p=selProject;
    const hist=stored[p.id]?.history??[];
    const sel=selReports[p.id]??[];
    const toggleSel=(idx)=>{
      const cur=selReports[p.id]??[];
      const next=cur.includes(idx)?cur.filter(i=>i!==idx):(cur.length<6?[...cur,idx]:cur);
      setSelReports(prev=>({...prev,[p.id]:next}));
    };
    const recurrence=analyzeRecurrence(p,hist);
    const viewToken=viewLinks[p.id];
    const viewUrl=viewToken?`${window.location.origin}${window.location.pathname}?view=${p.id}_${viewToken}`:"";

    return(
      <div style={S.page} onClick={resetSess}>
        <div style={S.formWrap}>
          <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:8}}>
            <button onClick={()=>{setSelProject(null);setSelReports({});}} style={S.backBtn}>← Painel</button>
            <MoklogLogo size={32}/>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{p.id} – {p.name}</div>
              <div style={{fontSize:11,color:"#334155"}}>{hist.length}/{MAX_HISTORY} relatorios</div>
            </div>
          </div>

          {/* View link for maintenance */}
          <div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:10,padding:"10px 14px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>🔗 Link Manutencao</div>
                <div style={{fontSize:10,color:"#64748b"}}>{viewToken?"Ativo — empresa ve pendencias":"Inativo"}</div>
              </div>
              <button onClick={()=>toggleViewLink(p.id)}
                style={{...S.sm,...(viewToken?S.smBad:S.smOk),fontSize:11,padding:"5px 10px"}}>
                {viewToken?"Desativar":"Ativar"}
              </button>
            </div>
            {viewToken&&<div style={{marginTop:8}}>
              <div style={{fontSize:9,color:"#64748b",wordBreak:"break-all",background:"#020510",padding:"5px 8px",borderRadius:5,marginBottom:5}}>{viewUrl}</div>
              <button onClick={()=>navigator.clipboard.writeText(viewUrl)}
                style={{...S.sm,fontSize:10,width:"100%"}}>📋 Copiar Link</button>
            </div>}
          </div>

          {sel.length>=2&&(
            <button onClick={()=>generateConsolidatedPDF(p,sel.map(i=>hist[i]).sort((a,b)=>(a.meta?.date||"").localeCompare(b.meta?.date||"")))}
              style={{...S.primaryBtn,width:"100%",background:"linear-gradient(135deg,#7c3aed,#6d28d9)",marginBottom:8,fontSize:14}}>
              📊 Gerar Consolidado ({sel.length} semanas)
            </button>
          )}
          {sel.length===1&&<div style={{background:"#0f172a",borderRadius:8,padding:"8px",textAlign:"center",fontSize:12,color:"#64748b",marginBottom:8}}>Selecione mais 1 para consolidado</div>}
          {sel.length===0&&hist.length>0&&<div style={{background:"#0f172a",borderRadius:8,padding:"8px",textAlign:"center",fontSize:12,color:"#64748b",marginBottom:8}}>☑ Selecione 2 a 6 relatorios para consolidado</div>}

          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {hist.slice().reverse().map((r,revIdx)=>{
              const realIdx=hist.length-1-revIdx;
              const h=computeHealth(p,r.state);
              const color=h.pct>=90?"#22c55e":h.pct>=70?"#f59e0b":"#ef4444";
              const weekLabel=getWeekLabel(r.meta?.date);
              const isSelected=sel.includes(realIdx);
              return(
                <div key={realIdx} style={{background:"#060c18",border:`2px solid ${isSelected?color:"#0f172a"}`,borderRadius:12,padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <button onClick={()=>toggleSel(realIdx)}
                      style={{width:30,height:30,borderRadius:6,border:`2px solid ${isSelected?color:"#1e293b"}`,background:isSelected?color+"22":"transparent",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:isSelected?color:"#334155"}}>
                      {isSelected?"✓":""}
                    </button>
                    <HealthRing pct={h.pct} size={44}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9"}}>{weekLabel} <span style={{fontSize:11,color:"#334155",fontWeight:400}}>{fmtDate(r.meta?.date)}</span></div>
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
                    <button onClick={()=>generatePDF(p,r.state,r.meta,[])} style={{...S.primaryBtn,flex:1,padding:"9px",fontSize:12,background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}}>📄 PDF</button>
                    <button onClick={()=>setConfirmDel({projectId:p.id,idx:realIdx,date:r.meta?.date})} style={{...S.secBtn,padding:"9px 12px",fontSize:12,color:"#ef4444",borderColor:"#ef444433"}}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {confirmDel&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16}}>
            <div style={{background:"#060c18",border:"1px solid #ef4444",borderRadius:14,padding:"24px 20px",maxWidth:320,width:"100%",textAlign:"center"}}>
              <div style={{fontSize:26,marginBottom:10}}>🗑️</div>
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

  // Main dashboard overview
  const allProjects=Object.values(PROJECTS);
  const valid=allProjects.map(p=>{
    const hist=stored[p.id]?.history??[]; if(!hist.length) return null;
    const last=hist[hist.length-1]; const h=computeHealth(p,last.state);
    return{...p,pct:h.pct,date:last.meta?.date,inopN:h.inop};
  }).filter(Boolean);
  const avgPct=valid.length?Math.round(valid.reduce((a,b)=>a+b.pct,0)/valid.length):null;

  return(
    <div style={S.page} onClick={resetSess}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:8}}>
          <button onClick={onBack} style={S.backBtn}>← Inicio</button>
          <MoklogLogo size={34}/>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:900,color:"#f1f5f9"}}>MokLog <span style={{color:"#cc2222"}}>CheckTest</span></div>
            <div style={{fontSize:11,color:"#334155"}}>Painel Gerencial — toque no projeto</div>
          </div>
          {avgPct!==null&&<HealthRing pct={avgPct} size={52}/>}
        </div>

        {/* Quick stats bar */}
        {(()=>{
          const allPend=getAllPendencies(stored);
          const critDays=allPend.filter(p=>p.days&&p.days>=30);
          return allPend.length>0?(
            <div style={{background:"#1a0202",border:"1px solid #ef444444",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}
              onClick={()=>setPendScreen(true)}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"#ef4444"}}>🔴 {allPend.filter(p=>p.status==="inop").length} Inop · ⚠️ {allPend.filter(p=>p.status==="partial").length} Parcial</div>
                {critDays.length>0&&<div style={{fontSize:10,color:"#f59e0b",marginTop:2}}>{critDays.length} item(s) com +30 dias sem resolução</div>}
              </div>
              <span style={{color:"#ef4444",fontSize:14,fontWeight:700}}>Ver todas →</span>
            </div>
          ):null;
        })()}

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {allProjects.map(p=>{
            const hist=stored[p.id]?.history??[];
            const last=hist.length?hist[hist.length-1]:null;
            const h=last?computeHealth(p,last.state):null;
            const color=h?h.pct>=90?"#22c55e":h.pct>=70?"#f59e0b":"#ef4444":"#334155";
            return(
              <div key={p.id} onClick={()=>setSelProject(p)}
                style={{background:"#060c18",border:`1px solid ${h?color+"44":"#0f172a"}`,borderRadius:12,padding:"14px 16px",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  {h?<HealthRing pct={h.pct} size={50}/>:<div style={{width:50,height:50,borderRadius:"50%",border:"2px solid #1e293b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#334155"}}>—</div>}
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{p.id} – {p.name}</div>
                      {(()=>{const sc=getProjectScore(p,hist);return sc?<span style={{fontSize:10,fontWeight:900,color:sc.color,background:sc.color+"22",padding:"1px 6px",borderRadius:6}}>{sc.grade}</span>:null;})()}
                    </div>
                    {h?<div style={{fontSize:11,color:"#475569",marginTop:2}}>Ultimo: {fmtDate(last.meta?.date)} · {h.inop} inop · {hist.length} rel.</div>
                      :<div style={{fontSize:11,color:"#334155",marginTop:2}}>Sem registros</div>}
                    {hist.length>=2&&<div style={{marginTop:6}}>
                      <MiniChart data={hist.slice(-8).map(r=>computeHealth(p,r.state).pct)} width={160} height={32}/>
                    </div>}
                  </div>
                  <span style={{color:"#334155",fontSize:16}}>›</span>
                </div>
                {h&&<div style={{marginTop:8,height:4,background:"#0f172a",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${h.pct}%`,background:color,borderRadius:2}}/>
                </div>}
                {hist.length>1&&<div style={{display:"flex",gap:3,marginTop:6}}>
                  {hist.slice(-6).map((r,i)=>{
                    const rh=computeHealth(p,r.state);
                    const rc=rh.pct>=90?"#22c55e":rh.pct>=70?"#f59e0b":"#ef4444";
                    return <div key={i} style={{flex:1,height:24,background:`${rc}22`,border:`1px solid ${rc}44`,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:rc,fontWeight:700}}>{rh.pct}%</div>;
                  })}
                </div>}
              </div>
            );
          })}
        </div>
      </div>
      {confirmDel&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16}}>
          <div style={{background:"#060c18",border:"1px solid #ef4444",borderRadius:14,padding:"24px 20px",maxWidth:320,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:26,marginBottom:10}}>🗑️</div>
            <div style={{fontSize:15,fontWeight:700,color:"#f1f5f9",marginBottom:6}}>Excluir relatorio?</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>{confirmDel.projectId} — {fmtDate(confirmDel.date)}</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{onDeleteReport(confirmDel.projectId,confirmDel.idx);setConfirmDel(null);}}
                style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#b91c1c,#991b1b)",fontSize:14}}>Excluir</button>
              <button onClick={()=>setConfirmDel(null)} style={{...S.secBtn,flex:1,fontSize:14}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pendencies Screen ───────────────────────────────────────────────────────
function PendenciesScreen({stored, onBack}) {
  const [filter, setFilter] = useState("all"); // all | critical | partial
  const all = getAllPendencies(stored);
  const filtered = filter === "all" ? all : filter === "critical" ? all.filter(p => p.status === "inop") : all.filter(p => p.status === "partial");
  
  const critCount = all.filter(p => p.status === "inop").length;
  const partCount = all.filter(p => p.status === "partial").length;
  
  return(
    <div style={S.page}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:8}}>
          <button onClick={onBack} style={S.backBtn}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:800,color:"#f1f5f9"}}>Pendências Globais</div>
            <div style={{fontSize:11,color:"#334155"}}>Todos os projetos · {all.length} itens</div>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
          <div style={{background:"#060c18",border:"1px solid #ef444433",borderRadius:10,padding:"10px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:900,color:"#ef4444"}}>{critCount}</div>
            <div style={{fontSize:10,color:"#64748b",fontWeight:700}}>INOP</div>
          </div>
          <div style={{background:"#060c18",border:"1px solid #f59e0b33",borderRadius:10,padding:"10px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:900,color:"#f59e0b"}}>{partCount}</div>
            <div style={{fontSize:10,color:"#64748b",fontWeight:700}}>PARCIAL</div>
          </div>
          <div style={{background:"#060c18",border:"1px solid #1e293b",borderRadius:10,padding:"10px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:900,color:"#94a3b8"}}>{all.length}</div>
            <div style={{fontSize:10,color:"#64748b",fontWeight:700}}>TOTAL</div>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {[["all","Todos",all.length],["critical","Inop",critCount],["partial","Parcial",partCount]].map(([key,label,count])=>(
            <button key={key} onClick={()=>setFilter(key)}
              style={{...S.sm,flex:1,padding:"7px",fontSize:11,...(filter===key?{background:"#1d4ed8",border:"1px solid #1d4ed8",color:"white"}:{})}}>
              {label} ({count})
            </button>
          ))}
        </div>

        {/* Pendencies list */}
        {filtered.length===0&&(
          <div style={{textAlign:"center",padding:"30px 0",color:"#22c55e",fontSize:14}}>
            <div style={{fontSize:28,marginBottom:8}}>✅</div>
            Nenhuma pendência encontrada!
          </div>
        )}
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
                      <span style={{fontSize:10,fontWeight:700,color:color,background:color+"22",padding:"2px 6px",borderRadius:5}}>
                        {p.status==="inop"?"INOP":"PARCIAL"}
                      </span>
                      {p.days!==null&&<span style={{fontSize:10,color:p.days>=30?"#ef4444":p.days>=14?"#f59e0b":"#64748b",fontWeight:700}}>
                        há {p.days} dia{p.days!==1?"s":""}
                      </span>}
                    </div>
                    <div style={{fontSize:12,fontWeight:600,color:"#cbd5e1",marginBottom:2}}>{p.cat}</div>
                    {p.item&&p.item!=="—"&&<div style={{fontSize:11,color:"#94a3b8"}}>↳ {p.item}</div>}
                    {p.note&&<div style={{fontSize:11,color:"#64748b",marginTop:2,fontStyle:"italic"}}>{p.note}</div>}
                    <div style={{fontSize:10,color:"#334155",marginTop:3}}>Desde: {fmtDate(p.since)||"—"} · {p.project.name}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {all.length>0&&(
          <div style={{marginTop:8,background:"#060c18",border:"1px solid #0f172a",borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:11,color:"#475569",textAlign:"center"}}>
              {all.filter(p=>p.days&&p.days>=30).length} item(s) com mais de 30 dias · {all.filter(p=>p.days&&p.days>=14&&p.days<30).length} entre 14-30 dias
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── History Screen ───────────────────────────────────────────────────────────
function HistoryScreen({project, stored, onBack}) {
  const hist=(stored[project.id]?.history??[]).slice().reverse();
  return(
    <div style={S.page}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:4}}>
          <button onClick={onBack} style={S.backBtn}>← Voltar</button>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#f1f5f9"}}>Historico — {project.id}</div>
            <div style={{fontSize:11,color:"#334155"}}>{project.name} · somente leitura</div>
          </div>
        </div>
        {!hist.length&&<div style={{textAlign:"center",padding:"40px 0",color:"#334155",fontSize:14}}><div style={{fontSize:28,marginBottom:8}}>📭</div>Nenhum relatorio salvo ainda.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {hist.map((r,i)=>{
            const h=computeHealth(project,r.state);
            const color=h.pct>=90?"#22c55e":h.pct>=70?"#f59e0b":"#ef4444";
            const weekLabel=getWeekLabel(r.meta?.date);
            return(
              <div key={i} style={{background:"#060c18",border:`1px solid ${color}22`,borderRadius:12,padding:"12px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <HealthRing pct={h.pct} size={46}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{weekLabel} <span style={{fontSize:11,color:"#334155",fontWeight:400}}>{fmtDate(r.meta?.date)}</span></div>
                    <div style={{fontSize:11,color:"#475569"}}>Lider: {r.meta?.leader||"—"} · CCO: {r.meta?.cco||"—"}</div>
                    {r.meta?.signature&&<div style={{fontSize:11,color:"#64748b"}}>✍ {r.meta.signature}</div>}
                    <div style={{fontSize:11,color:h.inop>0?"#ef4444":"#22c55e",fontWeight:600}}>{h.inop>0?`${h.inop} inoperante(s)`:"✔ Tudo OK"}</div>
                  </div>
                </div>
                <div style={{marginTop:8,height:3,background:"#0f172a",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${h.pct}%`,background:color,borderRadius:2}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Report Screen ────────────────────────────────────────────────────────────
function ReportScreen({project, state, meta, photos, onBack, onHome, onSendEmail}) {
  const [copied,setCopied]=useState(false);
  const [emailSent,setEmailSent]=useState(false);
  const [sending,setSending]=useState(false);
  const text=generateReportText(project,state,meta,photos);
  const subject=`[${project.id}] MokLog CheckTest – Teste Semanal – ${fmtDate(meta.date)}`;

  const handleWhatsApp=()=>{
    const h=computeHealth(project,state);
    const waIssues=[];
    for(const cat of project.categories){
      const s=state[cat.id]; if(!s) continue;
      if(cat.type==="single"){const st=s.status??(s.ok===false?"inop":"ok");if(st!=="ok")waIssues.push(`• ${cat.label}: ${st==="partial"?"Parcial":"Inop"}`);}
      else if(cat.type==="items"){s.forEach((v,i)=>{const st=v.status??(v.ok===false?"inop":"ok");if(st!=="ok")waIssues.push(`• ${cat.itemLabels[i]}: ${st==="partial"?"Parcial":"Inop"}`);});}
      else if(cat.type==="count"){const inopN=s.inoperative?.length??0;if(inopN>0)waIssues.push(`• ${cat.label}: ${inopN} inop`);}
    }
    const inopText=waIssues.length>0?`\n\n*Itens com problema:*\n${waIssues.slice(0,10).join("\n")}${waIssues.length>10?`\n...+${waIssues.length-10} mais`:""}`:
      "\n\n✅ Todos os itens operando normalmente.";
    const msg=encodeURIComponent(
      `*[${project.id}] MokLog CheckTest – ${fmtDate(meta.date)}*\n` +
      `📍 ${project.name}\n` +
      `📊 Saúde: *${h.pct}%* | ✅ ${h.ok} OK | ⚠️ ${h.partial} Parcial | 🔴 ${h.inop} Inop\n` +
      `👤 Líder: ${meta.leader||"—"} · CCO: ${meta.cco||"—"}\n` +
      `✍️ Assinatura: ${meta.signature||"—"}` +
      inopText +
      `\n\n🔗 https://moklog-checktest.vercel.app\n_MokLog CheckTest © Moked Security_`
    );
    window.open(`https://wa.me/?text=${msg}`,"_blank");
  };

  const handleEmail=async()=>{
    setSending(true);
    const h=computeHealth(project,state);
    const issues=[];
    for(const cat of project.categories){
      const s=state[cat.id]; if(!s) continue;
      if(cat.type==="single"){const st=s.status??(s.ok===false?"inop":"ok");if(st!=="ok")issues.push(`  • ${cat.label}: ${st==="partial"?"PARCIAL":"INOPERANTE"}${s.since?` desde ${fmtDate(s.since)}`:""} ${s.note?`- ${s.note}`:""}`);}
      else if(cat.type==="items"){s.forEach((v,i)=>{const st=v.status??(v.ok===false?"inop":"ok");if(st!=="ok")issues.push(`  • ${cat.label} / ${cat.itemLabels[i]}: ${st==="partial"?"PARCIAL":"INOPERANTE"}${v.since?` desde ${fmtDate(v.since)}`:""} ${v.note?`- ${v.note}`:""}`);});}
      else if(cat.type==="count"){(s.inoperative??[]).forEach(it=>issues.push(`  • ${cat.label} [${it.id||"?"}]${it.since?` desde ${fmtDate(it.since)}`:""} ${it.note?`- ${it.note}`:""}`));}
    }
    const enrichedMessage = [
      "================================================",
      `  MOKLOG CHECKTEST - RELATORIO DE TESTE SEMANAL`,
      "================================================",
      `Projeto  : ${project.id} - ${project.name}`,
      `Data     : ${fmtDate(meta.date)}`,
      `Periodo  : ${meta.start||"--"} as ${meta.end||"--"}`,
      `Lider    : ${meta.leader||"--"}`,
      `CCO      : ${meta.cco||"--"}`,
      `Moked 24h: ${meta.moked||"--"} | Contato: ${meta.mokedContact?"Realizado":"Nao realizado"}${meta.mokedTime?` as ${meta.mokedTime}`:""}`,
      `Assinatura: ${meta.signature||"--"}`,
      "",
      "------------------------------------------------",
      "  INDICADORES DE SAUDE",
      "------------------------------------------------",
      `  Saude Geral : ${h.pct}%`,
      `  Itens OK    : ${h.ok}`,
      `  Parciais    : ${h.partial}`,
      `  Inoperantes : ${h.inop}`,
      "",
      issues.length>0 ? [
        "------------------------------------------------",
        `  ITENS COM PROBLEMA (${issues.length})`,
        "------------------------------------------------",
        ...issues,
      ].join("\n") : "  Todos os itens operando normalmente.",
      "",
      "------------------------------------------------",
      "  ACESSO AO SISTEMA",
      "------------------------------------------------",
      `  App MokLog CheckTest:`,
      `  https://moklog-checktest.vercel.app`,
      "",
      meta.obs ? `Observacoes: ${meta.obs}\n` : "",
      "================================================",
      `Gerado automaticamente pelo MokLog CheckTest`,
      `Moked Consulting Security`,
      "================================================",
    ].join("\n");

    const success=await sendEmailJS(subject, enrichedMessage, `MokLog CheckTest – ${project.id}`);
    setSending(false);
    if(success) setEmailSent(true);
    else alert("Erro ao enviar. Verifique a conexao.");
  };

  return(
    <div style={S.page}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <button onClick={onBack} style={S.backBtn}>← Voltar</button>
          <h2 style={{color:"#f1f5f9",fontSize:16,fontWeight:800,margin:0}}>Relatorio — {project.id}</h2>
          <HealthRing pct={computeHealth(project,state).pct} size={44}/>
        </div>

        {/* Success banner */}
        <div style={{background:"#021a0d",border:"1px solid #22c55e",borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>✅</span>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#22c55e"}}>Relatorio finalizado!</div>
            <div style={{fontSize:11,color:"#475569"}}>Salvo · {fmtDate(meta.date)} · Assinado por {meta.signature||"—"}</div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={()=>generatePDF(project,state,meta,photos)}
            style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#7c3aed,#6d28d9)",fontSize:13}}>
            📄 Exportar PDF
          </button>
          <button onClick={()=>{navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
            style={{...S.primaryBtn,flex:1,fontSize:13}}>
            {copied?"✓ Copiado!":"📋 Copiar Texto"}
          </button>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <button onClick={handleEmail} disabled={sending||emailSent}
            style={{...S.primaryBtn,flex:1,background:emailSent?"linear-gradient(135deg,#16a34a,#15803d)":"linear-gradient(135deg,#059669,#047857)",fontSize:13,opacity:sending?0.7:1}}>
            {sending?"⟳ Enviando...":emailSent?"✓ Email Enviado!":"✉ Enviar Email"}
          </button>
          <button onClick={handleWhatsApp}
            style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#16a34a,#15803d)",fontSize:13}}>
            💬 WhatsApp
          </button>
        </div>
        <button onClick={onHome} style={{...S.secBtn,width:"100%",fontSize:13}}>🏠 Inicio</button>

        {/* Report preview */}
        <div style={{background:"#f8fafc",borderRadius:10,padding:"14px 16px",border:"1px solid #e2e8f0",maxHeight:"45vh",overflowY:"auto",marginTop:12}}>
          <pre style={{margin:0,fontFamily:"'Courier New',monospace",fontSize:10,whiteSpace:"pre-wrap",color:"#1e293b",lineHeight:1.7}}>{text}</pre>
        </div>
      </div>
    </div>
  );
}

// ─── View Screen (Manutenção) ─────────────────────────────────────────────────
function ViewScreen({projectId, token, stored}) {
  const project = PROJECTS[projectId];
  const viewLinks = JSON.parse(localStorage.getItem("moklog_viewlinks")||"{}");
  const validToken = viewLinks[projectId];

  if(!project || !validToken || (token !== validToken && token !== (projectId+"_"+validToken))) {
    return(
      <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
        <div style={{textAlign:"center",padding:32,color:"#334155"}}>
          <div style={{fontSize:40,marginBottom:12}}>🔒</div>
          <div style={{fontSize:16,fontWeight:700,color:"#f1f5f9",marginBottom:8}}>Link invalido ou expirado</div>
          <div style={{fontSize:13,color:"#64748b"}}>Solicite um novo link ao gestor.</div>
        </div>
      </div>
    );
  }

  const hist = stored[projectId]?.history??[];
  const last = hist.slice(-1)[0];
  if(!last) return(
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",padding:32,color:"#334155"}}>
        <div style={{fontSize:40,marginBottom:12}}>📭</div>
        <div style={{fontSize:16,color:"#f1f5f9"}}>Sem relatorios disponíveis ainda.</div>
      </div>
    </div>
  );

  const h = computeHealth(project, last.state);
  const issues = [];
  for(const cat of project.categories){
    const s=last.state[cat.id]; if(!s) continue;
    if(cat.type==="single"){
      const st=s.status??(s.ok===false?"inop":"ok");
      if(st!=="ok") issues.push({cat:cat.label,item:"—",status:st,since:s.since,note:s.note});
    } else if(cat.type==="items"){
      s.forEach((v,i)=>{
        const st=v.status??(v.ok===false?"inop":"ok");
        if(st!=="ok") issues.push({cat:cat.label,item:cat.itemLabels[i],status:st,since:v.since,note:v.note});
      });
    } else if(cat.type==="count"){
      (s.inoperative??[]).forEach(it=>issues.push({cat:cat.label,item:it.id||"?",status:"inop",since:it.since,note:it.note}));
    }
  }

  return(
    <div style={S.page}>
      <div style={S.formWrap}>
        <div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:12,padding:"16px",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <MoklogLogo size={40}/>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,color:"#f1f5f9"}}>MokLog CheckTest</div>
              <div style={{fontSize:12,color:"#cc2222",fontWeight:700}}>{project.id} – {project.name}</div>
              <div style={{fontSize:11,color:"#475569"}}>Pendencias para manutencao · {fmtDate(last.meta?.date)}</div>
            </div>
            <HealthRing pct={h.pct} size={52}/>
          </div>
        </div>

        <div style={{background:"#021a0d",border:"1px solid #22c55e33",borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",gap:16,justifyContent:"space-around",textAlign:"center"}}>
          <div><div style={{fontSize:22,fontWeight:900,color:"#22c55e"}}>{h.ok}</div><div style={{fontSize:10,color:"#64748b",fontWeight:700}}>OK</div></div>
          <div><div style={{fontSize:22,fontWeight:900,color:"#f59e0b"}}>{h.partial}</div><div style={{fontSize:10,color:"#64748b",fontWeight:700}}>PARCIAL</div></div>
          <div><div style={{fontSize:22,fontWeight:900,color:"#ef4444"}}>{h.inop}</div><div style={{fontSize:10,color:"#64748b",fontWeight:700}}>INOP</div></div>
          <div><div style={{fontSize:22,fontWeight:900,color:"#f1f5f9"}}>{h.pct}%</div><div style={{fontSize:10,color:"#64748b",fontWeight:700}}>SAUDE</div></div>
        </div>

        <div style={{fontSize:12,fontWeight:700,color:"#f1f5f9",marginBottom:8}}>Itens com Pendencia ({issues.length})</div>
        {issues.length===0&&<div style={{textAlign:"center",padding:"20px",color:"#22c55e",fontSize:13}}>✔ Nenhuma pendencia ativa</div>}
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {issues.map((iss,i)=>(
            <div key={i} style={{background:"#060c18",border:`1px solid ${iss.status==="partial"?"#f59e0b33":"#ef444433"}`,borderRadius:8,padding:"10px 12px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontSize:9,fontWeight:700,color:iss.status==="partial"?"#f59e0b":"#ef4444",background:iss.status==="partial"?"#fef3c7":"#fee2e2",padding:"2px 6px",borderRadius:8}}>
                  {iss.status==="partial"?"PARCIAL":"INOP"}
                </span>
                <span style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>{iss.cat}</span>
              </div>
              {iss.item&&iss.item!=="—"&&<div style={{fontSize:11,color:"#94a3b8",marginBottom:2}}>Item: {iss.item}</div>}
              {iss.since&&<div style={{fontSize:11,color:"#64748b"}}>Desde: {fmtDate(iss.since)}</div>}
              {iss.note&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{iss.note}</div>}
            </div>
          ))}
        </div>
        <div style={{marginTop:16,fontSize:10,color:"#1e293b",textAlign:"center"}}>MokLog CheckTest © Moked Security Consulting · Somente leitura</div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function ErrorBoundaryFallback() {
  return (
    <div style={{minHeight:"100vh",background:"#04080f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:"center",padding:24,maxWidth:320}}>
        <div style={{fontSize:40,marginBottom:12}}>🔄</div>
        <div style={{fontSize:16,fontWeight:700,color:"#f1f5f9",marginBottom:8}}>Atualize a pagina</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:16}}>Toque para recarregar o app</div>
        <button onClick={()=>window.location.reload()} style={{background:"#1d4ed8",color:"#fff",border:"none",borderRadius:10,padding:"12px 24px",fontSize:14,fontWeight:700,cursor:"pointer"}}>
          Recarregar
        </button>
      </div>
    </div>
  );
}

export default function App(){
  const [screen,setScreen]=useState("home");
  const [project,setProject]=useState(PROJECTS.P601);
  const [state,setState]=useState(null);
  const [meta,setMeta]=useState({date:todayStr(),start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:""});
  const [stored,setStored]=useState({});
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
  const [showMonthlyPrompt,setShowMonthlyPrompt]=useState(false);
  const [draft,setDraft]=useState(null);
  const [showDraftPrompt,setShowDraftPrompt]=useState(false);
  const [viewParams,setViewParams]=useState(null);
  const [notifGranted,setNotifGranted]=useState(false);

  // Check for view mode from URL
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

  // Request notifications on mount
  useEffect(()=>{
    requestNotificationPermission().then(granted=>{
      setNotifGranted(granted);
    });
  },[]);

  // Load data
  useEffect(()=>{
    const local=(()=>{try{const r=localStorage.getItem("seccheck_v4");return r?JSON.parse(r):{};}catch{return{};}})();
    setStored(local);
    try{const d=localStorage.getItem("moklog_draft");if(d)setDraft(JSON.parse(d));}catch{}
    loadAllFromFirebase().then(fb=>{
      if(Object.keys(fb).length>0){setStored(fb);localStorage.setItem("seccheck_v4",JSON.stringify(fb));}
      setLoaded(true);
    }).catch(()=>setLoaded(true));
  },[]);

  // Check notifications after load
  useEffect(()=>{
    if(loaded) checkPendingNotifications(stored);
  },[loaded]);

  // Real-time listener
  useEffect(()=>{
    if(!loaded) return;
    const unsubs=Object.keys(PROJECTS).map(pid=>
      onSnapshot(doc(db,"projects",pid),(snap)=>{
        if(snap.exists()){
          setStored(prev=>{
            const up={...prev,[pid]:snap.data()};
            localStorage.setItem("seccheck_v4",JSON.stringify(up));
            return up;
          });
        }
      },()=>{})
    );
    return ()=>unsubs.forEach(u=>u());
  },[loaded]);

  // Auto-save draft
  useEffect(()=>{
    if(screen==="form"&&state){
      try {
        // Save without photos to localStorage (photos can be too large)
        const d={projectId:project.id,state,meta,photoCount:photos.length,savedAt:Date.now()};
        localStorage.setItem("moklog_draft",JSON.stringify(d));
        setDraft({...d,photos});
      } catch(err) {
        // If storage full, save without state details
        try {
          const d={projectId:project.id,savedAt:Date.now()};
          localStorage.setItem("moklog_draft",JSON.stringify(d));
        } catch(e) {}
      }
    }
  },[screen,state,meta,photos]);

  const clearDraft=()=>{localStorage.removeItem("moklog_draft");setDraft(null);};
  const checkAuth=(pid)=>{const ts=projectAuth[pid];return ts&&(Date.now()-ts)<SESSION_TIMEOUT;};
  const grantAuth=(pid)=>setProjectAuth(prev=>({...prev,[pid]:Date.now()}));
  const lastForProject=stored[project.id]?.history?.slice(-1)[0]??null;
  const recurrence=analyzeRecurrence(project,stored[project.id]?.history??[]);

  const saveReport=async(st,mt)=>{
    setSyncing(true);setSyncStatus("");
    const prev=stored[project.id]?.history??[];
    const next=[...prev,{state:st,meta:mt,savedAt:new Date().toISOString()}].slice(-MAX_HISTORY);
    const up={...stored,[project.id]:{...stored[project.id],history:next,updatedAt:new Date().toISOString()}};
    setStored(up);localStorage.setItem("seccheck_v4",JSON.stringify(up));
    clearDraft();
    try{await saveToFirebase(project.id,next);setSyncStatus("saved");}
    catch(e){setSyncStatus("error");}
    finally{setSyncing(false);setTimeout(()=>setSyncStatus(""),3000);}
    // Send notification for critical items
    const h=computeHealth(project,st);
    const criticalItems=[];
    for(const cat of project.categories){
      const s=st[cat.id]; if(!s) continue;
      if(cat.type==="items"){
        s.forEach((v,i)=>{
          const wks=getConsecutiveInopWeeks(project,next,cat.id,i);
          if(wks>=INOP_ALERT_WEEKS){
            criticalItems.push(`${cat.itemLabels[i]} (${wks}sem)`);
          }
        });
      }
    }
    if(criticalItems.length>0){
      sendNotification(`${project.id} – ALERTA`,`Itens criticos: ${criticalItems.slice(0,3).join(", ")}`);
    }
    sendNotification(`${project.id} – Relatorio Finalizado`,`${project.name}: ${h.pct}% · Assinado por ${mt.signature||"—"}`);
  };

  const deleteReport=async(projectId,idx)=>{
    const prev=stored[projectId]?.history??[];
    const next=prev.filter((_,i)=>i!==idx);
    const up={...stored,[projectId]:{...stored[projectId],history:next,updatedAt:new Date().toISOString()}};
    setStored(up);localStorage.setItem("seccheck_v4",JSON.stringify(up));
    try{await deleteReportFromFirebase(projectId,next);}catch(e){}
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

  const finalize=()=>{
    if(!meta.signature||meta.signature.trim()===""){setSigError(true);window.scrollTo(0,document.body.scrollHeight);return;}
    setSigError(false);saveReport(state,meta);setScreen("report");
  };

  const updateCat=useCallback((id,val)=>setState(prev=>({...prev,[id]:val})),[]);
  const health=state?computeHealth(project,state):null;

  const SyncBadge=()=>syncing?(
    <div style={{position:"fixed",bottom:16,right:16,background:"#1d4ed8",color:"#fff",borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,zIndex:999}}>⟳ Sincronizando...</div>
  ):syncStatus==="saved"?(
    <div style={{position:"fixed",bottom:16,right:16,background:"#15803d",color:"#fff",borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,zIndex:999}}>✓ Salvo</div>
  ):syncStatus==="error"?(
    <div style={{position:"fixed",bottom:16,right:16,background:"#b91c1c",color:"#fff",borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,zIndex:999}}>✗ Erro — local OK</div>
  ):null;

  // ── View mode (manutenção)
  if(viewParams) return <ViewScreen projectId={viewParams.projectId} token={viewParams.token} stored={stored}/>;

  // ── Draft prompt
  // Monthly consolidado prompt
  if(showMonthlyPrompt) return(
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#060c18",border:"1px solid #7c3aed",borderRadius:16,padding:"28px 24px",maxWidth:340,width:"100%",textAlign:"center",margin:16}}>
        <div style={{fontSize:28,marginBottom:10}}>📊</div>
        <div style={{fontSize:15,fontWeight:700,color:"#f1f5f9",marginBottom:6}}>Último teste do mês!</div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>
          Este é o último domingo do mês.<br/>
          Deseja gerar o consolidado mensal após finalizar?
        </div>
        <div style={{display:"flex",gap:8,flexDirection:"column"}}>
          <button onClick={()=>{
            setShowMonthlyPrompt(false);
            if(!meta.signature||meta.signature.trim()===""){setSigError(true);return;}
            saveReport(state,meta);
            setScreen("report");
            // Auto-select all this month's reports for consolidado
            setTimeout(()=>{
              const hist=stored[project.id]?.history??[];
              const now=new Date();
              const monthReports=hist.map((r,i)=>({r,i})).filter(({r})=>{
                if(!r.meta?.date) return false;
                const d=new Date(r.meta.date+"T12:00:00");
                return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
              });
              if(monthReports.length>=2){
                generateConsolidatedPDF(project, monthReports.map(({r})=>r));
              }
            },1500);
          }} style={{...S.primaryBtn,width:"100%",background:"linear-gradient(135deg,#7c3aed,#6d28d9)",fontSize:14}}>
            ✓ Finalizar + Gerar Consolidado
          </button>
          <button onClick={()=>{
            setShowMonthlyPrompt(false);
            if(!meta.signature||meta.signature.trim()===""){setSigError(true);return;}
            saveReport(state,meta);setScreen("report");
          }} style={{...S.secBtn,width:"100%",fontSize:14}}>Só finalizar</button>
          <button onClick={()=>setShowMonthlyPrompt(false)} style={{...S.secBtn,width:"100%",fontSize:13,color:"#334155"}}>Cancelar</button>
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

  // ── PIN gate
  if(screen==="pendencies") return <PendenciesScreen stored={stored} onBack={()=>setScreen("home")}/>;
  if(screen==="pin_gate") return <ProjectPinGate project={project} onSuccess={()=>{grantAuth(project.id);setScreen("home");}} onBack={()=>setScreen("home")}/>;
  if(screen==="dashboard") return <Dashboard stored={stored} onBack={()=>setScreen("home")} onDeleteReport={deleteReport}/>;
  if(screen==="history") return <HistoryScreen project={project} stored={stored} onBack={()=>setScreen("home")}/>;
  if(screen==="report") return <ReportScreen project={project} state={state} meta={meta} photos={photos} onBack={()=>setScreen("form")} onHome={()=>setScreen("home")}/>;

  // ── FORM
  if(screen==="form") return(
    <div style={S.page}>
      <SyncBadge/>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #060c18",marginBottom:2}}>
          <button onClick={()=>setScreen("home")} style={S.backBtn}>← Inicio</button>
          <MoklogLogo size={32}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:900,color:"#f8fafc"}}>MokLog <span style={{color:"#cc2222"}}>CheckTest</span></div>
            <div style={{fontSize:11,color:"#334155",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{project.id} – {project.name}</div>
          </div>
          {health&&<HealthRing pct={health.pct} size={46}/>}
        </div>
        {health&&<div style={{height:3,background:"#060c18",borderRadius:2,overflow:"hidden",marginBottom:8}}>
          <div style={{height:"100%",width:`${health.pct}%`,background:health.pct>=90?"#22c55e":health.pct>=70?"#f59e0b":"#ef4444",borderRadius:2,transition:"width .4s"}}/>
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
                <span style={{color:"#1e293b",fontSize:10,flexShrink:0,marginLeft:4}}>{isOpen?"▲":"▼"}</span>
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
            <input placeholder="Digite seu nome completo para assinar..." value={meta.signature||""}
              onChange={e=>{setMeta(m=>({...m,signature:e.target.value}));setSigError(false);}}
              style={{...S.inp,fontSize:13,fontWeight:600}}/>
            <div style={{fontSize:10,color:"#334155",marginTop:5}}>Obrigatorio para finalizar o relatorio.</div>
          </div>
        )}
        {state&&(
          <div style={{marginTop:14,display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={finalize} style={{...S.primaryBtn,flex:2,fontSize:14}}>✓ Finalizar e Gerar Relatorio</button>
            <button onClick={()=>setScreen("home")} style={{...S.secBtn,flex:1,fontSize:14}}>Cancelar</button>
          </div>
        )}
        <div style={{fontSize:10,color:"#1e293b",textAlign:"center",marginTop:4}}>💾 Rascunho salvo automaticamente</div>
      </div>
    </div>
  );

  // ── HOME
  return(
    <div style={S.page}>
      <SyncBadge/>
      <div style={S.homeWrap}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
          <MoklogLogo size={52}/>
          <div>
            <div style={{fontSize:22,fontWeight:900,color:"#f8fafc",letterSpacing:-0.5}}>MokLog</div>
            <div style={{fontSize:14,fontWeight:700,color:"#cc2222",letterSpacing:1}}>CheckTest</div>
            <div style={{fontSize:10,color:"#334155",marginTop:1}}>Sistema de Teste Semanal de Seguranca</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            <button onClick={()=>setScreen("pendencies")} style={{background:"#1a0202",border:"1px solid #ef444444",borderRadius:8,padding:"8px 10px",cursor:"pointer",fontSize:11,color:"#ef4444",fontWeight:700}}>🔴 Inop</button>
            <button onClick={()=>setScreen("dashboard")} style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:12,color:"#64748b"}}>📊 Painel</button>
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

        {/* ── VISUAL DASHBOARD ── */}
        <div style={{width:"100%"}}>
          <div style={{fontSize:10,color:"#334155",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>
            Saúde dos Projetos
          </div>

          {/* Projects with problems FIRST */}
          {(()=>{
            const allP = Object.values(PROJECTS).map(p=>{
              const hist=stored[p.id]?.history??[];
              const last=hist.slice(-1)[0];
              const h=last?computeHealth(p,last.state):null;
              return {p,h,last,hist};
            });
            const withProblems = allP.filter(({h})=>h&&h.pct<90);
            const allOk = allP.filter(({h})=>!h||h.pct>=90);

            return <>
              {/* PROBLEM PROJECTS — big cards */}
              {withProblems.length>0&&(
                <>
                  <div style={{fontSize:9,color:"#ef4444",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6,display:"flex",alignItems:"center",gap:4}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:"#ef4444",display:"inline-block"}}/>
                    Requer Atenção ({withProblems.length})
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
                    {withProblems.map(({p,h,last,hist})=>{
                      const isActive=p.id===project.id;
                      const color=h.pct>=70?"#f59e0b":"#ef4444";
                      return(
                        <button key={p.id} onClick={()=>setProject(p)}
                          style={{background:isActive?"#0a0f1e":"#060c18",border:`2px solid ${isActive?color:color+"55"}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",textAlign:"left",width:"100%"}}>
                          <div style={{display:"flex",alignItems:"center",gap:12}}>
                            <HealthRing pct={h.pct} size={52}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9"}}>{p.id} — {p.name}</div>
                                {(()=>{const sc=getProjectScore(p,hist);return sc?<span style={{fontSize:10,fontWeight:900,color:sc.color,background:sc.color+"22",padding:"1px 6px",borderRadius:6}}>{sc.grade}</span>:null;})()}
                              </div>
                              <div style={{fontSize:11,color:"#475569",marginTop:2}}>
                                {h.inop>0&&<span style={{color:"#ef4444",fontWeight:700}}>{h.inop} inop · </span>}
                                {h.partial>0&&<span style={{color:"#f59e0b",fontWeight:700}}>{h.partial} parcial · </span>}
                                Último: {fmtDate(last?.meta?.date)}
                              </div>
                              {/* Mini sparkline */}
                              {hist.length>1&&<div style={{display:"flex",gap:2,marginTop:5}}>
                                {hist.slice(-6).map((r,i)=>{
                                  const rh=computeHealth(p,r.state);
                                  const rc=rh.pct>=90?"#22c55e":rh.pct>=70?"#f59e0b":"#ef4444";
                                  return <div key={i} style={{flex:1,height:18,background:`${rc}22`,border:`1px solid ${rc}44`,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:rc,fontWeight:700}}>{rh.pct}%</div>;
                                })}
                              </div>}
                            </div>
                            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                              {isActive&&<span style={{fontSize:9,color:color,fontWeight:700,background:color+"22",padding:"2px 6px",borderRadius:6}}>SELECIONADO</span>}
                              <span style={{color:"#334155",fontSize:14}}>›</span>
                            </div>
                          </div>
                          {/* Health bar */}
                          <div style={{marginTop:8,height:4,background:"#0f172a",borderRadius:2,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${h.pct}%`,background:color,borderRadius:2,transition:"width .5s"}}/>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* OK PROJECTS — compact list */}
              {allOk.length>0&&(
                <>
                  <div style={{fontSize:9,color:"#22c55e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6,display:"flex",alignItems:"center",gap:4}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",display:"inline-block"}}/>
                    Operando Normalmente ({allOk.length})
                  </div>
                  <div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:10,overflow:"hidden"}}>
                    {allOk.map(({p,h,last},idx)=>{
                      const isActive=p.id===project.id;
                      const color=h?"#22c55e":"#334155";
                      return(
                        <button key={p.id} onClick={()=>setProject(p)}
                          style={{width:"100%",background:isActive?"#060f20":"transparent",border:"none",borderBottom:idx<allOk.length-1?"1px solid #0a0f1e":"none",padding:"10px 14px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
                          <div style={{flex:1}}>
                            <span style={{fontSize:12,fontWeight:700,color:isActive?"#f1f5f9":"#cbd5e1"}}>{p.id}</span>
                            <span style={{fontSize:12,color:isActive?"#94a3b8":"#475569",marginLeft:6}}>{p.name}</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                            {h&&<span style={{fontSize:12,fontWeight:800,color:"#22c55e"}}>{h.pct}%</span>}
                            {!h&&<span style={{fontSize:10,color:"#334155"}}>Sem dados</span>}
                            {last&&<span style={{fontSize:10,color:"#334155"}}>{fmtDate(last?.meta?.date)}</span>}
                            <span style={{color:"#1e293b",fontSize:12}}>›</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Overall health summary */}
              {allP.some(({h})=>h)&&(()=>{
                const valid=allP.filter(({h})=>h);
                const avg=Math.round(valid.reduce((a,{h})=>a+h.pct,0)/valid.length);
                const totalInop=valid.reduce((a,{h})=>a+h.inop,0);
                return(
                  <div style={{marginTop:8,background:"#060c18",border:"1px solid #0f172a",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{fontSize:11,color:"#334155",fontWeight:700}}>Saúde Geral da Operação</div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      {totalInop>0&&<span style={{fontSize:11,color:"#ef4444",fontWeight:700}}>🔴 {totalInop} inop total</span>}
                      <span style={{fontSize:16,fontWeight:900,color:avg>=90?"#22c55e":avg>=70?"#f59e0b":"#ef4444"}}>{avg}%</span>
                    </div>
                  </div>
                );
              })()}
            </>;
          })()}
        </div>

        <div style={{width:"100%",display:"flex",flexDirection:"column",gap:8,marginTop:4}}>
          {checkAuth(project.id)?(
            <>
              <button onClick={startNew} style={{...S.primaryBtn,fontSize:14}}>+ Novo Relatorio — {project.id}</button>
              <button onClick={()=>setScreen("history")} style={{...S.secBtn,fontSize:14}}>📅 Historico</button>
            </>
          ):(
            <button onClick={()=>setScreen("pin_gate")} style={{...S.primaryBtn,fontSize:14}}>🔐 Acessar — {project.id}</button>
          )}
        </div>
        <div style={{fontSize:10,color:"#1e293b",textAlign:"center",lineHeight:1.8}}>MokLog CheckTest © Moked Consulting Security</div>
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
  backBtn:{background:"transparent",border:"1px solid #0f172a",color:"#334155",borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"},
  projCard:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#060c18",border:"1px solid #0a0f1e",borderRadius:10,padding:"10px 13px",cursor:"pointer",width:"100%",textAlign:"left"},
  projCardActive:{background:"#060f20",border:"1px solid"},
  metaCard:{background:"#060c18",borderRadius:11,padding:"12px 14px",border:"1px solid #0f172a"},
  lbl:{display:"block",fontSize:10,color:"#334155",fontWeight:700,marginBottom:3,textTransform:"uppercase",letterSpacing:.5},
  inp:{width:"100%",background:"#020510",border:"1px solid #0f172a",borderRadius:7,color:"#e2e8f0",padding:"8px 10px",fontSize:12,boxSizing:"border-box",outline:"none"},
  accordion:{width:"100%",background:"transparent",border:"none",display:"flex",alignItems:"center",gap:8,padding:"12px 4px",cursor:"pointer"},
  catCard:{background:"#060c18",borderRadius:9,padding:"11px 13px",margin:"0 0 4px"},
  catHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:5},
  catLabel:{fontSize:12,fontWeight:700,color:"#94a3b8"},
  itemRow:{display:"flex",alignItems:"center",gap:6},
  iLabel:{fontSize:11,color:"#334155",minWidth:80,flexShrink:0},
  tog:{background:"#020510",border:"1px solid #0f172a",color:"#334155",borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer",fontWeight:600},
  togOk:{background:"#021a0d",border:"1px solid #22c55e",color:"#22c55e"},
  togPartial:{background:"#1a130a",border:"1px solid #f59e0b",color:"#f59e0b"},
  togBad:{background:"#1a0202",border:"1px solid #ef4444",color:"#ef4444"},
  sm:{background:"#020510",border:"1px solid #0f172a",color:"#334155",borderRadius:5,padding:"4px 8px",fontSize:11,cursor:"pointer",fontWeight:600},
  smOk:{background:"#021a0d",border:"1px solid #22c55e",color:"#22c55e"},
  smPartial:{background:"#1a130a",border:"1px solid #f59e0b",color:"#f59e0b"},
  smBad:{background:"#1a0202",border:"1px solid #ef4444",color:"#ef4444"},
  iconBtn:{background:"#020510",border:"1px solid #0f172a",color:"#475569",borderRadius:5,width:24,height:24,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,flexShrink:0},
  addBtn:{background:"transparent",border:"1px dashed #0f172a",color:"#334155",borderRadius:7,padding:"6px 12px",fontSize:11,cursor:"pointer",marginTop:4},
  subRow:{display:"flex",flexDirection:"column",gap:6,marginTop:8,paddingTop:8,borderTop:"1px solid #0f172a"},
};
