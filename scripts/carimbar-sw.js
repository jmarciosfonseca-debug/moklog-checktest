// Depois do build: grava a versão da publicação no service worker. Sem isso o arquivo seria idêntico em todo deploy e o
// navegador nunca perceberia que há versão nova. Falha o build se o marcador sumir (melhor travar aqui do que publicar sem versão).
const fs = require("fs");
const path = require("path");
const alvo = path.join(__dirname, "..", "build", "sw.js");
const id = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 10) || Date.now().toString(36);
const txt = fs.readFileSync(alvo, "utf8");
if (!txt.includes("__BUILD_ID__")) { console.error("carimbar-sw: marcador __BUILD_ID__ não encontrado em build/sw.js"); process.exit(1); }
fs.writeFileSync(alvo, txt.replace(/__BUILD_ID__/g, id));
console.log("carimbar-sw: versão", id);
