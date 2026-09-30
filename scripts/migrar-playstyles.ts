// Distribui os playstyles novos (chute colocado, cavadinha, passe tenso, firula...) pelos atributos de cada jogador.
// Regras fixas + um "sorteio" determinístico pelo id, para nem todo mundo com o atributo alto ganhar.
// Uso: npx tsx scripts/migrar-playstyles.ts   (mantém os playstyles que o jogador já tem)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatLendas, formatLiga } from '../src/engine/data/format';
import { MAX_PLAYSTYLES, PLUS_MIN_OVR, parsePs, type JogadorData, type LigaData } from '../src/engine/data/schema';

const h = (s: string) => { let x = 2166136261; for (const c of s) x = Math.imul(x ^ c.charCodeAt(0), 16777619); return (x >>> 0) % 1000 / 1000; };
type A = { RIT: number; FIN: number; PAS: number; DRI: number; DEF: number; FIS: number };
const ATQ = ['ATA', 'PE', 'PD', 'MEI', 'ME', 'MD'], MEIO = ['MC', 'MEI', 'VOL', 'ME', 'MD'], DEFS = ['ZAG', 'LD', 'LE', 'VOL'];
const RULES: { id: string; ok: (a: A, p: string) => number; chance: number }[] = [
  { id: 'chute-colocado', ok: (a, p) => (ATQ.includes(p) || p === 'MC') && a.FIN >= 76 && a.DRI >= 78 ? (a.FIN + a.DRI) / 2 : 0, chance: .6 },
  { id: 'cavadinha', ok: (a, p) => ATQ.includes(p) && a.FIN >= 80 && a.DRI >= 80 ? (a.FIN + a.DRI) / 2 : 0, chance: .3 },
  { id: 'passe-tenso', ok: (a, p) => p !== 'GOL' && a.PAS >= 78 ? a.PAS : 0, chance: .4 },
  { id: 'lancamento', ok: (a, p) => (MEIO.includes(p) || DEFS.includes(p)) && a.PAS >= 79 ? a.PAS : 0, chance: .4 },
  { id: 'tiki-taka', ok: (a, p) => MEIO.includes(p) && a.PAS >= 80 && a.DRI >= 78 ? (a.PAS + a.DRI) / 2 : 0, chance: .45 },
  { id: 'firula', ok: (a, p) => ATQ.includes(p) && a.DRI >= 84 ? a.DRI : 0, chance: .45 },
  { id: 'tecnico', ok: (a, p) => p !== 'GOL' && p !== 'ZAG' && a.DRI >= 82 ? a.DRI : 0, chance: .45 },
  { id: 'resistente-pressao', ok: (a, p) => MEIO.includes(p) && a.DRI >= 78 && a.PAS >= 76 ? (a.DRI + a.PAS) / 2 : 0, chance: .4 },
  { id: 'antecipacao', ok: (a, p) => DEFS.includes(p) && a.DEF >= 80 ? a.DEF : 0, chance: .45 },
  { id: 'contencao', ok: (a, p) => DEFS.includes(p) && a.DEF >= 77 && a.RIT >= 68 ? a.DEF : 0, chance: .4 },
  { id: 'acrobatico', ok: (a, p) => (p === 'ATA' || p === 'PE' || p === 'PD') && a.FIN >= 80 && a.DRI >= 76 ? a.FIN : 0, chance: .25 },
  { id: 'trivela', ok: (a, p) => (ATQ.includes(p) || MEIO.includes(p)) && a.PAS >= 80 && a.DRI >= 82 ? (a.PAS + a.DRI) / 2 : 0, chance: .22 },
  { id: 'explosao', ok: (a, p) => p !== 'GOL' && a.RIT >= 86 ? a.RIT : 0, chance: .5 },
];

function migrar(j: JogadorData): number {
  if (j.posicao === 'GOL') return 0;
  const a = j.atributos as unknown as A, have = new Set(j.playstyles.map(x => parsePs(x).id));
  const room = Math.min(MAX_PLAYSTYLES, j.overall >= 84 ? 6 : j.overall >= 78 ? 5 : 4) - j.playstyles.length;
  if (room <= 0) return 0;
  const cands = RULES.filter(r => !have.has(r.id)).map(r => ({ r, v: r.ok(a, j.posicao) })).filter(x => x.v > 0 && h(j.id + x.r.id) < x.r.chance).sort((x, y) => y.v - x.v).slice(0, Math.min(room, 3));
  for (const { r, v } of cands) {
    const plus = j.overall >= Math.max(PLUS_MIN_OVR, 84) && v >= 88 && h(r.id + j.id) < .4;
    j.playstyles.push(r.id + (plus ? '+' : ''));
  }
  return cands.length;
}

let n = 0;
for (const f of readdirSync('data/ligas').filter(f => f.endsWith('.json'))) {
  const L = JSON.parse(readFileSync(join('data/ligas', f), 'utf8')) as LigaData;
  for (const c of L.clubes) for (const j of c.elenco ?? []) n += migrar(j);
  writeFileSync(join('data/ligas', f), formatLiga(L));
}
const lendas = JSON.parse(readFileSync('data/lendas.json', 'utf8'));
for (const j of lendas.lendas as JogadorData[]) n += migrar(j);
writeFileSync('data/lendas.json', formatLendas(lendas));
console.log(`${n} playstyles novos distribuídos.`);
