import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {criarStore} from "../single/singleStore";
const SingleApp=React.lazy(()=>import("../single/SingleApp"));
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { CATALOGO_REF, STATUS_ITEM, STATUS_ITEM_LISTA, STATUS_QUE_EXIGEM_ANALISE, STATUS_QUE_EXIGEM_OBSERVACAO } from "./catalogoSchema";
import { buildCatalogSections, calculateProgress, draftHasResponses, draftStorageKey, isDiagnosticDataReady, readDraft, writeDraft } from "./diagnosticoDraft";
import { criarDiagnosticoId, deveBuscarDiagnosticoRemoto, escolherAnterior, filtrarDiagnosticosPorEstado, filtrosConsultaDiagnosticos, friendlyPersistError, mergeRespostasPorAtualizacao, numerosRevisao, rotuloRevisaoDe } from "./diagnosticoSync";
import { baixarArquivo, copiaDeSegurancaRascunho, dataCurta, gerarDiagnosticoHTML, montarRelatorioDiagnostico, nomeArquivoDiagnostico, nomeCopiaSeguranca, relatorioDiagnosticoTexto } from "./diagnosticoExport";
import { abrirParaImpressao } from "../relatorios/padraoMoked";

const STATUS_UI = {
  [STATUS_ITEM.CONFORME]: { label: "Conforme", short: "C", color: "#22c55e" },
  [STATUS_ITEM.PARCIAL]: { label: "Parcial", short: "P", color: "#f59e0b" },
  [STATUS_ITEM.NAO_CONFORME]: { label: "Não conforme", short: "NC", color: "#ef4444" },
  [STATUS_ITEM.AUSENTE_NECESSARIO]: { label: "Ausente necessário", short: "AN", color: "#f97316" },
  [STATUS_ITEM.NA]: { label: "Não aplicável", short: "NA", color: "#8b5cf6" },
  [STATUS_ITEM.SEM_DADO]: { label: "Sem dado", short: "SD", color: "#64748b" },
};

const CRITICIDADE_UI = {
  critico: { label: "Crítico", color: "#ef4444" },
  relevante: { label: "Relevante", color: "#f59e0b" },
  informativo: { label: "Informativo", color: "#38bdf8" },
};

function palette(dark) {
  return dark
    ? { bg: "#04080f", card: "#08111f", alt: "#0c1728", input: "#020510", border: "#1e293b", text: "#f1f5f9", muted: "#94a3b8" }
    : { bg: "#f1f5f9", card: "#fff", alt: "#f8fafc", input: "#fff", border: "#dbe3ee", text: "#0f172a", muted: "#64748b" };
}

function friendlyAuthError(error) {
  const code = error?.code || "";
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return "E-mail ou senha inválidos.";
  if (code.includes("too-many-requests")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (code.includes("network-request-failed")) return "Sem conexão com o servidor de autenticação.";
  return "Não foi possível entrar. Tente novamente.";
}

function Login({ auth, dark, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const c = palette(dark);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (err) { setError(friendlyAuthError(err)); }
    finally { setBusy(false); }
  }

  return <main style={{...styles.page,background:c.bg}}>
    <section style={{...styles.loginCard,background:c.card,borderColor:c.border}}>
      <div style={{fontSize:40}}>🧭</div>
      <div><h1 style={{...styles.title,color:c.text}}>Diagnóstico Situacional</h1><p style={{...styles.muted,color:c.muted}}>Acesso exclusivo para gerente ou auditor ativo.</p></div>
      <form onSubmit={submit} style={{display:"grid",gap:12,width:"100%"}}>
        <label style={{...styles.label,color:c.muted}}>E-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} style={{...styles.input,background:c.input,color:c.text,borderColor:c.border}}/></label>
        <label style={{...styles.label,color:c.muted}}>Senha<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} style={{...styles.input,background:c.input,color:c.text,borderColor:c.border}}/></label>
        {error&&<div role="alert" style={styles.error}>{error}</div>}
        <button type="submit" disabled={busy} style={{...styles.primary,opacity:busy ? 0.65 : 1}}>{busy?"Entrando…":"Entrar no diagnóstico"}</button>
        <button type="button" onClick={onBack} style={{...styles.secondary,color:c.muted,borderColor:c.border}}>← Voltar ao início</button>
      </form>
    </section>
  </main>;
}

export default function DiagnosticoSituacional({ auth, db, dark, onToggleTheme, onBack, projects={}, projectGroups={} }) {
  const [user,setUser]=useState(()=>auth.currentUser);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [catalogo,setCatalogo]=useState(null);
  const [itens,setItens]=useState([]);
  const [profile,setProfile]=useState(null);
  const [respostas,setRespostas]=useState({});
  const [categoriaAtiva,setCategoriaAtiva]=useState("");
  const [draftReady,setDraftReady]=useState(false);
  const [savedAt,setSavedAt]=useState(null);
  const [projetoContexto,setProjetoContexto]=useState(null);
  const [singleOpen,setSingleOpen]=useState(false);
  const singleStore=useMemo(()=>criarStore(auth),[auth]);
  const [diagnosticos,setDiagnosticos]=useState([]);
  const [progressoProjetos,setProgressoProjetos]=useState({});
  const [diagnosticoSelecionado,setDiagnosticoSelecionado]=useState(false);
  const [persistBusy,setPersistBusy]=useState(false);
  const [persistError,setPersistError]=useState("");
  const [persistSuccess,setPersistSuccess]=useState("");
  const [rascunhoLocal,setRascunhoLocal]=useState(null);
  const [showResumo,setShowResumo]=useState(false);
  const [exportError,setExportError]=useState("");
  const [filtroDiagnosticos,setFiltroDiagnosticos]=useState("ativos");
  const [acaoDiagnosticoId,setAcaoDiagnosticoId]=useState(null);
  const skipNextDraftWriteRef=useRef(false);
  const contentTopRef=useRef(null);
  const c=palette(dark);
  const isAuthenticated=!!user&&!user.isAnonymous;

  useEffect(()=>onAuthStateChanged(auth,setUser),[auth]);
  useEffect(()=>{
    if(!isAuthenticated){setLoading(false);setCatalogo(null);setProfile(null);setDraftReady(false);return;}
    let cancelled=false;
    (async()=>{
      setLoading(true);setError("");setDraftReady(false);
      try{
        const profileSnap=await getDoc(doc(db,"usuarios",user.uid));
        if(!profileSnap.exists()) throw new Error("PROFILE_MISSING");
        const nextProfile=profileSnap.data();
        if(nextProfile.active!==true||!["gerente","auditor"].includes(nextProfile.role)) throw new Error("PROFILE_DENIED");
        const rootRef=doc(db,"catalogos_diagnostico",CATALOGO_REF.catalogoId);
        const [rootSnap,itensSnap]=await Promise.all([getDoc(rootRef),getDocs(query(collection(rootRef,"itens"),orderBy("ordem","asc")))]);
        if(!rootSnap.exists()) throw new Error("CATALOG_MISSING");
        const nextCatalogo=rootSnap.data();
        if(nextCatalogo.status!=="publicado"||nextCatalogo.seedCompleto!==true) throw new Error("CATALOG_INCOMPLETE");
        if(nextCatalogo.versao!==CATALOGO_REF.versao) throw new Error("CATALOG_VERSION");
        const nextItens=itensSnap.docs.map(item=>({id:item.id,...item.data()}));
        if(!nextItens.length) throw new Error("CATALOG_EMPTY");
        const first=[...(nextCatalogo.categorias||[])].sort((a,b)=>a.ordem-b.ordem)[0]?.id||"";
        if(!cancelled){setProfile(nextProfile);setCatalogo(nextCatalogo);setItens(nextItens);setRespostas({});setCategoriaAtiva(first);setSavedAt(null);setDraftReady(true);}
      }catch(err){
        const messages={PROFILE_MISSING:"Seu usuário não possui perfil de acesso ao Diagnóstico.",PROFILE_DENIED:"Seu perfil está inativo ou não tem permissão para este módulo.",CATALOG_MISSING:"O catálogo publicado não foi encontrado.",CATALOG_INCOMPLETE:"O catálogo ainda não está pronto para uso.",CATALOG_VERSION:"A versão publicada do catálogo não é compatível com esta tela.",CATALOG_EMPTY:"O catálogo publicado não contém itens."};
        if(!cancelled)setError(messages[err?.message]||"Não foi possível ler o catálogo. Verifique sua conexão e seu acesso.");
      }finally{if(!cancelled)setLoading(false);}
    })();
    return()=>{cancelled=true;};
  },[db,isAuthenticated,user?.uid]);

  useEffect(()=>{
    if(!draftReady||!catalogo||!user?.uid||!projetoContexto||!diagnosticoSelecionado)return undefined;
    if(skipNextDraftWriteRef.current){skipNextDraftWriteRef.current=false;return undefined;}
    const chave=projetoContexto.tipo==="existente"?projetoContexto.projetoRef:projetoContexto.chave;
    const key=`${draftStorageKey(CATALOGO_REF.catalogoId,user.uid)}:${chave}`;
    const timer=setTimeout(()=>{const now=Date.now();const draft={catalogoId:CATALOGO_REF.catalogoId,versao:catalogo.versao,categoriaAtiva,respostas,savedAt:now,projetoRef:chave,baseId:projetoContexto.baseId||null};writeDraft(window.localStorage,key,draft);setRascunhoLocal(draft);setSavedAt(now);},350);
    return()=>clearTimeout(timer);
  },[categoriaAtiva,catalogo,draftReady,respostas,user?.uid,projetoContexto,diagnosticoSelecionado]);

  useEffect(()=>{
    if(!isAuthenticated||!itens.length)return;
    let cancel=false;
    (async()=>{
      const out={};
      const ids=Object.values(projectGroups).flat();
      await Promise.all(ids.map(async pid=>{try{const filtros=filtrosConsultaDiagnosticos({tipo:"existente",projetoRef:pid},user.uid).map(args=>where(...args));const s=await getDocs(query(collection(db,"diagnosticos",pid,"itens"),...filtros));const docs=s.docs.map(d=>d.data()).sort((a,b)=>String(b.atualizadoEm||"").localeCompare(String(a.atualizadoEm||"")));const d=docs[0];if(d)out[pid]={pct:calculateProgress(itens,d.respostas||{}).percentual,estado:d.estado||"rascunho"};}catch{}}));
      if(!cancel)setProgressoProjetos(out);
    })();
    return()=>{cancel=true;};
  },[db,isAuthenticated,itens,projectGroups,user?.uid]);

  const secoes=useMemo(()=>buildCatalogSections(catalogo,itens),[catalogo,itens]);
  const secaoAtiva=secoes.find(x=>x.id===categoriaAtiva)||secoes[0];
  const progresso=useMemo(()=>calculateProgress(itens,respostas),[itens,respostas]);
  const indiceAtivo=Math.max(0,secoes.findIndex(x=>x.id===secaoAtiva?.id));
  const mark=(itemId,status)=>setRespostas(current=>{const anterior=current[itemId]||{};const proxima={...anterior,status,updatedAt:Date.now()};if(!STATUS_QUE_EXIGEM_ANALISE.includes(status)){delete proxima.situacao;delete proxima.impacto;delete proxima.indicacao;}if(!STATUS_QUE_EXIGEM_OBSERVACAO.includes(status))delete proxima.observacao;return {...current,[itemId]:proxima};});
  const updateResposta=(itemId,campo,valor)=>setRespostas(current=>({...current,[itemId]:{...(current[itemId]||{}),[campo]:valor,updatedAt:Date.now()}}));
  const goTo=(id)=>{setCategoriaAtiva(id);requestAnimationFrame(()=>contentTopRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));};
  const chaveDoProjeto=projetoContexto?(projetoContexto.tipo==="existente"?projetoContexto.projetoRef:projetoContexto.chave):null;
  const chaveDraft=chaveDoProjeto?`${draftStorageKey(CATALOGO_REF.catalogoId,user.uid)}:${chaveDoProjeto}`:null;
  const temRascunhoLocal=draftHasResponses(rascunhoLocal);
  const clearDraft=()=>{if(!window.confirm("Limpar todas as marcações deste rascunho local?"))return;if(chaveDraft)window.localStorage.removeItem(chaveDraft);setRascunhoLocal(null);setRespostas({});setCategoriaAtiva(secoes[0]?.id||"");setSavedAt(null);};
  const chaveProjeto=projetoContexto?.tipo==="existente"?projetoContexto.projetoRef:projetoContexto?.chave;
  const salvarDiagnostico=async(estado="rascunho")=>{
    if(!chaveProjeto||!user?.uid||!catalogo)return;
    setPersistBusy(true);setPersistError("");setPersistSuccess("");
    try{
      // Só relê o servidor se o diagnóstico JÁ foi gravado antes: ler um documento que ainda não existe é negado pelas regras.
      const diagnosticoExistente=projetoContexto.remotoPersistido===true&&deveBuscarDiagnosticoRemoto(projetoContexto.diagnosticoId);
      const diagnosticoId=projetoContexto.diagnosticoId||criarDiagnosticoId();
      const ref=doc(db,"diagnosticos",chaveProjeto,"itens",diagnosticoId);
      const agora=new Date().toISOString();
      const criadoEm=projetoContexto.criadoEm||agora;
      // Mantém o mesmo id se a gravação falhar e for repetida (nunca cria duplicado).
      if(!diagnosticoExistente)setProjetoContexto(current=>({...current,diagnosticoId,criadoEm,remotoPersistido:false}));
      let remotas={};
      if(diagnosticoExistente&&!projetoContexto.single){const remoto=await getDoc(ref);remotas=remoto.exists()?(remoto.data().respostas||{}):{};}
      const merged=mergeRespostasPorAtualizacao(remotas,respostas);
      const payload={catalogoId:CATALOGO_REF.catalogoId,versaoCatalogo:catalogo.versao,tipo:projetoContexto.tipo,projetoRef:projetoContexto.projetoRef||null,grupo:projetoContexto.grupo||null,rotuloLivre:projetoContexto.rotuloLivre||null,estado,respostas:merged,autorUid:user.uid,criadoEm,atualizadoEm:agora,arquivadoEm:estado==="arquivado"?agora:null,...(projetoContexto.single||!projetoContexto.baseId?{}:{baseId:projetoContexto.baseId})};
      let revisao=projetoContexto.revisao||0;
      if(projetoContexto.single){const result=await singleStore.salvarDiagnostico(chaveProjeto,diagnosticoId,revisao,payload);revisao=result.data.revisao;}else await setDoc(ref,payload,{merge:true});
      // Gravou: o rascunho local já não é o único exemplar. Só então ele sai (e o próximo autosave não o recria sem mudança).
      skipNextDraftWriteRef.current=true;
      if(chaveDraft)window.localStorage.removeItem(chaveDraft);
      setRascunhoLocal(null);
      setProjetoContexto({...projetoContexto,diagnosticoId,criadoEm:payload.criadoEm,revisao,estado,remotoPersistido:true});
      setRespostas(merged);
      setDiagnosticos(xs=>[{id:diagnosticoId,...payload,revisao},...xs.filter(x=>x.id!==diagnosticoId)]);
      setPersistSuccess(estado==="arquivado"?"Diagnóstico arquivado no Firestore.":"Diagnóstico salvo no Firestore.");
    }catch(e){console.error("[diagnostico] falha ao salvar",e?.code||e);setPersistError(projetoContexto.single&&e?.message?e.message:friendlyPersistError(e));}
    finally{setPersistBusy(false);}
  };
  const escolherProjeto=async(ctx)=>{
    setProjetoContexto(ctx);
    setDiagnosticoSelecionado(ctx?.tipo==="novo"&&!ctx.single);
    setRespostas({});
    setCategoriaAtiva(secoes[0]?.id||"");
    setSavedAt(null);
    setRascunhoLocal(null);
    setFiltroDiagnosticos("ativos");
    setPersistError("");setPersistSuccess("");setExportError("");setShowResumo(false);
    let draft=null;
    if(ctx&&catalogo&&user?.uid){
      const chave=ctx.tipo==="existente"?ctx.projetoRef:ctx.chave;
      draft=readDraft(window.localStorage,`${draftStorageKey(CATALOGO_REF.catalogoId,user.uid)}:${chave}`,catalogo.versao);
      if(draft){
        setRascunhoLocal(draft);
        // Projeto novo (sem lista de diagnósticos): o rascunho do aparelho abre direto. Nos demais, aparece como "Continuar rascunho deste aparelho".
        if(ctx.tipo==="novo"&&!ctx.single){setRespostas(draft.respostas||{});setCategoriaAtiva(draft.categoriaAtiva||secoes[0]?.id||"");setSavedAt(draft.savedAt||null);}
      }
    }
    if(!ctx)return;
    try{
      if(ctx.single){const result=await singleStore.listarDiagnosticos(ctx.chave);setDiagnosticos(result.diagnosticos);if(!(result.diagnosticos||[]).length&&!draftHasResponses(draft))setDiagnosticoSelecionado(true);return;}
      const base=collection(db,"diagnosticos",ctx.tipo==="existente"?ctx.projetoRef:ctx.chave,"itens");
      const filtros=filtrosConsultaDiagnosticos(ctx,user.uid).map(args=>where(...args));
      const snap=await getDocs(query(base,...filtros));
      const encontrados=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.atualizadoEm||"").localeCompare(String(a.atualizadoEm||"")));
      setDiagnosticos(encontrados);
      // Nada salvo e nada local: vai direto para o formulário.
      if(ctx.tipo==="existente"&&encontrados.length===0&&!draftHasResponses(draft))setDiagnosticoSelecionado(true);
    }catch(e){setDiagnosticos([]);if(!draftHasResponses(draft))setDiagnosticoSelecionado(true);}
  };
  const abrirDiagnostico=(d)=>{setRespostas(d.respostas||{});setSavedAt(d.atualizadoEm?new Date(d.atualizadoEm).getTime():null);setProjetoContexto(p=>({...p,diagnosticoId:d.id,criadoEm:d.criadoEm,estado:d.estado||"rascunho",revisao:d.revisao||0,remotoPersistido:true,baseId:d.baseId||null}));setDiagnosticoSelecionado(true);};
  const continuarRascunhoLocal=()=>{if(!rascunhoLocal)return;setRespostas(rascunhoLocal.respostas||{});setCategoriaAtiva(rascunhoLocal.categoriaAtiva||secoes[0]?.id||"");setSavedAt(rascunhoLocal.savedAt||null);setProjetoContexto(p=>({...p,diagnosticoId:null,criadoEm:null,estado:"rascunho",revisao:0,remotoPersistido:false,baseId:rascunhoLocal.baseId||null}));setDiagnosticoSelecionado(true);};
  const novoDiagnostico=()=>{if(temRascunhoLocal)return;setRespostas({});setSavedAt(null);setProjetoContexto(p=>({...p,diagnosticoId:null,criadoEm:null,estado:"rascunho",revisao:0,remotoPersistido:false,baseId:null}));setDiagnosticoSelecionado(true);};
  // Nova revisão: começa com as respostas do diagnóstico escolhido (que continua intacto); você só altera o que mudou no campo e o relatório compara as duas.
  const novaRevisaoDe=(d)=>{if(temRascunhoLocal)return;setRespostas(JSON.parse(JSON.stringify(d.respostas||{})));setSavedAt(null);setCategoriaAtiva(secoes[0]?.id||"");setPersistError("");setPersistSuccess("");setProjetoContexto(p=>({...p,diagnosticoId:null,criadoEm:null,estado:"rascunho",revisao:0,remotoPersistido:false,baseId:d.id}));setDiagnosticoSelecionado(true);};
  // Arquivar / restaurar / "excluir da lista": o registro NUNCA é apagado, só muda de estado (regra do app: não perder histórico).
  const alterarEstadoDiagnostico=async(d,acao)=>{
    if(projetoContexto?.single||!projetoContexto?.projetoRef)return;
    const arquivar=acao!=="restaurar";
    if(acao==="remover"&&!window.confirm("Tirar este diagnóstico da lista ativa? Ele fica guardado em Arquivados e pode ser restaurado."))return;
    setAcaoDiagnosticoId(d.id);setPersistError("");setPersistSuccess("");
    try{
      const agora=new Date().toISOString();
      const alteracoes={estado:arquivar?"arquivado":"rascunho",arquivadoEm:arquivar?agora:null,atualizadoEm:agora};
      await updateDoc(doc(db,"diagnosticos",projetoContexto.projetoRef,"itens",d.id),alteracoes);
      setDiagnosticos(lista=>lista.map(item=>item.id===d.id?{...item,...alteracoes}:item));
      setPersistSuccess(arquivar?"Diagnóstico arquivado (preservado em Arquivados).":"Diagnóstico restaurado para a lista ativa.");
    }catch(e){console.error("[diagnostico] falha ao organizar",e?.code||e);setPersistError(friendlyPersistError(e));}
    finally{setAcaoDiagnosticoId(null);}
  };
  // Entregáveis: tudo sai da mesma função (montarRelatorioDiagnostico). A comparação usa a revisão de origem ou a salva logo antes.
  const contextoRelatorio=useMemo(()=>({...(projetoContexto||{}),nomeProjeto:projetoContexto?.projetoRef?(projects[projetoContexto.projetoRef]?.name||""):""}),[projetoContexto,projects]);
  const numeros=useMemo(()=>numerosRevisao(diagnosticos),[diagnosticos]);
  const montarRel=useCallback((resp,{id=null,estado="rascunho",baseId=null}={})=>{
    const ant=escolherAnterior(diagnosticos,id,baseId);
    const numero=id?numeros[id]:diagnosticos.length+1;
    return montarRelatorioDiagnostico({catalogo,itens,respostas:resp,contexto:contextoRelatorio,diagnosticoId:id,estado,anterior:ant?{respostas:ant.respostas,rotulo:rotuloRevisaoDe(numeros[ant.id])||"revisão anterior",data:ant.atualizadoEm?dataCurta(ant.atualizadoEm):""}:null,rotuloRevisao:rotuloRevisaoDe(numero)});
  },[catalogo,itens,contextoRelatorio,diagnosticos,numeros]);
  const relatorio=useMemo(()=>montarRel(respostas,{id:projetoContexto?.diagnosticoId||null,estado:projetoContexto?.estado||"rascunho",baseId:projetoContexto?.baseId||null}),[montarRel,respostas,projetoContexto]);
  // Concluir: só quando TODOS os itens foram respondidos (qualquer status conta). Só um diagnóstico concluído entra na Análise de Risco (2º modelo).
  const diagCompleto=relatorio.total>0&&relatorio.respondidos===relatorio.total;
  const podeConcluir=!projetoContexto?.single&&projetoContexto?.tipo==="existente";
  const concluirDiagnostico=()=>{if(!diagCompleto)return;if(!window.confirm("Concluir este diagnóstico? Ele passa a poder ser anexado à Análise de Risco. Se você editar depois, ele volta a rascunho até ser concluído de novo."))return;salvarDiagnostico("concluido");};
  const ROTULO_ESTADO={rascunho:"Rascunho",concluido:"Concluído",arquivado:"Arquivado"};
  const exportarPdf=()=>{setExportError("");try{const rel=montarRel(respostas,{id:projetoContexto?.diagnosticoId||null,estado:projetoContexto?.estado||"rascunho",baseId:projetoContexto?.baseId||null});abrirParaImpressao(gerarDiagnosticoHTML(rel),nomeArquivoDiagnostico(rel,"html"));}catch(e){console.error("[diagnostico] falha ao gerar PDF",e);setExportError("Não foi possível gerar o PDF neste aparelho.");}};
  // PDF direto da lista (inclusive de arquivados), sem abrir o diagnóstico.
  const exportarPdfDe=(d)=>{setPersistError("");try{const rel=montarRel(d.respostas||{},{id:d.id,estado:d.estado||"rascunho",baseId:d.baseId||null});abrirParaImpressao(gerarDiagnosticoHTML(rel),nomeArquivoDiagnostico(rel,"html"));}catch(e){console.error("[diagnostico] falha ao gerar PDF",e);setPersistError("Não foi possível gerar o PDF neste aparelho.");}};
  const exportarTxt=()=>{setExportError("");try{baixarArquivo(relatorioDiagnosticoTexto(relatorio),nomeArquivoDiagnostico(relatorio,"txt"),"text/plain;charset=utf-8");}catch(e){setExportError("Não foi possível baixar o TXT neste aparelho.");}};
  const baixarCopiaSeguranca=()=>{setExportError("");try{const draft=chaveDraft?readDraft(window.localStorage,chaveDraft,catalogo.versao):null;const alvo=draft||{catalogoId:CATALOGO_REF.catalogoId,versao:catalogo.versao,categoriaAtiva,respostas,savedAt:Date.now(),projetoRef:chaveProjeto};const copia=copiaDeSegurancaRascunho({chave:chaveProjeto,projeto:relatorio.projeto,draft:alvo,diagnosticoId:projetoContexto?.diagnosticoId||null});baixarArquivo(JSON.stringify(copia,null,1),nomeCopiaSeguranca(relatorio.projeto),"application/json");}catch(e){setExportError("Não foi possível baixar a cópia de segurança.");}};

  if(!isAuthenticated)return <Login auth={auth} dark={dark} onBack={onBack}/>;
  if(error)return <main style={{...styles.page,background:c.bg,color:c.text}}><section style={{...styles.loginCard,background:c.card,borderColor:"#ef444466"}}><div style={{fontSize:38}}>⚠️</div><h1 style={styles.title}>Acesso indisponível</h1><p role="alert" style={{...styles.muted,color:c.muted}}>{error}</p><button onClick={onBack} style={{...styles.secondary,color:c.muted,borderColor:c.border}}>← Voltar ao início</button></section></main>;
  if(loading||!isDiagnosticDataReady(catalogo,profile))return <main style={{...styles.page,background:c.bg,color:c.text}}><div style={styles.centerState}><div style={{fontSize:34}}>⟳</div><strong>Carregando catálogo publicado…</strong><div style={{marginTop:14}}><button onClick={onBack} style={{...styles.secondary,color:c.muted,borderColor:c.border}}>← Voltar ao início</button></div></div></main>;
  if(singleOpen&&!projetoContexto)return <React.Suspense fallback={<p>Carregando Single…</p>}><SingleApp auth={auth} profile={profile} onBack={()=>setSingleOpen(false)} onInicio={onBack} onDiagnostico={p=>escolherProjeto({tipo:"novo",chave:p.id,rotuloLivre:p.nome,single:true})}/></React.Suspense>;
  if(!projetoContexto)return <main style={{...styles.page,background:c.bg,color:c.text}}><section style={{...styles.loginCard,background:c.card,borderColor:c.border,textAlign:"left",justifyItems:"stretch"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:6}}><button onClick={onBack} style={{...styles.secondary,color:c.muted,borderColor:c.border}}>← Voltar ao início</button>{onToggleTheme&&<button onClick={onToggleTheme} style={{...styles.iconButton,color:c.text,borderColor:c.border}} aria-label="Alternar tema">{dark?"☀️":"🌙"}</button>}</div><h1 style={{...styles.title,color:c.text}}>Selecionar projeto</h1><button onClick={()=>setSingleOpen(true)} style={styles.primary}>＋ Novo projeto (Single)</button><p style={{...styles.muted,color:c.muted}}>Escolha o contexto deste diagnóstico antes de preencher.</p><button onClick={()=>{const slug=prompt("Nome do cliente/projeto novo:","");if(slug?.trim()){const chave="novo_"+user.uid+"_"+slug.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-")+"_"+Date.now().toString(36);escolherProjeto({tipo:"novo",chave,rotuloLivre:slug.trim()});}}} style={styles.primary}>＋ Projeto novo</button>{Object.entries(projectGroups).map(([grupo,ids])=><div key={grupo}><strong style={{display:"block",margin:"14px 0 6px",color:c.text,textTransform:"uppercase"}}>{grupo}</strong>{ids.map(pid=>{if(!projects[pid])return null;const p=progressoProjetos[pid];return <button key={pid} onClick={()=>escolherProjeto({tipo:"existente",projetoRef:pid,grupo})} style={{...styles.secondary,width:"100%",marginBottom:6,color:c.text,borderColor:c.border,textAlign:"left"}}><div>{pid} — {projects[pid].name}</div>{p&&<div style={{fontSize:11,marginTop:5,color:p.pct===100?"#22c55e":c.muted}}>{p.estado==="arquivado"||p.pct===100?"concluído":"em andamento"} · {p.pct}%</div>}</button>;})}</div>)}</section></main>;
  const diagnosticosAtivos=filtrarDiagnosticosPorEstado(diagnosticos,"ativos"),diagnosticosArquivados=filtrarDiagnosticosPorEstado(diagnosticos,"arquivados"),diagnosticosVisiveis=filtroDiagnosticos==="arquivados"?diagnosticosArquivados:diagnosticosAtivos;
  if((projetoContexto.tipo==="existente"||projetoContexto.single)&&!diagnosticoSelecionado&&(diagnosticos.length>0||temRascunhoLocal))return <main style={{...styles.page,background:c.bg}}><section style={{...styles.listCard,background:c.card,borderColor:c.border,color:c.text}}>
    <h1 style={{...styles.title,color:c.text}}>Diagnósticos — {projetoContexto.rotuloLivre||projetoContexto.projetoRef}</h1>
    <p style={{...styles.muted,color:c.muted}}>Nada é apagado: arquivar só tira da lista ativa.</p>
    {temRascunhoLocal&&<><button onClick={continuarRascunhoLocal} style={{...styles.localDraftButton,color:c.text}}><strong>Continuar rascunho deste aparelho</strong><span>{rascunhoLocal.savedAt?new Date(rascunhoLocal.savedAt).toLocaleString("pt-BR"):"sem data"} · {calculateProgress(itens,rascunhoLocal.respostas||{}).percentual}%</span></button><p style={{...styles.muted,color:"#f59e0b"}}>Protegido neste aparelho. Abra e salve no Firestore antes de iniciar outro.</p></>}
    <div style={styles.filterTabs}><button onClick={()=>setFiltroDiagnosticos("ativos")} style={{...styles.filterTab,background:filtroDiagnosticos==="ativos"?"#2563eb":"transparent",color:filtroDiagnosticos==="ativos"?"#fff":c.muted,borderColor:c.border}}>Ativos ({diagnosticosAtivos.length})</button><button onClick={()=>setFiltroDiagnosticos("arquivados")} style={{...styles.filterTab,background:filtroDiagnosticos==="arquivados"?"#475569":"transparent",color:filtroDiagnosticos==="arquivados"?"#fff":c.muted,borderColor:c.border}}>Arquivados ({diagnosticosArquivados.length})</button></div>
    {diagnosticosVisiveis.length===0&&<p style={{...styles.emptyState,color:c.muted,borderColor:c.border}}>Nenhum diagnóstico nesta lista.</p>}
    {diagnosticosVisiveis.map(d=><div key={d.id} style={{...styles.diagnosticRow,borderColor:c.border}}><button disabled={temRascunhoLocal||d.estado==="arquivado"} onClick={()=>abrirDiagnostico(d)} style={{...styles.diagnosticOpen,color:c.text,opacity:(temRascunhoLocal||d.estado==="arquivado")?.55:1}}><strong>{numeros[d.id]?`Rev. ${numeros[d.id]} · `:""}{ROTULO_ESTADO[d.estado||"rascunho"]||d.estado} · {d.atualizadoEm?new Date(d.atualizadoEm).toLocaleString("pt-BR"):"sem data"}</strong><span>{calculateProgress(itens,d.respostas||{}).percentual}% preenchido</span></button><div style={styles.rowActions}><button onClick={()=>exportarPdfDe(d)} style={{...styles.smallAction,color:"#38bdf8",borderColor:"#38bdf866"}}>PDF</button>{d.estado!=="arquivado"&&<button disabled={temRascunhoLocal} onClick={()=>novaRevisaoDe(d)} style={{...styles.smallAction,color:"#a78bfa",borderColor:"#a78bfa66",opacity:temRascunhoLocal?.55:1}}>Nova revisão a partir deste</button>}{!projetoContexto.single&&(d.estado==="arquivado"?<button disabled={acaoDiagnosticoId===d.id} onClick={()=>alterarEstadoDiagnostico(d,"restaurar")} style={{...styles.smallAction,color:"#22c55e",borderColor:"#22c55e66"}}>Restaurar</button>:<><button disabled={acaoDiagnosticoId===d.id} onClick={()=>alterarEstadoDiagnostico(d,"arquivar")} style={{...styles.smallAction,color:"#f59e0b",borderColor:"#f59e0b66"}}>Arquivar</button><button disabled={acaoDiagnosticoId===d.id} onClick={()=>alterarEstadoDiagnostico(d,"remover")} style={{...styles.smallAction,color:"#ef4444",borderColor:"#ef444466"}}>Tirar da lista</button></>)}</div></div>)}
    {persistError&&<p role="alert" style={styles.error}>{persistError}</p>}{persistSuccess&&<p role="status" style={styles.success}>{persistSuccess}</p>}
    <button disabled={temRascunhoLocal} onClick={novoDiagnostico} style={{...styles.primary,opacity:temRascunhoLocal?.55:1}}>＋ Novo diagnóstico em branco</button><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={()=>setProjetoContexto(null)} style={{...styles.secondary,color:c.muted,borderColor:c.border}}>Trocar projeto</button><button onClick={onBack} style={{...styles.secondary,color:c.muted,borderColor:c.border}}>← Voltar ao início</button></div>
  </section></main>;

  return <main style={{...styles.page,background:c.bg,color:c.text}}><div style={styles.shell}>
    <header style={{...styles.header,background:c.bg,borderColor:c.border}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><button onClick={()=>setProjetoContexto(null)} style={{...styles.iconButton,color:c.muted,borderColor:c.border}} aria-label="Voltar à seleção de projeto">←</button><button onClick={onBack} style={{...styles.secondary,color:c.muted,borderColor:c.border,padding:"6px 10px",fontSize:12}} aria-label="Voltar ao início">Início</button><div style={{minWidth:0,flex:1}}><h1 style={{...styles.headerTitle,color:c.text}}>Diagnóstico Situacional</h1><div style={{...styles.muted,color:c.muted}}>{projetoContexto.rotuloLivre||projetoContexto.projetoRef} · {relatorio.rotuloRevisao?`${relatorio.rotuloRevisao} · `:""}{String(catalogo.perfil||"").replace(/_/g," ")} · v{catalogo.versao} · {profile.role}</div></div><button onClick={onToggleTheme} style={{...styles.iconButton,color:c.text,borderColor:c.border}} aria-label="Alternar tema">{dark?"☀️":"🌙"}</button></div>
      <div style={{...styles.progressCard,background:c.card,borderColor:c.border}}><div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12}}><strong style={{fontSize:14}}>{progresso.percentual}% concluído</strong><span style={{...styles.muted,color:c.muted}}>{progresso.respondidos}/{progresso.total} itens</span></div><div style={{...styles.progressTrack,background:c.border}}><div style={{...styles.progressFill,width:`${progresso.percentual}%`}}/></div><div style={{...styles.saveLine,color:c.muted}}><span>✓ Rascunho local automático</span><span>{savedAt?`salvo às ${new Date(savedAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`:"ainda sem alterações"}</span></div></div>
      <nav style={styles.categoryNav} aria-label="Categorias do diagnóstico">{secoes.map(cat=>{const catItens=cat.subcategorias.flatMap(sub=>sub.itens);const p=calculateProgress(catItens,respostas);const selected=cat.id===secaoAtiva?.id;return <button key={cat.id} onClick={()=>goTo(cat.id)} aria-current={selected?"step":undefined} style={{...styles.categoryChip,background:selected?"#1d4ed8":c.card,color:selected?"#fff":c.muted,borderColor:selected?"#3b82f6":c.border}}><span>{cat.id}</span><span style={{opacity:.8}}>{p.respondidos}/{p.total}</span></button>;})}</nav>
    </header>
    <section ref={contentTopRef} style={styles.content}>
      <div style={{...styles.categoryHeading,background:c.card,borderColor:c.border}}><div style={styles.eyebrow}>Categoria {indiceAtivo+1} de {secoes.length}</div><h2 style={{margin:"4px 0 0",fontSize:19}}>{secaoAtiva?.id} · {secaoAtiva?.nome}</h2></div>
      {secaoAtiva?.subcategorias.map(sub=><section key={sub.id} style={{...styles.subcategory,background:c.card,borderColor:c.border}}><div style={{...styles.subcategoryHeader,borderColor:c.border}}><div><div style={styles.eyebrow}>{sub.id}</div><h3 style={{margin:"3px 0 0",fontSize:15}}>{sub.nome}</h3></div><span style={{...styles.counter,color:c.muted,borderColor:c.border}}>{calculateProgress(sub.itens,respostas).respondidos}/{sub.itens.length}</span></div><div>{sub.itens.map((item,index)=>{const resposta=respostas[item.id]||{};const selectedStatus=resposta.status;const exigeAnalise=STATUS_QUE_EXIGEM_ANALISE.includes(selectedStatus);const exigeObservacao=STATUS_QUE_EXIGEM_OBSERVACAO.includes(selectedStatus);const criticidade=CRITICIDADE_UI[item.criticidade]||CRITICIDADE_UI.informativo;return <article key={item.id} style={{...styles.item,borderColor:c.border}}><div style={{display:"flex",gap:10,alignItems:"flex-start"}}><div style={{...styles.itemNumber,background:c.alt,color:c.muted}}>{index+1}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,lineHeight:1.45,fontWeight:650}}>{item.texto}</div><div style={{display:"flex",gap:7,alignItems:"center",marginTop:5}}><span style={{fontSize:9,fontWeight:800,color:criticidade.color,textTransform:"uppercase",letterSpacing:.5}}>{criticidade.label}</span><span style={{...styles.muted,color:c.muted}}>{item.id}</span></div></div></div><div style={styles.statusGrid} role="group" aria-label={`Avaliação de ${item.texto}`}>{STATUS_ITEM_LISTA.map(status=>{const info=STATUS_UI[status];const selected=selectedStatus===status;return <button key={status} onClick={()=>mark(item.id,status)} title={info.label} aria-pressed={selected} style={{...styles.statusButton,color:selected?"#fff":info.color,borderColor:selected?info.color:`${info.color}55`,background:selected?info.color:"transparent"}}><strong>{info.short}</strong><span>{info.label}</span></button>;})}</div>{exigeAnalise&&<div style={{...styles.analysisPanel,background:c.alt,borderColor:c.border}}><div style={{...styles.analysisHint,color:c.muted}}>Registre a ocorrência para este item.</div><label style={{...styles.fieldLabel,color:c.muted}}>Situação<textarea value={resposta.situacao||""} onChange={e=>updateResposta(item.id,"situacao",e.target.value)} placeholder="O que foi encontrado?" style={{...styles.responseInput,background:c.input,color:c.text,borderColor:c.border}}/></label><label style={{...styles.fieldLabel,color:c.muted}}>Impacto<textarea value={resposta.impacto||""} onChange={e=>updateResposta(item.id,"impacto",e.target.value)} placeholder="Qual o risco ou consequência?" style={{...styles.responseInput,background:c.input,color:c.text,borderColor:c.border}}/></label><label style={{...styles.fieldLabel,color:c.muted}}>Indicação<textarea value={resposta.indicacao||""} onChange={e=>updateResposta(item.id,"indicacao",e.target.value)} placeholder="Qual a ação recomendada?" style={{...styles.responseInput,background:c.input,color:c.text,borderColor:c.border}}/></label></div>}{exigeObservacao&&<div style={{...styles.analysisPanel,background:c.alt,borderColor:c.border}}><label style={{...styles.fieldLabel,color:c.muted}}>Observação<textarea value={resposta.observacao||""} onChange={e=>updateResposta(item.id,"observacao",e.target.value)} placeholder="Por que não foi possível obter o dado?" style={{...styles.responseInput,background:c.input,color:c.text,borderColor:c.border}}/></label></div>}</article>;})}</div></section>)}
      <div style={styles.footerActions}><button disabled={indiceAtivo===0} onClick={()=>goTo(secoes[indiceAtivo-1]?.id)} style={{...styles.secondary,color:c.muted,borderColor:c.border,opacity:indiceAtivo===0 ? 0.4 : 1}}>← Anterior</button>{indiceAtivo<secoes.length-1?<button onClick={()=>goTo(secoes[indiceAtivo+1]?.id)} style={styles.primary}>Próxima categoria →</button>:<button disabled style={{...styles.primary,background:progresso.percentual===100?"#15803d":"#334155"}}>{progresso.percentual===100?"✓ Rascunho completo":"Complete os itens"}</button>}</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={()=>salvarDiagnostico("rascunho")} disabled={persistBusy} style={styles.primary}>{persistBusy?"Salvando…":"Salvar diagnóstico"}</button>{podeConcluir&&<button onClick={concluirDiagnostico} disabled={persistBusy||!diagCompleto} title={diagCompleto?"Marca o diagnóstico como concluído (libera o anexo na Análise de Risco)":`Faltam ${relatorio.total-relatorio.respondidos} item(ns) para concluir`} style={{...styles.secondary,opacity:diagCompleto?1:.55}}>{projetoContexto?.estado==="concluido"?"✓ Concluído":diagCompleto?"Concluir diagnóstico":`Concluir (faltam ${relatorio.total-relatorio.respondidos})`}</button>}<button onClick={()=>salvarDiagnostico("arquivado")} disabled={persistBusy} style={styles.secondary}>Arquivar</button><button onClick={()=>setProjetoContexto(null)} style={styles.secondary}>Trocar projeto</button></div>{persistError&&<p role="alert" style={styles.error}>{persistError}</p>}{persistSuccess&&<p role="status" style={styles.success}>{persistSuccess}</p>}
      <div style={{...styles.exportCard,background:c.card,borderColor:c.border}}><strong style={{fontSize:13}}>Entregáveis e segurança</strong><span style={{...styles.muted,color:c.muted}}>O rascunho continua editável depois de exportar.</span><div style={styles.exportActions}><button onClick={()=>setShowResumo(v=>!v)} style={{...styles.secondary,color:c.text,borderColor:c.border}}>{showResumo?"Ocultar resumo":"Ver resumo"}</button><button onClick={exportarPdf} style={styles.primary}>PDF (padrão Moked)</button><button onClick={exportarTxt} style={{...styles.secondary,color:c.text,borderColor:c.border}}>Baixar TXT</button><button onClick={baixarCopiaSeguranca} style={{...styles.secondary,color:c.text,borderColor:c.border}}>Cópia de segurança</button></div>{exportError&&<p role="alert" style={styles.error}>{exportError}</p>}{showResumo&&<div style={{...styles.summaryBox,background:c.alt,borderColor:c.border}}><div><strong>{relatorio.percentual}%</strong> preenchido · {relatorio.respondidos}/{relatorio.total} itens · <strong>{relatorio.nAchados}</strong> achado{relatorio.nAchados===1?"":"s"} · P1 {relatorio.porPrioridade[1]} · P2 {relatorio.porPrioridade[2]} · P3 {relatorio.porPrioridade[3]}{relatorio.porPrioridade[4]?` · sem dado ${relatorio.porPrioridade[4]}`:""}</div>{projetoContexto?.baseId&&<div style={{...styles.muted,color:c.muted}}>Revisão iniciada a partir de outra revisão deste projeto.</div>}{relatorio.evolucao&&<div style={{...styles.muted,color:c.muted}}>Comparação com {relatorio.evolucao.rotulo}: {relatorio.evolucao.corrigidos.length} corrigidos · {relatorio.evolucao.persistem.length} persistem · {relatorio.evolucao.pioraram.length+relatorio.evolucao.novos.length} pioraram/novos</div>}{Object.entries(relatorio.contagens).map(([st,n])=><div key={st} style={{...styles.muted,color:c.muted}}>{STATUS_UI[st]?.label||st}: {n}</div>)}</div>}</div>
      <button onClick={clearDraft} style={{...styles.clearButton,color:c.muted}}>Limpar rascunho local</button><p style={{...styles.disclaimer,color:c.muted}}>Diagnóstico vinculado a {projetoContexto.rotuloLivre||projetoContexto.projetoRef}; catálogo permanece somente leitura.</p>
    </section>
  </div></main>;
}

const styles={
  page:{minHeight:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",display:"flex",justifyContent:"center"},shell:{width:"100%",maxWidth:760},header:{position:"sticky",top:0,zIndex:20,padding:"12px 14px 10px",borderBottom:"1px solid"},headerTitle:{margin:0,fontSize:17,fontWeight:850,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},title:{margin:0,fontSize:21,fontWeight:850},muted:{margin:0,fontSize:11},iconButton:{width:38,height:38,borderRadius:10,border:"1px solid",background:"transparent",cursor:"pointer",fontSize:16},progressCard:{marginTop:10,border:"1px solid",borderRadius:12,padding:"10px 12px"},progressTrack:{height:7,borderRadius:8,overflow:"hidden",marginTop:7},progressFill:{height:"100%",borderRadius:8,background:"linear-gradient(90deg,#2563eb,#38bdf8)",transition:"width .25s ease"},saveLine:{display:"flex",justifyContent:"space-between",gap:10,fontSize:10,marginTop:7},categoryNav:{display:"flex",gap:7,overflowX:"auto",paddingTop:9,paddingBottom:2,scrollbarWidth:"thin"},categoryChip:{border:"1px solid",borderRadius:999,padding:"7px 10px",cursor:"pointer",display:"flex",gap:6,alignItems:"center",fontSize:11,fontWeight:750,whiteSpace:"nowrap"},content:{display:"grid",gap:11,padding:"13px 12px 48px",scrollMarginTop:190},categoryHeading:{border:"1px solid",borderRadius:14,padding:"14px 16px"},eyebrow:{fontSize:9,fontWeight:850,letterSpacing:.8,textTransform:"uppercase",color:"#38bdf8"},subcategory:{border:"1px solid",borderRadius:14,overflow:"hidden"},subcategoryHeader:{padding:"12px 14px",borderBottom:"1px solid",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12},counter:{fontSize:10,fontWeight:800,border:"1px solid",borderRadius:999,padding:"4px 8px"},item:{padding:"13px 14px",borderBottom:"1px solid"},itemNumber:{width:25,height:25,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:850,flexShrink:0},statusGrid:{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6,marginTop:11},statusButton:{minHeight:38,border:"1px solid",borderRadius:8,cursor:"pointer",padding:"5px 6px",display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontSize:9,lineHeight:1.1},analysisPanel:{display:"grid",gap:9,marginTop:10,padding:11,border:"1px solid",borderRadius:10},analysisHint:{fontSize:10,lineHeight:1.35},fieldLabel:{display:"grid",gap:5,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:.45},responseInput:{boxSizing:"border-box",width:"100%",minHeight:54,resize:"vertical",border:"1px solid",borderRadius:8,padding:9,fontSize:12,fontFamily:"inherit",outline:"none",lineHeight:1.35},footerActions:{display:"grid",gridTemplateColumns:"1fr 1.35fr",gap:8,marginTop:3},primary:{border:"none",borderRadius:10,background:"linear-gradient(135deg,#2563eb,#1d4ed8)",color:"#fff",padding:"12px 14px",fontSize:12,fontWeight:800,cursor:"pointer"},secondary:{border:"1px solid",borderRadius:10,background:"transparent",padding:"12px 14px",fontSize:12,fontWeight:700,cursor:"pointer"},clearButton:{justifySelf:"center",border:"none",background:"transparent",textDecoration:"underline",cursor:"pointer",fontSize:11,padding:8},disclaimer:{textAlign:"center",fontSize:10,lineHeight:1.5,padding:"0 20px"},loginCard:{alignSelf:"center",width:"calc(100% - 32px)",maxWidth:360,boxSizing:"border-box",border:"1px solid",borderRadius:18,padding:"28px 24px",display:"grid",justifyItems:"center",textAlign:"center",gap:20},label:{display:"grid",gap:6,textAlign:"left",fontSize:11,fontWeight:750,textTransform:"uppercase",letterSpacing:.5},input:{boxSizing:"border-box",width:"100%",border:"1px solid",borderRadius:9,padding:12,fontSize:14,outline:"none"},error:{color:"#fecaca",background:"#7f1d1d",border:"1px solid #ef4444",borderRadius:8,padding:"9px 10px",fontSize:11},centerState:{alignSelf:"center",display:"grid",justifyItems:"center",gap:10},
  success:{color:"#dcfce7",background:"#14532d",border:"1px solid #22c55e",borderRadius:8,padding:"9px 10px",fontSize:11},
  listCard:{alignSelf:"center",width:"calc(100% - 24px)",maxWidth:520,boxSizing:"border-box",border:"1px solid",borderRadius:18,padding:"22px 18px",display:"grid",gap:12},
  filterTabs:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7},filterTab:{border:"1px solid",borderRadius:9,padding:9,fontSize:11,fontWeight:800,cursor:"pointer"},
  diagnosticRow:{border:"1px solid",borderRadius:11,padding:10,display:"grid",gap:8},diagnosticOpen:{border:0,background:"transparent",padding:0,display:"grid",gap:3,textAlign:"left",cursor:"pointer",fontSize:11},
  rowActions:{display:"flex",gap:7,flexWrap:"wrap"},smallAction:{border:"1px solid",borderRadius:8,background:"transparent",padding:"7px 9px",fontSize:10,fontWeight:800,cursor:"pointer"},
  emptyState:{border:"1px dashed",borderRadius:9,padding:15,textAlign:"center"},
  localDraftButton:{border:"1px solid #f59e0b",borderRadius:11,background:"#f59e0b14",padding:"11px 12px",display:"grid",gap:3,textAlign:"left",cursor:"pointer",fontSize:11},
  exportCard:{border:"1px solid",borderRadius:14,padding:"13px 14px",display:"grid",gap:9},exportActions:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8},summaryBox:{border:"1px solid",borderRadius:10,padding:11,display:"grid",gap:4,fontSize:12}
};
