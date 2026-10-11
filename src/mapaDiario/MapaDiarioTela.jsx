// Tela "Mapa de Equipe diário" do projeto: o líder preenche as exceções e conclui; sai o texto do WhatsApp.
// O mapa abre pré-preenchido (último mapa enviado do mesmo turno). Autosalva o rascunho.
import { useEffect, useMemo, useRef, useState } from "react";
import { turnoVigente, dataBrasilia } from "./painel";
import { chaveMapa, estadoDoMapa, inicioDoTurno, rotuloDia } from "./regras";
import { horarioDoTurno } from "./horarios";
import { novoMapa, postoVazio, SITUACOES, ROTULO_SITUACAO, validarParaConcluir, pessoasRepetidas, kmRodado } from "./modelo";
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
          const base = await io.loadUltimoMapa(pid, turno, data).catch(() => null);
          m = novoMapa({ projetoId: pid, data, turno, horario: horario ? { inicio: horario.inicio, fim: horario.fim } : null, base, agora: agoraFn() });
        }
        if (m.status !== "enviado") {
          const vis = await io.loadUltimaVisita(pid).catch(() => null);
          m = { ...m, supervisao: vis };
        }
        if (!vivo) return;
        setColabs(cs); setMapa(m);
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
    setPosto(id, { pessoaId: c ? c.id : "", pessoaNome: c ? c.nome : "", detalhe: {} });
  };

  const concluir = async () => {
    const erros = validarParaConcluir(mapa);
    setAvisos(erros);
    if (erros.length) return;
    const agora = agoraFn().toISOString();
    const final = { ...mapa, status: "enviado", enviadoEm: mapa.enviadoEm || agora, revisoes: mapa.enviadoEm ? [...(mapa.revisoes || []), { em: agora }] : (mapa.revisoes || []) };
    try { const gravado = await io.saveMapa(final); setMapa(gravado); setSalvo("Enviado e salvo"); }
    catch (e) { setAvisos(["Não gravou. Confira a conexão e toque em Concluir de novo (o WhatsApp só libera depois de gravar)."]); }
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
            <div style={S.h}>Material, armamento e munição</div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: cor.txt }}>
              <input type="checkbox" checked={!!mapa.material?.semAlteracao} onChange={(e) => alterar((m) => ({ ...m, material: { ...m.material, semAlteracao: e.target.checked } }))} /> Sem alteração
            </label>
            {!mapa.material?.semAlteracao && <textarea aria-label="O que mudou no material" rows={2} placeholder="O que mudou" value={mapa.material?.obs || ""} onChange={(e) => alterar((m) => ({ ...m, material: { ...m.material, obs: e.target.value } }))} style={{ ...S.in, marginTop: 8 }} />}
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
