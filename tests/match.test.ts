import { afterEach, describe, expect, it } from 'vitest';
import { Match, fatigue, simulate, sideOpp, matchReward, type Side } from '../src/engine/match';
import { resetRng, seedRng } from '../src/engine/rng';
import type { OppTeam } from '../src/engine/season';

const team = (str: number, o: Partial<OppTeam> = {}): OppTeam =>
  ({ n: 'Time ' + str, s: 'T' + str, c1: '#fff', c2: '#000', str, form: '4-3-3', style: 'equilibrado', ...o });
const side = (str: number, o: Partial<OppTeam> = {}): Side => sideOpp(team(str, o));

afterEach(() => resetRng());

async function series(n: number, a: number, b: number, oa: Partial<OppTeam> = {}, ob: Partial<OppTeam> = {}) {
  let w = 0, d = 0, l = 0, goals = 0;
  for (let i = 0; i < n; i++) {
    const m = await simulate(side(a, oa), side(b, ob));
    goals += m.A.goals + m.B.goals;
    if (m.A.goals > m.B.goals) w++; else if (m.A.goals === m.B.goals) d++; else l++;
  }
  return { w, d, l, avg: goals / n };
}

describe('motor de partida', () => {
  it('joga os dois tempos até o fim, com intervalo e acréscimos', async () => {
    seedRng(1);
    const m = new Match(side(70), side(70));
    let sawHt = false, ticks = 0;
    for (;;) {
      const r = await m.step();
      if (r === 'ht') { sawHt = true; m.secondHalf(); } else if (r === 'end') break; else ticks++;
    }
    expect(sawHt).toBe(true);
    expect(ticks).toBeGreaterThanOrEqual(93);
    expect(ticks).toBeLessThanOrEqual(98);
    expect(m.over).toBe(true);
    expect(m.ev[0].text).toBe('Fim de jogo!');
    const poss = m.possessionPct;
    expect(poss).toBeGreaterThanOrEqual(25);
    expect(poss).toBeLessThanOrEqual(75);
    expect(m.st.on[0]).toBeLessThanOrEqual(m.st.sh[0]);
  });

  it('é determinístico com a mesma semente', async () => {
    seedRng(42); const a = await simulate(side(72), side(70));
    seedRng(42); const b = await simulate(side(72), side(70));
    expect([a.A.goals, a.B.goals, a.ev.length]).toEqual([b.A.goals, b.B.goals, b.ev.length]);
  });

  it('gols no placar batem com a lista de artilheiros', async () => {
    seedRng(7);
    for (let i = 0; i < 30; i++) {
      const m = await simulate(side(75), side(72));
      expect(m.A.scorers.length).toBe(m.A.goals);
      expect(m.B.scorers.length).toBe(m.B.goals);
    }
  });

  it('times do mesmo nível: média de gols razoável e equilíbrio', async () => {
    seedRng(2024);
    const r = await series(300, 72, 72);
    expect(r.avg).toBeGreaterThan(1.6);
    expect(r.avg).toBeLessThan(4.2);
    expect(Math.abs(r.w - r.l)).toBeLessThan(60);
  });

  it('time bem mais forte vence a maioria', async () => {
    seedRng(99);
    const r = await series(200, 82, 66);
    expect(r.w).toBeGreaterThan(r.l * 3);
  });

  it('retranca reduz os gols da partida', async () => {
    seedRng(5);
    const normal = await series(200, 72, 72);
    seedRng(5);
    const fechado = await series(200, 72, 72, { style: 'retranca' }, { style: 'retranca' });
    expect(fechado.avg).toBeLessThan(normal.avg);
  });
});

describe('substituições e cansaço', () => {
  it('permite 5 trocas e bloqueia a sexta', () => {
    seedRng(3);
    const m = new Match(side(70), side(70));
    m.A.bench = side(68).xi.map(e => e.P).slice(0, 7);
    for (let k = 0; k < 5; k++) expect(m.substitute(k + 1, 0).ok).toBe(true);
    expect(m.A.subs).toBe(0);
    const r = m.substitute(7, 0);
    expect(r.ok).toBe(false);
    expect(r.msg).toMatch(/Sem substituições/);
  });

  it('não deixa o mesmo jogador em campo duas vezes', () => {
    seedRng(4);
    const m = new Match(side(70), side(70));
    m.A.bench = [m.A.xi[3].P];
    const r = m.substitute(5, 0);
    expect(r.ok).toBe(false);
  });

  it('cansaço começa aos 55 minutos em campo e zera para quem entra', () => {
    const e = { P: null as never, pos: 'MC' as const, base: 70, inMin: 0, yc: 0, red: false, name: 'x' };
    expect(fatigue(e, 50)).toBe(0);
    expect(fatigue(e, 90)).toBe(1);
    expect(fatigue({ ...e, inMin: 60 }, 90)).toBe(0);
  });
});

describe('lances jogáveis', () => {
  it('chama o lance para o time do usuário e conta o gol', async () => {
    seedRng(11);
    const A = side(80); A.you = true;
    let calls = 0;
    const m = new Match(A, side(65), { moments: 4, onMoment: async () => { calls++; return { goal: true, shot: true, onTarget: true, scorer: 'Hulk', assist: null }; } });
    for (;;) { const r = await m.step(); if (r === 'ht') m.secondHalf(); else if (r === 'end') break; }
    expect(calls).toBeGreaterThan(0);
    expect(calls).toBeLessThanOrEqual(4);
    expect(m.momGoals).toBe(calls);
    expect(m.A.scorers.filter(s => s.startsWith('Hulk')).length).toBe(calls);
  });
});

describe('premiação', () => {
  it('vitória paga mais que empate, que paga mais que derrota; amistoso paga metade', () => {
    expect(matchReward(2, 0, 0, 1, true)).toBe(1020);
    expect(matchReward(1, 1, 0, 1, true)).toBe(510);
    expect(matchReward(0, 1, 0, 1, true)).toBe(250);
    expect(matchReward(2, 0, 0, 1, false)).toBe(510);
  });
});
