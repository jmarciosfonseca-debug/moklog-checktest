const core=require("../scripts/migracao/fotosEquipe.core");
const JPG=n=>"data:image/jpeg;base64,"+"B".repeat(n);
const doc=()=>({colaboradores:[{id:"a",nome:"A",foto:JPG(1000),historico:[{id:"h",tipo:"FT"}]},{id:"b",nome:"B",foto:""},{id:"c",nome:"C",foto:JPG(2000)},{id:"e",nome:"E",foto:JPG(10),fotoRef:"e-novo",temFoto:true}],desligados:[{id:"d",nome:"D",foto:JPG(3000)}],fv:{x:1},checagemEquipe:{alvo:"2026-10-03",checkins:[]}});
const esperadosDe=d=>new Map(core.planejar(d).itens.map(i=>[i.ref,i.sha]));
// transação falsa: get / getAll / set sobre um "banco" em memória
function txFalsa(principal,fotos){const gravado=[];return {gravado,tx:{get:async()=>({data:()=>JSON.parse(JSON.stringify(principal))}),
  getAll:async(...refs)=>refs.map(r=>({exists:!!fotos[r.id],data:()=>fotos[r.id]})),set:(_r,d)=>gravado.push(JSON.parse(JSON.stringify(d)))}};}
const refFoto=id=>({id});
test("migração preserva a marcação sem foto mesmo quando há cópia legada",()=>{
  const d=doc();d.colaboradores[0].temFoto=false;
  const r=core.aplicarLimpeza(d,esperadosDe(d));
  expect(r.doc.colaboradores[0]).toMatchObject({foto:"",temFoto:false});
  expect(r.doc.colaboradores[0].fotoRef).toBeTruthy();
});

test("planejar: usa o mesmo id do servidor, ignora quem já tem fotoRef e não-imagens",()=>{
  const d=doc(),p=core.planejar(d);
  expect(p.itens.map(i=>i.id).sort()).toEqual(["a","c","d"]);                       // "e" já tem fotoRef (foto mais nova): fora
  expect(p.itens[0].ref).toBe(p.itens[0].id+"-"+core.sha(d.colaboradores.concat(d.desligados).find(x=>x.id===p.itens[0].id).foto).slice(0,16));
  expect(p.bytesDepois).toBeLessThan(p.bytesDoc*0.2);expect(p.repetidos).toBe(0);
  d.colaboradores[1].foto="texto";d.desligados[0].id="a";expect(core.planejar(d).repetidos).toBe(1);
});
test("aplicarLimpeza: só quem foi conferido agora e não mudou; coloca fotoRef; nada mais é tocado",()=>{
  const d=doc(),esp=esperadosDe(d);d.colaboradores[2].foto=JPG(2001);                  // "c" mudou depois da cópia
  const r=core.aplicarLimpeza(d,esp);
  expect(r.limpos.sort()).toEqual(["a","d"]);expect(r.ignorados).toEqual(["c"]);
  expect(r.doc.colaboradores[0]).toMatchObject({id:"a",foto:"",temFoto:true,historico:[{id:"h",tipo:"FT"}]});expect(r.doc.colaboradores[0].fotoRef).toMatch(/^a-[0-9a-f]{16}$/);
  expect(r.doc.colaboradores[2].foto).toBe(JPG(2001));
  expect(r.doc.colaboradores[3]).toEqual(d.colaboradores[3]);                          // fotoRef anterior intacto
  expect(r.doc.fv).toEqual({x:1});expect(d.colaboradores[0].foto).toBe(JPG(1000));
});
test("não conferido não é limpo; repetir é inofensivo (idempotente)",()=>{
  const d=doc();expect(core.aplicarLimpeza(d,new Map()).limpos).toEqual([]);
  const esp=esperadosDe(d),r1=core.aplicarLimpeza(d,esp),r2=core.aplicarLimpeza(r1.doc,esp);
  expect(r2.limpos).toEqual([]);expect(r2.doc).toEqual(r1.doc);
});
describe("limparNaTransacao (RISCO 4: origem e destino conferidos NA transação)",()=>{
  test("destino igual ao copiado: limpa e grava uma vez",async()=>{
    const d=doc(),fotos={};core.planejar(d).itens.forEach(i=>{const c=d.colaboradores.concat(d.desligados).find(x=>x.id===i.id);fotos[i.ref]={data:c.foto};});
    const {tx,gravado}=txFalsa(d,fotos);const r=await core.limparNaTransacao(tx,{id:"doc"},refFoto,esperadosDe(d));
    expect(r.limpos.sort()).toEqual(["a","c","d"]);expect(gravado).toHaveLength(1);
  });
  test("destino sumiu ou foi alterado depois da cópia: NÃO remove a foto do documento",async()=>{
    const d=doc(),fotos={},itens=core.planejar(d).itens;
    itens.forEach(i=>{const c=d.colaboradores.concat(d.desligados).find(x=>x.id===i.id);fotos[i.ref]={data:c.foto};});
    delete fotos[itens[0].ref];fotos[itens[1].ref]={data:JPG(7)};
    const {tx,gravado}=txFalsa(d,fotos);const r=await core.limparNaTransacao(tx,{id:"doc"},refFoto,esperadosDe(d));
    expect(r.limpos).toEqual([itens[2].id]);expect(r.ignorados.sort()).toEqual([itens[0].id,itens[1].id].sort());
    expect(gravado[0].colaboradores.concat(gravado[0].desligados).filter(c=>c.foto&&!c.fotoRef).length).toBe(2);   // as duas continuam com a foto no documento ("e" já tem fotoRef e fica como está)
  });
  test("foto trocada no documento durante a migração (fotoRef novo) nunca é substituída pela cópia legada",async()=>{
    const d=doc(),esp=esperadosDe(d);const atual=JSON.parse(JSON.stringify(d));atual.colaboradores[0].fotoRef="a-novissima";atual.colaboradores[0].foto="";
    const {tx,gravado}=txFalsa(atual,Object.fromEntries([...esp].map(([k])=>[k,{data:null}])));
    const r=await core.limparNaTransacao(tx,{id:"doc"},refFoto,esp);
    expect(gravado[0].colaboradores[0]).toMatchObject({fotoRef:"a-novissima"});expect(r.limpos).not.toContain("a");
  });
});
describe("validarPastaBackup (RISCO 6)",()=>{
  test("recusa relativa, vazia e dentro do repositório; aceita fora",()=>{
    expect(core.validarPastaBackup("","/repo")).toMatch(/Informe/);
    expect(core.validarPastaBackup("backup","/repo")).toMatch(/absoluto/);
    expect(core.validarPastaBackup("/repo","/repo")).toMatch(/DENTRO/);
    expect(core.validarPastaBackup("/repo/backups/x","/repo")).toMatch(/DENTRO/);
    expect(core.validarPastaBackup("/repo/../repo/sub","/repo")).toMatch(/DENTRO/);
    expect(core.validarPastaBackup("/outra/pasta","/repo")).toBeNull();
    expect(core.validarPastaBackup("/repo-irmao/backup","/repo")).toBeNull();           // prefixo parecido não conta como dentro
  });
});
describe("Bolsão (RISCO 5)",()=>{
  const b=()=>({placas:{AAA1B23:{inquilino:"X"}},checagens:[{id:"1",lider:"L",itens:[{placa:"AAA1B23"}],fotos:[JPG(500),JPG(700)]},{id:"2",lider:"M",itens:[],fotos:[]}]});
  test("remove só o campo fotos; placas, inquilinos e textos ficam",()=>{
    const orig=b(),p=core.planejarBolsao(orig);expect(p).toMatchObject({checagens:2,comFoto:1,fotos:2});
    const r=core.removerFotosBolsao(orig,core.conjuntoDoBackup(orig));
    expect(r.doc.checagens[0]).toEqual({id:"1",lider:"L",itens:[{placa:"AAA1B23"}],fotos:[]});expect(r.doc.placas).toEqual(orig.placas);
    expect(r).toMatchObject({removidas:2,preservadas:0});expect(orig.checagens[0].fotos).toHaveLength(2);
  });
  test("foto adicionada DEPOIS do backup é preservada",()=>{
    const noBackup=core.conjuntoDoBackup(b()),atual=b();atual.checagens[1].fotos=[JPG(900)];atual.checagens.push({id:"3",itens:[],fotos:[JPG(901)]});
    const r=core.removerFotosBolsao(atual,noBackup);
    expect(r).toMatchObject({removidas:2,preservadas:2});expect(r.doc.checagens[1].fotos).toEqual([JPG(900)]);expect(r.doc.checagens[2].fotos).toEqual([JPG(901)]);
  });
});
test("Bolsão: captura de fotos desligada por constante; bloco íntegro",()=>{
  const b=require("fs").readFileSync("src/BolsaoInquilinos.jsx","utf8");
  expect(b).toContain("const PERMITE_FOTOS = false;");expect(b).toMatch(/\{PERMITE_FOTOS && \(<div style=\{S\.card\}>/);
});
