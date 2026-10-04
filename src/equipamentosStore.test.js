jest.mock('./session',()=>({authFetchEquipe:jest.fn(),isDemo:jest.fn()}));
const {authFetchEquipe,isDemo}=require('./session');
const {gravarSecaoEquipamentos}=require('./equipamentosStore');
beforeEach(()=>{jest.clearAllMocks();isDemo.mockReturnValue(false);});
test('demo simula sem enviar dados ao servidor',async()=>{
 isDemo.mockReturnValue(true);expect(await gravarSecaoEquipamentos('P505','armamento',{},[])).toEqual({armamento:[]});expect(authFetchEquipe).not.toHaveBeenCalled();
});
test('envia só seção e base, usa retorno confirmado',async()=>{
 authFetchEquipe.mockResolvedValue({ok:true,json:async()=>({ok:true,data:{armamento:[]}})});
 expect(await gravarSecaoEquipamentos('P505','armamento',{outro:'preservado'},[])).toEqual({armamento:[]});
 expect(JSON.parse(authFetchEquipe.mock.calls[0][1].body)).toEqual({pid:'P505',section:'armamento',before:null,after:[]});
});
test.each([401,409,503])('erro %s não vira sucesso local',async status=>{
 authFetchEquipe.mockResolvedValue({ok:false,status,json:async()=>({erro:'Não salvou'})});await expect(gravarSecaoEquipamentos('P505','armamento',{},[])).rejects.toMatchObject({status,message:'Não salvou'});
});
