// ─────────────────────────────────────────────────────────────
// pendencias.js — Utilitário canônico de "dias em aberto"
//
// Fonte ÚNICA da idade de pendências (equipamento, iluminação,
// energia, material etc.). Todos os módulos devem importar daqui,
// para que a contagem e as cores sejam idênticas em todo o app.
//
// Escala de cor (definida com o Marcio):
//   • 0–2 dias  → cinza  (normal)
//   • 3–5 dias  → amarelo (atenção)
//   • 6+  dias  → vermelho (urgente)
//
// IMPORTANTE (bug de fuso já conhecido no app):
// ancoramos a data ao MEIO-DIA local ("T12:00:00") para nunca
// cair no dia anterior/seguinte por causa de UTC. NÃO troque por
// toISOString(), que já causou o bug das rondas noturnas.
// ─────────────────────────────────────────────────────────────

// Retorna o nº de dias inteiros desde a data de abertura (string "YYYY-MM-DD").
// Também aceita Date ou ISO completo. Retorna 0 se vazio/ inválido.
export function daysSince(d) {
  if (!d) return 0;
  try {
    let base;
    if (d instanceof Date) {
      base = d.getTime();
    } else if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      // só data → ancora ao meio-dia local
      base = new Date(d + "T12:00:00").getTime();
    } else {
      base = new Date(d).getTime();
    }
    if (Number.isNaN(base)) return 0;
    return Math.max(0, Math.floor((Date.now() - base) / 86400000));
  } catch {
    return 0;
  }
}

// Classifica a idade em um nível: "normal" | "atencao" | "urgente".
export function nivelPendencia(dias) {
  if (dias >= 6) return "urgente";
  if (dias >= 3) return "atencao";
  return "normal";
}

// Configuração visual de cada nível (cor sólida + fundo translúcido + rótulo).
export const NIVEL_CFG = {
  normal:  { cor: "#64748b", label: "Normal"   },
  atencao: { cor: "#f59e0b", label: "Atenção"  },
  urgente: { cor: "#ef4444", label: "Urgente"  },
};

// Cor da idade — atalho para quem só quer a cor.
export function corPorDias(dias) {
  return NIVEL_CFG[nivelPendencia(dias)].cor;
}

// Componente de badge "Xd em aberto", com cor conforme a escala.
// Uso: <DiasAberto dataProblem={item.dataProblem} />
// Aceita `data` como alias de `dataProblem`. Não renderiza nada se vazio.
export function DiasAberto({ dataProblem, data, prefixo = "", sufixo = "em aberto" }) {
  const origem = dataProblem || data;
  if (!origem) return null;
  const dias = daysSince(origem);
  const cor = corPorDias(dias);
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, color: cor,
      background: cor + "22", padding: "2px 6px", borderRadius: 4,
      whiteSpace: "nowrap",
    }}>
      {prefixo}{dias}d {sufixo}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// RECICLAGEM DE VIGILANTES
// Ciclo de 2 anos desde a última reciclagem. Alerta 45 dias antes de vencer.
// ─────────────────────────────────────────────────────────────

export const RECICLAGEM_ANOS = 2;
export const RECICLAGEM_ALERTA_DIAS = 45;

// Retorna info da reciclagem a partir da data da última (string "YYYY-MM-DD").
// { temData, vencimento(Date|null), diasRestantes(int), estado }
// estado: "sem-data" | "ok" | "alerta" | "vencido"
export function statusReciclagem(dataUltima) {
  if (!dataUltima) return { temData: false, vencimento: null, diasRestantes: null, estado: "sem-data" };
  let base;
  try {
    base = new Date(dataUltima + "T12:00:00");
    if (Number.isNaN(base.getTime())) throw 0;
  } catch {
    return { temData: false, vencimento: null, diasRestantes: null, estado: "sem-data" };
  }
  const venc = new Date(base);
  venc.setFullYear(venc.getFullYear() + RECICLAGEM_ANOS);
  const diasRestantes = Math.floor((venc.getTime() - Date.now()) / 86400000);
  let estado;
  if (diasRestantes < 0) estado = "vencido";
  else if (diasRestantes <= RECICLAGEM_ALERTA_DIAS) estado = "alerta";
  else estado = "ok";
  return { temData: true, vencimento: venc, diasRestantes, estado };
}

// true se o colaborador precisa "piscar" (alerta ou vencido).
export function reciclagemPisca(dataUltima) {
  const e = statusReciclagem(dataUltima).estado;
  return e === "alerta" || e === "vencido";
}

// true se ALGUM colaborador da lista está em alerta/vencido (para o projeto piscar).
export function equipeTemReciclagemPendente(colaboradores) {
  return (colaboradores || []).some(c => reciclagemPisca(c && c.ultimaReciclagem));
}

// Rótulo curto para exibição.
export function reciclagemLabel(dataUltima) {
  const s = statusReciclagem(dataUltima);
  if (s.estado === "sem-data") return "Reciclagem: sem data";
  if (s.estado === "vencido") return `Reciclagem VENCIDA há ${Math.abs(s.diasRestantes)}d`;
  if (s.estado === "alerta") return `Reciclagem vence em ${s.diasRestantes}d`;
  return `Reciclagem em dia (${s.diasRestantes}d)`;
}
