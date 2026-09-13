// ─────────────────────────────────────────────────────────────
// AuditoriaOperacional.jsx — Central de Auditoria Operacional
// (Fase 1A · piloto P311A). SOMENTE LEITURA.
//
// Monta a matriz operacional Moked a partir dos conectores de
// leitura, separando COBERTURA de evidência de CONFORMIDADE.
// Prepara o dossiê EM TELA. NÃO gera PDF nesta fase (a geração de
// PDF verdadeiro + Storage é a Fase 1B, após validar infra).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import {
  conectorCFTV, conectorTesteSemanal, conectorEquipamentos,
  conectorRondaPerimetral, conectorVisao360,
} from "./auditoriaConnectors";
import { consolidarMatriz, SIT_CFG, PRIO_CFG } from "./auditoriaModelo";

const firebaseConfig = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

// Zonas do P311A (piloto) — espelha Perimetral.jsx.
const ZONAS_P311A = ["Zona 01","Zona 02","Zona 03","Zona 04","Zona 05","Zona 06","Zona 07","Zona 08"];

const hojeISO = () => new Date().toLocaleDateString("sv-SE");
const agora = () => new Date().toLocaleString("pt-BR");

export default function AuditoriaOperacional({ dark, onBack, projectId = "P311A", carregarScore360 = null, responsavelInicial = "" }) {
  const bg = dark ? "#04080f" : "#f1f5f9";
  const cardBg = dark ? "#060c18" : "#ffffff";
  const border = dark ? "#0f172a" : "#e2e8f0";
  const txt = dark ? "#f1f5f9" : "#0f172a";
  const txt2 = dark ? "#64748b" : "#94a3b8";

  const [responsavel, setResponsavel] = useState(responsavelInicial);
  const [loading, setLoading] = useState(true);
  const [matriz, setMatriz] = useState(null);
  const [emissao] = useState(agora());
  const [relId] = useState(() => "AUD-" + projectId + "-" + hojeISO().replace(/-/g,"") + "-" + Math.random().toString(36).slice(2,6).toUpperCase());
  const [gerando, setGerando] = useState(false);
  const [erroPdf, setErroPdf] = useState("");
  const PROJ_NOME = "Mega CL Curitiba";

  const baixarPDF = async () => {
    if (!matriz) return;
    setGerando(true); setErroPdf("");
    try {
      const payload = {
        projectId, projetoNome: PROJ_NOME, emissao, responsavel, relId,
        cobertura: matriz.cobertura, conformidade: matriz.conformidade,
        linhas: matriz.linhas, vulnerabilidades: matriz.vulnerabilidades, acoes: matriz.acoes,
      };
      const resp = await fetch("/api/gerar-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        let msg = "Falha ao gerar PDF.";
        try { const j = await resp.json(); if (j && j.error) msg = j.error; } catch (e) {}
        throw new Error(msg);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Auditoria-Operacional-${projectId}-${(emissao||"").slice(0,10).replace(/\//g,"-")}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setErroPdf(e && e.message ? e.message : "Erro ao gerar o PDF.");
    } finally {
      setGerando(false);
    }
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    const deps = { db, doc, getDoc };
    const [cftv, testeSemanal, equipamentos, ronda] = await Promise.all([
      conectorCFTV(projectId, deps),
      conectorTesteSemanal(projectId, deps),
      conectorEquipamentos(projectId, deps),
      conectorRondaPerimetral(projectId, ZONAS_P311A, deps),
    ]);
    let score360 = null;
    if (typeof carregarScore360 === "function") {
      try { score360 = await carregarScore360(projectId); } catch (e) { score360 = null; }
    }
    const visao360 = conectorVisao360(score360);
    const resultados = { cftv, testeSemanal, equipamentos, ronda, visao360 };
    setMatriz(consolidarMatriz(resultados));
    setLoading(false);
  }, [projectId, carregarScore360]);

  useEffect(() => { carregar(); }, [carregar]);

  const Card = ({ children, style }) => (
    <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:12, padding:"14px 16px", marginBottom:10, ...style }}>{children}</div>
  );
  const SitBadge = ({ s }) => {
    const c = SIT_CFG[s] || SIT_CFG["sem-dado"];
    return <span style={{ fontSize:10, fontWeight:700, color:c.cor, background:c.bg, padding:"2px 8px", borderRadius:6, whiteSpace:"nowrap" }}>{c.label}</span>;
  };
  const PrioBadge = ({ p }) => {
    const c = PRIO_CFG[p] || PRIO_CFG["baixa"];
    return <span style={{ fontSize:9, fontWeight:700, color:c.cor }}>{c.label}</span>;
  };

  return (
    <div style={{ minHeight:"100vh", background:bg, display:"flex", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ width:"100%", maxWidth:640, padding:"14px 16px" }}>
        {/* Cabeçalho */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <button onClick={onBack} style={{ background:"transparent", border:`1px solid ${border}`, color:txt2, borderRadius:7, padding:"7px 12px", fontSize:12, cursor:"pointer", fontWeight:600 }}>← Painel</button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:800, color:txt }}>📋 Auditoria Operacional</div>
            <div style={{ fontSize:11, color:txt2 }}>{projectId} — Mega CL Curitiba · piloto</div>
          </div>
        </div>

        {/* Identificação da emissão */}
        <Card>
          <div>
            <div style={{ fontSize:9, color:txt2, fontWeight:700, textTransform:"uppercase" }}>Responsável pela emissão</div>
            <input value={responsavel} onChange={e=>setResponsavel(e.target.value)} placeholder="Nome do responsável" style={{ width:"100%", background:dark?"#020510":"#fff", border:`1px solid ${border}`, borderRadius:7, color:txt, padding:"8px", fontSize:13, boxSizing:"border-box" }}/>
          </div>
          <div style={{ fontSize:10, color:txt2, marginTop:8, fontStyle:"italic" }}>
            Fase 1A: a auditoria consolida a <b>evidência operacional mais recente</b> de cada módulo.
            O filtro por período será habilitado quando os conectores suportarem recorte temporal.
          </div>
          <div style={{ fontSize:10, color:txt2, marginTop:8, display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
            <span>Emissão: {emissao}</span>
            <span>ID: {relId}</span>
          </div>
        </Card>

        {loading ? (
          <div style={{ color:txt2, fontSize:13, textAlign:"center", padding:"40px 0" }}>Lendo evidências dos módulos…</div>
        ) : !matriz ? (
          <div style={{ color:txt2 }}>Sem dados.</div>
        ) : (
        <>
          {/* Cobertura x Conformidade — SEPARADAS */}
          <Card>
            <div style={{ fontSize:13, fontWeight:800, color:txt, marginBottom:10 }}>Saúde operacional</div>
            <div style={{ display:"flex", gap:10 }}>
              <div style={{ flex:1, textAlign:"center", background:dark?"#020510":"#f8fafc", border:`1px solid ${border}`, borderRadius:10, padding:"12px 8px" }}>
                <div style={{ fontSize:22, fontWeight:800, color:"#0ea5e9" }}>{matriz.cobertura.pct}%</div>
                <div style={{ fontSize:10, color:txt2, marginTop:2 }}>Cobertura de evidência</div>
                <div style={{ fontSize:9, color:txt2 }}>{matriz.cobertura.comDado}/{matriz.cobertura.total} com dado</div>
              </div>
              <div style={{ flex:1, textAlign:"center", background:dark?"#020510":"#f8fafc", border:`1px solid ${border}`, borderRadius:10, padding:"12px 8px" }}>
                <div style={{ fontSize:22, fontWeight:800, color: matriz.conformidade.pct==null?"#64748b":(matriz.conformidade.pct>=80?"#15803d":matriz.conformidade.pct>=60?"#b45309":"#b91c1c") }}>
                  {matriz.conformidade.pct==null ? "—" : matriz.conformidade.pct+"%"}
                </div>
                <div style={{ fontSize:10, color:txt2, marginTop:2 }}>Conformidade operacional</div>
                <div style={{ fontSize:9, color:txt2 }}>{matriz.conformidade.conformes}/{matriz.conformidade.avaliaveis} conformes</div>
              </div>
            </div>
            <div style={{ fontSize:9.5, color:txt2, marginTop:8, fontStyle:"italic" }}>
              Conformidade é calculada só sobre os requisitos com evidência. Ausência de dado é "Sem dado", nunca "Conforme".
            </div>
          </Card>

          {/* Matriz de auditoria */}
          <Card>
            <div style={{ fontSize:13, fontWeight:800, color:txt, marginBottom:10 }}>Matriz de auditoria</div>
            {matriz.linhas.map(l=>(
              <div key={l.id} style={{ border:`1px solid ${border}`, borderRadius:9, padding:"10px", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:4 }}>
                  <div style={{ fontSize:12.5, fontWeight:700, color:txt }}>{l.requisito}</div>
                  <SitBadge s={l.situacao} />
                </div>
                <div style={{ fontSize:10.5, color:txt2 }}>Módulo: {l.modulo} · Prioridade: <PrioBadge p={l.prioridade}/></div>
                <div style={{ fontSize:11, color:txt, marginTop:4 }}>Evidência: {l.evidencia}</div>
                <div style={{ fontSize:9.5, color:txt2, marginTop:2 }}>Origem: {l.origem}{l.data?` · ${l.data}`:""}{l.responsavel?` · ${l.responsavel}`:""}</div>
                {l.acao && l.acao!=="—" && <div style={{ fontSize:10.5, color:"#b45309", marginTop:4 }}>Ação: {l.acao}</div>}
              </div>
            ))}
          </Card>

          {/* Vulnerabilidades e pendências */}
          {matriz.vulnerabilidades.length>0 && (
            <Card>
              <div style={{ fontSize:13, fontWeight:800, color:txt, marginBottom:8 }}>Principais vulnerabilidades e pendências</div>
              {matriz.vulnerabilidades.map((v,i)=>(
                <div key={i} style={{ fontSize:11.5, color:txt, marginBottom:5, display:"flex", gap:8 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:SIT_CFG[v.situacao].cor, flexShrink:0, marginTop:5 }}/>
                  <span>{v.requisito} — <b style={{color:SIT_CFG[v.situacao].cor}}>{SIT_CFG[v.situacao].label}</b> <PrioBadge p={v.prioridade}/></span>
                </div>
              ))}
            </Card>
          )}

          {/* Ações recomendadas */}
          {matriz.acoes.length>0 && (
            <Card>
              <div style={{ fontSize:13, fontWeight:800, color:txt, marginBottom:8 }}>Ações recomendadas</div>
              {matriz.acoes.map((a,i)=>(
                <div key={i} style={{ fontSize:11, color:txt2, marginBottom:5 }}>• {a.acao} <span style={{fontSize:9}}>(<PrioBadge p={a.prioridade}/>)</span></div>
              ))}
            </Card>
          )}

          {/* Dossiê consolidado — PDF verdadeiro (pdf-lib no servidor) */}
          <Card>
            <div style={{ fontSize:12.5, fontWeight:800, color:txt, marginBottom:4 }}>Dossiê consolidado</div>
            <div style={{ fontSize:11, color:txt2, marginBottom:10 }}>
              Gera um <b>PDF verdadeiro</b> com a matriz, evidências e origens acima, pronto para arquivar ou enviar.
            </div>
            {erroPdf && <div role="alert" style={{ fontSize:11, color:"#ef4444", marginBottom:8 }}>{erroPdf}</div>}
            <button onClick={baixarPDF} disabled={gerando || !matriz}
              style={{ width:"100%", background: gerando?"#334155":"linear-gradient(135deg,#B21E27,#121212)", color:"#fff", border:"none", borderRadius:9, padding:"11px", fontSize:12.5, fontWeight:700, cursor: gerando?"wait":"pointer" }}>
              {gerando ? "Gerando PDF…" : "📄 Gerar PDF verdadeiro"}
            </button>
          </Card>

          <div style={{ fontSize:9.5, color:txt2, textAlign:"center", padding:"6px 0 20px", fontStyle:"italic" }}>
            Dados operacionais extraídos do MokLog CheckTest. Conclusões críticas exigem validação gerencial.
          </div>
        </>
        )}
      </div>
    </div>
  );
}
