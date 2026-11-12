// TEMPORÁRIO — Fase 0 do Painel do projeto (12/11/2026). Mede o uso real dos módulos nos últimos 30 dias.
// SÓ LÊ. Não grava nada. Só o consultor (admin). Devolve apenas contagens e tamanhos: nenhum nome, telefone, CPF ou foto.
// Apagar este arquivo e src/painelProjeto/UsoTemp.jsx depois que a tabela for entregue.
const {getDb}=require('./ai/lib/firebaseAdmin');
const {requireAdmin,PROJECTS}=require('./ai/lib/accessAuth');
const {divisaoDoProjeto}=require('../src/divisoes');
const {contarUso,tamanhoKB,visitasRd}=require('../src/painelProjeto/usoContagem');

const LISTAS=[['acessoCco','acesso_cco'],['intervalos','cco_intervalo'],['supervisao','cco_supervisao'],['manutencaoCco','cco_manutencao'],['keyaccess','keyaccess_falhas'],
 ['perimetral','perimetral'],['energia','energia_ocorrencias'],['ocorrenciasRS','ocorrencias'],['acessoTransp','acesso'],['followups','followups'],['bolsao','bolsao'],['bolsaoInq','bolsao_inquilinos'],
 ['rondaDiaria','rondas'],['rondaVspp','ronda_vspp'],['iluminacao','iluminacao'],['gravacao','cftv_gravacao'],['equipamentos','equipamentos'],['sinistros','sinistros'],['ctmk','ctmk']];

module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false,erro:'Método não permitido.'});
 if(!requireAdmin(req,res))return;
 try{
  const db=getDb(),agora=new Date(),hoje=agora.toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
  const pids=PROJECTS.filter(p=>divisaoDoProjeto(p)==='moklog'),projetos={},grandes=[];
  const ler=async(col,pid)=>{try{const s=await db.collection(col).doc(pid).get();return s.exists?s.data():null;}catch(e){return undefined;}};
  for(const pid of pids){
   const linha={};
   const [proj,eq,ronda,mapas,amb]=await Promise.all([ler('projects',pid),ler('equipes',pid),ler('cco_ronda',pid),
    db.collection('equipes').doc(pid).collection('mapas').get().then(s=>s.docs.map(d=>({id:d.id,...d.data()}))).catch(()=>undefined),
    db.collection('ambulancias').doc(pid).collection('registros').get().then(s=>s.docs.map(d=>d.data())).catch(()=>undefined)]);
   linha.testeSemanal=contarUso.testes(proj,hoje);
   linha.mapaDiario=contarUso.mapas(mapas,hoje);
   linha.rondaVirtual=contarUso.ronda(ronda,hoje);
   linha.ambulancia=contarUso.lista(amb,hoje);
   linha.equipe=contarUso.equipe(eq,hoje);
   for(const [nome,d] of [['projects',proj],['equipes',eq],['cco_ronda',ronda]]){const kb=tamanhoKB(d);if(kb>=700)grandes.push({pid,doc:nome,kb});linha['kb_'+nome]=kb;}
   const docs=await Promise.all(LISTAS.map(([,col])=>ler(col,pid)));
   LISTAS.forEach(([nome,col],i)=>{const d=docs[i];linha[nome]=nome==='equipamentos'?contarUso.equipamentos(d):nome==='followups'?contarUso.followups(d,hoje):contarUso.documento(d,hoje);const kb=tamanhoKB(d);if(kb>=700)grandes.push({pid,doc:col,kb});if(kb>=100)linha['kb_'+col]=kb;});
   projetos[pid]=linha;
  }
  let rd;try{const s=await db.collection('rd_dias').limit(2000).get();rd=visitasRd(s.docs.map(d=>d.data()),hoje,pids);}catch(e){rd={erro:'não foi possível ler rd_dias'};}
  console.log(JSON.stringify({evt:'painelUso',status:200,projetos:pids.length}));
  return res.status(200).json({ok:true,geradoEm:agora.toISOString(),periodo:'últimos 30 dias até '+hoje,projetos,rd,documentosGrandes:grandes});
 }catch(e){console.log(JSON.stringify({evt:'painelUso',status:503}));return res.status(503).json({ok:false,erro:'Não foi possível medir agora. Nada foi alterado.'});}
};
