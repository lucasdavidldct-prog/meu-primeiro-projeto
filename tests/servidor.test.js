"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "troco-"));
process.env.ADMIN_TOKEN = "senha-do-dono-de-teste";
const { createServer, dayKeyBrasilia } = require("../server.js");
const Regras = require("../public/regras.js");

let server, base;
before(async () => {
  server = await createServer();
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

// Monta o troco com o menor número de peças (guloso funciona para o Real)
function greedy(amount) {
  const pieces = {};
  for (const v of Regras.VALORES) while (amount >= v) { pieces[v] = (pieces[v] || 0) + 1; amount -= v; }
  return pieces;
}

function play(day, { ms = 4000, wrong = 0 } = {}) {
  return Regras.makeRounds(Regras.dailySeed(day)).map((r) => ({ pieces: greedy(r.change), ms, wrong }));
}

const post = (body) => fetch(base + "/api/resultado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  .then(async (r) => ({ status: r.status, data: await r.json() }));

const today = dayKeyBrasilia();

test("o troco guloso é sempre o mínimo de peças", () => {
  for (let c = 5; c <= 20000; c += 5) {
    const n = Object.values(greedy(c)).reduce((a, b) => a + b, 0);
    assert.strictEqual(n, Regras.minPieces(c), `troco de ${c} centavos`);
  }
});

test("todo desafio tem troco positivo e múltiplo de 5 centavos", () => {
  for (let i = 0; i < 400; i++) {
    for (const r of Regras.makeRounds("troco-teste-" + i)) {
      assert.ok(r.change > 0 && r.change % 5 === 0 && r.change < 20000);
    }
  }
});

test("aceita um resultado válido e calcula a pontuação no servidor", async () => {
  const { status, data } = await post({ day: today, uf: "SP", playerId: "jogador-aaaa", rounds: play(today, { wrong: 0 }) , score: 1 });
  assert.strictEqual(status, 201);
  assert.strictEqual(data.ranking.voce.score, 5 * 4000);
  assert.strictEqual(data.ranking.voce.posicaoUf, 1);
});

test("pode jogar de novo no mesmo dia e vale o melhor tempo", async () => {
  const worse = await post({ day: today, uf: "SP", playerId: "jogador-aaaa", rounds: play(today, { ms: 6000 }) });
  assert.strictEqual(worse.status, 200);
  assert.strictEqual(worse.data.melhorou, false);
  assert.strictEqual(worse.data.ranking.voce.score, 5 * 4000); // continua o melhor
  const better = await post({ day: today, uf: "SP", playerId: "jogador-melhora", rounds: play(today, { ms: 6000 }) });
  assert.strictEqual(better.status, 201);
  const b2 = await post({ day: today, uf: "SP", playerId: "jogador-melhora", rounds: play(today, { ms: 5000 }) });
  assert.strictEqual(b2.status, 201);
  assert.strictEqual(b2.data.melhorou, true);
  assert.strictEqual(b2.data.ranking.voce.score, 5 * 5000);
});

test("recusa troco que não confere", async () => {
  const rounds = play(today);
  rounds[2].pieces = { 5: 1 };
  const { status, data } = await post({ day: today, uf: "SP", playerId: "jogador-bbbb", rounds });
  assert.strictEqual(status, 400);
  assert.match(data.error, /não confere/);
});

test("recusa tempo impossível", async () => {
  const { status, data } = await post({ day: today, uf: "SP", playerId: "jogador-cccc", rounds: play(today, { ms: 100 }) });
  assert.strictEqual(status, 400);
  assert.match(data.error, /tempo/);
});

test("recusa desafio antigo e estado inválido", async () => {
  assert.strictEqual((await post({ day: "2020-01-01", uf: "SP", playerId: "jogador-dddd", rounds: play("2020-01-01") })).status, 400);
  assert.strictEqual((await post({ day: today, uf: "XX", playerId: "jogador-dddd", rounds: play(today) })).status, 400);
});

test("monta o placar dos estados com mínimo de 3 jogadores", async () => {
  await post({ day: today, uf: "SP", playerId: "jogador-sp-2", rounds: play(today, { ms: 5000 }) });
  await post({ day: today, uf: "SP", playerId: "jogador-sp-3", rounds: play(today, { ms: 6000 }) });
  await post({ day: today, uf: "RJ", playerId: "jogador-rj-1", rounds: play(today, { ms: 2000 }) });
  const r = await fetch(`${base}/api/ranking?day=${today}&uf=SP&playerId=jogador-sp-3`).then((x) => x.json());
  assert.strictEqual(r.totalBrasil, 5);
  assert.strictEqual(r.totalUf, 4);
  assert.deepStrictEqual(r.voce, { score: 30000, apelido: "Jogador", posicaoBrasil: 5, posicaoUf: 4 });
  assert.strictEqual(r.estados[0].uf, "SP");       // único com 3+ jogadores
  assert.strictEqual(r.estados[0].posicao, 1);
  assert.strictEqual(r.estados[1].posicao, null);  // RJ tem só 1 jogador
});

test("grava cada resultado aceito no arquivo de dados", { skip: !!process.env.DATABASE_URL }, () => {
  const lines = fs.readFileSync(path.join(process.env.DATA_DIR, "resultados.jsonl"), "utf8").trim().split("\n");
  assert.ok(lines.length >= 4);
});

test("serve o jogo e bloqueia acesso fora da pasta pública", async () => {
  const home = await fetch(base + "/");
  assert.strictEqual(home.status, 200);
  assert.match(await home.text(), /Troco Certo/);
  assert.strictEqual((await fetch(base + "/regras.js")).status, 200);
  assert.notStrictEqual((await fetch(base + "/..%2fserver.js")).status, 200);
});

test("libera o acesso da API para o app Android (CORS)", async () => {
  const r = await fetch(base + "/api/resultado", { method: "OPTIONS" });
  assert.strictEqual(r.status, 204);
  assert.strictEqual(r.headers.get("access-control-allow-origin"), "*");
});

// ---------- Apelidos ----------
test("mostra o apelido no top 10 e aceita só apelidos da lista", async () => {
  const nick = { n: 0, a: 0, num: 7 }; // Onça Veloz 7
  const { status, data } = await post({ day: today, uf: "MG", playerId: "jogador-nick-1", nick, rounds: play(today, { ms: 3000 }) });
  assert.strictEqual(status, 201);
  assert.strictEqual(data.ranking.voce.apelido, "🐆 Onça Veloz 7");
  assert.ok(data.ranking.topBrasil.some((p) => p.apelido === "🐆 Onça Veloz 7" && p.uf === "MG" && p.voce));
  // apelido fora da lista vira "Jogador"
  const bad = await post({ day: today, uf: "MG", playerId: "jogador-nick-2", nick: { n: 999, a: 0, num: 1 }, rounds: play(today, { ms: 3000 }) });
  assert.strictEqual(bad.data.ranking.voce.apelido, "Jogador");
});

test("troca o apelido de quem já jogou hoje", async () => {
  const r = await fetch(base + "/api/apelido", { method: "POST", body: JSON.stringify({ day: today, playerId: "jogador-nick-1", nick: { n: 1, a: 2, num: 3 } }) }).then((x) => x.json());
  assert.strictEqual(r.apelido, "🦜 Arara Genial 3");
  const rk = await fetch(`${base}/api/ranking?day=${today}&uf=MG&playerId=jogador-nick-1`).then((x) => x.json());
  assert.strictEqual(rk.voce.apelido, "🦜 Arara Genial 3");
  const bad = await fetch(base + "/api/apelido", { method: "POST", body: JSON.stringify({ day: today, playerId: "jogador-nick-1", nick: { n: 0, a: 0, num: 500 } }) });
  assert.strictEqual(bad.status, 400);
});

// ---------- Tempo medido no servidor ----------
test("usa o tempo medido pelo servidor quando o declarado é menor", () => {
  const { recordEvent, validateSubmission } = require("../server.js");
  const pid = "jogador-tempo-1", t0 = 1_000_000;
  for (let i = 0; i < 5; i++) {
    recordEvent(today, pid, i, "inicio", t0 + i * 100000);
    recordEvent(today, pid, i, "fim", t0 + i * 100000 + 20000); // levou 20s de verdade
  }
  // declara 2s por cliente: vale 20s - 1,5s de folga = 18,5s
  const { entry } = validateSubmission({ day: today, uf: "SP", playerId: pid, rounds: play(today, { ms: 2000 }) });
  assert.strictEqual(entry.timed, true);
  assert.strictEqual(entry.score, 5 * 18500);
  assert.strictEqual(entry.results[0].claimedMs, 2000);
  assert.strictEqual(entry.results[0].measuredMs, 20000);
});

test("desconta pausas e mantém o tempo declarado quando é maior", () => {
  const { recordEvent, measuredMs, validateSubmission } = require("../server.js");
  const pid = "jogador-tempo-2", t0 = 2_000_000;
  recordEvent(today, pid, 0, "inicio", t0);
  recordEvent(today, pid, 0, "pausa", t0 + 5000);
  recordEvent(today, pid, 0, "volta", t0 + 65000); // ficou 1 minuto fora do app
  recordEvent(today, pid, 0, "fim", t0 + 9000 + 60000);
  assert.strictEqual(measuredMs(today, pid, 0), 9000);
  for (let i = 1; i < 5; i++) { recordEvent(today, pid, i, "inicio", t0 + i * 1e5); recordEvent(today, pid, i, "fim", t0 + i * 1e5 + 4000); }
  const { entry } = validateSubmission({ day: today, uf: "SP", playerId: pid, rounds: play(today, { ms: 9000 }) });
  assert.strictEqual(entry.score, 5 * 9000); // declarado (9s) é maior que medido-folga
});

test("sem avisos de tempo o resultado entra, marcado como não medido", () => {
  const { validateSubmission } = require("../server.js");
  const { entry } = validateSubmission({ day: today, uf: "SP", playerId: "jogador-offline", rounds: play(today, { ms: 5000 }) });
  assert.strictEqual(entry.timed, false);
  assert.strictEqual(entry.score, 25000);
});

test("cada partida do dia tem sua própria medição de tempo", () => {
  const { recordEvent, measuredMs } = require("../server.js");
  recordEvent(today, "jogador-tent", 0, "inicio", 1000, "partidaA1");
  recordEvent(today, "jogador-tent", 0, "fim", 9000, "partidaA1");
  recordEvent(today, "jogador-tent", 0, "inicio", 50000, "partidaB2");
  recordEvent(today, "jogador-tent", 0, "fim", 53000, "partidaB2");
  assert.strictEqual(measuredMs(today, "jogador-tent", 0, "partidaA1"), 8000);
  assert.strictEqual(measuredMs(today, "jogador-tent", 0, "partidaB2"), 3000);
});

test("aceita avisos de tempo pela rede e recusa avisos inválidos", async () => {
  const ok = await fetch(base + "/api/evento", { method: "POST", body: JSON.stringify({ day: today, playerId: "jogador-evt", round: 0, tipo: "inicio" }) });
  assert.strictEqual(ok.status, 200);
  const bad = await fetch(base + "/api/evento", { method: "POST", body: JSON.stringify({ day: today, playerId: "jogador-evt", round: 9, tipo: "inicio" }) });
  assert.strictEqual(bad.status, 400);
});

// ---------- Painel do dono ----------
test("painel do dono exige senha, lista o dia e remove do ranking", async () => {
  const noAuth = await fetch(`${base}/api/admin/dia?day=${today}`);
  assert.strictEqual(noAuth.status, 401);
  const wrong = await fetch(`${base}/api/admin/dia?day=${today}`, { headers: { Authorization: "Bearer errada-errada-errada" } });
  assert.strictEqual(wrong.status, 401);
  const H = { Authorization: "Bearer senha-do-dono-de-teste" };
  const dia = await fetch(`${base}/api/admin/dia?day=${today}`, { headers: H }).then((x) => x.json());
  assert.ok(dia.total >= 4);
  const rj = dia.resultados.find((r) => r.playerId === "jogador-rj-1");
  assert.ok(rj && rj.removido === false);
  const rm = await fetch(base + "/api/admin/remover", { method: "POST", headers: H, body: JSON.stringify({ day: today, playerId: "jogador-rj-1" }) });
  assert.strictEqual(rm.status, 200);
  const rk = await fetch(`${base}/api/ranking?day=${today}&uf=RJ`).then((x) => x.json());
  assert.strictEqual(rk.totalUf, 0);
  // não pode reenviar para "voltar" ao ranking
  const again = await post({ day: today, uf: "RJ", playerId: "jogador-rj-1", rounds: play(today, { ms: 1000 }) });
  assert.strictEqual(again.status, 409);
  // desfazer
  await fetch(base + "/api/admin/remover", { method: "POST", headers: H, body: JSON.stringify({ day: today, playerId: "jogador-rj-1", desfazer: true }) });
  const rk2 = await fetch(`${base}/api/ranking?day=${today}&uf=RJ`).then((x) => x.json());
  assert.strictEqual(rk2.totalUf, 1);
  // a página do painel é servida em /admin
  assert.strictEqual((await fetch(base + "/admin")).status, 200);
});

// ---------- Código de recuperação ----------
test("cria, atualiza e restaura um código de recuperação", async () => {
  const data = { bank: 120, owned: ["a-gato", "x-MG-0"], deco: { bichinho: "a-gato" }, levels: { iniciante: 3 }, playerId: "jogador-backup-1", nick: { n: 2, a: 3, num: 9 }, uf: "MG",
    extras: { stores: ["pipoca"], store: "pipoca", stickers: { "viz-1": 2, "bicho-200": 1 }, packs: 3, rivals: ["tito"], pet: { name: 4, hearts: 12, wear: "coroa", acc: ["coroa"] } } };
  const c = await fetch(base + "/api/backup", { method: "POST", body: JSON.stringify({ data }) });
  assert.strictEqual(c.status, 201);
  const { code, secret } = await c.json();
  assert.match(code, /^[a-z]+-[a-z]+-[a-z]+-\d{2}$/);
  // atualizar exige o segredo
  const deny = await fetch(base + "/api/backup", { method: "POST", body: JSON.stringify({ code, secret: "outro", data: { ...data, bank: 999999 } }) });
  assert.strictEqual(deny.status, 403);
  await fetch(base + "/api/backup", { method: "POST", body: JSON.stringify({ code, secret, data: { ...data, bank: 150 } }) });
  const r = await fetch(`${base}/api/backup/${code}`).then((x) => x.json());
  assert.strictEqual(r.data.bank, 150);
  assert.deepStrictEqual(r.data.owned, ["a-gato", "x-MG-0"]);
  assert.strictEqual(r.data.uf, "MG");
  assert.deepStrictEqual(r.data.extras, data.extras);
  // lixo é descartado
  const junk = await fetch(base + "/api/backup", { method: "POST", body: JSON.stringify({ data: { bank: -5, owned: ["<script>"], uf: "XX", extras: { stickers: { "<b>": 5, "viz-2": -1 }, packs: 1e9, pet: { name: "x", hearts: -3 } } } }) }).then((x) => x.json());
  const j = await fetch(`${base}/api/backup/${junk.code}`).then((x) => x.json());
  assert.deepStrictEqual([j.data.bank, j.data.owned, j.data.uf], [0, [], null]);
  assert.deepStrictEqual([j.data.extras.stickers, j.data.extras.packs, j.data.extras.pet], [{}, 0, { name: 0, hearts: 0, wear: null, acc: [] }]);
  assert.strictEqual((await fetch(`${base}/api/backup/nao-existe-mesmo-10`)).status, 404);
});

test("limita tentativas de adivinhar códigos", async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await fetch(`${base}/api/backup/chute-${i}-aa-10`);
  assert.strictEqual(last.status, 429);
});

// ---------- Play Integrity ----------
test("avalia o veredito do Play Integrity", () => {
  const { judge } = require("../integridade.js");
  const good = { requestDetails: { requestPackageName: "app.trococerto", nonce: "abc" }, appIntegrity: { appRecognitionVerdict: "PLAY_RECOGNIZED" }, deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY"] } };
  assert.strictEqual(judge(good, "abc").ok, true);
  assert.strictEqual(judge(good, "outro").reason, "nonce");
  assert.strictEqual(judge({ ...good, appIntegrity: { appRecognitionVerdict: "UNRECOGNIZED_VERSION" } }, "abc").reason, "app");
  assert.strictEqual(judge({ ...good, deviceIntegrity: { deviceRecognitionVerdict: [] } }, "abc").reason, "aparelho");
});

test("fala com o Google para decodificar o token (com rede simulada)", async () => {
  const Integ = require("../integridade.js");
  Integ._reset();
  const { privateKey } = require("node:crypto").generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.GOOGLE_SERVICE_ACCOUNT = JSON.stringify({ client_email: "teste@proj.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) });
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push(url);
    if (url.includes("oauth2")) return { ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) };
    assert.strictEqual(opts.headers.Authorization, "Bearer tok");
    return { ok: true, json: async () => ({ tokenPayloadExternal: { requestDetails: { requestPackageName: "app.trococerto", nonce: "n-1" }, appIntegrity: { appRecognitionVerdict: "PLAY_RECOGNIZED" }, deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY"] } } }) };
  };
  const v = await Integ.verify("x".repeat(40), "n-1", fakeFetch);
  assert.strictEqual(v.ok, true);
  assert.ok(calls[1].endsWith("app.trococerto:decodeIntegrityToken"));
  delete process.env.GOOGLE_SERVICE_ACCOUNT;
});

test("com INTEGRITY_MODE=require, resultado sem prova do Google é recusado", async () => {
  process.env.INTEGRITY_MODE = "require";
  const { status } = await post({ day: today, uf: "SP", playerId: "jogador-sem-prova", rounds: play(today) });
  assert.strictEqual(status, 403);
  process.env.INTEGRITY_MODE = "log";
  const n = await fetch(base + "/api/nonce", { method: "POST", body: JSON.stringify({ playerId: "jogador-log" }) }).then((x) => x.json());
  const ok = await post({ day: today, uf: "SP", playerId: "jogador-log", rounds: play(today), integrity: { nonce: n.nonce, token: "falso" } });
  assert.strictEqual(ok.status, 201); // em modo "log" entra, mas fica anotado
  const H = { Authorization: "Bearer senha-do-dono-de-teste" };
  const dia = await fetch(`${base}/api/admin/dia?day=${today}`, { headers: H }).then((x) => x.json());
  assert.match(dia.resultados.find((r) => r.playerId === "jogador-log").integridade, /^falhou/);
  delete process.env.INTEGRITY_MODE;
});

// ---------- Dificuldades do desafio do dia ----------
test("cada dificuldade do desafio tem seus clientes e seu ranking", async () => {
  const facil = Regras.makeDaily(today, "facil").map((r) => ({ pieces: greedy(r.change), ms: 3000, wrong: 0 }));
  // troco do fácil não serve no difícil (clientes diferentes)
  const wrongDif = await post({ day: today, uf: "BA", playerId: "jogador-dif-1", dif: "dificil", rounds: facil });
  assert.strictEqual(wrongDif.status, 400);
  const ok = await post({ day: today, uf: "BA", playerId: "jogador-dif-1", dif: "facil", rounds: facil });
  assert.strictEqual(ok.status, 201);
  assert.strictEqual(ok.data.ranking.dif, "facil");
  assert.strictEqual(ok.data.ranking.totalBrasil, 1); // só quem jogou o fácil
  const dificil = await fetch(`${base}/api/ranking?day=${today}&uf=BA&dif=dificil&playerId=jogador-dif-1`).then((x) => x.json());
  assert.strictEqual(dificil.voce, null);
  const bad = await post({ day: today, uf: "BA", playerId: "jogador-dif-1", dif: "impossivel", rounds: facil });
  assert.strictEqual(bad.status, 400);
});
