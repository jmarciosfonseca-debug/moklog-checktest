// ════════════════════════════════════════════════════════════════════════
// RondaVirtual.jsx — Aba "Ronda Virtual (CFTV)" do módulo CCO
// MokLog CheckTest · Moked Consulting Security
//
// Integração: este componente é renderizado DENTRO do AcessoCCO quando
// tema === "ronda". Ele recebe por props os helpers já existentes no
// AcessoCCO (db, doc, setDoc, getDoc, loadEquipe, estilos, etc.) para não
// duplicar Firebase nem quebrar nada.
//
// Coleção Firestore: cco_ronda/{projectId}  (NOVA — não toca coleções legadas)
// Estrutura do doc: { turnos: [ <turnoObj> ], updatedAt }
//   turnoObj = {
//     id, tipo:"noturno"|"diurno", dataInicio:"YYYY-MM-DD",
//     plantonista:{ id, nome, cargo }, abertoEm, arquivado, arquivadoEm,
//     rondas: { "<offsetMin>": { inicio:"HH:MM", fim:"HH:MM",
//               atrasada:bool, naoExec:bool, anomalia:bool,
//               justificativa:"", obs:"" } }
//   }
// ════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useRef } from "react";
import { onSnapshot, runTransaction } from "firebase/firestore";
import { setDoc as fgSetDoc } from "./fireGuard";

const TOLERANCIA_MIN = 5;

// ── Definição das grades (turnos)
// Noturno (DIÁRIO): 18:00→22:00 a cada 1h, 23:00→05:30(+1) a cada 30min
// Diurno (FIM DE SEMANA / FERIADO): 06:00→17:00 a cada 1h, janela final 17:30
export const RONDA_TURNOS = {
  noturno: { key:"noturno", label:"Noturno", icon:"🌙", color:"#818cf8", bg:"#0a0a2e", obs:"Preenchimento diário" },
  diurno:  { key:"diurno",  label:"Diurno",  icon:"☀️", color:"#f59e0b", bg:"#1a1000", obs:"Apenas finais de semana e feriados" },
};

// Projetos com grade ESPECIAL no noturno (30min após as 23h até 05:30).
// Também são os projetos com regra ESPECIAL de diurno: só domingo (+feriado).
const PROJETOS_GRADE_ESPECIAL = ["P311A", "P311B"];
function temGradeEspecial(projectId){ return PROJETOS_GRADE_ESPECIAL.includes(projectId); }

// ── Calendário: o turno DIURNO só pode ser aberto em sábados, domingos e
// feriados (federais + estaduais conforme a UF do projeto). O NOTURNO abre
// todo dia. Feriados móveis (Carnaval, Sexta-feira Santa, Corpus Christi)
// são calculados automaticamente a partir da Páscoa, sem manutenção manual.
//
// EXCEÇÃO P311A / P311B: como ainda há movimentação no sábado nesses dois
// projetos, o diurno só abre no DOMINGO (ou feriado) — sábado não conta.
const PROJETO_UF = {
  P260A:"SP", P260B:"SP", P260C:"SP", P505:"SP",
  P601:"SP", P602:"SP", P604:"SP", P605:"SP",
  P606:"RJ", P607:"DF", P311A:"PR", P311B:"SC",
};
// Feriados nacionais fixos (MM-DD). 20/11 (Consciência Negra) é nacional desde 2024.
const FERIADOS_NACIONAIS = ["01-01","04-21","05-01","09-07","10-12","11-02","11-15","11-20","12-25"];
// Feriados estaduais fixos (MM-DD) por UF.
const FERIADOS_ESTADUAIS = {
  SP: ["07-09"],            // Revolução Constitucionalista
  RJ: ["04-23"],            // São Jorge (Consciência Negra já é nacional)
  DF: ["11-30"],            // Dia do Evangélico (Fundação de Brasília = 21/04, já nacional)
  PR: [],
  SC: [],
};
function _pascoa(ano){
  const a=ano%19,b=Math.floor(ano/100),c=ano%100,d=Math.floor(b/4),e=b%4,
    f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,
    i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
    mes=Math.floor((h+l-7*m+114)/31),dia=((h+l-7*m+114)%31)+1;
  return { mes, dia };
}
function _mmdd(dt){ return `${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`; }
function _feriadosMoveis(ano){
  const p=_pascoa(ano);
  const base=new Date(ano,p.mes-1,p.dia);
  const off=(n)=>{ const d=new Date(base); d.setDate(d.getDate()+n); return _mmdd(d); };
  return [off(-47), off(-2), off(60)]; // Carnaval (terça), Sexta-feira Santa, Corpus Christi
}
function ehFeriado(dataISO, uf){
  const [Y,M,D]=dataISO.split("-").map(Number);
  const md=`${String(M).padStart(2,"0")}-${String(D).padStart(2,"0")}`;
  const lista=[...FERIADOS_NACIONAIS, ...(FERIADOS_ESTADUAIS[uf]||[]), ..._feriadosMoveis(Y)];
  return lista.includes(md);
}
function diaDaSemana(dataISO){
  const [Y,M,D]=dataISO.split("-").map(Number);
  return new Date(Y,M-1,D).getDay(); // 0=domingo ... 6=sábado
}
function ehDomingo(dataISO){ return diaDaSemana(dataISO)===0; }
function ehFimDeSemana(dataISO){ const w=diaDaSemana(dataISO); return w===0||w===6; }

// Regra de abertura do turno diurno:
//  - P311A / P311B: SOMENTE domingo OU feriado (sábado comum não abre mais).
//  - Demais projetos: sábado, domingo OU feriado (regra original, inalterada).
// Projetos onde FOLGUISTA pode abrir o diurno em qualquer dia (cobre folgas
// nos dois turnos). Para os demais colaboradores, a regra de FDS/feriado vale.
const DIURNO_LIVRE_FOLGUISTA = ["P260A"];

function podeAbrirDiurno(dataISO, projectId, ehFolguista){
  // Exceção: folguista em projeto liberado abre diurno qualquer dia.
  if(ehFolguista && DIURNO_LIVRE_FOLGUISTA.includes(projectId)) return true;
  const feriado = ehFeriado(dataISO, PROJETO_UF[projectId]||"SP");
  if(temGradeEspecial(projectId)){
    return ehDomingo(dataISO) || feriado;
  }
  return ehFimDeSemana(dataISO) || feriado;
}

// offsetMin = minutos desde o horário de início do turno (18:00 noturno / 06:00 diurno)
// projectId define a cadência noturna: especial = 30min após 23h; demais = 1h até 05:00.
function buildSlots(tipo, projectId) {
  const slots = [];
  const especial = temGradeEspecial(projectId);
  // P606 (Duque de Caxias): janela deslocada +1h — diurno 07→19, noturno 19→07.
  const desloc = (projectId === "P606") ? 1 : 0;
  if (tipo === "noturno") {
    const iniN = 18 + desloc; // 18 normal, 19 no P606
    for (let h = iniN; h <= 22; h++) slots.push({ label:`${String(h).padStart(2,"0")}:00`, offsetMin:(h-iniN)*60 });
    if (especial) {
      // 23:00 → 05:30 a cada 30min (apenas P311A / P311B)
      let off = (23-iniN)*60, cur = 23*60, fim = (24+5)*60+30; // 05:30 do dia seguinte
      while (cur <= fim) {
        const hh = Math.floor((cur%1440)/60), mm = cur%60;
        slots.push({ label:`${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`, offsetMin:off });
        cur += 30; off += 30;
      }
    } else {
      // 23:00 → 05:00 (ou 06:00 no P606) a cada 1h
      let off = (23-iniN)*60, cur = 23*60, fim = (24+5+desloc)*60; // 05:00 normal, 06:00 P606... ajustado p/ fechar 12h
      while (cur <= fim) {
        const hh = Math.floor((cur%1440)/60), mm = cur%60;
        slots.push({ label:`${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`, offsetMin:off });
        cur += 60; off += 60;
      }
    }
  } else { // diurno: 06:00 → 17:00 (ou 07:00 → 18:00 no P606) de 1h
    const iniD = 6 + desloc, fimD = 17 + desloc;
    for (let h = iniD; h <= fimD; h++) slots.push({ label:`${String(h).padStart(2,"0")}:00`, offsetMin:(h-iniD)*60 });
  }
  return slots;
}

function inicioTurnoHora(tipo, projectId){
  const desloc = (projectId === "P606") ? 1 : 0;
  return (tipo==="noturno" ? 18 : 6) + desloc;
}

// minutos decorridos desde o início do turno, considerando a data de início.
// Trata a virada de meia-noite (turno noturno cruza para o dia seguinte).
function minutosDesdeInicio(tipo, dataInicio, agora=new Date(), projectId) {
  const [Y,M,D] = dataInicio.split("-").map(Number);
  const ini = new Date(Y, M-1, D, inicioTurnoHora(tipo, projectId), 0, 0, 0);
  return Math.floor((agora.getTime() - ini.getTime())/60000);
}

// Uma ronda (slot) "tem conteúdo" se qualquer campo de trabalho foi preenchido.
// Usado pela proteção anti-perda no snapshot e pela checagem de turno vazio.
// Fonte única da verdade — evita divergência entre o que é gravado e o que é
// considerado "preenchido".
function rondaTemConteudo(r) {
  if (!r || typeof r !== "object") return false;
  return !!(r.inicio || r.fim || r.naoExec || r.anomalia ||
            (r.justificativa && r.justificativa.trim && r.justificativa.trim()) ||
            (r.obs && r.obs.trim && r.obs.trim()) ||
            r.status || r.hora);
}

// Status de UM slot a partir do relógio (puro, testável).
// registro = entrada salva em turnoObj.rondas[offset] (ou null)
// Retorna: feita | feita_atrasada | naoexec | aguardando | aberto | atraso_aberto | bloqueado
function statusSlot(slot, proximoOffset, agoraMin, registro) {
  if (registro && registro.naoExec) return "naoexec";
  if (registro && registro.inicio)  return registro.atrasada ? "feita_atrasada" : "feita";
  const ini = slot.offsetMin;
  const fimTol = ini + TOLERANCIA_MIN;
  const limite = (proximoOffset != null) ? proximoOffset : (ini + 30);
  if (agoraMin < ini)       return "aguardando";
  if (agoraMin <= fimTol)   return "aberto";          // iniciar no horário
  if (agoraMin < limite)    return "atraso_aberto";   // iniciar com atraso
  return "bloqueado";                                  // estourou → não executada
}

const STATUS_META = {
  feita:          { label:"No horário",     color:"#22c55e", bg:"#021a0d", icon:"✅" },
  feita_atrasada: { label:"Feita c/ atraso",color:"#f59e0b", bg:"#1a1000", icon:"⏱️" },
  naoexec:        { label:"Não executada",  color:"#ef4444", bg:"#1a0202", icon:"❌" },
  aguardando:     { label:"Aguardando",     color:"#64748b", bg:"transparent", icon:"🕓" },
  aberto:         { label:"Iniciar agora",  color:"#22c55e", bg:"#021a0d", icon:"▶" },
  atraso_aberto:  { label:"Atrasada",       color:"#f59e0b", bg:"#1a1000", icon:"⚠️" },
  bloqueado:      { label:"Não executada",  color:"#ef4444", bg:"#1a0202", icon:"🔒" },
};

function hojeISO(){ return new Date().toLocaleDateString("sv-SE"); }
function nowHM(){ const n=new Date(); return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`; }
function fmtDataBR(d){ if(!d) return "--"; try{ return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); }catch{ return d; } }
function isFimDeSemana(dISO){ try{ const dt=new Date(dISO+"T12:00:00"); const w=dt.getDay(); return w===0||w===6; }catch{ return false; } }

// ════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL DA ABA
// props:
//   project, dark, S (estilos), adminAuth
//   loadEquipe(projectId) -> [colaboradores ativos]
//   db, doc, setDoc, getDoc  (handles do Firebase vindos do AcessoCCO)
// ════════════════════════════════════════════════════════════════════════
export default function RondaVirtual({ project, dark, S, adminAuth, loadEquipe, db, doc, setDoc, getDoc }) {
  const COL = "cco_ronda";
  const [turnos, setTurnos] = useState([]);
  // Controle de sincronização em tempo real:
  const ultimoUpdateProprio = useRef(null); // updatedAt que ESTE dispositivo gravou (p/ ignorar o próprio eco)
  const stampsProprios = useRef(new Set()); // TODOS os stamps recentes deste dispositivo (varias gravacoes em sequencia)
  const editandoRef = useRef(false);        // usuário digitando? (segura o snapshot p/ não pisar por cima)
  const editTimer = useRef(null);
  const turnosRef = useRef([]);             // sempre a lista mais recente (p/ merge)
  useEffect(()=>{ turnosRef.current = turnos; },[turnos]);
  const marcarEditando = () => {
    editandoRef.current = true;
    if(editTimer.current) clearTimeout(editTimer.current);
    editTimer.current = setTimeout(()=>{ editandoRef.current = false; }, 3500);
  };
  const [loading, setLoading] = useState(true);
  const [equipe, setEquipe] = useState([]);
  const [showArquivados, setShowArquivados] = useState(false);
  const [tick, setTick] = useState(0); // força recálculo do relógio
  const [novoTipo, setNovoTipo] = useState("noturno");
  const [novoPlant, setNovoPlant] = useState("");
  // Folguista selecionado? (libera diurno em qualquer dia nos projetos elegíveis)
  const colabSel = equipe.find(c=>String(c.id)===String(novoPlant));
  const selEhFolguista = !!colabSel && (
    (colabSel.cargo||"").toLowerCase().includes("folg") ||
    (colabSel.turno||"").toLowerCase().includes("folg")
  );
  const [abrindo, setAbrindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState(false);
  const [listaPendente, setListaPendente] = useState(null); // última gravação que falhou, p/ retry
  const [selTurnos, setSelTurnos] = useState(new Set());

  // Relógio: recalcula status a cada 30s (e ao montar/abrir o app)
  useEffect(()=>{
    const t = setInterval(()=>setTick(x=>x+1), 30000);
    return ()=>clearInterval(t);
  },[]);

  // Carregamento em TEMPO REAL (onSnapshot) — a tela atualiza sozinha quando
  // outro dispositivo grava algo, e o merge na escrita evita perda de dados.
  useEffect(()=>{
    if(!project?.id) return;
    setLoading(true);
    // 1) primeiro pinta o que houver em cache local, pra não ficar em branco
    try{ const l=localStorage.getItem(`${COL}_${project.id}`); if(l) setTurnos(JSON.parse(l)); }catch(e){}
    // 2) assina o documento em tempo real
    const ref = doc(db,COL,project.id);
    const unsub = onSnapshot(ref, (snap)=>{
      if(!snap.exists()){ setLoading(false); return; }
      const data = snap.data();
      // ignora o eco de QUALQUER gravação recente deste dispositivo (não só a última):
      // duas ações em sequência (iniciar 18h, depois finalizar) geram dois stamps, e o
      // eco atrasado do primeiro não pode reverter o segundo.
      if(data.updatedAt && (data.updatedAt === ultimoUpdateProprio.current || stampsProprios.current.has(data.updatedAt))){ setLoading(false); return; }
      // se o usuário está digitando agora, não sobrescreve a tela (evita "pular");
      // o merge na hora de salvar garante que nada se perca.
      if(editandoRef.current){ setLoading(false); return; }
      const lista = data.turnos||[];
      // PROTEÇÃO ANTI-REVERSÃO: se o servidor manda um turno SEM inicio num slot que
      // localmente já tem inicio (ronda começada aqui e ainda não ecoada), preserva o
      // local. Evita o bug "voltei pra finalizar e o app pediu pra iniciar de novo".
      const localMap = new Map((turnosRef.current||[]).map(t=>[t.id, t]));
      const fundida = lista.map(t=>{
        const loc = localMap.get(t.id);
        if(!loc || !loc.rondas) return t;
        const rondas = {...(t.rondas||{})};
        let mudou = false;
        // PROTEÇÃO ANTI-PERDA (reforçada): para CADA slot que localmente tem
        // conteúdo real (qualquer campo — inicio, fim, naoExec, justificativa,
        // obs, anomalia), garante que o eco do servidor NUNCA o esvazie.
        // Merge campo-a-campo: o servidor só sobrescreve um campo se trouxer
        // valor não-vazio; campos vazios no servidor mantêm o valor local.
        // Corrige o bug "fiz 8 rondas e no envio apareceu 0".
        for(const off of Object.keys(loc.rondas||{})){
          const rl = loc.rondas[off]||{};
          if(!rondaTemConteudo(rl)) continue; // slot local vazio: nada a proteger
          const rs = rondas[off]||{};
          // se o servidor NEM TEM o slot mas o local tem conteúdo, recupera inteiro
          if(!rondas[off] || Object.keys(rs).length===0){ rondas[off] = {...rl}; mudou = true; continue; }
          // combina campo-a-campo: servidor vazio + local cheio → mantém local
          const merged = {...rs};
          let mudouSlot = false;
          for(const campo of Object.keys(rl)){
            const vLocal = rl[campo];
            const vServ  = rs[campo];
            const servVazio  = vServ===undefined || vServ===null || vServ==="" || vServ===false;
            const localCheio = !(vLocal===undefined || vLocal===null || vLocal==="" || vLocal===false);
            if(servVazio && localCheio){ merged[campo] = vLocal; mudouSlot = true; }
          }
          if(mudouSlot){ rondas[off] = merged; mudou = true; }
        }
        return mudou ? {...t, rondas} : t;
      });
      setTurnos(fundida);
      try{ localStorage.setItem(`${COL}_${project.id}`, JSON.stringify(fundida)); }catch(e){}
      setLoading(false);
    }, (err)=>{
      console.error("Ronda snapshot error:", err);
      // fallback: cache local (já pintado acima)
      setLoading(false);
    });
    // equipe (leitura única basta)
    (async()=>{ try{ const eq = await loadEquipe(project.id); setEquipe(eq||[]); }catch(e){ setEquipe([]); } })();
    return ()=>{ try{ unsub(); }catch(e){} };
  },[project?.id]);

  // Grava com MERGE POR TURNO (transação): lê a versão do servidor e combina
  // com a alteração local por id de turno, para NUNCA apagar o trabalho de
  // outro dispositivo (ex.: rondas que outra operadora acabou de marcar).
  //   opts.turnosAlterados = ids dos turnos que ESTE dispositivo mexeu
  //   opts.remover         = ids de turnos a excluir de fato
  const persist = async (lista, opts={}) => {
    const alterados = opts.turnosAlterados || lista.map(t=>t.id);
    const remover   = new Set(opts.remover || []);
    // otimista: pinta já na tela
    setTurnos(lista);
    try{ localStorage.setItem(`${COL}_${project.id}`, JSON.stringify(lista)); }catch(e){}
    setSalvando(true);
    const ref = doc(db,COL,project.id);
    const stamp = new Date().toISOString();
    ultimoUpdateProprio.current = stamp;
    stampsProprios.current.add(stamp);
    // mantém o set pequeno: guarda só os últimos ~20 stamps
    if(stampsProprios.current.size > 20){
      const arr = Array.from(stampsProprios.current);
      stampsProprios.current = new Set(arr.slice(arr.length-20));
    }
    try{
      // modo demo: fireGuard intercepta e não grava de verdade
      await runTransaction(db, async (tx)=>{
        const snap = await tx.get(ref);
        const servidor = snap.exists() ? (snap.data().turnos||[]) : [];
        // índice do que está no servidor
        const mapa = new Map(servidor.map(t=>[t.id, t]));
        // aplica alterações locais só nos turnos que este dispositivo mexeu
        const localMap = new Map(lista.map(t=>[t.id, t]));
        for(const id of alterados){
          if(remover.has(id)){ mapa.delete(id); continue; }
          const localT = localMap.get(id);
          if(!localT) continue;
          // MERGE DE RONDAS COM O SERVIDOR (anti-perda no arquivamento):
          // a versão local vence no turno, MAS as rondas são combinadas com as
          // do servidor slot-a-slot, preservando o registro mais completo. Assim
          // um arquivamento nunca zera rondas que já estavam no servidor (ex.:
          // eco atrasado esvaziou o estado local logo antes de arquivar).
          const servT = mapa.get(id);
          if(servT && servT.rondas){
            const rondasMescladas = {...(servT.rondas||{})};
            const rondasLocais = localT.rondas||{};
            for(const off of Object.keys(rondasLocais)){
              const rl = rondasLocais[off]||{};
              const rsv = rondasMescladas[off]||{};
              if(!rondaTemConteudo(rl) && rondaTemConteudo(rsv)) continue; // servidor mais completo
              // combina campo-a-campo, valor não-vazio prevalece (local preenchido vence vazio do servidor)
              const merged = {...rsv};
              for(const campo of Object.keys(rl)){
                const vLocal = rl[campo];
                const localCheio = !(vLocal===undefined||vLocal===null||vLocal===""||vLocal===false);
                if(localCheio) merged[campo] = vLocal;
              }
              rondasMescladas[off] = merged;
            }
            mapa.set(id, {...localT, rondas: rondasMescladas});
          } else {
            mapa.set(id, localT); // servidor não tinha o turno: versão local inteira
          }
        }
        // remoções explícitas
        for(const id of remover) mapa.delete(id);
        // turnos novos que só existem localmente entram também
        for(const [id,t] of localMap){ if(!mapa.has(id) && !remover.has(id)) mapa.set(id, t); }
        const final = Array.from(mapa.values());
        tx.set(ref, { turnos: final, updatedAt: stamp });
      });
      setErroSalvar(false);
      setListaPendente(null);
    }
    catch(e){
      console.error("Ronda save error (tentativa 1):",e);
      // A transação falhou. NUNCA gravar a lista local crua por cima (isso
      // apagaria rondas de outros dispositivos e slots revertidos por eco).
      // Em vez disso: (1) tenta a transação de novo uma vez; (2) se falhar,
      // faz um merge manual re-lendo o servidor, preservando tudo.
      let ok = false;
      // (1) retry único da transação
      try{
        await runTransaction(db, async (tx)=>{
          const snap = await tx.get(ref);
          const servidor = snap.exists() ? (snap.data().turnos||[]) : [];
          const mapa = new Map(servidor.map(t=>[t.id, t]));
          const localMap2 = new Map(lista.map(t=>[t.id, t]));
          for(const id of alterados){
            if(remover.has(id)){ mapa.delete(id); continue; }
            const localT = localMap2.get(id);
            if(!localT) continue;
            const servT = mapa.get(id);
            if(servT && servT.rondas){
              const rm = {...(servT.rondas||{})};
              const rlo = localT.rondas||{};
              for(const off of Object.keys(rlo)){
                const rl = rlo[off]||{}, rsv = rm[off]||{};
                if(!rondaTemConteudo(rl) && rondaTemConteudo(rsv)) continue;
                const merged = {...rsv};
                for(const campo of Object.keys(rl)){
                  const vLocal = rl[campo];
                  if(!(vLocal===undefined||vLocal===null||vLocal===""||vLocal===false)) merged[campo]=vLocal;
                }
                rm[off] = merged;
              }
              mapa.set(id, {...localT, rondas: rm});
            } else { mapa.set(id, localT); }
          }
          for(const id of remover) mapa.delete(id);
          for(const [id,t] of localMap2){ if(!mapa.has(id) && !remover.has(id)) mapa.set(id, t); }
          tx.set(ref, { turnos: Array.from(mapa.values()), updatedAt: stamp });
        });
        ok = true;
      }catch(eRetry){ console.error("Ronda save error (retry):",eRetry); }

      // (2) merge manual não-destrutivo (lê servidor, combina, grava)
      if(!ok){
        try{
          const snap = await getDoc(ref);
          const servidor = snap.exists() ? (snap.data().turnos||[]) : [];
          const mapa = new Map(servidor.map(t=>[t.id, t]));
          const localMap2 = new Map(lista.map(t=>[t.id, t]));
          for(const id of alterados){
            if(remover.has(id)){ mapa.delete(id); continue; }
            const localT = localMap2.get(id);
            if(!localT) continue;
            const servT = mapa.get(id);
            if(servT && servT.rondas){
              const rm = {...(servT.rondas||{})};
              const rlo = localT.rondas||{};
              for(const off of Object.keys(rlo)){
                const rl = rlo[off]||{}, rsv = rm[off]||{};
                if(!rondaTemConteudo(rl) && rondaTemConteudo(rsv)) continue;
                const merged = {...rsv};
                for(const campo of Object.keys(rl)){
                  const vLocal = rl[campo];
                  if(!(vLocal===undefined||vLocal===null||vLocal===""||vLocal===false)) merged[campo]=vLocal;
                }
                rm[off] = merged;
              }
              mapa.set(id, {...localT, rondas: rm});
            } else { mapa.set(id, localT); }
          }
          for(const id of remover) mapa.delete(id);
          for(const [id,t] of localMap2){ if(!mapa.has(id) && !remover.has(id)) mapa.set(id, t); }
          await fgSetDoc(ref, { turnos: Array.from(mapa.values()), updatedAt: stamp });
          ok = true;
        }catch(eMerge){ console.error("Ronda merge fallback error:",eMerge); }
      }

      if(ok){ setErroSalvar(false); setListaPendente(null); }
      else {
        // não conseguiu gravar: mantém pendente e AVISA (não perde o trabalho local)
        setErroSalvar(true);
        setListaPendente(lista);
      }
    }
    setSalvando(false);
  };

  const tentarSalvarDeNovo = () => { if(listaPendente) persist(listaPendente); };

  const abrirTurno = async () => {
    // ── TRAVA: só pode existir UM turno ativo (não arquivado) por vez no projeto.
    // Evita múltiplas rondas abertas simultaneamente por pessoas diferentes.
    const turnoAbertoExistente = turnos.find(t=>!t.arquivado);
    if(turnoAbertoExistente){
      alert(`Já existe um turno de ronda em aberto neste projeto.\n\nPlantonista: ${turnoAbertoExistente.plantonista?.nome||"—"} · ${RONDA_TURNOS[turnoAbertoExistente.tipo]?.label||turnoAbertoExistente.tipo}\n\nConclua e arquive esse turno antes de abrir um novo.`);
      return;
    }
    // Trava de calendário: diurno só abre em dia válido (regra varia por projeto).
    if(novoTipo==="diurno" && !podeAbrirDiurno(hojeISO(), project.id, selEhFolguista)){
      const msg = temGradeEspecial(project.id)
        ? "O turno diurno só pode ser aberto no domingo ou em feriado.\nHoje não é um dia válido para ronda diurna neste projeto. O turno noturno está disponível todos os dias."
        : "O turno diurno só pode ser aberto em sábados, domingos e feriados.\nHoje não é um dia válido para ronda diurna neste projeto. O turno noturno está disponível todos os dias.";
      alert(msg);
      return;
    }
    if(!novoPlant){ alert("Selecione o plantonista de plantão."); return; }
    const col = equipe.find(c=>String(c.id)===String(novoPlant));
    if(!col){ alert("Plantonista inválido."); return; }

    // ── Confere se o turno cadastrado do plantonista bate com o tipo de ronda
    // selecionado. Não bloqueia (trocas de plantão e extras acontecem), mas
    // pede confirmação explícita pra evitar mistura sem querer.
    const turnoColab = (col.turno||"").toLowerCase();
    const ehFolguista = (col.cargo||"").toLowerCase().includes("folg") || turnoColab.includes("folg");
    const ehNoturnoColab = turnoColab.includes("noturno");
    const ehDiurnoColab = turnoColab.includes("diurno");
    const bateTurno = ehFolguista || (novoTipo==="diurno" && ehDiurnoColab) || (novoTipo==="noturno" && ehNoturnoColab);
    if(turnoColab && !bateTurno){
      const confirma = window.confirm(
        `${col.nome} está cadastrado(a) como turno "${col.turno}".\n\n`+
        `Você está abrindo uma ronda ${novoTipo==="diurno"?"DIURNA":"NOTURNA"}.\n\n`+
        `Confirma que ${col.nome} está de plantão (extra ou trocado) neste turno agora?`
      );
      if(!confirma) return;
    }

    setAbrindo(true);
    const novo = {
      id: Date.now().toString()+Math.random().toString(36).substring(2,6),
      tipo: novoTipo,
      dataInicio: hojeISO(),
      plantonista: { id:col.id, nome:col.nome, cargo:col.cargo||"" },
      abertoEm: new Date().toISOString(),
      arquivado: false,
      rondas: {},
    };
    await persist([novo, ...turnosRef.current], { turnosAlterados:[novo.id] });
    setNovoPlant("");
    setAbrindo(false);
  };

  const updTurno = async (turnoId, fn) => {
    const lista = turnosRef.current.map(t=> t.id===turnoId ? fn({...t}) : t);
    await persist(lista, { turnosAlterados:[turnoId] });
  };
  const arquivarTurno   = (turnoId)=> updTurno(turnoId, t=>({...t, arquivado:true, arquivadoEm:new Date().toISOString()}));
  const desarquivarTurno= (turnoId)=> updTurno(turnoId, t=>({...t, arquivado:false}));
  const excluirTurno    = async (turnoId)=> { await persist(turnosRef.current.filter(t=>t.id!==turnoId), { turnosAlterados:[turnoId], remover:[turnoId] }); };

  const ativos = turnos.filter(t=>!t.arquivado);
  const arquivados = turnos.filter(t=>t.arquivado);
  const visiveis = showArquivados ? arquivados : ativos;
  const jaTemAberto = ativos.length>0;

  if(loading) return (
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div style={{fontSize:28,marginBottom:8}}>🎥</div>
      <div style={{fontSize:13,...S.txt2}}>Carregando rondas virtuais...</div>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {/* Aviso visível quando a gravação no servidor falha — evita a sensação
          de "app não responde" quando, na verdade, é a rede/Firebase que falhou. */}
      {erroSalvar && (
        <div role="alert" style={{background:"#7c2d12",border:"1px solid #ef4444",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>🚫</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:"#fff"}}>Falha ao salvar a ronda</div>
            <div style={{fontSize:11,color:"#fed7aa"}}>O servidor não respondeu. Esta ação ainda não foi salva — toque em "Tentar" antes de continuar.</div>
          </div>
          <button onClick={tentarSalvarDeNovo} disabled={salvando}
            style={{background:"#fff",color:"#7c2d12",border:"none",borderRadius:8,padding:"8px 14px",fontWeight:700,fontSize:12,cursor:salvando?"not-allowed":"pointer",flexShrink:0,opacity:salvando?0.6:1}}>
            {salvando?"⟳":"Tentar"}
          </button>
        </div>
      )}
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <KpiBox S={S} val={turnos.length} label="TURNOS" color="#818cf8"/>
        <KpiBox S={S} val={ativos.length} label="ATIVOS" color="#22c55e"/>
        <KpiBox S={S} val={arquivados.length} label="ARQUIVADOS" color="#64748b"/>
      </div>

      {/* Abrir novo turno */}
      {!showArquivados && (
        jaTemAberto ? (
          <div style={{...S.card,border:"1px solid #f59e0b44",background:dark?"#1a1000":"#fffbeb"}}>
            <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>⚠ Já existe um turno em aberto</div>
            <div style={{fontSize:12,...S.txt}}>
              Conclua e arquive o turno de <strong>{ativos[0]?.plantonista?.nome||"—"}</strong> ({RONDA_TURNOS[ativos[0]?.tipo]?.label}) antes de abrir um novo turno de ronda.
            </div>
          </div>
        ) : (
        <div style={S.card}>
          <div style={{fontSize:11,color:"#818cf8",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>🎥 Abrir turno de ronda</div>
          <label style={S.lbl}>Turno</label>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {Object.values(RONDA_TURNOS).map(t=>{
              const sel=novoTipo===t.key;
              return (
                <button key={t.key} onClick={()=>setNovoTipo(t.key)}
                  style={{flex:1,background:sel?t.bg:"transparent",border:`1px solid ${sel?t.color+"66":dark?"#0f172a":"#e2e8f0"}`,color:sel?t.color:dark?"#475569":"#94a3b8",borderRadius:8,padding:"9px 8px",fontSize:12,cursor:"pointer",fontWeight:sel?700:500}}>
                  {t.icon} {t.label}
                </button>
              );
            })}
          </div>
          <div style={{fontSize:11,...S.txt2,marginBottom:10,background:dark?"#020510":"#f8fafc",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderRadius:8,padding:"8px 10px"}}>
            <strong style={{color:RONDA_TURNOS[novoTipo].color}}>{RONDA_TURNOS[novoTipo].icon} {RONDA_TURNOS[novoTipo].label}</strong> · {RONDA_TURNOS[novoTipo].obs}
            <br/>{novoTipo==="noturno"
              ? (temGradeEspecial(project.id)
                  ? "18h→22h a cada 1h · 23h→05:30 a cada 30min"
                  : "18h→05h a cada 1 hora")
              : (temGradeEspecial(project.id)
                  ? "06h→17h a cada 1 hora · apenas domingo ou feriado"
                  : "06h→17h a cada 1 hora")}
          </div>
          <label style={S.lbl}>Plantonista *</label>
          <select value={novoPlant} onChange={e=>setNovoPlant(e.target.value)} style={{...S.inp,marginBottom:10}}>
            <option value="">Selecione o plantonista...</option>
            {equipe.map(c=>(<option key={c.id} value={c.id}>{c.nome}{c.cargo?` — ${c.cargo}`:""}{c.turno?` · ${c.turno}`:""}</option>))}
          </select>
          {equipe.length===0 && <div style={{fontSize:11,color:"#ef4444",marginBottom:8}}>Nenhum colaborador em equipes/{"{projeto}"}. Cadastre a equipe primeiro.</div>}
          {novoTipo==="diurno" && !podeAbrirDiurno(hojeISO(), project.id, selEhFolguista) && (
            <div style={{fontSize:11,color:"#f59e0b",marginBottom:8,background:dark?"#1a1000":"#fffbeb",border:"1px solid #f59e0b44",borderRadius:7,padding:"7px 9px"}}>
              📅 Turno diurno indisponível hoje. {temGradeEspecial(project.id)?"Só abre no domingo ou em feriado.":"Só abre em sábados, domingos e feriados."} O turno noturno está disponível todos os dias.
            </div>
          )}
          {(()=>{ const bloqueado = novoTipo==="diurno" && !podeAbrirDiurno(hojeISO(), project.id, selEhFolguista);
            return (
              <button onClick={abrirTurno} disabled={abrindo||bloqueado}
                style={{...S.btn,opacity:(abrindo||bloqueado)?0.5:1,cursor:bloqueado?"not-allowed":"pointer"}}>
                {abrindo?"⟳ Abrindo...":"▶ Abrir turno de ronda"}
              </button>
            );
          })()}
        </div>
        )
      )}

      {/* Toggle ativos / arquivados */}
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setShowArquivados(false)} style={{...S.btnSm,flex:1,padding:"7px",...(!showArquivados?{background:"#818cf822",border:"1px solid #818cf866",color:"#818cf8"}:{})}}>Ativos ({ativos.length})</button>
        <button onClick={()=>setShowArquivados(true)} style={{...S.btnSm,flex:1,padding:"7px",...(showArquivados?{background:"#64748b22",border:"1px solid #64748b66",color:"#94a3b8"}:{})}}>📦 Arquivados ({arquivados.length})</button>
      </div>

      {showArquivados && arquivados.length>0 && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,background:dark?"#0c0a1a":"#faf5ff",border:"1px solid #a855f733",borderRadius:8,padding:"8px 10px"}}>
          <span style={{fontSize:11,color:"#a855f7",fontWeight:700}}>☑ {selTurnos.size} turno{selTurnos.size===1?"":"s"} selecionado{selTurnos.size===1?"":"s"} p/ consolidado</span>
          {selTurnos.size>=2 && (
            <button onClick={()=>gerarPDFConsolidadoRonda(project, arquivados.filter(t=>selTurnos.has(t.id)))}
              style={{...S.btnSm,background:"#a855f722",border:"1px solid #a855f766",color:"#a855f7",fontWeight:700,whiteSpace:"nowrap"}}>
              📊 Gerar Consolidado
            </button>
          )}
        </div>
      )}

      {visiveis.length===0 && (
        <div style={{textAlign:"center",padding:"36px 0"}}>
          <div style={{fontSize:30,marginBottom:8}}>{showArquivados?"📦":"🎥"}</div>
          <div style={{fontSize:13,...S.txt}}>{showArquivados?"Nenhum turno arquivado":"Nenhum turno de ronda aberto"}</div>
        </div>
      )}

      {visiveis.map(t=>(
        <div key={t.id} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
          {showArquivados && (
            <button onClick={()=>setSelTurnos(prev=>{const next=new Set(prev);next.has(t.id)?next.delete(t.id):next.add(t.id);return next;})}
              style={{marginTop:14,width:24,height:24,borderRadius:6,border:`2px solid ${selTurnos.has(t.id)?"#a855f7":"#475569"}`,background:selTurnos.has(t.id)?"#a855f733":"transparent",color:"#a855f7",fontSize:13,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"}}>
              {selTurnos.has(t.id)?"✓":""}
            </button>
          )}
          <div style={{flex:1,minWidth:0}}>
            <TurnoCard turno={t} projectId={project.id} dark={dark} S={S} adminAuth={adminAuth} tick={tick}
              onEditando={marcarEditando}
              onUpd={updTurno} onArquivar={()=>arquivarTurno(t.id)} onDesarquivar={()=>desarquivarTurno(t.id)}
              onExcluir={(jaConfirmado)=>{ if(jaConfirmado===true || window.confirm("Excluir turno definitivamente?")) excluirTurno(t.id); }}
              onPDF={()=>gerarPDFRonda(project, t)}/>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── KPI local (mesmo visual do KPI do AcessoCCO)
function KpiBox({ S, val, label, color }) {
  return (
    <div style={{...S.card,textAlign:"center",padding:"10px 8px"}}>
      <div style={{fontSize:22,fontWeight:900,color}}>{val}</div>
      <div style={{fontSize:9,...S.txt2,fontWeight:700}}>{label}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// CARTÃO DE UM TURNO — lista os slots e gerencia início/fim/justificativa
// ════════════════════════════════════════════════════════════════════════
function TurnoCard({ turno, projectId, dark, S, adminAuth, tick, onEditando, onUpd, onArquivar, onDesarquivar, onExcluir, onPDF }) {
  const [open, setOpen] = useState(!turno.arquivado);
  const tinfo = RONDA_TURNOS[turno.tipo] || RONDA_TURNOS.noturno;
  const slots = useMemo(()=>buildSlots(turno.tipo, projectId),[turno.tipo, projectId]);
  const agoraMin = minutosDesdeInicio(turno.tipo, turno.dataInicio, new Date(), projectId); // recalculado a cada render (tick)
  void tick;

  // Computa status de cada slot + estatísticas
  const linhas = slots.map((s,i)=>{
    const prox = slots[i+1] ? slots[i+1].offsetMin : null;
    const reg = turno.rondas?.[String(s.offsetMin)] || null;
    const st = statusSlot(s, prox, agoraMin, reg);
    return { slot:s, prox, reg, st };
  });
  const feitas = linhas.filter(l=>l.st==="feita"||l.st==="feita_atrasada").length;
  const naoexec = linhas.filter(l=>l.st==="naoexec"||l.st==="bloqueado").length;
  // Rondas NÃO REALIZADAS sem justificativa preenchida (estas TRAVAM o arquivamento).
  const naoRealizadasSemJust = linhas.filter(l=>
    (l.st==="bloqueado" || l.st==="naoexec") && !(l.reg && (l.reg.justificativa||"").trim())
  ).length;
  // Indicador geral (não-execução sem justificativa + atrasos sem justificativa) — só visual.
  const pendJust = naoRealizadasSemJust
                 + linhas.filter(l=>l.st==="feita_atrasada" && !(l.reg&&(l.reg.justificativa||"").trim())).length;

  // Conclui/arquiva o turno SOMENTE se todas as rondas não realizadas estiverem justificadas.
  // Turno "vazio": nenhuma ronda foi registrada ainda. Nesse caso qualquer
  // usuário pode CANCELAR (abertura por engano — ex.: turno/plantonista errado),
  // sem precisar de PIN gerencial e sem exigir justificativas.
  const turnoVazio = !Object.values(turno.rondas||{}).some(r=>rondaTemConteudo(r));

  const tentarArquivar = () => {
    if(naoRealizadasSemJust>0){
      alert(`Favor justificar as rondas não realizadas.\n\nHá ${naoRealizadasSemJust} ronda(s) não executada(s) sem justificativa. Preencha o motivo antes de concluir e arquivar o turno.`);
      return;
    }
    onArquivar();
  };

  // Ações sobre um slot
  const setRonda = (offset, patch) => onUpd(turno.id, t=>{
    const rondas = {...(t.rondas||{})};
    rondas[String(offset)] = {...(rondas[String(offset)]||{}), ...patch};
    return {...t, rondas};
  });

  const iniciar = (linha) => {
    onEditando && onEditando(); // segura o snapshot por ~3.5s p/ o eco não reverter o "iniciar"
    const atrasada = linha.st==="atraso_aberto";
    setRonda(linha.slot.offsetMin, { inicio:nowHM(), atrasada, naoExec:false, fim:"", anomalia:false, justificativa:linha.reg?.justificativa||"" });
  };
  const fechar = (linha, anomalia) => {
    onEditando && onEditando();
    setRonda(linha.slot.offsetMin, { fim:nowHM(), anomalia });
  };
  const marcarNaoExec = (linha) => {
    onEditando && onEditando();
    setRonda(linha.slot.offsetMin, { naoExec:true, inicio:"", fim:"" });
  };
  const setJustificativa = (linha, val) => { onEditando && onEditando(); setRonda(linha.slot.offsetMin, { justificativa:val }); };
  const setObs = (linha, val) => { onEditando && onEditando(); setRonda(linha.slot.offsetMin, { obs:val }); };

  return (
    <div style={{...S.card,border:`1px solid ${tinfo.color}33`,opacity:turno.arquivado?0.75:1}}>
      <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setOpen(!open)}>
        <div style={{width:40,height:40,borderRadius:10,background:tinfo.bg,border:`1px solid ${tinfo.color}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>{tinfo.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,...S.txt}}>
            {turno.plantonista?.nome||"—"}
            {turno.arquivado&&<span style={{fontSize:9,color:"#64748b",fontWeight:700,marginLeft:6,background:dark?"#0f172a":"#f1f5f9",padding:"1px 6px",borderRadius:6}}>📦 Arquivado</span>}
          </div>
          <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:tinfo.color,fontWeight:700}}>{tinfo.icon} {tinfo.label}</span>
            <span style={{fontSize:10,...S.txt2}}>📅 {fmtDataBR(turno.dataInicio)}</span>
            <span style={{fontSize:10,color:"#22c55e"}}>✅ {feitas}</span>
            <span style={{fontSize:10,color:"#ef4444"}}>❌ {naoexec}</span>
            {pendJust>0 && <span style={{fontSize:10,color:"#f59e0b",fontWeight:700}}>⚠ {pendJust} p/ justificar</span>}
          </div>
        </div>
        <span style={{...S.txt2,fontSize:12}}>{open?"▲":"▼"}</span>
      </div>

      {turno.tipo==="diurno" && !isFimDeSemana(turno.dataInicio) && (
        <div style={{fontSize:10,color:"#f59e0b",marginTop:8,background:dark?"#1a1000":"#fffbeb",border:"1px solid #f59e0b44",borderRadius:7,padding:"6px 9px"}}>
          ⚠ Turno diurno é previsto apenas para finais de semana e feriados.
        </div>
      )}

      {open && (
        <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${dark?"#0f172a":"#f1f5f9"}`,display:"flex",flexDirection:"column",gap:6}}>
          {linhas.map((l)=>(
            <SlotRow key={l.slot.offsetMin} linha={l} dark={dark} S={S}
              disabled={turno.arquivado}
              onIniciar={()=>iniciar(l)} onFecharSem={()=>fechar(l,false)} onFecharCom={()=>fechar(l,true)}
              onNaoExec={()=>marcarNaoExec(l)} onJust={(v)=>setJustificativa(l,v)} onObs={(v)=>setObs(l,v)}/>
          ))}

          {!turno.arquivado && naoRealizadasSemJust>0 && (
            <div style={{fontSize:11,color:"#ef4444",marginTop:6,background:dark?"#1a0202":"#fef2f2",border:"1px solid #ef444444",borderRadius:7,padding:"7px 9px"}}>
              ⚠ {naoRealizadasSemJust} ronda(s) não realizada(s) sem justificativa. Justifique todas para poder concluir e arquivar o turno.
            </div>
          )}

          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
            <button onClick={onPDF} style={{...S.btnSm,color:"#a855f7",border:"1px solid #a855f733"}}>📄 PDF</button>
            {!turno.arquivado
              ? <button onClick={tentarArquivar} style={{...S.btnSm,color:naoRealizadasSemJust>0?"#94a3b8":"#64748b",border:`1px solid ${dark?"#1e293b":"#cbd5e1"}`,opacity:naoRealizadasSemJust>0?0.6:1}}>📦 Concluir e arquivar</button>
              : <button onClick={onDesarquivar} style={{...S.btnSm,color:"#0ea5e9",border:"1px solid #0ea5e944"}}>↩ Desarquivar</button>}
            {!turno.arquivado && turnoVazio && (
              <button onClick={()=>{ if(window.confirm(`Cancelar este turno?\n\n${turno.plantonista?.nome||"—"} · ${RONDA_TURNOS[turno.tipo]?.label||turno.tipo}\n\nNenhuma ronda foi registrada. O turno será removido e você poderá abrir outro.`)) onExcluir(true); }}
                style={{...S.btnSm,color:"#f59e0b",border:"1px solid #f59e0b44"}}>✕ Cancelar turno</button>
            )}
            {adminAuth && <button onClick={onExcluir} style={{...S.btnSm,color:"#ef4444",border:"1px solid #ef444433"}}>🗑 Excluir</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Linha de um slot
function SlotRow({ linha, dark, S, disabled, onIniciar, onFecharSem, onFecharCom, onNaoExec, onJust, onObs }) {
  const { slot, reg, st } = linha;
  const meta = STATUS_META[st] || STATUS_META.aguardando;
  const iniciada = reg && reg.inicio;
  const fechada = reg && reg.fim;
  const precisaJust = st==="bloqueado" || st==="naoexec" || st==="feita_atrasada" || (st==="atraso_aberto");
  const borderC = (st==="naoexec"||st==="bloqueado") ? "#ef4444"
                : (st==="feita_atrasada"||st==="atraso_aberto") ? "#f59e0b"
                : (st==="feita") ? "#22c55e"
                : (st==="aberto") ? "#22c55e" : (dark?"#0f172a":"#e2e8f0");

  return (
    <div style={{background:dark?"#020510":"#f8fafc",border:`1px solid ${dark?"#0f172a":"#e2e8f0"}`,borderLeft:`3px solid ${borderC}`,borderRadius:8,padding:"8px 10px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:14,fontWeight:800,...S.txt,minWidth:46}}>{slot.label}</span>
        <span style={{fontSize:10,fontWeight:700,color:meta.color,background:meta.bg==="transparent"?"transparent":meta.bg,border:`1px solid ${meta.color}44`,borderRadius:6,padding:"2px 7px"}}>{meta.icon} {meta.label}</span>
        <div style={{flex:1}}/>
        {/* Ações conforme estado */}
        {!disabled && (st==="aberto"||st==="atraso_aberto") && !iniciada && (
          <button onClick={onIniciar} style={{...S.btnSm,color:meta.color,border:`1px solid ${meta.color}66`,padding:"5px 10px"}}>▶ Iniciar</button>
        )}
        {!disabled && iniciada && !fechada && (
          <div style={{display:"flex",gap:4}}>
            <button onClick={onFecharSem} style={{...S.btnSm,color:"#22c55e",border:"1px solid #22c55e66",padding:"5px 8px"}}>✓ Sem anomalia</button>
            <button onClick={onFecharCom} style={{...S.btnSm,color:"#ef4444",border:"1px solid #ef444466",padding:"5px 8px"}}>⚠ Com anomalia</button>
          </div>
        )}
        {!disabled && st==="bloqueado" && !reg?.naoExec && (
          <button onClick={onNaoExec} style={{...S.btnSm,color:"#ef4444",border:"1px solid #ef444466",padding:"5px 10px"}}>Marcar não exec.</button>
        )}
      </div>

      {/* Detalhes de horário */}
      {(iniciada || fechada) && (
        <div style={{fontSize:11,...S.txt2,marginTop:5}}>
          {reg.inicio && <>Início <strong style={{color:reg.atrasada?"#f59e0b":"#22c55e"}}>{reg.inicio}</strong></>}
          {reg.fim && <> · Fim <strong>{reg.fim}</strong></>}
          {fechada && <> · {reg.anomalia
            ? <span style={{color:"#ef4444",fontWeight:700}}>Com anomalias</span>
            : <span style={{color:"#22c55e",fontWeight:700}}>Sem anomalias</span>}</>}
        </div>
      )}

      {/* Justificativa (obrigatória em atraso / não executada) */}
      {!disabled && precisaJust && (
        <div style={{marginTop:6}}>
          <label style={{...S.lbl,color:"#f59e0b"}}>
            {(st==="bloqueado"||st==="naoexec") ? "Justifique a não execução *" : "Justifique o atraso *"}
          </label>
          <input value={reg?.justificativa||""} onChange={e=>onJust(e.target.value)}
            placeholder="Ex.: fluxo intenso de saída de veículos..." style={{...S.inp,fontSize:12}}/>
        </div>
      )}

      {/* Observação da anomalia */}
      {!disabled && fechada && reg.anomalia && (
        <div style={{marginTop:6}}>
          <label style={S.lbl}>O que foi observado *</label>
          <textarea value={reg?.obs||""} onChange={e=>onObs(e.target.value)}
            placeholder="Câmera, local, situação e ações tomadas..." style={{...S.inp,height:54,resize:"vertical",fontSize:12}}/>
        </div>
      )}

      {disabled && reg?.justificativa && (
        <div style={{fontSize:11,color:"#f59e0b",marginTop:5}}>⚠ {reg.justificativa}</div>
      )}
      {disabled && reg?.obs && (
        <div style={{fontSize:11,...S.txt2,marginTop:4,lineHeight:1.4}}>{reg.obs}</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// PDF do turno de ronda (mesmo padrão visual do gerarPDFTema do AcessoCCO)
// ════════════════════════════════════════════════════════════════════════
export function gerarPDFRonda(project, turno) {
  const tinfo = RONDA_TURNOS[turno.tipo] || RONDA_TURNOS.noturno;
  const slots = buildSlots(turno.tipo, project.id);
  const hoje = new Date().toLocaleDateString("pt-BR");

  const rows = slots.map((s,i)=>{
    const prox = slots[i+1] ? slots[i+1].offsetMin : null;
    const reg = turno.rondas?.[String(s.offsetMin)] || null;
    const st = statusSlot(s, prox, minutosDesdeInicio(turno.tipo, turno.dataInicio, new Date(), project.id), reg);
    const meta = STATUS_META[st] || STATUS_META.aguardando;
    const inicio = reg?.inicio || "--";
    const fim = reg?.fim || "--";
    const result = (reg && reg.fim) ? (reg.anomalia ? "Com anomalias" : "Sem anomalias") : "--";
    const just = reg?.justificativa || "";
    const obs = reg?.obs || "";
    const cor = meta.color;
    return `<tr>
      <td><strong>${s.label}</strong></td>
      <td style="color:${cor};font-weight:700">${meta.label}</td>
      <td>${inicio}</td><td>${fim}</td><td>${result}</td>
      <td style="font-size:10px">${[just,obs].filter(Boolean).join(" — ")||"--"}</td>
    </tr>`;
  }).join("");

  const feitas = slots.filter((s,i)=>{ const reg=turno.rondas?.[String(s.offsetMin)]; return reg&&reg.inicio; }).length;
  const naoexec = slots.filter((s,i)=>{
    const prox = slots[i+1] ? slots[i+1].offsetMin : null;
    const reg = turno.rondas?.[String(s.offsetMin)] || null;
    const st = statusSlot(s, prox, minutosDesdeInicio(turno.tipo, turno.dataInicio, new Date(), project.id), reg);
    return st==="naoexec"||st==="bloqueado";
  }).length;

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Ronda Virtual — ${project.id} ${hoje}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:20px;color:#1e293b}
  .header{background:linear-gradient(135deg,#0c2340,#081626);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
  .header h1{font-size:18px;margin-bottom:4px}
  .header p{font-size:11px;opacity:.75}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px}
  .card h2{font-size:13px;color:#475569;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #f1f5f9;padding-bottom:8px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
  td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  .footer{text-align:center;margin-top:16px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
  .kpi{display:flex;gap:10px;margin-bottom:14px}
  .kpibox{flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
  .kpibox .n{font-size:22px;font-weight:800;color:#0c2340}
  .kpibox .l{font-size:10px;color:#64748b;font-weight:700}
  .meta{display:flex;gap:16px;font-size:12px;margin-bottom:12px;flex-wrap:wrap}
  .meta b{color:#0c2340}
  @media print{body{padding:8px}@page{margin:12mm}.no-print{display:none}}
</style></head>
<body>
<div class="no-print" style="text-align:center;margin-bottom:16px">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>
<div class="header">
  <div>
    <h1>🎥 Ronda Virtual (CFTV) — CCO</h1>
    <p>${project.id} — ${project.name||""}</p>
    <p>Relatório gerado em ${hoje}</p>
  </div>
  <div style="text-align:right;font-size:11px;opacity:.75">
    <div>Moked Consulting Security</div>
    <div>MokLog CheckTest</div>
  </div>
</div>
<div class="meta">
  <div><b>Turno:</b> ${tinfo.label}</div>
  <div><b>Plantonista:</b> ${turno.plantonista?.nome||"--"}${turno.plantonista?.cargo?` (${turno.plantonista.cargo})`:""}</div>
  <div><b>Data de início:</b> ${fmtDataBR(turno.dataInicio)}</div>
</div>
<div class="kpi">
  <div class="kpibox"><div class="n">${slots.length}</div><div class="l">RONDAS PREVISTAS</div></div>
  <div class="kpibox"><div class="n">${feitas}</div><div class="l">REALIZADAS</div></div>
  <div class="kpibox"><div class="n">${naoexec}</div><div class="l">NÃO EXECUTADAS</div></div>
</div>
<div class="card">
  <h2>Rondas do turno</h2>
  <table><thead><tr><th>Horário</th><th>Status</th><th>Início</th><th>Fim</th><th>Resultado</th><th>Justificativa / Observação</th></tr></thead>
  <tbody>${rows}</tbody></table>
</div>
<div class="footer">
  <div>MokLog CheckTest © Moked Consulting Security</div>
  <div>Ronda Virtual · ${project.id} · ${tinfo.label} · ${fmtDataBR(turno.dataInicio)}</div>
</div>
</body></html>`;

  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`cco_ronda_${project.id}_${turno.tipo}_${turno.dataInicio}.html`; a.click();
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════════════════
// PDF CONSOLIDADO — múltiplos turnos, ranking de atrasos/não-execuções por
// colaborador, separando ocorrências COM justificativa preenchida (possível
// causa operacional legítima) das SEM justificativa (negligência aparente).
// Nota: o sistema não classifica o CONTEÚDO da justificativa como "válida"
// ou não — isso é uma decisão humana. Aqui apenas separa "foi justificado"
// de "não foi justificado", que é o que os dados permitem com segurança.
// ════════════════════════════════════════════════════════════════════════
export function gerarPDFConsolidadoRonda(project, turnosSelecionados) {
  if(!turnosSelecionados || turnosSelecionados.length<2) return;
  const turnos = turnosSelecionados.slice().sort((a,b)=>(a.dataInicio||"").localeCompare(b.dataInicio||""));
  const hoje = new Date().toLocaleDateString("pt-BR");

  const porColaborador = {};
  let totalPrevistas=0, totalRealizadas=0, totalAtrasos=0, totalNaoExec=0, totalSemJust=0;
  const ocorrenciasSemJust = [];

  turnos.forEach(t=>{
    const tinfo = RONDA_TURNOS[t.tipo] || RONDA_TURNOS.noturno;
    const slots = buildSlots(t.tipo, project.id);
    const agoraMin = minutosDesdeInicio(t.tipo, t.dataInicio, new Date(), project.id);
    const nome = t.plantonista?.nome || "—";
    if(!porColaborador[nome]) porColaborador[nome]={nome,turnos:0,atrasos:0,naoexec:0,semJust:0,comJust:0};
    porColaborador[nome].turnos++;
    let realizadasTurno=0;

    slots.forEach((s,i)=>{
      const prox = slots[i+1] ? slots[i+1].offsetMin : null;
      const reg = t.rondas?.[String(s.offsetMin)] || null;
      const st = statusSlot(s, prox, agoraMin, reg);
      if(reg && reg.inicio) realizadasTurno++;
      const just = (reg?.justificativa||"").trim();
      if(st==="feita_atrasada"){
        totalAtrasos++; porColaborador[nome].atrasos++;
        if(just){ porColaborador[nome].comJust++; }
        else { totalSemJust++; porColaborador[nome].semJust++; ocorrenciasSemJust.push({nome,data:fmtDataBR(t.dataInicio),turno:tinfo.label,horario:s.label,tipo:"Atraso"}); }
      } else if(st==="naoexec"||st==="bloqueado"){
        totalNaoExec++; porColaborador[nome].naoexec++;
        if(just){ porColaborador[nome].comJust++; }
        else { totalSemJust++; porColaborador[nome].semJust++; ocorrenciasSemJust.push({nome,data:fmtDataBR(t.dataInicio),turno:tinfo.label,horario:s.label,tipo:"Não executada"}); }
      }
    });
    totalPrevistas += slots.length;
    totalRealizadas += realizadasTurno;
  });

  const ranking = Object.values(porColaborador).sort((a,b)=>(b.atrasos+b.naoexec)-(a.atrasos+a.naoexec));
  const periodoIni = fmtDataBR(turnos[0]?.dataInicio), periodoFim = fmtDataBR(turnos[turnos.length-1]?.dataInicio);

  const rankingRows = ranking.map((c,i)=>{
    const totalProb = c.atrasos+c.naoexec;
    const tier = c.semJust===0 ? {label:"REGULAR",color:"#15803d",bg:"#dcfce7"}
               : c.semJust<=2 ? {label:"ATENÇÃO",color:"#d97706",bg:"#fef3c7"}
               : {label:"CRÍTICO",color:"#dc2626",bg:"#fee2e2"};
    return `<tr style="${i===0&&totalProb>0?'background:#fef2f2':''}">
      <td style="font-weight:800;color:#1e293b">${c.nome}</td>
      <td style="text-align:center">${c.turnos}</td>
      <td style="text-align:center;font-weight:700;color:${c.atrasos>0?'#d97706':'#15803d'}">${c.atrasos}</td>
      <td style="text-align:center;font-weight:700;color:${c.naoexec>0?'#dc2626':'#15803d'}">${c.naoexec}</td>
      <td style="text-align:center;font-weight:700;color:#15803d">${c.comJust}</td>
      <td style="text-align:center;font-weight:800;color:${c.semJust>0?'#dc2626':'#94a3b8'}">${c.semJust}</td>
      <td style="text-align:center"><span class="badge" style="background:${tier.bg};color:${tier.color}">${tier.label}</span></td>
    </tr>`;
  }).join("");

  const semJustRows = ocorrenciasSemJust.map(o=>`
    <tr>
      <td style="font-weight:700">${o.nome}</td>
      <td>${o.data}</td>
      <td>${o.turno}</td>
      <td>${o.horario}</td>
      <td style="color:${o.tipo==="Não executada"?"#dc2626":"#d97706"};font-weight:700">${o.tipo}</td>
    </tr>`).join("");

  const turnosListRows = turnos.map(t=>{
    const tinfo = RONDA_TURNOS[t.tipo] || RONDA_TURNOS.noturno;
    return `<tr><td>${fmtDataBR(t.dataInicio)}</td><td>${tinfo.label}</td><td>${t.plantonista?.nome||"—"}</td></tr>`;
  }).join("");

  const taxaExec = totalPrevistas>0 ? Math.round((totalRealizadas/totalPrevistas)*100) : 100;

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Consolidado Ronda Virtual — ${project.id}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;color:#0f172a;padding:24px;font-size:13px;line-height:1.5}
  .section{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
  .section-title{font-size:12px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:1px;border-left:4px solid #7c3aed;padding-left:10px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}
  th{font-size:10px;text-transform:uppercase;color:#64748b;text-align:left;padding:9px 10px;border-bottom:2px solid #e2e8f0;letter-spacing:.5px}
  td{padding:10px 10px;border-bottom:1px solid #f1f5f9;font-size:12px}
  .badge{display:inline-block;padding:3px 9px;border-radius:6px;font-size:10px;font-weight:700}
  .kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:#e2e8f0;margin-bottom:16px;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08)}
  .kpi{background:#fff;padding:16px 8px;text-align:center}
  .kpi-val{font-size:23px;font-weight:800;line-height:1;letter-spacing:-1px}
  .kpi-lbl{font-size:8.5px;color:#64748b;text-transform:uppercase;font-weight:700;margin-top:5px;letter-spacing:.3px}
  .footer{text-align:center;font-size:10px;color:#94a3b8;padding:16px 0}
  @media print{body{padding:10px}@page{margin:12mm}.no-print{display:none!important}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}}
</style></head>
<body>

<div class="no-print" style="text-align:center;margin-bottom:14px">
  <button onclick="window.print()" style="background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>

<div class="section" style="background:linear-gradient(135deg,#4c1d95 0%,#7c3aed 55%,#8b5cf6 100%);color:#fff;box-shadow:0 8px 24px rgba(124,58,237,0.25)">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
    <div>
      <div style="font-size:10px;opacity:.85;letter-spacing:1.5px;text-transform:uppercase;font-weight:600">MOKED CONSULTING SECURITY</div>
      <div style="font-size:23px;font-weight:800;margin-top:6px">🎥 Consolidado de Ronda Virtual (CFTV)</div>
      <div style="font-size:14px;opacity:.95;margin-top:3px;font-weight:600">${project.id} — ${project.name||""} · ${turnos.length} turnos</div>
      <div style="font-size:12px;opacity:.85;margin-top:6px;display:inline-block;background:rgba(255,255,255,0.15);padding:4px 10px;border-radius:20px">🗓 ${periodoIni} a ${periodoFim}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;opacity:.8">Gerado em ${hoje}</div>
      <div style="font-size:11px;opacity:.8">José Fonseca · jose.fonseca@moked.com.br</div>
    </div>
  </div>
</div>

<div class="kpi-row">
  <div class="kpi"><div class="kpi-val" style="color:#1e293b">${totalPrevistas}</div><div class="kpi-lbl">Rondas previstas</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${taxaExec>=90?'#15803d':taxaExec>=70?'#d97706':'#dc2626'}">${taxaExec}%</div><div class="kpi-lbl">Taxa de execução</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${totalAtrasos>0?'#d97706':'#15803d'}">${totalAtrasos}</div><div class="kpi-lbl">Atrasos</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${totalNaoExec>0?'#dc2626':'#15803d'}">${totalNaoExec}</div><div class="kpi-lbl">Não executadas</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${totalSemJust>0?'#dc2626':'#15803d'}">${totalSemJust}</div><div class="kpi-lbl">Sem justificativa</div></div>
</div>

<div class="section">
  <div class="section-title">👤 Ranking de Desempenho por Colaborador</div>
  <table>
    <thead><tr><th>Colaborador</th><th style="text-align:center">Turnos</th><th style="text-align:center">Atrasos</th><th style="text-align:center">Não Exec.</th><th style="text-align:center">Com Justif.</th><th style="text-align:center">Sem Justif.</th><th style="text-align:center">Status</th></tr></thead>
    <tbody>${rankingRows}</tbody>
  </table>
</div>

${ocorrenciasSemJust.length?`<div class="section" style="border:1px solid #fecaca">
  <div class="section-title" style="color:#dc2626;border-left-color:#dc2626">⚠ Ocorrências Sem Justificativa Registrada</div>
  <div style="font-size:11px;color:#64748b;margin-bottom:10px">Atrasos e não execuções sem motivo informado pelo colaborador no momento — possível negligência operacional, recomenda-se follow-up.</div>
  <table>
    <thead><tr><th>Colaborador</th><th>Data</th><th>Turno</th><th>Horário</th><th>Ocorrência</th></tr></thead>
    <tbody>${semJustRows}</tbody>
  </table>
</div>`:`<div class="section" style="border:1px solid #bbf7d0;background:#f0fdf4">
  <div style="font-size:13px;color:#15803d;font-weight:700;text-align:center">✓ Todas as ocorrências do período foram devidamente justificadas pelos colaboradores.</div>
</div>`}

<div class="section">
  <div class="section-title">📋 Turnos Incluídos no Consolidado</div>
  <table>
    <thead><tr><th>Data</th><th>Turno</th><th>Plantonista</th></tr></thead>
    <tbody>${turnosListRows}</tbody>
  </table>
</div>

<div class="footer">
  <div>Consolidado de Ronda Virtual © Moked Consulting Security</div>
  <div style="font-weight:600;margin-top:2px">José Fonseca — Moked Consulting Security</div>
  <div>jose.fonseca@moked.com.br · ${project.id} · ${periodoIni} a ${periodoFim}</div>
</div>
</body></html>`;

  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`ronda_consolidado_${project.id}_${turnos[0]?.dataInicio}_${turnos[turnos.length-1]?.dataInicio}.html`; a.click();
  URL.revokeObjectURL(url);
}

// Exporta utilitários puros para teste
export const _internal = { buildSlots, statusSlot, minutosDesdeInicio, podeAbrirDiurno, ehDomingo, ehFimDeSemana, TOLERANCIA_MIN };
