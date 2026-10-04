import { calendarioCampanha, campanhaDisponivel, valorCampanhaCentavos, totalCampanha, CAMPANHAS } from './campanhasEquipe';
import { gerarPDFCestaNatal } from './pdfSolicitacoes';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CampanhaEquipeControle from './CampanhaEquipeControle';
const {save}=require('../api/ai/lib/equipeMerge');

test.each([
 ['2026-02-01T02:59:59Z',null], ['2026-02-01T03:00:00Z','pascoa'],
 ['2026-04-01T02:59:59Z','pascoa'], ['2026-04-01T03:00:00Z',null],
 ['2026-10-01T02:59:59Z',null], ['2026-10-01T03:00:00Z','natal'],
 ['2026-12-01T02:59:59Z','natal'], ['2026-12-01T03:00:00Z',null],
 ['2027-02-01T03:00:00Z','pascoa'], ['2027-10-01T03:00:00Z','natal'],
])('calendário Brasília %s → %s',(iso,tipo)=>expect(calendarioCampanha(new Date(iso)).tipo).toBe(tipo));
test('ocultar é por tipo e ano; não afeta ciclo seguinte nem apaga registros',()=>{
 const config={natal_2026:{oculta:true,valorCentavos:12550}};
 expect(campanhaDisponivel(new Date('2026-10-10T12:00:00Z'),config).disponivel).toBe(false);
 expect(campanhaDisponivel(new Date('2027-10-10T12:00:00Z'),config).disponivel).toBe(true);
 expect(campanhaDisponivel(new Date('2027-02-10T12:00:00Z'),config).disponivel).toBe(true);
 expect(CAMPANHAS.natal.colecao).toBe('cestaNatal'); expect(CAMPANHAS.pascoa.colecao).toBe('ovoPascoa');
});
test('preço BR e cálculo em centavos, sem confundir vazio e zero',()=>{
 expect(valorCampanhaCentavos('1.250,50')).toBe(125050);
 expect(valorCampanhaCentavos('0')).toBe(0);
 for(const s of ['','-1','1,234','abc','1.2','1000001'])expect(valorCampanhaCentavos(s)).toBeNull();
 expect(totalCampanha(3,1001)).toBe(30.03); expect(totalCampanha(3,null)).toBeNull();
});
const base={colaboradores:[],desligados:[],checagemEquipe:{alvo:'2026-10-03',checkins:[]}};
function banco(){const set=jest.fn();return {set,collection:()=>({doc:()=>({})}),runTransaction:fn=>fn({get:async()=>({exists:true,data:()=>base}),set})};}
test('API bloqueia líder e aceita gerencial, preservando dados existentes',async()=>{
 const next={...base,campanhasSazonais:{natal_2026:{valorCentavos:15050,oculta:false}}};
 await expect(save(banco(),'P601',base,next,{nivel:'lider'})).rejects.toMatchObject({status:403});
 const db=banco();expect(await save(db,'P601',base,next,{nivel:'admin'})).toEqual(next);
 for(const v of [-1,1.5,100000001,'10'])await expect(save(banco(),'P601',base,{...next,campanhasSazonais:{natal_2026:{valorCentavos:v}}},{nivel:'admin'})).rejects.toMatchObject({status:400});
});
test('PDF lista nomes escapados, quantidade e custo correto; Páscoa não vira Natal',()=>{
 const OldBlob=global.Blob; let html='';global.Blob=class{constructor(parts){html=parts.join('');}};
 global.URL.createObjectURL=jest.fn(()=> 'blob:teste');global.URL.revokeObjectURL=jest.fn();
 const click=jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 try{
  gerarPDFCestaNatal({id:'P601'},[{nome:'Teste <A>'},{nome:'Teste B'}],2027,{tipo:'pascoa',valorCentavos:12345});
  expect(html).toContain('Ovo de Páscoa 2027');expect(html).toContain('Teste &lt;A&gt;');expect(html).not.toContain('Cesta de Natal');
  expect(html).toContain('246,90');expect(html).toContain('123,45');expect(html).toContain('2 unidade(s)');
 }finally{global.Blob=OldBlob;click.mockRestore();}
});
test('controle desabilita PDF com valor não salvo e carrega total salvo',async()=>{
 global.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');const root=createRoot(host);
 await act(async()=>root.render(<CampanhaEquipeControle tipo="natal" ano={2026} quantidade={3} config={{valorCentavos:1001}} onSalvar={jest.fn()} onPDF={jest.fn()}/>));
 expect(host.textContent).toContain('30,03');expect([...host.querySelectorAll('button')].find(b=>b.textContent.startsWith('Gerar PDF')).disabled).toBe(false);
 await act(async()=>root.unmount());
});
