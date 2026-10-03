jest.mock('../api/ai/lib/accessAuth',()=>({verify:jest.fn(),PROJECTS:['P260A','P260B']}));
jest.mock('../api/ai/lib/firebaseAdmin',()=>({getDb:jest.fn()}));
jest.mock('../api/ai/lib/equipeMerge',()=>({save:jest.fn()}));
const auth=require('../api/ai/lib/accessAuth'),{getDb}=require('../api/ai/lib/firebaseAdmin'),{save}=require('../api/ai/lib/equipeMerge'),handler=require('../api/equipe-save');
const res=()=>({setHeader:jest.fn(),status:jest.fn().mockReturnThis(),json:jest.fn()});
beforeEach(()=>jest.clearAllMocks());
test.each([null,{nivel:'demo'},{nivel:'ronda',pid:'P260A'},{nivel:'lider',pid:'P260B'}])('sessão ausente/demo/ronda/outro projeto não acessa nenhuma escrita: %j',async identity=>{
 auth.verify.mockReturnValue(identity);const r=res();await handler({method:'POST',headers:{},body:{pid:'P260A',before:{},after:{colaboradores:[]}}},r);
 expect(r.status).toHaveBeenCalledWith(identity?403:401);expect(getDb).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();
});
test('líder do projeto usa transação servidor e retorna dados confirmados',async()=>{
 auth.verify.mockReturnValue({nivel:'lider',pid:'P260A'});save.mockResolvedValue({colaboradores:[]});const r=res();
 await handler({method:'POST',headers:{},body:{pid:'P260A',before:{colaboradores:[]},after:{colaboradores:[]}}},r);
 expect(save).toHaveBeenCalledTimes(1);expect(r.status).toHaveBeenCalledWith(200);
});
