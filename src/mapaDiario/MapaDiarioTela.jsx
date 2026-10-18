// Tela "Mapa de Equipe diário" do projeto: o líder preenche as exceções e conclui; sai o texto do WhatsApp.
// O mapa abre pré-preenchido (último mapa enviado do mesmo turno). Autosalva o rascunho.
import CampoData from "../CampoData";
import { useEffect, useMemo, useRef, useState } from "react";
import { projetoPuxaEquipe, puxarEquipe } from "./postos";
import { turnoVigente, dataBrasilia } from "./painel";
import { chaveMapa, estadoDoMapa, inicioDoTurno, rotuloDia } from "./regras";
import { horarioDoTurno } from "./horarios";
import { novoMapa, postoVazio, SITUACOES, ROTULO_SITUACAO, SITUACOES_MATERIAL, itensDeEquipamento, resumoItens, definirSituacaoMaterial, materialNovo, itensContaveis, definirQuantidade, validarParaConcluir, avisoResumoSemExcecao, pessoasRepetidas, kmRodado, soDigitos, ehPostoExtra, candidatosAFalta, vincularFalta, mudarSituacao, removerPosto, garantirMoto, completarPostosFixos, ehMoto, projetoComMoto, ausentesDaEquipe, foraDaEquipe, definirCobertoDe, marcarCoberturaSemFalta, completarIdsCobertura, herdarKmDoUltimoPlantao, veiculosInteiros, rodadoAlto, registrarSaidaAntecipada, MOTIVOS_SAIDA, TIPOS_COBERTURA, rotuloSaida, corrigirKmAnterior, desfazerCorrecaoKm, rotuloCorrecaoKm, MOTIVOS_BAIXA, validarBaixa, registrarBaixaNoMapa, rotuloBaixa } from "./modelo";
import { resumoLancamento, descricaoLancamentos } from "./ficha";
import { montarTextoWhatsApp, linkWhatsApp, rotuloTurno } from "./texto";
import { MAX_PLANTOES_AFASTAMENTO, linhaDesligamento } from "../equipeEventos";
import { isDemo } from "../session";
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
  const [deslig, setDeslig] = useState([]);   // desligamentos das últimas 24h (aviso)
  const [mapa, setMapa] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState("");
  const [avisos, setAvisos] = useState([]);
  const [copiado, setCopiado] = useState(false);
  const [abertos, setAbertos] = useState({});
  const [itensMat, setItensMat] = useState([]);
  const [avisoEquipe, setAvisoEquipe] = useState("");
  const [avisoReaberto, setAvisoReaberto] = useState("");
  const [fichaMsg, setFichaMsg] = useState(null);
  const [fichaBusy, setFichaBusy] = useState(false);
  const [confirmouResumo, setConfirmouResumo] = useState(false);
  const [matAberto, setMatAberto] = useState(false);
  const [editando, setEditando] = useState(false); // mapa já enviado reaberto para correção
  const [, setTicue] = useState(0); // re-render periódico: plantão em vigor e banner ficam atuais mesmo com a aba aberta da véspera
  const [ignorados, setIgnorados] = useState({}); // avisos "não é da equipe" dispensados (posto:pessoa)
  const [enviando, setEnviando] = useState(false);   // Concluir em andamento (gravando + confirmando no servidor)
  const [reenvioPendente, setReenvioPendente] = useState(0); // nº de tentativas automáticas já feitas
  const carregadoRef = useRef(false);
  const enviandoRef = useRef(false);   // true de Concluir até a resposta do servidor
  const timer = useRef(null);
  const [eqEdit, setEqEdit] = useState(null);       // correção de cadastro de equipamento pelo líder
  const [saidaForm, setSaidaForm] = useState(null);   // saída antecipada / substituição (mapa já enviado)
  const [saidaErros, setSaidaErros] = useState([]);
  const [kmForm, setKmForm] = useState(null);        // correção do km anterior { veiculoId, km, motivo, erros }
  const [baixaForm, setBaixaForm] = useState(null);  // baixa de equipamento pelo líder { id, motivo, obs, erro, salvando }
  const [baixaMsg, setBaixaMsg] = useState("");
  const reenvio = useRef(null);                      // { timer, mapa } do reenvio automático

  const horario = horarioDoTurno(pid, turno);
  useEffect(() => { const t = setInterval(() => setTicue((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  // Plantão em vigor AGORA (recalculado a cada render): se a tela ficou aberta de um plantão para o outro,
  // ou a data foi trocada, o líder vê o aviso — e o Concluir exige confirmação explícita.
  const vigente = turnoVigente(pid, agoraFn());
  const foraDoVigente = !!vigente && (data !== vigente.data || turno !== vigente.turno);
  const rotuloPlantao = (d, t) => `${rotuloDia(d)}, ${dataBR(d)} · ${t === "N" ? "Noturno" : "Diurno"}`;

  // Carrega equipe + mapa (existente ou novo pré-preenchido) quando muda dia/turno.
  useEffect(() => {
    let vivo = true;
    carregadoRef.current = false;
    setCarregando(true); setErro(""); setAvisos([]); setEditando(false);
    (async () => {
      try {
        const [cs, existente] = await Promise.all([io.loadColaboradores(pid, data), io.loadMapa(pid, chaveMapa(pid, data, turno))]);
        if (io.loadDesligamentosRecentes) { const dl = await io.loadDesligamentosRecentes(pid, agoraFn()).catch(() => []); if (vivo) setDeslig(dl); }
        let m = existente;
        if (!m) {
          const base = await io.loadUltimoMapa(pid, turno, data, { gapPar: projetoPuxaEquipe(pid) }).catch(() => null);
          m = novoMapa({ projetoId: pid, data, turno, horario: horario ? { inicio: horario.inicio, fim: horario.fim } : null, base, agora: agoraFn() });
        }
        const eq = await (io.loadEquipamentos ? io.loadEquipamentos(pid).catch(() => null) : Promise.resolve(null));
        if (m.status !== "enviado") {
          // Km anterior: do ÚLTIMO plantão do projeto (qualquer turno/equipe), não do último do mesmo turno.
          // A moto do cadastro entra junto: placa atual e troca de moto (moto nova começa do km inicial dela).
          if (io.loadUltimoPlantao) {
            const FALHOU = {};
            const ult = await io.loadUltimoPlantao(pid, data, turno).catch(() => FALHOU);
            if (ult !== FALHOU) m = herdarKmDoUltimoPlantao(m, ult, eq && eq.moto);
          }
          const vis = await io.loadUltimaVisita(pid).catch(() => null);
          m = { ...m, supervisao: vis };
        }
        if (!vivo) return;
        let aviso = "";
        if (m.status !== "enviado" && projetoPuxaEquipe(pid)) {
          const lp = (m.postos || []).find((p) => p.lider && p.pessoaId);
          const lc = lp && cs.find((c) => c.id === lp.pessoaId);
          if (lc) { const r = puxarEquipe({ postos: m.postos, lider: lc, colabs: cs, pid, turno, soVazios: !!existente }); m = { ...m, postos: r.postos }; aviso = r.semEquipe ? `${lc.nome} ainda não tem equipe montada em Equipes: escolha quem está em cada posto.` : `Equipe de ${lc.nome} puxada da montagem em Equipes. Ajuste só o que mudou.`; }
        }
        // Mapa já ENVIADO por versão antiga, sem algum posto fixo: reabre em edição com os postos de volta (nada é gravado até concluir).
        const completo = m.status === "enviado" ? completarPostosFixos(m, cs) : null;
        const reabrir = !!completo && completo !== m;
        if (reabrir) {
          const volta = completo.postos.filter((p) => !m.postos.includes(p)).map((p) => p.rotulo);
          setAvisoReaberto(`Este mapa foi enviado sem o posto fixo (${volta.join(", ")}). Os postos voltaram: confira quem estava em cada um e toque em Concluir mapa.`);
          setEditando(true);
        } else setAvisoReaberto("");
        setAvisoEquipe(aviso);
        setColabs(cs); setMapa(m.status === "enviado" ? (reabrir ? garantirMoto(completo) : m) : garantirMoto(completarPostosFixos(m, cs))); setItensMat(itensDeEquipamento(eq, pid, turno));
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
        if (enviandoRef.current) return;   // Concluir em andamento/concluído: rascunho atrasado não regrava o mapa
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
    // Enviar no plantão errado deixa o painel "Pendente" e o WhatsApp sai com a data errada: só com confirmação explícita.
    if (foraDoVigente && !window.confirm(`Este mapa é de ${rotuloPlantao(data, turno)}, mas o plantão em vigor é ${rotuloPlantao(vigente.data, vigente.turno)}.\n\nConcluir mesmo assim NO PLANTÃO ANTIGO? (Para o plantão de agora, cancele e toque em "Ir para o plantão em vigor".)`)) return;
    const contaveis = itensContaveis(itensMat);
    const mapaC = completarIdsCobertura(mapa, colabs); // mapa antigo: completa o id de quem foi coberto pelo cadastro
    const erros = validarParaConcluir(mapaC, contaveis);
    setAvisos(erros);
    if (erros.length) return;
    // Resumo cita extra/FT/falta/atraso sem exceção marcada: avisa uma vez; tocando de novo, envia assim mesmo.
    const aviso = avisoResumoSemExcecao(mapaC);
    if (aviso && !confirmouResumo) { setAvisos([`${aviso} Se está certo assim, toque em Concluir mapa de novo.`]); setConfirmouResumo(true); return; }
    const agora = agoraFn().toISOString();
    const altos = rodadoAlto(mapaC);
    if (altos.length && !window.confirm(`${altos.map((v) => `${v.rotulo || "Veículo"}: ${kmRodado(v)} km`).join(" · ")} num único plantão. Confira o odômetro.\n\nEstá correto? (OK para concluir, Cancelar para corrigir)`)) return;
    const final = { ...veiculosInteiros(mapaC), material: { ...materialNovo(), ...(mapaC.material || {}), conferidos: resumoItens(itensMat), quantidades: Object.fromEntries(contaveis.filter((i) => (mapaC.material?.quantidades || {})[i.chaveQtd]).map((i) => [i.chaveQtd, mapaC.material.quantidades[i.chaveQtd]])) }, status: "enviado", enviadoEm: mapaC.enviadoEm || agora, revisoes: mapaC.enviadoEm ? [...(mapaC.revisoes || []), { em: agora }] : (mapaC.revisoes || []) };
    await enviarComConfirmacao(final);
  }
  // Envio OFICIAL: grava e CONFIRMA no servidor antes de liberar o WhatsApp. Sem confirmação,
  // o líder vê na hora que NÃO chegou — e a tela tenta de novo sozinha a cada 20 s.
  const enviarComConfirmacao = async (final) => {
    setEnviando(true);
    clearTimeout(timer.current); enviandoRef.current = true;   // cancela o autosave pendente: nada pode ultrapassar o envio
    const enviar = io.enviarMapa || io.saveMapa;      // fallback p/ ambientes antigos
    try {
      const gravado = await enviar(final);
      pararReenvio();
      setMapa(gravado); setSalvo(isDemo() ? "Demonstração — NÃO gravado" : "Enviado e CONFIRMADO no servidor"); setEditando(false); setAvisos([]);
      setFichaMsg(null);
      await lancarFicha(final);                       // Falta/FT/atraso → ficha (sem duplicar)
      if (io.atualizarKmMotoNoCadastro && !isDemo()) io.atualizarKmMotoNoCadastro(pid, final).catch(() => {}); // km da moto no cadastro acompanha o mapa (só se maior, ou corrigido)
      aplicarCorrecoesKm(final);
    } catch (e) {
      setAvisos([`SEM CONFIRMAÇÃO DO SERVIDOR: ${(e && e.message) || "erro"}. O mapa ficou neste aparelho e o WhatsApp NÃO foi liberado. Mantenha esta tela aberta: vou tentar de novo sozinho a cada 20 segundos — ou toque em Concluir mapa quando o sinal voltar.`]);
      agendarReenvio(final);
    } finally { setEnviando(false); enviandoRef.current = false; }
  };
  // Km anterior corrigido neste mapa: o plantão do erro recebe o km certo (kmAtualCorrigido), para o consolidado não somar km irreal.
  const aplicarCorrecoesKm = (final) => {
    if (!io.corrigirKmNoMapaAnterior || isDemo()) return;
    (final.veiculos || []).filter((v) => v.correcaoKm && v.kmAnteriorDe).forEach((v) => {
      io.corrigirKmNoMapaAnterior(pid, v.kmAnteriorDe, v.id, v.kmAnterior, { motivo: v.correcaoKm.motivo, porMapa: final.id, em: v.correcaoKm.em }).catch(() => {});
    });
  };
  const pararReenvio = () => { if (reenvio.current) { clearInterval(reenvio.current.timer); reenvio.current = null; } setReenvioPendente(0); };
  const agendarReenvio = (final) => {
    if (reenvio.current) { reenvio.current.mapa = final; return; }
    reenvio.current = { mapa: final, timer: setInterval(async () => {
      setReenvioPendente((n) => n + 1);
      const enviar = io.enviarMapa || io.saveMapa;
      try {
        const gravado = await enviar(reenvio.current.mapa);
        pararReenvio();
        setMapa(gravado); setSalvo("Enviado e CONFIRMADO no servidor"); setEditando(false); setAvisos([]);
        setFichaMsg(null);
        await lancarFicha(gravado);
        if (io.atualizarKmMotoNoCadastro && !isDemo()) io.atualizarKmMotoNoCadastro(pid, gravado).catch(() => {});
        aplicarCorrecoesKm(gravado);
      } catch (e) { /* segue tentando enquanto a tela estiver aberta */ }
    }, 20000) };
  };
  useEffect(() => () => { if (reenvio.current) clearInterval(reenvio.current.timer); }, []);;
  // Falta/FT/Atraso → ficha do colaborador. Mostra QUEM recebeu o quê; se falhar, deixa o botão de tentar de novo (o mapa já está gravado).
  const lancarFicha = async (alvo) => {
    if (!io.lancarNaFicha) return;
    setFichaBusy(true);
    try {
      const r = await io.lancarNaFicha(alvo);
      const linhas = descricaoLancamentos(alvo);
      const semCadastro = r.ignorados > 0 ? ` ${r.ignorados} lançamento(s) não entraram: pessoa não encontrada no cadastro da Equipe.` : "";
      setFichaMsg({ ok: !r.ignorados, texto: resumoLancamento(r, alvo) + semCadastro, linhas: linhas.length ? [`Lançado na ficha: ${linhas.join(" · ")}`] : [], alvo });
    } catch (e) {
      setFichaMsg({ ok: false, erro: true, texto: `Mapa gravado, mas Falta/FT/Atraso NÃO entraram na ficha (${e.message || "erro"}).`, linhas: [], alvo });
    } finally { setFichaBusy(false); }
  };

  const editarMapa = () => { setEditando(true); setConfirmouResumo(false); setAvisos([]); setMapa((m) => garantirMoto(completarPostosFixos(m, colabs))); };
  const texto = mapa ? montarTextoWhatsApp(mapa, { nomeProjeto: project?.name || "", desligamentos: deslig }) : "";
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

  // Líder corrige o cadastro do equipamento (identificação/quantidade) sem sair do mapa. Função de render, não componente.
  const salvarCadastroItem = async () => {
    const q = soDigitos(eqEdit.qtd);
    const minimo = eqEdit.categoria === "municao" ? 0 : 1;
    if (eqEdit.identificacao.trim() === "") return setEqEdit((e) => ({ ...e, erro: "Informe a identificação do item." }));
    if (q === "" || Number(q) < minimo || Number(q) > 100000) return setEqEdit((e) => ({ ...e, erro: `Quantidade inválida (mínimo ${minimo}, só números).` }));
    setEqEdit((e) => ({ ...e, salvando: true, erro: "" }));
    try {
      const eq = await io.corrigirItemEquipamento(pid, eqEdit.id, { identificacao: eqEdit.identificacao, qtd: Number(q) });
      setItensMat(itensDeEquipamento(eq, pid, turno));
      setEqEdit({ ...eqEdit, salvando: false, ok: true });
      setTimeout(() => setEqEdit(null), 1500);
    } catch (e) { setEqEdit((x) => ({ ...x, salvando: false, erro: `Não salvou: ${(e && e.message) || "erro"}. Tente de novo.` })); }
  };
  const renderCorrigirCadastro = (it) => {
    if (!eqEdit || eqEdit.id !== it.id) return <button onClick={() => setEqEdit({ id: it.id, categoria: it.categoria, identificacao: it.identificacao || it.nome, qtd: it.qtd == null ? "" : String(it.qtd), erro: "" })} style={{ ...S.btn, marginTop: 6, fontSize: 11, padding: "4px 10px" }} aria-label={`Corrigir cadastro: ${it.nome}`}>✎ Corrigir cadastro</button>;
    return (
      <div style={{ marginTop: 6, padding: 8, border: `1px dashed ${cor.line}`, borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <input aria-label={`Identificação: ${it.nome}`} value={eqEdit.identificacao} onChange={(e) => setEqEdit((x) => ({ ...x, identificacao: e.target.value }))} style={S.in} />
        <input aria-label={`Quantidade no cadastro: ${it.nome}`} type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Quantidade (só números)" value={eqEdit.qtd} onChange={(e) => setEqEdit((x) => ({ ...x, qtd: soDigitos(e.target.value) }))} style={S.in} />
        {eqEdit.erro && <div role="alert" style={{ color: "#dc2626", fontSize: 12, fontWeight: 700 }}>{eqEdit.erro}</div>}
        {eqEdit.ok && <div role="status" style={{ color: "#16a34a", fontSize: 12, fontWeight: 700 }}>Cadastro de Equipamentos atualizado.</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={salvarCadastroItem} disabled={eqEdit.salvando} style={{ ...S.btn, background: "#16a34a", color: "#fff", border: "none" }}>{eqEdit.salvando ? "Salvando…" : "Salvar no cadastro"}</button>
          <button onClick={() => setEqEdit(null)} style={S.btn}>Cancelar</button>
        </div>
      </div>
    );
  };

  // Baixa do item no cadastro (trocado, extraviado, danificado, devolvido). "Substituído" já cadastra o item que entrou.
  const salvarBaixa = async (it) => {
    const erro = validarBaixa(baixaForm);
    if (erro) return setBaixaForm((f) => ({ ...f, erro }));
    const subst = baixaForm.motivo === "Substituído" ? String(baixaForm.substituto || "").trim() : "";
    const qtdSub = soDigitos(baixaForm.qtd) === "" ? 1 : Number(soDigitos(baixaForm.qtd));
    if (subst && (qtdSub < (it.categoria === "municao" ? 0 : 1) || qtdSub > 100000)) return setBaixaForm((f) => ({ ...f, erro: "Quantidade do item novo inválida." }));
    setBaixaForm((f) => ({ ...f, salvando: true, erro: "" }));
    try {
      let eq = await io.darBaixaItemEquipamento(pid, it.id, { motivo: baixaForm.motivo, obs: baixaForm.obs, por: quemPreenche() });
      let aviso = "";
      if (subst && io.adicionarItemEquipamento) {
        try { eq = await io.adicionarItemEquipamento(pid, it.categoria, { identificacao: subst, qtd: qtdSub }); }
        catch (e) { aviso = ` A baixa foi feita, mas o item novo NÃO foi cadastrado (${(e && e.message) || "erro"}): cadastre em Equipamentos.`; }
      }
      setItensMat(itensDeEquipamento(eq, pid, turno));
      alterar((m) => registrarBaixaNoMapa(m, it, { motivo: baixaForm.motivo, obs: baixaForm.obs, substituto: aviso ? "" : subst }, agoraFn()));
      setBaixaForm(null);
      setBaixaMsg(`${it.nome}: baixa registrada (${baixaForm.motivo}).${subst && !aviso ? ` ${subst} cadastrado no lugar.` : ""}${aviso}`);
    } catch (e) { setBaixaForm((f) => ({ ...f, salvando: false, erro: `Não deu baixa: ${(e && e.message) || "erro"}. Tente de novo.` })); }
  };
  const renderBaixa = (it) => {
    if (!baixaForm || baixaForm.id !== it.id) return <button onClick={() => { setEqEdit(null); setBaixaMsg(""); setBaixaForm({ id: it.id, motivo: "", obs: "", substituto: "", qtd: "1", erro: "" }); }} style={{ ...S.btn, marginTop: 6, marginLeft: 6, fontSize: 11, padding: "4px 10px" }} aria-label={`Dar baixa: ${it.nome}`}>⊘ Dar baixa (trocado, extraviado…)</button>;
    return (
      <div data-testid="baixa-item" style={{ marginTop: 6, padding: 8, border: `1px dashed #dc262688`, borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 12, color: cor.txt2 }}>O item sai do cadastro e da lista do mapa (fica no histórico de baixas do projeto, com o motivo).</div>
        <select aria-label={`Motivo da baixa: ${it.nome}`} value={baixaForm.motivo} onChange={(e) => setBaixaForm((f) => ({ ...f, motivo: e.target.value, erro: "" }))} style={S.in}>
          <option value="">Motivo…</option>
          {MOTIVOS_BAIXA.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input aria-label={`Observação da baixa: ${it.nome}`} placeholder={baixaForm.motivo === "Outro" ? "Descreva o motivo (obrigatório)" : "Observação (opcional)"} value={baixaForm.obs} onChange={(e) => setBaixaForm((f) => ({ ...f, obs: e.target.value }))} style={S.in} />
        {baixaForm.motivo === "Substituído" && <>
          <input aria-label={`Item que entrou no lugar de ${it.nome}`} placeholder={`Item que entrou no lugar (ex.: ${it.rotuloCategoria || "item"} tática 01)`} value={baixaForm.substituto} onChange={(e) => setBaixaForm((f) => ({ ...f, substituto: e.target.value }))} style={S.in} />
          {String(baixaForm.substituto || "").trim() && <input aria-label="Quantidade do item novo" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Quantidade" value={baixaForm.qtd} onChange={(e) => setBaixaForm((f) => ({ ...f, qtd: soDigitos(e.target.value) }))} style={S.in} />}
        </>}
        {baixaForm.erro && <div role="alert" style={{ color: "#dc2626", fontSize: 12, fontWeight: 700 }}>{baixaForm.erro}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => salvarBaixa(it)} disabled={baixaForm.salvando} style={{ ...S.btn, background: "#dc2626", color: "#fff", border: "none" }}>{baixaForm.salvando ? "Gravando…" : "Confirmar baixa"}</button>
          <button onClick={() => setBaixaForm(null)} style={S.btn}>Cancelar</button>
        </div>
      </div>
    );
  };

  // Quem está preenchendo (para o histórico das correções): o líder do posto de líder no mapa.
  const quemPreenche = () => ((mapa && mapa.postos) || []).find((p) => p.lider && (p.pessoaNome || "").trim())?.pessoaNome || "Líder do plantão";

  // Correção do km anterior (erro de digitação no plantão passado). Função de render, não componente.
  const renderCorrigirKm = (v) => {
    if (!kmForm || kmForm.veiculoId !== v.id) return <button onClick={() => setKmForm({ veiculoId: v.id, km: "", motivo: "", erros: [] })} style={{ ...S.btn, marginTop: 6, fontSize: 11, padding: "4px 10px" }} aria-label={`Corrigir km anterior ${v.rotulo || "Veículo"}`}>✎ Corrigir km anterior</button>;
    const salvar = () => {
      const r = corrigirKmAnterior(mapa, v.id, { km: kmForm.km, motivo: kmForm.motivo, por: quemPreenche(), agora: agoraFn() });
      if (r.erros.length) return setKmForm((f) => ({ ...f, erros: r.erros }));
      alterar(() => r.mapa);
      setKmForm(null);
    };
    return (
      <div data-testid="corrigir-km" style={{ marginTop: 6, padding: 8, border: `1px dashed ${cor.line}`, borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 12, color: cor.txt2 }}>Use só quando o km do plantão anterior foi lançado errado. Fica registrado quem corrigiu e o motivo; o plantão anterior recebe o km certo ao concluir.</div>
        <input aria-label={`Km anterior correto ${v.rotulo || "Veículo"}`} type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Km anterior correto (só números)" value={kmForm.km} onChange={(e) => setKmForm((f) => ({ ...f, km: soDigitos(e.target.value) }))} style={S.in} />
        <input aria-label="Motivo da correção do km" placeholder="Motivo (ex.: erro de digitação no plantão anterior)" value={kmForm.motivo} onChange={(e) => setKmForm((f) => ({ ...f, motivo: e.target.value }))} style={S.in} />
        {kmForm.erros.length > 0 && <div role="alert" style={{ color: "#dc2626", fontSize: 12, fontWeight: 700 }}>{kmForm.erros.map((e) => <div key={e}>{e}</div>)}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={salvar} style={{ ...S.btn, background: "#16a34a", color: "#fff", border: "none" }}>Salvar correção</button>
          <button onClick={() => setKmForm(null)} style={S.btn}>Cancelar</button>
        </div>
      </div>
    );
  };

  // Saída antecipada / substituição: função de render (não componente) para o teclado não cair a cada letra.
  const horaAgora = () => new Date(agoraFn().getTime() - 3 * 3600000).toISOString().slice(11, 16);
  const abrirSaida = () => { setSaidaErros([]); setSaidaForm({ postoId: "", motivo: "", outro: "", hora: horaAgora(), coberturas: [] }); };
  const alterarSaida = (patch) => setSaidaForm((f) => ({ ...f, ...patch }));
  const confirmarSaida = async () => {
    const r = registrarSaidaAntecipada(mapa, { ...saidaForm, agora: agoraFn() });
    setSaidaErros(r.erros);
    if (r.erros.length) return;
    setSaidaForm(null);
    await enviarComConfirmacao({ ...r.mapa, revisoes: [...(r.mapa.revisoes || []), { em: agoraFn().toISOString(), saidaAntecipada: true }] });
  };
  const renderSaida = () => {
    if (!saidaForm) return <button onClick={abrirSaida} style={{ ...S.btn, marginTop: 8 }}>Saída antecipada / substituição</button>;
    const comPessoa = (mapa.postos || []).filter((p) => p.pessoaId);
    const quem = comPessoa.find((p) => p.id === saidaForm.postoId);
    return (
      <div style={{ marginTop: 10, padding: 10, border: `1px solid ${cor.line}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }} data-testid="saida-antecipada">
        <div style={{ fontSize: 13, fontWeight: 800, color: cor.txt }}>Saída antecipada / substituição</div>
        <label style={S.lab}>1. Quem saiu
          <select aria-label="Quem saiu" value={saidaForm.postoId} onChange={(e) => alterarSaida({ postoId: e.target.value })} style={S.in}>
            <option value="">Escolha…</option>
            {comPessoa.map((p) => <option key={p.id} value={p.id}>{p.pessoaNome} — {p.rotulo}</option>)}
          </select></label>
        <label style={S.lab}>2. Motivo
          <select aria-label="Motivo da saída" value={saidaForm.motivo} onChange={(e) => alterarSaida({ motivo: e.target.value })} style={S.in}>
            <option value="">Escolha…</option>
            {MOTIVOS_SAIDA.map((m) => <option key={m} value={m}>{m}</option>)}
          </select></label>
        {saidaForm.motivo === "Outro" && <input aria-label="Descreva o motivo" placeholder="Descreva o motivo" value={saidaForm.outro} onChange={(e) => alterarSaida({ outro: e.target.value })} style={S.in} />}
        <label style={S.lab}>3. Horário da saída
          <input aria-label="Horário da saída" type="time" value={saidaForm.hora} onChange={(e) => alterarSaida({ hora: e.target.value })} style={S.in} /></label>
        <div style={S.lab}>4. Quem vai cobrir? (pode ser mais de uma pessoa, em partes do período)</div>
        {saidaForm.coberturas.map((c, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, border: `1px dashed ${cor.line}`, borderRadius: 8 }}>
            <select aria-label={`Tipo de cobertura ${i + 1}`} value={c.tipo} onChange={(e) => alterarSaida({ coberturas: saidaForm.coberturas.map((x, k) => (k === i ? { ...x, tipo: e.target.value } : x)) })} style={S.in}>
              <option value="">Tipo…</option>
              {TIPOS_COBERTURA.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
            </select>
            <select aria-label={`Quem cobre ${i + 1}`} value={c.pessoaId} onChange={(e) => { const col = colabs.find((x) => x.id === e.target.value); alterarSaida({ coberturas: saidaForm.coberturas.map((x, k) => (k === i ? { ...x, pessoaId: e.target.value, pessoaNome: col ? col.nome : "" } : x)) }); }} style={S.in}>
              <option value="">Quem cobre…</option>
              {colabs.filter((x) => !quem || x.id !== quem.pessoaId).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <input aria-label={`Entrada ${i + 1}`} type="time" value={c.de} onChange={(e) => alterarSaida({ coberturas: saidaForm.coberturas.map((x, k) => (k === i ? { ...x, de: e.target.value } : x)) })} style={S.in} />
              <input aria-label={`Até ${i + 1}`} type="time" value={c.ate} onChange={(e) => alterarSaida({ coberturas: saidaForm.coberturas.map((x, k) => (k === i ? { ...x, ate: e.target.value } : x)) })} style={S.in} />
              <button onClick={() => alterarSaida({ coberturas: saidaForm.coberturas.filter((_, k) => k !== i) })} style={S.btn} aria-label={`Remover cobertura ${i + 1}`}>×</button>
            </div>
          </div>
        ))}
        <button onClick={() => alterarSaida({ coberturas: [...saidaForm.coberturas, { tipo: "", pessoaId: "", pessoaNome: "", de: saidaForm.hora, ate: "" }] })} style={S.btn}>+ Quem cobre</button>
        {saidaErros.length > 0 && <div role="alert" style={{ color: "#dc2626", fontSize: 12, fontWeight: 700 }}>{saidaErros.map((e) => <div key={e}>{e}</div>)}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={confirmarSaida} disabled={enviando} style={{ ...S.btn, background: "#16a34a", color: "#fff", border: "none" }}>{enviando ? "Gravando e confirmando…" : "Confirmar saída"}</button>
          <button onClick={() => { setSaidaForm(null); setSaidaErros([]); }} style={S.btn}>Cancelar</button>
        </div>
      </div>
    );
  };

  const opcoesPessoa = () => (
    <>
      <option value="">Escolher…</option>
      {colabs.map((c) => <option key={c.id} value={c.id}>{nomeCurto(c)}{c.cargo ? ` · ${c.cargo}` : ""}{c.emFerias ? " (férias)" : ""}</option>)}
      <option value="__outro">Outro (digitar nome)</option>
    </>
  );
  const corSituacao = (p) => {
    if (p.situacao === "presente") return (p.pessoaId || (p.pessoaNome || "").trim()) ? { color: "#16a34a", borderColor: "#16a34a", fontWeight: 800 } : { color: cor.txt2, borderColor: cor.line };
    const c = p.situacao === "falta" ? "#dc2626" : cor.ac;
    return { color: c, borderColor: c, fontWeight: 800 };
  };
  // Troca a situação do posto. FT: se só uma pessoa da equipe do líder ficou fora do mapa, ela é "quem faltou" (automático).
  const marcarSituacao = (p, nova) => alterar((m) => {
    let n = mudarSituacao(m, p.id, nova);
    if (nova === "ft" && p.situacao !== "ft") {
      const aus = ausentesDaEquipe(n, colabs).filter((c) => c.id !== p.pessoaId);
      if (aus.length === 1) n = vincularFalta(n, p.id, `c:${aus[0].id}`, colabs);
    }
    return n;
  });
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
            <CampoData aria-label="Data do mapa" value={data} onChange={(v)=> v && setData(v)} style={{ ...S.in, width: "auto" }} />
            {["D", "N"].map((t) => <button key={t} onClick={() => setTurno(t)} aria-pressed={turno === t} style={S.chip(turno === t)}>{t === "D" ? "Diurno" : "Noturno"}</button>)}
          </div>
          <div style={{ fontSize: 12, color: cor.txt2, marginTop: 8 }}>
            {rotuloDia(data)}, {dataBR(data)} · {rotuloTurno(turno, horario)}
          </div>
          {foraDoVigente && (
            <div role="alert" style={{ marginTop: 8, background: "#78350f22", border: "1.5px solid #f59e0b88", borderRadius: 10, padding: "8px 10px", fontSize: 12, color: "#fbbf24", fontWeight: 700 }}>
              Atenção: este mapa é de {rotuloPlantao(data, turno)}. O plantão em vigor é {rotuloPlantao(vigente.data, vigente.turno)}.
              <button onClick={() => { setData(vigente.data); setTurno(vigente.turno); }} style={{ display: "block", marginTop: 6, background: "#f59e0b", border: "none", borderRadius: 8, color: "#1a1203", fontWeight: 800, padding: "7px 10px", cursor: "pointer", fontSize: 12 }}>Ir para o plantão em vigor</button>
            </div>
          )}
          {prazo && (
            <div style={{ fontSize: 12, fontWeight: 800, marginTop: 6, color: prazo === "enviado" ? "#16a34a" : prazo === "pendente" ? "#dc2626" : prazo === "cobranca" ? "#f59e0b" : cor.txt2 }}>
              {prazo === "enviado" ? "Mapa enviado" : prazo === "cobranca" ? "Enviar agora: a equipe já assumiu" : prazo === "pendente" ? "Mapa pendente" : "Aguardando a equipe assumir"}
            </div>
          )}
        </div>

        {isDemo() && (
          <div role="alert" style={{ ...S.card, borderColor: "#dc2626", color: "#dc2626", fontSize: 13, fontWeight: 700 }}>
            Sessão de DEMONSTRAÇÃO: nada é gravado no banco. O mapa vai parecer concluído neste aparelho, mas o painel gerencial continuará "Pendente". Para valer, saia e entre com o PIN do projeto.
          </div>
        )}
        {carregando && <div style={{ ...S.card, color: cor.txt2, fontSize: 13 }}>Abrindo o mapa…</div>}
        {erro && <div role="alert" style={{ ...S.card, color: "#dc2626", fontSize: 13 }}>{erro}</div>}

        {mapa && !carregando && (<>
          <fieldset disabled={!!enviado && !editando} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {avisoReaberto && <div role="status" style={{ ...S.card, borderColor: cor.ac, fontSize: 13, color: cor.txt, fontWeight: 600 }}>⚠ {avisoReaberto}</div>}
          {deslig.length > 0 && <div role="status" style={{ ...S.card, borderColor: "#dc2626" }}><div style={{ ...S.h, color: "#dc2626" }}>🚪 Funcionário desligado (últimas 24h)</div>{deslig.map((d) => <div key={d.id + d.em} style={{ fontSize: 13, color: cor.txt }}>• {linhaDesligamento(d)}</div>)}</div>}
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
                  <button aria-label={`Exceção do posto ${p.rotulo}`} aria-expanded={p.situacao !== "presente" || !!abertos[p.id]} onClick={() => setAbertos((a) => ({ ...a, [p.id]: !a[p.id] }))} style={{ ...S.btn, padding: "6px 9px", ...corSituacao(p) }}>{p.situacao === "presente" ? ((p.pessoaId || (p.pessoaNome || "").trim()) ? "✓ Presente" : "Exceção") : ROTULO_SITUACAO[p.situacao]}</button>
                  {ehPostoExtra(mapa, p) && <button aria-label={`Remover posto ${p.rotulo}`} onClick={() => alterar((m) => removerPosto(m, p.id))} style={{ ...S.btn, padding: "6px 9px" }}>×</button>}
                </div>
                {(() => {
                  const f = foraDaEquipe(mapa, p, colabs);
                  if (!f || ignorados[`${p.id}:${p.pessoaId}`]) return null;
                  return (
                    <div role="status" style={{ marginTop: 8, border: `1px solid ${cor.ac}`, borderRadius: 10, padding: "8px 10px", fontSize: 12, color: cor.txt }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠ {f.pessoa.nome} não é da equipe de {f.lider.nome}. É FT, cobertura ou troca?</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => marcarSituacao(p, "ft")} style={S.chip(false, cor.ac)}>É FT</button>
                        <button onClick={() => marcarSituacao(p, "cobertura")} style={S.chip(false, cor.ac)}>É cobertura</button>
                        <button onClick={() => marcarSituacao(p, "troca")} style={S.chip(false, cor.ac)}>É troca</button>
                        <button onClick={() => setIgnorados((x) => ({ ...x, [`${p.id}:${p.pessoaId}`]: true }))} style={S.chip(false, cor.txt2)}>É da equipe</button>
                      </div>
                    </div>
                  );
                })()}
                {(() => { const c = colabs.find((x) => x.id === p.pessoaId); return c && c.afastamento && p.situacao !== "falta" ? <div role="status" style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, marginTop: 4 }}>⚠ {c.afastamento.rotulo}. Confirme se já retornou.</div> : null; })()}
                {(p.situacao !== "presente" || abertos[p.id]) && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {SITUACOES.map((s) => (
                    <button key={s.id} aria-pressed={p.situacao === s.id} onClick={() => marcarSituacao(p, s.id)} style={S.chip(p.situacao === s.id, s.id === "presente" ? "#16a34a" : s.id === "falta" ? "#dc2626" : cor.ac)}>{s.rotulo}</button>
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
                    <select aria-label="Cobertura de quem" value={p.detalhe?.deQuemId || (colabs.find((c) => c.nome === p.detalhe?.deQuem) || {}).id || ""} onChange={(e) => alterar((m) => definirCobertoDe(m, p.id, colabs.find((c) => c.id === e.target.value) || null))} style={S.in}>
                      <option value="">Escolher…</option>
                      {colabs.map((c) => <option key={c.id} value={c.id}>{nomeCurto(c)}{c.emFerias ? " (férias)" : ""}</option>)}
                    </select>
                    {p.detalhe?.deQuem && (
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: cor.txt2, marginTop: 8 }}>
                        <input type="checkbox" checked={!!p.detalhe?.semFalta} onChange={(e) => alterar((m) => marcarCoberturaSemFalta(m, p.id, e.target.checked))} /> Não foi falta (férias, atestado, folga…)
                      </label>
                    )}
                    {p.detalhe?.deQuem && (
                      <div style={{ fontSize: 11, color: p.detalhe?.semFalta ? cor.txt2 : "#dc2626", fontWeight: 700, marginTop: 4 }}>
                        {p.detalhe?.semFalta ? `Nada será lançado na ficha de ${p.detalhe.deQuem}.` : `Ao concluir, a FALTA de ${p.detalhe.deQuem} (${data.split("-").reverse().join("/")}) é lançada na ficha dela(e) automaticamente. Quem cobre não recebe FT.`}
                      </div>
                    )}
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: cor.txt2, marginTop: 8 }}>
                      <input type="checkbox" checked={!!p.detalhe?.base} onChange={(e) => setPosto(p.id, { detalhe: { ...p.detalhe, base: e.target.checked, livre: e.target.checked }, pessoaId: "", pessoaNome: "" })} /> Quem cobre é da Base (digitar o nome)
                    </label>
                  </div>
                )}
                {p.situacao === "ft" && (() => {
                  const cand = candidatosAFalta(mapa, p.id);
                  const idsNoMapa = new Set(cand.map((x) => x.pessoaId).filter(Boolean));
                  const aus = ausentesDaEquipe(mapa, colabs).filter((c) => c.id !== p.pessoaId);
                  const idsAus = new Set(aus.map((c) => c.id));
                  const outros = colabs.filter((c) => c.id !== p.pessoaId && !(mapa.postos || []).some((x) => x.pessoaId === c.id) && !idsNoMapa.has(c.id) && !idsAus.has(c.id));
                  const valor = p.detalhe?.postoVago ? "__vago" : p.detalhe?.semFalta ? "__ninguem" : p.detalhe?.faltaPostoId ? `p:${p.detalhe.faltaPostoId}` : p.detalhe?.quemFaltouId ? `c:${p.detalhe.quemFaltouId}` : "";
                  return (
                    <div>
                      <div style={S.lab}>Quem faltou?</div>
                      <select aria-label="Quem faltou (FT)" value={valor} onChange={(e) => alterar((m) => vincularFalta(m, p.id, e.target.value, colabs))} style={S.in}>
                        <option value="">Escolher quem faltou…</option>
                        <option value="__ninguem">Ninguém faltou (não teve falta)</option>
                        <option value="__vago">POSTO VAGO (sem titular, não é falta)</option>
                        {aus.length > 0 && <optgroup label="Da equipe, fora do mapa">{aus.map((c) => <option key={c.id} value={`c:${c.id}`}>{nomeCurto(c)}</option>)}</optgroup>}
                        <optgroup label="Efetivo do mapa">
                          {cand.map((x) => <option key={x.id} value={`p:${x.id}`}>{x.pessoaNome || "Sem nome"} — {x.rotulo}</option>)}
                        </optgroup>
                        {outros.length > 0 && <optgroup label="Outros do projeto">{outros.map((c) => <option key={c.id} value={`c:${c.id}`}>{nomeCurto(c)}</option>)}</optgroup>}
                      </select>
                      {p.detalhe?.quemFaltou && <div style={{ fontSize: 11, color: cor.txt2, marginTop: 4 }}>{p.detalhe.faltaPostoId ? "O posto dele passa a Falta. " : ""}A falta vai para a ficha de {p.detalhe.quemFaltou} e a FT para a ficha de {p.pessoaNome || "quem está no posto extra"}.</div>}
                    </div>
                  );
                })()}
                {p.situacao === "troca" && (
                  <div>
                    <div style={S.lab}>No lugar de quem?</div>
                    {seletorPessoa("Troca no lugar de quem", p.detalhe?.noLugarDe, (n) => setDetalhe(p.id, { noLugarDe: n }))}
                  </div>
                )}
                {(() => {
                  const quem = p.situacao === "falta" ? p.pessoaNome : p.situacao === "cobertura" && !p.detalhe?.semFalta ? p.detalhe?.deQuem : p.situacao === "ft" ? p.detalhe?.quemFaltou : "";
                  if (!quem) return null;
                  const sim = !!p.detalhe?.afastamentoSim;
                  return (
                    <div style={{ marginTop: 8, padding: 8, border: `1px solid ${cor.line}`, borderRadius: 8 }}>
                      <div style={S.lab}>{quem}: afastamento por mais de um plantão (ex.: atestado)?</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <button aria-pressed={!sim} onClick={() => setDetalhe(p.id, { afastamentoSim: false, afastamentoPlantoes: undefined })} style={S.chip(!sim, cor.ac)}>Não, só esta falta</button>
                        <button aria-pressed={sim} onClick={() => setDetalhe(p.id, { afastamentoSim: true })} style={S.chip(sim, "#dc2626")}>Sim, afastado</button>
                        {sim && <input type="text" inputMode="numeric" aria-label={`Quantos plantões de afastamento de ${quem}`} placeholder="Qtd. de plantões" value={p.detalhe?.afastamentoPlantoes ?? ""} onChange={(e) => setDetalhe(p.id, { afastamentoPlantoes: e.target.value.replace(/\D/g, "").slice(0, 2) })} style={{ ...S.in, width: 130 }} />}
                      </div>
                      {sim && <div style={{ fontSize: 11, color: cor.txt2, marginTop: 4 }}>{`Informe de 2 a ${MAX_PLANTOES_AFASTAMENTO} plantões. Fica na ficha, no texto do WhatsApp e serve de prévia do retorno.`}</div>}
                    </div>
                  );
                })()}
                {p.situacao !== "presente" && (
                  <input aria-label={`Observação do posto ${p.rotulo}`} placeholder="Observação (opcional, sem motivo de saúde)" value={p.obs || ""} onChange={(e) => setPosto(p.id, { obs: e.target.value })} style={{ ...S.in, marginTop: 8 }} />
                )}
              </div>
            ))}
            <button onClick={() => { const novo = postoVazio("Posto extra"); setAbertos((a) => ({ ...a, [novo.id]: true })); alterar((m) => ({ ...m, postos: [...m.postos, novo] })); }} style={{ ...S.btn, marginTop: 6 }}>+ Posto extra</button>
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
                    {baixaMsg && <div role="status" style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginBottom: 8 }}>{baixaMsg}</div>}
                    {(mat.baixas || []).map((b) => <div key={b.id} style={{ fontSize: 12, color: cor.txt2, marginBottom: 4 }}>🔻 {rotuloBaixa(b)}</div>)}
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
                              {it.cadastro != null && io.corrigirItemEquipamento && renderCorrigirCadastro(it)}
                              {it.origem !== "base" && io.darBaixaItemEquipamento && renderBaixa(it)}
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
              <div key={v.id || i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}><div style={S.lab}>{v.rotulo || "Veículo"}{v.placa ? ` ${v.placa}` : ""} · anterior {v.kmAnterior ?? "—"}{v.correcaoKm ? " (corrigido)" : ""}{ehMoto(v) && projetoComMoto(pid) ? " · obrigatório" : ""}</div>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-label={`Km atual ${v.rotulo}`} placeholder="Km atual (só números)" value={v.kmAtual ?? ""} onChange={(e) => { const dig = soDigitos(e.target.value); alterar((m) => ({ ...m, veiculos: m.veiculos.map((x, k) => (k === i ? { ...x, kmAtual: dig } : x)) })); }} style={{ ...S.in, ...(kmRodado(v) != null && kmRodado(v) < 0 ? { borderColor: "#dc2626" } : {}) }} />
                  </div>
                  <div style={{ fontSize: 12, color: cor.txt2, minWidth: 70 }}>{kmRodado(v) != null ? `rodou ${kmRodado(v)} km` : ""}</div>
                </div>
                {v.trocaMoto && <div role="status" style={{ fontSize: 12, color: cor.ac, fontWeight: 700, marginTop: 4 }}>Moto substituída{v.trocaMoto.em ? ` em ${dataBR(String(v.trocaMoto.em).slice(0, 10))}` : ""}{v.trocaMoto.placaAnterior ? ` (antes ${v.trocaMoto.placaAnterior})` : ""}: o km anterior é o km inicial da moto nova.</div>}
                {kmRodado(v) != null && kmRodado(v) < 0 && <div role="alert" style={{ fontSize: 12, color: "#dc2626", fontWeight: 700, marginTop: 4 }}>Menor que o anterior ({v.kmAnterior}). Confira o odômetro. Se o km anterior foi digitado errado no plantão passado, toque em "Corrigir km anterior".</div>}
                {v.correcaoKm && <div role="status" style={{ fontSize: 12, color: cor.txt2, marginTop: 4 }}>Km anterior {rotuloCorrecaoKm(v)}. <button onClick={() => alterar((m) => desfazerCorrecaoKm(m, v.id))} style={{ ...S.btn, padding: "3px 8px", fontSize: 11 }}>Desfazer correção</button></div>}
                {renderCorrigirKm(v)}
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
            <div style={S.lab}>Houve visita da supervisão neste turno? (obrigatório)</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button aria-pressed={mapa.visita?.houve === true} onClick={() => alterar((m) => ({ ...m, visita: { ...(m.visita || {}), houve: true } }))} style={S.chip(mapa.visita?.houve === true, "#16a34a")}>Sim, houve visita</button>
              <button aria-pressed={mapa.visita?.houve === false} onClick={() => alterar((m) => ({ ...m, visita: { houve: false, supervisor: "" } }))} style={S.chip(mapa.visita?.houve === false, "#16a34a")}>Não houve</button>
            </div>
            {mapa.visita?.houve === true && <input aria-label="Quem visitou" placeholder="Nome de quem visitou" value={mapa.visita?.supervisor || ""} onChange={(e) => alterar((m) => ({ ...m, visita: { ...(m.visita || {}), houve: true, supervisor: e.target.value } }))} style={{ ...S.in, marginTop: 8 }} />}
          </div>

          <div style={S.card}>
            <div style={S.h}>Resumo da passagem (obrigatório)</div>
            <textarea aria-label="Resumo da passagem" rows={3} placeholder='Preleção, ocorrências, pendências para o próximo turno. Se não houve nada, escreva: Sem alteração' value={mapa.resumo} onChange={(e) => { setConfirmouResumo(false); alterar((m) => ({ ...m, resumo: e.target.value })); }} style={S.in} />
          </div>

          </fieldset>

          {avisos.length > 0 && <div role="alert" style={{ ...S.card, borderColor: "#dc2626" }}>{avisos.map((a, i) => <div key={i} style={{ fontSize: 13, color: "#dc2626", marginBottom: 4 }}>{a}</div>)}</div>}

          {(!enviado || editando) && <button onClick={concluir} disabled={enviando} style={{ background: enviando ? "#78716c" : "linear-gradient(135deg,#f59e0b,#d97706)", color: "#111", border: "none", borderRadius: 14, padding: "15px 16px", fontSize: 15, fontWeight: 900, cursor: enviando ? "wait" : "pointer" }}>{enviando ? "Gravando e confirmando no servidor…" : "Concluir mapa"}</button>}
          {reenvioPendente > 0 && <div role="status" style={{ ...S.card, borderColor: "#f59e0b", color: "#b45309", fontSize: 13, fontWeight: 700 }}>Tentando enviar automaticamente… (tentativa {reenvioPendente}). O WhatsApp libera assim que o servidor confirmar.</div>}

          {enviado && (
            <div style={{ ...S.card, borderColor: "#16a34a" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: isDemo() ? "#dc2626" : "#16a34a", marginBottom: 8 }}>{editando ? "Mapa em edição." : isDemo() ? "DEMONSTRAÇÃO: o mapa NÃO foi gravado no banco." : "Mapa confirmado no servidor. Agora envie no WhatsApp."}</div>
              {fichaMsg && <div role="status" style={{ fontSize: 12, color: fichaMsg.ok ? cor.txt2 : "#f59e0b", marginBottom: 8 }}>{fichaMsg.texto}{(fichaMsg.linhas || []).map((l, i) => <div key={i} style={{ marginTop: 3 }}>{l}</div>)}{fichaMsg.erro && <div style={{ marginTop: 6 }}><button disabled={fichaBusy} onClick={() => lancarFicha(fichaMsg.alvo)} style={S.btn}>{fichaBusy ? "Lançando…" : "Lançar na ficha de novo"}</button></div>}</div>}
              {!editando && <>
              <pre aria-label="Texto do mapa" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12.5, color: cor.txt, background: cor.input, border: `1px solid ${cor.line}`, borderRadius: 10, padding: 10, margin: "0 0 10px" }}>{texto}</pre>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={linkWhatsApp(texto)} target="_blank" rel="noreferrer" style={{ ...S.btn, background: "#16a34a", color: "#fff", border: "none", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Abrir WhatsApp</a>
                <button onClick={copiar} style={S.btn}>{copiado ? "Copiado" : "Copiar texto"}</button>
              </div>
              </>}
              {!editando && <>
                <div style={{ fontSize: 11, color: cor.txt2, marginTop: 8 }}>Mapa arquivado: material, km, supervisão e resumo ficam travados. Se alguém precisou sair no meio do plantão, aponte aqui e diga quem cobriu; fica registrado.</div>
                {renderSaida()}
              </>}
              {editando && <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 8 }}>Editando o mapa enviado. O WhatsApp só volta depois que você tocar em Concluir mapa e o app confirmar que gravou.</div>}
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
