// ─────────────────────────────────────────────────────────────
// BodycamSection.jsx — Descarregamento de Bodycam (só P311A)
//
// Regra de negócio (ciclo de 24h, atravessando os 2 turnos):
// • A bodycam grava por 24h corridas; o descarregamento é feito à noite,
//   cobrindo o dia corrente. Prazo: até a meia-noite (00:00) do próprio dia.
// • Passou da meia-noite mas ainda não deu 06:00 (troca de turno)? Ainda dá
//   pra descarregar, mas fica marcado com a tarja amarela "Pós 00:00".
// • Passou das 06:00 sem registro do dia anterior? Vira FALTA automática,
//   travada pra sempre — sem editar data/hora, sem preencher depois.
//   O porteiro deve justificar por fora (não há reabertura pelo app).
// • Horário é sempre capturado na hora do toque — nunca digitado à mão.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";

const GRACE_HOUR = 6; // troca de turno: prazo final de tolerância (06:00)

function pad2(n){ return String(n).padStart(2,"0"); }
function diaISO(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function fmtDataBR(iso){ try { return new Date(iso+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return iso||"—"; } }
function fmtHora(d){ return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function newId(){ try { return crypto.randomUUID(); } catch { return "id-"+Date.now()+"-"+Math.random().toString(36).slice(2,8); } }
function diaAnterior(iso){ const d=new Date(iso+"T12:00:00"); d.setDate(d.getDate()-1); return diaISO(d); }
function diaSeguinte(iso){ const d=new Date(iso+"T12:00:00"); d.setDate(d.getDate()+1); return diaISO(d); }

// Dia de referência do ciclo atual: se ainda não bateu 06:00, é o dia de
// ontem que ainda está na janela de tolerância; senão é hoje.
function diaReferenciaAtual(agora){
  const hoje = diaISO(agora);
  return agora.getHours() < GRACE_HOUR ? diaAnterior(hoje) : hoje;
}
// Passou da meia-noite do próprio dia? (tolerância, ainda dá pra registrar)
function estaAtrasado(diaRef, agora){
  const hoje = diaISO(agora);
  return diaRef !== hoje; // se o dia de referência já não é "hoje", é pq passou da meia-noite
}
// A janela de tolerância desse dia (até 06:00 do dia seguinte) já fechou?
function janelaFechada(diaRef, agora){
  const limite = new Date(diaSeguinte(diaRef)+"T00:00:00");
  limite.setHours(GRACE_HOUR,0,0,0);
  return agora.getTime() >= limite.getTime();
}

async function loadBodycam(db, doc, getDoc, projectId){
  try {
    const snap = await getDoc(doc(db,"cco_bodycam",projectId));
    if(snap.exists()) return snap.data().registros||[];
  } catch(e){}
  try {
    const l = localStorage.getItem(`cco_bodycam_${projectId}`);
    if(l) return JSON.parse(l)||[];
  } catch(e){}
  return [];
}
async function saveBodycam(db, doc, setDoc, projectId, registros){
  const payload = { registros, updatedAt:new Date().toISOString() };
  try { await setDoc(doc(db,"cco_bodycam",projectId), payload); } catch(e){ console.error("bodycam save:", e); }
  try { localStorage.setItem(`cco_bodycam_${projectId}`, JSON.stringify(payload)); } catch(e){}
}

function comprimirFoto(file){
  return new Promise((resolve)=>{
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const MAX = 640;
          let w=img.width, h=img.height;
          const s = Math.min(1, MAX/Math.max(w,h));
          w=Math.max(1,Math.round(w*s)); h=Math.max(1,Math.round(h*s));
          const c = document.createElement("canvas");
          c.width=w; c.height=h;
          c.getContext("2d").drawImage(img,0,0,w,h);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL("image/jpeg",0.6));
        } catch(e){ resolve(null); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch(e){ resolve(null); }
  });
}

function gerarPdfBodycam(project, registros){
  const agora = new Date();
  const ordenados = [...registros].sort((a,b)=>(b.dia||"").localeCompare(a.dia||""));
  const linhas = ordenados.map(r=>{
    if(r.tipo==="falta") return `<tr style="background:#fef2f2"><td>${fmtDataBR(r.dia)}</td><td colspan="6" style="color:#dc2626;font-weight:800">🔴 FALTA — não descarregado</td></tr>`;
    return `<tr>
      <td>${fmtDataBR(r.dia)}</td>
      <td>${r.horario||"—"}${r.atrasado?' <span style="color:#b45309;font-weight:700">(pós 00:00)</span>':""}</td>
      <td>${r.porteiro||"—"}</td>
      <td>☀️ ${r.liderDiurno||"—"}<br/>🌙 ${r.liderNoturno||"—"}<br/><span style="color:#64748b">${r.qtdVideosLider??"—"} vídeos (24h)</span></td>
      <td>☀️ ${r.tacticoDiurno||"—"}<br/>🌙 ${r.tacticoNoturno||"—"}<br/><span style="color:#64748b">${r.qtdVideosTatico??"—"} vídeos (24h)</span></td>
      <td style="color:${r.status==="falha"?"#dc2626":"#16a34a"};font-weight:800">${r.status==="falha"?"⚠️ Falha":"✅ OK"}</td>
      <td>${(r.obsFalha||"").replace(/</g,"&lt;")}</td>
    </tr>`;
  }).join("");
  const totalFalta = registros.filter(r=>r.tipo==="falta").length;
  const totalOk = registros.filter(r=>r.tipo!=="falta"&&r.status!=="falha").length;
  const totalFalha = registros.filter(r=>r.status==="falha").length;
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Bodycam ${project.id}</title>
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;color:#0f172a;padding:20px;max-width:900px;margin:0 auto}
  h1{font-size:19px;margin:0}
  .sub{font-size:12px;color:#64748b;margin-top:2px}
  .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}
  .kpi{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
  .kpi-val{font-size:22px;font-weight:900}
  .kpi-lbl{font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:3px}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px}
  th{background:#1e293b;color:#fff;padding:7px 9px;text-align:left;font-size:10px}
  td{padding:7px 9px;border-bottom:1px solid #f1f5f9}
  .footer{text-align:center;margin-top:18px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
  @media print{body{padding:8px}@page{margin:10mm}.no-print{display:none}*{-webkit-print-color-adjust:exact!important}}
</style></head>
<body>
<div class="no-print" style="text-align:center;margin-bottom:14px">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<h1>🎬 Descarregamento de Bodycam — ${project.id}</h1>
<div class="sub">${project.name||""} · Gerado em ${agora.toLocaleDateString("pt-BR")} às ${fmtHora(agora)}</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-val" style="color:#16a34a">${totalOk}</div><div class="kpi-lbl">OK</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#dc2626">${totalFalha}</div><div class="kpi-lbl">Falhas</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#dc2626">${totalFalta}</div><div class="kpi-lbl">Faltas</div></div>
</div>
<table>
  <thead><tr><th>Dia</th><th>Horário</th><th>Porteiro</th><th>Câmera Líder</th><th>Câmera Ronda</th><th>Status</th><th>Observação</th></tr></thead>
  <tbody>${linhas}</tbody>
</table>
<div class="footer">MokLog CheckTest · Moked Consulting Security · Bodycam ${project.id}</div>
</body></html>`;
  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bodycam_${project.id}_${agora.toLocaleDateString("sv-SE")}.html`;
  a.click();
}

export default function BodycamSection({ project, dark, S, adminAuth, db, doc, setDoc, getDoc }){
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const [porteiro, setPorteiro] = useState("");
  const [liderDiurno, setLiderDiurno] = useState("");
  const [liderNoturno, setLiderNoturno] = useState("");
  const [tacticoDiurno, setTacticoDiurno] = useState("");
  const [tacticoNoturno, setTacticoNoturno] = useState("");
  const [qtdLider, setQtdLider] = useState("");
  const [qtdTatico, setQtdTatico] = useState("");
  const [status, setStatus] = useState("ok");
  const [obsFalha, setObsFalha] = useState("");
  const [foto, setFoto] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(()=>{
    let vivo = true;
    loadBodycam(db, doc, getDoc, project.id).then(async (regs)=>{
      if(!vivo) return;
      const completos = await preencherFaltas(regs);
      setRegistros(completos);
      setLoading(false);
    });
    return ()=>{ vivo=false; };
  },[project.id]); // eslint-disable-line

  // Gera automaticamente registros de FALTA para dias cuja janela de
  // tolerância (06:00 do dia seguinte) já fechou sem nenhum registro.
  const preencherFaltas = async (regsAtuais) => {
    const agora = new Date();
    const existentes = new Set(regsAtuais.map(r=>r.dia));
    if(existentes.size===0) return regsAtuais; // primeira vez usando a aba: não retroage
    let cursor = [...regsAtuais].map(r=>r.dia).sort().pop(); // último dia conhecido
    const novasFaltas = [];
    let prox = diaSeguinte(cursor);
    let guard = 0;
    while(janelaFechada(prox, agora) && guard<60){
      if(!existentes.has(prox)){
        novasFaltas.push({ id:newId(), dia:prox, tipo:"falta", criadoEm:new Date().toISOString() });
        existentes.add(prox);
      }
      prox = diaSeguinte(prox);
      guard++;
    }
    if(novasFaltas.length===0) return regsAtuais;
    const atualizados = [...regsAtuais, ...novasFaltas];
    await saveBodycam(db, doc, setDoc, project.id, atualizados);
    return atualizados;
  };

  const agora = new Date();
  const diaRef = diaReferenciaAtual(agora);
  const atrasado = estaAtrasado(diaRef, agora);
  const jaRegistrado = registros.find(r=>r.dia===diaRef);
  const podeRegistrar = !jaRegistrado; // se já tem registro (ou falta) pro dia, não reabre

  const ordenados = [...registros].sort((a,b)=>(b.dia||"").localeCompare(a.dia||""));

  const abrirForm = () => {
    setPorteiro(""); setLiderDiurno(""); setLiderNoturno(""); setTacticoDiurno(""); setTacticoNoturno("");
    setQtdLider(""); setQtdTatico(""); setStatus("ok"); setObsFalha(""); setFoto(null); setErro(null);
    setShowForm(true);
  };

  const addFoto = async (file) => {
    if(!file) return;
    const b64 = await comprimirFoto(file);
    if(b64) setFoto(b64); else setErro("Não consegui processar essa foto.");
  };

  const registrar = async () => {
    if(!porteiro.trim()){ setErro("Informe o nome do porteiro que está descarregando."); return; }
    if(!liderDiurno.trim()){ setErro("Informe o nome do líder diurno (câmera do líder)."); return; }
    if(!liderNoturno.trim()){ setErro("Informe o nome do líder noturno (câmera do líder)."); return; }
    if(!tacticoDiurno.trim()){ setErro("Informe o nome do vigilante ronda/tático diurno."); return; }
    if(!tacticoNoturno.trim()){ setErro("Informe o nome do vigilante ronda/tático noturno."); return; }
    if(qtdLider===""||qtdTatico===""){ setErro("Informe a quantidade de vídeos das duas câmeras (período de 24h)."); return; }
    if(status==="falha" && !obsFalha.trim()){ setErro("Descreva a falha apresentada."); return; }
    const agoraSalvar = new Date();
    const registro = {
      id:newId(), dia:diaRef, tipo:"registro",
      porteiro:porteiro.trim(),
      liderDiurno:liderDiurno.trim(), liderNoturno:liderNoturno.trim(),
      tacticoDiurno:tacticoDiurno.trim(), tacticoNoturno:tacticoNoturno.trim(),
      qtdVideosLider:Number(qtdLider)||0, qtdVideosTatico:Number(qtdTatico)||0,
      horario:fmtHora(agoraSalvar), status, obsFalha:status==="falha"?obsFalha.trim():"",
      foto, atrasado, criadoEm:agoraSalvar.toISOString(),
    };
    const atualizados = [...registros, registro];
    setSaving(true);
    setRegistros(atualizados);
    await saveBodycam(db, doc, setDoc, project.id, atualizados);
    setSaving(false);
    setShowForm(false);
  };

  const baixarPdf = async () => {
    setGerandoPdf(true);
    gerarPdfBodycam(project, registros);
    setGerandoPdf(false);
  };

  if(loading) return <div style={{textAlign:"center",padding:"30px 0",fontSize:13,...S.txt2}}>Carregando bodycam…</div>;

  // ── Formulário de registro
  if(showForm) return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={S.card}>
        <div style={{fontSize:14,fontWeight:800,...S.txt,marginBottom:4}}>🎬 Descarregamento de Bodycam</div>
        <div style={{fontSize:11,...S.txt2}}>Referente ao dia <b>{fmtDataBR(diaRef)}</b> · horário registrado automaticamente ({fmtHora(new Date())})</div>
        {atrasado && (
          <div style={{marginTop:8,background:"#1a1000",border:"1px solid #f59e0b55",borderRadius:8,padding:"8px 12px"}}>
            <div style={{fontSize:12,color:"#f59e0b",fontWeight:800}}>⚠️ Descarregado pós 00:00 — em atraso</div>
          </div>
        )}
      </div>
      <div style={S.card}>
        <label style={S.lbl}>Nome do porteiro (quem descarrega)</label>
        <input value={porteiro} onChange={e=>{setPorteiro(e.target.value);setErro(null);}} placeholder="Nome completo" style={S.inp}/>
      </div>
      <div style={S.card}>
        <div style={{fontSize:12,fontWeight:800,...S.txt,marginBottom:8}}>🎥 Câmera do Líder <span style={{fontWeight:600,...S.txt2}}>(cobre as 24h — os dois turnos)</span></div>
        <label style={S.lbl}>☀️ Líder Diurno</label>
        <input value={liderDiurno} onChange={e=>{setLiderDiurno(e.target.value);setErro(null);}} placeholder="Nome completo" style={{...S.inp,marginBottom:10}}/>
        <label style={S.lbl}>🌙 Líder Noturno</label>
        <input value={liderNoturno} onChange={e=>{setLiderNoturno(e.target.value);setErro(null);}} placeholder="Nome completo" style={{...S.inp,marginBottom:10}}/>
        <label style={S.lbl}>Quantidade de vídeos (24h)</label>
        <input value={qtdLider} inputMode="numeric" onChange={e=>{setQtdLider(e.target.value.replace(/[^0-9]/g,""));setErro(null);}} placeholder="Ex: 21" style={S.inp}/>
      </div>
      <div style={S.card}>
        <div style={{fontSize:12,fontWeight:800,...S.txt,marginBottom:8}}>🎥 Câmera do Tático / Ronda <span style={{fontWeight:600,...S.txt2}}>(cobre as 24h — os dois turnos)</span></div>
        <label style={S.lbl}>☀️ Vigilante Ronda Diurno</label>
        <input value={tacticoDiurno} onChange={e=>{setTacticoDiurno(e.target.value);setErro(null);}} placeholder="Nome completo" style={{...S.inp,marginBottom:10}}/>
        <label style={S.lbl}>🌙 Vigilante Ronda Noturno</label>
        <input value={tacticoNoturno} onChange={e=>{setTacticoNoturno(e.target.value);setErro(null);}} placeholder="Nome completo" style={{...S.inp,marginBottom:10}}/>
        <label style={S.lbl}>Quantidade de vídeos (24h)</label>
        <input value={qtdTatico} inputMode="numeric" onChange={e=>{setQtdTatico(e.target.value.replace(/[^0-9]/g,""));setErro(null);}} placeholder="Ex: 8" style={S.inp}/>
      </div>
      <div style={S.card}>
        <label style={S.lbl}>Status do descarregamento</label>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setStatus("ok")} style={{flex:1,padding:"11px",borderRadius:8,fontWeight:800,fontSize:13,cursor:"pointer",
            border:`1px solid ${status==="ok"?"#22c55e":(dark?"#0f172a":"#e2e8f0")}`,
            background:status==="ok"?"#22c55e22":(dark?"#020510":"#fff"),
            color:status==="ok"?"#22c55e":(dark?"#64748b":"#94a3b8")}}>✅ OK</button>
          <button onClick={()=>setStatus("falha")} style={{flex:1,padding:"11px",borderRadius:8,fontWeight:800,fontSize:13,cursor:"pointer",
            border:`1px solid ${status==="falha"?"#ef4444":(dark?"#0f172a":"#e2e8f0")}`,
            background:status==="falha"?"#ef444422":(dark?"#020510":"#fff"),
            color:status==="falha"?"#ef4444":(dark?"#64748b":"#94a3b8")}}>⚠️ Falha</button>
        </div>
        {status==="falha" && (
          <textarea value={obsFalha} onChange={e=>{setObsFalha(e.target.value);setErro(null);}} rows={2} placeholder="Descreva a falha apresentada..."
            style={{...S.inp,marginTop:8,resize:"vertical",fontFamily:"inherit"}}/>
        )}
      </div>
      <div style={S.card}>
        <label style={S.lbl}>Foto (opcional)</label>
        {foto ? (
          <div style={{position:"relative",width:96,height:96}}>
            <img src={foto} alt="Foto" style={{width:96,height:96,objectFit:"cover",borderRadius:8,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}/>
            <button onClick={()=>setFoto(null)} style={{position:"absolute",top:-6,right:-6,background:"#ef4444",color:"#fff",border:"none",borderRadius:"50%",width:21,height:21,fontSize:12,cursor:"pointer"}}>×</button>
          </div>
        ) : (
          <div style={{display:"flex",gap:8}}>
            <label style={{...S.btnSec,flex:1,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              📷 Câmera
              <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{addFoto(e.target.files?.[0]);e.target.value="";}}/>
            </label>
            <label style={{...S.btnSec,flex:1,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              🖼️ Galeria
              <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{addFoto(e.target.files?.[0]);e.target.value="";}}/>
            </label>
          </div>
        )}
      </div>
      {erro && <div role="alert" style={{fontSize:12,color:"#ef4444",textAlign:"center"}}>{erro}</div>}
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setShowForm(false)} style={{...S.btnSec,flex:1,fontSize:13}}>Cancelar</button>
        <button onClick={registrar} disabled={saving} style={{...S.btn,flex:1,fontSize:13}}>{saving?"Salvando…":"✓ Registrar"}</button>
      </div>
    </div>
  );

  // ── Home da aba: status do dia + histórico
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{...S.card,border:`1px solid ${jaRegistrado?(jaRegistrado.tipo==="falta"?"#ef444455":"#22c55e33"):"#f59e0b55"}`}}>
        <div style={{fontSize:13,fontWeight:800,...S.txt,marginBottom:6}}>🎬 Descarregamento de hoje</div>
        {jaRegistrado ? (
          jaRegistrado.tipo==="falta" ? (
            <div style={{fontSize:13,color:"#ef4444",fontWeight:800}}>🔴 FALTA — {fmtDataBR(jaRegistrado.dia)} não foi descarregado</div>
          ) : (
            <div>
              <div style={{fontSize:13,color:jaRegistrado.status==="falha"?"#f59e0b":"#22c55e",fontWeight:800}}>
                {jaRegistrado.status==="falha"?"⚠️ Registrado com falha":"✅ Descarregado"} · {fmtDataBR(jaRegistrado.dia)} às {jaRegistrado.horario}
              </div>
              {jaRegistrado.atrasado && <div style={{fontSize:11,color:"#f59e0b",marginTop:2,fontWeight:700}}>Pós 00:00 (em atraso)</div>}
            </div>
          )
        ) : (
          <div style={{fontSize:12,...S.txt2}}>Ainda não descarregado — referente a {fmtDataBR(diaRef)}{atrasado?" (já passou da meia-noite, tolerância até 06:00)":""}.</div>
        )}
      </div>

      {podeRegistrar && (
        <button onClick={abrirForm} style={S.btn}>▶ Registrar Descarregamento{atrasado?" (atrasado)":""}</button>
      )}
      {adminAuth && registros.length>0 && (
        <button onClick={baixarPdf} disabled={gerandoPdf} style={{...S.btnSec,fontSize:13,color:"#7c3aed",borderColor:"#7c3aed44"}}>
          {gerandoPdf?"Gerando…":"📄 Gerar PDF (gerencial)"}
        </button>
      )}

      {ordenados.length>0 && <div style={{fontSize:11,...S.txt2,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginTop:4}}>Histórico ({ordenados.length})</div>}
      {ordenados.map(r=>(
        <div key={r.id} style={{...S.card,padding:"10px 14px"}}>
          {r.tipo==="falta" ? (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,fontWeight:700,...S.txt}}>{fmtDataBR(r.dia)}</div>
              <span style={{fontSize:10,fontWeight:800,color:"#ef4444",background:"#1a0202",border:"1px solid #ef444433",padding:"3px 9px",borderRadius:6}}>🔴 FALTA</span>
            </div>
          ) : (
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:12,fontWeight:700,...S.txt}}>{fmtDataBR(r.dia)} · {r.horario}</div>
                <div style={{display:"flex",gap:6}}>
                  {r.atrasado && <span style={{fontSize:9,fontWeight:800,color:"#f59e0b",background:"#1a1000",border:"1px solid #f59e0b44",padding:"2px 7px",borderRadius:5}}>PÓS 00:00</span>}
                  <span style={{fontSize:9,fontWeight:800,color:r.status==="falha"?"#ef4444":"#22c55e",background:r.status==="falha"?"#1a0202":"#021a0d",border:`1px solid ${r.status==="falha"?"#ef444433":"#22c55e33"}`,padding:"2px 7px",borderRadius:5}}>{r.status==="falha"?"FALHA":"OK"}</span>
                </div>
              </div>
              <div style={{fontSize:11,...S.txt2,marginTop:4}}>Porteiro: {r.porteiro}</div>
              <div style={{fontSize:11,...S.txt2}}>🎥 Líder: ☀️ {r.liderDiurno||"—"} · 🌙 {r.liderNoturno||"—"} ({r.qtdVideosLider} vídeos)</div>
              <div style={{fontSize:11,...S.txt2}}>🎥 Ronda: ☀️ {r.tacticoDiurno||"—"} · 🌙 {r.tacticoNoturno||"—"} ({r.qtdVideosTatico} vídeos)</div>
              {r.obsFalha && <div style={{fontSize:11,color:"#ef4444",marginTop:4}}>{r.obsFalha}</div>}
              {r.foto && <img src={r.foto} alt="Foto" style={{width:80,height:80,objectFit:"cover",borderRadius:8,marginTop:8,border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`}}/>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
