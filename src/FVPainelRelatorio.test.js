import {gerarPDFProjetoFV} from './FVPainel';
import {serieMensal,saldoHistorico,projecao,resumoPeriodo,totalReservas} from './fvPlano';

test('relatório completo preserva escape, recorrentes, eventos e impressão PDF',()=>{
 const ref=new Date('2026-10-01T12:00:00Z');
 const plano={creditoMensal:6022.08,vtMensal:9.31,amMensal:2009.17,recorrentes:[{id:'cafe',descricao:'Café',valor:250,ativo:true}],lancamentos:[{id:'kits',tipo:'debito',descricao:'12 kits <script>',mes:'2027-03',realizado:false,vinculo:'catalogo',itemId:'kit',qtd:12},{id:'ovo',tipo:'reserva',descricao:'Ovo de Páscoa',valor:2500,mes:'2027-04',realizado:false}]};
 const ctx={qtdCestas:0,catalogo:[{id:'kit',nome:'Kit uniforme',valor:650}]};
 const resumo={saldoAtual:62036.93,sincronizadoEm:ref.toISOString()},serie=serieMensal([],12,ref),real=saldoHistorico(resumo.saldoAtual,serie);
 const proj=projecao({saldoAtual:resumo.saldoAtual,plano,lancamentos:[],ctx,ref});
 let html='';const open=jest.spyOn(window,'open').mockReturnValue({document:{open(){},write(v){html=v;},close(){}}});
 gerarPDFProjetoFV({pid:'P260A',nome:'Jatinox',resumo,real,serie,proj,plano,ctx,reservas:totalReservas(plano,ctx),periodo:resumoPeriodo([],12,ref)});
 expect(html).toContain('6. Projeção mês a mês');expect(html).toContain('Gastos previstos 12 meses');
 expect(html).toContain('Café');expect(html).toContain('7.800,00');expect(html).toContain('Ovo de Páscoa');
 expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('12 kits <script>');
 expect(html).toContain('window.print()');expect(html).toContain('@page{size:A4');
 open.mockRestore();
});
