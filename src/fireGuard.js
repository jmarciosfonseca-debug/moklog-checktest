// ─────────────────────────────────────────────────────────────
// fireGuard.js — Guarda de escrita do Firestore (modo demonstração GAL)
//
// Todos os módulos devem importar as funções de ESCRITA daqui, em vez de
// direto de "firebase/firestore":
//
//   import { setDoc, updateDoc, deleteDoc, addDoc } from "./fireGuard";
//
// Comportamento:
//   • Sessão normal (equipe/gerencial) → repassa direto ao Firestore real.
//   • Sessão demo (PIN GAL 601604)     → NÃO grava nada; simula sucesso.
//       - setDoc/updateDoc/deleteDoc → resolvem sem efeito no banco
//       - addDoc → devolve um ref falso { id: "demo-..." } para a UI seguir
//
// Assim o visitante (GAL) adiciona/edita/exclui e vê o efeito na tela
// (estado local do React), mas NADA chega ao banco. Fechou o app, sumiu.
//
// IMPORTANTE: leituras (getDoc/getDocs/onSnapshot) NÃO passam por aqui —
// o demo pode ler tudo normalmente. Só a ESCRITA é bloqueada.
//
// RondaVirtual e TempoGravacao recebem `setDoc` por props do AcessoCCO;
// como o AcessoCCO passará a importar daqui, esses módulos saem cobertos
// automaticamente (o handle repassado já é o guardado).
// ─────────────────────────────────────────────────────────────

import {
  setDoc as _setDoc,
  updateDoc as _updateDoc,
  deleteDoc as _deleteDoc,
  addDoc as _addDoc,
} from "firebase/firestore";
import { isDemo } from "./session";

export async function setDoc(...args) {
  if (isDemo()) return;            // 🎭 demo: simula sucesso sem gravar
  return _setDoc(...args);
}

export async function updateDoc(...args) {
  if (isDemo()) return;
  return _updateDoc(...args);
}

export async function deleteDoc(...args) {
  if (isDemo()) return;
  return _deleteDoc(...args);
}

export async function addDoc(...args) {
  if (isDemo()) return { id: "demo-" + Date.now() }; // ref falso p/ a UI seguir
  return _addDoc(...args);
}
