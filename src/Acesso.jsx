import React, { useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDLMwBqccgWDk7VFQdLYKuLNXWtkNn5WGA",
  authDomain: "moklog-checktest.firebaseapp.com",
  projectId: "moklog-checktest",
  storageBucket: "moklog-checktest.firebasestorage.app",
  messagingSenderId: "390165325023",
  appId: "1:390165325023:web:3147cd333503916b0d756a"
};
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export default function AcessoApp({ onVoltar }) {
  const [transportadora, setTransportadora] = useState("");
  const [placa, setPlaca] = useState("");
  const [motorista, setMotorista] = useState("");
  const [hEstacionou, setHEstacionou] = useState("");
  const [hChamado, setHChamado] = useState("");
  const [hEntrou, setHEntrou] = useState("");
  const [hSaiu, setHSaiu] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [fotos, setFotos] = useState([]);
  const [carregando, setCarregando] = useState(false);

  const handleFotoChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setFotos(prev => [...prev, reader.result].slice(0, 10));
      reader.readAsDataURL(file);
    });
  };

  const handleSalvar = async (e) => {
    e.preventDefault(); 
    setCarregando(true);
    const novoRegistro = { 
      projeto: "P260A", 
      transportadora, 
      placa, 
      motorista, 
      horarioEstacionou: hEstacionou, 
      horarioChamado: hChamado, 
      horarioEntrou: hEntrou, 
      horarioSaiu: hSaiu, 
      observacoes, 
      fotos, 
      dataRegistro: new Date().toLocaleDateString("pt-BR") 
    };
    try {
      await addDoc(collection(db, "acessos_jatinox"), novoRegistro);
      alert("Movimentação de carga salva com sucesso!");
      setTransportadora(""); setPlaca(""); setMotorista(""); setHEstacionou(""); setHChamado(""); setHEntrou(""); setHSaiu(""); setObservacoes(""); setFotos([]);
    } catch (error) { 
      alert("Erro ao salvar no banco."); 
    } finally { 
      setCarregando(false); 
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "700px", margin: "0 auto", color: "#FFFFFF", fontFamily: "sans-serif" }}>
      <button onClick={onVoltar} style={{ padding: "10px 20px", background: "#475569", color: "#FFF", border: "none", borderRadius: "5px", cursor: "pointer", marginBottom: "20px" }}>← Menu Jatinox</button>
      <div style={{ background: "#1e293b", padding: "25px", borderRadius: "10px", border: "1px solid #334155" }}>
        <h2 style={{ color: "#f97316", marginBottom: "20px" }}>🚛 Controle de Fluxo de Cargas e Transportadoras (P260A)</h2>
        <form onSubmit={handleSalvar}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
            <div><label style={{ display:"block", marginBottom:"5px" }}>Transportadora</label><input type="text" value={transportadora} onChange={e => setTransportadora(e.target.value)} style={{ width: "100%", padding: "10px", background: "#0f172a", color: "#FFF", border: "1px solid #475569", borderRadius: "5px" }} /></div>
            <div><label style={{ display:"block", marginBottom:"5px" }}>Placa do Veículo</label><input type="text" value={placa} onChange={e => setPlaca(e.target.value)} style={{ width: "100%", padding: "10px", background: "#0f172a", color: "#FFF", border: "1px solid #475569", borderRadius: "5px" }} /></div>
          </div>
          <div style={{ marginBottom: "15px" }}><label style={{ display:"block", marginBottom:"5px" }}>Motorista</label><input type="text" value={motorista} onChange={e => setMotorista(e.target.value)} style={{ width: "100%", padding: "10px", background: "#0f172a", color: "#FFF", border: "1px solid #475569", borderRadius: "5px" }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "25px" }}>
            <div><label style={{ fontSize: "11px", display:"block", marginBottom:"5px" }}>Estacionou</label><input type="time" value={hEstacionou} onChange={e => setHEstacionou(e.target.value)} style={{ width: "100%", padding: "8px", background: "#0f172a", color: "#FFF", border: "1px solid #475569", borderRadius: "4px" }} /></div>
            <div><label style={{ fontSize: "11px", display:"block", marginBottom:"5px" }}>Chamado</label><input type="time" value={hChamado} onChange={e => setHChamado(e.target.value)} style={{ width: "100%", padding: "8px", background: "#0f172a", color: "#FFF", border: "1px solid #475569", borderRadius: "4px" }} /></div>
            <div><label style={{ fontSize: "11px", display:"block", marginBottom:"5px" }}>Entrada Pátio</label><input type="time" value={hEntrou} onChange={e => setHEntrou(e.target.value)} style={{ width: "100%", padding: "8px", background: "#0f172a", color: "#FFF", border: "1px solid #475569", borderRadius: "4px" }} /></div>
            <div><label style={{ fontSize: "11px", display:"block", marginBottom:"5px" }}>Saída Pátio</label><input type="time" value={hSaiu} onChange={e => setHSaiu(e.target.value)} style={{ width: "100%", padding: "8px", background: "#0f172a", color: "#FFF", border: "1px solid #475569", borderRadius: "4px" }} /></div>
          </div>
          <div style={{ marginBottom: "20px" }}><label style={{ display: "block", marginBottom:"5px" }}>Evidências da Carga / Placa (Opcional)</label><input type="file" accept="image/*" multiple onChange={handleFotoChange} style={{ marginTop: "5px" }} /></div>
          <button type="submit" disabled={carregando} style={{ width: "100%", padding: "12px", background: "#10b981", color: "#FFF", border: "none", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" }}>{carregando ? "Transmitindo Dados..." : "💾 Transmitir Registro a CCO"}</button>
        </form>
      </div>
    </div>
  );
}
