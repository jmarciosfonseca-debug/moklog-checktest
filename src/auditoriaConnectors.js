// ─────────────────────────────────────────────────────────────
// auditoriaConnectors.js — Conectores de LEITURA da Central de
// Auditoria Operacional (Fase 1A · piloto P311A).
//
// REGRA ABSOLUTA (Helena): ausência de informação = "sem-dado",
// NUNCA "ok"/"conforme". Cada conector distingue "sem registro"
// de "registrado e ok". Não duplica, não altera, não grava —
// apenas lê as fontes existentes e normaliza, apontando a origem.
//
// Situações canônicas: "conforme" | "nao-conforme" | "parcial"
//                      | "pendente" | "sem-dado"
// ─────────────────────────────────────────────────────────────

// Idade em dias a partir de uma data ISO/AAAA-MM-DD (meio-dia local).
function diasDesde(v) {
  if (!v) return null;
  try {
    const iso = String(v).length === 10 ? v + "T12:00:00" : v;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.floor((Date.now() - t) / 86400000));
  } catch { return null; }
}

// Cada conector recebe { db, doc, getDoc } por injeção (testável).
// Retorna sempre { situacao, cobertura, itens[], origem, data, responsavel, resumo }.
//   cobertura: true se HÁ dado para avaliar; false → situacao "sem-dado".

// ── CFTV / tempo de gravação (cftv_gravacao/{pid}) ────────────────────
export async function conectorCFTV(pid, deps) {
  const { db, doc, getDoc } = deps;
  let data = null;
  try { const s = await getDoc(doc(db, "cftv_gravacao", pid)); if (s.exists()) data = s.data(); } catch (e) {}
  const cameras = data && Array.isArray(data.cameras) ? data.cameras : null;

  if (!cameras || cameras.length === 0) {
    return { situacao: "sem-dado", cobertura: false, origem: "cftv_gravacao/" + pid,
      resumo: "Sem dado de CFTV: nenhuma câmera registrada.", itens: [] };
  }
  // Retenção mínima exigida: 30 dias. Metadados exigidos: ultimaChecagem + checadoPor.
  const semRetencao = cameras.filter(c => c.diasGravacao == null); // sem info de dias
  const abaixo30 = cameras.filter(c => c.diasGravacao != null && c.diasGravacao < 30);
  const ok30 = cameras.filter(c => c.diasGravacao != null && c.diasGravacao >= 30);
  // Metadados incompletos = evidência parcial (não comprova plenamente).
  const semChecagem = cameras.filter(c => !c.ultimaChecagem);
  const semResponsavel = cameras.filter(c => !c.checadoPor);
  const metadadosIncompletos = semChecagem.length > 0 || semResponsavel.length > 0;

  let situacao;
  if (abaixo30.length > 0) situacao = "nao-conforme";        // retenção insuficiente = falha
  else if (semRetencao.length > 0) situacao = "parcial";     // parte sem info de retenção
  else if (metadadosIncompletos) situacao = "parcial";       // retenção ok mas falta data/responsável
  else situacao = "conforme";                                // só conforme com tudo completo

  const ultima = cameras.map(c => c.ultimaChecagem).filter(Boolean).sort().pop() || null;
  const responsavel = (cameras.find(c => c.checadoPor) || {}).checadoPor || null;
  const notaMeta = metadadosIncompletos
    ? ` · ${semChecagem.length} sem data de checagem, ${semResponsavel.length} sem responsável`
    : "";

  return {
    situacao, cobertura: true, origem: "cftv_gravacao/" + pid,
    data: ultima, responsavel,
    resumo: `${cameras.length} câmeras · ${abaixo30.length} abaixo de 30 dias · ${ok30.length} OK` +
            (semRetencao.length ? ` · ${semRetencao.length} sem info de retenção` : "") + notaMeta,
    itens: cameras.map(c => ({
      nome: c.nome || "—",
      retencaoDias: c.diasGravacao != null ? c.diasGravacao : null,
      ultimaChecagem: c.ultimaChecagem || null,
      responsavel: c.checadoPor || null,
      situacao: c.diasGravacao == null ? "sem-dado" : (c.diasGravacao < 30 ? "nao-conforme" : "conforme"),
    })),
  };
}

// Helpers de alvo semanal — RÉPLICA FIEL de Equipamentos.jsx (chkAlvoVigente/
// chkAlvoTimestamp). Domingo 23:59 é o limite do ciclo. Se há alvo salvo, usa-o
// (é o ciclo vigente do módulo); senão, próximo domingo a partir de hoje.
const CHK_HORA = 23, CHK_MIN = 59;
function chkParseISO(iso){ const [y,m,d]=String(iso).split("-").map(Number); return new Date(y,(m||1)-1,d||1); }
function chkISO(dt){ return dt.toLocaleDateString("sv-SE"); }
function chkAjustaDomingo(dt){ const g=dt.getDay(); if(g!==0) dt.setDate(dt.getDate()+(7-g)); return dt; }
function chkAlvoVigente(chk){
  if(chk && chk.alvo) return chk.alvo;
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  return chkISO(chkAjustaDomingo(hoje));
}
function chkAlvoTimestamp(alvoISO){ const d=chkParseISO(alvoISO); d.setHours(CHK_HORA,CHK_MIN,0,0); return d.getTime(); }

// ── Teste semanal (equipamentos/{pid}.checagemSemanal) ────────────────
export async function conectorTesteSemanal(pid, deps) {
  const { db, doc, getDoc } = deps;
  let data = null;
  try { const s = await getDoc(doc(db, "equipamentos", pid)); if (s.exists()) data = s.data(); } catch (e) {}
  const chk = data && data.checagemSemanal ? data.checagemSemanal : null;

  if (!chk || !chk.ultimaChecagem) {
    return { situacao: "sem-dado", cobertura: false, origem: "equipamentos/" + pid + ".checagemSemanal",
      resumo: "Sem dado de teste semanal: nenhuma checagem registrada.", itens: [] };
  }
  const res = chk.ultimoResultado || {};
  // emAberto AUSENTE não é zero: é dado incompleto.
  const temEmAberto = res.emAberto != null;
  const emAberto = temEmAberto ? res.emAberto : null;

  // Alvo vigente do MÓDULO (não idade fixa). O prazo é o domingo-alvo 23:59.
  const alvo = chkAlvoVigente(chk);
  const limite = chkAlvoTimestamp(alvo);
  const vencido = Date.now() > limite;
  // A checagem salva pertence ao ciclo vigente? (mesmo alvo).
  const doCicloVigente = chk.alvo === alvo;

  let situacao;
  if (temEmAberto && emAberto > 0) situacao = "nao-conforme";      // itens em aberto = falha
  else if (!doCicloVigente || vencido) situacao = "pendente";      // ciclo anterior/vencido não comprova o vigente
  else if (!temEmAberto) situacao = "parcial";                     // sem info de itens em aberto = incompleto
  else situacao = "conforme";                                      // ciclo vigente, sem itens em aberto

  return {
    situacao, cobertura: true, origem: "equipamentos/" + pid + ".checagemSemanal",
    data: chk.ultimaChecagem, responsavel: res.por || null,
    resumo: `Última checagem ${chk.ultimaChecagem}` +
            (res.por ? ` por ${res.por}` : "") +
            (temEmAberto ? ` · ${emAberto} item(ns) em aberto` : " · itens em aberto não informados") +
            (res.corrigidos != null ? ` · ${res.corrigidos} corrigido(s)` : "") +
            (doCicloVigente ? "" : ` · checagem de ciclo anterior (alvo vigente: ${alvo})`),
    itens: [],
  };
}

// ── Equipamentos / pendências (equipamentos/{pid}) ────────────────────
export async function conectorEquipamentos(pid, deps) {
  const { db, doc, getDoc } = deps;
  let data = null;
  try { const s = await getDoc(doc(db, "equipamentos", pid)); if (s.exists()) data = s.data(); } catch (e) {}
  if (!data) {
    return { situacao: "sem-dado", cobertura: false, origem: "equipamentos/" + pid,
      resumo: "Sem dado de inventário de equipamentos.", itens: [] };
  }
  const CATS = ["smartphones","radiosHT","armamento","municao","placas","lanternas","ztrax","bodycam"];
  const todos = [];
  CATS.forEach(k => { if (Array.isArray(data[k])) data[k].forEach(it => todos.push({ ...it, _cat: k })); });
  if (data.moto) todos.push({ ...data.moto, _cat: "moto" });

  if (todos.length === 0) {
    return { situacao: "sem-dado", cobertura: false, origem: "equipamentos/" + pid,
      resumo: "Sem itens de equipamento cadastrados.", itens: [] };
  }
  const inop = todos.filter(i => i.status === "inop" || i.status === "critico");
  const parcial = todos.filter(i => i.status === "parcial" || i.status === "baixo");

  let situacao;
  if (inop.length > 0) situacao = "nao-conforme";
  else if (parcial.length > 0) situacao = "parcial";
  else situacao = "conforme";

  const pend = [...inop, ...parcial].map(i => ({
    identificacao: i.identificacao || i._cat,
    categoria: i._cat,
    status: i.status,
    abertoDesde: i.dataProblem || null,
    idadeDias: diasDesde(i.dataProblem),
    observacao: i.justificativa || "",
    situacao: (i.status === "inop" || i.status === "critico") ? "nao-conforme" : "parcial",
  })).sort((a, b) => (b.idadeDias || 0) - (a.idadeDias || 0));

  return {
    situacao, cobertura: true, origem: "equipamentos/" + pid,
    resumo: `${todos.length} itens · ${inop.length} inoperante(s)/crítico(s) · ${parcial.length} parcial(is)`,
    itens: pend,
  };
}

// ── Ronda perimetral (perimetral/{pid}.testes[]) ──────────────────────
// CRÍTICO: NÃO herda o default ||"ok" do módulo. Zona sem teste = sem-dado.
export async function conectorRondaPerimetral(pid, zonasProjeto, deps) {
  const { db, doc, getDoc } = deps;
  let data = null;
  try { const s = await getDoc(doc(db, "perimetral", pid)); if (s.exists()) data = s.data(); } catch (e) {}
  const testes = data && Array.isArray(data.testes) ? data.testes : [];

  if (testes.length === 0) {
    return { situacao: "sem-dado", cobertura: false, origem: "perimetral/" + pid,
      resumo: "Sem dado de status operacional por zona (nenhum teste de ronda registrado; apenas mapa/desenho).",
      itens: (zonasProjeto || []).map(z => ({ zona: z, situacao: "sem-dado" })) };
  }
  // Teste mais recente por data+hora.
  const ordenado = [...testes].sort((a, b) => String(b.data + b.hora).localeCompare(String(a.data + a.hora)));
  const ultimo = ordenado[0];
  const zonasTestadas = ultimo.zonas || {};

  const itens = (zonasProjeto || []).map(z => {
    const zd = zonasTestadas[z];
    if (!zd || zd.status == null) return { zona: z, situacao: "sem-dado", obs: "" };
    const st = zd.status;
    return {
      zona: z,
      situacao: st === "ok" ? "conforme" : "nao-conforme",
      statusOriginal: st,
      obs: zd.obs || "",
    };
  });

  const semDado = itens.filter(i => i.situacao === "sem-dado").length;
  const naoConf = itens.filter(i => i.situacao === "nao-conforme").length;
  let situacao;
  if (naoConf > 0) situacao = "nao-conforme";
  else if (semDado === itens.length) situacao = "sem-dado";
  else if (semDado > 0) situacao = "parcial";
  else situacao = "conforme";

  return {
    situacao, cobertura: semDado < itens.length, origem: "perimetral/" + pid,
    data: ultimo.data || null, responsavel: ultimo.quemFez || null,
    resumo: `Último teste ${ultimo.data || "—"}${ultimo.quemFez ? " por " + ultimo.quemFez : ""} · ` +
            `${naoConf} zona(s) não conforme · ${semDado} sem dado`,
    itens,
  };
}

// ── Visão 360 (score já computado, passado por parâmetro) ─────────────
// O score é calculado no App (computeScore360). Aqui só normalizamos o
// resultado que a tela injeta — sem recomputar nem inventar.
export function conectorVisao360(score360) {
  if (!score360 || score360.score == null) {
    return { situacao: "sem-dado", cobertura: false, origem: "computeScore360()",
      resumo: "Sem dado de Visão 360 para o projeto.", itens: [] };
  }
  const nota = score360.score;
  let situacao;
  if (nota >= 80) situacao = "conforme";
  else if (nota >= 60) situacao = "parcial";
  else situacao = "nao-conforme";

  const penalidades = Array.isArray(score360.penalidades) ? score360.penalidades : [];
  const vulnerabilidades = Array.isArray(score360.vulnerabilidades) ? score360.vulnerabilidades : [];

  return {
    situacao, cobertura: true, origem: "computeScore360()",
    resumo: `Score ${nota}/100` + (penalidades.length ? ` · ${penalidades.length} penalidade(s)` : ""),
    itens: penalidades.map(p => ({ criterio: p.criterio || p.label || "—", peso: p.peso || p.valor || null })),
    vulnerabilidades,
  };
}
