const {familias,classificar}=require("./catalogoAtivos");
const {inventario}=require("./catalogoCobertura.cjs");
test("catálogo de 27 famílias, identificadores únicos",()=>{expect(familias).toHaveLength(27);expect(new Set(familias.map(x=>x.id)).size).toBe(27);});
test("prioridade evita classificar monitor CFTV como câmera e leitor como cancela",()=>{
 expect(classificar("07 - MONITOR CFTV")).toBe("cftv_monitores");
 expect(classificar("01B - LEITORES QR CANCELAS")).toBe("ped_leitores");
 expect(classificar("CANCELAS AS (ALTA SEGURANÇA)")).toBe("vei_cancelas_as");
 expect(classificar("CFTV")).toBe("cftv_cameras");
 expect(classificar("MONITOR KEYACCESS")).toBe("cftv_monitores");
 expect(classificar("INTERCOMUNICADORES DE TOTEM")).toBe("com_interfonia");
 expect(classificar("FARÓIS/LED DAS CANCELAS")).toBe("vei_sinalizacao");
 expect(classificar("JOYSTICK CFTV")).toBe("cftv_joystick");
});
test("todo rótulo real recebe família, fora v1 ou revisar explícito",()=>{
 const all=inventario(),known=new Set([...familias.map(x=>x.id),"fora_v1","revisar"]);
 expect(all.length).toBe(137);
 expect(all.filter(x=>x.destino==="revisar")).toEqual([]);
 expect(all.every(x=>known.has(x.destino))).toBe(true);
});
