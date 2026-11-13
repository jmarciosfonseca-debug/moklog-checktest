// Painel do projeto — tela cheia (Fase 2, 12/11/2026). Nota 0–100 explicada item por item, no visual OLAM (escopado em .olam).
// Só mostra contagens, funções e percentuais: nenhum nome de pessoa, telefone, CPF ou foto.
import { useEffect, useState } from "react";
import "@fontsource-variable/archivo";
import "@fontsource-variable/public-sans";
import "../tema/tokensOlam.css";
import { Ico } from "../Icones";
import { LOGO_MOKED_OFICIAL, LOGO_MOKED_OFICIAL_ESCURO } from "../logoOficial";
import { carregarPainel } from "./carregar";

export const classeFaixa = (f) => (f === "Bom" ? "ol-bom" : f === "Alerta" ? "ol-alerta" : f === "Crítico" ? "ol-critico" : "ol-semdado");
const num = (v) => String(Math.round(v * 10) / 10).replace(".", ",");
const quando = (iso) => { try { const d = new Date(iso); return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`; } catch { return ""; } };

function Item({ i }) {
  const [aberto, setAberto] = useState(false);
  const na = i.estado === "na", neutro = i.estado === "neutro";
  const cheio = !na && !neutro && i.pontos >= i.possivel - 0.05, zero = !na && !neutro && i.pontos <= 0.05;
  const cls = na ? "na" : neutro ? "neutro" : cheio ? "cheio" : zero ? "zero" : "";
  const pct = na || !i.possivel ? 0 : Math.max(0, Math.min(100, (i.pontos / i.possivel) * 100));
  const temDetalhe = (i.perdas || []).length > 0;
  return (
    <button type="button" className="ol-item" data-testid={`painel-item-${i.id}`} aria-expanded={temDetalhe ? aberto : undefined} onClick={() => temDetalhe && setAberto((a) => !a)} style={{ cursor: temDetalhe ? "pointer" : "default" }}>
      <div className="ol-item-topo">
        <span className="ol-item-nome">{i.nome}</span>
        <span className={`ol-pontos ${cls}`}>{na ? "—" : `${num(i.pontos)}/${num(i.possivel)}`}</span>
      </div>
      <div className="ol-barra" role="presentation"><i className={cls} style={{ width: `${pct}%` }} /></div>
      <div className="ol-frase">{i.frase}</div>
      {temDetalhe && !aberto && <span className="ol-mais">Ver o que tirou pontos ({i.perdas.length})</span>}
      {temDetalhe && aberto && (
        <div className="ol-detalhe">
          {i.perdas.slice(0, 40).map((p, k) => <div className="ol-detalhe-linha" key={k}><span>{p.texto}</span><span>{p.detalhe}</span></div>)}
          {i.perdas.length > 40 && <div className="ol-detalhe-linha"><span>… e mais {i.perdas.length - 40}</span><span /></div>}
        </div>
      )}
    </button>
  );
}

export default function PainelProjeto({ project, history, ctmk, dark = true, onBack, resultadoInicial = null, carregar = carregarPainel }) {
  const [est, setEst] = useState(resultadoInicial ? { fase: "pronto", r: resultadoInicial } : { fase: "carregando" });
  const buscar = (forcar) => { setEst((s) => ({ ...s, fase: s.r ? "atualizando" : "carregando" }));
    carregar({ pid: project.id, project, history, ctmk, forcar }).then((r) => setEst({ fase: "pronto", r })).catch(() => setEst((s) => ({ fase: s.r ? "pronto" : "erro", r: s.r, falhou: true }))); };
  useEffect(() => { if (!resultadoInicial) buscar(false);}, [project.id]);
  const r = est.r;
  return (
    <div className={`olam${dark ? "" : " olam-claro"}`} data-testid="painel-projeto">
      <div className="ol-pagina">
        <button type="button" className="ol-voltar" onClick={onBack} aria-label="Voltar ao projeto">← Voltar</button>
        <header className="ol-cab">
          <div className="ol-cab-linha">
            <div>
              <div className="ol-eyebrow">Painel do projeto · {project.id}</div>
              <h1 className="ol-titulo">{project.name || project.id}</h1>
            </div>
            <img className="ol-logo" src={dark ? LOGO_MOKED_OFICIAL_ESCURO : LOGO_MOKED_OFICIAL} alt="Moked Security Consulting" />
          </div>
          <p className="ol-sub">A nota resume como o projeto está hoje e mostra, item por item, de onde vem cada ponto.</p>
        </header>

        {est.fase === "carregando" && <div className="ol-card ol-vazio" role="status">Calculando a nota do projeto…</div>}
        {est.fase === "erro" && <div className="ol-card"><div className="ol-vazio" role="alert">Não foi possível calcular a nota agora.</div><button type="button" className="ol-botao" onClick={() => buscar(true)}>Tentar de novo</button></div>}

        {r && (
          <div className="ol-grade">
            <section className="ol-card ol-a-nota" aria-label="Nota do projeto">
              <div className="ol-nota-grade">
                <div className={`ol-nota ${classeFaixa(r.faixa)}`} data-testid="painel-nota">{r.nota === null ? "—" : r.nota}<small>/100</small></div>
                <div>
                  <span className={`ol-selo ${classeFaixa(r.faixa)}`} data-testid="painel-faixa">{r.faixa}</span>
                  <div className="ol-meta">
                    {r.demo ? "Dados de exemplo (demonstração)" : `Calculada em ${quando(r.calculadoEm)}`}<br />
                    Com {r.cobertura}% dos dados{r.redistribuido ? " · peso redistribuído entre os itens que se aplicam" : ""}
                  </div>
                </div>
              </div>
              {r.travas.length > 0 && (
                <div className="ol-aviso" data-testid="painel-travas">
                  <Ico n="cadeado" />
                  <div>{r.travaAplicada ? <><b>Faixa limitada a Alerta.</b> A soma daria Bom, mas:</> : <><b>Travas em vigor</b> (a faixa não passa de Alerta enquanto durarem):</>}
                    <ul>{r.travas.map((t) => <li key={t.id}>{t.texto}</li>)}</ul></div>
                </div>
              )}
            </section>

            <section className="ol-card ol-a-porque" aria-label="Por que esta nota">
              <div className="ol-eyebrow ol-secao">Por que esta nota</div>
              {r.itens.map((i) => <Item key={i.id} i={i} />)}
            </section>

            <section className="ol-card ol-a-acoes" aria-label="O que fazer para subir">
              <div className="ol-eyebrow ol-secao">O que fazer para subir</div>
              {r.acoes.length === 0 && <div className="ol-vazio">Nenhum ponto relevante a recuperar agora.</div>}
              {r.acoes.map((a, k) => (
                <div className="ol-acao" key={a.id}>
                  <div className="ol-acao-n">{k + 1}</div>
                  <div><div className="ol-acao-txt">{a.acao}</div><div className="ol-acao-sub">{a.nome} · até +{num(a.perdidos)} {a.perdidos === 1 ? "ponto" : "pontos"}</div></div>
                </div>
              ))}
            </section>

            <section className="ol-card ol-rodape ol-a-info" aria-label="Informações">
              <div className="ol-frase">
                {r.intervalos ? <>Intervalos registrados em 30 dias: <b className="ol-num" style={{ color: "var(--ol-fg)" }}>{r.intervalos.registros30}</b> (informativo, ainda sem pontos).</> : "Intervalos: sem registro (informativo)."}
                {est.falhou && <><br />A última atualização falhou; mostrando o cálculo anterior.</>}
              </div>
              {!r.demo && <button type="button" className="ol-botao" disabled={est.fase === "atualizando"} onClick={() => buscar(true)}>{est.fase === "atualizando" ? "Recalculando…" : "Recalcular agora"}</button>}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
