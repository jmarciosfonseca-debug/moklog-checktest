import React, { useState } from "react";

export const novoIdUnidade = () => "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
// Nomes em sequência: prefixo "CF" + 150 → CF001…CF150 (zeros à esquerda conforme o maior número).
export function gerarNomes(prefixo, n, inicio = 1) {
  const largura = Math.max(2, String(inicio + n - 1).length);
  return Array.from({ length: n }, (_, i) => (prefixo || "") + String(inicio + i).padStart(largura, "0"));
}
// Próximo nome a partir do último da lista (CF09 → CF10; sem número no fim: "Nome 05").
export function proximoNome(lista) {
  const ult = lista[lista.length - 1]?.nome || "";
  const m = ult.match(/^(.*?)(\d+)$/);
  if (m) return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, "0");
  return (ult || "Unidade") + " " + String(lista.length + 1).padStart(2, "0");
}
const prefixoPadrao = (nome) => (String(nome).split(/[\s(/]/)[0] || "Unidade") + " ";
const TOTAL_MAX = 1000;
const qtdDe = (a) => (a ? (a.unidades?.length || Number(a.total) || 0) : 0);
const existe = (a) => !!a && !(a.total === 0 || a.total === "0") ;

// Uma linha da lista: caixa "existe" + quantidade. Nomear unidades é opcional e fica recolhido.
function Linha({ nome, ativo, disabled, onMarcar, onQtd, onUnidades, extra }) {
  const [aberto, setAberto] = useState(false);
  const [prefixo, setPrefixo] = useState(prefixoPadrao(nome));
  const marcado = existe(ativo);
  const lista = ativo?.unidades || [];
  const n = qtdDe(ativo);
  const gerar = () => {
    if (!(n > 0 && n <= TOTAL_MAX)) return;
    if (lista.length && !window.confirm("Substituir a lista atual de nomes?")) return;
    onUnidades(gerarNomes(prefixo, n).map((nm) => ({ id: novoIdUnidade(), nome: nm })));
  };
  return <div className={"single-item" + (marcado ? " on" : "")}>
    <div className="single-item-linha">
      <label className="single-item-nome">
        <input type="checkbox" aria-label={"Tem " + nome} checked={marcado} disabled={disabled} onChange={(e) => onMarcar(e.target.checked)} />
        <span>{nome}</span>
      </label>
      {marcado && <input className="single-qtd" aria-label={"Quantidade " + nome} disabled={disabled} inputMode="numeric" type="number" min="1" max={TOTAL_MAX} step="1"
        value={lista.length ? lista.length : (ativo.total ?? "")} onChange={(e) => onQtd(e.target.value)} onBlur={(e) => { if (!(Number(e.target.value) >= 1)) onQtd("1"); }} />}
    </div>
    {extra}
    {marcado && <button type="button" className="single-link" onClick={() => setAberto(!aberto)}>{lista.length ? "Nomes das unidades (" + lista.length + ") ▾" : "Dar nome às unidades (opcional) ▾"}</button>}
    {marcado && aberto && <div className="single-unidades">
      {!lista.length && <><p className="single-hint">Só se quiser identificar cada unidade (ex.: Câmeras 01, Câmeras 02…). Sem isso, o preenchimento é só por quantidade.</p>
        <div className="single-row"><label>Início do nome<input disabled={disabled} value={prefixo} onChange={(e) => setPrefixo(e.target.value)} /></label><button type="button" disabled={disabled || !(n > 0 && n <= TOTAL_MAX)} onClick={gerar}>Gerar {n || ""} nome(s)</button></div></>}
      {lista.map((u, i) => <div className="single-unidade" key={u.id}>
        <input aria-label={"Nome da unidade " + (i + 1)} disabled={disabled} value={u.nome} maxLength={80} onChange={(e) => onUnidades(lista.map((x) => (x.id === u.id ? { ...x, nome: e.target.value } : x)))} />
      </div>)}
      {lista.length > 0 && <div className="single-row">
        <button type="button" disabled={disabled} onClick={() => { if (window.confirm("Apagar os nomes e voltar a contar só por quantidade?")) onUnidades(null, lista.length); }}>Apagar os nomes</button>
      </div>}
    </div>}
  </div>;
}

// Passo 1 — Lista de itens: marque o que o cliente TEM e informe a quantidade. O que não for marcado não existe.
export default function CenarioAtivos({ catalog, assets, setAssets, disabled }) {
  const ativosCat = catalog.familias.filter((f) => f.ativo);
  const idsCat = new Set(ativosCat.map((f) => f.id));
  const grupos = [...new Set(ativosCat.map((f) => f.grupo))];
  const doItem = (id) => assets.find((x) => x.id === id);
  const patch = (f, mudar) => setAssets((xs) => {
    const old = xs.find((x) => x.id === f.id);
    const base = old || { id: f.id, familiaId: f.id, custom: false, nome: f.nome, grupo: f.grupo, total: 1 };
    const next = mudar(base);
    return old ? xs.map((x) => (x.id === f.id ? next : x)) : [...xs, next];
  });
  const marcar = (f, on) => (on
    ? setAssets((xs) => (xs.some((x) => x.id === f.id)
      ? xs.map((x) => (x.id === f.id ? { ...x, total: x.unidades?.length || (Number(x.total) >= 1 ? x.total : 1) } : x))
      : [...xs, { id: f.id, familiaId: f.id, custom: false, nome: f.nome, grupo: f.grupo, total: 1 }]))
    : setAssets((xs) => xs.filter((x) => x.id !== f.id)));
  const setQtd = (v, aplicar) => aplicar((a) => {
    const n = Math.min(TOTAL_MAX, Math.floor(Number(v)));
    if (a.unidades?.length) {
      if (!(n >= 1) || n === a.unidades.length) return a;
      let l = a.unidades.slice(0, n);
      while (l.length < n) l.push({ id: novoIdUnidade(), nome: proximoNome(l) });
      return { ...a, unidades: l, total: l.length };
    }
    return { ...a, total: v === "" ? "" : (n >= 0 ? n : "") };
  });
  const setUnidades = (lista, totalAnterior, aplicar) => aplicar((a) => {
    const { unidades, ...resto } = a;
    return lista && lista.length ? { ...resto, unidades: lista, total: lista.length } : { ...resto, total: totalAnterior ?? a.total };
  });
  const upd = (id, mudar) => setAssets((xs) => xs.map((x) => (x.id === id ? mudar(x) : x)));
  const personalizados = assets.filter((a) => a.custom || !idsCat.has(a.id));
  const marcados = assets.filter((a) => existe(a) && qtdDe(a) >= 0);
  const somaGeral = marcados.reduce((s, a) => s + qtdDe(a), 0);
  return <>
    <p className="single-hint"><strong>Marque o que o cliente tem</strong> e informe a quantidade. O que ficar sem marca não existe neste cliente. A situação de cada item (operante, parcial, inoperante) é preenchida no passo 2.</p>
    <p className="single-total" role="status"><strong>{marcados.length}</strong> item(ns) marcado(s) · <strong>{somaGeral}</strong> ativo(s) no total</p>
    {marcados.length === 0 && <p className="single-vazio">Nenhum item marcado ainda. Marque abaixo o que existe no cliente.</p>}
    {grupos.map((grupo) => {
      const itens = ativosCat.filter((f) => f.grupo === grupo);
      const n = itens.filter((f) => existe(doItem(f.id))).length;
      return <details key={grupo} open className="single-grupo"><summary><strong>{grupo}</strong> <span className="single-hint">· {n} de {itens.length} marcado(s)</span></summary>
        {itens.map((f) => <Linha key={f.id} nome={f.nome} ativo={existe(doItem(f.id)) ? doItem(f.id) : null} disabled={disabled}
          onMarcar={(on) => marcar(f, on)} onQtd={(v) => setQtd(v, (m) => patch(f, m))} onUnidades={(l, t) => setUnidades(l, t, (m) => patch(f, m))} />)}
      </details>;
    })}
    <details open={personalizados.length > 0} className="single-grupo"><summary><strong>Outros itens do cliente</strong> <span className="single-hint">· não estão na lista acima</span></summary>
      {personalizados.map((a) => <Linha key={a.id} nome={a.nome} ativo={{ ...a, total: a.total === 0 ? 1 : a.total }} disabled={disabled}
        onMarcar={(on) => { if (!on) setAssets((xs) => xs.filter((x) => x.id !== a.id)); }}
        onQtd={(v) => setQtd(v, (m) => upd(a.id, m))} onUnidades={(l, t) => setUnidades(l, t, (m) => upd(a.id, m))}
        extra={<label className="single-nome-livre">Nome do item<input disabled={disabled} value={a.nome} onChange={(e) => upd(a.id, (x) => ({ ...x, nome: e.target.value }))} /></label>} />)}
      <button type="button" disabled={disabled} onClick={() => setAssets((xs) => [...xs, { id: "x_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), familiaId: null, custom: true, nome: "Novo item", grupo: "Personalizado", total: 1 }])}>+ Acrescentar item que não está na lista</button>
    </details>
  </>;
}
