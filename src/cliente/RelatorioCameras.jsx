// "Quais câmeras?" — o cliente toca na gravação do CFTV e abre o próprio relatório câmera por câmera (Marcio, 16/11/2026).
// É o mesmo "CFTV — Tempo de Gravação" da CCO, sem o nome de quem checou (dado de colaborador não vai para o cliente).
// As câmeras são lidas ao montar: assim o toque abre a aba na hora, sem o navegador bloquear.
import { useEffect, useState } from "react";
import { getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { montarRelatorioGravacao } from "../relatorios/gravacaoRelatorio";
import { abrirParaImpressao } from "../relatorios/padraoMoked";

export async function lerCamerasDaCCO(pid) {
  const app = getApps()[0];
  if (!app) return [];
  const s = await getDoc(doc(getFirestore(app), "cftv_gravacao", pid));
  return s.exists() && Array.isArray(s.data().cameras) ? s.data().cameras : [];
}

// Versão do cliente: mesmas câmeras e dias, sem identificar o colaborador que fez a checagem.
export const camerasParaCliente = (cameras) => (cameras || []).filter((c) => c && typeof c === "object").map(({ checadoPor, ...c }) => c);

export function abrirRelatorioCameras({ pid, nome }, cameras, { abrir = abrirParaImpressao, hoje = new Date() } = {}) {
  const { html } = montarRelatorioGravacao({ id: pid, name: nome }, camerasParaCliente(cameras), { hoje });
  return abrir(html, `cftv_gravacao_${pid}_${hoje.toLocaleDateString("pt-BR").replace(/\//g, "-")}.html`, { autoPrint: false });
}

export default function BotaoRelatorioCameras({ pid, nome, estilo, ler = lerCamerasDaCCO, abrir }) {
  const [cameras, setCameras] = useState(undefined); // undefined = lendo
  useEffect(() => {
    let vivo = true;
    setCameras(undefined);
    Promise.resolve().then(() => ler(pid)).then((c) => { if (vivo) setCameras(Array.isArray(c) ? c : []); }).catch(() => { if (vivo) setCameras([]); });
    return () => { vivo = false; };
  }, [pid, ler]);
  if (!cameras || cameras.length === 0) return null; // CCO sem câmeras registradas: não oferece relatório vazio
  return (
    <button data-testid="abrir-relatorio-cameras" aria-label="Ver quais câmeras: abrir o relatório de tempo de gravação" onClick={() => abrirRelatorioCameras({ pid, nome }, cameras, abrir ? { abrir } : {})}
      style={{ background: "transparent", border: "1px solid currentColor", color: "inherit", borderRadius: 999, padding: "6px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer", minHeight: 32, ...estilo }}>
      Ver quais câmeras ›
    </button>
  );
}
