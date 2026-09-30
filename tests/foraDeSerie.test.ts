import { describe, expect, it } from 'vitest';
import { attackMods } from '../src/engine/lance';
import { packContents } from '../src/engine/packs';
import { marketValue } from '../src/engine/market';
import { cardData } from '../src/engine/cards';
import { resetRng, seedRng } from '../src/engine/rng';
import { W } from '../src/engine/world';

const grupo = (pos: string) => (pos === 'GOL' ? 'GOL' : pos === 'ZAG' ? 'ZAG' : pos === 'LD' || pos === 'LE' ? 'LAT' : pos === 'VOL' || pos === 'MC' ? 'MC' : pos === 'MEI' ? 'MEI' : pos === 'ATA' ? 'ATA' : 'PONTA');

describe('Fora de Série', () => {
  it('no máximo 3 por posição; Ronaldinho e Ronaldo estão entre eles', () => {
    const fs = W.legends.filter(p => p.fs), por: Record<string, number> = {};
    for (const p of fs) por[grupo(p.pos)] = (por[grupo(p.pos)] ?? 0) + 1;
    expect(Math.max(...Object.values(por))).toBeLessThanOrEqual(3);
    expect(fs.map(p => p.short)).toEqual(expect.arrayContaining(['Ronaldinho', 'Ronaldo']));
  });
  it('mais difícil de desarmar e erra menos que uma lenda do mesmo nível sem o selo', () => {
    const r = W.legends.find(p => p.short === 'Ronaldinho')!;
    const semSelo = { ...r, fs: undefined };
    expect(attackMods(r).dribbleLoss).toBeLessThan(attackMods(semSelo).dribbleLoss);
    expect(attackMods(r).shotMiss).toBeLessThan(attackMods(semSelo).shotMiss);
    expect(marketValue(cardData(r.id, 'lenda'))).toBeGreaterThan(1_000_000);
  });
  it('raríssimo no pacote Lenda (≈3%)', () => {
    seedRng(9);
    let n = 0;
    for (let i = 0; i < 2000; i++) if (W.players.get(packContents('lenda')[0].p)?.fs) n++;
    resetRng();
    expect(n / 2000).toBeLessThan(.06);
    expect(n).toBeGreaterThan(0);
  });
});
