// Barra "Mapa de Equipe diário" em Registros (só gerencial).
// Mostra "n de N" do turno em vigor e faz brilhar quem ainda não enviou.
// Somente leitura (equipes/{pid}/mapas/{id}): não grava nada. Se a leitura falhar, diz que não leu — nunca mostra "0 de 12" no escuro.
import { useEffect, useState } from "react";
import { Ico } from "../Icones";
import { resumoDoPainel, turnoVigente, PROJETOS_DO_MAPA } from "./painel";
import { chaveMapa } from "./regras";
import { loadEnviosDoTurno } from "./dados";
import { MAPA_DIARIO_ATIVO } from "./ativo";
import ConsolidadoMapas from "./ConsolidadoMapas";
import VerMapasProjeto from "./VerMapasProjeto";

const COR = { enviado: "#16a34a", aguardando: "#64748b", cobranca: "#f59e0b", pendente: "#dc2626", "sem-horario": "#64748b" };
const ROTULO = { enviado: "Enviado", aguardando: "Aguardando", cobranca: "Enviar agora", pendente: "Pendente", "sem-horario": "Sem horário" };
const hhmm = (d) => d ? new Date(d.getTime() - 3 * 3600000).toISOString().slice(11, 16) : "";

export function PainelMapasView({ resumo, erro, carregando, dark, nomeProj = (p) => p, aberto, onToggle, emImplantacao = false, extra = null }) {
  const txt = dark ? "#f1f5f9" : "#0f172a";
  const txt2 = dark ? "#64748b" : "#94a3b8";
  const [ver, setVer] = useState(null); // projeto aberto na cascata do "Ver"
  const brilha = !emImplantacao && !!resumo?.brilha && !erro;
  const cor = erro || emImplantacao ? "#64748b" : brilha ? (resumo.pendentes.length ? "#dc2626" : "#f59e0b") : "#16a34a";
  return (
    <div style={{ background: dark ? "linear-gradient(135deg,#07101f,#060c18)" : "#ffffff", border: `2px solid ${brilha ? cor : dark ? "#334155" : "#e2e8f0"}`, borderRadius: 16, padding: "12px 16px",
      animation: brilha ? "mkMapaBrilho 1.4s ease-in-out infinite" : "none" }} data-testid="painel-mapas">
      <style>{`@keyframes mkMapaBrilho{0%,100%{box-shadow:0 0 0 0 ${cor}00}50%{box-shadow:0 0 14px 2px ${cor}88}}`}</style>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} role="button" aria-expanded={!!aberto}>
        <div style={{ fontSize: 20, color: txt2, display: "flex" }}><Ico n="prancheta" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: txt }}>Mapa de Equipe diário</div>
          <div style={{ fontSize: 11, color: txt2 }}>{emImplantacao ? "Em implantação: ainda sem envio de mapas" : erro ? "Não consegui ler os mapas agora" : carregando ? "Lendo…" : brilha ? "Há projeto sem mapa enviado" : "Turno em vigor"}</div>
        </div>
        {!emImplantacao && !carregando && !erro && resumo && (
          <span style={{ fontSize: 15, fontWeight: 900, color: cor, background: cor + "1c", border: `1px solid ${cor}55`, borderRadius: 8, padding: "3px 10px" }}>
            {resumo.enviados} de {resumo.total}
          </span>
        )}
        <span style={{ color: txt2, fontSize: 18 }}>{aberto ? "⌄" : "›"}</span>
      </div>
      {aberto && resumo && !erro && !emImplantacao && (
        <div style={{ marginTop: 10 }}>
          {resumo.itens.map((i) => {
            const podeVer = !!i.data && (i.turno === "D" || i.turno === "N");
            const comOcorrencia = i.estado === "enviado" && i.ocorrencias > 0;   // verde = completo; amarelo = tem FT/falta/atraso/troca
            const corItem = comOcorrencia ? "#eab308" : COR[i.estado];
            const aberta = ver === i.projetoId;
            return (
              <div key={i.projetoId} style={{ borderTop: `1px solid ${dark ? "#0f172a" : "#eef2f7"}` }}>
                <div onClick={podeVer ? () => setVer(aberta ? null : i.projetoId) : undefined} role={podeVer ? "button" : undefined} aria-expanded={podeVer ? aberta : undefined}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0", cursor: podeVer ? "pointer" : "default" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: corItem, flexShrink: 0, animation: i.brilha ? "mkMapaBrilho 1.4s ease-in-out infinite" : "none" }} />
                  <div style={{ flex: 1, fontSize: 12.5, color: txt, fontWeight: 700 }}>{nomeProj(i.projetoId)}</div>
                  <span style={{ fontSize: 11, color: txt2 }}>{i.turno === "N" ? "Noturno" : i.turno === "D" ? "Diurno" : ""}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: corItem }}>{ROTULO[i.estado]}{i.enviadoEm ? ` ${hhmm(i.enviadoEm)}` : ""}{comOcorrencia ? ` · ${i.ocorrencias} ocorrência${i.ocorrencias > 1 ? "s" : ""}` : ""}</span>
                  {podeVer && <span style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", border: "1px solid #7c3aed66", borderRadius: 6, padding: "1px 7px" }}>Ver {aberta ? "⌄" : "›"}</span>}
                </div>
                {aberta && podeVer && <VerMapasProjeto projetoId={i.projetoId} data={i.data} turno={i.turno} dark={dark} />}
              </div>
            );
          })}
        </div>
      )}
      {aberto && !emImplantacao && extra}
    </div>
  );
}

export default function PainelMapasEquipe({ dark, nomeProj, ativo = MAPA_DIARIO_ATIVO }) {
  const [agora, setAgora] = useState(() => new Date());
  const [mapas, setMapas] = useState([]);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);

  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!ativo) return undefined; // em implantação: não lê o banco
    let vivo = true;
    const ler = async () => {
      try {
        const agora = new Date();
        const itens = PROJETOS_DO_MAPA.map((projetoId) => {
          const v = turnoVigente(projetoId, agora);
          return v ? { projetoId, data: v.data, turno: v.turno, chave: chaveMapa(projetoId, v.data, v.turno) } : null;
        }).filter(Boolean);
        const lidos = await loadEnviosDoTurno(itens);
        if (!vivo) return;
        setMapas(lidos);
        setErro(false);
      } catch (e) { if (vivo) setErro(true); }
      finally { if (vivo) setCarregando(false); }
    };
    ler();
    const t = setInterval(ler, 60000);
    return () => { vivo = false; clearInterval(t); };
  }, [ativo]);

  const resumo = resumoDoPainel({ agora, mapas });
  return <PainelMapasView emImplantacao={!ativo} resumo={resumo} erro={erro} carregando={carregando && ativo} dark={dark} nomeProj={nomeProj} aberto={aberto} onToggle={() => setAberto((a) => !a)} extra={<ConsolidadoMapas dark={dark} nomeProj={nomeProj} />} />;
}
