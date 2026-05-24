import React, { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where } from "firebase/firestore";

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

export default function EquipeApp({ projetoId, isAdmin, onVoltar }) {
  const [colaboradores, setColaboradores] = useState([]);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [turno, setTurno] = useState("");
  const [escala, setEscala] = useState("");
  const [telefone, setTelefone] = useState("");
  const [reciclagem, setReciclagem] = useState("");
  const [foto, setFoto] = useState("");
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState(null);
  const [tipoOcorrencia, setTipoOcorrencia] = useState("");
  const [dataOcorrencia, setDataOcorrencia] = useState("");
  const [detalheOcorrencia, setDetalheOcorrencia] = useState("");

  const obterCargosPorProjeto = () => {
    if (["P601", "P602", "P604", "P605", "P505"].includes(projetoId)) {
      return ["VSPP Líder", "VSPP Apoio", "Vig CCO", "CDA", "Recepção"];
    }
    if (projetoId === "P260A") return ["VSPP Líder", "VSPP Apoio", "Vig CCO"];
    if (["P311A", "P311B", "P606"].includes(projetoId)) {
      return ["Vigilante Líder", "Vigilante Apoio", "Vigilante Ronda", "Vig CCO"];
    }
    return ["VSPP Líder", "VSPP Apoio", "Vig CCO", "CDA", "Recepção"];
  };

  const carregarEquipe = async () => {
    try {
      const q = query(collection(db, "equipes"), where("projeto", "==", projetoId));
      const snapshot = await getDocs(q);
      const lista = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
      setColaboradores(lista);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { carregarEquipe(); }, [projetoId]);

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCadastrar = async (e) => {
    e.preventDefault();
    if (!foto) { alert("A foto é obrigatória para o mapa de equipe!"); return; }
    const novoMembro = { projeto: projetoId, nome, cargo, turno, escala, telefone, reciclagem, foto, status: "Ativo", historico: [] };
    try {
      await addDoc(collection(db, "equipes"), novoMembro);
      alert("Colaborador cadastrado!");
      setNome(""); setCargo(""); setTurno(""); setEscala(""); setTelefone(""); setReciclagem(""); setFoto("");
      carregarEquipe();
    } catch (err) { alert("Erro ao salvar."); }
  };

  const handleAdicionarOcorrencia = async (e) => {
    e.preventDefault();
    const novaOco = { tipo: tipoOcorrencia, data: dataOcorrencia, detalhe: detalheOcorrencia || "Sem observações" };
    const historicoAtualizado = [...(colaboradorSelecionado.historico || []), novaOco];
    try {
      await updateDoc(doc(db, "equipes", colaboradorSelecionado.id), { historico: historicoAtualizado });
      alert("Histórico atualizado!");
      setColaboradorSelecionado({ ...colaboradorSelecionado, historico: historicoAtualizado });
      setTipoOcorrencia(""); setDataOcorrencia(""); setDetalheOcorrencia("");
      carregarEquipe();
    } catch (err) { alert("Erro ao salvar ocorrência."); }
  };

  return (
    <div style={{ padding: "20px", color: "#1E293B", fontFamily: "sans-serif", background: "#F8FAFC", minHeight: "100vh" }}>
      <button onClick={onVoltar} style={{ padding: "10px 20px", background: "#64748B", color: "#FFF", border: "none", borderRadius: "5px", cursor: "pointer", marginBottom: "20px", fontWeight: "bold" }}>← Voltar</button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px" }}>
        <div style={{ background: "#FFFFFF", padding: "25px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
          <h3 style={{ color: "#0F172A", marginBottom: "15px", borderBottom: "2px solid #2563EB" }}>👤 Integrar Novo Efetivo</h3>
          <form onSubmit={handleCadastrar}>
            <div style={{ marginBottom: "12px" }}><label style={{ display: "block", fontWeight: "600" }}>Nome Completo</label><input type="text" required value={nome} onChange={e => setNome(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #CBD5E1" }} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ display: "block", fontWeight: "600" }}>Cargo</label>
                <select required value={cargo} onChange={e => setCargo(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #CBD5E1" }}>
                  <option value="">Selecione...</option>
                  {obterCargosPorProjeto().map((c, i) => <option key={i} value={c}>{c}</option>)}
                  {projetoId === "P260C" && <option value="Cão de Guarda">Cão de Guarda</option>}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: "600" }}>Turno</label>
                <select required value={turno} onChange={e => setTurno(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #CBD5E1" }}>
                  <option value="">Selecione...</option><option value="Diurno A">Diurno A</option><option value="Noturno A">Noturno A</option><option value="Diurno B">Diurno B</option><option value="Noturno B">Noturno B</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
              <div><label style={{ display: "block", fontWeight: "600" }}>Escala</label><select required value={escala} onChange={e => setEscala(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #CBD5E1" }}><option value="">Selecione...</option><option value="12x36">12x36</option><option value="4x2">4x2</option><option value="5x2">5x2</option></select></div>
              <div><label style={{ display: "block", fontWeight: "600" }}>Foto</label><input type="file" accept="image/*" onChange={handleFoto} style={{ width: "100%" }} /></div>
            </div>
            <button type="submit" style={{ width: "100%", padding: "12px", background: "#2563EB", color: "#FFF", border: "none", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" }}>➕ Integrar Colaborador</button>
          </form>
        </div>
        <div style={{ background: "#FFFFFF", padding: "25px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
          <h3 style={{ color: "#0F172A", marginBottom: "15px", borderBottom: "2px solid #10B981" }}>📋 Efetivo no Posto</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px", maxHeight: "400px", overflowY: "auto" }}>
            {colaboradores.filter(c => c.status === "Ativo").map((colab) => (
              <div key={colab.id} onClick={() => setColaboradorSelecionado(colab)} style={{ display: "flex", alignItems: "center", gap: "15px", padding: "12px", background: "#F1F5F9", borderRadius: "8px", cursor: "pointer" }}>
                <img src={colab.foto} alt="" style={{ width: "45px", height: "45px", borderRadius: "50%", objectFit: "cover" }} />
                <div><div style={{ fontWeight: "bold" }}>{colab.nome}</div><div style={{ fontSize: "13px", color: "#64748B" }}>{colab.cargo} | {colab.turno}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {colaboradorSelecionado && (
        <div style={{ marginTop: "30px", background: "#FFFFFF", padding: "25px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
          <h3>Ficha de Acompanhamento: {colaboradorSelecionado.nome}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px" }}>
            <div>
              <h4 style={{ color: "#475569" }}>➕ Registrar Apontamento</h4>
              <form onSubmit={handleAdicionarOcorrencia}>
                <select required value={tipoOcorrencia} onChange={e => setTipoOcorrencia(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "5px" }}>
                  <option value="">Selecione...</option><option value="Falta">Falta</option><option value="FT">FT (Folga Trabalhada)</option><option value="Advertência">Advertência</option><option value="Suspensão">Suspensão</option>
                </select>
                <input type="date" required value={dataOcorrencia} onChange={e => setDataOcorrencia(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
                <input type="text" placeholder="Observações..." value={detalheOcorrencia} onChange={e => setDetalheOcorrencia(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
                <button type="submit" style={{ padding: "10px 20px", background: "#10B981", color: "#FFF", border: "none", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" }}>Salvar no Histórico</button>
              </form>
            </div>
            <div>
              <h4 style={{ color: "#475569" }}>📜 Histórico Acumulado</h4>
              <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid #E2E8F0", padding: "10px", borderRadius: "5px" }}>
                {colaboradorSelecionado.historico && colaboradorSelecionado.historico.length > 0 ? (
                  colaboradorSelecionado.historico.map((h, idx) => (
                    <div key={idx} style={{ padding: "6px 0", borderBottom: "1px solid #E2E8F0", fontSize: "13px" }}>
                      <strong>[{h.tipo}]</strong> - {h.data} | <span style={{ color: "#64748B" }}>{h.detalhe}</span>
                    </div>
                  ))
                ) : ( <p style={{ color: "#94A3B8", fontSize: "13px" }}>Sem apontamentos na folha atual.</p> )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
