// Central de Avisos (Painel 2.0): o que aparece quando o Painel da Home é aberto. Só LÊ o contrato (contrato.js): quem calcula
// continua sendo regras.js; aqui só se organiza e se mostra. Superfícies no tom suave do tema do app (cinza-azulado, não preto).
import { useMemo, useState } from "react";
import { montarCentral, ROTULO_DONO, destaquesPorProjeto } from "./contrato";
import { nivelPendencia, NIVEL_CFG } from "../pendencias";

const COR = { critico: "#ef4444", atencao: "#f59e0b", info: "#64748b" };
const VERDE = "#22c55e";
const ROTULO_SEV = { critico: "crítico", atencao: "atenção", info: "informativo" };
const DIA = 86400000;

export const paleta = (dark) => (dark
  ? { card: "#1F2937", fundo: "#111827", txt: "#F3F4F6", mut: "#CBD5E1", linha: "#3b4859", chip: "#2b3748", acc: "#38bdf8", onacc: "#062033" }
  : { card: "#ffffff", fundo: "#f5f6f8", txt: "#111827", mut: "#475569", linha: "#cbd5e1", chip: "#e2e8f0", acc: "#0369a1", onacc: "#ffffff" });

const hhmm = (d) => (d instanceof Date ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
const ddmm = (d) => (d instanceof Date ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "");
const diasDesde = (desde, agora) => (desde instanceof Date && !Number.isNaN(desde.getTime()) ? Math.max(0, Math.floor((agora.getTime() - desde.getTime()) / DIA)) : null);

// Aba que abre primeiro: a primeira com algo crítico; senão, a primeira com algo; senão, a primeira.
export function abaInicial(central) {
  const c = central.abas.find((a) => a.criticos > 0) || central.abas.find((a) => a.total > 0) || central.abas[0];
  return c ? c.id : "equipamentos";
}

export default function CentralAvisos({ avisos, noticias = [], noticiasEstado = {}, gerencial = false, dark = true, agora = new Date(), nomeProj = (p) => p, onAbrir }) {
  const P = paleta(dark);
  const central = useMemo(() => montarCentral({ avisos, noticias, gerencial }), [avisos, noticias, gerencial]);
  const [aba, setAba] = useState(null);
  const ativa = aba && central.abas.some((a) => a.id === aba) ? aba : abaInicial(central);
  const dados = central.abas.find((a) => a.id === ativa);

  const idade = (a) => {
    const d = diasDesde(a.desde, agora);
    if (d == null) return a.idade ? <span style={{ fontSize: 10.5, color: P.mut, whiteSpace: "nowrap", flexShrink: 0 }}>{a.idade}</span> : null;
    const cor = NIVEL_CFG[nivelPendencia(d)].cor;
    return <span style={{ fontSize: 10.5, fontWeight: 800, color: cor, background: cor + "22", borderRadius: 999, padding: "1px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>{a.idade || `${d} d`}</span>;
  };
  const item = (a, comDono) => (
    <button key={a.id} onClick={() => onAbrir && onAbrir(a)} data-testid="aviso" aria-label={`${ROTULO_SEV[a.sev]}: ${a.titulo}, ${nomeProj(a.projetoId)}`}
      style={{ display: "flex", alignItems: "flex-start", gap: 9, width: "100%", textAlign: "left", background: "transparent", border: "none", borderLeft: `3px solid ${COR[a.sev]}`, padding: "8px 4px 8px 10px", cursor: "pointer", minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: P.mut, background: P.chip, borderRadius: 5, padding: "1px 6px" }}>{a.projetoId}</span>
          {comDono && <span style={{ fontSize: 10.5, fontWeight: 800, color: P.txt, background: P.chip, borderRadius: 5, padding: "1px 6px" }}>{ROTULO_DONO[a.dono] || ROTULO_DONO.manutencao}</span>}
          <span style={{ fontSize: 12.5, fontWeight: 800, color: P.txt }}>{a.titulo}</span>
          {a.novo && <span style={{ fontSize: 9.5, fontWeight: 900, color: "#fff", background: "#2563eb", borderRadius: 5, padding: "1px 6px", letterSpacing: .4 }}>NOVO</span>}
        </div>
        {a.detalhe && <div style={{ fontSize: 11, color: P.mut, marginTop: 2, lineHeight: 1.35 }}>{a.detalhe}</div>}
      </div>
      {idade(a)}
    </button>
  );

  const painelGrupos = (comDono) => (
    dados.grupos.length === 0
      ? <div style={{ fontSize: 12.5, color: P.mut, padding: "12px 2px" }}>Nada em aberto nesta aba.</div>
      : dados.grupos.map((g) => (
        <div key={g.chave} style={{ borderTop: `1px solid ${P.linha}`, padding: "4px 0" }}>
          {g.qtd > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", padding: "6px 4px 0 13px" }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: P.mut, letterSpacing: .4, textTransform: "uppercase" }}>{nomeProj(g.projetoId)} · {g.rotulo}</span>
              <span style={{ fontSize: 11, color: P.mut }}>{g.qtd} itens{g.desde ? ` · o mais antigo há ${diasDesde(g.desde, agora)} d` : ""}</span>
            </div>
          )}
          {g.avisos.map((a) => item(a, comDono))}
        </div>
      ))
  );

  return (
    <div data-testid="avisos-lista" style={{ marginTop: 8 }}>
      <div role="tablist" aria-label="Assuntos do painel" style={{ display: "flex", gap: 2, overflowX: "auto", scrollbarWidth: "none", borderBottom: `1px solid ${P.linha}` }}>
        {central.abas.map((a) => (
          <button key={a.id} role="tab" aria-selected={a.id === ativa} data-testid={`aba-${a.id}`} onClick={() => setAba(a.id)}
            style={{ flex: "none", background: "transparent", border: "none", borderBottom: `2px solid ${a.id === ativa ? P.acc : "transparent"}`, color: a.id === ativa ? P.txt : P.mut, fontSize: 12, fontWeight: 800, padding: "8px 9px", cursor: "pointer", whiteSpace: "nowrap" }}>
            {a.rotulo}
            <span style={{ marginLeft: 5, fontSize: 10.5, borderRadius: 999, padding: "1px 6px", background: a.criticos ? "#b91c1c" : P.chip, color: a.criticos ? "#fff" : P.mut }}>{a.total}</span>
            {a.gerencial && <span style={{ marginLeft: 5, fontSize: 9, letterSpacing: .5, textTransform: "uppercase", color: P.acc }}>gerencial</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" style={{ maxHeight: 360, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {ativa === "noticias"
          ? <Noticias dados={dados} estado={noticiasEstado} P={P} dark={dark} nomeProj={nomeProj} />
          : ativa === "cliente"
            ? <>
              <div style={{ fontSize: 11.5, color: P.mut, padding: "8px 2px 4px" }}>O que depende de manutenção, administração ou do cliente: com quem está e há quantos dias.</div>
              {painelGrupos(true)}
            </>
            : painelGrupos(false)}
      </div>
    </div>
  );
}

const FILTROS = [["todas", "Todas"], ["sistema", "Sistema"], ["seguranca", "Segurança"], ["mercado", "Mercado"]];
const corNoticia = (n) => (n.tema === "mercado" ? VERDE : COR[n.sev]);
const ROTULO_TEMA = { sistema: "Sistema", seguranca: "Segurança", mercado: "Mercado" };

function Noticias({ dados, estado, P, nomeProj }) {
  const [filtro, setFiltro] = useState("todas");
  const [todas, setTodas] = useState(false);
  const { carregando, erro, deMemoria, lidoEm } = estado;
  const base = filtro === "todas" ? dados.noticias : dados.noticias.filter((n) => n.tema === filtro);
  const unica = todas || filtro !== "todas" ? base : destaquesPorProjeto(base);
  return (
    <div>
      {carregando && <div style={{ fontSize: 11.5, color: P.mut, padding: "8px 2px 0" }}>Lendo notícias de fora…</div>}
      {erro && !carregando && (
        <div role="alert" style={{ fontSize: 11.5, color: "#f59e0b", background: "#f59e0b14", border: "1px solid #f59e0b44", borderRadius: 8, padding: "6px 10px", marginTop: 8 }}>
          {deMemoria ? `${erro} Mostrando as notícias lidas às ${hhmm(lidoEm)}.` : `Não consegui ler as notícias de fora: ${erro} As do sistema aparecem abaixo.`}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 0 6px" }}>
        {FILTROS.map(([k, r]) => (
          <button key={k} aria-pressed={filtro === k} onClick={() => setFiltro(k)}
            style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "4px 11px", cursor: "pointer", border: `1px solid ${filtro === k ? P.acc : P.linha}`, background: filtro === k ? P.acc : P.chip, color: filtro === k ? P.onacc : P.txt }}>{r}</button>
        ))}
      </div>
      {unica.length === 0 && !carregando && !erro && <div style={{ fontSize: 12.5, color: P.mut, padding: "10px 2px" }}>Nenhuma notícia neste filtro.</div>}
      {unica.map((n) => (
        <div key={n.id} data-testid="noticia" style={{ borderTop: `1px solid ${P.linha}`, borderLeft: `3px solid ${corNoticia(n)}`, padding: "9px 4px 9px 10px", marginTop: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .4, textTransform: "uppercase", color: P.mut }}>
            {ROTULO_TEMA[n.tema]} · {n.projetoId === "TODOS" ? "Geral" : nomeProj(n.projetoId)}{n.local ? ` · ${n.local}` : ""}{n.data ? ` · ${ddmm(n.data)}` : ""}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: P.txt, marginTop: 2, lineHeight: 1.3 }}>{n.titulo}</div>
          {n.resumo && <div style={{ fontSize: 11.5, color: P.mut, marginTop: 2, lineHeight: 1.4 }}>{n.resumo}</div>}
          {n.links.length > 0 && (
            <div style={{ marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {n.links.slice(0, 3).map((l, i) => <a key={i} href={l.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: P.acc, textDecoration: "none" }}>{l.fonte || n.fonte || "Fonte"} · ver matéria</a>)}
            </div>
          )}
        </div>
      ))}
      {!todas && filtro === "todas" && base.length > unica.length && (
        <button onClick={() => setTodas(true)} style={{ width: "100%", background: "transparent", border: "none", color: P.acc, fontWeight: 700, fontSize: 12, padding: "10px 0 4px", cursor: "pointer" }}>Ver todas as {base.length} notícias</button>
      )}
    </div>
  );
}
