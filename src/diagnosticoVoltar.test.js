// Todas as telas do Diagnóstico e do Single precisam de saída para o início (pedido do Marcio, 03/10/2026).
const fs=require("fs");
const d=fs.readFileSync("src/diagnostico/DiagnosticoSituacional.jsx","utf8");
const linhas=d.split("\n");
const tela=(marca)=>linhas.find(l=>l.includes(marca))||"";
test("Selecionar projeto: tem Voltar ao início (chama onBack) e alternância de tema",()=>{
  const l=tela(">Selecionar projeto</h1>");
  expect(l).toContain("<button onClick={onBack}");expect(l).toContain("← Voltar ao início");expect(l).toContain('aria-label="Alternar tema"');
  expect(l.indexOf("← Voltar ao início")).toBeLessThan(l.indexOf(">Selecionar projeto</h1>"));   // no topo
});
test("Carregando: dá para sair se o carregamento travar",()=>{
  const l=tela("Carregando catálogo publicado");expect(l).toContain("<button onClick={onBack}");
});
test("Lista de diagnósticos do projeto: Trocar projeto + Voltar ao início",()=>{
  const l=tela("＋ Novo diagnóstico");expect(l).toContain("Trocar projeto");expect(l).toContain("← Voltar ao início");
});
test("Tela do diagnóstico: botão Início no cabeçalho, ao lado da volta à seleção",()=>{
  const l=tela('aria-label="Voltar à seleção de projeto"');expect(l).toContain('aria-label="Voltar ao início">Início</button>');
});
test("Login e erro continuam com Voltar ao início",()=>{
  expect((d.match(/← Voltar ao início/g)||[]).length).toBeGreaterThanOrEqual(5);
});
test("Single: recebe onInicio do Diagnóstico e mostra o botão Início",()=>{
  expect(d).toContain("onInicio={onBack}");
  const s=fs.readFileSync("src/single/SingleApp.jsx","utf8");
  expect(s).toMatch(/export default function SingleApp\(\{[^}]*onInicio[^}]*\}\)/);
  expect(s).toContain("{onInicio&&<button onClick={onInicio}>Início</button>}");
});
