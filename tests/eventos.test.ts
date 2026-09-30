import { describe, expect, it } from 'vitest';
import { cardData, TIER_N } from '../src/engine/cards';
import { currentEvent, packContents } from '../src/engine/packs';
import { marketValue } from '../src/engine/market';
import { BUNDLED_EVENTOS, W, getPlayer } from '../src/engine/world';

describe('cartas de evento semanais', () => {
  it('toda carta do arquivo vira carta no jogo (base existente ou avulsa completa)', () => {
    const total = BUNDLED_EVENTOS.eventos.reduce((s, e) => s + e.cartas.length, 0);
    expect(W.events.length).toBe(total);
  });
  it('carta de evento fica pelo menos +2 acima da normal e herda clube/química', () => {
    for (const P of W.events) {
      if (!P.ev?.base) continue;
      const b = getPlayer(P.ev.base)!;
      expect(P.ovr).toBeGreaterThanOrEqual(Math.min(99, b.ovr + 2));
      expect(P.nat).toBe(b.nat);
    }
    const lookman = W.events.find(p => p.short === 'Lookman')!;
    expect(lookman.club).toBe('ATM'); // troca de clube do evento
  });
  it('tem tier próprio, vale mais que a normal e sai no pacote do evento', () => {
    const P = cardData(W.events[0].id, 'evento');
    expect(P.tier).toBe('evento');
    expect(TIER_N[P.tier]).toBe('Evento');
    expect(marketValue(P)).toBeGreaterThan(marketValue(cardData(W.events[0].ev!.base!, 'base')));
    expect(currentEvent().length).toBeGreaterThan(10);
    const pk = packContents('evento');
    expect(pk[0].v).toBe('evento');
  });
});
