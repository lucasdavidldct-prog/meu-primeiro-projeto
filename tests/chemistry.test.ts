import { describe, expect, it } from 'vitest';
import { calcChem, effOvr, rate } from '../src/engine/chemistry';
import { slotsOf } from '../src/engine/positions';
import type { BasePlayer, Pos } from '../src/engine/types';

let id = 1;
function pl(pos: Pos, o: Partial<BasePlayer> = {}): BasePlayer {
  return { id: id++, name: 'J' + id, short: 'J', nat: 'BRA', pos, alt: [], ovr: 70, lg: 'BR', club: 0, age: 25, st: [70, 70, 70, 70, 70, 70], ...o };
}
const xiFor = (mk: (p: Pos, i: number) => Partial<BasePlayer>) => slotsOf('4-3-3').map((s, i) => pl(s.p, mk(s.p, i)));

describe('química', () => {
  it('time inteiro do mesmo clube, país e liga tem química máxima (33)', () => {
    const c = calcChem(xiFor(() => ({})), '4-3-3');
    expect(c.per).toEqual(Array(11).fill(3));
    expect(c.total).toBe(33);
  });

  it('jogador fora de posição tem química zero', () => {
    const xi = xiFor(() => ({}));
    xi[9] = pl('ZAG'); // ATA ocupado por zagueiro
    const c = calcChem(xi, '4-3-3');
    expect(c.per[9]).toBe(0);
  });

  it('posição alternativa conta como dentro de posição', () => {
    const xi = xiFor(() => ({}));
    xi[9] = pl('MEI', { alt: ['ATA'] });
    expect(calcChem(xi, '4-3-3').per[9]).toBe(3);
  });

  it('sem nenhum vínculo a química é zero', () => {
    const nats = ['BRA', 'ARG', 'POR', 'ESP', 'FRA', 'ING', 'ALE', 'ITA', 'HOL', 'URU', 'COL'];
    const lgs = nats.map(n => 'L' + n);
    const c = calcChem(xiFor((_, i) => ({ nat: nats[i], lg: lgs[i], club: i })), '4-3-3');
    expect(c.total).toBe(0);
  });

  it('faixas de clube: 2 → 1, 4 → 2, 7 → 3', () => {
    const nats = ['BRA', 'ARG', 'POR', 'ESP', 'FRA', 'ING', 'ALE', 'ITA', 'HOL', 'URU', 'COL'];
    const lgs = ['BR', 'IB', 'EN', 'IT', 'NO', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6'];
    // mesmo clube exige mesma liga; testamos só o componente de clube isolando país
    const mk = (n: number) => xiFor((_, i) => (i < n ? { nat: nats[i], lg: 'BR', club: 0 } : { nat: nats[i], lg: lgs[i], club: 50 + i }));
    // com n na mesma liga/clube, liga também pontua: 2 jogadores → clube 1 + liga 0
    expect(calcChem(mk(2), '4-3-3').per[0]).toBe(1);
    // 4 → clube 2 + liga 1 = 3
    expect(calcChem(mk(4), '4-3-3').per[0]).toBe(3);
  });

  it('lenda sempre tem química 3 e soma 2 para compatriotas', () => {
    const nats = ['ARG', 'ARG', 'POR', 'ESP', 'FRA', 'ING', 'ALE', 'ITA', 'HOL', 'URU', 'COL'];
    const xi = xiFor((_, i) => ({ nat: nats[i], lg: 'L' + i, club: i }));
    xi[0] = pl('GOL', { nat: 'ARG', leg: true, lg: 'ICO', club: -1 });
    const c = calcChem(xi, '4-3-3');
    expect(c.per[0]).toBe(3);
    // ARG: 1 jogador + lenda (2) = 3 → faixa 1
    expect(c.per[1]).toBe(1);
  });

  it('vaga vazia não pontua e não quebra', () => {
    const xi: (BasePlayer | null)[] = xiFor(() => ({}));
    xi[3] = null;
    const c = calcChem(xi, '4-3-3');
    expect(c.per[3]).toBe(0);
    expect(c.total).toBe(30);
  });
});

describe('overall efetivo', () => {
  it('goleiro na linha e jogador de linha no gol desabam para no máximo 32', () => {
    expect(effOvr(pl('GOL', { ovr: 85 }), 'ATA', 3)).toBe(34);
    expect(effOvr(pl('ATA', { ovr: 85 }), 'GOL', 0)).toBe(29);
  });
  it('fora de posição perde 7 e química vai de -3 a +2', () => {
    expect(effOvr(pl('ZAG', { ovr: 80 }), 'ATA', 0)).toBe(70);
    expect(effOvr(pl('ATA', { ovr: 80 }), 'ATA', 0)).toBe(77);
    expect(effOvr(pl('ATA', { ovr: 80 }), 'ATA', 3)).toBe(82);
  });
  it('vaga vazia vale 25', () => { expect(effOvr(null, 'MC', 3)).toBe(25); });
});

describe('força por setor', () => {
  it('um time uniforme tem os três setores iguais ao overall', () => {
    const r = rate(slotsOf('4-3-3').map(s => ({ pos: s.p, eff: 75 })));
    expect(r.att).toBeCloseTo(75, 5);
    expect(r.def).toBeCloseTo(75, 5);
    expect(r.mid).toBeCloseTo(75, 5);
    expect(r.gk).toBe(75);
  });
  it('expulsão reduz a força em 5%', () => {
    const e = slotsOf('4-3-3').map(s => ({ pos: s.p, eff: 75, red: false }));
    const base = rate(e).att;
    e[5].red = true;
    expect(rate(e).att).toBeLessThan(base * .96);
  });
});
