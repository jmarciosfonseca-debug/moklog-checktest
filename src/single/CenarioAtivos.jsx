import React, { useState } from "react";

export const novoIdUnidade = () => "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
// Nomes em sequência: prefixo "CF" + 150 → CF001…CF150 (zeros à esquerda conforme o maior número).
export function gerarNomes(prefixo, n, inicio = 1) {
  const largura = Math.max(2, String(inicio + n - 1).length);
  return Array.from({ length: n }, (_, i) => (prefixo || "") + String(inicio + i).padStart(largura, "0"));
}

function Linha({ nome, total, unidades, disabled, onTotal, onUnidades, extra }) {
  const [aberto, setAberto] = useState(false);
  const [prefixo, setPrefixo] = useState("");
  const lista = unidades || [];
  const n = Number(total) || 0;
  const gerar = () => {
    if (!(n > 0 && n <= 1000)) return;
    if (lista.length && !window.confirm("Substituir a lista atual de nomes?")) return;
    onUnidades(gerarNomes(prefixo.trim(), n).map((nm) => ({ id: novoIdUnidade(), nome: nm })));
  };
  return <div className="single-ativo">
    {extra}
    <label>{nome}
      {lista.length
        ? <input readOnly value={lista.length + " unidade(s) — conforme a lista"} aria-label={"Quantidade " + nome} />
        : <input disabled={disabled} inputMode="numeric" type="number" min="0" step="1" value={total ?? ""} aria-label={"Quantidade " + nome} onChange={(e) => onTotal(e.target.value)} />}
    </label>
    {(n > 0 || lista.length > 0) && <button type="button" className="single-link" onClick={() => setAberto(!aberto)}>{lista.length ? "Lista nominal: " + lista.length + " ▾" : "Nomear unidades ▾"}</button>}
    {aberto && <div className="single-unidades">
      {!lista.length && <><p className="single-hint">Opcional. Dê um nome a cada unidade (ex.: CF001, CF002…). Com a lista, o status de cada uma é marcado na vistoria.</p>
        <div className="single-row"><label>Prefixo<input disabled={disabled} value={prefixo} placeholder="ex.: CF" onChange={(e) => setPrefixo(e.target.value)} /></label><button type="button" disabled={disabled || !(n > 0 && n <= 1000)} onClick={gerar}>Gerar {n || ""} nome(s)</button></div></>}
      {lista.map((u, i) => <div className="single-unidade" key={u.id}>
        <input aria-label={"Nome da unidade " + (i + 1)} disabled={disabled} value={u.nome} maxLength={80} onChange={(e) => onUnidades(lista.map((x) => (x.id === u.id ? { ...x, nome: e.target.value } : x)))} />
        <button type="button" disabled={disabled} aria-label={"Remover " + u.nome} onClick={() => onUnidades(lista.filter((x) => x.id !== u.id))}>✕</button>
      </div>)}
      {lista.length > 0 && <div className="single-row">
        <button type="button" disabled={disabled || lista.length >= 1000} onClick={() => onUnidades([...lista, { id: novoIdUnidade(), nome: (prefixo.trim() || "Unidade ") + String(lista.length + 1).padStart(2, "0") }])}>+ unidade</button>
        <button type="button" disabled={disabled} onClick={() => { if (window.confirm("Apagar a lista de nomes e voltar ao contador simples?")) onUnidades(null, lista.length); }}>Voltar ao contador</button>
      </div>}
    </div>}
  </div>;
}

// Cenário do cliente: item a item, com quantidade e (opcional) lista nominal de unidades.
export default function CenarioAtivos({ catalog, assets, setAssets, disabled }) {
  const ativosCat = catalog.familias.filter((f) => f.ativo);
  const grupos = [...new Set(ativosCat.map((f) => f.grupo))];
  const doItem = (id) => assets.find((x) => x.id === id);
  const totalDe = (a) => (a ? (a.unidades?.length || Number(a.total) || 0) : 0);
  const patch = (f, mudar) => setAssets((xs) => {
    const old = xs.find((x) => x.id === f.id);
    const base = old || { id: f.id, familiaId: f.id, custom: false, nome: f.nome, grupo: f.grupo, total: "" };
    const next = mudar(base);
    return old ? xs.map((x) => (x.id === f.id ? next : x)) : [...xs, next];
  });
  const setTotal = (f, v) => patch(f, (a) => ({ ...a, total: v }));
  const setUnidades = (f, lista, totalAnterior) => patch(f, (a) => {
    const { unidades, ...resto } = a;
    return lista && lista.length ? { ...resto, unidades: lista, total: lista.length } : { ...resto, total: totalAnterior ?? lista?.length ?? a.total };
  });
  const personalizados = assets.filter((a) => a.custom || !ativosCat.some((f) => f.id === a.id));
  const somaGeral = assets.reduce((s, a) => s + totalDe(a), 0);
  const itensComQtd = assets.filter((a) => totalDe(a) > 0).length;
  const upd = (id, mudar) => setAssets((xs) => xs.map((x) => (x.id === id ? mudar(x) : x)));
  return <>
    <p className="single-hint">Informe a quantidade de cada item que o cliente tem. Cada item é separado (cancela, dilacerador, portão…). Deixe em branco o que não existe. Se quiser, nomeie cada unidade (ex.: CF001).</p>
    <p className="single-total"><strong>{somaGeral}</strong> ativos em <strong>{itensComQtd}</strong> item(ns)</p>
    {grupos.map((grupo) => {
      const itens = ativosCat.filter((f) => f.grupo === grupo);
      const soma = itens.reduce((s, f) => s + totalDe(doItem(f.id)), 0);
      return <details key={grupo} open className="single-grupo"><summary><strong>{grupo}</strong> <span className="single-hint">· {soma} ativo(s)</span></summary>
        {itens.map((f) => { const a = doItem(f.id); return <Linha key={f.id} nome={f.nome} total={a?.total} unidades={a?.unidades} disabled={disabled} onTotal={(v) => setTotal(f, v)} onUnidades={(l, t) => setUnidades(f, l, t)} />; })}
      </details>;
    })}
    {personalizados.length > 0 && <details open className="single-grupo"><summary><strong>Personalizados e itens do formato antigo</strong></summary>
      {personalizados.map((a) => <Linha key={a.id} nome={a.nome} total={a.total} unidades={a.unidades} disabled={disabled}
        onTotal={(v) => upd(a.id, (x) => ({ ...x, total: v }))}
        onUnidades={(l, t) => upd(a.id, (x) => { const { unidades, ...r } = x; return l && l.length ? { ...r, unidades: l, total: l.length } : { ...r, total: t ?? x.total }; })}
        extra={<div className="single-row"><label>Nome<input disabled={disabled} value={a.nome} onChange={(e) => upd(a.id, (x) => ({ ...x, nome: e.target.value }))} /></label><label>Grupo<input disabled={disabled} value={a.grupo} onChange={(e) => upd(a.id, (x) => ({ ...x, grupo: e.target.value }))} /></label><button type="button" disabled={disabled} onClick={() => setAssets((xs) => xs.filter((x) => x.id !== a.id))}>Remover</button></div>} />)}
    </details>}
    <button type="button" disabled={disabled} onClick={() => setAssets((xs) => [...xs, { id: "x_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), familiaId: null, custom: true, nome: "Novo item", grupo: "Personalizado", total: 0 }])}>+ Item personalizado</button>
  </>;
}
