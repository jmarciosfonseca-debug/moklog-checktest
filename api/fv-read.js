// Manager-only reading of the active FV snapshot. Never writes financial data.
const { getDb } = require('./ai/lib/firebaseAdmin');
const { pinOk } = require('./fv-apply');
const PIDS = ['P260A','P260B','P260C','P505','P601','P602','P604','P605','P606','P607'];
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if(req.method !== 'POST') return res.status(405).json({ok:false,erro:'Método não permitido'});
  let body;
  try { body=typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}; }
  catch { return res.status(400).json({ok:false,erro:'Pedido inválido'}); }
  if(!pinOk(body.pin,process.env.FV_TRIGGER_PIN_HASH)) return res.status(403).json({ok:false,erro:'PIN inválido'});
  if(body.pid && !PIDS.includes(body.pid)) return res.status(400).json({ok:false,erro:'Projeto fora do escopo FV'});
  try {
    const db=getDb();
    if(body.pid){
      const ref=db.collection('fv').doc(body.pid);
      const [summary,history]=await Promise.all([ref.get(),ref.collection('lancamentos').orderBy('data','desc').get()]);
      return res.status(200).json({ok:true,resumo:summary.exists ? summary.data() : null,lancamentos:history.docs.map(d=>d.data())});
    }
    const [summaries,status]=await Promise.all([Promise.all(PIDS.map(pid=>db.collection('fv').doc(pid).get())),db.collection('fv_sync').doc('status').get()]);
    const resumos={};summaries.forEach((s,i)=>{if(s.exists)resumos[PIDS[i]]=s.data();});
    console.info('FV leitura: '+summaries.filter(s=>s.exists).length+' projetos; sem valores nos logs');
    return res.status(200).json({ok:true,resumos,status:status.exists ? status.data() : null});
  } catch(e) {
    console.error('FV leitura indisponível', {code:e.code || 'backend'});
    return res.status(503).json({ok:false,erro:'Não foi possível ler os dados FV. Os valores gravados permanecem preservados.'});
  }
};
