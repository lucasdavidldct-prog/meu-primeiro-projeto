import { describe, expect, it } from 'vitest';
import { Match, sideOpp } from '../src/engine/match';
import { resetRng, seedRng } from '../src/engine/rng';
import { classico, classicoBoost, rivaisDe } from '../src/engine/rivals';
import { oppFromClub } from '../src/engine/season';
import { W } from '../src/engine/world';

async function serie(boost: number, cl?: ReturnType<typeof classico>) {
  seedRng(21);
  let v = 0, d = 0, cartoes = 0;
  for (let i = 0; i < 300; i++) {
    const m = new Match(sideOpp(oppFromClub(W.clubs.get('CAM')!)), sideOpp(oppFromClub(W.clubs.get('CRU')!), boost), { home: 0, classico: cl });
    for (;;) { const r = await m.step(); if (r === 'ht') m.secondHalf(); else if (r === 'end') break; }
    if (m.A.goals > m.B.goals) v++; else if (m.A.goals < m.B.goals) d++;
    cartoes += m.st.yc[0] + m.st.yc[1];
  }
  resetRng();
  return { v, d, cartoes };
}

describe('clássicos', () => {
  it('Galo x Cruzeiro é o Clássico Mineiro (peso máximo), nos dois sentidos', () => {
    expect(classico('CAM', 'CRU')).toEqual({ n: 'Clássico Mineiro', peso: 2 });
    expect(classico('CRU', 'CAM')?.n).toBe('Clássico Mineiro');
    expect(classico('CAM', 'SAN')).toBeUndefined();
    expect(rivaisDe('CAM').map(r => r.id)).toContain('CRU');
  });
  it('no clássico o rival fica mais difícil e o jogo mais pegado, mas não é derrota certa', async () => {
    const cl = classico('CAM', 'CRU');
    const normal = await serie(0), cls = await serie(classicoBoost(cl), cl);
    expect(cls.v).toBeLessThan(normal.v);
    expect(cls.cartoes).toBeGreaterThan(normal.cartoes);
    expect(cls.v).toBeGreaterThan(40); // ainda dá para ganhar bastante
  });
});
