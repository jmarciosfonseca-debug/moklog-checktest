// Internal planning only: no writes to fv/ and no changes in the Moked portal.
const { getDb } = require('./ai/lib/firebaseAdmin');
const {requireAdmin,clientIp,audit}=require('./ai/lib/accessAuth');
const {synchronize,realize,price}=require('./ai/lib/fvAprovacao');
const PIDS=['P260A','P260B','P260C','P505','P601','P602','P604','P605','P606','P607'];
const PARAMS=['creditoMensal','vtMensal','amMensal'];
const idOk=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
const money=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e9;
function validate(body){
 if(!PIDS.includes(body.pid))throw Error('Projeto fora do escopo FV');
 if(body.acao==='ler')return;
 if(body.acao==='aprovacaoUniforme'){
  if(!body.solic||!idOk(body.solic.id)||!idOk(body.solic.colabId)||!['aprovado','negado','aguardando'].includes(body.decisao))throw Error('Solicitação ou decisão inválida');return;
 }
 if(body.acao==='realizarAprovacao'){if(!idOk(body.id)||typeof body.realizado!=='boolean')throw Error('Lançamento inválido');return;}
 if(['recorrente_excluir','catalogo_excluir'].includes(body.acao)){if(!idOk(body.id))throw Error('Item inválido');return;}
 if(['recorrente_salvar','catalogo_salvar'].includes(body.acao)){
  const x=body.item,field=body.acao==='catalogo_salvar'?'nome':'descricao';
  if(!x||!idOk(x.id)||typeof x[field]!=='string'||!x[field].trim()||x[field].length>300||!money(x.valor)||(body.acao==='recorrente_salvar'&&typeof x.ativo!=='boolean')||(x.equipeItem!=null&&(typeof x.equipeItem!=='string'||x.equipeItem.length>100)))throw Error('Item ou valor inválido');return;
 }
 if(body.acao==='parametro'){
  if(!PARAMS.includes(body.campo)||(body.valor!==null&&!money(body.valor)))throw Error('Parâmetro inválido');return;
 }
 if(body.acao==='excluir'){if(!idOk(body.id))throw Error('Lançamento inválido');return;}
 if(body.acao!=='salvar')throw Error('Operação inválida');
 const l=body.lancamento;
 if(!l||!idOk(l.id)||!['reserva','debito','aporte','outros'].includes(l.tipo)||typeof l.descricao!=='string'||!l.descricao.trim()||l.descricao.length>300||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(l.mes)||typeof l.realizado!=='boolean')throw Error('Preencha descrição, valor e mês válidos');
 if(l.vinculo==='cestaNatal'){if(l.tipo!=='reserva'||!money(l.valorMedio))throw Error('Reserva de cesta inválida');}
 else if(l.vinculo==='catalogo'){if(!idOk(l.itemId)||!Number.isSafeInteger(l.qtd)||l.qtd<1||l.qtd>100000)throw Error('Item ou quantidade inválida');}
 else if(l.vinculo||!money(l.valor))throw Error('Valor inválido');
 if(l.tipo==='outros'&&!['+','-'].includes(l.sinal))throw Error('Selecione entrada ou saída');
}
function mutate(base,body){
 const plano={...base,lancamentos:[...(base.lancamentos||[])]};
 if(body.acao.startsWith('recorrente_')){
  plano.recorrentes=[...(base.recorrentes||[])].filter(x=>x.id!==(body.item?.id||body.id));
  if(body.acao==='recorrente_salvar')plano.recorrentes.push({id:body.item.id,descricao:body.item.descricao.trim(),valor:Math.round(body.item.valor*100)/100,ativo:body.item.ativo});
  if(plano.recorrentes.length>100)throw Error('Limite de recorrentes atingido');
 }
 if(body.acao==='parametro')plano[body.campo]=body.valor===null?null:Math.round(body.valor*100)/100;
 if(body.acao==='excluir')plano.lancamentos=plano.lancamentos.filter(l=>l.id!==body.id);
 if(body.acao==='salvar'){
  const l=body.lancamento;
  const reg={id:l.id,tipo:l.tipo,descricao:l.descricao.trim(),mes:l.mes,realizado:l.realizado,...(l.tipo==='outros'?{sinal:l.sinal}:{}),...(l.vinculo==='cestaNatal'?{vinculo:'cestaNatal',valorMedio:Math.round(l.valorMedio*100)/100}:l.vinculo==='catalogo'?{vinculo:'catalogo',itemId:l.itemId,qtd:l.qtd}:{valor:Math.round(l.valor*100)/100})};
  const i=plano.lancamentos.findIndex(x=>x.id===reg.id);
  if(i>=0)plano.lancamentos[i]=reg;else plano.lancamentos.push(reg);
 }
 if(plano.lancamentos.length>500)throw Error('Limite de planejamento atingido');
 return {...plano,atualizadoEm:new Date().toISOString(),revisao:(Number(base.revisao)||0)+1};
}
async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false,erro:'Método não permitido'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};}catch{return res.status(400).json({ok:false,erro:'Pedido inválido'});}
 const auth=requireAdmin(req,res);if(!auth)return;
 try{validate(body);}catch(e){return res.status(400).json({ok:false,erro:e.message});}
 try{
  const db=getDb(),ref=db.collection('fv_plano').doc(body.pid),catRef=db.collection('fv_plano').doc('_catalogo');
  if(body.acao==='ler'){
   const ano=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date()));
   const [snapshot,cestas,cat]=await Promise.all([ref.get(),db.collection('equipes').doc(body.pid).collection('cestaNatal').where('ano','==',ano).get(),catRef.get()]);
   return res.status(200).json({ok:true,plano:snapshot.exists?snapshot.data():{lancamentos:[],recorrentes:[]},qtdCestas:cestas.size,catalogo:cat.exists?cat.data().itens||[]:[]});
  }
  if(body.acao.startsWith('catalogo_')){
   const catalogo=await db.runTransaction(async t=>{
    const cat=await t.get(catRef);const itens=[...(cat.exists?cat.data().itens||[]:[])];
    if(body.acao==='catalogo_excluir'){
     const plans=await Promise.all(PIDS.map(pid=>t.get(db.collection('fv_plano').doc(pid))));
     if(plans.some(s=>s.exists&&(s.data().lancamentos||[]).some(l=>(l.vinculo==='catalogo'||l.vinculo==='aprovacao')&&price(l,itens)?.id===body.id)))throw Error('CATALOGO_EM_USO');
    }
    const novo=itens.filter(x=>x.id!==(body.item?.id||body.id));
    if(body.acao==='catalogo_salvar'){
     const equipeItem=body.item.equipeItem?.trim()||null;
     if(equipeItem&&novo.some(x=>x.equipeItem===equipeItem))throw Error('MAPEAMENTO_DUPLICADO');
     const anterior=itens.find(x=>x.id===body.item.id);
     if(anterior?.equipeItem&&anterior.equipeItem!==equipeItem){
      const plans=await Promise.all(PIDS.map(pid=>t.get(db.collection('fv_plano').doc(pid))));
      if(plans.some(s=>s.exists&&(s.data().lancamentos||[]).some(l=>l.vinculo==='aprovacao'&&l.item===anterior.equipeItem&&!l.realizado)))throw Error('MAPEAMENTO_EM_USO');
     }
     novo.push({id:body.item.id,nome:body.item.nome.trim(),valor:Math.round(body.item.valor*100)/100,...(equipeItem?{equipeItem}:{})});
    }
    if(novo.length>300)throw Error('Limite de catálogo atingido');
    t.set(catRef,{itens:novo,atualizadoEm:new Date().toISOString()});audit(db,t,auth,'_catalogo',body.acao,clientIp(req));return novo;
   });return res.status(200).json({ok:true,catalogo});
  }
  const plano=await db.runTransaction(async t=>{
   const snapshot=await t.get(ref);const base=snapshot.exists?snapshot.data():{lancamentos:[]};let novo;
   if(body.acao==='aprovacaoUniforme'){
    const [equipe,cat]=await Promise.all([t.get(db.collection('equipes').doc(body.pid)),t.get(catRef)]);
    const colab=equipe.exists&&(equipe.data().colaboradores||[]).find(c=>c.id===body.solic.colabId);
    const solic=colab&&(colab.uniforme?.solicitacoes||[]).find(s=>s.id===body.solic.id);
    if(!solic)throw Error('SOLIC_AUSENTE');
    if((solic.aprovacao||'aguardando')!==body.decisao)throw Error('APROVACAO_MUDOU');
    novo=synchronize(base,solic,colab,cat.exists?cat.data().itens||[]:[]);
   }else if(body.acao==='realizarAprovacao'){
    const cat=await t.get(catRef);novo=realize(base,body.id,body.realizado,cat.exists?cat.data().itens||[]:[]);
   }else{
    if(['salvar','excluir'].includes(body.acao)&&(base.lancamentos||[]).some(l=>l.id===(body.id||body.lancamento?.id)&&l.vinculo==='aprovacao'))throw Error('ORIGEM_EQUIPE');
    novo=mutate(base,body);
   }
   if((novo.lancamentos||[]).length>500)throw Error('Limite de planejamento atingido');
   novo={...novo,atualizadoEm:new Date().toISOString()};
   if(body.acao==='salvar'&&body.lancamento.vinculo==='catalogo'){
    const cat=await t.get(catRef),item=cat.exists&&(cat.data().itens||[]).find(x=>x.id===body.lancamento.itemId);if(!item)throw Error('CATALOGO_AUSENTE');
    const anterior=(base.lancamentos||[]).find(l=>l.id===body.lancamento.id);
    novo.lancamentos=novo.lancamentos.map(l=>l.id!==body.lancamento.id?l:{...l,...(l.realizado?{valorUnit:anterior?.realizado&&typeof anterior.valorUnit==='number'?anterior.valorUnit:item.valor}:{})});
   }
   t.set(ref,novo);audit(db,t,auth,body.pid,body.acao,clientIp(req));return novo;
  });
  console.info('FV planejamento salvo',{pid:body.pid,acao:body.acao});
  return res.status(200).json({ok:true,plano});
 }catch(e){
  const erros={SOLIC_AUSENTE:'Solicitação não encontrada na Equipe.',APROVACAO_MUDOU:'A decisão da Equipe mudou. Reabra a tela e reprocesse o FV.',ORIGEM_EQUIPE:'Lançamento da Equipe não pode ser editado ou excluído manualmente.',MAPEAMENTO_DUPLICADO:'Este item da Equipe já está vinculado a outro preço.',MAPEAMENTO_EM_USO:'O vínculo está em uso por aprovações previstas. Edite somente o preço.'};
  if(erros[e.message])return res.status(409).json({ok:false,erro:erros[e.message]});
  if(/preço|aprovação foi cancelada|aprovação não encontrado|identificador duplicado|Quantidade da solicitação|Data de aprovação/.test(e.message))return res.status(409).json({ok:false,erro:e.message});
  if(e.message==='CATALOGO_EM_USO')return res.status(409).json({ok:false,erro:'Este item está vinculado a um planejamento. Remova o vínculo antes de excluí-lo.'});
  if(e.message==='CATALOGO_AUSENTE')return res.status(409).json({ok:false,erro:'Item não encontrado no catálogo. Reabra o projeto e escolha um item válido.'});
  console.error('FV planejamento indisponível',{code:e.code||'backend'});return res.status(503).json({ok:false,erro:'Servidor de planejamento indisponível. Tente novamente; nenhum saldo real foi alterado.'});}
}
module.exports=handler;module.exports.validate=validate;module.exports.mutate=mutate;
