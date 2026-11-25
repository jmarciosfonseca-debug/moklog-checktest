// Universo da Área do Cliente (Marcio, 25/11/2026): o que o cliente tem disponível vira um ponto do universo 3D.
// Cada item traz um resumo com os DADOS REAIS já carregados pela área (o cliente está logado) e as ações possíveis:
// "pdf" abre o PDF do último teste semanal; "ver:<tela>" leva para a tela correspondente da Área do Cliente.
const fmtD = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export function itensUniversoCliente(p, { plantao = [], sis = null, rotuloRisco = "" } = {}) {
  if (!p) return [];
  const t = p.teste || {}, m = p.mapa || {}, s = p.sistemas || {}, e = p.equip || {}, f = p.ferias || {};
  const ver = (tela, rotulo = "Abrir na área") => ({ id: `ver:${tela}`, rotulo });
  const itens = [
    { id: "teste", g: "pr", nome: "Teste semanal",
      linhas: t.data ? [`Último teste: ${fmtD(t.data)}${typeof t.pct === "number" ? ` · ${t.pct}% operacional` : ""}`, `${plural(t.inop || 0, "item inoperante", "itens inoperantes")} · ${plural(t.parcial || 0, "parcial", "parciais")}`, ...(t.atrasado ? ["Teste da semana ainda não registrado"] : [])] : ["Ainda não há teste registrado."],
      acoes: [...(p.historico && p.historico[0] ? [{ id: "pdf", rotulo: "Abrir o PDF do último teste", principal: true }] : []), ver("teste")] },
    { id: "plantao", g: "pe", nome: "Equipe de plantão",
      linhas: m.temMapa ? [`Mapa de ${fmtD(m.data)}${m.turno ? ` · ${m.turno}` : ""}${m.hoje ? "" : " (não é de hoje)"}`, ...plantao.slice(0, 8).map((x) => [x.nome, x.posto, x.situacaoRotulo].filter(Boolean).join(" · ")), ...(plantao.length > 8 ? [`+ ${plantao.length - 8} no mapa completo`] : [])] : ["Nenhum mapa de equipe enviado ainda."],
      acoes: [{ ...ver("plantao", "Ver o Mapa de Equipe"), principal: true }] },
    { id: "equipe", g: "pe", nome: "Equipe e turnover",
      linhas: [plural((p.colabs || []).length, "colaborador ativo", "colaboradores ativos"), ...((f.emFerias || []).length ? [plural(f.emFerias.length, "pessoa em férias", "pessoas em férias")] : [])],
      acoes: [ver("turnover", "Ver turnover"), ver("ferias", "Ver férias")] },
    { id: "treino", g: "pe", nome: "Treinamentos",
      linhas: [plural((p.colabs || []).reduce((a, c) => a + (c.treinos || 0), 0), "treinamento registrado", "treinamentos registrados")],
      acoes: [ver("treino", "Ver treinamentos"), ver("fotos", "Ver fotos")] },
    { id: "equip", g: "eq", nome: "Equipamentos de plantão",
      linhas: typeof e.pct === "number" ? [`${e.pct}% operacional`, `${plural(e.inop || 0, "inoperante", "inoperantes")} · ${plural(e.parcial || 0, "parcial", "parciais")}`] : ["Sem inventário registrado."],
      acoes: [ver("equip")] },
    { id: "sistemas", g: "eq", nome: "Iluminação e energia",
      linhas: [typeof s.ilumPct === "number" ? `Iluminação: ${s.ilumPct}% (${plural(s.ilumDef || 0, "ponto deficiente", "pontos deficientes")})` : "Iluminação: sem registro", `${plural(s.quedas7d || 0, "queda de energia", "quedas de energia")} nos últimos 7 dias`, ...(s.energiaAberta ? ["Há ocorrência de energia em aberto"] : []), ...(s.temCtmk ? [s.ctmkOff ? `CTMK fora do ar há ${plural(s.ctmkDias || 0, "dia", "dias")}` : "CTMK on-line"] : [])],
      acoes: [ver("sistemas", "Ver sistemas")] },
    { id: "risco", g: "pr", nome: "Análise de risco", linhas: [rotuloRisco ? `Nível atual: ${rotuloRisco}` : "Sem avaliação registrada."], acoes: [ver("risco")] },
    { id: "entorno", g: "pr", nome: "Informativos · entorno",
      linhas: (p.informativos || []).length ? p.informativos.slice(0, 3).map((i) => `${i.dataCurta ? `${i.dataCurta} · ` : ""}${i.titulo}`) : ["Sem informativos nos últimos 30 dias."],
      acoes: [ver("entorno", "Ver informativos")] },
    { id: "sis", g: "out", nome: "Nota SIS⁺", linhas: [sis && typeof sis.geral === "number" ? `Nota geral: ${Math.round(sis.geral)}${sis.faixa ? ` · ${sis.faixa}` : ""}` : "Nota ainda não calculada."], acoes: [ver("sis", "Ver a nota")] },
    { id: "local", g: "out", nome: "Localização", linhas: ["Endereço e como chegar ao projeto."], acoes: [ver("local", "Ver localização")] },
  ];
  return itens;
}
