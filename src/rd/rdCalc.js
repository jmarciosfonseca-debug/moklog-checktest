// MK RD — regras puras do dia em trechos encadeados. Sem React, sem rede: tudo testável.
// Vocabulário: trecho = deslocamento origem→destino; o dia é a corrente de trechos.
// Regra do Marcio: chegar NUNCA abre o próximo trecho. A saída só é cravada quando ele abrir o seguinte.

export const DESTINOS_FIXOS = [
  { codigo: "MK_HOME", rotulo: "MK Home", sub: "Casa" },
  { codigo: "MK_OFFICE", rotulo: "MK Office", sub: "Escritório / diretoria" },
];

export const DESTINOS_PROJETOS = [
  ["MK260A", "Jatinox Embu A"], ["MK260B", "Jatinox Embu B"], ["MK260C", "Jatinox Embu C"],
  ["MK311A", "Mega CL Curitiba"], ["MK311B", "Mega CL Itajaí"],
  ["MK505", "Klog Embu"],
  ["MK601", "Golgi Seropédica"], ["MK602", "Golgi Mauá I"], ["MK604", "Golgi Jundiaí"],
  ["MK605", "Golgi Mauá II"], ["MK606", "Golgi Cajamar"], ["MK607", "Golgi Guarulhos"],
].map(([codigo, sub]) => ({ codigo, rotulo: codigo, sub }));

export const normalizarCodigoNovo = (entrada) => {
  const puro = String(entrada || "").toUpperCase().replace(/^MK[\s-]*/, "").replace(/[^A-Z0-9]/g, "");
  return puro ? "MK" + puro : null;
};

// Cascata do seletor: fixos + rotina + fora da rotina já visitados (memória).
export function listarDestinos(memoria) {
  const extras = (memoria?.destinosExtras || []).map((d) => ({ codigo: d.codigo, rotulo: d.codigo, sub: d.sub || "Fora da rotina" }));
  return [...DESTINOS_FIXOS, ...DESTINOS_PROJETOS, ...extras];
}

export const rotuloDestino = (memoria, codigo) =>
  listarDestinos(memoria).find((d) => d.codigo === codigo)?.rotulo || codigo;

export const novoIdTrecho = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
export const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const kmFmt = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " km");

export function kmDoTrecho(t) {
  const a = num(t?.kmInicial), b = num(t?.kmFinal);
  if (a == null || b == null) return null;
  return b >= a ? Math.round((b - a) * 10) / 10 : null;
}

export const trechoAberto = (dia) => (dia?.trechos || []).find((t) => !t.chegada) || null;
export const ultimoFechado = (dia) => [...(dia?.trechos || [])].reverse().find((t) => t.chegada) || null;

// Km inicial herdado do km final do trecho anterior (editável na tela).
export const herdarKmInicial = (dia) => num(ultimoFechado(dia)?.kmFinal);

// Onde o consultor está agora (destino do último trecho fechado) — vira a origem do próximo.
export const origemAtual = (dia) => ultimoFechado(dia)?.destino || "MK_HOME";

const chaveRota = (origem, destino) => origem + ">" + destino;

// Memória viva: média de km por rota e pedágios da última viagem. Edição do consultor atualiza a memória.
export function projetarKmFinal(memoria, origem, destino, kmInicial) {
  const base = num(kmInicial);
  if (base == null) return null;
  const rota = memoria?.rotas?.[chaveRota(origem, destino)];
  const inversa = memoria?.rotas?.[chaveRota(destino, origem)];
  const kmRef = rota?.kmMedia ?? inversa?.kmMedia;
  return kmRef == null ? null : Math.round((base + kmRef) * 10) / 10;
}

export function pedagiosSugeridos(memoria, origem, destino) {
  const rota = memoria?.rotas?.[chaveRota(origem, destino)];
  const inversa = memoria?.rotas?.[chaveRota(destino, origem)];
  return (rota?.pedagios || inversa?.pedagios || []).map((p) => ({ ...p }));
}

// Chamado quando um trecho fecha: grava km e pedágios reais daquela rota.
export function memoriaAposTrecho(memoria, trecho) {
  const km = kmDoTrecho(trecho);
  const m = { ...(memoria || {}), rotas: { ...(memoria?.rotas || {}) } };
  const chave = chaveRota(trecho.origem, trecho.destino);
  const antes = m.rotas[chave] || { viagens: 0, kmMedia: null };
  const viagens = antes.viagens + 1;
  m.rotas[chave] = {
    viagens,
    kmMedia: km == null ? antes.kmMedia : Math.round(((antes.kmMedia ?? km) * antes.viagens + km) / viagens * 10) / 10,
    pedagios: (trecho.pedagios || []).filter((p) => num(p.valor) != null).map((p) => ({ descricao: p.descricao || "Pedágio", valor: num(p.valor) })),
  };
  if (!listarDestinos(m).some((d) => d.codigo === trecho.destino))
    m.destinosExtras = [...(m.destinosExtras || []), { codigo: trecho.destino, sub: "Fora da rotina" }];
  return m;
}

// Tratativas: "aberto" vira lembrete na próxima visita ao projeto; "finalizado" dá baixa; sem marca não gera nada.
export function pendenciasDoDestino(memoria, destino) {
  return (memoria?.pendencias?.[destino] || []).map((p) => ({ ...p }));
}

export function memoriaAposVisita(memoria, destino, atividades, dataDia) {
  const m = { ...(memoria || {}), pendencias: { ...(memoria?.pendencias || {}) } };
  const anteriores = m.pendencias[destino] || [];
  const finalizadas = new Set((atividades || []).filter((a) => a.status === "finalizado").map((a) => a.texto));
  const mantidas = anteriores.filter((p) => !finalizadas.has(p.texto) && !(atividades || []).some((a) => a.texto === p.texto));
  const novas = (atividades || []).filter((a) => a.status === "aberto").map((a) => ({ texto: a.texto, desde: a.desde || dataDia }));
  m.pendencias[destino] = [...mantidas, ...novas].slice(0, 30);
  if (!m.pendencias[destino].length) delete m.pendencias[destino];
  return m;
}

const hhmm = (iso) => (iso ? String(iso).slice(11, 16) : "—");
export const horaDe = (marco) => hhmm(marco?.em);

// Permanência no cliente = da chegada do trecho N até a abertura do trecho N+1.
export function permanencias(dia) {
  const ts = dia?.trechos || [];
  return ts.map((t, i) => {
    const prox = ts[i + 1];
    if (!t.chegada || !prox?.abertura) return null;
    const ms = new Date(prox.abertura.em) - new Date(t.chegada.em);
    return ms >= 0 ? Math.round(ms / 60000) : null;
  });
}

export const minutosFmt = (min) => (min == null ? "—" : Math.floor(min / 60) + "h" + String(min % 60).padStart(2, "0"));

export function totaisDoDia(dia) {
  const ts = dia?.trechos || [];
  const km = ts.reduce((a, t) => a + (kmDoTrecho(t) || 0), 0);
  const pedagios = ts.reduce((a, t) => a + (t.pedagios || []).reduce((s, p) => s + (num(p.valor) || 0), 0), 0);
  const gastos = ts.reduce((a, t) => a + (t.gastos || []).reduce((s, g) => s + (num(g.valor) || 0), 0), 0);
  const inicio = ts[0]?.abertura?.em || null, fim = ultimoFechado(dia)?.chegada?.em || null;
  return { km: Math.round(km * 10) / 10, pedagios, gastos, inicio, fim, trechos: ts.length };
}

export const hojeISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const dataBR = (iso) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "—");
