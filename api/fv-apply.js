// Backend only: apply the prepared Excel snapshot after managerial confirmation.
const crypto = require('crypto');
const { getDb } = require('./ai/lib/firebaseAdmin');
const PIDS = ['P260A','P260B','P260C','P505','P601','P602','P604','P605','P606','P607'];
function pinOk(pin, expected) {
  if (typeof pin !== 'string' || !/^[a-f0-9]{64}$/i.test(expected || '')) return false;
  const actual = crypto.createHash('sha256').update(pin).digest();
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
function validate(pid, data) {
  if (!PIDS.includes(pid) || data?.resumo?.pid !== pid || !Number.isFinite(data.resumo.saldoAtual) || !Array.isArray(data.lancamentos) || data.lancamentos.length > 450) throw new Error('Lote inválido');
  const ids = new Set(); let sum = 0;
  for (const l of data.lancamentos) {
    if (!/^[a-f0-9]{24}$/.test(l.id) || ids.has(l.id) || !/^\d{4}-\d{2}-\d{2}$/.test(l.data) || !['credito','aporte','debito','vt','am'].includes(l.tipo) || !Number.isFinite(l.valor) || l.valor < 0) throw new Error('Lançamento inválido');
    ids.add(l.id); sum += (['credito','aporte'].includes(l.tipo) ? 1 : -1) * Math.round(l.valor * 100);
  }
  const diff = sum - Math.round(data.resumo.saldoAtual * 100);
  if (diff !== data.resumo.diferencaConferenciaCentavos || Math.abs(diff) > 20 || ids.size !== data.resumo.qtdLancamentos) throw new Error('Conferência inválida');
  return ids;
}
async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ok:false,erro:'Método não permitido'});
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}; } catch { return res.status(400).json({ok:false,erro:'Pedido inválido'}); }
  if (!pinOk(body.pin, process.env.FV_TRIGGER_PIN_HASH)) return res.status(403).json({ok:false,erro:'PIN inválido'});
  let db, lock, nonce;
  try {
    db = getDb(); const pointer = await db.collection('fv_sync').doc('importacao').get();
    const loteId = pointer.data()?.loteId;
    if (!loteId || !/^[a-z0-9-]+$/.test(loteId)) return res.status(409).json({ok:false,erro:'Nenhum lote Excel preparado. Envie novos arquivos para atualização.'});
    const lote = db.collection('fv_importacoes').doc(loteId);
    const meta = await lote.get();
    if (meta.data()?.status === 'aplicado') return res.status(200).json({ok:true,mensagem:'Este lote já foi aplicado. Dados relidos.',loteId});
    lock = db.collection('fv_sync').doc('aplicacao'); nonce = crypto.randomUUID();
    await db.runTransaction(async t => {
      const old = (await t.get(lock)).data();
      if (old?.emExecucao && Date.now() - old.inicioMs < 300000) throw new Error('Atualização em andamento');
      t.set(lock,{emExecucao:true,inicioMs:Date.now(),nonce,loteId});
    });
    const prepared = {};
    // Validate every project and existing history before any active financial write.
    for (const pid of PIDS) {
      const data = (await lote.collection('projetos').doc(pid).get()).data();
      const ids = validate(pid,data);
      const existing = await db.collection('fv').doc(pid).collection('lancamentos').get();
      if (existing.docs.some(d => !ids.has(d.id))) throw new Error('Histórico anterior exige conciliação: '+pid);
      prepared[pid] = data;
    }
    const now = new Date().toISOString();
    for (const pid of PIDS) {
      const d = prepared[pid], ref = db.collection('fv').doc(pid), batch = db.batch();
      for (const l of d.lancamentos) batch.set(ref.collection('lancamentos').doc(l.id),{...l,sincronizadoEm:now,origemAtualizacao:'importacao_excel_manual'},{merge:true});
      batch.set(ref,{...d.resumo,sincronizadoEm:now,loteImportacao:loteId},{merge:true});
      await batch.commit();
      const actual = await ref.collection('lancamentos').get();
      if (actual.size !== d.lancamentos.length) throw new Error('Verificação de gravação falhou: '+pid);
    }
    const done=db.batch();
    done.update(lote,{status:'aplicado',aplicadoEm:now});
    done.set(db.collection('fv_sync').doc('importacao'),{status:'aplicado',aplicadoEm:now},{merge:true});
    done.set(db.collection('fv_sync').doc('status'),{status:'ok',emExecucao:false,ultimaOk:now,ultimaExecucao:now,erro:null,disparadoPor:'importacao_excel_manual',dataExportacao:meta.data().dataExportacao},{merge:true});
    done.set(lock,{emExecucao:false,nonce,loteId,concluidoEm:now});await done.commit();
    return res.status(200).json({ok:true,mensagem:'Excel aplicado aos 10 projetos. Histórico e projeções atualizados.',loteId});
  } catch(e) {
    if(db && lock && nonce) await db.runTransaction(async t=>{const current=(await t.get(lock)).data();if(current?.nonce===nonce)t.update(lock,{emExecucao:false,erro:'Aplicação não concluída; pode ser retomada'});}).catch(()=>{});
    return res.status(409).json({ok:false,erro:e.message.includes('Firebase')?'Serviço administrativo não configurado':e.message});
  }
}
module.exports = handler;
module.exports.pinOk = pinOk;
module.exports.validate = validate;
