import { describe, expect, it } from 'vitest';
import { awayKit, colorDist, goleiroKit, kitDistancia, kitsDaPartida, kitsDoClube } from '../src/engine/kits';
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

  it('Galo tem 3 uniformes (titular listrado); todo clube tem pelo menos 2', () => {
    const cam = kitsDoClube('CAM', '#000000', '#ffffff');
    expect(cam).toHaveLength(3);
    expect(cam[0].p).toBe('listras');
    for (const c of W.clubs.values()) expect(kitsDoClube(c.id, c.c1, c.c2).length).toBeGreaterThanOrEqual(2);
  });
  it('Galo x Botafogo: o visitante troca de uniforme; em casa o Botafogo fica com o dele', () => {
    const cam = { club: 'CAM', c1: '#000000', c2: '#ffffff' }, bot = { club: 'BOT', c1: '#000000', c2: '#ffffff' };
    const casa = kitsDaPartida(cam, bot, 0);
    expect(casa.a.n).toBe('Titular'); expect(casa.b.n).not.toBe('Titular');
    const fora = kitsDaPartida(cam, bot, 1);
    expect(fora.b.n).toBe('Titular'); expect(fora.a.n).not.toBe('Titular');
    // Uniforme escolhido: você fica com ele e o rival se adapta
    expect(kitsDaPartida(cam, bot, 1, 2).a.n).toBe('Terceiro');
  });
  it('nenhum confronto entre todos os clubes fica com uniformes que se confundem', () => {
    const cs = [...W.clubs.values()];
    let pior = Infinity;
    for (const a of cs) for (const b of cs) if (a !== b) {
      const k = kitsDaPartida({ club: a.id, c1: a.c1, c2: a.c2 }, { club: b.id, c1: b.c1, c2: b.c2 }, 0);
      pior = Math.min(pior, kitDistancia(k.a, k.b));
      expect(Math.min(kitDistancia(goleiroKit(k.a, k.b), k.a), kitDistancia(goleiroKit(k.a, k.b), k.b))).toBeGreaterThan(100);
    }
    expect(pior).toBeGreaterThan(150);
  });
});
