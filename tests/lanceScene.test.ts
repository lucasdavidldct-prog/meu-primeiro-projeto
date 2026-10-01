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
    expect(at.mates.length).toBeGreaterThanOrEqual(3);
    expect(at.foes.filter(f => f.gk)).toHaveLength(1);
    expect(at.actions).toBeGreaterThanOrEqual(4);
    expect(at.actions).toBeLessThanOrEqual(7);
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

  it('as jogadas variam: cenários diferentes, com números diferentes de atacantes e defensores', () => {
    const cen = new Set<string>(), ataque = new Set<number>(), defesa = new Set<number>();
    for (let s = 1; s <= 60; s++) {
      const sc = new LanceScene(match(), { kind: 'ataque' }, mulberry32(s));
      cen.add(sc.cenario); ataque.add(sc.mates.length); defesa.add(sc.field().length);
    }
    expect(cen.size).toBeGreaterThanOrEqual(4);
    expect(ataque.size).toBeGreaterThanOrEqual(3);
    expect(defesa.size).toBeGreaterThanOrEqual(3);
  });

  it('rival na retranca: mais gente atrás da bola do que contra quem ataca', () => {
    const conta = (retranca: boolean) => {
      let n = 0;
      for (let s = 1; s <= 80; s++) { const m = match(); if (retranca) { m.B.style = 'retranca'; m.B.ment = -1; } n += new LanceScene(m, { kind: 'ataque' }, mulberry32(s)).field().length; }
      return n;
    };
    expect(conta(true)).toBeGreaterThan(conta(false));
  });

  it('sem a bola, os companheiros se mexem com um papel (infiltrar, abrir, apoiar...)', () => {
    const sc = new LanceScene(match(), { kind: 'ataque' }, mulberry32(9));
    expect(sc.mates.filter(m => m !== sc.carrier).every(m => !!m.papel)).toBe(true);
  });

  it('menu do chute: Rasteiro e Superchute retos, Colocado com curva; na bola alta, Cabeçada ou Voleio', () => {
    const sc = new LanceScene(match(), { kind: 'ataque' }, mulberry32(11));
    sc.carrier.x = 34; sc.carrier.y = 15;
    const ops = sc.shotOptions({ ax: 36, curve: .6 });
    expect(ops.map(o => o.nome)).toEqual(expect.arrayContaining(['Rasteiro', 'Superchute', 'Colocado']));
    for (const o of ops) if (o.t.kind === 'shot') expect(o.t.curve === 0).toBe(o.nome !== 'Colocado');
    sc.firstTime = true;
    const alto = sc.shotOptions({ ax: 36, curve: 0 });
    expect(alto[0].nome).toBe('Cabeçada');
    expect(sc.ballAt.h).toBeGreaterThan(1.5);
    const plan = sc.perform(alto[0].t);
    expect(plan.anim).toBe('cabeca');
    expect(plan.ball[0].h).toBeGreaterThan(1.5);
  });

  it('superchute: a bola chega bem mais rápido que o rasteiro', () => {
    const dur = (tipo: 'forte' | 'rasteiro') => {
      const sc = new LanceScene(match(), { kind: 'ataque' }, mulberry32(12));
      sc.carrier.x = 34; sc.carrier.y = 24; sc.foes.forEach(f => { if (!f.gk) { f.x = 3; f.y = 44; } });
      const p = sc.perform(sc.shotAs({ ax: 36, curve: 0 }, tipo));
      return p.dur;
    };
    expect(dur('forte')).toBeLessThan(dur('rasteiro') * .75);
  });

  it('menu do passe: rasteiro, alto e enfiado, com chances diferentes', () => {
    const sc = new LanceScene(match(), { kind: 'ataque' }, mulberry32(13));
    const m = sc.mates.find(x => x !== sc.carrier && !sc.isOffside(x))!;
    const ops = sc.passOptions(m);
    expect(ops.length).toBeGreaterThanOrEqual(2);
    expect(ops[0].t).toMatchObject({ kind: 'pass' });
    expect(ops[1].t).toMatchObject({ kind: 'pass', alto: true });
  });

  it('Primeiro Toque: quem recebe o passe com o estilo ganha uma ação a mais', () => {
    for (let s = 1; s < 60; s++) {
      const sc = new LanceScene(match(), { kind: 'ataque' }, mulberry32(s));
      const m = sc.mates.filter(x => x !== sc.carrier && !sc.isOffside(x)).sort((a, b) => sc.passP(b) - sc.passP(a))[0];
      if (!m) continue;
      m.e = { ...m.e!, P: { ...m.e!.P, ps: ['primeiro-toque'] } };
      const antes = sc.actions, plan = sc.perform({ kind: 'pass', m });
      if (!plan.ok) continue;
      expect(plan.bonus).toBeTruthy();
      expect(plan.ps?.some(t => t.id === 'primeiro-toque')).toBe(true);
      plan.commit();
      expect(sc.actions).toBe(antes);
      return;
    }
    throw new Error('nenhum passe completou');
  });

  it('mira fora das traves nunca vira gol (a bola não entra vindo de fora)', () => {
    for (let s = 1; s <= 150; s++) {
      const sc = new LanceScene(match(), { kind: 'ataque' }, mulberry32(s));
      sc.carrier.x = 34; sc.carrier.y = 14; sc.foes.forEach(f => { if (!f.gk) { f.x = 3; f.y = 44; } });
      for (const tipo of ['rasteiro', 'forte', 'colocado'] as const) {
        const t = sc.shotAs({ ax: 40.5, curve: 0 }, tipo);
        expect(sc.prob(t)).toBe(0);
      }
      const p = sc.perform(sc.shotAs({ ax: 41, curve: 0 }, 'forte'));
      expect(p.end!.goal).toBe(false);
    }
  });
});
