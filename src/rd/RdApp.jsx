// MK RD — dia em trechos encadeados, numa página só e sem travas:
// • o card do trecho traz km inicial e km final LADO A LADO (o final já vem cravado pela projeção da rota — é só conferir);
// • a visita (chavinhas de administração/equipe, tratativas, lembretes) fica no MESMO card, disponível desde a saída;
// • fechou o trecho → a escolha do próximo destino já aparece embaixo: um toque no destino abre o trecho;
// • Configurar (valores de km, fechamento, dias anteriores) fica atrás do ⚙, fora do caminho do dia.
import { useEffect, useMemo, useRef, useState } from "react";
import { criarRdStore } from "./rdStore";
import { criarMarco, linkMapa } from "./rdGeo";
import { imprimirRd } from "./rdPdf";
import { imprimirConsolidado } from "./rdConsolidado";
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

// Chavinhas da visita: um toque liga, a observação abre do lado. Guardadas como atividades com tag.
const TRATATIVAS_PADRAO = [["adm", "Contato com a administração"], ["equipe", "Contato com a equipe"]];
const obsDaTag = (t, tag, rotulo) => { const a = (t.atividades || []).find((x) => x.tag === tag); if (!a) return null; return a.texto.startsWith(rotulo + " — ") ? a.texto.slice(rotulo.length + 3) : ""; };

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
  const [atividadeNova, setAtividadeNova] = useState("");
  const [lembreteNovo, setLembreteNovo] = useState("");
  const [config, setConfig] = useState(false);
  const [dias, setDias] = useState([]);
  const [pronto, setPronto] = useState(false);
  const [expandido, setExpandido] = useState(null); // trecho antigo aberto na linha do dia
  const [arquivo, setArquivo] = useState(false);    // pasta "RDs arquivados"
  const cfgTimer = useRef(null);                    // a configuração salva sozinha (debounce)
  const tema = "rd" + (dark ? "" : " rd-claro");    // acompanha o tema do app

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

  // IMPORTANTE: os blocos abaixo são FUNÇÕES de render (chamadas direto no JSX), nunca componentes
  // declarados dentro do RdApp. Componente interno ganha identidade nova a cada render: o React
  // desmonta e remonta os inputs a cada letra digitada e o teclado do celular cai (bug de campo 15/10).
  const renderComprovante = (item, onFoto) => item.fotoId
    ? <button className="rd-comprovante ok" title="Comprovante anexado — toque para remover" onClick={() => { if (window.confirm("Remover o comprovante deste lançamento?")) onFoto(null); }}>✓ 📎</button>
    : <label className="rd-comprovante" title="Anexar comprovante (foto)">📎<input type="file" accept="image/*" capture="environment" aria-label="Anexar comprovante" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; run(async () => { const b64 = await comprimirFotoFn(f); const fotoId = novoIdFoto(); await store.salvarFoto(fotoId, b64); onFoto(fotoId); setNotice("Comprovante anexado."); }); }} /></label>;

  // Um toque no destino abre o trecho na hora (km herdado, veículo lembrado, GPS cravado).
  async function abrirPara(destino) {
    const kmInicial = kmPartida != null && kmPartida !== "" ? kmPartida : (herdarKmInicial(dia) ?? "");
    const marco = await criarMarcoFn();
    const t = {
      id: novoIdTrecho(), origem: estou, destino, veiculo: veiculo || ultimoFechado(dia)?.veiculo || "carro",
      kmInicial: kmInicial === "" ? null : kmInicial, kmFinal: null,
      abertura: marco, chegada: null,
      pedagios: pedagiosSugeridos(mem, estou, destino), gastos: [], atividades: [], obs: "",
    };
    const novoDia = { ...dia, trechos: [...dia.trechos, t] };
    setDia(novoDia); setKmPartida(null); setNovoCodigo(null); setKmChegada(null);
    await salvar(novoDia);
    setNotice(`Trecho aberto para ${rotuloDestino(mem, destino)} às ${horaDe(marco)}${marco.gps ? "" : " (sem localização)"}.`);
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
  async function gerarConsolidado(ate) {
    const { de } = periodoAtual(ate);
    const r = await store.periodo(de, ate);
    imprimirConsolidado(r.dias || [], r.memoria || mem, auth?.currentUser?.email || "");
  }
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
    // Primeiro GRAVA; só então a tela diz "arquivado". Se o servidor recusar, o dia continua
    // aberto na tela (nunca "salvo e arquivado" com erro em cima).
    await salvar(novoDia, novaMem);
    try { const d = await store.dias(); setDias(d.dias || []); } catch { /* lista atualiza na próxima */ }
    setArquivo(true); // já leva para a pastinha, com o aviso
    setNotice(`✓ RD de ${dataBR(data)} salvo e arquivado. Lembretes em aberto reaparecem na próxima visita a cada projeto.`);
    await imprimirComFotos(novoDia, novaMem);
    if (ultimoDoCiclo) { try { await gerarConsolidado(data); } catch (e) { setError("RD do dia gerado; o consolidado falhou: " + e.message); } }
  }

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

  // Visita no MESMO card: chavinhas, lembretes pendentes, tratativas livres, lembrete novo e observações.
  const renderVisita = (t) => {
    const pend = pendenciasDoDestino(mem, t.destino).filter((p) => !(t.atividades || []).some((a) => a.texto === p.texto));
    const marcarToggle = (tag, rotulo, ligada) => {
      const sem = (t.atividades || []).filter((a) => a.tag !== tag);
      mudarTrecho(t.id, { atividades: ligada ? [...sem, { tag, texto: rotulo, status: null }] : sem });
    };
    const mudarObsToggle = (tag, rotulo, obs) => {
      mudarTrecho(t.id, { atividades: (t.atividades || []).map((a) => (a.tag === tag ? { ...a, texto: obs ? `${rotulo} — ${obs}` : rotulo } : a)) });
    };
    return <>
      <h3>Visita · {rotuloDestino(mem, t.destino)}</h3>
      {pend.length > 0 && <div className="rd-pend"><strong>Pendente da última visita:</strong>
        {pend.map((p, i) => <p key={i}>⚠ {p.texto} <em>(desde {dataBR(p.desde)})</em>
          <button className="rd-link" onClick={() => { mudarTrecho(t.id, { atividades: [...(t.atividades || []), { texto: p.texto, status: "finalizado", desde: p.desde }] }); setNotice("Concluído: sai da lista de pendências quando o dia for arquivado."); }}>✓ Concluir</button></p>)}
        <p className="rd-micro">O que não for concluído continua pendente e reaparece na próxima visita.</p>
      </div>}
      {TRATATIVAS_PADRAO.map(([tag, rotulo]) => {
        const obs = obsDaTag(t, tag, rotulo);
        return <div className="rd-toggle" key={tag}>
          <label className="rd-chave"><input type="checkbox" role="switch" aria-label={rotulo} checked={obs != null} onChange={(e) => marcarToggle(tag, rotulo, e.target.checked)} /><i /><span>{rotulo}</span></label>
          {obs != null && <input className="rd-toggle-obs" aria-label={"Observação " + rotulo.toLowerCase()} placeholder="Observação (opcional)…" value={obs} onChange={(e) => mudarObsToggle(tag, rotulo, e.target.value)} />}
        </div>;
      })}
      {(t.atividades || []).filter((a) => !a.tag).map((a, i) => <div className={"rd-atv" + (a.status === "aberto" ? " rd-atv-aberta" : "")} key={i}>
        <span>{a.status === "aberto" ? "⚠ " : a.status === "finalizado" ? "✓ " : ""}{a.texto}</span>
        <select aria-label={"Situação " + (i + 1)} value={a.status || ""} onChange={(e) => mudarTrecho(t.id, { atividades: t.atividades.map((x) => (x === a ? { ...x, status: e.target.value || null } : x)) })}>
          <option value="">— sem marca —</option><option value="aberto">Em aberto (lembrete)</option><option value="finalizado">Finalizado</option>
        </select>
        <button onClick={() => mudarTrecho(t.id, { atividades: t.atividades.filter((x) => x !== a) })}>×</button>
      </div>)}
      {(t.atividades || []).some((a) => !a.tag && a.status === "aberto") && <p className="rd-micro">⚠ O que está "Em aberto" vira lembrete: reaparece na sua próxima visita a {rotuloDestino(mem, t.destino)}.</p>}
      <div className="rd-linha">
        <input aria-label="Nova atividade" placeholder="O que mais foi tratado…" value={atividadeNova} onChange={(e) => setAtividadeNova(e.target.value)} />
        <button disabled={!atividadeNova.trim()} onClick={() => { mudarTrecho(t.id, { atividades: [...(t.atividades || []), { texto: atividadeNova.trim(), status: null }] }); setAtividadeNova(""); }}>+ Registrar</button>
      </div>
      <div className="rd-linha rd-lembrete">
        <input aria-label="Lembrete para a próxima visita" placeholder="Lembrete para a PRÓXIMA visita…" value={lembreteNovo} onChange={(e) => setLembreteNovo(e.target.value)} />
        <button disabled={!lembreteNovo.trim()} onClick={() => { mudarTrecho(t.id, { atividades: [...(t.atividades || []), { texto: lembreteNovo.trim(), status: "aberto" }] }); setLembreteNovo(""); setNotice("Lembrete guardado: aparece quando você voltar a este projeto."); }}>+ Lembrete</button>
      </div>
      <label>Observações da visita<textarea value={t.obs || ""} onChange={(e) => mudarTrecho(t.id, { obs: e.target.value })} /></label>
    </>;
  };

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

  if (!pronto) return <main className={tema}><header><button onClick={onBack}>← Início</button><h1>MK RD</h1></header><p role="status">Abrindo o dia…</p></main>;

  // ── Pasta "RDs arquivados": a listinha dos dias, para abrir, conferir e ajustar ─
  if (arquivo) return <main className={tema}>
    <header><button onClick={() => setArquivo(false)}>← Voltar ao dia</button><h1>MK RD · Arquivados</h1>
      <p>Toque num dia para abrir o RD dele — conferir, gerar o PDF e, se precisar, reabrir e ajustar.</p></header>
    {error && <div role="alert" className="rd-erro">{error}</div>}
    {notice && <p role="status" className="rd-aviso">{notice}</p>}
    <section className="rd-card">
      {data !== hojeISO() && <button className="rd-link" onClick={() => { setData(hojeISO()); setArquivo(false); }}>↩ Voltar para o dia de hoje</button>}
      {dias.length === 0 && <p className="rd-micro">Nenhum RD arquivado ainda. Feche um dia com "Salvar e arquivar" e ele aparece aqui.</p>}
      {dias.map((d) => <div key={d.data} className="rd-arq-linha">
        <button className="rd-arq-item" onClick={() => { setData(d.data); setArquivo(false); }}>
          <div><strong>{dataBR(d.data)}</strong><span>{d.trechos} trecho{d.trechos === 1 ? "" : "s"}</span></div>
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
      <button className="rd-link" disabled={busy} onClick={() => run(() => gerarConsolidado(data))}>Gerar consolidado do período atual (PDF)</button>
    </section>
  </main>;

  // ── Tela do dia: os trechos em LINHA (como o RD do 2CONTROL) ─────────────────
  // Um card por trecho, em ordem cronológica. Os antigos ficam recolhidos num resumo de uma
  // linha e abrem num toque para corrigir hora, km, gastos e visita; o trecho atual (em
  // deslocamento ou a visita de agora) fica sempre expandido no fim da linha.
  return <main className={tema}>
    <header><button onClick={onBack}>← Início</button>
      <h1>MK RD · Relatório Diário <button className="rd-engrenagem" aria-label="Configurar" onClick={() => setConfig(true)}>⚙</button><button className="rd-arquivo-btn" aria-label="RDs arquivados" onClick={() => { setArquivo(true); store.dias().then((d) => setDias(d.dias || [])).catch(() => {}); }}>🗂</button></h1>
      <p>{dataBR(data)} · {dia.estado === "fechado" ? "RD arquivado" : aberto ? `em deslocamento para ${rotuloDestino(mem, aberto.destino)}` : `você está em ${rotuloDestino(mem, estou)}`}</p></header>
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

      if (!aberto && dia.estado !== "fechado" && fechadoAtual && t.id === fechadoAtual.id) return <section className="rd-card rd-atual" key={t.id}>
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
        <button className="rd-trecho-head" aria-expanded={ab} onClick={() => setExpandido(ab ? null : t.id)}>
          <div><strong>{i + 1} · {rotuloDestino(mem, t.origem)} → {rotuloDestino(mem, t.destino)}{t.veiculo === "moto" ? " 🏍" : ""}</strong>
            <span>{horaDe(t.abertura)}{t.chegada ? ` – ${horaDe(t.chegada)}` : ""} · {kmFmt(kmDoTrecho(t))}{perm[i] != null ? ` · ficou ${minutosFmt(perm[i])}` : ""}</span></div>
          <em>{ab ? "⌄" : "›"}</em>
        </button>
        {ab && <>
          <Marco rotulo="Saída" marco={t.abertura} onHora={(m) => mudarTrecho(t.id, { abertura: m })} />
          <Marco rotulo="Chegada" marco={t.chegada} onHora={(m) => mudarTrecho(t.id, { chegada: m })} />
          <div className="rd-kmpar">
            <label>Km inicial (painel)<input inputMode="decimal" value={t.kmInicial ?? ""} onChange={(e) => mudarTrecho(t.id, { kmInicial: e.target.value })} /></label>
            <label>Km final (painel)<input inputMode="decimal" value={t.kmFinal ?? ""} onChange={(e) => mudarTrecho(t.id, { kmFinal: e.target.value })} /></label>
          </div>
          {renderGastos(t)}
          {t.destino !== "MK_HOME" && renderVisita(t)}
          <button className="rd-link" disabled={busy} onClick={() => run(async () => { await salvar(dia); setExpandido(null); setNotice("Trecho atualizado."); })}>Salvar alterações</button>
        </>}
      </section>;
    })}

    {dia.trechos.length === 0 && dia.estado !== "fechado" && <section className="rd-card rd-atual">
      {renderProximoDestino("Sair de casa — para onde?")}
    </section>}

    {dia.estado === "fechado" && <section className="rd-card rd-arquivado"><h2>✓ RD de {dataBR(data)} salvo e arquivado</h2>
      <p className="rd-micro">O dia está guardado na pasta de RDs arquivados. Os trechos acima são só para conferência; para mexer, reabra o dia.</p>
      <button className="rd-principal" disabled={busy} onClick={() => run(() => imprimirComFotos(dia, mem))}>Gerar RD (PDF)</button>
      <button className="rd-link" onClick={() => { setArquivo(true); store.dias().then((d) => setDias(d.dias || [])).catch(() => {}); }}>🗂 Ver RDs arquivados</button>
      <button className="rd-link" disabled={busy} onClick={() => run(async () => { const novoDia = { ...dia, estado: "aberto" }; setDia(novoDia); await salvar(novoDia); setNotice("Dia reaberto para ajuste. Arquive de novo quando terminar."); })}>Reabrir para ajustar</button>
    </section>}
  </main>;
}
