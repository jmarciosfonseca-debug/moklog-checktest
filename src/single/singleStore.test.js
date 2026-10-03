import {criarStore} from "./singleStore";
import {isDemo} from "../session";
jest.mock("../session",()=>({isDemo:jest.fn(()=>false)}));
test("demo não chama rede; sem autenticação não chama rede",async()=>{
 const request=jest.fn();isDemo.mockReturnValue(true);
 await expect(criarStore({},request).criarSingle("sg_a",{})).rejects.toThrow(/demonstração/);
 expect(request).not.toHaveBeenCalled();isDemo.mockReturnValue(false);
 await expect(criarStore({},request).listar()).rejects.toThrow(/login/);
});
test("conflito é propagado; payload não é perdido ou reenviado automaticamente",async()=>{
 const request=jest.fn(async()=>({ok:false,status:409,json:async()=>({erro:"Conflito"})}));
 const auth={currentUser:{getIdToken:async()=>"fake-test-token"}};
 const s=criarStore(auth,request),p={id:"sg_x",revisao:1},ativos=[{id:"a"}];
 await expect(s.salvarAtivos(p,ativos)).rejects.toMatchObject({status:409});
 expect(request).toHaveBeenCalledTimes(1);expect(ativos).toEqual([{id:"a"}]);
});
