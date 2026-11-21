// ─────────────────────────────────────────────────────────────
// Ícones VIVOS da órbita do SIS na abertura (Marcio, 20/11/2026: "dar vida": câmera monitorando, monitor da CCO com imagem,
// botão de pânico pulsando em vermelho, MNP como manual, mais a Central Moked online). Só SVG + CSS (sem JS por ícone), então
// continuam animando enquanto o nó gira em 3D. Cada nó tem uma cor de destaque (--ac); o contorno segue claro e fino.
// Prefere movimento reduzido: tudo fica parado, mas já com o desenho final legível.
// ─────────────────────────────────────────────────────────────
export const ICONES_SIS = {
  cftv: '<path d="M3 5.5v13M3 12h3.5"/><g class="cam"><rect x="6.5" y="8.5" width="9.5" height="6" rx="1.4"/><circle class="ac" cx="18" cy="11.5" r="2"/><circle class="acf" cx="18" cy="11.5" r=".8"/><path class="cone" d="M19.6 10.6L24 7.4v8.2l-4.4-3z"/><circle class="rec" cx="8.7" cy="10.6" r=".9"/></g>',
  peri: '<path d="M4 20V7M9.5 20V7M15 20V7M20.5 20V7M3 11.5h18M3 16h18"/><circle class="acf run" cx="3" cy="11.5" r="1.3"/><circle class="acf run r2" cx="3" cy="16" r="1.3"/><circle class="acf sen" cx="4" cy="5.4" r=".9"/><circle class="acf sen s2" cx="9.5" cy="5.4" r=".9"/><circle class="acf sen s3" cx="15" cy="5.4" r=".9"/><circle class="acf sen s4" cx="20.5" cy="5.4" r=".9"/>',
  acesso: '<rect x="14.5" y="4.5" width="6.5" height="15" rx="1.6"/><path d="M16.2 13.5h3.1"/><circle class="led" cx="17.75" cy="8" r="1.05"/><g class="card"><rect class="ac" x="1.5" y="9.5" width="9" height="6" rx="1.2"/><path class="ac" d="M3.3 12h2.4M3.3 13.8h4.2"/></g>',
  ilum: '<circle class="glow" cx="12" cy="9.5" r="7"/><path class="ac" d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 00-4-10z"/><path class="fil" d="M10.4 11.2l1.6-2.2 1.6 2.2M12 11.2V15"/><path class="ray" d="M2.6 8.2l1.8.7M21.4 8.2l-1.8.7M4 3.4l1.4 1.3M20 3.4l-1.4 1.3"/>',
  panico: '<circle class="rip" cx="12" cy="12" r="6"/><circle class="rip r2" cx="12" cy="12" r="6"/><circle class="ac" cx="12" cy="12" r="8.4"/><circle class="btn" cx="12" cy="12" r="4.8"/><path class="hl" d="M9.7 10.6a3 3 0 011.9-1.5"/>',
  radio: '<rect x="8.5" y="9" width="7" height="12.5" rx="1.8"/><path d="M12 9V5"/><circle class="acf" cx="12" cy="4.6" r=".95"/><path d="M10.5 12.5h3M10.5 14.8h3"/><circle class="led" cx="13.7" cy="18.6" r=".85"/><path class="w w1" d="M14.5 3.3a3 3 0 010 3.2"/><path class="w w2" d="M16.7 1.9a5.4 5.4 0 010 6"/><path class="w w1" d="M9.5 3.3a3 3 0 000 3.2"/><path class="w w2" d="M7.3 1.9a5.4 5.4 0 000 6"/>',
  cco: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/><rect class="acf t t1" x="5" y="6" width="6" height="3.4" rx=".4"/><rect class="acf t t2" x="13" y="6" width="6" height="3.4" rx=".4"/><rect class="acf t t3" x="5" y="10.6" width="6" height="3.4" rx=".4"/><rect class="acf t t4" x="13" y="10.6" width="6" height="3.4" rx=".4"/><rect class="scan" x="4.5" y="5.4" width="15" height=".9"/><circle class="rec" cx="18" cy="7.7" r=".8"/>',
  pessoas: '<g class="p1"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6"/></g><g class="p2"><circle cx="17" cy="9" r="2.3"/><path d="M16 14c3 0 5 2 5 5"/></g><circle class="on-ring" cx="20.6" cy="4.4" r="1.6"/><circle class="on" cx="20.6" cy="4.4" r="1.6"/>',
  pop: '<rect x="5" y="3" width="14" height="18" rx="2"/><path class="ck" d="M8 8.4l1.2 1.3 2.3-2.6"/><path d="M13.2 8.4h3"/><path class="ck k2" d="M8 12.6l1.2 1.3 2.3-2.6"/><path d="M13.2 12.6h3"/><path class="ck k3" d="M8 16.8l1.2 1.3 2.3-2.6"/><path d="M13.2 16.8h3"/>',
  mnp: '<path d="M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h10"/><path d="M8.6 7.4h4.2M8.6 9.8h5.2"/><path class="pg" d="M8 4.6h7.4v8.6H8z"/><path class="rb" d="M14.4 4v5.2l1.6-1.3 1.6 1.3V4"/>',
  central: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/><ellipse class="mer" cx="12" cy="12" rx="4" ry="8"/><g class="orb"><circle class="acf" cx="12" cy="1.7" r="1.2"/></g><circle class="on-ring" cx="19.6" cy="4.6" r="1.7"/><circle class="on" cx="19.6" cy="4.6" r="1.7"/>',
};

// Cor de destaque de cada nó (o contorno do ícone continua claro; só os detalhes ganham cor).
export const COR_ICONE = { cftv: "#7dd3fc", peri: "#fb923c", acesso: "#4ade80", ilum: "#fde047", panico: "#ff3b42", cco: "#67e8f9", radio: "#a5b4fc", pessoas: "#bae6fd", pop: "#4ade80", mnp: "#fcd34d", central: "#ff6a70" };

export const CSS_ICONES = `
.sis-nd{border-color:color-mix(in srgb,var(--ac,#475569) 55%,#2a2f3f)}
.sis-nd[data-no]{box-shadow:0 6px 16px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.12),0 0 14px color-mix(in srgb,var(--ac,#475569) 26%,transparent)}
.sis-nd svg{overflow:visible;width:56%;height:56%}
.sis-nd svg .ac{stroke:var(--ac)}
.sis-nd svg .acf{fill:var(--ac);stroke:none}
.sis-nd svg .cam{transform-origin:6.5px 11.5px;animation:sisiPan 4.4s ease-in-out infinite}
.sis-nd svg .cone{fill:var(--ac);stroke:none;opacity:.25;animation:sisiCone 2.2s ease-in-out infinite}
.sis-nd svg .rec{fill:#ff3b42;stroke:none;animation:sisiBlink 1.3s steps(1) infinite}
.sis-nd svg .run{opacity:0;animation:sisiRun 2.6s linear infinite}.sis-nd svg .run.r2{animation-delay:1.3s}
.sis-nd svg .sen{animation:sisiBlink 1.6s steps(1) infinite}.sis-nd svg .s2{animation-delay:.4s}.sis-nd svg .s3{animation-delay:.8s}.sis-nd svg .s4{animation-delay:1.2s}
.sis-nd svg .card{animation:sisiCard 3.2s ease-in-out infinite}
.sis-nd svg .led{stroke:none;fill:#ff3b42;animation:sisiLed 3.2s steps(1) infinite}
.sis-nd svg .glow{fill:var(--ac);stroke:none;opacity:.2;transform-origin:12px 9.5px;animation:sisiGlow 2.4s ease-in-out infinite}
.sis-nd svg .fil{stroke:var(--ac);opacity:.9}
.sis-nd svg .ray{stroke:var(--ac);animation:sisiRay 2.4s ease-in-out infinite}
.sis-nd svg .rip{stroke:#ff3b42;opacity:0;transform-origin:12px 12px;animation:sisiRip 1.9s ease-out infinite}.sis-nd svg .rip.r2{animation-delay:.95s}
.sis-nd svg .btn{fill:#ff2d36;stroke:none;transform-origin:12px 12px;animation:sisiPulse 1.1s ease-in-out infinite;filter:drop-shadow(0 0 3px #ff2d36)}
.sis-nd svg .hl{stroke:#ffd0d2;stroke-width:1.2}
.sis-nd svg .w{stroke:var(--ac);opacity:.25;animation:sisiWave 1.8s ease-in-out infinite}.sis-nd svg .w2{animation-delay:.35s}
.sis-nd svg .t{opacity:.3;animation:sisiTile 2.6s ease-in-out infinite}.sis-nd svg .t2{animation-delay:.6s}.sis-nd svg .t3{animation-delay:1.3s}.sis-nd svg .t4{animation-delay:1.9s}
.sis-nd svg .scan{fill:#e0fbff;stroke:none;opacity:.7;animation:sisiScan 2.4s linear infinite}
.sis-nd svg .p1{animation:sisiBob 2.6s ease-in-out infinite}.sis-nd svg .p2{animation:sisiBob 2.6s ease-in-out .5s infinite}
.sis-nd svg .on{fill:#22e07a;stroke:none}
.sis-nd svg .on-ring{fill:none;stroke:#22e07a;transform-origin:20.6px 4.4px;animation:sisiPing 1.8s ease-out infinite}
.sis-nd[data-no=central] svg .on-ring{transform-origin:19.6px 4.6px}
.sis-nd svg .ck{stroke:var(--ac);stroke-dasharray:6;stroke-dashoffset:0;animation:sisiCk 4.2s ease-in-out infinite}.sis-nd svg .k2{animation-delay:.5s}.sis-nd svg .k3{animation-delay:1s}
.sis-nd svg .pg{fill:rgba(252,211,77,.1);stroke:var(--ac);stroke-width:1;transform-origin:8px 9px;animation:sisiPg 3.4s ease-in-out infinite}
.sis-nd svg .rb{stroke:var(--ac);fill:rgba(252,211,77,.35)}
.sis-nd svg .mer{stroke:var(--ac);transform-origin:12px 12px;animation:sisiMer 4.5s ease-in-out infinite}
.sis-nd svg .orb{transform-origin:12px 12px;animation:sisiOrb 6s linear infinite}
@keyframes sisiPan{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}}
@keyframes sisiCone{0%,100%{opacity:.12}50%{opacity:.42}}
@keyframes sisiBlink{0%,55%{opacity:1}56%,100%{opacity:.15}}
@keyframes sisiRun{0%{transform:translateX(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(18px);opacity:0}}
@keyframes sisiCard{0%,10%{transform:translateX(0)}40%,70%{transform:translateX(3.6px)}100%{transform:translateX(0)}}
@keyframes sisiLed{0%,38%{fill:#ff3b42}39%,72%{fill:#22e07a}73%,100%{fill:#ff3b42}}
@keyframes sisiGlow{0%,100%{opacity:.1;transform:scale(.9)}50%{opacity:.42;transform:scale(1.15)}}
@keyframes sisiRay{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes sisiRip{0%{transform:scale(.8);opacity:.85}100%{transform:scale(1.95);opacity:0}}
@keyframes sisiPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.14)}}
@keyframes sisiWave{0%,100%{opacity:.2}50%{opacity:1}}
@keyframes sisiTile{0%,100%{opacity:.18}50%{opacity:.62}}
@keyframes sisiScan{0%{transform:translateY(0);opacity:0}15%{opacity:.8}85%{opacity:.8}100%{transform:translateY(8.2px);opacity:0}}
@keyframes sisiBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-.7px)}}
@keyframes sisiPing{0%{transform:scale(.7);opacity:.9}100%{transform:scale(2.2);opacity:0}}
@keyframes sisiCk{0%,8%{stroke-dashoffset:6}22%,86%{stroke-dashoffset:0}100%{stroke-dashoffset:6}}
@keyframes sisiPg{0%,12%{transform:scaleX(1)}46%,60%{transform:scaleX(-.9)}94%,100%{transform:scaleX(1)}}
@keyframes sisiMer{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.12)}}
@keyframes sisiOrb{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.sis-nd svg *{animation:none!important}.sis-nd svg .run,.sis-nd svg .rip,.sis-nd svg .on-ring{opacity:0}.sis-nd svg .t{opacity:.4}.sis-nd svg .glow{opacity:.25}.sis-nd svg .led{fill:#22e07a}}
`;
