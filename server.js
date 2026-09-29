// Servidor do Troco Certo: serve o jogo, guarda o ranking diário por estado,
// mede o tempo das partidas, oferece o painel do dono e guarda os códigos de recuperação.
// Rode com `npm install` e `node server.js` (Node 18 ou mais novo).
// Guarda os dados em arquivos ou, com DATABASE_URL, num PostgreSQL (veja armazenamento.js).
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Regras = require("./public/regras.js");
const Integridade = require("./integridade.js");
const { createStore } = require("./armazenamento.js");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_DIR = path.join(__dirname, "admin");

const MIN_UF_PLAYERS = 3;          // estado só entra no placar com pelo menos 3 jogadores
const MIN_MS_PER_ROUND = 800;      // ninguém entrega troco em menos que isso
const MIN_MS_PER_PIECE = 120;      // nem toca numa peça mais rápido que isso
const MAX_MS_PER_ROUND = 30 * 60 * 1000;
const NET_TOLERANCE = 1500;        // folga para a demora da internet ao medir o tempo no servidor

// ---------- Armazenamento ----------
// Tudo fica em memória para responder rápido; cada mudança também é gravada
// no armazenamento (arquivo ou PostgreSQL) e relida quando o servidor reinicia.
// Tipos de registro: resultado (sem "type"), "remove" (painel do dono), "nick" (troca de apelido).
const byDay = new Map();     // dia -> Map(playerId -> resultado)
const removed = new Set();   // "dia|playerId" removidos pelo dono
const backups = new Map();   // código -> { secretHash, data, at }
let store = null;

const difOf = (x) => (x && Regras.DAILY[x.dif] ? x.dif : "dificil");
const pkey = (dif, playerId) => `${dif}|${playerId}`;
const getEntry = (day, dif, playerId) => byDay.get(day)?.get(pkey(dif, playerId));

function remember(entry) {
  entry.dif = difOf(entry);
  if (!byDay.has(entry.day)) byDay.set(entry.day, new Map());
  byDay.get(entry.day).set(pkey(entry.dif, entry.playerId), entry);
}

function apply(rec) {
  if (!rec.type) return remember(rec);
  const key = `${rec.day}|${difOf(rec)}|${rec.playerId}`;
  if (rec.type === "remove") { if (rec.undo) removed.delete(key); else removed.add(key); }
  // Apelido vale para o jogador em todas as dificuldades do dia
  if (rec.type === "nick") for (const d of Regras.DAILY_ORDER) { const e = getEntry(rec.day, d, rec.playerId); if (e) e.nick = rec.nick; }
}

async function loadData() {
  byDay.clear(); removed.clear(); backups.clear();
  store = createStore();
  await store.init();
  await store.loadRecords(apply);
  await store.loadBackups((code, b) => backups.set(code, b));
}

async function save(rec) {
  apply(rec);
  await store.appendRecord(rec);
}

async function saveBackup(code, b) {
  backups.set(code, b);
  await store.putBackup(code, b);
}

// ---------- Datas (horário de Brasília) ----------
const dayKeyBrasilia = Regras.dayKey;

// Aceita o dia de hoje, ontem ou amanhã (fusos do Brasil e relógios adiantados)
function isPlayableDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const now = Date.now();
  return [-1, 0, 1].some((d) => dayKeyBrasilia(new Date(now + d * 86400000)) === day);
}
const validPlayer = (id) => typeof id === "string" && /^[A-Za-z0-9-]{8,64}$/.test(id);

// ---------- Tempo medido no servidor ----------
// O celular avisa quando cada cliente aparece (inicio), quando o troco é entregue (fim)
// e quando o jogo é pausado/retomado. O servidor anota a hora em que recebeu cada aviso.
// Na pontuação vale o MAIOR entre o tempo que o celular diz e o tempo medido aqui (menos
// uma folga para a internet): quem tentar declarar um tempo menor do que levou não ganha nada.
const timings = new Map(); // "dia|playerId|tentativa" -> { [rodada]: { start, end, pausedMs, pauseAt } }
const validAttempt = (t) => t === undefined || t === "" || (typeof t === "string" && /^[A-Za-z0-9]{6,32}$/.test(t));

function recordEvent(day, playerId, round, kind, now = Date.now(), attempt = "") {
  const key = `${day}|${playerId}|${attempt || ""}`;
  if (!timings.has(key)) timings.set(key, {});
  const t = timings.get(key);
  const r = (t[round] = t[round] || { start: null, end: null, pausedMs: 0, pauseAt: null });
  if (kind === "inicio" && r.start === null) r.start = now;
  if (kind === "fim" && r.end === null && r.start !== null) {
    if (r.pauseAt !== null) { r.pausedMs += now - r.pauseAt; r.pauseAt = null; }
    r.end = now;
  }
  if (kind === "pausa" && r.start !== null && r.end === null && r.pauseAt === null) r.pauseAt = now;
  if (kind === "volta" && r.pauseAt !== null) { r.pausedMs += now - r.pauseAt; r.pauseAt = null; }
}

function measuredMs(day, playerId, round, attempt = "") {
  const r = timings.get(`${day}|${playerId}|${attempt || ""}`)?.[round];
  if (!r || r.start === null || r.end === null) return null;
  return Math.max(0, r.end - r.start - r.pausedMs);
}

// Limpa medições de dias que já passaram
setInterval(() => {
  const keep = new Set([-1, 0, 1].map((d) => dayKeyBrasilia(new Date(Date.now() + d * 86400000))));
  for (const k of timings.keys()) if (!keep.has(k.split("|")[0])) timings.delete(k);
  for (const [n, v] of nonces) if (v.exp < Date.now()) nonces.delete(n);
}, 3600000).unref();

// ---------- Validação ----------
function validateSubmission(body) {
  if (!body || typeof body !== "object") return { error: "Corpo inválido." };
  const { day, uf, playerId, rounds, nick, tentativa } = body;
  const dif = body.dif === undefined ? "dificil" : body.dif;
  if (!Regras.DAILY[dif]) return { error: "Dificuldade inválida." };
  if (!validPlayer(playerId)) return { error: "Jogador inválido." };
  if (!Regras.UFS.includes(uf)) return { error: "Estado inválido." };
  if (typeof day !== "string" || !isPlayableDay(day)) return { error: "Esse desafio não está mais aberto." };
  if (!validAttempt(tentativa)) return { error: "Partida inválida." };

  const expected = Regras.makeDaily(day, dif);
  if (!Array.isArray(rounds) || rounds.length !== expected.length) return { error: "Número de clientes inválido." };

  const results = [];
  let measuredAll = true;
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
    const measured = measuredMs(day, playerId, i, tentativa);
    if (measured === null) measuredAll = false;
    // Vale o maior: o que o celular diz ou o que o servidor mediu (menos a folga da internet)
    const effective = Math.round(measured === null ? ms : Math.max(ms, measured - NET_TOLERANCE));
    results.push({ ms: effective, claimedMs: Math.round(ms), measuredMs: measured, pieces: count, best: Regras.minPieces(expected[i].change), wrong: r.wrong });
  }

  // A pontuação é sempre calculada aqui, nunca aceita do navegador
  const score = Regras.scoreOf(results).total;
  return {
    entry: {
      day, dif, uf, playerId, score, results,
      nick: Regras.validNick(nick) ? nick : null,
      timed: measuredAll,
      at: new Date().toISOString(),
    },
  };
}

// ---------- Ranking ----------
const isRemoved = (e) => removed.has(`${e.day}|${e.dif}|${e.playerId}`);
function visiblePlayers(day, dif) {
  return [...(byDay.get(day) || new Map()).values()].filter((p) => p.dif === dif && !isRemoved(p));
}

function ranking(day, uf, playerId, dif = "dificil") {
  const players = visiblePlayers(day, dif);
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

  const row = (p, i) => ({ posicao: i + 1, apelido: Regras.nickName(p.nick), uf: p.uf, score: p.score, voce: p.playerId === playerId });
  const me = playerId ? sorted.find((p) => p.playerId === playerId) : null;
  return {
    day,
    dif,
    uf,
    totalBrasil: sorted.length,
    totalUf: inUf.length,
    minJogadoresEstado: MIN_UF_PLAYERS,
    voce: me ? {
      score: me.score,
      apelido: Regras.nickName(me.nick),
      posicaoBrasil: sorted.indexOf(me) + 1,
      posicaoUf: me.uf === uf ? inUf.indexOf(me) + 1 : null,
    } : null,
    topBrasil: sorted.slice(0, 10).map(row),
    topUf: inUf.slice(0, 10).map(row),
    estados,
  };
}

// ---------- Códigos de recuperação ----------
// Guardam só dados do jogo (moedinhas, decoração, níveis, apelido): nada pessoal.
const WORDS = ["pipa", "caju", "onca", "bola", "sapo", "lua", "sol", "trem", "bolo", "gato", "pato", "peao", "gude", "cocada",
  "arara", "tatu", "boto", "mico", "jabuti", "coruja", "abelha", "estrela", "cometa", "foguete", "raio", "nuvem", "chuva",
  "praia", "rio", "mar", "ilha", "serra", "milho", "pamonha", "pastel", "pipoca", "queijo", "doce", "suco", "manga", "uva",
  "melancia", "banana", "coco", "tambor", "viola", "sanfona", "flauta", "barco", "jangada", "rede", "balao", "fita", "sino",
  "livro", "lapis", "caderno", "mochila", "patins", "skate", "carrinho", "boneca", "urso", "dado"];
const hashSecret = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

function newCode() {
  for (;;) {
    const w = () => WORDS[crypto.randomInt(WORDS.length)];
    const code = `${w()}-${w()}-${w()}-${crypto.randomInt(10, 100)}`;
    if (!backups.has(code)) return code;
  }
}

const idOk = (x) => typeof x === "string" && x.length <= 40 && /^[a-zA-Z0-9-]+$/.test(x);
function cleanBackup(d) {
  if (!d || typeof d !== "object") return null;
  const out = {};
  out.bank = Number.isInteger(d.bank) && d.bank >= 0 && d.bank <= 1e6 ? d.bank : 0;
  out.owned = Array.isArray(d.owned) ? d.owned.filter(idOk).slice(0, 300) : [];
  out.deco = {};
  if (d.deco && typeof d.deco === "object") for (const [k, v] of Object.entries(d.deco)) if (idOk(k) && idOk(v)) out.deco[k] = v;
  out.levels = {};
  if (d.levels && typeof d.levels === "object") for (const k of Regras.LEVEL_ORDER) if ([0, 1, 2, 3].includes(d.levels[k])) out.levels[k] = d.levels[k];
  out.playerId = validPlayer(d.playerId) ? d.playerId : null;
  out.nick = Regras.validNick(d.nick) ? d.nick : null;
  out.uf = Regras.UFS.includes(d.uf) ? d.uf : null;
  // Lojas, figurinhas, bichinho e rivais vencidos
  const x = d.extras && typeof d.extras === "object" ? d.extras : {};
  const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
  out.extras = {
    stores: Array.isArray(x.stores) ? x.stores.filter(idOk).slice(0, 20) : [],
    store: idOk(x.store) ? x.store : null,
    stickers: {},
    packs: int(x.packs, 99),
    rivals: Array.isArray(x.rivals) ? x.rivals.filter(idOk).slice(0, 20) : [],
    pet: null,
  };
  if (x.stickers && typeof x.stickers === "object") {
    for (const [k, v] of Object.entries(x.stickers).slice(0, 100)) if (idOk(k) && int(v, 999)) out.extras.stickers[k] = v;
  }
  const pt = x.pet;
  if (pt && typeof pt === "object") {
    out.extras.pet = { name: int(pt.name, 99), hearts: int(pt.hearts, 1e6), wear: idOk(pt.wear) ? pt.wear : null,
      acc: Array.isArray(pt.acc) ? pt.acc.filter(idOk).slice(0, 30) : [] };
  }
  return out;
}

// ---------- Play Integrity: números de uso único ----------
const nonces = new Map(); // nonce -> { playerId, exp }

// ---------- HTTP ----------
function limiter(max) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [ip, l] of hits) if (!l.some((t) => now - t < 60000)) hits.delete(ip); }, 60000).unref();
  return (ip) => {
    const now = Date.now();
    const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
    list.push(now);
    hits.set(ip, list);
    return list.length > max;
  };
}
const limitSubmit = limiter(30), limitEvents = limiter(300), limitRestore = limiter(10), limitAdmin = limiter(60);

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
async function jsonBody(req, limit) {
  try { return JSON.parse(await readBody(req, limit)); } catch { return null; }
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".txt": "text/plain; charset=utf-8" };

function serveFile(res, dir, rel) {
  const file = path.normalize(path.join(dir, rel));
  if (!file.startsWith(dir + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Não encontrado"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

// Painel do dono: só funciona com ADMIN_TOKEN definido no servidor
function isAdmin(req) {
  const token = process.env.ADMIN_TOKEN || "";
  const given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token.length < 12 || !given) return false;
  const a = Buffer.from(hashSecret(token)), b = Buffer.from(hashSecret(given));
  return crypto.timingSafeEqual(a, b);
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress;
  const p = url.pathname;

  if (p.startsWith("/api/") && !p.startsWith("/api/admin/")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  }

  if (p === "/api/saude") return sendJson(res, 200, { ok: true, hoje: dayKeyBrasilia(), integridade: Integridade.mode(), armazenamento: store.kind });

  // Avisos de tempo da partida (inicio, fim, pausa, volta)
  if (p === "/api/evento" && req.method === "POST") {
    if (limitEvents(ip)) return sendJson(res, 429, { error: "Muitos avisos." });
    const b = await jsonBody(req, 2000);
    if (!b || !validPlayer(b.playerId) || !isPlayableDay(b.day) || !Number.isInteger(b.round) || b.round < 0 || b.round > 4
      || !["inicio", "fim", "pausa", "volta"].includes(b.tipo) || !validAttempt(b.tentativa)) return sendJson(res, 400, { error: "Aviso inválido." });
    recordEvent(b.day, b.playerId, b.round, b.tipo, Date.now(), b.tentativa);
    return sendJson(res, 200, { ok: true });
  }

  // Número de uso único para o Play Integrity
  if (p === "/api/nonce" && req.method === "POST") {
    if (limitSubmit(ip)) return sendJson(res, 429, { error: "Muitos pedidos." });
    const b = await jsonBody(req, 1000);
    if (!b || !validPlayer(b.playerId)) return sendJson(res, 400, { error: "Jogador inválido." });
    const nonce = crypto.randomBytes(24).toString("base64url");
    nonces.set(nonce, { playerId: b.playerId, exp: Date.now() + 10 * 60000 });
    return sendJson(res, 200, { nonce });
  }

  if (p === "/api/resultado" && req.method === "POST") {
    if (limitSubmit(ip)) return sendJson(res, 429, { error: "Muitos envios. Tente de novo em um minuto." });
    const body = await jsonBody(req);
    if (!body) return sendJson(res, 400, { error: "Corpo inválido." });
    const { error, entry } = validateSubmission(body);
    if (error) return sendJson(res, 400, { error });
    // Pode jogar o desafio do dia quantas vezes quiser: no ranking fica o melhor tempo
    const existing = getEntry(entry.day, entry.dif, entry.playerId);
    if (existing && isRemoved(existing)) return sendJson(res, 409, { error: "Seu resultado de hoje foi retirado do ranking." });
    if (existing && entry.score >= existing.score) return sendJson(res, 200, { melhorou: false, ranking: ranking(entry.day, existing.uf, entry.playerId, entry.dif) });
    if (existing) entry.tentativas = (existing.tentativas || 1) + 1;

    // Play Integrity (desligado até o app estar na Play Store)
    const mode = Integridade.mode();
    entry.integrity = "desligado";
    if (mode !== "off") {
      const ig = body.integrity || {};
      const n = nonces.get(ig.nonce);
      nonces.delete(ig.nonce);
      const verdict = n && n.playerId === entry.playerId && n.exp > Date.now()
        ? await Integridade.verify(ig.token, ig.nonce)
        : { ok: false, reason: "nonce" };
      entry.integrity = verdict.ok ? "ok" : `falhou: ${verdict.reason}`;
      if (!verdict.ok && mode === "require") return sendJson(res, 403, { error: "Não conseguimos confirmar que o jogo é original. Baixe pela Play Store." });
    }
    await save(entry);
    return sendJson(res, 201, { melhorou: true, ranking: ranking(entry.day, entry.uf, entry.playerId, entry.dif) });
  }

  // Troca de apelido (também no resultado de hoje, se já tiver jogado)
  if (p === "/api/apelido" && req.method === "POST") {
    if (limitSubmit(ip)) return sendJson(res, 429, { error: "Muitos pedidos." });
    const b = await jsonBody(req, 1000);
    if (!b || !validPlayer(b.playerId) || !Regras.validNick(b.nick) || !isPlayableDay(b.day)) return sendJson(res, 400, { error: "Apelido inválido." });
    if (Regras.DAILY_ORDER.some((d) => getEntry(b.day, d, b.playerId))) await save({ type: "nick", day: b.day, playerId: b.playerId, nick: b.nick });
    return sendJson(res, 200, { ok: true, apelido: Regras.nickName(b.nick) });
  }

  if (p === "/api/ranking" && req.method === "GET") {
    const day = url.searchParams.get("day") || dayKeyBrasilia();
    const uf = url.searchParams.get("uf") || "SP";
    const dif = url.searchParams.get("dif") || "dificil";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Regras.UFS.includes(uf) || !Regras.DAILY[dif]) return sendJson(res, 400, { error: "Parâmetros inválidos." });
    return sendJson(res, 200, ranking(day, uf, url.searchParams.get("playerId"), dif));
  }

  // Código de recuperação: criar ou atualizar
  if (p === "/api/backup" && req.method === "POST") {
    if (limitSubmit(ip)) return sendJson(res, 429, { error: "Muitos pedidos." });
    const b = await jsonBody(req, 12000);
    const data = b && cleanBackup(b.data);
    if (!data) return sendJson(res, 400, { error: "Dados inválidos." });
    if (b.code) {
      const cur = backups.get(b.code);
      if (!cur || cur.secretHash !== hashSecret(b.secret)) return sendJson(res, 403, { error: "Código não confere." });
      await saveBackup(b.code, { secretHash: cur.secretHash, data, at: new Date().toISOString() });
      return sendJson(res, 200, { code: b.code, secret: b.secret });
    }
    const code = newCode(), secret = crypto.randomBytes(18).toString("base64url");
    await saveBackup(code, { secretHash: hashSecret(secret), data, at: new Date().toISOString() });
    return sendJson(res, 201, { code, secret });
  }

  // Código de recuperação: restaurar (limite baixo de tentativas contra quem tenta adivinhar)
  if (p.startsWith("/api/backup/") && req.method === "GET") {
    if (limitRestore(ip)) return sendJson(res, 429, { error: "Muitas tentativas. Espere um minuto." });
    const code = decodeURIComponent(p.slice("/api/backup/".length)).trim().toLowerCase();
    const cur = backups.get(code);
    if (!cur) return sendJson(res, 404, { error: "Código não encontrado. Confira as palavras e o número." });
    return sendJson(res, 200, { data: cur.data });
  }

  // ---------- Painel do dono ----------
  if (p.startsWith("/api/admin/")) {
    if (limitAdmin(ip)) return sendJson(res, 429, { error: "Muitos pedidos." });
    if (!process.env.ADMIN_TOKEN) return sendJson(res, 503, { error: "Painel desligado: defina ADMIN_TOKEN no servidor." });
    if (!isAdmin(req)) return sendJson(res, 401, { error: "Senha do painel incorreta." });
    if (p === "/api/admin/dia" && req.method === "GET") {
      const day = url.searchParams.get("day") || dayKeyBrasilia();
      const list = [...(byDay.get(day) || new Map()).values()].sort((a, b) => a.dif.localeCompare(b.dif) || a.score - b.score).map((e) => ({
        playerId: e.playerId, dif: e.dif, apelido: Regras.nickName(e.nick), uf: e.uf, score: e.score, at: e.at,
        erros: e.results.reduce((a, r) => a + r.wrong, 0),
        declarado: e.results.reduce((a, r) => a + (r.claimedMs ?? r.ms), 0),
        medido: e.results.every((r) => typeof r.measuredMs === "number") ? e.results.reduce((a, r) => a + r.measuredMs, 0) : null,
        rodadas: e.results.map((r) => ({ declarado: r.claimedMs ?? r.ms, medido: r.measuredMs ?? null })),
        integridade: e.integrity || "desligado",
        removido: isRemoved(e),
      }));
      return sendJson(res, 200, { day, total: list.length, resultados: list });
    }
    if (p === "/api/admin/remover" && req.method === "POST") {
      const b = await jsonBody(req, 1000);
      const dif = Regras.DAILY[b && b.dif] ? b.dif : "dificil";
      if (!b || !validPlayer(b.playerId) || !/^\d{4}-\d{2}-\d{2}$/.test(b.day) || !getEntry(b.day, dif, b.playerId)) return sendJson(res, 400, { error: "Resultado não encontrado." });
      await save({ type: "remove", day: b.day, dif, playerId: b.playerId, undo: !!b.desfazer, at: new Date().toISOString() });
      return sendJson(res, 200, { ok: true, removido: !b.desfazer });
    }
    return sendJson(res, 404, { error: "Rota não encontrada." });
  }

  if (p.startsWith("/api/")) return sendJson(res, 404, { error: "Rota não encontrada." });
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  if (p === "/admin" || p === "/admin/") return serveFile(res, ADMIN_DIR, "index.html");
  const rel = p === "/" ? "index.html" : decodeURIComponent(p).replace(/^\/+/, "");
  serveFile(res, PUBLIC_DIR, rel);
}

async function createServer() {
  await loadData();
  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => { console.error(e); if (!res.headersSent) sendJson(res, 500, { error: "Erro no servidor." }); });
  });
  server.on("close", () => { store.close().catch(() => {}); });
  return server;
}

if (require.main === module) {
  createServer()
    .then((server) => server.listen(PORT, () => console.log(`Troco Certo rodando em http://localhost:${PORT} (dados: ${store.kind})`)))
    .catch((e) => { console.error("Não consegui abrir o armazenamento:", e.message); process.exit(1); });
}

module.exports = { createServer, validateSubmission, ranking, dayKeyBrasilia, recordEvent, measuredMs };
