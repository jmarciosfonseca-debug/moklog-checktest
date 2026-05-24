import { useState, useEffect, useCallback } from "react";
import AcessoApp from "./Acesso";
import EquipeApp from "./Equipe";
import { generatePDF, generateConsolidatedPDF } from "./generatePDF";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, collection, getDocs, onSnapshot } from "firebase/firestore";

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
const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(firebaseApp);

const PROJECT_PINS = {
  P601:"16601", P602:"16602", P604:"16604", P605:"16605",
  P606:"16606", P607:"16607", P311A:"16311", P311B:"16311", P505:"16505",
  P260A:"162601", P260B:"162602", P260C:"162603"
};
const ADMIN_PIN = "872101";
const MAX_HISTORY = 26;
const SESSION_TIMEOUT = 10 * 60 * 1000;

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
    {id:"qr_cancelas",label:"16 - Leitores QR Cancelas",type:"items",itemLabels:["Entrada(10)","Saída(10)"]},
    {id:"semaforos",label:"17 - Semáforos",type:"items",itemLabels:["Entrada","Saída"]},
    {id:"sensores",label:"18 - Sensores Anti-esmagamento",type:"items",itemLabels:["Entrada","Saída"]},
    {id:"nobreaks",label:"19 - Nobreaks",type:"items",itemLabels:["CCO","Portaria"]},
    {id:"mesa",label:"20 - Mesa Controladora / Botoeira",type:"items",itemLabels:["Mesa 01","Mesa 02"]},
    {id:"telefone",label:"21 - Telefone CCO",type:"items",itemLabels:["CCO"]},
    {id:"reverso",label:"22 - Reverso Inclusa",type:"items",itemLabels:["Entrada","Saída"]},
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
    {id:"infra",label:"27 - Infraestrutura / Obs.",type:"notes"}
  ]},
  P605: { id:"P605", grupo:"Golgi", name:"Golgi Dutra", categories:[
    {id:"fire",label:"01 - Alarme de Incêndio",type:"items",itemLabels:["CCO","Portaria"]},
    {id:"garras",label:"02 - Garras",type:"items",itemLabels:["Entrada","Saída"]},
    {id:"cftv",label:"03 - CFTV",type:"count",total:54},
    {id:"internet",label:"04 - Internet",type:"single"},
    {id:"manutencao",label:"05 - Visita de Manutenção",type:"maintenance"}
  ]},
  P606: { id:"P606", grupo:"Golgi", name:"Golgi Duque de Caxias", categories:[
    {id:"fire",label:"01 - Alarme de Incêndio",type:"items",itemLabels:["CCO","Portaria"]},
    {id:"cftv",label:"02 - CFTV",type:"count",total:72},
    {id:"internet",label:"03 - Internet",type:"single"},
    {id:"manutencao",label:"04 - Visita de Manutenção",type:"maintenance"}
  ]},
  P607: { id:"P607", grupo:"Golgi", name:"Golgi Brasília", categories:[
    {id:"fire",label:"01 - Alarme de Incêndio",type:"items",itemLabels:["CCO","Portaria"]},
    {id:"cftv",label:"02 - CFTV",type:"count",total:44},
    {id:"internet",label:"03 - Internet",type:"single"},
    {id:"manutencao",label:"04 - Visita de Manutenção",type:"maintenance"}
  ]},
  P311A: { id:"P311A", grupo:"Mega", name:"Mega CL Curitiba", categories:[
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
    {id:"infra",label:"19 - Infraestrutura / Obs.",type:"notes"}
  ]},
  P311B: { id:"P311B", grupo:"Mega", name:"Mega CL Itajaí", categories:[
    {id:"cftv",label:"01 - CFTV",type:"count",total:114},
    {id:"internet",label:"02 - Internet",type:"single"},
    {id:"manutencao",label:"03 - Visita de Manutenção",type:"maintenance"}
  ]},
  P505: { id:"P505", grupo:"Klog", name:"Klog Guarulhos", categories:[
    {id:"fire",label:"01 - Alarme de Incêndio",type:"items",itemLabels:["CCO","Portaria"]},
    {id:"cftv",label:"02 - CFTV",type:"count",total:73},
    {id:"internet",label:"03 - Internet",type:"single"},
    {id:"manutencao",label:"04 - Visita de Manutenção",type:"maintenance"}
  ]},
  P260A: { id: "P260A", grupo: "Jatinox", name: "Jatinox P260A (Matriz)", escopo: "AcessoEquipe", categories: [] },
  P260B: { id: "P260B", grupo: "Jatinox", name: "Jatinox P260B", escopo: "Equipe", categories: [] },
  P260C: { id: "P260C", grupo: "Jatinox", name: "Jatinox P260C", escopo: "Equipe", categories: [] }
};

export default function App(){
  const [screen,setScreen]=useState("home");
  const [homeGroup,setHomeGroup]=useState(null);
  const [project,setProject]=useState(PROJECTS.P601);
  const [state,setState]=useState(null);
  const [meta,setMeta]=useState({date:new Date().toISOString().split("T")[0],start:"",end:"",leader:"",cco:"",moked:"",mokedContact:false,mokedTime:"",obs:"",signature:""});
  const [stored,setStored]=useState({});
  const [loaded,setLoaded]=useState(false);
  const [projectAuth,setProjectAuth]=useState({});
  const [sigError,setSigError]=useState(false);

  useEffect(()=>{
    try{const r=localStorage.getItem("seccheck_v4"); if(r) setStored(JSON.parse(r));}catch(e){}
    loadAllFromFirebase().then(fb=>{
      if(Object.keys(fb).length>0){setStored(fb); localStorage.setItem("seccheck_v4",JSON.stringify(fb));}
      setLoaded(true);
    }).catch(()=>setLoaded(true));
  },[]);

  const grantAuth=(pid)=>setProjectAuth(prev=>({...prev,[pid]:Date.now()}));
  const checkAuth=(pid)=>{const ts=projectAuth[pid]; return ts&&(Date.now()-ts)<SESSION_TIMEOUT;};

  if (screen === "acesso_app") return <AcessoApp onBack={() => setScreen("home")} />;
  if (screen === "equipe_app") return <EquipeApp projetoId={project.id} isAdmin={checkAuth(project.id) && PROJECT_PINS[project.id] === ADMIN_PIN} onVoltar={() => setScreen("home")} />;

  if (screen === "pin_gate") {
    return (
      <div style={{minHeight:"100vh",background:"#04080F",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"sans-serif"}}>
        <div style={{background:"#060C18",padding:"35px",borderRadius:12,border:"1px solid #1E293B",width:"100%",maxWidth:"340px",textAlign:"center"}}>
          <h3 style={{color:"#E2E8F0",marginBottom:"5px"}}>{project.id === ADMIN_PIN ? "Painel Gerencial" : "Autenticação Requerida"}</h3>
          <p style={{color:"#64748B",fontSize:13,marginBottom:20}}>{project.id === ADMIN_PIN ? "Acesso Master Administrador" : `Posto: ${project.name}`}</p>
          <input type="password" placeholder="Digite o PIN" onKeyDown={e=>{
            if(e.key==="Enter"){
              const pinVal = e.target.value;
              if(project.id === ADMIN_PIN && pinVal === ADMIN_PIN) { grantAuth(project.id); setScreen("dashboard"); }
              else if(pinVal === PROJECT_PINS[project.id] || pinVal === ADMIN_PIN) { grantAuth(project.id); if(project.grupo === "Jatinox") { if(project.escopo === "AcessoEquipe") { setScreen("acesso_app"); } else { setScreen("equipe_app"); } } else { setScreen("form"); } }
              else alert("PIN Incorreto!");
            }
          }} style={{width:"100%",padding:"12px",borderRadius:6,border:"1px solid #1E293B",background:"#020510",color:"#FFF",fontSize:16,textAlign:"center",marginBottom:15}} />
          <button onClick={() => setScreen("home")} style={{width:"100%",padding:"10px",background:"transparent",color:"#64748B",border:"1px solid #1E293B",borderRadius:6,cursor:"pointer"}}>Voltar</button>
        </div>
      </div>
    );
  }

  return(
    <div style={{minHeight:"100vh",background:"#04080F",color:"#E2E8F0",fontFamily:"sans-serif",padding:"35px 15px"}}>
      <div style={{maxWidth:"480px",margin:"0 auto",display:"flex",flexDirection:"column",gap:15}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #1E293B",paddingBottom:15}}>
          <div><h1 style={{fontSize:"20px",fontWeight:"900",margin:0}}>MokLog <span style={{color:"#CC2222"}}>CheckTest</span></h1><p style={{fontSize:"12px",color:"#64748B",margin:"2px 0 0"}}>Moked Consulting Security · v2.0</p></div>
        </div>
        {!homeGroup ? (
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            <div onClick={()=>setHomeGroup("golgi")} style={{background:"linear-gradient(135deg, #0D1B2A, #1B263B)",padding:"20px",borderRadius:12,border:"1px solid #415A77",cursor:"pointer"}}><h3 style={{margin:0}}>🏭 PROJETOS GOLGI</h3></div>
            <div onClick={()=>setHomeGroup("mega")} style={{background:"linear-gradient(135deg, #1A0F00, #331A00)",padding:"20px",borderRadius:12,border:"1px solid #FF8C00",cursor:"pointer"}}><h3 style={{margin:0,color:"#FF8C00"}}>🏢 PROJETOS MEGA</h3></div>
            <div onClick={()=>setHomeGroup("klog")} style={{background:"linear-gradient(135deg, #0A192F, #0F3057)",padding:"20px",borderRadius:12,border:"1px solid #3B82F6",cursor:"pointer"}}><h3 style={{margin:0,color:"#3B82F6"}}>📦 PROJETOS KLOG</h3></div>
            <div onClick={()=>setHomeGroup("jatinox")} style={{background:"linear-gradient(135deg, #1F2937, #111827)",padding:"20px",borderRadius:12,border:"1px solid #4B5563",cursor:"pointer"}}><h3 style={{margin:0,color:"#10B981"}}>🏗️ COMPLEXO JATINOX</h3></div>
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}><button onClick={()=>setHomeGroup(null)} style={{padding:"6px 12px",background:"#1E293B",color:"#94A3B8",border:"none",borderRadius:4,cursor:"pointer"}}>← Voltar</button></div>
            <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {Object.values(PROJECTS).filter(p=>p.grupo.toLowerCase() === homeGroup.toLowerCase()).map(p => (
                <div key={p.id} style={{background:"#060C18",padding:"15px",borderRadius:8,border:"1px solid #1E293B"}}>
                  <h4>{p.name}</h4>
                  <div style={{display:"flex",gap:8}}>
                    {p.grupo !== "Jatinox" && <button onClick={()=>{ setProject(p); if(checkAuth(p.id)){ setScreen("form"); } else setScreen("pin_gate"); }} style={{flex:1,padding:"8px",background:"#CC2222",color:"#FFF",border:"none",borderRadius:4,cursor:"pointer"}}>📋 CheckTest</button>}
                    {p.escopo === "AcessoEquipe" && <button onClick={()=>{ setProject(p); setScreen("pin_gate"); }} style={{flex:1,padding:"8px",background:"#F59E0B",color:"#FFF",border:"none",borderRadius:4,cursor:"pointer"}}>🚛 Acesso GH</button>}
                    {(p.grupo === "Jatinox" || p.id === "P601" || p.id === "P604" || p.id === "P311A") && <button onClick={() => { setProject(p); setScreen("pin_gate"); }} style={{flex:1,padding:"8px",background:"#2563EB",color:"#FFF",border:"none",borderRadius:4,cursor:"pointer"}}>👥 Escala Equipe</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
