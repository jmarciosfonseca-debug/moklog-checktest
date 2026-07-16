// ─────────────────────────────────────────────────────────────
// Iluminacao.jsx — Teste de Iluminação v4 (modelo simples)
// Conceito espelhado no Teste Perimetral do P505, aplicado à iluminação:
// • O mapa (JPEG com os quadrantes já desenhados) é mostrado como está —
//   sem overlay, sem percentuais, sem X/Y/Largura/Altura.
// • A equipe cria/edita os quadrantes visualmente: nome + quantos PONTOS
//   identificou; depois informa os DEFICIENTES/apagados de cada um.
// • Estado vivo, sem data: queimou um ponto amanhã → ✏️ Editar → corrige
//   deficientes, exclui ou acrescenta ponto → 💾 Gravar.
// • Painel: pontos por quadrante, deficientes por quadrante, total do
//   condomínio e PERCENTUAL GERAL com barra.
// • 📄 PDF exclusivo da iluminação (HTML p/ imprimir, padrão Perimetral).
// • Permissões: equipe adiciona e edita; excluir quadrante e Limpar Tudo
//   são exclusivos do gerencial (PIN 872101).
// • Compatibilidade: docs v2/v3 continuam válidos — o histórico antigo é
//   preservado no Firestore e os deficientes iniciais são migrados do
//   último teste registrado.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { setDoc } from "./fireGuard";
import { getAccess, grantSession } from "./session";

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

const ADMIN_PIN = "872101";
const PROJECT_PINS = {
  P601:"16601",P602:"16602",P604:"16604",P605:"16605",
  P606:"16606",P607:"16607",P311A:"16311",P311B:"16311",
  P505:"16505",P260A:"162601",P260B:"162602",P260C:"162603"
};

const PCT_OK = 95;
const PCT_ATENCAO = 80;
const STATUS_CFG = {
  normal:  { label:"Normal",  color:"#22c55e", bg:"#021a0d", border:"#22c55e33" },
  atencao: { label:"Atenção", color:"#f59e0b", bg:"#1a1000", border:"#f59e0b33" },
  critico: { label:"Crítico", color:"#ef4444", bg:"#1a0202", border:"#ef444433" },
};
function statusFromPct(pct){
  if(pct>=PCT_OK) return "normal";
  if(pct>=PCT_ATENCAO) return "atencao";
  return "critico";
}
function fmtDataHora(iso){
  try { const d=new Date(iso); return d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); } catch { return "—"; }
}
function newId(){ try { return crypto.randomUUID(); } catch { return "id-"+Date.now()+"-"+Math.random().toString(36).slice(2,8); } }

// ── Números de um quadrante (deficientes null = ainda não informado)
export function calcQuad(q){
  const total = Number(q?.total)||0;
  const def = q?.deficientes==null ? null : Math.min(total, Number(q.deficientes)||0);
  const ops = def==null ? total : total-def;
  const pct = total ? Math.round((ops/total)*1000)/10 : 0;
  return { total, def, ops, pct };
}
export function calcGeral(quadrantes){
  const qs = (quadrantes||[]).map(calcQuad);
  const total = qs.reduce((a,q)=>a+q.total,0);
  const def = qs.reduce((a,q)=>a+(q.def||0),0);
  const ops = total-def;
  const pct = total ? Math.round((ops/total)*1000)/10 : 0;
  return { total, def, ops, pct };
}

// ── Firestore: doc único por projeto + fallback localStorage
// Migração transparente: se os quadrantes ainda não têm "deficientes" mas
// existe histórico v2/v3, puxa os inoperantes do último teste (por nome).
export async function loadIluminacao(projectId){
  let data = null;
  try {
    const snap = await getDoc(doc(db,"iluminacao",projectId));
    if(snap.exists()){
      data = snap.data();
      try { localStorage.setItem(`iluminacao_${projectId}`, JSON.stringify(data)); } catch(e){}
    }
  } catch(e){}
  if(!data){
    try { const l = localStorage.getItem(`iluminacao_${projectId}`); if(l) data = JSON.parse(l); } catch(e){}
  }
  data = data || {};
  let quadrantes = data.quadrantes||[];
  const semDef = quadrantes.length>0 && quadrantes.every(q=>q.deficientes===undefined);
  if(semDef && (data.history||[]).length>0){
    const del = new Set(data.deletedIds||[]);
    const hist = (data.history||[]).filter(t=>!del.has(t.id))
      .sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    const ultimo = hist[0];
    if(ultimo){
      const porNome = {};
      (ultimo.quads||[]).forEach(q=>{ if(q.nome) porNome[q.nome]=q; });
      quadrantes = quadrantes.map(q=>{
        const u = porNome[q.nome];
        if(!u) return q;
        const inop = u.inoperantes!=null ? Number(u.inoperantes)||0
                   : (u.acesas!=null ? Math.max(0,(Number(u.total)||0)-(Number(u.acesas)||0)) : null);
        return inop==null ? q : { ...q, deficientes:inop, atualizadoEm:ultimo.criadoEm||null };
      });
    }
  }
  return {
    mapa: data.mapa||null,
    quadrantes,
    history: data.history||[],        // legado preservado (não exibido)
    deletedIds: data.deletedIds||[],
  };
}
async function saveIluminacao(projectId, data){
  const payload = { ...data, updatedAt: new Date().toISOString() };
  try { await setDoc(doc(db,"iluminacao",projectId), payload); } catch(e){ console.error("Iluminacao save:", e); }
  try { localStorage.setItem(`iluminacao_${projectId}`, JSON.stringify(payload)); } catch(e){}
}

// ── PDF (padrão Perimetral: HTML com botão de impressão, baixado via Blob)
function gerarPdfIluminacao(project, data){
  const g = calcGeral(data.quadrantes);
  const gCor = STATUS_CFG[statusFromPct(g.pct)].color;
  const agora = new Date();
  const mapaAbs = data.mapa?.url ? (window.location.origin + data.mapa.url) : null;
  const linhas = (data.quadrantes||[]).map(q=>{
    const c = calcQuad(q);
    const cor = STATUS_CFG[statusFromPct(c.pct)].color;
    return `<tr>
      <td style="font-weight:800">${q.nome}</td>
      <td style="text-align:center">${c.total}</td>
      <td style="text-align:center;font-weight:700;color:${c.def>0?"#ef4444":"#22c55e"}">${c.def==null?"—":c.def}</td>
      <td style="text-align:center">${c.ops}</td>
      <td style="width:34%">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:9px;border-radius:5px;background:#e2e8f0;overflow:hidden"><div style="height:100%;width:${c.pct}%;background:${cor}"></div></div>
          <span style="font-weight:800;color:${cor};font-size:12px">${c.pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join("");
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Iluminação ${project.id}</title>
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;color:#0f172a;padding:20px;max-width:820px;margin:0 auto}
  h1{font-size:19px;margin:0}
  .sub{font-size:12px;color:#64748b;margin-top:2px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
  .kpi{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
  .kpi-val{font-size:24px;font-weight:900}
  .kpi-lbl{font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:3px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
  th{background:#1e293b;color:#fff;padding:7px 10px;text-align:left;font-size:11px}
  td{padding:7px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
  .mapa img{width:100%;border-radius:8px;margin:12px 0;display:block}
  .barraG{height:14px;border-radius:7px;background:#e2e8f0;overflow:hidden;margin-top:6px}
  .footer{text-align:center;margin-top:16px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
  @media print{body{padding:8px}@page{margin:10mm}.no-print{display:none}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}}
</style></head>
<body>
<div class="no-print" style="text-align:center;margin-bottom:14px">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<h1>💡 Relatório de Iluminação — ${project.id}</h1>
<div class="sub">${project.name||""} · Gerado em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
${mapaAbs?`<div class="mapa"><img src="${mapaAbs}" alt="Mapa"/></div>`:""}
<div class="kpis">
  <div class="kpi"><div class="kpi-val">${g.total}</div><div class="kpi-lbl">Pontos totais</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${g.def>0?"#ef4444":"#22c55e"}">${g.def}</div><div class="kpi-lbl">Deficientes</div></div>
  <div class="kpi"><div class="kpi-val">${g.ops}</div><div class="kpi-lbl">Operantes</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${gCor}">${g.pct}%</div><div class="kpi-lbl">Geral</div></div>
</div>
<div class="barraG"><div style="height:100%;width:${g.pct}%;background:${gCor}"></div></div>
<table style="margin-top:16px">
  <thead><tr><th>Quadrante</th><th style="text-align:center">Pontos</th><th style="text-align:center">Deficientes</th><th style="text-align:center">Operantes</th><th>% Operante</th></tr></thead>
  <tbody>${linhas}</tbody>
</table>
<div class="footer">MokLog CheckTest · Moked Consulting Security · Teste de Iluminação ${project.id}</div>
</body></html>`;
  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `iluminacao_${project.id}_${agora.toLocaleDateString("sv-SE")}.html`;
  a.click();
}

function getStyles(dark) {
  return {
    page:    { minHeight:"100vh", background:dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 90px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:480, display:"flex", flexDirection:"column" },
    card:    { background:dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"14px 16px" },
    btn:     { background:"linear-gradient(135deg,#ca8a04,#a16207)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnSec:  { background:dark?"#060c18":"#f8fafc", color:dark?"#64748b":"#475569", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
    btnSm:   { background:dark?"#020510":"#f8fafc", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#64748b":"#475569", borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:600 },
    backBtn: { background:"transparent", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#94a3b8":"#64748b", borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 },
    inp:     { width:"100%", background:dark?"#020510":"#ffffff", border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`, borderRadius:7, color:dark?"#e2e8f0":"#1e293b", padding:"10px 12px", fontSize:13, boxSizing:"border-box", outline:"none" },
    lbl:     { display:"block", fontSize:10, color:dark?"#475569":"#64748b", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 },
    txt:     { color:dark?"#f1f5f9":"#0f172a" },
    txt2:    { color:dark?"#475569":"#64748b" },
  };
}

function BarraPct({ pct, dark, alta }) {
  const cfg = STATUS_CFG[statusFromPct(pct)];
  return (
    <div style={{height:alta?12:8,borderRadius:alta?6:4,background:dark?"#0f172a":"#e2e8f0",overflow:"hidden"}}>
      <div style={{height:"100%",width:`${Math.min(100,Math.max(0,pct))}%`,background:cfg.color,borderRadius:alta?6:4,transition:"width .35s ease"}}/>
    </div>
  );
}

// ── PIN Gate (fallback — só aparece sem sessão válida)
function PinGate({ project, onSuccess, onBack, dark }) {
  const S = getStyles(dark);
  const [mode, setMode] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const tryPin = () => {
    if(pin===ADMIN_PIN){ onSuccess("admin"); return; }
    if(pin===PROJECT_PINS[project.id]){ onSuccess("lider"); return; }
    setErr(true);
  };
  return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.card,maxWidth:320,width:"100%",margin:16,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>💡</div>
        <div style={{fontSize:16,fontWeight:800,...S.txt,marginBottom:4}}>Teste de Iluminação</div>
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
            {err&&<div role="alert" style={{fontSize:12,color:"#ef4444",marginBottom:8}}>PIN incorreto</div>}
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

// ── App principal
export default function Iluminacao({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }) {
  const S = getStyles(dark);
  const [authLevel, setAuthLevel] = useState(()=>sharedAuth||getAccess(project?.id)||null);
  const [screen, setScreen] = useState(()=>(sharedAuth||getAccess(project?.id))?"main":"pin"); // pin | main | config
  const [data, setData] = useState({ mapa:null, quadrantes:[], history:[], deletedIds:[] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const adminAuth = authLevel==="admin";

  // Edição inline: id do quadrante em edição ("novo" para adicionar)
  const [editId, setEditId] = useState(null);
  const [edNome, setEdNome] = useState("");
  const [edTotal, setEdTotal] = useState("");
  const [edDef, setEdDef] = useState("");
  const [edErr, setEdErr] = useState(null);
  const [delId, setDelId] = useState(null); // confirmação de exclusão (admin)

  // Config (gerencial): caminho do mapa + zona de perigo
  const [cfgUrl, setCfgUrl] = useState("");
  const [confirmLimpar, setConfirmLimpar] = useState(0);

  useEffect(()=>{ loadIluminacao(project.id).then(d=>{ setData(d); setLoading(false); }); },[project.id]);

  const g = calcGeral(data.quadrantes);
  const temQuadrantes = (data.quadrantes||[]).length>0;
  const faltamDef = (data.quadrantes||[]).filter(q=>Number(q.total)>0 && q.deficientes==null);

  const persist = async (next) => {
    setSaving(true);
    setData(next);
    await saveIluminacao(project.id, next);
    setSaving(false);
  };

  const abrirEdicao = (q) => {
    setEditId(q? q.id : "novo");
    setEdNome(q? q.nome : "");
    setEdTotal(q? String(q.total??"") : "");
    setEdDef(q? (q.deficientes==null?"0":String(q.deficientes)) : "0");
    setEdErr(null); setDelId(null);
  };
  const gravarEdicao = async () => {
    const nome = edNome.trim();
    const total = Number(edTotal)||0;
    const def = Math.min(total, Number(edDef)||0);
    if(!nome){ setEdErr("Informe o nome do quadrante (ex: A1)."); return; }
    if(total<=0){ setEdErr("Informe quantos pontos de iluminação existem no quadrante."); return; }
    if((data.quadrantes||[]).some(q=>q.nome.trim().toLowerCase()===nome.toLowerCase() && q.id!==editId)){
      setEdErr(`Já existe um quadrante chamado "${nome}".`); return;
    }
    const agora = new Date().toISOString();
    let quadrantes;
    if(editId==="novo"){
      quadrantes = [...(data.quadrantes||[]), { id:newId(), nome, total, deficientes:def, atualizadoEm:agora }];
    } else {
      quadrantes = (data.quadrantes||[]).map(q=>q.id===editId?{...q, nome, total, deficientes:def, atualizadoEm:agora}:q);
    }
    await persist({ ...data, quadrantes });
    setEditId(null);
  };
  const stepDef = (delta) => {
    const total = Number(edTotal)||0;
    const cur = Number(edDef)||0;
    setEdDef(String(Math.max(0, Math.min(total, cur+delta))));
    setEdErr(null);
  };
  const excluirQuadrante = async (qid) => {
    await persist({ ...data, quadrantes:(data.quadrantes||[]).filter(q=>q.id!==qid) });
    setDelId(null); setEditId(null);
  };

  const abrirConfig = () => {
    setCfgUrl(data.mapa?.url || `/mapas/${project.id}.jpg`);
    setConfirmLimpar(0);
    setScreen("config");
  };
  const salvarConfig = async () => {
    const mapa = cfgUrl.trim() ? { ...(data.mapa||{}), url:cfgUrl.trim() } : null;
    await persist({ ...data, mapa });
    setScreen("main");
  };
  const limparTudo = async () => {
    const idsTestes = (data.history||[]).map(t=>t.id);
    await persist({ ...data, quadrantes:[], history:[], deletedIds:[...(data.deletedIds||[]), ...idsTestes] });
    setConfirmLimpar(0);
    setScreen("main");
  };

  if(screen==="pin") return <PinGate project={project} dark={dark} onBack={onBack} onSuccess={(l)=>{grantSession(l,project.id);setAuthLevel(l);setScreen("main");onAuthGranted?.(l);}}/>;

  if(loading) return (
    <div style={{...S.page,alignItems:"center",justifyContent:"center"}}>
      <div style={{...S.txt2,fontSize:13}}>Carregando iluminação…</div>
    </div>
  );

  const Header = (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px 10px"}}>
      <button onClick={()=>{ if(screen==="main") onBack(); else setScreen("main"); }} style={S.backBtn} aria-label="Voltar">←</button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:800,...S.txt}}>💡 Teste de Iluminação</div>
        <div style={{fontSize:10,...S.txt2}}>{project.id} · {project.name}</div>
      </div>
      {onToggleTheme && <button onClick={onToggleTheme} style={S.btnSm}>{dark?"☀️":"🌙"}</button>}
    </div>
  );

  // ── TELA: configuração (SÓ gerencial)
  if(screen==="config") return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
        <div style={S.card}>
          <label style={S.lbl}>Imagem do mapa (em public/mapas/)</label>
          <input value={cfgUrl} onChange={e=>setCfgUrl(e.target.value)} placeholder={`/mapas/${project.id}.jpg`} style={S.inp}/>
          <div style={{fontSize:10,...S.txt2,marginTop:6}}>Use a imagem com os quadrantes já desenhados — ela aparece como está para a equipe.</div>
        </div>
        <button onClick={salvarConfig} disabled={saving} style={{...S.btn,opacity:saving?.6:1}}>{saving?"Salvando…":"💾 Salvar"}</button>
        <button onClick={()=>setScreen("main")} style={{...S.btnSec,fontSize:13}}>Cancelar</button>
        <div style={{...S.card,border:"1px solid #ef444433",marginTop:6}}>
          <div style={{fontSize:11,fontWeight:800,color:"#ef4444",marginBottom:6}}>ZONA DE PERIGO</div>
          {confirmLimpar===0 && <button onClick={()=>setConfirmLimpar(1)} style={{...S.btnSec,fontSize:13,color:"#ef4444",borderColor:"#ef444433"}}>🧹 Limpar tudo deste projeto</button>}
          {confirmLimpar===1 && (
            <>
              <div style={{fontSize:12,...S.txt,marginBottom:8}}>Apagar TODOS os quadrantes e pontos de iluminação do {project.id}? O mapa configurado é mantido.</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setConfirmLimpar(0)} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
                <button onClick={()=>setConfirmLimpar(2)} style={{...S.btn,flex:1,fontSize:13,background:"linear-gradient(135deg,#dc2626,#991b1b)"}}>Continuar</button>
              </div>
            </>
          )}
          {confirmLimpar===2 && (
            <>
              <div style={{fontSize:12,color:"#ef4444",fontWeight:700,marginBottom:8}}>Última confirmação — essa ação não pode ser desfeita.</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setConfirmLimpar(0)} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
                <button onClick={limparTudo} disabled={saving} style={{...S.btn,flex:1,fontSize:13,background:"linear-gradient(135deg,#dc2626,#991b1b)"}}>{saving?"Limpando…":"🧹 Apagar tudo"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div></div>
  );

  // ── Editor inline de quadrante (novo ou existente)
  const Editor = (
    <div style={{...S.card,border:"1px solid #ca8a0455"}}>
      <div style={{fontSize:13,fontWeight:800,...S.txt,marginBottom:10}}>{editId==="novo"?"➕ Novo quadrante":"✏️ Editar quadrante"}</div>
      <div style={{display:"flex",gap:8}}>
        <div style={{flex:1}}>
          <label style={S.lbl}>Quadrante</label>
          <input value={edNome} onChange={e=>{setEdNome(e.target.value);setEdErr(null);}} placeholder="Ex: A1" style={S.inp}/>
        </div>
        <div style={{width:110}}>
          <label style={S.lbl}>Pontos</label>
          <input value={edTotal} inputMode="numeric"
            onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");setEdTotal(v);setEdErr(null);}}
            placeholder="0" style={{...S.inp,textAlign:"center",fontWeight:800}}/>
        </div>
      </div>
      <label style={{...S.lbl,marginTop:10}}>Deficientes / apagados</label>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button onClick={()=>stepDef(-1)} style={{...S.btnSm,fontSize:18,padding:"6px 14px"}}>−</button>
        <input value={edDef} inputMode="numeric"
          onChange={e=>{let v=e.target.value.replace(/[^0-9]/g,"");const t=Number(edTotal)||0;if(v!==""&&Number(v)>t)v=String(t);setEdDef(v);setEdErr(null);}}
          style={{...S.inp,textAlign:"center",fontSize:18,fontWeight:800}}/>
        <button onClick={()=>stepDef(1)} style={{...S.btnSm,fontSize:18,padding:"6px 14px"}}>＋</button>
      </div>
      {(()=>{ const t=Number(edTotal)||0; const d=Number(edDef)||0; const pct=t?Math.round(((t-d)/t)*1000)/10:0;
        return t>0 ? <div style={{marginTop:8}}><BarraPct pct={pct} dark={dark}/><div style={{fontSize:10,...S.txt2,marginTop:4,textAlign:"right",fontWeight:800,color:STATUS_CFG[statusFromPct(pct)].color}}>{pct}% operante</div></div> : null; })()}
      {edErr && <div role="alert" style={{fontSize:12,color:"#ef4444",marginTop:8,textAlign:"center"}}>{edErr}</div>}
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <button onClick={()=>setEditId(null)} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
        <button onClick={gravarEdicao} disabled={saving} style={{...S.btn,flex:1,fontSize:13}}>{saving?"Gravando…":"💾 Gravar"}</button>
      </div>
    </div>
  );

  // ── TELA principal — limpa: mapa, total geral, quadrantes, PDF
  return (
    <div style={S.page}><div style={S.wrap}>
      {Header}
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>

        {/* Mapa como está (quadrantes já desenhados na imagem) */}
        {data.mapa?.url && (
          <img src={data.mapa.url} alt="Mapa do projeto"
            style={{width:"100%",borderRadius:12,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,display:"block"}}
            onError={(e)=>{e.currentTarget.style.display="none";}}/>
        )}

        {/* Painel geral do condomínio */}
        {temQuadrantes && g.total>0 && (
          <div style={{...S.card,border:`1px solid ${STATUS_CFG[statusFromPct(g.pct)].border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
              <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase"}}>Total do condomínio</div>
              <div style={{fontSize:26,fontWeight:900,color:STATUS_CFG[statusFromPct(g.pct)].color}}>{g.pct}%</div>
            </div>
            <div style={{marginTop:6}}><BarraPct pct={g.pct} dark={dark} alta/></div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:11,...S.txt2}}>
              <span><b style={{...S.txt}}>{g.total}</b> pontos</span>
              <span style={{color:g.def>0?"#ef4444":"#22c55e",fontWeight:800}}>{g.def} deficiente{g.def===1?"":"s"}</span>
              <span><b style={{...S.txt}}>{g.ops}</b> operantes</span>
            </div>
          </div>
        )}

        {/* Guia do fluxo */}
        {!temQuadrantes && (
          <div style={{...S.card,border:"1px solid #f59e0b33"}}>
            <div style={{fontSize:12,fontWeight:700,...S.txt,marginBottom:2}}>Comece pelo levantamento</div>
            <div style={{fontSize:11,...S.txt2}}>Olhe o mapa acima e adicione cada quadrante com a quantidade de pontos de iluminação identificados.</div>
          </div>
        )}
        {faltamDef.length>0 && (
          <div style={{...S.card,border:"1px solid #f59e0b55",background:dark?"#1a1000":"#fffbeb"}}>
            <div style={{fontSize:12,fontWeight:800,color:"#f59e0b"}}>⚠️ Falta informar os deficientes</div>
            <div style={{fontSize:11,...S.txt2,marginTop:2}}>Agora informe quantos pontos estão deficientes/apagados em: {faltamDef.map(q=>q.nome).join(", ")}. Toque em ✏️ Editar no quadrante.</div>
          </div>
        )}

        {/* Quadrantes */}
        {(data.quadrantes||[]).map(q=>{
          if(editId===q.id) return <div key={q.id}>{Editor}</div>;
          const c = calcQuad(q);
          const cor = STATUS_CFG[statusFromPct(c.pct)].color;
          return (
            <div key={q.id} style={{...S.card,padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:44,textAlign:"center",flexShrink:0,fontSize:17,fontWeight:900,color:c.def==null?(dark?"#64748b":"#94a3b8"):cor}}>{q.nome}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,...S.txt}}>
                    {c.total} ponto{c.total===1?"":"s"} · {c.def==null
                      ? <span style={{color:"#f59e0b",fontWeight:800}}>deficientes pendentes</span>
                      : <span style={{color:c.def>0?"#ef4444":"#22c55e",fontWeight:800}}>{c.def} deficiente{c.def===1?"":"s"}</span>}
                  </div>
                  <div style={{fontSize:9,...S.txt2,marginTop:1}}>{q.atualizadoEm?`atualizado em ${fmtDataHora(q.atualizadoEm)}`:""}</div>
                </div>
                {c.def!=null && <div style={{width:64,flexShrink:0,textAlign:"right",fontSize:13,fontWeight:900,color:cor}}>{c.pct}%</div>}
              </div>
              {c.def!=null && <div style={{marginTop:8}}><BarraPct pct={c.pct} dark={dark}/></div>}
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button onClick={()=>abrirEdicao(q)} style={{...S.btnSm,flex:1,padding:"8px",fontSize:12}}>✏️ Editar</button>
                {adminAuth && delId!==q.id && <button onClick={()=>setDelId(q.id)} style={{...S.btnSm,color:"#ef4444",borderColor:"#ef444433",padding:"8px 12px",fontSize:12}}>🗑</button>}
              </div>
              {adminAuth && delId===q.id && (
                <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
                  <div style={{flex:1,fontSize:11,color:"#ef4444",fontWeight:700}}>Excluir o quadrante {q.nome}?</div>
                  <button onClick={()=>setDelId(null)} style={{...S.btnSm,fontSize:11}}>Não</button>
                  <button onClick={()=>excluirQuadrante(q.id)} style={{...S.btnSm,color:"#fff",background:"#dc2626",borderColor:"#dc2626",fontSize:11}}>Sim, excluir</button>
                </div>
              )}
            </div>
          );
        })}

        {/* Ações */}
        {editId==="novo" ? Editor : (
          <button onClick={()=>abrirEdicao(null)} style={temQuadrantes?{...S.btnSec,fontSize:13}:S.btn}>➕ Adicionar quadrante</button>
        )}
        {adminAuth && temQuadrantes && g.total>0 && (
          <button onClick={()=>gerarPdfIluminacao(project, data)} style={{...S.btn,background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}}>📄 Gerar PDF da Iluminação</button>
        )}
        {adminAuth && <button onClick={abrirConfig} style={{...S.btnSec,fontSize:13}}>⚙️ Configurar Mapa</button>}
        {saving && <div style={{fontSize:10,...S.txt2,textAlign:"center"}}>salvando…</div>}
      </div>
    </div></div>
  );
}
