import { afterEach, describe, expect, it } from 'vitest';
import { LanceScene } from '../src/engine/lanceScene';
import { Match, freeKickTaker, penaltyTaker, sideOpp } from '../src/engine/match';
import { mulberry32, resetRng, seedRng } from '../src/engine/rng';
import { oppFromId } from '../src/engine/season';

afterEach(() => resetRng());
const match = () => { const A = sideOpp(oppFromId('CAM')); A.you = true; return new Match(A, sideOpp(oppFromId('CRU'))); };

describe('cena do lance', () => {
  it('monta cada tipo de lance', () => {
    seedRng(1);
    const m = match();
    const at = new LanceScene(m, { kind: 'ataque' }, mulberry32(1));
    expect(at.mates.length).toBeGreaterThanOrEqual(5);
    expect(at.foes.filter(f => f.gk)).toHaveLength(1);
    expect(at.actions).toBe(6);
    const pen = new LanceScene(m, { kind: 'penalti', taker: penaltyTaker(m.A) }, mulberry32(2));
    expect(pen.mates).toHaveLength(1);
    expect(pen.foes).toHaveLength(1);
    const fk = new LanceScene(m, { kind: 'falta', taker: freeKickTaker(m.A) }, mulberry32(3));
    expect(fk.foes.filter(f => !f.gk)).toHaveLength(4); // barreira
    expect(fk.setup).not.toBeNull();
  });

  it('passe certo passa a bola e o lance continua; a defesa reage', () => {
    for (let s = 1; s < 40; s++) {
      const sc = new LanceScene(match(), { kind: 'ataque' }, mulberry32(s));
      const mate = sc.mates.filter(m => m !== sc.carrier).sort((a, b) => sc.passP(b) - sc.passP(a))[0];
      const before = sc.field().map(f => [f.tx, f.ty].join());
      const plan = sc.perform({ kind: 'pass', m: mate });
      if (!plan.ok) continue;
      expect(plan.end).toBeUndefined();
      plan.commit();
      expect(sc.carrier).toBe(mate);
      expect(sc.field().map(f => [f.tx, f.ty].join())).not.toEqual(before);
      return;
    }
    throw new Error('nenhum passe completou');
  });

  it('arrastar em direção ao gol vira chute; para o lado não', () => {
    const sc = new LanceScene(match(), { kind: 'ataque' }, mulberry32(4));
    const c = sc.carrier;
    expect(sc.shotFromGesture({ angle: Math.atan2(-c.y, 34 - c.x), power: .6, curve: 0 })?.kind).toBe('shot');
    expect(sc.shotFromGesture({ angle: 0, power: .6, curve: 0 })).toBeNull();
  });

  it('força e curva mudam as chances do chute', () => {
    const sc = new LanceScene(match(), { kind: 'ataque' }, mulberry32(5));
    const ok = sc.shotOdds(36.5, .65, 0), forte = sc.shotOdds(36.5, 1, 0), fraco = sc.shotOdds(36.5, .15, 0);
    expect(forte.miss).toBeGreaterThan(ok.miss);
    expect(fraco.save).toBeGreaterThan(ok.save);
    // Um marcador bem na linha do chute: a curva contorna o bloqueio
    const [f, ...rest] = sc.field(), c = sc.carrier;
    for (const o of rest) { o.x = 2; o.y = 40; }
    f.x = c.x + (36.5 - c.x) * .5; f.y = c.y * .5;
    expect(sc.shotOdds(36.5, .65, .9).block).toBeLessThan(sc.shotOdds(36.5, .65, 0).block);
  });

  it('chutes resolvem o lance; gols terminam dentro do gol', () => {
    let goals = 0;
    for (let s = 1; s <= 200; s++) {
      const sc = new LanceScene(match(), { kind: 'penalti', taker: undefined }, mulberry32(s));
      const plan = sc.perform({ kind: 'shot', ax: 36.6, power: .7, curve: 0 });
      expect(plan.end).toBeDefined();
      if (plan.end!.goal) { goals++; expect(plan.ball[plan.ball.length - 1].y).toBeLessThan(0); expect(plan.end!.res.scorer).toBeTruthy(); }
    }
    expect(goals).toBeGreaterThan(80);
    expect(goals).toBeLessThan(190);
  });

  it('falta: cobrança pelo gesto termina o lance', () => {
    seedRng(6);
    const m = match();
    const sc = new LanceScene(m, { kind: 'falta', taker: freeKickTaker(m.A) }, mulberry32(6));
    const b = sc.setup!.ball;
    const pv = sc.fkFromGesture({ angle: Math.atan2(-b.y, 36 - b.x), power: .65, curve: .5 })!;
    expect(pv.goal).toBeGreaterThanOrEqual(0);
    const plan = sc.performFk(pv.shot);
    expect(plan.kind).toBe('fk');
    expect(plan.end).toBeDefined();
    expect(plan.ball.length).toBeGreaterThan(5);
  });
});
