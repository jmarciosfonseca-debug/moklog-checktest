// Esfera das áreas (Marcio, 22/11/2026): gira com o dedo em qualquer direção, zoom por pinça/rolagem; a área mais próxima do
// centro vira a ativa (aoAtivar) e o cenário de fundo inteiro troca. Motor imperativo (canvas 2D), sem biblioteca 3D.
// Geometria pura exportada para teste; iniciarEsfera devolve null quando não há canvas 2D (aí a tela usa os cartões).
const TAU = Math.PI * 2, RAD = Math.PI / 180;
export const vetor = (lon, lat) => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
export const posicoes = (n) => Array.from({ length: n }, (_, i) => ({ lon: (i * TAU) / n, lat: (i % 2 ? -1 : 1) * 24 * RAD }));
export const girar = (v, yaw, pitch) => { const ca = Math.cos(yaw), sa = Math.sin(yaw), x = v[0] * ca + v[2] * sa, z = -v[0] * sa + v[2] * ca, cb = Math.cos(pitch), sb = Math.sin(pitch); return [x, v[1] * cb - z * sb, v[1] * sb + z * cb]; };
export const maisProximo = (a, b) => { let d = (((a - b) % TAU) + TAU) % TAU; if (d > Math.PI) d -= TAU; return b + d; };
// Índice da área que está de frente (maior z depois do giro).
export const ativoDe = (pos, yaw, pitch) => { let m = -2, bi = 0; pos.forEach((p, i) => { const z = girar(vetor(p.lon, p.lat), yaw, pitch)[2]; if (z > m) { m = z; bi = i; } }); return bi; };

export function iniciarEsfera({ raiz, canvas, nos, fundos, aoAtivar, inicial = 0, win = typeof window !== "undefined" ? window : null }) {
  let cx = null; try { cx = canvas && canvas.getContext && canvas.getContext("2d"); } catch (e) { cx = null; }
  if (!cx || !raiz || !win) return null;
  const N = nos.length, pos = posicoes(N), vs = pos.map((p) => vetor(p.lon, p.lat));
  const pts = []; for (let k = 0; k < 70; k++) { const u = Math.random() * 2 - 1, a = Math.random() * TAU, r = Math.sqrt(1 - u * u); pts.push([r * Math.cos(a), u, r * Math.sin(a)]); }
  let W = 1, H = 1, DPR = 1, R = 100, CX = 0, CY = 0;
  let yaw = -pos[inicial].lon, pitch = pos[inicial].lat, vy = 0, vp = 0, zoom = 1, zt = 1, tgt = { y: yaw, p: pitch }, arrastando = false, movido = 0, ativo = -1, tocado = false, parado = false, raf = 0;
  let noBaixo = -1, pinca0 = 0, zoom0 = 1, lx = 0, ly = 0, lt = 0; const ptr = {};
  const medir = () => { W = raiz.clientWidth || 1; H = raiz.clientHeight || 1; DPR = Math.min(2, win.devicePixelRatio || 1); canvas.width = W * DPR; canvas.height = H * DPR; R = Math.min(W * 0.36, H * 0.22); CX = W / 2; CY = H * 0.42; };
  const focar = (i) => { const p = pos[i]; tgt = { y: maisProximo(-p.lon, yaw), p: p.lat }; vy = vp = 0; tocado = true; };
  const baixo = (e) => {
    if (e.target.closest && e.target.closest("button,a,label")) return;
    ptr[e.pointerId] = { x: e.clientX, y: e.clientY }; const ids = Object.keys(ptr);
    if (ids.length === 2) { const a = ptr[ids[0]], b = ptr[ids[1]]; pinca0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = zt; }
    const dn = e.target.closest && e.target.closest("[data-no]"); noBaixo = dn ? +dn.getAttribute("data-no") : -1;
    arrastando = true; tgt = null; movido = 0; vy = vp = 0; lx = e.clientX; ly = e.clientY; lt = win.performance.now(); tocado = true;
    try { raiz.setPointerCapture(e.pointerId); } catch (er) { /* sem captura: segue */ }
  };
  const move = (e) => {
    if (!ptr[e.pointerId]) return; ptr[e.pointerId] = { x: e.clientX, y: e.clientY }; const ids = Object.keys(ptr);
    if (ids.length >= 2) { const a = ptr[ids[0]], b = ptr[ids[1]]; if (pinca0 > 0) zt = Math.max(0.6, Math.min(2.2, (zoom0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinca0)); movido = 99; lx = e.clientX; ly = e.clientY; return; }
    const agora = win.performance.now(), dx = e.clientX - lx, dy = e.clientY - ly, dt = Math.max(8, agora - lt), s = 1 / (R * zoom); movido += Math.abs(dx) + Math.abs(dy);
    yaw += dx * s; pitch = Math.max(-1.05, Math.min(1.05, pitch + dy * s)); vy = 0.7 * vy + 0.3 * ((dx * s) / dt) * 1000; vp = 0.7 * vp + 0.3 * ((dy * s) / dt) * 1000; lx = e.clientX; ly = e.clientY; lt = agora;
  };
  const solta = (e) => {
    delete ptr[e.pointerId]; const ids = Object.keys(ptr); if (ids.length) { lx = ptr[ids[0]].x; ly = ptr[ids[0]].y; pinca0 = 0; return; }
    if (!arrastando) return; arrastando = false; vy *= 0.55; vp *= 0.55; if (movido < 8 && noBaixo >= 0) focar(noBaixo);
  };
  const roda = (e) => { e.preventDefault(); tocado = true; zt = Math.max(0.6, Math.min(2.2, zt * Math.exp(-e.deltaY * 0.0015))); };
  const tecla = (e) => { if (e.key === "ArrowRight") focar((ativo + 1) % N); else if (e.key === "ArrowLeft") focar((ativo + N - 1) % N); };
  const P = (v, Rz) => [CX + v[0] * Rz, CY - v[1] * Rz, v[2]];
  let ultimo = win.performance.now(); const t0 = ultimo;
  const quadro = (agora) => {
    if (parado) return; raf = win.requestAnimationFrame(quadro);
    const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora; const t = (agora - t0) / 1000;
    zoom += (zt - zoom) * (1 - Math.exp(-dt * 5));
    if (!arrastando) {
      if (tgt) { yaw += (tgt.y - yaw) * (1 - Math.exp(-dt * 5)); pitch += (tgt.p - pitch) * (1 - Math.exp(-dt * 5)); }
      else { yaw += vy * dt; pitch = Math.max(-1.05, Math.min(1.05, pitch + vp * dt)); const f = Math.exp(-dt * 2.6); vy *= f; vp *= f; if (Math.abs(vy) + Math.abs(vp) < 0.25 && ativo >= 0) { const p = pos[ativo]; tgt = { y: maisProximo(-p.lon, yaw), p: p.lat }; } }
      const y0 = -pos[inicial].lon; // convite: balança uma vez para mostrar que gira
      if (!tocado && t > 1.2 && t < 3.6) { yaw = y0 + Math.sin(((t - 1.2) / 2.4) * TAU) * 0.32; tgt = null; } else if (!tocado && t >= 3.6 && !tgt) tgt = { y: y0, p: pos[inicial].lat };
    }
    const Rz = R * zoom, rv = vs.map((v) => girar(v, yaw, pitch)); let m = -2, bi = 0; rv.forEach((v, i) => { if (v[2] > m) { m = v[2]; bi = i; } });
    if (bi !== ativo) { ativo = bi; if (aoAtivar) aoAtivar(bi); }
    const D = pos[bi], oy = maisProximo(yaw, -D.lon) + D.lon, op = pitch - D.lat, kb = 1.04 + (0.5 - 0.5 * Math.cos(t * 0.35)) * 0.05 + (zoom - 1) * 0.05;
    if (fundos[bi]) fundos[bi].style.transform = `translate3d(${(oy * 46 + Math.sin(t * 0.3) * 10).toFixed(1)}px,${(op * 40).toFixed(1)}px,0) scale(${kb.toFixed(4)})`;
    cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, W, H);
    cx.strokeStyle = "rgba(255,255,255,.28)"; cx.lineWidth = 1; cx.beginPath(); cx.arc(CX, CY, Rz, 0, TAU); cx.stroke();
    for (let i = 0; i < pts.length; i++) { const p = P(girar(pts[i], yaw, pitch), Rz); cx.fillStyle = `rgba(190,225,255,${p[2] > 0 ? 0.45 : 0.08})`; cx.fillRect(p[0] - 1, p[1] - 1, 2, 2); }
    for (let i = 0; i < N; i++) {
      const a = P(rv[i], Rz), nx = rv[(i + 1) % N]; let p0 = a;
      for (let j = 1; j <= 16; j++) { const q = j / 16, mm = [rv[i][0] * (1 - q) + nx[0] * q, rv[i][1] * (1 - q) + nx[1] * q, rv[i][2] * (1 - q) + nx[2] * q], l = Math.hypot(mm[0], mm[1], mm[2]) || 1, p1 = P([mm[0] / l, mm[1] / l, mm[2] / l], Rz); cx.strokeStyle = `rgba(255,90,70,${p1[2] > 0 ? 0.35 : 0.06})`; cx.lineWidth = 1.3; cx.beginPath(); cx.moveTo(p0[0], p0[1]); cx.lineTo(p1[0], p1[1]); cx.stroke(); p0 = p1; }
    }
    for (let i = 0; i < N; i++) {
      const a = P(rv[i], Rz), z = rv[i][2], on = i === bi, fr = (z + 1) / 2, sc = 0.62 + fr * 0.5;
      cx.fillStyle = on ? "rgba(255,74,60,1)" : `rgba(255,255,255,${0.25 + fr * 0.6})`; cx.beginPath(); cx.arc(a[0], a[1], on ? 6 : 3.5, 0, TAU); cx.fill();
      if (on) { const k = (t * 1.2) % 1; cx.strokeStyle = `rgba(255,74,60,${0.7 - k * 0.7})`; cx.lineWidth = 2; cx.beginPath(); cx.arc(a[0], a[1], 8 + k * 18, 0, TAU); cx.stroke(); }
      const n = nos[i]; if (!n) continue; n.style.opacity = (z > 0.05 && !on ? 0.5 + fr * 0.5 : 0).toFixed(2); n.style.pointerEvents = z > 0.05 && !on ? "auto" : "none";
      n.style.transform = `translate3d(${a[0].toFixed(1)}px,${(a[1] + 12).toFixed(1)}px,0) translate(-50%,0) scale(${sc.toFixed(3)})`;
    }
  };
  medir(); win.addEventListener("resize", medir); win.addEventListener("keydown", tecla);
  raiz.addEventListener("pointerdown", baixo); raiz.addEventListener("pointermove", move); raiz.addEventListener("pointerup", solta); raiz.addEventListener("pointercancel", solta); raiz.addEventListener("wheel", roda, { passive: false });
  raf = win.requestAnimationFrame(quadro);
  return {
    focar, aproximar: () => { zt = 3.2; },
    parar: () => { parado = true; win.cancelAnimationFrame(raf); win.removeEventListener("resize", medir); win.removeEventListener("keydown", tecla); raiz.removeEventListener("pointerdown", baixo); raiz.removeEventListener("pointermove", move); raiz.removeEventListener("pointerup", solta); raiz.removeEventListener("pointercancel", solta); raiz.removeEventListener("wheel", roda); },
  };
}
