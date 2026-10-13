// Carrega os follow-ups dos projetos liberados e resume o que pede atenção da Moked (retornos novos etc.).
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadFollowups, canonicalFollowupKey } from "../followups";
import { PROJETOS_LIBERADOS, resumirProjeto } from "./config";
import { sincronizarTodos } from "./gerarTodos";

export function useResumoFollowup({ db, pendencias, ativo }) {
  const [mapas, setMapas] = useState({});
  const recarregar = useCallback(async () => {
    if (!ativo) return;
    const pares = await Promise.all(PROJETOS_LIBERADOS.map((pid) => loadFollowups(db, pid).then((m) => [pid, m]).catch(() => [pid, null])));
    setMapas((ant) => { const n = { ...ant }; pares.forEach(([pid, m]) => { if (m) n[pid] = m; }); return n; });
  }, [db, ativo]);
  useEffect(() => {
    if (!ativo) return undefined;
    recarregar();
    const t = setInterval(recarregar, 120000);
    const foco = () => { if (document.visibilityState === "visible") recarregar(); };
    document.addEventListener("visibilitychange", foco);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", foco); };
  }, [ativo, recarregar]);

  // Quando o teste muda (novo relatório), atualiza a lista de itens dos links ativos — a empresa sempre vê o último teste.
  const assinatura = useMemo(() => JSON.stringify(pendencias.map((p) => [p.project.id, p.cat, p.item, p.status]).sort()), [pendencias]);
  useEffect(() => {
    if (!ativo || !pendencias.length) return; // sem pendências carregadas: não esvazia a lista dos links
    sincronizarTodos({ pendencias }).catch(() => {});
  }, [ativo, assinatura]);

  const resumo = useMemo(() => {
    const r = {};
    PROJETOS_LIBERADOS.forEach((pid) => {
      const chaves = pendencias.filter((p) => p.project.id === pid).map((p) => canonicalFollowupKey(pid, p.cat, p.item || "—"));
      r[pid] = resumirProjeto(chaves, mapas[pid] || {});
    });
    return r;
  }, [pendencias, mapas]);
  const totalNovos = Object.values(resumo).reduce((t, x) => t + x.novos, 0);
  return { resumo, totalNovos, recarregar };
}
