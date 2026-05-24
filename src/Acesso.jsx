import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, collection, getDocs } from "firebase/firestore";

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

const ACESSO_PIN = "162601";
const PROJECT_ID = "P260A";
const PROJECT_NAME = "Jatinox";
const MAX_FOTOS = 5;
const LOGO_JATINOX = "data:image/jpeg;base64,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";
const LOGO_MOKED = "data:image/jpeg;base64,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";


function fmtDateBR(d) {
  if(!d) return "--";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}
function calcTempo(entrada, saida) {
  if(!entrada||!saida) return "--";
  try {
    const [eh,em]=entrada.split(":").map(Number);
    const [sh,sm]=saida.split(":").map(Number);
    const diff=(sh*60+sm)-(eh*60+em);
    if(diff<0) return "--";
    return `${Math.floor(diff/60)}h ${String(diff%60).padStart(2,"0")}min`;
  } catch { return "--"; }
}
function calcEspera(chegada, entrada) { return calcTempo(chegada, entrada); }
function todayStr() { return new Date().toISOString().split("T")[0]; }
function emptyForm() {
  return { id:Date.now().toString(), data:todayStr(), motorista:"", cpfRg:"",
    placaCavalo:"", placaCarreta:"", chegada:"", entregaNF:"",
    entradaPatio:"", saida:"", obs:"", fotos:[] };
}

async function saveRegistroFB(reg) {
  try {
    const {fotos,...rest} = reg;
    await setDoc(doc(db,"acessos_p260a",reg.id), {...rest, fotoCount:fotos?.length||0});
  } catch(e) { console.error(e); }
}

async function loadRegistrosFB() {
  try {
    const snap = await getDocs(collection(db,"acessos_p260a"));
    const r = []; snap.forEach(d=>r.push(d.data()));
    return r.sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  } catch { return []; }
}

function generateRelatorio(registros) {
  if(!registros.length) return;
  const sorted = [...registros].sort((a,b)=>(a.data||"").localeCompare(b.data||""));
  const periodo = `${fmtDateBR(sorted[0]?.data)} a ${fmtDateBR(sorted[sorted.length-1]?.data)}`;
  const motoristas = new Set(registros.map(r=>r.motorista?.trim()).filter(Boolean)).size;
  const datas = new Set(registros.map(r=>r.data).filter(Boolean)).size;
  const tempos = registros.map(r=>{
    if(!r.entradaPatio||!r.saida) return null;
    const [eh,em]=r.entradaPatio.split(":").map(Number);
    const [sh,sm]=r.saida.split(":").map(Number);
    return (sh*60+sm)-(eh*60+em);
  }).filter(v=>v&&v>0);
  const mediaMin = tempos.length ? Math.round(tempos.reduce((a,b)=>a+b,0)/tempos.length) : 0;
  const now = new Date().toLocaleString("pt-BR");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Relatorio Transportadora — ${PROJECT_NAME} — ${periodo}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1e293b;font-size:10px}
.page{max-width:980px;margin:0 auto}
.header{background:#1e293b;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo-box{background:white;border-radius:6px;padding:5px 10px;height:46px;display:flex;align-items:center}
.logo-box img{height:34px;object-fit:contain}
.band{height:4px;background:linear-gradient(90deg,#cc2222,#991b1b)}
.content{padding:18px 24px}
.kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center}
.kpi-val{font-size:20px;font-weight:700;color:#1e293b;line-height:1}
.kpi-lbl{font-size:8px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:3px}
.stitle{font-size:11px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:.7px;border-left:3px solid #cc2222;padding-left:8px;margin:14px 0 8px}
table{width:100%;border-collapse:collapse;font-size:9px}
th{background:#1e293b;color:white;padding:7px 8px;text-align:left;font-weight:700;font-size:8.5px;white-space:nowrap}
td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
tr:nth-child(even) td{background:#f8fafc}
.badge{display:inline-block;padding:2px 7px;border-radius:4px;font-size:8px;font-weight:700}
.footer{background:#1e293b;color:#94a3b8;padding:10px 24px;display:flex;justify-content:space-between;font-size:9px;margin-top:16px}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><div class="page">
<div class="header">
  <div style="display:flex;align-items:center;gap:12px">
    <div class="logo-box"><img src="${LOGO_MOKED}" alt="Moked"/></div>
    <div style="width:1px;height:32px;background:rgba(255,255,255,.2)"></div>
    <div class="logo-box"><img src="${LOGO_JATINOX}" alt="Jatinox"/></div>
  </div>
  <div style="color:white;flex:1;text-align:center">
    <div style="font-size:15px;font-weight:700">Relatorio de Movimentacoes — Transportadora GH</div>
    <div style="font-size:10px;opacity:.8;margin-top:2px">Empresa: Jatinox | Periodo: ${periodo} | Total: ${registros.length} registros</div>
  </div>
  <div style="color:white;text-align:right;font-size:9px">
    <div style="opacity:.7">Gerado em ${now}</div>
    <div style="opacity:.6;font-size:8px;margin-top:2px">Documento interno | Jatinox</div>
  </div>
</div>
<div class="band"></div>
<div class="content">
  <div class="stitle" style="margin-top:2px">Resumo Executivo</div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-val">${registros.length}</div><div class="kpi-lbl">Total Registros</div></div>
    <div class="kpi"><div class="kpi-val">${motoristas}</div><div class="kpi-lbl">Motoristas</div></div>
    <div class="kpi"><div class="kpi-val">${datas}</div><div class="kpi-lbl">Datas</div></div>
    <div class="kpi"><div class="kpi-val" style="font-size:13px">${fmtDateBR(sorted[0]?.data)}</div><div class="kpi-lbl">Inicio</div></div>
    <div class="kpi"><div class="kpi-val" style="font-size:13px">${Math.floor(mediaMin/60)}h ${String(mediaMin%60).padStart(2,"0")}min</div><div class="kpi-lbl">T. Medio Op.</div></div>
  </div>
  <div class="stitle">Registro Detalhado</div>
  <table><thead><tr>
    <th>#</th><th>Data</th><th>Motorista</th><th>CPF / RG</th>
    <th>Placa Cavalo</th><th>Placa Carreta</th>
    <th>Chegada</th><th>Entrega NF</th><th>Entrada</th><th>Saida</th>
    <th>T. Operacao</th><th>T. Espera</th>
  </tr></thead><tbody>
  ${sorted.map((r,i)=>`
    <tr>
      <td style="color:#64748b">${i+1}</td>
      <td style="white-space:nowrap">${fmtDateBR(r.data)}</td>
      <td style="font-weight:600">${r.motorista||"--"}</td>
      <td style="font-size:8px;color:#64748b">${r.cpfRg||"--"}</td>
      <td style="font-weight:700;color:#1e40af;letter-spacing:1px">${(r.placaCavalo||"--").toUpperCase()}</td>
      <td style="font-weight:700;color:#1e40af;letter-spacing:1px">${(r.placaCarreta||"--").toUpperCase()}</td>
      <td>${r.chegada||"--"}</td>
      <td>${r.entregaNF||"--"}</td>
      <td>${r.entradaPatio||"--"}</td>
      <td>${r.saida||"--"}</td>
      <td><span class="badge" style="background:#dcfce7;color:#15803d">${calcTempo(r.entradaPatio,r.saida)}</span></td>
      <td><span class="badge" style="background:#fef9c3;color:#854d0e">${calcEspera(r.chegada,r.entradaPatio)}</span></td>
    </tr>
    ${r.obs?`<tr><td colspan="12" style="background:#fffbeb;color:#854d0e;font-style:italic;padding:4px 8px;font-size:8px">Obs: ${r.obs}</td></tr>`:""}
  `).join("")}
  </tbody></table>
  <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:6px;padding:10px 14px;margin-top:12px">
    <div style="font-size:9px;font-weight:700;color:#854d0e;margin-bottom:4px">Observacoes</div>
    <div style="font-size:9px;color:#92400e;line-height:1.8">
      • T. Operacao: tempo entre Entrada no patio e Saida.<br/>
      • T. Espera: tempo entre Chegada e Entrada no patio.<br/>
      • Relatorio gerado pelo MokLog Acesso — Moked Consulting Security.
    </div>
  </div>
</div>
<div class="footer">
  <div><span style="color:white;font-weight:700">Moked Consulting Security</span> · MokLog Acesso</div>
  <div style="text-align:right"><span style="color:white;font-weight:700">${PROJECT_ID} — ${PROJECT_NAME}</span> · ${periodo}</div>
</div>
</div></body></html>`;

  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`MokLog_Acesso_${PROJECT_NAME}_${periodo.replace(/[\s\/]/g,"_")}.html`;
  a.click(); setTimeout(()=>URL.revokeObjectURL(url),2000);
}

const S = {
  page:{minHeight:"100vh",background:"#04080f",display:"flex",justifyContent:"center",padding:"0 0 60px",fontFamily:"'Segoe UI',system-ui,sans-serif"},
  wrap:{width:"100%",maxWidth:480,padding:"20px 16px 40px",display:"flex",flexDirection:"column",gap:10},
  card:{background:"#060c18",border:"1px solid #0f172a",borderRadius:12,padding:"12px 14px"},
  btn:{background:"linear-gradient(135deg,#b91c1c,#991b1b)",color:"#fff",border:"none",borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6},
  btnBlue:{background:"linear-gradient(135deg,#1d4ed8,#1e40af)",color:"#fff",border:"none",borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:6},
  btnSec:{background:"#060c18",color:"#64748b",border:"1px solid #0f172a",borderRadius:10,padding:"13px 16px",fontSize:14,fontWeight:600,cursor:"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center"},
  backBtn:{background:"transparent",border:"1px solid #0f172a",color:"#334155",borderRadius:7,padding:"6px 10px",fontSize:11,cursor:"pointer",flexShrink:0},
  inp:{width:"100%",background:"#020510",border:"1px solid #0f172a",borderRadius:7,color:"#e2e8f0",padding:"10px 12px",fontSize:13,boxSizing:"border-box",outline:"none"},
  lbl:{display:"block",fontSize:10,color:"#334155",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:.5},
};


export default function AcessoApp({onBack}) {
  const [screen, setScreen] = useState("pin");
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [registros, setRegistros] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewReg, setViewReg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  useEffect(() => {
    if(screen === "list" || screen === "form") {
      loadRegistrosFB().then(fbRegs => {
        try {
          const local = JSON.parse(localStorage.getItem("acessos_p260a") || "[]");
          const ids = new Set(fbRegs.map(x=>x.id));
          const merged = [...fbRegs, ...local.filter(x=>!ids.has(x.id))].sort((a,b)=>(b.data||"").localeCompare(a.data||""));
          setRegistros(merged);
        } catch { setRegistros(fbRegs); }
      });
    }
  }, [screen]);

  const setF = (k,v) => setForm(f => ({...f,[k]:v}));

  const saveForm = async () => {
    if(!form.motorista.trim()) { alert("Informe o nome do motorista"); return; }
    // fotos opcionais
    setSaving(true);
    const reg = {...form, savedAt: new Date().toISOString()};
    const newList = [reg, ...registros].sort((a,b)=>(b.data||"").localeCompare(a.data||""));
    setRegistros(newList);
    try {
      const noPhotos = newList.map(({fotos,...r})=>r);
      localStorage.setItem("acessos_p260a", JSON.stringify(noPhotos));
      const withPhotos = JSON.parse(localStorage.getItem("acessos_p260a_photos")||"[]");
      withPhotos.unshift({id:reg.id, fotos:reg.fotos});
      localStorage.setItem("acessos_p260a_photos", JSON.stringify(withPhotos.slice(0,200)));
    } catch(e) {}
    await saveRegistroFB(reg);
    setSaving(false); setSaved(true);
    setTimeout(() => { setSaved(false); setForm(emptyForm()); setScreen("list"); }, 1500);
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0]; if(!file) return;
    if(file.size > 5*1024*1024) { alert("Foto muito grande. Max 5MB"); return; }
    if(form.fotos.length >= MAX_FOTOS) { alert(`Maximo ${MAX_FOTOS} fotos por registro`); return; }
    const r = new FileReader();
    r.onload = ev => setF("fotos", [...form.fotos, {url:ev.target.result, name:file.name, ts:Date.now()}]);
    r.readAsDataURL(file);
  };

  const removePhoto = (i) => setF("fotos", form.fotos.filter((_,idx)=>idx!==i));
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);
  const selectAll = () => setSelectedIds(filteredRegistros.map(r=>r.id));
  const clearSelect = () => setSelectedIds([]);

  const filteredRegistros = registros.filter(r => {
    if(filterStart && r.data < filterStart) return false;
    if(filterEnd && r.data > filterEnd) return false;
    return true;
  });
  const selectedRegistros = registros.filter(r => selectedIds.includes(r.id));

  const getPhotos = (id) => {
    try {
      const all = JSON.parse(localStorage.getItem("acessos_p260a_photos")||"[]");
      return all.find(x=>x.id===id)?.fotos || [];
    } catch { return []; }
  };

  // PIN
  if(screen === "pin") return (
    <div style={{...S.page, alignItems:"center", justifyContent:"center"}}>
      <div style={{background:"#060c18",border:"1px solid #1e293b",borderRadius:16,padding:"32px 28px",maxWidth:320,width:"100%",textAlign:"center",margin:16}}>
        <img src={LOGO_JATINOX} alt="Jatinox" style={{height:46,objectFit:"contain",marginBottom:12,background:"white",padding:"4px 8px",borderRadius:6}}/>
        <div style={{fontSize:16,fontWeight:800,color:"#f1f5f9",marginBottom:2}}>MokLog <span style={{color:"#cc2222"}}>Acesso</span></div>
        <div style={{fontSize:12,color:"#94a3b8",marginBottom:4}}>{PROJECT_ID} — {PROJECT_NAME}</div>
        <div style={{fontSize:11,color:"#475569",marginBottom:20}}>Controle de Transportadora</div>
        <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pin}
          onChange={e=>{setPin(e.target.value);setPinErr(false);}}
          onKeyDown={e=>{if(e.key==="Enter"){if(pin===ACESSO_PIN)setScreen("list");else setPinErr(true);}}}
          style={{...S.inp,textAlign:"center",fontSize:22,letterSpacing:10,marginBottom:10}}/>
        {pinErr&&<div style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
        <button onClick={()=>{if(pin===ACESSO_PIN)setScreen("list");else setPinErr(true);}} style={{...S.btn,marginBottom:10}}>Entrar</button>
        <button onClick={onBack} style={S.btnSec}>← Voltar</button>
      </div>
    </div>
  );

  // FORM
  if(screen === "form") return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #0f172a"}}>
          <button onClick={()=>setScreen("list")} style={S.backBtn}>← Voltar</button>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>Novo Registro</div>
            <div style={{fontSize:11,color:"#334155"}}>{PROJECT_ID} — {PROJECT_NAME}</div>
          </div>
        </div>

        {saved&&<div style={{background:"#021a0d",border:"1px solid #22c55e",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>✅</span>
          <span style={{fontSize:13,fontWeight:700,color:"#22c55e"}}>Registro salvo com sucesso!</span>
        </div>}

        <div style={S.card}>
          <div style={{fontSize:11,color:"#cc2222",fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Informacoes da Visita</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label style={S.lbl}>Data</label><input type="date" value={form.data} onChange={e=>setF("data",e.target.value)} style={S.inp}/></div>
            <div><label style={S.lbl}>Chegada</label><input type="time" value={form.chegada} onChange={e=>setF("chegada",e.target.value)} style={S.inp}/></div>
            <div><label style={S.lbl}>Entrega NF</label><input type="time" value={form.entregaNF} onChange={e=>setF("entregaNF",e.target.value)} style={S.inp}/></div>
            <div><label style={S.lbl}>Entrada Patio</label><input type="time" value={form.entradaPatio} onChange={e=>setF("entradaPatio",e.target.value)} style={S.inp}/></div>
            <div><label style={S.lbl}>Saida</label><input type="time" value={form.saida} onChange={e=>setF("saida",e.target.value)} style={S.inp}/></div>
            <div><label style={S.lbl}>T. Operacao</label>
              <div style={{...S.inp,color:calcTempo(form.entradaPatio,form.saida)!=="--"?"#22c55e":"#475569",fontWeight:600}}>
                {calcTempo(form.entradaPatio,form.saida)}
              </div>
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={{fontSize:11,color:"#cc2222",fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Motorista</div>
          <div style={{marginBottom:8}}><label style={S.lbl}>Nome Completo</label><input placeholder="Nome do motorista..." value={form.motorista} onChange={e=>setF("motorista",e.target.value)} style={S.inp}/></div>
          <div style={{marginBottom:8}}><label style={S.lbl}>CPF / RG</label><input placeholder="000.000.000-00" value={form.cpfRg} onChange={e=>setF("cpfRg",e.target.value)} style={S.inp}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><label style={S.lbl}>Placa Cavalo</label><input placeholder="AAA-0000" value={form.placaCavalo} onChange={e=>setF("placaCavalo",e.target.value.toUpperCase())} style={{...S.inp,textTransform:"uppercase",fontWeight:700,letterSpacing:2}}/></div>
            <div><label style={S.lbl}>Placa Carreta</label><input placeholder="AAA-0000" value={form.placaCarreta} onChange={e=>setF("placaCarreta",e.target.value.toUpperCase())} style={{...S.inp,textTransform:"uppercase",fontWeight:700,letterSpacing:2}}/></div>
          </div>
        </div>

        <div style={{...S.card,border:"1px solid #0f172a"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:11,color:"#cc2222",fontWeight:800,textTransform:"uppercase",letterSpacing:.8}}>Fotos</div>
            <span style={{fontSize:13,fontWeight:700,color:form.fotos.length>=MAX_FOTOS?"#22c55e":"#f59e0b"}}>{form.fotos.length}/{MAX_FOTOS}</span>
          </div>
          {form.fotos.length>0&&(
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
              {form.fotos.map((p,i)=>(
                <div key={i} style={{position:"relative"}}>
                  <img src={p.url} alt="" style={{width:82,height:62,objectFit:"cover",borderRadius:6,border:"1px solid #1e3a5f"}}/>
                  <button onClick={()=>removePhoto(i)} style={{position:"absolute",top:-4,right:-4,background:"#ef4444",border:"none",borderRadius:"50%",width:18,height:18,fontSize:11,color:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
                </div>
              ))}
            </div>
          )}
          {form.fotos.length<MAX_FOTOS&&(
            <label style={{display:"flex",alignItems:"center",gap:10,background:"#020510",border:"1px dashed #0f172a",borderRadius:8,padding:"10px 14px",cursor:"pointer"}}>
              <span style={{fontSize:22}}>📷</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#0ea5e9"}}>Adicionar Foto ({form.fotos.length}/{MAX_FOTOS})</div>
                <div style={{fontSize:11,color:"#64748b"}}>Camera ou galeria · Max 5MB</div>
              </div>
              <input type="file" accept="image/*" style={{position:"absolute",opacity:0,width:0,height:0}} onChange={handlePhoto}/>
            </label>
          )}
          <div style={{fontSize:10,color:"#64748b",marginTop:6,textAlign:"center"}}>Fotos opcionais — camera ou galeria</div>
        </div>

        <div style={S.card}>
          <label style={S.lbl}>Observacoes</label>
          <textarea placeholder="Observacoes gerais..." value={form.obs} onChange={e=>setF("obs",e.target.value)}
            style={{...S.inp,height:64,resize:"vertical",fontSize:12}}/>
        </div>

        <button onClick={saveForm} disabled={saving} style={{...S.btn,opacity:saving?0.7:1}}>
          {saving?"⟳ Salvando...":"✓ Salvar Registro"}
        </button>
        <button onClick={()=>setScreen("list")} style={S.btnSec}>Cancelar</button>
      </div>
    </div>
  );

  // DETAIL
  if(screen==="detail"&&viewReg) {
    const fotos = getPhotos(viewReg.id);
    return (
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #0f172a"}}>
            <button onClick={()=>{setViewReg(null);setScreen("list");}} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:"#f1f5f9"}}>{viewReg.motorista||"--"}</div>
              <div style={{fontSize:11,color:"#334155"}}>{fmtDateBR(viewReg.data)}</div>
            </div>
          </div>
          <div style={S.card}>
            {[
              ["Data",fmtDateBR(viewReg.data)],["Motorista",viewReg.motorista],
              ["CPF / RG",viewReg.cpfRg],["Placa Cavalo",viewReg.placaCavalo],
              ["Placa Carreta",viewReg.placaCarreta],["Chegada",viewReg.chegada],
              ["Entrega NF",viewReg.entregaNF],["Entrada Patio",viewReg.entradaPatio],
              ["Saida",viewReg.saida],
              ["T. Operacao",calcTempo(viewReg.entradaPatio,viewReg.saida)],
              ["T. Espera",calcEspera(viewReg.chegada,viewReg.entradaPatio)],
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #0a0f1e"}}>
                <span style={{fontSize:11,color:"#64748b"}}>{k}</span>
                <span style={{fontSize:11,color:"#f1f5f9",fontWeight:600}}>{v||"--"}</span>
              </div>
            ))}
            {viewReg.obs&&<div style={{marginTop:8,fontSize:11,color:"#f59e0b",fontStyle:"italic"}}>Obs: {viewReg.obs}</div>}
          </div>
          {fotos.length>0&&(
            <div style={S.card}>
              <div style={{fontSize:11,color:"#cc2222",fontWeight:700,marginBottom:8}}>Fotos ({fotos.length})</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {fotos.map((p,i)=><img key={i} src={p.url} alt="" style={{width:90,height:68,objectFit:"cover",borderRadius:6,border:"1px solid #1e3a5f"}}/>)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // LIST
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{display:"flex",alignItems:"center",gap:8,paddingBottom:10,borderBottom:"1px solid #0f172a"}}>
          <button onClick={onBack} style={S.backBtn}>← Inicio</button>
          <img src={LOGO_JATINOX} alt="" style={{height:26,objectFit:"contain",background:"white",padding:"2px 6px",borderRadius:4}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9"}}>MokLog <span style={{color:"#cc2222"}}>Acesso</span></div>
            <div style={{fontSize:10,color:"#334155"}}>{PROJECT_ID} · {PROJECT_NAME} · {registros.length} registros</div>
          </div>
          <button onClick={()=>setScreen("form")} style={{...S.btn,width:"auto",padding:"8px 14px",fontSize:12}}>+ Novo</button>
        </div>

        <div style={{...S.card,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:10,color:"#334155",fontWeight:700,flexShrink:0}}>PERÍODO</span>
          <input type="date" value={filterStart} onChange={e=>setFilterStart(e.target.value)} style={{...S.inp,flex:1,minWidth:120,fontSize:11}}/>
          <span style={{fontSize:10,color:"#334155"}}>até</span>
          <input type="date" value={filterEnd} onChange={e=>setFilterEnd(e.target.value)} style={{...S.inp,flex:1,minWidth:120,fontSize:11}}/>
          {(filterStart||filterEnd)&&<button onClick={()=>{setFilterStart("");setFilterEnd("");}} style={{...S.btnSec,width:"auto",padding:"6px 10px",fontSize:11}}>✕</button>}
        </div>

        {selectedIds.length>0&&(
          <div style={{background:"#021a0d",border:"1px solid #22c55e44",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:12,color:"#22c55e",fontWeight:700}}>{selectedIds.length} selecionado(s)</span>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>generateRelatorio(selectedRegistros)} style={{...S.btn,width:"auto",padding:"8px 14px",fontSize:12}}>📄 Gerar PDF</button>
              <button onClick={clearSelect} style={{...S.btnSec,width:"auto",padding:"8px 12px",fontSize:12}}>✕</button>
            </div>
          </div>
        )}

        {filteredRegistros.length===0&&(
          <div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{fontSize:32,marginBottom:8}}>📋</div>
            <div style={{fontSize:14,color:"#f1f5f9",marginBottom:4}}>Nenhum registro ainda</div>
            <div style={{fontSize:12,color:"#475569"}}>Toque em "+ Novo" para registrar</div>
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {filteredRegistros.map(r=>{
            const isSel=selectedIds.includes(r.id);
            return(
              <div key={r.id} style={{background:"#060c18",border:`2px solid ${isSel?"#cc2222":"#0f172a"}`,borderRadius:12,padding:"12px 14px",cursor:"pointer"}}
                onClick={()=>toggleSelect(r.id)}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:28,height:28,borderRadius:6,border:`2px solid ${isSel?"#cc2222":"#1e293b"}`,background:isSel?"#cc222222":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:isSel?"#cc2222":"#334155",flexShrink:0}}>
                    {isSel?"✓":""}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{r.motorista||"--"}</div>
                    <div style={{fontSize:11,color:"#475569"}}>{fmtDateBR(r.data)}{r.placaCavalo?` · ${r.placaCavalo}`:""}{r.placaCarreta?` / ${r.placaCarreta}`:""}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{r.entradaPatio?`Entrada: ${r.entradaPatio} `:""}{r.saida?`· Saida: ${r.saida}`:""}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#22c55e"}}>{calcTempo(r.entradaPatio,r.saida)}</div>
                    <div style={{fontSize:10,color:"#334155"}}>operacao</div>
                    <button onClick={e=>{e.stopPropagation();setViewReg(r);setScreen("detail");}}
                      style={{background:"transparent",border:"none",color:"#64748b",fontSize:10,cursor:"pointer",marginTop:2}}>ver →</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredRegistros.length>1&&selectedIds.length===0&&(
          <button onClick={selectAll} style={{...S.btnSec,fontSize:12}}>☑ Selecionar todos ({filteredRegistros.length})</button>
        )}

        {filteredRegistros.length>0&&selectedIds.length===0&&(
          <div style={{background:"#060c18",border:"1px solid #0f172a",borderRadius:10,padding:"10px",textAlign:"center"}}>
            <div style={{fontSize:11,color:"#64748b"}}>Toque nos registros para selecionar · Gere o PDF quando quiser</div>
          </div>
        )}
      </div>
    </div>
  );
}
