import { normalizarInquilino, placasObservadas, placaDias, reguaOcupacao, internoExterno, percentualPorInquilino, bolsaoTipo } from './bolsaoRegras';
import { gerarBolsaoHtml } from './bolsaoRelatorio';

const rondas = [
 {data:'2026-10-01',hora:'08:00',criadoEm:'2026-10-01T11:00:00Z',lider:'Líder teste',tipo:'interno',itens:[{placa:'AAA0001',inquilino:'GAT logística'},{placa:'BBB0002',inquilino:'Chama'}],fotos:['data:image/png;base64,AAAA']},
 {data:'2026-10-01',hora:'10:00',tipo:'interno',itens:[{placa:'AAA0001',inquilino:'Gat Logística'}]},
 {data:'2026-10-03',hora:'08:00',tipo:'externo',itens:[{placa:'AAA0001',inquilino:'GAT Logística'}]}
];
test.each(['GAT Logística',' Gat   logística ','GAT'])('normaliza %s', s=>expect(normalizarInquilino(s)).toBe('GAT Logística'));
test.each(['Kuehne+Nagel','Kuehne+ Nagel','Kuehne+Nagel Serviços Logísticos Ltda'])('normaliza %s', s=>expect(normalizarInquilino(s)).toBe('Kuehne+Nagel'));
test('Chama alias',()=>expect(normalizarInquilino('Chama Supermercados')).toBe('Chama'));
test('placa dias não duplica ronda no mesmo dia nem interpola lacunas',()=>expect(placaDias(placasObservadas({},rondas)[0])).toBe(2));
test('régua ordenada, quantidade e percentual',()=>{
 const p=placasObservadas({},rondas), r=reguaOcupacao(p);
 expect(r).toEqual([{inquilino:'GAT Logística',numPlacas:1,placaDias:2,pct:67},{inquilino:'Chama',numPlacas:1,placaDias:1,pct:33}]);
 expect(percentualPorInquilino(p).map(x=>x.pct)).toEqual([50,50]);
 expect(internoExterno(p).reduce((n,x)=>n+x.quantidade,0)).toBe(2);
});
test('aliases de placa unidos',()=>expect(placasObservadas({AAA0001:{placa:'AAA0001',aliases:['AAAOOO1']}},[{...rondas[0],itens:[{placa:'AAA0001'},{placa:'AAAOOO1'}]}])).toHaveLength(1));
test('sem dados',()=>{expect(reguaOcupacao([])).toEqual([]);expect(internoExterno([]).every(x=>x.pct===0)).toBe(true);});
test('tipo desconhecido não vira externo',()=>expect(internoExterno([{placa:'A'}])[2].quantidade).toBe(1));
test('configuração de projeto',()=>{expect(bolsaoTipo({id:'P505'})).toBe('interno');expect(bolsaoTipo({id:'P311A'})).toBe('externo');expect(bolsaoTipo({id:'P311B',bolsaoTipo:'interno'})).toBe('interno');});
test('interno tem régua e fotos em nova página',()=>{
 const html=gerarBolsaoHtml({project:{id:'P505'},checagens:rondas});
 expect(html).toContain('Régua de ocupação'); expect(html).toContain('class="bol-fotos"');expect(html).toContain('page-break-before:always');expect(html).toContain('repeat(3,minmax(0,1fr))');expect(html).toContain('MK-BOLSAO-P505-20261001-20261003');expect(html).toContain('counter(pages)');
});
test('interno sem fotos não cria anexo vazio e filtra período',()=>{
 const html=gerarBolsaoHtml({project:{id:'P505'},checagens:rondas,periodo:{from:new Date('2026-10-03T03:00:00Z'),to:new Date('2026-10-04T02:59:59Z')}});
 expect(html).not.toContain('class="bol-fotos"');expect(html).not.toContain('BBB0002');
});
test.each(['P311A','P311B'])('externo %s sem inquilino nem régua',id=>{
 const html=gerarBolsaoHtml({project:{id},placas:{A:{placa:'AAA0001',inquilino:'SEGREDO',sightings:[{ts:'2026-10-01T12:00:00Z',registradoPor:'Teste'}]}}});
 expect(html).toContain('Fiscalização de Bolsão Externo');expect(html).not.toContain('SEGREDO');expect(html).not.toContain('Régua de ocupação');expect(html).not.toContain('class="bol-fotos"');
});
test('turno e 50 registros',()=>{
 const placas={A:{placa:'AAA0001',sightings:Array.from({length:60},()=>({ts:'2026-10-01T12:00:00Z',registradoPor:'OPERADOR_TESTE'}))}};
 const html=gerarBolsaoHtml({project:{id:'P311A'},placas,periodo:{turno:'Diurno'}});
 expect((html.match(/OPERADOR_TESTE/g)||[])).toHaveLength(50);
 expect(gerarBolsaoHtml({project:{id:'P311A'},placas,periodo:{turno:'Noturno'}})).not.toContain('OPERADOR_TESTE');
});
test('escapa texto e rejeita imagem executável',()=>{
 const html=gerarBolsaoHtml({project:{id:'P505',name:'<script>alert(1)</script>'},checagens:[{...rondas[0],lider:'<img onerror=x>',fotos:['javascript:alert(1)']}]});
 expect(html).not.toContain('<script>alert');expect(html).not.toContain('javascript:');expect(html).toContain('&lt;img onerror=x&gt;');
});
