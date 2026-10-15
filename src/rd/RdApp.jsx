// MK RD — padrão aprovado pelo Marcio (15/10):
// • abrir o RD é SEMPRE o painel de iniciar a próxima visita (tela 0); dia arquivado vira uma
//   linha discreta e vive na pasta de RDs arquivados — abrir um destino reabre o dia sozinho;
// • visita enxuta no modelo 2C: 4 chavinhas (administração, equipe, emp. de segurança e
//   seg. eletrônica) com caixa de texto que cresce em cascata + lembrete + observações. Só;
// • consulta é LEITURA (texto corrido, estilo 2C); o formulário aparece só no "Editar";
// • pasta com período De/Até, resumo na hora e consolidado do intervalo.
import { useEffect, useMemo, useRef, useState } from "react";
import { criarRdStore } from "./rdStore";
import { criarMarco, linkMapa } from "./rdGeo";
import { imprimirRd } from "./rdPdf";
import { imprimirConsolidado, consolidarPeriodo } from "./rdConsolidado";
import { comprimirFoto, novoIdFoto } from "./rdFoto";
import {
  listarDestinos, rotuloDestino, normalizarCodigoNovo, novoIdTrecho, hojeISO, dataBR,
  trechoAberto, ultimoFechado, origemAtual, herdarKmInicial, kmDoTrecho, projetarKmFinal,
  pedagiosSugeridos, memoriaAposTrecho, pendenciasDoDestino, memoriaAposVisita,
  totaisDoDia, permanencias, minutosFmt, horaDe, brl, kmFmt,
} from "./rdCalc";
import "./rd.css";

const chaveDraft = (uid, data) => `rd:v1:${uid}:${data}`;
const comHora = (marco, hhmm) => (!marco || !/^\d{2}:\d{2}$/.test(hhmm) ? marco : { ...marco, em: marco.em.slice(0, 11) + hhmm + marco.em.slice(16), editado: true });
const Marco = ({ rotulo, marco, onHora }) => !marco ? null : (
  <p className="rd-marco">{rotulo} {onHora
    ? <input className="rd-hora" type="time" aria-label={"Horário " + rotulo.toLowerCase()} value={horaDe(marco)} onChange={(e) => onHora(comHora(marco, e.target.value))} />
    : <strong>{horaDe(marco)}</strong>}{marco.editado ? " (editado)" : ""}{marco.endereco ? ` · ${marco.endereco}` : ""}{marco.gps ? <> · <a href={linkMapa(marco.gps)} target="_blank" rel="noopener noreferrer">mapa</a></> : " · sem localização"}</p>
);

// Chavinhas da visita (modelo 2C). Guardadas como atividades com tag: "Rótulo — texto".
const TRATATIVAS_PADRAO = [
  ["adm", "Contato com a administração", "Administração"],
  ["equipe", "Contato com a equipe", "Equipe"],
  ["segemp", "Contato com emp. de segurança", "Emp. de segurança"],
  ["segel", "Contato com seg. eletrônica", "Seg. eletrônica"],
];
const obsDaTag = (t, tag, rotulo) => { const a = (t.atividades || []).find((x) => x.tag === tag); if (!a) return null; return a.texto.startsWith(rotulo + " — ") ? a.texto.slice(rotulo.length + 3) : ""; };
// Caixa em cascata: o nº de linhas acompanha o texto (nunca rola para o lado).
const linhasDe = (s) => Math.min(10, Math.max(2, Math.ceil(String(s || "").length / 38) + (String(s || "").split("\n").length - 1)));

// Km rodado em tempo real: número a partir do que está digitado no painel.
const kmNum = (v) => { if (v == null || v === "") return null; const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
const rodadoEntre = (ini, fim) => { const a = kmNum(ini), b = kmNum(fim); return a != null && b != null && b >= a ? b - a : null; };

export default function RdApp({ auth, onBack, dark = true, criarMarcoFn = criarMarco, comprimirFotoFn = comprimirFoto }) {
  const store = useMemo(() => criarRdStore(auth), [auth]);
  const uid = auth?.currentUser?.uid || "anon";
  const [data, setData] = useState(hojeISO());
  const [dia, setDia] = useState(null), [diaRev, setDiaRev] = useState(0);
  const [mem, setMem] = useState(null), [memRev, setMemRev] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [kmPartida, setKmPartida] = useState(null);     // km inicial do próximo trecho (null = herdado)
  const [veiculo, setVeiculo] = useState(null);         // null = último usado
  const [novoCodigo, setNovoCodigo] = useState(null);   // "MK novo…" aberto
  const [kmChegada, setKmChegada] = useState(null);     // null = projeção cravada
  const [lembreteNovo, setLembreteNovo] = useState("");
  const [config, setConfig] = useState(false);
  const [dias, setDias] = useState([]);
  const [pronto, setPronto] = useState(false);
  const [expandido, setExpandido] = useState(null);   // trecho antigo aberto na linha do dia
  const [editTrecho, setEditTrecho] = useState(null); // trecho em edição (formulário); fora dele, leitura
  const [arquivo, setArquivo] = useState(false);      // pasta "RDs arquivados"
  const [consulta, setConsulta] = useState(false);    // RD aberto pela pasta (modo leitura)
  const [per, setPer] = useState(null);               // período da pasta {de, ate}
  const [perDias, setPerDias] = useState(null);       // dias completos do período (para resumo e consolidado)
  const cfgTimer = useRef(null);                      // a configuração salva sozinha (debounce)
  const tema = "rd" + (dark ? "" : " rd-claro");      // acompanha o tema do app

  async function run(fn) { if (busy) return; setBusy(true); setError(""); setNotice(""); try { await fn(); } catch (e) { setError(e.message || "Não foi possível concluir. Rascunho local preservado."); } finally { setBusy(false); } }

  useEffect(() => { let on = true; (async () => {
    setPronto(false);
    try {
      const r = await store.ler(data);
      if (!on) return;
      setDia(r.dia || { data, estado: "aberto", trechos: [] }); setDiaRev(r.dia?.revisao || 0);
      setMem(r.memoria || {}); setMemRev(r.memoria?.revisao || 0);
      try { const d = await store.dias(); if (on) setDias(d.dias || []); } catch { /* histórico é opcional */ }
    } catch (e) {
      if (!on) return;
      let local = null; try { local = JSON.parse(localStorage.getItem(chaveDraft(uid, data)) || "null"); } catch { local = null; }
      setDia(local?.dia || { data, estado: "aberto", trechos: [] }); setMem(local?.mem || {});
      setError(e.message + (local ? " Mostrando o rascunho deste aparelho." : ""));
    }
    if (on) setPronto(true);
  })(); return () => { on = false; }; }, [store, data, uid]);

  useEffect(() => { if (pronto && dia) { try { localStorage.setItem(chaveDraft(uid, data), JSON.stringify({ dia, mem })); } catch { /* sem espaço: segue */ } } }, [dia, mem, pronto, uid, data]);

  async function salvar(novoDia, novaMem) {
    const payload = { data, revisao: diaRev, dia: novoDia, ...(novaMem ? { memoria: novaMem, memoriaRevisao: memRev } : {}) };
    const r = await store.salvar(payload);
    setDia(r.dia); setDiaRev(r.dia.revisao);
    if (r.memoria) { setMem(r.memoria); setMemRev(r.memoria.revisao); }
    return r;
  }

  const aberto = trechoAberto(dia);
  const estou = origemAtual(dia);
  const fechadoAtual = ultimoFechado(dia);
  const destinos = listarDestinos(mem);
  const hoje = data === hojeISO();
  const mudarTrecho = (id, patch) => setDia((d) => ({ ...d, trechos: d.trechos.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));

  // IMPORTANTE: os blocos abaixo são FUNÇÕES de render (chamadas direto no JSX), nunca componentes
  // declarados dentro do RdApp. Componente interno ganha identidade nova a cada render: o React
  // desmonta e remonta os inputs a cada letra digitada e o teclado do celular cai (bug de campo 15/10).
  const renderComprovante = (item, onFoto) => item.fotoId
    ? <button className="rd-comprovante ok" title="Comprovante anexado — toque para remover" onClick={() => { if (window.confirm("Remover o comprovante deste lançamento?")) onFoto(null); }}>✓ 📎</button>
    : <label className="rd-comprovante" title="Anexar comprovante (foto)">📎<input type="file" accept="image/*" capture="environment" aria-label="Anexar comprovante" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; run(async () => { const b64 = await comprimirFotoFn(f); const fotoId = novoIdFoto(); await store.salvarFoto(fotoId, b64); onFoto(fotoId); setNotice("Comprovante anexado."); }); }} /></label>;

  // Um toque no destino abre o trecho na hora (km herdado, veículo lembrado, GPS cravado).
  // Dia já arquivado? Reabre sozinho e a linha continua (trecho 3, 4…) — arquiva de novo no fim.
  async function abrirPara(destino) {
    const kmInicial = kmPartida != null && kmPartida !== "" ? kmPartida : (herdarKmInicial(dia) ?? "");
    const marco = await criarMarcoFn();
    const t = {
      id: novoIdTrecho(), origem: estou, destino, veiculo: veiculo || ultimoFechado(dia)?.veiculo || "carro",
      kmInicial: kmInicial === "" ? null : kmInicial, kmFinal: null,
      abertura: marco, chegada: null,
      pedagios: pedagiosSugeridos(mem, estou, destino), gastos: [], atividades: [], obs: "",
    };
    const reabriu = dia.estado === "fechado";
    const novoDia = { ...dia, estado: "aberto", trechos: [...dia.trechos, t] };
    setDia(novoDia); setKmPartida(null); setNovoCodigo(null); setKmChegada(null);
    await salvar(novoDia);
    setNotice(`Trecho aberto para ${rotuloDestino(mem, destino)} às ${horaDe(marco)}${marco.gps ? "" : " (sem localização)"}.${reabriu ? " O dia reabriu e continua a linha — arquive de novo no fim." : ""}`);
  }

  const projecaoAberto = aberto ? projetarKmFinal(mem, aberto.origem, aberto.destino, aberto.kmInicial) : null;
  // Km final já vem CRAVADO pela projeção da rota: é só conferir no painel e fechar — ou corrigir o número.
  const kmFinalEfetivo = kmChegada != null ? kmChegada : (projecaoAberto != null ? String(projecaoAberto) : "");

  async function fecharTrecho() {
    if (kmFinalEfetivo === "") { setError("Informe o km final do painel."); return; }
    const marco = await criarMarcoFn();
    const t = { ...aberto, kmFinal: kmFinalEfetivo, chegada: marco };
    const novoDia = { ...dia, trechos: dia.trechos.map((x) => (x.id === t.id ? t : x)) };
    const novaMem = memoriaAposTrecho(mem, t);
    setDia(novoDia); setMem(novaMem); setKmChegada(null);
    await salvar(novoDia, novaMem);
    setNotice(`Chegada em ${rotuloDestino(mem, t.destino)} cravada às ${horaDe(marco)}.`);
  }

  const diaFechamento = () => { const d = parseInt(mem?.config?.fechamentoDia, 10); return d >= 1 && d <= 28 ? d : 18; };
  const periodoAtual = (ate) => { const f = diaFechamento(); const fim = new Date(ate + "T12:00:00Z"); const ini = new Date(fim); if (fim.getUTCDate() <= f) ini.setUTCMonth(ini.getUTCMonth() - 1); ini.setUTCDate(f + 1); return { de: ini.toISOString().slice(0, 10), ate }; };
  async function imprimirComFotos(d, m) {
    const ids = (d.trechos || []).flatMap((t) => [...(t.pedagios || []), ...(t.gastos || [])]).map((x) => x.fotoId).filter(Boolean);
    let fotos = {};
    if (ids.length) { try { fotos = (await store.lerFotos(ids.slice(0, 40))).fotos || {}; } catch { fotos = {}; } }
    imprimirRd(d, m, auth?.currentUser?.email || "", fotos);
  }
  async function fecharDia() {
    const ultimoDoCiclo = Number(data.slice(8, 10)) === diaFechamento();
    // Confirmação do km final do dia antes de arquivar: "quilometragem final está correta?"
    const ultimoT = dia.trechos[dia.trechos.length - 1];
    const perguntaKm = ultimoT?.kmFinal != null && ultimoT.kmFinal !== "" ? `Km final do dia: ${ultimoT.kmFinal} — confere com o painel?\n\n` : "";
    if (!window.confirm(perguntaKm + "Salvar e arquivar o dia? O RD é gerado e o dia vai para a pasta de RDs arquivados." + (ultimoDoCiclo ? "\n\nHoje é o dia de fechamento do período: o consolidado do mês também será gerado." : ""))) return;
    let novaMem = mem;
    for (const t of dia.trechos) if ((t.atividades || []).length) novaMem = memoriaAposVisita(novaMem, t.destino, t.atividades, data);
    const novoDia = { ...dia, estado: "fechado" };
    // Primeiro GRAVA; só então a tela diz "arquivado".
    await salvar(novoDia, novaMem);
    try { const d = await store.dias(); setDias(d.dias || []); } catch { /* lista atualiza na próxima */ }
    abrirPasta(); // já leva para a pastinha, com o aviso
    setNotice(`RD de ${dataBR(data)} salvo e arquivado. Lembretes em aberto reaparecem na próxima visita a cada projeto.`);
    await imprimirComFotos(novoDia, novaMem);
    if (ultimoDoCiclo) { try { const p = periodoAtual(data); const r = await store.periodo(p.de, p.ate); imprimirConsolidado(r.dias || [], r.memoria || mem, auth?.currentUser?.email || ""); } catch (e) { setError("RD do dia gerado; o consolidado falhou: " + e.message); } }
  }

  // ── Pasta: período De/Até com resumo na hora ─────────────────────────────────
  const carregarPeriodo = async (p) => {
    setPerDias(null);
    try { const r = await store.periodo(p.de, p.ate); setPerDias(r.dias || []); } catch { setPerDias([]); }
  };
  function abrirPasta() {
    const p = per || periodoAtual(hojeISO());
    setPer(p); setArquivo(true); setConsulta(false);
    store.dias().then((d) => setDias(d.dias || [])).catch(() => {});
    carregarPeriodo(p);
  }
  const mudarPeriodo = (p) => { setPer(p); carregarPeriodo(p); };
  const atalhos = () => {
    const h = hojeISO();
    const d7 = new Date(h + "T12:00:00Z"); d7.setUTCDate(d7.getUTCDate() - 6);
    return [["Período atual", periodoAtual(h)], ["Últimos 7 dias", { de: d7.toISOString().slice(0, 10), ate: h }], ["Este mês", { de: h.slice(0, 8) + "01", ate: h }]];
  };

  // Configuração salva sozinha (1,2 s após a última tecla). Nesta fase os valores são do consultor;
  // na evolução, a edição passa a ser exclusiva da gerência Moked.
  const mudarConfig = (patch) => {
    const novaMem = { ...mem, config: { ...(mem?.config || {}), ...patch } };
    setMem(novaMem);
    clearTimeout(cfgTimer.current);
    cfgTimer.current = setTimeout(async () => {
      try { await salvar(dia, novaMem); setNotice("Configuração salva."); }
      catch (e) { setError("A configuração não salvou: " + (e.message || "erro") + " Mexa num valor para tentar de novo."); }
    }, 1200);
  };
  useEffect(() => () => clearTimeout(cfgTimer.current), []);

  // ── Blocos reutilizáveis (funções de render — ver nota acima) ────────────────
  const renderGastos = (t) => <>
    <h3>Pedágios e gastos do trecho</h3>
    {(t.pedagios || []).map((p, i) => <div className="rd-linha" key={"p" + i}>
      <input aria-label={"Pedágio " + (i + 1)} value={p.descricao} onChange={(e) => mudarTrecho(t.id, { pedagios: t.pedagios.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)) })} />
      <input aria-label={"Valor pedágio " + (i + 1)} inputMode="decimal" value={p.valor ?? ""} onChange={(e) => mudarTrecho(t.id, { pedagios: t.pedagios.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)) })} />
      {renderComprovante(p, (fotoId) => mudarTrecho(t.id, { pedagios: t.pedagios.map((x, j) => (j === i ? { ...x, ...(fotoId ? { fotoId } : { fotoId: undefined }) } : x)) }))}
      <button onClick={() => mudarTrecho(t.id, { pedagios: t.pedagios.filter((_, j) => j !== i) })}>×</button>
    </div>)}
    {(t.gastos || []).map((g, i) => <div className="rd-linha" key={"g" + i}>
      <input aria-label={"Gasto " + (i + 1)} placeholder="Descrição" value={g.descricao} onChange={(e) => mudarTrecho(t.id, { gastos: t.gastos.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)) })} />
      <input aria-label={"Valor gasto " + (i + 1)} inputMode="decimal" value={g.valor ?? ""} onChange={(e) => mudarTrecho(t.id, { gastos: t.gastos.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)) })} />
      {renderComprovante(g, (fotoId) => mudarTrecho(t.id, { gastos: t.gastos.map((x, j) => (j === i ? { ...x, ...(fotoId ? { fotoId } : { fotoId: undefined }) } : x)) }))}
      <button onClick={() => mudarTrecho(t.id, { gastos: t.gastos.filter((_, j) => j !== i) })}>×</button>
    </div>)}
    <button className="rd-link" onClick={() => mudarTrecho(t.id, { pedagios: [...(t.pedagios || []), { descricao: "Pedágio", valor: "" }] })}>+ Pedágio</button>
    <button className="rd-link" onClick={() => mudarTrecho(t.id, { gastos: [...(t.gastos || []), { descricao: "", valor: "" }] })}>+ Outro gasto</button>
  </>;

  // Visita ENXUTA (modelo 2C): pendências → 4 chavinhas com caixa em cascata → lembrete → observações.
  const renderVisita = (t) => {
    const pend = pendenciasDoDestino(mem, t.destino).filter((p) => !(t.atividades || []).some((a) => a.texto === p.texto));
    const marcarToggle = (tag, rotulo, ligada) => {
      const sem = (t.atividades || []).filter((a) => a.tag !== tag);
      mudarTrecho(t.id, { atividades: ligada ? [...sem, { tag, texto: rotulo, status: null }] : sem });
    };
    const mudarObsToggle = (tag, rotulo, obs) => {
      mudarTrecho(t.id, { atividades: (t.atividades || []).map((a) => (a.tag === tag ? { ...a, texto: obs ? `${rotulo} — ${obs}` : rotulo } : a)) });
    };
    const lembretes = (t.atividades || []).filter((a) => !a.tag && a.status === "aberto");
    const legadas = (t.atividades || []).filter((a) => !a.tag && a.status !== "aberto");
    return <>
      <h3>Visita · {rotuloDestino(mem, t.destino)}</h3>
      {pend.length > 0 && <div className="rd-pend"><strong>Pendente da última visita:</strong>
        {pend.map((p, i) => <p key={i}>{p.texto} <em>(desde {dataBR(p.desde)})</em>
          <button className="rd-link" onClick={() => { mudarTrecho(t.id, { atividades: [...(t.atividades || []), { texto: p.texto, status: "finalizado", desde: p.desde }] }); setNotice("Concluído: sai da lista de pendências quando o dia for arquivado."); }}>✓ Concluir</button></p>)}
        <p className="rd-micro">O que não for concluído continua pendente e reaparece na próxima visita.</p>
      </div>}
      {TRATATIVAS_PADRAO.map(([tag, rotulo]) => {
        const obs = obsDaTag(t, tag, rotulo);
        return <div className="rd-toggle" key={tag}>
          <label className="rd-chave"><input type="checkbox" role="switch" aria-label={rotulo} checked={obs != null} onChange={(e) => marcarToggle(tag, rotulo, e.target.checked)} /><i /><span>{rotulo}</span></label>
          {obs != null && <textarea className="rd-toggle-obs" rows={linhasDe(obs)} aria-label={"Observação " + rotulo.toLowerCase()} placeholder="O que foi tratado…" value={obs} onChange={(e) => mudarObsToggle(tag, rotulo, e.target.value)} />}
        </div>;
      })}
      {legadas.map((a, i) => <div className="rd-atv" key={"l" + i}>
        <span>{a.status === "finalizado" ? "✓ " : ""}{a.texto}</span>
        <button aria-label={"Remover registro " + (i + 1)} onClick={() => mudarTrecho(t.id, { atividades: t.atividades.filter((x) => x !== a) })}>×</button>
      </div>)}
      {lembretes.map((a, i) => <div className="rd-atv rd-atv-aberta" key={"a" + i}>
        <span>{a.texto}</span>
        <button aria-label={"Remover lembrete " + (i + 1)} onClick={() => mudarTrecho(t.id, { atividades: t.atividades.filter((x) => x !== a) })}>×</button>
      </div>)}
      {lembretes.length > 0 && <p className="rd-micro">Lembrete guardado: reaparece na sua próxima visita a {rotuloDestino(mem, t.destino)}.</p>}
      <div className="rd-linha rd-lembrete">
        <textarea rows={linhasDe(lembreteNovo)} aria-label="Lembrete para a próxima visita" placeholder="Lembrete para a PRÓXIMA visita…" value={lembreteNovo} onChange={(e) => setLembreteNovo(e.target.value)} />
        <button disabled={!lembreteNovo.trim()} onClick={() => { mudarTrecho(t.id, { atividades: [...(t.atividades || []), { texto: lembreteNovo.trim(), status: "aberto" }] }); setLembreteNovo(""); }}>+ Lembrete</button>
      </div>
      <label>Observações da visita (opcional)<textarea rows={linhasDe(t.obs)} value={t.obs || ""} onChange={(e) => mudarTrecho(t.id, { obs: e.target.value })} /></label>
    </>;
  };

  // Leitura da visita: texto corrido, estilo 2C (sem formulário).
  const renderLeituraVisita = (t) => {
    const blocos = [];
    for (const [tag, rotulo, curto] of TRATATIVAS_PADRAO) {
      const obs = obsDaTag(t, tag, rotulo);
      if (obs != null) blocos.push(<p className="rd-lp" key={tag}><b>{curto} —</b> {obs || "realizado."}</p>);
    }
    (t.atividades || []).filter((a) => !a.tag && a.status !== "aberto").forEach((a, i) => blocos.push(<p className="rd-lp" key={"g" + i}>{a.status === "finalizado" ? "✓ Concluído: " : ""}{a.texto}</p>));
    (t.atividades || []).filter((a) => !a.tag && a.status === "aberto").forEach((a, i) => blocos.push(<p className="rd-lp rd-lp-aberto" key={"a" + i}><b>Lembrete:</b> {a.texto}</p>));
    if (t.obs) blocos.push(<p className="rd-lp rd-lp-obs" key="obs">{t.obs}</p>);
    return blocos;
  };

  // Card de trecho em LEITURA: cabeçalho + chips + visita em texto; "Editar" abre o formulário.
  const renderCorpoLeitura = (t, podeEditar) => <>
    <Marco rotulo="Saída" marco={t.abertura} />
    <Marco rotulo="Chegada" marco={t.chegada} />
    <div className="rd-chips">
      {t.kmInicial != null && <span>Km <b>{t.kmInicial}{t.kmFinal != null ? ` → ${t.kmFinal}` : ""}</b></span>}
      {kmDoTrecho(t) != null && <span>Rodou <b>{kmFmt(kmDoTrecho(t))}</b></span>}
      {(t.pedagios || []).length > 0 && <span>Pedágios <b>{brl((t.pedagios || []).reduce((a, p) => a + (kmNum(p.valor) || 0), 0))}</b></span>}
      {(t.gastos || []).some((g) => kmNum(g.valor)) && <span>Gastos <b>{brl((t.gastos || []).reduce((a, g) => a + (kmNum(g.valor) || 0), 0))}</b></span>}
      <span><b>{t.veiculo === "moto" ? "Moto" : "Carro"}</b></span>
    </div>
    {t.destino !== "MK_HOME" && renderLeituraVisita(t)}
    {podeEditar && <button className="rd-link" onClick={() => setEditTrecho(t.id)}>✎ Editar este trecho</button>}
  </>;

  // Formulário completo do trecho (horas, km, gastos, visita) com Salvar.
  const renderFormTrecho = (t) => <>
    <Marco rotulo="Saída" marco={t.abertura} onHora={(m) => mudarTrecho(t.id, { abertura: m })} />
    <Marco rotulo="Chegada" marco={t.chegada} onHora={(m) => mudarTrecho(t.id, { chegada: m })} />
    <div className="rd-kmpar">
      <label>Km inicial (painel)<input inputMode="decimal" value={t.kmInicial ?? ""} onChange={(e) => mudarTrecho(t.id, { kmInicial: e.target.value })} /></label>
      <label>Km final (painel)<input inputMode="decimal" value={t.kmFinal ?? ""} onChange={(e) => mudarTrecho(t.id, { kmFinal: e.target.value })} /></label>
    </div>
    {renderGastos(t)}
    {t.destino !== "MK_HOME" && renderVisita(t)}
    <button className="rd-principal" disabled={busy} onClick={() => run(async () => { await salvar(dia); setEditTrecho(null); setNotice("Trecho atualizado."); })}>Salvar alterações</button>
  </>;

  // Cascata do próximo destino, inline: um toque abre o trecho.
  const renderProximoDestino = (titulo) => <>
    <h3>{titulo}</h3>
    <div className="rd-kmpar">
      <label>Km inicial (painel)<input inputMode="decimal" value={kmPartida ?? (herdarKmInicial(dia) ?? "")} onChange={(e) => setKmPartida(e.target.value)} /></label>
      <div className="rd-veiculo" role="group" aria-label="Fator do trecho">
        {[["carro", "🚗 Carro"], ["moto", "🏍 Moto"]].map(([v, r]) => <button key={v} aria-pressed={(veiculo || ultimoFechado(dia)?.veiculo || "carro") === v} onClick={() => setVeiculo(v)}>{r}</button>)}
      </div>
    </div>
    <div className="rd-dest">
      {destinos.filter((d) => d.codigo !== estou).map((d) => <button key={d.codigo} disabled={busy} onClick={() => run(() => abrirPara(d.codigo))}><strong>{d.rotulo}</strong><span>{d.sub}</span></button>)}
      <button aria-pressed={novoCodigo != null} onClick={() => setNovoCodigo(novoCodigo == null ? "" : null)}><strong>Novo…</strong><span>Projeto fora da lista</span></button>
    </div>
    {novoCodigo != null && <div className="rd-linha"><span className="rd-prefixo">MK</span>
      <input aria-label="Número do projeto novo" autoFocus value={novoCodigo} onChange={(e) => setNovoCodigo(e.target.value)} placeholder="077" />
      <button disabled={busy || !normalizarCodigoNovo(novoCodigo)} onClick={() => run(() => abrirPara(normalizarCodigoNovo(novoCodigo)))}>Abrir →</button>
    </div>}
    <p className="rd-micro">Tocar no destino já abre o trecho e crava hora e local.</p>
  </>;

  const tot = totaisDoDia(dia);
  const perm = permanencias(dia);
  const cabecalhoTrecho = (t, i) => <>
    <strong>{i + 1} · {rotuloDestino(mem, t.origem)} → {rotuloDestino(mem, t.destino)}{t.veiculo === "moto" ? " 🏍" : ""}</strong>
    <span>{horaDe(t.abertura)}{t.chegada ? ` – ${horaDe(t.chegada)}` : ""} · {kmFmt(kmDoTrecho(t))}{perm[i] != null ? ` · ficou ${minutosFmt(perm[i])}` : ""}</span>
  </>;

  if (!pronto) return <main className={tema}><header><button onClick={onBack}>← Início</button><h1>MK RD</h1></header><p role="status">Abrindo o dia…</p></main>;

  // ── Pasta "RDs arquivados": período De/Até, resumo e a listinha dos dias ─────
  if (arquivo) {
    const resumo = perDias ? consolidarPeriodo(perDias, mem) : null;
    const infoDia = {};
    for (const d of perDias || []) infoDia[d.data] = {
      km: (d.trechos || []).reduce((a, t) => a + (kmDoTrecho(t) || 0), 0),
      projetos: [...new Set((d.trechos || []).map((t) => t.destino).filter((x) => x !== "MK_HOME" && x !== "MK_OFFICE"))].map((c) => rotuloDestino(mem, c)).join(" · "),
    };
    return <main className={tema}>
      <header><button onClick={() => { setArquivo(false); setConsulta(false); setData(hojeISO()); }}>← Voltar ao dia</button><h1>MK RD · Arquivados</h1>
        <p>Escolha o período para o resumo e o consolidado; toque num dia para abrir o RD dele.</p></header>
      {error && <div role="alert" className="rd-erro">{error}</div>}
      {notice && <p role="status" className="rd-aviso">{notice}</p>}
      <section className="rd-card">
        <div className="rd-kmpar">
          <label>De<input type="date" aria-label="Período: de" value={per?.de || ""} onChange={(e) => e.target.value && mudarPeriodo({ ...per, de: e.target.value })} /></label>
          <label>Até<input type="date" aria-label="Período: até" value={per?.ate || ""} onChange={(e) => e.target.value && mudarPeriodo({ ...per, ate: e.target.value })} /></label>
        </div>
        <div className="rd-dias" style={{ marginTop: 8 }}>
          {atalhos().map(([rotulo, p]) => <button key={rotulo} aria-pressed={per?.de === p.de && per?.ate === p.ate} onClick={() => mudarPeriodo(p)}>{rotulo}</button>)}
        </div>
        {resumo && resumo.dias > 0 && <div className="rd-chips" style={{ marginTop: 10 }}>
          <span>Dias <b>{resumo.dias}</b></span><span>Km <b>{kmFmt(resumo.km)}</b></span>
          <span>Despesas <b>{brl(resumo.despesas)}</b></span>
          {resumo.reembolsoKm != null && <span>Reembolso km <b>{brl(resumo.reembolsoKm)}</b></span>}
          {resumo.totalGeral != null && <span className="rd-chip-total">Total geral <b>{brl(resumo.totalGeral)}</b></span>}
        </div>}
        {perDias === null && <p className="rd-micro">Calculando o período…</p>}
        <button className="rd-principal" disabled={busy || !perDias || !perDias.length} onClick={() => run(async () => { imprimirConsolidado(perDias, mem, auth?.currentUser?.email || ""); })}>Gerar consolidado do período (PDF)</button>
      </section>
      <section className="rd-card">
        {dias.length === 0 && <p className="rd-micro">Nenhum RD ainda. Feche um dia com "Salvar e arquivar" e ele aparece aqui.</p>}
        {dias.map((d) => <div key={d.data} className="rd-arq-linha">
          <button className="rd-arq-item" onClick={() => { setData(d.data); setConsulta(true); setArquivo(false); setEditTrecho(null); }}>
            <div><strong>{dataBR(d.data)}</strong><span>{d.trechos} trecho{d.trechos === 1 ? "" : "s"}{infoDia[d.data] ? ` · ${kmFmt(infoDia[d.data].km)}${infoDia[d.data].projetos ? ` · ${infoDia[d.data].projetos}` : ""}` : ""}</span></div>
            <em className={d.estado === "fechado" ? "ok" : "andamento"}>{d.estado === "fechado" ? "✓ Arquivado" : "Em aberto"}</em>
          </button>
          <button className="rd-arq-apagar" aria-label={"Apagar o RD de " + dataBR(d.data)} disabled={busy}
            onClick={() => { if (!window.confirm(`Apagar o RD de ${dataBR(d.data)}? (fase de teste — depois de aprovado, RD enviado será definitivo)`)) return; run(async () => {
              await store.excluir(d.data);
              setDias((xs) => xs.filter((x) => x.data !== d.data));
              try { localStorage.removeItem(chaveDraft(uid, d.data)); } catch { /* sem draft */ }
              if (d.data === data) { setDia({ data, estado: "aberto", trechos: [] }); setDiaRev(0); }
              setNotice(`RD de ${dataBR(d.data)} apagado.`);
            }); }}>🗑</button>
        </div>)}
        <p className="rd-micro">Fase de teste: apagar é permitido. Na evolução, RD enviado fica definitivo — só consulta.</p>
      </section>
    </main>;
  }

  // ── Tela de configuração (fora do fluxo do dia) ──────────────────────────────
  if (config) return <main className={tema}>
    <header><button onClick={() => setConfig(false)}>← Voltar ao dia</button><h1>MK RD · Configurar</h1></header>
    {error && <div role="alert" className="rd-erro">{error}</div>}
    {notice && <p role="status" className="rd-aviso">{notice}</p>}
    <section className="rd-card">
      <div className="rd-linha">
        <label>Km carro (R$)<input inputMode="decimal" value={mem?.config?.valorKm ?? ""} onChange={(e) => mudarConfig({ valorKm: e.target.value })} /></label>
        <label>Km moto (R$)<input inputMode="decimal" value={mem?.config?.valorKmMoto ?? ""} onChange={(e) => mudarConfig({ valorKmMoto: e.target.value })} /></label>
      </div>
      <div className="rd-linha">
        <label>Diária (R$)<input inputMode="decimal" value={mem?.config?.valorDiaria ?? ""} onChange={(e) => mudarConfig({ valorDiaria: e.target.value })} /></label>
        <label>Dia do fechamento<input inputMode="numeric" value={mem?.config?.fechamentoDia ?? 18} onChange={(e) => mudarConfig({ fechamentoDia: e.target.value })} /></label>
      </div>
      <p className="rd-micro">Os valores salvam sozinhos ao digitar. Nesta fase de teste a configuração é sua; na evolução, só a gerência Moked edita.</p>
    </section>
  </main>;

  // ── Consulta: RD aberto pela pasta (ou de outro dia) — LEITURA, estilo 2C ────
  if (consulta || !hoje) {
    const reaberto = dia.estado !== "fechado";
    return <main className={tema}>
      <header><button onClick={abrirPasta}>← Arquivados</button>
        <h1>RD de {dataBR(data)}</h1>
        <p>{dia.estado === "fechado" ? "✓ Arquivado" : "Reaberto para ajuste"} · {dia.trechos.length} trecho{dia.trechos.length === 1 ? "" : "s"} · {kmFmt(tot.km)} · despesas {brl(tot.pedagios + tot.gastos)}</p></header>
      {error && <div role="alert" className="rd-erro">{error}</div>}
      {notice && <p role="status" className="rd-aviso">{notice}</p>}
      {dia.trechos.map((t, i) => <section className="rd-card" key={t.id}>
        <div className="rd-trecho-head" style={{ cursor: "default" }}><div>{cabecalhoTrecho(t, i)}</div></div>
        {editTrecho === t.id ? renderFormTrecho(t) : renderCorpoLeitura(t, reaberto)}
      </section>)}
      <section className="rd-card rd-arquivado">
        <button className="rd-principal" disabled={busy} onClick={() => run(() => imprimirComFotos(dia, mem))}>Gerar RD (PDF)</button>
        {!reaberto && <button className="rd-link" disabled={busy} onClick={() => run(async () => { const novoDia = { ...dia, estado: "aberto" }; setDia(novoDia); await salvar(novoDia); setNotice("Dia reaberto: toque em Editar no trecho que precisa de ajuste e arquive de novo."); })}>Reabrir para ajustar</button>}
        {reaberto && <button className="rd-fechar" disabled={busy} onClick={() => run(fecharDia)}>Salvar e arquivar de novo</button>}
      </section>
    </main>;
  }

  // ── Tela 0: dia de hoje já arquivado → painel pronto para a próxima visita ──
  if (dia.estado === "fechado") return <main className={tema}>
    <header><button onClick={onBack}>← Início</button>
      <h1>MK RD · Relatório Diário <button className="rd-engrenagem" aria-label="Configurar" onClick={() => setConfig(true)}>⚙</button><button className="rd-arquivo-btn" aria-label="RDs arquivados" onClick={abrirPasta}>🗂</button></h1>
      <p>{dataBR(data)} · pronto para a próxima visita</p></header>
    {error && <div role="alert" className="rd-erro">{error}</div>}
    {notice && <p role="status" className="rd-aviso">{notice}</p>}
    <section className="rd-card rd-atual">{renderProximoDestino(estou === "MK_HOME" ? "Sair de casa — para onde?" : `Sair de ${rotuloDestino(mem, estou)} — para onde?`)}</section>
    <button className="rd-arq-item" onClick={() => { setConsulta(true); setEditTrecho(null); }}>
      <div><strong>RD de hoje já arquivado</strong><span>{dia.trechos.length} trecho{dia.trechos.length === 1 ? "" : "s"} · {kmFmt(tot.km)} — tocar para abrir (também na pasta 🗂)</span></div>
      <em className="ok">✓ Arquivado</em>
    </button>
    <p className="rd-micro" style={{ margin: "8px 2px" }}>Saiu de novo? Toque no destino: o dia reabre sozinho e a linha continua (trecho {dia.trechos.length + 1}…).</p>
  </main>;

  // ── Tela do dia (trabalho): os trechos em LINHA ──────────────────────────────
  return <main className={tema}>
    <header><button onClick={onBack}>← Início</button>
      <h1>MK RD · Relatório Diário <button className="rd-engrenagem" aria-label="Configurar" onClick={() => setConfig(true)}>⚙</button><button className="rd-arquivo-btn" aria-label="RDs arquivados" onClick={abrirPasta}>🗂</button></h1>
      <p>{dataBR(data)} · {aberto ? `em deslocamento para ${rotuloDestino(mem, aberto.destino)}` : `você está em ${rotuloDestino(mem, estou)}`}</p></header>
    {error && <div role="alert" className="rd-erro">{error}</div>}
    {notice && <p role="status" className="rd-aviso">{notice}</p>}
    {dia.trechos.length > 0 && <p className="rd-totais">Dia em linha · {dia.trechos.length} trecho{dia.trechos.length > 1 ? "s" : ""} · {kmFmt(tot.km)} · pedágios {brl(tot.pedagios)}{tot.gastos ? ` · gastos ${brl(tot.gastos)}` : ""}</p>}

    {dia.trechos.map((t, i) => {
      if (aberto && t.id === aberto.id) return <section className="rd-card rd-atual" key={t.id}>
        <h2>Em deslocamento · {rotuloDestino(mem, t.origem)} → {rotuloDestino(mem, t.destino)}{t.veiculo === "moto" ? " · 🏍" : ""}</h2>
        <Marco rotulo="Saída" marco={t.abertura} onHora={(m) => mudarTrecho(t.id, { abertura: m })} />
        <div className="rd-kmpar">
          <label>Km inicial (painel)<input inputMode="decimal" value={t.kmInicial ?? ""} onChange={(e) => mudarTrecho(t.id, { kmInicial: e.target.value })} /></label>
          <label>Km final (painel)<input inputMode="decimal" className={kmChegada == null && projecaoAberto != null ? "rd-cravado" : ""} value={kmFinalEfetivo} onChange={(e) => setKmChegada(e.target.value)} /></label>
        </div>
        {(() => { const r = rodadoEntre(t.kmInicial, kmFinalEfetivo); return r != null ? <p className="rd-rodado">Saiu com {t.kmInicial} · chega com {kmFinalEfetivo} → rodou {kmFmt(r)}</p> : null; })()}
        {projecaoAberto != null && <p className="rd-dica">Rota conhecida: km final já cravado em <strong>{kmFmt(projecaoAberto)}</strong> — confira no painel e corrija se precisar.</p>}
        {renderGastos(t)}
        {t.destino !== "MK_HOME" && renderVisita(t)}
        <button className="rd-principal" disabled={busy} onClick={() => run(fecharTrecho)}>Cheguei — fechar o trecho</button>
        <p><button className="rd-link" disabled={busy} onClick={() => { if (!window.confirm("Cancelar este trecho? Use quando abriu por engano (projeto errado). A marcação de saída é descartada.")) return; run(async () => { const novoDia = { ...dia, trechos: dia.trechos.filter((x) => x.id !== t.id) }; setDia(novoDia); setKmChegada(null); await salvar(novoDia); setNotice("Trecho cancelado. Abra de novo com o destino certo."); }); }}>Abri por engano — cancelar este trecho</button></p>
      </section>;

      if (!aberto && fechadoAtual && t.id === fechadoAtual.id) return <section className="rd-card rd-atual" key={t.id}>
        <h2>Você está em {rotuloDestino(mem, t.destino)}</h2>
        <Marco rotulo="Chegada" marco={t.chegada} onHora={(m) => mudarTrecho(t.id, { chegada: m })} />
        {(() => { const r = rodadoEntre(t.kmInicial, t.kmFinal); return r != null ? <p className="rd-rodado">Trecho: saiu com {t.kmInicial} · chegou com {t.kmFinal} → rodou {kmFmt(r)}</p> : null; })()}
        {t.destino !== "MK_HOME" && renderVisita(t)}
        <button className="rd-link" disabled={busy} onClick={() => run(async () => { await salvar(dia); setNotice("Visita salva."); })}>Salvar visita</button>
        {estou === "MK_HOME"
          ? <button className="rd-fechar" disabled={busy} onClick={() => run(fecharDia)}>Salvar e arquivar o dia — gerar o RD</button>
          : renderProximoDestino("Para onde agora?")}
      </section>;

      const ab = expandido === t.id;
      return <section className="rd-card rd-trecho" key={t.id}>
        <button className="rd-trecho-head" aria-expanded={ab} onClick={() => { setExpandido(ab ? null : t.id); if (ab) setEditTrecho(null); }}>
          <div>{cabecalhoTrecho(t, i)}</div>
          <em>{ab ? "⌄" : "›"}</em>
        </button>
        {ab && (editTrecho === t.id ? renderFormTrecho(t) : renderCorpoLeitura(t, true))}
      </section>;
    })}

    {dia.trechos.length === 0 && <section className="rd-card rd-atual">
      {renderProximoDestino("Sair de casa — para onde?")}
    </section>}
  </main>;
}
