const {calcularFamilia,calcularInspecao,variacao}=require("./singleCalc");
test("CFTV: parcial não disponível; total geral ponderado",()=>{
 expect(calcularFamilia({total:100,parcial:4,inoperante:6})).toMatchObject({operante:90,disponibilidade:90});
 expect(calcularFamilia({total:8,inoperante:1})).toMatchObject({operante:7,disponibilidade:87.5});
 expect(calcularInspecao({itens:[{total:100,parcial:4,inoperante:6},{total:8,inoperante:1}]}).disponibilidadeGeral).toBe(89.8);
});
test("campos ausentes, total zero e entradas inválidas",()=>{
 expect(calcularInspecao().itens).toEqual([]);
 expect(calcularInspecao({itens:[{total:0}]}).disponibilidadeGeral).toBeNull();
 for(const x of [-1,1.2,Infinity,"abc"])expect(()=>calcularFamilia({total:x})).toThrow();
 expect(()=>calcularFamilia({total:2,parcial:2,inoperante:1})).toThrow(/ultrapassar/);
});
test("falhas em excesso avisam sem bloquear",()=>{
 expect(calcularFamilia({total:2,inoperante:1,falhas:[{qtd:2}]}).avisos).toHaveLength(1);
});
test("variação por família independente da ordem e custom id",()=>{
 const a={itens:[{familiaId:"cftv",total:100,inoperante:6,parcial:4}]};
 const b={itens:[{familiaId:"cftv",total:100,inoperante:10,parcial:0}]};
 expect(variacao(a,b)[0]).toMatchObject({inoperantes:-4,disponibilidade:0});
});
