// Abertura nova (Marcio, 20/11/2026), prévia aprovada:
//  0) A frase "o software por trás do hardware" surge em vermelho, em 3D, e recua para o fundo.
//  1) Ignição: uma bolinha branca sobe, acende e a tela ofusca e liga.
//  2) SIS em órbita 3D: os componentes do Sistema Integrado de Segurança (equipamentos, pessoas, procedimentos) giram
//     em torno do MOKED SIS⁺. Dá para arrastar em qualquer direção. Qualquer toque (num ícone ou fora) vai para o MESMO
//     lugar: a escolha de Áreas Moked. Não há botão "Entrar".
// Só toca na abertura de verdade (ver src/retomar.js). Com "reduzir movimento", mostra a órbita parada.
import { useEffect, useRef } from "react";

export const SIS_NOS = [
  { k: "cftv", t: "CFTV", d: "Câmeras e tempo de gravação", g: "eq", r: 0 },
  { k: "peri", t: "Perímetro", d: "Cerca, sensores e zonas", g: "eq", r: 0 },
  { k: "acesso", t: "Controle de acesso", d: "Portarias, catracas e credenciais", g: "eq", r: 0 },
  { k: "ilum", t: "Iluminação", d: "Pontos e quadrantes", g: "eq", r: 1 },
  { k: "panico", t: "Botão de pânico", d: "Acionamento e resposta", g: "eq", r: 1 },
  { k: "cco", t: "CCO", d: "Central de monitoramento", g: "eq", r: 1 },
  { k: "radio", t: "Rádios HT", d: "Comunicação da equipe", g: "eq", r: 2 },
  { k: "pessoas", t: "Pessoas", d: "Equipe, treinamento e maturidade", g: "pe", r: 2 },
  { k: "pop", t: "POPs", d: "Procedimentos operacionais padrão", g: "pr", r: 2 },
  { k: "mnp", t: "MNP", d: "Manual de normas e procedimentos", g: "pr", r: 0 },
];
const ICONES = {
  cftv: '<path d="M3 8h11v8H3z"/><path d="M14 11l6-3v8l-6-3"/>',
  peri: '<path d="M4 20V8M9 20V6M14 20V8M19 20V6M3 12h18M3 16h18"/>',
  acesso: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="12" cy="11" r="2.5"/><path d="M8 17c1-2 7-2 8 0"/>',
  ilum: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 00-4-10z"/>',
  panico: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
  radio: '<rect x="8" y="7" width="8" height="14" rx="2"/><path d="M12 7V3M10 11h4"/>',
  cco: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
  pessoas: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6"/><circle cx="17" cy="9" r="2.3"/><path d="M16 14c3 0 5 2 5 5"/>',
  pop: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 9l1.5 1.5L14 7.5M9 16h6"/>',
  mnp: '<path d="M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h10"/>',
};
const ANEIS = [{ tx: 1.15, tz: 0, k: 1, v: 0.22 }, { tx: 0.3, tz: -0.95, k: 0.8, v: -0.28 }, { tx: -0.95, tz: 0.65, k: 0.92, v: 0.18 }];
const INFO_PADRAO = '<b>SIS⁺ · Sistema Integrado de Segurança</b><span>o software por trás do hardware</span>';

const CSS = `
.sis{position:fixed;inset:0;z-index:60;background:radial-gradient(90% 60% at 50% 42%,#1a0a0e 0%,#08080c 58%,#050507 100%);color:#f3f4f6;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;overflow:hidden;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;transition:opacity .6s ease,transform .6s cubic-bezier(.5,0,.8,.3),filter .6s}
.sis.drag{cursor:grabbing}.sis.saindo{opacity:0;transform:scale(2.4);filter:blur(6px);pointer-events:none}
.sis-ghost{position:absolute;pointer-events:none;opacity:0;transition:opacity 1.6s ease}.sis.on .sis-ghost{opacity:1}
.sis-ghost .ring{position:absolute;inset:0;border-radius:50%;opacity:.2;background:conic-gradient(from 180deg,#b91c1c 0deg,#ef4444 25deg,#f97316 55deg,#facc15 95deg,#84cc16 135deg,#16a34a 180deg,#84cc16 225deg,#facc15 265deg,#f97316 305deg,#ef4444 335deg,#b91c1c 360deg);-webkit-mask:radial-gradient(circle,transparent 58%,#000 59%,#000 70%,transparent 71%);mask:radial-gradient(circle,transparent 58%,#000 59%,#000 70%,transparent 71%)}
.sis-ghost svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.sis-corpo{position:absolute;inset:0;opacity:0;transition:opacity 1s ease}.sis.on .sis-corpo{opacity:1}
.sis-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.sis-orb{position:absolute;left:0;top:0;border-radius:50%;display:grid;place-items:center;text-align:center;pointer-events:none;background:radial-gradient(circle at 50% 38%,#2a0d12,#0a0a0e 72%);border:1px solid #ff1e2766;box-shadow:0 0 44px rgba(255,30,39,.3),inset 0 0 28px rgba(255,30,39,.14)}
.sis-orb::after{content:"";position:absolute;inset:-10%;border-radius:50%;border:1px solid #ff1e2733;animation:sisPulso 3.2s ease-out infinite}
@keyframes sisPulso{0%{transform:scale(.9);opacity:.9}100%{transform:scale(1.4);opacity:0}}
.sis-logo{font-weight:700;letter-spacing:.28em;padding-left:.28em;font-size:var(--lf,18px)}.sis-logo b{color:#FF1E27}
.sis-orb small{display:block;font-size:calc(var(--lf,18px)*.42);letter-spacing:.3em;color:#9ca3af;margin-top:3px}
.sis-nd{position:absolute;left:0;top:0;border-radius:50%;display:grid;place-items:center;pointer-events:none;color:#e5e7eb;border:1px solid var(--c,#3a3f52);background:radial-gradient(circle at 35% 30%,#252a3a,#10121a 72%);box-shadow:0 6px 16px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.12);will-change:transform;transition:box-shadow .2s,border-color .2s,color .2s}
.sis-nd svg{width:48%;height:48%;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.sis-nd.eq{--c:#475569}.sis-nd.pe{--c:#38bdf866;color:#bae6fd}.sis-nd.pr{--c:#facc1566;color:#fde68a}
.sis-nd.hot{border-color:#ff5a61;color:#fff;box-shadow:0 0 26px rgba(255,30,39,.6),0 6px 16px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.2)}
.sis-hint{position:absolute;left:0;right:0;top:calc(34px + env(safe-area-inset-top,0px));text-align:center;font-size:11px;letter-spacing:.22em;color:#9ca3af;text-transform:uppercase;pointer-events:none}
.sis-info{position:absolute;left:0;right:0;bottom:calc(70px + env(safe-area-inset-bottom,0px));text-align:center;padding:0 24px;pointer-events:none}
.sis-info b{display:block;font-size:15px;letter-spacing:.06em}.sis-info span{display:block;font-size:12px;color:#9ca3af;margin-top:3px;letter-spacing:.04em}
.sis-leg{position:absolute;left:0;right:0;bottom:calc(26px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center;gap:14px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af;pointer-events:none}
.sis-leg i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;vertical-align:1px}
.sis-ign{position:absolute;inset:0;z-index:3;background:#000;perspective:900px;perspective-origin:50% 42%;transition:opacity .7s ease .1s}.sis-ign.fim{opacity:0;pointer-events:none}
.sis-dot{position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#fff;box-shadow:0 0 18px 4px rgba(255,255,255,.8);transform:translateY(42vh) scale(.4);opacity:0;transition:transform .95s cubic-bezier(.2,.7,.2,1),opacity .4s}
.sis-ign.sobe .sis-dot{transform:translateY(0) scale(1);opacity:1}
.sis-ign.acende .sis-dot{transform:translateY(0) scale(2.4);box-shadow:0 0 60px 24px rgba(255,255,255,.95);transition:transform .35s ease-in,box-shadow .35s}
.sis-flash{position:absolute;inset:0;background:#fff;opacity:0;transition:opacity .22s ease-in}.sis-ign.flash .sis-flash{opacity:1}.sis-ign.apaga .sis-flash{opacity:0;transition:opacity .75s ease-out}
.sis-frase{position:absolute;left:0;right:0;top:50%;margin-top:-21vmin;text-align:center;transform-style:preserve-3d;animation:sisFrase 2.5s cubic-bezier(.55,0,.25,1) .1s both;will-change:transform,opacity;pointer-events:none}
.sis-frase p{margin:0;font-weight:900;line-height:1.02;letter-spacing:-.02em;font-size:clamp(40px,11.5vw,128px);color:#E50914;text-shadow:0 1px 0 #c0070f,0 2px 0 #b0060e,0 3px 0 #a0060d,0 4px 0 #90050c,0 5px 0 #80050b,0 6px 0 #70040a,0 12px 22px rgba(0,0,0,.65),0 0 46px rgba(229,9,20,.45)}
@media (min-width:1024px){.sis-frase p{font-size:clamp(64px,8.2vw,150px)}}
@keyframes sisFrase{0%{transform:translate3d(0,0,520px) rotateX(-10deg);opacity:0}16%{opacity:1;transform:translate3d(0,0,160px) rotateX(-4deg)}46%{opacity:1;transform:translate3d(0,0,0) rotateX(0deg)}100%{opacity:0;transform:translate3d(0,-10%,-2800px) rotateX(16deg)}}
@media (prefers-reduced-motion:reduce){.sis-orb::after{animation:none}.sis-frase{display:none}}
`;

const reduzido = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const NS = "http://www.w3.org/2000/svg";

export default function AberturaSIS({ onFim }) {
  const raiz = useRef(null);
  const fim = useRef(onFim);
  fim.current = onFim;

  useEffect(() => {
    const el = raiz.current; if (!el) return undefined;
    const q = (s) => el.querySelector(s);
    const corpo = q(".sis-corpo"), fx = q(".sis-fx"), ign = q(".sis-ign"), info = q(".sis-info"), ghost = q(".sis-ghost");
    const aL = q(".g-aL"), aP = q(".g-aP"), ticks = q(".g-ticks");
    const reduz = reduzido();
    const tm = [];
    let vivo = true, raf = 0, saiu = false;

    // marcas do mostrador (geometria do CIS)
    let tk = "";
    for (let i = 0; i < 60; i++) { const u = i * 6 * Math.PI / 180, r1 = i % 5 ? 126 : 121, r2 = 130; tk += `<line x1="${(150 + Math.sin(u) * r1).toFixed(2)}" y1="${(150 - Math.cos(u) * r1).toFixed(2)}" x2="${(150 + Math.sin(u) * r2).toFixed(2)}" y2="${(150 - Math.cos(u) * r2).toFixed(2)}" stroke="#fff" stroke-opacity="${i % 5 ? 0.1 : 0.22}" stroke-width="${i % 5 ? 1 : 2}"/>`; }
    ticks.innerHTML = tk;
    const agulha = (v) => { const t = v * 1.8 * Math.PI / 180, P = (r, d = 0) => [150 + Math.sin(t + d) * r, 150 + Math.cos(t + d) * r];
      const a = P(134), b = P(98, 0.07), c = P(98, -0.07), h1 = P(86), h2 = P(120);
      aL.setAttribute("x1", h1[0]); aL.setAttribute("y1", h1[1]); aL.setAttribute("x2", h2[0]); aL.setAttribute("y2", h2[1]);
      aP.setAttribute("points", `${a.join(",")} ${b.join(",")} ${c.join(",")}`); };

    // elementos
    const aneisEl = ANEIS.map(() => { const p = document.createElementNS(NS, "path"); p.setAttribute("fill", "none"); p.setAttribute("stroke", "#ff1e27"); p.setAttribute("stroke-opacity", ".22"); p.setAttribute("stroke-width", "1"); fx.appendChild(p); return p; });
    const linhas = [], pacotes = [], els = [];
    SIS_NOS.forEach((n) => {
      const l = document.createElementNS(NS, "line"); l.setAttribute("stroke", "#ff1e27"); l.setAttribute("stroke-width", ".8"); fx.appendChild(l); linhas.push(l);
      const c = document.createElementNS(NS, "circle"); c.setAttribute("r", "2"); c.setAttribute("fill", "#ff6a70"); fx.appendChild(c); pacotes.push(c);
    });
    const orb = document.createElement("div"); orb.className = "sis-orb"; orb.innerHTML = '<div><div class="sis-logo">MOK<b>E</b>D</div><small>SIS<sup style="color:#FF1E27">+</sup></small></div>'; corpo.appendChild(orb);
    SIS_NOS.forEach((n) => { const d = document.createElement("div"); d.className = "sis-nd " + n.g; d.setAttribute("data-no", n.k); d.innerHTML = `<svg viewBox="0 0 24 24">${ICONES[n.k]}</svg>`; corpo.appendChild(d); els.push(d); });
    const cont = [0, 0, 0]; const nos = SIS_NOS.map((n) => ({ ...n, i: cont[n.r]++ }));
    nos.forEach((n) => { n.a0 = n.i / cont[n.r] * Math.PI * 2 + n.r * 0.7; });

    let W = 0, H = 0, cx = 0, cy = 0, R = 0, F = 0, N = 0;
    const medir = () => {
      W = window.innerWidth || 390; H = window.innerHeight || 800; cx = W / 2; cy = H * 0.45; R = Math.min(W * 0.37, H * 0.28); F = R * 3.6; N = Math.max(38, Math.min(62, R * 0.42));
      fx.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const D = R * 2 / 0.903; ghost.style.width = ghost.style.height = D + "px"; ghost.style.left = (cx - D / 2) + "px"; ghost.style.top = (cy - D / 2) + "px";
      const od = R * 0.66; orb.style.width = orb.style.height = od + "px"; orb.style.setProperty("--lf", Math.max(11, od * 0.17) + "px");
      els.forEach((e) => { e.style.width = e.style.height = N + "px"; });
    };
    medir(); window.addEventListener("resize", medir);

    let yaw = 0.5, pitch = 0.42, yv = 0, pv = 0, idle = 0, arr = false, mv = 0, lx = 0, sx = 0, sy = 0, ly = 0, tRel = 0, hot = -1, ultimo = 0;
    const rx = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
    const ry = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
    const rz = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };
    const pj = (p) => { const s = F / (F - p[2]); return { x: cx + p[0] * s, y: cy + p[1] * s, s, z: p[2] }; };
    const anel = (ri, th) => { const A = ANEIS[ri], Rr = R * A.k; return rx(ry(rz(rx([Rr * Math.cos(th), Rr * Math.sin(th), 0], A.tx), A.tz), yaw), pitch); };
    const pos = [];

    const quadro = (t) => {
      if (!vivo) return;
      const dt = Math.min(0.05, (t - (ultimo || t)) / 1000); ultimo = t; tRel += dt;
      if (!arr) { yaw += yv * dt; pitch += pv * dt; yv *= Math.pow(0.06, dt); pv *= Math.pow(0.06, dt); if (Math.abs(yv) < 0.05 && Math.abs(pv) < 0.05) { idle += dt; if (idle > 1.6 && !reduz) yaw += 0.16 * dt; } else idle = 0; }
      ANEIS.forEach((a, ri) => { let d = ""; for (let s = 0; s <= 72; s++) { const p = pj(anel(ri, s / 72 * Math.PI * 2)); d += (s ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1); } aneisEl[ri].setAttribute("d", d); });
      nos.forEach((n, k) => {
        const th = n.a0 + (reduz ? 0 : tRel) * ANEIS[n.r].v; const p = anel(n.r, th), s3 = pj(p); pos[k] = s3;
        const dep = Math.max(0, Math.min(1, (p[2] + R) / (2 * R))), e = els[k];
        e.style.transform = `translate(${(s3.x - N / 2).toFixed(1)}px,${(s3.y - N / 2).toFixed(1)}px) scale(${s3.s.toFixed(3)})`;
        e.style.opacity = (0.42 + 0.58 * dep).toFixed(2); e.style.zIndex = Math.round(s3.z + R * 2);
        const L = linhas[k]; L.setAttribute("x1", cx); L.setAttribute("y1", cy); L.setAttribute("x2", s3.x); L.setAttribute("y2", s3.y); L.setAttribute("stroke-opacity", (0.08 + 0.2 * dep).toFixed(2));
        const ph = ((t / 2800) + k * 0.173) % 1, pk = pacotes[k]; pk.setAttribute("cx", cx + (s3.x - cx) * ph); pk.setAttribute("cy", cy + (s3.y - cy) * ph); pk.setAttribute("opacity", (Math.sin(ph * Math.PI) * 0.9 * (0.3 + 0.7 * dep)).toFixed(2));
      });
      const ow = parseFloat(orb.style.width) || 0; orb.style.zIndex = Math.round(R * 2); orb.style.transform = `translate(${cx - ow / 2}px,${cy - ow / 2}px)`;
      agulha(reduz ? 72 : 62 + 22 * Math.sin(t / 2300) + 6 * Math.sin(t / 770));
      raf = requestAnimationFrame(quadro);
    };
    if (typeof requestAnimationFrame === "function") raf = requestAnimationFrame(quadro);

    const perto = (x, y) => { let m = -1, b = (N * 0.95) * (N * 0.95); pos.forEach((p, k) => { const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (d < b && p.z > -R * 0.2) { b = d; m = k; } }); return m; };
    const acender = (k) => { if (k === hot) return; if (hot >= 0) els[hot].classList.remove("hot"); hot = k;
      if (k >= 0) { els[k].classList.add("hot"); info.innerHTML = `<b>${nos[k].t}</b><span>${nos[k].d}</span>`; } else info.innerHTML = INFO_PADRAO; };

    // Qualquer toque (ícone ou fora) vai para as Áreas.
    const sair = () => { if (saiu || !vivo) return; saiu = true; el.classList.add("saindo"); tm.push(setTimeout(() => { if (fim.current) fim.current(); }, reduz ? 0 : 560)); };
    const baixo = (e) => { arr = true; mv = 0; sx = lx = e.clientX; sy = ly = e.clientY; yv = pv = 0; idle = 0; el.classList.add("drag"); acender(perto(e.clientX, e.clientY)); try { el.setPointerCapture(e.pointerId); } catch (_) { /* ok */ } };
    const mover = (e) => { if (arr) { const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; mv = Math.max(mv, Math.hypot(e.clientX - sx, e.clientY - sy)); yaw += dx * 0.009; pitch += dy * 0.009; yv = dx * 0.009 * 60; pv = dy * 0.009 * 60; idle = 0; } else acender(perto(e.clientX, e.clientY)); };
    const solta = () => { if (!arr) return; arr = false; el.classList.remove("drag"); acender(-1); if (mv < 9) sair(); };
    const cancela = () => { arr = false; el.classList.remove("drag"); acender(-1); };
    el.addEventListener("pointerdown", baixo); el.addEventListener("pointermove", mover); el.addEventListener("pointerup", solta); el.addEventListener("pointercancel", cancela);
    // teclado: Enter/Espaço também entram (acessibilidade)
    const tecla = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sair(); } };
    el.addEventListener("keydown", tecla);

    // linha do tempo: ignição → órbita
    const liga = () => { el.classList.add("on"); ign.classList.add("apaga"); tm.push(setTimeout(() => ign.classList.add("fim"), 800)); };
    if (reduz) { el.classList.add("on"); ign.classList.add("fim"); }
    else {
      tm.push(setTimeout(() => ign.classList.add("sobe"), 2300));
      tm.push(setTimeout(() => ign.classList.add("acende"), 3240));
      tm.push(setTimeout(() => ign.classList.add("flash"), 3520));
      tm.push(setTimeout(liga, 3760));
    }
    // tocar durante a ignição pula direto para a órbita
    const pulaIgn = () => { if (!el.classList.contains("on")) { tm.forEach(clearTimeout); tm.length = 0; el.classList.add("on"); ign.classList.add("fim"); } };
    ign.addEventListener("pointerdown", (e) => { e.stopPropagation(); pulaIgn(); });

    return () => {
      vivo = false; cancelAnimationFrame(raf); tm.forEach(clearTimeout); window.removeEventListener("resize", medir);
      el.removeEventListener("pointerdown", baixo); el.removeEventListener("pointermove", mover); el.removeEventListener("pointerup", solta); el.removeEventListener("pointercancel", cancela); el.removeEventListener("keydown", tecla);
    };
  }, []);

  return (
    <div className="sis" ref={raiz} data-testid="entrada-abertura" role="button" tabIndex={0} aria-label="SIS, Sistema Integrado de Segurança. Toque para escolher a sua área; arraste para girar.">
      <style>{CSS}</style>
      <div className="sis-ghost" aria-hidden="true"><div className="ring" /><svg viewBox="0 0 300 300"><g className="g-ticks" /><g style={{ filter: "drop-shadow(0 0 4px #fff8)" }} opacity=".5"><line className="g-aL" stroke="#f3f4f6" strokeWidth="3" strokeLinecap="round" /><polygon className="g-aP" fill="#f3f4f6" /></g></svg></div>
      <div className="sis-corpo">
        <svg className="sis-fx" aria-hidden="true" />
        <div className="sis-hint">Toque para entrar · arraste para girar</div>
        <div className="sis-info" dangerouslySetInnerHTML={{ __html: INFO_PADRAO }} />
        <div className="sis-leg"><span><i style={{ background: "#94a3b8" }} />Equipamentos</span><span><i style={{ background: "#7dd3fc" }} />Pessoas</span><span><i style={{ background: "#fde68a" }} />Procedimentos</span></div>
      </div>
      <div className="sis-ign" aria-hidden="true"><div className="sis-frase"><p>o software</p><p>por trás</p><p>do hardware</p></div><div className="sis-dot" /><div className="sis-flash" /></div>
    </div>
  );
}
