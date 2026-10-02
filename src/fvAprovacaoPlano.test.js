import {valorLanc,projecao} from './fvPlano';
import {UNIFORME_NOMES} from './uniformeCatalogo';
test('aprovação sem preço passa a valer quando catálogo é mapeado; realizado conserva preço',()=>{
 const l={id:'ap_a',vinculo:'aprovacao',tipo:'debito',item:'Camisa / Camisão',qtd:2,semPreco:true,mes:'2026-11',realizado:false};
 expect(valorLanc(l,{catalogo:[]})).toBe(0);
 const ctx={catalogo:[{id:'camisa',nome:'Camisa',equipeItem:'Camisa / Camisão',valor:150}]};
 expect(valorLanc(l,ctx)).toBe(300);ctx.catalogo[0].valor=200;expect(valorLanc(l,ctx)).toBe(400);
 const realizado={...l,realizado:true,valorUnit:150};expect(valorLanc(realizado,ctx)).toBe(300);
 const plano={creditoMensal:0,vtMensal:0,amMensal:0,lancamentos:[realizado]};expect(projecao({saldoAtual:1000,plano,ctx,lancamentos:[],ref:new Date('2026-10-01T12:00Z')}).saldoFinal).toBe(1000);
 expect(UNIFORME_NOMES).toContain('Camisa / Camisão');expect(UNIFORME_NOMES).toContain('Sapato / Coturno');expect(new Set(UNIFORME_NOMES).size).toBe(UNIFORME_NOMES.length);
});
test('catálogo manual realizado também preserva valorUnit histórico',()=>{expect(valorLanc({vinculo:'catalogo',itemId:'kit',qtd:12,realizado:true,valorUnit:650},{catalogo:[{id:'kit',valor:800}]})).toBe(7800);});
