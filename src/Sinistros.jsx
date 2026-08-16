// ─────────────────────────────────────────────────────────────
// Sinistros.jsx — Histórico de Sinistros por projeto (Etapa b)
// MokLog CheckTest · Análise de Risco v2
//
// Terceira perna do tripé de classificação (junto com Operacional e Regional).
// Preenchido no painel GERENCIAL (PIN 872101). Um documento por projeto:
//   Firestore: sinistros/{pid}
//
// Modelo de dados (sinistros/{pid}):
//   {
//     houve: true|false,
//     // se houve === true:
//     tipo: "invasao_perimetral" | "roubo_bolsao" | "furto" | "outro",
//     tipoOutro: "texto livre (quando tipo === outro)",
//     dataOcorrido: "YYYY-MM-DD" | null,
//     observacao: "texto livre",
//     // se houve === false:
//     semSinistroFaixa: "30d" | "6m" | "12m" | "24m",
//     atualizadoEm: ISO, atualizadoPor: "gerencial"
//   }
//
// Regras de peso (definidas com Marcio):
//   • Sinistro recente ELEVA (ainda mais se casar com item crucial da mesma
//     natureza — ex.: invasão perimetral + perímetro inoperante).
//   • Sem sinistro há 24m ATENUA.
//   • O peso é aplicado como MODULADOR (delta) sobre o consolidado, no mesmo
//     estilo do modulador de equipe já existente (consolidarRiscoGeral).
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { setDoc } from "./fireGuard";

const firebaseConfig = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
  messagingSenderId: "390165325023",
  appId: "1:390165325023:web:3147cd333503916b0d756a",
};
const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// ── Tipos pré-definidos ──────────────────────────────────────
export const TIPOS_SINISTRO = [
  { id: "invasao_perimetral", label: "Invasão perimetral", natureza: "perimetro" },
  { id: "roubo_bolsao",       label: "Roubo externo do bolsão", natureza: "acesso" },
  { id: "furto",              label: "Furto", natureza: "furto" },
  { id: "outro",              label: "Outro", natureza: null },
];
export const FAIXAS_SEM_SINISTRO = [
  { id: "30d", label: "Últimos 30 dias" },
  { id: "6m",  label: "Últimos 6 meses" },
  { id: "12m", label: "Últimos 12 meses" },
  { id: "24m", label: "24 meses ou mais" },
];

const toLocalDate = (d) => new Date(d).toLocaleDateString("sv-SE"); // anti-fuso
function diasDe(dateStr) {
  if (!dateStr) return null;
  const p = String(dateStr).split("T")[0].split("-");
  if (p.length !== 3) return null;
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
  if (isNaN(d.getTime())) return null;
  const h = new Date(); h.setHours(12, 0, 0, 0);
  return Math.max(0, Math.floor((h - d) / 86400000));
}

// ── COLETOR (consumido pela Análise de Risco) ────────────────
export async function coletarSinistros(pid) {
  try {
    const snap = await getDoc(doc(db, "sinistros", pid));
    if (!snap.exists()) return { ok: false, temDado: false, motivo: "sem registro de sinistro" };
    const s = snap.data() || {};
    return { ok: true, temDado: true, ...s, dias: s.houve ? diasDe(s.dataOcorrido) : null };
  } catch (e) {
    return { ok: false, temDado: false, erro: true, motivo: "falha ao ler sinistros" };
  }
}

// ── MODULADOR DE RISCO (delta) ───────────────────────────────
// Retorna { delta, motivo } no mesmo formato que o modulador de equipe.
//   delta > 0 → agrava · delta < 0 → atenua · 0 → neutro.
// vetores: lista já consolidada da Análise de Risco (para casar natureza).
export function moduladorSinistro(sin, vetores) {
  if (!sin?.ok || !sin.temDado) return { delta: 0, motivo: null };

  if (sin.houve === false) {
    // Sem sinistro: só atenua no horizonte mais longo (24m+).
    if (sin.semSinistroFaixa === "24m") {
      return { delta: -1, motivo: "sem sinistros há 24 meses ou mais" };
    }
    return { delta: 0, motivo: "sem sinistro recente registrado" };
  }

  if (sin.houve === true) {
    const dias = sin.dias;
    const tipo = TIPOS_SINISTRO.find((t) => t.id === sin.tipo) || null;
    const natureza = tipo?.natureza || null;

    // Casamento com item crucial da mesma natureza (agrava mais).
    let casa = false;
    if (natureza && Array.isArray(vetores)) {
      const alvo = {
        perimetro: /perimetr|cerca|bollard/i,
        acesso:    /cancela|eclusa|portao|acesso|garra|dilacerador/i,
        furto:     /cftv|camera|monitor|ctmk/i,
      }[natureza];
      if (alvo) casa = vetores.some((v) => alvo.test(v.label || "") && (v.nivel || 0) >= 3);
    }

    // Recência: <=180d recente, <=365d moderadamente recente, >365d antigo.
    let delta;
    if (dias != null && dias <= 180)      delta = casa ? 2 : 1;
    else if (dias != null && dias <= 365) delta = casa ? 1 : 1;
    else                                  delta = casa ? 1 : 0; // antigo: só agrava se casar

    const quando = dias != null ? `há ${dias} dias` : "em data não informada";
    const casaTxt = casa ? ", coincidente com vulnerabilidade operacional da mesma natureza" : "";
    return { delta, motivo: `sinistro registrado (${tipo?.label || "outro"}) ${quando}${casaTxt}` };
  }

  return { delta: 0, motivo: null };
}

// ── PAINEL GERENCIAL (edição) ────────────────────────────────
// props: { pid, projectName, onBack }
export default function Sinistros({ pid, projectName, onBack }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [houve, setHouve] = useState(null); // null | true | false
  const [tipo, setTipo] = useState("invasao_perimetral");
  const [tipoOutro, setTipoOutro] = useState("");
  const [dataOcorrido, setDataOcorrido] = useState("");
  const [observacao, setObservacao] = useState("");
  const [faixa, setFaixa] = useState("12m");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "sinistros", pid));
        if (vivo && snap.exists()) {
          const s = snap.data() || {};
          setHouve(typeof s.houve === "boolean" ? s.houve : null);
          if (s.tipo) setTipo(s.tipo);
          if (s.tipoOutro) setTipoOutro(s.tipoOutro);
          if (s.dataOcorrido) setDataOcorrido(s.dataOcorrido);
          if (s.observacao) setObservacao(s.observacao);
          if (s.semSinistroFaixa) setFaixa(s.semSinistroFaixa);
        }
      } catch (e) { /* segue com defaults */ }
      finally { if (vivo) setLoading(false); }
    })();
    return () => { vivo = false; };
  }, [pid]);

  async function salvar() {
    if (houve === null) return;
    setSaving(true); setSaved(false);
    const base = {
      houve,
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: "gerencial",
    };
    const payload = houve
      ? { ...base, tipo, tipoOutro: tipo === "outro" ? tipoOutro.trim() : "", dataOcorrido: dataOcorrido || null, observacao: observacao.trim(), semSinistroFaixa: null }
      : { ...base, semSinistroFaixa: faixa, tipo: null, tipoOutro: "", dataOcorrido: null, observacao: "" };
    try {
      await setDoc(doc(db, "sinistros", pid), payload, { merge: true });
      setSaved(true);
    } catch (e) { /* fireGuard já trata demo; erro real fica silencioso na UI */ }
    finally { setSaving(false); }
  }

  const S = {
    wrap: { padding: 16, maxWidth: 560, margin: "0 auto", fontFamily: "system-ui, sans-serif" },
    h: { fontSize: 18, fontWeight: 700, color: "#121212", marginBottom: 4 },
    sub: { fontSize: 13, color: "#5b6b70", marginBottom: 16 },
    card: { border: "1px solid #dfe5e3", borderRadius: 12, padding: 16, marginBottom: 12, background: "#fff" },
    label: { fontSize: 12, fontWeight: 600, color: "#5b6b70", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, display: "block" },
    btnRow: { display: "flex", gap: 8, marginBottom: 12 },
    seg: (on, cor) => ({ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid " + (on ? cor : "#dfe5e3"), background: on ? cor : "#fff", color: on ? "#fff" : "#121212", fontWeight: 600, cursor: "pointer" }),
    input: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #dfe5e3", fontSize: 14, marginBottom: 10, boxSizing: "border-box" },
    save: { width: "100%", padding: "12px", borderRadius: 10, border: "none", background: "#B02A1E", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" },
    back: { background: "none", border: "none", color: "#5b6b70", fontSize: 14, cursor: "pointer", marginBottom: 12, padding: 0 },
    ok: { color: "#1a7f37", fontSize: 13, textAlign: "center", marginTop: 8, fontWeight: 600 },
  };

  if (loading) return <div style={S.wrap}><div style={S.sub}>Carregando…</div></div>;

  return (
    <div style={S.wrap}>
      {onBack && <button style={S.back} onClick={onBack}>← Voltar</button>}
      <div style={S.h}>🛡️ Histórico de Sinistros</div>
      <div style={S.sub}>{pid}{projectName ? " — " + projectName : ""} · painel gerencial</div>

      <div style={S.card}>
        <span style={S.label}>Houve sinistro neste projeto?</span>
        <div style={S.btnRow}>
          <button style={S.seg(houve === true, "#B02A1E")} onClick={() => setHouve(true)}>SIM</button>
          <button style={S.seg(houve === false, "#1a7f37")} onClick={() => setHouve(false)}>NÃO</button>
        </div>

        {houve === true && (
          <div>
            <span style={S.label}>Tipo</span>
            <select style={S.input} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_SINISTRO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {tipo === "outro" && (
              <input style={S.input} placeholder="Especifique o tipo" value={tipoOutro} onChange={(e) => setTipoOutro(e.target.value)} />
            )}
            <span style={S.label}>Data do ocorrido</span>
            <input style={S.input} type="date" value={dataOcorrido} onChange={(e) => setDataOcorrido(e.target.value)} max={toLocalDate(Date.now())} />
            <span style={S.label}>Observação</span>
            <textarea style={{ ...S.input, minHeight: 72, resize: "vertical" }} placeholder="Descreva o ocorrido" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        )}

        {houve === false && (
          <div>
            <span style={S.label}>Há quanto tempo sem sinistro?</span>
            <select style={S.input} value={faixa} onChange={(e) => setFaixa(e.target.value)}>
              {FAIXAS_SEM_SINISTRO.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {houve !== null && (
        <button style={{ ...S.save, opacity: saving ? 0.6 : 1 }} onClick={salvar} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      )}
      {saved && <div style={S.ok}>✓ Sinistro registrado</div>}
    </div>
  );
}
