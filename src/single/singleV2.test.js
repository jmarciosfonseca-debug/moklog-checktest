import React,{act} from "react";
import {createRoot} from "react-dom/client";
import CenarioAtivos,{gerarNomes} from "./CenarioAtivos";
import {htmlSingle} from "./pdfSingle";
const {familias,classificar,semOrigemReal}=require("./catalogoV2");
const {inventario}=require("./catalogoCobertura.cjs");
const {calcularFamilia,calcularInspecao}=require("./singleCalc");
const {executar}=require("./singleServer");

test("catálogo v3: itens separados, ids únicos e cobertura total dos 137 rótulos reais",()=>{
 expect(new Set(familias.map(f=>f.id)).size).toBe(familias.length);
 expect(familias.length).toBeGreaterThanOrEqual(50);
 const all=inventario().map(x=>({...x,v2:classificar(x.nome,x.tipo)}));
 expect(all).toHaveLength(137);
 expect(all.filter(x=>x.v2==="revisar")).toEqual([]);
 const ids=new Set(familias.map(f=>f.id));
 expect(all.every(x=>x.v2==="fora_v1"||ids.has(x.v2))).toBe(true);
 const usados=new Set(all.map(x=>x.v2));
 expect(familias.filter(f=>!usados.has(f.id)&&!semOrigemReal.includes(f.id))).toEqual([]);
 expect(semOrigemReal.every(id=>ids.has(id))).toBe(true);
 // nenhum nome com "/": um nome = uma coisa que existe ou não existe
 expect(familias.filter(f=>f.nome.includes("/"))).toEqual([]);
});
test("itens que antes eram juntados agora são separados",()=>{
 const id=l=>classificar(l);
 expect(new Set([id("05 - CANCELAS AS (ALTA SEGURANÇA)"),id("04 - CANCELA"),id("08 - DILACERADORES"),id("13 - PORTÕES"),id("14 - MOTORES DOS PORTÕES"),id("05 - BOTOEIRAS PORTÕES")]).size).toBe(6);
 expect(id("06 - CFTV FIXAS")).not.toBe(id("06B - CFTV SPEED DOME"));
 expect(id("04 - PÂNICO FIXO")).not.toBe(id("04B - PÂNICO MÓVEL"));
 expect(id("20 - TOTENS")).not.toBe(id("19 - TABLETS KEYACCESS"));
 expect(id("INTERNET")).not.toBe("inf_link_dados");
 expect(id("04 - BOLLARDS / PINOS")).toBe("vei_bollards");
 expect(familias.map(f=>f.id)).toEqual(expect.arrayContaining(["vei_bollards","vei_pinos","inf_internet","inf_link_dados","cftv_mesa","cftv_botoeira_cco"]));
});
test("cálculo com lista nominal: status por unidade define total e pendências",()=>{
 const unidades=gerarNomes("CF",150).map((nome,i)=>({id:"u"+i,nome,status:i<10?"inoperante":i<14?"parcial":"operante"}));
 expect(calcularFamilia({total:1,unidades})).toMatchObject({total:150,inoperante:10,parcial:4,operante:136,disponibilidade:90.7});
 expect(()=>calcularFamilia({unidades:[{id:"a",nome:"A",status:"quebrada"}]})).toThrow(/Status/);
 expect(calcularInspecao({itens:[{unidades:[{id:"a",nome:"A"},{id:"b",nome:"B",status:"inoperante"}]}]}).disponibilidadeGeral).toBe(50);
});
test("gerarNomes: prefixo, sequência e zeros à esquerda",()=>{
 expect(gerarNomes("CF",3)).toEqual(["CF01","CF02","CF03"]);
 expect(gerarNomes("CF",150)[0]).toBe("CF001");expect(gerarNomes("CF",150)[149]).toBe("CF150");
 expect(gerarNomes("",2)).toEqual(["01","02"]);
});
const clone=x=>JSON.parse(JSON.stringify(x));
function banco(){
 const values={"usuarios/g":{active:true,role:"gerente",scopeAll:true}};let v=0;
 const ref=path=>({path,collection:n=>({doc:id=>ref(path+"/"+n+"/"+id)}),get:async()=>snap(path)});
 const snap=p=>({exists:values[p]!=null,data:()=>values[p]==null?undefined:clone(values[p])});
 return {values,collection:n=>({doc:id=>ref(n+"/"+id)}),runTransaction:async fn=>{let pend;const r=await fn({get:async x=>snap(x.path),set:(x,d)=>{pend=[x.path,clone(d)];}});if(pend){values[pend[0]]=pend[1];v++;}return r;}};
}
const u={uid:"g",role:"gerente",scopeAll:true};
const create={acao:"criar",pid:"sg_v2",revisao:0,data:{nome:"Cliente X",responsavel:"G",dataVistoria:"2026-10-13"}};
const lista=n=>gerarNomes("CF",n).map((nome,i)=>({id:"cf"+i,nome}));
test("servidor: cenário com lista nominal e vistoria com status por unidade",async()=>{
 const db=banco();await executar(db,u,create);
 const r=await executar(db,u,{acao:"ativos",pid:"sg_v2",revisao:1,data:{ativos:[{id:"cftv_fixas",familiaId:"cftv_fixas",nome:"Câmeras fixas",grupo:"CFTV e CCO",total:999,unidades:lista(5)},{id:"vei_cancelas",familiaId:"vei_cancelas",nome:"Cancelas comuns",grupo:"Veículos",total:3}]}});
 expect(r.data.ativos[0].total).toBe(5);
 const i=await executar(db,u,{acao:"inspecao",pid:"sg_v2",inspecaoId:"i1",revisao:0,data:{cenarioRevisao:2,data:"2026-10-13",responsavel:"G",estado:"concluida",itens:[{id:"cftv_fixas",unidades:[{id:"cf0",status:"inoperante",desde:"2026-10-01",nota:"Sem imagem"},{id:"cf1",status:"parcial"}]},{id:"vei_cancelas",parcial:1,inoperante:0}]}});
 const cam=i.data.itens[0];
 expect(cam).toMatchObject({total:5,inoperante:1,parcial:1,operante:3});
 expect(cam.unidades[0]).toMatchObject({nome:"CF01",status:"inoperante",nota:"Sem imagem"});
 expect(cam.unidades[4].status).toBe("operante");
 expect(i.data.itens[1]).toMatchObject({total:3,parcial:1});
});
test("servidor rejeita unidade fora do cenário, nome repetido e status inválido",async()=>{
 const db=banco();await executar(db,u,create);
 const rep=[{id:"a",nome:"CF01"},{id:"a",nome:"CF02"}];
 await expect(executar(db,u,{acao:"ativos",pid:"sg_v2",revisao:1,data:{ativos:[{id:"x",nome:"X",grupo:"G",total:2,unidades:rep}]}})).rejects.toMatchObject({status:400});
 await executar(db,u,{acao:"ativos",pid:"sg_v2",revisao:1,data:{ativos:[{id:"x",nome:"X",grupo:"G",total:2,unidades:lista(2)}]}});
 const base={acao:"inspecao",pid:"sg_v2",inspecaoId:"i",revisao:0,data:{cenarioRevisao:2,data:"2026-10-13",responsavel:"G",estado:"rascunho"}};
 await expect(executar(db,u,{...base,data:{...base.data,itens:[{id:"x",unidades:[{id:"zzz",status:"parcial"}]}]}})).rejects.toMatchObject({status:400});
 await expect(executar(db,u,{...base,data:{...base.data,itens:[{id:"x",unidades:[{id:"cf0",status:"quebrada"}]}]}})).rejects.toMatchObject({status:400});
});
test("PDF agrupa por grupo e lista pendências por unidade",()=>{
 const html=htmlSingle({nome:"Cliente X",id:"sg_v2"},{id:"i",data:"2026-10-13",responsavel:"G",estado:"concluida",itens:[{id:"c",nome:"Câmeras fixas",grupo:"CFTV e CCO",total:2,unidades:[{id:"a",nome:"CF01",status:"inoperante",desde:"2026-10-01",nota:"Sem imagem"},{id:"b",nome:"CF02",status:"operante"}]}]});
 expect(html).toContain("CFTV e CCO");expect(html).toContain("Pendências por unidade");expect(html).toContain("CF01");expect(html).toContain("Sem imagem");expect(html).not.toContain(">CF02<");
});
test("passo 1: marcar o item cria a lista com quantidade; desmarcar remove; nomes são opcionais e a quantidade continua editável",async()=>{
 global.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
 let assets=[];const catalog={familias:familias.slice(0,3).map(f=>({...f})),revisao:0};
 const Harness=()=>{const [a,setA]=React.useState([]);assets=a;return <CenarioAtivos catalog={catalog} assets={a} setAssets={setA} disabled={false}/>;};
 const set=async(el,val)=>{await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,val);el.dispatchEvent(new Event("input",{bubbles:true}));});};
 const click=async t=>{const el=[...host.querySelectorAll("button")].find(b=>b.textContent.includes(t));expect(el).toBeDefined();await act(async()=>el.dispatchEvent(new MouseEvent("click",{bubbles:true})));};
 const marcar=async nome=>{await act(async()=>host.querySelector('input[aria-label="Tem '+nome+'"]').dispatchEvent(new MouseEvent("click",{bubbles:true})));};
 const confirmar=jest.spyOn(window,"confirm").mockReturnValue(true);
 try{
  await act(async()=>root.render(<Harness/>));
  // nada marcado: nada existe e nenhum campo de quantidade aparece
  expect(assets).toEqual([]);expect(host.querySelectorAll('input[aria-label^="Quantidade"]').length).toBe(0);
  expect(host.textContent).toContain("Nenhum item marcado");
  await marcar("Torniquetes");
  expect(assets).toHaveLength(1);expect(assets[0]).toMatchObject({id:"ped_torniquetes",total:1});
  const qtd=host.querySelector('input[aria-label="Quantidade Torniquetes"]');expect(qtd).not.toBeNull();
  await set(qtd,"4");expect(assets[0].total).toBe(4);
  expect(host.textContent).toContain("1 item(ns) marcado(s)");expect(host.textContent).toContain("4 ativo(s)");
  // não há status (operante/parcial/inoperante) no passo 1
  expect(host.textContent).not.toMatch(/Inoperante|Parcial/);
  await click("Dar nome às unidades");
  await click("Gerar 4 nome(s)");
  expect(assets[0].unidades.map(x=>x.nome)).toEqual(["Torniquetes 01","Torniquetes 02","Torniquetes 03","Torniquetes 04"]);expect(assets[0].total).toBe(4);
  // quantidade segue editável com a lista: aumenta continuando a sequência, diminui tirando do fim
  await set(host.querySelector('input[aria-label="Quantidade Torniquetes"]'),"6");
  expect(assets[0].unidades.map(x=>x.nome).slice(4)).toEqual(["Torniquetes 05","Torniquetes 06"]);expect(assets[0].total).toBe(6);
  await set(host.querySelector('input[aria-label="Quantidade Torniquetes"]'),"2");
  expect(assets[0].unidades).toHaveLength(2);
  await click("Apagar os nomes");expect(assets[0].unidades).toBeUndefined();expect(assets[0].total).toBe(2);
  await marcar("Torniquetes");expect(assets).toEqual([]);
 }finally{confirmar.mockRestore();await act(async()=>root.unmount());host.remove();}
});
