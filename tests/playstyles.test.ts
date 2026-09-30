import { afterEach, describe, expect, it } from 'vitest';
import { analyzeGesture, attackMods, fkOdds, fkSetup, fkShotFromGesture, keeperMods, type FkSetup } from '../src/engine/lance';
import { Match, fatigue, freeKickTaker, sideOpp, simulate, type MomentKind, type Side } from '../src/engine/match';
import { psLevel } from '../src/engine/playstyles';
import { mulberry32, resetRng, seedRng } from '../src/engine/rng';
import { oppFromClub } from '../src/engine/season';
import type { BasePlayer, Pos } from '../src/engine/types';
import { W } from '../src/engine/world';

afterEach(() => resetRng());

const side = (id: string): Side => sideOpp({ ...oppFromClub(W.clubs.get(id)!), style: 'equilibrado' });
/** Troca os playstyles dos jogadores em campo (cópias, sem mexer nos dados). */
function withPs(s: Side, f: (pos: Pos, i: number) => string[]): Side {
  s.xi.forEach((e, i) => { e.P = { ...e.P, ps: f(e.pos, i) }; });
  return s;
}
const none = (s: Side) => withPs(s, () => []);

async function run(n: number, mk: () => [Side, Side]) {
  let gf = 0, ga = 0, fk = 0, shB = 0;
  for (let i = 0; i < n; i++) {
    const [a, b] = mk();
    const m = await simulate(a, b);
    gf += m.A.goals; ga += m.B.goals; shB += m.st.sh[1];
    fk += m.A.scorers.filter(s => s.endsWith('(f)')).length;
  }
  return { gf: gf / n, ga: ga / n, fk: fk / n, shB: shB / n };
}

describe('nível de playstyle', () => {
  it('lê versão normal e +', () => {
    const P = { ps: ['cabeceio', 'reflexos+'] } as BasePlayer;
    expect(psLevel(P, 'cabeceio')).toBe(1);
    expect(psLevel(P, 'reflexos')).toBe(2);
    expect(psLevel(P, 'desarme')).toBe(0);
  });
});

describe('playstyles na simulação', () => {
  it('Incansável reduz o cansaço (e o + reduz mais)', () => {
    const base = { P: { ps: [] } as unknown as BasePlayer, pos: 'MC' as Pos, base: 70, inMin: 0, yc: 0, red: false, name: 'x' };
    const f0 = fatigue(base, 90), f1 = fatigue({ ...base, P: { ps: ['incansavel'] } as unknown as BasePlayer }, 90), f2 = fatigue({ ...base, P: { ps: ['incansavel+'] } as unknown as BasePlayer }, 90);
    expect(f1).toBeLessThan(f0);
    expect(f2).toBeLessThan(f1);
  });

  it('cobrador com Cobrança de Falta+ marca bem mais gols de falta', async () => {
    seedRng(31);
    const sem = await run(250, () => [none(side('CAM')), none(side('CRU'))]);
    seedRng(31);
    const com = await run(250, () => [withPs(side('CAM'), p => (p === 'MEI' || p === 'MC' ? ['cobranca-de-falta+'] : [])), none(side('CRU'))]);
    expect(com.fk).toBeGreaterThan(sem.fk * 2.5);
  });

  it('o cobrador escolhido é o especialista em faltas', () => {
    const s = withPs(side('CAM'), (_, i) => (i === 9 ? ['cobranca-de-falta'] : []));
    expect(freeKickTaker(s)).toBe(s.xi[9]);
  });

  it('ataque com Finalização Precisa+, Chute de Longe+ e Cabeceio+ faz mais gols', async () => {
    seedRng(40);
    const sem = await run(250, () => [none(side('CAM')), none(side('CRU'))]);
    seedRng(40);
    const com = await run(250, () => [withPs(side('CAM'), p => (p === 'GOL' ? [] : ['finalizacao-precisa+', 'chute-de-longe+', 'cabeceio+'])), none(side('CRU'))]);
    expect(com.gf).toBeGreaterThan(sem.gf * 1.2);
  });

  it('goleiro com Reflexos+ sofre menos gols', async () => {
    seedRng(50);
    const sem = await run(250, () => [none(side('CAM')), none(side('CRU'))]);
    seedRng(50);
    const com = await run(250, () => [withPs(side('CAM'), p => (p === 'GOL' ? ['reflexos+'] : [])), none(side('CRU'))]);
    expect(com.ga).toBeLessThan(sem.ga * .95);
  });

  it('defesa com Desarme e Interceptação cede menos finalizações', async () => {
    seedRng(60);
    const sem = await run(250, () => [none(side('CAM')), none(side('CRU'))]);
    seedRng(60);
    const com = await run(250, () => [withPs(side('CAM'), p => (['ZAG', 'LD', 'LE', 'VOL'].includes(p) ? ['desarme+', 'interceptacao+'] : [])), none(side('CRU'))]);
    expect(com.shB).toBeLessThan(sem.shB * .92);
  });

  it('o lance de falta só aparece quando o time tem cobrador com Cobrança de Falta', async () => {
    const kinds = async (A: Side) => {
      const seen: MomentKind[] = [];
      for (let i = 0; i < 60; i++) {
        const a = structuredClone(A); a.you = true;
        const m = new Match(a, none(side('REM')), { moments: 99, onMoment: async (_m, req) => { seen.push(req.kind); return { goal: false, shot: true, text: 'x' }; } });
        for (;;) { const r = await m.step(); if (r === 'ht') m.secondHalf(); else if (r === 'end') break; }
      }
      return seen;
    };
    seedRng(70);
    expect(await kinds(none(side('CAM')))).not.toContain('falta');
    seedRng(70);
    expect(await kinds(withPs(side('CAM'), (_, i) => (i === 8 ? ['cobranca-de-falta'] : [])))).toContain('falta');
  });
});

describe('playstyles nos lances', () => {
  const P = (ps: string[]) => ({ ps, st: [70, 70, 70, 70, 70, 70] } as unknown as BasePlayer);
  it('passe, drible e chute ficam melhores com os playstyles', () => {
    const a = attackMods(P([])), b = attackMods(P(['passe-preciso+', 'drible-rapido', 'finalizacao-precisa', 'velocista']));
    expect(b.passRadius).toBeLessThan(a.passRadius);
    expect(b.dribbleLoss).toBeLessThan(a.dribbleLoss);
    expect(b.shotMiss).toBeLessThan(a.shotMiss);
    expect(b.dribbleReach).toBeGreaterThan(a.dribbleReach);
    expect(keeperMods(P(['reflexos+'])).save).toBeGreaterThan(keeperMods(P([])).save);
  });

  it('gesto: direção mira, comprimento dá força, curva do traço dá efeito', () => {
    const reto = analyzeGesture([{ x: 0, y: 0 }, { x: 0, y: -5 }, { x: 0, y: -10 }], 20)!;
    expect(reto.power).toBeCloseTo(.5, 5);
    expect(Math.abs(reto.curve)).toBeLessThan(.01);
    expect(reto.angle).toBeCloseTo(-Math.PI / 2, 5);
    const esq = analyzeGesture([{ x: 0, y: 0 }, { x: -2, y: -5 }, { x: 0, y: -10 }], 20)!;
    const dir = analyzeGesture([{ x: 0, y: 0 }, { x: 2, y: -5 }, { x: 0, y: -10 }], 20)!;
    expect(Math.sign(esq.curve)).toBe(-Math.sign(dir.curve));
    expect(analyzeGesture([{ x: 0, y: 0 }, { x: 0, y: -.5 }], 20)).toBeNull();
  });

  it('falta: especialista converte mais; chute fraco para na barreira; forte demais vai por cima', () => {
    const setup: FkSetup = fkSetup(mulberry32(3));
    const angle = Math.atan2(0 - setup.ball.y, 36.4 - setup.ball.x);
    const shot = fkShotFromGesture(setup, { angle, power: .62, curve: .7 })!;
    const gk = P([]);
    const comum = fkOdds(setup, shot, P([]), gk), craque = fkOdds(setup, shot, P(['cobranca-de-falta+']), gk);
    expect(craque.goal).toBeGreaterThan(comum.goal);
    const aoMuro = fkShotFromGesture(setup, { angle: Math.atan2(setup.wall.y - setup.ball.y, setup.wall.x - setup.ball.x), power: .3, curve: 0 });
    if (aoMuro) expect(fkOdds(setup, aoMuro, P([]), gk).wall).toBeGreaterThan(.5);
    expect(fkOdds(setup, { ...shot, power: 1 }, P([]), gk).bar).toBeGreaterThan(.6);
    expect(fkOdds(setup, shot, P([]), P(['reflexos+'])).save).toBeGreaterThan(comum.save);
  });
});
