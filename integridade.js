// Verificação do Play Integrity: prova que o resultado veio do app original,
// baixado da Play Store, num celular de verdade.
//
// Configuração (variáveis de ambiente do servidor):
//   INTEGRITY_MODE          off (padrão) | log (verifica e só anota) | require (recusa quem falhar)
//   GOOGLE_SERVICE_ACCOUNT  conteúdo JSON da conta de serviço do Google Cloud com acesso à Play Integrity API
//   PLAY_PACKAGE            nome do pacote do app (padrão: app.trococerto)
"use strict";

const crypto = require("node:crypto");

const PACKAGE = process.env.PLAY_PACKAGE || "app.trococerto";
let cached = null; // { token, exp }

function serviceAccount() {
  try { return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || ""); } catch { return null; }
}

// Token de acesso OAuth a partir da conta de serviço (JWT assinado com RS256)
async function accessToken(fetchImpl, sa) {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/playintegrity",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
  const r = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!r.ok) throw new Error("oauth " + r.status);
  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

// Avalia o veredito decodificado pelo Google
function judge(payload, nonce) {
  const req = payload && payload.requestDetails;
  if (!req || req.requestPackageName !== PACKAGE) return { ok: false, reason: "pacote" };
  if (req.nonce !== nonce) return { ok: false, reason: "nonce" };
  if (!payload.appIntegrity || payload.appIntegrity.appRecognitionVerdict !== "PLAY_RECOGNIZED") return { ok: false, reason: "app" };
  const dev = (payload.deviceIntegrity && payload.deviceIntegrity.deviceRecognitionVerdict) || [];
  if (!dev.includes("MEETS_DEVICE_INTEGRITY") && !dev.includes("MEETS_BASIC_INTEGRITY")) return { ok: false, reason: "aparelho" };
  return { ok: true, reason: "ok" };
}

async function verify(token, nonce, fetchImpl = fetch) {
  const sa = serviceAccount();
  if (!sa) return { ok: false, reason: "sem-conta-de-servico" };
  if (typeof token !== "string" || token.length < 20) return { ok: false, reason: "sem-token" };
  try {
    const at = await accessToken(fetchImpl, sa);
    const r = await fetchImpl(`https://playintegrity.googleapis.com/v1/${PACKAGE}:decodeIntegrityToken`, {
      method: "POST",
      headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
      body: JSON.stringify({ integrity_token: token }),
    });
    if (!r.ok) return { ok: false, reason: "google " + r.status };
    const j = await r.json();
    return judge(j.tokenPayloadExternal, nonce);
  } catch (e) {
    return { ok: false, reason: "erro" };
  }
}

const mode = () => (["log", "require"].includes(process.env.INTEGRITY_MODE) ? process.env.INTEGRITY_MODE : "off");

module.exports = { verify, judge, mode, _reset: () => { cached = null; } };
