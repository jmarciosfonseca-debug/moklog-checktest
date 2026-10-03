#!/usr/bin/env node
// Somente leitura nesta etapa. Execução ficará bloqueada até aprovação do escopo e produção.
// node scripts/migracao/reabrir-aprovacoes.js [--pid P601]
// ADC de usuário local (gcloud), nunca chave de conta de serviço.
const inicio=Date.parse('2026-10-02T00:00:00-03:00');
const fim=Date.parse('2026-10-04T00:00:00-03:00');
function resumir(pid,equipe,plano={}){
 const r={pid,pendentesAprovadas:0,comToque:0,janelaTestes:0,foraJanela:0,dataInvalida:0,previstos:0,realizados:0,negados:0,entregues:0,itens:[]};
 for(const grupo of ['colaboradores','desligados'])for(const c of equipe[grupo]||[])for(const s of c.uniforme?.solicitacoes||[]){
  if(s.aprovacao==='negado')r.negados++;
  if(s.status==='entregue')r.entregues++;
  if(s.status!=='pendente'||s.aprovacao!=='aprovado')continue;
  r.pendentesAprovadas++;if(s.whatsEnviadoEm)r.comToque++;
  const t=s.aprovadoEm?Date.parse(s.aprovadoEm):NaN;
  const janela=Number.isFinite(t)?(t>=inicio&&t<fim?'testes':'fora'):'data-invalida';
  r[janela==='testes'?'janelaTestes':janela==='fora'?'foraJanela':'dataInvalida']++;
  const ls=(plano.lancamentos||[]).filter(l=>l.vinculo==='aprovacao'&&l.id==='ap_'+s.id&&l.colabId===c.id);
  const previstos=ls.filter(l=>!l.realizado).length,realizados=ls.filter(l=>l.realizado).length;
  r.previstos+=previstos;r.realizados+=realizados;
  r.itens.push({colabId:c.id,solicId:s.id,colaborador:c.nome||'',item:s.item||'',grupo,aprovadoEm:s.aprovadoEm||null,janela,temToque:!!s.whatsEnviadoEm,previstos,realizados});
 }
 return r;
}
async function main(){
 const args=process.argv.slice(2);
 if(args.some(a=>a!=='--pid'&&!/^P\d{3}[A-C]?$/.test(a)))throw Error('Somente dry-run habilitado. Use apenas --pid P601 ou nenhum argumento.');
 const pid=args[0]==='--pid'?args[1]:null;
 if(args.length&&(!pid||args.length!==2))throw Error('Argumentos inválidos.');
 if(process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error('Não usar arquivo de chave. Configure ADC local de usuário sem GOOGLE_APPLICATION_CREDENTIALS.');
 const path=require('path'),fs=require('fs');
 const dir=process.env.CLOUDSDK_CONFIG||(process.env.APPDATA?path.join(process.env.APPDATA,'gcloud'):null);
 const file=dir&&path.join(dir,'application_default_credentials.json');
 if(!file||!fs.existsSync(file))throw Error('ADC local de usuário não configurado; nenhuma consulta ou escrita realizada.');
 const cred=JSON.parse(fs.readFileSync(file,'utf8'));
 if(cred.type!=='authorized_user')throw Error('ADC precisa ser de usuário, não conta de serviço.');
 const admin=require('firebase-admin');
 admin.initializeApp({credential:admin.credential.applicationDefault(),projectId:'moklog-checktest'});
 const db=admin.firestore();
 const docs=pid?[await db.collection('equipes').doc(pid).get()]:(await db.collection('equipes').get()).docs;
 for(const snap of docs){
  if(!snap.exists)throw Error('Projeto não encontrado.');
  const plano=await db.collection('fv_plano').doc(snap.id).get();
  console.log(JSON.stringify(resumir(snap.id,snap.data(),plano.exists?plano.data():{})));
 }
 console.log('DRY-RUN concluído. Nenhuma escrita. Escopo e execução dependem de autorização posterior.');
}
module.exports={resumir};
if(require.main===module)main().catch(()=>{console.error('Dry-run não concluído: confira ADC de usuário e acesso somente leitura ao projeto. Nenhum dado foi alterado.');process.exitCode=1;});
