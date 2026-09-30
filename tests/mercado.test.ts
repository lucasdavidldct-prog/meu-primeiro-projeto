import { describe, expect, it } from 'vitest';
import { bid, buyNow, committed, listMine, marketValue, newMarket, search, tick } from '../src/engine/market';
import { cardData } from '../src/engine/cards';
import { seedRng } from '../src/engine/rng';
import { W } from '../src/engine/world';

describe('mercado de leilão', () => {
  it('Ronaldinho custa entre centenas de milhares e ~1 milhão; carta comum vale pouco', () => {
    const r = W.legends.find(p => p.short === 'Ronaldinho')!;
    const v = marketValue(cardData(r.id, 'lenda'));
    expect(v).toBeGreaterThan(400000); expect(v).toBeLessThan(1500000);
    const comum = W.pool.find(p => p.ovr === 72 && !p.filler)!;
    expect(marketValue(cardData(comum.id, 'base'))).toBeLessThan(1000);
  });
  it('busca por nome gera anúncios; lance, CPU cobre ou você vence no fim', () => {
    seedRng(9);
    const M = newMarket(), now = 1_000_000;
    const res = search(M, 'ronaldinho', now);
    expect(res.length).toBeGreaterThan(0);
    const l = res[0];
    const ok = bid(M, l, 5_000_000, now);
    expect(ok.ok).toBe(true);
    expect(committed(M)).toBe(l.bid);
    // avança o relógio até o fim: ou a CPU cobriu, ou você venceu
    let t = now, fim = false;
    while (!fim && t < now + 30 * 60000) { t += 1000; for (const e of tick(M, t)) if (e.l === l && (e.kind === 'ganhou' || e.kind === 'superado')) fim = true; }
    expect(fim).toBe(true);
  });
  it('não deixa dar lance sem moedas livres; compre já funciona', () => {
    seedRng(10);
    const M = newMarket(), now = 5_000;
    const l = search(M, 'haaland', now)[0];
    expect(bid(M, l, 10, now).ok).toBe(false);
    const r = buyNow(M, l, 10_000_000, now);
    expect(r.ok).toBe(true);
    expect(l.done).toBe('comprado-ja');
  });
  it('carta anunciada por preço justo acaba vendida', () => {
    seedRng(12);
    let vendidas = 0;
    for (let k = 0; k < 20; k++) {
      const M = newMarket(), P = W.pool.find(p => p.ovr >= 84 && !p.filler)!, v = marketValue(cardData(P.id, 'base'));
      const l = listMine(M, 1, P.id, 'base', v * .7, v * 1.1, 3, 0);
      for (let t = 0; t <= 4 * 60000; t += 1000) tick(M, t);
      if (l.done === 'vendido' || l.done === 'comprado-ja') vendidas++;
    }
    expect(vendidas).toBeGreaterThan(12);
  });
});
