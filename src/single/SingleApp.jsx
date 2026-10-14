import React,{useEffect,useMemo,useState} from "react";
import {criarStore} from "./singleStore";
import {familias,VERSAO} from "./catalogoV2";
import CenarioAtivos from "./CenarioAtivos";
import AnaliseRiscoSingle from "./AnaliseRiscoSingle";
import {calcularInspecao,variacao,anteriorConcluida,fmtVariacao} from "./singleCalc";
import {draftKey,lerDraft,salvarDraft,hoje,novoId} from "./singleDraft";
import {imprimirSingle} from "./pdfSingle";
import "./single.css";
// Catálogo gravado em versão antiga (v1, famílias agrupadas) não vale mais: usa o v2 e preserva a revisão do servidor.
// Chave de comparação do nome do cliente: sem acento, caixa ou pontuação (PXXX 123 = pxxx123).
export const chaveNome=n=>String(n||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const acharDiagnostico=(lista,nome)=>{const k=chaveNome(nome);return k?(lista||[]).find(d=>chaveNome(d.rotuloLivre)===k):null;};
const totalRespondidos=d=>(d?.itens||[]).reduce((s,i)=>s+(i.respondidos||0),0);
const catalogoVigente=d=>d&&d.versao===VERSAO?d:{familias,versao:VERSAO,revisao:d?.revisao||0};
export default function SingleApp({auth,profile,onBack,onDiagnostico, onInicio}){
 const store=useMemo(()=>criarStore(auth),[auth]);
 const [projects,setProjects]=useState([]),[catalog,setCatalog]=useState({familias,revisao:0,versao:VERSAO});
 const [project,setProject]=useState(null),[assets,setAssets]=useState([]),[inspection,setInspection]=useState(null),[history,setHistory]=useState([]);
 const [tab,setTab]=useState("Lista"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [form,setForm]=useState({nome:"",codigo:"",responsavel:"",dataVistoria:hoje()}),[draftReady,setDraftReady]=useState(false);
 const [catalogMode,setCatalogMode]=useState(false);
 const [diagNovos,setDiagNovos]=useState([]),[importar,setImportar]=useState(true);
 const userId=auth.currentUser?.uid;
 async function run(fn){if(busy)return;setBusy(true);setError("");setNotice("");try{await fn();}catch(e){setError(e.message||"Não foi possível concluir. Rascunho preservado.");}finally{setBusy(false);}}
 const refresh=async()=>{const [ps,cat]=await Promise.all([store.listar(),store.lerCatalogo()]);setProjects(ps.projetos);setCatalog(catalogoVigente(cat.data));};
 useEffect(()=>{let active=true;(async()=>{try{const [ps,cat]=await Promise.all([store.listar(),store.lerCatalogo()]);if(active){setProjects(ps.projetos);setCatalog(catalogoVigente(cat.data));}}catch(e){if(active)setError(e.message);}
  try{const dn=await store.diagnosticosNovos();if(active)setDiagNovos(dn.diagnosticos||[]);}catch(e){/* vínculo é opcional: sem ele o Single funciona normalmente */}})();return()=>{active=false;};},[store]);
 useEffect(()=>{if(project&&draftReady&&!salvarDraft(localStorage,draftKey(userId,project.id),{project,assets,inspection}))setError("Armazenamento local cheio ou indisponível. Não saia antes de salvar no servidor.");},[project,assets,inspection,userId,draftReady]);
 async function open(p0){
   setDraftReady(false);
   const [lista,result]=await Promise.all([store.listar(),store.listarInspecoes(p0.id)]);
   const p=lista.projetos.find(x=>x.id===p0.id);
   if(!p)throw new Error("Projeto não disponível para este usuário.");
   const found=lerDraft(localStorage,draftKey(userId,p.id));
   // Rascunho só vale se foi feito sobre a MESMA revisão do servidor; senão vira cópia de conflito e abre o servidor.
   const remoteInspection=found?.inspection&&result.inspecoes.find(x=>x.id===found.inspection.id);
   const inspectionAtual=!found?.inspection||(remoteInspection?remoteInspection.revisao===found.inspection.revisao:!found.inspection.revisao);
   const draft=found&&found.project?.revisao===p.revisao&&inspectionAtual?found:null;
   if(found&&!draft&&!salvarDraft(localStorage,draftKey(userId,p.id)+":conflito:"+Date.now(),found))throw new Error("Não foi possível preservar a cópia local. Nada foi descartado; libere espaço antes de reabrir.");
   setProjects(lista.projetos);
   setProject(draft?.project||p);setAssets(draft?.assets||p.ativos||[]);setInspection(draft?.inspection||null);
   setHistory(result.inspecoes.sort((a,b)=>String(b.data).localeCompare(String(a.data))||String(b.criadoEm).localeCompare(String(a.criadoEm))));
   setTab("Lista");setDraftReady(true);
   if(draft)setNotice("Rascunho local recuperado. Se houver conflito, preserve-o antes de recarregar.");
   else if(found)setNotice("O projeto mudou no servidor desde o seu rascunho. Abri a versão do servidor; o rascunho anterior ficou guardado como cópia de conflito neste navegador.");
 }
 function asset(f,value){setAssets(xs=>{const old=xs.find(x=>x.id===f.id);return old?xs.map(x=>x.id===f.id?{...x,total:value}:x):[...xs,{id:f.id,familiaId:f.id,custom:false,nome:f.nome,grupo:f.grupo,total:value}];});}
 async function recarregar(){
  const key=draftKey(userId,project.id)+":conflito:"+Date.now();
  if(!salvarDraft(localStorage,key,{project,assets,inspection}))throw new Error("Não foi possível preservar a cópia local. Nada foi descartado.");
  const result=await store.listar(),fresh=result.projetos.find(p=>p.id===project.id);
  if(!fresh)throw new Error("Projeto não disponível para este usuário.");
  const resultHistory=await store.listarInspecoes(project.id);
  setProject(fresh);setAssets(fresh.ativos||[]);setInspection(null);setHistory(resultHistory.inspecoes);setProjects(result.projetos);
  setNotice("Versão do servidor aberta. A edição anterior permanece guardada neste navegador como cópia de conflito.");
 }
 const ativosAlterados=!!project&&JSON.stringify(assets)!==JSON.stringify(project.ativos||[]);
 function preservarInspecao(){if(!inspection)return true;if(salvarDraft(localStorage,draftKey(userId,project.id)+":copia:"+Date.now(),{project,assets,inspection}))return true;setError("Não foi possível preservar a edição atual. Salve antes de trocar de vistoria.");return false;}
 function iniciar(p){if(!preservarInspecao())return;setInspection({id:crypto.randomUUID(),revisao:0,cenarioRevisao:p.revisao,tipo:"situacional",data:hoje(),responsavel:p.responsavel,observacoes:"",estado:"rascunho",itens:(p.ativos||[]).filter(x=>Number(x.total)>0).map(x=>({...x,parcial:0,inoperante:0,falhas:[]}))});setTab("Preencher");}
 function nova(){if(ativosAlterados){setError("Salve a lista antes de começar a vistoria.");return;}iniciar(project);}
 // Já existe um rascunho feito sobre esta mesma lista: volta para ele em vez de abrir outro.
 function irPreencher(p){if(inspection&&inspection.estado==="rascunho"&&inspection.cenarioRevisao===p.revisao){setTab("Preencher");return;}iniciar(p);}
 const change=(id,key,value)=>setInspection(i=>({...i,itens:i.itens.map(x=>x.id===id?{...x,[key]:value}:x)}));
 let calculated=null,calcError="";
 try{if(inspection)calculated=calcularInspecao(inspection);}catch(e){calcError=e.message;}
 const previous=inspection?anteriorConcluida(history,inspection):null;
 const changes=calculated?variacao(calculated,previous):[];
 const diagEncontrado=acharDiagnostico(diagNovos,form.nome);
 const diagDoProjeto=project&&!project.diagnosticoImportado?acharDiagnostico(diagNovos,project.nome):null;
 const temItens=assets.some(x=>x.unidades?.length||Number(x.total)>0);
 const salvarLista=async()=>{const r=await store.salvarAtivos(project,assets.filter(x=>x.unidades?.length||Number(x.total)>0));setProject(r.data);setAssets(r.data.ativos);setProjects(xs=>xs.map(p=>p.id===r.data.id?r.data:p));setNotice("Lista salva.");return r.data;};
 const salvarVistoria=estado=>run(async()=>{const r=await store.salvarInspecao(project.id,{...inspection,estado});setInspection(r.data);setHistory(xs=>[r.data,...xs.filter(i=>i.id!==r.data.id)].sort((a,b)=>b.data.localeCompare(a.data)));if(r.data.estado==="concluida"){setTab("Relatório");setNotice("Vistoria concluída. Gere o relatório e a Análise de Risco abaixo.");}else setNotice("Vistoria salva.");});
 const alvo=inspection||history[0]||null;
 let alvoCalc=null;try{if(alvo)alvoCalc=calcularInspecao(alvo);}catch(e){alvoCalc=null;}
 const vistoriasSalvas=history.length>0&&<details className="single-grupo"><summary>Vistorias salvas ({history.length})</summary>{history.map(i=><button key={i.id} onClick={()=>{if(!inspection||window.confirm("Abrir a vistoria salva? Confirme que salvou a edição atual."))setInspection(i);}}>{i.data} · {i.estado==="concluida"?"concluída":"rascunho"} · {i.disponibilidadeGeral??"—"}%</button>)}</details>;
 const field=(key,label,type="text")=><label>{label}<input required={key==="nome"||key==="dataVistoria"} type={type} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>;
 const setUnit=(item,uid,p)=>change(item.id,"unidades",item.unidades.map(u=>u.id===uid?{...u,...p}:u));
 const updateFailure=(item,index,key,value)=>change(item.id,"falhas",item.falhas.map((f,n)=>n===index?{...f,[key]:value}:f));
 return <main className="single"><header><button onClick={onBack}>← Diagnóstico</button>{onInicio&&<button onClick={onInicio}>Início</button>}<h1>Single · Relatório Situacional</h1><p>Cliente avulso · famílias configuráveis · histórico preservado</p></header>
 {error&&<div role="alert" className="single-error">{error}<button disabled={busy} onClick={()=>run(refresh)}>Reconsultar servidor</button><p>Não sobrescrevemos seu rascunho ao reconsultar. Em conflito, abra novamente o registro após preservar sua versão.</p></div>}
 {notice&&<p role="status">{notice}</p>}{error&&project&&<button disabled={busy} onClick={()=>run(recarregar)}>Reabrir versão do servidor (preservar cópia local)</button>}
 {!project?<><section><h2>+ Novo projeto (Single)</h2><form onSubmit={e=>{e.preventDefault();run(async()=>{const r=await store.criarSingle(novoId(form.nome),form);setProjects(xs=>[r.data,...xs]);
   let aberto=r.data,msg="";
   if(diagEncontrado&&importar){try{const imp=await store.importarDiagnostico(r.data,diagEncontrado.chave);aberto=imp.data;setProjects(xs=>xs.map(p=>p.id===aberto.id?aberto:p));msg="Diagnóstico de "+diagEncontrado.rotuloLivre+" importado ("+totalRespondidos(diagEncontrado)+" resposta(s)).";}catch(e){msg="Single criado, mas o diagnóstico não foi importado: "+e.message+" Use a aba Diagnóstico para tentar de novo.";}}
   await open(aberto);if(msg)setNotice(msg);setForm({nome:"",codigo:"",responsavel:"",dataVistoria:hoje()});});}}>{field("nome","Cliente")}{diagEncontrado&&<p className="single-hint" role="status"><label><input type="checkbox" checked={importar} onChange={e=>setImportar(e.target.checked)}/> Encontrei o diagnóstico de <strong>{diagEncontrado.rotuloLivre}</strong> ({totalRespondidos(diagEncontrado)} resposta(s)). Importar ao criar o Single.</label></p>}{field("codigo","Código opcional")}{field("responsavel","Responsável")}{field("dataVistoria","Data da vistoria","date")}<button disabled={busy}>Criar projeto</button></form></section><section><h2>Projetos Single</h2>{projects.length===0&&<p>Nenhum Single listado.</p>}{projects.map(p=><button className="single-project" key={p.id} disabled={busy} onClick={()=>run(()=>open(p))}>{p.nome} · {p.estado}</button>)}</section>
 {profile.role==="gerente"&&<section><button onClick={()=>setCatalogMode(!catalogMode)}>Editar catálogo mestre</button>{catalogMode&&<><p>Renomear não altera inspeções antigas. O catálogo inicial é provisório; salvar confirma as famílias exibidas.</p>{catalog.familias.map((f,n)=><div className="single-catalog" key={f.id}><input aria-label={"Nome "+f.nome} value={f.nome} onChange={e=>setCatalog(c=>({...c,familias:c.familias.map(x=>x.id===f.id?{...x,nome:e.target.value}:x)}))}/><input aria-label={"Grupo "+f.nome} value={f.grupo} onChange={e=>setCatalog(c=>({...c,familias:c.familias.map(x=>x.id===f.id?{...x,grupo:e.target.value}:x)}))}/><label><input type="checkbox" checked={f.ativo} onChange={e=>setCatalog(c=>({...c,familias:c.familias.map(x=>x.id===f.id?{...x,ativo:e.target.checked}:x)}))}/>Ativo</label><button disabled={n===0} onClick={()=>setCatalog(c=>{const a=[...c.familias];[a[n-1],a[n]]=[a[n],a[n-1]];return {...c,familias:a};})}>↑</button></div>)}<button onClick={()=>setCatalog(c=>({...c,familias:[...c.familias,{id:crypto.randomUUID(),nome:"Nova família",grupo:"Personalizado",ativo:true,sinonimos:[]}]}))}>+ Família</button><button disabled={busy} onClick={()=>run(async()=>{const r=await store.editarCatalogo(catalog);setCatalog(r.data);setNotice("Catálogo salvo.");})}>Salvar catálogo</button></>}</section>}</>:
 <><section><button onClick={()=>{setProject(null);setDraftReady(false);}}>← Lista de Singles</button><h2>{project.nome}</h2><p>{project.estado==="arquivado"?"Arquivado — somente consulta":"Rascunho local automático; clique Salvar para enviar."}</p><nav className="single-passos">{[["Lista","1 · Lista de itens"],["Preencher","2 · Preencher"],["Relatório","3 · Relatório"],["Diagnóstico","Diagnóstico"]].map(([t,r])=><button aria-pressed={tab===t} key={t} onClick={()=>setTab(t)}>{r}</button>)}</nav></section>
 {tab==="Lista"&&<section><h2>1 · Criar a lista de itens</h2><CenarioAtivos catalog={catalog} assets={assets} setAssets={setAssets} disabled={project.estado==="arquivado"}/>
 <div className="single-acoes">
 <button disabled={busy||project.estado==="arquivado"||!ativosAlterados} onClick={()=>run(salvarLista)}>Salvar lista</button>
 <button className="single-principal" disabled={busy||project.estado==="arquivado"||!temItens} onClick={()=>run(async()=>{const p=ativosAlterados?await salvarLista():project;irPreencher(p);})}>Preencher a vistoria →</button>
 </div>
 {!temItens&&<p className="single-hint">Marque pelo menos um item para seguir.</p>}
 <p><button className="single-link" disabled={busy||project.estado==="arquivado"} onClick={()=>{if(window.confirm("Arquivar este Single? O histórico será preservado."))run(async()=>{const r=await store.arquivar(project);setProject(r.data);await refresh();});}}>Arquivar este projeto</button></p></section>}
 {tab==="Preencher"&&<section><h2>2 · Preencher a vistoria</h2>
 {!inspection&&<><p className="single-hint">Informe só o que <strong>não</strong> está operante. O que você não preencher conta como operante.</p><button className="single-principal" disabled={busy||project.estado==="arquivado"||!temItens} onClick={nova}>Começar a preencher</button>{!temItens&&<p className="single-hint">A lista de itens está vazia. Volte ao passo 1.</p>}</>}
 {vistoriasSalvas}
 {inspection&&<><label>Data<input type="date" value={inspection.data} onChange={e=>setInspection({...inspection,data:e.target.value})}/></label><label>Responsável<input value={inspection.responsavel} onChange={e=>setInspection({...inspection,responsavel:e.target.value})}/></label>
 <p className="single-hint">Informe só o que <strong>não</strong> está operante. O que você não preencher conta como operante.</p>
 {inspection.itens.map((item,n)=><fieldset key={item.id}><legend>{item.nome} · Total {item.total}</legend>{item.unidades?.length?<details className="single-unidades" open={item.unidades.length<=20}><summary>Marcar status por unidade ({item.unidades.length}) · {item.unidades.filter(u=>u.status==="inoperante").length} inoperante(s) · {item.unidades.filter(u=>u.status==="parcial").length} parcial(is)</summary><div className="single-row"><button type="button" onClick={()=>change(item.id,"unidades",item.unidades.map(u=>({id:u.id,nome:u.nome,status:"operante"})))}>Marcar todas operantes</button></div>{item.unidades.map(u=><div className={"single-unidade st-"+(u.status||"operante")} key={u.id}><strong>{u.nome}</strong><select aria-label={"Status "+u.nome} value={u.status||"operante"} onChange={e=>setUnit(item,u.id,{status:e.target.value,desde:e.target.value==="operante"?undefined:(u.desde||inspection.data)})}><option value="operante">Operante</option><option value="parcial">Parcial</option><option value="inoperante">Inoperante</option></select>{(u.status&&u.status!=="operante")&&<input aria-label={"Defeito "+u.nome} placeholder="Defeito / observação" value={u.nota||""} onChange={e=>setUnit(item,u.id,{nota:e.target.value})}/>}</div>)}</details>:<div className="single-row"><label>Parcial<input type="number" inputMode="numeric" min="0" step="1" value={item.parcial} onChange={e=>change(item.id,"parcial",e.target.value)}/></label><label>Inoperante<input type="number" inputMode="numeric" min="0" step="1" value={item.inoperante} onChange={e=>change(item.id,"inoperante",e.target.value)}/></label></div>}
 {calculated&&<p>Operantes: {calculated.itens[n]?.operante} · Disponibilidade: {calculated.itens[n]?.disponibilidade?.toLocaleString("pt-BR",{minimumFractionDigits:1})}% · Variação: {fmtVariacao(changes[n]?.disponibilidade)}</p>}
 {(item.falhas||[]).map((f,k)=><div className="single-failure" key={k}><label>Descrição<textarea value={f.descricao} onChange={e=>updateFailure(item,k,"descricao",e.target.value)}/></label><label>Quantidade<input inputMode="numeric" type="number" min="0" value={f.qtd} onChange={e=>updateFailure(item,k,"qtd",e.target.value)}/></label><label>Criticidade<select value={f.criticidade} onChange={e=>updateFailure(item,k,"criticidade",e.target.value)}><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></select></label><label>Desde<input type="date" value={f.desde} onChange={e=>updateFailure(item,k,"desde",e.target.value)}/></label><button onClick={()=>change(item.id,"falhas",item.falhas.filter((_,j)=>j!==k))}>Remover falha</button></div>)}
 <button onClick={()=>change(item.id,"falhas",[...(item.falhas||[]),{descricao:"",qtd:1,criticidade:"media",desde:inspection.data}])}>+ Falha</button>{calculated?.itens[n]?.avisos.map(a=><p key={a} role="alert">{a}</p>)}</fieldset>)}
 {calcError&&<p role="alert" className="single-error">{calcError}</p>}<label>Observações<textarea value={inspection.observacoes} onChange={e=>setInspection({...inspection,observacoes:e.target.value})}/></label>
 <div className="single-acoes">
 <button disabled={busy||!!calcError||project.estado==="arquivado"} onClick={()=>salvarVistoria("rascunho")}>Salvar vistoria</button>
 <button className="single-principal" disabled={busy||!!calcError||project.estado==="arquivado"} onClick={()=>salvarVistoria("concluida")}>Concluir vistoria →</button>
 </div></>}</section>}
 {tab==="Relatório"&&<><section><h2>3 · Gerar o relatório</h2>
 {!alvo?<p className="single-hint">Ainda não há vistoria. Faça o passo 2.</p>:<><p>Vistoria de <strong>{alvo.data}</strong> · {alvo.estado==="concluida"?"concluída":"rascunho"}{alvoCalc?" · disponibilidade geral "+alvoCalc.disponibilidadeGeral?.toLocaleString("pt-BR",{minimumFractionDigits:1})+"%":""}</p>
 {alvo.estado!=="concluida"&&<p className="single-hint">Esta vistoria ainda é rascunho. O relatório já sai, mas a Análise de Risco só libera depois de concluir.</p>}
 <button className="single-principal" disabled={!alvoCalc} onClick={()=>{try{imprimirSingle(project,alvo,anteriorConcluida(history,alvo));}catch(e){setError(e.message);}}}>Gerar relatório do Single (PDF)</button></>}
 {vistoriasSalvas}</section>
 <AnaliseRiscoSingle store={store} project={project} history={history}/></>}
 {tab==="Diagnóstico"&&<section><h2>Diagnóstico Situacional</h2><p>Abrir a avaliação existente vinculada a este cliente, sem alterar os projetos legados.</p>{project.diagnosticoImportado&&<p role="status">Diagnóstico importado de <strong>{project.diagnosticoImportado.rotuloLivre}</strong> em {String(project.diagnosticoImportado.em||"").slice(8,10)}/{String(project.diagnosticoImportado.em||"").slice(5,7)} ({project.diagnosticoImportado.itens} item(ns)).</p>}
 {diagDoProjeto&&project.estado!=="arquivado"&&<p><button disabled={busy||ativosAlterados} onClick={()=>run(async()=>{const imp=await store.importarDiagnostico(project,diagDoProjeto.chave);setProject(imp.data);setProjects(xs=>xs.map(p=>p.id===imp.data.id?imp.data:p));setNotice("Diagnóstico de "+diagDoProjeto.rotuloLivre+" importado.");})}>Importar diagnóstico "{diagDoProjeto.rotuloLivre}" ({totalRespondidos(diagDoProjeto)} resposta(s))</button>{ativosAlterados&&<span className="single-hint"> Salve o cenário antes.</span>}</p>}
 <button onClick={()=>onDiagnostico(project)}>Abrir diagnóstico deste Single</button></section>}
</>}
 </main>;
}

