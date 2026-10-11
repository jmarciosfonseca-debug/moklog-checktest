// Tela "Mapa de Equipe diário" do projeto: o líder preenche as exceções e conclui; sai o texto do WhatsApp.
// O mapa abre pré-preenchido (último mapa enviado do mesmo turno). Autosalva o rascunho.
import { useEffect, useMemo, useRef, useState } from "react";
import { projetoPuxaEquipe, puxarEquipe } from "./postos";
import { turnoVigente, dataBrasilia } from "./painel";
import { chaveMapa, estadoDoMapa, inicioDoTurno, rotuloDia } from "./regras";
import { horarioDoTurno } from "./horarios";
import { novoMapa, postoVazio, SITUACOES, ROTULO_SITUACAO, SITUACOES_MATERIAL, itensDeEquipamento, resumoItens, definirSituacaoMaterial, materialNovo, itensContaveis, definirQuantidade, validarParaConcluir, pessoasRepetidas, kmRodado } from "./modelo";
import { resumoLancamento } from "./ficha";
import { montarTextoWhatsApp, linkWhatsApp, rotuloTurno } from "./texto";
import * as dados from "./dados";

const dataBR = (iso) => iso.split("-").reverse().join("/");
const nomeCurto = (c) => c.nome;

export default function MapaDiarioTela({ project, dark, onBack, io = dados, agoraFn = () => new Date() }) {
  const pid = project?.id;
  const cor = {
    bg: dark ? "#04080f" : "#f1f5f9", card: dark ? "#060c18" : "#ffffff", line: dark ? "#1e293b" : "#e2e8f0",
    txt: dark ? "#f1f5f9" : "#0f172a", txt2: dark ? "#94a3b8" : "#64748b", ac: "#f59e0b",
    input: dark ? "#0b1220" : "#f8fafc",
  };
  const inicial = useMemo(() => { const v = turnoVigente(pid, agoraFn()); return v || { data: dataBrasilia(agoraFn()), turno: "D" }; }, [pid]); // eslint-disable-line
  const [data, setData] = useState(inicial.data);
  const [turno, setTurno] = useState(inicial.turno);
  const [colabs, setColabs] = useState([]);
  const [mapa, setMapa] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState("");
  const [avisos, setAvisos] = useState([]);
  const [copiado, setCopiado] = useState(false);
  const [abertos, setAbertos] = useState({});
  const [itensMat, setItensMat] = useState([]);
  const [avisoEquipe, setAvisoEquipe] = useState("");
  const [fichaMsg, setFichaMsg] = useState(null);
  const [matAberto, setMatAberto] = useState(false);
  const carregadoRef = useRef(false);
  const timer = useRef(null);

  const horario = horarioDoTurno(pid, turno);

  // Carrega equipe + mapa (existente ou novo pré-preenchido) quando muda dia/turno.
  useEffect(() => {
    let vivo = true;
    carregadoRef.current = false;
    setCarregando(true); setErro(""); setAvisos([]);
    (async () => {
      try {
        const [cs, existente] = await Promise.all([io.loadColaboradores(pid, data), io.loadMapa(pid, chaveMapa(pid, data, turno))]);
        let m = existente;
        if (!m) {
          const base = await io.loadUltimoMapa(pid, turno, data, { gapPar: projetoPuxaEquipe(pid) }).catch(() => null);
          m = novoMapa({ projetoId: pid, data, turno, horario: horario ? { inicio: horario.inicio, fim: horario.fim } : null, base, agora: agoraFn() });
        }
        if (m.status !== "enviado") {
          const vis = await io.loadUltimaVisita(pid).catch(() => null);
          m = { ...m, supervisao: vis };
        }
        const eq = await (io.loadEquipamentos ? io.loadEquipamentos(pid).catch(() => null) : Promise.resolve(null));
        if (!vivo) return;
        let aviso = "";
        if (m.status !== "enviado" && projetoPuxaEquipe(pid)) {
          const lp = (m.postos || []).find((p) => p.lider && p.pessoaId);
          const lc = lp && cs.find((c) => c.id === lp.pessoaId);
          if (lc) { const r = puxarEquipe({ postos: m.postos, lider: lc, colabs: cs, pid, turno, soVazios: !!existente }); m = { ...m, postos: r.postos }; aviso = r.semEquipe ? `${lc.nome} ainda não tem equipe montada em Equipes: escolha quem está em cada posto.` : `Equipe de ${lc.nome} puxada da montagem em Equipes. Ajuste só o que mudou.`; }
        }
        setAvisoEquipe(aviso);
        setColabs(cs); setMapa(m); setItensMat(itensDeEquipamento(eq, pid, turno));
      } catch (e) { if (vivo) setErro("Não consegui abrir o mapa agora. Tente de novo; nada foi alterado."); }
      finally { if (vivo) { setCarregando(false); setTimeout(() => { carregadoRef.current = true; }, 0); } }
    })();
    return () => { vivo = false; };
  }, [pid, data, turno]); // eslint-disable-line

  // Autosave do rascunho (e das correções), 1,5 s depois da última alteração.
  const alterar = (fn) => {
    setMapa((m) => {
      const novo = fn(m);
      clearTimeout(timer.current);
      setSalvo("");
      timer.current = setTimeout(async () => {
        try { await io.saveMapa(novo); setSalvo("Salvo"); } catch (e) { setSalvo("Não salvou — confira a conexão"); }
      }, 1500);
      return novo;
    });
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const setPosto = (id, patch) => alterar((m) => ({ ...m, postos: m.postos.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const setDetalhe = (id, patch) => alterar((m) => ({ ...m, postos: m.postos.map((p) => (p.id === id ? { ...p, detalhe: { ...p.detalhe, ...patch } } : p)) }));
  const escolherPessoa = (id, valor) => {
    if (valor === "__outro") return setPosto(id, { pessoaId: "", pessoaNome: "", detalhe: { livre: true } });
    const c = colabs.find((x) => x.id === valor);
    const alvo = mapa.postos.find((p) => p.id === id);
    // Escolheu o líder: a equipe montada por ele (Equipe → Montagem) entra sozinha nos demais postos.
    if (alvo && alvo.lider && c && projetoPuxaEquipe(pid)) {
      const r = puxarEquipe({ postos: mapa.postos.map((p) => (p.id === id ? { ...p, pessoaId: c.id, pessoaNome: c.nome, detalhe: {} } : p)), lider: c, colabs, pid, turno, limparSeSemEquipe: true });
      setAvisoEquipe(r.semEquipe ? `${c.nome} ainda não tem equipe montada em Equipes: escolha quem está em cada posto.` : `Equipe de ${c.nome} puxada da montagem em Equipes (${r.puxados} ${r.puxados === 1 ? "posto" : "postos"}). Ajuste só o que mudou.`);
      return alterar((m) => ({ ...m, postos: r.postos }));
    }
    setPosto(id, { pessoaId: c ? c.id : "", pessoaNome: c ? c.nome : "", detalhe: {} });
  };

  // O líder montou (ou ajustou) a equipe em Equipe com o mapa aberto: relê o cadastro e puxa de novo, sem tirar quem ele já escolheu.
  const puxarDeNovo = async () => {
    const lp = mapa.postos.find((p) => p.lider && p.pessoaId);
    if (!lp) return setAvisoEquipe("Escolha primeiro o líder para puxar a equipe dele.");
    try {
      const cs = await io.loadColaboradores(pid, data);
      const lc = cs.find((c) => c.id === lp.pessoaId);
      setColabs(cs);
      if (!lc) return;
      const r = puxarEquipe({ postos: mapa.postos, lider: lc, colabs: cs, pid, turno, soVazios: true });
      setAvisoEquipe(r.semEquipe ? `${lc.nome} ainda não tem equipe montada em Equipes: monte lá e toque em Puxar de novo.` : `Equipe de ${lc.nome} atualizada da montagem em Equipes (${r.puxados} ${r.puxados === 1 ? "posto" : "postos"} preenchidos).`);
      if (r.puxados) alterar((m) => ({ ...m, postos: r.postos }));
    } catch (e) { setAvisoEquipe("Não consegui reler a Equipe agora. Tente de novo."); }
  };

  const concluir = async () => {
    const contaveis = itensContaveis(itensMat);
    const erros = validarParaConcluir(mapa, contaveis);
    setAvisos(erros);
    if (erros.length) return;
    const agora = agoraFn().toISOString();
    const final = { ...mapa, material: { ...materialNovo(), ...(mapa.material || {}), conferidos: resumoItens(itensMat), quantidades: Object.fromEntries(contaveis.filter((i) => (mapa.material?.quantidades || {})[i.chaveQtd]).map((i) => [i.chaveQtd, mapa.material.quantidades[i.chaveQtd]])) }, status: "enviado", enviadoEm: mapa.enviadoEm || agora, revisoes: mapa.enviadoEm ? [...(mapa.revisoes || []), { em: agora }] : (mapa.revisoes || []) };
    try { const gravado = await io.saveMapa(final); setMapa(gravado); setSalvo("Enviado e salvo"); }
    catch (e) { setAvisos(["Não gravou. Confira a conexão e toque em Concluir de novo (o WhatsApp só libera depois de gravar)."]); return; }
    // Falta, FT e atraso entram na ficha do colaborador (sem duplicar). Se falhar, o mapa e o WhatsApp seguem valendo.
    setFichaMsg(null);
    if (io.lancarNaFicha) {
      try { const r = await io.lancarNaFicha(final); setFichaMsg({ ok: true, texto: resumoLancamento(r, final) }); }
      catch (e) { setFichaMsg({ ok: false, texto: `Mapa gravado, mas Falta/FT/Atraso NÃO entraram na ficha (${e.message || "erro"}). Toque em Concluir mapa de novo (correção) para tentar outra vez.` }); }
    }
  };

  const texto = mapa ? montarTextoWhatsApp(mapa, { nomeProjeto: project?.name || "" }) : "";
  const copiar = async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch (e) { setAvisos(["Não consegui copiar; use o botão do WhatsApp."]); } };
  const enviado = mapa && mapa.status === "enviado";
  const prazo = horario ? estadoDoMapa({ inicio: inicioDoTurno(data, horario.inicio), agora: agoraFn(), enviadoEm: enviado ? new Date(mapa.enviadoEm) : null }) : null;
  const repetidas = mapa ? pessoasRepetidas(mapa) : [];

  const S = {
    card: { background: cor.card, border: `1.5px solid ${cor.line}`, borderRadius: 16, padding: "14px 16px" },
    h: { fontSize: 13, fontWeight: 800, color: cor.txt, marginBottom: 8 },
    in: { width: "100%", boxSizing: "border-box", background: cor.input, color: cor.txt, border: `1px solid ${cor.line}`, borderRadius: 9, padding: "9px 10px", fontSize: 14, minHeight: 40 },
    btn: { background: "transparent", border: `1px solid ${cor.line}`, color: cor.txt2, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 36 },
    chip: (on, c = cor.ac) => ({ background: on ? c : "transparent", color: on ? "#111" : cor.txt2, border: `1px solid ${on ? c : cor.line}`, borderRadius: 999, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 32 }),
    lab: { fontSize: 11, color: cor.txt2, margin: "8px 0 3px", fontWeight: 700 },
  };
  const opcoesPessoa = () => (
    <>
      <option value="">Escolher…</option>
      {colabs.map((c) => <option key={c.id} value={c.id}>{nomeCurto(c)}{c.cargo ? ` · ${c.cargo}` : ""}{c.emFerias ? " (férias)" : ""}</option>)}
      <option value="__outro">Outro (digitar nome)</option>
    </>
  );
  const seletorPessoa = (rotulo, valor, onChange) => (
    <select aria-label={rotulo} value={colabs.find((c) => c.nome === valor) ? colabs.find((c) => c.nome === valor).id : ""} onChange={(e) => onChange(colabs.find((c) => c.id === e.target.value)?.nome || "")} style={S.in}>
      <option value="">Escolher…</option>
      {colabs.map((c) => <option key={c.id} value={c.id}>{nomeCurto(c)}</option>)}
    </select>
  );

  return (
    <div style={{ minHeight: "100vh", background: cor.bg, display: "flex", justifyContent: "center", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 480, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} aria-label="Voltar" style={S.btn}>← Voltar</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: cor.txt }}>Mapa de Equipe diário</div>
            <div style={{ fontSize: 11, color: cor.txt2 }}>{pid}{project?.name ? ` · ${project.name}` : ""}</div>
          </div>
          <span style={{ fontSize: 11, color: cor.txt2 }}>{salvo}</span>
        </div>

        <div style={S.card}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="date" aria-label="Data do mapa" value={data} onChange={(e) => e.target.value && setData(e.target.value)} style={{ ...S.in, width: "auto" }} />
            {["D", "N"].map((t) => <button key={t} onClick={() => setTurno(t)} aria-pressed={turno === t} style={S.chip(turno === t)}>{t === "D" ? "Diurno" : "Noturno"}</button>)}
          </div>
          <div style={{ fontSize: 12, color: cor.txt2, marginTop: 8 }}>
            {rotuloDia(data)}, {dataBR(data)} · {rotuloTurno(turno, horario)}
          </div>
          {prazo && (
            <div style={{ fontSize: 12, fontWeight: 800, marginTop: 6, color: prazo === "enviado" ? "#16a34a" : prazo === "pendente" ? "#dc2626" : prazo === "cobranca" ? "#f59e0b" : cor.txt2 }}>
              {prazo === "enviado" ? "Mapa enviado" : prazo === "cobranca" ? "Enviar agora: a equipe já assumiu" : prazo === "pendente" ? "Mapa pendente" : "Aguardando a equipe assumir"}
            </div>
          )}
        </div>

        {carregando && <div style={{ ...S.card, color: cor.txt2, fontSize: 13 }}>Abrindo o mapa…</div>}
        {erro && <div role="alert" style={{ ...S.card, color: "#dc2626", fontSize: 13 }}>{erro}</div>}

        {mapa && !carregando && (<>
          <div style={S.card}>
            <div style={S.h}>Equipe do turno</div>
            {!projetoPuxaEquipe(pid) && <div style={{ fontSize: 12, color: cor.txt2, marginBottom: 8 }}>Projeto 4x2/5x2: a equipe muda a cada plantão e não é puxada sozinha. Escolha quem está em cada posto.</div>}
            {projetoPuxaEquipe(pid) && mapa.status !== "enviado" && (() => {
              const preench = mapa.preenchidoDe ? `Pré-preenchido com o mapa de ${mapa.preenchidoDe.data ? dataBR(mapa.preenchidoDe.data) : "dias atrás"} (${mapa.preenchidoDe.turno === "N" ? "noturno" : "diurno"}), mesma turma. Confira.` : "";
              const texto = avisoEquipe || preench;
              return (texto || mapa.postos.some((p) => p.lider && p.pessoaId)) ? <div role="status" style={{ fontSize: 12, color: cor.txt2, marginBottom: 8 }}>{texto} <button onClick={puxarDeNovo} style={{ ...S.btn, padding: "3px 8px", fontSize: 11 }}>Puxar de novo</button></div> : null;
            })()}
            {repetidas.length > 0 && <div role="alert" style={{ fontSize: 12, color: "#f59e0b", marginBottom: 8 }}>Atenção: {repetidas.map((r) => `${r.pessoa} em ${r.postos.join(" e ")}`).join("; ")}</div>}
            {mapa.postos.map((p) => (
              <div key={p.id} style={{ borderTop: `1px solid ${cor.line}`, padding: "10px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: cor.txt, minWidth: 74 }}>{p.rotulo}{p.horario ? <div style={{ fontSize: 10, color: cor.txt2, fontWeight: 600 }}>{p.horario.inicio}–{p.horario.fim}</div> : null}</div>
                  <div style={{ flex: 1 }}>
                    {p.situacao === "vago" ? <div style={{ fontSize: 13, color: cor.txt2 }}>Sem ninguém no posto</div> : p.detalhe?.livre ? (
                      <input aria-label={`Nome no posto ${p.rotulo}`} placeholder="Digite o nome" value={p.pessoaNome} onChange={(e) => setPosto(p.id, { pessoaNome: e.target.value })} style={S.in} />
                    ) : (
                      <select aria-label={`Quem está no posto ${p.rotulo}`} value={p.pessoaId || ""} onChange={(e) => escolherPessoa(p.id, e.target.value)} style={S.in}>{opcoesPessoa()}</select>
                    )}
                  </div>
                  <button aria-label={`Exceção do posto ${p.rotulo}`} aria-expanded={p.situacao !== "presente" || !!abertos[p.id]} onClick={() => setAbertos((a) => ({ ...a, [p.id]: !a[p.id] }))} style={{ ...S.btn, padding: "6px 9px", color: p.situacao === "presente" ? cor.txt2 : cor.ac, borderColor: p.situacao === "presente" ? cor.line : cor.ac }}>{p.situacao === "presente" ? "Exceção" : ROTULO_SITUACAO[p.situacao]}</button>
                  <button aria-label={`Remover posto ${p.rotulo}`} onClick={() => alterar((m) => ({ ...m, postos: m.postos.filter((x) => x.id !== p.id) }))} style={{ ...S.btn, padding: "6px 9px" }}>×</button>
                </div>
                {(p.situacao !== "presente" || abertos[p.id]) && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {SITUACOES.map((s) => (
                    <button key={s.id} aria-pressed={p.situacao === s.id} onClick={() => setPosto(p.id, { situacao: s.id, detalhe: { livre: p.detalhe?.livre } })} style={S.chip(p.situacao === s.id, s.id === "presente" ? "#16a34a" : s.id === "falta" ? "#dc2626" : cor.ac)}>{s.rotulo}</button>
                  ))}
                </div>}
                {p.situacao === "atraso" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <div style={{ flex: 1 }}><div style={S.lab}>Chegou às</div><input type="time" aria-label="Hora de chegada" value={p.detalhe?.hora || ""} onChange={(e) => setDetalhe(p.id, { hora: e.target.value })} style={S.in} /></div>
                    <div style={{ flex: 1 }}><div style={S.lab}>ou minutos</div><input type="number" inputMode="numeric" aria-label="Minutos de atraso" value={p.detalhe?.minutos || ""} onChange={(e) => setDetalhe(p.id, { minutos: e.target.value })} style={S.in} /></div>
                  </div>
                )}
                {p.situacao === "cobertura" && (
                  <div>
                    <div style={S.lab}>Cobrindo quem?</div>
                    {seletorPessoa("Cobertura de quem", p.detalhe?.deQuem, (n) => setDetalhe(p.id, { deQuem: n }))}
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: cor.txt2, marginTop: 8 }}>
                      <input type="checkbox" checked={!!p.detalhe?.base} onChange={(e) => setPosto(p.id, { detalhe: { ...p.detalhe, base: e.target.checked, livre: e.target.checked }, pessoaId: "", pessoaNome: "" })} /> Quem cobre é da Base (digitar o nome)
                    </label>
                  </div>
                )}
                {p.situacao === "troca" && (
                  <div>
                    <div style={S.lab}>No lugar de quem?</div>
                    {seletorPessoa("Troca no lugar de quem", p.detalhe?.noLugarDe, (n) => setDetalhe(p.id, { noLugarDe: n }))}
                  </div>
                )}
                {p.situacao !== "presente" && (
                  <input aria-label={`Observação do posto ${p.rotulo}`} placeholder="Observação (opcional, sem motivo de saúde)" value={p.obs || ""} onChange={(e) => setPosto(p.id, { obs: e.target.value })} style={{ ...S.in, marginTop: 8 }} />
                )}
              </div>
            ))}
            <button onClick={() => alterar((m) => ({ ...m, postos: [...m.postos, postoVazio("Posto extra")] }))} style={{ ...S.btn, marginTop: 6 }}>+ Posto</button>
          </div>

          <div style={S.card}>
            {(() => {
              const mat = { ...materialNovo(), ...(mapa.material || {}) };
              const exc = mat.excecoes || [];
              const situacaoDe = (id) => (exc.find((e) => e.id === id) || {}).situacao || "ok";
              const obsDe = (id) => (exc.find((e) => e.id === id) || {}).obs || "";
              const setMat = (fn) => alterar((m) => ({ ...m, material: fn({ ...materialNovo(), ...(m.material || {}) }) }));
              const grupos = itensMat.reduce((g, it) => { (g[it.rotuloCategoria] = g[it.rotuloCategoria] || []).push(it); return g; }, {});
              const livres = exc.filter((e) => String(e.id).startsWith("livre:"));
              const resumo = exc.length ? `${exc.length} com alteração` : mat.semAlteracao ? "Sem alteração · tudo disponível" : "Alterado";
              const corRes = exc.length || !mat.semAlteracao ? "#f59e0b" : "#16a34a";
              return (<>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...S.h, marginBottom: 2 }}>Material, armamento e munição</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: corRes }}>{resumo}</div>
                    <div style={{ fontSize: 11, color: cor.txt2, marginTop: 2 }}>{itensMat.length ? `Lista do projeto: ${resumoItens(itensMat)}` : "Nenhum equipamento cadastrado neste projeto: complete em Equipamentos"}</div>
                  </div>
                  <button aria-expanded={matAberto} aria-label="Conferir material" onClick={() => setMatAberto((v) => !v)} style={S.btn}>{matAberto ? "Recolher ▴" : "Conferir ▾"}</button>
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: cor.txt, marginTop: 10 }}>
                  <input type="checkbox" disabled={exc.length > 0} checked={!!mat.semAlteracao && exc.length === 0} onChange={(e) => setMat((m) => ({ ...m, semAlteracao: e.target.checked }))} /> Sem alteração: conferi e está tudo disponível
                </label>
                {itensContaveis(itensMat).length > 0 && (
                  <div style={{ marginTop: 10, padding: "8px 10px", border: `1px dashed ${cor.line}`, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: cor.txt2, marginBottom: 6 }}>CONTE E INFORME A QUANTIDADE (fica salva para os próximos mapas)</div>
                    {itensContaveis(itensMat).map((it) => {
                      const q = (mat.quantidades || {})[it.chaveQtd]?.qtd ?? "";
                      return (
                        <label key={it.chaveQtd} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: cor.txt, marginBottom: 6 }}>
                          <span style={{ flex: 1 }}>{it.nome} <span style={{ color: cor.txt2 }}>· {it.rotuloCategoria}</span></span>
                          <input aria-label={`Quantidade: ${it.nome}`} type="number" inputMode="numeric" min="0" placeholder="Qtd" value={q} onChange={(e) => setMat((m) => definirQuantidade(m, it, e.target.value))} style={{ ...S.in, width: 70, textAlign: "center", borderColor: String(q).trim() ? undefined : "#f59e0b" }} />
                        </label>
                      );
                    })}
                  </div>
                )}
                {!mat.semAlteracao && exc.length === 0 && !matAberto && <textarea aria-label="O que mudou no material" rows={2} placeholder="O que mudou no material" value={mat.obs || ""} onChange={(e) => setMat((m) => ({ ...m, obs: e.target.value }))} style={{ ...S.in, marginTop: 8 }} />}
                {matAberto && (
                  <div style={{ marginTop: 10 }}>
                    {itensMat.length === 0 && <div style={{ fontSize: 12, color: cor.txt2 }}>Sem equipamentos cadastrados neste projeto. Use "+ Outro item" para registrar uma anomalia.</div>}
                    {Object.entries(grupos).map(([nomeGrupo, itens]) => (
                      <div key={nomeGrupo} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: cor.txt2, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{nomeGrupo}</div>
                        {itens.map((it) => {
                          const sit = situacaoDe(it.id);
                          return (
                            <div key={it.id} style={{ borderTop: `1px solid ${cor.line}`, padding: "8px 0" }}>
                              <div style={{ fontSize: 13, color: cor.txt, fontWeight: 700 }}>{it.nome}{it.detalhe ? <span style={{ color: cor.txt2, fontWeight: 500 }}> · {it.detalhe}</span> : null}</div>
                              {it.cadastro && it.cadastro !== "ok" && <div style={{ fontSize: 11, color: "#f59e0b" }}>No cadastro de Equipamentos: {it.cadastro}</div>}
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                                {SITUACOES_MATERIAL.map((o) => (
                                  <button key={o.id} aria-pressed={sit === o.id} aria-label={`${it.nome}: ${o.rotulo}`} onClick={() => setMat((m) => definirSituacaoMaterial(m, it, o.id))} style={S.chip(sit === o.id, o.id === "ok" ? "#16a34a" : o.id === "anomalia" ? "#f59e0b" : "#dc2626")}>{o.rotulo}</button>
                                ))}
                              </div>
                              {sit !== "ok" && <input aria-label={`Observação: ${it.nome}`} placeholder="Descreva o que houve (obrigatório)" value={obsDe(it.id)} onChange={(e) => setMat((m) => definirSituacaoMaterial(m, it, sit, e.target.value))} style={{ ...S.in, marginTop: 8 }} />}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    {livres.map((e) => (
                      <div key={e.id} style={{ borderTop: `1px solid ${cor.line}`, padding: "8px 0" }}>
                        <input aria-label="Nome do item" placeholder="Qual item?" value={e.nome} onChange={(ev) => setMat((m) => ({ ...m, excecoes: m.excecoes.map((x) => (x.id === e.id ? { ...x, nome: ev.target.value } : x)) }))} style={S.in} />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          {SITUACOES_MATERIAL.filter((o) => o.id !== "ok").map((o) => (
                            <button key={o.id} aria-pressed={e.situacao === o.id} onClick={() => setMat((m) => ({ ...m, excecoes: m.excecoes.map((x) => (x.id === e.id ? { ...x, situacao: o.id } : x)) }))} style={S.chip(e.situacao === o.id, o.id === "anomalia" ? "#f59e0b" : "#dc2626")}>{o.rotulo}</button>
                          ))}
                          <button aria-label="Remover item" onClick={() => setMat((m) => { const ex = m.excecoes.filter((x) => x.id !== e.id); return { ...m, excecoes: ex, semAlteracao: ex.length ? false : !(m.obs || "").trim() }; })} style={{ ...S.btn, padding: "6px 9px" }}>×</button>
                        </div>
                        <input aria-label={`Observação: ${e.nome || "item"}`} placeholder="Descreva o que houve (obrigatório)" value={e.obs || ""} onChange={(ev) => setMat((m) => ({ ...m, excecoes: m.excecoes.map((x) => (x.id === e.id ? { ...x, obs: ev.target.value } : x)) }))} style={{ ...S.in, marginTop: 8 }} />
                      </div>
                    ))}
                    <button onClick={() => setMat((m) => ({ ...m, semAlteracao: false, excecoes: [...m.excecoes, { id: `livre:${Date.now().toString(36)}`, categoria: "outros", nome: "", detalhe: "", situacao: "anomalia", obs: "" }] }))} style={S.btn}>+ Outro item</button>
                    <div style={S.lab}>Observação do material (opcional)</div>
                    <textarea aria-label="Observação do material" rows={2} placeholder="Qualquer informação sobre armamento, munição ou rádios" value={mat.obs || ""} onChange={(e) => setMat((m) => ({ ...m, obs: e.target.value }))} style={S.in} />
                  </div>
                )}
              </>);
            })()}
          </div>

          <div style={S.card}>
            <div style={S.h}>Veículos (odômetro)</div>
            {mapa.veiculos.map((v, i) => (
              <div key={v.id || i} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8 }}>
                <div style={{ flex: 1 }}><div style={S.lab}>{v.rotulo || "Veículo"} · anterior {v.kmAnterior ?? "—"}</div>
                  <input type="number" inputMode="decimal" aria-label={`Km atual ${v.rotulo}`} placeholder="Km atual" value={v.kmAtual ?? ""} onChange={(e) => alterar((m) => ({ ...m, veiculos: m.veiculos.map((x, k) => (k === i ? { ...x, kmAtual: e.target.value } : x)) }))} style={S.in} /></div>
                <div style={{ fontSize: 12, color: cor.txt2, minWidth: 70 }}>{kmRodado(v) != null ? `rodou ${kmRodado(v)} km` : ""}</div>
              </div>
            ))}
            <button onClick={() => alterar((m) => ({ ...m, veiculos: [...m.veiculos, { id: `v${Date.now().toString(36)}`, rotulo: m.veiculos.length ? `Veículo ${m.veiculos.length + 1}` : "Moto", kmAnterior: null, kmAtual: null }] }))} style={S.btn}>+ Veículo</button>
          </div>

          <div style={S.card}>
            <div style={S.h}>Última visita da supervisão</div>
            <div style={{ fontSize: 13, color: cor.txt }}>
              {mapa.supervisao?.ultimaData ? `${dataBR(mapa.supervisao.ultimaData)}${mapa.supervisao.supervisor ? ` — ${mapa.supervisao.supervisor}` : ""}${mapa.supervisao.turno ? ` (${mapa.supervisao.turno})` : ""}` : "Sem visita registrada"}
            </div>
            <div style={{ fontSize: 11, color: cor.txt2, marginTop: 4 }}>Vem do registro de Supervisão da CCO.</div>
          </div>

          <div style={S.card}>
            <div style={S.h}>Resumo da passagem</div>
            <textarea aria-label="Resumo da passagem" rows={3} placeholder="Preleção, ocorrências, pendências para o próximo turno" value={mapa.resumo} onChange={(e) => alterar((m) => ({ ...m, resumo: e.target.value }))} style={S.in} />
          </div>

          {avisos.length > 0 && <div role="alert" style={{ ...S.card, borderColor: "#dc2626" }}>{avisos.map((a, i) => <div key={i} style={{ fontSize: 13, color: "#dc2626", marginBottom: 4 }}>{a}</div>)}</div>}

          {!enviado && <button onClick={concluir} style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#111", border: "none", borderRadius: 14, padding: "15px 16px", fontSize: 15, fontWeight: 900, cursor: "pointer" }}>Concluir mapa</button>}

          {enviado && (
            <div style={{ ...S.card, borderColor: "#16a34a" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#16a34a", marginBottom: 8 }}>Mapa gravado. Agora envie no WhatsApp.</div>
              {fichaMsg && <div role="status" style={{ fontSize: 12, color: fichaMsg.ok ? cor.txt2 : "#f59e0b", marginBottom: 8 }}>{fichaMsg.texto}</div>}
              <pre aria-label="Texto do mapa" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12.5, color: cor.txt, background: cor.input, border: `1px solid ${cor.line}`, borderRadius: 10, padding: 10, margin: "0 0 10px" }}>{texto}</pre>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={linkWhatsApp(texto)} target="_blank" rel="noreferrer" style={{ ...S.btn, background: "#16a34a", color: "#fff", border: "none", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Abrir WhatsApp</a>
                <button onClick={copiar} style={S.btn}>{copiado ? "Copiado" : "Copiar texto"}</button>
              </div>
              <div style={{ fontSize: 11, color: cor.txt2, marginTop: 8 }}>Para corrigir, altere os campos acima e toque em Concluir mapa de novo; a correção fica registrada.</div>
              <button onClick={concluir} style={{ ...S.btn, marginTop: 8 }}>Concluir mapa de novo (correção)</button>
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
