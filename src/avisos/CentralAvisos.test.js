import React, { act } from "react";
import { createRoot } from "react-dom/client";
import CentralAvisos, { abaInicial } from "./CentralAvisos";
import { montarCentral, noticiaExterna } from "./contrato";

global.IS_REACT_ACT_ENVIRONMENT = true;
const AG = new Date("2026-11-21T15:00:00-03:00");
const dia = (n) => new Date(AG.getTime() - n * 86400000);
const A = (o) => ({ id: `${o.tipo}:${o.projetoId || "P601"}:${o.n || 0}`, sev: "atencao", projetoId: "P601", titulo: "x", detalhe: "", desde: null, gerencial: false, idade: "", ...o });
let host, root;
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = (props) => act(async () => root.render(<CentralAvisos dark={true} agora={AG} gerencial={false} avisos={[]} {...props} />));
const abas = () => [...host.querySelectorAll('[role="tab"]')].map((b) => b.textContent);
const clicar = (el) => act(async () => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));

const AVISOS = [
  A({ tipo: "inop", sev: "critico", titulo: "6 inoperantes", desde: dia(12), idade: "há 12 dias" }),
  A({ tipo: "manutencao", sev: "atencao", titulo: "Trocar DVR", desde: dia(4), idade: "há 4 dias", n: 1 }),
  A({ tipo: "manutencao", sev: "atencao", titulo: "Trocar câmera", desde: dia(8), idade: "há 8 dias", n: 2 }),
  A({ tipo: "falta", gerencial: true, sev: "critico", titulo: "Falta de Fulano" }),
  A({ tipo: "teste", sev: "info", titulo: "Último teste semanal", detalhe: "100% operando", projetoId: "TODOS" }),
];

test("perfil comum vê 3 abas, sem Equipe e sem dado de pessoa", async () => {
  await render({ avisos: AVISOS.filter((a) => !a.gerencial) });
  expect(abas().map((t) => t.replace(/\d+/g, "").trim())).toEqual(["Equipamentos", "Pendências do cliente", "Notícias"]);
  expect(host.textContent).not.toContain("Falta de Fulano");
});

test("gerencial vê a aba Equipe marcada como gerencial", async () => {
  await render({ avisos: AVISOS, gerencial: true });
  expect(abas().some((t) => t.includes("Equipe") && t.includes("gerencial"))).toBe(true);
  await clicar(host.querySelector('[data-testid="aba-equipe"]'));
  expect(host.textContent).toContain("Falta de Fulano");
});

test("abre na primeira aba com algo crítico e navega entre abas", async () => {
  await render({ avisos: AVISOS });
  expect(host.querySelector('[data-testid="aba-equipamentos"]').getAttribute("aria-selected")).toBe("true");
  expect(host.textContent).toContain("6 inoperantes");
  await clicar(host.querySelector('[data-testid="aba-cliente"]'));
  expect(host.textContent).toContain("Trocar DVR");
  expect(host.textContent).toContain("Manutenção");          // com quem está
  expect(host.textContent).toContain("2 itens");               // grupo por projeto + sistema
  expect(host.textContent).toContain("o mais antigo há 8 d");
  expect(host.textContent).not.toContain("6 inoperantes");
});

test("tocar num aviso chama onAbrir com o aviso", async () => {
  const onAbrir = jest.fn();
  await render({ avisos: AVISOS, onAbrir });
  await clicar(host.querySelector('[data-testid="aviso"]'));
  expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ tipo: "inop" }));
});

test("idade usa a escala do app: 0–2 cinza, 3–5 amarelo, 6+ vermelho", async () => {
  await render({ avisos: [A({ tipo: "inop", desde: dia(1), idade: "há 1 dia" }), A({ tipo: "inop", n: 1, desde: dia(4), idade: "há 4 dias" }), A({ tipo: "inop", n: 2, desde: dia(9), idade: "há 9 dias" })] });
  const cor = (t) => [...host.querySelectorAll("span")].find((s) => s.textContent === t).style.color;
  expect(cor("há 1 dia")).toBe("rgb(100, 116, 139)");
  expect(cor("há 4 dias")).toBe("rgb(245, 158, 11)");
  expect(cor("há 9 dias")).toBe("rgb(239, 68, 68)");
});

test("notícias: teste semanal do sistema + notícia de fora; filtro por tema e link da matéria", async () => {
  const ext = noticiaExterna({ id: "e1", tema: "seguranca", tipo: "roubo_carga", titulo: "Roubo de carga na rodovia", resumo: "Resumo curto", fonte: "G1", link: "https://g1.example/e1", data: "2026-11-20T12:00:00Z", cidade: "Cajamar" }, "P601");
  const mer = noticiaExterna({ id: "m1", tema: "mercado", tipo: "mercado", titulo: "Demanda por galpões sobe", fonte: "Valor", link: "https://v.example/m1", data: "2026-11-19T12:00:00Z" }, "TODOS");
  await render({ avisos: AVISOS, noticias: [ext, mer] });
  await clicar(host.querySelector('[data-testid="aba-noticias"]'));
  expect(host.querySelectorAll('[data-testid="noticia"]')).toHaveLength(3);
  expect(host.querySelector('a[href="https://g1.example/e1"]').textContent).toContain("ver matéria");
  const seg = [...host.querySelectorAll("button")].find((b) => b.textContent === "Segurança");
  await clicar(seg);
  expect(host.querySelectorAll('[data-testid="noticia"]')).toHaveLength(1);
  expect(host.textContent).toContain("Roubo de carga na rodovia");
});

test("notícias: falha de leitura é dita, nunca vira 'sem notícias'; de memória mostra o horário", async () => {
  await render({ avisos: AVISOS.filter((a) => a.tipo === "teste"), noticiasEstado: { erro: "Sem conexão com o servidor.", deMemoria: false } });
  await clicar(host.querySelector('[data-testid="aba-noticias"]'));
  expect(host.querySelector('[role="alert"]').textContent).toContain("Não consegui ler as notícias de fora");
  expect(host.textContent).not.toContain("Nenhuma notícia");
  await render({ avisos: AVISOS.filter((a) => a.tipo === "teste"), noticiasEstado: { erro: "Sem conexão com o servidor.", deMemoria: true, lidoEm: new Date("2026-11-21T14:30:00-03:00") } });
  expect(host.querySelector('[role="alert"]').textContent).toMatch(/Mostrando as notícias lidas às \d{2}:\d{2}/);
});

test("abaInicial: crítica primeiro, depois a primeira com conteúdo", () => {
  expect(abaInicial(montarCentral({ avisos: [A({ tipo: "manutencao", sev: "critico" }), A({ tipo: "inop", sev: "atencao", n: 1 })] }))).toBe("cliente");
  expect(abaInicial(montarCentral({ avisos: [A({ tipo: "inop", sev: "atencao" })] }))).toBe("equipamentos");
  expect(abaInicial(montarCentral({ avisos: [] }))).toBe("equipamentos");
});
