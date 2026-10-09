import { RECICLAGEM_ANOS, RECICLAGEM_ALERTA_DIAS } from '../pendencias';
// Motor puro: nenhum acesso ao banco, relógio global ou alteração dos registros.
export const CONFIG_MATURIDADE = Object.freeze({
  pesos: { assiduidade: 30, ft: 15, treinamento: 20, reciclagem: 20, tempoCasa: 15 },
  coberturaMinimaDias: 90, falta: 10, diaAdicional: 2, tetoFalta: 30,
  atraso: 2, tetoAtrasos: 20, ftBase: 50, ftIncremento: 10,
  // Equivalência com pendencias.js: dia zero ainda é alerta; vencido somente < 0.
  reciclagemAlertaDias: RECICLAGEM_ALERTA_DIAS,
});
const DIA = 86400000;
function data(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor || '')) return null;
  const d = new Date(`${valor}T12:00:00Z`);
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === valor ? +d : null;
}
export function calcularRH(colaborador, historicoDesde, hoje, config = CONFIG_MATURIDADE) {
  const fim = data(hoje);
  if (fim === null) throw new Error('Data de referência inválida');
  const cobertura = data(historicoDesde);
  const admissao = data(colaborador.dataContratacao);
  const ano = new Date(fim); ano.setUTCFullYear(ano.getUTCFullYear() - 1);
  const inicio = Math.max(+ano, cobertura ?? fim, admissao ?? +ano);
  const aferido = cobertura !== null && (fim - inicio) / DIA >= config.coberturaMinimaDias;
  const registros = Array.isArray(colaborador.historico) ? colaborador.historico : [];
  const abertos = registros.filter(h => h.tipo === 'Falta' && (h.emAberto || (h.subtipo === 'Indeterminado' && h.emAberto !== false)) && data(h.data) !== null && data(h.data) <= fim);
  const afastado = abertos.some(h => (fim - data(h.data)) / DIA > 30);
  const alertas = abertos.length ? ['Afastamento em aberto'] : [];
  if (!aferido) return { assiduidade: null, ft: null, afastado, alertas, inicio: null };
  let penalidade = 0, atrasos = 0, fts = 0;
  for (const h of registros) {
    const dia = data(h.data);
    if (dia === null || dia < inicio || dia > fim) continue;
    if (h.tipo === 'FT') fts++;
    if (h.tipo === 'Atraso') atrasos++;
    if (h.tipo !== 'Falta' || h.emAberto || h.subtipo === 'Indeterminado') continue;
    let dias = 1;
    if (h.subtipo === 'Período') {
      const retorno = data(h.dataFim);
      dias = retorno !== null && retorno >= dia ? Math.floor((retorno - dia) / DIA) + 1 : Number(h.diasFalta);
      if (!Number.isFinite(dias) || dias < 1) return { assiduidade: null, ft: Math.min(100, config.ftBase + registros.filter(r => r.tipo === 'FT' && data(r.data) !== null && data(r.data) >= inicio && data(r.data) <= fim).length * config.ftIncremento), afastado, alertas: [...alertas, 'Período de falta inválido'], inicio };
    }
    penalidade += Math.min(config.tetoFalta, config.falta + (dias - 1) * config.diaAdicional) * (h.justificada === true ? 0.5 : 1);
  }
  return { assiduidade: Math.max(0, 100 - penalidade - Math.min(config.tetoAtrasos, atrasos * config.atraso)), ft: Math.min(100, config.ftBase + fts * config.ftIncremento), afastado, alertas, inicio };
}
export function agregarEixos(eixos, pesos = CONFIG_MATURIDADE.pesos) {
  let soma = 0, peso = 0;
  const naoAferidos = [];
  for (const [nome, p] of Object.entries(pesos)) {
    const valor = eixos[nome];
    if (typeof valor !== 'number' || !Number.isFinite(valor)) { naoAferidos.push(nome); continue; }
    soma += Math.max(0, Math.min(100, valor)) * p; peso += p;
  }
  const indice = peso ? soma / peso : null;
  const classe = indice === null ? 'Não aferido' : indice >= 85 ? 'Referência' : indice >= 70 ? 'Consolidado' : indice >= 50 ? 'Em desenvolvimento' : 'Atenção';
  return { indice, eixos, naoAferidos, classe };
}

const normalizar = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
export function calcularTreinamento(colaborador, catalogo, hoje) {
  const fim = data(hoje);
  if (fim === null) throw new Error('Data de referência inválida');
  const obrigatorios = (Array.isArray(catalogo) ? catalogo : []).filter(t => t.obrigatorio && normalizar(t.nome));
  if (!obrigatorios.length) return null;
  const registros = (colaborador.historico || []).filter(h => h.tipo === 'Treinamento');
  const validos = obrigatorios.filter(t => registros.some(h => {
    const realizado = data(h.data);
    if (realizado === null || realizado > fim || normalizar(h.detalhe) !== normalizar(t.nome)) return false;
    if (t.validadeMeses === undefined || t.validadeMeses === null) return true;
    if (!Number.isInteger(t.validadeMeses) || t.validadeMeses <= 0) return false;
    const vence = new Date(realizado); vence.setUTCMonth(vence.getUTCMonth() + t.validadeMeses);
    return +vence >= fim;
  }));
  return validos.length / obrigatorios.length * 100;
}

export function calcularEstabilidade(equipe, hoje) {
  const fim = data(hoje);
  if (fim === null) throw new Error('Data de referência inválida');
  const inicio = new Date(fim); inicio.setUTCFullYear(inicio.getUTCFullYear() - 1);
  const ativos = (equipe.colaboradores || []).filter(c => (c.status || 'ativo') === 'ativo');
  const desligados = equipe.desligados || [];
  const naJanela = d => d !== null && d >= +inicio && d <= fim;
  const saidas = desligados.filter(c => naJanela(data(c.desligadoEm))).length;
  const entradas = ativos.filter(c => naJanela(data(c.dataContratacao))).length;
  const efetivoMedio = (ativos.length * 2 + saidas - entradas) / 2;
  const incompleto = desligados.some(c => data(c.desligadoEm) === null) || ativos.some(c => data(c.dataContratacao) === null);
  const turnover = incompleto || efetivoMedio < 3 ? null : saidas / efetivoMedio * 100;
  return { efetivoMedio, desligados12m: saidas, turnover, estabilidade: turnover === null ? null : Math.max(0, 100 - 2 * turnover) };
}

export function agregarEquipe(individuos, estabilidade) {
  const elegiveis = individuos.filter(c => !c.afastado && typeof c.indice === 'number' && Number.isFinite(c.indice));
  const media = elegiveis.length ? elegiveis.reduce((s, c) => s + c.indice, 0) / elegiveis.length : null;
  const indice = media === null ? null : estabilidade === null ? media : 0.8 * media + 0.2 * estabilidade;
  const classe = indice === null ? 'Não aferido' : indice >= 85 ? 'Referência' : indice >= 70 ? 'Madura' : indice >= 50 ? 'Em consolidação' : 'Em formação';
  return { indice, classe, media, quantidadeAferida: elegiveis.length };
}

export function calcularTempoCasa(admissao, hoje) {
  const inicio = data(admissao), fim = data(hoje);
  if (inicio === null || fim === null || inicio > fim) return null;
  const a = new Date(inicio), b = new Date(fim);
  const meses = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
  return meses < 3 ? 20 : meses < 12 ? 50 : meses <= 36 ? 80 : 100;
}

export function calcularReciclagem(colaborador, hoje) {
  const naoRecicla = ['cda', 'porteiro', 'porteirocco', 'recepcao', 'recepcionista', 'agp', 'agpcco'];
  const cargo = normalizar(colaborador.cargo);
  if (!cargo || naoRecicla.includes(cargo)) return { valor: null, estado: 'não se aplica', diasRestantes: null };
  if (data(colaborador.ultimaReciclagem) === null || Number(colaborador.ultimaReciclagem.slice(0, 4)) < 2000 || Number(colaborador.ultimaReciclagem.slice(0, 4)) > 2100) return { valor: null, estado: 'sem-data', diasRestantes: null };
  if (data(hoje) === null) throw new Error('Data de referência inválida');
  const vencimento = new Date(`${colaborador.ultimaReciclagem}T12:00:00`);
  vencimento.setFullYear(vencimento.getFullYear() + RECICLAGEM_ANOS);
  const diasRestantes = Math.floor((+vencimento - +new Date(`${hoje}T12:00:00`)) / DIA);
  const estado = diasRestantes < 0 ? 'vencido' : diasRestantes <= CONFIG_MATURIDADE.reciclagemAlertaDias ? 'alerta' : 'ok';
  return { valor: estado === 'vencido' ? 0 : estado === 'alerta' ? 60 : 100, estado, diasRestantes, vencimento };
}

// Cobertura de treinamentos REGISTRADOS nas fichas (historico[].tipo === 'Treinamento').
// Indicador distinto da conclusão de obrigatórios (calcularTreinamento, que depende de catálogo).
// Conta PESSOAS distintas, não cursos; janela = últimos 12 meses até `hoje`.
//  - registro vazio (sem detalhe) é descartado;
//  - registro futuro (data > hoje) não conta como realizado;
//  - registro antigo (< 12 meses atrás) ou sem data válida fica como histórico, sem inflar a cobertura.
export function classificarTreinamentos(colaborador, hoje) {
  const fim = data(hoje);
  if (fim === null) throw new Error('Data de referência inválida');
  const inicio = new Date(fim); inicio.setUTCFullYear(inicio.getUTCFullYear() - 1);
  const registros = (Array.isArray(colaborador.historico) ? colaborador.historico : [])
    .filter(h => h && h.tipo === 'Treinamento' && String(h.detalhe || '').trim());
  const recentes = [], antigos = [], semData = [], futuros = [];
  for (const h of registros) {
    const d = data(h.data);
    if (d === null) semData.push(h);
    else if (d > fim) futuros.push(h);
    else if (d >= +inicio) recentes.push(h);
    else antigos.push(h);
  }
  const ordenar = lista => [...lista].sort((x, y) => String(y.data || '').localeCompare(String(x.data || '')));
  return { recentes: ordenar(recentes), antigos: ordenar(antigos), semData, futuros: ordenar(futuros), registros: recentes.length + antigos.length + semData.length };
}

export function resumirTreinamentos(colaboradores, hoje) {
  const pessoas = colaboradores.map(c => {
    const t = classificarTreinamentos(c, hoje);
    return { id: c.id, registros: t.registros, recentes: t.recentes.length, antigos: t.antigos.length, semData: t.semData.length, futuros: t.futuros.length };
  });
  const total = pessoas.length;
  const comRegistro = pessoas.filter(p => p.registros > 0).length;
  const comRegistro12m = pessoas.filter(p => p.recentes > 0).length;
  const somenteHistorico = pessoas.filter(p => p.recentes === 0 && (p.antigos > 0 || p.semData > 0)).length;
  const comFuturo = pessoas.filter(p => p.futuros > 0).length;
  return { pessoas, total, comRegistro, comRegistro12m, somenteHistorico, comFuturo, janelaMeses: 12,
    percentual12m: total && comRegistro ? 100 * comRegistro12m / total : null };
}

export const TITULO_TREINAMENTOS = 'Treinamentos aplicados — últimos 12 meses';
export const SEM_TREINAMENTO = 'Não aferido — sem treinamento registrado nas fichas';

// Linha principal do indicador ("8 de 16 colaboradores com registro — 50%") e nota complementar.
export function rotuloTreinamentos(resumo) {
  if (!resumo || !resumo.comRegistro) return SEM_TREINAMENTO;
  return `${resumo.comRegistro12m} de ${resumo.total} colaboradores com registro — ${Math.round(resumo.percentual12m)}%`;
}
export function notaTreinamentos(resumo) {
  if (!resumo || !resumo.comRegistro) return 'Ausência de registro não prova que a pessoa nunca recebeu treinamento.';
  const partes = [];
  if (resumo.somenteHistorico) partes.push(`${resumo.somenteHistorico} só com registro antigo ou sem data (histórico, fora da janela)`);
  if (resumo.comFuturo) partes.push(`${resumo.comFuturo} com treinamento agendado (não contado)`);
  if (!resumo.comRegistro12m) partes.unshift('nenhum registro dentro dos últimos 12 meses');
  return partes.length ? partes.join('; ') + '.' : `${resumo.comRegistro} de ${resumo.total} com algum registro na ficha.`;
}

export function calcularMapaEquipe(equipe, hoje) {
  const fim = data(hoje);
  if (fim === null) throw new Error('Data de referência inválida');
  const individuos = (equipe.colaboradores || []).filter(c => (c.status || 'ativo') === 'ativo').map(c => {
    const rh = calcularRH(c, equipe.historicoDesde, hoje);
    const reciclagem = calcularReciclagem(c, hoje);
    const resultado = agregarEixos({ assiduidade: rh.assiduidade, ft: rh.ft, treinamento: calcularTreinamento(c, equipe.treinamentosEsperados, hoje), reciclagem: reciclagem.valor, tempoCasa: calcularTempoCasa(c.dataContratacao, hoje) });
    const alertas = [...rh.alertas];
    if (['vencido', 'alerta'].includes(reciclagem.estado)) alertas.push(`Reciclagem ${reciclagem.estado === 'vencido' ? 'vencida' : 'vencendo'}`);
    if (resultado.eixos.treinamento !== null && resultado.eixos.treinamento < 100) alertas.push('Treinamento obrigatório pendente');
    const faltas = (c.historico || []).filter(h => h.tipo === 'Falta' && rh.inicio !== null && data(h.data) !== null && data(h.data) >= rh.inicio && data(h.data) <= fim).length;
    if (faltas > 3) alertas.push(`${faltas} faltas no período aferido`);
    const ferias = (equipe.ferias || []).filter(f => f.colabId === c.id && data(f.dataInicio) !== null && data(f.dataInicio) >= fim).sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
    if (ferias.some(f => data(f.dataInicio) <= fim + 30 * DIA && !String(f.cobertura || '').trim())) alertas.push('Férias nos próximos 30 dias sem cobertura');
    return { ...resultado, colaborador: c, afastado: rh.afastado, reciclagem, alertas, ferias, faltas };
  });
  const estabilidade = calcularEstabilidade(equipe, hoje);
  const elegiveis = individuos.filter(i => !i.afastado);
  const eixos = Object.fromEntries(Object.keys(CONFIG_MATURIDADE.pesos).map(k => {
    const valores = elegiveis.map(i => i.eixos[k]).filter(v => typeof v === 'number' && Number.isFinite(v));
    return [k, valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null];
  }));
  const ordenados = elegiveis.filter(i => i.indice !== null).sort((a, b) => b.indice - a.indice || a.colaborador.nome.localeCompare(b.colaborador.nome));
  const corte = ordenados[Math.min(2, ordenados.length - 1)]?.indice;
  const treinamentos = resumirTreinamentos(individuos.map(i => i.colaborador), hoje);
  individuos.forEach(i => { i.treinamentosRegistrados = treinamentos.pessoas.find(p => p.id === i.colaborador.id); i.treinamentosFicha = classificarTreinamentos(i.colaborador, hoje); });
  return { hoje, individuos, eixos, treinamentos, ...estabilidade, ...agregarEquipe(individuos, estabilidade.estabilidade), top: ordenados.filter(i => i.indice >= corte), alertas: individuos.flatMap(i => i.alertas.map(texto => ({ colabId: i.colaborador.id, nome: i.colaborador.nome, texto }))) };
}
