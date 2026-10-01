import {projecao,totalReservas} from './fvPlano';
test('treinamento anual 8000 e cesta 1800 reduzem projeção uma única vez',()=>{
 const plano={creditoMensal:5000,vtMensal:1000,amMensal:0,lancamentos:[{id:'treino',tipo:'reserva',valor:8000,mes:'2026-11',realizado:false},{id:'cesta',tipo:'debito',valor:1800,mes:'2026-12',realizado:false}]};
 const p=projecao({saldoAtual:10000,plano,lancamentos:[],ref:new Date('2026-10-01T12:00:00Z')});
 expect(p.serie).toHaveLength(12);expect(p.serie[0].extra).toBe(-8000);expect(p.serie[1].extra).toBe(-1800);
 expect(p.serie.reduce((n,x)=>n+x.extra,0)).toBe(-9800);expect(p.saldoFinal).toBe(48200);expect(totalReservas(plano)).toBe(8000);
 plano.lancamentos[0].realizado=true;
 expect(totalReservas(plano)).toBe(0);expect(projecao({saldoAtual:10000,plano,lancamentos:[],ref:new Date('2026-10-01T12:00:00Z')}).saldoFinal).toBe(56200);
});
