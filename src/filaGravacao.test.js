import {criarFila} from './filaGravacao';
const {merge}=require('../api/ai/lib/equipeMerge');
const espera=ms=>new Promise(r=>setTimeout(r,ms));
const clone=x=>JSON.parse(JSON.stringify(x));

describe('criarFila',()=>{
  test('executa uma por vez, na ordem de chegada, mesmo quando a primeira é mais lenta',async()=>{
    const fila=criarFila(),log=[];let ativas=0,max=0;
    const tarefa=(n,ms)=>async()=>{ativas++;max=Math.max(max,ativas);log.push('início '+n);await espera(ms);log.push('fim '+n);ativas--;return n;};
    const r=await Promise.all([fila(tarefa(1,30)),fila(tarefa(2,1)),fila(tarefa(3,5))]);
    expect(r).toEqual([1,2,3]);expect(max).toBe(1);
    expect(log).toEqual(['início 1','fim 1','início 2','fim 2','início 3','fim 3']);
  });
  test('uma falha não trava as próximas e cada chamada recebe o próprio erro ou resultado',async()=>{
    const fila=criarFila();
    const a=fila(async()=>{throw Object.assign(Error('409'),{status:409});});
    const b=fila(async()=>'ok');
    await expect(a).rejects.toMatchObject({status:409});await expect(b).resolves.toBe('ok');
  });
  test('erro síncrono dentro da tarefa também é isolado',async()=>{
    const fila=criarFila();
    const a=fila(()=>{throw Error('x');});const b=fila(()=>2);
    await expect(a).rejects.toThrow('x');await expect(b).resolves.toBe(2);
  });
  test('conta as pendentes',async()=>{
    const fila=criarFila();let liberar;const trava=new Promise(r=>{liberar=r;});
    const a=fila(()=>trava),b=fila(async()=>1);
    expect(fila.pendentes()).toBe(2);liberar();await a;await b;expect(fila.pendentes()).toBe(0);
  });
});

// Simulação do caso visto em produção: o mesmo líder grava duas vezes seguidas o MESMO item;
// a 2ª gravação parte da tela otimista (já com a 1ª) e chega ao servidor antes da 1ª ser confirmada.
describe('conflito com a própria gravação anterior (servidor real de merge, ordem de chegada simulada)',()=>{
  const inicial={colaboradores:[{id:'c1',nome:'Ana',uniforme:{itens:{Camisa:{usa:false,tamanho:'M'}},solicitacoes:[]}}],desligados:[]};
  function servidor(){ let doc=clone(inicial);
    return {doc:()=>clone(doc),
      salvar:async(before,after,latencia)=>{await espera(latencia);doc=merge(before,after,doc);return clone(doc);}}; }
  const passo=(base,usa,tam)=>{const n=clone(base);n.colaboradores[0].uniforme.itens.Camisa={usa,tamanho:tam};return n;};
  test('SEM fila: troca o tamanho duas vezes (M→G→GG); a 2ª chega primeiro e dá 409 (padrão do log)',async()=>{
    const s=servidor(),b0=s.doc(),d1=passo(b0,false,'G'),d2=passo(d1,false,'GG');
    const r=await Promise.allSettled([s.salvar(b0,d1,40),s.salvar(d1,d2,5)]);   // 1ª lenta (função fria), 2ª rápida
    expect(r[1].status).toBe('rejected');expect(r[1].reason.status).toBe(409);
  });
  test('COM fila: as duas gravam, na ordem, sem conflito, e o resultado final é o da última ação',async()=>{
    const s=servidor(),fila=criarFila(),b0=s.doc(),d1=passo(b0,false,'G'),d2=passo(d1,false,'GG');
    const [r1,r2]=await Promise.all([fila(()=>s.salvar(b0,d1,40)),fila(()=>s.salvar(d1,d2,5))]);
    expect(r1.colaboradores[0].uniforme.itens.Camisa).toEqual({usa:false,tamanho:'G'});
    expect(r2.colaboradores[0].uniforme.itens.Camisa).toEqual({usa:false,tamanho:'GG'});
    expect(s.doc()).toEqual(r2);
  });
  test('SEM fila também há erro SILENCIOSO: marca e desmarca rápido; o servidor fica com "marcado" (a última ação foi desmarcar)',async()=>{
    const s=servidor(),b0=s.doc(),d1=passo(b0,true,'M'),d2=passo(d1,false,'M');
    await Promise.all([s.salvar(b0,d1,40),s.salvar(d1,d2,5)]);
    expect(s.doc().colaboradores[0].uniforme.itens.Camisa.usa).toBe(true);           // errado e sem nenhum aviso
    const s2=servidor(),fila=criarFila();
    await Promise.all([fila(()=>s2.salvar(b0,d1,40)),fila(()=>s2.salvar(d1,d2,5))]);
    expect(s2.doc().colaboradores[0].uniforme.itens.Camisa.usa).toBe(false);         // com fila: a última ação vale
  });
  test('COM fila e outra pessoa editando outro colaborador no meio: tudo se mescla',async()=>{
    const s=servidor(),fila=criarFila();
    const b0=s.doc();b0.colaboradores.push({id:'c2',nome:'Bia'});
    await s.salvar(s.doc(),b0,0);                                                // c2 existe no servidor
    const base=s.doc(),d1=passo(base,true,'G'),d2=passo(d1,true,'GG');
    const outra=clone(base);outra.colaboradores[1].nome='Bia Souza';
    const p=Promise.all([fila(()=>s.salvar(base,d1,20)),fila(()=>s.salvar(d1,d2,5))]);
    await s.salvar(base,outra,1);                                                // outra pessoa grava enquanto a fila anda
    await p;
    const fim=s.doc();
    expect(fim.colaboradores[0].uniforme.itens.Camisa).toEqual({usa:true,tamanho:'GG'});expect(fim.colaboradores[1].nome).toBe('Bia Souza');
  });
  test('a 1ª falha (sem rede): a 2ª NÃO ressuscita a mudança não salva',async()=>{
    const s=servidor(),fila=criarFila(),b0=s.doc(),d1=passo(b0,true,'M');
    const d2=clone(d1);d2.colaboradores[0].nome='Ana Paula';                    // 2ª ação mexe em outro campo
    const r=await Promise.allSettled([fila(async()=>{throw Object.assign(Error('rede'),{status:503});}),fila(()=>s.salvar(d1,d2,1))]);
    expect(r[0].status).toBe('rejected');expect(r[1].status).toBe('fulfilled');
    expect(s.doc().colaboradores[0]).toMatchObject({nome:'Ana Paula',uniforme:{itens:{Camisa:{usa:false}}}});
  });
});

test('telemetria: campo do item de uniforme aparece no caminho do conflito (o nome do item continua oculto)',()=>{
  const b={colaboradores:[{id:'a',nome:'N',uniforme:{itens:{'Camisa / Camisão':{usa:false}}}}],desligados:[]};
  const A=clone(b);A.colaboradores[0].uniforme.itens['Camisa / Camisão'].usa=true;
  const C=clone(b);C.colaboradores[0].uniforme.itens['Camisa / Camisão'].usa=null;
  let e;try{merge(b,A,C);}catch(x){e=x;}
  expect(e.status).toBe(409);expect(e.path).toMatch(/^\/colaboradores\[\]\/uniforme\/itens\/\*.*\/usa$/);expect(e.path).not.toContain('Camisa');
});

test('código: a Equipe passa toda gravação pela fila e volta à última versão confirmada em falha',()=>{
  const src=require('fs').readFileSync('src/Equipe.jsx','utf8');
  expect(src).toContain('filaRef.current(async()=>');expect(src).toContain('atualizarEquipeLocal(confirmadaRef.current||base)');
  expect(src.match(/saveEquipe\(/g).length).toBe(2);
});
