import React,{act} from "react";
import {createRoot} from "react-dom/client";
const mockGetDocs=jest.fn(), mockFetch=jest.fn(), mockDemo=jest.fn();
jest.mock("firebase/firestore",()=>({getFirestore:()=>({}),collection:(...a)=>({p:a.slice(1).join("/")}),getDocs:(...a)=>mockGetDocs(...a)}));
jest.mock("./session",()=>({authFetchEquipe:(...a)=>mockFetch(...a),isDemo:()=>mockDemo()}));
const F=require("./fotosEquipe");
const {merge}=require("../api/ai/lib/equipeMerge");
const JPG=n=>"data:image/jpeg;base64,"+"A".repeat(n);
const clone=x=>JSON.parse(JSON.stringify(x));
const docs=obj=>({forEach:fn=>Object.entries(obj).forEach(([id,data])=>fn({id,data:()=>({data})}))});
beforeEach(()=>{mockGetDocs.mockReset();mockFetch.mockReset();mockDemo.mockReset().mockReturnValue(false);F.limparCacheFotos();global.IS_REACT_ACT_ENVIRONMENT=true;});

describe("fotoDe (resolvedor único)",()=>{
  test("referência vence; sem a foto carregada mostra vazio e NÃO cai para a legada",()=>{
    const c={id:"a",fotoRef:"a-1",foto:JPG(10)};
    expect(F.fotoDe(c,{"a-1":JPG(5)})).toBe(JPG(5));
    expect(F.fotoDe(c,{})).toBe("");
  });
  test("legada serve quando não há referência; temFoto:false nunca mostra foto (inclusive legada)",()=>{
    expect(F.fotoDe({id:"a",foto:JPG(10)},{})).toBe(JPG(10));
    expect(F.fotoDe({id:"a",foto:JPG(10),temFoto:false},{})).toBe("");
    expect(F.fotoDe({id:"a",fotoRef:"a-1",temFoto:false},{"a-1":JPG(5)})).toBe("");
    expect(F.fotoDe({id:"a",foto:"texto"},{})).toBe("");
    expect(F.fotoDe(null,{})).toBe("");
  });
});
test("R2: injetarFotos SEMPRE resolve (inclusive vazia): o PDF não recebe a cópia legada de quem foi marcado sem foto",()=>{
  const lista=[{id:"a",fotoRef:"a-1",foto:""},{id:"b",foto:JPG(9),temFoto:false},{id:"c",foto:JPG(7)},{id:"d",fotoRef:"d-1"}];
  const r=F.injetarFotos(lista,{"a-1":JPG(4)});
  expect(r.map(x=>x.foto)).toEqual([JPG(4),"",JPG(7),""]);
  expect(lista[1].foto).toBe(JPG(9));                           // original intacto
});
describe("prepararColaborador",()=>{
  const form={id:"a",nome:"X",foto:""};
  test("foto nova enviada: aponta para a referência e esvazia o campo legado",()=>{
    expect(F.prepararColaborador({form:{...form,foto:JPG(3)},fotoFinal:JPG(3),ref:"a-9",existente:{id:"a",foto:JPG(8)}})).toEqual({id:"a",nome:"X",foto:"",fotoRef:"a-9",temFoto:true});
  });
  test("RISCO 2: editar ANTES de as fotos carregarem (form.foto vazio) preserva a referência e temFoto",()=>{
    const r=F.prepararColaborador({form,fotoFinal:"",ref:"",existente:{id:"a",fotoRef:"a-1",temFoto:true,foto:""}});
    expect(r).toMatchObject({fotoRef:"a-1",temFoto:true,foto:""});
  });
  test("sem foto nova mantém a legada no documento até a migração; nunca apaga",()=>{
    expect(F.prepararColaborador({form:{...form,foto:JPG(6)},fotoFinal:"",ref:"",existente:{id:"a",foto:JPG(6)}})).toMatchObject({foto:JPG(6),temFoto:true});
    expect(F.prepararColaborador({form,fotoFinal:"",ref:"",existente:{id:"a",foto:JPG(6)}})).toMatchObject({foto:JPG(6),temFoto:true});   // form vazio por falha de leitura
  });
  test("colaborador novo ou que nunca teve foto: temFoto:false",()=>{
    expect(F.prepararColaborador({form,fotoFinal:"",ref:"",existente:undefined})).toMatchObject({foto:"",temFoto:false});
    expect(F.prepararColaborador({form,fotoFinal:"",ref:"",existente:{id:"a",foto:""}})).toMatchObject({temFoto:false});
  });
  test("temFoto:true sem referência nem legada continua true (não 'remove' por inferência)",()=>{
    expect(F.prepararColaborador({form,fotoFinal:"",ref:"",existente:{id:"a",temFoto:true,foto:""}}).temFoto).toBe(true);
  });
});
describe("enviarFoto",()=>{
  test("demonstração não chama o servidor",async()=>{mockDemo.mockReturnValue(true);expect(await F.enviarFoto("P601","c1",JPG(5))).toBe("demo-c1");expect(mockFetch).not.toHaveBeenCalled();});
  test("envia ao servidor e devolve a referência",async()=>{
    mockFetch.mockResolvedValue({ok:true,status:200,json:async()=>({ok:true,ref:"c1-abc"})});
    expect(await F.enviarFoto("P601","c1",JPG(5))).toBe("c1-abc");
    const [url,op]=mockFetch.mock.calls[0];expect(url).toBe("/api/equipe-foto");expect(JSON.parse(op.body)).toEqual({pid:"P601",colabId:"c1",dataUrl:JPG(5)});
  });
  test("erro do servidor sobe com status e mensagem",async()=>{
    mockFetch.mockResolvedValue({ok:false,status:403,json:async()=>({ok:false,erro:"Projeto sem permissão."})});
    await expect(F.enviarFoto("P601","c1",JPG(5))).rejects.toMatchObject({status:403,message:"Projeto sem permissão."});
    mockFetch.mockResolvedValue({ok:true,status:200,json:async()=>{throw new Error("x");}});
    await expect(F.enviarFoto("P601","c1",JPG(5))).rejects.toThrow("Não foi possível enviar a foto.");
  });
});
test("carregarFotos devolve só imagens válidas por id da foto",async()=>{
  mockGetDocs.mockResolvedValue(docs({"a-1":JPG(5),"b-1":"nada"}));
  expect(await F.carregarFotos({},"P601")).toEqual({"a-1":JPG(5)});
});
describe("useFotosEquipe",()=>{
  let visto;const T=({pid})=>{visto=F.useFotosEquipe(pid);return null;};
  const montar=async(pid)=>{const h=document.createElement("div");const r=createRoot(h);await act(async()=>r.render(<T pid={pid}/>));return {r,trocar:async p=>act(async()=>r.render(<T pid={p}/>)),fechar:()=>act(async()=>r.unmount())};};
  test("cache de 10 min e revalidação depois",async()=>{
    jest.useFakeTimers();jest.setSystemTime(new Date(2026,9,3,10,0,0));
    mockGetDocs.mockResolvedValue(docs({"a-1":JPG(5)}));
    let m=await montar("P601");expect(mockGetDocs).toHaveBeenCalledTimes(1);expect(visto.mapa).toEqual({"a-1":JPG(5)});expect(visto.carregado).toBe(true);await m.fechar();
    m=await montar("P601");expect(mockGetDocs).toHaveBeenCalledTimes(1);await m.fechar();
    jest.setSystemTime(new Date(2026,9,3,10,11,0));m=await montar("P601");expect(mockGetDocs).toHaveBeenCalledTimes(2);await m.fechar();
    jest.useRealTimers();
  });
  test("R3: ao trocar de projeto o mapa do anterior some, mesmo se a nova leitura falhar",async()=>{
    mockGetDocs.mockResolvedValueOnce(docs({"c1-a":JPG(5)}));
    const m=await montar("P601");expect(visto.mapa).toEqual({"c1-a":JPG(5)});
    mockGetDocs.mockRejectedValueOnce(new Error("offline"));
    await m.trocar("P602");
    expect(visto.mapa).toEqual({});expect(visto.carregado).toBe(false);                 // nunca devolve fotos de outro projeto
    await m.fechar();
  });
  test("foto definida durante a leitura não se perde (fotos são imutáveis: união segura)",async()=>{
    let liberar;mockGetDocs.mockReturnValue(new Promise(r=>{liberar=()=>r(docs({"a-1":JPG(5)}));}));
    const m=await montar("P603");
    await act(async()=>{visto.definir("a-2",JPG(6));});
    await act(async()=>{liberar();await Promise.resolve();});
    expect(visto.mapa).toEqual({"a-1":JPG(5),"a-2":JPG(6)});await m.fechar();
  });
  test("falha na leitura não derruba a tela",async()=>{
    mockGetDocs.mockRejectedValue(new Error("offline"));const m=await montar("P604");expect(visto.mapa).toEqual({});await m.fechar();
  });
});
test("documento principal ≈10× menor e nenhuma foto se perde (21 colaboradores, 28 KB cada)",()=>{
  const colabs=Array.from({length:21},(_,i)=>({id:"c"+i,nome:"Colab "+i,cargo:"Vigilante",historico:Array.from({length:30},(_,j)=>({id:"h"+i+"_"+j,tipo:"FT",data:"2026-01-01"})),uniforme:{solicitacoes:[]},foto:JPG(28000)}));
  const antes=JSON.stringify({colaboradores:colabs,desligados:[]}).length;
  const mapa={},novos=colabs.map(c=>{const ref=c.id+"-h";mapa[ref]=c.foto;return F.prepararColaborador({form:c,fotoFinal:c.foto,ref,existente:c});});
  const depois=JSON.stringify({colaboradores:novos,desligados:[]}).length;
  expect(depois).toBeLessThan(antes*0.2);
  novos.forEach((c,i)=>expect(F.fotoDe(c,mapa)).toBe(colabs[i].foto));
});
describe("servidor (merge) com fotoRef",()=>{
  const base=()=>({colaboradores:[{id:"a",nome:"A",foto:"",fotoRef:"a-1",temFoto:true}],desligados:[]});
  test("RISCO 1: duas trocas de foto ao mesmo tempo viram CONFLITO visível em fotoRef (nada é sobrescrito em silêncio)",()=>{
    const b=base(),A=clone(b),B=clone(b);A.colaboradores[0].fotoRef="a-2";B.colaboradores[0].fotoRef="a-3";
    const apos=merge(b,A,clone(b));expect(apos.colaboradores[0].fotoRef).toBe("a-2");
    let e;try{merge(b,B,apos);}catch(x){e=x;}
    expect(e&&e.status).toBe(409);expect(e.path).toBe("colaboradores[]/fotoRef".replace(/^/,"/"));
  });
  test("troca de foto + outra edição do mesmo colaborador por outra pessoa: mescla sem conflito",()=>{
    const b=base(),A=clone(b),C=clone(b);A.colaboradores[0].fotoRef="a-2";C.colaboradores[0].nome="A Silva";
    const r=merge(b,A,C);expect(r.colaboradores[0]).toMatchObject({fotoRef:"a-2",nome:"A Silva"});
  });
  test("aba antiga (ainda com a foto no documento) não traz a foto de volta nem gera conflito",()=>{
    const antigo={colaboradores:[{id:"a",nome:"A",foto:JPG(500)}],desligados:[]};
    const atual={colaboradores:[{id:"a",nome:"A",foto:"",fotoRef:"a-1",temFoto:true}],desligados:[]};
    const depois=clone(antigo);depois.checagemEquipe={alvo:"2026-10-03",checkins:[{slotId:"sab_diurno",lider:"L",em:"x"}]};
    const r=merge(antigo,depois,atual);expect(r.colaboradores[0]).toEqual({id:"a",nome:"A",foto:"",fotoRef:"a-1",temFoto:true});expect(r.checagemEquipe.checkins).toHaveLength(1);
  });
});
test("código: Avatar usa o resolvedor único, não há consulta direta ao mapa e o documento principal não recebe mais a foto",()=>{
  const fs=require("fs"),eq=fs.readFileSync("src/Equipe.jsx","utf8"),app=fs.readFileSync("src/App.jsx","utf8");
  expect((eq.match(/<Avatar colab=\{\w+\}/g)||[]).length).toBe(7);expect(eq).not.toMatch(/<Avatar foto=/);
  expect(eq).not.toMatch(/mapaFotos\[|mapa\[id\]|mapa\[colab/);
  expect(eq).toContain("enviarFoto(project.id, form.id, fotoFinal)");expect(eq).toContain("prepararColaborador({ form");
  expect(eq).not.toContain("const formFinal = { ...form, foto: fotoFinal };");
  expect(app).toContain("fotoDe(c, fotosEq.mapa)");expect(app).not.toMatch(/\{c\.foto \? <img src=\{c\.foto\}/);
});
