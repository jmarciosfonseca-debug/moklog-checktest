// Entorno — lista de notícias com filtros (tema, tipo, período). Usada na tela do gestor e na Área do Cliente.
// Somente leitura: cada item tem o link da fonte original.
import { useMemo, useState } from "react";
import { TEMAS, TIPO_ROTULO, TIPOS_GRAVES } from "./locais";
import { faixaKm, ordenarPorProximidade } from "./core";
import { C, VERMELHO2, AMARELO, VERDE, CINZA } from "../cliente/Cluster";

// Cores (Marcio, 02/11): criminalidade em vermelho (grave) ou amarelo; empreendimento/logística/mercado em verde.
export const corTipo = (tipo) => (TIPOS_GRAVES.includes(tipo) ? VERMELHO2 : AMARELO);
export const corItem = (i) => (i.tema === "mercado" ? VERDE : corTipo(i.tipo));
export const fmtData = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }) : "s/ data");
const PROX = { cidade: "na cidade", vizinha: "cidade vizinha", regiao: "na região" };

export const ehPerto = (i) => (typeof i.km === "number" ? i.km <= 5 : i.proximidade === "cidade");
export function filtrar(itens, { tema = "todos", tipo = "todos", dias = 90, perto = false, ordem = "data" } = {}, agora = new Date()) {
  const limite = new Date(agora.getTime() - dias * 86400000).toISOString();
  const lista = (itens || []).filter((i) => (tema === "todos" || i.tema === tema) && (tipo === "todos" || i.tipo === tipo) && (!i.data || i.data >= limite) && (!perto || ehPerto(i)));
  return ordem === "proximidade" ? ordenarPorProximidade(lista) : lista;
}
const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`);

export function ItemNoticia({ i, compacto = false }) {
  const cor = corItem(i);
  const links = (i.links && i.links.length ? i.links : [{ fonte: i.fonte, link: i.link }]).filter((l) => l.link);
  return <div style={{ padding: compacto ? "7px 0" : "10px 0", borderTop: "1px solid #1f1f25", borderLeft: `3px solid ${cor}`, paddingLeft: 8 }}>
   <a href={links[0]?.link || i.link} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", color: "inherit" }} aria-label={`Abrir notícia: ${i.titulo}`}>
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor, marginTop: 5, flexShrink: 0, boxShadow: `0 0 6px ${cor}88` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compacto ? 12 : 13, fontWeight: 700, color: "#f3f4f6", lineHeight: 1.3 }}>{i.titulo}</div>
        {!compacto && i.resumo && <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 3 }}>{i.resumo}</div>}
        <div style={{ fontSize: 10.5, color: "#6b7280", marginTop: 3, display: "flex", flexWrap: "wrap", gap: "2px 8px" }}>
          <span style={{ color: cor, fontWeight: 700 }}>{TIPO_ROTULO[i.tipo] || i.tipo}</span>
          <span>{fmtData(i.data)}</span>
          {(i.bairro || i.cidade) && <span>{[i.bairro, i.cidade].filter(Boolean).join(" · ")}</span>}
          {typeof i.km === "number" ? <span style={{ color: i.km <= 3 ? VERMELHO2 : i.km <= 10 ? AMARELO : "#9ca3af", fontWeight: 700 }}>a {fmtKm(i.km)} do parque{faixaKm(i.km) === "muito perto" ? " · MUITO PERTO" : ""}</span> : i.proximidade && <span>{PROX[i.proximidade] || ""}</span>}
          {typeof i.confianca === "number" && <span title="Confiança da classificação">conf. {i.confianca}%</span>}
        </div>
      </div>
    </div>
   </a>
   {!compacto && links.length > 0 && <div style={{ fontSize: 10.5, marginTop: 4, marginLeft: 16, display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
     {links.map((l, n) => <a key={l.link} href={l.link} target="_blank" rel="noopener noreferrer" style={{ color: "#9ca3af", textDecoration: "underline" }}>{links.length > 1 ? `Fonte ${n + 1}: ` : "Fonte: "}{l.fonte || new URL(l.link).hostname.replace(/^www\./, "")}</a>)}
   </div>}
   {compacto && links[0] && <div style={{ fontSize: 10, color: "#6b7280", marginLeft: 16 }}>{links.map((l) => l.fonte).filter(Boolean).join(" · ")}</div>}
  </div>;
}

export default function EntornoLista({ itens, inicial = {}, mostrarFiltros = true, limite = 50 }) {
  const [tema, setTema] = useState(inicial.tema || "todos"), [tipo, setTipo] = useState("todos"), [dias, setDias] = useState(inicial.dias || 90), [tudo, setTudo] = useState(false);
  const [perto, setPerto] = useState(false), [ordem, setOrdem] = useState("data");
  const lista = useMemo(() => filtrar(itens, { tema, tipo, dias, perto, ordem }), [itens, tema, tipo, dias, perto, ordem]);
  const nPerto = useMemo(() => (itens || []).filter((i) => i.tema === "seguranca" && ehPerto(i)).length, [itens]);
  const tiposDisp = useMemo(() => { const s = new Set((itens || []).filter((i) => tema === "todos" || i.tema === tema).map((i) => i.tipo)); return [...s].sort(); }, [itens, tema]);
  const sel = (ativo) => ({ ...C.back, minHeight: 26, padding: "3px 9px", fontSize: 10.5, borderColor: ativo ? VERMELHO2 : "#3a3a42", color: ativo ? "#fecaca" : "#9ca3af" });
  return <div>
    {mostrarFiltros && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      {[["todos", "Tudo"], ["seguranca", TEMAS.seguranca.rotulo], ["mercado", TEMAS.mercado.rotulo]].map(([k, r]) => <button key={k} aria-pressed={tema === k} onClick={() => { setTema(k); setTipo("todos"); }} style={sel(tema === k)}>{r}</button>)}
      <span style={{ width: 1, background: "#2a2a31", margin: "0 2px" }} />
      {[30, 60, 90].map((d) => <button key={d} aria-pressed={dias === d} onClick={() => setDias(d)} style={sel(dias === d)}>{d} dias</button>)}
      <span style={{ width: 1, background: "#2a2a31", margin: "0 2px" }} />
      <button aria-pressed={perto} onClick={() => setPerto((v) => !v)} style={sel(perto)} title="Só o que está a até 5 km do parque (ou na cidade, quando não há distância)">Perto do parque{nPerto ? ` (${nPerto})` : ""}</button>
      <button aria-pressed={ordem === "proximidade"} onClick={() => setOrdem((o) => (o === "proximidade" ? "data" : "proximidade"))} style={sel(ordem === "proximidade")}>Mais próximas primeiro</button>
    </div>}
    {mostrarFiltros && tiposDisp.length > 1 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      <button aria-pressed={tipo === "todos"} onClick={() => setTipo("todos")} style={sel(tipo === "todos")}>Todos os tipos</button>
      {tiposDisp.map((t) => <button key={t} aria-pressed={tipo === t} onClick={() => setTipo(t)} style={sel(tipo === t)}>{TIPO_ROTULO[t] || t}</button>)}
    </div>}
    <div style={{ ...C.micro, marginBottom: 4 }}>{lista.length === 0 ? "Nenhuma notícia neste recorte." : `${lista.length} ${lista.length === 1 ? "notícia" : "notícias"}`}</div>
    {lista.slice(0, tudo ? 1000 : limite).map((i) => <ItemNoticia key={i.id} i={i} />)}
    {lista.length > limite && !tudo && <button style={{ ...C.back, marginTop: 8, width: "100%" }} onClick={() => setTudo(true)}>Ver todas ({lista.length})</button>}
    <div style={{ ...C.micro, marginTop: 10, color: CINZA }}>Notícias públicas (G1/Globo, UOL, R7, Estadão, CNN e portais locais via Google News), filtradas por tema e local e classificadas automaticamente. Notícia não é boletim de ocorrência; a localização é a citada na matéria.</div>
  </div>;
}
