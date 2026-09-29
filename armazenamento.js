// Onde o servidor guarda os dados.
// - Sem DATABASE_URL: arquivos em DATA_DIR (bom para rodar no computador).
// - Com DATABASE_URL: banco PostgreSQL (ex.: Neon grátis). Os dados sobrevivem
//   quando o servidor reinicia, o que no Render grátis acontece várias vezes por dia.
//
// Formato: registros do ranking são acrescentados (nunca reescritos) e relidos na
// partida do servidor. Códigos de recuperação ficam numa tabela à parte (um por código).
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const KEEP_DAYS = 60; // resultados mais antigos que isso não são carregados

function cutoffDay() {
  return new Date(Date.now() - 3 * 3600000 - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
}

class FileStore {
  constructor(dir) {
    this.dir = dir;
    this.records = path.join(dir, "resultados.jsonl");
    this.backups = path.join(dir, "backups.jsonl");
    this.kind = "arquivo";
  }
  async init() { fs.mkdirSync(this.dir, { recursive: true }); }
  readLines(file, fn) {
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try { fn(JSON.parse(line)); } catch { /* linha corrompida: ignora */ }
    }
  }
  async loadRecords(fn) { this.readLines(this.records, fn); }
  async loadBackups(fn) { this.readLines(this.backups, (r) => fn(r.code, { secretHash: r.secretHash, data: r.data, at: r.at })); }
  async appendRecord(rec) { fs.appendFileSync(this.records, JSON.stringify(rec) + "\n"); }
  async putBackup(code, b) { fs.appendFileSync(this.backups, JSON.stringify({ type: "backup", code, ...b }) + "\n"); }
  async close() {}
}

class PgStore {
  constructor(pool) {
    this.pool = pool;
    this.kind = "postgres";
  }
  async init() {
    await this.pool.query(`
      create table if not exists registros (
        id bigserial primary key,
        dia text not null,
        dados jsonb not null,
        criado timestamptz not null default now()
      );
      create index if not exists registros_dia on registros (dia);
      create table if not exists backups (
        codigo text primary key,
        segredo text not null,
        dados jsonb not null,
        atualizado timestamptz not null default now()
      );`);
  }
  async loadRecords(fn) {
    const { rows } = await this.pool.query("select dados from registros where dia >= $1 order by id", [cutoffDay()]);
    for (const r of rows) fn(r.dados);
  }
  async loadBackups(fn) {
    const { rows } = await this.pool.query("select codigo, segredo, dados, atualizado from backups");
    for (const r of rows) fn(r.codigo, { secretHash: r.segredo, data: r.dados, at: r.atualizado.toISOString() });
  }
  async appendRecord(rec) {
    await this.pool.query("insert into registros (dia, dados) values ($1, $2)", [rec.day, rec]);
  }
  async putBackup(code, b) {
    await this.pool.query(
      `insert into backups (codigo, segredo, dados, atualizado) values ($1, $2, $3, now())
       on conflict (codigo) do update set segredo = excluded.segredo, dados = excluded.dados, atualizado = now()`,
      [code, b.secretHash, b.data]);
  }
  async close() { await this.pool.end(); }
}

function createStore() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require("pg");
    return new PgStore(new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));
  }
  return new FileStore(process.env.DATA_DIR || path.join(__dirname, "dados"));
}

module.exports = { createStore, FileStore, PgStore };
