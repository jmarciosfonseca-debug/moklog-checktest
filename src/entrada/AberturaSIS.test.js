import React, { act } from "react";
import { createRoot } from "react-dom/client";
import AberturaSIS from "./AberturaSIS";

// jsdom não desenha canvas nem tem PointerEvent: a abertura tolera canvas nulo e aqui simulamos os ponteiros.
beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null); });
afterAll(() => { jest.restoreAllMocks(); });

const esperar = (ms) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const ponteiro = (el, tipo, x, y, id = 1) => {
  const e = new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(e, "pointerId", { value: id });
  el.dispatchEvent(e);
};
async function montar(onFim = jest.fn(), satelites = true) { // os testes da órbita ligam os satélites (no app o padrão é a abertura limpa)
  const host = document.createElement("div"); document.body.appendChild(host); const root = createRoot(host);
  await act(async () => root.render(<AberturaSIS onFim={onFim} satelites={satelites} />));
  const ab = host.querySelector('[data-testid="entrada-abertura"]');
  const sr = ab.shadowRoot;
  const fechar = async () => { await act(async () => root.unmount()); host.remove(); };
  return { host, root, ab, sr, fechar, onFim, sis: sr.querySelector("#sis"), api: ab.__sis };
}
// pula a ignição e espera o 1º quadro da órbita
async function aberta(ctx) { ponteiro(ctx.sr.querySelector("#ign"), "pointerdown", 5, 5); await esperar(120); ponteiro(ctx.sis, "pointerup", 5, 5); await esperar(30); }
// ícone mais à frente (mais fácil de acertar) e um instante em que o centro está livre de ícones
const noDaFrente = (api) => { const ns = api.nos(); let m = 0; ns.forEach((p, i) => { if (p.z > ns[m].z) m = i; }); return ns[m]; };
async function centroLivre(api) { for (let i = 0; i < 150; i++) { const { cx, cy, R } = api.centro(); if (api.nos().every((p) => p.z < -R * 0.2 || Math.hypot(p.x - cx, p.y - cy) > 90)) return true; await esperar(30); } return false; }

test("monta a ignição e a órbita com os 11 componentes do SIS num Shadow DOM, com o botão Entrar", async () => {
  const c = await montar();
  try {
    expect(c.sr).not.toBeNull();
    expect(c.sr.querySelectorAll("[data-no]").length).toBe(11);
    expect(c.sr.querySelector(".sis-ign .sis-dot")).not.toBeNull(); // a ignição é só a bolinha branca
    expect(c.sr.querySelector(".sis-frase")).toBeNull();
    expect(c.sr.textContent).not.toMatch(/software por tr[aá]s|do hardware/i); // conceito retirado da abertura e da História
    expect([...c.sr.querySelectorAll("button")].some((b) => b.textContent.trim() === "Entrar")).toBe(true);
    expect(c.sr.querySelector("style").textContent).toContain(".sis-nd"); // estilos dentro do shadow, não no app
    expect(document.head.querySelector("style")?.textContent || "").not.toContain(".sis-nd");
    expect(c.sis.classList.contains("on")).toBe(false); // durante a ignição a órbita ainda não "ligou"
    ponteiro(c.sr.querySelector("#ign"), "pointerdown", 5, 5); // tocar na ignição pula para a órbita
    expect(c.sis.classList.contains("on")).toBe(true);
    expect(c.sr.querySelector("#ign").classList.contains("fim")).toBe(true);
  } finally { await c.fechar(); }
});

test("botão Entrar e tocar fora dos ícones levam às Áreas; Enter e Espaço também", async () => {
  const c1 = await montar();
  try { await aberta(c1); c1.sr.querySelector("#entrar").click(); await esperar(700); expect(c1.onFim).toHaveBeenCalledTimes(1); } finally { await c1.fechar(); }
  const c2 = await montar();
  try { await aberta(c2); ponteiro(c2.sis, "pointerdown", 4, 4); ponteiro(c2.sis, "pointerup", 4, 4); await esperar(700); expect(c2.onFim).toHaveBeenCalledTimes(1); } finally { await c2.fechar(); }
  const c3 = await montar();
  try { c3.ab.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })); await esperar(700); expect(c3.onFim).toHaveBeenCalledTimes(1); } finally { await c3.fechar(); }
});

test("segurar um ícone enche o anel, abre o cartão do que ele alimenta e acende o ponto; tocar só dica", async () => {
  const c = await montar();
  try {
    await aberta(c);
    const p = noDaFrente(c.api);
    ponteiro(c.sis, "pointerdown", p.x, p.y);
    await esperar(300);
    expect(c.api.estado().lido).toBe(0);
    expect(Math.max(...c.api.estado().prog)).toBeGreaterThan(0.2); // anel enchendo
    await esperar(700);
    expect(c.api.estado().lido).toBe(1);
    expect(c.sr.querySelector("#card").classList.contains("v")).toBe(true);
    expect(c.sr.querySelectorAll("#cf .chip").length).toBeGreaterThan(0);
    expect(c.sr.querySelectorAll("#dots i.on").length).toBe(1);
    ponteiro(c.sis, "pointerup", p.x, p.y);
    await esperar(50);
    expect(c.onFim).not.toHaveBeenCalled(); // soltar depois de abrir o cartão não entra nas Áreas
    c.sr.querySelector("#cx").click(); // Fechar
    expect(c.sr.querySelector("#card").classList.contains("v")).toBe(false);
  } finally { await c.fechar(); }
});

test("soltar antes de completar esvazia o anel e não marca o ícone como lido", async () => {
  const c = await montar();
  try {
    await aberta(c);
    const p = noDaFrente(c.api);
    ponteiro(c.sis, "pointerdown", p.x, p.y); await esperar(250);
    ponteiro(c.sis, "pointerup", p.x, p.y); await esperar(500);
    expect(c.api.estado().lido).toBe(0);
    expect(Math.max(...c.api.estado().prog)).toBe(0);
  } finally { await c.fechar(); }
});

test("segurar o MOKED explode e abre a História; o Universo monta o grafo; Escape volta para a órbita", async () => {
  const c = await montar();
  try {
    await aberta(c);
    expect(await centroLivre(c.api)).toBe(true);
    const { cx, cy } = c.api.centro();
    ponteiro(c.sis, "pointerdown", cx, cy);
    await esperar(1500);
    expect(c.api.estado().boom || c.api.entrando()).toBe(true);
    ponteiro(c.sis, "pointerup", cx, cy);
    for (let i = 0; i < 60 && !c.api.estado().mergulhando; i++) await esperar(100);
    for (let i = 0; i < 60 && c.api.entrando(); i++) await esperar(100); // sequência termina e a órbita é restaurada
    expect(c.api.estado().mergulhando).toBe(true);
    expect(c.sr.querySelector("#dive").hidden).toBe(false);
    expect(c.sr.querySelector("#p-hist").classList.contains("on")).toBe(true);
    expect(c.sr.querySelectorAll(".cap").length).toBe(7);
    expect(c.sr.textContent).toContain("De Israel para o Brasil");
    const hist = c.sr.querySelector("#hist").textContent; // história real, do site oficial da Moked
    expect(hist).toContain("1995"); expect(hist).toContain("Yehuda Carmi"); expect(hist).toContain("Tenente-Coronel das Forças Armadas de Israel");
    expect(hist).toContain("Moked On-line"); expect(hist).toContain("ISO 9001"); expect(hist).toContain("ISO 37001"); expect(hist).toContain("Moked 4.0");
    expect(hist).not.toMatch(/software por tr[aá]s|hardware/i);
    expect(c.sr.textContent).not.toMatch(/Protótipo|PROTÓTIPO/);
    c.sr.querySelector('.tab[data-a="univ"]').click();
    await esperar(80);
    expect(c.sr.querySelector("#p-univ").classList.contains("on")).toBe(true);
    expect(c.api.estado().nodes).toBeGreaterThan(30); // centro + 3 pilares + módulos
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await esperar(900);
    expect(c.api.estado().mergulhando).toBe(false);
    expect(c.sr.querySelector("#dive").hidden).toBe(true);
    expect(c.onFim).not.toHaveBeenCalled();
  } finally { await c.fechar(); }
}, 20000);

test("na História, 'Entrar nas Áreas' sai direto para a escolha de área", async () => {
  const c = await montar();
  try {
    await aberta(c);
    c.api.mergulhar();
    await esperar(100);
    expect(c.api.estado().mergulhando).toBe(true);
    c.sr.querySelector("#entrar2").click();
    await esperar(700);
    expect(c.onFim).toHaveBeenCalledTimes(1);
  } finally { await c.fechar(); }
});

test("desmontar limpa tudo: sem Enter pendente, sem timers e sem erro depois", async () => {
  const erro = jest.spyOn(console, "error").mockImplementation(() => {});
  const c = await montar();
  await aberta(c);
  await c.fechar();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await esperar(900);
  expect(c.onFim).not.toHaveBeenCalled();
  expect(erro).not.toHaveBeenCalled();
  erro.mockRestore();
});

test("reduzir movimento: a órbita já abre ligada, sem ignição", async () => {
  const antes = window.matchMedia;
  window.matchMedia = (q) => ({ matches: /reduced-motion/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  const c = await montar();
  try {
    expect(c.sis.classList.contains("on")).toBe(true);
    expect(c.sr.querySelector("#ign").classList.contains("fim")).toBe(true);
  } finally { await c.fechar(); window.matchMedia = antes; }
});

test("abertura sem o som da ignição (22/11/2026): sem zumbido de carga nem explosão; fica só o ping suave do cartão", () => {
  const fs = require("fs"), path = require("path");
  const src = fs.readFileSync(path.join(__dirname, "sisMotor.js"), "utf8");
  expect(src).toContain("function cargaSom(){}");
  expect(src).toContain("function somExplosao(){}");
  expect(src).not.toMatch(/createOscillator\(\);chO\.type='sawtooth'/);
  expect(src).not.toContain("tom(120,32,.9");
  expect(src).toContain("function somPing(){");
});

test("abertura limpa (padrão, 22/11/2026): sem satélites; só o MOKED, que ao segurar ainda carrega e leva à História", async () => {
  const c = await montar(jest.fn(), false);
  try {
    expect(c.sr.querySelectorAll("[data-no]").length).toBe(0);
    expect(c.sis.classList.contains("limpa")).toBe(true);
    expect(c.sr.querySelector(".sis-orb")).not.toBeNull(); expect(c.sr.querySelector(".sis-glow")).not.toBeNull();
    expect(c.sr.querySelector("style").textContent).toContain(".sis.limpa .sis-fx,.sis.limpa .sis-dots,.sis.limpa .sis-leg");
    await aberta(c);
    expect(c.sr.querySelector("#hint").textContent).toMatch(/MOKED/); expect(c.sr.querySelector("#hint").textContent).not.toMatch(/ícone/);
    expect(typeof c.api.mergulhar).toBe("function"); // a viagem até a História continua disponível
    const { cx, cy } = c.api.centro();
    ponteiro(c.sis, "pointerdown", cx, cy); await esperar(2100); ponteiro(c.sis, "pointerup", cx, cy); await esperar(200);
    expect(c.onFim).not.toHaveBeenCalled(); // segurar o MOKED não é "entrar": dispara a viagem
  } finally { await c.fechar(); }
});

test("abertura limpa: o centro pulsa (mesmo com animações reduzidas) e o Entrar é translúcido", () => {
  const { CSS_SIS } = require("./sisCss");
  expect(CSS_SIS).toContain("@keyframes sisBate{"); expect(CSS_SIS).toContain(".sis.limpa .sis-orb::before{");
  expect(CSS_SIS).toMatch(/\.btn-entrar\{[^}]*background:rgba\(185,28,28,\.38\)/);
  expect(CSS_SIS).not.toMatch(/prefers-reduced-motion:reduce\)\{\.sis-orb::after\{animation:none/);
});

test("Universo no PC (22/11/2026): botões + − e ver tudo, cartão lateral em tela deitada e rolagem suave", () => {
  const { CSS_SIS } = require("./sisCss"); const { HTML_SIS } = require("./sisHtml");
  const fs = require("fs"), path = require("path"); const src = fs.readFileSync(path.join(__dirname, "sisMotor.js"), "utf8");
  expect(HTML_SIS).toContain('id="uzoom"'); expect(HTML_SIS).toContain('data-z="fit"');
  expect(CSS_SIS).toContain(".sisx.fino .uzoom{display:flex}"); expect(CSS_SIS).toContain(".sisx.land #ucard{");
  expect(src).toContain("function uDeitada(){return W>H*1.15}");
  expect(src).not.toContain("CAM.k*(e.deltaY<0?1.12:.89)"); // sem salto fixo por evento: o trackpad não dispara o zoom
  expect(src).toContain("if(uDeitada()!==uni.land){uniFechar();uniIniciar()}"); // redimensionar a janela refaz o grafo
});

test("Universo 3D (24/11/2026): carregado sob demanda; sem WebGL devolve null e o Universo 2D continua", () => {
  const fs = require("fs"), path = require("path");
  const motor = fs.readFileSync(path.join(__dirname, "sisMotor.js"), "utf8"), jsx = fs.readFileSync(path.join(__dirname, "AberturaSIS.jsx"), "utf8");
  expect(jsx).toContain('universo3d: () => import("./universo3d")'); // three não entra no pacote principal
  expect(motor).toContain("if(!novo){u3falhou=true;return}");
  const { CSS_SIS } = require("./sisCss"); expect(CSS_SIS).toContain(".sisx.u3 #uni,");
  const { iniciarUniverso3D, CSS_U3D } = require("./universo3d");
  expect(CSS_U3D).toContain("#u3-vit"); // sinais vitais do núcleo
  const raiz = document.createElement("div"); document.body.appendChild(raiz);
  const dados = { MODS: [["tsem", "pr", "Teste Semanal", "x"], ["avisos", "out", "Painel de Avisos", "y"]], LIG: [["tsem", "avisos"]] };
  expect(iniciarUniverso3D({ raiz, dados })).toBeNull(); // jsdom não tem WebGL
  expect(raiz.querySelector(".u3d")).toBeNull(); // não deixa resto na tela
  expect(iniciarUniverso3D({ raiz: null, dados })).toBeNull();
  raiz.remove();
});

test("Universo infinito (25/11/2026): dentro do núcleo ficam as áreas e cada área leva ao SIS dela", () => {
  const fs = require("fs"), path = require("path"); const src = fs.readFileSync(path.join(__dirname, "universo3d.js"), "utf8");
  const { AREAS_U3D } = require("./universo3d"); const { DIVISOES } = require("./Entrada");
  expect(AREAS_U3D.map((a) => a[0])).toEqual(DIVISOES.map((d) => d.id)); // as mesmas áreas da tela "Escolha a sua área"
  AREAS_U3D.forEach((a) => expect(!!a[3]).toBe(!!DIVISOES.find((d) => d.id === a[0]).ativo));
  expect(src).toContain("if(mundo.tipo==='sis'&&dist<.42&&tgt.length()<.5){entrarAreas()}"); // aproximar do núcleo atravessa
  expect(src).toContain("entrarSis(sel.area)"); // aproximar de uma área entra nela
  expect(src).toContain("if(!CLI&&f>1&&dT>=MAXD-.01&&dist>MAXD-3){subir();return}"); // afastar além do limite sobe um nível
});

test("lembranças do Universo (25/11/2026): todo módulo e pilar tem a sua prévia, sempre marcada como ilustração", () => {
  const fs = require("fs"), path = require("path"); const motor = fs.readFileSync(path.join(__dirname, "sisMotor.js"), "utf8");
  const { PREVIAS_U3D, previaU3D } = require("./universo3d");
  const ids = [...motor.slice(motor.indexOf("var UN=["), motor.indexOf("var PIL=")).matchAll(/\n \['([a-z0-9]+)','(eq|pe|pr|out)'/g)].map((m) => m[1]);
  expect(ids.length).toBe(29);
  ids.concat(["Peq", "Ppe", "Ppr"]).forEach((id) => { expect(PREVIAS_U3D[id]).toBeTruthy(); const h = previaU3D(id); expect(h).toContain('class="u3-pv"'); expect(h).toContain("ilustração"); });
  expect(previaU3D("equipe")).toContain('class="ros"'); expect(previaU3D("pops")).toContain("POP · "); expect(previaU3D("tsem")).toContain('class="das"');
  expect(previaU3D("moked")).toBe(""); expect(previaU3D("moklog")).toBe(""); // núcleo e áreas não têm slide: levam ao próximo nível
});
