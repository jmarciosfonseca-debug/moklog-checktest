import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, collection, getDocs, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
  messagingSenderId: "390165325023",
  appId: "1:390165325023:web:3147cd333503916b0d756a"
};

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const RONDA_PIN = "16311";
const RONDA_ADMIN_PIN = "872101";
const RONDA_INTERVAL_MIN = 60;

const PROJECTS = {
  P311A: {
    id: "P311A",
    name: "Mega CL Curitiba",
    lat: -25.2833,
    lng: -49.0500,
    zoom: 16,
    color: "#0ea5e9"
  },
  P311B: {
    id: "P311B",
    name: "Mega CL Itajai",
    lat: -26.9075,
    lng: -48.6897,
    zoom: 16,
    color: "#0ea5e9"
  }
};

function fmtTime(d) {
  if(!d) return "--:--";
  const dt = new Date(d);
  return dt.toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"});
}
function fmtDate(d) {
  if(!d) return "--";
  return new Date(d).toLocaleDateString("pt-BR");
}
function fmtDuration(ms) {
  if(!ms||ms<0) return "--";
  const m = Math.floor(ms/60000);
  const s = Math.floor((ms%60000)/1000);
  return `${m}m ${s}s`;
}
function calcDistance(pts) {
  if(!pts||pts.length<2) return 0;
  let total = 0;
  for(let i=1;i<pts.length;i++){
    const R=6371000;
    const lat1=pts[i-1].lat*Math.PI/180;
    const lat2=pts[i].lat*Math.PI/180;
    const dLat=(pts[i].lat-pts[i-1].lat)*Math.PI/180;
    const dLng=(pts[i].lng-pts[i-1].lng)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
    total+=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  return total;
}

async function saveRondaFirebase(projectId, ronda) {
  try {
    const ref = doc(db, "rondas", `${projectId}_${ronda.id}`);
    await setDoc(ref, ronda);
  } catch(e) { console.error("Ronda save error:", e); }
}

async function loadRondasFirebase(projectId) {
  try {
    const snap = await getDocs(collection(db, "rondas"));
    const result = [];
    snap.forEach(d => {
      const data = d.data();
      if(data.projectId === projectId) result.push(data);
    });
    return result.sort((a,b) => b.startTime - a.startTime);
  } catch(e) { return []; }
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
  page: {minHeight:"100vh",background:"#04080f",display:"flex",justifyContent:"center",padding:"0 0 60px",fontFamily:"'Segoe UI',system-ui,sans-serif"},
  wrap: {width:"100%",maxWidth:440,padding:"20px 16px 40px",display:"flex",flexDirection:"column",gap:10},
  card: {background:"#060c18",border:"1px solid #0f172a",borderRadius:12,padding:"12px 14px"},
  btn: {background:"linear-gradient(135deg,#0369a1,#075985)",color:"#fff",border:"none",borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%"},
  btnDanger: {background:"linear-gradient(135deg,#b91c1c,#991b1b)",color:"#fff",border:"none",borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%"},
  btnSec: {background:"#060c18",color:"#64748b",border:"1px solid #0f172a",borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5,width:"100%"},
  backBtn: {background:"transparent",border:"1px solid #0f172a",color:"#334155",borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer",flexShrink:0},
  inp: {width:"100%",background:"#020510",border:"1px solid #0f172a",borderRadius:7,color:"#e2e8f0",padding:"10px 12px",fontSize:13,boxSizing:"border-box",outline:"none"},
  lbl: {display:"block",fontSize:10,color:"#334155",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:.5},
};

// ─── Map Component ────────────────────────────────────────────────────────────
function RondaMap({project, trail, currentPos, height=220}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const polyline = useRef(null);
  const marker = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if(typeof window === "undefined") return;
    if(window.L) { setMapLoaded(true); return; }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }, []);

  // Reset map when trail clears (new ronda started)
  useEffect(() => {
    if(trail.length === 0 && polyline.current) {
      try { polyline.current.setLatLngs([]); } catch(e) {}
    }
  }, [trail]);

  useEffect(() => {
    if(!mapLoaded || !mapRef.current || mapInstance.current) return;
    try {
      const L = window.L;
      const map = L.map(mapRef.current, {
        center: [project.lat, project.lng],
        zoom: project.zoom,
        zoomControl: true,
        attributionControl: false
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      }).addTo(map);
      mapInstance.current = map;

      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:#0ea5e9;border:3px solid white;border-radius:50%;box-shadow:0 0 8px #0ea5e9"></div>`,
        iconSize: [14,14], iconAnchor: [7,7], className: ""
      });
      marker.current = L.marker([project.lat, project.lng], {icon}).addTo(map);
      polyline.current = L.polyline([], {color:"#0ea5e9",weight:4,opacity:0.9,lineCap:"round"}).addTo(map);
    } catch(e) { console.error("Map init error:", e); }
  }, [mapLoaded, project]);

  useEffect(() => {
    if(!mapInstance.current || !polyline.current) return;
    try {
      const coords = trail.map(p => [p.lat, p.lng]);
      polyline.current.setLatLngs(coords);
      if(currentPos && marker.current) {
        marker.current.setLatLng([currentPos.lat, currentPos.lng]);
        if(trail.length > 0 && trail.length % 5 === 0) {
          mapInstance.current.panTo([currentPos.lat, currentPos.lng], {animate:true, duration:0.5});
        }
      }
    } catch(e) {}
  }, [trail, currentPos]);

  return (
    <div style={{borderRadius:10,overflow:"hidden",border:"1px solid #1e3a5f",position:"relative"}}>
      {!mapLoaded && (
        <div style={{height,background:"#0a1628",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
          <div style={{fontSize:24}}>🗺️</div>
          <div style={{fontSize:12,color:"#38bdf8"}}>Carregando mapa...</div>
        </div>
      )}
      <div ref={mapRef} style={{height, display: mapLoaded ? "block" : "none"}}/>
      {mapLoaded && (
        <div style={{position:"absolute",top:8,left:8,background:"rgba(4,8,15,.85)",border:"1px solid #0ea5e944",borderRadius:6,padding:"3px 8px",fontSize:9,color:"#38bdf8",fontWeight:700,zIndex:1000}}>
          GPS ATIVO
        </div>
      )}
    </div>
  );
}

// ─── Static Map (for history) ─────────────────────────────────────────────────
function StaticMap({project, trail, height=160}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(!!window.L);

  useEffect(() => {
    if(window.L) { setMapLoaded(true); return; }
    const checkL = setInterval(() => { if(window.L){ setMapLoaded(true); clearInterval(checkL); } }, 200);
    return () => clearInterval(checkL);
  }, []);

  useEffect(() => {
    if(!mapLoaded || !mapRef.current || mapInstance.current) return;
    try {
      const L = window.L;
      const center = trail.length > 0 ? [trail[0].lat, trail[0].lng] : [project.lat, project.lng];
      const map = L.map(mapRef.current, {
        center, zoom: project.zoom - 1,
        zoomControl: false, attributionControl: false,
        dragging: false, scrollWheelZoom: false
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
      if(trail.length > 1) {
        L.polyline(trail.map(p=>[p.lat,p.lng]),{color:"#0ea5e9",weight:3,opacity:0.9}).addTo(map);
        const startIcon = L.divIcon({html:`<div style="width:10px;height:10px;background:#22c55e;border:2px solid white;border-radius:50%"></div>`,iconSize:[10,10],iconAnchor:[5,5],className:""});
        const endIcon = L.divIcon({html:`<div style="width:10px;height:10px;background:#ef4444;border:2px solid white;border-radius:50%"></div>`,iconSize:[10,10],iconAnchor:[5,5],className:""});
        L.marker([trail[0].lat,trail[0].lng],{icon:startIcon}).addTo(map);
        L.marker([trail[trail.length-1].lat,trail[trail.length-1].lng],{icon:endIcon}).addTo(map);
        const bounds = L.latLngBounds(trail.map(p=>[p.lat,p.lng]));
        map.fitBounds(bounds, {padding:[20,20]});
      }
      mapInstance.current = map;
    } catch(e) {}
  }, [mapLoaded, trail, project]);

  return (
    <div style={{borderRadius:8,overflow:"hidden",border:"1px solid #1e3a5f"}}>
      {!mapLoaded && <div style={{height,background:"#0a1628",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#38bdf8"}}>Carregando mapa...</div>}
      <div ref={mapRef} style={{height, display: mapLoaded?"block":"none"}}/>
    </div>
  );
}

// ─── MAIN RONDA APP ───────────────────────────────────────────────────────────
export default function RondaApp({onBack}) {
  const [screen, setScreen] = useState("home");
  const [project, setProject] = useState(null);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [auth, setAuth] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);

  // Ronda state
  const [rondaActive, setRondaActive] = useState(false);
  const [currentRonda, setCurrentRonda] = useState(null);
  const [trail, setTrail] = useState([]);
  const [currentPos, setCurrentPos] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [nextRondaTimer, setNextRondaTimer] = useState(null);
  const [vigilante, setVigilante] = useState("");
  const [turno, setTurno] = useState("Diurno");
  const [photos, setPhotos] = useState([]);
  const [rondas, setRondas] = useState([]);
  const [viewRonda, setViewRonda] = useState(null);
  const [gpsError, setGpsError] = useState(null);

  const watchId = useRef(null);
  const timerRef = useRef(null);
  const nextTimerRef = useRef(null);

  // Load saved rondas
  useEffect(() => {
    if(!project) return;
    loadRondasFirebase(project.id).then(setRondas);
    // Also load from localStorage as backup
    try {
      const local = JSON.parse(localStorage.getItem(`rondas_${project.id}`) || "[]");
      if(local.length > 0) setRondas(prev => {
        const ids = new Set(prev.map(r=>r.id));
        return [...prev, ...local.filter(r=>!ids.has(r.id))].sort((a,b)=>b.startTime-a.startTime);
      });
    } catch(e) {}
  }, [project]);

  // GPS tracking
  const startGPS = useCallback(() => {
    if(!navigator.geolocation) { setGpsError("GPS nao disponivel neste dispositivo"); return; }
    setGpsError(null);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() };
        setCurrentPos(p);
        setTrail(prev => {
          if(prev.length > 0) {
            const last = prev[prev.length-1];
            const dist = calcDistance([last, p]);
            if(dist < 5) return prev; // ignore if less than 5m
          }
          return [...prev, p];
        });
      },
      (err) => setGpsError(`Erro GPS: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }, []);

  const stopGPS = useCallback(() => {
    if(watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  // Timer
  useEffect(() => {
    if(rondaActive && currentRonda) {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - currentRonda.startTime);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [rondaActive, currentRonda]);

  const startRonda = () => {
    if(!vigilante.trim()) { alert("Informe o nome do vigilante"); return; }
    const ronda = {
      id: Date.now().toString(),
      projectId: project.id,
      projectName: project.name,
      vigilante: vigilante.trim(),
      turno,
      startTime: Date.now(),
      endTime: null,
      trail: [],
      distanceM: 0,
      photos: [],
      status: "active"
    };
    setCurrentRonda(ronda);
    setTrail([]);        // ← mapa limpo a cada nova ronda
    setCurrentPos(null); // ← posição resetada
    setElapsed(0);
    setPhotos([]);
    setRondaActive(true);
    startGPS();
    setScreen("active");
    // Schedule next ronda notification
    clearTimeout(nextTimerRef.current);
    nextTimerRef.current = setTimeout(() => {
      if(Notification.permission === "granted") {
        new Notification("MokLog Ronda", {body: `${project.id} - Hora da proxima ronda!`});
      }
    }, RONDA_INTERVAL_MIN * 60 * 1000);
  };

  const finishRonda = () => {
    stopGPS();
    clearInterval(timerRef.current);
    const dist = calcDistance(trail);
    const finished = {
      ...currentRonda,
      endTime: Date.now(),
      trail,
      distanceM: dist,
      photos,
      status: "completed"
    };
    setRondas(prev => [finished, ...prev]);
    saveRondaFirebase(project.id, finished);
    // Save locally too
    try {
      const local = JSON.parse(localStorage.getItem(`rondas_${project.id}`) || "[]");
      localStorage.setItem(`rondas_${project.id}`, JSON.stringify([finished, ...local].slice(0, 50)));
    } catch(e) {}
    // Schedule next ronda countdown
    const nextMs = RONDA_INTERVAL_MIN * 60 * 1000;
    setNextRondaTimer(Date.now() + nextMs);
    setRondaActive(false);
    setCurrentRonda(null);
    setScreen("summary");
    setViewRonda(finished);
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0]; if(!file) return;
    if(file.size > 5*1024*1024) { alert("Foto muito grande. Max 5MB"); return; }
    const r = new FileReader();
    r.onload = ev => setPhotos(prev => [...prev, {url: ev.target.result, ts: Date.now()}]);
    r.readAsDataURL(file);
  };

  // Cleanup on unmount
  useEffect(() => () => { stopGPS(); clearInterval(timerRef.current); clearTimeout(nextTimerRef.current); }, []);

  const distKm = (calcDistance(trail)/1000).toFixed(2);
  const todayRondas = rondas.filter(r => {
    const d = new Date(r.startTime);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });
  const totalKmToday = todayRondas.reduce((a,r) => a + (r.distanceM||0), 0);

  // ── HOME ──
  if(screen === "home") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:10,paddingBottom:12,borderBottom:"1px solid #0f172a"}}>
          <button onClick={onBack} style={S.backBtn}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:900,color:"#f8fafc"}}>MokLog <span style={{color:"#0ea5e9"}}>Ronda</span></div>
            <div style={{fontSize:11,color:"#334155"}}>Rastreamento GPS de Rondas</div>
          </div>
        </div>

        <div style={{fontSize:11,color:"#334155",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Selecione o projeto</div>
        {Object.values(PROJECTS).map(p => (
          <button key={p.id} onClick={() => {setProject(p); setAuth(false); setPin(""); setScreen("pin");}}
            style={{...S.card, cursor:"pointer", border:`1px solid #0ea5e922`, textAlign:"left", display:"flex", alignItems:"center", gap:12, width:"100%"}}>
            <div style={{width:44,height:44,borderRadius:10,background:"#001a2e",border:"1px solid #0ea5e944",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:22}}>🗺️</span>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{p.id} — {p.name}</div>
              <div style={{fontSize:11,color:"#475569",marginTop:2}}>Ronda motorizada · A cada {RONDA_INTERVAL_MIN}h</div>
            </div>
            <span style={{color:"#334155",fontSize:16}}>›</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── PIN ──
  if(screen === "pin") return (
    <div style={{...S.page, alignItems:"center", justifyContent:"center"}}>
      <div style={{background:"#060c18",border:"1px solid #1e293b",borderRadius:16,padding:"32px 28px",maxWidth:320,width:"100%",textAlign:"center",margin:16}}>
        <div style={{fontSize:32,marginBottom:8}}>🗺️</div>
        <div style={{fontSize:16,fontWeight:800,color:"#f1f5f9",marginBottom:2}}>MokLog <span style={{color:"#0ea5e9"}}>Ronda</span></div>
        <div style={{fontSize:13,color:"#94a3b8",marginBottom:4}}>{project?.id} — {project?.name}</div>
        <div style={{fontSize:12,color:"#475569",marginBottom:20}}>Insira o PIN</div>
        <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pin}
          onChange={e=>{setPin(e.target.value);setPinErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter"){if(pin===RONDA_PIN||pin===RONDA_ADMIN_PIN){setAuth(true);if(pin===RONDA_ADMIN_PIN)setAdminAuth(true);setScreen("project");}else setPinErr(true);}}}
          style={{...S.inp,textAlign:"center",fontSize:22,letterSpacing:10,marginBottom:10}}/>
        {pinErr && <div style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
        <button onClick={()=>{if(pin===RONDA_PIN||pin===RONDA_ADMIN_PIN){setAuth(true);if(pin===RONDA_ADMIN_PIN)setAdminAuth(true);setScreen("project");}else setPinErr(true);}}
          style={{...S.btn,marginBottom:10}}>Entrar</button>
        <button onClick={()=>{setScreen("home");setPin("");}} style={S.btnSec}>← Voltar</button>
      </div>
    </div>
  );

  // ── PROJECT SCREEN ──
  if(screen === "project" && project) return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #0f172a"}}>
          <button onClick={()=>setScreen("home")} style={S.backBtn}>← Início</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>MokLog <span style={{color:"#0ea5e9"}}>Ronda</span></div>
            <div style={{fontSize:11,color:"#334155"}}>{project.id} — {project.name}</div>
          </div>
        </div>

        {/* Today summary */}
        {todayRondas.length > 0 && (
          <div style={{...S.card,border:"1px solid #0ea5e922"}}>
            <div style={{fontSize:11,color:"#0ea5e9",fontWeight:700,marginBottom:8}}>Hoje — {fmtDate(Date.now())}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color:"#0ea5e9"}}>{todayRondas.length}</div>
                <div style={{fontSize:9,color:"#64748b",fontWeight:700}}>RONDAS</div>
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color:"#22c55e"}}>{(totalKmToday/1000).toFixed(1)}</div>
                <div style={{fontSize:9,color:"#64748b",fontWeight:700}}>KM TOTAL</div>
              </div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color:"#f1f5f9"}}>{fmtTime(todayRondas[0]?.startTime)}</div>
                <div style={{fontSize:9,color:"#64748b",fontWeight:700}}>ÚLTIMA</div>
              </div>
            </div>
          </div>
        )}

        {/* Start form */}
        <div style={S.card}>
          <div style={{fontSize:11,color:"#f59e0b",fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Iniciar Nova Ronda</div>
          <div style={{marginBottom:8}}>
            <label style={S.lbl}>Nome do Vigilante</label>
            <input placeholder="Digite seu nome completo..." value={vigilante} onChange={e=>setVigilante(e.target.value)}
              style={S.inp}/>
          </div>
          <div style={{marginBottom:8}}>
            <label style={S.lbl}>Turno</label>
            <select value={turno} onChange={e=>setTurno(e.target.value)}
              style={{...S.inp,cursor:"pointer"}}>
              <option>Diurno</option>
              <option>Vespertino</option>
              <option>Noturno</option>
              <option>Madrugada</option>
            </select>
          </div>
          <div style={{background:"#020510",border:"1px solid #0f172a",borderRadius:7,padding:"8px 10px",marginBottom:12,display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:11,color:"#334155"}}>Data</span>
            <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>{new Date().toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"})}</span>
          </div>
          <button onClick={startRonda} style={S.btn}>🗺️ Iniciar Ronda GPS</button>
        </div>

        {/* History */}
        {todayRondas.length > 0 && (
          <div>
            <div style={{fontSize:10,color:"#334155",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Rondas de Hoje</div>
            {todayRondas.map((r,i) => (
              <div key={r.id} onClick={()=>{setViewRonda(r);setScreen("detail");}}
                style={{...S.card,cursor:"pointer",border:"1px solid #0ea5e922",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>Ronda {todayRondas.length - i}</div>
                  <div style={{fontSize:11,color:"#475569"}}>{fmtTime(r.startTime)} – {r.endTime?fmtTime(r.endTime):"Em andamento"}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{r.vigilante} · {r.turno}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#0ea5e9"}}>{(r.distanceM/1000).toFixed(2)} km</div>
                  <div style={{fontSize:10,color:"#334155"}}>{fmtDuration(r.endTime-r.startTime)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── ACTIVE RONDA ──
  if(screen === "active" && currentRonda) return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #060c18"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:800,color:"#f8fafc"}}>MokLog <span style={{color:"#0ea5e9"}}>Ronda</span> <span style={{fontSize:10,color:"#22c55e",background:"#021a0d",padding:"2px 6px",borderRadius:6,fontWeight:700}}>ATIVA</span></div>
            <div style={{fontSize:11,color:"#334155"}}>{project.id} · {currentRonda.vigilante}</div>
          </div>
        </div>

        {gpsError && <div style={{background:"#1a0202",border:"1px solid #ef444444",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#ef4444"}}>{gpsError}</div>}

        {/* Map */}
        <RondaMap project={project} trail={trail} currentPos={currentPos} height={220}/>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          <div style={{...S.card,textAlign:"center",border:"1px solid #0ea5e922"}}>
            <div style={{fontSize:20,fontWeight:900,color:"#0ea5e9"}}>{distKm}</div>
            <div style={{fontSize:9,color:"#64748b",fontWeight:700}}>KM</div>
          </div>
          <div style={{...S.card,textAlign:"center"}}>
            <div style={{fontSize:20,fontWeight:900,color:"#f1f5f9"}}>{fmtDuration(elapsed)}</div>
            <div style={{fontSize:9,color:"#64748b",fontWeight:700}}>DURAÇÃO</div>
          </div>
          <div style={{...S.card,textAlign:"center"}}>
            <div style={{fontSize:20,fontWeight:900,color:"#22c55e"}}>{trail.length}</div>
            <div style={{fontSize:9,color:"#64748b",fontWeight:700}}>PONTOS GPS</div>
          </div>
        </div>

        {/* Info */}
        <div style={{...S.card,border:"1px solid #0f172a"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:11,color:"#64748b"}}>Vigilante</span>
            <span style={{fontSize:11,color:"#f1f5f9",fontWeight:600}}>{currentRonda.vigilante}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:11,color:"#64748b"}}>Turno</span>
            <span style={{fontSize:11,color:"#f1f5f9",fontWeight:600}}>{currentRonda.turno}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:11,color:"#64748b"}}>Início</span>
            <span style={{fontSize:11,color:"#f1f5f9",fontWeight:600}}>{fmtTime(currentRonda.startTime)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:11,color:"#64748b"}}>Fotos</span>
            <span style={{fontSize:11,color:"#0ea5e9",fontWeight:600}}>{photos.length} foto(s)</span>
          </div>
        </div>

        {/* Photo button */}
        <label style={{...S.card,cursor:"pointer",border:"1px solid #0ea5e922",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>📷</span>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#0ea5e9"}}>Adicionar Foto</div>
            <div style={{fontSize:11,color:"#64748b"}}>Registre ocorrências ou pontos importantes</div>
          </div>
          <input type="file" accept="image/*" style={{position:"absolute",opacity:0,width:0,height:0}} onChange={handlePhoto}/>
        </label>

        {photos.length > 0 && (
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {photos.map((p,i) => <img key={i} src={p.url} alt="" style={{width:70,height:52,objectFit:"cover",borderRadius:6,border:"1px solid #1e3a5f"}}/>)}
          </div>
        )}

        <button onClick={finishRonda} style={S.btnDanger}>⏹ Finalizar Ronda</button>
      </div>
    </div>
  );

  // ── SUMMARY / DETAIL — each ronda shows only its own trail ──
  if((screen === "summary" || screen === "detail") && viewRonda) return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #0f172a"}}>
          <button onClick={()=>setScreen(screen==="summary"?"project":"project")} style={S.backBtn}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>Ronda {screen==="summary"?"Finalizada":"Detalhes"}</div>
            <div style={{fontSize:11,color:"#334155"}}>{viewRonda.projectId} · {fmtDate(viewRonda.startTime)}</div>
          </div>
          {screen==="summary"&&<div style={{background:"#021a0d",border:"1px solid #22c55e44",borderRadius:8,padding:"4px 10px",fontSize:11,color:"#22c55e",fontWeight:700}}>✓ Salva</div>}
        </div>

        {/* Map */}
        {viewRonda.trail && viewRonda.trail.length > 1 && (
          <StaticMap project={PROJECTS[viewRonda.projectId]||project} trail={viewRonda.trail} height={200}/>
        )}

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div style={{...S.card,textAlign:"center",border:"1px solid #0ea5e922"}}>
            <div style={{fontSize:24,fontWeight:900,color:"#0ea5e9"}}>{(viewRonda.distanceM/1000).toFixed(2)}</div>
            <div style={{fontSize:10,color:"#64748b",fontWeight:700}}>KM PERCORRIDOS</div>
          </div>
          <div style={{...S.card,textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:900,color:"#22c55e"}}>{fmtDuration(viewRonda.endTime-viewRonda.startTime)}</div>
            <div style={{fontSize:10,color:"#64748b",fontWeight:700}}>DURAÇÃO</div>
          </div>
        </div>

        {/* Details */}
        <div style={S.card}>
          {[
            ["Vigilante", viewRonda.vigilante],
            ["Turno", viewRonda.turno],
            ["Data", fmtDate(viewRonda.startTime)],
            ["Início", fmtTime(viewRonda.startTime)],
            ["Término", fmtTime(viewRonda.endTime)],
            ["Pontos GPS", viewRonda.trail?.length || 0],
            ["Fotos", `${viewRonda.photos?.length || 0} foto(s)`],
          ].map(([k,v]) => (
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #0a0f1e"}}>
              <span style={{fontSize:11,color:"#64748b"}}>{k}</span>
              <span style={{fontSize:11,color:"#f1f5f9",fontWeight:600}}>{v}</span>
            </div>
          ))}
        </div>

        {/* Photos */}
        {viewRonda.photos?.length > 0 && (
          <div>
            <div style={{fontSize:10,color:"#334155",fontWeight:700,textTransform:"uppercase",marginBottom:6}}>Fotos ({viewRonda.photos.length})</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {viewRonda.photos.map((p,i) => <img key={i} src={p.url} alt="" style={{width:80,height:60,objectFit:"cover",borderRadius:6,border:"1px solid #1e3a5f"}}/>)}
            </div>
          </div>
        )}

        <button onClick={()=>setScreen("project")} style={S.btn}>🗺️ Nova Ronda</button>
      </div>
    </div>
  );

  return null;
}
