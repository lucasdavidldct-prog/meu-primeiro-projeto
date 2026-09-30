import { afterEach, describe, expect, it } from 'vitest';
import { Match, fatigue, matchReward, sideOpp, simulate, type Side } from '../src/engine/match';
import { resetRng, seedRng } from '../src/engine/rng';
import { oppFromClub, type OppTeam } from '../src/engine/season';
import { clubStrength } from '../src/engine/squads';
import type { StyleId } from '../src/engine/types';
import { W, allClubs } from '../src/engine/world';

const club = (id: string, style: StyleId = 'equilibrado'): OppTeam => ({ ...oppFromClub(W.clubs.get(id)!), style });
const side = (id: string, style: StyleId = 'equilibrado'): Side => sideOpp(club(id, style));

afterEach(() => resetRng());

async function series(n: number, a: string, b: string, sa: StyleId = 'equilibrado', sb: StyleId = 'equilibrado') {
  let w = 0, d = 0, l = 0, goals = 0;
  for (let i = 0; i < n; i++) {
    const m = await simulate(side(a, sa), side(b, sb));
    goals += m.A.goals + m.B.goals;
    if (m.A.goals > m.B.goals) w++; else if (m.A.goals === m.B.goals) d++; else l++;
  }
  return { w, d, l, avg: goals / n };
}

/** Dois clubes reais com força parecida. */
function parecidos(): [string, string] {
  const cs = allClubs().map(c => ({ id: c.id, s: clubStrength(c.id) })).filter(c => c.s >= 72 && c.s <= 78).sort((a, b) => a.s - b.s);
  return [cs[0].id, cs.find(c => c.s === cs[0].s && c.id !== cs[0].id)?.id ?? cs[1].id];
}

describe('adversários reais', () => {
  it('escala 11 jogadores do elenco real, com goleiro no gol', () => {
    const s = side('CAM');
    expect(s.xi).toHaveLength(11);
    expect(s.xi.find(e => e.pos === 'GOL')!.P.pos).toBe('GOL');
    expect(s.xi.every(e => e.P.club === 'CAM')).toBe(true);
    expect(s.xi.some(e => e.P.filler)).toBe(false);
  });
  it('completa elenco incompleto com reservas genéricos identificados', () => {
    const tiny = allClubs().find(c => (W.byClub.get(c.id) ?? []).length < 11)!;
    const s = side(tiny.id);
    expect(s.xi).toHaveLength(11);
    expect(s.xi.some(e => e.P.filler && e.P.short.startsWith('Reserva'))).toBe(true);
  });
});

describe('motor de partida', () => {
  it('joga os dois tempos até o fim, com intervalo e acréscimos', async () => {
    seedRng(1);
    const m = new Match(side('CAM'), side('FLA'));
    let sawHt = false, ticks = 0;
    for (;;) {
      const r = await m.step();
      if (r === 'ht') { sawHt = true; m.secondHalf(); } else if (r === 'end') break; else ticks++;
    }
    expect(sawHt).toBe(true);
    expect(ticks).toBeGreaterThanOrEqual(93);
    expect(ticks).toBeLessThanOrEqual(98);
    expect(m.ev[0].text).toBe('Fim de jogo!');
    expect(m.possessionPct).toBeGreaterThanOrEqual(25);
    expect(m.possessionPct).toBeLessThanOrEqual(75);
    expect(m.st.on[0]).toBeLessThanOrEqual(m.st.sh[0]);
  });

  it('é determinístico com a mesma semente', async () => {
    seedRng(42); const a = await simulate(side('PAL'), side('CAM'));
    seedRng(42); const b = await simulate(side('PAL'), side('CAM'));
    expect([a.A.goals, a.B.goals, a.ev.length]).toEqual([b.A.goals, b.B.goals, b.ev.length]);
  });

  it('gols no placar batem com os artilheiros, e a narração usa nomes reais', async () => {
    seedRng(7);
    for (let i = 0; i < 30; i++) {
      const m = await simulate(side('CAM'), side('CRU'));
      expect(m.A.scorers.length).toBe(m.A.goals);
      expect(m.B.scorers.length).toBe(m.B.goals);
      for (const s of m.A.scorers) expect(W.byClub.get('CAM')!.some(p => s.startsWith(p.short))).toBe(true);
    }
  });

  it('times do mesmo nível: média de gols razoável e equilíbrio', async () => {
    seedRng(2024);
    const [a, b] = parecidos();
    const r = await series(300, a, b);
    expect(r.avg).toBeGreaterThan(1.6);
    expect(r.avg).toBeLessThan(4.2);
    expect(Math.abs(r.w - r.l)).toBeLessThan(90);
  });

  it('time bem mais forte vence a maioria', async () => {
    seedRng(99);
    expect(clubStrength('RMA') - clubStrength('REM')).toBeGreaterThan(10);
    const r = await series(200, 'RMA', 'REM');
    expect(r.w).toBeGreaterThan(r.l * 3);
  });

  it('retranca reduz os gols da partida', async () => {
    const [a, b] = parecidos();
    seedRng(5); const normal = await series(200, a, b);
    seedRng(5); const fechado = await series(200, a, b, 'retranca', 'retranca');
    expect(fechado.avg).toBeLessThan(normal.avg);
  });
});

describe('substituições e cansaço', () => {
  it('permite 5 trocas e bloqueia a sexta', () => {
    seedRng(3);
    const m = new Match(side('CAM'), side('FLA'));
    m.A.bench = side('PAL').xi.map(e => e.P).slice(0, 7);
    for (let k = 0; k < 5; k++) expect(m.substitute(k + 1, 0).ok).toBe(true);
    expect(m.A.subs).toBe(0);
    const r = m.substitute(7, 0);
    expect(r.ok).toBe(false);
    expect(r.msg).toMatch(/Sem substituições/);
  });

  it('não deixa o mesmo jogador em campo duas vezes', () => {
    seedRng(4);
    const m = new Match(side('CAM'), side('FLA'));
    m.A.bench = [m.A.xi[3].P];
    expect(m.substitute(5, 0).ok).toBe(false);
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
    const A = side('RMA'); A.you = true;
    let calls = 0;
    const m = new Match(A, side('REM'), { moments: 4, onMoment: async () => { calls++; return { goal: true, shot: true, onTarget: true, scorer: 'Mbappé', assist: null }; } });
    for (;;) { const r = await m.step(); if (r === 'ht') m.secondHalf(); else if (r === 'end') break; }
    expect(calls).toBeGreaterThan(0);
    expect(calls).toBeLessThanOrEqual(4);
    expect(m.momGoals).toBe(calls);
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
