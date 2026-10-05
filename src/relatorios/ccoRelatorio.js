// ─────────────────────────────────────────────────────────────
// CCO — Acesso, Intervalo, Supervisão e Manutenção no padrão Moked (F2-2, autorizado pelo Marcio em 05/10/2026).
// Só leitura e renderização: o texto original nunca é alterado no banco.
// Ressalvas acordadas com o Codex:
//  1. Acesso ↔ Manutenção = "correspondência provável" (critérios e cobertura declarados); fonte indisponível ou sem
//     registros no período = "não verificado", nunca "ausente".
//  2. Turno pela hora usa a configuração real do projeto (inicioTurnoHora da grade; P606 +1h). Duração só com data e as
//     duas horas; virada da meia-noite só em turno noturno; fora disso "inconsistente", sem duração fabricada.
//  3. Máscara de CPF é proteção PARCIAL (declarada): só CPF formatado ou 11 dígitos precedidos de "CPF".
//  4. Conteúdo disciplinar na versão cliente: decisão do Marcio (MODO_DISCIPLINAR). Enquanto "pendente", a observação
//     da Supervisão não aparece na versão cliente e o PDF declara a pendência.
// ─────────────────────────────────────────────────────────────
import { inicioTurnoHora } from "../rondaVirtualGrade";
import { documentoMoked, barrasMoked, escHTML, dataBR } from "./padraoMoked";
import { rotulosColaboradoras } from "./rondaVirtualRelatorio";

export const MODO_DISCIPLINAR = "pendente";   // "A" omitir por expressão | "B" ocultar observação | "C" mostrar tudo | "pendente"
const MMDD = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
const TURNO_TXT = { diurno: "Diurno", noturno: "Noturno" };
const STATUS_TXT = { concluida: ["Concluída", "mk-b-ok"], parcial: ["Parcial", "mk-b-wa"], pendente: ["Pendente", "mk-b-da"] };
export const normalizar = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const hhmm = (v) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(v || "").trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const diasEntreDatas = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ── 3. CPF (proteção parcial) ────────────────────────────────
const RE_CPF_FORMATADO = /(^|[^\d])(\d{3})\.(\d{3})\.(\d{3})-(\d{2})(?!\d)/g;
const RE_CPF_ROTULADO = /(\bCPF\b[\s:nº°.]{0,5})(\d{9})(\d{2})(?!\d)/gi;
export function mascararCPF(texto) {
  let n = 0;
  const t = String(texto ?? "")
    .replace(RE_CPF_FORMATADO, (m, pre, a, b, c, d) => { n++; return `${pre}***.***.***-${d}`; })
    .replace(RE_CPF_ROTULADO, (m, rot, base, dv) => { n++; return `${rot}***.***.***-${dv}`; });
  return { texto: t, mascarados: n };
}

// ── 4. Disciplinar (expressões, não palavras soltas) ─────────
const RE_DISCIPLINAR = /(medida\s+disciplinar|advert[eê]ncia\s+(verbal|escrita|formal)|suspens[aã]o\s+disciplinar|suspens[oa]\s+por\s+\d+\s+dias?)/i;
export function tratarDisciplinar(texto, { interno, modo = MODO_DISCIPLINAR }) {
  const original = String(texto || "");
  if (interno || modo === "C") return { texto: original, omitidos: 0, oculto: false };
  if (modo === "B" || modo === "pendente") return { texto: "", omitidos: 0, oculto: true };
  const frases = original.split(/(?<=[.!?;])\s+|\n+/);
  let omitidos = 0;
  const texto2 = frases.map((f) => { if (RE_DISCIPLINAR.test(f)) { omitidos++; return "[trecho de uso interno omitido]"; } return f; }).join(" ");
  return { texto: texto2, omitidos, oculto: false };
}
export const temConteudoDisciplinar = (t) => RE_DISCIPLINAR.test(String(t || ""));

// ── 2. Turno pela hora (configuração real do projeto) e duração ──
export function turnoPelaHora(hora, projectId) {
  const m = hhmm(hora); if (m == null) return null;
  const ini = inicioTurnoHora("diurno", projectId) * 60, fim = inicioTurnoHora("noturno", projectId) * 60;
  return m >= ini && m < fim ? "diurno" : "noturno";
}
export function textoJornada(projectId) {
  const d = inicioTurnoHora("diurno", projectId), n = inicioTurnoHora("noturno", projectId), h = (x) => `${String(x).padStart(2, "0")}h`;
  return `jornada configurada no app: diurno ${h(d)}–${h(n)}, noturno ${h(n)}–${h(d)}`;
}
const notaJornada = (pid) => `turno inferido pela ${textoJornada(pid)} — inferência a confirmar com a escala real, não erro comprovado do lançamento`;

// Equipamentos da Supervisão (lista de origem = danificados): "trocado" resolve; "aberto" = pendência continua.
export function acaoEquipamento(acao) {
  if (acao === "trocado") return { rotulo: "Trocado (resolvido)", tipo: "trocado" };
  if (acao === "aberto") return { rotulo: "Em aberto (pendente)", tipo: "aberto" };
  return { rotulo: `Ação não reconhecida: «${escHTML(acao)}»`, tipo: "desconhecida" };
}

export function duracaoMin(inicio, fim, turno) {
  const a = hhmm(inicio), b = hhmm(fim);
  if (a == null || b == null) return { min: null, inconsistente: false };
  if (b >= a) return { min: b - a, inconsistente: false };
  if (turno === "noturno") return { min: b + 1440 - a, inconsistente: false };
  return { min: null, inconsistente: true };
}

export function validarPeriodo(de, ate) {
  if (!de || !ate) return "Informe as datas do período.";
  if (de > ate) return "A data inicial é posterior à final.";
  return null;
}

export function filtrarPeriodo(registros, de, ate) {
  return (registros || []).filter((r) => r && !r.rascunho && r.data && (!de || r.data >= de) && (!ate || r.data <= ate))
    .sort((a, b) => `${a.data} ${a.horaEntrada || a.chegada || ""}`.localeCompare(`${b.data} ${b.horaEntrada || b.chegada || ""}`));
}
function cobertura(lista) {
  if (!lista) return { disponivel: false, n: 0 };
  const d = lista.map((r) => r.data).filter(Boolean).sort();
  return { disponivel: true, n: lista.length, de: d[0] || null, ate: d[d.length - 1] || null };
}
export const chaveAgrupamento = (s) => normalizar(s).replace(/\(.*?\)/g, " ").replace(/\bsaida\b.*$/, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const escolherRotulo = (variantes) => [...variantes.entries()].sort((a, b) => b[1] - a[1] || (/[A-Z]/.test(b[0]) - /[A-Z]/.test(a[0])) || a[0].length - b[0].length)[0][0];
// grafias: mesma chave normalizada com escritas diferentes
function grafias(valores) {
  const m = new Map();
  valores.filter(Boolean).forEach((v) => { const k = chaveAgrupamento(v); if (!k) return; if (!m.has(k)) m.set(k, new Map()); const g = m.get(k); g.set(v.trim(), (g.get(v.trim()) || 0) + 1); });
  return [...m.values()].filter((g) => g.size > 1).map((g) => [...g.keys()]);
}
function contagem(valores) {
  const m = new Map();
  valores.forEach((v) => { const k = chaveAgrupamento(v) || "(não informado)"; const e = m.get(k) || { rotulo: "(não informado)", n: 0, variantes: new Map() };
    e.n++; const limpo = String(v || "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim(); if (limpo) e.variantes.set(limpo, (e.variantes.get(limpo) || 0) + 1); m.set(k, e); });
  return [...m.values()].map((e) => ({ rotulo: e.variantes.size ? escolherRotulo(e.variantes) : e.rotulo, n: e.n })).sort((a, b) => b.n - a.n || a.rotulo.localeCompare(b.rotulo));
}

// ── 1. Correspondência provável Acesso ↔ Manutenção ──────────
const tokensNome = (s) => normalizar(s).split(/[^a-z]+/).filter((t) => t.length >= 4 && !["empresa", "tecnico", "saida", "entrada"].includes(t));
// empresa comparada pelo nome normalizado inteiro, sem anotações entre parênteses nem "saída ..." digitada no campo
const empresaChave = (s) => normalizar(s).replace(/\(.*?\)/g, " ").replace(/\bsaida\b.*$/, " ").replace(/\s+/g, " ").trim();
const mesmaEmpresa = (x, y) => { const a = empresaChave(x), b = empresaChave(y); return a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)); };
export function correspondencia(acessos, manutencoes, de, ate) {
  const dentro = (lista) => filtrarPeriodo(lista || [], de, ate);
  const A = dentro(acessos), M = dentro(manutencoes);
  const cA = cobertura(acessos ? A : null), cM = cobertura(manutencoes ? M : null);   // cobertura medida NO PERÍODO
  const verificavel = cA.disponivel && cM.disponivel && cA.n > 0 && cM.n > 0;
  const casa = (m, a) => {
    if (a.data !== m.data) return false;
    const tn = new Set(tokensNome(a.nome));
    const porNome = tokensNome(m.tecnico).some((t) => tn.has(t));
    return porNome || mesmaEmpresa(m.empresa, a.empresa);
  };
  const naFaixa = (d, cob) => cob.de && cob.ate && d >= cob.de && d <= cob.ate;
  const manutNaoLocalizada = [], manutForaFaixa = [], acessoNaoLocalizado = [], acessoForaFaixa = [];
  if (verificavel) {
    M.forEach((m) => { if (!naFaixa(m.data, cA)) manutForaFaixa.push(m); else if (!A.some((a) => casa(m, a))) manutNaoLocalizada.push(m); });
    A.filter((a) => M.some((m) => mesmaEmpresa(m.empresa, a.empresa))).forEach((a) => {
      if (!naFaixa(a.data, cM)) acessoForaFaixa.push(a); else if (!M.some((m) => casa(m, a))) acessoNaoLocalizado.push(a); });
  }
  return { verificavel, coberturaAcesso: cA, coberturaManut: cM, manutNaoLocalizada, manutForaFaixa, acessoNaoLocalizado, acessoForaFaixa,
    manutSemAcesso: manutNaoLocalizada, acessoSemManut: acessoNaoLocalizado };   // nomes antigos mantidos como apelidos
}
function blocoCorrespondencia(c, foco) {
  const cobTxt = (n, cob) => !cob.disponivel ? `${n}: consulta não concluída (fonte indisponível)` : `${n}: ${cob.n} registro(s) no período${cob.de ? ` (${dataBR(cob.de)} a ${dataBR(cob.ate)})` : ""}`;
  const crit = "Critério: mesmo dia e nome do técnico ou a mesma empresa (sem acento, sem maiúsculas e sem anotações entre parênteses). "
    + "\"Não localizado\" significa apenas que nada correspondente foi encontrado nos registros consultados — não é ausência operacional comprovada. "
    + "A faixa de datas lida não garante que todos os dias intermediários tenham registro.";
  if (!c.verificavel) return `<li><b>Acesso ↔ Manutenção: não verificado</b> — ${cobTxt("Acesso", c.coberturaAcesso)}; ${cobTxt("Manutenção", c.coberturaManut)}.</li>`;
  const fm = (m) => `${dataBR(m.data)} — ${escHTML(m.tecnico || "—")} (${escHTML(m.empresa || "—")})`;
  const fa = (a) => `${dataBR(a.data)} ${escHTML(a.horaEntrada || "")} — ${escHTML(a.nome || "—")} (${escHTML(a.empresa || "—")})`;
  const [nl, ff, f, titulo] = foco === "manutencao"
    ? [c.manutNaoLocalizada, c.manutForaFaixa, fm, "Manutenção sem entrada correspondente localizada no Acesso"]
    : [c.acessoNaoLocalizado, c.acessoForaFaixa, fa, "Entrada de prestador sem manutenção correspondente localizada"];
  return `<li><b>${titulo}:</b> ${nl.length ? nl.map(f).join("; ") : "nenhuma"}.${ff.length ? ` <b>Não verificado</b> (fora da faixa de datas da outra fonte): ${ff.map(f).join("; ")}.` : ""} <span class="mk-mu">${crit} ${cobTxt("Acesso", c.coberturaAcesso)}; ${cobTxt("Manutenção", c.coberturaManut)}.</span></li>`;
}

// Divide uma tabela: corpo + "cauda" (últimas linhas com o mesmo cabeçalho) que vai junto da assinatura.
function tabelaComCauda(abre, linhas, fecha, cauda = 3) {
  if (linhas.length <= cauda) return { principal: "", cauda: `${abre}${linhas.join("")}${fecha}` };
  return { principal: `${abre}${linhas.slice(0, -cauda).join("")}${fecha}`, cauda: `${abre}${linhas.slice(-cauda).join("")}${fecha}` };
}
const conferencia = (itens, notaCpf) => `<section class="mk-qual mk-bloco"><div class="mk-h2">Conferência do registro <span class="mk-mu">— versão interna</span></div>
  ${itens.length ? `<ul>${itens.join("")}</ul>` : '<div class="mk-sm">Nenhuma inconsistência encontrada.</div>'}
  ${notaCpf ? `<p class="mk-nota">${notaCpf}</p>` : ""}</section>`;
const notaCPF = (n) => `Proteção de dados: ${n} CPF(s) mascarado(s) na renderização (busca por padrão — proteção parcial, não substitui revisão de dados pessoais). O registro original não foi alterado.`;

// ── Montadores por tema ──────────────────────────────────────
export function montarRelatorioCCO(tema, project, registros, { agora = new Date(), interno = false, de = null, ate = null, outros = null, comAnexo = false, modoDisciplinar = MODO_DISCIPLINAR } = {}) {
  const lista = filtrarPeriodo(registros, de, ate);
  const periodo = `${dataBR(de || lista[0]?.data)} a ${dataBR(ate || lista[lista.length - 1]?.data)}`;
  const cfg = { acesso: ["Acesso — CCO", "AC"], intervalo: ["Intervalos — CCO", "IN"], supervisao: ["Visitas de Supervisão — CCO", "SU"], manutencao: ["Manutenção — CCO", "MA"] }[tema];
  const numero = `MK-${project.id}-${cfg[1]}-${MMDD(agora)}`;
  let cpfs = 0; const mask = (t) => { const r = mascararCPF(t); cpfs += r.mascarados; return r.texto; };
  const sit = (r) => r.arquivado ? '<span class="mk-mu">arquivado</span>' : "ativo";
  let corpo = "", conf = [], cauda = "", sub = `<b>${escHTML(project.id)} — ${escHTML(project.name || "")}</b> · ${periodo} · ${lista.length} registro(s)`;
  const vazio = '<div class="mk-vazio"><div class="mk-big">0</div><div class="mk-kl">registros no período</div></div>';

  if (tema === "acesso") {
    const porEmpresa = contagem(lista.map((r) => r.empresa)), porDia = new Set(lista.map((r) => r.data)).size;
    const tur = { diurno: 0, noturno: 0 }; lista.forEach((r) => { const t = turnoPelaHora(r.horaEntrada, project.id); if (t) tur[t]++; });
    corpo = !lista.length ? vazio : `<section class="mk-kpis"><div class="mk-k"><div class="mk-kv">${lista.length}</div><div class="mk-kl">acessos</div><div class="mk-mu mk-sm">em ${porDia} dia(s)</div></div>
      <div class="mk-k"><div class="mk-kv">${porEmpresa.length}</div><div class="mk-kl">empresas/setores</div></div>
      <div class="mk-k"><div class="mk-kv">${tur.diurno}</div><div class="mk-kl">entradas no diurno</div><div class="mk-mu mk-sm">inferido pela jornada do app</div></div>
      <div class="mk-k"><div class="mk-kv">${tur.noturno}</div><div class="mk-kl">entradas no noturno</div></div></section>
      <div class="mk-card" style="margin-bottom:10px"><div class="mk-lb">Acessos por empresa/setor</div>${barrasMoked(porEmpresa.slice(0, 10).map((e) => [e.rotulo, e.n]))}</div>
      <section><div class="mk-h2">Registros</div>${(() => { const t = tabelaComCauda('<table class="mk-tb"><thead><tr><th>Data</th><th>Entrada</th><th>Nome</th><th>Empresa/setor</th><th>Observação</th><th>Situação</th></tr></thead><tbody>',
        lista.map((r) => `<tr><td>${dataBR(r.data)}</td><td>${escHTML(r.horaEntrada || "—")}</td><td><b>${escHTML(r.nome || "—")}</b></td><td>${escHTML(r.empresa || "—")}</td><td class="mk-sm">${escHTML(mask(r.obs || "")) || "—"}</td><td>${sit(r)}</td></tr>`), "</tbody></table>"); cauda = `${t.cauda}<p class="mk-nota">Turnos inferidos pela ${textoJornada(project.id)} — inferência, a confirmar com a escala real.</p>`; return t.principal; })()}</section>`;
    if (interno) {
      const saidaNaEmpresa = lista.filter((r) => /sa[ií]da/i.test(r.empresa || ""));
      if (saidaNaEmpresa.length) conf.push(`<li><b>Saída digitada no campo Empresa:</b> ${saidaNaEmpresa.length} registro(s) (ex.: ${escHTML(saidaNaEmpresa[0].empresa)}). Falta campo próprio de saída.</li>`);
      grafias(lista.map((r) => r.empresa)).forEach((g) => conf.push(`<li><b>Grafias da mesma empresa:</b> ${g.map((x) => `“${escHTML(x)}”`).join(", ")}.</li>`));
      conf.push(blocoCorrespondencia(correspondencia(registros, outros || null, de, ate), "acesso"));   // fonte null = consulta falhou → "não verificado"
    }
  }

  if (tema === "intervalo") {
    const TIPOS = [["cafe1", "Café 1"], ["refeicao", "Refeição"], ["cafe2", "Café 2"]];
    const pessoas = new Map(), dup = new Map(), incons = [], divergTurno = [];
    lista.forEach((r) => (r.colaboradores || []).forEach((c) => {
      const k = c.id ? `id:${c.id}` : `nome:${normalizar(c.nome) || "(sem nome)"}`;
      const p = pessoas.get(k) || { k, id: c.id || null, nome: c.nome || "Sem nome", cargo: c.cargo || "", dias: new Set(), n: 0, dur: { cafe1: [], refeicao: [], cafe2: [] } };
      p.dias.add(r.data);
      TIPOS.forEach(([t]) => { const iv = c.intervalos?.[t]; if (!iv || (!iv.saida && !iv.retorno)) return; p.n++;
        const d = duracaoMin(iv.saida, iv.retorno, r.turno); if (d.min != null) p.dur[t].push(d.min); if (d.inconsistente) incons.push(`${dataBR(r.data)} ${escHTML(c.nome || "")} — ${TIPOS.find((x) => x[0] === t)[1]}: retorno ${escHTML(iv.retorno)} antes da saída ${escHTML(iv.saida)}`); });
      pessoas.set(k, p);
      const assinatura = `${r.data}|${k}|${TIPOS.map(([t]) => `${c.intervalos?.[t]?.saida || ""}-${c.intervalos?.[t]?.retorno || ""}`).join("|")}`;
      dup.set(assinatura, [...(dup.get(assinatura) || []), r.turno]);
      const primeira = TIPOS.map(([t]) => c.intervalos?.[t]?.saida).find(Boolean);
      const tp = turnoPelaHora(primeira, project.id);
      if (tp && r.turno && tp !== r.turno) divergTurno.push(`${dataBR(r.data)} ${escHTML(c.nome || "")}: lançado ${TURNO_TXT[r.turno] || r.turno}, saída às ${escHTML(primeira)}`);
    }));
    const media = (a) => a.length ? `${Math.round(a.reduce((x, y) => x + y, 0) / a.length)} min` : "—";
    const linhas = rotulosColaboradoras([...pessoas.values()]).sort((a, b) => a.rotulo.localeCompare(b.rotulo));
    const semId = linhas.filter((p) => !p.id);
    corpo = !lista.length ? vazio : `<section class="mk-kpis"><div class="mk-k"><div class="mk-kv">${lista.length}</div><div class="mk-kl">registros de turno</div><div class="mk-mu mk-sm">${lista.filter((r) => r.arquivado).length} arquivado(s) · ativos e arquivados somados</div></div>
      <div class="mk-k"><div class="mk-kv">${linhas.length}</div><div class="mk-kl">colaboradores</div></div>
      <div class="mk-k"><div class="mk-kv">${linhas.reduce((s, p) => s + p.n, 0)}</div><div class="mk-kl">intervalos registrados</div></div>
      <div class="mk-k"><div class="mk-kv">${new Set(lista.map((r) => r.data)).size}</div><div class="mk-kl">dias com registro</div></div></section>
      <section><div class="mk-h2">Resumo por colaborador <span class="mk-mu">— duração média como dado, sem faixa de referência</span></div><table class="mk-tb"><thead><tr><th>Colaborador</th><th class="mk-num">Dias</th><th class="mk-num">Intervalos</th><th class="mk-num">Café 1</th><th class="mk-num">Refeição</th><th class="mk-num">Café 2</th></tr></thead><tbody>
      ${linhas.map((p) => `<tr><td><b>${escHTML(p.rotulo)}</b>${p.cargo ? `<div class="mk-mu">${escHTML(p.cargo)}</div>` : ""}${p.id ? "" : '<div class="mk-mu">agregado por nome (sem identificador)</div>'}</td><td class="mk-num">${p.dias.size}</td><td class="mk-num">${p.n}</td><td class="mk-num">${media(p.dur.cafe1)}</td><td class="mk-num">${media(p.dur.refeicao)}</td><td class="mk-num">${media(p.dur.cafe2)}</td></tr>`).join("")}</tbody></table>
      <p class="mk-nota">Duração considerada só com saída e retorno registrados; virada da meia-noite apenas em turno noturno.</p></section>
      ${comAnexo ? `<section style="page-break-before:always"><div class="mk-h2">Anexo — registros detalhados</div><table class="mk-tb"><thead><tr><th>Data</th><th>Turno</th><th>Colaborador</th><th>Café 1</th><th>Refeição</th><th>Café 2</th><th>Situação</th></tr></thead><tbody>
      ${lista.flatMap((r) => (r.colaboradores || []).map((c) => `<tr><td>${dataBR(r.data)}</td><td>${escHTML(TURNO_TXT[r.turno] || r.turno || "—")}</td><td>${escHTML(c.nome || "—")}</td>${TIPOS.map(([t]) => { const iv = c.intervalos?.[t]; return `<td>${iv && (iv.saida || iv.retorno) ? `${escHTML(iv.saida || "—")}–${escHTML(iv.retorno || "—")}` : "—"}</td>`; }).join("")}<td>${sit(r)}</td></tr>`)).join("")}</tbody></table></section>` : ""}`;
    if (interno) {
      const dups = [...dup.entries()].filter(([, ts]) => ts.length > 1);
      if (semId.length) conf.push(`<li><b>Agregado por nome</b> (sem identificador no registro; homônimos não podem ser separados): ${semId.map((p) => escHTML(p.nome)).join(", ")}.</li>`);
      if (dups.length) conf.push(`<li><b>Registros duplicados</b> (mesmo dia, colaborador e horários): ${dups.length} caso(s)${dups.some(([, ts]) => new Set(ts).size > 1) ? ", inclusive lançados em turnos diferentes" : ""}.</li>`);
      if (divergTurno.length) conf.push(`<li><b>Turno lançado × ${notaJornada(project.id)}</b>: ${divergTurno.slice(0, 8).join("; ")}${divergTurno.length > 8 ? `; e mais ${divergTurno.length - 8}` : ""}.</li>`);
      if (incons.length) conf.push(`<li><b>Retorno antes da saída</b> fora de turno noturno (sem duração calculada): ${incons.slice(0, 8).join("; ")}.</li>`);
    }
  }

  if (tema === "supervisao") {
    let omitidos = 0, ocultos = 0; const ondeOmitiu = [];
    const porSup = contagem(lista.map((r) => r.supervisor));
    const durs = [], divergencias = [], incons = [];
    let trocados = 0, abertos = 0; const naoReconhecidas = [];
    const linhas = lista.map((r) => {
      const d = duracaoMin(r.chegada, r.saida, r.turno); if (d.min != null) durs.push(d.min); if (d.inconsistente) incons.push(`${dataBR(r.data)} ${escHTML(r.supervisor || "")}: saída ${escHTML(r.saida)} antes da chegada ${escHTML(r.chegada)}`);
      const tp = turnoPelaHora(r.chegada, project.id); if (tp && r.turno && tp !== r.turno) divergencias.push(`${dataBR(r.data)} ${escHTML(r.supervisor || "")}: lançado ${TURNO_TXT[r.turno] || r.turno}, chegada às ${escHTML(r.chegada)}`);
      const eqs = (r.equipamentos || []).filter((e) => e.acao); trocados += eqs.filter((e) => e.acao === "trocado").length; abertos += eqs.filter((e) => e.acao === "aberto").length;
      eqs.filter((e) => acaoEquipamento(e.acao).tipo === "desconhecida").forEach((e) => naoReconhecidas.push(`${dataBR(r.data)} ${escHTML(e.catLabel || "")}: «${escHTML(e.acao)}»`));
      const disc = tratarDisciplinar(mask(r.resumo || ""), { interno, modo: modoDisciplinar });
      omitidos += disc.omitidos; if (disc.oculto && r.resumo) ocultos++;
      if (interno && temConteudoDisciplinar(r.resumo)) ondeOmitiu.push(`${dataBR(r.data)} ${escHTML(r.supervisor || "")}`);
      return `<tr><td>${dataBR(r.data)}${r.arquivado ? '<div class="mk-mu">arquivado</div>' : ""}</td><td><b>${escHTML(r.supervisor || "—")}</b><div class="mk-mu">${escHTML(TURNO_TXT[r.turno] || r.turno || "")}</div></td><td>${escHTML(r.chegada || "—")}–${escHTML(r.saida || "—")}</td><td class="mk-num">${d.min != null ? `${d.min} min` : "—"}</td>
        ${disc.oculto ? "" : `<td class="mk-sm">${escHTML(disc.texto) || "—"}</td>`}<td class="mk-sm">${eqs.map((e) => { const a = acaoEquipamento(e.acao); return `<span class="${a.tipo === "aberto" ? "mk-inv" : a.tipo === "trocado" ? "mk-sim" : ""}">${a.rotulo}</span>: ${escHTML(e.catLabel || "")}${e.identificacao ? ` (${escHTML(e.identificacao)})` : ""}`; }).join("<br>") || "—"}</td></tr>`;
    });
    const ocultaCol = !interno && (modoDisciplinar === "B" || modoDisciplinar === "pendente");
    corpo = !lista.length ? vazio : `<section class="mk-kpis"><div class="mk-k"><div class="mk-kv">${lista.length}</div><div class="mk-kl">visitas</div></div>
      <div class="mk-k"><div class="mk-kv">${porSup.length}</div><div class="mk-kl">supervisores</div></div>
      <div class="mk-k"><div class="mk-kv">${durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) + " min" : "—"}</div><div class="mk-kl">duração média</div><div class="mk-mu mk-sm">chegada → saída</div></div>
      <div class="mk-k"><div class="mk-kv">${trocados}</div><div class="mk-kl">equipamentos trocados</div><div class="mk-sm ${abertos ? "mk-wa" : "mk-mu"}"><b>${abertos}</b> em aberto (pendente)</div></div></section>
      ${abertos ? `<section class="mk-dest"><ul><li><b>${abertos}</b> equipamento(s) seguem em aberto após a visita de supervisão.</li></ul></section>` : ""}
      <div class="mk-card" style="margin-bottom:10px"><div class="mk-lb">Visitas por supervisor</div>${barrasMoked(porSup.map((e) => [e.rotulo, e.n]))}</div>
      <section><div class="mk-h2">Visitas</div>${(() => { const t = tabelaComCauda(`<table class="mk-tb"><thead><tr><th>Data</th><th>Supervisor</th><th>Chegada–saída</th><th class="mk-num">Duração</th>${ocultaCol ? "" : "<th>Observação</th>"}<th>Equipamentos</th></tr></thead><tbody>`, linhas, "</tbody></table>"); cauda = t.cauda; return t.principal; })()}
      ${ocultaCol ? `<p class="mk-nota">${modoDisciplinar === "pendente" ? "Observações da supervisão não exibidas nesta versão: decisão sobre conteúdo de uso interno pendente." : "Observações da supervisão disponíveis apenas na versão interna."}</p>` : ""}
      ${omitidos ? `<p class="mk-nota">${omitidos} trecho(s) de uso interno omitido(s) nesta versão.</p>` : ""}</section>`;
    if (interno) {
      if (divergencias.length) conf.push(`<li><b>Turno lançado × ${notaJornada(project.id)}</b>: ${divergencias.join("; ")}.</li>`);
      if (naoReconhecidas.length) conf.push(`<li><b>Ação de equipamento não reconhecida</b> (dado mantido como registrado): ${naoReconhecidas.join("; ")}.</li>`);
      if (incons.length) conf.push(`<li><b>Saída antes da chegada</b> fora de turno noturno: ${incons.join("; ")}.</li>`);
      if (ondeOmitiu.length) conf.push(`<li><b>Conteúdo disciplinar</b> (expressões detectadas — detecção por texto, não revisão completa): ${ondeOmitiu.join("; ")}. Tratamento na versão cliente: ${{ A: "frases omitidas", B: "observação oculta", C: "exibido", pendente: "observação oculta — decisão pendente" }[modoDisciplinar]}.</li>`);
    }
  }

  if (tema === "manutencao") {
    const hoje = isoLocal(agora);
    const st = { concluida: 0, parcial: 0, pendente: 0 }; lista.forEach((r) => { if (st[r.status] != null) st[r.status]++; });
    const abertos = lista.filter((r) => r.status === "pendente" || r.status === "parcial").map((r) => ({ r, dias: diasEntreDatas(r.data, hoje) })).sort((a, b) => b.dias - a.dias);
    const porSistema = contagem(lista.map((r) => r.sistema)), porEmpresa = contagem(lista.map((r) => r.empresa));
    corpo = !lista.length ? vazio : `<section class="mk-kpis"><div class="mk-k"><div class="mk-kv">${lista.length}</div><div class="mk-kl">registros</div><div class="mk-mu mk-sm">${st.concluida} concluída(s)</div></div>
      <div class="mk-k"><div class="mk-kv ${st.pendente ? "mk-da" : ""}">${st.pendente}</div><div class="mk-kl">pendentes</div></div>
      <div class="mk-k"><div class="mk-kv ${st.parcial ? "mk-wa" : ""}">${st.parcial}</div><div class="mk-kl">parciais</div></div>
      <div class="mk-k"><div class="mk-kv">${abertos.length ? abertos[0].dias + " d" : "—"}</div><div class="mk-kl">mais antigo em aberto</div><div class="mk-mu mk-sm">${abertos.length ? `${escHTML(abertos[0].r.sistema || "")} · desde ${dataBR(abertos[0].r.data)}` : ""}</div></div></section>
      <div class="mk-duas"><div class="mk-card"><div class="mk-lb">Por sistema</div>${barrasMoked(porSistema.slice(0, 8).map((e) => [e.rotulo, e.n]))}</div><div class="mk-card"><div class="mk-lb">Por empresa</div>${barrasMoked(porEmpresa.slice(0, 8).map((e) => [e.rotulo, e.n]))}</div></div>
      <section><div class="mk-h2">Registros <span class="mk-mu">— mais recentes primeiro</span></div>${(() => { const t = tabelaComCauda(`<table class="mk-tb"><colgroup><col style="width:11%"><col style="width:15%"><col style="width:12%"><col style="width:10%"><col style="width:9%"><col style="width:43%"></colgroup>
      <thead><tr><th>Data</th><th>Empresa · técnico</th><th>Sistema</th><th>Status</th><th class="mk-num">Em aberto</th><th>Serviço</th></tr></thead><tbody>`, [...lista].reverse().map((r) => { const [txt, cls] = STATUS_TXT[r.status] || [escHTML(r.status || "—"), "mk-b-in"]; const ab = (r.status === "pendente" || r.status === "parcial") ? `${diasEntreDatas(r.data, hoje)} d` : "—";
        return `<tr><td>${dataBR(r.data)}</td><td><b>${escHTML(r.empresa || "—")}</b><div class="mk-mu">${escHTML(r.tecnico || "")}</div></td><td>${escHTML(r.sistema || "—")}</td><td><span class="mk-b ${cls}">${txt}</span>${r.arquivado ? '<div class="mk-mu">arquivado</div>' : ""}</td><td class="mk-num">${ab}</td><td class="mk-sm">${escHTML(mask([r.servico, r.obs].filter(Boolean).join(" · "))) || "—"}</td></tr>`; }), "</tbody></table>"); cauda = t.cauda; return t.principal; })()}</section>`;
    if (interno) {
      const concAtivas = lista.filter((r) => r.status === "concluida" && !r.arquivado).length;
      if (concAtivas) conf.push(`<li><b>Concluídas ainda ativas</b> (não arquivadas): ${concAtivas} — informativo.</li>`);
      grafias(lista.map((r) => r.empresa)).forEach((g) => conf.push(`<li><b>Grafias da mesma empresa:</b> ${g.map((x) => `“${escHTML(x)}”`).join(", ")}.</li>`));
      conf.push(blocoCorrespondencia(correspondencia(outros || null, registros, de, ate), "manutencao"));
    }
  }

  // Fecho junto da assinatura: a cauda da tabela + (na interna) a conferência — nunca a assinatura sozinha.
  const fecho = `${cauda}${interno ? conferencia(conf, cpfs ? notaCPF(cpfs) : "") : ""}`;
  return { html: documentoMoked({ project, titulo: cfg[0], subtitulo: sub, numero, corpo, interno, hoje: agora, fecho }), numero, cpfsMascarados: cpfs, registros: lista.length };
}
