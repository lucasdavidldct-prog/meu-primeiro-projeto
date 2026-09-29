"use strict";
// Roda só com TEST_DATABASE_URL (um PostgreSQL de teste, que será limpo).
// Ex.: TEST_DATABASE_URL=postgresql://usuario@localhost:5432/troco npm test
const { test } = require("node:test");
const assert = require("node:assert");

const url = process.env.TEST_DATABASE_URL;
const opts = { skip: url ? false : "defina TEST_DATABASE_URL para testar com PostgreSQL" };

test("com PostgreSQL, ranking e códigos sobrevivem ao servidor reiniciar", opts, async () => {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url });
  await pool.query("drop table if exists registros; drop table if exists backups;");
  await pool.end();

  process.env.DATABASE_URL = url;
  process.env.ADMIN_TOKEN = "senha-do-dono-de-teste";
  const { createServer, dayKeyBrasilia } = require("../server.js");
  const Regras = require("../public/regras.js");
  const day = dayKeyBrasilia();
  const greedy = (a) => { const p = {}; for (const v of Regras.VALORES) while (a >= v) { p[v] = (p[v] || 0) + 1; a -= v; } return p; };
  const rounds = Regras.makeRounds(Regras.dailySeed(day)).map((r) => ({ pieces: greedy(r.change), ms: 4000, wrong: 0 }));

  const start = async () => { const s = await createServer(); await new Promise((r) => s.listen(0, r)); return s; };
  const at = (s) => `http://localhost:${s.address().port}`;

  // 1º "servidor": joga, troca apelido, remove alguém e cria código
  let s = await start();
  const saude = await fetch(at(s) + "/api/saude").then((r) => r.json());
  assert.strictEqual(saude.armazenamento, "postgres");
  for (const [pid, uf] of [["pg-jogador-1", "MG"], ["pg-jogador-2", "MG"], ["pg-trapaceiro", "SP"]]) {
    const r = await fetch(at(s) + "/api/resultado", { method: "POST", body: JSON.stringify({ day, uf, playerId: pid, nick: { n: 0, a: 0, num: 1 }, rounds }) });
    assert.strictEqual(r.status, 201);
  }
  await fetch(at(s) + "/api/apelido", { method: "POST", body: JSON.stringify({ day, playerId: "pg-jogador-1", nick: { n: 16, a: 4, num: 31 } }) });
  await fetch(at(s) + "/api/admin/remover", { method: "POST", headers: { Authorization: "Bearer senha-do-dono-de-teste" }, body: JSON.stringify({ day, playerId: "pg-trapaceiro" }) });
  const bk = await fetch(at(s) + "/api/backup", { method: "POST", body: JSON.stringify({ data: { bank: 77, owned: ["a-dino"], deco: {}, levels: {}, uf: "MG" } }) }).then((r) => r.json());
  await fetch(at(s) + "/api/backup", { method: "POST", body: JSON.stringify({ code: bk.code, secret: bk.secret, data: { bank: 88, owned: ["a-dino"], deco: {}, levels: {}, uf: "MG" } }) });
  await new Promise((r) => s.close(r));

  // 2º "servidor" (o Render reiniciou): tudo continua lá
  s = await start();
  const rk = await fetch(`${at(s)}/api/ranking?day=${day}&uf=MG&playerId=pg-jogador-1`).then((r) => r.json());
  assert.strictEqual(rk.totalBrasil, 2); // o trapaceiro removido continua fora
  assert.strictEqual(rk.voce.apelido, "🧀 Pão de Queijo Ágil 31");
  const again = await fetch(at(s) + "/api/resultado", { method: "POST", body: JSON.stringify({ day, uf: "MG", playerId: "pg-jogador-2", rounds }) });
  assert.strictEqual(again.status, 409); // continua valendo 1 por dia
  const back = await fetch(`${at(s)}/api/backup/${bk.code}`).then((r) => r.json());
  assert.strictEqual(back.data.bank, 88);
  await new Promise((r) => s.close(r));
  delete process.env.DATABASE_URL;
});
