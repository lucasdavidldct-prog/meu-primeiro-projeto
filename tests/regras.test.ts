import { describe, expect, it } from 'vitest';
import { labMatch, labSetup } from '../src/engine/lab';
import { LanceScene } from '../src/engine/lanceScene';
import { mulberry32 } from '../src/engine/rng';

const cena = (kind: 'ataque' | 'escanteio' | 'lateral', seed = 5) => {
  const s = labSetup('drible-rapido', 2);
  return new LanceScene(labMatch(s), { kind, lado: 'meio', creator: s.tested }, mulberry32(seed));
};

describe('regras nos lances', () => {
  it('impedimento: passe para quem está à frente do penúltimo defensor e da bola', () => {
    const sc = cena('ataque');
    const alvo = sc.mates.find(m => m !== sc.carrier)!;
    sc.carrier.y = 25;
    alvo.y = sc.offsideLine() - 2; // à frente da linha
    expect(sc.isOffside(alvo)).toBe(true);
    expect(sc.passP(alvo)).toBe(0);
    const plan = sc.perform({ kind: 'pass', m: alvo });
    expect(plan.end?.text).toBe('Impedimento!');
  });
  it('não é impedimento quem está atrás da linha ou atrás da bola', () => {
    const sc = cena('ataque');
    const alvo = sc.mates.find(m => m !== sc.carrier)!;
    alvo.y = sc.offsideLine() + 1;
    expect(sc.isOffside(alvo)).toBe(false);
    sc.carrier.y = 5; alvo.y = 6; // atrás da bola
    expect(sc.isOffside(alvo)).toBe(false);
  });
  it('escanteio: cobrador na bandeirinha, gente na área, só dá para cruzar e não vale impedimento na cobrança', () => {
    const sc = cena('escanteio');
    expect(sc.setPiece).toBe(true);
    expect(sc.carrier.y).toBeLessThan(1);
    expect(sc.mates.filter(m => m !== sc.carrier && m.y < 16).length).toBeGreaterThanOrEqual(3);
    expect(sc.target(34, .5)).toBeNull(); // chute direto do escanteio não
    const m = sc.mates.find(x => x !== sc.carrier)!;
    expect(sc.target(m.x, m.y)).toMatchObject({ kind: 'pass', alto: true });
    expect(sc.isOffside(m)).toBe(false);
  });
  it('lateral: cobrador na linha lateral e primeira ação é passe', () => {
    const sc = cena('lateral');
    expect(sc.carrier.x < 1 || sc.carrier.x > 67).toBe(true);
    expect(sc.shotFromGesture({ angle: -Math.PI / 2, power: .7, curve: 0 })).toBeNull();
  });
  it('finta: tocar no próprio jogador tenta o drible; craque de drible tem boa chance', () => {
    const sc = cena('ataque');
    const c = sc.carrier;
    expect(sc.target(c.x, c.y)).toEqual({ kind: 'finta' });
    expect(sc.fintaP()).toBeGreaterThan(.3);
    const plan = sc.perform({ kind: 'finta' });
    expect(plan.say).toMatch(/!|…/);
  });
});
