jest.mock("firebase-admin",()=>({auth:()=>({verifyIdToken:mockVerify})}));
jest.mock("../../api/ai/lib/firebaseAdmin",()=>({getDb:()=>mockDb}));
const mockVerify=jest.fn();
const mockDb={collection:jest.fn()};
const handler=require("../../api/single");
function response(){return {setHeader:jest.fn(),status:jest.fn(function(s){this.code=s;return this;}),json:jest.fn(function(v){this.body=v;return this;})};}
beforeEach(()=>{jest.clearAllMocks();});
test("API recusa ausência de token, anônimo e token inválido",async()=>{
 let res=response();await handler({method:"POST",headers:{}},res);expect(res.code).toBe(401);
 mockVerify.mockResolvedValue({uid:"test-user",firebase:{sign_in_provider:"anonymous"}});
 res=response();await handler({method:"POST",headers:{authorization:"Bearer test-only"}},res);expect(res.code).toBe(401);
 mockVerify.mockRejectedValue(Error("expired"));res=response();
 await handler({method:"POST",headers:{authorization:"Bearer test-only"}},res);expect(res.code).toBe(401);
 expect(mockDb.collection).not.toHaveBeenCalled();
});
test("API recusa perfil inativo sem chamar gravação",async()=>{
 mockVerify.mockResolvedValue({uid:"test-user",firebase:{sign_in_provider:"password"}});
 mockDb.collection.mockReturnValue({doc:()=>({get:async()=>({exists:true,data:()=>({active:false,role:"gerente"})})})});
 const res=response();await handler({method:"POST",headers:{authorization:"Bearer test-only"}},res);
 expect(res.code).toBe(403);expect(mockVerify).toHaveBeenCalledWith("test-only",true);
});
test("API não aceita GET",async()=>{const res=response();await handler({method:"GET"},res);expect(res.code).toBe(405);});
