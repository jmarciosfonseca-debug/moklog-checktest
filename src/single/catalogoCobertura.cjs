// AST only: does not execute App.jsx or read credentials.
const fs=require("fs"),path=require("path"),parser=require("@babel/parser");
const {familias,classificar,normalizar}=require("./catalogoAtivos");
function inventario(){
 const ast=parser.parse(fs.readFileSync(path.join(__dirname,"../App.jsx"),"utf8"),{sourceType:"module",plugins:["jsx"]});
 const declaration=ast.program.body.find(n=>n.type==="VariableDeclaration"&&n.declarations.some(d=>d.id.name==="PROJECTS"));
 const node=declaration.declarations.find(d=>d.id.name==="PROJECTS").init;
 const prop=(o,k)=>o.properties.find(p=>(p.key.name||p.key.value)===k)?.value;
 const map=new Map();
 for(const project of node.properties)for(const cat of prop(project.value,"categories")?.elements||[]){
  const label=prop(cat,"label")?.value,type=prop(cat,"type")?.value;
  if(typeof label==="string")map.set(label.replace(/^\s*\d+[a-z]?\s*[-–.]\s*/i,"").trim(),{nome:label,tipo:type,destino:classificar(label,type)});
 }
 return [...map.values()].sort((a,b)=>a.nome.localeCompare(b.nome));
}
if(require.main===module){const all=inventario();console.log(JSON.stringify({familias:familias.length,nomes:all.length,revisar:all.filter(x=>x.destino==="revisar"),tabela:all},null,2));}
module.exports={inventario};
