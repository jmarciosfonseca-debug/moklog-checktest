// MK RD — dia em trechos encadeados. Chegar fecha o trecho; a saída só é cravada ao abrir o próximo.
import { useEffect, useMemo, useState } from "react";
import { criarRdStore } from "./rdStore";
import { criarMarco, linkMapa } from "./rdGeo";
import { imprimirRd } from "./rdPdf";
import { imprimirConsolidado } from "./rdConsolidado";
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

export default function RdApp({ auth, onBack, criarMarcoFn = criarMarco }) {
  const store = useMemo(() => criarRdStore(auth), [auth]);
  const uid = auth?.currentUser?.uid || "anon";
  const [data, setData] = useState(hojeISO());
  const [dia, setDia] = useState(null), [diaRev, setDiaRev] = useState(0);
  const [mem, setMem] = useState(null), [memRev, setMemRev] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [abrindo, setAbrindo] = useState(null); // {origem,destino,kmInicial,novoCodigo}
  const [kmChegada, setKmChegada] = useState(null);
  const [atividadeNova, setAtividadeNova] = useState("");
  const [config, setConfig] = useState(false);
  const [dias, setDias] = useState([]);
  const [pronto, setPronto] = useState(false);

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
  const mudarTrecho = (id, patch) => setDia((d) => ({ ...d, trechos: d.trechos.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));

  function iniciarAbertura() {
    setAbrindo({ origem: estou, destino: "", kmInicial: herdarKmInicial(dia) ?? "", novoCodigo: null });
  }

  async function abrirTrecho() {
    const destino = abrindo.novoCodigo != null ? normalizarCodigoNovo(abrindo.novoCodigo) : abrindo.destino;
    if (!destino) { setError("Escolha o destino."); return; }
    const marco = await criarMarcoFn();
    const t = {
      id: novoIdTrecho(), origem: abrindo.origem, destino,
      kmInicial: abrindo.kmInicial === "" ? null : abrindo.kmInicial, kmFinal: null,
      abertura: marco, chegada: null,
      pedagios: pedagiosSugeridos(mem, abrindo.origem, destino), gastos: [], atividades: [], obs: "",
    };
    const novoDia = { ...dia, trechos: [...dia.trechos, t] };
    setDia(novoDia); setAbrindo(null); setKmChegada(null);
    await salvar(novoDia);
    setNotice(`Trecho aberto para ${rotuloDestino(mem, destino)} às ${horaDe(marco)}${marco.gps ? "" : " (sem localização)"}.`);
  }

  async function fecharTrecho() {
    if (kmChegada == null || kmChegada === "") { setError("Informe o km final do painel."); return; }
    const marco = await criarMarcoFn();
    const t = { ...aberto, kmFinal: kmChegada, chegada: marco };
    const novoDia = { ...dia, trechos: dia.trechos.map((x) => (x.id === t.id ? t : x)) };
    const novaMem = memoriaAposTrecho(mem, t);
    setDia(novoDia); setMem(novaMem); setKmChegada(null);
    await salvar(novoDia, novaMem);
    setNotice(`Chegada em ${rotuloDestino(mem, t.destino)} cravada às ${horaDe(marco)}. O dia fica em aberto aqui até você abrir o próximo trecho.`);
  }

  const diaFechamento = () => { const d = parseInt(mem?.config?.fechamentoDia, 10); return d >= 1 && d <= 28 ? d : 18; };
  const periodoAtual = (ate) => { const f = diaFechamento(); const fim = new Date(ate + "T12:00:00Z"); const ini = new Date(fim); if (fim.getUTCDate() <= f) ini.setUTCMonth(ini.getUTCMonth() - 1); ini.setUTCDate(f + 1); return { de: ini.toISOString().slice(0, 10), ate }; };
  async function gerarConsolidado(ate) {
    const { de } = periodoAtual(ate);
    const r = await store.periodo(de, ate);
    imprimirConsolidado(r.dias || [], r.memoria || mem, auth?.currentUser?.email || "");
  }
  async function fecharDia() {
    const ultimoDoCiclo = Number(data.slice(8, 10)) === diaFechamento();
    if (!window.confirm("Fechar o dia e gerar o RD?" + (ultimoDoCiclo ? "\n\nHoje é o dia de fechamento do período: o consolidado do mês também será gerado." : ""))) return;
    let novaMem = mem;
    for (const t of dia.trechos) if ((t.atividades || []).length) novaMem = memoriaAposVisita(novaMem, t.destino, t.atividades, data);
    const novoDia = { ...dia, estado: "fechado" };
    setDia(novoDia); setMem(novaMem);
    await salvar(novoDia, novaMem);
    imprimirRd(novoDia, novaMem, auth?.currentUser?.email || "");
    if (ultimoDoCiclo) { try { await gerarConsolidado(data); } catch (e) { setError("RD do dia gerado; o consolidado falhou: " + e.message); } }
  }

  const projecao = abrindo ? projetarKmFinal(mem, abrindo.origem, abrindo.novoCodigo != null ? normalizarCodigoNovo(abrindo.novoCodigo) || "" : abrindo.destino, abrindo.kmInicial) : null;
  const projecaoAberto = aberto ? projetarKmFinal(mem, aberto.origem, aberto.destino, aberto.kmInicial) : null;
  const pendencias = fechadoAtual && !aberto ? pendenciasDoDestino(mem, fechadoAtual.destino) : [];
  const tot = totaisDoDia(dia);
  const perm = permanencias(dia);

  if (!pronto) return <main className="rd"><header><button onClick={onBack}>← Início</button><h1>MK RD</h1></header><p role="status">Abrindo o dia…</p></main>;

  const voltar = () => { if (abrindo) setAbrindo(null); else onBack(); };
  return <main className="rd">
    <header><button onClick={voltar}>{abrindo ? "← Voltar" : "← Início"}</button><h1>MK RD · Relatório Diário</h1>
      <p>{dataBR(data)} · {dia.estado === "fechado" ? "dia fechado" : aberto ? `em deslocamento para ${rotuloDestino(mem, aberto.destino)}` : `você está em ${rotuloDestino(mem, estou)}`}</p></header>
    {error && <div role="alert" className="rd-erro">{error}</div>}
    {notice && <p role="status" className="rd-aviso">{notice}</p>}

    {aberto && <section className="rd-card rd-atual">
      <h2>Em deslocamento · {rotuloDestino(mem, aberto.origem)} → {rotuloDestino(mem, aberto.destino)}</h2>
      <Marco rotulo="Saída" marco={aberto.abertura} onHora={(m) => mudarTrecho(aberto.id, { abertura: m })} />
      <label>Km inicial (painel)<input inputMode="decimal" value={aberto.kmInicial ?? ""} onChange={(e) => mudarTrecho(aberto.id, { kmInicial: e.target.value })} /></label>
      {projecaoAberto != null && <p className="rd-dica">Projeção de chegada: <strong>{kmFmt(projecaoAberto)}</strong> (média das viagens anteriores).</p>}
      <h3>Pedágios do trecho</h3>
      {(aberto.pedagios || []).map((p, i) => <div className="rd-linha" key={i}>
        <input aria-label={"Pedágio " + (i + 1)} value={p.descricao} onChange={(e) => mudarTrecho(aberto.id, { pedagios: aberto.pedagios.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)) })} />
        <input aria-label={"Valor pedágio " + (i + 1)} inputMode="decimal" value={p.valor ?? ""} onChange={(e) => mudarTrecho(aberto.id, { pedagios: aberto.pedagios.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)) })} />
        <button onClick={() => mudarTrecho(aberto.id, { pedagios: aberto.pedagios.filter((_, j) => j !== i) })}>×</button>
      </div>)}
      <button className="rd-link" onClick={() => mudarTrecho(aberto.id, { pedagios: [...(aberto.pedagios || []), { descricao: "Pedágio", valor: "" }] })}>+ Pedágio</button>
      <button className="rd-link" onClick={() => mudarTrecho(aberto.id, { gastos: [...(aberto.gastos || []), { descricao: "", valor: "" }] })}>+ Outro gasto</button>
      {(aberto.gastos || []).map((g, i) => <div className="rd-linha" key={"g" + i}>
        <input aria-label={"Gasto " + (i + 1)} placeholder="Descrição" value={g.descricao} onChange={(e) => mudarTrecho(aberto.id, { gastos: aberto.gastos.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)) })} />
        <input aria-label={"Valor gasto " + (i + 1)} inputMode="decimal" value={g.valor ?? ""} onChange={(e) => mudarTrecho(aberto.id, { gastos: aberto.gastos.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)) })} />
        <button onClick={() => mudarTrecho(aberto.id, { gastos: aberto.gastos.filter((_, j) => j !== i) })}>×</button>
      </div>)}
      <div className="rd-chegada">
        <label>Km final (painel)<input inputMode="decimal" placeholder={projecaoAberto != null ? String(projecaoAberto) : ""} value={kmChegada ?? ""} onChange={(e) => setKmChegada(e.target.value)} /></label>
        {projecaoAberto != null && (kmChegada == null || kmChegada === "") && <button className="rd-link" onClick={() => setKmChegada(String(projecaoAberto))}>Usar projeção</button>}
        <button className="rd-principal" disabled={busy} onClick={() => run(fecharTrecho)}>Cheguei — fechar o trecho</button>
        <p><button className="rd-link" disabled={busy} onClick={() => { if (!window.confirm("Cancelar este trecho? Use quando abriu por engano (projeto errado). A marcação de saída é descartada.")) return; run(async () => { const novoDia = { ...dia, trechos: dia.trechos.filter((t) => t.id !== aberto.id) }; setDia(novoDia); setKmChegada(null); await salvar(novoDia); setNotice("Trecho cancelado. Abra de novo com o destino certo."); }); }}>Abri por engano — cancelar este trecho</button></p>
      </div>
    </section>}

    {!aberto && dia.estado !== "fechado" && <section className="rd-card">
      {fechadoAtual && <>
        <h2>Você está em {rotuloDestino(mem, fechadoAtual.destino)}</h2>
        <Marco rotulo="Chegada" marco={fechadoAtual.chegada} onHora={(m) => mudarTrecho(fechadoAtual.id, { chegada: m })} />
        {pendencias.length > 0 && <div className="rd-pend"><strong>Pendente da última visita:</strong>
          {pendencias.map((p, i) => <p key={i}>⚠ {p.texto} <em>(desde {dataBR(p.desde)})</em>
            <button className="rd-link" onClick={() => mudarTrecho(fechadoAtual.id, { atividades: [...(fechadoAtual.atividades || []), { texto: p.texto, status: "finalizado", desde: p.desde }] })}>dar baixa</button></p>)}
        </div>}
        <h3>Atividades e tratativas desta visita</h3>
        {(fechadoAtual.atividades || []).map((a, i) => <div className="rd-atv" key={i}>
          <span>{a.texto}</span>
          <select aria-label={"Situação " + (i + 1)} value={a.status || ""} onChange={(e) => mudarTrecho(fechadoAtual.id, { atividades: fechadoAtual.atividades.map((x, j) => (j === i ? { ...x, status: e.target.value || null } : x)) })}>
            <option value="">— sem marca —</option><option value="aberto">Em aberto (lembrar na próxima visita)</option><option value="finalizado">Finalizado</option>
          </select>
          <button onClick={() => mudarTrecho(fechadoAtual.id, { atividades: fechadoAtual.atividades.filter((_, j) => j !== i) })}>×</button>
        </div>)}
        <div className="rd-linha">
          <input aria-label="Nova atividade" placeholder="O que foi tratado…" value={atividadeNova} onChange={(e) => setAtividadeNova(e.target.value)} />
          <button disabled={!atividadeNova.trim()} onClick={() => { mudarTrecho(fechadoAtual.id, { atividades: [...(fechadoAtual.atividades || []), { texto: atividadeNova.trim(), status: null }] }); setAtividadeNova(""); }}>+ Registrar</button>
        </div>
        <label>Observações da visita<textarea value={fechadoAtual.obs || ""} onChange={(e) => mudarTrecho(fechadoAtual.id, { obs: e.target.value })} /></label>
        <button className="rd-link" disabled={busy} onClick={() => run(async () => { await salvar(dia); setNotice("Visita salva."); })}>Salvar visita</button>
      </>}
      {!abrindo && <button className="rd-principal" disabled={busy} onClick={iniciarAbertura}>{dia.trechos.length ? "Abrir próximo trecho →" : "Sair de casa — abrir o dia →"}</button>}
      {abrindo && <div className="rd-abrir">
        <h3>Novo trecho · saindo de {rotuloDestino(mem, abrindo.origem)}</h3>
        <div className="rd-dest">
          {destinos.filter((d) => d.codigo !== abrindo.origem).map((d) => <button key={d.codigo} aria-pressed={abrindo.destino === d.codigo && abrindo.novoCodigo == null} onClick={() => setAbrindo({ ...abrindo, destino: d.codigo, novoCodigo: null })}><strong>{d.rotulo}</strong><span>{d.sub}</span></button>)}
          <button aria-pressed={abrindo.novoCodigo != null} onClick={() => setAbrindo({ ...abrindo, destino: "", novoCodigo: "" })}><strong>Novo…</strong><span>Projeto fora da lista</span></button>
        </div>
        {abrindo.novoCodigo != null && <label>Número do projeto<span className="rd-prefixo">MK</span><input aria-label="Número do projeto novo" autoFocus value={abrindo.novoCodigo} onChange={(e) => setAbrindo({ ...abrindo, novoCodigo: e.target.value })} placeholder="077" /></label>}
        <label>Km inicial (painel)<input inputMode="decimal" value={abrindo.kmInicial} onChange={(e) => setAbrindo({ ...abrindo, kmInicial: e.target.value })} /></label>
        {projecao != null && <p className="rd-dica">Já conheço esse caminho: projeção de chegada <strong>{kmFmt(projecao)}</strong>, pedágios da última ida pré-preenchidos (edite se houve reajuste).</p>}
        <div className="rd-acoes"><button onClick={() => setAbrindo(null)}>Cancelar</button>
        <button className="rd-principal" disabled={busy} onClick={() => run(abrirTrecho)}>Abrir trecho (crava hora e local)</button></div>
      </div>}
      {!abrindo && dia.trechos.length > 0 && estou === "MK_HOME" && <button className="rd-fechar" disabled={busy} onClick={() => run(fecharDia)}>Fechar o dia e gerar o RD</button>}
      {!abrindo && dia.trechos.length > 0 && estou !== "MK_HOME" && <p className="rd-dica">O dia segue em aberto até você voltar para MK Home e fechar.</p>}
    </section>}

    {dia.estado === "fechado" && <section className="rd-card"><h2>Dia fechado</h2>
      <button className="rd-principal" onClick={() => { try { imprimirRd(dia, mem, auth?.currentUser?.email || ""); } catch (e) { setError(e.message); } }}>Gerar RD (PDF)</button>
      <button className="rd-link" disabled={busy} onClick={() => run(async () => { const novoDia = { ...dia, estado: "aberto" }; setDia(novoDia); await salvar(novoDia); setNotice("Dia reaberto."); })}>Reabrir o dia</button>
    </section>}

    {dia.trechos.length > 0 && <section className="rd-card"><h2>Trechos de hoje · {kmFmt(tot.km)} · pedágios {brl(tot.pedagios)}</h2>
      {dia.trechos.map((t, i) => <p className="rd-resumo" key={t.id}>
        <strong>{rotuloDestino(mem, t.origem)} → {rotuloDestino(mem, t.destino)}</strong> · saída {horaDe(t.abertura)} · {t.chegada ? `chegada ${horaDe(t.chegada)} · ${kmFmt(kmDoTrecho(t))}` : "em deslocamento"}{perm[i] != null ? ` · permanência ${minutosFmt(perm[i])}` : ""}
      </p>)}
    </section>}

    <section className="rd-card">
      <button className="rd-link" onClick={() => setConfig(!config)}>Configurar ▾</button>
      {config && <><div className="rd-linha">
        <label>Valor do km (R$)<input inputMode="decimal" value={mem?.config?.valorKm ?? ""} onChange={(e) => setMem({ ...mem, config: { ...(mem?.config || {}), valorKm: e.target.value } })} /></label>
        <label>Diária (R$)<input inputMode="decimal" value={mem?.config?.valorDiaria ?? ""} onChange={(e) => setMem({ ...mem, config: { ...(mem?.config || {}), valorDiaria: e.target.value } })} /></label>
        <label>Dia do fechamento<input inputMode="numeric" value={mem?.config?.fechamentoDia ?? 18} onChange={(e) => setMem({ ...mem, config: { ...(mem?.config || {}), fechamentoDia: e.target.value } })} /></label>
        <button disabled={busy} onClick={() => run(async () => { await salvar(dia, mem); setNotice("Configuração salva."); })}>Salvar</button>
      </div>
      <button className="rd-link" disabled={busy} onClick={() => run(() => gerarConsolidado(data))}>Gerar consolidado do período atual (PDF)</button></>}
      {dias.length > 0 && <><h3>Dias anteriores</h3><div className="rd-dias">{dias.slice(0, 14).map((d) => <button key={d.data} aria-pressed={d.data === data} onClick={() => setData(d.data)}>{dataBR(d.data)} · {d.trechos} trecho(s)</button>)}{data !== hojeISO() && <button onClick={() => setData(hojeISO())}>Voltar para hoje</button>}</div></>}
    </section>
  </main>;
}
