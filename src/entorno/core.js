// Núcleo puro do Entorno: monta as buscas, lê RSS, pré-filtra pelo tema, mescla com o que já está gravado e resume.
// Sem rede e sem banco — tudo testável. CommonJS (compartilhado com api/entorno-coletar.js).
const { LOCAIS, GERAL, TEMAS, TIPOS_GRAVES, FONTES_GERAIS } = require("./locais");

const DIAS_JANELA = 90;
const MAX_ITENS = 150;
const MAX_NOVOS_POR_RODADA = 25; // teto de classificação por projeto/tema por rodada (custo e tempo)

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Google News RSS agrega G1/Globo, UOL, R7, Estadão, CNN Brasil e portais locais, com busca por cidade e janela de tempo.
function urlGoogleNews(q, dias = DIAS_JANELA) {
  const query = `${q} when:${dias}d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
}

const aspas = (t) => (/\s/.test(t) ? `"${t}"` : t);
const ou = (lista) => `(${lista.map(aspas).join(" OR ")})`;

// Consultas de um projeto: Google News por tema (a cidade entra sempre; vizinhas e pontos de interesse ampliam o entorno)
// + os portais indicados pelo Marcio (tema null = o pré-filtro separa segurança/mercado). Feeds "amplos" (G1 regional)
// só aceitam notícia que cite a cidade/entorno do parque. Projeto soSeguranca (Jatinox) não busca mercado.
const lugaresDe = (l) => [l.bairro, l.cidade, ...(l.vizinhas || []), ...(l.interesse || [])].filter(Boolean);
function consultasDoProjeto(pid) {
  const l = LOCAIS[pid];
  if (!l || !l.cidade) return [];
  const lugares = [l.bairro || l.cidade, ...(l.vizinhas || []).slice(0, 3)];
  const seg = `${ou(TEMAS.seguranca.termos.slice(0, 10))} ${ou(lugares)}`;
  const out = [{ tema: "seguranca", url: urlGoogleNews(seg), fonte: "Google News" }];
  if (!l.soSeguranca) {
    const mer = `${ou(TEMAS.mercado.termos.slice(0, 10))} ${ou([l.cidade, ...(l.interesse || []).slice(0, 2)])}`;
    out.push({ tema: "mercado", url: urlGoogleNews(mer), fonte: "Google News" });
  }
  for (const [nome, url] of l.fontes || []) out.push({ tema: null, url, fonte: nome, amplo: /g1\.globo\.com\/rss/.test(url), lugares: lugaresDe(l) });
  for (const [nome, url] of FONTES_GERAIS) out.push({ tema: null, url, fonte: nome, amplo: true, lugares: lugaresDe(l) });
  return out;
}

// Mercado geral (Black Friday, e-commerce, grandes ocupantes) — uma coleta para todos os parques elegíveis.
function consultasGerais() {
  const q = `${ou(GERAL.termos.slice(0, 6))} ${ou(["logística", "centro de distribuição", "galpão"])}`;
  return [{ tema: "mercado", url: urlGoogleNews(q), fonte: "Google News" }, ...(GERAL.fontes || []).map(([nome, url]) => ({ tema: "mercado", url, fonte: nome }))];
}

// Leitor de RSS mínimo (sem dependência): <item><title/><link/><pubDate/><source/><description/></item>.
const decodeXml = (s) => String(s || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (bloco, nome) => { const m = new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, "i").exec(bloco); return m ? m[1] : ""; };

function parseRss(xml) {
  const itens = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(String(xml || "")))) {
    const b = m[1];
    let titulo = decodeXml(tag(b, "title"));
    let fonte = decodeXml(tag(b, "source"));
    // Google News: "Título - Fonte"; quando a fonte vem no título, separa.
    if (!fonte) { const i = titulo.lastIndexOf(" - "); if (i > 10) { fonte = titulo.slice(i + 3).trim(); titulo = titulo.slice(0, i).trim(); } }
    else if (titulo.endsWith(` - ${fonte}`)) titulo = titulo.slice(0, -(fonte.length + 3)).trim();
    const link = decodeXml(tag(b, "link")) || (/<link\b[^>]*href="([^"]+)"/i.exec(b) || [])[1] || "";
    const pub = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated");
    const d = pub ? new Date(decodeXml(pub)) : null;
    const data = d && !isNaN(d) ? d.toISOString() : null;
    const descricao = decodeXml(tag(b, "description")).slice(0, 400);
    if (titulo && link) itens.push({ titulo, link, fonte, data, descricao });
  }
  return itens;
}

// Pré-filtro barato antes da IA: precisa citar um termo do tema (mata "Neymar ganhou a bola de ouro").
function passaPreFiltro(item, tema) {
  const texto = semAcento(`${item.titulo} ${item.descricao}`);
  return (TEMAS[tema]?.termos || []).some((t) => texto.includes(semAcento(t)));
}

// Identidade estável de uma notícia (mesmo link em duas buscas = uma notícia). Hash simples e determinístico.
function idDe(link) {
  let h = 5381; const s = String(link || "");
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return "n" + h.toString(36) + s.length.toString(36);
}

const citaLugar = (item, lugares) => { const t = semAcento(`${item.titulo} ${item.descricao}`); return (lugares || []).some((x) => t.includes(semAcento(x))); };
const temaDe = (item, consulta) => {
  if (consulta.tema) return passaPreFiltro(item, consulta.tema) ? consulta.tema : null;
  if (passaPreFiltro(item, "seguranca")) return "seguranca";
  return !consulta.soSeguranca && passaPreFiltro(item, "mercado") ? "mercado" : null;
};

// Quais itens lidos ainda não estão gravados (e cabem na rodada). `consulta` pode ser só o tema (compatível) ou o objeto
// da consulta ({tema|null, amplo, lugares, soSeguranca}).
function novosParaClassificar(lidos, existentes, consulta) {
  const c = typeof consulta === "string" ? { tema: consulta } : consulta || {};
  const ids = new Set((existentes || []).map((x) => x.id));
  const vistos = new Set();
  const out = [];
  for (const it of lidos) {
    const id = idDe(it.link);
    if (ids.has(id) || vistos.has(id)) continue;
    const tema = temaDe(it, c);
    if (!tema) continue;
    if (c.amplo && !citaLugar(it, c.lugares)) continue;
    vistos.add(id);
    out.push({ ...it, id, tema, fonte: it.fonte || c.fonte || "" });
    if (out.length >= MAX_NOVOS_POR_RODADA) break;
  }
  return out;
}

// Prompt de classificação: devolve JSON por id. A IA só confirma relevância/tipo/local — nunca inventa notícia.
function promptClassificacao(pid, itens) {
  const l = LOCAIS[pid] || (pid === GERAL.id ? { nome: GERAL.nome, cidade: "Brasil (mercado logístico nacional)", uf: "BR", vizinhas: [], interesse: GERAL.termos } : { nome: pid, cidade: "", uf: "", vizinhas: [], interesse: [] });
  const tiposSeg = TEMAS.seguranca.tipos.join(", ");
  const tiposMer = TEMAS.mercado.tipos.join(", ");
  const lista = itens.map((it) => `- id=${it.id} | tema=${it.tema} | ${it.data ? it.data.slice(0, 10) : "s/data"} | ${it.fonte || "fonte?"} | ${it.titulo}${it.descricao ? " — " + it.descricao.slice(0, 200) : ""}`).join("\n");
  return `Você classifica notícias para a equipe de segurança de um condomínio logístico.
Parque: ${l.nome} — ${l.cidade}/${l.uf}. Entorno: ${(l.vizinhas || []).join(", ") || "—"}. Pontos de interesse: ${(l.interesse || []).join(", ") || "—"}.

Para CADA item abaixo responda em JSON (array), um objeto por id, com os campos:
- id (copiar)
- relevante: true só se a notícia (a) for sobre ocorrência criminal/policial que afete a região do parque (tema seguranca) ou (b) for sobre o mercado logístico/ocupantes/sazonalidade que interesse a quem administra o parque (tema mercado). Esporte, celebridades, política nacional, notícias de outra cidade homônima = false.
- tipo: para seguranca um de [${tiposSeg}]; para mercado um de [${tiposMer}].
- cidade: cidade da ocorrência (texto curto) ou "" se não ficar claro.
- bairro: bairro/logradouro citado ou "".
- proximidade: "cidade" (na cidade/bairro do parque), "vizinha" (cidade vizinha/entorno listado), "regiao" (mesma região metropolitana) ou "fora". Para o tema mercado de alcance nacional (Black Friday, e-commerce, grandes ocupantes) use "regiao".
- confianca: 0 a 100 (quanto a notícia claramente trata do tema e do local).
- resumo: uma frase objetiva, até 160 caracteres, em português, sem opinião.

Itens:
${lista}

Responda SOMENTE o JSON (array), sem comentários.`;
}

function extrairJson(texto) {
  const s = String(texto || "").trim();
  const a = s.indexOf("["), z = s.lastIndexOf("]");
  if (a < 0 || z < a) return [];
  try { const j = JSON.parse(s.slice(a, z + 1)); return Array.isArray(j) ? j : []; } catch { return []; }
}

const CONFIANCA_MINIMA = 60; // piso para não inflar o painel (registrado em 27/10)

// Junta a classificação aos itens; descarta o que a IA marcou como irrelevante, fora da região ou de baixa confiança.
function aplicarClassificacao(itens, respostaJson) {
  const porId = new Map(extrairJson(respostaJson).filter((x) => x && x.id).map((x) => [x.id, x]));
  const out = [];
  for (const it of itens) {
    const c = porId.get(it.id);
    if (!c || c.relevante !== true) continue;
    const conf = Math.max(0, Math.min(100, Number(c.confianca) || 0));
    if (conf < CONFIANCA_MINIMA || c.proximidade === "fora") continue;
    const tipos = TEMAS[it.tema]?.tipos || [];
    out.push({
      id: it.id, tema: it.tema, titulo: it.titulo, link: it.link, fonte: it.fonte || "", data: it.data,
      tipo: tipos.includes(c.tipo) ? c.tipo : "outro",
      cidade: String(c.cidade || "").slice(0, 60), bairro: String(c.bairro || "").slice(0, 80),
      proximidade: ["cidade", "vizinha", "regiao"].includes(c.proximidade) ? c.proximidade : "regiao",
      confianca: conf, resumo: String(c.resumo || "").slice(0, 200),
    });
  }
  return out;
}

// Mescla o gravado com o novo: sem duplicidade, só os últimos 90 dias, mais recentes primeiro, teto de itens.
// A mesma notícia publicada por vários portais vira UM item com vários links (Marcio, 02/11: "link 1, link 2…").
const chaveTitulo = (t) => semAcento(t).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
function mesclar(existentes, novos, agora = new Date()) {
  const limite = new Date(agora.getTime() - DIAS_JANELA * 86400000).toISOString();
  const mapa = new Map(), porTitulo = new Map();
  for (const it of [...(existentes || []), ...(novos || [])]) {
    if (!it || !it.id) continue;
    const links = (it.links && it.links.length ? it.links : [{ fonte: it.fonte || "", link: it.link }]).filter((l) => l && l.link);
    const k = chaveTitulo(it.titulo);
    const dono = mapa.get(it.id) || (k && porTitulo.get(k));
    if (dono && dono.id !== it.id) {
      for (const l of links) if (!dono.links.some((x) => x.link === l.link)) dono.links.push(l);
      continue;
    }
    const novo = { ...it, links: [...links] };
    if (dono) for (const l of dono.links || []) if (!novo.links.some((x) => x.link === l.link)) novo.links.push(l);
    mapa.set(novo.id, novo); if (k) porTitulo.set(k, novo);
  }
  return [...mapa.values()]
    .filter((it) => !it.data || it.data >= limite)
    .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")))
    .slice(0, MAX_ITENS);
}

// Resumo para os mostradores: contagens por tema em 30/60/90 dias, por tipo e tendência (30 dias atuais × 30 anteriores).
function resumir(itens, agora = new Date()) {
  const t = agora.getTime();
  const ha = (d) => new Date(t - d * 86400000).toISOString();
  const seg = (itens || []).filter((i) => i.tema === "seguranca"), mer = (itens || []).filter((i) => i.tema === "mercado");
  const conta = (arr, dias) => arr.filter((i) => i.data && i.data >= ha(dias)).length;
  const porTipo = {};
  for (const i of seg) porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1;
  const atual = conta(seg, 30), anterior = seg.filter((i) => i.data && i.data >= ha(60) && i.data < ha(30)).length;
  return {
    seguranca: { d30: atual, d60: conta(seg, 60), d90: conta(seg, 90), graves: seg.filter((i) => TIPOS_GRAVES.includes(i.tipo)).length, porTipo, tendencia: atual > anterior ? "alta" : atual < anterior ? "queda" : "estavel", anterior30: anterior },
    mercado: { d30: conta(mer, 30), d90: conta(mer, 90) },
    total: (itens || []).length,
  };
}

// Proximidade (03/11): distância em km entre a notícia geocodificada e o parque; faixas para destaque.
function distanciaKm(a, b) {
  if (!a || !b || typeof a.lat !== "number" || typeof b.lat !== "number") return null;
  const r = 6371, g = (x) => (x * Math.PI) / 180;
  const dLat = g(b.lat - a.lat), dLng = g(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(g(a.lat)) * Math.cos(g(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(h)) * 10) / 10;
}
const FAIXAS = [[3, "muito perto"], [10, "perto"], [30, "na região"]];
function faixaKm(km) { if (typeof km !== "number") return null; for (const [max, r] of FAIXAS) if (km <= max) return r; return "longe"; }

// Ordenação para a tela: segurança perto do parque primeiro (km, depois proximidade por cidade), depois por data.
const PESO_PROX = { cidade: 0, vizinha: 1, regiao: 2 };
function ordenarPorProximidade(itens) {
  const chave = (i) => [typeof i.km === "number" ? i.km : 999, PESO_PROX[i.proximidade] ?? 3, -(Date.parse(i.data || 0) || 0)];
  return [...(itens || [])].sort((a, b) => { const x = chave(a), y = chave(b); for (let k = 0; k < 3; k++) if (x[k] !== y[k]) return x[k] - y[k]; return 0; });
}

module.exports = { distanciaKm, faixaKm, ordenarPorProximidade, DIAS_JANELA, MAX_ITENS, MAX_NOVOS_POR_RODADA, CONFIANCA_MINIMA, urlGoogleNews, consultasDoProjeto, consultasGerais, parseRss, passaPreFiltro, idDe, novosParaClassificar, promptClassificacao, extrairJson, aplicarClassificacao, mesclar, resumir, semAcento };
