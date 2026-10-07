import { topPlacas } from './bolsaoRegras';
import { gerarBolsaoHtml } from './bolsaoRelatorio';
const av = (placa, total, dias=1, hora=12) => Array.from({length:total},(_,i)=>({p:{placa,diasConsecutivos:dias,status:'normal'},ts:`2026-10-07T${hora}:00:${String(i).padStart(2,'0')}Z`}));
test('top limita cinco e desempata por dias e recência sem mutar entrada',()=>{
 const entrada=[...av('A',20),...av('B',10,3),...av('C',10,4),...av('D',10,4,13),...av('E',3),...av('F',1)];
 const copia=JSON.stringify(entrada);
 expect(topPlacas(entrada).map(p=>p.placa)).toEqual(['A','D','C','B','E']);
 expect(JSON.stringify(entrada)).toBe(copia);
 expect(topPlacas(entrada)[0].ultimasDatas).toHaveLength(15);
 expect(topPlacas(entrada)[0].ultimasDatas[0]).toBe('2026-10-07T12:00:19Z');
 expect(topPlacas(entrada)[0].ultimasDatas[14]).toBe('2026-10-07T12:00:05Z');
});
test('menos de cinco, vazio e data inválida',()=>{
 expect(topPlacas(av('A',1))).toHaveLength(1);
 expect(topPlacas([])).toEqual([]);
 expect(topPlacas([{p:{placa:'A'},ts:'invalida'}])).toEqual([]);
});
test.each(['P311A','P311B'])('resumo %s entre KPIs e ranking com datas locais e excedente',id=>{
 const html=gerarBolsaoHtml({project:{id},placas:{A:{placa:'A',status:'normal',sightings:av('A',20).map(({ts})=>({ts}))}}});
 expect(html.indexOf('Top 5 —')).toBeGreaterThan(html.indexOf('Placas únicas'));
 expect(html.indexOf('Top 5 —')).toBeLessThan(html.indexOf('Ranking de recorrência'));
 expect(html).toContain('07/10 09:00');expect(html).toContain('… (+5)');
 expect(html).toContain('overflow-wrap:anywhere');
});
test('P505 miniaturas, legenda e sem resumo externo',()=>{
 const html=gerarBolsaoHtml({project:{id:'P505'},checagens:[{data:'2026-10-07',hora:'09:00',lider:'Ronda teste',fotos:['data:image/png;base64,AAAA']}]});
 expect(html).toContain('height:100px;object-fit:cover');
 expect(html).toContain('class="bol-fotos-grid"');expect(html).toContain('Ronda teste');
 expect(html).not.toContain('Top 5 —');
});
