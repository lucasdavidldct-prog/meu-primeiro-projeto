// Servidor do Troco Certo: serve o jogo e guarda o ranking diário por estado.
// Sem dependências: rode com `node server.js` (Node 18 ou mais novo).
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const Regras = require("./public/regras.js");

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "dados");
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_FILE = path.join(DATA_DIR, "resultados.jsonl");

const MIN_UF_PLAYERS = 3;          // estado só entra no placar com pelo menos 3 jogadores
const MIN_MS_PER_ROUND = 800;      // ninguém entrega troco em menos que isso
const MIN_MS_PER_PIECE = 120;      // nem toca numa peça mais rápido que isso
const MAX_MS_PER_ROUND = 30 * 60 * 1000;
const RATE_LIMIT = 30;             // envios por IP por minuto

// ---------- Armazenamento ----------
// Um resultado por linha (JSON Lines). Tudo fica em memória; o arquivo só recebe acréscimos.
// dia -> Map(playerId -> resultado)
const byDay = new Map();

function remember(entry) {
  if (!byDay.has(entry.day)) byDay.set(entry.day, new Map());
  byDay.get(entry.day).set(entry.playerId, entry);
}

function loadData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) return;
  for (const line of fs.readFileSync(DATA_FILE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { remember(JSON.parse(line)); } catch { /* linha corrompida: ignora */ }
  }
}

function save(entry) {
  fs.appendFileSync(DATA_FILE, JSON.stringify(entry) + "\n");
  remember(entry);
}

// ---------- Datas (horário de Brasília) ----------
const dayKeyBrasilia = Regras.dayKey;

// Aceita o dia de hoje, ontem ou amanhã (fusos do Brasil e relógios adiantados)
function isPlayableDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const now = Date.now();
  return [-1, 0, 1].some((d) => dayKeyBrasilia(new Date(now + d * 86400000)) === day);
}

// ---------- Validação ----------
function validateSubmission(body) {
  if (!body || typeof body !== "object") return { error: "Corpo inválido." };
  const { day, uf, playerId, rounds } = body;
  if (typeof playerId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(playerId)) return { error: "Jogador inválido." };
  if (!Regras.UFS.includes(uf)) return { error: "Estado inválido." };
  if (typeof day !== "string" || !isPlayableDay(day)) return { error: "Esse desafio não está mais aberto." };

  const expected = Regras.makeRounds(Regras.dailySeed(day));
  if (!Array.isArray(rounds) || rounds.length !== expected.length) return { error: "Número de clientes inválido." };

  const results = [];
  for (let i = 0; i < expected.length; i++) {
    const r = rounds[i] || {};
    if (!r.pieces || typeof r.pieces !== "object") return { error: `Cliente ${i + 1}: troco ausente.` };
    let sum = 0, count = 0;
    for (const [value, n] of Object.entries(r.pieces)) {
      const v = Number(value);
      if (!Regras.VALORES.includes(v) || !Number.isInteger(n) || n < 0 || n > 200) return { error: `Cliente ${i + 1}: peça inválida.` };
      sum += v * n; count += n;
    }
    if (sum !== expected[i].change) return { error: `Cliente ${i + 1}: o troco não confere.` };
    if (!Number.isInteger(r.wrong) || r.wrong < 0 || r.wrong > 100) return { error: `Cliente ${i + 1}: contagem de erros inválida.` };
    const ms = Number(r.ms);
    const floor = Math.max(MIN_MS_PER_ROUND, count * MIN_MS_PER_PIECE);
    if (!Number.isFinite(ms) || ms < floor || ms > MAX_MS_PER_ROUND) return { error: `Cliente ${i + 1}: tempo impossível.` };
    results.push({ ms: Math.round(ms), pieces: count, best: Regras.minPieces(expected[i].change), wrong: r.wrong });
  }

  // A pontuação é sempre calculada aqui, nunca aceita do navegador
  const score = Regras.scoreOf(results).total;
  return { entry: { day, uf, playerId, score, results, at: new Date().toISOString() } };
}

// ---------- Ranking ----------
function ranking(day, uf, playerId) {
  const players = [...(byDay.get(day) || new Map()).values()];
  const sorted = players.slice().sort((a, b) => a.score - b.score);
  const inUf = sorted.filter((p) => p.uf === uf);

  const groups = new Map();
  for (const p of players) {
    if (!groups.has(p.uf)) groups.set(p.uf, []);
    groups.get(p.uf).push(p.score);
  }
  const estados = [...groups.entries()]
    .map(([u, scores]) => ({ uf: u, jogadores: scores.length, media: Math.round(scores.reduce((a, s) => a + s, 0) / scores.length), melhor: Math.min(...scores) }))
    .sort((a, b) => (b.jogadores >= MIN_UF_PLAYERS) - (a.jogadores >= MIN_UF_PLAYERS) || a.media - b.media);
  estados.forEach((e, i) => { e.posicao = e.jogadores >= MIN_UF_PLAYERS ? i + 1 : null; });

  const me = playerId ? sorted.find((p) => p.playerId === playerId) : null;
  return {
    day,
    uf,
    totalBrasil: sorted.length,
    totalUf: inUf.length,
    minJogadoresEstado: MIN_UF_PLAYERS,
    voce: me ? {
      score: me.score,
      posicaoBrasil: sorted.indexOf(me) + 1,
      posicaoUf: me.uf === uf ? inUf.indexOf(me) + 1 : null,
    } : null,
    topUf: inUf.slice(0, 10).map((p, i) => ({ posicao: i + 1, score: p.score, voce: p.playerId === playerId })),
    estados,
  };
}

// ---------- HTTP ----------
const hits = new Map(); // ip -> [timestamps]
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_LIMIT;
}
setInterval(() => { const now = Date.now(); for (const [ip, l] of hits) if (!l.some((t) => now - t < 60000)) hits.delete(ip); }, 60000).unref();

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function readBody(req, limit = 10000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("grande demais")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json" };

function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Não encontrado"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress;

  if (url.pathname.startsWith("/api/")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  }

  if (url.pathname === "/api/saude") return sendJson(res, 200, { ok: true, hoje: dayKeyBrasilia() });

  if (url.pathname === "/api/resultado" && req.method === "POST") {
    if (rateLimited(ip)) return sendJson(res, 429, { error: "Muitos envios. Tente de novo em um minuto." });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: "Corpo inválido." }); }
    const { error, entry } = validateSubmission(body);
    if (error) return sendJson(res, 400, { error });
    const existing = byDay.get(entry.day)?.get(entry.playerId);
    if (existing) return sendJson(res, 409, { error: "Você já jogou o desafio de hoje.", ranking: ranking(entry.day, existing.uf, entry.playerId) });
    save(entry);
    return sendJson(res, 201, { ranking: ranking(entry.day, entry.uf, entry.playerId) });
  }

  if (url.pathname === "/api/ranking" && req.method === "GET") {
    const day = url.searchParams.get("day") || dayKeyBrasilia();
    const uf = url.searchParams.get("uf") || "SP";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Regras.UFS.includes(uf)) return sendJson(res, 400, { error: "Parâmetros inválidos." });
    return sendJson(res, 200, ranking(day, uf, url.searchParams.get("playerId")));
  }

  if (url.pathname.startsWith("/api/")) return sendJson(res, 404, { error: "Rota não encontrada." });
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  serveStatic(req, res, url.pathname);
}

function createServer() {
  loadData();
  return http.createServer((req, res) => {
    handle(req, res).catch((e) => { console.error(e); if (!res.headersSent) sendJson(res, 500, { error: "Erro no servidor." }); });
  });
}

if (require.main === module) {
  createServer().listen(PORT, () => console.log(`Troco Certo rodando em http://localhost:${PORT}`));
}

module.exports = { createServer, validateSubmission, ranking, dayKeyBrasilia };
