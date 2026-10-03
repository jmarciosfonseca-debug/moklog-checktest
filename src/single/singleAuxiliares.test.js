import {anteriorConcluida,fmtVariacao,dataBR} from "./singleCalc";
import {htmlSingle} from "./pdfSingle";
const h=[{id:"a",data:"2026-09-26",estado:"concluida",criadoEm:"1"},{id:"b",data:"2026-10-01",estado:"rascunho",criadoEm:"2"},{id:"c",data:"2026-09-30",estado:"concluida",criadoEm:"3"},{id:"d",data:"2026-10-03",estado:"concluida",criadoEm:"4"}];
test("vistoria anterior = última CONCLUÍDA de data anterior (rascunho e a própria não contam)",()=>{
 expect(anteriorConcluida(h,{id:"novo",data:"2026-10-05"}).id).toBe("d");
 expect(anteriorConcluida(h,{id:"d",data:"2026-10-03"}).id).toBe("c");      // b é rascunho: ignorado
 expect(anteriorConcluida(h,{id:"x",data:"2026-09-26"})).toBeNull();          // mesma data não compara
 expect(anteriorConcluida(undefined,{id:"x",data:"2026-10-05"})).toBeNull();
});
test("variação em pontos percentuais com sinal e vírgula",()=>{
 expect(fmtVariacao(7)).toBe("+7,0 p.p.");expect(fmtVariacao(-2.5)).toBe("−2,5 p.p.");expect(fmtVariacao(0)).toBe("0,0 p.p.");
 expect(fmtVariacao(null)).toBe("—");expect(fmtVariacao(undefined)).toBe("—");expect(fmtVariacao(NaN)).toBe("—");
});
test("datas em formato brasileiro",()=>{expect(dataBR("2026-10-03")).toBe("03/10/2026");expect(dataBR("")).toBe("");expect(dataBR("texto")).toBe("texto");});
test("relatório: data BR, estado com acento, sem expor o identificador interno e variação formatada",()=>{
 const itens=[{id:"c",familiaId:"cftv_cameras",nome:"CFTV",total:100,parcial:4,inoperante:6,falhas:[{qtd:6,descricao:"Sem sinal",criticidade:"alta",desde:"2026-10-02"}]}];
 const atual={id:"i2",data:"2026-10-10",responsavel:"Equipe",estado:"concluida",itens};
 const ant={id:"i1",data:"2026-10-03",estado:"concluida",itens:[{...itens[0],inoperante:10}]};
 const html=htmlSingle({nome:"Cliente",id:"sg_cliente_abc123"},atual,ant);
 expect(html).toContain("10/10/2026");expect(html).toContain("Desde 02/10/2026");expect(html).toContain("Concluída");
 expect(html).not.toContain("sg_cliente_abc123");expect(html).toContain("+4,0 p.p.");expect(html).not.toContain("2026-10-10");
 expect(htmlSingle({nome:"C",id:"sg_x",codigo:"MK-9"},atual)).toContain("MK-9");
});
test("sem vistoria anterior (null) o cálculo e a variação não quebram",()=>{
 const {calcularInspecao,variacao}=require("./singleCalc");
 expect(calcularInspecao(null).itens).toEqual([]);
 expect(variacao({itens:[{id:"a",familiaId:"a",total:10,parcial:0,inoperante:1}]},null)).toEqual([{id:"a",inoperantes:null,disponibilidade:null}]);
});
