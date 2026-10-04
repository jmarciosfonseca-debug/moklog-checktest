import {gravarComRecuperacao} from './equipeConflito';
import {criarFila} from './filaGravacao';
const {merge}=require('../api/ai/lib/equipeMerge');
const clone=x=>JSON.parse(JSON.stringify(x));
const original={colaboradores:[],desligados:[],checagemEquipe:{alvo:'2026-10-03',checkins:[]}};
const assinatura=nome=>({slotId:'dom_diurno',slotLabel:'Domingo · Diurno',lider:nome,statusEquipe:'sem_alteracoes',nota:'',em:'2026-10-04T12:00:00Z'});
const assinar=(base,nome)=>({...clone(base),checagemEquipe:{...base.checagemEquipe,checkins:[assinatura(nome)]}});
function tela(){
 let view=clone(original),server=assinar(original,'Líder A');
 const fila=criarFila(),bases=[];
 const recarregar=jest.fn(async()=>{view=clone(server);return true;});
 const clicar=()=>{const before=clone(view),after=assinar(view,'Líder B');return fila(()=>gravarComRecuperacao(async()=>{bases.push(before);server=merge(before,after,server);view=clone(server);return server;},recarregar));};
 return {clicar,recarregar,bases,get view(){return view;},get server(){return server;}};
}
test('409, releitura concluída e NOVA ação usa base atualizada e passa',async()=>{
 const t=tela();await expect(t.clicar()).rejects.toMatchObject({status:409,baseAtualizada:true});
 expect(t.view.checagemEquipe.checkins[0].lider).toBe('Líder A');
 await expect(t.clicar()).resolves.toBeDefined();
 expect(t.bases[1].checagemEquipe.checkins[0].lider).toBe('Líder A');
 expect(t.server.checagemEquipe.checkins[0].lider).toBe('Líder B');
 expect(t.recarregar).toHaveBeenCalledTimes(1);
});
test('duas ações capturadas ANTES da releitura reproduzem dois 409 mesmo com fila',async()=>{
 const t=tela();const resultados=await Promise.allSettled([t.clicar(),t.clicar()]);
 expect(resultados.map(r=>r.reason.status)).toEqual([409,409]);
 expect(t.recarregar).toHaveBeenCalledTimes(2);
 expect(t.bases[1].checagemEquipe.checkins).toEqual([]);
 expect(t.server.checagemEquipe.checkins[0].lider).toBe('Líder A');
});
