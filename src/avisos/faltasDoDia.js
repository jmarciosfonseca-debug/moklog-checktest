// Falta no posto, de cara no painel: por projeto, quantas faltas e postos vagos há nos plantões da janela de avisos (24 h).
// Mesma fonte e mesma regra do Painel de Avisos (ocorrenciasDoMapa): resolveu ou passou do dia, some sozinho. Nada é gravado.
import { useEffect, useMemo, useState } from "react";
import { plantoesDoAviso } from "./regras";
import { AVISOS_CFG } from "./config";
import { assinarFontes } from "./fontes";
import { ocorrenciasDoMapa } from "../mapaDiario/consolidado";

export function contarFaltasDoMapa(mapa, ctx = {}) {
  if (!mapa) return { faltas: 0, vagos: 0 };
  const faltas = ocorrenciasDoMapa({ ...mapa, ...ctx }).filter((l) => l.tipo === "falta").length;
  const vagos = (mapa.postos || []).filter((x) => x && x.situacao === "vago").length;
  return { faltas, vagos };
}

// mapas: { [pid]: { [chaveDoMapa]: mapa|null } } (formato da fonte "mapas" do Painel de Avisos).
export function faltasPorProjeto({ agora, mapas = {}, cfg = AVISOS_CFG }) {
  const out = {};
  for (const pid of Object.keys(mapas || {})) {
    const lidos = mapas[pid];
    if (!lidos) continue;
    for (const p of plantoesDoAviso(pid, agora, cfg.plantoes, cfg.janelaPessoasH)) {
      const { faltas, vagos } = contarFaltasDoMapa(lidos[p.chave], { projetoId: pid, data: p.data, turno: p.turno });
      if (!faltas && !vagos) continue;
      const r = out[pid] || (out[pid] = { faltas: 0, vagos: 0, plantoes: [] });
      r.faltas += faltas; r.vagos += vagos;
      r.plantoes.push({ data: p.data, turno: p.turno, faltas, vagos });
    }
  }
  return out;
}

export function somarFaltas(porProjeto = {}, pids = []) {
  return pids.reduce((a, pid) => { const r = porProjeto[pid]; return r ? { faltas: a.faltas + r.faltas, vagos: a.vagos + r.vagos } : a; }, { faltas: 0, vagos: 0 });
}

export function textoFalta(info) {
  if (!info) return "";
  const p = [];
  if (info.faltas) p.push(`${info.faltas} ${info.faltas === 1 ? "falta" : "faltas"}`);
  if (info.vagos) p.push(`${info.vagos} ${info.vagos === 1 ? "posto vago" : "postos vagos"}`);
  return p.join(" · ");
}

const dm = (iso) => String(iso || "").split("-").reverse().slice(0, 2).join("/");
export function textoPlantao(info) {
  const p = info && info.plantoes && info.plantoes[0];
  return p ? `${p.turno === "N" ? "noturno" : "diurno"} ${dm(p.data)}` : "";
}

// Exemplo do modo demonstração (nenhum dado real).
export const faltasDemo = (agora = new Date()) => {
  const hoje = new Date(agora.getTime() - 3 * 3600000).toISOString().slice(0, 10);
  return { P601: { faltas: 1, vagos: 0, plantoes: [{ data: hoje, turno: "D", faltas: 1, vagos: 0 }] } };
};

export function useFaltasDoDia({ ativo, demo = false, assinar = assinarFontes }) {
  const [mapas, setMapas] = useState({});
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    if (!ativo || demo) { setMapas({}); return undefined; }
    let h = null;
    try {
      h = assinar({ projetos: [], gerencial: true, apenasMapas: true, onDados: (fonte, pid, v) => { if (fonte === "mapas") setMapas((m) => ({ ...m, [pid]: v })); }, onErro: () => {} });
    } catch (e) { /* sem leitura: fica sem selo, nunca falta falsa */ }
    const t = setInterval(() => setAgora(new Date()), 60000);
    return () => { clearInterval(t); if (h) h.parar(); };
  }, [ativo, demo, assinar]);
  return useMemo(() => (!ativo ? {} : demo ? faltasDemo(agora) : faltasPorProjeto({ agora, mapas })), [ativo, demo, agora, mapas]);
}
