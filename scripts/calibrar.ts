// npm run calibrar — simulação em massa para conferir se o motor está realista.
// Alvo: ~2,3 gols por jogo entre times do mesmo nível, mando de campo pesando e goleadas só com diferença grande.
import { CALIB, sideOpp, simulate } from '../src/engine/match';
import { seedRng } from '../src/engine/rng';
import { clubStrength, squadOf, aiTactics } from '../src/engine/squads';
import { allClubs, type ClubInfo } from '../src/engine/world';

const N = Number(process.argv.find(a => a.startsWith('--n='))?.slice(4) ?? 500);
seedRng(Number(process.argv.find(a => a.startsWith('--seed='))?.slice(7) ?? 2026));

const clubs = allClubs().filter(c => squadOf(c.id).length >= 16).map(c => ({ c, s: clubStrength(c.id) }));
const team = (c: ClubInfo, opp: number) => { const t = aiTactics(c.id, opp); return sideOpp({ club: c.id, n: c.n, s: c.s, c1: c.c1, c2: c.c2, str: clubStrength(c.id), form: t.form, style: t.style }); };

/** Pares de clubes com diferença de força perto de `diff` (o primeiro é o mais forte). */
function pairs(diff: number, n: number): [ClubInfo, ClubInfo][] {
  const out: [ClubInfo, ClubInfo][] = [];
  for (let i = 0; out.length < n && i < n * 40; i++) {
    const a = clubs[Math.floor(Math.random() * clubs.length)];
    const cands = clubs.filter(b => b !== a && Math.abs(a.s - b.s - diff) <= (diff === 0 ? 1 : 1.5));
    if (cands.length) out.push([a.c, cands[Math.floor(Math.random() * cands.length)].c]);
  }
  return out;
}

async function run(ps: [ClubInfo, ClubInfo][], home: 0 | 1 | null) {
  let w = 0, d = 0, l = 0, g = 0, pen = 0, fk = 0;
  for (const [a, b] of ps) {
    const sa = clubStrength(a.id), sb = clubStrength(b.id);
    const m = await simulate(team(a, sb), team(b, sa), home);
    g += m.A.goals + m.B.goals;
    pen += [...m.A.scorers, ...m.B.scorers].filter(s => s.endsWith('(p)')).length;
    fk += [...m.A.scorers, ...m.B.scorers].filter(s => s.endsWith('(f)')).length;
    if (m.A.goals > m.B.goals) w++; else if (m.A.goals === m.B.goals) d++; else l++;
  }
  const n = ps.length, pct = (x: number) => `${Math.round(x / n * 100)}%`.padStart(4);
  return { n, avg: g / n, pen: pen / n, fk: fk / n, w: pct(w), d: pct(d), l: pct(l), wr: w / n, lr: l / n };
}

const t0 = Date.now();
console.log(`Calibração do motor (${N} partidas entre times do mesmo nível)\n`);
console.log('Constantes:', JSON.stringify(CALIB), '\n');
const eq = await run(pairs(0, N), null);
console.log(`Mesmo nível, campo neutro: ${eq.avg.toFixed(2)} gols/jogo · pênaltis convertidos ${eq.pen.toFixed(2)}/jogo · gols de falta ${eq.fk.toFixed(2)}/jogo`);
console.log(`  V ${eq.w} · E ${eq.d} · D ${eq.l}`);
const hm = await run(pairs(0, Math.round(N / 2)), 0);
console.log(`Mesmo nível, com mando: mandante V ${hm.w} · E ${hm.d} · D ${hm.l} (${hm.avg.toFixed(2)} gols/jogo)\n`);
console.log('Diferença de força (mais forte primeiro, campo neutro):');
const rows: { diff: number; wr: number; lr: number }[] = [];
let rows15avg = 0;
for (const diff of [3, 6, 10, 15]) {
  const r = await run(pairs(diff, Math.round(N / 2)), null);
  rows.push({ diff, wr: r.wr, lr: r.lr });
  if (diff === 15) rows15avg = r.avg;
  console.log(`  +${String(diff).padEnd(2)} → V ${r.w} · E ${r.d} · D ${r.l} · ${r.avg.toFixed(2)} gols/jogo (${r.n} jogos)`);
}
const ok = [
  ['Média de gols entre 2,15 e 2,5', eq.avg >= 2.15 && eq.avg <= 2.5],
  ['Pênaltis convertidos entre 0,15 e 0,35 por jogo', eq.pen >= .15 && eq.pen <= .35],
  ['Mandante vence bem mais do que perde (≥ 1,5×)', hm.wr >= hm.lr * 1.5],
  ['Vitórias do mais forte crescem com a diferença', rows.every((r, i) => i === 0 || r.wr >= rows[i - 1].wr - .03)],
  ['+15 vence pelo menos 75%', rows[rows.length - 1].wr >= .75],
  ['+15 tem mais gols por jogo que o mesmo nível', rows15avg > eq.avg + .3],
] as const;
console.log('');
for (const [n, v] of ok) console.log(`${v ? '✓' : '✗'} ${n}`);
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (ok.some(x => !x[1])) process.exit(1);
