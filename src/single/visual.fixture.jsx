// Local-only UI fixture. Not imported by production.
import React from "react";
import {createRoot} from "react-dom/client";
import SingleApp from "./SingleApp";
import {htmlSingle} from "./pdfSingle";
if(new URLSearchParams(window.location.search).has("report")){
 const html=htmlSingle({id:"sg_visual",nome:"Condomínio Teste"},{id:"visual",data:"2026-10-03",responsavel:"Responsável de teste",estado:"rascunho",observacoes:"Exemplo local, sem dados reais.",itens:[{id:"cam",familiaId:"cftv_cameras",nome:"CFTV",total:100,parcial:4,inoperante:6,falhas:[]},{id:"tor",familiaId:"ped_torniquetes",nome:"Torniquetes",total:8,parcial:0,inoperante:1,falhas:[]}]});
 document.open();document.write(html);document.close();
}else createRoot(document.getElementById("root")).render(<><div style={{background:"#ffefad",padding:12}}>TESTE LOCAL — dados simulados, sem Firebase · <a href="?report=1">Visualizar relatório de exemplo</a></div><SingleApp auth={{currentUser:{uid:"visual"}}} profile={{role:"gerente"}} onBack={()=>{}} onDiagnostico={()=>alert("Diagnóstico: testado separadamente, sem banco real.")}/></>);
