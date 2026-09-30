import { describe, expect, it } from 'vitest';
import { cardData, TIER_N } from '../src/engine/cards';
import { marketValue } from '../src/engine/market';
import { W } from '../src/engine/world';

const byShort = (s: string) => W.legends.find(p => p.short === s)!;

describe('lendas: Ídolos, Heróis e Hall da Fama', () => {
  it('mantém os ídolos do Galo e as categorias da lista', () => {
    expect(W.legends.filter(p => p.legClub === 'CAM').length).toBeGreaterThanOrEqual(19);
    expect(byShort('Ibrahimović').legCat).toBe('idolo');
    expect(byShort('Quaresma').legCat).toBe('heroi');
    expect(byShort('Akinfenwa').legCat).toBe('hall');
    expect(byShort('Maradona').legCat).toBe('idolo');
    // Saíram da lista de ídolos (e não são do Galo)
    for (const s of ['Platini', 'Puskás', 'Di Stéfano', 'Sinclair', 'Formiga']) expect(W.legends.find(p => p.short === s)).toBeUndefined();
    expect(W.legends.filter(p => p.legCat === 'idolo').length).toBeGreaterThan(130);
  });
  it('cada categoria tem a sua carta e o seu preço', () => {
    const ico = cardData(byShort('Kroos').id, 'lenda'), her = cardData(byShort('Hazard').id, 'lenda'), hof = cardData(byShort('Hulk').id, 'lenda');
    expect([TIER_N[ico.tier], TIER_N[her.tier], TIER_N[hof.tier]]).toEqual(['Ídolo', 'Herói', 'Hall da Fama']);
    expect(marketValue(ico)).toBeGreaterThan(marketValue(her));
    expect(marketValue(her)).toBeGreaterThan(marketValue(hof));
  });
});
