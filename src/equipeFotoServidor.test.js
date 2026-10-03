const {validar,criarFoto,idDe,sha,MAX_CHARS}=require('../api/ai/lib/equipeFoto');
const JPG=n=>'data:image/jpeg;base64,'+'A'.repeat(n);
const PROJ=['P601','P602'];
function bancoFake(){const docs={};const col=p=>({doc:id=>({
  create:async d=>{const k=p+'/'+id;if(docs[k]){const e=new Error('6 ALREADY_EXISTS: Document already exists');e.code=6;throw e;}docs[k]=JSON.parse(JSON.stringify(d));},
  get:async()=>({exists:!!docs[p+'/'+id],data:()=>docs[p+'/'+id]})})});
 return {docs,collection:()=>({doc:pid=>({collection:()=>col('equipes/'+pid+'/fotos')})})};}
test('validar: projeto, colaborador e foto',()=>{
 expect(()=>validar({pid:'P601',colabId:'c1',dataUrl:JPG(10)},PROJ)).not.toThrow();
 expect(()=>validar({pid:'PXXX',colabId:'c1',dataUrl:JPG(10)},PROJ)).toThrow(/Projeto/);
 expect(()=>validar({pid:'P601',colabId:'../x',dataUrl:JPG(10)},PROJ)).toThrow(/Colaborador/);
 expect(()=>validar({pid:'P601',colabId:'c1',dataUrl:'data:text/html;base64,AAAA'},PROJ)).toThrow(/Foto/);
 expect(()=>validar({pid:'P601',colabId:'c1',dataUrl:JPG(MAX_CHARS)},PROJ)).toThrow(/muito grande/);
 expect(()=>validar({pid:'P601',colabId:'c1',dataUrl:'data:image/jpeg;base64,<script>'},PROJ)).toThrow(/Foto/);
});
test('criarFoto: id vem do conteúdo; criar de novo a MESMA foto é idempotente; foto diferente nunca sobrescreve',async()=>{
 const db=bancoFake(),a=JPG(50),b=JPG(60);
 const r1=await criarFoto(db,{pid:'P601',colabId:'c1',dataUrl:a});
 expect(r1).toEqual({id:'c1-'+sha(a).slice(0,16),criada:true});
 expect(await criarFoto(db,{pid:'P601',colabId:'c1',dataUrl:a})).toEqual({id:r1.id,criada:false});
 const r2=await criarFoto(db,{pid:'P601',colabId:'c1',dataUrl:b});
 expect(r2.id).not.toBe(r1.id);
 expect(Object.keys(db.docs)).toHaveLength(2);                         // as duas fotos existem; nenhuma foi sobrescrita
 expect(db.docs['equipes/P601/fotos/'+r1.id].data).toBe(a);
});
test('colisão de hash (mesmo id, conteúdo diferente) recusa com 409 e preserva a original',async()=>{
 const db=bancoFake(),a=JPG(50),id=idDe('c1',a);
 db.docs['equipes/P601/fotos/'+id]={data:JPG(51)};
 await expect(criarFoto(db,{pid:'P601',colabId:'c1',dataUrl:a})).rejects.toMatchObject({status:409});
 expect(db.docs['equipes/P601/fotos/'+id].data).toBe(JPG(51));
});
test('erro de infraestrutura não é mascarado',async()=>{
 const db={collection:()=>({doc:()=>({collection:()=>({doc:()=>({create:async()=>{throw new Error('rede');}})})})})};
 await expect(criarFoto(db,{pid:'P601',colabId:'c1',dataUrl:JPG(5)})).rejects.toThrow('rede');
});
describe('endpoint /api/equipe-foto',()=>{
 let handler,verify,criar;
 const res=()=>({code:0,body:null,setHeader(){},status(c){this.code=c;return this;},json(v){this.body=v;return this;}});
 beforeEach(()=>{jest.resetModules();verify=jest.fn();criar=jest.fn(async()=>({id:'c1-abc',criada:true}));
  jest.doMock('../api/ai/lib/accessAuth',()=>({verify:(...a)=>verify(...a),PROJECTS:['P601','P602']}));
  jest.doMock('../api/ai/lib/firebaseAdmin',()=>({getDb:()=>({})}));
  jest.doMock('../api/ai/lib/equipeFoto',()=>({...jest.requireActual('../api/ai/lib/equipeFoto'),criarFoto:(...a)=>criar(...a)}));
  handler=require('../api/equipe-foto');});
 const chamar=async(body,h={authorization:'Bearer tok'},method='POST')=>{const r=res();await handler({method,headers:h,body},r);return r;};
 const ok={pid:'P601',colabId:'c1',dataUrl:JPG(40)};
 test('sem sessão 401; demo/ronda 403; método errado 405',async()=>{
  verify.mockReturnValue(null);expect((await chamar(ok)).code).toBe(401);
  verify.mockReturnValue({nivel:'demo'});expect((await chamar(ok)).code).toBe(403);
  verify.mockReturnValue({nivel:'ronda',pid:'P601'});expect((await chamar(ok)).code).toBe(403);
  expect((await chamar(ok,{},'GET')).code).toBe(405);expect(criar).not.toHaveBeenCalled();
 });
 test('líder só grava no próprio projeto; gerencial em qualquer',async()=>{
  verify.mockReturnValue({nivel:'lider',pid:'P602'});expect((await chamar(ok)).code).toBe(403);expect(criar).not.toHaveBeenCalled();
  verify.mockReturnValue({nivel:'lider',pid:'P601'});let r=await chamar(ok);expect(r.code).toBe(200);expect(r.body).toEqual({ok:true,ref:'c1-abc'});
  verify.mockReturnValue({nivel:'admin'});r=await chamar({...ok,pid:'P602'});expect(r.code).toBe(200);
 });
 test('foto inválida 400 e projeto inexistente 403, sem gravar',async()=>{
  verify.mockReturnValue({nivel:'admin'});
  expect((await chamar({...ok,dataUrl:'texto'})).code).toBe(400);expect((await chamar({...ok,pid:'P999'})).code).toBe(403);expect(criar).not.toHaveBeenCalled();
 });
 test('JSON inválido 400 e falha interna 503 sem vazar detalhe',async()=>{
  verify.mockReturnValue({nivel:'admin'});expect((await chamar('{x')).code).toBe(400);
  criar.mockRejectedValueOnce(new Error('segredo interno'));const r=await chamar(ok);expect(r.code).toBe(503);expect(JSON.stringify(r.body)).not.toContain('segredo');
 });
});
