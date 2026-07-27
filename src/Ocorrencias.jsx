// ─────────────────────────────────────────────────────────────
// Ocorrencias.jsx — Módulo de Registro Situacional (RS) do MokLog CheckTest
//
// Traz o registro de ocorrências para dentro do app (substitui o fluxo
// externo 2CONTROL), com taxonomia 100% logística (rsCatalogo.js).
//
// Padrão AcessoCCO: auto-suficiente (importa o próprio Firebase + fireGuard),
// recebe apenas { project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }.
//
// Três telas: Registrar / Histórico / Recorrência.
//
// Regras de ouro respeitadas:
//   • Aditivo: coleção nova `ocorrencias/{pid}` → { registros:[...] }. Não toca legado.
//   • Escrita via fireGuard (setDoc) → modo demo (GAL) não persiste.
//   • MERGE por registro na gravação (relê Firestore, funde por id, mantém o
//     mais recente por updatedAt) — evita perda de dados na reconexão multiusuário
//     (mesmo bug corrigido no RondaVirtual).
//   • Mascaramento LGPD: documento/telefone crus só para admin (getAccess).
//     Líder vê mascarado na tela; no PDF é SEMPRE mascarado (rsPdf.js).
//   • Datas locais com toLocaleDateString("sv-SE") — bug de UTC conhecido.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { setDoc } from "./fireGuard";
import { getAccess, grantSession } from "./session";
import {
  NATUREZAS, SEVERIDADES, FLAGS, RS_STATUS,
  getNatureza, getSubtipo, sevLabel, sevCor, montarRascunho, subtipoTemVeiculo,
} from "./rsCatalogo";
import { gerarPdfRS, gerarPdfPacoteRS } from "./rsPdf";

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

const COLLECTION = "ocorrencias"; // ← coleção nova e aditiva: ocorrencias/{pid}
const ADMIN_PIN = "872101";
const DEMO_PIN = "601604";
const PROJECT_PINS = {
  P601:"16601",P602:"16602",P604:"16604",P605:"16605",
  P606:"16606",P607:"16607",P311A:"16311",P311B:"16311",
  P505:"16505",P260A:"162601",P260B:"162602",P260C:"162603"
};

// ── Estilos (mesma linguagem visual do AcessoCCO) ─────────────
function getStyles(dark) {
  return {
    page:    { minHeight:"100vh", background:dark?"#04080f":"#f1f5f9", display:"flex", justifyContent:"center", padding:"0 0 80px", fontFamily:"'Segoe UI',system-ui,sans-serif" },
    wrap:    { width:"100%", maxWidth:480, display:"flex", flexDirection:"column" },
    card:    { background:dark?"#060c18":"#ffffff", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:12, padding:"14px 16px" },
    btn:     { background:"linear-gradient(135deg,#1d4ed8,#1e40af)", color:"#fff", border:"none", borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:700, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
    btnSec:  { background:dark?"#060c18":"#f8fafc", color:dark?"#94a3b8":"#64748b", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:10, padding:"13px 16px", fontSize:14, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center" },
    btnSm:   { background:dark?"#020510":"#f8fafc", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#94a3b8":"#64748b", borderRadius:6, padding:"5px 10px", fontSize:11, cursor:"pointer", fontWeight:600 },
    backBtn: { background:"transparent", border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, color:dark?"#94a3b8":"#94a3b8", borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", flexShrink:0, fontWeight:600 },
    inp:     { width:"100%", background:dark?"#020510":"#ffffff", border:`1px solid ${dark?"#0f172a":"#cbd5e1"}`, borderRadius:7, color:dark?"#e2e8f0":"#1e293b", padding:"10px 12px", fontSize:13, boxSizing:"border-box", outline:"none" },
    lbl:     { display:"block", fontSize:11, color:dark?"#64748b":"#94a3b8", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:.5 },
    txt:     { color:dark?"#f1f5f9":"#0f172a" },
    txt2:    { color:dark?"#64748b":"#94a3b8" },
  };
}

// ── Helpers de data (locais — bug de UTC conhecido) ───────────
function hojeLocal() { return new Date().toLocaleDateString("sv-SE"); } // YYYY-MM-DD
function agoraHoraLocal() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function fmtDataHoraBR(iso) {
  if(!iso) return "--";
  const [d,h] = String(iso).split("T");
  if(!d) return "--";
  const [a,m,dia] = d.split("-");
  if(!a) return iso;
  return h ? `${dia}/${m}/${a} ${h.slice(0,5)}` : `${dia}/${m}/${a}`;
}
function daysSince(iso) {
  if(!iso) return null;
  const d = String(iso).split("T")[0];
  try { return Math.floor((Date.now()-new Date(d+"T12:00:00").getTime())/86400000); } catch { return null; }
}

// ── Mascaramento LGPD (para exibição ao líder na tela) ────────
function mascararDoc(v) {
  if(!v) return "";
  const s = String(v).replace(/\D/g,"");
  if(s.length===11) return `${s.slice(0,3)}.***.***-${s.slice(9)}`;
  if(s.length===14) return `${s.slice(0,2)}.***.***/****-${s.slice(12)}`;
  if(s.length<=4) return "***";
  return `${s.slice(0,2)}${"*".repeat(Math.max(0,s.length-4))}${s.slice(-2)}`;
}
function mascararTel(v) {
  if(!v) return "";
  const s = String(v).replace(/\D/g,"");
  if(s.length<6) return "****";
  return `(${s.slice(0,2)}) *****-${s.slice(-2)}`;
}

// ── Form vazio ────────────────────────────────────────────────
function emptyForm() {
  return {
    id: "",
    natureza: "",           // key da categoria (VEICULO, PESSOA, ...)
    subtipo: "",            // key do subtipo
    severidade: "",         // "" → usa sevPadrao do subtipo
    dataHora: `${hojeLocal()}T${agoraHoraLocal()}`,
    horaFim: "",            // "HH:mm" puro (opcional)
    lider: "",
    assinatura: "",         // assinatura do responsável (auto = lider, editável)
    quemAvisou: "",
    quemAvisado: "",
    envolvidos: [{ nome:"", documento:"" }],
    nomeEnvolvido: "",
    documentoEnvolvido: "",
    telefoneEnvolvido: "",
    transportadora: "",
    inquilino: "",
    veiculos: [{ placa:"", tipo:"" }],
    placaCavalo: "",
    placaCarreta: "",
    placaVeiculo: "",
    reincidente: false,
    reincidenteDe: [],
    local: "",
    resumo: "",
    detalhamento: "",
    medidas: "",
    observacao: "",
    flags: [],              // array de keys de FLAGS
    flagDescs: {},          // descrição opcional por flag marcada { key: texto }
    fotos: [],              // [{ origem:"local"|"cftv", legenda, dataUrl }]
    status: RS_STATUS.PENDENTE,
  };
}

// ── ADAPTADOR form → vocabulário do catálogo ──────────────────
// O catálogo (montarRascunho e obrigatorios) fala { hora, doc, horaFim, ... }.
// O form fala { dataHora, documentoEnvolvido, horaFim, ... }. Traduz aqui.
function horaDe(dataHora) {
  const p = String(dataHora||"").split("T")[1];
  return p ? p.slice(0,5) : "";
}
function formParaCatalogo(form) {
  return {
    hora:          horaDe(form.dataHora),
    horaFim:       form.horaFim || "",
    nome:          form.nomeEnvolvido || "",
    doc:           form.documentoEnvolvido || "",
    placaCavalo:   form.placaCavalo || "",
    placaCarreta:  form.placaCarreta || "",
    transportadora:form.transportadora || "",
    inquilino:     form.inquilino || "",
    local:         form.local || "",
    quemAvisou:    form.quemAvisou || "",
    medidas:       form.medidas || "",
  };
}

// Mapa: obrigatório do catálogo → verificador no form.
// (o catálogo usa horaInicio/fotoLocal/detalhamento; o form tem outras chaves)
function obrigatorioSatisfeito(chave, form) {
  switch(chave) {
    case "horaInicio":   return !!horaDe(form.dataHora);
    case "detalhamento": return !!(form.detalhamento||"").trim();
    case "medidas":      return !!(form.medidas||"").trim();
    case "local":        return !!(form.local||"").trim();
    case "placaCavalo":  return placasDeVeiculos(form).length>0 || !!(form.placaCavalo||"").trim();
    case "fotoLocal":    return (form.fotos||[]).some(f=>(f.origem||"local")==="local");
    default:             return !!(form[chave]||"").toString().trim();
  }
}
function validarForm(form) {
  if(!form.natureza) return "Selecione a categoria da ocorrência.";
  if(!form.subtipo)  return "Selecione o subtipo da ocorrência.";
  const sub = getSubtipo(form.subtipo);
  const faltando = (sub?.obrigatorios||[]).filter(k=>!obrigatorioSatisfeito(k,form));
  if(faltando.length) {
    const nomes = { horaInicio:"horário de início", detalhamento:"detalhamento",
      medidas:"medidas tomadas", local:"local", placaCavalo:"placa do veículo",
      fotoLocal:"foto do local" };
    return "Preencha os campos obrigatórios: " + faltando.map(k=>nomes[k]||k).join(", ") + ".";
  }
  return null;
}

// ── Firebase load/save COM MERGE por registro ─────────────────
// ── Reincidência: normalização e busca por nome/documento/placa ──
function normNome(v){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/\s+/g," ").trim();
}
function normDoc(v){ return String(v||"").replace(/\D/g,""); }
function normPlaca(v){ return String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,""); }
function placasDe(o){
  const legadas = [o&&o.placaCavalo, o&&o.placaCarreta, o&&o.placaVeiculo];
  const novas = [];
  if(o && Array.isArray(o.veiculos)) o.veiculos.forEach(v=>{ if(v){ novas.push(v.placa); novas.push(v.placaCavalo); } });
  return [...legadas, ...novas].map(normPlaca).filter(Boolean);
}
// ── Envio por e-mail (Outlook web). Corpo em texto cru (uso interno). ──
function corpoEmailRS(project, r){
  const nat = getNatureza(r.natureza), sub = getSubtipo(r.subtipo);
  const sev = r.severidade || (sub && sub.sevPadrao) || "info";
  const sevMap = { info:"INFORMATIVO / BAIXA", atencao:"ATENCAO / MEDIA", critico:"CRITICO / ALTA" };
  const idtxt = r.id || ((project && project.id) || "RS");
  const L = [];
  L.push("MOKED SECURITY CONSULTING");
  L.push("RELATORIO SITUACIONAL (RS)");
  L.push("========================================");
  if(project) L.push((project.id||"") + " - " + (project.name||""));
  L.push("RS No: " + idtxt + "   |   Data: " + fmtDataHoraBR(r.dataHora || r.registradoEm));
  L.push("Consultor: Jose Fonseca");
  L.push("");
  L.push("CLASSIFICACAO");
  L.push("Natureza: " + ((nat && nat.label) || r.natureza || "-"));
  L.push("Ocorrencia: " + ((sub && sub.label) || r.subtipo || "-"));
  L.push("Severidade: " + (sevMap[sev] || sevLabel(sev)));
  if(r.reincidente) L.push("** REINCIDENTE - vinculado a " + ((r.reincidenteDe||[]).length) + " RS anterior(es) **");
  L.push("");
  L.push("DADOS DA OCORRENCIA");
  L.push("Data / Hora: " + fmtDataHoraBR(r.dataHora || r.registradoEm));
  if(r.horaFim) L.push("Normalizacao: " + r.horaFim);
  if(r.lider) L.push("Lider Operacional: " + r.lider);
  if(r.quemAvisou) L.push("Origem do Alerta: " + r.quemAvisou);
  if(r.quemAvisado) L.push("Comunicado a: " + r.quemAvisado);
  const evs = (r.envolvidos && r.envolvidos.length) ? r.envolvidos
    : (r.nomeEnvolvido || r.documentoEnvolvido ? [{nome:r.nomeEnvolvido, documento:r.documentoEnvolvido}] : []);
  if(evs.length){
    L.push("Envolvido(s):");
    evs.forEach((ev,i)=>{ const p=[]; if(ev.nome)p.push(ev.nome); if(ev.documento)p.push("CPF/CNPJ "+ev.documento); if(p.length)L.push("   " + (i+1) + ". " + p.join(" - ")); });
  }
  if(r.telefoneEnvolvido) L.push("Telefone: " + r.telefoneEnvolvido);
  if(r.transportadora || r.inquilino) L.push("Transportadora / Inquilino: " + (r.transportadora || r.inquilino));
  if(r.placaCavalo && r.placaCarreta){
    L.push("Placa do Veiculo: Cavalo " + r.placaCavalo + " / Carreta " + r.placaCarreta + (r.placaVeiculo ? " / " + r.placaVeiculo : ""));
  } else {
    const placas = [r.placaCavalo, r.placaCarreta, r.placaVeiculo].filter(Boolean);
    if(placas.length) L.push("Placa do Veiculo: " + placas.join(" / "));
  }
  if(r.local) L.push("Local do Evento: " + r.local);
  if(r.resumo){ L.push(""); L.push("RESUMO DO EVENTO"); L.push(r.resumo); }
  if(r.detalhamento){ L.push(""); L.push("DETALHAMENTO OPERACIONAL"); L.push(r.detalhamento); }
  if(r.medidas){ L.push(""); L.push("MEDIDAS IMEDIATAS ADOTADAS"); L.push(r.medidas); }
  if(r.observacao){ L.push(""); L.push("OBSERVACOES DE INTELIGENCIA / CFTV"); L.push(r.observacao); }
  const nFotos = (r.fotos||[]).length;
  if(nFotos){ L.push(""); L.push(nFotos + " evidencia(s) fotografica(s) no registro - baixe o PDF e anexe a este e-mail."); }
  L.push("");
  L.push("----------------------------------------");
  L.push("MOKED SECURITY CONSULTING - Documento de Uso Interno e Confidencial");
  L.push("Gerado pelo MokLog CheckTest");
  return L.join("\n");
}
function assuntoEmailRS(project, r){
  const sub = getSubtipo(r.subtipo);
  const idtxt = r.id || ((project && project.id) || "RS");
  return "RS " + idtxt + " - " + ((sub && sub.label) || r.subtipo || "Ocorrencia");
}
function enviarRSOutlook(project, r){
  const subject = encodeURIComponent(assuntoEmailRS(project, r));
  const body = encodeURIComponent(corpoEmailRS(project, r));
  const url = "https://outlook.office.com/mail/deeplink/compose?subject=" + subject + "&body=" + body;
  try { window.open(url, "_blank"); } catch(e){ alert("Nao foi possivel abrir o Outlook."); }
}
// ── Envio por WhatsApp (mesmo padrao do checklist de domingo: wa.me/?text=). Texto cru, uso interno. ──
function enviarRSWhatsapp(project, r){
  const body = encodeURIComponent(corpoEmailRS(project, r));
  const url = "https://wa.me/?text=" + body;
  try { window.open(url, "_blank"); } catch(e){ alert("Nao foi possivel abrir o WhatsApp."); }
}

// ── Veículos: tipos + migração dos campos legados de placa ──
const TIPOS_VEICULO = ["Moto","Automóvel","Van","Ônibus","Caminhão","Carreta"];
function migrarVeiculos(o){
  if(o && Array.isArray(o.veiculos) && o.veiculos.length) return o.veiculos;
  const vs = [];
  if(o){
    if(o.placaCarreta){
      // Carreta + cavalo do legado viram UMA linha (placa=carreta, placaCavalo=trator).
      vs.push({ placa:o.placaCarreta, tipo:"Carreta", placaCavalo:o.placaCavalo||"" });
    } else if(o.placaCavalo){
      vs.push({ placa:o.placaCavalo, tipo:"Caminhão" });
    }
    if(o.placaVeiculo) vs.push({ placa:o.placaVeiculo, tipo:"Automóvel" });
  }
  return vs.length ? vs : [{ placa:"", tipo:"" }];
}
function placasDeVeiculos(o){
  const out = [];
  migrarVeiculos(o).forEach(v=>{ if(v&&v.placa)out.push(v.placa); if(v&&v.placaCavalo)out.push(v.placaCavalo); });
  return out;
}

function migrarEnvolvidos(o){
  if(o && Array.isArray(o.envolvidos) && o.envolvidos.length) return o.envolvidos;
  if(o && (o.nomeEnvolvido || o.documentoEnvolvido))
    return [{ nome:o.nomeEnvolvido||"", documento:o.documentoEnvolvido||"" }];
  return [{ nome:"", documento:"" }];
}
function envolvidosNomes(o){ return migrarEnvolvidos(o).map(e=>e&&e.nome).filter(Boolean); }
function envolvidosDocs(o){ return migrarEnvolvidos(o).map(e=>e&&e.documento).filter(Boolean); }

function buscarReincidencias(registros, form){
  const nomes = envolvidosNomes(form).map(normNome).filter(Boolean);
  const docs  = envolvidosDocs(form).map(normDoc).filter(Boolean);
  const placas = placasDe(form);
  if(nomes.length===0 && docs.length===0 && placas.length===0) return [];
  if(!form.natureza) return [];
  return (registros||[]).filter(r=>{
    if(!r || r.id===form.id) return false;
    if(r.natureza !== form.natureza) return false;
    const rn = envolvidosNomes(r).map(normNome).filter(Boolean);
    const rd = envolvidosDocs(r).map(normDoc).filter(Boolean);
    const casaNome  = nomes.length>0 && rn.some(n=>nomes.includes(n));
    const casaDoc   = docs.length>0  && rd.some(d=>docs.includes(d));
    const rp = placasDe(r);
    const casaPlaca = placas.length>0 && rp.some(p=>placas.includes(p));
    return casaNome || casaDoc || casaPlaca;
  }).sort((a,b)=>String(b.dataHora||b.registradoEm||"").localeCompare(String(a.dataHora||a.registradoEm||"")));
}

async function loadRegistros(projectId) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, projectId));
    if(snap.exists()) {
      const data = snap.data();
      const regs = data.registros || [];
      try { localStorage.setItem(`${COLLECTION}_${projectId}`, JSON.stringify(regs)); } catch(e){}
      return regs;
    }
  } catch(e){}
  try {
    const local = localStorage.getItem(`${COLLECTION}_${projectId}`);
    if(local) return JSON.parse(local);
  } catch(e){}
  return [];
}

// Funde duas listas por id, mantendo a versão mais recente por updatedAt.
function mergePorId(remota, local) {
  const map = new Map();
  const put = (r) => {
    if(!r || !r.id) return;
    const ex = map.get(r.id);
    if(!ex) { map.set(r.id, r); return; }
    const tEx = Date.parse(ex.updatedAt||ex.registradoEm||0) || 0;
    const tNv = Date.parse(r.updatedAt ||r.registradoEm ||0) || 0;
    if(tNv >= tEx) map.set(r.id, r);
  };
  (remota||[]).forEach(put);
  (local ||[]).forEach(put);
  // ordena por dataHora desc (mais recente primeiro)
  return Array.from(map.values()).sort((a,b)=>
    String(b.dataHora||b.registradoEm||"").localeCompare(String(a.dataHora||a.registradoEm||"")));
}

// Salva 1 registro: relê o Firestore, funde por id, grava a lista fundida.
// Evita que a reconexão do onSnapshot ressuscite/derrube registros de outro device.
async function persistirRegistro(projectId, registro, listaLocal) {
  let remota = [];
  try {
    const snap = await getDoc(doc(db, COLLECTION, projectId));
    if(snap.exists()) remota = snap.data().registros || [];
  } catch(e){}
  const fundida = mergePorId(remota, [...(listaLocal||[]), registro]);
  try {
    await setDoc(doc(db, COLLECTION, projectId), { registros:fundida, updatedAt:new Date().toISOString() });
  } catch(e){ console.error("RS save error:", e); }
  try { localStorage.setItem(`${COLLECTION}_${projectId}`, JSON.stringify(fundida)); } catch(e){}
  return fundida;
}

// ── Análise de recorrência (contagem por subtipo, janela de dias) ──
function analisarRecorrencia(registros, janelaDias) {
  const corte = janelaDias ? Date.now() - janelaDias*86400000 : 0;
  const cont = {};
  (registros||[]).forEach(r=>{
    const d = String(r.dataHora||r.registradoEm||"").split("T")[0];
    const t = d ? (Date.parse(d+"T12:00:00")||0) : 0;
    if(corte && t < corte) return;
    const k = r.subtipo || "—";
    if(!cont[k]) cont[k] = { subtipo:k, n:0, ultima:"", critico:0 };
    cont[k].n++;
    if((r.severidade||getSubtipo(k)?.sevPadrao)==="critico") cont[k].critico++;
    const di = String(r.dataHora||r.registradoEm||"");
    if(di > cont[k].ultima) cont[k].ultima = di;
  });
  return Object.values(cont).sort((a,b)=> b.n-a.n || String(b.ultima).localeCompare(String(a.ultima)));
}

// ════════════════════════════════════════════════════════════════
// PIN GATE
// ════════════════════════════════════════════════════════════════
function PinGate({ project, onSuccess, onBack, dark }) {
  const S = getStyles(dark);
  const [mode, setMode] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const tryPin = () => {
    if(pin===DEMO_PIN){ grantSession("demo"); onSuccess("admin"); return; }
    if(pin===ADMIN_PIN){ grantSession("admin"); onSuccess("admin"); return; }
    if(pin===PROJECT_PINS[project.id]){ grantSession("lider", project.id); onSuccess("lider"); return; }
    setErr(true);
  };
  return (
    <div style={{...S.page, alignItems:"center", justifyContent:"center"}}>
      <div style={{...S.card, maxWidth:320, width:"100%", margin:16, textAlign:"center"}}>
        <div style={{fontSize:32, marginBottom:8}}>📋</div>
        <div style={{fontSize:16, fontWeight:800, ...S.txt, marginBottom:4}}>Registro Situacional</div>
        <div style={{fontSize:12, ...S.txt2, marginBottom:20}}>{project?.id||""} · {project?.name||""}</div>
        {!mode ? (
          <div style={{display:"flex", flexDirection:"column", gap:8}}>
            <button onClick={()=>setMode("lider")} style={{...S.btn, background:"linear-gradient(135deg,#b45309,#92400e)", fontSize:13}}>📋 Acesso Líder / Vigilante</button>
            <button onClick={()=>setMode("admin")} style={{...S.btnSec, fontSize:13, color:"#f59e0b", borderColor:"#f59e0b33"}}>🔐 Acesso Gerencial</button>
            <button onClick={onBack} style={{...S.btnSec, fontSize:13, marginTop:4}}>← Voltar</button>
          </div>
        ) : (
          <>
            <div style={{fontSize:12, ...S.txt2, marginBottom:12}}>{mode==="lider"?"PIN do projeto":"PIN gerencial"}</div>
            <input type="password" inputMode="numeric" placeholder="PIN" maxLength={8}
              value={pin} onChange={e=>{setPin(e.target.value);setErr(false);}}
              onKeyDown={e=>{if(e.key==="Enter") tryPin();}}
              style={{...S.inp, textAlign:"center", fontSize:22, letterSpacing:10, marginBottom:8}}/>
            {err && <div style={{fontSize:12, color:"#ef4444", marginBottom:8}}>PIN incorreto</div>}
            <div style={{display:"flex", gap:8}}>
              <button onClick={()=>{setMode(null);setPin("");setErr(false);}} style={{...S.btnSec, flex:1, fontSize:13}}>← Voltar</button>
              <button onClick={tryPin} style={{...S.btn, flex:1, fontSize:13}}>Entrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════
export default function Ocorrencias({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }) {
  const S = getStyles(dark||true);
  const [authLevel, setAuthLevel] = useState(()=>sharedAuth||getAccess(project?.id)||null);
  const [screen, setScreen] = useState(()=>(sharedAuth||getAccess(project?.id))?"registrar":"pin"); // pin | registrar | historico | recorrencia
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [janela, setJanela] = useState(30); // janela da recorrência (dias)
  const [filtroStatus, setFiltroStatus] = useState("todos"); // todos | pendente | arquivado
  const [reincIgnorada, setReincIgnorada] = useState(false);
  const [temRascunho, setTemRascunho] = useState(false);
  const [rascunhoSalvoEm, setRascunhoSalvoEm] = useState(null); // horario do ultimo salvamento de rascunho (feedback)
  // ── Autosave automático do rascunho (rede de segurança) ──
  const rsTocado = useRef(false);        // vira true quando o usuário mexe no form
  const rsAutosaveTimer = useRef(null);  // debounce
  const rsFormRef = useRef(form);        // aponta sempre para o form mais recente
  useEffect(()=>{ rsFormRef.current = form; },[form]);
  const setF = (k,v) => { rsTocado.current = true; setForm(f=>({...f,[k]:v})); };
  const addVeiculo = () => { rsTocado.current=true; setForm(f=>({...f, veiculos:[...(f.veiculos||[]), { placa:"", tipo:"" }]})); };
  const removeVeiculo = (idx) => { rsTocado.current=true; setForm(f=>{
    const arr=(f.veiculos||[]).filter((_,i)=>i!==idx);
    return {...f, veiculos: arr.length? arr : [{ placa:"", tipo:"" }]};
  }); };
  const setVeiculo = (idx,campo,val) => { rsTocado.current=true; setForm(f=>({
    ...f, veiculos:(f.veiculos||[]).map((v,i)=>i===idx?{...v,[campo]:val}:v)
  })); };
  const addEnvolvido = () => { rsTocado.current=true; setForm(f=>({...f, envolvidos:[...(f.envolvidos||[]), { nome:"", documento:"" }]})); };
  const removeEnvolvido = (idx) => { rsTocado.current=true; setForm(f=>{
    const arr=(f.envolvidos||[]).filter((_,i)=>i!==idx);
    return {...f, envolvidos: arr.length? arr : [{ nome:"", documento:"" }]};
  }); };
  const setEnvolvido = (idx,campo,val) => { rsTocado.current=true; setForm(f=>({
    ...f, envolvidos:(f.envolvidos||[]).map((e,i)=>i===idx?{...e,[campo]:val}:e)
  })); };

  const adminAuth = authLevel==="admin";

  // Carrega registros ao autenticar
  useEffect(()=>{
    if(!project?.id || screen==="pin") return;
    setLoading(true);
    loadRegistros(project.id).then(r=>{
      setRegistros(mergePorId(r, []));
      setLoading(false);
    });
  },[project?.id, screen==="pin"]);

  // Detecta rascunho salvo (localStorage) ao entrar
  useEffect(()=>{
    if(!project?.id) return;
    try { setTemRascunho(!!localStorage.getItem(`rs_rascunho_${project.id}`)); } catch(e){}
  },[project?.id, screen]);

  // ── AUTOSAVE do rascunho enquanto preenche (rede de segurança) ──
  // ~3,5s depois que a pessoa para de digitar, o rascunho salva sozinho (só textos,
  // sem foto p/ não estourar a cota). Não precisa clicar. Concluir continua exigindo
  // tudo preenchido — isto aqui é só para nada se perder.
  const rsFormTemConteudo = (f) => {
    if(!f) return false;
    if(f.natureza || f.subtipo) return true;
    if(Array.isArray(f.envolvidos) && f.envolvidos.some(e=>e && (e.nome||e.documento))) return true;
    if(Array.isArray(f.veiculos) && f.veiculos.some(v=>v && v.placa)) return true;
    const campos = ["resumo","detalhamento","medidas","local","observacao","transportadora","inquilino"];
    return campos.some(k=>(f[k]||"").toString().trim().length>0);
  };
  const rsAutosave = (fSnap) => {
    try {
      const paraSalvar = { ...fSnap, fotos: [] }; // nunca grava foto no rascunho
      localStorage.setItem(`rs_rascunho_${project.id}`, JSON.stringify(paraSalvar));
      setTemRascunho(true);
      setRascunhoSalvoEm(new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}));
    } catch(e){ /* cota cheia: silencioso; o salvar manual avisa */ }
  };
  useEffect(()=>{
    if(screen!=="registrar" || !project?.id) return;
    if(!rsTocado.current) return;
    if(!rsFormTemConteudo(form)) return;
    if(rsAutosaveTimer.current) clearTimeout(rsAutosaveTimer.current);
    const snap = form;
    rsAutosaveTimer.current = setTimeout(()=>{ rsAutosave(snap); }, 3500);
    return ()=>{ if(rsAutosaveTimer.current) clearTimeout(rsAutosaveTimer.current); };
  },[form, screen, project?.id]);

  const salvarRascunho = () => {
    // As FOTOS (dataUrl base64) NAO entram no rascunho: elas estouram a cota do
    // localStorage (~5MB) e causavam "Nao foi possivel salvar o rascunho", perdendo
    // o que foi digitado. O rascunho guarda so os textos; as fotos sao reanexadas ao retomar.
    const nFotos = (form.fotos||[]).length;
    const paraSalvar = { ...form, fotos: [] };
    const primeiraVez = !localStorage.getItem(`rs_rascunho_${project.id}`);
    try {
      localStorage.setItem(`rs_rascunho_${project.id}`, JSON.stringify(paraSalvar));
    } catch(e){
      // fallback: limpa e regrava (caso algum resquicio antigo com fotos ainda ocupe cota)
      try { localStorage.removeItem(`rs_rascunho_${project.id}`); localStorage.setItem(`rs_rascunho_${project.id}`, JSON.stringify(paraSalvar)); }
      catch(e2){ alert("Não foi possível salvar o rascunho (armazenamento cheio). Conclua a ocorrência direto ou remova alguma foto."); return; }
    }
    setTemRascunho(true);
    setRascunhoSalvoEm(new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}));
    // So o primeiro salvamento explica o fluxo (bloqueante). Re-salvamentos silenciosos.
    if(primeiraVez){
      alert("Rascunho salvo neste dispositivo (somente os textos)." + (nFotos ? " As " + nFotos + " foto(s) NÃO ficam no rascunho — reanexe ao retomar." : "") + " Ele NÃO é uma ocorrência registrada — retome e clique em Concluir para oficializar. Pode salvar quantas vezes quiser depois de alterar.");
    }
  };
  const retomarRascunho = () => {
    try {
      const raw = localStorage.getItem(`rs_rascunho_${project.id}`);
      if(raw){
        const p = JSON.parse(raw);
        // Merge defensivo: garante todos os campos (rascunhos antigos podem faltar campos novos).
        const completo = { ...emptyForm(), ...p };
        completo.envolvidos = migrarEnvolvidos(p);
        completo.veiculos   = migrarVeiculos(p);
        if(!completo.flagDescs || typeof completo.flagDescs!=="object") completo.flagDescs = {};
        if(!Array.isArray(completo.flags)) completo.flags = [];
        setForm(completo);
        setReincIgnorada(false);
        setScreen("registrar");   // garante que volta para a tela de preenchimento
      }
    } catch(e){ console.error("retomar rascunho:", e); alert("Não foi possível retomar o rascunho. Ele pode estar corrompido — descarte e refaça."); }
  };
  const descartarRascunho = () => {
    try { localStorage.removeItem(`rs_rascunho_${project.id}`); } catch(e){}
    setTemRascunho(false);
    setRascunhoSalvoEm(null);
    rsTocado.current=false; if(rsAutosaveTimer.current) clearTimeout(rsAutosaveTimer.current);
  };

  const onPinOk = (level) => {
    setAuthLevel(level);
    if(onAuthGranted) onAuthGranted(level);
    setScreen("registrar");
  };

  // Ao escolher o subtipo, aplica a severidade padrão se ainda não houver
  const escolherSubtipo = (subKey) => {
    const sub = getSubtipo(subKey);
    setForm(f=>({
      ...f,
      subtipo: subKey,
      natureza: sub?.naturezaKey || f.natureza,
      severidade: f.severidade || sub?.sevPadrao || "info",
    }));
  };

  // Gera o rascunho assistido do detalhamento a partir do modelo do subtipo
  const gerarRascunho = () => {
    // Abertura factual PADRAO: hora + motorista + placa + transportadora + inquilino.
    // O lider continua a descricao a partir daqui.
    const hora = horaDe(form.dataHora);
    const placa = placasDeVeiculos(form).join("/");
    let ab = "Informo que";
    if(hora) ab += ", às " + hora + ",";
    ab += " o motorista";
    if(placa) ab += ", conduzindo o veículo de placa " + placa;
    const compl = [];
    if(form.transportadora) compl.push("da transportadora " + form.transportadora);
    if(form.inquilino) compl.push("inquilino " + form.inquilino);
    if(compl.length) ab += " " + (placa ? "" : "") + "(" + compl.join(", ") + ")";
    ab += ", ";
    // Preenche apenas a abertura; o cursor do lider continua a frase.
    const atual = (form.detalhamento||"").trim();
    if(atual && !atual.startsWith("Informo que")){
      if(!window.confirm("Já há texto no detalhamento. Substituir pela abertura padrão?")) return;
    }
    setF("detalhamento", ab);
  };

  // Fotos: lê arquivos como dataURL e adiciona à galeria
  const addFotos = (fileList, origem) => {
    const files = Array.from(fileList||[]);
    files.forEach(file=>{
      const reader = new FileReader();
      reader.onload = () => {
        setForm(f=>({...f, fotos:[...f.fotos, { origem, legenda:"", dataUrl:reader.result }]}));
      };
      reader.readAsDataURL(file);
    });
  };
  const setLegenda = (idx, txt) => setForm(f=>({...f, fotos:f.fotos.map((ft,i)=>i===idx?{...ft,legenda:txt}:ft)}));
  const removeFoto = (idx) => setForm(f=>({...f, fotos:f.fotos.filter((_,i)=>i!==idx)}));

  const toggleFlag = (key) => setForm(f=>({
    ...f, flags: f.flags.includes(key) ? f.flags.filter(x=>x!==key) : [...f.flags, key]
  }));
  const setFlagDesc = (key, val) => setForm(f=>({ ...f, flagDescs: { ...(f.flagDescs||{}), [key]: val } }));

  // Salvar novo registro (merge por id)
  const salvar = async () => {
    const erro = validarForm(form);
    if(erro) { alert(erro); return; }
    setSaving(true);
    try {
      const envs = (form.envolvidos||[]).filter(e=>e && (e.nome||e.documento));
      const primeiro = envs[0] || { nome:"", documento:"" };
      const vecs = (form.veiculos||[]).filter(v=>v && v.placa);
      // Sincroniza campos legados de placa a partir dos veiculos (mantem PDF/reincidencia legados).
      const vCaminhao = vecs.find(v=>v.tipo==="Caminhão");
      const vCarreta  = vecs.find(v=>v.tipo==="Carreta");
      const vLeve     = vecs.find(v=>["Moto","Automóvel","Van","Ônibus"].includes(v.tipo));
      // Carreta traz a placa do cavalo (trator) em v.placaCavalo; se nao houver, cai para um Caminhao avulso.
      const legCavalo  = (vCarreta && vCarreta.placaCavalo) ? vCarreta.placaCavalo
                        : (vCaminhao ? vCaminhao.placa : (!vLeve && !vCarreta && vecs[0] ? vecs[0].placa : ""));
      const legCarreta = vCarreta ? vCarreta.placa : "";
      const legVeiculo = vLeve ? vLeve.placa : "";
      const novo = {
        ...form,
        envolvidos: envs,
        veiculos: vecs,
        assinatura: (form.assinatura && form.assinatura.trim()) ? form.assinatura.trim() : (form.lider || "").trim(),
        placaCavalo: legCavalo,
        placaCarreta: legCarreta,
        placaVeiculo: legVeiculo,
        nomeEnvolvido: primeiro.nome || "",
        documentoEnvolvido: primeiro.documento || "",
        id: form.id || `${project.id}-${Date.now()}`,
        seq: form.seq != null ? form.seq : (registros.length + 1),
        status: form.status || RS_STATUS.PENDENTE,
        registradoEm: form.registradoEm || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        registradoPor: authLevel,
      };
      const fundida = await persistirRegistro(project.id, novo, registros);
      setRegistros(fundida);
      rsTocado.current=false; if(rsAutosaveTimer.current) clearTimeout(rsAutosaveTimer.current);
      setForm(emptyForm());
      setReincIgnorada(false);
      descartarRascunho();
      setScreen("historico");
    } catch(e){ console.error(e); alert("Erro ao salvar. Verifique sua conexão."); }
    setSaving(false);
  };

  // Marca RS como vista pelo gerencial/admin (aditivo). RS antiga sem o campo conta como nao-vista.
  const marcarVista = async (r) => {
    if(!adminAuth) return;                 // so gerencial/admin marca
    if(!r || r.vistaGerencial) return;     // ja vista: nada a fazer
    const atualizado = { ...r, vistaGerencial:true, vistaEm:new Date().toISOString() };
    const semAlvo = registros.filter(x=>x.id!==r.id);
    try {
      const fundida = await persistirRegistro(project.id, atualizado, semAlvo);
      setRegistros(fundida);
    } catch(e){ console.error("marcarVista error:", e); }
  };
  const abrirEdicaoTextos = (r) => {
    marcarVista(r);                        // abrir = dar baixa no alerta (gerencial)
    setForm({ ...r, envolvidos: migrarEnvolvidos(r), veiculos: migrarVeiculos(r) });
    setScreen("editar");
  };
  const cancelarEdicao = () => { setForm(emptyForm()); setScreen("historico"); };
  const salvarEdicaoTextos = async () => {
    setSaving(true);
    try {
      const alvo = registros.find(x=>x.id===form.id);
      if(!alvo){ alert("Registro não encontrado."); setSaving(false); return; }
      const novo = { ...alvo,
        resumo: form.resumo, detalhamento: form.detalhamento,
        medidas: form.medidas, observacao: form.observacao,
        updatedAt: new Date().toISOString(), editadoEm: new Date().toISOString(),
      };
      const fundida = await persistirRegistro(project.id, novo, registros);
      setRegistros(fundida);
      setForm(emptyForm());
      setScreen("historico");
    } catch(e){ console.error(e); alert("Erro ao salvar correções."); }
    setSaving(false);
  };

  // Arquivar / reabrir (também via merge)
  const mudarStatus = async (id, status) => {
    const alvo = registros.find(r=>r.id===id);
    if(!alvo) return;
    const atualizado = { ...alvo, status, updatedAt:new Date().toISOString(),
      ...(status===RS_STATUS.ARQUIVADO ? { arquivadoEm:new Date().toISOString() } : {}) };
    const semAlvo = registros.filter(r=>r.id!==id);
    const fundida = await persistirRegistro(project.id, atualizado, semAlvo);
    setRegistros(fundida);
  };

  // ── Tela: PIN ──
  if(screen==="pin") {
    return <PinGate project={project||{}} dark={dark||true} onBack={onBack} onSuccess={onPinOk}/>;
  }

  // ── Cabeçalho comum ──
  const Header = () => (
    <div style={{...S.card, borderRadius:0, borderLeft:"none", borderRight:"none", borderTop:"none",
      display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, position:"sticky", top:0, zIndex:5}}>
      <button onClick={onBack} style={S.backBtn}>← Voltar</button>
      <div style={{textAlign:"center", flex:1}}>
        <div style={{fontSize:14, fontWeight:800, ...S.txt}}>📋 Registro Situacional</div>
        <div style={{fontSize:11, ...S.txt2}}>{project?.id} · {project?.name}</div>
      </div>
      {onToggleTheme
        ? <button onClick={onToggleTheme} style={S.backBtn}>{dark?"☀️":"🌙"}</button>
        : <div style={{width:36}}/>}
    </div>
  );

  // ── Abas internas ──
  const Tabs = () => {
    const tabs = [
      { k:"registrar",  label:"➕ Registrar" },
      { k:"historico",  label:"📚 Histórico" },
      { k:"recorrencia",label:"🔁 Recorrência" },
    ];
    return (
      <div style={{display:"flex", gap:6, padding:"10px 12px"}}>
        {tabs.map(t=>(
          <button key={t.k} onClick={()=>setScreen(t.k)}
            style={{...S.btnSm, flex:1, padding:"9px 6px", fontSize:12,
              ...(screen===t.k ? { background:"linear-gradient(135deg,#b45309,#92400e)", color:"#fff", border:"none" } : {})}}>
            {t.label}
          </button>
        ))}
      </div>
    );
  };

  // Reincidências detectadas para o form atual (deriva a cada render; sem custo de Firestore)
  const reincidencias = buscarReincidencias(registros, form);
  const anexarReincidencia = () => {
    setForm(f=>({
      ...f,
      reincidente: true,
      reincidenteDe: reincidencias.map(r=>r.id),
    }));
    setReincIgnorada(true);
  };

  // Detecta se o formulário começou a ser preenchido (para exibir a barra de ações).
  const formPreenchido = !!(
    form.natureza || form.subtipo || form.resumo || form.detalhamento || form.local ||
    form.lider || form.transportadora || form.inquilino ||
    (form.envolvidos||[]).some(e=>e.nome||e.documento) ||
    (form.veiculos||[]).some(v=>v.placa) ||
    (form.fotos||[]).length || (form.flags||[]).length
  );
  // Excluir durante preenchimento/edição.
  const excluirPreenchimento = () => {
    const emEdicao = !!form.id && registros.some(r=>r.id===form.id);
    if(emEdicao){
      if(!adminAuth){
        alert("Exclusão de RS registrada requer PIN gerencial.");
        return;
      }
      if(!window.confirm("Excluir DEFINITIVAMENTE esta RS registrada? Esta ação não pode ser desfeita.")) return;
      excluirRegistro(form.id);
      return;
    }
    if(!window.confirm("Descartar este preenchimento e limpar o formulário?")) return;
    setForm(emptyForm());
    setReincIgnorada(false);
    descartarRascunho();
  };
  const excluirRegistro = async (id) => {
    setSaving(true);
    try {
      const semAlvo = registros.filter(r=>r.id!==id);
      try {
        await setDoc(doc(db, COLLECTION, project.id), { registros:semAlvo, updatedAt:new Date().toISOString() });
      } catch(e){ console.error("RS delete error:", e); }
      try { localStorage.setItem(`${COLLECTION}_${project.id}`, JSON.stringify(semAlvo)); } catch(e){}
      setRegistros(semAlvo);
      setForm(emptyForm());
      setScreen("historico");
    } catch(e){ console.error(e); alert("Erro ao excluir."); }
    setSaving(false);
  };

  const natSel = getNatureza(form.natureza);
  const subSel = getSubtipo(form.subtipo);

  // ── Tela: REGISTRAR ──
  const telaRegistrar = (
    <div style={{padding:"4px 12px", display:"flex", flexDirection:"column", gap:12}}>
      {/* Barra de ações sticky — aparece ao começar a preencher */}
      {formPreenchido && (
        <div style={{position:"sticky", top:62, zIndex:4,
          background: dark ? "#020510" : "#f8fafc",
          padding:"8px 0", marginBottom:4,
          borderBottom:`1px solid ${dark?"#1e293b":"#e2e8f0"}`,
          display:"flex", gap:8, flexWrap:"wrap"}}>
          <button onClick={salvar} disabled={saving}
            style={{...S.btn, flex:"2 1 150px", opacity:saving?.6:1}}>
            {saving ? "Salvando..." : "✓ Concluir"}
          </button>
          <button onClick={salvarRascunho}
            style={{...S.btnSec, flex:"1 1 120px", color:"#3b82f6", borderColor:"#3b82f644"}}>💾 {rascunhoSalvoEm ? `Salvo ${rascunhoSalvoEm}` : "Rascunho"}</button>
          <button onClick={excluirPreenchimento}
            style={{...S.btnSec, flex:"1 1 100px", color:"#ef4444", borderColor:"#ef444433"}}>🗑 Excluir</button>
        </div>
      )}
      {/* Faixa: rascunho não finalizado */}
      {temRascunho && (
        <div style={{background:"#3b82f611", border:"1px solid #3b82f644", borderRadius:12,
          padding:"10px 12px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
          <span style={{fontSize:13, color:"#93c5fd", flex:1, minWidth:160}}>📄 Há um rascunho não finalizado neste dispositivo.</span>
          <button onClick={retomarRascunho} style={{...S.btnSm, color:"#3b82f6", borderColor:"#3b82f644"}}>Retomar</button>
          <button onClick={descartarRascunho} style={{...S.btnSm, color:"#ef4444", borderColor:"#ef444433"}}>Descartar</button>
        </div>
      )}

      {/* Aviso: reincidência detectada */}
      {reincidencias.length>0 && !reincIgnorada && (
        <div style={{background:"#f59e0b14", border:"1.5px solid #f59e0b55", borderRadius:12, padding:"12px 14px"}}>
          <div style={{fontSize:14, fontWeight:800, color:"#f59e0b", marginBottom:6}}>
            ⚠️ Possível reincidência — {reincidencias.length} RS anterior{reincidencias.length>1?"es":""} da mesma natureza
          </div>
          <div style={{fontSize:12, ...S.txt2, marginBottom:8}}>
            Registro(s) anterior(es) com mesmo nome, documento ou placa:
          </div>
          <div style={{display:"flex", flexDirection:"column", gap:6, marginBottom:10}}>
            {reincidencias.slice(0,5).map(r=>{
              const sub = getSubtipo(r.subtipo);
              return (
                <div key={r.id} style={{fontSize:12, ...S.txt, background:dark?"#020510":"#f8fafc",
                  borderRadius:8, padding:"7px 9px", display:"flex", gap:8, alignItems:"center"}}>
                  <span style={{fontWeight:700}}>{String(r.dataHora||r.registradoEm||"").slice(0,10).split("-").reverse().join("/")}</span>
                  <span style={{flex:1}}>{sub?.label || r.subtipo || "—"}</span>
                  <span style={{fontSize:10, fontWeight:800, color:sevCor(r.severidade), whiteSpace:"nowrap"}}>{sevLabel(r.severidade)}</span>
                </div>
              );
            })}
            {reincidencias.length>5 && (
              <div style={{fontSize:11, ...S.txt2}}>+ {reincidencias.length-5} outra(s)…</div>
            )}
          </div>
          <div style={{display:"flex", gap:8}}>
            <button onClick={anexarReincidencia}
              style={{...S.btn, flex:2, background:"linear-gradient(135deg,#b45309,#92400e)"}}>
              🔗 Anexar como reincidência
            </button>
            <button onClick={()=>setReincIgnorada(true)} style={{...S.btnSec, flex:1}}>Ignorar</button>
          </div>
        </div>
      )}

      {/* Selo: reincidência já anexada */}
      {form.reincidente && (
        <div style={{background:"#dc262614", border:"1.5px solid #dc262655", borderRadius:12,
          padding:"10px 12px", display:"flex", alignItems:"center", gap:8}}>
          <span style={{fontSize:13, fontWeight:800, color:"#f87171", flex:1}}>
            🔴 REINCIDENTE — vinculado a {(form.reincidenteDe||[]).length} RS anterior(es)
          </span>
          <button onClick={()=>setForm(f=>({...f, reincidente:false, reincidenteDe:[]}))}
            style={{...S.btnSm, color:"#94a3b8"}}>Desfazer</button>
        </div>
      )}

      {/* Categoria */}
      <div style={S.card}>
        <label style={S.lbl}>Categoria</label>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6}}>
          {NATUREZAS.map(n=>(
            <button key={n.key} onClick={()=>setForm(f=>({...f, natureza:n.key, subtipo:"", severidade:""}))}
              style={{...S.btnSm, padding:"10px 8px", textAlign:"left",
                ...(form.natureza===n.key ? { background:n.cor, color:"#fff", border:"none" } : {})}}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subtipo (encadeado) */}
      {natSel && (
        <div style={S.card}>
          <label style={S.lbl}>Subtipo</label>
          <select value={form.subtipo} onChange={e=>escolherSubtipo(e.target.value)} style={S.inp}>
            <option value="">— selecione —</option>
            {(natSel.subtipos||[]).map(s=>(
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          {subSel?.ajuda && (
            <div style={{marginTop:8, fontSize:12, ...S.txt2, background:dark?"#020510":"#f8fafc",
              borderRadius:8, padding:"8px 10px", lineHeight:1.5}}>💡 {subSel.ajuda}</div>
          )}
        </div>
      )}

      {subSel && (
        <>
          {/* Severidade */}
          <div style={S.card}>
            <label style={S.lbl}>Severidade</label>
            <div style={{display:"flex", gap:6}}>
              {SEVERIDADES.map(sv=>(
                <button key={sv.key} onClick={()=>setF("severidade", sv.key)}
                  style={{...S.btnSm, flex:1, padding:"9px 6px",
                    ...(form.severidade===sv.key ? { background:sv.cor, color:"#fff", border:"none" } : {})}}>
                  {sv.label}
                </button>
              ))}
            </div>
          </div>

          {/* Data/hora + horaFim */}
          <div style={S.card}>
            <div style={{display:"flex", gap:10}}>
              <div style={{flex:2}}>
                <label style={S.lbl}>Data / hora início</label>
                <input type="datetime-local" value={form.dataHora}
                  onChange={e=>setF("dataHora", e.target.value)} style={S.inp}/>
              </div>
              <div style={{flex:1}}>
                <label style={S.lbl}>Normalização</label>
                <input type="time" value={form.horaFim}
                  onChange={e=>setF("horaFim", e.target.value)} style={S.inp}/>
              </div>
            </div>
          </div>

          {/* Quem avisou / avisado / líder */}
          <div style={S.card}>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
              <div><label style={S.lbl}>Líder / Vigilante</label>
                <input value={form.lider} onChange={e=>setF("lider",e.target.value)} style={S.inp}/></div>
              <div><label style={S.lbl}>Quem avisou</label>
                <input value={form.quemAvisou} onChange={e=>setF("quemAvisou",e.target.value)} style={S.inp}/></div>
              <div><label style={S.lbl}>Quem foi avisado</label>
                <input value={form.quemAvisado} onChange={e=>setF("quemAvisado",e.target.value)} style={S.inp}/></div>
              <div><label style={S.lbl}>Doca / Local</label>
                <input value={form.local} onChange={e=>setF("local",e.target.value)} style={S.inp}/></div>
            </div>
          </div>

          {/* Envolvidos (lista, LGPD) */}
          <div style={S.card}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
              <label style={{...S.lbl, marginBottom:0}}>Envolvidos (opcional)</label>
              <button onClick={addEnvolvido} style={{...S.btnSm, color:"#22c55e", borderColor:"#22c55e44"}}>➕ Adicionar</button>
            </div>
            {(form.envolvidos||[]).map((ev,idx)=>(
              <div key={idx} style={{marginBottom:8, paddingBottom:8,
                borderBottom: idx<(form.envolvidos.length-1) ? `1px dashed ${dark?"#1e293b":"#e2e8f0"}` : "none"}}>
                <div style={{display:"flex", gap:6, alignItems:"center", marginBottom:6}}>
                  <span style={{fontSize:11, fontWeight:800, ...S.txt2, minWidth:18}}>{idx+1}º</span>
                  <input placeholder="Nome" value={ev.nome}
                    onChange={e=>setEnvolvido(idx,"nome",e.target.value)} style={{...S.inp, flex:1}}/>
                  {form.envolvidos.length>1 && (
                    <button onClick={()=>removeEnvolvido(idx)} style={{...S.btnSm, color:"#ef4444", borderColor:"#ef444433", padding:"6px 9px"}}>🗑</button>
                  )}
                </div>
                <input placeholder="Documento (CPF/CNPJ)" value={ev.documento}
                  onChange={e=>setEnvolvido(idx,"documento",e.target.value)} style={S.inp}/>
              </div>
            ))}
            <div style={{display:"grid", gridTemplateColumns:"1fr", gap:8, marginTop:4}}>
              <input placeholder="Telefone de contato (opcional)" value={form.telefoneEnvolvido}
                onChange={e=>setF("telefoneEnvolvido",e.target.value)} style={S.inp}/>
            </div>
            {!adminAuth && ((form.envolvidos||[]).some(e=>e.documento)||form.telefoneEnvolvido) && (
              <div style={{marginTop:6, fontSize:11, color:"#f59e0b"}}>
                🔒 Dado sensível: será mascarado na tela e no PDF (LGPD).
              </div>
            )}
          </div>

          {/* Transportadora / veiculos — só quando o subtipo envolve veículo */}
          {subtipoTemVeiculo(form.natureza, form.subtipo) && (
          <div style={S.card}>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10}}>
              <div><label style={S.lbl}>Transportadora</label>
                <input value={form.transportadora} onChange={e=>setF("transportadora",e.target.value)} style={S.inp}/></div>
              <div><label style={S.lbl}>Inquilino</label>
                <input value={form.inquilino} onChange={e=>setF("inquilino",e.target.value)} style={S.inp}/></div>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
              <label style={{...S.lbl, marginBottom:0}}>Veículo(s)</label>
              <button onClick={addVeiculo} style={{...S.btnSm, color:"#22c55e", borderColor:"#22c55e44"}}>➕ Adicionar</button>
            </div>
            {(form.veiculos||[]).map((v,idx)=>(
              <div key={idx} style={{marginBottom:8}}>
                <div style={{display:"flex", gap:6, alignItems:"center"}}>
                  <input placeholder={v.tipo==="Carreta" ? "Placa da carreta" : "Placa"} value={v.placa}
                    onChange={e=>setVeiculo(idx,"placa",e.target.value.toUpperCase())}
                    style={{...S.inp, flex:1}}/>
                  <select value={v.tipo} onChange={e=>setVeiculo(idx,"tipo",e.target.value)}
                    style={{...S.inp, flex:1}}>
                    <option value="">Tipo...</option>
                    {TIPOS_VEICULO.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                  {form.veiculos.length>1 && (
                    <button onClick={()=>removeVeiculo(idx)} style={{...S.btnSm, color:"#ef4444", borderColor:"#ef444433", padding:"6px 9px"}}>🗑</button>
                  )}
                </div>
                {v.tipo==="Carreta" && (
                  <input placeholder="Placa do cavalo (trator)" value={v.placaCavalo||""}
                    onChange={e=>setVeiculo(idx,"placaCavalo",e.target.value.toUpperCase())}
                    style={{...S.inp, width:"100%", marginTop:6}}/>
                )}
              </div>
            ))}
          </div>
          )}

          {/* Resumo */}
          <div style={S.card}>
            <label style={S.lbl}>Resumo / título curto</label>
            <input value={form.resumo} onChange={e=>setF("resumo",e.target.value)} style={S.inp}/>
          </div>

          {/* Detalhamento com rascunho assistido */}
          <div style={S.card}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4}}>
              <label style={{...S.lbl, marginBottom:0}}>Detalhamento</label>
              <button onClick={gerarRascunho} style={{...S.btnSm, color:"#3b82f6", borderColor:"#3b82f633"}}>✨ Gerar rascunho</button>
            </div>
            <textarea rows={6} value={form.detalhamento}
              onChange={e=>setF("detalhamento",e.target.value)}
              style={{...S.inp, resize:"vertical", fontFamily:"inherit"}}/>
            {subSel?.fotos && (
              <div style={{marginTop:6, fontSize:11, ...S.txt2}}>📷 {subSel.fotos}</div>
            )}
          </div>

          {/* Medidas */}
          <div style={S.card}>
            <label style={S.lbl}>Medidas imediatamente tomadas</label>
            <textarea rows={3} value={form.medidas}
              onChange={e=>setF("medidas",e.target.value)}
              style={{...S.inp, resize:"vertical", fontFamily:"inherit"}}/>
          </div>

          {/* Flags */}
          <div style={S.card}>
            <label style={S.lbl}>Classificação secundária</label>
            <div style={{display:"flex", flexDirection:"column", gap:6}}>
              {FLAGS.map(fl=>(
                <div key={fl.key}>
                  <label style={{display:"flex", alignItems:"center", gap:8, fontSize:13, ...S.txt, cursor:"pointer"}}>
                    <input type="checkbox" checked={form.flags.includes(fl.key)} onChange={()=>toggleFlag(fl.key)}/>
                    {fl.label}
                  </label>
                  {form.flags.includes(fl.key) && (
                    <textarea rows={2} placeholder="Descreva (opcional)"
                      value={(form.flagDescs||{})[fl.key] || ""}
                      onChange={e=>setFlagDesc(fl.key, e.target.value)}
                      style={{...S.inp, marginTop:6, marginBottom:4, resize:"vertical", fontSize:13}}/>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Fotos — galeria única (local + CFTV) */}
          <div style={S.card}>
            <label style={S.lbl}>Evidências</label>
            <div style={{display:"flex", gap:8, marginBottom:8}}>
              <label style={{...S.btnSm, flex:1, textAlign:"center", cursor:"pointer"}}>
                📷 Foto local
                <input type="file" accept="image/*" multiple style={{display:"none"}}
                  onChange={e=>{addFotos(e.target.files,"local"); e.target.value="";}}/>
              </label>
              <label style={{...S.btnSm, flex:1, textAlign:"center", cursor:"pointer"}}>
                🎥 Print CFTV
                <input type="file" accept="image/*" multiple style={{display:"none"}}
                  onChange={e=>{addFotos(e.target.files,"cftv"); e.target.value="";}}/>
              </label>
            </div>
            <div style={{fontSize:10, color:"#f59e0b", marginBottom:8}}>
              ⚠️ Não apague as mídias do dispositivo antes de confirmar o envio.
            </div>
            {form.fotos.length>0 && (
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                {form.fotos.map((ft,i)=>(
                  <div key={i} style={{border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`, borderRadius:8, overflow:"hidden"}}>
                    <img src={ft.dataUrl} alt="" style={{width:"100%", height:90, objectFit:"cover", display:"block"}}/>
                    <div style={{padding:6}}>
                      <div style={{fontSize:9, fontWeight:800, color:ft.origem==="cftv"?"#7c3aed":"#0ea5e9", marginBottom:3}}>
                        {ft.origem==="cftv"?"CFTV":"LOCAL"}
                      </div>
                      <input placeholder="Legenda" value={ft.legenda}
                        onChange={e=>setLegenda(i,e.target.value)}
                        style={{...S.inp, padding:"5px 7px", fontSize:11}}/>
                      <button onClick={()=>removeFoto(i)} style={{...S.btnSm, width:"100%", marginTop:4, color:"#ef4444"}}>Remover</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observação */}
          <div style={S.card}>
            <label style={S.lbl}>Observação (opcional)</label>
            <textarea rows={2} value={form.observacao}
              onChange={e=>setF("observacao",e.target.value)}
              style={{...S.inp, resize:"vertical", fontFamily:"inherit"}}/>
          </div>

          {/* Assinatura do responsável */}
          <div style={S.card}>
            <label style={S.lbl}>Assinatura do responsável</label>
            <input placeholder="Nome de quem registra (assina a RS)"
              value={form.assinatura || form.lider || ""}
              onChange={e=>setF("assinatura", e.target.value)} style={S.inp}/>
            <div style={{fontSize:11, ...S.txt2, marginTop:5}}>
              Preenchido automaticamente com o Líder/Vigilante. Ajuste se quem assina for outra pessoa.
            </div>
          </div>

          {/* Ações (rodapé) — espelham a barra sticky do topo */}
          <div style={{display:"flex", gap:8, marginBottom:20, flexWrap:"wrap"}}>
            <button onClick={salvarRascunho} style={{...S.btnSec, flex:"1 1 130px", color:"#3b82f6", borderColor:"#3b82f644"}}>💾 Salvar rascunho</button>
            <button onClick={salvar} disabled={saving}
              style={{...S.btn, flex:"2 1 180px", opacity:saving?.6:1}}>
              {saving ? "Salvando..." : "✓ Concluir ocorrência"}
            </button>
          </div>
        </>
      )}
    </div>
  );

  // ── Tela: HISTÓRICO ──
  const registrosFiltrados = registros.filter(r=>{
    if(filtroStatus==="todos") return true;
    return (r.status||RS_STATUS.PENDENTE)===filtroStatus;
  });

  const telaHistorico = (
    <div style={{padding:"4px 12px", display:"flex", flexDirection:"column", gap:10}}>
      {/* Filtro + PDF pacote */}
      <div style={{display:"flex", gap:6, alignItems:"center"}}>
        {["todos","pendente","arquivado"].map(fs=>(
          <button key={fs} onClick={()=>setFiltroStatus(fs)}
            style={{...S.btnSm, textTransform:"capitalize",
              ...(filtroStatus===fs ? { background:"#334155", color:"#fff", border:"none" } : {})}}>
            {fs}
          </button>
        ))}
        <div style={{flex:1}}/>
        {adminAuth && registrosFiltrados.length>0 && (
          <button onClick={()=>gerarPdfPacoteRS(project, registrosFiltrados, { titulo:`Histórico (${filtroStatus})` })}
            style={{...S.btnSm, color:"#16a34a", borderColor:"#16a34a33"}}>📄 PDF do pacote</button>
        )}
      </div>

      {loading && <div style={{textAlign:"center", ...S.txt2, padding:20}}>Carregando...</div>}
      {!loading && registrosFiltrados.length===0 && (
        <div style={{textAlign:"center", ...S.txt2, padding:30}}>Nenhuma ocorrência registrada.</div>
      )}

      {registrosFiltrados.map(r=>{
        const sub = getSubtipo(r.subtipo);
        const nat = getNatureza(r.natureza);
        const sev = r.severidade || sub?.sevPadrao || "info";
        const st = r.status || RS_STATUS.PENDENTE;
        const dias = daysSince(r.dataHora || r.registradoEm);
        return (
          <div key={r.id} style={S.card}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10, fontWeight:800, color:nat?.cor||"#64748b", letterSpacing:.5}}>
                  {nat?.icon} {nat?.label || r.natureza}
                </div>
                <div style={{fontSize:14, fontWeight:700, ...S.txt, marginTop:2}}>
                  {r.resumo || sub?.label || "Ocorrência"}
                </div>
                <div style={{fontSize:11, ...S.txt2, marginTop:2}}>
                  {fmtDataHoraBR(r.dataHora || r.registradoEm)}
                  {r.lider ? ` · ${r.lider}` : ""}
                  {dias!=null ? ` · ${dias===0?"hoje":`${dias}d`}` : ""}
                </div>
              </div>
              <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4}}>
                <span style={{fontSize:10, fontWeight:800, color:"#fff", background:sevCor(sev),
                  padding:"3px 8px", borderRadius:6}}>{sevLabel(sev)}</span>
                <span style={{fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:5,
                  background: st===RS_STATUS.ARQUIVADO ? (dark?"#0f172a":"#f1f5f9") : "#fff8f0",
                  color: st===RS_STATUS.ARQUIVADO ? "#64748b" : "#b45309"}}>
                  {st===RS_STATUS.ARQUIVADO ? "ARQUIVADO" : "PENDENTE"}
                </span>
                {!r.vistaGerencial && (
                  <span style={{fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:5, background:"#B21E27", color:"#fff"}}>NOVA</span>
                )}
              </div>
            </div>

            {/* Dados mascarados conforme acesso */}
            {(() => {
              const evs = (r.envolvidos && r.envolvidos.length) ? r.envolvidos
                : (r.nomeEnvolvido||r.documentoEnvolvido ? [{nome:r.nomeEnvolvido,documento:r.documentoEnvolvido}] : []);
              if(evs.length===0 && !r.telefoneEnvolvido) return null;
              return (
                <div style={{display:"flex", flexWrap:"wrap", gap:"4px 12px", marginTop:6, fontSize:12, ...S.txt2}}>
                  {evs.map((ev,i)=>(
                    <span key={i} style={{display:"inline-flex", gap:6}}>
                      {ev.nome && <span>👤 {ev.nome}</span>}
                      {ev.documento && <span>📄 {adminAuth ? ev.documento : mascararDoc(ev.documento)}</span>}
                    </span>
                  ))}
                  {r.telefoneEnvolvido && <span>📞 {adminAuth ? r.telefoneEnvolvido : mascararTel(r.telefoneEnvolvido)}</span>}
                </div>
              );
            })()}

            <div style={{display:"flex", gap:6, marginTop:10, flexWrap:"wrap"}}>
              <button onClick={()=>abrirEdicaoTextos(r)} style={{...S.btnSm, color:"#3b82f6", borderColor:"#3b82f644"}}>✏️ Editar</button>
              <button onClick={()=>enviarRSOutlook(project, r)} style={{...S.btnSm, color:"#0078d4", borderColor:"#0078d444"}}>📤 Enviar (Outlook)</button>
              <button onClick={()=>enviarRSWhatsapp(project, r)} style={{...S.btnSm, color:"#16a34a", borderColor:"#16a34a44"}}>💬 WhatsApp</button>
              {adminAuth && (
                <button onClick={()=>{marcarVista(r);gerarPdfRS(project, r);}} style={{...S.btnSm, color:"#16a34a", borderColor:"#16a34a33"}}>📄 PDF</button>
              )}
              {st===RS_STATUS.PENDENTE
                ? <button onClick={()=>mudarStatus(r.id, RS_STATUS.ARQUIVADO)} style={S.btnSm}>📥 Arquivar</button>
                : <button onClick={()=>mudarStatus(r.id, RS_STATUS.PENDENTE)} style={S.btnSm}>↩️ Reabrir</button>}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Tela: RECORRÊNCIA ──
  const rankRec = analisarRecorrencia(registros, janela);
  const telaRecorrencia = (
    <div style={{padding:"4px 12px", display:"flex", flexDirection:"column", gap:10}}>
      <div style={{display:"flex", gap:6, alignItems:"center"}}>
        <span style={{fontSize:12, ...S.txt2}}>Janela:</span>
        {[7,30,90,0].map(j=>(
          <button key={j} onClick={()=>setJanela(j)}
            style={{...S.btnSm, ...(janela===j ? { background:"#334155", color:"#fff", border:"none" } : {})}}>
            {j===0 ? "Tudo" : `${j}d`}
          </button>
        ))}
      </div>

      {rankRec.length===0 && (
        <div style={{textAlign:"center", ...S.txt2, padding:30}}>Sem dados na janela selecionada.</div>
      )}

      {rankRec.map(item=>{
        const sub = getSubtipo(item.subtipo);
        const nat = sub ? getNatureza(sub.naturezaKey) : null;
        return (
          <div key={item.subtipo} style={S.card}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10, fontWeight:800, color:nat?.cor||"#64748b"}}>{nat?.icon} {nat?.label||""}</div>
                <div style={{fontSize:13, fontWeight:700, ...S.txt, marginTop:2}}>{sub?.label || item.subtipo}</div>
                <div style={{fontSize:11, ...S.txt2, marginTop:2}}>Última: {fmtDataHoraBR(item.ultima)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:24, fontWeight:900, color: item.n>=3 ? "#ef4444" : item.n>=2 ? "#f59e0b" : (dark?"#f1f5f9":"#0f172a")}}>
                  {item.n}
                </div>
                <div style={{fontSize:9, ...S.txt2}}>ocorrência{item.n>1?"s":""}</div>
                {item.critico>0 && <div style={{fontSize:9, color:"#ef4444", fontWeight:800}}>{item.critico} crítica{item.critico>1?"s":""}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const telaEditarTextos = (
    <div style={{padding:"4px 12px", display:"flex", flexDirection:"column", gap:12}}>
      <div style={{background:"#3b82f611", border:"1px solid #3b82f644", borderRadius:12, padding:"12px 14px"}}>
        <div style={{fontSize:14, fontWeight:800, color:"#3b82f6"}}>✏️ Editar textos da RS</div>
        <div style={{fontSize:12, ...S.txt2, marginTop:4}}>
          Apenas os textos abaixo podem ser corrigidos. Dados da ocorrência (natureza, envolvidos, placas, data) ficam preservados.
        </div>
      </div>
      <div style={S.card}>
        <label style={S.lbl}>Resumo / título curto</label>
        <input value={form.resumo} onChange={e=>setF("resumo",e.target.value)} style={S.inp}/>
      </div>
      <div style={S.card}>
        <label style={S.lbl}>Detalhamento</label>
        <textarea rows={5} value={form.detalhamento} onChange={e=>setF("detalhamento",e.target.value)} style={{...S.inp, resize:"vertical"}}/>
      </div>
      <div style={S.card}>
        <label style={S.lbl}>Medidas tomadas</label>
        <textarea rows={3} value={form.medidas} onChange={e=>setF("medidas",e.target.value)} style={{...S.inp, resize:"vertical"}}/>
      </div>
      <div style={S.card}>
        <label style={S.lbl}>Observação</label>
        <textarea rows={2} value={form.observacao} onChange={e=>setF("observacao",e.target.value)} style={{...S.inp, resize:"vertical"}}/>
      </div>
      <div style={{display:"flex", gap:8, marginBottom:20}}>
        <button onClick={cancelarEdicao} style={{...S.btnSec, flex:1}}>Cancelar</button>
        <button onClick={salvarEdicaoTextos} disabled={saving} style={{...S.btn, flex:2, opacity:saving?.6:1}}>
          {saving ? "Salvando..." : "✓ Salvar correções"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <Header/>
        <Tabs/>
        {screen==="editar"     && telaEditarTextos}
        {screen==="registrar"  && telaRegistrar}
        {screen==="historico"  && telaHistorico}
        {screen==="recorrencia"&& telaRecorrencia}
      </div>
    </div>
  );
}
