// npm run validar-dados — confere se os JSON em data/ estão consistentes.
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { LendasData, LigaData, NacoesData } from '../src/engine/data/schema';
import { LIGA_IDS } from '../src/engine/data/schema';
import { validarDados } from '../src/engine/data/validate';

const DATA = join(import.meta.dirname, '..', 'data');
const ler = <T>(p: string): T => {
  try { return JSON.parse(readFileSync(p, 'utf8')) as T; }
  catch (e) { console.error(`✗ ${p}: JSON inválido — ${(e as Error).message}`); process.exit(1); }
};

const arquivos: Record<string, string> = {};
const ligas = readdirSync(join(DATA, 'ligas')).filter(f => f.endsWith('.json')).sort().map(f => {
  const l = ler<LigaData>(join(DATA, 'ligas', f));
  arquivos[l.id] = basename(f, '.json');
  return l;
});
const nacoes = ler<NacoesData>(join(DATA, 'nacoes.json'));
const lendas = ler<LendasData>(join(DATA, 'lendas.json'));

const r = validarDados({ ligas, lendas, nacoes }, { arquivos });
for (const id of LIGA_IDS) if (!ligas.some(l => l.id === id)) r.erros.push(`faltando data/ligas/${id}.json`);

const verbose = process.argv.includes('--avisos');
const total = ligas.reduce((s, l) => s + l.clubes.reduce((t, c) => t + c.elenco.length, 0), 0);
console.log(`Ligas: ${ligas.length} · Clubes: ${ligas.reduce((s, l) => s + l.clubes.length, 0)} · Jogadores: ${total} · Lendas: ${lendas.lendas.length} · Nações: ${Object.keys(nacoes).length}`);
if (r.avisos.length) {
  console.log(`\n⚠ ${r.avisos.length} aviso(s)${verbose ? ':' : ' (use --avisos para ver todos)'}`);
  for (const a of verbose ? r.avisos : r.avisos.slice(0, 15)) console.log('  · ' + a);
}
if (r.erros.length) {
  console.log(`\n✗ ${r.erros.length} erro(s):`);
  for (const e of r.erros) console.log('  · ' + e);
  process.exit(1);
}
console.log('\n✓ Dados consistentes.');
