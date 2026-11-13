// Painel do projeto — dos documentos do app para os números da régua. PURO: recebe os documentos já lidos e a data de hoje.
// Só sai contagem, função e percentual: nenhum nome de pessoa, telefone, CPF ou foto passa daqui para a tela.
import { categoriasDoTeste, chaveFu } from "../cliente/sis";
import { equipeResumo } from "../cliente/metricas";
import { totalQuadro } from "../equipe/quadroPrevisto";
import { zonasRuinsProjeto, PERIMETRAL_VIA_RONDAS } from "../v360Perimetral";
import { divisaoDoProjeto } from "../divisoes";

// Projetos que recebem nota nesta versão: MokLog, menos P260B e P260C (decisão do Marcio, 12/11/2026 — não fazem teste semanal).
export const FORA_DO_PAINEL = ["P260B", "P260C"];
export const painelDisponivel = (pid) => divisaoDoProjeto(pid) === "moklog" && !FORA_DO_PAINEL.includes(pid);
// KeyAccess só existe nestes 8 (mesma lista do módulo KeyAccess).
const COM_KEYACCESS = ["P601", "P602", "P604", "P605", "P606", "P607", "P311A", "P311B"];
const JANELA = 30;

const DATA = /^(\d{4}-\d{2}-\d{2})/;
const somarDias = (iso, q) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + q); return d.toISOString().slice(0, 10); };
const dia = (v) => { const m = DATA.exec(String(v || "")); return m ? m[1] : null; };
const diasEntre = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
const lista = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);

export function montarDados({ pid, project, history, equipeDoc, mapas, rondaDoc, keyDoc, periDoc, rondasDoc, energiaDoc, ambulancias, sinistroDoc, followupsDoc, intervaloDoc, ctmk, hojeISO, agoraMs }) {
  const ini = somarDias(hojeISO, -JANELA), ontem = somarDias(hojeISO, -1);
  const em30 = (d) => !!d && d > ini && d <= hojeISO;
  const fechados = (d) => !!d && d >= ini && d <= ontem; // 30 dias completos: o plantão de hoje ainda não venceu

  // ── Teste semanal e pendências (itens ruins do último teste, com idade em testes seguidos e tratativa) ──
  const h = lista(history), last = h[h.length - 1];
  let teste = null, pendencias = null;
  if (last && last.state) {
    const ruinsDe = (state) => Object.values(categoriasDoTeste(project, state)).flatMap((g) => g.itens);
    const cats = categoriasDoTeste(project, last.state);
    const total = Object.values(cats).reduce((s, g) => s + g.total, 0), inop = Object.values(cats).reduce((s, g) => s + g.inop, 0), parcial = Object.values(cats).reduce((s, g) => s + g.partial, 0);
    const ruins = ruinsDe(last.state).map((x) => ({ cat: x.cat, item: x.item, status: x.status }));
    const dataTeste = dia(last.meta?.date || last.meta?.data);
    teste = { total, inop, parcial, ruins, diasAtras: dataTeste ? Math.max(0, diasEntre(dataTeste, hojeISO)) : null };
    const fu = Object.fromEntries(lista(followupsDoc?.registros).filter((r) => r.key).map((r) => [r.key, r]));
    const anteriores = h.slice(0, -1).reverse().slice(0, 12).map((r) => new Set(ruinsDe(r.state).map((x) => `${x.cat}|${x.item}`)));
    pendencias = { totalItens: total, lista: ruins.map((x) => { let semanas = 1; for (const s of anteriores) { if (s.has(`${x.cat}|${x.item}`)) semanas++; else break; }
      const r = fu[chaveFu(x.cat, x.item)]; return { ...x, semanas, tratativa: !!(r && Array.isArray(r.entries) && r.entries.length) }; }) };
  }

  // ── Rotina: mapas enviados (2 por dia) e ronda virtual contra a grade ──
  const enviados = new Set(lista(mapas).filter((m) => m.status === "enviado" && fechados(dia(m.data))).map((m) => `${dia(m.data)}|${String(m.turno || "D").toUpperCase().slice(0, 1)}`)).size;
  const mapa = lista(mapas).length ? { enviados, esperados: JANELA * 2 } : null;
  const turnos = lista(rondaDoc?.turnos), turnos30 = turnos.filter((t) => fechados(dia(t.dataInicio)));
  const slots = turnos30.flatMap((t) => lista(Object.values(t.rondas || {})));
  const ronda = { aplica: turnos.length > 0, slots: slots.length, executados: slots.filter((s) => s.inicio && !s.naoExec).length, atrasados: slots.filter((s) => s.atrasada && !s.naoExec).length, naoExec: slots.filter((s) => s.naoExec).length };

  // ── Equipe e capacitação (motores já existentes do SIS+/maturidade) ──
  const eq = equipeDoc || {};
  let res = null; try { res = equipeResumo(eq, hojeISO, eq.treinamentosEsperados || []); } catch { res = null; }
  const ativos = lista(eq.colaboradores).filter((c) => (c.status || "ativo") === "ativo");
  const faltas30 = ativos.flatMap((c) => lista(c.historico)).filter((x) => x.tipo === "Falta" && em30(dia(x.data))).length;
  const equipe = { ativos: ativos.length, previsto: totalQuadro(pid) || null, faltas30, turnover: res && typeof res.turnover === "number" ? res.turnover : null };
  const capacitacao = { ativos: ativos.length, emDia: res && typeof res.treinadosPct === "number" ? Math.round((res.treinadosPct * ativos.length) / 100) : 0 };

  // ── Sistemas críticos ──
  const off = ctmk && ctmk.status === "offline" && ctmk.offlineSince ? Math.max(0, Math.floor((agoraMs - Date.parse(ctmk.offlineSince)) / 86400000)) : 0;
  let zonasRuins = 0; try { zonasRuins = zonasRuinsProjeto(pid, periDoc, rondasDoc) || 0; } catch { zonasRuins = 0; }
  const temPerimetro = PERIMETRAL_VIA_RONDAS.includes(pid) ? lista(rondasDoc?.plantoes).length > 0 : lista(periDoc?.testes).length > 0 || lista(periDoc?.registros).length > 0;
  const sistemas = { ctmk: { aplica: !!ctmk, diasOff: off }, key: { aplica: COM_KEYACCESS.includes(pid), abertas: lista(keyDoc?.registros).filter((r) => !r.horaFim).length }, perimetro: { aplica: temPerimetro, zonasRuins } };

  // ── Ocorrências ──
  const quedas = lista(energiaDoc?.eventos), amb = lista(ambulancias), amb30 = amb.filter((r) => em30(dia(r.data)));
  const sinDia = sinistroDoc && sinistroDoc.houve === true ? dia(sinistroDoc.dataOcorrido) : null;
  const eventos = { energia: { usa: quedas.length > 0, n30: quedas.filter((e) => em30(dia(e.inicioQueda))).length },
    ambulancia: { usa: amb.length > 0, n30: amb30.length, graves30: amb30.filter((r) => r.gravidade === "Grave").length },
    sinistro: { registrado: !!sinistroDoc && typeof sinistroDoc.houve === "boolean", em30: em30(sinDia) } };

  // Intervalos: só informação nesta versão (sem pontos), até existir a régua de "irregular".
  const intervalos = { registros30: lista(intervaloDoc?.registros).filter((r) => em30(dia(r.data))).length };

  return { pid, hojeISO, teste, pendencias, mapa, ronda, equipe, capacitacao, sistemas, eventos, intervalos };
}

// Dados de exemplo do modo demonstração (fictícios).
export const DADOS_DEMO = {
  pid: "DEMO", hojeISO: "2026-11-12",
  teste: { total: 214, inop: 9, parcial: 3, diasAtras: 4, ruins: [{ cat: "06 - CFTV", item: "CF35", status: "inop" }, { cat: "06 - CFTV", item: "CF41", status: "inop" }, { cat: "24 - TORNIQUETES", item: "T2", status: "partial" }, { cat: "04 - CANCELAS", item: "Saída 2", status: "inop" }] },
  pendencias: { totalItens: 214, lista: [{ cat: "06 - CFTV", item: "CF35", status: "inop", semanas: 5, tratativa: true }, { cat: "06 - CFTV", item: "CF41", status: "inop", semanas: 1, tratativa: false },
    { cat: "24 - TORNIQUETES", item: "T2", status: "partial", semanas: 3, tratativa: false }, { cat: "04 - CANCELAS", item: "Saída 2", status: "inop", semanas: 2, tratativa: true }] },
  mapa: { enviados: 58, esperados: 60 }, ronda: { aplica: true, slots: 460, executados: 455, atrasados: 20, naoExec: 5 },
  equipe: { ativos: 16, previsto: 17, faltas30: 2, turnover: 14 }, capacitacao: { ativos: 16, emDia: 14 },
  sistemas: { ctmk: { aplica: true, diasOff: 0 }, key: { aplica: true, abertas: 1 }, perimetro: { aplica: true, zonasRuins: 0 } },
  eventos: { energia: { usa: true, n30: 2 }, ambulancia: { usa: false, n30: 0, graves30: 0 }, sinistro: { registrado: false, em30: false } },
  intervalos: { registros30: 59 },
};
