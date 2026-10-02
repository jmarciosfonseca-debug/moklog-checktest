export const UNIFORME_CATALOGO = [
 {cat:'👕 Uniforme',itens:[
  {nome:'Sapato / Coturno',gravaMarca:true,sugMarca:'Macboot',pedeTamanho:true},
  {nome:'Calça',gravaMarca:true,pedeTamanho:true},{nome:'Camisa / Camisão',gravaMarca:true,pedeTamanho:true},
  {nome:'Jaqueta / Terno',gravaMarca:true,pedeTamanho:true},{nome:'Capa de Chuva',pedeTamanho:true},
  {nome:'Galocha',pedeTamanho:true},{nome:'Boné'}]},
 {cat:'🛡️ Material Tático',itens:[{nome:'Cinturão'},{nome:'Coldre'},{nome:'Pochete'},
  {nome:'Capa Balística',validade:true},{nome:'Porta Jetloader'},{nome:'Porta Carregador'},
  {nome:'Porta Algema'},{nome:'Fone Lapela'},{nome:'Tonfa'},{nome:'Capacete'}]},
 {cat:'📄 Documento',itens:[{nome:'CNV',validade:true},{nome:'Crachá'}]}
];
export const UNIFORME_NOMES=UNIFORME_CATALOGO.flatMap(g=>g.itens.map(i=>i.nome));
