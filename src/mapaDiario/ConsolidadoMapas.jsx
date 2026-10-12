// Consolidado do Mapa de Equipe diário (gerencial): busca os mapas concluídos de um período e gera o PDF padrão Moked.
// Período e projeto definem o que se lê; plantão, líder, colaborador e falta/FT filtram na hora, sobre o que foi lido.
// Somente leitura (não grava nada). Falha de leitura é dita com todas as letras — nunca vira "0 mapas".
import { useMemo, useState } from "react";
import { PROJETOS_DO_MAPA, dataBrasilia } from "./painel";
import { somarDias, diasEntre, ehDataISO } from "./regras";
import { consolidar, listaLideres, OCORRENCIAS, MAX_DIAS_PERIODO } from "./consolidado";
import { loadMapasPeriodo } from "./dados";
import { gerarConsolidadoMapasHTML } from "../relatorios/consolidadoMapasRelatorio";
import { abrirParaImpressao } from "../relatorios/padraoMoked";

export function validarPeriodo(de, ate) {
  if (!ehDataISO(de) || !ehDataISO(ate)) return "Informe a data inicial e a final.";
  if (de > ate) return "A data inicial não pode ser depois da final.";
  if (diasEntre(de, ate) + 1 > MAX_DIAS_PERIODO) return `Período máximo: ${MAX_DIAS_PERIODO} dias. Divida em partes.`;
  return "";
}

export default function ConsolidadoMapas({ dark, nomeProj = (p) => p, projetos = PROJETOS_DO_MAPA, ler = loadMapasPeriodo, abrir = abrirParaImpressao, agora = () => new Date() }) {
  const txt = dark ? "#f1f5f9" : "#0f172a";
  const txt2 = dark ? "#94a3b8" : "#64748b";
  const borda = dark ? "#1e293b" : "#e2e8f0";
  const campo = { background: dark ? "#0b1220" : "#fff", color: txt, border: `1px solid ${dark ? "#334155" : "#cbd5e1"}`, borderRadius: 8, padding: "6px 8px", fontSize: 12.5, minWidth: 0 };
  const rot = { fontSize: 10.5, fontWeight: 700, color: txt2, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 };
  const btn = (ativo) => ({ border: `1px solid ${ativo ? "#7c3aed" : borda}`, background: ativo ? "#7c3aed22" : "transparent", color: ativo ? "#a78bfa" : txt2, borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" });

  const hoje = dataBrasilia(agora());
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState(() => somarDias(hoje, -6));
  const [ate, setAte] = useState(hoje);
  const [projeto, setProjeto] = useState("");
  const [turno, setTurno] = useState("");
  const [lider, setLider] = useState("");
  const [ocorrencia, setOcorrencia] = useState("todos");
  const [colaborador, setColaborador] = useState("");
  const [detalhado, setDetalhado] = useState(false);
  const [mapas, setMapas] = useState(null); // null = ainda não buscou
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const periodo = (a, b) => { setDe(a); setAte(b); setMapas(null); setLider(""); };
  const lista = projeto ? [projeto] : projetos;
  const filtros = { de, ate, projetos: projeto ? [projeto] : [], turno, lider, ocorrencia, colaborador };
  const resultado = useMemo(() => (mapas ? consolidar(mapas, filtros) : null), [mapas, de, ate, projeto, turno, lider, ocorrencia, colaborador]);
  const lideres = useMemo(() => listaLideres(mapas || []), [mapas]);

  const buscar = async () => {
    setAviso("");
    const inval = validarPeriodo(de, ate);
    if (inval) { setErro(inval); return; }
    setErro(""); setBuscando(true);
    try {
      setMapas(await ler(lista, de, ate));
      setLider("");
    } catch (e) {
      setMapas(null);
      setErro("Não consegui ler os mapas agora. Confira a conexão e tente de novo (nada foi gerado).");
    } finally { setBuscando(false); }
  };

  const baixar = () => {
    if (!resultado) return;
    const modo = abrir(gerarConsolidadoMapasHTML({ resultado, nomeProj, projeto: projeto ? { id: projeto, name: "" } : null, detalhado, hoje: agora() }), `consolidado_mapa_equipe_${de}_${ate}.html`);
    setAviso(modo === "download" ? "O navegador bloqueou a nova aba: o consolidado foi baixado como HTML. Abra o arquivo e toque em \"Imprimir / Salvar PDF\"." : "");
  };

  const t = resultado ? resultado.totais : null;
  return (
    <div data-testid="consolidado-mapas" style={{ marginTop: 10, borderTop: `1px solid ${borda}`, paddingTop: 10 }}>
      <button type="button" onClick={() => setAberto((a) => !a)} style={{ ...btn(aberto), width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between" }} aria-expanded={aberto}>
        <span>Consolidado em PDF (período, plantão, líder, FT ou falta)</span><span>{aberto ? "⌄" : "›"}</span>
      </button>
      {aberto && (
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div>
            <div style={rot}>Período</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              <button type="button" style={btn(false)} onClick={() => periodo(hoje, hoje)}>Hoje</button>
              <button type="button" style={btn(false)} onClick={() => periodo(somarDias(hoje, -6), hoje)}>7 dias</button>
              <button type="button" style={btn(false)} onClick={() => periodo(somarDias(hoje, -29), hoje)}>30 dias</button>
              <button type="button" style={btn(false)} onClick={() => periodo(`${hoje.slice(0, 8)}01`, hoje)}>Mês atual</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input aria-label="Data inicial" type="date" value={de} max={ate} onChange={(ev) => { setDe(ev.target.value); setMapas(null); }} style={campo} />
              <span style={{ color: txt2, fontSize: 12 }}>até</span>
              <input aria-label="Data final" type="date" value={ate} min={de} onChange={(ev) => { setAte(ev.target.value); setMapas(null); }} style={campo} />
            </div>
          </div>
          <div>
            <div style={rot}>Projeto</div>
            <select aria-label="Projeto" value={projeto} onChange={(ev) => { setProjeto(ev.target.value); setMapas(null); setLider(""); }} style={{ ...campo, width: "100%" }}>
              <option value="">Todos os projetos</option>
              {projetos.map((p) => <option key={p} value={p}>{nomeProj(p)}</option>)}
            </select>
          </div>
          <button type="button" onClick={buscar} disabled={buscando} style={{ ...btn(true), padding: "8px 12px", fontSize: 12.5 }}>{buscando ? "Buscando…" : mapas ? "Buscar de novo" : "Buscar mapas do período"}</button>
          {erro && <div role="alert" style={{ color: "#dc2626", fontSize: 12, fontWeight: 700 }}>{erro}</div>}
          {mapas && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
                <div><div style={rot}>Plantão</div>
                  <select aria-label="Plantão" value={turno} onChange={(ev) => setTurno(ev.target.value)} style={{ ...campo, width: "100%" }}>
                    <option value="">Diurno e noturno</option><option value="D">Diurno</option><option value="N">Noturno</option>
                  </select></div>
                <div><div style={rot}>Líder</div>
                  <select aria-label="Líder" value={lider} onChange={(ev) => setLider(ev.target.value)} style={{ ...campo, width: "100%" }}>
                    <option value="">Todos os líderes</option>
                    {lideres.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select></div>
                <div style={{ gridColumn: "1 / -1" }}><div style={rot}>Falta / FT</div>
                  <select aria-label="Falta ou FT" value={ocorrencia} onChange={(ev) => setOcorrencia(ev.target.value)} style={{ ...campo, width: "100%" }}>
                    {OCORRENCIAS.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
                  </select></div>
                <div style={{ gridColumn: "1 / -1" }}><div style={rot}>Colaborador (opcional)</div>
                  <input aria-label="Colaborador" value={colaborador} onChange={(ev) => setColaborador(ev.target.value)} placeholder="Parte do nome" style={{ ...campo, width: "100%", boxSizing: "border-box" }} /></div>
              </div>
              <div data-testid="consolidado-resumo" style={{ fontSize: 12.5, color: txt, fontWeight: 700 }}>
                {t.mapas} mapa{t.mapas === 1 ? "" : "s"} concluído{t.mapas === 1 ? "" : "s"} · {t.falta} falta{t.falta === 1 ? "" : "s"} · {t.ft} FT
                {mapas.length === 0 && <span style={{ color: txt2, fontWeight: 400 }}> — nenhum mapa concluído no período</span>}
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: txt2 }}>
                <input type="checkbox" checked={detalhado} onChange={(ev) => setDetalhado(ev.target.checked)} /> Detalhar cada mapa no PDF (efetivo, material, km, resumo)
              </label>
              <button type="button" onClick={baixar} style={{ border: "none", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                Baixar consolidado (PDF)
              </button>
              {aviso && <div role="status" style={{ color: "#f59e0b", fontSize: 12 }}>{aviso}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
