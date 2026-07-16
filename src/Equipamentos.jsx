import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { setDoc } from "./fireGuard";

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

import { getAccess, grantSession, clearSession } from "./session";
import { daysSince, DiasAberto } from "./pendencias";

const ADMIN_PIN = "872101";
const PROJECT_PINS = {
  P601:"16601",P602:"16602",P604:"16604",P605:"16605",
  P606:"16606",P607:"16607",P311A:"16311",P311B:"16311",
  P505:"16505",P260A:"162601",P260B:"162602",P260C:"162603"
};

// Projetos com equipamentos especiais
const TEM_ZTRAX    = ["P311A","P311B"];
const TEM_BODYCAM  = ["P311A","P311B"];

const STATUS_CONFIG = {
  ok:      { label:"OK",         color:"#22c55e", bg:"#021a0d", border:"#22c55e33" },
  parcial: { label:"Parcial",    color:"#f59e0b", bg:"#1a1000", border:"#f59e0b33" },
  inop:    { label:"Inoperante", color:"#ef4444", bg:"#1a0202", border:"#ef444433" },
  baixo:   { label:"Baixo",      color:"#f59e0b", bg:"#1a1000", border:"#f59e0b33" },
  critico: { label:"Crítico",    color:"#ef4444", bg:"#1a0202", border:"#ef444433" },
};

function todayStr() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d) {
  if(!d) return "--";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
}
// daysSince agora vem de ./pendencias (fonte canônica de idade de pendências)

async function loadEquip(projectId) {
  try {
    const snap = await getDoc(doc(db,"equipamentos",projectId));
    if(snap.exists()) {
      const data = snap.data();
      try { localStorage.setItem(`equipamentos_${projectId}`, JSON.stringify(data)); } catch(e){}
      return data;
    }
  } catch(e){}
  try {
    const local = localStorage.getItem(`equipamentos_${projectId}`);
    if(local) return JSON.parse(local);
  } catch(e){}
  return { smartphones:[], radiosHT:[], armamento:[], municao:[], placas:[], lanternas:[], moto:null, ztrax:[], bodycam:[] };
}

async function saveEquip(projectId, data) {
  try { await setDoc(doc(db,"equipamentos",projectId), data); } catch(e){ console.error(e); }
  try { localStorage.setItem(`equipamentos_${projectId}`, JSON.stringify(data)); } catch(e){}
}

function getStyles(dark) {
  return {
    page:    { minHeight:"100vh", background:dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 80px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:480, display:"flex", flexDirection:"column" },
    card:    { background:dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"14px 16px" },
    btn:     { background:"linear-gradient(135deg,#1d4ed8,#1e40af)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnSec:  { background:dark?"#060c18":"#f8fafc", color:dark?"#64748b":"#475569", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
    btnSm:   { background:dark?"#020510":"#f8fafc", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#64748b":"#475569", borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:600 },
    backBtn: { background:"transparent", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#94a3b8":"#64748b", borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 },
    inp:     { width:"100%", background:dark?"#020510":"#ffffff", border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`, borderRadius:7, color:dark?"#e2e8f0":"#1e293b", padding:"10px 12px", fontSize:13, boxSizing:"border-box", outline:"none" },
    lbl:     { display:"block", fontSize:10, color:dark?"#94a3b8":"#64748b", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 },
    hdrBg:   { background:dark?"#04080f":"#f8fafc", borderBottom:`1px solid ${dark?"#0a0f1e":"#e2e8f0"}` },
    txt:     { color:dark?"#f1f5f9":"#0f172a" },
    txt2:    { color:dark?"#94a3b8":"#64748b" },
  };
}

// ── Status Badge
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ok;
  return (
    <span style={{ fontSize:10, fontWeight:700, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.border}`, padding:"2px 8px", borderRadius:5 }}>
      {cfg.label}
    </span>
  );
}

// DiasAberto agora vem de ./pendencias (escala unificada: cinza ≤2 · amarelo 3–5 · vermelho 6+)

// ── Status Selector + Justificativa
function StatusSelector({ value, onChange, tipos, dark }) {
  const S = getStyles(dark);
  const [showJust, setShowJust] = useState(false);
  const [just, setJust] = useState("");
  const [data, setData] = useState(todayStr());

  const tiposList = tipos || ["ok","parcial","inop"];

  const handleSelect = (status) => {
    if(status === "ok") {
      onChange({ status, justificativa:"", dataProblem:"" });
    } else {
      setShowJust(true);
    }
    onChange({ status });
  };

  const confirmJust = (status) => {
    onChange({ status, justificativa:just, dataProblem:data });
    setShowJust(false);
    setJust("");
  };

  return (
    <div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {tiposList.map(s => {
          const cfg = STATUS_CONFIG[s];
          const isSel = value?.status === s;
          return (
            <button key={s} onClick={()=>handleSelect(s)}
              style={{ background:isSel?cfg.bg:"transparent", border:`2px solid ${isSel?cfg.color:dark?"#0f172a":"#e2e8f0"}`, color:isSel?cfg.color:dark?"#94a3b8":"#94a3b8", borderRadius:7, padding:"6px 12px", fontSize:11, cursor:"pointer", fontWeight:isSel?700:400 }}>
              {cfg.label}
            </button>
          );
        })}
      </div>
      {showJust && (
        <div style={{ background:dark?"#1a0202":"#fff5f5", border:"1px solid #ef444433", borderRadius:8, padding:"10px 12px", marginTop:8 }}>
          <div style={{ fontSize:11, color:"#ef4444", fontWeight:700, marginBottom:8 }}>⚠️ Justificativa obrigatória</div>
          <div style={{ marginBottom:8 }}>
            <label style={S.lbl}>Data da ocorrência</label>
            <input type="date" value={data} onChange={e=>setData(e.target.value)} style={S.inp}/>
          </div>
          <div style={{ marginBottom:8 }}>
            <label style={S.lbl}>Justificativa</label>
            <textarea value={just} onChange={e=>setJust(e.target.value)} placeholder="Descreva o problema..." style={{...S.inp,height:60,resize:"vertical",fontSize:12}}/>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setShowJust(false)} style={{...S.btnSec,flex:1,fontSize:12}}>Cancelar</button>
            <button onClick={()=>confirmJust(value?.status)}
              style={{...S.btn,flex:1,fontSize:12,background:"linear-gradient(135deg,#ef4444,#dc2626)"}}>
              ✓ Confirmar e Enviar WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Item Card genérico
function ItemCard({ item, icon, title, children, onRemove, adminAuth, dark, problema }) {
  const S = getStyles(dark);
  const [open, setOpen] = useState(false);
  const hasProblema = item.status && item.status !== "ok";

  return (
    <div style={{ background:dark?"#060c18":"#ffffff", border:`2px solid ${hasProblema?(STATUS_CONFIG[item.status]?.border||"#ef444433"):dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, overflow:"hidden", marginBottom:6 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", cursor:"pointer" }} onClick={()=>setOpen(!open)}>
        <span style={{ fontSize:22, flexShrink:0 }}>{icon}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:700, ...S.txt }}>{title}</div>
          <div style={{ display:"flex", gap:6, marginTop:3, flexWrap:"wrap", alignItems:"center" }}>
            <StatusBadge status={item.status||"ok"}/>
            {hasProblema && <DiasAberto dataProblem={item.dataProblem}/>}
          </div>
        </div>
        <span style={{ color:dark?"#334155":"#94a3b8", fontSize:12 }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ padding:"0 12px 12px", borderTop:`1px solid ${dark?"#0f172a":"#f1f5f9"}` }}>
          <div style={{ paddingTop:10 }}>{children}</div>
          {hasProblema && item.justificativa && (
            <div style={{ background:dark?"#1a0202":"#fff5f5", border:"1px solid #ef444433", borderRadius:8, padding:"8px 12px", marginTop:8 }}>
              <div style={{ fontSize:10, color:"#ef4444", fontWeight:700, marginBottom:3 }}>⚠️ {fmtDate(item.dataProblem)}</div>
              <div style={{ fontSize:11, ...S.txt }}>{item.justificativa}</div>
            </div>
          )}
          {adminAuth && onRemove && (
            <button onClick={()=>{ if(window.confirm("Excluir este item?")) onRemove(); }}
              style={{ ...S.btnSm, color:"#ef4444", border:"1px solid #ef444433", fontSize:10, marginTop:8 }}>
              🗑 Excluir Item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Enviar WhatsApp
function enviarWhatsApp(project, tipo, nome, status, justificativa, data) {
  const statusLabel = STATUS_CONFIG[status]?.label || status;
  const icon = status==="inop"?"🔴":"⚠️";
  const msg = encodeURIComponent(
    `${icon} *[${project.id}] Equipamento com problema*\n` +
    `📍 ${project.name}\n` +
    `🛡️ ${tipo}: ${nome} — *${statusLabel.toUpperCase()}*\n` +
    `📝 ${justificativa}\n` +
    `📅 ${fmtDate(data)}\n` +
    `⏳ Aguardando resolução\n\n` +
    `_MokLog CheckTest © Moked Security_`
  );
  window.open(`https://wa.me/?text=${msg}`, "_blank");
}


// ── Gerar PDF completo de equipamentos por projeto
function gerarPDFEquipamentos(project, data, segLogos) {
  const seg = segLogos || {};
  const hoje = new Date().toLocaleDateString("pt-BR");
  const fmtD = (d) => { if(!d) return "--"; try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; } };
  const statusLabel = (s) => ({ ok:"OK", parcial:"Parcial", inop:"Inoperante", baixo:"Baixo", critico:"Crítico" }[s] || "OK");
  const statusColor = (s) => ({ ok:"#15803d", parcial:"#d97706", inop:"#dc2626", baixo:"#d97706", critico:"#dc2626" }[s] || "#15803d");
  const statusBg    = (s) => ({ ok:"#dcfce7", parcial:"#fef3c7", inop:"#fee2e2", baixo:"#fef3c7", critico:"#fee2e2" }[s] || "#dcfce7");

  const itemRow = (item, extra="") => {
    const hasProb = item.status && item.status !== "ok";
    const dias = hasProb && item.dataProblem ? Math.floor((Date.now()-new Date(item.dataProblem+"T12:00:00").getTime())/86400000) : 0;
    return `<tr style="background:${hasProb?"#fff5f5":"#fff"}">
      <td>${item.identificacao||"--"}</td>
      ${extra}
      <td><span style="background:${statusBg(item.status||"ok")};color:${statusColor(item.status||"ok")};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">${statusLabel(item.status||"ok")}</span></td>
      <td>${hasProb?`<span style="color:#dc2626;font-weight:700">${dias}d em aberto</span>${item.justificativa?`<br><span style="font-size:10px;color:#64748b">${item.justificativa}</span>`:""}` : "—"}</td>
    </tr>`;
  };

  const section = (titulo, icon, headers, rows) => {
    if(!rows.length) return "";
    const hasProb = rows.some(r=>r.status&&r.status!=="ok");
    return `<div class="card">
      <h2>${icon} ${titulo} <span style="font-size:12px;font-weight:400;color:#64748b">(${rows.length} item${rows.length>1?"s":""})</span>
        ${hasProb?`<span style="background:#fee2e2;color:#dc2626;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin-left:8px">⚠️ COM PROBLEMA</span>`:""}
      </h2>
      <table><thead><tr>${["Identificação",...headers,"Status","Observação"].map(h=>`<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r=>itemRow(r,headers.map(h=>{
        if(h==="Modelo") return `<td>${r.modelo||"--"}</td>`;
        if(h==="Marca") return `<td>${r.marca||"--"}</td>`;
        if(h==="Calibre") return `<td>${r.calibre||"--"}</td>`;
        if(h==="Nº Série") return `<td>${r.nSerie||"--"}</td>`;
        if(h==="Validade") return `<td style="color:${r.validade&&new Date(r.validade)<new Date()?"#dc2626":"#15803d"}">${fmtD(r.validade)}</td>`;
        if(h==="Quantidade") return `<td><strong>${r.qtd||0}</strong></td>`;
        if(h==="Armeiro") return `<td>${r.armeiro||"--"}</td>`;
        if(h==="Últ. Manutenção") return `<td>${fmtD(r.dataManutencao)}</td>`;
        return `<td>--</td>`;
      }).join(""))).join("")}</tbody></table>
    </div>`;
  };

  const moto = data.moto;
  const motoSection = moto && moto.placa ? `<div class="card">
    <h2>🏍️ Motocicleta</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">
      ${[["Placa",moto.placa],["Modelo",moto.modelo||"--"],["Ano",moto.ano||"--"],["KM Atual",moto.km?`${moto.km} km`:"--"],["KM Manutenção",moto.kmManutencao?`${moto.kmManutencao} km`:"--"],["Próx. Revisão",moto.proximaRevisao?fmtD(moto.proximaRevisao):"--"]].map(([l,v])=>`
        <div><div style="font-size:10px;color:#94a3b8;font-weight:700">${l}</div><div style="font-weight:700;color:${l==="KM Atual"&&moto.kmManutencao&&Number(moto.km)>=Number(moto.kmManutencao)?"#dc2626":"#0f172a"}">${v}</div></div>`).join("")}
    </div>
    ${moto.km&&moto.kmManutencao&&Number(moto.km)>=Number(moto.kmManutencao)?'<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:8px 12px;color:#dc2626;font-size:12px;font-weight:700">🔴 KM de manutenção atingido!</div>':""}
    ${(moto.historico||[]).length>0?`<div style="margin-top:10px"><strong style="font-size:12px">Histórico manutenção:</strong><table style="margin-top:6px"><thead><tr><th>Data</th><th>KM</th><th>Descrição</th></tr></thead><tbody>${(moto.historico||[]).slice(0,5).map(h=>`<tr><td>${fmtD(h.data)}</td><td>${h.km||"--"} km</td><td>${h.desc||"--"}</td></tr>`).join("")}</tbody></table></div>`:""}
  </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Equipamentos — ${project.id}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px;color:#1e293b;margin:0}
  .header{background:linear-gradient(135deg,#1a1040,#0f0820);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
  .kpi{background:#fff;border-radius:10px;padding:12px;text-align:center;border:1px solid #e2e8f0}
  .kpi-val{font-size:24px;font-weight:900}
  .kpi-lbl{font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:2px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px}
  .card h2{margin:0 0 12px;font-size:13px;color:#475569;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #f1f5f9;padding-bottom:8px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#1e293b;color:#fff;padding:7px 10px;text-align:left;font-size:11px}
  td{padding:7px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  .footer{text-align:center;font-size:10px;color:#94a3b8;margin-top:16px}
  @media print{body{padding:8px}@page{margin:12mm}}
</style></head><body>
<div style="text-align:center;margin-bottom:16px">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="header">
  <div>
    <div style="font-size:11px;opacity:.7;text-transform:uppercase">Moked Consulting Security</div>
    <div style="font-size:20px;font-weight:900">Inventário de Equipamentos</div>
    <div style="font-size:13px;opacity:.8">${project.id} — ${project.name||""}</div>
  </div>
  ${seg.logo?`<img src="${seg.logo}" style="height:52px;max-width:120px;object-fit:contain" alt="${seg.empresa||""}"/>`:""}
</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-val" style="color:#ef4444">${[...(data.smartphones||[]),...(data.radiosHT||[]),...(data.armamento||[]),...(data.municao||[]),...(data.placas||[]),...(data.lanternas||[]),...(data.ztrax||[]),...(data.bodycam||[]),...(data.moto?[data.moto]:[])].filter(i=>i.status==="inop"||i.status==="critico").length}</div><div class="kpi-lbl">Inop/Crítico</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#d97706">${[...(data.smartphones||[]),...(data.radiosHT||[]),...(data.armamento||[]),...(data.municao||[]),...(data.placas||[]),...(data.lanternas||[]),...(data.ztrax||[]),...(data.bodycam||[]),...(data.moto?[data.moto]:[])].filter(i=>i.status==="parcial"||i.status==="baixo").length}</div><div class="kpi-lbl">Parcial</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#15803d">${[...(data.smartphones||[]),...(data.radiosHT||[]),...(data.armamento||[]),...(data.municao||[]),...(data.placas||[]),...(data.lanternas||[]),...(data.ztrax||[]),...(data.bodycam||[]),...(data.moto?[data.moto]:[])].filter(i=>!i.status||i.status==="ok").length}</div><div class="kpi-lbl">OK</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#0ea5e9">${[...(data.smartphones||[]),...(data.radiosHT||[]),...(data.armamento||[]),...(data.municao||[]),...(data.placas||[]),...(data.lanternas||[]),...(data.ztrax||[]),...(data.bodycam||[]),...(data.moto?[data.moto]:[])].length}</div><div class="kpi-lbl">Total</div></div>
</div>
${section("Smartphones","📱",[],[...data.smartphones||[]])}
${section("Rádios HT","📻",["Marca"],  [...data.radiosHT||[]])}
${section("Armamento","🔫",["Calibre","Nº Série","Armeiro","Últ. Manutenção"],[...data.armamento||[]])}
${section("Munição","💊",["Quantidade"],[...data.municao||[]])}
${section("Placas Balísticas","🦺",["Nº Série","Validade"],[...data.placas||[]])}
${section("Lanternas","🔦",[],[...data.lanternas||[]])}
${(data.ztrax||[]).length?section("Pânico ZTRAX","🚨",[],[...data.ztrax]):""}
${(data.bodycam||[]).length?section("Bodycam","📹",[],[...data.bodycam]):""}
${motoSection}
<div class="footer">MokLog CheckTest © Moked Consulting Security · ${project.id} · Emitido em ${hoje}</div>
</body></html>`;

  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`equipamentos_${project.id}_${new Date().toISOString().split("T")[0]}.html`;
  a.click(); URL.revokeObjectURL(url);
}

// ── PIN Gate
function PinGate({ project, onSuccess, onBack, dark }) {
  const S = getStyles(dark);
  const [mode, setMode] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);

  const tryPin = () => {
    if(pin==="601604"){ grantSession("demo"); onSuccess("admin"); return; } // PIN GAL demo
    if(pin===ADMIN_PIN){ onSuccess("admin"); return; }
    if(pin===PROJECT_PINS[project.id]){ onSuccess("lider"); return; }
    setErr(true);
  };

  return (
    <div style={{...S.page, alignItems:"center", justifyContent:"center"}}>
      <div style={{...S.card, maxWidth:320, width:"100%", margin:16, textAlign:"center"}}>
        <div style={{fontSize:32, marginBottom:8}}>🛡️</div>
        <div style={{fontSize:16, fontWeight:800, ...S.txt, marginBottom:4}}>Equipamentos</div>
        <div style={{fontSize:12, ...S.txt2, marginBottom:20}}>{project.id} · {project.name}</div>
        {!mode ? (
          <div style={{display:"flex", flexDirection:"column", gap:8}}>
            <button onClick={()=>setMode("lider")} style={{...S.btn, background:"linear-gradient(135deg,#0369a1,#0c4a6e)", fontSize:13}}>👷 Acesso Líder</button>
            <button onClick={()=>setMode("admin")} style={{...S.btnSec, fontSize:13, color:"#f59e0b", borderColor:"#f59e0b33"}}>🔐 Acesso Gerencial</button>
            <button onClick={onBack} style={{...S.btnSec, fontSize:13, marginTop:4}}>← Voltar</button>
          </div>
        ) : (
          <>
            <div style={{fontSize:12,...S.txt2,marginBottom:12}}>{mode==="lider"?"PIN do projeto":"PIN gerencial"}</div>
            <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8} value={pin}
              onChange={e=>{setPin(e.target.value);setErr(false);}}
              onKeyDown={e=>{if(e.key==="Enter") tryPin();}}
              style={{...S.inp, textAlign:"center", fontSize:22, letterSpacing:10, marginBottom:8}}/>
            {err && <div style={{fontSize:12, color:"#ef4444", marginBottom:8}}>PIN incorreto</div>}
            <div style={{display:"flex", gap:8}}>
              <button onClick={()=>{setMode(null);setPin("");setErr(false);}} style={{...S.btnSec,flex:1,fontSize:13}}>← Voltar</button>
              <button onClick={tryPin} style={{...S.btn,flex:1,fontSize:13}}>Entrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Formulário de novo item genérico
function NovoItemForm({ tipo, project, onSave, onCancel, dark }) {
  const S = getStyles(dark);
  const [f, setF] = useState({
    id: Date.now().toString()+Math.random().toString(36).substring(2,5),
    status:"ok", justificativa:"", dataProblem:"", historico:[],
    // Campos específicos
    identificacao:"", modelo:"", marca:"",
    calibre:".38", nSerie:"", qtd:1,
    validade:"", placa:"", km:"", proximaRevisao:"",
    bateria:"ok", carregador:"ok",
  });
  const upd = (k,v) => setF(p=>({...p,[k]:v}));

  const renderFields = () => {
    switch(tipo) {
      case "smartphones": return (
        <>
          <div><label style={S.lbl}>Identificação (ex: Smartphone 01)</label><input value={f.identificacao} onChange={e=>upd("identificacao",e.target.value)} placeholder="Smartphone 01" style={S.inp}/></div>
          <div><label style={S.lbl}>Modelo</label><input value={f.modelo} onChange={e=>upd("modelo",e.target.value)} placeholder="Ex: Samsung A15..." style={S.inp}/></div>
        </>
      );
      case "radiosHT": return (
        <>
          <div><label style={S.lbl}>Identificação (ex: Rádio 01)</label><input value={f.identificacao} onChange={e=>upd("identificacao",e.target.value)} placeholder="Rádio 01" style={S.inp}/></div>
          <div><label style={S.lbl}>Marca</label><input value={f.marca} onChange={e=>upd("marca",e.target.value)} placeholder="Ex: Motorola..." style={S.inp}/></div>
          <div><label style={S.lbl}>Modelo</label><input value={f.modelo} onChange={e=>upd("modelo",e.target.value)} placeholder="Ex: DEP550..." style={S.inp}/></div>
          <div><label style={S.lbl}>Quantidade</label><input type="number" min="1" value={f.qtd} onChange={e=>upd("qtd",parseInt(e.target.value)||1)} style={S.inp}/></div>
        </>
      );
      case "armamento": return (
        <>
          <div><label style={S.lbl}>Identificação (ex: Arma 01)</label><input value={f.identificacao} onChange={e=>upd("identificacao",e.target.value)} placeholder="Arma 01" style={S.inp}/></div>
          <div>
            <label style={S.lbl}>Calibre</label>
            <div style={{display:"flex",gap:6}}>
              {[".38",".380","Outro"].map(c=>(
                <button key={c} onClick={()=>upd("calibre",c)}
                  style={{...S.btnSm,flex:1,padding:"8px",color:f.calibre===c?"#0ea5e9":dark?"#94a3b8":"#94a3b8",border:`1px solid ${f.calibre===c?"#0ea5e944":dark?"#0f172a":"#e2e8f0"}`,background:f.calibre===c?dark?"#001a2e":"#e0f2fe":"transparent"}}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div><label style={S.lbl}>Nº de Série *</label><input value={f.nSerie} onChange={e=>upd("nSerie",e.target.value)} placeholder="Número de série..." style={S.inp}/></div>
        </>
      );
      case "municao": return (
        <>
          <div><label style={S.lbl}>Tipo / Calibre</label><input value={f.identificacao} onChange={e=>upd("identificacao",e.target.value)} placeholder="Ex: .38 / .380..." style={S.inp}/></div>
          <div><label style={S.lbl}>Quantidade inicial</label><input type="number" min="0" value={f.qtd} onChange={e=>upd("qtd",parseInt(e.target.value)||0)} style={S.inp}/></div>
        </>
      );
      case "placas": return (
        <>
          <div><label style={S.lbl}>Identificação (ex: Colete 01)</label><input value={f.identificacao} onChange={e=>upd("identificacao",e.target.value)} placeholder="Colete 01" style={S.inp}/></div>
          <div><label style={S.lbl}>Nº de Série *</label><input value={f.nSerie} onChange={e=>upd("nSerie",e.target.value)} placeholder="Número de série..." style={S.inp}/></div>
          <div><label style={S.lbl}>Validade</label><input type="date" value={f.validade} onChange={e=>upd("validade",e.target.value)} style={S.inp}/></div>
        </>
      );
      case "lanternas": return (
        <div><label style={S.lbl}>Identificação (ex: Lanterna 01)</label><input value={f.identificacao} onChange={e=>upd("identificacao",e.target.value)} placeholder="Lanterna 01" style={S.inp}/></div>
      );
      case "ztrax": return (
        <div><label style={S.lbl}>Identificação (ex: ZTRAX 01)</label><input value={f.identificacao} onChange={e=>upd("identificacao",e.target.value)} placeholder="ZTRAX 01" style={S.inp}/></div>
      );
      case "bodycam": return (
        <div><label style={S.lbl}>Identificação (ex: Bodycam 01)</label><input value={f.identificacao} onChange={e=>upd("identificacao",e.target.value)} placeholder="Bodycam 01" style={S.inp}/></div>
      );
      default: return null;
    }
  };

  return (
    <div style={{...S.card, display:"flex", flexDirection:"column", gap:10}}>
      <div style={{fontSize:13,fontWeight:700,...S.txt,marginBottom:4}}>+ Novo Item</div>
      {renderFields()}
      <div style={{display:"flex",gap:8,marginTop:4}}>
        <button onClick={onCancel} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
        <button onClick={()=>{ if(!f.identificacao.trim()){ alert("Informe a identificação"); return; } onSave(f); }}
          style={{...S.btn,flex:1,fontSize:13}}>✓ Adicionar</button>
      </div>
    </div>
  );
}

// ── Seção genérica de itens
function SecaoItens({ titulo, icon, tipo, items, project, onUpdate, adminAuth, dark, extraStatusTipos }) {
  const S = getStyles(dark);
  const [showForm, setShowForm] = useState(false);

  const updateItem = (id, patch) => {
    const updated = items.map(it=> it.id===id ? {...it,...patch} : it);
    onUpdate(updated);
    // WhatsApp se problema
    if(patch.status && patch.status !== "ok" && patch.justificativa) {
      const item = items.find(it=>it.id===id);
      enviarWhatsApp(project, titulo, item?.identificacao||tipo, patch.status, patch.justificativa, patch.dataProblem);
    }
  };

  const removeItem = (id) => onUpdate(items.filter(it=>it.id!==id));
  const addItem = (item) => { onUpdate([...items, item]); setShowForm(false); };

  const problemCount = items.filter(it=>it.status&&it.status!=="ok").length;
  const [aberto, setAberto] = useState(false);
  const temConteudo = items.length>0 || showForm;

  return (
    <div style={{background:dark?"#060c18":"#fff",border:`1px solid ${problemCount>0?"#ef444455":dark?"#0f172a":"#e2e8f0"}`,borderRadius:14,overflow:"hidden"}}>
      {/* Cabeçalho da seção — toque abre/fecha em cascata */}
      <div onClick={()=>setAberto(a=>!a)} style={{display:"flex",alignItems:"center",gap:10,padding:"14px 14px",cursor:"pointer",userSelect:"none"}}>
        <span style={{fontSize:22}}>{icon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:800,...S.txt}}>{titulo}</div>
          <div style={{fontSize:12,marginTop:2,color:problemCount>0?"#ef4444":items.length?"#22c55e":(dark?"#64748b":"#94a3b8"),fontWeight:problemCount>0?700:600,animation:problemCount>0?"mkBadgePulse 1.8s ease-in-out infinite":"none"}}>
            <style>{`@keyframes mkBadgePulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
            {items.length===0?"Nenhum item":`${items.length} ite${items.length!==1?"ns":"m"} · ${problemCount>0?`⚠ ${problemCount} problema${problemCount!==1?"s":""}`:"✅ tudo OK"}`}
          </div>
        </div>
        {adminAuth&&aberto&&<button onClick={(e)=>{e.stopPropagation();setShowForm(true);}} style={{...S.btnSm,color:"#22c55e",border:"1px solid #22c55e44",fontSize:11,padding:"6px 12px",flexShrink:0}}>+ Adicionar</button>}
        <span style={{color:dark?"#94a3b8":"#94a3b8",fontSize:14,flexShrink:0,transform:aberto?"rotate(90deg)":"none",transition:"transform .15s"}}>▸</span>
      </div>

      <div style={{display:"grid",gridTemplateRows:aberto?"1fr":"0fr",transition:"grid-template-rows .3s ease"}}><div style={{overflow:"hidden",minHeight:0}}>
        <div style={{padding:"0 12px 12px",display:"flex",flexDirection:"column",gap:8}}>
          {showForm && <NovoItemForm tipo={tipo} project={project} dark={dark} onSave={addItem} onCancel={()=>setShowForm(false)}/>}

          {items.length===0 && !showForm && (
            <div style={{textAlign:"center",padding:"10px",fontSize:13,...S.txt2}}>
              Nenhum item cadastrado{adminAuth?" — toque em + Adicionar":""}
            </div>
          )}

      {items.map(item => (
        <ItemCard key={item.id} item={item} icon={icon} title={item.identificacao||(item.tipo||tipo)}
          onRemove={adminAuth?()=>removeItem(item.id):null} adminAuth={adminAuth} dark={dark}>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {/* Campos específicos somente leitura */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {item.modelo && <span style={{fontSize:10,...S.txt2}}>📱 {item.modelo}</span>}
              {item.marca  && <span style={{fontSize:10,...S.txt2}}>🏷 {item.marca}</span>}
              {item.calibre && <span style={{fontSize:10,...S.txt2}}>🔫 {item.calibre}</span>}
              {item.nSerie && <span style={{fontSize:10,...S.txt2}}>🔢 {item.nSerie}</span>}
              {item.validade && <span style={{fontSize:10,color:new Date(item.validade)<new Date()?"#ef4444":"#22c55e"}}>📅 Val: {fmtDate(item.validade)}</span>}
              {item.qtd!==undefined && tipo==="municao" && <span style={{fontSize:12,fontWeight:700,color:"#f59e0b"}}>{item.qtd} unidades</span>}
              {item.qtd!==undefined && tipo==="radiosHT" && <span style={{fontSize:10,...S.txt2}}>Qtd: {item.qtd}</span>}
            </div>

            {/* Status Bateria e Carregador para Rádio HT */}
            {tipo==="radiosHT" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[["Bateria","bateria"],["Carregador","carregador"]].map(([label,key])=>(
                  <div key={key}>
                    <div style={S.lbl}>{label}</div>
                    <StatusSelector value={{status:item[key]||"ok"}}
                      onChange={(val)=>updateItem(item.id,{[key]:val.status,...(val.justificativa?{[`just_${key}`]:val.justificativa}:{})})}
                      tipos={["ok","parcial","inop"]} dark={dark}/>
                  </div>
                ))}
              </div>
            )}

            {/* Munição — botão menos */}
            {tipo==="municao" && (
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={S.lbl}>Quantidade atual</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={()=>{
                    const newQtd = Math.max(0,(item.qtd||0)-1);
                    // Abrir justificativa
                    const just = window.prompt("Justificativa para redução de munição:");
                    if(just===null) return;
                    updateItem(item.id,{qtd:newQtd,status:newQtd===0?"inop":newQtd<5?"critico":"ok",justificativa:just,dataProblem:todayStr()});
                  }} style={{background:"#1a0202",border:"1px solid #ef444433",color:"#ef4444",borderRadius:6,width:28,height:28,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>−</button>
                  <span style={{fontSize:16,fontWeight:700,...S.txt,minWidth:30,textAlign:"center"}}>{item.qtd||0}</span>
                  <button onClick={()=>updateItem(item.id,{qtd:(item.qtd||0)+1})}
                    style={{background:"#021a0d",border:"1px solid #22c55e33",color:"#22c55e",borderRadius:6,width:28,height:28,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>+</button>
                </div>
              </div>
            )}

            {/* Armamento — manutenção */}
            {tipo==="armamento" && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div>
                  <label style={S.lbl}>Última manutenção</label>
                  <input type="date" value={item.dataManutencao||""} onChange={e=>updateItem(item.id,{dataManutencao:e.target.value})} style={S.inp}/>
                </div>
                <div>
                  <label style={S.lbl}>Armeiro</label>
                  <input value={item.armeiro||""} onChange={e=>updateItem(item.id,{armeiro:e.target.value})} placeholder="Nome do armeiro..." style={S.inp}/>
                </div>
              </div>
            )}

            {/* Status geral */}
            {tipo!=="municao" && (
              <div>
                <div style={S.lbl}>Status {tipo==="radiosHT"?"Geral":""}</div>
                <StatusSelector
                  value={{status:item.status||"ok"}}
                  onChange={(val)=>{
                    updateItem(item.id,{status:val.status,...(val.justificativa?{justificativa:val.justificativa,dataProblem:val.dataProblem}:{justificativa:"",dataProblem:""})});
                    if(val.status!=="ok" && val.justificativa) {
                      enviarWhatsApp(project,titulo,item.identificacao,val.status,val.justificativa,val.dataProblem);
                    }
                  }}
                  tipos={extraStatusTipos||["ok","parcial","inop"]} dark={dark}/>
              </div>
            )}

            {/* Gerencial resolve */}
            {item.status && item.status!=="ok" && (
              <button onClick={()=>updateItem(item.id,{status:"ok",justificativa:"",dataProblem:""})}
                style={{...S.btnSm,color:"#22c55e",border:"1px solid #22c55e44",fontSize:10,padding:"6px 14px"}}>
                ✓ Marcar como Resolvido
              </button>
            )}
          </div>
        </ItemCard>
      ))}
        </div>
      </div></div>
    </div>
  );
}

// ── Motocicleta (1 por projeto)
function SecMoto({ moto, project, onUpdate, adminAuth, liderAuth, dark }) {
  const S = getStyles(dark);
  const [editing, setEditing] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [novaManut, setNovaManut] = useState({ data:todayStr(), km:"", desc:"" });
  const [form, setForm] = useState(moto || { placa:"", km:"", proximaRevisao:"", status:"ok", historico:[] });

  const save = (updated) => { onUpdate(updated); setEditing(false); };

  const addManut = () => {
    if(!novaManut.desc.trim()) { alert("Informe a descrição"); return; }
    const updated = {...form, historico:[{id:Date.now().toString(),...novaManut},...(form.historico||[])]};
    setForm(updated); onUpdate(updated);
    setNovaManut({data:todayStr(),km:"",desc:""});
    setShowHist(false);
  };

  const hasProblema = form.status && form.status!=="ok";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🏍️</span>
          <span style={{fontSize:13,fontWeight:700,...S.txt}}>Motocicleta</span>
          {hasProblema && <DiasAberto dataProblem={form.dataProblem}/>}
        </div>
        {liderAuth && <button onClick={()=>setEditing(true)} style={{...S.btnSm,color:"#f59e0b",border:"1px solid #f59e0b44",fontSize:10}}>✏️ Editar</button>}
      </div>

      <div style={{...S.card,border:`2px solid ${hasProblema?(STATUS_CONFIG[form.status]?.border||"#ef444433"):dark?"#0f172a":"#e2e8f0"}`}}>
        {editing ? (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div><label style={S.lbl}>Placa</label><input value={form.placa} onChange={e=>setForm(f=>({...f,placa:e.target.value}))} placeholder="ABC-1234" style={S.inp}/></div>
              <div><label style={S.lbl}>Modelo</label><input value={form.modelo||""} onChange={e=>setForm(f=>({...f,modelo:e.target.value}))} placeholder="Ex: Honda CG 160..." style={S.inp}/></div>
              <div><label style={S.lbl}>Ano</label><input type="number" value={form.ano||""} onChange={e=>setForm(f=>({...f,ano:e.target.value}))} placeholder="Ex: 2022" style={S.inp}/></div>
              <div><label style={S.lbl}>KM Atual</label><input type="number" value={form.km} onChange={e=>setForm(f=>({...f,km:e.target.value}))} placeholder="0" style={S.inp}/></div>
            </div>
            <div><label style={S.lbl}>KM para próxima manutenção</label><input type="number" value={form.kmManutencao||""} onChange={e=>setForm(f=>({...f,kmManutencao:e.target.value}))} placeholder="Ex: 5000" style={S.inp}/></div>
            <div><label style={S.lbl}>Próxima Revisão (Data)</label><input type="date" value={form.proximaRevisao||""} onChange={e=>setForm(f=>({...f,proximaRevisao:e.target.value}))} style={S.inp}/></div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditing(false)} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
              <button onClick={()=>save(form)} style={{...S.btn,flex:1,fontSize:13}}>✓ Salvar</button>
            </div>
          </div>
        ) : (
          <>
            {!form.placa ? (
              <div style={{textAlign:"center",padding:"10px 0",fontSize:12,...S.txt2}}>Motocicleta não cadastrada{liderAuth?" — toque em ✏️ Editar":""}</div>
            ) : (
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  {[
                    ["Placa",      form.placa],
                    ["Modelo",     form.modelo||"--"],
                    ["Ano",        form.ano||"--"],
                    ["KM Atual",   form.km?`${form.km} km`:"--"],
                    ["KM Manutenção", form.kmManutencao?`${form.kmManutencao} km`:"--"],
                    ["Próx. Revisão", form.proximaRevisao?fmtDate(form.proximaRevisao):"--"],
                  ].map(([label,val])=>(
                    <div key={label}><div style={S.lbl}>{label}</div><div style={{fontSize:12,fontWeight:600,...S.txt}}>{val}</div></div>
                  ))}
                </div>
                {form.km && form.kmManutencao && Number(form.km) >= Number(form.kmManutencao) && (
                  <div style={{background:"#1a0202",border:"1px solid #ef444433",borderRadius:8,padding:"8px 12px",marginBottom:8}}>
                    <div style={{fontSize:11,color:"#ef4444",fontWeight:700}}>🔴 KM de manutenção atingido!</div>
                    <div style={{fontSize:10,color:"#94a3b8"}}>KM atual ({form.km}) ≥ KM manutenção ({form.kmManutencao})</div>
                  </div>
                )}
              </>
            )}

            {form.placa && (
              <>
                <div style={S.lbl}>Status</div>
                <StatusSelector
                  value={{status:form.status||"ok"}}
                  onChange={(val)=>{
                    const updated = {...form,status:val.status,...(val.justificativa?{justificativa:val.justificativa,dataProblem:val.dataProblem}:{justificativa:"",dataProblem:""})};
                    setForm(updated); onUpdate(updated);
                    if(val.status!=="ok"&&val.justificativa) enviarWhatsApp(project,"Motocicleta",form.placa,val.status,val.justificativa,val.dataProblem);
                  }}
                  tipos={["ok","parcial","inop"]} dark={dark}/>

                {hasProblema && form.justificativa && (
                  <div style={{background:dark?"#1a0202":"#fff5f5",border:"1px solid #ef444433",borderRadius:8,padding:"8px 12px",marginTop:8}}>
                    <div style={{fontSize:10,color:"#ef4444",fontWeight:700,marginBottom:3}}>⚠️ {fmtDate(form.dataProblem)}</div>
                    <div style={{fontSize:11,...S.txt}}>{form.justificativa}</div>
                  </div>
                )}

                {liderAuth && hasProblema && (
                  <button onClick={()=>{ const u={...form,status:"ok",justificativa:"",dataProblem:""}; setForm(u); onUpdate(u); }}
                    style={{...S.btnSm,color:"#22c55e",border:"1px solid #22c55e44",fontSize:10,padding:"6px 14px",marginTop:8}}>
                    ✓ Marcar como Resolvido
                  </button>
                )}

                {/* Histórico manutenção */}
                <div style={{marginTop:12,borderTop:`1px solid ${dark?"#0f172a":"#f1f5f9"}`,paddingTop:10}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                    <div style={{fontSize:11,fontWeight:700,...S.txt}}>🔧 Histórico Manutenção ({(form.historico||[]).length})</div>
                    <button onClick={()=>setShowHist(!showHist)} style={{...S.btnSm,fontSize:10,color:"#f59e0b",border:"1px solid #f59e0b44"}}>+ Registrar</button>
                  </div>
                  {showHist && (
                    <div style={{background:dark?"#020510":"#f8fafc",borderRadius:8,padding:"10px",marginBottom:8,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                        <div><label style={S.lbl}>Data</label><input type="date" value={novaManut.data} onChange={e=>setNovaManut(m=>({...m,data:e.target.value}))} style={S.inp}/></div>
                        <div><label style={S.lbl}>KM</label><input type="number" value={novaManut.km} onChange={e=>setNovaManut(m=>({...m,km:e.target.value}))} placeholder="KM..." style={S.inp}/></div>
                      </div>
                      <div style={{marginBottom:8}}><label style={S.lbl}>Descrição</label><textarea value={novaManut.desc} onChange={e=>setNovaManut(m=>({...m,desc:e.target.value}))} placeholder="O que foi feito..." style={{...S.inp,height:50,resize:"vertical",fontSize:12}}/></div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setShowHist(false)} style={{...S.btnSec,flex:1,fontSize:12}}>Cancelar</button>
                        <button onClick={addManut} style={{...S.btn,flex:1,fontSize:12}}>✓ Adicionar</button>
                      </div>
                    </div>
                  )}
                  {(form.historico||[]).map(h=>(
                    <div key={h.id} style={{background:dark?"#020510":"#f8fafc",borderRadius:7,padding:"8px 10px",marginBottom:5,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3}}>
                        <span style={{fontSize:10,color:"#f59e0b",fontWeight:700}}>{fmtDate(h.data)}</span>
                        {h.km && <span style={{fontSize:10,...S.txt2}}>🏍️ {h.km} km</span>}
                      </div>
                      <div style={{fontSize:11,...S.txt}}>{h.desc}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── App principal
export default function Equipamentos({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }) {
  const S = getStyles(dark);
  const [authLevel, setAuthLevel] = useState(()=>sharedAuth||getAccess(project?.id)||null);
  const [screen, setScreen] = useState(()=>(sharedAuth||getAccess(project?.id))?"main":"pin");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const adminAuth = authLevel==="admin";
  const liderAuth = authLevel==="lider" || authLevel==="admin";

  useEffect(()=>{
    loadEquip(project.id).then(d=>{ setData(d||{smartphones:[],radiosHT:[],armamento:[],municao:[],placas:[],lanternas:[],moto:null,ztrax:[]}); setLoading(false); });
  },[project.id]);

  const saveSection = async (section, val) => {
    setSaving(true);
    const updated = {...data,[section]:val};
    setData(updated);
    await saveEquip(project.id, updated);
    setSaving(false);
  };

  if(screen==="pin") return <PinGate project={project} dark={dark} onBack={onBack} onSuccess={(l)=>{grantSession(l,project.id);setAuthLevel(l);setScreen("main");onAuthGranted?.(l);}}/>;

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:30,marginBottom:10}}>🛡️</div><div style={{fontSize:13,...S.txt2}}>Carregando equipamentos...</div></div>
    </div>
  );

  // KPIs
  const allItems = [
    ...(data.smartphones||[]), ...(data.radiosHT||[]),
    ...(data.armamento||[]),   ...(data.municao||[]),
    ...(data.placas||[]),      ...(data.lanternas||[]),
    ...(data.ztrax||[]),       ...(data.bodycam||[]),
    ...(data.moto?[data.moto]:[])
  ];
  const totalProblemas = allItems.filter(it=>it.status&&it.status!=="ok").length;
  const inop = allItems.filter(it=>it.status==="inop"||it.status==="critico").length;
  const parcial = allItems.filter(it=>it.status==="parcial"||it.status==="baixo").length;

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{position:"sticky",top:0,zIndex:10,...S.hdrBg,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onBack} style={S.backBtn}>← Voltar</button>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:800,...S.txt}}>🛡️ Equipamentos</div>
              <div style={{fontSize:11,...S.txt2}}>{project.id} · {project.name}</div>
            </div>
            {saving && <div style={{fontSize:10,color:"#0ea5e9",fontWeight:700}}>⟳</div>}
            <button onClick={onToggleTheme} style={{background:"transparent",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:14,...S.txt2}}>{dark?"☀️":"🌙"}</button>
          </div>
        </div>

        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:14}}>
          {/* KPIs */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[
              {label:"INOP/CRÍTICO",val:inop,color:"#ef4444"},
              {label:"PARCIAL",val:parcial,color:"#f59e0b"},
              {label:"TOTAL ITENS",val:allItems.length,color:"#0ea5e9"},
            ].map(({label,val,color})=>(
              <div key={label} style={{...S.card,textAlign:"center",padding:"10px 8px"}}>
                <div style={{fontSize:22,fontWeight:900,color}}>{val}</div>
                <div style={{fontSize:10,...S.txt2,fontWeight:700}}>{label}</div>
              </div>
            ))}
          </div>

          {/* Badge acesso */}
          {adminAuth ? (
            <div style={{background:"#021a0d",border:"1px solid #22c55e33",borderRadius:10,padding:"8px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:12,color:"#22c55e",fontWeight:700}}>🔓 Gerencial — pode editar e resolver</div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>gerarPDFEquipamentos(project,data)} style={{...S.btnSm,color:"#a855f7",border:"1px solid #a855f744",fontSize:10}}>📄 PDF</button>
                <button onClick={()=>{clearSession();setAuthLevel(null);setScreen("pin");}} style={{...S.btnSm,color:"#64748b",fontSize:10}}>Sair</button>
              </div>
            </div>
          ) : (
            <div style={{background:"#001a2e",border:"1px solid #0ea5e933",borderRadius:10,padding:"8px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:12,color:"#0ea5e9",fontWeight:700}}>👷 Líder — pode cadastrar e atualizar status</div>
              <button onClick={()=>{clearSession();setAuthLevel(null);setScreen("pin");}} style={{...S.btnSm,color:"#64748b",fontSize:10}}>Sair</button>
            </div>
          )}

          {/* Seções */}
          <SecaoItens titulo="Smartphones" icon="📱" tipo="smartphones"
            items={data.smartphones||[]} project={project}
            onUpdate={v=>saveSection("smartphones",v)} adminAuth={adminAuth} dark={dark}/>

          <SecaoItens titulo="Rádios HT" icon="📻" tipo="radiosHT"
            items={data.radiosHT||[]} project={project}
            onUpdate={v=>saveSection("radiosHT",v)} adminAuth={adminAuth} dark={dark}/>

          <SecaoItens titulo="Armamento" icon="🔫" tipo="armamento"
            items={data.armamento||[]} project={project}
            onUpdate={v=>saveSection("armamento",v)} adminAuth={adminAuth} dark={dark}/>

          <SecaoItens titulo="Munição" icon="💊" tipo="municao"
            items={data.municao||[]} project={project}
            onUpdate={v=>saveSection("municao",v)} adminAuth={adminAuth} dark={dark}
            extraStatusTipos={["ok","baixo","critico"]}/>

          <SecaoItens titulo="Placas Balísticas" icon="🦺" tipo="placas"
            items={data.placas||[]} project={project}
            onUpdate={v=>saveSection("placas",v)} adminAuth={adminAuth} dark={dark}/>

          <SecaoItens titulo="Lanternas" icon="🔦" tipo="lanternas"
            items={data.lanternas||[]} project={project}
            onUpdate={v=>saveSection("lanternas",v)} adminAuth={adminAuth} dark={dark}/>

          {TEM_ZTRAX.includes(project.id) && (
            <SecaoItens titulo="Pânico ZTRAX" icon="🚨" tipo="ztrax"
              items={data.ztrax||[]} project={project}
              onUpdate={v=>saveSection("ztrax",v)} adminAuth={adminAuth} dark={dark}/>
          )}

          {TEM_BODYCAM.includes(project.id) && (
            <SecaoItens titulo="Bodycam" icon="📹" tipo="bodycam"
              items={data.bodycam||[]} project={project}
              onUpdate={v=>saveSection("bodycam",v)} adminAuth={adminAuth} dark={dark}/>
          )}

          <SecMoto moto={data.moto} project={project}
            onUpdate={v=>saveSection("moto",v)} adminAuth={adminAuth} liderAuth={liderAuth} dark={dark}/>
        </div>
      </div>
    </div>
  );
}
