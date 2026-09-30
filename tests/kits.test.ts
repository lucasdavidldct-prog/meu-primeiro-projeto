import { describe, expect, it } from 'vitest';
import { awayKit, colorDist } from '../src/engine/kits';
import { W } from '../src/engine/world';

describe('uniformes', () => {
  it('Galo x Botafogo: o rival não joga de preto e branco', () => {
    const cam = W.clubs.get('CAM')!, bot = W.clubs.get('BOT')!;
    const k = awayKit([cam.c1, cam.c2], [bot.c1, bot.c2]);
    expect(Math.min(colorDist(k[0], cam.c1), colorDist(k[0], cam.c2)) > 150 || colorDist(k[0], cam.c1) > 260).toBe(true);
  });
  it('cores bem diferentes mantêm o uniforme principal', () => {
    expect(awayKit(['#000000', '#ffffff'], ['#d62828', '#ffffff'])).toEqual(['#d62828', '#ffffff']);
  });
  it('nenhum confronto da Série A fica com camisas iguais', () => {
    const br = [...W.clubs.values()].filter(c => c.lg === 'brasileirao');
    for (const a of br) for (const b of br) if (a !== b) {
      const k = awayKit([a.c1, a.c2], [b.c1, b.c2]);
      expect(colorDist(k[0], a.c1)).toBeGreaterThan(150);
    }
  });
});
