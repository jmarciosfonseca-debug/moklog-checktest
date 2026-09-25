const STATUS_LABEL={conforme:"Conforme",parcial:"Parcial",nao_conforme:"Não conforme",ausente_necessario:"Ausente necessário",na:"Não aplicável",sem_dado:"Sem dado"};
const STATUS_COR={conforme:[34,197,94],parcial:[245,158,11],nao_conforme:[239,68,68],ausente_necessario:[249,115,22],na:[139,92,246],sem_dado:[100,116,139]};

const texto=(valor)=>String(valor??"").trim();
const dataBr=(valor)=>{const data=new Date(valor);return Number.isNaN(data.getTime())?"":data.toLocaleString("pt-BR");};
const slug=(valor)=>texto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-+|-+$/g,"")||"diagnostico";

export function montarRelatorioDiagnostico({catalogo,itens=[],respostas={},contexto={},diagnosticoId=null,estado="rascunho",geradoEm=new Date().toISOString()}) {
  const categorias=[...(catalogo?.categorias||[])].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
  const subs=[...(catalogo?.subcategorias||[])].sort((a,b)=>(a.ordem||0)-(b.ordem||0));
  const ativos=[...itens].filter(i=>i&&i.deprecado!==true).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
  const secoes=categorias.map(cat=>({
    id:cat.id,nome:cat.nome,
    subcategorias:subs.filter(sub=>sub.categoria===cat.id).map(sub=>({
      id:sub.id,nome:sub.nome,
      itens:ativos.filter(item=>item.subcategoria===sub.id).map(item=>({
        id:item.id,texto:item.texto,criticidade:item.criticidade||"informativo",resposta:respostas[item.id]||{},
      })),
    })),
  }));
  const contagens=Object.keys(STATUS_LABEL).reduce((acc,status)=>({...acc,[status]:ativos.filter(item=>respostas[item.id]?.status===status).length}),{});
  const respondidos=Object.values(contagens).reduce((a,b)=>a+b,0);
  const achados=ativos.filter(item=>["parcial","nao_conforme","ausente_necessario","sem_dado"].includes(respostas[item.id]?.status)).length;
  return {
    titulo:"Diagnóstico Situacional",
    projeto:contexto.rotuloLivre||contexto.projetoRef||contexto.chave||"Projeto não identificado",
    grupo:contexto.grupo||"",catalogoId:catalogo?.id||catalogo?.catalogoId||"centro_logistico_v1_0_0",
    versao:catalogo?.versao||"",diagnosticoId,estado,geradoEm,total:ativos.length,respondidos,
    percentual:ativos.length?Math.round((respondidos/ativos.length)*100):0,achados,contagens,secoes,
  };
}

export function relatorioDiagnosticoTexto(relatorio) {
  const linhas=[
    "MOKLOG CHECKTEST - DIAGNÓSTICO SITUACIONAL",
    `Projeto: ${relatorio.projeto}`,
    `Estado: ${relatorio.estado}`,
    `Catálogo: ${relatorio.catalogoId} v${relatorio.versao}`,
    `Diagnóstico: ${relatorio.diagnosticoId||"rascunho local"}`,
    `Gerado em: ${dataBr(relatorio.geradoEm)}`,
    `Progresso: ${relatorio.respondidos}/${relatorio.total} (${relatorio.percentual}%)`,
    `Achados para análise: ${relatorio.achados}`,
    "",
  ];
  relatorio.secoes.forEach(secao=>{
    linhas.push(`${secao.id} - ${secao.nome}`);
    secao.subcategorias.forEach(sub=>{
      linhas.push(`  ${sub.id} - ${sub.nome}`);
      sub.itens.forEach(item=>{
        const r=item.resposta||{};
        linhas.push(`    [${STATUS_LABEL[r.status]||"Não respondido"}] ${item.id} - ${item.texto}`);
        [["Situação",r.situacao],["Impacto",r.impacto],["Indicação",r.indicacao],["Observação",r.observacao]].forEach(([rotulo,valor])=>{if(texto(valor))linhas.push(`      ${rotulo}: ${texto(valor)}`);});
      });
      linhas.push("");
    });
  });
  return linhas.join("\n");
}

export function nomeArquivoDiagnostico(relatorio,extensao) {
  return `diagnostico_${slug(relatorio.projeto)}_${String(relatorio.geradoEm).slice(0,10)}.${extensao}`;
}

export function baixarTextoDiagnostico(relatorio) {
  const blob=new Blob([relatorioDiagnosticoTexto(relatorio)],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=nomeArquivoDiagnostico(relatorio,"txt");document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}

export async function criarPdfDiagnostico(relatorio,{salvar=false}={}) {
  const {jsPDF}=await import("jspdf");
  const pdf=new jsPDF({unit:"mm",format:"a4",orientation:"portrait",compress:true});
  const W=210,H=297,M=14,CONTENT=W-(M*2);let y=14;
  const novaPagina=(min=12)=>{if(y+min<=H-16)return;pdf.addPage();y=17;};
  const linhas=(valor,largura=CONTENT)=>pdf.splitTextToSize(texto(valor),largura);
  const escreve=(valor,{size=9,bold=false,color=[30,41,59],indent=0,gap=1.2}={})=>{const ls=linhas(valor,CONTENT-indent);const h=ls.length*(size*.38+1);novaPagina(h+2);pdf.setFont("helvetica",bold?"bold":"normal");pdf.setFontSize(size);pdf.setTextColor(...color);pdf.text(ls,M+indent,y);y+=h+gap;};

  pdf.setFillColor(4,8,15);pdf.rect(0,0,W,42,"F");pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(20);pdf.text("MokLog CheckTest",M,16);pdf.setFontSize(14);pdf.text("Diagnóstico Situacional",M,25);pdf.setFont("helvetica","normal");pdf.setFontSize(9);pdf.setTextColor(148,163,184);pdf.text(`${relatorio.projeto} | catálogo v${relatorio.versao} | ${relatorio.estado}`,M,33);y=51;
  escreve(`Progresso: ${relatorio.respondidos}/${relatorio.total} itens (${relatorio.percentual}%)`,{size:12,bold:true,color:[15,23,42]});
  escreve(`Achados para análise: ${relatorio.achados} | Gerado em: ${dataBr(relatorio.geradoEm)}`,{size:8,color:[71,85,105]});
  if(relatorio.diagnosticoId)escreve(`ID do diagnóstico: ${relatorio.diagnosticoId}`,{size:7,color:[100,116,139]});
  y+=3;
  const resumo=[["C",relatorio.contagens.conforme,"Conforme",[34,197,94]],["P",relatorio.contagens.parcial,"Parcial",[245,158,11]],["NC",relatorio.contagens.nao_conforme,"Não conforme",[239,68,68]],["AN",relatorio.contagens.ausente_necessario,"Ausente",[249,115,22]],["NA",relatorio.contagens.na,"N/A",[139,92,246]],["SD",relatorio.contagens.sem_dado,"Sem dado",[100,116,139]]];
  resumo.forEach((r,i)=>{const x=M+(i%3)*60.5,yy=y+Math.floor(i/3)*15;pdf.setDrawColor(...r[3]);pdf.roundedRect(x,yy,57,11,2,2,"S");pdf.setFont("helvetica","bold");pdf.setFontSize(9);pdf.setTextColor(...r[3]);pdf.text(`${r[0]} ${r[1]}`,x+3,yy+4.5);pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.setTextColor(71,85,105);pdf.text(r[2],x+3,yy+8.5);});
  y+=34;

  relatorio.secoes.forEach(secao=>{
    novaPagina(16);pdf.setFillColor(226,232,240);pdf.roundedRect(M,y-4,CONTENT,10,2,2,"F");pdf.setFont("helvetica","bold");pdf.setFontSize(11);pdf.setTextColor(15,23,42);pdf.text(`${secao.id} - ${secao.nome}`,M+3,y+2.2);y+=11;
    secao.subcategorias.forEach(sub=>{
      novaPagina(12);escreve(`${sub.id} - ${sub.nome}`,{size:9,bold:true,color:[37,99,235],gap:2});
      sub.itens.forEach(item=>{
        const r=item.resposta||{},status=STATUS_LABEL[r.status]||"Não respondido",cor=STATUS_COR[r.status]||[148,163,184];
        const detalhe=[["Situação",r.situacao],["Impacto",r.impacto],["Indicação",r.indicacao],["Observação",r.observacao]].filter(([,v])=>texto(v));
        const itemLines=linhas(`${item.id} - ${item.texto}`,CONTENT-28);let altura=Math.max(10,itemLines.length*4.1+5)+detalhe.reduce((sum,[rot,v])=>sum+linhas(`${rot}: ${texto(v)}`,CONTENT-8).length*3.6+1,0);
        novaPagina(altura+3);pdf.setDrawColor(226,232,240);pdf.roundedRect(M,y-3,CONTENT,altura,2,2,"S");pdf.setFillColor(...cor);pdf.roundedRect(M+3,y,22,6,1.5,1.5,"F");pdf.setFont("helvetica","bold");pdf.setFontSize(6.5);pdf.setTextColor(255,255,255);pdf.text(status.slice(0,18),M+14,y+4,{align:"center"});pdf.setFontSize(8.5);pdf.setTextColor(30,41,59);pdf.text(itemLines,M+29,y+3.5);let dy=y+Math.max(8,itemLines.length*4.1+2);detalhe.forEach(([rot,v])=>{const dl=linhas(`${rot}: ${texto(v)}`,CONTENT-8);pdf.setFont("helvetica","normal");pdf.setFontSize(7.3);pdf.setTextColor(71,85,105);pdf.text(dl,M+4,dy);dy+=dl.length*3.6+1;});y+=altura+3;
      });
      y+=2;
    });
  });
  const totalPaginas=pdf.getNumberOfPages();for(let p=1;p<=totalPaginas;p++){pdf.setPage(p);pdf.setDrawColor(226,232,240);pdf.line(M,H-12,W-M,H-12);pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.setTextColor(100,116,139);pdf.text(`MokLog CheckTest | ${relatorio.projeto}`,M,H-7);pdf.text(`Página ${p} de ${totalPaginas}`,W-M,H-7,{align:"right"});}
  if(salvar)pdf.save(nomeArquivoDiagnostico(relatorio,"pdf"));
  return pdf;
}
