import { draftHasResponses, readDraft, writeDraft } from "./diagnosticoDraft";

function memoria(){const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}

test("reconhece rascunho local recuperável somente quando há respostas",()=>{
  expect(draftHasResponses(null)).toBe(false);
  expect(draftHasResponses({respostas:{}})).toBe(false);
  expect(draftHasResponses({respostas:{"D01.01.01":{status:"conforme"}}})).toBe(true);
});

test("preserva e recupera rascunho local do projeto",()=>{
  const storage=memoria();
  const draft={versao:"1.0.0",savedAt:123,respostas:{A:{status:"parcial"}}};
  writeDraft(storage,"p607",draft);
  expect(readDraft(storage,"p607","1.0.0")).toEqual(draft);
});
