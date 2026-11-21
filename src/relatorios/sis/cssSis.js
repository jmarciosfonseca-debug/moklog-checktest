// CSS do relatório HTML SIS⁺ (Visão 360). Aprovado na prévia de 20/11/2026.
export const CSS_SIS = `
:root{--bg:#f4f5f7;--card:#fff;--fg:#14171c;--mut:#5b6472;--line:#dfe3e9;--red:#B21E27;--ink:#121212;--soft:#eef0f4;--ok:#16a34a;--warn:#b45309;--bad:#dc2626;--chip-fg:#fff}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0d0f13;--card:#161a21;--fg:#eef1f5;--mut:#9aa4b2;--line:#262c36;--soft:#1d222b;--ok:#4ade80;--warn:#fbbf24;--bad:#f87171;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0d0f13;--card:#161a21;--fg:#eef1f5;--mut:#9aa4b2;--line:#262c36;--soft:#1d222b;--ok:#4ade80;--warn:#fbbf24;--bad:#f87171;color-scheme:dark}
*{box-sizing:border-box}body{background:var(--bg);color:var(--fg);font:15px/1.5 Inter,system-ui,sans-serif;margin:0;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 40px}
.wrap{max-width:900px;margin:0 auto}
.l-mok{display:none}[data-regua=moked] .l-cli{display:none}[data-regua=moked] .l-mok{display:inline}
.fx,.fxbg{--c:var(--cli)}[data-regua=moked] .fx,[data-regua=moked] .fxbg{--c:var(--mok)}.fx{color:var(--c)}
:root{--t1:70%;--t2:85%}:root[data-regua=moked]{--t1:80%;--t2:92%}
.fxbg{background:linear-gradient(90deg,color-mix(in srgb,var(--c) 56%,#0b0d12) 0%,color-mix(in srgb,var(--c) 92%,#0b0d12) 55%,color-mix(in srgb,var(--c) 80%,#fff) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.30),inset 0 -1px 0 rgba(0,0,0,.20)}
.col i.fxbg{background:linear-gradient(0deg,color-mix(in srgb,var(--c) 56%,#0b0d12) 0%,color-mix(in srgb,var(--c) 92%,#0b0d12) 60%,color-mix(in srgb,var(--c) 80%,#fff) 100%)}
.fx{filter:none}:root:not([data-theme=dark]) .fx{filter:brightness(.82)}@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .fx{filter:none}}
.faixa-topo{background:var(--ink);color:#fff;margin:0 calc(-1*max(16px,env(safe-area-inset-left,0px)));padding:14px max(16px,env(safe-area-inset-left,0px));border-bottom:3px solid var(--red)}
.faixa-topo .wrap{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:space-between}
.marca{font:700 20px/1 "Space Grotesk",Inter,sans-serif;letter-spacing:.18em}.marca small{display:block;font:500 10px/1.3 Inter;letter-spacing:.14em;color:#aab2c0;margin-top:5px}
.seg{display:inline-flex;background:#242831;border-radius:10px;padding:3px}.seg button{border:0;background:transparent;color:#c8cfdb;font:600 12px Inter;padding:8px 12px;border-radius:8px;cursor:pointer}.seg button[aria-pressed=true]{background:var(--red);color:#fff}
.previa{background:#fff4d6;color:#6b4a00;border:1px solid #f0d58a;border-radius:10px;padding:10px 12px;margin:14px 0 0;font-size:13px}
.vista[hidden]{display:none}.voltar{display:inline-block;margin:16px 0 4px;color:var(--mut);text-decoration:none;font-weight:600;font-size:14px}
h2,h3,h4{font-family:"Space Grotesk",Inter,sans-serif;text-wrap:balance}h3{font-size:19px;margin:30px 0 6px}h4{font-size:14px;margin:18px 0 6px;letter-spacing:.04em;text-transform:uppercase;color:var(--mut)}
.hero{display:flex;gap:22px;align-items:center;flex-wrap:wrap;margin:18px 0 8px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px}
.hero-dial{flex:0 0 auto;text-align:center}.hero-txt{flex:1 1 280px;min-width:0}.eyebrow{margin:0;color:var(--mut);font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:600}
.hero h2{margin:4px 0 14px;font-size:26px;line-height:1.15}
.dial{width:220px;height:220px;display:block;margin:0 auto;filter:drop-shadow(0 6px 14px rgba(0,0,0,.28))}.dial .agulha{transform:rotate(0deg);transition:transform 1.4s cubic-bezier(.2,.8,.2,1)}
.d-moked{font:600 7.5px Inter;letter-spacing:.34em;fill:#8f99a8}.d-num{font:700 44px "Space Grotesk",Inter;fill:#fff}.d-pc{font-size:20px}.d-faixa{font:700 8.5px Inter;letter-spacing:.14em;fill:#e5e7eb}.d-sis{font:800 15px "Space Grotesk",Inter;fill:#fff;letter-spacing:.06em}.d-plus{fill:#E5262E}
.cap{font:600 9px Inter;letter-spacing:.2em;color:var(--mut);margin-top:6px}
.duo{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.duo div{background:var(--soft);border-radius:12px;padding:10px 12px;min-width:0}.duo small{display:block;color:var(--mut);font-size:11px;line-height:1.25}.duo b{font:700 22px "Space Grotesk",Inter}
.chave{margin:14px 0 0;padding:12px 14px;border-left:4px solid var(--red);background:var(--soft);border-radius:0 10px 10px 0;font-weight:600}
.met{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 16px;margin:12px 0}.met summary{cursor:pointer;font-weight:700}.met p{color:var(--mut);margin:10px 0 0}
.topo-sec{display:flex;align-items:end;justify-content:space-between;gap:10px;flex-wrap:wrap}.topo-sec h3{margin:26px 0 8px}
.mini{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:8px;padding:6px 10px;font:600 12px Inter;cursor:pointer;margin-left:6px}
.camada{background:var(--card);border:1px solid var(--line);border-radius:14px;margin:10px 0;overflow:hidden}
.camada>summary,.camada.g{list-style:none;display:grid;grid-template-columns:34px minmax(0,1fr) 90px 46px auto 14px;gap:10px;align-items:center;padding:14px;cursor:pointer}
.camada.g{grid-template-columns:34px minmax(0,1fr) auto;opacity:.85;cursor:default}.camada summary::-webkit-details-marker{display:none}
.cod{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:9px;background:var(--ink);color:#fff;font:700 13px "Space Grotesk",Inter}
.cn b{display:block;line-height:1.2}.cn small,.tn small{color:var(--mut);font-size:12px;display:block;line-height:1.3;margin-top:2px}
.barra{position:relative;height:6px;background:var(--soft);border-radius:99px;box-shadow:inset 0 1px 2px rgba(0,0,0,.18)}.barra i{display:block;height:100%;width:var(--w);border-radius:99px}.barra::before,.barra::after,.bar::before,.bar::after{content:'';position:absolute;top:-3px;bottom:-3px;width:1px;background:var(--mut);opacity:.5}.barra::before,.bar::before{left:var(--t1)}.barra::after,.bar::after{left:var(--t2)}
.cv{font:700 16px "Space Grotesk",Inter;text-align:right}.seta{color:var(--mut);transition:transform .2s}details[open]>summary .seta{transform:rotate(180deg)}
.chip{display:inline-block;color:var(--chip-fg);font:700 11px Inter;border-radius:99px;padding:3px 10px;white-space:nowrap}
.chip.fxbg{background:color-mix(in srgb,var(--c) 13%,transparent);color:color-mix(in srgb,var(--c) 58%,#000);border:1px solid color-mix(in srgb,var(--c) 40%,transparent);box-shadow:none;letter-spacing:.02em}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .chip.fxbg{color:color-mix(in srgb,var(--c) 78%,#fff)}}:root[data-theme=dark] .chip.fxbg{color:color-mix(in srgb,var(--c) 78%,#fff)}.chip.neutro{background:var(--soft);color:var(--mut)}
.reqs{list-style:none;margin:0;padding:0 14px 14px}.req{border-top:1px solid var(--line);padding:12px 0}.req-topo{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap}.req-nome{flex:1 1 200px;font-weight:600;min-width:0}
.st{font:700 11px Inter;border-radius:6px;padding:3px 8px;white-space:nowrap;color:#fff}.st.s1{background:#15803d}.st.s05{background:#b45309}.st.s0{background:#b91c1c}.st.conf{background:transparent;color:var(--warn);border:1.5px dashed var(--warn)}
.peso{font-size:8px;letter-spacing:1px;color:var(--fg);white-space:nowrap}.peso i{font-style:normal;opacity:.2}
.req-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:12px;color:var(--mut);align-items:center}.orig{border:1px solid var(--line);border-radius:6px;padding:1px 7px;font-weight:600}.orig.app{color:var(--ok)}
.fazer{margin-top:10px;background:var(--soft);border-left:4px solid var(--red);border-radius:0 10px 10px 0;padding:10px 12px}.fazer b{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--red)}:root[data-theme=dark] .fazer b{color:#ff8a8f}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .fazer b{color:#ff8a8f}}.fazer p{margin:4px 0 8px}
.tags{display:flex;gap:6px;flex-wrap:wrap}.tag{font:600 11px Inter;border-radius:6px;padding:3px 8px;background:var(--card);border:1px solid var(--line)}.tag.ganho{background:#15803d;border-color:#15803d;color:#fff}.tag.fI{border-color:#b91c1c;color:#b91c1c}.tag.f90{border-color:#b45309;color:#b45309}.tag.fE{border-color:#475569;color:#475569}
:root[data-theme=dark] .tag.fI{color:#ff8a8f}@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .tag.fI{color:#ff8a8f}:root:not([data-theme=light]) .tag.f90{color:#fbbf24}:root:not([data-theme=light]) .tag.fE{color:#aab4c4}}
.top{list-style:none;padding:0;margin:10px 0;display:grid;gap:8px}.top li{display:grid;grid-template-columns:34px minmax(0,1fr) auto auto;gap:10px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.peq{color:var(--mut);margin:2px 0 8px}.mut{color:var(--mut)}.lista{padding-left:18px}.lista li{margin:6px 0}
.plano{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;align-items:end;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:10px 0}
.passo{text-align:center;min-width:0}.passo .col{height:110px;display:flex;align-items:end;justify-content:center;background:var(--soft);border-radius:10px;margin-bottom:8px;overflow:hidden}.passo .col i{width:100%;display:block;border-radius:10px 10px 0 0}.passo b{font:700 20px "Space Grotesk",Inter;display:block}.passo small{color:var(--mut);font-size:11px;line-height:1.2;display:block}.passo.meta small{font-weight:700;color:var(--fg)}
.cen{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.cen>div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.cen small{color:var(--mut)}.cen b{display:block;font:700 22px "Space Grotesk",Inter}.bar{position:relative;height:6px;background:var(--soft);border-radius:99px;box-shadow:inset 0 1px 2px rgba(0,0,0,.18);margin-top:7px}.bar i{display:block;height:100%;border-radius:99px}
.rank{display:grid;gap:10px}.pcard{display:grid;grid-template-columns:30px minmax(0,1fr) auto 14px;gap:12px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;text-decoration:none;color:inherit}.pcard:hover{border-color:var(--red)}
.rk{font:700 18px "Space Grotesk",Inter;color:var(--mut)}.pc-mid small{display:block;color:var(--mut);font-size:12px}.pc-v{text-align:right}.pc-v b{display:block;font:700 24px "Space Grotesk",Inter}.seta2{color:var(--mut);font-size:22px}
.tb{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card)}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}th{background:var(--soft);font-weight:700;white-space:nowrap}
.heat td,.heat th{text-align:center}.heat td:first-child,.heat th:first-child{text-align:left}.heat a{color:inherit;font-weight:600;text-decoration:none}.cel{display:inline-block;min-width:38px;border-radius:8px;padding:5px 6px;color:#fff;font-weight:700;font-size:13px}.cel.fxbg{background:linear-gradient(155deg,color-mix(in srgb,var(--c) 84%,#fff),color-mix(in srgb,var(--c) 66%,#0b0d12));text-shadow:0 1px 0 rgba(0,0,0,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.leg{color:var(--mut);font-size:12px}.conta{margin:8px 0 0;font-size:13px}.conta.tot{margin-top:16px;padding:12px;background:var(--soft);border-radius:10px}.anexo{margin-top:26px}
.rodape{margin-top:36px;color:var(--mut);font-size:12px;text-align:center}
@media (min-width:561px){.camada>summary{grid-template-columns:34px minmax(0,1fr) 170px 46px auto 14px}}
@media (max-width:560px){.hero-dial{flex:1 1 100%}.camada>summary{grid-template-columns:34px minmax(0,1fr) 40px 14px;row-gap:8px}.camada>summary .barra{grid-column:2/4;grid-row:2}.camada>summary .chip{grid-column:2;grid-row:3;justify-self:start}.camada>summary .cv{grid-column:3;grid-row:1}.camada>summary .seta{grid-column:4;grid-row:1}
.top li{grid-template-columns:34px minmax(0,1fr)}.top li .tag{grid-column:2;justify-self:start}.duo b{font-size:18px}.hero h2{font-size:22px}.plano{padding:12px;gap:6px}.cen{grid-template-columns:1fr}.pcard{grid-template-columns:24px minmax(0,1fr) auto}.seta2{display:none}}
@media (prefers-reduced-motion:reduce){.dial .agulha{transition:none}}
`;
