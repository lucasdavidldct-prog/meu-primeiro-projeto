import { describe, expect, it } from 'vitest';
import { pickShotZone, saveChance, tellOf, ZONES } from '../src/engine/keeper';
import { seedRng } from '../src/engine/rng';
import { W } from '../src/engine/world';

const gk = [...W.players.values()].find(p => p.pos === 'GOL' && p.ovr >= 80)!;
const atk = [...W.players.values()].find(p => p.pos === 'ATA' && p.ovr >= 82)!;
describe('lance de goleiro', () => {
  it('acertar o canto defende muito mais que errar', () => {
    const shot = { col: 0, row: 0 } as const;
    expect(saveChance(shot, { col: 0, row: 0 }, gk, atk, false)).toBeGreaterThan(.55);
    expect(saveChance(shot, { col: 2, row: 0 }, gk, atk, false)).toBeLessThan(.1);
  });
  it('quem segue a pista do batedor defende mais do que quem chuta um lado', () => {
    seedRng(4);
    let pista = 0, azar = 0;
    for (let k = 0; k < 3000; k++) {
      const shot = pickShotZone(atk, false), tell = tellOf(shot, atk);
      pista += saveChance(shot, { col: tell, row: 0 }, gk, atk, false);
      azar += saveChance(shot, ZONES[k % 6], gk, atk, false);
    }
    expect(pista / 3000).toBeGreaterThan(azar / 3000 + .08);
  });
});
