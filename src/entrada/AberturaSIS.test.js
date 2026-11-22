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
