import { useState, useEffect, useCallback, useRef } from "react";
import { generatePDF } from "./generatePDF";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, onSnapshot, deleteDoc } from "firebase/firestore";

// ─── Firebase Configuration ───────────────────────────────────────────────────
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

// ─── Firebase Storage Functions ───────────────────────────────────────────────
async function saveToFirebase(projectId, history) {
  try {
    await setDoc(doc(db, "projects", projectId), { history, updatedAt: new Date().toISOString() });
  } catch(e) { console.error("Firebase save error:", e); }
}

async function loadAllFromFirebase() {
  try {
    const snap = await getDocs(collection(db, "projects"));
    const data = {};
    snap.forEach(d => { data[d.id] = d.data(); });
    return data;
  } catch(e) { console.error("Firebase loadAll error:", e); return {}; }
}

async function deleteReportFromFirebase(projectId, newHistory) {
  try {
    await setDoc(doc(db, "projects", projectId), { history: newHistory, updatedAt: new Date().toISOString() });
  } catch(e) { console.error("Firebase delete error:", e); }
}

// ─── PIN Configuration ────────────────────────────────────────────────────────
const PROJECT_PINS = {
  P601: "16601", P602: "16602", P604: "16604", P605: "16605",
  P606: "16606", P607: "16607", P311A: "16311", P311B: "16311", P505: "16505"
};
const ADMIN_PIN = "872101";
const MAX_HISTORY = 26;
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// ─── Projects ─────────────────────────────────────────────────────────────────
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
const todayStr = () => new Date().toISOString().split("T")[0];
const fmtDate = (d) => { if(!d)return"—"; const[y,m,day]=d.split("-"); return`${day}/${m}/${y}`; };
const calcPct = (ok,total) => total===0?100:Math.round((ok/total)*100);

// Status: "ok" | "partial" | "inop"
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

function computeHealth(project, state) {
  let total=0, ok=0, partial=0, inopList=[];
  for(const cat of project.categories){
    const s=state[cat.id]; if(!s)continue;
    if(cat.type==="single"){
      total++;
      if(s.status==="ok"||s.ok===true) ok++;
      else if(s.status==="partial") { ok+=0.5; partial++; }
      else inopList.push(cat.label);
    } else if(cat.type==="items"){
      total+=s.length;
      const okN=s.filter(i=>i.status==="ok"||(i.status===undefined&&i.ok===true)).length;
      const partN=s.filter(i=>i.status==="partial").length;
      ok+=okN+(partN*0.5);
      if(okN+partN<s.length)inopList.push(cat.label);
    } else if(cat.type==="count"){
      const t=s.total??cat.total; total+=t;
      const inopN=s.inoperative?.length??0; ok+=t-inopN;
      if(inopN>0)inopList.push(cat.label);
    }
  }
  return { total, ok:Math.round(ok), pct:calcPct(Math.round(ok),total), inopList };
}

function generateReportText(project, state, meta, photos) {
  const L=[];
  L.push("═".repeat(50));
  L.push(`  MOKLOG CHECKTEST – RELATÓRIO DE TESTE SEMANAL`);
  L.push("═".repeat(50));
  L.push(`Projeto : ${project.id} – ${project.name}`);
  L.push(`Data    : ${fmtDate(meta.date)}`);
  L.push(`Início  : ${meta.start||"—"}  |  Término: ${meta.end||"—"}`);
  L.push(`Líder   : ${meta.leader||"—"}`);
  L.push(`CCO     : ${meta.cco||"—"}`);
  L.push(`Moked 24h: ${meta.moked||"—"}  |  Contato: ${meta.mokedContact?"✓ Realizado":"✗ Não realizado"}  ${meta.mokedTime?`às ${meta.mokedTime}`:""}`);
  if(meta.signature) L.push(`Assinatura: ${meta.signature}`);
  L.push("─".repeat(50));
  for(const cat of project.categories){
    const s=state[cat.id]; if(!s)continue;
    if(cat.type==="maintenance"){
      const visits=s.visits??[];
      L.push(`\n${cat.label}`);
      if(!visits.length) L.push("  Sem visitas registradas na semana.");
      visits.forEach((v,i)=>{ L.push(`  Visita ${i+1}: ${fmtDate(v.date)} | Empresa: ${v.empresa||"—"} | Técnico 01: ${v.tec1||"—"} | Técnico 02: ${v.tec2||"—"} | Serviço: ${v.servico||"—"}${v.obs?` | Obs: ${v.obs}`:""}`); });
      continue;
    }
    if(cat.type==="notes"){
      const items=s.items??[];
      L.push(`\n${cat.label}`);
      if(!items.length) L.push("  Sem pendências.");
      items.forEach(it=>L.push(`  ▸ ${it.label}${it.since?` (desde ${fmtDate(it.since)})`:""} ${it.note?`– ${it.note}`:""}`));
      continue;
    }
    L.push(`\n${cat.label}`);
    const statusLabel = (st, ok) => {
      const s2 = st ?? (ok===true?"ok":ok===false?"inop":"ok");
      return s2==="ok"?"OK":s2==="partial"?"PARCIAL":"INOPERANTE";
    };
    if(cat.type==="single") L.push(`  ${statusLabel(s.status,s.ok)}${s.status!=="ok"&&s.since?` desde ${fmtDate(s.since)}`:""} ${s.note?`– ${s.note}`:""}`);
    else if(cat.type==="items") s.forEach((v,i)=>L.push(`  ${cat.itemLabels[i]}: ${statusLabel(v.status,v.ok)}${v.status!=="ok"&&v.since?` desde ${fmtDate(v.since)}`:""} ${v.note?`– ${v.note}`:""}`));
    else if(cat.type==="count"){
      const t=s.total??cat.total; const inop=s.inoperative??[];
      L.push(`  Total: ${t} | OK: ${t-inop.length} | Inoperantes: ${inop.length}`);
      inop.forEach(it=>L.push(`    ▸ ${it.id||"?"}${it.since?` (desde ${fmtDate(it.since)})`:""} ${it.note?`– ${it.note}`:""}`));
    }
  }
  const h=computeHealth(project,state);
  L.push(`\n${"═".repeat(50)}`);
  L.push(`SAÚDE GERAL: ${h.pct}%  (${h.ok}/${h.total} unidades OK)`);
  if(meta.obs) L.push(`Observações gerais: ${meta.obs}`);
  if(photos?.length) L.push(`Fotos anexadas: ${photos.length} foto(s)`);
  L.push("═".repeat(50));
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
      <circle cx="50" cy="50" r="7" fill="#111"/>
      <circle cx="50" cy="50" r="5" fill="#222"/>
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
  const r=22, circ=2*Math.PI*r;
  const dash=circ*(pct/100);
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

// ─── Status Button Component ──────────────────────────────────────────────────
function StatusBtns({value, onChange, size="normal"}) {
  const st = value?.status ?? (value?.ok===false?"inop":"ok");
  const p = size==="sm" ? {padding:"4px 8px",fontSize:11} : {padding:"6px 12px",fontSize:12};
  return (
    <div style={{display:"flex",gap:4,flexShrink:0}}>
      <button onClick={()=>onChange({...value,status:"ok",note:"",since:""})}
        style={{...S.tog,...p,...(st==="ok"?S.togOk:{})}}>✓ OK</button>
      <button onClick={()=>onChange({...value,status:"partial"})}
        style={{...S.tog,...p,...(st==="partial"?S.togPartial:{})}}>~ Parc.</button>
      <button onClick={()=>onChange({...value,status:"inop"})}
        style={{...S.tog,...p,...(st==="inop"?S.togBad:{})}}>✗ Inop.</button>
    </div>
  );
}

// ─── Category Components ──────────────────────────────────────────────────────
function SingleCat({cat,value,onChange}){
  const st = value?.status ?? (value?.ok===false?"inop":"ok");
  return(
    <div style={S.catCard}>
      <div style={S.catHeader}>
        <span style={S.catLabel}>{cat.label}</span>
        <StatusBtns value={value} onChange={onChange}/>
      </div>
      {st!=="ok"&&<div style={S.subRow}>
        <input placeholder="Descrição do problema..." value={value.note||""} onChange={e=>onChange({...value,note:e.target.value})} style={S.inp}/>
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
          <span style={S.lbl}>Desde:</span>
          <input type="date" value={value.since||""} onChange={e=>onChange({...value,since:e.target.value})} style={{...S.inp,maxWidth:160}}/>
        </div>
      </div>}
    </div>
  );
}

function ItemsCat({cat,values,onChange,photos,setPhotos}){
  const upd=(i,patch)=>{const n=[...values];n[i]={...n[i],...patch};onChange(n);};
  const okN=values.filter(v=>(v.status??"ok")==="ok").length;
  const partN=values.filter(v=>v.status==="partial").length;
  const p=calcPct(okN+(partN*0.5|0),values.length);
  const dotColor=p===100?"#22c55e":p>=50?"#f59e0b":"#ef4444";

  // Photos per item
  const catPhotos = (photos||[]).filter(ph=>ph.catId===cat.id);
  const handlePhoto=(e)=>{
    const file=e.target.files?.[0]; if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{
      // Remove existing photo for this cat, add new one
      const filtered=(photos||[]).filter(ph=>ph.catId!==cat.id);
      setPhotos&&setPhotos([...filtered,{catId:cat.id,catLabel:cat.label,name:file.name,url:ev.target.result}]);
    };
    r.readAsDataURL(file);
  };
  const removePhoto=()=>setPhotos&&setPhotos((photos||[]).filter(ph=>ph.catId!==cat.id));

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
          return(
            <div key={i} style={{...S.itemRow,flexWrap:"wrap"}}>
              <span style={{...S.iLabel,fontSize:12}}>{cat.itemLabels[i]}</span>
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
          );
        })}
      </div>
      {/* Photo per topic */}
      {setPhotos&&<div style={{marginTop:10,borderTop:"1px solid #0f172a",paddingTop:8}}>
        {catPhotos.length>0?(
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <img src={catPhotos[0].url} alt="" style={{width:60,height:45,objectFit:"cover",borderRadius:5,border:"1px solid #1e293b"}}/>
            <div style={{flex:1,fontSize:11,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{catPhotos[0].name}</div>
            <button onClick={removePhoto} style={{...S.iconBtn,color:"#ef4444"}}>✕</button>
          </div>
        ):(
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",color:"#334155",fontSize:11}}>
            <span style={{fontSize:16}}>📷</span>
            <span>Adicionar foto deste tópico</span>
            <input type="file" accept="image/*" style={{position:"absolute",opacity:0,width:0,height:0}} onChange={handlePhoto}/>
          </label>
        )}
      </div>}
    </div>
  );
}

function CountCat({cat,value,onChange,photos,setPhotos}){
  const total=value.total??cat.total;
  const inop=value.inoperative??[];
  const p=calcPct(total-inop.length,total);
  const add=()=>onChange({...value,inoperative:[...inop,{id:"",note:"",since:todayStr()}]});
  const rem=(i)=>onChange({...value,inoperative:inop.filter((_,idx)=>idx!==i)});
  const upd=(i,patch)=>onChange({...value,inoperative:inop.map((it,idx)=>idx===i?{...it,...patch}:it)});

  const catPhotos=(photos||[]).filter(ph=>ph.catId===cat.id);
  const handlePhoto=(e)=>{
    const file=e.target.files?.[0]; if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{
      const filtered=(photos||[]).filter(ph=>ph.catId!==cat.id);
      setPhotos&&setPhotos([...filtered,{catId:cat.id,catLabel:cat.label,name:file.name,url:ev.target.result}]);
    };
    r.readAsDataURL(file);
  };
  const removePhoto=()=>setPhotos&&setPhotos((photos||[]).filter(ph=>ph.catId!==cat.id));

  return(
    <div style={S.catCard}>
      <div style={S.catHeader}>
        <span style={S.catLabel}>{cat.label}</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:800,color:p===100?"#22c55e":"#ef4444"}}>{p}%</span>
          <span style={{fontSize:11,color:"#475569"}}>{total-inop.length}/{total} OK</span>
          <button onClick={()=>onChange({...value,total:total+1})} style={S.iconBtn}>+</button>
          {total>1&&<button onClick={()=>onChange({...value,total:total-1})} style={S.iconBtn}>−</button>}
        </div>
      </div>
      <div style={{marginTop:8}}>
        {inop.map((it,i)=>(
          <div key={i} style={{...S.itemRow,flexWrap:"wrap",gap:6,marginBottom:5}}>
            <input placeholder="ID (ex: CF-32)" value={it.id} onChange={e=>upd(i,{id:e.target.value})} style={{...S.inp,width:105,fontSize:12}}/>
            <input placeholder="Problema..." value={it.note} onChange={e=>upd(i,{note:e.target.value})} style={{...S.inp,flex:1,minWidth:100,fontSize:12}}/>
            <input type="date" value={it.since} onChange={e=>upd(i,{since:e.target.value})} style={{...S.inp,maxWidth:145,fontSize:12}}/>
            <button onClick={()=>rem(i)} style={{...S.iconBtn,color:"#ef4444"}}>✕</button>
          </div>
        ))}
        <button onClick={add} style={S.addBtn}>+ Registrar inoperante</button>
      </div>
      {setPhotos&&<div style={{marginTop:10,borderTop:"1px solid #0f172a",paddingTop:8}}>
        {catPhotos.length>0?(
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <img src={catPhotos[0].url} alt="" style={{width:60,height:45,objectFit:"cover",borderRadius:5,border:"1px solid #1e293b"}}/>
            <div style={{flex:1,fontSize:11,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{catPhotos[0].name}</div>
            <button onClick={removePhoto} style={{...S.iconBtn,color:"#ef4444"}}>✕</button>
          </div>
        ):(
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",color:"#334155",fontSize:11}}>
            <span style={{fontSize:16}}>📷</span>
            <span>Adicionar foto deste tópico</span>
            <input type="file" accept="image/*" style={{position:"absolute",opacity:0,width:0,height:0}} onChange={handlePhoto}/>
          </label>
        )}
      </div>}
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
        <span style={{fontSize:11,color:items.length?"#ef4444":"#22c55e",fontWeight:700}}>{items.length?`${items.length} pendência(s)`:"Sem pendências"}</span>
      </div>
      <div style={{marginTop:8}}>
        {items.map((it,i)=>(
          <div key={i} style={{...S.itemRow,flexWrap:"wrap",gap:6,marginBottom:5}}>
            <input placeholder="Item..." value={it.label} onChange={e=>upd(i,{label:e.target.value})} style={{...S.inp,width:140,fontSize:12}}/>
            <input placeholder="Observação..." value={it.note} onChange={e=>upd(i,{note:e.target.value})} style={{...S.inp,flex:1,minWidth:100,fontSize:12}}/>
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
              <div><label style={S.lbl}>Data da Visita</label><input type="date" value={v.date} onChange={e=>upd(i,{date:e.target.value})} style={S.inp}/></div>
              <div><label style={S.lbl}>Empresa / Prestador</label><input placeholder="Ex: Steel..." value={v.empresa} onChange={e=>upd(i,{empresa:e.target.value})} style={S.inp}/></div>
              <div><label style={S.lbl}>Técnico 01</label><input placeholder="Nome..." value={v.tec1} onChange={e=>upd(i,{tec1:e.target.value})} style={S.inp}/></div>
              <div><label style={S.lbl}>Técnico 02</label><input placeholder="Nome (opcional)" value={v.tec2} onChange={e=>upd(i,{tec2:e.target.value})} style={S.inp}/></div>
            </div>
            <div style={{marginTop:7}}><label style={S.lbl}>Serviço Realizado</label><input placeholder="Descreva o serviço..." value={v.servico} onChange={e=>upd(i,{servico:e.target.value})} style={S.inp}/></div>
            <div style={{marginTop:7}}><label style={S.lbl}>Observações</label><input placeholder="Observações adicionais..." value={v.obs} onChange={e=>upd(i,{obs:e.target.value})} style={S.inp}/></div>
          </div>
        ))}
        <button onClick={add} style={{...S.addBtn,borderStyle:"solid",borderColor:"#f59e0b",color:"#f59e0b"}}>+ Registrar Visita de Manutenção</button>
      </div>
    </div>
  );
}

// ─── PIN Gate per project ─────────────────────────────────────────────────────
function ProjectPinGate({project, onSuccess, onBack}) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const correct = PROJECT_PINS[project.id];
  return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#060c18",border:"1px solid #1e293b",borderRadius:16,padding:"32px 28px",maxWidth:320,width:"100%",textAlign:"center"}}>
        <MoklogLogo size={48}/>
        <div style={{fontSize:16,fontWeight:800,color:"#f1f5f9",marginTop:10,marginBottom:2}}>MokLog <span style={{color:"#cc2222"}}>CheckTest</span></div>
        <div style={{fontSize:13,color:"#94a3b8",marginBottom:4}}>{project.id} – {project.name}</div>
        <div style={{fontSize:12,color:"#475569",marginBottom:20}}>Insira o PIN do projeto</div>
        <input type="password" placeholder="PIN" maxLength={8} value={pin}
          onChange={e=>{setPin(e.target.value);setErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter"){if(pin===correct)onSuccess();else setErr(true);}}}
          style={{...S.inp,textAlign:"center",fontSize:22,letterSpacing:10,marginBottom:10}}/>
        {err&&<div style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
        <button onClick={()=>{if(pin===correct)onSuccess();else setErr(true);}} style={{...S.primaryBtn,width:"100%",marginBottom:10}}>Entrar</button>
        <button onClick={onBack} style={{...S.secBtn,width:"100%"}}>← Voltar</button>
      </div>
    </div>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────
function Dashboard({stored, onBack, onSelectProject, onDeleteReport}) {
  const [pin, setPin] = useState("");
  const [auth, setAuth] = useState(false);
  const [err, setErr] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // {projectId, idx}

  if(!auth) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#060c18",border:"1px solid #1e293b",borderRadius:16,padding:"32px 28px",maxWidth:320,width:"100%",textAlign:"center"}}>
        <MoklogLogo size={48}/>
        <div style={{fontSize:16,fontWeight:800,color:"#f1f5f9",marginTop:10,marginBottom:2}}>MokLog <span style={{color:"#cc2222"}}>CheckTest</span></div>
        <div style={{fontSize:12,color:"#cc2222",fontWeight:700,marginBottom:4}}>Painel Gerencial</div>
        <div style={{fontSize:12,color:"#475569",marginBottom:20}}>Acesso restrito — insira o PIN</div>
        <input type="password" placeholder="PIN" maxLength={8} value={pin}
          onChange={e=>{setPin(e.target.value);setErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter"){if(pin===ADMIN_PIN)setAuth(true);else setErr(true);}}}
          style={{...S.inp,textAlign:"center",fontSize:20,letterSpacing:8,marginBottom:10}}/>
        {err&&<div style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
        <button onClick={()=>{if(pin===ADMIN_PIN)setAuth(true);else setErr(true);}} style={{...S.primaryBtn,width:"100%",marginBottom:10}}>Entrar</button>
        <button onClick={onBack} style={{...S.secBtn,width:"100%"}}>← Voltar</button>
      </div>
    </div>
  );

  const allProjects = Object.values(PROJECTS);
  const valid = allProjects.map(p=>{
    const hist=stored[p.id]?.history??[];
    if(!hist.length)return null;
    const last=hist[hist.length-1];
    const h=computeHealth(p,last.state);
    return{...p,pct:h.pct,inopList:h.inopList,date:last.meta?.date,inopN:h.total-h.ok};
  }).filter(Boolean);
  const avgPct=valid.length?Math.round(valid.reduce((a,b)=>a+b.pct,0)/valid.length):null;

  return (
    <div style={S.page}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:4}}>
          <button onClick={onBack} style={S.backBtn}>← Início</button>
          <MoklogLogo size={34}/>
          <div>
            <div style={{fontSize:14,fontWeight:900,color:"#f1f5f9"}}>MokLog <span style={{color:"#cc2222"}}>CheckTest</span></div>
            <div style={{fontSize:11,color:"#334155"}}>Painel Gerencial — todos os projetos</div>
          </div>
          {avgPct!==null&&<div style={{marginLeft:"auto"}}><HealthRing pct={avgPct} size={52}/></div>}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {allProjects.map(p=>{
            const hist=stored[p.id]?.history??[];
            const last=hist.length?hist[hist.length-1]:null;
            const h=last?computeHealth(p,last.state):null;
            const color=h?h.pct>=90?"#22c55e":h.pct>=70?"#f59e0b":"#ef4444":"#334155";
            return(
              <div key={p.id} style={{background:"#060c18",border:`1px solid ${h?color+"44":"#0f172a"}`,borderRadius:12,padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>onSelectProject(p)}>
                  {h?<HealthRing pct={h.pct} size={50}/>:<div style={{width:50,height:50,borderRadius:"50%",border:"2px solid #1e293b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#334155"}}>—</div>}
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{p.id} – {p.name}</div>
                    {h?(
                      <>
                        <div style={{fontSize:11,color:"#475569",marginTop:2}}>Último teste: {fmtDate(last.meta?.date)} • {h.total-h.ok} inoperante(s)</div>
                        {h.inopList.length>0&&<div style={{fontSize:10,color:"#ef4444",marginTop:2}}>{h.inopList.slice(0,3).join(", ")}{h.inopList.length>3?` +${h.inopList.length-3}`:""}</div>}
                      </>
                    ):<div style={{fontSize:11,color:"#334155",marginTop:2}}>Sem registros</div>}
                  </div>
                  <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
                </div>
                {h&&<div style={{marginTop:10,height:4,background:"#0f172a",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${h.pct}%`,background:color,borderRadius:2,transition:"width .5s"}}/>
                </div>}
                {/* Trend sparkline */}
                {hist.length>1&&<div style={{display:"flex",gap:4,marginTop:8}}>
                  {hist.slice(-8).map((r,i)=>{
                    const rh=computeHealth(p,r.state);
                    const rc=rh.pct>=90?"#22c55e":rh.pct>=70?"#f59e0b":"#ef4444";
                    return <div key={i} title={`${fmtDate(r.meta?.date)}: ${rh.pct}%`} style={{flex:1,height:30,background:`${rc}22`,border:`1px solid ${rc}44`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:rc,fontWeight:700}}>{rh.pct}%</div>;
                  })}
                </div>}
                {/* Delete buttons */}
                {hist.length>0&&<div style={{marginTop:10,borderTop:"1px solid #0f172a",paddingTop:8}}>
                  <div style={{fontSize:10,color:"#334155",marginBottom:5}}>Relatórios salvos: {hist.length} / {MAX_HISTORY}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {hist.slice().reverse().slice(0,3).map((r,i)=>{
                      const realIdx=hist.length-1-i;
                      return(
                        <button key={i} onClick={()=>setConfirmDelete({projectId:p.id,idx:realIdx,date:r.meta?.date})}
                          style={{...S.sm,color:"#ef4444",border:"1px solid #ef444433",fontSize:10}}>
                          🗑 {fmtDate(r.meta?.date)||`#${realIdx+1}`}
                        </button>
                      );
                    })}
                  </div>
                </div>}
              </div>
            );
          })}
        </div>

        {/* Confirm Delete Modal */}
        {confirmDelete&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16}}>
            <div style={{background:"#060c18",border:"1px solid #ef4444",borderRadius:14,padding:"24px 20px",maxWidth:320,width:"100%",textAlign:"center"}}>
              <div style={{fontSize:24,marginBottom:10}}>🗑️</div>
              <div style={{fontSize:14,fontWeight:700,color:"#f1f5f9",marginBottom:6}}>Excluir relatório?</div>
              <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>{confirmDelete.projectId} — {fmtDate(confirmDelete.date)}<br/>Esta ação não pode ser desfeita.</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{onDeleteReport(confirmDelete.projectId,confirmDelete.idx);setConfirmDelete(null);}}
                  style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#b91c1c,#991b1b)"}}>Excluir</button>
                <button onClick={()=>setConfirmDelete(null)} style={{...S.secBtn,flex:1}}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── History Screen ───────────────────────────────────────────────────────────
function getWeekLabel(dateStr) {
  if (!dateStr) return "S?";
  const d = new Date(dateStr + "T12:00:00");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `S${Math.ceil(d.getDate()/7)} ${months[d.getMonth()]}`;
}

function generateStructuredExport(project, report, weekLabel) {
  const { state, meta } = report;
  const h = computeHealth(project, state);
  const L = [];
  L.push(`╔${"═".repeat(58)}╗`);
  L.push(`  MOKLOG CHECKTEST – EXPORTAÇÃO ESTRUTURADA`);
  L.push(`╚${"═".repeat(58)}╝`);
  L.push(`Projeto  : ${project.id} – ${project.name}`);
  L.push(`Semana   : ${weekLabel}`);
  L.push(`Data     : ${fmtDate(meta?.date)}  |  ${meta?.start||"—"} – ${meta?.end||"—"}`);
  L.push(`Líder    : ${meta?.leader||"—"}`);
  L.push(`CCO      : ${meta?.cco||"—"}`);
  L.push(`Moked 24h: ${meta?.moked||"—"}  |  Contato: ${meta?.mokedContact?"✓ Realizado":"✗ Não realizado"}${meta?.mokedTime?` às ${meta.mokedTime}`:""}`);
  L.push(`Saúde    : ${h.pct}%  (${h.ok}/${h.total} unidades OK)`);
  if(meta?.signature) L.push(`Assinatura: ${meta.signature}`);
  L.push("─".repeat(60));
  const inopItems = [];
  for (const cat of project.categories) {
    const s = state[cat.id]; if (!s) continue;
    if (cat.type === "single" && (s.status==="inop"||(s.status===undefined&&s.ok===false))) {
      inopItems.push({ label: cat.label, id: "—", since: s.since, note: s.note });
    } else if (cat.type === "items") {
      s.forEach((v, i) => { if (v.status==="inop"||(v.status===undefined&&v.ok===false)) inopItems.push({ label: `${cat.label} – ${cat.itemLabels[i]}`, id: cat.itemLabels[i], since: v.since, note: v.note }); });
    } else if (cat.type === "count") {
      (s.inoperative ?? []).forEach(it => inopItems.push({ label: cat.label, id: it.id||"?", since: it.since, note: it.note }));
    }
  }
  L.push(`\nITENS INOPERANTES (${inopItems.length})`);
  if (!inopItems.length) L.push("  ✔ Nenhum item inoperante registrado.");
  else inopItems.forEach((it, i) => { L.push(`  ${i+1}. ${it.label}${it.id && it.id !== "—" ? ` [${it.id}]` : ""} – INOP${it.since ? ` desde ${fmtDate(it.since)}` : ""}${it.note ? ` – ${it.note}` : ""}`); });
  if (meta?.obs) { L.push(`\nOBSERVAÇÕES GERAIS`); L.push(`  ${meta.obs}`); }
  L.push(`\n${"═".repeat(60)}`);
  L.push(`FIM DA EXPORTAÇÃO – ${project.id} ${weekLabel} – MokLog CheckTest`);
  L.push("═".repeat(60));
  return L.join("\n");
}

function HistoryScreen({project, stored, onBack}) {
  const hist = (stored[project.id]?.history??[]).slice().reverse();
  const [exportText, setExportText] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const handleExport = (r, i, weekLabel) => {
    const text = generateStructuredExport(project, r, weekLabel);
    setExportText({ text, idx: i, weekLabel });
  };

  if (exportText) return (
    <div style={S.page}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <button onClick={()=>setExportText(null)} style={S.backBtn}>← Voltar</button>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#f1f5f9"}}>Exportar — {project.id} {exportText.weekLabel}</div>
            <div style={{fontSize:11,color:"#334155"}}>Copie e cole no Claude para gerar o relatório</div>
          </div>
        </div>
        <div style={{background:"#f8fafc",borderRadius:10,padding:"14px 16px",border:"1px solid #e2e8f0",maxHeight:"60vh",overflowY:"auto",marginBottom:12}}>
          <pre style={{margin:0,fontFamily:"'Courier New',monospace",fontSize:11,whiteSpace:"pre-wrap",color:"#1e293b",lineHeight:1.7}}>{exportText.text}</pre>
        </div>
        <button onClick={()=>{navigator.clipboard.writeText(exportText.text);setCopiedIdx(exportText.idx);setTimeout(()=>setCopiedIdx(null),2500);}} style={{...S.primaryBtn,width:"100%"}}>
          {copiedIdx===exportText.idx?"✓ Copiado!":"📋 Copiar Texto"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a",marginBottom:4}}>
          <button onClick={onBack} style={S.backBtn}>← Voltar</button>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#f1f5f9"}}>Histórico — {project.id}</div>
            <div style={{fontSize:11,color:"#334155"}}>{project.name} • Últimas {MAX_HISTORY} semanas (somente leitura)</div>
          </div>
        </div>
        {!hist.length&&(
          <div style={{textAlign:"center",padding:"40px 0",color:"#334155",fontSize:14}}>
            <div style={{fontSize:28,marginBottom:8}}>📭</div>Nenhum relatório salvo ainda.
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {hist.map((r,i)=>{
            const h=computeHealth(project,r.state);
            const color=h.pct>=90?"#22c55e":h.pct>=70?"#f59e0b":"#ef4444";
            const weekLabel=getWeekLabel(r.meta?.date);
            const inopCount=h.total-h.ok;
            return(
              <div key={i} style={{background:"#060c18",border:`1px solid ${color}22`,borderRadius:12,padding:"12px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <HealthRing pct={h.pct} size={46}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{weekLabel}</span>
                      <span style={{fontSize:11,color:"#334155"}}>{fmtDate(r.meta?.date)}</span>
                    </div>
                    <div style={{fontSize:11,color:"#475569",marginTop:2}}>Líder: {r.meta?.leader||"—"} · CCO: {r.meta?.cco||"—"}</div>
                    {r.meta?.signature&&<div style={{fontSize:11,color:"#64748b",marginTop:1}}>✍ {r.meta.signature}</div>}
                    <div style={{fontSize:11,color:inopCount>0?"#ef4444":"#22c55e",marginTop:1,fontWeight:600}}>
                      {inopCount>0?`${inopCount} inoperante(s)`:"✔ Tudo OK"}
                    </div>
                  </div>
                </div>
                <div style={{marginTop:8,height:3,background:"#0f172a",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${h.pct}%`,background:color,borderRadius:2}}/>
                </div>
                <div style={{display:"flex",gap:6,marginTop:10}}>
                  <button onClick={()=>handleExport(r,i,weekLabel)} style={{...S.primaryBtn,flex:1,padding:"9px 10px",fontSize:12}}>
                    📄 Exportar
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

// ─── Report Screen ────────────────────────────────────────────────────────────
function ReportScreen({project,state,meta,photos,onBack,onHome}){
  const [copied,setCopied]=useState(false);
  const text=generateReportText(project,state,meta,photos);
  const subject=`[${project.id}] MokLog CheckTest – Teste Semanal – ${fmtDate(meta.date)}`;
  const mailto=`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  return(
    <div style={S.page}>
      <div style={S.formWrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <button onClick={onBack} style={S.backBtn}>← Voltar</button>
          <h2 style={{color:"#f1f5f9",fontSize:16,fontWeight:800,margin:0}}>Relatório — {project.id}</h2>
        </div>
        {photos?.length>0&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:"#475569",marginBottom:6}}>Fotos ({photos.length})</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {photos.map((p,i)=><img key={i} src={p.url} alt={p.catLabel||p.name} style={{width:64,height:48,objectFit:"cover",borderRadius:5,border:"1px solid #0f172a"}} title={p.catLabel||""}/>)}
            </div>
          </div>
        )}
        <div style={{background:"#f8fafc",borderRadius:10,padding:"14px 16px",border:"1px solid #e2e8f0",maxHeight:"50vh",overflowY:"auto",marginBottom:14}}>
          <pre style={{margin:0,fontFamily:"'Courier New',monospace",fontSize:11,whiteSpace:"pre-wrap",color:"#1e293b",lineHeight:1.7}}>{text}</pre>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>generatePDF(project,state,meta,photos)} style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}}>
            📄 Exportar PDF
          </button>
          <button onClick={()=>{navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{...S.primaryBtn,flex:1}}>
            {copied?"✓ Copiado!":"📋 Copiar Texto"}
          </button>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
          <a href={mailto} style={{...S.primaryBtn,flex:1,background:"linear-gradient(135deg,#059669,#047857)",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:6,color:"#fff"}}>
            ✉ Enviar E-mail
          </a>
          <button onClick={onHome} style={{...S.secBtn,flex:1}}>🏠 Início</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [screen, setScreen] = useState("home");
  const [project, setProject] = useState(PROJECTS.P601);
  const [state, setState] = useState(null);
  const [meta, setMeta] = useState({date:todayStr(),start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:""});
  const [stored, setStored] = useState({});
  const [photos, setPhotos] = useState([]);
  const [active, setActive] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [projectAuth, setProjectAuth] = useState({}); // {P601: timestamp}
  const [sigError, setSigError] = useState(false);
  const [draft, setDraft] = useState(null); // rascunho salvo
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);

  // Session timeout check
  const checkAuth = (pid) => {
    const ts = projectAuth[pid];
    if(!ts) return false;
    return (Date.now() - ts) < SESSION_TIMEOUT;
  };

  const grantAuth = (pid) => {
    setProjectAuth(prev => ({...prev, [pid]: Date.now()}));
  };

  // Load data
  useEffect(()=>{
    const localData = (() => { try{ const r=localStorage.getItem("seccheck_v4"); return r?JSON.parse(r):{}; }catch{return{};} })();
    setStored(localData);
    // Load draft
    try { const d=localStorage.getItem("moklog_draft"); if(d) setDraft(JSON.parse(d)); } catch{}
    loadAllFromFirebase().then(fbData=>{
      if(Object.keys(fbData).length > 0){
        setStored(fbData);
        localStorage.setItem("seccheck_v4", JSON.stringify(fbData));
      }
      setLoaded(true);
    }).catch(()=>{ setLoaded(true); });
  },[]);

  // Real-time listener
  useEffect(()=>{
    if(!loaded) return;
    const unsubscribers = Object.keys(PROJECTS).map(pid => {
      return onSnapshot(doc(db,"projects",pid), (snap)=>{
        if(snap.exists()){
          setStored(prev=>{
            const updated = {...prev, [pid]: snap.data()};
            localStorage.setItem("seccheck_v4", JSON.stringify(updated));
            return updated;
          });
        }
      }, ()=>{});
    });
    return ()=>unsubscribers.forEach(u=>u());
  },[loaded]);

  // Auto-save draft when form is open
  useEffect(()=>{
    if(screen==="form" && state){
      const d = {projectId:project.id, state, meta, photos, savedAt: Date.now()};
      localStorage.setItem("moklog_draft", JSON.stringify(d));
      setDraft(d);
    }
  },[screen, state, meta, photos]);

  const clearDraft = () => {
    localStorage.removeItem("moklog_draft");
    setDraft(null);
  };

  const lastForProject = stored[project.id]?.history?.slice(-1)[0]??null;

  const saveReport = async(st, mt) => {
    setSyncing(true); setSyncStatus("");
    const prev = stored[project.id]?.history??[];
    const next = [...prev, {state:st, meta:mt, savedAt:new Date().toISOString()}].slice(-MAX_HISTORY);
    const updated = {...stored, [project.id]: {...stored[project.id], history:next, updatedAt:new Date().toISOString()}};
    setStored(updated);
    localStorage.setItem("seccheck_v4", JSON.stringify(updated));
    clearDraft();
    try{ await saveToFirebase(project.id, next); setSyncStatus("saved"); }
    catch(e){ setSyncStatus("error"); }
    finally{ setSyncing(false); setTimeout(()=>setSyncStatus(""),3000); }
  };

  const deleteReport = async(projectId, idx) => {
    const prev = stored[projectId]?.history??[];
    const next = prev.filter((_,i)=>i!==idx);
    const updated = {...stored, [projectId]: {...stored[projectId], history:next, updatedAt:new Date().toISOString()}};
    setStored(updated);
    localStorage.setItem("seccheck_v4", JSON.stringify(updated));
    try{ await deleteReportFromFirebase(projectId, next); }
    catch(e){ console.error(e); }
  };

  const startNew = () => {
    // Check for draft
    if(draft && draft.projectId===project.id){
      setShowDraftPrompt(true);
      return;
    }
    // Pre-fill with last report's statuses, blank header
    const base = lastForProject ? lastForProject.state : buildBlank(project);
    setState(base);
    setMeta({date:todayStr(),start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:""});
    setPhotos([]);
    setScreen("form");
    setActive(null);
  };

  const continueDraft = () => {
    setState(draft.state);
    setMeta(draft.meta);
    setPhotos(draft.photos||[]);
    setShowDraftPrompt(false);
    setScreen("form");
    setActive(null);
  };

  const discardDraft = () => {
    clearDraft();
    setShowDraftPrompt(false);
    const base = lastForProject ? lastForProject.state : buildBlank(project);
    setState(base);
    setMeta({date:todayStr(),start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:""});
    setPhotos([]);
    setScreen("form");
    setActive(null);
  };

  const finalize = () => {
    if(!meta.signature || meta.signature.trim()===""){
      setSigError(true);
      window.scrollTo(0,document.body.scrollHeight);
      return;
    }
    setSigError(false);
    saveReport(state, meta);
    setScreen("report");
  };

  const updateCat = useCallback((id,val)=>setState(prev=>({...prev,[id]:val})),[]);
  const health = state ? computeHealth(project, state) : null;

  const SyncBadge = ()=> syncing ? (
    <div style={{position:"fixed",bottom:16,right:16,background:"#1d4ed8",color:"#fff",borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,zIndex:999,boxShadow:"0 4px 12px rgba(0,0,0,.4)"}}>⟳ Sincronizando...</div>
  ) : syncStatus==="saved" ? (
    <div style={{position:"fixed",bottom:16,right:16,background:"#15803d",color:"#fff",borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,zIndex:999,boxShadow:"0 4px 12px rgba(0,0,0,.4)"}}>✓ Salvo na nuvem</div>
  ) : syncStatus==="error" ? (
    <div style={{position:"fixed",bottom:16,right:16,background:"#b91c1c",color:"#fff",borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,zIndex:999,boxShadow:"0 4px 12px rgba(0,0,0,.4)"}}>✗ Erro — dados locais OK</div>
  ) : null;

  // Draft prompt modal
  if(showDraftPrompt) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#060c18",border:"1px solid #f59e0b",borderRadius:16,padding:"28px 24px",maxWidth:320,width:"100%",textAlign:"center",margin:16}}>
        <div style={{fontSize:28,marginBottom:10}}>📝</div>
        <div style={{fontSize:15,fontWeight:700,color:"#f1f5f9",marginBottom:6}}>Rascunho encontrado</div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>
          Você tem um relatório em andamento de {project.id}.<br/>
          Deseja continuar de onde parou?
        </div>
        <div style={{display:"flex",gap:8,flexDirection:"column"}}>
          <button onClick={continueDraft} style={{...S.primaryBtn,width:"100%"}}>↩ Continuar rascunho</button>
          <button onClick={discardDraft} style={{...S.secBtn,width:"100%"}}>🗑 Descartar e começar novo</button>
        </div>
      </div>
    </div>
  );

  // Project PIN gate
  if(screen==="pin_gate") return (
    <ProjectPinGate project={project} onSuccess={()=>{grantAuth(project.id);setScreen("home");}} onBack={()=>setScreen("home")}/>
  );

  // ── DASHBOARD ──
  if(screen==="dashboard") return <Dashboard stored={stored} onBack={()=>setScreen("home")} onSelectProject={p=>{setProject(p);setScreen("home");}} onDeleteReport={deleteReport}/>;

  // ── HISTORY ──
  if(screen==="history") return <HistoryScreen project={project} stored={stored} onBack={()=>setScreen("home")}/>;

  // ── REPORT ──
  if(screen==="report") return <ReportScreen project={project} state={state} meta={meta} photos={photos} onBack={()=>setScreen("form")} onHome={()=>setScreen("home")}/>;

  // ── FORM ──
  if(screen==="form") return (
    <div style={S.page}>
      <SyncBadge/>
      <div style={S.formWrap}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #060c18",marginBottom:2}}>
          <button onClick={()=>setScreen("home")} style={S.backBtn}>← Início</button>
          <MoklogLogo size={32}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:900,color:"#f8fafc",letterSpacing:.3}}>MokLog <span style={{color:"#cc2222"}}>CheckTest</span></div>
            <div style={{fontSize:11,color:"#334155",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{project.id} – {project.name}</div>
          </div>
          {health&&<HealthRing pct={health.pct} size={46}/>}
        </div>

        {/* Progress */}
        {health&&<div style={{height:3,background:"#060c18",borderRadius:2,overflow:"hidden",marginBottom:8}}>
          <div style={{height:"100%",width:`${health.pct}%`,background:health.pct>=90?"#22c55e":health.pct>=70?"#f59e0b":"#ef4444",borderRadius:2,transition:"width .4s"}}/>
        </div>}

        {/* Cabeçalho */}
        <div style={S.metaCard}>
          <div style={{fontSize:11,color:"#f59e0b",fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>📋 Cabeçalho do Relatório</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
            {[["Data","date","date"],["Início","start","time"],["Término","end","time"],["Líder VSPP","leader","text"],["CCO","cco","text"],["Operador Moked 24h","moked","text"],["Horário Contato Moked","mokedTime","time"]].map(([label,key,type])=>(
              <div key={key}>
                <label style={S.lbl}>{label}</label>
                <input type={type} placeholder={type==="text"?"Nome...":""} value={meta[key]} onChange={e=>setMeta(m=>({...m,[key]:e.target.value}))} style={S.inp}/>
              </div>
            ))}
            <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
              <label style={S.lbl}>Contato Moked realizado?</label>
              <div style={{display:"flex",gap:6,marginTop:3}}>
                <button onClick={()=>setMeta(m=>({...m,mokedContact:true}))} style={{...S.sm,...(meta.mokedContact?S.smOk:{}),flex:1}}>✓ Sim</button>
                <button onClick={()=>setMeta(m=>({...m,mokedContact:false}))} style={{...S.sm,...(!meta.mokedContact?S.smBad:{}),flex:1}}>✗ Não</button>
              </div>
            </div>
          </div>
          <div style={{marginTop:8}}>
            <label style={S.lbl}>Observações Gerais</label>
            <textarea placeholder="Observações adicionais..." value={meta.obs} onChange={e=>setMeta(m=>({...m,obs:e.target.value}))} style={{...S.inp,height:52,resize:"vertical",fontSize:12}}/>
          </div>
        </div>

        {/* Categories */}
        {state&&project.categories.map(cat=>{
          const isOpen=active===cat.id;
          const sv=state[cat.id];
          let cp=100;
          if(cat.type==="single"){const st=sv?.status??(sv?.ok===false?"inop":"ok");cp=st==="ok"?100:st==="partial"?50:0;}
          else if(cat.type==="items"){
            const a=sv||[];
            const okN=a.filter(v=>(v.status??"ok")==="ok").length;
            const partN=a.filter(v=>v.status==="partial").length;
            cp=calcPct(okN+(partN*0.5|0),a.length);
          }
          else if(cat.type==="count"){const t=sv?.total??cat.total;cp=calcPct(t-(sv?.inoperative?.length??0),t);}
          else if(cat.type==="notes") cp=100;
          else if(cat.type==="maintenance") cp=100;
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
                  {cat.type==="single"&&<SingleCat cat={cat} value={sv} onChange={v=>updateCat(cat.id,v)}/>}
                  {cat.type==="items"&&<ItemsCat cat={cat} values={sv} onChange={v=>updateCat(cat.id,v)} photos={photos} setPhotos={setPhotos}/>}
                  {cat.type==="count"&&<CountCat cat={cat} value={sv} onChange={v=>updateCat(cat.id,v)} photos={photos} setPhotos={setPhotos}/>}
                  {cat.type==="notes"&&<NotesCat cat={cat} value={sv} onChange={v=>updateCat(cat.id,v)}/>}
                  {cat.type==="maintenance"&&<MaintenanceCat cat={cat} value={sv} onChange={v=>updateCat(cat.id,v)}/>}
                </div>
              )}
            </div>
          );
        })}

        {/* Signature */}
        {state&&(
          <div style={{...S.metaCard,marginTop:8,border:sigError?"1px solid #ef4444":"1px solid #0f172a"}}>
            <div style={{fontSize:11,color:sigError?"#ef4444":"#f59e0b",fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>
              ✍️ Assinatura {sigError&&"— obrigatória para finalizar"}
            </div>
            <input
              placeholder="Digite seu nome completo para assinar..."
              value={meta.signature||""}
              onChange={e=>{setMeta(m=>({...m,signature:e.target.value}));setSigError(false);}}
              style={{...S.inp,fontSize:13,fontWeight:600}}
            />
            <div style={{fontSize:10,color:"#334155",marginTop:5}}>O relatório só pode ser finalizado com assinatura.</div>
          </div>
        )}

        {/* Actions */}
        {state&&(
          <div style={{marginTop:14,display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={finalize} style={{...S.primaryBtn,flex:2}}>✓ Finalizar e Gerar Relatório</button>
            <button onClick={()=>setScreen("home")} style={{...S.secBtn,flex:1}}>Cancelar</button>
          </div>
        )}
        <div style={{fontSize:10,color:"#1e293b",textAlign:"center",marginTop:4}}>💾 Rascunho salvo automaticamente</div>
      </div>
    </div>
  );

  // ── HOME ──
  return (
    <div style={S.page}>
      <SyncBadge/>
      <div style={S.homeWrap}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
          <MoklogLogo size={52}/>
          <div>
            <div style={{fontSize:22,fontWeight:900,color:"#f8fafc",letterSpacing:-0.5}}>MokLog</div>
            <div style={{fontSize:14,fontWeight:700,color:"#cc2222",letterSpacing:1}}>CheckTest</div>
            <div style={{fontSize:10,color:"#334155",marginTop:1}}>Sistema de Teste Semanal de Segurança</div>
          </div>
          <button onClick={()=>setScreen("dashboard")} style={{marginLeft:"auto",background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,padding:"7px 11px",cursor:"pointer",fontSize:12,color:"#64748b"}}>📊 Painel</button>
        </div>

        {/* Draft banner */}
        {draft&&draft.projectId===project.id&&(
          <div style={{background:"#0f172a",border:"1px solid #f59e0b55",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16}}>📝</span>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>Rascunho em andamento</div>
              <div style={{fontSize:11,color:"#64748b"}}>{project.id} — salvo automaticamente</div>
            </div>
            <button onClick={()=>{setShowDraftPrompt(true);}} style={{...S.sm,color:"#f59e0b",border:"1px solid #f59e0b44"}}>Continuar</button>
          </div>
        )}

        <div style={{width:"100%"}}>
          <div style={{fontSize:10,color:"#334155",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Selecione o projeto</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {Object.values(PROJECTS).map(p=>{
              const hist=stored[p.id]?.history??[];
              const last=hist.slice(-1)[0];
              const h=last?computeHealth(p,last.state):null;
              const isActive=p.id===project.id;
              const color=h?h.pct>=90?"#22c55e":h.pct>=70?"#f59e0b":"#ef4444":"#334155";
              return(
                <button key={p.id} onClick={()=>setProject(p)} style={{...S.projCard,...(isActive?{...S.projCardActive,borderColor:color+"66"}:{})}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                    <div style={{width:9,height:9,borderRadius:"50%",background:isActive?color:"#1e293b",border:`1px solid ${isActive?color:"#334155"}`,flexShrink:0}}/>
                    <div style={{textAlign:"left"}}>
                      <div style={{fontSize:12,fontWeight:800,color:isActive?color:"#475569"}}>{p.id}</div>
                      <div style={{fontSize:13,color:isActive?"#e2e8f0":"#334155"}}>{p.name}</div>
                    </div>
                  </div>
                  {h&&<div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                    <span style={{fontSize:12,fontWeight:700,color}}>{h.pct}%</span>
                    <span style={{fontSize:10,color:"#334155"}}>{fmtDate(last?.meta?.date)}</span>
                  </div>}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{width:"100%",display:"flex",flexDirection:"column",gap:8,marginTop:4}}>
          {checkAuth(project.id) ? (
            <>
              <button onClick={startNew} style={S.primaryBtn}>＋ Novo Relatório — {project.id}</button>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setScreen("history")} style={{...S.secBtn,flex:1}}>📅 Histórico</button>
              </div>
            </>
          ) : (
            <button onClick={()=>setScreen("pin_gate")} style={S.primaryBtn}>🔐 Acessar — {project.id}</button>
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
  photoSection:{background:"#060c18",borderRadius:10,padding:12,border:"1px solid #0f172a",marginTop:4},
};
