// Server only (api/rd.js). Guarda o dia do consultor e a memória de rotas com controle de revisão.
// Cada dia é um documento rd_dias/<uid>_<data>; a memória é rd_memoria/<uid>. Dados sempre do próprio uid.
function erro(status, message) { return Object.assign(new Error(message), { status }); }
function texto(v, max = 300) { if (v == null) return ""; if (typeof v !== "string" || v.length > max) throw erro(400, "Texto inválido."); return v.trim(); }
function dataISO(v) { const s = texto(v, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s))) throw erro(400, "Data inválida."); return s; }
function codigo(v) { if (typeof v !== "string" || !/^MK[A-Z0-9_]{1,12}$/.test(v)) throw erro(400, "Destino inválido."); return v; }
function numOuNulo(v) { if (v == null || v === "") return null; const n = Number(String(v).replace(",", ".")); if (!Number.isFinite(n) || n < 0 || n > 10000000) throw erro(400, "Número inválido."); return n; }
function lista(v, max = 60) { if (v == null) return []; if (!Array.isArray(v) || v.length > max) throw erro(400, "Lista inválida."); return v; }
function marco(v) {
  if (v == null) return null;
  const em = texto(v.em, 40); if (!em || isNaN(Date.parse(em))) throw erro(400, "Horário inválido.");
  const out = { em };
  if (v.gps != null) {
    const lat = Number(v.gps.lat), lng = Number(v.gps.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw erro(400, "GPS inválido.");
    out.gps = { lat, lng, acc: Number.isFinite(Number(v.gps.acc)) ? Math.round(Number(v.gps.acc)) : null };
  }
  if (v.endereco != null) out.endereco = texto(v.endereco, 300);
  if (v.editado === true) out.editado = true;   // horário ajustado manualmente pelo consultor
  return out;
}
const valorItem = (p) => ({ descricao: texto(p.descricao, 120), valor: numOuNulo(p.valor), ...(p.fotoId ? { fotoId: texto(p.fotoId, 40) } : {}) });
function trecho(t) {
  const out = {
    id: texto(t.id, 40) || null,
    origem: codigo(t.origem), destino: codigo(t.destino),
    veiculo: t.veiculo === "moto" ? "moto" : "carro",
    kmInicial: numOuNulo(t.kmInicial), kmFinal: numOuNulo(t.kmFinal),
    abertura: marco(t.abertura), chegada: marco(t.chegada),
    pedagios: lista(t.pedagios, 20).map(valorItem), gastos: lista(t.gastos, 20).map(valorItem),
    atividades: lista(t.atividades, 40).map((a) => ({ texto: texto(a.texto, 1000), status: ["aberto", "finalizado"].includes(a.status) ? a.status : null, ...(a.desde ? { desde: dataISO(a.desde) } : {}), ...(a.tag ? { tag: texto(a.tag, 20) } : {}) })),
    obs: texto(t.obs, 4000),
  };
  if (!out.id || !out.abertura) throw erro(400, "Trecho sem identificação ou abertura.");
  return out;
}
function dia(v, uid, data) {
  const trechos = lista(v?.trechos, 40).map(trecho);
  if (new Set(trechos.map((t) => t.id)).size !== trechos.length) throw erro(400, "Trechos repetidos.");
  if (trechos.filter((t) => !t.chegada).length > 1) throw erro(400, "Só pode haver um trecho em aberto.");
  if (!["aberto", "fechado"].includes(v?.estado || "aberto")) throw erro(400, "Estado inválido.");
  return { uid, data, estado: v?.estado || "aberto", trechos, obs: texto(v?.obs, 4000) };
}
function memoria(v) {
  const rotas = {};
  for (const [k, r] of Object.entries(v?.rotas || {})) {
    if (!/^MK[A-Z0-9_]{1,12}>MK[A-Z0-9_]{1,12}$/.test(k) || Object.keys(rotas).length >= 200) throw erro(400, "Rota inválida.");
    rotas[k] = { viagens: Math.min(Math.max(parseInt(r.viagens, 10) || 0, 0), 100000), kmMedia: numOuNulo(r.kmMedia), pedagios: lista(r.pedagios, 20).map(valorItem) };
  }
  const pendencias = {};
  for (const [k, ps] of Object.entries(v?.pendencias || {})) {
    if (!/^MK[A-Z0-9_]{1,12}$/.test(k) || Object.keys(pendencias).length >= 100) throw erro(400, "Pendência inválida.");
    pendencias[k] = lista(ps, 30).map((p) => ({ texto: texto(p.texto, 1000), desde: dataISO(p.desde) }));
  }
  const config = { valorKm: numOuNulo(v?.config?.valorKm), valorKmMoto: numOuNulo(v?.config?.valorKmMoto), valorDiaria: numOuNulo(v?.config?.valorDiaria) };
  const fd = parseInt(v?.config?.fechamentoDia, 10); if (fd >= 1 && fd <= 28) config.fechamentoDia = fd;
  const destinosExtras = lista(v?.destinosExtras, 100).map((d) => ({ codigo: codigo(d.codigo), sub: texto(d.sub, 60) || "Fora da rotina" }));
  return { rotas, pendencias, destinosExtras, config };
}
async function executar(db, u, b) {
  if (!u || !["gerente", "auditor"].includes(u.role)) throw erro(403, "Perfil sem permissão.");
  const action = b?.acao;
  const refMem = db.collection("rd_memoria").doc(u.uid);
  if (action === "ler") {
    const data = dataISO(b.data);
    const refDia = db.collection("rd_dias").doc(u.uid + "_" + data);
    const [sd, sm] = await Promise.all([refDia.get(), refMem.get()]);
    return { dia: sd.exists ? sd.data() : null, memoria: sm.exists ? sm.data() : null };
  }
  if (action === "foto_salvar") {
    // Comprovante de gasto: documento imutável fora do dia (o dia guarda só o fotoId).
    const fotoId = (() => { const v = b.fotoId; if (typeof v !== "string" || !/^[a-z0-9]{6,40}$/.test(v)) throw erro(400, "Identificador de foto inválido."); return v; })();
    const b64 = b.b64;
    if (typeof b64 !== "string" || b64.length > 250000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b64)) throw erro(400, "Foto inválida ou grande demais (comprovante deve sair comprimido do aparelho).");
    const ref = db.collection("rd_comprovantes").doc(u.uid + "_" + fotoId);
    const atual = await ref.get();
    if (atual.exists) return { fotoId };                 // imutável: regravar é ignorado
    await ref.set({ uid: u.uid, b64, em: new Date().toISOString() });
    return { fotoId };
  }
  if (action === "fotos_ler") {
    const ids = lista(b.ids, 40).map((v) => { if (typeof v !== "string" || !/^[a-z0-9]{6,40}$/.test(v)) throw erro(400, "Identificador de foto inválido."); return v; });
    const docs = await Promise.all(ids.map((id2) => db.collection("rd_comprovantes").doc(u.uid + "_" + id2).get()));
    const fotos = {};
    docs.forEach((d, i) => { if (d.exists && d.data().uid === u.uid) fotos[ids[i]] = d.data().b64; });
    return { fotos };
  }
  if (action === "periodo") {
    // Dias completos do período de fechamento (ex.: 19/08 a 18/09) para o consolidado.
    const de = dataISO(b.de), ate = dataISO(b.ate);
    if (de > ate) throw erro(400, "Período invertido.");
    const docs = (await db.collection("rd_dias").where("uid", "==", u.uid).limit(200).get()).docs.map((s2) => s2.data())
      .filter((d) => d.data >= de && d.data <= ate);
    docs.sort((a, b2) => String(a.data).localeCompare(String(b2.data)));
    const sm = await refMem.get();
    return { dias: docs, memoria: sm.exists ? sm.data() : null };
  }
  if (action === "dias") {
    const docs = (await db.collection("rd_dias").where("uid", "==", u.uid).limit(120).get()).docs.map((s) => s.data());
    docs.sort((a, b2) => String(b2.data).localeCompare(String(a.data)));
    return { dias: docs.slice(0, 62).map((d) => ({ data: d.data, estado: d.estado, trechos: (d.trechos || []).length })) };
  }
  if (action !== "salvar") throw erro(400, "Ação inválida.");
  const data = dataISO(b.data);
  const refDia = db.collection("rd_dias").doc(u.uid + "_" + data);
  const nextDia = dia(b.dia, u.uid, data);
  const nextMem = b.memoria == null ? null : memoria(b.memoria);
  return db.runTransaction(async (tx) => {
    const profile = await tx.get(db.collection("usuarios").doc(u.uid));
    if (!profile.exists || profile.data().active !== true || profile.data().role !== u.role) throw erro(403, "Perfil revogado.");
    const sd = await tx.get(refDia); const atualDia = sd.exists ? sd.data() : null;
    if (atualDia && atualDia.uid !== u.uid) throw erro(403, "Dia de outro usuário.");
    if (!Number.isSafeInteger(b.revisao) || b.revisao !== (atualDia?.revisao || 0)) throw erro(409, "Outra gravação alterou este dia. Reabra antes de salvar; seu rascunho local foi preservado.");
    const agora = new Date().toISOString();
    const gravadoDia = { ...nextDia, revisao: (atualDia?.revisao || 0) + 1, atualizadoEm: agora };
    if (Buffer.byteLength(JSON.stringify(gravadoDia), "utf8") > 400000) throw erro(400, "Dia muito grande. Reduza as observações.");
    tx.set(refDia, gravadoDia);
    let gravadoMem = null;
    if (nextMem) {
      const sm = await tx.get(refMem); const atualMem = sm.exists ? sm.data() : null;
      if (!Number.isSafeInteger(b.memoriaRevisao) || b.memoriaRevisao !== (atualMem?.revisao || 0)) throw erro(409, "A memória de rotas mudou em outro aparelho. Reabra o RD.");
      gravadoMem = { ...nextMem, uid: u.uid, revisao: (atualMem?.revisao || 0) + 1, atualizadoEm: agora };
      if (Buffer.byteLength(JSON.stringify(gravadoMem), "utf8") > 400000) throw erro(400, "Memória muito grande.");
      tx.set(refMem, gravadoMem);
    }
    return { dia: gravadoDia, memoria: gravadoMem };
  });
}
module.exports = { executar };
