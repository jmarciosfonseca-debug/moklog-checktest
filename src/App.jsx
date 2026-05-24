import { useState, useEffect, useCallback } from "react";
import AcessoApp from "./Acesso";
import EquipeApp from "./Equipe";
import { generatePDF, generateConsolidatedPDF } from "./generatePDF";
import { initializeApp, getApps } from "firebase/app";
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

// ─── Firebase Config Integrada ────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
  messagingSenderId: "390165325023",
  appId: "1:390165325023:web:3147cd333503916b0d756a"
};
const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(firebaseApp);

async function saveToFirebase(projectId, history) {
  try { await setDoc(doc(db,"projects",projectId),{history,updatedAt:new Date().toISOString()}); }
  catch(e){ console.error("Firebase save:",e); }
}
async function loadAllFromFirebase() {
  try { const snap=await getDocs(collection(db,"projects")); const data={}; snap.forEach(d=>{data[d.id]=d.data();}); return data; }
  catch(e){ return {}; }
}

// ─── Configurações de Segurança e Constantes ──────────────────────────────────
const PROJECT_PINS = {
  P601:"16601", P602:"16602", P604:"16604", P605:"16605",
  P606:"16606", P607:"16607", P311A:"16311", P311B:"16311", P505:"16505",
  P260A:"162601", P260B:"162602", P260C:"162603"
};
const ADMIN_PIN = "872101";
const MAX_HISTORY = 26;
const SESSION_TIMEOUT = 10 * 60 * 1000;
const INOP_ALERT_WEEKS = 2;
const RECURRENCE_WARN = 2;
const RECURRENCE_CRIT = 3;

// ─── Push Notifications Nativas ────────────────────────────────
async function requestNotificationPermission() {
  if(!("Notification" in window)) return false;
  if(Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function sendNotification(title, body) {
  if(Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon: "/favicon.ico" }); } catch(e){}
}

function checkPendingNotifications(stored) {
  try {
    if(!("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    if(now.getDay() !== 0) return; 
    const lastCheck = localStorage.getItem("moklog_notif_lastcheck");
    if(lastCheck === now.toDateString()) return;
    localStorage.setItem("moklog_notif_lastcheck", now.toDateString());
    const hour = now.getHours();

    Object.values(PROJECTS).forEach(p => {
      const hist = stored[p.id]?.history ?? [];
      const filledToday = hist.slice(-1)[0]?.meta?.date === now.toISOString().split("T")[0];
      if(hour >= 8 && hour < 14) {
        sendNotification("MokLog CheckTest", `${p.id} – ${p.name}: Lembrete do teste semanal regulamentar de hoje!`);
      }
      if(hour >= 14 && !filledToday) {
        sendNotification("MokLog CheckTest ⚠️", `${p.id}: Teste semanal pendente no sistema. Realize a auditoria.`);
      }
    });
  } catch(e){ console.log("Erro ao checar notificações:", e); }
}

// ─── Base de Estrutura dos Projetos Cadastrados ───────────────────────────────
const PROJECTS = {
  P601: { id:"P601", grupo:"Golgi", name:"Golgi Cajamar", categories:[
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
    {id:"telefone",label:"21 - Telefone CCO",type={{id:"fire",label:"01 - Alarme de Incêndio",type:"items",itemLabels:["CCO","Portaria"]},:"items",itemLabels:["CCO"]},
    {id:"reverso",label:"22 - Reverso Inclusa",type:"items",itemLabels:["Entrada 01","Entrada 02","Entrada 03","Entrada 04","Entrada 05","Saída 01","Saída 02","Saída 03","Saída 04","Saída 05"]},
    {id:"interfone",label:"23 - Interfones",type:"items",itemLabels:["CCO","Apoio Motorista"]},
    {id:"joystick",label:"24 - Joystick",type:"items",itemLabels:["CCO"]},
    {id:"manutencao",label:"25 - Visita de Manutenção",type:"maintenance"},
    {id:"infra",label:"26 - Infraestrutura / Obs.",type:"notes"}
  ]},
  P602: { id:"P602", grupo:"Golgi", name:"Golgi Mauá", categories:[
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
    {id:"infra",label:"13 - Infraestrutura / Obs.",type:"notes"}
  ]},
  P604: { id:"P604", grupo:"Golgi", name:"Golgi Jundiaí", categories:[
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
    {id:"totens_baia",label:"1
