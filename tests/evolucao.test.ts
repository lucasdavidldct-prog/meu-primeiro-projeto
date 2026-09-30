import { afterEach, describe, expect, it } from 'vitest';
import { applyEvolution, evolveSeason, type Evo } from '../src/engine/evolution';
import { seedRng } from '../src/engine/rng';
import { W } from '../src/engine/world';
import { clubStrength } from '../src/engine/squads';

afterEach(() => applyEvolution({}));
describe('evolução dos jogadores', () => {
  it('jovens sobem, veteranos caem e todos envelhecem', () => {
    seedRng(5);
    const snap = new Map([...W.pool].map(P => [P.id, { ovr: P.ovr, age: P.age }]));
    const evo: Evo = {};
    evolveSeason(evo); applyEvolution(evo);
    const d = (f: (a: number) => boolean) => { const l = W.pool.filter(P => !P.filler && f(snap.get(P.id)!.age)); return l.reduce((s, P) => s + P.ovr - snap.get(P.id)!.ovr, 0) / l.length; };
    expect(d(a => a <= 21)).toBeGreaterThan(1.5);
    expect(d(a => a >= 33)).toBeLessThan(-1.5);
    const P = W.pool.find(x => !x.filler)!;
    expect(P.age).toBe(snap.get(P.id)!.age + 1);
  });
  it('zerar a evolução volta aos dados originais (e a força dos clubes junto)', () => {
    seedRng(6);
    const f0 = clubStrength('CAM'), P = W.pool[0], o0 = P.ovr;
    const evo: Evo = {};
    for (let k = 0; k < 5; k++) { evolveSeason(evo); applyEvolution(evo); }
    applyEvolution({});
    expect(P.ovr).toBe(o0);
    expect(clubStrength('CAM')).toBe(f0);
  });
});
