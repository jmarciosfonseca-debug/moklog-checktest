const round=n=>Math.round(n*100)/100;
const price=(l,catalogo)=>catalogo.find(i=>i.equipeItem===l.item)||catalogo.find(i=>i.id===l.itemId);
function month(iso){
 const date=new Date(iso);if(!Number.isFinite(date.getTime()))throw Error('Data de aprovação inválida');
 const parts=new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(date);
 return parts.find(x=>x.type==='year').value+'-'+parts.find(x=>x.type==='month').value;
}
function synchronize(base,solic,colab,catalogo=[]){
 const id='ap_'+solic.id,lista=[...(base.lancamentos||[])],old=lista.find(l=>l.id===id);
 if(old&&old.colabId!==colab.id)throw Error('Solicitação com identificador duplicado');
 if(solic.aprovacao!=='aprovado'){
  return {...base,lancamentos:lista.flatMap(l=>l.id!==id?[l]:l.realizado?[{...l,origemCancelada:true}]:[])};
 }
 if(old?.realizado)return {...base,lancamentos:lista.map(l=>l.id===id?{...l,origemCancelada:false}:l)};
 const item=catalogo.find(i=>i.equipeItem===solic.item),qtd=Number(solic.qtd??solic.quantidade??1);
 if(!Number.isSafeInteger(qtd)||qtd<1||qtd>100000)throw Error('Quantidade da solicitação inválida');
 const reg={id,tipo:'debito',vinculo:'aprovacao',solicId:solic.id,colabId:colab.id,colabNome:colab.nome||'',item:solic.item,tamanho:solic.tamanho||'',qtd,itemId:item?.id||null,categoria:'uniforme',mes:month(solic.aprovadoEm),descricao:solic.item+' · '+(colab.nome||''),realizado:false,aprovadoEm:solic.aprovadoEm,aprovadoPor:'Gerencial',valor:item?round(qtd*item.valor):0,semPreco:!item,origemCancelada:false};
 return {...base,lancamentos:[...lista.filter(l=>l.id!==id),reg]};
}
function realize(base,id,realizado,catalogo=[]){
 const old=(base.lancamentos||[]).find(l=>l.id===id);
 if(!old||old.vinculo!=='aprovacao')throw Error('Lançamento de aprovação não encontrado');
 if(old.origemCancelada&&!realizado)throw Error('A aprovação foi cancelada; não pode voltar à projeção');
 if(old.realizado===realizado)return base;
 const item=price(old,catalogo);
 if(realizado&&!item)throw Error('Cadastre o preço antes de marcar como realizado');
 return {...base,lancamentos:base.lancamentos.map(l=>l.id!==id?l:{...l,realizado,valorUnit:realizado?item.valor:null,valor:realizado?round(item.valor*l.qtd):0,realizadoEm:realizado?new Date().toISOString():null})};
}
module.exports={synchronize,realize,price,month};
