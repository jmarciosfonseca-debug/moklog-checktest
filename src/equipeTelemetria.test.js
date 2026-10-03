// Telemetria de conflito/tempo no servidor da Equipe: caminho das chaves, nunca valores.
const {merge}=require('../api/ai/lib/equipeMerge');
const clone=x=>JSON.parse(JSON.stringify(x));
const colab=id=>({id,nome:'NOME PESSOAL '+id,historico:[],uniforme:{solicitacoes:[]}});
const base=()=>({colaboradores:[colab('a'),colab('b')],desligados:[]});
function falha(fn){try{fn();}catch(e){return e;}return null;}

test('conflito no mesmo slot informa o caminho do slot, sem nomes nem valores',()=>{
  const b=base(),ck=(l)=>({slotId:'sab_diurno',lider:l,em:'x'});
  const A=clone(b);A.checagemEquipe={alvo:'2026-10-03',checkins:[ck('Maria')]};
  const B=clone(b);B.checagemEquipe={alvo:'2026-10-03',checkins:[ck('João')]};
  const apos=merge(b,A,clone(b));
  const e=falha(()=>merge(b,B,apos));
  expect(e.status).toBe(409);expect(e.path).toBe('checagemEquipe/checkins[sab_diurno]');
  expect(JSON.stringify(e.path)).not.toMatch(/Maria|João/);
});
test('array sem id informa o caminho (chaves) e não os dados da pessoa',()=>{
  const b=base();b.colaboradores[0].ferias=[{inicio:'2026-01-01'}];
  const A=clone(b);A.colaboradores[0].ferias.push({inicio:'2026-02-01'});
  const C=clone(b);C.colaboradores[0].ferias.push({inicio:'2026-03-01'});
  const e=falha(()=>merge(b,A,C));
  expect(e.status).toBe(409);expect(e.path).toBe('/colaboradores[]/ferias[]');
  expect(e.path).not.toMatch(/NOME PESSOAL|\ba\b/);
});
test('mesma edição no mesmo campo de texto aponta o campo',()=>{
  const b=base(),A=clone(b),C=clone(b);A.colaboradores[0].nome='X';C.colaboradores[0].nome='Y';
  const e=falha(()=>merge(b,A,C));expect(e.status).toBe(409);expect(e.path).toMatch(/^\/colaboradores\[\]\/nome$/);
});
test('o endpoint registra tempo, tamanho e (em 409) o caminho; nada de dados pessoais',async()=>{
  jest.resetModules();
  const logs=[];jest.spyOn(console,'log').mockImplementation(m=>logs.push(m));
  jest.doMock('../api/ai/lib/accessAuth',()=>({verify:()=>({nivel:'admin'}),PROJECTS:['P601']}));
  jest.doMock('../api/ai/lib/firebaseAdmin',()=>({getDb:()=>({})}));
  const b=base(),A=clone(b),C=clone(b);A.colaboradores[0].nome='X';C.colaboradores[0].nome='Y';
  jest.doMock('../api/ai/lib/equipeMerge',()=>({save:async(_d,_p,bf,af)=>merge(bf,af,C)}));
  const handler=require('../api/equipe-save');
  const res=()=>({h:{},setHeader(){},status(s){this.code=s;return this;},json(v){this.body=v;return this;}});
  const r=res();await handler({method:'POST',headers:{authorization:'Bearer abc.def'},body:{pid:'P601',before:b,after:A}},r);
  expect(r.code).toBe(409);
  const l=JSON.parse(logs.find(x=>String(x).includes('equipeSave')));
  expect(l).toMatchObject({evt:'equipeSave',status:409,pid:'P601',nivel:'admin',conflitoEm:'/colaboradores[]/nome'});
  expect(typeof l.ms).toBe('number');expect(l.kbIn).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(l)).not.toMatch(/NOME PESSOAL|"X"|"Y"/);
  console.log.mockRestore();
});

test('R4: o caminho do conflito NUNCA leva valores da entrada (slot, chave dinâmica, nome, CPF)',()=>{
  const b={colaboradores:[{id:'a',nome:'N',uniforme:{itens:{'Maria da Silva 123.456.789-00':{x:1}}}}],desligados:[]};
  const A=clone(b);A.colaboradores[0].uniforme.itens['Maria da Silva 123.456.789-00'].x=2;
  const C=clone(b);C.colaboradores[0].uniforme.itens['Maria da Silva 123.456.789-00'].x=3;
  const e1=falha(()=>merge(b,A,C));expect(e1.status).toBe(409);
  expect(e1.path).not.toMatch(/Maria|Silva|123|-00/);expect(e1.path).toContain('*');
  const ck=(l)=>({slotId:'João Souza 111.222.333-44',lider:l,em:'x'});
  const A2=clone(b);A2.checagemEquipe={alvo:'2026-10-03',checkins:[ck('A')]};
  const C2=clone(b);C2.checagemEquipe={alvo:'2026-10-03',checkins:[ck('B')]};
  const e2=falha(()=>merge(b,A2,C2));expect(e2.path).toBe('checagemEquipe/checkins[?]');
  expect(e2.path).not.toMatch(/João|Souza|111/);
});
test('R4: slots conhecidos continuam aparecendo para o diagnóstico',()=>{
  const b=base(),ck=(l)=>({slotId:'dom_noturno',lider:l,em:'x'});
  const A=clone(b);A.checagemEquipe={alvo:'2026-10-03',checkins:[ck('A')]};const C=clone(b);C.checagemEquipe={alvo:'2026-10-03',checkins:[ck('B')]};
  expect(falha(()=>merge(b,A,C)).path).toBe('checagemEquipe/checkins[dom_noturno]');
});
test('R4: caminho longo é truncado',()=>{
  const profundo=n=>n===0?{v:1}:{colaboradores:[profundo(n-1)]};
  const b={x:profundo(60)},A=clone(b),C=clone(b);let a=A.x,c=C.x;while(a.colaboradores){a=a.colaboradores[0];c=c.colaboradores[0];}a.v=2;c.v=3;
  const e=falha(()=>merge(b,A,C));expect(e&&e.path.length).toBeLessThanOrEqual(160);
});
