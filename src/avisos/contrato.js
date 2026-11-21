// Contrato único do Painel de Avisos 2.0. Puro: sem Firestore, sem relógio, sem tela.
// Quem produz (regras.js, Entorno, eventos do sistema) só entrega no formato abaixo; quem mostra (a Central de Avisos) só lê
// daqui. Assim o painel nunca calcula por conta própria e continua batendo com as telas de origem.
//
// Aviso (já existente, regras.js): { id, tipo, sev, projetoId, titulo, detalhe, desde, gerencial, dono? }
//   dono (opcional): "moked" | "manutencao" | "administracao" | "cliente" = com quem está a bola. Ausente = por tipo (abaixo).
// Notícia: { id, origem: "sistema" | "externa", tema: "sistema" | "seguranca" | "mercado", projetoId, titulo, resumo, fonte,
//            links: [url], data: Date | null, sev }
import { CATEGORIAS, SEVERIDADES } from "./config";
import { TIPOS_GRAVES } from "../entorno/locais";

export const ABAS = [
  { id: "equipamentos", rotulo: "Equipamentos" },
  { id: "cliente", rotulo: "Pendências do cliente" },
  { id: "noticias", rotulo: "Notícias" },
  { id: "equipe", rotulo: "Equipe", gerencial: true }, // dado de pessoa: só no perfil gerencial (regra mantida)
];

export const DONOS = ["moked", "manutencao", "administracao", "cliente"];
export const ROTULO_DONO = { moked: "Moked", manutencao: "Manutenção", administracao: "Administração", cliente: "Cliente" };

const TIPOS_EQUIPAMENTO = new Set(["inop", "manutencao", "energia", "ctmk", "keyaccess", "iluminacao", "bolsao", "relatorio"]);
const TIPOS_EQUIPE = new Set(["falta", "vago", "atraso", "ferias", "troca", "cobertura", "ft", "mapa", "material", "veiculo", "supervisao"]);
const DONO_PADRAO = { manutencao: "manutencao" }; // serviço pendente na CCO está com a empresa de manutenção

export const donoDoAviso = (a) => (DONOS.includes(a && a.dono) ? a.dono : DONO_PADRAO[a && a.tipo] || "moked");

// Para qual aba vai o aviso. Nada some: tipo desconhecido cai em Equipamentos.
export function abaDoAviso(a) {
  const t = a && a.tipo;
  if (t === "teste") return "noticias"; // "teste semanal enviado/novidades" é notícia do sistema
  if (TIPOS_EQUIPE.has(t)) return "equipe";
  if (donoDoAviso(a) !== "moked") return "cliente";
  return "equipamentos";
}

const ms = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null);
const sevMais = (a, b) => (SEVERIDADES[a] <= SEVERIDADES[b] ? a : b);

// Agrupa por projeto + sistema: "CFTV: 6 inoperantes, o mais antigo há 12 dias" em vez de uma linha por item.
export function agrupar(avisos) {
  const mapa = new Map();
  for (const a of avisos || []) {
    const chave = `${a.projetoId}|${a.tipo}|${donoDoAviso(a)}`;
    const g = mapa.get(chave) || { chave, projetoId: a.projetoId, tipo: a.tipo, rotulo: (CATEGORIAS[a.tipo] || {}).rotulo || a.tipo, dono: donoDoAviso(a), sev: a.sev, qtd: 0, desde: null, avisos: [] };
    g.sev = sevMais(g.sev, a.sev);
    g.qtd += 1;
    const t = ms(a.desde);
    if (t != null && (g.desde == null || t < g.desde.getTime())) g.desde = a.desde;
    g.avisos.push(a);
    mapa.set(chave, g);
  }
  const ordem = (g) => (CATEGORIAS[g.tipo] || {}).ordem ?? 9;
  return [...mapa.values()].sort((a, b) => SEVERIDADES[a.sev] - SEVERIDADES[b.sev] || ordem(a) - ordem(b) || ((ms(a.desde) ?? Infinity) - (ms(b.desde) ?? Infinity)) || a.projetoId.localeCompare(b.projetoId) || a.tipo.localeCompare(b.tipo));
}

const txt = (v, n) => String(v == null ? "" : v).slice(0, n);
const dataValida = (v) => { if (!v) return null; const d = v instanceof Date ? v : new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

// Notícia de fora (Entorno). Regra de cores do Marcio (02/11): criminalidade grave em vermelho, demais ocorrências em amarelo,
// mercado/logística em verde (mercado entra como "info" e a tela pinta de verde).
export function noticiaExterna(it, projetoId) {
  if (!it || !it.id || !it.titulo) return null;
  const tema = it.tema === "mercado" ? "mercado" : "seguranca";
  const links = Array.isArray(it.links) ? it.links.map((l) => (typeof l === "string" ? { fonte: "", link: l } : l)).filter((l) => l && l.link) : it.link ? [{ fonte: txt(it.fonte, 60), link: it.link }] : [];
  const sev = tema === "mercado" ? "info" : TIPOS_GRAVES.includes(it.tipo) ? "critico" : "atencao";
  return { id: `ext:${projetoId || "GERAL"}:${it.id}`, origem: "externa", tema, tipo: it.tipo || "", projetoId: projetoId || "TODOS", titulo: txt(it.titulo, 200), resumo: txt(it.resumo, 200), fonte: txt(it.fonte, 60), links, local: [it.bairro, it.cidade].filter(Boolean).join(", "), data: dataValida(it.data), sev };
}

// Notícia do sistema (teste semanal enviado, equipamento reparado, nova versão disponível…).
export function noticiaDoSistema({ id, projetoId, titulo, resumo = "", data = null, sev = "info" } = {}) {
  if (!id || !titulo) return null;
  return { id: `sis:${id}`, origem: "sistema", tema: "sistema", projetoId: projetoId || "TODOS", titulo: txt(titulo, 200), resumo: txt(resumo, 200), fonte: "MokLog", links: [], data: dataValida(data), sev: SEVERIDADES[sev] != null ? sev : "info" };
}

// No painel entram só as mais relevantes por projeto (mais forte e mais recente primeiro); o resto fica em "ver todas".
export function ordenarNoticias(noticias) {
  return [...(noticias || [])].filter(Boolean).sort((a, b) => SEVERIDADES[a.sev] - SEVERIDADES[b.sev] || (ms(b.data) ?? 0) - (ms(a.data) ?? 0) || a.id.localeCompare(b.id));
}
export function destaquesPorProjeto(noticias, porProjeto = 2) {
  const cont = new Map(), out = [];
  for (const n of ordenarNoticias(noticias)) {
    const c = cont.get(n.projetoId) || 0;
    if (c >= porProjeto) continue;
    cont.set(n.projetoId, c + 1);
    out.push(n);
  }
  return out;
}

// Monta a Central: uma aba por assunto, com total e críticos. Dado de pessoa só entra no perfil gerencial.
export function montarCentral({ avisos = [], noticias = [], gerencial = false } = {}) {
  const visiveis = (avisos || []).filter((a) => gerencial || !a.gerencial);
  const porAba = { equipamentos: [], cliente: [], noticias: [], equipe: [] };
  for (const a of visiveis) porAba[abaDoAviso(a)].push(a);
  const abas = ABAS.filter((b) => gerencial || !b.gerencial).map((b) => {
    if (b.id === "noticias") {
      const todas = ordenarNoticias([...(noticias || []), ...porAba.noticias.map((a) => noticiaDoSistema({ id: a.id, projetoId: a.projetoId, titulo: a.titulo, resumo: a.detalhe, data: a.desde, sev: a.sev }))].filter(Boolean));
      return { ...b, total: todas.length, criticos: todas.filter((n) => n.sev === "critico").length, noticias: todas, destaques: destaquesPorProjeto(todas) };
    }
    const grupos = agrupar(porAba[b.id]);
    return { ...b, total: porAba[b.id].length, criticos: porAba[b.id].filter((a) => a.sev === "critico").length, grupos };
  });
  return { abas, total: abas.reduce((s, b) => s + b.total, 0), criticos: abas.reduce((s, b) => s + b.criticos, 0) };
}
