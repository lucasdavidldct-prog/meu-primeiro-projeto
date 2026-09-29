"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "troco-"));
const { createServer, dayKeyBrasilia } = require("../server.js");
const Regras = require("../public/regras.js");

let server, base;
before(async () => {
  server = createServer();
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

test("recusa o mesmo jogador duas vezes no dia", async () => {
  const { status } = await post({ day: today, uf: "SP", playerId: "jogador-aaaa", rounds: play(today) });
  assert.strictEqual(status, 409);
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
  assert.strictEqual(r.totalBrasil, 4);
  assert.strictEqual(r.totalUf, 3);
  assert.deepStrictEqual(r.voce, { score: 30000, posicaoBrasil: 4, posicaoUf: 3 });
  assert.strictEqual(r.estados[0].uf, "SP");       // único com 3+ jogadores
  assert.strictEqual(r.estados[0].posicao, 1);
  assert.strictEqual(r.estados[1].posicao, null);  // RJ tem só 1 jogador
});

test("grava cada resultado aceito no arquivo de dados", () => {
  const lines = fs.readFileSync(path.join(process.env.DATA_DIR, "resultados.jsonl"), "utf8").trim().split("\n");
  assert.strictEqual(lines.length, 4);
});

test("serve o jogo e bloqueia acesso fora da pasta pública", async () => {
  const home = await fetch(base + "/");
  assert.strictEqual(home.status, 200);
  assert.match(await home.text(), /Troco Certo/);
  assert.strictEqual((await fetch(base + "/regras.js")).status, 200);
  assert.notStrictEqual((await fetch(base + "/..%2fserver.js")).status, 200);
});
