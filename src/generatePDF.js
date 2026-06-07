// ── MokLog CheckTest — generatePDF.js
// Padrão visual baseado nos relatórios reais Golgi/Mega/Klog

const EMPRESAS_SEG = {
  P601:"GSS Segurança", P602:"GSS Segurança", P604:"GSS Segurança",
  P605:"GSS Segurança", P606:"GSS Segurança", P607:"Graber Segurança",
  P311A:"Auxiliar Segurança", P311B:"PortoVig",
  P505:"Hagana Segurança",
  P260A:"GR Segurança", P260B:"GR Segurança", P260C:"GR Segurança"
};

function fmtDate(d) {
  if(!d) return "--";
  try { return new Date(d+"T12:00:00").toLocaleDateString("pt-BR"); } catch { return d||"--"; }
}

function getWeekLabel(dateStr) {
  if(!dateStr) return "";
  try {
    const d = new Date(dateStr+"T12:00:00");
    const month = d.toLocaleDateString("pt-BR",{month:"long"});
    const day = d.getDate();
    const week = day<=7?"S1":day<=14?"S2":day<=21?"S3":"S4";
    return `${week} ${month.charAt(0).toUpperCase()+month.slice(1)}`;
  } catch { return ""; }
}

function calcHealthPct(project, state) {
  if(!project?.categories||!state) return 100;
  let totalItems=0, okItems=0;
  for(const cat of project.categories) {
    const s = state[cat.id]; if(!s) continue;
    if(cat.type==="maintenance"||cat.type==="notes") continue;
    if(cat.type==="single") {
      totalItems++;
      if(!s.status||s.status==="ok") okItems++;
    } else if(cat.type==="items"&&Array.isArray(s)) {
      s.forEach(v=>{ totalItems++; if(!v.status||v.status==="ok") okItems++; });
    } else if(cat.type==="count") {
      const t=s.total??cat.total??0;
      const inop=s.inoper??0;
      totalItems+=t; okItems+=(t-inop);
    }
  }
  return totalItems>0?Math.round((okItems/totalItems)*100):100;
}

function getStatusLabel(st) {
  if(!st||st==="ok") return "OK";
  if(st==="partial") return "PARCIAL";
  return "INOPERANTE";
}

function getStatusColor(st) {
  if(!st||st==="ok") return "#15803d";
  if(st==="partial") return "#d97706";
  return "#dc2626";
}

function getStatusBg(st) {
  if(!st||st==="ok") return "#dcfce7";
  if(st==="partial") return "#fef3c7";
  return "#fee2e2";
}

// ── CSS compartilhado dos relatórios
const REPORT_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#1e293b;padding:20px}
  .header{background:linear-gradient(135deg,#1a1040 0%,#0f0820 100%);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}
  .header-left h1{font-size:20px;font-weight:900;margin-bottom:4px}
  .header-left p{font-size:12px;opacity:.75;margin:1px 0}
  .header-right{text-align:right;font-size:11px;opacity:.7}
  .section{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px}
  .section-title{font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.8px;border-bottom:2px solid #f1f5f9;padding-bottom:8px;margin-bottom:12px}
  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
  .kpi{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 10px;text-align:center}
  .kpi-val{font-size:28px;font-weight:900;line-height:1}
  .kpi-lbl{font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:4px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:11px;font-weight:700}
  td{padding:7px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
  tr:nth-child(even) td{background:#f8fafc}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;white-space:nowrap}
  .badge-ok{background:#dcfce7;color:#15803d}
  .badge-parcial{background:#fef3c7;color:#d97706}
  .badge-inop{background:#fee2e2;color:#dc2626}
  .progress-bar{height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;min-width:80px}
  .progress-fill{height:100%;border-radius:3px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
  .info-item label{font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:2px}
  .info-item span{font-size:13px;font-weight:700;color:#1e293b}
  .pending-item{background:#fff8f0;border-left:3px solid #f59e0b;padding:8px 12px;margin-bottom:6px;border-radius:0 6px 6px 0}
  .pending-item strong{font-size:12px;color:#92400e}
  .pending-item p{font-size:11px;color:#64748b;margin-top:2px}
  .footer{text-align:center;margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}
  .signature{font-size:13px;font-weight:700;color:#1e293b;margin-top:4px}
  @media print{body{padding:8px;background:#fff}@page{margin:12mm}.no-print{display:none!important}}
`;

// ── RELATÓRIO SEMANAL COMPLETO (padrão Golgi P601)
export function generatePDF(project, state, meta, photos) {
  if(!project||!state||!meta) return;

  const hoje = new Date().toLocaleDateString("pt-BR");
  const weekLabel = getWeekLabel(meta.date);
  const empresa = EMPRESAS_SEG[project.id]||"Empresa de Segurança";
  const healthPct = calcHealthPct(project, state);

  // Count totals
  let totalOK=0, totalParcial=0, totalInop=0, totalItems=0;
  const problemItems = [];

  // Build device table rows (FULL LIST)
  let deviceRows = "";
  for(const cat of (project.categories||[])) {
    const s = state[cat.id]; if(!s) continue;
    if(cat.type==="maintenance"||cat.type==="notes") continue;

    if(cat.type==="single") {
      const st = s.status||"ok";
      const ok = st==="ok"?1:0;
      const total = 1;
      totalItems++; if(st==="ok") totalOK++; else if(st==="partial") totalParcial++; else totalInop++;
      const pct = ok*100;
      const barColor = pct===100?"#22c55e":pct>=50?"#f59e0b":"#ef4444";
      deviceRows += `<tr>
        <td>${cat.label}</td>
        <td style="text-align:center">${ok}/${total}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${barColor}"></div></div>
            <span style="font-size:11px;font-weight:700;color:${barColor}">${pct}%</span>
          </div>
        </td>
      </tr>`;
      if(st!=="ok") problemItems.push({cat:cat.label, item:cat.label, status:st, since:s.since, note:s.note});

    } else if(cat.type==="items"&&Array.isArray(s)) {
      const okCount = s.filter(v=>(!v.status||v.status==="ok")).length;
      const total = s.length;
      totalItems+=total;
      s.forEach(v=>{ if(!v.status||v.status==="ok") totalOK++; else if(v.status==="partial") totalParcial++; else totalInop++; });
      const pct = total>0?Math.round((okCount/total)*100):100;
      const barColor = pct===100?"#22c55e":pct>=50?"#f59e0b":"#ef4444";
      deviceRows += `<tr>
        <td>${cat.label}</td>
        <td style="text-align:center">${okCount}/${total}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${barColor}"></div></div>
            <span style="font-size:11px;font-weight:700;color:${barColor}">${pct}%</span>
          </div>
        </td>
      </tr>`;
      s.forEach((v,i)=>{ if(v.status&&v.status!=="ok") problemItems.push({cat:cat.label, item:cat.itemLabels?.[i]||`Item ${i+1}`, status:v.status, since:v.since, note:v.note}); });

    } else if(cat.type==="count") {
      const t = s.total??cat.total??0;
      const inop = s.inoper??0;
      const okCount = t-inop;
      totalItems+=t; totalOK+=okCount; totalInop+=inop;
      const pct = t>0?Math.round((okCount/t)*100):100;
      const barColor = pct===100?"#22c55e":pct>=50?"#f59e0b":"#ef4444";
      deviceRows += `<tr>
        <td>${cat.label}</td>
        <td style="text-align:center">${okCount}/${t}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${barColor}"></div></div>
            <span style="font-size:11px;font-weight:700;color:${barColor}">${pct}%</span>
          </div>
        </td>
      </tr>`;
      if(inop>0) problemItems.push({cat:cat.label, item:`${inop} item(s) inoperante(s)`, status:"inop", since:s.since, note:s.note});
    }
  }

  // Problem items table
  const problemRows = problemItems.map(p=>`
    <tr style="background:${p.status==="inop"?"#fff8f8":"#fffef8"}">
      <td>${p.cat}</td>
      <td>${p.item}</td>
      <td><span class="badge badge-${p.status==="inop"?"inop":"parcial"}">${getStatusLabel(p.status)}</span></td>
      <td style="color:#64748b;font-size:11px">${p.since?fmtDate(p.since):"--"}</td>
      <td style="color:#64748b;font-size:11px">${p.note||"--"}</td>
    </tr>`).join("");

  // Notes/pendências
  const notesCat = (project.categories||[]).find(c=>c.type==="notes");
  const notesState = notesCat?state[notesCat.id]:null;
  const pendencias = notesState?.items||[];
  const pendRows = pendencias.map(p=>`
    <div class="pending-item">
      <strong>${p.label}${p.since?` (desde ${fmtDate(p.since)})`:""}</strong>
      ${p.note?`<p>${p.note}</p>`:""}
    </div>`).join("");

  const barColor = healthPct>=90?"#22c55e":healthPct>=70?"#f59e0b":"#ef4444";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8">
<title>Relatório de Teste Semanal — ${project.id} — ${fmtDate(meta.date)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>

<div class="no-print" style="text-align:center;margin-bottom:16px">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>

<!-- CABEÇALHO -->
<div class="header">
  <div class="header-left">
    <p style="font-size:10px;opacity:.6;text-transform:uppercase;letter-spacing:.8px">Moked Consulting Security</p>
    <h1>Relatório de Teste Semanal</h1>
    <p>${project.id} – ${project.name||""}</p>
    <p>${fmtDate(meta.date)} | ${meta.start||"--"} – ${meta.end||"--"}</p>
  </div>
  <div class="header-right">
    <div style="font-size:22px;font-weight:900;color:#fff">${fmtDate(meta.date)}</div>
    <div>${meta.start||"--"} – ${meta.end||"--"}</div>
    <div style="margin-top:4px">${weekLabel}</div>
    <div style="margin-top:2px">Gerado em ${hoje}</div>
  </div>
</div>

<!-- INFORMAÇÕES DO TESTE -->
<div class="section">
  <div class="section-title">Informações do Teste</div>
  <div class="info-grid">
    <div class="info-item"><label>Líder VSPP</label><span>${meta.leader||"--"}</span></div>
    <div class="info-item"><label>CCO</label><span>${meta.cco||"--"}</span></div>
    <div class="info-item"><label>Operador Moked 24h</label><span>${meta.moked||"--"}</span></div>
    <div class="info-item"><label>Horário Contato</label><span>${meta.mokedTime||"--"}</span></div>
    <div class="info-item"><label>Contato Realizado?</label><span>${meta.mokedContact?"✓ Sim":"✗ Não"}</span></div>
    <div class="info-item"><label>Empresa de Segurança</label><span>${empresa}</span></div>
  </div>
  ${meta.signature?`<div style="margin-top:12px;padding-top:10px;border-top:1px solid #f1f5f9"><label style="font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase">Assinatura</label><div style="font-size:13px;font-weight:700;margin-top:3px">✍ ${meta.signature}</div></div>`:""}
</div>

<!-- INDICADORES DE SAÚDE -->
<div class="kpi-row">
  <div class="kpi">
    <div class="kpi-val" style="color:${barColor}">${healthPct}%</div>
    <div class="kpi-lbl">Saúde Geral</div>
  </div>
  <div class="kpi">
    <div class="kpi-val" style="color:#15803d">${totalOK}</div>
    <div class="kpi-lbl">OK</div>
  </div>
  <div class="kpi">
    <div class="kpi-val" style="color:#d97706">${totalParcial}</div>
    <div class="kpi-lbl">Parciais</div>
  </div>
  <div class="kpi">
    <div class="kpi-val" style="color:#dc2626">${totalInop}</div>
    <div class="kpi-lbl">Inoperantes</div>
  </div>
</div>

<!-- STATUS POR DISPOSITIVO — LISTA COMPLETA -->
<div class="section">
  <div class="section-title">Status por Dispositivo</div>
  <table>
    <thead><tr><th>Dispositivo</th><th style="text-align:center">OK/Total</th><th>Indicador</th></tr></thead>
    <tbody>${deviceRows||"<tr><td colspan='3' style='color:#94a3b8;text-align:center'>Sem itens cadastrados</td></tr>"}</tbody>
  </table>
</div>

<!-- ITENS COM PROBLEMA -->
${problemItems.length>0?`
<div class="section">
  <div class="section-title">Itens com Problema (${problemItems.length})</div>
  <table>
    <thead><tr><th>Dispositivo</th><th>Item</th><th>Status</th><th>Desde</th><th>Descrição</th></tr></thead>
    <tbody>${problemRows}</tbody>
  </table>
</div>`:""}

<!-- INFRAESTRUTURA / PENDÊNCIAS -->
${pendencias.length>0?`
<div class="section">
  <div class="section-title">Infraestrutura / Pendências (${pendencias.length})</div>
  ${pendRows}
</div>`:""}

<!-- RODAPÉ -->
<div class="footer">
  <div>MokLog CheckTest © Moked Consulting Security</div>
  ${meta.signature?`<div class="signature">✍ ${meta.signature}</div>`:""}
  <div>${project.id} – ${project.name||""} · ${fmtDate(meta.date)}</div>
</div>

</body></html>`;

  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `checktest_${project.id}_${meta.date||"relatorio"}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── RELATÓRIO CONSOLIDADO (padrão Mega P311B — múltiplas semanas)
export function generateConsolidatedPDF(project, reports) {
  if(!project||!reports?.length) return;

  const hoje = new Date().toLocaleDateString("pt-BR");
  const empresa = EMPRESAS_SEG[project.id]||"Empresa de Segurança";

  // Sort reports by date
  const sorted = [...reports].sort((a,b)=>(a.meta?.date||"").localeCompare(b.meta?.date||""));
  const n = sorted.length;
  const weekLabels = sorted.map(r=>getWeekLabel(r.meta?.date));
  const period = sorted[0]?.meta?.date&&sorted[n-1]?.meta?.date
    ? `${fmtDate(sorted[0].meta.date)} → ${fmtDate(sorted[n-1].meta.date)}`
    : "";

  // Header week cols
  const weekCols = weekLabels.map(w=>`<th>${w}</th>`).join("");
  const weekColsDate = sorted.map(r=>`<th style="font-size:10px;font-weight:400">${fmtDate(r.meta?.date)}</th>`).join("");

  // Build equipe table
  const equipeRows = [
    ["Moked 24h",    sorted.map(r=>r.meta?.moked||"--")],
    ["Líder",        sorted.map(r=>r.meta?.leader||"--")],
    ["CCO",          sorted.map(r=>r.meta?.cco||"--")],
    ["Horário",      sorted.map(r=>r.meta?.start&&r.meta?.end?`${r.meta.start}–${r.meta.end}`:"--")],
  ].map(([label,vals])=>`<tr><td style="font-weight:700">${label}</td>${vals.map(v=>`<td>${v}</td>`).join("")}</tr>`).join("");

  // Gather all unique problem items across all reports
  const allProblems = new Map();
  sorted.forEach((r,idx)=>{
    for(const cat of (project.categories||[])) {
      const s = r.state?.[cat.id]; if(!s) continue;
      if(cat.type==="maintenance"||cat.type==="notes") continue;
      if(cat.type==="items"&&Array.isArray(s)) {
        s.forEach((v,i)=>{ if(v.status&&v.status!=="ok") {
          const key = `${cat.label}|${cat.itemLabels?.[i]||i}`;
          if(!allProblems.has(key)) allProblems.set(key,{cat:cat.label,item:cat.itemLabels?.[i]||`Item ${i+1}`,weeks:new Array(n).fill("--")});
          allProblems.get(key).weeks[idx] = v.status==="inop"?"INOP":"PARC";
        }});
      } else if(cat.type==="single"&&s.status&&s.status!=="ok") {
        const key = cat.label;
        if(!allProblems.has(key)) allProblems.set(key,{cat:cat.label,item:cat.label,weeks:new Array(n).fill("--")});
        allProblems.get(key).weeks[idx] = s.status==="inop"?"INOP":"PARC";
      }
    }
  });

  // Items resolved (were problems in early reports, OK in later)
  const resolvedItems = [];
  allProblems.forEach((p,key)=>{
    const lastOK = p.weeks.slice().reverse().findIndex(w=>w==="--");
    const hadProblem = p.weeks.some(w=>w!=="--");
    if(hadProblem && lastOK>=0 && lastOK<p.weeks.length-1) {
      resolvedItems.push(p);
    }
  });

  // Build comparative section rows
  let compareRows = "";
  for(const cat of (project.categories||[])) {
    if(cat.type==="maintenance"||cat.type==="notes") continue;
    compareRows += `<tr style="background:#f1f5f9"><td colspan="${n+1}" style="font-weight:800;font-size:11px;color:#475569;padding:8px 10px;text-transform:uppercase">${cat.label}</td></tr>`;

    if(cat.type==="items") {
      (cat.itemLabels||[]).forEach((label,i)=>{
        const statuses = sorted.map(r=>{
          const s = r.state?.[cat.id];
          if(!s||!Array.isArray(s)) return "--";
          const v = s[i]; if(!v) return "OK";
          return getStatusLabel(v.status);
        });
        const hasProb = statuses.some(s=>s!=="OK"&&s!=="--");
        compareRows += `<tr ${hasProb?'style="background:#fff8f8"':""}>
          <td style="padding-left:18px">${label}</td>
          ${statuses.map(st=>`<td><span class="badge badge-${st==="OK"?"ok":st==="PARCIAL"?"parcial":"inop"}">${st}</span></td>`).join("")}
        </tr>`;
      });
    } else if(cat.type==="single") {
      const statuses = sorted.map(r=>{
        const s = r.state?.[cat.id]; if(!s) return "OK";
        return getStatusLabel(s.status);
      });
      const hasProb = statuses.some(s=>s!=="OK");
      compareRows += `<tr ${hasProb?'style="background:#fff8f8"':""}>
        <td style="padding-left:18px">${cat.label}</td>
        ${statuses.map(st=>`<td><span class="badge badge-${st==="OK"?"ok":st==="PARCIAL"?"parcial":"inop"}">${st}</span></td>`).join("")}
      </tr>`;
    } else if(cat.type==="count") {
      const statuses = sorted.map(r=>{
        const s = r.state?.[cat.id]; if(!s) return "OK";
        const t=s.total??cat.total??0; const inop=s.inoper??0;
        if(inop===0) return "OK";
        if(inop<t) return "PARCIAL";
        return "INOPERANTE";
      });
      const hasProb = statuses.some(s=>s!=="OK");
      compareRows += `<tr ${hasProb?'style="background:#fff8f8"':""}>
        <td style="padding-left:18px">${cat.label}</td>
        ${statuses.map(st=>`<td><span class="badge badge-${st==="OK"?"ok":st==="PARCIAL"?"parcial":"inop"}">${st}</span></td>`).join("")}
      </tr>`;
    }
  }

  // Problem analysis table
  const problemAnalysisRows = [...allProblems.values()].map(p=>{
    const isRecurrent = p.weeks.filter(w=>w!=="--").length > 1;
    const lastIdx = p.weeks.length-1;
    const currentStatus = p.weeks[lastIdx]!=="--"?p.weeks[lastIdx]:"Resolvido";
    const trend = isRecurrent?"🔴 Recorrente":"🟡 Nova ocorrência";
    return `<tr>
      <td>${p.item}</td>
      <td>${p.cat}</td>
      <td><span class="badge badge-${currentStatus==="INOP"?"inop":currentStatus==="PARC"?"parcial":"ok"}">${currentStatus}</span></td>
      <td>${trend}</td>
    </tr>`;
  }).join("");

  // Resolved items
  const resolvedRows = resolvedItems.map(p=>`
    <tr><td>${p.cat}</td><td>${p.item}</td><td><span class="badge badge-ok">✔ Resolvido</span></td></tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8">
<title>Relatório Comparativo — ${project.id} — ${period}</title>
<style>${REPORT_CSS}
  table td,table th{font-size:11px}
</style>
</head>
<body>

<div class="no-print" style="text-align:center;margin-bottom:16px">
  <button onclick="window.print()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimir / Salvar PDF</button>
</div>

<div class="header">
  <div class="header-left">
    <p style="font-size:10px;opacity:.6;text-transform:uppercase;letter-spacing:.8px">Moked Consulting Security</p>
    <h1>Relatório Comparativo de Testes</h1>
    <p>Sistemas Eletrônicos de Segurança</p>
    <p>${project.id} – ${project.name||""} | ${empresa}</p>
    <p>Período: ${period} · ${n} semana(s)</p>
  </div>
  <div class="header-right">
    <div>Emissão: ${hoje}</div>
    <div style="margin-top:4px">${weekLabels.join(" · ")}</div>
    <div style="margin-top:4px">Elaborado por: José Fonseca</div>
    <div style="font-size:10px">jose.fonseca@moked.com.br</div>
  </div>
</div>

<!-- EQUIPE POR SEMANA -->
<div class="section">
  <div class="section-title">Equipe por Semana</div>
  <table>
    <thead>
      <tr><th>Função</th>${weekCols}</tr>
      <tr style="background:#2d3748"><td style="color:#94a3b8;font-size:10px">Data</td>${weekColsDate}</tr>
    </thead>
    <tbody>${equipeRows}</tbody>
  </table>
</div>

<!-- TABELA COMPARATIVA -->
<div class="section">
  <div class="section-title">Comparativo por Dispositivo</div>
  <table>
    <thead><tr><th>Dispositivo / Item</th>${weekCols}</tr></thead>
    <tbody>${compareRows}</tbody>
  </table>
</div>

<!-- ANÁLISE DE PENDÊNCIAS -->
${problemAnalysisRows?`
<div class="section">
  <div class="section-title">Análise de Pendências e Tendências</div>
  <table>
    <thead><tr><th>Dispositivo</th><th>Sistema</th><th>Status Atual</th><th>Tendência</th></tr></thead>
    <tbody>${problemAnalysisRows}</tbody>
  </table>
</div>`:""}

<!-- ITENS RESOLVIDOS -->
${resolvedRows?`
<div class="section">
  <div class="section-title">Itens Resolvidos no Período</div>
  <table>
    <thead><tr><th>Sistema</th><th>Item</th><th>Status</th></tr></thead>
    <tbody>${resolvedRows}</tbody>
  </table>
</div>`:""}

<div class="footer">
  <div>Relatório Comparativo © Moked Consulting Security</div>
  <div class="signature">José Fonseca — Moked Consulting Security</div>
  <div>jose.fonseca@moked.com.br · ${project.id} · ${hoje}</div>
</div>

</body></html>`;

  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comparativo_${project.id}_${n}semanas.html`;
  a.click();
  URL.revokeObjectURL(url);
}
