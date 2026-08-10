import { useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";
import { setDoc, deleteDoc } from "./fireGuard";
import { gerarPdfAmbulancia } from "./ambulanciaPdf";

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
const COL = "ambulancias";
const COL_INQ = "inquilinos";

const TIPOS = ["Mal súbito", "Acidente", "Trauma/Queda", "Outro"];
const GRAVIDADES = ["Leve", "Moderada", "Grave"];
const TURNOS = ["Diurno", "Noturno"];
const MAX_FOTOS = 4;

function todayStr(){ return new Date().toLocaleDateString("sv-SE"); }
function fmtData(d){ if(!d) return "—"; try{ return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); }catch{ return d; } }
function fmtDataHora(ts){ if(!ts) return "—"; try{ const d=new Date(ts); return d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); }catch{ return ts; } }
function newId(){ try{ return crypto.randomUUID(); }catch{ return "amb-"+Date.now()+"-"+Math.random().toString(36).slice(2,8); } }

// Comprime imagem para base64 (mesmo padrão dos outros módulos: reduz largura, JPEG)
function comprimirImagem(file, maxW=1000, q=0.7){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", q));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blankReg(){
  return {
    id: null,
    inquilino: "",
    inquilinoOutro: "",
    data: todayStr(),
    turno: "",
    horaEntrada: "",
    horaSaida: "",
    tipo: "",
    tipoOutro: "",
    gravidade: "",
    condutor: "",
    socorrista1: "",
    socorrista2: "",
    paciente: "",
    vitimaRemovida: "Sim",
    acompanhante: "Não",
    observacao: "",
    fotos: [],
    registradoPor: "",
  };
}

// ── Rascunho local (localStorage), por projeto ──────────────────
// Guarda os campos de TEXTO do formulário para o líder não perder o que
// digitou. As FOTOS não vão para o localStorage (evita estourar a cota) —
// elas são reanexadas ao recuperar. Regra: strip photos before localStorage.
function draftKey(pid){ return `amb_rascunho_${pid}`; }
function salvarRascunhoLocal(pid, form){
  try{
    const { fotos, ...semFotos } = form || {};
    localStorage.setItem(draftKey(pid), JSON.stringify({ ...semFotos, _rascunhoEm: new Date().toISOString() }));
    return true;
  }catch(e){ return false; }
}
function lerRascunhoLocal(pid){
  try{ const s = localStorage.getItem(draftKey(pid)); return s ? JSON.parse(s) : null; }
  catch(e){ return null; }
}
function limparRascunhoLocal(pid){
  try{ localStorage.removeItem(draftKey(pid)); }catch(e){ /* noop */ }
}

export default function Ambulancia({ project, onBack, dark, onToggleTheme, sharedAuth, onAuthGranted }){
  const S = getStyles(dark);
  const adminAuth = sharedAuth === "admin" || sharedAuth === "gerencial";

  const [registros, setRegistros] = useState([]);
  const [inquilinosLista, setInquilinosLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screen, setScreen] = useState("list"); // list | form
  const [form, setForm] = useState(blankReg());
  const [editandoId, setEditandoId] = useState(null);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(()=>{
    let vivo = true;
    (async ()=>{
      try{
        // Formato ANTIGO: documento único com array registros[]
        let antigos = [];
        const snap = await getDoc(doc(db, COL, project.id));
        if(snap.exists()) antigos = (snap.data().registros || []).map(r => ({ ...r, _novo:false }));

        // Formato NOVO: um documento por registro na subcoleção registros/
        let novos = [];
        try{
          const subSnap = await getDocs(collection(db, COL, project.id, "registros"));
          novos = subSnap.docs.map(d => ({ ...d.data(), id: d.id, _novo:true }));
        }catch(e){ /* subcoleção pode não existir ainda */ }

        // Junta os dois, remove duplicados por id (novo tem prioridade) e ordena
        const mapa = new Map();
        for(const r of antigos) mapa.set(r.id, r);
        for(const r of novos) mapa.set(r.id, r); // novo sobrescreve antigo de mesmo id
        const lista = [...mapa.values()].sort((a,b)=>{
          const ka = (b.data||"") + (b.criadoEm||"");
          const kb = (a.data||"") + (a.criadoEm||"");
          return ka.localeCompare(kb);
        });
        if(vivo) setRegistros(lista);
      }catch(e){ console.warn("load ambulancia:", e); }
      // puxa lista de inquilinos cadastrados para o dropdown
      try{
        const snapInq = await getDoc(doc(db, COL_INQ, project.id));
        if(vivo && snapInq.exists()){
          const unidades = snapInq.data().unidades || [];
          const nomes = [...new Set(unidades.map(u=>(u.inquilino||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
          setInquilinosLista(nomes);
        }
      }catch(e){ /* sem lista: cai para texto livre */ }
      if(vivo) setLoading(false);
    })();
    return ()=>{ vivo=false; };
  },[project.id]);

  // Grava UM registro no seu próprio documento (subcoleção registros/).
  // Assim cada ocorrência tem seu próprio limite de 1MB — nunca estoura por
  // acúmulo. Atualiza a lista local sem depender de reescrever tudo.
  const salvarRegistro = async (reg) => {
    setSaving(true);
    const registro = { ...reg, _novo:true };
    // Atualiza a UI otimisticamente
    setRegistros(prev => {
      const outros = prev.filter(r => r.id !== registro.id);
      return [registro, ...outros].sort((a,b)=>((b.data||"")+(b.criadoEm||"")).localeCompare((a.data||"")+(a.criadoEm||"")));
    });
    try{
      // Grava apenas ESTE registro no seu documento próprio
      const { _novo, ...limpo } = registro;
      await setDoc(doc(db, COL, project.id, "registros", registro.id), { ...limpo, updatedAt: new Date().toISOString() });
      return true;
    }catch(e){
      console.error(e);
      alert("Erro ao salvar. Verifique a conexão e tente de novo.");
      // Reverte a UI: remove o registro que não foi salvo
      setRegistros(prev => prev.filter(r => r.id !== registro.id));
      return false;
    }finally{
      setSaving(false);
    }
  };

  const abrirNovo = () => {
    // Se houver rascunho salvo, oferece recuperar (sem as fotos, que não
    // são guardadas no localStorage).
    const rasc = lerRascunhoLocal(project.id);
    if(rasc && (rasc.inquilino || rasc.paciente || rasc.observacao)){
      const quando = rasc._rascunhoEm ? new Date(rasc._rascunhoEm).toLocaleString("pt-BR") : "";
      if(window.confirm(`Há um rascunho não enviado${quando ? ` de ${quando}` : ""}.\n\nDeseja recuperá-lo? (As fotos precisarão ser anexadas de novo.)`)){
        const { _rascunhoEm, ...campos } = rasc;
        setForm({ ...blankReg(), ...campos, fotos: [] });
        setEditandoId(null);
        setScreen("form");
        return;
      }
      // Não quis recuperar → descarta o rascunho
      limparRascunhoLocal(project.id);
    }
    setForm(blankReg());
    setEditandoId(null);
    setScreen("form");
  };

  // Salvar rascunho manualmente (botão no formulário)
  const salvarRascunho = () => {
    const ok = salvarRascunhoLocal(project.id, form);
    alert(ok
      ? "📝 Rascunho salvo neste aparelho. Você pode continuar depois pelo botão Novo Registro.\n\n(As fotos não ficam no rascunho — anexe ao finalizar.)"
      : "Não foi possível salvar o rascunho neste aparelho.");
  };

  const abrirEdicao = (reg) => {
    // Edição pós-salvo só para gerencial
    if(!adminAuth){
      alert("✏️ A edição de um registro já salvo é exclusiva da gerência.\n\nVocê pode criar um novo registro normalmente.");
      return;
    }
    setForm({ ...blankReg(), ...reg });
    setEditandoId(reg.id);
    setScreen("form");
  };

  const setF = (patch) => setForm(f => ({ ...f, ...patch }));

  // Auto-salva rascunho (só texto) enquanto o líder preenche um registro NOVO.
  // Não roda na edição de registro já salvo (gerencial).
  useEffect(()=>{
    if(screen !== "form" || editandoId) return;
    const t = setTimeout(()=>{
      if(form.inquilino || form.paciente || form.observacao){
        salvarRascunhoLocal(project.id, form);
      }
    }, 800);
    return ()=>clearTimeout(t);
  }, [form, screen, editandoId, project.id]);

  const addFotos = async (files) => {
    const arr = Array.from(files || []);
    if(!arr.length) return;
    const restante = MAX_FOTOS - (form.fotos?.length || 0);
    if(restante <= 0){ alert(`Máximo de ${MAX_FOTOS} fotos por registro.`); return; }
    const usar = arr.slice(0, restante);
    try{
      const comprimidas = [];
      for(const f of usar){ comprimidas.push(await comprimirImagem(f)); }
      setF({ fotos: [...(form.fotos||[]), ...comprimidas] });
    }catch(e){ alert("Não foi possível processar a(s) foto(s). Tente novamente."); }
  };

  const removerFoto = (idx) => setF({ fotos: (form.fotos||[]).filter((_,i)=>i!==idx) });

  const validar = () => {
    const inq = form.inquilino === "__outro__" ? form.inquilinoOutro : form.inquilino;
    if(!inq || !inq.trim()){ alert("Informe o inquilino solicitante."); return null; }
    if(!form.data){ alert("Informe a data."); return null; }
    if(!form.turno){ alert("Selecione o turno (Diurno ou Noturno)."); return null; }
    if(!form.registradoPor || !form.registradoPor.trim()){ alert("Informe quem está registrando (nome do responsável)."); return null; }
    return inq.trim();
  };

  const salvar = async () => {
    const inq = validar();
    if(inq === null) return;
    const limpo = {
      ...form,
      inquilino: inq,
      inquilinoOutro: undefined,
      id: editandoId || form.id || newId(),
      atualizadoEm: new Date().toISOString(),
    };
    if(!limpo.criadoEm) limpo.criadoEm = new Date().toISOString();
    delete limpo.inquilinoOutro;

    // Grava só este registro (documento próprio). Só navega se persistiu —
    // evita o efeito "aparece salvo e some" quando a gravação falha.
    const ok = await salvarRegistro(limpo);
    if(!ok) return; // permanece no formulário para o líder tentar de novo
    limparRascunhoLocal(project.id); // salvou de verdade → descarta rascunho
    setScreen("list");
    setForm(blankReg());
    setEditandoId(null);
  };

  const excluir = async (reg) => {
    if(!adminAuth){ alert("A exclusão é exclusiva da gerência."); return; }
    if(!window.confirm(`Excluir o registro de ${reg.inquilino} (${fmtData(reg.data)})? Esta ação não pode ser desfeita.`)) return;
    setSaving(true);
    try{
      if(reg._novo){
        // Formato novo: apaga o documento próprio na subcoleção
        await deleteDoc(doc(db, COL, project.id, "registros", reg.id));
      }else{
        // Formato antigo: reescreve o documento único sem este registro
        const restantesAntigos = registros.filter(r => !r._novo && r.id !== reg.id).map(({_novo, ...r})=>r);
        await setDoc(doc(db, COL, project.id), { registros: restantesAntigos, updatedAt: new Date().toISOString() });
      }
      setRegistros(prev => prev.filter(r => r.id !== reg.id));
    }catch(e){
      console.error(e);
      alert("Erro ao excluir. Tente novamente.");
    }finally{
      setSaving(false);
    }
  };

  const gerarPDF = (reg) => gerarPdfAmbulancia(project, reg);

  // ── Estatística rápida (topo da lista) ──
  const totalGeral = registros.length;
  const totalDiurno = registros.filter(r=>r.turno==="Diurno").length;
  const totalNoturno = registros.filter(r=>r.turno==="Noturno").length;

  if(loading){
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header S={S} onBack={onBack} onToggleTheme={onToggleTheme} project={project} dark={dark}/>
        <div style={{padding:"40px 16px", textAlign:"center", ...S.txt2}}>Carregando registros…</div>
      </div></div>
    );
  }

  // ══════════ TELA: FORMULÁRIO ══════════
  if(screen === "form"){
    const fotos = form.fotos || [];
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header S={S} onBack={()=>{ setScreen("list"); setForm(blankReg()); setEditandoId(null); }} onToggleTheme={onToggleTheme} project={project} dark={dark} titulo={editandoId ? "Editar Registro" : "Novo Registro"}/>

        <div style={{padding:"0 16px 40px", display:"flex", flexDirection:"column", gap:16}}>

          {/* Inquilino */}
          <Campo S={S} label="Inquilino Solicitante" obrigatorio>
            {inquilinosLista.length > 0 ? (
              <>
                <select value={form.inquilino} onChange={e=>setF({ inquilino:e.target.value })} style={S.input}>
                  <option value="">Selecione o inquilino…</option>
                  {inquilinosLista.map(n => <option key={n} value={n}>{n}</option>)}
                  <option value="__outro__">Outro (digitar)</option>
                </select>
                {form.inquilino === "__outro__" && (
                  <input value={form.inquilinoOutro} onChange={e=>setF({ inquilinoOutro:e.target.value })} placeholder="Nome do inquilino" style={{ ...S.input, marginTop:8 }}/>
                )}
              </>
            ) : (
              <input value={form.inquilino} onChange={e=>setF({ inquilino:e.target.value })} placeholder="Nome do inquilino" style={S.input}/>
            )}
          </Campo>

          {/* Data + Turno */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Campo S={S} label="Data" obrigatorio>
              <input type="date" value={form.data} onChange={e=>setF({ data:e.target.value })} style={S.input}/>
            </Campo>
            <Campo S={S} label="Turno" obrigatorio>
              <div style={{ display:"flex", gap:8 }}>
                {TURNOS.map(t => (
                  <Botao key={t} S={S} ativo={form.turno===t} cor="#0ea5e9" onClick={()=>setF({ turno:t })}>{t}</Botao>
                ))}
              </div>
            </Campo>
          </div>

          {/* Horas com relógio */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Campo S={S} label="Hora de Entrada">
              <input type="time" value={form.horaEntrada} onChange={e=>setF({ horaEntrada:e.target.value })} style={S.input}/>
            </Campo>
            <Campo S={S} label="Hora de Saída">
              <input type="time" value={form.horaSaida} onChange={e=>setF({ horaSaida:e.target.value })} style={S.input}/>
            </Campo>
          </div>

          {/* Tipo */}
          <Campo S={S} label="Tipo de Ocorrência">
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {TIPOS.map(t => (
                <Botao key={t} S={S} ativo={form.tipo===t} cor="#8b5cf6" onClick={()=>setF({ tipo:t })}>{t}</Botao>
              ))}
            </div>
            {form.tipo === "Outro" && (
              <input value={form.tipoOutro} onChange={e=>setF({ tipoOutro:e.target.value })} placeholder="Descreva o tipo" style={{ ...S.input, marginTop:8 }}/>
            )}
          </Campo>

          {/* Gravidade */}
          <Campo S={S} label="Gravidade">
            <div style={{ display:"flex", gap:8 }}>
              {GRAVIDADES.map(g => {
                const cor = g==="Grave" ? "#ef4444" : g==="Moderada" ? "#f59e0b" : "#22c55e";
                return <Botao key={g} S={S} ativo={form.gravidade===g} cor={cor} onClick={()=>setF({ gravidade:g })}>{g}</Botao>;
              })}
            </div>
          </Campo>

          {/* Condutor + Socorristas */}
          <Campo S={S} label="Condutor da Ambulância">
            <input value={form.condutor} onChange={e=>setF({ condutor:e.target.value })} placeholder="Nome do condutor" style={S.input}/>
          </Campo>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Campo S={S} label="Socorrista 1">
              <input value={form.socorrista1} onChange={e=>setF({ socorrista1:e.target.value })} placeholder="Nome" style={S.input}/>
            </Campo>
            <Campo S={S} label="Socorrista 2">
              <input value={form.socorrista2} onChange={e=>setF({ socorrista2:e.target.value })} placeholder="Nome" style={S.input}/>
            </Campo>
          </div>

          {/* Paciente / Vítima */}
          <Campo S={S} label="Paciente / Vítima">
            <input value={form.paciente} onChange={e=>setF({ paciente:e.target.value })} placeholder="Nome do paciente/vítima (se mais de um, separe por vírgula)" style={S.input}/>
          </Campo>

          {/* Vítima removida + Acompanhante */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Campo S={S} label="Vítima Removida?">
              <div style={{ display:"flex", gap:8 }}>
                {["Sim","Não"].map(v => (
                  <Botao key={v} S={S} ativo={form.vitimaRemovida===v} cor={v==="Sim"?"#22c55e":"#64748b"} onClick={()=>setF({ vitimaRemovida:v })}>{v}</Botao>
                ))}
              </div>
            </Campo>
            <Campo S={S} label="Acompanhante?">
              <div style={{ display:"flex", gap:8 }}>
                {["Sim","Não"].map(v => (
                  <Botao key={v} S={S} ativo={form.acompanhante===v} cor={v==="Sim"?"#22c55e":"#64748b"} onClick={()=>setF({ acompanhante:v })}>{v}</Botao>
                ))}
              </div>
            </Campo>
          </div>

          {/* Observação */}
          <Campo S={S} label="Observações / Sintomas / Tipo de Socorro">
            <textarea value={form.observacao} onChange={e=>setF({ observacao:e.target.value })} placeholder="Descreva sintomas, tipo de socorro, e o que for relevante…" rows={4} style={{ ...S.input, resize:"vertical", lineHeight:1.5 }}/>
          </Campo>

          {/* Fotos */}
          <Campo S={S} label={`Fotos (até ${MAX_FOTOS})`}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:10 }}>
              {fotos.map((src,i)=>(
                <div key={i} style={{ position:"relative", borderRadius:10, overflow:"hidden", border:`1px solid ${dark?"#1e293b":"#e2e8f0"}` }}>
                  <img src={src} alt={`Foto ${i+1}`} style={{ width:"100%", height:120, objectFit:"cover", display:"block" }}/>
                  <button onClick={()=>removerFoto(i)} style={{ position:"absolute", top:6, right:6, background:"rgba(239,68,68,.92)", color:"#fff", border:"none", borderRadius:6, width:26, height:26, fontSize:14, cursor:"pointer", fontWeight:800 }}>✕</button>
                </div>
              ))}
            </div>
            {fotos.length < MAX_FOTOS && (
              <>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={e=>{ addFotos(e.target.files); e.target.value=""; }} style={{ display:"none" }}/>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple onChange={e=>{ addFotos(e.target.files); e.target.value=""; }} style={{ display:"none" }}/>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <button onClick={()=>fileRef.current && fileRef.current.click()} style={{ ...S.btnSec, width:"100%" }}>
                    🖼️ Galeria
                  </button>
                  <button onClick={()=>cameraRef.current && cameraRef.current.click()} style={{ ...S.btnSec, width:"100%" }}>
                    📷 Câmera
                  </button>
                </div>
              </>
            )}
          </Campo>

          {/* Responsável pelo registro */}
          <Campo S={S} label="Registrado por (quem preencheu)" obrigatorio>
            <input value={form.registradoPor} onChange={e=>setF({ registradoPor:e.target.value })} placeholder="Seu nome" style={S.input}/>
          </Campo>

          {/* Ações */}
          {!editandoId && (
            <button onClick={salvarRascunho} style={{ ...S.btnSec, width:"100%", marginTop:6, marginBottom:0 }}>
              📝 Salvar rascunho (continuar depois)
            </button>
          )}
          <div style={{ display:"flex", gap:10, marginTop:6 }}>
            <button onClick={()=>{ setScreen("list"); setForm(blankReg()); setEditandoId(null); }} style={{ ...S.btnSec, flex:1 }}>Cancelar</button>
            <button onClick={salvar} disabled={saving} style={{ ...S.btnPrimary, flex:2, opacity:saving?.6:1 }}>{saving ? "Salvando…" : (editandoId ? "✓ Salvar alterações" : "✓ Salvar registro")}</button>
          </div>
        </div>
      </div></div>
    );
  }

  // ══════════ TELA: LISTA ══════════
  return (
    <div style={S.page}><div style={S.wrap}>
      <Header S={S} onBack={onBack} onToggleTheme={onToggleTheme} project={project} dark={dark}/>

      <div style={{ padding:"0 16px 40px", display:"flex", flexDirection:"column", gap:14 }}>

        {/* KPIs */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          <Kpi S={S} valor={totalGeral} label="TOTAL" cor="#0ea5e9"/>
          <Kpi S={S} valor={totalDiurno} label="DIURNO" cor="#f59e0b"/>
          <Kpi S={S} valor={totalNoturno} label="NOTURNO" cor="#6366f1"/>
        </div>

        {/* Novo */}
        <button onClick={abrirNovo} style={{ ...S.btnPrimary, width:"100%" }}>+ Novo Registro de Ambulância</button>

        {/* Lista */}
        {registros.length === 0 ? (
          <div style={{ padding:"30px 16px", textAlign:"center", ...S.txt2, border:`1px dashed ${dark?"#1e293b":"#e2e8f0"}`, borderRadius:12 }}>
            Nenhum registro ainda. Toque em <strong>Novo Registro</strong> para começar.
          </div>
        ) : (
          registros.map(reg => {
            const cor = reg.gravidade==="Grave" ? "#ef4444" : reg.gravidade==="Moderada" ? "#f59e0b" : reg.gravidade==="Leve" ? "#22c55e" : "#64748b";
            return (
              <div key={reg.id} style={{ ...S.card, borderLeft:`4px solid ${cor}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:800, ...S.txt }}>🚑 {reg.inquilino || "—"}</div>
                    <div style={{ fontSize:12, ...S.txt2, marginTop:3 }}>
                      {fmtData(reg.data)}{reg.turno?` · ${reg.turno}`:""}{reg.horaEntrada?` · ${reg.horaEntrada}`:""}{reg.horaSaida?`→${reg.horaSaida}`:""}
                    </div>
                    <div style={{ fontSize:12, ...S.txt2, marginTop:2 }}>
                      {(reg.tipo==="Outro" && reg.tipoOutro ? reg.tipoOutro : reg.tipo) || "Tipo não informado"}
                      {reg.gravidade ? ` · ` : ""}
                      {reg.gravidade && <span style={{ color:cor, fontWeight:800 }}>{reg.gravidade}</span>}
                    </div>
                    {reg.paciente && reg.paciente.trim() && <div style={{ fontSize:12, ...S.txt2, marginTop:2 }}>🧍 {reg.paciente}</div>}
                    {(reg.fotos?.length>0) && <div style={{ fontSize:11, ...S.txt2, marginTop:3 }}>📷 {reg.fotos.length} foto(s)</div>}
                  </div>
                  <span style={{ fontSize:9, fontWeight:800, color:"#fff", background:cor, borderRadius:5, padding:"3px 8px", whiteSpace:"nowrap" }}>{reg.gravidade || "—"}</span>
                </div>

                <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                  <button onClick={()=>gerarPDF(reg)} style={{ ...S.btnSm, color:"#B21E27", borderColor:"#B21E2766" }}>📄 Gerar PDF</button>
                  <button onClick={()=>abrirEdicao(reg)} style={{ ...S.btnSm, color:dark?"#cbd5e1":"#475569", borderColor:dark?"#334155":"#cbd5e1" }}>✏️ Editar</button>
                  {adminAuth && <button onClick={()=>excluir(reg)} style={{ ...S.btnSm, color:"#ef4444", borderColor:"#ef444455" }}>🗑 Excluir</button>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div></div>
  );
}

// ── Componentes de apoio ──
function Header({ S, onBack, onToggleTheme, project, dark, titulo }){
  return (
    <div style={{ padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
      <button onClick={onBack} style={S.btnVoltar}>← Voltar</button>
      <div style={{ textAlign:"center", flex:1, minWidth:0 }}>
        <div style={{ fontSize:15, fontWeight:800, ...S.txt }}>🚑 {titulo || "Acesso de Ambulância"}</div>
        <div style={{ fontSize:11, ...S.txt2 }}>{project.id} · {project.name}</div>
      </div>
      <button onClick={onToggleTheme} style={S.btnVoltar}>{dark ? "☀️" : "🌙"}</button>
    </div>
  );
}

function Campo({ S, label, obrigatorio, children }){
  return (
    <div>
      <label style={{ ...S.label, display:"block", marginBottom:6 }}>
        {label}{obrigatorio && <span style={{ color:"#ef4444", marginLeft:4 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Botao({ S, ativo, cor, onClick, children }){
  return (
    <button onClick={onClick} style={{
      flex:1, padding:"12px 8px", borderRadius:10, cursor:"pointer",
      fontSize:14, fontWeight:800, transition:"all .12s",
      border: ativo ? `2px solid ${cor}` : `1.5px solid ${S._borda}`,
      background: ativo ? `${cor}22` : S._bgBtn,
      color: ativo ? cor : S._txtBtn,
      minHeight:46,
    }}>{children}</button>
  );
}

function Kpi({ S, valor, label, cor }){
  return (
    <div style={{ ...S.card, textAlign:"center", padding:"14px 8px" }}>
      <div style={{ fontSize:24, fontWeight:900, color:cor }}>{valor}</div>
      <div style={{ fontSize:10, fontWeight:800, ...S.txt2, letterSpacing:.5 }}>{label}</div>
    </div>
  );
}

// ── Estilos: alto contraste, campos grandes, fácil de tocar ──
function getStyles(dark){
  const bg = dark ? "#020510" : "#f1f5f9";
  const cardBg = dark ? "#0b1220" : "#ffffff";
  const borda = dark ? "#1e293b" : "#e2e8f0";
  const txt = dark ? "#f8fafc" : "#0f172a";
  const txt2 = dark ? "#94a3b8" : "#64748b";
  const bgBtn = dark ? "#0f172a" : "#f8fafc";
  const txtBtn = dark ? "#94a3b8" : "#64748b";
  const inputBg = dark ? "#0f172a" : "#ffffff";
  return {
    _borda: borda, _bgBtn: bgBtn, _txtBtn: txtBtn,
    page:{ minHeight:"100vh", background:bg },
    wrap:{ maxWidth:640, margin:"0 auto" },
    txt:{ color:txt },
    txt2:{ color:txt2 },
    label:{ fontSize:12, fontWeight:800, color: dark ? "#cbd5e1" : "#334155", textTransform:"uppercase", letterSpacing:.4 },
    card:{ background:cardBg, border:`1px solid ${borda}`, borderRadius:12, padding:"14px 16px" },
    input:{
      width:"100%", padding:"13px 14px", borderRadius:10,
      border:`1.5px solid ${borda}`, background:inputBg, color:txt,
      fontSize:15, fontWeight:600, outline:"none", minHeight:48,
    },
    btnPrimary:{
      padding:"14px 18px", borderRadius:12, border:"none", cursor:"pointer",
      background:"linear-gradient(135deg,#0ea5e9,#0284c7)", color:"#fff",
      fontSize:15, fontWeight:800, minHeight:50,
    },
    btnSec:{
      padding:"13px 16px", borderRadius:12, cursor:"pointer",
      border:`1.5px solid ${borda}`, background:bgBtn, color:txt,
      fontSize:14, fontWeight:700, minHeight:48,
    },
    btnSm:{
      padding:"9px 14px", borderRadius:9, cursor:"pointer",
      border:`1.5px solid ${borda}`, background:"transparent",
      fontSize:13, fontWeight:800,
    },
    btnVoltar:{
      padding:"8px 14px", borderRadius:9, cursor:"pointer",
      border:`1px solid ${borda}`, background:cardBg, color:txt,
      fontSize:13, fontWeight:700,
    },
  };
}
