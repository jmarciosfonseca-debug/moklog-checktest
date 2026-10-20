// Gera o hash de um PIN para as variáveis de ambiente (ADMIN_PIN_HASH, LIDER_PIN_HASHES, CLIENTE_PIN_HASHES).
// Uso: node scripts/pin-hash.js 123456   → imprime scrypt:<salt>:<hash>
const crypto = require("crypto");
const pin = String(process.argv[2] || "").trim();
if (!pin) { console.error("Uso: node scripts/pin-hash.js <PIN>"); process.exit(1); }
const salt = crypto.randomBytes(16).toString("hex");
console.log(`scrypt:${salt}:${crypto.scryptSync(pin, Buffer.from(salt, "hex"), 32).toString("hex")}`);
