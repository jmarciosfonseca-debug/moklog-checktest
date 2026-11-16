// Compatibilidade com celulares mais antigos (iPhone anterior ao iOS 15.4, Android com navegador desatualizado).
// Só acrescenta o que falta; em aparelho atual não faz nada. Precisa ser o primeiro import do app.
/* eslint-disable no-extend-native */
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, "at", { configurable: true, writable: true, value: function at(n) {
    const i = Math.trunc(n) || 0, k = i < 0 ? this.length + i : i;
    return k < 0 || k >= this.length ? undefined : this[k];
  } });
}
if (!String.prototype.at) {
  Object.defineProperty(String.prototype, "at", { configurable: true, writable: true, value: function at(n) {
    const i = Math.trunc(n) || 0, k = i < 0 ? this.length + i : i;
    return k < 0 || k >= this.length ? undefined : this.charAt(k);
  } });
}
try {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (c && typeof c.randomUUID !== "function" && typeof c.getRandomValues === "function") {
    c.randomUUID = function randomUUID() {
      const b = c.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    };
  }
} catch (e) { /* sem crypto: os módulos já têm alternativa própria */ }
