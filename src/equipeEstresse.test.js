import {criarSolicitacoes,anexarSolicitacoes,marcarWhats,relerEGravarEquipe,mensagemSolicitacoes,aprovarNaEquipe,alvosAguardando} from './equipeSolicitacoes';
import {setDoc} from './fireGuard';
import {setDoc as firebaseSetDoc} from 'firebase/firestore';
import {isDemo} from './session';
jest.mock('firebase/firestore',()=>({setDoc:jest.fn()}));
jest.mock('./session',()=>({isDemo:jest.fn(()=>false)}));
const agora='2026-10-02T12:00:00Z';
const base=()=>({colaboradores:[{id:'c',nome:'Teste local',uniforme:{solicitacoes:[]}}]});
const lote=n=>criarSolicitacoes(Array.from({length:n},(_,i)=>({item:`Item ${i}`,motivo:'Teste simulado'})),'lider','P260A',agora,(()=>{let i=0;return()=>`id-${++i}`;})());
beforeEach(()=>{jest.clearAllMocks();isDemo.mockReturnValue(false);});

test.each([1,15])('S3: %i itens são persistidos em uma escrita e todos constam da mensagem',async n=>{
 const novas=lote(n),ler=async()=>({exists:()=>true,data:base});
 const r=await relerEGravarEquipe('local',ler,setDoc,b=>({base:anexarSolicitacoes(b,'c',novas)}));
 expect(firebaseSetDoc).toHaveBeenCalledTimes(1);
 expect(r.base.colaboradores[0].uniforme.solicitacoes).toHaveLength(n);
 const msg=mensagemSolicitacoes('P260A','Teste',novas);
 expect(msg.match(/Protocolo:/g)).toHaveLength(n);
 novas.forEach(s=>expect(msg).toContain(s.item));
});

test('S5: fireGuard impede escrita demo nos cinco tipos de ação novos',async()=>{
 isDemo.mockReturnValue(true);
 const novas=lote(3),b=anexarSolicitacoes(base(),'c',novas),alvos=alvosAguardando(b.colaboradores,2026);
 const transforms=[
  x=>({base:anexarSolicitacoes(x,'c',[{...novas[0],id:'extra'}])}),
  x=>({base:marcarWhats(x,'c',novas.map(s=>s.id),agora,'evento')}),
  x=>aprovarNaEquipe(x,alvos,'aprovado',{},agora),
  x=>aprovarNaEquipe(x,alvos,'aprovado',{dispensarWhats:true},agora),
  x=>aprovarNaEquipe(x,alvos,'aprovado',{somenteAguardando:true},agora)
 ];
 for(const transformar of transforms)await relerEGravarEquipe('local',async()=>({exists:()=>true,data:()=>b}),setDoc,transformar);
 expect(firebaseSetDoc).not.toHaveBeenCalled();
});

test('S2: salvar documento inteiro antigo remove pedidos novos (risco reproduzido, não aprovado)',()=>{
 const telaA=base(),novas=lote(3);
 let servidor=anexarSolicitacoes(base(),'c',novas);
 expect(servidor.colaboradores[0].uniforme.solicitacoes).toHaveLength(3);
 servidor={...telaA}; // Semântica do setDoc sem merge usado por saveEquipe.
 expect(servidor.colaboradores[0].uniforme.solicitacoes).toHaveLength(0);
});
